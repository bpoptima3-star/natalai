// One-time: delete duplicate NatalAI bot posts from Tumblr.
// Handles 429 rate limits with retry+backoff. DRY_RUN defaults TRUE.
const crypto = require('crypto')

const CONSUMER_KEY    = process.env.TUMBLR_CONSUMER_KEY
const CONSUMER_SECRET = process.env.TUMBLR_CONSUMER_SECRET
const OAUTH_TOKEN     = process.env.TUMBLR_OAUTH_TOKEN
const OAUTH_SECRET    = process.env.TUMBLR_OAUTH_TOKEN_SECRET
const TUMBLR_BLOG     = process.env.TUMBLR_BLOG_NAME
const DRY_RUN         = process.env.DRY_RUN !== 'false'
const SIGNATURE       = 'natalai.live'
const MAX_DELETES     = parseInt(process.env.MAX_DELETES || '200', 10)  // cap per run to stay under quota

function enc(s){return encodeURIComponent(String(s)).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase())}
const sleep = ms => new Promise(r=>setTimeout(r, ms))

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

// fetch with 429 retry/backoff
async function apiCall(method, url, params, isGet){
  for (let attempt = 1; attempt <= 6; attempt++) {
    let res, data
    try {
      if (isGet) {
        const qs = Object.keys(params).map(k=>`${enc(k)}=${enc(params[k])}`).join('&')
        res = await fetch(`${url}?${qs}`, { headers: { Authorization: authHeader('GET', url, params) } })
      } else {
        const body = Object.keys(params).map(k=>`${enc(k)}=${enc(params[k])}`).join('&')
        res = await fetch(url, { method:'POST', headers:{ Authorization: authHeader('POST', url, params), 'Content-Type':'application/x-www-form-urlencoded' }, body })
      }
      data = await res.json()
    } catch(e) { data = { meta:{status:0}, _neterr:e.message } }

    const status = data?.meta?.status ?? res?.status ?? 0
    if (status === 429) {
      const wait = Math.min(60000, 5000 * attempt)  // 5s,10s,15s... cap 60s
      console.log(`  ⏳ rate limited — waiting ${wait/1000}s (attempt ${attempt})`)
      await sleep(wait); continue
    }
    return { ok: res?.ok && status < 400, status, data }
  }
  return { ok:false, status:429, data:{ meta:{ msg:'giving up after retries' } } }
}

async function getPosts(offset){
  const url = `https://api.tumblr.com/v2/blog/${TUMBLR_BLOG}/posts`
  const r = await apiCall('GET', url, { limit:'50', offset:String(offset), api_key:CONSUMER_KEY }, true)
  if (!r.ok) throw new Error(`Fetch error: ${JSON.stringify(r.data)}`)
  return r.data.response.posts || []
}

async function deletePost(idString){
  const url = `https://api.tumblr.com/v2/blog/${TUMBLR_BLOG}/post/delete`
  const r = await apiCall('POST', url, { id:String(idString) }, false)
  if (!r.ok) throw new Error(JSON.stringify(r.data))
  return true
}

const pidOf = p => p.id_string || String(p.id)

async function main(){
  console.log(`🧹 Cleanup — DRY_RUN=${DRY_RUN}, max ${MAX_DELETES} deletes this run`)

  let all = [], offset = 0
  while (true) {
    const batch = await getPosts(offset)
    if (!batch.length) break
    all = all.concat(batch); offset += batch.length
    console.log(`  fetched ${all.length}...`)
    await sleep(400)                      // gentle on fetch too
    if (batch.length < 50) break
  }
  console.log(`📚 Total: ${all.length}`)

  const botPosts = all.filter(p => `${p.title||''} ${p.body||''} ${p.summary||''} ${(p.trail||[]).map(t=>t.content_raw||'').join(' ')}`.includes(SIGNATURE))
  console.log(`🤖 Bot posts: ${botPosts.length}`)

  const byTitle = {}
  for (const p of botPosts){ const t=(p.title||p.summary||'').trim().toLowerCase(); (byTitle[t]=byTitle[t]||[]).push(p) }
  const toDelete = []
  for (const t in byTitle){ const g=byTitle[t].sort((a,b)=>(b.timestamp||0)-(a.timestamp||0)); toDelete.push(...g.slice(1)) }
  console.log(`🗑️  Duplicates to delete: ${toDelete.length}`)
  console.log(`✅ Will remain: ${botPosts.length - toDelete.length} bot + ${all.length - botPosts.length} non-bot`)

  if (DRY_RUN){
    console.log('\n--- DRY RUN ---')
    toDelete.slice(0,10).forEach(p=>console.log(`   would delete #${pidOf(p)}: "${p.title||''}"`))
    console.log(`\nRe-run DRY_RUN=false to delete.`)
    return
  }

  const batchToDelete = toDelete.slice(0, MAX_DELETES)
  console.log(`\nDeleting up to ${batchToDelete.length} this run (re-run for the rest)...`)
  let done=0, failed=0
  for (const p of batchToDelete){
    try { await deletePost(pidOf(p)); done++; if(done%10===0) console.log(`  deleted ${done}/${batchToDelete.length}`) }
    catch(e){ failed++; if(failed<=5) console.error(`  failed #${pidOf(p)}: ${e.message}`) }
    await sleep(1200)                     // slower = fewer 429s
  }
  console.log(`\n✅ Deleted ${done}. Failed ${failed}. Remaining duplicates: ~${toDelete.length - done}. Re-run to continue.`)
}

main().catch(e=>{ console.error('❌', e); process.exit(1) })
