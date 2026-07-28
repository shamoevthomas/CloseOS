import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Layers,
  GripVertical,
  Filter,
  TrendingUp,
  Phone,
  CreditCard,
  BarChart3,
  Globe,
  ChevronDown,
  Link2,
  Users,
  Building2,
} from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
};

const integrations = [
  { name: 'HubSpot', desc: 'synchronisation bidirectionnelle des contacts et deals' },
  { name: 'Pipedrive', desc: 'synchronisation bidirectionnelle du pipeline' },
  { name: 'GoHighLevel', desc: 'synchronisation bidirectionnelle des contacts' },
  { name: 'Airtable', desc: 'synchronisation bidirectionnelle des données' },
  { name: 'Systeme.io', desc: 'webhook entrant pour la capture de leads' },
  { name: 'iClosed', desc: 'webhook entrant pour les rendez-vous' },
  { name: 'Zapier, Make, n8n', desc: 'automatisations illimitées' },
];

const faqItems = [
  {
    q: 'Est-ce que CloseOS peut remplacer mon CRM actuel (HubSpot, Pipedrive)\u00a0?',
    a: 'Pour le closing, oui. CloseOS est conçu spécifiquement pour le processus de vente high ticket. Si vous utilisez HubSpot ou Pipedrive pour du marketing automation ou du lead nurturing complexe, vous pouvez les garder et synchroniser les données avec CloseOS grâce aux intégrations bidirectionnelles.',
  },
  {
    q: 'Combien de prospects puis-je gérer\u00a0?',
    a: "Il n'y a pas de limite sur le nombre de prospects, quelle que soit votre formule.",
  },
  {
    q: 'Est-ce que je peux importer mes prospects depuis un autre CRM\u00a0?',
    a: 'Oui. Vous pouvez importer vos contacts par CSV ou via les intégrations natives (HubSpot, Pipedrive). Contactez le support pour un accompagnement.',
  },
];

