import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, Check, ChevronDown, Shield, Clock, Layers, Target, Star, ShieldCheck, X as XIcon } from 'lucide-react';

const businessPlans = [
  {
    name: 'Solo',
    badge: 'Infopreneur qui close seul',
    monthlyPrice: 39,
    quarterlyMonthly: 32,
    quarterlyTotal: 96,
    annualMonthly: 28,
    annualTotal: 336,
    features: [
      'CRM complet avec pipeline visuel',
      { main: 'Système d\'acquisition intégré', sub: ['Campagnes d\'acquisition', 'Tracking UTM et analytics', 'CRM acquisition dédié', 'KPIs d\'acquisition'] },
      'Callroom Google Meet',
      'KPIs de closing et setting en temps réel',
      'Booking et agenda intégré',
      'Intégrations (iClosed, Pipedrive, Zapier…)',
      'API REST & Webhooks sortants signés HMAC',
    ],
    cta: { label: 'Essai gratuit 20 jours', to: '/business#pricing' },
    highlighted: false,
    popularBadge: false,
  },
  {
    name: 'Business',
    badge: '3 équipiers inclus',
    monthlyPrice: 59,
    quarterlyMonthly: 48,
    quarterlyTotal: 144,
    annualMonthly: 42,
    annualTotal: 504,
    features: [
      'Tout ce que le Solo a, SAUF le système d\'acquisition',
      'Gestion d\'équipe complète (6 rôles : Owner, Admin, HOS, Closer, Setter, Setter-Closer)',
      'Vue macro Owner en temps réel',
      'Kanban partagé avec filtres avancés',
      'KPIs par membre / par offre / global',
      'Objectifs assignables par membre',
      'Monday Morning Reporting automatique',
    ],
    notIncluded: [
      'Système d\'acquisition',
      'API REST & Webhooks sortants',
    ],
    cta: { label: 'Essai gratuit 20 jours', to: '/business#pricing' },
    highlighted: false,
    popularBadge: false,
  },
  {
    name: 'Business + Acquisition',
    badge: '5 équipiers inclus — l\'arsenal complet',
    monthlyPrice: 99,
    quarterlyMonthly: 81,
    quarterlyTotal: 243,
    annualMonthly: 71,
    annualTotal: 852,
    features: [
      'Tout ce que Business a',
      'Système d\'acquisition complet en plus :',
      'Campagnes d\'acquisition (RDV ou inscription)',
      'Page de capture configurable + embed/popup',
      'Tracking UTM + KPIs par campagne',
      'API REST & Webhooks sortants signés HMAC',
    ],
    cta: { label: 'Essai gratuit 20 jours', to: '/business#pricing' },
    highlighted: true,
    popularBadge: true,
  },
  {
    name: 'Enterprise / Challenge',
    badge: 'Sur devis — grandes organisations',
    monthlyPrice: null,
    quarterlyMonthly: null,
    quarterlyTotal: null,
    annualMonthly: null,
    annualTotal: null,
    features: [
      'Membres illimités',
      'Tout le système d\'acquisition inclus',
      'API REST & Webhooks sortants signés HMAC',
      'Setup + Intégration inclus',
      'Support prioritaire dédié',
      'Accès one-shot (durée du challenge) ou abonnement classique',
    ],
    cta: { label: 'Nous contacter', to: '/business#pricing' },
    highlighted: false,
    popularBadge: false,
  },
];

const signPlan = {
  name: 'CloseOS Sign',
  badge: 'Formule unique — toutes les features',
  monthlyPrice: 12,
  quarterlyMonthly: 10,
  annualMonthly: 9,
  features: [
    'Signature électronique + paiement (Sign + Pay)',
    'Faisceau de preuves opposable (email, OTP SMS, horodatage, IP, hash SHA-256)',
    'Certificat de preuve vérifiable',
    'Multi-signataire (parallèle ou séquentiel)',
    'Modèles réutilisables + espace par membre d\'équipe',
    'Assistant IA (MCP)',
  ],
  included: 'Inclus automatiquement si vous êtes déjà client CloseOS Business.',
  cta: { label: 'Essai gratuit 14 jours', to: '/sign/abonnement' },
};

const seatPricing = [
  { role: 'Closer ou Setter', monthly: '5€/mois', quarterly: '4€/mois', annual: '3.5€/mois' },
  { role: 'Setter-Closer', monthly: '8€/mois', quarterly: '6.5€/mois', annual: '5.5€/mois' },
  { role: 'Head of Sales ou Admin', monthly: '12€/mois', quarterly: '10€/mois', annual: '8.5€/mois' },
];

const services = [
  { name: 'Setup', price: '60€', type: 'one-shot', detail: 'Configuration complète : campagnes, formules, pipeline, équipe, onboarding' },
  { name: 'Intégration', price: '80€', type: 'one-shot', detail: 'Intégration technique sur votre site : iframe, embed, pop-up' },
  { name: 'Setup + Intégration', price: '120€', type: 'one-shot', detail: 'Les deux combinés' },
];

