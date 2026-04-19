// api/ephemeris.js — Shared ephemeris engine for NatalAI.live
// Used by chart.js, varshpal.js, vedic-engine.js
// Meeus algorithms + JPL approximations, Lahiri ayanamsa

'use strict';

// ─── CORE MATH ────────────────────────────────────────────────────────────────
const R = Math.PI / 180, D = 180 / Math.PI;
const n360 = x => ((x % 360) + 360) % 360;

function JD(y, mo, d, h) {
  if (mo <= 2) { y--; mo += 12; }
  const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (mo + 1)) + d + h / 24 + B - 1524.5;
}
function JDtoCal(jd) {
  const z = Math.floor(jd + .5), f = (jd + .5) - z;
  let A = z;
  if (z >= 2299161) { const a = Math.floor((z - 1867216.25) / 36524.25); A = z + 1 + a - Math.floor(a / 4); }
  const B = A + 1524, C = Math.floor((B - 122.1) / 365.25), DD = Math.floor(365.25 * C), E = Math.floor((B - DD) / 30.6001);
  const day = B - DD - Math.floor(30.6001 * E), mo = E < 14 ? E - 1 : E - 13, yr = mo > 2 ? C - 4716 : C - 4715;
  const h = f * 24, hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  return { year: yr, month: mo, day, hour: hh, minute: mm };
}
const TC = j => (j - 2451545) / 36525;
const eps = j => { const t = TC(j); return 23.4393 - 0.013004 * t; };
const GMST = j => { const t = TC(j); return n360(280.46061837 + 360.98564736629 * (j - 2451545) + 3.87933e-4 * t * t); };
const ayanamsa = j => 23.85 + (j - 2451545) * 50.29 / 1314900; // Lahiri

// ─── PLANET POSITIONS ─────────────────────────────────────────────────────────
function sunLon(j) {
  const t = TC(j), L0 = n360(280.46646 + 36000.76983 * t), M = n360(357.52911 + 35999.05029 * t), Mr = M * R;
  const C = (1.914602 - 0.004817 * t) * Math.sin(Mr) + (0.019993 - 1.01e-4 * t) * Math.sin(2 * Mr);
  return n360(L0 + C - 0.00569 - 0.00478 * Math.sin((125.04 - 1934.136 * t) * R));
}
function moonLon(j) {
  const t = TC(j), t2 = t * t, t3 = t2 * t, t4 = t3 * t;
  const Lp = n360(218.3164477 + 481267.88123421 * t - 1.5786e-3 * t2 + t3 / 538841 - t4 / 65194000);
  const Dv = n360(297.8501921 + 445267.1114034 * t - 1.8819e-3 * t2);
  const Mv = n360(357.5291092 + 35999.0502909 * t);
  const Mp = n360(134.9633964 + 477198.8675055 * t + 8.7414e-3 * t2);
  const Fv = n360(93.2720950 + 483202.0175233 * t);
  const E = 1 - 2.516e-3 * t, E2 = E * E;
  const T = [[0,0,1,0,6288774],[2,0,-1,0,1274027],[2,0,0,0,658314],[0,0,2,0,213618],[0,1,0,0,-185116],[0,0,0,2,-114332],[2,0,-2,0,58793],[2,-1,-1,0,57066],[2,0,1,0,53322],[2,-1,0,0,45758],[0,1,-1,0,-40923],[1,0,0,0,-34720],[0,1,1,0,-30383],[2,0,0,-2,15327],[0,0,1,-2,10980],[4,0,-1,0,10675],[0,0,3,0,10034],[4,0,-2,0,8548],[2,1,-1,0,-7888],[2,1,0,0,-6766],[2,-1,1,0,4036],[2,0,2,0,3994],[4,0,0,0,3861]];
  let s = 0;
  for (const [dv, m, mp, fv, c] of T) {
    const a = (dv * Dv + m * Mv + mp * Mp + fv * Fv) * R;
    let cf = c;
    if (Math.abs(m) === 1) cf *= E;
    if (Math.abs(m) === 2) cf *= E2;
    s += cf * Math.sin(a);
  }
  return n360(Lp + s / 1e6);
}
const rahuLon = j => { const t = TC(j); return n360(125.0445479 - 1934.1362608 * t + 2.0754e-3 * t * t); };

