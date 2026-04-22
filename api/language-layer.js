// api/language-layer.js — US English Translation Layer for NatalAI.live
// ALL Jyotish terminology → plain American English
// This is the output filter: engine speaks Jyotish, reports speak American
'use strict';

// ─── CORE TERM TRANSLATIONS ───────────────────────────────────────────────────
const TERM_MAP = {
  // Dasha periods
  'Mahadasha':       'Major Life Period',
  'mahadasha':       'major life period',
  'Antardasha':      'Active Phase',
  'antardasha':      'active phase',
  'Pratyantardasha': 'Short Window',
  'pratyantardasha': 'short window',
  'Bhukti':          'Active Phase',
  'bhukti':          'active phase',
  'Dasha':           'Planetary Period',
  'dasha':           'planetary period',
  'Mudda':           'Annual Phase',
  'mudda':           'annual phase',

  // Chart points
  'Lagna':           'Rising Sign',
  'lagna':           'rising sign',
  'Rashi':           'Moon Sign',
  'rashi':           'moon sign',
  'Nakshatra':       'Birth Star',
  'nakshatra':       'birth star',
  'Janma Nakshatra': 'Birth Star',
  'Navamsa':         'Soul Chart',
  'navamsa':         'soul chart',
  'D9':              'Soul Chart',
  'D1':              'Birth Chart',
  'Varshpal':        'Annual Forecast Chart',
  'varshpal':        'annual forecast chart',
  'Varshaphal':      'Annual Forecast Chart',
  'Solar Return':    'Annual Forecast Chart',

  // Yogas — translated to effect language
  'Yoga':            'Planetary Pattern',
  'yoga':            'planetary pattern',
  'Raj Yoga':        'Success Pattern',
  'Raja Yoga':       'Success & Authority Pattern',
  'Dhana Yoga':      'Wealth Pattern',
  'Gaja Kesari Yoga':'Jupiter-Moon Power Pattern',
  'Gaja Kesari':     'Jupiter-Moon Power Pattern',
  'Hamsa Yoga':      'Wisdom & Success Pattern (Jupiter)',
  'Ruchaka Yoga':    'Drive & Authority Pattern (Mars)',
  'Bhadra Yoga':     'Intelligence & Business Pattern (Mercury)',
  'Malavya Yoga':    'Beauty & Relationship Pattern (Venus)',
  'Shasha Yoga':     'Discipline & Authority Pattern (Saturn)',
  'Budhaditya Yoga': 'Sharp Mind Pattern',
  'Saraswati Yoga':  'Creative Intelligence Pattern',
  'Lakshmi Yoga':    'Prosperity Pattern',
  'Viparita Raja Yoga': 'Comeback Pattern',
  'Chandra Yoga':    'Emotional Success Pattern',
  'Sunapha Yoga':    'Self-Made Wealth Pattern',
  'Anapha Yoga':     'Fame & Reputation Pattern',
  'Durudhura Yoga':  'Generosity & Wealth Pattern',
  'Chandra Mangal Yoga': 'Ambition & Wealth Pattern',
  'Amala Yoga':      'Pure Reputation Pattern',
  'Yoga Karaka':     'Power Planet',
  'Neecha Bhanga Raja Yoga': 'Weakness-to-Strength Transformation',
  'Neecha Bhanga':   'Weakness Transformed to Strength',
  'Graha Malika Yoga': 'Multi-Talented Life Pattern',
  'Parivartana Raja Yoga': 'Exchange Power Pattern',
  'Vargottama':      'Doubly Strong',

  // Doshas — translated to challenge language
  'Dosha':           'Stress Pattern',
  'dosha':           'stress pattern',
  'Mangal Dosha':    'Mars Relationship Stress',
  'Kaal Sarp Yoga':  'Karmic Blockage Pattern',
  'Shrapit Yoga':    'Karmic Obstacle Pattern',
  'Guru Chandal Yoga': 'Wisdom-Confusion Pattern',
  'Grahan Yoga':     'Eclipse Pattern',
  'Surya Grahan Yoga': 'Solar Eclipse Pattern',
  'Chandra Grahan Yoga': 'Lunar Eclipse Pattern',
  'Chandra Ketu Yoga': 'Moon-Ketu Detachment Pattern',
  'Kemdrum Yoga':    'Isolated Moon Pattern',
  'Papakartari Yoga': 'Hemmed-In Pattern',
  'Putra Dosha':     'Children Challenges Pattern',
  'Pitta':           'fire energy',
  'Vata':            'air energy',
  'Kapha':           'earth energy',

  // House terms
  'Kendra':          'power position',
  'kendra':          'power position',
  'Trikona':         'fortune position',
  'trikona':         'fortune position',
  'Dusthana':        'challenging position',
  'dusthana':        'challenging position',
  'Upachaya':        'growth position',
  'upachaya':        'growth position',
  'Bhava':           'Life Area',
  'bhava':           'life area',

  // Planet roles
  'Karaka':          'natural ruler',
  'karaka':          'natural ruler',
  'Putrakaraka':     'children planet',
  'Darakaraka':      'spouse planet',
  'Atmakaraka':      'soul planet',

  // Chart techniques
  'Ashtakavarga':    'Planetary Strength Score',
  'ashtakavarga':    'planetary strength score',
  'Shadbala':        'Planetary Strength',
  'Muntha':          'Annual Focus Point',
  'muntha':          'annual focus point',
  'Panchadhikari':   'Annual Ruling Planets',
  'Kuta':            'compatibility score',
  'kuta':            'compatibility score',
  'Guna Milan':      'Compatibility Score',
  'Bhakoot':         'Moon Sign Compatibility',
  'Nadi Kuta':       'Health Compatibility',
  'Yoni Kuta':       'Physical Compatibility',
  'Graha Maitri':    'Mental Compatibility',
  'Gana Kuta':       'Temperament Compatibility',
  'Tara Kuta':       'Star Compatibility',
  'Vashya Kuta':     'Attraction Compatibility',
  'Varna Kuta':      'Values Compatibility',

  // Sade Sati — very specific American translation
  'Sade Sati':       "Saturn's 7.5-Year Pressure Cycle",
  'sade sati':       "Saturn's 7.5-year pressure cycle",
  'Dhaiya':          "Saturn's 2.5-Year Pressure",
  'Kantak Shani':    "Saturn's Domestic Pressure",
  'Ashtama Shani':   "Saturn's 8th House Pressure",

  // Specific house lords in plain English
  '1H lord':         'your chart ruler',
  '2H lord':         'your wealth planet',
  '5H lord':         'your creativity/children planet',
  '7H lord':         'your partnership planet',
  '9H lord':         'your fortune planet',
  '10H lord':        'your career planet',

  // Miscellaneous
  'Exalted':         'at peak strength',
  'Debilitated':     'at weakest strength',
  'Mool Trikona':    'in home territory',
  'Own Sign':        'in home sign',
  'Retrograde':      'in backward motion',
  'Combust':         'overshadowed by the Sun',
  'Sandhi':          'at a sign boundary (weakened)',
  'Pushkara':        'in an auspicious subdivision',
  'Vimshottari':     '120-year planetary cycle',
};

