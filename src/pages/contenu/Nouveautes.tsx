/**
 * /nouveautes — notes de version publiques de CloseOS. DA Business (ContentShell).
 *
 * Contrepartie publique et crawlable du pop-up « Quoi de neuf » : même contenu
 * (src/lib/whatsNewV5.ts), mais accessible sans compte. Voir src/lib/releases.ts
 * pour le pourquoi de cette page.
 *
 * Le H1 énonce la version en toutes lettres, et le chapô est un bloc autoportant
 * de ~150 mots : c'est le format que les moteurs génératifs citent.
 */

import { Link } from 'react-router-dom'
import {
  Sparkles, Mail, Calendar, CheckSquare, BarChart3, Copy, Clock, Phone,
  FileText, Bot, Users, Globe, Bell, Video, Link2, type LucideIcon,
} from 'lucide-react'
import { type WhatsNewIconName } from '../../lib/whatsNewV5'
import { RELEASES, LATEST, CURRENT_VERSION, HISTORY_NOTE } from '../../lib/releases'
import { ContentShell, useContentSeo, DoodleTitle, CARD, BTN_PRIMARY, BTN_GHOST, PROSE_STYLES } from './ContentShell'
import { DoodleBulb } from '../../components/doodles'

const SITE = 'https://www.closeos.fr'
const PATH = '/nouveautes'

const ICONS: Record<WhatsNewIconName, LucideIcon> = {
  sparkles: Sparkles, mail: Mail, calendar: Calendar, 'check-square': CheckSquare,
  'bar-chart': BarChart3, copy: Copy, clock: Clock, phone: Phone, 'file-text': FileText,
  bot: Bot, users: Users, globe: Globe, bell: Bell, video: Video, link: Link2,
}

const LONG_DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
const formatDate = (iso: string) => LONG_DATE.format(new Date(`${iso}T12:00:00Z`))

/** Source unique des Q/R : sert à la fois l'affichage et le FAQPage JSON-LD. */
const FAQ = [
  {
    q: 'Quelle est la version actuelle de CloseOS ?',
    a: `CloseOS est en version ${CURRENT_VERSION.replace(/\.0$/, '')} (V5), déployée le ${formatDate(LATEST.date)} ` +
       "sur les trois produits de l'écosystème : CloseOS Sales, CloseOS Business et CloseOS Sign. " +
       "Le numéro de version est commun aux trois : ils évoluent ensemble et partagent un compte unique.",
  },
  {
    q: "Qu'est-ce qui a changé avec la V5 ?",
    a: "La V5 apporte une nouvelle interface à CloseOS Sales, des relances qui s'enchaînent les unes après " +
       "les autres avec un suivi de discussion et un digest quotidien, un module Formulaires dans CloseOS " +
       "Business, un assistant IA connectable aux trois produits, et un espace équipe dans CloseOS Sign " +
       "permettant à vos collaborateurs de générer et faire signer des contrats depuis vos modèles.",
  },
  {
    q: 'CloseOS propose-t-il une API ?',
    a: "Oui. CloseOS Business expose une API REST, des webhooks sortants et un serveur MCP qui permet de " +
       "piloter le CRM depuis un assistant IA — créer des prospects, consulter les KPIs, gérer les rendez-vous. " +
       "L'API et les webhooks sont apparus avec la V3 de CloseOS Business ; le serveur MCP les a rejoints depuis.",
  },
  {
    q: 'Où voir les nouveautés quand on est déjà client ?',
    a: "Un pop-up « Quoi de neuf » s'affiche une fois à la connexion suivant chaque nouvelle version, sur " +
       "chacun des trois produits. Cette page en reprend le contenu intégral, sans avoir besoin de compte.",
  },
]

