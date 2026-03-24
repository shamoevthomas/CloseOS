import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import {
  ArrowUp,
  ArrowDown,
  Layers,
  Bell,
  Tag,
  Shield,
  Mail,
  Phone,
  MessageSquare,
  CheckCircle,
  Plus,
  FileText,
  Video,
  X,
  Loader2,
  ExternalLink,
  ChevronDown,
  Menu,
  Crown,
  Target,
  Users,
  Calendar,
  BarChart3,
  ArrowRight,
  Zap,
  Megaphone,
  ClipboardList
} from 'lucide-react';

export const BusinessLanding: React.FC = () => {
  const navigate = useNavigate();
  const pageRef = useRef<HTMLDivElement>(null);
  const [isExiting, setIsExiting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const handleNavigateToSales = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsExiting(true);
    setTimeout(() => navigate('/landing'), 500);
  };

  // SEO meta tags for Business landing
  useEffect(() => {
    document.title = "CloseOS Business — Gérer Équipe de Closers | Logiciel Infopreneur Closing & Pilotage";
    document.querySelector('meta[name="description"]')?.setAttribute('content',
      "CloseOS Business est la plateforme pour gérer une équipe de closers et setters. Pilotage équipe closing, CRM acquisition infopreneur, campagnes d'acquisition, tableau de bord infopreneur, KPIs d'équipe. Alternative iClosed. Logiciel infopreneur closing francophone."
    );

    const existingLd = document.querySelector('script[data-closeos-biz-ld]');
    if (!existingLd) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-closeos-biz-ld', 'true');
      script.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'CloseOS Business',
        url: 'https://www.closeos.fr/business',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        description: "Plateforme de management pour infopreneurs et Head of Sales. Gestion d'équipe de closers et setters, pilotage campagnes d'acquisition, CRM acquisition, tableau de bord infopreneur. Alternative à iClosed, 100% en français.",
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'EUR',
          description: 'Liste d\'attente — tarifs early adopters',
        },
        featureList: "Gérer équipe de closers, Pilotage équipe closing, Logiciel infopreneur closing, CRM acquisition infopreneur, Outil gestion setter closer, Piloter campagne acquisition closing, Tableau de bord infopreneur, KPIs d'équipe, Onboarding closers automatisé",
        inLanguage: 'fr',
      });
      document.head.appendChild(script);
    }

    // FAQ structured data for GEO
    const existingFaqLd = document.querySelector('script[data-closeos-biz-faq-ld]');
    if (!existingFaqLd) {
      const faqScript = document.createElement('script');
      faqScript.type = 'application/ld+json';
      faqScript.setAttribute('data-closeos-biz-faq-ld', 'true');
      faqScript.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'A qui est destiné CloseOS Business ?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: "CloseOS Business est destiné à toute personne qui vend en ligne : infopreneurs, agences, Head of Sales, solopreneurs et ceux qui lancent des Challenges. Même un closer seul ou un duo setter/closer peut tirer parti de l'outil de management.",
            },
          },
          {
            '@type': 'Question',
            name: 'CloseOS Business est-il compatible avec mes outils CRM actuels ?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: "Oui. CloseOS Business se connecte nativement à 6 plateformes : HubSpot (bidirectionnel), Pipedrive (bidirectionnel), GoHighLevel GHL (bidirectionnel), Airtable (bidirectionnel), Systeme.io (webhook) et iClosed (unidirectionnel via webhook). Le CRM intégré CloseOS Business offre les meilleures performances pour l'écosystème.",
            },
          },
          {
            '@type': 'Question',
            name: 'Pourquoi utiliser le CRM CloseOS si j\'ai déjà HubSpot ou Pipedrive ?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: "CloseOS ne remplace pas forcément votre CRM — il s'y connecte. Gardez HubSpot, Pipedrive, GoHighLevel ou Airtable comme source marketing, et utilisez CloseOS comme cockpit de closing optimisé. La synchronisation bidirectionnelle assure que chaque prospect est à jour des deux côtés. Le CRM natif CloseOS offre l'assignation automatique setter/closer, capture de leads, tracking campagnes et analytics intégrés.",
            },
          },
          {
            '@type': 'Question',
            name: 'Mes closers ont-ils accès à toutes les données ?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: "Non. Vous définissez les niveaux d'accès. Chaque closer voit uniquement ses prospects, ses KPIs et son pipeline. Les données sensibles (CA global, marges, contacts stratégiques) restent visibles par vous seul.",
            },
          },
          {
            '@type': 'Question',
            name: 'C\'est quoi CloseOS Business ?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: "CloseOS Business est la plateforme de management pour infopreneurs et Head of Sales francophones. Elle permet de gérer une équipe de closers et setters, piloter les campagnes d'acquisition, suivre les KPIs d'équipe et automatiser l'onboarding des closers. C'est l'alternative française à iClosed, conçue pour le pilotage d'équipe closing.",
            },
          },
          {
            '@type': 'Question',
            name: 'Combien de closers puis-je ajouter dans CloseOS Business ?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: "Autant que vous voulez. CloseOS Business n'impose aucune limite sur la taille de votre équipe de closers et setters.",
            },
          },
          {
            '@type': 'Question',
            name: 'Les données sont-elles sécurisées et conformes au RGPD ?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: "Oui. CloseOS Business est 100% conforme au RGPD. Toutes les données sont hébergées de manière sécurisée, isolées par organisation, et aucun tiers n'y a accès. Vous restez propriétaire de vos données à tout moment.",
            },
          },
        ],
      });
      document.head.appendChild(faqScript);
    }

    return () => {
      document.querySelector('script[data-closeos-biz-ld]')?.remove();
      document.querySelector('script[data-closeos-biz-faq-ld]')?.remove();
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);

    // Chatbot initialization
    const s = document.createElement('script');
    s.src = '/chatbot-widget.js';
    s.setAttribute('data-chatbot-id', 'acb35233-a6de-4738-9ba0-7e25c82c2a61');
    s.setAttribute('data-supabase-url', 'https://mkxcircbzcsjamslijde.supabase.co');
    s.setAttribute('data-supabase-key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1reGNpcmNiemNzamFtc2xpamRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MjM0MDAsImV4cCI6MjA4NzQ5OTQwMH0.9-abq1tEFsmjfRkLJjrkXlG3z-9o2HKYjyp5eBIl178');
    document.body.appendChild(s);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (document.body.contains(s)) {
        document.body.removeChild(s);
      }
      const chatbotContainer = document.getElementById('chatbot-widget-container');
      if (chatbotContainer) {
        chatbotContainer.remove();
      }
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div ref={pageRef} className={`bg-[#f4f2f1] font-sans text-[#111111] min-h-screen selection:bg-[#8a43e1]/20 transition-all duration-500 ${isExiting ? 'translate-y-full opacity-0' : 'animate-[pageEnterFromTop_0.5s_ease-out]'}`}>
      
      {/* Navigation */}
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-5xl">
        <div className="bg-white/80 backdrop-blur-md border border-stone-200/50 rounded-2xl px-6 py-2 flex items-center justify-between shadow-sm">
          <div className="relative group flex items-center gap-1 cursor-pointer">
            <img
              alt="CloseOS Logo"
              className="w-auto object-contain h-12"
              src="/CloseOS Buisness.png"
            />
            <ChevronDown className="h-4 w-4 text-stone-400 group-hover:text-stone-800 transition-transform duration-300 group-hover:rotate-180" />
            <div className="absolute top-full left-0 right-0 mt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 translate-y-2 group-hover:translate-y-0">
              <a onClick={handleNavigateToSales} className="block rounded-xl border border-white/10 bg-[#020617] p-3 shadow-xl hover:bg-[#0f172a] transition-colors cursor-pointer">
                <img src="/logo Sales.png" alt="CloseOS Sales" className="w-full h-auto" />
              </a>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-stone-600">
            <a href="#features" className="hover:text-[#111111] transition-colors">Management</a>
            <a href="#crm" className="hover:text-[#111111] transition-colors">CRM</a>
            <a href="#roles" className="hover:text-[#111111] transition-colors">Rôles</a>
            <a href="#faq" className="hover:text-[#111111] transition-colors">FAQ</a>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsModalOpen(true)}
              className="hidden sm:flex items-center justify-center rounded-lg h-10 px-5 text-white text-sm font-semibold tracking-wide hover:opacity-90 transition-all bg-[#111111]"
            >
              Liste d'attente
            </button>
            <button className="md:hidden p-2 text-stone-600">
              <Menu className="size-5" />
            </button>
          </div>
        </div>
      </nav>

      <main className="flex flex-col flex-1 pt-24">
        {/* Hero Section */}
        <section className="px-6 md:px-20 py-16 md:py-24 max-w-6xl mx-auto text-center relative">
          
          {/* Abstract Background Blobs */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[500px] opacity-30 pointer-events-none -z-10">
            <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-[#ff2f2f] rounded-full mix-blend-multiply filter blur-[100px] animate-blob"></div>
            <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-[#ef7b16] rounded-full mix-blend-multiply filter blur-[100px] animate-blob animation-delay-2000"></div>
            <div className="absolute -bottom-8 left-1/3 w-64 h-64 bg-[#8a43e1] rounded-full mix-blend-multiply filter blur-[100px] animate-blob animation-delay-4000"></div>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col items-center gap-8 max-w-4xl mx-auto"
          >
            <div className="flex items-center gap-3 flex-wrap justify-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
                <span className="text-xs font-bold text-emerald-700">RGPD</span>
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-stone-200 shadow-sm">
                <span className="text-sm font-medium text-stone-800">
                  🚀 Déjà <span className="font-bold bg-gradient-to-r from-[#ff2f2f] via-[#ef7b16] to-[#d511fd] text-transparent bg-clip-text">+150 closers</span> qui valident CloseOS Sales
                </span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
                <span className="text-xs font-bold text-emerald-700">Eco-responsable</span>
              </div>
            </div>

            <h1 className="text-5xl md:text-7xl lg:text-[80px] font-bold leading-[1.1] tracking-tight text-[#111111]">
              Gérez votre équipe de closers et pilotez votre acquisition.
            </h1>

            <p className="text-stone-500 text-base font-semibold bg-red-50 border border-red-100 px-5 py-2.5 rounded-full">
              70% des infopreneurs perdent du CA parce qu'ils ne savent pas quoi améliorer.
            </p>

            <p className="text-stone-600 text-lg md:text-xl font-medium leading-relaxed max-w-2xl">
              CRM, équipe, campagnes, KPIs — tout ce dont un infopreneur a besoin pour structurer son acquisition et scaler.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-4">
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex min-w-[200px] items-center justify-center rounded-xl h-14 px-8 text-white text-lg font-semibold shadow-lg hover:-translate-y-1 transition-all bg-[#111111]"
              >
                Rejoindre la liste d'attente — Tarifs early adopters le 4 avril
              </button>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <div className="flex -space-x-3">
                {['U1', 'U2', 'U3', 'U4'].map((u) => (
                  <img key={u} src={`/${u}.png`} alt="" className="w-9 h-9 rounded-full border-2 border-white object-cover" />
                ))}
              </div>
              <p className="text-sm text-stone-500 font-medium">
                Validé par <span className="font-bold text-[#111111]">+12 infopreneurs</span> francophones
              </p>
            </div>

          </motion.div>
        </section>

        {/* Dashboard Macro Section (Bento Grid) */}
        <motion.section 
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="px-6 md:px-20 py-24 max-w-7xl mx-auto" 
          id="features"
        >
          <div className="text-center mb-16 space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-stone-200 shadow-sm mb-4">
              <span className="text-sm font-semibold text-stone-800">Centre de Commandement Manager</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-[#111111] tracking-tight">Pilotez et gérez votre écosystème de vente avec une autorité absolue</h2>
            <p className="text-stone-600 text-lg max-w-2xl mx-auto">Centralisez tout votre management dans un OS puissant. Du tableau de bord stratégique macro à la gestion de chaque closer et l'automatisation de leur formation, vous ne gérez plus, vous pilotez la croissance.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Macro Dashboard */}
            <div className="lg:col-span-3 bg-white rounded-3xl p-8 border border-stone-200 shadow-sm">
              <div className="mb-8">
                <h3 className="text-2xl font-bold text-[#111111] mb-2">Tableau de Bord Macro</h3>
                <p className="text-stone-500">Suivez vos KPIs stratégiques en temps réel pour prendre les meilleures décisions.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPIBox index={0} title="CA Total" value="145,000€" change="+15%" icon={<ArrowUp className="text-emerald-500 size-5" />} positive={true} />
                <KPIBox index={1} title="CA par Closer" value="12,400€" change="+5%" icon={<ArrowUp className="text-emerald-500 size-5" />} positive={true} />
                <KPIBox index={2} title="Taux de Closing" value="28%" change="-2%" icon={<ArrowDown className="text-rose-500 size-5" />} positive={false} />
                <KPIBox index={3} title="Taux de No-show" value="12%" change="-4%" icon={<ArrowDown className="text-rose-500 size-5" />} positive={false} />
              </div>
            </div>

            {/* Team Management */}
            <TeamManagement />

            {/* Shared Pipeline */}
            <SharedPipeline />

            {/* Onboarding */}
            <Onboarding />
          </div>
        </motion.section>

        {/* CRM Feature Teaser */}
        <motion.section 
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="px-6 md:px-20 py-32 bg-white border-y border-stone-200 relative overflow-hidden" 
          id="crm"
        >
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="text-center mb-20">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-stone-100 border border-stone-200 shadow-sm mb-6">
                <span className="text-sm font-semibold text-stone-800 uppercase tracking-widest">L'outil tout-en-un</span>
              </div>
              <h2 className="text-5xl md:text-6xl font-bold mb-6 text-[#111111] tracking-tight">CloseOS devient votre Système d'acquisition</h2>
              <p className="text-stone-500 text-xl max-w-3xl mx-auto font-medium">
                Un CRM conçu exclusivement pour le closing haute performance — avec synchronisation native vers vos outils existants.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-20">
              <div className="lg:col-span-7">
                <LeadProfile />
              </div>
              <div className="lg:col-span-5 flex flex-col justify-center gap-4">
                <CRMFeature icon={<Layers className="size-5" />} title="Pipeline CRM indépendant" description="Double vue stratégique : vue individuelle pour chaque closer vs vue globale temps réel pour l'infopreneur." />
                <CRMFeature icon={<Bell className="size-5" />} title="Relances automatiques" extra={<div className="mt-3 bg-amber-100 text-amber-800 px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 w-fit"><ArrowUp className="size-3.5" /> RAPPELER DANS 3 JOURS</div>} />
                <CRMFeature icon={<Tag className="size-5" />} title="Tags illimités & Filtres" extra={<div className="flex gap-2 mt-3 text-left"><span className="px-2.5 py-1 rounded-md bg-stone-100 text-stone-600 text-xs font-semibold border border-stone-200">Froid</span><span className="px-2.5 py-1 rounded-md bg-stone-100 text-stone-600 text-xs font-semibold border border-stone-200">Rappel</span><span className="px-2.5 py-1 rounded-md bg-stone-100 text-stone-600 text-xs font-semibold border border-stone-200">Urgent</span></div>} />
              </div>
            </div>

            {/* Capture Section */}
            <CaptureSection />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-16 border-t border-stone-200">
              <CRMKPI index={0} title="KPI CRM • Pipeline" value="452,000€" description="Valeur totale du pipeline en cours" />
              <CRMKPI index={1} title="KPI CRM • Performance" value="4,850€" description="Deal moyen encaissé" />
              <CRMKPI index={2} title="KPI CRM • Vélocité" value="12 Jours" description="Cycle de vente moyen (Lead to Close)" />
            </div>

            {/* Integrations Banner */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6 }}
              className="mt-16 pt-16 border-t border-stone-200"
            >
              <div className="text-center mb-10">
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-stone-400 mb-3">11+ intégrations natives · 6 000+ via Zapier</p>
                <h3 className="text-2xl md:text-3xl font-bold text-[#111111] tracking-tight">
                  Connectez vos outils existants. Ou utilisez tout en natif.
                </h3>
                <p className="text-stone-500 text-base mt-3 max-w-2xl mx-auto">
                  CloseOS se synchronise avec vos CRM et outils d'acquisition en bidirectionnel. Gardez votre stack ou centralisez tout — c'est vous qui décidez.
                </p>
              </div>
              <div className="relative overflow-hidden">
                <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#fbf9f8] to-transparent z-10 pointer-events-none" />
                <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#fbf9f8] to-transparent z-10 pointer-events-none" />
                <div className="flex animate-scroll-left gap-6 w-max">
                  {[...Array(2)].map((_, dup) => (
                    <div key={dup} className="flex gap-6">
                      {[
                        { name: 'HubSpot', logo: '/HubSpot.png', type: 'Sync bidirectionnelle' },
                        { name: 'Pipedrive', logo: '/Pipedrive.png', type: 'Sync bidirectionnelle' },
                        { name: 'GoHighLevel', logo: '/GHL.jpg', type: 'Sync bidirectionnelle' },
                        { name: 'Airtable', logo: '/airtable.png', type: 'Sync bidirectionnelle' },
                        { name: 'Systeme.io', logo: '/Systemeio.png', type: 'Webhook' },
                        { name: 'iClosed', logo: '/Iclosed.png', type: 'Webhook' },
                        { name: 'Google Calendar', logo: '/Gcalendar.svg.png', type: 'Sync bidirectionnelle' },
                        { name: 'Stripe', logo: '/Stripe.png', type: 'Paiements' },
                        { name: 'Calendly', logo: '/Calendly.png', type: 'Webhook' },
                        { name: 'Zapier', logo: '/Zapier.png', type: 'Automatisation' },
                        { name: 'Cal.com', logo: '/Calcom.png', type: 'Sync bidirectionnelle' },
                      ].map((integration) => (
                        <div
                          key={`${dup}-${integration.name}`}
                          className="flex flex-col items-center gap-2 px-8 py-5 bg-white rounded-2xl border border-stone-200 shadow-sm min-w-[160px] transition-transform duration-300 hover:scale-110 hover:shadow-md hover:z-20"
                        >
                          <img src={integration.logo} alt={integration.name} className="h-8 w-auto object-contain" />
                          <span className="text-sm font-bold text-[#111111]">{integration.name}</span>
                          <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">{integration.type}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            <div className="flex justify-center mt-12">
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center justify-center rounded-xl h-14 px-8 text-white text-lg font-semibold shadow-lg hover:-translate-y-1 transition-all bg-[#111111]"
              >
                Rejoindre la liste d'attente
              </button>
            </div>
          </div>
        </motion.section>

        {/* Features by Role Section */}
        <FeaturesByRole />

        <div className="flex justify-center -mt-8 mb-16">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center rounded-xl h-14 px-8 text-white text-lg font-semibold shadow-lg hover:-translate-y-1 transition-all bg-[#111111]"
          >
            Rejoindre la liste d'attente
          </button>
        </div>

        {/* Demo Section */}
        <motion.section
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="px-6 md:px-20 py-24 max-w-5xl mx-auto"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-stone-400 mb-3">Démo personnalisée</p>
              <h2 className="text-4xl md:text-5xl font-bold text-[#111111] tracking-tight mb-4">
                Réservez une démo avec notre équipe
              </h2>
              <p className="text-stone-500 text-lg mb-6">
                15 minutes pour découvrir comment CloseOS peut s'adapter à votre business. On vous montre l'outil, on répond à vos questions.
              </p>
              <ul className="space-y-3 text-stone-600 font-medium">
                <li className="flex items-center gap-3"><CheckCircle className="size-5 text-emerald-500 shrink-0" /> Démo adaptée à votre structure</li>
                <li className="flex items-center gap-3"><CheckCircle className="size-5 text-emerald-500 shrink-0" /> Réponses à toutes vos questions</li>
                <li className="flex items-center gap-3"><CheckCircle className="size-5 text-emerald-500 shrink-0" /> Sans engagement, 100% gratuit</li>
              </ul>
            </div>
            <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-2 min-h-[450px] flex items-center justify-center">
              {/* TODO: Remplacer par l'embed Calendly / Cal.com */}
              <p className="text-stone-400 font-medium">Calendrier de réservation à intégrer</p>
            </div>
          </div>
        </motion.section>

        {/* FAQ Section */}
        <motion.section 
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="px-6 md:px-20 py-32 bg-[#f4f2f1]" 
          id="faq"
        >
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-16 space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-stone-200 shadow-sm mb-4">
                <span className="text-sm font-semibold text-stone-800">FAQs</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-[#111111] tracking-tight">Questions fréquentes</h2>
              <p className="text-stone-500 text-lg">Tout ce que vous devez savoir avant de rejoindre la liste d'attente.</p>
            </div>
            <div className="space-y-4">
              <FAQItem
                question="A qui est destiné cet outil ?"
                answer={<p>Il est destiné à toute personne qui vend en ligne : <strong>infopreneurs</strong>, <strong>agences</strong>, <strong>Head of Sales</strong>, mais aussi les <strong>solopreneurs</strong> et ceux qui lancent des <strong>Challenges</strong>. Quand on parle d'équipe, on ne parle pas forcément d'une grosse structure — même un closer seul ou un duo setter/closer peut tirer parti de l'outil.</p>}
              />
              <FAQItem
                question="CloseOS Business est-il compatible avec mes outils CRM actuels ?"
                answer={<div className="space-y-3"><p>Oui. En plus de notre propre CRM intégré, CloseOS Business se connecte nativement à <strong>6 plateformes</strong> :</p><ul className="list-disc pl-5 space-y-1"><li><strong>HubSpot</strong> — synchronisation complète bidirectionnelle</li><li><strong>Pipedrive</strong> — synchronisation complète bidirectionnelle</li><li><strong>GoHighLevel (GHL)</strong> — synchronisation complète bidirectionnelle</li><li><strong>Airtable</strong> — synchronisation complète bidirectionnelle</li><li><strong>Systeme.io</strong> — import de contacts via webhook</li><li><strong>iClosed</strong> — synchronisation unidirectionnelle via webhook</li></ul><p>Cela dit, nous recommandons d'utiliser le <strong>CRM intégré CloseOS Business</strong> : c'est lui qui offre les meilleures performances et la gestion la plus simple dans cet écosystème. Tout est conçu pour fonctionner ensemble, sans friction.</p></div>}
              />
              <FAQItem
                question="Pourquoi utiliser le CRM CloseOS si j'ai déjà HubSpot ou Pipedrive ?"
                answer={<div className="space-y-3"><p>CloseOS ne remplace pas forcément votre CRM actuel — il <strong>s'y connecte</strong>. Vous pouvez garder HubSpot, Pipedrive, GoHighLevel ou Airtable comme source de vérité marketing, et utiliser CloseOS comme <strong>cockpit de closing</strong> optimisé pour votre équipe.</p><p>La synchronisation bidirectionnelle signifie que chaque prospect ajouté ou mis à jour d'un côté est reflété de l'autre. Vos closers travaillent dans CloseOS (pipeline, appels, KPIs), et vos données marketing restent à jour dans votre stack existante.</p><p>Pour les équipes qui veulent tout centraliser, le <strong>CRM natif CloseOS</strong> offre les meilleures performances : assignation automatique setter/closer, capture de leads, tracking de campagnes et analytics intégrés sans aucune config externe.</p></div>}
              />
              <FAQItem
                question="Mes données sont-elles sécurisées et conformes au RGPD ?"
                answer={<p>Oui. CloseOS Business est <strong>100% conforme au RGPD</strong>. Toutes les données sont hébergées de manière sécurisée, isolées par organisation, et aucun tiers n'y a accès. Tu restes propriétaire de tes données à tout moment.</p>}
              />
              <FAQItem
                question="Mes closers ont-ils accès à toutes les données ?"
                answer={<p>Non. Tu définis toi-même les niveaux d'accès. Chaque closer voit uniquement ses prospects, ses KPIs et son pipeline. Les données sensibles (CA global, marges, contacts stratégiques) restent visibles par toi seul.</p>}
              />
              <FAQItem
                question="Combien de closers puis-je ajouter ?"
                answer={<p>Autant que tu veux. CloseOS Business n'impose <strong>aucune limite</strong> sur la taille de ton équipe.</p>}
              />
              <FAQItem
                question="Est-ce difficile à prendre en main pour mes closers ?"
                answer={<p>Non. L'onboarding est <strong>100% autonome</strong> — tes closers sont guidés dès leur première connexion avec tes scripts, ressources et KPIs de progression. Tu n'as rien à expliquer manuellement.</p>}
              />
              <FAQItem
                question="Est-ce que CloseOS Business sera parfaitement adapté à mon business ?"
                answer={<p>C'est justement l'objectif. <strong>CloseOS Business se construit avec les infopreneurs inscrits sur la liste d'attente.</strong> Tes retours, tes besoins et tes cas d'usage concrets façonnent directement l'outil. Tu ne découvres pas un produit fini — tu participes à créer le meilleur outil de closing du marché.</p>}
              />
            </div>
          </div>
        </motion.section>

        {/* Final CTA */}
        <motion.section 
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="px-6 md:px-20 py-32 bg-white text-center border-t border-stone-200"
        >
          <div className="max-w-3xl mx-auto space-y-10">
            <h2 className="text-5xl md:text-6xl font-bold leading-tight tracking-tight text-[#111111]">Prêt à scaler votre écosystème de closing ?</h2>
            <p className="text-stone-500 text-xl">Inscrivez-vous maintenant et débloquez un tarif early adopter imbattable, dévoilé le 4 avril.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <button
                onClick={() => setIsModalOpen(true)}
                className="w-full sm:w-auto flex min-w-[240px] items-center justify-center rounded-xl h-16 px-10 text-white text-lg font-semibold shadow-xl hover:-translate-y-1 transition-all bg-[#111111]"
              >
                Rejoindre la liste d'attente — Tarifs le 4 avril
              </button>
            </div>
          </div>
        </motion.section>
      </main>

      <footer className="px-6 md:px-20 py-6 border-t border-stone-200 bg-[#f4f2f1] flex flex-col md:flex-row items-center justify-between gap-4 pb-16">
        <div className="flex items-center gap-2">
          <img
            alt="CloseOS Logo"
            className="w-auto object-contain h-10"
            src="/CloseOS Buisness.png"
          />
        </div>
        <p className="text-stone-500 text-xs font-medium">© 2026 CloseOS. All rights reserved.</p>
      </footer>

      {/* Fixed bottom blur cue */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#f4f2f1] via-[#f4f2f1]/80 to-transparent backdrop-blur-[1px] pointer-events-none z-[80]" />

      <WaitingListModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      {/* Floating Scroll to Top Button */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-8 left-8 z-[90] p-4 rounded-full bg-white border border-stone-200 shadow-lg transition-all duration-500 hover:scale-110 hover:-translate-y-1 group ${showScrollTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}
        aria-label="Retour en haut"
      >
        <ArrowUp className="size-5 text-stone-800 group-hover:animate-bounce" />
      </button>

      <style>{`
        @keyframes pageEnterFromTop {
          from { opacity: 0; transform: translateY(-60px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}

// --- Sub-components ---

const KPIBox = ({ title, value, change, icon, positive, index }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-50px" }}
    transition={{ duration: 0.6, delay: (index || 0) * 0.1, ease: "easeOut" }}
    className="bg-stone-50 p-6 rounded-2xl border border-stone-100 flex flex-col gap-3 hover:shadow-md transition-all duration-300"
  >
    <div className="flex items-center justify-between">
      <span className="text-stone-500 text-xs font-bold uppercase tracking-widest">{title}</span>
      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm border border-stone-100">
        {icon}
      </div>
    </div>
    <p className="text-[#111111] text-3xl font-bold tracking-tight">{value}</p>
    <p className={`${positive ? 'text-emerald-600' : 'text-rose-500'} text-xs font-semibold flex items-center gap-1`}>
      {change} vs mois dernier
    </p>
  </motion.div>
);

const TeamManagement = () => (
  <motion.div 
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-100px" }}
    transition={{ duration: 0.8, delay: 0.2 }}
    className="lg:col-span-2 bg-white rounded-3xl p-8 border border-stone-200 shadow-sm flex flex-col justify-between"
  >
    <div>
      <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center mb-6">
        <Layers className="size-6 text-stone-800" />
      </div>
      <h3 className="text-2xl font-bold text-[#111111] mb-3">Gestion de l'Équipe complète</h3>
      <p className="text-stone-500 mb-8">
        Organisez vos closers et setters en équipes, suivez qui est en ligne en temps réel, gérez les disponibilités, absences, primes et commissions individuelles. Invitez de nouveaux membres en un clic avec des rôles prédéfinis.
      </p>
    </div>
    <div className="space-y-3">
      <TeamMember index={0} name="Julien Durand" role="Closer Senior" conv="34%" />
      <TeamMember index={1} name="Marie Lefebvre" role="Setter" conv="21%" />
      <TeamMember index={2} name="Sophie Martin" role="Setter-Closer" conv="28%" />
    </div>
  </motion.div>
);

const SharedPipeline = () => (
  <motion.div 
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-100px" }}
    transition={{ duration: 0.8, delay: 0.4 }}
    className="lg:col-span-1 bg-white rounded-3xl p-8 border border-stone-200 shadow-sm flex flex-col"
  >
    <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center mb-6">
      <Tag className="size-6 text-stone-800" />
    </div>
    <h3 className="text-2xl font-bold text-[#111111] mb-3">Pipeline Partagé</h3>
    <p className="text-stone-500 mb-8">
      Un kanban visuel clair avec code couleur et drag-and-drop pour un suivi impeccable.
    </p>
    <div className="mt-auto bg-stone-50 rounded-2xl p-4 border border-stone-100">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-bold uppercase tracking-wider text-stone-500">RDV Fixé</span>
        <span className="text-xs font-bold text-stone-400">12</span>
      </div>
      <PipelineCard name="Michel Robert" source="MAI 24 - 14:00" highlight={false} />
    </div>
  </motion.div>
);

const Onboarding = () => (
  <motion.div 
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-100px" }}
    transition={{ duration: 0.8, delay: 0.6 }}
    className="lg:col-span-3 bg-[#111111] rounded-3xl p-8 md:p-12 text-white relative overflow-hidden"
  >
    <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#ff2f2f]/20 to-[#8a43e1]/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
    
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 relative z-10">
      <div className="flex flex-col justify-center">
        <span className="text-stone-400 font-bold text-sm tracking-[0.2em] uppercase mb-4">Autonomie Totale</span>
        <h3 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">Onboarding des closers simplifié</h3>
        <p className="text-stone-300 text-lg mb-8 leading-relaxed">
          Arrêtez de perdre du temps à former chaque nouveau closer manuellement. Notre système automatisé les guide de A à Z avec vos scripts, ressources et KPIs de suivi de progression.
        </p>
        <ul className="space-y-4">
          <li className="flex items-center gap-3 text-stone-200 font-medium">
            <CheckCircle className="text-emerald-400 size-5" /> Monday Morning Reporting (Auto)
          </li>
          <li className="flex items-center gap-3 text-stone-200 font-medium">
            <CheckCircle className="text-emerald-400 size-5" /> Exports hebdomadaires par email
          </li>
        </ul>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <BoxItem index={0} icon={<FileText className="size-6 text-white" />} title="Scripts & Playbooks" description="Centralisez vos meilleures méthodes." dark />
        <BoxItem index={1} icon={<Video className="size-6 text-white" />} title="Vidéos de Formation" description="Onboarding 100% autonome." dark />
        <BoxItem index={2} icon={<CheckCircle className="size-6 text-white" />} title="Suivi Progression" description="Vérifiez les acquis avant le 1er call." dark />
        <BoxItem index={3} icon={<ArrowDown className="size-6 text-white" />} title="Exports Auto" description="Data exportable en CSV/PDF." dark />
      </div>
    </div>
  </motion.div>
);

const TeamMember = ({ name, role, conv, index }: any) => (
  <motion.div 
    initial={{ opacity: 0, x: -20 }}
    whileInView={{ opacity: 1, x: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5, delay: (index || 0) * 0.1 }}
    className="flex items-center justify-between p-4 bg-stone-50 rounded-xl border border-stone-100 hover:shadow-sm transition-all duration-300"
  >
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center font-bold text-stone-600 text-sm">
        {name.split(' ').map((n: string) => n[0]).join('')}
      </div>
      <div>
        <p className="text-[#111111] font-bold text-sm">{name}</p>
        <p className="text-stone-500 text-xs font-medium">{role}</p>
      </div>
    </div>
    <div className="text-right flex flex-col items-end gap-1">
      <p className="text-[#111111] font-bold text-sm">{conv} Conv.</p>
      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-bold uppercase tracking-wider">Online</span>
    </div>
  </motion.div>
);

const PipelineCard = ({ name, source, time, highlight }: any) => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.95 }}
    whileInView={{ opacity: 1, scale: 1 }}
    viewport={{ once: true }}
    className={`p-4 rounded-xl shadow-sm border space-y-3 text-left transition-all duration-300 bg-white border-stone-200`}
  >
    <p className={`text-[#111111] font-bold text-sm`}>{name}</p>
    <div className="flex justify-between items-center">
      <span className={`text-[10px] bg-stone-100 text-stone-600 px-2 py-1 rounded-md font-bold uppercase tracking-wider`}>{source}</span>
      {time && <span className="text-stone-400 text-[10px] font-medium">{time}</span>}
    </div>
  </motion.div>
);

const BoxItem = ({ icon, title, description, dark, index }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5, delay: (index || 0) * 0.1 }}
    className={`${dark ? 'bg-white/5 border-white/10' : 'bg-stone-50 border-stone-100'} p-6 rounded-2xl border text-left`}
  >
    <div className="mb-4 bg-white/10 w-12 h-12 rounded-xl flex items-center justify-center">{icon}</div>
    <h4 className={`font-bold mb-2 ${dark ? 'text-white' : 'text-[#111111]'}`}>{title}</h4>
    <p className={`text-sm font-medium ${dark ? 'text-stone-400' : 'text-stone-500'}`}>{description}</p>
  </motion.div>
);

const CRMFeature = ({ icon, title, description, extra, index }: any) => (
  <motion.div 
    initial={{ opacity: 0, x: 20 }}
    whileInView={{ opacity: 1, x: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5, delay: (index || 0) * 0.1 }}
    className="bg-stone-50 hover:bg-stone-100 border border-stone-200 p-5 rounded-2xl transition-all group text-left"
  >
    <div className="flex gap-4">
      <div className="size-10 rounded-xl bg-white border border-stone-200 shadow-sm flex items-center justify-center text-stone-800 flex-shrink-0">{icon}</div>
      <div className="flex-1">
        <h4 className="font-bold text-[#111111] mb-1">{title}</h4>
        {description && <p className="text-sm text-stone-500 font-medium">{description}</p>}
        {extra}
      </div>
    </div>
  </motion.div>
);

const CaptureSection = () => {
  const [captureTab, setCaptureTab] = useState<'page' | 'embed' | 'popup'>('page');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-20">
      {/* Left — Text */}
      <div className="lg:col-span-5 flex flex-col justify-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-100 border border-stone-200 shadow-sm mb-6 w-fit">
          <Megaphone className="size-3.5 text-stone-600" />
          <span className="text-xs font-bold text-stone-600 uppercase tracking-widest">Capture de Leads</span>
        </div>
        <h3 className="text-3xl md:text-4xl font-bold text-[#111111] tracking-tight mb-4">Captez vos prospects automatiquement</h3>
        <p className="text-stone-500 text-lg font-medium leading-relaxed mb-6">
          Créez des pages de capture, intégrez un formulaire en embed ou lancez un popup directement sur votre site. Chaque lead est automatiquement injecté dans votre CRM avec le bon setter/closer assigné.
        </p>
        <div className="space-y-3">
          <div className="flex items-start gap-3 text-stone-700 font-medium">
            <CheckCircle className="size-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <span>100% personnalisable : couleur de fond, police, titre, sous-titre et description</span>
          </div>
          <div className="flex items-start gap-3 text-stone-700 font-medium">
            <CheckCircle className="size-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <span>Embed iframe intégrable sur n'importe quel site</span>
          </div>
          <div className="flex items-start gap-3 text-stone-700 font-medium">
            <CheckCircle className="size-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <span>Popup déclenchable au clic ou en automatique</span>
          </div>
          {captureTab === 'page' && (
            <div className="flex items-start gap-3 text-stone-700 font-medium">
              <CheckCircle className="size-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <span>Ajoutez une vidéo de présentation avec un lien de redirection</span>
            </div>
          )}
        </div>
      </div>

      {/* Right — Preview */}
      <div className="lg:col-span-7">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="bg-white rounded-3xl overflow-hidden shadow-xl border border-stone-200 text-left"
        >
          {/* Tab bar */}
          <div className="flex border-b border-stone-100 bg-stone-50">
            {([
              { key: 'page' as const, label: 'Page' },
              { key: 'embed' as const, label: 'Embed' },
              { key: 'popup' as const, label: 'Popup' },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setCaptureTab(tab.key)}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-colors ${
                  captureTab === tab.key
                    ? 'text-[#111111] border-b-2 border-[#111111]'
                    : 'text-stone-400 hover:text-stone-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Preview content */}
          <div className="p-5 md:p-6">
            {captureTab === 'page' && (
              <div className="space-y-4">
                {/* Browser bar */}
                <div className="bg-stone-100 rounded-xl p-3 flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  </div>
                  <div className="flex-1 bg-white rounded-lg px-3 py-1.5 text-xs text-stone-400 font-mono">
                    closeos.fr/capture/mastermind-2026
                  </div>
                </div>
                {/* Capture page — two columns: form left, agenda right */}
                <div className="bg-gradient-to-br from-[#111111] to-[#1a1a2e] rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Left — Registration form */}
                  <div className="space-y-3">
                    <h4 className="text-white text-lg font-bold leading-tight">Réservez votre appel stratégique</h4>
                    <p className="text-stone-400 text-xs font-medium">Remplissez vos informations pour accéder au calendrier</p>
                    <div className="space-y-2">
                      <div className="bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-xs text-stone-400">Votre prénom</div>
                      <div className="bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-xs text-stone-400">votre@email.com</div>
                      <div className="bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-xs text-stone-400">+33 6 00 00 00 00</div>
                    </div>
                    <div className="bg-white text-[#111111] rounded-lg px-4 py-2.5 text-xs font-bold text-center">Continuer</div>
                  </div>
                  {/* Right — Blurred agenda */}
                  <div className="relative rounded-xl overflow-hidden bg-white/5 border border-white/10 p-4">
                    <div className="absolute inset-0 backdrop-blur-md bg-white/5 z-10 flex items-center justify-center">
                      <div className="text-center px-4">
                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-2">
                          <Calendar className="size-5 text-white/60" />
                        </div>
                        <p className="text-white/70 text-xs font-bold">D'abord remplir les informations</p>
                      </div>
                    </div>
                    {/* Fake calendar grid behind blur */}
                    <div className="opacity-30 space-y-2">
                      <div className="flex gap-1">
                        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'].map(d => (
                          <div key={d} className="flex-1 text-center text-[8px] text-white/50 font-bold">{d}</div>
                        ))}
                      </div>
                      {[0, 1, 2].map(row => (
                        <div key={row} className="flex gap-1">
                          {[0, 1, 2, 3, 4].map(col => (
                            <div key={col} className={`flex-1 h-6 rounded ${col === 2 && row === 1 ? 'bg-emerald-500/40' : 'bg-white/10'}`} />
                          ))}
                        </div>
                      ))}
                      <div className="space-y-1 mt-2">
                        {['09:00', '09:30', '10:00', '10:30'].map(t => (
                          <div key={t} className="bg-white/10 rounded px-2 py-1 text-[8px] text-white/40">{t}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {captureTab === 'embed' && (
              <div className="space-y-4">
                {/* Browser bar — CloseOS Sales site */}
                <div className="bg-stone-100 rounded-xl p-3 flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  </div>
                  <div className="flex-1 bg-white rounded-lg px-3 py-1.5 text-xs text-stone-400 font-mono">
                    closeos.fr/sales
                  </div>
                </div>
                {/* Fake CloseOS Sales page with embedded form */}
                <div className="bg-[#020617] rounded-2xl overflow-hidden">
                  {/* Fake nav */}
                  <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
                    <img src="/logo Sales.png" alt="CloseOS Sales" className="h-6 object-contain" />
                    <div className="flex gap-4">
                      <div className="h-2 w-12 bg-white/20 rounded" />
                      <div className="h-2 w-12 bg-white/20 rounded" />
                      <div className="h-2 w-10 bg-white/20 rounded" />
                    </div>
                  </div>
                  {/* Page content */}
                  <div className="p-5 space-y-4">
                    {/* Hero skeleton */}
                    <div className="text-center space-y-2 py-3">
                      <div className="h-4 bg-white/10 rounded w-3/4 mx-auto" />
                      <div className="h-3 bg-white/10 rounded w-1/2 mx-auto" />
                    </div>
                    {/* Embedded capture form */}
                    <div className="border-2 border-dashed border-white/20 rounded-xl p-1">
                      <div className="bg-gradient-to-br from-[#111111] to-[#1a1a2e] rounded-lg p-5 space-y-3 text-center">
                        <h4 className="text-white text-sm font-bold">Rejoignez le Mastermind</h4>
                        <p className="text-stone-400 text-[10px]">Réservez votre appel découverte</p>
                        <div className="space-y-2 max-w-[200px] mx-auto">
                          <div className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-[10px] text-stone-400 text-left">Prénom</div>
                          <div className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-[10px] text-stone-400 text-left">Email</div>
                          <div className="bg-white text-[#111111] rounded-lg px-3 py-2 text-[10px] font-bold">Réserver</div>
                        </div>
                      </div>
                    </div>
                    {/* More content skeleton */}
                    <div className="space-y-2 pt-2">
                      <div className="h-2.5 bg-white/10 rounded w-full" />
                      <div className="h-2.5 bg-white/10 rounded w-5/6" />
                      <div className="h-2.5 bg-white/10 rounded w-2/3" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {captureTab === 'popup' && (
              <div className="relative">
                {/* Bigger fake website */}
                <div className="bg-stone-50 rounded-2xl p-6 space-y-4 opacity-40">
                  {/* Fake nav */}
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-24 bg-stone-300 rounded" />
                    <div className="flex gap-3">
                      <div className="h-3 w-14 bg-stone-200 rounded" />
                      <div className="h-3 w-14 bg-stone-200 rounded" />
                      <div className="h-3 w-14 bg-stone-200 rounded" />
                    </div>
                  </div>
                  {/* Hero */}
                  <div className="text-center space-y-2 py-4">
                    <div className="h-5 bg-stone-300 rounded w-2/3 mx-auto" />
                    <div className="h-3 bg-stone-200 rounded w-1/2 mx-auto" />
                  </div>
                  {/* Content blocks */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="h-16 bg-stone-200 rounded-xl" />
                    <div className="h-16 bg-stone-200 rounded-xl" />
                    <div className="h-16 bg-stone-200 rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 bg-stone-200 rounded w-full" />
                    <div className="h-3 bg-stone-200 rounded w-5/6" />
                    <div className="h-3 bg-stone-200 rounded w-4/6" />
                  </div>
                  <div className="h-20 bg-stone-200 rounded-xl" />
                </div>
                {/* Popup overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px] rounded-2xl">
                  <div className="bg-white rounded-2xl shadow-2xl p-6 w-[280px] space-y-4 border border-stone-200">
                    <div className="flex justify-between items-start">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ff2f2f] to-[#8a43e1] flex items-center justify-center">
                        <Zap className="size-5 text-white" />
                      </div>
                      <div className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center">
                        <X className="size-3 text-stone-400" />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[#111111] font-bold text-base">Dernières places !</h4>
                      <p className="text-stone-400 text-xs mt-1">Inscrivez-vous avant la clôture</p>
                    </div>
                    <div className="space-y-2">
                      <div className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-xs text-stone-400">votre@email.com</div>
                      <div className="bg-[#111111] text-white rounded-lg px-3 py-2 text-xs font-bold text-center">Je m'inscris</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

const CRMKPI = ({ title, value, description, index }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.6, delay: (index || 0) * 0.1 }}
    className="flex flex-col gap-2 items-center text-center p-6 rounded-3xl bg-stone-50 border border-stone-200"
  >
    <span className="text-stone-400 text-[10px] font-bold uppercase tracking-[0.2em]">{title}</span>
    <h4 className="text-4xl font-bold text-[#111111] tracking-tight my-2">{value}</h4>
    <p className="text-stone-500 text-sm font-medium">{description}</p>
  </motion.div>
);

const LeadProfile = () => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.98 }}
    whileInView={{ opacity: 1, scale: 1 }}
    viewport={{ once: true }}
    transition={{ duration: 0.8 }}
    className="bg-white rounded-3xl overflow-hidden shadow-xl border border-stone-200 text-left"
  >
    <div className="p-6 border-b border-stone-100 bg-stone-50 flex justify-between items-center">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#ff2f2f] to-[#8a43e1] flex items-center justify-center text-white font-bold text-xl shadow-inner">JP</div>
        <div>
          <h4 className="font-bold text-xl text-[#111111] mb-1">Jean-Philippe Morel</h4>
          <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">ID: #89234 • Ajouté hier</span>
        </div>
      </div>
      <div className="hidden sm:flex gap-2">
        <span className="px-3 py-1.5 bg-amber-100 text-amber-800 rounded-lg text-[10px] font-bold uppercase tracking-wider">Chaud 🔥</span>
        <span className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-bold uppercase tracking-wider">Ready to Buy</span>
      </div>
    </div>
    <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="space-y-8">
        <div>
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3">Infos Contact</p>
          <div className="space-y-3 text-sm font-medium text-stone-700">
            <div className="flex items-center gap-3"><Mail className="size-4 text-stone-400" /> jp.morel@gmail.com</div>
            <div className="flex items-center gap-3"><Phone className="size-4 text-stone-400" /> +33 6 12 34 56 78</div>
            <div className="flex items-center gap-3"><ArrowUp className="size-4 text-stone-400" /> Source: <span className="text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded">Ads Instagram</span></div>
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3">Historique d'Interaction</p>
          <div className="space-y-4">
            <InteractionItem icon={<MessageSquare className="size-3" />} text='"Je suis intéressé par le programme Mastermind..."' subtext="WhatsApp - 10:45" color="bg-emerald-100 text-emerald-700" italic={true} />
            <InteractionItem icon={<Phone className="size-3" />} text="Discovery Call complété (12 min)" subtext="Hier - 16:30" color="bg-sky-100 text-sky-700" />
          </div>
        </div>
      </div>
      <div className="space-y-8">
        <div className="bg-stone-50 p-5 rounded-2xl border border-stone-200">
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3">Notes & Objections</p>
          <p className="text-sm text-stone-600 font-medium leading-relaxed">
            - Frein principal : Disponibilité immédiate.<br />
            - OK sur le prix (7,500€).<br />
            - Proposer l'accès direct aux modules si paiement aujourd'hui.
          </p>
        </div>
        <div className="p-5 border border-stone-200 rounded-2xl bg-white shadow-sm">
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3">Offre Présentée</p>
          <div className="flex items-center justify-between">
            <span className="font-bold text-stone-800">Accompagnement VIP</span>
            <span className="font-black text-xl text-[#111111]">7,500€</span>
          </div>
        </div>
      </div>
    </div>
  </motion.div>
);

const FAQItem = ({ question, answer }: { question: string; answer: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border border-stone-200 rounded-2xl overflow-hidden bg-white shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-6 text-left hover:bg-stone-50 transition-colors"
      >
        <span className="text-[#111111] font-bold text-lg pr-4">{question}</span>
        <span className={`text-stone-400 transition-transform duration-300 flex-shrink-0 ${isOpen ? 'rotate-45' : ''}`}>
          <Plus className="size-5" />
        </span>
      </button>
      {isOpen && (
        <div className="px-6 pb-6 text-stone-600 font-medium leading-relaxed">
          {answer}
        </div>
      )}
    </div>
  );
};

const InteractionItem = ({ icon, text, subtext, color, italic }: any) => (
  <div className="flex gap-3 items-start">
    <div className={`w-7 h-7 rounded-full ${color} flex items-center justify-center flex-shrink-0`}>{icon}</div>
    <div>
      <div className={`text-sm font-medium text-stone-800 ${italic ? 'italic' : ''}`}>{text}</div>
      <div className="font-semibold text-[10px] text-stone-400 mt-1 uppercase tracking-wider">{subtext}</div>
    </div>
  </div>
);

type RoleKey = 'owner' | 'closer' | 'setter' | 'setter-closer';

interface RoleData {
  id: RoleKey;
  label: string;
  icon: React.ReactNode;
  tagline: string;
  description: string;
  color: string;
  features: { icon: React.ReactNode; title: string; items: string[] }[];
}

const roleEase = [0.16, 1, 0.3, 1] as [number, number, number, number];

const rolesData: RoleData[] = [
  {
    id: 'owner',
    label: 'Owner / Admin',
    icon: <Crown className="size-5" />,
    tagline: 'Contrôle total',
    description: 'Pilotez l\'intégralité de votre écosystème de vente. CRM, équipes, KPIs, campagnes — tout depuis un seul tableau de bord.',
    color: 'from-amber-500 to-orange-600',
    features: [
      {
        icon: <Layers className="size-5" />,
        title: 'CRM & Pipeline Global',
        items: [
          'Vue Kanban drag-drop + Tableau de TOUS les prospects',
          'Assignation setter/closer : manuelle, tournante ou hasard',
          '8 stages avec sync HubSpot, Pipedrive, GoHighLevel, Airtable, Systeme.io, iClosed',
          'Filtres avancés : période, membre, statut, offre',
        ],
      },
      {
        icon: <Megaphone className="size-5" />,
        title: 'Campagnes de Capture',
        items: [
          '2 modes : avec RDV ou inscription seule',
          'Page de capture personnalisable + embed iframe/popup',
          'Assignation configurable + tracking UTM',
          'Analytics : vues, leads, taux de conversion, CA',
        ],
      },
      {
        icon: <Phone className="size-5" />,
        title: 'Appels & Cockpit',
        items: [
          'Cockpit plein écran : script, notes, offre, fiche prospect',
          'Enregistrement appel (écran + micro)',
          'Post-appel : toutes les issues setter ET closer',
          'Google Meet intégré',
        ],
      },
      {
        icon: <BarChart3 className="size-5" />,
        title: 'KPI & Rapports',
        items: [
          '3 onglets : Organisation, Par Offre, Par Membre',
          '8 KPI globaux sur période sélectionnable',
          'Feed d\'activité du jour + Export PDF',
          'Graphiques : stages, CA par campagne, commissions',
        ],
      },
      {
        icon: <Users className="size-5" />,
        title: 'Équipe & Organisation',
        items: [
          'Créez des équipes et groupez vos closers/setters',
          'Statut online temps réel + historique connexion 7j',
          'Disponibilités, absences, primes et commissions par membre',
          '5 rôles : Closer, Setter, Setter-Closer, Head of Sales, Admin',
          'Invitation par lien + onboarding personnalisable par rôle',
          'Objectifs individuels et collectifs avec suivi progression',
        ],
      },
      {
        icon: <Calendar className="size-5" />,
        title: 'Agenda & RDV',
        items: [
          'Booker un RDV pour n\'importe quel membre',
          'Booking links partageables + Google Meet',
          'Agenda de chaque membre ou tous combinés',
          'Sync Google Calendar bidirectionnelle',
        ],
      },
    ],
  },
  {
    id: 'closer',
    label: 'Closer',
    icon: <Target className="size-5" />,
    tagline: 'Fermer des deals',
    description: 'Votre espace optimisé pour closer. Pipeline personnel, cockpit d\'appel, KPIs de performance et gestion autonome de vos prospects.',
    color: 'from-emerald-500 to-teal-600',
    features: [
      {
        icon: <Layers className="size-5" />,
        title: 'Pipeline Personnel',
        items: [
          'Vos prospects assignés uniquement',
          '2 sections : Flux Actif + Flux Inactif',
          'Drag-drop entre colonnes',
          'Création de prospect → auto-assignation closer',
        ],
      },
      {
        icon: <Phone className="size-5" />,
        title: 'Cockpit d\'Appel',
        items: [
          'Script affiché + notes en direct + fiche prospect',
          'Post-appel : Gagné, Follow Up, Perdu, No Show',
          'Raison d\'objection si Gagné',
          'Enregistrement + Google Meet',
        ],
      },
      {
        icon: <BarChart3 className="size-5" />,
        title: 'KPI Closer',
        items: [
          '3 onglets : Personnel, Organisation, Par Offre',
          'CA, ventes, taux closing, commission, no-show',
          'Graphiques et pipeline summary',
          'Objectifs personnels configurables',
        ],
      },
      {
        icon: <FileText className="size-5" />,
        title: 'Factures',
        items: [
          'Générer une facture → envoyée à l\'Owner',
          'KPI : CA généré, commission 10%, payé, en attente',
          'Détail comptant vs échelonné',
          'Lien Stripe + téléchargement PDF',
        ],
      },
    ],
  },
  {
    id: 'setter',
    label: 'Setter',
    icon: <Phone className="size-5" />,
    tagline: 'Qualifier & Booker',
    description: 'Focalisé sur la qualification et le booking. Qualifiez vos prospects, assignez les closers et gérez votre flow de prise de RDV.',
    color: 'from-sky-500 to-blue-600',
    features: [
      {
        icon: <Layers className="size-5" />,
        title: 'CRM & Pipeline Setter',
        items: [
          'Création prospect → auto-assignation setter',
          'Pipeline personnel avec Flux Actif/Inactif',
          'Recherche, filtrage et actions rapides',
        ],
      },
      {
        icon: <Phone className="size-5" />,
        title: 'Qualification Post-Appel',
        items: [
          '4 issues : Qualifié, Book Later, Non-qualifié, Pas de réponse',
          'Qualifié → assigner un closer + sélectionner un créneau',
          'Grille 14 jours, intervalles 30min, conflits exclus',
        ],
      },
      {
        icon: <BarChart3 className="size-5" />,
        title: 'KPI Setter',
        items: [
          'Taux de réponse, taux de booking, conversion',
          'Commission, no-show, perdus',
          '3 onglets : Personnel, Organisation, Par Offre',
        ],
      },
    ],
  },
  {
    id: 'setter-closer',
    label: 'Setter-Closer',
    icon: <Zap className="size-5" />,
    tagline: 'Le combo ultime',
    description: 'Combinez les droits Setter ET Closer. Auto-assignation complète, accès aux 8 issues post-appel et aux deux pages KPI.',
    color: 'from-rose-500 to-pink-600',
    features: [
      {
        icon: <Zap className="size-5" />,
        title: 'Double Rôle',
        items: [
          'Création prospect → auto-assignation setter ET closer',
          '8 issues post-appel (4 setter + 4 closer)',
          'Scope "self" : auto-assignation closer systématique',
          'Scope "all" : peut set pour d\'autres closers',
        ],
      },
      {
        icon: <BarChart3 className="size-5" />,
        title: 'Double KPI',
        items: [
          'Accès KPI Setter ET KPI Closer',
          'Graphiques et pipeline summary des deux côtés',
          'Objectifs personnels configurables',
        ],
      },
    ],
  },
];

const FeaturesByRole = () => {
  const [activeRole, setActiveRole] = useState<RoleKey>('owner');
  const currentRole = rolesData.find(r => r.id === activeRole)!;
  const tabContainerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<RoleKey, HTMLButtonElement>>(new Map());
  const [bubbleStyle, setBubbleStyle] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const btn = tabRefs.current.get(activeRole);
    const container = tabContainerRef.current;
    if (btn && container) {
      const containerRect = container.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();
      setBubbleStyle({
        left: btnRect.left - containerRect.left,
        width: btnRect.width,
      });
    }
  }, [activeRole]);

  return (
    <section id="roles" className="px-6 md:px-20 py-24 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 16, filter: 'blur(4px)' }}
        whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6, ease: roleEase }}
        className="text-center mb-16 space-y-4"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-stone-200 shadow-sm mb-4">
          <span className="text-sm font-semibold text-stone-800">Fonctionnalités par Rôle</span>
        </div>
        <h2 className="text-4xl md:text-5xl font-bold text-[#111111] tracking-tight text-balance">
          Chaque rôle a ses outils. Chaque outil a sa place.
        </h2>
        <p className="text-stone-500 text-lg max-w-2xl mx-auto text-pretty">
          Owner, Closer, Setter ou Setter-Closer — chacun accède exactement à ce dont il a besoin, rien de plus.
        </p>
      </motion.div>

      {/* Role Tabs — Liquid Glass */}
      <div className="flex justify-center mb-12">
        <div
          ref={tabContainerRef}
          className="relative inline-flex rounded-2xl border border-stone-200/50 bg-stone-100/80 backdrop-blur-sm shadow-[0_0_9px_rgba(0,0,0,0.06),0_3px_12px_rgba(0,0,0,0.08)] p-1.5"
        >
          {rolesData.map((role) => (
            <button
              key={role.id}
              ref={(el) => { if (el) tabRefs.current.set(role.id, el); }}
              onClick={() => setActiveRole(role.id)}
              className="relative z-10 flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-bold transition-colors duration-300 cursor-pointer select-none"
              style={{ color: activeRole === role.id ? '#111111' : '#78716c' }}
            >
              {role.icon}
              {role.label}
            </button>
          ))}

          {/* Sliding liquid-glass bubble */}
          <motion.div
            className="absolute z-0 top-1.5 bottom-1.5 rounded-xl bg-white/70 backdrop-blur-lg shadow-[inset_0_1px_0px_rgba(255,255,255,0.75),0_0_9px_rgba(0,0,0,0.08),0_3px_8px_rgba(0,0,0,0.1)] border border-white/60"
            animate={{
              left: bubbleStyle.left,
              width: bubbleStyle.width,
            }}
            transition={{
              type: 'spring',
              stiffness: 400,
              damping: 32,
              mass: 0.8,
            }}
          >
            {/* Glass gradient overlays */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/60 via-transparent to-transparent opacity-70 pointer-events-none" />
            <div className="absolute inset-0 rounded-xl bg-gradient-to-tl from-white/30 via-transparent to-transparent opacity-50 pointer-events-none" />
          </motion.div>
        </div>
      </div>

      {/* Role Content */}
      <motion.div
        key={activeRole}
        initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.5, ease: roleEase }}
      >
        {/* Role Header */}
        <div className="bg-[#111111] text-white rounded-3xl p-8 md:p-12 mb-6 relative overflow-hidden">
          <div className={`absolute top-0 right-0 w-96 h-96 bg-gradient-to-br ${currentRole.color} rounded-full blur-[120px] opacity-30 -translate-y-1/2 translate-x-1/3 pointer-events-none`} />
          <div className="relative z-10 max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                {currentRole.icon}
              </div>
              <span className="text-sm font-bold uppercase tracking-[0.15em] opacity-70">{currentRole.tagline}</span>
            </div>
            <h3 className="text-3xl md:text-4xl font-bold tracking-tight mb-4" style={{ lineHeight: '1.1' }}>
              {currentRole.label}
            </h3>
            <p className="text-lg opacity-80 font-medium leading-relaxed max-w-xl">
              {currentRole.description}
            </p>
          </div>
        </div>

        {/* Feature Cards */}
        <div className={`grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3`}>
          {currentRole.features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 16, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: roleEase }}
              className="bg-white rounded-2xl p-7 border border-stone-200 shadow-sm hover:shadow-md transition-shadow duration-300"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center text-[#111111] flex-shrink-0">
                  {feature.icon}
                </div>
                <h4 className="font-bold text-[#111111] text-base">{feature.title}</h4>
              </div>
              <ul className="space-y-3">
                {feature.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-2.5 text-sm text-stone-500 font-medium leading-relaxed">
                    <ArrowRight className="size-3.5 text-stone-300 mt-1 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Shared features note for non-owner roles */}
        {activeRole !== 'owner' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="mt-6 bg-stone-100 rounded-2xl p-6 border border-stone-200"
          >
            <p className="text-sm text-stone-500 font-medium text-center">
              <span className="font-bold text-[#111111]">+ Accès partagé :</span>{' '}
              {activeRole === 'setter-closer'
                ? 'Pipeline personnel, RDV, Agenda, Rappels, Objectifs (les deux KPI), Formules (lecture), Factures, Disponibilités, Organisation, Équipe, Dashboard.'
                : 'Pipeline personnel, RDV, Agenda, Rappels, Objectifs, Formules (lecture), Factures, Disponibilités, Organisation (lecture), Équipe, Dashboard.'}
            </p>
          </motion.div>
        )}

        {/* Head of Sales note */}
        {activeRole === 'owner' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div className="bg-stone-100 rounded-2xl p-6 border border-stone-200">
              <div className="flex items-center gap-2.5 mb-2">
                <Shield className="size-4 text-[#111111]" />
                <span className="font-bold text-[#111111] text-sm">Admin</span>
              </div>
              <p className="text-sm text-stone-500 font-medium">
                Exactement les mêmes droits que l'Owner. Accès complet à tout.
              </p>
            </div>
            <div className="bg-stone-100 rounded-2xl p-6 border border-stone-200">
              <div className="flex items-center gap-2.5 mb-2">
                <ClipboardList className="size-4 text-[#111111]" />
                <span className="font-bold text-[#111111] text-sm">Head of Sales</span>
              </div>
              <p className="text-sm text-stone-500 font-medium">
                Mêmes droits que l'Owner sauf : Campagnes (si autorisé) et pas d'accès aux Paramètres.
              </p>
            </div>
          </motion.div>
        )}
      </motion.div>
    </section>
  );
};

const WaitingListModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMessage('');

    try {
      const { error } = await supabase
        .from('EmailBuis')
        .insert([{ email }]);

      if (error) {
        if (error.code === '23505') {
          setErrorMessage("Vous êtes déjà inscrit avec ce mail");
          setStatus('error');
          return;
        }
        throw error;
      }

      // Trigger welcome email via Brevo API
      try {
        await fetch('/api/business-welcome-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
      } catch (emailErr) {
        console.error('Error triggering welcome email:', emailErr);
      }

      setStatus('success');
      setEmail('');
    } catch (err: any) {
      console.error('Error joining waiting list:', err);
      setStatus('error');
      setErrorMessage(err.message || "Une erreur est survenue. Veuillez rééssayer.");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#111111]/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-stone-100 transition-colors text-stone-500"
        >
          <X className="size-5" />
        </button>

        <div className="p-8 pt-12 text-center">
          <div className="bg-stone-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Mail className="size-8 text-stone-800" />
          </div>

          {status === 'success' ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-[#111111] text-3xl font-bold tracking-tight">C'est noté ! 🚀</h3>
                <p className="text-stone-500 font-medium text-center">
                  Merci de votre intérêt. Regardez cette vidéo en attendant l'ouverture !
                </p>
              </div>

              <div className="relative pt-[56.25%] w-full rounded-2xl overflow-hidden shadow-md border border-stone-200 bg-black">
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src="https://www.youtube.com/embed/DP1me04gNbk?autoplay=1"
                  title="CloseOS Business Introduction"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                ></iframe>
              </div>

              <div className="pt-4 flex flex-col gap-3">
                <a
                  href="https://whatsapp.com/channel/0029Vb7P4lqDDmFLVtD7Jn0s"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-[#25D366] text-white py-3.5 rounded-xl font-bold hover:opacity-90 transition-all shadow-sm"
                >
                  Canal WhatsApp
                  <ExternalLink className="size-4" />
                </a>
                <a
                  href="https://docs.google.com/forms/d/e/1FAIpQLSfG_km1jRFBreeHvhksMAvAxwokZEOdahTicsKikNwk71IUwg/viewform"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-[#111111] text-white py-3.5 rounded-xl font-bold hover:opacity-90 transition-all shadow-sm"
                >
                  Vos besoins (Google Form)
                  <ExternalLink className="size-4" />
                </a>
                <a
                  href="https://www.linkedin.com/in/thomas-shamoev/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-[#0A66C2] text-white py-3.5 rounded-xl font-bold hover:opacity-90 transition-all shadow-sm"
                >
                  Suivre sur LinkedIn
                  <ExternalLink className="size-4" />
                </a>
              </div>
            </div>
          ) : (
            <>
              <h3 className="text-[#111111] text-3xl font-bold mb-3 tracking-tight">Rejoindre la liste d'attente</h3>
              <p className="text-stone-500 mb-8 font-medium">
                Inscrivez-vous et recevez le <strong className="text-[#111111]">4 avril</strong> un tarif early adopter concurrentiel et imbattable, réservé uniquement aux inscrits — <strong className="text-[#111111]">verrouillé à vie</strong>.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative text-left">
                  <label htmlFor="email" className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1 mb-1 block">
                    Votre Email Professionnel
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    placeholder="votre@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-4 focus:ring-2 focus:ring-[#111111] focus:border-transparent outline-none transition-all text-stone-800 font-semibold placeholder:font-medium"
                  />
                </div>

                {status === 'error' && (
                  <p className="text-rose-500 text-xs font-bold text-left ml-1 italic">{errorMessage}</p>
                )}

                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="w-full bg-[#111111] text-white rounded-xl py-4 font-bold text-lg shadow-md hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {status === 'loading' ? (
                    <>
                      <Loader2 className="size-5 animate-spin" />
                      Inscription...
                    </>
                  ) : (
                    "M'inscrire maintenant"
                  )}
                </button>

                <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest text-center mt-4">
                  Accès prioritaire • Sans engagement
                </p>
              </form>
            </>
          )}
        </div>
      </motion.div>
      <div className="fixed inset-0 -z-10" onClick={onClose}></div>
    </div>
  );
};
