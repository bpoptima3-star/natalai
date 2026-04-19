// api/chart.js — NatalAI.live
// Mode 1: Legacy direct prompt (backward compat)
// Mode 2: Free chart — real ephemeris + inline yogas
// Mode 3: Full paid report — all computation inline, 8 parallel Haiku section calls
// NO external requires — fully self-contained like varshpal.js

'use strict';

// ─── EPHEMERIS (INLINE) ───────────────────────────────────────────────────────
const Rp=Math.PI/180,Dp=180/Math.PI;
const n360=x=>((x%360)+360)%360;
function JD(y,mo,d,h){if(mo<=2){y--;mo+=12;}const A=Math.floor(y/100),B=2-A+Math.floor(A/4);return Math.floor(365.25*(y+4716))+Math.floor(30.6001*(mo+1))+d+h/24+B-1524.5;}
function JDtoCal(jd){const z=Math.floor(jd+.5),f=(jd+.5)-z;let A=z;if(z>=2299161){const a=Math.floor((z-1867216.25)/36524.25);A=z+1+a-Math.floor(a/4);}const B=A+1524,C=Math.floor((B-122.1)/365.25),DD=Math.floor(365.25*C),E=Math.floor((B-DD)/30.6001);const day=B-DD-Math.floor(30.6001*E),mo=E<14?E-1:E-13,yr=mo>2?C-4716:C-4715;const hh=f*24,hhh=Math.floor(hh),mm=Math.round((hh-hhh)*60);return{year:yr,month:mo,day,hour:hhh,minute:mm};}
const TC=j=>(j-2451545)/36525;
const eps=j=>{const t=TC(j);return 23.4393-0.013004*t;};
const GMST=j=>{const t=TC(j);return n360(280.46061837+360.98564736629*(j-2451545)+3.87933e-4*t*t);};
const ayanamsa=j=>23.85+(j-2451545)*50.29/1314900;
function sunLon(j){const t=TC(j),L0=n360(280.46646+36000.76983*t),M=n360(357.52911+35999.05029*t),Mr=M*Rp,C=(1.914602-0.004817*t)*Math.sin(Mr)+(0.019993-1.01e-4*t)*Math.sin(2*Mr);return n360(L0+C-0.00569-0.00478*Math.sin((125.04-1934.136*t)*Rp));}
function moonLon(j){const t=TC(j),t2=t*t,t3=t2*t,t4=t3*t,Lp=n360(218.3164477+481267.88123421*t-1.5786e-3*t2+t3/538841-t4/65194000),Dv=n360(297.8501921+445267.1114034*t-1.8819e-3*t2),Mv=n360(357.5291092+35999.0502909*t),Mp=n360(134.9633964+477198.8675055*t+8.7414e-3*t2),Fv=n360(93.2720950+483202.0175233*t),E=1-2.516e-3*t,E2=E*E;const T=[[0,0,1,0,6288774],[2,0,-1,0,1274027],[2,0,0,0,658314],[0,0,2,0,213618],[0,1,0,0,-185116],[0,0,0,2,-114332],[2,0,-2,0,58793],[2,-1,-1,0,57066],[2,0,1,0,53322],[2,-1,0,0,45758],[0,1,-1,0,-40923],[1,0,0,0,-34720],[0,1,1,0,-30383],[2,0,0,-2,15327],[0,0,1,-2,10980],[4,0,-1,0,10675],[0,0,3,0,10034],[4,0,-2,0,8548],[2,1,-1,0,-7888],[2,1,0,0,-6766],[2,-1,1,0,4036],[2,0,2,0,3994],[4,0,0,0,3861]];let s=0;for(const[dv,m,mp,fv,c]of T){const a=(dv*Dv+m*Mv+mp*Mp+fv*Fv)*Rp;let cf=c;if(Math.abs(m)===1)cf*=E;if(Math.abs(m)===2)cf*=E2;s+=cf*Math.sin(a);}return n360(Lp+s/1e6);}
const rahuLon=j=>{const t=TC(j);return n360(125.0445479-1934.1362608*t+2.0754e-3*t*t);};
const EL={Mercury:[.38709927,3.7e-5,.20563593,1.906e-5,7.00497902,-5.9475e-3,252.25032350,149472.67411175,77.45779628,.16047689,48.33076593,-.12534081],Venus:[.72333566,3.9e-5,.00677672,-4.107e-5,3.39467605,-7.889e-4,181.97909950,58517.81538729,131.60246718,2.6833e-3,76.67984255,-.27769418],Earth:[1.00000261,5.62e-5,.01671123,-4.392e-5,-1.531e-5,-.01294668,100.46457166,35999.37244981,102.93768193,.32327364,0,0],Mars:[1.52371034,1.847e-5,.09339410,7.882e-5,1.84969142,-8.1313e-3,-4.55343205,19140.30268499,-23.94362959,.44441088,49.55953891,-.29257343],Jupiter:[5.20288700,-1.1607e-4,.04838624,-1.3253e-4,1.30439695,-1.8371e-3,34.39644051,3034.74612775,14.72847983,.21252668,100.47390909,.20469106],Saturn:[9.53667594,-1.2506e-3,.05386179,-5.0991e-4,2.48599187,1.9361e-3,49.95424423,1222.49362201,92.59887831,-.41897216,113.66242448,-.28867794]};
function keplSolve(M,e){let E=M;for(let i=0;i<50;i++){const dE=(M-E+e*Math.sin(E))/(1-e*Math.cos(E));E+=dE;if(Math.abs(dE)<1e-11)break;}return E;}
function helioXYZ(t,el){const a0=el[0],da=el[1],e0=el[2],de=el[3],i0=el[4],di=el[5],L0=el[6],dL=el[7],w0=el[8],dw=el[9],N0=el[10],dN=el[11];const a=a0+da*t,e=e0+de*t,I=(i0+di*t)*Rp,L=n360(L0+dL*t)*Rp,w=n360(w0+dw*t)*Rp,N=n360(N0+dN*t)*Rp,om=w-N,M=n360((L-w)*Dp)*Rp,Ev=keplSolve(M,e),xp=a*(Math.cos(Ev)-e),yp=a*Math.sqrt(1-e*e)*Math.sin(Ev);const cN=Math.cos(N),sN=Math.sin(N),cI=Math.cos(I),sI=Math.sin(I),cO=Math.cos(om),sO=Math.sin(om);return{x:(cN*cO-sN*sO*cI)*xp+(-cN*sO-sN*cO*cI)*yp,y:(sN*cO+cN*sO*cI)*xp+(-sN*sO+cN*cO*cI)*yp,z:sO*sI*xp+cO*sI*yp};}
function planetLon(j,nm){const t=TC(j),p=helioXYZ(t,EL[nm]),e=helioXYZ(t,EL.Earth);return n360(Math.atan2(p.y-e.y,p.x-e.x)*Dp);}
function calcLagna(j,lat,lon){const LST=n360(GMST(j)+lon)*Rp,e=eps(j)*Rp,phi=lat*Rp;return n360(Math.atan2(Math.cos(LST),-(Math.sin(LST)*Math.cos(e)+Math.sin(e)*Math.tan(phi)))*Dp);}
function computeChart(y,mo,d,h,mi,tz,lat,lon){const utH=h+mi/60-tz,j=JD(y,mo,d,utH),ay=ayanamsa(j);const trop={Sun:sunLon(j),Moon:moonLon(j),Mercury:planetLon(j,'Mercury'),Venus:planetLon(j,'Venus'),Mars:planetLon(j,'Mars'),Jupiter:planetLon(j,'Jupiter'),Saturn:planetLon(j,'Saturn'),Rahu:rahuLon(j),Ketu:n360(rahuLon(j)+180)};const sid={};for(const[k,v]of Object.entries(trop))sid[k]=n360(v-ay);return{sid,lagna:n360(calcLagna(j,lat,lon)-ay),jde:j,ay};}

