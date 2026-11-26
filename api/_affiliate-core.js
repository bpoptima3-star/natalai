// api/_affiliate-core.js — NatalAI.live partner (affiliate) program core.
// Underscore prefix = Vercel does NOT deploy this as its own function; it is
// required by api/affiliate.js, api/create-order.js and api/paypal-webhook.js.
//
// Storage: the same Upstash Redis used for order stashing (KV_REST_API_URL / TOKEN).
//   aff:<code>            hash  — partner profile + counters (cents)
//   aff:email:<email>     str   — email -> code (one account per email)
//   aff:all               set   — all codes (admin list)
//   aff:sale:<orderId>    str   — NX claim; a sale can only ever be credited once
//   aff:sales:<code>      list  — recent sales (newest first, max 200)
//   aff:payouts:<code>    list  — payout history
//   aff:clk:<code>:<ip>:<day>  — click de-dupe (one click per IP per day)
//
// Every function here is defensive: an affiliate failure must NEVER block a payment
// or a report. Callers wrap in try/catch as well.

const crypto = require('crypto');

const RATE       = Math.min(Math.max(parseFloat(process.env.AFFILIATE_RATE || '0.70'), 0), 0.95);
const HOLD_DAYS  = 7;     // matches the 7-day money-back guarantee
const MIN_PAYOUT = 1000;  // cents ($10)
const SITE       = process.env.SITE_BASE_URL || 'https://natalai.live';
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'support@natalai.live';

let _redis = null;
function getRedis() {
  if (_redis) return _redis;
  try {
    const url = process.env.KV_REST_API_URL;
    const tok = process.env.KV_REST_API_TOKEN;
    if (!url || !tok) return null;
    const { Redis } = require('@upstash/redis');
    _redis = new Redis({ url, token: tok });
    return _redis;
  } catch (e) { return null; }
}
// Test hook — lets the local harness inject an in-memory Redis.
function _setRedisForTest(r) { _redis = r; }

function normCode(c) {
  const s = String(c || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);
  return s.length >= 2 ? s : '';
}
function normEmail(e) {
  const s = String(e || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : '';
}
function sha256(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function money(cents) { return '$' + (num(cents) / 100).toFixed(2); }
function parseMaybe(v) {
  if (v == null) return null;
  if (typeof v === 'string') { try { return JSON.parse(v); } catch (e) { return null; } }
  return v; // upstash auto-parses JSON
}
function linkFor(code) { return SITE + '/?ref=' + code; }
function dashFor(code, key) { return SITE + '/partners/#d=' + code + '.' + key; }

async function getPartner(code) {
  const redis = getRedis();
  if (!redis || !code) return null;
  const p = await redis.hgetall('aff:' + code);
  return (p && Object.keys(p).length) ? p : null;
}

// ── Email (Resend) — best effort, never throws ───────────────────────────────
async function sendEmail(to, subject, html) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'NatalAI Partners <support@natalai.live>', to: [to], subject, html })
    });
    return r.ok;
  } catch (e) { return false; }
}
function emailShell(inner) {
  return '<div style="font-family:Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px 24px;color:#1d1d1f">' +
    '<div style="font-family:Georgia,serif;font-size:22px;margin-bottom:18px">Natal<span style="color:#bf9a30">AI</span>.live</div>' +
    inner +
    '<p style="font-size:12px;color:#8a8a90;margin-top:28px;border-top:1px solid #eee;padding-top:14px">NatalAI Partner Program · Questions? Reply to this email.</p></div>';
}

