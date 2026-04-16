// api/create-order.js — NatalAI.live PayPal payment handler
// Creates and captures PayPal orders server-side for security

const PAYPAL_BASE = 'https://api-m.paypal.com'; // Live

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
  if (!data.access_token) throw new Error('PayPal auth failed: ' + JSON.stringify(data));
  return data.access_token;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const body = req.body || {};

  try {
    const token = await getAccessToken();

    // ── CAPTURE mode ─────────────────────────────────────────────────────────
    if (body.capture && body.orderID) {
      const r = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${body.orderID}/capture`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await r.json();
      if (!r.ok) return res.status(500).json({ error: 'Capture failed', details: data });
      return res.status(200).json({ status: data.status, id: data.id });
    }

    // ── CREATE ORDER mode ─────────────────────────────────────────────────────
    const { amount, description, reportType } = body;

    // Validate amount server-side — never trust client
    const VALID_PRICES = { natal: '19.00', compat: '24.00', timing: '24.00' };
    const safeAmount = VALID_PRICES[reportType];
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
          description: description || 'NatalAI Vedic Report'
        }],
        application_context: {
          brand_name: 'NatalAI.live',
          landing_page: 'NO_PREFERENCE',
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
    console.error('PayPal error:', e);
    return res.status(500).json({ error: e.message });
  }
};