// ─── VEDIC TABLES (INLINE) ────────────────────────────────────────────────────
const RS=['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
const NK=['Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra','Punarvasu','Pushya','Ashlesha','Magha','Purva Phalguni','Uttara Phalguni','Hasta','Chitra','Swati','Vishakha','Anuradha','Jyeshtha','Mula','Purva Ashadha','Uttara Ashadha','Shravana','Dhanishtha','Shatabhisha','Purva Bhadrapada','Uttara Bhadrapada','Revati'];
const NL=['Ke','Ve','Su','Mo','Ma','Ra','Ju','Sa','Me','Ke','Ve','Su','Mo','Ma','Ra','Ju','Sa','Me','Ke','Ve','Su','Mo','Ma','Ra','Ju','Sa','Me'];
const DY={Ke:7,Ve:20,Su:6,Mo:10,Ma:7,Ra:18,Ju:16,Sa:19,Me:17};
const DS=['Ke','Ve','Su','Mo','Ma','Ra','Ju','Sa','Me'];
const FN={Ke:'Ketu',Ve:'Venus',Su:'Sun',Mo:'Moon',Ma:'Mars',Ra:'Rahu',Ju:'Jupiter',Sa:'Saturn',Me:'Mercury'};
const SL=['Ma','Ve','Me','Mo','Su','Me','Ve','Ma','Ju','Sa','Sa','Ju'];
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
async function geocode(place){
  const url=`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1&language=en&format=json`;
  const r=await fetch(url);const d=await r.json();
  if(!d.results?.[0])throw new Error('Place not found: '+place);
  const loc=d.results[0];
  return{lat:loc.latitude,lon:loc.longitude,tz:(loc.utc_offset_seconds??19800)/3600};
}

// ─── LOG TO SHEETS ────────────────────────────────────────────────────────────
function logToSheets(data){
  const url=process.env.SHEETS_WEBHOOK;
  if(!url)return;
  fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,timestamp:new Date().toISOString()})}).catch(()=>{});
}

