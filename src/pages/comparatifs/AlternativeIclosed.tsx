/**
 * /comparatifs/alternative-iclosed — DA Business (fond #f4f2f1, Manrope, doodles).
 *
 * Reprend le gabarit ContentShell partagé avec /glossaire, /ressources et le hub
 * /comparatifs : ces pages formaient une famille visuellement incohérente (hub clair,
 * enfants sombres).
 *
 * ⚠️ Aucun tarif iClosed n'est cité. Ils évoluent, nous ne les vérifions pas en continu,
 * et une donnée périmée sur une page de comparaison détruit sa crédibilité et son
 * classement. La ligne tarifaire renvoie vers /tarifs, seule source à jour.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Layers, BarChart3, Users } from 'lucide-react';
import {
  ContentShell, useContentSeo, DoodleTitle, CARD, BTN_PRIMARY, BTN_GHOST,
} from '../contenu/ContentShell';
import { DoodleCheck, DoodleCross, DoodleTarget } from '../../components/doodles';

const SITE = 'https://www.closeos.fr';
const URL = `${SITE}/comparatifs/alternative-iclosed`;
const TITLE = 'Alternative à iClosed, Découvrez CloseOS';
const DESC =
  "Vous cherchez une alternative à iClosed ? CloseOS est le CRM tout-en-un pour closers : pipeline, callroom VoIP, facturation et gestion d'équipe. Essai gratuit.";
const VERIFIE_LE = '31 juillet 2026';

const comparisonRows: { feature: string; iclosed: boolean | string; closeos: boolean | string }[] = [
  { feature: 'Booking / prise de RDV', iclosed: 'Cœur de métier', closeos: 'Booking intégré' },
  { feature: 'Qualification de leads', iclosed: 'Formulaires + scoring', closeos: 'Via pipeline et tags' },
  { feature: 'Pipeline de vente visuel', iclosed: false, closeos: 'Drag-and-drop personnalisable' },
  { feature: 'Callroom VoIP intégrée', iclosed: false, closeos: 'Appels illimités + enregistrement' },
  { feature: 'Facturation automatique', iclosed: false, closeos: 'Connectée à Stripe' },
  { feature: 'KPIs de closing', iclosed: false, closeos: 'Taux de closing, CA, objectifs' },
  { feature: "Gestion d'équipe", iclosed: false, closeos: 'Multi-rôles (closer, setter, admin)' },
  { feature: "Campagnes d'acquisition", iclosed: false, closeos: 'Tracking UTM + analytics' },
  { feature: 'Signature électronique + paiement', iclosed: false, closeos: 'CloseOS Sign' },
  { feature: 'Synchronisation entre les deux outils', iclosed: 'Bidirectionnelle', closeos: 'Bidirectionnelle' },
  { feature: 'Intégrations HubSpot / Pipedrive', iclosed: false, closeos: 'Bidirectionnelles' },
];

/** Source unique : alimente l'affichage ET le JSON-LD FAQPage. */
const faqItems = [
  {
    question: 'Est-ce que CloseOS remplace iClosed ?',
    answer:
      "Oui. CloseOS intègre nativement un système de prise de rendez-vous avec questionnaire de qualification, ce qui couvre la fonction principale d'iClosed. Vous obtenez des liens de réservation synchronisés à votre Google Calendar, la gestion des disponibilités et des fuseaux horaires, les rappels automatiques envoyés au prospect, ainsi que le multi-booking qui permet de proposer plusieurs créneaux en un seul envoi. Mais CloseOS va au-delà du booking : s'y ajoutent le CRM et le pipeline de vente, la Call Room Google Meet, les relances automatiques, la facturation connectée à Stripe, les KPIs de closing et, en formule Business, la gestion d'une équipe de closers et de setters. Vous n'avez donc plus besoin d'un outil séparé pour la prise de rendez-vous. Et si vous utilisez déjà iClosed, CloseOS s'y connecte pendant votre transition, ce qui évite toute coupure.",
  },
  {
    question: "Est-ce que je peux migrer mes données d'iClosed vers CloseOS ?",
    answer:
      "Oui, et la migration se fait en deux temps pour éviter toute rupture. Le flux courant d'abord : la synchronisation bidirectionnelle avec iClosed reprend automatiquement les nouveaux rendez-vous, prospects et changements d'étape, dans les deux sens. Vous pouvez donc faire tourner les deux outils en parallèle le temps que votre équipe prenne ses marques, sans rien ressaisir et sans risquer de perdre un lead entre les deux. L'historique ensuite : vos données passées s'importent par fichier CSV, avec un assistant IA intégré qui reformate automatiquement le fichier pour le rendre compatible, quel que soit son format d'origine. Le support accompagne cette reprise si votre historique est volumineux ou si votre structure de données est inhabituelle. Vos données restent exportables à tout moment : adopter CloseOS ne vous enferme pas davantage que ne le faisait iClosed.",
  },
  {
    question: 'Combien coûte CloseOS par rapport à iClosed ?',
    answer:
      "CloseOS se décline en trois produits facturés séparément, ce qui permet de ne payer que ce que vous utilisez. CloseOS Sales s'adresse au closer indépendant qui vend seul, à partir de 18 € par mois en facturation annuelle. CloseOS Business s'adresse à ceux qui font vendre d'autres personnes, avec une formule Solo pour démarrer et une formule Business complète dès que vous pilotez une équipe ; le tarif suit alors le nombre de sièges actifs. CloseOS Sign, le module de signature avec encaissement intégré, est inclus sans surcoût dans l'abonnement Business et peut aussi être souscrit seul. Chaque produit s'essaie gratuitement avant tout engagement, et le tarif auquel vous entrez reste bloqué tant que votre abonnement est actif, même si les prix augmentent ensuite. Nous ne publions pas les tarifs d'iClosed : ils évoluent et une donnée périmée serait trompeuse. Reportez-vous au site de l'éditeur.",
  },
];

