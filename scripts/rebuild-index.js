// Rebuild blog/index.html from deduped articles.json + delete orphan HTML
const fs = require('fs'), path = require('path')
const DIR = path.join(__dirname, '..', 'blog')
const articles = JSON.parse(fs.readFileSync(path.join(DIR, 'articles.json'), 'utf8'))
const validSlugs = new Set(articles.map(a => a.slug))

// 1. delete any blog/*.html not in the manifest (except index.html)
let removed = 0
for (const f of fs.readdirSync(DIR)) {
  if (!f.endsWith('.html') || f === 'index.html') continue
  const slug = f.replace(/\.html$/, '')
  if (!validSlugs.has(slug)) { fs.unlinkSync(path.join(DIR, f)); removed++; console.log(`  deleted orphan ${f}`) }
}

// 2. rebuild index.html using blog-agent's own template
const agent = fs.readFileSync(path.join(__dirname, 'blog-agent.js'), 'utf8')
const fn = agent.match(/function buildIndexHtml[\s\S]*?\n}\n/)[0]
const buildIndexHtml = eval('(' + fn.replace('function buildIndexHtml', 'function') + ')')
fs.writeFileSync(path.join(DIR, 'index.html'), buildIndexHtml(articles))

console.log(`✓ Deleted ${removed} orphan HTML. Rebuilt index.html with ${articles.length} articles.`)