// ─── CLAUDE CALL ──────────────────────────────────────────────────────────────
const MODEL='claude-haiku-4-5-20251001';
async function claude(apiKey,prompt,maxTok){
  const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:MODEL,max_tokens:maxTok,messages:[{role:'user',content:prompt}]})});
  const d=await r.json();
  if(!r.ok)throw new Error(d.error?.message||'Claude error');
  return d.content?.[0]?.text||'';
}

// ─── LANGUAGE RULES (injected into every section prompt) ─────────────────────
const LANG=`RULES: American English only. Zero Sanskrit — not even in parentheses or brackets. NEVER use these terms even once: Mahadasha, Antardasha, Lagna, Rashi, Nakshatra, Sade Sati, Ashtama Shani, Ashtama Saturn, Dhaiya, Yoga, Dosha, Kuta, Kendra, Trikona, Varshpal, Muntha, Panchadhikari, Pratyantardasha. Use ONLY: "Rising Sign" not Lagna, "Moon Sign" not Rashi, "Birth Star" not Nakshatra, "Major Life Period" not Mahadasha, "Active Phase" not Antardasha, "Short Window" not Pratyantardasha, "Planetary Pattern" not Yoga, "Challenge Pattern" not Dosha, "Saturn's 8th House Pressure" not Ashtama Shani, "Saturn Pressure Cycle" not Sade Sati. All predictions: "indicators suggest" or "strong potential for" — never absolute. Warm, direct, American English tone.`;

