/**
 * Source de vérité unique des routes publiques indexables de CloseOS.
 *
 * Consommée par :
 *  - scripts/prerender.mjs      → routes à prérendre + garde-fou anti-régression
 *  - scripts/generate-sitemap.mjs → sitemap.xml (www) et sitemap-sign.xml (sous-domaine Sign)
 *
 * ⚠️ Toute nouvelle page publique s'ajoute ICI, et nulle part ailleurs. C'est ce qui empêche
 * le sitemap et le prerender de diverger du routeur (bug constaté sur /sales en juillet 2026 :
 * la route servait la page de choix d'écosystème alors que App.tsx pointait sur LandingPage).
 *
 * Champs :
 *  host       'www' | 'sign' — détermine le sitemap de destination et le domaine canonique
 *  canonical  URL canonique ATTENDUE. Le garde-fou compare à l'octet près ce que la page pose
 *             réellement dans <link rel="canonical">. C'est le contrôle qui aurait attrapé
 *             la chaîne de canoniques cassée de Sign et l'auto-annulation de /sales.
 *  prerender  false = présent dans le sitemap mais pas prérendu (pages légales, faible enjeu)
 *  title/h1   regex de contrôle. Optionnelles : omises quand la formulation n'est pas figée.
 *             Le garde-fou exige de toute façon un <h1> non vide et un <title> exploitable.
 *  lastmod    date de dernière modification RÉELLE du contenu. Volontairement pas la date de
 *             build : un lastmod qui bouge à chaque déploiement est ignoré par Google.
 */

export const WWW = 'https://www.closeos.fr'
export const SIGN = 'https://sign.closeos.fr'

export const PUBLIC_ROUTES = [
  // ── Landings ────────────────────────────────────────────────────────────────
  {
    path: '/', host: 'www', canonical: `${WWW}/`,
    lastmod: '2026-07-30', priority: '1.0', changefreq: 'weekly',
    title: /écosystème|ecosystem/i, h1: /closers/i,
  },
  {
    // URL canonique de la landing Sales. /landing redirige ici en 301 (voir vercel.json).
    path: '/sales', host: 'www', canonical: `${WWW}/sales`,
    lastmod: '2026-07-30', priority: '1.0', changefreq: 'weekly',
    title: /CloseOS Sales/i, h1: /CRM/i,
  },
  {
    path: '/business', host: 'www', canonical: `${WWW}/business`,
    lastmod: '2026-07-30', priority: '1.0', changefreq: 'weekly',
    title: /CloseOS Business/i, h1: /équipe|team/i,
  },
  {
    // Sign est un produit autonome sur son sous-domaine : sa canonique vit sur sign.closeos.fr.
    // www.closeos.fr/sign redirige en 301 vers cette URL (voir vercel.json).
    path: '/sign', host: 'sign', canonical: `${SIGN}/sign`,
    lastmod: '2026-07-30', priority: '1.0', changefreq: 'weekly',
    title: /CloseOS Sign/i, h1: /Signez le contrat|Sign the contract/i,
  },

  // ── Conversion ──────────────────────────────────────────────────────────────
  {
    path: '/tarifs', host: 'www', canonical: `${WWW}/tarifs`,
    lastmod: '2026-07-30', priority: '0.9', changefreq: 'monthly',
    title: /Tarifs CloseOS/i,
  },
  {
    path: '/fonctionnalites', host: 'www', canonical: `${WWW}/fonctionnalites`,
    lastmod: '2026-07-30', priority: '0.8', changefreq: 'monthly',
    title: /Fonctionnalités CloseOS/i, h1: /fonctionnalités|features/i,
  },
  {
    path: '/fonctionnalites/crm-closer', host: 'www', canonical: `${WWW}/fonctionnalites/crm-closer`,
    lastmod: '2026-07-30', priority: '0.8', changefreq: 'monthly',
    title: /CRM Closer/i,
  },
  {
    // Hub des comparatifs. Indexable immediatement : ses deux enfants sont publies,
    // et la page porte un contenu propre (methode, tableau de couverture).
    path: '/comparatifs', host: 'www', canonical: `${WWW}/comparatifs`,
    lastmod: '2026-07-30', priority: '0.8', changefreq: 'monthly',
    title: /Comparatifs CloseOS/i, h1: /face aux autres outils/i,
  },
  {
    path: '/comparatifs/alternative-iclosed', host: 'www', canonical: `${WWW}/comparatifs/alternative-iclosed`,
    lastmod: '2026-07-30', priority: '0.7', changefreq: 'monthly',
    title: /Alternative à iClosed/i,
  },
  {
    path: '/comparatifs/closeos-vs-iclosed', host: 'www', canonical: `${WWW}/comparatifs/closeos-vs-iclosed`,
    lastmod: '2026-07-30', priority: '0.7', changefreq: 'monthly',
    title: /CloseOS vs iClosed/i,
  },

  // ── Notes de version ────────────────────────────────────────────────────────
  {
    // Seule page publique qui énonce un numéro de version. Sans elle, la seule source
    // indexée au monde restait un post LinkedIn annonçant la V3 : Perplexity répondait
    // « les informations disponibles s'arrêtent à la V3 » (constaté le 31/07/2026).
    path: '/nouveautes', host: 'www', canonical: `${WWW}/nouveautes`,
    lastmod: '2026-07-31', priority: '0.6', changefreq: 'monthly',
    title: /Nouveautés CloseOS/i, h1: /V5/,
  },

  // ── Sign : confiance & conformité ───────────────────────────────────────────
  {
    // Page de confiance majeure sur un produit de signature électronique.
    // Existait en route depuis des mois sans être ni indexée ni dans le sitemap.
    path: '/sign/securite', host: 'sign', canonical: `${SIGN}/sign/securite`,
    lastmod: '2026-07-30', priority: '0.6', changefreq: 'monthly',
    title: /Sécurité technique|Technical Security/i,
  },
  {
    path: '/sign/cgv', host: 'sign', canonical: `${SIGN}/sign/cgv`,
    lastmod: '2026-07-30', priority: '0.3', changefreq: 'yearly',
  },
  {
    path: '/sign/confidentialite', host: 'sign', canonical: `${SIGN}/sign/confidentialite`,
    lastmod: '2026-07-30', priority: '0.3', changefreq: 'yearly',
  },

  // ── Légal www ───────────────────────────────────────────────────────────────
  {
    path: '/mentions-legales', host: 'www', canonical: `${WWW}/mentions-legales`,
    lastmod: '2026-03-23', priority: '0.3', changefreq: 'yearly',
  },
  {
    path: '/cgu', host: 'www', canonical: `${WWW}/cgu`,
    lastmod: '2026-03-23', priority: '0.3', changefreq: 'yearly',
  },
  {
    path: '/cgv', host: 'www', canonical: `${WWW}/cgv`,
    lastmod: '2026-03-23', priority: '0.3', changefreq: 'yearly',
  },
  {
    path: '/confidentialite', host: 'www', canonical: `${WWW}/confidentialite`,
    lastmod: '2026-03-23', priority: '0.3', changefreq: 'yearly',
  },
  {
    path: '/business/politique-utilisation', host: 'www', canonical: `${WWW}/business/politique-utilisation`,
    lastmod: '2026-03-23', priority: '0.3', changefreq: 'yearly',
  },
]

