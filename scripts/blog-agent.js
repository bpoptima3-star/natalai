// NatalAI Blog Agent
// Runs via GitHub Actions every 8 hours
// Writes one SEO article, saves as HTML, updates blog index
// No npm installs needed — uses Node 20 built-in fetch

const fs   = require('fs')
const path = require('path')

const API_KEY  = process.env.ANTHROPIC_API_KEY
const BLOG_DIR = path.join(__dirname, '..', 'blog')
const INDEX    = path.join(BLOG_DIR, 'articles.json')

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

// ── Step 1: Pick keyword ──────────────────────────────────────────────────────

async function pickKeyword(publishedKeywords, articles) {
  const top = articles
    .sort((a, b) => (b.views || 0) - (a.views || 0))
    .slice(0, 5)
    .map(a => `"${a.keyword}"`)
    .join(', ')

  const avoid = publishedKeywords.length
    ? `Already covered (do not repeat): ${publishedKeywords.slice(-40).join(', ')}`
    : ''

  const raw = await claude(
    'You are an SEO strategist for NatalAI.live — a free Vedic astrology tool for English-speaking users in USA, UK, Canada, Australia.',
    `Products: Birth Chart + Year Reading ($19), Soul Compatibility Reading ($24), Life Timing Guide ($29).
${top ? `Top performing topics so far: ${top}` : 'No data yet — go for high-intent beginner keywords.'}
${avoid}

Pick ONE keyword to write about next. Best targets:
- "vedic [planet/sign] meaning" searches
- Moon sign traits ("moon in capricorn vedic astrology")
- Compatibility ("leo scorpio vedic compatibility")
- Dasha questions ("rahu mahadasha effects career")
- Transit impacts ("saturn transit 2026 vedic")
- Life timing ("best time to start business vedic astrology")

Return ONLY valid JSON, no markdown:
{"keyword":"3-6 word phrase","intent":"what the searcher wants","reportCta":"year_reading|compatibility|timing"}`,
    400
  )

  return JSON.parse(raw.replace(/```json|```/g, '').trim())
}

// ── Step 2: Write article ─────────────────────────────────────────────────────

async function writeArticle(keyword, intent, reportCta) {
  const reports = {
    year_reading:  { label: 'Birth Chart + Year Reading', price: '$19', emoji: '🔮' },
    compatibility: { label: 'Soul Compatibility Reading',  price: '$24', emoji: '♡'  },
    timing:        { label: 'Life Timing Guide',           price: '$29', emoji: '⏳' },
  }
  const report = reports[reportCta] || reports.year_reading

  const raw = await claude(
    `You are a senior Vedic astrology writer for NatalAI.live.
Write articles that rank on Google by being genuinely expert and specific.
Use real Jyotish terms: nakshatras, rashis, bhavas, grahas, dashas, yogas.
Target: Western spiritual seekers in English-speaking countries curious about Vedic astrology.
Be concrete and interesting. No generic filler.`,
    `Write a full SEO article for the keyword: "${keyword}"
Reader intent: ${intent}

Structure:
1. Intro — hook the reader, state what they'll learn (100 words)
2. ## [Core Vedic concept explained deeply] (200 words)
3. ## [Real-world effects on life] (200 words)
4. ## [How to read this in a birth chart] (180 words)
5. ## [Nuances and variations] (150 words)
6. CTA section — explain NatalAI.live calculates their exact chart; the ${report.label} (${report.price}) gives a full personalised reading. Link: https://natalai.live/#reports

Total: 950–1100 words.

Return ONLY valid JSON, no markdown wrapper:
{
  "title": "max 58 chars, keyword included naturally",
  "slug": "keyword-as-url-slug",
  "metaDesc": "max 152 chars",
  "excerpt": "2 sentences for the blog index card",
  "content": "full article in markdown"
}`,
    3800
  )

  return JSON.parse(raw.replace(/```json|```/g, '').trim())
}

// ── Step 3: Convert markdown → HTML (no library needed) ──────────────────────

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

// ── Step 4: Build the full article HTML page ──────────────────────────────────

