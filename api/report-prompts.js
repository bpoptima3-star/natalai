// api/report-prompts.js — Report Prompt Templates for NatalAI.live
// All prompts in plain American English — NO Sanskrit, NO jargon
// Designed for US/UK/Canada/Australia market
// Legal-safe prediction language throughout
'use strict';

const LL = require('./language-layer');

// ─── LEGAL SAFE WRAPPERS ──────────────────────────────────────────────────────
// All predictions use these softeners — no absolute statements
const LEGAL = {
  high:   ['Strong indicators suggest','Your chart shows clear potential for','Classical patterns point to','The planetary picture strongly supports','This is a high-probability window for'],
  med:    ['Indicators suggest','Your chart shows potential for','Patterns in your chart point toward','There are signs of','Your chart supports'],
  low:    ['There may be','Some patterns suggest','It\'s possible that','Your chart shows mild indicators for','Worth watching:'],
  timing: ['A favorable window opens around','Classical timing supports','The planetary cycles point to','Watch for opportunities around','Energy builds toward'],
  caution:['Be mindful of','It would be wise to','Watch for','This period may bring','Some pressure possible around'],
};

function likely(text) { return `${LEGAL.high[Math.floor(Math.random()*LEGAL.high.length)]} ${text}`; }
function possible(text) { return `${LEGAL.med[Math.floor(Math.random()*LEGAL.med.length)]} ${text}`; }
function watch(text) { return `${LEGAL.caution[Math.floor(Math.random()*LEGAL.caution.length)]} ${text}`; }

