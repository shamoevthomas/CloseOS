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

import puppeteer from 'puppeteer-core'
import { createServer } from 'http'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { PRERENDER_ROUTES } from './seo-routes.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST = join(__dirname, '..', 'dist')
const PORT = 4173

// Liste unique, partagée avec la génération des sitemaps (scripts/seo-routes.mjs).
// N'ajoutez pas de route ici : ajoutez-la au manifeste.
const ROUTES = PRERENDER_ROUTES

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

  // Use @sparticuz/chromium on CI (Vercel), local Chrome otherwise
  let browser
  try {
    const chromium = await import('@sparticuz/chromium')
    const executablePath = await chromium.default.executablePath()
    browser = await puppeteer.launch({
      args: chromium.default.args,
      defaultViewport: chromium.default.defaultViewport,
      executablePath,
      headless: true,
    })
    console.log('  Using @sparticuz/chromium')
  } catch {
    // Fallback: local Chrome (dev machine)
    const localPuppeteer = await import('puppeteer')
    browser = await localPuppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    console.log('  Using local Chrome')
  }

  // Garde-fou anti-régression : ce que chaque page pose réellement dans le <head> est comparé
  // à ce que le manifeste déclare. Sans ça, le prerender peut publier des métas qui ne
  // correspondent plus au routeur — c'est exactement ce qui est arrivé à /sales (page prérendue
  // = choix d'écosystème, canonique pointant vers /, donc URL indexée qui s'auto-annule).
  const failures = []
  const seenTitles = new Map()
  const seenCanonicals = new Map()

  for (const entry of ROUTES) {
    const route = entry.path
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

    // ── Contrôles SEO ────────────────────────────────────────────────────────
    const seen = await page.evaluate(() => {
      const root = document.getElementById('root')
      const h1s = root ? Array.from(root.querySelectorAll('h1')) : []
      return {
        title: document.title || '',
        description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
        canonical: document.getElementById('canonical')?.getAttribute('href') || '',
        h1Count: h1s.length,
        h1: (h1s[0]?.textContent || '').replace(/\s+/g, ' ').trim(),
      }
    })

    const fail = (msg) => failures.push(`${route} — ${msg}`)

    if (!seen.title || seen.title.includes('undefined')) fail(`<title> vide ou invalide : "${seen.title}"`)
    if (entry.title && !entry.title.test(seen.title)) {
      fail(`<title> inattendu.\n      attendu (regex) : ${entry.title}\n      obtenu          : "${seen.title}"`)
    }

    if (!seen.description) fail('meta description absente')

    // Le contrôle décisif : la canonique servie doit être celle déclarée au manifeste.
    if (seen.canonical !== entry.canonical) {
      fail(`canonique incorrecte.\n      attendu : ${entry.canonical}\n      obtenu  : ${seen.canonical || '(aucune)'}`)
    }

    if (seen.h1Count === 0) fail('aucun <h1> dans #root')
    // Plusieurs <h1> est un défaut mineur : on avertit sans bloquer un déploiement pour ça.
    if (seen.h1Count > 1) console.warn(`  ⚠️  ${route} — ${seen.h1Count} <h1> dans #root (un seul recommandé)`)
    if (entry.h1 && !entry.h1.test(seen.h1)) {
      fail(`<h1> inattendu.\n      attendu (regex) : ${entry.h1}\n      obtenu          : "${seen.h1}"`)
    }

    // Deux routes publiques ne peuvent pas partager le même titre ni la même canonique :
    // c'est la signature d'une duplication (cas /, /sales et /landing).
    if (seenTitles.has(seen.title)) fail(`<title> identique à ${seenTitles.get(seen.title)}`)
    else seenTitles.set(seen.title, route)
    if (seenCanonicals.has(seen.canonical)) fail(`canonique identique à ${seenCanonicals.get(seen.canonical)}`)
    else seenCanonicals.set(seen.canonical, route)

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

  if (failures.length) {
    console.error('\n❌ Contrôles SEO en échec — build interrompu :\n')
    for (const f of failures) console.error(`   • ${f}`)
    console.error(
      '\n   Le HTML prérendu ne correspond pas à scripts/seo-routes.mjs.\n' +
      '   Soit la page a changé et le manifeste doit suivre, soit le routeur\n' +
      '   ne sert plus la page attendue sur cette URL.\n',
    )
    // process.exit direct : un throw serait avalé par le catch « Chrome indisponible »
    // en bas de fichier, qui doit rester tolérant sur CI mais pas masquer une régression SEO.
    process.exit(1)
  }

  console.log(`\n✅ Prerendered ${ROUTES.length} pages successfully!\n`)
}

prerender().catch((err) => {
  console.warn('⚠️  Prerender skipped:', err.message || err)
  console.warn('   Build will continue without prerendered HTML.')
  console.warn('   This is expected on Vercel CI (no Chrome available).')
  process.exit(0)
})