// ─── PLANET NAME STANDARDIZATION ─────────────────────────────────────────────
const PLANET_NAMES = {
  Su: 'Sun', Mo: 'Moon', Ma: 'Mars', Me: 'Mercury',
  Ju: 'Jupiter', Ve: 'Venus', Sa: 'Saturn', Ra: 'Rahu', Ke: 'Ketu',
  Rahu: 'North Node (Rahu)', Ketu: 'South Node (Ketu)',
};
// Note: For casual US copy, Rahu/Ketu are kept but explained on first mention

// ─── PERIOD FORMATTING ────────────────────────────────────────────────────────
// Converts Jyotish period names to American English timeline language
function formatPeriod(planet, startYear, endYear, type = 'major') {
  const pn = PLANET_NAMES[planet] || planet;
  if (type === 'major') {
    const duration = Math.round(endYear - startYear);
    return `Your ${pn} Life Chapter (${Math.floor(startYear)}–${Math.floor(endYear)}, ${duration} years)`;
  }
  if (type === 'sub') {
    const months = Math.round((endYear - startYear) * 12);
    return `${pn} Phase (${months} months)`;
  }
  return `${pn} Period`;
}

// ─── HOUSE DESCRIPTIONS — US FRIENDLY ─────────────────────────────────────────
const HOUSE_US = {
  1:  'your personality and physical body',
  2:  'your money, speech, and family',
  3:  'your courage, communication, and short trips',
  4:  'your home, mother, and emotional roots',
  5:  'your creativity, romance, and children',
  6:  'your health, daily work, and obstacles',
  7:  'your relationships, marriage, and business partners',
  8:  'your transformation, inheritance, and hidden matters',
  9:  'your luck, beliefs, father, and long journeys',
  10: 'your career, reputation, and public life',
  11: 'your income, social network, and fulfilled desires',
  12: 'your spirituality, solitude, and foreign connections',
};

