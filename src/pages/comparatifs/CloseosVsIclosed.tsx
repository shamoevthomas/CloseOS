/**
 * /comparatifs/closeos-vs-iclosed — DA Business (fond #f4f2f1, Manrope, doodles).
 *
 * Même gabarit ContentShell que le hub /comparatifs et sa page sœur
 * /comparatifs/alternative-iclosed.
 *
 * ⚠️ Le tableau tarifaire ne publie plus de prix iClosed : ils évoluent, nous ne les
 * vérifions pas en continu, et une donnée périmée sur une page de comparaison détruit
 * sa crédibilité. Les prix CloseOS viennent de la grille réelle (voir Tarifs.tsx) et
 * distinguent mensuel et annuel, ce que l'ancienne version ne faisait pas.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, AlertTriangle } from 'lucide-react';
import {
  ContentShell, useContentSeo, DoodleTitle, CARD, BTN_PRIMARY, BTN_GHOST,
} from '../contenu/ContentShell';
import { DoodleCheck, DoodleCross, DoodleTarget } from '../../components/doodles';

const SITE = 'https://www.closeos.fr';
const URL = `${SITE}/comparatifs/closeos-vs-iclosed`;
const TITLE = 'CloseOS vs iClosed, Comparatif détaillé 2026';
const DESC =
  "Comparatif CloseOS vs iClosed : booking, CRM, appels, facturation, KPIs et gestion d'équipe. Ce que chaque outil couvre, et dans quels cas ils se complètent.";
const VERIFIE_LE = '31 juillet 2026';

const LABELS: Record<string, string> = {
  yes: 'Oui',
  'yes-core': 'Cœur de métier',
  'yes-advanced': 'Avancé',
  'yes-dnd': 'Drag-and-drop',
  'yes-hist': 'Historique complet',
  'yes-voip': 'Appels illimités',
  'yes-stripe': 'Stripe Connect',
  'yes-biz': 'Formule Business',
  'yes-acq': 'Business + Acquisition',
  'yes-bi': 'Bidirectionnelle',
  'yes-wh': 'Bidirectionnelle',
};

const featureRows: { cat: string; feature: string; iclosed: string; closeos: string }[] = [
  { cat: 'Booking', feature: 'Prise de rendez-vous en ligne', iclosed: 'yes-core', closeos: 'yes' },
  { cat: 'Booking', feature: 'Formulaire de qualification avant l\'appel', iclosed: 'yes-advanced', closeos: 'warn' },
  { cat: 'Booking', feature: 'Scoring de leads', iclosed: 'yes', closeos: 'no' },
  { cat: 'Booking', feature: 'Assignation automatique aux closers', iclosed: 'yes', closeos: 'yes' },
  { cat: 'CRM', feature: 'Pipeline de vente visuel', iclosed: 'no', closeos: 'yes-dnd' },
  { cat: 'CRM', feature: 'Fiches prospects détaillées', iclosed: 'no', closeos: 'yes-hist' },
  { cat: 'CRM', feature: 'Import/export CSV', iclosed: 'no', closeos: 'yes' },
  { cat: 'Appels', feature: 'Call Room intégrée', iclosed: 'no', closeos: 'yes-voip' },
  { cat: 'Appels', feature: "Enregistrement d'appels", iclosed: 'no', closeos: 'yes' },
  { cat: 'Finance', feature: 'Facturation automatique', iclosed: 'no', closeos: 'yes-stripe' },
  { cat: 'Finance', feature: 'Signature électronique + paiement', iclosed: 'no', closeos: 'yes' },
  { cat: 'KPIs', feature: 'Taux de closing', iclosed: 'no', closeos: 'yes' },
  { cat: 'KPIs', feature: 'Cash collecté', iclosed: 'no', closeos: 'yes' },
  { cat: 'KPIs', feature: 'Objectifs par membre', iclosed: 'no', closeos: 'yes' },
  { cat: 'Équipe', feature: 'Gestion multi-rôles', iclosed: 'no', closeos: 'yes-biz' },
  { cat: 'Équipe', feature: 'KPIs par membre', iclosed: 'no', closeos: 'yes-biz' },
  { cat: 'Équipe', feature: 'Onboarding automatisé', iclosed: 'no', closeos: 'yes-biz' },
  { cat: 'Acquisition', feature: 'Campagnes avec tracking UTM', iclosed: 'no', closeos: 'yes-acq' },
  { cat: 'Intégrations', feature: 'HubSpot / Pipedrive', iclosed: 'no', closeos: 'yes-bi' },
  { cat: 'Intégrations', feature: 'Zapier / Make / n8n', iclosed: 'no', closeos: 'yes' },
  { cat: 'Intégrations', feature: 'CloseOS ↔ iClosed', iclosed: 'yes', closeos: 'yes-wh' },
  { cat: 'Langue', feature: 'Interface en français', iclosed: 'yes', closeos: 'yes' },
];

/** Grille CloseOS réelle. Mensuel / annuel — voir src/pages/Tarifs.tsx. */
const pricingRows = [
  { label: 'Prix mensuel', solo: '39 €', biz: '59 €', acq: '99 €' },
  { label: 'Prix en annuel', solo: '28 €', biz: '42 €', acq: '71 €' },
  { label: 'Équipiers inclus', solo: '1', biz: '3', acq: '5' },
  { label: 'Booking intégré', solo: 'yes', biz: 'yes', acq: 'yes' },
  { label: 'CRM complet', solo: 'yes', biz: 'yes', acq: 'yes' },
  { label: 'Call Room', solo: 'yes', biz: 'yes', acq: 'yes' },
  { label: 'Facturation', solo: 'yes', biz: 'yes', acq: 'yes' },
  { label: "Gestion d'équipe", solo: 'no', biz: 'yes', acq: 'yes' },
  { label: "Système d'acquisition", solo: 'yes', biz: 'no', acq: 'yes' },
];

