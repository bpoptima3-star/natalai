// NatalAI Blog Agent — with content series rotation
// Runs via GitHub Actions every 8 hours
// Rotates through: Birth Star series → Yoga series → Compatibility series → Random

const fs   = require('fs')
const path = require('path')

const API_KEY  = process.env.ANTHROPIC_API_KEY
const BLOG_DIR = path.join(__dirname, '..', 'blog')
const INDEX    = path.join(BLOG_DIR, 'articles.json')

// ── Content Series Definitions ────────────────────────────────────────────────

// 27 Birth Stars using Western constellation sector names
const BIRTH_STARS = [
  { name: 'Aries sector 1', meaning: 'the swift, pioneering spirit', report: 'year_reading' },
  { name: 'Aries sector 2', meaning: 'the determined builder', report: 'year_reading' },
  { name: 'Aries sector 3', meaning: 'the passionate seeker', report: 'year_reading' },
  { name: 'Taurus sector 1', meaning: 'the strong and steady force', report: 'year_reading' },
  { name: 'Taurus sector 2', meaning: 'the creative and sensual soul', report: 'year_reading' },
  { name: 'Taurus sector 3', meaning: 'the adaptable communicator', report: 'year_reading' },
  { name: 'Gemini sector 1', meaning: 'the nurturer and protector', report: 'year_reading' },
  { name: 'Gemini sector 2', meaning: 'the intuitive and powerful', report: 'year_reading' },
  { name: 'Gemini sector 3', meaning: 'the seeker of hidden truth', report: 'year_reading' },
  { name: 'Cancer sector 1', meaning: 'the magnetic and intense', report: 'year_reading' },
  { name: 'Cancer sector 2', meaning: 'the generous and noble', report: 'year_reading' },
  { name: 'Cancer sector 3', meaning: 'the detail-oriented perfectionist', report: 'year_reading' },
  { name: 'Leo sector 1', meaning: 'the balanced and graceful diplomat', report: 'compatibility' },
  { name: 'Leo sector 2', meaning: 'the deep and transformative soul', report: 'compatibility' },
  { name: 'Leo sector 3', meaning: 'the optimistic philosopher', report: 'year_reading' },
  { name: 'Virgo sector 1', meaning: 'the ambitious achiever', report: 'year_reading' },
  { name: 'Virgo sector 2', meaning: 'the humanitarian visionary', report: 'year_reading' },
  { name: 'Virgo sector 3', meaning: 'the spiritual and compassionate', report: 'year_reading' },
  { name: 'Libra sector 1', meaning: 'the courageous pioneer', report: 'timing' },
  { name: 'Libra sector 2', meaning: 'the patient and prosperous', report: 'timing' },
  { name: 'Libra sector 3', meaning: 'the fiery and creative', report: 'year_reading' },
  { name: 'Scorpio sector 1', meaning: 'the emotional and protective', report: 'year_reading' },
  { name: 'Scorpio sector 2', meaning: 'the powerful and magnetic', report: 'compatibility' },
  { name: 'Scorpio sector 3', meaning: 'the truth-seeking philosopher', report: 'year_reading' },
  { name: 'Sagittarius sector 1', meaning: 'the disciplined and wise', report: 'timing' },
  { name: 'Sagittarius sector 2', meaning: 'the humanitarian dreamer', report: 'year_reading' },
  { name: 'Sagittarius sector 3', meaning: 'the enlightened and spiritual', report: 'year_reading' },
]