const migrationReasons = [
  {
    icon: Layers,
    title: 'Un seul outil au lieu de trois',
    text: "Avec iClosed seul, il faut un CRM séparé pour suivre le pipeline, un outil de facturation, et parfois un outil d'appel. CloseOS réunit les trois.",
  },
  {
    icon: BarChart3,
    title: 'Des KPIs pensés pour le closing',
    text: "Les CRM généralistes ne suivent pas les métriques du métier : taux de closing par source, cash collecté, évolution des objectifs. CloseOS est construit autour d'elles.",
  },
  {
    icon: Users,
    title: "Le pilotage d'équipe inclus",
    text: "Dès qu'un setter qualifie et qu'un closer signe, il faut attribuer les leads, comparer les performances et calculer les commissions. C'est le périmètre de la formule Business.",
  },
];

function Cell({ value }: { value: boolean | string }) {
  if (value === false) {
    return (
      <span className="inline-flex items-center gap-1.5 text-stone-400">
        <DoodleCross className="w-3.5 shrink-0" /> Non
      </span>
    );
  }
  if (value === true) {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-[#111111]">
        <DoodleCheck className="w-4 shrink-0 text-emerald-500" /> Oui
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-stone-600">
      <DoodleCheck className="w-4 shrink-0 text-emerald-500" /> {value}
    </span>
  );
}

export default function AlternativeIclosed() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useContentSeo({
    title: TITLE,
    description: DESC,
    path: '/comparatifs/alternative-iclosed',
    indexable: true,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'CloseOS', item: SITE },
          { '@type': 'ListItem', position: 2, name: 'Comparatifs', item: `${SITE}/comparatifs` },
          { '@type': 'ListItem', position: 3, name: 'Alternative à iClosed', item: URL },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        // Généré depuis faqItems : le balisage ne peut plus diverger de l'affichage.
        mainEntity: faqItems.map((f) => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: { '@type': 'Answer', text: f.answer },
        })),
      },
    ],
  });

  // Visuel de partage dédié — useContentSeo ne gère pas l'og:image.
  useEffect(() => {
    const img = `${SITE}/api/og?type=page&slug=comparatif&lang=fr`;
    document.getElementById('og-image')?.setAttribute('content', img);
    document.getElementById('tw-image')?.setAttribute('content', img);
    document.getElementById('og-image-alt')?.setAttribute('content', 'CloseOS vs iClosed');
  }, []);

  return (
    <ContentShell breadcrumb={{ label: 'Comparatifs', to: '/comparatifs' }}>
      <DoodleTitle squiggle="CloseOS">Alternative à iClosed : pourquoi les closers choisissent</DoodleTitle>

      <p className="mt-7 max-w-2xl text-lg leading-relaxed text-stone-600">
        iClosed est un outil de prise de rendez-vous et de qualification de leads, bien installé dans
        l'écosystème francophone du closing. Si votre besoin s'arrête là, il fait très bien l'affaire. Si
        vous cherchez un CRM qui couvre aussi tout ce qui vient <em>après</em> le rendez-vous, c'est le
        périmètre de CloseOS.
      </p>

      <h2 className="mt-16 text-2xl font-extrabold tracking-[-0.02em] text-[#111111]">
        Deux outils qui ne font pas la même chose
      </h2>
      <p className="mt-3 max-w-2xl leading-relaxed text-stone-600">
        iClosed et CloseOS ne sont pas des concurrents frontaux : ils interviennent à deux moments
        différents du cycle de vente, et fonctionnent très bien ensemble.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className={CARD}>
          <h3 className="text-lg font-bold text-[#111111]">iClosed</h3>
          <p className="mt-2.5 leading-relaxed text-stone-600">
            Prise de rendez-vous et qualification de leads. Formulaires de qualification, scoring,
            assignation aux closers, rappels automatiques.
          </p>
          <p className="mt-3 font-semibold text-[#111111]">Point fort : remplir l'agenda de prospects filtrés.</p>
        </div>
        <div className={`${CARD} !border-emerald-500/40 !bg-emerald-50/60`}>
          <h3 className="text-lg font-bold text-[#111111]">CloseOS</h3>
          <p className="mt-2.5 leading-relaxed text-stone-600">
            CRM complet pour closers. Tout ce qui suit le rendez-vous : pipeline, Call Room, relances,
            facturation, KPIs, pilotage d'équipe et signature avec encaissement.
          </p>
          <p className="mt-3 font-semibold text-[#111111]">Se synchronise avec iClosed dans les deux sens.</p>
        </div>
      </div>

      <div className="relative mt-16">
        <DoodleTarget className="pointer-events-none absolute -right-10 -top-6 hidden w-16 text-[#8a43e1]/30 lg:block" />
        <h2 className="text-2xl font-extrabold tracking-[-0.02em] text-[#111111]">Comparaison détaillée</h2>
        <p className="mt-3 text-sm text-stone-500">Périmètre fonctionnel vérifié le {VERIFIE_LE}.</p>
        <div className="mt-6 overflow-x-auto rounded-2xl border border-stone-200 bg-white">
          <table className="w-full min-w-[600px] border-collapse text-sm">
            <thead>
              <tr className="bg-stone-50">
                <th className="border-b border-stone-200 p-4 text-left font-bold text-[#111111]">Fonctionnalité</th>
                <th className="border-b border-stone-200 p-4 text-left font-bold text-[#111111]">iClosed</th>
                <th className="border-b border-stone-200 p-4 text-left font-bold text-[#111111]">CloseOS</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.feature}>
                  <td className="border-b border-stone-100 p-4 font-medium text-[#111111]">{row.feature}</td>
                  <td className="border-b border-stone-100 p-4"><Cell value={row.iclosed} /></td>
                  <td className="border-b border-stone-100 p-4"><Cell value={row.closeos} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-stone-400">
          Les tarifs d'iClosed ne figurent volontairement pas dans ce tableau : ils évoluent et nous ne les
          vérifions pas en continu. Ceux de CloseOS sont sur la{' '}
          <Link to="/tarifs" className="font-semibold text-[#111111] underline decoration-amber-400 decoration-2 underline-offset-4">
            page Tarifs
          </Link>.
        </p>
      </div>

      <h2 className="mt-16 text-2xl font-extrabold tracking-[-0.02em] text-[#111111]">
        Pourquoi des closers passent à CloseOS
      </h2>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {migrationReasons.map(({ icon: Icon, title, text }) => (
          <div key={title} className={CARD}>
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100">
              <Icon className="h-5 w-5 text-amber-700" />
            </div>
            <h3 className="font-bold text-[#111111]">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">{text}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-16 text-2xl font-extrabold tracking-[-0.02em] text-[#111111]">Questions fréquentes</h2>
      <div className="mt-6 space-y-3">
        {faqItems.map((item, i) => (
          <div key={item.question} className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
            <button
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
              className="flex w-full items-center justify-between gap-4 p-5 text-left"
              aria-expanded={openFaq === i}
            >
              <span className="font-bold text-[#111111]">{item.question}</span>
              <ChevronDown
                className={`h-5 w-5 shrink-0 text-stone-400 transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`}
              />
            </button>
            <div className={`overflow-hidden px-5 transition-all duration-300 ${openFaq === i ? 'max-h-[40rem] pb-5' : 'max-h-0'}`}>
              <p className="leading-relaxed text-stone-600">{item.answer}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-16 rounded-2xl border border-stone-200 bg-white p-8">
        <h2 className="text-2xl font-extrabold tracking-[-0.02em] text-[#111111]">
          Tout gérer dans un seul outil
        </h2>
        <p className="mt-3 max-w-xl leading-relaxed text-stone-600">
          Essayez CloseOS gratuitement, sans engagement. Si vous utilisez déjà iClosed, gardez-le : la
          synchronisation vous laisse migrer à votre rythme.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/tarifs" className={BTN_PRIMARY}>Voir les tarifs</Link>
          <Link to="/comparatifs/closeos-vs-iclosed" className={BTN_GHOST}>La comparaison détaillée</Link>
          <Link to="/ressources/iclosed-avis" className={BTN_GHOST}>Comprendre iClosed</Link>
        </div>
      </div>
    </ContentShell>
  );
}
