/**
 * Notifie IndexNow (Bing, Yandex, Naver, Seznam) des URLs publiees.
 *
 * IndexNow ne demande AUCUN compte : il suffit d'heberger un fichier cle a la
 * racine du domaine et de poster la liste d'URLs. Bing Copilot s'appuyant sur
 * l'index Bing, c'est le moyen le plus direct d'y faire connaitre les nouvelles
 * pages sans attendre un crawl.
 *
 * Usage : node scripts/indexnow.mjs           (toutes les URLs des sitemaps)
 *         node scripts/indexnow.mjs --dry-run (affiche sans envoyer)
 */

import { routesForHost } from './seo-routes.mjs'

const KEY = 'e357b4487c37f2da2a6ab294edccddd2'
const HOSTS = [
  { host: 'www.closeos.fr', routes: routesForHost('www') },
  { host: 'sign.closeos.fr', routes: routesForHost('sign') },
]

const dry = process.argv.includes('--dry-run')

for (const { host, routes } of HOSTS) {
  const urlList = routes.map((r) => r.canonical)
  const payload = {
    host,
    key: KEY,
    keyLocation: `https://${host}/${KEY}.txt`,
    urlList,
  }

  console.log(`\n${host} — ${urlList.length} URLs`)
  if (dry) {
    urlList.forEach((u) => console.log('   ' + u))
    continue
  }

  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  })
  // 200 = accepte, 202 = accepte mais cle en cours de validation
  console.log(`  -> HTTP ${res.status} ${res.status === 200 || res.status === 202 ? '✅' : '❌ ' + (await res.text())}`)
}
