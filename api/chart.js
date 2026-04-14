// api/chart.js
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' });

  const body = req.body || {};

  // ── MODE 1: Full report (natal, compat, timing) ──
  if (body._direct && body._prompt) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 4000, messages: [{ role: 'user', content: body._prompt }] }),
      });
      const d = await r.json();
      if (!r.ok) return res.status(500).json({ error: 'Claude API error', details: d });
      const raw = d.content?.[0]?.text || '';
      const cleaned = raw.replace(/```json\s*/g,'').replace(/```\s*/g,'').trim();
      try { return res.status(200).json(JSON.parse(cleaned)); }
      catch(e) { return res.status(500).json({ error: 'JSON parse failed', raw: cleaned.slice(0,400) }); }
    } catch(err) { return res.status(500).json({ error: err.message }); }
  }

  // ── MODE 2: Free chart ──
  const { name, dob, tob, pob, gender } = body;
  if (!name || !dob) return res.status(400).json({ error: 'Name and DOB required' });

  const prompt = `You are a Vedic astrologer. Calculate a precise Vedic natal chart.
Name: ${name}, DOB: ${dob}, Time: ${tob || '06:00'}, Place: ${pob || 'India'}, Gender: ${gender || 'unspecified'}
Use Lahiri Ayanamsa, Whole Sign houses, Vimshottari Dasha.
Return English zodiac sign names (Aries not Mesha). English planet period names (Venus not Shukra, Sun not Surya, Moon not Chandra, Mars not Mangala, Jupiter not Guru, Saturn not Shani, Mercury not Budha). Keep Rahu and Ketu.
Return ONLY raw JSON, no markdown:
{"lagna":"sign","rashi":"sign","nakshatra":"name","nakshatra_pada":2,"planets":[{"name":"Sun","rashi":"sign","house":5,"degrees":"14°22'","retrograde":false,"status":""},{"name":"Moon","rashi":"sign","house":9,"degrees":"8°12'","retrograde":false,"status":"Exalted"},{"name":"Mars","rashi":"sign","house":10,"degrees":"22°05'","retrograde":false,"status":""},{"name":"Mercury","rashi":"sign","house":8,"degrees":"3°44'","retrograde":false,"status":""},{"name":"Jupiter","rashi":"sign","house":4,"degrees":"19°31'","retrograde":false,"status":""},{"name":"Venus","rashi":"sign","house":10,"degrees":"27°18'","retrograde":false,"status":""},{"name":"Saturn","rashi":"sign","house":11,"degrees":"11°52'","retrograde":false,"status":"Own sign"},{"name":"Rahu","rashi":"sign","house":3,"degrees":"14°33'","retrograde":true,"status":""},{"name":"Ketu","rashi":"sign","house":9,"degrees":"14°33'","retrograde":true,"status":""}],"dasha_balance":{"planet":"Jupiter","years_remaining":8.5},"dashas":[{"planet":"Ketu","start_year":1990,"end_year":1997,"years":7,"antardashas":[{"planet":"Ketu","start":"1990-01","end":"1990-06"},{"planet":"Venus","start":"1990-06","end":"1991-08"},{"planet":"Sun","start":"1991-08","end":"1992-02"},{"planet":"Moon","start":"1992-02","end":"1992-10"},{"planet":"Mars","start":"1992-10","end":"1993-04"},{"planet":"Rahu","start":"1993-04","end":"1994-05"},{"planet":"Jupiter","start":"1994-05","end":"1995-04"},{"planet":"Saturn","start":"1995-04","end":"1996-05"},{"planet":"Mercury","start":"1996-05","end":"1997-01"}]},{"planet":"Venus","start_year":1997,"end_year":2017,"years":20,"antardashas":[{"planet":"Venus","start":"1997-01","end":"2000-01"},{"planet":"Sun","start":"2000-01","end":"2001-01"},{"planet":"Moon","start":"2001-01","end":"2002-09"},{"planet":"Mars","start":"2002-09","end":"2003-09"},{"planet":"Rahu","start":"2003-09","end":"2005-09"},{"planet":"Jupiter","start":"2005-09","end":"2007-09"},{"planet":"Saturn","start":"2007-09","end":"2010-09"},{"planet":"Mercury","start":"2010-09","end":"2013-03"},{"planet":"Ketu","start":"2013-03","end":"2014-03"}]},{"planet":"Sun","start_year":2017,"end_year":2023,"years":6,"antardashas":[{"planet":"Sun","start":"2017-01","end":"2017-05"},{"planet":"Moon","start":"2017-05","end":"2018-03"},{"planet":"Mars","start":"2018-03","end":"2018-09"},{"planet":"Rahu","start":"2018-09","end":"2019-09"},{"planet":"Jupiter","start":"2019-09","end":"2020-07"},{"planet":"Saturn","start":"2020-07","end":"2021-09"},{"planet":"Mercury","start":"2021-09","end":"2022-08"},{"planet":"Ketu","start":"2022-08","end":"2023-01"},{"planet":"Venus","start":"2023-01","end":"2023-09"}]},{"planet":"Moon","start_year":2023,"end_year":2033,"years":10,"antardashas":[{"planet":"Moon","start":"2023-09","end":"2024-07"},{"planet":"Mars","start":"2024-07","end":"2025-02"},{"planet":"Rahu","start":"2025-02","end":"2026-08"},{"planet":"Jupiter","start":"2026-08","end":"2027-12"},{"planet":"Saturn","start":"2027-12","end":"2029-06"},{"planet":"Mercury","start":"2029-06","end":"2030-11"},{"planet":"Ketu","start":"2030-11","end":"2031-06"},{"planet":"Venus","start":"2031-06","end":"2033-02"},{"planet":"Sun","start":"2033-02","end":"2033-09"}]},{"planet":"Mars","start_year":2033,"end_year":2040,"years":7,"antardashas":[{"planet":"Mars","start":"2033-09","end":"2034-03"},{"planet":"Rahu","start":"2034-03","end":"2035-03"},{"planet":"Jupiter","start":"2035-03","end":"2036-02"},{"planet":"Saturn","start":"2036-02","end":"2037-03"},{"planet":"Mercury","start":"2037-03","end":"2038-03"},{"planet":"Ketu","start":"2038-03","end":"2038-09"},{"planet":"Venus","start":"2038-09","end":"2039-09"},{"planet":"Sun","start":"2039-09","end":"2040-03"},{"planet":"Moon","start":"2040-03","end":"2040-09"}]}],"yogas":[{"name":"yoga name","description":"2 sentence meaning","strength":"Strong","icon":"🏆"}],"navamsa":[{"planet":"Sun","rashi":"Leo"},{"planet":"Moon","rashi":"Taurus"},{"planet":"Mars","rashi":"Aries"},{"planet":"Mercury","rashi":"Virgo"},{"planet":"Jupiter","rashi":"Sagittarius"},{"planet":"Venus","rashi":"Libra"},{"planet":"Saturn","rashi":"Capricorn"},{"planet":"Rahu","rashi":"Gemini"},{"planet":"Ketu","rashi":"Sagittarius"}],"summary":"2 sentence personalised chart summary."}
Adjust ALL values accurately for the actual birth details. Spread planets realistically.`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 3000, messages: [{ role: 'user', content: prompt }] }),
    });
    const d = await r.json();
    if (!r.ok) return res.status(500).json({ error: 'Claude API error', details: d });
    const raw = d.content?.[0]?.text || '';
    const cleaned = raw.replace(/```json\s*/g,'').replace(/```\s*/g,'').trim();
    try { return res.status(200).json(JSON.parse(cleaned)); }
    catch(e) { return res.status(500).json({ error: 'JSON parse failed', raw: cleaned.slice(0,300) }); }
  } catch(err) { return res.status(500).json({ error: err.message }); }
};
