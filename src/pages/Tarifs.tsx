import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, Check, ChevronDown, Shield, Clock, Layers, Target, Star, ShieldCheck } from 'lucide-react';

const salesPlans = [
  {
    name: 'Solo',
    badge: 'Closer indépendant',
    monthlyPrice: 34,
    annualPrice: 306,
    annualMonthly: 25.5,
    features: [
      'CRM complet avec pipeline visuel',
      'Callroom Google Meet',
      'Facturation automatique Stripe',
      'KPIs de closing en temps réel',
      'Booking et agenda',
      'Intégrations (iClosed, Pipedrive, Zapier…)',
    ],
    cta: { label: 'Essai gratuit 20 jours', to: '/register' },
  },
];

const businessPlans = [
  {
    name: 'Solo',
    badge: 'Infopreneur qui close seul',
    monthlyPrice: 39,
    annualPrice: 390,
    annualMonthly: 32,
    features: [
      'CRM complet avec pipeline visuel',
      { main: 'Système d\'acquisition intégré', sub: ['Campagnes d\'acquisition', 'Tracking UTM et analytics', 'CRM acquisition dédié', 'KPIs d\'acquisition'] },
      'Callroom Google Meet',
      'KPIs de closing et setting en temps réel',
      'Booking et agenda intégré',
      'Intégrations (iClosed, Pipedrive, Zapier…)',
    ],
    cta: { label: 'Essai gratuit 20 jours', to: '/register' },
    highlighted: false,
    popularBadge: false,
  },
  {
    name: 'Business',
    badge: 'Pour les équipes de vente',
    monthlyPrice: 59,
    annualPrice: 590,
    annualMonthly: 49,
    features: [
      'Tout ce qui est dans Solo, plus :',
      'Gestion d\'équipe (3 membres inclus)',
      'Rôles : Closer, Setter, Head of Sales, Admin',
      'Attribution automatique des leads',
      'KPIs individuels et collectifs',
      'Onboarding automatisé des closers',
    ],
    cta: { label: 'Essai gratuit 20 jours', to: '/register' },
    highlighted: false,
    popularBadge: false,
  },
  {
    name: 'Business + Acquisition',
    badge: 'Tout inclus',
    monthlyPrice: 99,
    annualPrice: 990,
    annualMonthly: 82,
    features: [
      'Tout ce qui est dans Business, plus :',
      'Campagnes d\'acquisition',
      'Tracking UTM et analytics',
      'CRM acquisition dédié',
      'KPIs d\'acquisition',
    ],
    cta: { label: 'Essai gratuit 20 jours', to: '/register' },
    highlighted: true,
    popularBadge: true,
  },
  {
    name: 'Enterprise',
    badge: 'Grandes équipes',
    monthlyPrice: null,
    annualPrice: null,
    annualMonthly: null,
    features: [
      'Tout ce qui est dans Business + Acquisition, plus :',
      'Membres illimités',
      'Setup + intégration inclus',
      'Support prioritaire dédié',
      'Idéal pour agences et challenges',
    ],
    cta: { label: 'Nous contacter', to: 'mailto:support@closeos.fr' },
    highlighted: false,
    popularBadge: false,
  },
];

const seatPricing = [
  { role: 'Closer ou Setter', monthly: '5€/mois', annual: '42€/an' },
  { role: 'Setter-Closer', monthly: '8€/mois', annual: '67€/an' },
  { role: 'Head of Sales ou Admin', monthly: '12€/mois', annual: '100€/an' },
];

const services = [
  { name: 'Setup', price: '60€', type: 'one-shot', detail: 'Configuration complète : campagnes, formules, pipeline, équipe, onboarding' },
  { name: 'Intégration', price: '80€', type: 'one-shot', detail: 'Intégration technique sur votre site : iframe, embed, pop-up' },
  { name: 'Setup + Intégration', price: '120€', type: 'one-shot', detail: 'Les deux combinés' },
];

