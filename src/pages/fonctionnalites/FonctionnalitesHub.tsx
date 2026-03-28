import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Filter,
  Phone,
  FileText,
  BarChart3,
  Calendar,
  Users,
  Rocket,
  Puzzle,
  Check,
  X,
} from 'lucide-react';

const features = [
  {
    icon: Filter,
    title: 'CRM & Pipeline de vente',
    description:
      'Pipeline visuel drag-and-drop avec étapes personnalisables. Suivi complet de chaque prospect du premier contact au closing.',
    link: '/fonctionnalites/crm-closer',
  },
  {
    icon: Phone,
    title: 'Callroom VoIP',
    description:
      "Passez vos appels directement depuis CloseOS. VoIP intégrée avec enregistrement d'appels et cockpit de session.",
    link: null,
  },
  {
    icon: FileText,
    title: 'Facturation automatique',
    description:
      'Générez et envoyez vos factures automatiquement. Connectée à Stripe pour les paiements en ligne.',
    link: null,
  },
  {
    icon: BarChart3,
    title: 'KPIs & Dashboard',
    description:
      'Suivez votre taux de closing, chiffre d\'affaires, objectifs et performances en temps réel.',
    link: null,
  },
  {
    icon: Calendar,
    title: 'Booking & Agenda',
    description:
      "Agenda intégré avec booking en ligne. Synchronisé avec Google Calendar. Intégrable sur n'importe quel site.",
    link: null,
  },
  {
    icon: Users,
    title: "Gestion d'équipe",
    description:
      'Gérez vos closers, setters et admins. Attribution des leads, KPIs individuels, onboarding automatisé. Disponible avec CloseOS Business.',
    link: null,
  },
  {
    icon: Rocket,
    title: "Campagnes d'acquisition",
    description:
      "Créez et suivez vos campagnes d'acquisition avec tracking UTM et analytics. Disponible avec Solo et Business + Acquisition.",
    link: null,
  },
  {
    icon: Puzzle,
    title: 'Intégrations',
    description:
      'Connectez CloseOS à vos outils : HubSpot, Pipedrive, GoHighLevel, Airtable, Systeme.io, Zapier, Make, n8n et plus.',
    link: null,
  },
];

const comparisonRows = [
  { label: 'CRM & Pipeline', sales: true, business: true, note: null },
  { label: 'Callroom VoIP', sales: true, business: true, note: null },
  { label: 'Facturation', sales: true, business: true, note: null },
  { label: 'KPIs closing', sales: true, business: true, note: null },
  { label: 'Booking & Agenda', sales: true, business: true, note: null },
  { label: "Gestion d'équipe", sales: false, business: true, note: null },
  {
    label: "Campagnes d'acquisition",
    sales: false,
    business: true,
    note: 'Solo + Business + Acquisition',
  },
  { label: "KPIs d'équipe", sales: false, business: true, note: null },
];

const sectionVariants = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

