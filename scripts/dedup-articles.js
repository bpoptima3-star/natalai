const fs = require('fs'), path = require('path')
const DIR = path.join(__dirname, '..', 'blog')
const FILE = path.join(DIR, 'articles.json')
const articles = JSON.parse(fs.readFileSync(FILE, 'utf8'))

const seen = new Set(), keep = [], removed = []
for (const a of articles) {
  const key = (a.title||'').trim().toLowerCase()
  if (seen.has(key)) { removed.push(a); continue }
  seen.add(key); keep.push(a)
}
// delete orphaned HTML files of removed dupes (only if no kept article shares the slug)
const keptSlugs = new Set(keep.map(a => a.slug))
for (const r of removed) {
  const f = path.join(DIR, `${r.slug}.html`)
  if (!keptSlugs.has(r.slug) && fs.existsSync(f)) { fs.unlinkSync(f); console.log(`  deleted ${r.slug}.html`) }
}
fs.writeFileSync(FILE, JSON.stringify(keep, null, 2))
console.log(`✓ Removed ${removed.length} duplicate entries. ${keep.length} articles remain.`)
