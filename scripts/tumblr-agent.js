// NatalAI Tumblr Cross-poster v4 — OAuth 1.0a + AI-written hook captions
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

// ── AI: write hook caption + tags in one call ─────────────────────────────────

async function writeCaptionAndTags(article) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: `You write scroll-stopping Tumblr captions for NatalAI.live, a free Vedic astrology tool. Audience: US/UK astrology-tumblr (witchblr).
RULES:
- Line 1 MUST be a curiosity-gap hook. Best angle: in Vedic astrology their sign is often DIFFERENT from their Western sign, so they may have this placement without knowing. Make them think "wait, is this me?"
- Be specific and slightly raw. NEVER use clichés like "possess extraordinary", "set them apart", "profound depths", "remarkable ability".
- 3-4 short lines total. No emojis except a single ✦ if it fits. Sound like a real person, not a horoscope app.
- Do NOT include links or CTAs (added separately).`,
      messages: [{
        role: 'user',
        content: `Article title: "${article.title}"
Excerpt: "${stripHtml(article.excerpt || '')}"

Return ONLY valid JSON:
{"caption":"3-4 line hook caption, no links","tags":["8-10 tumblr tags, no # symbol, include witchblr and astro community"]}`
      }]
    }),
  })
  const data = await res.json()
  const text = data.content?.[0]?.text || ''
  try {
    const out = JSON.parse(text.replace(/```json|```/g, '').trim())
    if (!out.caption || !Array.isArray(out.tags)) throw new Error('bad shape')
    return out
  } catch {
    // Fallback so a bad AI response never blocks posting
    return {
      caption: `Your moon sign in Vedic astrology is often NOT the one you think — and it runs your whole emotional life.\n\n"${article.title}"`,
      tags: ['vedic astrology','astrology','birth chart','witchblr','astro community','astrology community','moon sign','zodiac'],
    }
  }
}

// ── Post to Tumblr via legacy /post endpoint ──────────────────────────────────

async function postToTumblr(article, caption, tags) {
  const articleUrl = `${BASE_URL}/blog/${article.slug}.html`
  const url        = `https://api.tumblr.com/v2/blog/${TUMBLR_BLOG}/post`

  const footer = `\n\nFind your real Vedic chart free → ${BASE_URL}\nFull guide → ${articleUrl}`
  const body   = caption.trim() + footer

  const postParams = {
    type:   'text',
    state:  'published',
    title:  article.title,
    body:   body,
    tags:   tags.join(','),
    format: 'markdown',
  }

  const authHeader = sign('POST', url, postParams)

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
  console.log('📝 NatalAI Tumblr Cross-poster v4 starting...')

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
    const { caption, tags } = await writeCaptionAndTags(article)
    console.log(`✓ Caption:\n${caption}`)
    console.log(`✓ Tags: ${tags.join(', ')}`)

    const postId = await postToTumblr(article, caption, tags)
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