export default function FonctionnalitesHub() {
  useEffect(() => {
    document.title = 'Fonctionnalités CloseOS — CRM, VoIP, KPIs, Équipe';
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        'content',
        "Découvrez toutes les fonctionnalités de CloseOS : pipeline de vente, callroom VoIP, facturation Stripe, KPIs closing, gestion d'équipe et intégrations."
      );
    document
      .getElementById('canonical')
      ?.setAttribute('href', 'https://www.closeos.fr/fonctionnalites');
    document
      .getElementById('og-url')
      ?.setAttribute('content', 'https://www.closeos.fr/fonctionnalites');
    document
      .getElementById('og-title')
      ?.setAttribute('content', 'Fonctionnalités CloseOS — CRM, VoIP, KPIs, Équipe');
    document
      .getElementById('og-description')
      ?.setAttribute(
        'content',
        "Découvrez toutes les fonctionnalités de CloseOS : pipeline de vente, callroom VoIP, facturation Stripe, KPIs closing, gestion d'équipe et intégrations."
      );
    document
      .getElementById('tw-url')
      ?.setAttribute('content', 'https://www.closeos.fr/fonctionnalites');
    document
      .getElementById('tw-title')
      ?.setAttribute('content', 'Fonctionnalités CloseOS — CRM, VoIP, KPIs, Équipe');
    document
      .getElementById('tw-description')
      ?.setAttribute(
        'content',
        "Pipeline, callroom VoIP, facturation, KPIs et gestion d'équipe dans un seul outil."
      );
    document.documentElement.lang = 'fr';

    document.querySelectorAll('script[data-features-ld]').forEach((el) => el.remove());
    const bc = document.createElement('script');
    bc.type = 'application/ld+json';
    bc.setAttribute('data-features-ld', 'true');
    bc.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Accueil',
          item: 'https://www.closeos.fr',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Fonctionnalités',
          item: 'https://www.closeos.fr/fonctionnalites',
        },
      ],
    });
    document.head.appendChild(bc);
    return () => {
      document.querySelectorAll('script[data-features-ld]').forEach((el) => el.remove());
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100">
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/5 bg-[#020617]/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link to="/">
            <img
              src="/logo-sales.png"
              alt="CloseOS"
              className="h-10 w-auto"
              width={100}
              height={40}
            />
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <Link to="/landing" className="hover:text-white transition-colors">
              Sales
            </Link>
            <Link to="/business" className="hover:text-white transition-colors">
              Business
            </Link>
            <Link to="/fonctionnalites" className="text-white font-semibold">
              Fonctionnalités
            </Link>
            <Link to="/tarifs" className="hover:text-white transition-colors">
              Tarifs
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="hidden sm:flex items-center rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              Connexion
            </Link>
            <Link
              to="/register"
              className="group flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-bold text-slate-950 hover:bg-blue-50 transition-all"
            >
              Essai gratuit{' '}
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <motion.section
        className="pt-24 pb-16"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={sectionVariants}
      >
        <div className="mx-auto max-w-7xl px-6 pt-12 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            Toutes les fonctionnalités{' '}
            <span className="text-[#00E676]">CloseOS</span>
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-slate-400">
            CloseOS regroupe tout ce dont un closer ou un infopreneur a besoin pour gérer
            son activité de vente digitale. Un seul outil pour remplacer votre CRM, votre
            outil d'appel, votre logiciel de facturation et vos tableaux de KPIs
            éparpillés.
          </p>
        </div>
      </motion.section>

      {/* Feature cards */}
      <motion.section
        className="pb-20"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }}
        variants={sectionVariants}
      >
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="mb-10 text-center text-3xl font-bold sm:text-4xl">
            Les fonctionnalités
          </h2>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {features.map((f) => {
              const Icon = f.icon;
              const content = (
                <div
                  className={`group relative flex h-full flex-col rounded-2xl border bg-white/5 p-6 transition-all ${
                    f.link
                      ? 'border-white/10 hover:border-white/20 cursor-pointer'
                      : 'border-white/10'
                  }`}
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#00E676]/10">
                    <Icon className="h-6 w-6 text-[#00E676]" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
                  <p className="flex-1 text-sm leading-relaxed text-slate-400">
                    {f.description}
                  </p>
                  {f.link ? (
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[#00E676]">
                      En savoir plus
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  ) : (
                    <span className="mt-4 inline-block text-xs font-medium text-slate-500">
                      Bientôt
                    </span>
                  )}
                </div>
              );

              return f.link ? (
                <Link to={f.link} key={f.title} className="block h-full">
                  {content}
                </Link>
              ) : (
                <div key={f.title} className="h-full">
                  {content}
                </div>
              );
            })}
          </div>
        </div>
      </motion.section>

      {/* Comparison table */}
      <motion.section
        className="pb-20"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }}
        variants={sectionVariants}
      >
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="mb-10 text-center text-3xl font-bold sm:text-4xl">
            CloseOS Sales vs CloseOS Business
          </h2>

          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-6 py-4 font-semibold text-slate-300">
                    Fonctionnalité
                  </th>
                  <th className="px-6 py-4 text-center font-semibold text-slate-300">
                    Sales
                  </th>
                  <th className="px-6 py-4 text-center font-semibold text-slate-300">
                    Business
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, i) => (
                  <tr
                    key={row.label}
                    className={
                      i < comparisonRows.length - 1 ? 'border-b border-white/5' : ''
                    }
                  >
                    <td className="px-6 py-4 text-slate-200">{row.label}</td>
                    <td className="px-6 py-4 text-center">
                      {row.sales ? (
                        <Check className="mx-auto h-5 w-5 text-[#00E676]" />
                      ) : (
                        <X className="mx-auto h-5 w-5 text-red-400" />
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {row.business ? (
                        <div className="flex flex-col items-center gap-1">
                          <Check className="h-5 w-5 text-[#00E676]" />
                          {row.note && (
                            <span className="text-xs text-slate-500">{row.note}</span>
                          )}
                        </div>
                      ) : (
                        <X className="mx-auto h-5 w-5 text-red-400" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-8 text-center text-slate-400">
            CloseOS Sales est parfait pour les closers indépendants. CloseOS Business
            ajoute la couche management pour les infopreneurs avec une équipe de vente.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              to="/landing"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
            >
              Découvrir CloseOS Sales
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/business"
              className="inline-flex items-center gap-2 rounded-full bg-[#00E676] px-6 py-3 text-sm font-bold text-slate-950 hover:bg-[#00E676]/90 transition-colors"
            >
              Découvrir CloseOS Business
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </motion.section>

      {/* CTA */}
      <motion.section
        className="pb-20"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={sectionVariants}
      >
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">
            Toutes ces fonctionnalités, un seul outil.
          </h2>
          <Link
            to="/register"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-base font-bold text-slate-950 hover:bg-blue-50 transition-all"
          >
            Essayer gratuitement 20 jours
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </motion.section>

      {/* Internal links (maillage) */}
      <motion.section
        className="pb-16"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={sectionVariants}
      >
        <div className="mx-auto max-w-4xl px-6">
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-500">
            <Link
              to="/tarifs"
              className="hover:text-white transition-colors underline underline-offset-4"
            >
              Tarifs
            </Link>
            <span className="hidden sm:inline">-</span>
            <Link
              to="/landing"
              className="hover:text-white transition-colors underline underline-offset-4"
            >
              CloseOS Sales
            </Link>
            <span className="hidden sm:inline">-</span>
            <Link
              to="/business"
              className="hover:text-white transition-colors underline underline-offset-4"
            >
              CloseOS Business
            </Link>
            <span className="hidden sm:inline">-</span>
            <Link
              to="/comparatifs/alternative-iclosed"
              className="hover:text-white transition-colors underline underline-offset-4"
            >
              Alternative iClosed
            </Link>
          </div>
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-[#020617] py-6 pb-16">
        <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <img
            src="/logo-sales.png"
            alt="CloseOS"
            className="h-6 w-auto"
            loading="lazy"
            width={72}
            height={24}
          />
          <div className="flex flex-wrap justify-center gap-4 text-xs text-slate-500">
            <span>&copy; 2026 CloseOS.fr</span>
            <span className="hidden sm:inline">&bull;</span>
            <a
              href="/mentions-legales"
              className="hover:text-white transition-colors"
            >
              Mentions légales
            </a>
            <span className="hidden sm:inline">&bull;</span>
            <a href="/cgu" className="hover:text-white transition-colors">
              CGU
            </a>
            <span className="hidden sm:inline">&bull;</span>
            <a href="/cgv" className="hover:text-white transition-colors">
              CGV
            </a>
            <span className="hidden sm:inline">&bull;</span>
            <a
              href="/confidentialite"
              className="hover:text-white transition-colors"
            >
              Confidentialité
            </a>
          </div>
          <div className="flex gap-6 text-xs">
            <a
              href="https://www.linkedin.com/in/thomas-shamoev-570885237/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-500 hover:text-white transition-colors"
            >
              LinkedIn
            </a>
            <a
              href="mailto:support@closeos.fr"
              className="text-slate-500 hover:text-white transition-colors"
            >
              support@closeos.fr
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
