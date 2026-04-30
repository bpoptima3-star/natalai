// api/send-report.js — NatalAI.live

const CSS_VARS = {
  '--night':'#080a12','--surface':'#0d1020','--mid':'#131829',
  '--border':'#e5e5ea','--text':'#1d1d1f',
  '--cream':'#1d1d1f','--white':'#1d1d1f','--muted':'#6e6e73',
  '--gold':'#bf9a30','--gold-l':'#9a7520','--green':'#1a7a50',
  '--red':'#c04040','--bg':'#f5f5f7',
  '--r-md':'10px','--r-lg':'16px',
  '--sp1':'4px','--sp2':'8px','--sp3':'13px','--sp4':'21px','--sp5':'34px',
  '--t1':'11px','--t2':'13px','--t3':'15px','--t4':'17px','--t5':'20px',
};

function cleanForEmail(html) {
  let h = html;

  // 1. Resolve CSS variables
  h = h.replace(/var\((--[\w-]+)\)/g, (m, v) => CSS_VARS[v] || m);

  // 2. Strip ALL SVG elements entirely (they bleed text in email)
  h = h.replace(/<svg[\s\S]*?<\/svg>/gi, '');

  // 3. Light theme - replace dark backgrounds
  h = h.replace(/background(?:-color)?:\s*#080a12/gi, 'background:#ffffff');
  h = h.replace(/background(?:-color)?:\s*#0d1020/gi, 'background:#f9f9f9');
  h = h.replace(/background(?:-color)?:\s*#131829/gi, 'background:#f5f5f7');
  h = h.replace(/background(?:-color)?:\s*(rgba\(8,10,18[^)]*\))/gi, 'background:#ffffff');
  h = h.replace(/background(?:-color)?:\s*(rgba\(13,16,32[^)]*\))/gi, 'background:#f5f5f7');

  // 4. Fix dark text now invisible on white
  h = h.replace(/color:\s*#e8e4dc/gi, 'color:#1d1d1f');
  h = h.replace(/color:\s*#fdfaf4/gi, 'color:#1d1d1f');
  h = h.replace(/(?<!")color:\s*#ffffff(?![\d])/gi, 'color:#1d1d1f');
  h = h.replace(/color:\s*rgba\(253,250,244[^)]*\)/gi, 'color:#1d1d1f');
  h = h.replace(/color:\s*rgba\(255,255,255,\s*\.?[89][^)]*\)/gi, 'color:#1d1d1f');
  h = h.replace(/color:\s*rgba\(255,255,255,\s*1\)/gi, 'color:#1d1d1f');
  h = h.replace(/color:\s*rgba\(232,228,220[^)]*\)/gi, 'color:#1d1d1f');

  // 5. Fix invisible borders
  h = h.replace(/border[^:]*:\s*[\d.]+px solid rgba\(255,255,255[^)]*\)/gi, 'border:1px solid #e5e5ea');
  h = h.replace(/border-bottom[^:]*:\s*[\d.]+px solid rgba\(160,114,10[^)]*\)/gi, 'border-bottom:1px solid #e5e5ea');
  h = h.replace(/border[^:]*:\s*[\d.]+px solid rgba\(37,46,74[^)]*\)/gi, 'border:1px solid #e5e5ea');

  // 6. Increase font sizes
  h = h.replace(/font-size:\s*9px/gi,  'font-size:12px');
  h = h.replace(/font-size:\s*10px/gi, 'font-size:13px');
  h = h.replace(/font-size:\s*11px/gi, 'font-size:13px');
  h = h.replace(/font-size:\s*12px/gi, 'font-size:14px');
  h = h.replace(/font-size:\s*13px/gi, 'font-size:15px');
  h = h.replace(/font-size:\s*14px/gi, 'font-size:16px');

  // 7. Keep rep-cover dark intentionally
  h = h.replace(/<div class="rep-cover">([\s\S]*?)<\/div>\s*<div class="rep-body"/,
    (match) => match
      .replace(/background:#ffffff/g, 'background:#1d1d1f')
      .replace(/color:#1d1d1f/g, 'color:#ffffff')
  );

  return h;
}

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
    natal:       'Your Birth Reading',
    compat:      'Partner Compatibility',
    timing:      'Best Dates & Timing',
    free_chart:  'Free Vedic Birth Chart'
  }[reportType] || 'Vedic Report';

  const cleanedHtml = cleanForEmail(reportHtml);

  const emailHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:0;background:#f0f0f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif}
  .wrapper{max-width:640px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)}
  .header{background:#1d1d1f;padding:24px 32px;text-align:center;border-bottom:3px solid #bf9a30}
  .brand{font-size:22px;color:#f4dba0;letter-spacing:.06em;font-weight:300}
  .brand b{color:#bf9a30;font-weight:600}
  .tagline{font-size:11px;color:rgba(244,219,160,.45);margin-top:4px;letter-spacing:.16em;text-transform:uppercase}
  .body-wrap{background:#ffffff;color:#1d1d1f;font-size:15px;line-height:1.7}
  /* Keep cover dark */
  .rep-cover{background:#1d1d1f!important}
  .rep-cover,.rep-cover *{color:#ffffff!important}
  .rep-cover em,.rep-cover .rep-h1 em{color:#bf9a30!important}
  .rep-cover .rep-covgrid .cl{color:rgba(255,255,255,.45)!important;font-size:11px!important}
  .rep-cover .rep-covgrid .cv{color:rgba(255,255,255,.85)!important;font-size:14px!important}
  /* Body light */
  .rep-body{background:#ffffff!important;padding:28px 32px!important;color:#1d1d1f!important}
  .rep-secnum{color:#bf9a30!important;font-size:13px!important}
  .rep-sechead h2{color:#1d1d1f!important;font-size:20px!important}
  .rep-divider{color:#bf9a30!important;text-align:center;padding:12px 0}
  .footer{background:#f5f5f5;padding:20px 32px;text-align:center;border-top:1px solid #e5e5ea}
  .footer p{font-size:12px;color:#888;line-height:1.8;margin:0}
  .footer a{color:#bf9a30;text-decoration:none}
</style>
</head>
<body>
<div style="padding:20px 0">
<div class="wrapper">
  <div class="header">
    <div class="brand">Natal<b>AI</b>.live</div>
    <div class="tagline">Your ${reportLabel}</div>
  </div>
  <div class="body-wrap">
    ${cleanedHtml}
  </div>
  <div class="footer">
    <p>
      Generated for ${name || 'you'} &middot; <a href="https://natalai.live">NatalAI.live</a><br>
      AI-powered Vedic astrology &middot; For personal insight only<br>
      <a href="mailto:support@natalai.live">support@natalai.live</a>
    </p>
  </div>
</div>
</div>
</body>
</html>`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
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