const realStackSolo = [
  { cat: 'CRM', tool: 'Pipedrive Growth', price: '36 €', payer: 'Souvent (beaucoup sont sur Notion gratuit)' },
  { cat: 'Scheduling', tool: 'Calendly Standard', price: '9 €', payer: 'Souvent (le free = 1 seul type de RDV)' },
  { cat: 'Call recording', tool: 'Fathom Premium', price: '15 €', payer: 'Si volume (le free plafonne à 5 résumés IA/mois)' },
  { cat: 'Signature', tool: 'Yousign Starter', price: '9 €', payer: 'Oui' },
  { cat: 'Facturation', tool: 'Abby', price: '9 €', payer: 'Oui' },
  { cat: 'Email', tool: 'Brevo Starter', price: '23 €', payer: 'Si automation (le free suffit pour envoyer)' },
];

const realStackTeam = [
  { cat: 'CRM', tool: 'Pipedrive Growth', qui: 'owner + 2 closers', calc: '36 € × 3', price: '108 €' },
  { cat: 'Scheduling', tool: 'Calendly Teams', qui: '2 closers + 2 setters', calc: '15 € × 4', price: '60 €' },
  { cat: 'Call recording', tool: 'Fathom Team', qui: '2 closers (min 2 sièges)', calc: '14 € × 2', price: '28 €' },
  { cat: 'Email automation', tool: 'Brevo Business', qui: 'compte unique', calc: 'flat', price: '60 €' },
  { cat: 'Signature', tool: 'Yousign Business', qui: 'compte unique', calc: 'flat', price: '25 €' },
  { cat: 'Facturation', tool: 'Abby', qui: 'compte unique', calc: 'flat', price: '9 €' },
];

const freeHackRows = [
  { need: 'CRM', tool: 'Google Sheet + Notion', cost: 'Leads oubliés, aucune relance automatique' },
  { need: 'Prise de RDV', tool: 'Calendly free (1 type)', cost: 'No-shows, pas de rappel intégré' },
  { need: 'Qualification', tool: 'Google Forms', cost: 'Réponses jamais reliées à la fiche prospect' },
  { need: 'Calls', tool: 'Meet + notes à la main', cost: '10 min de saisie par call, résumés perdus' },
  { need: "Suivi d'équipe", tool: 'Sheet partagé', cost: 'Personne ne sait qui close quoi en temps réel' },
  { need: 'Commissions', tool: 'Tableur', cost: 'Erreurs, disputes, heures perdues' },
  { need: 'KPI', tool: 'Sheet mis à jour à la main', cost: 'Chiffres faux ou vieux d\'une semaine' },
  { need: 'Onboarding', tool: 'Notion jamais à jour', cost: 'Closers formés à moitié' },
];

const arguments_ = [
  { icon: Shield, title: 'Prix à vie', desc: 'Votre tarif ne changera jamais. Les prochaines augmentations ne vous concernent pas.' },
  { icon: Clock, title: 'Essai gratuit sur chaque produit', desc: 'Sales (10 jours, sans CB), Business (20 jours) et Sign (14 jours) — testez sans engagement, aucun prélèvement pendant l\'essai.' },
  { icon: Layers, title: 'Tout-en-un', desc: 'Plus besoin de jongler entre 5 outils. CRM, téléphonie, facturation et KPIs dans une seule plateforme.' },
  { icon: Target, title: 'Conçu pour les closers', desc: 'Pas un CRM généraliste adapté. Un outil pensé nativement pour le métier de closer et d\'infopreneur.' },
];

const faqItems = [
  { q: 'Est-ce que je peux tester CloseOS gratuitement ?', a: 'Oui, sur les 3 produits, mais les modalités varient : CloseOS Sales offre 10 jours d\'essai sans carte bancaire. CloseOS Business (20 jours) et CloseOS Sign (14 jours) demandent une carte bancaire à l\'inscription, mais aucun prélèvement n\'est effectué pendant l\'essai. Vous pouvez annuler à tout moment.' },
  { q: 'Que signifie "prix à vie" ?', a: 'Le tarif que vous payez au moment de votre abonnement est bloqué pour toujours. Si les prix augmentent après votre inscription, vous gardez votre tarif initial tant que votre abonnement est actif.' },
  { q: 'Quelle est la différence entre les formules Solo et Business ?', a: 'La formule Solo est destinée aux closers indépendants ou aux infopreneurs qui closent seuls. La formule Business ajoute la gestion d\'équipe : rôles, attribution des leads, KPIs par membre et onboarding automatisé.' },
  { q: 'Puis-je changer de formule en cours de route ?', a: 'Oui. Vous pouvez upgrader votre formule à tout moment. Le changement est effectif immédiatement et la différence de prix est calculée au prorata.' },
  { q: 'Quelles intégrations sont disponibles ?', a: 'CloseOS s\'intègre avec HubSpot, Pipedrive, GoHighLevel, Airtable, Systeme.io, iClosed, Google Calendar, Stripe, Calendly, Zapier, Make et n8n.' },
  { q: 'CloseOS Sign est-il inclus dans mon abonnement ?', a: 'Si vous êtes déjà client CloseOS Business, CloseOS Sign est inclus automatiquement, sans surcoût. Si vous n\'êtes pas client Business, vous pouvez souscrire à CloseOS Sign seul, dès 9€/mois en annuel (formule unique, toutes les fonctionnalités).' },
];

