// NatalAI YouTube Shorts Agent
// Runs via GitHub Actions daily
// Writes script → generates audio → creates video with ffmpeg → uploads to YouTube

const fs     = require('fs')
const path   = require('path')
const https  = require('https')
const http   = require('http')
const cp     = require('child_process')

const ANTHROPIC_KEY     = process.env.ANTHROPIC_API_KEY
const YT_CLIENT_ID      = '466321401108-i158fg69tp6fh1hv2dv4sv8o0mpvuk06.apps.googleusercontent.com'
const YT_CLIENT_SECRET  = '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'
const YT_REFRESH_TOKEN  = process.env.YOUTUBE_REFRESH_TOKEN

const WORK_DIR      = '/tmp/natalai-yt'
const ARTICLES_FILE = path.join(__dirname, '..', 'blog', 'articles.json')
const LOG_FILE      = path.join(__dirname, '..', 'blog', 'youtube-posts.json')

// ── Helpers ───────────────────────────────────────────────────────────────────

function run(cmd) {
  return new Promise((resolve, reject) => {
    cp.exec(cmd, { maxBuffer: 50*1024*1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message))
      else resolve(stdout)
    })
  })
}

function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'POST', headers }, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => resolve({ status: res.statusCode, body: data }))
    })
    req.on('error', reject)
    req.write(typeof body === 'string' ? body : JSON.stringify(body))
    req.end()
  })
}

function loadLog() {
  if (!fs.existsSync(LOG_FILE)) return []
  return JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'))
}

function saveLog(log) {
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2))
}

// ── Step 1: Get YouTube access token ─────────────────────────────────────────

async function getAccessToken() {
  const body = new URLSearchParams({
    client_id:     YT_CLIENT_ID,
    client_secret: YT_CLIENT_SECRET,
    refresh_token: YT_REFRESH_TOKEN,
    grant_type:    'refresh_token',
  }).toString()

  const res = await httpsPost('oauth2.googleapis.com', '/token',
    { 'Content-Type': 'application/x-www-form-urlencoded' }, body)

  const data = JSON.parse(res.body)
  if (!data.access_token) throw new Error(`Token error: ${res.body}`)
  return data.access_token
}

// ── Step 2: Pick topic ────────────────────────────────────────────────────────

async function pickTopic(posted) {
  const articles = fs.existsSync(ARTICLES_FILE)
    ? JSON.parse(fs.readFileSync(ARTICLES_FILE, 'utf8'))
    : []

  const postedKeywords = new Set(posted.map(p => p.keyword))

  // Use article keywords first
  const unused = articles.find(a => !postedKeywords.has(a.keyword))
  if (unused) return { keyword: unused.keyword, title: unused.title }

  // AI fallback
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: `Give one Vedic astrology topic for a 60-second YouTube Short. Something people search for. Return JSON: {"keyword":"...","title":"..."}` }]
    })
  })
  const data = await res.json()
  return JSON.parse(data.content[0].text.replace(/```json|```/g, '').trim())
}

// ── Step 3: Write script ──────────────────────────────────────────────────────

async function writeScript(topic) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      system: `You write scripts for 55-second YouTube Shorts about Vedic astrology. 
Plain English only — no Sanskrit. Energetic, curious tone. 
Hook in first 3 seconds. End with call to action for natalai.live.
Scripts are read aloud so write naturally spoken sentences.`,
      messages: [{ role: 'user', content: `Write a YouTube Shorts script about: "${topic.keyword}"

Format:
HOOK: (one punchy opening sentence — question or bold claim)
CONTENT: (4-5 short sentences explaining the key insight)
CTA: (one sentence — "Get your free Vedic birth chart at natalai.live")

Keep total under 130 words. Make it feel like a genuine insight, not an ad.

Return ONLY valid JSON:
{"hook":"...","content":"...","cta":"...","title":"YouTube title under 70 chars","description":"YouTube description under 200 chars","tags":["tag1","tag2",...]}` }]
    })
  })
  const data = await res.json()
  return JSON.parse(data.content[0].text.replace(/```json|```/g, '').trim())
}

// ── Step 4: Generate audio with Google TTS (free) ─────────────────────────────