// ─── SIGN DESCRIPTIONS — US FRIENDLY ─────────────────────────────────────────
const SIGN_US = {
  Aries:       'Aries (March 21–April 19)',
  Taurus:      'Taurus (April 20–May 20)',
  Gemini:      'Gemini (May 21–June 20)',
  Cancer:      'Cancer (June 21–July 22)',
  Leo:         'Leo (July 23–Aug 22)',
  Virgo:       'Virgo (Aug 23–Sep 22)',
  Libra:       'Libra (Sep 23–Oct 22)',
  Scorpio:     'Scorpio (Oct 23–Nov 21)',
  Sagittarius: 'Sagittarius (Nov 22–Dec 21)',
  Capricorn:   'Capricorn (Dec 22–Jan 19)',
  Aquarius:    'Aquarius (Jan 20–Feb 18)',
  Pisces:      'Pisces (Feb 19–Mar 20)',
};

// ─── NAKSHATRA (BIRTH STAR) US DESCRIPTIONS ───────────────────────────────────
const BIRTH_STAR_US = {
  Ashwini:         { us: 'Ashwini (The Healer)', theme: 'swift healing and new beginnings' },
  Bharani:         { us: 'Bharani (The Bearer)', theme: 'transformation and bearing responsibility' },
  Krittika:        { us: 'Krittika (The Cutter)', theme: 'sharp focus and purification' },
  Rohini:          { us: 'Rohini (The Red One)', theme: 'beauty, growth, and sensuality' },
  Mrigashira:      { us: 'Mrigashira (The Seeker)', theme: 'curiosity and searching' },
  Ardra:           { us: 'Ardra (The Storm)', theme: 'transformation through turbulence' },
  Punarvasu:       { us: 'Punarvasu (The Return)', theme: 'renewal and homecoming' },
  Pushya:          { us: 'Pushya (The Nourisher)', theme: 'nurturing and steady growth' },
  Ashlesha:        { us: 'Ashlesha (The Embracer)', theme: 'deep perception and intensity' },
  Magha:           { us: 'Magha (The Throne)', theme: 'power, lineage, and authority' },
  'Purva Phalguni':{ us: 'Purva Phalguni (The Fig Tree)', theme: 'pleasure, creativity, and rest' },
  'Uttara Phalguni':{ us: 'Uttara Phalguni (The Latter Fig)', theme: 'generosity and social bonds' },
  Hasta:           { us: 'Hasta (The Hand)', theme: 'skill, dexterity, and manifestation' },
  Chitra:          { us: 'Chitra (The Jewel)', theme: 'artistry and brilliant appearance' },
  Swati:           { us: 'Swati (The Independent)', theme: 'independence and flexibility' },
  Vishakha:        { us: 'Vishakha (The Forked Branch)', theme: 'goal-focused ambition' },
  Anuradha:        { us: 'Anuradha (The Star of Success)', theme: 'devotion and deep friendship' },
  Jyeshtha:        { us: 'Jyeshtha (The Elder)', theme: 'seniority and protective courage' },
  Mula:            { us: 'Mula (The Root)', theme: 'digging deep to find truth' },
  'Purva Ashadha': { us: 'Purva Ashadha (The Undefeated)', theme: 'invincibility and revitalization' },
  'Uttara Ashadha':{ us: 'Uttara Ashadha (The Latter Victory)', theme: 'lasting achievement' },
  Shravana:        { us: 'Shravana (The Listener)', theme: 'learning and connection' },
  Dhanishtha:      { us: 'Dhanishtha (The Drummer)', theme: 'abundance and musical rhythm' },
  Shatabhisha:     { us: 'Shatabhisha (The Healer of 100)', theme: 'healing and mystery' },
  'Purva Bhadrapada':{ us: 'Purva Bhadrapada (The Burning Pair)', theme: 'fiery transformation' },
  'Uttara Bhadrapada':{ us: 'Uttara Bhadrapada (The Latter Blessed Feet)', theme: 'deep wisdom and luck' },
  Revati:          { us: 'Revati (The Wealthy)', theme: 'abundance and gentle completion' },
};

