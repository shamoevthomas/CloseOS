/**
 * Hub /comparatifs — DA Business.
 *
 * Contrairement aux collections markdown (/glossaire, /ressources…), ce hub n'est pas généré :
 * ses enfants sont des pages .tsx existantes avec des tableaux comparatifs interactifs.
 * Il est indexable dès maintenant parce qu'il pointe vers du contenu réel et publié.
 *
 * ⚠️ Un hub qui ne ferait que lister deux liens serait du contenu mince. La page porte donc
 * une valeur propre : la méthode de comparaison, l'engagement de fraîcheur des données, et
 * un tableau de couverture par outil. C'est aussi ce qui la rend citable par les moteurs
 * génératifs — voir seo/GEO-ANALYSIS.md §4.
 */

import { Link } from 'react-router-dom'
import {
  ContentShell, useContentSeo, DoodleTitle, CARD, BTN_PRIMARY, BTN_GHOST,
} from '../contenu/ContentShell'
import { DoodleCheck, DoodleCross, DoodleTarget, DoodleArrow } from '../../components/doodles'

const SITE = 'https://www.closeos.fr'
const VERIFIE_LE = '30 juillet 2026'

const COMPARATIFS = [
  {
    to: '/comparatifs/closeos-vs-iclosed',
    title: 'CloseOS vs iClosed',
    intent: 'Vous hésitez entre les deux',
    summary:
      "iClosed est un outil de prise de rendez-vous et de qualification. CloseOS est un CRM complet pour closers, avec pipeline, appels, facturation, KPIs et pilotage d'équipe. Comparaison fonctionnalité par fonctionnalité, tarifs, et dans quels cas les deux se complètent plutôt qu'ils ne s'opposent.",
  },
  {
    to: '/comparatifs/alternative-iclosed',
    title: 'Alternative à iClosed',
    intent: 'Vous utilisez déjà iClosed et cherchez à en changer',
    summary:
      "Ce que CloseOS couvre du périmètre d'iClosed, ce qu'il ajoute, et comment migrer sans coupure grâce à la synchronisation bidirectionnelle. Reprise de l'historique par import CSV avec reformatage automatique.",
  },
]

const METHODE = [
  "Les fonctionnalités et tarifs des concurrents sont vérifiés à la date affichée sur chaque page.",
  "Nous indiquons ce que le concurrent fait mieux quand c'est le cas. Un comparatif où l'auteur gagne sur toute la ligne n'aide personne à décider.",
  "Quand deux outils sont complémentaires plutôt que concurrents, nous le disons et expliquons comment les faire cohabiter.",
  "Aucune affirmation invérifiable, aucune suggestion d'affiliation ou de partenariat qui n'existe pas.",
]

const COUVERTURE: { besoin: string; closeos: string | true; iclosed: string | false }[] = [
  { besoin: 'Prise de rendez-vous et qualification', closeos: 'Intégrée', iclosed: 'Cœur de métier' },
  { besoin: 'Pipeline de vente visuel', closeos: true, iclosed: false },
  { besoin: 'Appels et enregistrement', closeos: 'Call Room intégrée', iclosed: false },
  { besoin: 'Facturation', closeos: 'Connectée à Stripe', iclosed: false },
  { besoin: 'KPIs de closing', closeos: 'Natifs', iclosed: 'Partiel' },
  { besoin: "Pilotage d'équipe (closers, setters)", closeos: 'Formule Business', iclosed: false },
  { besoin: 'Signature électronique et encaissement', closeos: 'CloseOS Sign', iclosed: false },
]

function Cell({ value }: { value: string | boolean }) {
  if (value === false) {
    return (
      <span className="inline-flex items-center gap-1.5 text-stone-400">
        <DoodleCross className="w-3.5 shrink-0" /> Non
      </span>
    )
  }
  if (value === true) {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-[#111111]">
        <DoodleCheck className="w-4 shrink-0 text-emerald-500" /> Oui
      </span>
    )
  }
  return <span className="text-stone-600">{value}</span>
}