// ── Signup ───────────────────────────────────────────────────────────────────
async function signup({ name, email, handle, paypal, code: wanted }) {
  const redis = getRedis();
  if (!redis) return { ok: false, status: 503, error: 'Partner program is temporarily unavailable.' };

  name   = String(name || '').trim().slice(0, 80);
  handle = String(handle || '').trim().replace(/^@/, '').slice(0, 60);
  const em = normEmail(email);
  const pp = normEmail(paypal) || em;
  if (!name || !em) return { ok: false, status: 400, error: 'Please enter your name and a valid email.' };

  // One account per email. If it exists, re-send their links by email (never reveal them here).
  const existing = await redis.get('aff:email:' + em);
  if (existing) {
    const p = await getPartner(String(existing));
    if (p) {
      const key = crypto.randomBytes(16).toString('hex');           // rotate key: old dashboard link dies
      const pc = String(p.code);
      await redis.hset('aff:' + pc, { key_hash: sha256(key) });
      await sendEmail(em, 'Your NatalAI partner links', emailShell(
        '<p>Here are your partner links again.</p>' +
        '<p><b>Your share link</b><br><a href="' + linkFor(pc) + '">' + linkFor(pc) + '</a></p>' +
        '<p><b>Your private dashboard</b><br><a href="' + dashFor(pc, key) + '">Open dashboard</a></p>'));
    }
    return { ok: false, status: 409, error: 'That email already has a partner account — we just emailed you your links.' };
  }

  // Pick a code: preferred → handle → name. Unique-ify with digits.
  let base = normCode(wanted) || normCode(handle) || normCode(name.replace(/\s+/g, '')) || 'partner';
  base = base.slice(0, 18);
  let code = base, n = 1;
  while (await redis.exists('aff:' + code)) { n += 1; code = base + n; if (n > 50) { code = base + crypto.randomBytes(2).toString('hex'); break; } }

  const key = crypto.randomBytes(16).toString('hex');
  await redis.hset('aff:' + code, {
    code, name, email: em, handle, paypal: pp,
    rate: String(RATE), status: 'active', created: new Date().toISOString(),
    clicks: 0, sales: 0, revenue_cents: 0, earned_cents: 0, paid_cents: 0,
    key_hash: sha256(key)
  });
  await redis.set('aff:email:' + em, code);
  await redis.sadd('aff:all', code);

  await sendEmail(em, 'Welcome to the NatalAI Partner Program ✦', emailShell(
    '<p>Hi ' + name.split(' ')[0] + ', you’re in. You earn <b>' + Math.round(RATE * 100) + '%</b> of every reading bought through your link.</p>' +
    '<p><b>Your share link</b><br><a href="' + linkFor(code) + '">' + linkFor(code) + '</a></p>' +
    '<p><b>Your private dashboard</b> (bookmark it — it’s your login)<br><a href="' + dashFor(code, key) + '">Open dashboard</a></p>' +
    '<p style="font-size:14px;color:#555">Tip: the free chart + 5 free questions is the easy yes for your audience. Lead with that — the paid report sells itself after.</p>'));
  await sendEmail(OWNER_EMAIL, 'New NatalAI partner: ' + code, emailShell(
    '<p>New partner signed up.</p><p><b>' + name + '</b> (@' + (handle || '—') + ')<br>' + em + '<br>PayPal: ' + pp + '<br>Code: <b>' + code + '</b></p>'));

  return { ok: true, code, link: linkFor(code), dashboard: dashFor(code, key), rate: RATE };
}

// ── Click (unique per IP per day) ────────────────────────────────────────────
async function trackClick(code, ip) {
  const redis = getRedis();
  code = normCode(code);
  if (!redis || !code) return { ok: false };
  const p = await getPartner(code);
  if (!p || p.status !== 'active') return { ok: true, valid: false };
  const day = new Date().toISOString().slice(0, 10);
  const first = await redis.set('aff:clk:' + code + ':' + sha256(ip || 'na').slice(0, 16) + ':' + day, 1, { nx: true, ex: 60 * 60 * 26 });
  if (first) await redis.hincrby('aff:' + code, 'clicks', 1);
  return { ok: true, valid: true };
}

