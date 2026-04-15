// api/chart.js — NatalAI.live
// Mode 2: real ephemeris (JyotishAI engine) for planet positions + dasha
// Mode 1: pass-through prompt to Claude for report interpretation

// ─── EPHEMERIS ENGINE ────────────────────────────────────────────────────────
const R=Math.PI/180,D=180/Math.PI,n360=x=>((x%360)+360)%360;
function JD(y,mo,d,h){if(mo<=2){y--;mo+=12;}const A=Math.floor(y/100),B=2-A+Math.floor(A/4);return Math.floor(365.25*(y+4716))+Math.floor(30.6001*(mo+1))+d+h/24+B-1524.5;}
const TC=j=>(j-2451545)/36525;
const eps=j=>{const t=TC(j);return 23.4393-0.013004*t;};
const GMST=j=>{const t=TC(j);return n360(280.46061837+360.98564736629*(j-2451545)+3.87933e-4*t*t);};
const ayanamsa=j=>23.85+(j-2451545)*50.29/1314900;
function sunLon(j){const t=TC(j),L0=n360(280.46646+36000.76983*t),M=n360(357.52911+35999.05029*t),Mr=M*R,C=(1.914602-0.004817*t)*Math.sin(Mr)+(0.019993-1.01e-4*t)*Math.sin(2*Mr);return n360(L0+C-0.00569-0.00478*Math.sin((125.04-1934.136*t)*R));}
function moonLon(j){const t=TC(j),t2=t*t,t3=t2*t,t4=t3*t,Lp=n360(218.3164477+481267.88123421*t-1.5786e-3*t2+t3/538841-t4/65194000),Dv=n360(297.8501921+445267.1114034*t-1.8819e-3*t2),Mv=n360(357.5291092+35999.0502909*t),Mp=n360(134.9633964+477198.8675055*t+8.7414e-3*t2),Fv=n360(93.2720950+483202.0175233*t),E=1-2.516e-3*t,E2=E*E;const T=[[0,0,1,0,6288774],[2,0,-1,0,1274027],[2,0,0,0,658314],[0,0,2,0,213618],[0,1,0,0,-185116],[0,0,0,2,-114332],[2,0,-2,0,58793],[2,-1,-1,0,57066],[2,0,1,0,53322],[2,-1,0,0,45758],[0,1,-1,0,-40923],[1,0,0,0,-34720],[0,1,1,0,-30383],[2,0,0,-2,15327],[0,0,1,-2,10980],[4,0,-1,0,10675],[0,0,3,0,10034],[4,0,-2,0,8548],[2,1,-1,0,-7888],[2,1,0,0,-6766],[2,-1,1,0,4036],[2,0,2,0,3994],[4,0,0,0,3861]];let s=0;for(const[dv,m,mp,fv,c]of T){const a=(dv*Dv+m*Mv+mp*Mp+fv*Fv)*R;let cf=c;if(Math.abs(m)===1)cf*=E;if(Math.abs(m)===2)cf*=E2;s+=cf*Math.sin(a);}return n360(Lp+s/1e6);}
const rahuLon=j=>{const t=TC(j);return n360(125.0445479-1934.1362608*t+2.0754e-3*t*t);};
const EL={Mercury:[.38709927,3.7e-5,.20563593,1.906e-5,7.00497902,-5.9475e-3,252.25032350,149472.67411175,77.45779628,.16047689,48.33076593,-.12534081],Venus:[.72333566,3.9e-5,.00677672,-4.107e-5,3.39467605,-7.889e-4,181.97909950,58517.81538729,131.60246718,2.6833e-3,76.67984255,-.27769418],Earth:[1.00000261,5.62e-5,.01671123,-4.392e-5,-1.531e-5,-.01294668,100.46457166,35999.37244981,102.93768193,.32327364,0,0],Mars:[1.52371034,1.847e-5,.09339410,7.882e-5,1.84969142,-8.1313e-3,-4.55343205,19140.30268499,-23.94362959,.44441088,49.55953891,-.29257343],Jupiter:[5.20288700,-1.1607e-4,.04838624,-1.3253e-4,1.30439695,-1.8371e-3,34.39644051,3034.74612775,14.72847983,.21252668,100.47390909,.20469106],Saturn:[9.53667594,-1.2506e-3,.05386179,-5.0991e-4,2.48599187,1.9361e-3,49.95424423,1222.49362201,92.59887831,-.41897216,113.66242448,-.28867794]};
function keplSolve(M,e){let E=M;for(let i=0;i<50;i++){const dE=(M-E+e*Math.sin(E))/(1-e*Math.cos(E));E+=dE;if(Math.abs(dE)<1e-11)break;}return E;}
function helioXYZ(t,el){const a0=el[0],da=el[1],e0=el[2],de=el[3],i0=el[4],di=el[5],L0=el[6],dL=el[7],w0=el[8],dw=el[9],N0=el[10],dN=el[11];const a=a0+da*t,e=e0+de*t,I=(i0+di*t)*R,L=n360(L0+dL*t)*R,w=n360(w0+dw*t)*R,N=n360(N0+dN*t)*R,om=w-N,M=n360((L-w)*D)*R,Ev=keplSolve(M,e),xp=a*(Math.cos(Ev)-e),yp=a*Math.sqrt(1-e*e)*Math.sin(Ev);const cN=Math.cos(N),sN=Math.sin(N),cI=Math.cos(I),sI=Math.sin(I),cO=Math.cos(om),sO=Math.sin(om);return{x:(cN*cO-sN*sO*cI)*xp+(-cN*sO-sN*cO*cI)*yp,y:(sN*cO+cN*sO*cI)*xp+(-sN*sO+cN*cO*cI)*yp,z:sO*sI*xp+cO*sI*yp};}
function planetLon(j,nm){const t=TC(j),p=helioXYZ(t,EL[nm]),e=helioXYZ(t,EL.Earth);return n360(Math.atan2(p.y-e.y,p.x-e.x)*D);}
function calcLagna(j,lat,lon){const LST=n360(GMST(j)+lon)*R,e=eps(j)*R,phi=lat*R;return n360(Math.atan2(Math.cos(LST),-(Math.sin(LST)*Math.cos(e)+Math.sin(e)*Math.tan(phi)))*D);}
function computeChart(y,mo,d,h,mi,tz,lat,lon){const utH=h+mi/60-tz,j=JD(y,mo,d,utH),ay=ayanamsa(j);const trop={Sun:sunLon(j),Moon:moonLon(j),Mercury:planetLon(j,'Mercury'),Venus:planetLon(j,'Venus'),Mars:planetLon(j,'Mars'),Jupiter:planetLon(j,'Jupiter'),Saturn:planetLon(j,'Saturn'),Rahu:rahuLon(j),Ketu:n360(rahuLon(j)+180)};const sid={};for(const[k,v]of Object.entries(trop))sid[k]=n360(v-ay);return{sid,lagna:n360(calcLagna(j,lat,lon)-ay),jde:j,ay};}

