import { Link, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { motion } from 'motion/react'

import { PricingComparisonTable } from '../components/PricingComparisonTable';
import {
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  Zap,
  BarChart3,
  ChevronRight,
  XCircle,
  MessageSquare,
  FileText,
  Smartphone,
  BrainCircuit,
  CalendarCheck,
  LayoutDashboard,
  Phone,
  Star,
  ShieldCheck,
  Database,
  Users,
  Building2,
  PlusCircle,
  Sheet,
  Clock,
  X,
  Menu,
  ChevronDown,
} from 'lucide-react'

const INTEGRATIONS = [
  { label: 'GoHighLevel', color: '#E4573D' },
  { label: 'Airtable', color: '#FFBF00' },
  { label: 'Systeme.io', color: '#00B4D8' },
  { label: 'iClosed', color: '#ffffff' },
  { label: 'Hubspot', color: '#FF7A59' },
  { label: 'Pipedrive', color: '#00AB44' },
  { label: 'Google Calendar', color: '#4285F4', renderLabel: () => <><span className="text-[#4285F4]">Google</span>{' '}Calendar</> },
  { label: 'Twilio', color: '#F22F46' },
  { label: 'Cal.com', color: '#ffffff' },
  { label: 'Stripe', color: '#635BFF' },
  { label: 'Zapier', color: '#FF4A00' },
];

function IntegrationsBanner() {
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isAnimating, setIsAnimating] = useState(false);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const total = INTEGRATIONS.length;

  useEffect(() => {
    if (isHovering) return;
    const interval = setInterval(() => {
      setIsAnimating(true);
      let step = 0;
      const cascade = setInterval(() => {
        const idx = total - 1 - step;
        setActiveIndex(idx);
        step++;
        if (step >= total) {
          clearInterval(cascade);
          setTimeout(() => {
            setActiveIndex(-1);
            setIsAnimating(false);
          }, 400);
        }
      }, 120);
    }, 3000);
    return () => clearInterval(interval);
  }, [total, isHovering]);

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseEnterContainer = () => {
    setIsHovering(true);
    setIsAnimating(false);
    setActiveIndex(-1);
  };

  const handleMouseLeaveContainer = () => {
    setMousePos(null);
    setIsHovering(false);
  };

  const getProximity = (index: number): number => {
    if (!mousePos || !itemRefs.current[index]) return 0;
    const rect = itemRefs.current[index]!.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dist = Math.sqrt((mousePos.x - centerX) ** 2 + (mousePos.y - centerY) ** 2);
    const radius = 200;
    return Math.max(0, 1 - dist / radius);
  };

  return (
    <div
      ref={containerRef}
      className="flex flex-wrap justify-center items-center gap-x-12 gap-y-8"
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnterContainer}
      onMouseLeave={handleMouseLeaveContainer}
    >
      {INTEGRATIONS.map((item, i) => {
        const isActive = isAnimating && i >= activeIndex && activeIndex !== -1;
        const proximity = getProximity(i);
        const isLit = isActive || proximity > 0;
        const intensity = isActive ? 1 : proximity;
        return (
          <div
            key={item.label}
            ref={(el) => { itemRefs.current[i] = el; }}
            className="flex items-center gap-2 font-bold text-xl sm:text-2xl transition-colors duration-200 cursor-default"
            style={{
              color: isLit
                ? `color-mix(in srgb, ${item.color} ${Math.round(intensity * 100)}%, rgba(255,255,255,0.4))`
                : 'rgba(255,255,255,0.4)',
              filter: isLit ? `grayscale(${Math.round((1 - intensity) * 100)}%)` : 'grayscale(100%)',
              opacity: isLit ? 0.6 + intensity * 0.4 : 0.6,
              textShadow: intensity > 0.3 ? `0 0 ${Math.round(intensity * 20)}px ${item.color}40` : 'none',
            }}
          >
            {item.renderLabel ? item.renderLabel() : item.label}
          </div>
        );
      })}
    </div>
  );
}

function FAQItem({ question, children }: { question: string, children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-white/5 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-4 py-4 text-left hover:text-white transition-colors group"
      >
        <span className="font-bold text-lg text-slate-200 group-hover:text-white transition-colors">
          {question}
        </span>
        <div className={`p-2 rounded-full border border-white/10 bg-white/5 transition-all duration-300 ${isOpen ? 'rotate-180 bg-blue-600 border-blue-500' : 'group-hover:bg-white/10'}`}>
          <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-white transition-colors" />
        </div>
      </button>
      <div
        className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100 pb-6' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="overflow-hidden">
          <div className="text-slate-400 leading-relaxed text-sm pr-12">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

const containerVariants: any = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants: any = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.1, 0.25, 1]
    }
  }
};