const EL = {
  Mercury:[.38709927,3.7e-5,.20563593,1.906e-5,7.00497902,-5.9475e-3,252.25032350,149472.67411175,77.45779628,.16047689,48.33076593,-.12534081],
  Venus:  [.72333566,3.9e-5,.00677672,-4.107e-5,3.39467605,-7.889e-4,181.97909950,58517.81538729,131.60246718,2.6833e-3,76.67984255,-.27769418],
  Earth:  [1.00000261,5.62e-5,.01671123,-4.392e-5,-1.531e-5,-.01294668,100.46457166,35999.37244981,102.93768193,.32327364,0,0],
  Mars:   [1.52371034,1.847e-5,.09339410,7.882e-5,1.84969142,-8.1313e-3,-4.55343205,19140.30268499,-23.94362959,.44441088,49.55953891,-.29257343],
  Jupiter:[5.20288700,-1.1607e-4,.04838624,-1.3253e-4,1.30439695,-1.8371e-3,34.39644051,3034.74612775,14.72847983,.21252668,100.47390909,.20469106],
  Saturn: [9.53667594,-1.2506e-3,.05386179,-5.0991e-4,2.48599187,1.9361e-3,49.95424423,1222.49362201,92.59887831,-.41897216,113.66242448,-.28867794]
};
function keplSolve(M, e) {
  let E = M;
  for (let i = 0; i < 50; i++) { const dE = (M - E + e * Math.sin(E)) / (1 - e * Math.cos(E)); E += dE; if (Math.abs(dE) < 1e-11) break; }
  return E;
}
function helioXYZ(t, el) {
  const a0=el[0],da=el[1],e0=el[2],de=el[3],i0=el[4],di=el[5],L0=el[6],dL=el[7],w0=el[8],dw=el[9],N0=el[10],dN=el[11];
  const a=a0+da*t, e=e0+de*t, I=(i0+di*t)*R, L=n360(L0+dL*t)*R, w=n360(w0+dw*t)*R, N=n360(N0+dN*t)*R;
  const om=w-N, M=n360((L-w)*D)*R, Ev=keplSolve(M,e), xp=a*(Math.cos(Ev)-e), yp=a*Math.sqrt(1-e*e)*Math.sin(Ev);
  const cN=Math.cos(N),sN=Math.sin(N),cI=Math.cos(I),sI=Math.sin(I),cO=Math.cos(om),sO=Math.sin(om);
  return { x:(cN*cO-sN*sO*cI)*xp+(-cN*sO-sN*cO*cI)*yp, y:(sN*cO+cN*sO*cI)*xp+(-sN*sO+cN*cO*cI)*yp, z:sO*sI*xp+cO*sI*yp };
}
function planetLon(j, nm) {
  const t = TC(j), p = helioXYZ(t, EL[nm]), e = helioXYZ(t, EL.Earth);
  return n360(Math.atan2(p.y - e.y, p.x - e.x) * D);
}
function calcLagna(j, lat, lon) {
  const LST = n360(GMST(j) + lon) * R, e = eps(j) * R, phi = lat * R;
  return n360(Math.atan2(Math.cos(LST), -(Math.sin(LST) * Math.cos(e) + Math.sin(e) * Math.tan(phi))) * D);
}
function computeChart(y, mo, d, h, mi, tz, lat, lon) {
  const utH = h + mi / 60 - tz, j = JD(y, mo, d, utH), ay = ayanamsa(j);
  const trop = { Sun:sunLon(j), Moon:moonLon(j), Mercury:planetLon(j,'Mercury'), Venus:planetLon(j,'Venus'), Mars:planetLon(j,'Mars'), Jupiter:planetLon(j,'Jupiter'), Saturn:planetLon(j,'Saturn'), Rahu:rahuLon(j), Ketu:n360(rahuLon(j)+180) };
  const sid = {};
  for (const [k, v] of Object.entries(trop)) sid[k] = n360(v - ay);
  return { sid, lagna: n360(calcLagna(j, lat, lon) - ay), jde: j, ay };
}

