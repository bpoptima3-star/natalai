// NatalAI Pinterest Agent
// Runs via GitHub Actions twice daily
// Picks a blog article, writes a pin, posts to Pinterest
// No npm installs — uses Node 20 built-in fetch

const fs   = require('fs')
const path = require('path')

const PINTEREST_TOKEN = process.env.PINTEREST_ACCESS_TOKEN
const ANTHROPIC_KEY   = process.env.ANTHROPIC_API_KEY
const ARTICLES_FILE   = path.join(__dirname, '..', 'blog', 'articles.json')
const PINS_LOG        = path.join(__dirname, '..', 'blog', 'pins.json')
const BASE_URL        = 'https://natalai.live'

// Board names must match exactly what you created on Pinterest
const BOARD_MAP = {
  year_reading:  'Vedic Astrology Guide',
  compatibility: 'Astrology Compatibility',
  timing:        'Vedic Astrology Guide',
  default:       'Vedic Astrology Guide',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function claude(prompt, maxTokens = 400) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Claude error: ${JSON.stringify(data)}`)
  return data.content[0].text
}

async function pinterestGet(endpoint) {
  const res = await fetch(`https://api.pinterest.com/v5${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${PINTEREST_TOKEN}`,
      'Content-Type': 'application/json',
    },
  })
  return res.json()
}

async function pinterestPost(endpoint, body) {
  const res = await fetch(`https://api.pinterest.com/v5${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PINTEREST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  return res.json()
}

// ── Step 1: Get board IDs from Pinterest ──────────────────────────────────────

async function getBoardIds() {
  console.log('📌 Fetching Pinterest boards...')
  const data = await pinterestGet('/boards?page_size=50')

  if (!data.items || data.items.length === 0) {
    throw new Error('No boards found. Check your Pinterest access token.')
  }

  const boardIds = {}
  data.items.forEach(board => {
    console.log(`  Found board: "${board.name}" → ${board.id}`)
    boardIds[board.name] = board.id
  })

  return boardIds
}

// ── Step 2: Pick which article to pin ─────────────────────────────────────────

function pickArticle(articles, pinsLog) {
  if (articles.length === 0) throw new Error('No articles yet. Run blog agent first.')

  // Get already pinned slugs
  const pinned = new Set(pinsLog.map(p => p.slug))

  // Prefer unpinned articles first
  const unpinned = articles.filter(a => !pinned.has(a.slug))
  const pool = unpinned.length > 0 ? unpinned : articles

  // Pick most recent from pool
  return pool[0]
}

// ── Step 3: Write pin copy with Claude ───────────────────────────────────────

async function writePinCopy(article) {
  const raw = await claude(
    `Write a Pinterest pin for this Vedic astrology article from NatalAI.live.

Article title: "${article.title}"
Article summary: "${article.excerpt}"

Pinterest pin requirements:
- Title: 50-70 characters, compelling, include main keyword
- Description: 150-200 characters. Start with a hook or question. Mention the key benefit. End with "natalai.live". No hashtags.
- Tone: mystical but grounded, speaks to Western spiritual seekers

Return ONLY valid JSON, no markdown:
{"title":"...","description":"..."}`
  )

  return JSON.parse(raw.replace(/```json|```/g, '').trim())
}

// ── Step 4: Create the pin ────────────────────────────────────────────────────

async function createPin(boardId, article, pinCopy) {
  const articleUrl = `${BASE_URL}/blog/${article.slug}.html`

  // Use NatalAI logo as pin image — hosted on your site
  // Make sure you have /pin-cover.jpg in your repo (the logo JPEG you downloaded)
  const imageUrl = `${BASE_URL}/pin-cover.jpg`

  const body = {
    board_id: boardId,
    title: pinCopy.title,
    description: pinCopy.description,
    link: articleUrl,
    media_source: {
      source_type: 'image_url',
      url: imageUrl,
    },
  }

  console.log(`📌 Creating pin: "${pinCopy.title}"`)
  const result = await pinterestPost('/pins', body)

  if (result.id) {
    console.log(`✓ Pin created: ${result.id}`)
    return result.id
  } else {
    throw new Error(`Pinterest pin failed: ${JSON.stringify(result)}`)
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('📌 NatalAI Pinterest Agent starting...')

  // Load articles
  if (!fs.existsSync(ARTICLES_FILE)) {
    throw new Error('blog/articles.json not found. Run blog agent first.')
  }
  const articles = JSON.parse(fs.readFileSync(ARTICLES_FILE, 'utf8'))
  console.log(`📚 ${articles.length} articles available`)

  // Load pins log
  const pinsLog = fs.existsSync(PINS_LOG)
    ? JSON.parse(fs.readFileSync(PINS_LOG, 'utf8'))
    : []
  console.log(`📌 ${pinsLog.length} pins created so far`)

  // Get Pinterest board IDs
  const boardIds = await getBoardIds()

  // Pick article
  const article = pickArticle(articles, pinsLog)
  console.log(`✓ Picked article: "${article.title}"`)

  // Find correct board
  const boardName = BOARD_MAP[article.reportCta] || BOARD_MAP.default
  const boardId = boardIds[boardName]
  if (!boardId) {
    throw new Error(`Board "${boardName}" not found. Check board names match Pinterest exactly.`)
  }
  console.log(`✓ Board: "${boardName}" (${boardId})`)

  // Write pin copy
  console.log('✍️  Writing pin copy...')
  const pinCopy = await writePinCopy(article)
  console.log(`✓ Title: "${pinCopy.title}"`)

  // Create pin
  const pinId = await createPin(boardId, article, pinCopy)

  // Log it
  pinsLog.push({
    pinId,
    slug:      article.slug,
    title:     pinCopy.title,
    board:     boardName,
    createdAt: new Date().toISOString(),
  })
  fs.writeFileSync(PINS_LOG, JSON.stringify(pinsLog, null, 2))
  console.log('✓ Saved to pins.json')

  console.log(`\n✅ Done! Pin live at: https://www.pinterest.com/bpoptima3/`)
}

main().catch(err => {
  console.error('❌ Pinterest agent failed:', err.message)
  process.exit(1)
})
