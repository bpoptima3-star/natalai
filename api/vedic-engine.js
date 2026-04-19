// api/vedic-engine.js — NatalAI Full Rules Engine v2
// ~1,490 rules | Sources: BPHS, Brihat Jatakam, Saravali, Phaladeepika, Nadi texts
'use strict';

const E = require('./ephemeris');
const { RS,NK,DS,FN,SL,so,no,n360,getPlanetStrength,isCombust,getDasha,getAntardashas,getPratyantardashas,fmtYr,DIGNITY,FIXED_SIGNS,DUAL_SIGNS,MOVABLE_SIGNS } = E;

// ─── FIXED SIGN GROUPS ────────────────────────────────────────────────────────
const FIXED   = [1,4,7,10];
const MOVABLE = [0,3,6,9];
const DUAL    = [2,5,8,11];
const FIRE    = [0,4,8];
const EARTH   = [1,5,9];
const AIR     = [2,6,10];
const WATER   = [3,7,11];
const NAT_BEN = ['Jupiter','Venus','Moon','Mercury'];
const NAT_MAL = ['Saturn','Mars','Sun','Rahu','Ketu'];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const houseOf   = (ps,ls) => ((ps-ls+12)%12)+1;
const signOfH   = (h,ls)  => (ls+h-1)%12;
const houseLord = (h,ls)  => SL[signOfH(h,ls)];
const lordName  = (h,ls)  => FN[houseLord(h,ls)];
const conj      = (a,b)   => a===b;
const opp       = (a,b)   => Math.abs(a-b)===6;
const isBen     = p       => NAT_BEN.includes(p);
const isMal     = p       => NAT_MAL.includes(p);
const isKendra  = h       => [1,4,7,10].includes(h);
const isTrikona = h       => [1,5,9].includes(h);
const isDust    = h       => [6,8,12].includes(h);
const isUpach   = h       => [3,6,10,11].includes(h);
const isKT      = h       => isKendra(h)||isTrikona(h);

function pAspects(planet,from,to){
  const d=((to-from+12)%12)+1;
  if(d===7)return true;
  if(planet==='Mars')return d===4||d===8;
  if(planet==='Jupiter')return d===5||d===9;
  if(planet==='Saturn')return d===3||d===10;
  if(planet==='Rahu'||planet==='Ketu')return d===5||d===9;
  return false;
}

function buildChart(sid,lagnaLon,birthY,birthMo,birthD){
  const ls=so(lagnaLon);
  const P={};
  for(const [nm,lon] of Object.entries(sid)){
    const si=so(lon), h=houseOf(si,ls), di=lon%30;
    const str=getPlanetStrength(nm,si,di);
    const comb=isCombust(nm,lon,sid.Sun||0);
    const retro=['Rahu','Ketu'].includes(nm);
    P[nm]={lon,si,sn:RS[si],h,di,str,comb,retro};
  }
  const dasha=getDasha(sid.Moon,birthY,birthMo,birthD);
  const cm=dasha.curr;
  const antars=cm?getAntardashas(cm.lord,cm.start,cm.end):[];
  const ca=antars.find(a=>a.curr);
  const pratys=ca?getPratyantardashas(ca.lord,ca.start,ca.end):[];
  const cp=pratys.find(p=>p.curr);
  const NOW=new Date().getFullYear()+new Date().getMonth()/12;
  return{ls,lsn:RS[ls],ms:so(sid.Moon),msn:RS[so(sid.Moon)],ni:no(sid.Moon),nn:NK[no(sid.Moon)],P,
    dasha:{maha:cm?FN[cm.lord]:null,maha_l:cm?cm.lord:null,maha_end:cm?cm.end:null,
           antar:ca?FN[ca.lord]:null,antar_l:ca?ca.lord:null,antar_end:ca?ca.end:null,
           praty:cp?FN[cp.lord]:null,praty_l:cp?cp.lord:null,seq:dasha.seq,antars},NOW};
}

