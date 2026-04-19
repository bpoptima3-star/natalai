// api/year-engine.js — Today-to-Today+1Year Report Engine for NatalAI.live
// Replaces birthday-to-birthday solar return system
// Window is always: TODAY → TODAY + 365 days
// Merges two solar years if next birthday falls within the window
'use strict';

const E = require('./ephemeris');
const { JD, JDtoCal, TC, ayanamsa, sunLon, moonLon, planetLon, rahuLon,
  n360, so, no, RS, NK, NL, DY, DS, FN, SL, fmtYr, fmtDt,
  getDasha, getAntardashas, computeChart, calcLagna } = E;

// ─── SOLAR RETURN FINDER ──────────────────────────────────────────────────────
function findSolarReturn(natalSunLon, targetYear, birthMonth, birthDay, tz) {
  let j = JD(targetYear, birthMonth, birthDay, 12 - tz);
  for (let i = 0; i < 60; i++) {
    const sL = n360(sunLon(j) - ayanamsa(j));
    let diff = natalSunLon - sL;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    j += diff / 0.9856;
    if (Math.abs(diff) < 0.00001) break;
  }
  return j;
}

// ─── MUDDA DASHA (Tajik annual dasha) ─────────────────────────────────────────
// Compressed Vimshottari into 1 year, starting from solar return Moon nakshatra
function getMuddaDasha(varshMoonLon, srJD, windowStart, windowEnd) {
  const nak = no(varshMoonLon), lord = NL[nak], nakLen = 360 / 27;
  const frac = (n360(varshMoonLon) % nakLen) / nakLen;
  const lordDurDays = (DY[lord] / 120) * 365.25;
  let cursorJD = srJD - frac * lordDurDays;
  const yearEndJD = srJD + 365.25;
  const idx = DS.indexOf(lord);
  const periods = [];

  for (let i = 0; i < 18; i++) {
    const dk = DS[(idx + i) % 9];
    const durDays = (DY[dk] / 120) * 365.25;
    const pStart = cursorJD, pEnd = cursorJD + durDays;

    // Only include if overlaps with our window
    if (pEnd > windowStart && pStart < windowEnd) {
      const effStart = Math.max(pStart, windowStart);
      const effEnd = Math.min(pEnd, windowEnd);
      const sc = JDtoCal(effStart), ec = JDtoCal(effEnd);
      periods.push({
        planet: FN[dk],
        planet_code: dk,
        start_jd: effStart,
        end_jd: effEnd,
        start_date: fmtDt(sc),
        end_date: fmtDt(ec),
        duration_days: Math.round(effEnd - effStart),
        is_current: effStart <= 0 && effEnd >= 0, // will be updated
      });
    }
    cursorJD = pEnd;
    if (cursorJD >= yearEndJD) break;
  }

  // Mark current period
  const nowJD = JD(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate(), 12);
  for (const p of periods) {
    p.is_current = p.start_jd <= nowJD && p.end_jd > nowJD;
  }
  return periods;
}

// ─── PLANET CHAR FOR PERIODS ──────────────────────────────────────────────────
const PERIOD_THEMES = {
  Sun: {
    focus: 'Career, identity, and self-expression',
    positive: 'Leadership opportunities, recognition, authority, father-related matters, government connections',
    watch: 'Ego conflicts, overwork, eye and heart health, authority clashes',
    energy: 'High energy and ambition',
  },
  Moon: {
    focus: 'Home, emotions, family, and public life',
    positive: 'Emotional connections deepen, family harmony, public recognition, intuitive insights',
    watch: 'Mood swings, mother\'s health, weight fluctuations, overemotional decisions',
    energy: 'Fluctuating, emotionally charged',
  },
  Mars: {
    focus: 'Action, property, courage, and physical energy',
    positive: 'Real estate moves, competitive wins, launching projects, physical fitness peaks',
    watch: 'Accidents, arguments, impulsive decisions, disputes over property or money',
    energy: 'High-drive, fast-moving',
  },
  Mercury: {
    focus: 'Communication, business, and intellectual pursuits',
    positive: 'Business deals close, writing projects advance, networking pays off, learning accelerates',
    watch: 'Over-thinking, communication misunderstandings, contract issues, nervous energy',
    energy: 'Quick, mentally stimulating',
  },
  Jupiter: {
    focus: 'Growth, wisdom, relationships, and opportunities',
    positive: 'Major opportunities open, relationships deepen, financial expansion, spiritual insight',
    watch: 'Overconfidence, overexpansion, weight gain, misplaced trust',
    energy: 'Expansive, optimistic',
  },
  Venus: {
    focus: 'Love, beauty, money, and pleasure',
    positive: 'Romantic connections, financial gains, creative projects, social popularity, luxury',
    watch: 'Overindulgence, romantic complications, overspending on aesthetics',
    energy: 'Pleasurable, harmonious',
  },
  Saturn: {
    focus: 'Hard work, discipline, and long-term building',
    positive: 'Long-term projects solidify, career authority builds, real estate deals, disciplined progress',
    watch: 'Delays, feeling restricted, joint or bone health, isolation, heavy responsibilities',
    energy: 'Slow, steady, demanding',
  },
  Rahu: {
    focus: 'Ambition, change, and unconventional paths',
    positive: 'Foreign opportunities, unconventional success, technology wins, bold career moves',
    watch: 'Deception, illusion, overambition, relationship instability, unusual health',
    energy: 'Intense, disruptive, ambitious',
  },
  Ketu: {
    focus: 'Spirituality, release, and past patterns',
    positive: 'Spiritual growth, letting go of what doesn\'t serve, intuitive insights, healing',
    watch: 'Losses, detachment from responsibilities, mysterious health issues, lack of motivation',
    energy: 'Inward, releasing, spiritual',
  },
};

