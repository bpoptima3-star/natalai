// api/send-report.js — NatalAI.live v2
// Handles email delivery via Resend
// Also logs all report events to Google Sheets
'use strict';

const CSS_VARS = {
  '--night':'#080a12','--surface':'#0d1020','--mid':'#131829',
  '--border':'#e5e5ea','--text':'#1d1d1f','--cream':'#1d1d1f',
  '--white':'#1d1d1f','--muted':'#6e6e73','--gold':'#bf9a30',
  '--gold-l':'#9a7520','--green':'#1a7a50','--red':'#c04040',
  '--bg':'#f5f5f7','--r-md':'10px','--r-lg':'16px',
};

function resolveVars(html) {
  return html.replace(/var\((--[\w-]+)\)/g, (m,v) => CSS_VARS[v]||m);
}

function cleanForEmail(html) {
  let h = resolveVars(html);
  // Remove SVG charts
  h = h.replace(/<div[^>]*display:grid[^>]*grid-template-columns:1fr 1fr[^>]*gap:16px[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g,'');
  h = h.replace(/<svg[\s\S]*?<\/svg>/gi,'');
  // Light theme overrides
  h = h.replace(/background(?:-color)?:\s*#080a12/gi,'background:#ffffff');
  h = h.replace(/background(?:-color)?:\s*#0d1020/gi,'background:#f9f9f9');
  h = h.replace(/background(?:-color)?:\s*#131829/gi,'background:#f5f5f7');
  h = h.replace(/background(?:-color)?:\s*#1d1d1f/gi,'background:#ffffff');
  h = h.replace(/background(?:-color)?:\s*rgba\(8,10,18[^)]*\)/gi,'background:#ffffff');
  h = h.replace(/background(?:-color)?:\s*rgba\(19,24,41[^)]*\)/gi,'background:#f5f5f7');
  // Fix invisible text on white
  h = h.replace(/(?<![a-z-])color:\s*#e8e4dc/gi,'color:#1d1d1f');
  h = h.replace(/(?<![a-z-])color:\s*#fdfaf4/gi,'color:#1d1d1f');
  h = h.replace(/(?<![a-z-])color:\s*#ffffff(?!\d)/gi,'color:#1d1d1f');
  h = h.replace(/(?<![a-z-])color:\s*rgba\(255,255,255[^)]*\)/gi,'color:#6e6e73');
  h = h.replace(/(?<![a-z-])color:\s*rgba\(253,250,244[^)]*\)/gi,'color:#1d1d1f');
  // Fix borders
  h = h.replace(/border[^:]*:\s*[\d.]+px solid rgba\(255,255,255[^)]*\)/gi,'border:1px solid #e5e5ea');
  h = h.replace(/border[^:]*:\s*[\d.]+px solid rgba\(37,46,74[^)]*\)/gi,'border:1px solid #e5e5ea');
  // Readable font sizes
  h = h.replace(/font-size:\s*9px/gi,'font-size:12px');
  h = h.replace(/font-size:\s*10px/gi,'font-size:12px');
  h = h.replace(/font-size:\s*11px/gi,'font-size:13px');
  h = h.replace(/font-size:\s*12px/gi,'font-size:14px');
  h = h.replace(/font-size:\s*13px/gi,'font-size:15px');
  h = h.replace(/font-size:\s*14px/gi,'font-size:16px');
  return h;
}

function logToSheets(data) {
  const url = process.env.SHEETS_WEBHOOK;
  if(!url) return;
  fetch(url, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({...data, timestamp:new Date().toISOString()})
  }).catch(()=>{});
}

const REPORT_LABELS = {
  natal:  'Birth Chart + Year Reading',
  compat: 'Soul Compatibility Reading',
  timing: 'Life Timing Guide',
  cosmic: 'Cosmic Chemistry Reading',
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS') return res.status(200).end();
  if(req.method!=='POST') return res.status(405).json({error:'POST only'});

  const resendKey = process.env.RESEND_API_KEY;
  if(!resendKey) return res.status(500).json({error:'Missing RESEND_API_KEY'});

  const {to, subject, reportHtml, name, reportType, chartData, engineSummary} = req.body||{};
  if(!to||!reportHtml) return res.status(400).json({error:'Missing email or report content'});

  const reportLabel = REPORT_LABELS[reportType]||'Vedic Report';
  const cleanedHtml = cleanForEmail(reportHtml);

  // Build email HTML
  const emailHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
  .wrapper{max-width:680px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,.08)}
  .email-header{background:#1d1d1f;padding:24px 40px;text-align:center;border-bottom:3px solid #bf9a30}
  .brand{font-family:Georgia,serif;font-size:24px;color:#f4dba0;letter-spacing:.08em}
  .brand span{color:#bf9a30}
  .tagline{font-size:10px;color:rgba(244,219,160,.45);margin-top:4px;letter-spacing:.18em;text-transform:uppercase}
  .email-body{background:#ffffff;font-size:15px;line-height:1.7;color:#1d1d1f}
  .email-body .rep-cover{background:#1d1d1f!important;-webkit-print-color-adjust:exact}
  .email-body .rep-cover *,.email-body .rep-cover h1,.email-body .rep-cover em{color:#ffffff!important}
  .email-body .rep-cover em{color:#bf9a30!important}
  .email-footer{background:#f5f5f7;padding:20px 40px;text-align:center;border-top:1px solid #e5e5ea}
  .email-footer p{font-size:11px;color:#6e6e73;line-height:1.8;margin:0}
  .email-footer a{color:#bf9a30;text-decoration:none}
  @media(max-width:600px){.wrapper{border-radius:0}.email-header{padding:20px 20px}.email-footer{padding:16px 20px}}
</style>
</head>
<body>
<div style="padding:20px 0;background:#f5f5f7">
<div class="wrapper">
  <div class="email-header">
    <div class="brand">Natal<span>AI</span>.live</div>
    <div class="tagline">${reportLabel}</div>
  </div>
  <div class="email-body">
    ${cleanedHtml}
  </div>
  <div class="email-footer">
    <p>
      Generated for <strong>${name||'you'}</strong> &middot; <a href="https://natalai.live">NatalAI.live</a><br>
      AI-powered Vedic astrology · For personal insight and entertainment only<br>
      Not a substitute for professional advice · <a href="mailto:support@natalai.live">support@natalai.live</a><br>
      <a href="https://natalai.live/privacy-policy" style="color:#8e8e93">Privacy Policy</a>
    </p>
  </div>
</div>
</div>
</body>
</html>`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method:'POST',
      headers:{'Authorization':`Bearer ${resendKey}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        from:'NatalAI <support@natalai.live>',
        to:[to],
        subject: subject||`Your ${reportLabel} — NatalAI.live`,
        html:emailHtml,
      })
    });
    const d = await r.json();
    if(!r.ok) return res.status(500).json({error:'Resend error', details:d});

    // Log email delivery to Google Sheets
    logToSheets({
      event: 'report_emailed',
      name: name||'',
      reportType: reportType||'unknown',
      email: to,
      lagna: chartData?.lagna||'',
      rashi: chartData?.rashi||'',
      top_yoga: engineSummary?.top_yoga||'',
      dasha: engineSummary?.current_dasha||'',
    });

    return res.status(200).json({success:true, id:d.id});
  } catch(e) {
    return res.status(500).json({error:e.message});
  }
};
