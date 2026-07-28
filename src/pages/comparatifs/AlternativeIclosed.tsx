import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, Check, X, ChevronDown, Layers, BarChart3, Users } from 'lucide-react';

export default function AlternativeIclosed() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    document.title = 'Alternative à iClosed, Découvrez CloseOS';
    document.querySelector('meta[name="description"]')?.setAttribute('content', 'Vous cherchez une alternative à iClosed ? CloseOS est le CRM tout-en-un pour closers : pipeline, callroom VoIP, facturation et gestion d\'équipe. Essai gratuit.');
    document.getElementById('canonical')?.setAttribute('href', 'https://www.closeos.fr/comparatifs/alternative-iclosed');
    document.getElementById('og-url')?.setAttribute('content', 'https://www.closeos.fr/comparatifs/alternative-iclosed');
    document.getElementById('og-title')?.setAttribute('content', 'Alternative à iClosed, Découvrez CloseOS');
    document.getElementById('og-description')?.setAttribute('content', 'Vous cherchez une alternative à iClosed ? CloseOS est le CRM tout-en-un pour closers : pipeline, callroom VoIP, facturation et gestion d\'équipe. Essai gratuit.');
    document.getElementById('tw-url')?.setAttribute('content', 'https://www.closeos.fr/comparatifs/alternative-iclosed');
    document.getElementById('tw-title')?.setAttribute('content', 'Alternative à iClosed, Découvrez CloseOS');
    document.getElementById('tw-description')?.setAttribute('content', 'Vous cherchez une alternative à iClosed ? CloseOS est le CRM tout-en-un pour closers.');
    document.documentElement.lang = 'fr';

    document.querySelectorAll('script[data-alt-iclosed-ld]').forEach(el => el.remove());
    const bc = document.createElement('script');
    bc.type = 'application/ld+json';
    bc.setAttribute('data-alt-iclosed-ld', 'true');
    bc.textContent = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://www.closeos.fr' },
        { '@type': 'ListItem', position: 2, name: 'Comparatifs', item: 'https://www.closeos.fr/comparatifs/alternative-iclosed' },
        { '@type': 'ListItem', position: 3, name: 'Alternative iClosed', item: 'https://www.closeos.fr/comparatifs/alternative-iclosed' },
      ]
    });
    document.head.appendChild(bc);

    const faq = document.createElement('script');
    faq.type = 'application/ld+json';
    faq.setAttribute('data-alt-iclosed-ld', 'true');
    faq.textContent = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: [
        { '@type': 'Question', name: 'Est-ce que CloseOS remplace iClosed ?', acceptedAnswer: { '@type': 'Answer', text: 'Oui. CloseOS intègre nativement un système de booking avec questionnaire de qualification, en plus du CRM, de la callroom Google Meet, du pipeline, de la facturation et de la gestion d\'équipe. Vous n\'avez plus besoin d\'un outil séparé pour la prise de rendez-vous. Si vous utilisez déjà iClosed, CloseOS peut s\'y connecter via webhook pendant votre transition.' } },
        { '@type': 'Question', name: 'Est-ce que je peux migrer mes données d\'iClosed vers CloseOS ?', acceptedAnswer: { '@type': 'Answer', text: 'L\'intégration webhook permet de synchroniser les nouveaux rendez-vous automatiquement. Pour les données historiques, contactez le support.' } },
        { '@type': 'Question', name: 'Combien coûte CloseOS par rapport à iClosed ?', acceptedAnswer: { '@type': 'Answer', text: 'CloseOS Sales commence à 34€/mois. CloseOS Business commence à 39€/mois (Solo) et 59€/mois (Business). Essai gratuit de 20 jours.' } },
      ]
    });
    document.head.appendChild(faq);

    return () => { document.querySelectorAll('script[data-alt-iclosed-ld]').forEach(el => el.remove()); };
  }, []);

  const comparisonRows = [
    { feature: 'Booking / prise de RDV', iclosed: true, iclosedLabel: 'Cœur de métier', closeos: true, closeosLabel: 'Booking intégré' },
    { feature: 'Qualification de leads', iclosed: true, iclosedLabel: 'Formulaires + scoring', closeos: true, closeosLabel: 'Via pipeline et tags' },
    { feature: 'Pipeline de vente visuel', iclosed: false, iclosedLabel: '', closeos: true, closeosLabel: 'Drag-and-drop personnalisable' },
    { feature: 'Callroom VoIP intégrée', iclosed: false, iclosedLabel: '', closeos: true, closeosLabel: 'Appels illimités + enregistrement' },
    { feature: 'Facturation automatique', iclosed: false, iclosedLabel: '', closeos: true, closeosLabel: 'Connectée à Stripe' },
    { feature: 'KPIs de closing', iclosed: false, iclosedLabel: '', closeos: true, closeosLabel: 'Taux de closing, CA, objectifs' },
    { feature: "Gestion d'équipe", iclosed: false, iclosedLabel: '', closeos: true, closeosLabel: 'Multi-rôles (closer, setter, admin)' },
    { feature: "Campagnes d'acquisition", iclosed: false, iclosedLabel: '', closeos: true, closeosLabel: 'Tracking UTM + analytics' },
    { feature: 'Intégration iClosed', iclosed: null, iclosedLabel: '—', closeos: true, closeosLabel: 'Webhook natif' },
    { feature: 'Intégration HubSpot', iclosed: false, iclosedLabel: '', closeos: true, closeosLabel: 'Bidirectionnelle' },
    { feature: 'Intégration Pipedrive', iclosed: false, iclosedLabel: '', closeos: true, closeosLabel: 'Bidirectionnelle' },
    { feature: 'Prix à partir de', iclosed: null, iclosedLabel: '~29€/mois', closeos: null, closeosLabel: '39€/mois' },
  ];

  const faqItems = [
    {
      question: 'Est-ce que CloseOS remplace iClosed ?',
      answer: 'Oui. CloseOS intègre nativement un système de booking avec questionnaire de qualification, en plus du CRM, de la callroom Google Meet, du pipeline, de la facturation et de la gestion d\'équipe. Vous n\'avez plus besoin d\'un outil séparé pour la prise de rendez-vous. Si vous utilisez déjà iClosed, CloseOS peut s\'y connecter via webhook pendant votre transition.',
    },
    {
      question: "Est-ce que je peux migrer mes données d'iClosed vers CloseOS ?",
      answer: "L'intégration webhook permet de synchroniser les nouveaux rendez-vous automatiquement. Pour les données historiques, contactez notre support.",
    },
    {
      question: 'Combien coûte CloseOS par rapport à iClosed ?',
      answer: 'CloseOS Sales commence à 34€/mois. CloseOS Business commence à 39€/mois pour la formule Solo et 59€/mois pour Business. Essai gratuit de 20 jours.',
    },
  ];

  const renderStatus = (value: boolean | null, label: string) => {
    if (value === null) return <span className="text-slate-300 text-sm">{label}</span>;
    if (value) return (
      <span className="flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#00E676]/20">
          <Check className="h-3.5 w-3.5 text-[#00E676]" />
        </span>
        <span className="text-sm text-slate-300">{label}</span>
      </span>
    );
    return (
      <span className="flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/20">
          <X className="h-3.5 w-3.5 text-red-400" />
        </span>
      </span>
    );
  };

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
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6 }}
        className="pt-24 pb-16"
      >
        <div className="mx-auto max-w-4xl px-6 pt-12 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            Alternative à iClosed :{' '}
            <span className="text-[#00E676]">Pourquoi les closers choisissent CloseOS</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-400">
            iClosed est un outil de booking et de qualification de leads populaire dans l'écosystème francophone du closing.
            Mais si vous cherchez un CRM complet qui va au-delà de la prise de rendez-vous, CloseOS offre une solution
            tout-en-un conçue spécifiquement pour les closers et les infopreneurs.
          </p>
        </div>
      </motion.section>

      {/* Two tools side by side */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6 }}
        className="pb-20"
      >
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-3xl font-bold text-center mb-4">iClosed et CloseOS, deux outils complémentaires</h2>
          <p className="text-center text-slate-400 mb-12 max-w-2xl mx-auto">
            Il est important de comprendre que iClosed et CloseOS ne sont pas des concurrents directs.
            Ils répondent à des besoins différents et peuvent même fonctionner ensemble.
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
              <h3 className="text-xl font-bold mb-3">iClosed</h3>
              <p className="text-slate-400 leading-relaxed">
                Outil de booking et de qualification de leads. Alternative à Calendly enrichie de fonctionnalités
                vente : formulaires de qualification, scoring de leads, assignation aux closers.{' '}
                <span className="text-slate-200 font-medium">Point fort : prise de rendez-vous qualifiés.</span>
              </p>
            </div>
            <div className="rounded-2xl border border-[#00E676]/30 bg-[#00E676]/5 p-8">
              <h3 className="text-xl font-bold mb-3">CloseOS</h3>
              <p className="text-slate-400 leading-relaxed">
                CRM complet pour closers. Couvre tout le processus de vente après la prise de rendez-vous :
                pipeline visuel, callroom VoIP intégrée, facturation automatique, KPIs de closing, gestion d'équipe.{' '}
                <span className="text-slate-200 font-medium">S'intègre nativement avec iClosed via webhook.</span>
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Comparison table */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6 }}
        className="pb-20"
      >
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-3xl font-bold text-center mb-12">Comparaison détaillée</h2>
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="min-w-[600px] w-full">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Fonctionnalité</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">iClosed</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#00E676]">CloseOS</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, i) => (
                  <tr key={row.feature} className={`border-b border-white/5 ${i % 2 === 1 ? 'bg-white/5' : ''}`}>
                    <td className="px-6 py-4 text-sm font-medium text-slate-200">{row.feature}</td>
                    <td className="px-6 py-4">{renderStatus(row.iclosed, row.iclosedLabel)}</td>
                    <td className="px-6 py-4">{renderStatus(row.closeos, row.closeosLabel)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </motion.section>

      {/* Why closers migrate */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6 }}
        className="pb-20"
      >
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-3xl font-bold text-center mb-12">Pourquoi les closers migrent vers CloseOS</h2>
          <div className="grid gap-8 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#00E676]/10">
                <Layers className="h-6 w-6 text-[#00E676]" />
              </div>
              <h3 className="text-lg font-bold mb-3">Un seul outil au lieu de trois</h3>
              <p className="text-sm leading-relaxed text-slate-400">
                Avec iClosed seul, vous avez besoin d'un CRM séparé pour suivre votre pipeline, d'un outil de
                facturation, et parfois d'un outil d'appel. CloseOS remplace tout ça.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#00E676]/10">
                <BarChart3 className="h-6 w-6 text-[#00E676]" />
              </div>
              <h3 className="text-lg font-bold mb-3">Des KPIs pensés pour le closing</h3>
              <p className="text-sm leading-relaxed text-slate-400">
                Les CRM généralistes ne trackent pas les métriques spécifiques au closing : taux de closing par source,
                CA par appel, évolution des objectifs. CloseOS est conçu autour de ces KPIs.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#00E676]/10">
                <Users className="h-6 w-6 text-[#00E676]" />
              </div>
              <h3 className="text-lg font-bold mb-3">Gestion d'équipe native</h3>
              <p className="text-sm leading-relaxed text-slate-400">
                Si vous êtes infopreneur avec des closers, CloseOS Business vous donne un tableau de bord complet
                pour piloter votre équipe.
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* FAQ */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6 }}
        className="pb-20"
      >
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-3xl font-bold text-center mb-12">Questions fréquentes</h2>
          <div className="space-y-3">
            {faqItems.map((item, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between px-6 py-5 text-left"
                >
                  <span className="font-semibold text-slate-100 pr-4">{item.question}</span>
                  <ChevronDown className={`h-5 w-5 flex-shrink-0 text-slate-400 transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                <div className={`overflow-hidden transition-all duration-300 ${openFaq === i ? 'max-h-40 pb-5' : 'max-h-0'}`}>
                  <p className="px-6 text-sm leading-relaxed text-slate-400">{item.answer}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* CTA */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6 }}
        className="pb-20"
      >
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold mb-6">Prêt à tout gérer dans un seul outil ?</h2>
          <Link
            to="/register"
            className="group inline-flex items-center gap-2 rounded-full bg-[#00E676] px-8 py-3.5 text-base font-bold text-slate-950 hover:bg-[#00ff84] transition-colors"
          >
            Essayer CloseOS gratuitement
            <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </motion.section>

      {/* Internal links */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6 }}
        className="pb-20"
      >
        <div className="mx-auto max-w-4xl px-6">
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link to="/tarifs" className="rounded-full border border-white/10 px-5 py-2 text-slate-400 hover:text-white hover:border-white/30 transition-colors">Tarifs</Link>
            <Link to="/landing" className="rounded-full border border-white/10 px-5 py-2 text-slate-400 hover:text-white hover:border-white/30 transition-colors">Sales</Link>
            <Link to="/business" className="rounded-full border border-white/10 px-5 py-2 text-slate-400 hover:text-white hover:border-white/30 transition-colors">Business</Link>
            <Link to="/fonctionnalites/crm-closer" className="rounded-full border border-white/10 px-5 py-2 text-slate-400 hover:text-white hover:border-white/30 transition-colors">CRM Closer</Link>
          </div>
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
