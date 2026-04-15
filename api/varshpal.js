// api/varshpal.js — Varshpal (Solar Return) engine for NatalAI
// Ephemeris ported from JyotishAI (Meeus + JPL approximations, Lahiri ayanamsa)

// ─── CORE MATH ────────────────────────────────────────────────────────────────
const R=Math.PI/180,D=180/Math.PI,n360=x=>((x%360)+360)%360;
function JD(y,mo,d,h){if(mo<=2){y--;mo+=12;}const A=Math.floor(y/100),B=2-A+Math.floor(A/4);return Math.floor(365.25*(y+4716))+Math.floor(30.6001*(mo+1))+d+h/24+B-1524.5;}
function JDtoCal(jd){const z=Math.floor(jd+.5),f=(jd+.5)-z;let A=z;if(z>=2299161){const a=Math.floor((z-1867216.25)/36524.25);A=z+1+a-Math.floor(a/4);}const B=A+1524,C=Math.floor((B-122.1)/365.25),DD=Math.floor(365.25*C),E=Math.floor((B-DD)/30.6001);const day=B-DD-Math.floor(30.6001*E),mo=E<14?E-1:E-13,yr=mo>2?C-4716:C-4715;const h=f*24,hh=Math.floor(h),mm=Math.round((h-hh)*60);return{year:yr,month:mo,day,hour:hh,minute:mm};}
const TC=j=>(j-2451545)/36525;
const eps=j=>{const t=TC(j);return 23.4393-0.013004*t;};
const GMST=j=>{const t=TC(j);return n360(280.46061837+360.98564736629*(j-2451545)+3.87933e-4*t*t);};
const ayanamsa=j=>23.85+(j-2451545)*50.29/1314900;