export default function CrmCloser() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    document.title = 'CRM Closer, Pipeline de vente pour closers | CloseOS';
    document.querySelector('meta[name="description"]')?.setAttribute('content', "Le CRM conçu pour les closers : pipeline visuel, suivi des prospects, historique d'appels, et KPIs de closing. Gérez toute votre activité dans un seul outil.");
    document.getElementById('canonical')?.setAttribute('href', 'https://www.closeos.fr/fonctionnalites/crm-closer');
    document.getElementById('og-url')?.setAttribute('content', 'https://www.closeos.fr/fonctionnalites/crm-closer');
    document.getElementById('og-title')?.setAttribute('content', 'CRM Closer, Pipeline de vente pour closers | CloseOS');
    document.getElementById('og-description')?.setAttribute('content', "Le CRM conçu pour les closers : pipeline visuel, suivi des prospects, historique d'appels, et KPIs de closing.");
    document.getElementById('tw-url')?.setAttribute('content', 'https://www.closeos.fr/fonctionnalites/crm-closer');
    document.getElementById('tw-title')?.setAttribute('content', 'CRM Closer, Pipeline de vente pour closers | CloseOS');
    document.getElementById('tw-description')?.setAttribute('content', 'Pipeline visuel, callroom intégrée, facturation et KPIs dans un seul CRM.');
    document.documentElement.lang = 'fr';

    document.querySelectorAll('script[data-crm-ld]').forEach(el => el.remove());
    const bc = document.createElement('script');
    bc.type = 'application/ld+json';
    bc.setAttribute('data-crm-ld', 'true');
    bc.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://www.closeos.fr' },
        { '@type': 'ListItem', position: 2, name: 'Fonctionnalités', item: 'https://www.closeos.fr/fonctionnalites' },
        { '@type': 'ListItem', position: 3, name: 'CRM Closer', item: 'https://www.closeos.fr/fonctionnalites/crm-closer' },
      ],
    });
    document.head.appendChild(bc);

    const faq = document.createElement('script');
    faq.type = 'application/ld+json';
    faq.setAttribute('data-crm-ld', 'true');
    faq.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        { '@type': 'Question', name: 'Est-ce que CloseOS peut remplacer mon CRM actuel (HubSpot, Pipedrive) ?', acceptedAnswer: { '@type': 'Answer', text: "Pour le closing, oui. CloseOS est conçu pour le processus de vente high ticket. Si vous utilisez HubSpot pour du marketing automation, gardez-le et synchronisez avec CloseOS." } },
        { '@type': 'Question', name: 'Combien de prospects puis-je gérer ?', acceptedAnswer: { '@type': 'Answer', text: "Il n'y a pas de limite sur le nombre de prospects, quelle que soit votre formule." } },
        { '@type': 'Question', name: 'Est-ce que je peux importer mes prospects depuis un autre CRM ?', acceptedAnswer: { '@type': 'Answer', text: 'Oui. Import CSV ou via intégrations natives (HubSpot, Pipedrive). Contactez le support pour un accompagnement.' } },
      ],
    });
    document.head.appendChild(faq);

    return () => {
      document.querySelectorAll('script[data-crm-ld]').forEach(el => el.remove());
    };
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
            <Link to="/sign" className="hover:text-white transition-colors">Sign</Link>
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
      <section className="pt-24">
        <div className="mx-auto max-w-7xl px-6 py-24 lg:py-32">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={stagger}
            className="max-w-3xl"
          >
            <motion.h1 variants={fadeUp} className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              CRM Closer, Le pipeline de vente conçu pour les{' '}
              <span className="text-[#00E676]">closers</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="mt-6 text-lg leading-relaxed text-slate-400 sm:text-xl">
              Les CRM généralistes comme HubSpot ou Salesforce ne sont pas pensés pour le métier de closer. Trop de fonctionnalités inutiles, pas assez de focus sur ce qui compte : votre pipeline, vos appels, votre taux de closing. CloseOS est le CRM conçu nativement pour les closers high ticket et les infopreneurs francophones.
            </motion.p>
            <motion.div variants={fadeUp} className="mt-10 flex flex-wrap gap-4">
              <Link to="/register" className="group inline-flex items-center gap-2 rounded-full bg-[#00E676] px-7 py-3 text-sm font-bold text-slate-950 hover:brightness-110 transition-all">
                Essayer gratuitement <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link to="/fonctionnalites" className="inline-flex items-center rounded-full border border-white/20 px-7 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors">
                Toutes les fonctionnalités
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Pipeline section */}
      <section className="border-t border-white/5">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={stagger}
          >
            <motion.h2 variants={fadeUp} className="text-3xl font-bold tracking-tight sm:text-4xl">
              Un pipeline pensé pour le closing
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-4 max-w-2xl text-lg text-slate-400">
              Le pipeline CloseOS est un pipeline visuel en drag-and-drop que vous personnalisez selon votre processus de vente. Chaque prospect a sa fiche complète avec l'historique des appels, notes, statut et montant potentiel. Vous voyez en un coup d'oeil où en est chaque deal.
            </motion.p>

            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: Layers, title: 'Étapes personnalisables', desc: 'Premier contact, Qualification, Démo, Négociation, Closing, Gagné/Perdu' },
                { icon: GripVertical, title: 'Drag-and-drop', desc: 'Déplacez les prospects entre étapes en un glissement' },
                { icon: Filter, title: 'Filtres avancés', desc: 'Par source, montant, date, closer assigné' },
                { icon: TrendingUp, title: 'Valeur du pipeline', desc: 'Vue consolidée de la valeur totale du pipeline' },
              ].map((card, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  className="group rounded-2xl border border-white/5 bg-white/[0.02] p-6 hover:border-[#00E676]/30 transition-colors"
                >
                  <div className="mb-4 inline-flex rounded-xl bg-[#00E676]/10 p-3">
                    <card.icon className="h-6 w-6 text-[#00E676]" />
                  </div>
                  <h3 className="text-lg font-semibold">{card.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{card.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Why closers prefer CloseOS */}
      <section className="border-t border-white/5">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={stagger}
          >
            <motion.h2 variants={fadeUp} className="text-3xl font-bold tracking-tight sm:text-4xl">
              Pourquoi les closers préfèrent CloseOS aux CRM généralistes
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-4 max-w-2xl text-lg text-slate-400">
              Un closer n'a pas les mêmes besoins qu'un commercial B2B classique. Voici ce que CloseOS fait différemment.
            </motion.p>

            <div className="mt-14 grid gap-10 lg:grid-cols-2">
              {[
                {
                  icon: Phone,
                  title: "Callroom intégrée, pas d'outil d'appel séparé",
                  text: "Avec un CRM classique, vous devez utiliser un outil tiers pour vos appels (Aircall, Ringover, votre téléphone). Avec CloseOS, la callroom est intégrée. Vous appelez directement depuis la fiche prospect, l'appel est automatiquement enregistré et loggé.",
                },
                {
                  icon: CreditCard,
                  title: 'Facturation intégrée à Stripe',
                  text: 'La plupart des closers facturent via le dashboard Stripe ou un outil séparé. CloseOS génère vos factures automatiquement et les connecte à Stripe pour les paiements. Tout est tracé dans le même outil.',
                },
                {
                  icon: BarChart3,
                  title: 'KPIs de closing, pas des KPIs marketing',
                  text: "Les CRM généralistes trackent des métriques marketing (leads générés, taux de conversion du funnel). CloseOS track les métriques qui comptent pour un closer : taux de closing, CA par appel, nombre d'appels/jour, évolution de vos objectifs.",
                },
                {
                  icon: Globe,
                  title: 'Interface en français',
                  text: "CloseOS est conçu pour le marché francophone. L'interface, le support, la documentation, tout est en français. Pas besoin de naviguer dans un outil en anglais.",
                },
              ].map((item, i) => (
                <motion.div key={i} variants={fadeUp} className="flex gap-5">
                  <div className="shrink-0 mt-1 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#00E676]/10">
                    <item.icon className="h-6 w-6 text-[#00E676]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">{item.title}</h3>
                    <p className="mt-2 text-slate-400 leading-relaxed">{item.text}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Integrations */}
      <section className="border-t border-white/5">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={stagger}
          >
            <motion.h2 variants={fadeUp} className="text-3xl font-bold tracking-tight sm:text-4xl">
              Les intégrations CRM
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-4 max-w-2xl text-lg text-slate-400">
              CloseOS n'est pas un silo. Votre infopreneur utilise HubSpot ? Synchronisez. Votre équipe est sur Pipedrive ? Bidirectionnel. GoHighLevel, Airtable, Systeme.io, tout se connecte.
            </motion.p>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {integrations.map((item, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  className="flex items-start gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-5 hover:border-[#00E676]/20 transition-colors"
                >
                  <Link2 className="mt-0.5 h-5 w-5 shrink-0 text-[#00E676]" />
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="mt-1 text-sm text-slate-400">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* For who */}
      <section className="border-t border-white/5">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={stagger}
          >
            <motion.h2 variants={fadeUp} className="text-3xl font-bold tracking-tight sm:text-4xl">
              Pour qui est ce CRM ?
            </motion.h2>

            <div className="mt-12 grid gap-8 lg:grid-cols-2">
              <motion.div variants={fadeUp} className="rounded-2xl border border-white/5 bg-white/[0.02] p-8">
                <div className="mb-4 inline-flex rounded-xl bg-[#00E676]/10 p-3">
                  <Users className="h-6 w-6 text-[#00E676]" />
                </div>
                <h3 className="text-xl font-bold">Closers indépendants</h3>
                <p className="mt-3 text-slate-400 leading-relaxed">
                  Vous travaillez seul ou avec 2-3 infopreneurs. Vous avez besoin d'un outil simple pour suivre vos prospects, passer vos appels et facturer.
                </p>
                <Link to="/tarifs" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[#00E676] hover:underline">
                  CloseOS Sales dès 18€/mois <ArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>

              <motion.div variants={fadeUp} className="rounded-2xl border border-white/5 bg-white/[0.02] p-8">
                <div className="mb-4 inline-flex rounded-xl bg-[#00E676]/10 p-3">
                  <Building2 className="h-6 w-6 text-[#00E676]" />
                </div>
                <h3 className="text-xl font-bold">Infopreneurs avec une equipe</h3>
                <p className="mt-3 text-slate-400 leading-relaxed">
                  Vous avez des closers et setters. Vous avez besoin de leur attribuer des leads, suivre leurs performances et piloter vos campagnes.
                </p>
                <Link to="/tarifs" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[#00E676] hover:underline">
                  CloseOS Business dès 42€/mois <ArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-white/5">
        <div className="mx-auto max-w-3xl px-6 py-24">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={stagger}
          >
            <motion.h2 variants={fadeUp} className="text-3xl font-bold tracking-tight sm:text-4xl">
              Questions fréquentes
            </motion.h2>

            <div className="mt-10 space-y-3">
              {faqItems.map((item, i) => (
                <motion.div key={i} variants={fadeUp} className="rounded-xl border border-white/5 bg-white/[0.02]">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="flex w-full items-center justify-between gap-4 p-5 text-left"
                  >
                    <span className="font-semibold">{item.q}</span>
                    <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                  </button>
                  {openFaq === i && (
                    <div className="px-5 pb-5 text-slate-400 leading-relaxed">
                      {item.a}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/5">
        <div className="mx-auto max-w-7xl px-6 py-24 text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={stagger}
          >
            <motion.h2 variants={fadeUp} className="text-3xl font-bold tracking-tight sm:text-4xl">
              Votre CRM de closer vous attend.
            </motion.h2>
            <motion.div variants={fadeUp} className="mt-8">
              <Link to="/register" className="group inline-flex items-center gap-2 rounded-full bg-[#00E676] px-8 py-3.5 text-sm font-bold text-slate-950 hover:brightness-110 transition-all">
                Essayer gratuitement <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>
            <motion.div variants={fadeUp} className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-slate-400">
              <Link to="/tarifs" className="hover:text-white transition-colors">Voir les tarifs</Link>
              <Link to="/fonctionnalites" className="hover:text-white transition-colors">Toutes les fonctionnalités</Link>
              <Link to="/landing" className="hover:text-white transition-colors">CloseOS Sales</Link>
              <Link to="/comparatifs/alternative-iclosed" className="hover:text-white transition-colors">Alternative iClosed</Link>
              <Link to="/sign" className="hover:text-white transition-colors">CloseOS Sign</Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

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