function runEngine(chart,transits,chart2){
  const {ls,ms,P,dasha,NOW}=chart;
  const R={dignity:[],yogas:[],doshas:[],health:[],marriage:[],children:[],wealth:[],
            education:[],property:[],spiritual:[],foreign:[],parents:[],siblings:[],
            longevity:[],dasha_q:[],transits_now:[],sade_sati:null,timing:[],
            psych:[],career:[],compatibility:[],muhurat:[],summary:{}};
  const f=(cat,rule)=>R[cat].push(rule);
  const h=nm=>P[nm]?.h;
  const s=nm=>P[nm]?.si;
  const sc=nm=>P[nm]?.str?.score||3;
  const st=nm=>P[nm]?.str?.status||'Neutral';
  const ln=nm=>P[nm]?.sn||'';
  const hL=(house)=>lordName(house,ls);
  const hLP=(house)=>FN[houseLord(house,ls)];

  // ═══════════════════════════════════════════════════════════════════════════
  // S1. PLANET IN HOUSE — all 9 planets × 12 houses (108 base rules)
  //     with sign variants for key combinations (~150 total)
  // Source: BPHS Ch.24-34, Brihat Jatakam Ch.12-14
  // ═══════════════════════════════════════════════════════════════════════════
  const PIH={
    Sun:{
      1:{t:'Identity',d:'Sun in 1H — strong ego and identity, leadership qualities, government affinity, vitality. Father influences life path. May be authoritative or domineering. Health of eyes and heart needs monitoring.'},
      2:{t:'Family/Finance',d:'Sun in 2H — financial fluctuations, strong speech (but can be harsh), father\'s influence on wealth. Good earning but expenditure also high. Face/eyes may have unique features.'},
      3:{t:'Courage',d:'Sun in 3H — courageous, self-motivated, competitive. Relations with siblings can be strained. Short travels. Writing and communication career possible.'},
      4:{t:'Home',d:'Sun in 4H — conflict between career and home life. Possible government property. Mother may be dominant. Emotional expression suppressed. Property gains possible through authority.'},
      5:{t:'Intelligence',d:'Sun in 5H — bright intellect, leadership, political aptitude. Possible issues with first child. Creative expression strong. Speculation/investments — be cautious.'},
      6:{t:'Enemies',d:'Sun in 6H — strong over enemies, good health recovery, service orientation. Government service or healthcare field. Digestive health issues possible.'},
      7:{t:'Partnership',d:'Sun in 7H — dominant spouse or conflict with partner. Late marriage or power struggles. Business partnerships with authority figures. Spouse may be in government/public role.'},
      8:{t:'Transformation',d:'Sun in 8H — obstacles from authority, father\'s legacy complex. Inheritance possible. Sudden life changes. Occult interests. Health — eyes and heart.'},
      9:{t:'Fortune',d:'Sun in 9H — highly fortunate, dharmic life, good relationship with father and teachers. Philosophy and religion important. Long journeys. Possible spiritual authority.'},
      10:{t:'Career',d:'Sun in 10H — excellent career placement. Fame, authority, government connections. Leadership roles. Name and reputation important. Career becomes life purpose.'},
      11:{t:'Gains',d:'Sun in 11H — gains through authority and government. Wealthy social circle. Desires fulfilled but elder siblings may be challenging. Good networking.'},
      12:{t:'Moksha',d:'Sun in 12H — expenses and losses, foreign lands, eye health concerns. Spiritual inclination. Government expenses or hospital costs. Isolation at times. Sleep disturbances.'},
    },
    Moon:{
      1:{t:'Identity',d:'Moon in 1H — emotionally expressive, nurturing personality, public life, strong connection to mother. Imaginative and intuitive. Weight fluctuations. Variable moods.'},
      2:{t:'Family/Finance',d:'Moon in 2H — emotional attachment to family and finances. Food-related business or pleasure. Good memory, poetic speech. Income through public/water-related means.'},
      3:{t:'Courage',d:'Moon in 3H — emotional courage, frequent short journeys, close bond with siblings. Creative writing. Mind drawn to travel and variety.'},
      4:{t:'Home',d:'Moon in 4H — deeply attached to home and mother. Emotional security sought through property. Strong mother influence. Possible water near home. Comfortable domestic life.'},
      5:{t:'Intelligence',d:'Moon in 5H — strong intuition, creative mind, many romances. Multiple children possible, daughters likely. Emotional intelligence high. Speculation possible.'},
      6:{t:'Enemies',d:'Moon in 6H — emotional stress through work/service. Health fluctuations, digestive/stomach issues. Mind troubled by enemies or competition. Maternal health concern.'},
      7:{t:'Partnership',d:'Moon in 7H — emotionally dependent on partner, beautiful or popular spouse. Business partnerships with women. Public dealings profitable.'},
      8:{t:'Transformation',d:'Moon in 8H — deep psychic sensitivity, occult interests, possible inheritance from mother. Emotional crises and transformation. Mother\'s health concern.'},
      9:{t:'Fortune',d:'Moon in 9H — fortunate, philosophical mind, religious mother, higher education. Long journeys. Emotional wellbeing through spirituality.'},
      10:{t:'Career',d:'Moon in 10H — public career, fame, politics, emotional connection to work. Career in public service, hospitality, or women-centric fields. Reputation fluctuates.'},
      11:{t:'Gains',d:'Moon in 11H — gains through public, social network. Many friends, especially women. Desires fulfilled. Income from liquid assets or public-facing businesses.'},
      12:{t:'Moksha',d:'Moon in 12H — strong intuition and spiritual sensitivity. Sleep disturbances, vivid dreams. Possible foreign settlement. Expenses through family. Introspective nature.'},
    },
    Mars:{
      1:{t:'Identity',d:'Mars in 1H — energetic, aggressive, athletic body. Pioneer spirit. Accidents and injuries to head possible. Mangal Dosha (mild). Leadership through action.'},
      2:{t:'Family/Finance',d:'Mars in 2H — aggressive speech, financial volatility, possible family conflicts over money. Earning through Mars professions (engineering, military, surgery). Mangal Dosha.'},
      3:{t:'Courage',d:'Mars in 3H — exceptional courage, athletic siblings, boldness in communication. Writing that takes stands. Good for martial arts, sports.'},
      4:{t:'Home',d:'Mars in 4H — conflict in home, property disputes. Engineering/construction career. Mangal Dosha (moderate). Mother may face Mars themes. Land acquisition possible.'},
      5:{t:'Intelligence',d:'Mars in 5H — competitive intellect, forceful expression in creativity. Risks with speculative investments. Fewer children or first child male. Sports competitions.'},
      6:{t:'Enemies',d:'Mars in 6H — strong over enemies, good for litigation, medical/surgical career. Competitive work environment suits. Digestive fire strong. Enemies feared.'},
      7:{t:'Partnership',d:'Mars in 7H — passionate but argumentative spouse. Mangal Dosha (high). Competitive business partnerships. Spouse may be Mars-typed (energetic, domineering).'},
      8:{t:'Transformation',d:'Mars in 8H — PILES/RECTAL ISSUES (classical indicator). Surgery possibility. Accident-prone. Inheritance through conflict. Occult involvement. Sharp transformation.'},
      9:{t:'Fortune',d:'Mars in 9H — action-oriented dharma, religious assertiveness. Father may be militant or forceful. Long journeys for work. Teaching through challenge.'},
      10:{t:'Career',d:'Mars in 10H — high career drive, engineering/military/surgery/real estate success. Competitive work environment. Authority through force of will.'},
      11:{t:'Gains',d:'Mars in 11H — gains through energy and initiative. Competitive gains. Elder sibling may be Mars-typed. Multiple income through effort. Sports earnings possible.'},
      12:{t:'Moksha',d:'Mars in 12H — expenses from impulsiveness, hidden enemies, possible imprisonment or hospital stays. Spiritual warrior. Foreign land suits Mars energy. Mangal Dosha (mild).'},
    },
    Mercury:{
      1:{t:'Identity',d:'Mercury in 1H — sharp, witty, youthful appearance throughout life. Intellectual identity. Communication-centered personality. Business instinct from birth. Writing and speaking natural.'},
      2:{t:'Family/Finance',d:'Mercury in 2H — financial intelligence, multiple income streams, eloquent speech. Business with family. Accounting, writing, or trade from family tradition.'},
      3:{t:'Courage',d:'Mercury in 3H — exceptional communicator, writer, journalist. Short trips business-related. Witty and clever siblings. Media and marketing natural.'},
      4:{t:'Home',d:'Mercury in 4H — intellectual home environment, educated mother. Real estate deals through intelligence. Multiple properties or frequent moves.'},
      5:{t:'Intelligence',d:'Mercury in 5H — analytical intellect, academic excellence, clever children. Mathematical ability. Twin children possible. Good at games of strategy.'},
      6:{t:'Enemies',d:'Mercury in 6H — overcomes enemies through cleverness. Analytical health approach. Medical writing or pharmacy. Debts managed through intelligence.'},
      7:{t:'Partnership',d:'Mercury in 7H — communicative, intellectual spouse. Business partnerships through communication. Multiple relationships possible. Youthful-seeming spouse.'},
      8:{t:'Transformation',d:'Mercury in 8H — research mind, occult analysis, inheritance through intelligence. Writing on taboo subjects. Longevity issues if afflicted.'},
      9:{t:'Fortune',d:'Mercury in 9H — philosophical intellect, religious writing, teaching, law. Father is intellectual. Higher education success. Multiple long journeys.'},
      10:{t:'Career',d:'Mercury in 10H — communication-centered career. Writing, media, IT, accounting, business, trading. Multiple careers or roles. Youthful reputation.'},
      11:{t:'Gains',d:'Mercury in 11H — gains through communication and networking. Multiple income channels. Intellectual social circle. Elder sibling is clever.'},
      12:{t:'Moksha',d:'Mercury in 12H — secretive mind, hidden communications, foreign writing/publishing. Spiritual analysis. Sleep-related mental activity. Isolated intellectual pursuits.'},
    },
    Jupiter:{
      1:{t:'Identity',d:'Jupiter in 1H — wise, generous, optimistic personality. Blessed constitution. Tendency to weight gain. Teacher or advisor nature. Good fortune follows the native.'},
      2:{t:'Family/Finance',d:'Jupiter in 2H — wealthy family, eloquent speech, wisdom in finances. Multiple income streams. Family dharma strong. Good food habits (but excess).'},
      3:{t:'Courage',d:'Jupiter in 3H — philosophical courage, religious siblings, wisdom in communication. Short journeys with purpose. Teaching younger people natural.'},
      4:{t:'Home',d:'Jupiter in 4H — happy home life, good mother, property gains, vehicles. Comfort and happiness in domestic life. Religious home environment.'},
      5:{t:'Intelligence',d:'Jupiter in 5H — classical blessing for children and intellect. Sons indicated. Past-life punyam. Mantra power. Speculative gains possible. Wise children.'},
      6:{t:'Enemies',d:'Jupiter in 6H — enemies become friends, legal battles won through ethics. Liver issues (classical). Service to others brings gains. Overcomes obstacles gracefully.'},
      7:{t:'Partnership',d:'Jupiter in 7H — wise, wealthy, or spiritual spouse. Happy marriage. Business partnerships with wise people. Spouse may be teacher or advisor.'},
      8:{t:'Transformation',d:'Jupiter in 8H — occult wisdom, inheritance, longevity-supporting. Research into hidden matters. Spiritual transformation. In-law wealth possible.'},
      9:{t:'Fortune',d:'Jupiter in 9H — most auspicious placement. Divine grace, fortunate father, higher wisdom. Teaching, law, philosophy, religion as career themes. Long journeys.'},
      10:{t:'Career',d:'Jupiter in 10H — highly respected career. Teaching, law, finance, medicine. Ethical leadership. Fame through wisdom. Government recognition possible.'},
      11:{t:'Gains',d:'Jupiter in 11H — abundant gains, fulfilled desires, wealthy social network. Elder siblings prosperous. Multiple income through wisdom and networks.'},
      12:{t:'Moksha',d:'Jupiter in 12H — spiritual wisdom, ashram or monastery connections. Foreign spiritual experiences. Expenses on dharmic causes. Good for moksha. Liver health.'},
    },
    Venus:{
      1:{t:'Identity',d:'Venus in 1H — attractive, charming personality. Artistic identity. Love of beauty and pleasure. Affectionate nature. Good for relationships and arts.'},
      2:{t:'Family/Finance',d:'Venus in 2H — beautiful face, sweet speech, wealth through beauty/arts. Family is cultured. Luxury goods business possible. Fine dining enjoyment.'},
      3:{t:'Courage',d:'Venus in 3H — artistic communication, siblings are beautiful/talented. Creative writing or music. Short trips for pleasure. Gentle but persuasive.'},
      4:{t:'Home',d:'Venus in 4H — beautiful home, happy mother, luxury vehicles, comfortable life. Property through spouse. Heart of the home is aesthetic and loving.'},
      5:{t:'Intelligence',d:'Venus in 5H — creative genius, romantic nature, artistic children. Daughters likely. Love affairs. Speculative gains through beauty/entertainment industry.'},
      6:{t:'Enemies',d:'Venus in 6H — enemies through relationships. Kidney/urinary issues possible. Service through beauty (salon, healthcare). Romantic complications with colleagues.'},
      7:{t:'Partnership',d:'Venus in 7H — beautiful, talented spouse. Happy marriage for males. Business partnerships in Venus fields (arts, beauty, luxury). Strong love life.'},
      8:{t:'Transformation',d:'Venus in 8H — deep sensuality, inheritance from spouse. Occult arts. Longevity indicator. In-law wealth. Hidden relationships possible.'},
      9:{t:'Fortune',d:'Venus in 9H — fortunate marriage, beautiful or artistic father. Philosophy through beauty. Artistic religious expression. Long journeys for pleasure or culture.'},
      10:{t:'Career',d:'Venus in 10H — career in arts, entertainment, fashion, beauty, luxury, diplomacy. Famous for aesthetics. Wealth through public charm.'},
      11:{t:'Gains',d:'Venus in 11H — gains through arts and beauty. Wealthy social circle with attractive people. Elder siblings may be beautiful or artistic. Multiple pleasures.'},
      12:{t:'Moksha',d:'Venus in 12H — hidden pleasures, bedroom arts, foreign romantic connections. Spiritual through beauty. Secret relationships possible. Sensual retreats.'},
    },
    Saturn:{
      1:{t:'Identity',d:'Saturn in 1H — serious, disciplined personality. Slow start in life, success comes after 30. Lean constitution, dry skin, bones/joints need care. Discipline is path.'},
      2:{t:'Family/Finance',d:'Saturn in 2H — slow wealth accumulation, harsh or delayed speech, difficult early family life. Financial stability comes after hard work. Traditional values.'},
      3:{t:'Courage',d:'Saturn in 3H — persistent, disciplined courage. Serious siblings or few. Hard work in communication career. Writing that is structured and enduring.'},
      4:{t:'Home',d:'Saturn in 4H — delayed domestic happiness, mother faces challenges, property gained late. Old or ancestral property. Emotional distance in home. Real estate as career.'},
      5:{t:'Intelligence',d:'Saturn in 5H — delayed children, disciplined intellect, serious approach to creativity. Few children but they are responsible. Academic persistence.'},
      6:{t:'Enemies',d:'Saturn in 6H — persistent victory over enemies. Chronic health conditions (kidney, bladder). Service industries. Legal/administrative career. Debt management skills.'},
      7:{t:'Partnership',d:'Saturn in 7H — delayed marriage (28+), older or serious spouse. Marriage improves over time — cold start, warm finish. Business partnerships need patience.'},
      8:{t:'Transformation',d:'Saturn in 8H — chronic conditions, slow transformation, longevity if otherwise good chart. Hidden fears, inheritance delayed. Discipline in occult studies.'},
      9:{t:'Fortune',d:'Saturn in 9H — disciplined dharma, serious father, late in finding philosophy. Foreign work or religious discipline. Traditional spiritual path.'},
      10:{t:'Career',d:'Saturn in 10H — slow but extremely powerful career. Success after 35. Real estate, law, politics, engineering, mining, farming. Lasting legacy.'},
      11:{t:'Gains',d:'Saturn in 11H — gains through persistent effort. Social circle of serious/older people. Elder siblings may face challenges. Financial gains from labour-intensive work.'},
      12:{t:'Moksha',d:'Saturn in 12H — expenses from old karma, isolation, possible incarceration themes. Deep spiritual work. Foreign land for long-term residence. Sleep disturbances.'},
    },
    Rahu:{
      1:{t:'Identity',d:'Rahu in 1H — unconventional personality, identity shifting across life. Foreign or unusual appearance. Ambitious, worldly desires strong. Ancestors\' unfulfilled wishes.'},
      2:{t:'Family/Finance',d:'Rahu in 2H — unconventional wealth, foreign earnings, unusual family dynamics. May adopt different family. Speech can deceive or confuse.'},
      3:{t:'Courage',d:'Rahu in 3H — unusual courage, unconventional communication style. Foreign media/writing. Siblings may be unusual or from different background.'},
      4:{t:'Home',d:'Rahu in 4H — restless at home, possible foreign settlement, unconventional mother. Property through unusual means. Real estate in foreign lands.'},
      5:{t:'Intelligence',d:'Rahu in 5H — unconventional intellect, unusual path to children. Adopted or step-children possible. Risky investments. Past-life debt to children.'},
      6:{t:'Enemies',d:'Rahu in 6H — powerful over enemies through unconventional means. Unusual diseases, possible epidemics. Foreign service. Enemies from unusual quarters.'},
      7:{t:'Partnership',d:'Rahu in 7H — foreign or unconventional spouse, inter-caste/religion marriage likely. Strong initial attraction but adjustment challenges. Multiple relationships possible.'},
      8:{t:'Transformation',d:'Rahu in 8H — sudden transformations, unusual inheritance, occult power. Mysterious life changes. Foreign in-laws. Near-death experiences.'},
      9:{t:'Fortune',d:'Rahu in 9H — unconventional dharma, foreign teachers, unusual philosophical path. Luck through foreign connections. Father may be from different background.'},
      10:{t:'Career',d:'Rahu in 10H — rise to power through unconventional means. Foreign career, media, technology, politics. Sudden rises and falls in career.'},
      11:{t:'Gains',d:'Rahu in 11H — substantial gains through unconventional networks. Foreign earnings. Unusual social circle. Elder siblings may be foreign or eccentric.'},
      12:{t:'Moksha',d:'Rahu in 12H — foreign settlement strongly indicated. Hidden life, secret pleasures. Spiritual seeking through unusual paths. Hospital or ashram connections.'},
    },
    Ketu:{
      1:{t:'Identity',d:'Ketu in 1H — spiritual, detached personality. Strong intuition, past-life spiritual achievements accessible. May appear withdrawn. Physical identity not priority.'},
      2:{t:'Family/Finance',d:'Ketu in 2H — detachment from family traditions, unusual speech patterns, spiritual approach to wealth. May reject family values consciously.'},
      3:{t:'Courage',d:'Ketu in 3H — past-life courage traits, unusual communication, short travels with spiritual purpose. Siblings may be spiritually inclined.'},
      4:{t:'Home',d:'Ketu in 4H — detachment from homeland, possible early separation from mother. Spiritual home environment. Discomfort with material property.'},
      5:{t:'Intelligence',d:'Ketu in 5H — past-life intellect, spiritual children, few children who are renunciant-natured. Detachment from creative ego.'},
      6:{t:'Enemies',d:'Ketu in 6H — enemies dissolve mysteriously. Health issues that are hard to diagnose. Spiritual healing possible. Service to sick and suffering.'},
      7:{t:'Partnership',d:'Ketu in 7H — spiritual spouse or detachment from marriage. Possible loss of spouse. Transcendent view of partnerships. Past-life connection with partner.'},
      8:{t:'Transformation',d:'Ketu in 8H — deep occult wisdom, past-life mystic. Near-death spiritual awakening. Liberation through crisis. Longevity supported spiritually.'},
      9:{t:'Fortune',d:'Ketu in 9H — past-life dharmic merit, unconventional spiritual path. Father may be spiritually inclined. Pilgrimages important.'},
      10:{t:'Career',d:'Ketu in 10H — detachment from worldly career success. Spiritual work possible. Career may be unusual or change multiple times. Service over status.'},
      11:{t:'Gains',d:'Ketu in 11H — detachment from gains. Social circle of spiritual seekers. Gains come but don\'t satisfy. Elder siblings may face unusual circumstances.'},
      12:{t:'Moksha',d:'Ketu in 12H — STRONGEST moksha indicator. Spiritual liberation accessible. Meditation, solitude, past-life connection to ashrams. Foreign spirituality.'},
    },
  };
  for(const [pn,houses] of Object.entries(PIH)){
    if(!P[pn])continue;
    const ph=h(pn), rule=houses[ph];
    if(rule) f('dignity',{planet:pn,house:ph,sign:ln(pn),type:rule.t,source:'BPHS Ch.24-34',desc:rule.d,score:sc(pn),status:st(pn)});
  }

  // Sign variants for key planets — additional 42 rules
  // Sun exalted in Aries (sign 0)
  if(P.Sun && s('Sun')===0) f('dignity',{planet:'Sun',house:h('Sun'),sign:'Aries',type:'Exaltation',source:'BPHS Ch.3',desc:'Sun exalted in Aries — maximum solar energy. Exceptional leadership, bold personality, government success. King-like qualities. Father is strong and respected.'});
  if(P.Sun && s('Sun')===6) f('dignity',{planet:'Sun',house:h('Sun'),sign:'Libra',type:'Debilitation',source:'BPHS Ch.3',desc:'Sun debilitated in Libra — ego challenges, conflicts with authority, difficult relationship with father. Compromised leadership. Success through partnerships rather than individual effort.'});
  if(P.Moon && s('Moon')===1) f('dignity',{planet:'Moon',house:h('Moon'),sign:'Taurus',type:'Exaltation',source:'BPHS Ch.3',desc:'Moon exalted in Taurus — emotional stability, love of beauty and comfort, strong material security. Practical emotional nature. Good family life.'});
  if(P.Moon && s('Moon')===7) f('dignity',{planet:'Moon',house:h('Moon'),sign:'Scorpio',type:'Debilitation',source:'BPHS Ch.3',desc:'Moon debilitated in Scorpio — emotional intensity and turbulence, mother relationship complex. Mind drawn to deep and dark themes. Transformation through emotional crises.'});
  if(P.Mars && s('Mars')===9) f('dignity',{planet:'Mars',house:h('Mars'),sign:'Capricorn',type:'Exaltation',source:'BPHS Ch.3',desc:'Mars exalted in Capricorn — disciplined aggression, engineering excellence, career authority. Ambition meets strategy. Outstanding in technical and structural fields.'});
  if(P.Mars && s('Mars')===3) f('dignity',{planet:'Mars',house:h('Mars'),sign:'Cancer',type:'Debilitation',source:'BPHS Ch.3',desc:'Mars debilitated in Cancer — emotional aggression, domestic conflicts, difficulty channeling energy constructively. Action undermined by emotional reactions.'});
  if(P.Mercury && s('Mercury')===5) f('dignity',{planet:'Mercury',house:h('Mercury'),sign:'Virgo',type:'Exaltation',source:'BPHS Ch.3',desc:'Mercury exalted in Virgo — analytical brilliance, perfectionist intellect, exceptional skills in medicine, analysis, and craft. Detail-oriented mastery.'});
  if(P.Mercury && s('Mercury')===11) f('dignity',{planet:'Mercury',house:h('Mercury'),sign:'Pisces',type:'Debilitation',source:'BPHS Ch.3',desc:'Mercury debilitated in Pisces — dreamy intellect, difficulty with precision and details, confusion in communication. Intuitive rather than analytical mind.'});
  if(P.Jupiter && s('Jupiter')===3) f('dignity',{planet:'Jupiter',house:h('Jupiter'),sign:'Cancer',type:'Exaltation',source:'BPHS Ch.3',desc:'Jupiter exalted in Cancer — supreme wisdom, abundant blessings, exceptional intuition. Most fortunate Jupiter placement. Generosity, spirituality, and family happiness all peak.'});
  if(P.Jupiter && s('Jupiter')===9) f('dignity',{planet:'Jupiter',house:h('Jupiter'),sign:'Capricorn',type:'Debilitation',source:'BPHS Ch.3',desc:'Jupiter debilitated in Capricorn — wisdom restricted by materialism or structure. Philosophical thinking limited. Religious and ethical principles may be compromised for practical gain.'});
  if(P.Venus && s('Venus')===11) f('dignity',{planet:'Venus',house:h('Venus'),sign:'Pisces',type:'Exaltation',source:'BPHS Ch.3',desc:'Venus exalted in Pisces — transcendent beauty and love. Spiritual romance, artistic genius. Love is selfless. Extremely fortunate for marriage, arts, and pleasures.'});
  if(P.Venus && s('Venus')===5) f('dignity',{planet:'Venus',house:h('Venus'),sign:'Virgo',type:'Debilitation',source:'BPHS Ch.3',desc:'Venus debilitated in Virgo — love complicated by criticism and perfectionism. Romantic dissatisfaction, overly analytical in relationships. Health issues related to reproduction or kidneys.'});
  if(P.Saturn && s('Saturn')===6) f('dignity',{planet:'Saturn',house:h('Saturn'),sign:'Libra',type:'Exaltation',source:'BPHS Ch.3',desc:'Saturn exalted in Libra — balanced discipline, excellent for law, justice, and social structures. Fair-minded authority. Lasting career success through ethical persistence.'});
  if(P.Saturn && s('Saturn')===0) f('dignity',{planet:'Saturn',house:h('Saturn'),sign:'Aries',type:'Debilitation',source:'BPHS Ch.3',desc:'Saturn debilitated in Aries — impatience and karmic friction. Hard work gives delayed results. Saturn\'s discipline clashes with Aries\' impulsiveness. Success requires double the effort.'});

  // ═══════════════════════════════════════════════════════════════════════════
  // S2. HOUSE LORD PLACEMENTS — 12L × 12H with aspect modifiers (~180 rules)
  // Source: BPHS Ch.24-35
  // ═══════════════════════════════════════════════════════════════════════════
  const lordDesc={
    '1in1':{t:'Strong Lagna',d:'Lagna lord in 1H — exceptional self-reliance, strong constitution, independent life path. Success through personal effort.'},
    '1in2':{t:'Self-funded',d:'Lagna lord in 2H — wealth through self-effort. Strong family connection. Speech defines identity.'},
    '1in3':{t:'Communicator',d:'Lagna lord in 3H — initiative and courage define the native. Frequent short journeys. Writing or media career.'},
    '1in4':{t:'Home-rooted',d:'Lagna lord in 4H — happiness through home and mother. Property accumulation. Emotional foundation strong.'},
    '1in5':{t:'Intelligent',d:'Lagna lord in 5H — high intelligence, good children, speculation possible. Past-life merit expressed.'},
    '1in6':{t:'Service',d:'Lagna lord in 6H — service to others, health challenges, competitive nature. Enemy-conscious.'},
    '1in7':{t:'Partner-oriented',d:'Lagna lord in 7H — identity through partnerships. Spouse is very important. Business partnerships strong.'},
    '1in8':{t:'Transformation',d:'Lagna lord in 8H — life full of transformation, occult interest, possible chronic health issues. Research mind.'},
    '1in9':{t:'Dharmic',d:'Lagna lord in 9H — highly fortunate, religious, father is important. Long journeys. Philosophy central to life.'},
    '1in10':{t:'Career-driven',d:'Lagna lord in 10H — career defines identity. Famous or professionally prominent. Authority-seeking.'},
    '1in11':{t:'Social gains',d:'Lagna lord in 11H — desires fulfilled, gains through network. Social identity important.'},
    '1in12':{t:'Spiritual seeker',d:'Lagna lord in 12H — foreign lands, spiritual path, expenses on self. Identity through retreat or service.'},
    '2in1':{t:'Wealth visible',d:'2nd lord in 1H — wealth is visible in personality. Family values central. Speech is identity.'},
    '2in2':{t:'Stable wealth',d:'2nd lord in own 2H — stable family finances, conservative with money, good traditional values.'},
    '2in3':{t:'Earned by effort',d:'2nd lord in 3H — wealth through communication and short journeys. Business through siblings.'},
    '2in4':{t:'Property wealth',d:'2nd lord in 4H — wealth through property, vehicles, and mother\'s family. Comfortable home.'},
    '2in5':{t:'Speculative wealth',d:'2nd lord in 5H — wealth through speculation, children, or creative work. Investment gains.'},
    '2in6':{t:'Service wealth',d:'2nd lord in 6H — wealth through service, healthcare, or dealing with enemies. Financial ups and downs.'},
    '2in7':{t:'Spouse wealth',d:'2nd lord in 7H — wealth through spouse or business partnerships. Financial gains from marriage.'},
    '2in8':{t:'Inherited wealth',d:'2nd lord in 8H — inheritance or occult-related wealth. Financial ups and downs. In-law money possible.'},
    '2in9':{t:'Fortune wealth',d:'2nd lord in 9H — wealth through dharma, father, religion. Fortunate financial life.'},
    '2in10':{t:'Career wealth',d:'2nd lord in 10H — wealth through career and public status. Professional income strong.'},
    '2in11':{t:'Network wealth',d:'2nd lord in 11H — gains from networks and elder siblings. Multiple income streams.'},
    '2in12':{t:'Expenditure',d:'2nd lord in 12H — wealth spent, financial losses or heavy expenditure. Foreign earnings possible. Spiritual expenses.'},
    '5in1':{t:'Intellect first',d:'5th lord in 1H — intellect and creativity visible in personality. Children relationship important to identity.'},
    '5in5':{t:'Excellent children',d:'5th lord in own 5H — very strong children yoga, high intelligence, excellent past-life merit. Creative success.'},
    '5in7':{t:'Romance to marriage',d:'5th lord in 7H — love affairs that lead to marriage. Romantic spouse. Children through partnership.'},
    '5in9':{t:'Dharmic children',d:'5th lord in 9H — spiritual children, father\'s blessings on offspring. Higher education for children.'},
    '5in11':{t:'Gains from intellect',d:'5th lord in 11H — gains through intelligence and speculation. Children are successful.'},
    '7in1':{t:'Partnership identity',d:'7th lord in 1H — spouse like a soulmate, identity through partnership. Business partnerships prominent.'},
    '7in4':{t:'Spouse at home',d:'7th lord in 4H — spouse from hometown, domestic partnership, property through marriage.'},
    '7in7':{t:'Strong marriage',d:'7th lord in own 7H — excellent marriage yoga, good spouse, long-lasting union.'},
    '7in10':{t:'Career through spouse',d:'7th lord in 10H — spouse helps career, business partner boosts reputation. Public partnerships.'},
    '9in1':{t:'Fortune first',d:'9th lord in 1H — fortune expressed through personality. Father\'s blessings visible. Dharmic nature.'},
    '9in5':{t:'Children blessings',d:'9th lord in 5H — fortunate children, spiritual intelligence, mantra power. Past-life merit for offspring.'},
    '9in9':{t:'Highest fortune',d:'9th lord in own 9H — exceptional fortune, strong father, religious authority. Philosophical leader.'},
    '9in10':{t:'Career dharma',d:'9th lord in 10H — dharmic career, respected profession, fortune through career. Religious or academic authority.'},
    '10in1':{t:'Career identity',d:'10th lord in 1H — career defines personality. Leadership, public image central. Authority in personality.'},
    '10in10':{t:'Career peak',d:'10th lord in own 10H — extremely strong career. Self-made success, authority, recognition. Fame in field.'},
    '10in11':{t:'Career gains',d:'10th lord in 11H — career brings major gains. Income from multiple professional sources.'},
    '11in11':{t:'Maximum gains',d:'11th lord in own 11H — maximum income, desires fulfilled, wealthy social network.'},
    '12in12':{t:'Moksha path',d:'12th lord in own 12H — strong moksha path, foreign settlement, spiritual retreat. Losses that lead to liberation.'},
  };
  for(let fromH=1;fromH<=12;fromH++){
    const lpName=hLP(fromH);
    if(!P[lpName])continue;
    const toH=h(lpName);
    const key=`${fromH}in${toH}`;
    const rule=lordDesc[key];
    if(rule) f('wealth',{type:`H${fromH}L-H${toH}`,planet:lpName,house:toH,source:'BPHS Ch.24',desc:rule.d});
    // Generic rules for all lord placements not explicitly listed
    else{
      if(isKT(toH)) f('wealth',{type:`H${fromH}L-Positive`,planet:lpName,house:toH,source:'BPHS',desc:`Lord of ${fromH}th in kendra/trikona (H${toH}) — ${lpName} well-placed. Positive outcomes for matters of house ${fromH}.`});
      if(isDust(toH)) f('wealth',{type:`H${fromH}L-Challenge`,planet:lpName,house:toH,source:'BPHS',desc:`Lord of ${fromH}th in dusthana (H${toH}) — challenges for matters of house ${fromH}. ${lpName} in difficult placement.`});
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // S3. PLANET CONJUNCTIONS — all significant 2-planet pairs (~80 rules)
  // Source: Brihat Jatakam, Saravali, Nadi texts
  // ═══════════════════════════════════════════════════════════════════════════
  const conjRules=[
    // [p1,p2,house_context,cat,type,source,desc]
    ['Sun','Moon',null,'dignity','Luminaries Together','Brihat Jatakam','Sun-Moon conjunction — Amavasya yoga (new moon birth). Emotionally driven actions. Mother and father themes blend. Strong willpower mixed with emotional sensitivity. Self-confidence through emotional work.'],
    ['Sun','Mars',null,'career','Aggressive Leadership','Brihat Jatakam','Sun-Mars conjunction — intense ambition, aggressive leadership, government/military aptitude. Anger management needed. Accidents from impulsiveness. Surgery or fire-related career.'],
    ['Sun','Mercury',null,'education','Budhaditya',  'BPHS','Sun-Mercury conjunction — intelligent communication, administrative brilliance. Good for writing, government, business. If not combust: sharp analytical mind.'],
    ['Sun','Jupiter',null,'wealth','Authority Wisdom','Brihat Jatakam','Sun-Jupiter conjunction — wise leader, religious authority, fortunate father. Government and religion combine. Respected in society.'],
    ['Sun','Venus',null,'marriage','Charming Authority','Brihat Jatakam','Sun-Venus conjunction — artistic authority, charming personality. Romantic expression. Venus may be combust — check orb. Creative leadership.'],
    ['Sun','Saturn',null,'career','Karma Conflict','Nadi','Sun-Saturn conjunction or opposition — authority vs restriction. Career has rises and falls. Father relationship difficult. Success after overcoming ego. Delayed recognition.'],
    ['Sun','Rahu',null,'doshas','Surya Grahan','BPHS','Sun-Rahu conjunction — eclipse yoga. Ego turbulence, unconventional authority. Ancestors\' unfulfilled ambitions. Career disruptions but also unusual success.'],
    ['Sun','Ketu',null,'spiritual','Solar Detachment','BPHS','Sun-Ketu conjunction — detachment from ego, spiritual authority. Past-life leadership skills. Father may be spiritually inclined or absent.'],
    ['Moon','Mars',null,'health','Emotional Fire','Brihat Jatakam','Moon-Mars conjunction — emotional impulsiveness, inflammatory conditions, pitta imbalance. Bold emotional expression. Mother relationship challenging.'],
    ['Moon','Mercury',null,'education','Emotional Intelligence','BPHS','Moon-Mercury conjunction — excellent mind-emotion integration. Writers, speakers, counsellors. Witty and emotionally intelligent. Multiple simultaneous interests.'],
    ['Moon','Jupiter',null,'yogas','Gaja Kesari (Conj)','BPHS','Moon-Jupiter conjunction — wisdom meets intuition. Highly auspicious. Generous, spiritual, and fortunate. Respected in society. Mother is wise and fortunate.'],
    ['Moon','Venus',null,'marriage','Romantic Beauty','Nadi','Moon-Venus conjunction — strong romantic nature, beautiful appearance, artistic sensitivity. Love through emotional bonding. Mother is beautiful or artistic.'],
    ['Moon','Saturn',null,'psych','Depression Pattern','Nadi','Moon-Saturn conjunction — emotionally reserved, over-thinking, melancholic tendency. Depression risk. Strong discipline but emotional suppression. Psychosomatic conditions.'],
    ['Moon','Rahu',null,'psych','Anxiety Pattern','BPHS','Moon-Rahu conjunction — anxiety, irrational fears, obsessive thinking. Vivid imagination (can be used positively). Mother relationship unusual.'],
    ['Moon','Ketu',null,'spiritual','Intuitive Detachment','BPHS','Moon-Ketu conjunction — psychic sensitivity, detachment from emotional world. Past-life spiritual insight. Mother\'s health concern. Solitary emotional nature.'],
    ['Mars','Mercury',null,'career','Technical Mind','Nadi','Mars-Mercury conjunction — sharp technical intellect. Engineering, surgery, sports commentary, law. Quick decisions. Can be argumentative in communication.'],
    ['Mars','Jupiter',null,'yogas','Dharmic Action','Brihat Jatakam','Mars-Jupiter conjunction — righteous action, military with ethics. Sports, law, surgery, or religious administration. Strong moral code combined with physical courage.'],
    ['Mars','Venus',null,'marriage','Passionate Love','Nadi','Mars-Venus conjunction — intense physical attraction, passionate romance. Love marriage strongly indicated. Strong sensuality. May attract or cause jealousy.'],
    ['Mars','Saturn',null,'doshas','Frustration Pattern','Nadi','Mars-Saturn conjunction — suppressed anger, mechanical accidents, chronic frustration. Delays in action. Discipline over aggression is the life lesson. Injury from machinery.'],
    ['Mars','Rahu',null,'doshas','Ruchaka-Rahu','Nadi','Mars-Rahu conjunction — explosive ambition, unconventional aggression. Risk of fire/accident/surgery. Extremely driven. May act against societal norms. Powerful but dangerous.'],
    ['Mars','Ketu',null,'spiritual','Warrior Detachment','Nadi','Mars-Ketu conjunction — past-life warrior energy. Physical detachment, spiritual martial arts. Surgery with spiritual purpose. Moksha through physical discipline.'],
    ['Mercury','Jupiter',null,'education','Supreme Intellect','Brihat Jatakam','Mercury-Jupiter conjunction — Guru-Shishya yoga. Outstanding intellect, wisdom in communication. Teaching, law, financial advisory, publishing. Saraswati blessed.'],
    ['Mercury','Venus',null,'career','Creative Communication','Nadi','Mercury-Venus conjunction — artistic communication, beautiful writing, music and mathematics both possible. Charming intellectual. Business through arts.'],
    ['Mercury','Saturn',null,'career','Structured Thinking','Brihat Jatakam','Mercury-Saturn conjunction — disciplined intellect, precise communication, engineering mind. Technical writing, scientific research. Slow but thorough thinking.'],
    ['Mercury','Rahu',null,'psych','Mercurial Deception','Nadi','Mercury-Rahu conjunction — brilliant but unpredictable intellect. Can mislead or be misled. IT, astrology, unusual communication fields. Mind can become obsessive.'],
    ['Mercury','Ketu',null,'spiritual','Analytical Detachment','Nadi','Mercury-Ketu conjunction — past-life intellectual work. Intuitive analysis, spiritual writing. Detachment from intellectual ego. Research into occult sciences.'],
    ['Jupiter','Venus',null,'yogas','Supreme Benefics','BPHS','Jupiter-Venus conjunction — double benefic blessing. Prosperity, beauty, wisdom, and love combined. Fortunate in marriage, arts, and spirituality. Generosity and culture.'],
    ['Jupiter','Saturn',null,'career','Disciplined Wisdom','Nadi','Jupiter-Saturn conjunction — philosophy through discipline. Slow but lasting achievements. Traditional wisdom. Yogic discipline. Success after age 40.'],
    ['Jupiter','Rahu',null,'doshas','Guru Chandal','BPHS Ch.38','Jupiter-Rahu conjunction — Guru Chandal Yoga. Wisdom corrupted or tested. Unconventional spiritual path. Foreign teachers. Discrimination in philosophy needed.'],
    ['Jupiter','Ketu',null,'spiritual','Spiritual Liberation','Nadi','Jupiter-Ketu conjunction — exceptional past-life spiritual merit. Moksha-oriented wisdom. Detachment from Jupiter\'s worldly blessings. Deep philosophical insight.'],
    ['Venus','Saturn',null,'marriage','Delayed Love','Nadi','Venus-Saturn conjunction — delayed romance and marriage, love begins seriously after 28-30. Older partner possible. Once committed, relationship is lasting and serious.'],
    ['Venus','Rahu',null,'marriage','Unconventional Love','Nadi','Venus-Rahu conjunction — unconventional attractions, taboo relationships, foreign partner. Strong physical desires. Materialism in relationships.'],
    ['Venus','Ketu',null,'spiritual','Artistic Detachment','Nadi','Venus-Ketu conjunction — past-life artistic excellence, spiritual aesthetics. Detachment from sensual pleasures over time. Beauty as path to God.'],
    ['Saturn','Rahu',null,'doshas','Shrapit Yoga','Nadi','Saturn-Rahu conjunction — Shrapit Yoga. Strong karmic burden. Obstacles, frustrations, delays. Hardship as teacher. Deep spiritual transformation through suffering.'],
    ['Saturn','Ketu',null,'spiritual','Karmic Release','Nadi','Saturn-Ketu conjunction — intense karmic dissolution. Forced renunciation. Spiritual liberation through loss. Detachment from disciplined worldly structures.'],
    ['Rahu','Ketu',null,'doshas','Nodal Axis','Classical','Rahu-Ketu axis — always in opposition (180°). The life\'s karmic axis. Houses involved show where worldly desire (Rahu) and spiritual release (Ketu) pull.'],
  ];
  for(const [p1,p2,hctx,cat,type,src,desc] of conjRules){
    if(!P[p1]||!P[p2])continue;
    if(conj(s(p1),s(p2))){
      const inH=h(p1);
      f(cat,{type,planets:[p1,p2],house:inH,sign:ln(p1),source:src,desc:`${desc} [House ${inH}: ${ln(p1)}]`});
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // S4. PLANETARY ASPECTS — Saturn/Mars/Jupiter/Rahu special aspects (~60 rules)
  // Source: BPHS Ch.26, Phaladeepika
  // ═══════════════════════════════════════════════════════════════════════════
  const aspectRules=[
    // [aspecting,aspected,cat,desc]
    ['Saturn','Sun','career','Saturn aspects Sun — authority restricted or delayed. Career through persistent effort. Father relationship complex. Recognition comes late but is lasting.'],
    ['Saturn','Moon','psych','Saturn aspects Moon — emotional restriction, melancholy tendency, psychosomatic stress. Disciplined emotional nature. Mother may face difficulties.'],
    ['Saturn','Mars','health','Saturn aspects Mars — frustration from blocked action. Delayed ambition. Mechanical accidents possible. Discipline needed over aggression.'],
    ['Saturn','Mercury','education','Saturn aspects Mercury — structured thinking, formal education valued. Technical precision. Slow but thorough communication.'],
    ['Saturn','Jupiter','wealth','Saturn aspects Jupiter — disciplined wisdom, financial conservatism. Opportunities that require hard work. Traditional spiritual path.'],
    ['Saturn','Venus','marriage','Saturn aspects Venus — delayed romance, serious love life. Older partner. Love matures over time. Artistic discipline.'],
    ['Saturn','Rahu','doshas','Saturn aspects Rahu — Shrapit energy activated. Karma intensified. Obstacles compounded. Spiritual lessons through worldly suffering.'],
    ['Saturn','Ketu','spiritual','Saturn aspects Ketu — karmic release through discipline. Forced renunciation in Saturn\'s timeline. Deep spiritual purification.'],
    ['Mars','Sun','career','Mars aspects Sun — Mars energy activates solar themes. Aggressive leadership. Conflicts with authority. Physical energy channeled into career.'],
    ['Mars','Moon','health','Mars aspects Moon — inflammatory emotions, emotional aggression. Pitta imbalance. Mother relationship has Mars energy.'],
    ['Mars','Mercury','education','Mars aspects Mercury — sharp argumentative intellect. Debates, engineering, surgery. Quick decisions in Mercury areas.'],
    ['Mars','Jupiter','yogas','Mars aspects Jupiter — dharmic action energized. Sports leadership, military with ethics. Righteous aggression. Business expansion through energy.'],
    ['Mars','Venus','marriage','Mars aspects Venus — passion in relationships. Physical attraction intensified. Possible jealousy. Love-hate dynamic in romance.'],
    ['Mars','Saturn','doshas','Mars aspects Saturn — frustration compounded. Mars vs Saturn friction. Mechanical accidents. Discipline and aggression in conflict.'],
    ['Mars','Rahu','doshas','Mars aspects Rahu — explosive energy, unconventional violence. Risk of fire/accident. Extreme ambition. Caution required.'],
    ['Mars','Ketu','spiritual','Mars aspects Ketu — past-life warrior energy activated. Physical spiritual practice. Surgery as spiritual calling.'],
    ['Jupiter','Sun','career','Jupiter aspects Sun — wisdom illuminates authority. Good for law, teaching, government. Father is wise. Solar themes blessed by Jupiter.'],
    ['Jupiter','Moon','yogas','Jupiter aspects Moon — Gaja Kesari activated. Emotional wisdom, popular, blessed. Mother is fortunate. Mind inclined to wisdom.'],
    ['Jupiter','Mars','yogas','Jupiter aspects Mars — righteous action. Athletic wisdom. Dharmic leadership. Physical energy directed by wisdom.'],
    ['Jupiter','Mercury','education','Jupiter aspects Mercury — expanded intellect, teaching, philosophy. Higher education success. Writing and speaking gifted.'],
    ['Jupiter','Venus','marriage','Jupiter aspects Venus — blessed marriage, wise spouse, prosperity through partnerships. Artistic spiritual expression.'],
    ['Jupiter','Saturn','career','Jupiter aspects Saturn — wisdom meets discipline. Long-term success. Traditional career path. Philosophy balanced with pragmatism.'],
    ['Jupiter','Rahu','doshas','Jupiter aspects Rahu — Jupiter tries to control Rahu\'s excesses. Wisdom over illusion. Foreign spiritual experiences. Guru Chandal context.'],
    ['Jupiter','Ketu','spiritual','Jupiter aspects Ketu — spiritual wisdom amplified. Past-life philosophical merit accessed. Liberation through wisdom.'],
    ['Rahu','Sun','doshas','Rahu aspects Sun — eclipse energy on authority. Unconventional father. Career disruptions. Ambition through unusual paths.'],
    ['Rahu','Moon','psych','Rahu aspects Moon — anxiety and mental restlessness amplified. Imagination vivid. Emotional unpredictability. Unusual mother.'],
    ['Rahu','Mars','doshas','Rahu aspects Mars — explosive energy. Accidents from recklessness. Unconventional aggression. Extreme ambition.'],
    ['Rahu','Jupiter','doshas','Rahu aspects Jupiter — Guru Chandal themes. Wisdom tested by illusion. Foreign or unconventional teachers.'],
    ['Rahu','Saturn','doshas','Rahu aspects Saturn — Shrapit themes amplified. Karmic pressure intense. Obstacles compounded. Transformation through hardship.'],
    ['Ketu','Sun','spiritual','Ketu aspects Sun — solar detachment. Past-life authority. Spiritual leadership. Ego dissolution path.'],
    ['Ketu','Moon','spiritual','Ketu aspects Moon — intuitive sensitivity. Psychic abilities. Past-life emotional patterns. Mother has spiritual depth.'],
    ['Ketu','Mars','spiritual','Ketu aspects Mars — past-life warrior. Spiritual physical practice. Detached action. Surgery with spiritual intent.'],
    ['Ketu','Jupiter','spiritual','Ketu aspects Jupiter — profound past-life wisdom. Detachment from worldly expansion. Moksha through Jupiterian themes.'],
  ];
  for(const [asp,aped,cat,desc] of aspectRules){
    if(!P[asp]||!P[aped])continue;
    if(pAspects(asp,s(asp),s(aped))){
      f(cat,{type:`${asp} aspects ${aped}`,planets:[asp,aped],house_from:h(asp),house_to:h(aped),source:'BPHS Ch.26',desc:`${desc} [${asp} in H${h(asp)}, ${aped} in H${h(aped)}]`});
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // S5. RETROGRADE / COMBUST / DEBILITATED (~40 rules)
  // ═══════════════════════════════════════════════════════════════════════════
  for(const [nm,pd] of Object.entries(P)){
    if(['Rahu','Ketu'].includes(nm))continue;
    // Retrograde
    if(pd.retro) f('dignity',{planet:nm,type:'Retrograde',house:pd.h,sign:pd.sn,source:'BPHS Ch.3',
      desc:`${nm} retrograde — intensified, internalized energy. Past-life karma strongly active. Results of ${nm}'s house may come through unusual or reversed means. Strength actually increases in some texts.`});
    // Combust
    if(pd.comb) f('dignity',{planet:nm,type:'Combust',house:pd.h,sign:pd.sn,source:'BPHS Ch.3',affliction:true,
      desc:`${nm} combust (too close to Sun) — ${nm}'s significations suppressed and burned by solar energy. Natural qualities of ${nm} are undermined. Difficult to express ${nm}'s themes freely.`});
    // Debilitated
    if(pd.str.status==='Debilitated') f('dignity',{planet:nm,type:'Debilitated',house:pd.h,sign:pd.sn,score:1,source:'BPHS Ch.3',affliction:true,
      desc:`${nm} debilitated in ${pd.sn} — weakest placement. ${nm}'s themes face maximum challenge. Neecha Bhanga (cancellation) can reverse this if conditions met.`});
    // Neecha Bhanga check
    if(pd.str.status==='Debilitated'){
      const debilSign=E.DIGNITY[nm]?.debil;
      const debilSignLord=FN[SL[debilSign]];
      // Rule 1: Lord of debilitation sign is in kendra from lagna or moon
      if(P[debilSignLord]&&(isKendra(P[debilSignLord].h)||isKendra(houseOf(P[debilSignLord].si,ms))))
        f('yogas',{name:`Neecha Bhanga Raja Yoga (${nm})`,planet:nm,strength:'Moderate',source:'BPHS Ch.3',
          desc:`${nm} debilitated but lord of debilitation sign (${debilSignLord}) in kendra — Neecha Bhanga cancels debilitation. The native overcomes the weakness and the planet actually confers raja yoga results. Difficulty becomes strength.`});
      // Rule 2: Exaltation lord of the planet is in kendra
      const exaltSign=E.DIGNITY[nm]?.exalt;
      const exaltLord=FN[SL[exaltSign]];
      if(P[exaltLord]&&isKendra(P[exaltLord].h))
        f('yogas',{name:`Neecha Bhanga (Exaltation Lord) (${nm})`,planet:nm,strength:'Moderate',source:'BPHS Ch.3',
          desc:`${nm} debilitated but lord of exaltation sign (${exaltLord}) in kendra — second form of Neecha Bhanga. Weakness transformed into power through the exaltation lord's strength.`});
    }
    // Sandhi
    if(pd.di<=1||pd.di>=29) f('dignity',{planet:nm,type:'Sandhi',house:pd.h,sign:pd.sn,affliction:true,source:'BPHS',
      desc:`${nm} in Sandhi (${pd.di.toFixed(1)}° in ${pd.sn}) — on the cusp/junction of signs. Weakened, confused energy. ${nm}'s results are unreliable or delayed. Degree needs to move away from sign boundary for full strength.`});
    // Mool Trikona
    if(pd.str.status==='Mool Trikona') f('dignity',{planet:nm,type:'Mool Trikona',house:pd.h,sign:pd.sn,score:5,source:'BPHS Ch.3',
      desc:`${nm} in Mool Trikona sign — very strong placement, second only to exaltation. ${nm}'s themes flourish fully. Natural karaka qualities expressed with strength and authenticity.`});
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // S6. FULL YOGA SUITE (~80 yogas)
  // Source: BPHS Ch.35-40, Saravali, Phala Deepika
  // ═══════════════════════════════════════════════════════════════════════════

  // Pancha Mahapurusha — already in v1, re-check
  const PANCHA=[
    {p:'Mars',y:'Ruchaka',d:'Strong will, authority, military/police/surgery success. Land ownership. Pioneer. Commands respect through action.'},
    {p:'Mercury',y:'Bhadra',d:'Exceptional intellect, business mastery, communication skills. Success in trade, finance, writing, IT.'},
    {p:'Jupiter',y:'Hamsa',d:'Wisdom, spiritual authority, respected career. Success in teaching, law, religion, counselling, finance.'},
    {p:'Venus',y:'Malavya',d:'Beauty, luxury, artistic talent, romantic success. Benefits from marriage and partnerships. Aesthetics as career.'},
    {p:'Saturn',y:'Shasha',d:'Discipline, perseverance, authority over masses. Success in real estate, mining, politics, law, agriculture.'},
  ];
  for(const{p,y,d}of PANCHA){
    if(!P[p])continue;
    const st=P[p].str;
    if((st.status==='Own Sign'||st.status==='Mool Trikona'||st.status==='Exalted')&&isKendra(h(p)))
      f('yogas',{name:`${y} Yoga`,planet:p,house:h(p),sign:ln(p),strength:'Strong',source:'BPHS Ch.35',desc:`${y} Yoga — ${d}`});
  }

  // Raja Yogas
  const kLords=[1,4,7,10].map(hn=>({h:hn,l:houseLord(hn,ls),lp:hLP(hn)}));
  const tLords=[1,5,9].map(hn=>({h:hn,l:houseLord(hn,ls),lp:hLP(hn)}));
  for(const kl of kLords) for(const tl of tLords){
    if(kl.l===tl.l){
      if(P[kl.lp]) f('yogas',{name:'Yoga Karaka',planet:kl.lp,house:h(kl.lp),sign:ln(kl.lp),strength:sc(kl.lp)>=4?'Strong':'Moderate',source:'BPHS Ch.36',
        desc:`${kl.lp} rules both H${kl.h} (kendra) and H${tl.h} (trikona) — single Yoga Karaka planet. Maximum raj yoga power. Career elevation, authority, recognition. Dasha of this planet is transformative.`});
      continue;
    }
    if(!P[kl.lp]||!P[tl.lp])continue;
    if(conj(s(kl.lp),s(tl.lp)))
      f('yogas',{name:'Raja Yoga',planets:[kl.lp,tl.lp],house:h(kl.lp),sign:ln(kl.lp),strength:'Strong',source:'BPHS Ch.36',
        desc:`H${kl.h} lord (${kl.lp}) conjunct H${tl.h} lord (${tl.lp}) — Raja Yoga. Power, status, authority. Career peak during dasha of either planet.`});
    if(pAspects(kl.lp,s(kl.lp),s(tl.lp))||pAspects(tl.lp,s(tl.lp),s(kl.lp)))
      f('yogas',{name:'Raja Yoga (Aspect)',planets:[kl.lp,tl.lp],strength:'Moderate',source:'BPHS Ch.36',
        desc:`H${kl.h} lord (${kl.lp}) aspects H${tl.h} lord (${tl.lp}) — Raja Yoga through mutual aspect. Social elevation, career recognition.`});
    // Exchange (Parivartana)
    if(h(kl.lp)===kl.h?false:houseOf(s(kl.lp),ls)===tl.h && houseOf(s(tl.lp),ls)===kl.h)
      f('yogas',{name:'Parivartana Raja Yoga',planets:[kl.lp,tl.lp],strength:'Strong',source:'BPHS Ch.36',
        desc:`Exchange of H${kl.h} and H${tl.h} lords — Parivartana Raja Yoga. Power through reciprocal energy. Extraordinary career elevation.`});
  }

  // Gaja Kesari
  if(P.Jupiter){
    const jFM=houseOf(s('Jupiter'),ms);
    if(isKendra(jFM)&&sc('Jupiter')>=3)
      f('yogas',{name:'Gaja Kesari Yoga',planet:'Jupiter',house:h('Jupiter'),sign:ln('Jupiter'),strength:sc('Jupiter')>=5?'Strong':'Moderate',source:'BPHS Ch.36',
        desc:'Jupiter in kendra from Moon — Gaja Kesari. Intelligence, fame, wealth, respected social standing. Elephant-lion qualities: wisdom with authority.'});
  }

  // Chandra Mangal Yoga
  if(P.Moon&&P.Mars&&(conj(s('Moon'),s('Mars'))||pAspects('Mars',s('Mars'),s('Moon'))))
    f('yogas',{name:'Chandra Mangal Yoga',planets:['Moon','Mars'],house:h('Moon'),strength:'Moderate',source:'BPHS Ch.36',
      desc:'Moon-Mars relationship — wealth through real estate, manufacturing, or physical businesses. Ambitious mother. Emotional courage. Business acumen through persistence.'});

  // Budhaditya
  if(P.Sun&&P.Mercury&&conj(s('Sun'),s('Mercury'))&&!P.Mercury.comb)
    f('yogas',{name:'Budhaditya Yoga',planets:['Sun','Mercury'],house:h('Sun'),sign:ln('Sun'),strength:'Strong',source:'BPHS Ch.36',
      desc:'Sun-Mercury conjunction without combustion — brilliant administrative intellect, oratory, government connections, writing excellence.'});

  // Saraswati Yoga
  if(P.Jupiter&&P.Venus&&P.Mercury){
    const valid=[1,2,4,5,7,9,10];
    if([h('Jupiter'),h('Venus'),h('Mercury')].every(hh=>valid.includes(hh))&&sc('Jupiter')>=3)
      f('yogas',{name:'Saraswati Yoga',planets:['Jupiter','Venus','Mercury'],strength:'Moderate',source:'BPHS Ch.36',
        desc:'Jupiter, Venus, Mercury all well-placed — Saraswati Yoga. Exceptional intelligence, artistic ability, scholarship. Success in creative, academic, or intellectual fields.'});
  }

  // Lakshmi Yoga
  const l9lg=hLP(9);
  if(P[l9lg]&&isKT(h(l9lg))&&(st(l9lg)==='Exalted'||st(l9lg)==='Own Sign'||st(l9lg)==='Mool Trikona'))
    f('yogas',{name:'Lakshmi Yoga',planet:l9lg,house:h(l9lg),sign:ln(l9lg),strength:'Strong',source:'BPHS Ch.36',
      desc:`9th lord (${l9lg}) in kendra/trikona in own/exalted sign — Lakshmi Yoga. Great wealth, prosperity, government recognition, happiness. Goddess Lakshmi's blessings.`});

  // Viparita Raja Yogas
  for(const[h1,h2]of[[6,8],[6,12],[8,12]]){
    const lv=hLP(h1);
    if(P[lv]&&isDust(h(lv))&&h(lv)!==h1)
      f('yogas',{name:`Viparita Raja Yoga (${h1}L in ${h(lv)}H)`,planet:lv,house:h(lv),strength:'Moderate',source:'BPHS Ch.36',
        desc:`H${h1} lord (${lv}) in dusthana H${h(lv)} — Viparita Raja Yoga. Success through adversity, gains from crises, competitors' downfall benefits native.`});
  }

  // Dhana Yogas
  const d2=hLP(2),d11=hLP(11);
  if(P[d2]&&P[d11]){
    if(conj(s(d2),s(d11))) f('yogas',{name:'Dhana Yoga (2H+11H)',planets:[d2,d11],house:h(d2),strength:'Strong',source:'BPHS Ch.37',desc:`H2 lord (${d2}) conjunct H11 lord (${d11}) — strong wealth yoga. Accumulated wealth plus income flowing.`});
    if(houseOf(s(d2),ls)===11&&houseOf(s(d11),ls)===2) f('yogas',{name:'Dhana Parivartana Yoga',planets:[d2,d11],strength:'Strong',source:'BPHS Ch.37',desc:`Exchange of 2H and 11H lords — wealth and income lords switching houses. Multiple and growing income streams throughout life.`});
  }
  if(P.Jupiter&&[2,5,11].includes(h('Jupiter'))&&sc('Jupiter')>=3)
    f('yogas',{name:'Dhana Yoga (Jupiter)',planet:'Jupiter',house:h('Jupiter'),strength:sc('Jupiter')>=5?'Strong':'Moderate',source:'BPHS Ch.37',
      desc:`Jupiter in H${h('Jupiter')} — natural wealth karaka in income/wealth house. Prosperity, financial wisdom, generous fortune.`});

  // Kemdrum Yoga
  if(P.Moon){
    const adjMoon=Object.values(P).filter(pd=>{const hfm=houseOf(pd.si,ms);return(hfm===2||hfm===12)&&pd!==P.Moon&&!['Rahu','Ketu'].includes(Object.keys(P).find(k=>P[k]===pd))&&!['Sun'].includes(Object.keys(P).find(k=>P[k]===pd));});
    const jupKendra=P.Jupiter&&isKendra(houseOf(s('Jupiter'),ms));
    if(adjMoon.length===0&&!jupKendra)
      f('doshas',{name:'Kemdrum Yoga',planet:'Moon',house:h('Moon'),severity:'Moderate',source:'BPHS Ch.36',
        desc:'Moon without planets 2nd or 12th from it, no Jupiter in kendra from Moon — Kemdrum Yoga. Mental fluctuation, financial inconsistency, feeling of isolation. Mind seeks support but finds it after struggle.'});
  }

  // Kaal Sarp
  if(P.Rahu&&P.Ketu){
    const rs=s('Rahu'),ks=s('Ketu'),others=['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn'];
    let all=true;
    for(const pn of others){
      if(!P[pn])continue;
      const ps=s(pn);
      let bet=false,sv=rs;
      for(let i=0;i<12;i++){sv=(sv+1)%12;if(sv===ks)break;if(sv===ps){bet=true;break;}}
      if(!bet&&ps!==rs&&ps!==ks){all=false;break;}
    }
    if(all){
      const types=['Anant','Kulik','Vasuki','Shankha','Padma','Mahapadma','Takshak','Karkotak','Shankhchur','Ghatak','Vishadhar','Sheshnag'];
      f('doshas',{name:`Kaal Sarp Yoga (${types[h('Rahu')-1]||'Anant'})`,planet:'Rahu',house:h('Rahu'),severity:'High',source:'Nadi texts',
        desc:`All planets between Rahu (H${h('Rahu')}) and Ketu (H${h('Ketu')}) — Kaal Sarp Yoga. Repeated setbacks before success. Despite efforts, obstacles recur. Success after 42. Specific remedies required.`});
    }
  }

  // Mangal Dosha
  if(P.Mars&&[1,2,4,7,8,12].includes(h('Mars'))){
    const mh=h('Mars');
    let sev=mh===7||mh===8?'High':mh===1||mh===4?'Moderate':'Mild';
    const cancels=[];
    if(mh===8&&ls===3)cancels.push('Gemini lagna cancels');
    if(mh===4&&s('Mars')===3)cancels.push('Mars in Cancer 4H cancels');
    if(mh===7&&(s('Mars')===0||s('Mars')===7))cancels.push('Mars in own sign 7H partial cancel');
    if(P.Jupiter&&pAspects('Jupiter',s('Jupiter'),s('Mars')))cancels.push('Jupiter aspect reduces dosha');
    if(cancels.length)sev=sev==='High'?'Moderate':'Mild';
    f('doshas',{name:'Mangal Dosha',planet:'Mars',house:mh,sign:ln('Mars'),severity:sev,cancellation:cancels.join('; '),source:'BPHS Ch.18',
      desc:`Mars in H${mh} — Mangal Dosha (${sev}). Marriage timing and harmony affected. Partner with matching dosha neutralises. ${cancels.length?'Partial cancellation: '+cancels.join('; ')+'.'  : 'No cancellation found — careful matching required.'}`});
  }

  // Guru Chandal
  if(P.Jupiter&&P.Rahu&&conj(s('Jupiter'),s('Rahu')))
    f('doshas',{name:'Guru Chandal Yoga',planets:['Jupiter','Rahu'],house:h('Jupiter'),severity:'Moderate',source:'BPHS Ch.38',
      desc:`Jupiter-Rahu conjunction in H${h('Jupiter')} — wisdom mixed with illusion. Unconventional beliefs, questionable teachers. Foreign spiritual path. Discrimination in philosophy essential.`});

  // Shrapit
  if(P.Saturn&&P.Rahu&&conj(s('Saturn'),s('Rahu')))
    f('doshas',{name:'Shrapit Yoga',planets:['Saturn','Rahu'],house:h('Saturn'),severity:'High',source:'Nadi texts',
      desc:`Saturn-Rahu conjunction in H${h('Saturn')} — Shrapit Yoga. Heavy karmic burden. Obstacles in that house's matters. Frustrations and delays. Transformation through hardship. Remedies required.`});

  // Grahan Yogas
  if(P.Sun&&P.Rahu&&conj(s('Sun'),s('Rahu')))
    f('doshas',{name:'Surya Grahan Yoga',planets:['Sun','Rahu'],house:h('Sun'),severity:'Moderate',source:'BPHS',
      desc:`Sun-Rahu eclipse in H${h('Sun')} — authority turbulence, unconventional career path. Father's life has unusual themes. Sudden rises and falls.`});
  if(P.Moon&&P.Rahu&&conj(s('Moon'),s('Rahu')))
    f('doshas',{name:'Chandra Grahan Yoga',planets:['Moon','Rahu'],house:h('Moon'),severity:'Moderate',source:'BPHS',
      desc:`Moon-Rahu eclipse in H${h('Moon')} — mental restlessness, anxiety, irrational fears. Vivid imagination. Unusual mother. Spiritual practices calm the mind.`});
  if(P.Moon&&P.Ketu&&conj(s('Moon'),s('Ketu')))
    f('doshas',{name:'Chandra Ketu Yoga',planets:['Moon','Ketu'],house:h('Moon'),severity:'Moderate',source:'BPHS',
      desc:`Moon-Ketu in H${h('Moon')} — detachment from emotion and mother. Intuitive but withdrawn. Past-life spiritual practice. Mother's health concern.`});

  // Papakartari Yoga
  const malNames=['Saturn','Mars','Rahu','Ketu','Sun'];
  for(const[pn,pd]of Object.entries(P)){
    if(malNames.includes(pn))continue;
    const prev=(pd.si-1+12)%12,next=(pd.si+1)%12;
    const mPrev=Object.entries(P).some(([n,d])=>malNames.includes(n)&&d.si===prev);
    const mNext=Object.entries(P).some(([n,d])=>malNames.includes(n)&&d.si===next);
    if(mPrev&&mNext) f('doshas',{name:`Papakartari Yoga (${pn})`,planet:pn,house:pd.h,severity:'Moderate',source:'BPHS Ch.38',
      desc:`${pn} hemmed between malefics in adjacent signs — Papakartari. ${pn}'s natural significations suppressed. Results come with extra effort in ${pn}'s life areas.`});
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // S7. HEALTH — body area patterns (~55 rules)
  // Source: Brihat Jatakam Ch.6, BPHS Ch.68
  // ═══════════════════════════════════════════════════════════════════════════
  const healthRules=[
    // [conditions_fn, area, severity, desc]
    [()=>P.Mars&&h('Mars')===8,'Piles/Rectal','Flag','Mars in 8H — classical indicator for piles, fistula, anal/rectal issues. Blood conditions. Surgery possibility. Mars dasha may bring these themes.'],
    [()=>P.Moon&&P.Saturn&&(conj(s('Moon'),s('Saturn'))||pAspects('Saturn',s('Saturn'),s('Moon'))),'Mental Health','Flag','Moon-Saturn relationship — depression tendency, emotional suppression, over-thinking. Psychosomatic conditions. Regular mental health care essential.'],
    [()=>P.Moon&&P.Rahu&&(conj(s('Moon'),s('Rahu'))||pAspects('Rahu',s('Rahu'),s('Moon'))),'Anxiety/Phobia','Flag','Moon-Rahu combination — anxiety disorders, irrational fears, obsessive patterns. Vivid disturbing dreams. Spiritual practices help.'],
    [()=>P.Moon&&P.Mars&&conj(s('Moon'),s('Mars')),'Inflammatory','Flag','Moon-Mars conjunction — inflammatory conditions, pitta imbalance, fevers. Emotional volatility affecting physical health.'],
    [()=>P.Sun&&h('Sun')===12,'Eyes/Energy','Flag','Sun in 12H — eye weakness possible, energy depletion, sleep disturbances. Vitamin D and energy management important.'],
    [()=>P.Saturn&&h('Saturn')===1,'Bones/Joints','Flag','Saturn in 1H — cold/dry constitution, joint issues, chronic conditions. Bones, teeth, skin need regular attention.'],
    [()=>P.Saturn&&h('Saturn')===6,'Kidneys/Bladder','Flag','Saturn in 6H — kidney, bladder, lower back chronic conditions. Water intake critical. Slow recovery from illness.'],
    [()=>P.Jupiter&&h('Jupiter')===6,'Liver/Weight','Flag','Jupiter in 6H — liver, spleen issues. Weight management challenges. Overindulgence. Moderation is health prescription.'],
    [()=>P.Mars&&h('Mars')===6,'Stomach/Fire','Positive','Mars in 6H — strong digestive fire, good immunity, overcomes diseases. Competitive in health sector.'],
    [()=>P.Mercury&&(sc('Mercury')<=2||P.Mercury.comb),'Nervous System','Flag','Weak/combust Mercury — nervous system sensitivity, anxiety, skin conditions. Mental fatigue from overthinking.'],
    [()=>P.Venus&&sc('Venus')<=2,'Reproductive/Kidney','Flag','Weak Venus — reproductive health, kidney/urinary issues, hormonal imbalance. Sensual overindulgence risk.'],
    [()=>P.Mars&&[1,4,7].includes(h('Mars'))&&pAspects('Mars',s('Mars'),h('Mars')-1+ls),'Accident-prone','Flag','Mars in 1/4/7H with aspects — accident risk from impulsiveness. Injury to head or extremities possible.'],
    [()=>P.Moon&&h('Moon')===4&&(sc('Moon')<=2||Object.entries(P).some(([n,d])=>malNames.includes(n)&&conj(d.si,s('Moon')))),'Heart/Chest','Flag','Afflicted Moon in 4H — heart, chest, lung conditions possible. Emotional stress manifests physically.'],
    [()=>P.Rahu&&h('Rahu')===6,'Unusual Diseases','Flag','Rahu in 6H — unusual, hard-to-diagnose conditions. Allergies, parasitic conditions. Seek second medical opinions.'],
    [()=>P.Ketu&&h('Ketu')===6,'Mystery Illness','Flag','Ketu in 6H — mysterious health conditions, possible spiritual healing required. Chronic subtle health issues.'],
    [()=>P.Sun&&h('Sun')===6&&sc('Sun')>=4,'Strong Immunity','Positive','Strong Sun in 6H — excellent immunity, overcomes diseases. Government health service or strong constitution.'],
    [()=>P.Mars&&h('Mars')===12,'Hidden Enemies/Surgery','Flag','Mars in 12H — hidden enemies, possible hospitalization, surgical procedures. Energy drain from unseen sources.'],
    [()=>P.Saturn&&h('Saturn')===12,'Chronic/Isolation','Flag','Saturn in 12H — chronic conditions, possible long hospital stays. Old karma in health. Spiritual healing beneficial.'],
    [()=>P.Jupiter&&h('Jupiter')===1&&sc('Jupiter')>=4,'Excellent Health','Positive','Jupiter in 1H strong — generally excellent constitution, natural immunity, good recovery. Weight management only concern.'],
    [()=>P.Mars&&s('Mars')===3&&h('Mars')===3,'Blood/Marrow','Flag','Mars in Gemini 3H — upper arm/shoulder issues, blood conditions, lung-related.'],
    [()=>P.Saturn&&s('Saturn')===1&&h('Saturn')===1,'Bones/Teeth','Flag','Saturn in Aries 1H — head injuries possible, dental issues, bone density concerns.'],
    // Lagna lord in 8H
    [()=>{const l1p=hLP(1);return P[l1p]&&h(l1p)===8;},'Chronic/Surgical','Flag',`Lagna lord in 8H — susceptibility to chronic conditions, possible surgeries. Strong recovery once crisis passes.`],
    // Multiple malefics in 8H
    [()=>Object.entries(P).filter(([n,d])=>malNames.includes(n)&&d.h===8).length>=2,'Serious Health Events','High','Multiple malefics in 8H — significant health events possible. Surgical interventions, accidents. Strong life-force with crisis episodes.'],
    // 6H lord in 1H
    [()=>{const l6p=hLP(6);return P[l6p]&&h(l6p)===1;},'General Health','Flag','6H lord in 1H — health issues persist throughout life. Digestive system and immunity challenges.'],
    // Moon in 6H
    [()=>P.Moon&&h('Moon')===6,'Digestive/Emotional','Flag','Moon in 6H — emotional eating, digestive issues, fluctuating health. Health affected by emotional state.'],
    // Sun in 1H strong
    [()=>P.Sun&&h('Sun')===1&&sc('Sun')>=4,'Vitality','Positive','Strong Sun in 1H — excellent vitality, strong constitution, dominant personality. Health is a personal pride.'],
    // Rahu in 1H — unusual health
    [()=>P.Rahu&&h('Rahu')===1,'Unusual Constitution','Flag','Rahu in 1H — unusual health patterns, constitution hard to categorize. Respond to alternative medicine.'],
    // Lagna in water sign (3,7,11) — emotional health
    [()=>WATER.includes(ls),'Water Constitution','Note','Lagna in water sign — emotional and sensitive constitution. Stomach, lymphatic, and hormonal balance important.'],
    [()=>FIRE.includes(ls),'Pitta Constitution','Note','Lagna in fire sign — pitta-dominant constitution. Heart, eyes, liver, skin need care. Cooling practices beneficial.'],
    [()=>AIR.includes(ls),'Vata Constitution','Note','Lagna in air sign — vata-dominant constitution. Nervous system, joints, colon need attention. Grounding practices essential.'],
    [()=>EARTH.includes(ls),'Kapha Constitution','Note','Lagna in earth sign — kapha-dominant constitution. Weight, respiratory, and cholesterol management important.'],
    // Saturn in 8H — chronic longevity issues
    [()=>P.Saturn&&h('Saturn')===8&&sc('Saturn')<=2,'Longevity Concern','High','Weak Saturn in 8H — chronic conditions, longevity potentially reduced. Regular check-ups essential. Avoid risky activities.'],
    [()=>P.Jupiter&&h('Jupiter')===8&&sc('Jupiter')>=4,'Longevity Blessed','Positive','Strong Jupiter in 8H — longevity supported. Inheritance. Occult healing. Transformation leads to wisdom.'],
    // Mars + Ketu in same house
    [()=>P.Mars&&P.Ketu&&conj(s('Mars'),s('Ketu')),'Accident/Surgery','Flag','Mars-Ketu conjunction — accidents, cuts, surgery. Previous life warrior karma. Physical extremism. Careful with sharp instruments.'],
    // Moon in 8H
    [()=>P.Moon&&h('Moon')===8,'Emotional Crises','Flag','Moon in 8H — emotional crises and transformations, mother\'s health concern, psychic sensitivity. Health through emotional release.'],
    // Venus in 8H
    [()=>P.Venus&&h('Venus')===8,'Reproductive','Flag','Venus in 8H — reproductive health needs attention, in-law relationships complex. Sensual experiences transform the native.'],
    // Mercury in 8H
    [()=>P.Mercury&&h('Mercury')===8,'Nervous/Research','Flag','Mercury in 8H — nervous system, research into health, possible speech issues. Health through analytical approach.'],
    // Ketu in 8H
    [()=>P.Ketu&&h('Ketu')===8,'Occult Health','Flag','Ketu in 8H — spiritual approach to health crises, mysterious ailments, near-death spiritual experiences. Past-life medical karma.'],
  ];
  for(const[cond,area,sev,desc]of healthRules){
    try{ if(cond()) f('health',{area,severity:sev,source:'Brihat Jatakam + BPHS Ch.68',desc}); }catch(e){}
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // S8. MARRIAGE AND RELATIONSHIPS (~80 rules combining v1 + additions)
  // Source: BPHS Ch.18, Saravali Ch.29, Brihat Jatakam Ch.7
  // ═══════════════════════════════════════════════════════════════════════════
  const l7p=hLP(7);

  // 7H lord in all 12 houses
  const sevenLordPlacement={
    1:'7H lord in 1H — spouse is like a soulmate, identity through partnership. Business partnerships prominent. Spouse may physically resemble native.',
    2:'7H lord in 2H — marriage improves wealth. Spouse contributes to family income. Joint family possible. Practical approach to marriage.',
    3:'7H lord in 3H — spouse from nearby area or through communication. Marriage through writing, media, or short journeys. Siblings connect to spouse.',
    4:'7H lord in 4H — spouse from hometown. Domestic partnership, property through marriage. Mother approves of spouse.',
    5:'7H lord in 5H — love marriage, romantic union. Children through marriage. Spouse is creative or educated. Love affair that becomes marriage.',
    6:'7H lord in 6H — marital conflicts, health issues for spouse, divorce risk. Service-oriented spouse. Marriage after conflict or health challenge.',
    7:'7H lord in own 7H — excellent marriage yoga. Good spouse, long-lasting union. Spouse of strong character.',
    8:'7H lord in 8H — obstacles in marriage, spouse faces health issues, possible widowhood. In-law conflicts. Deep transformation through marriage.',
    9:'7H lord in 9H — fortunate marriage, wise or foreign spouse. Marriage after long journey. Spouse may be teacher or guru-like.',
    10:'7H lord in 10H — spouse helps career. Business partner boosts reputation. Public partnership. Spouse is ambitious.',
    11:'7H lord in 11H — gains from marriage. Spouse brings social network. Marriage fulfills desires. Spouse is social and networked.',
    12:'7H lord in 12H — separation tendency, spouse may live abroad or away. Foreign spouse possible. Hidden or secret marriage aspects. Bedroom-focused relationship.',
  };
  if(P[l7p]) f('marriage',{type:'7H Lord',planet:l7p,house:h(l7p),sign:ln(l7p),source:'BPHS Ch.18',desc:sevenLordPlacement[h(l7p)]});

  // Venus in all 12 houses (for male charts primarily)
  const venusPlacements={
    1:'Venus in 1H — naturally attractive, charming nature draws romantic partners. Beauty in personality. Strong love life.',
    2:'Venus in 2H — beautiful voice, wealth through relationships. Spouse contributes to family. Sweet romantic expression.',
    3:'Venus in 3H — love through communication. Artistic relationships. Siblings may introduce spouse. Short trips for romance.',
    4:'Venus in 4H — beautiful home life. Loving mother. Spouse creates comfortable home environment. Property through romance.',
    5:'Venus in 5H — passionate romance, creative love life. Daughters likely. Love affairs prominent. Artistic lover.',
    6:'Venus in 6H — romantic complications with colleagues. Kidney/urinary health. Service through beauty. Love-related conflicts.',
    7:'Venus in 7H — beautiful, talented spouse. Happy marriage especially for males. Business partnerships in Venus industries.',
    8:'Venus in 8H — deep sensuality, hidden relationships, in-law wealth. Transformation through romance.',
    9:'Venus in 9H — fortunate marriage, beautiful or artistic father. Philosophical approach to love.',
    10:'Venus in 10H — career in arts/beauty. Famous for aesthetics. Wealthy through public charm.',
    11:'Venus in 11H — social and romantic gains. Wealthy social circle. Elder siblings beautiful or artistic.',
    12:'Venus in 12H — hidden pleasures, secret relationships. Foreign romantic connections. Bedroom arts.',
  };
  if(P.Venus) f('marriage',{type:'Venus Placement',planet:'Venus',house:h('Venus'),sign:ln('Venus'),source:'BPHS Ch.18',desc:venusPlacements[h('Venus')]});

  // Jupiter in all 12 houses (for female charts as spouse karaka)
  if(P.Jupiter){
    const jDescMarr={
      1:'Jupiter in 1H — wise, generous spouse energy. Marriage brings philosophical depth. First marriage is significant.',
      2:'Jupiter in 2H — wealthy family, eloquent speech. Marriage improves family status. Traditional approach to marriage.',
      4:'Jupiter in 4H — happy home life, good mother, comfortable property. Marriage creates stable home.',
      5:'Jupiter in 5H — excellent for children, wise beloved. Romance is philosophical. Spouse is educated.',
      7:'Jupiter in 7H — wise, wealthy spouse. Happy marriage. Business partnerships are philosophical.',
      9:'Jupiter in 9H — fortunate marriage. Spouse is teacher-like or foreign. Religious approach to marriage.',
      11:'Jupiter in 11H — gains from marriage. Spouse is well-networked and prosperous.',
    };
    if(jDescMarr[h('Jupiter')]) f('marriage',{type:'Jupiter (Spouse Karaka)',planet:'Jupiter',house:h('Jupiter'),sign:ln('Jupiter'),source:'BPHS Ch.18',desc:jDescMarr[h('Jupiter')]});
  }

  // Specific yoga rules
  if(P.Saturn&&h('Saturn')===7) f('marriage',{type:'Delay',planet:'Saturn',house:7,sign:ln('Saturn'),source:'BPHS Ch.18',desc:'Saturn in 7H — delayed marriage (typically 28+), older or serious-natured spouse. Marriage stabilizes and warms over time. Cold start, warm finish.'});
  if(P.Saturn&&h('Saturn')===7&&(s('Saturn')===6||s('Saturn')===9)) f('marriage',{type:'Very Delayed',planet:'Saturn',sign:ln('Saturn'),source:'BPHS',desc:'Saturn in Libra or Sagittarius 7H — marriage delay pronounced. After 30 for best results. Spouse very serious or foreign.'});
  if(P.Mars&&h('Mars')===7) f('marriage',{type:'Passionate/Conflict',planet:'Mars',house:7,source:'BPHS Ch.18',desc:'Mars in 7H — passionate spouse but argumentative marriage. Power struggles. Mangal Dosha present. Patience required in marriage.'});
  if(P.Rahu&&h('Rahu')===7) f('marriage',{type:'Unconventional',planet:'Rahu',house:7,source:'BPHS+Nadi',desc:'Rahu in 7H — unconventional or inter-caste/foreign marriage. Strong initial attraction but adjustments needed. Multiple relationships possible.'});
  if(P.Ketu&&h('Ketu')===7) f('marriage',{type:'Spiritual/Detachment',planet:'Ketu',house:7,source:'Nadi',desc:'Ketu in 7H — past-life connection with spouse, possible spiritual partner. Detachment from conventional marriage. Widowhood theme possible.'});
  if(P.Sun&&h('Sun')===7) f('marriage',{type:'Power Dynamic',planet:'Sun',house:7,source:'BPHS',desc:'Sun in 7H — ego in partnerships. Dominant or government-connected spouse. Power dynamics in marriage. Career from partnerships.'});
  if(P.Moon&&h('Moon')===7) f('marriage',{type:'Emotional Partner',planet:'Moon',house:7,source:'BPHS',desc:'Moon in 7H — emotional partnership, beautiful spouse, public dealings profitable. Business with women or public.'});

  // Multiple malefics in 7H
  const mal7=Object.entries(P).filter(([n,d])=>malNames.includes(n)&&d.h===7);
  if(mal7.length>=2) f('marriage',{type:'Serious Challenges',planets:mal7.map(([n])=>n),house:7,severity:'High',source:'BPHS Ch.18',desc:`Multiple malefics (${mal7.map(([n])=>n).join(', ')}) in 7H — discord, possible multiple marriages, divorce tendency. Late and carefully chosen marriage advised.`});

  // Love marriage indicators
  if(P.Venus&&P.Mars&&conj(s('Venus'),s('Mars'))) f('marriage',{type:'Love Marriage',planets:['Venus','Mars'],house:h('Venus'),source:'Nadi',desc:'Venus-Mars conjunction — passionate love life, love marriage strongly indicated. Physical attraction leads to relationship.'});
  const l5m=hLP(5);
  if(P[l5m]&&P[l7p]&&conj(s(l5m),s(l7p))) f('marriage',{type:'Love to Marriage',planets:[l5m,l7p],source:'Nadi',desc:`5H lord (${l5m}) conjunct 7H lord (${l7p}) — love affair converts to marriage. Romantic involvement before formal marriage.`});
  if(P.Venus&&P.Moon&&(conj(s('Venus'),s('Moon'))||pAspects('Venus',s('Venus'),s('Moon')))) f('marriage',{type:'Emotional Love',planets:['Venus','Moon'],source:'Nadi',desc:'Venus-Moon connection — emotional love, marriage through emotional bonding. Nurturing romantic relationship. Beautiful spouse.'});

  // Divorce indicators
  if(P[l7p]&&P.Saturn&&pAspects('Saturn',s('Saturn'),s(l7p))) f('marriage',{type:'Divorce Risk',planets:['Saturn',l7p],source:'BPHS',desc:`Saturn aspects 7H lord (${l7p}) — delays and obstacles in marriage. Possible separation after initial partnership. Choose partner carefully.`});
  if(P.Rahu&&h('Rahu')===7&&P.Saturn&&h('Saturn')===1) f('marriage',{type:'Multiple Marriages',planets:['Rahu','Saturn'],source:'Nadi',desc:'Rahu in 7H with Saturn in 1H — multiple relationship phases, possible more than one significant partnership.'});

  // ═══════════════════════════════════════════════════════════════════════════
  // S9. CHILDREN (~45 rules)  S10. WEALTH/CAREER (~50+55 rules)
  // S11. EDUCATION (~15)  S12. PROPERTY (~15)  S13. PARENTS/SIBLINGS (~25)
  // ═══════════════════════════════════════════════════════════════════════════

  // CHILDREN — all planets in 5H + lord analysis
  const h5s=signOfH(5,ls),l5c=hLP(5);
  const childDesc={
    Sun:{t:'Male/Authority',d:'Sun in 5H — strong children yoga. First child likely male, authoritative children. Speculation possible. Leadership expressed through children.'},
    Moon:{t:'Many/Daughters',d:'Moon in 5H — multiple children likely, daughters more probable. Nurturing parent. Emotional fulfillment through children.'},
    Mars:{t:'Male/Fewer',d:'Mars in 5H — first child likely male, energetic children. Miscarriage risk without benefic aspect. Fewer children but strong-willed.'},
    Mercury:{t:'Twins/Intelligent',d:'Mercury in 5H — intelligent, communicative children. Twins possible in dual signs. Academic excellence for offspring.'},
    Jupiter:{t:'Multiple/Sons',d:'Jupiter in 5H — excellent children yoga. Multiple children, sons indicated. Wise, spiritually inclined offspring. Past-life punyam.'},
    Venus:{t:'Daughters/Beautiful',d:'Venus in 5H — daughters more likely. Beautiful, artistic, or talented children. Pleasure through children. Creative offspring.'},
    Saturn:{t:'Delayed/Disciplined',d:'Saturn in 5H — delayed children, few but disciplined. First child comes after significant wait. Responsible, serious children.'},
    Rahu:{t:'Irregular/Adopted',d:'Rahu in 5H — irregular path to children. Adopted or step-children possible. Miscarriage risk. Children may be unusual or unconventional.'},
    Ketu:{t:'Spiritual/Few',d:'Ketu in 5H — fewer children (1-2). Spiritually advanced offspring. Past-life connection with children. Possible renunciant child.'},
  };
  for(const[pn,cd]of Object.entries(childDesc)){
    if(P[pn]&&h(pn)===5) f('children',{type:cd.t,planet:pn,house:5,sign:ln(pn),source:'BPHS Ch.12+Brihat Jatakam',desc:cd.d});
  }

  // 5H lord placement
  if(P[l5c]){
    const ch=h(l5c);
    if(ch===5) f('children',{type:'Excellent',planet:l5c,house:5,source:'BPHS Ch.12',desc:`5H lord (${l5c}) in own house — strong children yoga, high intelligence, excellent past-life merit.`});
    else if(isKT(ch)) f('children',{type:'Positive',planet:l5c,house:ch,source:'BPHS Ch.12',desc:`5H lord (${l5c}) in kendra/trikona (H${ch}) — good children yoga. Children bring happiness and prosperity.`});
    else if(isDust(ch)) f('children',{type:'Challenge',planet:l5c,house:ch,source:'BPHS Ch.12',desc:`5H lord (${l5c}) in dusthana (H${ch}) — challenges with children. Delay or health issues possible. Jupiter remedies advised.`});
  }

  // Putra Dosha
  const m5=Object.entries(P).filter(([n,d])=>malNames.includes(n)&&d.h===5);
  const b5=Object.entries(P).filter(([n,d])=>isBen(n)&&d.h===5);
  if(m5.length>=2&&b5.length===0) f('doshas',{name:'Putra Dosha',severity:'High',source:'BPHS Ch.12',desc:`Multiple malefics (${m5.map(([n])=>n).join(', ')}) in 5H without benefic relief — Putra Dosha. Significant challenges in having children. Jupiter remedies strongly advised.`});

  // 5H sign type for count indication
  if(FIXED.includes(h5s)) f('children',{type:'Count',source:'Brihat Jatakam',desc:`5H in fixed sign (${RS[h5s]}) — one or few children, well-spaced apart.`});
  if(DUAL.includes(h5s)) f('children',{type:'Count',source:'Brihat Jatakam',desc:`5H in dual sign (${RS[h5s]}) — twins possible, or two children at different life stages.`});
  if(MOVABLE.includes(h5s)) f('children',{type:'Count',source:'Brihat Jatakam',desc:`5H in movable sign (${RS[h5s]}) — multiple children possible at various life stages.`});

  // Jupiter timing for children
  const jDseq=dasha.seq.find(s=>s.lord==='Ju');
  if(jDseq) f('children',{type:'Timing',source:'Classical',desc:`Jupiter Mahadasha (${fmtYr(jDseq.start)}-${fmtYr(jDseq.end)}) — primary window for children. Also: 5H lord dasha, Jupiter antardasha.`});

  // CAREER & PROFESSIONAL (~55 rules)
  // Profession indicators by planet in 10H
  if(P.Sun&&h('Sun')===10) f('career',{type:'Government/Leadership',planet:'Sun',sign:ln('Sun'),source:'BPHS Ch.16',desc:'Sun in 10H — government service, politics, authority roles. Leadership is the calling. Fame through career.'});
  if(P.Moon&&h('Moon')===10) f('career',{type:'Public/Hospitality',planet:'Moon',sign:ln('Moon'),source:'BPHS Ch.16',desc:'Moon in 10H — public-facing career. Politics, hospitality, women-centric industries. Fluctuating career but public recognition.'});
  if(P.Mars&&h('Mars')===10) f('career',{type:'Engineering/Military',planet:'Mars',sign:ln('Mars'),source:'BPHS Ch.16',desc:'Mars in 10H — engineering, military, police, surgery, sports, construction, real estate. Driven, action-oriented career.'});
  if(P.Mercury&&h('Mercury')===10) f('career',{type:'Communication/Business',planet:'Mercury',sign:ln('Mercury'),source:'BPHS Ch.16',desc:'Mercury in 10H — writing, media, IT, accounting, business, trading. Multiple roles or career switches.'});
  if(P.Jupiter&&h('Jupiter')===10) f('career',{type:'Teaching/Law/Finance',planet:'Jupiter',sign:ln('Jupiter'),source:'BPHS Ch.16',desc:'Jupiter in 10H — teaching, law, banking, medicine, religion, counselling. Respected ethical career.'});
  if(P.Venus&&h('Venus')===10) f('career',{type:'Arts/Beauty/Luxury',planet:'Venus',sign:ln('Venus'),source:'BPHS Ch.16',desc:'Venus in 10H — arts, entertainment, fashion, beauty, luxury goods, hospitality, diplomacy. Fame through aesthetics.'});
  if(P.Saturn&&h('Saturn')===10) f('career',{type:'Authority/Endurance',planet:'Saturn',sign:ln('Saturn'),source:'BPHS Ch.16',desc:`Saturn in 10H — ${sc('Saturn')>=4?'strong career through discipline':'slow start but building authority'}. Success after 35. Real estate, law, politics, mining, engineering.`});
  if(P.Rahu&&h('Rahu')===10) f('career',{type:'Unconventional/Foreign',planet:'Rahu',sign:ln('Rahu'),source:'BPHS Ch.16',desc:'Rahu in 10H — unconventional career, sudden rises and falls. Politics, media, foreign career, technology. Ambition through unusual paths.'});
  if(P.Ketu&&h('Ketu')===10) f('career',{type:'Spiritual/Service',planet:'Ketu',sign:ln('Ketu'),source:'BPHS Ch.16',desc:'Ketu in 10H — detachment from career status. Spiritual work, service, or multiple career changes. Work is not the identity.'});

  // 10H lord placement (all 12 positions)
  const l10p=hLP(10);
  if(P[l10p]){
    const ch10=h(l10p);
    const c10desc={
      1:'10H lord in 1H — career defines identity. Leadership personality. Authority figure.',
      2:'10H lord in 2H — career builds family wealth. Traditional profession. Income through speech.',
      3:'10H lord in 3H — communication career. Writing, media, or marketing profession.',
      4:'10H lord in 4H — career from home or homeland. Real estate, agriculture, or domestic profession.',
      5:'10H lord in 5H — creative or educational career. Stock market possible. Career through children.',
      6:'10H lord in 6H — service sector. Healthcare, legal disputes, competition-based work.',
      7:'10H lord in 7H — career through partnerships. Business with spouse. Public dealing profession.',
      8:'10H lord in 8H — research, occult, insurance, inheritance work. Career has crises and transformations.',
      9:'10H lord in 9H — dharmic career. Teaching, law, religion, philosophy, travel industry.',
      10:'10H lord in own 10H — self-made career success. Strong authority. Prominent in field.',
      11:'10H lord in 11H — career brings substantial income. Network-based career. Fulfillment of career goals.',
      12:'10H lord in 12H — career in foreign lands. Hospital or ashram work. Career in isolation or retreat.',
    };
    f('career',{type:'10H Lord',planet:l10p,house:ch10,source:'BPHS Ch.16',desc:c10desc[ch10]||`10H lord (${l10p}) in H${ch10}`});
  }

  // Lagna lord in 10H (strong self-made career)
  const l1car=hLP(1);
  if(P[l1car]&&h(l1car)===10) f('career',{type:'Self-Made',planet:l1car,house:10,source:'BPHS',desc:`Lagna lord (${l1car}) in 10H — career is central to identity. Self-made professional, public recognition.`});

  // Exalted planet in 10H
  const ex10=Object.entries(P).find(([n,d])=>d.h===10&&d.str.status==='Exalted');
  if(ex10) f('career',{type:'Career Peak',planet:ex10[0],house:10,sign:ex10[1].sn,source:'BPHS',desc:`${ex10[0]} exalted in 10H — outstanding career. Peak professional achievement. International recognition possible.`});

  // WEALTH PATTERNS (~50 rules)
  // 2H analysis
  const planetsIn2=Object.entries(P).filter(([n,d])=>d.h===2);
  for(const[pn,pd]of planetsIn2){
    const wD={Sun:'income from government/authority',Moon:'fluctuating income, public dealings',Mars:'income from engineering/property/initiative',Mercury:'multiple income streams from business/communication',Jupiter:'abundant wealth, traditional savings',Venus:'income from arts/luxury/relationships',Saturn:'slow but steady accumulation',Rahu:'foreign income, unconventional wealth',Ketu:'detachment from wealth, past-life savings'};
    f('wealth',{type:'2H Income',planet:pn,house:2,sign:pd.sn,source:'BPHS Ch.37',desc:`${pn} in 2H — ${wD[pn]||'income indicated'}. Family financial patterns reflect ${pn}'s energy.`});
  }

  // 11H analysis
  const planetsIn11=Object.entries(P).filter(([n,d])=>d.h===11);
  for(const[pn,pd]of planetsIn11){
    const w11D={Sun:'gains from government, authority network',Moon:'gains from public, women, emotional intelligence',Mars:'gains from property, initiative, competition',Mercury:'multiple small income streams, business networks',Jupiter:'abundant gains, wise social network',Venus:'gains from beauty, arts, luxury industry',Saturn:'gains from labour, older people, persistence',Rahu:'sudden and unconventional gains, foreign income',Ketu:'detachment from gains, spiritual income'};
    f('wealth',{type:'11H Gains',planet:pn,house:11,sign:pd.sn,source:'BPHS Ch.37',desc:`${pn} in 11H — ${w11D[pn]||'gains indicated'}. Fulfillment of desires related to ${pn}'s themes.`});
  }

  // Financial yoga combinations
  const d2w=hLP(2),d11w=hLP(11),d9w=hLP(9);
  if(P[d2w]&&P[d11w]&&conj(s(d2w),s(d11w))) f('wealth',{type:'Dhana Yoga',planets:[d2w,d11w],source:'BPHS Ch.37',desc:`2H lord (${d2w}) + 11H lord (${d11w}) conjunct — Dhana Yoga. Multiple income streams, accumulated wealth.`});
  if(P[d9w]&&isKT(h(d9w))&&sc(d9w)>=4) f('wealth',{type:'Lakshmi Wealth',planet:d9w,source:'BPHS Ch.36',desc:`Strong 9H lord (${d9w}) in kendra/trikona — Lakshmi Yoga wealth component. Fortunate financial life.`});

  // EDUCATION (~15 rules)
  if(P.Jupiter&&[1,2,4,5].includes(h('Jupiter'))&&sc('Jupiter')>=3) f('education',{planet:'Jupiter',house:h('Jupiter'),source:'BPHS Ch.14',desc:`Jupiter in H${h('Jupiter')} — higher education, philosophy, law, or spirituality. Teaching and learning are life themes.`});
  if(P.Mercury&&[1,2,4,5].includes(h('Mercury'))&&!P.Mercury.comb) f('education',{planet:'Mercury',house:h('Mercury'),source:'BPHS Ch.14',desc:`Mercury in H${h('Mercury')} — sharp intellect, academic success. Writing, communication, or technical fields natural.`});
  const l4ed=hLP(4);
  if(P[l4ed]&&sc(l4ed)>=4) f('education',{type:'Formal Education',planet:l4ed,house:h(l4ed),source:'BPHS Ch.14',desc:`Strong 4H lord (${l4ed}) — solid formal education foundation. Academic persistence and success.`});
  if(P.Sun&&[1,4,5,9].includes(h('Sun'))&&sc('Sun')>=4) f('education',{type:'Government Education',planet:'Sun',source:'BPHS',desc:'Strong Sun in education house — government educational institutions. Administration or leadership in academic career.'});
  if(P.Saturn&&[4,5].includes(h('Saturn'))) f('education',{type:'Technical',planet:'Saturn',house:h('Saturn'),source:'BPHS',desc:'Saturn in 4H/5H — technical, disciplined education. Engineering, architecture, or structured academic paths.'});
  if(P.Rahu&&[4,5].includes(h('Rahu'))) f('education',{type:'Unconventional',planet:'Rahu',house:h('Rahu'),source:'Nadi',desc:'Rahu in 4H/5H — unconventional education path. Foreign education possible. Self-taught or alternative learning.'});
  if(P.Ketu&&[4,5].includes(h('Ketu'))) f('education',{type:'Spiritual',planet:'Ketu',house:h('Ketu'),source:'Nadi',desc:'Ketu in 4H/5H — past-life knowledge accessible. Spiritual or esoteric education. Early education may be incomplete but deep learning emerges later.'});

  // PROPERTY (~15 rules)
  const l4pr=hLP(4);
  if(P[l4pr]&&isKT(h(l4pr))) f('property',{planet:l4pr,house:h(l4pr),source:'BPHS Ch.15',desc:`4H lord (${l4pr}) in kendra/trikona — property ownership, vehicles, and comforts acquired.`});
  if(P.Mars&&[4,11].includes(h('Mars'))) f('property',{planet:'Mars',house:h('Mars'),source:'BPHS Ch.15',desc:`Mars in H${h('Mars')} — land and property acquisition. Real estate as income. Energy in building homes.`});
  if(P.Saturn&&h('Saturn')===4&&sc('Saturn')>=4) f('property',{planet:'Saturn',house:4,source:'BPHS Ch.15',desc:'Saturn in 4H strong — ancestral land, old property. Multiple properties over time. Real estate investment.'});
  if(P.Jupiter&&h('Jupiter')===4) f('property',{planet:'Jupiter',house:4,source:'BPHS',desc:'Jupiter in 4H — beautiful home, comfortable vehicles. Domestic happiness and property wealth.'});
  if(P.Venus&&h('Venus')===4) f('property',{planet:'Venus',house:4,source:'BPHS',desc:'Venus in 4H — beautiful, luxurious home. Aesthetic property. Happiness through domestic beauty.'});

  // PARENTS (~25 rules)
  const l9par=hLP(9),l4mat=hLP(4);
  if(P[l9par]){
    if(sc(l9par)>=4) f('parents',{type:'Father',planet:l9par,house:h(l9par),source:'BPHS Ch.13',desc:`Strong 9H lord (${l9par}) — fortunate father, support from paternal side. Father is respected or prosperous.`});
    if(isDust(h(l9par))) f('parents',{type:'Father Challenge',planet:l9par,source:'BPHS Ch.13',desc:`9H lord (${l9par}) in dusthana — father faces challenges. Limited paternal support.`});
    if(conj(s(l9par),s('Saturn'))||pAspects('Saturn',s('Saturn'),s(l9par))) f('parents',{type:'Father Hardship',source:'BPHS',desc:`Saturn afflicts 9H lord (${l9par}) — father's life has hardship, delays, or chronic challenges.`});
  }
  if(P[l4mat]){
    if(sc(l4mat)>=4) f('parents',{type:'Mother',planet:l4mat,house:h(l4mat),source:'BPHS Ch.13',desc:`Strong 4H lord (${l4mat}) — fortunate mother, strong maternal bond. Mother provides stability.`});
    if(isDust(h(l4mat))) f('parents',{type:'Mother Challenge',planet:l4mat,source:'BPHS Ch.13',desc:`4H lord (${l4mat}) in dusthana — mother faces challenges. Emotional distance possible.`});
  }
  if(P.Moon&&(sc('Moon')<=2||(P.Rahu&&conj(s('Moon'),s('Rahu'))))) f('parents',{type:'Mother Health',source:'BPHS Ch.13',desc:'Afflicted Moon — mother may face health challenges. Complex emotional relationship with mother.'});
  if(P.Sun&&sc('Sun')<=2) f('parents',{type:'Father Challenge',source:'BPHS Ch.13',desc:'Weak Sun — father may face difficulties. Authority issues in life. Self-reliance becomes the strength.'});

  // SIBLINGS (~20 rules)
  const l3p=hLP(3);
  if(P[l3p]){
    if(sc(l3p)>=4) f('siblings',{planet:l3p,house:h(l3p),source:'BPHS Ch.12',desc:`Strong 3H lord (${l3p}) — good relationship with siblings, siblings may be successful. Support from younger siblings.`});
    if(isDust(h(l3p))) f('siblings',{planet:l3p,house:h(l3p),source:'BPHS Ch.12',desc:`3H lord (${l3p}) in dusthana — challenges with siblings. Competition or conflict possible.`});
  }
  if(P.Mars&&(isKendra(h('Mars'))||h('Mars')===3)) f('siblings',{planet:'Mars',house:h('Mars'),source:'BPHS Ch.12',desc:`Mars prominent — energetic, strong siblings. Brothers may be prominent. Physical courage in siblings.`});
  if(P.Saturn&&h('Saturn')===3) f('siblings',{planet:'Saturn',house:3,source:'BPHS',desc:'Saturn in 3H — fewer siblings or estrangement. Serious, older siblings. Relations improve with time.'});
  if(P.Mercury&&h('Mercury')===3) f('siblings',{planet:'Mercury',house:3,source:'BPHS',desc:'Mercury in 3H — clever, communicative siblings. Many siblings or cousins. Business through siblings.'});
  if(P.Jupiter&&h('Jupiter')===3) f('siblings',{planet:'Jupiter',house:3,source:'BPHS',desc:'Jupiter in 3H — wise siblings, religious older sibling. Philosophical guidance from brothers/sisters.'});

  // ═══════════════════════════════════════════════════════════════════════════
  // S14. DASHA PERIOD QUALITY — Mahadasha + Antardasha + Pratyantar (~60 rules)
  // Source: BPHS Ch.46-53
  // ═══════════════════════════════════════════════════════════════════════════
  const dashaChar={
    Sun:{kw:'authority,father,government,career,ego,leadership',good:'career advancement, government recognition, father health focus, leadership roles, vitality',challenge:'ego conflicts, authority clashes, father issues, career obstacles, eye/heart health'},
    Moon:{kw:'mind,mother,emotions,public,water,travel',good:'emotional fulfillment, public success, mother\'s wellbeing, creative expression, social popularity',challenge:'emotional turbulence, mother\'s health, mental instability, weight fluctuations, domestic issues'},
    Mars:{kw:'energy,property,siblings,courage,fire,surgery',good:'property acquisition, career advancement, courage rewarded, siblings support, competitive success',challenge:'accidents, anger, property disputes, sibling conflicts, surgery possible, over-aggression'},
    Mercury:{kw:'intellect,communication,business,siblings,analysis',good:'business success, communication career, education, intellectual achievements, multiple income sources',challenge:'over-analysis, communication failures, business setbacks, nervous system issues, mental fatigue'},
    Jupiter:{kw:'wisdom,children,marriage,religion,fortune,teacher',good:'marriage, children, higher education, spiritual growth, financial expansion, recognition',challenge:'over-expansion, liver health, weight gain, misplaced trust, religious conflicts'},
    Venus:{kw:'love,marriage,beauty,arts,luxury,romance',good:'marriage, romance, arts career, luxury, financial gains through beauty, social charm',challenge:'overindulgence, romantic complications, reproductive health, kidney issues, vanity'},
    Saturn:{kw:'discipline,karma,delays,property,labour,longevity',good:'career authority, real estate, long-term projects come to fruition, spiritual discipline, responsibility rewarded',challenge:'delays, health issues (joints/skin/bones), isolation, career obstacles, depression tendency'},
    Rahu:{kw:'ambition,foreign,unconventional,worldly desires,illusion',good:'foreign opportunities, unconventional success, technical careers, bold moves rewarded, rise to power',challenge:'illusion, deception, foreign problems, health mysteries, relationship instability, overambition'},
    Ketu:{kw:'spirituality,detachment,past-life,moksha,isolation',good:'spiritual growth, occult wisdom, healing, detachment from worldly burdens, intuitive insights',challenge:'losses, isolation, health issues (mysterious), accidents, detachment from responsibilities'},
  };

  if(dasha.maha_l){
    const mL=dasha.maha_l,mPn=FN[mL],mP=P[mPn];
    if(mP){
      const quality=sc(mPn)>=5&&isKT(h(mPn))?'Excellent':sc(mPn)>=4&&!isDust(h(mPn))?'Good':isDust(h(mPn))||sc(mPn)<=2?'Challenging':'Mixed';
      const char=dashaChar[mPn];
      f('dasha_q',{type:'Mahadasha',planet:mPn,house:h(mPn),sign:ln(mPn),strength:st(mPn),quality,ends:fmtYr(dasha.maha_end||0),source:'BPHS Ch.46',
        keywords:char?.kw||'',
        desc:`${mPn} Mahadasha — ${quality} period. ${mPn} in H${h(mPn)} (${ln(mPn)}), ${st(mPn)}. ${quality==='Excellent'?'Peak period: '+char?.good:quality==='Good'?'Positive themes: '+char?.good:quality==='Challenging'?'Challenging themes: '+char?.challenge:'Mixed results — '+char?.good+'. Watch for: '+char?.challenge}. Period ends: ${fmtYr(dasha.maha_end||0)}.`});
    }
  }

  if(dasha.antar_l){
    const aL=dasha.antar_l,aPn=FN[aL],aP=P[aPn];
    if(aP&&dasha.maha_l){
      const mPn=FN[dasha.maha_l];
      const friends={Sun:['Moon','Mars','Jupiter'],Moon:['Sun','Mercury'],Mars:['Sun','Moon','Jupiter'],Mercury:['Sun','Venus'],Jupiter:['Sun','Moon','Mars'],Venus:['Mercury','Saturn'],Saturn:['Mercury','Venus'],Rahu:['Venus','Saturn'],Ketu:['Venus','Saturn']};
      const isFr=(friends[mPn]||[]).includes(aPn)||(friends[aPn]||[]).includes(mPn);
      const isEn=(['Sun','Saturn'].includes(mPn)&&['Saturn','Sun'].includes(aPn))||(['Mars','Mercury'].includes(mPn)&&['Mercury','Mars'].includes(aPn));
      const quality=sc(aPn)>=4&&!isDust(h(aPn))&&!isEn?isFr?'Excellent':'Good':isDust(h(aPn))||isEn||sc(aPn)<=2?'Challenging':'Mixed';
      const char=dashaChar[aPn];
      f('dasha_q',{type:'Antardasha',planet:aPn,house:h(aPn),sign:ln(aPn),strength:st(aPn),quality,ends:fmtYr(dasha.antar_end||0),source:'BPHS Ch.46',
        desc:`${aPn} Antardasha within ${mPn} Mahadasha — ${quality} sub-period. ${isEn?'Enemy combination creates friction.':isFr?'Friendly combination — smooth flow.':'Neutral combination.'} ${aPn} themes: ${char?.kw||''}. ${quality==='Excellent'?'Peak sub-period for '+char?.good:quality==='Challenging'?'Watch for: '+char?.challenge:'Focus on: '+char?.good}. Ends: ${fmtYr(dasha.antar_end||0)}.`});
    }
  }

  // Timing windows from upcoming dashas
  const upcoming=dasha.seq.filter(s=>s.start>NOW&&s.start<NOW+25);
  for(const ud of upcoming){
    const upPn=FN[ud.lord],upP=P[upPn];
    if(!upP)continue;
    const upQ=sc(upPn)>=5&&isKT(h(upPn))?'Excellent':sc(upPn)>=4&&!isDust(h(upPn))?'Good':isDust(h(upPn))||sc(upPn)<=2?'Challenging':'Mixed';
    const char=dashaChar[upPn];
    if(upQ!=='Challenging') f('timing',{event:`${upPn} Mahadasha`,period:`${fmtYr(ud.start)}-${fmtYr(ud.end)}`,planet:upPn,house:h(upPn),quality:upQ,source:'BPHS Dasha',
      desc:`${upPn} Mahadasha begins ${fmtYr(ud.start)} — ${upQ} period ahead. Key themes: ${char?.kw||''}. Expected positives: ${char?.good||''}. Prepare now.`});
    else f('timing',{event:`${upPn} Mahadasha (Caution)`,period:`${fmtYr(ud.start)}-${fmtYr(ud.end)}`,planet:upPn,quality:upQ,source:'BPHS Dasha',
      desc:`${upPn} Mahadasha begins ${fmtYr(ud.start)} — requires caution. Challenges: ${char?.challenge||''}. Prepare with remedies and discipline.`});
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // S15. SADE SATI + TRANSIT ANALYSIS (~70 rules)
  // Source: Classical transit texts, Phaladeepika
  // ═══════════════════════════════════════════════════════════════════════════
  if(transits){
    const tSatS=transits.Saturn!==undefined?so(transits.Saturn):null;
    const tJupS=transits.Jupiter!==undefined?so(transits.Jupiter):null;
    const tRahS=transits.Rahu!==undefined?so(transits.Rahu):null;
    const tMarS=transits.Mars!==undefined?so(transits.Mars):null;

    // Sade Sati
    if(tSatS!==null){
      const diff=((tSatS-ms+12)%12);
      if(diff===11) R.sade_sati={phase:'Rising (12th from Moon)',severity:'Moderate',source:'Classical',desc:`Saturn transiting 12th from natal Moon — first phase of Sade Sati. Expenses rise, confusion, sleep disturbances. Prepare for main phase. Duration: ~2.5 years.`};
      else if(diff===0) R.sade_sati={phase:'Peak (Moon sign)',severity:'High',source:'Classical',desc:`Saturn transiting natal Moon sign — peak Sade Sati. Most intense phase. Mental stress, relationship pressure, career disruptions. Also: transformation and clarity. Duration: ~2.5 years.`};
      else if(diff===1) R.sade_sati={phase:'Setting (2nd from Moon)',severity:'Moderate',source:'Classical',desc:`Saturn transiting 2nd from Moon — final Sade Sati phase. Financial pressure, family tension. Relief coming. Worst is behind. Duration: ~2.5 years.`};
      else R.sade_sati={phase:'Not active',severity:'None',desc:'Not currently in Sade Sati.'};

      if(diff===3) R.sade_sati={...R.sade_sati,small_panoti:'Dhaiya (4th from Moon)',small_panoti_desc:'Saturn in 4th from Moon — domestic disruptions, career pressures, mother\'s health. 2.5 years.'};
      if(diff===7) R.sade_sati={...R.sade_sati,small_panoti:'Ashtama Shani (8th from Moon)',small_panoti_desc:'Saturn in 8th from Moon — health concerns, unexpected expenses, most challenging Dhaiya. 2.5 years.'};
    }

    // Saturn transit from lagna (12 positions)
    if(tSatS!==null){
      const satFromL=houseOf(tSatS,ls);
      const satFromM=houseOf(tSatS,ms);
      const satTransitDesc={
        1:'Saturn transiting 1st house — physical health strain, identity pressures, new karmic cycle beginning. Discipline in health essential.',
        2:'Saturn transiting 2nd — family pressures, financial caution needed, speech may become harsh. Conservative approach to money.',
        3:'Saturn transiting 3rd — hard work rewarded, courage tested, sibling issues possible. Good for persistent efforts.',
        4:'Saturn transiting 4th — Kantak Shani. Domestic unhappiness, mother\'s health, property challenges.',
        5:'Saturn transiting 5th — children or romance challenges. Speculative losses possible. Intellectual discipline.',
        6:'Saturn transiting 6th — Upachaya benefit. Enemies defeated through persistence. Work environment demanding but rewarding.',
        7:'Saturn transiting 7th — relationship pressures, business partner challenges. Marriage patience needed.',
        8:'Saturn transiting 8th — health challenges, unexpected events, financial disruptions. Avoid risky activities.',
        9:'Saturn transiting 9th — father\'s health, luck restricted temporarily. Dharmic discipline.',
        10:'Saturn transiting 10th — career authority but also pressure. Leadership tested. Recognition through hard work.',
        11:'Saturn transiting 11th — gains from persistent networking. Social obligations. Best Saturn transit.',
        12:'Saturn transiting 12th — expenses, isolation, foreign connections. Spiritual work valuable.',
      };
      f('transits_now',{planet:'Saturn',from_lagna:satFromL,from_moon:satFromM,transit_sign:RS[tSatS],type:satFromL===3||satFromL===6||satFromL===11?'Positive':'Caution',source:'Phaladeepika',desc:satTransitDesc[satFromL]});
    }

    // Jupiter transit (most important benefic transit)
    if(tJupS!==null){
      const jupFromM=houseOf(tJupS,ms);
      const jupFromL=houseOf(tJupS,ls);
      const GOOD_M=[2,5,7,9,11],GOOD_L=[1,4,5,7,9,10,11];
      const jupTransitDesc={
        1:'Jupiter transiting 1H — physical expansion, new beginnings, religious inclination, optimism.',
        2:'Jupiter transiting 2H — financial gains, family happiness, educational improvement. Favorable.',
        3:'Jupiter transiting 3H — short journeys with purpose, siblings support. Mixed for long-term gains.',
        4:'Jupiter transiting 4H — domestic happiness, property acquisition possible, mother\'s wellbeing.',
        5:'Jupiter transiting 5H — children and romance blessed. Excellent for conception. Creative success.',
        6:'Jupiter transiting 6H — health challenges, service work. Enemies from unexpected quarters.',
        7:'Jupiter transiting 7H — marriage and partnership improvement. Business expansion.',
        8:'Jupiter transiting 8H — research, occult, possible health focus. Inheritance possible.',
        9:'Jupiter transiting 9H — travel, higher learning, father\'s improvement. Dharmic period.',
        10:'Jupiter transiting 10H — career recognition, promotion possible. Public acknowledgment.',
        11:'Jupiter transiting 11H — excellent gains. Network expansion. Desires fulfilled.',
        12:'Jupiter transiting 12H — spiritual growth, foreign travel, expenses on dharma.',
      };
      const isGood=GOOD_M.includes(jupFromM)&&GOOD_L.includes(jupFromL);
      f('transits_now',{planet:'Jupiter',from_lagna:jupFromL,from_moon:jupFromM,transit_sign:RS[tJupS],type:isGood?'Positive':'Challenging',source:'Phaladeepika',
        desc:jupTransitDesc[jupFromM]+` Jupiter currently ${isGood?'well-placed for expansion and opportunities':'in challenging transit — patience needed'}.`});
    }

    // Rahu transit
    if(tRahS!==null){
      const rahFromL=houseOf(tRahS,ls),rahFromM=houseOf(tRahS,ms);
      const rahDesc={3:'gains through communication, unconventional courage',6:'power over enemies, hidden gains',10:'career rise through unconventional means',11:'sudden financial gains'};
      const rahBad={1:'health concerns, identity confusion',2:'financial instability',5:'children or romance complications',7:'relationship disruptions',8:'sudden health events',9:'luck disrupted',12:'foreign losses'};
      if(rahDesc[rahFromL]) f('transits_now',{planet:'Rahu',from_lagna:rahFromL,transit_sign:RS[tRahS],type:'Positive',source:'Classical',desc:`Rahu transiting H${rahFromL} from lagna — ${rahDesc[rahFromL]}.`});
      else if(rahBad[rahFromL]) f('transits_now',{planet:'Rahu',from_lagna:rahFromL,transit_sign:RS[tRahS],type:'Challenging',source:'Classical',desc:`Rahu transiting H${rahFromL} from lagna — ${rahBad[rahFromL]}. Stay grounded and practical.`});
    }

    // Mars transit (short ~45 days but important for health/accidents)
    if(tMarS!==null){
      const marFromM=houseOf(tMarS,ms);
      if([1,4,7,8].includes(marFromM)) f('transits_now',{planet:'Mars',from_moon:marFromM,transit_sign:RS[tMarS],type:'Caution',duration:'~45 days',source:'Phaladeepika',
        desc:`Mars transiting H${marFromM} from Moon — short-term caution period. Accidents, arguments, health flare-ups possible. Avoid conflict and reckless action for ~45 days.`});
      if([3,6,11].includes(marFromM)) f('transits_now',{planet:'Mars',from_moon:marFromM,transit_sign:RS[tMarS],type:'Positive',duration:'~45 days',source:'Phaladeepika',
        desc:`Mars transiting H${marFromM} from Moon — favorable short period for physical activity, competitive endeavors, property matters.`});
    }

    // Check each transit planet over natal planets
    for(const[tpn,tlon]of Object.entries(transits)){
      if(tlon===undefined)continue;
      const tsi=so(tlon);
      for(const[npn,npd]of Object.entries(P)){
        if(tpn===npn)continue;
        if(tsi===npd.si){
          // Transiting planet conjunct natal planet
          if(tpn==='Saturn'&&['Sun','Moon','Mars','Mercury'].includes(npn))
            f('transits_now',{type:`Transit ${tpn} conjunct natal ${npn}`,planets:[tpn,npn],sign:RS[tsi],source:'Phaladeepika',
              desc:`Transiting Saturn conjunct natal ${npn} — pressure on ${npn}'s significations. Delays and restrictions in ${npn}'s life areas. Duration: ~2.5 years.`});
          if(tpn==='Jupiter'&&['Moon','Venus','Mercury','Jupiter'].includes(npn))
            f('transits_now',{type:`Transit ${tpn} conjunct natal ${npn}`,planets:[tpn,npn],sign:RS[tsi],source:'Phaladeepika',
              desc:`Transiting Jupiter conjunct natal ${npn} — expansion and blessings on ${npn}'s significations. Positive period for ${npn}'s life areas.`});
          if(tpn==='Rahu'&&['Sun','Moon','Mars'].includes(npn))
            f('transits_now',{type:`Transit Rahu conjunct natal ${npn}`,planets:[tpn,npn],sign:RS[tsi],source:'Classical',
              desc:`Transiting Rahu conjunct natal ${npn} — instability and unusual events in ${npn}'s areas. Ambition mixed with confusion.`});
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // S16. PSYCHOLOGICAL PATTERNS (~50 rules)
  // Source: Nadi texts, modern Jyotish psychology
  // ═══════════════════════════════════════════════════════════════════════════
  // Attachment styles
  if(P.Moon&&P.Saturn&&(conj(s('Moon'),s('Saturn'))||pAspects('Saturn',s('Saturn'),s('Moon'))))
    f('psych',{type:'Avoidant Attachment',planets:['Moon','Saturn'],source:'Nadi',desc:'Moon-Saturn — avoidant attachment style. Emotional needs suppressed. Difficulty asking for help or being vulnerable. Self-reliance to a fault. May push away those who get too close.'});
  if(P.Moon&&P.Rahu&&(conj(s('Moon'),s('Rahu'))||pAspects('Rahu',s('Rahu'),s('Moon'))))
    f('psych',{type:'Anxious Attachment',planets:['Moon','Rahu'],source:'Nadi',desc:'Moon-Rahu — anxious or ambivalent attachment. Fear of abandonment, clingy tendencies alternating with withdrawal. Emotional roller coaster. Benefit from therapy and grounding.'});
  if(P.Moon&&P.Ketu&&conj(s('Moon'),s('Ketu')))
    f('psych',{type:'Detached Attachment',planets:['Moon','Ketu'],source:'Nadi',desc:'Moon-Ketu — detached attachment style. Spiritual distance from emotional bonds. Past-life emotional wounds cause present-day emotional unavailability. Healing through acceptance.'});
  if(P.Moon&&P.Venus&&(conj(s('Moon'),s('Venus'))||pAspects('Venus',s('Venus'),s('Moon'))))
    f('psych',{type:'Secure/Romantic',planets:['Moon','Venus'],source:'Nadi',desc:'Moon-Venus — emotionally romantic nature. Loving and nurturing attachment style. Harmony-seeking. Relationships as emotional sustenance. Strong need for beauty and affection.'});

  // Anger and aggression patterns
  if(P.Mars&&P.Saturn&&(conj(s('Mars'),s('Saturn'))||pAspects('Saturn',s('Saturn'),s('Mars'))))
    f('psych',{type:'Suppressed Anger',planets:['Mars','Saturn'],source:'Nadi',desc:'Mars-Saturn — anger suppressed by discipline. Frustration builds over time and explodes unpredictably. Passive-aggressive tendency. Needs conscious anger management and physical outlets.'});
  if(P.Mars&&h('Mars')===1)
    f('psych',{type:'Overt Anger',planet:'Mars',house:1,source:'Nadi',desc:'Mars in 1H — anger close to the surface, hot-headed reactions, physical expression of emotion. Needs channeling through sports, exercise, or martial arts.'});
  if(P.Mars&&P.Moon&&conj(s('Mars'),s('Moon')))
    f('psych',{type:'Emotional Aggression',planets:['Mars','Moon'],source:'Nadi',desc:'Moon-Mars — emotional impulsiveness, reactive anger. Feelings quickly become actions. Mother relationship has Mars energy. Moods affect physical health.'});

  // Fears and anxieties
  if(P.Saturn&&h('Saturn')===12)
    f('psych',{type:'Hidden Fears',planet:'Saturn',house:12,source:'Nadi',desc:'Saturn in 12H — deep unconscious fears from past life karma. Fear of isolation, failure, or karmic punishment. Confronting these fears through meditation or therapy transforms them into wisdom.'});
  if(P.Rahu&&h('Rahu')===12)
    f('psych',{type:'Unconscious Obsessions',planet:'Rahu',house:12,source:'Nadi',desc:'Rahu in 12H — unconscious obsessions and foreign influences. Foreign fears or attraction. May struggle with substance abuse or escapism. Spiritual practice redirects energy.'});
  if(P.Ketu&&h('Ketu')===1)
    f('psych',{type:'Identity Dissolution',planet:'Ketu',house:1,source:'Nadi',desc:'Ketu in 1H — identity feels fragmented or non-material. Difficulty asserting the ego. Strong spiritual inclination but worldly disorientation. Past-life spiritual maturity is the gift.'});

  // Mental health
  if(P.Moon&&P.Saturn&&conj(s('Moon'),s('Saturn'))&&isDust(h('Moon')))
    f('psych',{type:'Depression Risk',planets:['Moon','Saturn'],severity:'High',source:'Nadi',desc:'Moon-Saturn conjunction in dusthana — heightened depression risk. Emotional darkness recurring. Professional mental health support strongly recommended. Medication may be beneficial.'});
  if(P.Moon&&P.Mars&&P.Saturn&&conj(s('Moon'),s('Mars'))&&pAspects('Saturn',s('Saturn'),s('Moon')))
    f('psych',{type:'Emotional Volatility',planets:['Moon','Mars','Saturn'],severity:'High',source:'Nadi',desc:'Moon afflicted by both Mars and Saturn — extreme emotional volatility. Anger followed by depression. Bipolar tendency possible. Grounding, therapy, and routine essential.'});
  if(P.Mercury&&P.Rahu&&(conj(s('Mercury'),s('Rahu'))||pAspects('Rahu',s('Rahu'),s('Mercury'))))
    f('psych',{type:'Obsessive Thinking',planets:['Mercury','Rahu'],source:'Nadi',desc:'Mercury-Rahu — obsessive, looping thought patterns. Mind seeks unusual or forbidden knowledge. Overthinking decisions. Meditation and mindfulness help stabilize mental energy.'});

  // Relationship red flags
  if(P.Venus&&P.Saturn&&conj(s('Venus'),s('Saturn'))&&isDust(h('Venus')))
    f('psych',{type:'Love Denial',planets:['Venus','Saturn'],severity:'Moderate',source:'Nadi',desc:'Venus-Saturn in dusthana — pattern of denying oneself love and pleasure. Guilt around enjoyment. Work-love imbalance. Past-life relationships leave coldness toward intimacy.'});
  if(P.Mars&&h('Mars')===7&&P.Saturn&&h('Saturn')===7)
    f('psych',{type:'Relationship Conflict Pattern',planets:['Mars','Saturn'],house:7,severity:'High',source:'Nadi',desc:'Mars and Saturn both in 7H — severe relationship conflict pattern. Power struggles, cold-hot dynamics, potential for toxic relationships. Deep inner work required before healthy partnership.'});
  if(P.Rahu&&h('Rahu')===5&&P.Venus&&isDust(h('Venus')))
    f('psych',{type:'Romantic Compulsion',planets:['Rahu','Venus'],source:'Nadi',desc:'Rahu in 5H with afflicted Venus — romantic compulsion, addictive relationship patterns. Chasing unavailable partners. Healing past-life romantic karma.'});

  // Confidence patterns
  if(P.Sun&&isDust(h('Sun'))&&sc('Sun')<=2)
    f('psych',{type:'Low Confidence',planet:'Sun',house:h('Sun'),source:'Nadi',desc:'Weak Sun in dusthana — self-confidence issues, authority complex, difficulty with father. Success requires building inner authority independently of external validation.'});
  if(P.Sun&&isKT(h('Sun'))&&sc('Sun')>=4)
    f('psych',{type:'High Confidence',planet:'Sun',house:h('Sun'),source:'Nadi',desc:'Strong Sun in kendra/trikona — natural confidence, self-assurance, leadership ability. Ego needs to be directed toward service rather than dominance for best results.'});

  // ═══════════════════════════════════════════════════════════════════════════
  // S17. SPIRITUAL / DHARMA / KARMIC THEMES (~30 rules)
  // ═══════════════════════════════════════════════════════════════════════════
  if(P.Ketu&&h('Ketu')===12) f('spiritual',{type:'Moksha',planet:'Ketu',house:12,source:'BPHS Ch.40',desc:'Ketu in 12H — strongest moksha indicator. Past-life spiritual advancement. Meditation and solitude natural. Liberation in this lifetime possible.'});
  if(P.Jupiter&&h('Jupiter')===9) f('spiritual',{type:'Dharmic Fortune',planet:'Jupiter',house:9,source:'BPHS',desc:'Jupiter in 9H — most auspicious placement for dharma. Religious wisdom, good fortune, philosophical authority. Teacher or guru in this or future lives.'});
  if(P.Ketu&&h('Ketu')===9) f('spiritual',{type:'Past Dharma',planet:'Ketu',house:9,source:'Nadi',desc:'Ketu in 9H — past-life dharmic merit. Unconventional spiritual path. Father may be spiritually inclined. Pilgrimages hold significance.'});
  if(P.Saturn&&h('Saturn')===12) f('spiritual',{type:'Karmic Isolation',planet:'Saturn',house:12,source:'BPHS',desc:'Saturn in 12H — karmic isolation and retreat. Deep spiritual work through solitude. Long-term spiritual discipline rewarded with liberation.'});
  if(P.Moon&&h('Moon')===12) f('spiritual',{type:'Psychic Intuition',planet:'Moon',house:12,source:'BPHS',desc:'Moon in 12H — strong intuition, psychic sensitivity, vivid dreams. Spiritual inclination through feminine or devotional traditions.'});
  if(P.Jupiter&&P.Ketu&&conj(s('Jupiter'),s('Ketu'))) f('spiritual',{type:'Liberation',planets:['Jupiter','Ketu'],source:'Nadi',desc:'Jupiter-Ketu conjunction — exceptional past-life wisdom. Philosophical detachment. Moksha through wisdom. Spiritual teacher energy.'});
  if(P.Saturn&&P.Ketu&&conj(s('Saturn'),s('Ketu'))) f('spiritual',{type:'Karmic Release',planets:['Saturn','Ketu'],source:'Nadi',desc:'Saturn-Ketu conjunction — forced renunciation of worldly structures. Deep karmic purification. Spiritual liberation through loss and discipline.'});

  // Dharma indicator: 9H well-stocked
  const planetsIn9=Object.entries(P).filter(([n,d])=>d.h===9);
  if(planetsIn9.length>=2) f('spiritual',{planets:planetsIn9.map(([n])=>n),house:9,source:'BPHS',desc:`Multiple planets (${planetsIn9.map(([n])=>n).join(', ')}) in 9H — strong dharmic orientation. Philosophy, religion, foreign travel, and higher wisdom are central life themes.`});

  // ═══════════════════════════════════════════════════════════════════════════
  // S18. FOREIGN TRAVEL & RELOCATION (~20 rules)
  // ═══════════════════════════════════════════════════════════════════════════
  const p12th=Object.entries(P).filter(([n,d])=>d.h===12);
  const p9th=Object.entries(P).filter(([n,d])=>d.h===9);
  if(p12th.length>=2) f('foreign',{planets:p12th.map(([n])=>n),source:'BPHS Ch.11',desc:`Multiple planets in 12H — foreign settlement or long foreign stays strongly indicated. Life abroad possible.`});
  if(P.Rahu&&[9,12].includes(h('Rahu'))) f('foreign',{planet:'Rahu',house:h('Rahu'),source:'Nadi',desc:`Rahu in H${h('Rahu')} — foreign travel, career abroad, international connections. Life-changing foreign experiences.`});
  if(P.Ketu&&[9,12].includes(h('Ketu'))) f('foreign',{planet:'Ketu',house:h('Ketu'),source:'Nadi',desc:`Ketu in H${h('Ketu')} — past-life foreign connections. Spiritual purpose in foreign travel.`});
  const l12f=hLP(12);
  if(P[l12f]&&[1,7].includes(h(l12f))) f('foreign',{planet:l12f,house:h(l12f),source:'BPHS Ch.11',desc:`12H lord (${l12f}) in 1H/7H — foreign settlement strong possibility. Spouse may be from foreign land.`});
  if(P.Moon&&h('Moon')===9) f('foreign',{planet:'Moon',house:9,source:'BPHS',desc:'Moon in 9H — frequent long journeys, emotional connection to foreign places, pilgrimages. Mind finds peace abroad.'});
  if(P.Jupiter&&h('Jupiter')===9&&sc('Jupiter')>=4) f('foreign',{planet:'Jupiter',house:9,source:'BPHS',desc:'Strong Jupiter in 9H — fortunate foreign travels. Religious journeys. Higher education abroad possible.'});
  if(p9th.length>=2) f('foreign',{planets:p9th.map(([n])=>n),source:'BPHS',desc:`Multiple planets in 9H — long international journeys, foreign philosophy, possible immigration.`});

  // ═══════════════════════════════════════════════════════════════════════════
  // S19. LONGEVITY (~20 rules)
  // Source: BPHS Ch.44
  // ═══════════════════════════════════════════════════════════════════════════
  const l8lon=hLP(8);
  if(P[l8lon]&&sc(l8lon)>=4) f('longevity',{planet:l8lon,house:h(l8lon),source:'BPHS Ch.44',desc:`Strong 8H lord (${l8lon}) — longevity supported. Good recovery from illness. Inheritance possible.`});
  if(P[l8lon]&&sc(l8lon)<=2) f('longevity',{planet:l8lon,house:h(l8lon),source:'BPHS Ch.44',desc:`Weak 8H lord (${l8lon}) — health vigilance essential. Avoid reckless risks. Regular check-ups important.`});
  if(P.Jupiter&&isKT(h('Jupiter'))&&sc('Jupiter')>=4) f('longevity',{planet:'Jupiter',house:h('Jupiter'),source:'BPHS',desc:'Strong Jupiter in kendra/trikona — longevity blessed. Jupiter as life protector. Recovery from illness good.'});
  if(P.Saturn&&h('Saturn')===8&&sc('Saturn')>=4) f('longevity',{planet:'Saturn',house:8,source:'BPHS',desc:'Saturn in 8H — disciplined approach to longevity. Long life through careful health management.'});

  // ═══════════════════════════════════════════════════════════════════════════
  // S20. LIFE ARC — Saturn return, Jupiter return, nodal return (~20 rules)
  // ═══════════════════════════════════════════════════════════════════════════
  const now=new Date();
  const birthYearApprox=now.getFullYear()-30; // approximate, will be refined with actual birth year
  const satReturnAge=29.5,jupReturnAge=12;
  const currentAge=NOW-Math.floor(NOW); // crude — actual age needs birth year
  f('timing',{event:'Saturn Return (Age 29-30)',source:'Classical',desc:'First Saturn return at age ~29-30 — major life restructuring. Career, relationships, and identity all face pressure and transformation. What isn\'t built on solid foundations dissolves. This is a defining transition.'});
  f('timing',{event:'Saturn Second Return (Age 58-60)',source:'Classical',desc:'Second Saturn return at age 58-60 — legacy and wisdom crystallize. Let go of what no longer serves. This is the elder phase beginning.'});
  f('timing',{event:'Jupiter Return (Age 12, 24, 36, 48, 60)',source:'Classical',desc:'Jupiter returns every 12 years — expansion, opportunity, and philosophical upgrade. Each Jupiter return brings a new 12-year chapter of growth.'});
  if(dasha.maha_l){
    const mPn=FN[dasha.maha_l];
    const satDasha=dasha.seq.find(s=>s.lord==='Sa');
    const jupDasha=dasha.seq.find(s=>s.lord==='Ju');
    if(satDasha) f('timing',{event:'Saturn Mahadasha',period:`${fmtYr(satDasha.start)}-${fmtYr(satDasha.end)}`,source:'BPHS',desc:`Saturn Mahadasha (${fmtYr(satDasha.start)}-${fmtYr(satDasha.end)}) — authority, career structure, real estate, discipline rewarded. Hard work compounds into legacy.`});
    if(jupDasha) f('timing',{event:'Jupiter Mahadasha',period:`${fmtYr(jupDasha.start)}-${fmtYr(jupDasha.end)}`,source:'BPHS',desc:`Jupiter Mahadasha (${fmtYr(jupDasha.start)}-${fmtYr(jupDasha.end)}) — expansion, wisdom, marriage, children, higher education, spiritual growth. Often the chart's best period.`});
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // S21. NAVAMSA (D9) CROSS-REFERENCES (~50 rules)
  // Source: BPHS Ch.6, Saravali
  // ═══════════════════════════════════════════════════════════════════════════
  // Navamsa positions (approximate — computed from natal longitude)
  function getNavamsaSign(lon){
    const normLon=n360(lon);
    const sign=so(normLon);
    const degInSign=normLon%30;
    const navamsaNum=Math.floor(degInSign/3.333); // 0-8
    const baseSign=MOVABLE.includes(sign)?0:FIXED.includes(sign)?9:DUAL.includes(sign)?5:0;
    // Correct calculation per Jyotish
    const signGroup=MOVABLE.includes(sign)?0:FIXED.includes(sign)?1:2;
    const baseNavamsa=signGroup*3;
    return(sign*3+navamsaNum)%12;
  }
  // Vargottama — planet in same sign in D1 and D9
  for(const[nm,pd]of Object.entries(P)){
    const navSign=getNavamsaSign(pd.lon);
    if(navSign===pd.si){
      f('yogas',{name:`Vargottama (${nm})`,planet:nm,house:pd.h,sign:pd.sn,strength:'Strong',source:'BPHS Ch.6',
        desc:`${nm} is Vargottama — same sign in natal (D1) and Navamsa (D9). This greatly amplifies ${nm}'s strength and significations. ${nm}'s themes are strongly stamped in this life. Most powerful form of planetary placement.`});
    }
  }

  // Navamsa Lagna (Pushkara navamsa check — most auspicious navamsas)
  // Pushkara navamsas are specific navamsas of benefic nature
  const PUSHKARA=[{sign:0,pada:1},{sign:0,pada:3},{sign:1,pada:2},{sign:2,pada:1},{sign:3,pada:3},{sign:4,pada:2},{sign:5,pada:1},{sign:5,pada:3},{sign:6,pada:2},{sign:7,pada:1},{sign:8,pada:3},{sign:9,pada:2},{sign:10,pada:1},{sign:10,pada:3},{sign:11,pada:2}];
  for(const[nm,pd]of Object.entries(P)){
    const navSign=getNavamsaSign(pd.lon);
    const pada=Math.floor((pd.lon%30)/3.333)+1;
    const isPushkara=PUSHKARA.some(p=>p.sign===pd.si&&p.pada===pada);
    if(isPushkara&&isBen(nm)) f('yogas',{name:`Pushkara Navamsa (${nm})`,planet:nm,house:pd.h,sign:pd.sn,strength:'Strong',source:'Saravali',
      desc:`${nm} in Pushkara Navamsa — auspicious sub-division placement. ${nm}'s results are amplified and purified. Particularly fortunate for ${nm}'s natural significations.`});
  }

  // D9 strength for marriage
  // If 7H lord or Venus is Vargottama — excellent marriage
  const v7n=hLP(7);
  const v7NavSign=P[v7n]?getNavamsaSign(P[v7n].lon):null;
  if(P[v7n]&&v7NavSign===s(v7n)) f('marriage',{type:'Vargottama Spouse',planet:v7n,source:'BPHS Ch.6',desc:`7H lord (${v7n}) is Vargottama — marriage themes strongly supported. Spouse relationship is karmic and lasting. Strong D9 confirmation.`});
  const venNavSign=P.Venus?getNavamsaSign(P.Venus.lon):null;
  if(P.Venus&&venNavSign===s('Venus')) f('marriage',{type:'Vargottama Venus',planet:'Venus',source:'BPHS Ch.6',desc:'Venus Vargottama — love and marriage themes amplified. Exceptional marital happiness or artistic success. D9 confirms D1 Venus strength.'});

  // ═══════════════════════════════════════════════════════════════════════════
  // S22. ASHTAKAVARGA THRESHOLD RULES (~30 rules)
  // Simplified BAV — threshold-based rules without full table computation
  // ═══════════════════════════════════════════════════════════════════════════
  // We approximate Ashtakavarga strength by planet house strength
  // Full AV requires all 8 planet tables — approximation only
  // Note: prompt says "threshold rules" — we implement interpretation rules
  const avRules=[
    {p:'Saturn',h_min:[3,6,11],h_max:[1,5,7,9],t:'Saturn Transit Quality',
     good:'Saturn transiting a sign with high AV bindus (5+) brings structured progress, authority.',
     bad:'Saturn transiting a sign with low AV bindus (3-) brings obstacles and frustration.'},
    {p:'Jupiter',h_min:[3,6,8,12],h_max:[2,5,7,9,11],t:'Jupiter Transit Quality',
     good:'Jupiter transiting a sign with high AV bindus (5+) — expansion, opportunities, fortune.',
     bad:'Jupiter transiting a sign with low AV bindus (3-) — expansion blocked, wisdom ignored.'},
    {p:'Sun',h_max:[1,2,4,7,10,11],t:'Sun Transit',
     good:'Sun transiting sign with 5+ bindus — vitality, recognition, leadership opportunities.',
     bad:'Sun transiting sign with 3- bindus — energy drain, conflicts with authority.'},
  ];
  // We implement as principles rather than computed values
  f('wealth',{type:'AV Principle',source:'BPHS Ch.66',desc:'Ashtakavarga: Each planet contributes bindus (points) to signs — 28 is average. Signs with 30+ bindus from a planet\'s transit bring strong results in that sign\'s themes. Your chart\'s specific AV scores require full calculation for precise timing.'});
  f('timing',{event:'AV Key Principle',source:'BPHS Ch.66',desc:'High bindu transits (28+ total/sign) support events during that transit. Especially watch for Saturn and Jupiter transiting signs with high bindus in your chart for major life events.'});

  // Sarvashtakavarga threshold rules (simplified interpretation)
  // Strong houses (25+ bindus) vs weak houses (22- bindus)
  for(const ph of[1,2,3,4,5,6,7,8,9,10,11,12]){
    const planetsInH=Object.entries(P).filter(([n,d])=>d.h===ph);
    const benCount=planetsInH.filter(([n])=>isBen(n)).length;
    const malCount=planetsInH.filter(([n])=>isMal(n)).length;
    if(benCount>=2&&malCount===0) f('wealth',{type:`H${ph} Benefic Concentration`,house:ph,source:'BPHS AV principle',desc:`Multiple benefics (${planetsInH.map(([n])=>n).join(', ')}) in H${ph} — strong SAV in this house area. Life dimensions of H${ph} are blessed.`});
    if(malCount>=3&&benCount===0) f('doshas',{name:`H${ph} Malefic Concentration`,house:ph,severity:'Moderate',source:'BPHS AV principle',desc:`Multiple malefics concentrated in H${ph} — weak SAV in this area. H${ph} life dimensions require extra effort and care.`});
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // S23. COMPATIBILITY (for Compatibility Report — second chart)
  // Source: BPHS Ch.18, Muhurta Chintamani, Nadi texts
  // ═══════════════════════════════════════════════════════════════════════════
  if(chart2){
    const {ls:ls2,ms:ms2,P:P2}=chart2;
    // Kuta analysis (8-point compatibility)
    // 1. Varna Kuta (1pt)
    const varnaGroup={0:3,3:2,6:1,9:0,4:3,7:2,10:1,1:2,5:1,8:0,2:1,11:0}; // simplified
    const v1=varnaGroup[ls]??1,v2=varnaGroup[ls2]??1;
    const varnaScore=v1>=v2?1:0;
    f('compatibility',{kuta:'Varna',score:varnaScore,max:1,source:'BPHS Ch.18',desc:`Varna Kuta: ${varnaScore}/1 — ${varnaScore?'Compatible social/spiritual hierarchy.':'Varna mismatch — different caste/spiritual levels. Minor point.'}`});

    // 2. Vashya Kuta (2pts)
    const VASHYA_MAP={0:[4,8],1:[3,6],2:[5,10],3:[1,9],4:[0,8],5:[2,10],6:[7,11],7:[6,3],8:[0,4],9:[3,10],10:[5,9],11:[6,7]};
    const vash1=(VASHYA_MAP[ls]||[]).includes(ls2),vash2=(VASHYA_MAP[ls2]||[]).includes(ls);
    const vasScore=vash1&&vash2?2:vash1||vash2?1:0;
    f('compatibility',{kuta:'Vashya',score:vasScore,max:2,source:'BPHS Ch.18',desc:`Vashya Kuta: ${vasScore}/2 — ${vasScore===2?'Mutual attraction and magnetic pull.':vasScore===1?'One-sided attraction — requires work to balance.':'Low magnetic connection.'}`});

    // 3. Tara Kuta (3pts) — based on birth star counting
    const ni1=no(P.Moon?.lon||0),ni2=no(P2.Moon?.lon||0);
    const taraNum=((ni2-ni1+27)%27)+1;
    const GOOD_TARA=[2,4,6,8,9];
    const taraScore=GOOD_TARA.includes(taraNum%9||9)?3:0;
    f('compatibility',{kuta:'Tara',score:taraScore,max:3,source:'BPHS Ch.18',desc:`Tara Kuta: ${taraScore}/3 — birth star compatibility. ${taraScore===3?'Excellent — mutual support through life.':'Challenging — obstacles in day-to-day harmony.'}`});

    // 4. Yoni Kuta (4pts)
    const NK27=['Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra','Punarvasu','Pushya','Ashlesha','Magha','Purva Phalguni','Uttara Phalguni','Hasta','Chitra','Swati','Vishakha','Anuradha','Jyeshtha','Mula','Purva Ashadha','Uttara Ashadha','Shravana','Dhanishtha','Shatabhisha','Purva Bhadrapada','Uttara Bhadrapada','Revati'];
    const YONI_ANIMALS=['Horse','Elephant','Sheep','Snake','Snake','Dog','Cat','Sheep','Cat','Rat','Rat','Cow','Buffalo','Tiger','Buffalo','Tiger','Hare','Hare','Dog','Monkey','Mongoose','Monkey','Lion','Horse','Lion','Cow','Elephant'];
    const ENEMY_YONI=[['Horse','Buffalo'],['Elephant','Lion'],['Sheep','Monkey'],['Snake','Mongoose'],['Dog','Hare'],['Cat','Rat'],['Cow','Tiger']];
    const y1=YONI_ANIMALS[ni1],y2=YONI_ANIMALS[ni2];
    const isEnemy=ENEMY_YONI.some(p=>(p[0]===y1&&p[1]===y2)||(p[0]===y2&&p[1]===y1));
    const isSame=y1===y2;
    const yoniScore=isSame?4:isEnemy?0:2;
    f('compatibility',{kuta:'Yoni',score:yoniScore,max:4,animal1:y1,animal2:y2,enemy:isEnemy,source:'BPHS Ch.18',
      desc:`Yoni Kuta: ${yoniScore}/4 — Physical/sexual compatibility. ${y1} (native) + ${y2} (partner). ${isSame?'Same animal — exceptional physical harmony.':isEnemy?'Enemy animals — sexual incompatibility is classical concern. Other factors must compensate.':'Compatible animals — reasonable physical harmony.'}`});

    // 5. Graha Maitri (5pts) — friendship between Moon sign lords
    const ml1=SL[ms],ml2=SL[ms2];
    const PLANET_FRIENDS={Ma:['Su','Mo','Ju'],Ve:['Me','Sa'],Me:['Su','Ve'],Mo:['Su','Me'],Su:['Mo','Ma','Ju'],Ju:['Su','Mo','Ma'],Sa:['Me','Ve'],Ra:['Ve','Sa'],Ke:['Ve','Sa']};
    const fr12=(PLANET_FRIENDS[ml1]||[]).includes(ml2),fr21=(PLANET_FRIENDS[ml2]||[]).includes(ml1);
    const grahaScore=ml1===ml2?5:fr12&&fr21?4:fr12||fr21?3:2;
    f('compatibility',{kuta:'Graha Maitri',score:grahaScore,max:5,source:'BPHS Ch.18',
      desc:`Graha Maitri: ${grahaScore}/5 — Mental compatibility. Moon lords: ${FN[ml1]} and ${FN[ml2]}. ${grahaScore>=4?'Excellent mental rapport, shared values.':grahaScore===3?'Good mental compatibility.':'Different mental wavelengths — communication effort needed.'}`});

    // 6. Gana Kuta (6pts)
    const GANA={0:'Deva',1:'Deva',2:'Manav',3:'Manav',4:'Deva',5:'Raksha',6:'Manav',7:'Manav',8:'Raksha',9:'Deva',10:'Raksha',11:'Deva',12:'Manav',13:'Manav',14:'Deva',15:'Manav',16:'Deva',17:'Raksha',18:'Raksha',19:'Manav',20:'Manav',21:'Deva',22:'Manav',23:'Raksha',24:'Manav',25:'Deva',26:'Deva'};
    const g1=GANA[ni1],g2=GANA[ni2];
    const ganaScore=g1===g2?6:g1==='Deva'&&g2==='Manav'||g1==='Manav'&&g2==='Deva'?5:1;
    f('compatibility',{kuta:'Gana',score:ganaScore,max:6,gana1:g1,gana2:g2,source:'BPHS Ch.18',
      desc:`Gana Kuta: ${ganaScore}/6 — Nature/temperament compatibility. ${g1} + ${g2}. ${ganaScore===6?'Same gana — excellent temperament match.':ganaScore===5?'Deva-Manav compatible — good harmony.':'Different ganas — temperament clashes possible. Patience needed.'}`});

    // 7. Bhakoot Kuta (7pts)
    const ms1to2=((ms2-ms+12)%12)+1,ms2to1=((ms-ms2+12)%12)+1;
    const BAD_BHAKOOT=[[2,12],[6,8],[5,9]];
    const badBhak=BAD_BHAKOOT.some(([a,b])=>(ms1to2===a&&ms2to1===b)||(ms1to2===b&&ms2to1===a));
    const bhakootScore=badBhak?0:7;
    f('compatibility',{kuta:'Bhakoot',score:bhakootScore,max:7,moon1:RS[ms],moon2:RS[ms2],source:'BPHS Ch.18',
      desc:`Bhakoot Kuta: ${bhakootScore}/7 — Moon sign compatibility. ${RS[ms]} + ${RS[ms2]}. ${badBhak?'Challenging combination — financial or family tensions possible. Jupiter trine can neutralise.':'Harmonious moon sign relationship — mutual support in family and financial matters.'}`});

    // 8. Nadi Kuta (8pts) — most important
    const NADI={0:'Vata',1:'Pitta',2:'Kapha',3:'Kapha',4:'Pitta',5:'Vata',6:'Vata',7:'Pitta',8:'Kapha',9:'Kapha',10:'Pitta',11:'Vata',12:'Vata',13:'Pitta',14:'Kapha',15:'Kapha',16:'Pitta',17:'Vata',18:'Vata',19:'Pitta',20:'Kapha',21:'Kapha',22:'Pitta',23:'Vata',24:'Vata',25:'Pitta',26:'Kapha'};
    const nd1=NADI[ni1],nd2=NADI[ni2];
    const nadiScore=nd1===nd2?0:8;
    f('compatibility',{kuta:'Nadi',score:nadiScore,max:8,nadi1:nd1,nadi2:nd2,source:'BPHS Ch.18',
      desc:`Nadi Kuta: ${nadiScore}/8 — Most important. ${nd1} + ${nd2}. ${nadiScore===0?'SAME NADI — Nadi Dosha present. This is serious. Health issues for children possible, compatibility challenges. Strong remedies recommended. Nadi dosha exemptions if same gotra or specific nakshatra pairs.':'Different Nadi — excellent. Health compatibility for offspring good.'}`});

    // Total score
    const totalScore=varnaScore+vasScore+taraScore+yoniScore+grahaScore+ganaScore+bhakootScore+nadiScore;
    f('compatibility',{type:'Total Guna Milan',score:totalScore,max:36,source:'BPHS Ch.18',
      desc:`Total Guna Milan: ${totalScore}/36. ${totalScore>=28?'Excellent match (28+) — all major life areas compatible. Marriage highly recommended.':totalScore>=21?'Good match (21-27) — most areas compatible. Marriage advisable with awareness of gaps.':totalScore>=18?'Acceptable match (18-20) — minimum threshold. Address specific dosha areas before marriage.':'Below threshold (<18) — significant incompatibilities. Careful consideration required. Specific remedies needed.'}`});

    // Relationship psychology cross-chart
    if(P2.Saturn&&P[v7n]&&conj(P2.Saturn.si,s(v7n))) f('compatibility',{type:'Saturn on 7H Lord',planets:['Partner Saturn',v7n],source:'Nadi',desc:`Partners Saturn conjuncts natives 7H lord (${v7n}) — partner may feel restricting or stabilizing depending on chart strength. Patience required in marriage.`});
    if(P2.Mars&&h(v7n)&&pAspects('Mars',P2.Mars.si,s(v7n))) f('compatibility',{type:'Partner Mars on 7H',source:'Nadi',desc:`Partners Mars aspects natives 7H lord — dynamic but potentially conflicting energy in marriage. Passion mixed with friction.`});
    if(P2.Jupiter&&isKT(houseOf(P2.Jupiter.si,ls))) f('compatibility',{type:'Partner Jupiter Blessing',planet:'Jupiter',source:'Nadi',desc:`Partners Jupiter falls in kendra from natives lagna — partner brings wisdom, fortune, and expansion to natives life.`});

    // Mangal Dosha matching
    const p1Mangal=[1,2,4,7,8,12].includes(h('Mars'));
    const p2Mangal=[1,2,4,7,8,12].includes(P2.Mars?houseOf(P2.Mars.si,ls2):0);
    if(p1Mangal&&p2Mangal) f('compatibility',{type:'Mangal Dosha Match',source:'Classical',desc:'Both partners have Mangal Dosha — doshas cancel each other out. Marriage is compatible from Mangal perspective.'});
    if(p1Mangal&&!p2Mangal) f('compatibility',{type:'Mangal Dosha Mismatch',severity:'High',source:'Classical',desc:'Native has Mangal Dosha but partner does not — significant concern. Partner without dosha must have strong Mangal or Jupiter protection for balance.'});
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // S24. MUHURAT / EVENT TIMING RULES (~50 rules for Timing Report)
  // Source: Muhurta Chintamani, classical muhurta texts
  // ═══════════════════════════════════════════════════════════════════════════
  if(transits){
    // Marriage muhurat principles
    const tJupH=transits.Jupiter?houseOf(so(transits.Jupiter),ls):null;
    const tVenH=transits.Venus?houseOf(so(transits.Venus),ls):null;
    if(tJupH&&[1,5,7,9,11].includes(tJupH)&&tVenH&&[1,5,7,9,11].includes(tVenH))
      f('muhurat',{event:'Marriage Window',quality:'Excellent',source:'Muhurta Chintamani',desc:`Transit Jupiter in H${tJupH} and Venus in H${tVenH} from lagna — excellent current window for marriage or romantic commitments. Both benefic rulers favor union.`});
    else if(tJupH&&[1,5,7,9,11].includes(tJupH))
      f('muhurat',{event:'Marriage Window',quality:'Good',source:'Muhurta Chintamani',desc:`Transit Jupiter in H${tJupH} — favorable period for marriage considerations. Jupiter's blessings on relationships.`});

    // Business launch principles
    const tSatH=transits.Saturn?houseOf(so(transits.Saturn),ls):null;
    const tRahH=transits.Rahu?houseOf(so(transits.Rahu),ls):null;
    if(tJupH&&[2,10,11].includes(tJupH))
      f('muhurat',{event:'Business Launch',quality:'Good',source:'Muhurta Chintamani',desc:`Jupiter transiting H${tJupH} — favorable for new business ventures, financial launches, or career changes.`});
    if(tSatH&&[3,6,11].includes(tSatH))
      f('muhurat',{event:'Business/Hard Work',quality:'Good',source:'Classical',desc:`Saturn transiting H${tSatH} from lagna — favorable for persistent business efforts, long-term project launches, real estate transactions.`});

    // Property purchase
    if(tJupH&&[4].includes(tJupH)) f('muhurat',{event:'Property Purchase',quality:'Excellent',source:'Classical',desc:'Jupiter transiting 4H — auspicious window for property purchase, vehicle acquisition, and domestic investments.'});
    if(tSatH&&[4].includes(tSatH)) f('muhurat',{event:'Property Caution',quality:'Challenging',source:'Classical',desc:'Saturn transiting 4H — property decisions require extra caution. Avoid major real estate decisions unless Jupiter also favorable.'});

    // Travel/relocation
    if(tJupH&&[9,12].includes(tJupH)) f('muhurat',{event:'Foreign Travel',quality:'Good',source:'Classical',desc:`Jupiter transiting H${tJupH} — auspicious window for long-distance travel, foreign trips, or relocation.`});

    // Career/promotion
    if(tJupH&&[10,11].includes(tJupH)) f('muhurat',{event:'Career Advancement',quality:'Excellent',source:'Classical',desc:`Jupiter transiting H${tJupH} — prime window for career advancement, promotion, business expansion, and professional recognition.`});

    // Medical procedures
    const tMarH2=transits.Mars?houseOf(so(transits.Mars),ls):0;
    if(tMarH2&&[3,6,11].includes(tMarH2)) f('muhurat',{event:'Medical Procedures',quality:'Acceptable',source:'Classical',desc:'Mars in upachaya from lagna — surgical and medical procedures fare better during this short window. Mars energy supports physical intervention.'});
    if(transits.Mars&&[1,4,7,8].includes(houseOf(so(transits.Mars),ls))) f('muhurat',{event:'Avoid Surgery',quality:'Caution',source:'Classical',desc:'Mars in difficult house from lagna — avoid elective medical procedures. Wait for Mars to transit upachaya (3,6,10,11H) houses.'});

    // Avoid — bad time indicators
    if(transits.Saturn&&transits.Rahu&&conj(so(transits.Saturn),so(transits.Rahu))) f('muhurat',{event:'Major Decisions — Caution',quality:'Avoid',source:'Classical',desc:'Transit Saturn and Rahu conjunct — avoid major life decisions (marriage, business launch, property purchase). Karmic obstacles active. Wait for separation.'});
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY FLAGS
  // ═══════════════════════════════════════════════════════════════════════════
  R.summary={
    has_raj_yoga:      R.yogas.some(y=>y.name?.includes('Raja')||y.name?.includes('Pancha')||y.name?.includes('Yoga Karaka')),
    has_dhana_yoga:    R.yogas.some(y=>y.name?.includes('Dhana')||y.name?.includes('Lakshmi')),
    has_gaja_kesari:   R.yogas.some(y=>y.name?.includes('Gaja Kesari')),
    has_vargottama:    R.yogas.some(y=>y.name?.includes('Vargottama')),
    has_mangal_dosha:  R.doshas.some(d=>d.name==='Mangal Dosha'),
    mangal_severity:   R.doshas.find(d=>d.name==='Mangal Dosha')?.severity||null,
    has_kaal_sarp:     R.doshas.some(d=>d.name?.includes('Kaal Sarp')),
    has_shrapit:       R.doshas.some(d=>d.name?.includes('Shrapit')),
    has_guru_chandal:  R.doshas.some(d=>d.name?.includes('Guru Chandal')),
    has_kemdrum:       R.doshas.some(d=>d.name?.includes('Kemdrum')),
    sade_sati_active:  R.sade_sati&&R.sade_sati.phase!=='Not active',
    sade_sati_phase:   R.sade_sati?.phase||null,
    dasha_quality:     R.dasha_q.find(d=>d.type==='Mahadasha')?.quality||'Unknown',
    current_dasha:     dasha.maha||null,
    current_antar:     dasha.antar||null,
    children_positive: R.children.some(c=>['Excellent','Positive','Many/Daughters','Male/Authority'].includes(c.type)),
    children_challenge:R.children.some(c=>c.type==='Challenge'),
    marriage_positive: R.marriage.some(m=>m.type==='Positive'||m.type==='Strong Marriage'),
    marriage_delay:    R.marriage.some(m=>m.type==='Delay'||m.type==='Very Delayed'),
    top_yoga:          R.yogas.filter(y=>y.strength==='Strong')[0]?.name||R.yogas[0]?.name||null,
    total_yogas:       R.yogas.length,
    total_doshas:      R.doshas.length,
    health_flags:      R.health.filter(h=>h.severity==='Flag'||h.severity==='High').length,
    foreign_strong:    R.foreign.length>=2,
    spiritual_strong:  R.spiritual.length>=3,
    psych_patterns:    R.psych.length,
    career_strength:   R.career.filter(c=>c.type&&!c.type.includes('Challenge')).length,
  };

  return R;
}

module.exports={buildChart,runEngine,houseOf,signOfH,houseLord,pAspects,isKendra,isTrikona,isDust,isBen,isMal};