// 20 Planetary Combinations in plain English
const YOGAS = [
  { name: 'The Jupiter-Moon power combination', desc: 'wisdom, fame and recognition', report: 'year_reading' },
  { name: 'The wealth and prosperity combination', desc: 'financial abundance indicators', report: 'year_reading' },
  { name: 'The leadership and power combination', desc: 'success, authority and influence', report: 'year_reading' },
  { name: 'The broken weakness combination', desc: 'how weakness turns into strength', report: 'year_reading' },
  { name: 'The Sun-Moon harmony combination', desc: 'balanced mind and strong willpower', report: 'year_reading' },
  { name: 'The spiritual liberation combination', desc: 'detachment and inner freedom', report: 'year_reading' },
  { name: 'The warrior and courage combination', desc: 'boldness, ambition and drive', report: 'year_reading' },
  { name: 'The serpent formation', desc: 'intense karmic focus and transformation', report: 'year_reading' },
  { name: 'The complete planetary alignment', desc: 'all planets on one side', report: 'year_reading' },
  { name: 'The Mercury intellect combination', desc: 'sharp mind and communication gifts', report: 'year_reading' },
  { name: 'The Venus beauty and love combination', desc: 'charm, relationships and luxury', report: 'compatibility' },
  { name: 'The Saturn discipline combination', desc: 'hard work rewarded and longevity', report: 'year_reading' },
  { name: 'The Mars energy combination', desc: 'physical strength and ambition', report: 'year_reading' },
  { name: 'The shadow planet combination', desc: 'Rahu and Ketu karmic axis', report: 'year_reading' },
  { name: 'The empty second house combination', desc: 'wealth through unconventional means', report: 'year_reading' },
  { name: 'The strong ascendant combination', desc: 'powerful personality and health', report: 'year_reading' },
  { name: 'The foreign travel and gains combination', desc: 'life abroad and international success', report: 'timing' },
  { name: 'The late bloomer combination', desc: 'success arrives after patience', report: 'year_reading' },
  { name: 'The creative genius combination', desc: 'artistic talent and recognition', report: 'year_reading' },
  { name: 'The selfless service combination', desc: 'healing others and spiritual merit', report: 'year_reading' },
]

