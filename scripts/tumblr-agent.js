// NatalAI Tumblr Cross-poster v3 — OAuth 1.0a + Legacy endpoint
const fs     = require('fs')
const path   = require('path')
const crypto = require('crypto')

const CONSUMER_KEY    = process.env.TUMBLR_CONSUMER_KEY
const CONSUMER_SECRET = process.env.TUMBLR_CONSUMER_SECRET
const OAUTH_TOKEN     = process.env.TUMBLR_OAUTH_TOKEN
const OAUTH_SECRET    = process.env.TUMBLR_OAUTH_TOKEN_SECRET
const ANTHROPIC_KEY   = process.env.ANTHROPIC_API_KEY
const TUMBLR_BLOG     = process.env.TUMBLR_BLOG_NAME

const ARTICLES_FILE = path.join(__dirname, '..', 'blog', 'articles.json')
const BASE_URL      = 'https://natalai.live'

// ── OAuth 1.0a ────────────────────────────────────────────────────────────────

function encodeRFC3986(str) {
  return encodeURIComponent(String(str))
    .replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
}

function sign(method, url, params) {
  const nonce     = crypto.randomBytes(16).toString('hex')
  const timestamp = Math.floor(Date.now() / 1000).toString()

  const oauthParams = {
    oauth_consumer_key:     CONSUMER_KEY,
    oauth_nonce:            nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp:        timestamp,
    oauth_token:            OAUTH_TOKEN,
    oauth_version:          '1.0',
  }

  // Include all params (oauth + body) in signature
  const allParams = { ...oauthParams, ...params }

  const baseStr = [
    method.toUpperCase(),
    encodeRFC3986(url),
    encodeRFC3986(
      Object.keys(allParams).sort()
        .map(k => `${encodeRFC3986(k)}=${encodeRFC3986(allParams[k])}`)
        .join('&')
    ),
  ].join('&')

  const sigKey  = `${encodeRFC3986(CONSUMER_SECRET)}&${encodeRFC3986(OAUTH_SECRET)}`
  const sig     = crypto.createHmac('sha1', sigKey).update(baseStr).digest('base64')

  oauthParams.oauth_signature = sig

  return 'OAuth ' + Object.keys(oauthParams)
    .map(k => `${encodeRFC3986(k)}="${encodeRFC3986(oauthParams[k])}"`)
    .join(', ')
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadArticles() {
  if (!fs.existsSync(ARTICLES_FILE)) return []
  return JSON.parse(fs.readFileSync(ARTICLES_FILE, 'utf8'))
}

function saveArticles(a) {
  fs.writeFileSync(ARTICLES_FILE, JSON.stringify(a, null, 2))
}

function stripHtml(html) {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

// ── Generate tags ─────────────────────────────────────────────────────────────

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
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: `Give 8 Tumblr tags for this Vedic astrology article: "${article.title}". Include: witchblr, astrology community. No # symbol. Return ONLY JSON array: ["tag1","tag2",...]`
      }]
    }),
  })
  const data = await res.json()
  const text = data.content?.[0]?.text || '[]'
  try { return JSON.parse(text.replace(/```json|```/g, '').trim()) }
  catch { return ['vedic astrology', 'astrology', 'birth chart', 'witchblr', 'astrology community', 'zodiac'] }
}

// ── Post to Tumblr via legacy /post endpoint ──────────────────────────────────

async function postToTumblr(article, tags) {
  const articleUrl = `${BASE_URL}/blog/${article.slug}.html`
  const url        = `https://api.tumblr.com/v2/blog/${TUMBLR_BLOG}/post`

  // Get article content
  let body = stripHtml(article.excerpt || '')
  const htmlFile = path.join(__dirname, '..', 'blog', `${article.slug}.html`)
  if (fs.existsSync(htmlFile)) {
    const html = fs.readFileSync(htmlFile, 'utf8')
    const m = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
    if (m) {
      body = stripHtml(
        m[1]
          .replace(/<div class="cta">[\s\S]*?<\/div>/gi, '')
          .replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, '')
          .replace(/<p class="byline">[\s\S]*?<\/p>/i, '')
      ).slice(0, 3000)
    }
  }

  const footer = `\n\nOriginally published at ${articleUrl}\n\nGet your free Vedic birth chart at natalai.live — no signup required. Decoded by AI. Rooted in 5,000 years of Vedic tradition.`

  const postParams = {
    type:  'text',
    state: 'published',
    title: article.title,
    body:  body + footer,
    tags:  tags.join(','),
    format: 'markdown',
  }

  const authHeader = sign('POST', url, postParams)

  // Send as form-encoded
  const formBody = Object.keys(postParams)
    .map(k => `${encodeRFC3986(k)}=${encodeRFC3986(postParams[k])}`)
    .join('&')

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type':  'application/x-www-form-urlencoded',
    },
    body: formBody,
  })

  const data = await res.json()
  if (!res.ok || (data.meta?.status >= 400)) {
    throw new Error(`Tumblr error: ${JSON.stringify(data)}`)
  }
  return data.response?.id || 'posted'
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('📝 NatalAI Tumblr Cross-poster v3 starting...')

  const missing = ['TUMBLR_CONSUMER_KEY','TUMBLR_CONSUMER_SECRET','TUMBLR_OAUTH_TOKEN','TUMBLR_OAUTH_TOKEN_SECRET','TUMBLR_BLOG_NAME']
    .filter(k => !process.env[k])
  if (missing.length) throw new Error(`Missing secrets: ${missing.join(', ')}`)

  const articles = loadArticles()
  console.log(`📚 ${articles.length} articles`)

  const unposted = articles.filter(a => !a.tumblr_posted_at && !a.tumblr_error)
  console.log(`📝 ${unposted.length} not yet posted`)

  if (unposted.length === 0) { console.log('✓ All posted.'); return }

  const article = unposted[0]
  console.log(`📤 Posting: "${article.title}"`)

  try {
    const tags  = await generateTags(article)
    console.log(`✓ Tags: ${tags.join(', ')}`)

    const postId = await postToTumblr(article, tags)
    console.log(`✓ Posted! ID: ${postId}`)

    const idx = articles.findIndex(a => a.slug === article.slug)
    articles[idx].tumblr_posted_at = new Date().toISOString()
    articles[idx].tumblr_post_id   = String(postId)
    delete articles[idx].tumblr_error
    saveArticles(articles)

    console.log(`\n✅ Done! https://www.tumblr.com/${TUMBLR_BLOG.replace('.tumblr.com','')}`)

  } catch (err) {
    console.error('❌ Failed:', err.message)
    const idx = articles.findIndex(a => a.slug === article.slug)
    if (idx >= 0) { articles[idx].tumblr_error = err.message; saveArticles(articles) }
    process.exit(1)
  }
}

main().catch(err => { console.error('❌', err); process.exit(1) })