// ─── VEDIC TABLES ─────────────────────────────────────────────────────────────
const RS  = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
const RSH = ['Ari','Tau','Gem','Can','Leo','Vir','Lib','Sco','Sag','Cap','Aqu','Pis'];
const NK  = ['Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra','Punarvasu','Pushya','Ashlesha','Magha','Purva Phalguni','Uttara Phalguni','Hasta','Chitra','Swati','Vishakha','Anuradha','Jyeshtha','Mula','Purva Ashadha','Uttara Ashadha','Shravana','Dhanishtha','Shatabhisha','Purva Bhadrapada','Uttara Bhadrapada','Revati'];
const NL  = ['Ke','Ve','Su','Mo','Ma','Ra','Ju','Sa','Me','Ke','Ve','Su','Mo','Ma','Ra','Ju','Sa','Me','Ke','Ve','Su','Mo','Ma','Ra','Ju','Sa','Me'];
const DY  = { Ke:7, Ve:20, Su:6, Mo:10, Ma:7, Ra:18, Ju:16, Sa:19, Me:17 };
const DS  = ['Ke','Ve','Su','Mo','Ma','Ra','Ju','Sa','Me'];
const FN  = { Ke:'Ketu', Ve:'Venus', Su:'Sun', Mo:'Moon', Ma:'Mars', Ra:'Rahu', Ju:'Jupiter', Sa:'Saturn', Me:'Mercury' };
const SL  = ['Ma','Ve','Me','Mo','Su','Me','Ve','Ma','Ju','Sa','Sa','Ju']; // sign lords 0=Aries..11=Pisces

// ─── HELPER FUNCTIONS ─────────────────────────────────────────────────────────
const so  = l => Math.floor(n360(l) / 30);          // sign index 0-11
const no  = l => Math.floor(n360(l) / (360 / 27));  // nakshatra index 0-26
const po  = l => Math.floor((n360(l) % (360 / 27)) / (360 / 108)) + 1; // pada 1-4
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtYr = y => { const yr = Math.floor(y), mo = Math.floor((y - yr) * 12); return `${MONTHS[mo]} ${yr}`; };
const fmtDt = c => `${c.day.toString().padStart(2,'0')} ${MONTHS[c.month-1]} ${c.year}`;
const fmtDeg = lon => { const d = Math.floor(lon % 30), m = Math.floor((lon % 1) * 60); return `${d}°${m.toString().padStart(2,'0')}'`; };

// Planet dignity tables [exalt_sign, debil_sign, own_signs...]
const DIGNITY = {
  Sun:     { exalt:0,  debil:6,  own:[4],       mool:4  },  // Aries exalt, Libra debil, Leo own
  Moon:    { exalt:1,  debil:7,  own:[3],       mool:1  },  // Taurus exalt, Scorpio debil, Cancer own
  Mars:    { exalt:9,  debil:3,  own:[0,7],     mool:0  },  // Capricorn exalt, Cancer debil, Aries/Scorpio own
  Mercury: { exalt:5,  debil:11, own:[2,5],     mool:5  },  // Virgo exalt, Pisces debil, Gemini/Virgo own
  Jupiter: { exalt:3,  debil:9,  own:[8,11],    mool:8  },  // Cancer exalt, Capricorn debil, Sagittarius/Pisces own
  Venus:   { exalt:11, debil:5,  own:[1,6],     mool:6  },  // Pisces exalt, Virgo debil, Taurus/Libra own
  Saturn:  { exalt:6,  debil:0,  own:[9,10],    mool:10 },  // Libra exalt, Aries debil, Capricorn/Aquarius own
  Rahu:    { exalt:1,  debil:7,  own:[],        mool:3  },  // Taurus exalt, Scorpio debil (varies by text)
  Ketu:    { exalt:7,  debil:1,  own:[],        mool:9  },  // Scorpio exalt, Taurus debil
};

