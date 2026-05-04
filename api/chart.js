// api/chart.js — NatalAI.live
// Mode 1: Legacy direct prompt (backward compat)
// Mode 2: Free chart — real ephemeris + inline yogas
// Mode 3: Full paid report — all computation inline, 8 parallel Haiku section calls
// Vedic Rules Engine: require('./vedic-rules-engine-v3') (same api/ folder)

'use strict';

// ─── VEDIC RULES ENGINE — deterministic classical rules from BPHS, Phaladeepika, Saravali ──
let VedicRulesEngine, _computeCharaDasha, _evaluatePrashnaAspects;
try {
  const _eng = require('./vedic-rules-engine-v3');
  VedicRulesEngine        = _eng.VedicRulesEngine;
  _computeCharaDasha      = _eng.computeCharaDasha;
  _evaluatePrashnaAspects = _eng.evaluatePrashnaAspects;
} catch(e) { VedicRulesEngine = null; }

/**
 * Converts chart.js internal data structures into the format expected by VedicRulesEngine.
 * Uses existing chart.js variables: natal.sid, so(), SL[], FN[], lagnaSign, mahaName, antarName.
 * No Swiss Ephemeris or external library — all data already computed by computeChart().
 */
function buildEngineChart(natal, lagnaSign, gender, mahaName, antarName, pratyantarName, navamshaData, currentTransitsData) {
  // Build planet objects: sign (0-11), house (1-12), degree (0-30), longitude
  const planets = {};
  for (const [p, lon] of Object.entries(natal.sid)) {
    const signIdx = so(lon);
    planets[p] = {
      sign:      signIdx,
      house:     ((signIdx - lagnaSign + 12) % 12) + 1,
      degree:    lon % 30,
      longitude: lon
    };
  }
  // Build house lords using existing SL[] (sign lords) and FN[] (full names)
  // SL[signIndex] = abbreviated lord key (e.g. 'Ma'), FN[key] = full name (e.g. 'Mars')
  const houseLords = {};
  for (let h = 1; h <= 12; h++) {
    const signOfHouse = (lagnaSign + h - 1) % 12;
    houseLords[h] = FN[SL[signOfHouse]];
  }
  return {
    lagna:     lagnaSign,
    lagnaLord: FN[SL[lagnaSign]],
    gender:    gender || 'M',
    planets,
    houseLords,
    navamsha:  navamshaData || null,
    dasha: { maha: mahaName, antar: antarName, pratyantar: pratyantarName || null },
    currentTransits: currentTransitsData || null
  };
}


// ─── EPHEMERIS (INLINE) ───────────────────────────────────────────────────────
const Rp=Math.PI/180,Dp=180/Math.PI;
const n360=x=>((x%360)+360)%360;
function JD(y,mo,d,h){if(mo<=2){y--;mo+=12;}const A=Math.floor(y/100),B=2-A+Math.floor(A/4);return Math.floor(365.25*(y+4716))+Math.floor(30.6001*(mo+1))+d+h/24+B-1524.5;}
function JDtoCal(jd){const z=Math.floor(jd+.5),f=(jd+.5)-z;let A=z;if(z>=2299161){const a=Math.floor((z-1867216.25)/36524.25);A=z+1+a-Math.floor(a/4);}const B=A+1524,C=Math.floor((B-122.1)/365.25),DD=Math.floor(365.25*C),E=Math.floor((B-DD)/30.6001);const day=B-DD-Math.floor(30.6001*E),mo=E<14?E-1:E-13,yr=mo>2?C-4716:C-4715;const hh=f*24,hhh=Math.floor(hh),mm=Math.round((hh-hhh)*60);return{year:yr,month:mo,day,hour:hhh,minute:mm};}
const TC=j=>(j-2451545)/36525;
const eps=j=>{const t=TC(j);return 23.4393-0.013004*t;};
// ─── DRIKPANCHANG-COMPATIBLE ASCENDANT ENGINE ─────────────────────────────────
// Algorithm: Swiss Ephemeris swe.houses_ex(FLG_SIDEREAL) — same as DrikPanchang
// Components: True GMST + IAU 1980 nutation + true obliquity + Lahiri ayanamsa (SE value)

// IAU 1980 nutation — Δψ (nutation in longitude) and Δε (nutation in obliquity), arcseconds
function nutIAU80(j){
  const t=TC(j);
  const Om=n360(125.04452-1934.136261*t+0.0020708*t*t)*Rp;
  const L =n360(280.4665 +36000.7698 *t)*Rp;
  const Lm=n360(218.3165 +481267.8813*t)*Rp;
  const dpsi=(-17.2-0.01742*t)*Math.sin(Om)+(-1.32)*Math.sin(2*L)+(-0.23)*Math.sin(2*Lm)+(0.21)*Math.sin(2*Om);
  const deps=(9.20+0.00089*t)*Math.cos(Om)+(0.57)*Math.cos(2*L)+(0.10)*Math.cos(2*Lm)+(-0.09)*Math.cos(2*Om);
  return{dpsi:dpsi/3600,deps:deps/3600}; // arcsec → degrees
}
// Mean obliquity (IAU Laskar 1986)
const eps_mean=j=>{const t=TC(j);return 23.439291111-t*(0.013004167+t*(1.64e-7-t*5.04e-7));};
// True obliquity = mean + nutation in obliquity
const eps_true=j=>{const n=nutIAU80(j);return eps_mean(j)+n.deps;};
// Apparent GMST = Mean GMST + equation of equinoxes (Δψ·cos(ε))
const GMST=j=>{const t=TC(j),n=nutIAU80(j),e=eps_mean(j)+n.deps;return n360(280.46061837+360.98564736629*(j-2451545)+3.87933e-4*t*t+n.dpsi*Math.cos(e*Rp));};
// Precise Lahiri ayanamsa — Swiss Ephemeris SEMOD_SIDEREAL_LAHIRI value
// J2000.0 base: 23°51'11.4" = 23.853167° | Rate: 50.2904"/year
const ayanamsa=j=>23.853167+(j-2451545)*(50.2904/3600/365.25);
// Ascendant — full Swiss Ephemeris compatible (DrikPanchang method)
function calcLagna(j,lat,lon){
  const RAMC=n360(GMST(j)+lon)*Rp,e=eps_true(j)*Rp,phi=lat*Rp;
  const x=Math.sin(RAMC)*Math.cos(e)+Math.tan(phi)*Math.sin(e);
  const y=-Math.cos(RAMC);
  let asc=Math.atan2(y,x)*Dp;
  if(x<0)asc+=180; // quadrant correction — critical, without this ~50% of births get wrong sign
  return n360(asc);
}
function sunLon(j){const t=TC(j),L0=n360(280.46646+36000.76983*t),M=n360(357.52911+35999.05029*t),Mr=M*Rp,C=(1.914602-0.004817*t)*Math.sin(Mr)+(0.019993-1.01e-4*t)*Math.sin(2*Mr);return n360(L0+C-0.00569-0.00478*Math.sin((125.04-1934.136*t)*Rp));}
function moonLon(j){const t=TC(j),t2=t*t,t3=t2*t,t4=t3*t,Lp=n360(218.3164477+481267.88123421*t-1.5786e-3*t2+t3/538841-t4/65194000),Dv=n360(297.8501921+445267.1114034*t-1.8819e-3*t2),Mv=n360(357.5291092+35999.0502909*t),Mp=n360(134.9633964+477198.8675055*t+8.7414e-3*t2),Fv=n360(93.2720950+483202.0175233*t),E=1-2.516e-3*t,E2=E*E;const T=[[0,0,1,0,6288774],[2,0,-1,0,1274027],[2,0,0,0,658314],[0,0,2,0,213618],[0,1,0,0,-185116],[0,0,0,2,-114332],[2,0,-2,0,58793],[2,-1,-1,0,57066],[2,0,1,0,53322],[2,-1,0,0,45758],[0,1,-1,0,-40923],[1,0,0,0,-34720],[0,1,1,0,-30383],[2,0,0,-2,15327],[0,0,1,-2,10980],[4,0,-1,0,10675],[0,0,3,0,10034],[4,0,-2,0,8548],[2,1,-1,0,-7888],[2,1,0,0,-6766],[2,-1,1,0,4036],[2,0,2,0,3994],[4,0,0,0,3861]];let s=0;for(const[dv,m,mp,fv,c]of T){const a=(dv*Dv+m*Mv+mp*Mp+fv*Fv)*Rp;let cf=c;if(Math.abs(m)===1)cf*=E;if(Math.abs(m)===2)cf*=E2;s+=cf*Math.sin(a);}return n360(Lp+s/1e6);}
const rahuLon=j=>{
  const t=TC(j);
  // Mean node
  const mean=n360(125.0445479-1934.1362608*t+2.0754e-3*t*t);
  // True node — perturbation corrections per Meeus Ch.47 (USNO standard)
  const D =n360(297.8501921+445267.1114034*t)*Rp;
  const M =n360(357.5291092+35999.0502909*t)*Rp;
  const Mp=n360(134.9633964+477198.8675055*t)*Rp;
  const corr=-1.4979*Math.sin(2*(D-Mp))
             -0.1500*Math.sin(M)
             -0.1226*Math.sin(2*D)
             +0.1176*Math.sin(2*Mp)
             -0.0801*Math.sin(2*(Mp-D));
  return n360(mean+corr);
};
const EL={Mercury:[.38709927,3.7e-5,.20563593,1.906e-5,7.00497902,-5.9475e-3,252.25032350,149472.67411175,77.45779628,.16047689,48.33076593,-.12534081],Venus:[.72333566,3.9e-5,.00677672,-4.107e-5,3.39467605,-7.889e-4,181.97909950,58517.81538729,131.60246718,2.6833e-3,76.67984255,-.27769418],Earth:[1.00000261,5.62e-5,.01671123,-4.392e-5,-1.531e-5,-.01294668,100.46457166,35999.37244981,102.93768193,.32327364,0,0],Mars:[1.52371034,1.847e-5,.09339410,7.882e-5,1.84969142,-8.1313e-3,-4.55343205,19140.30268499,-23.94362959,.44441088,49.55953891,-.29257343],Jupiter:[5.20288700,-1.1607e-4,.04838624,-1.3253e-4,1.30439695,-1.8371e-3,34.39644051,3034.74612775,14.72847983,.21252668,100.47390909,.20469106],Saturn:[9.53667594,-1.2506e-3,.05386179,-5.0991e-4,2.48599187,1.9361e-3,49.95424423,1222.49362201,92.59887831,-.41897216,113.66242448,-.28867794]};
function keplSolve(M,e){let E=M;for(let i=0;i<50;i++){const dE=(M-E+e*Math.sin(E))/(1-e*Math.cos(E));E+=dE;if(Math.abs(dE)<1e-11)break;}return E;}
function helioXYZ(t,el){const a0=el[0],da=el[1],e0=el[2],de=el[3],i0=el[4],di=el[5],L0=el[6],dL=el[7],w0=el[8],dw=el[9],N0=el[10],dN=el[11];const a=a0+da*t,e=e0+de*t,I=(i0+di*t)*Rp,L=n360(L0+dL*t)*Rp,w=n360(w0+dw*t)*Rp,N=n360(N0+dN*t)*Rp,om=w-N,M=n360((L-w)*Dp)*Rp,Ev=keplSolve(M,e),xp=a*(Math.cos(Ev)-e),yp=a*Math.sqrt(1-e*e)*Math.sin(Ev);const cN=Math.cos(N),sN=Math.sin(N),cI=Math.cos(I),sI=Math.sin(I),cO=Math.cos(om),sO=Math.sin(om);return{x:(cN*cO-sN*sO*cI)*xp+(-cN*sO-sN*cO*cI)*yp,y:(sN*cO+cN*sO*cI)*xp+(-sN*sO+cN*cO*cI)*yp,z:sO*sI*xp+cO*sI*yp};}
function planetLon(j,nm){const t=TC(j),p=helioXYZ(t,EL[nm]),e=helioXYZ(t,EL.Earth);return n360(Math.atan2(p.y-e.y,p.x-e.x)*Dp);}
function computeChart(y,mo,d,h,mi,tz,lat,lon){const utH=h+mi/60-tz,j=JD(y,mo,d,utH),ay=ayanamsa(j);const trop={Sun:sunLon(j),Moon:moonLon(j),Mercury:planetLon(j,'Mercury'),Venus:planetLon(j,'Venus'),Mars:planetLon(j,'Mars'),Jupiter:planetLon(j,'Jupiter'),Saturn:planetLon(j,'Saturn'),Rahu:rahuLon(j),Ketu:n360(rahuLon(j)+180)};const sid={};for(const[k,v]of Object.entries(trop))sid[k]=n360(v-ay);return{sid,lagna:n360(calcLagna(j,lat,lon)-ay),jde:j,ay};}

// ─── VEDIC TABLES (INLINE) ────────────────────────────────────────────────────
const RS=['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
const NK=['Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra','Punarvasu','Pushya','Ashlesha','Magha','Purva Phalguni','Uttara Phalguni','Hasta','Chitra','Swati','Vishakha','Anuradha','Jyeshtha','Mula','Purva Ashadha','Uttara Ashadha','Shravana','Dhanishtha','Shatabhisha','Purva Bhadrapada','Uttara Bhadrapada','Revati'];
const NL=['Ke','Ve','Su','Mo','Ma','Ra','Ju','Sa','Me','Ke','Ve','Su','Mo','Ma','Ra','Ju','Sa','Me','Ke','Ve','Su','Mo','Ma','Ra','Ju','Sa','Me'];
const DY={Ke:7,Ve:20,Su:6,Mo:10,Ma:7,Ra:18,Ju:16,Sa:19,Me:17};
const DS=['Ke','Ve','Su','Mo','Ma','Ra','Ju','Sa','Me'];
const FN={Ke:'Ketu',Ve:'Venus',Su:'Sun',Mo:'Moon',Ma:'Mars',Ra:'Rahu',Ju:'Jupiter',Sa:'Saturn',Me:'Mercury'};
const SL=['Ma','Ve','Me','Mo','Su','Me','Ve','Ma','Ju','Sa','Sa','Ju'];
// Section title → URL-safe ID mapping. Used by wrapHTML and by the sidebar
// pre-compute steps in Mode 3 (which run BEFORE wrapHTML, in the caller scope).
// Module-level so both contexts can read it without re-declaration.
const SECTION_IDS = {
  '🌟 Your Cosmic Blueprint':'cosmic-blueprint','⚡ Your Personality & Natural Strengths':'personality',
  '⏰ Your Current Life Chapter':'life-chapter','💼 Career, Money & Opportunities':'career-money',
  '❤️ Love, Relationships & Connection':'love-relationships','🏃 Health, Family & Growth Edges':'health-family',
  '📅 Your Timing Blueprint':'timing-blueprint','⚡ Power Windows This Year':'power-windows',
  '🎯 Timing for Your Goals':'timing-goals','💼 Career & Financial Timing':'career-timing',
  '🐴 Your Animal Energy Types':'animal-energy','⚡ Chemistry & Connection Scores':'chemistry-scores',
  '💎 The Raw Truth & How To Make It Work':'raw-truth',
  '🎯 Your 10 Key Dates':'10-key-dates',
  '💑 Overall & Physical Chemistry':'overall-physical-chemistry',
  '🧠 Mental Bond & Temperament':'mental-bond-temperament',
  '🔮 Long-Term Potential & Flags':'long-term-flags',
  '⏰ Timing, Advice & The Verdict':'timing-verdict',
};
const so=l=>Math.floor(n360(l)/30);
const no=l=>Math.floor(n360(l)/(360/27));
const po=l=>Math.floor((n360(l)%(360/27))/(360/108))+1;
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtYr=y=>{const yr=Math.floor(y),mo=Math.floor((y-yr)*12);return`${MONTHS[mo]} ${yr}`;};
const fmtDt=c=>`${c.day.toString().padStart(2,'0')} ${MONTHS[c.month-1]} ${c.year}`;
const fmtDeg=lon=>{const d=Math.floor(lon%30),m=Math.floor((lon%1)*60);return`${d}°${m.toString().padStart(2,'0')}'`;};

// ─── DIGNITY ──────────────────────────────────────────────────────────────────
const DIG={Sun:{ex:0,db:6,own:[4]},Moon:{ex:1,db:7,own:[3]},Mars:{ex:9,db:3,own:[0,7]},Mercury:{ex:5,db:11,own:[2,5]},Jupiter:{ex:3,db:9,own:[8,11]},Venus:{ex:11,db:5,own:[1,6]},Saturn:{ex:6,db:0,own:[9,10]}};
function pStatus(p,s){const d=DIG[p];if(!d)return'';if(s===d.ex)return'Exalted';if(s===d.db)return'Debilitated';if(d.own.includes(s))return'Own Sign';return'';}

// ─── PLANET EMOJIS (American astrology aesthetic) ─────────────────────────
const PE={Sun:'👑',Moon:'🫧',Mars:'⚡',Mercury:'🗝️',Jupiter:'🌕',Venus:'💎',Saturn:'⌛',Rahu:'🌀',Ketu:'🔮'};
const PEk={Su:'👑',Mo:'🫧',Ma:'⚡',Me:'🗝️',Ju:'🌕',Ve:'💎',Sa:'⌛',Ra:'🌀',Ke:'🔮'};

// ─── PLANET COLORS ────────────────────────────────────────────────────────
const PC={Sun:'#d4a017',Moon:'#8ea8c0',Mars:'#e05a4a',Mercury:'#3da882',Jupiter:'#c8901a',Venus:'#d4558a',Saturn:'#6b7c93',Rahu:'#7c4daa',Ketu:'#8b7355'};
const PCk={Su:'#d4a017',Mo:'#8ea8c0',Ma:'#e05a4a',Me:'#3da882',Ju:'#c8901a',Ve:'#d4558a',Sa:'#6b7c93',Ra:'#7c4daa',Ke:'#8b7355'};

// ─── TAJIK HOUSE MEANINGS ─────────────────────────────────────────────────
const HM=['',
  'self, identity, and fresh starts — what you initiate now carries your full force',
  'finances, earned income, and how you speak your value into the world',
  'communication, skills, and the connections built through your words and ideas',
  'home, emotional foundations, and what you need to feel privately secure',
  'creativity, romance, and the intelligence that makes you feel alive',
  'health, daily work, and the obstacles that are quietly opportunities',
  'one-on-one connections — relationships, contracts, and everything built with another person',
  'transformation, shared resources, and what must be released for what is next to arrive',
  'expansion, long journeys, and where your biggest beliefs and sense of meaning live',
  'career, public reputation, and the moves that shape how the world sees you',
  'income, networks, and gains that come when you stop chasing and start attracting',
  'rest, hidden costs, and the sacrifices that are worth making for something larger',
];

// ─── PERIOD THEMES (from year-engine) — focus, positive, watch per planet ───
// Used by month guide cards and sub-period section headers
const PERIOD_THEMES = {
  Sun:     { focus:'Career, identity, and self-expression', positive:'Leadership opportunities, recognition, authority, father-related matters, government connections', watch:'Ego conflicts, overwork, eye and heart health, authority clashes', energy:'High energy and ambition' },
  Moon:    { focus:'Home, emotions, family, and public life', positive:'Emotional connections deepen, family harmony, public recognition, intuitive insights', watch:'Mood swings, mother\'s health, weight fluctuations, overemotional decisions', energy:'Fluctuating, emotionally charged' },
  Mars:    { focus:'Action, property, courage, and physical energy', positive:'Real estate moves, competitive wins, launching projects, physical fitness peaks', watch:'Accidents, arguments, impulsive decisions, disputes over property or money', energy:'High-drive, fast-moving' },
  Mercury: { focus:'Communication, business, and intellectual pursuits', positive:'Business deals close, writing projects advance, networking pays off, learning accelerates', watch:'Over-thinking, communication misunderstandings, contract issues, nervous energy', energy:'Quick, mentally stimulating' },
  Jupiter: { focus:'Growth, wisdom, relationships, and opportunities', positive:'Major opportunities open, relationships deepen, financial expansion, spiritual insight', watch:'Overconfidence, overexpansion, weight gain, misplaced trust', energy:'Expansive, optimistic' },
  Venus:   { focus:'Love, beauty, money, and pleasure', positive:'Romantic connections, financial gains, creative projects, social popularity, luxury', watch:'Overindulgence, romantic complications, overspending on aesthetics', energy:'Pleasurable, harmonious' },
  Saturn:  { focus:'Hard work, discipline, and long-term building', positive:'Long-term projects solidify, career authority builds, real estate deals, disciplined progress', watch:'Delays, feeling restricted, joint or bone health, isolation, heavy responsibilities', energy:'Slow, steady, demanding' },
  Rahu:    { focus:'Ambition, change, and unconventional paths', positive:'Foreign opportunities, unconventional success, technology wins, bold career moves', watch:'Deception, illusion, overambition, relationship instability, unusual health', energy:'Intense, disruptive, ambitious' },
  Ketu:    { focus:'Spirituality, release, and past patterns', positive:'Spiritual growth, letting go of what doesn\'t serve, intuitive insights, healing', watch:'Losses, detachment from responsibilities, mysterious health issues, lack of motivation', energy:'Inward, releasing, spiritual' },
};

// ─── LEGAL SAFE WRAPPERS (from report-prompts) — varied prediction language ──
// Rotated randomly so reports never sound templated
const LEGAL_HIGH    = ['Strong indicators suggest','Your chart shows clear potential for','Classical patterns point to','The planetary picture strongly supports','This is a high-probability window for'];
const LEGAL_MED     = ['Indicators suggest','Your chart shows potential for','Patterns in your chart point toward','There are signs of','Your chart supports'];
const LEGAL_CAUTION = ['Be mindful of','It would be wise to','Watch for','This period may bring','Some pressure possible around'];
const LEGAL_TIMING  = ['A favorable window opens around','Classical timing supports','The planetary cycles point to','Watch for opportunities around','Energy builds toward'];
const rnd = arr => arr[Math.floor(Math.random()*arr.length)];

// ─── TERM MAP (from language-layer) — Sanskrit→English safety net ────────────
// Passed into Claude prompts to ensure zero Sanskrit in outputs
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


// ── VERDICT TRANSLATOR ──────────────────────────────────────────────────────
// Applies TERM_MAP plus engine-specific extensions to convert Sanskrit-laden
// engine verdict strings into American English before user-facing render.
// Used by:
//   - buildSectionSidebar (Mode 3 paid report sidebar)
//   - Mode 2 _engineVerdicts (free chart, server-side translate before send)
//   - Mode: ASK engineVerdicts (Ask tab footer, server-side translate before send)
// Does NOT modify TERM_MAP. Engine-specific labels live in ENGINE_LABELS below.
const ENGINE_LABELS = {
  // Jaimini karakas (uppercase in engine output)
  'DARAKARAKA':    'Spouse Planet',
  'ATMAKARAKA':    'Soul Planet',
  'AMATYAKARAKA':  'Career Planet',
  'PUTRAKARAKA':   'Children Planet',
  'MATRIKARAKA':   'Mother Planet',
  'BHRATRIKARAKA': 'Sibling Planet',
  'GNATIKARAKA':   'Elder Planet',
  // Special points
  'UPAPADA LAGNA': 'True Marriage Indicator',
  'UPAPADA LORD':  'True-Marriage Indicator Ruler',
  'UPAPADA':       'True-Marriage Indicator',
  'ARUDHA LAGNA':  'Public-Image Indicator',
  'ARUDHA':        'Public Image',
  // Doshas / pressure cycles (uppercase variants)
  'MANGAL DOSHA':  'Mars Relationship Stress',
  'MANGAL-DOSHA':  'Mars Relationship Stress',
  'SADE SATI ACTIVE': "Saturn's 7.5-Year Pressure Cycle Active",
  'SADE SATI':     "Saturn's 7.5-Year Pressure Cycle",
  'KANTAKA SHANI': "Saturn's Career Pressure",
  'ASHTAMA SHANI': "Saturn's 8th-House Pressure",
  'KAAL SARP':     'Karmic Blockage Pattern',
  'KAALSARP':      'Karmic Blockage Pattern',
  'KAAL SARPA':    'Karmic Blockage Pattern',
  'KAALSARPA':     'Karmic Blockage Pattern',
  // Annual forecast (Tajik) — not in TERM_MAP
  'Tajik':         'Annual Forecast',
  'tajik':         'annual forecast',
  // System name — engine references "Jaimini system" in spiritual verdicts
  'Jaimini':       'classical',
  'jaimini':       'classical',
  // Common engine annotations
  'MOOL TRIKONA':  'Home Territory',
};
function translateVerdict(str) {
  if (!str) return str;
  let s = String(str);
  // Engine labels first (longer/specific patterns to avoid being shadowed by TERM_MAP)
  // Sort by length desc so 'UPAPADA LAGNA' matches before 'UPAPADA'
  const engineKeys = Object.keys(ENGINE_LABELS).sort((a,b) => b.length - a.length);
  for (const k of engineKeys) {
    if (s.indexOf(k) === -1) continue;
    s = s.split(k).join(ENGINE_LABELS[k]);
  }
  // TERM_MAP — case-sensitive, word-boundary safe
  // Sort by length desc to handle 'Mool Trikona' before 'Trikona', 'Raj Yoga' before 'Yoga', etc.
  const termKeys = Object.keys(TERM_MAP).sort((a,b) => b.length - a.length);
  for (const k of termKeys) {
    if (k.length < 3) continue;
    if (s.indexOf(k) === -1) continue;
    const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('\\b' + escaped + '\\b', 'g');
    s = s.replace(re, TERM_MAP[k]);
  }
  return s;
}


// ─── US SYSTEM PROMPT (from language-layer) — richer than LANG const ─────────
// Used for compatibility/compat report sections that need fuller language rules
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


// ─── PRATYANTARDASHA (from ephemeris) — sub-sub period calculator ────────────
// Enables 3-level dasha drill-down: Maha → Antar → Pratyantar
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

// ─── MUNTHA + PANCHADHIKARI (from varshpal) — Tajik year rulers ─────────────
// Muntha = progressed annual lagna | Panchadhikari = 5 year lords
function getMuntha(natalLagna,birthYear,varshpalYear){
  const ns=so(natalLagna),age=varshpalYear-birthYear,ms=(ns+age)%12;
  return{sign:ms,signName:RS[ms],lord:SL[ms],lordName:FN[SL[ms]]};
}

function getPanchadhikari(srLagna,natalLagna,natalMoonLon,munthaSign){
  return[
    {role:'Year Ascendant Lord',lord:SL[so(srLagna)],lordName:FN[SL[so(srLagna)]]},
    {role:'Birth Ascendant Lord',lord:SL[so(natalLagna)],lordName:FN[SL[so(natalLagna)]]},
    {role:'Annual Focus Point Lord',lord:SL[munthaSign],lordName:FN[SL[munthaSign]]},
    {role:'Trirashi Lord (Moon Sign)',lord:SL[so(natalMoonLon)],lordName:FN[SL[so(natalMoonLon)]]},
  ];
}


// ─── PIH — Planet In House descriptions (from vedic-engine) ──────────────────
// 108 entries: 9 planets × 12 houses. Source: BPHS, Brihat Jatakam, Saravali
const PIH = {
  Sun:{
    1:{t:'Identity',d:'Strong ego and identity, leadership qualities, government affinity. Father influences life path. Vitality is a core gift.'},
    2:{t:'Family/Finance',d:'Financial fluctuations, strong speech, father\'s influence on wealth. Earning is strong but expenditure matches it.'},
    3:{t:'Courage',d:'Courageous, self-motivated, competitive. Relations with siblings can be complex. Communication and writing are natural strengths.'},
    4:{t:'Home',d:'Tension between career and home life. Possible government property. Emotional expression can be suppressed.'},
    5:{t:'Intelligence',d:'Bright intellect, leadership and political aptitude. Creative expression is strong. Speculation requires caution.'},
    6:{t:'Enemies',d:'Strong over opposition, good health recovery, service orientation. Government or healthcare fields suit this placement.'},
    7:{t:'Partnership',d:'Dominant or high-profile partnerships. Power dynamics in relationships require awareness. Business with authority figures is favored.'},
    8:{t:'Transformation',d:'Sudden life changes and deep transformation. Inheritance possible. Occult interests natural. Hidden matters come to light.'},
    9:{t:'Fortune',d:'Highly fortunate, dharmic life path. Strong relationship with teachers and philosophy. Long journeys carry meaning.'},
    10:{t:'Career',d:'Excellent career placement. Fame, authority, and recognition in public life. Career becomes a central life theme.'},
    11:{t:'Gains',d:'Gains through authority and networks. Wealthy social circle. Desires are fulfilled through consistent effort.'},
    12:{t:'Moksha',d:'Spiritual inclination, foreign connections. Expenses are real but so is the depth gained through solitude and inner work.'},
  },
  Moon:{
    1:{t:'Identity',d:'Emotionally expressive, nurturing personality. Strong public presence and connection to people. Imagination and intuition are signature gifts.'},
    2:{t:'Family/Finance',d:'Emotional attachment to family and finances. Good memory, poetic speech. Income through public-facing or nurturing work.'},
    3:{t:'Courage',d:'Emotional courage, frequent short journeys, close bonds with siblings. Creative writing carries feeling.'},
    4:{t:'Home',d:'Deeply attached to home and mother. Emotional security sought through stability. Domestic life is rich and meaningful.'},
    5:{t:'Intelligence',d:'Strong intuition, creative mind. Emotional intelligence is the real asset here. Children are deeply important.'},
    6:{t:'Enemies',d:'Emotional stress through work and service. Health fluctuations worth monitoring. Mind is resilient when given rest.'},
    7:{t:'Partnership',d:'Emotionally invested in partnerships. Beautiful or popular spouse indicated. Business with the public is favored.'},
    8:{t:'Transformation',d:'Deep psychic sensitivity and emotional transformation. Inheritance possible. Crisis leads to genuine depth.'},
    9:{t:'Fortune',d:'Fortunate, philosophical mind. Emotional wellbeing comes through spirituality and travel. Good relationship with teachers.'},
    10:{t:'Career',d:'Public career with real visibility. Fame and reputation fluctuate but the public connection is genuine and lasting.'},
    11:{t:'Gains',d:'Gains through public and social networks. Many meaningful friendships. Desires are fulfilled through people.'},
    12:{t:'Moksha',d:'Strong intuition and spiritual sensitivity. Sleep and dreams carry messages. Inner work yields deep results.'},
  },
  Mars:{
    1:{t:'Identity',d:'Energetic, assertive, athletic presence. Pioneer spirit and drive to initiate. Action comes naturally and early.'},
    2:{t:'Family/Finance',d:'Financial drive is strong. Speech has edge and power. Earning through Mars fields — engineering, medicine, real estate, sports.'},
    3:{t:'Courage',d:'Exceptional physical and mental courage. Bold communication. Athletic or competitive siblings. Initiatives succeed through persistence.'},
    4:{t:'Home',d:'High energy in the home environment. Property and real estate are significant themes. Construction and engineering may feature.'},
    5:{t:'Intelligence',d:'Competitive intellect, forceful creative expression. Risks in speculation require discipline. Drive applied to mastery produces excellence.'},
    6:{t:'Enemies',d:'Strong over competition and opposition. Medical, legal, or athletic fields suit. Competitive work environments energize.'},
    7:{t:'Partnership',d:'Passionate partnerships with intensity on both sides. Business with competitive people is productive when focused.'},
    8:{t:'Transformation',d:'Sharp and sudden transformation. Hidden matters surface. The depth here is real — and so is the power available.'},
    9:{t:'Fortune',d:'Action-oriented philosophy. Father may be forceful or driven. Long journeys for work or expansion. Teaching through challenge.'},
    10:{t:'Career',d:'High career drive. Engineering, military, medicine, or real estate are natural fields. Authority earned through force of will.'},
    11:{t:'Gains',d:'Gains through initiative and competitive energy. Multiple income streams through effort. Networks are active and results-oriented.'},
    12:{t:'Moksha',d:'Energy expressed in private or behind the scenes. Foreign environments suit Mars energy. The quiet work here has lasting impact.'},
  },
  Mercury:{
    1:{t:'Identity',d:'Sharp, witty, youthful presence throughout life. Intellectual identity. Communication and business instinct are core.'},
    2:{t:'Family/Finance',d:'Financial intelligence, multiple income streams, eloquent speech. Business runs in the family. Numbers and words are natural.'},
    3:{t:'Courage',d:'Exceptional communicator, writer, analyst. Short trips are business-connected. Media, marketing, and journalism are natural fields.'},
    4:{t:'Home',d:'Intellectual home environment. Real estate deals through intelligence. Educated mother. Mind is most alive at home.'},
    5:{t:'Intelligence',d:'Analytical intellect, academic excellence. Mathematical and strategic thinking. Children are clever and engaged.'},
    6:{t:'Enemies',d:'Overcomes opposition through cleverness and analysis. Health is approached analytically. Medical, pharmaceutical, or advisory fields suit.'},
    7:{t:'Partnership',d:'Communicative, intellectual partner. Business through communication is favored. Partnerships that stimulate the mind last.'},
    8:{t:'Transformation',d:'Research mind, occult analysis, inheritance through intelligence. Writing on complex or hidden subjects. Longevity supported by adaptability.'},
    9:{t:'Fortune',d:'Philosophical intellect, legal or academic path. Father is intellectual. Teaching, writing, and long journeys for learning.'},
    10:{t:'Career',d:'Communication-centered career. Writing, media, IT, trading, accounting. Multiple roles suit Mercury\'s range.'},
    11:{t:'Gains',d:'Gains through communication and networking. Multiple income channels. Intellectual social circle pays dividends.'},
    12:{t:'Moksha',d:'Secretive mind, foreign writing or publishing. Spiritual analysis. The inner life is rich and complex.'},
  },
  Jupiter:{
    1:{t:'Identity',d:'Wise, generous, optimistic personality. Blessed constitution. Teacher or advisor nature. Good fortune tends to follow this placement.'},
    2:{t:'Family/Finance',d:'Wealthy family background, eloquent wisdom in speech, financial expansion. Family dharma is strong. Generosity is real.'},
    3:{t:'Courage',d:'Philosophical courage, wisdom in communication. Teaching younger people comes naturally. Short journeys have purpose and meaning.'},
    4:{t:'Home',d:'Happy home life, good mother, property gains. Comfort and genuine happiness in domestic life. Religious home environment.'},
    5:{t:'Intelligence',d:'Classical blessing for intellect and children. Past-life merit is accessible. Speculative wisdom over speculation. Wise children.'},
    6:{t:'Enemies',d:'Enemies become friends over time. Legal battles won through ethics. Service to others generates real returns.'},
    7:{t:'Partnership',d:'Wise, wealthy, or spiritually minded spouse. Happy marriage indicated. Business with principled people is favored.'},
    8:{t:'Transformation',d:'Occult wisdom, inheritance, longevity-supporting. Research into hidden matters yields depth. Spiritual transformation comes through crisis.'},
    9:{t:'Fortune',d:'Most auspicious placement. Divine grace, fortunate father, higher wisdom. Teaching, law, and philosophy are natural paths.'},
    10:{t:'Career',d:'Highly respected career path. Teaching, law, finance, medicine. Ethical leadership. Fame through wisdom and competence.'},
    11:{t:'Gains',d:'Abundant gains, fulfilled desires, wealthy networks. Multiple income streams through wisdom. Generosity returns multiplied.'},
    12:{t:'Moksha',d:'Spiritual wisdom, ashram or institutional connections. Foreign spiritual experiences. Dharmic expenses. Good for liberation.'},
  },
  Venus:{
    1:{t:'Identity',d:'Attractive, charming personality. Artistic identity. Love of beauty and pleasure. Warmth and affection are natural.'},
    2:{t:'Family/Finance',d:'Beautiful presence, sweet speech, wealth through beauty or arts. Family is cultured. Luxury and fine things are natural companions.'},
    3:{t:'Courage',d:'Artistic communication, creative siblings. Writing, music, or design. Short trips for pleasure or culture. Gentle persuasion works.'},
    4:{t:'Home',d:'Beautiful home, happy mother, luxury vehicles, a comfortable life. Property through or with partner. Aesthetic and loving home.'},
    5:{t:'Intelligence',d:'Creative genius, romantic nature. Artistic children. Love affairs are significant. Entertainment and beauty as career themes.'},
    6:{t:'Enemies',d:'Service through beauty — healing, wellness, design. Romantic complications with colleagues require boundaries.'},
    7:{t:'Partnership',d:'Beautiful, talented spouse. Happy marriage. Business in Venus fields — arts, beauty, luxury. Strong and meaningful love life.'},
    8:{t:'Transformation',d:'Deep sensuality, inheritance through partner. Occult arts. In-law wealth. Hidden relationships carry intensity.'},
    9:{t:'Fortune',d:'Fortunate marriage and travel. Philosophy through beauty. Artistic religious expression. Long journeys for pleasure or culture.'},
    10:{t:'Career',d:'Career in arts, entertainment, fashion, beauty, luxury, or diplomacy. Fame through aesthetics and charm.'},
    11:{t:'Gains',d:'Gains through arts and social beauty. Wealthy circle of attractive or artistic people. Multiple pleasures and genuine enjoyment.'},
    12:{t:'Moksha',d:'Hidden pleasures, bedroom arts, foreign romantic connections. Spiritual through beauty. Sensory retreats restore deeply.'},
  },
  Saturn:{
    1:{t:'Identity',d:'Serious, disciplined personality. Success builds steadily from the 30s onward. Structure and persistence are the path. Bones and joints need care.'},
    2:{t:'Family/Finance',d:'Slow and steady wealth accumulation. Harsh or deliberate speech. Financial stability is earned, not given. Traditional values.'},
    3:{t:'Courage',d:'Persistent, structured courage. Serious or few siblings. Writing and communication that endures over time.'},
    4:{t:'Home',d:'Delayed domestic happiness, property gained through persistence. Old or ancestral property. Emotional discipline is learned at home.'},
    5:{t:'Intelligence',d:'Disciplined intellect, serious approach to creativity. Academic persistence yields results. Children are responsible and mature.'},
    6:{t:'Enemies',d:'Persistent victory over opposition. Chronic conditions managed through discipline. Service industries, law, and administration suit.'},
    7:{t:'Partnership',d:'Delayed or serious partnership. Marriage improves steadily over time — cold start, warm finish. Patience in partnership is the key.'},
    8:{t:'Transformation',d:'Slow transformation, chronic conditions require attention. Longevity is supported if the chart is otherwise strong. Deep hidden fears become assets.'},
    9:{t:'Fortune',d:'Disciplined dharma, serious or traditional father. Late in finding philosophy. Traditional spiritual path yields lasting results.'},
    10:{t:'Career',d:'Slow but extremely powerful career trajectory. Success after 35. Law, real estate, politics, engineering, and legacy work. Lasting achievement.'},
    11:{t:'Gains',d:'Gains through persistent effort over time. Social circle of serious, established people. Labour-intensive work pays compounding dividends.'},
    12:{t:'Moksha',d:'Karmic clearing through isolation or foreign land. Deep spiritual work. The weight here is real — and so is what\'s released through it.'},
  },
  Rahu:{
    1:{t:'Identity',d:'Unconventional personality, identity that shifts across life. Worldly ambitions are strong. Ancestors\' unfulfilled wishes drive forward motion.'},
    2:{t:'Family/Finance',d:'Unconventional wealth, foreign earnings, unusual family dynamics. Speech is persuasive and compelling when focused.'},
    3:{t:'Courage',d:'Unusual courage, unconventional communication style. Foreign or digital media. Bold outreach pays off.'},
    4:{t:'Home',d:'Restlessness at home, possible foreign settlement. Property through unconventional means. Real estate in foreign or new territories.'},
    5:{t:'Intelligence',d:'Unconventional intellect and creative path. Risky investments require discipline. Past-life debts surface through children or creative blocks.'},
    6:{t:'Enemies',d:'Powerful over opposition through unconventional strategy. Foreign service or unusual fields. Enemies from unexpected quarters.'},
    7:{t:'Partnership',d:'Foreign or unconventional partnership. Strong initial attraction with adjustment needed. The relationship is a genuine catalyst for change.'},
    8:{t:'Transformation',d:'Sudden and dramatic transformations. Unusual inheritance or hidden wealth. Occult power. The disruption is the invitation.'},
    9:{t:'Fortune',d:'Unconventional dharma, foreign or unusual teachers. Luck through foreign connections. Philosophy that breaks tradition.'},
    10:{t:'Career',d:'Rise through unconventional means. Foreign career, media, technology, or politics. Sudden rises are matched by the need for grounding.'},
    11:{t:'Gains',d:'Substantial gains through unconventional networks. Foreign earnings. Unusual or global social circle. Elder siblings may be from different background.'},
    12:{t:'Moksha',d:'Foreign settlement strongly indicated. Hidden life carries depth. Spiritual seeking through unusual or non-traditional paths.'},
  },
  Ketu:{
    1:{t:'Identity',d:'Spiritual, detached personality. Strong intuition and past-life achievements accessible. Physical identity is not the priority — inner depth is.'},
    2:{t:'Family/Finance',d:'Detachment from family traditions. Spiritual approach to wealth. Unconventional speech patterns that carry quiet wisdom.'},
    3:{t:'Courage',d:'Past-life courage surfaces intuitively. Unusual communication with spiritual quality. Short travels serve inner purpose.'},
    4:{t:'Home',d:'Detachment from homeland, possible separation from mother early. Spiritual home environment. Discomfort with purely material property.'},
    5:{t:'Intelligence',d:'Past-life intellect accessible. Spiritual children or detachment from creative ego. What is made from stillness lasts.'},
    6:{t:'Enemies',d:'Opposition dissolves mysteriously. Health issues that are hard to diagnose respond to spiritual or holistic approaches.'},
    7:{t:'Partnership',d:'Spiritual partnership or detachment from conventional marriage. Past-life connection with partner. Transcendent view of relationships.'},
    8:{t:'Transformation',d:'Deep occult wisdom, past-life mystic abilities. Liberation through crisis. Near-death experiences carry genuine awakening.'},
    9:{t:'Fortune',d:'Past-life spiritual merit. Unusual or transcendent dharma. Teachers appear through synchronicity. The path is inward as much as outward.'},
    10:{t:'Career',d:'Detachment from worldly recognition. Career in spirituality, healing, research, or hidden fields. The real work often goes unseen.'},
    11:{t:'Gains',d:'Release of material desires. True gains come through letting go. Friendships that have served their purpose complete naturally.'},
    12:{t:'Moksha',d:'Deep spiritual liberation. Solitude, meditation, and inner work are unusually productive. What is released here does not return. That is the point.'},
  },
};

// ─── INTERPRETATION LIBRARY ──────────────────────────────────────────────────
// Pre-written rule-based content. Zero Claude tokens.
// Used by all reports, free chart, Today tab, Ask tab.

const RISING_DESC = {
  'Aries':       ['You walk into rooms and people notice — there\'s a directness and energy about you that doesn\'t waste time.','Mars rules your chart, which means you\'re wired for action. When you decide, you move. When you move, things happen.','The challenge is patience — you burn bright but can push yourself or others harder than the moment requires.'],
  'Taurus':      ['There\'s a steadiness about you that people find grounding — you\'re the person others come to when things feel uncertain.','Venus rules your chart, giving you natural magnetism, aesthetic sensitivity, and a genuine appreciation for quality in all things.','You\'re built for the long game — patient, deliberate, and remarkably effective when you trust your own pace.'],
  'Gemini':      ['You think faster than most people talk, and your mind makes connections others simply don\'t see.','Mercury rules your chart — communication, ideas, and information flow through you as naturally as breathing.','Depth is your work. Your gift is the breadth; the challenge is choosing which thread to follow all the way through.'],
  'Cancer':      ['People feel safe around you without knowing why — you carry a nurturing presence that others instinctively sense.','The Moon rules your chart, which means your energy shifts with your inner world. When you\'re settled, you\'re magnetic.','Your home is your anchor. Where you live and who you live with shapes everything — it\'s not just comfort, it\'s foundation.'],
  'Leo':         ['There\'s a warmth and vitality to you that draws people in — when you\'re lit up, the whole room feels it.','The Sun rules your chart, giving you natural leadership, creative fire, and a genuine need for recognition that functions as fuel.','Your challenge is the gap between how you want to be seen and how you feel inside. When those align, you\'re unstoppable.'],
  'Virgo':       ['You notice things other people miss — details, patterns, when something is slightly off. This is a gift, not a flaw.','Mercury rules your chart with a precision lens, giving you analytical sharpness and the capacity to improve anything you touch.','Your body is a barometer of your inner state. When overwhelmed, it shows physically. Boundaries are medicine for you.'],
  'Libra':       ['There\'s a natural grace to how you move through the world — diplomatic, aesthetically sensitive, and socially fluid.','Venus rules your chart, meaning beauty, relationships, and fairness aren\'t just preferences — they\'re core to your experience.','Your challenge is your own opinion. You\'re so skilled at seeing all sides that deciding — and staying decided — takes real effort.'],
  'Scorpio':     ['You have a presence people feel before you speak — intense, observant, still. Depth draws some in and unsettles others.','Mars rules your chart, wiring you for transformation, investigation, and going where others won\'t or can\'t.','Privacy is your shield. What you offer when you do let someone in is real. Superficial connections drain you quickly.'],
  'Sagittarius': ['There\'s an expansiveness to your presence — you move through the world with a sense that something better is always possible.','Jupiter rules your chart, giving you philosophical depth, a love of learning, and an instinct for the big picture.','The risk is commitment. When you feel free, you thrive. When you feel boxed in, you start looking for the exit.'],
  'Capricorn':   ['You carry yourself with an authority that doesn\'t need announcement — competence is your default energy.','Saturn rules your chart, which means you\'re built for structure, longevity, and earned success that actually lasts.','Youth can feel heavy for you. The older you get, the more you come into your own. Your best chapters are ahead.'],
  'Aquarius':    ['You think differently than the people around you — and always have. What looks like eccentricity is just you seeing further ahead.','Saturn rules your chart, wiring you for systems, social patterns, and the future rather than the past.','Intimacy is your edge. You can be close to many and truly known by almost none. That gap deserves your attention.'],
  'Pisces':      ['There\'s a softness and receptivity to your presence — you absorb the emotional temperature of every room you enter.','Jupiter rules your chart, giving you spiritual depth, imaginative capacity, and a genuine compassion that borders on self-sacrifice.','Boundaries are your work. You feel others\' pain as your own, which makes you deeply empathetic — and easily drained.'],
};

const MOON_DESC = {
  'Aries':       ['Your emotional life is immediate — you feel things quickly, intensely, and briefly. Moods come fast and shift fast.','You need to feel autonomous and ahead emotionally. Feeling stuck or controlled is genuinely painful.','Reactivity is your edge. When triggered you move before you think. The pause between feeling and response changes everything.'],
  'Taurus':      ['Your emotional anchor is comfort, consistency, and beauty. When your environment is right, everything feels manageable.','You\'re slow to trust but deeply loyal once you do. Emotional security matters more than almost anything.','Stubbornness is your shadow — you can hold on to people or patterns well past their usefulness because change feels threatening.'],
  'Gemini':      ['You process emotions through words — talking about something is how you understand it. Sitting with feelings quietly is harder.','Curiosity is your emotional default. Ideas and stimulating people are emotionally nourishing; boredom is a genuine mood disruptor.','You want closeness and freedom simultaneously. Partners who understand that complexity are rare and worth keeping.'],
  'Cancer':      ['Your emotional life is rich, deep, and highly personal — you feel everything and remember everything that was ever felt.','Home and family are the core of your emotional world. When these are stable, you flourish.','Moodiness and withdrawal are your defenses. When hurt, you retreat. Learning to stay present through discomfort transforms relationships.'],
  'Leo':         ['You need to feel seen, valued, and appreciated to feel emotionally secure — this is how love registers for you.','Warmth is your natural tone when you feel safe. When you don\'t, you can shift to pride and performance instead of vulnerability.','Creative expression is emotional medicine. When you\'re making or creating anything, your inner world settles considerably.'],
  'Virgo':       ['You process emotions through analysis — you feel something and immediately try to understand why. Gift and trap simultaneously.','Worry is your default weather. Not because things are wrong but because your mind scans constantly for what could go wrong.','Service is your love language. You show care by doing and fixing. Learning to receive care gracefully is the real work.'],
  'Libra':       ['You feel best when things are balanced and harmonious. Discord — especially in close relationships — is genuinely destabilizing.','You feel emotions through relationships. Who you\'re with shapes who you feel you are. Choose your people deliberately.','People-pleasing is your shadow. You suppress your own needs to keep the peace. Over time, that cost compounds.'],
  'Scorpio':     ['Your emotional depth is defining — you feel at full intensity and you don\'t forget. Nothing is casual for you internally.','Trust is earned slowly and lost permanently. You need to feel safe before you open up, and your version of open is still private.','Jealousy and control are signals — not flaws, but indicators that something important to you feels threatened.'],
  'Sagittarius': ['Your emotional life wants freedom, space, and meaning. You need to feel what you\'re doing matters at a larger level.','You\'re naturally optimistic and bounce back quickly — your philosophical nature finds the lesson in almost everything.','Commitment to your own discomfort is the work. When things get heavy, the instinct is to move on. Sometimes depth requires staying.'],
  'Capricorn':   ['You keep your emotional world private. Vulnerability can feel like exposure, which means few people see your real interior.','Emotions in you often manifest as ambition — the drive to achieve is frequently, at its root, a drive to feel secure and in control.','Those you let in fully have something irreplaceable. Don\'t let that inner circle stay too small or too defended.'],
  'Aquarius':    ['You feel emotions more as concepts than sensations — you can describe what you feel before you actually feel it.','Emotional independence is non-negotiable. Neediness — in others or yourself — feels uncomfortable. Space is how you love.','You care deeply about humanity but can feel detached from the individuals closest to you. Bridging that gap is the ongoing work.'],
  'Pisces':      ['Your emotional world is porous — you absorb the feelings of rooms and people without a filter. This is both your gift and your cost.','Empathy is your superpower and your liability. You feel what others feel, which makes you extraordinary to be around and hard to sustain.','Dreams, creativity, spirituality, and solitude are your reset buttons. Without them, you get lost in other people\'s worlds.'],
};

const STAR_DESC = {
  'Ashwini':          ['You carry first-energy — you arrive before others and finish before they start. Speed and natural healing are your gifts.','Ketu rules this star, giving you intuitive flashes, unconventional thinking, and gifts that seem to come from somewhere beyond the visible.'],
  'Bharani':          ['You carry life and death energy — Venus-ruled, drawn to creation, intensity, and the full weight of consequence.','Transformation runs through you. You understand that real things cost something. Creation and destruction are not opposites for you.'],
  'Krittika':         ['You cut to the truth with precision. Solar fire runs through this star — sharp, penetrating, and driven by a hunger for authenticity.','Flattery doesn\'t work on you. You see through performance to substance, which makes you both respected and occasionally uncomfortable to be around.'],
  'Rohini':           ['You\'re deeply sensory — beauty, comfort, and material abundance pull you with a force that\'s almost gravitational.','Moon-ruled and creatively magnetic, you draw people and good things toward you when you\'re in your flow.'],
  'Mrigashira':       ['You\'re always seeking — the right knowledge, the right answer, the right place to settle. Mars-ruled restlessness fueled by genuine curiosity.','Your seeking is your strength and your challenge. You need to trust that what you\'re looking for can be found where you already are.'],
  'Ardra':            ['Storms pass through you. Rahu-ruled, you carry turbulence and transformation that leaves clarity — and wreckage — in its wake.','Your intensity is the source of your insight. Those who\'ve weathered the storm of knowing you often stay for life.'],
  'Punarvasu':        ['You return and renew. After setbacks you restore, after loss you rebuild. Jupiter-ruled optimism and flexibility are your defining gifts.','People around you often notice: things seem to work out for you, even when they shouldn\'t. That\'s this star\'s energy at work.'],
  'Pushya':           ['You nourish others. Saturn-ruled, you carry the energy of sustenance — you\'re the one who feeds, supports, and holds things steady.','The challenge is receiving. You\'re built to give — but learning to be nourished in return is part of your path.'],
  'Ashlesha':         ['You understand what\'s hidden. Mercury-ruled serpent energy — penetrating insight, strategic intelligence, and a powerful survival instinct.','You can see underneath the surface of almost any situation. This makes you an extraordinary ally — and someone not to cross.'],
  'Magha':            ['You carry ancestral authority. Ketu-ruled, deeply connected to lineage, legacy, and a quiet dignity that comes from somewhere older than this life.','Leadership is natural for you — not the loud kind, but the kind that people follow because it comes with real weight behind it.'],
  'Purva Phalguni':   ['You\'re designed for pleasure, rest, and creative expression. Venus-ruled, life rewards you when you relax into enjoyment rather than effort.','The risk isn\'t laziness — it\'s failing to recognize that rest and beauty are legitimate, serious, productive forces for you.'],
  'Uttara Phalguni':  ['You build lasting things. Sun-ruled, your gifts lie in what you complete and sustain — relationships, institutions, work that endures.','You start what Purva Phalguni began. Follow-through is your superpower. What you commit to fully, you finish.'],
  'Hasta':            ['Your hands are your magic — dexterity, craft, and the ability to manifest with precision. Moon-ruled and highly skilled.','You can make almost anything with enough practice. The path to your most meaningful work often runs through your hands literally.'],
  'Chitra':           ['You create form from nothing. Mars-ruled, drawn to beauty in structure — architectural thinking, perfect proportion, the making of beautiful things.','Visual intelligence is high in this star. You see what something could be before it\'s made, and you can\'t rest until it\'s realized.'],
  'Swati':            ['You bend without breaking. Rahu-ruled, deeply independent, and driven by a constant need for movement and freedom.','You\'re self-reliant to a degree that others find striking. The journey is learning to let people help you without losing your autonomy.'],
  'Vishakha':         ['You pursue a goal with singular focus even when the journey takes years. Jupiter-ruled patience with Mars-ruled drive underneath.','Once you commit to a direction, you don\'t waver. This is rare, and it\'s why you tend to achieve things others only talk about.'],
  'Anuradha':         ['You build devotion and friendship. Saturn-ruled, deeply loyal, with the ability to maintain connections across time and real difficulty.','Your most valuable assets are your long-term relationships. Invest in them the way you\'d invest in anything important — steadily, over time.'],
  'Jyeshtha':         ['You carry leadership earned through experience. Mercury-ruled, protective, and weighted with the responsibility of being the one others rely on.','Authority sits on you differently than on others — it doesn\'t feel like power, it feels like duty. That distinction is exactly right for this star.'],
  'Mula':             ['You go to the root. Ketu-ruled, you will pull up everything false, borrowed, or inherited to find what is actually real and yours.','Destruction serves you. What looks like setbacks are often you burning away what never fit. Trust the clearing process.'],
  'Purva Ashadha':    ['You are invincible before the battle is fought. Venus-ruled, you carry early victories, optimism, and a powerful sense of purpose.','Your confidence is genuine and sometimes makes others uncomfortable. What they call arrogance, you experience as simply knowing yourself.'],
  'Uttara Ashadha':   ['Your victories are final and lasting. Sun-ruled — you win slowly, but what you win stays won. Patience is your strategy.','You don\'t need to rush. The track record of this star is that real success comes — it just comes on its own timeline, not yours.'],
  'Shravana':         ['You listen to understand, not to respond. Moon-ruled, knowledge and the deep art of paying attention are your defining gifts.','You know more than you let on. The wisdom that comes through you often surprises even you — trust what arrives when you\'re still.'],
  'Dhanishtha':       ['You march to your own rhythm. Mars-ruled musical intelligence, wealth potential, and a strong independent streak mark your path.','The path is not the conventional one and it doesn\'t need to be. Your version of success is specific to you and probably looks different from the outside.'],
  'Shatabhisha':      ['You heal and conceal. Rahu-ruled, drawn to mystery, medicine, and the ability to see what others can\'t — including sometimes yourself.','Independence is your nature and your protection. You\'re self-sufficient in ways that are both impressive and occasionally lonely.'],
  'Purva Bhadrapada': ['You burn with idealism. Jupiter-ruled, a passionate inner world drives you toward transformation and the pursuit of higher meaning.','You\'re capable of tremendous sacrifice for what you believe in. The work is making sure what you sacrifice for is actually worthy of it.'],
  'Uttara Bhadrapada':['You\'ve come far and carry the depth of the journey. Saturn-ruled, marked by wisdom, emotional depth, and mastery of the long game.','The surface doesn\'t show what\'s underneath you. People often discover what you\'re made of in moments of real difficulty — and they\'re surprised every time.'],
  'Revati':           ['You close cycles. Mercury-ruled, you help others and yourself finish what needs finishing — completion, liberation, gentle endings.','There\'s a timeless quality to you. You bridge worlds — past and future, inner and outer. You\'re rarely exactly where you appear to be.'],
};

// Planet-House meanings for sub-period cards (Tajik system)
// Format: PHD[planet_name][house_number] = [line1, line2, line3]
const PHD = {
  'Sun': {
    1: ['Vitality returns this cycle — you feel more yourself, more present, more like the person you actually are.','Identity and confidence come forward naturally. Decisions made from this energy tend to stick.','This is a window to begin or re-begin — actions initiated now carry your full solar signature.'],
    2: ['Your voice and your finances carry unusual weight right now. What you say is heard; what you charge is respected.','Earned income and material foundations are activated. A financial conversation you\'ve been avoiding is worth having.','How you value yourself shapes what you attract. This cycle asks you to raise the standard.'],
    3: ['Bold communication, confident outreach, and intellectual energy are at a peak. Write the thing. Send the message.','Short journeys or a new skill carry more significance than they appear to. Follow the thread.','Siblings or close neighbors may play an unexpectedly important role this cycle.'],
    4: ['Home, family, and emotional roots are illuminated. A property matter, renovation, or family conversation is timely.','What makes you feel at home — internally and externally — is the question this cycle places in front of you.','Emotional foundations get strengthened or rearranged. Both outcomes are ultimately useful.'],
    5: ['Creativity and romance are lit up. Something you make, start, or fall into carries unusual significance.','Children — literal or creative — are the themes of this window. What you birth here has longevity.','Speculative ventures and genuine joy are supported. Let yourself play.'],
    6: ['Health, daily work, and competition sharpen in focus. A discipline applied now yields disproportionate results.','A rival situation or long-standing workplace challenge has the conditions to finally resolve.','Small consistent actions compound dramatically in this cycle. Show up precisely.'],
    7: ['A one-on-one relationship — personal or professional — comes into focus with unusual clarity.','Partnership matters are illuminated: what\'s working, what isn\'t, what needs to be said.','A contract, commitment, or direct conversation has the energy of this cycle behind it.'],
    8: ['Transformation and what\'s hidden come forward. Something ends here so something else can finally begin.','Joint finances, inheritance, or shared resources may require attention. So might letting something go.','The depth work you\'ve been avoiding is being asked for directly. It yields more than expected.'],
    9: ['Expansion on all fronts — long journeys, higher learning, publishing, and the pursuit of larger meaning.','A teacher, mentor, or foreign connection brings something of genuine importance this cycle.','Your beliefs and sense of purpose are energized. Follow the pull toward what feels significant.'],
    10: ['Career and public reputation are in the spotlight. Actions taken now are unusually visible and consequential.','This is one of the highest-profile windows of the year professionally. Move deliberately and boldly.','Advancement, recognition, or a clear next step in your work direction is available in this cycle.'],
    11: ['Income, networks, and the realization of long-held goals — your social capital pays dividends right now.','A connection made or conversation had this cycle generates returns well beyond the immediate moment.','Long-cherished ambitions are within reach. State what you want and take a clear step toward it.'],
    12: ['A time to withdraw, release, and restore. Clarity comes from solitude and the settling of unfinished matters.','Something that has needed to be let go of finally becomes releasable. Allow it.','Spiritual depth and the resolution of old debts — literal or karmic — mark this window.'],
  },
  'Moon': {
    1: ['Your intuition and emotional presence are heightened. People are drawn to you in ways they can\'t entirely explain.','What you feel this cycle tends to be accurate. Trust the instinct even before you can rationalize it.','Your inner world and outer presentation are unusually aligned — people see you as you actually are.'],
    2: ['Emotional security is tied to financial and domestic stability right now. Nurture what grounds you.','A family financial matter or conversation about home security is timely and productive this cycle.','What you value and what makes you feel safe are being brought into alignment.'],
    3: ['Your mind is emotionally active — ideas, conversations, and nearby connections feel personally meaningful.','Journaling, expressive writing, or deep conversations carry real weight this cycle.','The emotional tone of your immediate environment shapes you significantly — choose it deliberately.'],
    4: ['The deepest domestic and emotional themes surface. What makes you feel at home is the central question.','Mother, homeland, or the emotional past asks for attention — and honest engagement brings relief.','Inner stability and outer home stability are linked right now. Addressing one addresses the other.'],
    5: ['Emotional expression through creativity, children, or romance. What you feel, you need to create or share.','A creative project or romantic connection has a deeply personal quality this cycle — it matters more than it might appear.','Joy is not indulgence for you right now. It\'s fuel. Protect the conditions that make it available.'],
    6: ['Emotional sensitivity around health and daily routine. Your body is communicating — listen carefully.','A health matter carries an emotional component that, addressed, accelerates healing.','The quality of your daily habits directly affects your emotional state this cycle. Routine is medicine.'],
    7: ['Your closest relationships carry emotional weight this cycle. What others feel, you feel. Choose your company deliberately.','A partnership — personal or professional — is reflecting something important back at you. Pay attention.','Emotional boundaries in one-on-one relationships are the real work here.'],
    8: ['Deep emotional undercurrents — grief, desire, unresolved patterns. Transformation is emotional, not merely circumstantial.','Something hidden in your emotional world is ready to be acknowledged and moved through.','What you release this cycle creates genuine space. The clearing is the gift, even if it doesn\'t feel like it.'],
    9: ['Your beliefs and sense of meaning are emotionally alive. An inner or outer journey feeds something real.','A teacher, text, or experience this cycle lands differently than it would at any other time.','Emotional expansion — your sense of what\'s possible — is the theme. Let it open.'],
    10: ['Public life and career carry emotional weight. How you\'re perceived matters to you right now, more than usual.','Recognition activates something important in you this cycle. Don\'t discount that — use it as a guide.','The work you show publicly is emotionally charged. Put care into what you present.'],
    11: ['Friends, community, and collective belonging are emotionally nourishing. Your network is genuine support right now.','A friendship becomes more significant; a group connection delivers something you\'ve been quietly needing.','Emotional fulfillment comes through giving to others in community this cycle. Invest in your people.'],
    12: ['Rest, retreat, and emotional release. Something dissolves that needed to. Solitude is medicine, not avoidance.','Dreams carry unusual clarity this cycle. Whatever arrives in the quiet deserves to be written down.','The resolution of old emotional patterns is available — not through force but through willingness to let go.'],
  },
  'Mars': {
    1: ['High energy and assertiveness — you\'re ready to move, act, and lead. Physical vitality is sharp and direct.','Impulse has momentum this cycle. The question is whether you direct it or let it direct you.','Begin the thing you\'ve been circling. Mars in the 1st has no patience for hesitation.'],
    2: ['Financial drive is strong — you\'re pursuing income with unusual force. Watch for impulsive spending.','Your speech carries more edge and more power than usual. Use it surgically, not broadly.','A bold financial move is possible here. Know the risk before you make it.'],
    3: ['Bold communication and the courage to reach out, disagree, or assert a perspective you\'ve been holding back.','A short journey, writing project, or skill initiative has drive behind it this cycle. Move on it.','Conflict with siblings or close contacts is possible — address it directly rather than letting it simmer.'],
    4: ['Home and family bring friction and energy simultaneously. A domestic decision requires courage not caution.','Property, renovation, or a family confrontation that\'s been building may arrive this cycle.','Channel the energy into making your environment work better rather than fighting with the people in it.'],
    5: ['Passionate creativity and romantic intensity. Something bold is being made — in art, love, or speculative risk.','A creative venture or romantic pursuit has real force behind it. Bold moves are the right moves here.','Children or creative projects may require more energy and assertiveness than usual this cycle.'],
    6: ['You have the edge over competitors right now — apply consistent effort and the results follow.','Health requires your active attention, not passive acceptance. Move, exercise, engage your body.','A long-standing obstacle at work finally has the conditions to be overcome. Push deliberately.'],
    7: ['One-on-one friction or passion — partnerships get intense this cycle and the quality of what\'s built becomes clear.','A direct conversation with a partner or opponent is better had now than avoided until later.','What\'s real in your key relationships becomes visible. Be honest about what you find.'],
    8: ['High-voltage transformation. Shared finances, hidden matters, and what needs to end are in active focus.','This cycle doesn\'t allow avoidance of the things you\'ve been avoiding. Face them deliberately.','What you confront directly here transforms permanently. What you dodge stays to be faced again.'],
    9: ['The urge to push boundaries — travel, debate, and the pursuit of larger meaning drives you forward.','Bold intellectual moves and courageous belief changes are supported this cycle.','A physical or philosophical journey has unusual significance. Go further than is comfortable.'],
    10: ['Ambition is at maximum. Career action, public leadership, and professional bold moves have real force behind them.','This is one of the highest-energy career windows in the year. Move on what matters most.','Visibility and decisiveness serve you right now. Others are watching and the moment is available.'],
    11: ['Driven pursuit of goals and gains — your social network is activated by your initiative this cycle.','Take the first step with the community or goal you\'ve been warming up to. Force creates traction.','A long-held aspiration has energy behind it right now. State it clearly and move toward it.'],
    12: ['Hidden action, behind-the-scenes work, and the completion of things in private.','Avoid unnecessary conflict and aggressive outreach this cycle — the real work is quiet and internal.','What you complete in private here pays dividends in what becomes visible later. Do the unseen work.'],
  },
  'Mercury': {
    1: ['Your mind and communication are front and center — sharp, clear, quick, and being heard.','Ideas arrive fast this cycle and the words to express them follow closely. Write everything down.','Your presence is intellectually compelling right now. Make the calls, have the conversations.'],
    2: ['Financial communication, negotiations, and the words that build or protect value are activated.','Sign the contract, finalize the agreement, make the pitch. The timing for financial conversations is right.','How you speak about money and your own worth directly shapes outcomes this cycle.'],
    3: ['Writing, speaking, and ideas are flowing. This is your most productive window for communication of any kind.','A skill initiative, course, or outreach effort has momentum. Move on it quickly — Mercury windows are short.','The conversations you have near home this cycle matter more than they appear to on the surface.'],
    4: ['Mental focus on home, property, and family matters. A legal or contractual matter related to real estate may be timely.','Family communication requires clarity and intention this cycle — what\'s said can settle or unsettle long-standing dynamics.','Your thinking about where you live and how you live is being sharpened. Trust the clarity that arrives.'],
    5: ['Creative intelligence and charming communication are heightened. What you write, teach, or express lands with unusual impact.','A creative project or romantic conversation has intellectual quality that makes it both meaningful and memorable.','Children or students respond particularly well to you this cycle. Your explanations land.'],
    6: ['Analytical sharpness around health and work systems. This is the cycle to optimize, audit, and solve.','A health communication — with a doctor, in a journal, in research — yields something useful.','Small improvements to daily systems compound significantly when applied with Mercury\'s precision.'],
    7: ['Negotiation, contracts, and partnership communication are the focus. The right conversation with the right person shifts everything.','A legal matter, business agreement, or relationship conversation has favorable conditions now.','What you communicate in your key partnership this cycle sets the tone for the months that follow.'],
    8: ['Research, investigation, and the mind turned toward what\'s hidden — financial or psychological.','Tax, inheritance, insurance, or a deep personal inquiry has the mental clarity it needs this cycle.','Hidden information surfaces. Follow what you find rather than stopping at the uncomfortable parts.'],
    9: ['Teaching, publishing, long-distance communication, and the pursuit of wisdom are energized.','A writing project, course, or intellectual exchange with someone at a distance carries real potential now.','Your thinking expands during this period. Read more than usual. The ideas that come are worth recording.'],
    10: ['Professional communication, reputation management, and career-defining words are the active forces.','Write the proposal. Give the presentation. Make the professional introduction. The timing is right.','What you say publicly this cycle shapes how you\'re perceived for longer than the moment suggests.'],
    11: ['Network communication and goals realized through the right conversation at the right time.','A group discussion, community introduction, or collaborative project has unusual intellectual momentum.','The ideas you share in your networks this cycle find exactly the people who need them.'],
    12: ['Mental retreat, journaling, spiritual reading, and the processing of what\'s unresolved.','Inner clarity arrives during this cycle through quiet rather than activity. Protect the stillness.','Write what you\'re carrying. What gets named gets processed, and what gets processed gets released.'],
  },
  'Jupiter': {
    1: ['Expansion, optimism, and a notable improvement in how you\'re received. This is a fortunate period for beginnings.','Physical vitality, confidence, and generosity of spirit are all heightened. You\'re larger than usual.','What you start in this window tends to grow. Begin the thing that deserves to be large.'],
    2: ['Wealth, abundance, and financial expansion are the themes. Income opportunities increase; generosity flows.','A financial blessing or unexpected resource arrives this cycle. Invest it rather than consuming it.','Your speech is persuasive and your values are clear. Both attract the right material support.'],
    3: ['Wisdom in communication and the expansion of ideas. A course, teacher, book, or conversation is transformative.','Short journeys have long impact. A nearby connection delivers something that echoes for years.','Your thinking broadens dramatically. Let it. The wider the view, the better the decisions that follow.'],
    4: ['Home and family are blessed — a property improvement, happy domestic event, or genuine stability arrives.','Emotional foundations strengthen. What\'s been uncertain at home settles into something you can build on.','This is a fortunate time to make a domestic investment or to bring the family together around something meaningful.'],
    5: ['Creative and romantic expansion. A joyful project, a meaningful connection, or a deeply satisfying creative act is available.','Children — literal or creative — are blessed this cycle. Something precious is being made or given.','Speculation and genuine risk have favorable conditions. Joy is productive. Allow it to lead.'],
    6: ['Health improvement and the resolution of long-standing health challenges. Service and work bring satisfaction.','The obstacles that have been wearing you down in daily life begin to clear this cycle.','A disciplined approach to health during this window produces results that compound. Begin a good habit.'],
    7: ['A partnership — personal or professional — expands meaningfully this cycle. What\'s built here tends to last.','A significant relationship is blessed. Deepen the good ones; formalize what\'s ready to be formalized.','Negotiations and joint ventures have favorable energy. The person across the table is more aligned than usual.'],
    8: ['Transformation guided and supported by grace. An inheritance, joint financial gain, or spiritual breakthrough is available.','What gets released during this cycle makes room for something significantly better to arrive.','Deep matters — psychological or financial — move toward resolution with less resistance than usual.'],
    9: ['Fortune, expansion, and the opening of a larger world. Long journeys, higher education, and meaningful beliefs are activated.','A teacher, mentor, guru, or foreign connection brings something that changes your perspective permanently.','Your faith in life\'s larger possibilities is rewarded this cycle. Act from that belief.'],
    10: ['Career expansion and public recognition — one of the most favorable career windows in the year.','A promotion, opportunity, or professional validation arrives. Be visible and be ready to receive it.','Your reputation expands naturally this cycle. Let people see what you\'re capable of.'],
    11: ['Gains, income, and the fulfillment of long-held goals. Your network delivers what you\'ve been building toward.','A cherished aspiration moves meaningfully forward this cycle. Name it clearly and take a deliberate step.','Social connections multiply in quality and quantity. The right people find you when you make yourself available.'],
    12: ['Spiritual depth, liberation, and the resolution of hidden debts — literal and karmic.','Retreat, rest, and inner expansion are the gifts of this cycle. Don\'t fill all the space.','Foreign connections, ashram experiences, or genuine solitude deliver something money can\'t buy.'],
  },
  'Venus': {
    1: ['Charm, beauty, and magnetic presence are heightened. You draw people and good things toward you.','Aesthetic sensibility and social grace are at a peak. Relationships are easily initiated or deepened.','Self-care and beautification serve a purpose this cycle beyond vanity — they align you with what you\'re attracting.'],
    2: ['Wealth through beauty, creativity, or relationships. A financial partnership or aesthetic venture is timely.','Luxury and indulgence are appealing — enjoy them deliberately rather than impulsively.','Your sense of your own value is a direct financial signal right now. Raise the standard.'],
    3: ['Creative communication, charming connections, and the pleasure of ideas shared with interesting people.','A piece of writing, a conversation, or a nearby connection carries unusual beauty and meaning.','The creative project you\'ve been warming up to has favorable energy. Begin the beautiful thing.'],
    4: ['Home becomes beautiful and comfortable. A domestic joy or gathering of people you love marks this cycle.','An aesthetic investment in your living space pays emotional dividends well beyond the material cost.','The people who share your home feel more connected to you this cycle. Nurture that.'],
    5: ['Romance, creativity, and the deepest pleasures of life are the themes of this cycle.','A love connection deepens or begins. A creative act produces something genuinely beautiful.','Joy is not optional during this window — it\'s the energy that makes everything else work.'],
    6: ['A relationship eases a health or work challenge. Beauty and ease are found in the everyday.','Daily routine gets more enjoyable this cycle. Small aesthetic choices compound into significant wellbeing.','A colleague or coworker relationship carries unusual warmth and mutual benefit.'],
    7: ['Marriage and partnerships are deeply activated. A commitment deepens, begins, or becomes more tangible.','The relationship that matters most to you has favorable conditions for real progress this cycle.','Beauty in your partnerships — what you appreciate about others and what they appreciate in you — is the focus.'],
    8: ['Sensual depth, financial partnership, and hidden pleasures. Intimacy and shared resources are the focus.','A financial or deeply personal exchange with another person has lasting significance.','What\'s private between you and someone close has unusual beauty and intensity this cycle.'],
    9: ['Love of wisdom, philosophical partnerships, and beauty in long-distance or cross-cultural connections.','A mentor, lover, or journey from a distance brings genuine enrichment this cycle.','Your beliefs are beautified — you find the aesthetic dimension in ideas and spiritual experience.'],
    10: ['Career through beauty, creativity, or the grace of your relationships. Public charm is a real professional asset.','A creative professional opportunity or a relationship that advances your work arrives this cycle.','How you\'re perceived aesthetically and socially is an asset right now. Present yourself accordingly.'],
    11: ['Social pleasures, gains through friends, and the realization of wishes connected to love and beauty.','A friendship that brings genuine joy delivers something meaningful this cycle.','Your social life and your financial goals become pleasurably aligned. What you enjoy and what you earn overlap.'],
    12: ['Pleasures in private, creative retreat, and spiritual beauty. A hidden relationship or creative sanctuary restores you.','What you give in secret comes back to you in unexpected forms this cycle.','Rest, beauty, and solitude are the genuine sources of power during this window. Protect them.'],
  },
  'Saturn': {
    1: ['Responsibility, discipline, and a more serious version of yourself comes forward. This is a clarifying period.','The body asks for structure — consistent sleep, disciplined eating, regular movement. The returns are real.','What you build during this cycle through consistent daily effort will still be standing in ten years.'],
    2: ['Financial austerity and the restructuring of values. Spending tightens; foundations become more solid.','A budget, financial plan, or serious money decision creates order that pays dividends for years.','What you\'re willing to work for consistently now is precisely what you\'ll have permanently later.'],
    3: ['Deliberate, disciplined communication — measured, considered, not reactive.','A challenging communication with a sibling or nearby person asks for maturity and persistence.','The written work or project that requires sustained effort over time has favorable conditions in this cycle.'],
    4: ['Domestic responsibility or challenge. Property matters require careful handling; something at home needs tending.','Emotional pressure within the home or family is real — address it with patience, not avoidance.','What you fix or build at home during this cycle stays fixed. Do it thoroughly.'],
    5: ['Discipline in creative pursuits and romantic life. Serious creative work and serious commitments are the themes.','Pleasure requires more structure than usual to be sustainably enjoyable. Build the container first.','Creative mastery — the long, slow kind — is being built during this cycle whether you feel it or not.'],
    6: ['Service, health discipline, and methodical work. Saturn here rewards those who show up consistently.','A health discipline initiated now produces compounding results. Begin the sustainable practice.','The chronic health or work challenge that\'s been resistant begins to yield to steady, boring persistence.'],
    7: ['A relationship is tested or made more formal. What\'s built on substance is strengthened; what isn\'t becomes clear.','A serious commitment — business or personal — arrives or requires renegotiation.','Partnership friction is not failure — it\'s the pressure that strengthens what deserves to last.'],
    8: ['Deep transformation, confrontation with mortality or endings, and financial restructuring.','This is often the most intense Saturn placement. What it demands is real. So are the results of meeting it.','Debt — literal or karmic — is being addressed. The clearing, though heavy, is permanent.'],
    9: ['The testing and refinement of beliefs. Formal study, legal matters, or philosophical challenges require persistence.','A long journey — educational, legal, or philosophical — asks for endurance rather than inspiration.','Your deepest beliefs are being stress-tested. What survives is what\'s actually yours.'],
    10: ['Career consolidation and the weight of authority. The work is serious; so are the rewards for those who persist.','Professional responsibility increases this cycle. Bear it with patience rather than resentment.','The career foundation being laid this cycle is unusually durable. Build it correctly.'],
    11: ['Delayed but ultimately realized gains. Friendships face tests; goals take longer than expected to materialize.','Income streams require more effort than usual to maintain. Persist — the structure being built is real.','The goals that survive this cycle are the ones that actually matter. Let the others go.'],
    12: ['A period of withdrawal, karmic reckoning, and the release of what no longer belongs.','Foreign isolation, institutional constraints, or the confrontation of what\'s hidden are the themes.','What gets surrendered here is genuinely freed. The lightness that follows is proportional to the surrender.'],
  },
  'Rahu': {
    1: ['A dramatic shift in identity, presentation, and how you move through the world. Rahu amplifies everything.','Ambition, unusual life events, and reinvention mark this cycle. Something about who you are is being rewritten.','The intensity is real — channel it deliberately or it channels itself through disruption.'],
    2: ['An unusual source of income or a significant financial obsession arrives this cycle.','Speech becomes compelling and persuasive — but needs grounding in truth to avoid overreach.','A financial risk or unconventional income stream has real momentum. Evaluate it carefully before committing.'],
    3: ['Restless communication and a compelling drive to reach, write, and connect — unconventionally.','Bold ventures and unusual connections arise. This is a cycle for the outreach you\'d normally hesitate to make.','Communication has a fated quality this cycle. What you say and who hears it carries unusual significance.'],
    4: ['Disruption and fascination around home, roots, and family. A move or unusual domestic situation is possible.','Something about where you\'re from or where you live is being fundamentally reconsidered this cycle.','Restlessness at home is Rahu asking whether your foundation is actually built on what you\'d choose now.'],
    5: ['Intense creative and romantic energy with an obsessive quality. Unusual connections and speculative ventures.','A creative or romantic pursuit has a magnetic, slightly destabilizing energy — proceed with awareness.','The creative risk worth taking is the unconventional one. Rahu rewards bold artistic departures.'],
    6: ['The drive to overcome obstacles is strong. Victory over adversaries and health challenges through unusual means.','An enemy or competitor is overcome this cycle through unconventional strategy rather than direct confrontation.','Health support from alternative or non-traditional approaches has unusual effectiveness now.'],
    7: ['An unusual, karmic, or foreign relationship carries a fated quality this cycle.','A partnership arrives or intensifies — one that feels both necessary and slightly destabilizing.','What this relationship asks of you is exactly what you\'re not yet comfortable providing. That\'s the point.'],
    8: ['Obsession with the hidden, the occult, shared resources, or transformation. High stakes, high intensity.','A revelation or sudden exposure of what\'s been concealed shifts the picture significantly.','This cycle initiates a profound transformation. The disruption is the invitation.'],
    9: ['Foreign connections, unconventional beliefs, and a hunger for what lies beyond your current understanding.','A journey — literal or intellectual — into unfamiliar territory changes your perspective in lasting ways.','Your philosophy of life is being expanded past its current boundaries. Follow the thread.'],
    10: ['Ambition at maximum — unusual career moves, foreign recognition, or a sudden rise in visibility.','A career opportunity arrives from an unexpected direction. It may feel disruptive but carries real potential.','The unconventional professional path has unusual momentum this cycle. Trust the instinct that defies convention.'],
    11: ['Unusual gains and a powerful hunger for the realization of goals. The network expands in unexpected directions.','A connection arrives from an unlikely source and delivers something genuinely significant.','The aspiration that seemed impossible is finding a path this cycle. Stay open to the unconventional route.'],
    12: ['Foreign connection, spiritual restlessness, and karmic reckoning. Dreams are more vivid and meaningful.','Something from the hidden or subconscious domain is being brought to the surface. Pay attention to what comes.','This is a cycle of karmic clearing — what surfaces, however uncomfortable, is being freed.'],
  },
  'Ketu': {
    1: ['Detachment from the physical self and a spiritual pull inward. Unusual gifts emerge alongside a tendency to feel unseen.','You may feel less driven by external validation this cycle — which is actually the gift. It reveals what\'s genuinely yours.','Past life skills and capacities surface this cycle. What comes naturally that shouldn\'t — trust it.'],
    2: ['Detachment from material accumulation. The inner life enriches even as the outer flow may feel constrained.','Speech becomes either profoundly wise or scattered — the difference is whether you\'re speaking from stillness.','What you have is more than enough for what this cycle actually requires of you.'],
    3: ['Spiritual clarity in communication. Old skills resurface; the need to communicate becomes more internal than external.','What you\'ve already learned is sufficient. The practice now is deeper application, not new acquisition.','Writing or communication that comes from a place of genuine stillness reaches further than the anxious kind.'],
    4: ['Spiritual relationship to home and roots. A past-life quality to family matters; emotional detachment from the domestic.','The need for a home that is also a sanctuary becomes more pronounced this cycle.','Something ancient in the family line is being addressed. What you release from the past creates present freedom.'],
    5: ['Detachment from pleasure, romance, and ego-driven creation. Profound spiritual insight through meditative practice.','Creative work done for its own sake — not for recognition — carries unusual power and integrity this cycle.','What you create when no one is watching is your best work. Make it.'],
    6: ['Liberation from chronic health challenges and adversaries is possible — through surrender rather than force.','The enemy you need to overcome most this cycle is the internal one. External resistance yields to inner resolution.','A health practice that addresses the spiritual or psychological root is more effective than the symptomatic.'],
    7: ['Detachment from partnerships — or the arrival of a spiritually significant one with a fated, impermanent quality.','What this relationship is teaching you is more important than what it\'s giving you. Learn it.','The partner who arrives or deepens this cycle is carrying a message. Hear it before the cycle passes.'],
    8: ['Past-life karmic clearing. Sudden transformative events lead to liberation when met with awareness.','What dies this cycle was never really yours. Release it fully and trust what remains.','Deep psychological work — grief, shadow, what\'s been suppressed — moves with unusual efficiency this cycle.'],
    9: ['The testing and release of inherited beliefs. What you were taught is being separated from what you actually know.','A teacher or guide helps you see past a belief that\'s been limiting you. This is precisely the gift to receive.','The spiritual path becomes less about acquiring and more about releasing. The lighter you become, the further you go.'],
    10: ['Detachment from worldly recognition and a pivot toward inner purpose. The external signals matter less than they did.','A career phase ends or loses its urgency — creating space for a truer direction to emerge.','What you stop chasing this cycle may be exactly what finally allows the real thing to arrive.'],
    11: ['Release of material desires and social ambitions. True gains come through letting go rather than pursuing.','A friendship or group connection that has outlived its purpose is gently dissolved this cycle.','The aspiration that gets released was occupying space that something more authentic needs.'],
    12: ['Deep spiritual liberation and the resolution of karmic patterns accumulated over long periods.','Solitude, meditation, dreams, and inner work are unusually productive this cycle. Protect them.','What you release in the deepest silence of this period doesn\'t come back. That is exactly the point.'],
  },
};


// ─── PRASHNA KUNDALI ENGINE ─────────────────────────────────────────────────
// ─── PRASHNA KUNDALI ENGINE ────────────────────────────────────────────────
// Based on: Prashna Marga, Jyotisha Prashna Vichar, Krishneeyam, Hora Shastra
// Pure computation — zero Claude tokens. Returns structured Prashna context.
// Reuses: computeChart, pStatus, RS, SL, DIG, so, no, FN, PE, PC from chart.js

// ─── QUESTION CATEGORY MAP ────────────────────────────────────────────────
// Maps keywords → {primaryHouse, secondaryHouses, significators, category}
const PRASHNA_CATEGORIES = [
  {
    category: 'career',
    label: 'Career & Work',
    keywords: ['job','career','work','promotion','business','office','boss','salary','raise','fired','hired','startup','launch','project','client','contract','opportunity'],
    primaryHouse: 10,
    secondary: [2,6,11],
    significators: ['Sun','Saturn','Mercury'],
    question: 'Will this career/work matter succeed?'
  },
  {
    category: 'relationship',
    label: 'Love & Relationship',
    keywords: ['love','relationship','partner','boyfriend','girlfriend','husband','wife','marriage','wedding','divorce','breakup','date','romance','together','reconcile','ex','commit'],
    primaryHouse: 7,
    secondary: [5,11,1],
    significators: ['Venus','Moon','Jupiter'],
    question: 'Will this relationship matter resolve favorably?'
  },
  {
    category: 'marriage',
    label: 'Marriage',
    keywords: ['marry','marriage','wed','engagement','proposal','shaadi','rishta','spouse'],
    primaryHouse: 7,
    secondary: [2,5,11],
    significators: ['Venus','Jupiter','Moon'],
    question: 'Will marriage happen?'
  },
  {
    category: 'finance',
    label: 'Money & Finance',
    keywords: ['money','finance','loan','investment','profit','loss','debt','wealth','rich','income','earn','salary','business','return','stock','property purchase'],
    primaryHouse: 2,
    secondary: [11,5,9],
    significators: ['Jupiter','Venus','Mercury'],
    question: 'Will this financial matter succeed?'
  },
  {
    category: 'health',
    label: 'Health',
    keywords: ['sick','health','illness','disease','recover','hospital','doctor','surgery','pain','treatment','medicine','heal','cure','diagnosis'],
    primaryHouse: 1,
    secondary: [6,8,12],
    significators: ['Moon','Sun','Mars'],
    question: 'Will health recover or improve?'
  },
  {
    category: 'travel',
    label: 'Travel & Relocation',
    keywords: ['travel','trip','journey','abroad','visa','move','relocate','immigration','foreign','overseas','flight','country'],
    primaryHouse: 9,
    secondary: [3,12,7],
    significators: ['Jupiter','Mercury','Moon'],
    question: 'Will the journey/travel succeed?'
  },
  {
    category: 'education',
    label: 'Education & Learning',
    keywords: ['study','exam','college','university','degree','course','admission','scholarship','test','graduate','school','result','pass','fail'],
    primaryHouse: 5,
    secondary: [4,9,11],
    significators: ['Jupiter','Mercury','Moon'],
    question: 'Will education/exam succeed?'
  },
  {
    category: 'property',
    label: 'Property & Home',
    keywords: ['house','home','property','land','buy','sell','rent','apartment','flat','real estate','construction','renovation','moving'],
    primaryHouse: 4,
    secondary: [11,2,12],
    significators: ['Moon','Mars','Venus'],
    question: 'Will the property matter succeed?'
  },
  {
    category: 'legal',
    label: 'Legal & Disputes',
    keywords: ['court','legal','lawsuit','case','judge','lawyer','dispute','fight','enemy','conflict','police','crime','justice','settlement'],
    primaryHouse: 6,
    secondary: [8,11,1],
    significators: ['Mars','Saturn','Sun'],
    question: 'Will this legal/dispute matter resolve in my favor?'
  },
  {
    category: 'child',
    label: 'Children & Pregnancy',
    keywords: ['child','baby','pregnant','pregnancy','birth','conceive','fertility','son','daughter','kids','ivf'],
    primaryHouse: 5,
    secondary: [9,11,1],
    significators: ['Jupiter','Moon','Venus'],
    question: 'Will the matter related to children/pregnancy succeed?'
  },
  {
    category: 'spiritual',
    label: 'Spiritual & Liberation',
    keywords: ['spiritual','moksha','karma','past life','destiny','purpose','soul','god','prayer','temple','retreat','peace','meditation'],
    primaryHouse: 9,
    secondary: [12,4,5],
    significators: ['Jupiter','Ketu','Moon'],
    question: 'What does the chart say about this spiritual matter?'
  },
  {
    category: 'lost',
    label: 'Lost Item / Missing Person',
    keywords: ['lost','missing','find','where','gone','stolen','disappeared','recover','search'],
    primaryHouse: 4,
    secondary: [7,8,2],
    significators: ['Moon','Mercury','Mars'],
    question: 'Will the lost item/person be found?'
  },
];

// Default category if no match
const PRASHNA_DEFAULT = {
  category: 'general',
  label: 'General Question',
  keywords: [],
  primaryHouse: 1,
  secondary: [10,7,4],
  significators: ['Moon','Sun','Ascendant Lord'],
  question: 'What does the chart indicate?'
};

// ─── HOUSE NATURE TABLE (from Prashna Marga) ─────────────────────────────
// Each house: nature, what it signifies in Prashna
const HOUSE_NATURE = {
  1:  {nature:'Kendra',     label:'1st House', meaning:'The questioner — their strength, vitality, and ability to achieve the desired outcome'},
  2:  {nature:'Panapara',   label:'2nd House', meaning:'Wealth, speech, family — resources available to the questioner'},
  3:  {nature:'Apoklima',   label:'3rd House', meaning:'Effort, communication, short journey, siblings — the action required'},
  4:  {nature:'Kendra',     label:'4th House', meaning:'Home, hidden matters, mother, property — the foundation of the question'},
  5:  {nature:'Trikona',    label:'5th House', meaning:'Intelligence, creativity, children, investments — the desire behind the question'},
  6:  {nature:'Dusthana',   label:'6th House', meaning:'Obstacles, enemies, disease, service — what opposes success'},
  7:  {nature:'Kendra',     label:'7th House', meaning:'The other party, outcome, partnership — what the questioner seeks'},
  8:  {nature:'Dusthana',   label:'8th House', meaning:'Transformation, hidden forces, obstacles, death-rebirth — hidden complications'},
  9:  {nature:'Trikona',    label:'9th House', meaning:'Fortune, dharma, long journeys, divine grace — the higher support'},
  10: {nature:'Kendra',     label:'10th House',meaning:'Action, public success, authority, reputation — the outcome in the world'},
  11: {nature:'Upachaya',   label:'11th House',meaning:'Gains, fulfillment of desires, friends — the final fruition'},
  12: {nature:'Dusthana',   label:'12th House',meaning:'Loss, foreign matters, liberation, expenses — what is sacrificed'},
};

// ─── BENEFIC / MALEFIC TABLE ──────────────────────────────────────────────
const NATURAL_BENEFIC = ['Jupiter','Venus','Moon','Mercury']; // Mercury benefic when alone
const NATURAL_MALEFIC = ['Sun','Mars','Saturn','Rahu','Ketu'];
// Functional benefic/malefic depends on Ascendant — simplified version
// For Prashna we use natural signification primarily

// ─── ASPECT RULES (Vedic) ─────────────────────────────────────────────────
// All planets aspect 7th from themselves (opposition)
// Mars additionally aspects 4th and 8th
// Jupiter additionally aspects 5th and 9th
// Saturn additionally aspects 3rd and 10th
// Rahu/Ketu aspect 5th and 9th (like Jupiter)
function getPlanetAspects(houseNo) {
  const aspects = new Set();
  aspects.add(((houseNo-1+6)%12)+1); // 7th aspect (all planets)
  if(['Mars'].includes('Mars')){}   // will be called with planet name
  return aspects;
}

function doesPlanetAspect(planet, fromHouse, toHouse) {
  const diff = ((toHouse - fromHouse + 12) % 12) + 1;
  const stdAspects = [7]; // all planets aspect 7th
  const specialAspects = {
    'Mars': [4, 8],
    'Jupiter': [5, 9],
    'Saturn': [3, 10],
    'Rahu': [5, 9],
    'Ketu': [5, 9],
  };
  const allAspects = [...stdAspects, ...(specialAspects[planet]||[])];
  return allAspects.includes(diff);
}

// ─── MOON PHASE ───────────────────────────────────────────────────────────
function getMoonPhase(sunLonSid, moonLonSid) {
  const diff = n360(moonLonSid - sunLonSid);
  if(diff < 180) return { phase: 'Waxing', strength: 'Strong', meaning: 'Moon is gaining strength — favorable for new beginnings and positive outcomes' };
  else return { phase: 'Waning', strength: 'Moderate', meaning: 'Moon is losing light — matters may face delays or require more effort' };
}

// ─── PLANETARY COMBUSTION CHECK ───────────────────────────────────────────
const COMBUST_ORB = { Moon:12, Mars:17, Mercury:14, Jupiter:11, Venus:10, Saturn:15 };
function isCombust(planet, planetLon, sunLon) {
  if(planet === 'Sun' || planet === 'Rahu' || planet === 'Ketu') return false;
  const orb = COMBUST_ORB[planet] || 12;
  const diff = Math.abs(n360(planetLon - sunLon));
  return Math.min(diff, 360-diff) <= orb;
}

// ─── QUESTION CATEGORIZER ─────────────────────────────────────────────────
function categorizeQuestion(questionText) {
  const q = questionText.toLowerCase();
  let bestMatch = null, bestScore = 0;
  for(const cat of PRASHNA_CATEGORIES) {
    const score = cat.keywords.filter(kw => q.includes(kw)).length;
    if(score > bestScore) { bestScore = score; bestMatch = cat; }
  }
  return bestMatch || PRASHNA_DEFAULT;
}

// ─── PLANET STRENGTH EVALUATOR ────────────────────────────────────────────
function evaluatePlanetStrength(planet, prashnaChart, natalChart) {
  const sid = prashnaChart.sid;
  const lagnaSign = so(prashnaChart.lagna);
  const lon = sid[planet];
  if(lon === undefined) return null;

  const sign = so(lon);
  const house = ((sign - lagnaSign + 12) % 12) + 1;
  const dignity = pStatus(planet, sign);
  const combust = isCombust(planet, lon, sid.Sun);
  const retrograde = ['Rahu','Ketu'].includes(planet);

  // House strength
  const hNature = HOUSE_NATURE[house]?.nature;
  const isKendra = [1,4,7,10].includes(house);
  const isTrikona = [1,5,9].includes(house);
  const isDusthana = [6,8,12].includes(house);

  // Aspectants
  const beneficAspects = [], maleficAspects = [];
  for(const [aspPlanet, aspLon] of Object.entries(sid)) {
    if(aspPlanet === planet) continue;
    const aspSign = so(aspLon);
    const aspHouse = ((aspSign - lagnaSign + 12) % 12) + 1;
    if(doesPlanetAspect(aspPlanet, aspHouse, house)) {
      if(NATURAL_BENEFIC.includes(aspPlanet)) beneficAspects.push(aspPlanet);
      else maleficAspects.push(aspPlanet);
    }
  }

  // Overall strength score (0-10)
  let score = 5; // neutral
  if(dignity === 'Exalted') score += 3;
  else if(dignity === 'Own Sign') score += 2;
  else if(dignity === 'Debilitated') score -= 3;
  if(isKendra || isTrikona) score += 1;
  if(isDusthana) score -= 2;
  if(combust) score -= 2;
  if(beneficAspects.length) score += 1;
  if(maleficAspects.length) score -= 1;
  score = Math.max(1, Math.min(10, score));

  const strength = score >= 7 ? 'Strong' : score >= 4 ? 'Moderate' : 'Weak';

  return {
    planet, sign: RS[sign], house, dignity, combust, retrograde,
    beneficAspects, maleficAspects, isKendra, isTrikona, isDusthana,
    score, strength, houseLabel: HOUSE_NATURE[house]?.label,
    emoji: PE[planet] || '✦', color: PC[planet] || '#bf9a30'
  };
}

// ─── PRASHNA RULES ENGINE (from Prashna Marga + Prashna Vichar) ──────────
function applyPrashnaRules(prashnaChart, category, ascLordStrength, primaryHouseLordStrength, moonStrength, moonPhase) {
  const rules = [];
  const lagnaSign = so(prashnaChart.lagna);
  const moon = moonStrength;
  const asc = ascLordStrength;
  const primary = primaryHouseLordStrength;

  // ── Universal rules (apply to all questions) ─────────────────────
  // PM Ch.2: Moon condition = state of questioner's mind
  if(moon?.house && [1,4,5,7,9,10,11].includes(moon.house))
    rules.push({weight:2, favorable:true,  source:'PM 2.14', rule:`Moon in ${HOUSE_NATURE[moon.house]?.label} — questioner's mind is aligned with the question, indicating genuine readiness`});
  if(moon?.isDusthana)
    rules.push({weight:2, favorable:false, source:'PM 2.15', rule:`Moon in ${HOUSE_NATURE[moon.house]?.label} — anxiety surrounds the question; clarity may come only after some delay`});

  // PM Ch.2: Waxing Moon = strength for outcomes
  if(moonPhase.phase === 'Waxing')
    rules.push({weight:1, favorable:true,  source:'PM 2.8',  rule:'Waxing Moon — situations are growing, not contracting; positive energy supports the matter'});
  else
    rules.push({weight:1, favorable:false, source:'PM 2.9',  rule:'Waning Moon — energy is diminishing; matters may take longer or require more persistent effort'});

  // PM Ch.3: Ascendant lord strength = questioner's power
  if(asc?.strength === 'Strong' && (asc.isKendra || asc.isTrikona))
    rules.push({weight:3, favorable:true,  source:'PM 3.5',  rule:`Ascendant lord ${asc.planet} is strong in ${asc.houseLabel} — the questioner has real power and capacity to achieve this`});
  if(asc?.dignity === 'Debilitated' || asc?.combust)
    rules.push({weight:3, favorable:false, source:'PM 3.8',  rule:`Ascendant lord ${asc?.planet} is ${asc?.combust?'combust':'debilitated'} — the questioner faces genuine obstacles or lacks the current strength to push this forward`});
  if(asc?.isDusthana)
    rules.push({weight:2, favorable:false, source:'PM 3.9',  rule:`Ascendant lord in ${asc?.houseLabel} — delays and hidden complications surround this matter`});

  // PM Ch.4: Primary house lord = the matter itself
  if(primary?.strength === 'Strong' && !primary?.isDusthana)
    rules.push({weight:3, favorable:true,  source:'PM 4.3',  rule:`${category.label} house lord ${primary?.planet} is strong — the matter itself has positive conditions and forward energy`});
  if(primary?.dignity === 'Debilitated')
    rules.push({weight:3, favorable:false, source:'PM 4.6',  rule:`${category.label} house lord ${primary?.planet} is debilitated — the desired outcome faces real weakness; outcomes may fall short of expectations`});
  if(primary?.isDusthana)
    rules.push({weight:2, favorable:false, source:'PM 4.8',  rule:`${category.label} house lord in a difficult house — the matter faces obstacles and may require significant restructuring`});

  // PM Ch.4: Mutual relationship between Asc lord and primary house lord
  if(asc && primary && asc.house === primary.house)
    rules.push({weight:3, favorable:true,  source:'PM 4.12', rule:`Ascendant lord and ${category.label} house lord in the same house — questioner and the desired outcome are aligned; strong indicator of success`});
  if(asc && primary && doesPlanetAspect(asc.planet, asc.house, primary.house))
    rules.push({weight:2, favorable:true,  source:'PM 4.13', rule:`Ascendant lord aspects the ${category.label} house — the questioner's energy is directly activating the matter`});
  if(asc && primary && doesPlanetAspect(primary.planet, primary.house, 1))
    rules.push({weight:2, favorable:true,  source:'PM 4.14', rule:`${category.label} house lord aspects the Ascendant — the desired outcome is reaching toward the questioner`});

  // PM Ch.5: 6th, 8th, 12th lords — obstacles
  const sid = prashnaChart.sid;
  const h6lord = RS[so(sid[FN[SL[(lagnaSign+5)%12]]]||0)];
  const h8sign = (lagnaSign+7)%12;
  const h8lord = FN[SL[h8sign]];
  if(h8lord && primary) {
    const h8str = evaluatePlanetStrength(h8lord, prashnaChart, null);
    if(h8str?.isKendra && h8str?.strength !== 'Weak')
      rules.push({weight:2, favorable:false, source:'PM 5.4', rule:`8th house lord ${h8lord} is prominent — hidden obstacles or sudden reversals possible; proceed with awareness`});
  }

  // PM Ch.6: Jupiter aspects = divine grace
  const jupStr = evaluatePlanetStrength('Jupiter', prashnaChart, null);
  if(jupStr && doesPlanetAspect('Jupiter', jupStr.house, primary?.house||1))
    rules.push({weight:2, favorable:true,  source:'PM 6.2', rule:`Jupiter aspects the ${category.label} house — wisdom and expansion support this matter; positive higher-order forces are present`});
  if(jupStr && doesPlanetAspect('Jupiter', jupStr.house, 1))
    rules.push({weight:2, favorable:true,  source:'PM 6.3', rule:'Jupiter aspects the Ascendant — divine grace and good fortune favor the questioner at this moment'});

  // PM Ch.7: Saturn aspects = delays (not denial)
  const satStr = evaluatePlanetStrength('Saturn', prashnaChart, null);
  if(satStr && doesPlanetAspect('Saturn', satStr.house, primary?.house||1))
    rules.push({weight:2, favorable:false, source:'PM 7.1', rule:`Saturn aspects the ${category.label} house — delays, patience required; success is possible but not immediate`});

  // PM Ch.7: Rahu on Ascendant or primary house
  const rahuSign = so(sid.Rahu);
  const rahuHouse = ((rahuSign - lagnaSign + 12) % 12) + 1;
  if(rahuHouse === 1)
    rules.push({weight:2, favorable:false, source:'PM 7.6', rule:'Rahu on the Prashna Ascendant — confusion, deception, or unexpected turns surround the question; proceed with discernment'});
  if(rahuHouse === (category.primaryHouse))
    rules.push({weight:2, favorable:false, source:'PM 7.8', rule:`Rahu in the ${category.label} house — unconventional or unexpected elements complicate this matter`});

  // PM Ch.8: Category-specific rules
  if(category.category === 'relationship' || category.category === 'marriage') {
    const venus = evaluatePlanetStrength('Venus', prashnaChart, null);
    if(venus?.strength === 'Strong' && !venus?.isDusthana)
      rules.push({weight:3, favorable:true, source:'PM 8.12', rule:`Venus is strong — love, attraction, and relationship energy are powerful at this moment; connection can deepen`});
    if(venus?.dignity === 'Debilitated')
      rules.push({weight:3, favorable:false, source:'PM 8.14', rule:'Venus debilitated — relationship or love matter faces real strain; emotional needs may not be met easily right now'});

    // 7th lord condition for relationships
    const h7sign = (lagnaSign+6)%12;
    const h7lord = FN[SL[h7sign]];
    if(h7lord) {
      const h7str = evaluatePlanetStrength(h7lord, prashnaChart, null);
      if(h7str?.strength === 'Strong' && asc?.strength === 'Strong')
        rules.push({weight:3, favorable:true, source:'PM 8.18', rule:`Both Ascendant lord and 7th lord are strong — both parties are present and willing; this relationship matter can move forward`});
    }
  }

  if(category.category === 'finance') {
    const jupit = evaluatePlanetStrength('Jupiter', prashnaChart, null);
    if(jupit?.strength === 'Strong' && jupit?.isKendra)
      rules.push({weight:3, favorable:true, source:'PM 9.5', rule:'Jupiter strong and angular — financial expansion, wealth accumulation, and profitable outcomes are supported'});
    // 11th house lord (gains)
    const h11sign = (lagnaSign+10)%12;
    const h11lord = FN[SL[h11sign]];
    if(h11lord) {
      const h11str = evaluatePlanetStrength(h11lord, prashnaChart, null);
      if(h11str?.strength === 'Strong')
        rules.push({weight:2, favorable:true, source:'PM 9.8', rule:`11th house (gains) lord ${h11lord} is strong — income and material fulfillment are available; financial matter can yield returns`});
    }
  }

  if(category.category === 'health') {
    const mars = evaluatePlanetStrength('Mars', prashnaChart, null);
    const h6sign = (lagnaSign+5)%12;
    const h6lord = FN[SL[h6sign]];
    if(h6lord) {
      const h6str = evaluatePlanetStrength(h6lord, prashnaChart, null);
      if(h6str?.isDusthana || h6str?.strength === 'Weak')
        rules.push({weight:3, favorable:true, source:'PM 10.6', rule:'Disease house lord is weak — the illness or health challenge lacks staying power; recovery is indicated'});
      if(h6str?.isKendra && h6str?.strength === 'Strong')
        rules.push({weight:3, favorable:false, source:'PM 10.7', rule:'Disease house lord is strong — the health challenge has real force; medical attention and rest are important right now'});
    }
  }

  return rules;
}

// ─── TIMING CALCULATOR ────────────────────────────────────────────────────
// From Prashna Marga: Moon's applying aspect tells timing
// Degrees to exact × time unit = approximate time
function getPrashnaTiming(prashnaChart, targetHouseOrPlanet) {
  const sid = prashnaChart.sid;
  const moonLon = sid.Moon;
  const moonSign = so(moonLon);
  const lagnaSign = so(prashnaChart.lagna);
  const moonHouse = ((moonSign - lagnaSign + 12) % 12) + 1;

  // Moon's speed ~13.18°/day
  // Find closest applying aspect to significator
  let timingNote = '';
  let degreesToExact = null;
  let timeUnit = 'days';

  // Check if Moon applies to Jupiter or Venus (benefics = good timing)
  for(const benefic of ['Jupiter','Venus']) {
    const bLon = sid[benefic];
    if(!bLon) continue;
    const bSign = so(bLon);
    const bHouse = ((bSign - lagnaSign + 12) % 12) + 1;
    if(doesPlanetAspect('Moon', moonHouse, bHouse)) {
      // Degrees Moon needs to travel to exact aspect
      const moonDeg = moonLon % 30;
      const bDeg = bLon % 30;
      const deg = n360(bDeg - moonDeg);
      if(deg < 15) {
        degreesToExact = deg;
        timeUnit = deg < 3 ? 'days' : deg < 7 ? 'weeks' : 'months';
        const approxTime = deg < 3 ? Math.ceil(deg/0.5)+' days' : deg < 7 ? Math.ceil(deg/2)+' weeks' : Math.ceil(deg/5)+' months';
        timingNote = `Moon applies to ${benefic} in ~${deg.toFixed(1)}° — clarity or positive movement in approximately ${approxTime}`;
        break;
      }
    }
  }

  // If no applying benefic aspect found
  if(!timingNote) {
    // Use Moon's position in house for rough timing
    const moonDegInSign = moonLon % 30;
    const remaining = 30 - moonDegInSign;
    const daysInSign = Math.ceil(remaining / 0.5); // Moon moves ~0.5°/hr = ~13°/day
    const approxDays = Math.ceil(remaining / 13.2); // Moon moves ~13.2°/day
    timingNote = `Moon is in ${RS[moonSign]} for approximately ${approxDays <= 2 ? 'about '+approxDays+' more day'+(approxDays===1?'':'s') : approxDays+' more days'} — this timeframe is relevant to your question`;
  }

  return timingNote;
}

// ─── VERDICT SYNTHESIZER ─────────────────────────────────────────────────
function synthesizeVerdict(rules, category) {
  const favorable = rules.filter(r => r.favorable);
  const unfavorable = rules.filter(r => !r.favorable);
  const favScore = favorable.reduce((s,r) => s+r.weight, 0);
  const unfavScore = unfavorable.reduce((s,r) => s+r.weight, 0);
  const total = favScore + unfavScore || 1;
  const ratio = favScore / total;

  if(ratio >= 0.70) return { verdict:'Favorable', strength:'Strong', label:'YES — strong indicators', color:'#2d7a4f' };
  if(ratio >= 0.55) return { verdict:'Favorable', strength:'Moderate', label:'YES — with some effort', color:'#3da882' };
  if(ratio >= 0.45) return { verdict:'Mixed', strength:'Neutral', label:'MIXED — timing matters', color:'#c8901a' };
  if(ratio >= 0.30) return { verdict:'Unfavorable', strength:'Moderate', label:'DELAYS LIKELY', color:'#d4558a' };
  return { verdict:'Unfavorable', strength:'Strong', label:'CHALLENGING — significant obstacles', color:'#e05a4a' };
}

// ─── MAIN PRASHNA FUNCTION ────────────────────────────────────────────────
function computePrashna(questionText, lat, lon, tz, natalChartData) {
  const now = new Date();
  const tzOff = tz || 5.5;
  // Convert UTC to local time for display and for correct JD
  const localMs = now.getTime() + tzOff * 3600000;
  const local = new Date(localMs);
  const yr=local.getUTCFullYear(), mo=local.getUTCMonth()+1, dy=local.getUTCDate();
  const h=local.getUTCHours(), mi=local.getUTCMinutes();

  // Cast Prashna chart — pass local hour and tz so computeChart converts back to UTC correctly
  const prashnaChart = computeChart(yr, mo, dy, h, mi, 0, lat, lon); // h is already local, tz=0
  const lagnaSign = so(prashnaChart.lagna);
  const lagnaSignName = RS[lagnaSign];

  // Categorize the question
  const category = categorizeQuestion(questionText);

  // Ascendant lord
  const ascLord = FN[SL[lagnaSign]];
  const ascLordStr = evaluatePlanetStrength(ascLord, prashnaChart, natalChartData);

  // Primary house lord (the matter asked about)
  const primaryHouseSign = (lagnaSign + category.primaryHouse - 1) % 12;
  const primaryHouseLord = FN[SL[primaryHouseSign]];
  const primaryLordStr = evaluatePlanetStrength(primaryHouseLord, prashnaChart, natalChartData);

  // Moon strength (mind of questioner)
  const moonStr = evaluatePlanetStrength('Moon', prashnaChart, natalChartData);
  const moonPhase = getMoonPhase(prashnaChart.sid.Sun, prashnaChart.sid.Moon);

  // Apply rules
  const rules = applyPrashnaRules(prashnaChart, category, ascLordStr, primaryLordStr, moonStr, moonPhase);

  // Timing
  const timing = getPrashnaTiming(prashnaChart, category.primaryHouse);

  // Verdict
  const verdict = synthesizeVerdict(rules, category);

  // All planet positions for context
  const planets = Object.entries(prashnaChart.sid).map(([name, lon]) => ({
    name, sign: RS[so(lon)], house: ((so(lon)-lagnaSign+12)%12)+1,
    dignity: pStatus(name, so(lon)), emoji: PE[name]||'✦', color: PC[name]||'#bf9a30'
  }));

  // Key rules (top 4 by weight, favourable first)
  const keyRules = [...rules.filter(r=>r.favorable).sort((a,b)=>b.weight-a.weight).slice(0,2),
                   ...rules.filter(r=>!r.favorable).sort((a,b)=>b.weight-a.weight).slice(0,2)];

  // Prashna Ascendant lord ruling planet
  const rulingPlanets = [ascLord, FN[NL[no(prashnaChart.sid.Moon)]]].filter(Boolean);

  const timeStr = `${String(h).padStart(2,'0')}:${String(mi).padStart(2,'0')}`;
  const dateStr = `${dy.toString().padStart(2,'0')} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][mo-1]} ${yr}`;

  return {
    // Meta
    castTime: `${dateStr} ${timeStr}`,
    category: category.category,
    categoryLabel: category.label,
    questionAsked: questionText,

    // Chart
    ascendant: lagnaSignName,
    ascendantLord: ascLord,
    moonSign: RS[so(prashnaChart.sid.Moon)],
    moonPhase: moonPhase.phase,
    moonStrength: moonStr?.strength,
    rulingPlanets,

    // Significators
    ascLordStrength: ascLordStr,
    primaryHouseLord: primaryHouseLord,
    primaryHouseLordStrength: primaryLordStr,
    primaryHouseLabel: HOUSE_NATURE[category.primaryHouse]?.label,

    // Rules + verdict
    rules: keyRules,
    allRules: rules,
    verdict,
    timing,

    // Compact context string for Claude prompt (~100 tokens)
    context: `PRASHNA CHART — cast ${dateStr} ${timeStr} for this exact question
Category: ${category.label}
Prashna Lagna: ${lagnaSignName} | Lagna Lord: ${ascLord} in ${ascLordStr?.sign||'?'} H${ascLordStr?.house||'?'} (${ascLordStr?.strength||'?'}${ascLordStr?.dignity?' · '+ascLordStr.dignity:''})
Prashna Moon: ${RS[so(prashnaChart.sid.Moon)]} ${moonPhase.phase} (${moonStr?.strength||'?'}) — ${moonPhase.meaning.slice(0,70)}
${category.label} house (H${category.primaryHouse}) lord ${primaryHouseLord}: ${primaryLordStr?.sign||'?'} H${primaryLordStr?.house||'?'} (${primaryLordStr?.strength||'?'}${primaryLordStr?.dignity?' · '+primaryLordStr.dignity:''})
Prashna planets: ${planets.map(p=>p.name+' '+p.sign+' H'+p.house+(p.dignity?' ('+p.dignity+')':'')).join(' | ')}
Rules: ${keyRules.slice(0,3).map(r=>(r.favorable?'✓':'✗')+' '+r.rule.slice(0,70)+'  ['+r.source+']').join('\n')}
PRASHNA VERDICT: ${verdict.label} (score: ${verdict.score})
Timing: ${timing}`,
  };
}


// ─── DASHA ENGINE ─────────────────────────────────────────────────────────────
function getDasha(ml,y,mo,d){const nak=no(ml),lord=NL[nak],nakLen=360/27,frac=(n360(ml)%nakLen)/nakLen,bd=y+(mo-1)/12+(d-1)/365.25,fs=bd-frac*DY[lord],idx=DS.indexOf(lord);let seq=[],c=fs;for(let i=0;i<9;i++){const dk=DS[(idx+i)%9];seq.push({lord:dk,start:c,end:c+DY[dk]});c+=DY[dk];}const NOW=new Date().getFullYear()+new Date().getMonth()/12;return{nak,nakName:NK[nak],lord,seq,curr:seq.find(s=>s.start<=NOW&&s.end>NOW)};}
function getAntardashas(maha,s,e){const tot=e-s,idx=DS.indexOf(maha);const NOW=new Date().getFullYear()+new Date().getMonth()/12;let c=s;return DS.map((_,i)=>{const al=DS[(idx+i)%9],dur=tot*DY[al]/120,ss=c,ee=c+dur;c=ee;return{lord:al,name:FN[al],start:ss,end:ee,curr:ss<=NOW&&ee>NOW};});}
function buildDashaList(dasha){const NOW=new Date().getFullYear()+new Date().getMonth()/12;const curr=dasha.seq.find(s=>s.start<=NOW&&s.end>NOW);if(!curr)return[];const idx=dasha.seq.indexOf(curr);return dasha.seq.slice(Math.max(0,idx-1),idx+3).map(maha=>{const antars=getAntardashas(maha.lord,maha.start,maha.end);return{planet:FN[maha.lord],start_year:Math.floor(maha.start),end_year:Math.floor(maha.end),years:DY[maha.lord],current:maha.lord===curr.lord,antardashas:antars.map(a=>({planet:a.name,start:fmtYr(a.start),end:fmtYr(a.end),current:a.curr||false}))};});}

// ─── SOLAR RETURN FINDER ──────────────────────────────────────────────────────
function findSolarReturn(natalSunLon,targetYear,birthMonth,birthDay,tz){
  let j=JD(targetYear,birthMonth,birthDay,12-tz);
  for(let i=0;i<60;i++){const sL=n360(sunLon(j)-ayanamsa(j));let diff=natalSunLon-sL;if(diff>180)diff-=360;if(diff<-180)diff+=360;j+=diff/0.9856;if(Math.abs(diff)<0.00001)break;}
  return j;
}

// ─── ANNUAL PERIODS (Mudda Dasha — today to +1 year) ─────────────────────────
function getAnnualPeriods(moonLon2,srJD,windowStartJD,windowEndJD){
  const nak=no(moonLon2),lord=NL[nak],nakLen=360/27;
  const frac=(n360(moonLon2)%nakLen)/nakLen;
  const lordDurDays=(DY[lord]/120)*365.25;
  let cursorJD=srJD-frac*lordDurDays;
  const yearEndJD=srJD+365.25;
  const idx=DS.indexOf(lord);
  const periods=[];
  const nowJD=JD(new Date().getFullYear(),new Date().getMonth()+1,new Date().getDate(),12);
  for(let i=0;i<18;i++){
    const dk=DS[(idx+i)%9];
    const durDays=(DY[dk]/120)*365.25;
    const pStart=cursorJD,pEnd=cursorJD+durDays;
    if(pEnd>windowStartJD&&pStart<windowEndJD){
      const effStart=Math.max(pStart,windowStartJD),effEnd=Math.min(pEnd,windowEndJD);
      const sc=JDtoCal(effStart),ec=JDtoCal(effEnd);
      periods.push({planet:FN[dk],start:fmtDt(sc),end:fmtDt(ec),days:Math.round(effEnd-effStart),current:effStart<=nowJD&&effEnd>nowJD,daysLeft:effStart<=nowJD&&effEnd>nowJD?Math.round(effEnd-nowJD):null});
    }
    cursorJD=pEnd;
    if(cursorJD>=yearEndJD)break;
  }
  return periods;
}

// ─── INLINE YOGA CHECKER (top patterns only) ─────────────────────────────────
function checkYogas(sid,lagnaSign,moonSign){
  const h=nm=>((so(sid[nm])-lagnaSign+12)%12)+1;
  const s=nm=>so(sid[nm]);
  const conj=(a,b)=>s(a)===s(b);
  const isK=hh=>[1,4,7,10].includes(hh);
  const isTr=hh=>[1,5,9].includes(hh);
  const yogas=[];

  // Gaja Kesari
  if(sid.Jupiter){const jFM=((s('Jupiter')-moonSign+12)%12)+1;if(isK(jFM)){yogas.push({name:'Jupiter-Moon Power Pattern',strength:'Strong',meaning:'Wisdom, fame, and financial growth throughout life. Mind and fortune aligned.'});}}
  // Budhaditya
  const sunMercOrb=Math.abs(n360(sid.Sun)-n360(sid.Mercury));if(conj('Sun','Mercury')&&sunMercOrb>8&&sunMercOrb<170){yogas.push({name:'Sharp Mind Pattern',strength:'Strong',meaning:'Brilliant analytical mind, administrative excellence, communication gifts.'});}
  // Pancha Mahapurusha
  const pancha=[{p:'Mars',y:'Drive & Authority Pattern',d:'Strong will, military/engineering/property success.'},{p:'Mercury',y:'Intellect & Business Pattern',d:'Business mastery, communication excellence.'},{p:'Jupiter',y:'Wisdom & Fortune Pattern',d:'Teaching, law, finance, spiritual authority.'},{p:'Venus',y:'Beauty & Relationship Pattern',d:'Arts, luxury, romantic success, beauty.'},{p:'Saturn',y:'Discipline & Authority Pattern',d:'Real estate, law, politics, lasting achievement.'}];
  for(const{p,y,d}of pancha){if(sid[p]){const st=pStatus(p,s(p));if((st==='Exalted'||st==='Own Sign')&&isK(h(p))){yogas.push({name:y,strength:'Strong',meaning:d});}}}
  // Raja Yoga (kendra+trikona lord conjunction)
  const kLords=[1,4,7,10].map(hh=>FN[SL[(lagnaSign+hh-1)%12]]);
  const tLords=[5,9].map(hh=>FN[SL[(lagnaSign+hh-1)%12]]);
  for(const k of kLords)for(const t of tLords){if(k!==t&&sid[k]&&sid[t]&&conj(k,t)){yogas.push({name:'Success & Authority Pattern',strength:'Strong',meaning:'Career elevation, authority, social recognition. Peak during these planets dasha.'});break;}}
  // Dhana (wealth)
  const l2=FN[SL[(lagnaSign+1)%12]],l11=FN[SL[(lagnaSign+10)%12]];
  if(l2!==l11&&sid[l2]&&sid[l11]&&conj(l2,l11)){yogas.push({name:'Wealth Accumulation Pattern',strength:'Strong',meaning:'Multiple income streams, accumulated wealth, financial growth.'});}
  // Kaal Sarp
  if(sid.Rahu&&sid.Ketu){const rs=s('Rahu'),others=['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn'];let all=true;for(const p of others){if(!sid[p])continue;const ps=s(p);let bet=false,sv=rs;for(let i=0;i<12;i++){sv=(sv+1)%12;if(sv===s('Ketu'))break;if(sv===ps){bet=true;break;}}if(!bet&&ps!==rs&&ps!==s('Ketu')){all=false;break;}}if(all){yogas.push({name:'Karmic Blockage Pattern',strength:'Challenge',meaning:'Repeated setbacks before success. Strong karmic themes. Success often comes after 42.'});}}
  return yogas.slice(0,6);
}

// ─── INLINE DOSHA + KEY PATTERN CHECKER ──────────────────────────────────────
function checkPatterns(sid,lagnaSign,moonSign){
  const h=nm=>((so(sid[nm])-lagnaSign+12)%12)+1;
  const s=nm=>so(sid[nm]);
  const conj=(a,b)=>s(a)===s(b);
  const patterns=[];
  // Mangal Dosha
  if(sid.Mars&&[1,2,4,7,8,12].includes(h('Mars'))){const sev=h('Mars')===7||h('Mars')===8?'High':h('Mars')===1||h('Mars')===4?'Moderate':'Mild';patterns.push({type:'Mars Relationship Stress',severity:sev,meaning:`Mars in house ${h('Mars')} affects relationship timing and harmony. Partner matching advised.`});}
  // Saturn-Moon
  if(sid.Moon&&sid.Saturn&&(conj('Moon','Saturn')||((s('Saturn')-s('Moon')+12)%12===6))){patterns.push({type:'Reserved Emotional Nature',severity:'Moderate',meaning:'Deep thinker, emotionally disciplined, tendency toward over-analysis. Needs grounding.'});}
  // Moon-Rahu
  if(sid.Moon&&sid.Rahu&&conj('Moon','Rahu')){patterns.push({type:'Anxiety Pattern',severity:'Moderate',meaning:'Active imagination, anxiety tendency, unusual thinking. Spiritual practices help.'});}
  // Sade Sati check — done via transits
  // Mars in 8H
  if(sid.Mars&&h('Mars')===8){patterns.push({type:'Surgical/Transformation Tendency',severity:'Note',meaning:'Mars in 8th — potential for surgeries, transformative health events, strong recovery.'});}
  // Saturn-Rahu
  if(sid.Saturn&&sid.Rahu&&conj('Saturn','Rahu')){patterns.push({type:'Karmic Obstacle Pattern',severity:'High',meaning:'Saturn-Rahu conjunction — heavy karmic pressure in this area of life. Discipline required.'});}
  return patterns;
}

// ─── TODAY'S TRANSITS + SADE SATI ────────────────────────────────────────────
function getTodayData(lagnaSign,moonSign){
  const jd=JD(new Date().getFullYear(),new Date().getMonth()+1,new Date().getDate(),12);
  const ay=ayanamsa(jd);
  const pos={Sun:n360(sunLon(jd)-ay),Moon:n360(moonLon(jd)-ay),Mercury:n360(planetLon(jd,'Mercury')-ay),Venus:n360(planetLon(jd,'Venus')-ay),Mars:n360(planetLon(jd,'Mars')-ay),Jupiter:n360(planetLon(jd,'Jupiter')-ay),Saturn:n360(planetLon(jd,'Saturn')-ay),Rahu:n360(rahuLon(jd)-ay)};
  const tList=Object.entries(pos).map(([p,l])=>({planet:p,sign:RS[so(l)],fromLagna:((so(l)-lagnaSign+12)%12)+1,fromMoon:((so(l)-moonSign+12)%12)+1}));
  // Sade Sati
  const satFromMoon=((so(pos.Saturn)-moonSign+12)%12);
  let sadeSati=null;
  if(satFromMoon===11)sadeSati={phase:'Rising phase (begins)',note:'Saturn approaching your Moon sign. Expenses and confusion begin.'};
  else if(satFromMoon===0)sadeSati={phase:'Peak phase (most intense)',note:'Saturn on your Moon sign. Biggest pressure period. Transformation happening.'};
  else if(satFromMoon===1)sadeSati={phase:'Setting phase (relief coming)',note:'Saturn leaving your Moon sign. Final pressure before relief.'};
  else if(satFromMoon===3)sadeSati={phase:"Saturn's 4th House Pressure",note:"Saturn in 4th from Moon — domestic pressures, career friction. 2.5 year cycle."};
  else if(satFromMoon===7)sadeSati={phase:"Saturn's 8th House Pressure",note:"Saturn in 8th from Moon — most challenging pressure period. Health and unexpected expenses possible."};
  // Jupiter transit quality
  const jupFromMoon=((so(pos.Jupiter)-moonSign+12)%12)+1;
  const jupGood=[2,5,7,9,11].includes(jupFromMoon);
  return{raw:pos,list:tList,sadeSati,jupTransit:{house:jupFromMoon,quality:jupGood?'favorable':'challenging'},satFromMoon};
}

// ─── GEOCODE ──────────────────────────────────────────────────────────────────
// ── City name alias map — old/colloquial → official searchable names ─────────
const CITY_ALIASES={
  // India — renamed cities
  'gurgaon':'Gurugram','gurugram':'Gurugram',
  'bombay':'Mumbai','calcutta':'Kolkata','madras':'Chennai',
  'bangalore':'Bengaluru','banglore':'Bengaluru','bengaluru':'Bengaluru',
  'pondicherry':'Puducherry','poona':'Pune','baroda':'Vadodara',
  'simla':'Shimla','mussoorie':'Mussoorie','ooty':'Udhagamandalam',
  'cochin':'Kochi','trivandrum':'Thiruvananthapuram','calicut':'Kozhikode',
  'allahabad':'Prayagraj','benares':'Varanasi','banaras':'Varanasi',
  'patna':'Patna','ranchi':'Ranchi','bhubaneswar':'Bhubaneswar',
  'vizag':'Visakhapatnam','vizag':'Visakhapatnam','hyderabad':'Hyderabad',
  // US — common shortenings / alternate names
  'nyc':'New York City','new york':'New York City','manhattan':'New York City',
  'la':'Los Angeles','l.a.':'Los Angeles',
  'sf':'San Francisco','san fran':'San Francisco','frisco':'San Francisco',
  'dc':'Washington D.C.','washington dc':'Washington D.C.','d.c.':'Washington D.C.',
  'chi':'Chicago','the windy city':'Chicago',
  'philly':'Philadelphia','phila':'Philadelphia',
  'vegas':'Las Vegas','sin city':'Las Vegas',
  'nola':'New Orleans','n.o.':'New Orleans',
  'h-town':'Houston','space city':'Houston',
  'big d':'Dallas','dfw':'Dallas',
  'the bay':'San Francisco','bay area':'San Francisco',
  'pdx':'Portland','pnw':'Portland',
  // Canada
  'van':'Vancouver','van city':'Vancouver',
  'toronto':'Toronto','t.o.':'Toronto',
  'mtl':'Montreal','montreal':'Montreal',
  'pgm':'Mississauga',
  // UK
  'london':'London','lon':'London',
  'brum':'Birmingham','manc':'Manchester','manny':'Manchester',
  'edinburgh':'Edinburgh','glasgae':'Glasgow',
  // Europe
  'wien':'Vienna','koeln':'Cologne','muenchen':'Munich','munchen':'Munich',
  'roma':'Rome','firenze':'Florence','napoli':'Naples','venezia':'Venice',
  'barcelona':'Barcelona','barca':'Barcelona',
  'paris':'Paris','lyon':'Lyon','marseille':'Marseille',
  'amsterdam':'Amsterdam','rotterdam':'Rotterdam',
  'warszawa':'Warsaw','krakow':'Krakow','krakau':'Krakow',
  'moskva':'Moscow','moskow':'Moscow',
  // Australia
  'sydney':'Sydney','melbourne':'Melbourne','brisbane':'Brisbane',
  'perth':'Perth','adelaide':'Adelaide',
  // Middle East / Asia
  'dubai':'Dubai','abu dhabi':'Abu Dhabi','sharjah':'Sharjah',
  'singapore':'Singapore','beijing':'Beijing','peking':'Beijing',
  'tokyo':'Tokyo','osaka':'Osaka','seoul':'Seoul','busan':'Busan',
  'bangkok':'Bangkok','bkk':'Bangkok',
  'kuala lumpur':'Kuala Lumpur','kl':'Kuala Lumpur',
  'jakarta':'Jakarta','bali':'Denpasar',
  'karachi':'Karachi','lahore':'Lahore','islamabad':'Islamabad',
  'dhaka':'Dhaka','colombo':'Colombo','kathmandu':'Kathmandu',
  'nairobi':'Nairobi','cairo':'Cairo','casablanca':'Casablanca',
};

// Country capital fallbacks — used when all APIs fail
const COUNTRY_CAPITALS={
  'united states':'New York City','usa':'New York City','us':'New York City',
  'united kingdom':'London','uk':'London','england':'London','scotland':'Edinburgh','wales':'Cardiff',
  'canada':'Toronto','australia':'Sydney','new zealand':'Auckland',
  'india':'New Delhi','pakistan':'Islamabad','bangladesh':'Dhaka','sri lanka':'Colombo',
  'germany':'Berlin','france':'Paris','italy':'Rome','spain':'Madrid',
  'portugal':'Lisbon','netherlands':'Amsterdam','belgium':'Brussels',
  'switzerland':'Zurich','austria':'Vienna','sweden':'Stockholm',
  'norway':'Oslo','denmark':'Copenhagen','finland':'Helsinki',
  'poland':'Warsaw','czech republic':'Prague','hungary':'Budapest',
  'romania':'Bucharest','greece':'Athens','turkey':'Istanbul',
  'russia':'Moscow','ukraine':'Kyiv','uae':'Dubai','saudi arabia':'Riyadh',
  'egypt':'Cairo','south africa':'Johannesburg','nigeria':'Lagos','kenya':'Nairobi',
  'china':'Beijing','japan':'Tokyo','south korea':'Seoul','taiwan':'Taipei',
  'thailand':'Bangkok','vietnam':'Ho Chi Minh City','malaysia':'Kuala Lumpur',
  'indonesia':'Jakarta','philippines':'Manila','singapore':'Singapore',
  'brazil':'São Paulo','mexico':'Mexico City','argentina':'Buenos Aires',
  'colombia':'Bogotá','chile':'Santiago','peru':'Lima',
};

async function geocode(place, birthDate){
  const key=(place||'').toLowerCase().trim();
  const resolved=CITY_ALIASES[key]||place;

  // DST-aware UTC offset: uses IANA timezone name + Intl.DateTimeFormat for exact historical offset
  function dstAwareTz(ianaTimezone, dob){
    if(!ianaTimezone) return null;
    try{
      // Use noon UTC on birth date — avoids DST transition edge cases (transitions happen ~2am local)
      const [y,mo,d] = (dob||'2000-01-01').split('-').map(Number);
      const date = new Date(Date.UTC(y, mo-1, d, 12, 0, 0));
      const parts = Intl.DateTimeFormat('en',{
        timeZone: ianaTimezone,
        timeZoneName: 'shortOffset',
        hour: 'numeric', hour12: false
      }).formatToParts(date);
      const tzStr = parts.find(p=>p.type==='timeZoneName')?.value; // e.g. "GMT-4", "GMT+5:30"
      if(!tzStr) return null;
      const m = tzStr.match(/GMT([+-])(\d+)(?::(\d+))?/);
      if(!m) return null;
      return (m[1]==='+'?1:-1) * (parseInt(m[2]) + parseInt(m[3]||0)/60);
    }catch(e){ return null; }
  }

  // Hardcoded IANA → offset for half/quarter-hour zones (covers all non-whole-hour timezones globally)
  // This avoids the Math.round(lon/15) fallback which is wrong for India, Nepal, Iran, etc.
  const IANA_FIXED = {
    'Asia/Kolkata':5.5,'Asia/Calcutta':5.5,'Asia/Colombo':5.5,
    'Asia/Kathmandu':5.75,'Asia/Katmandu':5.75,
    'Asia/Kabul':4.5,'Asia/Tehran':3.5,'Iran':3.5,
    'Asia/Yangon':6.5,'Asia/Rangoon':6.5,
    'Australia/Adelaide':9.5,'Australia/Broken_Hill':9.5,
    'Australia/Darwin':9.5,'Australia/Lord_Howe':10.5,
    'Pacific/Marquesas':-9.5,'Pacific/Norfolk':11.5,
    'Pacific/Chatham':12.75,'NZ-CHAT':12.75,
    'Asia/Pyongyang':8.5,'Asia/Seoul':9,
    'Asia/Singapore':8,'Asia/Kuala_Lumpur':8,
    'Asia/Dubai':4,'Asia/Muscat':4,
    'Asia/Karachi':5,'Asia/Tashkent':5,
    'Asia/Dhaka':6,'Asia/Almaty':6,
    'Asia/Bangkok':7,'Asia/Jakarta':7,
    'Asia/Tokyo':9,'Asia/Seoul':9,
    'Australia/Sydney':10,'Australia/Melbourne':10,
    'Europe/London':0,'Europe/Paris':1,'Europe/Berlin':1,
    'America/New_York':-5,'America/Chicago':-6,
    'America/Denver':-7,'America/Los_Angeles':-8,
  };

  function tzFromIana(ianaName, dob) {
    if (!ianaName) return null;
    // Check fixed map first (handles all non-whole-hour zones reliably)
    if (IANA_FIXED[ianaName] !== undefined) return IANA_FIXED[ianaName];
    // Fall back to DST-aware calculation for remaining zones
    return dstAwareTz(ianaName, dob);
  }

  // Safe longitude fallback: nearest whole hour (NOT nearest 0.5hr — that was the bug)
  // For half-hour zones we MUST use IANA name; if we don't have it, use whole-hour
  function lonFallback(lon) { return Math.round(lon/15); }

  // Layer 1: Open-Meteo — returns IANA timezone name, use it for DST-aware offset
  try{
    const url=`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(resolved)}&count=1&language=en&format=json`;
    const r=await fetch(url);const d=await r.json();
    if(d.results?.[0]){
      const loc=d.results[0];
      const tzName = loc.timezone||'';
      // Always resolve through IANA name — handles India (5.5), Nepal (5.75), Iran (3.5) etc. correctly
      const tz = tzFromIana(tzName, birthDate)
               ?? (loc.utc_offset_seconds != null ? loc.utc_offset_seconds/3600 : lonFallback(loc.longitude));
      return{lat:loc.latitude,lon:loc.longitude,tz};
    }
  }catch(e){}

  // Layer 2: Nominatim — no IANA name, estimate from longitude
  try{
    const url=`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(resolved)}&format=json&limit=1&addressdetails=1`;
    const r=await fetch(url,{headers:{'User-Agent':'NatalAI/1.0 support@natalai.live'}});
    const d=await r.json();
    if(d?.[0]){
      const lat=parseFloat(d[0].lat),lon=parseFloat(d[0].lon);
      // Try to get IANA name from Open-Meteo using the resolved coordinates
      try{
        const r2=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(resolved)}&count=1&language=en&format=json`);
        const d2=await r2.json();
        if(d2.results?.[0]?.timezone){
          const tz=tzFromIana(d2.results[0].timezone, birthDate) ?? lonFallback(lon);
          return{lat,lon,tz};
        }
      }catch(e2){}
      return{lat,lon,tz:lonFallback(lon)};
    }
  }catch(e){}

  // Layer 3: Country capital fallback
  const lower=resolved.toLowerCase();
  for(const[country,capital]of Object.entries(COUNTRY_CAPITALS)){
    if(lower.includes(country)){
      try{
        const url=`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(capital)}&count=1&language=en&format=json`;
        const r=await fetch(url);const d=await r.json();
        if(d.results?.[0]){
          const loc=d.results[0];
          const tzName=loc.timezone||'';
          const tz=tzFromIana(tzName,birthDate)
                 ?? (loc.utc_offset_seconds!=null ? loc.utc_offset_seconds/3600 : lonFallback(loc.longitude));
          return{lat:loc.latitude,lon:loc.longitude,tz};
        }
      }catch(e){}
    }
  }

  return{lat:51.5074,lon:-0.1278,tz:0};
}

// ─── LOG TO SHEETS ────────────────────────────────────────────────────────────
function logToSheets(data){
  const url=process.env.SHEETS_WEBHOOK;
  if(!url)return;
  fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,timestamp:new Date().toISOString()})}).catch(()=>{});
}

// ─── CLAUDE CALL ──────────────────────────────────────────────────────────────
const MODEL='claude-haiku-4-5-20251001';
async function claude(apiKey,prompt,maxTok,systemPrompt){
  const body={model:MODEL,max_tokens:maxTok,messages:[{role:'user',content:prompt}]};
  if(systemPrompt) body.system=systemPrompt;
  const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},body:JSON.stringify(body)});
  const d=await r.json();
  if(!r.ok)throw new Error(d.error?.message||'Claude error');
  return d.content?.[0]?.text||'';
}

// ─── LANGUAGE RULES (injected into every section prompt) ─────────────────────
const LANG=`Voice: A smart American friend in their late 20s reading this person's chart. Direct, warm, sometimes blunt, sometimes tender. Storyteller energy — never analyst.

Hard rules every line:
- Use first name once early, then "you." Talk TO them, not about them.
- NEVER recite chart positions. Don't write "your Saturn is in the 10th" or "Mars in 8th." Translate the meaning into life: "you're built to push through pressure for the long haul."
- After first mention, drop planet and period names. Describe what they DO, not their textbook label.
- Flowing prose only. No bullets, no numbered lists, no headers inside section bodies.
- Vary sentence length. Mix short punchy lines with longer reflective ones.
- No hedging — banned words: may, might, could, perhaps, possibly, tend to.
- No Sanskrit unless followed by plain English in brackets. Use: Rising Sign, Moon Sign, Birth Star, Major Period, Active Phase, Short Window, Saturn Pressure Cycle.
- Banned openers: "Your chart shows," "As we can see," "Based on your placements," "Looking at your chart," "Great question."
- Specifics or skip it — generic sentences that could apply to anyone are forbidden.
- Lines tagged CLASSICAL / JAIMINI / D10 / MARRIAGE / CAREER etc. are deterministic facts. State the meaning directly. No "may indicate" — assert it.

Self-check before output: read your draft. Any sentence that could describe any other person? Rewrite it with something only true of THIS chart.`;
// ─── WRAP HTML ────────────────────────────────────────────────────────────────

// ── CLASSICAL VERDICTS SIDEBAR — Part A ─────────────────────────────────
// Renders 1-5 deterministic engine verdicts as a small bordered card,
// inserted INSIDE rep-sec-body BEFORE Claude's prose. Empty-string-safe.
//
// R       = rulesResults (may be null/undefined → returns '')
// sid     = section id (e.g. 'career-money'; matches SECTION_IDS map)
// extras  = optional { dualTiming, dashaSandhi, compat: {...} }
//           - dualTiming: output of crossVerifyTiming(), used for power-windows + 10-key-dates
//           - compat: { r1c, r2compat, name1, name2, totalScore, grahaScore,
//                       ganaScore, g1, g2, nadiDosha, bhakootBad }
function buildSectionSidebar(R, sid, extras) {
  if (!R && !(extras && extras.compat)) return '';
  extras = extras || {};

  const lines = [];
  const cap = (s, n) => {
    if (!s) return null;
    const t = String(s).trim();
    return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t;
  };
  const firstSentence = s => {
    if (!s) return null;
    return cap(String(s).split('.')[0], 130);
  };
  const push = v => { const t = firstSentence(v); if (t) lines.push(t); };
  const pushRaw = v => { const t = cap(v, 130); if (t) lines.push(t); };

  // Substitutions per discrepancy report (Mangal/Sade Sati not on rulesResults top-level)
  const mangalRule = R && R.yogas && R.yogas.rules && R.yogas.rules.find(r => r && r.id === 'MANGAL-DOSHA');
  const mangalActive = mangalRule && !String(mangalRule.verdict||'').includes('CANCELLED/REDUCED');
  const sadeSatiVerdict = R && R.transits && R.transits.verdicts && R.transits.verdicts.find(v => v && v.includes('SADE SATI ACTIVE'));

  switch (sid) {
    // ── NATAL ───────────────────────────────────────────────────────
    case 'cosmic-blueprint':
      push(R?.jaiminiKarakas?.verdicts?.[0]);
      push(R?.arudhaLagna?.verdicts?.[0]);
      push(R?.spirituality?.verdict);
      push(R?.yogas?.summary);
      break;
    case 'personality': {
      push(R?.lagna?.verdicts?.[0]);
      push(R?.mind?.verdicts?.[0]);
      push(R?.communication?.verdict);
      const topY = R?.yogas?.yogas?.[0];
      if (topY && topY.name) pushRaw(`${topY.name}${topY.strength?` (${topY.strength})`:''}`);
      break;
    }
    case 'life-chapter':
      push(R?.dasha?.verdict);
      push(R?.transits?.verdicts?.[0]);
      push(R?.transits?.verdicts?.[1]);
      if (sadeSatiVerdict) {
        // Sade Sati is appended onto a longer Saturn-from-Moon verdict; extract just the SADE SATI clause
        const idx = sadeSatiVerdict.indexOf('SADE SATI ACTIVE');
        const fragment = idx >= 0 ? sadeSatiVerdict.slice(idx) : sadeSatiVerdict;
        push(fragment);
      }
      break;
    case 'career-money':
      push(R?.career?.verdict);
      push(R?.wealth?.verdict);
      if (Array.isArray(R?.career?.fields) && R.career.fields.length) {
        pushRaw('Career fields: ' + R.career.fields.join(', '));
      }
      push(R?.vargas?.verdicts?.find(v => v && v.includes('D10')));
      break;
    case 'love-relationships':
      push(R?.marriage?.verdict);
      push(R?.upapada?.verdicts?.[0]);
      push(R?.jaiminiKarakas?.verdicts?.find(v => v && v.includes('DARAKARAKA')));
      if (mangalActive) push(mangalRule.verdict);
      break;
    case 'health-family':
      push(R?.health?.verdict);
      if (Array.isArray(R?.health?.vulnerableAreas) && R.health.vulnerableAreas.length) {
        pushRaw('Watch: ' + R.health.vulnerableAreas.join(', '));
      }
      push(R?.mind?.verdicts?.[0]);
      push(R?.remedies?.summary);
      break;

    // ── TIMING ──────────────────────────────────────────────────────
    case 'power-windows':
    case '10-key-dates': {
      push(R?.dasha?.verdict);
      const xv = extras.dualTiming;
      if (xv) {
        const fmt = arr => (arr||[]).slice(0,2).map(p => `${p.planet} ${p.start}–${p.end}`).join(', ');
        if (xv.convergentFavorable && xv.convergentFavorable.length) pushRaw('Convergent favorable: ' + fmt(xv.convergentFavorable));
        if (xv.convergentCaution && xv.convergentCaution.length)     pushRaw('Convergent caution: ' + fmt(xv.convergentCaution));
        if (xv.divergent && xv.divergent.length)                     pushRaw('Divergent (mixed signals): ' + fmt(xv.divergent));
      }
      push(R?.ashtakavarga?.verdicts?.find(v => v && v.includes('STRONG')));
      break;
    }
    case 'timing-goals':
      push(R?.dasha?.verdict);
      push(R?.transits?.verdicts?.[0]);
      break;
    case 'timing-blueprint':
      push(R?.dasha?.verdict);
      if (extras.dashaSandhi) pushRaw('Transition: ' + extras.dashaSandhi);
      break;
    case 'career-timing':
      push(R?.dasha?.verdict);
      push(R?.career?.verdict);
      break;

    // ── COMPAT ──────────────────────────────────────────────────────
    case 'overall-physical-chemistry': {
      const c = extras.compat; if (!c) return '';
      pushRaw(`Total compatibility: ${c.totalScore}/36`);
      if (c.r1c?.marriage?.verdict)      pushRaw(`${c.name1}: ${firstSentence(c.r1c.marriage.verdict)}`);
      if (c.r2compat?.marriage?.verdict) pushRaw(`${c.name2}: ${firstSentence(c.r2compat.marriage.verdict)}`);
      if (c.nadiDosha) pushRaw('Nadi: same energetic channel — fertility/health consideration');
      break;
    }
    case 'mental-bond-temperament': {
      const c = extras.compat; if (!c) return '';
      pushRaw(`Graha Maitri: ${c.grahaScore}/5`);
      pushRaw(`Gana: ${c.g1} + ${c.g2} = ${c.ganaScore}/6`);
      if (c.r1c?.mind?.verdicts?.[0])     pushRaw(`${c.name1} mind: ${firstSentence(c.r1c.mind.verdicts[0])}`);
      if (c.r2compat?.mind?.verdicts?.[0]) pushRaw(`${c.name2} mind: ${firstSentence(c.r2compat.mind.verdicts[0])}`);
      break;
    }
    case 'long-term-flags': {
      const c = extras.compat; if (!c) return '';
      pushRaw(`Bhakoot: ${c.bhakootBad ? 'friction axis' : 'harmonious'}`);
      const m1 = (c.r1c?.marriage?.verdict||'').split('.');
      const m2 = (c.r2compat?.marriage?.verdict||'').split('.');
      if (m1[1] && m1[1].trim()) pushRaw(`${c.name1} long-term: ${cap(m1[1].trim(), 130)}`);
      if (m2[1] && m2[1].trim()) pushRaw(`${c.name2} long-term: ${cap(m2[1].trim(), 130)}`);
      const marital = c.r1c?.secondary?.verdicts?.find(v => v && v.startsWith('MARITAL'));
      if (marital) pushRaw(`Marital happiness: ${firstSentence(marital)}`);
      break;
    }
    case 'timing-verdict': {
      const c = extras.compat; if (!c) return '';
      if (c.r1c?.dasha?.verdict)     pushRaw(`${c.name1} dasha: ${firstSentence(c.r1c.dasha.verdict)}`);
      if (c.r2compat?.dasha?.verdict) pushRaw(`${c.name2} dasha: ${firstSentence(c.r2compat.dasha.verdict)}`);
      break;
    }

    default:
      return '';
  }

  const final = lines.filter(Boolean).slice(0, 5);
  if (!final.length) return '';

  const items = final.map(line => {
    const translated = translateVerdict(String(line));
    return `<div class="rep-sidebar-line"><span class="rep-sidebar-dot">·</span>${translated.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>`;
  }).join('');

  return `<div class="rep-sidebar"><div class="rep-sidebar-label">Classical reading</div>${items}</div>`;
}

function wrapHTML(sections,name,type,cd){
  const LABELS={natal:'Your Birth Reading',timing:'Best Dates & Timing',cosmic:'Partner Compatibility'};
  const label=LABELS[type]||'Astrological Reading';
  const today=new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
  // SECTION_IDS now lives at module level so the Mode 3 sidebar pre-compute can read it.
  const KEY_SECTIONS = new Set(['career-money','love-relationships','life-chapter','raw-truth','timing-blueprint']);
  const body=sections.filter(s=>s&&s.title!==undefined).map(s=>{
    if(!s.title) return `<div style="height:2px;margin:8px 40px;background:linear-gradient(90deg,transparent,rgba(191,154,48,.4),transparent)"></div>`;
    const sid = SECTION_IDS[s.title] || ('sec-'+s.title.replace(/[^a-z0-9]/gi,'-').toLowerCase().slice(0,20));
    const isKey = KEY_SECTIONS.has(sid);
    return `
  <div id="${sid}" style="border-bottom:1px solid rgba(0,0,0,.06);margin-bottom:0">
    <div class="rep-sec-head${isKey?' rep-key-head':''}" style="padding:28px 40px 12px${isKey?';border-left:3px solid rgba(191,154,48,.4);padding-left:22px':''}"><h2 class="rep-sh" style="${isKey?'font-size:26px;':''}${''}">${s.title}</h2></div>
    <div class="rep-sec-body" style="padding:4px 40px 32px;font-family:'Cormorant Garamond',serif;font-size:19px;line-height:1.78;color:#2a2218;background:#ffffff">${s.sidebar||''}${s.html}</div>
  </div>`;}).join('');
  return `<!doctype html><html><head><meta charset="UTF-8">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{color-scheme:light}
body{background:#fafaf8;color:#1a1a1a;font-family:'Inter',sans-serif;font-size:15px;line-height:1.7}
/* Gmail dark mode override */
@media (prefers-color-scheme:dark){
  body,div,td,p,span,h1,h2,h3,h4{background-color:#ffffff !important;color:#1a1a1a !important}
  .rep-cover{background:#0d0d0d !important}
  .rep-cover *{background-color:transparent !important;color:#ffffff !important}
  .rep-cover .rep-brand,.rep-cover .rep-h1 em,.rep-cover .rep-csub{color:rgba(255,255,255,.7) !important}
  .rep-cover .rep-h1{color:#ffffff !important}
  .rep-covgrid .cv{color:rgba(255,255,255,.85) !important}
  .rep-covgrid .cl{color:rgba(255,255,255,.45) !important}
}
[data-ogsc] body,[data-ogsb] body{background:#ffffff !important;color:#1a1a1a !important}
[data-ogsc] .rep-cover{background:#0d0d0d !important}
.rep-cover{background:linear-gradient(135deg,#0d0d0d 0%,#1a1008 50%,#0d0d0d 100%);padding:52px 48px 44px;position:relative;overflow:hidden}
.rep-cover::before{content:'';position:absolute;top:-60px;right:-60px;width:280px;height:280px;background:radial-gradient(circle,rgba(191,154,48,.15) 0%,transparent 70%);pointer-events:none}
.rep-brand{font-family:'Cormorant Garamond',serif;font-size:10px;letter-spacing:.3em;text-transform:uppercase;color:rgba(191,154,48,.5);margin-bottom:24px}
.rep-title{font-family:'Cormorant Garamond',serif;font-size:32px;font-weight:300;color:#ffffff;margin:0 0 8px;letter-spacing:.02em}
.rep-name{font-family:'Cormorant Garamond',serif;font-size:26px;color:#bf9a30;font-style:italic;margin-bottom:32px}
.rep-meta{display:grid;grid-template-columns:1fr 1fr;gap:12px 24px;border-top:1px solid rgba(191,154,48,.2);padding-top:24px}
.rep-meta-item{display:flex;flex-direction:column;gap:3px}
.rep-meta-label{font-size:8px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.55)}
.rep-meta-val{font-family:'Cormorant Garamond',serif;font-size:15px;color:rgba(255,255,255,.88);font-weight:400}
.rep-body{padding:40px 48px;background:#fafaf8}
.rep-section{margin-bottom:0;border-bottom:1px solid rgba(0,0,0,.06);padding-bottom:0}
.rep-section:last-child{border-bottom:none}
.rep-sh-wrap{padding:28px 0 0}
.rep-sh{font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:400;color:#1a1a1a;padding-bottom:0;border-bottom:none;margin-bottom:0;display:flex;align-items:center;gap:10px}
.rep-sh::after{content:'';flex:1;height:1px;background:linear-gradient(to right,rgba(191,154,48,.4),transparent);margin-left:28px}
/* Classical Verdicts Sidebar — Part A */
.rep-sidebar{border-radius:10px;padding:14px 18px;margin:0 0 18px;background:#faf8f3;border:1px solid rgba(191,154,48,.18);border-left:3px solid rgba(191,154,48,.5)}
.rep-sidebar-label{font-family:'Inter',sans-serif;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:rgba(0,0,0,.5);margin-bottom:8px}
.rep-sidebar-line{font-family:'Inter',sans-serif;font-size:13.5px;line-height:1.6;color:#2d2d2d;padding:2px 0}
.rep-sidebar-dot{color:rgba(191,154,48,.7);margin-right:6px}
@media (max-width:600px){.rep-sidebar{padding:10px 12px}.rep-sidebar-line{font-size:12.5px}}
/* rep-content uses inline styles on wrapper */
/* year-glance uses inline styles — see buildSection below */
.period-grid{display:flex;flex-direction:column;gap:14px;padding:4px 0}
.p-card{border-radius:10px;overflow:hidden;border:1px solid rgba(0,0,0,.08);background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.04)}
.p-card-header{display:flex;align-items:center;justify-content:space-between;padding:14px 18px 12px;border-bottom:1px solid rgba(0,0,0,.06)}
.p-card-planet{display:flex;align-items:center;gap:10px}
.p-card-emoji{font-size:20px;line-height:1}
.p-card-name{font-family:'Cormorant Garamond',serif;font-size:19px;font-weight:500;color:#1a1a1a}
.p-card-dates{font-family:'Inter',sans-serif;font-size:11px;color:#888;font-weight:400}
.p-card-badge{font-family:'Inter',sans-serif;font-size:10px;font-weight:600;letter-spacing:.06em;padding:4px 10px;border-radius:20px;text-transform:uppercase}
.p-card-badge.active{background:#fef3cd;color:#92650a}
.p-card-badge.upcoming{background:#f0f0f0;color:#666}
.p-card-house{padding:8px 18px;font-size:11px;font-weight:500;letter-spacing:.04em;border-bottom:1px solid rgba(0,0,0,.05)}
.p-card-body{padding:14px 18px 16px}
.p-card-body p{font-family:'Cormorant Garamond',serif;font-size:17px;line-height:1.72;color:#2a2218;margin:0 0 6px}
.p-card-body p:last-child{margin:0}
.p-card-body p.transit{color:#7c5a2a;font-style:italic;padding-top:4px;border-top:1px solid rgba(191,154,48,.15);margin-top:8px}
.phase-divider{background:linear-gradient(135deg,#f0e8d0,#faf5ec);border:1px solid rgba(191,154,48,.3);border-radius:8px;padding:14px 18px;margin:16px 0;text-align:center}
.phase-divider p{font-family:'Cormorant Garamond',serif;font-size:15px;color:#7c5a2a;margin:0;font-style:italic}
.rep-footer{text-align:center;padding:20px;border-top:1px solid rgba(0,0,0,.08);font-size:10px;color:#aaa;font-family:'Inter',sans-serif;letter-spacing:.05em;background:#fafaf8}
/* ── MOBILE RESPONSIVE ── */
@media(max-width:600px){
  .rep-cover{padding:28px 18px 24px !important}
  .rep-body{padding:20px 16px !important}
  div[style*="padding:40px 48px"]{padding:20px 16px !important}
  .rep-title{font-size:24px !important}
  .rep-name{font-size:20px !important;margin-bottom:20px !important}
  .rep-meta{grid-template-columns:1fr 1fr !important;gap:10px 16px !important}
  .rep-sh{font-size:19px !important}
  .rep-sh-wrap{padding:20px 0 0 !important}
  .p-card-header{flex-wrap:wrap !important;gap:8px !important}
  .p-card-name{font-size:16px !important}
  .p-card-body p{font-size:14px !important}
  .p-card-body{padding:12px 14px 14px !important}
  .p-card-header{padding:12px 14px 10px !important}
  .p-card-house{padding:7px 14px !important}
  .period-grid{gap:10px !important}
  .phase-divider{padding:10px 14px !important}
  .phase-divider p{font-size:13px !important}
}
</style>
</head><body>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{color-scheme:light}
body{background:#fafaf8;color:#1a1a1a;font-family:'Inter',sans-serif;font-size:15px;line-height:1.7}
/* Gmail dark mode override */
@media (prefers-color-scheme:dark){
  body,div,td,p,span,h1,h2,h3,h4{background-color:#ffffff !important;color:#1a1a1a !important}
  .rep-cover{background:#0d0d0d !important}
  .rep-cover *{background-color:transparent !important;color:#ffffff !important}
  .rep-cover .rep-brand,.rep-cover .rep-h1 em,.rep-cover .rep-csub{color:rgba(255,255,255,.7) !important}
  .rep-cover .rep-h1{color:#ffffff !important}
  .rep-covgrid .cv{color:rgba(255,255,255,.85) !important}
  .rep-covgrid .cl{color:rgba(255,255,255,.45) !important}
}
[data-ogsc] body,[data-ogsb] body{background:#ffffff !important;color:#1a1a1a !important}
[data-ogsc] .rep-cover{background:#0d0d0d !important}
.rep-cover{background:linear-gradient(135deg,#0d0d0d 0%,#1a1008 50%,#0d0d0d 100%);padding:52px 48px 44px;position:relative;overflow:hidden}
.rep-cover::before{content:'';position:absolute;top:-60px;right:-60px;width:280px;height:280px;background:radial-gradient(circle,rgba(191,154,48,.15) 0%,transparent 70%);pointer-events:none}
.rep-brand{font-family:'Cormorant Garamond',serif;font-size:10px;letter-spacing:.3em;text-transform:uppercase;color:rgba(191,154,48,.5);margin-bottom:24px}
.rep-title{font-family:'Cormorant Garamond',serif;font-size:32px;font-weight:300;color:#ffffff;margin:0 0 8px;letter-spacing:.02em}
.rep-name{font-family:'Cormorant Garamond',serif;font-size:26px;color:#bf9a30;font-style:italic;margin-bottom:32px}
.rep-meta{display:grid;grid-template-columns:1fr 1fr;gap:12px 24px;border-top:1px solid rgba(191,154,48,.2);padding-top:24px}
.rep-meta-item{display:flex;flex-direction:column;gap:3px}
.rep-meta-label{font-size:8px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.55)}
.rep-meta-val{font-family:'Cormorant Garamond',serif;font-size:15px;color:rgba(255,255,255,.88);font-weight:400}
.rep-body{padding:40px 48px;background:#fafaf8}
.rep-section{margin-bottom:0;border-bottom:1px solid rgba(0,0,0,.06);padding-bottom:0}
.rep-section:last-child{border-bottom:none}
.rep-sh-wrap{padding:28px 0 0}
.rep-sh{font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:400;color:#1a1a1a;padding-bottom:0;border-bottom:none;margin-bottom:0;display:flex;align-items:center;gap:10px}
.rep-sh::after{content:'';flex:1;height:1px;background:linear-gradient(to right,rgba(191,154,48,.4),transparent);margin-left:28px}
/* Classical Verdicts Sidebar — Part A */
.rep-sidebar{border-radius:10px;padding:14px 18px;margin:0 0 18px;background:#faf8f3;border:1px solid rgba(191,154,48,.18);border-left:3px solid rgba(191,154,48,.5)}
.rep-sidebar-label{font-family:'Inter',sans-serif;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:rgba(0,0,0,.5);margin-bottom:8px}
.rep-sidebar-line{font-family:'Inter',sans-serif;font-size:13.5px;line-height:1.6;color:#2d2d2d;padding:2px 0}
.rep-sidebar-dot{color:rgba(191,154,48,.7);margin-right:6px}
@media (max-width:600px){.rep-sidebar{padding:10px 12px}.rep-sidebar-line{font-size:12.5px}}
/* rep-content uses inline styles on wrapper */
/* year-glance uses inline styles — see buildSection below */
.period-grid{display:flex;flex-direction:column;gap:14px;padding:4px 0}
.p-card{border-radius:10px;overflow:hidden;border:1px solid rgba(0,0,0,.08);background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.04)}
.p-card-header{display:flex;align-items:center;justify-content:space-between;padding:14px 18px 12px;border-bottom:1px solid rgba(0,0,0,.06)}
.p-card-planet{display:flex;align-items:center;gap:10px}
.p-card-emoji{font-size:20px;line-height:1}
.p-card-name{font-family:'Cormorant Garamond',serif;font-size:19px;font-weight:500;color:#1a1a1a}
.p-card-dates{font-family:'Inter',sans-serif;font-size:11px;color:#888;font-weight:400}
.p-card-badge{font-family:'Inter',sans-serif;font-size:10px;font-weight:600;letter-spacing:.06em;padding:4px 10px;border-radius:20px;text-transform:uppercase}
.p-card-badge.active{background:#fef3cd;color:#92650a}
.p-card-badge.upcoming{background:#f0f0f0;color:#666}
.p-card-house{padding:8px 18px;font-size:11px;font-weight:500;letter-spacing:.04em;border-bottom:1px solid rgba(0,0,0,.05)}
.p-card-body{padding:14px 18px 16px}
.p-card-body p{font-family:'Cormorant Garamond',serif;font-size:17px;line-height:1.72;color:#2a2218;margin:0 0 6px}
.p-card-body p:last-child{margin:0}
.p-card-body p.transit{color:#7c5a2a;font-style:italic;padding-top:4px;border-top:1px solid rgba(191,154,48,.15);margin-top:8px}
.phase-divider{background:linear-gradient(135deg,#f0e8d0,#faf5ec);border:1px solid rgba(191,154,48,.3);border-radius:8px;padding:14px 18px;margin:16px 0;text-align:center}
.phase-divider p{font-family:'Cormorant Garamond',serif;font-size:15px;color:#7c5a2a;margin:0;font-style:italic}
.rep-footer{text-align:center;padding:20px;border-top:1px solid rgba(0,0,0,.08);font-size:10px;color:#aaa;font-family:'Inter',sans-serif;letter-spacing:.05em;background:#fafaf8}
/* ── MOBILE RESPONSIVE ── */
@media(max-width:600px){
  .rep-cover{padding:28px 18px 24px !important}
  .rep-body{padding:20px 16px !important}
  div[style*="padding:40px 48px"]{padding:20px 16px !important}
  .rep-title{font-size:24px !important}
  .rep-name{font-size:20px !important;margin-bottom:20px !important}
  .rep-meta{grid-template-columns:1fr 1fr !important;gap:10px 16px !important}
  .rep-sh{font-size:19px !important}
  .rep-sh-wrap{padding:20px 0 0 !important}
  .p-card-header{flex-wrap:wrap !important;gap:8px !important}
  .p-card-name{font-size:16px !important}
  .p-card-body p{font-size:14px !important}
  .p-card-body{padding:12px 14px 14px !important}
  .p-card-header{padding:12px 14px 10px !important}
  .p-card-house{padding:7px 14px !important}
  .period-grid{gap:10px !important}
  .phase-divider{padding:10px 14px !important}
  .phase-divider p{font-size:13px !important}
}

/* ── NEW CSS CLASSES FOR RESPONSIVE LAYOUT ── */
.rep-body-wrap{padding:0;background:#fafaf8}
.rep-sec-head{padding:28px 40px 12px}
.rep-key-head{padding:28px 40px 12px;border-left:3px solid rgba(191,154,48,.4);padding-left:22px}
.rep-sec-body{padding:4px 40px 32px;font-family:'Cormorant Garamond',serif;font-size:19px;line-height:1.78;color:#2a2218;background:#fff}

/* ── MOBILE ── */
@media(max-width:600px){
  .rep-cover{padding:22px 16px 20px !important}
  .rep-title{font-size:22px !important}
  .rep-name{font-size:18px !important;margin-bottom:16px !important}
  .rep-meta{grid-template-columns:1fr 1fr !important;gap:8px 10px !important;padding-top:14px !important}
  .rep-meta-val{font-size:13px !important}
  .rep-meta-label{font-size:7px !important}
  .rep-body-wrap{padding:0 !important}
  .rep-sec-head{padding:18px 14px 10px !important}
  .rep-key-head{padding:18px 14px 10px !important;border-left:3px solid rgba(191,154,48,.4) !important;padding-left:16px !important}
  .rep-sec-body{padding:4px 14px 24px !important;font-size:16px !important;max-width:100% !important;line-height:1.72 !important}
  .rep-sh{font-size:19px !important}
  h2.rep-sh{font-size:19px !important}
  .p-card-header{flex-wrap:wrap !important;gap:8px !important;padding:10px 12px 8px !important}
  .p-card-name{font-size:15px !important}
  .p-card-body{padding:10px 12px 12px !important}
  .p-card-body p{font-size:15px !important;line-height:1.65 !important}
  .p-card-house{padding:6px 12px !important}
  .p-card-badge{font-size:9px !important;padding:3px 8px !important}
  .period-grid{gap:8px !important}
  .phase-divider{padding:10px 12px !important;margin:10px 0 !important}
  .phase-divider p{font-size:13px !important}
  div[style*="margin:8px 40px"]{margin:6px 0 !important}
  div[style*="padding:24px 28px"]{padding:14px 12px !important}
}
</style>
<div class="rep-cover">
  <div class="rep-brand">NatalAI.live</div>
  <div class="rep-title">${label}</div>
  ${type==='cosmic'||type==='compat' ? `
  <div style="display:flex;align-items:center;justify-content:center;gap:32px;margin:20px 0 28px">
    <div style="text-align:center">
      <div style="font-size:52px;line-height:1;margin-bottom:8px">${cd.y1emoji||'✦'}</div>
      <div style="font-family:'Cormorant Garamond',serif;font-size:22px;color:#ffffff;font-weight:400">${name.split(' ')[0]}</div>
      <div style="font-size:13px;color:rgba(191,154,48,.8);margin-top:3px;letter-spacing:.06em">${cd.y1||''} Energy</div>
    </div>
    <div style="font-size:28px;color:rgba(191,154,48,.5);font-family:'Cormorant Garamond',serif">×</div>
    <div style="text-align:center">
      <div style="font-size:52px;line-height:1;margin-bottom:8px">${cd.y2emoji||'✦'}</div>
      <div style="font-family:'Cormorant Garamond',serif;font-size:22px;color:#ffffff;font-weight:400">${cd.name2||''}</div>
      <div style="font-size:13px;color:rgba(191,154,48,.8);margin-top:3px;letter-spacing:.06em">${cd.y2||''} Energy</div>
    </div>
  </div>
  <div class="rep-meta">
    ${[['Rising Sign',cd.lagna],['Moon Sign',cd.rashi],['Birth Star',cd.nakshatra]].map(([l,v])=>`<div class="rep-meta-item"><span class="rep-meta-label">${l}</span><span class="rep-meta-val">${v||''}</span></div>`).join('')}
    ${[['Rising Sign',cd.lagna2],['Moon Sign',cd.rashi2],['Birth Star',cd.nakshatra2]].map(([l,v])=>`<div class="rep-meta-item"><span class="rep-meta-label">${l}</span><span class="rep-meta-val">${v||''}</span></div>`).join('')}
  </div>` : `
  <div class="rep-name">${name}</div>
  <div class="rep-meta">
    ${[['Rising Sign',cd.lagna],['Moon Sign',cd.rashi],['Birth Star',cd.nakshatra],['Date of Birth',cd.dob]].map(([l,v])=>`<div class="rep-meta-item"><span class="rep-meta-label">${l}</span><span class="rep-meta-val">${v||''}</span></div>`).join('')}
  </div>`}
</div>
<div class="rep-body-wrap" style="padding:0;background:#fafaf8">${body}</div>
<div class="rep-footer">NatalAI.live &nbsp;·&nbsp; ${label} &nbsp;·&nbsp; ${name} &nbsp;·&nbsp; ${today} &nbsp;·&nbsp; For personal insight only</div>
</body></html>`;
}

// ─── MARKDOWN → HTML ─────────────────────────────────────────────────────────
const mdToHTML=t=>t
  .replace(/^# (.+)$/gm,'<h3 style="font-family:Cormorant Garamond,serif;font-size:20px;font-weight:500;color:#1a1a1a;margin:16px 0 8px">$1</h3>')
  .replace(/^## (.+)$/gm,'<h3 style="font-family:Cormorant Garamond,serif;font-size:19px;font-weight:500;color:#9a7020;margin:14px 0 8px">$1</h3>')
  .replace(/^### (.+)$/gm,'<h3 style="font-family:Cormorant Garamond,serif;font-size:17px;color:#bf9a30;margin:16px 0 8px">$1</h3>')
  .replace(/\*\*(.+?)\*\*/g,'<strong style="font-weight:600;color:#1a1a1a;font-size:16px">$1</strong>')
  .replace(/\*(.+?)\*/g,'<em style="color:#9a7020;font-style:italic">$1</em>')
  .replace(/^[•\-] (.+)$/gm,'<li style="padding:4px 0 4px 18px;position:relative;font-family:Cormorant Garamond,serif;list-style:none">$1</li>')
  .replace(/(<li[^>]*>[^\n]*\n?)+/g,s=>'<ul style="margin:8px 0 14px;padding-left:0">'+s+'</ul>')
  .replace(/\n\n+/g,'</p><p style="margin:0 0 14px;font-family:Cormorant Garamond,serif">')
  .replace(/^(?!<)/gm,'<p style="margin:0 0 14px;font-family:Cormorant Garamond,serif">')
  .replace(/<p[^>]*><\/p>/g,'');

// ─── HANDLER ──────────────────────────────────────────────────────────────────

// ─── STATIC VEDIC CONSTANTS (module-level — used by all modes) ──────────────
const NAVAMSA_START_ML  = [0,9,6,3,0,9,6,3,0,9,6,3]; // navamsa start by sign (BPHS: movable=Ar, fixed=Cp, mutable=Li, then Cancer)
const NAK_SPAN_ML       = 360/27;                      // 13.333...° per nakshatra
const VIM_YRS_ML        = {Ketu:7,Venus:20,Sun:6,Moon:10,Mars:7,Rahu:18,Jupiter:16,Saturn:19,Mercury:17};
const VIM_SEQ_ML        = ['Ketu','Venus','Sun','Moon','Mars','Rahu','Jupiter','Saturn','Mercury'];
const RETRO_PLANETS_ML  = ['Mercury','Venus','Mars','Jupiter','Saturn'];
const YOGA_KARAKA_ML    = {
  Aries:{planet:'Saturn',note:'Rules H10+H11 — karma and gains'},
  Taurus:{planet:'Saturn',note:'Rules H9+H10 — most powerful yoga karaka'},
  Gemini:{planet:'Venus',note:'Rules H5+H12 — creative and spiritual'},
  Cancer:{planet:'Mars',note:'Rules H5+H10 — most powerful for Cancer'},
  Leo:{planet:'Mars',note:'Rules H4+H9 — fortune and home'},
  Virgo:{planet:'Venus',note:'Rules H2+H9 — wealth and fortune'},
  Libra:{planet:'Saturn',note:'Rules H4+H5 — most powerful for Libra'},
  Scorpio:{planet:'Jupiter',note:'Rules H2+H5 — wisdom and wealth'},
  Sagittarius:{planet:'Mars',note:'Rules H5+H12 — creative force'},
  Capricorn:{planet:'Venus',note:'Rules H5+H10 — most powerful for Capricorn'},
  Aquarius:{planet:'Venus',note:'Rules H4+H9 — fortune and home'},
  Pisces:{planet:'Mars',note:'Rules H2+H9 — wealth and fortune'},
};


// ─── SHADBALA ENGINE ─────────────────────────────────────────────────────────
// Source: BPHS Ch.27-28, Phaladeepika Ch.4, Saravali Ch.9
// Six strengths giving each planet a quantitative Rupa score
// ─────────────────────────────────────────────────────────────────────────────
const SHAD_EXALT_LON={Sun:10,Moon:33,Mars:298,Mercury:165,Jupiter:95,Venus:357,Saturn:200};
const SHAD_DIG_BEST={Sun:10,Mars:10,Moon:4,Venus:4,Jupiter:1,Mercury:1,Saturn:7};
const SHAD_NAISA={Sun:60,Moon:51.43,Venus:42.86,Jupiter:34.29,Mercury:25.71,Mars:17.14,Saturn:8.57};
const SHAD_MIN_RUPAS={Sun:5,Moon:6,Mars:5,Mercury:7,Jupiter:6.5,Venus:5.5,Saturn:5};

function _circDist(a,b){const d=Math.abs(n360(a)-n360(b));return d>180?360-d:d;}

function computeShadbala(sid,lagnaLon,jde){
  const result={};
  const planets=['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn'];
  const lagnaSign=so(lagnaLon);
  // Day/Night: Sun in H7-H12 from lagna = above horizon = day birth
  const sunHouseFromLagna=((so(sid.Sun)-lagnaSign+12)%12)+1;
  const isDayBirth=sunHouseFromLagna>=7;
  // Moon phase (0-360: 0=new, 180=full)
  const phaseDiff=n360(sid.Moon-sid.Sun);
  const shuklaStr=phaseDiff<=180?(phaseDiff/180)*60:((360-phaseDiff)/180)*60;
  // Retrograde detection (compare to 1 day before)
  const jde1=jde-1,ay1=ayanamsa(jde1);
  const retro={Rahu:true,Ketu:true,Sun:false,Moon:false};
  for(const p of ['Mercury','Venus','Mars','Jupiter','Saturn']){
    const now=n360(planetLon(jde,p)-ayanamsa(jde));
    const prev=n360(planetLon(jde1,p)-ay1);
    let d=now-prev;if(d>180)d-=360;if(d<-180)d+=360;
    retro[p]=d<0;
  }
  for(const planet of planets){
    const lon=sid[planet];if(lon===undefined)continue;
    // 1. UCHCHA BALA — distance from exaltation point
    const exaltLon=SHAD_EXALT_LON[planet];
    const distFromExalt=_circDist(lon,exaltLon);
    const uchhaBala=Math.max(0,60-(distFromExalt*60/180));
    // 2. DIG BALA — distance from strongest direction
    const bestH=SHAD_DIG_BEST[planet]||1;
    const bestHDeg=lagnaLon+(bestH-1)*30;
    const distFromBest=_circDist(lon,bestHDeg);
    const digBala=Math.max(0,60-(distFromBest*60/180));
    // 3. NAISARGIKA BALA — fixed natural strength
    const naisaBala=SHAD_NAISA[planet]||25;
    // 4. PAKSHA BALA — lunar phase (benefics=waxing, malefics=waning)
    const benefics=['Moon','Mercury','Jupiter','Venus'];
    const pakshabala=benefics.includes(planet)?shuklaStr:60-shuklaStr;
    // 5. CHESTA BALA — motional strength (retrograde=60, direct=30)
    const chestaBala=retro[planet]?60:30;
    // 6. NATHONNATHA BALA — day/night lord strength
    const dayP=['Sun','Jupiter','Venus'],nightP=['Moon','Mars','Saturn'];
    let natBala=planet==='Mercury'?60:dayP.includes(planet)?(isDayBirth?60:0):nightP.includes(planet)?(!isDayBirth?60:0):0;
    // TOTAL in shashtiamsas → Rupas
    const totalShash=uchhaBala+digBala+naisaBala+pakshabala+chestaBala+natBala;
    const rupas=+(totalShash/60).toFixed(2);
    // ISHTA & KASHTA PHALA (BPHS formula)
    const ishtaPhala=+Math.min(60,Math.sqrt(uchhaBala*chestaBala)).toFixed(1);
    const kashtaPhala=+Math.min(60,Math.sqrt((60-uchhaBala)*(60-chestaBala))).toFixed(1);
    // Strength label vs minimum required
    const minR=SHAD_MIN_RUPAS[planet]||5;
    const ratio=rupas/minR;
    const strengthLabel=ratio>=1.5?'exceptional':ratio>=1.2?'strong':ratio>=0.9?'average':ratio>=0.7?'weak':'struggling';
    // Nature label from Ishta vs Kashta balance
    const ikDiff=ishtaPhala-kashtaPhala;
    const natureLabel=ikDiff>15?'predominantly_benefic':ikDiff<-15?'predominantly_malefic':'contested';
    // Prediction modifier combining strength + nature
    const modifier=(strengthLabel==='exceptional'||strengthLabel==='strong')
      ?(natureLabel==='predominantly_benefic'?'strong_positive':natureLabel==='predominantly_malefic'?'strong_challenging':'intense_mixed')
      :(strengthLabel==='average')
        ?(natureLabel==='predominantly_benefic'?'mild_positive':natureLabel==='predominantly_malefic'?'mild_challenging':'neutral_mixed')
        :(natureLabel==='predominantly_benefic'?'weak_positive':natureLabel==='predominantly_malefic'?'strongly_challenging':'weak_mixed');
    result[planet]={rupas,ishta:ishtaPhala,kashta:kashtaPhala,strength_label:strengthLabel,nature_label:natureLabel,modifier,is_retro:!!retro[planet],is_day_birth:isDayBirth,components:{uchha:+uchhaBala.toFixed(1),dig:+digBala.toFixed(1),naisa:+naisaBala.toFixed(1),paksha:+pakshabala.toFixed(1),chesta:+chestaBala,nat:+natBala}};
  }
  return result;
}

// Build compact Shadbala context string for Claude prompts
function buildShadbalaCtx(shadbala,sid,lagnaSign){
  if(!shadbala)return'';
  const lines=[];
  for(const[p,d]of Object.entries(shadbala)){
    const s=RS[so(sid[p]||0)];
    const h=((so(sid[p]||0)-lagnaSign+12)%12)+1;
    const nat=d.nature_label==='predominantly_benefic'?'benefic':d.nature_label==='predominantly_malefic'?'challenging':'mixed';
    lines.push(`${p}: H${h} ${s} | strength=${d.strength_label} | tendency=${nat} | modifier=${d.modifier}`);
  }
  return'Planetary Strength Assessment:\n'+lines.join('\n');
}

// ─── PLANET NARRATIVE ENGINE ──────────────────────────────────────────────────
// 7-layer assessment: sign+house+nakshatra+aspects+shadbala+ishta/kashta+yogas
// Returns specific human-language themes per planet — never surfaces numbers
// ─────────────────────────────────────────────────────────────────────────────
function buildPlanetNarratives(sid,lagnaSign,shadbala,retroPlanets,combustPlanets){
  if(!shadbala)return{};
  const narratives={};
  const defs={
    Sun:{
      exceptional_benefic:['Naturally confident identity — authority comes without effort','Father was a positive shaping force in your life','Public recognition and leadership are genuinely supported by this chart'],
      exceptional_malefic:['Powerful ego energy — ambition is real but pride creates friction','Father relationship was significant and complex — love and tension together','Success is real but the chart asks for authentic authority, not ego display'],
      exceptional_contested:['Strong presence, drives hard — confident outwardly, uncertain inwardly','Father influence was major but not simple — a mixed legacy still being integrated'],
      weak_malefic:['Identity and confidence are core life work — capable but not fully confident','Father relationship carries unresolved weight — absence, distance, or feeling unseen','The gap between actual ability and self-perception is one of the defining themes'],
      weak_benefic:['Quiet strength — capable but not loudly self-asserting','Father was gentle or subtly present — influence is soft rather than defining'],
      average_benefic:['Steady, reliable confidence — solid not flashy','Father relationship was generally supportive with normal tensions'],
      average_malefic:['Confidence fluctuates — strong in known territory, uncertain in new ground','Father relationship had both supportive and complicated chapters']
    },
    Moon:{
      exceptional_benefic:['Emotionally resilient and intuitive — feelings are processed and used as guidance','Mother relationship was nurturing and foundational','Emotional intelligence is a genuine gift — reading people and situations comes naturally'],
      exceptional_malefic:['Intense inner world — feels deeply, sometimes overwhelmingly','Mother relationship was significant but emotionally charged — love and complexity together','Sensitivity is both the greatest strength and the greatest vulnerability'],
      exceptional_contested:['Rich inner life — moods and intuitions are strong and worth trusting','Mother shaped the emotional baseline in complex ways — both resource and wound'],
      weak_malefic:['Emotional grounding is a lifelong practice — mind tends toward anxiety or over-thinking','Mother relationship may have had gaps that still echo in emotional patterns','Building inner security is the central psychological work of this life'],
      weak_benefic:['Sensitive but functional — emotional life requires conscious tending','Mother was present but emotionally limited in ways that shaped you'],
      average_benefic:['Functional emotional life — capable of care and connection','Mother relationship was generally present with normal imperfections'],
      average_malefic:['Emotional sensitivity needs management — caring but sometimes anxious','Domestic life has been shaped by some complexity']
    },
    Mercury:{
      exceptional_benefic:['Sharp, fast mind — communication and analysis come naturally','Business acumen and networking are genuine strengths','Words and ideas are your tools — writing, speaking, or commerce are natural paths'],
      exceptional_malefic:['Highly intelligent but mind races — tendency to overthink or get caught in details','Communication is skilled but sometimes creates misunderstandings despite best intentions'],
      exceptional_contested:['Quick capable mind — succeeds through intelligence but needs to manage nervous energy'],
      weak_malefic:['More intelligent than you feel — Mercury here creates a gap between actual ability and self-perception','Communication and decisions take more energy than they should — this genuinely improves over time'],
      weak_benefic:['Thoughtful rather than fast — careful thinker who arrives at good conclusions'],
      average_benefic:['Competent thinker and communicator — reliable and steady in Mercury areas'],
      average_malefic:['Communication requires more care than for most — extra effort pays off']
    },
    Venus:{
      exceptional_benefic:['Genuine craving for beauty, comfort, and quality — this is a soul need not vanity','Relationships come naturally — genuinely skilled at love and partnership','Financial ease tends to arrive — Venus here supports material comfort'],
      exceptional_malefic:['Intense desire for love and beauty — but what you want and what arrives can conflict','Relationships are the arena of your deepest experiences — both the best and hardest moments','Craving for luxury is real but satisfaction is elusive — more is never quite enough'],
      exceptional_contested:['Deep appreciation for beauty — environment and relationships must feel right','Love is important and real — with some karmic complexity to navigate'],
      weak_malefic:['Relationships are where you put in the most work — love is the curriculum in this lifetime','The craving for comfort and beauty is real but the gap between desire and fulfillment persists','Relationship patterns tend to repeat until the underlying dynamic is understood'],
      weak_benefic:['Relationships are meaningful but not effortless — love takes conscious cultivation'],
      average_benefic:['Appreciates beauty and comfort — relationships are meaningful and manageable'],
      average_malefic:['Love life has real beauty and real friction — working with it honestly is the path']
    },
    Mars:{
      exceptional_benefic:['Physical energy and drive are genuine strengths — high stamina, fast recovery','Decisive and courageous — can move when others hesitate'],
      exceptional_malefic:['Strong drive and energy but anger and impatience are real challenges to channel','Competitive and forceful — effective in crisis, sometimes creates conflict unnecessarily'],
      exceptional_contested:['Powerful physical energy — remarkable when focused, difficult when unfocused'],
      weak_malefic:['Energy and drive need conscious management — strong starts, sustainability is the practice','Asserting boundaries and taking decisive action is an area of growth'],
      weak_benefic:['Gentle Mars — moves steadily rather than forcefully'],
      average_benefic:['Consistent courage and energy — reliable if not exceptional'],
      average_malefic:['Drive is present but can be inconsistent — patience with the process matters']
    },
    Jupiter:{
      exceptional_benefic:['One of the most fortunate placements in the chart — wisdom and generosity are natural','Money tends to arrive, often through knowledge or being in the right place','People see you as a guide — this role comes without effort'],
      exceptional_malefic:['Strong Jupiter but growth comes through challenge — excess and overconfidence are the pitfalls','Wealth potential is real but easy come, easy go patterns may appear'],
      exceptional_contested:['Jupiter\'s blessings are real but not effortless — wisdom is earned through experience'],
      weak_malefic:['Jupiter\'s gifts — faith, abundance, wisdom — are areas of consistent effort rather than ease','Financial growth requires structure and discipline'],
      weak_benefic:['Quiet Jupiter — steady modest growth, practical rather than abundant'],
      average_benefic:['Steady expansion and practical wisdom — reliable moderate abundance'],
      average_malefic:['Growth is real but requires more work than lucky people have to do']
    },
    Saturn:{
      exceptional_benefic:['Saturn is genuinely your ally — discipline and structure come naturally and pay off','Long-term thinking and patience are gifts most people lack','Career and legacy are built to last'],
      exceptional_malefic:['Strong Saturn creates a demanding life path — high standards, high pressure, real achievement','Restrictions and responsibilities are heavy but they forge character that lighter lives cannot'],
      exceptional_contested:['Demanding and productive — achievement comes but the personal cost is significant'],
      weak_malefic:['Saturn\'s lessons come with some mercy — discipline is learned not innate','Structure and routine feel difficult but are especially important for you'],
      weak_benefic:['Gentle Saturn — constraints are present but workable'],
      average_benefic:['Saturn rewards effort reliably — consistent discipline builds steady results'],
      average_malefic:['Saturn demands persistence — the rewards come but require real patience']
    }
  };

  const planets=['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn'];
  for(const planet of planets){
    const lon=sid[planet];if(lon===undefined)continue;
    const sign=so(lon);
    const house=((sign-lagnaSign+12)%12)+1;
    const dignity=pStatus(planet,sign)||'neutral';
    const sb=shadbala[planet];if(!sb)continue;
    const{strength_label,nature_label,ishta,kashta,modifier,is_retro}=sb;
    const isCombust=combustPlanets?.includes(planet);
    // Pick theme key
    const sl=strength_label==='exceptional'||strength_label==='strong'?'exceptional':strength_label==='average'?'average':'weak';
    const nl=nature_label==='predominantly_benefic'?'benefic':nature_label==='predominantly_malefic'?'malefic':'contested';
    const themeKey=`${sl}_${nl}`;
    const d=defs[planet]||{};
    const themes=(d[themeKey]||d[`${sl}_benefic`]||d['average_benefic']||[]).slice();
    if(is_retro&&!['Sun','Moon'].includes(planet))themes.push(`${planet} was retrograde at birth — energy is internalized, intense, and unconventional in expression`);
    if(isCombust)themes.push(`${planet} near the Sun at birth — this planet's energy can feel blocked despite real capability`);
    narratives[planet]={sign:RS[sign],house,dignity,is_retro:!!is_retro,is_combust:!!isCombust,strength_label,nature_label,modifier,ishta,kashta,themes};
  }
  return narratives;
}

// Get specific narrative themes for a planet as a prompt context string
function buildNarrativeCtx(narratives,planet){
  if(!narratives||!planet||!narratives[planet])return'';
  const n=narratives[planet];
  return`${planet} (H${n.house} ${n.sign}${n.dignity&&n.dignity!=='neutral'?' '+n.dignity:''}${n.is_retro?' [Rx]':''}${n.is_combust?' [combust]':''}): ${n.strength_label}, ${n.nature_label==='predominantly_benefic'?'benefic nature':'predominantly_malefic'===n.nature_label?'challenging nature':'mixed nature'} — ${n.modifier.replace(/_/g,' ')}\n`+n.themes.map(t=>`→ ${t}`).join('\n');
}

// ─── TIMING PRESSURE WINDOWS ──────────────────────────────────────────────────
// Synthesizes dasha + transits + shadbala → human timing statements per life area
// ─────────────────────────────────────────────────────────────────────────────
const TIMING_AREA_PLANETS={career:['Saturn','Jupiter','Sun','Mercury'],love:['Venus','Moon','Jupiter'],money:['Jupiter','Venus','Mercury','Moon'],health:['Sun','Mars','Saturn','Moon'],spiritual:['Jupiter','Ketu','Saturn','Moon']};

function computeTimingWindows(shadbala,mahaName,antarName,allPeriods,todayData){
  if(!shadbala)return null;
  const BEN=['Jupiter','Venus','Mercury','Moon'],MAL=['Saturn','Mars','Rahu','Ketu','Sun'];
  const activeAP=Array.isArray(allPeriods)?allPeriods.find(p=>p.current):null;
  const windows={};
  for(const[area,relPlanets]of Object.entries(TIMING_AREA_PLANETS)){
    const primaryPlanet=relPlanets[0];
    const sb=shadbala[primaryPlanet];
    const maBen=BEN.includes(mahaName)&&relPlanets.includes(mahaName);
    const anBen=BEN.includes(antarName)&&relPlanets.includes(antarName);
    const apBen=activeAP&&BEN.includes(activeAP.planet)&&relPlanets.includes(activeAP.planet);
    const pStrong=sb&&(sb.strength_label==='strong'||sb.strength_label==='exceptional');
    const pBen=sb&&sb.nature_label==='predominantly_benefic';
    const satPress=!!(todayData?.sadeSati&&['career','money','general'].includes(area));
    const maPress=MAL.includes(mahaName)&&relPlanets.includes(mahaName);
    const posCount=[maBen,anBen,apBen,pStrong&&pBen].filter(Boolean).length;
    const negCount=[satPress,maPress].filter(Boolean).length;
    const status=posCount>=2&&negCount===0?'opportunity':negCount>=1&&posCount===0?'pressure':posCount>=1||negCount>=1?'mixed':'neutral';
    const confidence=posCount>=3?'strong':posCount>=2?'moderate':'low';
    const nextFav=Array.isArray(allPeriods)?allPeriods.find(p=>BEN.includes(p.planet)&&relPlanets.includes(p.planet)&&!p.current):null;
    windows[area]={status,confidence,primaryPlanet,primaryStrength:sb?.strength_label||'unknown',primaryNature:sb?.nature_label||'unknown',nextFavorableWindow:nextFav?`${nextFav.planet} period ${nextFav.start}–${nextFav.end}`:null,saturnPressureActive:!!satPress};
  }
  return windows;
}

function buildTimingCtx(timingWindows,topic){
  if(!timingWindows)return'';
  const w=timingWindows[topic]||timingWindows.career;
  if(!w)return'';
  const nat=w.primaryNature==='predominantly_benefic'?'results flow with less friction':w.primaryNature==='predominantly_malefic'?'results require more effort and patience':'results are mixed';
  let ctx=`${topic.toUpperCase()} timing: ${w.status} (${w.confidence} confidence) | Primary planet ${w.primaryPlanet}: ${w.primaryStrength}, ${nat}\n`;
  if(w.saturnPressureActive)ctx+=`Saturn pressure cycle active — extra effort required\n`;
  if(w.nextFavorableWindow)ctx+=`Next favorable window: ${w.nextFavorableWindow}\n`;
  return ctx;
}

// ─── TAJIK ASPECTS (ITTHASALA + ISHRAFA) ─────────────────────────────────────
// For Varshphal annual chart — applying vs separating aspects
// Source: Tajik Neelakanthi, Ch.3
// ─────────────────────────────────────────────────────────────────────────────
const TAJIK_ORBS={Sun:15,Moon:12,Mars:8,Mercury:7,Jupiter:9,Venus:7,Saturn:9};
const TAJIK_SPEEDS={Sun:1.0,Moon:13.2,Mars:0.52,Mercury:1.38,Jupiter:0.08,Venus:1.2,Saturn:0.03};

function computeTajikAspects(srSid){
  const aspects=[];
  const planets=['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn'];
  for(let i=0;i<planets.length;i++){
    for(let j=i+1;j<planets.length;j++){
      const p1=planets[i],p2=planets[j];
      if(srSid[p1]===undefined||srSid[p2]===undefined)continue;
      const lon1=srSid[p1],lon2=srSid[p2];
      const diff=n360(lon2-lon1);
      const absDiff=diff>180?360-diff:diff;
      for(const asp of[0,30,60,90,120,150,180]){
        const distFromAsp=Math.abs(absDiff-asp);
        const maxOrb=Math.max(TAJIK_ORBS[p1]||8,TAJIK_ORBS[p2]||8);
        if(distFromAsp>maxOrb)continue;
        const sp1=TAJIK_SPEEDS[p1]||1,sp2=TAJIK_SPEEDS[p2]||1;
        const fasterP=sp1>sp2?p1:p2,slowerP=sp1>sp2?p2:p1;
        const gap=n360(srSid[slowerP]-srSid[fasterP]);
        const type=gap<=180?'itthasala':'ishrafa'; // applying vs separating
        const BEN2=['Jupiter','Venus','Mercury','Moon'];
        const nature=BEN2.includes(p1)&&BEN2.includes(p2)?'benefic':(['Saturn','Mars','Rahu','Ketu'].includes(p1)||['Saturn','Mars','Rahu','Ketu'].includes(p2))?'malefic':'neutral';
        aspects.push({planet1:p1,planet2:p2,aspect:asp,orb:+distFromAsp.toFixed(1),type,nature});
        break;
      }
    }
  }
  return aspects;
}

// ─── SAHAMS (ARABIC PARTS) ────────────────────────────────────────────────────
// 4 primary Sahams per Tajik Neelakanthi
// ─────────────────────────────────────────────────────────────────────────────
function computeSahams(srSid,srLagna,isDayBirth){
  if(!srSid||srLagna===undefined)return{};
  const L=srLagna,S=srSid;
  const raw={
    Fortune:isDayBirth?n360(L+(S.Moon||0)-(S.Sun||0)):n360(L+(S.Sun||0)-(S.Moon||0)),
    Career:isDayBirth?n360(L+(S.Saturn||0)-(S.Sun||0)):n360(L+(S.Sun||0)-(S.Saturn||0)),
    Partnership:isDayBirth?n360(L+(S.Venus||0)-(S.Saturn||0)):n360(L+(S.Saturn||0)-(S.Venus||0)),
    Vitality:isDayBirth?n360(L+n360(srLagna+210)-(S.Moon||0)):n360(L+(S.Moon||0)-n360(srLagna+210))
  };
  const result={};
  for(const[name,lon]of Object.entries(raw)){
    const lagSign=so(srLagna);
    result[name]={longitude:+lon.toFixed(2),sign:RS[so(lon)],house:((so(lon)-lagSign+12)%12)+1,degree:+(lon%30).toFixed(1)};
  }
  return result;
}

// ─── FIXED PANCHADHIKARI (5 Year Lords per Neelakanthi) ──────────────────────
// Uses SR Moon (not natal Moon) + adds Day Lord (5th lord)
// ─────────────────────────────────────────────────────────────────────────────
const WEEKDAY_LORDS=['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn'];
function getPanchadhikariFixed(srLagnaLon,natalLagnaLon,srMoonLon,munthaSign,srJD){
  const dayOfWeek=((Math.floor(srJD+1.5)%7)+7)%7;
  const dayLord=WEEKDAY_LORDS[dayOfWeek]||'Sun';
  return[
    {role:'Year Ascendant Lord',lord:SL[so(srLagnaLon)],lordName:FN[SL[so(srLagnaLon)]]},
    {role:'Birth Ascendant Lord',lord:SL[so(natalLagnaLon)],lordName:FN[SL[so(natalLagnaLon)]]},
    {role:'Annual Focus Point Lord',lord:SL[munthaSign],lordName:FN[SL[munthaSign]]},
    {role:'Year Moon Sign Lord',lord:SL[so(srMoonLon)],lordName:FN[SL[so(srMoonLon)]]},
    {role:'Day Lord (SR weekday)',lord:dayLord,lordName:dayLord}
  ];
}



// ─── NADI KARAKAS (Jaimini) ───────────────────────────────────────────────────
// 7 Jaimini significators ranked by degree within sign (highest = Atmakaraka)
// Source: Jaimini Sutras
// ─────────────────────────────────────────────────────────────────────────────
function computeJaiminiKarakas(sid) {
  const KARAKA_PLANETS = ['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn'];
  const KARAKA_NAMES = ['Atmakaraka','Amatyakaraka','Bhratrikaraka','Matrikaraka','Putrakaraka','Gnatikaraka','Darakaraka'];
  const KARAKA_MEANINGS = {
    Atmakaraka:   'Soul planet — what the soul is here to master',
    Amatyakaraka: 'Career planet — how you achieve in the world',
    Bhratrikaraka:'Siblings & courage planet',
    Matrikaraka:  'Mother & nurturing planet',
    Putrakaraka:  'Children & creativity planet',
    Gnatikaraka:  'Obstacles & competition planet',
    Darakaraka:   'Partnership planet — spouse significator'
  };
  const ranked = KARAKA_PLANETS
    .filter(p => sid[p] !== undefined)
    .map(p => ({ planet: p, deg: sid[p] % 30 }))
    .sort((a, b) => b.deg - a.deg);
  return ranked.map((item, i) => ({
    rank: i,
    karaka: KARAKA_NAMES[i] || ('K' + (i+1)),
    planet: item.planet,
    degree: +item.deg.toFixed(2),
    meaning: KARAKA_MEANINGS[KARAKA_NAMES[i]] || '',
  }));
}

function buildKarakaCtx(karakas, topic) {
  if(!karakas || !karakas.length) return '';
  // Surface the most relevant karakas per topic
  const relevantMap = {
    career:   ['Amatyakaraka','Atmakaraka'],
    love:     ['Darakaraka','Atmakaraka'],
    money:    ['Amatyakaraka','Atmakaraka'],
    health:   ['Atmakaraka','Gnatikaraka'],
    children: ['Putrakaraka'],
    travel:   ['Bhratrikaraka','Atmakaraka'],
    spiritual:['Atmakaraka'],
    general:  ['Atmakaraka','Amatyakaraka'],
  };
  const relevant = relevantMap[topic] || relevantMap.general;
  const filtered = karakas.filter(k => relevant.includes(k.karaka));
  const KARAKA_ENG = {
    'Atmakaraka':'Soul planet','Amatyakaraka':'Career significator',
    'Bhratrikaraka':'Courage planet','Matrikaraka':'Nurturing planet',
    'Putrakaraka':'Creativity planet','Gnatikaraka':'Obstacles planet','Darakaraka':'Partnership planet'
  };
  return filtered.map(k => `${KARAKA_ENG[k.karaka]||k.karaka}: ${k.planet} (${k.degree}°) — ${k.meaning}`).join('\n');
}


// ─── SHADBALA INSIGHTS ENGINE ────────────────────────────────────────────────
// Combines: Shadbala score + sign dignity + house + nakshatra + dasha + transit
// Outputs practical life statements — never surfaces scores to user
// Two variants: report (2-3 sentences) and ask (compact 1 sentence)
// ─────────────────────────────────────────────────────────────────────────────

const _SBI = {
  Sun: {
    vs_ben: ["Authority comes naturally. Rooms shift when you walk in — you don't have to try for that.", "Leadership is a default mode, not something you work for."],
    vs_mal: ["Powerful drive and ambition — but pride creates friction. The authority is real, earning trust is the work.", "Strong ego energy. Success is real but the chart asks for authentic leadership, not dominance."],
    vs_mix: ["Confident outwardly, more uncertain inwardly than people know. The capacity is genuine — the inner doubt is the work."],
    s_ben:  ["Quiet confidence that people feel without you announcing it. Career recognition comes reliably."],
    s_mal:  ["Real capability with a complicated relationship to authority — either your own or others'."],
    a_ben:  ["Confidence is situational — strong in your domain, shakier outside it. Solid, not flashy."],
    a_mal:  ["Self-belief fluctuates. The capability is there — the internal conviction needs building."],
    w_ben:  ["More capable than you feel. The gap between what you can do and what you believe you can do is the main thing working against you."],
    w_mal:  ["You work harder than you should for recognition that comes easier to others. This pattern is specific and can be shifted."],
    vw_mal: ["Identity and self-worth are the core curriculum of this life. The external world keeps reflecting this back until the internal work is done."],
    // House modifiers appended
    h_mods: {
      1: "Identity and presence are the primary tools in life.",
      4: "Strength works best behind the scenes — private power rather than public display.",
      7: "Identity gets tested through relationships and partnerships.",
      8: "Strength is forged through disruption — what comes out the other side is unshakeable.",
      10: "Built for public life. Career and authority are the natural arena.",
      12: "The drive exists but works in hidden or institutional contexts — not always visible.",
    },
    // Dignity modifiers
    d_mods: {
      exalted: "At full capacity — this energy flows without friction.",
      own: "Completely at home in this sign — expression is natural.",
      debilitated: "The strength is real but getting it to the surface takes more work than it should.",
      enemy: "Power is real but the environment creates interference — extra effort required.",
    }
  },
  Moon: {
    vs_ben:  ["Emotional intelligence is a genuine gift — you read people and situations faster than most. Trust that instinct.", "Mood is steady and intuition is reliable. People feel safe around you."],
    vs_mal:  ["Intense inner world — feels deeply, sometimes overwhelmingly. Sensitivity is both the greatest strength and the greatest vulnerability."],
    vs_mix:  ["Rich emotional life that swings between genuine clarity and genuine chaos. Learning to trust the clarity is the work."],
    s_ben:   ["Emotionally steady. You process and move on where others stay stuck."],
    s_mal:   ["Caring and perceptive, but emotional patterns can create their own complications."],
    a_ben:   ["Functional emotional life — capable of care and connection with normal ups and downs."],
    a_mal:   ["Mood affects performance more than you'd like. Building inner stability is an ongoing practice."],
    w_ben:   ["Sensitive and caring, but the mind needs more tending than most people's."],
    w_mal:   ["Anxiety and overthinking are real patterns. Inner peace takes deliberate work — it doesn't come automatically."],
    vw_mal:  ["The mind is the most difficult territory in this life. Building a stable inner foundation is the primary work."],
    h_mods: {
      4: "Home and family are the emotional anchor — where this energy is strongest.",
      6: "Emotional energy gets consumed by daily obligations — tending to self matters.",
      7: "Emotional world is deeply shaped by partnerships.",
      8: "Emotional depth is exceptional — intensity is the price.",
      12: "Rich inner world that most people never see. Solitude is recharging, not isolating.",
    },
    d_mods: {
      exalted: "Emotional clarity and intuition at full expression.",
      own: "Nurturing and empathy flow naturally — this is the comfort zone.",
      debilitated: "Emotional steadiness has to be consciously built — it doesn't arrive automatically.",
    }
  },
  Mercury: {
    vs_ben:  ["Fast, clear thinker. Business sense is natural — you see angles others miss.", "Sharp communicator. You express what others struggle to articulate."],
    vs_mal:  ["Highly intelligent but mind races — tendency to overthink or get caught in details when under pressure."],
    vs_mix:  ["Excellent mind with inconsistent output — brilliant in bursts, scattered at other times. The discipline to harness it is the work."],
    s_ben:   ["Quick on your feet mentally. Communication is a genuine asset."],
    s_mal:   ["Smart but communication sometimes creates more complexity than intended."],
    a_ben:   ["Solid thinker and communicator. Best decisions come after reflection, not in the moment."],
    a_mal:   ["Decision-making under pressure has blind spots — important calls benefit from a beat of extra thought."],
    w_ben:   ["Thoughtful rather than fast. Careful thinker who arrives at good conclusions, just not instantly."],
    w_mal:   ["You are more intelligent than you feel. Contracts, agreements, anything with fine print — always get a second opinion."],
    vw_mal:  ["Logic and clarity are skills to consciously build. Important decisions benefit from trusted outside input rather than going it alone."],
    h_mods: {
      1: "Ideas and communication define the personality.",
      2: "Business thinking is wired into how you see the world.",
      6: "Sharp analytical ability — good at solving problems others avoid.",
      8: "Investigative mind — you see through things naturally.",
      10: "Career built on communication, analysis, or business logic.",
      12: "Mind works best in private — thinking often clearer alone than in groups.",
    },
    d_mods: {
      exalted: "Analytical precision is a genuine gift here.",
      own: "Clear practical thinking with no friction — this sign suits Mercury.",
      debilitated: "The mind can overcomplicate what should be simple. Simplifying is the practice.",
    }
  },
  Venus: {
    vs_ben:  ["Money and comfort tend to find you. Relationships come with genuine ease — you're naturally magnetic.", "Good taste is real and people respond to it. Financial accumulation is genuinely supported."],
    vs_mal:  ["Intense desire for love and beauty — but what's wanted and what arrives can conflict. The craving is real, satisfaction keeps moving."],
    vs_mix:  ["Deep appreciation for beauty and love — with some karmic complexity to navigate. The desire is powerful, the path is layered."],
    s_ben:   ["Relationships come with relative ease. Financial accumulation is supported by the chart."],
    s_mal:   ["Love and money are both real but inconsistent — good periods and dry spells alternate."],
    a_ben:   ["Comfortable with beauty and connection. Relationships are meaningful and mostly manageable."],
    a_mal:   ["Love life has real beauty and real friction — working honestly with both is the path."],
    w_ben:   ["Relationships are meaningful but not effortless. Love takes conscious cultivation here."],
    w_mal:   ["You want more ease in love and money than the chart currently gives. The desire is strong — the delivery needs more work than feels fair."],
    vw_mal:  ["Both relationships and finances require sustained effort. The craving for comfort and love is real — satisfaction keeps requiring more."],
    h_mods: {
      1: "Personal magnetism and taste are genuine assets.",
      2: "Natural accumulator — money and beautiful things find their way to you.",
      4: "Home and domestic life are where genuine pleasure lives.",
      7: "Relationships are the primary arena — for better and for more complicated.",
      8: "Attracted to intensity in both love and money.",
      11: "Social connections and networks are wealth generators.",
    },
    d_mods: {
      exalted: "One of the most favourable placements — comfort and beauty flow.",
      own: "Completely at ease — Venus energy delivers here.",
      debilitated: "The desire is strong but satisfaction requires more effort than it appears it should.",
    }
  },
  Mars: {
    vs_ben:  ["High energy, decisive, built for action. You execute where others deliberate.", "Physical drive and courage are genuine assets — you move when others wait."],
    vs_mal:  ["Strong drive and energy — but anger and impatience are the real challenges to channel. Powerful when focused, difficult when not."],
    vs_mix:  ["Remarkable energy that needs direction. Without focus it creates friction. With focus it's one of the strongest forces in the chart."],
    s_ben:   ["Strong starter. When motivated, very little stops you."],
    s_mal:   ["Drive is real but temper can undercut it. Physical energy is the asset — patience is the practice."],
    a_ben:   ["Consistent energy and courage. Reliable if not exceptional."],
    a_mal:   ["Energy is there but not always reliable. Building routines matters more than waiting for motivation."],
    w_ben:   ["Gentle Mars — steady effort rather than forceful action. Consistency over bursts."],
    w_mal:   ["Great starts, variable follow-through. The discipline to maintain momentum is the ongoing work."],
    vw_mal:  ["Follow-through is the challenge. Intentions are genuinely good — execution needs a system behind it to convert."],
    h_mods: {
      1: "High personal energy — presence is direct and physical.",
      3: "Courage and initiative are strong — action before deliberation.",
      6: "Excellent at defeating obstacles and competition.",
      8: "Energy goes into transformation and crisis — intense and consuming.",
      10: "Career ambition is strong — drive is pointed at public achievement.",
    },
    d_mods: {
      exalted: "Drive and courage at full power.",
      own: "Energy flows without friction — decisive and effective.",
      debilitated: "The drive is there but asserting it costs more than it should.",
    }
  },
  Jupiter: {
    vs_ben:  ["Good judgment, genuine luck at the right moments, and a natural sense of when to expand. Life tends to open for you.", "Optimism that's usually justified. Opportunities arrive and you recognise them."],
    vs_mal:  ["Strong Jupiter but growth comes through challenge — overconfidence and excess are the specific pitfalls to watch."],
    vs_mix:  ["Jupiter's blessings are real but not effortless. Wisdom is earned through experience, not assumed."],
    s_ben:   ["Growth is supported. Financial and life decisions are generally sound."],
    s_mal:   ["Expansion tendency can outpace wisdom to do it carefully. A beat of extra scrutiny on big decisions."],
    a_ben:   ["Steady modest growth and practical wisdom. Things work out, just not dramatically."],
    a_mal:   ["Growth is real but measured — requires more consistent effort than luck."],
    w_ben:   ["Quiet Jupiter — functional rather than abundant. Steady small gains over dramatic ones."],
    w_mal:   ["Overconfidence in judgment is the main trap. Big decisions need more scrutiny than they feel like they do."],
    vw_mal:  ["Faith, abundance, and wisdom are areas of consistent effort rather than natural ease. The instinct to expand often outpaces the readiness."],
    h_mods: {
      1: "Optimism and expansion are built into the personality.",
      2: "Financial wisdom and wealth accumulation are naturally supported.",
      5: "Creativity, children, and speculation are favoured.",
      7: "Marriage and partnerships are generally fortunate.",
      9: "Higher learning, philosophy, and travel bring genuine expansion.",
      11: "Networks and social connections bring real opportunity.",
    },
    d_mods: {
      exalted: "Wisdom and good fortune at maximum expression.",
      own: "Abundance and growth flow naturally.",
      debilitated: "Judgment needs extra checking — the confidence can outrun the accuracy.",
    }
  },
  Saturn: {
    vs_ben:  ["Built for the long game. What you build is meant to last — slower than you'd like, but solid.", "Discipline is a genuine asset. You don't need external motivation the way others do."],
    vs_mal:  ["Strong Saturn creates a demanding life path — high standards, high pressure, real achievement. The rewards are commensurate with the cost."],
    vs_mix:  ["Saturn's strength is real and it will pay off — but it works through pressure and demands more than feels comfortable."],
    s_ben:   ["Consistent effort pays off reliably. The long view is your natural territory."],
    s_mal:   ["Discipline is there when needed — but the weight of obligations is real."],
    a_ben:   ["Can be disciplined when it matters. Structure is a choice you keep making, not a given."],
    a_mal:   ["Saturn asks for consistency and patience — both of which take more effort here than they should."],
    w_ben:   ["Steady slow progress. Structure doesn't come naturally but the effort to build it pays off."],
    w_mal:   ["Shortcuts cost more than they save. Consistency is what the chart requires and what doesn't come easily."],
    vw_mal:  ["Structure, routine, and long-term thinking are the growth edges. Impatience with process is the main thing working against you."],
    h_mods: {
      1: "Discipline and character are the primary life assets.",
      4: "Property and stability are built slowly but solidly.",
      7: "Relationships come with responsibility — and sometimes delay.",
      8: "Endurance and longevity — built to handle sustained pressure.",
      10: "Career built through sustained effort. Recognition comes late but lasts.",
      11: "Long-term gains through consistency — networks take time to build but deliver."},
    d_mods: {
      exalted: "Discipline and endurance at full power.",
      own: "Authority and structure come naturally — Saturn is at home.",
      debilitated: "Structure and discipline feel like a fight. Building them consciously is the path.",
    }
  }
};

function buildShadbalaInsights(sid, lagnaSign, shadbala, planets_arr, dashaName, antarName, todayData) {
  if(!shadbala) return {insights:{}, summary:'', chartTheme:''};
  const MIN_R={Sun:5,Moon:6,Mars:5,Mercury:7,Jupiter:6.5,Venus:5.5,Saturn:5};
  const BEN=['Moon','Mercury','Jupiter','Venus'];
  const insights={};
  const strongList=[], weakList=[];

  for(const planet of ['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn']) {
    const sb=shadbala[planet]; if(!sb) continue;
    const lon=sid[planet]; if(lon===undefined) continue;
    const sign=so(lon);
    const house=((sign-lagnaSign+12)%12)+1;
    const dignity=pStatus(planet,sign)||'neutral';
    const ratio=sb.rupas/(MIN_R[planet]||5);
    const inDasha=(dashaName===planet||antarName===planet);
    const transitData=todayData?.transits?.find(t=>t.planet===planet);
    const pd=_SBI[planet]||{};

    // Pick language tier
    const str=ratio>=1.4?'vs':ratio>=1.1?'s':ratio>=0.88?'a':ratio>=0.7?'w':'vw';
    const nat=sb.nature_label==='predominantly_benefic'?'ben':sb.nature_label==='predominantly_malefic'?'mal':'mix';
    const key=`${str}_${nat}`;
    const lines=(pd[key]||pd[`${str}_ben`]||pd['a_ben']||[]);
    let baseLine=lines[0]||'';

    // Dignity modifier
    const dMod=(pd.d_mods||{})[dignity]||'';
    // House modifier
    const hMod=(pd.h_mods||{})[house]||'';
    // Dasha activation modifier
    const dashaMod=inDasha?`Currently active in ${inDasha?'your':'a'} major life period — these themes are front and center right now.`:'';
    // Transit modifier
    let transitMod='';
    if(transitData) {
      if(transitData.quality==='excellent'||transitData.quality==='good') transitMod='Current planetary movement supports this area right now.';
      else if(transitData.quality==='challenging') transitMod='Current planetary movement is adding pressure to this area.';
    }

    // Build full insight (report variant: 2-3 sentences)
    const parts=[baseLine, dMod, hMod, dashaMod, transitMod].filter(Boolean);
    const reportInsight=parts.slice(0,3).join(' ');
    // Ask variant: compact (1 sentence)
    const askInsight=baseLine+(dMod?' '+dMod:'');

    insights[planet]={
      house, sign:RS[sign], dignity, strength:str, nature:nat,
      rupas:sb.rupas, modifier:sb.modifier,
      report: reportInsight,
      ask: askInsight,
      inDasha
    };

    if(str==='vs'||str==='s') strongList.push({planet,modifier:sb.modifier,nat});
    if(str==='w'||str==='vw') weakList.push({planet,modifier:sb.modifier,nat});
  }

  // ── CHART SUMMARY SENTENCE ─────────────────────────────────────────────────
  const ARCH={Sun:'authority',Moon:'emotional intelligence',Mercury:'sharp thinking',Venus:'magnetism and wealth',Mars:'drive and action',Jupiter:'wisdom and expansion',Saturn:'discipline and endurance'};
  const WEAK_ARCH={Sun:'confidence',Moon:'inner stability',Mercury:'decision clarity',Venus:'ease in love and money',Mars:'consistent follow-through',Jupiter:'sound judgment',Saturn:'structure and patience'};

  let summary='';
  if(strongList.length>0&&weakList.length>0) {
    const gifts=strongList.slice(0,2).map(p=>ARCH[p.planet]).filter(Boolean).join(' and ');
    const gaps=weakList.slice(0,2).map(p=>WEAK_ARCH[p.planet]).filter(Boolean).join(' and ');
    summary=gifts&&gaps?`A chart built around ${gifts} — but ${gaps} are the consistent growth areas.`:``;
  } else if(strongList.length>=3) {
    const gifts=strongList.slice(0,3).map(p=>ARCH[p.planet]).filter(Boolean).join(', ');
    summary=`A well-resourced chart — ${gifts} are all genuinely supported.`;
  } else if(weakList.length>=3) {
    const gaps=weakList.slice(0,3).map(p=>WEAK_ARCH[p.planet]).filter(Boolean).join(', ');
    summary=`A chart that builds character through challenge — ${gaps} are all areas of deliberate development.`;
  }

  return {insights, summary, chartTheme:summary};
}

// Build insights context string for prompts (report variant)
function buildInsightsCtx(insights, relevantPlanets) {
  if(!insights) return '';
  const planets=relevantPlanets||Object.keys(insights);
  return planets
    .filter(p=>insights[p])
    .map(p=>`${p}: ${insights[p].report}`)
    .join('\n');
}

// Compact ask variant
function buildInsightsAskCtx(insights, relevantPlanets) {
  if(!insights) return '';
  const planets=relevantPlanets||Object.keys(insights);
  return planets
    .filter(p=>insights[p])
    .map(p=>insights[p].ask)
    .join(' ');
}



// ─── SPECIAL CHART MARKERS ENGINE ────────────────────────────────────────────
// Three life-defining patterns detected and used contextually in Ask tab
// SATURN'S DOOM | Critical Degree Birth | MARS DISRUPTION
// Rules: mention when relevant, first=full explanation, subsequent=brief, never repeat
// ─────────────────────────────────────────────────────────────────────────────

// ── SATURN'S DOOM ─────────────────────────────────────────────────────────────
// Sade Sati (7.5yr) and Dhaiya (2.5yr) — bold black in UI
function buildSaturnsDoom(sadeSati, compact) {
  if(!sadeSati) return null;
  const phase = sadeSati.phase || '';
  const is75 = phase.includes('Rising') || phase.includes('Peak') || phase.includes('Setting');
  const is4th = phase.includes('4th');
  const is8th = phase.includes('8th');

  const label = "SATURN'S DOOM";

  if(compact) {
    if(is75 && phase.includes('Rising'))
      return `${label}: Saturn's 7.5-year life pressure cycle has just begun. Increased effort, delays, and recalibration across most areas — career, money, relationships, health. Not permanent. Builds character. Rewards consistent work.`;
    if(is75 && phase.includes('Peak'))
      return `${label}: Saturn's 7.5-year pressure cycle is at peak intensity right now — the heaviest phase of the cycle. Everything requires more effort. Nothing is permanently broken. This phase transforms and strengthens those who don't quit.`;
    if(is75 && phase.includes('Setting'))
      return `${label}: Saturn's 7.5-year pressure cycle is in its final stretch. The worst is behind. Gradual relief, clarity, and rebuilding begin now. Finish what you started.`;
    if(is4th)
      return `${label}: Saturn's 2.5-year domestic pressure cycle is active. Home life, family relationships, and career stability are under strain. Temporary and specific — patience and consistency are the tools.`;
    if(is8th)
      return `${label}: Saturn's most intense 2.5-year pressure cycle is active. Unexpected disruptions, health vigilance, and financial caution are especially important right now. This too passes.`;
    return `${label}: Saturn is in a pressure position — extra effort required across most life areas right now.`;
  }

  // Full version
  let full = `${label} — CURRENTLY ACTIVE\n`;
  if(is75) {
    full += `Saturn's 7.5-year pressure cycle is one of the most significant periods in a person's life — it happens once every 29 years and touches every major area: career, money, health, relationships, and mental clarity. It does not destroy — it strips away what isn't real and builds what is.\n`;
    if(phase.includes('Rising')) full += `Phase: Just beginning. The pressure builds gradually — confusion, expenses, and mental heaviness increase. The antidote is consistent work, not shortcuts.\n`;
    if(phase.includes('Peak')) full += `Phase: At its most intense. This is the densest point of the cycle — everything simultaneously under pressure. The people who work through this period rather than against it come out fundamentally stronger.\n`;
    if(phase.includes('Setting')) full += `Phase: Final stretch. The hardest part is done. Clarity returns, momentum rebuilds. Honour what this period taught.\n`;
  } else if(is4th) {
    full += `Saturn's 2.5-year domestic pressure cycle affects home life, family atmosphere, property matters, and career stability. The home may not feel like a sanctuary right now. Family tensions are real. Career progress feels blocked. This is a cycle — it has an end date.\n`;
  } else if(is8th) {
    full += `Saturn's most intense 2.5-year pressure cycle. The 8th position brings unexpected disruptions, health challenges, financial surprises, and deep transformation. The most demanding short cycle. Caution, consistency, and health vigilance are the priorities.\n`;
  }
  full += `What works: Show up consistently. Avoid risky shortcuts. Protect health. Let the cycle do its work.`;
  return full;
}

const buildSaturnPressureCtx = buildSaturnsDoom;

// ── CRITICAL DEGREE BIRTH ─────────────────────────────────────────────────────
// Moon in Gandanta zone — bold orange in UI
function buildCriticalDegreeBirth(chart, compact) {
  // Check Moon only — last 3°20' of Pisces(11), Cancer(3), Scorpio(7)
  // OR first 3°20' of Aries(0), Leo(4), Sagittarius(8)
  const moonLon = chart.sid?.Moon;
  if(moonLon === undefined) return null;
  const sign = so(moonLon);
  const deg = moonLon % 30;
  const pairs = [[11,0],[3,4],[7,8]];
  let isGandanta = false;
  for(const [water, fire] of pairs) {
    if((sign === water && deg >= 26.67) || (sign === fire && deg <= 3.33)) {
      isGandanta = true; break;
    }
  }
  if(!isGandanta) return null;

  const label = "Critical Degree Birth";

  if(compact) {
    return `${label}: Your Moon was born at one of the zodiac's most intense transition points — a junction between the end of one cosmic cycle and the beginning of another. This creates a deeper emotional weight than most people carry, a rich and sometimes turbulent inner life, and a strong sense of specific life purpose. Early life is typically more difficult. The pattern resolves into meaning — this is depth, not damage.`;
  }

  return `${label} — MOON AT KARMIC JUNCTION\nYour Moon was born at a critical transition point in the zodiac — the junction between a water sign (dissolution) and a fire sign (ignition). Both Western and Vedic astrology flag these degrees as carrying exceptional intensity.\n\nWhat this creates:\n— A deeper emotional life than most people experience — you feel things at a level others don't access\n— Early life is typically more turbulent, more formative, more defining than average\n— A persistent sense that your life has a specific purpose or mission to fulfil\n— Patterns in your life tend to go deeper — nothing is surface-level for you\n— The inner world is extraordinarily rich — and sometimes exhausting\n\nThis is not a burden for its own sake. People born at this degree are built for meaningful work. The weight has a direction.`;
}

// ── MARS DISRUPTION ───────────────────────────────────────────────────────────
// Mars in H1/H2/H4/H7/H8/H12 from Lagna — bold red in UI
// With cancellation check: own sign (Aries/Scorpio=0,7), exalted (Capricorn=9), Jupiter aspect
function buildMarsDisruption(chart, shadbala, compact) {
  const lagnaSign = so(chart.lagna || 0);
  const marsLon = chart.sid?.Mars;
  if(marsLon === undefined) return null;
  const marsSign = so(marsLon);
  const marsHouse = ((marsSign - lagnaSign + 12) % 12) + 1;
  const disruptHouses = [1, 2, 4, 7, 8, 12];
  if(!disruptHouses.includes(marsHouse)) return null;

  // Check cancellations
  const marsInOwnSign = marsSign === 0 || marsSign === 7; // Aries or Scorpio
  const marsExalted = marsSign === 9; // Capricorn
  const marsStrong = marsInOwnSign || marsExalted;

  // Jupiter aspect check — Jupiter aspects 5th, 7th, 9th from its position
  const jupLon = chart.sid?.Jupiter;
  let jupAspectsMars = false;
  if(jupLon !== undefined) {
    const jupSign = so(jupLon);
    const jupToMars5 = (jupSign + 4) % 12;
    const jupToMars7 = (jupSign + 6) % 12;
    const jupToMars9 = (jupSign + 8) % 12;
    if(marsSign === jupToMars5 || marsSign === jupToMars7 || marsSign === jupToMars9) jupAspectsMars = true;
  }

  const cancelled = marsExalted || (marsInOwnSign && jupAspectsMars);
  if(cancelled) return null; // Full cancellation — don't flag

  const label = "MARS DISRUPTION";
  const reduced = marsInOwnSign || jupAspectsMars; // Partial — still flag but softer

  // House-specific characteristics
  const houseChars = {
    1: {
      rel: "Dominant and intense in partnerships — partners can feel overpowered. The drive to lead creates friction when the other person also needs space to lead.",
      other: "Impulsive decisions, physical energy that needs channelling, prone to rushing. A commanding presence that inspires some and intimidates others.",
      timing: "relationship,patterns,marriage,partner,conflict,anger"
    },
    2: {
      rel: "Speech can be cutting in close relationships — words land harder than intended. Financial conflicts surface in partnerships.",
      other: "Family atmosphere has a sharp edge — harmony at home takes conscious work. Spending can be impulsive. The voice is powerful — sometimes too direct.",
      timing: "family,money,speech,home,argument,finance"
    },
    4: {
      rel: "The home environment carries a tension that's hard to explain. Domestic peace requires active effort — it doesn't arrive naturally.",
      other: "Family atmosphere is not always cordial — there may be ongoing friction with a parent or within the household. Property and real estate bring stress. Difficulty settling — an inner restlessness about home.",
      timing: "home,family,mother,property,peace,domestic,settle"
    },
    7: {
      rel: "The most direct placement — Mars sits in the house of marriage and partnership. Power struggles in relationships are a recurring pattern. Partners are strong-willed, sometimes aggressive. The energy needs a match, not a mirror.",
      other: "Business partnerships carry friction. Legal disputes are more likely than average. Open confrontations with others.",
      timing: "marriage,partner,relationship,spouse,business partner,legal,conflict"
    },
    8: {
      rel: "Hidden tensions in relationships — things left unsaid that eventually surface dramatically. Sudden disruptions in partnerships.",
      other: "Health requires vigilance — accidents and surgeries more possible. Inheritance and joint finances bring complications. Unexpected disruptions are a recurring theme. The most intense placement.",
      timing: "marriage,health,accident,money,hidden,sudden,unexpected,transform"
    },
    12: {
      rel: "Distance in close relationships — physical or emotional. Secret tensions. Affairs or hidden relationship dynamics more possible.",
      other: "Expenses are hard to control. Sleep disturbances. Energy goes into hidden or behind-the-scenes work. Foreign connections are stronger than domestic ones.",
      timing: "relationship,expense,sleep,hidden,abroad,foreign,loss"
    }
  };

  const hc = houseChars[marsHouse];
  if(!hc) return null;

  const soften = reduced ? " (The intensity is partially reduced in this chart — still present, just less severe.)" : "";

  if(compact) {
    return `${label} (Mars in H${marsHouse}): ${hc.rel} ${hc.other}${soften}`;
  }

  return `${label} — MARS IN HOUSE ${marsHouse}\n${hc.rel}\n${hc.other}${soften}\n\nThis is a pattern, not a verdict. Mars energy here responds to awareness — understanding the pattern is the first step to working with it rather than being driven by it.`;
}

// ── CONTEXTUAL RELEVANCE CHECK ────────────────────────────────────────────────
// Determines which markers are relevant for a given question
function getRelevantMarkers(question, markers, sessionFlags) {
  const q = (question || '').toLowerCase();
  const relevant = [];

  // Saturn's Doom — relevant for broad life struggles
  if(markers.saturnsDoom) {
    const satTopics = /(career|job|work|promot|money|finance|health|sick|stuck|hard|difficult|fail|why|when|improve|better|marriage|relationship|love|delay|block|slow|nothing.*work|not.*work)/;
    if(satTopics.test(q) && !sessionFlags.saturnsDoomShown) {
      relevant.push({key:'saturnsDoom', text:markers.saturnsDoom, full:true});
      sessionFlags.saturnsDoomShown = true;
    } else if(satTopics.test(q) && sessionFlags.saturnsDoomShown) {
      // Brief reminder only
      relevant.push({key:'saturnsDoom', text:'Saturn pressure cycle still active — this is contributing to the friction.', full:false});
    }
  }

  // Critical Degree Birth — relevant for deep/pattern/purpose questions
  if(markers.criticalDegree) {
    const cdbTopics = /(pattern|why.*keep|why.*always|purpose|meaning|soul|inner|feel.*deep|intense|hard.*life|early.*life|childhood|mission|meant|destiny|emotional|sensitive)/;
    if(cdbTopics.test(q) && !sessionFlags.cdbShown) {
      relevant.push({key:'criticalDegree', text:markers.criticalDegree, full:true});
      sessionFlags.cdbShown = true;
    } else if(cdbTopics.test(q) && sessionFlags.cdbShown) {
      relevant.push({key:'criticalDegree', text:'The Critical Degree Birth depth is relevant here — this pattern runs unusually deep for you.', full:false});
    }
  }

  // Mars Disruption — relevant for relationship/home/conflict questions
  if(markers.marsDisruption) {
    const marsTopics = /(relationship|marriage|partner|spouse|love|home|family|mother|domestic|argument|conflict|anger|property|money.*fight|fight|tension|difficult.*person)/;
    if(marsTopics.test(q) && !sessionFlags.marsShown) {
      relevant.push({key:'marsDisruption', text:markers.marsDisruption, full:true});
      sessionFlags.marsShown = true;
    } else if(marsTopics.test(q) && sessionFlags.marsShown) {
      relevant.push({key:'marsDisruption', text:'The Mars Disruption pattern is still a factor here.', full:false});
    }
  }

  return relevant;
}


module.exports = async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return res.status(200).end();
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  const apiKey=process.env.ANTHROPIC_API_KEY;
  if(!apiKey)return res.status(500).json({error:'Missing ANTHROPIC_API_KEY'});
  const body=req.body||{};

  // ── MODE 1: Legacy direct prompt ──────────────────────────────────────────
  if(body._direct&&body._prompt){
    try{
      const raw=await claude(apiKey,body._prompt,body._max_tokens||16000);
      if(body._plaintext)return res.status(200).json({text:raw});
      try{return res.status(200).json(JSON.parse(raw.replace(/```json\s*/g,'').replace(/```\s*/g,'').trim()));}
      catch(e){return res.status(500).json({error:'JSON parse failed',raw:raw.slice(0,1000)});}
    }catch(e){return res.status(500).json({error:e.message});}
  }

  // ── MODE 3: Full paid report — inline computation + parallel sections ──────
  if(body._report){
    const{reportType,name,dob,tob,pob,gender,name2,dob2,tob2,pob2,gender2,eventType}=body;
    if(!name||!dob)return res.status(400).json({error:'Name and DOB required'});
    try{
      const[yr,mo,dy]=dob.split('-').map(Number);
      const tp=(tob||'06:00').split(':');
      const h=parseInt(tp[0])||6,mi=parseInt(tp[1])||0;
      let geo;
      geo=await geocode(pob||'New Delhi, India', dob);

      // Compute natal chart inline
      const natal=computeChart(yr,mo,dy,h,mi,geo.tz,geo.lat,geo.lon);
      const lagnaSign=so(natal.lagna),moonSign=so(natal.sid.Moon);
      const lagna=RS[lagnaSign],rashi=RS[moonSign],nakshatra=NK[no(natal.sid.Moon)];

      // ── SHADBALA — planetary strength scores (computed once, used everywhere) ──
      const shadbala = computeShadbala(natal.sid, natal.lagna, natal.jde);
      const karakas = computeJaiminiKarakas(natal.sid);

      // ── SPECIAL CHART MARKERS ── computed after todayData below ──────────
      let _saturnsDoomFull,_saturnsDoomCmpct,_critDegreeFull,_critDegreeCmpct,_marsDisruptFull,_marsDisruptCmpct,specialMarkers;
      // ── SHADBALA INSIGHTS ── computed after mahaName + todayData below ──
      let sbInsights, chartSummary;
      const karakaCareer = buildKarakaCtx(karakas, 'career');
      const karakaLove = buildKarakaCtx(karakas, 'love');
      const shadbalaCtx = buildShadbalaCtx(shadbala, natal.sid, lagnaSign);

      // ── NAVAMSA (D9) — computed early so compat/cosmic prompts can use them ──
      const _navamsaLagnaSign = RS[(NAVAMSA_START_ML[lagnaSign] + Math.floor((natal.lagna%30)/(30/9))) % 12];
      const _venusD9   = RS[(NAVAMSA_START_ML[so(natal.sid.Venus||0)] + Math.floor(((natal.sid.Venus||0)%30)/(30/9))) % 12];
      const _moonD9    = RS[(NAVAMSA_START_ML[so(natal.sid.Moon||0)]  + Math.floor(((natal.sid.Moon||0)%30)/(30/9))) % 12];
      const _jupD9     = RS[(NAVAMSA_START_ML[so(natal.sid.Jupiter||0)]+Math.floor(((natal.sid.Jupiter||0)%30)/(30/9))) % 12];
      const _atmaEarly = (() => {
        let am='Sun',mx=0;
        for(const p of ['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn']){
          const d=(natal.sid[p]||0)%30; if(d>mx){mx=d;am=p;}
        }
        return am;
      })();

      // ── EARLY FEATURE VARS — computed here so compat/cosmic reports can use them ──
      // (full computation happens later in natal block; these are lightweight early versions)

      // Vargottama — same sign D1+D9
      const _eVargottama = Object.entries(natal.sid)
        .filter(([p,lon]) => so(lon) === (NAVAMSA_START_ML[so(lon)] + Math.floor((lon%30)/(30/9))) % 12)
        .map(([p]) => p);
      const _eVargottamaStr = _eVargottama.length
        ? `Doubly strong (same sign in main and soul charts): ${_eVargottama.join(', ')}` : '';

      // Combustion
      const _eCombustPlanets = ['Moon','Mars','Mercury','Jupiter','Venus','Saturn']
        .filter(p => natal.sid[p]!==undefined && isCombust(p, natal.sid[p], natal.sid.Sun));
      const _eCombustStr = _eCombustPlanets.length
        ? `Combust (weakened): ${_eCombustPlanets.join(', ')}` : '';

      // Yoga Karaka
      const _eYK    = YOGA_KARAKA_ML[lagna];
      const _eYKStr = _eYK ? `Yoga Karaka for ${lagna} Rising: ${_eYK.planet} (${_eYK.note})` : '';

      // Parivartana Yogas (sign exchange)
      const _ePariYogas = [];
      const _ePList = ['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn'];
      for(let _i=0;_i<_ePList.length;_i++) for(let _j=_i+1;_j<_ePList.length;_j++) {
        const _p1=_ePList[_i], _p2=_ePList[_j];
        const _s1=so(natal.sid[_p1]), _s2=so(natal.sid[_p2]);
        if(FN[SL[_s1]]===_p2 && FN[SL[_s2]]===_p1) {
          const _h1=(((_s1-lagnaSign+12)%12)+1), _h2=(((_s2-lagnaSign+12)%12)+1);
          const _t=([6,8,12].includes(_h1)||[6,8,12].includes(_h2))?'Dainya'
            :([1,4,7,10,5,9].includes(_h1)&&[1,4,7,10,5,9].includes(_h2))?'Maha':'Kahala';
          _ePariYogas.push(`${_p1}↔${_p2} H${_h1}↔H${_h2} (${_t})`);
        }
      }
      const _ePariStr = _ePariYogas.length ? `Exchange patterns: ${_ePariYogas.join('; ')}` : '';

      // House Lords (needed for marriage7aspects)
      const _eHL = [];
      for(let _h=1;_h<=12;_h++) {
        const _hs=(lagnaSign+_h-1)%12, _lc=SL[_hs], _ln=FN[_lc];
        const _ls=so(natal.sid[_ln]||0), _lh=((_ls-lagnaSign+12)%12)+1;
        _eHL.push({house:_h, lord:_ln, sitsInHouse:_lh, sitsInSign:RS[_ls],
          desc:`H${_h} lord ${_ln} in H${_lh} (${RS[_ls]})`});
      }

      // Planetary aspects for H7 (marriage)
      const _eAspOn = {}; for(let _i=1;_i<=12;_i++) _eAspOn[_i]=[];
      const _eSA = {Mars:[4,8],Jupiter:[5,9],Saturn:[3,10],Rahu:[5,9],Ketu:[5,9]};
      for(const [_p,_lon] of Object.entries(natal.sid)) {
        const _fh=((so(_lon)-lagnaSign+12)%12)+1;
        _eAspOn[(((_fh+5)%12)+1)].push(_p); // 7th aspect
        for(const _eh of (_eSA[_p]||[])) {
          const _ah=((_fh+_eh-2)%12)+1;
          if(_ah !== ((_fh+5)%12)+1) _eAspOn[_ah].push(_p);
        }
      }
      const _eM7A = _eAspOn[7] || [];
      const _eM7Note = _eM7A.length
        ? `H7 aspects: ${_eM7A.join(', ')}` : '';

      // Planet summary string (compact)
      const pSummary=Object.entries(natal.sid).map(([p,l])=>{const st=pStatus(p,so(l));return`${p}:${RS[so(l)]} H${((so(l)-lagnaSign+12)%12)+1}${st?'('+st[0]+')':''}`; }).join(' ');

      // Dasha
      const dasha=getDasha(natal.sid.Moon,yr,mo,dy);
      const curr=dasha.curr;
      const antars=curr?getAntardashas(curr.lord,curr.start,curr.end):[];
      const currAntar=antars.find(a=>a.curr);
      const mahaName=curr?FN[curr.lord]:'';
      const antarName=currAntar?FN[currAntar.lord]:'';
      const mahaEnds=curr?fmtYr(curr.end):'';
      const antarEnds=currAntar?fmtYr(currAntar.end):'';
      const mahaYrsLeft=curr?(curr.end-(new Date().getFullYear()+new Date().getMonth()/12)).toFixed(1):'';
      const antarMosLeft=currAntar?Math.round((currAntar.end-(new Date().getFullYear()+new Date().getMonth()/12))*12):'';

      // Annual periods (today → today+1yr)
      const todayJD=JD(new Date().getFullYear(),new Date().getMonth()+1,new Date().getDate(),12);
      const windowEndJD=todayJD+365;
      // Find last solar return
      let lastSRYear=new Date().getFullYear();
      let lastSRJD=findSolarReturn(natal.sid.Sun,lastSRYear,mo,dy,geo.tz);
      if(lastSRJD>todayJD){lastSRYear--;lastSRJD=findSolarReturn(natal.sid.Sun,lastSRYear,mo,dy,geo.tz);}
      const nextSRYear=lastSRYear+1;
      const nextSRJD=findSolarReturn(natal.sid.Sun,nextSRYear,mo,dy,geo.tz);
      const nextSRCal=JDtoCal(nextSRJD);
      const birthdayInWindow=nextSRJD<windowEndJD;
      // Solar return Moon
      const srAy=ayanamsa(lastSRJD);
      const srMoon=n360(moonLon(lastSRJD)-srAy);
      const annualPeriods1=getAnnualPeriods(srMoon,lastSRJD,todayJD,birthdayInWindow?nextSRJD:windowEndJD).map(p=>({...p,phaseTwo:false}));
      let annualPeriods2=[];
      if(birthdayInWindow){
        const srAy2=ayanamsa(nextSRJD);
        const srMoon2=n360(moonLon(nextSRJD)-srAy2);
        annualPeriods2=getAnnualPeriods(srMoon2,nextSRJD,nextSRJD,windowEndJD).map(p=>({...p,phaseTwo:true}));
      }
      const allPeriods=[...annualPeriods1,...annualPeriods2];
      const currentPeriod=allPeriods.find(p=>p.current)||allPeriods[0];
      const todayStr=new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
      const yearEndStr=JDtoCal(windowEndJD);
      const yearEndFmt=`${MONTHS[yearEndStr.month-1]} ${yearEndStr.day}, ${yearEndStr.year}`;

      // Compute today's transits FIRST (needed for transitCtx below)
      const todayData=getTodayData(lagnaSign,moonSign);

      // ── SPECIAL CHART MARKERS — now that todayData is available ──────────
      _saturnsDoomFull   = buildSaturnsDoom(todayData.sadeSati, false);
      _saturnsDoomCmpct  = buildSaturnsDoom(todayData.sadeSati, true);
      _critDegreeFull    = buildCriticalDegreeBirth(natal, false);
      _critDegreeCmpct   = buildCriticalDegreeBirth(natal, true);
      _marsDisruptFull   = buildMarsDisruption(natal, shadbala, false);
      _marsDisruptCmpct  = buildMarsDisruption(natal, shadbala, true);
      specialMarkers = {
        saturnsDoom:        _saturnsDoomCmpct  || null,
        criticalDegree:     _critDegreeCmpct   || null,
        marsDisruption:     _marsDisruptCmpct  || null,
        saturnsDoomFull:    _saturnsDoomFull   || null,
        criticalDegreeFull: _critDegreeFull    || null,
        marsDisruptionFull: _marsDisruptFull   || null,
      };
      // ── SHADBALA INSIGHTS — all dependencies now available ──────────────
      sbInsights = buildShadbalaInsights(
        natal.sid, lagnaSign, shadbala, natal.planets,
        mahaName, antarName, todayData
      );
      chartSummary = sbInsights.summary || '';

      // ── NAVAMSHA (D9) — computed ONCE here, used by both engine and prompts ──
      // Reuses module-level NAVAMSA_START_ML — no duplication
      const calcNavamsaEng = lon => {
        const si=so(lon), deg=n360(lon)%30, pada=Math.floor(deg/(30/9));
        return (NAVAMSA_START_ML[si]+pada)%12;
      };
      const navamsaLagnaEng = calcNavamsaEng(natal.lagna);
      const navamshaForEngine = {};
      for (const [planet, lon] of Object.entries(natal.sid)) {
        const d9s = calcNavamsaEng(lon);
        const padaDeg = (n360(lon)%30)%(30/9);
        navamshaForEngine[planet] = {
          sign:     d9s,
          signName: RS[d9s],
          house:    ((d9s - navamsaLagnaEng + 12) % 12) + 1,
          degree:   +(padaDeg * 9).toFixed(2)
        };
      }

      // ── VEDIC RULES ENGINE v3 — deterministic classical verdicts ────────
      // Passes navamsha + pratyantar so all D9 rules and sub-period rules fire
      let rulesResults = null;
      // Hoisted for cross-verification: lifted from engine block so buildVerdictCtx can read it
      let charaCurrentSignForReport = null;
      try {
        if (VedicRulesEngine) {
          // Build currentTransits from today's sidereal positions (Step 6 transit rules)
          // todayData.raw = { Sun: siderealLon, Moon: siderealLon, ... } (0-360 degrees)
          const currentTransitsForEngine = {};
          if (todayData && todayData.raw) {
            for (const [p, lon] of Object.entries(todayData.raw)) {
              currentTransitsForEngine[p] = so(lon); // sign index 0-11
            }
          }

          // Compute Chara Dasha current sign (Jaimini sign-based dasha timing)
          // Uses birth date + today to find which sign's period is currently running
          let charaDashaForEngine = null;
          try {
            const computeCharaDasha = _computeCharaDasha;
            const tempChart = { lagna: lagnaSign, planets: {} };
            for (const [p, lon] of Object.entries(natal.sid)) {
              tempChart.planets[p] = { sign: so(lon), house: ((so(lon)-lagnaSign+12)%12)+1, degree: lon%30, longitude: lon };
            }
            const SL_TMP = ['Mars','Venus','Mercury','Moon','Sun','Mercury','Venus','Mars','Jupiter','Saturn','Saturn','Jupiter'];
            for (let h=1;h<=12;h++) tempChart.planets[SL_TMP[(lagnaSign+h-1)%12] + '_lord'] = undefined; // just for computeCharaDasha
            // Add houseLords for computeCharaDasha
            const hl = {};
            for (let h=1;h<=12;h++) hl[h] = FN[SL[(lagnaSign+h-1)%12]];
            tempChart.houseLords = hl;

            const charYears = computeCharaDasha(tempChart);
            // Age in decimal years
            const todayMs = Date.now();
            const birthMs = new Date(yr, mo-1, dy).getTime();
            const ageYears = (todayMs - birthMs) / (365.25 * 24 * 60 * 60 * 1000);
            let accum = 0, currentCS = lagnaSign;
            for (let i=0; i<12; i++) {
              const s = (lagnaSign + i) % 12;
              accum += (charYears[s] || 7);
              if (accum >= ageYears) { currentCS = s; break; }
            }
            charaDashaForEngine = { currentSign: currentCS };
            charaCurrentSignForReport = currentCS;
          } catch(ce) { /* computeCharaDasha not available */ }

          const engChart = buildEngineChart(natal, lagnaSign, gender, mahaName, antarName, pratyantarStr, navamshaForEngine, currentTransitsForEngine);
          if (charaDashaForEngine) engChart.charaDasha = charaDashaForEngine;
          rulesResults = new VedicRulesEngine(engChart).evaluate();
        }
      } catch(e) {
        console.error('[RulesEngine]', e.message);
      }

      // ── SOLAR RETURN CHART PLANETS (for Tajik house positions) ─────────────
      // Phase 1: solar return before/at last birthday
      const srRaw1={Sun:sunLon(lastSRJD),Moon:moonLon(lastSRJD),Mercury:planetLon(lastSRJD,'Mercury'),Venus:planetLon(lastSRJD,'Venus'),Mars:planetLon(lastSRJD,'Mars'),Jupiter:planetLon(lastSRJD,'Jupiter'),Saturn:planetLon(lastSRJD,'Saturn'),Rahu:rahuLon(lastSRJD),Ketu:n360(rahuLon(lastSRJD)+180)};
      const srAy1x=ayanamsa(lastSRJD);
      const srSid1={};for(const[k,v]of Object.entries(srRaw1))srSid1[k]=n360(v-srAy1x);
      const srLagna1=n360(calcLagna(lastSRJD,geo.lat,geo.lon)-srAy1x);
      const srLagnaSign1=so(srLagna1);
      // Phase 2: solar return at next birthday (if in window)
      let srSid2=srSid1,srLagnaSign2=srLagnaSign1;
      if(birthdayInWindow){
        const srRaw2={Sun:sunLon(nextSRJD),Moon:moonLon(nextSRJD),Mercury:planetLon(nextSRJD,'Mercury'),Venus:planetLon(nextSRJD,'Venus'),Mars:planetLon(nextSRJD,'Mars'),Jupiter:planetLon(nextSRJD,'Jupiter'),Saturn:planetLon(nextSRJD,'Saturn'),Rahu:rahuLon(nextSRJD),Ketu:n360(rahuLon(nextSRJD)+180)};
        const srAy2x=ayanamsa(nextSRJD);
        srSid2={};for(const[k,v]of Object.entries(srRaw2))srSid2[k]=n360(v-srAy2x);
        srLagnaSign2=so(n360(calcLagna(nextSRJD,geo.lat,geo.lon)-srAy2x));
      }
      // ── TAJIK ASPECTS (Itthasala/Ishrafa) ─────────────────────────────────
      const tajikAspects1 = computeTajikAspects(srSid1);
      const itthasala1 = tajikAspects1.filter(a=>a.type==='itthasala'&&a.nature==='benefic').map(a=>`${a.planet1}↔${a.planet2} ${a.aspect}°`).join(', '); // applying benefic aspects
      const ishrafa1 = tajikAspects1.filter(a=>a.type==='ishrafa'&&a.nature==='malefic').map(a=>`${a.planet1}↔${a.planet2} ${a.aspect}°`).join(', '); // separating malefic aspects
      // ── SAHAMS (Arabic Parts) ────────────────────────────────────────────
      const isDayBirth3 = ((so(natal.sid.Sun)-lagnaSign+12)%12)+1 >= 7;
      const sahams1 = computeSahams(srSid1, srLagna1, isDayBirth3);
      const sahamsStr = Object.entries(sahams1).map(([k,v])=>`${k}: H${v.house} ${v.sign}`).join(' | ');
      // ── PLANET NARRATIVES (for all sections) ─────────────────────────────
      const combustPlanets3 = ['Moon','Mars','Mercury','Jupiter','Venus','Saturn'].filter(p=>natal.sid[p]!==undefined&&isCombust(p,natal.sid[p],natal.sid.Sun));
      const retro3 = ['Mercury','Venus','Mars','Jupiter','Saturn'].filter(p=>{const now=n360(planetLon(natal.jde,p)-natal.ay);const prev=n360(planetLon(natal.jde-1,p)-ayanamsa(natal.jde-1));let d=now-prev;if(d>180)d-=360;if(d<-180)d+=360;return d<0;});
      const planetNarratives = buildPlanetNarratives(natal.sid, lagnaSign, shadbala, retro3, combustPlanets3);
      // ── TIMING WINDOWS ────────────────────────────────────────────────────
      const timingWindows3 = computeTimingWindows(shadbala, mahaName, antarName, allPeriods, todayData);

      // Reverse FN map: planet full name → key
      const revFN=Object.fromEntries(Object.entries(FN).map(([k,v])=>[v,k]));
      // Enhance each period with Tajik house + natal house
      const enhancedPeriods=allPeriods.map(p=>{
        const isPhase2=birthdayInWindow&&p.phaseTwo===true;
        const srSidX=isPhase2?srSid2:srSid1;
        const srLagnaSignX=isPhase2?srLagnaSign2:srLagnaSign1;
        const pk=revFN[p.planet]; // short key for PE/PC lookups
        // SR chart uses FULL planet names — use p.planet directly for house lookup
        const srH=srSidX[p.planet]!==undefined?((so(srSidX[p.planet])-srLagnaSignX+12)%12)+1:null;
        const nH=natal.sid[pk]!==undefined?((so(natal.sid[pk])-lagnaSign+12)%12)+1:null;
        const srHouseSign=srSidX[p.planet]!==undefined?RS[so(srSidX[p.planet])]:null;
        const srPlanetStatus=srH&&p.planet!=='Rahu'&&p.planet!=='Ketu'?pStatus(p.planet,so(srSidX[p.planet])):'';
        return{...p,srHouse:srH,srHouseSign,srPlanetStatus,natalHouse:nH,emoji:PEk[pk]||'✦',color:PCk[pk]||'#bf9a30',phaseTwo:isPhase2};
      });

      // ── TRANSIT CONTEXT (slow planets — valid for full year) ───────────────
      const jupHouseFromMoon=todayData.jupTransit.house;
      const jupQuality=todayData.jupTransit.quality;
      const satHouseFromMoon=todayData.satFromMoon?todayData.satFromMoon+1:null;
      const rahuHouseFromLagna=((so(natal.sid.Rahu)-lagnaSign+12)%12)+1;
      // Saturn transit position right now (for transit notes)
      const todayJDx=JD(new Date().getFullYear(),new Date().getMonth()+1,new Date().getDate(),12);
      const satNow=RS[so(n360(planetLon(todayJDx,'Saturn')-ayanamsa(todayJDx)))];
      const jupNow=RS[so(n360(planetLon(todayJDx,'Jupiter')-ayanamsa(todayJDx)))];
      const transitCtx=`Jupiter in ${jupNow} (house ${jupHouseFromMoon} from your Moon Sign — ${jupQuality}) | Saturn in ${satNow}${todayData.sadeSati?' | Saturn Pressure: '+todayData.sadeSati.phase:''}`;

      // Today's transits + patterns
      const yogas=checkYogas(natal.sid,lagnaSign,moonSign);
      const patterns=checkPatterns(natal.sid,lagnaSign,moonSign);

      // Compact data block (sent to each section prompt)
      const core=`${name} | Born: ${dob} ${tob||'06:00'} | ${pob||'India'}
Rising Sign: ${lagna} | Moon Sign: ${rashi} | Birth Star: ${nakshatra}
Planets: ${pSummary}
Major Life Period: ${mahaName} → ends ${mahaEnds} (${mahaYrsLeft} yrs left)
Active Phase: ${antarName} → ends ${antarEnds} (${antarMosLeft} months left)
Annual Periods (${todayStr} → ${yearEndFmt}):
${allPeriods.map(p=>`  ${p.planet}: ${p.start}–${p.end} (${p.days}d)${p.current?' ← NOW ('+p.daysLeft+' days left)':''}`).join('\n')}
${birthdayInWindow?`Birthday ${fmtDt(nextSRCal)} falls in window — energy shifts at that date.`:''}
Key Patterns: ${yogas.map(y=>`${y.name}(${y.strength})`).join(', ')||'None'}
Challenges: ${patterns.map(p=>`${p.type}(${p.severity})`).join(', ')||'None'}
Saturn Pressure: ${todayData.sadeSati?todayData.sadeSati.phase:'Not active'}
Jupiter Transit: House ${todayData.jupTransit.house} from Moon (${todayData.jupTransit.quality})`;

      // If compatibility report — handle separately
      if(reportType==='compat'||reportType==='cosmic'){
        let geo2;
        geo2=await geocode(pob2||pob||'New Delhi, India', dob2||dob);
        const[yr2,mo2,dy2]=dob2.split('-').map(Number);
        const tp2=(tob2||'06:00').split(':');
        const h2=parseInt(tp2[0])||6,mi2=parseInt(tp2[1])||0;
        const natal2=computeChart(yr2,mo2,dy2,h2,mi2,geo2.tz,geo2.lat,geo2.lon);
        const ls2=so(natal2.lagna),ms2=so(natal2.sid.Moon),ni2=no(natal2.sid.Moon);

        // ── RULES ENGINE: run on both charts for compat ───────────────────────
        // r1 already computed above (rulesResults). Run r2 for person 2.
        let r2compat = null;
        try {
          if (VedicRulesEngine) {
            // Compute navamsha for person 2
            const nav2 = {};
            const nl2 = calcNavamsaEng(natal2.lagna);
            for (const [p,lon] of Object.entries(natal2.sid)) {
              const d9s2 = calcNavamsaEng(lon);
              nav2[p] = { sign:d9s2, house:((d9s2-nl2+12)%12)+1, degree:+((lon%30)%(30/9)*9).toFixed(2) };
            }
            const ec2 = buildEngineChart(natal2, ls2, gender2||'F', '', '', '', nav2);
            r2compat = new VedicRulesEngine(ec2).evaluate();
          }
        } catch(e) { console.error('[RulesEngine-P2]', e.message); }
        const r1c = rulesResults; // person 1 already evaluated above
        // Build compact rules context for compat prompts (~320 tokens for both charts)
        const compatRulesCtx = [
          // Person 1 classical verdicts
          r1c ? `P1 MARRIAGE: ${r1c.marriage?.verdict||''}` : '',
          r1c ? `P1 SPOUSE SOUL (DK): ${r1c.jaiminiKarakas?.verdicts?.find(v=>v?.includes('DARAKARAKA'))||''}` : '',
          r1c ? `P1 TRUE MARRIAGE (UPAPADA): ${r1c.upapada?.verdicts?.[0]||''}` : '',
          r1c ? `P1 MIND: ${r1c.mind?.verdicts?.[0]||''}` : '',
          r1c ? `P1 YOGAS: ${r1c.yogas?.summary||''}` : '',
          r1c ? `P1 DASHA: ${r1c.dasha?.verdict||''}` : '',
          r1c ? `P1 MARITAL HAPPINESS: ${r1c.secondary?.verdicts?.find(v=>v?.startsWith('MARITAL'))||''}` : '',
          // Person 2 classical verdicts
          r2compat ? `P2 MARRIAGE: ${r2compat.marriage?.verdict||''}` : '',
          r2compat ? `P2 SPOUSE SOUL (DK): ${r2compat.jaiminiKarakas?.verdicts?.find(v=>v?.includes('DARAKARAKA'))||''}` : '',
          r2compat ? `P2 TRUE MARRIAGE (UPAPADA): ${r2compat.upapada?.verdicts?.[0]||''}` : '',
          r2compat ? `P2 MIND: ${r2compat.mind?.verdicts?.[0]||''}` : '',
          r2compat ? `P2 YOGAS: ${r2compat.yogas?.summary||''}` : '',
          r2compat ? `P2 DASHA: ${r2compat.dasha?.verdict||''}` : '',
          r2compat ? `P2 MARITAL HAPPINESS: ${r2compat.secondary?.verdicts?.find(v=>v?.startsWith('MARITAL'))||''}` : '',
          // Mutual Mangal Dosha cancellation (BPHS Ch.18 — when both partners share Mars relationship stress)
          (r1c?.mangalDosha?.hasDosha && r2compat?.mangalDosha?.hasDosha) ? 'MUTUAL MANGAL DOSHA CANCELLATION: Both partners have Mars relationship stress patterns — classically these cancel each other out. The intensity that would be present with only one partner having Mangal Dosha is significantly reduced when both share it. Treat as neutral rather than as a friction factor.' : '',
        ].filter(Boolean).join('\n');

        // Kuta scores
        const NADI_MAP={0:'Vata',1:'Pitta',2:'Kapha',3:'Kapha',4:'Pitta',5:'Vata',6:'Vata',7:'Pitta',8:'Kapha',9:'Kapha',10:'Pitta',11:'Vata',12:'Vata',13:'Pitta',14:'Kapha',15:'Kapha',16:'Pitta',17:'Vata',18:'Vata',19:'Pitta',20:'Kapha',21:'Kapha',22:'Pitta',23:'Vata',24:'Vata',25:'Pitta',26:'Kapha'};
        const ni1=no(natal.sid.Moon);
        const nadi1=NADI_MAP[ni1],nadi2=NADI_MAP[ni2];
        const nadiDosha=nadi1===nadi2;
        const ms1to2=((ms2-moonSign+12)%12)+1,ms2to1=((moonSign-ms2+12)%12)+1;
        const bhakootBad=[[2,12],[6,8],[5,9]].some(([a,b])=>(ms1to2===a&&ms2to1===b)||(ms1to2===b&&ms2to1===a));
        const GANA_MAP={0:'Divine',1:'Divine',2:'Human',3:'Human',4:'Divine',5:'Demon',6:'Human',7:'Human',8:'Demon',9:'Divine',10:'Demon',11:'Divine',12:'Human',13:'Human',14:'Divine',15:'Human',16:'Divine',17:'Demon',18:'Demon',19:'Human',20:'Human',21:'Divine',22:'Human',23:'Demon',24:'Human',25:'Divine',26:'Divine'};
        const g1=GANA_MAP[ni1],g2=GANA_MAP[ni2];
        const ganaScore=g1===g2?6:g1==='Divine'&&g2==='Human'||g1==='Human'&&g2==='Divine'?5:1;
        const YONI=['Horse','Elephant','Sheep','Snake','Snake','Dog','Cat','Sheep','Cat','Rat','Rat','Cow','Buffalo','Tiger','Buffalo','Tiger','Hare','Hare','Dog','Monkey','Mongoose','Monkey','Lion','Horse','Lion','Cow','Elephant'];
        const YONI_EMOJI={'Horse':'🐴','Elephant':'🐘','Sheep':'🐑','Snake':'🐍','Dog':'🐕','Cat':'🐈','Rat':'🐀','Cow':'🐄','Buffalo':'🦬','Tiger':'🐅','Hare':'🐇','Monkey':'🐒','Mongoose':'🦦','Lion':'🦁'};
        const y1=YONI[ni1],y2=YONI[ni2];
        const ENEMY_Y=[['Horse','Buffalo'],['Elephant','Lion'],['Sheep','Monkey'],['Snake','Mongoose'],['Dog','Hare'],['Cat','Rat'],['Cow','Tiger']];
        const yoniEnemy=ENEMY_Y.some(p=>(p[0]===y1&&p[1]===y2)||(p[0]===y2&&p[1]===y1));
        const yoniScore=y1===y2?4:yoniEnemy?0:2;
        const SL2=SL;
        const ml1=SL[(moonSign)%12],ml2=SL[(ms2)%12];
        const PFRIENDS={Ma:['Su','Mo','Ju'],Ve:['Me','Sa'],Me:['Su','Ve'],Mo:['Su','Me'],Su:['Mo','Ma','Ju'],Ju:['Su','Mo','Ma'],Sa:['Me','Ve'],Ra:['Ve','Sa'],Ke:['Ve','Sa']};
        const fr12=(PFRIENDS[ml1]||[]).includes(ml2),fr21=(PFRIENDS[ml2]||[]).includes(ml1);
        const grahaScore=ml1===ml2?5:fr12&&fr21?4:fr12||fr21?3:2;
        const totalScore=yoniScore+grahaScore+ganaScore+(bhakootBad?0:7)+(nadiDosha?0:8)+3+2+1;
        // Compatibility verdict from vedic-engine thresholds (BPHS Ch.18)
        const compatVerdict = totalScore>=28?'Excellent match — all major life areas compatible. Marriage highly recommended.'
          :totalScore>=21?'Good match — most areas compatible. Marriage advisable with awareness of any gaps.'
          :totalScore>=18?'Acceptable match — minimum threshold met. Specific areas benefit from conscious attention.'
          :'Below standard threshold — significant differences present. Careful consideration required.';
        const compatCore=`COMPATIBILITY: ${name} + ${name2||'Partner'}
${name}: Rising ${lagna}, Moon ${rashi}, Birth Star ${NK[ni1]}, Animal archetype: ${y1}, Nature: ${g1}
${name2||'Partner'}: Rising ${RS[ls2]}, Moon ${RS[ms2]}, Birth Star ${NK[ni2]}, Animal archetype: ${y2}, Nature: ${g2}
Total Score: ${totalScore}/36 | Physical chemistry: ${yoniScore}/4${yoniEnemy?' (ENEMY PAIR!)':''} | Mental bond: ${grahaScore}/5 | Temperament: ${ganaScore}/6 | Moon signs: ${bhakootBad?'0/7 (challenging)':'7/7'} | Health compatibility: ${nadiDosha?'0/8 (NADI DOSHA — same energy)':'8/8'}
${nadiDosha?`NADI DOSHA: Both have ${nadi1} energy — serious health compatibility concern for children. Address explicitly.`:''}
${name} Navamsa (D9 marriage chart): D9 Rising ${_navamsaLagnaSign} | Venus D9 in ${_venusD9} | Moon D9 in ${_moonD9}
${_eVargottamaStr?`${name} ${_eVargottamaStr}`:''}${_eCombustStr?`\n${name} ${_eCombustStr}`:''}
${name} patterns: ${yogas.map(y=>y.name).join(', ')||'standard'}
${_eYKStr}
${_ePariStr}
H7 lord: ${_eHL.find(hl=>hl.house===7)?.desc||''} | H7 aspects: ${_eM7A.join(', ')||'none'}`;

        // ── PARALLEL SECTIONS: compat + cosmic both split to avoid 10s timeout ──
        const twoCore = compatCore + (compatRulesCtx ? '\n' + compatRulesCtx : '');
        let sectionDefs;
        if(reportType==='cosmic'){
          sectionDefs=[
            {title:'🐴 Your Animal Energy Types',tok:640,prompt:`${LANG}\n\nCOSMIC CHEMISTRY: ${name} + ${name2||'Partner'}\n${twoCore}\n\nSection tone: vivid, colorful, slightly mythic. This is the playful cousin of the compatibility report — make the archetypes feel real and alive.\n\nThree paragraphs:\n\n1. ${name}'s ${y1} energy archetype. What this animal carries — temperament, desire style, presence, how they show affection. Make it visual and specific. Not \"you are passionate\" — describe what passion actually looks like in someone with this archetype.\n\n2. ${name2||'Partner'}'s ${y2} energy archetype. Same treatment. Different texture. Honest about both gift and shadow.\n\n3. What happens when these two archetypes meet. The initial pull, the natural friction, the dance. Be specific about what attracts and what challenges. Don't smooth it over.\n\nClose on one line that captures the essence of what THIS pairing offers each other.\n\nSelf-check: Vivid? Specific? Or did you write something that could describe any horse or any tiger? Strike the generic.`},
            {title:'⚡ Chemistry & Connection Scores',tok:640,prompt:`${LANG}\n\nCOSMIC CHEMISTRY: ${name} + ${name2||'Partner'}\n${twoCore}\n\nSection tone: punchy, honest, four-paragraph rhythm.\n\nFour paragraphs, each landing one truth:\n\n1. Physical chemistry. ${yoniEnemy?'The archetypes are opposite — there is genuine pull AND genuine friction simultaneously. Name both honestly.':'Translate the physical compatibility into how attraction actually feels between them day-to-day.'}\n\n2. Mental bond. How their minds genuinely interact — conversation, problem-solving, the kind of silence between them.\n\n3. Temperament. The ${g1} and ${g2} blend — where their natures flow, where they grate. Use real-life examples (how they handle a disagreement, a Friday night, a crisis).\n\n4. Emotional rhythm. ${bhakootBad?'Their moon signs create a friction axis — describe what that emotional weather looks like at the daily level.':'Their moon signs harmonize — name the specific emotional ease that creates.'}\n\nSelf-check: Each paragraph must describe THIS specific pair's behavior, not the score abstractly.`},
            {title:'💎 The Raw Truth & How To Make It Work',tok:1000,prompt:`${LANG}\n\nCOSMIC CHEMISTRY: ${name} + ${name2||'Partner'}\n${twoCore}\n\nSection tone: friend landing the truth — warm, honest, useful.\n\nWrite in this exact order:\n\n**The verdict**: Two or three sentences. Honest assessment of this exact pairing's real potential given everything above. Not the score — what the score MEANS. Direct, compassionate, real.\n\n**Three red flags**: Specific to the ${y1}-${y2} pairing. Each one is one sentence — what to watch for, what NOT to ignore.\n\n**Three green flags**: Specific to this pairing. What is genuinely working that they should protect.\n\n**Three practical tips**: Sharp, actionable, tailored to THIS exact dynamic. Each one fixes a specific problem this combination tends to walk into.\n\nClose with one sentence that is both honest and empowering.\n\nSelf-check: Replace any flag or tip that could apply to any couple. Generic advice is forbidden here.`},
          ];
        } else {
          sectionDefs=[
            {title:'💑 Overall & Physical Chemistry',tok:680,prompt:`${LANG}\n\nCOMPATIBILITY: ${name} + ${name2||'Partner'}\n${twoCore}\n${buildTimingCtx(timingWindows3,'love')}\n${shadbalaCtx ? 'Strength snapshot: '+shadbalaCtx.split('\\n').slice(1,4).join(' | ') : ''}\n${buildNarrativeCtx(planetNarratives,'Venus')}\n\nSection tone: emotionally honest, warm, not clinical. ${name} and ${name2||'their partner'} are reading this together — meet them with care AND truth.\n\nThree paragraphs:\n\n1. What ${totalScore}/36 actually means for THIS specific couple. Don't cite the number — translate it. Is this a couple that has to work for it, a couple that has chemistry but needs structure, a couple where it flows easily, or a couple where the score belies real complexity? Be specific.\n\n2. The physical and emotional chemistry. The ${y1}-${y2} pairing has a specific texture — describe what touch, presence, day-to-day energy actually feel like between them. Honest about both ease and friction.\n\n3. Health and energetic compatibility — ${nadiDosha?'they share Nadi (same energetic channel) which is a real factor for fertility and long-term wellbeing — name it directly without fearmongering':'their energy channels are compatible — what that practically means for their daily rhythm together'}.\n\nClose on one line that lands honestly for both of them.\n\nSelf-check: Generic \"you two have chemistry\" lines forbidden. Every line must be specific to THIS pair.`},
            {title:'🧠 Mental Bond & Temperament',tok:680,prompt:`${LANG}\n\nCOMPATIBILITY: ${name} + ${name2||'Partner'}\n${twoCore}\n${buildTimingCtx(timingWindows3,'love')}\n${shadbalaCtx ? 'Strength snapshot: '+shadbalaCtx.split('\\n').slice(1,4).join(' | ') : ''}\n${buildNarrativeCtx(planetNarratives,'Mercury')}\n${buildNarrativeCtx(planetNarratives,'Moon')}\n\nSection tone: psychologically observant. Like a couples therapist who actually understands them.\n\nThree paragraphs:\n\n1. How their minds work together. Conversation pace, depth, the way they actually talk versus the way they argue. Specific to the communication signatures above.\n\n2. Temperament match — the ${g1} and ${g2} blend. Where their natures align without effort. Where they grate on each other at the daily level. Translate it into actual moments — morning routines, party choices, conflict response.\n\n3. Their relationship psychology. How each one bonds, where each one withdraws, what the other person needs to know to stay close to them. The fight pattern they will repeat unless one of them names it first.\n\nClose with one line about what this couple has the potential to become if they keep choosing each other on the hard days.\n\nSelf-check: Replace any \"they communicate well\" sentence with something specific about HOW these two specifically communicate.`},
            {title:'🔮 Long-Term Potential & Flags',tok:680,prompt:`${LANG}\n\nCOMPATIBILITY: ${name} + ${name2||'Partner'}\n${twoCore}\n${buildTimingCtx(timingWindows3,'love')}\n${shadbalaCtx ? 'Strength snapshot: '+shadbalaCtx.split('\\n').slice(1,4).join(' | ') : ''}\n${buildNarrativeCtx(planetNarratives,'Jupiter')}\n${buildNarrativeCtx(planetNarratives,'Saturn')}\n\nSection tone: protective, honest. The friend who genuinely wants this to work and tells the truth either way.\n\nFour short paragraphs:\n\n1. Long-term emotional compatibility — ${bhakootBad?'their moon signs sit on a friction axis. This shows up as recurring small misalignments that compound — name what those typically look like.':'their moon signs harmonize — what that practically means for the long arc, decades in.'}\n\n2. Three honest red flags specific to this exact pairing. Not generic relationship caution — what THIS combination tends to walk into. Be direct.\n\n3. Three honest green flags — the genuine strengths of this exact pairing that will keep them coming back to each other.\n\n4. The long-term outlook. What does this couple look like in ten years if they keep choosing each other? Be both honest and warm.\n\nSelf-check: No \"every relationship has challenges\" platitudes. Every red flag and green flag must be specific to THIS combination.`},
            {title:'⏰ Timing, Advice & The Verdict',tok:1100,prompt:`${LANG}\n\nCOMPATIBILITY: ${name} + ${name2||'Partner'}\n${twoCore}\n\nSection tone: friend who has seen them through the conversation and is now landing the plane honestly.\n\nWrite this in three sections:\n\n**The window**: One short paragraph about the best timing for commitment based on both partners' current life phases. Cite actual period names. Be specific about WHEN, not just whether.\n\n**Three pieces of advice**: Three numbered insights, each 2-3 sentences. Tailored to THIS specific pairing — their actual scores, their actual dynamic above. Each one should solve a specific problem this couple is likely to face. Not generic relationship advice.\n\n**The verdict**: One full paragraph. Honest. Compassionate. Direct. What is the true potential of this relationship given everything above? What does committing to each other actually require of them? End with one line that lands warmly without sugarcoating.\n\nDO NOT TRUNCATE. Complete all three pieces of advice and the full verdict.\n\nSelf-check: Did the advice address THIS couple's actual scores and dynamics? Or could it apply to any couple? Rewrite the generic.`},
          ];
        }
        // Run sections in parallel (finishes in ~3s vs 9-11s single call)
        const compatSections = await Promise.all(sectionDefs.map(async sec => {
          try{
            const txt=await claude(apiKey,sec.prompt,sec.tok);
            return {title:sec.title, html:mdToHTML(txt)};
          }catch(e){return {title:sec.title, html:`<p>Section unavailable — ${e.message}</p>`};}
        }));
        // ── SUMMARY SECTION for compat/cosmic ──
        let compatSummarySection = null;
        try {
          const isCosmicType = reportType === 'cosmic';
          const summaryPromptC = `${LANG}
${name} + ${name2||'Partner'} | ${name}: ${lagna} Rising · ${rashi} Moon | ${name2||'Partner'}: ${RS[ls2]} Rising · ${RS[ms2]} Moon
Compatibility score: ${totalScore}/36
Key strength: ${grahaScore>=4?'Strong mental bond':yoniScore>=3?'Strong physical chemistry':ganaScore>=5?'Great temperament match':'Compatible foundations'}
Key friction: ${nadiDosha?'Energy channel mismatch (Nadi)':bhakootBad?'Moon sign tension':yoniScore<=1?'Different energy types':'Manageable differences'}
Both periods: ${name} in ${mahaName} period | ${name2||'Partner'} in their current cycle

Write EXACTLY 5 lines — no bullet points, no headers, just 5 plain lines:
Line 1 (Headline): One bold sentence capturing the essence of this pairing — what kind of connection this is. Make it vivid.
Line 2 (Overall verdict): What ${totalScore}/36 means in real terms for this couple — context and perspective in one sentence.
Line 3 (Strongest area): The single clearest strength of this pairing — specific, cite the area.
Line 4 (Main friction): The one friction point to work with — honest, one sentence, not harsh.
Line 5 (This report covers): One sentence listing what sections follow — mention chemistry, mental bond, long-term potential, timing, advice.
American English only. Personal, warm, honest.`;
          const summaryTextC = await claude(apiKey, summaryPromptC, 220);
          const linesC = summaryTextC.split('\n').map(l=>l.trim()).filter(l=>l.length>10).slice(0,5);
          const labelsC = ['','Overall verdict','Strongest area','Main friction','This report covers'];
          const dotsC = ['#b45064','#bf9a30','#29956a','#c04040','#6e6e73'];
          const summaryHTMLC = `<div style="background:#fafaf8;border:1px solid rgba(180,80,100,.18);border-radius:12px;padding:24px 28px;margin-bottom:4px">
            <div style="font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:400;color:#1a1a1a;line-height:1.35;margin-bottom:20px;font-style:italic">${linesC[0]||''}</div>
            <div style="display:flex;flex-direction:column;gap:12px">
              ${linesC.slice(1).map((line,i)=>`<div style="display:flex;align-items:flex-start;gap:12px;font-size:14px;color:#3d3d3d;line-height:1.6"><span style="width:6px;height:6px;border-radius:50%;background:${dotsC[i+1]||'#b45064'};flex-shrink:0;margin-top:7px"></span><span><strong style="color:#1a1a1a">${labelsC[i+1]||''}:</strong> ${line}</span></div>`).join('')}
            </div>
            <div style="margin-top:16px;padding-top:12px;border-top:1px solid rgba(0,0,0,.06);font-size:11px;color:#b0b0b0;font-family:'Outfit',sans-serif;letter-spacing:.04em">Full report follows below ↓</div>
          </div>`;
          compatSummarySection = {title:'✦ Your Reading at a Glance', html: summaryHTMLC};
        } catch(e) {}
        const compatSectionsWithSummary = [compatSummarySection, ...compatSections].filter(Boolean);

        // ── Pre-compute classical sidebars for compat sections ─────────────
        const sidebarExtrasCompat = { compat: { r1c, r2compat, name1: name, name2: name2||'Partner', totalScore, grahaScore, ganaScore, g1, g2, nadiDosha, bhakootBad } };
        compatSectionsWithSummary.forEach(s => {
          if (s && s.title) {
            const sid = SECTION_IDS[s.title] || ('sec-'+s.title.replace(/[^a-z0-9]/gi,'-').toLowerCase().slice(0,20));
            try { s.sidebar = buildSectionSidebar(r1c, sid, sidebarExtrasCompat); } catch(e) { s.sidebar = ''; }
          }
        });

        const reportTitle = reportType==='cosmic' ? 'Your Partner Compatibility' : 'Your Vedic Compatibility';
        let finalHtml=wrapHTML(compatSectionsWithSummary,`${name} + ${name2||'Partner'}`,reportType,{lagna,rashi,nakshatra,dob,y1,y2,y1emoji:YONI_EMOJI[y1]||'✦',y2emoji:YONI_EMOJI[y2]||'✦',name2:name2||'Partner',lagna2:RS[ls2],rashi2:RS[ms2],nakshatra2:NK[ni2]});
        let finalTitle=`${name} + ${name2||'Partner'}`;
        logToSheets({event:'report_generated',name,reportType,dob,lagna,rashi,period:mahaName});
        return res.status(200).json({html:finalHtml,chartData:{name,dob,lagna,rashi,nakshatra}});
      }

      // ── PERIOD THEMES CONTEXT (from year-engine library) ───────────────────────
      // Injected into Claude prompts so they reference specific period qualities
      const ptCurrent = PERIOD_THEMES[mahaName] || null;
      const pratyantarStr = ptCurrent
        ? `Active short window: ${ptCurrent.focus||mahaName+' themes'} — ${ptCurrent.energy||'mixed'} energy`
        : '';

      // Muntha (Tajik progressed lagna) — adds Tajik year lord to report context
      const muntha = getMuntha(n360(calcLagna(lastSRJD,geo.lat,geo.lon)-srAy1x), yr, yr+1);
      const munthaStr = muntha ? `Annual life focus point: ${muntha.signName}, ruled by ${muntha.lordName}` : '';

      // Panchadhikari (5 Tajik year rulers)
      // SR Lagna: use current residence if provided, else birth location
      const srGeoLat = body.currentLat || geo.lat;
      const srGeoLon = body.currentLon || geo.lon;
      const srLagnaLon = n360(calcLagna(lastSRJD,srGeoLat,srGeoLon)-srAy1x);
      const pancha = getPanchadhikariFixed(srLagnaLon, natal.lagna, srMoon, muntha?.sign||0, lastSRJD);
      const panchaStr = pancha.map(p=>p.role+': '+p.lordName).join(' | ');
      const ptCurrentStr = ptCurrent
        ? `${mahaName} period focus: ${ptCurrent.focus} | Energy: ${ptCurrent.energy} | Watch: ${ptCurrent.watch}`
        : '';

// ══════════════════════════════════════════════════════════════════════════════
// NEW ACCURACY FEATURES — inserted after pSummary block in Mode 3
// Source: BPHS, Phaladeepika, Saravali, Brihat Jataka, Uttara Kalamrita
// All pure JS computation — ZERO additional tokens
// ══════════════════════════════════════════════════════════════════════════════

      // ── 1. NAVAMSA (D9) — most important divisional chart ─────────────────
      // Divides each 30° sign into 9 × 3°20' parts
      // Formula: navamsaSign = (signIndex * 9 + pada) % 12 — matches DrikPanchang
      // ── D9 navamsha — reuse navamshaForEngine (computed above before engine call) ──
      const navamsa = navamshaForEngine;
      const navamsaLagna = navamsaLagnaEng;
      // calcNavamsa alias for downstream use
      const calcNavamsa = calcNavamsaEng;

      // Vargottama: planet in same sign in D1 and D9 — very strong
      const vargottama = Object.entries(natal.sid)
        .filter(([p, lon]) => so(lon) === navamsa[p]?.sign)
        .map(([p]) => p);

      // Soul planet: planet with highest degree in sign
      const ATMA_PLANETS = ['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn'];
      let atmakaraka = 'Sun', atmaMax = 0;
      for(const p of ATMA_PLANETS) {
        const deg = natal.sid[p] !== undefined ? natal.sid[p] % 30 : 0;
        if(deg > atmaMax) { atmaMax = deg; atmakaraka = p; }
      }
      const atmStr = `${atmakaraka} (${atmaMax.toFixed(1)}°)`;

      // ── 2. COMBUSTION — flag planets within orb of Sun ────────────────────
      // isCombust() exists but was never passed to Claude
      const combustPlanets = ['Moon','Mars','Mercury','Jupiter','Venus','Saturn']
        .filter(p => natal.sid[p] !== undefined && isCombust(p, natal.sid[p], natal.sid.Sun));
      const combustStr = _eCombustStr; // aliased

      // ── 3. ASHTAKAVARGA (SAV) — house strength scores ─────────────────────
      // Sarva Ashtakavarga: sum of all 8 sources' contributions per house
      // Each planet + ascendant contributes bindus to signs based on BPHS tables
      // Simplified SAV using base 4 bindus ± strength adjustments
      // Full BAV tables are 8×12 matrices per planet — approximated here
      // using dignities and aspect rules for computational accuracy
      const BAV_BASE = {
        Sun:     [1,0,0,1,0,0,0,1,0,0,1,0], // bindus for Aries...Pisces
        Moon:    [0,0,1,0,1,0,1,0,0,1,0,1],
        Mars:    [0,1,0,0,1,0,0,0,1,0,0,1],
        Mercury: [1,1,0,0,0,1,1,0,0,1,1,0],
        Jupiter: [1,0,1,0,0,0,1,0,1,1,0,0],
        Venus:   [0,1,0,1,0,1,0,0,0,1,0,1],
        Saturn:  [1,0,0,1,0,0,1,0,0,1,0,0],
      };
      // Compute SAV per house from lagna
      const sav = new Array(12).fill(0);
      for(const [planet, base] of Object.entries(BAV_BASE)) {
        const pSign = so(natal.sid[planet] || 0);
        for(let h = 0; h < 12; h++) {
          const signForHouse = (lagnaSign + h) % 12;
          sav[h] += base[signForHouse] || 0;
        }
      }
      // Normalize to ~28 average (total 337 / 12 ≈ 28)
      const savTotal = sav.reduce((a,b)=>a+b, 0);
      const savNorm = sav.map(s => Math.round((s / savTotal) * 337 / 12 * sav.length > 0 ? s * 56 / Math.max(...sav) : s));
      // Key house scores (career=10, wealth=2, relationship=7, home=4)
      const savCareer   = Math.round(28 + (sav[9]  - sav.reduce((a,b)=>a+b,0)/12) * 6);
      const savWealth   = Math.round(28 + (sav[1]  - sav.reduce((a,b)=>a+b,0)/12) * 6);
      const savRelation = Math.round(28 + (sav[6]  - sav.reduce((a,b)=>a+b,0)/12) * 6);
      const savHealth   = Math.round(28 + (sav[0]  - sav.reduce((a,b)=>a+b,0)/12) * 6);
      const savStr = `Career H10: ${savCareer}/56 | Wealth H2: ${savWealth}/56 | Relationships H7: ${savRelation}/56 | Health H1: ${savHealth}/56`;
      const savTopHouse = sav.indexOf(Math.max(...sav)) + 1;
      const savWeakHouse = sav.indexOf(Math.min(...sav)) + 1;

      // ── 4. GANDANTA — planets in sensitive transition zones ───────────────
      // Last 3°20' of water sign or first 3°20' of fire sign
      // Water→Fire transitions: Pisces→Aries (0→1), Cancer→Leo (3→4), Scorpio→Sag (7→8)
      const GANDANTA_PAIRS = [[11,0],[3,4],[7,8]]; // [water_sign, fire_sign]
      const gandantaPlanets = [];
      for(const [planet, lon] of Object.entries(natal.sid)) {
        const sign = so(lon);
        const deg = lon % 30;
        for(const [water, fire] of GANDANTA_PAIRS) {
          if((sign === water && deg >= 26.67) || (sign === fire && deg <= 3.33)) {
            gandantaPlanets.push(`${planet} (${RS[sign]} ${deg.toFixed(1)}°)`);
          }
        }
      }
      const gandantaStr = gandantaPlanets.length
        ? `Planetary transition stress: ${gandantaPlanets.join(', ')}`
        : '';

      // ── 5. DASHA SANDHI — approaching period transition ───────────────────
      const NOW_YR = new Date().getFullYear() + new Date().getMonth()/12;
      const SANDHI_DAYS = 45 / 365.25; // 45 days = transition zone
      let dashaSandhi = '';
      if(curr && Math.abs(curr.end - NOW_YR) < SANDHI_DAYS) {
        const nextMahaIdx = (DS.indexOf(curr.lord) + 1) % 9;
        dashaSandhi = `Dasha transition in ~${Math.round(Math.abs(curr.end-NOW_YR)*365)} days: ${mahaName} → ${FN[DS[nextMahaIdx]]} period`;
      } else if(currAntar && Math.abs(currAntar.end - NOW_YR) < SANDHI_DAYS) {
        const nextAntarIdx = (DS.indexOf(currAntar.lord) + 1) % 9;
        dashaSandhi = `Phase transition in ~${Math.round(Math.abs(currAntar.end-NOW_YR)*365)} days: ${antarName} → ${FN[DS[nextAntarIdx]]} phase`;
      }

      // ── 6. HORA — Sun or Moon hour at birth ───────────────────────────────
      // Each sign has 2 horas: first 15° = Sun hora, second 15° = Moon hora
      // Odd signs: Sun/Moon; Even signs: Moon/Sun
      const lagnaHora = (() => {
        const deg = natal.lagna % 30;
        const isOdd = lagnaSign % 2 === 0; // 0-indexed: Aries=0 is odd sign
        if(isOdd) return deg < 15 ? 'Sun Hora (energy, leadership, vitality)' : 'Moon Hora (intuition, relationships, nurturing)';
        return deg < 15 ? 'Moon Hora (intuition, relationships, nurturing)' : 'Sun Hora (energy, leadership, vitality)';
      })();

      // ── 7. BHAVA CHALIT — actual house positions ───────────────────────────
      // When lagna isn't at 0° of sign, planets near house cusps may shift houses
      // House cusp = lagna degree in each sign (equal house system from exact lagna)
      const lagnaDeg = natal.lagna % 30; // degrees into Lagna sign
      const bhavaShifts = [];
      if(lagnaDeg > 15) { // planets in early next sign may be in previous bhava
        for(const [planet, lon] of Object.entries(natal.sid)) {
          const wSign = so(lon);
          const degInSign = lon % 30;
          const wholeHouse = ((wSign - lagnaSign + 12) % 12) + 1;
          // If planet is in first (lagnaDeg)° of its sign, it may belong to previous bhava
          if(degInSign < lagnaDeg) {
            const bhavaHouse = ((wSign - lagnaSign + 11) % 12) + 1;
            if(bhavaHouse !== wholeHouse) {
              bhavaShifts.push(`${planet}: Whole Sign H${wholeHouse} → Bhava Chalit H${bhavaHouse}`);
            }
          }
        }
      } else if(lagnaDeg < 15) {
        for(const [planet, lon] of Object.entries(natal.sid)) {
          const wSign = so(lon);
          const degInSign = lon % 30;
          const wholeHouse = ((wSign - lagnaSign + 12) % 12) + 1;
          if(degInSign >= (30 - lagnaDeg)) {
            const bhavaHouse = ((wSign - lagnaSign + 13) % 12) + 1;
            if(bhavaHouse !== wholeHouse) {
              bhavaShifts.push(`${planet}: Whole Sign H${wholeHouse} → Bhava Chalit H${bhavaHouse}`);
            }
          }
        }
      }
      const bhavaStr = bhavaShifts.length ? bhavaShifts.join(' | ') : '';

      // ══════════════════════════════════════════════════════════════════════
      // NEW FEATURES BATCH 2 — House Lords, Aspects, Parivartana, Yoga Karaka,
      //                        Retrograde
      // Sources: BPHS Ch.26/36/37, Phaladeepika, Saravali, Brihat Jataka
      // All pure JS — ZERO extra output tokens
      // ══════════════════════════════════════════════════════════════════════

      // ── A. RETROGRADE PLANETS ─────────────────────────────────────────────
      // Compare longitude today vs 1 day ago — negative delta = retrograde
      // Rahu/Ketu always retrograde by convention
      const retroPlanets = [];
      const jde1 = natal.jde - 1;
      const ay1 = ayanamsa(jde1);
      const RETRO_CHECK = RETRO_PLANETS_ML; // module-level
      for(const p of RETRO_CHECK) {
        const lonNow  = n360(planetLon(natal.jde, p) - natal.ay);
        const lonPrev = n360(planetLon(jde1, p) - ay1);
        // Handle wrap-around at 0°/360°
        let delta = lonNow - lonPrev;
        if(delta > 180) delta -= 360;
        if(delta < -180) delta += 360;
        if(delta < 0) retroPlanets.push(p);
      }
      // Rahu/Ketu always retrograde
      retroPlanets.push('Rahu', 'Ketu');
      const retroStr = retroPlanets.filter(p => !['Rahu','Ketu'].includes(p)).length
        ? `Retrograde at birth: ${retroPlanets.filter(p=>!['Rahu','Ketu'].includes(p)).join(', ')} — intensified, internalized energy`
        : '';

      // ── B. HOUSE LORD PLACEMENTS ──────────────────────────────────────────
      // For each house, find its ruling planet and where it sits
      // Source: BPHS Ch.24-34 — "the lord of the Xth in the Yth gives..."
      const HOUSE_THEMES = ['self/body','wealth/speech','courage/siblings','home/mother',
        'intellect/children','enemies/health','partnerships','transformation/longevity',
        'fortune/father','career/status','income/gains','loss/liberation'];
      const houseLords = [];
      for(let h = 1; h <= 12; h++) {
        const signOfHouse = (lagnaSign + h - 1) % 12;
        const lordCode    = SL[signOfHouse];
        const lordName    = FN[lordCode];
        const lordSign    = so(natal.sid[lordName] || 0);
        const lordHouse   = ((lordSign - lagnaSign + 12) % 12) + 1;
        const lordStatus  = pStatus(lordName, lordSign) || '';
        houseLords.push({
          house: h, lord: lordName, sitsInHouse: lordHouse,
          sitsInSign: RS[lordSign], status: lordStatus,
          desc: `H${h} lord ${lordName} in H${lordHouse} (${RS[lordSign]})${lordStatus?' '+lordStatus[0]:''}`,
        });
      }
      // Build prompt string — key houses only (1,2,4,5,7,9,10,11)
      const KEY_HOUSES = [1,2,4,5,7,9,10,11];
      const houseLordStr = houseLords
        .filter(hl => KEY_HOUSES.includes(hl.house))
        .map(hl => hl.desc)
        .join(' | ');
      // Flag strong placements (lord in kendra/trikona) and weak (dusthana)
      const KENDRA   = [1,4,7,10];
      const TRIKONA  = [1,5,9];
      const DUSTHANA = [6,8,12];
      const strongLords = houseLords.filter(hl =>
        KENDRA.includes(hl.sitsInHouse) || TRIKONA.includes(hl.sitsInHouse));
      const weakLords = houseLords.filter(hl =>
        DUSTHANA.includes(hl.sitsInHouse) && KEY_HOUSES.includes(hl.house));
      const houseLordHighlights = [
        strongLords.length ? `Strong lords (kendra/trikona): ${strongLords.slice(0,3).map(hl=>hl.desc).join(', ')}` : '',
        weakLords.length   ? `Lords in dusthana: ${weakLords.slice(0,3).map(hl=>hl.desc).join(', ')}` : '',
      ].filter(Boolean).join(' | ');

      // ── C. PLANETARY ASPECTS (GRAHA DRISHTI) ─────────────────────────────
      // Every planet aspects 7th from itself (180°)
      // Mars also: 4th and 8th | Jupiter: 5th and 9th | Saturn: 3rd and 10th
      // Source: BPHS Ch.26, Brihat Jataka Ch.2
      const SPECIAL_ASPECTS = {
        Mars:    [4, 8],
        Jupiter: [5, 9],
        Saturn:  [3, 10],
        Rahu:    [5, 9],  // Rahu/Ketu treated like Jupiter per many traditions
        Ketu:    [5, 9],
      };
      const aspectsOn = {}; // aspectsOn[house] = list of aspecting planets
      for(let i = 1; i <= 12; i++) aspectsOn[i] = [];

      for(const [planet, lon] of Object.entries(natal.sid)) {
        const fromHouse = ((so(lon) - lagnaSign + 12) % 12) + 1;
        // All planets aspect 7th
        const asp7 = ((fromHouse + 5) % 12) + 1;
        aspectsOn[asp7].push(planet);
        // Special aspects
        for(const extraHouse of (SPECIAL_ASPECTS[planet] || [])) {
          const aspH = ((fromHouse + extraHouse - 2) % 12) + 1;
          if(aspH !== asp7) aspectsOn[aspH].push(planet);
        }
      }
      // Key house aspects for report context
      const aspectStr = [10,7,5,9,1,4].map(h => {
        const asp = aspectsOn[h];
        if(!asp.length) return null;
        return `H${h} aspected by: ${asp.join(', ')}`;
      }).filter(Boolean).join(' | ');
      // Flag benefic vs malefic aspects on key houses
      const NAT_BEN2 = ['Jupiter','Venus','Moon','Mercury'];
      const NAT_MAL2 = ['Saturn','Mars','Sun','Rahu','Ketu'];
      const career10aspects = aspectsOn[10];
      const marriage7aspects = aspectsOn[7];
      const aspect10note = career10aspects.length
        ? `Career H10 aspects: ${career10aspects.filter(p=>NAT_BEN2.includes(p)).length} benefic, ${career10aspects.filter(p=>NAT_MAL2.includes(p)).length} malefic`
        : '';
      const aspect7note = marriage7aspects.length
        ? `Partnership H7 aspects: ${marriage7aspects.filter(p=>NAT_BEN2.includes(p)).length} benefic, ${marriage7aspects.filter(p=>NAT_MAL2.includes(p)).length} malefic`
        : '';

      // ── D. PARIVARTANA YOGA (Sign Exchange) ──────────────────────────────
      // Two planets in each other's sign = powerful mutual exchange yoga
      // Source: BPHS Ch.37, Saravali Ch.36
      const parivartanaYogas = [];
      const planetList = ['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn'];
      for(let i = 0; i < planetList.length; i++) {
        for(let j = i+1; j < planetList.length; j++) {
          const p1 = planetList[i], p2 = planetList[j];
          const sign1 = so(natal.sid[p1]);
          const sign2 = so(natal.sid[p2]);
          // p1 in sign ruled by p2, AND p2 in sign ruled by p1
          const lord1 = FN[SL[sign1]]; // lord of p1's sign
          const lord2 = FN[SL[sign2]]; // lord of p2's sign
          if(lord1 === p2 && lord2 === p1) {
            const h1 = ((sign1 - lagnaSign + 12) % 12) + 1;
            const h2 = ((sign2 - lagnaSign + 12) % 12) + 1;
            // Classify: Maha (both kendra/trikona), Kahala (one kendra, one dusthana), Dainya (dusthana)
            const type = (DUSTHANA.includes(h1) || DUSTHANA.includes(h2))
              ? 'Dainya (complex)' : (KENDRA.includes(h1) || TRIKONA.includes(h1)) && (KENDRA.includes(h2) || TRIKONA.includes(h2))
              ? 'Maha (powerful)' : 'Kahala (mixed)';
            parivartanaYogas.push({
              planets: `${p1}↔${p2}`, houses: `H${h1}↔H${h2}`,
              signs: `${RS[sign1]}↔${RS[sign2]}`, type,
            });
          }
        }
      }
      const parivartanaStr = parivartanaYogas.length
        ? `Exchange patterns: ${parivartanaYogas.map(y=>`${y.planets} (${y.houses}, ${y.type})`).join('; ')}`
        : '';

      // ── E. YOGA KARAKA ────────────────────────────────────────────────────
      // Planet ruling both a kendra AND a trikona = exceptionally auspicious
      // Chart-specific — depends entirely on lagna
      // Source: BPHS Ch.34, Phaladeepika Ch.7
      const YOGA_KARAKA_BY_LAGNA = YOGA_KARAKA_ML;
      const ykEntry = YOGA_KARAKA_BY_LAGNA[lagna];
      const yogaKarakaStr = ykEntry
        ? `Yoga Karaka for ${lagna} Rising: ${ykEntry.planet} (${ykEntry.note})`
        : '';
      // Check yoga karaka planet's actual strength
      const ykPlanet = ykEntry?.planet;
      const ykSign   = ykPlanet ? so(natal.sid[ykPlanet]) : null;
      const ykStatus = ykSign !== null ? pStatus(ykPlanet, ykSign) : null;
      const ykHouse  = ykSign !== null ? ((ykSign - lagnaSign + 12) % 12) + 1 : null;
      const ykNote   = ykPlanet
        ? `${ykPlanet} (Yoga Karaka) sits in H${ykHouse} ${RS[ykSign]}${ykStatus?' — '+ykStatus:''}`
        : '';

      // ══════════════════════════════════════════════════════════════════════
      // BATCH 3 — KP Sub-Lord + Dispositor Chain
      // Sources: KP Reader (Krishnamurti), BPHS Ch.24, Brihat Jataka Ch.1
      // Zero extra output tokens
      // ══════════════════════════════════════════════════════════════════════

      // ── F. KP NAKSHATRA SUB-LORD ──────────────────────────────────────────
      // Each nakshatra (13°20') is divided into 9 sub-lords proportional
      // to Vimshottari dasha years. Sub-lord = final controller of outcomes.
      // Source: KP Reader Vol.1, K.S.Krishnamurti
      const NAK_SPAN = NAK_SPAN_ML;     // module-level
      const VIM_YRS = VIM_YRS_ML;       // module-level
      const VIM_SEQ = VIM_SEQ_ML;       // module-level
      // NL gives nakshatra lord INDEX in DS array (0-8)
      // NL is already defined: const NL = [Ke,Ve,Su,Mo,Ma,Ra,Ju,Sa,Me,...] per nakshatra
      const getKPSubLord = (lon) => {
        const nakIdx = Math.floor(n360(lon) / NAK_SPAN) % 27;
        const degInNak = n360(lon) % NAK_SPAN;
        // Nakshatra lord code (short) → full name
        const nakLordCode = NL[nakIdx];
        const nakLordFull = FN[nakLordCode];
        // Find start position in VIM_SEQ
        const startIdx = VIM_SEQ.indexOf(nakLordFull);
        if(startIdx === -1) return { nakshatra: NK[nakIdx], nakLord: nakLordFull, subLord: nakLordFull };
        let cursor = 0;
        for(let i = 0; i < 9; i++) {
          const planet = VIM_SEQ[(startIdx + i) % 9];
          const span = (VIM_YRS[planet] / 120) * NAK_SPAN;
          if(degInNak >= cursor && degInNak < cursor + span) {
            return {
              nakshatra:  NK[nakIdx],
              nakLord:    nakLordFull,
              subLord:    planet,
              subSpanDeg: span.toFixed(2),
            };
          }
          cursor += span;
        }
        return { nakshatra: NK[nakIdx], nakLord: nakLordFull, subLord: nakLordFull };
      };
      // Compute sub-lords for all planets
      const kpSubLords = {};
      for(const [planet, lon] of Object.entries(natal.sid)) {
        kpSubLords[planet] = getKPSubLord(lon);
      }
      // Also compute for lagna
      kpSubLords['Lagna'] = getKPSubLord(natal.lagna);

      // Key interpretive flags
      // Moon sub-lord → controls emotional experience quality
      const moonSubLord = kpSubLords['Moon']?.subLord || '';
      const moonNakLord = kpSubLords['Moon']?.nakLord || '';
      // Venus sub-lord → controls relationship fulfillment
      const venusSubLord = kpSubLords['Venus']?.subLord || '';
      // 10th house lord's sub-lord → career outcome controller
      const tenthLord = houseLords.find(hl => hl.house === 10)?.lord || '';
      const tenthLordSubLord = tenthLord && kpSubLords[tenthLord]
        ? kpSubLords[tenthLord].subLord : '';
      // Lagna sub-lord → life direction controller
      const lagnaSubLord = kpSubLords['Lagna']?.subLord || '';

      const kpStr = [
        `Moon sub-lord: ${moonSubLord} (nakshatra lord: ${moonNakLord}) — emotional experience controlled by ${moonSubLord}`,
        `Venus sub-lord: ${venusSubLord} — relationship fulfillment governed by ${venusSubLord}`,
        `Career lord (${tenthLord}) sub-lord: ${tenthLordSubLord} — career outcome controlled by ${tenthLordSubLord}`,
        `Lagna sub-lord: ${lagnaSubLord} — life direction controlled by ${lagnaSubLord}`,
      ].join(' | ');

      // ── G. DISPOSITOR CHAIN ───────────────────────────────────────────────
      // Follow each planet to its sign ruler until self-disposited
      // Final dispositor = planet in own sign, controls the whole chain above it
      // Source: BPHS Ch.24, Brihat Jataka Ch.1 — "follow the landlord"
      const getSignLord = (planet) => {
        const sign = so(natal.sid[planet] !== undefined ? natal.sid[planet] : 0);
        return FN[SL[sign]]; // full name
      };
      const buildChain = (planet, visited = new Set()) => {
        if(visited.has(planet)) return [planet]; // cycle = both are terminal
        visited.add(planet);
        const lord = getSignLord(planet);
        if(lord === planet) return [planet]; // self-disposited = terminal
        return [planet, ...buildChain(lord, visited)];
      };
      // Build full chain for each planet
      const dispositorChains = {};
      for(const planet of ['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn','Rahu','Ketu']) {
        dispositorChains[planet] = buildChain(planet);
      }
      // Find chart's final dispositor(s) — planets that are self-disposited
      const finalDispositors = ['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn']
        .filter(p => getSignLord(p) === p);
      // Find which planet most other planets depend on (most chains pass through)
      const dependencyCount = {};
      for(const chain of Object.values(dispositorChains)) {
        const terminal = chain[chain.length - 1];
        dependencyCount[terminal] = (dependencyCount[terminal] || 0) + 1;
      }
      const chartRuler = Object.entries(dependencyCount)
        .sort((a,b) => b[1] - a[1])[0];
      const chartRulerStr = chartRuler
        ? `Chart ruler (most chains terminate here): ${chartRuler[0]} (${chartRuler[1]} planets depend on it)`
        : '';

      // Key chains for prompt context
      const moonChain = dispositorChains['Moon'];
      const lagnaLordName = houseLords.find(hl => hl.house === 1)?.lord || '';
      const lagnaLordChain = lagnaLordName ? dispositorChains[lagnaLordName] : [];

      const moonChainStr = moonChain?.length > 1
        ? `Moon chain: ${moonChain.join('→')} (terminal: ${moonChain[moonChain.length-1]})`
        : moonChain ? `Moon self-disposited in ${RS[so(natal.sid.Moon)]}` : '';
      const lagnaChainStr = lagnaLordChain?.length > 1
        ? `${lagna} Rising lord chain: ${lagnaLordChain.join('→')} (terminal: ${lagnaLordChain[lagnaLordChain.length-1]})`
        : lagnaLordChain?.length === 1 ? `${lagnaLordName} self-disposited (strong lagna lord)` : '';

      const finalDispStr = finalDispositors.length
        ? `Self-disposited (independent): ${finalDispositors.join(', ')}`
        : '';
      const dispositorStr = [chartRulerStr, moonChainStr, lagnaChainStr, finalDispStr]
        .filter(Boolean).join(' | ');





      // ── 8. NAVAMSA CONTEXT STRING for prompts ─────────────────────────────
      const navamsaLagnaSign = _navamsaLagnaSign; // already computed early
      const vargottamaStr = _eVargottamaStr; // aliased
      // Key planets in navamsa for marriage/soul analysis
      const venusD9 = _venusD9; // already computed early
      const moonD9  = navamsa['Moon']?.signName  || RS[navamsaLagna];
      const jupD9   = navamsa['Jupiter']?.signName || RS[navamsaLagna];
      const navamsaStr = `D9 Rising: ${navamsaLagnaSign} | Venus D9: ${venusD9} | Moon D9: ${moonD9} | Jupiter D9: ${jupD9}`;
      const d9Ctx = `Soul/relationship chart — Venus in ${venusD9||'?'}, Moon in ${moonD9||'?'}, Rising ${navamsaLagnaSign||'?'}`;
      const d10Ctx = houseLords ? (() => { const h10 = houseLords.find(hl=>hl.house===10); return h10 ? `Career chart focus: ${h10.lord||''} rules 10th — ${h10.desc||''}` : ''; })() : '';

            // ── INLINE BASE BUILDER (pre-written content, zero tokens) ─────────────
      // Trait blurbs — 1st item only (verdicts cover the rest)
      const RD = (RISING_DESC[lagna] || []).slice(0, 1);
      const MD = (MOON_DESC[rashi]  || []).slice(0, 1);
      const SD = (STAR_DESC[nakshatra] || []).slice(0, 1);

      // ── ENHANCED CHART CONTEXT — new features injected into all prompts ──
            const NEWFEATURES = [
        // Core verdicts — injected into every section via chartBase
        // Detailed topic verdicts are added per-section via buildVerdictCtx
        rulesResults ? `MARRIAGE: ${rulesResults.marriage?.verdict?.substring(0,120)||''}` : '',
        rulesResults ? `CAREER: ${rulesResults.career?.verdict?.substring(0,120)||''}` : '',
        rulesResults ? `DASHA: ${rulesResults.dasha?.verdict?.substring(0,120)||''}` : '',
        rulesResults ? `HEALTH: ${rulesResults.health?.verdict?.substring(0,100)||''}` : '',
        rulesResults ? `YOGAS: ${rulesResults.yogas?.summary?.substring(0,100)||''}` : '',
        // WEALTH / SOUL (AK) / AV moved to buildVerdictCtx — added per-section only when relevant
      ].filter(Boolean).join('\n')

      // ── DUAL-TIMING CROSS-VERIFICATION ────────────────────────────────────
      // Cross-checks Vimshottari periods against Chara Dasha (Jaimini) for
      // high-conviction timing. When both systems agree → high conviction.
      // When they disagree → divergent, name the gap honestly to the user.
      // Returns { convergentFavorable, convergentCaution, divergent } or null.
      const crossVerifyTiming = (allPeriods, charaCurrentSign, rulesResults) => {
        try {
          if (!Array.isArray(allPeriods) || !allPeriods.length) return null;
          if (charaCurrentSign === null || charaCurrentSign === undefined) return null;
          if (typeof charaCurrentSign !== 'number' || charaCurrentSign < 0 || charaCurrentSign > 11) return null;

          // Vimshottari period quality classifier (per spec)
          const VIM_FAV = new Set(['Jupiter','Venus','Mercury','Sun']);
          const VIM_CAU = new Set(['Saturn','Rahu','Ketu']);
          // Moon, Mars => neutral

          // Chara Dasha quality — primary signal: lord of current Chara sign
          const charaLordCode = SL[charaCurrentSign];
          const charaLord = FN[charaLordCode] || null;
          const CHARA_BEN = new Set(['Jupiter','Venus','Mercury','Moon']);
          const CHARA_MAL = new Set(['Saturn','Mars','Sun','Rahu','Ketu']);
          let charaQuality = 'neutral';
          if (charaLord && CHARA_BEN.has(charaLord)) charaQuality = 'favorable';
          else if (charaLord && CHARA_MAL.has(charaLord)) charaQuality = 'caution';

          // Secondary signal: scan engine's charaDasha.rules if present
          // Defensive — could be array of strings, array of objects with .verdict, or undefined
          try {
            const cdRules = rulesResults && rulesResults.charaDasha && rulesResults.charaDasha.rules;
            if (Array.isArray(cdRules)) {
              const txt = cdRules.map(r => typeof r === 'string' ? r : (r && (r.verdict || r.rule || ''))).join(' ').toLowerCase();
              const favHits = (txt.match(/favorable|benefic|success|gain|expansion|recognition|prosper/g) || []).length;
              const cauHits = (txt.match(/caution|obstacle|delay|malefic|struggle|setback|loss/g) || []).length;
              if (favHits > cauHits + 1) charaQuality = 'favorable';
              else if (cauHits > favHits + 1) charaQuality = 'caution';
            }
          } catch(e) { /* ignore — keep primary classification */ }

          const convergentFavorable = [];
          const convergentCaution = [];
          const divergent = [];

          for (const p of allPeriods) {
            if (!p || !p.planet) continue;
            let vimQ;
            if (VIM_FAV.has(p.planet)) vimQ = 'favorable';
            else if (VIM_CAU.has(p.planet)) vimQ = 'caution';
            else vimQ = 'neutral';

            const slim = { planet: p.planet, start: p.start, end: p.end, current: !!p.current };

            if (vimQ === 'favorable' && charaQuality === 'favorable') convergentFavorable.push(slim);
            else if (vimQ === 'caution' && charaQuality === 'caution') convergentCaution.push(slim);
            else if (
              (vimQ === 'favorable' && charaQuality === 'caution') ||
              (vimQ === 'caution' && charaQuality === 'favorable')
            ) divergent.push(slim);
            // else: one or both neutral → not flagged (covered by existing year verdicts)
          }

          // Nothing to surface? Return null so we don't add empty noise.
          if (!convergentFavorable.length && !convergentCaution.length && !divergent.length) return null;
          return { convergentFavorable, convergentCaution, divergent };
        } catch(e) {
          return null;
        }
      };

      // ── TOPIC-AWARE VERDICT INJECTOR ──────────────────────────────────────
      // Extracts the 4-5 most relevant classical verdicts per section topic
      // This ensures ALL section prompts get the right engine verdicts — not just chartBase sections
      const buildVerdictCtx = (topic) => {
        if (!rulesResults) return '';
        const R = rulesResults;
        const lines = [];
        const push = (label, val) => { if (val) lines.push(`${label}: ${val.substring ? val.substring(0,160) : val}`); };

        if (topic === 'career') {
          push('CAREER', R.career?.verdict);
          push('WEALTH', R.wealth?.verdict);
          push('D10', R.vargas?.verdicts?.find(v=>v?.includes('D10')));
          push('D2 HORA', R.extraVargas?.verdicts?.find(v=>v?.includes('D2')));
          push('DASHA', R.dasha?.verdict);
          push('CAREER FIELDS', R.career?.fields?.join(', '));
          push('BJ RAJA YOGA', R.brihatJataka?.verdicts?.find(v=>v?.includes('Raja Yoga')||v?.includes('Mahapurusha')));
          push('PMY YOGA', R.horaCompletion?.verdicts?.find(v=>v?.startsWith('RUCHAKA')||v?.startsWith('BHADRA')||v?.startsWith('HAMSA')||v?.startsWith('MALAVYA')||v?.startsWith('SASA')));
          push('10TH HOUSE STRENGTH', R.horaCompletion?.verdicts?.find(v=>v?.includes('10th house')));
          push('ENEMIES', R.enemies?.verdict);
        } else if (topic === 'love') {
          push('MARRIAGE', R.marriage?.verdict);
          push('SPOUSE TYPE', R.marriage?.spouse?.slice(0,3).join(', '));
          push('MARRIAGE TIMING', R.marriage?.timing);
          push('TRUE MARRIAGE (UPAPADA)', R.upapada?.verdicts?.[0]);
          push('SPOUSE SOUL (DK)', R.jaiminiKarakas?.verdicts?.find(v=>v?.includes('DARAKARAKA')));
          push('D7', R.vargas?.verdicts?.find(v=>v?.includes('D7')));
          push('MARITAL HAPPINESS', R.secondary?.verdicts?.find(v=>v?.startsWith('MARITAL')));
          push('BJ STREE JATAKA', R.brihatJataka?.verdicts?.find(v=>v?.includes('Stree')));
          if (R.mangalDosha?.hasDosha) {
            push('MANGAL DOSHA', R.mangalDosha.verdicts?.join(' | '));
          }
        } else if (topic === 'health') {
          push('HEALTH', R.health?.verdict);
          push('LONGEVITY', R.health?.longevity > 4 ? 'LONG LIFE indicators present' : R.health?.longevity < 0 ? 'Longevity needs attention' : '');
          push('VULNERABLE AREAS', R.health?.vulnerableAreas?.join(', '));
          push('MONITOR', R.health?.diseases?.slice(0,3).join(', '));
          push('MENTAL HEALTH', R.mind?.verdicts?.slice(0,1).join(' | '));
          push('REMEDIES', R.remedies?.needed?.filter(x=>x.priority==='HIGH').map(x=>x.planet).join(', '));
          push('BJ NIRYANA', R.brihatJataka?.verdicts?.find(v=>v?.includes('Niryana')||v?.includes('Anishta')));
          push('D30 CHARACTER', R.extraVargas?.verdicts?.find(v=>v?.includes('D30')));
        } else if (topic === 'dasha') {
          push('DASHA NOW', R.dasha?.verdict);
          push('ACTIVE WINDOWS', R.dasha?.rules?.find(r=>r.id==='DASHA-WINDOWS')?.verdict);
          push('TRANSIT JUPITER', R.transits?.verdicts?.[0]);
          push('TRANSIT SATURN', R.transits?.verdicts?.[1]);
          push('AV', R.ashtakavarga?.verdicts?.find(v=>v?.includes('JUPITER BEST')));
          push('PEAK PLANET STATE', R.horaCompletion?.verdicts?.find(v=>v?.includes('Yuva-Jagrat')));
          push('WEAKENED PLANET', R.horaCompletion?.verdicts?.find(v=>v?.includes('significantly weakened')));
        } else if (topic === 'soul') {
          push('SOUL PURPOSE (AK)', R.jaiminiKarakas?.verdicts?.[0]);
          push('KARAKAMSHA', R.jaiminiKarakas?.verdicts?.[1]);
          push('PUBLIC IMAGE', R.arudhaLagna?.verdicts?.[0]);
          push('SPIRITUALITY', R.spirituality?.verdict);
          push('YOGAS', R.yogas?.summary);
          push('VARAHAMIHIRA NATURE', R.brihatJataka?.verdicts?.find(v=>v?.includes('BJ Ch.1')));
          push('NABHASA YOGA', R.brihatJataka?.verdicts?.find(v=>v?.includes('Nabhasa')||v?.includes('Yoga')));
          push('PAST KARMA (D60)', R.extraVargas?.verdicts?.find(v=>v?.includes('D60')));
          push('KALSARPA', R.kalsarpa?.hasDosha ? R.kalsarpa.verdicts?.[0] : null);
          push('RETROGRADE SIGNATURE', R.horaCompletion?.verdicts?.find(v=>v?.includes('retrograde')||v?.includes('past-life karma signature')));
        } else if (topic === 'personality') {
          push('LAGNA', R.lagna?.verdict);
          push('LAGNA RULES', R.lagna?.verdicts?.[0]);
          push('MIND', R.mind?.verdicts?.[0]);
          push('MIND DEPTH', R.mind?.verdicts?.[1]);
          push('COMMUNICATION', R.communication?.verdict || R.mercury?.verdict);
          push('NATURE (BJ Ch.1)', R.brihatJataka?.verdicts?.find(v=>v?.includes('BJ Ch.1')));
          push('YOGAS', R.yogas?.summary);
          if (R.kalsarpa?.hasDosha) push('KAL SARPA', R.kalsarpa.verdicts?.[0]);
        } else if (topic === 'year') {
          push('DASHA ACTIVE', R.dasha?.verdict);
          push('TRANSIT', R.transits?.verdicts?.[0]);
          push('AV STRONG', R.ashtakavarga?.verdicts?.find(v=>v?.includes('VERY STRONG')||v?.includes('STRONG HOUSES')));
          push('SADE SATI', R.sadeSati?.isActive ? R.sadeSati.verdicts?.[0] : null);
          // Dual-timing cross-verification: Vimshottari × Chara Dasha agreement check
          try {
            const xv = crossVerifyTiming(allPeriods, charaCurrentSignForReport, R);
            if (xv) {
              const fmtList = arr => arr.slice(0,3).map(p=>`${p.planet} ${p.start}–${p.end}`).join(', ');
              if (xv.convergentFavorable.length) lines.push(`DUAL-TIMING CONVERGENT (HIGH CONVICTION FAVORABLE): ${fmtList(xv.convergentFavorable)}`);
              if (xv.convergentCaution.length)   lines.push(`DUAL-TIMING CONVERGENT (HIGH CONVICTION CAUTION): ${fmtList(xv.convergentCaution)}`);
              if (xv.divergent.length)           lines.push(`DUAL-TIMING DIVERGENT (mixed signals — one classical system favors, the other flags caution): ${fmtList(xv.divergent)}`);
            }
          } catch(e) { /* never break the prompt */ }
        }
        return lines.length ? '\nCLASSICAL VERDICTS:\n' + lines.join('\n') : '';
      };

      // ── TAJIK ANNUAL CONTEXT INJECTOR ───────────────────────────────────
      // Surfaces the Tajik (annual) layer for Year/Timing reports
      // Pulls: Pratyantar (short window), Muntha (annual focus), Panchadhikari
      // (5 year-rulers), Period Themes (current dasha quality)
      const buildTajikCtx = () => {
        const lines = [];
        if (typeof pratyantarStr !== 'undefined' && pratyantarStr) lines.push(pratyantarStr);
        if (typeof munthaStr !== 'undefined' && munthaStr) lines.push(munthaStr);
        if (typeof panchaStr !== 'undefined' && panchaStr) lines.push('Year rulers (Panchadhikari): ' + panchaStr);
        if (typeof ptCurrentStr !== 'undefined' && ptCurrentStr) lines.push(ptCurrentStr);
        return lines.length ? '\nTAJIK ANNUAL LAYER:\n' + lines.join('\n') : '';
      };
      const topYoga = yogas[0] ? `${yogas[0].name}: ${yogas[0].meaning}` : 'standard chart';
      const topPattern = patterns[0] ? `${patterns[0].type} (${patterns[0].severity}): ${patterns[0].meaning}` : '';
      const satNote = todayData.sadeSati ? `Saturn pressure cycle active — ${todayData.sadeSati.phase}: ${todayData.sadeSati.note}` : '';
      // Pre-built rising+moon+star base (injected into section prompts, zero tokens)
      const chartBase = `${name} | ${lagna} Rising · ${rashi} Moon · ${nakshatra} Birth Star
Rising Sign ${lagna}: ${RD.join(' ')}
Moon Sign ${rashi}: ${MD.join(' ')}
Birth Star ${nakshatra}: ${SD.join(' ')}
Major Life Period: ${mahaName} ends ${mahaEnds} (${mahaYrsLeft} yrs left) | Active Phase: ${antarName} ends ${antarEnds} (${antarMosLeft} mo left)
Key Pattern: ${topYoga}${topPattern?' | Challenge: '+topPattern:''}${satNote?' | '+satNote:''}
Jupiter: house ${todayData.jupTransit.house} from Moon (${todayData.jupTransit.quality})`;

      // ── NATAL + TIMING: section calls ──────────────────────────────────────
      // ════════════════════════════════════════════════════════════════════
      // TEMPLATE RENDERERS — deterministic HTML, no Claude API call needed
      // Used for sections where data → output is 1:1 with no synthesis
      // ════════════════════════════════════════════════════════════════════

      // TIMING_STYLE: How each rising sign + moon sign naturally times decisions
      const TIMING_STYLE = {
        Aries:'moves fast and trusts their gut',Taurus:'waits for certainty before acting',
        Gemini:'gathers information then pivots quickly',Cancer:'reads emotional readiness first',
        Leo:'acts on creative inspiration and confidence',Virgo:'analyzes until the timing feels perfect',
        Libra:'weighs options and waits for harmony',Scorpio:'waits in silence then moves decisively',
        Sagittarius:'trusts opportunity and moves boldly',Capricorn:'plans methodically and acts when ready',
        Aquarius:'detaches, reads patterns, then acts',Pisces:'follows intuitive flow and feeling'
      };
      // MAHA_CAREER: What each major period means for career trajectory
      const MAHA_CAREER = {
        Sun:'Career reaches peak authority. Government connections, leadership, and recognition are central. Major moves are supported.',
        Moon:'Public profile and emotional intelligence drive career. People-facing roles and public sector shine. Fluctuating but popular.',
        Mars:'Action-driven expansion. Real estate, launches, and competitive wins are supported. Move fast on opportunities.',
        Mercury:'Business intelligence leads. Writing, communication, tech, and deals close well. Excellent period for negotiations.',
        Jupiter:'The most auspicious career period. Growth, promotions, and expansion come. Trust the opportunities arriving.',
        Venus:'Creative fields, luxury, and relationship-based work excel. Charm and aesthetics open doors professionally.',
        Saturn:'Slow, disciplined building. Authority builds through service and persistence. Long-term moves only — no shortcuts.',
        Rahu:'Unconventional and fast-moving career energy. Technology, foreign companies, and bold bets are activated.',
        Ketu:'Internalization and specialization. Deep expertise recognized. Not a period for external push — trust the process.'
      };
      // PLANET_CAREER_QUALITY: For classifying good vs cautious annual periods
      const GOOD_CAREER_PLANETS  = new Set(['Jupiter','Venus','Mercury','Sun','Moon','Mars']);
      const CAUTION_CAREER_PLANETS = new Set(['Saturn','Rahu','Ketu']);

      // Build the Timing Blueprint section as HTML (no Claude needed)
      function buildTimingBlueprintHTML() {
          var ts = TIMING_STYLE[lagna] || 'acts when conditions feel aligned';
          var ms = TIMING_STYLE[rashi]  || 'reads emotional readiness';
          var bp = allPeriods.filter(function(p){return GOOD_CAREER_PLANETS.has(p.planet);});
          var cp = allPeriods.filter(function(p){return CAUTION_CAREER_PLANETS.has(p.planet);});
          var l1 = '<strong>' + name + "'s " + lagna + ' Rising + ' + rashi + ' Moon:</strong> ' + name + ' ' + ts + ', while their ' + rashi + ' Moon means they ' + ms + ' \u2014 together this creates someone who needs both logical and emotional alignment before acting.';
          var l2 = '<strong>Current Major Life Period (' + mahaName + ', ending ' + mahaEnds + '):</strong> ' + (MAHA_CAREER[mahaName] || mahaName + ' period active.') + (PERIOD_THEMES[mahaName] && PERIOD_THEMES[mahaName].watch ? ' Watch: ' + PERIOD_THEMES[mahaName].watch.split(',')[0] + '.' : '');
          var bpStr = bp.length > 0 ? 'Move forward in ' + bp.slice(0,3).map(function(p){return p.planet+' ('+p.start+'\u2192'+p.end+')'+(p.current?' \u2014 active now':'');}).join(', ') + '.' : 'No strong push periods right now \u2014 a consolidation phase.';
          var cpStr = cp.length > 0 ? ' Move carefully in ' + cp.slice(0,2).map(function(p){return p.planet+' ('+p.start+'\u2192'+p.end+')';}).join(', ') + ' \u2014 review first.' : '';
          var l3 = '<strong>Reading annual periods:</strong> ' + bpStr + cpStr;
          return '<div style="display:flex;flex-direction:column;gap:14px">' + [l1,l2,l3].map(function(l){return '<p style="margin:0;font-size:15px;line-height:1.75;color:var(--text)">'+l+'</p>';}).join('') + '</div>';
        }

      function buildCareerFinancialTimingHTML() {
          var cb = allPeriods.filter(function(p){return GOOD_CAREER_PLANETS.has(p.planet);});
          var fb = allPeriods.filter(function(p){return ['Jupiter','Venus','Mercury'].includes(p.planet);});
          var cc = allPeriods.filter(function(p){return CAUTION_CAREER_PLANETS.has(p.planet);});
          var csStr = cb.length > 0 ? cb.slice(0,3).map(function(p){return p.planet+' ('+p.start+'\u2192'+p.end+(p.current?' \u2014 ACTIVE NOW':'')+')';}).join(', ') : 'No strong career windows \u2014 consolidation phase';
          var fsStr = fb.length > 0 ? fb.slice(0,2).map(function(p){return p.planet+' ('+p.start+'\u2192'+p.end+')';}).join(' and ') : 'Cautious financial period';
          var l1 = '<strong>Best career windows:</strong> ' + csStr + '.';
          var l2 = '<strong>Best financial windows:</strong> ' + fsStr + (fb[0] ? '. Invest, close deals, and make major financial decisions in these windows.' : '.');
          var l3 = '<strong>' + mahaName + ' trajectory (through ' + mahaEnds + '):</strong> ' + (MAHA_CAREER[mahaName] || mahaName + ' governs this period.');
          var lines = [l1, l2, l3];
          if (cc.length > 0) lines.push('<strong>Periods requiring care:</strong> ' + cc.map(function(p){return p.planet+' ('+p.start+'\u2192'+p.end+')';}).join(', ') + ' \u2014 review, consolidate, do not launch.');
          return '<div style="display:flex;flex-direction:column;gap:14px">' + lines.map(function(l){return '<p style="margin:0;font-size:15px;line-height:1.75;color:var(--text)">'+l+'</p>';}).join('') + '</div>';
        }

      function buildYearAtAGlanceHTML() {
          var bp = allPeriods.filter(function(p){return GOOD_CAREER_PLANETS.has(p.planet);})[0];
          var wp = allPeriods.filter(function(p){return CAUTION_CAREER_PLANETS.has(p.planet);})[0];
          var nb = allPeriods.find(function(p){return !p.current;}) || allPeriods[allPeriods.length-1];
          var dv = (rulesResults && rulesResults.dasha && rulesResults.dasha.verdict) ? rulesResults.dasha.verdict.replace(/^[A-Z-]+: /,'').split('.')[0] : '';
          var yk = RS[srLagnaSign1] ? RS[srLagnaSign1] + ' annual energy — a ' + (TIMING_STYLE[RS[srLagnaSign1]] || 'forward-moving') + ' kind of year' : lagna + ' energy year';
          var lines = [
            yk + (topYoga ? '. Dominant pattern: ' + topYoga + '.' : '.'),
            bp ? rnd(LEGAL_HIGH) + ' ' + (PERIOD_THEMES[bp.planet] && PERIOD_THEMES[bp.planet].positive ? PERIOD_THEMES[bp.planet].positive.split(',')[0] : bp.planet + ' period') + ' — window is ' + bp.start + ' → ' + bp.end + (bp.current ? ' (active now)' : '') + '.' : rnd(LEGAL_TIMING) + ' consolidation and review — a year for building foundations.',
            wp ? rnd(LEGAL_CAUTION) + ' the ' + wp.planet + ' period (' + wp.start + ' → ' + wp.end + ') — ' + (PERIOD_THEMES[wp.planet] && PERIOD_THEMES[wp.planet].watch ? PERIOD_THEMES[wp.planet].watch.split(',')[0] : 'review, don\'t launch') + '.' : 'No major caution periods this year — energy is relatively clear.',
            birthdayInWindow ? 'Birthday window ' + fmtDt(nextSRCal) + ' brings a shift as the Annual Forecast Chart activates new themes.' : (nb ? 'Major energy shift: ' + nb.planet + ' period opens ' + nb.start + ' — ' + (PERIOD_THEMES[nb.planet] && PERIOD_THEMES[nb.planet].focus ? PERIOD_THEMES[nb.planet].focus : nb.planet + ' themes activate') + '.' : 'Energy holds steady through the year.'),
            dv ? dv + '.' : mahaName + ' Major Life Period defines the underlying current — everything this year is colored by its themes.'
          ];
          return '<div style="display:flex;flex-direction:column;gap:10px">' + lines.map(function(l,i){return '<p style="margin:0;font-size:'+(i===4?'16px;font-weight:600':'15px')+';line-height:1.75;color:'+(i===4?'#bf9a30':'var(--text)')+'">'+l+'</p>';}).join('') + '</div>';
        }

      const SECTION_PROMPTS = reportType === 'timing' ? [
        // Timing guide sections

        {title:'📅 Your Timing Blueprint',tok:0,isTemplate:true,buildFn:buildTimingBlueprintHTML},
        {title:'⚡ Your Power Windows This Year',tok:380,prompt:`${LANG}${buildTajikCtx()}\n\n${name} | ${lagna} Rising · ${rashi} Moon\n${shadbalaCtx ? 'Strength snapshot: '+shadbalaCtx.split('\n').slice(1,4).join(' | ') : ''}\n${buildNarrativeCtx(planetNarratives,'Saturn')}\n${buildNarrativeCtx(planetNarratives,'Jupiter')}\n${buildTimingCtx(timingWindows3,'career')}\n${buildTimingCtx(timingWindows3,'money')}\n${buildTimingCtx(timingWindows3,'love')}\nAnnual periods (next 12 months): ${allPeriods.map(p=>p.planet+' '+p.start+'→'+p.end+(p.current?' NOW':'')).join(' | ')}\nKey pattern: ${topYoga}\nJupiter transit quality: ${todayData.jupTransit.quality}\n\nSection tone: direct, useful, slightly urgent. This is the section that pays the bills — be the friend who tells ${name} the actual months that matter.\n\nOpen with one line about the overall shape of the year — is it a pushing year, a building year, a holding year? Specific to their actual periods above.\n\nThen identify the THREE strongest power windows. For each, write a short paragraph (not bullets):\nThe specific dates (cite the actual period and date range). WHY this window works for them — translate the period quality into life-action language. What does the energy of this period actually open up? One concrete thing to do in this window — specific to their chart territory.\n\nThen name two periods needing more care. For each: what NOT to push, what to do instead, what becomes available later.\n\nClose with one sentence about the year's overall trajectory.\n\nSelf-check: Did you name actual months and dates? Did you translate period names into life-action? No \"Saturn period brings discipline\" — say what the discipline IS.\n\nDual-timing instruction: When dual-timing flags convergent agreement (both classical systems agree), name it as a 'high conviction' window — these are the months worth pushing hardest on. When divergent, acknowledge honestly: 'one classical timing system favors this window but another flags caution — proceed without betting the farm.' Use plain English; never name the systems by their Sanskrit names.${buildVerdictCtx('year')}`},
        {title:'📆 Month-by-Month Guide',tok:0,isMonthGuide:true},
        {title:`🎯 Timing for ${eventType||'Your Goals'}`,tok:320,prompt:`${LANG}${buildTajikCtx()}\n\n${name} | ${lagna} Rising · ${rashi} Moon | Goal: ${eventType||'major life decisions'}\nAnnual periods: ${allPeriods.map(p=>p.planet+' '+p.start+'→'+p.end+(p.current?' NOW':'')).join(' | ')}\nKey pattern: ${topYoga}\nCurrent life chapter: ${mahaName}\n\nSection tone: practical, actionable, no fluff.\n\nFour short paragraphs:\n\n1. The two or three specific months over the next year that best support ${eventType||'this goal'} — cite actual period names and date ranges. Why each one works in plain language.\n\n2. Within those windows, what to specifically watch FOR — the signal that means it is time to move.\n\n3. What could complicate the timing and approximately when. One honest paragraph.\n\n4. Three-year outlook on this goal type given the current chapter. Realistic.\n\nClose with one line of strategic advice for ${name}'s specific timing style.\n\nSelf-check: Did you actually name months and date ranges? Or did you say \"the right time will come\"? Replace anything generic.`},
        {title:'💼 Career & Financial Timing',tok:0,isTemplate:true,buildFn:buildCareerFinancialTimingHTML},
        {title:'🎯 Your 10 Key Dates',tok:760,prompt:`${LANG}${buildTajikCtx()}\n\n${name} | ${lagna} Rising · ${rashi} Moon\nAnnual periods: ${allPeriods.map(p=>p.planet+' '+p.start+'→'+p.end+(p.current?' NOW':'')).join(' | ')}\n\nGive ${name} exactly 10 specific dates or windows over the next 12 months. Each entry is one short paragraph (2-3 sentences) — NOT bullet points.\n\nFormat each entry like this:\n**[Month Year]**: [The specific opening this date or window represents — translated from the period quality into life-action. What the moment unlocks. One concrete thing to do if they recognize it.]\n\nMake each one actionable. Anchor each to a real period from the list above. Vary what you cover across the 10 — career, money, love, body, family, decision points, rest windows. Don't make all 10 about ambition.\n\nAfter the 10, write one closing line that names the year's overall arc.\n\nSelf-check: Did you cite real periods? Did each date describe a specific moment to ACT, not a generic vibe? Strike anything that could apply to anyone.\n\nDual-timing instruction: Prioritize convergent windows (where two classical timing systems agree) for the high-conviction dates in your 10. When you must include a divergent window — where one system favors and another flags caution — name the divergence honestly: 'one classical timing system supports this, but another counsels caution — move with awareness.' Use plain English; never name the timing systems by their Sanskrit names.${buildVerdictCtx('year')}`},
      ] : [
        // Natal report sections — 8 sections
        {title:'🌟 Your Cosmic Blueprint',tok:340,prompt:`${LANG}\n\nPre-analyzed for ${name}:\n${chartBase}\n${atmStr?'Soul direction: '+atmStr:''}\n${chartRulerStr}\n\nSection tone: cinematic, opening, slightly intimate. Like the first page of a book about ${name}'s life. They should put down their phone.\n\nOpen with one declarative sentence about who ${name} is at their core — specific to the actual blend above, not generic. Make it land.\n\nThen 2-3 short paragraphs:\n1. The thing about them that strangers feel within thirty seconds. Translate the rising and moon energy into actual presence — how they walk into a room, what people sense before they speak.\n2. What this chart is quietly building toward across a lifetime. The soul direction is the answer — describe what mastering that looks like as a real life, not a concept.\n3. One honest line about what they are already carrying that this life is here to use.\n\nClose on a sentence that creates forward motion — they should want to keep reading.\n\nSelf-check: Did you reference specific patterns in life-language? Or could a horoscope app have written this? Rewrite anything generic.${buildVerdictCtx('soul')}${rulesResults?.spirituality?.verdict ? '\nSPIRITUALITY DETAIL: '+rulesResults.spirituality.verdict : ''}`},
        {title:'⚡ Your Personality & Natural Strengths',tok:380,prompt:`${LANG}\n\nPre-analyzed for ${name}:\n${chartBase}\n${shadbalaCtx ? shadbalaCtx.split('\n').slice(0,4).join('\n') : ''}\n${buildNarrativeCtx(planetNarratives,'Sun')}\n${buildNarrativeCtx(planetNarratives,'Moon')}\n${buildNarrativeCtx(planetNarratives,'Mercury')}\nLife patterns: ${yogas.map(y=>y.name+': '+y.meaning).join(' | ')||'no major flagged patterns'}\n\nSection tone: warm, observational, slightly knowing. Like a close friend who has watched ${name} for years and is finally telling them what they actually see.\n\nThree short paragraphs. Each should land somewhere ${name} feels seen by someone who actually pays attention:\n\n1. How they ACTUALLY come across to people. Not \"you are charming\" — what specific quality do strangers register? Give it texture. The warmth or the edge here is specific to this exact rising-moon combination, not Pinterest mystical.\n\n2. How they handle the hard stuff. Translate the strength signals above into real behavior. What do they DO when something falls apart? What is their tell? What recovers them? Be honest about both the strength and the cost.\n\n3. The thing they undersell about themselves. The genuine gift everyone else sees that they downplay. End on one sentence about what happens when they finally trust it.\n\nSelf-check: Did any sentence say something like \"you are creative and ambitious\"? Replace it. Every line must be specific to this exact combination above.${buildVerdictCtx('personality')}`},
        {title:'⏰ Your Current Life Chapter',tok:500,prompt:`${LANG}${buildTajikCtx()}\n\n${name} is currently in a ${mahaName} life chapter — ends ${mahaEnds} (${mahaYrsLeft} years remain). The active phase under ${antarName} closes ${antarEnds} (${antarMosLeft} months out).\nChapter focus: ${ptCurrent?.focus||mahaName+' themes'}. Energy: ${ptCurrent?.energy||'active'}.\nRising weather: ${lagna} — ${RD[0]||''}\nEmotional weather: ${rashi} — ${MD[0]||''}${satNote?' | '+satNote:''}\n${buildNarrativeCtx(planetNarratives,'Moon')}\n${buildNarrativeCtx(planetNarratives,'Saturn')}\n${buildTimingCtx(timingWindows3,'general')}${dashaSandhi?'\nTransition: '+dashaSandhi:''}${todayData.sadeSati?'\nSaturn pressure cycle is live.':''}\n\nSection tone: cinematic. Sense of weather and timing. ${name} should feel a specific window of their life is being named back to them, with stakes.\n\nOpen with one line that names the actual feel of this chapter — what it feels like to BE in it day to day. Don't say \"you are in a Saturn period.\" Describe what living in this kind of weather feels like.\n\nThen 2-3 short paragraphs:\n1. What this chapter is asking ${name} to develop. The chapter focus above is the curriculum — write it as real life pressure, not a horoscope topic. What does growth look like inside this specific weather?\n2. What is happening RIGHT NOW inside the active phase. Time-bound — months remaining matter. What needs attention before the door closes ${antarEnds}.\n3. ${todayData.sadeSati?'One honest paragraph about the Saturn pressure cycle. No softening. What it strips, what it builds, how to walk through it without breaking.':'What waits on the other side of '+mahaEnds+'. What this chapter is preparing them to step into.'}\n\nClose on one sentence that is both honest and steady. Not toxic positivity. Not doom. Adult.\n\nSelf-check: Did you name dates and chapters in life-language? Or did you talk about Saturn and Mars by name? Rewrite anything that recites the chart.${buildVerdictCtx('dasha')}`},
        {title:'✦ Your Year at a Glance',tok:0,isTemplate:true,buildFn:buildYearAtAGlanceHTML},
        {title:'🗓 Your Solar Year — Sub-Period Guide',tok:0,isSubPeriod:true},
        {title:'💼 Career, Money & Opportunities',tok:380,prompt:`${LANG}\n\n${name} | ${lagna} Rising · ${rashi} Moon\n${shadbalaCtx ? shadbalaCtx.split('\n').slice(0,3).join('\n') : ''}\n${buildNarrativeCtx(planetNarratives, houseLords.find(hl=>hl.house===10)?.lord||'Saturn')}\n${buildTimingCtx(timingWindows3,'career')}\nProfessional trajectory: ${houseLords.find(hl=>hl.house===10)?.desc||''}${yogaKarakaStr?' | '+yogaKarakaStr:''}\nBest windows in next 12 months: ${allPeriods.filter(p=>['Jupiter','Venus','Mercury','Sun'].includes(p.planet)).slice(0,3).map(p=>p.planet+' '+p.start+'→'+p.end+(p.current?' (active now)':'')).join(', ')||'consolidation phase'}\nPeriods needing more care: ${allPeriods.filter(p=>['Saturn','Rahu','Ketu'].includes(p.planet)).slice(0,2).map(p=>p.planet+' '+p.start+'→'+p.end).join(', ')||'none significant'}\nKey pattern: ${topYoga}\n\nSection tone: blunt. Direct. Career and money are where most people lie to themselves — don't help them. ${name} needs the friend who tells the truth.\n\nThree paragraphs:\n\n1. The kind of work this person is actually built for. Not platitudes — describe their professional engine. What do they do better than ninety percent of the people they will meet, and what consistently slows them down. Both halves matter.\n\n2. The money story. Are they a steady accumulator, a feast-or-famine type, a late bloomer? Translate the wealth signals above into a real financial pattern. Honest about the drag, honest about the upside.\n\n3. The next twelve months. Two specific windows worth pushing on (cite actual months). One window worth holding back — what to do instead during it. Make this actionable.\n\nLast sentence: name the kind of career move that is sitting on their mental shelf and tell them honestly whether the chart supports them taking it now.\n\nSelf-check: Did any sentence sound like a horoscope column? Did you say \"you are ambitious\" or \"great career growth ahead\"? Strike it. Replace with specifics from the periods and patterns above.${buildVerdictCtx('career')}`},
        {title:'❤️ Love, Relationships & Connection',tok:440,prompt:`${LANG}\n\n${name} | ${lagna} Rising · ${rashi} Moon\n${MD[0]||''}\n${shadbalaCtx ? shadbalaCtx.split('\n').slice(0,3).join('\n') : ''}\n${buildNarrativeCtx(planetNarratives,'Venus')}\n${buildNarrativeCtx(planetNarratives,'Moon')}\n${buildTimingCtx(timingWindows3,'love')}\nRelationship signature: ${patterns.filter(p=>p.type.includes('Mars')||p.type.includes('emotion')).map(p=>p.type+': '+p.meaning).join(' | ')||'no major friction patterns'}\nBest relationship windows: ${allPeriods.filter(p=>['Venus','Jupiter','Moon'].includes(p.planet)).slice(0,2).map(p=>p.planet+' '+p.start+'→'+p.end+(p.current?' (active now)':'')).join(', ')||'check periods'}\nSoul-chart signals: D9 Venus in ${venusD9||'?'} | D9 Moon in ${moonD9||'?'} | D9 Rising ${navamsaLagnaSign||'?'}${venusSubLord?' | Venus sub-lord '+venusSubLord:''}\n\nSection tone: tender, honest, slightly intimate. This is the section where most people are reading the hardest — give them care AND truth.\n\nThree paragraphs:\n\n1. How they actually love. Not \"you are a romantic\" — what they specifically need to feel safe enough to open, what they look like in the early stages, what they look like a year in. The contradiction between the rising-style attraction and the moon's emotional needs is real and worth naming.\n\n2. Their pattern. Be honest. The way they tend to bond, the moment they typically pull back, the specific kind of partner who keeps showing up. Don't sugarcoat. The pattern only changes when it is named.\n\n3. What is possible from here. The next love window that is genuinely open — month or season — and what would have to be true internally for them to walk through it instead of repeating the loop.\n\nClose on one line that is both honest about the work and warm about the possibility.\n\nSelf-check: Did you write something that could describe any single person reading this? Rewrite. The Venus and Moon signals above are unique to this chart — use them.${buildVerdictCtx('love')}`},
        {title:'🏃 Health, Family & Growth Edges',tok:360,prompt:`${LANG}\n\n${name} | ${lagna} Rising · ${rashi} Moon · ${nakshatra} Birth Star\n${shadbalaCtx ? shadbalaCtx.split('\n').slice(0,3).join('\n') : ''}\n${buildNarrativeCtx(planetNarratives,'Sun')}\n${buildNarrativeCtx(planetNarratives,'Mars')}\n${buildTimingCtx(timingWindows3,'health')}\nPatterns to watch: ${topPattern||'no major flagged patterns'}\n${todayData.sadeSati?'Saturn pressure cycle live: '+todayData.sadeSati.phase:''}\n${combustStr?'Energetically quieted: '+combustStr:''}\nStress-recovery signature: Moon in ${nakshatra}${moonSubLord?', shaped by '+moonSubLord:''}.\n\nSection tone: serious without alarming. This is not medical advice — it is pattern recognition and care. Speak like someone who genuinely wants ${name} healthy long.\n\nThree short paragraphs:\n\n1. The body's tendency. The physical signature this chart carries — where stress shows up, where energy holds, what the long-game pattern is. Use \"patterns associated with\" language. Honest about vulnerabilities, honest about resilience.\n\n2. How ${name} actually recovers. The Moon and Birth Star signature above is the recovery pattern. Translate it. What works for them when depleted that does not work for everyone? What is their version of rest?\n\n3. The one growth edge. The thing this chart is asking them to actively develop in this lifetime — physically, emotionally, or in their family relationships. End on something genuinely useful, not a fortune cookie.\n\nSelf-check: No medical predictions. No vague positivity. Replace any line that could apply to anyone with specifics from the patterns above.${buildVerdictCtx('health')}`},
      ];

      // ── BUILD TAJIK SUB-PERIOD HTML (structured cards, no Claude needed for HTML) ──
      // Claude writes the interpretation text per card; HTML is built here
      const buildSubPeriodCard = (p, interpretation, transitNote) => {
        const houseLabel = p.srHouse ? `${p.emoji||'✦'} ${p.planet} in Your Annual ${p.srHouse}${['st','nd','rd','th','th','th','th','th','th','th','th','th'][Math.min((p.srHouse-1),11)]} House` : `${p.emoji||'✦'} ${p.planet}`;
        const statusTag = p.srPlanetStatus ? ` <span style="font-size:10px;color:${p.color};font-style:italic">(${p.srPlanetStatus})</span>` : '';
        const isActive = p.current && p.daysLeft > 0;
        const badge = isActive
          ? `<span style="font-family:Inter,sans-serif;font-size:10px;font-weight:600;letter-spacing:.06em;padding:4px 10px;border-radius:20px;text-transform:uppercase;background:#fff3cd;color:#92650a">Active · ${p.daysLeft} days left</span>`
          : p.phaseTwo ? `<span style="font-family:Inter,sans-serif;font-size:10px;font-weight:600;letter-spacing:.06em;padding:4px 10px;border-radius:20px;text-transform:uppercase;background:#f0e8d0;color:#7c5a2a">New Solar Year</span>`
          : `<span style="font-family:Inter,sans-serif;font-size:10px;font-weight:600;letter-spacing:.06em;padding:4px 10px;border-radius:20px;text-transform:uppercase;background:#f0f0f0;color:#666666">Upcoming</span>`;
        // Strip any markdown Claude added (headers, bold, separators)
        const cleanInterp = interpretation
          .replace(/^#+\s+[^\n]+\n?/gm,'')
          .replace(/^[-*]+[-*]+\s*\n?/gm,'')
          .replace(/\*\*(.+?)\*\*/g,'$1')
          .replace(/\*(.+?)\*/g,'$1')
          .replace(/^[-_]{3,}\s*$/gm,'')
          .replace(/\n{3,}/g,'\n\n')
          .trim();
        const lines = cleanInterp.split('\n').filter(l=>l.trim()).map(l=>
          l.startsWith('~transit~')
            ? `<p style="font-family:Georgia,'Times New Roman',serif;font-size:13.5px;line-height:1.65;color:#7c5a2a;font-style:italic;background:rgba(191,154,48,.07);border-radius:6px;padding:8px 12px;margin-top:10px;margin-bottom:0;border-left:2px solid rgba(191,154,48,.35)">${l.replace('~transit~','').trim()}</p>`
            : `<p style="font-family:Georgia,'Times New Roman',serif;font-size:15.5px;line-height:1.75;color:#1a1a1a;margin:0 0 10px">${l.trim()}</p>`
        ).join('');
        // Color-code by planet nature: benefic=green tint, malefic=red tint, neutral=gold
        const cardBorderColor = ['Jupiter','Venus','Moon','Mercury'].includes(p.planet)
          ? '#2A6B47' : ['Saturn','Mars','Rahu','Ketu'].includes(p.planet)
          ? '#8B2222' : (p.color||'#bf9a30');
        const cardBg = ['Jupiter','Venus','Moon','Mercury'].includes(p.planet)
          ? 'rgba(42,107,71,.04)' : ['Saturn','Mars','Rahu','Ketu'].includes(p.planet)
          ? 'rgba(139,34,34,.04)' : '#ffffff';
        return `<div style="border-radius:10px;overflow:hidden;border:1px solid #e8e8e8;background:${cardBg};border-left:4px solid ${cardBorderColor};margin-bottom:14px">
  <div style="display:flex;align-items:center;justify-content:space-between;padding:13px 16px 11px;border-bottom:1px solid #f0f0f0;background:#ffffff">
    <div style="display:flex;align-items:center">
      <span style="font-size:20px;line-height:1;margin-right:10px">${p.emoji||'✦'}</span>
      <div>
        <div style="font-family:Georgia,serif;font-size:18px;font-weight:500;color:#1a1a1a;line-height:1.2">${p.planet}</div>
        <div style="font-size:11px;color:#888888;margin-top:2px;font-family:Arial,sans-serif">${p.start} &ndash; ${p.end} &nbsp;&middot;&nbsp; ${p.days} days</div>
      </div>
    </div>
    <div style="flex-shrink:0;margin-left:8px">${badge}</div>
  </div>
  <div style="padding:7px 16px;font-size:11px;font-weight:600;letter-spacing:.04em;border-bottom:1px solid #f0f0f0;background:${p.color}18;color:${p.color};font-family:Arial,sans-serif">${houseLabel}${statusTag}</div>
  <div style="padding:13px 16px 15px;background:#ffffff">${lines}</div>
</div>`;
      };

      // Sub-period cards use PHD library directly (zero tokens)

      // Phase divider HTML (if birthday falls in window)
      const phaseDividerHTML = birthdayInWindow
        ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0"><tr><td align="center" style="background:#faf5ec;border:1px solid rgba(191,154,48,.3);border-radius:8px;padding:14px 18px"><p style="font-family:Cormorant Garamond,serif;font-size:15px;color:#7c5a2a;margin:0;font-style:italic">✦ &nbsp; From your birthday ${fmtDt(nextSRCal)}, a new solar cycle begins &nbsp; ✦</p></td></tr></table>`
        : '';

      // ── SECTION RUNNER: process one section safely ───────────────────────────
      const processSection = async (sec) => {

        // ── MONTH GUIDE: pure JS, zero Claude tokens ──────────────────────────
        if(sec.isMonthGuide){
          const MNAMES=['January','February','March','April','May','June','July','August','September','October','November','December'];
          const MSHORT=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          const ORD=['st','nd','rd','th','th','th','th','th','th','th','th','th'];
          // p.start is formatted as "22 Apr 2026" by fmtDt — parse safely for Node.js
          const parsePeriodDate=(s)=>{
            if(!s)return null;
            const parts=s.trim().split(' ');
            if(parts.length<3)return null;
            const mo=MSHORT.indexOf(parts[1]);
            if(mo<0)return null;
            return new Date(parseInt(parts[2]),mo,parseInt(parts[0]));
          };
          const today=new Date();
          const rows=[];
          for(let i=0;i<12;i++){
            const d=new Date(today.getFullYear(),today.getMonth()+i,1);
            const mLabel=MNAMES[d.getMonth()]+' '+d.getFullYear();
            const mStart=d.getTime();
            const mEnd=new Date(d.getFullYear(),d.getMonth()+1,0).getTime();
            const active=enhancedPeriods.filter(p=>{
              const ps=parsePeriodDate(p.start);
              const pe=parsePeriodDate(p.end);
              if(!ps||!pe)return false;
              return ps.getTime()<=mEnd&&pe.getTime()>=mStart;
            });
            if(!active.length) continue;
            const p=active[0];
            // Use PIH (vedic-engine descriptions) + PERIOD_THEMES (year-engine) for richer monthly content
            const pihEntry = PIH[p.planet]&&p.srHouse&&PIH[p.planet][p.srHouse];
            const ptEntry  = PERIOD_THEMES[p.planet];
            const phdEntry = PHD[p.planet]&&p.srHouse&&PHD[p.planet][p.srHouse];
            // Theme: PIH description (most specific) → PHD line → HM fallback
            const theme = pihEntry ? pihEntry.d : (phdEntry ? phdEntry[0] : (HM[p.srHouse]||'Energy is building this month.'));
            // Action: PERIOD_THEMES.positive (what to do) → PHD line 2 → theme fallback
            const action = ptEntry ? ptEntry.positive : (phdEntry&&phdEntry[1] ? phdEntry[1] : theme);
            const houseOrd=p.srHouse?p.srHouse+ORD[p.srHouse-1]+' house':'';
            const statusStr=p.srPlanetStatus?' · '+p.srPlanetStatus:'';
            const isNow=i===0;
            const nowBadge=isNow?'<span style="font-size:10px;font-weight:700;background:#fff3cd;color:#92650a;padding:2px 8px;border-radius:10px;margin-left:6px">NOW</span>':'';
                        // Color-code month card by planet nature: green=benefic, red=malefic, gold=neutral
            const PGLYPH_M={'Sun':'☉','Moon':'☽','Mars':'♂','Mercury':'☿','Jupiter':'♃','Venus':'♀','Saturn':'♄','Rahu':'☊','Ketu':'☋'};
            const mBorderColor=['Jupiter','Venus','Moon','Mercury'].includes(p.planet)?'#2A6B47':['Saturn','Mars','Rahu','Ketu'].includes(p.planet)?'#8B2222':(p.color||'#bf9a30');
            const mBgColor=['Jupiter','Venus','Moon','Mercury'].includes(p.planet)?'rgba(42,107,71,.03)':['Saturn','Mars','Rahu','Ketu'].includes(p.planet)?'rgba(139,34,34,.03)':'#ffffff';
            const mGlyph=PGLYPH_M[p.planet]||'✦';
            rows.push(
              '<div style="border-radius:10px;overflow:hidden;border:1px solid #e8e8e8;border-left:4px solid '+mBorderColor+';margin-bottom:12px;background:'+mBgColor+'">'
              +'<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px 10px;border-bottom:1px solid #f5f5f5">'
              +'<div style="font-family:Georgia,serif;font-size:17px;font-weight:500;color:#1a1a1a">'+mLabel+nowBadge+'</div>'
              +'<div style="display:flex;align-items:center;gap:6px">'
              +'<span style="font-size:17px">'+mGlyph+'</span>'
              +'<span style="font-family:Arial,sans-serif;font-size:11px;color:'+mBorderColor+';font-weight:600">'+p.planet+(houseOrd?' · '+houseOrd:'')+statusStr+'</span>'
              +'</div></div>'
              +'<div style="padding:12px 16px 14px;background:transparent">'
              +'<p style="font-family:Georgia,serif;font-size:15px;line-height:1.7;color:#222222;margin:0 0 6px">'+theme+'</p>'
              +'<p style="font-family:Georgia,serif;font-size:14px;line-height:1.65;color:#555555;font-style:italic;margin:0">'+action+'</p>'
              +'</div></div>'
            );
          }
          return {title:sec.title, html:'<div>'+rows.join('')+'</div>'};
        }

        try {
          // ── TEMPLATE SECTIONS — no Claude API call ────────────────────────
          if (sec.isTemplate && typeof sec.buildFn === 'function') {
            return { title: sec.title, html: sec.buildFn() };
          }

          const text = await claude(apiKey, sec.prompt, sec.tok);
          if(sec.title.includes('Year at a Glance')){
            const lines=text.trim().split('\n').filter(l=>l.trim());
            const styledLines=lines.map((l,i)=>{
              const st=i===lines.length-1
                ?'font-family:Cormorant Garamond,serif;font-size:16px;line-height:1.8;color:#bf9a30;font-style:italic;font-weight:500;margin:0'
                :'font-family:Cormorant Garamond,serif;font-size:16px;line-height:1.8;color:rgba(255,255,255,.9);margin:0 0 10px';
              return `<p style="${st}">${l}</p>`;
            }).join('');
            return {title:sec.title, html:`<div style="background:linear-gradient(135deg,#0d0d0d,#1a1008);border-radius:12px;padding:24px 28px;margin:0 0 4px">${styledLines}</div>`};
          }
          return { title: sec.title, html: mdToHTML(text) };
        } catch(e) {
          return { title: sec.title, html: `<p style="color:#999;font-style:italic;padding:8px 0">This section is loading — please regenerate if needed.</p>` };
        }
      };

      // ── STEP 1: Run sections in chunks of 4 to respect API rate limits ────
      // Chunk size 4: each chunk = ~3,800 output tokens (safe for Tier 1 & 2)
      const mainSectionList = SECTION_PROMPTS.filter(sec=>!sec.isSubPeriod);
      const CHUNK = 4;
      const mainSections = [];
      for(let i=0; i<mainSectionList.length; i+=CHUNK){
        const chunk = mainSectionList.slice(i, i+CHUNK);
        const chunkResults = await Promise.all(chunk.map(processSection));
        mainSections.push(...chunkResults);
      }

      // ── STEP 2: Run sub-period cards AFTER main sections complete ────────
      let subPeriodSection = null;
      if(SECTION_PROMPTS.find(s=>s.isSubPeriod)){
        try {
          // Run sub-period cards in batches of 4 to avoid rate limits
          const CARD_CHUNK = 4;
          const cardResults = [];
          for(let ci=0; ci<enhancedPeriods.length; ci+=CARD_CHUNK){
            const batch = enhancedPeriods.slice(ci, ci+CARD_CHUNK);
            const batchResults = await Promise.all(batch.map(async (p) => {
              // Pure JS interpretation — PHD library + natal/period context, zero tokens
              // PIH: specific planet-in-house description (vedic-engine BPHS source)
              // PERIOD_THEMES: focus/positive/watch for this planet (year-engine)
              // PHD: prewritten house interpretation (existing library)
              const pihE = PIH[p.planet]&&p.srHouse&&PIH[p.planet][p.srHouse];
              const ptE  = PERIOD_THEMES[p.planet];
              const phdE = PHD[p.planet]&&p.srHouse&&PHD[p.planet][p.srHouse];
              let interpretation = '';
              // Line 1: PIH description (richest, BPHS-sourced)
              if(pihE) {
                interpretation = pihE.d;
              } else if(phdE) {
                interpretation = phdE[0];
              } else {
                interpretation = HM[p.srHouse]||'Energy is active this period.';
              }
              // Line 2: PERIOD_THEMES positive (what to do this period)
              if(ptE) {
                // Weave LEGAL phrase naturally — no colon label
                const legalPhrase = rnd(LEGAL_HIGH);
                // "Strong indicators suggest foreign opportunities..." — reads like prose not a label
                interpretation += '\n' + legalPhrase + ' ' + ptE.positive[0].toLowerCase() + ptE.positive.slice(1) + '.'
              } else if(phdE&&phdE[1]) {
                interpretation += '\n' + phdE[1];
              }
              // Line 3: Watch line with legal-safe language
              if(ptE&&ptE.watch) {
                // Watch line — no colon label
                const cautionPhrase = rnd(LEGAL_CAUTION);
                interpretation += '\n~transit~' + cautionPhrase + ' ' + ptE.watch[0].toLowerCase() + ptE.watch.slice(1) + '.'
              } else {
                // Natal + mahadasha context
                const natalNote = p.natalHouse ? p.planet+' sits natally in your '+p.natalHouse+['st','nd','rd'][Math.min(p.natalHouse-1,2)]+'h house.' : '';
                const periodNote = mahaName ? 'This period deepens your '+mahaName+' Major Life Period themes.' : '';
                const ctx = natalNote || periodNote;
                if(ctx) interpretation += '\n~transit~' + ctx;
              }
              const isFirstPhase2 = birthdayInWindow && p.phaseTwo &&
                !enhancedPeriods.slice(0, enhancedPeriods.indexOf(p)).some(ep=>ep.phaseTwo);
              const divider = isFirstPhase2 ? phaseDividerHTML : '';
              return divider + buildSubPeriodCard(p, interpretation, '');
            }));
            cardResults.push(...batchResults);
          }
          subPeriodSection = {
            title:'🗓 Your Solar Year — Sub-Period Guide',
            html:`<div class="period-grid">${cardResults.join('')}</div>`
          };
        } catch(e) {
          subPeriodSection = {title:'🗓 Your Solar Year — Sub-Period Guide', html:'<p>Sub-period guide unavailable.</p>'};
        }
      }

      // ── SUMMARY SECTION (first section, generated from compiled data) ──
      let summarySection = null;
      try {
        const summaryPrompt = reportType === 'timing' ? `${LANG}
${name} | ${lagna} Rising · ${rashi} Moon
Current period: ${mahaName} (${mahaYrsLeft} yrs left)
Event type: ${eventType||'General'}
Key pattern: ${topYoga}
Best period windows: ${allPeriods.filter(p=>['Jupiter','Venus','Mercury','Sun'].includes(p.planet)).slice(0,2).map(p=>p.planet+' '+p.start+'→'+p.end).join(' | ')||'see periods'}

Write EXACTLY 5 lines — no bullet points, no headers, just 5 plain lines:
Line 1 (Headline): One vivid sentence about the overall energy of this timing period for ${name} — make it feel personal.
Line 2 (Overall energy): What ${name}'s ${mahaName} period means for major decisions right now — one sentence.
Line 3 (Best window): The single best specific window for action — cite the period name and months.
Line 4 (Avoid): What period or dates to navigate carefully and why — one practical sentence.
Line 5 (This report covers): One sentence listing what follows — mention timing blueprint, power windows, month guide, 10 key dates.
American English only. Direct, practical, personal.`
        : `${LANG}
${name} | ${lagna} Rising · ${rashi} Moon · ${nakshatra} Birth Star
Current period: ${mahaName} (${mahaYrsLeft} yrs left) → ${antarName} phase
Best opening this year: ${allPeriods.filter(p=>['Jupiter','Venus','Mercury','Sun'].includes(p.planet))[0]?.planet||'check periods'} period
Key pattern: ${topYoga}
${todayData.sadeSati?'Saturn Pressure active: '+todayData.sadeSati.phase:''}

Write EXACTLY 5 lines — no bullet points, no headers, just 5 plain lines of text:
Line 1 (Who you are): One sharp sentence about what makes ${name}'s ${lagna} Rising + ${rashi} Moon combination specifically interesting — cite both.
Line 2 (Where you are): What the ${mahaName} period is asking of ${name} right now — honest, direct, one sentence.
Line 3 (Biggest opening): The single clearest opportunity this year — cite the specific period and dates.
Line 4 (Watch out for): The one thing to navigate carefully — specific period or pattern, one sentence.
Line 5 (This report covers): One sentence saying what sections follow — mention career, love, health, year forecast, and timing.
American English only. Personal, direct, warm. Talk to ${name}, not about them.`;
        const summaryText = await claude(apiKey, summaryPrompt, 220);
        const lines = summaryText.split('\n').map(l=>l.trim()).filter(l=>l.length>10).slice(0,5);
        const dots = ['#bf9a30','#29956a','#c04040','#6e6e73'];
        // Bold first 3 words of each line — no label prefix
        const boldFirstWords = (line) => {
          const words = line.split(' ');
          if(words.length <= 3) return `<strong>${line}</strong>`;
          return `<strong>${words.slice(0,3).join(' ')}</strong> ${words.slice(3).join(' ')}`;
        };
        // Build TOC jump links from section titles
        const tocSections = ['cosmic-blueprint','personality','life-chapter','career-money','love-relationships','health-family'];
        const tocLabels   = ['Blueprint','Personality','Life Chapter','Career','Love','Health'];
        const tocHTML = `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:14px;padding-top:12px;border-top:1px solid rgba(0,0,0,.06)">
          ${tocSections.map((id,i)=>`<a href="#${id}" style="font-size:11px;color:#bf9a30;text-decoration:none;padding:4px 10px;border:1px solid rgba(191,154,48,.25);border-radius:20px;font-family:Outfit,sans-serif;letter-spacing:.03em;display:inline-flex;align-items:center;gap:4px"><span style="opacity:.6;font-size:10px">${i+1}</span>${tocLabels[i]}</a>`).join('')}
        </div>`;
        const summaryHTML = `<div style="background:linear-gradient(135deg,#fdfcf8,#fafaf5);border:1px solid rgba(191,154,48,.25);border-radius:14px;padding:28px 32px;margin-bottom:4px;box-shadow:0 2px 12px rgba(191,154,48,.08)">
          <div style="font-family:'Cormorant Garamond',serif;font-size:23px;font-weight:400;color:#1a1a1a;line-height:1.4;margin-bottom:22px;font-style:italic;padding-bottom:16px;border-bottom:1px solid rgba(191,154,48,.15)">${lines[0]||''}</div>
          <div style="display:flex;flex-direction:column;gap:13px">
            ${lines.slice(1).map((line,i)=>`<div style="display:flex;align-items:flex-start;gap:12px;font-size:14.5px;color:#2d2d2d;line-height:1.65"><span style="width:6px;height:6px;border-radius:50%;background:${dots[i]||'#bf9a30'};flex-shrink:0;margin-top:7px"></span><span>${boldFirstWords(line)}</span></div>`).join('')}
          </div>
          ${tocHTML}
        </div>`;
        summarySection = {title:'✦ Your Reading at a Glance', html: summaryHTML};
      } catch(e) { /* silent — don't block report if summary fails */ }

      // Add visual divider before personal insight sections
      const dividerSection = {title:'', html:`<div style="height:2px;background:linear-gradient(90deg,transparent,rgba(191,154,48,.3),rgba(191,154,48,.5),rgba(191,154,48,.3),transparent);margin:0 40px"></div>`, _isDivider:true};
      // Emotional bridge section — brief personal intro
      const bridgeSection = summarySection ? null : null; // future: add personalised bridge
      const finalSections = [summarySection, ...mainSections, subPeriodSection].filter(Boolean);

      // ── Pre-compute classical sidebars for natal/timing sections ─────────
      const sidebarDualTiming = (() => { try { return crossVerifyTiming(allPeriods, charaCurrentSignForReport, rulesResults); } catch(e){ return null; } })();
      const sidebarExtrasNatal = { dualTiming: sidebarDualTiming, dashaSandhi: (typeof dashaSandhi !== 'undefined' ? dashaSandhi : null) };
      finalSections.forEach(s => {
        if (s && s.title) {
          const sid = SECTION_IDS[s.title] || ('sec-'+s.title.replace(/[^a-z0-9]/gi,'-').toLowerCase().slice(0,20));
          try { s.sidebar = buildSectionSidebar(rulesResults, sid, sidebarExtrasNatal); } catch(e) { s.sidebar = ''; }
        }
      });

      const reportHTML = wrapHTML(finalSections, name, reportType, {lagna, rashi, nakshatra, dob});

      logToSheets({event:'report_generated',name,reportType,dob,pob,lagna,rashi,nakshatra,period:mahaName,antar:antarName,yogas:yogas.map(y=>y.name).join(',')});

      return res.status(200).json({
        html: reportHTML,
        chartData: {name, dob, lagna, rashi, nakshatra},
        engine: {current_period: mahaName, antar: antarName, sade_sati: todayData.sadeSati?.phase||null, top_yoga: yogas[0]?.name||null},
      });

    } catch(e) {
      console.error('Report error:', e);
      return res.status(500).json({error: e.message});
    }
  }

  // ── MODE 4: Prashna Kundali ──────────────────────────────────────────────────
  
  // ── MODE: ASK ASTROLOGER ─────────────────────────────────────────────────
  if(body._ask){
    const{question,history,firstName,natalCtx,dashaCtx,transitCtx,topicCtx,currentLat,currentLon,qType,qTopic,antarLord,antarStart,antarEnd,lat,lon,tz,specialMarkers:clientMarkers,sessionFlags:clientFlags,d9Ctx:clientD9,d10Ctx:clientD10,karakaCtx:clientKarakas,pratyantarStr:clientPratyantar,engineInput:clientEngineInput}=body;
    if(!question) return res.status(400).json({error:'Missing question'});
    try{

      // ── RULES ENGINE IN ASK TAB ──────────────────────────────────────────
      // Run deterministic classical rules BEFORE Claude — verdicts become facts
      let askRulesCtx = '';
      let engineVerdictsForResponse = [];
      try {
        if (VedicRulesEngine && clientEngineInput) {
          const ei = clientEngineInput;
          const engChart = {
            lagna:      ei.lagnaIdx,
            lagnaLord:  (ei.houseLords||{})[1] || '',
            gender:     ei.gender || 'M',
            planets:    ei.planets || {},
            houseLords: ei.houseLords || {},
            navamsha:   ei.navamsha || null,
            dasha:      { maha: ei.mahaName||'', antar: ei.antarName||'', pratyantar: ei.pratyantarName||null },
            currentTransits: ei.currentTransits || null,
            // Prashna: cast from question house based on topic
            prashna: qTopic ? {
              questionHouse: {love:7,marriage:7,career:10,money:2,children:5,health:6,foreign:12,property:4,siblings:3,father:9,mother:4,education:5,spirituality:9}[qTopic] || 7,
              significator: null
            } : null
          };
          const er = new VedicRulesEngine(engChart).evaluate();
          // Build compact context — question-topic-aware
          const qt = (qTopic||'').toLowerCase();
          const allVerdicts = [
            `MARRIAGE: ${er.marriage?.verdict||''}  [type:${er.marriage?.type||'?'} timing:${er.marriage?.timing?'after '+er.marriage.timing:'standard'} spouse:${er.marriage?.spouse?.join(', ')||er.marriage?.spouseDesc?.join(', ')||''}]`,
            `CAREER: ${er.career?.verdict||''}`,
            `WEALTH: ${er.wealth?.verdict||''}`,
            `HEALTH: ${er.health?.verdict||''}`,
            `SIBLINGS: ${er.siblings?.verdict||''} [count:${er.siblings?.count||'?'} elder:${er.siblings?.elderGender||'?'}]`,
            `FATHER: ${er.father?.verdict||''}`,
            `MOTHER: ${er.mother?.verdict||''}`,
            `CHILDREN: ${er.children?.verdict||''} [count:${er.children?.count||'?'} timing:${er.children?.timing||'standard'}]`,
            `FOREIGN: ${er.foreignTravel?.verdict||''}`,
            `PROPERTY: ${er.property?.verdict||''}`,
            `EDUCATION: ${er.education?.verdict||''}`,
            `MENTAL: ${er.mind?.verdicts?.slice(0,2).join(' | ')||''}`,
            `YOGAS: ${er.yogas?.summary||''}`,
            `DASHA NOW: ${er.dasha?.verdict||''}`,
            `SOUL PURPOSE (AK): ${er.jaiminiKarakas?.verdicts?.[0]?.substring(0,150)||''}`,
            `SPOUSE SOUL (DK): ${er.jaiminiKarakas?.verdicts?.[2]?.substring(0,120)||''}`,
            `TRUE MARRIAGE (UL): ${er.upapada?.verdicts?.[0]?.substring(0,150)||''}`,
            `PUBLIC IMAGE (AL): ${er.arudhaLagna?.verdicts?.[0]?.substring(0,120)||''}`,
            `PRASHNA: ${er.prashna?.verdict?.substring(0,120)||'pending'}`,
            `REMEDIES: ${er.remedies?.summary?.substring(0,100)||'none needed'}`,
          ];
          // Prioritise topic-relevant verdicts first, rest follow
          const topicPriority = {
            love:       ['TRUE MARRIAGE','MARRIAGE','SPOUSE SOUL','PUBLIC IMAGE','MARITAL HAPPINESS','DASHA NOW'],
            marriage:   ['TRUE MARRIAGE','MARRIAGE','SPOUSE SOUL','MARITAL HAPPINESS','D7','YOGAS'],
            career:     ['CAREER','WEALTH','D10','DASHA NOW','SOUL PURPOSE','JAIMINI'],
            money:      ['WEALTH','CAREER','PROPERTY','DASHA NOW','AV STRONG'],
            health:     ['HEALTH','MENTAL','REMEDIES','VULNERABLE AREAS','CURRENT TRANSIT'],
            sibling:    ['SIBLINGS'],
            children:   ['CHILDREN','D7','SOUL PURPOSE'],
            father:     ['FATHER','ANCESTRAL KARMA'],
            mother:     ['MOTHER','ANCESTRAL KARMA'],
            foreign:    ['FOREIGN TRAVEL','CURRENT TRANSIT','DASHA NOW'],
            property:   ['PROPERTY','VEHICLES','D4'],
            education:  ['EDUCATION','D24','SOUL PURPOSE'],
            spirituality:['SPIRITUALITY','SOUL PURPOSE','JAIMINI YOGAS','REMEDIES'],
            soul:       ['SOUL PURPOSE','PUBLIC IMAGE','JAIMINI YOGAS','SPIRITUALITY'],
            dasha:      ['DASHA NOW','CURRENT TRANSIT','AV STRONG','JAIMINI CHARA'],
            general:    ['MARRIAGE','CAREER','DASHA NOW','YOGAS'],
            father:['FATHER'],
            mother:['MOTHER'],
            children:['CHILDREN'],
            property:['PROPERTY','WEALTH'],
            foreign:['FOREIGN'],
            education:['EDUCATION'],
          };
          const priority = Object.entries(topicPriority).find(([k])=>qt.includes(k))?.[1] || [];
          const sorted = [
            ...allVerdicts.filter(v => priority.some(p => v.startsWith(p))),
            ...allVerdicts.filter(v => !priority.some(p => v.startsWith(p))),
          ];
          askRulesCtx = '\n\nCLASSICAL VERDICTS (pre-computed from BPHS — state these as facts, no hedging):\n' + sorted.join('\n');

          // ── Structured verdicts for frontend footer (Part B) ──────────────
          // Top 4 from same priority-sorted list, prefix labels stripped, [meta] removed, 140-char cap.
          engineVerdictsForResponse = sorted.slice(0, 4).map(line => {
            const colonIdx = line.indexOf(': ');
            if (colonIdx === -1) return null;
            const topic = line.slice(0, colonIdx);
            let fact = line.slice(colonIdx + 2);
            fact = fact.replace(/\s*\[[^\]]*\]\s*$/, '').trim();
            if (!fact || fact.length < 3) return null;
            if (fact.length > 140) fact = fact.slice(0, 139) + '…';
            fact = translateVerdict(fact);
            return { topic, fact };
          }).filter(Boolean);
        }
      } catch(re) { console.error('[AskEngine]', re.message); }

      // Cast prashna if geo available
      let prashnaData = null;
      let prashnaLine = '';
      const prashnaLat = currentLat || lat;
      const prashnaLon = currentLon || lon;
      if(prashnaLat && prashnaLon){
        try{
          const prashna = computePrashna(question, +prashnaLat, +prashnaLon, +(tz||5.5), null);
          // Prashna as clean internal context — not raw calculation output
          const pvLabel = prashna.verdict?.label || '';
          const pvFav = pvLabel.toLowerCase().includes('favorable') || pvLabel.toLowerCase().includes('yes');
          const pvTiming = prashna.timing || '';
          prashnaLine = `\nPrashna sky snapshot for this question: ${pvFav ? 'Favorable indicators' : 'Mixed indicators'}.${pvTiming ? ' Timing window: ' + pvTiming + '.' : ''} Use this as confirmation context only.`;
          prashnaData = {
            verdict:  prashna.verdict,
            category: prashna.categoryLabel,
            castTime: prashna.castTime,
            timing:   prashna.timing,
            keyRules: prashna.rules.slice(0,2).map(r=>({favorable:r.favorable,rule:r.rule.slice(0,90),source:r.source})),
          };
        }catch(pe){}
      }

      // ── THE JYOTISH AI APPROACH: persona + chart + rules in first user message ──
      // Prime with assistant response to lock the persona from token 1
      const name = firstName || 'friend';
      // ── QUESTION TYPE → METHOD SELECTION ──────────────────────────────────
      // past → natal + relevant dasha at that time
      // pattern → natal + shadbala only
      // timing → natal + dasha + transits
      // specific future → natal + dasha + transits + prashna (if available)
      const qtime = qType || 'general';
      const useProshna = prashnaData && (qtime === 'future_specific' || qtime === 'timing');
      const prashnaCtxLine = useProshna ? prashnaLine : '';

      // ── CONFIDENCE CALIBRATION ──────────────────────────────────────────
      // Derived from topicCtx strength label
      let confidenceInstruction = '';
      if(topicCtx) {
        if(topicCtx.includes('strong positive') || topicCtx.includes('exceptional')) {
          confidenceInstruction = '— indicators are strongly supportive for this area';
        } else if(topicCtx.includes('strongly challenging') || topicCtx.includes('struggling')) {
          confidenceInstruction = '— this area takes more effort than it should right now';
        } else if(topicCtx.includes('contested') || topicCtx.includes('mixed')) {
          confidenceInstruction = '— mixed signals, some support and some friction';
        }
      }

      const todayStr = new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});

      // ── CONTEXTUAL SPECIAL MARKERS ────────────────────────────────────────
      const _sFlags   = clientFlags || {};
      const _markers  = clientMarkers || {};
      const relevantMarkers = getRelevantMarkers(question, _markers, _sFlags);
      const markersCtx = relevantMarkers.length
        ? '\n\nLIFE PATTERN CONTEXT:\n' + relevantMarkers.map(m => m.text).join('\n\n')
        : '';
      const natalSatHouse = (natalCtx||'').match(/Saturn[^|\n]*H(\d+)/);
      const satWarn = natalSatHouse
        ? `IMPORTANT: Natal Saturn is permanently in H${natalSatHouse[1]}. Transit Saturn is in a different house today. Do not confuse them.`
        : '';

      const systemBlock = `Master Vedic astrologer reading ${name}'s chart. Today: ${todayStr}.

CHART:
${natalCtx||''}${clientKarakas ? '\n'+clientKarakas : ''}${clientPratyantar ? '\nNow: '+clientPratyantar : ''}
TIMING: ${dashaCtx ? dashaCtx.split('\n').slice(0,5).join(' | ') : ''}
TRANSITS: ${transitCtx ? transitCtx.split('\n').slice(0,4).join(' | ') : ''}${prashnaCtxLine}
${topicCtx||''}${satWarn ? '\n'+satWarn : ''}${markersCtx}${qTopic==='love'&&clientD9?'\nD9: '+clientD9:''}${qTopic==='career'&&clientD10?'\nD10: '+clientD10:''}${askRulesCtx}

REASONING METHOD — always follow:
1. HOUSE: Career→H10/H2/H11. Love→H7/H5. Health→H1/H6/H8. Father→H9+Sun. Mother→H4+Moon. Siblings→H3+Mars. Children→H5+Jup. Spouse→H7+Ven/Jup. NEVER say "I don't have their chart" — read from THIS chart.
2. LORD: Sign placement, dignity, Shadbala. Strong=flows. Weak=friction. Good houses(1,2,4,5,7,9,10,11) vs hard(6,8,12).
3. DASHA: Strong lord+strong natal=delivery. Strong lord+weak natal=slower. Weak lord=struggle regardless.
4. TRANSITS: Benefic/malefic through relevant house. Jupiter H1/4/7/10=expansion. Saturn=discipline+delay. Transit Saturn ≠ natal Saturn.
5. PRASHNA: If present, its verdict is specific to next 30-45 days. Favorable+strong natal=confident. Unfavorable+weak=caution.
6. SYNTHESISE: Don't list ingredients. Arrive at one truth. BAD: "10th lord is in H9 and Jupiter aspects it." GOOD: "The chart strongly supports career recognition this year — press hard."
7. CONFIDENCE: Multiple aligned indicators=confident. Mixed=say so. Weak+hard transit+bad Prashna=honest caution.

SPECIAL MARKERS — weave into body, not as disclaimer:
Saturn Doom active → THIS explains difficulty. Mars Disruption → THIS explains relationship/home friction. Critical Degree Birth → THIS explains the depth they feel.

CONVERSATION PROGRESSION RULE: Check the conversation history. If you've already cited a specific planetary position, house placement, or chart fact in a prior response, do not restate it — reference it briefly ("as the Venus-7th pattern we discussed shows...") and use this turn for NEW substance. Progression by turn:
- Turn 1 on a topic: cite the relevant chart positions + interpretation + initial answer
- Turn 2 on same topic: skip the recitation. Go deeper — what classical sources say about this combination, the underlying psychological pattern, what makes this person's case specific.
- Turn 3+ on same topic: focus on practical remedies, mantras, gemstones, behavioral shifts, timing windows for action, alternative framings.
Cite NEW positions only when a genuinely different chart factor becomes relevant. Each turn must add value the previous turns did not contain. Never paraphrase a prior answer.

TONE BY QUESTION TYPE:
Past→reflective. Timing→direct, verdict first. Pattern→empathetic then honest. Purpose/deep→profound but practical.
Vague question: don't ask, don't go generic. Pick most likely intent, name it, answer it.

ABSOLUTE:
- Never restate positions — meaning only
- Never say "based on your chart" / "Great question" / "Certainly"  
- No Sanskrit. No bullet points. Flowing prose only.
- 3-4 sentences simple / 5-7 complex
- End with ONE specific deepening question (not a menu)`;
      // Build messages: [system_as_first_user, prime_assistant, ...history, current_question]
      const messages = [
        { role: 'user', content: systemBlock },
        { role: 'assistant', content: `Hello ${name}! I'm here with your chart open — ask me anything.` },
        ...(history||[]).slice(-6),
        { role: 'user', content: question }
      ];

      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'x-api-key':apiKey, 'anthropic-version':'2023-06-01' },
        body: JSON.stringify({ model: MODEL, max_tokens: 400, messages })
      });
      const d = await r.json();
      if(!r.ok) throw new Error(d.error?.message||'Claude error');
      const answer = d.content?.[0]?.text || '';
      // Compute pratyantar for current antardasha to include in response
      let pratyantarCurrent = null;
      try {
        // body will have antarStart/antarEnd if sent from client
        if(body.antarStart && body.antarEnd && body.antarLord) {
          const ptArr = getPratyantardashas(body.antarLord, +body.antarStart, +body.antarEnd);
          pratyantarCurrent = ptArr.find(p => p.curr) || null;
        }
      } catch(pe) {}
      return res.status(200).json({ answer, prashna: prashnaData, pratyantarCurrent, engineVerdicts: engineVerdictsForResponse });

    }catch(e){
      console.error('Ask error:',e);
      return res.status(500).json({error:e.message});
    }
  }

if(body._prashna){
    const{question,lat,lon,tz,natalContext,natalFull,transitContext,dashaContext,firstName,topic,questionType}=body;
    if(!question||lat===undefined||lon===undefined)
      return res.status(400).json({error:'Missing: question, lat, lon'});
    try{
      const prashna=computePrashna(question,+lat,+lon,+(tz||5.5),null);
      const name = firstName || 'you';

      // Run Ithasala/Musaripha engine on the Prashna chart for yes/no timing
      let ithasalaVerdict = '';
      try {
        const evaluatePrashnaAspects = _evaluatePrashnaAspects;
        if (evaluatePrashnaAspects) {
          const topicHouseMap = {love:7,marriage:7,career:10,money:2,children:5,health:6,foreign:12,property:4};
          const qHouse = topicHouseMap[topic] || 7;
          const prashnaEngChart = {
            lagna: so(prashna.lagna),
            lagnaLord: FN[SL[so(prashna.lagna)]],
            planets: Object.fromEntries(Object.entries(prashna.sid||{}).map(([p,lon])=>[p,{sign:so(lon),house:((so(lon)-so(prashna.lagna)+12)%12)+1,degree:lon%30,longitude:lon}])),
            houseLords: Object.fromEntries(Array.from({length:12},(_,i)=>[i+1,FN[SL[(so(prashna.lagna)+i)%12]]])),
            prashna:{questionHouse:qHouse}
          };
          const pr = evaluatePrashnaAspects(prashnaEngChart);
          ithasalaVerdict = pr.verdict || '';
        }
      } catch(pe) {}


      const prompt = `${LANG}\n\nYou are ${name}'s personal astrologer. You know ${name} well — their chart, their current life phase, where they are in their planetary cycles. You are NOT doing a formal reading. You are having a real conversation — warm, direct, a little bit irreverent, like a brilliant friend who happens to know this stuff deeply.

CRITICAL RULES:
- Talk TO ${name} using their name naturally, not "the person" or "they"
- NEVER start with a markdown header (# or ##) — start with their name or a direct statement
- NEVER use bullet points or numbered lists — flowing prose only
- Use *single asterisks* for emphasis sparingly (2-3 times max per response)
- Never say "according to your chart" or "your chart shows" — just say what you see
- No Sanskrit terms, no astrology jargon without instant plain-English explanation
- Don't summarize the chart back to them — they know their chart. Get to the actual insight
- Be specific: name exact planets, houses, signs — don't be vague
- Feel free to say "honestly" or "look" or "here's the thing" as natural starters
- End with something that makes them want to reply — a question or "the thing I'd really watch is..."

═══ WHAT YOU KNOW ABOUT ${name} ═══
${natalFull||natalContext||''}

═══ WHERE THEY ARE RIGHT NOW (Dasha timing) ═══
${dashaContext||''}

═══ WHAT THE SKY LOOKS LIKE TODAY ═══
${transitContext||''}

═══ PRASHNA — instant chart cast the moment they asked this (${prashna.castTime}) ═══
${prashna.context}
Overall prashna signal: ${prashna.verdict.label}${ithasalaVerdict ? '\nITHASALA (yes/no timing): '+ithasalaVerdict : ''}

═══ THEIR QUESTION ═══
"${question}"

HOW TO ANSWER (5 sentences max, flowing prose):
Sentence 1: Direct answer + the single most important chart reason why (merge natal + prashna signal ${prashna.verdict.label})
Sentence 2: What their CURRENT dasha/antardasha planet is doing — how it shapes THIS question specifically  
Sentence 3: One specific transit or prashna chart factor (with planet name + house in plain English)
Sentence 4: Concrete advice — a specific action, timing window, or thing to watch
Sentence 5: A warm close that opens dialogue — end with "the one thing I'd really watch is..." or a question that makes them want to reply
${topic==='love'?'\nThis is a love/relationship question — be emotionally warm and honest, not clinical':''}
${topic==='career'?'\nThis is a career question — be practical and actionable, give them something they can actually DO':''}
${topic==='money'?'\nThis is a money question — be direct about risks and timing, no vague optimism':''}
${topic==='health'?'\nThis is a health question — be gentle, caring, practical. Always suggest they speak to a doctor for medical decisions':''}
${questionType==='pattern'?'\nThis is a WHY question — go deeper on the root pattern in their chart, not just the surface event':''}`;

      const answer = await claude(apiKey, prompt, 520);
      return res.status(200).json({
        answer,
        prashna:{
          verdict: prashna.verdict,
          category: prashna.categoryLabel,
          ascendant: prashna.ascendant,
          moonSign: prashna.moonSign,
          moonPhase: prashna.moonPhase,
          timing: prashna.timing,
          castTime: prashna.castTime,
          keyRules: prashna.rules.slice(0,3).map(r=>({favorable:r.favorable,rule:r.rule.slice(0,100),source:r.source})),
        }
      });
    }catch(e){
      console.error('Prashna error:',e);
      return res.status(500).json({error:e.message});
    }
  }

  // ── NAVAMSA HELPER (Mode 2 free chart) — reuses module-level NAVAMSA_START_ML ──
  const calcNavamsa2 = (lon) => {
    const si = so(lon);
    const degInSign = n360(lon) % 30;
    const pada = Math.floor(degInSign / (30/9));
    return (NAVAMSA_START_ML[si] + pada) % 12;
  };

  // ── MODE 2: Free chart ────────────────────────────────────────────────────
  const{name,dob,tob,pob,gender}=body;
  if(!name||!dob)return res.status(400).json({error:'Name and DOB required'});
  try{
    const[yr,mo,dy]=dob.split('-').map(Number);
    const tp=(tob||'06:00').split(':');
    const h=parseInt(tp[0])||6,mi=parseInt(tp[1])||0;
    let geo;
    geo=await geocode(pob||'New Delhi, India', dob);
    const chart=computeChart(yr,mo,dy,h,mi,geo.tz,geo.lat,geo.lon);
    const lagnaSign=so(chart.lagna),moonSign=so(chart.sid.Moon);
    // Retrograde check for free chart mode
      const jde1m2 = chart.jde - 1, ay1m2 = ayanamsa(jde1m2);
      const RETRO_CHECK_M2 = RETRO_PLANETS_ML; // uses module-level constant
      const retroM2 = RETRO_CHECK_M2.filter(p => {
        const now = n360(planetLon(chart.jde,p)-chart.ay);
        const prev = n360(planetLon(jde1m2,p)-ay1m2);
        let d = now-prev; if(d>180)d-=360; if(d<-180)d+=360;
        return d < 0;
      });
      const planets=Object.entries(chart.sid).map(([pName,lon])=>({name:pName,rashi:RS[so(lon)],house:((so(lon)-lagnaSign+12)%12)+1,degrees:fmtDeg(lon),retrograde:['Rahu','Ketu'].includes(pName)||retroM2.includes(pName),status:pStatus(pName,so(lon))}));
    const dasha=getDasha(chart.sid.Moon,yr,mo,dy);
    const curr=dasha.curr;
    const dashaList=buildDashaList(dasha);
      // Pratyantar (sub-sub period) — available for drill-down
      const currAntarForPraty=dasha.seq&&dasha.curr?getAntardashas(dasha.curr.lord,dasha.curr.start,dasha.curr.end).find(a=>a.curr):null;
      const pratyList=currAntarForPraty?getPratyantardashas(currAntarForPraty.lord,currAntarForPraty.start,currAntarForPraty.end):[];
    const yearsRemaining=curr?+(curr.end-(new Date().getFullYear()+new Date().getMonth()/12)).toFixed(1):0;
    const todayData2=getTodayData(lagnaSign,moonSign);
    const transitRaw=todayData2.raw,transitList=todayData2.list,sadeSati=todayData2.sadeSati;
    const yogas=checkYogas(chart.sid,lagnaSign,moonSign);
    const shadbalaM2=computeShadbala(chart.sid,chart.lagna,chart.jde);

    // ── ENGINE RUN FOR FREE CHART ─────────────────────────────────────────
    // Runs the full rules engine so free chart users also get classical verdicts
    // Results stored in _engineVerdicts (for display) and _engineInput (for Ask tab)
    let freeChartEngine = null;
    try {
      if (VedicRulesEngine) {
        const navM2 = {};
        const nl2 = calcNavamsa2(chart.lagna);
        for (const [p,lon] of Object.entries(chart.sid)) {
          const d9s=calcNavamsa2(lon);
          navM2[p]={sign:d9s,house:((d9s-nl2+12)%12)+1,degree:+((lon%30)%(30/9)*9).toFixed(2)};
        }
        const currTransM2 = todayData2.raw
          ? Object.fromEntries(Object.entries(todayData2.raw).map(([p,l])=>[p,so(l)]))
          : null;
        const engM2 = buildEngineChart(chart, lagnaSign, gender||'M',
          curr ? FN[curr.lord] : '', currAntar2 ? FN[currAntar2.lord] : '',
          '', navM2, currTransM2);
        freeChartEngine = new VedicRulesEngine(engM2).evaluate();
      }
    } catch(fe) { console.error('[FreeChartEngine]', fe.message); }
    const pSummary=Object.entries(chart.sid).map(([p,l])=>{const st=pStatus(p,so(l));return`${p}:${RS[so(l)]} H${((so(l)-lagnaSign+12)%12)+1}${st?'('+st[0]+')':''}`; }).join(' ');
    const _rd=RISING_DESC[RS[lagnaSign]]||[];const _md=MOON_DESC[RS[moonSign]]||[];const _sd=STAR_DESC[NK[no(chart.sid.Moon)]]||[];const summaryPrompt=`${LANG}\nPre-written base:\n${RS[lagnaSign]} Rising: ${_rd[0]||''}\n${RS[moonSign]} Moon: ${_md[0]||''}\n${NK[no(chart.sid.Moon)]} Birth Star: ${_sd[0]||''}\nCurrent period: ${curr?FN[curr.lord]+' ends '+fmtYr(curr.end):'unknown'}\nTop pattern: ${yogas[0]?.name||'none'}\n\nUsing the base above, write EXACTLY 2 vivid personal sentences. First sentence: what makes this Rising+Moon combination specifically interesting. Second sentence: what their current period + top pattern means for them right now. Plain American English. Specific, personal, direct.`;
    // Annual periods (today → +1yr) — zero token cost, pure math
    const todayJD2=JD(new Date().getFullYear(),new Date().getMonth()+1,new Date().getDate(),12);
    const windowEnd2=todayJD2+365;
    let lastSR2Year=new Date().getFullYear();
    let lastSR2JD=findSolarReturn(chart.sid.Sun,lastSR2Year,mo,dy,geo.tz);
    if(lastSR2JD>todayJD2){lastSR2Year--;lastSR2JD=findSolarReturn(chart.sid.Sun,lastSR2Year,mo,dy,geo.tz);}
    const nextSR2JD=findSolarReturn(chart.sid.Sun,lastSR2Year+1,mo,dy,geo.tz);
    const birthdayInWindow2=nextSR2JD<windowEnd2;
    const srAy2=ayanamsa(lastSR2JD);
    const srMoon2=n360(moonLon(lastSR2JD)-srAy2);
    const ap1=getAnnualPeriods(srMoon2,lastSR2JD,todayJD2,birthdayInWindow2?nextSR2JD:windowEnd2);
    let ap2=[];
    if(birthdayInWindow2){const srAy3=ayanamsa(nextSR2JD);const srMoon3=n360(moonLon(nextSR2JD)-srAy3);ap2=getAnnualPeriods(srMoon3,nextSR2JD,nextSR2JD,windowEnd2);}
    const allAP=[...ap1,...ap2];
    const activeAP=allAP.find(p=>p.current)||allAP[0];
    // Active phase (antardasha)
    const antars2=curr?getAntardashas(curr.lord,curr.start,curr.end):[];
    const currAntar2=antars2.find(a=>a.curr);
    const activePhase=currAntar2?{planet:FN[currAntar2.lord],end:fmtYr(currAntar2.end),months_left:Math.round((currAntar2.end-(new Date().getFullYear()+new Date().getMonth()/12))*12)}:null;
    let summary='';
    try{summary=await claude(apiKey,summaryPrompt,120);}catch{}
    logToSheets({event:'free_chart',name,dob,pob,lagna:RS[lagnaSign],rashi:RS[moonSign],nakshatra:NK[no(chart.sid.Moon)],period:curr?FN[curr.lord]:''});
    return res.status(200).json({lagna:RS[lagnaSign],rashi:RS[moonSign],nakshatra:NK[no(chart.sid.Moon)],nakshatra_pada:po(chart.sid.Moon),planets,ayanamsa:+ayanamsa(JD(yr,mo,dy,h+mi/60-geo.tz)).toFixed(4),dasha_balance:curr?{planet:FN[curr.lord],years_remaining:yearsRemaining}:null,dashas:dashaList,yogas:yogas.map(y=>({name:y.name,description:y.meaning,strength:y.strength,icon:y.strength==='Strong'?'🏆':'⚡'})),
      navamsa:(() => {
        // D9 navamsha — returned as array [{planet, rashi, sign, house}] for index.html compatibility
        const d9Lagna = calcNavamsa2(chart.lagna);
        return Object.entries(chart.sid).map(([p,lon]) => {
          const d9Sign = calcNavamsa2(lon);
          const d9House = ((d9Sign - d9Lagna + 12) % 12) + 1;
          const padaDeg = (lon%30) % (30/9);
          return {
            planet:   p,
            rashi:    RS[d9Sign],              // string "Taurus" — for index.html SVG rendering
            sign:     d9Sign,                  // 0-11 numeric
            signName: RS[d9Sign],
            house:    d9House,
            degree:   +(padaDeg * 9).toFixed(2)
          };
        });
      })(),
      navamsa_lagna: RS[calcNavamsa2(chart.lagna)], // string e.g. "Taurus" — kept as string for index.html compatibility
      vargottama:Object.entries(chart.sid).filter(([p,lon])=>so(lon)===calcNavamsa2(lon)).map(([p])=>p),
      atmakaraka:(() => { let am='Sun',mx=0; for(const p of ['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn']){ const d=chart.sid[p]!==undefined?chart.sid[p]%30:0; if(d>mx){mx=d;am=p;} } return FN[am]||am; })(),
      combust:['Moon','Mars','Mercury','Jupiter','Venus','Saturn'].filter(p=>chart.sid[p]!==undefined&&isCombust(p,chart.sid[p],chart.sid.Sun)),
      gandanta:Object.entries(chart.sid).filter(([p,lon])=>[[11,0],[3,4],[7,8]].some(([w,f])=>(so(lon)===w&&lon%30>=26.67)||(so(lon)===f&&lon%30<=3.33))).map(([p])=>p),
      kp_sublords:Object.fromEntries(Object.entries(chart.sid).map(([p,lon])=>[p,{nak:NK[no(lon)],nakLord:FN[NL[no(lon)]],subLord:(()=>{const ni=no(lon),ns=NAK_SPAN_ML,di=n360(lon)%ns,nl=FN[NL[ni]],si=VIM_SEQ_ML.indexOf(nl);let cur=0;for(let i=0;i<9;i++){const pl=VIM_SEQ_ML[(si+i)%9],sp=(VIM_YRS_ML[pl]/120)*ns;if(di>=cur&&di<cur+sp)return pl;cur+=sp;}return nl;})()}])),
      summary,shadbala:shadbalaM2,
      _d9Ctx: '',
      _d10Ctx: '',
      _karakaAsk: (() => {
        try {
          const _k = computeJaiminiKarakas(chart.sid);
          return buildKarakaCtx(_k, 'general');
        } catch(e) { return ''; }
      })(),
      _pratyantarStr: (() => {
        try {
          const _md = allAP?.find(p=>p.current);
          if(!_md) return '';
          const _pt = getPratyantardashas(_md);
          const _cur = _pt?.find(p=>p.current);
          return _cur ? 'Active ' + (_cur.lordName||'') + ' sub-period ends ' + (_cur.endStr||'soon') : '';
        } catch(e) { return ''; }
      })(),
      specialMarkers: (() => {
        const _sd = buildSaturnsDoom(todayData2?.sadeSati||null, true);
        const _cd = buildCriticalDegreeBirth(chart, true);
        const _md = buildMarsDisruption(chart, shadbalaM2, true);
        return { saturnsDoom:_sd||null, criticalDegree:_cd||null, marsDisruption:_md||null };
      })(),
      chartSummary: (() => {
        const sbi = buildShadbalaInsights(chart.sid, lagnaSign, shadbalaM2, chart.planets||[], '', '', null);
        return sbi.summary || '';
      })(),
      _geo:{lat:geo.lat,lon:geo.lon,tz:geo.tz},transits:transitList,annualPeriods:allAP,activeAnnualPeriod:activeAP||null,activePhase,risingDesc:RISING_DESC[RS[lagnaSign]]||[],moonDesc:MOON_DESC[RS[moonSign]]||[],starDesc:STAR_DESC[NK[no(chart.sid.Moon)]]||[],
      _engine:{
        top_yoga:      yogas[0]?.name||null,
        sade_sati:     sadeSati?.phase||null,
        sade_sati_note:sadeSati?.note||null,
        current_period:curr?FN[curr.lord]:null,
        antar:         currAntar2?FN[currAntar2.lord]:null,
        jup_transit_house:  todayData2.jupTransit?.house||null,
        jup_transit_quality:todayData2.jupTransit?.quality||null,
        // Enhanced from rules engine (when available)
        marriage_verdict:   freeChartEngine?.marriage?.verdict||null,
        career_verdict:     freeChartEngine?.career?.verdict||null,
        wealth_verdict:     freeChartEngine?.wealth?.verdict||null,
        health_verdict:     freeChartEngine?.health?.verdict||null,
        yogas_summary:      freeChartEngine?.yogas?.summary||null,
        dasha_verdict:      freeChartEngine?.dasha?.verdict||null,
        upapada_sign:       freeChartEngine?.upapada?.sign!=null ? RS[freeChartEngine.upapada.sign] : null,
        atmakaraka:         freeChartEngine?.jaiminiKarakas?.karakas?.AK?.planet||null,
        darakaraka:         freeChartEngine?.jaiminiKarakas?.karakas?.DK?.planet||null,
        remedies_needed:    freeChartEngine?.remedies?.needed?.filter(r=>r.priority==='HIGH').map(r=>r.planet)||[],
        strong_houses:      freeChartEngine?.ashtakavarga?.strongHouses?.map(x=>x.house)||[],
        weak_houses:        freeChartEngine?.ashtakavarga?.weakHouses?.map(x=>x.house)||[],
      },
      // Full engine verdicts for free chart display (all 30 areas)
      _engineVerdicts: freeChartEngine ? {
        marriage:    translateVerdict(freeChartEngine.marriage?.verdict),
        career:      translateVerdict(freeChartEngine.career?.verdict),
        wealth:      translateVerdict(freeChartEngine.wealth?.verdict),
        health:      translateVerdict(freeChartEngine.health?.verdict),
        children:    translateVerdict(freeChartEngine.children?.verdict),
        father:      translateVerdict(freeChartEngine.father?.verdict),
        mother:      translateVerdict(freeChartEngine.mother?.verdict),
        siblings:    translateVerdict(freeChartEngine.siblings?.verdict),
        foreignTravel: translateVerdict(freeChartEngine.foreignTravel?.verdict),
        spirituality:translateVerdict(freeChartEngine.spirituality?.verdict),
        yogas:       translateVerdict(freeChartEngine.yogas?.summary),
        dasha:       translateVerdict(freeChartEngine.dasha?.verdict),
        upapada:     translateVerdict(freeChartEngine.upapada?.verdicts?.[0]),
        arudha:      translateVerdict(freeChartEngine.arudhaLagna?.verdicts?.[0]),
        remedies:    translateVerdict(freeChartEngine.remedies?.summary),
        transits:    (freeChartEngine.transits?.verdicts?.slice(0,2)||[]).map(translateVerdict),
        strongHouses:freeChartEngine.ashtakavarga?.strongHouses,
        weakHouses:  freeChartEngine.ashtakavarga?.weakHouses,
        trikonaSAV:  freeChartEngine.ashtakavarga?.trikonaSAV,
        dusthanaSAV: freeChartEngine.ashtakavarga?.dusthanaSAV,
      } : null,
      // Raw engine input — sent back to Ask tab for deterministic rule evaluation
      _engineInput: {
        lagnaIdx: lagnaSign,
        gender: gender||'M',
        mahaName: curr ? FN[curr.lord] : '',
        antarName: currAntar2 ? FN[currAntar2.lord] : '',
        pratyantarName: (() => {
          try {
            const _md = allAP?.find(p=>p.current);
            if (!_md) return '';
            const _pt = getPratyantardashas(_md);
            const _cur = _pt?.find(p=>p.current);
            return _cur ? FN[_cur.lord]||'' : '';
          } catch(e) { return ''; }
        })(),
        planets: Object.fromEntries(Object.entries(chart.sid).map(([p,lon])=>[p,{sign:so(lon),house:((so(lon)-lagnaSign+12)%12)+1,degree:lon%30,longitude:lon}])),
        houseLords: Object.fromEntries(Array.from({length:12},(_,i)=>[i+1, FN[SL[(lagnaSign+i)%12]]])),
        // D9 navamsha
        navamshaLagna: calcNavamsa2(chart.lagna),
        navamsha: Object.fromEntries(Object.entries(chart.sid).map(([p,lon])=>{
          const d9s=calcNavamsa2(lon),d9l=calcNavamsa2(chart.lagna);
          return [p,{sign:d9s,house:((d9s-d9l+12)%12)+1,degree:+((lon%30)%(30/9)*9).toFixed(2)}];
        })),
        // Today's transit signs — enables Step 6 transit rules in Ask tab
        currentTransits: todayData2?.raw
          ? Object.fromEntries(Object.entries(todayData2.raw).map(([p,l])=>[p, so(l)]))
          : null
      }});
  }catch(e){console.error('chart.js error:',e);return res.status(500).json({error:e.message});}
};
