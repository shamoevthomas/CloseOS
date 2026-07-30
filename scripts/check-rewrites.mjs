/**
 * Verifie que le catch-all SPA de vercel.json se comporte comme prevu.
 *
 * Pourquoi ce garde-fou : le catch-all etait `/(.*)` -> /index.html, sans exception.
 * Consequence, toute URL inexistante repondait 200 avec la coquille HTML — y compris
 * /rsl.xml, /llms-full.txt ou /wp-config.php. Un crawler qui demande un fichier recevait
 * une page web au lieu d'un 404 : soft 404 generalise, budget de crawl gaspille, et pour
 * un crawler IA (qui n'execute pas JS) aucune facon de savoir que la page n'existe pas.
 *
 * Le motif exclut desormais les chemins portant une extension de fichier. Ce motif est
 * fragile a editer : une erreur de regex casse TOUTES les routes de l'application d'un
 * coup. D'ou ce test, qui tourne au build avec le meme moteur que Vercel (path-to-regexp).
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { pathToRegexp } from 'path-to-regexp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const cfg = JSON.parse(readFileSync(join(__dirname, '..', 'vercel.json'), 'utf-8'))

const spa = cfg.rewrites
  .filter((r) => r.destination === '/index.html')
  .map((r) => ({ source: r.source, re: pathToRegexp(r.source) }))

const servedBySpa = (p) => spa.some((x) => x.re.test(p))

// Routes applicatives : doivent etre servies par la SPA.
const MUST_MATCH = [
  '/', '/sales', '/business', '/tarifs', '/sign', '/sign/securite', '/sign/cgv',
  '/fonctionnalites', '/fonctionnalites/crm-closer',
  '/comparatifs/closeos-vs-iclosed', '/comparatifs/alternative-iclosed',
  '/mentions-legales', '/cgu', '/cgv', '/confidentialite',
  '/login', '/register', '/business/dashboard', '/business/login',
  '/book/mon-slug', '/capture/mon-slug', '/f/mon-formulaire', '/c/mon-slug',
  '/sign/s/token-abc', '/sign/app/contrats', '/appointment/token-abc', '/view/token-abc',
  '/url-inconnue-mais-sans-extension',
]

// Chemins de fichiers : ne doivent PAS etre reecrits. S'ils existent, le systeme de
// fichiers les sert ; sinon, Vercel renvoie un vrai 404.
const MUST_NOT_MATCH = [
  '/robots.txt', '/sitemap.xml', '/sitemap-sign.xml', '/llms.txt', '/llms-full.txt',
  '/rsl.xml', '/.well-known/rsl.xml', '/countries.geojson',
  '/assets/index-abc123.js', '/assets/index-abc123.css', '/og-sales.jpg',
  '/favicon-32x32.png', '/apple-touch-icon.png', '/closeos-logo.png',
  '/fichier-inexistant.txt', '/wp-config.php', '/.env', '/config.yml',
]

const failures = []
for (const p of MUST_MATCH) if (!servedBySpa(p)) failures.push(`${p} devrait etre servi par la SPA`)
for (const p of MUST_NOT_MATCH) if (servedBySpa(p)) failures.push(`${p} ne devrait PAS etre reecrit (soft 404)`)

if (failures.length) {
  console.error('\n❌ vercel.json — catch-all SPA incorrect :\n')
  for (const f of failures) console.error(`   • ${f}`)
  console.error('\n   Verifiez le motif "source" du rewrite vers /index.html.\n')
  process.exit(1)
}

console.log(`  ✅ Catch-all SPA : ${MUST_MATCH.length} routes servies, ${MUST_NOT_MATCH.length} chemins de fichiers exclus`)