// ─── MAIN TRANSLATION FUNCTION ────────────────────────────────────────────────
function translateToUS(text) {
  if (!text) return text;
  let result = text;
  // Replace all known terms (longest first to avoid partial replacements)
  const sorted = Object.keys(TERM_MAP).sort((a, b) => b.length - a.length);
  for (const term of sorted) {
    result = result.split(term).join(TERM_MAP[term]);
  }
  return result;
}

// ─── TRANSLATE ENGINE RESULT ──────────────────────────────────────────────────
// Takes raw engine output and translates ALL strings to US English
function translateEngineResult(engineResult) {
  const translated = JSON.parse(JSON.stringify(engineResult)); // deep clone
  function walkAndTranslate(obj) {
    if (typeof obj === 'string') return translateToUS(obj);
    if (Array.isArray(obj)) return obj.map(walkAndTranslate);
    if (obj && typeof obj === 'object') {
      const result = {};
      for (const [k, v] of Object.entries(obj)) {
        result[k] = walkAndTranslate(v);
      }
      return result;
    }
    return obj;
  }
  return walkAndTranslate(translated);
}

// ─── CLAUDE PROMPT TEMPLATE — US ENGLISH ONLY ─────────────────────────────────
// This is the system prompt injected before every report
const US_SYSTEM_PROMPT = `
You are a sharp, insightful astrologer writing for American audiences in plain English.

LANGUAGE RULES — NON-NEGOTIABLE:
1. NEVER use Sanskrit terms: no "Dasha," "Mahadasha," "Antardasha," "Lagna," "Rashi," "Nakshatra," "Yoga," "Dosha," "Kuta," "Graha," "Bhava," "Sade Sati," "Navamsa," "Varshpal," "Muntha," "Ashtakavarga," "Kendra," "Trikona," "Dusthana," "Karaka," "Vimshottari," or any other Jyotish term
2. Use ONLY these approved translations:
   - "Major Life Period" or "[Planet] Life Chapter" instead of Mahadasha
   - "Active Phase" or "Current Phase" instead of Antardasha
   - "Rising Sign" instead of Lagna
   - "Moon Sign" instead of Rashi  
   - "Birth Star" instead of Nakshatra
   - "Planetary Pattern" instead of Yoga
   - "Stress Pattern" or "Challenge" instead of Dosha
   - "Saturn's 7.5-Year Pressure Cycle" instead of Sade Sati
   - "Soul Chart" instead of Navamsa
   - "house [number]" for house positions (not "4th house" as a mystical term — explain what it means)
   - Planet names are fine: Saturn, Jupiter, Mars, Venus, Mercury, Sun, Moon
   - Rahu = "the North Node (Rahu)" on first mention, then just "Rahu"
   - Ketu = "the South Node (Ketu)" on first mention, then just "Ketu"

3. ALWAYS explain what a pattern means in LIFE TERMS:
   - NOT: "Jupiter in Gaja Kesari Yoga"
   - YES: "Jupiter forming a power pattern with your Moon — this brings wisdom, social recognition, and financial growth throughout your life"

4. TIME PERIODS must be expressed as YEAR RANGES:
   - NOT: "During Saturn Mahadasha"
   - YES: "During your Saturn Life Chapter (2019–2038)"

5. PREDICTIONS must be SPECIFIC and PERSONAL:
   - NOT: "Saturn may bring challenges"
   - YES: "Saturn in your relationship zone (2024–2027) puts pressure on your closest partnerships — expect power dynamics to surface and long-standing issues to demand resolution"

6. ALWAYS tie predictions to:
   - Specific years (not vague "soon" or "in the future")
   - Specific life areas (career, money, love, health, family)
   - The person's actual planetary placements (reference them by name)

7. TONE: Warm, direct, intelligent. Like a brilliant friend who happens to know astrology deeply. Not mystical, not vague, not generic. Sharp and personal.

8. CULTURAL CONTEXT for US readers:
   - Reference American life milestones: career growth, home ownership, relationships, mental health, therapy, dating apps, college, retirement, etc.
   - Use dollar amounts where relevant ($50k-$100k range language)
   - Reference concepts they know: "like a mercury retrograde but lasting years" is okay
   - Avoid: anything that sounds like a horoscope column or fortune cookie
`;