// ── Credit a paid sale (idempotent) ──────────────────────────────────────────
// Called from the PayPal capture path AND the webhook; whichever runs first wins,
// the NX claim on aff:sale:<orderId> makes the second a no-op.
async function creditSale({ orderId, ref, amount, reportType, payerEmail, source }) {
  const redis = getRedis();
  const code = normCode(ref);
  if (!redis || !code || !orderId) return { credited: false, reason: 'no-ref' };
  if (String(orderId).startsWith('BYPASS')) return { credited: false, reason: 'bypass' };

  const p = await getPartner(code);
  if (!p || p.status !== 'active') return { credited: false, reason: 'unknown-partner' };

  const payer = normEmail(payerEmail);
  if (payer && (payer === normEmail(p.email) || payer === normEmail(p.paypal))) {
    return { credited: false, reason: 'self-purchase' };
  }

  const cents = Math.round(num(amount) * 100);
  if (cents <= 0) return { credited: false, reason: 'no-amount' };
  const rate = num(p.rate) || RATE;
  const commission = Math.round(cents * rate);

  const sale = { orderId: String(orderId), code, reportType: reportType || '', amount_cents: cents,
                 commission_cents: commission, ts: Date.now(), source: source || '' };
  const claimed = await redis.set('aff:sale:' + orderId, JSON.stringify(sale), { nx: true, ex: 60 * 60 * 24 * 400 });
  if (!claimed) return { credited: false, reason: 'duplicate' };

  await redis.hincrby('aff:' + code, 'sales', 1);
  await redis.hincrby('aff:' + code, 'revenue_cents', cents);
  await redis.hincrby('aff:' + code, 'earned_cents', commission);
  await redis.lpush('aff:sales:' + code, JSON.stringify(sale));
  await redis.ltrim('aff:sales:' + code, 0, 199);

  const first = String(p.name || '').split(' ')[0] || 'there';
  await sendEmail(p.email, 'You just earned ' + money(commission) + ' ✦', emailShell(
    '<p>Nice one, ' + first + ' — someone bought a reading through your link.</p>' +
    '<p style="font-size:28px;font-family:Georgia,serif;color:#a8882a;margin:8px 0">+' + money(commission) + '</p>' +
    '<p style="font-size:14px;color:#555">Paid monthly via PayPal once your balance passes ' + money(MIN_PAYOUT) + ' (after the 7-day refund window).</p>'));
  await sendEmail(OWNER_EMAIL, 'Partner sale: ' + code + ' ' + money(cents), emailShell(
    '<p>Partner <b>' + code + '</b> referred a ' + (reportType || 'report') + ' sale.</p><p>Sale ' + money(cents) + ' · Commission ' + money(commission) + '<br>Order ' + orderId + '</p>'));

  return { credited: true, commission_cents: commission, code };
}

// Look up a stashed order's ref (set at create-order time).
async function refForOrder(orderId) {
  const redis = getRedis();
  if (!redis || !orderId) return null;
  try { const o = parseMaybe(await redis.get('order:' + orderId)); return o || null; }
  catch (e) { return null; }
}

// ── Balances ─────────────────────────────────────────────────────────────────
async function balances(code, p) {
  const redis = getRedis();
  const raw = (await redis.lrange('aff:sales:' + code, 0, 199)) || [];
  const reversed = new Set(((await redis.smembers('aff:reversed')) || []).map(String));
  const sales = raw.map(parseMaybe).filter(s => s && !reversed.has(String(s.orderId)));
  const cutoff = Date.now() - HOLD_DAYS * 864e5;
  const pending = sales.filter(s => s.ts > cutoff).reduce((a, s) => a + num(s.commission_cents), 0);
  const earned = num(p.earned_cents), paid = num(p.paid_cents);
  const available = Math.max(0, earned - pending - paid);
  return { sales, pending, earned, paid, available };
}

