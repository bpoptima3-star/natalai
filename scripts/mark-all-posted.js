const fs = require('fs')
const path = require('path')
const FILE = path.join(__dirname, '..', 'blog', 'articles.json')

const articles = JSON.parse(fs.readFileSync(FILE, 'utf8'))
let changed = 0
for (const a of articles) {
  if (!a.tumblr_posted_at) {
    a.tumblr_posted_at = new Date().toISOString()
    a.tumblr_post_id = a.tumblr_post_id || 'backfill-skipped'
    delete a.tumblr_error
    changed++
  }
}
fs.writeFileSync(FILE, JSON.stringify(articles, null, 2))
console.log(`✓ Marked ${changed} existing articles as posted. Only new articles will post from now.`)
