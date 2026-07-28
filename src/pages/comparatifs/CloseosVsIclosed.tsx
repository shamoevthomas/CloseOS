import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, ChevronDown, Check, X, AlertTriangle } from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

const featureRows: { cat: string; feature: string; iclosed: string; closeos: string }[] = [
  { cat: 'Booking', feature: 'Prise de rendez-vous en ligne', iclosed: 'yes-core', closeos: 'yes' },
  { cat: 'Booking', feature: 'Formulaire de qualification pre-call', iclosed: 'yes-advanced', closeos: 'warn' },
  { cat: 'Booking', feature: 'Scoring de leads', iclosed: 'yes', closeos: 'no' },
  { cat: 'Booking', feature: 'Assignation automatique aux closers', iclosed: 'yes', closeos: 'yes' },
  { cat: 'CRM', feature: 'Pipeline de vente visuel', iclosed: 'no', closeos: 'yes-dnd' },
  { cat: 'CRM', feature: 'Fiches prospects détaillées', iclosed: 'no', closeos: 'yes-hist' },
  { cat: 'CRM', feature: 'Gestion des contacts', iclosed: 'no', closeos: 'yes' },
  { cat: 'CRM', feature: 'Import/export CSV', iclosed: 'no', closeos: 'yes' },
  { cat: 'Appels', feature: 'Callroom VoIP intégrée', iclosed: 'no', closeos: 'yes-voip' },
  { cat: 'Appels', feature: "Enregistrement d'appels", iclosed: 'no', closeos: 'yes' },
  { cat: 'Appels', feature: 'Cockpit de session', iclosed: 'no', closeos: 'yes' },
  { cat: 'Finance', feature: 'Facturation automatique', iclosed: 'no', closeos: 'yes-stripe' },
  { cat: 'Finance', feature: "Suivi du chiffre d'affaires", iclosed: 'no', closeos: 'yes' },
  { cat: 'KPIs', feature: 'Taux de closing', iclosed: 'no', closeos: 'yes' },
  { cat: 'KPIs', feature: 'CA par appel', iclosed: 'no', closeos: 'yes' },
  { cat: 'KPIs', feature: 'Objectifs personnalisés', iclosed: 'no', closeos: 'yes' },
  { cat: 'Équipe', feature: 'Gestion multi-rôles', iclosed: 'no', closeos: 'yes-biz' },
  { cat: 'Équipe', feature: 'KPIs par membre', iclosed: 'no', closeos: 'yes-biz' },
  { cat: 'Équipe', feature: 'Onboarding automatisé', iclosed: 'no', closeos: 'yes-biz' },
  { cat: 'Acquisition', feature: 'Campagnes avec tracking UTM', iclosed: 'no', closeos: 'yes-acq' },
  { cat: 'Intégrations', feature: 'HubSpot', iclosed: 'no', closeos: 'yes-bi' },
  { cat: 'Intégrations', feature: 'Pipedrive', iclosed: 'no', closeos: 'yes-bi' },
  { cat: 'Intégrations', feature: 'Zapier / Make / n8n', iclosed: 'no', closeos: 'yes' },
  { cat: 'Intégrations', feature: 'CloseOS ↔ iClosed', iclosed: 'dash', closeos: 'yes-wh' },
  { cat: 'Langue', feature: 'Interface en français', iclosed: 'yes', closeos: 'yes' },
];

function CellBadge({ value }: { value: string }) {
  if (value === 'no') return <span className="inline-flex items-center gap-1.5 text-red-400 font-medium"><X className="h-4 w-4" /> Non</span>;
  if (value === 'dash') return <span className="text-slate-500">—</span>;
  if (value === 'warn') return <span className="inline-flex items-center gap-1.5 text-amber-400 font-medium"><AlertTriangle className="h-3.5 w-3.5" /> Basique</span>;
  const labels: Record<string, string> = {
    yes: 'Oui',
    'yes-core': 'Cœur de métier',
    'yes-advanced': 'Avancé',
    'yes-dnd': 'Drag-and-drop',
    'yes-hist': 'Historique complet',
    'yes-voip': 'Appels illimités',
    'yes-stripe': 'Stripe Connect',
    'yes-biz': 'Business',
    'yes-acq': 'Business + Acquisition',
    'yes-bi': 'Bidirectionnelle',
    'yes-wh': 'Webhook natif',
  };
  return <span className="inline-flex items-center gap-1.5 text-[#00E676] font-medium"><Check className="h-4 w-4" /> {labels[value] ?? 'Oui'}</span>;
}

