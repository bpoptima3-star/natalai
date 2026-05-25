// api/paypal-webhook.js — NatalAI.live PayPal async webhook
// Receives PAYMENT.CAPTURE.COMPLETED and other PayPal events.
// Returns 200 immediately (before processing) so PayPal doesn't retry.
// Idempotent: same event twice = same log, no double-action.
// To activate: set PAYPAL_WEBHOOK_ID in Vercel env vars (from PayPal developer dashboard).

const PAYPAL_BASE = process.env.PAYPAL_SANDBOX === 'true'
  ? 'https://api-m.sandbox.paypal.com'
  : 'https://api-m.paypal.com';

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
  // PayPal signature verification via their API
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

// Fulfilled order IDs — in-memory idempotency for the function lifetime.
// In production at scale, use a persistent store (Redis, DB).
// For NatalAI volumes this is sufficient — Vercel function instances are reused
// frequently enough that double-firing within seconds is caught.
const _seenOrders = new Set();

module.exports = async function handler(req, res) {
  // Return 200 immediately — PayPal requires fast response to avoid retries
  res.status(200).json({ received: true });

  if (req.method !== 'POST') return;

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
        return;
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

    // Idempotency check
    if (_seenOrders.has(captureId)) {
      console.log('[WEBHOOK] Duplicate event for capture', captureId, '— ignoring');
      return;
    }
    _seenOrders.add(captureId);

    console.log('[WEBHOOK] PAYMENT CONFIRMED:', {
      captureId, orderId, amount, payer,
      ts: new Date().toISOString()
    });

    // ── Fulfillment ──────────────────────────────────────────────────────────
    // NatalAI report delivery is client-side (submitReport() called after capture).
    // If the client closed before capture completed, the report wasn't generated.
    // Current state: this webhook logs confirmed payment to Vercel function logs.
    // TODO: To fully harden — on PAYMENT.CAPTURE.COMPLETED, trigger report
    // generation server-side and send result to payer email via Resend.
    // That requires: storing the report request params with the order ID at creation
    // time (e.g., in a KV store or edge config), then retrieving them here.
    // This is the next hardening step after the basic re-enable is stable.
    console.log('[WEBHOOK] Fulfillment: payment confirmed for order', orderId,
      '— report delivery is client-initiated. If client is gone, manual follow-up needed.');
  }

  // Log all other event types for observability
  if (event?.event_type && event.event_type !== 'PAYMENT.CAPTURE.COMPLETED') {
    console.log('[WEBHOOK] Unhandled event type:', event.event_type);
  }
};
