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
  Quote,
} from 'lucide-react'
import { salesTranslations, detectSalesLang } from './landingPageI18n'
import type { SalesLang } from './landingPageI18n'

/* ─── Constants ─── */
const INTEGRATIONS = [
  { label: 'GoHighLevel', color: '#E4573D' },
  { label: 'Airtable', color: '#FFBF00' },
  { label: 'Systeme.io', color: '#00B4D8' },
  { label: 'iClosed', color: '#a855f7' },
  { label: 'Hubspot', color: '#FF7A59' },
  { label: 'Pipedrive', color: '#00AB44' },
  { label: 'Google Calendar', color: '#4285F4' },
  { label: 'Twilio', color: '#F22F46' },
  { label: 'Cal.com', color: '#c4c7c7' },
  { label: 'Stripe', color: '#635BFF' },
  { label: 'Zapier', color: '#FF4A00' },
  { label: 'Make', color: '#6D00CC' },
  { label: 'n8n', color: '#EA4B71' },
];

/* ─── Integrations Marquee ─── */
function IntegrationsMarquee() {
  const [glowing, setGlowing] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setGlowing(true);
      setTimeout(() => setGlowing(false), 1500);
    }, 10000);
    const initial = setTimeout(() => {
      setGlowing(true);
      setTimeout(() => setGlowing(false), 1500);
    }, 2000);
    return () => { clearInterval(interval); clearTimeout(initial); };
  }, []);

  const lit = glowing || hovered;

  const renderItems = (prefix: string) =>
    INTEGRATIONS.map((item, i) => (
      <span
        key={`${prefix}-${i}`}
        className="shrink-0 font-extrabold text-xl sm:text-2xl whitespace-nowrap cursor-default"
        style={{
          color: item.color,
          fontFamily: "'Manrope', sans-serif",
          letterSpacing: '-0.02em',
          opacity: lit ? 0.9 : 0.2,
          textShadow: lit ? `0 0 20px ${item.color}, 0 0 40px ${item.color}60` : 'none',
          transition: 'opacity 0.8s ease, text-shadow 0.8s ease',
        }}
      >
        {item.label}
      </span>
    ));

  return (
    <div
      className="relative overflow-hidden py-8 marquee-container"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ ['--marquee-speed' as string]: hovered ? '120s' : '30s' }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[#111111] to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#111111] to-transparent z-10 pointer-events-none" />
      <div className="marquee-track flex gap-16">
        <div className="marquee-content flex gap-16 shrink-0">{renderItems('a')}</div>
        <div className="marquee-content flex gap-16 shrink-0">{renderItems('b')}</div>
      </div>
    </div>
  );
}

/* ─── FAQ Accordion — Glass ─── */
function FAQItem({ question, children }: { question: string, children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`glass-card rounded-2xl transition-all duration-500 ${isOpen ? 'shadow-[0_0_30px_rgba(0,108,73,0.06)]' : ''}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-6 p-7 text-left group"
      >
        <span className="font-extrabold text-lg text-stone-100 leading-snug" style={{ fontFamily: "'Manrope', sans-serif" }}>
          {question}
        </span>
        <div className={`shrink-0 p-2.5 rounded-full transition-all duration-400 ${isOpen ? 'bg-secondary rotate-90' : 'bg-white/5 group-hover:bg-white/10'}`}>
          <ChevronRight className={`h-4 w-4 transition-colors duration-300 ${isOpen ? 'text-white' : 'text-stone-500'}`} strokeWidth={1.5} />
        </div>
      </button>
      <div className={`grid transition-all duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <div className="px-7 pb-7 text-stone-400 leading-[1.7] text-[0.94rem]">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Motion Variants ─── */
const containerVariants: any = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants: any = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] } }
};

/* ════════════════════════════════════════════════
   LANDING PAGE — Liquid Stone & Glass (Dark)
   ════════════════════════════════════════════════ */
