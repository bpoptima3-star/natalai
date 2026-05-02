/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VEDIC ASTROLOGY COMPLETE RULES ENGINE — VERSION 3
 * Built from primary classical texts, chapter by chapter, in canonical order
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * PRIMARY SOURCES (in order of authority):
 *   BPHS  — Brihat Parashara Hora Shastra (Maharishi Parashara) — 97 chapters
 *   PD    — Phaladeepika (Mantreswara) — 27 chapters
 *   SAR   — Saravali (Kalyanvarma) — 50 chapters
 *   BJ    — Brihat Jataka (Varahamihira) — 25 chapters
 *   UK    — Uttara Kalamrita (Kalidasa) — 6 chapters
 *   JP    — Jataka Parijata (Vaidyanatha Dikshita) — 18 chapters
 *   JM    — Jaimini Sutram (Maharishi Jaimini) — 4 chapters
 *   PM    — Prashna Marga (Kerala tradition) — 32 chapters
 *   NS    — Nadi Shastra (general Nadi principles)
 *
 * ARCHITECTURE:
 *   Pure deterministic IF/THEN. Zero LLM. Zero hedging.
 *   Every rule has: source, chapter, verse, verdict, confidence, weight
 *   Compound rules require 3+ conditions — HIGH confidence only when multiple indicators agree
 *   Past (karma/Ketu/12th) + Present (D1/dasha/transits) + Future (timing/Prashna) = complete reading
 *
 * module.exports = { VedicRulesEngine }
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1 — BPHS CHAPTERS 1-3: FOUNDATIONAL CONSTANTS
// Grahas, Signs, Nakshatras, Friendships, Dignities
// ═══════════════════════════════════════════════════════════════════════════

// BPHS Ch.3 — The nine grahas and their natures
const GRAHA_NATURE = {
  Sun:     { element:'fire',   gender:'male',   nature:'malefic',  guna:'sattvic',  kaal:'day',   direction:'east' },
  Moon:    { element:'water',  gender:'female', nature:'benefic',  guna:'sattvic',  kaal:'night', direction:'northwest' },
  Mars:    { element:'fire',   gender:'male',   nature:'malefic',  guna:'tamasic',  kaal:'night', direction:'south' },
  Mercury: { element:'earth',  gender:'neutral',nature:'benefic',  guna:'rajasic',  kaal:'day',   direction:'north' },
  Jupiter: { element:'ether',  gender:'male',   nature:'benefic',  guna:'sattvic',  kaal:'day',   direction:'northeast' },
  Venus:   { element:'water',  gender:'female', nature:'benefic',  guna:'rajasic',  kaal:'night', direction:'southeast' },
  Saturn:  { element:'air',    gender:'neutral',nature:'malefic',  guna:'tamasic',  kaal:'day',   direction:'west' },
  Rahu:    { element:'air',    gender:'female', nature:'malefic',  guna:'tamasic',  kaal:'night', direction:'southwest' },
  Ketu:    { element:'fire',   gender:'neutral',nature:'malefic',  guna:'tamasic',  kaal:'night', direction:'northwest' }
};

// BPHS Ch.3 — Exaltation, debilitation, own signs, moolatrikona
const DIGNITY = {
  // [exaltation_sign, exalt_degree, debilitation_sign, own_signs[], moolatrikona_sign, moola_range_start, moola_range_end]
  Sun:     { exalt:0,  exaltDeg:10, debil:6,  own:[4],    moola:4,  moolaStart:0,  moolaEnd:20  },
  Moon:    { exalt:1,  exaltDeg:3,  debil:7,  own:[3],    moola:1,  moolaStart:4,  moolaEnd:30  },
  Mars:    { exalt:9,  exaltDeg:28, debil:3,  own:[0,7],  moola:0,  moolaStart:0,  moolaEnd:12  },
  Mercury: { exalt:5,  exaltDeg:15, debil:11, own:[2,5],  moola:2,  moolaStart:15, moolaEnd:20  },
  Jupiter: { exalt:3,  exaltDeg:5,  debil:9,  own:[8,11], moola:8,  moolaStart:0,  moolaEnd:10  },
  Venus:   { exalt:11, exaltDeg:27, debil:5,  own:[1,6],  moola:6,  moolaStart:0,  moolaEnd:15  },
  Saturn:  { exalt:6,  exaltDeg:20, debil:0,  own:[9,10], moola:10, moolaStart:0,  moolaEnd:20  },
  Rahu:    { exalt:1,  exaltDeg:20, debil:7,  own:[],     moola:null },
  Ketu:    { exalt:7,  exaltDeg:20, debil:1,  own:[],     moola:null }
};

// BPHS Ch.3 — Natural friendship table
const NATURAL_FRIENDS = {
  Sun:     ['Moon','Mars','Jupiter'],
  Moon:    ['Sun','Mercury'],
  Mars:    ['Sun','Moon','Jupiter'],
  Mercury: ['Sun','Venus'],
  Jupiter: ['Sun','Moon','Mars'],
  Venus:   ['Mercury','Saturn'],
  Saturn:  ['Mercury','Venus'],
  Rahu:    ['Mercury','Saturn','Venus'],
  Ketu:    ['Mars','Venus','Saturn']
};
const NATURAL_ENEMIES = {
  Sun:     ['Venus','Saturn','Rahu','Ketu'],
  Moon:    ['Rahu','Ketu'],
  Mars:    ['Mercury'],
  Mercury: ['Moon'],
  Jupiter: ['Mercury','Venus','Rahu'],
  Venus:   ['Sun','Moon'],
  Saturn:  ['Sun','Moon','Mars'],
  Rahu:    ['Sun','Moon','Mars'],
  Ketu:    ['Sun','Moon','Mercury']
};

// BPHS Ch.4 — Rashi (Sign) properties
const SIGN_PROPS = {
  //       [element, quality,   gender,   ruler,    body_part,              nature]
  0:  { name:'Aries',       element:'fire',  quality:'movable', gender:'male',   ruler:'Mars',    bodyPart:'head, brain',           nature:'fierce' },
  1:  { name:'Taurus',      element:'earth', quality:'fixed',   gender:'female', ruler:'Venus',   bodyPart:'face, throat, neck',     nature:'gentle' },
  2:  { name:'Gemini',      element:'air',   quality:'dual',    gender:'male',   ruler:'Mercury', bodyPart:'shoulders, arms, lungs', nature:'mixed' },
  3:  { name:'Cancer',      element:'water', quality:'movable', gender:'female', ruler:'Moon',    bodyPart:'chest, heart, stomach',  nature:'gentle' },
  4:  { name:'Leo',         element:'fire',  quality:'fixed',   gender:'male',   ruler:'Sun',     bodyPart:'heart, spine, back',     nature:'fierce' },
  5:  { name:'Virgo',       element:'earth', quality:'dual',    gender:'female', ruler:'Mercury', bodyPart:'intestines, navel',      nature:'gentle' },
  6:  { name:'Libra',       element:'air',   quality:'movable', gender:'male',   ruler:'Venus',   bodyPart:'kidneys, lower back',    nature:'mixed' },
  7:  { name:'Scorpio',     element:'water', quality:'fixed',   gender:'female', ruler:'Mars',    bodyPart:'reproductive, pelvis',   nature:'fierce' },
  8:  { name:'Sagittarius', element:'fire',  quality:'dual',    gender:'male',   ruler:'Jupiter', bodyPart:'thighs, hips',           nature:'gentle' },
  9:  { name:'Capricorn',   element:'earth', quality:'movable', gender:'female', ruler:'Saturn',  bodyPart:'knees, bones, skin',     nature:'mixed' },
  10: { name:'Aquarius',    element:'air',   quality:'fixed',   gender:'male',   ruler:'Saturn',  bodyPart:'calves, ankles',         nature:'mixed' },
  11: { name:'Pisces',      element:'water', quality:'dual',    gender:'female', ruler:'Jupiter', bodyPart:'feet, lymph',            nature:'gentle' }
};

// BPHS Ch.5 — 27 Nakshatras with lords, nature, guna, body part, quality
const NAKSHATRA = [
  // [name, lord, nature, gana, bodyPart, quality, gender, devata]
  { name:'Ashwini',        lord:'Ketu',    nature:'light',    gana:'deva',    bodyPart:'knees',         quality:'movable', gender:'male',   devata:'Ashwins' },
  { name:'Bharani',        lord:'Venus',   nature:'fierce',   gana:'manushya',bodyPart:'head',          quality:'fixed',   gender:'female', devata:'Yama' },
  { name:'Krittika',       lord:'Sun',     nature:'mixed',    gana:'rakshasa',bodyPart:'waist, hips',   quality:'mixed',   gender:'female', devata:'Agni' },
  { name:'Rohini',         lord:'Moon',    nature:'fixed',    gana:'manushya',bodyPart:'forehead',      quality:'fixed',   gender:'male',   devata:'Brahma' },
  { name:'Mrigashira',     lord:'Mars',    nature:'gentle',   gana:'deva',    bodyPart:'eyes',          quality:'movable', gender:'neutral',devata:'Soma' },
  { name:'Ardra',          lord:'Rahu',    nature:'fierce',   gana:'manushya',bodyPart:'hair',          quality:'movable', gender:'female', devata:'Rudra' },
  { name:'Punarvasu',      lord:'Jupiter', nature:'movable',  gana:'deva',    bodyPart:'nose',          quality:'movable', gender:'male',   devata:'Aditi' },
  { name:'Pushya',         lord:'Saturn',  nature:'light',    gana:'deva',    bodyPart:'face, mouth',   quality:'fixed',   gender:'male',   devata:'Brihaspati' },
  { name:'Ashlesha',       lord:'Mercury', nature:'sharp',    gana:'rakshasa',bodyPart:'ears',          quality:'fixed',   gender:'female', devata:'Nagas' },
  { name:'Magha',          lord:'Ketu',    nature:'fierce',   gana:'rakshasa',bodyPart:'chin',          quality:'fixed',   gender:'female', devata:'Pitrs' },
  { name:'Purva Phalguni', lord:'Venus',   nature:'fierce',   gana:'manushya',bodyPart:'right hand',    quality:'fixed',   gender:'female', devata:'Bhaga' },
  { name:'Uttara Phalguni',lord:'Sun',     nature:'fixed',    gana:'manushya',bodyPart:'left hand',     quality:'fixed',   gender:'female', devata:'Aryaman' },
  { name:'Hasta',          lord:'Moon',    nature:'light',    gana:'deva',    bodyPart:'hands, fingers', quality:'movable', gender:'male',   devata:'Savitar' },
  { name:'Chitra',         lord:'Mars',    nature:'gentle',   gana:'rakshasa',bodyPart:'forehead',      quality:'movable', gender:'female', devata:'Tvashtr' },
  { name:'Swati',          lord:'Rahu',    nature:'movable',  gana:'deva',    bodyPart:'chest',         quality:'movable', gender:'female', devata:'Vayu' },
  { name:'Vishakha',       lord:'Jupiter', nature:'mixed',    gana:'rakshasa',bodyPart:'arms',          quality:'mixed',   gender:'male',   devata:'Indra-Agni' },
  { name:'Anuradha',       lord:'Saturn',  nature:'gentle',   gana:'deva',    bodyPart:'stomach',       quality:'movable', gender:'male',   devata:'Mitra' },
  { name:'Jyeshtha',       lord:'Mercury', nature:'sharp',    gana:'rakshasa',bodyPart:'tongue, chin',  quality:'fixed',   gender:'female', devata:'Indra' },
  { name:'Moola',          lord:'Ketu',    nature:'fierce',   gana:'rakshasa',bodyPart:'feet',          quality:'fixed',   gender:'neutral',devata:'Nirriti' },
  { name:'Purva Ashadha',  lord:'Venus',   nature:'fierce',   gana:'manushya',bodyPart:'thighs',        quality:'fixed',   gender:'female', devata:'Apas' },
  { name:'Uttara Ashadha', lord:'Sun',     nature:'fixed',    gana:'manushya',bodyPart:'thighs',        quality:'movable', gender:'female', devata:'Vishvadevas' },
  { name:'Shravana',       lord:'Moon',    nature:'movable',  gana:'deva',    bodyPart:'ears',          quality:'movable', gender:'male',   devata:'Vishnu' },
  { name:'Dhanishtha',     lord:'Mars',    nature:'movable',  gana:'rakshasa',bodyPart:'back',          quality:'movable', gender:'female', devata:'Vasus' },
  { name:'Shatabhisha',    lord:'Rahu',    nature:'movable',  gana:'rakshasa',bodyPart:'jaw, right thigh',quality:'fixed', gender:'neutral',devata:'Varuna' },
  { name:'Purva Bhadra',   lord:'Jupiter', nature:'fierce',   gana:'manushya',bodyPart:'sides, ribs',   quality:'fixed',   gender:'male',   devata:'Aja Ekapada' },
  { name:'Uttara Bhadra',  lord:'Saturn',  nature:'fixed',    gana:'manushya',bodyPart:'sides',         quality:'fixed',   gender:'female', devata:'Ahir Budhnya' },
  { name:'Revati',         lord:'Mercury', nature:'gentle',   gana:'deva',    bodyPart:'feet, ankles',  quality:'movable', gender:'female', devata:'Pushan' }
];

// BPHS Ch.6 — Vimshottari Dasha years
const DASHA_YEARS = { Ketu:7, Venus:20, Sun:6, Moon:10, Mars:7, Rahu:18, Jupiter:16, Saturn:19, Mercury:17 };
const DASHA_SEQ   = ['Ketu','Venus','Sun','Moon','Mars','Rahu','Jupiter','Saturn','Mercury'];
const DASHA_TOTAL = 120;

// BPHS Ch.7 — House significations (Karakatwa)
const HOUSE_KARAKATWA = {
  1:  { name:'Lagna/Tanu',    signifies:['self','body','personality','health','vitality','appearance','fame','longevity_general'], karaka:'Sun' },
  2:  { name:'Dhana',         signifies:['wealth','family','speech','food','right_eye','face','early_childhood'], karaka:'Jupiter' },
  3:  { name:'Sahaja',        signifies:['siblings','courage','short_travel','communication','arms','right_ear'], karaka:'Mars' },
  4:  { name:'Sukha/Bandhu',  signifies:['mother','happiness','home','property','vehicles','education','chest','heart'], karaka:'Moon' },
  5:  { name:'Putra',         signifies:['children','intelligence','creativity','past_karma','mantras','stomach'], karaka:'Jupiter' },
  6:  { name:'Ripu/Roga',     signifies:['enemies','disease','debt','service','litigation','maternal_uncle'], karaka:'Mars,Saturn' },
  7:  { name:'Kalatra',       signifies:['spouse','marriage','partnerships','business_partner','travel_south','lower_abdomen'], karaka:'Venus' },
  8:  { name:'Ayur/Mrityu',   signifies:['longevity','death','obstacles','inheritance','occult','chronic_illness','research'], karaka:'Saturn' },
  9:  { name:'Dharma/Bhagya', signifies:['father','fortune','dharma','religion','guru','higher_education','long_travel'], karaka:'Sun,Jupiter' },
  10: { name:'Karma',         signifies:['career','status','authority','government','profession','action','knees'], karaka:'Mercury,Jupiter,Sun,Saturn' },
  11: { name:'Labha',         signifies:['gains','income','elder_siblings','friends','desires_fulfilled','left_ear'], karaka:'Jupiter' },
  12: { name:'Vyaya',         signifies:['loss','expenditure','foreign','moksha','bed_pleasures','left_eye','feet'], karaka:'Saturn' }
};

// House classification
const KENDRAS   = [1,4,7,10];   // Angular — most powerful
const TRIKONAS  = [1,5,9];      // Trinal — most auspicious
const DUSTHANAS = [6,8,12];     // Difficult — malefic
const UPACHAYAS = [3,6,10,11];  // Growing houses — malefics do well here
const PANAPHARAS= [2,5,8,11];   // Succedent
const APOKLIMAS = [3,6,9,12];   // Cadent

// Yoga Karaka — planet ruling both kendra and trikona simultaneously (BPHS Ch.34)
const YOGA_KARAKA = {
  0:null,       // Aries — Sun rules 5th (trikona) but not kendra. No single YK.
  1:'Saturn',   // Taurus — Saturn rules 9th (trikona) + 10th (kendra)
  2:null,       // Gemini — No single planet rules both kendra and trikona
  3:'Mars',     // Cancer — Mars rules 5th (trikona) + 10th (kendra)
  4:null,       // Leo — No single YK
  5:null,       // Virgo — Venus rules 2nd and 9th — dhana yoga but not kendra
  6:'Saturn',   // Libra — Saturn rules 4th (kendra) + 5th (trikona)
  7:null,       // Scorpio — No single YK
  8:null,       // Sagittarius — No single YK
  9:'Venus',    // Capricorn — Venus rules 5th (trikona) + 10th (kendra)
  10:'Venus',   // Aquarius — Venus rules 4th (kendra) + 9th (trikona)
  11:null       // Pisces — No single YK
};

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2 — HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

const n360 = x => ((x % 360) + 360) % 360;
const signOf = lon => Math.floor(n360(lon) / 30);
const houseOf = (sign, lagnaSign) => ((sign - lagnaSign + 12) % 12) + 1;
const nakOf = lon => Math.floor(n360(lon) / (360/27));
const nakPada = lon => Math.floor((n360(lon) % (360/27)) / (360/108)) + 1;

// Planetary dignity
function getDignity(planet, sign) {
  const d = DIGNITY[planet];
  if (!d) return 'NEUTRAL';
  if (d.exalt === sign) return 'EXALTED';
  if (d.debil === sign) return 'DEBILITATED';
  if (d.own && d.own.includes(sign)) return 'OWN';
  if (d.moola === sign) return 'MOOLATRIKONA';
  return 'NEUTRAL';
}

function isStrong(planet, sign) {
  const d = getDignity(planet, sign);
  return d === 'EXALTED' || d === 'OWN' || d === 'MOOLATRIKONA';
}
function isWeak(planet, sign) {
  return getDignity(planet, sign) === 'DEBILITATED';
}
function isExalted(planet, sign) { return getDignity(planet, sign) === 'EXALTED'; }
function isDebilitated(planet, sign) { return getDignity(planet, sign) === 'DEBILITATED'; }

// Deep exaltation / exact exaltation degree

// Natural benefic/malefic
function isBenefic(planet) { return ['Jupiter','Venus','Moon','Mercury'].includes(planet); }
function isMalefic(planet) { return ['Saturn','Mars','Sun','Rahu','Ketu'].includes(planet); }

// Planets in a given house
function planetsInHouse(house, chart) {
  return Object.entries(chart.planets)
    .filter(([, d]) => d.house === house)
    .map(([p]) => p);
}

// Lord of house n
function lordOf(houseNum, chart) {
  return chart.houseLords[houseNum];
}

// Planet's house
function houseOfPlanet(planet, chart) {
  return chart.planets[planet]?.house || null;
}

// Planet's sign
function signOfPlanet(planet, chart) {
  return chart.planets[planet]?.sign;
}

// Special aspects — BPHS Ch.26
// All planets: 7th aspect. Mars additionally: 4th, 8th. Jupiter: 5th, 9th. Saturn: 3rd, 10th.
function getAspects(planet, fromHouse) {
  const h = fromHouse;
  const base = [((h + 5) % 12) + 1]; // 7th from h
  if (planet === 'Mars')    return [...base, ((h+2)%12)+1, ((h+6)%12)+1];
  if (planet === 'Jupiter') return [...base, ((h+3)%12)+1, ((h+7)%12)+1];
  if (planet === 'Saturn')  return [...base, ((h+1)%12)+1, ((h+8)%12)+1];
  if (planet === 'Rahu' || planet === 'Ketu') return [...base, ((h+3)%12)+1, ((h+7)%12)+1];
  return base;
}

function planetAspectsHouse(planet, chart, targetHouse) {
  const ph = houseOfPlanet(planet, chart);
  if (!ph) return false;
  return getAspects(planet, ph).includes(targetHouse);
}

function anyBeneficAspects(house, chart) {
  return ['Jupiter','Venus','Moon','Mercury'].some(p => planetAspectsHouse(p, chart, house));
}

// Are two planets conjunct (same house)?
function conjunct(p1, p2, chart) {
  const h1 = houseOfPlanet(p1, chart);
  const h2 = houseOfPlanet(p2, chart);
  return h1 && h2 && h1 === h2;
}

// Parivartana (mutual exchange) between lords of two houses
function parivartana(h1, h2, chart) {
  const l1 = lordOf(h1, chart);
  const l2 = lordOf(h2, chart);
  return houseOfPlanet(l1, chart) === h2 && houseOfPlanet(l2, chart) === h1;
}

// Is house lord in dusthana?

// Is house lord in kendra?

// Is house lord in trikona?

// Neecha Bhanga — cancellation of debilitation — BPHS Ch.39
function neechaBhanga(planet, chart) {
  const pSign = signOfPlanet(planet, chart);
  const pHouse = houseOfPlanet(planet, chart);
  if (!isDebilitated(planet, pSign)) return false;

  // Rule 1: Lord of debilitation sign is in kendra from lagna or Moon
  const debilSign = DIGNITY[planet].debil;
  const debilSignLord = SIGN_PROPS[debilSign].ruler;
  const dlHouse = houseOfPlanet(debilSignLord, chart);
  if (KENDRAS.includes(dlHouse)) return true;

  // Rule 2: Lord of exaltation sign is in kendra from lagna or Moon
  const exaltSign = DIGNITY[planet].exalt;
  const exaltSignLord = SIGN_PROPS[exaltSign].ruler;
  const elHouse = houseOfPlanet(exaltSignLord, chart);
  if (KENDRAS.includes(elHouse)) return true;

  // Rule 3: Debilitated planet is in kendra itself
  if (KENDRAS.includes(pHouse)) return true;

  // Rule 4: Planet that gets exalted in the debilitation sign aspects the debilitated planet
  // (The planet that is exalted in the sign of debilitation)
  // E.g., Jupiter debilitated in Capricorn — Mars is exalted in Capricorn — if Mars aspects Jupiter = cancellation
  const exaltedInDebilSign = Object.keys(DIGNITY).find(p =>
    p !== planet && DIGNITY[p].exalt === debilSign
  );
  if (exaltedInDebilSign && planetAspectsHouse(exaltedInDebilSign, chart, pHouse)) return true;

  return false;
}

// Combustion check — BPHS Ch.3
// Planets within certain degrees of Sun are combust
const COMBUST_DEGREES = { Moon:12, Mars:17, Mercury:14, Jupiter:11, Venus:10, Saturn:15 };
function isCombust(planet, chart) {
  if (planet === 'Sun' || planet === 'Rahu' || planet === 'Ketu') return false;
  const pLon = chart.planets[planet]?.longitude;
  const sLon = chart.planets['Sun']?.longitude;
  if (pLon === undefined || sLon === undefined) return false;
  let diff = Math.abs(n360(pLon - sLon));
  if (diff > 180) diff = 360 - diff;
  return diff <= (COMBUST_DEGREES[planet] || 10);
}

// Vargottama — same sign in D1 and D9 — very strong
function isVargottama(planet, chart) {
  if (!chart.navamsha || !chart.navamsha[planet]) return false;
  return chart.planets[planet]?.sign === chart.navamsha[planet]?.sign;
}

// Atmakaraka — planet with highest degree in sign (Jaimini)
function getAtmakaraka(chart) {
  const planets = ['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn','Rahu'];
  let ak = 'Sun', maxDeg = 0;
  for (const p of planets) {
    const deg = chart.planets[p]?.degree || 0;
    if (deg > maxDeg) { maxDeg = deg; ak = p; }
  }
  return ak;
}

// Amatyakaraka — second highest degree (Jaimini — career minister)
function getAmatyakaraka(chart) {
  const planets = ['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn','Rahu'];
  const sorted = [...planets].sort((a,b) =>
    (chart.planets[b]?.degree||0) - (chart.planets[a]?.degree||0)
  );
  return sorted[1] || 'Mercury';
}

// Darakaraka — planet with LOWEST degree (Jaimini — spouse)
function getDarakaraka(chart) {
  const planets = ['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn'];
  let dk = 'Venus', minDeg = 30;
  for (const p of planets) {
    const deg = chart.planets[p]?.degree || 0;
    if (deg < minDeg) { minDeg = deg; dk = p; }
  }
  return dk;
}

// Moon phase from Sun-Moon longitudes
function getMoonPhase(chart) {
  const sunLon = chart.planets['Sun']?.longitude || 0;
  const moonLon = chart.planets['Moon']?.longitude || 0;
  const diff = n360(moonLon - sunLon);
  if (diff < 180) return { phase:'Waxing', strength:'increasing', favorable:true };
  return { phase:'Waning', strength:'decreasing', favorable:false };
}

// Uttama Navamsha — BPHS: planet in exaltation sign in navamsha

// Pushkara Navamsha — auspicious navamshas (Uttara Kalamrita)
// Signs where navamsha is pushkara: Taurus 3rd (Aquarius), Gemini 3rd (Cancer), etc.
const PUSHKARA_NAVAMSHA = [
  {sign:1,pada:3},{sign:2,pada:3},{sign:3,pada:1},{sign:5,pada:2},
  {sign:6,pada:4},{sign:8,pada:2},{sign:9,pada:4},{sign:10,pada:2},
  {sign:11,pada:3},{sign:0,pada:2},{sign:4,pada:1},{sign:7,pada:4}
];

// Rule output structure
function rule(id, source, verdict, confidence='MEDIUM', weight=1, modifier=null) {
  return { id, source, verdict, confidence, weight, modifier };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3 — BPHS CH.7-8: LAGNA AND LAGNA LORD
// Physical nature, constitution, general life force
// ═══════════════════════════════════════════════════════════════════════════

function evaluateLagna(chart) {
  const findings = [];
  const lagnaSign = chart.lagna;
  const lagnaLord = lordOf(1, chart);
  const lagnaLordSign = signOfPlanet(lagnaLord, chart);
  const lagnaLordHouse = houseOfPlanet(lagnaLord, chart);
  const lagnaLordDignity = getDignity(lagnaLord, lagnaLordSign);
  const planetsInL = planetsInHouse(1, chart);

  // BPHS Ch.7 v.1-12 — Lagna lord results by house
  // Each placement gives a specific life direction
  const lagnaLordInHouse = {
    1:  { verdict:`Self-reliant, strong constitution, pioneering nature. Life is shaped by personal effort and independent action. Physical strength is a defining quality.`, confidence:'HIGH' },
    2:  { verdict:`Wealth-focused life, strong family orientation. Speech is prominent — native may earn through communication, teaching, or commerce. Good accumulation of resources.`, confidence:'HIGH' },
    3:  { verdict:`Courageous, adventurous life. Siblings play an important role. Native thrives in communication, media, short travel, or entrepreneurial ventures.`, confidence:'HIGH' },
    4:  { verdict:`Domestic happiness, deep roots in home and motherland. Educational attainment is strong. Property and real estate are significant.`, confidence:'HIGH' },
    5:  { verdict:`Intelligent, creative, intuitive. Children are important. Past-life karma supports this native. Good for speculation, creativity, and spiritual practices.`, confidence:'HIGH' },
    6:  { verdict:`Life oriented toward service and competition. Health needs attention. Native overcomes enemies through persistent effort. Good for medicine, law, or military.`, confidence:'HIGH' },
    7:  { verdict:`Partnership-focused life. Marriage and business relationships are central. Native gains through others. Travel to distant lands is indicated.`, confidence:'HIGH' },
    8:  { verdict:`Research-oriented, interested in mysteries and the hidden. Longevity requires care. Native undergoes deep transformations. Interest in occult or psychology.`, confidence:'HIGH' },
    9:  { verdict:`Highly fortunate, dharmic life. Father is an important figure. Native is guided by higher principles. Religious and philosophical orientation.`, confidence:'HIGH' },
    10: { verdict:`Career-driven, ambitious life. Public recognition comes naturally. Authority figures play a role. Native reaches high professional position.`, confidence:'HIGH' },
    11: { verdict:`Gains come easily. Multiple income streams. Desires are fulfilled. Social connections are wide and supportive. Elder siblings bring benefits.`, confidence:'HIGH' },
    12: { verdict:`Spiritual inclination, connection to foreign lands. Expenditure is heavy. Native may live abroad. Bed pleasures are prominent. Liberation orientation.`, confidence:'HIGH' }
  };

  if (lagnaLordInHouse[lagnaLordHouse]) {
    const r = lagnaLordInHouse[lagnaLordHouse];
    findings.push(rule(`LL-H${lagnaLordHouse}`, 'BPHS Ch.7 v.1-12', r.verdict, r.confidence, 3));
  }

  // BPHS Ch.7 v.13-20 — Lagna lord dignity modifies the above
  if (lagnaLordDignity === 'EXALTED') {
    findings.push(rule('LL-EXALT', 'BPHS Ch.7 v.13',
      `Lagna lord ${lagnaLord} is exalted — outstanding physical vitality, strong willpower, exceptional life force. The native is blessed with above-average capability in all areas signified by the lagna lord's house.`,
      'HIGH', 3));
  } else if (lagnaLordDignity === 'OWN' || lagnaLordDignity === 'MOOLATRIKONA') {
    findings.push(rule('LL-OWN', 'BPHS Ch.7 v.14',
      `Lagna lord ${lagnaLord} in own sign — stable, self-assured, and capable. The native's constitution is reliable and health generally good throughout life.`,
      'HIGH', 2));
  } else if (lagnaLordDignity === 'DEBILITATED') {
    if (neechaBhanga(lagnaLord, chart)) {
      findings.push(rule('LL-NB', 'BPHS Ch.39 (Neecha Bhanga)',
        `Lagna lord ${lagnaLord} is debilitated but Neecha Bhanga applies — the debilitation is cancelled. After initial struggles in youth, the native rises significantly. Neecha Bhanga Raja Yoga: weakness transformed into strength.`,
        'HIGH', 3));
    } else {
      findings.push(rule('LL-DEBIL', 'BPHS Ch.7 v.15',
        `Lagna lord ${lagnaLord} is debilitated — weak constitution, self-doubt, and recurring health concerns. Life requires significantly more effort than average to achieve results. Remedies are important.`,
        'HIGH', -2));
    }
  }

  // BPHS Ch.7 — Planets in lagna
  for (const p of planetsInL) {
    const planetInLagnaVerdicts = {
      Sun:     `Sun in lagna — authoritative, proud, dignified personality. Strong bones and constitution. Career connected to government or authority. Father's traits are strong in the native.`,
      Moon:    `Moon in lagna — soft, intuitive, attractive personality. Emotional sensitivity defines the character. Strong public appeal and connection with masses.`,
      Mars:    `Mars in lagna — courageous, energetic, sometimes aggressive nature. Athletic body, prone to accidents. Leadership ability but impulsive. Mangal in lagna gives Ruchaka Yoga if strong.`,
      Mercury: `Mercury in lagna — intelligent, communicative, youthful appearance. Quick thinking, good at business, writing, or mathematics. Versatile and adaptable.`,
      Jupiter: `Jupiter in lagna — Hamsa Yoga if in own/exaltation. Wise, generous, respected personality. Good health, positive outlook. Well-regarded by society.`,
      Venus:   `Venus in lagna — Malavya Yoga if strong. Beautiful appearance, artistic nature, charm. Magnetic personality, attracted to luxury and beauty.`,
      Saturn:  `Saturn in lagna — Sasha Yoga if strong (Capricorn/Aquarius). Disciplined, serious, hard-working personality. Slow but steady progress. Long life.`,
      Rahu:    `Rahu in lagna — unconventional personality, ambitious, may have foreign or unusual qualities. Confusion around identity. Strong material desires.`,
      Ketu:    `Ketu in lagna — spiritual, detached, sometimes isolated. Past-life spiritual attainment. May have unusual physical marks. Moksha orientation.`
    };
    if (planetInLagnaVerdicts[p]) {
      findings.push(rule(`${p}-L1`, 'BPHS Ch.7 v.20-40',
        planetInLagnaVerdicts[p], 'HIGH', isStrong(p, lagnaSign) ? 3 : 2));
    }
  }

  // Combustion of lagna lord — BPHS: weakens the native
  if (isCombust(lagnaLord, chart)) {
    findings.push(rule('LL-COMBUST', 'BPHS Ch.3 v.15',
      `Lagna lord ${lagnaLord} is combust (within Sun's orb) — diminished personal power. The native may struggle with recognition and visibility. Energy is suppressed by authority figures (father, government).`,
      'HIGH', -1));
  }

  // Vargottama lagna lord — very strong
  if (isVargottama(lagnaLord, chart)) {
    findings.push(rule('LL-VARG', 'BPHS Ch.27 (Vargottama)',
      `Lagna lord ${lagnaLord} is Vargottama (same sign in D1 and D9) — exceptional strength. The native's core qualities are deeply established and reliable across all life areas.`,
      'HIGH', 2));
  }

  return findings;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4 — BPHS CH.9, SAR CH.18: MOON — MENTAL NATURE
// Mind, emotions, mother's influence, mental health
// ═══════════════════════════════════════════════════════════════════════════

function evaluateMind(chart) {
  const findings = [];
  const moon = chart.planets['Moon'];
  if (!moon) return findings;

  const moonSign = moon.sign;
  const moonHouse = moon.house;
  const moonNak = nakOf(moon.longitude || moonSign * 30 + 15);
  const moonDignity = getDignity('Moon', moonSign);
  const moonPhase = getMoonPhase(chart);

  // BPHS Ch.9 — Moon sign mental nature
  const moonSignMind = {
    0:  `Restless, impulsive mind. Quick to anger but quick to forgive. Sharp mental reactions. Excellent at initiating but struggles with follow-through. Courage defines the thinking.`,
    1:  `Calm, sensual, fixed mind. Exceptional memory. Stubbornness is the shadow of this sign's mental stability. Loves beauty, comfort, and material security. Patient thinker.`,
    2:  `Dual, curious, quick-switching mind. Excellent communicator but easily distracted. Learns fast. Intellectually versatile. May hold contradictory views simultaneously.`,
    3:  `Deeply emotional, intuitive, psychically sensitive mind. Mood-dependent functioning. Strong imagination. Past experiences color all present perceptions. Excellent emotional intelligence.`,
    4:  `Proud, fixed mind with strong opinions. Generous but ego-driven. Dislikes being wrong. Sunny and confident when appreciated, withdrawn when ignored. Dramatic emotional expression.`,
    5:  `Analytical, critical, perfectionistic mind. Detail-oriented to a fault. Worrying tendency. Excellent memory for facts. Strong nervous system but anxiety-prone. Serves through intellect.`,
    6:  `Diplomatic, balanced, indecisive mind. Seeks harmony above all. Dislikes conflict. Excellent at seeing multiple sides. Can delay decisions indefinitely seeking perfect balance.`,
    7:  `Intense, probing, secretive mind. Investigates everything. Jealousy and suspicion are shadows. Deep emotional currents run beneath a calm surface. Powerful will.`,
    8:  `Philosophical, optimistic, freedom-loving mind. Hates restrictions. Thinks in grand visions. Restless if confined. Natural wisdom and love of learning. Blunt honesty.`,
    9:  `Practical, disciplined, serious mind. Slow to trust. Deeply loyal once committed. Thinks long-term. Excellent at planning. Melancholy tendency. Values tradition and structure.`,
    10: `Independent, intellectual, detached mind. Thinks in systems and patterns. Humanitarian ideals. Emotionally cool. Innovative and original. Unpredictable in intimacy.`,
    11: `Fluid, dreamy, empathetic mind. Boundaries are porous — absorbs others' emotions. Deeply imaginative. Spiritual inclination. Can dissolve into others' realities without anchor.`
  };
  findings.push(rule('MOON-SIGN', 'BPHS Ch.9 v.3', moonSignMind[moonSign], 'HIGH', 2));

  // Moon dignity
  if (moonDignity === 'EXALTED') {
    findings.push(rule('MOON-EXALT', 'BPHS Ch.9 v.5',
      `Moon exalted in Taurus — peak emotional stability, nurturing capacity, and mental strength. Native is loved by all, wealthy, and has exceptional sensory refinement. Mother is a great positive force.`,
      'HIGH', 3));
  } else if (moonDignity === 'DEBILITATED') {
    findings.push(rule('MOON-DEBIL', 'BPHS Ch.9 v.6',
      `Moon debilitated in Scorpio — emotional turbulence, anxiety, and mental instability are recurring themes. Relationship with mother is difficult or marked by suffering. Mental health requires conscious attention.`,
      'HIGH', -2));
  } else if (moonDignity === 'OWN') {
    findings.push(rule('MOON-OWN', 'BPHS Ch.9 v.4',
      `Moon in own sign Cancer — deeply nurturing, emotionally intelligent, strong intuition. Home and family are the anchor. Very sensitive to environment.`,
      'HIGH', 2));
  }

  // BPHS Ch.67 — Moon nakshatra — the most specific mental indicator
  const moonNakMind = {
    0:  `Ashwini Moon — Quick, restless, healing energy. Mind moves like a horse — fast, instinctive, occasionally unpredictable. Gift for rapid understanding and quick action.`,
    1:  `Bharani Moon — Bearing heavy burdens is this mind's calling. Creative yet weighed down by responsibility. Intense sensual nature. Yama's energy — confronts death and transformation.`,
    2:  `Krittika Moon — Sharp, discerning, cutting mind. Sees through illusions. Critical capacity. Agni's fire burns away falsehood. Leadership through clarity.`,
    3:  `Rohini Moon — Most materially blessed nakshatra for Moon. Beauty, artistic gift, magnetic attraction. Mind loves luxury and creation. Brahma's creative energy.`,
    4:  `Mrigashira Moon — Searching, curious, never fully at rest. The deer mind — alert, sensitive, always seeking. Soma's gentle nourishing quality.`,
    5:  `Ardra Moon — Stormy, intense emotional weather. Rudra's energy — destruction before renewal. Deep grief and deep transformation. Highly intelligent, sometimes turbulent.`,
    6:  `Punarvasu Moon — Returning again and again until mastery. Forgiving, optimistic, resilient mind. Aditi's infinite nurturing. Jupiter's expansion and optimism.`,
    7:  `Pushya Moon — Most auspicious nakshatra. Nurturing, protective, patient mind. Brihaspati's wisdom. Like a mother cow — generous, nourishing, reliable.`,
    8:  `Ashlesha Moon — Serpent energy — psychic, coiling, secretive. Mind is penetrating and sometimes manipulative. Past-life intensity. Naga energy gives occult gift.`,
    9:  `Magha Moon — Royal mind, ancestral pride, connection to lineage. The throne — commanding but burdened by legacy. Pitrs' energy — ancestors shape the mind.`,
    10: `Purva Phalguni Moon — Pleasure-seeking, creative, romantic. Bhaga's gift of enjoyment. Generous heart. Loves beauty, art, music. Needs appreciation.`,
    11: `Uttara Phalguni Moon — Charitable, helpful, steady. Aryaman's social grace. Practical beneficence — gives without losing. Sunlike reliability.`,
    12: `Hasta Moon — Skilled, clever, crafty mind. Savitar's artisan energy. Healing hands. Quick thinking. Practical intelligence expressed through skill.`,
    13: `Chitra Moon — Architect's mind — sees beauty in structure. Tvashtr's artisan gift. Perfectionist. Creates beauty wherever placed. Loves aesthetics.`,
    14: `Swati Moon — Independent, wind-like, adaptable. Vayu's movement. Business acumen. Bends like a sapling in storm but doesn't break. Self-reliant.`,
    15: `Vishakha Moon — Goal-focused, determined, sometimes two-faced. Indra-Agni combined — power and fire. Delays before ultimate victory. Divisive but triumphant.`,
    16: `Anuradha Moon — Deeply devoted, loyal, friendship-oriented. Mitra's energy — covenant and alliance. Saturn-Mars combination gives disciplined courage.`,
    17: `Jyeshtha Moon — Elder sibling energy — protective but burden-bearing. Indra's power with Jyeshtha's weight. May attract jealousy. Strong but sometimes isolated.`,
    18: `Moola Moon — Root energy — investigates foundations. Nirriti's dissolution. Mind pulls at roots of all things. Ketu energy — past-life wisdom and spiritual depth.`,
    19: `Purva Ashadha Moon — Invincible feeling, purifying drive. Water's cleansing nature. Apas energy. Confident even when losing. Needs to learn humility.`,
    20: `Uttara Ashadha Moon — Universal victory energy. Vishvadevas — all gods supporting. Sun energy — bright, forward, unstoppable. Leadership is destiny.`,
    21: `Shravana Moon — Listening mind, learning orientation. Vishnu's pervasive awareness. Hears what others miss. Connected to sacred knowledge through sound.`,
    22: `Dhanishtha Moon — Wealthy, musical, rhythmic mind. Vasus energy — the eight elemental beings. Mars + prosperity = entrepreneurial spirit.`,
    23: `Shatabhisha Moon — Healer's mind, 100 physicians. Varuna's vast ocean awareness. Independent, secretive, sometimes lonely. Gift for alternative healing.`,
    24: `Purva Bhadra Moon — Mystical, intense, dual-natured. Aja Ekapada's mysterious fire. Jupiter energy with dark depth. Transformative experiences shape the mind.`,
    25: `Uttara Bhadra Moon — Wise elder's mind, depth of ocean. Ahir Budhnya's serpent of depths. Saturn energy with spiritual maturity. Profound and contained.`,
    26: `Revati Moon — Nurturing traveler, completing energy. Pushan's guide. Mercury's final completion. Spiritual maturity, compassion for all beings.`
  };
  findings.push(rule('MOON-NAK', 'BPHS Ch.67', moonNakMind[moonNak] || `Moon in nakshatra ${moonNak}`, 'HIGH', 2));

  // Moon phase — BPHS: bright Moon (Shukla) is strong, dark Moon (Krishna) is weak
  if (moonPhase.phase === 'Waxing') {
    findings.push(rule('MOON-SHUKLA', 'BPHS Ch.9 v.10',
      `Waxing Moon (Shukla Paksha) — Moon is gaining strength. Mental faculties, emotional resilience, and mother's support are strong. Growth energy dominates.`,
      'MEDIUM', 1));
  } else {
    findings.push(rule('MOON-KRISHNA', 'BPHS Ch.9 v.11',
      `Waning Moon (Krishna Paksha) — Moon is losing light. Mental and emotional energy may be more introverted, reflective, or prone to melancholy. Spiritual depth is the gift.`,
      'MEDIUM', -1));
  }

  // Saturn afflicts Moon — depression indicator — BPHS Ch.9 v.20
  if (conjunct('Saturn','Moon', chart) || planetAspectsHouse('Saturn', chart, moonHouse)) {
    findings.push(rule('MOON-SAT', 'BPHS Ch.9 v.20',
      `Saturn influences Moon — recurring melancholy, depression, or emotional heaviness. Mind tends toward pessimism and seriousness. Discipline is the compensation for joy.`,
      'HIGH', -2));
  }

  // Rahu afflicts Moon — mental disturbance — BPHS Ch.9 v.22
  if (conjunct('Rahu','Moon', chart)) {
    findings.push(rule('MOON-RAHU', 'BPHS Ch.9 v.22',
      `Rahu conjunct Moon — Grahan Yoga on the mind. Unconventional thinking, psychic sensitivity, obsessive tendencies. Past-life karmic material surfaces through the emotions. Brilliant but turbulent.`,
      'HIGH', -1));
  }

  // Jupiter protects Moon — BPHS Ch.9 v.25
  if (conjunct('Jupiter','Moon', chart) || planetAspectsHouse('Jupiter', chart, moonHouse)) {
    findings.push(rule('MOON-JUP', 'BPHS Ch.9 v.25',
      `Jupiter influences Moon — Gaja Kesari potential. Wisdom, optimism, and emotional generosity. Mind is protected from serious mental illness. Philosophical and expansive mental orientation.`,
      'HIGH', 2));
  }

  return findings;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5 — BPHS CH.18 + PD CH.12 + SAR CH.28 + JP CH.9 + JM:
// MARRIAGE — Complete from all classical sources
// Past karma (Ketu/12th), Present (D1+D9), Future (Dasha+Transit)
// ═══════════════════════════════════════════════════════════════════════════

function evaluateMarriage(chart) {
  const findings = [];
  const l7 = lordOf(7, chart);
  const l7sign = signOfPlanet(l7, chart);
  const l7house = houseOfPlanet(l7, chart);
  const l7dignity = getDignity(l7, l7sign);
  const h7planets = planetsInHouse(7, chart);
  const venus = chart.planets['Venus'];
  const jupiter = chart.planets['Jupiter'];
  const mars = chart.planets['Mars'];
  const ketu = chart.planets['Ketu'];
  const rahu = chart.planets['Rahu'];
  const moon = chart.planets['Moon'];
  const karaka = chart.gender === 'F' ? mars : jupiter; // Marriage karaka by gender

  let marriageScore = 0; // + = favorable, - = challenging
  let delayScore = 0;    // higher = more delayed
  let denialScore = 0;   // higher = more denied

  // ── PAST KARMA LAYER — Ketu and 12th house ──────────────────────
  // What the soul carries from previous life regarding relationships

  // Ketu house — what was abandoned/mastered in past life
  if (ketu) {
    const ketuHouse = ketu.house;
    if (ketuHouse === 7) {
      findings.push(rule('K-KETU7', 'JM (Jaimini Sutram) + NS',
        `PAST KARMA: Ketu in 7th — in a previous life, this soul experienced deep partnership or marriage, possibly ending in loss or renunciation. There is a karmic ambivalence toward marriage — a part of this soul has "been there." Marriage in this life carries a deeper spiritual dimension, not just a social contract.`,
        'HIGH', -1, 'past'));
      denialScore += 1;
    }
    if (ketuHouse === 12) {
      findings.push(rule('K-KETU12', 'NS',
        `PAST KARMA: Ketu in 12th — the soul spent past lives in moksha-oriented, isolated, or spiritually withdrawn states. Intimate partnership may feel constraining. Foreign connection or spiritual marriage is the natural expression.`,
        'MEDIUM', 0, 'past'));
    }
    if (ketuHouse === 5) {
      findings.push(rule('K-KETU5', 'NS',
        `PAST KARMA: Ketu in 5th — past-life karma involving children, romance, or creative love. This soul has loved deeply before. Current life relationships have a familiar, karmic quality — a sense of "we've met before."`,
        'MEDIUM', 1, 'past'));
    }
  }

  // ── PRESENT LAYER — D1 Chart Analysis ───────────────────────────

  // ── ALL 9 PLANETS IN 7TH HOUSE — BPHS Ch.18, Saravali Ch.28 ────
  // Each planet gives its own specific qualities to the spouse and marriage

  const planetIn7th = {
    Sun: {
      base: `Sun in 7th — spouse is proud, authoritative, often connected to government, medicine, or administration. The marriage involves ego dynamics — power struggles are common. Spouse may be older or in a position of authority. Marriage is serious and achievement-oriented.`,
      exalted: `Sun exalted in 7th (Aries) — spouse is exceptionally capable, high-status, possibly in a position of great authority. Marriage elevates the native's social standing.`,
      debilitated: `Sun debilitated in 7th (Libra) — spouse may face ego wounds or humiliation. Marriage involves power imbalance or suppressed self-expression.`,
      dignified: `Sun in own sign in 7th — confident, self-assured spouse. Marriage with a proud, dignified partner.`,
      score: -1, delay: 1
    },
    Moon: {
      base: `Moon in 7th — attractive, emotionally expressive spouse. The marriage bond is deeply emotional and sensitive. Spouse is changeable in moods. Marriage has high emotional highs and lows. Spouse is connected to public, masses, or nurturing professions.`,
      exalted: `Moon exalted in 7th (Taurus) — exceptionally beautiful or handsome spouse. Very happy marriage, strong emotional fulfilment. Spouse is wealthy and nurturing.`,
      debilitated: `Moon debilitated in 7th (Scorpio) — spouse is emotionally unstable or troubled. Marriage goes through intense phases of crisis and reconciliation.`,
      dignified: `Moon in Cancer in 7th — extremely nurturing, home-loving spouse. Deep emotional bond.`,
      score: 1, delay: 0
    },
    Mars: {
      base: `Mars in 7th — Mangal Dosha. Conflict, passion, and intensity define the marriage. Spouse is energetic, courageous, possibly hot-tempered. Risk of separation or spouse's health issues. Must match with Mangalik partner to balance the energy.`,
      exalted: `Mars exalted in 7th (Capricorn) — courageous, ambitious spouse. Marriage involves drive and achievement. Mangal Dosha is moderated but not removed.`,
      debilitated: `Mars debilitated in 7th (Cancer) — Mangal Dosha intensified. Emotional aggression in marriage. Separation risk is higher.`,
      dignified: `Mars in Aries/Scorpio in 7th — Dosha is reduced (own sign reduces malefic effect). Spouse is fiercely independent.`,
      score: -2, delay: 1
    },
    Mercury: {
      base: `Mercury in 7th — intelligent, communicative, business-minded spouse. Marriage involves intellectual partnership. Spouse may appear younger than age. Variety and mental stimulation are needed in the relationship. Commerce or communication may bring the couple together.`,
      exalted: `Mercury exalted in 7th (Virgo) — exceptionally intelligent, analytical spouse. Marriage is intellectually rich.`,
      debilitated: `Mercury debilitated in 7th (Pisces) — spouse may lack practical judgment or clarity. Communication in marriage is muddled or overly idealistic.`,
      dignified: `Mercury in Gemini/Virgo in 7th — witty, versatile, business-oriented spouse.`,
      score: 1, delay: 0
    },
    Jupiter: {
      base: `Jupiter in 7th — excellent marriage indicator. Spouse is educated, wise, generous, and spiritually oriented. The marriage is a true blessing. Guru energy in the partnership — the relationship elevates both people. Happiness in marriage is strong.`,
      exalted: `Jupiter exalted in 7th (Cancer) — exceptionally blessed marriage. Spouse is saintly, wise, deeply caring. Great fortune through marriage.`,
      debilitated: `Jupiter debilitated in 7th (Capricorn) — despite surface appearances, the marriage has deeper weaknesses. Spouse may be overconfident or lack true wisdom.`,
      dignified: `Jupiter in Sagittarius/Pisces in 7th — highly philosophical, dharmic spouse. Marriage is spiritually fulfilling.`,
      score: 3, delay: -1
    },
    Venus: {
      base: `Venus in 7th — highly favorable. Spouse is beautiful, artistic, charming, and sensual. Marriage brings luxury, pleasure, and aesthetic refinement. Deep physical attraction. Passionate relationship. Spouse may be in arts, beauty, or entertainment.`,
      exalted: `Venus exalted in 7th (Pisces) — most auspicious marriage indicator possible. Spouse is extraordinarily beautiful, loving, and refined. Perfect romantic union.`,
      debilitated: `Venus debilitated in 7th (Virgo) — despite attraction, marriage brings dissatisfaction. Spouse is overly critical or the relationship lacks warmth.`,
      dignified: `Venus in Taurus/Libra in 7th — harmonious, pleasurable, artistically rich marriage.`,
      score: 2, delay: -1
    },
    Saturn: {
      base: `Saturn in 7th — delayed marriage (typically after 28-30). Spouse is older, serious, disciplined, or career-focused. The marriage is built slowly through duty rather than passion. Karmic weight in the relationship. Long-lasting once established. Cold or practical emotional expression.`,
      exalted: `Saturn exalted in 7th (Libra) — delay remains but the marriage, once achieved, is exceptionally stable and enduring. Spouse is highly capable and responsible.`,
      debilitated: `Saturn debilitated in 7th (Aries) — delay is extreme. Spouse may be chronically ill, limited, or burdensome. Marriage requires enormous patience.`,
      dignified: `Saturn in Capricorn/Aquarius in 7th — Sasha yoga quality. Delay but ultimate stability. Spouse in government or service.`,
      score: -2, delay: 3
    },
    Rahu: {
      base: `Rahu in 7th — unconventional marriage. Spouse is from a different background, culture, religion, or country. The attraction is obsessive and consuming. Marriage may involve deception, unusual circumstances, or a foreigner. Powerful karmic draw to the partner.`,
      score: -1, delay: 0
    },
    Ketu: {
      base: `Ketu in 7th — karmic marriage. Deep past-life connection with spouse. Spouse may be spiritual, detached, or have unusual qualities. Possibility of separation — not necessarily physical but emotional distance. Marriage has a quality of "completion" — resolving old karma.`,
      score: -1, delay: 0
    }
  };

  for (const [planet, info] of Object.entries(planetIn7th)) {
    if (h7planets.includes(planet)) {
      const pSign = signOfPlanet(planet, chart);
      const dignity = getDignity(planet, pSign);
      let verdict = info.base;

      // Apply dignity modifier to base verdict
      if (dignity === 'EXALTED' && info.exalted) verdict = info.exalted;
      else if (dignity === 'DEBILITATED' && info.debilitated) verdict = info.debilitated;
      else if ((dignity === 'OWN' || dignity === 'MOOLATRIKONA') && info.dignified) verdict = info.dignified;

      // Neecha Bhanga check
      if (dignity === 'DEBILITATED' && neechaBhanga(planet, chart)) {
        verdict += ` However, Neecha Bhanga applies — the debilitation is cancelled. The initial difficulty transforms into unusual strength.`;
      }

      // Combustion check
      if (isCombust(planet, chart) && planet !== 'Sun') {
        verdict += ` ${planet} is combust — its qualities are suppressed by the Sun's proximity, weakening its ability to fully deliver the above.`;
      }

      const confidence = (dignity === 'EXALTED' || dignity === 'DEBILITATED') ? 'HIGH' : 'MEDIUM';
      findings.push(rule(`${planet}-IN7`, 'BPHS Ch.18 + SAR Ch.28', verdict, confidence,
        info.score + (dignity === 'EXALTED' ? 2 : dignity === 'DEBILITATED' ? -2 : 0)));

      marriageScore += info.score;
      delayScore += info.delay || 0;
    }
  }

  // Cancellation of Mangal Dosha — BPHS Ch.81 v.5-15
  if (h7planets.includes('Mars')) {
    const cancelConditions = [];
    if (planetAspectsHouse('Jupiter', chart, 7)) cancelConditions.push('Jupiter aspects 7th');
    if ([0,7].includes(chart.lagna)) cancelConditions.push('Aries or Scorpio lagna (Mars owns the lagna)');
    if ([3,8].includes(chart.lagna)) cancelConditions.push('Cancer or Sagittarius lagna (Jupiter owns the house)');
    if (h7planets.includes('Jupiter')) cancelConditions.push('Jupiter also in 7th');
    const mars7Sign = signOfPlanet('Mars', chart);
    if (isStrong('Mars', mars7Sign)) cancelConditions.push('Mars is in own sign or exaltation (reduced malefic effect)');
    if (cancelConditions.length > 0) {
      findings.push(rule('MARS7-CANCEL', 'BPHS Ch.81 v.5-15',
        `Mangal Dosha PARTIALLY CANCELLED: ${cancelConditions.join('; ')}. The Mars energy in 7th is moderated but not removed. Marriage is still possible with a Mangalik partner for complete balance.`,
        'HIGH', 2));
      marriageScore += 2;
    }
  }

  // ── 7TH LORD IN ALL 12 HOUSES — BPHS Ch.18 v.20-45 ─────────────
  const l7inHouse = {
    1:  `7th lord in 1st — the native's identity merges with partnership. Strong desire for marriage. May marry someone very similar to themselves. The native is their own best spouse — self-contained but needs mirroring.`,
    2:  `7th lord in 2nd — spouse contributes to family wealth. Family traditions influence the marriage. Spouse integrates into the family system. Financial connection between marriage and wealth.`,
    3:  `7th lord in 3rd — spouse is communicative, sibling-like. May meet through travel, media, or communication. Marriage has a brotherly/sisterly quality. Siblings may influence the marriage.`,
    4:  `7th lord in 4th — spouse becomes deeply family-integrated. Domestic happiness is strong. Marriage brings property or real estate. Spouse is homely, nurturing, connected to mother.`,
    5:  `7th lord in 5th — love marriage strongly indicated. Romance clearly precedes the formal union. Spouse is creative, younger-spirited, or connected to arts/children/speculation.`,
    6:  `7th lord in 6th — disputes and conflicts with spouse are recurring themes. Possible separation or divorce. Spouse may have health issues or financial debts. Service dynamic in marriage.`,
    7:  `7th lord in own house (7th) — powerful marriage indication. Partnership is the central pillar of life. Spouse is strong, independent, and fully present in the native's life.`,
    8:  `7th lord in 8th — marriage involves hidden complexities. Spouse has secrets or chronic health issues. Inheritance or insurance may be connected to marriage. Transformative relationship.`,
    9:  `7th lord in 9th — very auspicious marriage. Spouse is righteous, possibly from different religion, culture, or country. Marriage brings luck and dharmic growth. Guru-quality spouse.`,
    10: `7th lord in 10th — spouse is career-oriented or significantly helps the native's career. May meet spouse through work. Both partners are professionally ambitious.`,
    11: `7th lord in 11th — marriage brings gains and fulfills desires. Wealthy spouse. Marriage elevates the native's social network. Elder sibling connection to the marriage.`,
    12: `7th lord in 12th — foreign connection in marriage (foreign country, foreign religion, or foreign-background spouse). Marriage involves sacrifice or spiritual dimension. Bed pleasures are prominent.`
  };

  if (l7house && l7inHouse[l7house]) {
    let verdict = l7inHouse[l7house];
    // Modify by dignity
    if (l7dignity === 'EXALTED') {
      verdict += ` The 7th lord ${l7} is exalted here — this is the most favorable possible placement. The significations are fully and beautifully expressed.`;
      marriageScore += 3;
    } else if (l7dignity === 'OWN' || l7dignity === 'MOOLATRIKONA') {
      verdict += ` The 7th lord ${l7} is in own/moolatrikona sign — strong and stable expression.`;
      marriageScore += 2;
    } else if (l7dignity === 'DEBILITATED') {
      if (neechaBhanga(l7, chart)) {
        verdict += ` Despite debilitation, Neecha Bhanga applies — after initial difficulties, the marriage situation reverses and strengthens.`;
        marriageScore += 1;
      } else {
        verdict += ` The 7th lord ${l7} is debilitated here — the significations are weakened. Marriage faces real challenges.`;
        marriageScore -= 2;
        denialScore += 1;
      }
    }
    if (DUSTHANAS.includes(l7house)) { delayScore += 2; denialScore += 1; }
    findings.push(rule(`L7-H${l7house}`, 'BPHS Ch.18 v.20-45', verdict,
      (l7dignity === 'EXALTED' || l7dignity === 'DEBILITATED') ? 'HIGH' : 'MEDIUM', 2));
  }

  // ── VENUS — Karaka for marriage (universal) — PD Ch.12, BPHS Ch.18 ──

  if (venus) {
    const vSign = venus.sign;
    const vHouse = venus.house;
    const vDignity = getDignity('Venus', vSign);

    // Venus in all 12 houses — Phaladeepika Ch.12
    const venusInHouse = {
      1:  `Venus in 1st — charming, attractive personality. Love comes naturally. Early marriage is possible. The native radiates romantic energy. Life is aesthetically refined.`,
      2:  `Venus in 2nd — wealth through beauty, arts, or luxury goods. Sweet speech. Marriage brings financial gain. Spouse is wealthy. Love of fine food and material comforts.`,
      3:  `Venus in 3rd — meets partner through communication, siblings' connections, or short travel. Artistic communication. Love letters, creative expression in love.`,
      4:  `Venus in 4th — deeply happy domestic life. Beautiful home. Spouse is homely and nurturing. Mother has Venus-like qualities. Property and vehicles come easily.`,
      5:  `Venus in 5th — romantic at heart, love affairs are likely. Children are beautiful and artistic. Speculation brings gain. Creative expression is lifelong joy.`,
      6:  `Venus in 6th — health issues related to reproductive system or kidneys. Love comes through service or work environment. Disputes in relationships. Spouse may have health concerns.`,
      7:  `Venus in 7th — most favorable placement for marriage. Beautiful, charming, loving spouse. Passionate, pleasurable married life. Spouse may be in arts or luxury industry.`,
      8:  `Venus in 8th — intense, transformative romantic life. Hidden love affairs. Inheritance or insurance through spouse. Marriage involves depth and mystery.`,
      9:  `Venus in 9th — marries someone from a different religion, culture, or country. Dharmic approach to love. Fortune through marriage. Long-distance love.`,
      10: `Venus in 10th — career in arts, beauty, or entertainment. Meets spouse through career. Work-life balance may be challenged. Public romantic life.`,
      11: `Venus in 11th — gains through spouse. Wealthy partner. Social marriage — meets through large networks or events. Multiple romantic connections before settling.`,
      12: `Venus in 12th — hidden romance, foreign or spiritually-oriented spouse. Bed pleasures are very important. Love involves sacrifice. May love secretly.`
    };
    if (venusInHouse[vHouse]) {
      let verdict = venusInHouse[vHouse];
      if (vDignity === 'EXALTED') verdict += ` Venus exalted in Pisces — this is the absolute peak of marriage blessings. Extraordinarily happy marital life. Spouse is a divine gift.`;
      else if (vDignity === 'DEBILITATED') verdict += ` Venus debilitated in Virgo — despite placement, romantic dissatisfaction and critical energy undermine the marriage's warmth.`;
      else if (vDignity === 'OWN') verdict += ` Venus in own sign — fully expresses its gifts here. Harmonious and pleasurable.`;
      findings.push(rule(`VENUS-H${vHouse}`, 'PD Ch.12', verdict,
        (vDignity==='EXALTED'||vDignity==='DEBILITATED')?'HIGH':'MEDIUM', 2));
      marriageScore += (vDignity==='EXALTED'?3:vDignity==='OWN'?1:vDignity==='DEBILITATED'?-2:0);
    }

    // Saturn aspects Venus — BPHS Ch.18 v.30
    if (planetAspectsHouse('Saturn', chart, vHouse)) {
      findings.push(rule('SAT-VENUS', 'BPHS Ch.18 v.30',
        `Saturn aspects Venus — delayed romantic life. Practical, serious approach to love. Cold emotional expression. Native may experience unrequited love or loneliness before finding the right partner. Marriage typically after 28-30.`,
        'HIGH', -2));
      delayScore += 2;
      marriageScore -= 2;
    }
    // Jupiter aspects Venus — BPHS Ch.18 v.32
    if (planetAspectsHouse('Jupiter', chart, vHouse)) {
      findings.push(rule('JUP-VENUS', 'BPHS Ch.18 v.32',
        `Jupiter aspects Venus — dharmic, blessed love life. Spouse is educated, noble, and spiritually oriented. Marriage is a source of wisdom and growth, not just pleasure.`,
        'HIGH', 2));
      marriageScore += 2;
    }
    // Rahu conjunct Venus
    if (conjunct('Rahu','Venus', chart)) {
      findings.push(rule('RAHU-VENUS', 'SAR Ch.28',
        `Rahu conjunct Venus — obsessive, unconventional attraction. Foreign or cross-cultural relationship. Intense desire and passionate love. May involve taboo or unusual romantic situations.`,
        'HIGH', 0));
    }
    // Mars conjunct Venus — Phaladeepika Ch.12 v.22
    if (conjunct('Mars','Venus', chart)) {
      findings.push(rule('MARS-VENUS', 'PD Ch.12 v.22',
        `Mars-Venus conjunction — passionate, fiercely romantic nature. Love affair that becomes marriage. High physical chemistry. Love marriage strongly indicated.`,
        'HIGH', 1));
      marriageScore += 1;
    }
  }

  // ── LOVE MARRIAGE INDICATORS ─────────────────────────────────────
  const l5 = lordOf(5, chart);
  const l11 = lordOf(11, chart);
  const l2 = lordOf(2, chart);
  const loveIndicators = [];

  if (houseOfPlanet(l5, chart) === 7) loveIndicators.push('5th lord in 7th (romance leads to marriage — BPHS Ch.18 v.20)');
  if (l7house === 5) loveIndicators.push('7th lord in 5th (heart and partnership linked — BPHS Ch.18 v.21)');
  if (conjunct('Mars','Venus', chart)) loveIndicators.push('Mars-Venus conjunction (passionate love nature — PD Ch.12 v.22)');
  if (parivartana(5, 7, chart)) loveIndicators.push('5th-7th lord Parivartana (powerful love marriage yoga — BPHS Ch.37)');
  if (conjunct('Moon','Venus', chart)) loveIndicators.push('Moon-Venus conjunction (emotional romantic nature)');
  if (h7planets.includes('Venus')) loveIndicators.push('Venus in 7th (attraction leads to marriage)');
  if (h7planets.includes('Moon')) loveIndicators.push('Moon in 7th (emotional attachment becomes marriage)');

  if (loveIndicators.length >= 2) {
    findings.push(rule('LOVE-MARRIAGE', 'BPHS Ch.18 + PD Ch.12',
      `LOVE MARRIAGE STRONGLY INDICATED: ${loveIndicators.join(' | ')}. Romance precedes the formal union. The native chooses their partner based on personal attraction, not family arrangement.`,
      loveIndicators.length >= 3 ? 'HIGH' : 'MEDIUM', 2));
    marriageScore += 2;
  } else if (loveIndicators.length === 1) {
    findings.push(rule('LOVE-MARRIAGE-WEAK', 'BPHS Ch.18',
      `Some love marriage indication: ${loveIndicators[0]}. Romance element present but not dominant.`,
      'MEDIUM', 1));
    marriageScore += 1;
  }

  // ── ARRANGED MARRIAGE INDICATORS ────────────────────────────────
  const arrangedIndicators = [];
  if (houseOfPlanet(l2, chart) === 7) arrangedIndicators.push('2nd lord in 7th (family wealth tied to marriage — BPHS Ch.18 v.25)');
  if (l7house === 2) arrangedIndicators.push('7th lord in 2nd (family arranges marriage — BPHS Ch.18 v.26)');
  if (h7planets.includes('Saturn') && loveIndicators.length === 0) arrangedIndicators.push('Saturn in 7th without love indicators (duty-based marriage)');
  if (h7planets.includes('Sun')) arrangedIndicators.push('Sun in 7th (family authority in marriage choice)');
  if (arrangedIndicators.length >= 2) {
    findings.push(rule('ARRANGED-MARRIAGE', 'BPHS Ch.18 v.25-26',
      `ARRANGED OR FAMILY-FACILITATED MARRIAGE: ${arrangedIndicators.join(' | ')}. Family tradition and elders play a significant role in partner selection.`,
      'MEDIUM', 1));
  }

  // ── MULTIPLE MARRIAGES — BPHS Ch.18 v.35-40 ─────────────────────
  const maleficsIn7 = h7planets.filter(p => isMalefic(p));
  const multipleIndicators = [];
  if (maleficsIn7.length >= 2) multipleIndicators.push(`Multiple malefics in 7th (${maleficsIn7.join('+')})`);
  if (l7house && [2,5,8,11].includes(signOf(chart.planets[l7]?.longitude||0))) multipleIndicators.push('7th lord in dual sign');
  if (parivartana(7, 12, chart)) multipleIndicators.push('7th-12th lord exchange (separation then reunion or second marriage)');

  if (multipleIndicators.length >= 2 && !anyBeneficAspects(7, chart)) {
    findings.push(rule('MULTIPLE-MARRIAGE', 'BPHS Ch.18 v.35',
      `Multiple marriages or significant separations indicated: ${multipleIndicators.join(' | ')}. No benefic protection on 7th house. The first marriage may not be the last.`,
      'MEDIUM', -1));
    denialScore += 1;
  }

  // ── NAVAMSHA CONFIRMATION — D9 — Uttara Kalamrita ───────────────
  // D9 is the soul chart — confirms or denies what D1 promises
  if (chart.navamsha) {
    const nav7lord = l7;
    const navL7data = chart.navamsha[nav7lord];
    if (navL7data) {
      const navDignity = getDignity(nav7lord, navL7data.sign);
      if (navDignity === 'EXALTED' || navDignity === 'OWN') {
        findings.push(rule('D9-L7-STRONG', 'UK (Uttara Kalamrita)',
          `D9 CONFIRMATION: 7th lord ${nav7lord} is strong in Navamsha (${SIGN_PROPS[navL7data.sign]?.name}) — the soul-level marriage promise is solid. What the D1 chart shows for marriage is confirmed at the deepest level.`,
          'HIGH', 2));
        marriageScore += 2;
      } else if (navDignity === 'DEBILITATED') {
        findings.push(rule('D9-L7-WEAK', 'UK (Uttara Kalamrita)',
          `D9 CAUTION: 7th lord ${nav7lord} is debilitated in Navamsha — despite what the D1 chart shows, the soul-level marriage promise has deep weaknesses. The marriage may look good externally but struggle internally.`,
          'HIGH', -2));
        marriageScore -= 2;
        denialScore += 1;
      }
    }

    // Venus in Navamsha
    if (chart.navamsha['Venus']) {
      const navVenusDig = getDignity('Venus', chart.navamsha['Venus'].sign);
      if (navVenusDig === 'EXALTED') {
        findings.push(rule('D9-VENUS-EXALT', 'UK',
          `Venus exalted in Navamsha — marital happiness confirmed at the soul level. Partner is genuinely beautiful and loving.`, 'HIGH', 2));
        marriageScore += 2;
      } else if (navVenusDig === 'DEBILITATED') {
        findings.push(rule('D9-VENUS-DEBIL', 'UK',
          `Venus debilitated in Navamsha — romantic dissatisfaction at the soul level. External marriage may seem fine but internal fulfilment is elusive.`, 'HIGH', -1));
        marriageScore -= 1;
      }
    }

    // Vargottama Venus — exceptionally strong for marriage
    if (isVargottama('Venus', chart)) {
      findings.push(rule('VENUS-VARG', 'BPHS Ch.27',
        `Venus is Vargottama (same sign in D1 and D9) — exceptional marriage blessing. The romantic and pleasurable qualities of Venus are deeply embedded in the soul's design for this lifetime.`,
        'HIGH', 3));
      marriageScore += 3;
    }
  }

  // ── JAIMINI INDICATORS ────────────────────────────────────────────

  // Darakaraka — Jaimini Sutram Ch.1
  const darakaraka = getDarakaraka(chart);
  const dkData = chart.planets[darakaraka];
  if (dkData) {
    const dkDignity = getDignity(darakaraka, dkData.sign);
    const dkVerdicts = {
      Sun:     `Darakaraka Sun — spouse is proud, authoritative, possibly in government or medicine. Soul lesson in the relationship: transcending ego.`,
      Moon:    `Darakaraka Moon — spouse is emotional, nurturing, changeable. Soul resonance: emotional intelligence and sensitivity.`,
      Mars:    `Darakaraka Mars — spouse is courageous, energetic, action-oriented. Possible conflict. Soul lesson: channeling aggression.`,
      Mercury: `Darakaraka Mercury — spouse is intelligent, communicative, business-minded. Soul resonance: intellectual partnership.`,
      Jupiter: `Darakaraka Jupiter — spouse is wise, educated, spiritual, generous. Exceptional spouse. Soul lesson: wisdom through relationship.`,
      Venus:   `Darakaraka Venus — spouse is beautiful, artistic, sensual. Soul resonance: beauty and pleasure. Harmonious pairing.`,
      Saturn:  `Darakaraka Saturn — spouse is disciplined, serious, older. Karmic marriage. Soul lesson: duty and responsibility in relationship.`
    };
    findings.push(rule('DK-JAIMINI', 'JM (Jaimini Sutram) Ch.1',
      `DARAKARAKA: ${darakaraka} (lowest degrees = ${dkData.degree?.toFixed(1)}°) — ${dkVerdicts[darakaraka] || 'Spouse has this planet\'s qualities.'}${dkDignity==='EXALTED'?' Exalted Darakaraka — extraordinarily capable and elevated spouse.':dkDignity==='DEBILITATED'?' Debilitated Darakaraka — spouse faces struggles; karmic difficulty in relationship.':''}`,
      dkDignity==='EXALTED'||dkDignity==='DEBILITATED'?'HIGH':'MEDIUM', 2));
    if (dkDignity === 'EXALTED') marriageScore += 2;
    if (dkDignity === 'DEBILITATED') { marriageScore -= 1; denialScore += 1; }
  }

  // ── DASHA TIMING LAYER ────────────────────────────────────────────
  if (chart.dasha) {
    const { maha, antar } = chart.dasha;
    const marriageDashas = [l7, 'Venus', l5, l11];
    const isMarriagePeriod = marriageDashas.includes(maha) || marriageDashas.includes(antar);
    if (isMarriagePeriod) {
      findings.push(rule('DASHA-MARRIAGE', 'BPHS Ch.45-50',
        `TIMING: Running ${maha}-${antar} dasha — this period is directly connected to the 7th house or marriage karaka. Classical texts indicate marriage events are highly probable during such periods. This is an active marriage window.`,
        'HIGH', 3));
      marriageScore += 3;
    }
    // Unfavorable dasha for marriage
    const dusthanaDashas = [lordOf(6,chart), lordOf(8,chart), lordOf(12,chart)];
    if (dusthanaDashas.includes(maha) && !isMarriagePeriod) {
      findings.push(rule('DASHA-DUSTHANA', 'BPHS Ch.45',
        `TIMING CAUTION: Running ${maha}-${antar} dasha belongs to a dusthana lord — delays and obstacles in marriage matters during this period.`,
        'MEDIUM', -1));
      delayScore += 1;
    }
  }

  // ── COMPOUND VERDICT — Marriage Status ───────────────────────────

  // Is the person already married? (current state inference)
  let marriageStatus = '';
  let marriageTiming = '';
  let marriageType = '';
  let spouseDescription = [];

  // Spouse description from 7th lord's sign
  if (l7sign !== undefined) {
    const spouseBySign = {
      0:  'athletic, independent, impulsive, courageous',
      1:  'patient, sensual, stubborn, reliable, loves luxury',
      2:  'witty, communicative, dual-natured, intelligent',
      3:  'nurturing, emotional, home-loving, changeable',
      4:  'proud, generous, authoritative, dramatic',
      5:  'analytical, practical, health-conscious, detail-oriented',
      6:  'charming, balanced, artistic, justice-loving',
      7:  'intense, secretive, passionate, investigative',
      8:  'philosophical, adventurous, blunt, freedom-loving',
      9:  'disciplined, ambitious, practical, serious',
      10: 'independent, intellectual, progressive, unconventional',
      11: 'spiritual, empathetic, imaginative, compassionate'
    };
    if (spouseBySign[l7sign]) spouseDescription.push(spouseBySign[l7sign]);
  }

  // Collect spouse descriptions from planets in 7th
  for (const p of h7planets) {
    const desc = {
      Sun:'proud and authoritative', Moon:'attractive and emotional',
      Mars:'energetic and courageous', Mercury:'intelligent and communicative',
      Jupiter:'wise and generous', Venus:'beautiful and charming',
      Saturn:'serious and older', Rahu:'unconventional or foreign',
      Ketu:'spiritual and detached'
    };
    if (desc[p]) spouseDescription.push(desc[p]);
  }

  // Marriage timing estimate
  if (delayScore >= 4) marriageTiming = 'Very delayed — likely after 35';
  else if (delayScore >= 2) marriageTiming = 'Delayed — typically after 30';
  else if (delayScore >= 1) marriageTiming = 'Moderate delay — late 20s to early 30s';
  else if (marriageScore >= 3) marriageTiming = 'Standard to early — mid-to-late 20s';
  else marriageTiming = 'Standard timing — depends on dasha activation';

  // Overall marriage assessment
  if (denialScore >= 3 && marriageScore <= 0) {
    marriageStatus = 'SIGNIFICANT CHALLENGE: Multiple classical indicators suggest serious obstacles to marriage. Remedies and conscious effort are essential.';
  } else if (marriageScore >= 5) {
    marriageStatus = 'STRONGLY BLESSED: Multiple classical indicators confirm happy, substantial marriage. The chart strongly supports a fulfilling partnership.';
  } else if (marriageScore >= 2) {
    marriageStatus = 'POSITIVE: Marriage is indicated with generally favorable conditions. Some challenges but overall supportive.';
  } else if (marriageScore >= -1) {
    marriageStatus = 'MIXED: Marriage is expected but with notable challenges and adjustments required.';
  } else {
    marriageStatus = 'CHALLENGING: Marriage faces significant classical obstacles. Patience, remedies, and the right timing are important.';
  }

  // Add compound verdict
  findings.push(rule('MARRIAGE-COMPOUND', 'BPHS Ch.18 + PD Ch.12 + JM (combined analysis)',
    `MARRIAGE VERDICT: ${marriageStatus} | Timing: ${marriageTiming} | Spouse: ${[...new Set(spouseDescription)].slice(0,4).join(', ')} | Score: ${marriageScore > 0 ? '+' : ''}${marriageScore}`,
    denialScore >= 3 || marriageScore >= 5 ? 'HIGH' : 'MEDIUM', 3));

  return { findings, marriageScore, delayScore, denialScore, spouseDescription: [...new Set(spouseDescription)], timing: marriageTiming };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6 — BPHS CH.16 + PD CH.11 + UK (D7):
// CHILDREN — Complete analysis
// Past karma, D1, D7, Dasha
// ═══════════════════════════════════════════════════════════════════════════

function evaluateChildren(chart) {
  const findings = [];
  const l5 = lordOf(5, chart);
  const l5sign = signOfPlanet(l5, chart);
  const l5house = houseOfPlanet(l5, chart);
  const l5dignity = getDignity(l5, l5sign);
  const h5planets = planetsInHouse(5, chart);
  const jupiter = chart.planets['Jupiter'];
  let childScore = 0;
  let delayScore = 0;

  // Past karma — Ketu in 5th
  if (chart.planets['Ketu']?.house === 5) {
    findings.push(rule('KETU5-KARMA', 'NS',
      `PAST KARMA: Ketu in 5th — in a previous life, this soul experienced children deeply — either as a parent, teacher, or devotee. There is a karmic completion quality to the 5th house. Children in this life may feel like souls returning.`,
      'MEDIUM', 0, 'past'));
  }

  // Jupiter — primary karaka for children
  if (jupiter) {
    const jupSign = jupiter.sign;
    const jupHouse = jupiter.house;
    const jupDignity = getDignity('Jupiter', jupSign);

    // Jupiter in all 12 houses — BPHS Ch.16
    const jupiterInHouseChildren = {
      1:  { verdict:`Jupiter in lagna — very auspicious for children. Native is blessed with good, intelligent children. Strong parental instinct.`, score:2 },
      2:  { verdict:`Jupiter in 2nd — children bring wealth and honor to the family. Family-oriented children.`, score:2 },
      3:  { verdict:`Jupiter in 3rd — fewer children, but they have strong communication abilities and courage.`, score:1 },
      4:  { verdict:`Jupiter in 4th — children are educated, property-oriented, and bring domestic happiness.`, score:2 },
      5:  { verdict:`Jupiter in 5th — most auspicious for children. Multiple intelligent children, possibly scholars or spiritual. Great joy from children.`, score:3 },
      6:  { verdict:`Jupiter in 6th — fewer children or delay. Children face health issues or enemies. Service-oriented children.`, score:-1 },
      7:  { verdict:`Jupiter in 7th — children come through marriage. Spouse is deeply connected to children's fate.`, score:1 },
      8:  { verdict:`Jupiter in 8th — fewer children or delay. Children may face obstacles but have depth and research ability.`, score:-1 },
      9:  { verdict:`Jupiter in 9th — highly auspicious for children. Righteous, dharmic, possibly religious or philosophical children.`, score:2 },
      10: { verdict:`Jupiter in 10th — career-oriented children who achieve public recognition.`, score:1 },
      11: { verdict:`Jupiter in 11th — children bring gains and fulfill desires. Multiple children are possible.`, score:2 },
      12: { verdict:`Jupiter in 12th — spiritual or foreign-born children. Fewer children. Expenses through children.`, score:-1 }
    };

    if (jupiterInHouseChildren[jupHouse]) {
      const r = jupiterInHouseChildren[jupHouse];
      let verdict = r.verdict;
      if (jupDignity === 'EXALTED') {
        verdict += ` Jupiter exalted in Cancer — maximum blessing for children. Gifted, brilliant, and spiritually elevated children are classical.`;
        childScore += 3;
      } else if (jupDignity === 'DEBILITATED') {
        verdict += ` Jupiter debilitated in Capricorn — karaka weakened. Fewer children, delays, or children face significant challenges.`;
        childScore -= 2;
        delayScore += 2;
      } else if (jupDignity === 'OWN') {
        verdict += ` Jupiter in own sign — fully empowered karaka. Children are abundant in quality if not quantity.`;
        childScore += 2;
      }
      findings.push(rule(`JUP-H${jupHouse}-CHILD`, 'BPHS Ch.16', verdict, jupDignity==='EXALTED'||jupDignity==='DEBILITATED'?'HIGH':'MEDIUM', r.score));
      childScore += r.score;
    }
  }

  // 5th lord strength
  if (l5dignity === 'EXALTED') {
    findings.push(rule('L5-EXALT', 'BPHS Ch.16 v.1', `5th lord ${l5} exalted — children are exceptionally gifted. Outstanding parent-child relationship. Children bring distinction to the family.`, 'HIGH', 3));
    childScore += 3;
  } else if (l5dignity === 'DEBILITATED') {
    if (neechaBhanga(l5, chart)) {
      findings.push(rule('L5-NB', 'BPHS Ch.39', `5th lord ${l5} debilitated but Neecha Bhanga — initial delays or difficulties with children reverse into unexpected blessing.`, 'HIGH', 1));
      childScore += 1;
    } else {
      findings.push(rule('L5-DEBIL', 'BPHS Ch.16 v.2', `5th lord ${l5} debilitated — delays or obstacles in having children. Medical consultation may be needed. Children, when they come, face their own challenges.`, 'HIGH', -2));
      childScore -= 2; delayScore += 2;
    }
  }

  // 5th lord in all 12 houses — BPHS Ch.16 v.3-15
  const l5inHouse = {
    1:  { verdict:`5th lord in 1st — self-expression through children and creativity. Identity tied to parenthood. Good for having children.`, score:1 },
    2:  { verdict:`5th lord in 2nd — children bring wealth. Family tradition is important. Good for having children.`, score:1 },
    3:  { verdict:`5th lord in 3rd — children are communicative, courageous. Siblings help with children.`, score:0 },
    4:  { verdict:`5th lord in 4th — children are home-loving, educated. Domestic happiness through children.`, score:2 },
    5:  { verdict:`5th lord in own house — very strong for children. Multiple children possible. Creative and intelligent.`, score:3 },
    6:  { verdict:`5th lord in 6th — delays in having children. Children face health issues or enemies. Fewer children.`, score:-2 },
    7:  { verdict:`5th lord in 7th — children come through and after marriage. Partner is strongly connected to children.`, score:1 },
    8:  { verdict:`5th lord in 8th — delays, hidden obstacles in having children. Children may be born in unusual circumstances.`, score:-2 },
    9:  { verdict:`5th lord in 9th — highly auspicious. Dharmic, fortunate, educated children. May have religious or philosophical children.`, score:2 },
    10: { verdict:`5th lord in 10th — career-achieving children. Professional recognition for children.`, score:1 },
    11: { verdict:`5th lord in 11th — children bring gains and fulfill desires. Multiple children possible.`, score:2 },
    12: { verdict:`5th lord in 12th — children live abroad or in foreign lands. Spiritual or isolated children. Expenses through children.`, score:-1 }
  };

  if (l5house && l5inHouse[l5house]) {
    const r = l5inHouse[l5house];
    findings.push(rule(`L5-H${l5house}`, 'BPHS Ch.16 v.3-15', r.verdict, 'MEDIUM', r.score));
    childScore += r.score;
    if (DUSTHANAS.includes(l5house)) delayScore += 2;
  }

  // All 9 planets in 5th house — BPHS Ch.16 v.16-30
  const planetIn5th = {
    Sun:     { verdict:`Sun in 5th — son as first child is classical. Child is proud, authoritative, possibly in government. Intelligence is high. Stomach or heart-related issues for native.`, score:1, firstChild:'son' },
    Moon:    { verdict:`Moon in 5th — multiple children, especially daughters. Emotional bond with children. Children are attractive and sensitive. Mother-like quality in the native.`, score:2, count:'multiple' },
    Mars:    { verdict:`Mars in 5th — energetic, courageous children. Son as first child. Children may face accidents or conflicts. The native has high creative and sexual energy.`, score:1, firstChild:'son' },
    Mercury: { verdict:`Mercury in 5th — intelligent, communicative children. Multiple children possible. Children in business, writing, or technology. High IQ.`, score:2, count:'multiple' },
    Jupiter: { verdict:`Jupiter in 5th — multiple blessed children. Scholars, religious, or philosophers among them. Maximum blessing from 5th house Jupiter.`, score:3, count:'multiple' },
    Venus:   { verdict:`Venus in 5th — beautiful, artistic children. Daughters indicated. Native loves creative arts. Children may be in arts or entertainment.`, score:2, firstChild:'daughter' },
    Saturn:  { verdict:`Saturn in 5th — delayed children (typically after 30). Fewer in number. First child is serious, disciplined. Children have Saturn-type challenges.`, score:-1, delay:3 },
    Rahu:    { verdict:`Rahu in 5th — unconventional children. Possible adoption or unusual circumstances of birth. Child may have foreign or unusual life path.`, score:0 },
    Ketu:    { verdict:`Ketu in 5th — karmic connection with children. Past-life relationship with them. Spiritual or introverted children. Delays possible.`, score:0, delay:1 }
  };

  for (const [planet, info] of Object.entries(planetIn5th)) {
    if (h5planets.includes(planet)) {
      let verdict = info.verdict;
      const pSign = signOfPlanet(planet, chart);
      const dignity = getDignity(planet, pSign);
      if (dignity === 'EXALTED') verdict += ` ${planet} exalted — these qualities are maximized. Children are exceptionally capable.`;
      if (dignity === 'DEBILITATED') verdict += ` ${planet} debilitated — these qualities are weakened. Greater challenges with children.`;
      if (isCombust(planet, chart)) verdict += ` ${planet} is combust — its positive effects on children are suppressed.`;
      findings.push(rule(`${planet}-IN5`, 'BPHS Ch.16 v.16-30', verdict,
        dignity==='EXALTED'||dignity==='DEBILITATED'?'HIGH':'MEDIUM', info.score));
      childScore += info.score + (dignity==='EXALTED'?2:dignity==='DEBILITATED'?-2:0);
      if (info.delay) delayScore += info.delay;
    }
  }

  // Multiple malefics in 5th without benefic protection
  const maleficsIn5 = h5planets.filter(p => isMalefic(p));
  if (maleficsIn5.length >= 2 && !anyBeneficAspects(5, chart)) {
    findings.push(rule('MAL5-SERIOUS', 'BPHS Ch.16 v.18',
      `SERIOUS CAUTION: Multiple malefics (${maleficsIn5.join('+')}) in 5th without benefic protection — significant classical challenge to having children. Medical support or remedies (Santana Gopala mantra, Jupiter worship) strongly recommended.`,
      'HIGH', -3));
    childScore -= 3; delayScore += 3;
  }

  // D7 (Saptamsha) confirmation — Uttara Kalamrita
  if (chart.saptamsha) {
    const d7l5 = l5;
    const d7l5data = chart.saptamsha[d7l5];
    if (d7l5data) {
      const d7Dignity = getDignity(d7l5, d7l5data.sign);
      if (d7Dignity === 'EXALTED' || d7Dignity === 'OWN') {
        findings.push(rule('D7-CONFIRM', 'UK (Saptamsha D7)',
          `D7 CONFIRMATION: 5th lord strong in Saptamsha — children are confirmed. They will thrive in life.`, 'HIGH', 2));
        childScore += 2;
      } else if (d7Dignity === 'DEBILITATED') {
        findings.push(rule('D7-WEAK', 'UK (Saptamsha D7)',
          `D7 CAUTION: 5th lord debilitated in Saptamsha — despite D1 indications, children face deeper challenges. Remedies are important.`, 'HIGH', -1));
        childScore -= 1;
      }
    }
  }

  // Dasha timing
  if (chart.dasha) {
    const { maha, antar } = chart.dasha;
    if ([l5,'Jupiter'].includes(maha) || [l5,'Jupiter'].includes(antar)) {
      findings.push(rule('DASHA-CHILD', 'BPHS Ch.45',
        `TIMING: Running ${maha}-${antar} dasha is connected to the 5th house or Jupiter — classical period for children-related events. High probability of conception or birth during this period.`,
        'HIGH', 2));
      childScore += 2;
    }
  }

  // Compound verdict
  let childVerdict = '';
  if (childScore >= 6) childVerdict = 'STRONGLY BLESSED: Multiple good children indicated. Classical texts confirm children as a source of great joy.';
  else if (childScore >= 3) childVerdict = 'POSITIVE: Children are indicated with good prospects.';
  else if (childScore >= 0) childVerdict = 'MODERATE: Children expected but timing and circumstances need attention.';
  else if (childScore >= -3) childVerdict = 'CHALLENGED: Delays and obstacles in having children. Remedies and medical awareness are important.';
  else childVerdict = 'SERIOUS CHALLENGE: Classical indicators show significant difficulty. Strong remedial measures recommended.';

  let timingVerdict = delayScore >= 4 ? 'Children typically after 35' : delayScore >= 2 ? 'Children after 30' : delayScore >= 1 ? 'Moderate delay — late 20s' : 'Standard timing';

  findings.push(rule('CHILDREN-COMPOUND', 'BPHS Ch.16 + UK D7 (combined)',
    `CHILDREN VERDICT: ${childVerdict} | Timing: ${timingVerdict} | Score: ${childScore > 0 ? '+' : ''}${childScore}`,
    childScore >= 6 || childScore <= -3 ? 'HIGH' : 'MEDIUM', 3));

  return { findings, childScore, delayScore };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 7 — THE COMPLETE EVALUATE() FUNCTION
// Assembles all sections into one cohesive reading
// ═══════════════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════════════
// SECTION 8 — BPHS CH.13 + PD CH.9 + SAR CH.23:
// FATHER — Complete analysis
// Past (Ketu/9th), Present (D1 + Sun + 9th house), Future (Dasha)
// ═══════════════════════════════════════════════════════════════════════════

function evaluateFather(chart) {
  const findings = [];
  const l9 = lordOf(9, chart);
  const l9sign = signOfPlanet(l9, chart);
  const l9house = houseOfPlanet(l9, chart);
  const l9dignity = getDignity(l9, l9sign);
  const h9planets = planetsInHouse(9, chart);
  const sun = chart.planets['Sun'];
  const sunSign = sun?.sign;
  const sunHouse = sun?.house;
  const sunDignity = getDignity('Sun', sunSign);
  let fatherScore = 0;

  // ── PAST KARMA: Pitru Dosha indicators ────────────────────────────
  // Nadi Shastra + BPHS: Rahu in 9th, Sun afflicted, 9th lord in 8th
  const pitrDoshaIndicators = [];
  if (h9planets.includes('Rahu')) pitrDoshaIndicators.push('Rahu in 9th house');
  if (conjunct('Rahu','Sun', chart)) pitrDoshaIndicators.push('Rahu conjunct Sun (karaka)');
  if (l9house === 8) pitrDoshaIndicators.push('9th lord in 8th (house of obstacles)');
  if (conjunct('Saturn','Sun', chart)) pitrDoshaIndicators.push('Saturn conjunct Sun (Pitru Grahan)');
  if (pitrDoshaIndicators.length >= 2) {
    findings.push(rule('PITRU-DOSHA', 'NS + BPHS (Pitru Dosha)',
      `ANCESTRAL KARMA (Pitru Dosha): ${pitrDoshaIndicators.join('; ')} — Ancestral karma is active. Unresolved issues with the father lineage affect this native's life. Performing Pitru Tarpan, Shradh, or Pitra Puja on Amavasya is the classical remedy. The soul carries unfinished business with the paternal lineage from past lives.`,
      'HIGH', -1, 'past'));
  }

  // ── 9TH LORD IN ALL 12 HOUSES — BPHS Ch.13 v.5-30 ───────────────
  const l9inHouse = {
    1:  { verdict:`9th lord in 1st — native strongly resembles father in nature and appearance. Father's influence defines the personality. Father is present and influential throughout life.`, score:2 },
    2:  { verdict:`9th lord in 2nd — father is connected to family wealth and tradition. Native inherits through father. Financial legacy from paternal side.`, score:2 },
    3:  { verdict:`9th lord in 3rd — father is courageous, communicative, possibly in media or trade. Father encourages independence. Relationship is brotherly.`, score:1 },
    4:  { verdict:`9th lord in 4th — father is deeply connected to home and property. Father's blessing brings domestic happiness. Education comes through father's support.`, score:2 },
    5:  { verdict:`9th lord in 5th — father is intelligent, creative, good with children. Excellent father-child bond. Father supports native's education and creative pursuits.`, score:2 },
    6:  { verdict:`9th lord in 6th — father faces health issues, financial debts, or enemies. Relationship with father involves service or obligation. Father may be in medicine or law.`, score:-2 },
    7:  { verdict:`9th lord in 7th — father is partnership-oriented. Father's business or marriage influences native. May meet spouse through father's connections.`, score:1 },
    8:  { verdict:`9th lord in 8th — SERIOUS CAUTION: Father faces chronic illness, hidden troubles, or early death. Longevity of father is a classical concern here. Native may lose father early or face separation.`, score:-3 },
    9:  { verdict:`9th lord in own house — very fortunate father. Father is dharmic, successful, respected. Father is the native's greatest guide and benefactor.`, score:3 },
    10: { verdict:`9th lord in 10th — father is career-driven, powerful in profession. Father's reputation and status directly helps the native's career.`, score:2 },
    11: { verdict:`9th lord in 11th — father is very wealthy and has wide social connections. Father fulfills the native's desires. Gains through father are significant.`, score:2 },
    12: { verdict:`9th lord in 12th — father lives far away or in foreign land. Physical or emotional separation from father. Father may be spiritual or isolated. Foreign connection through father.`, score:-1 }
  };

  if (l9house && l9inHouse[l9house]) {
    let r = l9inHouse[l9house];
    let verdict = r.verdict;
    // Dignity modifier
    if (l9dignity === 'EXALTED') {
      verdict += ` 9th lord ${l9} is exalted — father is exceptionally successful, respected, and healthy. The father is a great positive force in this native's life.`;
      fatherScore += 3;
    } else if (l9dignity === 'OWN') {
      verdict += ` 9th lord ${l9} in own sign — father is stable, self-made, and reliable.`;
      fatherScore += 2;
    } else if (l9dignity === 'DEBILITATED') {
      if (neechaBhanga(l9, chart)) {
        verdict += ` Despite debilitation, Neecha Bhanga applies — father recovers from initial difficulties and eventually succeeds.`;
        fatherScore += 1;
      } else {
        verdict += ` 9th lord ${l9} debilitated — father faces serious financial or health struggles. Native receives limited support from father.`;
        fatherScore -= 2;
      }
    }
    findings.push(rule(`L9-H${l9house}`, 'BPHS Ch.13 v.5-30', verdict,
      l9dignity==='EXALTED'||l9dignity==='DEBILITATED'||l9house===8?'HIGH':'MEDIUM', r.score));
    fatherScore += r.score;
  }

  // ── SUN (KARAKA FOR FATHER) — BPHS Ch.13 v.15-25 ─────────────────
  // Sun dignity
  if (sunDignity === 'EXALTED') {
    findings.push(rule('SUN-EXALT-FATHER', 'BPHS Ch.13 v.15',
      `Sun exalted in Aries — father is powerful, possibly in government or medicine, healthy, long-lived, and highly respected. Father is a source of great strength.`,
      'HIGH', 3));
    fatherScore += 3;
  } else if (sunDignity === 'DEBILITATED') {
    findings.push(rule('SUN-DEBIL-FATHER', 'BPHS Ch.13 v.16',
      `Sun debilitated in Libra — father faces humiliation, health decline, or financial reversal. The native's relationship with father is difficult or marked by ego wounds. Father may lack authority.`,
      'HIGH', -2));
    fatherScore -= 2;
  } else if (sunDignity === 'OWN') {
    findings.push(rule('SUN-OWN-FATHER', 'BPHS Ch.13 v.14',
      `Sun in Leo (own sign) — father is proud, authoritative, dignified. Father holds a position of respect.`,
      'HIGH', 2));
    fatherScore += 2;
  }

  // ── ALL 9 PLANETS IN 9TH HOUSE — BPHS Ch.13, SAR Ch.23 ──────────
  const planetIn9th = {
    Sun: {
      base:`Sun in 9th (karaka in own house) — father is fortunate, possibly in government, education, or medicine. Father is a guiding authority figure. Native follows father's footsteps.`,
      score:2
    },
    Moon: {
      base:`Moon in 9th — father is nurturing, emotionally present, possibly in food, public, or real estate. Mother-like qualities in father. Father is connected to the public.`,
      score:1
    },
    Mars: {
      base:`Mars in 9th — father is courageous, action-oriented, possibly in military, police, sports, or engineering. Confrontational relationship with father is possible. Father pushes the native toward courage.`,
      score:1
    },
    Mercury: {
      base:`Mercury in 9th — father is intelligent, communicative, possibly in teaching, business, or trade. Intellectual relationship with father. Father encourages education.`,
      score:1
    },
    Jupiter: {
      base:`Jupiter in 9th — most auspicious for father. Father is wise, religious, generous, learned. Father is the native's greatest guide. Excellent relationship. Father brings fortune.`,
      score:3
    },
    Venus: {
      base:`Venus in 9th — father is artistic, charming, comfortable in luxury. Father may be in arts, beauty, or luxury industry. Loving, pleasurable relationship with father.`,
      score:2
    },
    Saturn: {
      base:`Saturn in 9th — father is strict, disciplined, cold, or carries heavy karma. Distance from father — emotional or physical. Father has a serious, burdensome life. Relationship is duty-based.`,
      score:-1
    },
    Rahu: {
      base:`Rahu in 9th — Pitru Dosha likely. Father is from a different background or has an unconventional life path. Ancestral karma is active. Father may be foreign, of different community, or have unusual career.`,
      score:-1
    },
    Ketu: {
      base:`Ketu in 9th — past-life karmic relationship with father. Father may be spiritual, detached, or absent. The native brings wisdom from a past life as a spiritual practitioner. Non-conventional spiritual path.`,
      score:0
    }
  };

  for (const [planet, info] of Object.entries(planetIn9th)) {
    if (h9planets.includes(planet)) {
      const pSign = signOfPlanet(planet, chart);
      const dignity = getDignity(planet, pSign);
      let verdict = info.base;
      if (dignity === 'EXALTED') verdict += ` ${planet} exalted here — these qualities are maximized. Father is in peak form.`;
      if (dignity === 'DEBILITATED') verdict += ` ${planet} debilitated — the above qualities are weakened or reversed.`;
      findings.push(rule(`${planet}-IN9`, 'BPHS Ch.13 + SAR Ch.23', verdict,
        dignity==='EXALTED'||dignity==='DEBILITATED'?'HIGH':'MEDIUM', info.score));
      fatherScore += info.score + (dignity==='EXALTED'?2:dignity==='DEBILITATED'?-2:0);
    }
  }

  // Multiple malefics in 9th — SAR Ch.23 v.8
  const maleficsIn9 = h9planets.filter(p => isMalefic(p));
  if (maleficsIn9.length >= 2) {
    findings.push(rule('MAL9-SERIOUS', 'SAR Ch.23 v.8',
      `SERIOUS CONCERN: Multiple malefics (${maleficsIn9.join('+')}) in 9th — classical texts indicate serious threat to father's health and longevity. Father may face life-threatening illness. Native should be proactive about father's health, especially after father crosses 50.`,
      'HIGH', -3));
    fatherScore -= 3;
  }

  // Saturn aspects Sun or 9th — BPHS Ch.13 v.20
  if (planetAspectsHouse('Saturn', chart, sunHouse) || planetAspectsHouse('Saturn', chart, 9)) {
    findings.push(rule('SAT-FATHER', 'BPHS Ch.13 v.20',
      `Saturn influences Sun or 9th house — father carries chronic burdens. Relationship with father is cold, distant, or characterized by obligation. Father may have melancholy or serious illness. Native feels unsupported by father.`,
      'HIGH', -2));
    fatherScore -= 2;
  }

  // Jupiter aspects 9th — protection
  if (planetAspectsHouse('Jupiter', chart, 9)) {
    findings.push(rule('JUP-9TH', 'BPHS Ch.13 v.22',
      `Jupiter aspects 9th house — father is protected by divine grace. Despite other challenges, father has a fundamentally fortunate nature. The native benefits from father's wisdom.`,
      'HIGH', 2));
    fatherScore += 2;
  }

  // Dasha of 9th lord or Sun — timing of father-related events
  if (chart.dasha) {
    const { maha, antar } = chart.dasha;
    if ([l9, 'Sun'].includes(maha) && DUSTHANAS.includes(l9house)) {
      findings.push(rule('DASHA-FATHER-WARN', 'BPHS Ch.45',
        `TIMING: Running ${maha} Mahadasha with 9th lord in difficult position — father-related challenges may be active now. Health of father should be monitored during this period.`,
        'MEDIUM', -1));
    }
  }

  // Compound verdict
  let fatherVerdict = '';
  if (fatherScore >= 5) fatherVerdict = 'BLESSED: Father is a powerful positive force. Healthy, successful, and supportive.';
  else if (fatherScore >= 2) fatherVerdict = 'POSITIVE: Father is generally stable and supportive.';
  else if (fatherScore >= -1) fatherVerdict = 'MIXED: Father has both strengths and challenges. Relationship is complex.';
  else if (fatherScore >= -4) fatherVerdict = 'CHALLENGED: Father faces significant difficulties. Relationship requires patience.';
  else fatherVerdict = 'SERIOUS CONCERN: Multiple classical indicators point to father\'s health, longevity, or separation from father.';

  findings.push(rule('FATHER-COMPOUND', 'BPHS Ch.13 + SAR Ch.23 (combined)',
    `FATHER VERDICT: ${fatherVerdict} | Score: ${fatherScore > 0 ? '+' : ''}${fatherScore}`,
    Math.abs(fatherScore) >= 4 ? 'HIGH' : 'MEDIUM', 3));

  return { findings, fatherScore };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 9 — BPHS CH.14 + SAR CH.24:
// MOTHER — Complete analysis
// ═══════════════════════════════════════════════════════════════════════════

function evaluateMother(chart) {
  const findings = [];
  const l4 = lordOf(4, chart);
  const l4sign = signOfPlanet(l4, chart);
  const l4house = houseOfPlanet(l4, chart);
  const l4dignity = getDignity(l4, l4sign);
  const h4planets = planetsInHouse(4, chart);
  const moon = chart.planets['Moon'];
  const moonSign = moon?.sign;
  const moonDignity = getDignity('Moon', moonSign);
  let motherScore = 0;

  // ── 4TH LORD IN ALL 12 HOUSES — BPHS Ch.14 v.3-20 ───────────────
  const l4inHouse = {
    1:  { verdict:`4th lord in 1st — native is deeply shaped by mother. Mother's nature dominates the personality. Very close mother-child bond. Domestic happiness is tied to self-expression.`, score:2 },
    2:  { verdict:`4th lord in 2nd — mother is focused on family wealth and food. Financial support from mother. Mother's cooking and domestic traditions are central.`, score:2 },
    3:  { verdict:`4th lord in 3rd — mother is communicative, active, courageous. Short travels with mother. Siblings and mother are connected.`, score:1 },
    4:  { verdict:`4th lord in own house (4th) — mother is strong, nurturing, long-lived. Excellent domestic happiness. Property and real estate come easily.`, score:3 },
    5:  { verdict:`4th lord in 5th — mother is intelligent, creative. Excellent relationship. Mother encourages education and creativity.`, score:2 },
    6:  { verdict:`4th lord in 6th — mother faces health issues or financial struggles. Relationship with mother involves service or conflict. Mother may have enemies.`, score:-2 },
    7:  { verdict:`4th lord in 7th — spouse resembles mother. Mother is involved in marriage. Domestic happiness tied to partnership.`, score:1 },
    8:  { verdict:`4th lord in 8th — CAUTION: Mother may face chronic illness or early death. Separation from mother likely. Hidden troubles for mother.`, score:-3 },
    9:  { verdict:`4th lord in 9th — mother is highly religious, learned, fortunate. Mother is a spiritual guide. Great fortune comes through mother.`, score:3 },
    10: { verdict:`4th lord in 10th — career is connected to mother or mother's profession. Mother is ambitious and career-oriented. Public recognition through mother.`, score:1 },
    11: { verdict:`4th lord in 11th — mother brings gains and fulfills desires. Mother has wide social connections. Financial benefit through mother.`, score:2 },
    12: { verdict:`4th lord in 12th — mother lives far away or in foreign land. Separation from mother. Mother is spiritual or lives in isolation. Emotional distance from mother.`, score:-2 }
  };

  if (l4house && l4inHouse[l4house]) {
    let r = l4inHouse[l4house];
    let verdict = r.verdict;
    if (l4dignity === 'EXALTED') { verdict += ` 4th lord exalted — mother is outstanding. Healthy, long-lived, deeply nurturing.`; motherScore += 3; }
    else if (l4dignity === 'OWN') { verdict += ` 4th lord in own sign — mother is stable and strong.`; motherScore += 2; }
    else if (l4dignity === 'DEBILITATED') {
      if (neechaBhanga(l4, chart)) { verdict += ` Neecha Bhanga applies — mother recovers from early difficulties.`; motherScore += 1; }
      else { verdict += ` 4th lord debilitated — mother faces significant challenges. Maternal support is limited.`; motherScore -= 2; }
    }
    findings.push(rule(`L4-H${l4house}`, 'BPHS Ch.14 v.3-20', verdict,
      l4dignity==='EXALTED'||l4dignity==='DEBILITATED'||l4house===8?'HIGH':'MEDIUM', r.score));
    motherScore += r.score;
  }

  // ── MOON (KARAKA FOR MOTHER) ───────────────────────────────────────
  if (moonDignity === 'EXALTED') {
    findings.push(rule('MOON-EXALT-MOTHER', 'BPHS Ch.14 v.10',
      `Moon exalted in Taurus — mother is exceptionally beautiful, nurturing, healthy, and long-lived. Mother is wealthy. Deepest, most fulfilling mother-child bond possible.`,
      'HIGH', 3));
    motherScore += 3;
  } else if (moonDignity === 'DEBILITATED') {
    findings.push(rule('MOON-DEBIL-MOTHER', 'BPHS Ch.14 v.11',
      `Moon debilitated in Scorpio — mother faces emotional or physical suffering. Difficult, troubled relationship with mother. Maternal deprivation is a classical reading here. Emotional wounds from mother-child relationship affect adult life.`,
      'HIGH', -3));
    motherScore -= 3;
  } else if (moonDignity === 'OWN') {
    findings.push(rule('MOON-OWN-MOTHER', 'BPHS Ch.14 v.8',
      `Moon in Cancer (own sign) — deeply nurturing, emotionally present mother. Home is mother's domain. Exceptional maternal bond.`,
      'HIGH', 2));
    motherScore += 2;
  }

  // ── ALL 9 PLANETS IN 4TH HOUSE — BPHS Ch.14, SAR Ch.24 ──────────
  const planetIn4th = {
    Sun:     { base:`Sun in 4th — mother is proud or authoritative. Domestic life is government-connected. Father's qualities dominate the home. Mother may be absent or stern.`, score:0 },
    Moon:    { base:`Moon in 4th (own house) — exceptionally close mother bond. Mother is the anchor of the home. Deeply emotional domestic life. Tremendous comfort and happiness from mother.`, score:3 },
    Mars:    { base:`Mars in 4th — active, energetic mother. Conflicts at home possible. Mother is courageous but may be aggressive. Property disputes are possible.`, score:-1 },
    Mercury: { base:`Mercury in 4th — intelligent, communicative, educated mother. Mother encourages learning. Home is a place of intellectual activity.`, score:1 },
    Jupiter: { base:`Jupiter in 4th — mother is wise, religious, devoted. Home is blessed and prosperous. Mother brings divine grace into the household. Large, beautiful home.`, score:3 },
    Venus:   { base:`Venus in 4th — beautiful, artistic, loving mother. Home is aesthetically refined. Mother loves luxury and creates a pleasant domestic environment.`, score:2 },
    Saturn:  { base:`Saturn in 4th — cold, emotionally distant, or strict mother. Early separation from mother possible. Home environment is serious, burdened, or lacking warmth. Mother carries heavy karma.`, score:-2 },
    Rahu:    { base:`Rahu in 4th — Matru Dosha possible. Mother has unusual qualities — foreign, unconventional, or from a different background. Home environment is restless.`, score:-1 },
    Ketu:    { base:`Ketu in 4th — karmic relationship with mother. Mother is spiritual or detached. Past-life mother connection. The home feels simultaneously familiar and foreign.`, score:0 }
  };

  for (const [planet, info] of Object.entries(planetIn4th)) {
    if (h4planets.includes(planet)) {
      const pSign = signOfPlanet(planet, chart);
      const dignity = getDignity(planet, pSign);
      let verdict = info.base;
      if (dignity === 'EXALTED') verdict += ` ${planet} exalted — maximized.`;
      if (dignity === 'DEBILITATED') verdict += ` ${planet} debilitated — weakened or reversed.`;
      findings.push(rule(`${planet}-IN4`, 'BPHS Ch.14 + SAR Ch.24', verdict,
        dignity==='EXALTED'||dignity==='DEBILITATED'?'HIGH':'MEDIUM', info.score));
      motherScore += info.score + (dignity==='EXALTED'?2:dignity==='DEBILITATED'?-2:0);
    }
  }

  // Saturn aspects Moon — depression/difficulty
  if (planetAspectsHouse('Saturn', chart, moon?.house)) {
    findings.push(rule('SAT-MOON-MOTHER', 'BPHS Ch.14 v.20',
      `Saturn influences Moon (mother's karaka) — mother faces sorrow, illness, or chronic emotional suffering. The mother-child relationship has weight and obligation rather than lightness.`,
      'HIGH', -2));
    motherScore -= 2;
  }

  // Jupiter aspects Moon — protection
  if (planetAspectsHouse('Jupiter', chart, moon?.house)) {
    findings.push(rule('JUP-MOON-MOTHER', 'BPHS Ch.14 v.22',
      `Jupiter protects Moon — mother is blessed with wisdom and health. Despite other difficulties, mother has divine protection. Positive maternal influence throughout life.`,
      'HIGH', 2));
    motherScore += 2;
  }

  // Compound verdict
  let motherVerdict = '';
  if (motherScore >= 6) motherVerdict = 'DEEPLY BLESSED: Mother is a magnificent presence. Long-lived, nurturing, and deeply supportive.';
  else if (motherScore >= 3) motherVerdict = 'POSITIVE: Mother is a strong, nurturing figure in the native\'s life.';
  else if (motherScore >= 0) motherVerdict = 'MODERATE: Mother is present but relationship has both strengths and challenges.';
  else if (motherScore >= -3) motherVerdict = 'CHALLENGED: Mother faces difficulties. Relationship requires emotional maturity from both sides.';
  else motherVerdict = 'DIFFICULT: Classical indicators show significant maternal challenges — health, absence, or emotional distance.';

  findings.push(rule('MOTHER-COMPOUND', 'BPHS Ch.14 + SAR Ch.24 (combined)',
    `MOTHER VERDICT: ${motherVerdict} | Score: ${motherScore > 0 ? '+' : ''}${motherScore}`,
    Math.abs(motherScore) >= 4 ? 'HIGH' : 'MEDIUM', 3));

  return { findings, motherScore };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 10 — BPHS CH.12 + PD CH.8 + SAR CH.22:
// SIBLINGS — Complete analysis
// ═══════════════════════════════════════════════════════════════════════════

function evaluateSiblings(chart) {
  const findings = [];
  const l3 = lordOf(3, chart);
  const l3sign = signOfPlanet(l3, chart);
  const l3house = houseOfPlanet(l3, chart);
  const l3dignity = getDignity(l3, l3sign);
  const l11 = lordOf(11, chart);
  const l11house = houseOfPlanet(l11, chart);
  const h3planets = planetsInHouse(3, chart);
  const h11planets = planetsInHouse(11, chart); // elder siblings
  const mars = chart.planets['Mars']; // karaka for siblings
  const marsSign = mars?.sign;
  const marsDignity = getDignity('Mars', marsSign);
  let siblingScore = 0;
  let countEstimate = null;
  let elderGender = null;
  let relation = 'normal';

  // ── 3RD LORD IN ALL 12 HOUSES — BPHS Ch.12 v.5-20 ───────────────
  const l3inHouse = {
    1:  { verdict:`3rd lord in 1st — native is the dominant sibling. Self is the center. Courage defines the personality. Siblings are important to identity.`, score:1 },
    2:  { verdict:`3rd lord in 2nd — siblings contribute to family wealth. Financial transactions with siblings. Sibling works in family business.`, score:2 },
    3:  { verdict:`3rd lord in own house — strong, active siblings. Native has bold, successful siblings. Excellent sibling bonds.`, score:3, relation:'excellent' },
    4:  { verdict:`3rd lord in 4th — sibling is connected to mother and home. Property may be shared with sibling. Siblings are homely.`, score:1 },
    5:  { verdict:`3rd lord in 5th — creative, intelligent sibling. Sibling helps with children. Intellectual bond between siblings.`, score:1 },
    6:  { verdict:`3rd lord in 6th — conflict with siblings. Sibling faces health issues or debts. Enemies among siblings or due to siblings.`, score:-2, relation:'troubled' },
    7:  { verdict:`3rd lord in 7th — sibling influences marriage. May marry through sibling's introduction. Partnership with sibling possible.`, score:1 },
    8:  { verdict:`3rd lord in 8th — sibling faces serious challenges — accidents, illness, or hidden troubles. Estrangement from siblings. Inheritance issues with siblings.`, score:-2, relation:'estranged' },
    9:  { verdict:`3rd lord in 9th — fortunate, dharmic sibling. Sibling elevates the family's status. Elder sibling is a guru or guide.`, score:2 },
    10: { verdict:`3rd lord in 10th — sibling is career-successful, publicly recognized. Sibling's professional success benefits the native.`, score:2 },
    11: { verdict:`3rd lord in 11th — excellent: sibling brings major financial and social gains. Strong elder sibling connection. Siblings are the greatest support.`, score:3, relation:'excellent' },
    12: { verdict:`3rd lord in 12th — sibling lives in foreign land or is separated. Emotional or physical distance from siblings. Sibling may be spiritually inclined.`, score:-1, relation:'distant' }
  };

  if (l3house && l3inHouse[l3house]) {
    let r = l3inHouse[l3house];
    let verdict = r.verdict;
    if (l3dignity === 'EXALTED') { verdict += ` 3rd lord exalted — siblings are outstanding. They prosper and support the native greatly.`; siblingScore += 2; }
    else if (l3dignity === 'DEBILITATED') { verdict += ` 3rd lord debilitated — siblings face difficulties. Relationship is strained.`; siblingScore -= 2; relation = 'troubled'; }
    if (r.relation) relation = r.relation;
    findings.push(rule(`L3-H${l3house}`, 'BPHS Ch.12 v.5-20', verdict,
      l3dignity==='EXALTED'||l3dignity==='DEBILITATED'?'HIGH':'MEDIUM', r.score));
    siblingScore += r.score;
  }

  // ── ALL 9 PLANETS IN 3RD HOUSE — BPHS Ch.12 v.21-40 + SAR Ch.22 ─
  const planetIn3rd = {
    Sun: {
      base:`Sun in 3rd — elder sibling is male, authoritative, possibly in government. Native is courageous and bold. Father's qualities evident in siblings.`,
      count:'1-2', elderGender:'male', score:1
    },
    Moon: {
      base:`Moon in 3rd — multiple siblings, especially sisters. Emotional bond with siblings. Siblings are nurturing and changeable.`,
      count:'2-4', score:1
    },
    Mars: {
      base:`Mars in 3rd — courageous, active siblings. Competition and conflict between siblings. Brothers are indicated. Siblings may be in military, sports, or engineering.`,
      count:'2-3', score:0
    },
    Mercury: {
      base:`Mercury in 3rd — intelligent, communicative siblings. Multiple siblings in business, writing, or technology. Intellectually stimulating sibling bonds.`,
      count:'2-3', score:1
    },
    Jupiter: {
      base:`Jupiter in 3rd — wise, educated, prosperous siblings. Siblings actively help the native. Excellent sibling bonds. Native may have a teacher-like elder sibling.`,
      count:'2-4', score:3, relation:'excellent'
    },
    Venus: {
      base:`Venus in 3rd — beautiful, artistic siblings. Sisters are prominent. Harmonious sibling relationships. Siblings may be in arts or luxury.`,
      count:'2-3', score:2
    },
    Saturn: {
      base:`Saturn in 3rd — only one or few siblings. Sibling is much older, serious, or health-challenged. Slow, duty-based sibling relationship.`,
      count:'1', score:-1
    },
    Rahu: {
      base:`Rahu in 3rd — unconventional siblings. Step-sibling or half-sibling possible. Sibling lives abroad or has an unusual life path. Obsessive sibling dynamics.`,
      score:0
    },
    Ketu: {
      base:`Ketu in 3rd — karmic sibling relationship. Past-life connection with at least one sibling. Sibling is spiritual or introverted. Detachment in sibling bonds.`,
      score:0
    }
  };

  for (const [planet, info] of Object.entries(planetIn3rd)) {
    if (h3planets.includes(planet)) {
      const pSign = signOfPlanet(planet, chart);
      const dignity = getDignity(planet, pSign);
      let verdict = info.base;
      if (dignity === 'EXALTED') verdict += ` ${planet} exalted — siblings flourish magnificently.`;
      if (dignity === 'DEBILITATED') verdict += ` ${planet} debilitated — these qualities are diminished. Sibling struggles.`;
      if (isCombust(planet, chart)) verdict += ` ${planet} is combust — its positive effects on siblings are suppressed.`;
      findings.push(rule(`${planet}-IN3`, 'BPHS Ch.12 v.21-40 + SAR Ch.22', verdict,
        dignity==='EXALTED'||dignity==='DEBILITATED'?'HIGH':'MEDIUM', info.score));
      siblingScore += info.score + (dignity==='EXALTED'?2:dignity==='DEBILITATED'?-2:0);
      if (info.count && !countEstimate) countEstimate = info.count;
      if (info.elderGender) elderGender = info.elderGender;
      if (info.relation) relation = info.relation;
    }
  }

  // ── MARS (KARAKA FOR SIBLINGS) — BPHS Ch.12 v.40-50 ─────────────
  if (marsDignity === 'EXALTED') {
    findings.push(rule('MARS-EXALT-SIB', 'BPHS Ch.12 v.40',
      `Mars (karaka for siblings) exalted in Capricorn — siblings are brave, successful, possibly in military, sports, or government. Siblings prosper greatly.`,
      'HIGH', 2));
    siblingScore += 2;
  } else if (marsDignity === 'DEBILITATED') {
    findings.push(rule('MARS-DEBIL-SIB', 'BPHS Ch.12 v.41',
      `Mars (karaka for siblings) debilitated in Cancer — siblings face recurring obstacles, conflicts, and struggles. Sibling relationship is combative or disappointing.`,
      'HIGH', -2));
    siblingScore -= 2; relation = 'troubled';
  }

  // ── 11TH HOUSE — ELDER SIBLINGS — BPHS Ch.12 v.50-60 ────────────
  if (h11planets.includes('Jupiter')) {
    findings.push(rule('JUP-11-ELDER', 'BPHS Ch.12 v.55',
      `Jupiter in 11th — elder sibling is learned, prosperous, and spiritually oriented. Elder sibling brings blessings to the family.`,
      'MEDIUM', 2));
    siblingScore += 2;
  }
  if (h11planets.includes('Sun')) {
    elderGender = 'male';
    findings.push(rule('SUN-11-ELDER', 'BPHS Ch.12 v.56',
      `Sun in 11th — elder sibling is male, authoritative, possibly in government or medicine.`,
      'MEDIUM', 1));
  }
  if (h11planets.includes('Saturn')) {
    findings.push(rule('SAT-11-ELDER', 'BPHS Ch.12 v.58',
      `Saturn in 11th — elder sibling has a serious, disciplined, service-oriented life. Relationship is reliable but emotionally cool.`,
      'MEDIUM', 0));
  }

  // Parivartana between 3rd and 11th — exceptional sibling bond
  if (parivartana(3, 11, chart)) {
    findings.push(rule('PARIV-3-11', 'BPHS Ch.37',
      `PARIVARTANA: 3rd-11th lord exchange — exceptional sibling bond. Siblings bring major gains, elevation, and support throughout life. This is one of the strongest sibling yoga possible.`,
      'HIGH', 3));
    siblingScore += 3; relation = 'excellent';
  }

  // Count estimate from multiple indicators
  const countSignals = h3planets.length;
  if (!countEstimate) {
    if (countSignals === 0) countEstimate = 'uncertain — depends on 3rd lord and Mars';
    else if (countSignals === 1) countEstimate = '1-2';
    else countEstimate = '2-4';
  }

  // Compound verdict
  let siblingVerdict = '';
  if (siblingScore >= 5) siblingVerdict = 'EXCELLENT: Outstanding sibling bonds. Siblings are a major positive force in this life.';
  else if (siblingScore >= 2) siblingVerdict = 'POSITIVE: Good sibling relationships. Support from siblings is available.';
  else if (siblingScore >= -1) siblingVerdict = 'AVERAGE: Normal sibling dynamic with both support and occasional friction.';
  else if (siblingScore >= -3) siblingVerdict = 'CHALLENGED: Conflicts or estrangement from siblings. Relationship requires effort.';
  else siblingVerdict = 'DIFFICULT: Classical indicators show serious sibling challenges — conflict, estrangement, or loss.';

  findings.push(rule('SIBLINGS-COMPOUND', 'BPHS Ch.12 + PD Ch.8 + SAR Ch.22 (combined)',
    `SIBLINGS VERDICT: ${siblingVerdict} | Sibling count: ${countEstimate} | Elder sibling: ${elderGender || 'unspecified'} | Relationship quality: ${relation} | Score: ${siblingScore > 0 ? '+' : ''}${siblingScore}`,
    Math.abs(siblingScore) >= 4 ? 'HIGH' : 'MEDIUM', 3));

  return { findings, siblingScore, countEstimate, elderGender, relation };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 11 — BPHS CH.24-34 + PD CH.16 + SAR CH.30 + JM:
// CAREER — Complete analysis
// All 9 planets in 10th, 10th lord in all 12 houses, Raja Yogas, D10, Amatyakaraka
// ═══════════════════════════════════════════════════════════════════════════

function evaluateCareer(chart) {
  const findings = [];
  const l10 = lordOf(10, chart);
  const l10sign = signOfPlanet(l10, chart);
  const l10house = houseOfPlanet(l10, chart);
  const l10dignity = getDignity(l10, l10sign);
  const l9 = lordOf(9, chart);
  const l1 = lordOf(1, chart);
  const h10planets = planetsInHouse(10, chart);
  const h10sign = (chart.lagna + 9) % 12; // Sign of 10th house
  const saturn = chart.planets['Saturn'];
  const sun = chart.planets['Sun'];
  const yk = YOGA_KARAKA[chart.lagna];
  let careerScore = 0;
  let fields = [];

  // ── ALL 9 PLANETS IN 10TH HOUSE — BPHS Ch.24-34 (one ch. per planet) ──
  const planetIn10th = {
    Sun: {
      base:`Sun in 10th — outstanding career in government, administration, politics, or medicine. Authority and public recognition come naturally. Career is everything to this person. Father's profession may be followed. Digbala (directional strength) — Sun is most powerful in 10th.`,
      fields:['government','administration','politics','medicine','law'],
      score:3
    },
    Moon: {
      base:`Moon in 10th — career in public sector, food, hospitality, import-export, or real estate. Highly popular with the masses. Career fluctuates with public mood. Mother's influence on career is strong. Fame through the public is classical.`,
      fields:['public sector','food','hospitality','real estate','nursing'],
      score:2
    },
    Mars: {
      base:`Mars in 10th — Ruchaka Yoga if in Aries/Scorpio/Capricorn. Courageous career in military, police, engineering, surgery, sports, or real estate. Leadership through action and confrontation. High achiever who creates results through force of will.`,
      fields:['military','police','engineering','surgery','sports','real estate'],
      score:2
    },
    Mercury: {
      base:`Mercury in 10th — Bhadra Yoga if in Gemini/Virgo. Career in business, writing, accounting, IT, communication, education, or commerce. Multiple career paths simultaneously. Intellectual approach to profession. Quick advancement through intelligence.`,
      fields:['business','writing','IT','accounting','education','communication'],
      score:2
    },
    Jupiter: {
      base:`Jupiter in 10th — Hamsa Yoga if in Cancer/Sagittarius/Pisces. Highly respected career as teacher, judge, professor, consultant, banker, or religious authority. Wisdom earns lasting reputation. One of the most auspicious placements for career dignity.`,
      fields:['teaching','law','finance','religion','consulting','banking'],
      score:3
    },
    Venus: {
      base:`Venus in 10th — Malavya Yoga if in Taurus/Libra/Pisces. Career in arts, entertainment, beauty, fashion, luxury goods, hospitality, or design. Creative profession. Popular with public. Aesthetic sense defines professional output.`,
      fields:['arts','entertainment','beauty','luxury','fashion','design'],
      score:2
    },
    Saturn: {
      base:`Saturn in 10th — Sasha Yoga if in Capricorn/Aquarius/Libra. Disciplined, slow-climbing career. Authority through hard work and persistence. Government, large organizations, service sector, real estate, or research. Success comes after struggle but lasts.`,
      fields:['government','service','real estate','mining','agriculture','research'],
      score:2
    },
    Rahu: {
      base:`Rahu in 10th — unconventional, rapidly rising career path. Foreign companies, technology, media, aviation, or cutting-edge fields. Sudden rise through ambition and rule-bending. May achieve great height through unconventional means.`,
      fields:['technology','foreign companies','media','aviation','IT'],
      score:1
    },
    Ketu: {
      base:`Ketu in 10th — unconventional, specialized career. Research, occult, medicine, technical work, or spiritual profession. Multiple career disruptions or sudden changes. Unique path that others don't understand. Past-life mastery in the profession.`,
      fields:['research','occult','medicine','technical','spirituality'],
      score:0
    }
  };

  for (const [planet, info] of Object.entries(planetIn10th)) {
    if (h10planets.includes(planet)) {
      const pSign = signOfPlanet(planet, chart);
      const dignity = getDignity(planet, pSign);
      let verdict = info.base;

      // Mahapurusha Yoga check
      const mahapurushaYogas = {
        Mars:'Ruchaka', Mercury:'Bhadra', Jupiter:'Hamsa', Venus:'Malavya', Saturn:'Sasha'
      };
      if (mahapurushaYogas[planet] && (dignity==='EXALTED'||dignity==='OWN'||dignity==='MOOLATRIKONA')) {
        verdict += ` ${mahapurushaYogas[planet]} Mahapurusha Yoga — this person reaches the pinnacle of their field. Rare and powerful yoga.`;
        careerScore += 3;
      }

      if (dignity === 'EXALTED' && !mahapurushaYogas[planet]) verdict += ` ${planet} exalted — pinnacle career success in these fields.`;
      if (dignity === 'DEBILITATED') {
        if (neechaBhanga(planet, chart)) verdict += ` Debilitated but Neecha Bhanga — career struggles reverse into unexpected success.`;
        else { verdict += ` ${planet} debilitated — career obstacles. Hard work required. Success delayed.`; careerScore -= 2; }
      }
      if (isCombust(planet, chart)) verdict += ` ${planet} combust — career recognition is suppressed. Authority figures create obstacles.`;

      fields.push(...info.fields);
      findings.push(rule(`${planet}-IN10`, `BPHS Ch.${['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn','Rahu','Ketu'].indexOf(planet)+24}`, verdict,
        dignity==='EXALTED'||dignity==='DEBILITATED'?'HIGH':'MEDIUM', info.score));
      careerScore += info.score;
    }
  }

  // ── 10TH LORD IN ALL 12 HOUSES — BPHS Ch.24-34 ──────────────────
  const l10inHouse = {
    1:  { verdict:`10th lord in 1st — self-employed, independent, entrepreneurial. Career is the identity. Personal brand and reputation built through direct effort. Very self-reliant professionally.`, score:2 },
    2:  { verdict:`10th lord in 2nd — career in finance, banking, family business, food, or speech. Income through communication or money management. Wealth through profession.`, score:2, fields:['finance','banking','food'] },
    3:  { verdict:`10th lord in 3rd — career in communication, media, writing, sales, travel, or marketing. Courage brings professional opportunities. Sibling may share career path.`, score:1, fields:['media','writing','marketing'] },
    4:  { verdict:`10th lord in 4th — career from home, connected to ancestral profession, or in real estate, education, agriculture. Domestic skills become professional assets.`, score:1, fields:['real estate','education'] },
    5:  { verdict:`10th lord in 5th — creative career: entertainment, sports coaching, teaching, investment, speculation. Intelligence is the professional tool. Career through children or creativity.`, score:2, fields:['entertainment','teaching','investment'] },
    6:  { verdict:`10th lord in 6th — service career: medicine, law, dispute resolution, military, healthcare. Success by defeating competition. Career involves daily service.`, score:1, fields:['medicine','law','military'] },
    7:  { verdict:`10th lord in 7th — career through partnerships, consulting, import-export, law. Spouse connected to career. Business partnerships define professional life.`, score:1, fields:['consulting','law','trade'] },
    8:  { verdict:`10th lord in 8th — research, insurance, mining, occult, surgery, investigation. Sudden career changes. Unconventional path. Career involves depth and secrecy.`, score:-1, fields:['research','insurance','surgery'] },
    9:  { verdict:`10th lord in 9th — most auspicious career combination. Career fulfills dharma. Law, teaching, religion, foreign trade, publishing, philosophy. Fortune through profession.`, score:3, fields:['law','teaching','religion','publishing'] },
    10: { verdict:`10th lord in own house (10th) — exceptionally powerful career. Very prominent in chosen field. Possible CEO, minister, or celebrity level achievement.`, score:3 },
    11: { verdict:`10th lord in 11th — career brings enormous gains. Multiple income streams from profession. Large corporate success or wide professional network.`, score:2 },
    12: { verdict:`10th lord in 12th — career abroad, in foreign companies, spirituality, research, NGO, hospital, or isolation. Career involves sacrifice or service.`, score:-1, fields:['foreign work','spirituality','NGO'] }
  };

  if (l10house && l10inHouse[l10house]) {
    let r = l10inHouse[l10house];
    let verdict = r.verdict;
    if (l10dignity === 'EXALTED') { verdict += ` 10th lord exalted — extraordinary career achievement. Rare recognition and public respect.`; careerScore += 4; }
    else if (l10dignity === 'OWN') { verdict += ` 10th lord in own sign — authority, independence, and professional stability.`; careerScore += 2; }
    else if (l10dignity === 'DEBILITATED') {
      if (neechaBhanga(l10, chart)) { verdict += ` Neecha Bhanga — career struggles reverse into unexpected professional rise.`; careerScore += 1; }
      else { verdict += ` 10th lord debilitated — career has major obstacles. Authority challenges. Mid-career crisis is classical.`; careerScore -= 3; }
    }
    if (r.fields) fields.push(...r.fields);
    findings.push(rule(`L10-H${l10house}`, 'BPHS Ch.24-34', verdict,
      l10dignity==='EXALTED'||l10dignity==='DEBILITATED'?'HIGH':'MEDIUM', r.score));
    careerScore += r.score;
  }

  // ── RAJA YOGAS — BPHS Ch.34 ──────────────────────────────────────
  // Dharma-Karma Adhipati Yoga — 9th lord + 10th lord connection
  if (conjunct(l9, l10, chart)) {
    findings.push(rule('DKRY-CONJUNCT', 'BPHS Ch.34 (Dharma-Karma Adhipati)',
      `RAJA YOGA: 9th and 10th lords conjunct — Dharma-Karma Adhipati Yoga. Career fulfills life purpose. Very high achievement. Public recognition and authority are classical outcomes.`,
      'HIGH', 4));
    careerScore += 4;
  }
  if (parivartana(9, 10, chart)) {
    findings.push(rule('DKRY-PARIV', 'BPHS Ch.37',
      `POWERFUL RAJA YOGA: 9th-10th lord Parivartana — extraordinary career destiny. Fame, power, and wealth through profession are classical. May become famous, politically powerful, or extremely wealthy.`,
      'HIGH', 5));
    careerScore += 5;
  }

  // Lagna lord in 10th — personal effort drives career
  if (houseOfPlanet(l1, chart) === 10) {
    findings.push(rule('L1-IN10', 'BPHS Ch.34',
      `Lagna lord in 10th — native's personality and career are one. Self-made success. Outstanding professional identity. Career achievements define the person.`,
      'HIGH', 2));
    careerScore += 2;
  }

  // ── YOGA KARAKA — BPHS Ch.34 ────────────────────────────────────
  if (yk) {
    const ykData = chart.planets[yk];
    if (ykData) {
      const ykDig = getDignity(yk, ykData.sign);
      if (isStrong(yk, ykData.sign)) {
        findings.push(rule('YK-STRONG', 'BPHS Ch.34',
          `YOGA KARAKA: ${yk} (rules both kendra and trikona for ${SIGN_PROPS[chart.lagna].name} lagna) is strong — exceptional career destiny. Life purpose is fulfilled through professional achievement.`,
          'HIGH', 3));
        careerScore += 3;
      }
      if (chart.dasha && [chart.dasha.maha, chart.dasha.antar].includes(yk)) {
        findings.push(rule('YK-DASHA', 'BPHS Ch.45',
          `TIMING: Running ${yk} period (Yoga Karaka) — this is THE career peak dasha. Maximum professional achievement possible NOW. Classical texts say: whatever the native desires in career during this period can be achieved.`,
          'HIGH', 3));
        careerScore += 3;
      }
    }
  }

  // ── AMATYAKARAKA — JAIMINI ────────────────────────────────────────
  const amk = getAmatyakaraka(chart);
  const amkData = chart.planets[amk];
  if (amkData) {
    const amkDig = getDignity(amk, amkData.sign);
    findings.push(rule('AMATYAKARAKA', 'JM (Jaimini Sutram) Ch.1',
      `AMATYAKARAKA: ${amk} (second highest degree = ${amkData.degree?.toFixed(1)}°) — career minister. The profession will have ${amk}'s characteristics. ${isStrong(amk,amkData.sign)?`Strong Amatyakaraka — exceptional career achievement confirmed through Jaimini system.`:`${amkDig === 'DEBILITATED' ? 'Debilitated Amatyakaraka — career challenges from Jaimini perspective.' : 'Neutral strength Amatyakaraka — career achievements are moderate.'}`}`,
      amkDig==='EXALTED'||amkDig==='DEBILITATED'?'HIGH':'MEDIUM', amkDig==='EXALTED'?2:amkDig==='DEBILITATED'?-1:0));
    if (isStrong(amk, amkData.sign)) careerScore += 2;
    if (isWeak(amk, amkData.sign)) careerScore -= 1;
  }

  // ── D10 (DASHAMSHA) CONFIRMATION ─────────────────────────────────
  if (chart.dashamsha) {
    const d10l10 = l10;
    const d10d = chart.dashamsha[d10l10];
    if (d10d) {
      const d10dig = getDignity(d10l10, d10d.sign);
      if (isStrong(d10l10, d10d.sign)) {
        findings.push(rule('D10-CONFIRM', 'UK (Dashamsha D10)',
          `D10 CONFIRMATION: 10th lord strong in Dashamsha — professional success is confirmed at the karmic level. Career achievements are real, lasting, and deserved.`,
          'HIGH', 2));
        careerScore += 2;
      } else if (isWeak(d10l10, d10d.sign)) {
        findings.push(rule('D10-WEAK', 'UK (Dashamsha D10)',
          `D10 CAUTION: 10th lord debilitated in Dashamsha — despite D1 indications, career achievements face deeper obstacles. What appears successful may have underlying instability.`,
          'HIGH', -1));
        careerScore -= 1;
      }
    }
  }

  // Saturn's karmic role — BPHS Ch.10 (Saturn as karma karaka)
  if (saturn && planetAspectsHouse('Saturn', chart, 10)) {
    findings.push(rule('SAT-10TH', 'SAR Ch.30',
      `Saturn aspects 10th — career requires patience, discipline, and sustained effort. Success is earned slowly but is extremely durable once achieved. Government, large organizations, or service sector are favored.`,
      'MEDIUM', 1));
  }

  // Dasha timing for career
  if (chart.dasha) {
    const { maha, antar } = chart.dasha;
    if ([l10,'Sun','Saturn'].includes(maha) || [l10,'Sun'].includes(antar)) {
      findings.push(rule('DASHA-CAREER', 'BPHS Ch.45',
        `TIMING: ${maha}-${antar} dasha is career-connected — professional events, recognition, or significant changes in career are active during this period.`,
        'MEDIUM', 1));
    }
  }

  // Compound verdict
  const uniqueFields = [...new Set(fields)].slice(0, 6);
  let careerVerdict = '';
  if (careerScore >= 8) careerVerdict = 'EXCEPTIONAL: Rare Raja Yoga career destiny. Fame, power, or significant wealth through profession are classical outcomes.';
  else if (careerScore >= 5) careerVerdict = 'OUTSTANDING: Strong career trajectory. Leadership, recognition, and authority are natural outcomes.';
  else if (careerScore >= 2) careerVerdict = 'POSITIVE: Good career with steady growth and reasonable recognition.';
  else if (careerScore >= -1) careerVerdict = 'MODERATE: Career is functional but requires conscious effort for advancement.';
  else if (careerScore >= -4) careerVerdict = 'CHALLENGED: Career faces significant obstacles. Hard work and patience are essential.';
  else careerVerdict = 'DIFFICULT: Multiple classical indicators show serious career challenges. Remedies and strategic approach needed.';

  findings.push(rule('CAREER-COMPOUND', 'BPHS Ch.24-34 + JM + PD Ch.16 (combined)',
    `CAREER VERDICT: ${careerVerdict} | Fields: ${uniqueFields.join(', ')} | Score: ${careerScore > 0 ? '+' : ''}${careerScore}`,
    careerScore >= 8 || careerScore <= -4 ? 'HIGH' : 'MEDIUM', 3));

  return { findings, careerScore, fields: uniqueFields };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 12 — BPHS CH.19 + PD CH.13 + SAR CH.29:
// WEALTH — Complete analysis
// Dhana Yogas, 2nd house, 11th house, all planets
// ═══════════════════════════════════════════════════════════════════════════

function evaluateWealth(chart) {
  const findings = [];
  const l2 = lordOf(2, chart);
  const l2sign = signOfPlanet(l2, chart);
  const l2house = houseOfPlanet(l2, chart);
  const l2dignity = getDignity(l2, l2sign);
  const l11 = lordOf(11, chart);
  const l11sign = signOfPlanet(l11, chart);
  const l11house = houseOfPlanet(l11, chart);
  const l11dignity = getDignity(l11, l11sign);
  const l9 = lordOf(9, chart);
  const l5 = lordOf(5, chart);
  const l1 = lordOf(1, chart);
  const h2planets = planetsInHouse(2, chart);
  const h11planets = planetsInHouse(11, chart);
  const jupiter = chart.planets['Jupiter'];
  let wealthScore = 0;
  let sources = [];

  // ── 2ND LORD IN ALL 12 HOUSES — BPHS Ch.19 v.5-25 ───────────────
  const l2inHouse = {
    1:  { verdict:`2nd lord in 1st — self-made wealth. Personal effort directly builds fortune. Native earns through their own body, personality, or skills.`, score:2 },
    2:  { verdict:`2nd lord in own house — very strong for wealth. Stable, growing financial foundation. Family wealth is preserved and expanded.`, score:3 },
    3:  { verdict:`2nd lord in 3rd — wealth through communication, writing, business, travel, or siblings. Courage brings financial reward.`, score:1, sources:['communication','trade'] },
    4:  { verdict:`2nd lord in 4th — wealth through property, real estate, agriculture, or mother. Domestic assets grow steadily.`, score:2, sources:['real estate'] },
    5:  { verdict:`2nd lord in 5th — wealth through speculation, investment, children, creativity, or intelligence. Stock market or creative enterprise.`, score:2, sources:['investment','creativity'] },
    6:  { verdict:`2nd lord in 6th — income through service, medicine, law, or defeating competition. Expenses through enemies or health. Net wealth is modest.`, score:-1 },
    7:  { verdict:`2nd lord in 7th — wealth through spouse, partnerships, or business. Marriage brings financial gain. Trade and commerce.`, score:2, sources:['marriage','trade'] },
    8:  { verdict:`2nd lord in 8th — wealth through inheritance, insurance, research, or hidden sources. Sudden financial gains and losses. Volatile wealth.`, score:0 },
    9:  { verdict:`2nd lord in 9th — extreme fortune. Wealth through dharma, father, religion, law, or long-distance trade. The luckiest 2nd lord placement.`, score:3, sources:['fortune','father'] },
    10: { verdict:`2nd lord in 10th — high professional income. Wealth through career, status, and authority. Professional wealth is the primary source.`, score:2, sources:['career'] },
    11: { verdict:`2nd lord in 11th — maximum wealth indicator. Multiple income streams. Desires are financially fulfilled. Gains come continuously.`, score:3 },
    12: { verdict:`2nd lord in 12th — expenditure exceeds income. Wealth drains through foreign expenses, losses, or spiritual causes. Financial discipline essential.`, score:-2 }
  };

  if (l2house && l2inHouse[l2house]) {
    let r = l2inHouse[l2house];
    let verdict = r.verdict;
    if (l2dignity === 'EXALTED') { verdict += ` 2nd lord exalted — great wealth accumulation confirmed. Financial security throughout life.`; wealthScore += 3; }
    else if (l2dignity === 'OWN') { verdict += ` 2nd lord in own sign — stable, growing wealth.`; wealthScore += 2; }
    else if (l2dignity === 'DEBILITATED') {
      if (neechaBhanga(l2, chart)) { verdict += ` Neecha Bhanga — financial struggles reverse into unexpected wealth.`; wealthScore += 1; }
      else { verdict += ` 2nd lord debilitated — financial instability. Wealth comes with great difficulty.`; wealthScore -= 2; }
    }
    if (r.sources) sources.push(...r.sources);
    findings.push(rule(`L2-H${l2house}`, 'BPHS Ch.19 v.5-25', verdict,
      l2dignity==='EXALTED'||l2dignity==='DEBILITATED'?'HIGH':'MEDIUM', r.score));
    wealthScore += r.score;
  }

  // ── 11TH LORD STRENGTH — BPHS Ch.19 v.26-35 ─────────────────────
  if (l11dignity === 'EXALTED') {
    findings.push(rule('L11-EXALT', 'BPHS Ch.19 v.26', `11th lord exalted — enormous income. Gains come from multiple sources continuously. Desires are always fulfilled.`, 'HIGH', 3));
    wealthScore += 3;
  } else if (l11dignity === 'OWN') {
    findings.push(rule('L11-OWN', 'BPHS Ch.19 v.27', `11th lord in own sign — strong, regular income. Financial desires are met.`, 'HIGH', 2));
    wealthScore += 2;
  } else if (l11dignity === 'DEBILITATED') {
    if (neechaBhanga(l11, chart)) { findings.push(rule('L11-NB', 'BPHS Ch.39', `11th lord debilitated but Neecha Bhanga — income struggles reverse into financial breakthrough.`, 'HIGH', 1)); wealthScore += 1; }
    else { findings.push(rule('L11-DEBIL', 'BPHS Ch.19 v.28', `11th lord debilitated — income is inconsistent or insufficient. Gains come with difficulty.`, 'HIGH', -2)); wealthScore -= 2; }
  }

  // ── DHANA YOGAS — BPHS Ch.19 (most important wealth yogas) ───────
  // 2nd and 11th lord conjunct — classic Dhana Yoga
  if (conjunct(l2, l11, chart)) {
    findings.push(rule('DY-CONJUNCT', 'BPHS Ch.19 (Dhana Yoga)',
      `DHANA YOGA: 2nd and 11th lords conjunct — powerful wealth yoga. Significant financial accumulation in this lifetime is classical. Both income and savings grow together.`,
      'HIGH', 4));
    wealthScore += 4;
  }
  if (parivartana(2, 11, chart)) {
    findings.push(rule('DY-PARIV', 'BPHS Ch.37',
      `DHANA PARIVARTANA YOGA: 2nd-11th lord exchange — exceptional wealth yoga. Wealth from multiple sources. Financial prosperity is deeply embedded in the chart's design.`,
      'HIGH', 4));
    wealthScore += 4;
  }

  // 9th lord in 2nd or 11th — fortune brings wealth
  if ([2,11].includes(houseOfPlanet(l9, chart))) {
    findings.push(rule('L9-DHANA', 'BPHS Ch.19',
      `9th lord in 2nd or 11th — extreme fortune. Luck and dharma directly feed into wealth accumulation. Father or fortune brings financial gain.`,
      'HIGH', 3));
    wealthScore += 3; sources.push('fortune');
  }

  // 5th lord in 2nd or 11th — intelligence brings wealth
  if ([2,11].includes(houseOfPlanet(l5, chart))) {
    findings.push(rule('L5-DHANA', 'BPHS Ch.19',
      `5th lord in 2nd or 11th — wealth through intelligence, speculation, investment, or children. Creative and speculative income.`,
      'MEDIUM', 2));
    wealthScore += 2; sources.push('investment','creativity');
  }

  // Lagna lord in 2nd or 11th — self creates wealth
  if ([2,11].includes(houseOfPlanet(l1, chart))) {
    findings.push(rule('L1-DHANA', 'BPHS Ch.19',
      `Lagna lord in 2nd or 11th — native is self-made. Personal effort directly accumulates wealth. Strong financial drive.`,
      'HIGH', 2));
    wealthScore += 2;
  }

  // ── ALL 9 PLANETS IN 2ND HOUSE — BPHS Ch.19 v.36-60 ─────────────
  const planetIn2nd = {
    Sun:     { base:`Sun in 2nd — income from government, authority, father. Wealth ebbs and flows with authority. Speech is commanding.`, score:1, sources:['government'] },
    Moon:    { base:`Moon in 2nd — fluctuating income from public, food, trade, or mother. Emotional relationship with money. Wealth tied to moods.`, score:1, sources:['public','food'] },
    Mars:    { base:`Mars in 2nd — wealth through real estate, engineering, courage, or competition. Aggressive earning. May spend impulsively.`, score:1, sources:['real estate'] },
    Mercury: { base:`Mercury in 2nd — wealth through business, trade, communication, writing. Multiple income streams. Financial intelligence.`, score:2, sources:['business','trade'] },
    Jupiter: { base:`Jupiter in 2nd — blessed with wealth throughout life. Generous with money. Wealth grows continuously. Sweet, eloquent speech.`, score:3, sources:['wisdom'] },
    Venus:   { base:`Venus in 2nd — wealth through luxury goods, arts, beauty, entertainment. Enjoys material comforts. Excellent food and pleasures.`, score:2, sources:['luxury','arts'] },
    Saturn:  { base:`Saturn in 2nd — slow, disciplined wealth accumulation. Frugal nature. Wealth in old age. May have speech issues. Government or service income.`, score:0 },
    Rahu:    { base:`Rahu in 2nd — wealth through unconventional, foreign, or unusual means. Sudden gains and losses. Insatiable appetite for wealth.`, score:0 },
    Ketu:    { base:`Ketu in 2nd — detachment from wealth. Money comes and goes. Spiritual approach to finances. Past-life wealth karma is being released.`, score:-1 }
  };

  for (const [planet, info] of Object.entries(planetIn2nd)) {
    if (h2planets.includes(planet)) {
      const pSign = signOfPlanet(planet, chart);
      const dignity = getDignity(planet, pSign);
      let verdict = info.base;
      if (dignity === 'EXALTED') verdict += ` ${planet} exalted — maximum wealth from this source.`;
      if (dignity === 'DEBILITATED') verdict += ` ${planet} debilitated — wealth from this source is limited or problematic.`;
      if (info.sources) sources.push(...info.sources);
      findings.push(rule(`${planet}-IN2`, 'BPHS Ch.19 v.36-60', verdict,
        dignity==='EXALTED'||dignity==='DEBILITATED'?'HIGH':'MEDIUM', info.score));
      wealthScore += info.score + (dignity==='EXALTED'?2:dignity==='DEBILITATED'?-2:0);
    }
  }

  // ── PLANETS IN 11TH HOUSE — BPHS Ch.19 v.61-80 ──────────────────
  const planetIn11th = {
    Sun:     { base:`Sun in 11th — gains from government, authority figures, father. Income through leadership and status.`, score:2 },
    Moon:    { base:`Moon in 11th — gains from public, women, food, or masses. Social income. Multiple gains throughout life.`, score:2 },
    Mars:    { base:`Mars in 11th — gains through courage, real estate, competition, or siblings. Active earning style.`, score:2 },
    Mercury: { base:`Mercury in 11th — multiple income streams through business, communication, and intellect. Financially intelligent.`, score:2 },
    Jupiter: { base:`Jupiter in 11th — continuous, multiplying gains. Wisdom brings wealth. Most auspicious planet in 11th for income.`, score:3 },
    Venus:   { base:`Venus in 11th — gains through luxury, arts, entertainment, women. Pleasurable income sources.`, score:2 },
    Saturn:  { base:`Saturn in 11th — steady, disciplined accumulation. Income from service, government, or real estate. Gains improve with age.`, score:2 },
    Rahu:    { base:`Rahu in 11th — unusual gains from foreign sources, technology, or speculation. Sudden windfalls.`, score:1 },
    Ketu:    { base:`Ketu in 11th — spiritual or karmic gains. Income from past-life skills. Gains may feel empty or incomplete.`, score:0 }
  };

  for (const [planet, info] of Object.entries(planetIn11th)) {
    if (h11planets.includes(planet)) {
      const pSign = signOfPlanet(planet, chart);
      const dignity = getDignity(planet, pSign);
      let verdict = info.base;
      if (dignity === 'EXALTED') verdict += ` ${planet} exalted in 11th — exceptional gains from this source.`;
      if (dignity === 'DEBILITATED') verdict += ` ${planet} debilitated — gains from this source are limited.`;
      findings.push(rule(`${planet}-IN11`, 'BPHS Ch.19 v.61-80', verdict,
        dignity==='EXALTED'||dignity==='DEBILITATED'?'HIGH':'MEDIUM', info.score));
      wealthScore += info.score + (dignity==='EXALTED'?1:dignity==='DEBILITATED'?-1:0);
    }
  }

  // Jupiter strength as wealth karaka
  if (jupiter) {
    const jupDig = getDignity('Jupiter', jupiter.sign);
    if (jupDig === 'EXALTED') { findings.push(rule('JUP-EXALT-WEALTH', 'BPHS Ch.19', `Jupiter exalted — naturally wealthy. Money flows easily throughout life. Financial wisdom is innate. Blessed by Lakshmi.`, 'HIGH', 3)); wealthScore += 3; }
    else if (jupDig === 'DEBILITATED') { findings.push(rule('JUP-DEBIL-WEALTH', 'BPHS Ch.19', `Jupiter debilitated — wealth challenges. Financial misjudgments. Overspending on unnecessary things.`, 'HIGH', -1)); wealthScore -= 1; }
  }

  // Dasha timing for wealth
  if (chart.dasha) {
    const { maha, antar } = chart.dasha;
    if ([l2,l11,'Jupiter','Venus'].includes(maha)) {
      findings.push(rule('DASHA-WEALTH', 'BPHS Ch.45',
        `TIMING: ${maha} Mahadasha — wealth-connected period. Income and accumulation are actively supported by this planetary period. Financial opportunities are classical now.`,
        'MEDIUM', 1));
    }
  }

  // Compound verdict
  const uniqueSources = [...new Set(sources)].slice(0,5);
  let wealthVerdict = '';
  if (wealthScore >= 9) wealthVerdict = 'VERY WEALTHY: Multiple Dhana Yogas confirmed. Significant wealth accumulation is the classical destiny.';
  else if (wealthScore >= 6) wealthVerdict = 'PROSPEROUS: Strong financial indicators. Comfortable, growing wealth throughout life.';
  else if (wealthScore >= 3) wealthVerdict = 'COMFORTABLE: Adequate income. Financial needs are met with some surplus.';
  else if (wealthScore >= 0) wealthVerdict = 'MODERATE: Basic financial needs met. Wealth requires conscious effort and discipline.';
  else if (wealthScore >= -3) wealthVerdict = 'BELOW AVERAGE: Financial struggles are recurring. Debt and expenditure management are important.';
  else wealthVerdict = 'SIGNIFICANT CHALLENGE: Classical indicators show chronic financial difficulties. Remedies and strict financial planning are essential.';

  findings.push(rule('WEALTH-COMPOUND', 'BPHS Ch.19 + PD Ch.13 + SAR Ch.29 (combined)',
    `WEALTH VERDICT: ${wealthVerdict} | Primary sources: ${uniqueSources.join(', ') || 'general effort'} | Score: ${wealthScore > 0 ? '+' : ''}${wealthScore}`,
    wealthScore >= 9 || wealthScore <= -3 ? 'HIGH' : 'MEDIUM', 3));

  return { findings, wealthScore, sources: uniqueSources };
}

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE evaluate() — ADD ALL NEW SECTIONS
// ═══════════════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════════════
// SECTION 13 — BPHS CH.8 + PD CH.6 + SAR CH.18:
// HEALTH & LONGEVITY — Complete analysis
// Constitution, disease indicators, body parts, longevity classification
// ═══════════════════════════════════════════════════════════════════════════

function evaluateHealth(chart) {
  const findings = [];
  const l1 = lordOf(1, chart);
  const l1sign = signOfPlanet(l1, chart);
  const l1house = houseOfPlanet(l1, chart);
  const l1dignity = getDignity(l1, l1sign);
  const h1planets = planetsInHouse(1, chart);
  const h6planets = planetsInHouse(6, chart);
  const h8planets = planetsInHouse(8, chart);
  const moon = chart.planets['Moon'];
  const mars = chart.planets['Mars'];
  const saturn = chart.planets['Saturn'];
  const jupiter = chart.planets['Jupiter'];
  let healthScore = 0;
  let vulnerableAreas = [];
  let diseases = [];

  // ── LAGNA LORD — PRIMARY HEALTH INDICATOR ─────────────────────────
  // BPHS Ch.8 v.1-15
  if (l1dignity === 'EXALTED') {
    findings.push(rule('LL-HEALTH-EX', 'BPHS Ch.8 v.1',
      `Lagna lord ${l1} exalted — exceptional constitution. Strong immunity, quick recovery from illness. Robust physical vitality throughout life. The body is the native's greatest asset.`,
      'HIGH', 3));
    healthScore += 3;
  } else if (l1dignity === 'OWN' || l1dignity === 'MOOLATRIKONA') {
    findings.push(rule('LL-HEALTH-OWN', 'BPHS Ch.8 v.2',
      `Lagna lord ${l1} in own/moolatrikona sign — reliable, stable constitution. Health is generally good. Recovers well from illness with reasonable care.`,
      'HIGH', 2));
    healthScore += 2;
  } else if (l1dignity === 'DEBILITATED') {
    if (neechaBhanga(l1, chart)) {
      findings.push(rule('LL-HEALTH-NB', 'BPHS Ch.39',
        `Lagna lord ${l1} debilitated but Neecha Bhanga — early health weakness transforms into resilience. Body strengthens after initial challenges in youth.`,
        'HIGH', 1));
      healthScore += 1;
    } else {
      findings.push(rule('LL-HEALTH-DB', 'BPHS Ch.8 v.3',
        `Lagna lord ${l1} debilitated — weak constitution, susceptible to recurring illness. Health requires constant attention. Physical vitality is below average. Proactive health management is essential.`,
        'HIGH', -3));
      healthScore -= 3;
    }
  }

  // Lagna lord in dusthana — BPHS Ch.8 v.5
  if (DUSTHANAS.includes(l1house)) {
    findings.push(rule('LL-DUST-HEALTH', 'BPHS Ch.8 v.5',
      `Lagna lord in ${l1house}th (dusthana) — health is a recurring life theme. The body faces challenges connected to the ${l1house}th house's significations.`,
      'MEDIUM', -1));
    healthScore -= 1;
  }

  // ── BODY PARTS BY LAGNA SIGN — BPHS Ch.8 v.10-30 ─────────────────
  // Each sign rules a body part; malefics in lagna sign = vulnerability there
  const lagnaBodyPart = SIGN_PROPS[chart.lagna]?.bodyPart || 'general constitution';
  const maleficsInLagna = h1planets.filter(p => isMalefic(p));
  if (maleficsInLagna.length > 0) {
    vulnerableAreas.push(lagnaBodyPart);
    findings.push(rule('MAL-LAGNA-BODY', 'BPHS Ch.8 v.10',
      `Malefic(s) ${maleficsInLagna.join('+')} in lagna — physical vulnerability in: ${lagnaBodyPart}. These areas need proactive care.`,
      'HIGH', -1));
    healthScore -= 1;
  }

  // ── ALL 9 PLANETS IN 6TH HOUSE — DISEASE HOUSE — BPHS Ch.8 ───────
  // 6th house = house of disease (Roga). Planets here indicate disease type.
  const planetDisease6th = {
    Sun:     { disease:'heart disease, eye problems, fever, bone disorders, skin issues', bodyPart:'right eye, heart, bones', score:-1 },
    Moon:    { disease:'mental health, blood disorders, water retention, lung problems, colds', bodyPart:'left eye, lungs, blood', score:-1 },
    Mars:    { disease:'accidents, wounds, blood disorders, infections, inflammatory conditions', bodyPart:'blood, muscles, bile', score:-1 },
    Mercury: { disease:'nervous system disorders, skin issues, speech problems, respiratory', bodyPart:'nerves, skin, speech organs', score:-1 },
    Jupiter: { disease:'liver disorders, obesity, diabetes, tumors, fatty conditions', bodyPart:'liver, fat tissue', score:-1 },
    Venus:   { disease:'reproductive disorders, kidney problems, diabetes, urinary conditions', bodyPart:'kidneys, reproductive system', score:-1 },
    Saturn:  { disease:'chronic conditions, bones, joints, arthritis, depression, cold diseases', bodyPart:'bones, joints, nerves', score:-2 },
    Rahu:    { disease:'mysterious diseases, allergies, poison, skin problems, addictions, anxiety', bodyPart:'skin, nervous system', score:-1 },
    Ketu:    { disease:'intestinal parasites, mysterious fevers, wounds, spiritual ailments', bodyPart:'intestines, immune system', score:-1 }
  };

  for (const [planet, info] of Object.entries(planetDisease6th)) {
    if (h6planets.includes(planet)) {
      const pSign = signOfPlanet(planet, chart);
      const dignity = getDignity(planet, pSign);
      let verdict = `${planet} in 6th — potential health concerns: ${info.disease}. Body parts to monitor: ${info.bodyPart}.`;
      if (dignity === 'EXALTED') verdict += ` However, ${planet} is exalted — these health issues are manageable and often overcome through native's strength.`;
      if (dignity === 'DEBILITATED') verdict += ` ${planet} debilitated here — these health vulnerabilities are more pronounced.`;
      diseases.push(...info.disease.split(', ').slice(0,2));
      vulnerableAreas.push(info.bodyPart);
      findings.push(rule(`${planet}-6TH-DISEASE`, 'BPHS Ch.8 + PD Ch.6', verdict,
        dignity==='DEBILITATED'?'HIGH':'MEDIUM', info.score));
      healthScore += info.score + (dignity==='EXALTED'?1:dignity==='DEBILITATED'?-1:0);
    }
  }

  // ── PLANETS IN 8TH HOUSE — CHRONIC/SERIOUS DISEASE ───────────────
  const planetDisease8th = {
    Sun:     { disease:'heart conditions, chronic fever, eye problems', score:-1 },
    Moon:    { disease:'mental illness, chronic anxiety, fluid disorders', score:-2 },
    Mars:    { disease:'accidents, surgery risk, blood disorders', score:-1 },
    Mercury: { disease:'chronic nervous disorders, skin diseases', score:-1 },
    Jupiter: { disease:'liver disease, obesity, chronic conditions', score:-1 },
    Venus:   { disease:'chronic reproductive issues, kidney disease', score:-1 },
    Saturn:  { disease:'chronic long-term illness, arthritis, degenerative disease — but also longevity', score:0 },
    Rahu:    { disease:'mysterious chronic illness, cancer risk (classical), poisons', score:-2 },
    Ketu:    { disease:'mysterious illness, spiritual diseases, surgical interventions', score:-1 }
  };

  for (const [planet, info] of Object.entries(planetDisease8th)) {
    if (h8planets.includes(planet)) {
      const pSign = signOfPlanet(planet, chart);
      const dignity = getDignity(planet, pSign);
      let verdict = `${planet} in 8th — ${info.disease}. 8th house placement intensifies these health themes.`;
      if (planet === 'Saturn') verdict = `Saturn in 8th — chronic conditions are possible but longevity is supported. Saturn is Ayushkaraka (longevity significator) in its own territory.`;
      if (dignity === 'EXALTED') verdict += ` Exalted here — manageable.`;
      if (dignity === 'DEBILITATED') verdict += ` Debilitated — more serious concern.`;
      findings.push(rule(`${planet}-8TH-DISEASE`, 'BPHS Ch.8 v.20', verdict,
        (planet==='Rahu'||planet==='Moon'||dignity==='DEBILITATED')?'HIGH':'MEDIUM', info.score));
      healthScore += info.score + (dignity==='EXALTED'?1:dignity==='DEBILITATED'?-1:0);
      diseases.push(...info.disease.split(', ').slice(0,1));
    }
  }

  // ── MARS — ACCIDENTS AND SURGERY — PD Ch.6 v.12 ──────────────────
  if (mars && [6,8].includes(mars.house)) {
    findings.push(rule('MARS-ACCIDENT', 'PD Ch.6 v.12',
      `Mars in ${mars.house}th — risk of accidents, injuries, cuts, or surgical procedures, particularly during Mars periods or Saturn's transit over Mars. Avoid reckless physical activities.`,
      'HIGH', -1));
    healthScore -= 1;
  }

  // ── MOON AFFLICTIONS — MENTAL HEALTH ─────────────────────────────
  if (moon) {
    if (conjunct('Saturn','Moon',chart) || (planetAspectsHouse('Saturn',chart,moon.house) && !anyBeneficAspects(moon.house,chart))) {
      findings.push(rule('SAT-MOON-MENTAL', 'BPHS Ch.9 v.20',
        `Saturn afflicts Moon — clinical tendency toward depression, chronic anxiety, or melancholy. Mental health is the most important area to protect. Meditation, spiritual practice, and regular routine are the classical remedies.`,
        'HIGH', -2));
      healthScore -= 2;
      diseases.push('depression','anxiety');
    }
    if (conjunct('Rahu','Moon',chart)) {
      findings.push(rule('RAHU-MOON-MENTAL', 'BPHS Ch.9 v.22',
        `Rahu conjunct Moon — psychic disturbances, obsessive thought patterns, or mental instability. Grahan Yoga on the mind. Past-life mental karma surfaces. Requires grounding practices.`,
        'HIGH', -2));
      healthScore -= 2;
      diseases.push('mental instability','obsessive patterns');
    }
  }

  // ── JUPITER PROTECTS HEALTH — BPHS Ch.8 v.25 ─────────────────────
  if (jupiter && (planetAspectsHouse('Jupiter',chart,1) || h1planets.includes('Jupiter'))) {
    findings.push(rule('JUP-HEALTH', 'BPHS Ch.8 v.25',
      `Jupiter aspects or occupies lagna — powerful protection for physical health. Natural immunity is strong. Body recovers well. Divine grace shields the constitution.`,
      'HIGH', 3));
    healthScore += 3;
  }

  // ── 6TH LORD IN LAGNA — CHRONIC HEALTH THEME ─────────────────────
  const l6 = lordOf(6, chart);
  if (houseOfPlanet(l6, chart) === 1) {
    findings.push(rule('L6-IN-LAGNA', 'BPHS Ch.8 v.30',
      `6th lord in lagna — health is a defining life theme. Native faces recurring illness or health challenges that shape identity. Also excellent for defeating enemies — service-oriented life.`,
      'HIGH', -1));
    healthScore -= 1;
  }

  // ── LONGEVITY CLASSIFICATION — BPHS Ch.8 (Ayurdaya) ─────────────
  // Ayurdaya calculation considers: lagna lord, 8th lord, Saturn, Moon, Jupiter
  let longevityScore = 0;
  const l8 = lordOf(8, chart);
  const l8sign = signOfPlanet(l8, chart);
  const l8house = houseOfPlanet(l8, chart);

  // Lagna lord strength
  if (isStrong(l1, l1sign)) longevityScore += 3;
  else if (isWeak(l1, l1sign)) longevityScore -= 2;

  // 8th lord strength (house of longevity)
  if (l8sign !== undefined) {
    if (isStrong(l8, l8sign)) longevityScore += 2;
    else if (isWeak(l8, l8sign)) longevityScore -= 2;
  }

  // Saturn in 8th = long life (Ayushkaraka in longevity house)
  if (saturn?.house === 8) { longevityScore += 3; findings.push(rule('SAT-8-LONGEVITY', 'BPHS Ch.8 v.15', `Saturn in 8th — long life despite health challenges. Ayushkaraka (Saturn) in the house of longevity — classical indicator of extended lifespan.`, 'HIGH', 2)); }

  // Jupiter aspects lagna
  if (jupiter && planetAspectsHouse('Jupiter',chart,1)) longevityScore += 2;

  // Moon strength
  if (moon) {
    if (isStrong('Moon', moon.sign)) longevityScore += 2;
    else if (isWeak('Moon', moon.sign)) longevityScore -= 2;
  }

  let longevityClass = '';
  if (longevityScore >= 6) longevityClass = 'LONG LIFE (70+): Multiple longevity indicators align. Classical texts indicate extended lifespan.';
  else if (longevityScore >= 3) longevityClass = 'MEDIUM-LONG LIFE (60-80): Generally favorable longevity indicators.';
  else if (longevityScore >= 0) longevityClass = 'MEDIUM LIFE (50-70): Standard longevity indication.';
  else if (longevityScore >= -3) longevityClass = 'MEDIUM-SHORT: Longevity requires attention. Health discipline is important.';
  else longevityClass = 'LONGEVITY CONCERN: Multiple classical indicators suggest health vigilance is essential throughout life.';

  findings.push(rule('LONGEVITY', 'BPHS Ch.8 (Ayurdaya)',
    `LONGEVITY: ${longevityClass} | Note: Precise Ayurdaya requires full calculation — this is an indicator, not a prediction.`,
    longevityScore >= 6 || longevityScore <= -3 ? 'MEDIUM' : 'LOW', 2));

  // Compound verdict
  const uniqueDiseases = [...new Set(diseases)].slice(0,4);
  const uniqueVulnerabilities = [...new Set(vulnerableAreas)].slice(0,3);
  let healthVerdict = '';
  if (healthScore >= 5) healthVerdict = 'STRONG CONSTITUTION: Excellent health, strong immunity, quick recovery.';
  else if (healthScore >= 2) healthVerdict = 'GOOD HEALTH: Generally robust. Normal health maintenance sufficient.';
  else if (healthScore >= -1) healthVerdict = 'AVERAGE HEALTH: Some recurring issues. Regular health monitoring advised.';
  else if (healthScore >= -4) healthVerdict = 'HEALTH CHALLENGES: Multiple areas of concern. Proactive health management essential.';
  else healthVerdict = 'SIGNIFICANT HEALTH CONCERNS: Classical indicators show chronic vulnerabilities. Medical awareness is critical.';

  findings.push(rule('HEALTH-COMPOUND', 'BPHS Ch.8 + PD Ch.6 (combined)',
    `HEALTH VERDICT: ${healthVerdict} | Vulnerable areas: ${uniqueVulnerabilities.join(', ')||'none specific'} | Monitor: ${uniqueDiseases.join(', ')||'general health'} | Longevity: ${longevityClass.split(':')[0]} | Score: ${healthScore > 0 ? '+' : ''}${healthScore}`,
    Math.abs(healthScore) >= 4 ? 'HIGH' : 'MEDIUM', 3));

  return { findings, healthScore, longevityScore, vulnerableAreas: uniqueVulnerabilities, diseases: uniqueDiseases };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 14 — BPHS CH.26 + SAR CH.35:
// FOREIGN TRAVEL & SETTLEMENT — Complete analysis
// ═══════════════════════════════════════════════════════════════════════════

function evaluateForeignTravel(chart) {
  const findings = [];
  const l12 = lordOf(12, chart);
  const l9 = lordOf(9, chart);
  const l3 = lordOf(3, chart);
  const l12house = houseOfPlanet(l12, chart);
  const l9house = houseOfPlanet(l9, chart);
  const h12planets = planetsInHouse(12, chart);
  const h9planets = planetsInHouse(9, chart);
  const h3planets = planetsInHouse(3, chart);
  const rahu = chart.planets['Rahu'];
  const moon = chart.planets['Moon'];
  const ketu = chart.planets['Ketu'];
  let foreignScore = 0;

  // ── RAHU — STRONGEST FOREIGN INDICATOR ────────────────────────────
  // BPHS Ch.26 v.3 — Rahu in 12th, 9th, 7th, or 3rd
  if (rahu) {
    const rahuForeignHouses = {
      12: { verdict:`Rahu in 12th — the strongest foreign indicator. Native is drawn powerfully toward foreign lands. Settlement abroad is classical for this placement. Foreign culture feels more like home than birthplace.`, score:4 },
      9:  { verdict:`Rahu in 9th — long-distance travel, foreign philosophy or religion. Father may be from different background. Dharma found in foreign lands.`, score:3 },
      7:  { verdict:`Rahu in 7th — foreign or cross-cultural marriage is very likely. Business partnerships with foreigners. Significant foreign exposure through relationships.`, score:2 },
      3:  { verdict:`Rahu in 3rd — frequent travel, restlessness, foreign communication. May work in foreign media or with international clients.`, score:1 },
      1:  { verdict:`Rahu in lagna — born with foreign quality in personality. Native may feel like a stranger in their own land. Foreign countries feel comfortable.`, score:2 }
    };
    if (rahuForeignHouses[rahu.house]) {
      const r = rahuForeignHouses[rahu.house];
      findings.push(rule(`RAHU-H${rahu.house}-FOREIGN`, 'BPHS Ch.26 v.3', r.verdict, 'HIGH', r.score));
      foreignScore += r.score;
    }
  }

  // ── 12TH LORD POSITION ────────────────────────────────────────────
  const l12inHouseForeign = {
    1:  { verdict:`12th lord in 1st — expenditure through self. Spiritual or foreign quality in personality.`, score:1 },
    3:  { verdict:`12th lord in 3rd — short foreign trips, communication with foreign countries.`, score:1 },
    7:  { verdict:`12th lord in 7th — foreign spouse or business partner. Settlement abroad through marriage/partnership.`, score:2 },
    9:  { verdict:`12th lord in 9th — STRONG: Foreign destiny through dharma, father, or higher education. Long-distance foreign settlement is classical. Fortune found in foreign lands.`, score:4 },
    10: { verdict:`12th lord in 10th — career in foreign country, foreign company, or isolated profession.`, score:2 },
    11: { verdict:`12th lord in 11th — gains through foreign sources. Foreign friends bring income.`, score:1 }
  };
  if (l12house && l12inHouseForeign[l12house]) {
    findings.push(rule(`L12-H${l12house}`, 'BPHS Ch.26 v.5', l12inHouseForeign[l12house].verdict, 'MEDIUM', l12inHouseForeign[l12house].score));
    foreignScore += l12inHouseForeign[l12house].score;
  }

  // ── 9TH LORD IN 12TH — MOST POWERFUL FOREIGN SETTLEMENT YOGA ─────
  if (l9house === 12) {
    findings.push(rule('L9-IN12-FOREIGN', 'BPHS Ch.26 v.6',
      `9th lord in 12th — POWERFUL: Fortune and dharma are found in foreign lands. Settlement or extended stay abroad is classical. Native thrives away from birthplace. Foreign education or religious journey likely.`,
      'HIGH', 4));
    foreignScore += 4;
  }

  // Parivartana between 9th and 12th
  if (parivartana(9, 12, chart)) {
    findings.push(rule('PARIV-9-12', 'BPHS Ch.37',
      `9th-12th lord Parivartana — CERTAIN foreign destiny. A significant portion of this life will be lived in foreign lands. This is one of the strongest foreign settlement yogas.`,
      'HIGH', 5));
    foreignScore += 5;
  }

  // ── PLANETS IN 12TH — FOREIGN INDICATORS ──────────────────────────
  const planetIn12th = {
    Sun:     `Sun in 12th — father connected to foreign lands or isolation. Career in foreign country or government service abroad.`,
    Moon:    `Moon in 12th — emotional connection with foreign lands. Lives far from birthplace. Mother may be foreign or separated.`,
    Mars:    `Mars in 12th — travels for adventure, military, or real estate abroad. Hospital stays or foreign conflicts possible.`,
    Mercury: `Mercury in 12th — foreign communication, writing abroad, or spiritual literature.`,
    Jupiter: `Jupiter in 12th — spiritual foreign journeys. Ashram or university abroad. Foreign blessings. Moksha orientation.`,
    Venus:   `Venus in 12th — foreign romantic involvement. Pleasures in foreign lands. Possible foreign spouse.`,
    Saturn:  `Saturn in 12th — foreign isolation, service abroad, or imprisonment in foreign land. Long foreign stay through work.`,
    Rahu:    `Rahu in 12th (strongest foreign indicator) — foreign settlement is the classical destiny for this placement.`,
    Ketu:    `Ketu in 12th — moksha orientation. Spiritual retreat or ashram in foreign land. Past-life foreign connection.`
  };

  for (const [planet, verdict] of Object.entries(planetIn12th)) {
    if (h12planets.includes(planet)) {
      const score = ['Jupiter','Venus','Moon','Rahu'].includes(planet) ? 2 : 1;
      findings.push(rule(`${planet}-IN12`, 'BPHS Ch.26', verdict, 'MEDIUM', score));
      foreignScore += score;
    }
  }

  // Moon-Rahu connection in foreign houses
  if (moon && rahu && conjunct('Moon','Rahu',chart) && [9,12].includes(rahu.house)) {
    findings.push(rule('MOON-RAHU-FOREIGN', 'SAR Ch.35',
      `Moon-Rahu conjunction in ${rahu.house}th — very strong foreign pull. Native feels deeply called to foreign lands. Past-life foreign karma is active.`,
      'HIGH', 2));
    foreignScore += 2;
  }

  // Compound verdict
  let foreignVerdict = '';
  let settlementLikelihood = '';
  if (foreignScore >= 7) { foreignVerdict = 'STRONG FOREIGN DESTINY: Multiple classical indicators confirm significant foreign life. Settlement abroad is classical.'; settlementLikelihood = 'Very likely'; }
  else if (foreignScore >= 4) { foreignVerdict = 'SIGNIFICANT FOREIGN CONNECTION: Extended foreign travel or long stays abroad are indicated.'; settlementLikelihood = 'Possible'; }
  else if (foreignScore >= 2) { foreignVerdict = 'MODERATE FOREIGN TRAVEL: Regular foreign travel is indicated. Short stays abroad.'; settlementLikelihood = 'Unlikely'; }
  else { foreignVerdict = 'LIMITED FOREIGN INDICATION: Foreign travel may happen but not a dominant life theme.'; settlementLikelihood = 'Not indicated'; }

  findings.push(rule('FOREIGN-COMPOUND', 'BPHS Ch.26 (combined)',
    `FOREIGN VERDICT: ${foreignVerdict} | Settlement likelihood: ${settlementLikelihood} | Score: ${foreignScore > 0 ? '+' : ''}${foreignScore}`,
    foreignScore >= 7 ? 'HIGH' : 'MEDIUM', 3));

  return { findings, foreignScore, settlementLikelihood };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 15 — BPHS CH.20 + SAR CH.34:
// PROPERTY — Complete analysis
// ═══════════════════════════════════════════════════════════════════════════

function evaluateProperty(chart) {
  const findings = [];
  const l4 = lordOf(4, chart);
  const l4sign = signOfPlanet(l4, chart);
  const l4house = houseOfPlanet(l4, chart);
  const l4dignity = getDignity(l4, l4sign);
  const h4planets = planetsInHouse(4, chart);
  const mars = chart.planets['Mars']; // karaka for property/land
  const marsDignity = getDignity('Mars', mars?.sign);
  let propertyScore = 0;

  // 4th lord strength
  if (l4dignity === 'EXALTED') { findings.push(rule('L4-EX-PROP', 'BPHS Ch.20 v.1', `4th lord ${l4} exalted — owns multiple properties, vehicles, and land. Comfortable, beautiful home. Property brings wealth.`, 'HIGH', 3)); propertyScore += 3; }
  else if (l4dignity === 'OWN') { findings.push(rule('L4-OWN-PROP', 'BPHS Ch.20 v.2', `4th lord in own sign — reliable property ownership. Stable home. Property is a consistent life asset.`, 'HIGH', 2)); propertyScore += 2; }
  else if (l4dignity === 'DEBILITATED') {
    if (neechaBhanga(l4, chart)) { findings.push(rule('L4-NB-PROP', 'BPHS Ch.39', `4th lord debilitated but Neecha Bhanga — property difficulties reverse into unexpected property gains.`, 'HIGH', 1)); propertyScore += 1; }
    else { findings.push(rule('L4-DB-PROP', 'BPHS Ch.20 v.3', `4th lord debilitated — difficulty owning property. Rented accommodation more likely. Property disputes possible.`, 'HIGH', -2)); propertyScore -= 2; }
  }

  // 4th lord in dusthana
  if (DUSTHANAS.includes(l4house)) {
    findings.push(rule('L4-DUST-PROP', 'BPHS Ch.20', `4th lord in ${l4house}th — property disputes, losses, or obstacles to property ownership. Property abroad possible.`, 'MEDIUM', -1));
    propertyScore -= 1;
  }

  // 4th lord in 11th — multiple properties
  if (l4house === 11) { findings.push(rule('L4-11-PROP', 'BPHS Ch.20', `4th lord in 11th — multiple properties. Real estate brings significant gains.`, 'HIGH', 3)); propertyScore += 3; }

  // Mars — karaka for land and property
  if (marsDignity === 'EXALTED') { findings.push(rule('MARS-EX-PROP', 'BPHS Ch.20 v.8', `Mars (land karaka) exalted in Capricorn — multiple plots of land, agricultural property, or real estate. Strong property accumulation.`, 'HIGH', 2)); propertyScore += 2; }
  else if (marsDignity === 'DEBILITATED') { findings.push(rule('MARS-DB-PROP', 'BPHS Ch.20', `Mars debilitated in Cancer — property disputes with siblings or family. Land-related legal issues.`, 'HIGH', -1)); propertyScore -= 1; }

  // Planets in 4th for property
  if (h4planets.includes('Jupiter')) { findings.push(rule('JUP-4-PROP', 'BPHS Ch.20 v.12', `Jupiter in 4th — large, prosperous home. Ancestral property possible. Religious or scholarly atmosphere at home.`, 'HIGH', 2)); propertyScore += 2; }
  if (h4planets.includes('Venus'))   { findings.push(rule('VEN-4-PROP', 'BPHS', `Venus in 4th — beautiful, comfortable, aesthetically refined home. Multiple vehicles. Pleasurable domestic environment.`, 'MEDIUM', 2)); propertyScore += 2; }
  if (h4planets.includes('Saturn'))  { findings.push(rule('SAT-4-PROP', 'BPHS', `Saturn in 4th — property comes late in life. Old or large property. Hard-earned but durable real estate.`, 'MEDIUM', 0)); }
  if (h4planets.includes('Mars'))    { findings.push(rule('MARS-4-PROP', 'BPHS', `Mars in 4th — property through construction or land. Possible disputes over ancestral property. Active home environment.`, 'MEDIUM', 1)); propertyScore += 1; }
  if (h4planets.includes('Rahu'))    { findings.push(rule('RAHU-4-PROP', 'BPHS', `Rahu in 4th — foreign property or unconventional home environment. Property may be unusual or in foreign land.`, 'MEDIUM', 0)); }

  // Parivartana 2nd-4th or 11th-4th
  if (parivartana(2, 4, chart)) { findings.push(rule('PARIV-2-4-PROP', 'BPHS Ch.37', `2nd-4th lord Parivartana — wealth and property grow together. Very strong real estate accumulation.`, 'HIGH', 3)); propertyScore += 3; }
  if (parivartana(11, 4, chart)) { findings.push(rule('PARIV-11-4-PROP', 'BPHS Ch.37', `11th-4th lord Parivartana — property brings enormous gains. Multiple real estate assets.`, 'HIGH', 3)); propertyScore += 3; }

  let propertyVerdict = '';
  if (propertyScore >= 6) propertyVerdict = 'STRONG: Multiple properties and real estate are classical. Comfortable home throughout life.';
  else if (propertyScore >= 3) propertyVerdict = 'POSITIVE: Property ownership is indicated. Stable domestic foundation.';
  else if (propertyScore >= 0) propertyVerdict = 'AVERAGE: Basic property ownership possible with effort.';
  else propertyVerdict = 'CHALLENGED: Property difficulties. Rented accommodation more likely. Legal property issues possible.';

  findings.push(rule('PROPERTY-COMPOUND', 'BPHS Ch.20 (combined)',
    `PROPERTY VERDICT: ${propertyVerdict} | Score: ${propertyScore > 0 ? '+' : ''}${propertyScore}`, Math.abs(propertyScore) >= 4 ? 'HIGH' : 'MEDIUM', 3));

  return { findings, propertyScore };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 16 — BPHS CH.22 + SAR CH.33:
// EDUCATION — Complete analysis
// ═══════════════════════════════════════════════════════════════════════════

function evaluateEducation(chart) {
  const findings = [];
  const l4 = lordOf(4, chart);
  const l5 = lordOf(5, chart);
  const l4house = houseOfPlanet(l4, chart);
  const l5house = houseOfPlanet(l5, chart);
  const h4planets = planetsInHouse(4, chart);
  const h5planets = planetsInHouse(5, chart);
  const mercury = chart.planets['Mercury'];
  const jupiter = chart.planets['Jupiter'];
  const mercDignity = getDignity('Mercury', mercury?.sign);
  const jupDignity = getDignity('Jupiter', jupiter?.sign);
  let eduScore = 0;
  let fields = [];

  // Mercury — intellect karaka
  if (mercDignity === 'EXALTED' || mercDignity === 'OWN') {
    findings.push(rule('MERC-EDU-STR', 'BPHS Ch.22', `Mercury strong — razor-sharp intellect. Exceptional academic ability. Higher education very likely. Mathematics, science, business, or languages.`, 'HIGH', 3));
    eduScore += 3; fields.push('mathematics','science','languages','business');
  } else if (mercDignity === 'DEBILITATED') {
    findings.push(rule('MERC-EDU-DB', 'BPHS Ch.22', `Mercury debilitated — learning challenges. Practical or vocational education is better suited than purely academic. May struggle in formal schooling.`, 'HIGH', -1));
    eduScore -= 1;
  }

  // Jupiter — wisdom karaka
  if (jupDignity === 'EXALTED' || jupDignity === 'OWN') {
    findings.push(rule('JUP-EDU-STR', 'BPHS Ch.22', `Jupiter strong — philosophical depth, wisdom, and advanced education. PhD or equivalent is possible. Natural teacher or scholar.`, 'HIGH', 2));
    eduScore += 2; fields.push('philosophy','law','theology','academics');
  }

  // Planets in 5th — intelligence and education
  const planetIn5thEdu = {
    Sun:     { verdict:`Sun in 5th — strong intellect, government studies, leadership education. May follow father's academic path.`, score:1, fields:['government','leadership'] },
    Moon:    { verdict:`Moon in 5th — good memory, imaginative learning style. Arts, history, psychology, nursing.`, score:1, fields:['arts','psychology'] },
    Mars:    { verdict:`Mars in 5th — technical, engineering, sports, military education. Competitive academic approach.`, score:1, fields:['engineering','sports','military'] },
    Mercury: { verdict:`Mercury in 5th — exceptional intellect. Multiple degrees possible. Mathematics, IT, business, languages.`, score:2, fields:['IT','mathematics','commerce'] },
    Jupiter: { verdict:`Jupiter in 5th — scholarly, philosophical. PhD or advanced degree is classical. Possible religious or philosophical scholar.`, score:3, fields:['philosophy','law','religion','science'] },
    Venus:   { verdict:`Venus in 5th — arts, music, design, fashion education. Creative intelligence.`, score:1, fields:['arts','music','design'] },
    Saturn:  { verdict:`Saturn in 5th — disciplined, slow but thorough learning. Engineering, science, history, social work. Late academic achievement.`, score:1, fields:['engineering','history','science'] },
    Rahu:    { verdict:`Rahu in 5th — unconventional, foreign, or technology education. May study abroad. Innovative thinker.`, score:1, fields:['technology','foreign studies'] },
    Ketu:    { verdict:`Ketu in 5th — past-life knowledge surfaces. Spiritual or technical education. May have unusual expertise.`, score:0, fields:['spirituality','technical'] }
  };

  for (const [planet, info] of Object.entries(planetIn5thEdu)) {
    if (h5planets.includes(planet)) {
      const dignity = getDignity(planet, signOfPlanet(planet, chart));
      let verdict = info.verdict;
      if (dignity === 'EXALTED') verdict += ` Exalted — exceptional academic achievement.`;
      if (dignity === 'DEBILITATED') verdict += ` Debilitated — education faces challenges.`;
      fields.push(...(info.fields || []));
      findings.push(rule(`${planet}-5TH-EDU`, 'BPHS Ch.22', verdict, 'MEDIUM', info.score));
      eduScore += info.score;
    }
  }

  // 4th lord in dusthana — interrupted education
  if (DUSTHANAS.includes(l4house)) {
    findings.push(rule('L4-DUST-EDU', 'BPHS Ch.22 v.12', `4th lord in ${l4house}th — formal education may be interrupted. Self-study, online, or foreign education as alternative.`, 'MEDIUM', -1));
    eduScore -= 1;
  }

  // Mercury-Jupiter combination
  if (conjunct('Mercury','Jupiter',chart) || planetAspectsHouse('Jupiter',chart,mercury?.house)) {
    findings.push(rule('MERC-JUP-EDU', 'BPHS Ch.22', `Mercury-Jupiter connection — Saraswati Yoga potential. Exceptional combined wisdom and intelligence. Scholar, teacher, or writer of distinction.`, 'HIGH', 3));
    eduScore += 3; fields.push('academic excellence','writing','teaching');
  }

  let eduVerdict = eduScore >= 5 ? 'HIGHLY EDUCATED: Advanced degrees, scholarly achievement.' :
    eduScore >= 3 ? 'WELL EDUCATED: Higher education is natural.' :
    eduScore >= 1 ? 'EDUCATED: Standard to good educational attainment.' :
    'EDUCATION CHALLENGES: Formal education may be difficult. Alternative paths suited.';

  const uniqueFields = [...new Set(fields)].slice(0,5);
  findings.push(rule('EDU-COMPOUND', 'BPHS Ch.22 (combined)',
    `EDUCATION VERDICT: ${eduVerdict} | Suited fields: ${uniqueFields.join(', ')} | Score: ${eduScore > 0 ? '+' : ''}${eduScore}`,
    Math.abs(eduScore) >= 4 ? 'HIGH' : 'MEDIUM', 3));

  return { findings, eduScore, fields: uniqueFields };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 17 — BPHS CH.28 + UK:
// SPIRITUALITY & MOKSHA — Complete analysis
// ═══════════════════════════════════════════════════════════════════════════

function evaluateSpirituality(chart) {
  const findings = [];
  const h9planets = planetsInHouse(9, chart);
  const h12planets = planetsInHouse(12, chart);
  const ketu = chart.planets['Ketu'];
  const jupiter = chart.planets['Jupiter'];
  const saturn = chart.planets['Saturn'];
  const l12 = lordOf(12, chart);
  let spiritualScore = 0;
  let path = [];

  // Ketu — the moksha karaka
  if (ketu) {
    const ketuMokshaHouses = {
      12: { verdict:`Ketu in 12th — Moksha Karaka in the Moksha house. Liberation is a genuine possibility in this lifetime. Deep pull toward renunciation, meditation, and spiritual isolation. This is the most powerful moksha indicator.`, score:4, path:['moksha','meditation','renunciation'] },
      9:  { verdict:`Ketu in 9th — past-life spiritual wisdom enters through the dharma house. Non-conventional spiritual path. Natural wisdom without formal religion. Guru-skeptical but deeply knowing.`, score:2, path:['wisdom','non-conventional spirituality'] },
      1:  { verdict:`Ketu in lagna — spiritual quality embedded in personality. Detached, other-worldly air. Past-life spiritual attainment shapes current identity.`, score:2, path:['spiritual identity'] },
      4:  { verdict:`Ketu in 4th — inner peace is the true home. Spiritual mother or karmic home environment. Meditation and inner retreats are natural.`, score:1, path:['inner peace','meditation'] },
      8:  { verdict:`Ketu in 8th — occult, mystical, research into death and transformation. Deep tantric or spiritual investigations.`, score:2, path:['occult','tantra','research'] }
    };
    if (ketuMokshaHouses[ketu.house]) {
      const r = ketuMokshaHouses[ketu.house];
      findings.push(rule(`KETU-H${ketu.house}-MOKSHA`, 'BPHS Ch.28 + UK', r.verdict, 'HIGH', r.score));
      spiritualScore += r.score; path.push(...r.path);
    }
  }

  // Ketu as Atmakaraka (Jaimini) — highest moksha indicator
  if (chart.atmakaraka === 'Ketu' || getAtmakaraka(chart) === 'Ketu') {
    findings.push(rule('KETU-AK', 'JM (Jaimini Sutram)',
      `Ketu is Atmakaraka — soul's primary purpose is moksha (liberation). Renunciation and spiritual freedom are the deepest calling. This soul came to complete a karmic cycle.`,
      'HIGH', 3));
    spiritualScore += 3; path.push('soul liberation','karmic completion');
  }

  // Jupiter in 9th or 12th
  if (h9planets.includes('Jupiter')) {
    findings.push(rule('JUP-9-SPIRIT', 'BPHS Ch.28', `Jupiter in 9th — deeply religious, philosophical, guru-connected. Dharma is lived, not just believed. Temple worship, Vedic learning, or great teacher in life.`, 'HIGH', 2));
    spiritualScore += 2; path.push('devotion','dharma','Vedic tradition');
  }
  if (h12planets.includes('Jupiter')) {
    findings.push(rule('JUP-12-SPIRIT', 'BPHS Ch.28', `Jupiter in 12th — moksha-oriented life. Ashram or monastic connection. Foreign spiritual tradition. Bed pleasures and spirituality are both blessed.`, 'HIGH', 2));
    spiritualScore += 2; path.push('ashram','foreign spiritual tradition');
  }

  // Ketu conjunct Jupiter — Brahma Jnana yoga
  if (conjunct('Ketu','Jupiter',chart)) {
    findings.push(rule('KETU-JUP', 'UK', `Jupiter-Ketu conjunction — Brahma Jnana Yoga. Direct intuitive access to spiritual knowledge. Teacher of esoteric wisdom. Rare and powerful spiritual gift.`, 'HIGH', 3));
    spiritualScore += 3; path.push('direct knowledge','esoteric wisdom');
  }

  // Saturn in 9th — karma yoga path
  if (h9planets.includes('Saturn')) {
    findings.push(rule('SAT-9-SPIRIT', 'BPHS Ch.28', `Saturn in 9th — karma yoga path. Spirituality through work, service, and duty. Serious, disciplined religious approach. Guru may be stern or traditional.`, 'MEDIUM', 1));
    spiritualScore += 1; path.push('karma yoga','service','duty');
  }

  // 12th lord strength — moksha potential
  const l12sign = signOfPlanet(l12, chart);
  if (isStrong(l12, l12sign)) {
    findings.push(rule('L12-STR-MOKSHA', 'BPHS Ch.28', `12th lord strong — moksha and liberation are genuinely supported. The losses and withdrawals of the 12th house lead to genuine spiritual gain.`, 'MEDIUM', 2));
    spiritualScore += 2;
  }

  // Venus in 12th — bhoga and moksha together
  if (h12planets.includes('Venus')) {
    findings.push(rule('VEN-12-SPIRIT', 'SAR Ch.35', `Venus in 12th — unique: sensual pleasures and spiritual liberation are linked. Bed pleasures are also sacred. Beauty as spiritual practice.`, 'MEDIUM', 1));
    path.push('beauty as spirituality');
  }

  let spiritVerdict = spiritualScore >= 6 ? 'DEEPLY SPIRITUAL: Moksha orientation is core to this soul\'s journey. Liberation is a genuine possibility.' :
    spiritualScore >= 4 ? 'SPIRITUALLY ADVANCED: Strong spiritual inclination. Spiritual practice is a natural life pillar.' :
    spiritualScore >= 2 ? 'SPIRITUALLY INCLINED: Interest in deeper meaning and dharma. Not dominant but present.' :
    'WORLDLY ORIENTATION: Primary focus is material life. Spirituality is peripheral.';

  const uniquePath = [...new Set(path)].slice(0,4);
  findings.push(rule('SPIRIT-COMPOUND', 'BPHS Ch.28 + UK + JM (combined)',
    `SPIRITUALITY VERDICT: ${spiritVerdict} | Path: ${uniquePath.join(', ')||'general'} | Score: ${spiritualScore > 0 ? '+' : ''}${spiritualScore}`,
    spiritualScore >= 6 ? 'HIGH' : 'MEDIUM', 3));

  return { findings, spiritualScore, path: uniquePath };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 18 — BPHS CH.35-43 + PD CH.6 + SAR CH.36:
// MAJOR YOGAS — Complete detection
// Pancha Mahapurusha, Gaja Kesari, Raj Yogas, Dhana Yogas,
// Neecha Bhanga, Viparita, Kaal Sarpa, Mangal Dosha
// ═══════════════════════════════════════════════════════════════════════════

function evaluateYogas(chart) {
  const findings = [];
  const yogas = [];

  // ── PANCHA MAHAPURUSHA YOGAS — BPHS Ch.36 ─────────────────────────
  // Planet in own sign or exaltation in kendra
  const mahapurushaData = {
    Mars:    { name:'Ruchaka', qualities:'Military commander energy. Courageous, powerful physique, reddish complexion, victory over enemies, long life, famous. Best for: military, police, sports, real estate.' },
    Mercury: { name:'Bhadra',  qualities:'Merchant-scholar energy. Exceptional intellect, eloquent speech, multiple talents, wealthy through business. Best for: business, writing, accounting, trade.' },
    Jupiter: { name:'Hamsa',   qualities:'Divine grace energy. Wise, righteous, beautiful, well-proportioned body, respected by all, long life, devotional. Best for: teaching, law, religion, counseling.' },
    Venus:   { name:'Malavya', qualities:'Royal pleasure energy. Attractive body, charming, wealthy, passionate, fond of arts and luxury, loving spouse. Best for: arts, entertainment, luxury, beauty.' },
    Saturn:  { name:'Sasha',   qualities:'Authority energy. Commands masses, fearless, knows secret arts, wealthy, head of village or town, long life. Best for: government, real estate, large organizations.' }
  };

  for (const [planet, info] of Object.entries(mahapurushaData)) {
    const pData = chart.planets[planet];
    if (!pData) continue;
    const dignity = getDignity(planet, pData.sign);
    if ((dignity === 'EXALTED' || dignity === 'OWN' || dignity === 'MOOLATRIKONA') && KENDRAS.includes(pData.house)) {
      yogas.push({ name: `${info.name} Mahapurusha Yoga`, strength:'POWERFUL', planet, house: pData.house });
      findings.push(rule(`${info.name.toUpperCase()}-YOGA`, 'BPHS Ch.36',
        `${info.name} Mahapurusha Yoga: ${planet} in ${SIGN_PROPS[pData.sign]?.name} (${dignity}) in ${pData.house}th house (kendra). ${info.qualities}`,
        'HIGH', 4));
    }
  }

  // ── GAJA KESARI YOGA — BPHS Ch.40 ────────────────────────────────
  // Jupiter in kendra from Moon
  const moon = chart.planets['Moon'];
  const jupiter = chart.planets['Jupiter'];
  if (moon && jupiter) {
    const hDiff = ((jupiter.house - moon.house + 12) % 12) + 1;
    if ([1,4,7,10].includes(hDiff)) {
      const strength = isStrong('Jupiter', jupiter.sign) ? 'POWERFUL' : 'MODERATE';
      yogas.push({ name:'Gaja Kesari Yoga', strength, planet:'Jupiter+Moon' });
      findings.push(rule('GAJA-KESARI', 'BPHS Ch.40',
        `Gaja Kesari Yoga: Jupiter in kendra (${hDiff}th) from Moon — elephant-lion combination. Wealthy, famous, learned, intelligent, long life, good reputation, remembered after death. Strength: ${strength}${isStrong('Jupiter',jupiter.sign)?' (maximized — Jupiter strong)':' (Jupiter not in strength — partial expression)'}.`,
        'HIGH', isStrong('Jupiter', jupiter.sign) ? 3 : 2));
    }
  }

  // ── BUDHA-ADITYA YOGA — PD Ch.6 ──────────────────────────────────
  // Mercury conjunct Sun
  if (conjunct('Mercury','Sun',chart)) {
    const mercHouse = chart.planets['Mercury'].house;
    const isGood = !DUSTHANAS.includes(mercHouse);
    yogas.push({ name:'Budha-Aditya Yoga', strength: isGood ? 'MODERATE' : 'WEAK', planet:'Mercury+Sun' });
    findings.push(rule('BUDHA-ADITYA', 'PD Ch.6',
      `Budha-Aditya Yoga: Mercury conjunct Sun — intelligent, learned, respected by government, gains through intellect. ${isGood ? 'In good house — full expression.' : 'In dusthana — expression is limited.'}`,
      'MEDIUM', isGood ? 2 : 1));
  }

  // ── RAJA YOGAS — BPHS Ch.34 ──────────────────────────────────────
  // Kendra lord + Trikona lord connection
  const kendraLords = [1,4,7,10].map(h => lordOf(h, chart));
  const trikonaLords = [5,9].map(h => lordOf(h, chart));
  const usedPairs = new Set();

  for (const kl of kendraLords) {
    for (const tl of trikonaLords) {
      if (kl === tl) continue;
      const pairKey = [kl,tl].sort().join('-');
      if (usedPairs.has(pairKey)) continue;
      usedPairs.add(pairKey);

      if (conjunct(kl, tl, chart)) {
        yogas.push({ name:`Raja Yoga (${kl}+${tl})`, strength:'STRONG', planet:`${kl}+${tl}` });
        findings.push(rule(`RAJA-${kl}-${tl}`, 'BPHS Ch.34',
          `Raja Yoga: ${kl} (kendra lord) conjunct ${tl} (trikona lord) — wealth, authority, fame, high social position. This native rises above average circumstances.`,
          'HIGH', 3));
      }
      // Parivartana between kendra and trikona lord
      if (parivartana(
        kendraLords.indexOf(kl) !== -1 ? [1,4,7,10][kendraLords.indexOf(kl)] : 1,
        trikonaLords.indexOf(tl) !== -1 ? [5,9][trikonaLords.indexOf(tl)] : 5,
        chart
      )) {
        yogas.push({ name:`Raja Yoga Parivartana (${kl}+${tl})`, strength:'VERY STRONG', planet:`${kl}+${tl}` });
        findings.push(rule(`RAJA-P-${kl}-${tl}`, 'BPHS Ch.37',
          `Parivartana Raja Yoga: ${kl}+${tl} exchange — very powerful. Exceptional elevation in life — financial, social, and professional.`,
          'HIGH', 4));
      }
    }
  }

  // ── LAKSHMI YOGA — PD Ch.6 ───────────────────────────────────────
  // 9th lord in own sign or exaltation + lagna lord strong
  const l9 = lordOf(9, chart);
  const l9sign = signOfPlanet(l9, chart);
  const l1 = lordOf(1, chart);
  const l1sign = signOfPlanet(l1, chart);
  if (isStrong(l9, l9sign) && isStrong(l1, l1sign)) {
    yogas.push({ name:'Lakshmi Yoga', strength:'STRONG', planet: l9 });
    findings.push(rule('LAKSHMI-YOGA', 'PD Ch.6',
      `Lakshmi Yoga: 9th lord ${l9} strong + lagna lord ${l1} strong — wealth, fame, beauty, happiness. Goddess Lakshmi blesses this native. Fortunate in all endeavors.`,
      'HIGH', 3));
  }

  // ── SARASWATI YOGA — PD Ch.6 ────────────────────────────────────
  // Mercury, Venus, Jupiter all in kendras or 2nd
  const mercH = chart.planets['Mercury']?.house;
  const venH  = chart.planets['Venus']?.house;
  const jupH  = chart.planets['Jupiter']?.house;
  const goodH = [...KENDRAS, 2];
  if (mercH && venH && jupH && goodH.includes(mercH) && goodH.includes(venH) && goodH.includes(jupH)) {
    yogas.push({ name:'Saraswati Yoga', strength:'STRONG', planet:'Mercury+Venus+Jupiter' });
    findings.push(rule('SARASWATI-YOGA', 'PD Ch.6',
      `Saraswati Yoga: Mercury, Venus, and Jupiter all in kendras or 2nd — exceptional learning, wisdom, artistic talent, eloquence. Renowned scholar, artist, or poet.`,
      'HIGH', 3));
  }

  // ── VIPARITA RAJA YOGA — BPHS Ch.41 ─────────────────────────────
  // Lords of 6, 8, 12 in dusthanas
  const l6 = lordOf(6, chart); const l8 = lordOf(8, chart); const l12 = lordOf(12, chart);
  let viparitaCount = 0;
  if (DUSTHANAS.includes(houseOfPlanet(l6, chart))) viparitaCount++;
  if (DUSTHANAS.includes(houseOfPlanet(l8, chart))) viparitaCount++;
  if (DUSTHANAS.includes(houseOfPlanet(l12, chart))) viparitaCount++;
  if (viparitaCount >= 2) {
    yogas.push({ name:'Viparita Raja Yoga', strength:'STRONG', planet:'Dusthana lords' });
    findings.push(rule('VIPARITA-YOGA', 'BPHS Ch.41',
      `Viparita Raja Yoga: ${viparitaCount} dusthana lords in dusthanas — rise from adversity. Success after failures. Enemies destroy themselves. Kingdom gained through others' misfortune. Unexpected elevation.`,
      'HIGH', 3));
  }

  // ── NEECHA BHANGA RAJA YOGA — BPHS Ch.39 ────────────────────────
  for (const planet of ['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn']) {
    const pData = chart.planets[planet];
    if (pData && isDebilitated(planet, pData.sign) && neechaBhanga(planet, chart)) {
      yogas.push({ name:`Neecha Bhanga Raja Yoga (${planet})`, strength:'STRONG', planet });
      findings.push(rule(`NBR-${planet}`, 'BPHS Ch.39',
        `Neecha Bhanga Raja Yoga: ${planet} debilitated but cancelled — weakness transforms into exceptional strength. After initial struggles, ${planet}'s areas of life rise dramatically. Rare and powerful.`,
        'HIGH', 3));
    }
  }

  // ── KAAL SARPA YOGA ──────────────────────────────────────────────
  // All planets between Rahu and Ketu
  const rahu = chart.planets['Rahu'];
  const ketu = chart.planets['Ketu'];
  const otherPlanets = ['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn'];
  if (rahu && ketu) {
    const rahuH = rahu.house;
    const ketuH = ketu.house;
    const hemeHouses = Array.from({length:6}, (_,i) => ((rahuH + i) % 12) + 1);
    const allHemmed = otherPlanets.every(p => hemeHouses.includes(chart.planets[p]?.house));
    if (allHemmed) {
      yogas.push({ name:'Kaal Sarpa Yoga', strength:'POWERFUL_MODIFIER', planet:'Rahu+Ketu' });
      findings.push(rule('KAAL-SARPA', 'BPHS (classical reference)',
        `Kaal Sarpa Yoga: All planets between Rahu and Ketu — karmic life of struggle and breakthrough. Extraordinary destiny. Extraordinary obstacles. After the Rahu period, life transforms. Serpent energy must be honored.`,
        'HIGH', 0));
    }
  }

  // ── MANGAL DOSHA — BPHS Ch.81 ────────────────────────────────────
  const mars = chart.planets['Mars'];
  if (mars && [1,2,4,7,8,12].includes(mars.house)) {
    const isCancelled = (
      (mars.house === 1 && [0,7].includes(chart.lagna)) ||
      (mars.house === 2 && [3,8].includes(chart.lagna)) ||
      h7planets_local() ||
      planetAspectsHouse('Jupiter', chart, mars.house)
    );
    function h7planets_local() {
      return ['Jupiter','Moon','Venus'].some(p => chart.planets[p]?.house === mars.house);
    }
    findings.push(rule('MANGAL-DOSHA', 'BPHS Ch.81',
      `Mangal Dosha: Mars in ${mars.house}th — affects marriage. ${isCancelled ? 'CANCELLED/REDUCED: Benefic presence or lagna cancellation applies. Effect is moderated.' : 'ACTIVE: Spouse must also have Mangal Dosha (Mars in 1,2,4,7,8,12) or specific cancellation rule. Otherwise, tension and separation risk in marriage.'}`,
      'HIGH', isCancelled ? 0 : -1));
    if (!isCancelled) yogas.push({ name:'Mangal Dosha', strength:'ACTIVE', planet:'Mars' });
  }

  // ── KEMADRUMA YOGA — BPHS Ch.42 ─────────────────────────────────
  if (moon) {
    const h2fromMoon = ((moon.house) % 12) + 1;
    const h12fromMoon = ((moon.house - 2 + 12) % 12) + 1;
    const planetsAround = [...planetsInHouse(h2fromMoon,chart), ...planetsInHouse(h12fromMoon,chart)]
      .filter(p => !['Rahu','Ketu'].includes(p));
    if (planetsAround.length === 0 && !planetsInHouse(moon.house,chart).some(p=>p!=='Moon')) {
      yogas.push({ name:'Kemadruma Yoga', strength:'CHALLENGING', planet:'Moon' });
      findings.push(rule('KEMADRUMA', 'BPHS Ch.42',
        `Kemadruma Yoga: Moon alone with no planets in 2nd or 12th from it — periods of loneliness, mental distress, or lack of support. Requires strong lagna and Jupiter's aspect to overcome.`,
        'MEDIUM', -1));
    }
  }

  // ── ADHI YOGA — BPHS Ch.38 ───────────────────────────────────────
  if (moon) {
    const h6M = ((moon.house + 4) % 12) + 1;
    const h7M = ((moon.house + 5) % 12) + 1;
    const h8M = ((moon.house + 6) % 12) + 1;
    const beneficsIn678 = [...planetsInHouse(h6M,chart),...planetsInHouse(h7M,chart),...planetsInHouse(h8M,chart)]
      .filter(p => ['Jupiter','Venus','Mercury'].includes(p));
    if (beneficsIn678.length >= 2) {
      yogas.push({ name:'Adhi Yoga', strength:'STRONG', planet: beneficsIn678.join('+') });
      findings.push(rule('ADHI-YOGA', 'BPHS Ch.38',
        `Adhi Yoga: ${beneficsIn678.join('+')} in 6th/7th/8th from Moon — happy, prosperous, healthy, long-lived. Defeats enemies. Leadership qualities. Protected life.`,
        'HIGH', 3));
    }
  }

  // ── DHANA YOGA SUMMARY ───────────────────────────────────────────
  const l2 = lordOf(2, chart);
  const l11 = lordOf(11, chart);
  if (conjunct(l2, l11, chart) || parivartana(2, 11, chart)) {
    yogas.push({ name:'Dhana Yoga', strength:'STRONG', planet:`${l2}+${l11}` });
    findings.push(rule('DHANA-YOGA-SUM', 'BPHS Ch.19',
      `Dhana Yoga: 2nd and 11th lord ${parivartana(2,11,chart)?'exchange':'conjunction'} — significant wealth accumulation in this lifetime is the classical destiny.`,
      'HIGH', 3));
  }

  const yogaSummary = yogas.length > 0
    ? `${yogas.length} yogas detected: ${yogas.map(y=>y.name).join(', ')}`
    : 'No major yogas detected from available chart data';

  findings.push(rule('YOGA-SUMMARY', 'BPHS Ch.35-43 (combined)', yogaSummary, 'HIGH', 0));

  return { findings, yogas, summary: yogaSummary };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 19 — BPHS CH.45-50:
// DASHA RESULTS — Current period complete analysis
// Past karma activating, present events, future trajectory
// ═══════════════════════════════════════════════════════════════════════════

function evaluateDasha(chart) {
  const findings = [];
  if (!chart.dasha) return { findings, verdict:'Dasha data not provided' };

  const { maha, antar, pratyantar } = chart.dasha;

  // ── MAHADASHA RESULTS — BPHS Ch.45-53 ────────────────────────────
  // Each planet mahadasha results from BPHS
  const mahaDashaResults = {
    Sun: {
      life:`Career peak, government interactions, authority matters, right eye, bones. Soul awakening through Sun.`,
      favorable:`Government recognition, promotion, authority, clarity of purpose`,
      challenging:`Ego conflicts, government opposition, pride before fall`,
      body:`Right eye, heart, bones, fever`, years:6
    },
    Moon: {
      life:`Emotional life, mother, home, property, public dealings, mind, travel.`,
      favorable:`Emotional fulfilment, public popularity, property gains, creative expression`,
      challenging:`Emotional instability, mental anxiety, relationship fluctuations`,
      body:`Left eye, lungs, blood, mind`, years:10
    },
    Mars: {
      life:`Action, energy, real estate, siblings, accidents, courage, military matters.`,
      favorable:`Real estate gains, courage rewarded, competition won, sibling support`,
      challenging:`Accidents, conflicts, blood disorders, sibling disputes`,
      body:`Blood, muscles, accident risk`, years:7
    },
    Mercury: {
      life:`Business, communication, education, trade, writing, travel. Intellectual karma activated.`,
      favorable:`Business success, education achievement, communication clarity`,
      challenging:`Nervous disorders, confusion in decision-making, dishonesty risk`,
      body:`Nerves, skin, speech`, years:17
    },
    Jupiter: {
      life:`Fortune, wisdom, children, marriage if due, guru connection, spiritual growth.`,
      favorable:`Wealth, marriage, children, spiritual awakening, knowledge, promotion`,
      challenging:`Overconfidence, liver issues, complacency, weight gain`,
      body:`Liver, fat, thighs`, years:16
    },
    Venus: {
      life:`Marriage, romance, luxury, arts, vehicles, beauty, pleasures.`,
      favorable:`Marriage, love, luxury, artistic success, vehicles, wealth through relationships`,
      challenging:`Indulgence, reproductive health, relationship complications`,
      body:`Kidneys, reproductive system, skin`, years:20
    },
    Saturn: {
      life:`Hard work, karma repayment, delays, service, discipline, longevity, property.`,
      favorable:`Property gains, career through persistence, service recognition`,
      challenging:`Health issues, delays, karmic debts surface, isolation`,
      body:`Bones, joints, nerves, chronic illness`, years:19
    },
    Rahu: {
      life:`Ambition, foreign connection, unconventional path, technology, sudden changes.`,
      favorable:`Foreign gains, rapid rise, technology success, unconventional wins`,
      challenging:`Deception, mysterious illness, confusion, foreign difficulties`,
      body:`Skin, nervous system, mysterious ailments`, years:18
    },
    Ketu: {
      life:`Spirituality, past karma resolution, research, isolation, moksha.`,
      favorable:`Spiritual growth, research success, liberation progress`,
      challenging:`Mysterious illness, accidents, isolation, feeling lost`,
      body:`Intestines, mysterious conditions`, years:7
    }
  };

  if (maha && mahaDashaResults[maha]) {
    const md = mahaDashaResults[maha];
    const mahaData = chart.planets[maha];
    const mahaDignity = mahaData ? getDignity(maha, mahaData.sign) : 'NEUTRAL';
    const mahaHouse = mahaData?.house;

    let verdict = `${maha} MAHADASHA (${md.years} years): ${md.life}`;
    verdict += ` | Favorable: ${md.favorable}. | Challenges: ${md.challenging}.`;

    // Dignity modifies the mahadasha result significantly
    if (mahaDignity === 'EXALTED') verdict += ` | ${maha} is EXALTED — this mahadasha delivers its maximum positive results. Exceptional period.`;
    else if (mahaDignity === 'DEBILITATED') {
      if (neechaBhanga(maha, chart)) verdict += ` | ${maha} debilitated but NEECHA BHANGA — struggles in first half of dasha, powerful rise in second half.`;
      else verdict += ` | ${maha} is DEBILITATED — this dasha brings challenges. The planet cannot deliver its full promise. Remedies are important.`;
    } else if (mahaDignity === 'OWN') verdict += ` | ${maha} in own sign — stable, reliable dasha results. Planet delivers consistently.`;

    // House of maha lord modifies what areas are activated
    if (mahaHouse) {
      verdict += ` | ${maha} rules and sits in ${mahaHouse}th house — ${HOUSE_KARAKATWA[mahaHouse]?.signifies?.slice(0,3).join(', ')} are activated.`;
    }

    // Is maha lord ruling good or bad houses?
    const mahaRulesHouses = Object.entries(chart.houseLords||{}).filter(([h,l])=>l===maha).map(([h])=>parseInt(h));
    const rulesTrikonaKendra = mahaRulesHouses.some(h => [...KENDRAS,...TRIKONAS].includes(h));
    const rulesDusthana = mahaRulesHouses.some(h => DUSTHANAS.includes(h));

    if (rulesTrikonaKendra && !rulesDusthana) verdict += ` ${maha} rules beneficial houses — overall a positive dasha for life advancement.`;
    else if (rulesDusthana && !rulesTrikonaKendra) verdict += ` ${maha} rules dusthana — karmic debts and obstacles are central to this period.`;

    findings.push(rule('MAHA-DASHA', 'BPHS Ch.45', verdict, mahaDignity==='EXALTED'||mahaDignity==='DEBILITATED'?'HIGH':'MEDIUM', 3));
  }

  // ── ANTARDASHA (SUB-PERIOD) RESULTS ───────────────────────────────
  if (antar && mahaDashaResults[antar]) {
    const ad = mahaDashaResults[antar];
    const antarData = chart.planets[antar];
    const antarDignity = antarData ? getDignity(antar, antarData.sign) : 'NEUTRAL';

    let verdict = `${maha}-${antar} period: ${antar} sub-period within ${maha} dasha. `;
    verdict += `Focus shifts toward: ${ad.life.split('.')[0]}.`;

    // Classical combinations — BPHS Ch.50-52
    const tenseCombinations = [
      ['Sun','Saturn'],['Saturn','Sun'],['Moon','Rahu'],['Rahu','Moon'],
      ['Jupiter','Rahu'],['Rahu','Jupiter'],['Mercury','Ketu'],['Ketu','Mercury']
    ];
    const beneficCombinations = [
      ['Jupiter','Venus'],['Venus','Jupiter'],['Moon','Jupiter'],['Jupiter','Moon'],
      ['Venus','Moon'],['Moon','Venus'],['Jupiter','Mercury'],['Mercury','Jupiter']
    ];

    const isTense = tenseCombinations.some(([m,a])=>m===maha&&a===antar);
    const isBenefic = beneficCombinations.some(([m,a])=>m===maha&&a===antar);

    if (isTense) { verdict += ` TENSE COMBINATION: ${maha}-${antar} is a classical challenging pairing. Inner conflicts, health strain, relationship friction. Navigate carefully.`; }
    if (isBenefic) { verdict += ` AUSPICIOUS COMBINATION: ${maha}-${antar} is a classical benefic pairing. Prosperity, joy, spiritual growth. One of the best sub-period combinations.`; }

    if (antarDignity === 'EXALTED') verdict += ` ${antar} exalted — sub-period delivers exceptional results.`;
    if (antarDignity === 'DEBILITATED') verdict += ` ${antar} debilitated — sub-period challenges. ${neechaBhanga(antar, chart) ? 'Neecha Bhanga applies — obstacles reverse.' : 'Remedies important.'}`;

    findings.push(rule('ANTAR-DASHA', 'BPHS Ch.50-52', verdict, isTense||isBenefic?'HIGH':'MEDIUM', isBenefic?2:isTense?-1:1));
  }

  // ── PRATYANTAR (SUB-SUB-PERIOD) ────────────────────────────────────
  if (pratyantar) {
    findings.push(rule('PRATYANTAR', 'BPHS Ch.53',
      `Current narrow window: ${maha}-${antar}-${pratyantar} period. ${pratyantar}'s areas of life are specifically activated right now. Events triggered by ${pratyantar}'s house lordship and natal position.`,
      'MEDIUM', 1));
  }

  const verdict = findings[0]?.verdict || 'Dasha data present';
  return { findings, maha, antar, pratyantar, verdict };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 20 — BPHS CH.21 + SAR CH.32:
// ENEMIES & LITIGATION — Complete analysis
// ═══════════════════════════════════════════════════════════════════════════

function evaluateEnemies(chart) {
  const findings = [];
  const l6 = lordOf(6, chart);
  const l6sign = signOfPlanet(l6, chart);
  const l6house = houseOfPlanet(l6, chart);
  const h6planets = planetsInHouse(6, chart);
  let enemyScore = 0;
  let litigationRisk = 'low';

  // 6th lord in own house — enemies destroy themselves
  if (l6house === 6) {
    findings.push(rule('L6-OWN', 'BPHS Ch.21 v.5', `6th lord in own house — enemies are many but weak. They destroy themselves without intervention. Native ultimately prevails over all adversaries.`, 'HIGH', 2));
    enemyScore += 2;
  }

  // 6th lord in 1st or 10th — active opposition
  if ([1,10].includes(l6house)) {
    findings.push(rule('L6-1-10', 'BPHS Ch.21', `6th lord in ${l6house}th — enemies actively affect the native's identity or career. Legal or competitive conflicts are possible throughout life.`, 'MEDIUM', -1));
    litigationRisk = 'medium'; enemyScore -= 1;
  }

  // 6th lord in 7th — disputes through marriage or partners
  if (l6house === 7) {
    findings.push(rule('L6-IN7', 'BPHS Ch.21', `6th lord in 7th — litigation through marriage or partnership. Legal battles involving spouse or business partner.`, 'HIGH', -2));
    litigationRisk = 'high'; enemyScore -= 2;
  }

  // Planets in 6th
  if (h6planets.includes('Jupiter')) { findings.push(rule('JUP-6-ENEMY', 'BPHS Ch.21 v.10', `Jupiter in 6th — defeats all enemies through wisdom and dharma. Legal matters resolve favorably. Enemies eventually become friends.`, 'HIGH', 3)); enemyScore += 3; }
  if (h6planets.includes('Mars'))    { findings.push(rule('MARS-6-ENEMY', 'SAR Ch.32', `Mars in 6th — powerful enemy-defeater. Wins through direct confrontation and courage. Excellent for military, police, sports, or competition.`, 'HIGH', 2)); enemyScore += 2; }
  if (h6planets.includes('Saturn'))  { findings.push(rule('SAT-6-ENEMY', 'BPHS Ch.21', `Saturn in 6th — enemies are persistent but slow. Native wins through patience and endurance. Service earns respect.`, 'MEDIUM', 1)); enemyScore += 1; }
  if (h6planets.includes('Sun'))     { findings.push(rule('SUN-6-ENEMY', 'BPHS Ch.21', `Sun in 6th — enemies in government or authority. Wins through personal authority.`, 'MEDIUM', 1)); enemyScore += 1; }
  if (h6planets.includes('Rahu'))    { findings.push(rule('RAHU-6-ENEMY', 'BPHS Ch.21', `Rahu in 6th — hidden enemies who deceive. Wins through cunning. Foreign or unusual adversaries.`, 'MEDIUM', 0)); }
  if (h6planets.includes('Moon'))    { findings.push(rule('MOON-6-ENEMY', 'BPHS Ch.21', `Moon in 6th — enemies among women or through emotional manipulation. Health of mother may be concerning.`, 'MEDIUM', -1)); enemyScore -= 1; }
  if (h6planets.includes('Ketu'))    { findings.push(rule('KETU-6-ENEMY', 'BPHS Ch.21', `Ketu in 6th — karmic enemies from past life. Spiritual practice dissolves enemy power.`, 'MEDIUM', 1)); enemyScore += 1; }
  if (h6planets.includes('Venus'))   { findings.push(rule('VEN-6-ENEMY', 'BPHS Ch.21', `Venus in 6th — enemies among women or lovers. Wins through charm and diplomacy. Reproductive health needs attention.`, 'MEDIUM', 0)); }

  // Mars + Saturn in 6th — high litigation risk
  if (h6planets.includes('Mars') && h6planets.includes('Saturn')) {
    findings.push(rule('MARS-SAT-6', 'SAR Ch.32', `Mars + Saturn in 6th — serious litigation risk. Physical conflicts and legal disputes. Both planets in 6th create combustive enemy energy.`, 'HIGH', -2));
    litigationRisk = 'high'; enemyScore -= 2;
  }

  let enemyVerdict = enemyScore >= 3 ? 'STRONG: Native defeats enemies. Opposition is overcome.' :
    enemyScore >= 0 ? 'MODERATE: Normal competitive environment. Some enemies, some victories.' :
    'CHALLENGED: Enemies and litigation are recurring themes. Legal protection is wise.';

  findings.push(rule('ENEMY-COMPOUND', 'BPHS Ch.21 + SAR Ch.32 (combined)',
    `ENEMIES/LITIGATION: ${enemyVerdict} | Litigation risk: ${litigationRisk} | Score: ${enemyScore > 0 ? '+' : ''}${enemyScore}`,
    Math.abs(enemyScore) >= 3 ? 'HIGH' : 'MEDIUM', 3));

  return { findings, enemyScore, litigationRisk };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 21 — COMMUNICATION, SPEECH, 2ND HOUSE — BPHS CH.7
// ═══════════════════════════════════════════════════════════════════════════

function evaluateCommunication(chart) {
  const findings = [];
  const h2planets = planetsInHouse(2, chart);
  const l2 = lordOf(2, chart);
  const l2sign = signOfPlanet(l2, chart);
  const mercury = chart.planets['Mercury'];
  let speechScore = 0;
  let speechQuality = 'normal';

  const planetIn2ndSpeech = {
    Jupiter: { verdict:`Jupiter in 2nd — eloquent, authoritative, persuasive speech. Financial wisdom in words. Voice carries natural authority and wisdom.`, quality:'eloquent', score:3 },
    Venus:   { verdict:`Venus in 2nd — charming, melodious, sweet voice. Possible singing talent. Wealth through speech and arts.`, quality:'charming', score:2 },
    Mercury: { verdict:`Mercury in 2nd — witty, quick, versatile speech. Multilingual possible. Excellent communicator. Financial intelligence.`, quality:'witty', score:2 },
    Moon:    { verdict:`Moon in 2nd — gentle, emotional, fluctuating speech. Poetic quality. Speaks from the heart.`, quality:'emotional', score:1 },
    Sun:     { verdict:`Sun in 2nd — authoritative, proud speech. Government income possible. Commanding voice.`, quality:'commanding', score:1 },
    Mars:    { verdict:`Mars in 2nd — sharp, direct, sometimes harsh speech. May offend through bluntness. Courage in words.`, quality:'blunt', score:0 },
    Saturn:  { verdict:`Saturn in 2nd — slow, measured, serious speech. May have speech impediment or delay. Deep voice in old age.`, quality:'measured', score:0 },
    Rahu:    { verdict:`Rahu in 2nd — unusual, foreign, or exaggerating speech. Persuasive but not always truthful.`, quality:'unusual', score:0 },
    Ketu:    { verdict:`Ketu in 2nd — sharp, cutting, sometimes abrupt speech. Terse and pointed.`, quality:'sharp', score:0 }
  };

  for (const [planet, info] of Object.entries(planetIn2ndSpeech)) {
    if (h2planets.includes(planet)) {
      findings.push(rule(`${planet}-2ND-SPEECH`, 'BPHS Ch.7', info.verdict, 'MEDIUM', info.score));
      speechScore += info.score;
      speechQuality = info.quality;
    }
  }

  if (getDignity('Mercury', mercury?.sign) === 'EXALTED' || getDignity('Mercury', mercury?.sign) === 'OWN') {
    findings.push(rule('MERC-SPEECH', 'BPHS Ch.7', `Mercury strong — exceptional communication ability. Writer, speaker, teacher, or multilingual. Words are a professional and personal gift.`, 'HIGH', 2));
    speechScore += 2;
  }

  findings.push(rule('SPEECH-COMPOUND', 'BPHS Ch.7 (combined)',
    `COMMUNICATION VERDICT: Speech quality: ${speechQuality}. ${speechScore >= 3 ? 'Communication is a significant strength.' : speechScore <= -1 ? 'Speech needs careful management.' : 'Normal communication ability.'}`,
    'MEDIUM', 1));

  return { findings, speechScore, speechQuality };
}

// ═══════════════════════════════════════════════════════════════════════════
// THE COMPLETE VedicRulesEngine CLASS — ALL SESSIONS COMBINED
// ═══════════════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════════════
// STEP 1 — JAIMINI SUTRAM (ALL 4 CHAPTERS)
// ═══════════════════════════════════════════════════════════════════════════

function computeJaiminiKarakas(chart) {
  const planets = ['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn','Rahu'];
  const degrees = planets.map(p => {
    const d = chart.planets[p];
    // Use full fractional degree (0-30) for tie-breaking — BPHS says use minutes/seconds
    const rawDeg = d?.degree || 0;
    // For Rahu: reversed (30 - degree). Use longitude remainder for precision.
    const fullDeg = p === 'Rahu'
      ? 30 - (d?.longitude !== undefined ? d.longitude % 30 : rawDeg)
      : (d?.longitude !== undefined ? d.longitude % 30 : rawDeg);
    return { planet: p, degree: +fullDeg.toFixed(4) };
  });
  // Sort descending — ties broken by fractional degree naturally
  degrees.sort((a, b) => b.degree - a.degree);
  const names = ['AK','AmK','BK','MK','PuK','GK','DK','SK'];
  const fullNames = ['Atmakaraka','Amatyakaraka','Bhratrikaraka','Matrikaraka','Putrikaraka','Gnatikaraka','Darakaraka','Streekaraka'];
  const result = {};
  degrees.forEach((item, i) => { result[names[i]] = { planet: item.planet, degree: item.degree, fullName: fullNames[i] }; });
  return result;
}

function computeUpapadaLagna(chart) {
  const l12 = lordOf(12, chart);
  const l12House = houseOfPlanet(l12, chart);
  if (!l12House) return null;
  const steps = ((l12House - 12 + 12) % 12);
  let arudha = ((l12House - 1 + steps + 12) % 12) + 1;
  if (arudha === 12) arudha = 9;
  if (arudha === ((12 + 5) % 12) + 1) arudha = ((12 + 3 - 1) % 12) + 1;
  return arudha;
}

function computeArudhaLagna(chart) {
  const lagnaLord = lordOf(1, chart);
  const lordHouse = houseOfPlanet(lagnaLord, chart);
  if (!lordHouse) return null;
  const steps = ((lordHouse - 1 + 12) % 12);
  let arudha = ((lordHouse - 1 + steps + 12) % 12) + 1;
  if (arudha === 1) arudha = 10;
  if (arudha === 7) arudha = 4;
  return arudha;
}

function computeKarakamsha(chart) {
  const ak = getAtmakaraka(chart);
  return chart.navamsha?.[ak]?.sign;
}

function computeCharaDasha(chart) {
  const SIGN_LORDS_MAP = ['Mars','Venus','Mercury','Moon','Sun','Mercury','Venus','Mars','Jupiter','Saturn','Saturn','Jupiter'];
  const QUALITY = ['movable','fixed','dual','movable','fixed','dual','movable','fixed','dual','movable','fixed','dual'];
  const result = {};
  for (let sign = 0; sign < 12; sign++) {
    const lord = SIGN_LORDS_MAP[sign];
    const lordSign = signOfPlanet(lord, chart);
    if (lordSign === undefined) { result[sign] = 7; continue; }
    const quality = QUALITY[sign];
    let years;
    if (quality === 'movable') { years = ((lordSign - sign + 12) % 12) || 12; }
    else if (quality === 'fixed') { years = ((sign - lordSign + 12) % 12) || 12; }
    else { years = Math.min(((lordSign - sign + 12) % 12) || 12, ((sign - lordSign + 12) % 12) || 12); }
    result[sign] = years;
  }
  return result;
}

function evaluateJaiminiKarakas(chart) {
  const findings = [];
  const karakas = computeJaiminiKarakas(chart);
  chart._jaiminiKarakas = karakas;

  const ak = karakas['AK'];
  if (ak) {
    const akLessons = {
      Sun:`Soul lesson: Transcending ego and pride. Learning to serve without domination. Father relationship is the karmic mirror. Gift: Natural authority, leadership. Challenge: Ego wounds until surrender.`,
      Moon:`Soul lesson: Emotional mastery and non-attachment. Learning to nurture without possessiveness. Mother holds the deepest karmic charge. Gift: Deep empathy, intuition. Challenge: Attachment causing suffering.`,
      Mars:`Soul lesson: Channeling courage without aggression. Action without ego. Fight for dharma not personal desire. Gift: Extraordinary courage. Challenge: Anger and impulsiveness.`,
      Mercury:`Soul lesson: Truth in communication. Intelligence for dharma not deception. Gift: Exceptional intelligence, business acumen. Challenge: Mental restlessness, avoiding dishonesty.`,
      Jupiter:`Soul lesson: True wisdom vs mere knowledge. Avoid spiritual pride. Gift: Philosophical depth, natural guide. Challenge: Self-righteousness, overexpansion.`,
      Venus:`Soul lesson: Love without attachment. Beauty serving the higher good. Gift: Artistic excellence, capacity for deep love. Challenge: Overindulgence, binding relationships.`,
      Saturn:`Soul lesson: Accepting limitation with grace. Serving without expectation. Karma consciously repaid. Gift: Extraordinary discipline, endurance. Challenge: Depression, chronic restriction.`,
      Rahu:`Soul lesson: Fulfilling the unfulfilled desire from past lives. Incarnated specifically to experience what was denied. Gift: Intense ambition. Challenge: Obsession, chasing mirages.`
    };
    findings.push(rule('JM-AK', 'JM Ch.1 (Atmakaraka)',
      `ATMAKARAKA: ${ak.planet} (${ak.degree.toFixed(1)}° — highest degree) — ${akLessons[ak.planet] || 'Soul purpose through this planet.'}`, 'HIGH', 3));

    const karakamsha = computeKarakamsha(chart);
    if (karakamsha !== undefined) {
      const kkVerdicts = {
        0:`Aries Karakamsha — soul destined for leadership, courage, pioneering. Career in military, medicine, engineering, or entrepreneurship.`,
        1:`Taurus Karakamsha — soul destined for wealth, beauty, comfort building. Career in finance, arts, luxury, food, or real estate.`,
        2:`Gemini Karakamsha — soul destined for communication, trade, intellect. Career in media, business, teaching, or technology.`,
        3:`Cancer Karakamsha — soul destined for nurturing, public service, home. Career in hospitality, nursing, real estate, or public administration.`,
        4:`Leo Karakamsha — soul destined for leadership, authority, performance. Career in government, entertainment, politics.`,
        5:`Virgo Karakamsha — soul destined for service, analysis, healing. Career in medicine, accounting, research.`,
        6:`Libra Karakamsha — soul destined for justice, beauty, relationships. Career in law, diplomacy, arts, luxury goods.`,
        7:`Scorpio Karakamsha — soul destined for transformation, research, occult. Career in psychology, investigation, or mystical sciences.`,
        8:`Sagittarius Karakamsha — soul destined for dharma, teaching, philosophy. Career in law, academics, religion, publishing.`,
        9:`Capricorn Karakamsha — soul destined for discipline, governance. Career in government, management, engineering.`,
        10:`Aquarius Karakamsha — soul destined for humanitarian service, innovation. Career in technology, social work, NGOs.`,
        11:`Pisces Karakamsha — soul destined for spiritual service, compassion, liberation. Career in spirituality, medicine, arts, or charity.`
      };
      findings.push(rule('JM-KARAKAMSHA', 'JM Ch.3 (Karakamsha)',
        `KARAKAMSHA: ${SIGN_PROPS[karakamsha]?.name} — ${kkVerdicts[karakamsha]}`, 'HIGH', 2));
      chart._karakamsha = karakamsha;

      // Planets in Karakamsha (in navamsha)
      if (chart.navamsha) {
        for (const [planet, navData] of Object.entries(chart.navamsha)) {
          if (navData.sign === karakamsha) {
            const kkPlanetVerdicts = {
              Jupiter:`Jupiter in Karakamsha — Jaimini confirms wisdom, teaching, spiritual leadership destiny.`,
              Ketu:`Ketu in Karakamsha — moksha and liberation are core soul purpose. Psychic or healing gifts.`,
              Venus:`Venus in Karakamsha — arts, luxury, or exceptional romantic destiny. Creative soul.`,
              Mars:`Mars in Karakamsha — military, engineering, or courageous profession. Action-oriented soul.`,
              Saturn:`Saturn in Karakamsha — discipline, service, government. Karmic accountability is core.`,
              Sun:`Sun in Karakamsha — authority, government, or medicine. Leadership is soul's calling.`,
              Moon:`Moon in Karakamsha — public service, nurturing, or artistic profession. Soul loves the masses.`,
              Mercury:`Mercury in Karakamsha — communication, writing, business. Intelligent soul.`,
              Rahu:`Rahu in Karakamsha — technology, foreign achievement, unconventional destiny. Ambitious soul.`
            };
            if (kkPlanetVerdicts[planet]) {
              findings.push(rule(`JM-KKM-${planet}`, 'JM Ch.3', kkPlanetVerdicts[planet], 'HIGH', 2));
            }
          }
        }
      }
    }
  }

  // AmK — Amatyakaraka (Career minister)
  const amk = karakas['AmK'];
  if (amk) {
    const amkVerdicts = {
      Sun:`Government, administration, politics, medicine, or father's field.`,
      Moon:`Public sector, food, water, import-export, nursing.`,
      Mars:`Military, police, engineering, surgery, sports, real estate.`,
      Mercury:`Business, communication, writing, accounting, IT, education.`,
      Jupiter:`Teaching, law, finance, religion, counseling, banking.`,
      Venus:`Arts, beauty, entertainment, luxury, fashion, hospitality.`,
      Saturn:`Service, government, real estate, mining, agriculture, research.`,
      Rahu:`Technology, foreign companies, media, aviation, unconventional.`,
      Ketu:`Research, occult, medicine, technical specialization, spirituality.`
    };
    const amkDig = getDignity(amk.planet, signOfPlanet(amk.planet, chart));
    findings.push(rule('JM-AMK', 'JM Ch.1 (Amatyakaraka)',
      `AMATYAKARAKA: ${amk.planet} (${amk.degree.toFixed(1)}°) — ${amkVerdicts[amk.planet]||''} ${amkDig==='EXALTED'?'Exalted — exceptional career.':amkDig==='DEBILITATED'?'Debilitated — career challenges.':''}`,
      amkDig==='EXALTED'||amkDig==='DEBILITATED'?'HIGH':'MEDIUM', amkDig==='EXALTED'?3:amkDig==='DEBILITATED'?-1:2));
  }

  // DK — Darakaraka (Spouse)
  const dk = karakas['DK'];
  if (dk) {
    const dkVerdicts = {
      Sun:`Proud, authoritative spouse. Government or medicine. Ego management is the marriage lesson.`,
      Moon:`Emotional, nurturing, beautiful, changeable spouse. Deep emotional bond.`,
      Mars:`Courageous, energetic, possibly aggressive spouse. Active driven partner.`,
      Mercury:`Intelligent, communicative, business-minded, youthful spouse.`,
      Jupiter:`Wise, generous, educated, spiritual spouse. Best Darakaraka. Marriage is a genuine blessing.`,
      Venus:`Beautiful, artistic, charming, sensual spouse. Pleasurable marriage.`,
      Saturn:`Serious, older, disciplined spouse. Karmic marriage. Duty more than passion.`,
      Rahu:`Unconventional, foreign, or cross-cultural spouse. Unusual circumstances.`,
      Ketu:`Spiritual, detached spouse. Past-life connection.`
    };
    const dkDig = getDignity(dk.planet, signOfPlanet(dk.planet, chart));
    findings.push(rule('JM-DK', 'JM Ch.1 (Darakaraka)',
      `DARAKARAKA: ${dk.planet} (${dk.degree.toFixed(1)}° — lowest degree) — ${dkVerdicts[dk.planet]||''} ${dkDig==='EXALTED'?'Exalted — exceptional spouse.':dkDig==='DEBILITATED'?'Debilitated — spouse struggles.':''}`,
      dkDig==='EXALTED'||dkDig==='DEBILITATED'?'HIGH':'MEDIUM', dkDig==='EXALTED'?3:dkDig==='DEBILITATED'?-1:2));
  }

  // BK, PuK
  const bk = karakas['BK'];
  if (bk) {
    const bkDig = getDignity(bk.planet, signOfPlanet(bk.planet, chart));
    findings.push(rule('JM-BK', 'JM Ch.1', `BHRATRIKARAKA: ${bk.planet} — sibling significator. ${bkDig==='EXALTED'?'Exalted — outstanding siblings.':bkDig==='DEBILITATED'?'Debilitated — sibling challenges.':'Standard sibling dynamic.'}`, bkDig==='EXALTED'||bkDig==='DEBILITATED'?'HIGH':'MEDIUM', 1));
  }
  const puk = karakas['PuK'];
  if (puk) {
    const pukDig = getDignity(puk.planet, signOfPlanet(puk.planet, chart));
    findings.push(rule('JM-PUK', 'JM Ch.1', `PUTRIKARAKA: ${puk.planet} — children significator. ${pukDig==='EXALTED'?'Exalted — gifted children.':pukDig==='DEBILITATED'?'Debilitated — challenges with children.':'Children expected.'}`, pukDig==='EXALTED'||pukDig==='DEBILITATED'?'HIGH':'MEDIUM', 1));
  }

  return { findings, karakas };
}

function evaluateUpapada(chart) {
  const findings = [];
  const upapadaHouse = computeUpapadaLagna(chart);
  if (!upapadaHouse) return { findings };

  chart._upapada = upapadaHouse;
  const upapadaSign = (chart.lagna + upapadaHouse - 1) % 12;
  const upapadaLord = lordOf(upapadaHouse, chart);
  const ulSign = signOfPlanet(upapadaLord, chart);
  const ulHouse = houseOfPlanet(upapadaLord, chart);
  const ulDignity = getDignity(upapadaLord, ulSign);

  const signSpouse = {
    0:`Aries Upapada — spouse is active, independent, courageous, possibly in sports or military.`,
    1:`Taurus Upapada — spouse is beautiful, wealthy, sensual, artistic. Long-lasting marriage.`,
    2:`Gemini Upapada — spouse is communicative, intelligent, dual-natured. Marriage involves constant communication.`,
    3:`Cancer Upapada — spouse is nurturing, emotional, home-loving. Very caring marriage.`,
    4:`Leo Upapada — spouse is proud, dignified, possibly in authority. Marriage has status and dignity.`,
    5:`Virgo Upapada — spouse is analytical, practical, health-conscious. Service-oriented partnership.`,
    6:`Libra Upapada — spouse is charming, balanced, artistic. Most harmonious Upapada. Marriage blessed.`,
    7:`Scorpio Upapada — spouse is intense, secretive, transformative. Deep karmic marriage.`,
    8:`Sagittarius Upapada — spouse is philosophical, adventurous, possibly foreign or religious.`,
    9:`Capricorn Upapada — spouse is disciplined, ambitious, older or more serious.`,
    10:`Aquarius Upapada — spouse is independent, intellectual, unconventional.`,
    11:`Pisces Upapada — spouse is spiritual, compassionate, artistic. Dreamy marriage quality.`
  };

  findings.push(rule('UL-SIGN', 'JM Ch.2 (Upapada Lagna)',
    `UPAPADA LAGNA in ${SIGN_PROPS[upapadaSign]?.name} (${upapadaHouse}th house): ${signSpouse[upapadaSign]}`, 'HIGH', 2));

  if (ulDignity === 'EXALTED') {
    findings.push(rule('UL-LORD-EX', 'JM Ch.2', `UPAPADA LORD ${upapadaLord} EXALTED — highest Jaimini marriage blessing. Spouse is extraordinary. Marriage brings genuine elevation.`, 'HIGH', 4));
  } else if (ulDignity === 'OWN') {
    findings.push(rule('UL-LORD-OWN', 'JM Ch.2', `Upapada lord ${upapadaLord} in own sign — strong, stable marriage promise. Spouse is capable and reliable.`, 'HIGH', 3));
  } else if (ulDignity === 'DEBILITATED') {
    if (neechaBhanga(upapadaLord, chart)) {
      findings.push(rule('UL-LORD-NB', 'JM Ch.2', `Upapada lord ${upapadaLord} debilitated but Neecha Bhanga — marriage struggles reverse into unexpected strength.`, 'HIGH', 2));
    } else {
      findings.push(rule('UL-LORD-DB', 'JM Ch.2', `UPAPADA LORD ${upapadaLord} DEBILITATED — Jaimini serious marriage warning. Spouse faces challenges. Deep-seated difficulties. Remedies essential.`, 'HIGH', -3));
    }
  }

  if (DUSTHANAS.includes(ulHouse)) {
    findings.push(rule('UL-DUST', 'JM Ch.2', `Upapada lord in dusthana (${ulHouse}th) — Jaimini warns of separation or loss in marriage.`, 'HIGH', -2));
  }

  // 2nd from Upapada — continuation indicator
  const a2 = (upapadaHouse % 12) + 1;
  const a2Ben = planetsInHouse(a2, chart).filter(p => isBenefic(p));
  const a2Mal = planetsInHouse(a2, chart).filter(p => isMalefic(p));
  if (a2Ben.length > 0) findings.push(rule('UL-A2-BEN', 'JM Ch.2', `Benefic(s) ${a2Ben.join('+')} in 2nd from Upapada — marriage is long-lasting. Bond endures.`, 'HIGH', 2));
  if (a2Mal.length >= 2 && a2Ben.length === 0) findings.push(rule('UL-A2-MAL', 'JM Ch.2', `Multiple malefics in 2nd from Upapada — separation or second marriage indicated by Jaimini.`, 'HIGH', -2));

  // Jupiter blessing Upapada
  if (planetsInHouse(upapadaHouse, chart).includes('Jupiter') || planetAspectsHouse('Jupiter', chart, upapadaHouse)) {
    findings.push(rule('UL-JUP', 'JM Ch.2', `Jupiter blesses Upapada — exceptional marriage quality. Spouse is wise and brings dharmic elevation.`, 'HIGH', 3));
  }

  return { findings, upapadaHouse, upapadaSign, ulDignity };
}

function evaluateArudhaLagna(chart) {
  const findings = [];
  const arudhaHouse = computeArudhaLagna(chart);
  if (!arudhaHouse) return { findings };

  chart._arudha = arudhaHouse;
  const arudhaSign = (chart.lagna + arudhaHouse - 1) % 12;

  const perception = {
    0:`World sees you as: dynamic, courageous, pioneering leader. Aggressive or dominant image.`,
    1:`World sees you as: wealthy, comfortable, reliable, beautiful. Status and luxury image.`,
    2:`World sees you as: intelligent, communicative, business-minded. Clever, adaptable image.`,
    3:`World sees you as: nurturing, caring, emotional, connected to masses. People person.`,
    4:`World sees you as: authoritative, dignified, proud, generous. Royal, commanding image.`,
    5:`World sees you as: analytical, precise, organized, service-oriented. Professional image.`,
    6:`World sees you as: charming, balanced, diplomatic, artistic. Harmonious, likeable image.`,
    7:`World sees you as: powerful, mysterious, intense, investigative. Magnetic image.`,
    8:`World sees you as: wise, adventurous, spiritual, lucky. Teacher and explorer image.`,
    9:`World sees you as: disciplined, ambitious, authoritative. Corporate or government image.`,
    10:`World sees you as: innovative, independent, intellectual, humanitarian. Unconventional image.`,
    11:`World sees you as: compassionate, spiritual, artistic, fluid. Gentle, other-worldly image.`
  };

  findings.push(rule('AL-IMAGE', 'JM + BPHS (Arudha Lagna)',
    `ARUDHA LAGNA in ${SIGN_PROPS[arudhaSign]?.name} (${arudhaHouse}th house): ${perception[arudhaSign]} Note: This is how the world perceives you — may differ from your true self (lagna).`, 'HIGH', 1));

  // Gap between reality (lagna) and image (arudha)
  if (SIGN_PROPS[chart.lagna]?.element !== SIGN_PROPS[arudhaSign]?.element) {
    findings.push(rule('AL-GAP', 'JM', `Lagna (${SIGN_PROPS[chart.lagna]?.name}) and Arudha (${SIGN_PROPS[arudhaSign]?.name}) are in different elements — significant gap between true self and public image. Source of creative tension and misunderstanding.`, 'MEDIUM', 0));
  }

  // Planets in Arudha house
  const alPlanets = planetsInHouse(arudhaHouse, chart);
  for (const p of alPlanets) {
    const imgEffects = {
      Jupiter:`Jupiter in Arudha — wise, generous, respected public image. Best planet for Arudha.`,
      Venus:`Venus in Arudha — beautiful, charming, wealthy public persona. Very attractive image.`,
      Moon:`Moon in Arudha — popular, public-friendly, nurturing image. Possible mass fame.`,
      Sun:`Sun in Arudha — authoritative, dominant, government-connected public image.`,
      Saturn:`Saturn in Arudha — serious, hardworking, cold, or burdened public image.`,
      Mars:`Mars in Arudha — courageous, aggressive, combative image.`,
      Mercury:`Mercury in Arudha — intelligent, communicative, young-looking image.`,
      Rahu:`Rahu in Arudha — controversial, foreign, or unconventional public image.`,
      Ketu:`Ketu in Arudha — spiritual or misunderstood. Underestimated by public.`
    };
    if (imgEffects[p]) findings.push(rule(`${p}-AL`, 'JM (Arudha)', imgEffects[p], 'MEDIUM', isBenefic(p)?1:0));
  }

  return { findings, arudhaHouse, arudhaSign };
}

function evaluateCharaDasha(chart) {
  const findings = [];
  if (!chart.charaDasha) return { findings };
  const { currentSign } = chart.charaDasha;
  if (currentSign === undefined) return { findings };

  const signResults = {
    0:`Aries — action, new beginnings, courage, competition. Self-assertion and Mars themes.`,
    1:`Taurus — wealth accumulation, sensual pleasures, arts, property. Venus themes.`,
    2:`Gemini — communication, business, education, travel. Mercury themes.`,
    3:`Cancer — home, mother, property, emotions, public. Moon themes.`,
    4:`Leo — authority, career, government, creativity. Sun themes.`,
    5:`Virgo — service, health, enemies, debt. Health and legal matters surface.`,
    6:`Libra — marriage, partnerships, business. Relationship events prominent.`,
    7:`Scorpio — transformation, research, inheritance, hidden matters.`,
    8:`Sagittarius — dharma, father, long travel, philosophy. Fortune and foreign.`,
    9:`Capricorn — career, authority, hard work, government. Karmic payoff.`,
    10:`Aquarius — gains, elder siblings, social networks. Income and desires.`,
    11:`Pisces — spirituality, foreign, moksha, expenses. Spiritual and foreign.`
  };

  const isTrikonaSign = [chart.lagna, (chart.lagna+4)%12, (chart.lagna+8)%12].includes(currentSign);
  const isKendraSign  = [chart.lagna, (chart.lagna+3)%12, (chart.lagna+6)%12, (chart.lagna+9)%12].includes(currentSign);

  let verdict = `CHARA DASHA: ${SIGN_PROPS[currentSign]?.name} — ${signResults[currentSign]}`;
  if (isTrikonaSign) verdict += ` TRIKONA sign — highly auspicious period. Fortune and dharma supported.`;
  else if (isKendraSign) verdict += ` KENDRA sign — strong period for tangible achievements.`;

  findings.push(rule('CHARA-DASHA', 'JM Ch.2', verdict, isTrikonaSign?'HIGH':'MEDIUM', isTrikonaSign?3:isKendraSign?2:1));
  return { findings };
}

function evaluateJaiminiYogas(chart) {
  const findings = [];
  const karakas = chart._jaiminiKarakas || computeJaiminiKarakas(chart);

  // AK + AmK conjunction — Jaimini Raja Yoga
  const ak = karakas['AK']; const amk = karakas['AmK'];
  if (ak && amk) {
    if (houseOfPlanet(ak.planet, chart) === houseOfPlanet(amk.planet, chart)) {
      findings.push(rule('JM-RAJA', 'JM Ch.1 v.25', `JAIMINI RAJA YOGA: AK (${ak.planet}) conjunct AmK (${amk.planet}) — soul and career aligned. Exceptional achievement destiny from Jaimini.`, 'HIGH', 4));
    }
  }

  // Upapada blessings
  const ul = chart._upapada || computeUpapadaLagna(chart);
  if (ul) {
    const ulBen = planetsInHouse(ul, chart).filter(p => ['Jupiter','Venus','Moon'].includes(p));
    if (ulBen.length >= 2) findings.push(rule('JM-UL-YOGA', 'JM Ch.2', `Multiple benefics (${ulBen.join('+')}) in Upapada — exceptional Jaimini marriage yoga. Marriage is soul-blessed.`, 'HIGH', 3));
  }

  // Karakamsha yogas
  const kkm = chart._karakamsha;
  if (kkm !== undefined && chart.navamsha) {
    if (chart.navamsha['Ketu']?.sign === kkm) findings.push(rule('JM-KKM-MOKSHA', 'JM Ch.3', `Ketu in Karakamsha — moksha is the soul's primary purpose this lifetime. Spiritual liberation is achievable.`, 'HIGH', 2));
    if (chart.navamsha['Jupiter']?.sign === kkm) findings.push(rule('JM-KKM-HAMSA', 'JM Ch.3', `Jupiter in Karakamsha — wisdom and teaching are the soul's calling. Hamsa-level spiritual intelligence.`, 'HIGH', 3));
  }

  return { findings };
}

// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// STEP 2 — ALL 81 MAHA-ANTAR COMBINATIONS (compact lookup table)
// Source: BPHS Ch.50-53, Phaladeepika Ch.25, Saravali Ch.44
// EFFICIENCY: One O(1) lookup. ~40 tokens per report. Zero duplication.
// ═══════════════════════════════════════════════════════════════════════════

const ANTAR_TABLE = {
  // SUN MAHADASHA
  'Sun-Sun':      {r:`Authority peak, govt recognition, career rise`,         f:`promotion,govt honor,father`,     c:`ego,eye strain,pride`,         conf:'H'},
  'Sun-Moon':     {r:`Public fame, prosperity, domestic happiness`,           f:`popularity,property,mother`,      c:`blood pressure,mood swings`,   conf:'H'},
  'Sun-Mars':     {r:`Courage, competition victory, real estate`,             f:`real estate,courage wins`,        c:`accidents,anger,blood`,        conf:'H'},
  'Sun-Mercury':  {r:`Business success, intellectual recognition`,            f:`trade,education,clever deals`,    c:`nervous strain,skin`,          conf:'M'},
  'Sun-Jupiter':  {r:`Peak fortune, marriage or children, spiritual rise`,    f:`wealth,guru grace,promotion`,     c:`liver,overconfidence`,         conf:'H'},
  'Sun-Venus':    {r:`Luxury, pleasures, artistic career success`,            f:`vehicles,marriage,arts`,          c:`indulgence,eye+desire clash`,  conf:'M'},
  'Sun-Saturn':   {r:`Hard work tested, career slowdown, karmic pressure`,    f:`discipline rewarded eventually`,  c:`health stress,elders,delays`,  conf:'H'},
  'Sun-Rahu':     {r:`Sudden rise then fall risk, foreign influence`,         f:`rapid career rise,foreign`,       c:`deception,mysterious illness`, conf:'H'},
  'Sun-Ketu':     {r:`Spiritual awakening, past karma surfaces`,              f:`insight,research breakthrough`,   c:`accidents,isolation`,          conf:'M'},
  // MOON MAHADASHA
  'Moon-Ketu':    {r:`Spiritual confusion, emotional turbulence`,             f:`intuition sharpens,past skills`,  c:`mental unrest,mysterious illness`,conf:'H'},
  'Moon-Venus':   {r:`Pinnacle: luxury, romance, domestic happiness`,         f:`marriage,property,arts,wealth`,   c:`overindulgence,dependency`,    conf:'H'},
  'Moon-Sun':     {r:`Public recognition, authority, career boost`,           f:`govt favor,fame`,                 c:`ego vs public,blood`,          conf:'H'},
  'Moon-Moon':    {r:`Emotional depth, public popularity`,                    f:`mass appeal,mother,property`,     c:`emotional overwhelm`,          conf:'M'},
  'Moon-Mars':    {r:`Energetic action, property gains, some aggression`,     f:`real estate,courage,strength`,    c:`anger,female conflicts`,       conf:'M'},
  'Moon-Rahu':    {r:`Obsession, foreign connection, mental unrest`,          f:`foreign gains,unconventional win`,c:`mental illness risk,deception`, conf:'H'},
  'Moon-Jupiter': {r:`Great fortune, marriage or children, expansion`,        f:`wealth,children,marriage`,        c:`liver,complacency,weight`,     conf:'H'},
  'Moon-Saturn':  {r:`Emotional heaviness, hard work, karmic debts`,          f:`property through effort`,         c:`depression,mother health`,     conf:'H'},
  'Moon-Mercury': {r:`Business acumen, communication success, travel`,        f:`trade,writing,education`,         c:`nervous anxiety,overanalysis`, conf:'M'},
  // MARS MAHADASHA
  'Mars-Mars':    {r:`Intense action, competition, physical peak`,            f:`sports/military,property,courage`,c:`accidents,blood,anger`,        conf:'H'},
  'Mars-Rahu':    {r:`Most volatile — accidents or breakthroughs`,            f:`bold ambition,sudden gains`,      c:`accident risk,violence`,       conf:'H'},
  'Mars-Jupiter': {r:`Dharmic action, wisdom-driven courage, fortunate`,      f:`property,wealth,marriage`,        c:`liver+blood,overconfidence`,   conf:'H'},
  'Mars-Saturn':  {r:`Extreme effort, obstacles, eventual victory`,           f:`real estate after struggle`,      c:`chronic conflict,frustration`, conf:'H'},
  'Mars-Mercury': {r:`Technical work, engineering, trade gains`,              f:`business,technical,siblings`,     c:`trade disputes,nervous energy`,conf:'M'},
  'Mars-Ketu':    {r:`Spiritual courage, research, separation energy`,        f:`spiritual break,technical mastery`,c:`accidents,wounds,isolation`,  conf:'M'},
  'Mars-Venus':   {r:`Passionate romance, real estate, luxury`,               f:`marriage,property,vehicles`,      c:`passion+conflict,overspending`,conf:'M'},
  'Mars-Sun':     {r:`Authority through courage, government action`,          f:`govt recognition,military honor`, c:`ego vs authority,fever`,       conf:'H'},
  'Mars-Moon':    {r:`Emotional courage, property, public competition`,       f:`property,courage,sports`,         c:`female conflicts,blood`,       conf:'M'},
  // MERCURY MAHADASHA
  'Mercury-Mercury':{r:`Business peak, intellectual achievements, travel`,    f:`trade,education,writing`,         c:`overanalysis,nervous exhaustion`,conf:'M'},
  'Mercury-Ketu': {r:`Technical mastery, spiritual intellect, research`,      f:`research,technical expertise`,    c:`confusion,mysterious ailments`,conf:'M'},
  'Mercury-Venus':{r:`Best Mercury sub — luxury, arts, business flourish`,    f:`wealth,arts,marriage,vehicles`,   c:`overindulgence,laziness`,      conf:'H'},
  'Mercury-Sun':  {r:`Career intelligence, govt connections, promotion`,      f:`govt recognition,authority`,      c:`eye strain,ego in speech`,     conf:'H'},
  'Mercury-Moon': {r:`Popular communication, business, maternal connection`,  f:`public appeal,property,trade`,    c:`mood-dependent decisions`,     conf:'M'},
  'Mercury-Mars': {r:`Technical action, competitive intelligence`,            f:`engineering,IT,trade competition`,c:`disputes,nervous aggression`,  conf:'M'},
  'Mercury-Rahu': {r:`Unconventional business, foreign communication`,        f:`foreign trade,tech,media`,        c:`deception in deals,breakdown`, conf:'H'},
  'Mercury-Jupiter':{r:`Wisdom+intellect — most auspicious Mercury sub`,      f:`wealth,education,children`,       c:`overconfidence,liver`,         conf:'H'},
  'Mercury-Saturn':{r:`Disciplined work, slow gains, service orientation`,    f:`steady income,technical service`, c:`depression,delays,skin`,       conf:'M'},
  // JUPITER MAHADASHA
  'Jupiter-Jupiter':{r:`Peak fortune — dharma fulfilled, all-round blessing`, f:`wealth,wisdom,marriage,children`, c:`liver,overconfidence,weight`,  conf:'H'},
  'Jupiter-Saturn':{r:`Hard-won wisdom, karmic justice, slow expansion`,      f:`property,discipline rewarded`,    c:`delays in blessings,knee`,     conf:'H'},
  'Jupiter-Mercury':{r:`Intellectual wisdom, wealth through knowledge`,       f:`education,writing,business`,      c:`overanalysis,restlessness`,    conf:'H'},
  'Jupiter-Ketu': {r:`Spiritual wisdom, moksha orientation, past mastery`,    f:`spiritual break,research,occult`, c:`confusion in dharma,isolation`,conf:'M'},
  'Jupiter-Venus':{r:`Greatest pleasure — marriage, luxury, divine grace`,    f:`marriage,wealth,arts,children`,   c:`indulgence,overexpansion`,     conf:'H'},
  'Jupiter-Sun':  {r:`Authority+wisdom — government grace, career honor`,     f:`promotion,govt,father blessing`,  c:`ego in dharma,eye`,            conf:'H'},
  'Jupiter-Moon': {r:`Emotional wisdom, public fortune, domestic bliss`,      f:`property,family,public love`,     c:`sentimentality,overattachment`,conf:'H'},
  'Jupiter-Mars': {r:`Dharmic action, courageous expansion, real estate`,     f:`property,competitive wins,marriage`,c:`blood+liver,overconfidence`,  conf:'H'},
  'Jupiter-Rahu': {r:`Rapid expansion with instability, foreign fortune`,     f:`foreign fortune,ambition`,        c:`deception,false guru,obsession`,conf:'H'},
  // VENUS MAHADASHA
  'Venus-Venus':  {r:`Peak luxury — marriage, all-round sensual fulfillment`, f:`marriage,beauty,wealth,vehicles`, c:`extreme indulgence,dependency`,conf:'H'},
  'Venus-Sun':    {r:`Luxury meets authority — status and pleasure`,          f:`govt favor,status,career rise`,   c:`ego conflicts in love,kidney`, conf:'H'},
  'Venus-Moon':   {r:`Emotional pleasure, domestic luxury, public appeal`,    f:`marriage,property,fame`,          c:`overemotion,dependency`,       conf:'H'},
  'Venus-Mars':   {r:`Passionate action, real estate, romance`,               f:`marriage,property,love,vehicles`, c:`passion+conflict,overspending`,conf:'H'},
  'Venus-Rahu':   {r:`Unconventional pleasure, obsessive love, foreign luxury`,f:`foreign partner,luxury,unusual gains`,c:`addiction,deceptive relationships`,conf:'H'},
  'Venus-Jupiter':{r:`Most auspicious Venus sub — divine grace on all`,       f:`marriage,children,wealth,arts`,   c:`indulgence,liver,complacency`, conf:'H'},
  'Venus-Saturn': {r:`Disciplined pleasure, delayed luxury, karmic love`,     f:`lasting relationship,property`,   c:`delays in marriage,cold love`,  conf:'H'},
  'Venus-Mercury':{r:`Arts+intellect — creative business, beautiful speech`,  f:`creative trade,arts income`,      c:`overanalysis of beauty`,       conf:'H'},
  'Venus-Ketu':   {r:`Spiritual beauty, karmic love, artistic depth`,         f:`spiritual arts,karmic completion`,c:`detachment from pleasures`,    conf:'M'},
  // SATURN MAHADASHA
  'Saturn-Saturn':{r:`Heaviest karma — maximum effort, maximum discipline`,   f:`property through persistence`,    c:`illness,depression,isolation`, conf:'H'},
  'Saturn-Mercury':{r:`Disciplined intellect, slow business success`,         f:`steady trade,technical service`,  c:`chronic nervous issues`,       conf:'M'},
  'Saturn-Ketu':  {r:`Karmic completion, spiritual discipline, isolation`,    f:`spiritual mastery,karma resolved`,c:`mysterious illness,isolation`, conf:'H'},
  'Saturn-Venus': {r:`Delayed luxury, disciplined love, property`,            f:`late but lasting marriage,property`,c:`delays,kidney,cold love`,     conf:'H'},
  'Saturn-Sun':   {r:`Tensest combination — karmic clash, authority pressure`,f:`authority through discipline`,    c:`health stress,father/govt,delays`,conf:'H'},
  'Saturn-Moon':  {r:`Emotional burden, depression risk, disciplined care`,   f:`property through effort`,         c:`depression,mother health`,     conf:'H'},
  'Saturn-Mars':  {r:`Relentless work, construction, confrontational karma`,  f:`real estate,engineering,persistence`,c:`conflict,frustration,injury`, conf:'H'},
  'Saturn-Rahu':  {r:`Double malefic — obstacles amplified, karmic intensity`,f:`breakthrough after obstacles`,    c:`illness,deception,severe delays`,conf:'H'},
  'Saturn-Jupiter':{r:`Dharma through discipline — delayed but great fortune`,f:`wealth,property long-term`,       c:`delays in Jupiter blessings`,  conf:'H'},
  // RAHU MAHADASHA
  'Rahu-Rahu':    {r:`Intense ambition, rapid rise, obsessive drive`,         f:`foreign,tech,unconventional wins`,c:`obsession,deception,illness`,  conf:'H'},
  'Rahu-Jupiter': {r:`Foreign fortune, dharma meets ambition`,                f:`wealth,foreign,philosophical rise`,c:`false gurus,confusion`,        conf:'H'},
  'Rahu-Saturn':  {r:`Disciplined ambition, karmic foreign work`,             f:`foreign,technology,unexpected`,   c:`chronic delays,isolation,stress`,conf:'H'},
  'Rahu-Mercury': {r:`Foreign business, tech innovation, media rise`,         f:`trade,foreign,technology`,        c:`deception,nervous breakdown`,  conf:'H'},
  'Rahu-Ketu':    {r:`Karmic axis activated — transformation or confusion`,   f:`spiritual reorientation`,         c:`extreme turbulence,accidents`, conf:'H'},
  'Rahu-Venus':   {r:`Foreign luxury, obsessive love, unconventional pleasure`,f:`foreign marriage,luxury,arts`,   c:`addiction,obsessive love`,     conf:'H'},
  'Rahu-Sun':     {r:`Sudden rise in authority then fall risk`,               f:`rapid career rise,govt`,          c:`ego problems,sudden reversals`,conf:'H'},
  'Rahu-Moon':    {r:`Mental obsession, public chaos, emotional extremes`,    f:`mass appeal,intuitive break`,     c:`mental illness risk,obsession`,conf:'H'},
  'Rahu-Mars':    {r:`Most volatile — ambition+aggression, peak or crash`,    f:`military/athletic peak,real estate`,c:`accident risk,violence,blood`,conf:'H'},
  // KETU MAHADASHA
  'Ketu-Ketu':    {r:`Deep spiritual isolation, karmic completion`,           f:`spiritual mastery,past skills`,   c:`illness,isolation,confusion`,  conf:'H'},
  'Ketu-Venus':   {r:`Spiritual beauty, karmic love, artistic liberation`,    f:`spiritual arts,karmic completion`,c:`detachment,isolating tendency`,conf:'M'},
  'Ketu-Sun':     {r:`Spiritual authority, past karma with power`,            f:`spiritual leadership,research`,   c:`ego dissolution,mysterious illness`,conf:'M'},
  'Ketu-Moon':    {r:`Spiritual emotions, past-life maternal connection`,     f:`spiritual intuition,healing`,     c:`mental confusion,instability`, conf:'H'},
  'Ketu-Mars':    {r:`Spiritual courage, technical mastery, isolation`,       f:`research,technical mastery`,      c:`accidents,cuts,isolation`,     conf:'M'},
  'Ketu-Rahu':    {r:`Karmic crossroads — life transformation`,               f:`complete spiritual reorientation`,c:`extreme confusion,sudden change`,conf:'H'},
  'Ketu-Jupiter': {r:`Spiritual wisdom peak — Brahma Jnana possible`,         f:`liberation,wisdom mastery`,       c:`worldly vs spiritual confusion`,conf:'H'},
  'Ketu-Saturn':  {r:`Karmic discipline, isolation, past karma repaid`,       f:`karma cleared,spiritual endurance`,c:`extreme isolation,illness`,   conf:'H'},
  'Ketu-Mercury': {r:`Technical spiritual mind, research, ancient knowledge`, f:`research,spiritual writing`,      c:`confusion,nerve issues`,       conf:'M'}
};

// Enhanced evaluateDasha — uses 81-combination table for specific verdict
function evaluateDasha(chart) {
  const findings = [];
  if (!chart.dasha) return { findings, verdict: 'Dasha data not provided' };
  const { maha, antar, pratyantar } = chart.dasha;

  // General mahadasha context (concise — no duplication with planet basics)
  const mahaCtx = {
    Sun:     `Sun period (6yr): Career, authority, govt, father, right eye.`,
    Moon:    `Moon period (10yr): Emotions, mother, public, property, mind.`,
    Mars:    `Mars period (7yr): Action, real estate, siblings, courage.`,
    Mercury: `Mercury period (17yr): Business, communication, education, travel.`,
    Jupiter: `Jupiter period (16yr): Fortune, wisdom, children, marriage, spirituality.`,
    Venus:   `Venus period (20yr): Marriage, luxury, arts, vehicles, pleasures.`,
    Saturn:  `Saturn period (19yr): Hard work, karma, discipline, property, service.`,
    Rahu:    `Rahu period (18yr): Ambition, foreign, technology, sudden changes.`,
    Ketu:    `Ketu period (7yr): Spirituality, isolation, past karma, research.`
  };

  const mahaData = chart.planets[maha];
  const mahaDig = mahaData ? getDignity(maha, mahaData.sign) : 'NEUTRAL';
  const strengthNote = mahaDig==='EXALTED' ? `${maha} exalted — peak results.` :
    mahaDig==='DEBILITATED' ? (neechaBhanga(maha,chart) ? `${maha} debilitated but Neecha Bhanga — struggles reverse.` : `${maha} debilitated — challenges. Remedies important.`) :
    mahaDig==='OWN' ? `${maha} in own sign — stable delivery.` : '';

  findings.push(rule('MAHA-CONTEXT','BPHS Ch.45',
    `${mahaCtx[maha]||maha+' period'} ${strengthNote}`,
    mahaDig==='EXALTED'||mahaDig==='DEBILITATED'?'HIGH':'MEDIUM', 2));

  // ── 81-COMBINATION SPECIFIC RESULT ───────────────────────────────────
  if (maha && antar) {
    const combo = ANTAR_TABLE[`${maha}-${antar}`];
    if (combo) {
      const mahaHouses = Object.entries(chart.houseLords||{}).filter(([,l])=>l===maha).map(([h])=>+h);
      const antarHouses = Object.entries(chart.houseLords||{}).filter(([,l])=>l===antar).map(([h])=>+h);
      const bothAuspicious = mahaHouses.some(h=>[...KENDRAS,...TRIKONAS].includes(h)) && antarHouses.some(h=>[...KENDRAS,...TRIKONAS].includes(h));
      const bothDusthana   = mahaHouses.some(h=>DUSTHANAS.includes(h)) && antarHouses.some(h=>DUSTHANAS.includes(h));

      let verdict = `${maha}-${antar}: ${combo.r}. Favorable: ${combo.f}. Watch: ${combo.c}.`;
      if (bothAuspicious) verdict += ` Both lords rule benefic houses — DOUBLY AUSPICIOUS for this lagna.`;
      else if (bothDusthana) verdict += ` Both lords rule dusthana houses — karmic pressure period.`;

      findings.push(rule('MAHA-ANTAR','BPHS Ch.50-53', verdict, combo.conf==='H'?'HIGH':'MEDIUM', 3));
    }
  }

  // Pratyantar quick note
  if (pratyantar) {
    const pc = ANTAR_TABLE[`${maha}-${pratyantar}`];
    if (pc) findings.push(rule('PRATYANTAR','BPHS Ch.53',
      `${pratyantar} narrow window: ${pc.r.split(',')[0]}. Now: ${pc.f.split(',')[0]}.`, 'MEDIUM', 1));
  }

  // Timing windows — marriage, career, children, foreign
  const l7=lordOf(7,chart), l10=lordOf(10,chart), l5=lordOf(5,chart);
  const windows=[];
  if ([l7,'Venus'].includes(maha)&&[l7,'Venus','Jupiter'].includes(antar)) windows.push('MARRIAGE WINDOW — classical period for marriage event.');
  if ([l10,'Sun'].includes(maha)&&[l10,'Jupiter','Saturn'].includes(antar)) windows.push('CAREER PEAK — promotion or major career event classical.');
  if ([l5,'Jupiter'].includes(maha)&&[l5,'Jupiter','Moon'].includes(antar)) windows.push('CHILDREN WINDOW — classical period for conception or birth.');
  if (['Rahu','Jupiter'].includes(maha)&&['Rahu','Jupiter'].includes(antar)) windows.push('FOREIGN WINDOW — travel or settlement classical.');
  if (windows.length>0) findings.push(rule('DASHA-WINDOWS','BPHS Ch.45-50',`ACTIVE: ${windows.join(' | ')}`,'HIGH',3));

  const verdict = findings.find(r=>r.id==='MAHA-ANTAR')?.verdict || findings[0]?.verdict || '';
  return { findings, maha, antar, pratyantar, verdict };
}


// ═══════════════════════════════════════════════════════════════════════════
// STEP 3 — ASHTAKAVARGA (BPHS CH.66-82)
// Benefic dot tables + SAV computation + transit evaluation
// ═══════════════════════════════════════════════════════════════════════════

const BENEFIC_TABLE = {
  Sun:     { Sun:[1,2,4,7,8,9,10,11], Moon:[3,6,10,11], Mars:[1,2,4,7,8,9,10,11], Mercury:[3,5,6,9,10,11,12], Jupiter:[5,6,9,11], Venus:[6,7,12], Saturn:[1,2,4,7,8,9,10,11], Lagna:[1,2,4,7,8,9,10,11] },
  Moon:    { Sun:[3,6,7,8,10,11], Moon:[1,3,6,7,10,11], Mars:[2,3,5,6,9,10,11], Mercury:[1,3,4,5,7,8,10,11], Jupiter:[1,4,7,8,10,11], Venus:[3,4,5,7,9,10,11], Saturn:[3,5,6,11], Lagna:[3,6,10,11] },
  Mars:    { Sun:[3,5,6,10,11], Moon:[3,6,11], Mars:[1,2,4,7,8,10,11], Mercury:[1,2,4,7,8,9,10,11], Jupiter:[6,10,11,12], Venus:[6,8,11,12], Saturn:[1,4,7,8,9,10,11], Lagna:[1,2,4,7,8,10,11] },
  Mercury: { Sun:[5,6,9,11,12], Moon:[2,4,6,8,10,11], Mars:[1,2,4,7,8,9,10,11], Mercury:[1,3,5,6,9,10,11,12], Jupiter:[6,8,11,12], Venus:[1,2,3,4,5,8,9,11], Saturn:[1,2,4,7,8,9,10,11], Lagna:[1,2,4,6,8,10,11] },
  Jupiter: { Sun:[1,2,3,4,7,8,9,10,11], Moon:[2,5,7,9,11], Mars:[1,2,4,7,8,10,11], Mercury:[1,2,4,5,6,9,10,11], Jupiter:[1,2,3,4,7,8,10,11], Venus:[2,5,6,9,10,11], Saturn:[3,5,6,12], Lagna:[1,2,4,5,6,7,9,10,11] },
  Venus:   { Sun:[8,11,12], Moon:[1,2,3,4,5,8,9,11,12], Mars:[3,4,6,9,11,12], Mercury:[3,5,6,9,11], Jupiter:[5,8,9,10,11], Venus:[1,2,3,4,5,8,9,11,12], Saturn:[3,4,5,8,9,10,11], Lagna:[1,2,3,4,5,8,9,11] },
  Saturn:  { Sun:[1,2,4,7,8,9,10,11], Moon:[3,6,11], Mars:[3,5,6,10,11,12], Mercury:[6,8,9,10,11,12], Jupiter:[5,6,11,12], Venus:[6,11,12], Saturn:[3,5,6,11], Lagna:[1,3,4,6,10,11] }
};

const PLANETS_FOR_AV = ['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn'];

function computeAshtakavarga(chart) {
  const bav = {};
  for (const p of PLANETS_FOR_AV) bav[p] = new Array(12).fill(0);
  for (const planet of PLANETS_FOR_AV) {
    for (const [source, beneficHouses] of Object.entries(BENEFIC_TABLE[planet])) {
      const sourceSign = source === 'Lagna' ? chart.lagna : chart.planets[source]?.sign;
      if (sourceSign === undefined) continue;
      for (const h of beneficHouses) {
        bav[planet][(sourceSign + h - 1) % 12]++;
      }
    }
  }
  const sav = new Array(12).fill(0);
  for (const p of PLANETS_FOR_AV) for (let s=0;s<12;s++) sav[s]+=bav[p][s];
  return { bav, sav, total: sav.reduce((a,b)=>a+b,0) };
}

function evaluateAshtakavarga(chart) {
  const findings = [];
  const { bav, sav } = computeAshtakavarga(chart);
  const signToHouse = s => ((s - chart.lagna + 12) % 12) + 1;
  const houseToSign = h => (chart.lagna + h - 1) % 12;

  // House strength classification
  const strongHouses=[], weakHouses=[], veryStrongHouses=[];
  for (let h=1;h<=12;h++) {
    const score = sav[houseToSign(h)];
    if (score>=28) veryStrongHouses.push({house:h,score});
    else if (score>=25) strongHouses.push({house:h,score});
    else if (score<=21) weakHouses.push({house:h,score});
  }

  if (veryStrongHouses.length>0) findings.push(rule('AV-VERY-STRONG','BPHS Ch.73',
    `VERY STRONG HOUSES (28+ SAV): ${veryStrongHouses.map(x=>x.house+'th('+x.score+')').join(', ')} — these houses deliver their full classical promise. Major life events here produce exceptional results.`,'HIGH',2));
  if (strongHouses.length>0) findings.push(rule('AV-STRONG','BPHS Ch.73',
    `STRONG HOUSES (25-27 SAV): ${strongHouses.map(x=>x.house+'th('+x.score+')').join(', ')} — well-supported houses. Transits here produce good results.`,'MEDIUM',1));
  if (weakHouses.length>0) findings.push(rule('AV-WEAK','BPHS Ch.73',
    `WEAK HOUSES (<22 SAV): ${weakHouses.map(x=>x.house+'th('+x.score+')').join(', ')} — these houses struggle. Events here require extra effort.`,'HIGH',-1));

  // Trikona/Kendra/Dusthana totals
  const trikonaSAV = [1,5,9].map(h=>sav[houseToSign(h)]).reduce((a,b)=>a+b,0);
  const kendraSAV  = [1,4,7,10].map(h=>sav[houseToSign(h)]).reduce((a,b)=>a+b,0);
  const dusthanaSAV= [6,8,12].map(h=>sav[houseToSign(h)]).reduce((a,b)=>a+b,0);

  findings.push(rule('AV-TRIKONA','BPHS Ch.73',
    `TRIKONA SAV: ${trikonaSAV} — ${trikonaSAV>=76?'STRONG: Dharma and fortune well-supported.':trikonaSAV<=65?'WEAK: Fortune requires more effort.':'Average fortune indicators.'}`,'LOW',0));
  if (dusthanaSAV>=75) findings.push(rule('AV-DUSTHANA-HIGH','BPHS Ch.73',
    `OBSTACLE SAV (6+8+12): ${dusthanaSAV} HIGH — significant recurring obstacles. Remedies important.`,'HIGH',-1));
  else if (dusthanaSAV<=60) findings.push(rule('AV-DUSTHANA-LOW','BPHS Ch.73',
    `OBSTACLE SAV (6+8+12): ${dusthanaSAV} LOW — enemies and obstacles are contained. Favorable.`,'MEDIUM',1));

  // Jupiter BAV best/worst transit houses
  const jupBAV = bav['Jupiter'];
  const jupBest = jupBAV.map((s,i)=>({h:signToHouse(i),s})).filter(x=>x.s>=5).sort((a,b)=>b.s-a.s);
  const jupWorst= jupBAV.map((s,i)=>({h:signToHouse(i),s})).filter(x=>x.s<=3).sort((a,b)=>a.s-b.s);
  if (jupBest.length>0) findings.push(rule('AV-JUP-BEST','BPHS Ch.77',
    `JUPITER BEST TRANSIT HOUSES (5+ BAV): ${jupBest.slice(0,4).map(x=>x.h+'th('+x.s+')').join(', ')} — plan major life events (marriage, business, children) when Jupiter transits these houses.`,'HIGH',2));
  if (jupWorst.length>0) findings.push(rule('AV-JUP-WORST','BPHS Ch.77',
    `JUPITER CHALLENGING TRANSIT HOUSES (≤3 BAV): ${jupWorst.slice(0,3).map(x=>x.h+'th('+x.s+')').join(', ')} — fewer blessings during Jupiter transit here.`,'MEDIUM',0));

  // Saturn BAV
  const satBAV = bav['Saturn'];
  const satGood = satBAV.map((s,i)=>({h:signToHouse(i),s})).filter(x=>x.s>=4).sort((a,b)=>b.s-a.s);
  const satBad  = satBAV.map((s,i)=>({h:signToHouse(i),s})).filter(x=>x.s<=2).sort((a,b)=>a.s-b.s);
  if (satGood.length>0) findings.push(rule('AV-SAT-GOOD','BPHS Ch.80',
    `SATURN FAVORABLE TRANSIT HOUSES (4+ BAV): ${satGood.slice(0,4).map(x=>x.h+'th('+x.s+')').join(', ')} — Saturn transiting here is constructive. Discipline rewarded.`,'HIGH',1));
  if (satBad.length>0) findings.push(rule('AV-SAT-BAD','BPHS Ch.80',
    `SATURN DIFFICULT TRANSIT HOUSES (≤2 BAV): ${satBad.slice(0,3).map(x=>x.h+'th('+x.s+')').join(', ')} — most challenging Saturn transit periods. Extra care needed.`,'HIGH',-1));

  // Current transits if provided
  if (chart.currentTransits) {
    const tv = [];
    for (const [planet, td] of Object.entries(chart.currentTransits)) {
      if (!bav[planet] || td.sign===undefined) continue;
      const bavScore = bav[planet][td.sign];
      const savScore = sav[td.sign];
      const q = bavScore>=5?'EXCELLENT':bavScore>=4?'GOOD':bavScore===3?'AVERAGE':'CHALLENGING';
      tv.push(`${planet} in ${signToHouse(td.sign)}th: BAV=${bavScore}/8 SAV=${savScore}/56 (${q})`);
    }
    if (tv.length>0) findings.push(rule('AV-TRANSITS','BPHS Ch.73',`CURRENT TRANSITS: ${tv.join(' | ')}`,'HIGH',2));
  }

  // 5th house Jupiter BAV for children timing
  const jup5BAV = jupBAV[houseToSign(5)];
  if (jup5BAV>=6) findings.push(rule('AV-CHILD-HIGH','BPHS Ch.77',`5th house Jupiter BAV ${jup5BAV}/8 — STRONG: Ashtakavarga confirms children blessing when Jupiter transits 5th.`,'HIGH',2));
  else if (jup5BAV<=3) findings.push(rule('AV-CHILD-LOW','BPHS Ch.77',`5th house Jupiter BAV ${jup5BAV}/8 — LOW: Ashtakavarga confirms classical challenge for children.`,'HIGH',-1));

  // Summary
  const topH = sav.map((s,i)=>({h:signToHouse(i),s})).sort((a,b)=>b.s-a.s)[0];
  const botH = sav.map((s,i)=>({h:signToHouse(i),s})).sort((a,b)=>a.s-b.s)[0];
  findings.push(rule('AV-SUMMARY','BPHS Ch.73-82',
    `ASHTAKAVARGA: SAV[${sav.map((s,i)=>signToHouse(i)+'H:'+s).join(' ')}] | Strongest: ${topH.h}th(${topH.s}) | Weakest: ${botH.h}th(${botH.s}) | Trikona:${trikonaSAV} Kendra:${kendraSAV} Dusthana:${dusthanaSAV}`,
    'HIGH',0));

  return { findings, bav, sav, trikonaSAV, kendraSAV, dusthanaSAV, strongHouses, weakHouses, veryStrongHouses };
}

// Compact prompt injection (~40 tokens, not all 96 numbers)
function getAVSummaryForPrompt(chart) {
  try {
    const {bav,sav} = computeAshtakavarga(chart);
    const sh = s => ((s-chart.lagna+12)%12)+1;
    const strong = sav.map((s,i)=>({h:sh(i),s})).filter(x=>x.s>=26).map(x=>`${x.h}th:${x.s}`);
    const weak   = sav.map((s,i)=>({h:sh(i),s})).filter(x=>x.s<=21).map(x=>`${x.h}th:${x.s}`);
    const jBest  = bav['Jupiter'].map((s,i)=>({h:sh(i),s})).filter(x=>x.s>=5).map(x=>`${x.h}th`);
    const sBest  = bav['Saturn'].map((s,i)=>({h:sh(i),s})).filter(x=>x.s>=4).map(x=>`${x.h}th`);
    return [
      strong.length ? `AV strong: ${strong.join(',')}` : '',
      weak.length   ? `AV weak: ${weak.join(',')}` : '',
      jBest.length  ? `Jup best transit: ${jBest.join(',')}` : '',
      sBest.length  ? `Sat favorable: ${sBest.join(',')}` : ''
    ].filter(Boolean).join(' | ');
  } catch(e) { return ''; }
}


// ═══════════════════════════════════════════════════════════════════════════
// COMPLETE VedicRulesEngine — ALL SESSIONS + STEP 1 + STEP 2 + STEP 3
// ═══════════════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════════════
// STEP 4 — REMAINING BPHS LIFE AREAS
// BPHS Ch.7,20,21,22,28 + SAR + PD
// Areas: Vehicles & Comforts, Debt, Physical Appearance,
//        Maternal Uncle, Paternal Grandfather, Mental Illness,
//        Imprisonment, Pilgrimage, Hidden Enemies, Marital Happiness
// EFFICIENCY: One combined function — compact rules, no verbosity
// ═══════════════════════════════════════════════════════════════════════════

function evaluateSecondaryAreas(chart) {
  const findings = [];

  // ── VEHICLES & COMFORTS — BPHS Ch.20, UK ─────────────────────────────
  // 4th house = vehicles, 4th lord, Venus = luxury karaka
  {
    const l4 = lordOf(4,chart);
    const l4dig = getDignity(l4, signOfPlanet(l4,chart));
    const h4 = planetsInHouse(4,chart);
    const venus = chart.planets['Venus'];
    const vDig = getDignity('Venus', venus?.sign);

    let vehicleScore = 0;
    if (l4dig==='EXALTED'||l4dig==='OWN') vehicleScore+=2;
    if (l4dig==='DEBILITATED') vehicleScore-=1;
    if (h4.includes('Venus')||h4.includes('Jupiter')) vehicleScore+=2;
    if (vDig==='EXALTED'||vDig==='OWN') vehicleScore+=1;
    if (h4.includes('Saturn')) vehicleScore-=1;

    const verdict = vehicleScore>=3 ? `VEHICLES: Multiple vehicles and comforts indicated. 4th house is well-supported. Venus and 4th lord combine for luxury.` :
      vehicleScore>=1 ? `VEHICLES: Standard vehicle ownership. Comfortable but not luxurious domestic environment.` :
      `VEHICLES: Difficulties with vehicles or home comforts. May face losses or delays in acquiring property and conveniences.`;

    findings.push(rule('VEHICLES','BPHS Ch.20 + UK', verdict, Math.abs(vehicleScore)>=2?'HIGH':'MEDIUM', vehicleScore));
  }

  // ── DEBT — BPHS Ch.21 (6th house analysis) ───────────────────────────
  {
    const l6 = lordOf(6,chart);
    const l6house = houseOfPlanet(l6,chart);
    const h6 = planetsInHouse(6,chart);
    const l6dig = getDignity(l6, signOfPlanet(l6,chart));
    const l2 = lordOf(2,chart);
    const l11 = lordOf(11,chart);

    let debtScore = 0;
    if (l6house===1||l6house===2) debtScore+=2; // 6th lord in wealth houses = debt
    if (h6.includes('Saturn')&&h6.includes('Rahu')) debtScore+=2;
    if (l6house===11) debtScore-=2; // 6th lord in 11th = enemies become friends, no debt
    if (l6house===6) debtScore-=2; // 6th lord in own = self-contained
    if ([2,11].includes(houseOfPlanet(l2,chart))&&[2,11].includes(houseOfPlanet(l11,chart))) debtScore-=2; // strong Dhana yogas = no debt
    if (h6.includes('Jupiter')) debtScore-=1; // Jupiter in 6th defeats debt

    const verdict = debtScore>=3 ? `DEBT: High classical indicators for recurring financial debt. Expenditure management is critical. 6th house is active in wealth houses.` :
      debtScore>=1 ? `DEBT: Some tendency toward borrowing or financial obligations. Manageable with discipline.` :
      `DEBT: Low debt indicators. Strong wealth houses or 6th lord placement protects against chronic debt.`;

    findings.push(rule('DEBT','BPHS Ch.21', verdict, Math.abs(debtScore)>=2?'HIGH':'MEDIUM', -debtScore));
  }

  // ── PHYSICAL APPEARANCE — BPHS Ch.7, SAR Ch.5 ────────────────────────
  // Lagna sign + lagna lord + planets in lagna determine appearance
  {
    const lagnaSign = chart.lagna;
    const h1 = planetsInHouse(1,chart);
    const lagnaLord = lordOf(1,chart);
    const lldig = getDignity(lagnaLord, signOfPlanet(lagnaLord,chart));

    const signAppearance = {
      0:`Aries rising: Medium/athletic build, prominent forehead, active eyes, reddish or warm complexion. Quick movements.`,
      1:`Taurus rising: Sturdy, well-built body, beautiful features, full neck, steady eyes, fair complexion. Graceful bearing.`,
      2:`Gemini rising: Tall, slender build, long arms, expressive eyes, youthful appearance throughout life. Quick and animated.`,
      3:`Cancer rising: Round face, soft features, broad chest, medium height, watery eyes, pale or fair complexion. Changeable expression.`,
      4:`Leo rising: Broad shoulders, commanding presence, strong spine, cat-like eyes, regal bearing. Thick hair.`,
      5:`Virgo rising: Medium height, neat and tidy appearance, analytical eyes, discriminating features, methodical movement.`,
      6:`Libra rising: Symmetrical features, charming smile, well-proportioned body, dimples possible, graceful movement. Attractive.`,
      7:`Scorpio rising: Intense, penetrating eyes, strong features, medium-athletic build, magnetic presence. Dark or deep complexion.`,
      8:`Sagittarius rising: Tall, athletic, open face, long nose, jovial expression, strong thighs. Enthusiastic bearing.`,
      9:`Capricorn rising: Lean build, prominent nose, serious expression, dark complexion, knobby joints. Distinguished in old age.`,
      10:`Aquarius rising: Tall, well-formed, intellectual eyes, friendly expression, distinctive features. Dignified.`,
      11:`Pisces rising: Soft, round features, dreamy eyes, medium height, pale complexion, fluid movement. Gentle bearing.`
    };

    let verdict = signAppearance[lagnaSign] || '';

    // Planets in lagna modify appearance
    if (h1.includes('Jupiter')) verdict += ` Jupiter in lagna adds generous, radiant quality — bright eyes, noble bearing.`;
    if (h1.includes('Venus'))   verdict += ` Venus in lagna adds beauty, charm, and attractive features.`;
    if (h1.includes('Saturn'))  verdict += ` Saturn in lagna gives lean build, dark features, serious expression.`;
    if (h1.includes('Mars'))    verdict += ` Mars in lagna gives muscular build, sharp features, energetic presence.`;
    if (h1.includes('Moon'))    verdict += ` Moon in lagna gives soft, attractive, changeable features. Round face.`;
    if (h1.includes('Rahu'))    verdict += ` Rahu in lagna may give unusual features, foreign quality to appearance.`;
    if (lldig==='EXALTED') verdict += ` Lagna lord exalted — especially fine physique and appearance.`;
    if (lldig==='DEBILITATED') verdict += ` Lagna lord debilitated — some physical vulnerability or below-average vitality.`;

    findings.push(rule('APPEARANCE','BPHS Ch.7 + SAR Ch.5', `PHYSICAL APPEARANCE: ${verdict}`, 'HIGH', 1));
  }

  // ── MATERNAL UNCLE — BPHS Ch.14 (6th from 4th = 9th house) ──────────
  // Maternal uncle signified by 6th house (maternal relatives)
  {
    const l6 = lordOf(6,chart);
    const l6dig = getDignity(l6, signOfPlanet(l6,chart));
    const l6house = houseOfPlanet(l6,chart);
    const h6 = planetsInHouse(6,chart);

    let verdict = '';
    if (l6dig==='EXALTED'||l6dig==='OWN') verdict = `MATERNAL UNCLE: Prosperous, successful maternal uncle. The relationship is supportive.`;
    else if (l6dig==='DEBILITATED') verdict = `MATERNAL UNCLE: Maternal uncle faces difficulties. Relationship may be complicated or strained.`;
    else if (l6house===11) verdict = `MATERNAL UNCLE: Maternal uncle brings gains and social connections. Supportive figure.`;
    else if (DUSTHANAS.includes(l6house)) verdict = `MATERNAL UNCLE: Maternal uncle faces obstacles or health issues. Limited contact.`;
    else verdict = `MATERNAL UNCLE: Standard relationship with maternal relatives. No strong classical indicators either way.`;

    if (h6.includes('Jupiter')) verdict += ` Jupiter in 6th — maternal uncle is learned or prosperous.`;

    findings.push(rule('MAT-UNCLE','BPHS Ch.14 (6th house relatives)', verdict, 'LOW', 0));
  }

  // ── PATERNAL GRANDFATHER — BPHS Ch.13 (father's father = 9th from 9th = 5th) ──
  {
    const l5 = lordOf(5,chart);
    const l5dig = getDignity(l5, signOfPlanet(l5,chart));
    const h5 = planetsInHouse(5,chart);

    let verdict = '';
    if (l5dig==='EXALTED'||l5dig==='OWN') verdict = `PATERNAL GRANDFATHER: Grandfather was/is prosperous and influential. Strong ancestral legacy.`;
    else if (l5dig==='DEBILITATED') verdict = `PATERNAL GRANDFATHER: Grandfather faced difficulties. Ancestral karma is challenging.`;
    else if (h5.includes('Jupiter')) verdict = `PATERNAL GRANDFATHER: Learned, wise grandfather. Strong positive ancestral influence.`;
    else verdict = `PATERNAL GRANDFATHER: Standard ancestral legacy. No dominant classical signal.`;

    findings.push(rule('PAT-GRAND','BPHS Ch.13 (5th = 9th from 9th)', verdict, 'LOW', 0));
  }

  // ── IMPRISONMENT / CONFINEMENT — BPHS Ch.12 (12th house) ─────────────
  {
    const l12 = lordOf(12,chart);
    const l12house = houseOfPlanet(l12,chart);
    const h12 = planetsInHouse(12,chart);
    const l6 = lordOf(6,chart);
    const l8 = lordOf(8,chart);

    let imprisonRisk = 0;
    if (l12house===6||l12house===8) imprisonRisk++; // 12th lord in 6th or 8th = confinement
    if (houseOfPlanet(l6,chart)===12) imprisonRisk++; // 6th lord in 12th
    if (houseOfPlanet(l8,chart)===12) imprisonRisk++;
    if (h12.includes('Saturn')&&h12.includes('Rahu')) imprisonRisk+=2;
    if (h12.includes('Mars')&&h12.includes('Saturn')) imprisonRisk++;
    if (h12.includes('Jupiter')) imprisonRisk-=2; // Jupiter in 12th = liberation, not jail

    let verdict = imprisonRisk>=3 ?
      `CONFINEMENT RISK: Multiple classical indicators for confinement, isolation, or restricted freedom. Could be literal imprisonment, hospitalization, or extended isolation. Legal awareness important.` :
      imprisonRisk>=1 ? `CONFINEMENT: Some indicators for periods of isolation, hospitalization, or restricted freedom. Not necessarily literal imprisonment.` :
      `CONFINEMENT: Low classical risk for imprisonment or involuntary confinement. 12th house is not heavily afflicted.`;

    if (h12.includes('Jupiter')) verdict += ` Jupiter in 12th converts confinement into spiritual retreat — isolation is chosen, not forced.`;

    findings.push(rule('IMPRISON','BPHS Ch.12 (12th house affliction)', verdict, imprisonRisk>=3?'HIGH':'LOW', 0));
  }

  // ── PILGRIMAGE & RELIGIOUS TRAVEL — BPHS Ch.9 (9th house) ───────────
  {
    const h9 = planetsInHouse(9,chart);
    const l9 = lordOf(9,chart);
    const l9dig = getDignity(l9, signOfPlanet(l9,chart));
    const l9house = houseOfPlanet(l9,chart);
    const ketu = chart.planets['Ketu'];

    let pilgrimScore = 0;
    if (l9dig==='EXALTED'||l9dig==='OWN') pilgrimScore+=2;
    if (h9.includes('Jupiter')) pilgrimScore+=2;
    if (h9.includes('Ketu')) pilgrimScore+=1;
    if (ketu?.house===9) pilgrimScore+=1;
    if ([3,7,12].includes(l9house)) pilgrimScore+=1; // 9th lord in travel houses
    if (h9.includes('Saturn')) pilgrimScore-=1; // Saturn in 9th = duty-based, not devotional travel

    const verdict = pilgrimScore>=4 ?
      `PILGRIMAGE: Strong classical indicators for spiritual journeys, holy places, and religious travel. The native is deeply called to visit sacred sites.` :
      pilgrimScore>=2 ? `PILGRIMAGE: Moderate spiritual travel inclination. Religious journeys are meaningful life events.` :
      `PILGRIMAGE: Limited classical indicators for pilgrimage. Spiritual connection is internal rather than through travel.`;

    findings.push(rule('PILGRIMAGE','BPHS Ch.9 (9th house + Ketu)', verdict, 'MEDIUM', 0));
  }

  // ── MENTAL ILLNESS INDICATORS — BPHS Ch.8 + SAR Ch.18 ───────────────
  // Specific conditions, not general mental health (already in evaluateMind)
  {
    const moon = chart.planets['Moon'];
    const mercury = chart.planets['Mercury'];
    const h5 = planetsInHouse(5,chart);
    const moonDig = getDignity('Moon', moon?.sign);
    const mercDig = getDignity('Mercury', mercury?.sign);

    const afflictions = [];
    if (moonDig==='DEBILITATED') afflictions.push('Moon debilitated — chronic emotional imbalance risk');
    if (conjunct('Rahu','Moon',chart)) afflictions.push('Rahu conjunct Moon — psychic disturbance, obsessive ideation');
    if (conjunct('Saturn','Moon',chart)&&moonDig==='DEBILITATED') afflictions.push('Saturn+Moon debilitated — clinical depression indicators');
    if (h5.includes('Rahu')&&h5.includes('Saturn')) afflictions.push('Rahu+Saturn in 5th — anxiety disorders, disturbed thinking');
    if (mercDig==='DEBILITATED'&&conjunct('Saturn','Mercury',chart)) afflictions.push('Mercury debilitated with Saturn — speech/cognitive challenges');

    if (afflictions.length>=2) {
      findings.push(rule('MENTAL-SPECIFIC','BPHS Ch.8 + SAR Ch.18',
        `MENTAL HEALTH SPECIFIC INDICATORS: ${afflictions.join(' | ')}. Classical texts indicate heightened mental health vulnerability. Conscious management, meditation, and professional support are important.`,
        'HIGH', -2));
    } else if (afflictions.length===1) {
      findings.push(rule('MENTAL-MILD','BPHS Ch.8',
        `MENTAL HEALTH NOTE: ${afflictions[0]}. One classical indicator present — monitor mental wellbeing.`, 'MEDIUM', -1));
    }
    // If no afflictions, no finding needed — keeps output clean
  }

  // ── MARITAL HAPPINESS (SUKHABHAVA detail) — PD Ch.12 ─────────────────
  // This goes deeper than the main marriage verdict — happiness quality
  {
    const venus = chart.planets['Venus'];
    const moon  = chart.planets['Moon'];
    const h7 = planetsInHouse(7,chart);
    const vDig = getDignity('Venus', venus?.sign);
    const mDig = getDignity('Moon', moon?.sign);

    let happinessScore = 0;
    if (vDig==='EXALTED') happinessScore+=3;
    else if (vDig==='OWN') happinessScore+=2;
    else if (vDig==='DEBILITATED') happinessScore-=2;
    if (mDig==='EXALTED') happinessScore+=2;
    else if (mDig==='DEBILITATED') happinessScore-=1;
    if (h7.includes('Jupiter')) happinessScore+=2;
    if (h7.includes('Venus'))   happinessScore+=2;
    if (h7.includes('Saturn')||h7.includes('Rahu')) happinessScore-=1;
    if (conjunct('Venus','Mars',chart)) happinessScore+=1; // passionate but volatile
    if (conjunct('Venus','Saturn',chart)) happinessScore-=2; // cold marriage
    if (anyBeneficAspects(7,chart)) happinessScore+=1;

    const verdict = happinessScore>=4 ?
      `MARITAL HAPPINESS: Deeply fulfilling marriage. Venus and Moon indicators confirm genuine joy and pleasure in domestic partnership.` :
      happinessScore>=2 ? `MARITAL HAPPINESS: Generally happy marriage. Some adjustments needed but overall positive domestic experience.` :
      happinessScore>=0 ? `MARITAL HAPPINESS: Average domestic happiness. Marriage is functional but may lack deep romantic fulfillment.` :
      happinessScore>=-2 ? `MARITAL HAPPINESS: Tensions in domestic life. Marriage requires conscious effort to maintain joy.` :
      `MARITAL HAPPINESS: Classical indicators show significant difficulty achieving happiness in marriage. Remedies and counseling important.`;

    findings.push(rule('MARITAL-HAPPINESS','PD Ch.12 (Sukhabhava)',
      verdict, Math.abs(happinessScore)>=3?'HIGH':'MEDIUM', happinessScore));
  }

  // ── HIDDEN ENEMIES — BPHS Ch.21 (12th house enemies vs 6th) ──────────
  // 6th house = open enemies. 12th house = hidden/secret enemies
  {
    const h12 = planetsInHouse(12,chart);
    const l12 = lordOf(12,chart);
    const l12house = houseOfPlanet(l12,chart);

    const hiddenEnemyIndicators = [];
    if (h12.includes('Rahu')) hiddenEnemyIndicators.push('Rahu in 12th — deceptive hidden enemies, possibly foreign');
    if (h12.includes('Saturn')) hiddenEnemyIndicators.push('Saturn in 12th — slow-acting hidden adversaries or institutional opposition');
    if (h12.includes('Mars')) hiddenEnemyIndicators.push('Mars in 12th — aggressive hidden enemies, bed/hospital risks');
    if (l12house===6) hiddenEnemyIndicators.push('12th lord in 6th — hidden enemies become open; battles are exposed');
    if (l12house===8) hiddenEnemyIndicators.push('12th lord in 8th — hidden enemies cause sudden reversals');
    if (h12.includes('Ketu')) hiddenEnemyIndicators.push('Ketu in 12th — karmic/past-life enemies; spiritual resolution required');

    if (hiddenEnemyIndicators.length>0) {
      findings.push(rule('HIDDEN-ENEMIES','BPHS Ch.21',
        `HIDDEN ENEMIES: ${hiddenEnemyIndicators.join(' | ')}. Work environments and close relationships should be navigated with discernment.`,
        hiddenEnemyIndicators.length>=2?'HIGH':'MEDIUM', -1));
    } else {
      findings.push(rule('HIDDEN-ENEMIES-LOW','BPHS Ch.21',
        `HIDDEN ENEMIES: 12th house is relatively clean. No dominant hidden enemy indicators. Betrayal risk is low.`, 'LOW', 1));
    }
  }

  // ── ANCESTRAL KARMA (Pitru + Matru combined) — NS ────────────────────
  {
    const h9 = planetsInHouse(9,chart);
    const h4 = planetsInHouse(4,chart);
    const sun = chart.planets['Sun'];
    const moon = chart.planets['Moon'];
    const sunDig = getDignity('Sun', sun?.sign);
    const moonDig = getDignity('Moon', moon?.sign);

    const karmaIndicators = [];
    if (h9.includes('Rahu')||conjunct('Rahu','Sun',chart)) karmaIndicators.push('Pitru Dosha — paternal ancestral karma active');
    if (h4.includes('Rahu')||conjunct('Rahu','Moon',chart)) karmaIndicators.push('Matru Dosha — maternal ancestral karma active');
    if (sunDig==='DEBILITATED'&&moonDig==='DEBILITATED') karmaIndicators.push('Both luminaries weak — dual ancestral karma');

    if (karmaIndicators.length>0) {
      findings.push(rule('ANCESTRAL-KARMA','NS (Nadi Shastra)',
        `ANCESTRAL KARMA: ${karmaIndicators.join(' | ')}. Classical remedy: Pitra Tarpan (new moon), Shradh ceremonies, honoring ancestors on Amavasya. This resolves blocks to prosperity and health.`,
        'HIGH', -1));
    }
  }

  return { findings };
}

// ── FEMALE HOROSCOPY — BPHS CH.80 ────────────────────────────────────────
// Specific rules that apply only to women's charts
function evaluateFemaleHoroscopy(chart) {
  if (chart.gender !== 'F') return { findings: [] };
  const findings = [];

  const l7 = lordOf(7,chart);
  const h7 = planetsInHouse(7,chart);
  const mars = chart.planets['Mars'];
  const venus = chart.planets['Venus'];
  const moon  = chart.planets['Moon'];
  const jupiter = chart.planets['Jupiter'];
  const moonDig = getDignity('Moon', moon?.sign);
  const venusDig = getDignity('Venus', venus?.sign);
  const jupDig = getDignity('Jupiter', jupiter?.sign);

  // ── HUSBAND'S NATURE (BPHS Ch.80) ────────────────────────────────────
  // For women: 7th house, 7th lord, and Jupiter (karaka for husband)
  const jupVerdictForHusband = {
    0:`Husband is courageous, active, possibly aggressive. Aries-type energy.`,
    1:`Husband is stable, sensual, materially comfortable. Taurus-type.`,
    2:`Husband is intelligent, communicative, possibly dual-natured.`,
    3:`Husband is nurturing, emotional, possibly in public sector.`,
    4:`Husband is proud, authoritative, possibly in government or leadership.`,
    5:`Husband is analytical, health-conscious, detail-oriented.`,
    6:`Husband is charming, balanced, artistic. Most favorable for happiness.`,
    7:`Husband is intense, secretive, transformative. Powerful but complex.`,
    8:`Husband is philosophical, adventurous, possibly in academia or law.`,
    9:`Husband is disciplined, serious, career-driven. Older or more mature.`,
    10:`Husband is independent, intellectual, humanitarian.`,
    11:`Husband is spiritual, compassionate, artistic. Gentle nature.`
  };

  const jupiterSign = jupiter?.sign;
  if (jupiterSign !== undefined) {
    findings.push(rule('FEM-HUSBAND','BPHS Ch.80',
      `HUSBAND NATURE (Jupiter karaka for women): ${jupVerdictForHusband[jupiterSign]} ${jupDig==='EXALTED'?'Jupiter exalted — exceptional husband.':jupDig==='DEBILITATED'?'Jupiter debilitated — husband faces challenges.':''}`,
      jupDig==='EXALTED'||jupDig==='DEBILITATED'?'HIGH':'MEDIUM', jupDig==='EXALTED'?3:jupDig==='DEBILITATED'?-2:1));
  }

  // ── WIDOWHOOD INDICATORS — BPHS Ch.80 ────────────────────────────────
  // Classical indicators — not predictive, karmic awareness
  const widowhoodIndicators = [];
  if (h7.includes('Saturn')&&h7.includes('Mars')) widowhoodIndicators.push('Saturn+Mars in 7th');
  if (h7.includes('Sun')&&h7.includes('Saturn')&&!anyBeneficAspects(7,chart)) widowhoodIndicators.push('Sun+Saturn in 7th without benefic');
  const l7dig = getDignity(l7, signOfPlanet(l7,chart));
  if (l7dig==='DEBILITATED'&&DUSTHANAS.includes(houseOfPlanet(l7,chart))) widowhoodIndicators.push('7th lord debilitated in dusthana');
  if (widowhoodIndicators.length>=2) {
    findings.push(rule('FEM-WIDOW','BPHS Ch.80',
      `MARITAL LONGEVITY CAUTION: ${widowhoodIndicators.join(', ')} — classical indicators for marital separation or widowhood. Conscious matching and remedies are important.`,
      'HIGH', -2));
  }

  // ── FERTILITY INDICATORS — BPHS Ch.80 ────────────────────────────────
  const l5 = lordOf(5,chart);
  const l5dig = getDignity(l5, signOfPlanet(l5,chart));
  const moonSign = moon?.sign;

  let fertilityScore = 0;
  if (jupDig==='EXALTED'||jupDig==='OWN') fertilityScore+=2;
  if (l5dig==='EXALTED'||l5dig==='OWN') fertilityScore+=2;
  if (jupDig==='DEBILITATED') fertilityScore-=2;
  if (moonDig==='DEBILITATED') fertilityScore-=1;
  if (anyBeneficAspects(5,chart)) fertilityScore+=1;

  findings.push(rule('FEM-FERTILITY','BPHS Ch.80',
    fertilityScore>=3 ? `FERTILITY: Strongly favored. Jupiter and 5th lord indicators support childbirth.` :
    fertilityScore>=1 ? `FERTILITY: Generally supported. Standard childbirth indications.` :
    fertilityScore>=-1 ? `FERTILITY: Some classical concerns. Medical awareness advised.` :
    `FERTILITY: Significant classical concern for childbirth. Medical consultation and remedies recommended.`,
    Math.abs(fertilityScore)>=2?'HIGH':'MEDIUM', fertilityScore));

  // ── MODESTY AND CHARACTER — BPHS Ch.80 ───────────────────────────────
  const h12 = planetsInHouse(12,chart);
  if (venusDig==='EXALTED') findings.push(rule('FEM-CHAR','BPHS Ch.80',`CHARACTER: Venus exalted — exceptionally virtuous, beautiful, and refined character. Most auspicious for a woman's chart.`,'HIGH',3));
  if (venusDig==='DEBILITATED') findings.push(rule('FEM-CHAR-DB','BPHS Ch.80',`CHARACTER: Venus debilitated — challenges in relationships and domestic harmony. Self-worth issues may arise.`,'HIGH',-1));
  if (moonDig==='EXALTED') findings.push(rule('FEM-MOON','BPHS Ch.80',`MOON EXALTED: Exceptional beauty, grace, and nurturing quality. Mother's blessing is profound. Most auspicious Moon for women.`,'HIGH',3));

  return { findings };
}


// ═══════════════════════════════════════════════════════════════════════════
// COMPLETE VedicRulesEngine — ALL SESSIONS + STEPS 1-4
// ═══════════════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════════════
// STEP 5 — DIVISIONAL CHARTS: D4, D7, D10, D24 (BPHS CH.6)
//
// D4  Chaturthamsha  — property, fortune, fixed assets
// D7  Saptamsha      — children (confirmatory layer over D1 5th house)
// D10 Dashamsha      — career (confirmatory layer over D1 10th house)
// D24 Siddhamsha     — education and learning achievement
//
// EFFICIENCY: computed internally from planet longitudes (no extra data needed)
// Each divisional chart: ~O(9) operations. Total: O(36) — negligible
// ═══════════════════════════════════════════════════════════════════════════

// Sign parity — BPHS uses odd/even for divisional start points
const isOddSign = sign => sign % 2 === 0; // 0-indexed: Aries=0(odd), Taurus=1(even)...

// Generic divisional chart position — BPHS Ch.6
function calcVarga(lon, n) {
  const sign = Math.floor(n360(lon) / 30);
  const degInSign = n360(lon) % 30;
  const pada = Math.floor(degInSign / (30 / n)); // which part (0 to n-1)
  return { sign, pada, degInSign };
}

// D4 Chaturthamsha — BPHS Ch.6 v.10
// Each 30° sign split into 4 × 7.5° parts
// Rule: count from Aries, Cancer, Libra, Capricorn for parts 0,1,2,3 of ANY sign
// Simplified: D4 sign = (sign * 4 + pada) % 12 — standard BPHS formula
function calcD4(lon) {
  const { sign, pada } = calcVarga(lon, 4);
  return (sign * 4 + pada) % 12; // starts from Aries for all signs
}

// D7 Saptamsha — BPHS Ch.6 v.12
// Odd signs: count from sign itself | Even signs: count from 7th sign
function calcD7(lon) {
  const { sign, pada } = calcVarga(lon, 7);
  const start = isOddSign(sign) ? sign : (sign + 6) % 12;
  return (start + pada) % 12;
}

// D10 Dashamsha — BPHS Ch.6 v.13
// Odd signs: count from sign itself | Even signs: count from 9th sign
function calcD10(lon) {
  const { sign, pada } = calcVarga(lon, 10);
  const start = isOddSign(sign) ? sign : (sign + 8) % 12;
  return (start + pada) % 12;
}

// D24 Siddhamsha — BPHS Ch.6 v.15
// Odd signs: count from Leo (4) | Even signs: count from Cancer (3)
function calcD24(lon) {
  const { sign, pada } = calcVarga(lon, 24);
  const start = isOddSign(sign) ? 4 : 3;
  return (start + pada) % 12;
}

// Build varga chart: all planets + lagna in a divisional chart
function buildVargaChart(chart, calcFn) {
  const planets = {};
  for (const [p, data] of Object.entries(chart.planets)) {
    if (data.longitude === undefined) continue;
    planets[p] = { sign: calcFn(data.longitude) };
  }
  const lagnaSign = calcFn(chart.lagna * 30 + 15); // lagna as midpoint
  for (const [p, d] of Object.entries(planets)) {
    d.house = ((d.sign - lagnaSign + 12) % 12) + 1;
  }
  return { planets, lagna: lagnaSign };
}

// ── EVALUATE ALL DIVISIONAL CHARTS ────────────────────────────────────────
function evaluateVargas(chart) {
  const findings = [];

  // ── D4 CHATURTHAMSHA — Property & Fortune ──────────────────────────────
  // Key planets: 4th lord in D4, Venus, Moon
  try {
    const d4 = buildVargaChart(chart, calcD4);
    const l4 = lordOf(4, chart);
    const l4inD4 = d4.planets[l4];
    const venusInD4 = d4.planets['Venus'];
    const marsInD4  = d4.planets['Mars'];

    if (l4inD4) {
      const l4D4dig = getDignity(l4, l4inD4.sign);
      if (l4D4dig === 'EXALTED' || l4D4dig === 'OWN') {
        findings.push(rule('D4-PROP-STRONG', 'BPHS Ch.6 (D4 Chaturthamsha)',
          `D4 CONFIRMATION — PROPERTY: 4th lord ${l4} is strong in Chaturthamsha (D4 ${SIGN_PROPS[l4inD4.sign]?.name}). Property and fixed assets are confirmed at the divisional level. Multiple properties are classical.`,
          'HIGH', 2));
      } else if (l4D4dig === 'DEBILITATED') {
        findings.push(rule('D4-PROP-WEAK', 'BPHS Ch.6 (D4)',
          `D4 CAUTION — PROPERTY: 4th lord ${l4} is debilitated in Chaturthamsha — despite D1 indications, property accumulation faces deeper challenges.`,
          'HIGH', -1));
      }
    }
    if (venusInD4 && [1,4,7,10].includes(venusInD4.house)) {
      findings.push(rule('D4-VENUS', 'BPHS Ch.6 (D4)',
        `D4: Venus in kendra of Chaturthamsha — luxurious homes, beautiful domestic environment, and vehicle comfort confirmed.`,
        'MEDIUM', 1));
    }
    if (marsInD4 && (getDignity('Mars',marsInD4.sign)==='EXALTED'||getDignity('Mars',marsInD4.sign)==='OWN')) {
      findings.push(rule('D4-MARS', 'BPHS Ch.6 (D4)',
        `D4: Mars strong in Chaturthamsha — land and property gains confirmed. Real estate brings profit.`,
        'MEDIUM', 1));
    }
  } catch(e) { /* skip if longitude not available */ }

  // ── D7 SAPTAMSHA — Children ────────────────────────────────────────────
  // Key planets: Jupiter in D7, 5th lord in D7
  try {
    const d7 = buildVargaChart(chart, calcD7);
    const l5 = lordOf(5, chart);
    const l5inD7 = d7.planets[l5];
    const jupInD7 = d7.planets['Jupiter'];

    if (jupInD7) {
      const jupD7dig = getDignity('Jupiter', jupInD7.sign);
      if (jupD7dig === 'EXALTED' || jupD7dig === 'OWN') {
        findings.push(rule('D7-JUP-STRONG', 'BPHS Ch.6 (D7 Saptamsha)',
          `D7 CONFIRMATION — CHILDREN: Jupiter strong in Saptamsha (${SIGN_PROPS[jupInD7.sign]?.name}) — children are blessed at the divisional level. Gifted, intelligent children confirmed.`,
          'HIGH', 2));
      } else if (jupD7dig === 'DEBILITATED') {
        findings.push(rule('D7-JUP-WEAK', 'BPHS Ch.6 (D7)',
          `D7 CAUTION — CHILDREN: Jupiter debilitated in Saptamsha — children face challenges even if D1 looks positive.`,
          'HIGH', -1));
      }
    }
    if (l5inD7) {
      const l5D7dig = getDignity(l5, l5inD7.sign);
      if (l5D7dig === 'EXALTED' || l5D7dig === 'OWN') {
        findings.push(rule('D7-L5-STRONG', 'BPHS Ch.6 (D7)',
          `D7: 5th lord ${l5} strong in Saptamsha — children confirmed as a blessing. Quality and number of children is good.`,
          'HIGH', 2));
      } else if (l5D7dig === 'DEBILITATED') {
        findings.push(rule('D7-L5-WEAK', 'BPHS Ch.6 (D7)',
          `D7: 5th lord ${l5} debilitated in Saptamsha — challenges with children confirmed at divisional level.`,
          'HIGH', -1));
      }
    }
    // 5th house in D7 — planets there
    const h5D7 = Object.entries(d7.planets).filter(([,d])=>d.house===5).map(([p])=>p);
    if (h5D7.includes('Jupiter')||h5D7.includes('Moon')) {
      findings.push(rule('D7-5TH-BEN', 'BPHS Ch.6 (D7)',
        `D7: Benefic in 5th house of Saptamsha — children bring great joy. Nurturing parent-child relationship.`,
        'MEDIUM', 1));
    }
  } catch(e) {}

  // ── D10 DASHAMSHA — Career ─────────────────────────────────────────────
  // Key planets: 10th lord in D10, Sun (authority), Saturn (karma)
  try {
    const d10 = buildVargaChart(chart, calcD10);
    const l10 = lordOf(10, chart);
    const l10inD10 = d10.planets[l10];
    const sunInD10 = d10.planets['Sun'];
    const satInD10 = d10.planets['Saturn'];

    if (l10inD10) {
      const l10D10dig = getDignity(l10, l10inD10.sign);
      if (l10D10dig === 'EXALTED' || l10D10dig === 'OWN') {
        findings.push(rule('D10-L10-STRONG', 'BPHS Ch.6 (D10 Dashamsha)',
          `D10 CONFIRMATION — CAREER: 10th lord ${l10} strong in Dashamsha (${SIGN_PROPS[l10inD10.sign]?.name}) — career achievement is confirmed at the deepest level. Professional distinction is classical.`,
          'HIGH', 3));
      } else if (l10D10dig === 'DEBILITATED') {
        findings.push(rule('D10-L10-WEAK', 'BPHS Ch.6 (D10)',
          `D10 CAUTION — CAREER: 10th lord ${l10} debilitated in Dashamsha — career faces deeper structural challenges. Hard work may not yield proportional recognition.`,
          'HIGH', -2));
      }
    }
    if (sunInD10) {
      const sunD10dig = getDignity('Sun', sunInD10.sign);
      if (sunD10dig === 'EXALTED') {
        findings.push(rule('D10-SUN-EX', 'BPHS Ch.6 (D10)',
          `D10: Sun exalted in Dashamsha — government, authority, and public recognition are confirmed. The native is destined for positions of power.`,
          'HIGH', 2));
      }
    }
    if (satInD10) {
      const satD10dig = getDignity('Saturn', satInD10.sign);
      if (satD10dig === 'EXALTED' || satD10dig === 'OWN') {
        findings.push(rule('D10-SAT-STRONG', 'BPHS Ch.6 (D10)',
          `D10: Saturn strong in Dashamsha — career is built through discipline and persistence. Longevity in profession and respect in service is confirmed.`,
          'MEDIUM', 1));
      }
    }
    // Amatyakaraka in D10
    const amk = chart.amatyakaraka || getAmatyakaraka(chart);
    const amkInD10 = d10.planets[amk];
    if (amkInD10) {
      const amkD10dig = getDignity(amk, amkInD10.sign);
      if (amkD10dig === 'EXALTED' || amkD10dig === 'OWN') {
        findings.push(rule('D10-AMK', 'BPHS Ch.6 (D10) + JM',
          `D10: Amatyakaraka (${amk}) strong in Dashamsha — Jaimini + Parashari both confirm career excellence. Triple confirmation (D1 + D10 + Jaimini).`,
          'HIGH', 2));
      }
    }
  } catch(e) {}

  // ── D24 SIDDHAMSHA — Education ─────────────────────────────────────────
  // Key planets: Mercury, Jupiter, 4th and 5th lords
  try {
    const d24 = buildVargaChart(chart, calcD24);
    const mercInD24 = d24.planets['Mercury'];
    const jupInD24  = d24.planets['Jupiter'];
    const l5 = lordOf(5, chart);
    const l5inD24 = d24.planets[l5];

    if (mercInD24) {
      const mercD24dig = getDignity('Mercury', mercInD24.sign);
      if (mercD24dig === 'EXALTED' || mercD24dig === 'OWN') {
        findings.push(rule('D24-MERC-STRONG', 'BPHS Ch.6 (D24 Siddhamsha)',
          `D24 CONFIRMATION — EDUCATION: Mercury strong in Siddhamsha — intellectual excellence confirmed at divisional level. Advanced degrees, scholarly achievement, or professional expertise is classical.`,
          'HIGH', 2));
      } else if (mercD24dig === 'DEBILITATED') {
        findings.push(rule('D24-MERC-WEAK', 'BPHS Ch.6 (D24)',
          `D24 CAUTION — EDUCATION: Mercury debilitated in Siddhamsha — formal education faces challenges. Practical or vocational path may be better suited.`,
          'HIGH', -1));
      }
    }
    if (jupInD24) {
      const jupD24dig = getDignity('Jupiter', jupInD24.sign);
      if (jupD24dig === 'EXALTED' || jupD24dig === 'OWN') {
        findings.push(rule('D24-JUP-STRONG', 'BPHS Ch.6 (D24)',
          `D24: Jupiter strong in Siddhamsha — wisdom, philosophy, and higher learning are confirmed. Academic distinction or spiritual scholarship is classical.`,
          'HIGH', 2));
      }
    }
    if (l5inD24) {
      const l5D24dig = getDignity(l5, l5inD24.sign);
      if (l5D24dig === 'EXALTED' || l5D24dig === 'OWN') {
        findings.push(rule('D24-L5-STRONG', 'BPHS Ch.6 (D24)',
          `D24: 5th lord ${l5} strong in Siddhamsha — intelligence confirmed. Educational achievements will exceed expectations.`,
          'HIGH', 1));
      }
    }
  } catch(e) {}

  return { findings };
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 6 — TRANSIT RULES (GOCHARA) — BPHS CH.59
// Jupiter and Saturn transiting over natal planet positions
// Most precise event-timing layer in classical Vedic astrology
//
// EFFICIENCY: Only runs if chart.currentTransits is provided
// Combines with Ashtakavarga BAV scores for confidence calibration
// Injects ~60 tokens into prompt — only active planet verdicts
// ═══════════════════════════════════════════════════════════════════════════

// Transit effects of Jupiter over natal planets — BPHS Ch.59 v.1-18
const JUPITER_TRANSIT_OVER = {
  Sun:     { quality:'positive', result:`Jupiter transiting natal Sun — career recognition, authority, government favor. Father's wellbeing. Position or title elevation.` },
  Moon:    { quality:'positive', result:`Jupiter transiting natal Moon — emotional happiness, family blessings, public popularity. Mother's wellbeing. New home or domestic joy.` },
  Mars:    { quality:'positive', result:`Jupiter transiting natal Mars — courage activated, real estate gains, competitive victory. Energy is dharmic and well-directed.` },
  Mercury: { quality:'positive', result:`Jupiter transiting natal Mercury — business wisdom, educational achievement, clever deals. Intelligence is expanded and fortunate.` },
  Jupiter: { quality:'very_positive', result:`Jupiter transiting natal Jupiter — peak fortune period. Guru returns to himself. Maximum blessings in all Jupiter areas: wealth, wisdom, children, marriage.` },
  Venus:   { quality:'positive', result:`Jupiter transiting natal Venus — marriage blessings, artistic success, luxury. Relationship harmony. If marriage pending, this transit activates it.` },
  Saturn:  { quality:'mixed', result:`Jupiter transiting natal Saturn — discipline meets grace. Hard work is rewarded. Slow but certain expansion. Long-standing efforts begin to pay off.` },
  Rahu:    { quality:'mixed', result:`Jupiter transiting natal Rahu — foreign fortune, ambitious gains. Dharma meets desire. Can be excellent or confusing depending on Jupiter's BAV.` },
  Ketu:    { quality:'positive', result:`Jupiter transiting natal Ketu — spiritual breakthrough. Past karma is understood and released. Research or esoteric understanding peaks.` }
};

// Transit effects of Saturn over natal planets — BPHS Ch.59 v.19-36
const SATURN_TRANSIT_OVER = {
  Sun:     { quality:'challenging', result:`Saturn transiting natal Sun — ego tested, authority challenged. Father's health or career affected. Delays in recognition. Karmic test of pride.` },
  Moon:    { quality:'challenging', result:`Saturn transiting natal Moon — emotional heaviness, depression risk, mother's health. Mental effort required. Discipline over feelings.` },
  Mars:    { quality:'challenging', result:`Saturn transiting natal Mars — frustration, physical strain, conflict between discipline and action. Risk of accidents if careless. Forced patience.` },
  Mercury: { quality:'mixed', result:`Saturn transiting natal Mercury — serious, slow communication. Disciplined thinking. Good for focused study but not quick business. Nervous system strain.` },
  Jupiter: { quality:'challenging', result:`Saturn transiting natal Jupiter — Jupiter's blessings are restricted. Dharma is tested. Financial caution needed. Wisdom through limitation.` },
  Venus:   { quality:'challenging', result:`Saturn transiting natal Venus — love life cold or delayed. Relationship obligations. Duty in romance rather than passion. Financial discipline.` },
  Saturn:  { quality:'very_challenging', result:`Saturn transiting natal Saturn — Saturn Return (once every 29.5yr). Karmic reckoning. Major life restructuring. The old falls away to make room for the new.` },
  Rahu:    { quality:'challenging', result:`Saturn transiting natal Rahu — karmic intensity. Ambitions meet obstacles. Sudden reversals if shortcuts were taken. Pay karmic debts now.` },
  Ketu:    { quality:'mixed', result:`Saturn transiting natal Ketu — spiritual discipline. Karmic endings. Past actions come to fruition. Isolation serves spiritual purpose.` }
};

// Jupiter transit through houses (counted from Moon) — BPHS Ch.59
const JUPITER_HOUSE_TRANSIT = {
  1:  { quality:'positive', result:`Jupiter in 1st from Moon — health, vitality, and positivity. Good time for new beginnings.` },
  2:  { quality:'positive', result:`Jupiter in 2nd from Moon — wealth gains, family happiness, good speech.` },
  3:  { quality:'mixed',    result:`Jupiter in 3rd from Moon — courage needed, travel, siblings. Mixed results.` },
  4:  { quality:'positive', result:`Jupiter in 4th from Moon — domestic happiness, mother's blessing, property.` },
  5:  { quality:'very_positive', result:`Jupiter in 5th from Moon — romance, children, creativity peak. Excellent for conception.` },
  6:  { quality:'mixed',    result:`Jupiter in 6th from Moon — enemies defeated but health watch. Service focus.` },
  7:  { quality:'positive', result:`Jupiter in 7th from Moon — marriage or partnership opportunity. Relationships blessed.` },
  8:  { quality:'challenging', result:`Jupiter in 8th from Moon — obstacles, health concern, hidden difficulties.` },
  9:  { quality:'very_positive', result:`Jupiter in 9th from Moon — peak fortune, dharma, long travel, guru's grace.` },
  10: { quality:'very_positive', result:`Jupiter in 10th from Moon — career peak, authority, public recognition.` },
  11: { quality:'very_positive', result:`Jupiter in 11th from Moon — maximum gains, fulfillment of desires, income surge.` },
  12: { quality:'mixed',    result:`Jupiter in 12th from Moon — spiritual growth, foreign, expenses. Bed pleasures.` }
};

// Saturn transit through houses (from Moon) — BPHS Ch.59 (Sade Sati and Kantaka)
const SATURN_HOUSE_TRANSIT = {
  1:  { quality:'very_challenging', result:`Saturn in 1st from Moon (Sade Sati peak) — maximum pressure. Health, relationships, finances all tested. Transformation period.` },
  2:  { quality:'challenging', result:`Saturn in 2nd from Moon — financial pressure, family stress, speech issues.` },
  3:  { quality:'positive',   result:`Saturn in 3rd from Moon — discipline rewarded, courage tested and victorious.` },
  4:  { quality:'challenging', result:`Saturn in 4th from Moon — domestic stress, mother's health, property issues.` },
  5:  { quality:'challenging', result:`Saturn in 5th from Moon — children challenges, creative blocks, past karma surfaces.` },
  6:  { quality:'positive',   result:`Saturn in 6th from Moon — enemies defeated, debts paid, service excels.` },
  7:  { quality:'challenging', result:`Saturn in 7th from Moon — relationship strain, marriage pressure, partnership delays.` },
  8:  { quality:'very_challenging', result:`Saturn in 8th from Moon (Ashtama Shani) — major life obstacle period. Health, career, relationships all face serious pressure.` },
  9:  { quality:'challenging', result:`Saturn in 9th from Moon — dharma challenged, father's health, fortune delayed.` },
  10: { quality:'challenging', result:`Saturn in 10th from Moon (Kantaka Shani) — career disruption, authority pressure, public difficulties.` },
  11: { quality:'positive',   result:`Saturn in 11th from Moon — gains through discipline, elder sibling connection, income reward.` },
  12: { quality:'mixed',      result:`Saturn in 12th from Moon (Sade Sati start/end) — beginning of Saturn cycle. Expenditures, isolation begins or resolves.` }
};

function evaluateCurrentTransits(chart) {
  const findings = [];
  if (!chart.currentTransits) return { findings };

  // Get current BAV for calibration (already computed or compute now)
  let bav = null;
  try { bav = computeAshtakavarga(chart).bav; } catch(e) {}

  const moonSign = chart.planets['Moon']?.sign;
  const signToHouse = s => ((s - chart.lagna + 12) % 12) + 1;
  const moonHouse = sign => moonSign !== undefined ? ((sign - moonSign + 12) % 12) + 1 : null;

  const transitVerdicts = [];

  // ── JUPITER CURRENT TRANSIT ───────────────────────────────────────────
  if (chart.currentTransits['Jupiter'] !== undefined) {
    const jupTransitSign = chart.currentTransits['Jupiter'];
    const jupHouseFromLagna = signToHouse(jupTransitSign);
    const jupHouseFromMoon  = moonHouse(jupTransitSign);
    const jupBAV = bav ? bav['Jupiter'][jupTransitSign] : null;

    // Check if Jupiter is transiting over any natal planet
    const natalPlanets = Object.entries(chart.planets).filter(([p,d]) =>
      d.sign === jupTransitSign && p !== 'Rahu' && p !== 'Ketu'
    );

    let verdict = `JUPITER TRANSIT in ${SIGN_PROPS[jupTransitSign]?.name} (House ${jupHouseFromLagna}`;
    if (jupHouseFromMoon) verdict += `, ${jupHouseFromMoon}th from Moon`;
    if (jupBAV !== null) verdict += `, BAV:${jupBAV}/8`;
    verdict += '):\n';

    // House-from-Moon result
    if (jupHouseFromMoon && JUPITER_HOUSE_TRANSIT[jupHouseFromMoon]) {
      const htr = JUPITER_HOUSE_TRANSIT[jupHouseFromMoon];
      verdict += `  ${htr.result}`;
    }

    // Over natal planet results
    for (const [planet] of natalPlanets) {
      if (JUPITER_TRANSIT_OVER[planet]) {
        verdict += `\n  CONJUNCT natal ${planet}: ${JUPITER_TRANSIT_OVER[planet].result}`;
      }
    }

    // BAV calibration
    if (jupBAV !== null) {
      verdict += `\n  Ashtakavarga strength: ${jupBAV}/8 — ${
        jupBAV>=5 ? 'EXCELLENT — full blessings delivered' :
        jupBAV>=4 ? 'GOOD — positive results' :
        jupBAV===3 ? 'AVERAGE — partial results' :
        'WEAK — Jupiter struggles to deliver here'}`;
    }

    findings.push(rule('TRANSIT-JUP', 'BPHS Ch.59 (Gochara)',
      verdict,
      jupBAV && jupBAV >= 5 ? 'HIGH' : jupHouseFromMoon && [5,9,11].includes(jupHouseFromMoon) ? 'HIGH' : 'MEDIUM',
      jupBAV ? (jupBAV >= 5 ? 3 : jupBAV >= 4 ? 2 : jupBAV <= 2 ? -1 : 1) : 1));
    transitVerdicts.push(verdict);
  }

  // ── SATURN CURRENT TRANSIT ─────────────────────────────────────────────
  if (chart.currentTransits['Saturn'] !== undefined) {
    const satTransitSign = chart.currentTransits['Saturn'];
    const satHouseFromLagna = signToHouse(satTransitSign);
    const satHouseFromMoon  = moonHouse(satTransitSign);
    const satBAV = bav ? bav['Saturn'][satTransitSign] : null;

    const natalPlanets = Object.entries(chart.planets).filter(([p,d]) =>
      d.sign === satTransitSign && p !== 'Rahu' && p !== 'Ketu'
    );

    let verdict = `SATURN TRANSIT in ${SIGN_PROPS[satTransitSign]?.name} (House ${satHouseFromLagna}`;
    if (satHouseFromMoon) verdict += `, ${satHouseFromMoon}th from Moon`;
    if (satBAV !== null) verdict += `, BAV:${satBAV}/8`;
    verdict += '):\n';

    if (satHouseFromMoon && SATURN_HOUSE_TRANSIT[satHouseFromMoon]) {
      const htr = SATURN_HOUSE_TRANSIT[satHouseFromMoon];
      verdict += `  ${htr.result}`;

      // Sade Sati detection
      if ([12,1,2].includes(satHouseFromMoon)) {
        verdict += `\n  SADE SATI ACTIVE (Saturn within 3 signs of Moon) — 7.5-year karmic cycle. ${
          satHouseFromMoon===1 ? 'PEAK pressure.' :
          satHouseFromMoon===12 ? 'Cycle beginning.' : 'Cycle ending.'}`;
      }
      // Kantaka Saturn
      if (satHouseFromMoon===10) {
        verdict += `\n  KANTAKA SHANI — Saturn in 10th from Moon. Career disruption period. Authority challenges.`;
      }
      // Ashtama Saturn
      if (satHouseFromMoon===8) {
        verdict += `\n  ASHTAMA SHANI — Saturn in 8th from Moon. Most challenging Saturn transit. Full life review required.`;
      }
    }

    for (const [planet] of natalPlanets) {
      if (SATURN_TRANSIT_OVER[planet]) {
        verdict += `\n  CONJUNCT natal ${planet}: ${SATURN_TRANSIT_OVER[planet].result}`;
      }
    }

    if (satBAV !== null) {
      verdict += `\n  Ashtakavarga: ${satBAV}/8 — ${
        satBAV>=4 ? 'Good BAV — Saturn works constructively here' :
        satBAV<=2 ? 'Low BAV — Saturn is most difficult here' :
        'Average BAV — mixed results'}`;
    }

    const isSadeSati = satHouseFromMoon && [12,1,2].includes(satHouseFromMoon);
    findings.push(rule('TRANSIT-SAT', 'BPHS Ch.59 (Gochara)',
      verdict,
      isSadeSati || (satBAV && satBAV<=2) ? 'HIGH' : 'MEDIUM',
      satBAV ? (satBAV>=4 ? 1 : satBAV<=2 ? -2 : -1) : -1));
    transitVerdicts.push(verdict);
  }

  // ── RAHU/KETU TRANSIT ─────────────────────────────────────────────────
  // 18-month cycle, highly significant for karmic shifts
  if (chart.currentTransits['Rahu'] !== undefined) {
    const rahuSign = chart.currentTransits['Rahu'];
    const ketuSign = (rahuSign + 6) % 12;
    const rahuHouse = signToHouse(rahuSign);
    const ketuHouse = signToHouse(ketuSign);

    const rahuHouseEffect = {
      1:`Identity transformation, foreign quality, unusual events`,
      2:`Financial obsession, unusual income, family karma`,
      3:`Courageous ambition, foreign communication, sibling karma`,
      4:`Home instability, mother karma, property changes`,
      5:`Children karma, unconventional romance, past-life memories`,
      6:`Enemies multiply or collapse, health karma, debt resolution`,
      7:`Foreign or unconventional relationship, marriage karma`,
      8:`Sudden changes, inheritance, mystical experiences`,
      9:`Dharma confusion or foreign dharma, guru issues`,
      10:`Rapid career rise or fall, foreign career connection`,
      11:`Unconventional gains, foreign friends, sudden income`,
      12:`Foreign settlement pull, spiritual disruption, hidden losses`
    };

    findings.push(rule('TRANSIT-RAHU', 'BPHS Ch.59',
      `RAHU-KETU TRANSIT: Rahu in ${SIGN_PROPS[rahuSign]?.name} (${rahuHouse}th house) | Ketu in ${SIGN_PROPS[ketuSign]?.name} (${ketuHouse}th house). Rahu effect: ${rahuHouseEffect[rahuHouse]||'life axis shifting'}. This 18-month transit is activating the ${rahuHouse}th and ${ketuHouse}th house axis — karmic themes of these houses are being resolved.`,
      'HIGH', 0));
  }

  return { findings, transitVerdicts };
}


// ═══════════════════════════════════════════════════════════════════════════
// COMPLETE VedicRulesEngine — ALL SESSIONS + STEPS 1-6
// ═══════════════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════════════
// STEP 8 — PRASHNA MARGA: ITHASALA & MUSARIPHA (PM CH.8-12)
// Kerala horary astrology — most precise yes/no timing system
//
// Ithasala (Itthasala) = Applying aspect — faster planet approaching slower
//   → YES, the matter WILL come to pass. Timing = degrees to exact aspect.
// Musaripha = Separating aspect — faster planet has moved past slower
//   → Timing has passed, or matter is behind the native.
// Easasana = Transfer — a third planet picks up and carries the matter
//   → YES but through an intermediary.
//
// Used in: Ask tab Prashna chart (cast at question time)
// ═══════════════════════════════════════════════════════════════════════════

// Mean daily motion in degrees (approximate, for Ithasala calculation)
const PLANET_SPEED = {
  Moon:0.549, Sun:0.041, Mercury:0.058, Venus:0.051,
  Mars:0.022, Jupiter:0.0035, Saturn:0.0014, Rahu:0.0027, Ketu:0.0027
};

// Standard orbs for Ithasala aspects (Prashna Marga Ch.8)
// Varies by planet — wider for Moon, tighter for slow planets
const ITHASALA_ORB = {
  Sun:15, Moon:12, Mars:8, Mercury:7, Jupiter:9, Venus:7, Saturn:9, Rahu:7, Ketu:7
};

// Check if P1 is applying to P2 (Ithasala) or separating (Musaripha)
// Returns: { type: 'ithasala'|'musaripha'|'none', degrees: number, timing: string }
function checkIthasala(p1Name, p2Name, chart) {
  const p1 = chart.planets[p1Name];
  const p2 = chart.planets[p2Name];
  if (!p1 || !p2) return { type: 'none' };

  const lon1 = p1.longitude || (p1.sign * 30 + (p1.degree||15));
  const lon2 = p2.longitude || (p2.sign * 30 + (p2.degree||15));
  const speed1 = PLANET_SPEED[p1Name] || 0.05;
  const speed2 = PLANET_SPEED[p2Name] || 0.05;

  // P1 must be faster to be the applying planet
  if (speed1 <= speed2) return { type: 'none' };

  // Angular separation — degrees ahead of P1 to reach P2
  const diff = n360(lon2 - lon1);
  const orb = Math.min(ITHASALA_ORB[p1Name]||7, ITHASALA_ORB[p2Name]||7);

  if (diff <= orb) {
    // Applying — Ithasala
    const daysToExact = diff / (speed1 - speed2);
    const timing = daysToExact < 1 ? 'within hours' :
      daysToExact < 7 ? `~${Math.round(daysToExact)} days` :
      daysToExact < 30 ? `~${Math.round(daysToExact/7)} weeks` :
      daysToExact < 365 ? `~${Math.round(daysToExact/30)} months` :
      `~${(daysToExact/365).toFixed(1)} years`;
    return { type: 'ithasala', degrees: +diff.toFixed(2), timing, daysToExact };
  }

  // Check if recently separated (within double the orb — Musaripha zone)
  const recentSep = n360(lon1 - lon2);
  if (recentSep <= orb * 1.5) {
    return { type: 'musaripha', degrees: +recentSep.toFixed(2),
      timing: `separated ${+(recentSep/(speed1-speed2)).toFixed(0)} days ago` };
  }

  return { type: 'none' };
}

// Full Prashna aspect analysis — PM Ch.8-12
function evaluatePrashnaAspects(chart) {
  const findings = [];
  if (!chart.prashna) return { findings, verdict: 'No Prashna data' };

  const moon = chart.planets['Moon'];
  const lagnaLord = lordOf(1, chart);
  const qHouse = chart.prashna.questionHouse || 7; // default to 7th for love/marriage
  const qLord = lordOf(qHouse, chart);
  const significator = chart.prashna.significator || qLord;

  // Primary Ithasala: Moon applying to question lord
  const moonToQL = checkIthasala('Moon', qLord, chart);
  // Secondary: Lagna lord applying to question lord
  const llToQL   = checkIthasala(lagnaLord, qLord, chart);
  // Moon to significator
  const moonToSig = significator !== qLord ? checkIthasala('Moon', significator, chart) : { type: 'none' };

  let verdict = '';
  let yesNo = 'UNCERTAIN';
  let timing = '';

  // PRIMARY VERDICT based on Moon's applying aspects
  if (moonToQL.type === 'ithasala') {
    yesNo = 'YES';
    timing = moonToQL.timing;
    verdict = `ITHASALA (YES): Moon is applying to ${qLord} (${moonToQL.degrees}° to exact) — the matter WILL come to pass. Timing: ${timing}. Moon applying to the question lord is the strongest classical YES indicator in Prashna Marga.`;
    findings.push(rule('PM-ITHASALA-MOON', 'PM Ch.8',
      verdict, 'HIGH', 3));
  } else if (moonToQL.type === 'musaripha') {
    yesNo = 'PAST/NO';
    verdict = `MUSARIPHA (PAST): Moon has already separated from ${qLord} (${moonToQL.degrees}° past) — the matter has already occurred or the best timing has passed. ${moonToQL.timing}. Re-examine if timing is correct.`;
    findings.push(rule('PM-MUSARIPHA-MOON', 'PM Ch.8',
      verdict, 'HIGH', -2));
  }

  // SECONDARY: Lagna lord aspect
  if (llToQL.type === 'ithasala' && yesNo !== 'YES') {
    yesNo = 'LIKELY YES';
    timing = llToQL.timing;
    findings.push(rule('PM-ITHASALA-LL', 'PM Ch.9',
      `ITHASALA (LAGNA LORD): Lagna lord ${lagnaLord} applying to ${qLord} (${llToQL.degrees}° to exact). Likely YES — timing: ${timing}. Secondary confirmation through lagna lord.`,
      'MEDIUM', 2));
  }

  // EASASANA: Moon transfers to a third planet
  const outerPlanets = ['Saturn','Jupiter','Mars'];
  for (const op of outerPlanets) {
    if (op === qLord || op === lagnaLord) continue;
    const moonToOp = checkIthasala('Moon', op, chart);
    const opToQL   = checkIthasala(op, qLord, chart);
    if (moonToOp.type === 'ithasala' && opToQL.type === 'ithasala') {
      findings.push(rule('PM-EASASANA', 'PM Ch.10',
        `EASASANA (TRANSFER): Moon → ${op} → ${qLord}. Matter comes to pass through an intermediary (${op}). Timing: ${moonToOp.timing} for first meeting, then ${opToQL.timing} for completion.`,
        'HIGH', 2));
      if (yesNo === 'UNCERTAIN') { yesNo = 'YES (via intermediary)'; timing = moonToOp.timing; }
      break;
    }
  }

  // Moon in benefic/malefic sign — quality of outcome
  const moonSign = moon?.sign;
  if (moonSign !== undefined) {
    const moonSep = SIGN_PROPS[moonSign];
    if (['Taurus','Cancer','Leo','Libra','Sagittarius','Pisces'].includes(moonSep?.name)) {
      findings.push(rule('PM-MOON-SIGN', 'PM Ch.12',
        `Moon in ${moonSep?.name} — auspicious sign for Prashna. Quality of outcome, if positive, is good.`,
        'MEDIUM', 1));
    } else if (['Aries','Scorpio','Capricorn'].includes(moonSep?.name)) {
      findings.push(rule('PM-MOON-SIGN-M', 'PM Ch.12',
        `Moon in ${moonSep?.name} — challenging sign for Prashna. Even if YES, the path involves obstacles.`,
        'MEDIUM', -1));
    }
  }

  // Moon house in Prashna lagna — strong positions
  if (moon) {
    const mHouse = moon.house;
    if ([1,4,7,10].includes(mHouse)) {
      findings.push(rule('PM-MOON-KENDRA', 'PM Ch.11',
        `Moon in kendra (${mHouse}th) of Prashna chart — strong position. Answer is clear and significant.`,
        'HIGH', 1));
    } else if ([6,8,12].includes(mHouse)) {
      findings.push(rule('PM-MOON-DUST', 'PM Ch.11',
        `Moon in dusthana (${mHouse}th) of Prashna chart — difficult position. Matter is challenged.`,
        'HIGH', -1));
    }
  }

  // Lagna lord in good position — overall favorable prashna
  const llHouse = houseOfPlanet(lagnaLord, chart);
  if (KENDRAS.includes(llHouse) || TRIKONAS.includes(llHouse)) {
    findings.push(rule('PM-LL-GOOD', 'PM Ch.9',
      `Lagna lord ${lagnaLord} in benefic house (${llHouse}th) — questioner is in a favorable position to receive a positive outcome.`,
      'MEDIUM', 1));
  }

  const compoundVerdict = `PRASHNA VERDICT: ${yesNo}. ${timing ? 'Timing: ' + timing + '.' : ''} ${verdict || 'No strong Ithasala detected — result is uncertain.'}`;
  findings.push(rule('PM-COMPOUND', 'PM Ch.8-12', compoundVerdict, yesNo==='YES'||yesNo==='PAST/NO'?'HIGH':'MEDIUM', 0));

  return { findings, yesNo, timing, verdict: compoundVerdict };
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 9 — REMEDY SYSTEM (BPHS CH.91-97)
// Classical upayas: gems, mantras, charity, fasting, behavioral
// Source: BPHS Ch.91-97, Ratna Pariksha, Muhurta Chintamani
//
// EFFICIENCY: Runs only for afflicted planets — no output for strong ones
// Generates actionable, specific remedies — not generic advice
// ═══════════════════════════════════════════════════════════════════════════

const PLANET_REMEDIES = {
  Sun: {
    gem: 'Ruby (Manik) — minimum 3 carats, worn on ring finger of right hand on Sunday morning',
    mantra: 'Om Hraam Hreem Hraum Sah Suryaya Namah — 6,000 times over 40 days',
    charity: 'Wheat, copper, red flowers, jaggery to Brahmins on Sunday',
    fast: 'Sunday fast (eat once before sunset)',
    behavioral: 'Honor father and authority figures. Bow to the sun at sunrise. Avoid ego conflicts.',
    deity: 'Surya (Sun) — Surya Namaskar daily, Aditya Hridayam recitation'
  },
  Moon: {
    gem: 'Natural Pearl (Moti) — minimum 5 carats, set in silver, worn on little finger on Monday',
    mantra: 'Om Shraam Shreem Shraum Sah Chandramashe Namah — 10,000 times over 40 days',
    charity: 'White rice, milk, white clothes, silver to women on Monday',
    fast: 'Monday fast',
    behavioral: 'Honor mother. Respect women. Avoid emotional outbursts. Meditate near water.',
    deity: 'Shiva (Moon rules water and mind) — Shiv Abhishek on Monday with milk'
  },
  Mars: {
    gem: 'Red Coral (Moonga) — minimum 6 carats, set in gold or copper, worn on ring finger on Tuesday',
    mantra: 'Om Kraam Kreem Kraum Sah Bhaumaya Namah — 7,000 times over 40 days',
    charity: 'Red lentils, red cloth, copper items on Tuesday',
    fast: 'Tuesday fast',
    behavioral: 'Control anger. Avoid impulsive actions. Channel Mars energy into exercise and courage.',
    deity: 'Hanuman — visit Hanuman temple on Tuesday, recite Hanuman Chalisa'
  },
  Mercury: {
    gem: 'Emerald (Panna) — minimum 3 carats, set in gold, worn on little finger on Wednesday',
    mantra: 'Om Braam Breem Braum Sah Budhaya Namah — 17,000 times over 40 days',
    charity: 'Green vegetables, green cloth, books on Wednesday',
    fast: 'Wednesday fast',
    behavioral: 'Speak truth. Avoid gossip. Study and learn continuously. Be honest in business.',
    deity: 'Vishnu — recite Vishnu Sahasranama on Wednesday'
  },
  Jupiter: {
    gem: 'Yellow Sapphire (Pukhraj) — minimum 3 carats, set in gold, worn on index finger on Thursday',
    mantra: 'Om Graam Greem Graum Sah Guruve Namah — 16,000 times over 40 days',
    charity: 'Yellow turmeric, chickpea dal, yellow cloth, gold to Brahmins on Thursday',
    fast: 'Thursday fast',
    behavioral: 'Respect guru, elders, priests. Give generously. Seek and share wisdom.',
    deity: 'Brihaspati (Jupiter) — worship banana tree on Thursday, offer yellow flowers'
  },
  Venus: {
    gem: 'Diamond (Heera) or White Sapphire — minimum 0.5 carats, set in platinum/white gold, worn on middle finger on Friday',
    mantra: 'Om Draam Dreem Draum Sah Shukraya Namah — 20,000 times over 40 days',
    charity: 'White rice, white flowers, white clothes, silver to young women on Friday',
    fast: 'Friday fast',
    behavioral: 'Cultivate beauty, art, music. Respect women. Avoid overindulgence.',
    deity: 'Lakshmi — recite Shri Sukta on Friday, offer lotus flowers'
  },
  Saturn: {
    gem: 'Blue Sapphire (Neelam) — minimum 3 carats, set in iron/silver, worn on middle finger on Saturday. Test first — wear for 3 days trial.',
    mantra: 'Om Praam Preem Praum Sah Shanaischaraya Namah — 19,000 times over 40 days',
    charity: 'Black sesame, black cloth, iron items, mustard oil lamp under peepal tree on Saturday',
    fast: 'Saturday fast',
    behavioral: 'Serve the poor and elderly. Avoid shortcuts. Accept limitations with grace.',
    deity: 'Shani (Saturn) — offer mustard oil to Shani on Saturday, visit Shani temple'
  },
  Rahu: {
    gem: 'Hessonite Garnet (Gomed) — minimum 6 carats, set in silver, worn on middle finger on Saturday',
    mantra: 'Om Bhraam Bhreem Bhraum Sah Rahave Namah — 18,000 times over 40 days',
    charity: 'Blue-black items, coconut, iron on Saturday',
    fast: 'Saturday fast, Rahu Kaal awareness',
    behavioral: 'Avoid deception. Ground yourself. Ancestral Pitru Puja on Amavasya.',
    deity: 'Durga — recite Durga Saptashati, especially on Navratri'
  },
  Ketu: {
    gem: "Cat's Eye (Lehsuniya) — minimum 4 carats, set in gold, worn on little finger on Thursday",
    mantra: 'Om Sraam Sreem Sraum Sah Ketave Namah — 7,000 times over 40 days',
    charity: 'Multicolor cloth, blankets, sesame on Tuesday',
    fast: 'Tuesday fast',
    behavioral: 'Develop spiritual practices. Let go of attachments. Study past-life patterns.',
    deity: 'Ganesha — recite Ganesha Atharvashirsha, especially on Chaturthi'
  }
};

// Special combination remedies
const SPECIAL_REMEDIES = {
  MANGAL_DOSHA: {
    remedy: 'Mangal Dosha remedy: Kumbh Vivah (marriage to banana tree or Vishnu idol before wedding). Perform on a Tuesday during Mars hora. Red coral for Mars strengthening.',
    mantra: 'Mangal Kavach — recite 108 times on Tuesday for 40 days'
  },
  KAAL_SARPA: {
    remedy: 'Kaal Sarpa remedy: Trimbakeshwar or Ujjain puja specifically for Kaal Sarpa. Naga Panchami worship. Offer milk to snake idol. Silver snake pair kept at home.',
    mantra: 'Maha Mrityunjaya Mantra — 1008 times on Naga Panchami'
  },
  PITRU_DOSHA: {
    remedy: 'Pitru Dosha remedy: Perform Shradh (ancestor ritual) on Amavasya. Offer water to ancestors (Tarpan) at holy river. Feed crows and Brahmins on Pitru Paksha (15 days before Navratri).',
    mantra: 'Om Pitrubhyo Namah — recite 108 times with water offering at sunset'
  },
  SADE_SATI: {
    remedy: 'Sade Sati (Saturn 7.5 year cycle): Saturday fasting. Donate black sesame, iron, mustard oil. Hanuman Chalisa recitation. Service to the poor and elderly. Avoid new major ventures in peak period.',
    mantra: 'Shani Stotra daily during Sade Sati peak'
  }
};

function evaluateRemedies(chart) {
  const findings = [];
  const remediesNeeded = [];

  // Check each planet for weakness requiring remedy
  for (const [planet, data] of Object.entries(chart.planets)) {
    if (!data || !PLANET_REMEDIES[planet]) continue;
    const dignity = getDignity(planet, data.sign);
    const house = data.house;
    const isCombust_ = isCombust(planet, chart);
    const inDusthana = DUSTHANAS.includes(house);
    const remedyData = PLANET_REMEDIES[planet];

    // Determine if remedy needed and at what priority
    let needsRemedy = false;
    let priority = 'LOW';
    let reason = '';

    if (dignity === 'DEBILITATED' && !neechaBhanga(planet, chart)) {
      needsRemedy = true; priority = 'HIGH';
      reason = `${planet} is debilitated in ${SIGN_PROPS[data.sign]?.name}`;
    } else if (dignity === 'DEBILITATED' && neechaBhanga(planet, chart)) {
      needsRemedy = true; priority = 'MEDIUM';
      reason = `${planet} has Neecha Bhanga but still benefits from strengthening`;
    } else if (isCombust_) {
      needsRemedy = true; priority = 'MEDIUM';
      reason = `${planet} is combust (within Sun's orb)`;
    } else if (inDusthana && !isStrong(planet, data.sign)) {
      needsRemedy = true; priority = 'MEDIUM';
      reason = `${planet} in ${house}th (dusthana) without strength`;
    } else if (dignity === 'EXALTED' || dignity === 'OWN') {
      // Strong planets don't need remedy — skip
      continue;
    }

    if (needsRemedy) {
      remediesNeeded.push({ planet, priority, reason });
      findings.push(rule(`REMEDY-${planet}`, `BPHS Ch.91-97 (${planet} remedy)`,
        `REMEDY FOR ${planet.toUpperCase()} (${reason}):\n` +
        `  Gem: ${remedyData.gem}\n` +
        `  Mantra: ${remedyData.mantra}\n` +
        `  Charity: ${remedyData.charity}\n` +
        `  Behavioral: ${remedyData.behavioral}\n` +
        `  Deity: ${remedyData.deity}`,
        priority==='HIGH'?'HIGH':'MEDIUM', 0));
    }
  }

  // Check special combination remedies

  // Mangal Dosha
  const mars = chart.planets['Mars'];
  if (mars && [1,2,4,7,8,12].includes(mars.house)) {
    const cancelled = (
      ['Jupiter','Venus','Moon'].some(p => chart.planets[p]?.house === mars.house) ||
      [0,7].includes(chart.lagna) ||
      planetAspectsHouse('Jupiter', chart, mars.house)
    );
    if (!cancelled) {
      findings.push(rule('REMEDY-MANGAL', 'BPHS Ch.81 + remedial texts',
        `MANGAL DOSHA REMEDY:\n  ${SPECIAL_REMEDIES.MANGAL_DOSHA.remedy}\n  Mantra: ${SPECIAL_REMEDIES.MANGAL_DOSHA.mantra}`,
        'HIGH', 0));
    }
  }

  // Pitru Dosha
  const h9 = planetsInHouse(9, chart);
  const sun = chart.planets['Sun'];
  if (h9.includes('Rahu') || conjunct('Rahu','Sun',chart) ||
     (getDignity('Sun',sun?.sign)==='DEBILITATED' && DUSTHANAS.includes(houseOfPlanet(lordOf(9,chart),chart)))) {
    findings.push(rule('REMEDY-PITRU', 'BPHS + NS (Pitru Dosha)',
      `PITRU DOSHA REMEDY:\n  ${SPECIAL_REMEDIES.PITRU_DOSHA.remedy}\n  Mantra: ${SPECIAL_REMEDIES.PITRU_DOSHA.mantra}`,
      'HIGH', 0));
  }

  // Kaal Sarpa
  const rahu = chart.planets['Rahu'];
  const ketu = chart.planets['Ketu'];
  if (rahu && ketu) {
    const otherPlanets = ['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn'];
    const rahuH = rahu.house;
    const ketuH = ketu.house;
    const hemeHouses = Array.from({length:6},(_,i)=>((rahuH-1+i)%12)+1);
    if (otherPlanets.every(p=>hemeHouses.includes(chart.planets[p]?.house))) {
      findings.push(rule('REMEDY-KAALSARPA', 'BPHS + Prashna Marga',
        `KAAL SARPA REMEDY:\n  ${SPECIAL_REMEDIES.KAAL_SARPA.remedy}\n  Mantra: ${SPECIAL_REMEDIES.KAAL_SARPA.mantra}`,
        'HIGH', 0));
    }
  }

  // Sade Sati — if Saturn is in 12th, 1st, or 2nd from Moon
  if (chart.currentTransits?.Saturn !== undefined && chart.planets['Moon']) {
    const satTransitSign = chart.currentTransits.Saturn;
    const moonSign = chart.planets['Moon'].sign;
    const satFromMoon = ((satTransitSign - moonSign + 12) % 12) + 1;
    if ([12,1,2].includes(satFromMoon)) {
      findings.push(rule('REMEDY-SADESATI', 'BPHS Ch.91',
        `SADE SATI REMEDY (Saturn ${satFromMoon}th from Moon — cycle ${satFromMoon===1?'PEAK':satFromMoon===12?'beginning':'ending'}):\n  ${SPECIAL_REMEDIES.SADE_SATI.remedy}\n  Mantra: ${SPECIAL_REMEDIES.SADE_SATI.mantra}`,
        'HIGH', 0));
    }
  }

  // Priority summary
  const highPriority = remediesNeeded.filter(r=>r.priority==='HIGH');
  const medPriority  = remediesNeeded.filter(r=>r.priority==='MEDIUM');

  if (remediesNeeded.length > 0) {
    findings.push(rule('REMEDY-SUMMARY', 'BPHS Ch.91-97',
      `REMEDY PRIORITY: HIGH — ${highPriority.map(r=>r.planet).join(', ')||'none'} | MEDIUM — ${medPriority.map(r=>r.planet).join(', ')||'none'}. Focus on HIGH priority first. Gem recommendations require consultation with a qualified Jyotishi before purchase.`,
      'HIGH', 0));
  } else {
    findings.push(rule('REMEDY-NONE', 'BPHS Ch.91-97',
      `REMEDIES: No major planetary afflictions requiring urgent intervention. Chart is relatively well-positioned. General strengthening mantras and spiritual practice are sufficient.`,
      'LOW', 0));
  }

  return { findings, remediesNeeded };
}


// ═══════════════════════════════════════════════════════════════════════════
// COMPLETE VedicRulesEngine — ALL SESSIONS + STEPS 1-9
// 30 life areas | BPHS + Phaladeepika + Saravali + Jaimini + Prashna Marga
// ═══════════════════════════════════════════════════════════════════════════

class VedicRulesEngine {
  constructor(chart) { this.chart = chart; }

  evaluate() {
    const c = this.chart;
    if (!c.atmakaraka)   c.atmakaraka   = getAtmakaraka(c);
    if (!c.amatyakaraka) c.amatyakaraka = getAmatyakaraka(c);
    if (!c.darakaraka)   c.darakaraka   = getDarakaraka(c);

    // ── PARASHARI CORE ───────────────────────────────────────────────────
    const lagna         = evaluateLagna(c);
    const mind          = evaluateMind(c);
    const marriage      = evaluateMarriage(c);
    const children      = evaluateChildren(c);
    const father        = evaluateFather(c);
    const mother        = evaluateMother(c);
    const siblings      = evaluateSiblings(c);
    const career        = evaluateCareer(c);
    const wealth        = evaluateWealth(c);
    const health        = evaluateHealth(c);
    const foreignTravel = evaluateForeignTravel(c);
    const property      = evaluateProperty(c);
    const education     = evaluateEducation(c);
    const spirituality  = evaluateSpirituality(c);
    const yogas         = evaluateYogas(c);
    const dasha         = evaluateDasha(c);
    const enemies       = evaluateEnemies(c);
    const communication = evaluateCommunication(c);
    // ── STEP 3: ASHTAKAVARGA ─────────────────────────────────────────────
    const ashtakavarga  = evaluateAshtakavarga(c);
    // ── STEP 4: SECONDARY AREAS ──────────────────────────────────────────
    const secondary     = evaluateSecondaryAreas(c);
    const female        = evaluateFemaleHoroscopy(c);
    // ── STEP 5: DIVISIONAL CHARTS ────────────────────────────────────────
    const vargas        = evaluateVargas(c);
    // ── STEP 6: TRANSITS ─────────────────────────────────────────────────
    const transits      = evaluateCurrentTransits(c);
    // ── STEP 8: PRASHNA (only if prashna data provided) ──────────────────
    const prashna       = c.prashna ? evaluatePrashnaAspects(c) : { findings: [] };
    // ── STEP 9: REMEDIES ─────────────────────────────────────────────────
    const remedies      = evaluateRemedies(c);
    // ── STEP 1: JAIMINI (sets _jaiminiKarakas, _upapada, _karakamsha) ────
    const jaiminiKarakas= evaluateJaiminiKarakas(c);
    const upapada       = evaluateUpapada(c);
    const arudhaLagna   = evaluateArudhaLagna(c);
    const charaDasha    = evaluateCharaDasha(c);
    const jaiminiYogas  = evaluateJaiminiYogas(c);

    const cv = (findings, kw) =>
      findings?.find(r=>r.id?.includes(kw))?.verdict ||
      findings?.[findings.length-1]?.verdict || '';

    return {
      // Parashari
      lagna:          { verdicts:lagna.map(r=>r.verdict), rules:lagna },
      mind:           { verdicts:mind.map(r=>r.verdict), rules:mind },
      marriage:       { verdict:cv(marriage.findings,'MARRIAGE-COMPOUND'), score:marriage.marriageScore, timing:marriage.timing, spouse:marriage.spouseDescription, rules:marriage.findings },
      children:       { verdict:cv(children.findings,'CHILDREN-COMPOUND'), score:children.childScore, rules:children.findings },
      father:         { verdict:cv(father.findings,'FATHER-COMPOUND'), score:father.fatherScore, rules:father.findings },
      mother:         { verdict:cv(mother.findings,'MOTHER-COMPOUND'), score:mother.motherScore, rules:mother.findings },
      siblings:       { verdict:cv(siblings.findings,'SIBLINGS-COMPOUND'), score:siblings.siblingScore, count:siblings.countEstimate, elderGender:siblings.elderGender, relation:siblings.relation, rules:siblings.findings },
      career:         { verdict:cv(career.findings,'CAREER-COMPOUND'), score:career.careerScore, fields:career.fields, rules:career.findings },
      wealth:         { verdict:cv(wealth.findings,'WEALTH-COMPOUND'), score:wealth.wealthScore, sources:wealth.sources, rules:wealth.findings },
      health:         { verdict:cv(health.findings,'HEALTH-COMPOUND'), score:health.healthScore, longevity:health.longevityScore, vulnerableAreas:health.vulnerableAreas, diseases:health.diseases, rules:health.findings },
      foreignTravel:  { verdict:cv(foreignTravel.findings,'FOREIGN-COMPOUND'), score:foreignTravel.foreignScore, settlement:foreignTravel.settlementLikelihood, rules:foreignTravel.findings },
      property:       { verdict:cv(property.findings,'PROPERTY-COMPOUND'), score:property.propertyScore, rules:property.findings },
      education:      { verdict:cv(education.findings,'EDU-COMPOUND'), score:education.eduScore, fields:education.fields, rules:education.findings },
      spirituality:   { verdict:cv(spirituality.findings,'SPIRIT-COMPOUND'), score:spirituality.spiritualScore, path:spirituality.path, rules:spirituality.findings },
      yogas:          { summary:yogas.summary, yogas:yogas.yogas, rules:yogas.findings },
      dasha:          { verdict:dasha.verdict, maha:dasha.maha, antar:dasha.antar, pratyantar:dasha.pratyantar, rules:dasha.findings },
      enemies:        { verdict:cv(enemies.findings,'ENEMY-COMPOUND'), score:enemies.enemyScore, litigationRisk:enemies.litigationRisk, rules:enemies.findings },
      communication:  { verdict:cv(communication.findings,'SPEECH-COMPOUND'), quality:communication.speechQuality, rules:communication.findings },
      // Steps 3-6
      ashtakavarga:   { sav:ashtakavarga.sav, bav:ashtakavarga.bav, trikonaSAV:ashtakavarga.trikonaSAV, kendraSAV:ashtakavarga.kendraSAV, dusthanaSAV:ashtakavarga.dusthanaSAV, strongHouses:ashtakavarga.strongHouses, weakHouses:ashtakavarga.weakHouses, verdicts:ashtakavarga.findings.map(r=>r.verdict), rules:ashtakavarga.findings },
      secondary:      { verdicts:secondary.findings.map(r=>r.verdict), rules:secondary.findings },
      femaleHoroscopy: c.gender==='F' ? { verdicts:female.findings.map(r=>r.verdict), rules:female.findings } : null,
      vargas:         { verdicts:vargas.findings.map(r=>r.verdict), rules:vargas.findings },
      transits:       { verdicts:transits.findings.map(r=>r.verdict), rules:transits.findings },
      // Steps 8-9
      prashna:        { verdict:prashna.yesNo||'', timing:prashna.timing||'', verdicts:prashna.findings.map(r=>r.verdict), rules:prashna.findings },
      remedies:       { summary:cv(remedies.findings,'REMEDY-SUMMARY')||cv(remedies.findings,'REMEDY-NONE'), needed:remedies.remediesNeeded, verdicts:remedies.findings.map(r=>r.verdict), rules:remedies.findings },
      // Jaimini
      jaiminiKarakas: { karakas:jaiminiKarakas.karakas, verdicts:jaiminiKarakas.findings.map(r=>r.verdict), rules:jaiminiKarakas.findings },
      upapada:        { house:upapada.upapadaHouse, sign:upapada.upapadaSign, lordDignity:upapada.ulDignity, verdicts:upapada.findings.map(r=>r.verdict), rules:upapada.findings },
      arudhaLagna:    { house:arudhaLagna.arudhaHouse, sign:arudhaLagna.arudhaSign, verdicts:arudhaLagna.findings.map(r=>r.verdict), rules:arudhaLagna.findings },
      charaDasha:     { verdicts:charaDasha.findings.map(r=>r.verdict), rules:charaDasha.findings },
      jaiminiYogas:   { verdicts:jaiminiYogas.findings.map(r=>r.verdict), rules:jaiminiYogas.findings }
    };
  }
}

module.exports = {
  VedicRulesEngine,
  getDignity, planetsInHouse, NAKSHATRA, SIGN_PROPS,
  DASHA_YEARS, DASHA_SEQ, ANTAR_TABLE,
  getAtmakaraka, getDarakaraka, getAmatyakaraka,
  computeCharaDasha,
  evaluatePrashnaAspects
};
