/**
 * Contenu éditorial (blog, glossaire, guides) — chargé depuis des fichiers markdown.
 *
 * Un fichier .md par entrée dans content/<collection>/, avec un front-matter YAML minimal.
 * Vite les inline au build via import.meta.glob, donc aucun appel réseau au runtime et le
 * prerender capture le HTML complet — c'est indispensable, les crawlers IA n'exécutent pas JS.
 *
 * Pour ajouter un article : créer le fichier .md, rien d'autre. La route, le sitemap, le
 * prerender et le JSON-LD en découlent (voir scripts/seo-routes.mjs).
 *
 * ⚠️ Une collection n'est indexable qu'à partir de MIN_PUBLISHED entrées. En dessous, le hub
 * existe et est navigable mais reste en noindex et hors sitemap : présenter des pages vides à
 * Google pénalise la qualité perçue de tout le domaine.
 */

import { marked } from 'marked'

/** Seuil d'indexation d'une collection. Doit rester aligné avec scripts/seo-routes.mjs. */
export const MIN_PUBLISHED = 3

export type CollectionKey = 'glossaire' | 'ressources' | 'guides' | 'integrations' | 'cas-usage' | 'clients'

export type CollectionConfig = {
  key: CollectionKey
  basePath: string
  title: string
  intro: string
  /** Type Schema.org des entrées. DefinedTerm pour le glossaire, Article pour le reste. */
  itemSchema: 'DefinedTerm' | 'Article'
  seoTitle: string
  seoDescription: string
}

export const COLLECTIONS: Record<CollectionKey, CollectionConfig> = {
  glossaire: {
    key: 'glossaire',
    basePath: '/glossaire',
    title: 'Glossaire du closing',
    intro:
      "Les définitions du vocabulaire de la vente à distance : closer, setter, high ticket, taux de closing. Des définitions neutres et vérifiables, écrites par CloseOS.",
    itemSchema: 'DefinedTerm',
    seoTitle: 'Glossaire du closing — définitions | CloseOS',
    seoDescription:
      "Toutes les définitions du vocabulaire du closing et de la vente à distance : closer, setter, high ticket, taux de closing, cash collecté, no-show.",
  },
  ressources: {
    key: 'ressources',
    basePath: '/ressources',
    title: 'Ressources',
    intro:
      "Articles et analyses sur la vente à distance, le closing high ticket et le pilotage d'une équipe commerciale.",
    itemSchema: 'Article',
    seoTitle: 'Ressources — closing et vente à distance | CloseOS',
    seoDescription:
      "Articles et analyses sur le closing high ticket, la prospection, le pilotage d'équipe commerciale et les outils de vente.",
  },
  integrations: {
    key: 'integrations',
    basePath: '/integrations',
    title: 'Intégrations',
    intro:
      "CloseOS se connecte nativement à votre stack : CRM en synchronisation bidirectionnelle, agenda, paiement et automatisation no-code. Une page par intégration, avec ce qui est synchronisé et ce qui ne l'est pas.",
    itemSchema: 'Article',
    seoTitle: 'Intégrations CloseOS — HubSpot, Pipedrive, Stripe, Zapier',
    seoDescription:
      "Toutes les intégrations natives de CloseOS : HubSpot, Pipedrive, GoHighLevel, Airtable, iClosed, Google Calendar, Stripe, Calendly, Zapier, Make et n8n.",
  },
  'cas-usage': {
    key: 'cas-usage',
    basePath: '/cas-usage',
    title: "Cas d'usage",
    intro:
      "Comment CloseOS s'utilise concrètement selon votre situation : closer indépendant, infopreneur, Head of Sales ou agence de closing.",
    itemSchema: 'Article',
    seoTitle: "Cas d'usage CloseOS — closer, infopreneur, agence",
    seoDescription:
      "CloseOS selon votre profil : closer indépendant, infopreneur avec une équipe, Head of Sales ou agence de closing. Le détail de ce qui change dans chaque configuration.",
  },
  clients: {
    key: 'clients',
    basePath: '/clients',
    title: 'Études de cas',
    intro:
      "Des équipes qui utilisent CloseOS au quotidien, avec leurs chiffres réels : situation de départ, ce qui a changé, résultat mesuré.",
    itemSchema: 'Article',
    seoTitle: 'Études de cas clients CloseOS',
    seoDescription:
      "Études de cas de closers et d'infopreneurs qui utilisent CloseOS : contexte, mise en place et résultats chiffrés.",
  },
  guides: {
    key: 'guides',
    basePath: '/guides',
    title: 'Guides',
    intro:
      "Guides pratiques, mis à jour dans le temps plutôt que datés : recruter un closer, le rémunérer, suivre les bons KPIs.",
    itemSchema: 'Article',
    seoTitle: 'Guides pratiques du closing | CloseOS',
    seoDescription:
      "Guides pratiques pour recruter un closer, définir sa rémunération, suivre les KPIs de closing et piloter une équipe de vente.",
  },
}

