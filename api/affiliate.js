// api/affiliate.js — NatalAI.live partner program endpoint.
// POST JSON { action, ... }
//   signup   { name, email, handle, paypal, code? }   → { code, link, dashboard }
//   click    { code }                                 → counts a unique click (per IP/day)
//   stats    { code, key }                            → partner's private dashboard data
//   admin    { adminKey }                             → all partners + balances
//   markPaid { adminKey, code, cents? }               → record a PayPal payout you sent
//   reverse  { adminKey, orderId }                    → undo commission on a refunded order
//   status   { adminKey, code, status: active|paused }
// Admin actions require AFFILIATE_ADMIN_KEY in Vercel env (unset = admin disabled).

const A = require('./_affiliate-core');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://natalai.live');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const action = String(body.action || '');

  if (!A.getRedis()) return res.status(503).json({ error: 'Partner program is temporarily unavailable.' });

  try {
    if (action === 'signup') {
      if (!body.agree) return res.status(400).json({ error: 'Please accept the partner terms.' });
      if (body.website) return res.status(200).json({ ok: true }); // honeypot — bots fill hidden fields
      const r = await A.signup(body);
      return res.status(r.ok ? 200 : (r.status || 400)).json(r);
    }

    if (action === 'click') {
      const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || '';
      const r = await A.trackClick(body.code, ip);
      return res.status(200).json(r);
    }

    if (action === 'stats') {
      const r = await A.stats(body.code, body.key);
      return res.status(r.ok ? 200 : (r.status || 400)).json(r);
    }

    // ── Admin ──
    if (['admin', 'markPaid', 'reverse', 'status'].includes(action)) {
      if (!A.isAdmin(body.adminKey)) return res.status(401).json({ error: 'Not authorised' });
      let r;
      if (action === 'admin')    r = await A.adminList();
      if (action === 'markPaid') r = await A.markPaid(body.code, body.cents);
      if (action === 'reverse')  r = await A.reverseSale(body.orderId);
      if (action === 'status')   r = await A.setStatus(body.code, body.status);
      return res.status(r.ok ? 200 : (r.status || 400)).json(r);
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    console.error('[AFFILIATE]', action, e.message);
    return res.status(500).json({ error: 'Something went wrong — please try again.' });
  }
};
