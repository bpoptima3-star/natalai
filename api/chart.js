// api/chart.js — Vercel Serverless Function
// Proxies Claude API so the key stays server-side (never exposed to browser)

export default async function handler(req, res) {
  // CORS headers — allow your domain
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, dob, tob, pob, gender } = req.body;

  if (!name || !dob) {
    return res.status(400).json({ error: 'Name and date of birth are required' });
  }

  const prompt = `You are an expert Vedic astrologer. Calculate a complete Vedic natal birth chart for:

Name: ${name}
Date of Birth: ${dob}
Time of Birth: ${tob || 'Unknown — use 06:00 as default'}
Place of Birth: ${pob || 'India'}
Gender: ${gender || 'Not specified'}

Use:
- Swiss Ephemeris calculations (simulate accurately)
- Lahiri Ayanamsa (~23°51' for current era, adjust for birth year)
- Whole Sign house system
- Vimshottari Dasha system

Return ONLY valid JSON — no markdown, no backticks, no explanation. Exactly this structure:
{
  "lagna": "Sanskrit Rashi name (e.g. Vrishchika)",
  "rashi": "Sanskrit Moon sign name",
  "nakshatra": "Birth Nakshatra name",
  "nakshatra_pada": 2,
  "planets": [
    {"name":"Sun","rashi":"Sanskrit name","house":5,"degrees":"14°22'","retrograde":false,"status":""},
    {"name":"Moon","rashi":"Sanskrit name","house":1,"degrees":"8°12'","retrograde":false,"status":"Exalted"},
    {"name":"Mars","rashi":"Sanskrit name","house":9,"degrees":"22°05'","retrograde":false,"status":""},
    {"name":"Mercury","rashi":"Sanskrit name","house":6,"degrees":"3°44'","retrograde":true,"status":""},
    {"name":"Jupiter","rashi":"Sanskrit name","house":4,"degrees":"19°31'","retrograde":false,"status":"Exalted"},
    {"name":"Venus","rashi":"Sanskrit name","house":7,"degrees":"27°18'","retrograde":false,"status":"Own sign"},
    {"name":"Saturn","rashi":"Sanskrit name","house":11,"degrees":"11°52'","retrograde":true,"status":""},
    {"name":"Rahu","rashi":"Sanskrit name","house":3,"degrees":"14°33'","retrograde":true,"status":""},
    {"name":"Ketu","rashi":"Sanskrit name","house":9,"degrees":"14°33'","retrograde":true,"status":""}
  ],
  "dasha_balance": {"planet":"Guru","years_remaining":8.5},
  "dashas": [
    {"planet":"Ketu","start_year":1985,"end_year":1992,"years":7,"antardashas":[
      {"planet":"Ketu","start":"1985-06","end":"1986-02"},
      {"planet":"Shukra","start":"1986-02","end":"1987-04"},
      {"planet":"Surya","start":"1987-04","end":"1987-10"},
      {"planet":"Chandra","start":"1987-10","end":"1988-06"},
      {"planet":"Mangala","start":"1988-06","end":"1988-12"},
      {"planet":"Rahu","start":"1988-12","end":"1990-01"},
      {"planet":"Guru","start":"1990-01","end":"1991-01"},
      {"planet":"Shani","start":"1991-01","end":"1992-02"},
      {"planet":"Budha","start":"1992-02","end":"1992-09"}
    ]},
    {"planet":"Shukra","start_year":1992,"end_year":2012,"years":20,"antardashas":[
      {"planet":"Shukra","start":"1992-09","end":"1995-09"},
      {"planet":"Surya","start":"1995-09","end":"1996-09"},
      {"planet":"Chandra","start":"1996-09","end":"1998-03"},
      {"planet":"Mangala","start":"1998-03","end":"1999-03"},
      {"planet":"Rahu","start":"1999-03","end":"2001-03"},
      {"planet":"Guru","start":"2001-03","end":"2003-03"},
      {"planet":"Shani","start":"2003-03","end":"2006-03"},
      {"planet":"Budha","start":"2006-03","end":"2008-09"},
      {"planet":"Ketu","start":"2008-09","end":"2009-09"}
    ]},
    {"planet":"Surya","start_year":2012,"end_year":2018,"years":6,"antardashas":[
      {"planet":"Surya","start":"2012-09","end":"2012-03"},
      {"planet":"Chandra","start":"2012-03","end":"2013-03"},
      {"planet":"Mangala","start":"2013-03","end":"2013-09"},
      {"planet":"Rahu","start":"2013-09","end":"2014-09"},
      {"planet":"Guru","start":"2014-09","end":"2015-09"},
      {"planet":"Shani","start":"2015-09","end":"2016-09"},
      {"planet":"Budha","start":"2016-09","end":"2017-09"},
      {"planet":"Ketu","start":"2017-09","end":"2018-03"},
      {"planet":"Shukra","start":"2018-03","end":"2018-09"}
    ]},
    {"planet":"Chandra","start_year":2018,"end_year":2028,"years":10,"antardashas":[
      {"planet":"Chandra","start":"2018-09","end":"2019-07"},
      {"planet":"Mangala","start":"2019-07","end":"2020-02"},
      {"planet":"Rahu","start":"2020-02","end":"2021-08"},
      {"planet":"Guru","start":"2021-08","end":"2022-12"},
      {"planet":"Shani","start":"2022-12","end":"2024-06"},
      {"planet":"Budha","start":"2024-06","end":"2025-11"},
      {"planet":"Ketu","start":"2025-11","end":"2026-06"},
      {"planet":"Shukra","start":"2026-06","end":"2028-02"},
      {"planet":"Surya","start":"2028-02","end":"2028-09"}
    ]},
    {"planet":"Mangala","start_year":2028,"end_year":2035,"years":7,"antardashas":[
      {"planet":"Mangala","start":"2028-09","end":"2029-03"},
      {"planet":"Rahu","start":"2029-03","end":"2030-03"},
      {"planet":"Guru","start":"2030-03","end":"2031-02"},
      {"planet":"Shani","start":"2031-02","end":"2032-03"},
      {"planet":"Budha","start":"2032-03","end":"2033-03"},
      {"planet":"Ketu","start":"2033-03","end":"2033-09"},
      {"planet":"Shukra","start":"2033-09","end":"2034-09"},
      {"planet":"Surya","start":"2034-09","end":"2035-03"},
      {"planet":"Chandra","start":"2035-03","end":"2035-09"}
    ]}
  ],
  "yogas": [
    {"name":"Gaja Kesari Yoga","description":"Jupiter and Moon in angular houses (kendras) from each other — creates wisdom, recognition, prosperity and a respected position in society.","strength":"Strong","icon":"🐘"},
    {"name":"Budha-Aditya Yoga","description":"Sun and Mercury in the same house — creates sharp intellect, excellent communication skills and favour from authority.","strength":"Moderate","icon":"☿"}
  ],
  "navamsa": [
    {"planet":"Sun","rashi":"Sanskrit name"},
    {"planet":"Moon","rashi":"Sanskrit name"},
    {"planet":"Mars","rashi":"Sanskrit name"},
    {"planet":"Mercury","rashi":"Sanskrit name"},
    {"planet":"Jupiter","rashi":"Sanskrit name"},
    {"planet":"Venus","rashi":"Sanskrit name"},
    {"planet":"Saturn","rashi":"Sanskrit name"},
    {"planet":"Rahu","rashi":"Sanskrit name"},
    {"planet":"Ketu","rashi":"Sanskrit name"}
  ],
  "summary": "2-3 sentence overview of this person's chart strengths and life themes."
}

Distribute planets realistically across different houses and signs based on the actual birth date and time. Be astrologically precise.`;

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured. Add ANTHROPIC_API_KEY to Vercel environment variables.' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',  // Haiku — fast + cheap for this task
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic API error:', err);
      return res.status(500).json({ error: 'AI calculation failed', details: err });
    }

    const data = await response.json();
    const raw = data.content?.[0]?.text || '';

    // Strip any accidental markdown fences
    const cleaned = raw.replace(/```json|```/g, '').trim();

    let chart;
    try {
      chart = JSON.parse(cleaned);
    } catch (e) {
      console.error('JSON parse error:', cleaned.slice(0, 200));
      return res.status(500).json({ error: 'Failed to parse chart data', raw: cleaned.slice(0, 300) });
    }

    return res.status(200).json(chart);

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
}