function sunLon(j){const t=TC(j),L0=n360(280.46646+36000.76983*t),M=n360(357.52911+35999.05029*t),Mr=M*R,C=(1.914602-0.004817*t)*Math.sin(Mr)+(0.019993-1.01e-4*t)*Math.sin(2*Mr);return n360(L0+C-0.00569-0.00478*Math.sin((125.04-1934.136*t)*R));}
function moonLon(j){const t=TC(j),t2=t*t,t3=t2*t,t4=t3*t,Lp=n360(218.3164477+481267.88123421*t-1.5786e-3*t2+t3/538841-t4/65194000),Dv=n360(297.8501921+445267.1114034*t-1.8819e-3*t2),Mv=n360(357.5291092+35999.0502909*t),Mp=n360(134.9633964+477198.8675055*t+8.7414e-3*t2),Fv=n360(93.2720950+483202.0175233*t),E=1-2.516e-3*t,E2=E*E;const T=[[0,0,1,0,6288774],[2,0,-1,0,1274027],[2,0,0,0,658314],[0,0,2,0,213618],[0,1,0,0,-185116],[0,0,0,2,-114332],[2,0,-2,0,58793],[2,-1,-1,0,57066],[2,0,1,0,53322],[2,-1,0,0,45758],[0,1,-1,0,-40923],[1,0,0,0,-34720],[0,1,1,0,-30383],[2,0,0,-2,15327],[0,0,1,-2,10980],[4,0,-1,0,10675],[0,0,3,0,10034],[4,0,-2,0,8548],[2,1,-1,0,-7888],[2,1,0,0,-6766],[2,-1,1,0,4036],[2,0,2,0,3994],[4,0,0,0,3861]];let s=0;for(const[dv,m,mp,fv,c]of T){const a=(dv*Dv+m*Mv+mp*Mp+fv*Fv)*R;let cf=c;if(Math.abs(m)===1)cf*=E;if(Math.abs(m)===2)cf*=E2;s+=cf*Math.sin(a);}return n360(Lp+s/1e6);}
const rahuLon=j=>{const t=TC(j);return n360(125.0445479-1934.1362608*t+2.0754e-3*t*t);};
const EL={Mercury:[.38709927,3.7e-5,.20563593,1.906e-5,7.00497902,-5.9475e-3,252.25032350,149472.67411175,77.45779628,.16047689,48.33076593,-.12534081],Venus:[.72333566,3.9e-5,.00677672,-4.107e-5,3.39467605,-7.889e-4,181.97909950,58517.81538729,131.60246718,2.6833e-3,76.67984255,-.27769418],Earth:[1.00000261,5.62e-5,.01671123,-4.392e-5,-1.531e-5,-.01294668,100.46457166,35999.37244981,102.93768193,.32327364,0,0],Mars:[1.52371034,1.847e-5,.09339410,7.882e-5,1.84969142,-8.1313e-3,-4.55343205,19140.30268499,-23.94362959,.44441088,49.55953891,-.29257343],Jupiter:[5.20288700,-1.1607e-4,.04838624,-1.3253e-4,1.30439695,-1.8371e-3,34.39644051,3034.74612775,14.72847983,.21252668,100.47390909,.20469106],Saturn:[9.53667594,-1.2506e-3,.05386179,-5.0991e-4,2.48599187,1.9361e-3,49.95424423,1222.49362201,92.59887831,-.41897216,113.66242448,-.28867794]};
function keplSolve(M,e){let E=M;for(let i=0;i<50;i++){const dE=(M-E+e*Math.sin(E))/(1-e*Math.cos(E));E+=dE;if(Math.abs(dE)<1e-11)break;}return E;}
function helioXYZ(t,el){const a0=el[0],da=el[1],e0=el[2],de=el[3],i0=el[4],di=el[5],L0=el[6],dL=el[7],w0=el[8],dw=el[9],N0=el[10],dN=el[11];a=a0+da*t,e=e0+de*t,I=(i0+di*t)*R,L=n360(L0+dL*t)*R,w=n360(w0+dw*t)*R,N=n360(N0+dN*t)*R,om=w-N,M=n360((L-w)*D)*R,Ev=keplSolve(M,e),xp=a*(Math.cos(Ev)-e),yp=a*Math.sqrt(1-e*e)*Math.sin(Ev);const[cN,sN,cI,sI,cO,sO]=[Math.cos(N),Math.sin(N),Math.cos(I),Math.sin(I),Math.cos(om),Math.sin(om)];return{x:(cN*cO-sN*sO*cI)*xp+(-cN*sO-sN*cO*cI)*yp,y:(sN*cO+cN*sO*cI)*xp+(-sN*sO+cN*cO*cI)*yp,z:sO*sI*xp+cO*sI*yp};}
function planetLon(j,nm){const t=TC(j),p=helioXYZ(t,EL[nm]),e=helioXYZ(t,EL.Earth);return n360(Math.atan2(p.y-e.y,p.x-e.x)*D);}
function calcLagna(j,lat,lon){const LST=n360(GMST(j)+lon)*R,e=eps(j)*R,phi=lat*R;return n360(Math.atan2(Math.cos(LST),-(Math.sin(LST)*Math.cos(e)+Math.sin(e)*Math.tan(phi)))*D);}
function computeChart(y,mo,d,h,mi,tz,lat,lon){const utH=h+mi/60-tz,j=JD(y,mo,d,utH),ay=ayanamsa(j);const trop={Sun:sunLon(j),Moon:moonLon(j),Mercury:planetLon(j,'Mercury'),Venus:planetLon(j,'Venus'),Mars:planetLon(j,'Mars'),Jupiter:planetLon(j,'Jupiter'),Saturn:planetLon(j,'Saturn'),Rahu:rahuLon(j),Ketu:n360(rahuLon(j)+180)};const sid={};for(const[k,v]of Object.entries(trop))sid[k]=n360(v-ay);return{sid,lagna:n360(calcLagna(j,lat,lon)-ay),jde:j,ay};}