const pricingRows = [
  { label: 'Prix mensuel', iclosed: '~29€/mois', solo: '39€/mois', biz: '59€/mois', acq: '99€/mois' },
  { label: 'Essai gratuit', iclosed: '14 jours', solo: '20 jours', biz: '20 jours', acq: '20 jours' },
  { label: 'Booking', iclosed: 'yes', solo: 'yes', biz: 'yes', acq: 'yes' },
  { label: 'CRM complet', iclosed: 'no', solo: 'yes', biz: 'yes', acq: 'yes' },
  { label: 'Callroom VoIP', iclosed: 'no', solo: 'yes', biz: 'yes', acq: 'yes' },
  { label: 'Facturation', iclosed: 'no', solo: 'yes', biz: 'yes', acq: 'yes' },
  { label: "Gestion d'équipe", iclosed: 'no', solo: 'no', biz: 'yes', acq: 'yes' },
  { label: 'Acquisition', iclosed: 'no', solo: 'no', biz: 'no', acq: 'yes' },
];

function PricingCell({ value }: { value: string }) {
  if (value === 'yes') return <Check className="h-4 w-4 text-[#00E676] mx-auto" />;
  if (value === 'no') return <X className="h-4 w-4 text-red-400 mx-auto" />;
  return <span>{value}</span>;
}

const faqItems = [
  {
    q: 'Est-ce que CloseOS et iClosed sont des concurrents ?',
    a: "Non. iClosed est un outil de booking et de qualification de leads (comparable à Calendly). CloseOS est un CRM complet pour closers (comparable à HubSpot spécialisé). Ils couvrent des étapes différentes du processus de vente et fonctionnent très bien ensemble.",
  },
  {
    q: 'Puis-je utiliser les deux en même temps ?',
    a: "Oui, c'est même recommandé pour les infopreneurs avec une équipe. iClosed gère la prise de rendez-vous qualifiés, CloseOS gère tout le reste (pipeline, appels, facturation, KPIs, équipe). Les deux se connectent via webhook natif.",
  },
  {
    q: 'Quel est le meilleur CRM pour un closer en 2026 ?',
    a: "Pour un closer francophone high-ticket, CloseOS est le seul CRM conçu spécifiquement pour ce métier. Les CRM généralistes (HubSpot, Pipedrive) fonctionnent mais nécessitent beaucoup de configuration et ne disposent pas de la callroom VoIP ni des KPIs de closing natifs.",
  },
];

