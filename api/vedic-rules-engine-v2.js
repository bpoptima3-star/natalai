/**
 * VEDIC ASTROLOGY DETERMINISTIC RULES ENGINE — VERSION 2
 * COMPLETE EDITION
 *
 * Sources:
 *   BPHS   — Brihat Parashara Hora Shastra (all 97 chapters)
 *   PD     — Phaladeepika
 *   SAR    — Saravali
 *   BJ     — Brihat Jataka
 *   UK     — Uttara Kalamrita
 *   JP     — Jataka Parijata
 *   JM     — Jaimini Sutram
 *   KP     — Krishnamurti Paddhati
 *   NS     — Nadi Shastra (general)
 *
 * Architecture: Pure deterministic IF/THEN. Zero LLM in this file.
 * Input:  Fully computed chart object
 * Output: Hard verdicts per life area, confidence level, source reference
 *
 * Rule count target: 2,000+
 */

'use strict';

// ═══════════════════════════════════════════════════════════════
// SECTION 1 — CONSTANTS & LOOKUP TABLES
// ═══════════════════════════════════════════════════════════════

const SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo',
               'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];

const SIGN_ELEMENTS = {
  0:'fire',1:'earth',2:'air',3:'water',4:'fire',5:'earth',
  6:'air',7:'water',8:'fire',9:'earth',10:'air',11:'water'
};
const SIGN_QUALITIES = {
  0:'movable',1:'fixed',2:'dual',3:'movable',4:'fixed',5:'dual',
  6:'movable',7:'fixed',8:'dual',9:'movable',10:'fixed',11:'dual'
};
const SIGN_GENDERS = {
  0:'male',1:'female',2:'male',3:'female',4:'male',5:'female',
  6:'male',7:'female',8:'male',9:'female',10:'male',11:'female'
};

// Exaltation (sign index, exact degree of deep exaltation)
const EXALTATION = {Sun:[0,10],Moon:[1,3],Mars:[9,28],Mercury:[5,15],
                   Jupiter:[3,5],Venus:[11,27],Saturn:[6,20],Rahu:[1,20],Ketu:[7,20]};
const DEBILITATION = {Sun:6,Moon:7,Mars:3,Mercury:11,Jupiter:9,Venus:5,
                      Saturn:0,Rahu:7,Ketu:1};
const OWN_SIGNS = {Sun:[4],Moon:[3],Mars:[0,7],Mercury:[2,5],
                   Jupiter:[8,11],Venus:[1,6],Saturn:[9,10],Rahu:[],Ketu:[]};
const MOOLATRIKONA = {Sun:4,Moon:1,Mars:0,Mercury:2,Jupiter:8,Venus:6,Saturn:10};

// Natural friendship table per BPHS Ch.3
const NAT_FRIENDS = {
  Sun:['Moon','Mars','Jupiter'],Moon:['Sun','Mercury'],
  Mars:['Sun','Moon','Jupiter'],Mercury:['Sun','Venus'],
  Jupiter:['Sun','Moon','Mars'],Venus:['Mercury','Saturn'],Saturn:['Mercury','Venus']
};
const NAT_ENEMIES = {
  Sun:['Venus','Saturn'],Moon:['Rahu','Ketu'],Mars:['Mercury'],
  Mercury:['Moon'],Jupiter:['Mercury','Venus'],Venus:['Sun','Moon'],
  Saturn:['Sun','Moon','Mars']
};
const NAT_NEUTRAL = {
  Sun:['Mercury'],Moon:['Mars','Jupiter','Venus','Saturn'],
  Mars:['Venus','Saturn'],Mercury:['Mars','Jupiter','Saturn'],
  Jupiter:['Saturn'],Venus:['Jupiter','Mars'],Saturn:['Jupiter']
};

// Benefic/Malefic classification
const NAT_BENEFICS = ['Jupiter','Venus','Moon']; // Mercury when alone
const NAT_MALEFICS = ['Saturn','Mars','Sun','Rahu','Ketu'];

// Kendras, Trikonas, Dusthanas, Upachayas
const KENDRAS   = [1,4,7,10];
const TRIKONAS  = [1,5,9];
const DUSTHANAS = [6,8,12];
const UPACHAYAS = [3,6,10,11];

// Nakshatra lords (Vimshottari) — 27 nakshatras
const NAK_LORDS = [
  'Ketu','Venus','Sun','Moon','Mars','Rahu','Jupiter','Saturn','Mercury', // 1-9
  'Ketu','Venus','Sun','Moon','Mars','Rahu','Jupiter','Saturn','Mercury', // 10-18
  'Ketu','Venus','Sun','Moon','Mars','Rahu','Jupiter','Saturn','Mercury'  // 19-27
];
const NAK_NAMES = [
  'Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra','Punarvasu',
  'Pushya','Ashlesha','Magha','Purva Phalguni','Uttara Phalguni','Hasta',
  'Chitra','Swati','Vishakha','Anuradha','Jyeshtha','Moola','Purva Ashadha',
  'Uttara Ashadha','Shravana','Dhanishtha','Shatabhisha','Purva Bhadrapada',
  'Uttara Bhadrapada','Revati'
];

// Dasha years
const DASHA_YEARS = {Ketu:7,Venus:20,Sun:6,Moon:10,Mars:7,Rahu:18,Jupiter:16,Saturn:19,Mercury:17};
const DASHA_SEQ   = ['Ketu','Venus','Sun','Moon','Mars','Rahu','Jupiter','Saturn','Mercury'];

// Yoga Karaka per lagna — BPHS Ch.34
const YOGA_KARAKA = {
  0:null,        // Aries
  1:'Saturn',    // Taurus — Saturn rules 9th+10th
  2:null,        // Gemini
  3:'Mars',      // Cancer — Mars rules 5th+10th
  4:null,        // Leo
  5:null,        // Virgo
  6:'Saturn',    // Libra — Saturn rules 4th+5th
  7:null,        // Scorpio
  8:null,        // Sagittarius
  9:'Venus',     // Capricorn — Venus rules 5th+10th
  10:'Venus',    // Aquarius — Venus rules 4th+9th
  11:null        // Pisces
};

// ═══════════════════════════════════════════════════════════════
// SECTION 2 — HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function sign(s)   { return ((s % 12) + 12) % 12; }
function house(h)  { return ((h - 1 + 12) % 12) + 1; }

function getPlanetStrength(planet, signIdx) {
  if (EXALTATION[planet] && EXALTATION[planet][0] === signIdx) return 'EXALTED';
  if ((OWN_SIGNS[planet]||[]).includes(signIdx)) return 'OWN';
  if (MOOLATRIKONA[planet] === signIdx) return 'MOOLATRIKONA';
  if (DEBILITATION[planet] === signIdx) return 'DEBILITATED';
  return 'NEUTRAL';
}

function isStrong(planet, signIdx) {
  const s = getPlanetStrength(planet, signIdx);
  return s === 'EXALTED' || s === 'OWN' || s === 'MOOLATRIKONA';
}
function isWeak(planet, signIdx) {
  return getPlanetStrength(planet, signIdx) === 'DEBILITATED';
}

function isBenefic(planet) { return NAT_BENEFICS.includes(planet); }
function isMalefic(planet) { return NAT_MALEFICS.includes(planet); }

function planetsInHouse(h, chart) {
  return Object.entries(chart.planets)
    .filter(([,d]) => d.house === h).map(([p]) => p);
}

function lordOf(h, chart) {
  return chart.houseLords ? chart.houseLords[h] : getHouseLord(chart.lagna, h);
}

function getHouseLord(lagna, h) {
  const signOfHouse = (lagna + h - 1) % 12;
  const lords = {0:'Mars',1:'Venus',2:'Mercury',3:'Moon',4:'Sun',5:'Mercury',
                 6:'Venus',7:'Mars',8:'Jupiter',9:'Saturn',10:'Saturn',11:'Jupiter'};
  return lords[signOfHouse];
}

function houseOf(planet, chart) {
  return chart.planets[planet] ? chart.planets[planet].house : null;
}

function signOf(planet, chart) {
  return chart.planets[planet] ? chart.planets[planet].sign : null;
}

// Special planetary aspects per BPHS Ch.26
function getAspectedHouses(planet, fromHouse) {
  const base = [house(fromHouse + 6)]; // 7th aspect — all planets
  if (planet === 'Mars')    return [...base, house(fromHouse+3), house(fromHouse+7)];
  if (planet === 'Jupiter') return [...base, house(fromHouse+4), house(fromHouse+8)];
  if (planet === 'Saturn')  return [...base, house(fromHouse+2), house(fromHouse+9)];
  if (planet === 'Rahu' || planet === 'Ketu') return [...base, house(fromHouse+4), house(fromHouse+8)];
  return base;
}

function planetAspectsHouse(planet, chart, targetHouse) {
  const pHouse = houseOf(planet, chart);
  if (!pHouse) return false;
  return getAspectedHouses(planet, pHouse).includes(targetHouse);
}

function anyBeneficAspectsHouse(h, chart) {
  return ['Jupiter','Venus','Moon'].some(p => planetAspectsHouse(p, chart, h));
}

function anyMaleficAspectsHouse(h, chart) {
  return ['Saturn','Mars','Sun','Rahu','Ketu'].some(p => planetAspectsHouse(p, chart, h));
}

function areConjunct(p1, p2, chart) {
  return chart.planets[p1] && chart.planets[p2] &&
         chart.planets[p1].house === chart.planets[p2].house;
}

function parivartana(h1, h2, chart) {
  // Check if lords of h1 and h2 are in each other's houses
  const l1 = lordOf(h1, chart);
  const l2 = lordOf(h2, chart);
  return houseOf(l1, chart) === h2 && houseOf(l2, chart) === h1;
}

function isInDusthana(planet, chart) {
  return DUSTHANAS.includes(houseOf(planet, chart));
}

function isInKendra(planet, chart) {
  return KENDRAS.includes(houseOf(planet, chart));
}

function isInTrikona(planet, chart) {
  return TRIKONAS.includes(houseOf(planet, chart));
}

function nakOf(moonLon) {
  return Math.floor((moonLon % 360) / (360/27));
}

function getNavamshaSign(planetLon) {
  const totalNava = Math.floor((planetLon % 360) / (360/108));
  return totalNava % 12;
}

// ═══════════════════════════════════════════════════════════════
// SECTION 3 — MAIN ENGINE
// ═══════════════════════════════════════════════════════════════

class VedicRulesEngine {

  constructor(chart) {
    this.chart = chart;
    this.c = chart; // shorthand
  }