// 30 Compatibility pairs
const COMPATIBILITY_PAIRS = [
  { pair: 'Aries and Taurus', report: 'compatibility' },
  { pair: 'Aries and Gemini', report: 'compatibility' },
  { pair: 'Aries and Cancer', report: 'compatibility' },
  { pair: 'Aries and Leo', report: 'compatibility' },
  { pair: 'Aries and Scorpio', report: 'compatibility' },
  { pair: 'Aries and Capricorn', report: 'compatibility' },
  { pair: 'Taurus and Virgo', report: 'compatibility' },
  { pair: 'Taurus and Scorpio', report: 'compatibility' },
  { pair: 'Taurus and Capricorn', report: 'compatibility' },
  { pair: 'Taurus and Cancer', report: 'compatibility' },
  { pair: 'Gemini and Libra', report: 'compatibility' },
  { pair: 'Gemini and Aquarius', report: 'compatibility' },
  { pair: 'Gemini and Sagittarius', report: 'compatibility' },
  { pair: 'Cancer and Scorpio', report: 'compatibility' },
  { pair: 'Cancer and Pisces', report: 'compatibility' },
  { pair: 'Cancer and Capricorn', report: 'compatibility' },
  { pair: 'Leo and Sagittarius', report: 'compatibility' },
  { pair: 'Leo and Aquarius', report: 'compatibility' },
  { pair: 'Leo and Aries', report: 'compatibility' },
  { pair: 'Virgo and Capricorn', report: 'compatibility' },
  { pair: 'Virgo and Pisces', report: 'compatibility' },
  { pair: 'Virgo and Taurus', report: 'compatibility' },
  { pair: 'Libra and Aquarius', report: 'compatibility' },
  { pair: 'Libra and Gemini', report: 'compatibility' },
  { pair: 'Scorpio and Pisces', report: 'compatibility' },
  { pair: 'Scorpio and Cancer', report: 'compatibility' },
  { pair: 'Sagittarius and Aries', report: 'compatibility' },
  { pair: 'Capricorn and Taurus', report: 'compatibility' },
  { pair: 'Aquarius and Gemini', report: 'compatibility' },
  { pair: 'Pisces and Cancer', report: 'compatibility' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

async function claude(system, prompt, maxTokens = 4000) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Claude API error: ${JSON.stringify(data)}`)
  return data.content[0].text
}

function loadArticles() {
  if (!fs.existsSync(INDEX)) return []
  return JSON.parse(fs.readFileSync(INDEX, 'utf8'))
}

function saveArticles(articles) {
  fs.writeFileSync(INDEX, JSON.stringify(articles, null, 2))
}

// ── Series Picker ─────────────────────────────────────────────────────────────

function pickNextTopic(articles) {
  const publishedKeywords = articles.map(a => a.keyword.toLowerCase())

  // Check birth stars — find first unpublished
  for (const star of BIRTH_STARS) {
    const keyword = `${star.name} Vedic birth star`
    if (!publishedKeywords.some(k => k.includes(star.name.toLowerCase()))) {
      return {
        keyword,
        intent: `What does being born under the ${star.name} mean in Vedic astrology`,
        reportCta: star.report,
        series: 'birth_star',
        title_hint: `${star.name} Vedic Birth Star — ${star.meaning}`,
      }
    }
  }

  // Check yogas — find first unpublished
  for (const yoga of YOGAS) {
    const keyword = `${yoga.name} Vedic astrology`
    if (!publishedKeywords.some(k => k.includes(yoga.name.toLowerCase().slice(0, 20)))) {
      return {
        keyword,
        intent: `What is ${yoga.name} and how does it affect life`,
        reportCta: yoga.report,
        series: 'yoga',
        title_hint: `${yoga.name} in Vedic Astrology — ${yoga.desc}`,
      }
    }
  }

  // Check compatibility pairs — find first unpublished
  for (const pair of COMPATIBILITY_PAIRS) {
    const keyword = `${pair.pair} Vedic compatibility`
    if (!publishedKeywords.some(k => k.includes(pair.pair.toLowerCase()))) {
      return {
        keyword,
        intent: `Are ${pair.pair} compatible in Vedic astrology`,
        reportCta: pair.report,
        series: 'compatibility',
        title_hint: `${pair.pair} Vedic Compatibility — the complete guide`,
      }
    }
  }

  // All series done — fall back to AI keyword research
  return null
}

// ── AI Keyword Fallback ───────────────────────────────────────────────────────

async function pickKeywordAI(publishedKeywords) {
  const avoid = publishedKeywords.length
    ? `Already written (skip): ${publishedKeywords.slice(-40).join(', ')}`
    : ''

  const raw = await claude(
    'You are an SEO strategist for NatalAI.live — a free Vedic astrology tool targeting USA, UK, Canada, Australia.',
    `Products: Birth Chart + Year Reading ($19), Soul Compatibility ($24), Life Timing Guide ($29).
${avoid}

Pick ONE high-intent keyword not yet covered. Focus on:
- Planetary period questions ("Saturn planetary period career effects")
- Transit impacts ("Jupiter transit 2026 effects by moon sign")
- Life timing ("best time to get married Vedic astrology")
- Moon sign meanings ("Moon in Scorpio Vedic astrology meaning")

Return ONLY valid JSON:
{"keyword":"exact phrase","intent":"what searcher wants","reportCta":"year_reading|compatibility|timing","title_hint":"suggested title"}`,
    400
  )
  return JSON.parse(raw.replace(/```json|```/g, '').trim())
}

// ── Article Writer ────────────────────────────────────────────────────────────

async function writeArticle(topic) {
  const REPORTS = {
    year_reading:  { label: 'Birth Chart + Year Reading', price: '$19' },
    compatibility: { label: 'Soul Compatibility Reading',  price: '$24' },
    timing:        { label: 'Life Timing Guide',           price: '$29' },
  }
  const report = REPORTS[topic.reportCta] || REPORTS.year_reading

  const seriesContext = {
    birth_star:    'This is part of our Vedic Birth Star series — one guide per constellation sector.',
    yoga:          'This is part of our Planetary Combinations series — plain English guides to Vedic chart combinations.',
    compatibility: 'This is part of our Vedic Compatibility series — honest guides for every sign pairing.',
  }[topic.series] || ''

  const raw = await claude(
    `You are a senior Vedic astrology writer for NatalAI.live.
Write articles for Western readers who are new to Vedic astrology — use plain English, no Sanskrit jargon.
Instead of Sanskrit terms use plain descriptions: "planetary period" not "dasha", "birth star" not "nakshatra", "rising sign" not "lagna", "planetary combination" not "yoga".
Be specific, expert, and genuinely useful. No fluff.
${seriesContext}`,
    `Write a full SEO article targeting: "${topic.keyword}"
Suggested title: "${topic.title_hint}"
Reader intent: ${topic.intent}

Structure:
- Intro: Hook the reader with a relatable scenario (100 words)
- ## What this means in Vedic astrology (200 words)
- ## Real-world effects on personality and life (200 words)
- ## How to find this in your birth chart (180 words)
- ## Key variations and what changes things (150 words)
- CTA: Explain that NatalAI.live calculates their exact chart free, and the ${report.label} (${report.price}) gives a full personalised reading. Link: https://natalai.live/#reports

Rules:
- NO Sanskrit words anywhere — use plain English equivalents
- Write for someone who just discovered Vedic astrology
- Total: 950-1100 words

Return ONLY valid JSON, no markdown wrapper:
{
  "title": "max 58 chars",
  "slug": "url-slug",
  "metaDesc": "max 152 chars",
  "excerpt": "2 sentences for blog cards",
  "content": "full article in markdown"
}`,
    3800
  )

  return JSON.parse(raw.replace(/```json|```/g, '').trim())
}

// ── HTML Builders ─────────────────────────────────────────────────────────────

function mdToHtml(md) {
  return md
    .replace(/^## (.+)$/gm, '</p><h2>$1</h2><p>')
    .replace(/^### (.+)$/gm, '</p><h3>$1</h3><p>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((https?:\/\/.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]+?<\/li>)/g, '<ul>$1</ul>')
    .replace(/\n\n+/g, '</p><p>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>')
    .replace(/<p><\/p>/g, '')
    .replace(/<p>(<h[23]>)/g, '$1')
    .replace(/(<\/h[23]>)<\/p>/g, '$1')
}

function buildArticleHtml(article, topic, date) {
  const REPORTS = {
    year_reading:  { label: 'Birth Chart + Year Reading', price: '$19', emoji: '🔮' },
    compatibility: { label: 'Soul Compatibility Reading',  price: '$24', emoji: '♡'  },
    timing:        { label: 'Life Timing Guide',           price: '$29', emoji: '⏳' },
  }
  const report  = REPORTS[topic.reportCta] || REPORTS.year_reading
  const htmlBody = mdToHtml(article.content)
  const dateStr  = new Date(date).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${article.title} | NatalAI</title>
  <meta name="description" content="${article.metaDesc}">
  <meta property="og:title" content="${article.title}">
  <meta property="og:description" content="${article.metaDesc}">
  <meta property="og:url" content="https://natalai.live/blog/${article.slug}.html">
  <meta property="og:type" content="article">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="canonical" href="https://natalai.live/blog/${article.slug}.html">
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"Article","headline":"${article.title}",
   "description":"${article.metaDesc}","datePublished":"${date}",
   "publisher":{"@type":"Organization","name":"NatalAI","url":"https://natalai.live"}}
  </script>
  <style>
    :root{--night:#080a12;--deep:#0d1020;--border:#1e2640;--gold-l:#e6b568;--text:#a8b8d0;--muted:#5e6e90;--purple:#7c3aed;--purple-l:#c4b5fd;--white:#f6f8fc;--cream:#eee8d8}
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:var(--night);color:var(--text);font-family:Georgia,serif;font-size:17px;line-height:1.8}
    a{color:var(--purple-l)}
    nav{background:var(--deep);border-bottom:1px solid var(--border);padding:16px 24px;display:flex;align-items:center;gap:16px}
    .logo{color:var(--gold-l);font-size:20px;text-decoration:none;font-weight:600}
    .back{color:var(--muted);font-size:13px;text-decoration:none;font-family:system-ui}
    main{max-width:720px;margin:0 auto;padding:48px 24px 80px}
    h1{font-size:clamp(26px,5vw,36px);color:var(--white);line-height:1.25;margin-bottom:12px;font-weight:700}
    .byline{color:var(--muted);font-size:13px;font-family:system-ui;margin-bottom:48px}
    h2{font-size:22px;color:var(--purple-l);font-weight:600;margin:40px 0 16px;line-height:1.3}
    h3{font-size:18px;color:var(--cream);margin:28px 0 12px}
    p{margin-bottom:20px}
    strong{color:var(--white)}
    ul{padding-left:24px;margin-bottom:20px}
    li{margin-bottom:8px}
    .cta{margin-top:60px;background:linear-gradient(135deg,#1a0d3d,#2d1b69);border:1px solid rgba(124,58,237,.35);border-radius:16px;padding:36px 32px;text-align:center}
    .cta-emoji{font-size:32px;margin-bottom:12px}
    .cta h3{font-size:22px;color:var(--white);margin:0 0 12px}
    .cta p{color:rgba(255,255,255,.6);margin-bottom:24px;font-size:16px}
    .cta-btn{display:inline-block;background:var(--purple);color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-family:system-ui;font-size:15px;font-weight:600}
    .cta-sub{color:rgba(255,255,255,.3);font-size:12px;margin-top:12px;font-family:system-ui}
    footer{text-align:center;padding:32px 24px;border-top:1px solid var(--border);margin-top:60px}
    footer a{color:var(--purple-l);font-size:14px;text-decoration:none;font-family:system-ui}
  </style>
</head>
<body>
  <nav>
    <a href="https://natalai.live" class="logo">✦ NatalAI</a>
    <span style="color:var(--border)">·</span>
    <a href="/blog" class="back">← All articles</a>
  </nav>
  <main>
    <h1>${article.title}</h1>
    <p class="byline">NatalAI · ${dateStr}</p>
    ${htmlBody}
    <div class="cta">
      <div class="cta-emoji">${report.emoji}</div>
      <h3>Get Your Personalised Vedic Reading</h3>
      <p>Your free chart is just the beginning. The <strong style="color:#fff">${report.label}</strong> gives you a full personalised Vedic report — calculated from your exact birth data.</p>
      <a href="https://natalai.live/#reports" class="cta-btn">Get ${report.label} — ${report.price}</a>
      <p class="cta-sub">Instant delivery · Pay once · No subscription</p>
    </div>
  </main>
  <footer>
    <a href="https://natalai.live">✦ Generate your free Vedic birth chart at natalai.live</a>
  </footer>
</body>
</html>`
}

function buildIndexHtml(articles) {
  const cards = articles.slice().reverse().map(a => {
    const tag = a.reportCta === 'compatibility' ? '♡ Compatibility'
              : a.reportCta === 'timing'        ? '⏳ Timing'
              : '✦ Year Reading'
    return `
    <a href="/blog/${a.slug}.html" class="card">
      <span class="tag">${tag}</span>
      <h2>${a.title}</h2>
      <p>${a.excerpt}</p>
      <span class="more">Read more →</span>
    </a>`
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vedic Astrology Guide | NatalAI</title>
  <meta name="description" content="Learn Vedic astrology in plain English — birth stars, planetary combinations, compatibility and more. Free guides from NatalAI.">
  <link rel="canonical" href="https://natalai.live/blog">
  <style>
    :root{--night:#080a12;--deep:#0d1020;--border:#1e2640;--gold-l:#e6b568;--text:#a8b8d0;--muted:#5e6e90;--purple:#7c3aed;--purple-l:#c4b5fd;--white:#f6f8fc}
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:var(--night);color:var(--text);font-family:system-ui,sans-serif;font-size:15px}
    nav{background:var(--deep);border-bottom:1px solid var(--border);padding:16px 24px;display:flex;align-items:center;justify-content:space-between}
    .logo{color:var(--gold-l);font-size:20px;text-decoration:none;font-weight:600}
    .nav-cta{color:var(--muted);font-size:13px;text-decoration:none}
    .hero{text-align:center;padding:72px 24px 48px;max-width:640px;margin:0 auto}
    .hero-label{color:var(--purple-l);font-size:11px;letter-spacing:.15em;text-transform:uppercase;margin-bottom:16px}
    h1{font-size:clamp(28px,5vw,42px);color:var(--white);font-family:Georgia,serif;line-height:1.2;margin-bottom:16px}
    .hero p{color:var(--muted);font-size:16px;line-height:1.6}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px;max-width:1080px;margin:0 auto;padding:0 24px 80px}
    .card{display:block;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:14px;padding:24px;text-decoration:none;transition:border-color .2s}
    .card:hover{border-color:rgba(124,58,237,.4)}
    .tag{display:inline-block;font-size:11px;color:var(--purple-l);background:rgba(124,58,237,.15);padding:3px 10px;border-radius:20px;margin-bottom:14px}
    .card h2{font-size:17px;color:var(--white);line-height:1.4;margin-bottom:10px;font-family:Georgia,serif}
    .card p{color:var(--muted);font-size:13px;line-height:1.6;margin-bottom:16px}
    .more{font-size:13px;color:var(--purple-l)}
    .empty{text-align:center;color:var(--muted);padding:80px 24px}
  </style>
</head>
<body>
  <nav>
    <a href="https://natalai.live" class="logo">✦ NatalAI</a>
    <a href="https://natalai.live/#reports" class="nav-cta">Get a Report →</a>
  </nav>
  <div class="hero">
    <p class="hero-label">Vedic Astrology Guide</p>
    <h1>Ancient Wisdom,<br>Plain English</h1>
    <p>Vedic astrology explained simply — birth stars, planetary combinations, compatibility and life timing.</p>
  </div>
  <div class="grid">
    ${articles.length === 0 ? '<p class="empty">Articles coming soon...</p>' : cards}
  </div>
</body>
</html>`
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔭 NatalAI Blog Agent starting...')

  if (!fs.existsSync(BLOG_DIR)) fs.mkdirSync(BLOG_DIR, { recursive: true })

  const articles = loadArticles()
  console.log(`📚 ${articles.length} articles published so far`)

  // Pick next topic — series first, AI fallback
  let topic = pickNextTopic(articles)

  if (topic) {
    console.log(`📖 Series: ${topic.series} → "${topic.keyword}"`)
  } else {
    console.log('📖 All series done — using AI keyword research')
    const keywords = articles.map(a => a.keyword)
    topic = await pickKeywordAI(keywords)
  }

  console.log(`✓ Keyword: "${topic.keyword}"`)

  // Write article
  console.log('✍️  Writing article...')
  const article = await writeArticle(topic)
  console.log(`✓ Title: "${article.title}"`)
  console.log(`✓ Slug: ${article.slug}`)

  // Save article HTML
  const date = new Date().toISOString()
  const html = buildArticleHtml(article, topic, date)
  fs.writeFileSync(path.join(BLOG_DIR, `${article.slug}.html`), html)
  console.log(`✓ Saved: blog/${article.slug}.html`)

  // Update manifest
  articles.push({
    slug:      article.slug,
    keyword:   topic.keyword,
    title:     article.title,
    excerpt:   article.excerpt,
    metaDesc:  article.metaDesc,
    reportCta: topic.reportCta,
    series:    topic.series || 'ai',
    date,
    views:     0,
  })
  saveArticles(articles)

  // Rebuild index
  fs.writeFileSync(path.join(BLOG_DIR, 'index.html'), buildIndexHtml(articles))
  console.log('✓ Rebuilt blog/index.html')

  console.log(`\n✅ Done! https://natalai.live/blog/${article.slug}.html`)
}

main().catch(err => {
  console.error('❌ Agent failed:', err)
  process.exit(1)
})
