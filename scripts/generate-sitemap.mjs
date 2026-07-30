/**
 * Génère les sitemaps à partir de scripts/seo-routes.mjs — la même liste que le prerender.
 *
 * Pourquoi générer plutôt que maintenir public/sitemap.xml à la main :
 * le fichier statique dérivait du routeur (URLs non canoniques listées, URL inter-domaines
 * invalide, /sign/securite absent). Une seule source évite toute la classe de bugs.
 *
 * Deux fichiers, parce que CloseOS Sign vit sur son propre hôte et qu'un sitemap ne peut
 * lister que des URLs de son propre domaine :
 *   dist/sitemap.xml       → URLs www.closeos.fr
 *   dist/sitemap-sign.xml  → URLs sign.closeos.fr
 * Les deux sont déclarés dans public/robots.txt. La cross-submission entre sous-domaines est
 * valide dès lors que les hôtes appartiennent à la même propriété Search Console (propriété
 * de domaine `closeos.fr`, qui couvre www et sign).
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { routesForHost } from './seo-routes.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST = join(__dirname, '..', 'dist')

function buildSitemap(routes) {
  const urls = routes
    .map((r) => [
      '  <url>',
      `    <loc>${r.canonical}</loc>`,
      `    <lastmod>${r.lastmod}</lastmod>`,
      `    <changefreq>${r.changefreq}</changefreq>`,
      `    <priority>${r.priority}</priority>`,
      '  </url>',
    ].join('\n'))
    .join('\n')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!-- Généré par scripts/generate-sitemap.mjs — ne pas éditer à la main -->',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>',
    '',
  ].join('\n')
}

function main() {
  if (!existsSync(DIST)) mkdirSync(DIST, { recursive: true })

  const targets = [
    { file: 'sitemap.xml', routes: routesForHost('www') },
    { file: 'sitemap-sign.xml', routes: routesForHost('sign') },
  ]

  // Une URL ne doit jamais apparaître dans deux sitemaps, ni deux fois dans le même.
  const seen = new Set()
  for (const { file, routes } of targets) {
    for (const r of routes) {
      if (seen.has(r.canonical)) {
        console.error(`❌ Sitemap : URL canonique en double — ${r.canonical}`)
        process.exit(1)
      }
      seen.add(r.canonical)
    }
    writeFileSync(join(DIST, file), buildSitemap(routes), 'utf-8')
    console.log(`  ✅ dist/${file} — ${routes.length} URLs`)
  }
}

console.log('\n🗺️  Génération des sitemaps...\n')
main()
console.log('')