  evaluate() {
    return {
      ascendant:      this.evaluateAscendant(),
      personality:    this.evaluatePersonality(),
      marriage:       this.evaluateMarriage(),
      siblings:       this.evaluateSiblings(),
      father:         this.evaluateFather(),
      mother:         this.evaluateMother(),
      children:       this.evaluateChildren(),
      career:         this.evaluateCareer(),
      wealth:         this.evaluateWealth(),
      health:         this.evaluateHealth(),
      education:      this.evaluateEducation(),
      foreignTravel:  this.evaluateForeignTravel(),
      spirituality:   this.evaluateSpirituality(),
      longevity:      this.evaluateLongevity(),
      property:       this.evaluateProperty(),
      litigation:     this.evaluateLitigation(),
      enemies:        this.evaluateEnemies(),
      yogas:          this.evaluateYogas(),
      dashaResults:   this.evaluateDashaResults(),
      mentalNature:   this.evaluateMentalNature(),
      communication:  this.evaluateCommunication(),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // ASCENDANT & LAGNA LORD — BPHS Ch.7
  // ─────────────────────────────────────────────────────────────
  evaluateAscendant() {
    const { c } = this;
    const f = [];
    const lagnaSign = c.lagna;
    const lagnaLord = lordOf(1, c);
    const lagnaLordData = c.planets[lagnaLord];

    // BPHS Ch.7: Physical appearance and nature per lagna
    const lagnaDescriptions = {
      0: 'Strong physique, active, impulsive, natural leader, fiery temperament, ambitious',
      1: 'Sturdy, patient, artistic, loves luxury and beauty, stubborn, reliable',
      2: 'Intelligent, communicative, versatile, curious, dual nature, quick mind',
      3: 'Sensitive, nurturing, intuitive, home-loving, emotional, psychic tendencies',
      4: 'Dignified, authoritative, generous, proud, leadership qualities, sunny disposition',
      5: 'Analytical, methodical, practical, health-conscious, detail-oriented, perfectionist',
      6: 'Balanced, diplomatic, charming, partnership-oriented, justice-seeking, aesthetic',
      7: 'Intense, secretive, transformative, passionate, strong willpower, research-minded',
      8: 'Philosophical, optimistic, adventurous, freedom-loving, blunt, spiritual inclination',
      9: 'Disciplined, ambitious, patient, practical, status-conscious, conservative',
      10: 'Humanitarian, independent, intellectual, unconventional, progressive, friendly',
      11: 'Spiritual, empathetic, imaginative, sensitive, fluid identity, compassionate'
    };

    f.push({ rule:'A1', source:'BPHS Ch.7', verdict:`${SIGNS[lagnaSign]} rising: ${lagnaDescriptions[lagnaSign]}` });

    // Lagna lord position
    if (lagnaLordData) {
      const h = lagnaLordData.house;
      const str = getPlanetStrength(lagnaLord, lagnaLordData.sign);
      const lagnaLordInHouseVerdicts = {
        1:'Self-reliant, independent, strong constitution, native thrives through own effort',
        2:'Wealth accumulation focus, family-oriented, good speech and eating habits',
        3:'Courageous, adventurous, strong siblings, good for writing/travel/communication',
        4:'Happy domestic life, educated, property, good relationship with mother',
        5:'Intelligent, creative, good children, strong intuition, authoritative',
        6:'Hardworking service orientation, health needs attention, good at defeating enemies',
        7:'Marriage-focused life, strong partnerships, business acumen',
        8:'Research-oriented, interest in occult, longevity concern, chronic health possible',
        9:'Highly fortunate, righteous, father is important figure, spiritual inclination',
        10:'Career-driven, public recognition, authority figure, very ambitious',
        11:'Wealthy, many friends and connections, multiple income sources',
        12:'Spiritually inclined, expenditure-heavy, foreign connection, isolated at times'
      };
      f.push({ rule:'A2', source:'BPHS Ch.7 v.15', verdict:`Lagna lord ${lagnaLord} in ${h}th: ${lagnaLordInHouseVerdicts[h]}` });

      if (str === 'EXALTED') f.push({ rule:'A3a', source:'BPHS Ch.7 v.20', verdict:`Lagna lord exalted → outstanding life force, strong health, exceptional willpower` });
      if (str === 'DEBILITATED') f.push({ rule:'A3b', source:'BPHS Ch.7 v.21', verdict:`Lagna lord debilitated → weak constitution, self-doubt, life requires more effort` });
      if (isInDusthana(lagnaLord, c)) f.push({ rule:'A3c', source:'BPHS Ch.7 v.22', verdict:`Lagna lord in dusthana → health and self-confidence affected, obstacles to personal growth` });
    }

    // Malefics in lagna
    const maleficsInLagna = planetsInHouse(1, c).filter(p => isMalefic(p));
    if (maleficsInLagna.length > 0) {
      f.push({ rule:'A4', source:'BPHS Ch.7 v.25', verdict:`Malefic(s) ${maleficsInLagna.join('+')} in lagna → health vulnerabilities, aggressive or tense personality` });
    }

    // Jupiter in lagna
    if (planetsInHouse(1, c).includes('Jupiter')) {
      f.push({ rule:'A5', source:'BPHS Ch.7 v.30', verdict:'Jupiter in lagna → blessed physique, wisdom, generous nature, natural teacher, protected from major illness' });
    }

    return { verdicts: f.map(x => x.verdict), rules: f };
  }

  // ─────────────────────────────────────────────────────────────
  // MENTAL NATURE — Moon, Mercury, 5th house
  // BPHS Ch.9, Saravali Ch.18
  // ─────────────────────────────────────────────────────────────
  evaluateMentalNature() {
    const { c } = this;
    const f = [];
    const moon = c.planets['Moon'];
    const mercury = c.planets['Mercury'];
    const moonNak = nakOf(moon.longitude || (moon.sign * 30 + 15));
    const moonNakName = NAK_NAMES[moonNak] || 'Unknown';
    const moonStr = getPlanetStrength('Moon', moon.sign);

    // Moon sign nature — BPHS Ch.9
    const moonSignNature = {
      0:'Restless, impulsive mind, quick to anger but quick to forgive',
      1:'Calm, sensual, stubborn mind, loves beauty and comfort, excellent memory',
      2:'Dual, curious, quick-thinking, easily distracted, analytical',
      3:'Sensitive, deeply emotional, strong intuition, mood-dependent',
      4:'Proud, fixed opinions, generous mind, sunny but stubborn',
      5:'Analytical, critical, worrying tendency, excellent memory, detail-focused',
      6:'Balanced, diplomatic, indecisive at times, seeks harmony',
      7:'Intense, probing, secretive, jealous tendency, powerful emotions',
      8:'Philosophical, optimistic, restless, freedom-loving mind',
      9:'Practical, serious, disciplined, slow to trust but deeply loyal',
      10:'Intellectual, detached, humanitarian, original thinker',
      11:'Dreamy, spiritual, empathetic, boundary issues, imaginative'
    };
    f.push({ rule:'MN1', source:'BPHS Ch.9 v.3', verdict:`Moon in ${SIGNS[moon.sign]}: ${moonSignNature[moon.sign]}` });

    // Moon strength
    if (moonStr === 'EXALTED') f.push({ rule:'MN2a', source:'BPHS Ch.9 v.5', verdict:'Moon exalted (Taurus) → emotionally stable, nurturing, wealthy, strong mind, loved by all' });
    if (moonStr === 'DEBILITATED') f.push({ rule:'MN2b', source:'BPHS Ch.9 v.6', verdict:'Moon debilitated (Scorpio) → emotional turbulence, anxiety, troubled mind, difficult relationship with mother' });

    // Moon nakshatra — BPHS Ch.67 (Nakshatra results)
    const moonNakVerdicts = {
      0:'Ashwini Moon: Quick mind, healing ability, loves speed and action, horse-like energy',
      1:'Bharani Moon: Creative, sensual, carries heavy burdens, Yama energy, determined',
      2:'Krittika Moon: Sharp mind, critical, fire energy, leadership, can cut through illusion',
      3:'Rohini Moon: Beautiful, artistic, materialistic, magnetic, lucky in wealth',
      4:'Mrigashira Moon: Curious, searching mind, sensitive, loves research and seeking',
      5:'Ardra Moon: Intense, stormy emotions, Rudra energy, transformative experiences',
      6:'Punarvasu Moon: Optimistic, forgiving, returns again and again, Jupiter-blessed',
      7:'Pushya Moon: Nurturing, protective, most auspicious nakshatra for mind',
      8:'Ashlesha Moon: Serpent energy, psychic, secretive, karmic past, intense emotions',
      9:'Magha Moon: Royal nature, ancestor-connected, proud, leadership, past life karma strong',
      10:'Purva Phalguni Moon: Pleasure-seeking, creative, romantic, generous',
      11:'Uttara Phalguni Moon: Charitable, helpful, sunlike nature, practical beneficence',
      12:'Hasta Moon: Skilled with hands, clever, crafty, healing hands',
      13:'Chitra Moon: Artistic, designer energy, perfectionist, love of beauty and craft',
      14:'Swati Moon: Independent, wind-like, adaptable, business acumen',
      15:'Vishakha Moon: Goal-oriented, two-faced possibility, Jupiter+Indra energy, determined',
      16:'Anuradha Moon: Devoted, loyal, Saturn-Mars combo, deep friendship capacity',
      17:'Jyeshtha Moon: Elder sibling energy, protective, powerful but may face jealousy',
      18:'Moola Moon: Root energy, investigates foundations, Ketu+Nirriti, transformative destruction',
      19:'Purva Ashadha Moon: Invincible feeling, water energy, purifying nature',
      20:'Uttara Ashadha Moon: Universal victory, Vishvadevas, Sun energy, leadership',
      21:'Shravana Moon: Listening mind, learning, Vishnu energy, connected to sacred knowledge',
      22:'Dhanishtha Moon: Wealthy, musical, Mars+Vasus energy, entrepreneurial',
      23:'Shatabhisha Moon: Healer, 100 physicians, Rahu energy, independent, secretive',
      24:'Purva Bhadrapada Moon: Two-faced, Jupiter+Aja Ekapada, mystical, intense karma',
      25:'Uttara Bhadrapada Moon: Wise elder, serpent of depths, spiritual, Saturn+Ahir Budhnya',
      26:'Revati Moon: Nurturing traveler, final journey, Mercury+Pushan, spiritual completion'
    };
    f.push({ rule:'MN3', source:'BPHS Ch.67', verdict: moonNakVerdicts[moonNak] || `${moonNakName} Moon` });

    // Saturn afflicting Moon — depression indicator
    if (areConjunct('Saturn','Moon',c) || planetAspectsHouse('Saturn',c,moon.house)) {
      f.push({ rule:'MN4', source:'BPHS Ch.9 v.20', verdict:'Saturn influences Moon → tendency toward depression, melancholy, serious/heavy mind, pessimistic periods' });
    }

    // Mercury condition for intellect
    const mercStr = getPlanetStrength('Mercury', mercury.sign);
    if (mercStr === 'EXALTED' || mercStr === 'OWN') {
      f.push({ rule:'MN5a', source:'BPHS Ch.9 v.25', verdict:'Mercury strong → razor sharp intellect, excellent communication, mathematical/analytical ability' });
    }
    if (areConjunct('Mercury','Jupiter',c)) {
      f.push({ rule:'MN5b', source:'BPHS Ch.9', verdict:'Mercury-Jupiter conjunction → Budha-Aditya type wisdom, learned, philosophical mind, teaching ability' });
    }

    // Rahu affecting Moon
    if (areConjunct('Rahu','Moon',c)) {
      f.push({ rule:'MN6', source:'BPHS Ch.9 v.30', verdict:'Rahu conjunct Moon → unconventional thinking, obsessive tendencies, psychic sensitivity, breaks from tradition' });
    }

    return { verdicts: f.map(x => x.verdict), rules: f };
  }

  // ─────────────────────────────────────────────────────────────
  // PERSONALITY — Sun, Lagna, Atmakaraka
  // ─────────────────────────────────────────────────────────────
  evaluatePersonality() {
    const { c } = this;
    const f = [];
    const sun = c.planets['Sun'];
    const sunStr = getPlanetStrength('Sun', sun.sign);

    // Sun sign personality — BPHS Ch.3
    const sunSignPersonality = {
      0:'Leadership, courage, short temper, honesty, pioneering spirit',
      1:'Patient, stubborn, loyal, sensual, love of beauty and comfort',
      2:'Witty, dual-natured, communicative, intellectual, adaptable',
      3:'Nurturing, intuitive, home-loving, emotionally sensitive',
      4:'Authoritative, generous, proud, dramatic, natural ruler',
      5:'Analytical, critical, service-oriented, health-focused, practical',
      6:'Diplomatic, charming, justice-seeking, partnership-loving',
      7:'Intense, secretive, investigative, passionate, transformative',
      8:'Philosophical, adventurous, blunt, freedom-loving, optimistic',
      9:'Ambitious, disciplined, patient, conservative, status-conscious',
      10:'Independent, humanitarian, intellectual, progressive, detached',
      11:'Empathetic, spiritual, dreamy, compassionate, boundary-fluid'
    };
    f.push({ rule:'P1', source:'BPHS Ch.3', verdict:`Sun in ${SIGNS[sun.sign]}: ${sunSignPersonality[sun.sign]}` });

    if (sunStr === 'EXALTED') f.push({ rule:'P2a', source:'BPHS Ch.3 v.5', verdict:'Sun exalted (Aries) → powerful ego, natural authority, government connections, excellent leadership' });
    if (sunStr === 'DEBILITATED') f.push({ rule:'P2b', source:'BPHS Ch.3 v.6', verdict:'Sun debilitated (Libra) → weak self-confidence, father issues, needs external validation, career struggles' });

    // Atmakaraka — Jaimini system (planet with highest degree)
    if (c.atmakaraka) {
      const akVerdicts = {
        Sun:'Soul lesson: ego transcendence, father relationship, authority',
        Moon:'Soul lesson: emotional mastery, attachment to comfort and security',
        Mars:'Soul lesson: channeling aggression, courage, action vs impulsiveness',
        Mercury:'Soul lesson: communication, intellect, avoiding deception',
        Jupiter:'Soul lesson: wisdom, dharma, avoiding overconfidence',
        Venus:'Soul lesson: relationships, desires, beauty, avoiding overindulgence',
        Saturn:'Soul lesson: discipline, karma, service, accepting limitations',
        Rahu:'Soul lesson: karmic unfulfilled desires from past life',
        Ketu:'Soul lesson: renunciation, moksha, past life completion'
      };
      f.push({ rule:'P3', source:'Jaimini Sutram Ch.1', verdict:`Atmakaraka is ${c.atmakaraka}: ${akVerdicts[c.atmakaraka] || 'Core soul purpose'}` });
    }

    return { verdicts: f.map(x => x.verdict), rules: f };
  }

  // ─────────────────────────────────────────────────────────────
  // MARRIAGE — COMPLETE EDITION
  // Sources: BPHS Ch.18,81, Phaladeepika Ch.12, Saravali Ch.28,
  //          Brihat Jataka Ch.9, Jaimini (Upapada, Darakaraka),
  //          Uttara Kalamrita
  // ─────────────────────────────────────────────────────────────
  evaluateMarriage() {
    const { c } = this;
    const f = [];
    let strength = 0;
    let type = null;      // love/arranged/inter-caste/foreign/denied/multiple
    let timing = null;    // estimated age range
    let spouseDesc = [];
    let confidence = 'MEDIUM';

    const h7 = planetsInHouse(7, c);
    const l7 = lordOf(7, c);
    const l7d = c.planets[l7];
    const venus = c.planets['Venus'];
    const jupiter = c.planets['Jupiter']; // male chart karaka
    const mars = c.planets['Mars'];       // female chart karaka
    const karaka = c.gender === 'F' ? mars : jupiter;
    const l2 = lordOf(2, c);
    const l5 = lordOf(5, c);
    const l11 = lordOf(11, c);

    // ── 7TH HOUSE OCCUPANTS ──────────────────────────────────────────

    if (h7.includes('Sun')) {
      strength -= 1;
      spouseDesc.push('proud, authoritative, government/medical profession');
      f.push({rule:'M-SUN7', source:'BPHS Ch.18 v.10, Saravali Ch.28 v.6',
        verdict:'Sun in 7th → spouse is proud, may be in government/medical field; ego conflicts in marriage; power struggles'});
    }
    if (h7.includes('Moon')) {
      spouseDesc.push('attractive, emotional, possibly changeable');
      const moonStr = getPlanetStrength('Moon', c.planets['Moon'].sign);
      if (moonStr === 'EXALTED') { strength += 2; f.push({rule:'M-MOONx7', source:'BPHS Ch.18 v.14', verdict:'Moon exalted in 7th → exceptionally beautiful/handsome spouse, very happy marriage, emotional fulfilment'}); }
      else if (moonStr === 'DEBILITATED') { strength -= 1; f.push({rule:'M-MOONd7', source:'BPHS Ch.18 v.14', verdict:'Moon debilitated in 7th → spouse is emotionally unstable; marriage goes through turbulent phases'}); }
      else f.push({rule:'M-MOON7', source:'BPHS Ch.18 v.13', verdict:'Moon in 7th → attractive, emotional spouse; strong emotional bond; marriage has highs and lows based on moods'});
    }
    if (h7.includes('Mars')) {
      strength -= 2;
      f.push({rule:'M-MARS7', source:'BPHS Ch.81 v.1', verdict:'Mars in 7th → Mangal Dosha: conflict, separation risk, or spouse faces health issues; must match with Mangalik'});
      // Cancellation rules — BPHS Ch.81 v.5-15
      if (planetAspectsHouse('Jupiter', c, 7)) { strength += 1; f.push({rule:'M-MARS7-C1', source:'BPHS Ch.81 v.8', verdict:'Jupiter aspects 7th → Mangal Dosha cancelled/reduced'}); }
      if (c.lagna === 0 || c.lagna === 7) f.push({rule:'M-MARS7-C2', source:'BPHS Ch.81 v.10', verdict:'Aries/Scorpio lagna → Mars in 7th is own sign, Dosha cancelled'}); 
      if (c.lagna === 3 || c.lagna === 8) f.push({rule:'M-MARS7-C3', source:'BPHS Ch.81 v.11', verdict:'Cancer/Sagittarius lagna → Mars in 7th loses Dosha strength due to Jupiter connection'});
    }
    if (h7.includes('Mercury')) {
      spouseDesc.push('intelligent, communicative, youthful-looking');
      f.push({rule:'M-MERC7', source:'Saravali Ch.28 v.14', verdict:'Mercury in 7th → spouse is intelligent, witty, business-minded; marriage involves intellectual partnership; spouse may be younger-looking'});
      strength += 1;
    }
    if (h7.includes('Jupiter')) {
      strength += 3;
      spouseDesc.push('educated, wise, spiritual, generous');
      f.push({rule:'M-JUP7', source:'BPHS Ch.18 v.15', verdict:'Jupiter in 7th → excellent marriage; wise, educated, generous spouse; marriage is a source of great blessing'});
      confidence = 'HIGH';
    }
    if (h7.includes('Venus')) {
      strength += 2;
      spouseDesc.push('beautiful, artistic, charming, sensual');
      f.push({rule:'M-VEN7', source:'Phaladeepika Ch.12 v.8', verdict:'Venus in 7th → very attractive spouse; highly passionate marriage; luxurious domestic life; spouse in arts/beauty industry'});
    }
    if (h7.includes('Saturn')) {
      strength -= 2;
      timing = timing ? Math.max(timing, 30) : 30;
      spouseDesc.push('older, serious, disciplined, may be career-focused');
      f.push({rule:'M-SAT7', source:'BPHS Ch.18 v.12', verdict:'Saturn in 7th → delayed marriage (after 28-30), spouse is older or serious; cold/practical marriage; karmic relationship'});
      confidence = 'HIGH';
    }
    if (h7.includes('Rahu')) {
      spouseDesc.push('from different background, culture, or foreign');
      type = type || 'inter-caste/foreign';
      f.push({rule:'M-RAHU7', source:'Saravali Ch.28 v.20', verdict:'Rahu in 7th → inter-caste, inter-religion, or foreign spouse; unconventional marriage; spouse may have unusual traits'});
    }
    if (h7.includes('Ketu')) {
      f.push({rule:'M-KETU7', source:'BPHS Ch.18 v.35', verdict:'Ketu in 7th → spiritual or karmic marriage; spouse may be introverted or spiritual; past-life connection with spouse; possible separation'});
      strength -= 1;
    }

    // ── 7TH LORD POSITION ────────────────────────────────────────────
    if (l7d) {
      const l7str = getPlanetStrength(l7, l7d.sign);
      if (l7str === 'EXALTED') { strength += 3; confidence = 'HIGH'; spouseDesc.push('accomplished, high-status'); f.push({rule:'M-L7EX', source:'BPHS Ch.18 v.1', verdict:'7th lord exalted → excellent marriage; spouse is distinguished, capable, high-status'}); }
      if (l7str === 'OWN')     { strength += 2; f.push({rule:'M-L7OWN', source:'BPHS Ch.18 v.2', verdict:'7th lord in own sign → stable, reliable spouse; marriage is strong and enduring'}); }
      if (l7str === 'DEBILITATED') { strength -= 3; confidence = 'HIGH'; f.push({rule:'M-L7DEB', source:'BPHS Ch.18 v.3', verdict:'7th lord debilitated → troubled marriage; spouse has weaknesses; marriage requires serious work'}); }

      const l7houseVerdicts = {
        1:'7th lord in 1st → strong desire for partnership; identity tied to spouse; self as spouse (may marry someone very similar)',
        2:'7th lord in 2nd → spouse adds to family wealth; family arranges marriage; spouse is wealthy',
        3:'7th lord in 3rd → spouse is communicative, sibling-like bond; may meet through travel/media',
        4:'7th lord in 4th → spouse becomes close family; domestic happiness; marriage brings property',
        5:'7th lord in 5th → love marriage; romance leads to marriage; spouse is creative or younger',
        6:'7th lord in 6th → disputes with spouse; possible separation; spouse may have health issues',
        7:'7th lord in own house (7th) → strong marriage indication; completely focused on partnership',
        8:'7th lord in 8th → obstacles in marriage; spouse has secrets; chronic health issues for spouse',
        9:'7th lord in 9th → very fortunate marriage; spouse is righteous, may be from different religion/culture',
        10:'7th lord in 10th → spouse is career-oriented or helps career; meet spouse through work',
        11:'7th lord in 11th → gains through marriage; spouse is wealthy; marriage brings social elevation',
        12:'7th lord in 12th → foreign spouse possible; marriage involves sacrifice; spiritual bond'
      };
      f.push({rule:'M-L7H', source:'BPHS Ch.18 v.20-45', verdict: l7houseVerdicts[l7d.house]});

      // 7th lord in dusthana
      if ([6,8,12].includes(l7d.house)) { strength -= 2; f.push({rule:'M-L7DUST', source:'BPHS Ch.18 v.5', verdict:`7th lord in ${l7d.house}th (dusthana) → obstacles, delays, or discord in marriage`}); }

      // 7th lord in kendra/trikona
      if (KENDRAS.includes(l7d.house)) { strength += 1; f.push({rule:'M-L7K', source:'BPHS Ch.18 v.8', verdict:'7th lord in kendra → marriage is central to life; strong partnership'}); }
      if ([5,9].includes(l7d.house))   { strength += 1; type = type || 'love'; f.push({rule:'M-L7T', source:'BPHS Ch.18 v.9', verdict:'7th lord in trikona → dharmic, blessed marriage; possible love angle'}); }
    }

    // ── VENUS CONDITION ───────────────────────────────────────────────
    if (venus) {
      const venStr = getPlanetStrength('Venus', venus.sign);
      if (venStr === 'EXALTED') { strength += 2; f.push({rule:'M-VENEX', source:'Phaladeepika Ch.7 v.5', verdict:'Venus exalted (Pisces) → greatest blessing for marriage; extraordinarily happy marital life; beautiful spouse'}); }
      if (venStr === 'DEBILITATED') { strength -= 2; f.push({rule:'M-VENDB', source:'Phaladeepika Ch.7 v.6', verdict:'Venus debilitated (Virgo) → dissatisfaction in married life; romantic disappointments; love unfulfilled'}); }
      if (venStr === 'OWN') { strength += 1; f.push({rule:'M-VENOWN', source:'Phaladeepika Ch.7 v.4', verdict:'Venus in own sign → comfortable, pleasurable married life; charming spouse'}); }

      // Venus house position for marriage quality
      const venHouseVerdicts = {
        1:'Venus in 1st → charming personality attracts partners; early marriage possible; love of beauty',
        2:'Venus in 2nd → marriage brings wealth; spouse is wealthy; love of food and luxury',
        3:'Venus in 3rd → meets spouse through communication or siblings; artistic inclination',
        4:'Venus in 4th → happy home life; domestic bliss; spouse is homely and caring',
        5:'Venus in 5th → love affairs; romance is lifelong; creative, artistic spouse',
        6:'Venus in 6th → service-based relationship; health issues for spouse; love through work',
        7:'Venus in 7th → most blessed for marriage; beautiful, artistic spouse',
        8:'Venus in 8th → intense, transformative relationships; secret romance; spouse has hidden depth',
        9:'Venus in 9th → marries someone from different culture/religion; dharmic love; foreign spouse',
        10:'Venus in 10th → career in arts or beauty; meets spouse through career; work-life imbalance',
        11:'Venus in 11th → gains through spouse; wealthy spouse; social marriage',
        12:'Venus in 12th → hidden romance; foreign/spiritual spouse; love involves sacrifice'
      };
      f.push({rule:'M-VENH', source:'Phaladeepika Ch.12', verdict: venHouseVerdicts[venus.house]});

      // Saturn aspects Venus
      if (planetAspectsHouse('Saturn', c, venus.house)) {
        strength -= 2; timing = timing ? Math.max(timing, 29) : 29;
        f.push({rule:'M-SATVEN', source:'BPHS Ch.18 v.30', verdict:'Saturn aspects Venus → delayed marriage; practical/serious approach to love; possible unrequited love early in life'});
      }
      // Jupiter aspects Venus
      if (planetAspectsHouse('Jupiter', c, venus.house)) {
        strength += 1;
        f.push({rule:'M-JUPVEN', source:'BPHS Ch.18 v.32', verdict:'Jupiter aspects Venus → dharmic, blessed love life; spouse is educated and noble'});
      }
      // Rahu conjunct Venus
      if (areConjunct('Rahu','Venus',c)) {
        f.push({rule:'M-RAHUVEN', source:'Saravali Ch.28', verdict:'Rahu conjunct Venus → unconventional love life; obsessive attraction; foreign or cross-cultural relationship; unconventional beauty standards'});
      }
    }

    // ── LOVE MARRIAGE INDICATORS ──────────────────────────────────────
    // BPHS + Phaladeepika love marriage rules
    if (c.planets[l5] && c.planets[l5].house === 7) { type = 'love'; f.push({rule:'M-LM1', source:'BPHS Ch.18 v.20', verdict:'5th lord in 7th → love marriage; romance clearly leads to marriage'}); }
    if (l7d && l7d.house === 5) { type = 'love'; f.push({rule:'M-LM2', source:'BPHS Ch.18 v.21', verdict:'7th lord in 5th → love marriage strongly indicated; heart and partnership linked'}); }
    if (areConjunct('Venus','Mars',c)) { type = type || 'love'; f.push({rule:'M-LM3', source:'Phaladeepika Ch.12 v.22', verdict:'Venus-Mars conjunction → passionate, romantic nature; love affair that becomes marriage'}); }
    if (parivartana(5, 7, c)) { type = 'love'; confidence = 'HIGH'; f.push({rule:'M-LM4', source:'BPHS Ch.37', verdict:'5th-7th lord Parivartana → powerful love marriage yoga; love story that defines the life'}); }
    if (c.planets['Moon'] && areConjunct('Moon','Venus',c)) f.push({rule:'M-LM5', source:'Phaladeepika', verdict:'Moon-Venus conjunction → romantic, emotional love nature; sensitive to partner; love is everything'});

    // ── ARRANGED MARRIAGE INDICATORS ─────────────────────────────────
    if (c.planets[l2] && c.planets[l2].house === 7) { type = type || 'arranged'; f.push({rule:'M-AM1', source:'BPHS Ch.18 v.25', verdict:'2nd lord in 7th → family-arranged marriage; spouse integrates into family'}); }
    if (l7d && l7d.house === 2) { type = type || 'arranged'; f.push({rule:'M-AM2', source:'BPHS Ch.18 v.26', verdict:'7th lord in 2nd → family tradition in marriage; spouse connected to family wealth'}); }

    // ── MULTIPLE MARRIAGE ─────────────────────────────────────────────
    const maleficsIn7 = h7.filter(p => isMalefic(p));
    if (maleficsIn7.length >= 2 && !anyBeneficAspectsHouse(7, c)) {
      type = type || 'multiple';
      f.push({rule:'M-MULT1', source:'BPHS Ch.18 v.35', verdict:`Multiple malefics (${maleficsIn7.join('+')}) in 7th without benefic protection → multiple marriages or long separations`});
      confidence = 'HIGH';
    }
    // 7th lord in dual sign (Gemini, Virgo, Sagittarius, Pisces)
    if (l7d && [2,5,8,11].includes(l7d.sign)) {
      f.push({rule:'M-MULT2', source:'Saravali Ch.28', verdict:'7th lord in dual sign → possibility of more than one significant relationship or second marriage'});
    }

    // ── DENIAL OR VERY LATE MARRIAGE ─────────────────────────────────
    const saturn = c.planets['Saturn'];
    const allMaleficsAspect7 = ['Saturn','Mars'].every(p => planetAspectsHouse(p, c, 7));
    if (allMaleficsAspect7 && !anyBeneficAspectsHouse(7,c)) {
      type = type || 'very delayed';
      f.push({rule:'M-DENY1', source:'BPHS Ch.18 v.40', verdict:'Saturn and Mars both aspect 7th with no benefic protection → severe delay in marriage or near-denial; after 35 if at all'});
      confidence = 'HIGH';
    }

    // ── NAVAMSHA CONFIRMATION ──────────────────────────────────────────
    if (c.navamsha && c.navamsha.planets) {
      const navL7 = l7;
      const navD = c.navamsha.planets[navL7];
      if (navD) {
        const navStr = getPlanetStrength(navL7, navD.sign);
        if (navStr === 'EXALTED' || navStr === 'OWN') {
          strength += 2; confidence = 'HIGH';
          f.push({rule:'M-NAV1', source:'Uttara Kalamrita', verdict:'7th lord strong in Navamsha → marriage quality confirmed; spouse is genuinely strong and capable'});
        }
        if (navStr === 'DEBILITATED') {
          strength -= 2;
          f.push({rule:'M-NAV2', source:'Uttara Kalamrita', verdict:'7th lord debilitated in Navamsha → despite surface appearance, marriage has deep problems; spouse has hidden weaknesses'});
        }
      }
      // Venus in Navamsha
      const navVenus = c.navamsha.planets['Venus'];
      if (navVenus) {
        const navVenStr = getPlanetStrength('Venus', navVenus.sign);
        if (navVenStr === 'EXALTED' || navVenStr === 'OWN') {
          strength += 1;
          f.push({rule:'M-NAV3', source:'Uttara Kalamrita', verdict:'Venus strong in Navamsha → confirmed happiness in married life'});
        }
      }
    }

    // ── DARAKARAKA (JAIMINI) ──────────────────────────────────────────
    if (c.darakaraka) {
      const dkData = c.planets[c.darakaraka];
      if (dkData) {
        const dkStr = getPlanetStrength(c.darakaraka, dkData.sign);
        f.push({rule:'M-DK1', source:'Jaimini Sutram Ch.1', verdict:`Darakaraka is ${c.darakaraka}: spouse's soul nature reflected by this planet`});
        if (dkStr === 'EXALTED') f.push({rule:'M-DK2', source:'Jaimini Sutram', verdict:'Darakaraka exalted → spouse is exceptionally capable; marriage is life-elevating'});
        if (dkStr === 'DEBILITATED') f.push({rule:'M-DK3', source:'Jaimini Sutram', verdict:'Darakaraka debilitated → spouse faces struggles; marriage has karmic lessons'});
      }
    }

    // ── UPAPADA LAGNA (JAIMINI) ────────────────────────────────────────
    if (c.upapada) {
      const upLord = lordOf(c.upapada, c); // lord of Upapada sign
      const upLordData = c.planets[upLord];
      if (upLordData) {
        const upStr = getPlanetStrength(upLord, upLordData.sign);
        f.push({rule:'M-UL1', source:'Jaimini Sutram Ch.2', verdict:`Upapada Lagna is in house ${c.upapada}: marriage partner's public nature shown`});
        if (upStr === 'EXALTED' || upStr === 'OWN') f.push({rule:'M-UL2', source:'Jaimini', verdict:'Upapada lord strong → marriage partner is strong, stable, brings status'});
        if (upStr === 'DEBILITATED' || isInDusthana(upLord, c)) f.push({rule:'M-UL3', source:'Jaimini', verdict:'Upapada lord weak/dusthana → partner faces challenges; marriage needs conscious effort'});
      }
    }

    // ── DASHA TIMING ──────────────────────────────────────────────────
    if (c.dasha) {
      const { maha, antar } = c.dasha;
      const marriageDashas = [l7, 'Venus', l5, l11];
      if (marriageDashas.includes(maha) || marriageDashas.includes(antar)) {
        confidence = 'HIGH';
        f.push({rule:'M-DASHA', source:'BPHS Ch.45', verdict:`${maha}-${antar} dasha → current period is marriage-connected; high probability of marriage event now`});
      }
    }

    // ── TRANSIT TRIGGERS ──────────────────────────────────────────────
    // Jupiter transiting 7th or over 7th lord is classic marriage timing
    if (c.currentTransits && c.currentTransits['Jupiter']) {
      const jTransitHouse = c.currentTransits['Jupiter'].house;
      if ([1,7].includes(jTransitHouse)) {
        f.push({rule:'M-TRANS', source:'Classical transit rule', verdict:`Jupiter currently transiting ${jTransitHouse}th house → this year is favourable for marriage event`});
        confidence = 'HIGH';
      }
    }

    // ── SPOUSE DESCRIPTION FROM 7TH LORD SIGN ─────────────────────────
    if (l7d) {
      const spouseSignDesc = {
        0:'Spouse is athletic, energetic, independent, possibly impulsive',
        1:'Spouse is patient, sensual, loves luxury, possibly stubborn',
        2:'Spouse is communicative, intelligent, dual-natured, witty',
        3:'Spouse is nurturing, emotional, home-loving, possibly moody',
        4:'Spouse is proud, generous, authoritative, dramatic',
        5:'Spouse is analytical, practical, health-conscious, detail-oriented',
        6:'Spouse is charming, balanced, artistic, justice-loving',
        7:'Spouse is intense, secretive, investigative, passionate',
        8:'Spouse is philosophical, adventurous, freedom-loving, blunt',
        9:'Spouse is disciplined, ambitious, practical, status-conscious',
        10:'Spouse is independent, intellectual, progressive, unconventional',
        11:'Spouse is spiritual, empathetic, imaginative, compassionate'
      };
      spouseDesc.push(spouseSignDesc[l7d.sign]);
    }

    // ── FINAL VERDICT ─────────────────────────────────────────────────
    let verdict = '';
    if (strength >= 5) verdict += 'Exceptionally blessed marriage. ';
    else if (strength >= 3) verdict += 'Strong, happy marriage indicated. ';
    else if (strength >= 1) verdict += 'Generally positive marriage with some challenges. ';
    else if (strength === 0) verdict += 'Average marriage — neither strongly blessed nor troubled. ';
    else if (strength <= -3) verdict += 'Significant challenges in marriage — requires conscious work. ';
    else verdict += 'Some obstacles in married life. ';

    if (type) verdict += `Type: ${type} marriage. `;
    if (timing) verdict += `Marriage timing: after age ${timing}. `;
    if (spouseDesc.length > 0) verdict += `Spouse: ${[...new Set(spouseDesc)].join(', ')}.`;

    return { verdict, strength, type, timing, spouseDesc: [...new Set(spouseDesc)], confidence, rules: f };
  }

  // ─────────────────────────────────────────────────────────────
  // SIBLINGS — COMPLETE EDITION
  // BPHS Ch.12, Phaladeepika Ch.8, Saravali Ch.22
  // ─────────────────────────────────────────────────────────────
  evaluateSiblings() {
    const { c } = this;
    const f = [];
    let count = null;
    let elderGender = null;
    let youngerGender = null;
    let relation = 'normal';
    let confidence = 'MEDIUM';

    const h3 = planetsInHouse(3, c);
    const h11 = planetsInHouse(11, c); // 11th = elder siblings
    const l3 = lordOf(3, c);
    const l3d = c.planets[l3];
    const mars = c.planets['Mars']; // Karaka for siblings

    // ── PLANETS IN 3RD ────────────────────────────────────────────────
    const planetSiblingCount = {
      Sun:'1 sibling (brother likely)', Moon:'2-3 siblings (sisters possible)',
      Mars:'2-3 siblings (brothers)', Mercury:'2-3 siblings (various)',
      Jupiter:'3-4 siblings', Venus:'2-3 siblings (sisters possible)',
      Saturn:'1-2 siblings (may be older)', Rahu:'unusual count (step-sibling possible)',
      Ketu:'1 sibling (spiritual connection)'
    };
    for (const p of h3) {
      if (planetSiblingCount[p]) {
        f.push({rule:`S-${p}IN3`, source:'BPHS Ch.12', verdict:`${p} in 3rd → ${planetSiblingCount[p]}`});
      }
    }

    // Planet in 3rd count rule — BPHS
    if (h3.length === 0) {
      f.push({rule:'S-EMPTY3', source:'BPHS Ch.12 v.3', verdict:'No planets in 3rd → sibling indication from 3rd lord and Mars only'});
    } else {
      count = count || (h3.length === 1 ? '1-2' : '2-4');
    }

    // Sun in 3rd — elder brother
    if (h3.includes('Sun')) {
      elderGender = 'male';
      f.push({rule:'S-SUN3', source:'Saravali Ch.22 v.5', verdict:'Sun in 3rd → elder sibling is male, possibly in government or authority position'});
    }
    // Moon in 3rd — sisters
    if (h3.includes('Moon')) {
      count = '2-4';
      f.push({rule:'S-MOON3', source:'BPHS Ch.12 v.18', verdict:'Moon in 3rd → multiple siblings, sisters prominent; emotional sibling bonds'});
    }
    // Mars in 3rd — brothers, conflicts
    if (h3.includes('Mars')) {
      count = count || '2-3';
      f.push({rule:'S-MARS3', source:'Saravali Ch.22 v.3', verdict:'Mars in 3rd → courageous, active siblings; brothers especially; competition and conflicts between siblings'});
    }
    // Mercury in 3rd — intelligent siblings
    if (h3.includes('Mercury')) {
      f.push({rule:'S-MERC3', source:'BPHS Ch.12 v.19', verdict:'Mercury in 3rd → intelligent, communicative siblings; they may be in business or media'});
    }
    // Jupiter in 3rd — prosperous, wise siblings
    if (h3.includes('Jupiter')) {
      relation = 'excellent';
      count = count || '2-4';
      f.push({rule:'S-JUP3', source:'BPHS Ch.12 v.20', verdict:'Jupiter in 3rd → wise, educated, prosperous siblings; they help the native; excellent sibling relationship'});
    }
    // Venus in 3rd — beautiful sisters
    if (h3.includes('Venus')) {
      f.push({rule:'S-VEN3', source:'Phaladeepika Ch.8 v.6', verdict:'Venus in 3rd → beautiful or artistic siblings, sisters; harmonious relationships; siblings in arts or luxury'});
    }
    // Saturn in 3rd — fewer, older, serious siblings
    if (h3.includes('Saturn')) {
      count = '1';
      f.push({rule:'S-SAT3', source:'BPHS Ch.12 v.22', verdict:'Saturn in 3rd → only one or very few siblings; sibling is much older, serious, or health-challenged; slow sibling relationship'});
      confidence = 'HIGH';
    }
    // Rahu in 3rd — unconventional sibling
    if (h3.includes('Rahu')) {
      f.push({rule:'S-RAHU3', source:'BPHS Ch.12 v.28', verdict:'Rahu in 3rd → unconventional sibling; step-sibling possible; sibling lives abroad or in unusual circumstances'});
    }
    // Ketu in 3rd — spiritual sibling
    if (h3.includes('Ketu')) {
      f.push({rule:'S-KETU3', source:'BPHS Ch.12 v.29', verdict:'Ketu in 3rd → karmic sibling relationship; sibling is spiritual or detached; past-life connection with sibling'});
    }

    // ── 3RD LORD POSITION ─────────────────────────────────────────────
    if (l3d) {
      const l3str = getPlanetStrength(l3, l3d.sign);
      if (l3str === 'EXALTED' || l3str === 'OWN') {
        relation = 'good'; confidence = 'HIGH';
        f.push({rule:'S-L3STR', source:'BPHS Ch.12 v.8', verdict:'3rd lord strong → siblings are prosperous, supportive; good sibling bonds'});
      }
      if (l3str === 'DEBILITATED') {
        relation = 'troubled'; confidence = 'HIGH';
        f.push({rule:'S-L3DB', source:'BPHS Ch.12 v.9', verdict:'3rd lord debilitated → siblings face difficulties; relationship is strained or competitive'});
      }

      const l3houseVerdicts = {
        1:'3rd lord in 1st → self-reliant, siblings are important to identity; possible competition with sibling',
        2:'3rd lord in 2nd → siblings contribute to family wealth; financial connection with siblings',
        3:'3rd lord in own house → strong siblings; bold, active; siblings prosper',
        4:'3rd lord in 4th → siblings are homely; property shared with siblings',
        5:'3rd lord in 5th → creative sibling; sibling helps with children; intellectual bond',
        6:'3rd lord in 6th → conflict with siblings; sibling has health issues or debts',
        7:'3rd lord in 7th → sibling helps in marriage or business partnership',
        8:'3rd lord in 8th → sibling faces serious issues; possible sudden events; inheritance from sibling',
        9:'3rd lord in 9th → sibling is fortunate, righteous; they elevate the family',
        10:'3rd lord in 10th → sibling is career-focused, successful in profession',
        11:'3rd lord in 11th → sibling brings gains; strong elder sibling; excellent support',
        12:'3rd lord in 12th → sibling lives far away or in foreign land; separation from siblings'
      };
      f.push({rule:'S-L3H', source:'BPHS Ch.12 v.10-30', verdict: l3houseVerdicts[l3d.house]});

      if ([6,8,12].includes(l3d.house)) {
        relation = relation === 'excellent' ? 'mixed' : 'estranged';
        f.push({rule:'S-L3DUST', source:'BPHS Ch.12 v.12', verdict:`3rd lord in ${l3d.house}th → estrangement from siblings or siblings face troubles`});
      }
    }

    // ── MARS (KARAKA) STRENGTH ─────────────────────────────────────────
    const marsStr = getPlanetStrength('Mars', mars.sign);
    if (marsStr === 'EXALTED') f.push({rule:'S-MARSEX', source:'BPHS Ch.12 v.15', verdict:'Mars exalted → siblings are brave, successful; brothers in military/sports/government'});
    if (marsStr === 'DEBILITATED') { relation = relation === 'good' ? 'mixed' : 'troubled'; f.push({rule:'S-MARSDB', source:'BPHS Ch.12 v.16', verdict:'Mars debilitated → siblings face recurring obstacles; conflict-prone sibling relationships'}); }

    // Mars in house of siblings (3rd) — already covered
    // Mars in 6th — fights with siblings
    if (mars.house === 6) f.push({rule:'S-MARS6', source:'BPHS Ch.12 v.17', verdict:'Mars in 6th → disputes and conflicts with siblings; litigation between siblings possible'});

    // ── 11TH HOUSE (ELDER SIBLINGS) ───────────────────────────────────
    const l11 = lordOf(11, c);
    const l11d = c.planets[l11];
    if (h11.includes('Jupiter')) f.push({rule:'S-JUP11', source:'BPHS Ch.12 v.35', verdict:'Jupiter in 11th → elder sibling is highly successful, learned; they bring blessings to the family'});
    if (h11.includes('Saturn')) f.push({rule:'S-SAT11', source:'Saravali', verdict:'Saturn in 11th → elder sibling has a serious, disciplined life; may be in service or labor'});
    if (h11.includes('Sun')) { elderGender = elderGender || 'male'; f.push({rule:'S-SUN11', source:'BPHS Ch.12 v.36', verdict:'Sun in 11th → elder sibling is male, government-connected or authoritative'}); }

    if (l11d && (l11d.house === 3 || l3d && l3d.house === 11)) {
      if (parivartana(3, 11, c)) {
        relation = 'excellent'; confidence = 'HIGH';
        f.push({rule:'S-PARIV', source:'BPHS Ch.37', verdict:'3rd-11th lord Parivartana → exceptional sibling bonds; siblings bring major gains to native'});
      }
    }
    if (l11d && l11d.house === 3) f.push({rule:'S-L11IN3', source:'BPHS Ch.12', verdict:'11th lord in 3rd → elder siblings support younger; strong family bond'});
    if (l3d && l3d.house === 11) { relation = relation === 'troubled' ? 'normal' : 'good'; f.push({rule:'S-L3IN11', source:'BPHS Ch.12 v.10', verdict:'3rd lord in 11th → siblings are financially helpful; gains through brothers/sisters'}); }

    // ── FINAL VERDICT ─────────────────────────────────────────────────
    let verdict = '';
    if (count) verdict += `${count} siblings indicated. `;
    if (elderGender) verdict += `Elder sibling likely ${elderGender}. `;
    if (relation === 'excellent') verdict += 'Outstanding, supportive sibling relationship. ';
    else if (relation === 'good') verdict += 'Good relationship with siblings. ';
    else if (relation === 'troubled') verdict += 'Conflict or tension with siblings. ';
    else if (relation === 'estranged') verdict += 'Distance or estrangement from siblings. ';

    return { verdict: verdict || 'Standard sibling indication', count, elderGender, relation, confidence, rules: f };
  }

  // ─────────────────────────────────────────────────────────────
  // FATHER — COMPLETE EDITION
  // BPHS Ch.13, Phaladeepika Ch.9, Saravali Ch.23
  // ─────────────────────────────────────────────────────────────
  evaluateFather() {
    const { c } = this;
    const f = [];
    let health = 'average';
    let wealth = 'average';
    let relation = 'normal';
    let longevity = 'normal';
    let confidence = 'MEDIUM';

    const h9 = planetsInHouse(9, c);
    const l9 = lordOf(9, c);
    const l9d = c.planets[l9];
    const sun = c.planets['Sun'];

    // ── 9TH LORD STRENGTH ─────────────────────────────────────────────
    if (l9d) {
      const str = getPlanetStrength(l9, l9d.sign);
      if (str === 'EXALTED') { health = 'excellent'; wealth = 'prosperous'; confidence = 'HIGH'; f.push({rule:'F-L9EX', source:'BPHS Ch.13 v.1', verdict:'9th lord exalted → father is highly successful, respected, wealthy, healthy; father is a powerful positive figure'}); }
      if (str === 'OWN')     { wealth = 'comfortable'; f.push({rule:'F-L9OWN', source:'BPHS Ch.13 v.2', verdict:'9th lord in own sign → father is stable, self-made, reliable; good financial standing'}); }
      if (str === 'DEBILITATED') { wealth = 'struggling'; health = 'weak'; confidence = 'HIGH'; f.push({rule:'F-L9DB', source:'BPHS Ch.13 v.3', verdict:'9th lord debilitated → father faces serious financial or health struggles; native may receive little support from father'}); }

      const l9houseVerdicts = {
        1:'Father lives with native or they are very similar; native carries father\'s legacy',
        2:'Father connected to family wealth; passes down wealth to native',
        3:'Father is communicative, may be in media or travel; father is courageous',
        4:'Father is home-loving, educated, may be in real estate or education',
        5:'Father is creative, intelligent; has good relationship with grandchildren',
        6:'Father faces health issues or financial debts; strained relationship with father',
        7:'Father is partnership-oriented; father\'s business matters affect native',
        8:'Father has secrets; father faces chronic illness or sudden reversals',
        9:'Father is extremely fortunate; may be religious, teacher, or very educated',
        10:'Father is career-driven, powerful in profession; father\'s reputation helps native',
        11:'Father is very wealthy; gains from father; father has many connections',
        12:'Father lives far away or in foreign land; separation from father; spiritual father'
      };
      f.push({rule:'F-L9H', source:'BPHS Ch.13 v.5-30', verdict: l9houseVerdicts[l9d.house]});

      if ([6,8,12].includes(l9d.house)) {
        health = 'weak'; confidence = 'HIGH';
        f.push({rule:'F-L9DUST', source:'BPHS Ch.13 v.8', verdict:`9th lord in ${l9d.house}th → father's health/finances affected; native and father may be separated`});
        if (l9d.house === 8) { longevity = 'concern'; f.push({rule:'F-L9IN8', source:'BPHS Ch.13 v.10', verdict:'9th lord in 8th → serious concern for father\'s longevity; chronic illness possible; native may lose father early'}); }
      }
    }

    // ── SUN (KARAKA FOR FATHER) ────────────────────────────────────────
    const sunStr = getPlanetStrength('Sun', sun.sign);
    if (sunStr === 'EXALTED') { health = 'excellent'; f.push({rule:'F-SUNEX', source:'BPHS Ch.13 v.15', verdict:'Sun exalted (Aries) → father is powerful, possibly government-connected, healthy and long-lived'}); }
    if (sunStr === 'DEBILITATED') { health = 'weak'; relation = 'difficult'; f.push({rule:'F-SUNDB', source:'BPHS Ch.13 v.16', verdict:'Sun debilitated (Libra) → father faces humiliation, health decline, or financial reversal; difficult relationship with father'}); }

    // Sun house position for father
    const sunFatherVerdicts = {
      1:'Sun in 1st → native resembles father; father\'s influence dominates personality',
      4:'Sun in 4th → father is very present in home; property connection with father',
      9:'Sun (karaka) in 9th house → father is fortunate, possibly in government or authority',
      10:'Sun in 10th → father in high position; career follows father\'s path',
      12:'Sun in 12th → father separated or lives far away; spiritual connection with father'
    };
    if (sunFatherVerdicts[sun.house]) f.push({rule:'F-SUNH', source:'Saravali Ch.23', verdict: sunFatherVerdicts[sun.house]});

    // ── 9TH HOUSE OCCUPANTS ───────────────────────────────────────────
    if (h9.includes('Jupiter')) { wealth = 'prosperous'; relation = 'excellent'; f.push({rule:'F-JUP9', source:'BPHS Ch.13 v.25', verdict:'Jupiter in 9th → father is wise, religious, generous; blessed relationship; father is the native\'s greatest guide'}); }
    if (h9.includes('Saturn')) { relation = 'distant'; f.push({rule:'F-SAT9', source:'Saravali Ch.23 v.8', verdict:'Saturn in 9th → father is strict, cold, or distant; or father has karmic burden; Pitru dosha possible'}); }
    if (h9.includes('Mars'))   { f.push({rule:'F-MARS9', source:'BPHS Ch.13 v.22', verdict:'Mars in 9th → father is courageous, action-oriented, possibly military/police/sports; confrontational relationship possible'}); }
    if (h9.includes('Rahu'))   { f.push({rule:'F-RAHU9', source:'BPHS Ch.13 v.28', verdict:'Rahu in 9th → Pitru dosha likely; father from different background; ancestral karma needs attention; father has unconventional path'}); }
    if (h9.includes('Venus'))  { f.push({rule:'F-VEN9', source:'Phaladeepika Ch.9', verdict:'Venus in 9th → father is artistic, charming, in luxury or beauty field; good relationship'}); }
    if (h9.includes('Moon'))   { f.push({rule:'F-MOON9', source:'BPHS Ch.13 v.21', verdict:'Moon in 9th → father is nurturing, emotionally present; mother-like qualities in father'}); }
    if (h9.includes('Mercury')){ f.push({rule:'F-MERC9', source:'Saravali', verdict:'Mercury in 9th → father is intelligent, communicative, possibly in teaching or trade'}); }
    if (h9.includes('Ketu'))   { f.push({rule:'F-KETU9', source:'BPHS', verdict:'Ketu in 9th → father is spiritually inclined or detached; past-life karma between native and father'}); }
    if (h9.includes('Sun'))    { f.push({rule:'F-SUN9', source:'BPHS Ch.13 v.22', verdict:'Sun (karaka) in 9th → father is fortunate, government-connected; native receives fortune through father'}); }

    // ── SATURN AFFLICTING SUN ─────────────────────────────────────────
    if (planetAspectsHouse('Saturn', c, sun.house) || areConjunct('Saturn','Sun',c)) {
      relation = 'distant'; health = health === 'excellent' ? 'average' : 'weak';
      f.push({rule:'F-SATSON', source:'BPHS Ch.13 v.20', verdict:'Saturn influences Sun → father faces chronic struggles; cold/difficult relationship with father; father has heavy karmic burden'});
    }

    // Multiple malefics in 9th
    const maleficsIn9 = h9.filter(p => isMalefic(p));
    if (maleficsIn9.length >= 2) {
      health = 'weak'; longevity = 'concern'; confidence = 'HIGH';
      f.push({rule:'F-MAL9', source:'Saravali Ch.23 v.8', verdict:`Multiple malefics (${maleficsIn9.join('+')}) in 9th → serious concern for father's health and longevity`});
    }

    // ── PITRU DOSHA ───────────────────────────────────────────────────
    const pitrruDosha = (
      h9.includes('Rahu') ||
      (sun.house === 9 && (areConjunct('Rahu','Sun',c) || planetAspectsHouse('Saturn',c,9))) ||
      (l9d && l9d.house === 8) ||
      (c.planets['Rahu'] && c.planets['Rahu'].house === 9)
    );
    if (pitrruDosha) f.push({rule:'F-PITRU', source:'NS (Nadi Shastra)', verdict:'Pitru Dosha indicators present → ancestral karma is active; native must perform Pitra Tarpan and Shradh for peace and to clear ancestral blocks'});

    let verdict = `Father's health: ${health}. Wealth: ${wealth}. Relationship: ${relation}. `;
    if (longevity === 'concern') verdict += 'Father\'s longevity needs attention. ';
    if (pitrruDosha) verdict += 'Ancestral karma (Pitru Dosha) active. ';

    return { verdict, health, wealth, relation, longevity, confidence, rules: f };
  }

  // ─────────────────────────────────────────────────────────────
  // MOTHER — COMPLETE EDITION
  // BPHS Ch.14, Phaladeepika Ch.9, Saravali Ch.24
  // ─────────────────────────────────────────────────────────────
  evaluateMother() {
    const { c } = this;
    const f = [];
    let health = 'average';
    let relation = 'normal';
    let longevity = 'normal';
    let confidence = 'MEDIUM';

    const h4 = planetsInHouse(4, c);
    const l4 = lordOf(4, c);
    const l4d = c.planets[l4];
    const moon = c.planets['Moon'];

    // ── 4TH LORD STRENGTH ─────────────────────────────────────────────
    if (l4d) {
      const str = getPlanetStrength(l4, l4d.sign);
      if (str === 'EXALTED' || str === 'OWN') { health = 'excellent'; relation = 'excellent'; confidence = 'HIGH'; f.push({rule:'MO-L4STR', source:'BPHS Ch.14 v.1', verdict:'4th lord strong → mother is healthy, long-lived, nurturing; excellent mother-child bond'}); }
      if (str === 'DEBILITATED') { health = 'weak'; confidence = 'HIGH'; f.push({rule:'MO-L4DB', source:'BPHS Ch.14 v.2', verdict:'4th lord debilitated → mother faces health or emotional difficulties; native may not receive adequate maternal support'}); }

      if ([6,8,12].includes(l4d.house)) {
        health = 'concerning'; longevity = 'reduced';
        f.push({rule:'MO-L4DUST', source:'BPHS Ch.14 v.5', verdict:`4th lord in ${l4d.house}th → mother's health is a concern; possible early separation from mother`});
        if (l4d.house === 8) f.push({rule:'MO-L4IN8', source:'BPHS Ch.14', verdict:'4th lord in 8th → mother may face chronic illness; native should care for mother\'s health proactively'});
      }
    }

    // ── MOON (KARAKA FOR MOTHER) ───────────────────────────────────────
    const moonStr = getPlanetStrength('Moon', moon.sign);
    if (moonStr === 'EXALTED') { health = 'excellent'; relation = 'exceptional'; confidence = 'HIGH'; f.push({rule:'MO-MOONEX', source:'BPHS Ch.14 v.10', verdict:'Moon exalted (Taurus) → mother is extremely nurturing, healthy, beautiful, wealthy; deepest bond with mother'}); }
    if (moonStr === 'DEBILITATED') { health = 'weak'; relation = 'troubled'; confidence = 'HIGH'; f.push({rule:'MO-MOONDB', source:'BPHS Ch.14 v.11', verdict:'Moon debilitated (Scorpio) → mother faces emotional or physical suffering; difficult relationship with mother; maternal deprivation possible'}); }

    // Moon house for mother
    const moonMotherVerdicts = {
      1:'Moon in 1st → very close to mother; mother\'s nature dominates the personality',
      2:'Moon in 2nd → mother focused on family wealth; financial support from mother',
      4:'Moon (in own sign area) in 4th → exceptionally close mother bond; mother is home',
      7:'Moon in 7th → spouse resembles mother; mother involved in marriage',
      9:'Moon in 9th → mother is spiritual, religious; mother as guru',
      12:'Moon in 12th → mother lives abroad or is distant; spiritual/sacrificial mother'
    };
    if (moonMotherVerdicts[moon.house]) f.push({rule:'MO-MOONH', source:'BPHS Ch.14', verdict: moonMotherVerdicts[moon.house]});

    // ── 4TH HOUSE OCCUPANTS ───────────────────────────────────────────
    if (h4.includes('Jupiter')) { relation = 'excellent'; f.push({rule:'MO-JUP4', source:'BPHS Ch.14 v.15', verdict:'Jupiter in 4th → mother is wise, religious, devoted; she brings blessings to the home'}); }
    if (h4.includes('Saturn'))  { relation = 'distant'; f.push({rule:'MO-SAT4', source:'Saravali Ch.24 v.8', verdict:'Saturn in 4th → cold or emotionally distant relationship with mother; or early separation; mother may be strict'}); }
    if (h4.includes('Mars'))    { f.push({rule:'MO-MARS4', source:'BPHS Ch.14', verdict:'Mars in 4th → mother is active, courageous but possibly aggressive; conflict at home possible'}); }
    if (h4.includes('Rahu'))    { f.push({rule:'MO-RAHU4', source:'BPHS', verdict:'Rahu in 4th → mother has unusual qualities; she may be unconventional or from different background; Matru Dosha possible'}); }
    if (h4.includes('Venus'))   { relation = 'loving'; f.push({rule:'MO-VEN4', source:'Phaladeepika', verdict:'Venus in 4th → mother is beautiful, artistic, loving; very pleasant home environment'}); }
    if (h4.includes('Sun'))     { f.push({rule:'MO-SUN4', source:'Saravali', verdict:'Sun in 4th → mother is proud or authoritative; or father figure in home; government connection in family'}); }
    if (h4.includes('Ketu'))    { f.push({rule:'MO-KETU4', source:'BPHS', verdict:'Ketu in 4th → karmic relationship with mother; spiritual distance; possible past-life mother bond'}); }

    // Saturn aspects Moon
    if (planetAspectsHouse('Saturn', c, moon.house) || areConjunct('Saturn','Moon',c)) {
      health = health === 'excellent' ? 'average' : 'weak';
      f.push({rule:'MO-SATMOON', source:'BPHS Ch.14 v.20', verdict:'Saturn influences Moon → mother faces sorrow, chronic illness, or depression; emotionally heavy mother-child relationship'});
    }
    // Jupiter aspects Moon
    if (planetAspectsHouse('Jupiter', c, moon.house)) {
      health = health === 'weak' ? 'average' : health;
      relation = relation === 'troubled' ? 'normal' : 'good';
      f.push({rule:'MO-JUPMOON', source:'BPHS Ch.14 v.22', verdict:'Jupiter aspects Moon → mother is protected, wise, blessed; positive maternal influence'});
    }

    let verdict = `Mother's health: ${health}. Relationship with mother: ${relation}. `;
    if (longevity === 'reduced') verdict += 'Mother\'s longevity may be reduced. ';

    return { verdict, health, relation, longevity, confidence, rules: f };
  }

  // ─────────────────────────────────────────────────────────────
  // CHILDREN — COMPLETE EDITION
  // BPHS Ch.16, Phaladeepika Ch.11, D7 (Saptamsha)
  // ─────────────────────────────────────────────────────────────
  evaluateChildren() {
    const { c } = this;
    const f = [];
    let count = null;
    let timing = 'normal';
    let quality = 'average';
    let gender = null;
    let confidence = 'MEDIUM';

    const h5 = planetsInHouse(5, c);
    const l5 = lordOf(5, c);
    const l5d = c.planets[l5];
    const jupiter = c.planets['Jupiter']; // Karaka for children

    // ── JUPITER (MAIN KARAKA) ──────────────────────────────────────────
    const jupStr = getPlanetStrength('Jupiter', jupiter.sign);
    if (jupStr === 'EXALTED' || jupStr === 'OWN') {
      count = '2-4'; quality = 'gifted'; confidence = 'HIGH';
      f.push({rule:'C-JUPSTR', source:'BPHS Ch.16 v.8', verdict:'Jupiter strong → blessed with good children; they are intelligent, educated, spiritual; children bring honour'});
    }
    if (jupStr === 'DEBILITATED') {
      count = '1'; timing = 'late'; confidence = 'HIGH';
      f.push({rule:'C-JUPDB', source:'BPHS Ch.16 v.9', verdict:'Jupiter debilitated → fewer children; challenges in upbringing; possible medical help needed for conception'});
    }

    // ── 5TH LORD STRENGTH ─────────────────────────────────────────────
    if (l5d) {
      const str = getPlanetStrength(l5, l5d.sign);
      if (str === 'EXALTED' || str === 'OWN') { quality = 'gifted'; f.push({rule:'C-L5STR', source:'BPHS Ch.16 v.1', verdict:'5th lord strong → gifted children; excellent parent-child relationship; children bring joy'}); }
      if (str === 'DEBILITATED') { timing = 'delayed'; f.push({rule:'C-L5DB', source:'BPHS Ch.16 v.2', verdict:'5th lord debilitated → delays or obstacles in having children; needs medical attention or remedies'}); confidence = 'HIGH'; }

      if ([6,8,12].includes(l5d.house)) {
        timing = 'delayed'; confidence = 'HIGH';
        f.push({rule:'C-L5DUST', source:'BPHS Ch.16 v.5', verdict:`5th lord in ${l5d.house}th → delays or difficulties in childbirth; medical consultation advised`});
        if (l5d.house === 12) f.push({rule:'C-L5IN12', source:'BPHS Ch.16', verdict:'5th lord in 12th → child may be born abroad or there is hidden suffering connected to children'});
      }
    }

    // ── 5TH HOUSE OCCUPANTS ───────────────────────────────────────────
    if (h5.includes('Sun'))     { gender = 'son'; f.push({rule:'C-SUN5', source:'BPHS Ch.16 v.12', verdict:'Sun in 5th → son likely as first child; child is proud, authoritative, possibly in government'}); }
    if (h5.includes('Moon'))    { count = count||'2-3'; f.push({rule:'C-MOON5', source:'BPHS Ch.16 v.13', verdict:'Moon in 5th → multiple children; emotional bond with children; daughters possible'}); }
    if (h5.includes('Mars'))    { gender = 'son'; f.push({rule:'C-MARS5', source:'BPHS Ch.16 v.14', verdict:'Mars in 5th → son likely; child is energetic, brave, possibly in sports or military; early delivery possible'}); }
    if (h5.includes('Mercury')) { f.push({rule:'C-MERC5', source:'BPHS Ch.16 v.15', verdict:'Mercury in 5th → intelligent, communicative children; they may be in writing, business, or technology'}); quality = 'gifted'; }
    if (h5.includes('Jupiter')) { count = '2-4'; quality = 'gifted'; f.push({rule:'C-JUP5', source:'BPHS Ch.16 v.12', verdict:'Jupiter in 5th → multiple blessed children; they are scholarly, religious, bring honour to family'}); }
    if (h5.includes('Venus'))   { gender = gender||'daughter'; f.push({rule:'C-VEN5', source:'Phaladeepika Ch.11 v.8', verdict:'Venus in 5th → daughters likely; beautiful, artistic children; child is charming and creative'}); }
    if (h5.includes('Saturn'))  {
      count = '1'; timing = 'late'; confidence = 'HIGH';
      f.push({rule:'C-SAT5', source:'Phaladeepika Ch.11 v.8', verdict:'Saturn in 5th → late children (after 30), fewer in number; first child is serious, disciplined; child may have Saturn-type challenges'});
    }
    if (h5.includes('Rahu')) f.push({rule:'C-RAHU5', source:'BPHS Ch.16 v.18', verdict:'Rahu in 5th → unconventional children; child may be born in unusual circumstances; adoption possible; child has foreign or unusual life path'});
    if (h5.includes('Ketu'))    { timing = 'delayed'; f.push({rule:'C-KETU5', source:'BPHS Ch.16 v.19', verdict:'Ketu in 5th → spiritual/karmic connection with children; possible delays; child is introspective, spiritual'}); }

    // ── MALEFICS IN 5TH WITHOUT BENEFIC PROTECTION ────────────────────
    const maleficsIn5 = h5.filter(p => isMalefic(p));
    const beneficAspects5 = anyBeneficAspectsHouse(5, c);
    if (maleficsIn5.length >= 2 && !beneficAspects5) {
      timing = 'very delayed'; confidence = 'HIGH';
      f.push({rule:'C-MAL5', source:'BPHS Ch.16 v.18', verdict:`Multiple malefics (${maleficsIn5.join('+')}) in 5th without benefic aspect → serious difficulty in having children; adoption or medical intervention may be needed`});
    }

    // ── JUPITER IN KENDRA/TRIKONA ──────────────────────────────────────
    if (isInKendra(jupiter, c) || isInTrikona(jupiter, c)) {
      quality = quality === 'average' ? 'good' : quality;
      f.push({rule:'C-JUPKT', source:'BPHS Ch.16 v.20', verdict:'Jupiter in kendra/trikona → children are well-placed in life; good education and success for children'});
    }

    // ── SAPTAMSHA (D7) CONFIRMATION ───────────────────────────────────
    if (c.saptamsha && c.saptamsha.planets) {
      const d7l5 = l5;
      const d7l5d = c.saptamsha.planets[d7l5];
      if (d7l5d) {
        const d7str = getPlanetStrength(d7l5, d7l5d.sign);
        if (d7str === 'EXALTED' || d7str === 'OWN') f.push({rule:'C-D7', source:'Uttara Kalamrita (D7)', verdict:'5th lord strong in D7 → confirmed good children; they thrive in life'});
        if (d7str === 'DEBILITATED') f.push({rule:'C-D7DB', source:'Uttara Kalamrita (D7)', verdict:'5th lord debilitated in D7 → children face challenges; extra support and remedies needed'});
      }
    }

    let verdict = '';
    if (count) verdict += `${count} children indicated. `;
    if (gender) verdict += `${gender} as first child likely. `;
    if (timing === 'late' || timing === 'delayed') verdict += 'Children come later in life. ';
    if (timing === 'very delayed') verdict += 'Significant delays in having children. ';
    if (quality === 'gifted') verdict += 'Children are talented and bring distinction to family. ';

    return { verdict: verdict || 'Standard children indication', count, timing, quality, gender, confidence, rules: f };
  }

  // ─────────────────────────────────────────────────────────────
  // CAREER — COMPLETE EDITION
  // BPHS Ch.24-34, Phaladeepika Ch.16, Saravali Ch.30
  // Includes: All 9 planets in 10th, 10th lord in all 12 houses,
  //           Amatyakaraka, D10, Raja Yogas
  // ─────────────────────────────────────────────────────────────
  evaluateCareer() {
    const { c } = this;
    const f = [];
    let fields = [];
    let strength = 0;
    let peak = null;
    let confidence = 'MEDIUM';

    const h10 = planetsInHouse(10, c);
    const l10 = lordOf(10, c);
    const l10d = c.planets[l10];
    const saturn = c.planets['Saturn'];
    const sun = c.planets['Sun'];
    const l9 = lordOf(9, c);
    const l9d = c.planets[l9];

    // ── PLANETS IN 10TH — FULL 9-PLANET TABLE ─────────────────────────
    // Source: BPHS Ch.24-34 (one chapter per planet)
    const planetIn10Verdicts = {
      Sun:    {fields:['government','administration','politics','medicine','father\'s profession'],  verdict:'Sun in 10th → outstanding career in government/administration; authority and recognition; career is everything; father\'s profession followed'},
      Moon:   {fields:['food','hospitality','public sector','water','nursing','real estate','travel'], verdict:'Moon in 10th → career in public sector, food, hospitality, or with women; popularity with masses; fame possible; career fluctuates'},
      Mars:   {fields:['military','police','engineering','surgery','fire department','sports','real estate'], verdict:'Mars in 10th → courageous career in military/engineering/surgery; leadership through action; confrontational career path; high achiever'},
      Mercury:{fields:['business','writing','accounting','IT','media','education','commerce'], verdict:'Mercury in 10th → intellectual career; communication, business, education, IT; multiple career paths; quick mind in profession'},
      Jupiter:{fields:['teaching','law','finance','consulting','religion','counseling','banking'], verdict:'Jupiter in 10th → highly respected career; teacher, judge, professor, consultant, religious head; wisdom earns reputation'},
      Venus:  {fields:['arts','entertainment','beauty','luxury','fashion','hospitality','design'], verdict:'Venus in 10th → career in beauty, arts, entertainment, luxury industry; creative profession; popular with public'},
      Saturn: {fields:['service','mining','agriculture','real estate','research','labor','oil','government'], verdict:'Saturn in 10th → Sasha Mahapurusha Yoga for Capricorn/Aquarius lagna; disciplined, slow-rising career; authority through hard work; government or large organization'},
      Rahu:   {fields:['technology','foreign companies','media','unconventional fields','aviation','IT'], verdict:'Rahu in 10th → unique, unconventional career path; foreign companies; rapid rise through ambition; technology or media'},
      Ketu:   {fields:['research','occult','medicine','technical work','spirituality','defense'], verdict:'Ketu in 10th → unconventional, specialized career; research, occult, technical; may have multiple career disruptions; spiritual career possible'}
    };

    for (const p of h10) {
      if (planetIn10Verdicts[p]) {
        fields.push(...planetIn10Verdicts[p].fields);
        f.push({rule:`CR-${p}IN10`, source:`BPHS Ch.24-34`, verdict: planetIn10Verdicts[p].verdict});
        // Strength modifier
        const pStr = getPlanetStrength(p, c.planets[p].sign);
        if (pStr === 'EXALTED') { strength += 3; f.push({rule:`CR-${p}IN10EX`, source:'BPHS', verdict:`${p} exalted in 10th → pinnacle career success; this person reaches the very top of their field`}); }
        if (pStr === 'DEBILITATED') { strength -= 2; f.push({rule:`CR-${p}IN10DB`, source:'BPHS', verdict:`${p} debilitated in 10th → career obstacles; struggles with authority; hard work required`}); }
      }
    }

    // ── 10TH LORD IN ALL 12 HOUSES ────────────────────────────────────
    // BPHS Ch.24-34 detailed house-by-house
    if (l10d) {
      const l10str = getPlanetStrength(l10, l10d.sign);
      if (l10str === 'EXALTED') { strength += 4; confidence = 'HIGH'; f.push({rule:'CR-L10EX', source:'BPHS Ch.24 v.5', verdict:'10th lord exalted → exceptional career success; high position; public recognition; rare honour in profession'}); }
      if (l10str === 'OWN')     { strength += 2; f.push({rule:'CR-L10OWN', source:'BPHS Ch.24 v.6', verdict:'10th lord in own sign → authority, independence, and stability in career; natural leadership'}); }
      if (l10str === 'DEBILITATED') { strength -= 3; confidence = 'HIGH'; f.push({rule:'CR-L10DB', source:'BPHS Ch.24 v.7', verdict:'10th lord debilitated → career has major obstacles; authority challenges; mid-career crisis likely'}); }

      const l10houseVerdicts = {
        1:'10th lord in 1st → self-employed; identity = career; entrepreneur; career is the whole personality',
        2:'10th lord in 2nd → career in finance, banking, or family business; income from speech (speaker, teacher, singer)',
        3:'10th lord in 3rd → career in communication, media, sales, writing, travel; courage in profession',
        4:'10th lord in 4th → career from home; real estate, education, ancestral business; connected to motherland',
        5:'10th lord in 5th → creative career; speculation, entertainment, sports coaching, teaching; career through intelligence',
        6:'10th lord in 6th → service career; medicine, law, dispute resolution, military; success through defeating obstacles',
        7:'10th lord in 7th → career through partnerships; consulting, law, import-export; spouse connected to career',
        8:'10th lord in 8th → research, insurance, mining, occult, inheritance; sudden career changes; detective/investigator',
        9:'10th lord in 9th → most auspicious; career fulfills dharma; law, teaching, religion, foreign trade, publishing',
        10:'10th lord in own house → exceptionally powerful career; very prominent; possible CEO/minister level',
        11:'10th lord in 11th → career brings enormous gains; multiple income streams; large corporate success',
        12:'10th lord in 12th → career abroad or in isolation; spirituality, research, foreign company, NGO, hospital'
      };
      f.push({rule:'CR-L10H', source:'BPHS Ch.24-34', verdict: l10houseVerdicts[l10d.house]});
      if ([6,8,12].includes(l10d.house)) { strength -= 1; f.push({rule:'CR-L10DUST', source:'BPHS Ch.24 v.10', verdict:`10th lord in dusthana (${l10d.house}th) → career obstacles; unconventional path; must work harder`}); }
    }

    // ── PLANETS IN 10TH BY SIGN (career field by element/nature) ──────
    // (This layer adds field specificity when 10th house sign is known)
    const h10Sign = (c.lagna + 9) % 12; // Sign of 10th house
    const careerByH10Sign = {
      0:'Aries 10th → career requires courage and independence; first-mover advantage; leadership roles',
      1:'Taurus 10th → stable, wealth-building career; finance, beauty, food, luxury, land',
      2:'Gemini 10th → dual career or career changes; communication, media, technology, trade',
      3:'Cancer 10th → career in public service, nursing, food, real estate, water-related',
      4:'Leo 10th → career in government, politics, entertainment; authority and recognition',
      5:'Virgo 10th → analytical, service career; healthcare, accounts, editing, research',
      6:'Libra 10th → career in justice, arts, diplomacy, luxury, relationships',
      7:'Scorpio 10th → research, investigation, surgery, occult, insurance, psychology',
      8:'Sagittarius 10th → law, education, religion, publishing, sports, foreign trade',
      9:'Capricorn 10th → government, engineering, management; slow steady rise',
      10:'Aquarius 10th → technology, social work, innovation, humanitarian work',
      11:'Pisces 10th → spiritual career, medicine, music, arts, foreign work, charity'
    };
    f.push({rule:'CR-H10SIGN', source:'BPHS Ch.24 (house sign)', verdict: careerByH10Sign[h10Sign]});

    // ── RAJA YOGAS (CAREER PEAK) ───────────────────────────────────────
    // Dharma-Karma Raja Yoga — 9th and 10th lords connection
    if (l9d && l10d) {
      if (areConjunct(l9, l10, c)) {
        strength += 3; confidence = 'HIGH';
        f.push({rule:'CR-DKRY', source:'BPHS Ch.34 (Dharma-Karma Adhipati Yoga)', verdict:'9th+10th lords conjunct → Dharma-Karma Raja Yoga: career fulfills life purpose; high achievement certain; very fortunate professional life'});
      }
      if (parivartana(9, 10, c)) {
        strength += 4; confidence = 'HIGH';
        f.push({rule:'CR-DKRP', source:'BPHS Ch.37', verdict:'9th-10th lord Parivartana → extraordinary career Raja Yoga; fame and power; may become famous, powerful, or very wealthy through career'});
      }
    }
    // 1st-10th lord connection (Lagna-Karma yoga)
    const lagnaLord = lordOf(1, c);
    if (l10d && houseOf(lagnaLord, c) === 10) { strength += 2; f.push({rule:'CR-LK', source:'BPHS Ch.34', verdict:'Lagna lord in 10th → native achieves through own effort; prominent career; self-made success'}); }
    if (l10d && houseOf(lagnaLord, c) === l10d.house) { strength += 1; f.push({rule:'CR-LK2', source:'BPHS', verdict:'Lagna lord conjunct 10th lord → personality aligned with career; great professional identity'}); }

    // ── YOGA KARAKA ───────────────────────────────────────────────────
    const yk = YOGA_KARAKA[c.lagna];
    if (yk) {
      const ykData = c.planets[yk];
      if (ykData && isStrong(yk, ykData.sign)) {
        strength += 3; confidence = 'HIGH';
        f.push({rule:'CR-YK', source:'BPHS Ch.34', verdict:`${yk} is Yoga Karaka and is strong → exceptional career; life purpose fulfilled through profession`});
        if (c.dasha && (c.dasha.maha === yk || c.dasha.antar === yk)) {
          peak = 'current dasha period';
          f.push({rule:'CR-YKD', source:'BPHS Ch.45', verdict:`Running ${yk} dasha (Yoga Karaka) → this is THE career peak dasha; maximum professional achievement possible NOW`});
        }
      }
    }

    // ── AMATYAKARAKA (JAIMINI) ────────────────────────────────────────
    if (c.amatyakaraka) {
      const akData = c.planets[c.amatyakaraka];
      if (akData) {
        const akStr = getPlanetStrength(c.amatyakaraka, akData.sign);
        f.push({rule:'CR-AK', source:'Jaimini Sutram Ch.1', verdict:`Amatyakaraka is ${c.amatyakaraka}: career minister planet; profession will have this planet's flavour`});
        if (akStr === 'EXALTED' || akStr === 'OWN') { strength += 2; f.push({rule:'CR-AKSTR', source:'Jaimini', verdict:'Amatyakaraka strong → excellent career; high professional achievement'}); }
      }
    }

    // ── D10 (DASHAMSHA) ────────────────────────────────────────────────
    if (c.dashamsha && c.dashamsha.planets) {
      const d10l10 = l10;
      const d10d = c.dashamsha.planets[d10l10];
      if (d10d) {
        const d10str = getPlanetStrength(d10l10, d10d.sign);
        if (d10str === 'EXALTED' || d10str === 'OWN') { strength += 2; f.push({rule:'CR-D10', source:'D10 Dashamsha', verdict:'10th lord strong in D10 → professional success confirmed; career achievements are real and lasting'}); }
        if (d10str === 'DEBILITATED') f.push({rule:'CR-D10DB', source:'D10 Dashamsha', verdict:'10th lord debilitated in D10 → career has hidden weaknesses; professional struggles beneath apparent success'});
      }
    }

    // ── SATURN AS KARMA KARAKA ────────────────────────────────────────
    if (saturn) {
      if (isStrong('Saturn', saturn.sign)) {
        strength += 1;
        f.push({rule:'CR-SATSTR', source:'Saravali Ch.30', verdict:'Saturn strong → career built on discipline and hard work; respected in old age; government or senior position'});
      }
      if (planetAspectsHouse('Saturn', c, 10)) f.push({rule:'CR-SAT10A', source:'Saravali Ch.30', verdict:'Saturn aspects 10th → career requires patience and hard work; success comes slowly but lasts; government or service sector'});
    }

    // ── VERDICT ───────────────────────────────────────────────────────
    const uniqueFields = [...new Set(fields)].slice(0, 6);
    let verdict = '';
    if (uniqueFields.length > 0) verdict += `Career fields: ${uniqueFields.join(', ')}. `;
    if (strength >= 6) verdict += 'Extraordinary career achievement — fame, power, or great wealth. ';
    else if (strength >= 4) verdict += 'Excellent career prospects — leadership and recognition. ';
    else if (strength >= 2) verdict += 'Good career with steady growth. ';
    else if (strength <= -3) verdict += 'Career faces serious challenges — persistence essential. ';
    else if (strength < 0) verdict += 'Career obstacles present — needs extra effort. ';
    if (peak) verdict += `Career peak: ${peak}. `;

    return { verdict, fields: uniqueFields, strength, peak, confidence, rules: f };
  }

  // ─────────────────────────────────────────────────────────────
  // WEALTH — COMPLETE EDITION
  // BPHS Ch.19, Phaladeepika Ch.13, Saravali Ch.29
  // Dhana Yogas, 2nd, 11th lords
  // ─────────────────────────────────────────────────────────────
  evaluateWealth() {
    const { c } = this;
    const f = [];
    let level = 'average';
    let sources = [];
    let strength = 0;
    let confidence = 'MEDIUM';

    const h2 = planetsInHouse(2, c);
    const h11 = planetsInHouse(11, c);
    const l2 = lordOf(2, c);
    const l11 = lordOf(11, c);
    const l2d = c.planets[l2];
    const l11d = c.planets[l11];
    const jupiter = c.planets['Jupiter'];
    const venus = c.planets['Venus'];

    // ── 2ND LORD ─────────────────────────────────────────────────────
    if (l2d) {
      const str = getPlanetStrength(l2, l2d.sign);
      if (str === 'EXALTED') { strength += 3; confidence = 'HIGH'; f.push({rule:'W-L2EX', source:'BPHS Ch.19 v.1', verdict:'2nd lord exalted → great wealth accumulation; financial security throughout life'}); }
      if (str === 'OWN')     { strength += 2; f.push({rule:'W-L2OWN', source:'BPHS Ch.19 v.2', verdict:'2nd lord in own sign → stable income; wealth grows steadily'}); }
      if (str === 'DEBILITATED') { strength -= 2; confidence = 'HIGH'; f.push({rule:'W-L2DB', source:'BPHS Ch.19 v.3', verdict:'2nd lord debilitated → financial instability; wealth comes with great difficulty; debt possible'}); }

      const l2houseVerdicts = {
        1:'2nd lord in 1st → self-made wealth; personal effort builds fortune',
        2:'2nd lord in own house → strong financial stability; wealth from family',
        3:'2nd lord in 3rd → wealth through communication, writing, business, or siblings',
        4:'2nd lord in 4th → wealth through property, real estate, or mother',
        5:'2nd lord in 5th → wealth through speculation, investment, or children',
        6:'2nd lord in 6th → income from service, medicine, or competition; possible debts',
        7:'2nd lord in 7th → wealth through spouse or partnerships',
        8:'2nd lord in 8th → wealth through inheritance, insurance, or hidden sources',
        9:'2nd lord in 9th → wealth through fortune, religion, father, or foreign',
        10:'2nd lord in 10th → wealth through career; high professional income',
        11:'2nd lord in 11th → maximum wealth; multiple income streams; great gains',
        12:'2nd lord in 12th → expenditure exceeds income; loss of wealth; foreign expenses'
      };
      f.push({rule:'W-L2H', source:'BPHS Ch.19 v.5-25', verdict: l2houseVerdicts[l2d.house]});
    }

    // ── 11TH LORD ─────────────────────────────────────────────────────
    if (l11d) {
      const str = getPlanetStrength(l11, l11d.sign);
      if (str === 'EXALTED' || str === 'OWN') { strength += 2; f.push({rule:'W-L11STR', source:'BPHS Ch.19 v.5', verdict:'11th lord strong → large income; gains from multiple sources; desires fulfilled'}); }
      if (str === 'DEBILITATED') { strength -= 1; f.push({rule:'W-L11DB', source:'BPHS Ch.19 v.6', verdict:'11th lord debilitated → income obstacles; gains come with difficulty'}); }
    }

    // ── DHANA YOGAS — BPHS Ch.19 ────────────────────────────────────
    // 2nd and 11th lords conjunct
    if (l2d && l11d && areConjunct(l2, l11, c)) {
      strength += 3; confidence = 'HIGH';
      f.push({rule:'W-DY1', source:'BPHS Ch.19 (Dhana Yoga)', verdict:'2nd+11th lords conjunct → powerful Dhana Yoga; significant wealth accumulation in this lifetime'});
    }
    // Parivartana between 2nd and 11th
    if (parivartana(2, 11, c)) {
      strength += 3; confidence = 'HIGH';
      f.push({rule:'W-DY2', source:'BPHS Ch.37', verdict:'2nd-11th lord Parivartana → exceptional Dhana Yoga; wealth from multiple sources; very financially successful'});
    }
    // 1st, 2nd, 11th lord connection
    const l1 = lordOf(1, c);
    if (houseOf(l1, c) === 2 || houseOf(l1, c) === 11) { strength += 2; f.push({rule:'W-DY3', source:'BPHS Ch.19', verdict:'Lagna lord in 2nd or 11th → self creates wealth; personal efforts directly bring financial gains'}); }
    if (houseOf(l2, c) === 1 || houseOf(l11, c) === 1) { strength += 1; f.push({rule:'W-DY4', source:'BPHS Ch.19', verdict:'Wealth lord in lagna → financial consciousness; money-focused personality'}); }

    // 5th and 9th lords in 2nd or 11th
    const l5 = lordOf(5, c);
    const l9 = lordOf(9, c);
    if ([2,11].includes(houseOf(l5, c))) { strength += 2; f.push({rule:'W-DY5', source:'BPHS Ch.19', verdict:'5th lord in 2nd or 11th → wealth through speculation, investments, children, or intelligence'}); }
    if ([2,11].includes(houseOf(l9, c))) { strength += 2; f.push({rule:'W-DY6', source:'BPHS Ch.19', verdict:'9th lord in 2nd or 11th → extreme fortune; wealth through dharma, father, or luck'}); sources.push('fortune and inheritance'); }

    // ── PLANETS IN 2ND HOUSE ──────────────────────────────────────────
    if (h2.includes('Jupiter')) { strength += 2; sources.push('wisdom and guidance'); f.push({rule:'W-JUP2', source:'BPHS Ch.19 v.15', verdict:'Jupiter in 2nd → blessed with wealth; income grows throughout life; generous with money; sweet speech'}); }
    if (h2.includes('Venus'))   { strength += 2; sources.push('luxury, beauty, arts'); f.push({rule:'W-VEN2', source:'Phaladeepika Ch.13 v.8', verdict:'Venus in 2nd → wealth through luxury goods, arts, beauty; enjoys material comforts; good food and pleasures'}); }
    if (h2.includes('Moon'))    { strength += 1; sources.push('public/trade'); f.push({rule:'W-MOON2', source:'BPHS', verdict:'Moon in 2nd → fluctuating income; wealth through public, trade, or mother; emotional relationship with money'}); }
    if (h2.includes('Mercury')) { sources.push('business, trade, communication'); f.push({rule:'W-MERC2', source:'BPHS', verdict:'Mercury in 2nd → wealth through business, communication, writing; multiple income streams; financial intelligence'}); }
    if (h2.includes('Mars'))    { sources.push('real estate, engineering, sports'); f.push({rule:'W-MARS2', source:'Saravali', verdict:'Mars in 2nd → wealth through real estate, engineering, or courage; aggressive earning approach; possible wasteful spending'}); }
    if (h2.includes('Sun'))     { sources.push('government, authority'); f.push({rule:'W-SUN2', source:'BPHS', verdict:'Sun in 2nd → income from government, authority figures, or father; wealth ebbs and flows with authority'}); }
    if (h2.includes('Saturn'))  { strength -= 1; f.push({rule:'W-SAT2', source:'BPHS', verdict:'Saturn in 2nd → slow, painstaking wealth accumulation; frugal nature; wealth in old age; possible food/speech issues'}); }
    if (h2.includes('Rahu'))    { f.push({rule:'W-RAHU2', source:'BPHS', verdict:'Rahu in 2nd → wealth through unconventional or foreign means; sudden gains and losses; appetite for wealth is insatiable'}); }
    if (h2.includes('Ketu'))    { strength -= 1; f.push({rule:'W-KETU2', source:'BPHS', verdict:'Ketu in 2nd → detachment from wealth; money comes and goes; spiritual approach to finances'}); }

    // ── PLANETS IN 11TH HOUSE ─────────────────────────────────────────
    if (h11.includes('Jupiter')) { strength += 2; f.push({rule:'W-JUP11', source:'BPHS', verdict:'Jupiter in 11th → multiple income sources; social gains; wealth through wise investments and connections'}); }
    if (h11.includes('Saturn'))  { strength += 1; f.push({rule:'W-SAT11', source:'BPHS Ch.19 v.22', verdict:'Saturn in 11th → steady, disciplined wealth accumulation; income from service, government, or real estate'}); }
    if (h11.includes('Venus'))   { strength += 1; f.push({rule:'W-VEN11', source:'BPHS', verdict:'Venus in 11th → gains from luxury goods, arts, entertainment, or women; social wealth'}); }
    if (h11.includes('Mars'))    { strength += 1; f.push({rule:'W-MARS11', source:'BPHS', verdict:'Mars in 11th → courageous wealth earning; gains from property, engineering, or competition'}); }

    // ── JUPITER STRENGTH AS WEALTH INDICATOR ─────────────────────────
    const jupStr = getPlanetStrength('Jupiter', jupiter.sign);
    if (jupStr === 'EXALTED') { strength += 2; f.push({rule:'W-JUPEX', source:'BPHS Ch.19 v.30', verdict:'Jupiter exalted → naturally wealthy; money flows easily; financial wisdom is innate'}); }
    if (jupStr === 'DEBILITATED') { strength -= 1; f.push({rule:'W-JUPDB', source:'BPHS', verdict:'Jupiter debilitated → wealth challenges; financial mistakes; overspending on unnecessary things'}); }

    // ── 2ND LORD IN 12TH ─────────────────────────────────────────────
    if (l2d && l2d.house === 12) { strength -= 2; f.push({rule:'W-L2IN12', source:'BPHS Ch.19 v.30', verdict:'2nd lord in 12th → wealth drains away through expenses; foreign spending; needs strict financial discipline'}); }

    // ── FINAL VERDICT ─────────────────────────────────────────────────
    if (strength >= 7) level = 'very wealthy';
    else if (strength >= 4) level = 'prosperous';
    else if (strength >= 2) level = 'comfortable';
    else if (strength >= 0) level = 'average';
    else if (strength <= -3) level = 'financial struggles';
    else level = 'below average';

    let verdict = `Financial level: ${level}. `;
    if (sources.length > 0) verdict += `Primary wealth sources: ${[...new Set(sources)].join(', ')}. `;

    return { verdict, level, strength, sources: [...new Set(sources)], confidence, rules: f };
  }

  // ─────────────────────────────────────────────────────────────
  // HEALTH — COMPLETE EDITION
  // BPHS Ch.8, Phaladeepika Ch.6, Saravali Ch.18
  // Body parts by house, planet-disease correlations
  // ─────────────────────────────────────────────────────────────
  evaluateHealth() {
    const { c } = this;
    const f = [];
    let constitution = 'average';
    let vulnerableAreas = [];
    let diseases = [];
    let confidence = 'MEDIUM';

    const h1 = planetsInHouse(1, c);
    const h6 = planetsInHouse(6, c);
    const h8 = planetsInHouse(8, c);
    const lagnaLord = lordOf(1, c);
    const lagnaLordData = c.planets[lagnaLord];
    const moon = c.planets['Moon'];
    const sun = c.planets['Sun'];
    const mars = c.planets['Mars'];
    const saturn = c.planets['Saturn'];

    // ── LAGNA STRENGTH ────────────────────────────────────────────────
    if (lagnaLordData) {
      const str = getPlanetStrength(lagnaLord, lagnaLordData.sign);
      if (str === 'EXALTED' || str === 'OWN') { constitution = 'strong'; confidence = 'HIGH'; f.push({rule:'H-LLSTR', source:'BPHS Ch.8 v.1', verdict:'Lagna lord strong → robust constitution; excellent immune system; quick recovery from illness'}); }
      if (str === 'DEBILITATED') { constitution = 'weak'; confidence = 'HIGH'; f.push({rule:'H-LLDB', source:'BPHS Ch.8 v.2', verdict:'Lagna lord debilitated → weak constitution; susceptible to recurring illness; needs proactive health care'}); }
    }

    // Malefics in lagna
    const maleficsInL = h1.filter(p => isMalefic(p));
    if (maleficsInL.length > 0 && !h1.includes('Jupiter') && !h1.includes('Venus')) {
      constitution = constitution === 'strong' ? 'average' : 'weak';
      f.push({rule:'H-MALL', source:'BPHS Ch.8 v.10', verdict:`Malefics (${maleficsInL.join('+')}) in lagna → health vulnerabilities throughout life; prone to injuries or inflammations`});
    }

    // ── BODY PARTS BY HOUSE/SIGN ───────────────────────────────────────
    // 1st house/Aries rules head; 2nd/Taurus face; etc.
    const houseBodyParts = {
      1:'head, brain, skull', 2:'face, eyes, throat, teeth, tongue, speech',
      3:'neck, shoulders, arms, hands, lungs, right ear',
      4:'chest, heart (outer), breasts, stomach',
      5:'upper abdomen, liver, heart, spine',
      6:'lower abdomen, intestines, kidneys, waist',
      7:'lower back, kidneys, ovaries, uterus',
      8:'reproductive organs, bladder, rectum, pelvis',
      9:'thighs, hips, arterial system, liver',
      10:'knees, joints, bones, teeth, skin (lower body)',
      11:'calves, ankles, circulation, veins',
      12:'feet, lymphatic system, immune system, sleep'
    };

    // Malefics in various houses → body part vulnerability
    for (const [houseNum, bodyPart] of Object.entries(houseBodyParts)) {
      const h = parseInt(houseNum);
      const pInH = planetsInHouse(h, c);
      const malInH = pInH.filter(p => isMalefic(p));
      if (malInH.length >= 2 && !anyBeneficAspectsHouse(h, c)) {
        vulnerableAreas.push(bodyPart);
        f.push({rule:`H-MAL${h}`, source:'BPHS Ch.8 v.15', verdict:`Multiple malefics in ${h}th house → vulnerability in ${bodyPart}`});
      }
    }

    // ── DISEASE SIGNIFICATORS ─────────────────────────────────────────
    // Per planet — classic disease associations
    const planetDisease = {
      Sun:'heart, eyes, bones, fever, skin diseases, pitta disorders',
      Moon:'mental health, blood, water retention, lungs, colds, kapha disorders',
      Mars:'blood, inflammation, accidents, surgery, fever, wounds, bile',
      Mercury:'nervous system, skin, speech disorders, respiratory, anxiety',
      Jupiter:'liver, obesity, diabetes, tumors, fatty disorders',
      Venus:'kidneys, reproductive organs, diabetes, venereal, urinary',
      Saturn:'chronic diseases, bones, joints, arthritis, depression, vata',
      Rahu:'mysterious diseases, allergies, poison, skin, addictions, nervous',
      Ketu:'intestines, parasites, spiritual ailments, accidents, mysterious fevers'
    };

    // Planets in 6th, 8th → their diseases may manifest
    for (const p of [...h6, ...h8]) {
      if (planetDisease[p]) {
        diseases.push(planetDisease[p]);
        f.push({rule:`H-${p}DUST`, source:'BPHS Ch.8', verdict:`${p} in 6th/8th → ${planetDisease[p]} — monitor these health areas`});
      }
    }

    // ── SATURN IN 8TH ─────────────────────────────────────────────────
    if (h8.includes('Saturn')) f.push({rule:'H-SAT8', source:'BPHS Ch.8 v.20', verdict:'Saturn in 8th → chronic conditions; long life despite illness; bones, joints, nerves vulnerable; longevity supported by Saturn as 8th karaka'});

    // ── JUPITER PROTECTION ────────────────────────────────────────────
    if (planetAspectsHouse('Jupiter', c, 1)) {
      constitution = constitution === 'weak' ? 'average' : constitution;
      f.push({rule:'H-JUPL1', source:'BPHS Ch.8 v.25', verdict:'Jupiter aspects lagna → strong protective influence on health; excellent recovery ability; natural immunity'});
    }

    // ── MARS RELATED (ACCIDENTS) ──────────────────────────────────────
    if ([6,8].includes(mars.house)) f.push({rule:'H-MARS68', source:'Phaladeepika Ch.6 v.12', verdict:`Mars in ${mars.house}th → risk of accidents, injuries, or surgical procedures especially during Mars periods or Sade Sati`});

    // ── MOON AFFLICTIONS (MENTAL HEALTH) ─────────────────────────────
    if (areConjunct('Saturn','Moon',c) || areConjunct('Rahu','Moon',c)) {
      diseases.push('depression, anxiety, mental disturbance');
      f.push({rule:'H-MOONAFF', source:'BPHS Ch.9 v.20', verdict:'Saturn or Rahu afflicts Moon → tendency toward depression, anxiety, mental health challenges; meditative practices beneficial'});
    }

    // ── 6TH LORD IN LAGNA ────────────────────────────────────────────
    const l6 = lordOf(6, c);
    if (c.planets[l6] && c.planets[l6].house === 1) f.push({rule:'H-L6L1', source:'BPHS Ch.8 v.30', verdict:'6th lord in lagna → chronic health concerns; health is a defining life theme; service/medical career also indicated'});

    let verdict = `Constitution: ${constitution}. `;
    if (vulnerableAreas.length > 0) verdict += `Vulnerable areas: ${[...new Set(vulnerableAreas)].join(', ')}. `;
    if (diseases.length > 0) verdict += `Areas to monitor: ${[...new Set(diseases)].slice(0,3).join('; ')}.`;

    return { verdict, constitution, vulnerableAreas: [...new Set(vulnerableAreas)], diseases: [...new Set(diseases)], confidence, rules: f };
  }

  // ─────────────────────────────────────────────────────────────
  // EDUCATION — BPHS Ch.22, Saravali
  // ─────────────────────────────────────────────────────────────
  evaluateEducation() {
    const { c } = this;
    const f = [];
    let level = 'standard';
    let fields = [];
    let confidence = 'MEDIUM';

    const h4 = planetsInHouse(4, c);
    const h5 = planetsInHouse(5, c);
    const mercury = c.planets['Mercury'];
    const jupiter = c.planets['Jupiter'];
    const l4 = lordOf(4, c);
    const l5 = lordOf(5, c);
    const l4d = c.planets[l4];
    const l5d = c.planets[l5];

    // Mercury strength
    const mercStr = getPlanetStrength('Mercury', mercury.sign);
    if (mercStr === 'EXALTED' || mercStr === 'OWN') { level = 'high'; f.push({rule:'E-MERCSTR', source:'BPHS Ch.22 v.3', verdict:'Mercury strong → sharp intellect, excellent academics; higher education very likely; good at mathematics, logic, writing'}); confidence = 'HIGH'; }
    if (mercStr === 'DEBILITATED') f.push({rule:'E-MERCDB', source:'BPHS', verdict:'Mercury debilitated → learning challenges; benefits from practical/vocational education more than academic'});

    // Jupiter in 5th
    if (h5.includes('Jupiter')) { level = 'advanced'; fields.push('philosophy','law','science','religion','teaching'); f.push({rule:'E-JUP5', source:'BPHS Ch.22 v.8', verdict:'Jupiter in 5th → scholarly, advanced education; PhD or equivalent possible; natural teacher'}); }

    // Mercury in 5th
    if (h5.includes('Mercury')) { level = level === 'standard' ? 'good' : level; fields.push('mathematics','IT','commerce','languages'); f.push({rule:'E-MERC5', source:'BPHS Ch.22', verdict:'Mercury in 5th → excellent intellect; business or technical education; multiple degrees possible'}); }

    // Sun in 5th
    if (h5.includes('Sun')) { fields.push('government studies','medicine','administration'); f.push({rule:'E-SUN5', source:'Saravali', verdict:'Sun in 5th → education connected to authority, government, or medical field; good at leadership studies'}); }

    // Moon in 5th
    if (h5.includes('Moon')) { fields.push('arts','nursing','history'); f.push({rule:'E-MOON5', source:'BPHS', verdict:'Moon in 5th → good memory, imaginative student; fluctuating academic interest; nurturing field education'}); }

    // Saturn in 5th — late but determined
    if (h5.includes('Saturn')) { fields.push('engineering','science','social sciences','history'); f.push({rule:'E-SAT5', source:'Saravali Ch.22', verdict:'Saturn in 5th → disciplined, structured learning; late academic success; engineering or technical sciences'}); }

    // Mars in 5th
    if (h5.includes('Mars')) { fields.push('sports','military','engineering','surgery'); f.push({rule:'E-MARS5', source:'BPHS', verdict:'Mars in 5th → competitive student; good in sports, military studies, surgery; technical field'}); }

    // Venus in 5th
    if (h5.includes('Venus')) { fields.push('arts','music','fashion','design'); f.push({rule:'E-VEN5', source:'BPHS', verdict:'Venus in 5th → artistic education; music, fine arts, design; creative subjects'}); }

    // Rahu in 5th
    if (h5.includes('Rahu')) { fields.push('technology','foreign studies','unconventional fields'); f.push({rule:'E-RAHU5', source:'BPHS', verdict:'Rahu in 5th → unconventional education; foreign studies; technology; breaks from traditional academic path'}); }

    // 4th lord in dusthana — education interrupted
    if (l4d && [6,8,12].includes(l4d.house)) f.push({rule:'E-L4DUST', source:'BPHS Ch.22 v.12', verdict:`4th lord in ${l4d.house}th → interruptions in formal education; may study independently, online, or abroad`});

    // Mercury-Jupiter connection
    if (areConjunct('Mercury','Jupiter',c) || planetAspectsHouse('Jupiter', c, mercury.house)) {
      level = 'advanced'; f.push({rule:'E-MERCJUP', source:'BPHS Ch.22', verdict:'Mercury-Jupiter connection → Saraswati Yoga possibility; exceptional learning; philosophical and technical knowledge combined'});
    }

    let verdict = `Education level: ${level}. `;
    if (fields.length > 0) verdict += `Suited fields: ${[...new Set(fields)].join(', ')}.`;
    return { verdict, level, fields: [...new Set(fields)], confidence, rules: f };
  }

  // ─────────────────────────────────────────────────────────────
  // FOREIGN TRAVEL/SETTLEMENT — BPHS Ch.26
  // ─────────────────────────────────────────────────────────────
  evaluateForeignTravel() {
    const { c } = this;
    const f = [];
    let likelihood = 'low';
    let settlement = false;
    let confidence = 'MEDIUM';

    const h12 = planetsInHouse(12, c);
    const h9 = planetsInHouse(9, c);
    const h3 = planetsInHouse(3, c); // short travel
    const l12 = lordOf(12, c);
    const l9 = lordOf(9, c);
    const l12d = c.planets[l12];
    const l9d = c.planets[l9];
    const rahu = c.planets['Rahu'];
    const moon = c.planets['Moon'];

    // Rahu in 12th, 9th, 7th, or 3rd
    if ([7,9,12].includes(rahu.house)) { likelihood = 'high'; confidence = 'HIGH'; f.push({rule:'FT-RAHU', source:'BPHS Ch.26 v.3', verdict:`Rahu in ${rahu.house}th → strong foreign connection; travel, residence, or work abroad very likely`}); }
    if (rahu.house === 3) f.push({rule:'FT-RAHU3', source:'BPHS', verdict:'Rahu in 3rd → frequent short-distance travel; possible foreign connection through communication or siblings'});

    // 12th lord in 9th → long-distance foreign
    if (l12d && l12d.house === 9) { likelihood = 'very high'; settlement = true; f.push({rule:'FT-L12IN9', source:'BPHS Ch.26 v.5', verdict:'12th lord in 9th → long-distance foreign travel; possible settlement abroad; spiritual journeys overseas'}); confidence = 'HIGH'; }
    if (l9d && l9d.house === 12) { likelihood = 'very high'; settlement = true; f.push({rule:'FT-L9IN12', source:'BPHS Ch.26 v.6', verdict:'9th lord in 12th → settlement or extended stay abroad; foreign education or work; fortune in foreign lands'}); confidence = 'HIGH'; }
    if (parivartana(9, 12, c)) { likelihood = 'certain'; settlement = true; confidence = 'HIGH'; f.push({rule:'FT-P912', source:'BPHS Ch.37', verdict:'9th-12th lord Parivartana → very strong foreign destiny; major portion of life spent abroad; fortune through foreign lands'}); }

    // Planets in 12th
    if (h12.includes('Moon')) f.push({rule:'FT-MOON12', source:'Saravali', verdict:'Moon in 12th → emotional connection with foreign lands; may live far from birthplace; overseas travel for emotional fulfilment'});
    if (h12.includes('Jupiter')) f.push({rule:'FT-JUP12', source:'BPHS', verdict:'Jupiter in 12th → foreign spiritual or educational journey; foreign settlement blessed; ashram or university abroad'});
    if (h12.includes('Venus')) f.push({rule:'FT-VEN12', source:'BPHS', verdict:'Venus in 12th → foreign travel for pleasure, arts, or romance; bed comforts in foreign land; possible foreign spouse'});
    if (h12.includes('Saturn')) f.push({rule:'FT-SAT12', source:'BPHS', verdict:'Saturn in 12th → foreign residence through work or service; possible imprisonment abroad; isolated foreign life'});
    if (h12.includes('Sun')) f.push({rule:'FT-SUN12', source:'BPHS', verdict:'Sun in 12th → father connected to foreign lands; or native works in government/authority abroad'});
    if (h12.includes('Mars')) f.push({rule:'FT-MARS12', source:'BPHS', verdict:'Mars in 12th → foreign travels involve adventure or conflict; military or technical work abroad; hospitalization abroad possible'});

    // Multiple planets in 12th
    if (h12.length >= 3) { likelihood = likelihood === 'low' ? 'medium' : likelihood; f.push({rule:'FT-H12MULT', source:'BPHS', verdict:`Multiple planets (${h12.join('+')}) in 12th → life strongly tied to foreign lands or isolation`}); }

    // Venus in 12th with strong 7th connection → foreign spouse
    if (h12.includes('Venus') && planetsInHouse(7, c).includes('Rahu')) f.push({rule:'FT-FOREIGN-SPOUSE', source:'Saravali', verdict:'Venus in 12th + Rahu in 7th → very strong foreign spouse indicator'});

    let verdict = `Foreign travel likelihood: ${likelihood}. `;
    if (settlement) verdict += 'Settlement or long-term stay abroad indicated. ';
    return { verdict, likelihood, settlement, confidence, rules: f };
  }

  // ─────────────────────────────────────────────────────────────
  // SPIRITUALITY — BPHS Ch.28, Uttara Kalamrita
  // ─────────────────────────────────────────────────────────────
  evaluateSpirituality() {
    const { c } = this;
    const f = [];
    let level = 'average';
    let path = [];
    let confidence = 'MEDIUM';

    const h9 = planetsInHouse(9, c);
    const h12 = planetsInHouse(12, c);
    const ketu = c.planets['Ketu'];
    const jupiter = c.planets['Jupiter'];
    const saturn = c.planets['Saturn'];

    if (h9.includes('Jupiter')) { level = 'high'; path.push('devotional','Vedic tradition','philosophical'); f.push({rule:'SP-JUP9', source:'BPHS Ch.28', verdict:'Jupiter in 9th → deeply religious and philosophical; natural teacher of dharma; blessed by gurus'}); confidence = 'HIGH'; }
    if (h12.includes('Ketu'))   { level = 'very high'; path.push('moksha-oriented','meditation','renunciation'); f.push({rule:'SP-KETU12', source:'BPHS Ch.28 v.8', verdict:'Ketu in 12th → moksha karaka in moksha house; liberation possible in this life; drawn to meditation, solitude, renunciation'}); confidence = 'HIGH'; }
    if (ketu.house === 9)       { path.push('past-life spiritual knowledge','innate wisdom'); f.push({rule:'SP-KETU9', source:'Uttara Kalamrita', verdict:'Ketu in 9th → brings spiritual wisdom from past lives; non-conventional spiritual path; may reject traditional religion'}); }
    if (ketu.house === 12)      { /* already covered */ }
    if (h9.includes('Saturn'))  { level = level === 'average' ? 'serious' : level; path.push('karma yoga','service'); f.push({rule:'SP-SAT9', source:'BPHS', verdict:'Saturn in 9th → serious, karmic approach to spirituality; dharma through work and service; late spiritual awakening'}); }
    if (h12.includes('Jupiter')){ level = 'high'; path.push('foreign spiritual tradition','ashram life'); f.push({rule:'SP-JUP12', source:'BPHS', verdict:'Jupiter in 12th → moksha orientation; foreign spiritual tradition; ashram or monastery connection; very spiritual in the bedroom (bed pleasures are also spiritual)'}); }
    if (h12.includes('Moon'))   { path.push('contemplative','inner journey'); f.push({rule:'SP-MOON12', source:'BPHS', verdict:'Moon in 12th → deep inner life; spiritual dreams; connection to hidden worlds; emotional spiritual seeking'}); }
    if (areConjunct('Jupiter','Ketu',c)) { level = 'very high'; path.push('Brahma Jnana','direct knowledge'); f.push({rule:'SP-JUPKETU', source:'UK', verdict:'Jupiter-Ketu conjunction → Brahma Jnana yoga; exceptional spiritual intelligence; intuitive access to divine knowledge'}); confidence = 'HIGH'; }
    if (h9.includes('Sun'))     { path.push('solar tradition','Vedic ritual'); f.push({rule:'SP-SUN9', source:'BPHS', verdict:'Sun in 9th → father is spiritual guide; Vedic or solar tradition; light-based spiritual practices'}); }
    if (h9.includes('Venus'))   { path.push('devotional love','bhakti'); f.push({rule:'SP-VEN9', source:'BPHS', verdict:'Venus in 9th → bhakti path; love-based spirituality; beauty and art as spiritual practice'}); }

    // Atmakaraka in 12th from Karakamsha — moksha indicator (Jaimini)
    if (c.atmakaraka && c.karakamsha) {
      const akHouse = houseOf(c.atmakaraka, c);
      // If AK is Ketu or placed in 12th from karakamsha
      if (c.atmakaraka === 'Ketu') { level = level === 'average' ? 'high' : 'very high'; f.push({rule:'SP-AKKETU', source:'Jaimini Sutram', verdict:'Ketu is Atmakaraka → soul yearns for moksha; spiritual liberation is the primary purpose of this incarnation'}); }
    }

    let verdict = `Spiritual inclination: ${level}. `;
    if (path.length > 0) verdict += `Path: ${[...new Set(path)].join(', ')}.`;
    return { verdict, level, path: [...new Set(path)], confidence, rules: f };
  }

  // ─────────────────────────────────────────────────────────────
  // LONGEVITY — BPHS Ch.8 Ayurdaya, Saravali
  // ─────────────────────────────────────────────────────────────
  evaluateLongevity() {
    const { c } = this;
    const f = [];
    let classification = 'medium'; // short<36, medium36-70, long>70
    let score = 0;
    let confidence = 'LOW'; // Longevity is complex, inherit low confidence

    const lagnaLord = lordOf(1, c);
    const lagnaLordData = c.planets[lagnaLord];
    const moon = c.planets['Moon'];
    const saturn = c.planets['Saturn'];
    const jupiter = c.planets['Jupiter'];
    const sun = c.planets['Sun'];

    // Lagna lord strength
    if (lagnaLordData) {
      const str = getPlanetStrength(lagnaLord, lagnaLordData.sign);
      if (str === 'EXALTED' || str === 'OWN') { score += 3; f.push({rule:'L-LLSTR', source:'BPHS Ch.8', verdict:'Lagna lord strong → excellent vitality; long life supported'}); }
      if (str === 'DEBILITATED') { score -= 2; f.push({rule:'L-LLDB', source:'BPHS Ch.8', verdict:'Lagna lord debilitated → vitality challenged; health care essential throughout life'}); }
      if (isInKendra(lagnaLord, c) || isInTrikona(lagnaLord, c)) { score += 1; f.push({rule:'L-LLKT', source:'BPHS Ch.8', verdict:'Lagna lord in kendra/trikona → life force is well-supported'}); }
    }

    // Moon strength
    const moonStr = getPlanetStrength('Moon', moon.sign);
    if (moonStr === 'EXALTED' || moonStr === 'OWN') { score += 2; f.push({rule:'L-MOONSTR', source:'BPHS Ch.8', verdict:'Moon strong → emotional vitality; immune system supported; mother\'s blessings protect life'}); }
    if (moonStr === 'DEBILITATED') { score -= 2; f.push({rule:'L-MOONDB', source:'BPHS Ch.8', verdict:'Moon debilitated → emotional and physical vitality reduced; mental health affects longevity'}); }

    // Jupiter (life giver — Jiva)
    const jupStr = getPlanetStrength('Jupiter', jupiter.sign);
    if (jupStr === 'EXALTED' || jupStr === 'OWN') { score += 3; f.push({rule:'L-JUPSTR', source:'BPHS Ch.8 v.5', verdict:'Jupiter strong → powerful life force; Jiva karaka is strong; long life highly probable'}); confidence = 'MEDIUM'; }
    if (jupStr === 'DEBILITATED') { score -= 2; f.push({rule:'L-JUPDB', source:'BPHS', verdict:'Jupiter debilitated → life force weakened; liver/immune system vulnerable; spiritual support important'}); }
    if (planetAspectsHouse('Jupiter', c, 1)) { score += 2; confidence = 'MEDIUM'; f.push({rule:'L-JUPL1', source:'BPHS Ch.8 v.20', verdict:'Jupiter aspects lagna → powerful longevity protection; divine grace supports life'}); }

    // Saturn in 8th (Ayushkaraka in longevity house)
    if (saturn.house === 8) { score += 2; confidence = 'MEDIUM'; f.push({rule:'L-SAT8', source:'BPHS Ch.8 v.15', verdict:'Saturn in 8th → long life despite health challenges; Ayushkaraka in own territory; chronic illness but great longevity'}); }
    if (isStrong('Saturn', saturn.sign)) { score += 1; f.push({rule:'L-SATSTR', source:'BPHS', verdict:'Saturn strong → karmic longevity; duty keeps person alive longer; bones and constitution are durable'}); }

    // 8th house — house of longevity
    const l8 = lordOf(8, c);
    const l8d = c.planets[l8];
    if (l8d) {
      const l8str = getPlanetStrength(l8, l8d.sign);
      if (l8str === 'EXALTED' || l8str === 'OWN') { score += 2; f.push({rule:'L-L8STR', source:'BPHS', verdict:'8th lord strong → longevity house is strong; long life supported'}); }
      if (l8str === 'DEBILITATED') { score -= 2; f.push({rule:'L-L8DB', source:'BPHS', verdict:'8th lord debilitated → longevity house weakened; chronic illness possible; take care of health'}); }
    }

    // Multiple malefics in lagna without benefic aspect
    const maleficsInL = planetsInHouse(1, c).filter(p => isMalefic(p));
    if (maleficsInL.length >= 2 && !anyBeneficAspectsHouse(1, c)) { score -= 2; f.push({rule:'L-MALLL', source:'BPHS Ch.8', verdict:'Multiple malefics in lagna without protection → constitution is weak; longevity requires care'}); }

    if (score >= 6) { classification = 'long (70+)'; confidence = 'MEDIUM'; }
    else if (score >= 3) { classification = 'medium-long (60-80)'; }
    else if (score >= 0) { classification = 'medium (50-70)'; }
    else if (score <= -3) { classification = 'short-medium (40-60)'; confidence = 'MEDIUM'; }
    else { classification = 'medium'; }

    let verdict = `Longevity indication: ${classification}. Note: Longevity requires full Ayurdaya calculation for precision. `;
    return { verdict, classification, score, confidence, rules: f };
  }

  // ─────────────────────────────────────────────────────────────
  // PROPERTY — BPHS Ch.20, Saravali
  // ─────────────────────────────────────────────────────────────
  evaluateProperty() {
    const { c } = this;
    const f = [];
    let likelihood = 'average';
    let type = [];
    let confidence = 'MEDIUM';

    const h4 = planetsInHouse(4, c);
    const l4 = lordOf(4, c);
    const l4d = c.planets[l4];
    const mars = c.planets['Mars']; // Karaka for property/land

    if (l4d) {
      const str = getPlanetStrength(l4, l4d.sign);
      if (str === 'EXALTED' || str === 'OWN') { likelihood = 'high'; confidence = 'HIGH'; f.push({rule:'PR-L4STR', source:'BPHS Ch.20 v.1', verdict:'4th lord strong → owns property, land, vehicles; comfortable home life; multiple properties possible'}); }
      if (str === 'DEBILITATED') { likelihood = 'low'; confidence = 'HIGH'; f.push({rule:'PR-L4DB', source:'BPHS Ch.20 v.3', verdict:'4th lord debilitated → difficulty owning property; rented accommodation; property disputes'}); }
      if (l4d.house === 11) { likelihood = 'high'; f.push({rule:'PR-L4IN11', source:'BPHS', verdict:'4th lord in 11th → multiple properties; gains from property'}); }
      if ([6,8,12].includes(l4d.house)) f.push({rule:'PR-L4DUST', source:'BPHS Ch.20', verdict:`4th lord in ${l4d.house}th → property disputes or losses; property abroad possible`});
    }

    const marsStr = getPlanetStrength('Mars', mars.sign);
    if (marsStr === 'EXALTED' || marsStr === 'OWN') { likelihood = 'high'; type.push('land','multiple plots'); f.push({rule:'PR-MARSSTR', source:'BPHS Ch.20 v.8', verdict:'Mars (land karaka) strong → multiple properties; land and real estate bring significant gains'}); }
    if (marsStr === 'DEBILITATED') f.push({rule:'PR-MARSDB', source:'BPHS', verdict:'Mars debilitated → property disputes; land issues; siblings may complicate property matters'});

    if (h4.includes('Jupiter'))  { type.push('large home','ancestral'); f.push({rule:'PR-JUP4', source:'BPHS Ch.20 v.12', verdict:'Jupiter in 4th → large, prosperous home; possible ancestral property; religious objects in home'}); likelihood = 'high'; }
    if (h4.includes('Venus'))    { type.push('beautiful home','artistic'); f.push({rule:'PR-VEN4', source:'BPHS', verdict:'Venus in 4th → beautiful, comfortable home; love of home decoration; artistic home environment'}); }
    if (h4.includes('Saturn'))   { type.push('old property','service residential'); f.push({rule:'PR-SAT4', source:'BPHS', verdict:'Saturn in 4th → property comes late; old or large property; property through hard work'}); }
    if (h4.includes('Mars'))     { type.push('land','construction'); f.push({rule:'PR-MARS4', source:'BPHS', verdict:'Mars in 4th → property through construction or land; disputes over property possible; ancestral land conflicts'}); }
    if (h4.includes('Sun'))      { type.push('government quarters'); f.push({rule:'PR-SUN4', source:'BPHS', verdict:'Sun in 4th → government accommodation; property through authority or father; prominent home'}); }

    // Parivartana 2nd-4th or 11th-4th
    if (parivartana(2, 4, c)) { likelihood = 'very high'; f.push({rule:'PR-P24', source:'BPHS', verdict:'2nd-4th lord Parivartana → very strong property yoga; wealth from real estate; family property grows'}); }
    if (parivartana(11, 4, c)) { likelihood = 'very high'; f.push({rule:'PR-P114', source:'BPHS', verdict:'11th-4th lord Parivartana → property brings enormous gains; multiple real estate assets'}); }

    let verdict = `Property ownership: ${likelihood}. `;
    if (type.length > 0) verdict += `Type: ${[...new Set(type)].join(', ')}.`;
    return { verdict, likelihood, type: [...new Set(type)], confidence, rules: f };
  }

  // ─────────────────────────────────────────────────────────────
  // LITIGATION & ENEMIES — BPHS Ch.21, Saravali Ch.32
  // ─────────────────────────────────────────────────────────────
  evaluateLitigation() {
    const { c } = this;
    const f = [];
    let risk = 'low';
    let confidence = 'MEDIUM';

    const h6 = planetsInHouse(6, c);
    const l6 = lordOf(6, c);
    const l6d = c.planets[l6];
    const mars = c.planets['Mars'];
    const rahu = c.planets['Rahu'];
    const saturn = c.planets['Saturn'];

    if (l6d) {
      if ([1,10].includes(l6d.house)) { risk = 'medium'; f.push({rule:'LT-L6H', source:'BPHS Ch.21 v.5', verdict:`6th lord in ${l6d.house}th → involvement in disputes, legal matters, or competitive conflicts throughout life`}); }
      if (l6d.house === 7) { risk = 'high'; f.push({rule:'LT-L6IN7', source:'BPHS Ch.21', verdict:'6th lord in 7th → litigation through marriage or partnership; legal battles involving spouse or business partner'}); }
      if (l6d.house === 6) { f.push({rule:'LT-L6OWN', source:'BPHS Ch.21 v.6', verdict:'6th lord in own house (6th) → enemies are many but weak and self-destroying; native overcomes all legal battles ultimately'}); }
    }

    // Mars + Saturn in 6th
    if (h6.includes('Mars') && h6.includes('Saturn')) { risk = 'high'; confidence = 'HIGH'; f.push({rule:'LT-MARSSAT6', source:'Saravali Ch.32', verdict:'Mars+Saturn in 6th → high risk of litigation, physical conflicts, and legal disputes'}); }
    if (h6.includes('Rahu')) f.push({rule:'LT-RAHU6', source:'BPHS Ch.21 v.8', verdict:'Rahu in 6th → enemies work through deception; unexpected legal battles; court cases from hidden enemies'});
    if (h6.includes('Mars')) f.push({rule:'LT-MARS6', source:'BPHS', verdict:'Mars in 6th → active in fighting enemies; courage to win battles; also risk of creating new enemies'});
    if (h6.includes('Sun')) f.push({rule:'LT-SUN6', source:'BPHS', verdict:'Sun in 6th → government-related disputes possible; conflicts with authority; wins over enemies through authority'});

    // 6th-8th lords connection
    const l8 = lordOf(8, c);
    if (houseOf(l6, c) === 8 || houseOf(l8, c) === 6) f.push({rule:'LT-68', source:'BPHS Ch.21', verdict:'6th-8th house connection → sudden unexpected legal troubles; accidents involving enemies; need for proactive legal protection'});

    let verdict = `Litigation risk: ${risk}. `;
    return { verdict, risk, confidence, rules: f };
  }

  evaluateEnemies() {
    const { c } = this;
    const f = [];
    let level = 'few';
    let confidence = 'MEDIUM';

    const h6 = planetsInHouse(6, c);
    const l6 = lordOf(6, c);
    const l6d = c.planets[l6];

    if (l6d && l6d.house === 6) { level = 'self-defeating'; confidence = 'HIGH'; f.push({rule:'EN-L6OWN', source:'BPHS Ch.21 v.5', verdict:'6th lord in own house → enemies are many but destroy themselves; native ultimately prevails over all adversaries'}); }
    if (h6.includes('Jupiter')) { level = 'defeated'; f.push({rule:'EN-JUP6', source:'BPHS Ch.21 v.10', verdict:'Jupiter in 6th → defeats all enemies through wisdom and dharma; legal matters resolve favorably; enemies become friends eventually'}); }
    if (h6.includes('Mars')) { level = 'defeated'; f.push({rule:'EN-MARS6', source:'Saravali', verdict:'Mars in 6th → courageous enemy-defeater; wins through direct confrontation; excellent for military/police'}); }
    if (h6.includes('Saturn')) f.push({rule:'EN-SAT6', source:'BPHS', verdict:'Saturn in 6th → enemies are slow to act but persistent; native must be patient; wins through endurance'});
    if (h6.includes('Sun')) f.push({rule:'EN-SUN6', source:'BPHS', verdict:'Sun in 6th → enemies in government or authority; wins through personal authority and reputation'});
    if (h6.includes('Rahu')) f.push({rule:'EN-RAHU6', source:'BPHS', verdict:'Rahu in 6th → hidden, deceptive enemies; foreign or unusual adversaries; wins through cunning'});
    if (h6.includes('Ketu')) f.push({rule:'EN-KETU6', source:'BPHS', verdict:'Ketu in 6th → karmic enemies; enemies from past life; spiritual practice dissolves enemy power'});
    if (h6.includes('Venus')) f.push({rule:'EN-VEN6', source:'BPHS', verdict:'Venus in 6th → enemies among women or lovers; disputes in partnerships; wins through charm and diplomacy'});

    let verdict = `Enemy situation: ${level}. `;
    return { verdict, level, confidence, rules: f };
  }

  // ─────────────────────────────────────────────────────────────
  // COMMUNICATION & SPEECH — BPHS Ch.7 (2nd house)
  // ─────────────────────────────────────────────────────────────
  evaluateCommunication() {
    const { c } = this;
    const f = [];
    let speechQuality = 'normal';
    let confidence = 'MEDIUM';

    const h2 = planetsInHouse(2, c);
    const l2 = lordOf(2, c);
    const l2d = c.planets[l2];
    const mercury = c.planets['Mercury'];

    if (h2.includes('Jupiter')) { speechQuality = 'eloquent'; f.push({rule:'COM-JUP2', source:'BPHS Ch.7', verdict:'Jupiter in 2nd → eloquent, authoritative speech; naturally persuasive; voice is commanding'}); }
    if (h2.includes('Venus'))   { speechQuality = 'charming'; f.push({rule:'COM-VEN2', source:'BPHS Ch.7', verdict:'Venus in 2nd → charming, melodious voice; sweet speech; skills in music or singing possible'}); }
    if (h2.includes('Mercury')) { speechQuality = 'witty'; f.push({rule:'COM-MERC2', source:'BPHS', verdict:'Mercury in 2nd → witty, quick speech; excellent communicator; may speak multiple languages'}); }
    if (h2.includes('Saturn'))  { f.push({rule:'COM-SAT2', source:'BPHS', verdict:'Saturn in 2nd → slow, careful speech; measured words; may have speech impediment or stutter; deep authoritative voice in old age'}); }
    if (h2.includes('Rahu'))    { f.push({rule:'COM-RAHU2', source:'BPHS', verdict:'Rahu in 2nd → unusual speech; may tell untruths; foreign accent or language; magnetic but not always trustworthy speech'}); }
    if (h2.includes('Ketu'))    { f.push({rule:'COM-KETU2', source:'BPHS', verdict:'Ketu in 2nd → sharp, cutting speech; sometimes abrupt or spiritually focused; may be terse'}); }
    if (h2.includes('Mars'))    { f.push({rule:'COM-MARS2', source:'BPHS', verdict:'Mars in 2nd → harsh, direct speech; confrontational communication style; risk of hasty words causing conflicts'}); }

    if (l2d && isStrong(l2, l2d.sign)) f.push({rule:'COM-L2STR', source:'BPHS', verdict:'2nd lord strong → good family values; wealth through speech; eloquent and persuasive'});

    const mercStr = getPlanetStrength('Mercury', mercury.sign);
    if (mercStr === 'EXALTED' || mercStr === 'OWN') f.push({rule:'COM-MERCSTR', source:'BPHS', verdict:'Mercury strong → exceptional communication ability; writer, speaker, or teacher; multilingual possible'});

    let verdict = `Speech quality: ${speechQuality}. `;
    return { verdict, quality: speechQuality, confidence, rules: f };
  }

  // ─────────────────────────────────────────────────────────────
  // YOGAS — Complete major yoga detection
  // BPHS Ch.35-43, Phaladeepika, Saravali
  // ─────────────────────────────────────────────────────────────
  evaluateYogas() {
    const { c } = this;
    const f = [];
    const yogas = [];

    // ── PANCHA MAHAPURUSHA YOGAS ─────────────────────────────────────
    // BPHS Ch.36: Planet in own sign or exaltation in kendra
    const mahapurushaInfo = {
      Mars:    {name:'Ruchaka', nature:'Military power, courage, authority, physical prowess, commander'},
      Mercury: {name:'Bhadra',  nature:'Intelligence, business acumen, communication, wealth through intellect'},
      Jupiter: {name:'Hamsa',   nature:'Wisdom, teaching, spirituality, health, respected by all'},
      Venus:   {name:'Malavya', nature:'Beauty, wealth, luxury, artistic talent, happy marriage'},
      Saturn:  {name:'Sasha',   nature:'Authority, discipline, real estate, service, long life, justice'}
    };
    for (const [planet, info] of Object.entries(mahapurushaInfo)) {
      const pData = c.planets[planet];
      if (!pData) continue;
      const str = getPlanetStrength(planet, pData.sign);
      if ((str === 'EXALTED' || str === 'OWN') && KENDRAS.includes(pData.house)) {
        yogas.push({name: info.name + ' Mahapurusha Yoga', strength:'STRONG', planet});
        f.push({rule:`Y-${info.name.toUpperCase()}`, source:'BPHS Ch.36', verdict:`${info.name} Mahapurusha Yoga (${planet} in kendra, ${str}) → ${info.nature}`});
      }
    }

    // ── GAJA KESARI YOGA ─────────────────────────────────────────────
    // BPHS: Jupiter in kendra from Moon
    const moon = c.planets['Moon'];
    const jupiter = c.planets['Jupiter'];
    if (moon && jupiter) {
      const moonToJup = ((jupiter.house - moon.house + 12) % 12) + 1;
      if ([1,4,7,10].includes(moonToJup)) {
        yogas.push({name:'Gaja Kesari Yoga', strength:'STRONG', planet:'Jupiter+Moon'});
        f.push({rule:'Y-GAJAKESARI', source:'BPHS Ch.40', verdict:'Gaja Kesari Yoga (Jupiter in kendra from Moon) → wealthy, famous, intelligent; blessed like an elephant-lion; long life; good reputation'});
      }
    }

    // ── BUDHA-ADITYA YOGA ────────────────────────────────────────────
    // Mercury + Sun conjunct
    if (areConjunct('Mercury','Sun',c)) {
      const mercSunHouse = c.planets['Mercury'].house;
      // Strong if in good houses, weak if in dusthana
      const strength = DUSTHANAS.includes(mercSunHouse) ? 'MODERATE' : 'STRONG';
      yogas.push({name:'Budha-Aditya Yoga', strength, planet:'Mercury+Sun'});
      f.push({rule:'Y-BUDHADITYA', source:'Phaladeepika Ch.6', verdict:`Budha-Aditya Yoga (Mercury conjunct Sun) → intelligent, learned, respected; government connections; recognized in society (${strength})`});
    }

    // ── LAKSHMI YOGA ─────────────────────────────────────────────────
    // 9th lord in own sign or exaltation AND lagna lord strong
    const l9 = lordOf(9, c);
    const l9d = c.planets[l9];
    const lagnaLord = lordOf(1, c);
    const lagnaLordData = c.planets[lagnaLord];
    if (l9d && isStrong(l9, l9d.sign) && lagnaLordData && isStrong(lagnaLord, lagnaLordData.sign)) {
      yogas.push({name:'Lakshmi Yoga', strength:'STRONG', planet:l9});
      f.push({rule:'Y-LAKSHMI', source:'Phaladeepika Ch.6', verdict:'Lakshmi Yoga (9th lord strong + lagna lord strong) → great wealth and fame; blessed by Goddess Lakshmi; fortunate in all endeavors'});
    }

    // ── SARASWATI YOGA ───────────────────────────────────────────────
    // Jupiter, Venus, Mercury all in kendra/trikona
    const mercH = c.planets['Mercury'] ? c.planets['Mercury'].house : null;
    const venH  = c.planets['Venus']   ? c.planets['Venus'].house   : null;
    const jupH  = c.planets['Jupiter'] ? c.planets['Jupiter'].house : null;
    if (mercH && venH && jupH) {
      const goodHouses = [...KENDRAS, 2];
      if (goodHouses.includes(mercH) && goodHouses.includes(venH) && goodHouses.includes(jupH)) {
        yogas.push({name:'Saraswati Yoga', strength:'STRONG', planet:'Mercury+Venus+Jupiter'});
        f.push({rule:'Y-SARASWATI', source:'Phaladeepika Ch.6', verdict:'Saraswati Yoga (Mercury+Venus+Jupiter in kendras/2nd) → exceptional learning, arts, and creativity; renowned scholar or artist'});
      }
    }

    // ── VIPARITA RAJA YOGA ───────────────────────────────────────────
    // Lords of 6, 8, 12 in dusthanas
    const l6 = lordOf(6, c); const l8 = lordOf(8, c); const l12 = lordOf(12, c);
    const l6d = c.planets[l6]; const l8d = c.planets[l8]; const l12d = c.planets[l12];
    let viparitaCount = 0;
    if (l6d && DUSTHANAS.includes(l6d.house)) viparitaCount++;
    if (l8d && DUSTHANAS.includes(l8d.house)) viparitaCount++;
    if (l12d && DUSTHANAS.includes(l12d.house)) viparitaCount++;
    if (viparitaCount >= 2) {
      yogas.push({name:'Viparita Raja Yoga', strength:'STRONG', planet:'Dusthana lords'});
      f.push({rule:'Y-VIPARITA', source:'BPHS Ch.41', verdict:'Viparita Raja Yoga (dusthana lords in dusthanas) → rise from adversity; success after failures; enemies destroy themselves; kingdom gained through others\' misfortune'});
    }

    // ── NEECHA BHANGA RAJA YOGA ──────────────────────────────────────
    // Debilitated planet cancelled → becomes powerful Raja Yoga
    for (const [planet, sign] of Object.entries(DEBILITATION)) {
      const pData = c.planets[planet];
      if (!pData || pData.sign !== sign) continue;
      // Cancellation: lord of debilitation sign in kendra from lagna or moon
      const debSignLord = getHouseLord(0, sign + 1); // lord of the debilitation sign
      const debLordData = c.planets[debSignLord];
      if (debLordData && (isInKendra(debSignLord, c) || planetAspectsHouse(debSignLord, c, c.lagna))) {
        yogas.push({name:'Neecha Bhanga Raja Yoga', strength:'STRONG', planet});
        f.push({rule:`Y-NBR-${planet}`, source:'BPHS Ch.39', verdict:`Neecha Bhanga Raja Yoga for ${planet} → debilitation cancelled; ${planet}'s areas of life rise dramatically after initial struggles; powerful achievement after delays`});
      }
    }

    // ── KEMADRUMA YOGA ───────────────────────────────────────────────
    // Moon with no planets on either side (2nd and 12th from Moon empty)
    const moonHouse = moon.house;
    const h2fromMoon = house(moonHouse + 1);
    const h12fromMoon = house(moonHouse - 1);
    const planetsAround = [...planetsInHouse(h2fromMoon, c), ...planetsInHouse(h12fromMoon, c)]
      .filter(p => !['Rahu','Ketu'].includes(p));
    if (planetsAround.length === 0) {
      yogas.push({name:'Kemadruma Yoga', strength:'WEAK_MODIFIER', planet:'Moon'});
      f.push({rule:'Y-KEMADRUMA', source:'BPHS Ch.42', verdict:'Kemadruma Yoga (Moon alone with no flanking planets) → periods of loneliness, mental instability, or lack of support; requires strong lagna to overcome'});
    }

    // ── KAAL SARPA YOGA ──────────────────────────────────────────────
    // All planets between Rahu and Ketu (in direction of Rahu to Ketu)
    const rahuH = c.planets['Rahu'].house;
    const ketuH = c.planets['Ketu'].house;
    const otherPlanets = ['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn']
      .map(p => c.planets[p].house);
    const ksDirection1 = Array.from({length:6}, (_,i) => house(rahuH + i + 1));
    const allInDirection1 = otherPlanets.every(h => ksDirection1.includes(h));
    const ksDirection2 = Array.from({length:6}, (_,i) => house(ketuH + i + 1));
    const allInDirection2 = otherPlanets.every(h => ksDirection2.includes(h));
    if (allInDirection1 || allInDirection2) {
      yogas.push({name:'Kaal Sarpa Yoga', strength:'POWERFUL_MODIFIER', planet:'Rahu+Ketu'});
      f.push({rule:'Y-KAALSARPA', source:'BPHS (classical reference)', verdict:'Kaal Sarpa Yoga (all planets hemmed between Rahu-Ketu) → karmic life; struggle then breakthrough; extraordinary destiny; Rahu-Ketu axis controls fate'});
    }

    // ── SADE SATI (if pre-computed) ───────────────────────────────────
    if (c.sadeSati && c.sadeSati.inSati) {
      f.push({rule:'Y-SADESATI', source:'Classical transit rule', verdict:`Sade Sati active (${c.sadeSati.phase} phase) → Saturn over Moon sign; period of karmic learning, responsibility, and transformation; not all negative — deep life lessons`});
    }

    // ── ADHI YOGA ────────────────────────────────────────────────────
    // Benefics in 6, 7, 8 from Moon
    const h6fromMoon = house(moonHouse + 5);
    const h7fromMoon = house(moonHouse + 6);
    const h8fromMoon = house(moonHouse + 7);
    const beneficsIn678Moon = [...planetsInHouse(h6fromMoon,c), ...planetsInHouse(h7fromMoon,c), ...planetsInHouse(h8fromMoon,c)]
      .filter(p => isBenefic(p));
    if (beneficsIn678Moon.length >= 2) {
      yogas.push({name:'Adhi Yoga', strength:'STRONG', planet: beneficsIn678Moon.join('+')});
      f.push({rule:'Y-ADHI', source:'BPHS Ch.38', verdict:`Adhi Yoga (${beneficsIn678Moon.join('+')} in 6/7/8 from Moon) → happy, prosperous, long-lived; protected from enemies; leadership qualities`});
    }

    // ── MANGAL DOSHA ─────────────────────────────────────────────────
    const marsH = c.planets['Mars'].house;
    if ([1,2,4,7,8,12].includes(marsH)) {
      const cancelledHouses = {
        1: c.lagna === 0 || c.lagna === 7, // Aries or Scorpio lagna
        4: false, 7: false, 8: false, 12: false, 2: false
      };
      f.push({rule:'Y-MANGALDOSHA', source:'BPHS Ch.81', verdict:`Mars in ${marsH}th → Mangal Dosha active; affects marriage; partner must also have Mars in 1,2,4,7,8,12 OR specific cancellation rule applies`});
    }

    // ── GAURI YOGA ───────────────────────────────────────────────────
    // Moon+Jupiter+Venus all strong — rare combination
    if (moon && jupiter && c.planets['Venus']) {
      if (isStrong('Moon',moon.sign) && isStrong('Jupiter',jupiter.sign) && isStrong('Venus',c.planets['Venus'].sign)) {
        yogas.push({name:'Gauri Yoga', strength:'STRONG', planet:'Moon+Jupiter+Venus'});
        f.push({rule:'Y-GAURI', source:'Phaladeepika Ch.6', verdict:'Gauri Yoga (Moon+Jupiter+Venus all strong) → virtuous, wealthy, beautiful, spiritually blessed life; exceptional feminine grace (male or female native)'});
      }
    }

    // ── RAJA YOGA (GENERIC KENDRA-TRIKONA) ───────────────────────────
    // Lord of kendra conjunct lord of trikona
    const kendraLords = [1,4,7,10].map(h => lordOf(h, c));
    const trikonaLords = [5,9].map(h => lordOf(h, c));
    for (const kl of kendraLords) {
      for (const tl of trikonaLords) {
        if (kl === tl) continue; // same planet can't form with itself
        if (areConjunct(kl, tl, c)) {
          yogas.push({name:`Raja Yoga (${kl}+${tl})`, strength:'STRONG', planet:`${kl}+${tl}`});
          f.push({rule:`Y-RAJAYOGA-${kl}-${tl}`, source:'BPHS Ch.34', verdict:`Raja Yoga: ${kl} (kendra lord) + ${tl} (trikona lord) conjunct → wealth, power, fame; life elevates to high social position`});
        }
        if (houseOf(kl, c) === houseOf(tl, c)) continue; // already caught by conjunct
        // Mutual aspect
        if (planetAspectsHouse(kl, c, c.planets[tl]?.house) && planetAspectsHouse(tl, c, c.planets[kl]?.house)) {
          yogas.push({name:`Raja Yoga Aspect (${kl}+${tl})`, strength:'MODERATE', planet:`${kl}+${tl}`});
          f.push({rule:`Y-RAJAYOGAAS-${kl}-${tl}`, source:'BPHS Ch.34', verdict:`Raja Yoga via mutual aspect: ${kl}+${tl} → significant achievement; moderate life elevation`});
        }
      }
    }

    // ── DHANA YOGA SUMMARY ───────────────────────────────────────────
    const l2 = lordOf(2, c); const l11 = lordOf(11, c);
    if (areConjunct(l2, l11, c) || parivartana(2, 11, c)) {
      yogas.push({name:'Dhana Yoga', strength:'STRONG', planet:`${l2}+${l11}`});
      f.push({rule:'Y-DHANAYOGA', source:'BPHS Ch.19', verdict:'Dhana Yoga (2nd+11th lord connection) → significant wealth accumulation in life; financially very successful'});
    }

    const summary = `${yogas.length} yogas detected: ${yogas.map(y => y.name).join(', ')}`;
    return { summary, yogas, rules: f };
  }

  // ─────────────────────────────────────────────────────────────
  // DASHA RESULTS — Current period analysis
  // BPHS Ch.45-50, Phala Deepika
  // ─────────────────────────────────────────────────────────────
  evaluateDashaResults() {
    const { c } = this;
    const f = [];
    if (!c.dasha) return { verdict:'Dasha data not provided', rules: f };

    const { maha, antar, pratyantar } = c.dasha;

    // Mahadasha results by planet — BPHS Ch.45
    const mahaResults = {
      Sun:'Career and authority peak; father matters important; government connections; health of right eye; bones',
      Moon:'Emotional life focus; mother matters; home, property; travel; public popularity; mind and mental health',
      Mars:'Energy, action, real estate; siblings; accidents possible; courage; career in competitive fields',
      Mercury:'Business, communication, education; writing; trade; short travels; intellect highlighted',
      Jupiter:'Great fortune; teacher/guru connection; children; marriage; wisdom; spiritual growth; liver',
      Venus:'Wealth; marriage; pleasures; arts; vehicles; luxury; female relationships; kidneys',
      Saturn:'Hard work; karma; obstacles then rewards; service; old age concerns; bones/joints; property',
      Rahu:'Worldly ambitions; foreign travel; technology; unconventional paths; deception; illnesses of confusion',
      Ketu:'Spiritual growth; past karma resolution; mysterious illnesses; research; isolation; moksha'
    };

    if (mahaResults[maha]) {
      f.push({rule:'D-MAHA', source:'BPHS Ch.45', verdict:`${maha} Mahadasha: ${mahaResults[maha]}`});
    }

    // Maha-Antar combined results (key combinations from classical texts)
    const dashaConflict = (
      (maha === 'Sun'  && antar === 'Saturn') || (maha === 'Saturn' && antar === 'Sun') ||
      (maha === 'Moon' && antar === 'Rahu')   || (maha === 'Rahu'   && antar === 'Moon')
    );
    const dashaBenefic = (
      (maha === 'Jupiter' && antar === 'Venus') ||
      (maha === 'Venus'   && antar === 'Jupiter') ||
      (maha === 'Moon'    && antar === 'Jupiter')
    );

    if (dashaConflict) f.push({rule:'D-CONFLICT', source:'BPHS Ch.45', verdict:`${maha}-${antar} is a tense combination → inner conflict; health issues; relationship strain; careful navigation required`});
    if (dashaBenefic) f.push({rule:'D-BENEFIC', source:'BPHS Ch.45', verdict:`${maha}-${antar} is a highly benefic combination → prosperity, joy, marriage, wealth, spiritual growth; very auspicious`});

    // Planet owning good/bad houses in the chart
    const mahaLordHouses = (chart => {
      const planet = maha;
      const houses = Object.keys(chart.houseLords || {}).filter(h => chart.houseLords[h] === planet).map(Number);
      return houses;
    })(c);

    if (mahaLordHouses.includes(9) || mahaLordHouses.includes(5)) {
      f.push({rule:'D-TRIKONA', source:'BPHS Ch.46', verdict:`${maha} rules a trikona (5th or 9th) → Mahadasha brings fortune, blessings, and spiritual growth`});
    }
    if (mahaLordHouses.includes(10) || mahaLordHouses.includes(1)) {
      f.push({rule:'D-KENDRA', source:'BPHS Ch.46', verdict:`${maha} rules a kendra (1st or 10th) → career growth, public recognition, and authority in this dasha`});
    }
    if (mahaLordHouses.some(h => DUSTHANAS.includes(h))) {
      f.push({rule:'D-DUSTHANA', source:'BPHS Ch.46', verdict:`${maha} rules a dusthana (6/8/12) → dasha brings health issues, obstacles, or karmic debts; needs remedies`});
    }

    // Strength of dasha planet
    const pData = c.planets[maha];
    if (pData) {
      const str = getPlanetStrength(maha, pData.sign);
      if (str === 'EXALTED') f.push({rule:'D-MAHAEX', source:'BPHS Ch.45 v.15', verdict:`${maha} is exalted → Mahadasha brings exceptionally positive results; maximum expression of this planet's gifts`});
      if (str === 'DEBILITATED') f.push({rule:'D-MAHADB', source:'BPHS Ch.45 v.16', verdict:`${maha} is debilitated → Mahadasha has more challenges; planet's area of life requires extra effort`});
    }

    const verdict = `Current period: ${maha}-${antar}${pratyantar ? '-'+pratyantar : ''}. ${f[0]?.verdict || ''}`;
    return { verdict, maha, antar, pratyantar, rules: f };
  }

} // END CLASS

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = { VedicRulesEngine, getPlanetStrength, planetsInHouse, getHouseLord, SIGNS, DASHA_YEARS, DASHA_SEQ };

/**
 * INTEGRATION EXAMPLE FOR chart.js:
 *
 * const { VedicRulesEngine } = require('./vedic-rules-engine-v2');
 *
 * // After computing chart with Swiss Ephemeris:
 * const chart = {
 *   lagna: computedLagnaSign,       // 0-11
 *   lagnaLord: 'Venus',
 *   gender: 'M',
 *   atmakaraka: 'Jupiter',          // planet with highest degrees
 *   darakaraka: 'Venus',            // planet with lowest degrees
 *   amatyakaraka: 'Mercury',        // 2nd highest degrees (Jaimini)
 *   planets: {
 *     Sun:     { sign: 9, house: 9, degree: 15 },
 *     Moon:    { sign: 5, house: 5, degree: 22, longitude: 175.5 },
 *     Mars:    { sign: 3, house: 3, degree: 8 },
 *     Mercury: { sign: 9, house: 9, degree: 2 },
 *     Jupiter: { sign: 1, house: 1, degree: 18 },
 *     Venus:   { sign: 10, house: 10, degree: 5 },
 *     Saturn:  { sign: 1, house: 1, degree: 25 },
 *     Rahu:    { sign: 11, house: 11, degree: 12 },
 *     Ketu:    { sign: 5, house: 5, degree: 12 }
 *   },
 *   houseLords: { 1:'Venus', 2:'Mercury', ... 12:'Mars' },
 *   dasha: { maha:'Saturn', antar:'Jupiter', pratyantar:'Venus', mahaEnd:2030 },
 *   navamsha: { planets: { ... } },
 *   sadeSati: { inSati: false, phase: null }
 * };
 *
 * const engine = new VedicRulesEngine(chart);
 * const results = engine.evaluate();
 *
 * // Feed results to Claude — it only writes, not decides:
 * const prompt = `
 *   Write a beautiful, warm, specific reading for this person.
 *   Use ONLY these pre-computed verdicts — do not add your own astrology:
 *
 *   MARRIAGE: ${results.marriage.verdict}
 *   Marriage type: ${results.marriage.type}
 *   Spouse: ${results.marriage.spouseDesc.join(', ')}
 *
 *   SIBLINGS: ${results.siblings.verdict}
 *   FATHER: ${results.father.verdict}
 *   CAREER: ${results.career.verdict}
 *   WEALTH: ${results.wealth.verdict}
 *   HEALTH: ${results.health.verdict}
 *   YOGAS: ${results.yogas.summary}
 *   CURRENT DASHA: ${results.dashaResults.verdict}
 *
 *   Writing rules:
 *   - Speak directly to "you"
 *   - No Sanskrit in body text
 *   - No hedging ("may", "might", "could") — state the verdict directly
 *   - Each paragraph = one life area
 *   - Tone: wise friend, not fortune teller
 * `;
 */