export default function ComparatifsHub() {
  useContentSeo({
    title: 'Comparatifs CloseOS — face aux autres outils de closing',
    description:
      "Comparaisons détaillées entre CloseOS et les autres outils du closing francophone : fonctionnalités, tarifs et cas où ils se complètent. Données vérifiées et datées.",
    path: '/comparatifs',
    indexable: true,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        '@id': `${SITE}/comparatifs#collection`,
        name: 'Comparatifs CloseOS — face aux autres outils de closing',
        description:
          "Comparaisons détaillées entre CloseOS et les autres outils du closing francophone.",
        url: `${SITE}/comparatifs`,
        inLanguage: 'fr',
        hasPart: COMPARATIFS.map((c) => ({
          '@type': 'WebPage',
          name: c.title,
          description: c.summary,
          url: `${SITE}${c.to}`,
        })),
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'CloseOS', item: SITE },
          { '@type': 'ListItem', position: 2, name: 'Comparatifs', item: `${SITE}/comparatifs` },
        ],
      },
    ],
  })

  return (
    <ContentShell>
      <DoodleTitle squiggle="closing">CloseOS face aux autres outils de</DoodleTitle>

      <p className="mt-7 max-w-2xl text-lg leading-relaxed text-stone-600">
        CloseOS est une suite francophone qui couvre la chaîne complète du closing high ticket :
        acquérir, prendre le rendez-vous, closer, faire signer, encaisser. La plupart des outils du
        marché n'en couvrent qu'un segment. Ces comparatifs disent lequel, sans forcer le trait.
      </p>

      <h2 className="mt-16 text-2xl font-extrabold tracking-[-0.02em] text-[#111111]">
        Comment nous comparons
      </h2>
      <ul className="mt-5 space-y-3">
        {METHODE.map((m) => (
          <li key={m} className="flex items-start gap-3 leading-relaxed text-stone-600">
            <DoodleCheck className="mt-1 w-4 shrink-0 text-emerald-500" />
            <span>{m}</span>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-xs font-medium text-stone-400">Données vérifiées le {VERIFIE_LE}.</p>

      <h2 className="mt-16 text-2xl font-extrabold tracking-[-0.02em] text-[#111111]">
        Les comparatifs disponibles
      </h2>
      <ul className="mt-5 space-y-3">
        {COMPARATIFS.map((c) => (
          <li key={c.to}>
            <Link to={c.to} className={`group block ${CARD}`}>
              <span className="flex items-center gap-2 text-lg font-bold tracking-[-0.01em] text-[#111111]">
                {c.title}
                <DoodleArrow className="w-5 -translate-x-1 text-amber-500 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
              </span>
              <span className="mt-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-600">
                {c.intent}
              </span>
              <p className="mt-2.5 text-sm leading-relaxed text-stone-600">{c.summary}</p>
            </Link>
          </li>
        ))}
      </ul>

      <div className="relative mt-16">
        <DoodleTarget className="pointer-events-none absolute -right-10 -top-6 hidden w-16 text-[#8a43e1]/30 lg:block" />
        <h2 className="text-2xl font-extrabold tracking-[-0.02em] text-[#111111]">Qui couvre quoi</h2>
        <p className="mt-3 max-w-2xl leading-relaxed text-stone-600">
          Vue d'ensemble du périmètre couvert par CloseOS et par iClosed, le principal outil concurrent
          sur le marché francophone du closing.
        </p>
        <div className="mt-6 overflow-x-auto rounded-2xl border border-stone-200 bg-white">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-stone-50">
                <th className="border-b border-stone-200 p-4 text-left font-bold text-[#111111]">Besoin</th>
                <th className="border-b border-stone-200 p-4 text-left font-bold text-[#111111]">CloseOS</th>
                <th className="border-b border-stone-200 p-4 text-left font-bold text-[#111111]">iClosed</th>
              </tr>
            </thead>
            <tbody>
              {COUVERTURE.map((r) => (
                <tr key={r.besoin} className="last:border-0">
                  <td className="border-b border-stone-100 p-4 font-medium text-[#111111]">{r.besoin}</td>
                  <td className="border-b border-stone-100 p-4"><Cell value={r.closeos} /></td>
                  <td className="border-b border-stone-100 p-4"><Cell value={r.iclosed} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-16 rounded-2xl border border-stone-200 bg-white p-8">
        <h2 className="text-2xl font-extrabold tracking-[-0.02em] text-[#111111]">
          Faites le test vous-même
        </h2>
        <p className="mt-3 max-w-xl leading-relaxed text-stone-600">
          Un comparatif ne remplace pas un essai. CloseOS s'essaie gratuitement, sans engagement.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/tarifs" className={BTN_PRIMARY}>Voir les tarifs</Link>
          <Link to="/fonctionnalites" className={BTN_GHOST}>Toutes les fonctionnalités</Link>
        </div>
      </div>
    </ContentShell>
  )
}