async function stats(code, key) {
  code = normCode(code);
  const p = await getPartner(code);
  if (!p || !key || sha256(key) !== String(p.key_hash)) return { ok: false, status: 401, error: 'Dashboard link not recognised. Sign up again with the same email to get a fresh link.' };
  const b = await balances(code, p);
  return {
    ok: true, code, name: p.name, handle: p.handle, link: linkFor(code), rate: num(p.rate) || RATE,
    clicks: num(p.clicks), salesCount: num(p.sales),
    earned_cents: b.earned, pending_cents: b.pending, paid_cents: b.paid, available_cents: b.available,
    min_payout_cents: MIN_PAYOUT,
    recent: b.sales.slice(0, 20).map(s => ({ reportType: s.reportType, commission_cents: s.commission_cents, ts: s.ts }))
  };
}

// ── Admin ────────────────────────────────────────────────────────────────────
function isAdmin(k) {
  const real = process.env.AFFILIATE_ADMIN_KEY;
  if (!real || !k) return false;
  const a = Buffer.from(sha256(k)), b = Buffer.from(sha256(real));
  return crypto.timingSafeEqual(a, b);
}

async function adminList() {
  const redis = getRedis();
  const codes = (await redis.smembers('aff:all')) || [];
  const rows = [];
  for (const c of codes) {
    const p = await getPartner(c);
    if (!p) continue;
    const b = await balances(c, p);
    rows.push({ code: c, name: p.name, handle: p.handle, email: p.email, paypal: p.paypal, status: p.status,
      clicks: num(p.clicks), sales: num(p.sales), revenue_cents: num(p.revenue_cents),
      earned_cents: b.earned, pending_cents: b.pending, paid_cents: b.paid, available_cents: b.available,
      payable: b.available >= MIN_PAYOUT, created: p.created });
  }
  rows.sort((a, b) => b.available_cents - a.available_cents || b.sales - a.sales);
  return { ok: true, partners: rows, min_payout_cents: MIN_PAYOUT };
}

// Record that you paid a partner (after sending the PayPal payout yourself).
async function markPaid(code, cents) {
  const redis = getRedis();
  code = normCode(code);
  const p = await getPartner(code);
  if (!p) return { ok: false, status: 404, error: 'No such partner' };
  const b = await balances(code, p);
  const amt = Math.round(num(cents)) || b.available;
  if (amt <= 0) return { ok: false, status: 400, error: 'Nothing available to pay' };
  await redis.hincrby('aff:' + code, 'paid_cents', amt);
  await redis.lpush('aff:payouts:' + code, JSON.stringify({ cents: amt, ts: Date.now() }));
  await sendEmail(p.email, 'Your NatalAI payout: ' + money(amt), emailShell(
    '<p>We’ve sent <b>' + money(amt) + '</b> to your PayPal (' + p.paypal + '). Thank you for sharing NatalAI ✦</p>'));
  return { ok: true, code, paid_cents: amt };
}

// Reverse a refunded order's commission.
async function reverseSale(orderId) {
  const redis = getRedis();
  const s = parseMaybe(await redis.get('aff:sale:' + orderId));
  if (!s || s.reversed) return { ok: false, status: 404, error: 'No credited sale for that order' };
  await redis.hincrby('aff:' + s.code, 'sales', -1);
  await redis.hincrby('aff:' + s.code, 'revenue_cents', -num(s.amount_cents));
  await redis.hincrby('aff:' + s.code, 'earned_cents', -num(s.commission_cents));
  s.reversed = Date.now();
  await redis.sadd('aff:reversed', String(orderId));
  await redis.set('aff:sale:' + orderId, JSON.stringify(s), { ex: 60 * 60 * 24 * 400 });
  return { ok: true, code: s.code, reversed_cents: s.commission_cents };
}

async function setStatus(code, status) {
  const redis = getRedis();
  code = normCode(code);
  if (!(await getPartner(code))) return { ok: false, status: 404, error: 'No such partner' };
  await redis.hset('aff:' + code, { status: status === 'active' ? 'active' : 'paused' });
  return { ok: true };
}

module.exports = {
  RATE, HOLD_DAYS, MIN_PAYOUT,
  getRedis, normCode, signup, trackClick, creditSale, refForOrder, stats,
  isAdmin, adminList, markPaid, reverseSale, setStatus, _setRedisForTest
};