export default function Tarifs() {
  const [billing, setBilling] = useState<'monthly' | 'quarterly' | 'annual'>('annual');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    document.title = 'Tarifs CloseOS — CRM closer dès 18€/mois';
    document.querySelector('meta[name="description"]')?.setAttribute('content', 'Découvrez les tarifs CloseOS : Sales dès 18€/mois, Business dès 39€/mois, Sign dès 9€/mois (inclus avec Business). Essai gratuit. Prix à vie.');
    document.getElementById('canonical')?.setAttribute('href', 'https://www.closeos.fr/tarifs');
    document.getElementById('og-url')?.setAttribute('content', 'https://www.closeos.fr/tarifs');
    document.getElementById('og-title')?.setAttribute('content', 'Tarifs CloseOS — CRM closer dès 18€/mois');
    document.getElementById('og-description')?.setAttribute('content', 'Découvrez les tarifs CloseOS : Sales dès 18€/mois, Business dès 39€/mois, Sign dès 9€/mois (inclus avec Business). Essai gratuit. Prix à vie.');
    document.getElementById('tw-url')?.setAttribute('content', 'https://www.closeos.fr/tarifs');
    document.getElementById('tw-title')?.setAttribute('content', 'Tarifs CloseOS — CRM closer dès 18€/mois');
    document.getElementById('tw-description')?.setAttribute('content', 'Découvrez les tarifs CloseOS : Sales dès 18€/mois, Business dès 39€/mois, Sign dès 9€/mois (inclus avec Business). Essai gratuit. Prix à vie.');
    document.documentElement.lang = 'fr';

    document.querySelectorAll('script[data-tarifs-ld]').forEach(el => el.remove());

    const appSchema = document.createElement('script');
    appSchema.type = 'application/ld+json';
    appSchema.setAttribute('data-tarifs-ld', 'true');
    appSchema.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'CloseOS',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      offers: { '@type': 'AggregateOffer', lowPrice: '0', highPrice: '99', priceCurrency: 'EUR', offerCount: '5', availability: 'https://schema.org/InStock' }
    });
    document.head.appendChild(appSchema);

    const breadcrumbSchema = document.createElement('script');
    breadcrumbSchema.type = 'application/ld+json';
    breadcrumbSchema.setAttribute('data-tarifs-ld', 'true');
    breadcrumbSchema.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://www.closeos.fr' },
        { '@type': 'ListItem', position: 2, name: 'Tarifs', item: 'https://www.closeos.fr/tarifs' },
      ]
    });
    document.head.appendChild(breadcrumbSchema);

    const faqSchema = document.createElement('script');
    faqSchema.type = 'application/ld+json';
    faqSchema.setAttribute('data-tarifs-ld', 'true');
    faqSchema.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        { '@type': 'Question', name: 'Est-ce que je peux tester CloseOS gratuitement ?', acceptedAnswer: { '@type': 'Answer', text: 'Oui, sur les 3 produits, mais les modalités varient : CloseOS Sales offre 10 jours d\'essai sans carte bancaire. CloseOS Business (20 jours) et CloseOS Sign (14 jours) demandent une carte bancaire à l\'inscription, mais aucun prélèvement n\'est effectué pendant l\'essai. Vous pouvez annuler à tout moment.' } },
        { '@type': 'Question', name: 'Que signifie "prix à vie" ?', acceptedAnswer: { '@type': 'Answer', text: 'Le tarif que vous payez au moment de votre abonnement est bloqué pour toujours. Si les prix augmentent après votre inscription, vous gardez votre tarif initial tant que votre abonnement est actif.' } },
        { '@type': 'Question', name: 'Quelle est la différence entre les formules Solo et Business ?', acceptedAnswer: { '@type': 'Answer', text: 'La formule Solo est destinée aux closers indépendants ou aux infopreneurs qui closent seuls. La formule Business ajoute la gestion d\'équipe : rôles, attribution des leads, KPIs par membre et onboarding automatisé.' } },
        { '@type': 'Question', name: 'Puis-je changer de formule en cours de route ?', acceptedAnswer: { '@type': 'Answer', text: 'Oui. Vous pouvez upgrader votre formule à tout moment. Le changement est effectif immédiatement et la différence de prix est calculée au prorata.' } },
        { '@type': 'Question', name: 'Quelles intégrations sont disponibles ?', acceptedAnswer: { '@type': 'Answer', text: 'CloseOS s\'intègre avec HubSpot, Pipedrive, GoHighLevel, Airtable, Systeme.io, iClosed, Google Calendar, Stripe, Calendly, Zapier, Make et n8n.' } },
        { '@type': 'Question', name: 'CloseOS Sign est-il inclus dans mon abonnement ?', acceptedAnswer: { '@type': 'Answer', text: 'Si vous êtes déjà client CloseOS Business, CloseOS Sign est inclus automatiquement, sans surcoût. Sinon, vous pouvez souscrire à CloseOS Sign seul, dès 9€/mois en annuel.' } },
      ]
    });
    document.head.appendChild(faqSchema);

    return () => {
      document.querySelectorAll('script[data-tarifs-ld]').forEach(el => el.remove());
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100">
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/5 bg-[#020617]/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link to="/">
            <img src="/logo-sales.png" alt="CloseOS" className="h-10 w-auto" width={100} height={40} />
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <Link to="/landing" className="hover:text-white transition-colors">Sales</Link>
            <Link to="/business" className="hover:text-white transition-colors">Business</Link>
            <Link to="/sign" className="hover:text-white transition-colors">Sign</Link>
            <Link to="/fonctionnalites" className="hover:text-white transition-colors">Fonctionnalites</Link>
            <Link to="/tarifs" className="text-white font-semibold">Tarifs</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="hidden sm:flex items-center rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-white/10">Connexion</Link>
            <Link to="/register" className="group flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-bold text-slate-950 hover:bg-blue-50 transition-all">
              Essai gratuit <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6 }}
        className="pt-32 pb-16 px-6"
      >
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
            Tarifs CloseOS — Choisissez la formule adaptée à votre activité
          </h1>
          <p className="mt-6 text-lg text-slate-400 max-w-3xl mx-auto leading-relaxed">
            CloseOS propose des formules adaptées que vous soyez closer indépendant, infopreneur avec une équipe de vente, ou que vous ayez simplement besoin de signer et encaisser vos contrats. Essai gratuit sans engagement sur chaque produit. Votre tarif est bloqué à vie au moment de l'abonnement.
          </p>
        </div>
      </motion.section>

      {/* Pricing Cards */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6 }}
        className="pb-24 px-6"
      >
        <div className="mx-auto max-w-7xl">
          {/* Toggle */}
          <div className="flex items-center justify-center mb-14">
            <div className="relative grid grid-cols-3 rounded-full bg-white/5 border border-white/10 p-1" style={{ minWidth: 340 }}>
              {([
                { key: 'monthly' as const, label: 'Mensuel' },
                { key: 'quarterly' as const, label: 'Trimestriel', badge: '-18%' },
                { key: 'annual' as const, label: 'Annuel', badge: '-28%' },
              ]).map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setBilling(opt.key)}
                  className={`relative z-10 rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${
                    billing === opt.key ? 'text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {opt.label}
                  {opt.badge && <span className={`ml-1 text-xs font-bold ${billing === opt.key ? 'text-slate-700' : 'text-[#00E676]'}`}>{opt.badge}</span>}
                </button>
              ))}
              <div
                className="absolute top-1 bottom-1 rounded-full bg-[#00E676] transition-all duration-300 ease-out"
                style={{
                  width: 'calc(100% / 3 - 4px)',
                  left: billing === 'monthly' ? 4 : billing === 'quarterly' ? 'calc(100% / 3 + 2px)' : 'calc(200% / 3)',
                }}
              />
            </div>
          </div>

          {/* CloseOS Sales */}
          <h2 className="text-2xl font-bold mb-6">CloseOS Sales</h2>
          <div className="max-w-lg mb-16">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.6 }}
              className="rounded-3xl border-2 border-blue-500 bg-blue-950/20 p-8 shadow-2xl shadow-blue-900/40 relative"
            >
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-2xl font-bold text-white">PACK PRO</h3>
                  <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                </div>
                <p className="mt-2 text-blue-200 text-sm">L'outil tout-en-un des closers. Accès complet & illimité.</p>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-5xl font-extrabold text-white">{billing === 'annual' ? '18' : billing === 'quarterly' ? '20' : '24'}€</span>
                  <span className="text-slate-400 line-through text-lg">34€</span>
                  <span className="text-slate-500">/mois</span>
                </div>
                {billing === 'quarterly' && (
                  <p className="text-xs text-emerald-400 mt-2">Facturé trimestriellement (60€/trimestre)</p>
                )}
                {billing === 'annual' && (
                  <p className="text-xs text-emerald-400 mt-2">Facturé annuellement (216€/an)</p>
                )}
              </div>
              <ul className="space-y-4 mb-4">
                <li className="flex gap-3 text-sm text-white font-medium">
                  <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                  <span><strong>CRM & Pipeline</strong> illimité</span>
                </li>
                <li className="flex gap-3 text-sm text-white font-medium">
                  <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                  <span><strong>Agenda & Booking</strong> (Liens de rdv)</span>
                </li>
                <li className="flex gap-3 text-sm text-white font-medium">
                  <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                  <span><strong>Facturation & Envoi Automatique</strong></span>
                </li>
                <li className="flex gap-3 text-sm text-white font-medium">
                  <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                  <span><strong>KPI Avancés</strong> (Evolution, Objectifs)</span>
                </li>
                <li className="flex gap-3 text-sm text-white font-medium">
                  <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                  <span><strong>Call Room</strong> (Scripts & Notes)</span>
                </li>
                <li className="flex gap-3 text-sm text-white font-medium">
                  <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                  <span><strong>Automatisations</strong> (Sync CRM, etc.)</span>
                </li>
                <li className="flex gap-3 text-sm text-white font-medium">
                  <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                  <span><strong>Enregistrement</strong> Vidéo/Audio</span>
                </li>
                <li className="flex gap-3 text-sm text-white font-medium">
                  <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                  <span><strong>Support Prioritaire</strong></span>
                </li>
              </ul>
              <Link
                to="/register"
                className="block w-full py-4 rounded-xl bg-blue-600 text-white font-bold text-center hover:bg-blue-500 transition-all shadow-xl shadow-blue-500/20 hover:shadow-blue-500/40"
              >
                Commencer gratuitement
              </Link>
              <p className="mt-4 text-xs text-center text-slate-500">
                Aucune CB requise. 10 jours gratuits.
              </p>
            </motion.div>
          </div>

          {/* CloseOS Business */}
          <h2 className="text-2xl font-bold mb-6">CloseOS Business</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-start">
            {businessPlans.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className={`relative rounded-2xl p-8 ${
                  plan.highlighted
                    ? 'border-2 border-[#00E676] bg-white/5'
                    : 'border border-white/10 bg-white/5'
                }`}
              >
                {plan.popularBadge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#00E676] px-4 py-1 text-xs font-bold text-slate-950">
                    Populaire
                  </span>
                )}
                <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-300">
                  {plan.badge}
                </span>
                <h3 className="mt-4 text-xl font-bold">{plan.name}</h3>
                <div className="mt-4">
                  {plan.monthlyPrice !== null ? (
                    <>
                      <span className="text-4xl font-extrabold">
                        {billing === 'annual' ? plan.annualMonthly : billing === 'quarterly' ? plan.quarterlyMonthly : plan.monthlyPrice}€
                      </span>
                      <span className="text-slate-400 text-sm">/mois</span>
                      {billing === 'quarterly' && (
                        <p className="text-xs text-slate-500 mt-1">Facturé {plan.quarterlyTotal}€/trimestre</p>
                      )}
                      {billing === 'annual' && (
                        <p className="text-xs text-slate-500 mt-1">Facturé {plan.annualTotal}€/an</p>
                      )}
                    </>
                  ) : (
                    <span className="text-3xl font-extrabold">Sur devis</span>
                  )}
                </div>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((f, fi) => typeof f === 'string' ? (
                    <li key={fi} className="flex items-start gap-2 text-sm text-slate-300">
                      <Check className="h-4 w-4 mt-0.5 shrink-0 text-[#00E676]" />
                      {f}
                    </li>
                  ) : (
                    <li key={fi}>
                      <div className="flex items-start gap-2 text-sm text-slate-300">
                        <Check className="h-4 w-4 mt-0.5 shrink-0 text-[#00E676]" />
                        {f.main}
                      </div>
                      <ul className="mt-2 ml-6 space-y-1.5">
                        {f.sub.map((s: string, si: number) => (
                          <li key={si} className="flex items-start gap-2 text-xs text-slate-400">
                            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-slate-500" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                  {Array.isArray((plan as any).notIncluded) && (plan as any).notIncluded.length > 0 && (plan as any).notIncluded.map((f: string, fi: number) => (
                    <li key={`x-${fi}`} className="flex items-start gap-2 text-sm text-red-400 line-through">
                      <XIcon className="h-4 w-4 mt-0.5 shrink-0 text-red-500" />
                      {f}
                    </li>
                  ))}
                </ul>
                {plan.cta.to.startsWith('mailto:') ? (
                  <a
                    href={plan.cta.to}
                    className="mt-8 flex w-full items-center justify-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-white/10"
                  >
                    {plan.cta.label} <ArrowRight className="h-4 w-4" />
                  </a>
                ) : (
                  <Link
                    to={plan.cta.to}
                    className={`mt-8 flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold transition-all ${
                      plan.highlighted
                        ? 'bg-[#00E676] text-slate-950 hover:bg-[#00C864]'
                        : 'bg-white text-slate-950 hover:bg-blue-50'
                    }`}
                  >
                    {plan.cta.label} <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* CloseOS Sign */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6 }}
        className="pb-24 px-6"
      >
        <div className="mx-auto max-w-7xl">
          <h2 className="text-2xl font-bold mb-6">CloseOS Sign</h2>
          <div className="max-w-lg">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.6 }}
              className="rounded-3xl border-2 border-[#00E676] bg-[#00E676]/5 p-8 shadow-2xl relative"
            >
              <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-300">
                {signPlan.badge}
              </span>
              <h3 className="mt-4 text-2xl font-bold text-white">{signPlan.name}</h3>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-5xl font-extrabold text-white">
                  {billing === 'annual' ? signPlan.annualMonthly : billing === 'quarterly' ? signPlan.quarterlyMonthly : signPlan.monthlyPrice}€
                </span>
                <span className="text-slate-500">/mois</span>
              </div>
              {billing === 'quarterly' && (
                <p className="text-xs text-slate-500 mt-1">Facturé trimestriellement</p>
              )}
              {billing === 'annual' && (
                <p className="text-xs text-slate-500 mt-1">Facturé annuellement (le tarif le plus bas)</p>
              )}
              <ul className="mt-6 space-y-3">
                {signPlan.features.map((f, fi) => (
                  <li key={fi} className="flex items-start gap-2 text-sm text-slate-300">
                    <Check className="h-4 w-4 mt-0.5 shrink-0 text-[#00E676]" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to={signPlan.cta.to}
                className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-[#00E676] px-5 py-3 text-sm font-bold text-slate-950 hover:bg-[#00C864] transition-all"
              >
                {signPlan.cta.label} <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="mt-4 text-xs text-center text-slate-500">
                {signPlan.included}
              </p>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* Seats */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6 }}
        className="pb-24 px-6"
      >
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold text-center mb-10">Sièges supplémentaires</h2>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-6 py-4 font-semibold text-slate-300">Rôle</th>
                  <th className="px-6 py-4 font-semibold text-slate-300">Mensuel</th>
                  <th className="px-6 py-4 font-semibold text-slate-300">Trimestriel</th>
                  <th className="px-6 py-4 font-semibold text-slate-300">Annuel</th>
                </tr>
              </thead>
              <tbody>
                {seatPricing.map((row) => (
                  <tr key={row.role} className="border-b border-white/5">
                    <td className="px-6 py-4 text-slate-300">{row.role}</td>
                    <td className="px-6 py-4 text-white font-medium">+{row.monthly}</td>
                    <td className="px-6 py-4 text-white font-medium">+{row.quarterly}</td>
                    <td className="px-6 py-4 text-white font-medium">+{row.annual}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-slate-500 text-center">
            3 membres sont inclus dans Business, 5 dans Business + Acquisition. L'offre Enterprise inclut des membres illimités.
          </p>
        </div>
      </motion.section>

      {/* Services */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6 }}
        className="pb-24 px-6"
      >
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold text-center mb-10">Services complementaires</h2>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-6 py-4 font-semibold text-slate-300">Service</th>
                  <th className="px-6 py-4 font-semibold text-slate-300">Prix</th>
                  <th className="px-6 py-4 font-semibold text-slate-300">Detail</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.name} className="border-b border-white/5">
                    <td className="px-6 py-4 text-white font-medium">{s.name}</td>
                    <td className="px-6 py-4 text-[#00E676] font-semibold whitespace-nowrap">{s.price} <span className="text-slate-500 font-normal">{s.type}</span></td>
                    <td className="px-6 py-4 text-slate-400">{s.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </motion.section>

      {/* Comparatif prix honnête */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6 }}
        className="pb-24 px-6"
      >
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-4">
            <span className="inline-block rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs font-medium text-slate-300">Comparatif honnête</span>
          </div>
          <h2 className="text-3xl font-bold text-center mb-4">Combien économisez-vous vraiment avec CloseOS ?</h2>
          <p className="text-slate-400 text-center max-w-2xl mx-auto mb-14 leading-relaxed">
            Pas de stack fantasme facturée en 5 licences pleines sur 14 outils. Juste ce que les closers et infopreneurs sortent vraiment la carte bancaire pour payer, comparé à CloseOS.
          </p>

          {/* Tableau A - Solo */}
          <h3 className="text-xl font-bold mb-2">Solo — la stack payante réaliste</h3>
          <p className="text-sm text-slate-500 mb-6">Seulement ce qu'un closer indépendant sort vraiment la CB pour.</p>
          <div className="overflow-x-auto rounded-xl border border-white/10 mb-6">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-6 py-4 font-semibold text-slate-300">Catégorie</th>
                  <th className="px-6 py-4 font-semibold text-slate-300">Outil</th>
                  <th className="px-6 py-4 font-semibold text-slate-300">Prix/mois</th>
                  <th className="px-6 py-4 font-semibold text-slate-300">Vraiment payé ?</th>
                </tr>
              </thead>
              <tbody>
                {realStackSolo.map((r) => (
                  <tr key={r.cat} className="border-b border-white/5">
                    <td className="px-6 py-4 text-slate-300">{r.cat}</td>
                    <td className="px-6 py-4 text-white font-medium">{r.tool}</td>
                    <td className="px-6 py-4 text-white font-medium whitespace-nowrap">{r.price}</td>
                    <td className="px-6 py-4 text-slate-400">{r.payer}</td>
                  </tr>
                ))}
                <tr className="bg-white/5">
                  <td className="px-6 py-4 font-bold text-white" colSpan={2}>TOTAL payé</td>
                  <td className="px-6 py-4 font-bold text-[#00E676]">~100 €</td>
                  <td className="px-6 py-4"></td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm text-slate-500 mb-10 leading-relaxed">
            Ce qu'un solo ne paie quasiment jamais (0 €) : visio (Google Meet), formulaires (Google Forms), tracking (UTM à la main), KPI (Google Sheets), onboarding (Notion), automatisation (Zapier free).
          </p>

          <div className="rounded-xl border-2 border-[#00E676] bg-[#00E676]/5 p-6 mb-16 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div><p className="text-xs text-slate-400 mb-1">Stack payée</p><p className="text-2xl font-extrabold">~100 €/mois</p></div>
            <div><p className="text-xs text-slate-400 mb-1">CloseOS Solo</p><p className="text-2xl font-extrabold text-[#00E676]">39 €/mois</p></div>
            <div><p className="text-xs text-slate-400 mb-1">Économie</p><p className="text-2xl font-extrabold">~60 €/mois <span className="text-sm font-medium text-slate-400">(~2,6×)</span></p></div>
          </div>

          {/* Tableau B - Equipe */}
          <h3 className="text-xl font-bold mb-2">Équipe de 5 — stack payante, sièges honnêtes</h3>
          <p className="text-sm text-slate-500 mb-6">Owner + 2 closers + 2 setters. Chaque outil attribué à qui l'utilise vraiment — pas 5 licences pleines par défaut.</p>
          <div className="overflow-x-auto rounded-xl border border-white/10 mb-6">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-6 py-4 font-semibold text-slate-300">Catégorie</th>
                  <th className="px-6 py-4 font-semibold text-slate-300">Outil</th>
                  <th className="px-6 py-4 font-semibold text-slate-300">Qui en a besoin</th>
                  <th className="px-6 py-4 font-semibold text-slate-300">Calcul</th>
                  <th className="px-6 py-4 font-semibold text-slate-300">Prix/mois</th>
                </tr>
              </thead>
              <tbody>
                {realStackTeam.map((r) => (
                  <tr key={r.cat} className="border-b border-white/5">
                    <td className="px-6 py-4 text-slate-300">{r.cat}</td>
                    <td className="px-6 py-4 text-white font-medium">{r.tool}</td>
                    <td className="px-6 py-4 text-slate-400">{r.qui}</td>
                    <td className="px-6 py-4 text-slate-400 whitespace-nowrap">{r.calc}</td>
                    <td className="px-6 py-4 text-white font-medium whitespace-nowrap">{r.price}</td>
                  </tr>
                ))}
                <tr className="bg-white/5">
                  <td className="px-6 py-4 font-bold text-white" colSpan={4}>TOTAL payé (6 outils)</td>
                  <td className="px-6 py-4 font-bold text-[#00E676]">~290 €</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm text-slate-500 mb-10 leading-relaxed">
            Ce qu'ils ne paient pas : routing/qualif à la main, commissions dans un tableur, KPI dans un Sheet, tracking UTM manuel, onboarding sur Notion, visio Meet, automatisation Zapier free — les postes les plus chers d'une vraie stack "commerciale" (type Chili Piper, QuotaPath, Trainual), et ceux que presque personne ne paie au départ.
          </p>

          <div className="rounded-xl border-2 border-[#00E676] bg-[#00E676]/5 p-6 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div><p className="text-xs text-slate-400 mb-1">Stack payée</p><p className="text-2xl font-extrabold">~290 €/mois</p></div>
            <div><p className="text-xs text-slate-400 mb-1">CloseOS Business + Acquisition</p><p className="text-2xl font-extrabold text-[#00E676]">~105 €/mois</p></div>
            <div><p className="text-xs text-slate-400 mb-1">Économie</p><p className="text-2xl font-extrabold">~185 €/mois <span className="text-sm font-medium text-slate-400">(~2,8×)</span></p></div>
          </div>
          <p className="text-xs text-slate-500 mb-16">
            Rappel grille : Business + Acquisition inclut 3 équipiers, pas 5. Une équipe de 5 = 99 € + sièges supplémentaires (voir tableau ci-dessus) — d'où ~105 € et non 99 €.
          </p>

          {/* Tableau C - Bricolage gratuit */}
          <h3 className="text-xl font-bold mb-2">La réalité de la majorité : le bricolage gratuit</h3>
          <p className="text-sm text-slate-500 mb-6">Le vrai "avant" de la plupart des closers et infopreneurs. Ici, le chiffre qui compte n'est pas l'euro, c'est le chaos.</p>
          <div className="overflow-x-auto rounded-xl border border-white/10 mb-6">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-6 py-4 font-semibold text-slate-300">Besoin</th>
                  <th className="px-6 py-4 font-semibold text-slate-300">Le bricolage gratuit</th>
                  <th className="px-6 py-4 font-semibold text-slate-300">Le coût caché</th>
                </tr>
              </thead>
              <tbody>
                {freeHackRows.map((r) => (
                  <tr key={r.need} className="border-b border-white/5">
                    <td className="px-6 py-4 text-white font-medium">{r.need}</td>
                    <td className="px-6 py-4 text-slate-400">{r.tool}</td>
                    <td className="px-6 py-4 text-slate-400">{r.cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-slate-500 mb-16 leading-relaxed">
            Le coût réel : une heure à une heure et demie par jour et par personne, passée à copier-coller entre des onglets qui ne se parlent pas. Sur une équipe de 5, environ 150h/mois. Et surtout, les deals qui fuitent parce que l'info se perd entre les outils. Pour un deal à 5 000 €, un seul lead sauvé par mois paie l'abonnement dix fois.
          </p>

          {/* Synthèse */}
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-6 py-4 font-semibold text-slate-300">Cible</th>
                  <th className="px-6 py-4 font-semibold text-slate-300">Le bon argument</th>
                  <th className="px-6 py-4 font-semibold text-slate-300">Le chiffre</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/5">
                  <td className="px-6 py-4 text-white font-medium">Équipe déjà outillée</td>
                  <td className="px-6 py-4 text-slate-400">Économie de prix</td>
                  <td className="px-6 py-4 text-slate-400">~290 € → ~105 €, soit ~2,8×, ~2 200 €/an</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-white font-medium">Solo / majorité qui bricole</td>
                  <td className="px-6 py-4 text-slate-400">Fin du chaos, pipeline qui arrête de fuir</td>
                  <td className="px-6 py-4 text-slate-400">Pas l'euro : le temps et les deals perdus</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </motion.section>

      {/* Why CloseOS */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6 }}
        className="pb-24 px-6"
      >
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-center mb-14">Pourquoi choisir CloseOS ?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {arguments_.map((arg, i) => (
              <motion.div
                key={arg.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className="rounded-2xl border border-white/10 bg-white/5 p-8"
              >
                <arg.icon className="h-8 w-8 text-[#00E676] mb-4" />
                <h3 className="text-lg font-bold mb-2">{arg.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{arg.desc}</p>
              </motion.div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm">
            <Link to="/landing" className="text-[#00E676] hover:underline font-medium flex items-center gap-1">
              Decouvrir CloseOS Sales <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/sign" className="text-[#00E676] hover:underline font-medium flex items-center gap-1">
              Decouvrir CloseOS Sign <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/fonctionnalites" className="text-[#00E676] hover:underline font-medium flex items-center gap-1">
              Decouvrir les fonctionnalites <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </motion.section>

      {/* FAQ */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6 }}
        className="pb-24 px-6"
      >
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold text-center mb-10">Questions frequentes</h2>
          <div className="space-y-3">
            {faqItems.map((item, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between px-6 py-5 text-left text-sm font-semibold text-slate-100 hover:bg-white/5 transition-colors"
                >
                  {item.q}
                  <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-300 ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ${openFaq === i ? 'max-h-60' : 'max-h-0'}`}
                >
                  <p className="px-6 pb-5 text-sm text-slate-400 leading-relaxed">{item.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Final CTA */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6 }}
        className="pb-24 px-6"
      >
        <div className="mx-auto max-w-3xl text-center rounded-2xl border border-white/10 bg-white/5 p-12 md:p-16">
          <h2 className="text-3xl md:text-4xl font-extrabold leading-tight">
            Pret a professionnaliser votre activite de closing ?
          </h2>
          <p className="mt-4 text-slate-400 leading-relaxed">
            Rejoignez les closers et infopreneurs qui utilisent CloseOS pour gerer leur pipeline, leurs appels et leur equipe.
          </p>
          <Link
            to="/register"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#00E676] px-8 py-3.5 text-sm font-bold text-slate-950 hover:bg-[#00C864] transition-all"
          >
            Demarrer l'essai gratuit <ArrowRight className="h-4 w-4" />
          </Link>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm">
            <Link to="/landing" className="text-slate-400 hover:text-white transition-colors">CloseOS Sales</Link>
            <Link to="/business" className="text-slate-400 hover:text-white transition-colors">CloseOS Business</Link>
            <Link to="/sign" className="text-slate-400 hover:text-white transition-colors">CloseOS Sign</Link>
            <Link to="/fonctionnalites" className="text-slate-400 hover:text-white transition-colors">Fonctionnalites</Link>
          </div>
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-[#020617] py-6 pb-16">
        <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <img src="/logo-sales.png" alt="CloseOS" className="h-6 w-auto" loading="lazy" width={72} height={24} />
          <div className="flex flex-wrap justify-center gap-4 text-xs text-slate-500">
            <span>&copy; 2026 CloseOS.fr</span>
            <span className="hidden sm:inline">&bull;</span>
            <a href="/mentions-legales" className="hover:text-white transition-colors">Mentions legales</a>
            <span className="hidden sm:inline">&bull;</span>
            <a href="/cgu" className="hover:text-white transition-colors">CGU</a>
            <span className="hidden sm:inline">&bull;</span>
            <a href="/cgv" className="hover:text-white transition-colors">CGV</a>
            <span className="hidden sm:inline">&bull;</span>
            <a href="/confidentialite" className="hover:text-white transition-colors">Confidentialite</a>
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