export default function CloseosVsIclosed() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    document.title = 'CloseOS vs iClosed, Comparatif détaillé 2026';
    document.querySelector('meta[name="description"]')?.setAttribute('content', "CloseOS vs iClosed : quel outil choisir pour votre activité de closing ? Comparatif complet des fonctionnalités, tarifs et cas d'usage.");
    document.getElementById('canonical')?.setAttribute('href', 'https://www.closeos.fr/comparatifs/closeos-vs-iclosed');
    document.getElementById('og-url')?.setAttribute('content', 'https://www.closeos.fr/comparatifs/closeos-vs-iclosed');
    document.getElementById('og-title')?.setAttribute('content', 'CloseOS vs iClosed, Comparatif détaillé 2026');
    document.getElementById('og-description')?.setAttribute('content', "CloseOS vs iClosed : quel outil choisir ? Comparatif complet des fonctionnalités, tarifs et cas d'usage.");
    document.getElementById('tw-url')?.setAttribute('content', 'https://www.closeos.fr/comparatifs/closeos-vs-iclosed');
    document.getElementById('tw-title')?.setAttribute('content', 'CloseOS vs iClosed, Comparatif détaillé 2026');
    document.getElementById('tw-description')?.setAttribute('content', 'Comparatif complet CloseOS vs iClosed : fonctionnalités, tarifs, cas d\'usage.');
    document.documentElement.lang = 'fr';

    document.querySelectorAll('script[data-vs-iclosed-ld]').forEach(el => el.remove());
    const bc = document.createElement('script');
    bc.type = 'application/ld+json';
    bc.setAttribute('data-vs-iclosed-ld', 'true');
    bc.textContent = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://www.closeos.fr' },
        { '@type': 'ListItem', position: 2, name: 'Comparatifs', item: 'https://www.closeos.fr/comparatifs/closeos-vs-iclosed' },
        { '@type': 'ListItem', position: 3, name: 'CloseOS vs iClosed', item: 'https://www.closeos.fr/comparatifs/closeos-vs-iclosed' },
      ]
    });
    document.head.appendChild(bc);

    const faq = document.createElement('script');
    faq.type = 'application/ld+json';
    faq.setAttribute('data-vs-iclosed-ld', 'true');
    faq.textContent = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: [
        { '@type': 'Question', name: 'Est-ce que CloseOS et iClosed sont des concurrents ?', acceptedAnswer: { '@type': 'Answer', text: 'Non. iClosed est un outil de booking (comparable à Calendly). CloseOS est un CRM complet pour closers (comparable à HubSpot spécialisé). Ils fonctionnent très bien ensemble.' } },
        { '@type': 'Question', name: 'Puis-je utiliser les deux en même temps ?', acceptedAnswer: { '@type': 'Answer', text: "Oui, c'est recommandé pour les infopreneurs avec une équipe. iClosed gère les rendez-vous, CloseOS gère pipeline, appels, facturation, KPIs et équipe. Connexion via webhook natif." } },
        { '@type': 'Question', name: 'Quel est le meilleur CRM pour un closer en 2026 ?', acceptedAnswer: { '@type': 'Answer', text: 'Pour un closer francophone high-ticket, CloseOS est le seul CRM conçu spécifiquement pour ce métier avec callroom VoIP et KPIs de closing natifs.' } },
      ]
    });
    document.head.appendChild(faq);

    return () => { document.querySelectorAll('script[data-vs-iclosed-ld]').forEach(el => el.remove()); };
  }, []);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100">
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/5 bg-[#020617]/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link to="/"><img src="/logo-sales.png" alt="CloseOS" className="h-10 w-auto" width={100} height={40} /></Link>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <Link to="/landing" className="hover:text-white transition-colors">Sales</Link>
            <Link to="/business" className="hover:text-white transition-colors">Business</Link>
            <Link to="/fonctionnalites" className="hover:text-white transition-colors">Fonctionnalités</Link>
            <Link to="/tarifs" className="hover:text-white transition-colors">Tarifs</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="hidden sm:flex items-center rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white hover:bg-white/10">Connexion</Link>
            <Link to="/register" className="group flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-bold text-slate-950 hover:bg-blue-50 transition-all">Essai gratuit <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" /></Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <motion.section
        className="pt-24 pb-16 px-6"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={stagger}
      >
        <div className="mx-auto max-w-4xl text-center">
          <motion.p variants={fadeUp} className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#00E676]">
            Comparatif 2026
          </motion.p>
          <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]">
            CloseOS vs iClosed <span className="text-slate-400">:</span><br />
            <span className="text-slate-400">Quel outil pour votre activité de closing ?</span>
          </motion.h1>
          <motion.p variants={fadeUp} className="mx-auto mt-6 max-w-2xl text-lg text-slate-400 leading-relaxed">
            CloseOS et iClosed sont deux outils présents dans l'écosystème francophone du closing, mais ils ne font pas la même chose. iClosed est un outil de booking et de qualification de leads. CloseOS est un CRM complet pour closers avec pipeline, callroom VoIP, facturation et gestion d'équipe. Ce comparatif vous aide à comprendre quel outil correspond à votre besoin, ou si vous devriez utiliser les deux.
          </motion.p>
        </div>
      </motion.section>

      {/* Summary cards */}
      <motion.section
        className="px-6 pb-20"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={stagger}
      >
        <div className="mx-auto max-w-5xl">
          <motion.h2 variants={fadeUp} className="text-3xl font-bold text-center mb-10">Résumé rapide</motion.h2>
          <div className="grid md:grid-cols-2 gap-6">
            {/* iClosed card */}
            <motion.div variants={fadeUp} className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-xl font-bold mb-4">iClosed</h3>
              <ul className="space-y-3 text-sm text-slate-300">
                <li><span className="font-semibold text-slate-100">Catégorie :</span> Outil de booking et qualification de leads</li>
                <li><span className="font-semibold text-slate-100">Comparable à :</span> Calendly enrichi de fonctionnalités de vente</li>
                <li><span className="font-semibold text-[#00E676]">Point fort :</span> Prise de rendez-vous qualifiés, formulaires de scoring</li>
                <li><span className="font-semibold text-red-400">Point faible :</span> Pas de CRM, pas de pipeline, pas de facturation, pas de gestion d'équipe</li>
              </ul>
            </motion.div>
            {/* CloseOS card */}
            <motion.div variants={fadeUp} className="rounded-2xl border border-[#00E676]/30 bg-white/5 p-6">
              <h3 className="text-xl font-bold mb-4">CloseOS</h3>
              <ul className="space-y-3 text-sm text-slate-300">
                <li><span className="font-semibold text-slate-100">Catégorie :</span> CRM tout-en-un pour closers</li>
                <li><span className="font-semibold text-slate-100">Comparable à :</span> HubSpot/Pipedrive spécialisé pour le closing high-ticket</li>
                <li><span className="font-semibold text-[#00E676]">Point fort :</span> Pipeline complet, callroom VoIP, facturation, KPIs, gestion d'équipe</li>
                <li><span className="font-semibold text-red-400">Point faible :</span> Booking moins poussé que iClosed (pas de scoring de leads intégré)</li>
              </ul>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* Feature comparison table */}
      <motion.section
        className="px-6 pb-20"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }}
        variants={stagger}
      >
        <div className="mx-auto max-w-5xl">
          <motion.h2 variants={fadeUp} className="text-3xl font-bold text-center mb-10">Comparaison fonctionnalité par fonctionnalité</motion.h2>
          <motion.div variants={fadeUp} className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="min-w-[700px] w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-4 py-3 text-left font-semibold text-slate-400">Catégorie</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-400">Fonctionnalité</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-400">iClosed</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-400">CloseOS</th>
                </tr>
              </thead>
              <tbody>
                {featureRows.map((row, i) => (
                  <tr key={i} className={`border-b border-white/5 ${i % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                    <td className="px-4 py-3 font-medium text-slate-300">{row.cat}</td>
                    <td className="px-4 py-3 text-slate-300">{row.feature}</td>
                    <td className="px-4 py-3 text-center"><CellBadge value={row.iclosed} /></td>
                    <td className="px-4 py-3 text-center"><CellBadge value={row.closeos} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </div>
      </motion.section>

      {/* Scenarios */}
      <motion.section
        className="px-6 pb-20"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={stagger}
      >
        <div className="mx-auto max-w-4xl">
          <motion.h2 variants={fadeUp} className="text-3xl font-bold text-center mb-10">Quel outil choisir selon votre situation</motion.h2>
          <div className="grid sm:grid-cols-2 gap-6">
            <motion.div variants={fadeUp} className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-lg font-bold mb-3">Vous êtes setter ou appointment setter</h3>
              <p className="text-sm text-slate-400 leading-relaxed">iClosed est probablement suffisant. Votre job est de qualifier les leads et les passer aux closers.</p>
            </motion.div>
            <motion.div variants={fadeUp} className="rounded-2xl border border-[#00E676]/30 bg-white/5 p-6">
              <h3 className="text-lg font-bold mb-3">Vous êtes closer indépendant</h3>
              <p className="text-sm text-slate-400 leading-relaxed">CloseOS Sales est fait pour vous. Pipeline, appels et facturation. Si vous recevez vos leads via iClosed, connectez les deux.</p>
            </motion.div>
            <motion.div variants={fadeUp} className="rounded-2xl border border-[#00E676]/30 bg-white/5 p-6">
              <h3 className="text-lg font-bold mb-3">Vous êtes infopreneur avec une équipe de vente</h3>
              <p className="text-sm text-slate-400 leading-relaxed">CloseOS Business + iClosed est la combinaison idéale. iClosed pour les rendez-vous, CloseOS pour piloter l'équipe.</p>
            </motion.div>
            <motion.div variants={fadeUp} className="rounded-2xl border border-[#00E676]/30 bg-white/5 p-6">
              <h3 className="text-lg font-bold mb-3">Vous voulez tout simplifier</h3>
              <p className="text-sm text-slate-400 leading-relaxed">CloseOS seul peut couvrir booking + CRM + facturation + KPIs. Un outil de moins.</p>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* Pricing comparison */}
      <motion.section
        className="px-6 pb-20"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }}
        variants={stagger}
      >
        <div className="mx-auto max-w-5xl">
          <motion.h2 variants={fadeUp} className="text-3xl font-bold text-center mb-10">Comparaison des tarifs</motion.h2>
          <motion.div variants={fadeUp} className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="min-w-[700px] w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-4 py-3 text-left font-semibold text-slate-400" />
                  <th className="px-4 py-3 text-center font-semibold text-slate-400">iClosed</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-400">CloseOS Solo</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-400">CloseOS Business</th>
                  <th className="px-4 py-3 text-center font-semibold text-[#00E676]">Business + Acquisition</th>
                </tr>
              </thead>
              <tbody>
                {pricingRows.map((row, i) => (
                  <tr key={i} className={`border-b border-white/5 ${i % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                    <td className="px-4 py-3 font-medium text-slate-300">{row.label}</td>
                    <td className="px-4 py-3 text-center text-slate-300"><PricingCell value={row.iclosed} /></td>
                    <td className="px-4 py-3 text-center text-slate-300"><PricingCell value={row.solo} /></td>
                    <td className="px-4 py-3 text-center text-slate-300"><PricingCell value={row.biz} /></td>
                    <td className="px-4 py-3 text-center text-slate-300"><PricingCell value={row.acq} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </div>
      </motion.section>

      {/* FAQ */}
      <motion.section
        className="px-6 pb-20"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={stagger}
      >
        <div className="mx-auto max-w-3xl">
          <motion.h2 variants={fadeUp} className="text-3xl font-bold text-center mb-10">Questions fréquentes</motion.h2>
          <div className="space-y-3">
            {faqItems.map((item, i) => (
              <motion.div key={i} variants={fadeUp} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between px-6 py-4 text-left font-semibold text-slate-100 hover:bg-white/5 transition-colors"
                >
                  <span>{item.q}</span>
                  <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ${openFaq === i ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0'}`}
                >
                  <p className="px-6 pb-5 text-sm text-slate-400 leading-relaxed">{item.a}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* CTA */}
      <motion.section
        className="px-6 pb-24"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={stagger}
      >
        <div className="mx-auto max-w-3xl text-center">
          <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-extrabold mb-4">
            Faites le test vous-même.
          </motion.h2>
          <motion.p variants={fadeUp} className="text-lg text-slate-400 mb-8">
            Essayez CloseOS gratuitement pendant 20 jours et comparez.
          </motion.p>
          <motion.div variants={fadeUp}>
            <Link
              to="/register"
              className="group inline-flex items-center gap-2 rounded-full bg-[#00E676] px-8 py-3.5 text-base font-bold text-slate-950 hover:brightness-110 transition-all"
            >
              Démarrer l'essai gratuit
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        </div>
      </motion.section>

      {/* Internal links */}
      <motion.section
        className="px-6 pb-16"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={stagger}
      >
        <div className="mx-auto max-w-3xl">
          <motion.div variants={fadeUp} className="flex flex-wrap justify-center gap-3 text-sm">
            <Link to="/tarifs" className="rounded-full border border-white/10 px-4 py-2 text-slate-400 hover:text-white hover:border-white/30 transition-colors">Tarifs</Link>
            <Link to="/fonctionnalites/crm-closer" className="rounded-full border border-white/10 px-4 py-2 text-slate-400 hover:text-white hover:border-white/30 transition-colors">CRM Closer</Link>
            <Link to="/landing" className="rounded-full border border-white/10 px-4 py-2 text-slate-400 hover:text-white hover:border-white/30 transition-colors">CloseOS Sales</Link>
            <Link to="/business" className="rounded-full border border-white/10 px-4 py-2 text-slate-400 hover:text-white hover:border-white/30 transition-colors">CloseOS Business</Link>
            <Link to="/comparatifs/alternative-iclosed" className="rounded-full border border-white/10 px-4 py-2 text-slate-400 hover:text-white hover:border-white/30 transition-colors">Alternatives à iClosed</Link>
          </motion.div>
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-[#020617] py-6 pb-16">
        <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <img src="/logo-sales.png" alt="CloseOS" className="h-6 w-auto" loading="lazy" width={72} height={24} />
          <div className="flex flex-wrap justify-center gap-4 text-xs text-slate-500">
            <span>&copy; 2026 CloseOS.fr</span><span className="hidden sm:inline">&bull;</span>
            <a href="/mentions-legales" className="hover:text-white transition-colors">Mentions légales</a><span className="hidden sm:inline">&bull;</span>
            <a href="/cgu" className="hover:text-white transition-colors">CGU</a><span className="hidden sm:inline">&bull;</span>
            <a href="/cgv" className="hover:text-white transition-colors">CGV</a><span className="hidden sm:inline">&bull;</span>
            <a href="/confidentialite" className="hover:text-white transition-colors">Confidentialité</a>
          </div>
          <div className="flex gap-6 text-xs">
            <a href="https://www.linkedin.com/in/thomas-shamoev-570885237/" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-white transition-colors">LinkedIn</a>
            <a href="mailto:support@closeos.fr" className="text-slate-500 hover:text-white transition-colors">support@closeos.fr</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