function getPlanetStrength(planet, signIdx, degInSign) {
  const dg = DIGNITY[planet];
  if (!dg) return { status: 'neutral', score: 3 };
  if (signIdx === dg.exalt) return { status: 'Exalted', score: 6 };
  if (signIdx === dg.debil) return { status: 'Debilitated', score: 1 };
  if (dg.own.includes(signIdx)) {
    if (signIdx === dg.mool) return { status: 'Mool Trikona', score: 5 };
    return { status: 'Own Sign', score: 5 };
  }
  // Friendly/enemy signs (simplified)
  const FRIENDS = {
    Sun:     [0,3,4,8],   // Aries, Cancer, Leo, Sagittarius
    Moon:    [1,3,4],     // Taurus, Cancer, Leo
    Mars:    [3,4,8,9],   // Cancer, Leo, Sagittarius, Capricorn
    Mercury: [1,5,6,10],  // Taurus, Virgo, Libra, Aquarius
    Jupiter: [0,3,4,7,8], // Aries, Cancer, Leo, Scorpio, Sagittarius
    Venus:   [1,6,9,10],  // Taurus, Libra, Capricorn, Aquarius
    Saturn:  [1,5,6,9,10],// Taurus, Virgo, Libra, Capricorn, Aquarius
    Rahu:    [1,2,6],
    Ketu:    [7,8,9],
  };
  const ENEMIES = {
    Sun:     [6,10,11],   // Libra, Aquarius, Pisces
    Moon:    [7,10],
    Mars:    [1,2,5,6],
    Mercury: [4,7,8],
    Jupiter: [1,2,5,6,10],
    Venus:   [3,4,7,8],
    Saturn:  [0,3,4,7,8],
    Rahu:    [0,3,4],
    Ketu:    [1,2,3],
  };
  if ((FRIENDS[planet]||[]).includes(signIdx)) return { status: 'Friendly Sign', score: 4 };
  if ((ENEMIES[planet]||[]).includes(signIdx)) return { status: 'Enemy Sign', score: 2 };
  return { status: 'Neutral', score: 3 };
}

// Combustion (planet too close to Sun)
const COMBUST_ORB = { Moon:12, Mars:17, Mercury:14, Jupiter:11, Venus:10, Saturn:15 };
function isCombust(planet, planetLon, sunLon) {
  if (!COMBUST_ORB[planet]) return false;
  let diff = Math.abs(n360(planetLon) - n360(sunLon));
  if (diff > 180) diff = 360 - diff;
  return diff <= COMBUST_ORB[planet];
}

// Retrograde periods (simplified — planets are retrograde ~these % of time)
// We use actual computation from chart data

// Dasha engine
function getDasha(moonLon, y, mo, d) {
  const nak = no(moonLon), lord = NL[nak], nakLen = 360 / 27;
  const frac = (n360(moonLon) % nakLen) / nakLen;
  const bd = y + (mo - 1) / 12 + (d - 1) / 365.25;
  const fs = bd - frac * DY[lord];
  const idx = DS.indexOf(lord);
  let seq = [], c = fs;
  for (let i = 0; i < 9; i++) { const dk = DS[(idx + i) % 9]; seq.push({ lord: dk, start: c, end: c + DY[dk] }); c += DY[dk]; }
  const NOW = new Date().getFullYear() + new Date().getMonth() / 12;
  return { nak, nakName: NK[nak], lord, seq, curr: seq.find(s => s.start <= NOW && s.end > NOW) };
}
function getAntardashas(mahaLord, mahaStart, mahaEnd) {
  const totalYrs = mahaEnd - mahaStart, idx = DS.indexOf(mahaLord);
  const NOW = new Date().getFullYear() + new Date().getMonth() / 12;
  let cursor = mahaStart;
  return DS.map((_, i) => {
    const al = DS[(idx + i) % 9], dur = totalYrs * DY[al] / 120, s = cursor, e = cursor + dur;
    cursor = e;
    return { lord: al, lordName: FN[al], start: s, end: e, curr: s <= NOW && e > NOW };
  });
}
function getPratyantardashas(antarLord, antarStart, antarEnd) {
  const totalYrs = antarEnd - antarStart, idx = DS.indexOf(antarLord);
  const NOW = new Date().getFullYear() + new Date().getMonth() / 12;
  let cursor = antarStart;
  return DS.map((_, i) => {
    const pl = DS[(idx + i) % 9], dur = totalYrs * DY[pl] / 120, s = cursor, e = cursor + dur;
    cursor = e;
    return { lord: pl, lordName: FN[pl], start: s, end: e, curr: s <= NOW && e > NOW };
  });
}

module.exports = {
  R, D, n360, JD, JDtoCal, TC, eps, GMST, ayanamsa,
  sunLon, moonLon, rahuLon, planetLon, calcLagna, computeChart,
  EL, keplSolve, helioXYZ,
  RS, RSH, NK, NL, DY, DS, FN, SL, MONTHS,
  so, no, po, fmtYr, fmtDt, fmtDeg,
  DIGNITY, getPlanetStrength, isCombust, COMBUST_ORB,
  getDasha, getAntardashas, getPratyantardashas
};
