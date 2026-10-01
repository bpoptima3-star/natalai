// One-time: delete duplicate NatalAI bot posts from Tumblr.
// Safe: only touches posts containing 'natalai.live'. Keeps newest post per title.
// Set DRY_RUN=false (env) to actually delete. Default is dry run (lists only).
const crypto = require('crypto')

const CONSUMER_KEY    = process.env.TUMBLR_CONSUMER_KEY
const CONSUMER_SECRET = process.env.TUMBLR_CONSUMER_SECRET
const OAUTH_TOKEN     = process.env.TUMBLR_OAUTH_TOKEN
const OAUTH_SECRET    = process.env.TUMBLR_OAUTH_TOKEN_SECRET
const TUMBLR_BLOG     = process.env.TUMBLR_BLOG_NAME
const DRY_RUN         = process.env.DRY_RUN !== 'false'   // default TRUE (safe)
const SIGNATURE       = 'natalai.live'                     // only delete posts containing this

function enc(s){return encodeURIComponent(String(s)).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase())}

function authHeader(method, url, params){
  const oauth = {
    oauth_consumer_key: CONSUMER_KEY,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now()/1000).toString(),
    oauth_token: OAUTH_TOKEN,
    oauth_version: '1.0',
  }
  const all = { ...oauth, ...params }
  const base = [method.toUpperCase(), enc(url), enc(Object.keys(all).sort().map(k=>`${enc(k)}=${enc(all[k])}`).join('&'))].join('&')
  const key = `${enc(CONSUMER_SECRET)}&${enc(OAUTH_SECRET)}`
  oauth.oauth_signature = crypto.createHmac('sha1', key).update(base).digest('base64')
  return 'OAuth ' + Object.keys(oauth).map(k=>`${enc(k)}="${enc(oauth[k])}"`).join(', ')
}

async function getPosts(offset){
  const url = `https://api.tumblr.com/v2/blog/${TUMBLR_BLOG}/posts`
  const params = { limit: '50', offset: String(offset), api_key: CONSUMER_KEY }
  const qs = Object.keys(params).map(k=>`${enc(k)}=${enc(params[k])}`).join('&')
  const res = await fetch(`${url}?${qs}`, { headers: { Authorization: authHeader('GET', url, params) } })
  const data = await res.json()
  if (!res.ok) throw new Error(`Fetch error: ${JSON.stringify(data)}`)
  return data.response.posts || []
}

async function deletePost(id){
  const url = `https://api.tumblr.com/v2/blog/${TUMBLR_BLOG}/post/delete`
  const params = { id: String(id) }
  const body = Object.keys(params).map(k=>`${enc(k)}=${enc(params[k])}`).join('&')
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: authHeader('POST', url, params), 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Delete ${id} error: ${JSON.stringify(data)}`)
  return true
}

async function main(){
  console.log(`🧹 Duplicate cleanup — DRY_RUN=${DRY_RUN}`)
  // 1. Fetch all posts
  let all = [], offset = 0
  while (true) {
    const batch = await getPosts(offset)
    if (!batch.length) break
    all = all.concat(batch)
    offset += batch.length
    console.log(`  fetched ${all.length}...`)
    if (batch.length < 50) break
  }
  console.log(`📚 Total posts on blog: ${all.length}`)

  // 2. Keep only bot posts (contain signature)
  const botPosts = all.filter(p => {
    const text = `${p.title||''} ${p.body||''} ${p.summary||''} ${(p.trail||[]).map(t=>t.content_raw||'').join(' ')}`
    return text.includes(SIGNATURE)
  })
  console.log(`🤖 Bot posts (contain "${SIGNATURE}"): ${botPosts.length}`)

  // 3. Group by title, keep newest, mark rest for deletion
  const byTitle = {}
  for (const p of botPosts) {
    const t = (p.title || p.summary || '').trim().toLowerCase()
    ;(byTitle[t] = byTitle[t] || []).push(p)
  }
  const toDelete = []
  for (const t in byTitle) {
    const group = byTitle[t].sort((a,b)=> (b.timestamp||0)-(a.timestamp||0)) // newest first
    toDelete.push(...group.slice(1)) // keep [0], delete rest
  }
  console.log(`🗑️  Duplicates to delete (keeping newest of each title): ${toDelete.length}`)
  console.log(`✅ Posts that will REMAIN: ${botPosts.length - toDelete.length} bot + ${all.length - botPosts.length} non-bot`)

  if (DRY_RUN) {
    console.log('\n--- DRY RUN: nothing deleted. Sample of what would go: ---')
    toDelete.slice(0,15).forEach(p => console.log(`   would delete #${p.id}: "${p.title||p.summary||''}"`))
    console.log(`\nRe-run with DRY_RUN=false to actually delete ${toDelete.length} posts.`)
    return
  }

  // 4. Delete
  let done = 0
  for (const p of toDelete) {
    try { await deletePost(p.id); done++; if (done%10===0) console.log(`  deleted ${done}/${toDelete.length}`) }
    catch(e){ console.error(`  failed #${p.id}: ${e.message}`) }
    await new Promise(r=>setTimeout(r, 600)) // rate-limit friendly
  }
  console.log(`\n✅ Deleted ${done} duplicate posts.`)
}

main().catch(e => { console.error('❌', e); process.exit(1) })
