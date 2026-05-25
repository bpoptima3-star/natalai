// api/create-order.js — NatalAI.live PayPal
const PAYPAL_BASE = process.env.PAYPAL_SANDBOX === 'true'
  ? 'https://api-m.sandbox.paypal.com'
  : 'https://api-m.paypal.com';

async function getAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret   = process.env.PAYPAL_SECRET;
  if (!clientId || !secret) throw new Error('Missing PayPal credentials');
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${clientId}:${secret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('PayPal auth failed');
  return data.access_token;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const body = req.body || {};

  // ─── OWNER BYPASS — for testing without real payment ────────────────────────
  // Requires DEV_BYPASS_TOKEN env var to be set AND request to include matching
  // token. Without env var set, bypass is impossible (default deny).
  // Token comes from request body (devToken field) or ?dev= query param.
  const BYPASS_TOKEN  = process.env.DEV_BYPASS_TOKEN;
  const requestToken  = body.devToken || (req.query && req.query.dev) || null;
  if (BYPASS_TOKEN && requestToken && requestToken === BYPASS_TOKEN) {
    console.log('[BYPASS] Owner bypass used:', {
      reportType: body.reportType || null,
      capture: !!body.capture,
      ts: new Date().toISOString()
    });
    if (body.capture && body.orderID) {
      // Bypass capture — synthetic COMPLETED response
      return res.status(200).json({
        status: 'COMPLETED',
        id: 'BYPASS-' + Date.now(),
        bypassed: true
      });
    }
    // Bypass order creation — synthetic approved order ID
    return res.status(200).json({
      id: 'BYPASS-ORDER-' + Date.now(),
      status: 'APPROVED',
      bypassed: true
    });
  }
  // ─── END BYPASS ─────────────────────────────────────────────────────────────

  try {
    const token = await getAccessToken();

    // ── CAPTURE existing order ─────────────────────────────────────────────────
    if (body.capture && body.orderID) {
      const r = await fetch(
        `${PAYPAL_BASE}/v2/checkout/orders/${body.orderID}/capture`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'PayPal-Request-Id': body.orderID + '-capture'  // idempotency key
          }
        }
      );
      const data = await r.json();
      if (!r.ok) return res.status(500).json({ error: 'Capture failed', details: data });
      return res.status(200).json({ status: data.status, id: data.id });
    }

    // ── CREATE new order ───────────────────────────────────────────────────────
    const VALID_PRICES = { natal: '4.99', timing: '5.99', cosmic: '6.99', compat: '6.99' };
    const safeAmount = VALID_PRICES[body.reportType];
    if (!safeAmount) return res.status(400).json({ error: 'Invalid report type' });

    const r = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: { currency_code: 'USD', value: safeAmount },
          description: body.description || 'NatalAI Report'
        }],
        application_context: {
          brand_name: 'NatalAI.live',
          user_action: 'PAY_NOW',
          return_url: 'https://natalai.live',
          cancel_url: 'https://natalai.live'
        }
      })
    });
    const data = await r.json();
    if (!r.ok) return res.status(500).json({ error: 'Order creation failed', details: data });
    return res.status(200).json({ id: data.id, status: data.status });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