// ─── MONTHLY TRANSIT CALENDAR ─────────────────────────────────────────────────
function getMonthlyTransits(natalChart, startDate, months = 12) {
  const { lagnaSign, moonSign, planets } = natalChart;
  const result = [];

  for (let m = 0; m < months; m++) {
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + m);
    const y = d.getFullYear(), mo = d.getMonth() + 1, dy = 15; // mid-month
    const jd = JD(y, mo, dy, 12);
    const ay = ayanamsa(jd);

    const tPlanets = {
      Sun:     n360(sunLon(jd) - ay),
      Moon:    n360(moonLon(jd) - ay),
      Mars:    n360(planetLon(jd, 'Mars') - ay),
      Mercury: n360(planetLon(jd, 'Mercury') - ay),
      Jupiter: n360(planetLon(jd, 'Jupiter') - ay),
      Venus:   n360(planetLon(jd, 'Venus') - ay),
      Saturn:  n360(planetLon(jd, 'Saturn') - ay),
      Rahu:    n360(rahuLon(jd) - ay),
    };

    const monthName = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][mo-1];
    const flags = [];

    // Jupiter transit check
    const jupH = ((so(tPlanets.Jupiter) - lagnaSign + 12) % 12) + 1;
    const jupHM = ((so(tPlanets.Jupiter) - moonSign + 12) % 12) + 1;
    if ([2,5,7,9,11].includes(jupHM) && [1,4,5,7,9,10,11].includes(jupH))
      flags.push({ planet: 'Jupiter', type: 'positive', note: 'Jupiter supporting growth and opportunity this month' });
    else if ([6,8,12].includes(jupHM))
      flags.push({ planet: 'Jupiter', type: 'caution', note: 'Jupiter in challenging position — avoid major commitments this month' });

    // Saturn transit check
    const satHM = ((so(tPlanets.Saturn) - moonSign + 12) % 12) + 1;
    if ([3,6,11].includes(satHM))
      flags.push({ planet: 'Saturn', type: 'positive', note: 'Saturn rewarding hard work — good for career and business' });
    if ([4,7,8].includes(satHM))
      flags.push({ planet: 'Saturn', type: 'caution', note: 'Saturn applying pressure — health and relationships need attention' });
    if (satHM === 1)
      flags.push({ planet: 'Saturn', type: 'caution', note: 'Saturn transiting your Moon sign — peak Saturn pressure month' });

    // Mars transit (fast, but matters)
    const marsHM = ((so(tPlanets.Mars) - moonSign + 12) % 12) + 1;
    if ([1,4,7,8].includes(marsHM))
      flags.push({ planet: 'Mars', type: 'caution', note: 'Mars in tense position — avoid confrontations, watch for accidents' });
    if ([3,6,11].includes(marsHM))
      flags.push({ planet: 'Mars', type: 'positive', note: 'Mars energizing action and competitive edge' });

    // Venus transit
    const venHL = ((so(tPlanets.Venus) - lagnaSign + 12) % 12) + 1;
    if ([1,5,7,11].includes(venHL))
      flags.push({ planet: 'Venus', type: 'positive', note: 'Venus enhancing love life and finances' });

    result.push({
      month: `${monthName} ${y}`,
      month_num: m + 1,
      year: y,
      mo: mo,
      transit_positions: {
        Jupiter: { sign: RS[so(tPlanets.Jupiter)], from_lagna: jupH, from_moon: jupHM },
        Saturn:  { sign: RS[so(tPlanets.Saturn)],  from_moon: satHM },
        Mars:    { sign: RS[so(tPlanets.Mars)],    from_moon: marsHM },
        Venus:   { sign: RS[so(tPlanets.Venus)],   from_lagna: venHL },
        Rahu:    { sign: RS[so(tPlanets.Rahu)] },
      },
      flags,
      overall: flags.filter(f => f.type === 'positive').length > flags.filter(f => f.type === 'caution').length ? 'favorable' : flags.filter(f => f.type === 'caution').length > 1 ? 'challenging' : 'mixed',
    });
  }
  return result;
}

