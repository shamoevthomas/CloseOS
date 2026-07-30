/**
 * Rend les maquettes OG en PNG 1200x630.
 *
 * Source : public/og-lab.html — chaque concept est un bloc `.og[data-og="nom"]`
 * de 1200x630 px. Le script ouvre la page dans Chrome headless (via le serveur
 * Vite qui tourne déjà, pour que /logo.png & co résolvent) et screenshote chaque
 * bloc vers public/og/<nom>.png.
 *
 * Usage :  node scripts/og-render.mjs [baseUrl] [page]
 *   node scripts/og-render.mjs                          → http://localhost:5173/og-lab.html
 *   node scripts/og-render.mjs http://localhost:5173 /_masktest.html
 */

import { mkdirSync, existsSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'public', 'og')

const BASE = process.argv[2] || 'http://localhost:5173'
const PAGE = process.argv[3] || '/og-lab.html'

const puppeteer = (await import('puppeteer')).default

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true })

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--force-device-scale-factor=1'],
})

const page = await browser.newPage()
await page.setViewport({ width: 1320, height: 900, deviceScaleFactor: 1 })

const url = `${BASE}${PAGE}`
console.log(`\n📸 ${url}\n`)
await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 })
await page.evaluate(() => document.fonts.ready)
await new Promise(r => setTimeout(r, 400))

const names = await page.$$eval('.og[data-og]', els => els.map(e => e.dataset.og))
if (!names.length) {
  console.log('⚠️  Aucun bloc .og[data-og] trouvé.')
  await browser.close()
  process.exit(1)
}

const ko = f => Math.round(statSync(f).size / 1024)

for (const name of names) {
  const el = await page.$(`.og[data-og="${name}"]`)
  const png = join(OUT, `${name}.png`)
  const jpg = join(OUT, `${name}.jpg`)
  await el.screenshot({ path: png })
  await el.screenshot({ path: jpg, type: 'jpeg', quality: 90 })
  // Les aplats compressent mieux en PNG, les dégradés en JPEG : on garde le plus léger des deux.
  const [kp, kj] = [ko(png), ko(jpg)]
  console.log(`  ✓ ${name}  png ${kp} Ko · jpg ${kj} Ko  → garder ${kj < kp ? 'le .jpg' : 'le .png'}`)
}

await browser.close()
console.log(`\n✅ ${names.length} visuels dans public/og/\n`)