// ─── BIRTH CHART + YEAR READING PROMPT ───────────────────────────────────────
function buildNatalYearPrompt(chartData, engineResult, yearData) {
  const R = LL.translateEngineResult(engineResult);
  const { name, dob, lagna, rashi, nakshatra, gender, age } = chartData;
  const { annual_periods, current_annual_period, quarters, monthly, year_themes, window, natal_period, solar_years } = yearData;

  const ageNote = age ? `(age ${age})` : '';
  const genderNote = gender || 'person';
  const nextBday = solar_years?.next_birthday || 'your upcoming birthday';
  const birthdayShift = solar_years?.birthday_in_window;

  return `${LL.US_SYSTEM_PROMPT}

You are writing a personal astrology report for ${name} ${ageNote}. This is a 45-50 page comprehensive reading. Write in warm, direct American English as if you are a brilliant, perceptive friend who has studied astrology deeply and knows ${name}'s chart inside out.

CRITICAL RULES:
1. NEVER use Sanskrit terms (see system prompt)
2. Every prediction must reference a SPECIFIC planet, period, or pattern
3. All time predictions must use ACTUAL DATES from the data provided
4. Use legal-safe language: "indicators suggest," "strong potential for," "classical patterns point to" — never "you will" or "this will happen"
5. Make it feel PERSONAL — use ${name}'s name frequently, reference their specific placements
6. This report covers TODAY (${window.start}) through ${window.end} — NOT birthday to birthday
7. Target length: 45-50 pages. Be thorough, specific, and personal

═══════════════════════════════════════════════════════════
CHART DATA FOR ${name.toUpperCase()}
═══════════════════════════════════════════════════════════
Date of Birth: ${dob}
Rising Sign: ${lagna} — this is ${name}'s outer personality, first impression, and physical body
Moon Sign: ${rashi} — this is ${name}'s emotional nature, inner world, and instincts  
Birth Star: ${nakshatra} — this is ${name}'s soul signature and karmic blueprint
Gender: ${genderNote}

CURRENT LIFE CHAPTER (Major Period):
${natal_period?.major ? `${natal_period.major.planet} Life Chapter — runs until ${natal_period.major.ends} (${natal_period.major.years_remaining} years remaining)` : 'Not available'}

CURRENT ACTIVE PHASE (within Life Chapter):
${natal_period?.active_phase ? `${natal_period.active_phase.planet} Phase — ends ${natal_period.active_phase.ends} (${natal_period.active_phase.months_remaining} months remaining)` : 'Not available'}

═══════════════════════════════════════════════════════════
THIS YEAR'S PLANETARY PERIODS (${window.start} → ${window.end})
These are the specific planetary energies ruling ${name}'s year, month by month:
═══════════════════════════════════════════════════════════
${annual_periods.map(p => `• ${p.planet} Period: ${p.dates} (${p.duration_days} days)${p.is_current ? ' ← ACTIVE NOW' : ''}
  Focus: ${p.focus}
  Opportunities: ${p.positive}
  Watch for: ${p.watch}`).join('\n')}

CURRENT PERIOD RIGHT NOW: ${current_annual_period?.planet || 'N/A'} — ${current_annual_period?.days_remaining || '?'} days remaining
${current_annual_period ? `Energy: ${current_annual_period.energy}\nFocus: ${current_annual_period.focus}` : ''}

${birthdayShift ? `IMPORTANT: ${name}'s birthday (${nextBday}) falls within this year window. The annual energy SHIFTS at that date. Acknowledge this transition in the report.` : ''}

═══════════════════════════════════════════════════════════
QUARTERLY OVERVIEW
═══════════════════════════════════════════════════════════
${quarters.map(q => `${q.label} (${q.months.join(', ')}): ${q.quality} period
  Active planetary periods: ${q.active_periods.map(p => `${p.planet} (${p.dates})`).join(', ') || 'Transitional'}
  ${q.top_flags.map(f => f.note).join(' | ')}`).join('\n')}

═══════════════════════════════════════════════════════════
MONTHLY ENERGY GUIDE
═══════════════════════════════════════════════════════════
${monthly.map(m => `${m.month}: ${m.overall.toUpperCase()} — ${m.highlights.join(' | ') || 'Generally stable month'}`).join('\n')}

═══════════════════════════════════════════════════════════
CONFIRMED CHART PATTERNS (from ${name}'s natal chart analysis)
USE THESE — DO NOT FABRICATE OTHERS
═══════════════════════════════════════════════════════════
${LL.formatFlagsForPrompt(R, chartData)}

═══════════════════════════════════════════════════════════
REPORT STRUCTURE — WRITE ALL 12 SECTIONS
═══════════════════════════════════════════════════════════

SECTION 1: YOUR COSMIC BLUEPRINT (3-4 pages)
Write an introduction to ${name}'s core nature using their Rising Sign (${lagna}), Moon Sign (${rashi}), and Birth Star (${nakshatra}). Explain what these three mean in plain English — Rising Sign = how the world sees you, Moon Sign = your emotional inner world, Birth Star = your soul's deeper pattern. Then describe ${name}'s overall chart personality. What makes their chart unique? What are the dominant themes of their life? Reference 2-3 confirmed patterns from above.
NOTE: Keep astrology basics ACCESSIBLE — explain what a rising sign and moon sign ARE, since many readers may be new to this.

SECTION 2: YOUR PERSONALITY & STRENGTHS (3-4 pages)
Based on the confirmed patterns above, describe ${name}'s core personality traits, natural gifts, and what they're naturally wired for. Include: communication style, emotional patterns, relationship approach, career instincts, how they handle stress, what environments they thrive in. Use the psychological patterns from the analysis if present. Be specific about ${name} — not generic "Virgo traits."

SECTION 3: YOUR CURRENT LIFE CHAPTER (2-3 pages)
This is ${name}'s ${natal_period?.major?.planet || 'current'} Life Chapter. Explain what this multi-year period means for ${name} specifically — not in general terms. When does it end? What themes define it? What did the previous chapter feel like vs now? How does the current Active Phase (${natal_period?.active_phase?.planet || 'current phase'}) add texture to this chapter? Use exact dates.

SECTION 4: YOUR YEAR AHEAD — BIG PICTURE (2-3 pages)
Overview of ${window.start} → ${window.end}. What is the dominant energy this year? What are the 2-3 biggest themes? What should ${name} be focused on? What opportunities are opening? What challenges are building? Reference the quarterly breakdown. ${birthdayShift ? `Note that ${name}'s birthday on ${nextBday} marks a distinct shift in energy — describe both phases.` : ''}

SECTION 5: MONTH-BY-MONTH BREAKDOWN (6-8 pages)
Go month by month from ${monthly[0]?.month} through ${monthly[monthly.length-1]?.month}. For each month:
- Which planetary period is active and what it means
- Key transit influences that month
- Practical guidance for that month
- Best dates/windows within the month for important moves
Use the confirmed monthly data above. Be specific. Don't be vague.

SECTION 6: CAREER & MONEY THIS YEAR (4-5 pages)
Based on confirmed career patterns and this year's planetary periods, give ${name} specific guidance on:
- Career opportunities and windows (reference specific months/periods)
- Income potential and money patterns
- Business or professional decisions to make or avoid
- Best months for negotiations, launches, asking for raises
- Red flags to watch (overexpansion, risky investments, difficult colleagues)
- Long-term career direction based on natal chart patterns
Use actual dates and period names. Legal-safe language.

SECTION 7: LOVE, RELATIONSHIPS & CONNECTION (4-5 pages)
Based on confirmed relationship patterns, give ${name} a full picture of:
- Their relationship style and attachment patterns (from the psych analysis)
- What kind of partner complements them (from the chart patterns)
- Relationship timing this year (which periods favor new connections or deepening existing ones)
- Red flags in relationships to watch — based on confirmed patterns, not generic warnings
- If in a relationship: how this year's energy affects the partnership
- If single: when/how new connections may emerge
- Communication patterns that help or hurt their relationships
IMPORTANT: Legal-safe — all relationship timing uses "strong indicators suggest" language

SECTION 8: HEALTH & WELLBEING (3-4 pages)
Based on confirmed health patterns in ${name}'s chart:
- Body areas to pay attention to (from health analysis above)
- Which periods this year may bring health focus
- Mental health and emotional wellbeing patterns
- Stress management based on their personality patterns
- Best practices for ${name}'s specific constitution
IMPORTANT: This is NOT medical advice. Use: "Your chart shows patterns associated with..." Language. Always recommend professional consultation.

SECTION 9: FAMILY, HOME & ROOTS (2-3 pages)
- Parent relationship patterns (from parents analysis)
- Home and property themes this year
- Family dynamics — where harmony or tension may arise
- Children patterns if applicable (from children analysis — legal-safe language only)
- Domestic changes or moves possible this year

SECTION 10: YOUR GROWTH EDGES (2-3 pages)
Honest but compassionate section on:
- The confirmed challenge patterns in ${name}'s chart
- What life is asking them to develop or heal
- Relationship patterns that may be holding them back (from psych analysis)
- This year's specific growth challenges (from difficult periods)
- What working through these challenges could unlock

SECTION 11: SPIRITUAL PATH & DEEPER PURPOSE (2-3 pages)
- ${name}'s spiritual inclinations from the chart
- Life purpose indicators
- Karmic themes (translated to plain English — not "your karma" but "patterns that seem to repeat")
- What brings ${name} deep meaning vs surface pleasure
- Practices or approaches that support their growth

SECTION 12: YOUR POWER WINDOWS & KEY DATES (2-3 pages)
A clear, practical summary:
- Best 3-month window this year for career moves
- Best window for relationship decisions
- Best window for financial moves
- Months to be more careful and conservative
- Single most powerful period in the next 12 months
- Specific dates within best periods (tie to monthly transit data)
End with an empowering closing paragraph that ties ${name}'s chart story together.

═══════════════════════════════════════════════════════════
WRITING GUIDELINES
═══════════════════════════════════════════════════════════
• Target: 45-50 pages (12,000-15,000 words)
• Use headers and subheaders for navigation
• Use bullet points for practical guidance, prose for insights
• Address ${name} directly throughout ("Your Saturn in...")
• Never say "as an [Rising Sign]" — too generic
• Every paragraph should have at least ONE specific reference to ${name}'s actual chart
• Tone: Warm, direct, intelligent — like a brilliant friend, not a fortune teller
• Legal-safe on all predictions: "indicators suggest," "strong potential for," "classical patterns point to"
• Especially legal-safe on: children, marriage, health, specific financial amounts
• For children: "Your chart shows patterns associated with" — never "you will have X children"
• For marriage: "Strong timing indicators" — never "you will get married in X"
• For health: "Worth monitoring" — never diagnose
• END every section with 1 practical takeaway sentence for ${name}`;
}

// ─── COMPATIBILITY REPORT PROMPT ──────────────────────────────────────────────
function buildCompatibilityPrompt(person1, person2, engineResult, compatibility) {
  const R = LL.translateEngineResult(engineResult);

  return `${LL.US_SYSTEM_PROMPT}

You are writing a Vedic compatibility reading for ${person1.name} and ${person2.name}. This is a 30-35 page deep dive into their compatibility across every dimension. Write in plain American English — warm, direct, honest.

CRITICAL: Legal-safe language throughout. "Strong indicators suggest" not "they will." "Patterns show" not "they are destined."

═══════════════════════════════════════════════════════════
PERSON 1: ${person1.name.toUpperCase()}
═══════════════════════════════════════════════════════════
Rising Sign: ${person1.lagna}
Moon Sign: ${person1.rashi}
Birth Star: ${person1.nakshatra}

═══════════════════════════════════════════════════════════
PERSON 2: ${person2.name.toUpperCase()}
═══════════════════════════════════════════════════════════
Rising Sign: ${person2.lagna}
Moon Sign: ${person2.rashi}
Birth Star: ${person2.nakshatra}

═══════════════════════════════════════════════════════════
COMPATIBILITY SCORES (8-dimension Vedic analysis)
═══════════════════════════════════════════════════════════
${compatibility.scores.map(s => `${s.kuta}: ${s.score}/${s.max} — ${s.desc}`).join('\n')}

TOTAL: ${compatibility.total}/36 — ${compatibility.total >= 28 ? 'Excellent' : compatibility.total >= 21 ? 'Good' : compatibility.total >= 18 ? 'Acceptable' : 'Needs attention'}

${compatibility.nadi_dosha ? `⚠️ SAME HEALTH COMPATIBILITY (Nadi): Both have the same health energy signature — ${compatibility.nadi_desc}. This is serious and needs to be addressed explicitly.` : '✓ Different health energy signatures — good for long-term health compatibility.'}

${compatibility.mangal_both ? '✓ Both have Mars Relationship Stress — these cancel each other out.' : compatibility.mangal_one ? '⚠️ One partner has Mars Relationship Stress without the other — address this.' : '✓ No Mars Relationship Stress issues.'}

═══════════════════════════════════════════════════════════
INDIVIDUAL PATTERNS
═══════════════════════════════════════════════════════════
${LL.formatCompatibilityForPrompt(R, person1, person2)}

═══════════════════════════════════════════════════════════
REPORT STRUCTURE
═══════════════════════════════════════════════════════════

SECTION 1: THE OVERVIEW (2-3 pages)
What kind of connection is this? What's the dominant energy between ${person1.name} and ${person2.name}? What score did they get and what does it mean in real terms — not astrology terms. Set the tone: is this a strong match, a complex one, a passionate-but-challenging one? Be honest but compassionate.

SECTION 2: HOW YOU SEE THE WORLD DIFFERENTLY — AND SIMILARLY (3 pages)
Compare their Rising Signs (outer personalities) and Moon Signs (inner emotional natures). Where do they naturally click? Where do they come from completely different emotional worlds? How does ${person1.name}'s ${person1.lagna} personality interact with ${person2.name}'s ${person2.lagna} energy day-to-day?

SECTION 3: THE PHYSICAL & EMOTIONAL CHEMISTRY (3-4 pages)
Based on Physical Compatibility score (${compatibility.physical_score}/4) and their Birth Stars:
- What is the raw physical/energetic chemistry between them?
- How do they express physical affection differently?
- Where is the spark? Where might it feel off?
- The specific animal archetype pairing (describe in plain English — what it means for their energy dynamic)
Legal-safe: use "strong indicators of" and "patterns suggest"

SECTION 4: THE MENTAL CONNECTION (3 pages)
Based on Mental Compatibility (${compatibility.mental_score}/5):
- How well do their minds connect?
- Can they talk for hours? Or do they exhaust each other intellectually?
- How do they make decisions together?
- What topics bring them together vs create friction?

SECTION 5: LONG-TERM COMPATIBILITY (3-4 pages)
Based on Temperament (${compatibility.temperament_score}/6) and Moon Sign Compatibility (${compatibility.moon_score}/7):
- Are their core natures compatible for the long haul?
- How do they handle stress differently?
- What does their home life look like in 10 years?
- Children compatibility (legal-safe language only)
- Financial compatibility patterns

SECTION 6: RED FLAGS & GREEN FLAGS (3 pages)
Be honest here. Based on the actual scores and patterns:
GREEN FLAGS (specific things that work in this pairing):
- List 4-6 specific strengths backed by scores/patterns
RED FLAGS (specific areas needing conscious work):
- List 3-5 specific challenges backed by scores/patterns
Do not soften real challenges — a person paying for this needs honesty

SECTION 7: RELATIONSHIP PSYCHOLOGY (3-4 pages)
Based on their individual psychological patterns (from psych analysis):
- What attachment styles are at play?
- What are the potential toxic patterns to watch (from their individual charts)?
- What triggers each person and how do those triggers interact?
- Communication patterns — how do they express love? What makes them feel unloved?
- What does each person need most in a relationship?

SECTION 8: TIMING — BEST WINDOWS FOR COMMITMENT (2-3 pages)
- When are the best planetary windows for making formal commitments?
- Which of their current life chapters (major periods) supports partnership?
- Are they both in compatible phases right now?
- Best years for marriage or deepening commitment (legal-safe language)

SECTION 9: MAKING IT WORK — SPECIFIC GUIDANCE (3 pages)
Based on ALL the above, give practical, specific advice:
- 5 things that will STRENGTHEN this relationship
- 5 things that could DAMAGE this relationship if unaddressed
- Communication scripts: how should ${person1.name} approach ${person2.name}? And vice versa?
- Non-negotiables for this pairing to thrive

SECTION 10: THE VERDICT (2 pages)
Honest, compassionate summary. Is this a "yes, go for it"? A "yes, but do the work"? A "proceed with eyes wide open"? What's the core message about this relationship? End with empowerment — not doom.`;
}

// ─── LIFE TIMING GUIDE PROMPT ─────────────────────────────────────────────────
function buildTimingPrompt(chartData, engineResult, yearData, eventType) {
  const R = LL.translateEngineResult(engineResult);
  const { name, lagna, rashi, nakshatra, dob } = chartData;
  const { annual_periods, monthly, quarters, window, natal_period } = yearData;

  const eventFocus = {
    Wedding:           'marriage and romantic commitment',
    'Moving Home':     'real estate, relocation, and home changes',
    'Business Launch': 'business ventures, career changes, and entrepreneurship',
    'Baby Naming':     'family expansion, children, and new beginnings',
    Travel:            'travel, exploration, and new experiences',
    General:           'all major life decisions',
  }[eventType] || 'major life decisions';

  return `${LL.US_SYSTEM_PROMPT}

You are writing a Life Timing Guide for ${name}, focused on ${eventFocus}. This report covers ${window.start} → ${window.end} plus the next 3 years where relevant.

Target: 25-30 pages. Plain American English. All dates must be specific.

CHART: Rising ${lagna} | Moon ${rashi} | Birth Star ${nakshatra}
CURRENT LIFE CHAPTER: ${natal_period?.major?.planet || 'Current'} (until ${natal_period?.major?.ends || 'TBD'})
CURRENT ACTIVE PHASE: ${natal_period?.active_phase?.planet || 'Current'} (until ${natal_period?.active_phase?.ends || 'TBD'})

ANNUAL PERIODS:
${annual_periods.map(p => `${p.planet}: ${p.dates}${p.is_current ? ' ← NOW' : ''} | ${p.focus}`).join('\n')}

QUARTERLY PICTURE:
${quarters.map(q => `${q.label}: ${q.quality} | ${q.active_periods.map(p=>`${p.planet}`).join(', ')}`).join('\n')}

MONTHLY OVERVIEW:
${monthly.map(m => `${m.month}: ${m.overall} — ${m.highlights.join(' | ')}`).join('\n')}

CHART PATTERNS:
${LL.formatFlagsForPrompt(R, chartData)}

═══════════════════════════════════════════════════════════
REPORT STRUCTURE
═══════════════════════════════════════════════════════════

SECTION 1: YOUR TIMING BLUEPRINT (3-4 pages)
What does ${name}'s chart say about their overall timing and decision-making patterns? Are they someone who gets clear windows early in a process? Someone who does better waiting? What do their rising sign and moon sign say about how they naturally move through major transitions? Set up the framework for reading their specific timing this year.

SECTION 2: YOUR POWER WINDOWS THIS YEAR (5-6 pages)
Based on planetary periods and transits, identify the TOP 3 WINDOWS for ${eventFocus}:
- WINDOW 1: [specific dates] — [why this window works, what planets support it, specific opportunities]
- WINDOW 2: [specific dates] — [why this window works]
- WINDOW 3: [specific dates] — [why this window works]
For each window: practical guidance on HOW to use it (what to do, what to initiate, what to finalize)

SECTION 3: MONTHS TO PROCEED CAREFULLY (3-4 pages)
Which months or periods are NOT ideal for ${eventFocus}? Why specifically (which planets, which patterns)? What can go wrong? What if ${name} has no choice but to move during these periods — how to mitigate?

SECTION 4: THE 3-YEAR PICTURE (4-5 pages)
Beyond this 12-month window, what do the next 3 years look like for ${eventFocus}? When do ${name}'s major life chapter and active phase support this type of action? Are there stronger windows coming? Or is NOW the strongest window?

SECTION 5: SPECIFIC GUIDANCE FOR ${eventType.toUpperCase()} (5-6 pages)
Deep dive into the specific event type:
${eventType === 'Wedding' ? `
- Marriage timing based on relationship patterns in chart
- Partner compatibility themes to watch for
- Best months/years for formal commitment (legal-safe)
- What ${name}'s chart says about their marriage style
- Red flags in relationship timing to avoid` : ''}
${eventType === 'Moving Home' ? `
- Property and real estate patterns in ${name}'s chart
- Best windows for signing leases or making offers
- What directions/environments suit them
- Potential challenges in moving timing
- What makes a home feel right for ${name}'s chart type` : ''}
${eventType === 'Business Launch' ? `
- Career and entrepreneurship patterns in ${name}'s chart
- Best windows to launch, sign contracts, or make bold moves
- Industries and business types that suit their chart
- Financial timing for investment decisions
- Potential partners vs going solo — chart indicators` : ''}
${eventType === 'Travel' ? `
- Travel patterns in ${name}'s chart
- Best windows for international or long-distance travel
- What types of destinations energize vs drain them
- Planning and booking timing guidance
- Health and safety considerations for travel periods` : ''}

SECTION 6: YOUR TOP 10 KEY DATES (2-3 pages)
Based on all the analysis, give ${name} a specific list of 10 key dates or windows over the next 12 months:
1. Best day/week for [specific action]
2. Best window for [specific action]
(Continue for 10 total)
Make these specific, actionable, and tied to actual planetary periods or transits. Legal-safe language.

SECTION 7: PRACTICAL PLANNING GUIDE (2-3 pages)
Tie everything together into a practical action plan for ${name}. What should they do RIGHT NOW? What should they plan for in 3 months? 6 months? What should they not stress about because the timing isn't right yet? End with a clear, empowering summary of their best path forward.`;
}

module.exports = {
  buildNatalYearPrompt,
  buildCompatibilityPrompt,
  buildTimingPrompt,
  LEGAL, likely, possible, watch,
};