export function LandingPage() {
  const navigate = useNavigate();
  const pageRef = useRef<HTMLDivElement>(null);
  const [isExiting, setIsExiting] = useState(false);

  // État pour le cycle de facturation
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavigateToBusiness = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsExiting(true);
    setTimeout(() => navigate('/business'), 500);
  };

  // Fonction pour calculer le prix avec -25% si annuel
  const calculatePrice = (price: number) => {
    if (billingCycle === 'yearly') {
      return +(price * 0.75).toFixed(2);
    }
    return price;
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref') || params.get('via');
    if (ref) {
      localStorage.setItem('referral_code', ref);
      localStorage.setItem('closeos_ref', ref);
      // Cookie 30 jours pour le tracking parrainage
      document.cookie = `closeos_ref=${encodeURIComponent(ref)};max-age=${30 * 24 * 60 * 60};path=/;SameSite=Lax`;
    }
  }, []);

  // SEO meta tags for Sales landing
  useEffect(() => {
    document.title = "CloseOS Sales — CRM pour Closer | Pipeline, VoIP, KPIs & Facturation Automatique";
    document.querySelector('meta[name="description"]')?.setAttribute('content',
      "CloseOS Sales est le logiciel tout-en-un pour closers high ticket : CRM closer, pipeline de vente visuel, VoIP intégré, suivi calls closing, agenda & booking, facturation automatique, KPIs de closing. Application closer freelance. Essai gratuit 10 jours, sans carte bancaire."
    );

    const existingLd = document.querySelector('script[data-closeos-sales-ld]');
    if (!existingLd) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-closeos-sales-ld', 'true');
      script.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'CloseOS Sales',
        url: 'https://www.closeos.fr',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        description: "Le CRM pour closer en France. Pipeline de vente, VoIP intégré, suivi calls closing, agenda, facturation automatique et KPIs de closing. Logiciel closer high ticket tout-en-un.",
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'EUR',
          description: 'Essai gratuit 10 jours sans carte bancaire',
        },
        featureList: 'CRM closer, Pipeline closer, VoIP intégré, Suivi calls closing, Agenda & booking, Facturation automatique closer, KPI closing, Gestion prospects closing, Visioconférence',
        inLanguage: 'fr',
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: '4.8',
          ratingCount: '150',
          bestRating: '5',
        },
      });
      document.head.appendChild(script);
    }

    // FAQ structured data for GEO
    const existingFaqLd = document.querySelector('script[data-closeos-sales-faq-ld]');
    if (!existingFaqLd) {
      const faqScript = document.createElement('script');
      faqScript.type = 'application/ld+json';
      faqScript.setAttribute('data-closeos-sales-faq-ld', 'true');
      faqScript.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Est-ce que je peux connecter Calendly à CloseOS ?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: "Non, et c'est un choix assumé. Calendly impose un abonnement payant pour les intégrations. CloseOS intègre Cal.com (référence Open Source) : un système de booking ultra-performant, synchronisé à votre agenda, sans surcoût.",
            },
          },
          {
            '@type': 'Question',
            name: 'Comment CloseOS s\'engage pour l\'environnement ?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: "CloseOS prône la Performance Responsable. Sobriété numérique : en remplaçant 10 outils par 1 seul, nous réduisons la consommation d'énergie serveur. Action financière : 1,5% de chaque abonnement est reversé via Stripe Climate pour financer l'élimination du CO2.",
            },
          },
          {
            '@type': 'Question',
            name: 'Pourquoi payer CloseOS plutôt qu\'utiliser Excel ou Notion ?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: "Parce que le bricolage coûte des ventes. Excel n'envoie pas de rappels automatiques, Notion ne génère pas vos liens de visio ni ne synchronise vos appels. CloseOS est un système actif qui élimine 80% de l'administratif. Le temps gagné est réinvesti pour signer des contrats.",
            },
          },
          {
            '@type': 'Question',
            name: 'Est-ce que iClosed est intégré à CloseOS ?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: "Partiellement. Contrairement à HubSpot ou Pipedrive, iClosed ne dispose pas d'une API publique ouverte. CloseOS reçoit vos nouveaux leads et ventes venant d'iClosed via Webhook, mais la synchronisation est à sens unique (iClosed vers CloseOS). L'API complète arrivera prochainement.",
            },
          },
          {
            '@type': 'Question',
            name: 'C\'est quoi CloseOS Sales ?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: "CloseOS Sales est le logiciel tout-en-un pour closers high ticket et freelance en France. Il regroupe CRM closer, pipeline de vente visuel, VoIP intégré, suivi calls closing, agenda & booking, facturation automatique et KPIs de closing. C'est l'outil qui remplace 10 logiciels différents pour les closers indépendants.",
            },
          },
        ],
      });
      document.head.appendChild(faqScript);
    }

    return () => {
      document.querySelector('script[data-closeos-sales-ld]')?.remove();
      document.querySelector('script[data-closeos-sales-faq-ld]')?.remove();
    };
  }, []);

  useEffect(() => {
    const s = document.createElement('script');
    s.src = '/chatbot-widget.js';
    s.setAttribute('data-chatbot-id', 'acb35233-a6de-4738-9ba0-7e25c82c2a61');
    s.setAttribute('data-supabase-url', 'https://mkxcircbzcsjamslijde.supabase.co');
    s.setAttribute('data-supabase-key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1reGNpcmNiemNzamFtc2xpamRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MjM0MDAsImV4cCI6MjA4NzQ5OTQwMH0.9-abq1tEFsmjfRkLJjrkXlG3z-9o2HKYjyp5eBIl178');
    document.body.appendChild(s);

    return () => {
      if (document.body.contains(s)) {
        document.body.removeChild(s);
      }
      // Also remove the DOM elements injected by the chatbot script
      const chatbotContainer = document.getElementById('chatbot-widget-container');
      if (chatbotContainer) {
        chatbotContainer.remove();
      }
    };
  }, []);

  return (
    <div ref={pageRef} className={`min-h-screen bg-[#020617] text-slate-100 font-sans selection:bg-blue-500/30 overflow-x-hidden transition-all duration-500 ${isExiting ? 'translate-y-full opacity-0' : 'animate-[pageEnterFromTop_0.5s_ease-out]'}`}>

      {/* BANDEAU OFFRE */}
      <div className="fixed top-0 z-[60] w-full bg-blue-600 py-2.5 text-center text-xs sm:text-sm font-bold text-white shadow-lg animate-in slide-in-from-top duration-500">
        🚀 La V1 de CloseOS est officiellement lancée ! Testez gratuitement pendant 10 jours.
      </div>

      {/* NAVBAR */}
      <nav className="fixed top-[40px] z-50 w-full border-b border-white/5 bg-[#020617]/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="relative group flex items-center gap-1 cursor-pointer">
            <img src="/logo Sales.png" alt="CloseOS Logo" className="h-12 w-auto" />
            <ChevronDown className="h-4 w-4 text-slate-500 group-hover:text-slate-300 transition-transform duration-300 group-hover:rotate-180" />
            <div className="absolute top-full left-0 right-0 mt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 translate-y-2 group-hover:translate-y-0">
              <a onClick={handleNavigateToBusiness} className="block rounded-xl border border-business-primary/10 bg-[#F5F0EB] p-3 shadow-xl hover:bg-[#EDE7E0] transition-colors cursor-pointer">
                <img src="/CloseOS Buisness.png" alt="CloseOS Business" className="w-full h-auto" />
              </a>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">Fonctionnalités</a>
            <a href="#integrations" className="hover:text-white transition-colors">Intégrations</a>
            <a href="#comparison" className="hover:text-white transition-colors">Comparatif</a>
            <a href="#pricing" className="text-white font-semibold transition-colors">Tarifs</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="hidden sm:flex items-center rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-white/10 hover:border-white/40"
            >
              Se connecter
            </Link>
            <Link
              to="/register"
              className="hidden sm:flex group items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-bold text-slate-950 transition-all hover:bg-blue-50 hover:scale-105 active:scale-95"
            >
              Commencer gratuitement
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            {/* Hamburger mobile */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5 text-white" /> : <Menu className="h-5 w-5 text-white" />}
            </button>
          </div>
        </div>

        {/* Menu mobile déroulant */}
        <div
          className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${mobileMenuOpen ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'
            }`}
        >
          <div className="border-t border-white/5 bg-[#020617]/95 backdrop-blur-xl px-6 py-4 flex flex-col gap-1">
            {[
              { href: '#features', label: 'Fonctionnalités' },
              { href: '#integrations', label: 'Intégrations' },
              { href: '#comparison', label: 'Comparatif' },
              { href: '#pricing', label: 'Tarifs' },
              { href: '#faq', label: 'FAQ' },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="py-3 px-4 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                {item.label}
              </a>
            ))}
            <div className="mt-2 pt-3 border-t border-white/5 space-y-2">
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center w-full py-3 rounded-xl border border-white/20 text-white font-bold text-sm hover:bg-white/10 transition-colors"
              >
                Se connecter
              </Link>
              <Link
                to="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-white text-slate-950 font-bold text-sm hover:bg-blue-50 transition-colors"
              >
                Commencer gratuitement
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative pt-40 pb-20 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-blue-600/20 opacity-30 blur-[120px] rounded-full pointer-events-none mix-blend-screen" />
        <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-purple-600/10 opacity-20 blur-[100px] rounded-full pointer-events-none mix-blend-screen" />

        <div className="relative mx-auto max-w-7xl px-6 text-center z-10">

          {/* 👇 AJOUT : BADGE ENVIRONNEMENT */}
          <div className="flex justify-center mb-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 transition-colors cursor-default">
              🌱 Engagé pour l'environnement
            </div>
          </div>

          {/* 👇 MODIFICATION : DOUBLE BULLE AVEC RGPD */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300 hover:bg-blue-500/20 transition-colors cursor-default">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              Le Système d'Exploitation des Closers
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 transition-colors cursor-default">
              <ShieldCheck className="h-3.5 w-3.5" />
              100% RGPD & Sécurisé
            </div>
          </div>



          <h1 className="mx-auto max-w-5xl text-5xl font-extrabold tracking-tight text-white sm:text-7xl mb-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
            Le CRM pour closer<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 animate-gradient-x">
              tout-en-un.
            </span>
            <br />
            Récupérez 10h par semaine.
          </h1>

          <p className="mx-auto max-w-2xl text-lg text-slate-400 mb-10 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200 leading-relaxed">
            Pipeline closer, VoIP intégré, agenda & booking, facturation automatique, KPIs de closing — le logiciel closer high ticket conçu pour les closers freelance en France. Gérez vos prospects closing, suivez vos calls et concentrez-vous sur ce qui rapporte.
          </p>

          <div className="flex items-center justify-center gap-2 mb-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-250">
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-sm font-medium text-violet-300">
              🔗 Un seul outil. Zéro saisie manuelle. 100% dédié au closing.
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
            <Link
              to="/register"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-blue-600 text-white font-bold text-lg hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-1 flex items-center justify-center gap-2"
            >
              <Zap className="h-5 w-5 fill-current" />
              Commencer gratuitement
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto px-8 py-4 rounded-xl border border-white/20 text-white font-bold text-lg hover:bg-white/10 hover:border-white/40 transition-all flex items-center justify-center gap-2"
            >
              Se connecter
            </Link>
          </div>

          <div className="mt-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
            <a
              href="https://www.whatsapp.com/channel/0029Vb7P4lqDDmFLVtD7Jn0s"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors group"
            >
              <span className="text-green-400">📲</span>
              <span className="underline underline-offset-2 group-hover:text-green-400 transition-colors">
                Rejoindre la communauté WhatsApp
              </span>
            </a>
          </div>

          <p className="text-xs text-slate-500 mt-3">
            🔒 Aucune carte bancaire requise. 10 jours pour tester sans engagement.
          </p>

          {/* 👇 AJOUT : SOCIAL PROOF AVEC VRAIES PHOTOS */}
          <div className="mt-8 flex items-center justify-center gap-3 text-sm font-medium text-slate-400 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-500">
            <div className="flex -space-x-3">
              {[
                "/U1.jpg",
                "/U2.jpg",
                "/U3.jpg",
                "/U1.png"
              ].map((src, i) => (
                <div key={i} className="h-8 w-8 rounded-full border-2 border-[#020617] relative z-0 hover:z-10 transition-all hover:scale-110">
                  <img src={src} alt="Closer" className="h-full w-full rounded-full object-cover" />
                </div>
              ))}
            </div>
            <div className="flex flex-col text-left">
              <div className="flex text-amber-400 gap-0.5">
                {[...Array(5)].map((_, i) => <Star key={i} className="h-3 w-3 fill-current" />)}
              </div>
              <span>Produit validé par <strong className="text-white">+150 closers</strong></span>
            </div>
          </div >

        </div >
      </section>

      {/* INTEGRATIONS BANNER */}
      <motion.section
        id="integrations"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8 }}
        className="py-12 border-y border-white/5 bg-slate-950/50"
      >
        <div className="mx-auto max-w-7xl px-6 text-center">
          <p className="text-xs font-bold text-slate-500 mb-8 uppercase tracking-widest">
            Synchronisation native avec vos outils préférés
          </p>
          <IntegrationsBanner />
        </div>
      </motion.section >

      {/* FEATURES GRID */}
      <motion.section
        id="features"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8 }}
        className="py-32 relative"
      >
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-20 text-center max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-white sm:text-5xl mb-6">Toutes vos fonctionnalités de closing.<br />Un seul outil.</h2>
            <p className="text-lg text-slate-400">
              CRM, pipeline, VoIP, agenda, facturation, KPIs — arrêtez de jongler entre les onglets. CloseOS centralise tout votre flux de travail pour que vous puissiez vous concentrer sur l'essentiel : <span className="text-emerald-400 font-semibold">vendre et closer.</span>
            </p>
          </div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {/* CARD 1 - COCKPIT (Large) */}
            <motion.div variants={itemVariants} className="md:col-span-2 rounded-3xl border border-slate-800 bg-slate-900/50 p-8 hover:border-blue-500/30 transition-all duration-500 group overflow-hidden relative hover:bg-slate-900/80">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-20 transition-opacity duration-500 transform group-hover:scale-110">
                <LayoutDashboard className="w-64 h-64 text-blue-500" />
              </div>
              <div className="relative z-10">
                <div className="h-12 w-12 rounded-lg bg-blue-500/20 flex items-center justify-center mb-6 ring-1 ring-blue-500/30">
                  <BarChart3 className="h-6 w-6 text-blue-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Cockpit & KPIs en Temps Réel</h3>
                <p className="text-slate-400 mb-6 max-w-md leading-relaxed">
                  Votre centre de commandement. Visualisez instantanément vos commissions, votre taux de conversion, et votre pipeline. Si votre performance baisse, vous le voyez tout de suite.
                </p>
                <ul className="grid grid-cols-2 gap-2">
                  <li className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Cash encaissé</li>
                  <li className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Taux de closing</li>
                  <li className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Commissions prévisionnelles</li>
                  <li className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Deals en cours</li>
                </ul>
              </div>
            </motion.div>

            {/* CARD 2 - VOIP (Small) */}
            <motion.div variants={itemVariants} className="rounded-3xl border border-slate-800 bg-slate-900/50 p-8 hover:border-[#25D366]/30 transition-all duration-500 group hover:bg-slate-900/80 relative overflow-hidden">
              <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <MessageSquare className="w-32 h-32 text-[#25D366]" />
              </div>
              <div className="h-12 w-12 rounded-lg bg-[#25D366]/20 flex items-center justify-center mb-6 ring-1 ring-[#25D366]/30">
                <Phone className="h-6 w-6 text-[#25D366]" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Téléphonie VoIP & Click-to-WhatsApp</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">
                Appelez vos prospects en un clic via Twilio (appels enregistrés).
                Lancez vos conversations WhatsApp instantanément sans enregistrer le numéro.
                <span className="block mt-2 text-[#25D366] text-xs font-bold uppercase tracking-wide">
                  🚀 Zéro friction au quotidien
                </span>
              </p>
            </motion.div>

            {/* CARD 3 - PIPELINE (Small) */}
            <motion.div variants={itemVariants} className="rounded-3xl border border-slate-800 bg-slate-900/50 p-8 hover:border-orange-500/30 transition-all duration-500 group hover:bg-slate-900/80">
              <div className="h-12 w-12 rounded-lg bg-orange-500/20 flex items-center justify-center mb-6 ring-1 ring-orange-500/30">
                <TrendingUp className="h-6 w-6 text-orange-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Pipeline & Offres</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">
                Vue Kanban fluide. Configurez vos offres (prix, commissions, formules) et laissez l'outil calculer vos gains à chaque deal déplacé.
              </p>
            </motion.div>

            {/* CARD 4 - PROFIL CLOSER (Large) */}
            <motion.div variants={itemVariants} className="md:col-span-2 rounded-3xl border border-slate-800 bg-slate-900/50 p-8 hover:border-violet-500/30 transition-all duration-500 group overflow-hidden relative hover:bg-slate-900/80">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-20 transition-opacity duration-500 transform group-hover:scale-110">
                <Users className="w-64 h-64 text-violet-500" />
              </div>
              <div className="relative z-10">
                <div className="h-12 w-12 rounded-lg bg-violet-500/20 flex items-center justify-center mb-6 ring-1 ring-violet-500/30">
                  <ArrowRight className="h-6 w-6 text-violet-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Votre Profil de Closer en Temps Réel</h3>
                <p className="text-slate-400 mb-6 max-w-lg leading-relaxed">
                  Générez un lien de partage unique en un clic. Configurez exactement ce que vous voulez exposer : KPIs seuls, Pipeline complet, ou les deux. Protégez-le par mot de passe si besoin.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                  <div className="rounded-xl bg-violet-500/5 border border-violet-500/20 p-4">
                    <p className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-2">🔗 Lien Bio</p>
                    <p className="text-sm text-slate-400 leading-relaxed">Mettez le lien dans votre bio LinkedIn ou Instagram. Les infopreneurs tombent dessus, voient vos stats, vous contactent.</p>
                  </div>
                  <div className="rounded-xl bg-violet-500/5 border border-violet-500/20 p-4">
                    <p className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-2">⚡ Réponse Instantanée</p>
                    <p className="text-sm text-slate-400 leading-relaxed">"Montre-moi tes performances." Vous envoyez le lien. Fini les captures d'écran, les tableaux Excel et les pavés WhatsApp.</p>
                  </div>
                  <div className="rounded-xl bg-violet-500/5 border border-violet-500/20 p-4">
                    <p className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-2">👁️ Suivi Infopreneur</p>
                    <p className="text-sm text-slate-400 leading-relaxed">Votre infopreneur suit votre pipeline et vos KPIs sans avoir besoin d'un compte. Transparence totale, confiance maximale.</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* CARD 5 - AGENDA (Small) */}
            <motion.div variants={itemVariants} className="rounded-3xl border border-slate-800 bg-slate-900/50 p-8 hover:border-purple-500/30 transition-all duration-500 group overflow-hidden relative hover:bg-slate-900/80">
              <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <CalendarCheck className="w-32 h-32 text-purple-500" />
              </div>
              <div className="relative z-10">
                <div className="h-12 w-12 rounded-lg bg-purple-500/20 flex items-center justify-center mb-6 ring-1 ring-purple-500/30">
                  <CalendarCheck className="h-6 w-6 text-purple-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Agenda & Booking & Rappel</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-4">
                  Connectez votre Google Calendar. Vos rendez-vous et créneaux de booking remontent automatiquement dans votre Pipeline. Programmez des rappels sur vos appels directement depuis votre pipeline.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-[10px] text-purple-300">Sync Bi-directionnelle</span>
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-[10px] text-purple-300">Intégration native</span>
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-[10px] text-purple-300">Rappels intégrés</span>
                </div>
              </div>
            </motion.div>

            {/* CARD 6 - FACTURATION (Small) */}
            <motion.div variants={itemVariants} className="rounded-3xl border border-slate-800 bg-slate-900/50 p-8 hover:border-emerald-500/30 transition-all duration-500 group hover:bg-slate-900/80">
              <div className="h-12 w-12 rounded-lg bg-emerald-500/20 flex items-center justify-center mb-6 ring-1 ring-emerald-500/30">
                <FileText className="h-6 w-6 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Facturation Auto & Paiement CB</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Générez vos factures de commissions en un clic. Créez des liens de paiement CB sécurisés et envoyez automatiquement la facture à votre infopreneur.
              </p>
            </motion.div>

            {/* CARD 7 - SYNC CRM (Small) */}
            <motion.div variants={itemVariants} className="rounded-3xl border border-slate-800 bg-slate-900/50 p-8 hover:border-[#E11D48]/30 transition-all duration-500 group overflow-hidden relative hover:bg-slate-900/80">
              <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Zap className="w-32 h-32 text-[#E11D48]" />
              </div>
              <div className="relative z-10">
                <div className="h-12 w-12 rounded-lg bg-[#E11D48]/20 flex items-center justify-center mb-6 ring-1 ring-[#E11D48]/30">
                  <Zap className="h-6 w-6 text-[#E11D48]" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Sync CRM</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Synchronisation native avec iClosed, HubSpot et Pipedrive. Oubliez la double saisie manuelle et automatisez 100% de votre suivi.
                </p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </motion.section >

      {/* ROADMAP TIMELINE — HORIZONTAL */}
      <motion.section
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8 }}
        className="py-20 bg-[#0B1121] border-t border-white/5 relative overflow-hidden"
      >
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-indigo-600/8 blur-[150px] rounded-full pointer-events-none" />
        <div className="mx-auto max-w-7xl px-6 relative z-10">
          <div className="text-center mb-12">
            <span className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-bold text-indigo-400 uppercase tracking-widest">
              Roadmap 2026
            </span>
            <h2 className="text-3xl sm:text-5xl font-bold text-white mt-6">L'Évolution du Closing</h2>
            <p className="text-slate-400 mt-4 max-w-2xl mx-auto text-sm">Notre vision pour faire de CloseOS le système d'exploitation incontournable des closers, agences et infopreneurs.</p>
          </div>

          {/* Horizontal scrollable timeline — alternating top/bottom */}
          <div className="overflow-x-auto pb-4 -mx-6 px-6 scrollbar-hide">
            <div className="relative min-w-[900px]" style={{ height: '340px' }}>
              {/* Horizontal line — centered vertically */}
              <div className="absolute left-0 right-0 h-px bg-gradient-to-r from-blue-500/60 via-purple-500/60 via-amber-500/60 to-emerald-500/60" style={{ top: '50%' }} />

              <div className="flex justify-between items-stretch h-full">

                {/* Q1 — BELOW */}
                <div className="relative flex flex-col items-center" style={{ width: '20%' }}>
                  <div className="absolute left-1/2 -translate-x-1/2 z-10 w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center text-white text-xs font-black shadow-lg shadow-blue-500/30 border-2 border-blue-400/40 ring-4 ring-[#0B1121]" style={{ top: 'calc(50% - 28px)' }}>
                    Q1
                  </div>
                  <div className="absolute left-0 right-0 px-1" style={{ top: 'calc(50% + 36px)' }}>
                    <div className="group p-3 rounded-xl bg-slate-900/80 border border-blue-500/20 hover:border-blue-500/40 transition-all duration-300 text-center">
                      <Zap className="h-4 w-4 text-blue-400 mx-auto mb-1.5" />
                      <h3 className="font-bold text-white text-[11px] leading-tight">Lancement CloseOS Sales</h3>
                      <p className="text-[10px] text-slate-500 mt-1">CRM, Pipeline, VoIP, KPIs...</p>
                      <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
                      </div>
                    </div>
                  </div>
                </div>

                {/* Q2 — ABOVE */}
                <div className="relative flex flex-col items-center" style={{ width: '20%' }}>
                  <div className="absolute left-1/2 -translate-x-1/2 z-10 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white text-[9px] font-black shadow-lg shadow-indigo-500/30 border-2 border-indigo-400/40 ring-4 ring-[#0B1121]" style={{ top: 'calc(50% - 28px)' }}>
                    Q2
                  </div>
                  <div className="absolute left-0 right-0 px-1" style={{ bottom: 'calc(50% + 36px)' }}>
                    <div className="group p-3 rounded-xl bg-slate-900/80 border border-indigo-500/20 hover:border-indigo-500/40 transition-all duration-300 text-center">
                      <Building2 className="h-4 w-4 text-indigo-400 mx-auto mb-1.5" />
                      <h3 className="font-bold text-white text-[11px] leading-tight">CloseOS Business</h3>
                      <p className="text-[10px] text-slate-500 mt-1">L'outil pour les Infopreneurs, agences, head of sales... Inclut le CRM Complet.</p>
                      <span className="text-[9px] text-indigo-400 font-semibold uppercase tracking-wider">Q2 2026</span>
                    </div>
                  </div>
                </div>

                {/* Q2 Fin — BELOW */}
                <div className="relative flex flex-col items-center" style={{ width: '20%' }}>
                  <div className="absolute left-1/2 -translate-x-1/2 z-10 w-4 h-4 rounded-full bg-violet-500 ring-4 ring-[#0B1121]" style={{ top: 'calc(50% - 8px)' }} />
                  <div className="absolute left-0 right-0 px-1" style={{ top: 'calc(50% + 16px)' }}>
                    <div className="group p-3 rounded-xl bg-slate-900/80 border border-violet-500/20 hover:border-violet-500/40 transition-all duration-300 text-center">
                      <FileText className="h-4 w-4 text-violet-400 mx-auto mb-1.5" />
                      <h3 className="font-bold text-white text-[11px] leading-tight">Rapport de performance</h3>
                      <p className="text-[10px] text-slate-500 mt-1">Feedback sur appels</p>
                      <span className="text-[9px] text-violet-400 font-semibold uppercase tracking-wider">FIN Q2</span>
                    </div>
                  </div>
                </div>

                {/* Q3 — ABOVE */}
                <div className="relative flex flex-col items-center" style={{ width: '20%' }}>
                  <div className="absolute left-1/2 -translate-x-1/2 z-10 w-14 h-14 rounded-full bg-gradient-to-br from-amber-600 to-orange-500 flex items-center justify-center text-white text-xs font-black shadow-lg shadow-amber-500/30 border-2 border-amber-400/40 ring-4 ring-[#0B1121]" style={{ top: 'calc(50% - 28px)' }}>
                    Q3
                  </div>
                  <div className="absolute left-0 right-0 px-1" style={{ bottom: 'calc(50% + 36px)' }}>
                    <div className="group p-3 rounded-xl bg-slate-900/80 border border-amber-500/20 hover:border-amber-500/40 transition-all duration-300 text-center">
                      <Smartphone className="h-4 w-4 text-amber-400 mx-auto mb-1.5" />
                      <h3 className="font-bold text-white text-[11px] leading-tight">App Mobile</h3>
                      <p className="text-[10px] text-slate-500 mt-1">iOS & Android</p>
                      <span className="text-[9px] text-amber-400 font-semibold uppercase tracking-wider">MILIEU Q3</span>
                    </div>
                  </div>
                </div>

                {/* Q4 — BELOW */}
                <div className="relative flex flex-col items-center" style={{ width: '20%' }}>
                  <div className="absolute left-1/2 -translate-x-1/2 z-10 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-600 to-teal-500 flex items-center justify-center text-white text-xs font-black shadow-lg shadow-emerald-500/30 border-2 border-emerald-400/40 ring-4 ring-[#0B1121]" style={{ top: 'calc(50% - 28px)' }}>
                    Q4
                  </div>
                  <div className="absolute left-0 right-0 px-1" style={{ top: 'calc(50% + 36px)' }}>
                    <div className="group p-3 rounded-xl bg-slate-900/80 border border-emerald-500/20 hover:border-emerald-500/40 transition-all duration-300 text-center">
                      <MessageSquare className="h-4 w-4 text-emerald-400 mx-auto mb-1.5" />
                      <h3 className="font-bold text-white text-[11px] leading-tight">Messagerie Interne</h3>
                      <p className="text-[10px] text-slate-500 mt-1">Chat équipe intégré</p>
                      <span className="text-[9px] text-emerald-400 font-semibold uppercase tracking-wider">Q4 2026</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </motion.section >

      {/* COMPARISON SECTION */}
      <motion.section
        id="comparison"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8 }}
        className="py-24 bg-slate-950/50 border-y border-white/5 relative overflow-hidden"
      >
        <div className="absolute top-1/2 left-0 -translate-y-1/2 w-96 h-96 bg-red-600/10 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute top-1/2 right-0 -translate-y-1/2 w-96 h-96 bg-blue-600/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="mx-auto max-w-7xl px-6 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white sm:text-5xl">Closer sans CloseOS vs avec CloseOS</h2>
            <p className="text-slate-400 mt-4 text-lg">Pourquoi rester esclave de l'administratif quand un seul outil peut tout automatiser ?</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">

            {/* 🔴 ANCIENNE METHODE */}
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-br from-red-500/20 to-transparent rounded-3xl blur opacity-20 group-hover:opacity-40 transition-opacity"></div>
              <div className="relative rounded-3xl bg-[#0F0505] border border-red-900/30 p-8 h-full flex flex-col">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                    <XCircle className="w-6 h-6 text-red-500" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">Les "Obligations" Invisibles</h3>
                </div>

                <div className="space-y-4 flex-1">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-red-900/10 border border-red-900/20 text-sm">
                    <div className="flex items-center gap-3 text-red-200">
                      <Database className="w-4 h-4" /> Jonglage entre CRMs (HubSpot...)
                    </div>
                    <span className="font-bold text-red-400">Charge mentale</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-red-900/10 border border-red-900/20 text-sm">
                    <div className="flex items-center gap-3 text-red-200">
                      <Sheet className="w-4 h-4" /> Reporting KPI sur Google Sheet
                    </div>
                    <span className="font-bold text-red-400">Saisie Manuelle</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-red-900/10 border border-red-900/20 text-sm">
                    <div className="flex items-center gap-3 text-red-200">
                      <Phone className="w-4 h-4" /> Analyse d'appels / VoIP
                    </div>
                    <span className="font-bold text-red-400">Données dispersées</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-red-900/10 border border-red-900/20 text-sm">
                    <div className="flex items-center gap-3 text-red-200">
                      <FileText className="w-4 h-4" /> Facturation des commissions
                    </div>
                    <span className="font-bold text-red-400">Retards & Oublis</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-red-900/10 border border-red-900/20 text-sm opacity-80">
                    <div className="flex items-center gap-3 text-red-200">
                      <Clock className="w-4 h-4" /> Temps de gestion hebdo
                    </div>
                    <span className="font-bold text-red-400">~5h perdues</span>
                  </div>
                </div>

                <div className="mt-8 pt-8 border-t border-red-900/30 text-center">
                  <div className="mb-6">
                    <div className="text-lg font-bold text-white">~150 kg <span className="text-sm font-normal text-slate-400">de CO2 émis / an</span></div>
                    <p className="text-[10px] text-red-300/70 mt-1 leading-tight">(Multitude d'interfaces chargées + Serveurs + RAM)</p>
                  </div>

                  <div className="pt-6 border-t border-red-900/30">
                    <p className="text-red-400 text-xs font-bold uppercase tracking-widest mb-1">PERTE ESTIMÉE</p>
                    {/* MODIFICATION 2 : 35H + SOUS-TITRE */}
                    <div className="text-4xl font-black text-white">
                      10h<span className="text-lg text-slate-500 font-medium">/semaine</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 🔵 CloseOS */}
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-bl from-blue-500/20 to-purple-500/20 rounded-3xl blur opacity-30 group-hover:opacity-60 transition-opacity"></div>
              <div className="relative rounded-3xl bg-[#020617] border border-blue-500/30 p-8 h-full flex flex-col shadow-2xl shadow-blue-900/20">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full border border-blue-400 shadow-lg shadow-blue-600/50">
                  FOCUS CLOSING UNIQUEMENT
                </div>

                <div className="flex items-center gap-3 mb-8">
                  <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <CheckCircle2 className="w-6 h-6 text-blue-500" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">La Clarté CloseOS</h3>
                </div>

                <div className="flex-1 bg-slate-900/50 rounded-2xl p-6 border border-white/5 space-y-6 flex flex-col justify-center">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white">ROI Immédiat</h4>
                      <p className="text-sm text-slate-400">1 seul deal de plus par mois rembourse largement l'outil pour l'année.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                      <BrainCircuit className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white">Cerveau Libéré</h4>
                      <p className="text-sm text-slate-400">Zéro saisie. CRM, KPIs et Factures se mettent à jour automatiquement après chaque appel.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                      <Star className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white">Image 100% Pro</h4>
                      <p className="text-sm text-slate-400">KPIs propres, factures en 1 clic, cockpit de bord. Travaillez comme le top 1%.</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-8 border-t border-blue-500/20 text-center relative">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-blue-500/50 blur-[2px]"></div>

                  <div className="mb-6 group relative cursor-help">
                    <div className="text-lg font-bold text-white">~50 kg <span className="text-sm font-normal text-slate-400">de CO2 émis / an</span></div>
                    <p className="text-xs text-emerald-400/80 mt-1 leading-snug">
                      Économisez ~100 kg de CO2 par an. CloseOS consomme drastiquement moins de ressources serveur et de batterie que 10 onglets ouverts en permanence
                    </p>

                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-900 border border-slate-700 rounded-xl shadow-xl text-xs text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      Passer à CloseOS économise ~100 kg de CO2 par an et par closer. C'est l'équivalent de 600 km en voiture évités, juste en fermant vos onglets.
                      <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 border-b border-r border-slate-700 rotate-45"></div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-blue-500/20 relative z-10">
                    <p className="text-blue-400 text-sm font-medium uppercase tracking-widest mb-1">Pack Pro</p>
                    <div className="text-5xl font-black text-white tracking-tight">
                      34€<span className="text-lg text-slate-500 font-medium">/mois</span>
                    </div>
                    <p className="text-emerald-400 text-xs font-bold mt-2 flex items-center justify-center gap-1">
                      <Zap className="w-3 h-3" />
                      Récupérez 1h de vie / jour
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </motion.section >

      {/* PRICING SECTION */}
      <motion.section
        id="pricing"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8 }}
        className="py-32 relative bg-slate-950"
      >
        <div className="mx-auto max-w-7xl px-6 relative z-10">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white sm:text-5xl">Tarifs CloseOS — l'outil tout-en-un des closers</h2>
            <p className="text-slate-400 mt-4 text-lg">Un seul plan. Tout inclus. Sans engagement.</p>
            <p className="text-white mt-4 text-2xl font-bold">Testez gratuitement 10 jours. Aucune carte bancaire requise.</p>
          </div>

          <div className="flex flex-col items-center mb-12">
            {/* SWITCH MOIS / ANNÉE */}
            <div className="flex items-center justify-center gap-4">
              <span
                className={`text-sm font-medium cursor-pointer transition-colors ${billingCycle === 'monthly' ? 'text-white' : 'text-slate-500'}`}
                onClick={() => setBillingCycle('monthly')}
              >
                Mensuel
              </span>

              <button
                onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
                className="relative w-14 h-7 bg-slate-800 rounded-full p-1 transition-colors duration-200 focus:outline-none border border-slate-700"
              >
                <div
                  className={`w-5 h-5 bg-blue-600 rounded-full shadow-md transform transition-transform duration-200 ${billingCycle === 'yearly' ? 'translate-x-7' : 'translate-x-0'
                    }`}
                />
              </button>

              <span
                className={`text-sm font-medium cursor-pointer transition-colors flex items-center gap-2 ${billingCycle === 'yearly' ? 'text-white' : 'text-slate-500'}`}
                onClick={() => setBillingCycle('yearly')}
              >
                Annuel
                <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
                  -25%
                </span>
              </span>
            </div>

          </div>

          <div className="max-w-lg mx-auto">
            {/* PLAN PRO */}
            <div className="rounded-3xl border-2 border-blue-500 bg-blue-950/20 p-8 shadow-2xl shadow-blue-900/40 relative flex flex-col h-full animate-in fade-in zoom-in duration-300">
              <div className="absolute -top-3 right-6">
                <span className="px-3 py-1 rounded-full bg-blue-600 text-white text-xs font-black uppercase tracking-widest shadow-lg">
                  🔥 -51% OFFRE DE LANCEMENT
                </span>
              </div>
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-2xl font-bold text-white">PACK PRO</h3>
                  <Star className="h-5 w-5 text-yellow-400 fill-yellow-400 animate-pulse" />
                </div>
                <p className="mt-2 text-blue-200 text-sm">L'outil tout-en-un des closers. Accès complet & illimité.</p>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-5xl font-extrabold text-white">{calculatePrice(34)}€</span>
                  <span className="text-slate-400 line-through text-lg">69€</span>
                  <span className="text-slate-500">/mois</span>
                </div>
                {billingCycle === 'yearly' && (
                  <p className="text-xs text-emerald-400 mt-2">Facturé annuellement (306€/an)</p>
                )}
              </div>
              <ul className="space-y-4 mb-4 flex-1">
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
                  <span>Support Prioritaire</span>
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
              <p className="mt-3 text-[10px] text-center text-slate-500/60">
                1,5% de votre abonnement finance l'élimination du CO2 via Stripe Climate.
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-col md:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
            {/* Option VoIP */}
            <div className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl bg-blue-900/20 border border-blue-500/30 shadow-lg shadow-blue-500/5">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <PlusCircle className="h-5 w-5 text-blue-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-white">Option VoIP </p>
                <p className="text-xs text-blue-300 font-bold uppercase tracking-wider">
                  Arrive prochainement
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* COMPARISON MODAL */}
      {
        isComparisonOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-950 rounded-2xl border border-slate-800 shadow-2xl animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setIsComparisonOpen(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors z-10"
              >
                <X className="h-6 w-6" />
              </button>
              <PricingComparisonTable isModal={true} />
              <div className="p-6 border-t border-slate-900 bg-slate-950/50 sticky bottom-0 text-center">
                <button
                  onClick={() => setIsComparisonOpen(false)}
                  className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
                >
                  Fermer le comparatif
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* --- FAQ SECTION --- */}
      <motion.section
        id="faq"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8 }}
        className="py-24 bg-slate-950 relative border-t border-white/5"
      >
        <div className="mx-auto max-w-3xl px-6 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">Questions Fréquentes</h2>
            <p className="text-slate-400 mt-4">Tout ce que vous devez savoir avant de commencer.</p>
          </div>

          <div className="space-y-4">
            <FAQItem question="Est-ce que je peux connecter Calendly ?">
              <p>
                <strong className="text-white">Non, et c'est un choix assumé.</strong> Calendly impose un abonnement payant pour permettre les intégrations, une pratique que nous trouvons injuste.
                Pour vous offrir la meilleure expérience sans surcoût, nous avons intégré <strong className="text-white">Cal.com</strong> (la référence Open Source).
              </p>
              <p className="mt-2">
                Résultat : vous profitez d'un système de booking ultra-performant, synchronisé à votre agenda, sans avoir à payer un abonnement "Pro" à Calendly juste pour qu'il accepte de parler à votre CRM.
              </p>
            </FAQItem>

            <FAQItem question="Comment CloseOS s'engage pour l'environnement ?">
              <p>Nous prônons la <strong className="text-emerald-400">"Performance Responsable"</strong>. Concrètement :</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li><strong className="text-white">Sobriété numérique :</strong> En remplaçant 10 outils par 1 seul, nous réduisons la consommation d'énergie serveur nécessaire à votre activité.</li>
                <li><strong className="text-white">Action financière :</strong> Nous reversons automatiquement <strong className="text-white">1,5% de votre abonnement</strong> via <em>Stripe Climate</em> pour financer des technologies de pointe d'élimination du CO2. Closer avec nous, c'est aussi contribuer.</li>
              </ul>
            </FAQItem>

            <FAQItem question="Pourquoi payer CloseOS alors que je peux le faire moi-même sur Excel/Notion ?">
              <p>
                Parce que le "bricolage" vous coûte des ventes. Excel n'envoie pas de rappels automatiques, Notion ne génère pas vos liens de visio et ne synchronise pas vos appels.
              </p>
              <p className="mt-2">
                CloseOS n'est pas un simple tableau de note, c'est un <strong className="text-white">système actif</strong> qui élimine 80% de votre administratif. Le temps que vous ne passez plus à configurer vos outils est du temps réinvesti pour signer des contrats.
              </p>
            </FAQItem>

            <FAQItem question="Pourquoi le Pack Pro est-il à 34€ au lieu de 69€ ?">
              <p>
                <strong className="text-white">C'est une offre de lancement.</strong> Nous récompensons nos premiers utilisateurs avec ce tarif préférentiel.
              </p>
              <p className="mt-2">
                Le prix standard passera à 69€/mois. En prenant votre accès maintenant, vous profitez du tarif de lancement.
              </p>
            </FAQItem>

            <FAQItem question="Est-ce que iClosed est intégré ?">
              <p>
                <strong className="text-white">Partiellement.</strong> Contrairement aux standards du marché (HubSpot, Pipedrive), iClosed ne dispose pas d'une API publique ouverte permettant une synchronisation totale.
              </p>
              <p className="mt-2">
                <strong className="text-white">Concrètement :</strong> CloseOS reçoit bien vos nouveaux leads et vos ventes venant d'iClosed (via Webhook), mais ne peut pas aller modifier des informations <em>dans</em> iClosed. La synchronisation se fait donc à sens unique (iClosed vers CloseOS). (L'API arrivera Prochainement)
              </p>
            </FAQItem>
          </div>
        </div>
      </motion.section >

      {/* --- CTA FINAL --- */}
      <motion.section
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8 }}
        className="relative py-32 overflow-hidden"
      >
        <div className="absolute inset-0 bg-blue-600/10 blur-[100px] rounded-full pointer-events-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

        <div className="relative mx-auto max-w-4xl px-6 text-center z-10">
          <h2 className="text-4xl font-bold text-white mb-6">
            Arrêtez de payer pour 10 outils.<br />Commencez à closer.
          </h2>
          <p className="text-xl text-slate-300 mb-10">
            Rejoignez l'élite des closers qui utilisent le système tout-en-un CloseOS.
          </p>
          <div className="flex flex-col items-center justify-center gap-4">
            <Link
              to="/register"
              className="w-full sm:w-auto px-10 py-4 rounded-full bg-white text-slate-950 font-bold text-lg hover:bg-blue-50 hover:scale-105 transition-all flex items-center justify-center gap-2 shadow-xl shadow-white/10"
            >
              Commencer gratuitement
              <ChevronRight className="h-5 w-5" />
            </Link>
          </div>
          <p className="mt-6 text-sm text-slate-500">
            10 jours d'essai gratuit. Pas de prélèvement immédiat.
          </p>
        </div>
      </motion.section >

      {/* --- FOOTER --- */}
      <footer className="border-t border-white/5 bg-[#020617] py-6 pb-16">
        <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo Sales.png" alt="CloseOS Logo" className="h-6 w-auto" />
          </div>

          <div className="flex flex-wrap justify-center gap-4 text-xs text-slate-500">
            <span>© 2026 CloseOS.fr</span>
            <span className="hidden sm:inline">•</span>
            <a href="/mentions-legales" className="hover:text-white transition-colors">Mentions Légales</a>
            <span className="hidden sm:inline">•</span>
            <a href="/cgu" className="hover:text-white transition-colors">CGU</a>
            <span className="hidden sm:inline">•</span>
            <a href="/cgv" className="hover:text-white transition-colors">CGV</a>
            <span className="hidden sm:inline">•</span>
            <a href="/confidentialite" className="hover:text-white transition-colors">Politique de Confidentialité</a>
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
            <a href="mailto:support@closeos.fr" className="text-slate-500 hover:text-white transition-colors">support@closeos.fr</a>
          </div>
        </div>
      </footer>

      {/* Fixed bottom blur cue */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#020617] via-[#020617]/80 to-transparent backdrop-blur-[1px] pointer-events-none z-[80]" />

      <style>{`
        @keyframes pageEnterFromTop {
          from { opacity: 0; transform: translateY(-60px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div >
  )
}