// ─── QUARTER THEMES ───────────────────────────────────────────────────────────
function buildQuarterThemes(monthlyTransits, muddaPeriods) {
  const quarters = [
    { label: 'Months 1–3', months: monthlyTransits.slice(0, 3) },
    { label: 'Months 4–6', months: monthlyTransits.slice(3, 6) },
    { label: 'Months 7–9', months: monthlyTransits.slice(6, 9) },
    { label: 'Months 10–12', months: monthlyTransits.slice(9, 12) },
  ];

  return quarters.map(q => {
    const allFlags = q.months.flatMap(m => m.flags);
    const posCount = allFlags.filter(f => f.type === 'positive').length;
    const cauCount = allFlags.filter(f => f.type === 'caution').length;
    const quality = posCount > cauCount + 1 ? 'Strong' : cauCount > posCount + 1 ? 'Challenging' : 'Mixed';

    // Find which Mudda periods overlap this quarter
    const qMonths = q.months.map(m => m.month);
    const relevantPeriods = muddaPeriods.filter(p =>
      qMonths.some(qm => p.start_date.includes(qm.split(' ')[1]) || p.end_date.includes(qm.split(' ')[1]))
    );

    return {
      label: q.label,
      months: q.months.map(m => m.month),
      quality,
      active_periods: relevantPeriods.map(p => ({
        planet: p.planet,
        dates: `${p.start_date} – ${p.end_date}`,
        focus: PERIOD_THEMES[p.planet]?.focus || '',
      })),
      top_flags: allFlags.slice(0, 3),
    };
  });
}