export function LandingPage() {
  const navigate = useNavigate();
  const pageRef = useRef<HTMLDivElement>(null);
  const [isExiting, setIsExiting] = useState(false);
  const [lang, setLangState] = useState<SalesLang>('fr');
  const t = salesTranslations[lang];

  const setLang = (newLang: SalesLang) => {
    setLangState(newLang);
    localStorage.setItem('closeos_lang', newLang);
  };

  useEffect(() => {
    const detected = detectSalesLang();
    setLangState(detected);
    localStorage.setItem('closeos_lang', detected);
  }, []);

  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavigateToBusiness = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsExiting(true);
    setTimeout(() => navigate('/business'), 500);
  };

  const calculatePrice = (price: number) => {
    if (billingCycle === 'yearly') return +(price * 0.75).toFixed(2);
    return price;
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref') || params.get('via');
    if (ref) {
      localStorage.setItem('referral_code', ref);
      localStorage.setItem('closeos_ref', ref);
      document.cookie = `closeos_ref=${encodeURIComponent(ref)};max-age=${30 * 24 * 60 * 60};path=/;SameSite=Lax`;
    }
  }, []);

  useEffect(() => {
    document.title = t.seo_title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', t.seo_description);
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

    document.querySelectorAll('link[data-hreflang]').forEach(el => el.remove());
    [
      { lang: 'fr', href: 'https://www.closeos.fr/landing' },
      { lang: 'en', href: 'https://www.closeos.fr/landing?lang=en' },
      { lang: 'x-default', href: 'https://www.closeos.fr/landing' },
    ].forEach(({ lang: hl, href }) => {
      const link = document.createElement('link');
      link.rel = 'alternate'; link.hreflang = hl; link.href = href;
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
      '@context': 'https://schema.org', '@type': 'WebApplication', name: 'CloseOS Sales',
      url: 'https://www.closeos.fr/landing', applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web', description: t.ld_description,
      offers: { '@type': 'AggregateOffer', lowPrice: '0', highPrice: '99', priceCurrency: 'EUR', availability: 'https://schema.org/InStock', offerCount: '3' },
      featureList: t.ld_features, inLanguage: lang,
    });
    document.head.appendChild(script);

    const faqScript = document.createElement('script');
    faqScript.type = 'application/ld+json';
    faqScript.setAttribute('data-closeos-sales-faq-ld', 'true');
    faqScript.textContent = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'FAQPage',
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
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
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
      '@context': 'https://schema.org', '@type': 'Person', name: 'Thomas Shamoev', jobTitle: 'Fondateur',
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
      if (s && document.body.contains(s)) document.body.removeChild(s);
      document.getElementById('chatbot-widget-container')?.remove();
    };
  }, [lang]);

  /* ─── RENDER ─── */
  return (
    <div ref={pageRef} className={`min-h-screen bg-[#111111] text-stone-200 selection:bg-secondary/30 overflow-x-hidden transition-all duration-500 ${isExiting ? 'translate-y-full opacity-0' : 'animate-[pageEnterFromTop_0.5s_ease-out]'}`} style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ═══ NAVBAR — Glass ═══ */}
      <nav className="fixed top-0 z-50 w-full bg-[#111111]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-8">
          <div className="relative group flex items-center gap-1.5 cursor-pointer">
            <img src="/logo-sales.png" alt="CloseOS Logo" className="h-10 w-auto" fetchPriority="high" width={120} height={48} />
            <ChevronDown className="h-3.5 w-3.5 text-stone-600 group-hover:text-stone-300 transition-all duration-300 group-hover:rotate-180" strokeWidth={1.5} />
            <div className="absolute top-full left-0 right-0 mt-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 translate-y-2 group-hover:translate-y-0">
              <a onClick={handleNavigateToBusiness} className="block glass-card rounded-2xl p-4 hover:bg-white/[0.06] transition-colors cursor-pointer">
                <img src="/closeos-business-logo-ecrit-dark.png" alt="CloseOS Business" className="w-full h-auto" loading="lazy" width={200} height={40} />
              </a>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-8 text-[0.82rem] font-semibold">
            <a href="#features" className="text-stone-500 hover:text-stone-100 transition-colors">{t.nav_features}</a>
            <a href="#integrations" className="text-stone-500 hover:text-stone-100 transition-colors">{t.nav_integrations}</a>
            <a href="#comparison" className="text-stone-500 hover:text-stone-100 transition-colors">{t.nav_comparison}</a>
            <a href="#pricing" className="text-emerald-500 font-bold">{t.nav_pricing}</a>
            <a href="#faq" className="text-stone-500 hover:text-stone-100 transition-colors">{t.nav_faq}</a>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')} className="hidden sm:flex items-center gap-1.5 rounded-full px-3 py-2 text-[0.7rem] font-bold text-stone-500 hover:text-stone-200 hover:bg-white/5 transition-all uppercase tracking-[0.12em]">
              <Globe className="h-3.5 w-3.5" strokeWidth={1.5} />
              {lang === 'fr' ? 'EN' : 'FR'}
            </button>
            <Link to="/login" className="hidden sm:flex items-center rounded-full glass-card px-5 py-2 text-[0.82rem] font-semibold text-stone-200 hover:bg-white/[0.08] transition-all">
              {t.nav_login}
            </Link>
            <Link to="/register" className="hidden sm:flex group items-center gap-2 rounded-full bg-white px-5 py-2 text-[0.82rem] font-bold text-[#111] transition-all hover:bg-stone-200 hover:scale-[1.03] active:scale-[0.97]">
              {t.nav_cta}
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={1.5} />
            </Link>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2.5 rounded-xl hover:bg-white/5 transition-colors" aria-label="Menu" aria-expanded={mobileMenuOpen}>
              {mobileMenuOpen ? <X className="h-5 w-5 text-stone-200" strokeWidth={1.5} /> : <Menu className="h-5 w-5 text-stone-200" strokeWidth={1.5} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <div className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${mobileMenuOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="mx-4 glass-card rounded-2xl px-6 py-5 flex flex-col gap-1">
            {[
              { href: '#features', label: t.nav_features },
              { href: '#integrations', label: t.nav_integrations },
              { href: '#comparison', label: t.nav_comparison },
              { href: '#pricing', label: t.nav_pricing },
              { href: '#faq', label: t.nav_faq },
            ].map((item) => (
              <a key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)} className="py-3 px-4 rounded-xl text-sm font-medium text-stone-400 hover:text-stone-100 hover:bg-white/5 transition-colors">
                {item.label}
              </a>
            ))}
            <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
              <button onClick={() => { setLang(lang === 'fr' ? 'en' : 'fr'); setMobileMenuOpen(false) }} className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-stone-400 font-bold text-sm hover:bg-white/5 transition-colors">
                <Globe className="h-4 w-4" strokeWidth={1.5} />
                {lang === 'fr' ? 'English' : 'Français'}
              </button>
              <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-center w-full py-3 rounded-xl glass-card text-stone-200 font-bold text-sm">
                {t.nav_login}
              </Link>
              <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-white text-[#111] font-bold text-sm">
                {t.nav_cta}
                <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section className="relative pt-28 pb-32 overflow-hidden">
        <div className="absolute top-0 right-[-10%] w-[600px] h-[600px] bg-secondary/5 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-[-20%] left-[-8%] w-[500px] h-[500px] bg-[#ffb95f]/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative mx-auto max-w-5xl px-6 z-10">
          {/* Badges */}
          <div className="flex justify-center mb-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="inline-flex items-center gap-2 rounded-full bg-secondary/10 border border-secondary/20 px-4 py-1.5 text-[0.72rem] font-semibold text-emerald-400">
              {t.badge_env}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-1.5 text-[0.72rem] font-semibold text-stone-200">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              {t.badge_system}
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-secondary/10 border border-secondary/20 px-4 py-1.5 text-[0.72rem] font-semibold text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.5} />
              {t.badge_rgpd}
            </div>
          </div>

          {/* Title */}
          <h1 className="mx-auto max-w-[52rem] text-center text-[3.2rem] sm:text-[4.5rem] lg:text-[5.5rem] font-extrabold text-stone-50 leading-[0.95] mb-10 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.04em' }}>
            {t.hero_title_line1}<br />
            <span className="emerald-gradient-text">{t.hero_title_line2}</span>
            <br />
            {t.hero_title_line3}
          </h1>

          <p className="mx-auto max-w-2xl text-center text-[1.05rem] text-stone-400 mb-12 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200 leading-[1.7]">
            {t.hero_subtitle}
          </p>

          <div className="flex items-center justify-center mb-10 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-250">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/5 border border-white/[0.08] px-5 py-2 text-[0.82rem] font-medium text-stone-300">
              {t.hero_badge_focus}
            </span>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
            <Link to="/register" className="w-full sm:w-auto px-9 py-4 rounded-full bg-white text-[#111] font-bold text-lg transition-all duration-300 hover:bg-secondary hover:text-white hover:shadow-[0_0_30px_rgba(0,108,73,0.3)] hover:-translate-y-1 flex items-center justify-center gap-2.5">
              <Zap className="h-5 w-5" strokeWidth={1.5} />
              {t.hero_cta}
            </Link>
            <Link to="/login" className="w-full sm:w-auto px-9 py-4 rounded-full glass-card text-stone-200 font-bold text-lg transition-all duration-300 hover:bg-white/[0.08] flex items-center justify-center gap-2">
              {t.hero_login}
            </Link>
          </div>

          <div className="mt-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
            <a href="https://www.whatsapp.com/channel/0029Vb7P4lqDDmFLVtD7Jn0s" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-200 transition-colors group">
              <span className="text-green-400">📲</span>
              <span className="underline underline-offset-4 decoration-stone-700 group-hover:decoration-emerald-500 transition-all">{t.hero_whatsapp}</span>
            </a>
          </div>

          <p className="text-[0.72rem] text-stone-600 mt-3 text-center tracking-wide">{t.hero_no_card}</p>

          {/* Social proof */}
          <div className="mt-12 flex items-center justify-center gap-4 text-sm font-medium text-stone-400 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-500">
            <div className="flex -space-x-3">
              {["/U1.jpg", "/U2.jpg", "/U3.jpg", "/U1.png"].map((src, i) => (
                <div key={i} className="h-10 w-10 rounded-full border-[3px] border-[#111111] relative z-0 hover:z-10 transition-all hover:scale-110">
                  <img src={src} alt="Closer" className="h-full w-full rounded-full object-cover" loading="lazy" width={40} height={40} />
                </div>
              ))}
            </div>
            <div className="flex flex-col text-left">
              <div className="flex text-[#ffb95f] gap-0.5">
                {[...Array(5)].map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-current" />)}
              </div>
              <span className="text-[0.82rem]">{t.hero_social_proof} <strong className="text-stone-100">{t.hero_social_proof_count}</strong></span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ INTEGRATIONS ═══ */}
      <motion.section id="integrations" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.8 }} className="py-16 border-t border-white/5">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <p className="text-[0.68rem] font-extrabold text-stone-600 mb-10 uppercase tracking-[0.25em]" style={{ fontFamily: "'Manrope', sans-serif" }}>
            {t.integrations_title}
          </p>
          <IntegrationsMarquee />
        </div>
      </motion.section>

      {/* ═══ FEATURES — Glass Grid ═══ */}
      <motion.section id="features" initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.8 }} className="py-32 relative">
        <div className="absolute top-1/3 right-0 w-[400px] h-[400px] bg-secondary/3 rounded-full blur-[120px] pointer-events-none" />
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-24 max-w-3xl">
            <h2 className="text-[2.8rem] sm:text-[3.8rem] font-extrabold text-stone-50 leading-[0.95] mb-7" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.04em' }}>
              {t.features_title.split('\n').map((line, i) => <span key={i}>{line}{i === 0 && <br />}</span>)}
            </h2>
            <p className="text-lg text-stone-400 leading-[1.7]">
              {t.features_subtitle}{' '}
              <span className="text-emerald-400 font-semibold">{t.features_highlight}</span>
            </p>
          </div>

          <motion.div className="grid grid-cols-1 md:grid-cols-3 gap-5" variants={containerVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }}>

            {/* CARD 1 — Cockpit */}
            <motion.div variants={itemVariants} className="md:col-span-2 glass-card rounded-2xl p-10 sm:p-12 hover:bg-white/[0.05] transition-all duration-500 group overflow-hidden relative">
              <div className="absolute -right-8 -top-8 w-40 h-40 bg-secondary/5 rounded-full blur-[60px] group-hover:bg-secondary/10 transition-all pointer-events-none" />
              <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-700">
                <LayoutDashboard className="w-72 h-72 text-emerald-400" strokeWidth={0.8} />
              </div>
              <div className="relative z-10">
                <div className="p-3 rounded-xl bg-white/5 text-emerald-400 w-fit mb-8">
                  <BarChart3 className="h-7 w-7" strokeWidth={1.5} />
                </div>
                <h3 className="text-[1.6rem] font-extrabold text-stone-50 mb-4" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.03em' }}>{t.feat1_title}</h3>
                <p className="text-stone-400 mb-8 max-w-md leading-[1.7]">{t.feat1_desc}</p>
                <ul className="grid grid-cols-2 gap-3">
                  {[t.feat1_item1, t.feat1_item2, t.feat1_item3, t.feat1_item4].map((item, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-sm text-stone-300"><CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" strokeWidth={1.5} /> {item}</li>
                  ))}
                </ul>
              </div>
            </motion.div>

            {/* CARD 2 — VoIP */}
            <motion.div variants={itemVariants} className="glass-card rounded-2xl p-10 hover:bg-white/[0.05] transition-all duration-500 group relative overflow-hidden">
              <div className="absolute -right-6 -bottom-6 opacity-[0.04] group-hover:opacity-[0.1] transition-opacity duration-700">
                <MessageSquare className="w-36 h-36 text-[#25D366]" strokeWidth={0.8} />
              </div>
              <div className="p-3 rounded-xl bg-white/5 text-[#25D366] w-fit mb-8">
                <Phone className="h-7 w-7" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-extrabold text-stone-50 mb-4" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.03em' }}>{t.feat2_title}</h3>
              <p className="text-stone-400 text-sm leading-[1.7] mb-5">{t.feat2_desc}</p>
              <span className="text-emerald-400 text-[0.68rem] font-extrabold uppercase tracking-[0.18em]">{t.feat2_badge}</span>
            </motion.div>

            {/* Mini-quote 1 */}
            <motion.div variants={itemVariants} className="md:col-span-3 py-4">
              <p className="text-stone-500 text-sm italic text-center">
                "{lang === 'fr' ? 'Mon pipeline est passé de chaotique à limpide en une semaine.' : 'My pipeline went from chaotic to crystal clear in one week.'}"
                <span className="text-stone-600 not-italic ml-2">— Léonie M., {lang === 'fr' ? 'closer indépendante' : 'independent closer'}</span>
              </p>
            </motion.div>

            {/* CARD 3 — Pipeline */}
            <motion.div variants={itemVariants} className="glass-card rounded-2xl p-10 hover:bg-white/[0.05] transition-all duration-500 group">
              <div className="p-3 rounded-xl bg-white/5 text-[#ffb95f] w-fit mb-8">
                <TrendingUp className="h-7 w-7" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-extrabold text-stone-50 mb-4" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.03em' }}>{t.feat3_title}</h3>
              <p className="text-stone-400 text-sm leading-[1.7]">{t.feat3_desc}</p>
            </motion.div>

            {/* CARD 4 — Profil Closer */}
            <motion.div variants={itemVariants} className="md:col-span-2 glass-card rounded-2xl p-10 sm:p-12 hover:bg-white/[0.05] transition-all duration-500 group overflow-hidden relative">
              <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-700">
                <Users className="w-72 h-72 text-purple-400" strokeWidth={0.8} />
              </div>
              <div className="relative z-10">
                <div className="p-3 rounded-xl bg-white/5 text-purple-400 w-fit mb-8">
                  <ArrowRight className="h-7 w-7" strokeWidth={1.5} />
                </div>
                <h3 className="text-[1.6rem] font-extrabold text-stone-50 mb-4" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.03em' }}>{t.feat4_title}</h3>
                <p className="text-stone-400 mb-8 max-w-lg leading-[1.7]">{t.feat4_desc}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { title: t.feat4_bio, desc: t.feat4_bio_desc },
                    { title: t.feat4_instant, desc: t.feat4_instant_desc },
                    { title: t.feat4_tracking, desc: t.feat4_tracking_desc },
                  ].map((sub, idx) => (
                    <div key={idx} className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-5">
                      <p className="text-[0.65rem] font-extrabold text-purple-400 uppercase tracking-[0.18em] mb-3" style={{ fontFamily: "'Manrope', sans-serif" }}>{sub.title}</p>
                      <p className="text-[0.85rem] text-stone-400 leading-[1.65]">{sub.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Mini-quote 2 */}
            <motion.div variants={itemVariants} className="md:col-span-3 py-4">
              <p className="text-stone-500 text-sm italic text-center">
                "{lang === 'fr' ? 'Plus aucun RDV oublié. Mes no-show ont chuté de 40%.' : 'No more forgotten appointments. My no-shows dropped by 40%.'}"
                <span className="text-stone-600 not-italic ml-2">— Samir K., {lang === 'fr' ? 'closer en agence' : 'agency closer'}</span>
              </p>
            </motion.div>

            {/* CARD 5 — Agenda */}
            <motion.div variants={itemVariants} className="glass-card rounded-2xl p-10 hover:bg-white/[0.05] transition-all duration-500 group overflow-hidden relative">
              <div className="absolute -right-6 -bottom-6 opacity-[0.04] group-hover:opacity-[0.1] transition-opacity duration-700">
                <CalendarCheck className="w-36 h-36 text-purple-500" strokeWidth={0.8} />
              </div>
              <div className="relative z-10">
                <div className="p-3 rounded-xl bg-white/5 text-purple-400 w-fit mb-8">
                  <CalendarCheck className="h-7 w-7" strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-extrabold text-stone-50 mb-4" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.03em' }}>{t.feat5_title}</h3>
                <p className="text-stone-400 text-sm leading-[1.7] mb-5">{t.feat5_desc}</p>
                <div className="flex flex-wrap gap-2">
                  {[t.feat5_tag1, t.feat5_tag2, t.feat5_tag3].map((tag, idx) => (
                    <span key={idx} className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-[0.68rem] font-semibold text-purple-400">{tag}</span>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* CARD 6 — Facturation */}
            <motion.div variants={itemVariants} className="glass-card rounded-2xl p-10 hover:bg-white/[0.05] transition-all duration-500 group">
              <div className="p-3 rounded-xl bg-white/5 text-emerald-400 w-fit mb-8">
                <FileText className="h-7 w-7" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-extrabold text-stone-50 mb-4" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.03em' }}>{t.feat6_title}</h3>
              <p className="text-stone-400 text-sm leading-[1.7]">{t.feat6_desc}</p>
            </motion.div>

            {/* CARD 7 — Sync CRM */}
            <motion.div variants={itemVariants} className="glass-card rounded-2xl p-10 hover:bg-white/[0.05] transition-all duration-500 group overflow-hidden relative">
              <div className="absolute -right-6 -bottom-6 opacity-[0.04] group-hover:opacity-[0.1] transition-opacity duration-700">
                <Zap className="w-36 h-36 text-[#ffb95f]" strokeWidth={0.8} />
              </div>
              <div className="relative z-10">
                <div className="p-3 rounded-xl bg-white/5 text-[#ffb95f] w-fit mb-8">
                  <Zap className="h-7 w-7" strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-extrabold text-stone-50 mb-4" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.03em' }}>{t.feat7_title}</h3>
                <p className="text-stone-400 text-sm leading-[1.7]">{t.feat7_desc}</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </motion.section>

      {/* ═══ TESTIMONIALS ═══ */}
      <motion.section initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.8 }} className="py-32 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/[0.03] blur-[180px] rounded-full pointer-events-none" />
        <div className="mx-auto max-w-6xl px-6 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-[2.5rem] sm:text-[3.5rem] font-extrabold text-stone-50 leading-[0.95]" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.04em' }}>{t.testimonials_title}</h2>
            <p className="text-stone-500 mt-5 text-lg">{t.testimonials_subtitle}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote: lang === 'fr'
                  ? "J'ai remplacé 4 outils par CloseOS. Mon pipeline est enfin lisible, mes relances sont automatiques. J'ai gagné 6h par semaine, facilement."
                  : "I replaced 4 tools with CloseOS. My pipeline is finally readable, my follow-ups are automatic. I easily save 6 hours a week.",
                name: 'Margaux D.',
                role: lang === 'fr' ? 'Closer indépendante' : 'Independent closer',
                initials: 'MD',
                color: 'emerald',
              },
              {
                quote: lang === 'fr'
                  ? "Avant je perdais des prospects parce que j'oubliais de relancer. Depuis CloseOS, mon taux de closing est passé de 18% à 31%. Les chiffres parlent."
                  : "I used to lose prospects because I forgot to follow up. Since CloseOS, my closing rate went from 18% to 31%. The numbers speak.",
                name: 'Naël B.',
                role: lang === 'fr' ? 'Closer pour agence média' : 'Closer for media agency',
                initials: 'NB',
                color: 'purple',
              },
              {
                quote: lang === 'fr'
                  ? "L'interface est ultra propre. On sent que c'est pensé par quelqu'un qui a déjà closé. Pas un outil générique de plus."
                  : "The interface is super clean. You can tell it was built by someone who actually closes. Not just another generic tool.",
                name: 'Tiago F.',
                role: lang === 'fr' ? 'Infopreneur & closer' : 'Infopreneur & closer',
                initials: 'TF',
                color: 'amber',
              },
            ].map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: idx * 0.15 }}
                className="glass-card rounded-2xl p-8 flex flex-col relative group hover:bg-white/[0.05] transition-colors duration-500"
              >
                <Quote className="w-8 h-8 text-white/[0.06] mb-4" strokeWidth={1.5} />
                <p className="text-stone-300 text-[0.95rem] leading-[1.7] flex-1 italic">"{item.quote}"</p>
                <div className="flex items-center gap-3 mt-8 pt-6 border-t border-white/[0.06]">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                    item.color === 'emerald' ? 'bg-emerald-500/15 text-emerald-400' :
                    item.color === 'purple' ? 'bg-purple-500/15 text-purple-400' :
                    'bg-[#ffb95f]/15 text-[#ffb95f]'
                  }`}>
                    {item.initials}
                  </div>
                  <div>
                    <p className="text-stone-100 font-bold text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>{item.name}</p>
                    <p className="text-stone-500 text-xs">{item.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ═══ COMPARISON ═══ */}
      <motion.section id="comparison" initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.8 }} className="py-32 border-t border-white/5 relative overflow-hidden">
        <div className="absolute top-1/2 left-[-5%] -translate-y-1/2 w-[500px] h-[500px] bg-red-500/3 blur-[150px] rounded-full pointer-events-none" />
        <div className="absolute top-1/2 right-[-5%] -translate-y-1/2 w-[500px] h-[500px] bg-secondary/5 blur-[150px] rounded-full pointer-events-none" />

        <div className="mx-auto max-w-7xl px-6 relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-[2.5rem] sm:text-[3.5rem] font-extrabold text-stone-50 leading-[0.95]" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.04em' }}>{t.comp_title}</h2>
            <p className="text-stone-500 mt-5 text-lg">{t.comp_subtitle}</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 lg:gap-10 items-stretch">
            {/* Old method */}
            <div className="glass-card rounded-2xl p-10 flex flex-col relative overflow-hidden">
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-red-500/5 rounded-full blur-[60px] pointer-events-none" />
              <div className="flex items-center gap-4 mb-10">
                <div className="p-3 rounded-xl bg-red-500/10 text-red-500"><XCircle className="w-6 h-6" strokeWidth={1.5} /></div>
                <h3 className="text-[1.5rem] font-extrabold text-stone-100" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.03em' }}>{t.comp_old_title}</h3>
              </div>
              <div className="space-y-3 flex-1">
                {[
                  { icon: <Database className="w-4 h-4" strokeWidth={1.5} />, text: t.comp_old1, badge: t.comp_old1_badge },
                  { icon: <Sheet className="w-4 h-4" strokeWidth={1.5} />, text: t.comp_old2, badge: t.comp_old2_badge },
                  { icon: <Phone className="w-4 h-4" strokeWidth={1.5} />, text: t.comp_old3, badge: t.comp_old3_badge },
                  { icon: <FileText className="w-4 h-4" strokeWidth={1.5} />, text: t.comp_old4, badge: t.comp_old4_badge },
                  { icon: <Clock className="w-4 h-4" strokeWidth={1.5} />, text: t.comp_old5, badge: t.comp_old5_badge },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-red-500/[0.04] border border-red-500/10 text-sm">
                    <div className="flex items-center gap-3 text-stone-400">{item.icon} {item.text}</div>
                    <span className="font-bold text-red-400 text-[0.75rem] shrink-0 ml-2">{item.badge}</span>
                  </div>
                ))}
              </div>
              <div className="mt-10 pt-8 border-t border-white/5 text-center">
                <div className="mb-6">
                  <div className="text-lg font-bold text-stone-200">{t.comp_co2_old} <span className="text-sm font-normal text-stone-500">{t.comp_co2_old_unit}</span></div>
                  <p className="text-[0.65rem] text-red-400/60 mt-1 leading-tight">{t.comp_co2_old_note}</p>
                </div>
                <div className="pt-6 border-t border-white/5">
                  <p className="text-red-400 text-[0.65rem] font-extrabold uppercase tracking-[0.2em] mb-1" style={{ fontFamily: "'Manrope', sans-serif" }}>{t.comp_loss_label}</p>
                  <div className="text-[3rem] font-black text-stone-50" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.04em' }}>
                    10h<span className="text-lg text-stone-600 font-medium">/semaine</span>
                  </div>
                </div>
              </div>
            </div>

            {/* CloseOS — Gradient border */}
            <div className="relative pt-4">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 premium-gradient text-white text-[0.68rem] font-extrabold px-5 py-2 rounded-full shadow-[0_0_20px_rgba(0,108,73,0.3)]" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '0.08em' }}>
                {t.comp_new_badge}
              </div>
              <div className="relative rounded-2xl overflow-hidden p-[1px] bg-gradient-to-br from-secondary/40 via-[#c4c7c7]/10 to-[#ffb95f]/20">
              <div className="bg-[#1a1a1a] rounded-[calc(1rem-1px)] p-10 h-full flex flex-col relative overflow-hidden">
                <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-secondary/10 blur-[60px] pointer-events-none" />
                <div className="flex items-center gap-4 mb-10 mt-4">
                  <div className="p-3 rounded-xl bg-secondary/10 text-emerald-400"><CheckCircle2 className="w-6 h-6" strokeWidth={1.5} /></div>
                  <h3 className="text-[1.5rem] font-extrabold text-stone-100" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.03em' }}>{t.comp_new_title}</h3>
                </div>

                <div className="flex-1 bg-white/[0.02] rounded-xl p-7 border border-white/[0.06] space-y-7 flex flex-col justify-center">
                  {[
                    { icon: <TrendingUp className="w-5 h-5" strokeWidth={1.5} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10', title: t.comp_roi_title, desc: t.comp_roi_desc },
                    { icon: <BrainCircuit className="w-5 h-5" strokeWidth={1.5} />, color: 'text-purple-400', bg: 'bg-purple-500/10', title: t.comp_brain_title, desc: t.comp_brain_desc },
                    { icon: <Star className="w-5 h-5" strokeWidth={1.5} />, color: 'text-[#ffb95f]', bg: 'bg-[#ffb95f]/10', title: t.comp_pro_title, desc: t.comp_pro_desc },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-start gap-4">
                      <div className={`p-2.5 rounded-xl ${item.bg} ${item.color} shrink-0`}>{item.icon}</div>
                      <div>
                        <h4 className="font-extrabold text-stone-100 text-[0.95rem]" style={{ fontFamily: "'Manrope', sans-serif" }}>{item.title}</h4>
                        <p className="text-sm text-stone-400 leading-[1.6] mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-10 pt-8 border-t border-white/5 text-center relative">
                  <div className="mb-6 group relative cursor-help">
                    <div className="text-lg font-bold text-stone-200">{t.comp_co2_new} <span className="text-sm font-normal text-stone-500">{t.comp_co2_new_unit}</span></div>
                    <p className="text-[0.75rem] text-emerald-400/80 mt-1 leading-snug">{t.comp_co2_new_note}</p>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-4 glass-card rounded-2xl text-[0.75rem] text-stone-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      {t.comp_co2_tooltip}
                      <div className="absolute bottom-[-5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-[#1a1a1a] rotate-45 border-b border-r border-white/10"></div>
                    </div>
                  </div>
                  <div className="pt-6 border-t border-white/5">
                    <p className="emerald-gradient-text text-sm font-bold uppercase tracking-[0.15em]" style={{ fontFamily: "'Manrope', sans-serif" }}>Pack Pro</p>
                    <div className="text-[3.2rem] font-black text-stone-50" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.04em' }}>
                      34€<span className="text-lg text-stone-600 font-medium">/mois</span>
                    </div>
                    <p className="text-emerald-400 text-[0.75rem] font-bold mt-2 flex items-center justify-center gap-1.5">
                      <Zap className="w-3.5 h-3.5" strokeWidth={1.5} />{t.comp_pack_tagline}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ═══ PRICING ═══ */}
      <motion.section id="pricing" initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.8 }} className="py-32 relative border-t border-white/5">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-secondary/5 rounded-full blur-[140px] pointer-events-none" />
        <div className="mx-auto max-w-7xl px-6 relative z-10">
          <div className="text-center mb-14">
            <h2 className="text-[2.5rem] sm:text-[3.5rem] font-extrabold text-stone-50 leading-[0.95]" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.04em' }}>{t.pricing_title}</h2>
            <p className="text-stone-500 mt-5 text-lg">{t.pricing_subtitle}</p>
            <p className="text-stone-100 mt-5 text-2xl font-extrabold" style={{ fontFamily: "'Manrope', sans-serif" }}>{t.pricing_trial}</p>
          </div>

          <div className="flex flex-col items-center mb-14">
            <div className="flex items-center justify-center gap-4">
              <span className={`text-sm font-medium cursor-pointer transition-colors ${billingCycle === 'monthly' ? 'text-stone-100' : 'text-stone-600'}`} onClick={() => setBillingCycle('monthly')}>{t.pricing_monthly}</span>
              <button onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')} className="relative w-14 h-7 bg-white/10 rounded-full p-1 transition-colors duration-300 focus:outline-none border border-white/[0.08]">
                <div className={`w-5 h-5 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(0,108,73,0.4)] transform transition-transform duration-300 ${billingCycle === 'yearly' ? 'translate-x-7' : 'translate-x-0'}`} />
              </button>
              <span className={`text-sm font-medium cursor-pointer transition-colors flex items-center gap-2 ${billingCycle === 'yearly' ? 'text-stone-100' : 'text-stone-600'}`} onClick={() => setBillingCycle('yearly')}>
                {t.pricing_yearly}
                <span className="bg-emerald-500/10 text-emerald-400 text-[0.65rem] font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/20">-25%</span>
              </span>
            </div>
          </div>

          <div className="max-w-lg mx-auto relative pt-4">
            <div className="absolute top-0 right-8 z-20">
              <span className="px-4 py-2 rounded-full premium-gradient text-white text-[0.68rem] font-extrabold uppercase tracking-[0.12em] shadow-[0_0_20px_rgba(0,108,73,0.25)]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                {t.pricing_launch_badge}
              </span>
            </div>
            <div className="relative rounded-2xl overflow-hidden p-[1px] bg-gradient-to-br from-secondary/50 via-purple-500/20 to-[#ffb95f]/30">
              <div className="bg-[#1a1a1a] rounded-[calc(1rem-1px)] p-10 sm:p-12 flex flex-col relative overflow-hidden">
                <div className="absolute -right-10 -top-10 w-48 h-48 bg-secondary/8 blur-[60px] pointer-events-none" />
                <div className="mb-8 relative z-10">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-2xl font-extrabold text-stone-50" style={{ fontFamily: "'Manrope', sans-serif" }}>PACK PRO</h3>
                    <Star className="h-5 w-5 text-[#ffb95f] fill-[#ffb95f] animate-pulse" />
                  </div>
                  <p className="text-stone-400 text-sm">{t.pricing_pack_desc}</p>
                  <div className="mt-5 flex items-baseline gap-2.5">
                    <span className="text-[3.5rem] font-extrabold text-stone-50" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.04em' }}>{calculatePrice(34)}€</span>
                    <span className="text-stone-600 line-through text-lg">69€</span>
                    <span className="text-stone-500">/mois</span>
                  </div>
                  {billingCycle === 'yearly' && <p className="text-[0.78rem] text-emerald-400 mt-2 font-semibold">{t.pricing_billed_yearly}</p>}
                </div>

                <ul className="space-y-4 mb-10 flex-1 relative z-10">
                  {[
                    { bold: t.pricing_feat1_bold, rest: t.pricing_feat1_rest },
                    { bold: t.pricing_feat2_bold, rest: t.pricing_feat2_rest },
                    { bold: t.pricing_feat3, rest: '' },
                    { bold: t.pricing_feat4_bold, rest: t.pricing_feat4_rest },
                    { bold: t.pricing_feat5_bold, rest: t.pricing_feat5_rest },
                    { bold: t.pricing_feat6_bold, rest: t.pricing_feat6_rest },
                    { bold: t.pricing_feat7_bold, rest: t.pricing_feat7_rest },
                    { bold: t.pricing_feat8, rest: '' },
                  ].map((feat, idx) => (
                    <li key={idx} className="flex gap-3 text-sm text-stone-300 font-medium">
                      <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" strokeWidth={1.5} />
                      <span><strong className="text-stone-100">{feat.bold}</strong>{feat.rest}</span>
                    </li>
                  ))}
                </ul>

                <Link to="/register" className="relative z-10 block w-full py-4 rounded-full bg-white text-[#111] font-bold text-center text-lg transition-all duration-300 hover:bg-secondary hover:text-white hover:shadow-[0_0_30px_rgba(0,108,73,0.3)]">
                  {t.pricing_cta}
                </Link>
                <p className="mt-5 text-[0.78rem] text-center text-stone-600">{t.pricing_no_card}</p>
                <p className="mt-3 text-[0.65rem] text-center text-stone-700">{t.pricing_climate}</p>
              </div>
            </div>
          </div>

          <div className="mt-10 flex justify-center">
            <div className="inline-flex items-center gap-4 px-6 py-4 glass-card rounded-2xl">
              <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400"><PlusCircle className="h-5 w-5" strokeWidth={1.5} /></div>
              <div className="text-left">
                <p className="text-sm font-bold text-stone-200">{t.pricing_voip_option}</p>
                <p className="text-[0.72rem] text-purple-400 font-bold uppercase tracking-[0.12em]">{t.pricing_voip_soon}</p>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Comparison Modal */}
      {isComparisonOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-[#1a1a1a] rounded-2xl border border-white/[0.08] shadow-[0_40px_80px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setIsComparisonOpen(false)} className="absolute top-5 right-5 p-2.5 text-stone-500 hover:text-stone-200 rounded-full hover:bg-white/5 transition-colors z-10">
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <PricingComparisonTable isModal={true} />
            <div className="p-6 bg-[#111] sticky bottom-0 text-center border-t border-white/5">
              <button onClick={() => setIsComparisonOpen(false)} className="px-7 py-2.5 bg-white hover:bg-stone-200 text-[#111] rounded-full font-bold text-sm transition-colors">
                {t.pricing_close_comparison}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ FAQ ═══ */}
      <motion.section id="faq" initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.8 }} className="py-32 relative border-t border-white/5">
        <div className="mx-auto max-w-3xl px-6 relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-[2.5rem] sm:text-[3rem] font-extrabold text-stone-50 leading-[0.95]" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.04em' }}>{t.faq_title}</h2>
            <p className="text-stone-500 mt-5">{t.faq_subtitle}</p>
          </div>
          <div className="space-y-3">
            <FAQItem question={t.faq1_q}><p>{t.faq1_a1}</p><p className="mt-3">{t.faq1_a2}</p></FAQItem>
            <FAQItem question={t.faq2_q}><p>{t.faq2_intro}</p><ul className="list-disc pl-5 mt-3 space-y-1.5"><li>{t.faq2_item1}</li><li>{t.faq2_item2}</li></ul></FAQItem>
            <FAQItem question={t.faq3_q}><p>{t.faq3_a1}</p><p className="mt-3">{t.faq3_a2}</p></FAQItem>
            <FAQItem question={t.faq4_q}><p>{t.faq4_a1}</p><p className="mt-3">{t.faq4_a2}</p></FAQItem>
            <FAQItem question={t.faq5_q}><p>{t.faq5_a1}</p><p className="mt-3">{t.faq5_a2}</p></FAQItem>
          </div>
        </div>
      </motion.section>

      {/* ═══ CTA FINAL ═══ */}
      <motion.section initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.8 }} className="relative py-32 overflow-hidden">
        <div className="absolute inset-0 bg-secondary/5 blur-[100px] rounded-full pointer-events-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        <div className="relative mx-auto max-w-4xl px-6 text-center z-10">
          <h2 className="text-[2.5rem] sm:text-[3.5rem] font-extrabold text-stone-50 leading-[0.95] mb-7" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.04em' }}>
            {t.cta_title_line1}<br />{t.cta_title_line2}
          </h2>
          <p className="text-xl text-stone-400 mb-12">{t.cta_subtitle}</p>
          <Link to="/register" className="inline-flex items-center gap-2 w-full sm:w-auto px-10 py-4 rounded-full bg-white text-[#111] font-extrabold text-lg hover:bg-secondary hover:text-white hover:shadow-[0_0_40px_rgba(0,108,73,0.3)] transition-all duration-300" style={{ fontFamily: "'Manrope', sans-serif" }}>
            {t.cta_btn}
            <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
          </Link>
          <p className="mt-7 text-sm text-stone-600">{t.cta_trial}</p>
        </div>
      </motion.section>

      {/* ═══ FOUNDER ═══ */}
      <section className="py-24 border-t border-white/5">
        <div className="max-w-4xl mx-auto px-6 flex flex-col md:flex-row items-start gap-10">
          <img src="https://qwjvdwpixewsctircibl.supabase.co/storage/v1/object/public/avatars/business-7d48e479-cede-480e-b405-39611a48d333-0.3286628360007747.jpg" alt="Thomas Shamoev, fondateur de CloseOS" width={120} height={120} loading="lazy" className="rounded-2xl w-28 h-28 object-cover flex-shrink-0" />
          <div>
            <p className="text-[0.72rem] font-extrabold text-emerald-400 uppercase tracking-[0.18em] mb-2" style={{ fontFamily: "'Manrope', sans-serif" }}>{t.founder_section_title}</p>
            <h2 className="text-[1.8rem] font-extrabold text-stone-50 mb-1" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.03em' }}>Thomas Shamoev</h2>
            <p className="text-emerald-400 text-sm font-semibold mb-5">{t.founder_role}</p>
            <p className="text-stone-400 leading-[1.75]">{t.founder_bio}</p>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-white/5 py-8 pb-20">
        <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-5">
          <img src="/logo-sales.png" alt="CloseOS Logo" className="h-6 w-auto" loading="lazy" width={72} height={24} />
          <div className="flex flex-wrap justify-center gap-4 text-[0.72rem] text-stone-600">
            <span>© 2026 CloseOS.fr</span>
            <span className="hidden sm:inline text-stone-800">·</span>
            <a href="/mentions-legales" className="hover:text-stone-200 transition-colors">{t.footer_legal}</a>
            <span className="hidden sm:inline text-stone-800">·</span>
            <a href="/cgu" className="hover:text-stone-200 transition-colors">{t.footer_cgu}</a>
            <span className="hidden sm:inline text-stone-800">·</span>
            <a href="/cgv" className="hover:text-stone-200 transition-colors">{t.footer_cgv}</a>
            <span className="hidden sm:inline text-stone-800">·</span>
            <a href="/confidentialite" className="hover:text-stone-200 transition-colors">{t.footer_privacy}</a>
          </div>
          <div className="flex gap-6 text-[0.72rem]">
            <a href="https://www.linkedin.com/in/thomas-shamoev-570885237/" target="_blank" rel="noopener noreferrer" className="text-stone-600 hover:text-stone-200 transition-colors">LinkedIn</a>
            <a href="mailto:support@closeos.fr" className="text-stone-600 hover:text-stone-200 transition-colors">support@closeos.fr</a>
          </div>
        </div>
      </footer>

      <div className="fixed bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#111111] via-[#111111]/80 to-transparent pointer-events-none z-[80]" />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');

        @keyframes pageEnterFromTop {
          from { opacity: 0; transform: translateY(-60px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes marquee-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .marquee-track {
          display: flex;
          width: max-content;
          animation: marquee-scroll var(--marquee-speed, 30s) linear infinite;
        }
        .marquee-container:hover .marquee-track {
          animation-duration: 40s;
        }
        .glass-card {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(16px);
          border: 0.5px solid rgba(196, 199, 199, 0.1);
        }
        .premium-gradient {
          background: linear-gradient(135deg, #006c49 0%, #a855f7 100%);
        }
        .emerald-gradient-text {
          background: linear-gradient(135deg, #006c49 0%, #6cf8bb 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  )
}