const faqItems = [
  {
    q: 'Est-ce que CloseOS et iClosed sont des concurrents ?',
    a: "Non, et c'est le malentendu le plus courant sur ces deux outils. iClosed est une solution de prise de rendez-vous et de qualification de leads : sa fonction principale est de remplir l'agenda du closer avec des prospects déjà filtrés, comparable en cela à un Calendly enrichi d'un questionnaire. CloseOS est un CRM complet pour closers : il prend le relais une fois le rendez-vous pris, avec le pipeline de vente, la Call Room, les relances automatiques, la facturation, les KPIs de closing et, sur la formule Business, le pilotage d'une équipe de closers et de setters. Les deux couvrent donc deux moments différents du même cycle de vente. C'est pourquoi ils s'utilisent très bien ensemble : une synchronisation bidirectionnelle relie les deux outils, de sorte que les rendez-vous pris dans iClosed alimentent automatiquement le pipeline CloseOS.",
  },
  {
    q: 'Puis-je utiliser les deux en même temps ?',
    a: "Oui, et c'est même la configuration que nous recommandons aux infopreneurs qui disposent déjà d'une équipe et d'un setup iClosed rodé. La répartition des rôles est nette : iClosed continue de gérer la prise de rendez-vous et la qualification en amont, tandis que CloseOS gère tout ce qui suit — le pipeline de vente, les appels et leur enregistrement, les relances, la facturation, les KPIs individuels et collectifs, l'attribution des leads entre setters et closers et le calcul des commissions. La connexion se fait par une synchronisation bidirectionnelle native : chaque prospect, deal ou changement d'étape modifié d'un côté est reflété de l'autre en temps réel, sans double saisie ni réconciliation manuelle. Cette approche est aussi le chemin de migration le plus sûr, puisque rien n'est coupé pendant la transition.",
  },
  {
    q: 'Quel est le meilleur CRM pour un closer en 2026 ?',
    a: "Cela dépend de ce que vous faites. Pour un commercial en cycle long dans une PME, un CRM généraliste comme HubSpot ou Pipedrive reste pertinent : ils sont matures, bien documentés et couvrent large. Pour un closer francophone en high ticket, le besoin est différent : peu de prospects, un cycle court, beaucoup d'appels, des relances serrées et une rémunération à la commission. CloseOS Sales est conçu pour ce métier précis, avec une Call Room intégrée pour passer et enregistrer les appels, des KPIs de closing natifs — taux de closing, cash collecté, no-show — et une facturation reliée à Stripe. Un CRM généraliste peut être configuré pour s'en approcher, mais au prix d'un paramétrage long et de champs personnalisés à maintenir. La vraie question n'est donc pas quel CRM est le meilleur, mais lequel part de votre métier.",
  },
];