// ── Contenu éditorial (content/*.md) ────────────────────────────────────────────
// Les routes du glossaire, des ressources et des guides sont dérivées des fichiers
// markdown sur disque : ajouter un .md suffit, le sitemap et le prerender suivent.
//
// Seuil : une collection n'entre au sitemap et au prerender qu'à partir de 3 entrées
// publiées. En dessous, le hub existe et est navigable mais reste en noindex — la même
// règle est appliquée côté application par src/content/collections.ts (MIN_PUBLISHED).
// Les deux valeurs doivent rester alignées.

import { readdirSync, readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const CONTENT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'content')
const MIN_PUBLISHED = 3

const COLLECTIONS = [
  { dir: 'glossaire', base: '/glossaire', priority: '0.6', changefreq: 'monthly' },
  { dir: 'ressources', base: '/ressources', priority: '0.7', changefreq: 'weekly' },
  { dir: 'guides', base: '/guides', priority: '0.7', changefreq: 'monthly' },
  { dir: 'integrations', base: '/integrations', priority: '0.7', changefreq: 'monthly' },
  { dir: 'cas-usage', base: '/cas-usage', priority: '0.7', changefreq: 'monthly' },
  { dir: 'clients', base: '/clients', priority: '0.8', changefreq: 'monthly' },
]

function frontMatter(raw) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw)
  if (!m) return {}
  const out = {}
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':')
    if (i === -1) continue
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
  return out
}

function contentRoutes() {
  const routes = []
  for (const col of COLLECTIONS) {
    const dir = join(CONTENT_DIR, col.dir)
    if (!existsSync(dir)) continue

    const entries = readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => ({ slug: f.replace(/\.md$/, ''), fm: frontMatter(readFileSync(join(dir, f), 'utf-8')) }))
      .filter((e) => e.fm.title && e.fm.draft !== 'true')

    if (entries.length < MIN_PUBLISHED) continue // collection encore trop maigre : noindex

    routes.push({
      path: col.base,
      host: 'www',
      canonical: `${WWW}${col.base}`,
      lastmod: entries.map((e) => e.fm.updated || e.fm.published || '').sort().pop() || '2026-07-30',
      priority: '0.7',
      changefreq: col.changefreq,
    })

    for (const e of entries) {
      routes.push({
        path: `${col.base}/${e.slug}`,
        host: 'www',
        canonical: `${WWW}${col.base}/${e.slug}`,
        lastmod: e.fm.updated || e.fm.published || '2026-07-30',
        priority: col.priority,
        changefreq: col.changefreq,
        h1: new RegExp(escapeRegExp(e.fm.term || e.fm.title), 'i'),
      })
    }
  }
  return routes
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const CONTENT_ROUTES = contentRoutes()

/** Toutes les routes publiques : statiques + contenu éditorial. */
export const ALL_ROUTES = [...PUBLIC_ROUTES, ...CONTENT_ROUTES]

/** Routes effectivement prérendues (celles qui portent l'enjeu SEO). */
export const PRERENDER_ROUTES = ALL_ROUTES.filter((r) => r.prerender !== false)

/** Routes d'un hôte donné, pour la génération des sitemaps. */
export const routesForHost = (host) => ALL_ROUTES.filter((r) => r.host === host)
