/**
 * Prerender script for CloseOS public pages.
 *
 * After `vite build`, this script:
 * 1. Serves the dist/ folder locally
 * 2. Opens each public route in headless Chrome (via Puppeteer)
 * 3. Waits for React to finish rendering (including useEffect meta tags)
 * 4. Saves the full HTML to the correct path so Vercel serves it statically
 *
 * Result: crawlers (Google, Bing, ChatGPT, Perplexity…) receive the real
 * page content instead of an empty <div id="root"></div>.
 */

import { launch } from 'puppeteer'
import { createServer } from 'http'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST = join(__dirname, '..', 'dist')
const PORT = 4173

// Pages to prerender (public, SEO-critical)
const ROUTES = ['/', '/landing', '/business', '/tarifs', '/fonctionnalites', '/fonctionnalites/crm-closer', '/comparatifs/alternative-iclosed', '/comparatifs/closeos-vs-iclosed']

// Serve dist/ folder as a static HTTP server
function startServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let url = req.url.split('?')[0]

      // Try exact file first
      let filePath = join(DIST, url)

      // If it's a directory or doesn't have extension, serve index.html (SPA fallback)
      if (!url.includes('.')) {
        // Check if a prerendered file exists at url/index.html
        const dirIndex = join(DIST, url, 'index.html')
        if (existsSync(dirIndex)) {
          filePath = dirIndex
        } else {
          filePath = join(DIST, 'index.html')
        }
      }

      try {
        const content = readFileSync(filePath)
        const ext = filePath.split('.').pop()
        const types = {
          html: 'text/html',
          js: 'application/javascript',
          css: 'text/css',
          png: 'image/png',
          jpg: 'image/jpeg',
          svg: 'image/svg+xml',
          json: 'application/json',
          woff2: 'font/woff2',
          woff: 'font/woff',
          ttf: 'font/ttf',
        }
        res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' })
        res.end(content)
      } catch {
        // SPA fallback
        const fallback = readFileSync(join(DIST, 'index.html'))
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(fallback)
      }
    })

    server.listen(PORT, () => {
      console.log(`  Static server running on http://localhost:${PORT}`)
      resolve(server)
    })
  })
}

async function prerender() {
  console.log('\n🔧 Prerendering public pages...\n')

  const server = await startServer()

  const browser = await launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  for (const route of ROUTES) {
    const url = `http://localhost:${PORT}${route}`
    console.log(`  Rendering ${route} ...`)

    const page = await browser.newPage()

    // Set a French locale so the language detection picks FR
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'fr-FR,fr;q=0.9' })
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'language', { get: () => 'fr-FR' })
      Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr'] })
      // Set timezone to Paris for detectSalesLang()
      Intl.DateTimeFormat = class extends Intl.DateTimeFormat {
        resolvedOptions() {
          return { ...super.resolvedOptions(), timeZone: 'Europe/Paris' }
        }
      }
    })

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 })

    // Wait for React to render content inside #root
    await page.waitForSelector('#root *', { timeout: 10000 })

    // Extra wait for useEffect SEO meta tags to settle
    await page.waitForFunction(() => {
      const title = document.title
      return title && title !== '' && !title.includes('undefined')
    }, { timeout: 5000 }).catch(() => {})

    // Small extra delay for any remaining async effects
    await new Promise((r) => setTimeout(r, 500))

    // Get the full rendered HTML
    const html = await page.content()

    // Determine output path
    let outPath
    if (route === '/') {
      outPath = join(DIST, 'index.html')
    } else {
      outPath = join(DIST, route.slice(1), 'index.html')
      mkdirSync(dirname(outPath), { recursive: true })
    }

    writeFileSync(outPath, html, 'utf-8')
    console.log(`  ✅ Saved ${outPath.replace(DIST, 'dist')}`)

    await page.close()
  }

  await browser.close()
  server.close()

  console.log(`\n✅ Prerendered ${ROUTES.length} pages successfully!\n`)
}

prerender().catch((err) => {
  console.error('❌ Prerender failed:', err)
  process.exit(1)
})