const arguments_ = [
  { icon: Shield, title: 'Prix à vie', desc: 'Votre tarif ne changera jamais. Les prochaines augmentations ne vous concernent pas.' },
  { icon: Clock, title: 'Essai gratuit 20 jours', desc: 'Testez toutes les fonctionnalités sans engagement. CB requise, aucun prélèvement pendant l\'essai.' },
  { icon: Layers, title: 'Tout-en-un', desc: 'Plus besoin de jongler entre 5 outils. CRM, téléphonie, facturation et KPIs dans une seule plateforme.' },
  { icon: Target, title: 'Conçu pour les closers', desc: 'Pas un CRM généraliste adapté. Un outil pensé nativement pour le métier de closer et d\'infopreneur.' },
];

const faqItems = [
  { q: 'Est-ce que je peux tester CloseOS gratuitement ?', a: 'Oui. Toutes les formules incluent un essai gratuit de 20 jours. Votre carte bancaire est requise à l\'inscription mais aucun prélèvement n\'est effectué pendant la période d\'essai. Vous pouvez annuler à tout moment.' },
  { q: 'Que signifie "prix à vie" ?', a: 'Le tarif que vous payez au moment de votre abonnement est bloqué pour toujours. Si les prix augmentent après votre inscription, vous gardez votre tarif initial tant que votre abonnement est actif.' },
  { q: 'Quelle est la différence entre les formules Solo et Business ?', a: 'La formule Solo est destinée aux closers indépendants ou aux infopreneurs qui closent seuls. La formule Business ajoute la gestion d\'équipe : rôles, attribution des leads, KPIs par membre et onboarding automatisé.' },
  { q: 'Puis-je changer de formule en cours de route ?', a: 'Oui. Vous pouvez upgrader votre formule à tout moment. Le changement est effectif immédiatement et la différence de prix est calculée au prorata.' },
  { q: 'Quelles intégrations sont disponibles ?', a: 'CloseOS s\'intègre avec HubSpot, Pipedrive, GoHighLevel, Airtable, Systeme.io, iClosed, Google Calendar, Stripe, Calendly, Zapier, Make et n8n.' },
];

