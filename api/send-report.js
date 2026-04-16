// api/send-report.js — NatalAI.live
// Sends report HTML to user via Resend

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Missing RESEND_API_KEY' });

  const { to, subject, reportHtml, name, reportType } = req.body || {};
  if (!to || !reportHtml) return res.status(400).json({ error: 'Missing email or report content' });

  const reportLabel = {
    natal: 'Birth Chart + Year Reading',
    compat: 'Soul Compatibility Reading',
    timing: 'Life Timing Guide'
  }[reportType] || 'Vedic Report';

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { margin: 0; padding: 0; background: #0d0f17; font-family: -apple-system, sans-serif; }
  .wrapper { max-width: 680px; margin: 0 auto; background: #0d0f17; }
  .header { background: #1d1d1f; padding: 32px 40px; text-align: center; border-bottom: 1px solid rgba(212,170,64,.2); }
  .brand { font-family: Georgia, serif; font-size: 22px; color: #f4dba0; letter-spacing: .1em; }
  .brand span { color: #bf9a30; }
  .tagline { font-size: 12px; color: rgba(244,219,160,.5); margin-top: 6px; letter-spacing: .15em; text-transform: uppercase; }
  .report-wrap { background: #080a12; margin: 0; }
  .footer { padding: 28px 40px; text-align: center; }
  .footer p { font-size: 11px; color: rgba(255,255,255,.3); line-height: 1.8; margin: 0; }
  .footer a { color: #bf9a30; text-decoration: none; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <div class="brand">Natal<span>AI</span>.live</div>
    <div class="tagline">Your ${reportLabel}</div>
  </div>
  <div class="report-wrap">
    <style>
      /* Inline CSS variable overrides for email clients */
      :root, * {
        --night:#080a12; --surface:#0d1020; --mid:#131829;
        --border:rgba(255,255,255,.08); --text:#e8e4dc;
        --cream:#fdfaf4; --white:#ffffff; --muted:#6e6e73;
        --gold:#bf9a30; --gold-l:#d4aa40; --green:#29956a;
        --red:#c04040; --bg:#f5f5f7; --phi:1.618;
        --r-md:10px; --r-lg:16px;
        --sp1:4px; --sp2:8px; --sp3:13px; --sp4:21px; --sp5:34px;
        --t1:10px; --t2:12px; --t3:14px; --t4:16px; --t5:19px;
      }
    </style>
    ${reportHtml}
  </div>
  <div class="footer">
    <p>
      This report was generated for ${name || 'you'} at <a href="https://natalai.live">NatalAI.live</a><br>
      AI-powered Vedic astrology · For personal insight only<br>
      Questions? <a href="mailto:support@natalai.live">support@natalai.live</a>
    </p>
  </div>
</div>
</body>
</html>`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'NatalAI <support@natalai.live>',
        to: [to],
        subject: subject || `Your ${reportLabel} — NatalAI.live`,
        html: emailHtml
      })
    });

    const d = await r.json();
    if (!r.ok) return res.status(500).json({ error: 'Resend error', details: d });
    return res.status(200).json({ success: true, id: d.id });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