export type ContentEntry = {
  collection: CollectionKey
  slug: string
  title: string
  description: string
  /** Terme défini — glossaire uniquement, sert au schema DefinedTerm. */
  term?: string
  published: string
  updated?: string
  html: string
  /** Corps sans le markdown, pour compter les mots et extraire un résumé. */
  plain: string
}

/** Front-matter minimal : `clé: valeur` par ligne entre deux `---`. Suffisant ici, zéro dépendance. */
function parseFrontMatter(raw: string): { data: Record<string, string>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw)
  if (!match) return { data: {}, body: raw }
  const data: Record<string, string> = {}
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    let value = line.slice(idx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key) data[key] = value
  }
  return { data, body: match[2] }
}

// eager: true — le contenu est inliné dans le bundle, donc présent dès le premier rendu.
// Sans ça le prerender produirait des pages vides.
const FILES = import.meta.glob('/content/*/*.md', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>

function buildEntries(): ContentEntry[] {
  const entries: ContentEntry[] = []
  for (const [path, raw] of Object.entries(FILES)) {
    const m = /^\/content\/([^/]+)\/([^/]+)\.md$/.exec(path)
    if (!m) continue
    const collection = m[1] as CollectionKey
    if (!(collection in COLLECTIONS)) continue

    const { data, body } = parseFrontMatter(raw)
    if (!data.title) continue
    if (data.draft === 'true') continue

    entries.push({
      collection,
      slug: m[2],
      title: data.title,
      description: data.description ?? '',
      term: data.term,
      published: data.published ?? '',
      updated: data.updated,
      html: marked.parse(body, { async: false }) as string,
      plain: body.replace(/[#*_>`[\]()-]/g, ' ').replace(/\s+/g, ' ').trim(),
    })
  }
  return entries
}

/**
 * Résout les liens `[[slug]]` en liens internes une fois toutes les entrées connues.
 * C'est le maillage interne du glossaire : écrire [[setter]] dans un article suffit,
 * le lien et son libellé sont produits automatiquement. Un slug inconnu est laissé en
 * texte brut plutôt que de produire un lien mort.
 */
function resolveWikiLinks(entries: ContentEntry[]): ContentEntry[] {
  const index = new Map(entries.map((e) => [`${e.collection}/${e.slug}`, e]))
  const bySlug = new Map(entries.map((e) => [e.slug, e]))

  const replace = (html: string) =>
    html.replace(/\[\[([a-z0-9-]+(?:\/[a-z0-9-]+)?)\]\]/gi, (whole, ref: string) => {
      const target = index.get(ref) ?? bySlug.get(ref)
      if (!target) return whole.replace(/[[\]]/g, '')
      const cfg = COLLECTIONS[target.collection]
      return `<a href="${cfg.basePath}/${target.slug}">${target.term ?? target.title}</a>`
    })

  return entries.map((e) => ({ ...e, html: replace(e.html), plain: replace(e.plain) }))
}

const ALL = resolveWikiLinks(buildEntries())

export const entriesOf = (collection: CollectionKey): ContentEntry[] =>
  ALL.filter((e) => e.collection === collection).sort((a, b) =>
    a.collection === 'glossaire'
      ? a.title.localeCompare(b.title, 'fr')
      : (b.published || '').localeCompare(a.published || ''),
  )

export const entryOf = (collection: CollectionKey, slug: string): ContentEntry | undefined =>
  ALL.find((e) => e.collection === collection && e.slug === slug)

/** Une collection sous le seuil reste navigable mais non indexable. */
export const isIndexable = (collection: CollectionKey): boolean =>
  entriesOf(collection).length >= MIN_PUBLISHED
