/**
 * Page d'une entrée éditoriale : /glossaire/:slug, /ressources/:slug, /guides/:slug.
 * DA Business (fond #f4f2f1, cartes blanches, doodles).
 *
 * Le contenu vient du markdown ; la page ajoute le SEO, le schema (DefinedTerm pour un terme
 * de glossaire, Article sinon) et le maillage vers les entrées voisines.
 */

import { Link, useParams } from 'react-router-dom'
import NotFound from '../NotFound'
import { COLLECTIONS, entriesOf, entryOf, isIndexable, type CollectionKey } from '../../content/collections'
import { ContentShell, useContentSeo, DoodleTitle, CARD, BTN_PRIMARY, BTN_GHOST, PROSE_CLASS, PROSE_STYLES } from './ContentShell'
import { DoodleRocket, DoodleArrow } from '../../components/doodles'

const SITE = 'https://www.closeos.fr'

export default function ContentEntryPage({ collection }: { collection: CollectionKey }) {
  const { slug = '' } = useParams()
  const cfg = COLLECTIONS[collection]
  const entry = entryOf(collection, slug)

  // Un slug inconnu doit se comporter comme une 404, pas rendre une page vide indexable.
  if (!entry) return <NotFound />

  const url = `${SITE}${cfg.basePath}/${entry.slug}`
  const indexable = isIndexable(collection)
  const siblings = entriesOf(collection).filter((e) => e.slug !== entry.slug).slice(0, 4)
  const label = entry.term ?? entry.title
  // Mot souligné = dernier mot du titre. Si le titre se termine par une ponctuation
  // détachée (« … en premier ? »), on reprend le mot qui la précède : souligner un point
  // d'interrogation seul donne une vague minuscule et incompréhensible.
  const words = label.trim().split(/\s+/)
  const tailLen = words.length > 1 && /^[?!.…:;»"'—–-]+$/.test(words[words.length - 1]) ? 2 : 1
  const head = words.slice(0, words.length - tailLen).join(' ')
  const lastWord = words.slice(words.length - tailLen).join(' ')

  const itemLd =
    cfg.itemSchema === 'DefinedTerm'
      ? {
          '@context': 'https://schema.org',
          '@type': 'DefinedTerm',
          '@id': `${url}#term`,
          name: label,
          description: entry.description,
          url,
          inLanguage: 'fr',
          inDefinedTermSet: {
            '@type': 'DefinedTermSet',
            '@id': `${SITE}${cfg.basePath}#termset`,
            name: cfg.title,
            url: `${SITE}${cfg.basePath}`,
          },
        }
      : {
          '@context': 'https://schema.org',
          '@type': 'Article',
          '@id': `${url}#article`,
          headline: entry.title,
          description: entry.description,
          url,
          inLanguage: 'fr',
          datePublished: entry.published || undefined,
          dateModified: entry.updated || entry.published || undefined,
          author: { '@type': 'Person', '@id': `${SITE}/#founder`, name: 'Thomas Shamoev' },
          publisher: { '@id': `${SITE}/#organization` },
          mainEntityOfPage: url,
        }

  useContentSeo({
    title: `${label} — ${cfg.title} | CloseOS`,
    description: entry.description,
    path: `${cfg.basePath}/${entry.slug}`,
    indexable,
    jsonLd: [
      itemLd,
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'CloseOS', item: SITE },
          { '@type': 'ListItem', position: 2, name: cfg.title, item: `${SITE}${cfg.basePath}` },
          { '@type': 'ListItem', position: 3, name: label, item: url },
        ],
      },
    ],
  })

  return (
    <ContentShell breadcrumb={{ label: cfg.title, to: cfg.basePath }}>
      <style>{PROSE_STYLES}</style>

      <article>
        {/* Le trait ondulé ne couvre que le DERNIER MOT : appliqué au titre entier, le SVG
            (ratio 240×18) grandit en hauteur avec la largeur et barre la seconde ligne
            des titres longs. */}
        <DoodleTitle squiggle={lastWord}>{head}</DoodleTitle>

        {entry.description && (
          <p className="mt-8 max-w-2xl text-lg font-medium leading-relaxed text-stone-700">
            {entry.description}
          </p>
        )}

        {(entry.updated || entry.published) && (
          <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-stone-400">
            <span>
              {entry.updated ? 'Mis à jour le ' : 'Publié le '}
              {entry.updated || entry.published}
            </span>
            <span>&middot;</span>
            <span>Thomas Shamoev, fondateur de CloseOS</span>
          </p>
        )}

        <div className={`mt-10 ${PROSE_CLASS}`} dangerouslySetInnerHTML={{ __html: entry.html }} />
      </article>

      {siblings.length > 0 && (
        <nav className="mt-16 border-t border-stone-200 pt-8">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-stone-400">À lire aussi</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {siblings.map((s) => (
              <li key={s.slug}>
                <Link to={`${cfg.basePath}/${s.slug}`} className={`group block ${CARD} !p-4`}>
                  <span className="flex items-center gap-2 font-bold text-[#111111]">
                    {s.term ?? s.title}
                    <DoodleArrow className="w-4 -translate-x-1 text-amber-500 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="relative mt-14 overflow-hidden rounded-2xl border border-stone-200 bg-white p-8">
        <DoodleRocket className="pointer-events-none absolute -right-2 -top-1 hidden w-24 rotate-12 text-emerald-500/40 md:block" />
        <h2 className="relative text-2xl font-extrabold tracking-[-0.02em] text-[#111111]">
          Piloter votre closing avec CloseOS
        </h2>
        <p className="relative mt-3 max-w-xl leading-relaxed text-stone-600">
          CRM pour closer indépendant, pilotage d'équipe pour les infopreneurs, signature et encaissement
          dans le même geste.
        </p>
        <div className="relative mt-6 flex flex-wrap gap-3">
          <Link to="/sales" className={BTN_PRIMARY}>Découvrir CloseOS Sales</Link>
          <Link to="/tarifs" className={BTN_GHOST}>Voir les tarifs</Link>
        </div>
      </div>
    </ContentShell>
  )
}