function Cell({ value }: { value: string }) {
  if (value === 'no') {
    return (
      <span className="inline-flex items-center gap-1.5 text-stone-400">
        <DoodleCross className="w-3.5 shrink-0" /> Non
      </span>
    );
  }
  if (value === 'warn') {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-amber-700">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Basique
      </span>
    );
  }
  if (value === 'dash') return <span className="text-stone-400">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-stone-600">
      <DoodleCheck className="w-4 shrink-0 text-emerald-500" /> {LABELS[value] ?? 'Oui'}
    </span>
  );
}

function PricingCell({ value }: { value: string }) {
  if (value === 'yes') return <DoodleCheck className="mx-auto w-4 text-emerald-500" />;
  if (value === 'no') return <DoodleCross className="mx-auto w-3.5 text-stone-400" />;
  return <span className="text-stone-600">{value}</span>;
}

export default function CloseosVsIclosed() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useContentSeo({
    title: TITLE,
    description: DESC,
    path: '/comparatifs/closeos-vs-iclosed',
    indexable: true,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'CloseOS', item: SITE },
          { '@type': 'ListItem', position: 2, name: 'Comparatifs', item: `${SITE}/comparatifs` },
          { '@type': 'ListItem', position: 3, name: 'CloseOS vs iClosed', item: URL },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqItems.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  });

  useEffect(() => {
    const img = `${SITE}/api/og?type=page&slug=comparatif&lang=fr`;
    document.getElementById('og-image')?.setAttribute('content', img);
    document.getElementById('tw-image')?.setAttribute('content', img);
    document.getElementById('og-image-alt')?.setAttribute('content', 'CloseOS vs iClosed');
  }, []);

  let lastCat = '';

  return (
    <ContentShell breadcrumb={{ label: 'Comparatifs', to: '/comparatifs' }}>
      <DoodleTitle squiggle="iClosed">CloseOS vs</DoodleTitle>

      <p className="mt-7 max-w-2xl text-lg leading-relaxed text-stone-600">
        iClosed est un outil de prise de rendez-vous et de qualification de leads. CloseOS est un CRM
        complet pour closers, avec pipeline, appels, facturation, KPIs et pilotage d'équipe. Ils
        interviennent à deux moments différents du cycle de vente — voici lesquels, fonctionnalité par
        fonctionnalité.
      </p>

      <div className="relative mt-16">
        <DoodleTarget className="pointer-events-none absolute -right-10 -top-6 hidden w-16 text-[#8a43e1]/30 lg:block" />
        <h2 className="text-2xl font-extrabold tracking-[-0.02em] text-[#111111]">
          Comparaison fonctionnalité par fonctionnalité
        </h2>
        <p className="mt-3 text-sm text-stone-500">Périmètre fonctionnel vérifié le {VERIFIE_LE}.</p>
        <div className="mt-6 overflow-x-auto rounded-2xl border border-stone-200 bg-white">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="bg-stone-50">
                <th className="border-b border-stone-200 p-4 text-left font-bold text-[#111111]">Fonctionnalité</th>
                <th className="border-b border-stone-200 p-4 text-left font-bold text-[#111111]">iClosed</th>
                <th className="border-b border-stone-200 p-4 text-left font-bold text-[#111111]">CloseOS</th>
              </tr>
            </thead>
            <tbody>
              {featureRows.map((row) => {
                const showCat = row.cat !== lastCat;
                lastCat = row.cat;
                return (
                  <tr key={row.feature}>
                    <td className="border-b border-stone-100 p-4 font-medium text-[#111111]">
                      {showCat && (
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-stone-400">
                          {row.cat}
                        </span>
                      )}
                      {row.feature}
                    </td>
                    <td className="border-b border-stone-100 p-4"><Cell value={row.iclosed} /></td>
                    <td className="border-b border-stone-100 p-4"><Cell value={row.closeos} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <h2 className="mt-16 text-2xl font-extrabold tracking-[-0.02em] text-[#111111]">Les formules CloseOS</h2>
      <p className="mt-3 max-w-2xl leading-relaxed text-stone-600">
        Nous ne publions pas les tarifs d'iClosed : ils évoluent et nous ne les vérifions pas en continu.
        Voici en revanche la grille CloseOS, en mensuel et en annuel.
      </p>
      <div className="mt-6 overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <table className="w-full min-w-[560px] border-collapse text-center text-sm">
          <thead>
            <tr className="bg-stone-50">
              <th className="border-b border-stone-200 p-4 text-left font-bold text-[#111111]"> </th>
              <th className="border-b border-stone-200 p-4 font-bold text-[#111111]">Solo</th>
              <th className="border-b border-stone-200 p-4 font-bold text-[#111111]">Business</th>
              <th className="border-b border-stone-200 p-4 font-bold text-[#111111]">Business + Acquisition</th>
            </tr>
          </thead>
          <tbody>
            {pricingRows.map((row) => (
              <tr key={row.label}>
                <td className="border-b border-stone-100 p-4 text-left font-medium text-[#111111]">{row.label}</td>
                <td className="border-b border-stone-100 p-4"><PricingCell value={row.solo} /></td>
                <td className="border-b border-stone-100 p-4"><PricingCell value={row.biz} /></td>
                <td className="border-b border-stone-100 p-4"><PricingCell value={row.acq} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-stone-400">
        Grille complète, sièges supplémentaires et CloseOS Sign sur la{' '}
        <Link to="/tarifs" className="font-semibold text-[#111111] underline decoration-amber-400 decoration-2 underline-offset-4">
          page Tarifs
        </Link>.
      </p>

      <h2 className="mt-16 text-2xl font-extrabold tracking-[-0.02em] text-[#111111]">Quel outil selon votre situation</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className={CARD}>
          <h3 className="font-bold text-[#111111]">Votre agenda est vide</h3>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">
            Le problème est en amont. Un outil de qualification comme iClosed est pertinent — ou le booking
            intégré de CloseOS si vous voulez éviter un abonnement de plus.
          </p>
        </div>
        <div className={CARD}>
          <h3 className="font-bold text-[#111111]">Vous perdez des prospects après l'appel</h3>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">
            Il vous manque un pipeline et des relances, pas un meilleur outil de booking. C'est le périmètre
            de CloseOS Sales.
          </p>
        </div>
        <div className={CARD}>
          <h3 className="font-bold text-[#111111]">Quelqu'un vend pour vous</h3>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">
            Attribution des leads, KPIs par membre, commissions : aucun outil de prise de rendez-vous ne
            traite ça. C'est CloseOS Business.
          </p>
        </div>
      </div>

      <h2 className="mt-16 text-2xl font-extrabold tracking-[-0.02em] text-[#111111]">Questions fréquentes</h2>
      <div className="mt-6 space-y-3">
        {faqItems.map((item, i) => (
          <div key={item.q} className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
            <button
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
              className="flex w-full items-center justify-between gap-4 p-5 text-left"
              aria-expanded={openFaq === i}
            >
              <span className="font-bold text-[#111111]">{item.q}</span>
              <ChevronDown
                className={`h-5 w-5 shrink-0 text-stone-400 transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`}
              />
            </button>
            <div className={`overflow-hidden px-5 transition-all duration-300 ${openFaq === i ? 'max-h-[40rem] pb-5' : 'max-h-0'}`}>
              <p className="leading-relaxed text-stone-600">{item.a}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-16 rounded-2xl border border-stone-200 bg-white p-8">
        <h2 className="text-2xl font-extrabold tracking-[-0.02em] text-[#111111]">Faites le test vous-même</h2>
        <p className="mt-3 max-w-xl leading-relaxed text-stone-600">
          Un comparatif ne remplace pas un essai. CloseOS s'essaie gratuitement, sans engagement, et se
          connecte à iClosed si vous voulez garder les deux.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/tarifs" className={BTN_PRIMARY}>Voir les tarifs</Link>
          <Link to="/comparatifs/alternative-iclosed" className={BTN_GHOST}>Alternative à iClosed</Link>
          <Link to="/ressources/iclosed-avis" className={BTN_GHOST}>Comprendre iClosed</Link>
        </div>
      </div>
    </ContentShell>
  );
}
