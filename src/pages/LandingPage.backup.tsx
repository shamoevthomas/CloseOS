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
  Globe,
} from 'lucide-react'
import { salesTranslations, detectSalesLang } from './landingPageI18n'
import type { SalesLang } from './landingPageI18n'

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
  { label: 'Make', color: '#6D00CC' },
  { label: 'n8n', color: '#EA4B71' },
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
  const [lang, setLang] = useState<SalesLang>('fr');
  const t = salesTranslations[lang];

  useEffect(() => { setLang(detectSalesLang()) }, []);

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
    document.title = t.seo_title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', t.seo_description);

    // Fix canonical + OG/Twitter URLs for /landing
    document.getElementById('canonical')?.setAttribute('href', 'https://www.closeos.fr/landing');
    document.getElementById('og-url')?.setAttribute('content', 'https://www.closeos.fr/landing');
    document.getElementById('og-title')?.setAttribute('content', t.seo_title);
    document.getElementById('og-description')?.setAttribute('content', t.seo_description);
    document.getElementById('og-image')?.setAttribute('content', 'https://www.closeos.fr/og-sales.png');
    document.getElementById('tw-url')?.setAttribute('content', 'https://www.closeos.fr/landing');
    document.getElementById('tw-title')?.setAttribute('content', t.seo_title);
    document.getElementById('tw-description')?.setAttribute('content', t.seo_description);
    document.getElementById('tw-image')?.setAttribute('content', 'https://www.closeos.fr/og-sales.png');
    document.documentElement.lang = lang;

    // hreflang tags
    document.querySelectorAll('link[data-hreflang]').forEach(el => el.remove());
    const hreflangs = [
      { lang: 'fr', href: 'https://www.closeos.fr/landing' },
      { lang: 'en', href: 'https://www.closeos.fr/landing?lang=en' },
      { lang: 'x-default', href: 'https://www.closeos.fr/landing' },
    ];
    hreflangs.forEach(({ lang: hl, href }) => {
      const link = document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = hl;
      link.href = href;
      link.setAttribute('data-hreflang', 'true');
      document.head.appendChild(link);
    });

    document.querySelector('script[data-closeos-sales-ld]')?.remove();
    document.querySelector('script[data-closeos-sales-faq-ld]')?.remove();
    document.querySelector('script[data-closeos-sales-breadcrumb-ld]')?.remove();

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-closeos-sales-ld', 'true');
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'CloseOS Sales',
      url: 'https://www.closeos.fr/landing',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description: t.ld_description,
      offers: { '@type': 'AggregateOffer', lowPrice: '0', highPrice: '99', priceCurrency: 'EUR', availability: 'https://schema.org/InStock', offerCount: '3' },
      featureList: t.ld_features,
      inLanguage: lang,
    });
    document.head.appendChild(script);

    const faqScript = document.createElement('script');
    faqScript.type = 'application/ld+json';
    faqScript.setAttribute('data-closeos-sales-faq-ld', 'true');
    faqScript.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        { '@type': 'Question', name: t.ld_faq1_q, acceptedAnswer: { '@type': 'Answer', text: t.ld_faq1_a } },
        { '@type': 'Question', name: t.ld_faq2_q, acceptedAnswer: { '@type': 'Answer', text: t.ld_faq2_a } },
        { '@type': 'Question', name: t.ld_faq3_q, acceptedAnswer: { '@type': 'Answer', text: t.ld_faq3_a } },
        { '@type': 'Question', name: t.ld_faq4_q, acceptedAnswer: { '@type': 'Answer', text: t.ld_faq4_a } },
        { '@type': 'Question', name: t.ld_faq5_q, acceptedAnswer: { '@type': 'Answer', text: t.ld_faq5_a } },
      ],
    });
    document.head.appendChild(faqScript);

    const breadcrumbScript = document.createElement('script');
    breadcrumbScript.type = 'application/ld+json';
    breadcrumbScript.setAttribute('data-closeos-sales-breadcrumb-ld', 'true');
    breadcrumbScript.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'CloseOS', item: 'https://www.closeos.fr' },
        { '@type': 'ListItem', position: 2, name: 'CloseOS Sales', item: 'https://www.closeos.fr/landing' },
      ],
    });
    document.head.appendChild(breadcrumbScript);

    document.querySelector('script[data-closeos-sales-person-ld]')?.remove();
    const personScript = document.createElement('script');
    personScript.type = 'application/ld+json';
    personScript.setAttribute('data-closeos-sales-person-ld', 'true');
    personScript.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: 'Thomas Shamoev',
      jobTitle: 'Fondateur',
      worksFor: { '@type': 'Organization', name: 'CloseOS' },
      image: 'https://qwjvdwpixewsctircibl.supabase.co/storage/v1/object/public/avatars/business-7d48e479-cede-480e-b405-39611a48d333-0.3286628360007747.jpg',
    });
    document.head.appendChild(personScript);

    return () => {
      document.querySelector('script[data-closeos-sales-ld]')?.remove();
      document.querySelector('script[data-closeos-sales-faq-ld]')?.remove();
      document.querySelector('script[data-closeos-sales-breadcrumb-ld]')?.remove();
      document.querySelector('script[data-closeos-sales-person-ld]')?.remove();
      document.querySelectorAll('link[data-hreflang]').forEach(el => el.remove());
    };
  }, [lang, t]);

  useEffect(() => {
    let s: HTMLScriptElement | null = null;
    const timer = setTimeout(() => {
      s = document.createElement('script');
      s.src = '/chatbot-widget.js';
      s.setAttribute('data-chatbot-id', 'acb35233-a6de-4738-9ba0-7e25c82c2a61');
      s.setAttribute('data-supabase-url', 'https://mkxcircbzcsjamslijde.supabase.co');
      s.setAttribute('data-supabase-key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1reGNpcmNiemNzamFtc2xpamRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MjM0MDAsImV4cCI6MjA4NzQ5OTQwMH0.9-abq1tEFsmjfRkLJjrkXlG3z-9o2HKYjyp5eBIl178');
      s.setAttribute('data-lang', lang);
      document.body.appendChild(s);
    }, 5000);

    return () => {
      clearTimeout(timer);
      if (s && document.body.contains(s)) {
        document.body.removeChild(s);
      }
      const chatbotContainer = document.getElementById('chatbot-widget-container');
      if (chatbotContainer) {
        chatbotContainer.remove();
      }
    };
  }, [lang]);

  return (
    <div ref={pageRef} className={`min-h-screen bg-[#020617] text-slate-100 font-sans selection:bg-blue-500/30 overflow-x-hidden transition-all duration-500 ${isExiting ? 'translate-y-full opacity-0' : 'animate-[pageEnterFromTop_0.5s_ease-out]'}`}>

      {/* BANDEAU OFFRE */}
      <div className="fixed top-0 z-[60] w-full bg-blue-600 py-2.5 text-center text-xs sm:text-sm font-bold text-white shadow-lg animate-in slide-in-from-top duration-500">
        {t.banner}
      </div>

      {/* NAVBAR */}
      <nav className="fixed top-[40px] z-50 w-full border-b border-white/5 bg-[#020617]/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="relative group flex items-center gap-1 cursor-pointer">
            <img src="/logo-sales.png" alt="CloseOS Logo" className="h-12 w-auto" fetchPriority="high" width={120} height={48} />
            <ChevronDown className="h-4 w-4 text-slate-500 group-hover:text-slate-300 transition-transform duration-300 group-hover:rotate-180" />
            <div className="absolute top-full left-0 right-0 mt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 translate-y-2 group-hover:translate-y-0">
              <a onClick={handleNavigateToBusiness} className="block rounded-xl border border-business-primary/10 bg-[#F5F0EB] p-3 shadow-xl hover:bg-[#EDE7E0] transition-colors cursor-pointer">
                <img src="/closeos-business-logo-ecrit.png" alt="CloseOS Business" className="w-full h-auto" loading="lazy" width={200} height={40} />
              </a>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">{t.nav_features}</a>
            <a href="#integrations" className="hover:text-white transition-colors">{t.nav_integrations}</a>
            <a href="#comparison" className="hover:text-white transition-colors">{t.nav_comparison}</a>
            <a href="#pricing" className="text-white font-semibold transition-colors">{t.nav_pricing}</a>
            <a href="#faq" className="hover:text-white transition-colors">{t.nav_faq}</a>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
              className="hidden sm:flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-3 text-xs font-bold text-slate-400 hover:text-white hover:border-white/40 transition-all uppercase tracking-wider"
            >
              <Globe className="h-3.5 w-3.5" />
              {lang === 'fr' ? 'EN' : 'FR'}
            </button>
            <Link
              to="/login"
              className="hidden sm:flex items-center rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-white/10 hover:border-white/40"
            >
              {t.nav_login}
            </Link>
            <Link
              to="/register"
              className="hidden sm:flex group items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-bold text-slate-950 transition-all hover:bg-blue-50 hover:scale-105 active:scale-95"
            >
              {t.nav_cta}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            {/* Hamburger mobile */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
              aria-label="Menu"
              aria-expanded={mobileMenuOpen}
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
              { href: '#features', label: t.nav_features },
              { href: '#integrations', label: t.nav_integrations },
              { href: '#comparison', label: t.nav_comparison },
              { href: '#pricing', label: t.nav_pricing },
              { href: '#faq', label: t.nav_faq },
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
              <button
                onClick={() => { setLang(lang === 'fr' ? 'en' : 'fr'); setMobileMenuOpen(false) }}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-white/10 text-slate-300 font-bold text-sm hover:bg-white/10 transition-colors"
              >
                <Globe className="h-4 w-4" />
                {lang === 'fr' ? 'English' : 'Français'}
              </button>
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center w-full py-3 rounded-xl border border-white/20 text-white font-bold text-sm hover:bg-white/10 transition-colors"
              >
                {t.nav_login}
              </Link>
              <Link
                to="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-white text-slate-950 font-bold text-sm hover:bg-blue-50 transition-colors"
              >
                {t.nav_cta}
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
              {t.badge_env}
            </div>
          </div>

          {/* 👇 MODIFICATION : DOUBLE BULLE AVEC RGPD */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300 hover:bg-blue-500/20 transition-colors cursor-default">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              {t.badge_system}
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 transition-colors cursor-default">
              <ShieldCheck className="h-3.5 w-3.5" />
              {t.badge_rgpd}
            </div>
          </div>



          <h1 className="mx-auto max-w-5xl text-5xl font-extrabold tracking-tight text-white sm:text-7xl mb-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
            {t.hero_title_line1}<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 animate-gradient-x">
              {t.hero_title_line2}
            </span>
            <br />
            {t.hero_title_line3}
          </h1>

          <p className="mx-auto max-w-2xl text-lg text-slate-400 mb-10 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200 leading-relaxed">
            {t.hero_subtitle}
          </p>

          <div className="flex items-center justify-center gap-2 mb-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-250">
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-sm font-medium text-violet-300">
              {t.hero_badge_focus}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
            <Link
              to="/register"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-blue-600 text-white font-bold text-lg hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-1 flex items-center justify-center gap-2"
            >
              <Zap className="h-5 w-5 fill-current" />
              {t.hero_cta}
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto px-8 py-4 rounded-xl border border-white/20 text-white font-bold text-lg hover:bg-white/10 hover:border-white/40 transition-all flex items-center justify-center gap-2"
            >
              {t.hero_login}
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
                {t.hero_whatsapp}
              </span>
            </a>
          </div>

          <p className="text-xs text-slate-500 mt-3">
            {t.hero_no_card}
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
                  <img src={src} alt="Closer" className="h-full w-full rounded-full object-cover" loading="lazy" width={32} height={32} />
                </div>
              ))}
            </div>
            <div className="flex flex-col text-left">
              <div className="flex text-amber-400 gap-0.5">
                {[...Array(5)].map((_, i) => <Star key={i} className="h-3 w-3 fill-current" />)}
              </div>
              <span>{t.hero_social_proof} <strong className="text-white">{t.hero_social_proof_count}</strong></span>
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
            {t.integrations_subtitle}
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
            <h2 className="text-3xl font-bold text-white sm:text-5xl mb-6">{t.features_title.split('\n').map((line, i) => <span key={i}>{line}{i === 0 && <br />}</span>)}</h2>
            <p className="text-lg text-slate-400">
              {t.features_subtitle} <span className="text-emerald-400 font-semibold">{t.features_highlight}</span>
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
                <h3 className="text-2xl font-bold text-white mb-3">{t.feat1_title}</h3>
                <p className="text-slate-400 mb-6 max-w-md leading-relaxed">
                  {t.feat1_desc}
                </p>
                <ul className="grid grid-cols-2 gap-2">
                  <li className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> {t.feat1_item1}</li>
                  <li className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> {t.feat1_item2}</li>
                  <li className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> {t.feat1_item3}</li>
                  <li className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> {t.feat1_item4}</li>
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
              <h3 className="text-xl font-bold text-white mb-3">{t.feat2_title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">
                {t.feat2_desc}
                <span className="block mt-2 text-[#25D366] text-xs font-bold uppercase tracking-wide">
                  {t.feat2_badge}
                </span>
              </p>
            </motion.div>

            {/* CARD 3 - PIPELINE (Small) */}
            <motion.div variants={itemVariants} className="rounded-3xl border border-slate-800 bg-slate-900/50 p-8 hover:border-orange-500/30 transition-all duration-500 group hover:bg-slate-900/80">
              <div className="h-12 w-12 rounded-lg bg-orange-500/20 flex items-center justify-center mb-6 ring-1 ring-orange-500/30">
                <TrendingUp className="h-6 w-6 text-orange-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{t.feat3_title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">
                {t.feat3_desc}
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
                <h3 className="text-2xl font-bold text-white mb-3">{t.feat4_title}</h3>
                <p className="text-slate-400 mb-6 max-w-lg leading-relaxed">
                  {t.feat4_desc}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                  <div className="rounded-xl bg-violet-500/5 border border-violet-500/20 p-4">
                    <p className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-2">{t.feat4_bio}</p>
                    <p className="text-sm text-slate-400 leading-relaxed">{t.feat4_bio_desc}</p>
                  </div>
                  <div className="rounded-xl bg-violet-500/5 border border-violet-500/20 p-4">
                    <p className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-2">{t.feat4_instant}</p>
                    <p className="text-sm text-slate-400 leading-relaxed">{t.feat4_instant_desc}</p>
                  </div>
                  <div className="rounded-xl bg-violet-500/5 border border-violet-500/20 p-4">
                    <p className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-2">{t.feat4_tracking}</p>
                    <p className="text-sm text-slate-400 leading-relaxed">{t.feat4_tracking_desc}</p>
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
                <h3 className="text-xl font-bold text-white mb-3">{t.feat5_title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-4">
                  {t.feat5_desc}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-[10px] text-purple-300">{t.feat5_tag1}</span>
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-[10px] text-purple-300">{t.feat5_tag2}</span>
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-[10px] text-purple-300">{t.feat5_tag3}</span>
                </div>
              </div>
            </motion.div>

            {/* CARD 6 - FACTURATION (Small) */}
            <motion.div variants={itemVariants} className="rounded-3xl border border-slate-800 bg-slate-900/50 p-8 hover:border-emerald-500/30 transition-all duration-500 group hover:bg-slate-900/80">
              <div className="h-12 w-12 rounded-lg bg-emerald-500/20 flex items-center justify-center mb-6 ring-1 ring-emerald-500/30">
                <FileText className="h-6 w-6 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{t.feat6_title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                {t.feat6_desc}
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
                <h3 className="text-xl font-bold text-white mb-3">{t.feat7_title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {t.feat7_desc}
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
            <h2 className="text-3xl sm:text-5xl font-bold text-white mt-6">{t.roadmap_title}</h2>
            <p className="text-slate-400 mt-4 max-w-2xl mx-auto text-sm">{t.roadmap_subtitle}</p>
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
                      <h3 className="font-bold text-white text-[11px] leading-tight">{t.roadmap_q1_title}</h3>
                      <p className="text-[10px] text-slate-500 mt-1">{t.roadmap_q1_desc}</p>
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
                      <h3 className="font-bold text-white text-[11px] leading-tight">{t.roadmap_q2_title}</h3>
                      <p className="text-[10px] text-slate-500 mt-1">{t.roadmap_q2_desc}</p>
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
                      <h3 className="font-bold text-white text-[11px] leading-tight">{t.roadmap_q2b_title}</h3>
                      <p className="text-[10px] text-slate-500 mt-1">{t.roadmap_q2b_desc}</p>
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
                      <h3 className="font-bold text-white text-[11px] leading-tight">{t.roadmap_q3_title}</h3>
                      <p className="text-[10px] text-slate-500 mt-1">{t.roadmap_q3_desc}</p>
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
                      <h3 className="font-bold text-white text-[11px] leading-tight">{t.roadmap_q4_title}</h3>
                      <p className="text-[10px] text-slate-500 mt-1">{t.roadmap_q4_desc}</p>
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
            <h2 className="text-3xl font-bold text-white sm:text-5xl">{t.comp_title}</h2>
            <p className="text-slate-400 mt-4 text-lg">{t.comp_subtitle}</p>
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
                  <h3 className="text-2xl font-bold text-white">{t.comp_old_title}</h3>
                </div>

                <div className="space-y-4 flex-1">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-red-900/10 border border-red-900/20 text-sm">
                    <div className="flex items-center gap-3 text-red-200">
                      <Database className="w-4 h-4" /> {t.comp_old1}
                    </div>
                    <span className="font-bold text-red-400">{t.comp_old1_badge}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-red-900/10 border border-red-900/20 text-sm">
                    <div className="flex items-center gap-3 text-red-200">
                      <Sheet className="w-4 h-4" /> {t.comp_old2}
                    </div>
                    <span className="font-bold text-red-400">{t.comp_old2_badge}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-red-900/10 border border-red-900/20 text-sm">
                    <div className="flex items-center gap-3 text-red-200">
                      <Phone className="w-4 h-4" /> {t.comp_old3}
                    </div>
                    <span className="font-bold text-red-400">{t.comp_old3_badge}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-red-900/10 border border-red-900/20 text-sm">
                    <div className="flex items-center gap-3 text-red-200">
                      <FileText className="w-4 h-4" /> {t.comp_old4}
                    </div>
                    <span className="font-bold text-red-400">{t.comp_old4_badge}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-red-900/10 border border-red-900/20 text-sm opacity-80">
                    <div className="flex items-center gap-3 text-red-200">
                      <Clock className="w-4 h-4" /> {t.comp_old5}
                    </div>
                    <span className="font-bold text-red-400">{t.comp_old5_badge}</span>
                  </div>
                </div>

                <div className="mt-8 pt-8 border-t border-red-900/30 text-center">
                  <div className="mb-6">
                    <div className="text-lg font-bold text-white">{t.comp_co2_old} <span className="text-sm font-normal text-slate-400">{t.comp_co2_old_unit}</span></div>
                    <p className="text-[10px] text-red-300/70 mt-1 leading-tight">{t.comp_co2_old_note}</p>
                  </div>

                  <div className="pt-6 border-t border-red-900/30">
                    <p className="text-red-400 text-xs font-bold uppercase tracking-widest mb-1">{t.comp_loss_label}</p>
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
                  {t.comp_new_badge}
                </div>

                <div className="flex items-center gap-3 mb-8">
                  <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <CheckCircle2 className="w-6 h-6 text-blue-500" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">{t.comp_new_title}</h3>
                </div>

                <div className="flex-1 bg-slate-900/50 rounded-2xl p-6 border border-white/5 space-y-6 flex flex-col justify-center">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white">{t.comp_roi_title}</h4>
                      <p className="text-sm text-slate-400">{t.comp_roi_desc}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                      <BrainCircuit className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white">{t.comp_brain_title}</h4>
                      <p className="text-sm text-slate-400">{t.comp_brain_desc}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                      <Star className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white">{t.comp_pro_title}</h4>
                      <p className="text-sm text-slate-400">{t.comp_pro_desc}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-8 border-t border-blue-500/20 text-center relative">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-blue-500/50 blur-[2px]"></div>

                  <div className="mb-6 group relative cursor-help">
                    <div className="text-lg font-bold text-white">{t.comp_co2_new} <span className="text-sm font-normal text-slate-400">{t.comp_co2_new_unit}</span></div>
                    <p className="text-xs text-emerald-400/80 mt-1 leading-snug">
                      {t.comp_co2_new_note}
                    </p>

                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-900 border border-slate-700 rounded-xl shadow-xl text-xs text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      {t.comp_co2_tooltip}
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
                      {t.comp_pack_tagline}
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
            <h2 className="text-3xl font-bold text-white sm:text-5xl">{t.pricing_title}</h2>
            <p className="text-slate-400 mt-4 text-lg">{t.pricing_subtitle}</p>
            <p className="text-white mt-4 text-2xl font-bold">{t.pricing_trial}</p>
          </div>

          <div className="flex flex-col items-center mb-12">
            {/* SWITCH MOIS / ANNÉE */}
            <div className="flex items-center justify-center gap-4">
              <span
                className={`text-sm font-medium cursor-pointer transition-colors ${billingCycle === 'monthly' ? 'text-white' : 'text-slate-500'}`}
                onClick={() => setBillingCycle('monthly')}
              >
                {t.pricing_monthly}
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
                {t.pricing_yearly}
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
                  {t.pricing_launch_badge}
                </span>
              </div>
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-2xl font-bold text-white">PACK PRO</h3>
                  <Star className="h-5 w-5 text-yellow-400 fill-yellow-400 animate-pulse" />
                </div>
                <p className="mt-2 text-blue-200 text-sm">{t.pricing_pack_desc}</p>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-5xl font-extrabold text-white">{calculatePrice(34)}€</span>
                  <span className="text-slate-400 line-through text-lg">69€</span>
                  <span className="text-slate-500">/mois</span>
                </div>
                {billingCycle === 'yearly' && (
                  <p className="text-xs text-emerald-400 mt-2">{t.pricing_billed_yearly}</p>
                )}
              </div>
              <ul className="space-y-4 mb-4 flex-1">
                <li className="flex gap-3 text-sm text-white font-medium">
                  <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                  <span><strong>{t.pricing_feat1_bold}</strong>{t.pricing_feat1_rest}</span>
                </li>
                <li className="flex gap-3 text-sm text-white font-medium">
                  <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                  <span><strong>{t.pricing_feat2_bold}</strong>{t.pricing_feat2_rest}</span>
                </li>
                <li className="flex gap-3 text-sm text-white font-medium">
                  <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                  <span><strong>{t.pricing_feat3}</strong></span>
                </li>
                <li className="flex gap-3 text-sm text-white font-medium">
                  <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                  <span><strong>{t.pricing_feat4_bold}</strong>{t.pricing_feat4_rest}</span>
                </li>
                <li className="flex gap-3 text-sm text-white font-medium">
                  <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                  <span><strong>{t.pricing_feat5_bold}</strong>{t.pricing_feat5_rest}</span>
                </li>
                <li className="flex gap-3 text-sm text-white font-medium">
                  <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                  <span><strong>{t.pricing_feat6_bold}</strong>{t.pricing_feat6_rest}</span>
                </li>
                <li className="flex gap-3 text-sm text-white font-medium">
                  <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                  <span><strong>{t.pricing_feat7_bold}</strong>{t.pricing_feat7_rest}</span>
                </li>
                <li className="flex gap-3 text-sm text-white font-medium">
                  <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                  <span><strong>{t.pricing_feat8}</strong></span>
                </li>
              </ul>

              <Link
                to="/register"
                className="block w-full py-4 rounded-xl bg-blue-600 text-white font-bold text-center hover:bg-blue-500 transition-all shadow-xl shadow-blue-500/20 hover:shadow-blue-500/40"
              >
                {t.pricing_cta}
              </Link>

              <p className="mt-4 text-xs text-center text-slate-500">
                {t.pricing_no_card}
              </p>
              <p className="mt-3 text-[10px] text-center text-slate-500/60">
                {t.pricing_climate}
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
                <p className="text-sm font-bold text-white">{t.pricing_voip_option}</p>
                <p className="text-xs text-blue-300 font-bold uppercase tracking-wider">
                  {t.pricing_voip_soon}
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
                  {t.pricing_close_comparison}
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
            <h2 className="text-3xl font-bold text-white sm:text-4xl">{t.faq_title}</h2>
            <p className="text-slate-400 mt-4">{t.faq_subtitle}</p>
          </div>

          <div className="space-y-4">
            <FAQItem question={t.faq1_q}>
              <p>{t.faq1_a1}</p>
              <p className="mt-2">{t.faq1_a2}</p>
            </FAQItem>

            <FAQItem question={t.faq2_q}>
              <p>{t.faq2_intro}</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>{t.faq2_item1}</li>
                <li>{t.faq2_item2}</li>
              </ul>
            </FAQItem>

            <FAQItem question={t.faq3_q}>
              <p>{t.faq3_a1}</p>
              <p className="mt-2">{t.faq3_a2}</p>
            </FAQItem>

            <FAQItem question={t.faq4_q}>
              <p>{t.faq4_a1}</p>
              <p className="mt-2">{t.faq4_a2}</p>
            </FAQItem>

            <FAQItem question={t.faq5_q}>
              <p>{t.faq5_a1}</p>
              <p className="mt-2">{t.faq5_a2}</p>
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
            {t.cta_title_line1}<br />{t.cta_title_line2}
          </h2>
          <p className="text-xl text-slate-300 mb-10">
            {t.cta_subtitle}
          </p>
          <div className="flex flex-col items-center justify-center gap-4">
            <Link
              to="/register"
              className="w-full sm:w-auto px-10 py-4 rounded-full bg-white text-slate-950 font-bold text-lg hover:bg-blue-50 hover:scale-105 transition-all flex items-center justify-center gap-2 shadow-xl shadow-white/10"
            >
              {t.cta_btn}
              <ChevronRight className="h-5 w-5" />
            </Link>
          </div>
          <p className="mt-6 text-sm text-slate-500">
            {t.cta_trial}
          </p>
        </div>
      </motion.section >

      {/* --- FOUNDER --- */}
      <section className="py-20 border-t border-slate-800">
        <div className="max-w-4xl mx-auto px-6 flex flex-col md:flex-row items-center gap-8">
          <img
            src="https://qwjvdwpixewsctircibl.supabase.co/storage/v1/object/public/avatars/business-7d48e479-cede-480e-b405-39611a48d333-0.3286628360007747.jpg"
            alt="Thomas Shamoev, fondateur de CloseOS"
            width={120}
            height={120}
            loading="lazy"
            className="rounded-full w-28 h-28 object-cover flex-shrink-0"
          />
          <div>
            <p className="text-sm text-[#00E676] font-medium mb-1">{t.founder_section_title}</p>
            <h2 className="text-2xl font-bold text-white mb-1">Thomas Shamoev</h2>
            <p className="text-[#00E676] text-sm mb-4">{t.founder_role}</p>
            <p className="text-slate-400 leading-relaxed">{t.founder_bio}</p>
          </div>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="border-t border-white/5 bg-[#020617] py-6 pb-16">
        <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo-sales.png" alt="CloseOS Logo" className="h-6 w-auto" loading="lazy" width={72} height={24} />
          </div>

          <div className="flex flex-wrap justify-center gap-4 text-xs text-slate-500">
            <span>© 2026 CloseOS.fr</span>
            <span className="hidden sm:inline">•</span>
            <a href="/mentions-legales" className="hover:text-white transition-colors">{t.footer_legal}</a>
            <span className="hidden sm:inline">•</span>
            <a href="/cgu" className="hover:text-white transition-colors">{t.footer_cgu}</a>
            <span className="hidden sm:inline">•</span>
            <a href="/cgv" className="hover:text-white transition-colors">{t.footer_cgv}</a>
            <span className="hidden sm:inline">•</span>
            <a href="/confidentialite" className="hover:text-white transition-colors">{t.footer_privacy}</a>
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