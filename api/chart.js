// api/chart.js
module.exports = async function handler(req, res) {

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { name, dob, tob, pob, gender } = req.body || {};
  if (!name || !dob) return res.status(400).json({ error: 'Name and DOB required' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY not set in Vercel Environment Variables',
      fix: 'Go to Vercel → Project → Settings → Environment Variables → add ANTHROPIC_API_KEY'
    });
  }

  const prompt = `You are a Vedic astrologer. Calculate a Vedic natal chart for:
Name: ${name}
DOB: ${dob}
Time: ${tob || '06:00'}
Place: ${pob || 'India'}
Gender: ${gender || 'unspecified'}

Use Lahiri Ayanamsa, Whole Sign houses, Vimshottari Dasha.
Return English zodiac sign names (Aries, Taurus etc) not Sanskrit (Mesha, Vrishabha etc).
Return English planet period names (Venus, Sun, Moon, Mars, Jupiter, Saturn, Mercury) not Sanskrit (Shukra, Surya, Chandra, Mangala, Guru, Shani, Budha).
Keep Rahu and Ketu as-is.

Return ONLY raw JSON (no markdown, no backticks):
{
  "lagna": "Sanskrit rashi name",
  "rashi": "Sanskrit moon sign",
  "nakshatra": "nakshatra name",
  "nakshatra_pada": 2,
  "planets": [
    {"name":"Sun","rashi":"Aries","house":1,"degrees":"14°22'","retrograde":false,"status":""},
    {"name":"Moon","rashi":"Cancer","house":4,"degrees":"8°12'","retrograde":false,"status":"Exalted"},
    {"name":"Mars","rashi":"Capricorn","house":10,"degrees":"22°05'","retrograde":false,"status":"Exalted"},
    {"name":"Mercury","rashi":"Taurus","house":2,"degrees":"3°44'","retrograde":false,"status":""},
    {"name":"Jupiter","rashi":"Cancer","house":4,"degrees":"19°31'","retrograde":false,"status":"Exalted"},
    {"name":"Venus","rashi":"Gemini","house":3,"degrees":"27°18'","retrograde":false,"status":""},
    {"name":"Saturn","rashi":"Aquarius","house":11,"degrees":"11°52'","retrograde":false,"status":"Own sign"},
    {"name":"Rahu","rashi":"Taurus","house":2,"degrees":"14°33'","retrograde":true,"status":""},
    {"name":"Ketu","rashi":"Scorpio","house":8,"degrees":"14°33'","retrograde":true,"status":""}
  ],
  "dasha_balance": {"planet":"Jupiter","years_remaining":8.5},
  "dashas": [
    {"planet":"Ketu","start_year":1990,"end_year":1997,"years":7,"antardashas":[{"planet":"Ketu","start":"1990-01","end":"1990-06"},{"planet":"Venus","start":"1990-06","end":"1991-08"},{"planet":"Sun","start":"1991-08","end":"1992-02"},{"planet":"Moon","start":"1992-02","end":"1992-10"},{"planet":"Mars","start":"1992-10","end":"1993-04"},{"planet":"Rahu","start":"1993-04","end":"1994-05"},{"planet":"Jupiter","start":"1994-05","end":"1995-04"},{"planet":"Saturn","start":"1995-04","end":"1996-05"},{"planet":"Mercury","start":"1996-05","end":"1997-01"}]},
    {"planet":"Venus","start_year":1997,"end_year":2017,"years":20,"antardashas":[{"planet":"Venus","start":"1997-01","end":"2000-01"},{"planet":"Sun","start":"2000-01","end":"2001-01"},{"planet":"Moon","start":"2001-01","end":"2002-09"},{"planet":"Mars","start":"2002-09","end":"2003-09"},{"planet":"Rahu","start":"2003-09","end":"2005-09"},{"planet":"Jupiter","start":"2005-09","end":"2007-09"},{"planet":"Saturn","start":"2007-09","end":"2010-09"},{"planet":"Mercury","start":"2010-09","end":"2013-03"},{"planet":"Ketu","start":"2013-03","end":"2014-03"}]},
    {"planet":"Sun","start_year":2017,"end_year":2023,"years":6,"antardashas":[{"planet":"Sun","start":"2017-01","end":"2017-05"},{"planet":"Moon","start":"2017-05","end":"2018-03"},{"planet":"Mars","start":"2018-03","end":"2018-09"},{"planet":"Rahu","start":"2018-09","end":"2019-09"},{"planet":"Jupiter","start":"2019-09","end":"2020-07"},{"planet":"Saturn","start":"2020-07","end":"2021-09"},{"planet":"Mercury","start":"2021-09","end":"2022-08"},{"planet":"Ketu","start":"2022-08","end":"2023-01"},{"planet":"Venus","start":"2023-01","end":"2023-09"}]},
    {"planet":"Moon","start_year":2023,"end_year":2033,"years":10,"antardashas":[{"planet":"Moon","start":"2023-09","end":"2024-07"},{"planet":"Mars","start":"2024-07","end":"2025-02"},{"planet":"Rahu","start":"2025-02","end":"2026-08"},{"planet":"Jupiter","start":"2026-08","end":"2027-12"},{"planet":"Saturn","start":"2027-12","end":"2029-06"},{"planet":"Mercury","start":"2029-06","end":"2030-11"},{"planet":"Ketu","start":"2030-11","end":"2031-06"},{"planet":"Venus","start":"2031-06","end":"2033-02"},{"planet":"Sun","start":"2033-02","end":"2033-09"}]},
    {"planet":"Mars","start_year":2033,"end_year":2040,"years":7,"antardashas":[{"planet":"Mars","start":"2033-09","end":"2034-03"},{"planet":"Rahu","start":"2034-03","end":"2035-03"},{"planet":"Jupiter","start":"2035-03","end":"2036-02"},{"planet":"Saturn","start":"2036-02","end":"2037-03"},{"planet":"Mercury","start":"2037-03","end":"2038-03"},{"planet":"Ketu","start":"2038-03","end":"2038-09"},{"planet":"Venus","start":"2038-09","end":"2039-09"},{"planet":"Sun","start":"2039-09","end":"2040-03"},{"planet":"Moon","start":"2040-03","end":"2040-09"}]},
    {"planet":"Rahu","start_year":2040,"end_year":2058,"years":18,"antardashas":[{"planet":"Rahu","start":"2040-09","end":"2043-03"},{"planet":"Jupiter","start":"2043-03","end":"2045-09"},{"planet":"Saturn","start":"2045-09","end":"2048-09"},{"planet":"Mercury","start":"2048-09","end":"2051-03"},{"planet":"Ketu","start":"2051-03","end":"2052-03"},{"planet":"Venus","start":"2052-03","end":"2055-03"},{"planet":"Sun","start":"2055-03","end":"2056-01"},{"planet":"Moon","start":"2056-01","end":"2057-07"},{"planet":"Mars","start":"2057-07","end":"2058-09"}]},
    {"planet":"Jupiter","start_year":2058,"end_year":2074,"years":16,"antardashas":[{"planet":"Jupiter","start":"2058-09","end":"2060-09"},{"planet":"Saturn","start":"2060-09","end":"2063-03"},{"planet":"Mercury","start":"2063-03","end":"2065-07"},{"planet":"Ketu","start":"2065-07","end":"2066-06"},{"planet":"Venus","start":"2066-06","end":"2068-10"},{"planet":"Sun","start":"2068-10","end":"2069-08"},{"planet":"Moon","start":"2069-08","end":"2071-06"},{"planet":"Mars","start":"2071-06","end":"2072-06"},{"planet":"Rahu","start":"2072-06","end":"2074-09"}]},
    {"planet":"Saturn","start_year":2074,"end_year":2093,"years":19,"antardashas":[{"planet":"Saturn","start":"2074-09","end":"2077-11"},{"planet":"Mercury","start":"2077-11","end":"2080-09"},{"planet":"Ketu","start":"2080-09","end":"2081-09"},{"planet":"Venus","start":"2081-09","end":"2084-11"},{"planet":"Sun","start":"2084-11","end":"2085-11"},{"planet":"Moon","start":"2085-11","end":"2087-06"},{"planet":"Mars","start":"2087-06","end":"2088-07"},{"planet":"Rahu","start":"2088-07","end":"2091-07"},{"planet":"Jupiter","start":"2091-07","end":"2093-09"}]},
    {"planet":"Mercury","start_year":2093,"end_year":2110,"years":17,"antardashas":[{"planet":"Mercury","start":"2093-09","end":"2096-03"},{"planet":"Ketu","start":"2096-03","end":"2097-03"},{"planet":"Venus","start":"2097-03","end":"2099-09"},{"planet":"Sun","start":"2099-09","end":"2100-08"},{"planet":"Moon","start":"2100-08","end":"2102-01"},{"planet":"Mars","start":"2102-01","end":"2103-01"},{"planet":"Rahu","start":"2103-01","end":"2105-07"},{"planet":"Jupiter","start":"2105-07","end":"2107-09"},{"planet":"Saturn","start":"2107-09","end":"2110-01"}]}
  ],
  "yogas": [
    {"name":"Gaja Kesari Yoga","description":"Jupiter in an angular house from the Moon — bestows wisdom, prosperity and widespread recognition throughout life.","strength":"Strong","icon":"🐘"},
    {"name":"Dharma Karma Yoga","description":"Lords of 9th and 10th houses in conjunction or mutual aspect — powerful career advancement through righteous action.","strength":"Moderate","icon":"⚡"}
  ],
  "navamsa": [
    {"planet":"Sun","rashi":"Leo"},
    {"planet":"Moon","rashi":"Taurus"},
    {"planet":"Mars","rashi":"Aries"},
    {"planet":"Mercury","rashi":"Virgo"},
    {"planet":"Jupiter","rashi":"Sagittarius"},
    {"planet":"Venus","rashi":"Libra"},
    {"planet":"Saturn","rashi":"Capricorn"},
    {"planet":"Rahu","rashi":"Gemini"},
    {"planet":"Ketu","rashi":"Sagittarius"}
  ],
  "summary": "A powerful chart with strong Jupiter influence creating natural wisdom and prosperity. The current planetary period favours growth in career and meaningful relationships."
}

Adjust all values to be accurate for the actual birth details provided. Spread planets realistically.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Claude API error:', data);
      return res.status(500).json({ error: 'Claude API error', details: data });
    }

    const raw = data.content?.[0]?.text || '';
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    let chart;
    try {
      chart = JSON.parse(cleaned);
    } catch (e) {
      console.error('JSON parse failed:', cleaned.slice(0, 300));
      return res.status(500).json({ error: 'JSON parse failed', raw: cleaned.slice(0, 300) });
    }

    return res.status(200).json(chart);

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: err.message });
  }
};