// ─── MAIN YEAR ENGINE FUNCTION ────────────────────────────────────────────────
async function buildYearReport(birthY, birthMo, birthD, birthH, birthMi, tz, lat, lon, natalChart) {
  const today = new Date();
  const todayY = today.getFullYear(), todayMo = today.getMonth() + 1, todayD = today.getDate();
  const todayJD = JD(todayY, todayMo, todayD, 12);
  const windowEndJD = todayJD + 365;
  const windowEndCal = JDtoCal(windowEndJD);

  // Natal sun longitude
  const natalChart2 = computeChart(birthY, birthMo, birthD, birthH, birthMi, tz, lat, lon);
  const natalSunLon = natalChart2.sid.Sun;

  // Find last solar return (before today)
  let lastSRYear = todayY;
  let lastSRJD = findSolarReturn(natalSunLon, lastSRYear, birthMo, birthD, tz);
  if (lastSRJD > todayJD) {
    lastSRYear--;
    lastSRJD = findSolarReturn(natalSunLon, lastSRYear, birthMo, birthD, tz);
  }

  // Find next solar return (after today)
  const nextSRYear = lastSRYear + 1;
  const nextSRJD = findSolarReturn(natalSunLon, nextSRYear, birthMo, birthD, tz);
  const nextSRCal = JDtoCal(nextSRJD);

  // Does next birthday fall within our 12-month window?
  const birthdayInWindow = nextSRJD < windowEndJD;

  // Build solar year charts
  const srAy1 = E.ayanamsa(lastSRJD);
  const srPlanets1 = {
    Sun:     n360(sunLon(lastSRJD) - srAy1),
    Moon:    n360(moonLon(lastSRJD) - srAy1),
    Mercury: n360(planetLon(lastSRJD, 'Mercury') - srAy1),
    Venus:   n360(planetLon(lastSRJD, 'Venus') - srAy1),
    Mars:    n360(planetLon(lastSRJD, 'Mars') - srAy1),
    Jupiter: n360(planetLon(lastSRJD, 'Jupiter') - srAy1),
    Saturn:  n360(planetLon(lastSRJD, 'Saturn') - srAy1),
    Rahu:    n360(rahuLon(lastSRJD) - srAy1),
    Ketu:    n360(rahuLon(lastSRJD) + 180 - srAy1),
  };

  let srPlanets2 = null, srAy2 = null;
  if (birthdayInWindow) {
    srAy2 = E.ayanamsa(nextSRJD);
    srPlanets2 = {
      Sun:     n360(sunLon(nextSRJD) - srAy2),
      Moon:    n360(moonLon(nextSRJD) - srAy2),
      Mercury: n360(planetLon(nextSRJD, 'Mercury') - srAy2),
      Venus:   n360(planetLon(nextSRJD, 'Venus') - srAy2),
      Mars:    n360(planetLon(nextSRJD, 'Mars') - srAy2),
      Jupiter: n360(planetLon(nextSRJD, 'Jupiter') - srAy2),
      Saturn:  n360(planetLon(nextSRJD, 'Saturn') - srAy2),
      Rahu:    n360(rahuLon(nextSRJD) - srAy2),
      Ketu:    n360(rahuLon(nextSRJD) + 180 - srAy2),
    };
  }

  // Get Mudda (annual) dasha periods for window
  const muddaPeriods1 = getMuddaDasha(srPlanets1.Moon, lastSRJD, todayJD, nextSRJD);
  let muddaPeriods2 = [];
  if (birthdayInWindow && srPlanets2) {
    muddaPeriods2 = getMuddaDasha(srPlanets2.Moon, nextSRJD, nextSRJD, windowEndJD);
  }

  // Combine and sort all periods
  const allPeriods = [...muddaPeriods1, ...muddaPeriods2].sort((a, b) => a.start_jd - b.start_jd);

  // Get natal dasha context
  const natalDasha = getDasha(natalChart2.sid.Moon, birthY, birthMo, birthD);
  const currMaha = natalDasha.curr;
  const antars = currMaha ? getAntardashas(currMaha.lord, currMaha.start, currMaha.end) : [];
  const currAntar = antars.find(a => a.curr);

  // Monthly transits for the 12-month window
  const windowStart = new Date(todayY, todayMo - 1, todayD);
  const lagnaSign = natalChart?.lagnaSign ?? so(natalChart2.lagna);
  const moonSignN = so(natalChart2.sid.Moon);

  const monthlyTransits = getMonthlyTransits(
    { lagnaSign, moonSign: moonSignN, planets: {} },
    windowStart, 12
  );

  // Build quarter themes
  const quarters = buildQuarterThemes(monthlyTransits, allPeriods);

  // Current period details
  const currentPeriod = allPeriods.find(p => p.is_current) || allPeriods[0];
  const nowJD = JD(todayY, todayMo, todayD, 12);
  const daysLeft = currentPeriod ? Math.round(currentPeriod.end_jd - nowJD) : 0;

  // Annual focus planets (solar return chart analysis)
  const lagnaOfSR1 = n360(E.calcLagna(lastSRJD, lat, lon) - srAy1);
  const yearLagnaSign = so(lagnaOfSR1);
  const yearLagnaLord = FN[SL[yearLagnaSign]];

  // Muntha calculation
  const natalLagnaSign = so(natalChart2.lagna);
  const age = nextSRYear - birthY;
  const munthaSign = (natalLagnaSign + age - 1) % 12;
  const munthaHouse = ((munthaSign - yearLagnaSign + 12) % 12) + 1;

  return {
    // Window definition
    window: {
      start: `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][todayMo-1]} ${todayD}, ${todayY}`,
      end: fmtDt(windowEndCal),
      total_days: 365,
    },

    // Solar return info (for backend use only, not shown to user)
    solar_years: {
      current: {
        started: fmtDt(JDtoCal(lastSRJD)),
        ends: fmtDt(JDtoCal(nextSRJD)),
        year_lagna: RS[yearLagnaSign],
        year_lagna_lord: yearLagnaLord,
        muntha_sign: RS[munthaSign],
        muntha_house: munthaHouse,
      },
      next: birthdayInWindow ? {
        starts: fmtDt(JDtoCal(nextSRJD)),
        ends: fmtDt(JDtoCal(JD(nextSRYear + 1, birthMo, birthD, 12))),
      } : null,
      birthday_in_window: birthdayInWindow,
      next_birthday: fmtDt(nextSRCal),
    },

    // Natal dasha (life-level periods)
    natal_period: {
      major: currMaha ? {
        planet: FN[currMaha.lord],
        ends: fmtYr(currMaha.end),
        years_remaining: +(currMaha.end - (todayY + todayMo / 12)).toFixed(1),
      } : null,
      active_phase: currAntar ? {
        planet: FN[currAntar.lord],
        ends: fmtYr(currAntar.end),
        months_remaining: Math.round((currAntar.end - (todayY + todayMo / 12)) * 12),
      } : null,
    },

    // Annual periods (Mudda/Tajik) — the heart of the year report
    annual_periods: allPeriods.map(p => ({
      planet: p.planet,
      dates: `${p.start_date} – ${p.end_date}`,
      duration_days: p.duration_days,
      is_current: p.is_current,
      days_remaining: p.is_current ? daysLeft : null,
      focus: PERIOD_THEMES[p.planet]?.focus || '',
      positive: PERIOD_THEMES[p.planet]?.positive || '',
      watch: PERIOD_THEMES[p.planet]?.watch || '',
      energy: PERIOD_THEMES[p.planet]?.energy || '',
    })),

    // Current annual period
    current_annual_period: currentPeriod ? {
      planet: currentPeriod.planet,
      dates: `${currentPeriod.start_date} – ${currentPeriod.end_date}`,
      days_remaining: daysLeft,
      ...PERIOD_THEMES[currentPeriod.planet],
    } : null,

    // Quarter breakdown
    quarters,

    // Month-by-month
    monthly: monthlyTransits.map(m => ({
      month: m.month,
      overall: m.overall,
      highlights: m.flags.map(f => f.note),
    })),

    // Key themes for this year
    year_themes: buildYearThemes(allPeriods, quarters, {
      birthdayInWindow,
      nextBirthday: fmtDt(nextSRCal),
      munthaHouse,
      yearLagnaLord,
    }),
  };
}