function buildArticleHtml(article, keyword, reportCta, date) {
  const reports = {
    year_reading:  { label: 'Birth Chart + Year Reading', price: '$19', emoji: '🔮' },
    compatibility: { label: 'Soul Compatibility Reading',  price: '$24', emoji: '♡'  },
    timing:        { label: 'Life Timing Guide',           price: '$29', emoji: '⏳' },
  }
  const report  = reports[reportCta] || reports.year_reading
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
  <meta property="og:site_name" content="NatalAI">
  <meta property="og:type" content="article">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${article.title}">
  <meta name="twitter:description" content="${article.metaDesc}">
  <link rel="canonical" href="https://natalai.live/blog/${article.slug}.html">
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"Article","headline":"${article.title}",
   "description":"${article.metaDesc}","datePublished":"${date}",
   "publisher":{"@type":"Organization","name":"NatalAI","url":"https://natalai.live"}}
  </script>
  <style>
    :root {
      --night: #080a12; --deep: #0d1020; --surface: #141828;
      --border: #1e2640; --gold: #c8963a; --gold-l: #e6b568;
      --cream: #eee8d8; --text: #a8b8d0; --muted: #5e6e90;
      --purple: #7c3aed; --purple-l: #c4b5fd; --white: #f6f8fc;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: var(--night); color: var(--text);
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 17px; line-height: 1.8;
    }
    a { color: var(--purple-l); }
    nav {
      background: var(--deep); border-bottom: 1px solid var(--border);
      padding: 16px 24px; display: flex; align-items: center; gap: 16px;
    }
    .logo { color: var(--gold-l); font-size: 20px; text-decoration: none; font-weight: 600; }
    .back { color: var(--muted); font-size: 13px; text-decoration: none; font-family: system-ui; }
    .back:hover { color: var(--text); }
    main { max-width: 720px; margin: 0 auto; padding: 48px 24px 80px; }
    h1 {
      font-size: clamp(26px, 5vw, 36px); color: var(--white);
      line-height: 1.25; margin-bottom: 12px; font-weight: 700;
    }
    .byline { color: var(--muted); font-size: 13px; font-family: system-ui; margin-bottom: 48px; }
    h2 {
      font-size: 22px; color: var(--purple-l); font-weight: 600;
      margin: 40px 0 16px; line-height: 1.3;
    }
    h3 { font-size: 18px; color: var(--cream); margin: 28px 0 12px; }
    p { margin-bottom: 20px; }
    strong { color: var(--white); }
    ul { padding-left: 24px; margin-bottom: 20px; }
    li { margin-bottom: 8px; }
    .cta {
      margin-top: 60px;
      background: linear-gradient(135deg, #1a0d3d, #2d1b69);
      border: 1px solid rgba(124,58,237,.35);
      border-radius: 16px; padding: 36px 32px; text-align: center;
    }
    .cta-emoji { font-size: 32px; margin-bottom: 12px; }
    .cta h3 { font-size: 22px; color: var(--white); margin: 0 0 12px; }
    .cta p { color: rgba(255,255,255,.6); margin-bottom: 24px; font-size: 16px; }
    .cta-btn {
      display: inline-block; background: var(--purple); color: #fff;
      padding: 14px 32px; border-radius: 10px; text-decoration: none;
      font-family: system-ui; font-size: 15px; font-weight: 600;
      transition: background .2s;
    }
    .cta-btn:hover { background: #6d28d9; }
    .cta-sub { color: rgba(255,255,255,.3); font-size: 12px; margin-top: 12px; font-family: system-ui; }
    footer {
      text-align: center; padding: 32px 24px;
      border-top: 1px solid var(--border); margin-top: 60px;
    }
    footer a { color: var(--purple-l); font-size: 14px; text-decoration: none; font-family: system-ui; }
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
      <p>
        Your free chart is just the beginning. The <strong style="color:#fff">${report.label}</strong>
        gives you a full personalised Vedic report — calculated from your exact birth data.
      </p>
      <a href="https://natalai.live/#reports" class="cta-btn">
        Get ${report.label} — ${report.price}
      </a>
      <p class="cta-sub">Instant delivery · Pay once · No subscription</p>
    </div>
  </main>

  <footer>
    <a href="https://natalai.live">✦ Generate your free Vedic birth chart at natalai.live</a>
  </footer>
</body>
</html>`
}

// ── Step 5: Build blog index ──────────────────────────────────────────────────

function buildIndexHtml(articles) {
  const cards = articles
    .slice()
    .reverse()
    .map(a => {
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
  <meta name="description" content="Learn Vedic astrology — moon signs, dashas, planetary transits and compatibility. Free guides from NatalAI.">
  <link rel="canonical" href="https://natalai.live/blog">
  <style>
    :root {
      --night:#080a12; --deep:#0d1020; --border:#1e2640;
      --gold-l:#e6b568; --text:#a8b8d0; --muted:#5e6e90;
      --purple:#7c3aed; --purple-l:#c4b5fd; --white:#f6f8fc;
    }
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:var(--night);color:var(--text);font-family:system-ui,sans-serif;font-size:15px}
    nav{background:var(--deep);border-bottom:1px solid var(--border);padding:16px 24px;display:flex;align-items:center;justify-content:space-between}
    .logo{color:var(--gold-l);font-size:20px;text-decoration:none;font-weight:600}
    .nav-cta{color:var(--muted);font-size:13px;text-decoration:none}
    .nav-cta:hover{color:var(--text)}
    .hero{text-align:center;padding:72px 24px 48px;max-width:640px;margin:0 auto}
    .hero-label{color:var(--purple-l);font-size:11px;letter-spacing:.15em;text-transform:uppercase;margin-bottom:16px}
    h1{font-size:clamp(28px,5vw,42px);color:var(--white);font-family:Georgia,serif;line-height:1.2;margin-bottom:16px}
    .hero p{color:var(--muted);font-size:16px;line-height:1.6}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px;max-width:1080px;margin:0 auto;padding:0 24px 80px}
    .card{display:block;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:14px;padding:24px;text-decoration:none;transition:border-color .2s,background .2s}
    .card:hover{border-color:rgba(124,58,237,.4);background:rgba(255,255,255,.06)}
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
    <h1>Ancient Wisdom,<br>Modern Words</h1>
    <p>Deep guides on Vedic astrology — moon signs, dashas, planetary transits, compatibility and more.</p>
  </div>
  <div class="grid">
    ${articles.length === 0
      ? '<p class="empty">Articles coming soon...</p>'
      : cards
    }
  </div>
</body>
</html>`
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔭 NatalAI Blog Agent starting...')

  if (!fs.existsSync(BLOG_DIR)) fs.mkdirSync(BLOG_DIR, { recursive: true })

  const articles = loadArticles()
  const keywords = articles.map(a => a.keyword)

  console.log(`📚 ${articles.length} articles published so far`)

  // 1. Pick keyword
  console.log('🔍 Researching keyword...')
  const chosen = await pickKeyword(keywords, articles)
  console.log(`✓ Keyword: "${chosen.keyword}" → ${chosen.reportCta}`)

  // 2. Write article
  console.log('✍️  Writing article...')
  const article = await writeArticle(chosen.keyword, chosen.intent, chosen.reportCta)
  console.log(`✓ Title: "${article.title}"`)
  console.log(`✓ Slug: ${article.slug}`)

  // 3. Save article HTML
  const date = new Date().toISOString()
  const html = buildArticleHtml(article, chosen.keyword, chosen.reportCta, date)
  const articlePath = path.join(BLOG_DIR, `${article.slug}.html`)
  fs.writeFileSync(articlePath, html)
  console.log(`✓ Saved: blog/${article.slug}.html`)

  // 4. Update articles manifest
  articles.push({
    slug:      article.slug,
    keyword:   chosen.keyword,
    title:     article.title,
    excerpt:   article.excerpt,
    metaDesc:  article.metaDesc,
    reportCta: chosen.reportCta,
    date,
    views:     0,
  })
  saveArticles(articles)
  console.log('✓ Updated articles.json')

  // 5. Rebuild blog index
  const indexHtml = buildIndexHtml(articles)
  fs.writeFileSync(path.join(BLOG_DIR, 'index.html'), indexHtml)
  console.log('✓ Rebuilt blog/index.html')

  console.log(`\n✅ Done! Article live at: https://natalai.live/blog/${article.slug}.html`)
}

main().catch(err => {
  console.error('❌ Agent failed:', err)
  process.exit(1)
})