// ─── VEDIC DATA ───────────────────────────────────────────────────────────────
const RS=['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
const NK=['Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra','Punarvasu','Pushya','Ashlesha','Magha','Purva Phalguni','Uttara Phalguni','Hasta','Chitra','Swati','Vishakha','Anuradha','Jyeshtha','Mula','Purva Ashadha','Uttara Ashadha','Shravana','Dhanishtha','Shatabhisha','Purva Bhadrapada','Uttara Bhadrapada','Revati'];
const NL=['Ke','Ve','Su','Mo','Ma','Ra','Ju','Sa','Me','Ke','Ve','Su','Mo','Ma','Ra','Ju','Sa','Me','Ke','Ve','Su','Mo','Ma','Ra','Ju','Sa','Me'];
const DY={Ke:7,Ve:20,Su:6,Mo:10,Ma:7,Ra:18,Ju:16,Sa:19,Me:17};
const DS=['Ke','Ve','Su','Mo','Ma','Ra','Ju','Sa','Me'];
const FN={Ke:'Ketu',Ve:'Venus',Su:'Sun',Mo:'Moon',Ma:'Mars',Ra:'Rahu',Ju:'Jupiter',Sa:'Saturn',Me:'Mercury'};
const so=l=>Math.floor(n360(l)/30),no=l=>Math.floor(n360(l)/(360/27)),po=l=>Math.floor((n360(l)%(360/27))/(360/108))+1;
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtYr=y=>{const yr=Math.floor(y),mo=Math.floor((y-yr)*12);return`${MONTHS[mo]} ${yr}`;};

// Planet dignity: [exalted, debilitated, own1, own2]
const DIGNITY={Sun:[0,6,4],Moon:[1,7,3],Mars:[9,3,0,7],Mercury:[5,11,2,5],Jupiter:[3,9,8,11],Venus:[11,5,1,6],Saturn:[6,0,9,10]};
function getPlanetStatus(p,s){const dg=DIGNITY[p];if(!dg)return'';if(s===dg[0])return'Exalted';if(s===dg[1])return'Debilitated';if(dg.slice(2).includes(s))return'Own Sign';return'';}
function fmtDeg(lon){const d=Math.floor(lon%30),m=Math.floor((lon%1)*60);return`${d}°${m.toString().padStart(2,'0')}'`;}

// Dasha engine
function getDasha(ml,y,mo,d){const nak=no(ml),lord=NL[nak],nakLen=360/27,frac=(n360(ml)%nakLen)/nakLen,bd=y+(mo-1)/12+(d-1)/365.25,fs=bd-frac*DY[lord],idx=DS.indexOf(lord);let seq=[],c=fs;for(let i=0;i<9;i++){const dk=DS[(idx+i)%9];seq.push({lord:dk,start:c,end:c+DY[dk]});c+=DY[dk];}const NOW=new Date().getFullYear()+new Date().getMonth()/12;return{nak,nakName:NK[nak],lord,seq,curr:seq.find(s=>s.start<=NOW&&s.end>NOW)};}
function getAntardashas(maha,mahaStart,mahaEnd){const totalYrs=mahaEnd-mahaStart,idx=DS.indexOf(maha);const NOW=new Date().getFullYear()+new Date().getMonth()/12;let c=mahaStart;return DS.map((_,i)=>{const al=DS[(idx+i)%9],dur=totalYrs*DY[al]/120,s=c,e=c+dur;c=e;return{lord:al,lordName:FN[al],start:s,end:e,curr:s<=NOW&&e>NOW};});}

function buildDashaList(dasha){const NOW=new Date().getFullYear()+new Date().getMonth()/12;const curr=dasha.seq.find(s=>s.start<=NOW&&s.end>NOW);if(!curr)return[];const idx=dasha.seq.indexOf(curr);return dasha.seq.slice(Math.max(0,idx-1),idx+3).map(maha=>{const antars=getAntardashas(maha.lord,maha.start,maha.end);return{planet:FN[maha.lord],start_year:Math.floor(maha.start),end_year:Math.floor(maha.end),years:DY[maha.lord],current:maha.lord===curr.lord,antardashas:antars.map(a=>({planet:FN[a.lord],start:fmtYr(a.start),end:fmtYr(a.end),current:a.curr||false}))};});}

// Geocoding — Open-Meteo free API
async function geocode(place){
  const url=`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1&language=en&format=json`;
  const r=await fetch(url);const d=await r.json();
  if(!d.results?.[0])throw new Error('Place not found: '+place);
  const loc=d.results[0];
  return{lat:loc.latitude,lon:loc.longitude,tz:(loc.utc_offset_seconds??19800)/3600,timezone:loc.timezone||'Asia/Kolkata'};
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────
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

  // ── MODE 1: Reports — pass prompt directly to Claude ──────────────────────
  if (body._direct && body._prompt) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: MODEL, max_tokens: 16000, messages: [{ role: 'user', content: body._prompt }] })
      });
      const d = await r.json();
      if (!r.ok) return res.status(500).json({ error: 'Claude API error', details: d });
      if (d.stop_reason === 'max_tokens') return res.status(500).json({ error: 'Response too long, try again' });
      const raw = (d.content?.[0]?.text || '').replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      // If plaintext mode, return text directly
      if (body._plaintext) return res.status(200).json({ text: raw });
      try { return res.status(200).json(JSON.parse(raw)); }
      catch (e) { return res.status(500).json({ error: 'JSON parse failed', raw: raw.slice(0, 1000) }); }
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── MODE 2: Free chart — real ephemeris + Claude for yogas only ───────────
  const { name, dob, tob, pob, gender } = body;
  if (!name || !dob) return res.status(400).json({ error: 'Name and DOB required' });

  try {
    // Parse birth date/time
    const [yr, mo, dy] = dob.split('-').map(Number);
    const tp = (tob || '06:00').split(':');
    const h = parseInt(tp[0]) || 6, mi = parseInt(tp[1]) || 0;

    // Geocode place
    let geo;
    try { geo = await geocode(pob || 'New Delhi, India'); }
    catch { geo = { lat: 28.6139, lon: 77.2090, tz: 5.5, timezone: 'Asia/Kolkata' }; }

    // Compute real natal chart
    const chart = computeChart(yr, mo, dy, h, mi, geo.tz, geo.lat, geo.lon);
    const lagnaSign = so(chart.lagna);
    const moonSign = so(chart.sid.Moon);

    // Build planet list
    const planets = Object.entries(chart.sid).map(([pName, lon]) => ({
      name: pName,
      rashi: RS[so(lon)],
      house: ((so(lon) - lagnaSign + 12) % 12) + 1,
      degrees: fmtDeg(lon),
      retrograde: ['Rahu', 'Ketu'].includes(pName),
      status: getPlanetStatus(pName, so(lon))
    }));

    // Dasha
    const dasha = getDasha(chart.sid.Moon, yr, mo, dy);
    const curr = dasha.curr;
    const dashaList = buildDashaList(dasha);
    const yearsRemaining = curr ? +(curr.end - (new Date().getFullYear() + new Date().getMonth() / 12)).toFixed(1) : 0;

    // Context for Claude (interpretive fields only)
    const ctx = `${name} | DOB:${dob} ${tob||'06:00'} | ${pob||'India'}
Lagna:${RS[lagnaSign]} | Moon:${RS[moonSign]} | Nakshatra:${NK[no(chart.sid.Moon)]}
${planets.map(p=>`${p.name}:${p.rashi} H${p.house}${p.status?' ('+p.status+')':''}${p.retrograde?' R':''}`).join(', ')}
${curr?`Mahadasha:${FN[curr.lord]} until ${fmtYr(curr.end)}`:''}`;

    // Claude call — yogas + summary + navamsa only (~500 input, ~400 output tokens)
    const yogaPrompt = `Vedic astrologer. Real chart data:
${ctx}
Return ONLY raw JSON, no markdown:
{"summary":"2 sentences on what makes this chart unique — name specific placements.","yogas":[{"name":"yoga name","description":"1 sentence practical meaning","strength":"Strong","icon":"🏆"},{"name":"yoga name","description":"1 sentence","strength":"Moderate","icon":"⭐"}],"navamsa":[{"planet":"Sun","rashi":"sign"},{"planet":"Moon","rashi":"sign"},{"planet":"Mars","rashi":"sign"},{"planet":"Mercury","rashi":"sign"},{"planet":"Jupiter","rashi":"sign"},{"planet":"Venus","rashi":"sign"},{"planet":"Saturn","rashi":"sign"},{"planet":"Rahu","rashi":"sign"},{"planet":"Ketu","rashi":"sign"}]}`;

    const r2 = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 800, messages: [{ role: 'user', content: yogaPrompt }] })
    });
    const d2 = await r2.json();
    let aiExtra = { summary: '', yogas: [], navamsa: [] };
    try {
      const raw2 = (d2.content?.[0]?.text || '').replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      aiExtra = JSON.parse(raw2);
    } catch { /* fallback to empty */ }

    // Today's transits
    const todayJD = JD(new Date().getFullYear(), new Date().getMonth()+1, new Date().getDate(), 12);
    const todayAy = ayanamsa(todayJD);
    const todayPlanets = {
      Sun: n360(sunLon(todayJD)-todayAy),
      Moon: n360(moonLon(todayJD)-todayAy),
      Mercury: n360(planetLon(todayJD,'Mercury')-todayAy),
      Venus: n360(planetLon(todayJD,'Venus')-todayAy),
      Mars: n360(planetLon(todayJD,'Mars')-todayAy),
      Jupiter: n360(planetLon(todayJD,'Jupiter')-todayAy),
      Saturn: n360(planetLon(todayJD,'Saturn')-todayAy),
      Rahu: n360(rahuLon(todayJD)-todayAy),
    };
    const transits = Object.entries(todayPlanets).map(([p,l])=>({
      planet:p, sign:RS[so(l)], house:((so(l)-lagnaSign+12)%12)+1,
      deg:(l%30).toFixed(1)
    }));

    return res.status(200).json({
      lagna: RS[lagnaSign],
      rashi: RS[moonSign],
      nakshatra: NK[no(chart.sid.Moon)],
      nakshatra_pada: po(chart.sid.Moon),
      planets,
      dasha_balance: curr ? { planet: FN[curr.lord], years_remaining: yearsRemaining } : null,
      dashas: dashaList,
      yogas: aiExtra.yogas || [],
      navamsa: aiExtra.navamsa || [],
      summary: aiExtra.summary || '',
      _geo: { lat: geo.lat, lon: geo.lon, tz: geo.tz },
      transits
    });

  } catch (e) {
    console.error('chart.js error:', e);
    return res.status(500).json({ error: e.message });
  }
};
