// api/paypal-webhook.js — NatalAI.live PayPal async webhook
// Receives PAYMENT.CAPTURE.COMPLETED and other PayPal events.
// On capture: generates the report server-side and emails it to the payer,
// so a paid customer always gets their report even if their browser closed.
// Idempotent via an atomic Redis claim (SET NX) so duplicate PayPal events
// (or retries) never double-send.
// Requires: PAYPAL_WEBHOOK_ID, KV_REST_API_URL, KV_REST_API_TOKEN in Vercel env.

const PAYPAL_BASE = process.env.PAYPAL_SANDBOX === 'true'
  ? 'https://api-m.sandbox.paypal.com'
  : 'https://api-m.paypal.com';

// Site base for calling our own /api/chart + /api/send-report endpoints.
const SITE_BASE = process.env.SITE_BASE_URL || 'https://natalai.live';

// Upstash Redis — reads order params stashed at create-order time.
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

async function getAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret   = process.env.PAYPAL_SECRET;
  if (!clientId || !secret) return null;
  try {
    const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${clientId}:${secret}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });
    const data = await res.json();
    return data.access_token || null;
  } catch(e) { return null; }
}

async function verifyWebhookSignature(token, webhookId, headers, rawBody) {
  try {
    const res = await fetch(`${PAYPAL_BASE}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transmission_id:   headers['paypal-transmission-id'],
        transmission_time: headers['paypal-transmission-time'],
        cert_url:          headers['paypal-cert-url'],
        auth_algo:         headers['paypal-auth-algo'],
        transmission_sig:  headers['paypal-transmission-sig'],
        webhook_id:        webhookId,
        webhook_event:     JSON.parse(rawBody)
      })
    });
    const data = await res.json();
    return data.verification_status === 'SUCCESS';
  } catch(e) {
    console.error('[WEBHOOK] Signature verification threw:', e.message);
    return false;
  }
}

// ── Server-side fulfillment: generate report + email to payer ────────────────
// Runs to completion BEFORE the handler responds (serverless-safe — no work is
// scheduled after the HTTP response, which Vercel would kill). Idempotent via an
// atomic SET NX claim so duplicate/retried events can't double-generate or double-send.
async function fulfillOrder(orderId, payerEmail) {
  const redis = getRedis();
  if (!redis) {
    console.warn('[WEBHOOK] No Redis configured — cannot server-fulfill order', orderId);
    return;
  }

  const fulfilledKey = 'fulfilled:' + orderId;

  // Atomic claim: succeeds only if no one has fulfilled this order yet.
  // Returns "OK" when set; null when the key already exists (already handled).
  let claimed = null;
  try {
    claimed = await redis.set(fulfilledKey, 'server', { nx: true, ex: 60 * 60 * 24 * 7 });
  } catch (e) {
    console.error('[WEBHOOK] Claim failed for', orderId, e.message);
    return; // if we can't claim safely, don't risk a double-send
  }
  if (!claimed) {
    console.log('[WEBHOOK] Order', orderId, 'already claimed — skipping (idempotent)');
    return;
  }

  // Read the params stashed at order-creation time.
  let params = null;
  try {
    const raw = await redis.get('order:' + orderId);
    params = (typeof raw === 'string') ? JSON.parse(raw) : raw; // upstash may auto-parse JSON
  } catch (e) {
    console.error('[WEBHOOK] Could not read params for', orderId, e.message);
    try { await redis.del(fulfilledKey); } catch (e2) {} // release so a retry can try
    return;
  }
  if (!params || !params.dob) {
    console.warn('[WEBHOOK] No usable params for', orderId, '— manual follow-up for payer', payerEmail);
    try { await redis.del(fulfilledKey); } catch (e2) {}
    return;
  }

  // 1) Generate the report HTML via our own /api/chart (_report path)
  let reportHtml = '';
  try {
    const genRes = await fetch(SITE_BASE + '/api/chart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        _report: true,
        reportType: params.reportType || 'natal',
        name: params.name, dob: params.dob, tob: params.tob, pob: params.pob, gender: params.gender,
        name2: params.name2, dob2: params.dob2, tob2: params.tob2, pob2: params.pob2, gender2: params.gender2,
        eventType: params.eventType
      })
    });
    const genData = await genRes.json();
    reportHtml = (genData && genData.html) ? genData.html : '';
  } catch (e) {
    console.error('[WEBHOOK] Report generation failed for', orderId, e.message);
  }
  if (!reportHtml) {
    console.error('[WEBHOOK] Empty report HTML for', orderId, '— releasing claim for retry');
    try { await redis.del(fulfilledKey); } catch (e) {}
    return;
  }

  // 2) Email it. Prefer on-site email if captured, else the PayPal payer email.
  const to = (params.email && params.email.includes('@')) ? params.email
           : (payerEmail && payerEmail !== 'unknown' && payerEmail.includes('@')) ? payerEmail
           : null;
  if (!to) {
    console.warn('[WEBHOOK] No deliverable email for', orderId, '— generated, manual send needed');
    return; // keep claim — report exists; avoid regenerating on retry
  }
  try {
    await fetch(SITE_BASE + '/api/send-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: to,
        name: params.name || '',
        reportType: params.reportType || 'natal',
        reportHtml: reportHtml
      })
    });
    console.log('[WEBHOOK] Server-fulfilled', orderId, '→ emailed', to);
  } catch (e) {
    console.error('[WEBHOOK] Email send failed for', orderId, e.message);
    try { await redis.del(fulfilledKey); } catch (e2) {} // release so a retry can resend
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ received: true });
  }

  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  const rawBody   = JSON.stringify(req.body); // Vercel parses body automatically
  const event     = req.body;

  console.log('[WEBHOOK] Event received:', {
    eventType: event?.event_type,
    eventId:   event?.id,
    orderId:   event?.resource?.id,
    ts:        new Date().toISOString()
  });

  // Signature verification (skip gracefully if PAYPAL_WEBHOOK_ID not yet set)
  if (webhookId) {
    const token = await getAccessToken();
    if (token) {
      const valid = await verifyWebhookSignature(token, webhookId, req.headers, rawBody);
      if (!valid) {
        console.error('[WEBHOOK] Signature verification FAILED — ignoring event');
        return res.status(200).json({ received: true });
      }
    } else {
      console.warn('[WEBHOOK] Could not get access token for signature verification — proceeding anyway');
    }
  } else {
    console.warn('[WEBHOOK] PAYPAL_WEBHOOK_ID not set — signature not verified. Set this env var in Vercel.');
  }

  // ── Handle PAYMENT.CAPTURE.COMPLETED ──────────────────────────────────────
  if (event?.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
    const captureId = event?.resource?.id;
    const orderId   = event?.resource?.supplementary_data?.related_ids?.order_id || captureId;
    const amount    = event?.resource?.amount?.value;
    const payer     = event?.resource?.payer?.email_address || 'unknown';

    console.log('[WEBHOOK] PAYMENT CONFIRMED:', { captureId, orderId, amount, payer, ts: new Date().toISOString() });

    // Fulfill BEFORE responding so the work actually completes on serverless.
    // (maxDuration for this function is raised in vercel.json to allow report gen.)
    try {
      await fulfillOrder(orderId, payer);
    } catch (e) {
      console.error('[WEBHOOK] Fulfillment error (non-fatal):', e.message);
    }
  } else if (event?.event_type) {
    console.log('[WEBHOOK] Unhandled event type:', event.event_type);
  }

  return res.status(200).json({ received: true });
};