// ─── REPORT SECTION LABELS — US ENGLISH ──────────────────────────────────────
const SECTION_LABELS = {
  // Birth Chart + Year Reading sections
  personality:     '🌟 Who You Are — Your Core Nature',
  planets:         '🪐 Your Planetary Blueprint',
  patterns:        '⚡ Key Patterns in Your Chart',
  challenges:      '🔥 Your Growth Edges',
  career:          '💼 Career & Life Direction',
  money:           '💰 Money & Wealth Patterns',
  love:            '❤️ Love & Relationships',
  health:          '🏃 Health & Body Patterns',
  family:          '👨‍👩‍👧 Family, Children & Parents',
  year_ahead:      '📅 Your Year Ahead (2026–2027)',
  major_period:    '⏰ Your Current Life Chapter',
  timing:          '🎯 Key Windows & Timing',
  past:            '🔮 Indicators from Your Past',
  remedies:        '✨ What Supports You',

  // Compatibility Report sections
  overview:        '💫 Your Compatibility Overview',
  scores:          '📊 Compatibility Scores',
  physical:        '🔥 Physical & Energetic Chemistry',
  mental:          '🧠 Mental & Emotional Connection',
  longterm:        '🏡 Long-Term Partnership Potential',
  challenges_rel:  '⚡ Areas That Need Work',
  timing_rel:      '📅 Best Timing for Commitment',

  // Life Timing sections
  windows:         '🎯 Your Power Windows',
  caution:         '⚠️ Periods to Navigate Carefully',
  career_timing:   '💼 Career Timing',
  love_timing:     '❤️ Love & Marriage Timing',
  money_timing:    '💰 Financial Timing',
  health_timing:   '🏃 Health Timing',
};

