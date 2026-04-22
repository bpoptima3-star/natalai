// api/send-report.js — NatalAI.live v3
// Smart email cleaner: keeps cover dark, makes body light

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

function cleanBodySection(html) {
  let h = html;

  // Fix label+value clutter from CSS grid collapse
  h = h.replace(/<div class="cl">([^<]+)<\/div>\s*<div class="cv">([^<]+)<\/div>/g,
    '<div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.45);margin-bottom:2px">$1</div><div style="font-family:\'Cormorant Garamond\',Georgia,serif;font-size:15px;color:rgba(255,255,255,.88);margin-bottom:10px">$2</div>'
  );
  h = h.replace(/<span class="rep-meta-label">([^<]+)<\/span>\s*<span class="rep-meta-val">([^<]+)<\/span>/g,
    '<span style="display:block;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.45);margin-bottom:2px">$1</span><span style="display:block;font-family:\'Cormorant Garamond\',Georgia,serif;font-size:15px;color:rgba(255,255,255,.88);margin-bottom:10px">$2</span>'
  );

  // Remove chart house grid tables (they bleed as raw text)
  h = h.replace(/<div[^>]*class="rep-covgrid"[^>]*>[\s\S]*?<\/div>\s*<\/div>/g, '');

  // Light theme for body only
  h = h.replace(/background(?:-color)?:\s*#080a12/gi, 'background:#ffffff');
  h = h.replace(/background(?:-color)?:\s*#0d1020/gi, 'background:#f9f9f9');
  h = h.replace(/background(?:-color)?:\s*#131829/gi, 'background:#f5f5f7');
  h = h.replace(/background(?:-color)?:\s*#fafaf8/gi, 'background:#ffffff');

  // Fix dark text invisible on white
  h = h.replace(/color:\s*#e8e4dc/gi, 'color:#1d1d1f');
  h = h.replace(/color:\s*#fdfaf4/gi, 'color:#1d1d1f');
  h = h.replace(/(?<![a-z-])color:\s*#ffffff(?!\d)/gi, 'color:#1d1d1f');
  h = h.replace(/color:\s*rgba\(255,\s*255,\s*255[^)]*\)/gi, 'color:#6e6e73');

  // Fix invisible borders
  h = h.replace(/border[^:]*:\s*1px solid rgba\(255,\s*255,\s*255[^)]*\)/gi, 'border:1px solid #e5e5ea');
  h = h.replace(/border-bottom[^:]*:\s*1px solid rgba\(160,114,10[^)]*\)/gi, 'border-bottom:1px solid #e5e5ea');

  // Force period-grid cards to stack vertically (Gmail strips flex/grid)
  h = h.replace(/class="period-grid"/g, 'class="period-grid" style="display:block!important;width:100%!important"');
  h = h.replace(/class="p-card /g, 'class="p-card " style="display:block!important;width:100%!important;margin-bottom:16px!important;float:none!important" ');
  h = h.replace(/display:flex;flex-direction:column;gap:14px/g, 'display:block');

  // Increase font sizes for readability
  h = h.replace(/font-size:\s*10px/gi, 'font-size:12px');
  h = h.replace(/font-size:\s*11px/gi, 'font-size:13px');
  h = h.replace(/font-size:\s*12px/gi, 'font-size:14px');
  h = h.replace(/font-size:\s*13px/gi, 'font-size:15px');
  h = h.replace(/font-size:\s*14px/gi, 'font-size:16px');

  return h;
}

function processReportHtml(rawHtml) {
  let h = resolveVars(rawHtml);

  // Strip all visual-only elements that bleed as raw text in email
  // 1. SVG elements (chart diagrams — text nodes bleed as "1SagMa2Cap...")
  h = h.replace(/<svg[\s\S]*?<\/svg>/gi, '');
  // 2. rep-covgrid (house/planet abbreviation grids)
  h = h.replace(/<div[^>]*class="[^"]*rep-covgrid[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>/g, '');
  h = h.replace(/<div[^>]*class="rep-covgrid"[^>]*>[\s\S]*?<\/div>/g, '');
  // 3. The "Birth Chart vs Year Chart" comparison section (section 03) — chart text bleeds
  h = h.replace(/<div[^>]*class="[^"]*rep-sec[^"]*"[^>]*>[\s\S]*?Birth Chart.*?Year Chart[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g, '');

  // Split at the rep-cover/body boundary — keep cover dark, clean body only
  const coverEndMarker = '</div>\n<div style="padding:40px 48px';
  const altMarker = '</div><div style="padding:40px 48px';

  let splitIdx = h.indexOf(coverEndMarker);
  if (splitIdx === -1) splitIdx = h.indexOf(altMarker);

  if (splitIdx !== -1) {
    const markerLen = h.indexOf(coverEndMarker) !== -1 ? coverEndMarker.length : altMarker.length;
    const coverPart = h.slice(0, splitIdx + 6); // keep </div> closing the cover
    const bodyPart = h.slice(splitIdx + 6);
    return coverPart + cleanBodySection(bodyPart);
  }

  // Fallback: clean everything but protect rep-cover contents
  return cleanBodySection(h);
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

  const processedHtml = processReportHtml(reportHtml);

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
  /* Force cover section to stay dark + readable */
  .rep-cover{background:linear-gradient(135deg,#0d0d0d,#1a1008,#0d0d0d)!important;color:#ffffff!important;padding:52px 40px 44px!important}
  .rep-brand{color:rgba(191,154,48,.6)!important;font-size:11px!important;letter-spacing:.3em!important;text-transform:uppercase!important;margin-bottom:20px!important}
  .rep-title{color:#ffffff!important;font-size:28px!important;font-weight:300!important;margin-bottom:8px!important}
  .rep-name{color:#bf9a30!important;font-size:24px!important;font-style:italic!important;margin-bottom:24px!important}
  .rep-meta{display:block!important}
  .rep-meta-item{display:block!important;margin-bottom:10px!important}
  .rep-meta-label{display:block!important;font-size:10px!important;letter-spacing:.15em!important;text-transform:uppercase!important;color:rgba(255,255,255,.45)!important;margin-bottom:2px!important}
  .rep-meta-val{display:block!important;font-size:16px!important;color:rgba(255,255,255,.9)!important}
  /* Body sections light */
  .rep-body{background:#ffffff!important;color:#1d1d1f!important;padding:32px 40px!important}
  .rep-sh{color:#1a1a1a!important;font-size:22px!important}
  /* Force sub-period cards to stack vertically — Gmail strips flexbox/grid */
  .period-grid{display:block!important;width:100%!important}
  .p-card{display:block!important;width:100%!important;margin-bottom:16px!important;border-radius:10px!important;overflow:hidden!important;border:1px solid #e8e8e8!important;background:#ffffff!important}
  .p-card-header{display:block!important;padding:13px 16px 11px!important;border-bottom:1px solid #f0f0f0!important;background:#ffffff!important}
  .p-card-planet{display:block!important}
  .p-card-name{display:block!important;font-size:18px!important;color:#1a1a1a!important;font-family:'Cormorant Garamond',Georgia,serif!important}
  .p-card-dates{display:block!important;font-size:12px!important;color:#888888!important;margin-top:3px!important}
  .p-card-badge{display:block!important;margin-top:6px!important;padding:4px 10px!important;border-radius:20px!important;font-size:10px!important;font-weight:600!important}
  .p-card-badge.active{background:#fff3cd!important;color:#92650a!important}
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
  ${processedHtml}
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