function buildYearThemes(periods, quarters, meta) {
  const themes = [];
  const planetsThisYear = [...new Set(periods.map(p => p.planet))];

  // Dominant planet (most days)
  const dominant = periods.reduce((a, b) => a.duration_days > b.duration_days ? a : b, periods[0]);
  if (dominant) themes.push({
    type: 'Dominant Energy',
    planet: dominant.planet,
    desc: `${dominant.planet} is the defining energy for the largest portion of your year (${dominant.duration_days} days). ${PERIOD_THEMES[dominant.planet]?.focus || ''}.`,
  });

  // Jupiter/Venus months
  const jvPeriods = periods.filter(p => ['Jupiter','Venus'].includes(p.planet));
  if (jvPeriods.length) themes.push({
    type: 'Growth Windows',
    planets: jvPeriods.map(p => p.planet),
    dates: jvPeriods.map(p => p.dates).join(', '),
    desc: `Your best windows for major decisions, relationships, and financial moves: ${jvPeriods.map(p => `${p.planet} period (${p.dates})`).join(', ')}.`,
  });

  // Saturn/Rahu/Ketu caution periods
  const hardPeriods = periods.filter(p => ['Saturn','Rahu','Ketu'].includes(p.planet));
  if (hardPeriods.length) themes.push({
    type: 'Caution Windows',
    planets: hardPeriods.map(p => p.planet),
    dates: hardPeriods.map(p => p.dates).join(', '),
    desc: `Periods requiring extra care and patience: ${hardPeriods.map(p => `${p.planet} (${p.dates})`).join(', ')}.`,
  });

  // Birthday transition
  if (meta.birthdayInWindow) themes.push({
    type: 'Birthday Transition',
    date: meta.nextBirthday,
    desc: `Your birthday on ${meta.nextBirthday} marks a shift in annual energy. The themes before and after your birthday are distinct — this report accounts for both phases.`,
  });

  // Strong quarters
  const strongQ = quarters.filter(q => q.quality === 'Strong');
  if (strongQ.length) themes.push({
    type: 'Peak Quarters',
    quarters: strongQ.map(q => q.label),
    desc: `Your strongest quarters: ${strongQ.map(q => q.label).join(', ')}. Plan major moves during these windows.`,
  });

  return themes;
}

module.exports = { buildYearReport, PERIOD_THEMES, getMonthlyTransits };