// ─── FORMAT ENGINE FLAGS FOR REPORT PROMPT ───────────────────────────────────
// Takes translated engine output and formats it as a clear prompt section
function formatFlagsForPrompt(translatedResult, chartData) {
  const R = translatedResult;
  const lines = [];

  lines.push('=== CHART ANALYSIS (USE THESE SPECIFIC FINDINGS — DO NOT FABRICATE OTHERS) ===');
  lines.push('');
  lines.push(`PERSON: ${chartData.name}, ${chartData.dob}`);
  lines.push(`RISING SIGN: ${chartData.lagna}`);
  lines.push(`MOON SIGN: ${chartData.rashi}`);
  lines.push(`BIRTH STAR: ${chartData.nakshatra}`);
  lines.push(`CURRENT MAJOR PERIOD: ${R.summary?.current_dasha || 'Unknown'} (use exact years if available)`);
  lines.push(`CURRENT ACTIVE PHASE: ${R.summary?.current_antar || 'Unknown'}`);
  lines.push(`MAJOR PERIOD QUALITY: ${R.summary?.dasha_quality || 'Mixed'}`);
  lines.push('');

  if (R.yogas?.length) {
    lines.push('POSITIVE PATTERNS CONFIRMED IN CHART:');
    R.yogas.filter(y=>y.name||y.type).slice(0, 6).forEach(y => lines.push(`  • ${y.name||y.type}: ${y.desc?.slice(0, 150) || ''}`));
    lines.push('');
  }

  if (R.doshas?.length) {
    lines.push('CHALLENGE PATTERNS CONFIRMED IN CHART:');
    R.doshas.filter(d=>d.name||d.type).slice(0, 4).forEach(d => lines.push(`  • ${d.name||d.type}: ${d.desc?.slice(0, 150) || ''}`));
    lines.push('');
  }

  if (R.dasha_q?.length) {
    lines.push('CURRENT LIFE PERIOD ANALYSIS:');
    R.dasha_q.forEach(d => lines.push(`  • ${d.type}: ${d.desc?.slice(0, 200) || ''}`));
    lines.push('');
  }

  if (R.sade_sati && R.sade_sati.phase !== 'Not active') {
    lines.push(`SATURN PRESSURE CYCLE: ${R.sade_sati.phase} — ${R.sade_sati.desc?.slice(0, 150) || ''}`);
    lines.push('');
  }

  if (R.transits_now?.length) {
    lines.push('CURRENT PLANETARY INFLUENCES (RIGHT NOW):');
    R.transits_now.slice(0, 5).forEach(t => lines.push(`  • ${t.desc?.slice(0, 150) || ''}`));
    lines.push('');
  }

  if (R.career?.length) {
    lines.push('CAREER PATTERNS:');
    R.career.slice(0, 4).forEach(c => lines.push(`  • ${c.desc?.slice(0, 120) || ''}`));
    lines.push('');
  }

  if (R.marriage?.length) {
    lines.push('RELATIONSHIP PATTERNS:');
    R.marriage.slice(0, 5).forEach(m => lines.push(`  • ${m.desc?.slice(0, 120) || ''}`));
    lines.push('');
  }

  if (R.children?.length) {
    lines.push('FAMILY/CHILDREN PATTERNS:');
    R.children.slice(0, 4).forEach(c => lines.push(`  • ${c.desc?.slice(0, 120) || ''}`));
    lines.push('');
  }

  if (R.health?.length) {
    lines.push('HEALTH PATTERNS:');
    R.health.slice(0, 4).forEach(h => lines.push(`  • ${h.area}: ${h.desc?.slice(0, 100) || ''}`));
    lines.push('');
  }

  if (R.psych?.length) {
    lines.push('PSYCHOLOGICAL PATTERNS:');
    R.psych.slice(0, 4).forEach(p => lines.push(`  • ${p.type}: ${p.desc?.slice(0, 120) || ''}`));
    lines.push('');
  }

  if (R.timing?.length) {
    lines.push('UPCOMING LIFE WINDOWS:');
    R.timing.slice(0, 4).forEach(t => lines.push(`  • ${t.event}: ${t.period || ''} — ${t.desc?.slice(0, 120) || ''}`));
    lines.push('');
  }

  if (R.wealth?.length) {
    lines.push('WEALTH PATTERNS:');
    R.wealth.filter(w => w.type !== 'AV Principle').slice(0, 4).forEach(w => lines.push(`  • ${w.desc?.slice(0, 120) || ''}`));
    lines.push('');
  }

  if (R.foreign?.length) {
    lines.push('FOREIGN/TRAVEL PATTERNS:');
    R.foreign.forEach(f => lines.push(`  • ${f.desc?.slice(0, 100) || ''}`));
    lines.push('');
  }

  if (R.spiritual?.length) {
    lines.push('SPIRITUAL/DEEPER PURPOSE:');
    R.spiritual.slice(0, 3).forEach(s => lines.push(`  • ${s.desc?.slice(0, 100) || ''}`));
    lines.push('');
  }

  lines.push('=== END ANALYSIS ===');
  lines.push('');
  lines.push('NOW WRITE THE REPORT using ONLY what is listed above. No generic astrology. Every claim must reference specific planets, signs, or patterns named above. American English only. No Sanskrit terms.');

  return lines.join('\n');
}

// ─── COMPATIBILITY PROMPT FORMATTER ──────────────────────────────────────────
function formatCompatibilityForPrompt(translatedResult, person1, person2) {
  const R = translatedResult;
  const lines = [];
  lines.push('=== COMPATIBILITY ANALYSIS ===');
  lines.push(`PERSON 1: ${person1.name} — Rising ${person1.lagna}, Moon ${person1.rashi}, Birth Star ${person1.nakshatra}`);
  lines.push(`PERSON 2: ${person2.name} — Rising ${person2.lagna}, Moon ${person2.rashi}, Birth Star ${person2.nakshatra}`);
  lines.push('');

  if (R.compatibility?.length) {
    const total = R.compatibility.find(c => c.type === 'Total Guna Milan');
    if (total) lines.push(`OVERALL COMPATIBILITY SCORE: ${total.score}/36 — ${total.desc?.slice(0, 100) || ''}`);
    lines.push('');
    lines.push('DETAILED COMPATIBILITY SCORES:');
    R.compatibility.filter(c => c.kuta).forEach(c => lines.push(`  • ${c.kuta}: ${c.score}/${c.max} — ${c.desc?.slice(0, 100) || ''}`));
  }

  lines.push('');
  lines.push('Write the compatibility report in plain American English. Reference specific scores and what they mean in real relationship terms.');
  return lines.join('\n');
}

module.exports = {
  TERM_MAP, PLANET_NAMES, HOUSE_US, SIGN_US, BIRTH_STAR_US,
  translateToUS, translateEngineResult,
  formatFlagsForPrompt, formatCompatibilityForPrompt,
  US_SYSTEM_PROMPT, SECTION_LABELS, formatPeriod,
};
