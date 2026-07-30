/**
 * Hub d'une collection éditoriale : /glossaire, /ressources, /guides.
 * DA Business (fond #f4f2f1, cartes blanches, doodles).
 * Sous MIN_PUBLISHED entrées, la page reste navigable mais passe en noindex.
 */

import { Link } from 'react-router-dom'
import { COLLECTIONS, entriesOf, isIndexable, MIN_PUBLISHED, type CollectionKey } from '../../content/collections'
import { ContentShell, useContentSeo, DoodleTitle, CARD, BTN_PRIMARY, BTN_GHOST, PROSE_STYLES } from './ContentShell'
import { DoodleBulb, DoodleClock, DoodleArrow } from '../../components/doodles'

const SITE = 'https://www.closeos.fr'

/** Mot souligné au trait ondulé dans le titre de chaque hub. */
const SQUIGGLE: Record<CollectionKey, { lead: string; word: string }> = {
  glossaire: { lead: 'Le vocabulaire du', word: 'closing' },
  ressources: { lead: 'Nos', word: 'ressources' },
  guides: { lead: 'Les', word: 'guides' },
  integrations: { lead: 'Toutes les', word: 'intégrations' },
  'cas-usage': { lead: "Les cas d'", word: 'usage' },
  clients: { lead: 'Ils utilisent', word: 'CloseOS' },
}

export default function CollectionHub({ collection }: { collection: CollectionKey }) {
  const cfg = COLLECTIONS[collection]
  const entries = entriesOf(collection)
  const indexable = isIndexable(collection)
  const heading = SQUIGGLE[collection]

  useContentSeo({
    title: cfg.seoTitle,
    description: cfg.seoDescription,
    path: cfg.basePath,
    indexable,
    jsonLd: indexable
      ? [
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'CloseOS', item: SITE },
              { '@type': 'ListItem', position: 2, name: cfg.title, item: `${SITE}${cfg.basePath}` },
            ],
          },
          collection === 'glossaire'
            ? {
                '@context': 'https://schema.org',
                '@type': 'DefinedTermSet',
                '@id': `${SITE}${cfg.basePath}#termset`,
                name: cfg.title,
                description: cfg.seoDescription,
                url: `${SITE}${cfg.basePath}`,
                inLanguage: 'fr',
                hasDefinedTerm: entries.map((e) => ({
                  '@type': 'DefinedTerm',
                  name: e.term ?? e.title,
                  description: e.description,
                  url: `${SITE}${cfg.basePath}/${e.slug}`,
                })),
              }
            : {
                '@context': 'https://schema.org',
                '@type': 'CollectionPage',
                '@id': `${SITE}${cfg.basePath}#collection`,
                name: cfg.title,
                description: cfg.seoDescription,
                url: `${SITE}${cfg.basePath}`,
                inLanguage: 'fr',
                hasPart: entries.map((e) => ({
                  '@type': 'Article',
                  headline: e.title,
                  description: e.description,
                  url: `${SITE}${cfg.basePath}/${e.slug}`,
                  datePublished: e.published || undefined,
                })),
              },
        ]
      : undefined,
  })

  return (
    <ContentShell>
      <style>{PROSE_STYLES}</style>

      <DoodleTitle squiggle={heading.word}>{heading.lead}</DoodleTitle>
      <p className="mt-7 max-w-2xl text-lg leading-relaxed text-stone-600">{cfg.intro}</p>

      {entries.length === 0 ? (
        <div className={`mt-12 ${CARD} flex items-start gap-4`}>
          <DoodleClock className="mt-0.5 hidden w-9 shrink-0 text-amber-500 sm:block" />
          <div>
            <p className="font-semibold text-[#111111]">Les premiers contenus arrivent bientôt.</p>
            <p className="mt-1.5 leading-relaxed text-stone-600">
              En attendant, le{' '}
              <Link to="/glossaire" className="font-semibold text-[#111111] underline decoration-amber-400 decoration-2 underline-offset-4">
                glossaire du closing
              </Link>{' '}
              et les{' '}
              <Link to="/comparatifs" className="font-semibold text-[#111111] underline decoration-amber-400 decoration-2 underline-offset-4">
                comparatifs
              </Link>{' '}
              sont disponibles.
            </p>
          </div>
        </div>
      ) : (
        <ul className="mt-12 space-y-3">
          {entries.map((e) => (
            <li key={e.slug}>
              <Link to={`${cfg.basePath}/${e.slug}`} className={`group block ${CARD}`}>
                <span className="flex items-center gap-2 text-lg font-bold tracking-[-0.01em] text-[#111111]">
                  {e.term ?? e.title}
                  <DoodleArrow className="w-5 -translate-x-1 text-amber-500 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                </span>
                {e.description && (
                  <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{e.description}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!indexable && entries.length > 0 && (
        <p className="mt-10 text-xs text-stone-400">
          Cette rubrique compte {entries.length} contenu{entries.length > 1 ? 's' : ''} sur les {MIN_PUBLISHED}{' '}
          nécessaires avant sa mise en avant dans les moteurs de recherche.
        </p>
      )}

      <div className="relative mt-16 overflow-hidden rounded-2xl border border-stone-200 bg-white p-8">
        <DoodleBulb className="pointer-events-none absolute -right-3 -top-2 hidden w-24 rotate-12 text-amber-400/50 md:block" />
        <h2 className="relative text-2xl font-extrabold tracking-[-0.02em] text-[#111111]">
          CloseOS, la suite du closing high ticket
        </h2>
        <p className="relative mt-3 max-w-xl leading-relaxed text-stone-600">
          Acquérir, prendre le rendez-vous, closer, faire signer, encaisser — dans un seul écosystème francophone.
        </p>
        <div className="relative mt-6 flex flex-wrap gap-3">
          <Link to="/sales" className={BTN_PRIMARY}>CloseOS Sales</Link>
          <Link to="/business" className={BTN_GHOST}>CloseOS Business</Link>
          <Link to="/tarifs" className={BTN_GHOST}>Tarifs</Link>
        </div>
      </div>
    </ContentShell>
  )
}
