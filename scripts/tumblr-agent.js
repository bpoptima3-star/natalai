// NatalAI Tumblr Cross-poster
// Runs via GitHub Actions every hour
// Finds unposted articles → formats → posts to Tumblr → marks as posted

const fs   = require('fs')
const path = require('path')

const TUMBLR_TOKEN  = process.env.TUMBLR_ACCESS_TOKEN
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const ARTICLES_FILE = path.join(__dirname, '..', 'blog', 'articles.json')
const BASE_URL      = 'https://natalai.live'
const TUMBLR_BLOG   = process.env.TUMBLR_BLOG_NAME // e.g. natalai.tumblr.com

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadArticles() {
  if (!fs.existsSync(ARTICLES_FILE)) return []
  return JSON.parse(fs.readFileSync(ARTICLES_FILE, 'utf8'))
}

function saveArticles(articles) {
  fs.writeFileSync(ARTICLES_FILE, JSON.stringify(articles, null, 2))
}

function mdToHtml(md) {
  return md
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((https?:\/\/.+?)\)/g, '<a href="$2">$1</a>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]+?<\/li>)/g, '<ul>$1</ul>')
    .split('\n\n')
    .map(p => {
      const t = p.trim()
      if (!t) return ''
      if (t.startsWith('<h') || t.startsWith('<ul')) return t
      return `<p>${t}</p>`
    })
    .filter(Boolean)
    .join('\n')
}

// ── Write Tumblr-optimised tags with Claude ───────────────────────────────────

async function generateTags(article) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Generate 8-10 Tumblr tags for this Vedic astrology article.
Title: "${article.title}"
Summary: "${article.excerpt}"

Rules:
- Mix broad tags (astrology, zodiac) with specific ones (vedic astrology, birth chart)
- Include the specific signs or planets mentioned
- No # symbol — just the words
- Tumblr astrology community tags: witchblr, astrology community, birth chart, vedic astrology
- Return ONLY a JSON array of strings: ["tag1","tag2",...]`
      }]
    }),
  })
  const data = await res.json()
  const text = data.content[0].type === 'text' ? data.content[0].text : '[]'
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim())
  } catch {
    return ['vedic astrology', 'astrology', 'birth chart', 'zodiac', 'spirituality']
  }
}

// ── Post to Tumblr ────────────────────────────────────────────────────────────

async function postToTumblr(article, tags) {
  const articleUrl = `${BASE_URL}/blog/${article.slug}.html`
  const htmlBody = mdToHtml(article.content || article.excerpt || '')

  const body = {
    content: [
      {
        type: 'text',
        text: `<h1>${article.title}</h1>

<p><em>${article.excerpt}</em></p>

${htmlBody}

<hr>

<p>Originally published at <a href="${articleUrl}">${articleUrl}</a></p>

<p>Get your free Vedic birth chart at <a href="https://natalai.live">natalai.live</a> — no signup required. Decoded by AI. Rooted in 5,000 years of Vedic tradition.</p>`,
      }
    ],
    tags: tags.join(','),
    state: 'published',
    native_inline_images: false,
  }

  const res = await fetch(`https://api.tumblr.com/v2/blog/${TUMBLR_BLOG}/posts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TUMBLR_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = await res.json()
  if (!res.ok || data.meta?.status >= 400) {
    throw new Error(`Tumblr API error: ${JSON.stringify(data)}`)
  }
  return data.response?.id_string || data.response?.id || 'unknown'
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('📝 NatalAI Tumblr Cross-poster starting...')

  if (!TUMBLR_TOKEN) throw new Error('TUMBLR_ACCESS_TOKEN not set')
  if (!TUMBLR_BLOG)  throw new Error('TUMBLR_BLOG_NAME not set')

  const articles = loadArticles()
  console.log(`📚 ${articles.length} total articles`)

  const unposted = articles.filter(a => !a.tumblr_posted_at && !a.tumblr_error)
  console.log(`📝 ${unposted.length} articles not yet posted to Tumblr`)

  if (unposted.length === 0) {
    console.log('✓ All articles already posted. Nothing to do.')
    return
  }

  const article = unposted[0]
  console.log(`📤 Posting: "${article.title}"`)

  // Load full content from HTML file if available
  const htmlFile = path.join(__dirname, '..', 'blog', `${article.slug}.html`)
  if (fs.existsSync(htmlFile)) {
    const html = fs.readFileSync(htmlFile, 'utf8')
    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
    if (mainMatch) {
      article.content = mainMatch[1]
        .replace(/<div class="cta">[\s\S]*?<\/div>/gi, '')
        .replace(/<h1>[\s\S]*?<\/h1>/i, '')
        .replace(/<p class="byline">[\s\S]*?<\/p>/i, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }
  }

  try {
    console.log('🏷️  Generating tags...')
    const tags = await generateTags(article)
    console.log(`✓ Tags: ${tags.join(', ')}`)

    const postId = await postToTumblr(article, tags)
    console.log(`✓ Posted to Tumblr: ${postId}`)

    const idx = articles.findIndex(a => a.slug === article.slug)
    articles[idx].tumblr_posted_at = new Date().toISOString()
    articles[idx].tumblr_post_id   = postId
    delete articles[idx].tumblr_error
    saveArticles(articles)

    console.log('✓ Marked as posted in articles.json')
    console.log(`\n✅ Done! View at: https://${TUMBLR_BLOG}`)

  } catch (err) {
    console.error(`❌ Failed:`, err.message)
    const idx = articles.findIndex(a => a.slug === article.slug)
    articles[idx].tumblr_error = err.message
    saveArticles(articles)
    process.exit(1)
  }
}

main().catch(err => {
  console.error('❌ Tumblr agent failed:', err)
  process.exit(1)
})
