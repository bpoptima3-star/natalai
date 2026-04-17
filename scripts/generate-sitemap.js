// NatalAI Sitemap Generator
// Runs after every blog agent publish
// Generates sitemap.xml from articles.json + static pages

const fs   = require('fs')
const path = require('path')

const ARTICLES_FILE = path.join(__dirname, '..', 'blog', 'articles.json')
const SITEMAP_FILE  = path.join(__dirname, '..', 'sitemap.xml')
const BASE_URL      = 'https://natalai.live'

function generateSitemap() {
  const articles = fs.existsSync(ARTICLES_FILE)
    ? JSON.parse(fs.readFileSync(ARTICLES_FILE, 'utf8'))
    : []

  const today = new Date().toISOString().split('T')[0]

  // Static pages
  const staticPages = [
    { url: '/',                  priority: '1.0', changefreq: 'weekly'  },
    { url: '/blog',              priority: '0.9', changefreq: 'daily'   },
    { url: '/privacy-policy',    priority: '0.3', changefreq: 'monthly' },
  ]

  // Article pages
  const articlePages = articles.map(a => ({
    url:        `/blog/${a.slug}.html`,
    lastmod:    a.date ? a.date.split('T')[0] : today,
    priority:   '0.8',
    changefreq: 'monthly',
  }))

  const allPages = [...staticPages, ...articlePages]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages.map(p => `  <url>
    <loc>${BASE_URL}${p.url}</loc>
    ${p.lastmod ? `<lastmod>${p.lastmod}</lastmod>` : `<lastmod>${today}</lastmod>`}
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n')}
</urlset>`

  fs.writeFileSync(SITEMAP_FILE, xml)
  console.log(`✓ Sitemap generated with ${allPages.length} URLs → sitemap.xml`)
}

generateSitemap()