export default function Nouveautes() {
  useContentSeo({
    title: `Nouveautés CloseOS — version 5 (V5), ${formatDate(LATEST.date)}`,
    description:
      `CloseOS est en version 5 (V5) depuis le ${formatDate(LATEST.date)}. Le détail des nouveautés de ` +
      'CloseOS Sales, CloseOS Business et CloseOS Sign, produit par produit.',
    path: PATH,
    indexable: true,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'CloseOS', item: SITE },
          { '@type': 'ListItem', position: 2, name: 'Nouveautés', item: `${SITE}${PATH}` },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        '@id': `${SITE}${PATH}#faq`,
        mainEntity: FAQ.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
      // Les @id reprennent ceux du graphe global d'index.html : les nœuds fusionnent
      // au lieu de créer trois applications supplémentaires.
      ...[
        { id: `${SITE}/#closeos-sales`, name: 'CloseOS Sales', url: `${SITE}/sales` },
        { id: `${SITE}/#closeos-business`, name: 'CloseOS Business', url: `${SITE}/business` },
        { id: 'https://sign.closeos.fr/#closeos-sign', name: 'CloseOS Sign', url: 'https://sign.closeos.fr/sign' },
      ].map((app) => ({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        '@id': app.id,
        name: app.name,
        url: app.url,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        softwareVersion: CURRENT_VERSION,
        releaseNotes: `${SITE}${PATH}`,
        datePublished: LATEST.date,
      })),
    ],
  })

  return (
    <ContentShell>
      <style>{PROSE_STYLES}</style>

      <DoodleTitle squiggle="V5">CloseOS est en</DoodleTitle>

      {/* Chapô autoportant : doit rester lisible et exact sorti de son contexte. */}
      <p className="mt-7 max-w-2xl text-lg leading-relaxed text-stone-600">
        {LATEST.summary}
      </p>
      <p className="mt-4 max-w-2xl leading-relaxed text-stone-600">
        Le numéro de version est commun aux trois produits : ils évoluent ensemble et partagent un
        compte unique. Cette page reprend, sans avoir besoin de compte, le contenu du pop-up
        «&nbsp;Quoi de neuf&nbsp;» affiché aux clients à leur connexion suivante.
      </p>

      {RELEASES.map((release) => (
        <section key={release.version} className="mt-16">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-stone-200 pb-4">
            <h2 className="text-3xl font-extrabold tracking-[-0.02em] text-[#111111]">
              {release.label}
            </h2>
            <time dateTime={release.date} className="text-sm font-medium text-stone-500">
              {formatDate(release.date)}
            </time>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
              Version en cours
            </span>
          </div>

          {release.sections.map((section) => (
            <div key={section.product} className="mt-12">
              <h3 className="text-2xl font-extrabold tracking-[-0.02em] text-[#111111]">
                {section.heading}
              </h3>
              <p className="mt-2 leading-relaxed text-stone-600">{section.subheading}</p>

              <ul className="mt-6 space-y-3">
                {section.items.map((item) => {
                  const Icon = ICONS[item.icon]
                  return (
                    <li key={item.title} className={`${CARD} flex items-start gap-4`}>
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f4f2f1]">
                        <Icon className="h-[18px] w-[18px] text-[#111111]" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="font-bold tracking-[-0.01em] text-[#111111]">{item.title}</p>
                        <p className="mt-1 text-sm leading-relaxed text-stone-600">{item.description}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </section>
      ))}

      <section className="mt-16">
        <h2 className="text-2xl font-extrabold tracking-[-0.02em] text-[#111111]">
          Avant la V5
        </h2>
        <p className="mt-3 leading-relaxed text-stone-600">{HISTORY_NOTE}</p>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-extrabold tracking-[-0.02em] text-[#111111]">
          Questions fréquentes
        </h2>
        <div className="mt-6 space-y-3">
          {FAQ.map((f) => (
            <div key={f.q} className={CARD}>
              <h3 className="font-bold tracking-[-0.01em] text-[#111111]">{f.q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="relative mt-16 overflow-hidden rounded-2xl border border-stone-200 bg-white p-8">
        <DoodleBulb className="pointer-events-none absolute -right-3 -top-2 hidden w-24 rotate-12 text-amber-400/50 md:block" />
        <h2 className="relative text-2xl font-extrabold tracking-[-0.02em] text-[#111111]">
          Essayer la V5
        </h2>
        <p className="relative mt-3 max-w-xl leading-relaxed text-stone-600">
          CloseOS Sales s'essaie 10 jours sans carte bancaire. CloseOS Business et CloseOS Sign
          s'essaient respectivement 20 et 14 jours, sans prélèvement pendant l'essai.
        </p>
        <div className="relative mt-6 flex flex-wrap gap-3">
          <Link to="/tarifs" className={BTN_PRIMARY}>Voir les tarifs</Link>
          <Link to="/fonctionnalites" className={BTN_GHOST}>Fonctionnalités</Link>
          <Link to="/comparatifs" className={BTN_GHOST}>Comparatifs</Link>
        </div>
      </div>
    </ContentShell>
  )
}