async function generateAudio(script, outputPath) {
  const fullText = `${script.hook} ${script.content} ${script.cta}`

  const body = JSON.stringify({
    input: { text: fullText },
    voice: { languageCode: 'en-US', name: 'en-US-Neural2-F', ssmlGender: 'FEMALE' },
    audioConfig: { audioEncoding: 'MP3', speakingRate: 1.05, pitch: 1.0 },
  })

  // Use Google TTS REST API (free tier: 1M chars/month)
  const res = await httpsPost('texttospeech.googleapis.com',
    `/v1/text:synthesize?key=${process.env.GOOGLE_TTS_KEY || ''}`,
    { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    body)

  const data = JSON.parse(res.body)

  if (!data.audioContent) {
    // Fallback: use espeak (always available on ubuntu)
    console.log('  Google TTS unavailable, using espeak fallback...')
    await run(`espeak -v en -s 150 -w "${outputPath.replace('.mp3','.wav')}" "${fullText.replace(/"/g, '\\"')}"`)
    await run(`ffmpeg -y -i "${outputPath.replace('.mp3','.wav')}" "${outputPath}"`)
    return
  }

  fs.writeFileSync(outputPath, Buffer.from(data.audioContent, 'base64'))
}

// ── Step 5: Create video with ffmpeg ─────────────────────────────────────────

async function createVideo(script, audioPath, outputPath) {
  // Write text to a file and use textfile= instead of text= to avoid escaping issues
  const lines = [
    { text: script.hook, size: 52, color: 'white' },
    ...script.content.split(/[.!?]+/).filter(s => s.trim().length > 5).slice(0, 4).map(s => ({
      text: s.trim(), size: 36, color: 'white'
    })),
    { text: 'natalai.live', size: 48, color: 'E6B568' },
  ]

  // Write each line to a temp text file
  const textFiles = lines.map((line, i) => {
    const f = path.join(WORK_DIR, `line${i}.txt`)
    fs.writeFileSync(f, line.text)
    return { ...line, file: f }
  })

  const filters = textFiles.map((line, i) => {
    const y = 220 + (i * 90)
    return `drawtext=fontsize=${line.size}:fontcolor=${line.color}:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:textfile='${line.file}':x=(w-text_w)/2:y=${y}:line_spacing=8`
  }).join(',')

  const cmd = `ffmpeg -y \
    -f lavfi -i color=c=080a12:size=1080x1920:rate=30 \
    -i "${audioPath}" \
    -vf "${filters}" \
    -c:v libx264 -preset fast -crf 23 \
    -c:a aac -b:a 128k \
    -shortest \
    -movflags +faststart \
    "${outputPath}"`

  await run(cmd)
}

// ── Step 6: Upload to YouTube ─────────────────────────────────────────────────

async function uploadToYouTube(videoPath, script, topic, accessToken) {
  const videoData = fs.readFileSync(videoPath)
  const fileSize  = videoData.length

  const metadata = {
    snippet: {
      title:       script.title,
      description: script.description + '\n\nGet your free Vedic birth chart → https://natalai.live\n\n#VedicAstrology #Astrology #Shorts',
      tags:        [...(script.tags || []), 'Shorts', 'VedicAstrology', 'Astrology', 'BirthChart', 'NatalAI'],
      categoryId:  '22', // People & Blogs
    },
    status: {
      privacyStatus:           'public',
      selfDeclaredMadeForKids: false,
    },
  }

  // Resumable upload
  const initRes = await httpsPost(
    'www.googleapis.com',
    `/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status`,
    {
      'Authorization':           `Bearer ${accessToken}`,
      'Content-Type':            'application/json',
      'X-Upload-Content-Type':   'video/mp4',
      'X-Upload-Content-Length': fileSize,
    },
    JSON.stringify(metadata)
  )

  const uploadUrl = initRes.body.match(/Location: (.*)/)?.[1]?.trim()
    || (() => { throw new Error(`No upload URL: ${initRes.body}`) })()

  // Upload video bytes
  const uploadRes = await new Promise((resolve, reject) => {
    const urlObj = new URL(uploadUrl)
    const req = https.request({
      hostname: urlObj.hostname,
      path:     urlObj.pathname + urlObj.search,
      method:   'PUT',
      headers:  {
        'Authorization':  `Bearer ${accessToken}`,
        'Content-Type':   'video/mp4',
        'Content-Length': fileSize,
      },
    }, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => resolve({ status: res.statusCode, body: data }))
    })
    req.on('error', reject)
    req.write(videoData)
    req.end()
  })

  const result = JSON.parse(uploadRes.body)
  if (!result.id) throw new Error(`Upload failed: ${uploadRes.body}`)
  return result.id
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🎬 NatalAI YouTube Shorts Agent starting...')

  fs.mkdirSync(WORK_DIR, { recursive: true })

  const log = loadLog()
  console.log(`📺 ${log.length} videos published so far`)

  // Get access token
  const accessToken = await getAccessToken()
  console.log('✓ YouTube authenticated')

  // Pick topic
  const topic = await pickTopic(log)
  console.log(`✓ Topic: "${topic.keyword}"`)

  // Write script
  console.log('✍️  Writing script...')
  const script = await writeScript(topic)
  console.log(`✓ Title: "${script.title}"`)

  // Generate audio
  const audioPath = path.join(WORK_DIR, 'audio.mp3')
  console.log('🔊 Generating audio...')
  await generateAudio(script, audioPath)
  console.log('✓ Audio ready')

  // Create video
  const videoPath = path.join(WORK_DIR, 'short.mp4')
  console.log('🎥 Creating video...')
  await createVideo(script, audioPath, videoPath)
  console.log('✓ Video ready')

  // Upload
  console.log('📤 Uploading to YouTube...')
  const videoId = await uploadToYouTube(videoPath, script, topic, accessToken)
  console.log(`✓ Uploaded! https://youtube.com/watch?v=${videoId}`)

  // Log
  log.push({
    videoId,
    keyword:   topic.keyword,
    title:     script.title,
    postedAt:  new Date().toISOString(),
    url:       `https://youtube.com/watch?v=${videoId}`,
  })
  saveLog(log)

  // Cleanup
  fs.rmSync(WORK_DIR, { recursive: true, force: true })

  console.log(`\n✅ Done! https://youtube.com/watch?v=${videoId}`)
}

main().catch(err => {
  console.error('❌ YouTube agent failed:', err.message)
  process.exit(1)
})
