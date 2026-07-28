import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
  ClipboardList,
  DollarSign,
  Globe,
  ShieldCheck,
  XCircle,
  Check,
  Gift,
  Copy,
  Paperclip,
  Send,
  Handshake,
} from 'lucide-react';
import { translations, detectLang, LangContext, useLang } from './crmLandingI18n';
import type { Lang } from './crmLandingI18n';

const CRMLanding: React.FC = () => {
  const navigate = useNavigate();
  const pageRef = useRef<HTMLDivElement>(null);
  const demoIframeRef = useRef<HTMLIFrameElement>(null);
  const [isExiting, setIsExiting] = useState(false);
  // WaitingListModal removed, replaced with direct checkout links
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showDemoPopup, setShowDemoPopup] = useState(false);
  const demoPopupIframeRef = useRef<HTMLIFrameElement>(null);
  const [lang, setLang] = useState<Lang>('fr');
  const t = translations[lang];

  useEffect(() => {
    setLang(detectLang());

    // Capture referral parameter and set cookie
    const refParam = new URLSearchParams(window.location.search).get('ref');
    if (refParam) {
      document.cookie = `closeos_ref=${refParam}; path=/; max-age=2592000; SameSite=Lax`;
      fetch('/api/business-referral?action=track-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: refParam }),
      }).catch(() => {});
    }
  }, []);

  // Dynamic iframe height from embed postMessage
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'closeos-capture-resize') {
        if (demoIframeRef.current) demoIframeRef.current.style.height = `${e.data.height}px`;
        if (demoPopupIframeRef.current) demoPopupIframeRef.current.style.height = `${e.data.height}px`;
      }
      if (e.data === 'closeos-capture-done' && demoPopupIframeRef.current) {
        demoPopupIframeRef.current.style.height = '120px';
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Demo popup after 45s (once per session)
  useEffect(() => {
    if (sessionStorage.getItem('closeos_demo_popup_shown')) return;
    const timer = setTimeout(() => {
      setShowDemoPopup(true);
      sessionStorage.setItem('closeos_demo_popup_shown', '1');
    }, 45000);
    return () => clearTimeout(timer);
  }, []);

  const handleNavigateToSales = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsExiting(true);
    setTimeout(() => navigate('/landing'), 500);
  };

  const handleNavigateToBusiness = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsExiting(true);
    setTimeout(() => navigate('/business'), 500);
  };

  const handleNavigateToSign = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsExiting(true);
    setTimeout(() => navigate('/sign'), 500);
  };

  // SEO meta tags for Business landing
  useEffect(() => {
    // Title & Description
    document.title = t.seo_title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', t.seo_description);

    // Canonical & Open Graph
    document.getElementById('canonical')?.setAttribute('href', 'https://www.closeos.fr/crm');
    document.getElementById('og-url')?.setAttribute('content', 'https://www.closeos.fr/crm');
    document.getElementById('og-title')?.setAttribute('content', t.seo_og_title);
    document.getElementById('og-description')?.setAttribute('content', t.seo_og_description);
    document.getElementById('og-image')?.setAttribute('content', 'https://www.closeos.fr/og-business.png');

    // Twitter Card
    document.getElementById('tw-url')?.setAttribute('content', 'https://www.closeos.fr/crm');
    document.getElementById('tw-title')?.setAttribute('content', t.seo_og_title);
    document.getElementById('tw-description')?.setAttribute('content', t.seo_og_description);
    document.getElementById('tw-image')?.setAttribute('content', 'https://www.closeos.fr/og-business.png');
    document.documentElement.lang = lang;

    // hreflang tags
    document.querySelectorAll('link[data-hreflang]').forEach(el => el.remove());
    const hreflangs = [
      { lang: 'fr', href: 'https://www.closeos.fr/crm' },
      { lang: 'en', href: 'https://www.closeos.fr/crm?lang=en' },
      { lang: 'x-default', href: 'https://www.closeos.fr/crm' },
    ];
    hreflangs.forEach(({ lang: hl, href }) => {
      const link = document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = hl;
      link.href = href;
      link.setAttribute('data-hreflang', 'true');
      document.head.appendChild(link);
    });

    // WebApplication Schema
    const existingLd = document.querySelector('script[data-closeos-biz-ld]');
    if (existingLd) existingLd.remove();
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-closeos-biz-ld', 'true');
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'CloseOS CRM',
      url: 'https://www.closeos.fr/crm',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description: t.sd_description,
      offers: {
        '@type': 'AggregateOffer',
        lowPrice: '0',
        highPrice: '99',
        priceCurrency: 'EUR',
        availability: 'https://schema.org/InStock',
        offerCount: '3',
      },
      featureList: t.sd_feature_list,
      inLanguage: lang,
    });
    document.head.appendChild(script);

    // FAQ structured data for GEO
    const existingFaqLd = document.querySelector('script[data-closeos-biz-faq-ld]');
    if (existingFaqLd) existingFaqLd.remove();
    const faqScript = document.createElement('script');
    faqScript.type = 'application/ld+json';
    faqScript.setAttribute('data-closeos-biz-faq-ld', 'true');
    faqScript.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: t.sd_faq_who_q,
          acceptedAnswer: {
            '@type': 'Answer',
            text: t.sd_faq_who_a,
          },
        },
        {
          '@type': 'Question',
          name: t.sd_faq_compat_q,
          acceptedAnswer: {
            '@type': 'Answer',
            text: t.sd_faq_compat_a,
          },
        },
        {
          '@type': 'Question',
          name: t.sd_faq_why_crm_q,
          acceptedAnswer: {
            '@type': 'Answer',
            text: t.sd_faq_why_crm_a,
          },
        },
        {
          '@type': 'Question',
          name: t.sd_faq_data_access_q,
          acceptedAnswer: {
            '@type': 'Answer',
            text: t.sd_faq_data_access_a,
          },
        },
        {
          '@type': 'Question',
          name: t.sd_faq_what_q,
          acceptedAnswer: {
            '@type': 'Answer',
            text: t.sd_faq_what_a,
          },
        },
        {
          '@type': 'Question',
          name: t.sd_faq_how_many_q,
          acceptedAnswer: {
            '@type': 'Answer',
            text: t.sd_faq_how_many_a,
          },
        },
        {
          '@type': 'Question',
          name: t.sd_faq_gdpr_q,
          acceptedAnswer: {
            '@type': 'Answer',
            text: t.sd_faq_gdpr_a,
          },
        },
      ],
    });
    document.head.appendChild(faqScript);

    // BreadcrumbList
    const existingBreadcrumb = document.querySelector('script[data-closeos-biz-breadcrumb-ld]');
    if (existingBreadcrumb) existingBreadcrumb.remove();
    const breadcrumbScript = document.createElement('script');
    breadcrumbScript.type = 'application/ld+json';
    breadcrumbScript.setAttribute('data-closeos-biz-breadcrumb-ld', 'true');
    breadcrumbScript.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'CloseOS', item: 'https://www.closeos.fr' },
        { '@type': 'ListItem', position: 2, name: 'CloseOS CRM', item: 'https://www.closeos.fr/crm' },
      ],
    });
    document.head.appendChild(breadcrumbScript);

    document.querySelector('script[data-closeos-biz-person-ld]')?.remove();
    const personScript = document.createElement('script');
    personScript.type = 'application/ld+json';
    personScript.setAttribute('data-closeos-biz-person-ld', 'true');
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
      // Restore defaults
      document.title = t.seo_default_title;
      document.querySelector('meta[name="description"]')?.setAttribute('content', t.seo_default_description);
      document.getElementById('canonical')?.setAttribute('href', 'https://www.closeos.fr/');
      document.getElementById('og-url')?.setAttribute('content', 'https://www.closeos.fr/');
      document.getElementById('og-title')?.setAttribute('content', t.seo_default_og_title);
      document.getElementById('og-description')?.setAttribute('content', t.seo_default_og_description);
      document.getElementById('og-image')?.setAttribute('content', 'https://www.closeos.fr/og-eco.png');
      document.getElementById('tw-url')?.setAttribute('content', 'https://www.closeos.fr/');
      document.getElementById('tw-title')?.setAttribute('content', t.seo_default_og_title);
      document.getElementById('tw-description')?.setAttribute('content', t.seo_default_og_description);
      document.getElementById('tw-image')?.setAttribute('content', 'https://www.closeos.fr/og-eco.png');
      document.querySelector('script[data-closeos-biz-ld]')?.remove();
      document.querySelector('script[data-closeos-biz-faq-ld]')?.remove();
      document.querySelector('script[data-closeos-biz-breadcrumb-ld]')?.remove();
      document.querySelector('script[data-closeos-biz-person-ld]')?.remove();
      document.querySelectorAll('link[data-hreflang]').forEach(el => el.remove());
    };
  }, [lang]);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);

    // Chatbot initialization (deferred 5s)
    let chatbotScript: HTMLScriptElement | null = null;
    const chatbotTimer = setTimeout(() => {
      chatbotScript = document.createElement('script');
      chatbotScript.src = '/chatbot-widget.js';
      chatbotScript.setAttribute('data-chatbot-id', 'acb35233-a6de-4738-9ba0-7e25c82c2a61');
      chatbotScript.setAttribute('data-supabase-url', 'https://mkxcircbzcsjamslijde.supabase.co');
      chatbotScript.setAttribute('data-supabase-key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1reGNpcmNiemNzamFtc2xpamRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MjM0MDAsImV4cCI6MjA4NzQ5OTQwMH0.9-abq1tEFsmjfRkLJjrkXlG3z-9o2HKYjyp5eBIl178');
      chatbotScript.setAttribute('data-lang', lang);
      document.body.appendChild(chatbotScript);
    }, 5000);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(chatbotTimer);
      if (chatbotScript && document.body.contains(chatbotScript)) {
        document.body.removeChild(chatbotScript);
      }
      const chatbotContainer = document.getElementById('chatbot-widget-container');
      if (chatbotContainer) {
        chatbotContainer.remove();
      }
    };
  }, [lang]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
    <div ref={pageRef} className={`bg-white font-sans text-[#0A0E27] min-h-screen selection:bg-[#60A5FA]/30 transition-all duration-500 ${isExiting ? 'translate-y-full opacity-0' : 'animate-[pageEnterFromTop_0.5s_ease-out]'}`}>

      {/* Navigation, flat sticky bar */}
      <nav className="sticky top-0 z-50 border-b border-blue-100/70 bg-white/85 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-10">
            <div className="relative group flex items-center gap-1 cursor-pointer">
              <img
                alt="CloseOS CRM"
                className="w-auto object-contain h-9"
                src="/closeos-crm.png"
                fetchPriority="high"
                width={140}
                height={36}
              />
              <ChevronDown className="h-4 w-4 text-stone-400 group-hover:text-blue-600 transition-all duration-300 group-hover:rotate-180" />
              <div className="absolute top-full left-0 mt-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 translate-y-2 group-hover:translate-y-0 flex flex-col gap-2 w-56">
                <a onClick={handleNavigateToSales} className="block rounded-xl border border-white/10 bg-[#020617] px-4 py-3 shadow-xl hover:bg-[#0f172a] transition-colors cursor-pointer">
                  <img src="/logo-sales.png" alt="CloseOS Sales" className="w-full h-auto object-contain" loading="lazy" width={220} height={56} />
                </a>
                <a onClick={handleNavigateToBusiness} className="block rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-xl hover:bg-blue-50/50 transition-colors cursor-pointer">
                  <img src="/closeos-business-logo-ecrit.png" alt="CloseOS Business" className="w-full h-auto object-contain" loading="lazy" width={220} height={56} />
                </a>
                <a onClick={handleNavigateToSign} className="block rounded-xl border border-white/10 bg-[#191E1E] px-4 py-3 shadow-xl hover:bg-[#222828] transition-colors cursor-pointer">
                  <img src="/CLOSEOS-SIGN-LOGO.png" alt="CloseOS Sign" className="w-full h-auto object-contain" loading="lazy" width={220} height={56} />
                </a>
              </div>
            </div>

            <div className="hidden lg:flex items-center gap-7 text-sm font-medium text-stone-600">
              <a href="#features" className="relative hover:text-[#0A0E27] transition-colors after:absolute after:left-0 after:bottom-[-6px] after:h-[2px] after:w-0 hover:after:w-full after:bg-blue-500 after:transition-all">{t.nav_management}</a>
              <a href="#showcase" className="relative hover:text-[#0A0E27] transition-colors after:absolute after:left-0 after:bottom-[-6px] after:h-[2px] after:w-0 hover:after:w-full after:bg-blue-500 after:transition-all">{t.nav_crm}</a>
              <a href="#integrations" className="relative hover:text-[#0A0E27] transition-colors after:absolute after:left-0 after:bottom-[-6px] after:h-[2px] after:w-0 hover:after:w-full after:bg-blue-500 after:transition-all">API</a>
              <a href="#demo" className="relative hover:text-[#0A0E27] transition-colors after:absolute after:left-0 after:bottom-[-6px] after:h-[2px] after:w-0 hover:after:w-full after:bg-blue-500 after:transition-all">{t.nav_demo}</a>
              <a href="#pricing" className="relative hover:text-[#0A0E27] transition-colors after:absolute after:left-0 after:bottom-[-6px] after:h-[2px] after:w-0 hover:after:w-full after:bg-blue-500 after:transition-all">{t.nav_pricing}</a>
              <a href="#faq" className="relative hover:text-[#0A0E27] transition-colors after:absolute after:left-0 after:bottom-[-6px] after:h-[2px] after:w-0 hover:after:w-full after:bg-blue-500 after:transition-all">{t.nav_faq}</a>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
              className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors text-stone-500"
              aria-label="Change language"
            >
              <Globe className="size-4" />
              <span className="text-xs font-bold uppercase">{lang === 'fr' ? 'EN' : 'FR'}</span>
            </button>
            <Link
              to="/crm/login"
              className="hidden sm:flex items-center justify-center px-4 h-9 text-stone-700 text-sm font-semibold hover:text-[#0A0E27] transition-all"
            >
              {lang === 'fr' ? 'Se connecter' : 'Log in'}
            </Link>
            <a
              href="#pricing"
              className="hidden sm:inline-flex items-center justify-center gap-1.5 rounded-full h-9 px-4 text-white text-sm font-bold transition-all bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] hover:from-[#2563EB] hover:to-[#3B82F6] hover:-translate-y-0.5 shadow-md shadow-blue-500/25"
            >
              {lang === 'fr' ? 'Commencer' : 'Get started'}
              <ArrowRight className="size-3.5" />
            </a>
            <button
              onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
              className="md:hidden p-2 text-stone-600"
              aria-label="Change language"
            >
              <Globe className="size-5" />
            </button>
            <button className="lg:hidden p-2 text-stone-600" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} aria-label="Menu" aria-expanded={isMobileMenuOpen}>
              {isMobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-blue-100/70 bg-white px-6 py-5 flex flex-col gap-4 text-sm font-medium text-stone-600">
            <a href="#features" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-[#0A0E27] transition-colors">{t.nav_management}</a>
            <a href="#showcase" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-[#0A0E27] transition-colors">{t.nav_crm}</a>
            <a href="#integrations" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-[#0A0E27] transition-colors">API</a>
            <a href="#demo" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-[#0A0E27] transition-colors">{t.nav_demo}</a>
            <a href="#pricing" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-[#0A0E27] transition-colors">{t.nav_pricing}</a>
            <a href="#faq" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-[#0A0E27] transition-colors">{t.nav_faq}</a>
            <Link
              to="/crm/login"
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-stone-700 font-semibold sm:hidden"
            >
              {lang === 'fr' ? 'Se connecter' : 'Log in'}
            </Link>
            <a
              href="#pricing"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center justify-center rounded-full h-11 px-5 text-white text-sm font-bold bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] sm:hidden"
            >
              {lang === 'fr' ? 'Commencer' : 'Get started'}
            </a>
          </div>
        )}
      </nav>

      <main className="flex flex-col flex-1">
        {/* ───────── HERO, Asymmetric, mockup-driven ───────── */}
        <section className="relative px-6 md:px-12 pt-16 md:pt-24 pb-20 md:pb-28 overflow-hidden">
          {/* Background, soft blue mesh + grid */}
          <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -top-32 right-0 w-[700px] h-[700px] bg-[radial-gradient(circle,_rgba(96,165,250,0.22),transparent_60%)] blur-2xl" />
            <div className="absolute top-40 -left-32 w-[500px] h-[500px] bg-[radial-gradient(circle,_rgba(59,130,246,0.15),transparent_60%)] blur-2xl" />
            <div className="absolute inset-0 opacity-[0.04]" style={{
              backgroundImage: 'linear-gradient(to right, #0f172a 1px, transparent 1px), linear-gradient(to bottom, #0f172a 1px, transparent 1px)',
              backgroundSize: '40px 40px',
              maskImage: 'linear-gradient(to bottom, black 20%, transparent 90%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 20%, transparent 90%)',
            }} />
          </div>

          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* LEFT, Title block */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="lg:col-span-7 space-y-8"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-white/60 backdrop-blur-md pl-2 pr-4 py-1.5 shadow-sm">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
                  <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                  {lang === 'fr' ? 'Nouveau' : 'New'}
                </span>
                <span className="text-xs font-medium text-stone-700">
                  {lang === 'fr' ? 'Avec ' : 'With '}<span className="font-bold text-[#0A0E27]">{lang === 'fr' ? '14 jours gratuits' : '14 free days'}</span>
                  {lang === 'fr' ? ', annulable à tout moment' : ', cancel anytime'}
                </span>
              </div>

              <h1 className="text-[clamp(2.75rem,6.5vw,5rem)] font-bold leading-[0.98] tracking-[-0.02em] text-[#0A0E27]">
                {lang === 'fr' ? 'Le CRM ' : 'The CRM '}
                <span className="relative inline-block">
                  <span className="bg-gradient-to-r from-[#3B82F6] via-[#60A5FA] to-[#7DD3FC] bg-clip-text text-transparent">
                    {lang === 'fr' ? 'tout-en-un' : 'all-in-one'}
                  </span>
                  <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" preserveAspectRatio="none" fill="none">
                    <path d="M2 9 Q 75 2, 150 6 T 298 4" stroke="#60A5FA" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </span>
                <br/>
                {lang === 'fr' ? 'pour entrepreneurs.' : 'for entrepreneurs.'}
              </h1>

              <p className="text-stone-600 text-lg md:text-xl leading-relaxed max-w-xl">
                {lang === 'fr'
                  ? 'CRM, Pipeline, Campagnes Stripe, Acquisition analytics, API Zapier/Make/N8N, sans jongler entre 6 outils.'
                  : 'CRM, Pipeline, Stripe campaigns, Acquisition analytics, Zapier/Make/N8N API, without juggling 6 tools.'}
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <a
                  href="#pricing"
                  className="group inline-flex items-center justify-center gap-2 rounded-full h-12 px-7 text-white text-sm font-bold transition-all bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] hover:from-[#2563EB] hover:to-[#3B82F6] hover:-translate-y-0.5 shadow-xl shadow-blue-500/30 hover:shadow-blue-500/50"
                >
                  {lang === 'fr' ? 'Commencer · 49€/mois' : 'Get started · €49/mo'}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </a>
                <a
                  href="#demo"
                  className="inline-flex items-center justify-center gap-2 rounded-full h-12 px-6 text-[#0A0E27] text-sm font-bold border border-blue-200 bg-white hover:bg-blue-50 hover:border-blue-300 transition-all"
                >
                  <Video className="size-4 text-blue-500" />
                  {lang === 'fr' ? 'Voir la démo' : 'See the demo'}
                </a>
              </div>

              <div className="flex items-center gap-5 text-xs text-stone-500 font-medium pt-2">
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-yellow-400">★★★★★</span> 4.9
                </span>
                <span className="w-px h-3 bg-stone-200" />
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 text-emerald-500" /> RGPD
                </span>
                <span className="w-px h-3 bg-stone-200" />
                <span>{t.hero_social_proof_count}+ {lang === 'fr' ? 'entrepreneurs' : 'entrepreneurs'}</span>
              </div>
            </motion.div>

            {/* RIGHT, Floating dashboard mockup */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-5 relative"
            >
              <div className="relative">
                {/* Glow */}
                <div className="absolute -inset-4 bg-gradient-to-tr from-[#3B82F6]/20 via-[#60A5FA]/30 to-[#7DD3FC]/20 rounded-[2rem] blur-2xl" />

                {/* Dashboard card */}
                <div className="relative rounded-[1.75rem] bg-white border border-blue-100 shadow-2xl shadow-blue-500/10 overflow-hidden">
                  {/* Header */}
                  <div className="px-5 py-3 border-b border-blue-50 flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-stone-200" />
                      <span className="w-2.5 h-2.5 rounded-full bg-stone-200" />
                      <span className="w-2.5 h-2.5 rounded-full bg-stone-200" />
                    </div>
                    <div className="ml-3 flex items-center gap-1.5 px-3 py-1 rounded-md bg-blue-50/70 text-[10px] font-semibold text-blue-700">
                      <Globe className="size-3" /> app.closeos.fr/crm
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-5 space-y-4 bg-gradient-to-br from-white to-blue-50/30">
                    {/* KPI row */}
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Pipeline', value: '€48K', trend: '+12%' },
                        { label: 'RDV', value: '23', trend: '+5' },
                        { label: 'Closé', value: '8', trend: '+2' },
                      ].map((k, i) => (
                        <div key={i} className="rounded-xl border border-blue-100 bg-white p-3">
                          <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">{k.label}</p>
                          <p className="text-xl font-extrabold text-[#0A0E27] mt-1" style={{ fontFamily: 'Manrope, sans-serif' }}>{k.value}</p>
                          <p className="text-[10px] font-bold text-emerald-600 mt-0.5">{k.trend}</p>
                        </div>
                      ))}
                    </div>

                    {/* Pipeline preview */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold text-[#0A0E27]" style={{ fontFamily: 'Manrope, sans-serif' }}>Pipeline · cette semaine</p>
                        <span className="text-[10px] font-semibold text-blue-600">Voir tout →</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { stage: 'Nouveau', count: 12, color: 'bg-blue-100 text-blue-700' },
                          { stage: 'Contacté', count: 8, color: 'bg-amber-50 text-amber-700' },
                          { stage: 'RDV pris', count: 5, color: 'bg-emerald-50 text-emerald-700' },
                        ].map((s, i) => (
                          <div key={i} className="rounded-lg border border-blue-50 bg-white/80 p-2.5">
                            <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">{s.stage}</p>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-lg font-extrabold text-[#0A0E27]">{s.count}</span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${s.color}`}>HOT</span>
                            </div>
                            <div className="mt-2 space-y-1">
                              <div className="h-1.5 rounded-full bg-blue-100/70" />
                              <div className="h-1.5 rounded-full bg-blue-100/40 w-3/4" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Activity row */}
                    <div className="rounded-xl border border-blue-100 bg-white p-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#60A5FA] flex items-center justify-center text-white text-xs font-bold shrink-0">JD</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-[#0A0E27] truncate">Jean D. · RDV programmé</p>
                        <p className="text-[10px] text-stone-500">Demain · 14h00 · Discovery call</p>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Auto</span>
                    </div>
                  </div>
                </div>

                {/* Floating ribbon, Stripe payment */}
                <div className="absolute -bottom-4 -left-6 hidden md:flex items-center gap-2 rounded-2xl bg-white border border-blue-100 shadow-xl shadow-blue-500/10 px-4 py-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#60A5FA] flex items-center justify-center">
                    <DollarSign className="size-4 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#0A0E27]">+ €1 250</p>
                    <p className="text-[10px] text-stone-500">Stripe · Setup fee</p>
                  </div>
                </div>

                {/* Floating ribbon, Webhook */}
                <div className="absolute -top-4 -right-4 hidden md:flex items-center gap-2 rounded-2xl bg-white border border-blue-100 shadow-xl shadow-blue-500/15 px-4 py-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#60A5FA] to-[#7DD3FC] flex items-center justify-center">
                    <Zap className="size-4 text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Webhook</p>
                    <p className="text-xs font-bold text-[#0A0E27]">prospect.created</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ───────── STATS BAR ───────── */}
        <section className="border-y border-blue-100/60 bg-gradient-to-r from-blue-50/50 via-white to-blue-50/50">
          <div className="max-w-7xl mx-auto px-6 md:px-12 py-10 grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {[
              { v: '49€', l: lang === 'fr' ? 'Plan unique · /mois' : 'Single plan · /mo' },
              { v: '14j', l: lang === 'fr' ? 'Essai gratuit' : 'Free trial' },
              { v: '∞', l: lang === 'fr' ? 'Prospects & campagnes' : 'Prospects & campaigns' },
              { v: '2 min', l: lang === 'fr' ? 'Setup express' : 'Express setup' },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <p className="text-3xl md:text-4xl font-black tracking-tight bg-gradient-to-br from-[#3B82F6] to-[#60A5FA] bg-clip-text text-transparent" style={{ fontFamily: 'Manrope, sans-serif' }}>{s.v}</p>
                <p className="text-xs md:text-sm font-medium text-stone-500 mt-1">{s.l}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ───────── BENTO FEATURES ───────── */}
        <section id="features" className="px-6 md:px-12 py-24 md:py-32">
          <div className="max-w-7xl mx-auto">
            <div className="max-w-2xl mb-14">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-600 mb-4">
                {lang === 'fr' ? 'Tout dans un seul outil' : 'All in one place'}
              </p>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-[#0A0E27] leading-[1.05]">
                {lang === 'fr' ? 'Une stack complète. ' : 'A full stack. '}
                <span className="text-stone-400">{lang === 'fr' ? 'Zéro friction.' : 'Zero friction.'}</span>
              </h2>
            </div>

            {/* Bento grid, asymmetric */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 auto-rows-[200px]">
              {/* Card 1, CRM (large) */}
              <div className="md:col-span-4 md:row-span-2 group relative overflow-hidden rounded-3xl bg-gradient-to-br from-white to-blue-50/40 border border-blue-100 p-7 hover:border-blue-300 transition-all">
                <div className="absolute -top-20 -right-20 w-72 h-72 bg-gradient-to-br from-blue-400/15 to-sky-400/15 rounded-full blur-3xl" />
                <div className="relative h-full flex flex-col">
                  <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#60A5FA] shadow-lg shadow-blue-500/30 mb-5">
                    <Users className="size-5 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-[#0A0E27] tracking-tight mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {lang === 'fr' ? 'CRM illimité' : 'Unlimited CRM'}
                  </h3>
                  <p className="text-sm text-stone-600 leading-relaxed max-w-md mb-5">
                    {lang === 'fr'
                      ? 'Tous vos prospects, toutes leurs interactions, dans un seul espace. Imports Hubspot, Pipedrive, GoHighLevel, Airtable.'
                      : 'All your prospects, all their interactions, in one place. Imports from Hubspot, Pipedrive, GoHighLevel, Airtable.'}
                  </p>
                  <div className="mt-auto grid grid-cols-2 gap-2 max-w-sm">
                    {[
                      { name: 'Hubspot', src: '/hubspot.png' },
                      { name: 'Pipedrive', src: '/pipedrive.png' },
                    ].map((b) => (
                      <div key={b.name} className="rounded-lg bg-white border border-blue-100 px-3 py-2 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span className="text-xs font-semibold text-stone-700">{b.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card 2, Pipeline */}
              <div className="md:col-span-2 group relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-50 to-sky-100/60 border border-blue-100 p-6 hover:scale-[1.02] transition-transform">
                <div className="absolute -bottom-12 -right-12 w-40 h-40 bg-blue-300/20 rounded-full blur-2xl" />
                <div className="relative h-full flex flex-col justify-between">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-blue-100 shadow-sm">
                    <Layers className="size-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#0A0E27] tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                      {lang === 'fr' ? 'Pipeline Kanban' : 'Kanban Pipeline'}
                    </h3>
                    <p className="text-xs text-stone-600 mt-1">{lang === 'fr' ? 'Stages personnalisables, drag & drop' : 'Custom stages, drag & drop'}</p>
                  </div>
                </div>
              </div>

              {/* Card 3, Stripe */}
              <div className="md:col-span-2 group relative overflow-hidden rounded-3xl bg-white border border-blue-100 p-6 hover:shadow-xl hover:shadow-blue-500/10 transition-all">
                <div className="h-full flex flex-col justify-between">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 border border-blue-100">
                    <DollarSign className="size-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#0A0E27] tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                      {lang === 'fr' ? 'Campagnes payantes' : 'Paid campaigns'}
                    </h3>
                    <p className="text-xs text-stone-500 mt-1">{lang === 'fr' ? 'Stripe intégré · avant ou après inscription' : 'Stripe integrated · before or after signup'}</p>
                  </div>
                </div>
              </div>

              {/* Card 4, Acquisition */}
              <div className="md:col-span-3 group relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#3B82F6] via-[#60A5FA] to-[#7DD3FC] text-white p-7 hover:scale-[1.01] transition-transform">
                <div className="h-full flex flex-col justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <BarChart3 className="size-5 text-white" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/80 bg-white/15 backdrop-blur-sm px-2 py-1 rounded-full">{lang === 'fr' ? 'Inclus' : 'Included'}</span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                      {lang === 'fr' ? 'Acquisition analytics' : 'Acquisition analytics'}
                    </h3>
                    <p className="text-sm text-white/90 mt-1 max-w-xs">
                      {lang === 'fr' ? 'UTM, ROI par campagne, source par prospect, funnel complet.' : 'UTM, ROI per campaign, source per prospect, full funnel.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Card 5, API */}
              <div className="md:col-span-3 group relative overflow-hidden rounded-3xl bg-white border border-blue-100 p-6 hover:shadow-xl hover:shadow-blue-500/10 transition-all">
                <div className="h-full flex flex-col justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 border border-blue-100">
                      <Zap className="size-5 text-blue-600" />
                    </div>
                    <div className="flex gap-1.5">
                      <img src="/zapier.webp" alt="Zapier" className="h-5 w-5 object-contain" loading="lazy" />
                      <img src="/make.webp" alt="Make" className="h-5 w-5 object-contain" loading="lazy" />
                      <img src="/n8n.webp" alt="n8n" className="h-5 w-5 object-contain" loading="lazy" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#0A0E27] tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                      {lang === 'fr' ? 'API REST + Webhooks signés' : 'REST API + signed Webhooks'}
                    </h3>
                    <p className="text-xs text-stone-500 mt-1">{lang === 'fr' ? 'HMAC-SHA256 · Zapier, Make, N8N natifs' : 'HMAC-SHA256 · native Zapier, Make, N8N'}</p>
                    <a href="#integrations" className="inline-flex items-center gap-1 mt-2 text-xs font-bold text-blue-600 hover:text-blue-700">
                      {lang === 'fr' ? 'Voir la doc' : 'See docs'} <ArrowRight className="size-3" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ───────── SHOWCASE, Lead Profile (kept as-is) ───────── */}
        <section id="showcase" className="px-6 md:px-12 py-24 md:py-32 bg-gradient-to-b from-white via-blue-50/40 to-white">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
              <div className="lg:col-span-5 space-y-5">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-600">
                  {lang === 'fr' ? 'Vue prospect' : 'Prospect view'}
                </p>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-[#0A0E27] leading-[1.05]">
                  {lang === 'fr' ? 'Tout sur vos prospects, ' : 'Everything about your prospects, '}
                  <span className="text-blue-600">{lang === 'fr' ? 'd\'un coup d\'œil.' : 'at a glance.'}</span>
                </h2>
                <p className="text-stone-600 text-lg leading-relaxed">
                  {lang === 'fr'
                    ? 'Score de qualification, dernières interactions, notes, RDV planifiés, paiements Stripe, tout est centralisé sur la fiche du prospect.'
                    : 'Qualification score, latest interactions, notes, scheduled meetings, Stripe payments, everything is centralized on the prospect card.'}
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  {(lang === 'fr' ? ['Score auto', 'Tags', 'Notes riches', 'Historique', 'Stripe'] : ['Auto score', 'Tags', 'Rich notes', 'History', 'Stripe']).map((t) => (
                    <span key={t} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-blue-100 bg-white text-xs font-semibold text-stone-700">
                      <Check className="size-3 text-blue-500" /> {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="lg:col-span-7">
                <LeadProfile />
              </div>
            </div>
          </div>
        </section>

        {/* ───────── INTEGRATIONS, Code-card style ───────── */}
        <section id="integrations" className="px-6 md:px-12 py-24 md:py-32">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-600">
                  {lang === 'fr' ? 'Connectez tout' : 'Connect everything'}
                </p>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-[#0A0E27] leading-[1.05]">
                  {lang === 'fr' ? 'API REST + Webhooks ' : 'REST API + '}
                  <span className="bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] bg-clip-text text-transparent">{lang === 'fr' ? 'signés HMAC' : 'HMAC-signed Webhooks'}</span>.
                </h2>
                <p className="text-stone-600 text-lg leading-relaxed">
                  {lang === 'fr'
                    ? 'API publique pour lire/écrire vos données. Webhooks sortants signés sur prospect.created, stage_changed, appointment.booked, lead_captured.'
                    : 'Public API to read/write your data. Outbound webhooks signed on prospect.created, stage_changed, appointment.booked, lead_captured.'}
                </p>
                <div className="grid grid-cols-3 gap-2 pt-2">
                  {[
                    { name: 'Zapier', logo: '/zapier.webp' },
                    { name: 'Make', logo: '/make.webp' },
                    { name: 'n8n', logo: '/n8n.webp' },
                  ].map((i) => (
                    <div key={i.name} className="rounded-2xl border border-blue-100 bg-white p-4 flex flex-col items-center gap-2 hover:border-blue-300 hover:shadow-md transition-all">
                      <img src={i.logo} alt={i.name} className="h-8 w-8 object-contain" loading="lazy" />
                      <span className="text-xs font-bold text-[#0A0E27]">{i.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Code card, light style */}
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-br from-[#60A5FA]/20 to-[#7DD3FC]/25 rounded-[2rem] blur-2xl" />
                <div className="relative rounded-2xl bg-white border border-blue-100 shadow-2xl shadow-blue-500/15 overflow-hidden">
                  <div className="px-4 py-3 border-b border-blue-50 bg-blue-50/40 flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-300" />
                      <span className="w-2.5 h-2.5 rounded-full bg-yellow-300" />
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-300" />
                    </div>
                    <span className="text-[10px] font-mono text-stone-500 ml-2">webhook.json</span>
                    <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-100/60 px-2 py-0.5 rounded">POST</span>
                  </div>
                  <pre className="p-5 text-xs leading-relaxed font-mono text-[#0A0E27] overflow-x-auto">
{`POST `}<span className="text-blue-600">https://your-app/webhook</span>{`
X-CloseOS-Signature: `}<span className="text-stone-400">hmac-sha256...</span>{`

{
  `}<span className="text-blue-700">"event"</span>{`: `}<span className="text-emerald-700">"prospect.created"</span>{`,
  `}<span className="text-blue-700">"id"</span>{`: `}<span className="text-emerald-700">"abc-123"</span>{`,
  `}<span className="text-blue-700">"data"</span>{`: {
    `}<span className="text-blue-700">"email"</span>{`: `}<span className="text-emerald-700">"jean@example.com"</span>{`,
    `}<span className="text-blue-700">"stage"</span>{`: `}<span className="text-emerald-700">"new"</span>{`,
    `}<span className="text-blue-700">"source"</span>{`: `}<span className="text-emerald-700">"campaign_xyz"</span>{`,
    `}<span className="text-blue-700">"score"</span>{`: `}<span className="text-orange-600">87</span>{`
  },
  `}<span className="text-blue-700">"timestamp"</span>{`: `}<span className="text-orange-600">{Date.now()}</span>{`
}`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ───────── DEMO SECTION ───────── */}
        <motion.section
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          id="demo"
          className="px-6 md:px-12 py-24 md:py-32 bg-gradient-to-b from-blue-50/30 via-white to-blue-50/30 border-y border-blue-100/60"
        >
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
              <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-5">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-600">{t.demo_label}</p>
                <h2 className="text-4xl md:text-5xl font-bold text-[#0A0E27] tracking-tight leading-[1.05]">
                  {t.demo_title}
                </h2>
                <p className="text-stone-600 text-lg leading-relaxed">
                  {t.demo_description}
                </p>
                <div className="flex flex-col gap-2.5 pt-2">
                  {[t.demo_check_adapted, t.demo_check_questions, t.demo_check_free].map((c, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-sm font-medium text-stone-700">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-50 border border-blue-100">
                        <Check className="size-3 text-blue-600" />
                      </span>
                      {c}
                    </div>
                  ))}
                </div>
              </div>
              <div className="lg:col-span-7">
                <div className="relative">
                  <div className="absolute -inset-4 bg-gradient-to-br from-[#3B82F6]/10 to-[#60A5FA]/15 rounded-3xl blur-2xl" />
                  <div className="relative rounded-2xl bg-white border border-blue-100 shadow-2xl shadow-blue-500/10 overflow-hidden">
                    <iframe
                      ref={demoIframeRef}
                      id="closeos-embed"
                      src={`/capture/d8cbeca2-3a35-424a-b549-c0fbe1dd1aee?embed=true&layout=horizontal&lang=${lang}`}
                      width="100%"
                      height={530}
                      frameBorder="0"
                      scrolling="no"
                      style={{ border: 'none', overflow: 'hidden', transition: 'height 0.4s ease' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Pricing Section */}
        <PricingSection />

        {/* FAQ Section */}
        <FAQSection />

        {/* ───────── FINAL CTA, Full bleed gradient ───────── */}
        <motion.section
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="px-6 md:px-12 py-24 md:py-32"
        >
          <div className="max-w-6xl mx-auto">
            <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#0A0E27] via-[#1E3A8A] to-[#3B82F6] p-10 md:p-16 lg:p-20">
              {/* Decorative blobs */}
              <div className="absolute -top-32 -right-32 w-96 h-96 bg-[#60A5FA] rounded-full blur-[120px] opacity-40 pointer-events-none" />
              <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-[#7DD3FC] rounded-full blur-[120px] opacity-30 pointer-events-none" />
              {/* Grid */}
              <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{
                backgroundImage: 'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
                backgroundSize: '48px 48px',
              }} />

              <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-8 space-y-6">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white/90">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {lang === 'fr' ? 'Disponible · 14j gratuits' : 'Available · 14 free days'}
                  </span>
                  <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-[1.05] tracking-tight">
                    {t.final_cta_title}
                  </h2>
                  <p className="text-white/80 text-lg max-w-xl">{t.final_cta_subtitle}</p>
                </div>
                <div className="lg:col-span-4 flex flex-col gap-3">
                  <a
                    href="#pricing"
                    className="group inline-flex items-center justify-center gap-2 rounded-full h-14 px-8 text-[#0A0E27] text-base font-bold transition-all bg-white hover:bg-blue-50 hover:-translate-y-0.5 shadow-2xl"
                  >
                    {lang === 'fr' ? 'Commencer · 49€/mois' : 'Get started · €49/mo'}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </a>
                  <Link
                    to="/crm/login"
                    className="inline-flex items-center justify-center gap-2 rounded-full h-14 px-8 text-white text-base font-bold border border-white/20 hover:bg-white/10 backdrop-blur-md transition-all"
                  >
                    {lang === 'fr' ? 'Se connecter' : 'Log in'}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </motion.section>
      </main>

      {/* Founder */}
      <section className="py-20 border-t border-blue-100/60 bg-white">
        <div className="max-w-4xl mx-auto px-6 flex flex-col md:flex-row items-center gap-8">
          <div className="relative shrink-0">
            <div className="absolute -inset-2 bg-gradient-to-br from-[#3B82F6]/20 to-[#60A5FA]/30 rounded-full blur-xl" />
            <img
              src="https://qwjvdwpixewsctircibl.supabase.co/storage/v1/object/public/avatars/business-7d48e479-cede-480e-b405-39611a48d333-0.3286628360007747.jpg"
              alt="Thomas Shamoev, fondateur de CloseOS"
              width={120}
              height={120}
              loading="lazy"
              className="relative rounded-full w-28 h-28 object-cover ring-4 ring-white"
            />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-600 mb-2">{t.founder_section_title}</p>
            <h2 className="text-2xl font-bold text-[#0A0E27] mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>Thomas Shamoev</h2>
            <p className="text-stone-500 text-sm mb-4">{t.founder_role}</p>
            <p className="text-stone-600 leading-relaxed">{t.founder_bio}</p>
          </div>
        </div>
      </section>

      <FooterSection />

      {/* Fixed bottom blur cue */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white via-white/80 to-transparent backdrop-blur-[1px] pointer-events-none z-[80]" />

      {/* Floating Scroll to Top Button */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-8 left-8 z-[90] p-4 rounded-full bg-white border border-stone-200 shadow-lg transition-all duration-500 hover:scale-110 hover:-translate-y-1 group ${showScrollTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}
        aria-label={t.scroll_top_label}
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

      {/* Demo popup, appears after 45s */}
      {showDemoPopup && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center bg-[#0A0E27]/60 backdrop-blur-md overflow-y-auto py-6 md:py-10 animate-in fade-in duration-300" onClick={() => setShowDemoPopup(false)}>
          <div className="relative bg-white rounded-3xl p-6 md:p-8 max-w-3xl w-full mx-4 shadow-2xl shadow-blue-500/20 ring-1 ring-blue-100 my-auto animate-in slide-in-from-bottom-4 duration-500" onClick={(e) => e.stopPropagation()}>
            <div className="absolute -inset-2 bg-gradient-to-br from-[#3B82F6]/15 to-[#60A5FA]/20 rounded-[2rem] blur-2xl -z-10" />
            <div className="flex items-start justify-between mb-3">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-100 text-[10px] font-bold uppercase tracking-widest text-blue-700 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  {lang === 'fr' ? 'Démo express' : 'Express demo'}
                </span>
                <h3 className="text-xl md:text-2xl font-extrabold text-[#0A0E27] tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {lang === 'fr' ? 'Pas encore convaincu ?' : 'Not convinced yet?'}
                </h3>
                <p className="text-sm text-stone-600 mt-1">
                  {lang === 'fr'
                    ? 'Réservez un appel de 15 min, on vous montre comment CloseOS s\'adapte à votre business.'
                    : 'Book a 15-min call, we\'ll show you how CloseOS fits your business.'}
                </p>
              </div>
              <button onClick={() => setShowDemoPopup(false)} className="text-stone-400 hover:text-blue-600 transition-colors p-1.5 rounded-lg hover:bg-blue-50">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 rounded-2xl border border-blue-100 overflow-hidden">
              <iframe
                ref={demoPopupIframeRef}
                src="https://www.closeos.fr/capture/d8cbeca2-3a35-424a-b549-c0fbe1dd1aee?embed=true&layout=horizontal"
                width="100%"
                height={530}
                frameBorder="0"
                scrolling="yes"
                style={{ border: 'none', overflow: 'hidden', transition: 'height 0.4s ease' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
    </LangContext.Provider>
  );
}

// --- Sub-components ---

const KPIBox = ({ title, value, change, icon, positive, index }: any) => {
  const { t } = useLang();
  return (
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
        {change} {t.kpi_vs_last_month}
      </p>
    </motion.div>
  );
};

const TeamManagement = () => {
  const { t } = useLang();
  return (
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
        <h3 className="text-2xl font-bold text-[#111111] mb-3">{t.team_title}</h3>
        <p className="text-stone-500 mb-8">
          {t.team_description}
        </p>
      </div>
      <div className="space-y-3">
        <TeamMember index={0} name="Julien Durand" role="Closer Senior" conv="34%" />
        <TeamMember index={1} name="Marie Lefebvre" role="Setter" conv="21%" />
        <TeamMember index={2} name="Sophie Martin" role="Setter-Closer" conv="28%" />
      </div>
    </motion.div>
  );
};

const SharedPipeline = () => {
  const { t } = useLang();
  return (
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
      <h3 className="text-2xl font-bold text-[#111111] mb-3">{t.pipeline_title}</h3>
      <p className="text-stone-500 mb-8">
        {t.pipeline_description}
      </p>
      <div className="mt-auto bg-stone-50 rounded-2xl p-4 border border-stone-100">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-stone-500">{t.pipeline_rdv_fixe}</span>
          <span className="text-xs font-bold text-stone-400">12</span>
        </div>
        <PipelineCard name="Michel Robert" source="MAI 24 - 14:00" highlight={false} />
      </div>
    </motion.div>
  );
};

const RevenueStripe = () => {
  const { t } = useLang();
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, delay: 0.3 }}
      className="lg:col-span-3 bg-gradient-to-br from-[#635BFF]/[0.03] to-white rounded-3xl p-8 md:p-10 border border-[#635BFF]/10 shadow-sm relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-[#635BFF]/10 to-emerald-500/5 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4 pointer-events-none" />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 relative z-10">
        {/* Left, Texte */}
        <div className="lg:col-span-2 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-xl bg-[#635BFF]/10 flex items-center justify-center">
              <DollarSign className="size-6 text-[#635BFF]" />
            </div>
            <span className="px-3 py-1 rounded-full bg-[#635BFF]/10 text-[#635BFF] text-xs font-bold uppercase tracking-wider">{t.revenue_stripe_connect}</span>
          </div>
          <h3 className="text-2xl md:text-3xl font-bold text-[#111111] mb-3 tracking-tight">{t.revenue_title}</h3>
          <p className="text-stone-500 mb-6 leading-relaxed">
            {t.revenue_description}
          </p>
          <ul className="space-y-3">
            <li className="flex items-center gap-3 text-stone-700 text-sm font-medium">
              <CheckCircle className="text-[#635BFF] size-4 shrink-0" /> {t.revenue_item_mrr}
            </li>
            <li className="flex items-center gap-3 text-stone-700 text-sm font-medium">
              <CheckCircle className="text-[#635BFF] size-4 shrink-0" /> {t.revenue_item_matching}
            </li>
            <li className="flex items-center gap-3 text-stone-700 text-sm font-medium">
              <CheckCircle className="text-[#635BFF] size-4 shrink-0" /> {t.revenue_item_charges}
            </li>
            <li className="flex items-center gap-3 text-stone-700 text-sm font-medium">
              <CheckCircle className="text-[#635BFF] size-4 shrink-0" /> {t.revenue_item_new_client}
            </li>
          </ul>
        </div>

        {/* Right, Mini dashboard preview */}
        <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">{t.revenue_kpi_mrr}</p>
            <p className="text-2xl font-black text-[#111111]">8,450€</p>
            <p className="text-xs text-emerald-600 font-semibold mt-1">{t.revenue_kpi_mrr_change}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">{t.revenue_kpi_ca_mois}</p>
            <p className="text-2xl font-black text-[#111111]">24,800€</p>
            <p className="text-xs text-emerald-600 font-semibold mt-1">{t.revenue_kpi_ca_mois_change}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">{t.revenue_kpi_marge}</p>
            <p className="text-2xl font-black text-[#111111]">18,200€</p>
            <p className="text-xs text-emerald-600 font-semibold mt-1">{t.revenue_kpi_marge_pct}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">{t.revenue_kpi_abonnements}</p>
            <p className="text-2xl font-black text-[#111111]">47</p>
            <p className="text-xs text-stone-400 font-semibold mt-1">{t.revenue_kpi_abonnements_sub}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">{t.revenue_kpi_commissions}</p>
            <p className="text-2xl font-black text-[#111111]">4,960€</p>
            <p className="text-xs text-stone-400 font-semibold mt-1">{t.revenue_kpi_commissions_sub}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">{t.revenue_kpi_churn}</p>
            <p className="text-2xl font-black text-[#111111]">2.1%</p>
            <p className="text-xs text-emerald-600 font-semibold mt-1">{t.revenue_kpi_churn_change}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const Onboarding = () => {
  const { t } = useLang();
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, delay: 0.6 }}
      className="lg:col-span-3 bg-[#111111] rounded-3xl p-8 md:p-12 text-white relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#3B82F6]/20 to-[#60A5FA]/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 relative z-10">
        <div className="flex flex-col justify-center">
          <span className="text-stone-400 font-bold text-sm tracking-[0.2em] uppercase mb-4">{t.onboarding_label}</span>
          <h3 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">{t.onboarding_title}</h3>
          <p className="text-stone-300 text-lg mb-8 leading-relaxed">
            {t.onboarding_description}
          </p>
          <ul className="space-y-4">
            <li className="flex items-center gap-3 text-stone-200 font-medium">
              <CheckCircle className="text-emerald-400 size-5" /> {t.onboarding_item_reporting}
            </li>
            <li className="flex items-center gap-3 text-stone-200 font-medium">
              <CheckCircle className="text-emerald-400 size-5" /> {t.onboarding_item_exports}
            </li>
          </ul>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <BoxItem index={0} icon={<FileText className="size-6 text-white" />} title={t.onboarding_box_scripts_title} description={t.onboarding_box_scripts_desc} dark />
          <BoxItem index={1} icon={<Video className="size-6 text-white" />} title={t.onboarding_box_videos_title} description={t.onboarding_box_videos_desc} dark />
          <BoxItem index={2} icon={<CheckCircle className="size-6 text-white" />} title={t.onboarding_box_progress_title} description={t.onboarding_box_progress_desc} dark />
          <BoxItem index={3} icon={<ArrowDown className="size-6 text-white" />} title={t.onboarding_box_exports_title} description={t.onboarding_box_exports_desc} dark />
        </div>
      </div>
    </motion.div>
  );
};

const TeamMember = ({ name, role, conv, index }: any) => {
  const { t } = useLang();
  return (
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
        <p className="text-[#111111] font-bold text-sm">{conv} {t.team_member_conv}</p>
        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-bold uppercase tracking-wider">{t.team_member_online}</span>
      </div>
    </motion.div>
  );
};

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

const CRMFeatureCard = ({ icon, titleKey, descKey }: { icon: React.ReactNode; titleKey: keyof typeof translations.fr; descKey: keyof typeof translations.fr }) => {
  const { t } = useLang();
  return (
    <CRMFeature icon={icon} title={t[titleKey]} description={t[descKey]} />
  );
};

const CRMFeatureRelances = () => {
  const { t } = useLang();
  return (
    <CRMFeature
      icon={<Bell className="size-5" />}
      title={t.crm_feature_relances_title}
      extra={
        <div className="mt-3 bg-blue-100 text-blue-800 px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 w-fit">
          <ArrowUp className="size-3.5" /> {t.crm_feature_relances_reminder}
        </div>
      }
    />
  );
};

const CRMFeatureTags = () => {
  const { t } = useLang();
  return (
    <CRMFeature
      icon={<Tag className="size-5" />}
      title={t.crm_feature_tags_title}
      extra={
        <div className="flex gap-2 mt-3 text-left">
          <span className="px-2.5 py-1 rounded-md bg-stone-100 text-stone-600 text-xs font-semibold border border-stone-200">{t.crm_feature_tag_froid}</span>
          <span className="px-2.5 py-1 rounded-md bg-stone-100 text-stone-600 text-xs font-semibold border border-stone-200">{t.crm_feature_tag_rappel}</span>
          <span className="px-2.5 py-1 rounded-md bg-stone-100 text-stone-600 text-xs font-semibold border border-stone-200">{t.crm_feature_tag_urgent}</span>
        </div>
      }
    />
  );
};

const CaptureSection = () => {
  const { t } = useLang();
  const [captureTab, setCaptureTab] = useState<'page' | 'embed' | 'popup'>('page');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-20">
      {/* Left, Text */}
      <div className="lg:col-span-5 flex flex-col justify-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50/70 border border-blue-100 shadow-sm mb-6 w-fit">
          <Megaphone className="size-3.5 text-stone-600" />
          <span className="text-xs font-bold text-stone-600 uppercase tracking-widest">{t.capture_badge}</span>
        </div>
        <h3 className="text-3xl md:text-4xl font-bold text-[#111111] tracking-tight mb-4">{t.capture_title}</h3>
        <p className="text-stone-500 text-lg font-medium leading-relaxed mb-6">
          {t.capture_description}
        </p>
        <div className="space-y-3">
          <div className="flex items-start gap-3 text-stone-700 font-medium">
            <CheckCircle className="size-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <span>{t.capture_item_custom}</span>
          </div>
          <div className="flex items-start gap-3 text-stone-700 font-medium">
            <CheckCircle className="size-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <span>{t.capture_item_embed}</span>
          </div>
          <div className="flex items-start gap-3 text-stone-700 font-medium">
            <CheckCircle className="size-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <span>{t.capture_item_popup}</span>
          </div>
          {captureTab === 'page' && (
            <div className="flex items-start gap-3 text-stone-700 font-medium">
              <CheckCircle className="size-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <span>{t.capture_item_video}</span>
            </div>
          )}
          <div className="flex items-start gap-3 text-stone-700 font-medium">
            <CheckCircle className="size-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <span>{t.capture_item_precapture}</span>
          </div>
          <div className="flex items-start gap-3 text-stone-700 font-medium">
            <CheckCircle className="size-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <span>{t.capture_item_payment}</span>
          </div>
        </div>
      </div>

      {/* Right, Preview */}
      <div className="lg:col-span-7 flex items-center mt-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="w-full bg-white rounded-3xl overflow-hidden shadow-xl border border-stone-200 text-left"
        >
          {/* Tab bar */}
          <div className="flex border-b border-stone-100 bg-stone-50">
            {([
              { key: 'page' as const, label: t.capture_tab_page },
              { key: 'embed' as const, label: t.capture_tab_embed },
              { key: 'popup' as const, label: t.capture_tab_popup },
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
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  </div>
                  <div className="flex-1 bg-white rounded-lg px-3 py-1.5 text-xs text-stone-400 font-mono">
                    closeos.fr/capture/mastermind-2026
                  </div>
                </div>
                {/* Capture page, two columns: form left, agenda right */}
                <div className="bg-gradient-to-br from-[#111111] to-[#1a1a2e] rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Left, Registration form */}
                  <div className="space-y-3">
                    <h4 className="text-white text-lg font-bold leading-tight">{t.capture_page_title}</h4>
                    <p className="text-stone-400 text-xs font-medium">{t.capture_page_subtitle}</p>
                    <div className="space-y-2">
                      <div className="bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-xs text-stone-400">{t.capture_page_prenom}</div>
                      <div className="bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-xs text-stone-400">{t.capture_page_email}</div>
                      <div className="bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-xs text-stone-400">{t.capture_page_phone}</div>
                    </div>
                    <div className="bg-white text-[#111111] rounded-lg px-4 py-2.5 text-xs font-bold text-center">{t.capture_page_continue}</div>
                  </div>
                  {/* Right, Blurred agenda */}
                  <div className="relative rounded-xl overflow-hidden bg-white/5 border border-white/10 p-4">
                    <div className="absolute inset-0 backdrop-blur-md bg-white/5 z-10 flex items-center justify-center">
                      <div className="text-center px-4">
                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-2">
                          <Calendar className="size-5 text-white/60" />
                        </div>
                        <p className="text-white/70 text-xs font-bold">{t.capture_page_calendar_blur}</p>
                      </div>
                    </div>
                    {/* Fake calendar grid behind blur */}
                    <div className="opacity-30 space-y-2">
                      <div className="flex gap-1">
                        {t.capture_calendar_days.map(d => (
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
                        {['09:00', '09:30', '10:00', '10:30'].map(tm => (
                          <div key={tm} className="bg-white/10 rounded px-2 py-1 text-[8px] text-white/40">{tm}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {captureTab === 'embed' && (
              <div className="space-y-4">
                {/* Browser bar, CloseOS Sales site */}
                <div className="bg-stone-100 rounded-xl p-3 flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
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
                    <img src="/logo-sales.png" alt="CloseOS Sales" className="h-6 object-contain" loading="lazy" width={72} height={24} />
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
                        <h4 className="text-white text-sm font-bold">{t.capture_embed_title}</h4>
                        <p className="text-stone-400 text-[10px]">{t.capture_embed_subtitle}</p>
                        <div className="space-y-2 max-w-[200px] mx-auto">
                          <div className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-[10px] text-stone-400 text-left">{t.capture_embed_prenom}</div>
                          <div className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-[10px] text-stone-400 text-left">{t.capture_embed_email}</div>
                          <div className="bg-white text-[#111111] rounded-lg px-3 py-2 text-[10px] font-bold">{t.capture_embed_reserver}</div>
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
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#60A5FA] flex items-center justify-center">
                        <Zap className="size-5 text-white" />
                      </div>
                      <div className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center">
                        <X className="size-3 text-stone-400" />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[#111111] font-bold text-base">{t.capture_popup_title}</h4>
                      <p className="text-stone-400 text-xs mt-1">{t.capture_popup_subtitle}</p>
                    </div>
                    <div className="space-y-2">
                      <div className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-xs text-stone-400">{t.capture_popup_email}</div>
                      <div className="bg-[#111111] text-white rounded-lg px-3 py-2 text-xs font-bold text-center">{t.capture_popup_cta}</div>
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

const QualificationSection = () => {
  const { t } = useLang();

  const mockQuestions = [
    { q: t.qualification_mock_q1, a: t.qualification_mock_a1, score: 95, eliminatory: false },
    { q: t.qualification_mock_q2, a: t.qualification_mock_a2, score: 72, eliminatory: false },
    { q: t.qualification_mock_q3, a: t.qualification_mock_a3, score: 0, eliminatory: true },
  ];

  const getScoreStyle = (score: number) => {
    if (score >= 70) return { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', bar: 'bg-emerald-500' };
    if (score >= 40) return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', bar: 'bg-blue-500' };
    return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600', bar: 'bg-red-500' };
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-20">
      {/* Left, Text */}
      <div className="lg:col-span-5 flex flex-col justify-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50/70 border border-blue-100 shadow-sm mb-6 w-fit">
          <ShieldCheck className="size-3.5 text-stone-600" />
          <span className="text-xs font-bold text-stone-600 uppercase tracking-widest">{t.qualification_badge}</span>
        </div>
        <h3 className="text-3xl md:text-4xl font-bold text-[#111111] tracking-tight mb-4">{t.qualification_title}</h3>
        <p className="text-stone-500 text-lg font-medium leading-relaxed mb-6">
          {t.qualification_subtitle}
        </p>
        <div className="space-y-3">
          {([t.qualification_check_1, t.qualification_check_2, t.qualification_check_3, t.qualification_check_4, t.qualification_check_5]).map((item, i) => (
            <div key={i} className="flex items-start gap-3 text-stone-700 font-medium">
              <CheckCircle className="size-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right, Mockup */}
      <div className="lg:col-span-7">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="bg-white rounded-3xl overflow-hidden shadow-xl border border-stone-200 text-left"
        >
          {/* Header, Prospect avatar + score ring */}
          <div className="p-6 border-b border-stone-100 bg-stone-50 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white font-bold text-xl shadow-inner">SM</div>
              <div>
                <h4 className="font-bold text-xl text-[#111111] mb-0.5">{t.qualification_mock_name}</h4>
                <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">{t.qualification_mock_role}</span>
              </div>
            </div>
            {/* Score ring */}
            <div className="relative w-16 h-16 flex-shrink-0">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="28" fill="none" stroke="#e7e5e4" strokeWidth="5" />
                <motion.circle
                  cx="32" cy="32" r="28" fill="none" stroke="#f59e0b" strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={175.9}
                  initial={{ strokeDashoffset: 175.9 }}
                  whileInView={{ strokeDashoffset: 175.9 * (1 - 0.56) }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.2, delay: 0.4, ease: 'easeOut' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-black text-blue-600">56%</span>
              </div>
            </div>
          </div>

          {/* Question cards */}
          <div className="p-6 space-y-3">
            {mockQuestions.map((mq, i) => {
              const style = getScoreStyle(mq.score);
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.3 + i * 0.12 }}
                  className={`rounded-2xl border p-4 ${style.bg} ${style.border}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">{mq.q}</span>
                    <div className="flex items-center gap-2">
                      {mq.eliminatory && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold uppercase tracking-wider">
                          <XCircle className="size-2.5" />
                          {t.qualification_mock_q3_badge}
                        </span>
                      )}
                      <span className={`text-sm font-black ${style.text}`}>{mq.score}%</span>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-stone-800 mb-2">{mq.a}</p>
                  {/* Progress bar */}
                  <div className="h-1.5 rounded-full bg-white/60 overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${style.bar}`}
                      initial={{ width: 0 }}
                      whileInView={{ width: `${mq.score}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, delay: 0.5 + i * 0.12, ease: 'easeOut' }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Footer, Summary */}
          <div className="px-6 pb-6">
            <div className="rounded-2xl bg-stone-50 border border-stone-200 p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">{t.qualification_mock_score}</p>
                <p className="text-2xl font-black text-[#111111]">56%</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">{t.qualification_mock_eliminatory}</p>
                <p className="text-2xl font-black text-red-500">1<span className="text-stone-300 text-lg">/2</span></p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

const CRMKPIBox = ({ titleKey, valueKey, descKey, index }: { titleKey: keyof typeof translations.fr; valueKey: keyof typeof translations.fr; descKey: keyof typeof translations.fr; index: number }) => {
  const { t } = useLang();
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: (index || 0) * 0.1 }}
      className="flex flex-col gap-2 items-center text-center p-6 rounded-3xl bg-stone-50 border border-stone-200"
    >
      <span className="text-stone-400 text-[10px] font-bold uppercase tracking-[0.2em]">{t[titleKey] as string}</span>
      <h4 className="text-4xl font-bold text-[#111111] tracking-tight my-2">{t[valueKey] as string}</h4>
      <p className="text-stone-500 text-sm font-medium">{t[descKey] as string}</p>
    </motion.div>
  );
};

const LeadProfile = () => {
  const { t } = useLang();
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
      className="bg-white rounded-3xl overflow-hidden shadow-xl border border-stone-200 text-left"
    >
      <div className="p-6 border-b border-stone-100 bg-stone-50 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#60A5FA] flex items-center justify-center text-white font-bold text-xl shadow-inner">JP</div>
          <div>
            <h4 className="font-bold text-xl text-[#111111] mb-1">{t.lead_name}</h4>
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">{t.lead_id}</span>
          </div>
        </div>
        <div className="hidden sm:flex gap-2">
          <span className="px-3 py-1.5 bg-blue-100 text-blue-800 rounded-lg text-[10px] font-bold uppercase tracking-wider">{t.lead_tag_hot}</span>
          <span className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-bold uppercase tracking-wider">{t.lead_tag_ready}</span>
        </div>
      </div>
      <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-8">
          <div>
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3">{t.lead_contact_info}</p>
            <div className="space-y-3 text-sm font-medium text-stone-700">
              <div className="flex items-center gap-3"><Mail className="size-4 text-stone-400" /> jp.morel@gmail.com</div>
              <div className="flex items-center gap-3"><Phone className="size-4 text-stone-400" /> +33 6 12 34 56 78</div>
              <div className="flex items-center gap-3"><ArrowUp className="size-4 text-stone-400" /> {t.lead_source_label} <span className="text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded">{t.lead_source_value}</span></div>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3">{t.lead_interaction_history}</p>
            <div className="space-y-4">
              <InteractionItem icon={<MessageSquare className="size-3" />} text={t.lead_interaction_msg} subtext={t.lead_interaction_msg_sub} color="bg-emerald-100 text-emerald-700" italic={true} />
              <InteractionItem icon={<Phone className="size-3" />} text={t.lead_interaction_call} subtext={t.lead_interaction_call_sub} color="bg-sky-100 text-sky-700" />
            </div>
          </div>
        </div>
        <div className="space-y-8">
          <div className="bg-stone-50 p-5 rounded-2xl border border-stone-200">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3">{t.lead_notes_title}</p>
            <p className="text-sm text-stone-600 font-medium leading-relaxed">
              {t.lead_notes_content.split('\n').map((line, i) => (
                <React.Fragment key={i}>
                  {line}
                  {i < t.lead_notes_content.split('\n').length - 1 && <br />}
                </React.Fragment>
              ))}
            </p>
          </div>
          <div className="p-5 border border-stone-200 rounded-2xl bg-white shadow-sm">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3">{t.lead_offer_title}</p>
            <div className="flex items-center justify-between">
              <span className="font-bold text-stone-800">{t.lead_offer_name}</span>
              <span className="font-black text-xl text-[#111111]">7,500€</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

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

const getPricingPlans = (lang: string) => [
  {
    name: 'CRM',
    planKey: 'crm',
    emoji: '🟡',
    price: '49',
    priceQuarterly: '37',
    quarterlyTotal: '111',
    priceAnnual: '29',
    annualTotal: '348',
    popular: true,
    description: lang === 'fr'
      ? "Tout-en-un pour l'entrepreneur solo qui gère ses prospects"
      : 'All-in-one for the solo entrepreneur managing their prospects',
    features: lang === 'fr' ? [
      'Dashboard avec KPIs personnels',
      'CRM illimité + imports Hubspot / Pipedrive / GoHighLevel / Airtable',
      'Pipeline Kanban visuel avec stages personnalisables',
      'Campagnes avec pages de capture (formulaire, questionnaire, booking)',
      'Paiement Stripe intégré aux campagnes (avant ou après inscription)',
      'Acquisition : tracking UTM, analytics, ROI par campagne',
      'API REST + Webhooks signés HMAC',
      'Intégrations natives : Zapier, Make, N8N',
      'Éditeur riche pour descriptions de campagnes',
      '14 jours d\'essai gratuits avec carte bancaire',
      'Support email prioritaire',
    ] : [
      'Dashboard with personal KPIs',
      'Unlimited CRM + imports from Hubspot / Pipedrive / GoHighLevel / Airtable',
      'Visual Kanban Pipeline with custom stages',
      'Campaigns with capture pages (form, questionnaire, booking)',
      'Stripe payment integrated into campaigns (before or after signup)',
      'Acquisition: UTM tracking, analytics, ROI per campaign',
      'REST API + HMAC-signed Webhooks',
      'Native integrations: Zapier, Make, N8N',
      'Rich-text editor for campaign descriptions',
      '14-day free trial with credit card',
      'Priority email support',
    ],
  },
];

const getPricingExtras = (lang: string) => [
  {
    name: 'Setup',
    price: '60€',
    type: 'one-shot',
    description: lang === 'fr'
      ? "Configuration complète du CRM : import de vos prospects, création de vos campagnes, paramétrage du pipeline, stages personnalisés, tags. Vous n'avez rien à toucher, tout est livré prêt à closer."
      : "Full CRM setup: import your prospects, build your campaigns, configure your pipeline, custom stages, tags. You don't touch anything, everything is delivered ready to close.",
  },
  {
    name: lang === 'fr' ? 'Intégration' : 'Integration',
    price: '80€',
    type: 'one-shot',
    description: lang === 'fr'
      ? "Branchement technique sur votre site et votre stack : iframe/embed/popup pour vos pages de capture, configuration API et Webhooks vers Zapier, Make ou N8N, synchronisation Hubspot/Pipedrive/GoHighLevel/Airtable."
      : 'Technical hookup on your website and stack: iframe/embed/popup for capture pages, API and Webhooks config for Zapier/Make/N8N, sync with Hubspot/Pipedrive/GoHighLevel/Airtable.',
  },
  {
    name: lang === 'fr' ? 'Setup + Intégration' : 'Setup + Integration',
    price: '120€',
    type: 'one-shot',
    description: lang === 'fr'
      ? "Les deux combinés, vous économisez 20€. CRM paramétré de A à Z, branchements techniques faits, prêt à recevoir vos premiers leads."
      : 'Both bundled, save €20. CRM fully configured, all technical hookups done, ready to receive your first leads.',
  },
];

type BillingCycle = 'annual' | 'quarterly' | 'monthly';

const PricingSection = () => {
  const [billing, setBilling] = useState<BillingCycle>('annual');
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { t, lang } = useLang();
  const pricingPlans = getPricingPlans(lang);
  const pricingExtras = getPricingExtras(lang);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'closeos-capture-resize' && iframeRef.current) {
        iframeRef.current.style.height = e.data.height + 'px';
      }
      if (e.data === 'closeos-capture-done' && iframeRef.current) {
        iframeRef.current.style.height = '120px';
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <motion.section
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="px-6 md:px-20 py-32 bg-white border-y border-stone-200"
      id="pricing"
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50/70 border border-blue-100 shadow-sm mb-4">
            <span className="text-sm font-semibold text-stone-800">{lang === 'fr' ? 'Tarifs' : 'Pricing'}</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-[#111111] tracking-tight text-balance">
            {lang === 'fr' ? 'Un plan, tout inclus' : 'One plan, everything included'}
          </h2>
          <p className="text-stone-500 text-lg max-w-2xl mx-auto">
            {lang === 'fr'
              ? "Tout CloseOS CRM pour 49€/mois. Sans limite de prospects ni de campagnes."
              : 'All of CloseOS CRM for €49/mo. No prospect limit, no campaign limit.'}
            <br />
            <span className="font-semibold text-emerald-600">🎁 {lang === 'fr' ? '14 jours d\'essai gratuits avec carte bancaire.' : '14-day free trial with credit card.'}</span>
          </p>

          <div className="flex items-center justify-center pt-6">
            <div className="relative grid grid-cols-3 rounded-full bg-stone-100 border border-stone-200 p-1" style={{ minWidth: 340 }}>
              {/* Sliding bubble */}
              <div
                className="absolute top-1 bottom-1 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] shadow-md transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{
                  width: 'calc(33.333% - 3px)',
                  left: billing === 'annual' ? '4px' : billing === 'quarterly' ? 'calc(33.333% + 0.5px)' : 'calc(66.666% - 1px)',
                }}
              />
              {([
                { key: 'annual' as BillingCycle, label: lang === 'fr' ? 'Annuel' : 'Annual', discount: '-28%' },
                { key: 'quarterly' as BillingCycle, label: lang === 'fr' ? 'Trimestriel' : 'Quarterly', discount: '-18%' },
                { key: 'monthly' as BillingCycle, label: lang === 'fr' ? 'Mensuel' : 'Monthly', discount: null },
              ]).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setBilling(opt.key)}
                  className={`relative z-10 text-center px-4 py-2.5 rounded-full text-sm font-bold transition-colors duration-300 ${
                    billing === opt.key
                      ? 'text-white'
                      : 'text-stone-500 hover:text-[#111111]'
                  }`}
                >
                  {opt.discount && (
                    <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-500 to-emerald-400 text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shadow-lg shadow-emerald-500/30 whitespace-nowrap ring-2 ring-white">
                      {opt.discount}
                    </span>
                  )}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-20 max-w-5xl mx-auto items-stretch">
          {pricingPlans.map((plan, idx) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 24, filter: 'blur(4px)' }}
              whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className={`relative rounded-3xl p-7 flex flex-col border transition-shadow duration-300 hover:shadow-lg ${
                plan.popular
                  ? 'bg-gradient-to-br from-[#3B82F6] via-[#60A5FA] to-[#7DD3FC] text-white border-transparent shadow-2xl shadow-blue-500/40'
                  : 'bg-white border-blue-100 shadow-sm'
              }`}
            >
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{plan.emoji}</span>
                  <h3 className={`text-lg font-bold ${plan.popular ? 'text-white' : 'text-[#111111]'}`}>{plan.name}</h3>
                </div>

                {plan.price ? (
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className={`text-4xl font-black tracking-tight ${plan.popular ? 'text-white' : 'text-[#111111]'}`}>
                      {billing === 'annual' ? plan.priceAnnual : billing === 'quarterly' ? (plan.priceQuarterly || plan.price) : plan.price}€
                    </span>
                    <span className={`text-sm font-medium ${plan.popular ? 'text-stone-400' : 'text-stone-500'}`}>/{lang === 'fr' ? 'mois' : 'mo'}</span>
                  </div>
                ) : (
                  <div className="mb-2">
                    <span className={`text-3xl font-black tracking-tight ${plan.popular ? 'text-white' : 'text-[#111111]'}`}>{lang === 'fr' ? 'Sur devis' : 'Custom'}</span>
                  </div>
                )}

                {billing === 'annual' && plan.annualTotal && (
                  <p className="text-xs font-semibold text-stone-400">
                    {plan.annualTotal}€/{lang === 'fr' ? 'an facturé annuellement' : 'year billed annually'}
                  </p>
                )}
                {billing === 'quarterly' && plan.quarterlyTotal && (
                  <p className="text-xs font-semibold text-stone-400">
                    {plan.quarterlyTotal}€/{lang === 'fr' ? 'trimestre' : 'quarter'}
                  </p>
                )}

                <p className={`text-sm font-medium mt-3 ${plan.popular ? 'text-stone-300' : 'text-stone-500'}`}>
                  {plan.description}
                </p>
              </div>

              {plan.price ? (
                <a
                  href={`/crm/checkout?plan=${plan.planKey}&billing=${billing}`}
                  className={`w-full flex items-center justify-center rounded-xl h-12 font-bold text-sm transition-all hover:-translate-y-0.5 active:scale-[0.98] mb-6 ${
                    plan.popular
                      ? 'bg-white text-[#111111] hover:bg-stone-100'
                      : 'bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] text-white hover:from-[#2563EB] hover:to-[#3B82F6] shadow-blue-500/30'
                  }`}
                >
                  {lang === 'fr' ? 'Commencer' : 'Get started'}
                </a>
              ) : (
                <button
                  onClick={() => setContactModalOpen(true)}
                  className="w-full flex items-center justify-center rounded-xl h-12 font-bold text-sm transition-all hover:-translate-y-0.5 active:scale-[0.98] mb-6 bg-stone-100 text-[#111111] hover:bg-stone-200 border border-stone-200"
                >
                  {lang === 'fr' ? 'Nous contacter' : 'Contact us'}
                </button>
              )}

              <ul className="space-y-3 flex-1">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <Check className={`size-4 mt-0.5 flex-shrink-0 ${plan.popular ? 'text-emerald-400' : 'text-emerald-600'}`} />
                    <span className={`text-sm font-medium leading-relaxed ${plan.popular ? 'text-stone-300' : 'text-stone-600'}`}>{feature}</span>
                  </li>
                ))}
                {plan.subFeatures && (
                  <li className="pl-7">
                    <ul className="space-y-2 mt-1">
                      {plan.subFeatures.map((sub, j) => (
                        <li key={j} className="flex items-start gap-2">
                          <ArrowRight className={`size-3 mt-1 flex-shrink-0 ${plan.popular ? 'text-stone-500' : 'text-stone-400'}`} />
                          <span className={`text-xs font-medium leading-relaxed ${plan.popular ? 'text-stone-400' : 'text-stone-500'}`}>{sub}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                )}
              </ul>
            </motion.div>
          ))}

          {/* Upsell Business, pour les équipes (côte à côte avec le plan CRM) */}
          <motion.div
            initial={{ opacity: 0, y: 24, filter: 'blur(4px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="relative rounded-3xl p-7 flex flex-col border border-stone-200 bg-gradient-to-br from-white via-stone-50 to-white shadow-sm transition-shadow duration-300 hover:shadow-lg"
          >
            <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-gradient-to-br from-emerald-400/15 to-teal-500/15 rounded-full blur-[80px]" />
              <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-gradient-to-br from-blue-400/10 to-indigo-500/10 rounded-full blur-[80px]" />
            </div>

            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[10px] font-bold uppercase tracking-widest">
              {lang === 'fr' ? 'Pour les équipes' : 'For teams'}
            </div>

            <div className="relative z-10 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Users className="size-5 text-emerald-600" />
                <h3 className="text-lg font-bold text-[#111111]">CloseOS Business</h3>
              </div>

              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-black tracking-tight text-[#111111]">
                  {billing === 'annual' ? '71' : billing === 'quarterly' ? '81' : '99'}€
                </span>
                <span className="text-sm font-medium text-stone-500">/{lang === 'fr' ? 'mois' : 'mo'}</span>
              </div>
              {billing === 'annual' && (
                <p className="text-xs font-semibold text-stone-400">
                  852€/{lang === 'fr' ? 'an facturé annuellement' : 'year billed annually'}
                </p>
              )}
              {billing === 'quarterly' && (
                <p className="text-xs font-semibold text-stone-400">
                  243€/{lang === 'fr' ? 'trimestre' : 'quarter'}
                </p>
              )}
              <p className="text-xs font-semibold text-stone-400 mt-1">
                {lang === 'fr' ? 'par utilisateur · formule Business + Acquisition' : 'per user · Business + Acquisition plan'}
              </p>

              <p className="text-sm font-medium mt-3 text-stone-500">
                {lang === 'fr'
                  ? "Tu as une équipe ? Passe à CloseOS Business pour piloter closers, setters et acquisition multi-canal."
                  : 'Got a team? Switch to CloseOS Business to manage closers, setters and multi-channel acquisition.'}
              </p>
            </div>

            <a
              href="/business#pricing"
              className="relative z-10 w-full flex items-center justify-center gap-2 rounded-xl h-12 font-bold text-sm transition-all hover:-translate-y-0.5 active:scale-[0.98] mb-6 bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] text-white hover:from-[#2563EB] hover:to-[#3B82F6] shadow-blue-500/30"
            >
              {lang === 'fr' ? 'Voir les tarifs Business' : 'See Business pricing'}
              <ArrowRight className="size-4" />
            </a>

            <ul className="relative z-10 space-y-3 flex-1">
              {(lang === 'fr' ? [
                'Tout CloseOS CRM inclus',
                'Équipe illimitée (closers + setters)',
                'Attribution automatique des leads',
                'KPI individuels & dashboards équipe',
                'Commissions & paiements automatisés',
                'Rendez-vous payants & agenda partagé',
                'Acquisition multi-canal complète',
                'Onboarding & formation incluse',
              ] : [
                'Full CloseOS CRM included',
                'Unlimited team (closers + setters)',
                'Automatic lead assignment',
                'Per-rep KPIs & team dashboards',
                'Automated commissions & payouts',
                'Paid bookings & shared calendar',
                'Full multi-channel acquisition',
                'Onboarding & training included',
              ]).map((feat, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <Check className="size-4 mt-0.5 flex-shrink-0 text-emerald-600" />
                  <span className="text-sm font-medium leading-relaxed text-stone-600">{feat}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6 }}
        >
          <div className="bg-[#111111] rounded-3xl p-8 md:p-12 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-blue-500/20 to-sky-500/20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-8">
                <Gift className="size-6 text-blue-400" />
                <h3 className="text-2xl font-bold text-white tracking-tight">Extras</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {pricingExtras.map((extra, i) => (
                  <motion.div
                    key={extra.name}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                    className="bg-white/5 border border-white/10 rounded-2xl p-6"
                  >
                    <div className="flex items-baseline gap-2 mb-1">
                      <h4 className="text-white font-bold text-lg">{extra.name}</h4>
                      <span className="text-stone-400 text-sm font-medium">{extra.price} {extra.type}</span>
                    </div>
                    <p className="text-stone-400 text-sm font-medium leading-relaxed mt-3">{extra.description}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Enterprise capture modal */}
      {contactModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-[#0A0E27]/60 backdrop-blur-md overflow-y-auto py-4 md:py-10" onClick={() => setContactModalOpen(false)}>
          <div className="relative bg-white rounded-3xl p-5 md:p-7 max-w-3xl w-full mx-4 shadow-2xl shadow-blue-500/20 ring-1 ring-blue-100 my-auto" onClick={(e) => e.stopPropagation()}>
            <div className="absolute -inset-2 bg-gradient-to-br from-[#3B82F6]/15 to-[#60A5FA]/20 rounded-[2rem] blur-2xl -z-10" />
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-100 text-[10px] font-bold uppercase tracking-widest text-blue-700 mb-2">Enterprise</span>
                <h3 className="text-lg font-extrabold text-[#0A0E27] tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {lang === 'fr' ? 'Discuter d\'un volume custom' : 'Discuss a custom volume'}
                </h3>
              </div>
              <button onClick={() => setContactModalOpen(false)} className="text-stone-400 hover:text-blue-600 transition-colors p-1.5 rounded-lg hover:bg-blue-50">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="rounded-2xl border border-blue-100 overflow-hidden">
              <iframe
                ref={iframeRef}
                src="https://www.closeos.fr/capture/d8cbeca2-3a35-424a-b549-c0fbe1dd1aee?embed=true&layout=horizontal"
                width="100%"
                height={530}
                frameBorder="0"
                scrolling="yes"
                style={{ border: 'none', overflow: 'hidden', transition: 'height 0.4s ease' }}
              />
            </div>
          </div>
        </div>
      )}
    </motion.section>
  );
};

const AUDIENCE_RANGES = ['0 - 50', '50 - 200', '200 - 500', '500 - 1K', '1K - 5K', '5K - 10K', '10K+']
const PLATFORM_OPTIONS = ['Instagram', 'LinkedIn', 'YouTube', 'TikTok', 'X / Twitter', 'Site web / Blog', 'Newsletter', 'Podcast', 'Autre']

const PHONE_COUNTRY_CODES = [
  { code: '+33', flag: '\u{1F1EB}\u{1F1F7}', name: 'France' },
  { code: '+32', flag: '\u{1F1E7}\u{1F1EA}', name: 'Belgique' },
  { code: '+41', flag: '\u{1F1E8}\u{1F1ED}', name: 'Suisse' },
  { code: '+352', flag: '\u{1F1F1}\u{1F1FA}', name: 'Luxembourg' },
  { code: '+1', flag: '\u{1F1FA}\u{1F1F8}', name: '\u00C9tats-Unis' },
  { code: '+44', flag: '\u{1F1EC}\u{1F1E7}', name: 'Royaume-Uni' },
  { code: '+49', flag: '\u{1F1E9}\u{1F1EA}', name: 'Allemagne' },
  { code: '+34', flag: '\u{1F1EA}\u{1F1F8}', name: 'Espagne' },
  { code: '+39', flag: '\u{1F1EE}\u{1F1F9}', name: 'Italie' },
  { code: '+212', flag: '\u{1F1F2}\u{1F1E6}', name: 'Maroc' },
  { code: '+216', flag: '\u{1F1F9}\u{1F1F3}', name: 'Tunisie' },
  { code: '+213', flag: '\u{1F1E9}\u{1F1FF}', name: 'Alg\u00E9rie' },
  { code: '+225', flag: '\u{1F1E8}\u{1F1EE}', name: "C\u00F4te d'Ivoire" },
  { code: '+221', flag: '\u{1F1F8}\u{1F1F3}', name: 'S\u00E9n\u00E9gal' },
  { code: '+237', flag: '\u{1F1E8}\u{1F1F2}', name: 'Cameroun' },
]

const PhoneInputLanding = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const [code, setCode] = useState('+33');
  const [local, setLocal] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleLocal = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 15);
    // Simple formatting: groups of 2
    const parts: string[] = [];
    for (let i = 0; i < digits.length; i += 2) parts.push(digits.slice(i, i + 2));
    const formatted = parts.join(' ');
    setLocal(formatted);
    onChange(digits ? `${code} ${formatted}` : '');
  };

  const currentFlag = PHONE_COUNTRY_CODES.find(c => c.code === code)?.flag || '\u{1F30D}';

  return (
    <div className="relative flex items-center rounded-xl bg-stone-100" ref={ref}>
      <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-1 shrink-0 pl-3 pr-1.5 py-2.5 hover:bg-stone-200/50 rounded-l-xl transition-colors">
        <span className="text-base">{currentFlag}</span>
        <span className="text-xs text-stone-500 font-medium">{code}</span>
        <ChevronDown className="h-3 w-3 text-stone-400" />
      </button>
      <div className="w-px h-5 bg-stone-200 shrink-0" />
      <input type="tel" value={local} onChange={e => handleLocal(e.target.value)} placeholder="6 12 34 56 78" className="flex-1 min-w-0 bg-transparent border-none py-2.5 px-3 text-sm text-[#111111] focus:ring-0 focus:outline-none font-medium" />
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-64 max-h-52 overflow-y-auto rounded-xl border border-stone-200 bg-white shadow-xl">
          {PHONE_COUNTRY_CODES.map((c, i) => (
            <button key={`${c.code}-${i}`} type="button" onClick={() => { setCode(c.code); setLocal(''); onChange(''); setOpen(false) }} className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-stone-50 transition-colors ${code === c.code ? 'bg-stone-100 font-medium' : 'text-stone-700'}`}>
              <span className="text-base">{c.flag}</span>
              <span className="flex-1 truncate">{c.name}</span>
              <span className="text-xs text-stone-400 font-medium">{c.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const PartnerSection = () => {
  const { t } = useLang();
  const [showAmbassadorModal, setShowAmbassadorModal] = useState(false);
  const [ambFirstName, setAmbFirstName] = useState('');
  const [ambLastName, setAmbLastName] = useState('');
  const [ambIsSubscriber, setAmbIsSubscriber] = useState(false);
  const [ambWhatsapp, setAmbWhatsapp] = useState('');
  const [ambActivity, setAmbActivity] = useState('');
  const [ambAudienceIdx, setAmbAudienceIdx] = useState(1);
  const [ambPlatforms, setAmbPlatforms] = useState<string[]>([]);
  const [ambNotes, setAmbNotes] = useState('');
  const [ambSending, setAmbSending] = useState(false);
  const [ambSent, setAmbSent] = useState(false);

  const handleAmbassadorSubmit = async () => {
    if (!ambFirstName.trim() || !ambLastName.trim() || !ambWhatsapp.trim()) return;
    setAmbSending(true);
    try {
      const platformsList = ambPlatforms.length > 0 ? ambPlatforms.join(', ') : 'Non renseigné';
      const message = `Prénom : ${ambFirstName}\nNom : ${ambLastName}\nAbonné CloseOS : ${ambIsSubscriber ? 'Oui' : 'Non'}\nWhatsApp : ${ambWhatsapp}\nActivité : ${ambActivity || 'Non renseigné'}\nTaille d'audience : ${AUDIENCE_RANGES[ambAudienceIdx]}\nPrésence : ${platformsList}\n\nNotes :\n${ambNotes || '—'}`;
      await fetch('/api/email?action=contact-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${ambFirstName} ${ambLastName}`,
          email: 'ambassador-form@closeos.fr',
          isSubscriber: ambIsSubscriber,
          subject: '[Ambassadeur] Candidature',
          message,
        }),
      });
      setAmbSent(true);
    } catch {
      // silent
    } finally {
      setAmbSending(false);
    }
  };

  return (
    <>
    <motion.section
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="px-6 md:px-20 py-24 bg-blue-50/30"
      id="partners"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-stone-200 shadow-sm mb-4">
            <Handshake className="h-4 w-4 text-stone-700" />
            <span className="text-sm font-semibold text-stone-800">{t.partners_badge}</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-[#111111] tracking-tight">{t.partners_title}</h2>
          <p className="text-stone-500 text-lg max-w-2xl mx-auto">{t.partners_subtitle}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Integrator card */}
          <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm flex flex-col">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50/70 border border-blue-100 w-fit mb-6">
              <Layers className="h-4 w-4 text-stone-700" />
              <span className="text-sm font-bold text-stone-800">{t.partners_integrate_title}</span>
            </div>
            <p className="text-stone-600 mb-6">{t.partners_integrate_desc}</p>
            <ul className="space-y-3 mb-8 flex-1">
              {t.partners_integrate_items.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-stone-700">{item}</span>
                </li>
              ))}
            </ul>
            <a
              href="/book/b0f4db2e" target="_blank" rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] text-white h-12 font-bold text-sm hover:from-[#2563EB] hover:to-[#3B82F6] transition-all active:scale-[0.98]"
            >
              {t.partners_integrate_cta}
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          {/* Ambassador card */}
          <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm flex flex-col">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 w-fit mb-6">
              <Gift className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-bold text-blue-800">{t.partners_ambassador_title}</span>
            </div>
            <p className="text-stone-600 mb-6">{t.partners_ambassador_desc}</p>
            <ul className="space-y-3 mb-8 flex-1">
              {t.partners_ambassador_items.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-stone-700">{item}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => { setShowAmbassadorModal(true); setAmbSent(false) }}
              className="w-full flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] text-white h-12 font-bold text-sm hover:from-[#2563EB] hover:to-[#3B82F6] transition-all active:scale-[0.98]"
            >
              {t.partners_ambassador_cta}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.section>

    {/* Ambassador popup */}
    {showAmbassadorModal && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0A0E27]/60 backdrop-blur-md p-4" onClick={() => setShowAmbassadorModal(false)}>
        <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Gift className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-[#0A0E27]">Devenir Ambassadeur</h3>
              </div>
              <button onClick={() => setShowAmbassadorModal(false)} className="p-2 rounded-full hover:bg-blue-50 transition-colors">
                <X className="h-5 w-5 text-stone-500" />
              </button>
            </div>

            {ambSent ? (
              <div className="text-center py-10">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-8 w-8 text-emerald-600" />
                </div>
                <h4 className="text-lg font-bold text-[#0A0E27] mb-2">Candidature envoyée !</h4>
                <p className="text-stone-500 text-sm">Nous reviendrons vers vous rapidement.</p>
                <button onClick={() => setShowAmbassadorModal(false)} className="mt-6 px-6 py-2.5 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] text-white text-sm font-bold hover:from-[#2563EB] hover:to-[#3B82F6] transition-all">
                  Fermer
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Nom + Prénom */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1.5">Prénom *</label>
                    <input type="text" value={ambFirstName} onChange={e => setAmbFirstName(e.target.value)} placeholder="Jean" className="w-full px-4 py-2.5 rounded-xl bg-blue-50/60 border border-blue-100 text-sm text-[#0A0E27] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 outline-none font-medium" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1.5">Nom *</label>
                    <input type="text" value={ambLastName} onChange={e => setAmbLastName(e.target.value)} placeholder="Dupont" className="w-full px-4 py-2.5 rounded-xl bg-blue-50/60 border border-blue-100 text-sm text-[#0A0E27] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 outline-none font-medium" />
                  </div>
                </div>

                {/* Abonné */}
                <div>
                  <button
                    onClick={() => setAmbIsSubscriber(!ambIsSubscriber)}
                    className="flex items-center gap-3 w-full rounded-xl bg-blue-50/60 border border-blue-100 px-4 py-3 transition-colors hover:bg-blue-100/60"
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${ambIsSubscriber ? 'bg-blue-500 border-blue-500' : 'border-stone-300'}`}>
                      {ambIsSubscriber && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <span className="text-sm font-medium text-[#0A0E27]">Je suis abonné(e) CloseOS</span>
                  </button>
                </div>

                {/* WhatsApp */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1.5">WhatsApp *</label>
                  <PhoneInputLanding value={ambWhatsapp} onChange={setAmbWhatsapp} />
                </div>

                {/* Activité */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1.5">Ce que vous faites</label>
                  <input type="text" value={ambActivity} onChange={e => setAmbActivity(e.target.value)} placeholder="Coach, formateur, créateur de contenu..." className="w-full px-4 py-2.5 rounded-xl bg-blue-50/60 border border-blue-100 text-sm text-[#0A0E27] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 outline-none font-medium" />
                </div>

                {/* Audience slider */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1.5">Taille de votre audience</label>
                  <div className="px-2">
                    <input
                      type="range"
                      min={0}
                      max={AUDIENCE_RANGES.length - 1}
                      value={ambAudienceIdx}
                      onChange={e => setAmbAudienceIdx(Number(e.target.value))}
                      className="w-full h-2 rounded-full appearance-none bg-blue-100 accent-blue-500 cursor-pointer"
                    />
                    <div className="flex justify-between mt-1.5">
                      {AUDIENCE_RANGES.map((r, i) => (
                        <span key={i} className={`text-[9px] font-bold ${i === ambAudienceIdx ? 'text-blue-600' : 'text-stone-400'}`}>{r}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Liens */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1.5">Où vous trouver ? (Insta, LinkedIn, site vitrine…)</label>
                  <input type="text" value={ambPlatforms.join(', ')} onChange={e => setAmbPlatforms(e.target.value ? [e.target.value] : [])} placeholder="https://instagram.com/votre-compte, https://linkedin.com/in/..." className="w-full px-4 py-2.5 rounded-xl bg-blue-50/60 border border-blue-100 text-sm text-[#0A0E27] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 outline-none font-medium" />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1.5">Notes</label>
                  <textarea value={ambNotes} onChange={e => setAmbNotes(e.target.value)} placeholder="Parlez-nous de vous, de votre audience, de vos idées..." rows={3} className="w-full px-4 py-2.5 rounded-xl bg-blue-50/60 border border-blue-100 text-sm text-[#0A0E27] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 outline-none font-medium resize-none" />
                </div>

                <button
                  onClick={handleAmbassadorSubmit}
                  disabled={ambSending || !ambFirstName.trim() || !ambLastName.trim() || !ambWhatsapp.trim()}
                  className="w-full flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] text-white h-12 font-bold text-sm hover:from-[#2563EB] hover:to-[#3B82F6] transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {ambSending ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                    <>
                      <Send className="h-4 w-4" />
                      Envoyer ma candidature
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
};

const FAQSection = () => {
  const { t } = useLang();
  return (
    <motion.section
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="px-6 md:px-20 pt-16 pb-32 bg-blue-50/30"
      id="faq"
    >
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-stone-200 shadow-sm mb-4">
            <span className="text-sm font-semibold text-stone-800">{t.faq_badge}</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-[#111111] tracking-tight">{t.faq_title}</h2>
          <p className="text-stone-500 text-lg">{t.faq_subtitle}</p>
        </div>
        <div className="space-y-4">
          {t.faqs.map((faq, i) => (
            <FAQItem key={i} question={faq.question} answer={<p>{faq.answer}</p>} />
          ))}
        </div>
      </div>
    </motion.section>
  );
};

const ContactModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { t } = useLang();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isSubscriber, setIsSubscriber] = useState(false);
  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const fileRef = useRef<HTMLInputElement>(null);

  const categories = [
    { value: 'Bug', label: t.contact_category_bug },
    { value: 'Feature', label: t.contact_category_feature },
    { value: 'Partnership', label: t.contact_category_partnership },
    { value: 'Help', label: t.contact_category_help },
    { value: 'Billing', label: t.contact_category_billing },
    { value: 'Other', label: t.contact_category_other },
  ];

  const resetForm = () => {
    setName(''); setEmail(''); setIsSubscriber(false); setCategory(''); setSubject(''); setMessage(''); setAttachment(null); setStatus('idle');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');

    try {
      let attachmentBase64: string | undefined;
      let attachmentType: string | undefined;
      let attachmentName: string | undefined;

      if (attachment) {
        attachmentName = attachment.name;
        attachmentType = attachment.type;
        const buffer = await attachment.arrayBuffer();
        attachmentBase64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      }

      const res = await fetch('/api/contact-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, isSubscriber, subject: `[${categories.find(c => c.value === category)?.label || category}]: ${subject}`, message, attachmentBase64, attachmentName, attachmentType }),
      });

      if (!res.ok) throw new Error();
      setStatus('success');
      setTimeout(() => { resetForm(); onClose(); }, 2000);
    } catch {
      setStatus('error');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0A0E27]/60 backdrop-blur-md p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-blue-100">
          <h2 className="text-lg font-bold text-[#0A0E27]">{t.contact_title}</h2>
          <button onClick={() => { resetForm(); onClose(); }} className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors">
            <X className="size-5 text-stone-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t.contact_name}</label>
            <input type="text" required value={name} onChange={e => setName(e.target.value)}
              placeholder={t.contact_name_placeholder}
              className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 outline-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t.contact_email}</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder={t.contact_email_placeholder}
              className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 outline-none" />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isSubscriber} onChange={e => setIsSubscriber(e.target.checked)}
              className="w-4 h-4 rounded border-blue-200 text-blue-600 focus:ring-blue-500" />
            <span className="text-sm text-stone-700">{t.contact_subscriber}</span>
          </label>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t.contact_category}</label>
            <select required value={category} onChange={e => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 outline-none bg-white">
              <option value="" disabled>{t.contact_category_placeholder}</option>
              {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t.contact_subject}</label>
            <input type="text" required value={subject} onChange={e => setSubject(e.target.value)}
              placeholder={t.contact_subject_placeholder}
              className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 outline-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t.contact_message}</label>
            <textarea required rows={5} value={message} onChange={e => setMessage(e.target.value)}
              placeholder={t.contact_message_placeholder}
              className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 outline-none resize-none" />
          </div>

          <div>
            <input ref={fileRef} type="file" className="hidden" onChange={e => setAttachment(e.target.files?.[0] || null)} />
            <button type="button" onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 text-sm text-stone-600 hover:text-stone-900 transition-colors">
              <Paperclip className="size-4" />
              {attachment ? attachment.name : t.contact_attachment}
            </button>
          </div>

          {status === 'success' && (
            <p className="text-sm text-emerald-600 font-medium">{t.contact_success}</p>
          )}
          {status === 'error' && (
            <p className="text-sm text-red-600 font-medium">{t.contact_error}</p>
          )}

          <button type="submit" disabled={status === 'sending'}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] hover:from-[#2563EB] hover:to-[#3B82F6] text-white py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-60">
            {status === 'sending' ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {status === 'sending' ? t.contact_sending : t.contact_send}
          </button>
        </form>
      </div>
    </div>
  );
};

const FooterSection = () => {
  const { t } = useLang();
  const [showContact, setShowContact] = useState(false);
  return (
    <>
      <footer className="px-6 md:px-20 py-6 border-t border-blue-100 bg-blue-50/30 flex flex-col md:flex-row items-center justify-between gap-4 pb-16">
        <div className="flex items-center gap-2">
          <img
            alt="CloseOS CRM"
            className="w-auto object-contain h-10"
            src="/closeos-crm.png"
            loading="lazy"
            width={150}
            height={40}
          />
        </div>
        <div className="flex flex-wrap justify-center items-center gap-4 text-xs text-stone-500 font-medium">
          <span>{t.footer_copyright}</span>
          <span className="hidden sm:inline">&middot;</span>
          <Link to="/mentions-legales" className="hover:text-stone-700 transition-colors">{t.footer_mentions}</Link>
          <span className="hidden sm:inline">&middot;</span>
          <Link to="/cgu" className="hover:text-stone-700 transition-colors">{t.footer_cgu}</Link>
          <span className="hidden sm:inline">&middot;</span>
          <Link to="/cgv" className="hover:text-stone-700 transition-colors">{t.footer_cgv}</Link>
          <span className="hidden sm:inline">&middot;</span>
          <Link to="/confidentialite" className="hover:text-stone-700 transition-colors">{t.footer_confidentialite}</Link>
          <span className="hidden sm:inline">&middot;</span>
          <Link to="/business/politique-utilisation" className="hover:text-stone-700 transition-colors">{t.footer_politique}</Link>
          <span className="hidden sm:inline">&middot;</span>
          <a href="https://www.linkedin.com/in/thomas-shamoev-570885237/" target="_blank" rel="noopener noreferrer" className="hover:text-stone-700 transition-colors">LinkedIn</a>
          <span className="hidden sm:inline">&middot;</span>
          <button onClick={() => setShowContact(true)} className="hover:text-stone-700 transition-colors flex items-center gap-1">
            <Mail className="size-3" />
            {t.footer_contact}
          </button>
        </div>
      </footer>
      <ContactModal open={showContact} onClose={() => setShowContact(false)} />
    </>
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

const getRolesData = (t: typeof translations.fr): RoleData[] => [
  {
    id: 'owner',
    label: t.role_owner.label,
    icon: <Crown className="size-5" />,
    tagline: t.role_owner.tagline,
    description: t.role_owner.description,
    color: 'from-blue-500 to-sky-500',
    features: t.role_owner.features.map((f, i) => ({
      icon: [<Layers className="size-5" />, <Megaphone className="size-5" />, <Phone className="size-5" />, <BarChart3 className="size-5" />, <DollarSign className="size-5" />, <Users className="size-5" />, <Calendar className="size-5" />][i],
      title: f.title,
      items: f.items,
    })),
  },
  {
    id: 'closer',
    label: t.role_closer.label,
    icon: <Target className="size-5" />,
    tagline: t.role_closer.tagline,
    description: t.role_closer.description,
    color: 'from-emerald-500 to-teal-600',
    features: t.role_closer.features.map((f, i) => ({
      icon: [<Layers className="size-5" />, <Phone className="size-5" />, <BarChart3 className="size-5" />, <FileText className="size-5" />][i],
      title: f.title,
      items: f.items,
    })),
  },
  {
    id: 'setter',
    label: t.role_setter.label,
    icon: <Phone className="size-5" />,
    tagline: t.role_setter.tagline,
    description: t.role_setter.description,
    color: 'from-sky-500 to-blue-600',
    features: t.role_setter.features.map((f, i) => ({
      icon: [<Layers className="size-5" />, <Phone className="size-5" />, <BarChart3 className="size-5" />][i],
      title: f.title,
      items: f.items,
    })),
  },
  {
    id: 'setter-closer',
    label: t.role_setter_closer.label,
    icon: <Zap className="size-5" />,
    tagline: t.role_setter_closer.tagline,
    description: t.role_setter_closer.description,
    color: 'from-rose-500 to-pink-600',
    features: t.role_setter_closer.features.map((f, i) => ({
      icon: [<Zap className="size-5" />, <BarChart3 className="size-5" />][i],
      title: f.title,
      items: f.items,
    })),
  },
];

const FeaturesByRole = () => {
  const { t } = useLang();
  const rolesData = getRolesData(t);
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
    <section id="roles" className="px-4 sm:px-6 md:px-20 py-16 sm:py-24 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 16, filter: 'blur(4px)' }}
        whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6, ease: roleEase }}
        className="text-center mb-16 space-y-4"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-stone-200 shadow-sm mb-4">
          <span className="text-sm font-semibold text-stone-800">{t.roles_badge}</span>
        </div>
        <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold text-[#111111] tracking-tight text-balance">
          {t.roles_title}
        </h2>
        <p className="text-stone-500 text-base sm:text-lg max-w-2xl mx-auto text-pretty">
          {t.roles_subtitle}
        </p>
      </motion.div>

      {/* Role Tabs, Desktop: single row with bubble / Mobile: 2x2 grid */}
      {/* Desktop */}
      <div className="hidden sm:flex justify-center mb-12">
        <div
          ref={tabContainerRef}
          className="relative inline-flex rounded-2xl border border-stone-200/50 bg-stone-100/80 backdrop-blur-sm shadow-[0_0_9px_rgba(0,0,0,0.06),0_3px_12px_rgba(0,0,0,0.08)] p-1.5"
        >
          {rolesData.map((role) => (
            <button
              key={role.id}
              ref={(el) => { if (el) tabRefs.current.set(role.id, el); }}
              onClick={() => setActiveRole(role.id)}
              className="relative z-10 flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-bold transition-colors duration-300 cursor-pointer select-none whitespace-nowrap"
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
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/60 via-transparent to-transparent opacity-70 pointer-events-none" />
            <div className="absolute inset-0 rounded-xl bg-gradient-to-tl from-white/30 via-transparent to-transparent opacity-50 pointer-events-none" />
          </motion.div>
        </div>
      </div>

      {/* Mobile: 2x2 grid */}
      <div className="sm:hidden grid grid-cols-2 gap-2 mb-10 px-2">
        {rolesData.map((role) => (
          <button
            key={role.id}
            onClick={() => setActiveRole(role.id)}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${
              activeRole === role.id
                ? 'bg-white text-[#111111] shadow-md border border-stone-200'
                : 'bg-stone-100/80 text-stone-400 border border-transparent'
            }`}
          >
            {role.icon}
            {role.label}
          </button>
        ))}
      </div>

      {/* Role Content */}
      <motion.div
        key={activeRole}
        initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.5, ease: roleEase }}
      >
        {/* Role Header */}
        <div className="bg-[#111111] text-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-12 mb-6 relative overflow-hidden">
          <div className={`absolute top-0 right-0 w-96 h-96 bg-gradient-to-br ${currentRole.color} rounded-full blur-[120px] opacity-30 -translate-y-1/2 translate-x-1/3 pointer-events-none`} />
          <div className="relative z-10 max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                {currentRole.icon}
              </div>
              <span className="text-sm font-bold uppercase tracking-[0.15em] opacity-70">{currentRole.tagline}</span>
            </div>
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-4" style={{ lineHeight: '1.1' }}>
              {currentRole.label}
            </h3>
            <p className="text-lg opacity-80 font-medium leading-relaxed max-w-xl">
              {currentRole.description}
            </p>
          </div>
        </div>

        {/* Feature Cards */}
        <div className={`grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4`}>
          {currentRole.features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 16, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: roleEase }}
              className="bg-white rounded-xl p-4 border border-stone-200 shadow-sm hover:shadow-md transition-shadow duration-300"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center text-[#111111] flex-shrink-0 [&>svg]:size-4">
                  {feature.icon}
                </div>
                <h4 className="font-bold text-[#111111] text-sm leading-tight">{feature.title}</h4>
              </div>
              <ul className="space-y-1.5">
                {feature.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-1.5 text-xs text-stone-500 font-medium leading-snug">
                    <ArrowRight className="size-3 text-stone-300 mt-0.5 flex-shrink-0" />
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
              <span className="font-bold text-[#111111]">{t.shared_access_label}</span>{' '}
              {activeRole === 'setter-closer'
                ? t.shared_access_setter_closer
                : t.shared_access_default}
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
                <span className="font-bold text-[#111111] text-sm">{t.admin_label}</span>
              </div>
              <p className="text-sm text-stone-500 font-medium">
                {t.admin_description}
              </p>
            </div>
            <div className="bg-stone-100 rounded-2xl p-6 border border-stone-200">
              <div className="flex items-center gap-2.5 mb-2">
                <ClipboardList className="size-4 text-[#111111]" />
                <span className="font-bold text-[#111111] text-sm">{t.hos_label}</span>
              </div>
              <p className="text-sm text-stone-500 font-medium">
                {t.hos_description}
              </p>
            </div>
          </motion.div>
        )}
      </motion.div>
    </section>
  );
};

const WaitingListModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { t } = useLang();
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
          setErrorMessage(t.modal_error_already_registered);
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
      setErrorMessage(err.message || t.modal_error_generic);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0A0E27]/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-blue-50 transition-colors text-stone-500"
        >
          <X className="size-5" />
        </button>

        <div className="p-8 pt-12 text-center">
          <div className="bg-gradient-to-br from-[#3B82F6] to-[#60A5FA] w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/30">
            <Mail className="size-8 text-white" />
          </div>

          {status === 'success' ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-[#0A0E27] text-3xl font-bold tracking-tight">{t.modal_success_title}</h3>
                <p className="text-stone-500 font-medium text-center">
                  {t.modal_success_description}
                </p>
              </div>

              <div className="relative pt-[56.25%] w-full rounded-2xl overflow-hidden shadow-md border border-blue-100 bg-black">
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src="https://www.youtube.com/embed/DP1me04gNbk?autoplay=1"
                  title="CloseOS CRM Introduction"
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
                  {t.modal_whatsapp}
                  <ExternalLink className="size-4" />
                </a>
                <a
                  href="https://docs.google.com/forms/d/e/1FAIpQLSfG_km1jRFBreeHvhksMAvAxwokZEOdahTicsKikNwk71IUwg/viewform"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] text-white py-3.5 rounded-xl font-bold hover:opacity-90 transition-all shadow-sm"
                >
                  {t.modal_google_form}
                  <ExternalLink className="size-4" />
                </a>
                <a
                  href="https://www.linkedin.com/in/thomas-shamoev/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-[#0A66C2] text-white py-3.5 rounded-xl font-bold hover:opacity-90 transition-all shadow-sm"
                >
                  {t.modal_linkedin}
                  <ExternalLink className="size-4" />
                </a>
              </div>
            </div>
          ) : (
            <>
              <h3 className="text-[#0A0E27] text-3xl font-bold mb-3 tracking-tight">{t.modal_title}</h3>
              <p className="text-stone-500 mb-8 font-medium">
                {t.modal_description.split('{date}')[0]}<strong className="text-[#0A0E27]">{t.modal_description_date}</strong>{t.modal_description.split('{date}')[1]?.split('{locked}')[0]}<strong className="text-[#0A0E27]">{t.modal_description_locked}</strong>{t.modal_description.split('{locked}')[1]}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative text-left">
                  <label htmlFor="email" className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1 mb-1 block">
                    {t.modal_email_label}
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    placeholder={t.modal_email_placeholder}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-blue-50/40 border border-blue-100 rounded-xl px-4 py-4 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 outline-none transition-all text-[#0A0E27] font-semibold placeholder:font-medium placeholder:text-stone-400"
                  />
                </div>

                {status === 'error' && (
                  <p className="text-rose-500 text-xs font-bold text-left ml-1 italic">{errorMessage}</p>
                )}

                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="w-full bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] text-white rounded-xl py-4 font-bold text-lg shadow-md hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {status === 'loading' ? (
                    <>
                      <Loader2 className="size-5 animate-spin" />
                      {t.modal_loading}
                    </>
                  ) : (
                    t.modal_submit
                  )}
                </button>

                <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest text-center mt-4">
                  {t.modal_footer}
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

export default CRMLanding;