// ─── VEDIC TABLES ─────────────────────────────────────────────────────────────
const RS=['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
const RSH=['Ari','Tau','Gem','Can','Leo','Vir','Lib','Sco','Sag','Cap','Aqu','Pis'];
const NK=['Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra','Punarvasu','Pushya','Ashlesha','Magha','Purva Phalguni','Uttara Phalguni','Hasta','Chitra','Swati','Vishakha','Anuradha','Jyeshtha','Mula','Purva Ashadha','Uttara Ashadha','Shravana','Dhanishtha','Shatabhisha','Purva Bhadrapada','Uttara Bhadrapada','Revati'];
const NL=['Ke','Ve','Su','Mo','Ma','Ra','Ju','Sa','Me','Ke','Ve','Su','Mo','Ma','Ra','Ju','Sa','Me','Ke','Ve','Su','Mo','Ma','Ra','Ju','Sa','Me'];
const DY={Ke:7,Ve:20,Su:6,Mo:10,Ma:7,Ra:18,Ju:16,Sa:19,Me:17};
const DS=['Ke','Ve','Su','Mo','Ma','Ra','Ju','Sa','Me'];
const FN={Ke:'Ketu',Ve:'Venus',Su:'Sun',Mo:'Moon',Ma:'Mars',Ra:'Rahu',Ju:'Jupiter',Sa:'Saturn',Me:'Mercury'};
// Sign lords (0=Aries..11=Pisces)
const SL=['Ma','Ve','Me','Mo','Su','Me','Ve','Ma','Ju','Sa','Sa','Ju'];
const so=l=>Math.floor(n360(l)/30),no=l=>Math.floor(n360(l)/(360/27));
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtYr=y=>{const yr=Math.floor(y),mo=Math.floor((y-yr)*12);return`${MONTHS[mo]} ${yr}`;};
const fmtDt=c=>`${c.day.toString().padStart(2,'0')} ${MONTHS[c.month-1]} ${c.year}`;

// ─── VARSHPAL FUNCTIONS ───────────────────────────────────────────────────────

// Newton's method — converges in <10 iterations to ~1 second accuracy
function findSolarReturn(natalSunLon,birthYear,birthMonth,birthDay,targetYear,tz){
  let j=JD(targetYear,birthMonth,birthDay,12-tz);
  for(let i=0;i<60;i++){
    const sL=n360(sunLon(j)-ayanamsa(j));
    let diff=natalSunLon-sL;
    if(diff>180)diff-=360;if(diff<-180)diff+=360;
    j+=diff/0.9856;if(Math.abs(diff)<0.00001)break;
  }
  return j;
}

// Muntha progresses 1 sign/year from natal lagna
function getMuntha(natalLagna,birthYear,varshpalYear){
  const ns=so(natalLagna),age=varshpalYear-birthYear,ms=(ns+age)%12;
  return{sign:ms,signName:RS[ms],lord:SL[ms],lordName:FN[SL[ms]]};
}

// Mudda Vimshottari Dasha — same as Vimshottari but compressed to 1 year
// Starting lord = Varshpal Moon nakshatra lord
function getMuddaDasha(varshMoonLon,srJD){
  const nak=no(varshMoonLon),lord=NL[nak],nakLen=360/27;
  const frac=(n360(varshMoonLon)%nakLen)/nakLen;
  const lordDurDays=(DY[lord]/120)*365.25;
  let cursorJD=srJD-frac*lordDurDays;
  const endJD=srJD+365.25;
  const idx=DS.indexOf(lord),periods=[];
  for(let i=0;i<18;i++){
    const dk=DS[(idx+i)%9],durDays=(DY[dk]/120)*365.25,pStart=cursorJD,pEnd=cursorJD+durDays;
    if(pEnd>srJD&&pStart<endJD){
      const sc=JDtoCal(Math.max(pStart,srJD)),ec=JDtoCal(Math.min(pEnd,endJD));
      periods.push({lord:dk,lordName:FN[dk],startDate:fmtDt(sc),endDate:fmtDt(ec)});
    }
    cursorJD=pEnd;if(cursorJD>=endJD)break;
  }
  return periods;
}

// Panchadhikari — 4 key year lords
function getPanchadhikari(srLagna,natalLagna,natalMoonLon,munthaSign){
  return[
    {role:'Year Ascendant Lord',lord:SL[so(srLagna)],lordName:FN[SL[so(srLagna)]]},
    {role:'Birth Ascendant Lord',lord:SL[so(natalLagna)],lordName:FN[SL[so(natalLagna)]]},
    {role:'Muntha Lord',lord:SL[munthaSign],lordName:FN[SL[munthaSign]]},
    {role:'Trirashi Lord (Moon Sign)',lord:SL[so(natalMoonLon)],lordName:FN[SL[so(natalMoonLon)]]},
  ];
}

// Natal Vimshottari Dasha
function getDasha(ml,y,mo,d){
  const nak=no(ml),lord=NL[nak],nakLen=360/27,frac=(n360(ml)%nakLen)/nakLen;
  const bd=y+(mo-1)/12+(d-1)/365.25,fs=bd-frac*DY[lord],idx=DS.indexOf(lord);
  let seq=[],c=fs;
  for(let i=0;i<9;i++){const dk=DS[(idx+i)%9];seq.push({lord:dk,start:c,end:c+DY[dk]});c+=DY[dk];}
  const NOW=new Date().getFullYear()+new Date().getMonth()/12;
  return{nak,nakName:NK[nak],lord,seq,curr:seq.find(s=>s.start<=NOW&&s.end>NOW)};
}
function getAntardashas(mahaLord,mahaStart,mahaEnd){
  const totalYrs=mahaEnd-mahaStart,idx=DS.indexOf(mahaLord);
  const NOW=new Date().getFullYear()+new Date().getMonth()/12;
  let cursor=mahaStart;
  return DS.map((_,i)=>{const al=DS[(idx+i)%9],dur=totalYrs*DY[al]/120,s=cursor,e=cursor+dur;cursor=e;return{lord:al,lordName:FN[al],start:s,end:e,curr:s<=NOW&&e>NOW};});
}


// ─── MUDDA YOGINI DASHA ───────────────────────────────────────────────────────
const YOGINI_LORDS=['Mo','Su','Ju','Ma','Me','Sa','Ve','Ra'];
const YOGINI_NAMES=['Moon','Sun','Jupiter','Mars','Mercury','Saturn','Venus','Rahu'];
const YOGINI_KEYS=['Mangala','Pingala','Dhanya','Bhramari','Bhadrika','Ulka','Siddha','Sankata'];
const YOGINI_DUR=[1,2,3,4,5,6,7,8]; // years (36 total cycle)

function getMuddaYoginiDasha(varshMoonLon, srJD) {
  const nak=no(varshMoonLon);
  // Yogini lord determined by nakshatra mod 8
  const yIdx=nak%8;
  const nakLen=360/27,frac=(n360(varshMoonLon)%nakLen)/nakLen;
  const totalCycle=36*365.25;
  const lordDurDays=YOGINI_DUR[yIdx]*365.25;
  let cursorJD=srJD-frac*lordDurDays;
  const endJD=srJD+365.25;
  const periods=[];
  for(let i=0;i<12;i++){
    const idx2=(yIdx+i)%8;
    const durDays=YOGINI_DUR[idx2]*365.25;
    const pStart=cursorJD,pEnd=cursorJD+durDays;
    if(pEnd>srJD&&pStart<endJD){
      const sc=JDtoCal(Math.max(pStart,srJD)),ec=JDtoCal(Math.min(pEnd,endJD));
      const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const fmtD=c=>`${c.day.toString().padStart(2,'0')} ${MONTHS[c.month-1]} ${c.year}`;
      periods.push({
        lord:YOGINI_LORDS[idx2],lordName:YOGINI_NAMES[idx2],
        yoginiName:YOGINI_KEYS[idx2],
        startDate:fmtD(sc),endDate:fmtD(ec)
      });
    }
    cursorJD=pEnd;
    if(cursorJD>=endJD)break;
  }
  return periods;
}

// ─── SAHAM (ARABIC LOTS) ──────────────────────────────────────────────────────
// Each Saham = (Cusp A + Planet B - Planet C) mod 360, then find sign
// Using simplified Tajaka formulas (day chart)
function getSaham(srSid, srLagna) {
  const p=srSid, la=srLagna;
  const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  // Formula: Saham lon = (A + B - C) mod 360
  const calc=(a,b,c)=>n360(a+b-c);
  const lots={
    Fortune:    calc(la, p.Moon, p.Sun),
    Education:  calc(la, p.Mercury, p.Moon),
    Career:     calc(la, p.Mars, p.Sun),
    Love:       calc(la, p.Venus, p.Sun),
    Wellbeing:  calc(la, p.Jupiter, p.Saturn),
  };
  const SL2=['Mars','Venus','Mercury','Moon','Sun','Mercury','Venus','Mars','Jupiter','Saturn','Saturn','Jupiter'];
  return Object.entries(lots).map(([name,lon])=>({
    name,
    sign:RS[so(lon)],
    lord:SL2[so(lon)],
    deg:(lon%30).toFixed(1)
  }));
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────
module.exports = async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});

  const{year,month,day,hour,minute,tz,lat,lon,varshpalYear}=req.body;
  if(!year||!month||!day||lat===undefined||lon===undefined)
    return res.status(400).json({error:'Missing: year,month,day,lat,lon'});

  try{
    const y=+year,mo=+month,d=+day,h=+(hour||12),mi=+(minute||0),tzF=+(tz??5.5);
    const latF=+lat,lonF=+lon;
    const tYear=+(varshpalYear||new Date().getFullYear());

    // ── Natal Chart ──
    const natal=computeChart(y,mo,d,h,mi,tzF,latF,lonF);
    const nLagna=natal.lagna,nSun=natal.sid.Sun,nMoon=natal.sid.Moon;

    // ── Solar Return ──
    const srJD=findSolarReturn(nSun,y,mo,d,tYear,tzF);
    const srCal=JDtoCal(srJD);
    const srLocalH=srCal.hour+srCal.minute/60+tzF; // UTC→local
    const srHH=Math.floor(srLocalH%24),srMM=srCal.minute;
    const srDateStr=fmtDt({...srCal,month:srCal.month});
    const srTimeStr=`${srHH.toString().padStart(2,'0')}:${srMM.toString().padStart(2,'0')}`;

    // ── Varshpal Chart ──
    const srAy=ayanamsa(srJD);
    const srTrop={Sun:sunLon(srJD),Moon:moonLon(srJD),Mercury:planetLon(srJD,'Mercury'),Venus:planetLon(srJD,'Venus'),Mars:planetLon(srJD,'Mars'),Jupiter:planetLon(srJD,'Jupiter'),Saturn:planetLon(srJD,'Saturn'),Rahu:rahuLon(srJD),Ketu:n360(rahuLon(srJD)+180)};
    const srSid={};for(const[k,v]of Object.entries(srTrop))srSid[k]=n360(v-srAy);
    const srLagna=n360(calcLagna(srJD,latF,lonF)-srAy);
    const srLagnaSign=so(srLagna);

    const varshPlanets=Object.entries(srSid).map(([name,lon])=>({
      name,sign:so(lon),signName:RS[so(lon)],signShort:RSH[so(lon)],
      house:((so(lon)-srLagnaSign+12)%12)+1,
      deg:(lon%30).toFixed(1),retrograde:['Rahu','Ketu'].includes(name),
    }));

    // ── Muntha ──
    const muntha=getMuntha(nLagna,y,tYear);
    const munthaHouse=((muntha.sign-srLagnaSign+12)%12)+1;

    // ── Mudda Dasha ──
    const muddaDasha=getMuddaDasha(srSid.Moon,srJD);

    // ── Panchadhikari ──
    const panchadhikari=getPanchadhikari(srLagna,nLagna,nMoon,muntha.sign);

    // ── Natal Dasha ──
    const nDasha=getDasha(nMoon,y,mo,d);
    const currMaha=nDasha.curr;
    const antars=currMaha?getAntardashas(currMaha.lord,currMaha.start,currMaha.end):[];
    const currAntar=antars.find(a=>a.curr);

    // ── Natal Planets ──
    const natalPlanets=Object.entries(natal.sid).map(([name,lon])=>({
      name,sign:so(lon),signName:RS[so(lon)],
      house:((so(lon)-so(nLagna)+12)%12)+1,
      deg:(lon%30).toFixed(1),retrograde:['Rahu','Ketu'].includes(name),
    }));

    // Mudda Yogini Dasha
    const muddaYogini = getMuddaYoginiDasha(srSid.Moon, srJD);
    // Saham (5 focal points)
    const saham = getSaham(srSid, srLagna);

        return res.status(200).json({
      natal:{lagnaSign:RS[so(nLagna)],moonSign:RS[so(nMoon)],nakshatra:NK[no(nMoon)],planets:natalPlanets},
      solarReturn:{date:srDateStr,time:srTimeStr,year:tYear},
      varshpal:{lagnaSign:RS[srLagnaSign],lagna:srLagna.toFixed(2),year:tYear,planets:varshPlanets},
      muntha:{signName:muntha.signName,house:munthaHouse,lordName:muntha.lordName},
      muddaDasha,
      panchadhikari,
      mahadasha:currMaha?{
        lordName:FN[currMaha.lord],lord:currMaha.lord,
        period:`${fmtYr(currMaha.start)} – ${fmtYr(currMaha.end)}`,
        yearsRemaining:(currMaha.end-(new Date().getFullYear()+new Date().getMonth()/12)).toFixed(1),
      }:null,
      antardasha:currAntar?{
        lordName:FN[currAntar.lord],lord:currAntar.lord,
        period:`${fmtYr(currAntar.start)} – ${fmtYr(currAntar.end)}`,
        nextLordName:antars[antars.indexOf(currAntar)+1]?.lordName||null,
        nextPeriod:antars[antars.indexOf(currAntar)+1]?`${fmtYr(antars[antars.indexOf(currAntar)+1].start)} – ${fmtYr(antars[antars.indexOf(currAntar)+1].end)}`:null,
      }:null,
      muddaYogini,
      saham,
    });

  }catch(err){
    console.error('varshpal:',err);
    return res.status(500).json({error:err.message});
  }
}