// ─── WRAP HTML ────────────────────────────────────────────────────────────────
function wrapHTML(sections,name,type,cd){
  const LABELS={natal:'Birth Chart + Year Reading',compat:'Soul Compatibility Reading',timing:'Life Timing Guide',cosmic:'Cosmic Chemistry Reading'};
  const label=LABELS[type]||'Vedic Reading';
  const today=new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
  const body=sections.map(s=>`<div class="rep-section"><h2 class="rep-sh">${s.title}</h2><div class="rep-content">${s.html}</div></div>`).join('');
  return `<div class="rep-cover" style="background:#1d1d1f;padding:44px 40px 36px">
  <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:11px;letter-spacing:.25em;text-transform:uppercase;color:rgba(244,219,160,.6);margin-bottom:20px">NatalAI.live</div>
  <h1 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:30px;font-weight:300;color:#fff;margin:0 0 6px">${label}</h1>
  <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;color:#bf9a30;margin-bottom:24px;font-style:italic">${name}</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;border-top:1px solid rgba(191,154,48,.25);padding-top:18px;font-size:12px">
    ${[['Rising Sign',cd.lagna],['Moon Sign',cd.rashi],['Birth Star',cd.nakshatra],['Date of Birth',cd.dob]].map(([l,v])=>`<div><div style="color:rgba(255,255,255,.4);text-transform:uppercase;font-size:9px;letter-spacing:.1em;margin-bottom:2px">${l}</div><div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:14px;color:rgba(255,255,255,.85)">${v||''}</div></div>`).join('')}
  </div>
</div>
<style>
.rep-section{margin-bottom:8px;border-bottom:1px solid #f0f0f0;padding-bottom:8px}
.rep-sh{font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;font-weight:400;color:#1d1d1f;margin:24px 0 12px;padding-bottom:6px;border-bottom:2px solid #bf9a30}
.rep-content{font-size:14.5px;line-height:1.78;color:#1d1d1f;padding:0 2px}
.rep-content p{margin:0 0 12px}
.rep-content strong{font-weight:600;color:#1d1d1f}
.rep-content em{color:#bf9a30;font-style:italic}
.rep-content ul{margin:8px 0;padding-left:20px}
.rep-content li{margin-bottom:5px}
</style>
<div style="padding:32px 40px;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">${body}</div>
<div style="text-align:center;padding:16px;border-top:1px solid #d2d2d7;font-size:10px;color:#6e6e73">NatalAI.live · ${label} · ${name} · ${today} · For personal insight only</div>`;
}

// ─── MARKDOWN → HTML ─────────────────────────────────────────────────────────
const mdToHTML=t=>t.replace(/^## (.+)$/gm,'<h2 class="rep-sh">$1</h2>').replace(/^### (.+)$/gm,'<h3 style="font-family:Georgia,serif;font-size:17px;color:#bf9a30;margin:16px 0 8px">$1</h3>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>').replace(/^[•-] (.+)$/gm,'<li>$1</li>').replace(/(<li>[^\n]*\n?)+/g,s=>'<ul>'+s+'</ul>').replace(/\n\n+/g,'</p><p>').replace(/^(?!<)/gm,'<p>').replace(/<p><\/p>/g,'');

// ─── HANDLER ──────────────────────────────────────────────────────────────────
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
      try{geo=await geocode(pob||'New Delhi, India');}catch{geo={lat:28.6139,lon:77.2090,tz:5.5};}

      // Compute natal chart inline
      const natal=computeChart(yr,mo,dy,h,mi,geo.tz,geo.lat,geo.lon);
      const lagnaSign=so(natal.lagna),moonSign=so(natal.sid.Moon);
      const lagna=RS[lagnaSign],rashi=RS[moonSign],nakshatra=NK[no(natal.sid.Moon)];

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
      const annualPeriods1=getAnnualPeriods(srMoon,lastSRJD,todayJD,birthdayInWindow?nextSRJD:windowEndJD);
      let annualPeriods2=[];
      if(birthdayInWindow){
        const srAy2=ayanamsa(nextSRJD);
        const srMoon2=n360(moonLon(nextSRJD)-srAy2);
        annualPeriods2=getAnnualPeriods(srMoon2,nextSRJD,nextSRJD,windowEndJD);
      }
      const allPeriods=[...annualPeriods1,...annualPeriods2];
      const currentPeriod=allPeriods.find(p=>p.current)||allPeriods[0];
      const todayStr=new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
      const yearEndStr=JDtoCal(windowEndJD);
      const yearEndFmt=`${MONTHS[yearEndStr.month-1]} ${yearEndStr.day}, ${yearEndStr.year}`;

      // Today's transits + patterns
      const todayData=getTodayData(lagnaSign,moonSign);
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
        try{geo2=await geocode(pob2||pob||'New Delhi, India');}catch{geo2=geo;}
        const[yr2,mo2,dy2]=dob2.split('-').map(Number);
        const tp2=(tob2||'06:00').split(':');
        const h2=parseInt(tp2[0])||6,mi2=parseInt(tp2[1])||0;
        const natal2=computeChart(yr2,mo2,dy2,h2,mi2,geo2.tz,geo2.lat,geo2.lon);
        const ls2=so(natal2.lagna),ms2=so(natal2.sid.Moon),ni2=no(natal2.sid.Moon);
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
        const compatCore=`COMPATIBILITY: ${name} + ${name2||'Partner'}
${name}: Rising ${lagna}, Moon ${rashi}, Birth Star ${NK[ni1]}, Animal archetype: ${y1}, Nature: ${g1}
${name2||'Partner'}: Rising ${RS[ls2]}, Moon ${RS[ms2]}, Birth Star ${NK[ni2]}, Animal archetype: ${y2}, Nature: ${g2}
Total Score: ${totalScore}/36 | Physical chemistry: ${yoniScore}/4${yoniEnemy?' (ENEMY PAIR!)':''} | Mental bond: ${grahaScore}/5 | Temperament: ${ganaScore}/6 | Moon signs: ${bhakootBad?'0/7 (challenging)':'7/7'} | Health compatibility: ${nadiDosha?'0/8 (NADI DOSHA — same energy)':'8/8'}
${nadiDosha?`NADI DOSHA: Both have ${nadi1} energy — serious health compatibility concern for children. Address explicitly.`:''}
${name} patterns: ${yogas.map(y=>y.name).join(', ')||'standard'}`;

        // ── PARALLEL SECTIONS: compat + cosmic both split to avoid 10s timeout ──
        const twoCore = compatCore;
        let sectionDefs;
        if(reportType==='cosmic'){
          sectionDefs=[
            {title:'🐴 Your Animal Energy Types',tok:1200,prompt:`${LANG}\nCOSMIC CHEMISTRY: ${name} + ${name2||'Partner'}\n${twoCore}\nWrite 3-4 vivid paragraphs: (1) Explain ${name}'s ${y1} energy archetype in plain English — personality, desire style, how they express affection. (2) Explain ${name2||'partner'}'s ${y2} energy archetype the same way. (3) What happens when these two archetypes meet — the initial attraction dynamic, what draws them together or creates friction. Personal, vivid, honest.`},
            {title:'⚡ Chemistry & Connection Scores',tok:1200,prompt:`${LANG}\nCOSMIC CHEMISTRY: ${name} + ${name2||'Partner'}\n${twoCore}\nWrite 4 paragraphs: (1) Physical chemistry (${yoniScore}/4)${yoniEnemy?' — OPPOSITE archetypes, explain the tension and attraction honestly':''}. (2) Mental bond (${grahaScore}/5) — how their minds interact and communicate. (3) Temperament match (${g1}+${g2}, ${ganaScore}/6) — do their natures flow or clash? (4) Moon compatibility (${bhakootBad?'Challenging — explain what 0/7 means for them emotionally':'Harmonious — what 7/7 means for their emotional ease'}). Specific to THIS pairing.`},
            {title:'💎 The Raw Truth & How To Make It Work',tok:1400,prompt:`${LANG}\nCOSMIC CHEMISTRY: ${name} + ${name2||'Partner'}\n${twoCore}\nWrite: (1) Red flags AND green flags specific to the ${y1}-${y2} pairing — honest, not generic. (2) 5 specific practical pieces of advice for THIS exact animal energy combination. (3) The Verdict — honest, compassionate, direct summary of this pairing's true potential. Total score: ${totalScore}/36. End with an empowering closing.`},
          ];
        } else {
          sectionDefs=[
            {title:'💑 Overall & Physical Chemistry',tok:1200,prompt:`${LANG}\nCOMPATIBILITY: ${name} + ${name2||'Partner'}\n${twoCore}\nWrite 3-4 paragraphs: (1) What ${totalScore}/36 means in real terms for this couple — context, perspective, what it predicts. (2) Physical & emotional chemistry: the ${y1}-${y2} animal archetype pairing — what this means for attraction, touch, day-to-day energy. (3) Health compatibility (${nadiDosha?'NADI DOSHA: same '+nadi1+' energy — children health concern, address honestly':'Compatible health energies'}). Honest, specific, personal.`},
            {title:'🧠 Mental Bond & Temperament',tok:1200,prompt:`${LANG}\nCOMPATIBILITY: ${name} + ${name2||'Partner'}\n${twoCore}\nWrite 3-4 paragraphs: (1) Mental connection (${grahaScore}/5) — how their minds work together, communication style, intellectual compatibility. (2) Temperament match (${g1}+${g2}, ${ganaScore}/6) — do their natures complement or create friction? (3) Relationship psychology — attachment patterns, what each person needs, emotional dynamics. Specific to THIS combination.`},
            {title:'🔮 Long-Term Potential & Flags',tok:1200,prompt:`${LANG}\nCOMPATIBILITY: ${name} + ${name2||'Partner'}\n${twoCore}\nWrite 3-4 paragraphs: (1) Moon sign compatibility (${bhakootBad?'Challenging — moon sign tension, explain what 0/7 means practically':'Harmonious — explain what 7/7 means for long-term stability'}). (2) Specific red flags for THIS combination — honest, not generic. (3) Specific green flags and strengths. (4) Long-term outlook for this couple.`},
            {title:'⏰ Timing, Advice & The Verdict',tok:1400,prompt:`${LANG}\nCOMPATIBILITY: ${name} + ${name2||'Partner'}\n${twoCore}\nWrite: (1) Best timing for commitment based on their current periods. (2) 5 specific pieces of advice for THIS couple — practical, direct, tailored to their actual scores. (3) The Verdict — honest, compassionate, direct summary. What is the true potential of this relationship? End with an empowering but truthful closing paragraph.`},
          ];
        }
        // Run sections in parallel (finishes in ~3s vs 9-11s single call)
        const compatSections = await Promise.all(sectionDefs.map(async sec => {
          try{
            const txt=await claude(apiKey,sec.prompt,sec.tok);
            return {title:sec.title, html:mdToHTML(txt)};
          }catch(e){return {title:sec.title, html:`<p>Section unavailable — ${e.message}</p>`};}
        }));
        const reportTitle = reportType==='cosmic' ? 'Your Cosmic Chemistry Reading' : 'Your Soul Compatibility Reading';
        let finalHtml=wrapHTML(compatSections,`${name} + ${name2||'Partner'}`,reportType,{lagna,rashi,nakshatra,dob});
        let finalTitle=`${name} + ${name2||'Partner'}`;
        logToSheets({event:'report_generated',name,reportType,dob,lagna,rashi,period:mahaName});
        return res.status(200).json({html:finalHtml,chartData:{name,dob,lagna,rashi,nakshatra}});
      }

      // ── NATAL + TIMING: 8 parallel section calls ────────────────────────────
      const SECTION_PROMPTS = reportType === 'timing' ? [
        // Timing guide sections
        {title:'📅 Your Timing Blueprint',tok:1200,prompt:`${LANG}\nData:\n${core}\nWrite 3 paragraphs: (1) What ${name}'s chart says about their natural timing and decision-making style based on Rising Sign ${lagna} and Moon ${rashi}. (2) What their current ${mahaName} Major Life Period (ends ${mahaEnds}) means for timing major moves. (3) How to read the annual periods listed for best results. Personal, specific, no generic advice.`},
        {title:'⚡ Your Power Windows This Year',tok:1500,prompt:`${LANG}\nData:\n${core}\nIdentify the TOP 3 WINDOWS for major decisions/events in the next 12 months. For each window: the specific dates (from the annual periods), why this window works (which planet and what it supports), and what to do during it. Then identify 2 periods to be more careful. Be specific to ${name}'s actual periods listed above.`},
        {title:'📆 Month-by-Month Guide',tok:1800,prompt:`${LANG}\nData:\n${core}\nGo month by month for the next 12 months. For each month (use actual month names and years): which annual period is active, what themes dominate, what to do/avoid, and one specific practical tip. Keep each month to 3-4 sentences. Make it feel like a personal calendar.`},
        {title:`🎯 Timing for ${eventType||'Your Goals'}`,tok:1500,prompt:`${LANG}\nData:\n${core}\nEvent focus: ${eventType||'major life decisions'}\nGive specific guidance: best 3 months for this event in the next year (cite actual period names and dates), what to watch for in those windows, what could complicate timing, and how to prepare. Include a 3-year outlook for this type of decision.`},
        {title:'💼 Career & Financial Timing',tok:1200,prompt:`${LANG}\nData:\n${core}\nBased on ${name}'s chart patterns and current periods, give specific career and financial timing guidance: best months for negotiations/launches/investments, periods to be conservative, what their ${mahaName} Major Life Period means for career trajectory. Reference actual period dates.`},
        {title:'🎯 Your 10 Key Dates',tok:1000,prompt:`${LANG}\nData:\n${core}\nGive ${name} a specific list of 10 key dates or windows over the next 12 months with what to do in each. Format: "**[Month Year]**: [What to do/watch for]". Make these actionable and tied to actual periods. End with an empowering closing paragraph.`},
      ] : [
        // Natal report sections — 8 sections
        {title:'🌟 Your Cosmic Blueprint',tok:1200,prompt:`${LANG}\nData:\n${core}\nWrite 3-4 paragraphs introducing ${name}'s core nature. Explain what Rising Sign ${lagna} means (how others see them, physical energy, first impression). What Moon Sign ${rashi} means (inner emotional world, instincts). What Birth Star ${nakshatra} means (soul signature). Then describe what makes ${name}'s chart unique — reference 2 specific patterns from the data. Keep astrology accessible — explain what these three placements ARE for someone new to this.`},
        {title:'⚡ Your Personality & Natural Strengths',tok:1200,prompt:`${LANG}\nData:\n${core}\nBased on ${name}'s specific placements and patterns (${yogas.map(y=>y.name).join(', ')||'see above'}), write 3-4 paragraphs covering: natural gifts and talents, communication style, how they handle stress, what environments they thrive in, relationship approach, career instincts. Reference actual planetary positions. No generic sign descriptions — this must be specific to THIS chart.`},
        {title:'⏰ Your Current Life Chapter',tok:1200,prompt:`${LANG}\nData:\n${core}\nWrite 3-4 paragraphs about ${name}'s ${mahaName} Major Life Period (ends ${mahaEnds}, ${mahaYrsLeft} years left) and ${antarName} Active Phase (ends ${antarEnds}, ${antarMosLeft} months left). What does this multi-year period mean specifically for ${name}? How does it interact with their natal placements? What themes define it? What opportunities and challenges come with it? What changed when this period began?${todayData.sadeSati?` Also address the Saturn Pressure Cycle (${todayData.sadeSati.phase}): ${todayData.sadeSati.note}`:''}`},
        {title:'📅 Your Year Ahead — Big Picture',tok:1200,prompt:`${LANG}\nData:\n${core}\nWrite 3-4 paragraphs covering ${name}'s year from today through ${yearEndFmt}. Current active period: ${currentPeriod?.planet||''} (${currentPeriod?.daysLeft||''} days left). What is the dominant energy? What are the 2-3 biggest themes? What opportunities are opening?${birthdayInWindow?` Note the birthday on ${fmtDt(nextSRCal)} marks a distinct energy shift — describe both phases.`:''} Jupiter transit is ${todayData.jupTransit.quality} (house ${todayData.jupTransit.house} from Moon). Reference specific period names and dates.`},
        {title:'📆 Month-by-Month Breakdown',tok:2000,prompt:`${LANG}\nData:\n${core}\nGo month by month for the next 12 months. For each month: which annual period is active, key themes, practical guidance, what to focus on or avoid. Use actual month names (e.g. "May 2026:", "June 2026:"). Keep each month to 3-4 sentences. Reference specific planet periods. Make ${name} feel like they have a personal calendar.`},
        {title:'💼 Career, Money & Opportunities',tok:1300,prompt:`${LANG}\nData:\n${core}\nWrite 4 paragraphs: (1) ${name}'s long-term career direction based on natal patterns. (2) Financial patterns and wealth potential. (3) Best months THIS YEAR for career moves, negotiations, launches (cite specific periods). (4) What to avoid financially and professionally. Be specific — reference actual planetary patterns and period dates. Legal-safe: "indicators suggest" language.`},
        {title:'❤️ Love, Relationships & Connection',tok:1400,prompt:`${LANG}\nData:\n${core}\n${patterns.filter(p=>p.type.includes('Mars')||p.type.includes('emotion')).map(p=>p.type+': '+p.meaning).join('\n')}\nWrite 4 paragraphs: (1) ${name}'s relationship style and what they need in a partner. (2) Attachment patterns and emotional tendencies (reference any patterns above). (3) Relationship timing THIS YEAR — best periods for new connections or deepening existing ones. (4) Red flags to watch in their own relationship behavior. Honest, specific, personal. Legal-safe language.`},
        {title:'🏃 Health, Family & Growth Edges',tok:1300,prompt:`${LANG}\nData:\n${core}\nWrite on 3 topics: (1) Health patterns from the chart — body areas to monitor, this year's health-focused periods, mental/emotional wellbeing guidance. Note: "your chart shows patterns associated with" — never diagnose. (2) Family and home themes this year. Parent/sibling dynamics if indicated. (3) Growth edges — what life is asking ${name} to develop, what challenges are actually opportunities, and an empowering closing paragraph about their chart's overall story.`},
      ];

      // Run all sections in parallel
      const sectionResults = await Promise.all(
        SECTION_PROMPTS.map(async (sec) => {
          try {
            const text = await claude(apiKey, sec.prompt, sec.tok);
            // Convert markdown to HTML
            const html = text
              .replace(/^### (.+)$/gm,'<h3 style="font-family:Georgia,serif;font-size:17px;color:#bf9a30;margin:16px 0 8px">$1</h3>')
              .replace(/^## (.+)$/gm,'<h3 style="font-family:Georgia,serif;font-size:17px;color:#1d1d1f;margin:16px 0 8px">$1</h3>')
              .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
              .replace(/\*(.+?)\*/g,'<em>$1</em>')
              .replace(/^[•\-] (.+)$/gm,'<li>$1</li>')
              .replace(/(<li>[^\n]*\n?)+/g,'<ul>$&</ul>')
              .replace(/\n\n+/g,'</p><p>')
              .replace(/^(?!<)/gm,'<p>')
              .replace(/<p><\/p>/g,'');
            return { title: sec.title, html };
          } catch(e) {
            return { title: sec.title, html: `<p>Section unavailable — ${e.message}</p>` };
          }
        })
      );

      const reportHTML = wrapHTML(sectionResults, name, reportType, {lagna, rashi, nakshatra, dob});

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

  // ── MODE 2: Free chart ────────────────────────────────────────────────────
  const{name,dob,tob,pob,gender}=body;
  if(!name||!dob)return res.status(400).json({error:'Name and DOB required'});
  try{
    const[yr,mo,dy]=dob.split('-').map(Number);
    const tp=(tob||'06:00').split(':');
    const h=parseInt(tp[0])||6,mi=parseInt(tp[1])||0;
    let geo;
    try{geo=await geocode(pob||'New Delhi, India');}catch{geo={lat:28.6139,lon:77.2090,tz:5.5};}
    const chart=computeChart(yr,mo,dy,h,mi,geo.tz,geo.lat,geo.lon);
    const lagnaSign=so(chart.lagna),moonSign=so(chart.sid.Moon);
    const planets=Object.entries(chart.sid).map(([pName,lon])=>({name:pName,rashi:RS[so(lon)],house:((so(lon)-lagnaSign+12)%12)+1,degrees:fmtDeg(lon),retrograde:['Rahu','Ketu'].includes(pName),status:pStatus(pName,so(lon))}));
    const dasha=getDasha(chart.sid.Moon,yr,mo,dy);
    const curr=dasha.curr;
    const dashaList=buildDashaList(dasha);
    const yearsRemaining=curr?+(curr.end-(new Date().getFullYear()+new Date().getMonth()/12)).toFixed(1):0;
    const{raw:transitRaw,list:transitList,sadeSati}=getTodayData(lagnaSign,moonSign);
    const yogas=checkYogas(chart.sid,lagnaSign,moonSign);
    const pSummary=Object.entries(chart.sid).map(([p,l])=>{const st=pStatus(p,so(l));return`${p}:${RS[so(l)]} H${((so(l)-lagnaSign+12)%12)+1}${st?'('+st[0]+')':''}`; }).join(' ');
    const summaryPrompt=`Write 2 vivid sentences about this person's chart in plain American English. No Sanskrit. What makes them unique? Be specific.\nRising: ${RS[lagnaSign]}, Moon: ${RS[moonSign]}, Birth Star: ${NK[no(chart.sid.Moon)]}\nCurrent life period: ${curr?FN[curr.lord]:''} ends ${curr?fmtYr(curr.end):''}\nTop pattern: ${yogas[0]?.name||'none'}\n${sadeSati?'Currently in Saturn Pressure Cycle: '+sadeSati.phase:''}`;
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
    return res.status(200).json({lagna:RS[lagnaSign],rashi:RS[moonSign],nakshatra:NK[no(chart.sid.Moon)],nakshatra_pada:po(chart.sid.Moon),planets,dasha_balance:curr?{planet:FN[curr.lord],years_remaining:yearsRemaining}:null,dashas:dashaList,yogas:yogas.map(y=>({name:y.name,description:y.meaning,strength:y.strength,icon:y.strength==='Strong'?'🏆':'⚡'})),navamsa:[],summary,_geo:{lat:geo.lat,lon:geo.lon,tz:geo.tz},transits:transitList,annualPeriods:allAP,activeAnnualPeriod:activeAP||null,activePhase,_engine:{top_yoga:yogas[0]?.name||null,sade_sati:sadeSati?.phase||null,sade_sati_note:sadeSati?.note||null,current_period:curr?FN[curr.lord]:null,antar:currAntar2?FN[currAntar2.lord]:null,jup_transit_house:todayData.jupTransit?.house||null,jup_transit_quality:todayData.jupTransit?.quality||null}});
  }catch(e){console.error('chart.js error:',e);return res.status(500).json({error:e.message});}
};