export default function Tarifs() {
  const [annual, setAnnual] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    document.title = 'Tarifs CloseOS — CRM closer dès 34€/mois';
    document.querySelector('meta[name="description"]')?.setAttribute('content', 'Découvrez les tarifs CloseOS : Solo dès 34€/mois, Business dès 59€/mois, Business + Acquisition dès 99€/mois. Essai gratuit 20 jours. Prix à vie.');
    document.getElementById('canonical')?.setAttribute('href', 'https://www.closeos.fr/tarifs');
    document.getElementById('og-url')?.setAttribute('content', 'https://www.closeos.fr/tarifs');
    document.getElementById('og-title')?.setAttribute('content', 'Tarifs CloseOS — CRM closer dès 34€/mois');
    document.getElementById('og-description')?.setAttribute('content', 'Découvrez les tarifs CloseOS : Solo dès 34€/mois, Business dès 59€/mois, Business + Acquisition dès 99€/mois. Essai gratuit 20 jours. Prix à vie.');
    document.getElementById('tw-url')?.setAttribute('content', 'https://www.closeos.fr/tarifs');
    document.getElementById('tw-title')?.setAttribute('content', 'Tarifs CloseOS — CRM closer dès 34€/mois');
    document.getElementById('tw-description')?.setAttribute('content', 'Découvrez les tarifs CloseOS : Solo dès 34€/mois, Business dès 59€/mois, Business + Acquisition dès 99€/mois. Essai gratuit 20 jours. Prix à vie.');
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
      offers: { '@type': 'AggregateOffer', lowPrice: '0', highPrice: '99', priceCurrency: 'EUR', offerCount: '4', availability: 'https://schema.org/InStock' }
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
        { '@type': 'Question', name: 'Est-ce que je peux tester CloseOS gratuitement ?', acceptedAnswer: { '@type': 'Answer', text: 'Oui. Toutes les formules incluent un essai gratuit de 20 jours. Votre carte bancaire est requise à l\'inscription mais aucun prélèvement n\'est effectué pendant la période d\'essai. Vous pouvez annuler à tout moment.' } },
        { '@type': 'Question', name: 'Que signifie "prix à vie" ?', acceptedAnswer: { '@type': 'Answer', text: 'Le tarif que vous payez au moment de votre abonnement est bloqué pour toujours. Si les prix augmentent après votre inscription, vous gardez votre tarif initial tant que votre abonnement est actif.' } },
        { '@type': 'Question', name: 'Quelle est la différence entre les formules Solo et Business ?', acceptedAnswer: { '@type': 'Answer', text: 'La formule Solo est destinée aux closers indépendants ou aux infopreneurs qui closent seuls. La formule Business ajoute la gestion d\'équipe : rôles, attribution des leads, KPIs par membre et onboarding automatisé.' } },
        { '@type': 'Question', name: 'Puis-je changer de formule en cours de route ?', acceptedAnswer: { '@type': 'Answer', text: 'Oui. Vous pouvez upgrader votre formule à tout moment. Le changement est effectif immédiatement et la différence de prix est calculée au prorata.' } },
        { '@type': 'Question', name: 'Quelles intégrations sont disponibles ?', acceptedAnswer: { '@type': 'Answer', text: 'CloseOS s\'intègre avec HubSpot, Pipedrive, GoHighLevel, Airtable, Systeme.io, iClosed, Google Calendar, Stripe, Calendly, Zapier, Make et n8n.' } },
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
            CloseOS propose des formules adaptées que vous soyez closer indépendant ou infopreneur avec une équipe de vente. Essai gratuit de 20 jours, sans engagement, CB requise. Votre tarif est bloqué à vie au moment de l'abonnement.
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
          <div className="flex items-center justify-center gap-4 mb-14">
            <span className={`text-sm font-medium ${!annual ? 'text-white' : 'text-slate-500'}`}>Mensuel</span>
            <button
              onClick={() => setAnnual(!annual)}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${annual ? 'bg-[#00E676]' : 'bg-white/20'}`}
              aria-label="Basculer entre mensuel et annuel"
            >
              <span className={`inline-block h-6 w-6 rounded-full bg-white shadow transition-transform ${annual ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
            <span className={`text-sm font-medium ${annual ? 'text-white' : 'text-slate-500'}`}>
              Annuel <span className="text-[#00E676] text-xs font-semibold ml-1">-17%</span>
            </span>
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
                  <span className="text-5xl font-extrabold text-white">{annual ? '25.5' : '34'}€</span>
                  <span className="text-slate-400 line-through text-lg">69€</span>
                  <span className="text-slate-500">/mois</span>
                </div>
                {annual && (
                  <p className="text-xs text-emerald-400 mt-2">Facturé annuellement (306€/an)</p>
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
                        {annual ? plan.annualMonthly : plan.monthlyPrice}€
                      </span>
                      <span className="text-slate-400 text-sm">/mois</span>
                      {annual && (
                        <p className="text-xs text-slate-500 mt-1">Facturé {plan.annualPrice}€/an</p>
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

      {/* Seats */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6 }}
        className="pb-24 px-6"
      >
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold text-center mb-10">Sieges supplementaires</h2>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-6 py-4 font-semibold text-slate-300">Role</th>
                  <th className="px-6 py-4 font-semibold text-slate-300">Mensuel</th>
                  <th className="px-6 py-4 font-semibold text-slate-300">Annuel</th>
                </tr>
              </thead>
              <tbody>
                {seatPricing.map((row) => (
                  <tr key={row.role} className="border-b border-white/5">
                    <td className="px-6 py-4 text-slate-300">{row.role}</td>
                    <td className="px-6 py-4 text-white font-medium">+{row.monthly}</td>
                    <td className="px-6 py-4 text-white font-medium">+{row.annual}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-slate-500 text-center">
            3 membres sont inclus dans les formules Business et Business + Acquisition. L'offre Enterprise inclut des membres illimites.
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
