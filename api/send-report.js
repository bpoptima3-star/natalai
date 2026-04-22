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

function resolveVars(html) {
  return html.replace(/var\((--[\w-]+)\)/g, (m, v) => CSS_VARS[v] || m);
}

function cleanForEmail(html) {
  let h = resolveVars(html);

  // Fix the label+value clutter: "Rising SignAries" → "Rising Sign: Aries"
  // The rep-meta and rep-covgrid use class="cl" for label and class="cv" for value
  // Gmail strips grid/flex, making them concatenate. Fix by adding ": " after labels.
  h = h.replace(/<div class="cl">([^<]+)<\/div>\s*<div class="cv">([^<]+)<\/div>/g,
    '<div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.45);margin-bottom:2px">$1</div><div style="font-family:\'Cormorant Garamond\',Georgia,serif;font-size:15px;color:rgba(255,255,255,.88);margin-bottom:10px">$2</div>'
  );

  // Fix rep-meta-label + rep-meta-val same issue
  h = h.replace(/<div class="rep-meta-label">([^<]+)<\/div>\s*<div class="rep-meta-val">([^<]+)<\/div>/g,
    '<div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.45);margin-bottom:2px">$1</div><div style="font-family:\'Cormorant Garamond\',Georgia,serif;font-size:15px;color:rgba(255,255,255,.88);margin-bottom:10px">$2</div>'
  );

  // Remove chart grid tables (house concatenation)
  h = h.replace(/<div[^>]*class="[^"]*rep-covgrid[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>/g, '');

  // Light theme for body sections
  h = h.replace(/background(?:-color)?:\s*#080a12/gi, 'background:#ffffff');
  h = h.replace(/background(?:-color)?:\s*#0d1020/gi, 'background:#f9f9f9');
  h = h.replace(/background(?:-color)?:\s*#131829/gi, 'background:#f5f5f7');
  h = h.replace(/background(?:-color)?:\s*#1d1d1f(?![\d])/gi, (m, offset, str) => {
    // Only replace backgrounds, not text colors in dark cover section
    return 'background:#f5f5f7';
  });

  // Fix text colors that became invisible on white
  h = h.replace(/color:\s*#e8e4dc/gi, 'color:#1d1d1f');
  h = h.replace(/color:\s*#fdfaf4/gi, 'color:#1d1d1f');
  h = h.replace(/(?<![a-z-])color:\s*#ffffff(?!\d)/gi, 'color:#1d1d1f');
  h = h.replace(/color:\s*rgba\(255,255,255[^)]*\)/gi, 'color:#6e6e73');

  // Fix invisible borders
  h = h.replace(/border[^:]*:\s*1px solid rgba\(255,255,255[^)]*\)/gi, 'border:1px solid #e5e5ea');

  // Increase font sizes
  h = h.replace(/font-size:\s*10px/gi, 'font-size:12px');
  h = h.replace(/font-size:\s*11px/gi, 'font-size:13px');
  h = h.replace(/font-size:\s*12px/gi, 'font-size:14px');
  h = h.replace(/font-size:\s*13px/gi, 'font-size:15px');
  h = h.replace(/font-size:\s*14px/gi, 'font-size:16px');

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
    natal:  'Birth Chart + Year Reading',
    compat: 'Soul Compatibility Reading',
    timing: 'Life Timing Guide',
    cosmic: 'Cosmic Chemistry Reading',
  }[reportType] || 'Vedic Report';

  const cleanedHtml = cleanForEmail(reportHtml);

  const emailHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Outfit:wght@300;400;500&display=swap');
  body{margin:0;padding:0;background:#f5f5f7;font-family:'Outfit',-apple-system,sans-serif}
  .wrapper{max-width:660px;margin:0 auto;background:#ffffff}
  .header{background:#1d1d1f;padding:24px 40px;text-align:center;border-bottom:3px solid #bf9a30}
  .brand{font-family:'Cormorant Garamond',Georgia,serif;font-size:24px;color:#f4dba0;letter-spacing:.08em}
  .brand span{color:#bf9a30}
  .tagline{font-size:11px;color:rgba(244,219,160,.5);margin-top:4px;letter-spacing:.18em;text-transform:uppercase}
  /* Keep dark cover section dark */
  .rep-cover{background:linear-gradient(135deg,#0d0d0d,#1a1008,#0d0d0d)!important;color:#ffffff!important}
  .rep-cover,.rep-cover *{background-color:transparent!important}
  .rep-cover{background:linear-gradient(135deg,#0d0d0d,#1a1008,#0d0d0d)!important}
  /* Light body */
  .rep-body{background:#ffffff!important;padding:32px 40px!important;font-size:15px!important;color:#1d1d1f!important}
  .footer{background:#f5f5f7;padding:20px 40px;text-align:center;border-top:1px solid #e5e5ea}
  .footer p{font-size:12px;color:#6e6e73;line-height:1.8;margin:0}
  .footer a{color:#bf9a30;text-decoration:none}
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <div class="brand">Natal<span>AI</span>.live</div>
    <div class="tagline">Your ${reportLabel}</div>
  </div>
  <div style="background:#ffffff">
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
