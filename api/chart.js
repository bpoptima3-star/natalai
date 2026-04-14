// api/chart.js — NatalAI.live
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Missing ANTHROPIC_API_KEY' });

  const body = req.body || {};
  const MODEL = 'claude-haiku-4-5-20251001';

  // ── MODE 1: Reports (natal / compat / timing) ──
  if (body._direct && body._prompt) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 16000,
          messages: [{ role: 'user', content: body._prompt }]
        })
      });
      const d = await r.json();
      if (!r.ok) return res.status(500).json({ error: 'Claude API error', details: d });
      if (d.stop_reason === 'max_tokens') return res.status(500).json({ error: 'Response too long, try again' });
      const raw = (d.content?.[0]?.text || '')
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();
      try {
        return res.status(200).json(JSON.parse(raw));
      } catch (e) {
        return res.status(500).json({ error: 'JSON parse failed', raw: raw.slice(0, 1000) });
      }
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── MODE 2: Free chart ──
  const { name, dob, tob, pob, gender } = body;
  if (!name || !dob) return res.status(400).json({ error: 'Name and DOB required' });

  const prompt = `Vedic astrologer. Calculate natal chart.
Name: ${name}, DOB: ${dob}, Time: ${tob || '06:00'}, Place: ${pob || 'India'}, Gender: ${gender || 'unspecified'}
Lahiri Ayanamsa, Whole Sign houses, Vimshottari Dasha. English names only.
Return ONLY raw JSON, no markdown:
{"lagna":"sign","rashi":"sign","nakshatra":"name","nakshatra_pada":2,"planets":[{"name":"Sun","rashi":"sign","house":5,"degrees":"14°22'","retrograde":false,"status":""},{"name":"Moon","rashi":"sign","house":9,"degrees":"8°12'","retrograde":false,"status":"Exalted"},{"name":"Mars","rashi":"sign","house":10,"degrees":"22°05'","retrograde":false,"status":""},{"name":"Mercury","rashi":"sign","house":8,"degrees":"3°44'","retrograde":false,"status":""},{"name":"Jupiter","rashi":"sign","house":4,"degrees":"19°31'","retrograde":false,"status":""},{"name":"Venus","rashi":"sign","house":10,"degrees":"27°18'","retrograde":false,"status":""},{"name":"Saturn","rashi":"sign","house":11,"degrees":"11°52'","retrograde":false,"status":"Own sign"},{"name":"Rahu","rashi":"sign","house":3,"degrees":"14°33'","retrograde":true,"status":""},{"name":"Ketu","rashi":"sign","house":9,"degrees":"14°33'","retrograde":true,"status":""}],"dasha_balance":{"planet":"Jupiter","years_remaining":8.5},"dashas":[{"planet":"Venus","start_year":2006,"end_year":2026,"years":20,"antardashas":[{"planet":"Venus","start":"2006-01","end":"2009-01"},{"planet":"Sun","start":"2009-01","end":"2010-01"},{"planet":"Moon","start":"2010-01","end":"2011-09"},{"planet":"Mars","start":"2011-09","end":"2012-09"},{"planet":"Rahu","start":"2012-09","end":"2014-09"},{"planet":"Jupiter","start":"2014-09","end":"2016-09"},{"planet":"Saturn","start":"2016-09","end":"2019-09"},{"planet":"Mercury","start":"2019-09","end":"2022-03"},{"planet":"Ketu","start":"2022-03","end":"2023-03"}]},{"planet":"Sun","start_year":2026,"end_year":2032,"years":6,"antardashas":[{"planet":"Sun","start":"2026-01","end":"2026-05"},{"planet":"Moon","start":"2026-05","end":"2027-03"},{"planet":"Mars","start":"2027-03","end":"2027-09"},{"planet":"Rahu","start":"2027-09","end":"2028-09"},{"planet":"Jupiter","start":"2028-09","end":"2029-07"},{"planet":"Saturn","start":"2029-07","end":"2030-09"},{"planet":"Mercury","start":"2030-09","end":"2031-08"},{"planet":"Ketu","start":"2031-08","end":"2032-01"},{"planet":"Venus","start":"2032-01","end":"2032-09"}]},{"planet":"Moon","start_year":2032,"end_year":2042,"years":10,"antardashas":[{"planet":"Moon","start":"2032-09","end":"2033-07"},{"planet":"Mars","start":"2033-07","end":"2034-02"},{"planet":"Rahu","start":"2034-02","end":"2035-08"},{"planet":"Jupiter","start":"2035-08","end":"2036-12"},{"planet":"Saturn","start":"2036-12","end":"2038-06"},{"planet":"Mercury","start":"2038-06","end":"2039-11"},{"planet":"Ketu","start":"2039-11","end":"2040-06"},{"planet":"Venus","start":"2040-06","end":"2042-02"},{"planet":"Sun","start":"2042-02","end":"2042-09"}]}],"yogas":[{"name":"yoga","description":"2 sentence meaning","strength":"Strong","icon":"🏆"}],"navamsa":[{"planet":"Sun","rashi":"Leo"},{"planet":"Moon","rashi":"Taurus"},{"planet":"Mars","rashi":"Aries"},{"planet":"Mercury","rashi":"Virgo"},{"planet":"Jupiter","rashi":"Sagittarius"},{"planet":"Venus","rashi":"Libra"},{"planet":"Saturn","rashi":"Capricorn"},{"planet":"Rahu","rashi":"Gemini"},{"planet":"Ketu","rashi":"Sagittarius"}],"summary":"2 sentence chart summary."}
Calculate ALL values accurately for the actual birth details.`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const d = await r.json();
    if (!r.ok) return res.status(500).json({ error: 'Claude API error', details: d });
    const raw = (d.content?.[0]?.text || '')
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();
    try {
      return res.status(200).json(JSON.parse(raw));
    } catch (e) {
      return res.status(500).json({ error: 'JSON parse failed', raw: raw.slice(0, 300) });
    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
