// NatalAI Tumblr Cross-poster v2 — OAuth 1.0a (permanent, never expires)
// Runs via GitHub Actions every hour
// Finds unposted articles → posts to Tumblr → marks as posted

const fs     = require('fs')
const path   = require('path')
const crypto = require('crypto')

const CONSUMER_KEY    = process.env.TUMBLR_CONSUMER_KEY
const CONSUMER_SECRET = process.env.TUMBLR_CONSUMER_SECRET
const OAUTH_TOKEN     = process.env.TUMBLR_OAUTH_TOKEN
const OAUTH_SECRET    = process.env.TUMBLR_OAUTH_TOKEN_SECRET
const ANTHROPIC_KEY   = process.env.ANTHROPIC_API_KEY
const TUMBLR_BLOG     = process.env.TUMBLR_BLOG_NAME

const ARTICLES_FILE   = path.join(__dirname, '..', 'blog', 'articles.json')
const BASE_URL        = 'https://natalai.live'

// ── OAuth 1.0a ────────────────────────────────────────────────────────────────

function encodeRFC3986(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, c =>
    '%' + c.charCodeAt(0).toString(16).toUpperCase()
  )
}

function buildOAuthHeader(method, url, extraParams = {}) {
  const nonce     = crypto.randomBytes(16).toString('hex')
  const timestamp = Math.floor(Date.now() / 1000).toString()

  const oauthParams = {
    oauth_consumer_key:     CONSUMER_KEY,
    oauth_nonce:            nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp:        timestamp,
    oauth_token:            OAUTH_TOKEN,
    oauth_version:          '1.0',
    ...extraParams,
  }

  const allParams = { ...oauthParams }

  const sortedParams = Object.keys(allParams).sort().map(k =>
    `${encodeRFC3986(k)}=${encodeRFC3986(allParams[k])}`
  ).join('&')

  const baseString = [
    method.toUpperCase(),
    encodeRFC3986(url),
    encodeRFC3986(sortedParams),
  ].join('&')

  const signingKey = `${encodeRFC3986(CONSUMER_SECRET)}&${encodeRFC3986(OAUTH_SECRET)}`
  const signature  = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64')
  oauthParams.oauth_signature = signature

  return 'OAuth ' + Object.keys(oauthParams).sort().map(k =>
    `${encodeRFC3986(k)}="${encodeRFC3986(oauthParams[k])}"`
  ).join(', ')
}

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

// ── Generate tags with Claude Haiku ──────────────────────────────────────────

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
- Include specific signs or planets mentioned
- No # symbol
- Include: witchblr, astrology community
Return ONLY a JSON array: ["tag1","tag2",...]`
      }]
    }),
  })
  const data = await res.json()
  const text = data.content?.[0]?.text || '[]'
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim())
  } catch {
    return ['vedic astrology', 'astrology', 'birth chart', 'zodiac', 'witchblr', 'astrology community']
  }
}

// ── Post to Tumblr via OAuth 1.0a ─────────────────────────────────────────────

async function postToTumblr(article, tags) {
  const articleUrl = `${BASE_URL}/blog/${article.slug}.html`
  const url        = `https://api.tumblr.com/v2/blog/${TUMBLR_BLOG}/posts`

  // Load full content from HTML file
  let bodyHtml = mdToHtml(article.excerpt || '')
  const htmlFile = path.join(__dirname, '..', 'blog', `${article.slug}.html`)
  if (fs.existsSync(htmlFile)) {
    const html = fs.readFileSync(htmlFile, 'utf8')
    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
    if (mainMatch) {
      bodyHtml = mainMatch[1]
        .replace(/<div class="cta">[\s\S]*?<\/div>/gi, '')
        .replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, '')
        .replace(/<p class="byline">[\s\S]*?<\/p>/i, '')
        .trim()
    }
  }

  const postBody = {
    type:  'text',
    state: 'published',
    title: article.title,
    body:  `${bodyHtml}

<hr>
<p>Originally published at <a href="${articleUrl}">${articleUrl}</a></p>
<p>Get your free Vedic birth chart at <a href="https://natalai.live">natalai.live</a> — no signup required.<br>
<em>Decoded by AI. Rooted in 5,000 years of Vedic tradition.</em></p>`,
    tags: tags.join(','),
  }

  const authHeader = buildOAuthHeader('POST', url)

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(postBody),
  })

  const data = await res.json()
  if (!res.ok || (data.meta && data.meta.status >= 400)) {
    throw new Error(`Tumblr API error: ${JSON.stringify(data)}`)
  }

  return data.response?.id_string || data.response?.id || 'posted'
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('📝 NatalAI Tumblr Cross-poster v2 (OAuth 1.0a) starting...')

  if (!CONSUMER_KEY)    throw new Error('TUMBLR_CONSUMER_KEY not set')
  if (!CONSUMER_SECRET) throw new Error('TUMBLR_CONSUMER_SECRET not set')
  if (!OAUTH_TOKEN)     throw new Error('TUMBLR_OAUTH_TOKEN not set')
  if (!OAUTH_SECRET)    throw new Error('TUMBLR_OAUTH_TOKEN_SECRET not set')
  if (!TUMBLR_BLOG)     throw new Error('TUMBLR_BLOG_NAME not set')

  const articles = loadArticles()
  console.log(`📚 ${articles.length} total articles`)

  const unposted = articles.filter(a => !a.tumblr_posted_at && !a.tumblr_error)
  console.log(`📝 ${unposted.length} not yet posted to Tumblr`)

  if (unposted.length === 0) {
    console.log('✓ All articles posted. Nothing to do.')
    return
  }

  const article = unposted[0]
  console.log(`📤 Posting: "${article.title}"`)

  try {
    console.log('🏷️  Generating tags...')
    const tags = await generateTags(article)
    console.log(`✓ Tags: ${tags.join(', ')}`)

    const postId = await postToTumblr(article, tags)
    console.log(`✓ Posted! ID: ${postId}`)

    const idx = articles.findIndex(a => a.slug === article.slug)
    articles[idx].tumblr_posted_at = new Date().toISOString()
    articles[idx].tumblr_post_id   = String(postId)
    delete articles[idx].tumblr_error
    saveArticles(articles)

    console.log(`\n✅ Done! View at: https://${TUMBLR_BLOG}`)

  } catch (err) {
    console.error('❌ Failed:', err.message)
    const idx = articles.findIndex(a => a.slug === article.slug)
    if (idx >= 0) {
      articles[idx].tumblr_error = err.message
      saveArticles(articles)
    }
    process.exit(1)
  }
}

main().catch(err => {
  console.error('❌ Agent failed:', err)
  process.exit(1)
})
