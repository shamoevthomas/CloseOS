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
  Code,
  Lock,
  Webhook,
  Sparkles,
  Star,
  Bot,
} from 'lucide-react';
import { translations, detectLang, LangContext, useLang } from './businessLandingI18n';
import type { Lang } from './businessLandingI18n';
import {
  DoodleSquiggle, DoodleCircle, DoodleBubble, DoodleFace, DoodlePlane, DoodleSparkle,
  DoodleCross, DoodleDashes, DoodleBolt, DoodleTarget, DoodleRocket, DoodleCoin,
  DoodleChartUp, DoodleHeart, DoodleStar5, DoodleBurst, DoodleCheck, DoodleBulb,
  DoodleTrophy, DoodleClock, DoodleZigzag,
} from '../components/doodles';

export const BusinessLanding: React.FC = () => {
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
    document.getElementById('canonical')?.setAttribute('href', 'https://www.closeos.fr/business');
    document.getElementById('og-url')?.setAttribute('content', 'https://www.closeos.fr/business');
    document.getElementById('og-title')?.setAttribute('content', t.seo_og_title);
    document.getElementById('og-description')?.setAttribute('content', t.seo_og_description);
    document.getElementById('og-image')?.setAttribute('content', 'https://www.closeos.fr/og-business.png');

    // Twitter Card
    document.getElementById('tw-url')?.setAttribute('content', 'https://www.closeos.fr/business');
    document.getElementById('tw-title')?.setAttribute('content', t.seo_og_title);
    document.getElementById('tw-description')?.setAttribute('content', t.seo_og_description);
    document.getElementById('tw-image')?.setAttribute('content', 'https://www.closeos.fr/og-business.png');
    document.documentElement.lang = lang;

    // hreflang tags
    document.querySelectorAll('link[data-hreflang]').forEach(el => el.remove());
    const hreflangs = [
      { lang: 'fr', href: 'https://www.closeos.fr/business' },
      { lang: 'en', href: 'https://www.closeos.fr/business?lang=en' },
      { lang: 'x-default', href: 'https://www.closeos.fr/business' },
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
      name: 'CloseOS Business',
      url: 'https://www.closeos.fr/business',
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
          name: t.sd_faq_api_q,
          acceptedAnswer: {
            '@type': 'Answer',
            text: t.sd_faq_api_a,
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
        { '@type': 'ListItem', position: 2, name: 'CloseOS Business', item: 'https://www.closeos.fr/business' },
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
    <div ref={pageRef} className={`bg-[#f4f2f1] font-sans text-[#111111] min-h-screen selection:bg-[#8a43e1]/20 transition-all duration-500 ${isExiting ? 'translate-y-full opacity-0' : 'animate-[pageEnterFromTop_0.5s_ease-out]'}`}>

      {/* Navigation */}
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-7xl">
        <div className="bg-white/80 backdrop-blur-md border border-stone-200/50 rounded-2xl px-8 py-3.5 flex items-center justify-between shadow-sm">
          <div className="relative group flex items-center gap-1 cursor-pointer">
            <img
              alt="CloseOS Business"
              className="w-auto object-contain h-12"
              src="/closeos-business-logo-ecrit.png"
              fetchPriority="high"
              width={180}
              height={48}
            />
            <ChevronDown className="h-4 w-4 text-stone-400 group-hover:text-stone-800 transition-transform duration-300 group-hover:rotate-180" />
            <div className="absolute top-full left-0 right-0 mt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 translate-y-2 group-hover:translate-y-0">
              <a onClick={handleNavigateToSales} className="block rounded-xl border border-white/10 bg-[#020617] p-3 shadow-xl hover:bg-[#0f172a] transition-colors cursor-pointer">
                <img src="/logo-sales.png" alt="CloseOS Sales" className="w-full h-auto" loading="lazy" width={200} height={40} />
              </a>
              <a onClick={handleNavigateToSign} className="mt-2 block rounded-xl border border-white/10 bg-[#191E1E] p-3 shadow-xl hover:bg-[#222828] transition-colors cursor-pointer">
                <img src="/CLOSEOS-SIGN-LOGO.png" alt="CloseOS Sign" className="w-full h-auto" loading="lazy" width={200} height={48} />
              </a>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-stone-600">
            <a href="#features" className="hover:text-[#111111] transition-colors">{t.nav_management}</a>
            <a href="#crm" className="hover:text-[#111111] transition-colors">{t.nav_crm}</a>
            <a href="#api" className="hover:text-[#111111] transition-colors">{t.nav_api}</a>
            <a href="#roles" className="hover:text-[#111111] transition-colors">{t.nav_roles}</a>
            <a href="#demo" className="hover:text-[#111111] transition-colors">{t.nav_demo}</a>
            <a href="#pricing" className="hover:text-[#111111] transition-colors">{t.nav_pricing}</a>
            <a href="#partners" className="hover:text-[#111111] transition-colors">{t.nav_partners}</a>
            <a href="#faq" className="hover:text-[#111111] transition-colors">{t.nav_faq}</a>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
              className="hidden md:flex items-center gap-1.5 p-3 rounded-lg hover:bg-stone-100 transition-colors text-stone-500"
              aria-label="Change language"
            >
              <Globe className="size-4" />
              <span className="text-xs font-bold uppercase">{lang === 'fr' ? 'EN' : 'FR'}</span>
            </button>
            <Link
              to="/business/login"
              className="hidden sm:flex items-center justify-center rounded-lg h-10 px-5 text-stone-700 text-sm font-semibold tracking-wide hover:text-stone-900 transition-all"
            >
              {lang === 'fr' ? 'Se connecter' : 'Log in'}
            </Link>
            <a
              href="#pricing"
              className="hidden sm:flex items-center justify-center rounded-lg h-10 px-5 text-white text-sm font-semibold tracking-wide hover:opacity-90 transition-all bg-[#111111]"
            >
              {lang === 'fr' ? 'Commencer' : 'Get started'}
            </a>
            <button
              onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
              className="md:hidden p-2 text-stone-600"
              aria-label="Change language"
            >
              <Globe className="size-5" />
            </button>
            <button className="md:hidden p-3 text-stone-600" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} aria-label="Menu" aria-expanded={isMobileMenuOpen}>
              {isMobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
        {isMobileMenuOpen && (
          <div className="md:hidden mt-2 bg-white/90 backdrop-blur-md border border-stone-200/50 rounded-2xl px-6 py-4 shadow-lg flex flex-col gap-4 text-sm font-medium text-stone-600">
            <a href="#features" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-[#111111] transition-colors py-1">{t.nav_management}</a>
            <a href="#crm" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-[#111111] transition-colors py-1">{t.nav_crm}</a>
            <a href="#roles" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-[#111111] transition-colors py-1">{t.nav_roles}</a>
            <a href="#demo" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-[#111111] transition-colors py-1">{t.nav_demo}</a>
            <a href="#pricing" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-[#111111] transition-colors py-1">{t.nav_pricing}</a>
            <a href="#partners" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-[#111111] transition-colors py-1">{t.nav_partners}</a>
            <a href="#faq" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-[#111111] transition-colors py-1">{t.nav_faq}</a>
            <Link
              to="/business/login"
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-stone-700 font-semibold text-sm py-1 sm:hidden"
            >
              {lang === 'fr' ? 'Se connecter' : 'Log in'}
            </Link>
            <a
              href="#pricing"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center justify-center rounded-lg h-10 px-5 text-white text-sm font-semibold tracking-wide hover:opacity-90 transition-all bg-[#111111] sm:hidden"
            >
              {lang === 'fr' ? 'Commencer' : 'Get started'}
            </a>
          </div>
        )}
      </nav>

      <main className="flex flex-col flex-1 pt-16">
        {/* Hero Section */}
        <section className="px-6 md:px-20 py-10 md:py-14 max-w-6xl mx-auto text-center relative">

          {/* Abstract Background Blobs */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[500px] opacity-30 pointer-events-none z-0">
            <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-[#ff2f2f] rounded-full filter blur-[100px] animate-blob"></div>
            <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-[#ef7b16] rounded-full filter blur-[100px] animate-blob animation-delay-2000"></div>
            <div className="absolute -bottom-8 left-1/3 w-64 h-64 bg-[#8a43e1] rounded-full filter blur-[100px] animate-blob animation-delay-4000"></div>
          </div>

          {/* Doodles hero (discrets) */}
          <div className="pointer-events-none select-none absolute inset-0 hidden md:block z-0" aria-hidden="true">
            <DoodleBubble className="absolute left-[2%] top-[34%] w-14 text-neutral-800/70 -rotate-6" />
            <DoodleFace className="absolute right-[3%] top-[26%] w-12 text-neutral-800/70 rotate-6" />
            <DoodleSparkle className="absolute left-[8%] top-[16%] w-6 text-emerald-500" />
            <DoodleStar5 className="absolute right-[9%] top-[14%] w-5 text-emerald-500" />
            <DoodlePlane className="absolute right-[5%] top-[64%] w-20 text-emerald-500" />
            <DoodleCross className="absolute left-[10%] top-[64%] w-4 text-emerald-500" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col items-center gap-8 max-w-4xl mx-auto relative z-10"
          >
            <div className="flex items-center gap-3 flex-wrap justify-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
                <span className="text-xs font-bold text-emerald-700">{t.hero_badge_rgpd}</span>
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-stone-200 shadow-sm">
                <span className="text-sm font-medium text-stone-800">
                  🚀 {t.hero_badge_closers_text.split('{count}')[0]}<span className="font-bold bg-gradient-to-r from-[#ff2f2f] via-[#ef7b16] to-[#d511fd] text-transparent bg-clip-text">{t.hero_badge_closers}</span>{t.hero_badge_closers_text.split('{count}')[1]}
                </span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
                <span className="text-xs font-bold text-emerald-700">{t.hero_badge_eco}</span>
              </div>
            </div>

            <h1 className="relative text-5xl md:text-7xl lg:text-[80px] font-bold leading-[1.1] tracking-tight text-[#111111]">
              {t.hero_title}
              <DoodleSquiggle className="pointer-events-none absolute left-1/2 -translate-x-1/2 -bottom-4 w-48 md:w-56 text-emerald-500" aria-hidden="true" />
            </h1>

            <p className="text-stone-500 text-base font-semibold bg-red-50 border border-red-100 px-5 py-2.5 rounded-full">
              {t.hero_pain}
            </p>

            <p className="text-stone-600 text-lg md:text-xl font-medium leading-relaxed max-w-2xl">
              {t.hero_subtitle}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-4">
              <a
                href="#pricing"
                className="flex min-w-[200px] items-center justify-center rounded-xl h-14 px-8 text-white text-lg font-semibold shadow-lg hover:-translate-y-1 transition-all bg-[#111111]"
              >
                {lang === 'fr' ? 'Commencer maintenant' : 'Get started now'}
              </a>
            </div>
            <a href="https://www.whatsapp.com/channel/0029Vb7P4lqDDmFLVtD7Jn0s" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 text-sm text-stone-500 hover:text-[#111111] transition-colors group mt-2">
              <span className="text-green-500">📲</span>
              <span className="underline underline-offset-4 decoration-stone-300 group-hover:decoration-[#111111] transition-all">{lang === 'fr' ? 'Rejoindre le canal WhatsApp' : 'Join the WhatsApp channel'}</span>
            </a>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex items-center gap-0.5">
                {[0, 1, 2, 3, 4].map(i => (
                  <Star key={i} className="h-4 w-4 text-[#facc15] fill-[#facc15]" strokeWidth={1.5} />
                ))}
              </div>
              <p className="text-sm text-stone-500 font-medium">
                {t.hero_social_proof.split('{count}')[0]}<span className="font-bold text-[#111111]">{t.hero_social_proof_count}</span>{t.hero_social_proof.split('{count}')[1]}
              </p>
            </div>

          </motion.div>
        </section>

        {/* Compact Integrations Strip */}
        <section id="integrations" className="pt-8 pb-4 w-full overflow-hidden">
          <div className="text-center mb-4 md:mb-5 px-6 md:px-20">
            <h2 className="text-lg md:text-xs font-bold uppercase tracking-[0.1em] md:tracking-[0.2em] text-[#111111] md:text-stone-500 mb-2 md:mb-1">{t.integrations_header}</h2>
            <p className="text-sm md:text-[11px] text-stone-500 md:text-stone-400">{t.integrations_subheader}</p>
          </div>
          {(() => {
            const allIntegrations = [
              { name: 'HubSpot', logo: '/hubspot.webp' },
              { name: 'Pipedrive', logo: '/pipedrive.webp' },
              { name: 'GoHighLevel', logo: '/ghl.webp' },
              { name: 'Airtable', logo: '/airtable.webp' },
              { name: 'Systeme.io', logo: '/systemeio.webp' },
              { name: 'iClosed', logo: '/iclosed.webp' },
              { name: 'Google Calendar', logo: '/gcalendar.webp' },
              { name: 'Stripe', logo: '/stripe.webp' },
              { name: 'Calendly', logo: '/calendly.webp' },
              { name: 'Zapier', logo: '/zapier.webp' },
              { name: 'Make', logo: '/make.webp' },
              { name: 'n8n', logo: '/n8n.webp' },
              { name: 'CSV', logo: '/logocsv.webp' },
              { name: 'MCP', logo: '/mcp.webp' },
              { name: 'Claude', logo: '/claude.webp' },
              { name: 'ChatGPT', logo: '/chatgpt.webp' },
            ];
            const topRow = allIntegrations.filter((_, i) => i % 2 === 0);
            const bottomRow = allIntegrations.filter((_, i) => i % 2 === 1);
            const IntegrationCard = ({ integration, dupKey }: { integration: { name: string; logo: string }; dupKey: string }) => (
              <div
                key={dupKey}
                className="flex items-center gap-2.5 px-4 py-2.5 bg-white rounded-xl border border-stone-200/80 shadow-sm min-w-[130px]"
              >
                <img src={integration.logo} alt={integration.name} className="h-5 w-auto object-contain" loading="lazy" width={80} height={20} />
                <span className="text-xs font-semibold text-[#111111] whitespace-nowrap">{integration.name}</span>
              </div>
            );
            return (
              <div className="relative overflow-hidden space-y-3">
                <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#f4f2f1] to-transparent z-10 pointer-events-none" />
                <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#f4f2f1] to-transparent z-10 pointer-events-none" />
                <div className="flex animate-scroll-left gap-4 w-max">
                  {[...Array(3)].map((_, dup) => (
                    <div key={dup} className="flex gap-4">
                      {topRow.map((integration) => (
                        <IntegrationCard key={`${dup}-${integration.name}`} integration={integration} dupKey={`${dup}-${integration.name}`} />
                      ))}
                    </div>
                  ))}
                </div>
                <div className="flex animate-scroll-right gap-4 w-max">
                  {[...Array(3)].map((_, dup) => (
                    <div key={dup} className="flex gap-4">
                      {bottomRow.map((integration) => (
                        <IntegrationCard key={`${dup}-${integration.name}`} integration={integration} dupKey={`${dup}-${integration.name}`} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </section>

        {/* Dashboard Macro Section (Bento Grid) */}
        <motion.section
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative overflow-hidden px-6 md:px-20 py-24 max-w-7xl mx-auto"
          id="features"
        >
          <div className="pointer-events-none select-none absolute inset-0 hidden lg:block" aria-hidden="true">
            <DoodleChartUp className="absolute left-[1%] top-[8%] w-14 text-emerald-500 -rotate-3" />
            <DoodleBolt className="absolute left-[5%] top-[30%] w-5 text-emerald-500" />
            <DoodleTarget className="absolute left-[1%] top-[52%] w-12 text-neutral-800/70" />
            <DoodleStar5 className="absolute left-[5%] top-[76%] w-5 text-emerald-500" />
            <DoodleSparkle className="absolute right-[5%] top-[8%] w-6 text-emerald-500" />
            <DoodleBulb className="absolute right-[1%] top-[30%] w-11 text-neutral-800/70" />
            <DoodlePlane className="absolute right-[2%] top-[54%] w-20 text-emerald-500 rotate-6" />
            <DoodleZigzag className="absolute right-[4%] top-[78%] w-12 text-stone-300" />
          </div>
          <div className="text-center mb-16 space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-stone-200 shadow-sm mb-4">
              <span className="text-sm font-semibold text-stone-800">{t.management_badge}</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-[#111111] tracking-tight">{t.management_title}</h2>
            <p className="text-stone-600 text-lg max-w-2xl mx-auto">{t.management_description}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Macro Dashboard */}
            <div className="lg:col-span-3 bg-white rounded-3xl p-8 border border-stone-200 shadow-sm">
              <div className="mb-8">
                <h3 className="text-2xl font-bold text-[#111111] mb-2">{t.dashboard_title}</h3>
                <p className="text-stone-500">{t.dashboard_description}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPIBox index={0} title={t.kpi_ca_reel} value="145,000€" change="+15%" icon={<ArrowUp className="text-emerald-500 size-5" />} positive={true} />
                <KPIBox index={1} title={t.kpi_ca_closer} value="12,400€" change="+5%" icon={<ArrowUp className="text-emerald-500 size-5" />} positive={true} />
                <KPIBox index={2} title={t.kpi_taux_closing} value="28%" change="-2%" icon={<ArrowDown className="text-rose-500 size-5" />} positive={false} />
                <KPIBox index={3} title={t.kpi_taux_noshow} value="12%" change="-4%" icon={<ArrowDown className="text-rose-500 size-5" />} positive={false} />
              </div>
            </div>

            {/* Team Management */}
            <TeamManagement />

            {/* Shared Pipeline */}
            <SharedPipeline />

            {/* Revenue & Stripe */}
            <RevenueStripe />

            {/* Onboarding */}
            <Onboarding />

            {/* Tracking Links */}
            <TrackingLinksTile />
          </div>
        </motion.section>

        {/* CRM Feature Teaser */}
        <motion.section
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="px-6 md:px-20 py-32 bg-white border-t border-stone-200 relative overflow-hidden"
          id="crm"
        >
          <div className="pointer-events-none select-none absolute inset-0 hidden lg:block" aria-hidden="true">
            <DoodleTarget className="absolute left-[2%] top-[6%] w-12 text-neutral-800/70" />
            <DoodleCoin className="absolute left-[5%] top-[22%] w-11 text-emerald-500 -rotate-6" />
            <DoodleBulb className="absolute left-[2%] top-[38%] w-11 text-neutral-800/70" />
            <DoodleCheck className="absolute left-[5%] top-[54%] w-8 text-emerald-500" />
            <DoodleStar5 className="absolute left-[2%] top-[70%] w-5 text-emerald-500" />
            <DoodleFace className="absolute left-[3%] top-[86%] w-12 text-neutral-800/70 -rotate-3" />
            <DoodleChartUp className="absolute right-[2%] top-[6%] w-12 text-emerald-500 rotate-3" />
            <DoodleBubble className="absolute right-[2%] top-[24%] w-14 text-neutral-800/70 rotate-6" />
            <DoodleBolt className="absolute right-[6%] top-[42%] w-5 text-emerald-500" />
            <DoodleHeart className="absolute right-[3%] top-[58%] w-6 text-emerald-500" />
            <DoodleZigzag className="absolute right-[4%] top-[74%] w-12 text-stone-300" />
            <DoodleBurst className="absolute right-[6%] top-[90%] w-6 text-emerald-500" />
          </div>
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="text-center mb-20">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-stone-100 border border-stone-200 shadow-sm mb-6">
                <span className="text-sm font-semibold text-stone-800 uppercase tracking-widest">{t.crm_badge}</span>
              </div>
              <h2 className="text-5xl md:text-6xl font-bold mb-6 text-[#111111] tracking-tight">{t.crm_title}</h2>
              <p className="text-stone-500 text-xl max-w-3xl mx-auto font-medium">
                {t.crm_subtitle}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-20">
              <div className="lg:col-span-7">
                <LeadProfile />
              </div>
              <div className="lg:col-span-5 flex flex-col justify-center gap-4">
                <CRMFeatureCard icon={<Layers className="size-5" />} titleKey="crm_feature_pipeline_title" descKey="crm_feature_pipeline_desc" />
                <CRMFeatureRelances />
                <CRMFeatureTags />
                <CRMFeatureCard icon={<FileText className="size-5" />} titleKey="crm_feature_csv_title" descKey="crm_feature_csv_desc" />
              </div>
            </div>

            {/* Capture Section */}
            <CaptureSection />

            {/* Qualification Section */}
            <QualificationSection />

            {/* Forms Section */}
            <FormsSection />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-16 border-t border-stone-200">
              <CRMKPIBox index={0} titleKey="crm_kpi_pipeline_title" valueKey="crm_kpi_pipeline_value" descKey="crm_kpi_pipeline_desc" />
              <CRMKPIBox index={1} titleKey="crm_kpi_performance_title" valueKey="crm_kpi_performance_value" descKey="crm_kpi_performance_desc" />
              <CRMKPIBox index={2} titleKey="crm_kpi_velocity_title" valueKey="crm_kpi_velocity_value" descKey="crm_kpi_velocity_desc" />
            </div>

            <div className="flex justify-center mt-12">
              <a
                href="#demo"
                className="flex items-center justify-center rounded-xl h-14 px-8 text-white text-lg font-semibold shadow-lg hover:-translate-y-1 transition-all bg-[#111111]"
              >
                {t.crm_book_demo}
              </a>
            </div>
          </div>
        </motion.section>

        {/* API & Webhooks Section */}
        <APISection />

        {/* Features by Role Section */}
        <FeaturesByRole />

        <div className="flex justify-center -mt-8 mb-16">
          <a
            href="#pricing"
            className="flex items-center justify-center rounded-xl h-14 px-8 text-white text-lg font-semibold shadow-lg hover:-translate-y-1 transition-all bg-[#111111]"
          >
            {lang === 'fr' ? 'Commencer' : 'Get started'}
          </a>
        </div>

        {/* Demo Section */}
        <motion.section
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          id="demo"
          className="relative overflow-hidden px-6 md:px-12 pt-24 pb-8 max-w-[1800px] mx-auto"
        >
          <div className="pointer-events-none select-none absolute inset-x-0 top-0 h-72 hidden lg:block" aria-hidden="true">
            <DoodleBulb className="absolute left-[6%] top-[20%] w-11 text-neutral-800/70 -rotate-6" />
            <DoodleSparkle className="absolute left-[16%] top-[54%] w-6 text-emerald-500" />
            <DoodleTarget className="absolute right-[6%] top-[18%] w-12 text-emerald-500" />
            <DoodleStar5 className="absolute right-[16%] top-[56%] w-5 text-emerald-500" />
          </div>
          <div className="space-y-8">
            <div className="text-center max-w-2xl mx-auto">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-stone-400 mb-3">{t.demo_label}</p>
              <h2 className="text-4xl md:text-5xl font-bold text-[#111111] tracking-tight mb-4">
                {t.demo_title}
              </h2>
              <p className="text-stone-500 text-lg mb-4">
                {t.demo_description}
              </p>
              <div className="flex flex-wrap justify-center gap-6 text-stone-600 font-medium text-sm">
                <span className="flex items-center gap-2"><CheckCircle className="size-4 text-emerald-500 shrink-0" /> {t.demo_check_adapted}</span>
                <span className="flex items-center gap-2"><CheckCircle className="size-4 text-emerald-500 shrink-0" /> {t.demo_check_questions}</span>
                <span className="flex items-center gap-2"><CheckCircle className="size-4 text-emerald-500 shrink-0" /> {t.demo_check_free}</span>
              </div>
            </div>
            <div className="max-w-[1200px] mx-auto">
              <iframe
                ref={demoIframeRef}
                id="closeos-embed"
                src={`/capture/d8cbeca2-3a35-424a-b549-c0fbe1dd1aee?embed=true&layout=horizontal&lang=${lang}`}
                width="100%"
                height={530}
                frameBorder="0"
                scrolling="no"
                style={{ border: 'none', borderRadius: 12, overflow: 'hidden', transition: 'height 0.4s ease' }}
              />
            </div>
          </div>
        </motion.section>

        {/* Pricing Section */}
        <PricingSection />

        {/* Savings comparison (honest) */}
        <SavingsSection />

        {/* Partners Section */}
        <PartnerSection />

        {/* FAQ Section */}
        <FAQSection />

        {/* Final CTA */}
        <motion.section
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative overflow-hidden px-6 md:px-20 py-32 bg-white text-center border-t border-stone-200"
        >
          <div className="pointer-events-none select-none absolute inset-0 hidden md:block" aria-hidden="true">
            <DoodleRocket className="absolute right-[10%] top-[18%] w-14 text-emerald-500 rotate-6" />
            <DoodleBurst className="absolute left-[12%] top-[22%] w-7 text-emerald-500" />
            <DoodleBolt className="absolute left-[7%] top-[54%] w-6 text-emerald-500" />
            <DoodleStar5 className="absolute right-[16%] top-[60%] w-5 text-emerald-500" />
            <DoodleHeart className="absolute left-[16%] top-[64%] w-6 text-emerald-500" />
            <DoodleZigzag className="absolute left-[7%] top-[38%] w-12 text-stone-300" />
            <DoodleTrophy className="absolute right-[7%] top-[54%] w-11 text-neutral-800/70 rotate-6" />
            <DoodleDashes className="absolute right-[6%] top-[36%] w-11 text-stone-300 -rotate-6" />
          </div>
          <div className="max-w-3xl mx-auto space-y-10 relative z-10">
            <h2 className="text-5xl md:text-6xl font-bold leading-tight tracking-tight text-[#111111]">{t.final_cta_title}</h2>
            <p className="text-stone-500 text-xl">{t.final_cta_subtitle}</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <a
                href="#pricing"
                className="w-full sm:w-auto flex min-w-[240px] items-center justify-center rounded-xl h-16 px-10 text-white text-lg font-semibold shadow-xl hover:-translate-y-1 transition-all bg-[#111111]"
              >
                {lang === 'fr' ? 'Commencer maintenant' : 'Get started now'}
              </a>
            </div>
          </div>
        </motion.section>
      </main>

      <FooterSection />

      {/* Fixed bottom blur cue */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#f4f2f1] via-[#f4f2f1]/80 to-transparent backdrop-blur-[1px] pointer-events-none z-[80]" />

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
        <div className="fixed inset-0 z-[200] flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-6 md:py-10 animate-in fade-in duration-300" onClick={() => setShowDemoPopup(false)}>
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-3xl w-full mx-4 shadow-2xl my-auto animate-in slide-in-from-bottom-4 duration-500" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="text-xl md:text-2xl font-extrabold text-[#111111] tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {lang === 'fr' ? 'Pas encore convaincu ?' : 'Not convinced yet?'}
                </h3>
                <p className="text-sm text-stone-500 mt-1">
                  {lang === 'fr'
                    ? 'Réservez un appel de 15 min avec notre équipe, on vous montre comment CloseOS s\'adapte à votre business.'
                    : 'Book a 15-min call with our team, we\'ll show you how CloseOS fits your business.'}
                </p>
              </div>
              <button onClick={() => setShowDemoPopup(false)} className="text-stone-400 hover:text-stone-600 transition-colors p-1">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4">
              <iframe
                ref={demoPopupIframeRef}
                src="https://www.closeos.fr/capture/d8cbeca2-3a35-424a-b549-c0fbe1dd1aee?embed=true&layout=horizontal"
                width="100%"
                height={530}
                frameBorder="0"
                scrolling="yes"
                style={{ border: 'none', borderRadius: 12, overflow: 'hidden', transition: 'height 0.4s ease' }}
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
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#ff2f2f]/20 to-[#8a43e1]/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>

      <div className="pointer-events-none select-none absolute inset-0 hidden lg:block" aria-hidden="true">
        <DoodleRocket className="absolute right-[6%] top-[12%] w-11 text-emerald-400 rotate-6" />
        <DoodleStar5 className="absolute right-[16%] top-[8%] w-5 text-emerald-400" />
        <DoodleBurst className="absolute right-[10%] top-[70%] w-6 text-emerald-400/80" />
        <DoodleCheck className="absolute left-[46%] top-[10%] w-7 text-emerald-400" />
        <DoodleZigzag className="absolute right-[4%] top-[44%] w-12 text-white/25" />
      </div>

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

const TrackingLinksTile = () => {
  const { t } = useLang();
  const stats = [
    { country: t.tracking_stat_country_1, pct: 62 },
    { country: t.tracking_stat_country_2, pct: 23 },
    { country: t.tracking_stat_country_3, pct: 15 },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, delay: 0.2 }}
      className="lg:col-span-3 bg-white rounded-3xl p-8 md:p-10 border border-stone-200 shadow-sm"
    >
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
        <div className="lg:col-span-2 flex flex-col justify-center">
          <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center mb-6">
            <Globe className="size-6 text-stone-800" />
          </div>
          <h3 className="text-2xl font-bold text-[#111111] mb-3">{t.tracking_title}</h3>
          <p className="text-stone-500">
            {t.tracking_description}
          </p>
        </div>
        <div className="lg:col-span-3 flex items-center">
          <div className="bg-stone-50 rounded-2xl p-6 border border-stone-100 w-full">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-4 block">{t.tracking_stat_label}</span>
            <div className="space-y-3">
              {stats.map((s, i) => (
                <div key={s.country} className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-stone-600 w-16 shrink-0">{s.country}</span>
                  <div className="flex-1 h-2 rounded-full bg-stone-200 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${s.pct}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, delay: 0.3 + i * 0.1, ease: 'easeOut' }}
                    />
                  </div>
                  <span className="text-xs font-bold text-stone-400 w-8 text-right">{s.pct}%</span>
                </div>
              ))}
            </div>
          </div>
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
      description={t.crm_feature_relances_desc}
      extra={
        <div className="mt-3 bg-amber-100 text-amber-800 px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 w-fit">
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
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-100 border border-stone-200 shadow-sm mb-6 w-fit">
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
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
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
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ff2f2f] to-[#8a43e1] flex items-center justify-center">
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
    if (score >= 40) return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', bar: 'bg-amber-500' };
    return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600', bar: 'bg-red-500' };
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-20">
      {/* Left, Text */}
      <div className="lg:col-span-5 flex flex-col justify-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-100 border border-stone-200 shadow-sm mb-6 w-fit">
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
                <span className="text-sm font-black text-amber-600">56%</span>
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

const FormsSection = () => {
  const { t } = useLang();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-20">
      {/* Left, Text */}
      <div className="lg:col-span-5 flex flex-col justify-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-100 border border-stone-200 shadow-sm mb-6 w-fit">
          <FileText className="size-3.5 text-stone-600" />
          <span className="text-xs font-bold text-stone-600 uppercase tracking-widest">{t.forms_badge}</span>
        </div>
        <h3 className="text-3xl md:text-4xl font-bold text-[#111111] tracking-tight mb-4">{t.forms_title}</h3>
        <p className="text-stone-500 text-lg font-medium leading-relaxed mb-6">
          {t.forms_subtitle}
        </p>
        <div className="space-y-3">
          {([t.forms_check_1, t.forms_check_2, t.forms_check_3, t.forms_check_4]).map((item, i) => (
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
          {/* Browser bar */}
          <div className="p-5 pb-0">
            <div className="bg-stone-100 rounded-xl p-3 flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              </div>
              <div className="flex-1 bg-white rounded-lg px-3 py-1.5 text-xs text-stone-400 font-mono">
                {t.forms_mock_url}
              </div>
            </div>
          </div>

          {/* Form blocks */}
          <div className="p-6 space-y-4">
            <div>
              <p className="text-lg font-bold text-[#111111] mb-2">{t.forms_mock_block_heading}</p>
              <div className="h-10 rounded-lg bg-stone-50 border border-stone-200" />
            </div>

            <div className="rounded-2xl border border-stone-200 bg-stone-900 p-4 relative overflow-hidden">
              <div className="flex items-center gap-2 mb-2">
                <div className="size-7 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Video className="size-3.5 text-white" />
                </div>
                <p className="text-sm font-semibold text-white">{t.forms_mock_block_video}</p>
              </div>
              <div className="aspect-video rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-2">
                <div className="size-10 rounded-full bg-white/15 flex items-center justify-center">
                  <div className="w-0 h-0 border-y-[6px] border-y-transparent border-l-[9px] border-l-white ml-0.5" />
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-400/15 text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                <Lock className="size-3" /> {t.forms_mock_block_video_gate}
              </span>
            </div>

            <div>
              <p className="text-sm font-bold text-stone-700 mb-2">{t.forms_mock_block_choice}</p>
              <div className="flex gap-2">
                <div className="flex-1 rounded-lg border-2 border-[#111111] bg-stone-50 px-3 py-2 text-center text-sm font-bold text-[#111111]">{t.forms_mock_block_choice_option_1}</div>
                <div className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-center text-sm font-semibold text-stone-400">{t.forms_mock_block_choice_option_2}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-stone-400 text-xs font-mono px-1">
              <span className="text-stone-300">/</span> {t.forms_mock_slash_hint}
            </div>
          </div>

          {/* CRM bridge footer */}
          <div className="px-6 pb-6">
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-3">
              <div className="size-9 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <ArrowRight className="size-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest mb-0.5">{t.forms_mock_bridge_label}</p>
                <p className="text-sm font-semibold text-emerald-800">{t.forms_mock_bridge_value}</p>
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
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#ff2f2f] to-[#8a43e1] flex items-center justify-center text-white font-bold text-xl shadow-inner">JP</div>
          <div>
            <h4 className="font-bold text-xl text-[#111111] mb-1">{t.lead_name}</h4>
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">{t.lead_id}</span>
          </div>
        </div>
        <div className="hidden sm:flex gap-2">
          <span className="px-3 py-1.5 bg-amber-100 text-amber-800 rounded-lg text-[10px] font-bold uppercase tracking-wider">{t.lead_tag_hot}</span>
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

type RichFAQModules = NonNullable<typeof translations.fr.faqs[number]['modules']>;

const RichFAQAnswer = ({ modules }: { modules: RichFAQModules }) => {
  const blockStyles = [
    {
      card: 'bg-gradient-to-br from-violet-50/60 via-white to-white border-violet-200/70',
      tagPill: 'bg-violet-100 text-violet-700',
      icon: 'text-violet-600',
      iconBg: 'bg-violet-100',
      titleAccent: 'from-[#8a43e1] to-[#d511fd]',
    },
    {
      card: 'bg-gradient-to-br from-stone-50 via-white to-white border-stone-200',
      tagPill: 'bg-stone-900 text-white',
      icon: 'text-stone-700',
      iconBg: 'bg-stone-200/80',
      titleAccent: 'from-stone-900 to-stone-700',
    },
  ];

  const blockIcons = [
    <Megaphone key="m" className="size-4" />,
    <Users key="u" className="size-4" />,
  ];

  return (
    <div className="space-y-6 pt-1">
      <p className="text-stone-600 leading-relaxed">{modules.intro}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {modules.blocks.map((block, idx) => {
          const style = blockStyles[idx % blockStyles.length];
          return (
            <div
              key={idx}
              className={`relative rounded-2xl border p-5 shadow-sm ${style.card}`}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className={`size-7 rounded-lg flex items-center justify-center ${style.iconBg} ${style.icon}`}>
                  {blockIcons[idx % blockIcons.length]}
                </div>
                <span className={`px-2 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-[0.15em] ${style.tagPill}`}>
                  {block.tag}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                  {block.subtitle}
                </span>
              </div>
              <h4 className={`text-lg font-bold tracking-tight mb-4 bg-gradient-to-r ${style.titleAccent} text-transparent bg-clip-text`}>
                {block.title}
              </h4>
              <ul className="space-y-2.5">
                {block.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-2">
                    <Check className={`size-3.5 mt-1 shrink-0 ${style.icon}`} />
                    <span className="text-xs text-stone-600 leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {modules.transverse && (
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-stone-200" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500 whitespace-nowrap">
            {modules.transverse}
          </span>
          <span className="h-px flex-1 bg-stone-200" />
        </div>
      )}
    </div>
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
    name: 'Solo',
    planKey: 'solo',
    emoji: '🔵',
    price: '39',
    priceQuarterly: '32',
    quarterlyTotal: '96',
    priceAnnual: '28',
    annualTotal: '336',
    popular: false,
    description: lang === 'fr'
      ? '1 seul utilisateur, l\'infopreneur qui close seul'
      : '1 user, the solopreneur who closes alone',
    features: lang === 'fr' ? [
      'CloseOS Sign inclus',
      'CRM & Pipeline visuel',
      'Système d\'acquisition complet (campagnes, embed/iframe, tracking UTM, KPIs par source)',
      'Cockpit d\'appel plein écran (script, notes, offre, ressources)',
      'Enregistrement vidéo/audio des calls',
      'Agenda + sync Google Calendar',
      'Rendez-vous + booking links',
      'Rappels',
      'KPIs personnels',
      'Facturation',
      'Objectifs personnels',
      'Rapports',
      'API REST & Webhooks sortants signés HMAC',
    ] : [
      'CloseOS Sign included',
      'CRM & Visual Pipeline',
      'Full acquisition system (campaigns, embed/iframe, UTM tracking, KPIs per source)',
      'Full-screen call cockpit (script, notes, offer, resources)',
      'Video/audio call recording',
      'Calendar + Google Calendar sync',
      'Appointments + booking links',
      'Reminders',
      'Personal KPIs',
      'Invoicing',
      'Personal objectives',
      'Reports',
      'REST API & HMAC-signed outbound webhooks',
    ],
  },
  {
    name: 'Business',
    planKey: 'business',
    emoji: '🟤',
    price: '59',
    priceQuarterly: '48',
    quarterlyTotal: '144',
    priceAnnual: '42',
    annualTotal: '504',
    popular: false,
    description: lang === 'fr'
      ? '3 équipiers inclus, tout pour gérer une équipe'
      : '3 team members included, everything to manage a team',
    features: lang === 'fr' ? [
      'CloseOS Sign inclus',
      'Tout ce que le Solo a, SAUF le système d\'acquisition',
      'Gestion d\'équipe complète (6 rôles : Owner, Admin, HOS, Closer, Setter, Setter-Closer)',
      'Vue macro Owner en temps réel sur toute l\'équipe',
      'Invitation des membres par lien magique (expiration 7j)',
      'Kanban partagé avec filtres avancés',
      'Objectifs assignables par membre',
      'Monday Morning Reporting automatique',
      'Factures de toute l\'organisation',
      'KPIs par membre / par offre / global',
      'Rapport avec export PDF',
      'Gestion des disponibilités et absences par membre',
    ] : [
      'CloseOS Sign included',
      'Everything in Solo, EXCEPT the acquisition system',
      'Full team management (6 roles: Owner, Admin, HOS, Closer, Setter, Setter-Closer)',
      'Real-time Owner macro view of the entire team',
      'Member invitation via magic link (7-day expiry)',
      'Shared Kanban with advanced filters',
      'Assignable objectives per member',
      'Automatic Monday Morning Reporting',
      'Organization-wide invoices',
      'KPIs per member / per offer / global',
      'Report with PDF export',
      'Availability & absence management per member',
    ],
    notIncluded: lang === 'fr' ? [
      'Système d\'acquisition',
      'API REST & Webhooks sortants',
    ] : [
      'Acquisition system',
      'REST API & outbound webhooks',
    ],
  },
  {
    name: 'Business + Acquisition',
    planKey: 'business_acquisition',
    emoji: '🟢',
    price: '99',
    priceQuarterly: '81',
    quarterlyTotal: '243',
    priceAnnual: '71',
    annualTotal: '852',
    popular: true,
    description: lang === 'fr'
      ? '5 équipiers inclus, l\'arsenal complet'
      : '5 team members included, the full arsenal',
    features: lang === 'fr' ? [
      'CloseOS Sign inclus',
      'Tout ce que Business a',
      'Système d\'acquisition complet en plus :',
    ] : [
      'CloseOS Sign included',
      'Everything in Business',
      'Full acquisition system on top:',
    ],
    subFeatures: lang === 'fr' ? [
      'Création/gestion de campagnes (mode avec RDV ou inscription seule)',
      'Page de capture configurable (titre, vidéo, champs custom, redirection)',
      'Génération de code embed (iframe ou popup bloquant)',
      'Tracking UTM + formule par défaut',
      'KPIs acquisition : vues, leads, taux de conversion par campagne',
      'Graphiques : camembert (campagnes les plus converties), barres (CA par campagne)',
      'API REST & Webhooks sortants signés HMAC',
    ] : [
      'Campaign creation/management (appointment or sign-up mode)',
      'Configurable capture page (title, video, custom fields, redirect)',
      'Embed code generation (iframe or blocking popup)',
      'UTM tracking + default plan',
      'Acquisition KPIs: views, leads, conversion rate per campaign',
      'Charts: pie (top converting campaigns), bar (revenue per campaign)',
      'REST API & HMAC-signed outbound webhooks',
    ],
  },
  {
    name: 'Enterprise / Challenge',
    planKey: 'enterprise',
    emoji: '⚪',
    price: null,
    priceAnnual: null,
    annualTotal: null,
    popular: false,
    description: lang === 'fr'
      ? 'Sur devis, idéal pour les challenges & grandes organisations'
      : 'Custom pricing, ideal for challenges & large organizations',
    features: lang === 'fr' ? [
      'CloseOS Sign inclus',
      'Membres illimités',
      'Tout le système d\'acquisition inclus',
      'API REST & Webhooks sortants signés HMAC',
      'Setup + Intégration inclus',
      'Support prioritaire dédié',
      'Accès one-shot limité à la durée du challenge',
      'Aussi disponible en abonnement mensuel classique',
    ] : [
      'CloseOS Sign included',
      'Unlimited members',
      'Full acquisition system included',
      'REST API & HMAC-signed outbound webhooks',
      'Setup + Integration included',
      'Dedicated priority support',
      'One-shot access limited to challenge duration',
      'Also available as a standard monthly subscription',
    ],
  },
];

const getPricingExtras = (lang: string) => [
  {
    name: 'Setup',
    price: '60€',
    type: 'one-shot',
    description: lang === 'fr'
      ? 'Configuration complète de l\'outil : campagnes, formules, pipeline, équipe, onboarding des membres. L\'infopreneur n\'a rien à toucher, tout est livré prêt à l\'emploi.'
      : 'Full tool setup: campaigns, plans, pipeline, team, member onboarding. The business owner doesn\'t have to touch anything, everything is delivered ready to use.',
  },
  {
    name: lang === 'fr' ? 'Intégration' : 'Integration',
    price: '80€',
    type: 'one-shot',
    description: lang === 'fr'
      ? 'Intégration technique sur le site du client : rajout/remplacement iframe, embed, pop up. Utile pour ceux qui avaient un iframe iClosed et veulent passer sur CloseOS.'
      : 'Technical integration on the client\'s website: add/replace iframe, embed, popup. Useful for those switching from iClosed to CloseOS.',
  },
  {
    name: lang === 'fr' ? 'Setup + Intégration' : 'Setup + Integration',
    price: '120€',
    type: 'one-shot',
    description: lang === 'fr' ? 'Les deux combinés.' : 'Both combined.',
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
      className="relative overflow-hidden px-6 md:px-20 py-32 bg-white border-y border-stone-200"
      id="pricing"
    >
      <div className="pointer-events-none select-none absolute inset-0 hidden lg:block" aria-hidden="true">
        <DoodleCoin className="absolute left-[5%] top-[10%] w-11 text-emerald-500 -rotate-6" />
        <DoodleTrophy className="absolute left-[2%] top-[36%] w-11 text-neutral-800/70" />
        <DoodleStar5 className="absolute left-[6%] top-[62%] w-5 text-emerald-500" />
        <DoodleDashes className="absolute left-[3%] top-[84%] w-11 text-stone-300 rotate-6" />
        <DoodleBurst className="absolute right-[6%] top-[12%] w-6 text-emerald-500" />
        <DoodleFace className="absolute right-[3%] top-[36%] w-12 text-neutral-800/70 rotate-6" />
        <DoodleBolt className="absolute right-[7%] top-[62%] w-5 text-emerald-500" />
        <DoodleStar5 className="absolute right-[4%] top-[84%] w-5 text-emerald-500" />
      </div>
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-stone-100 border border-stone-200 shadow-sm mb-4">
            <span className="text-sm font-semibold text-stone-800">{lang === 'fr' ? 'Tarifs' : 'Pricing'}</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-[#111111] tracking-tight text-balance">
            {lang === 'fr' ? 'Un plan pour chaque ambition' : 'A plan for every ambition'}
          </h2>
          <p className="text-stone-500 text-lg max-w-2xl mx-auto">
            {lang === 'fr'
              ? 'Du solopreneur à l\'entreprise, choisissez la formule qui correspond à votre stade de croissance.'
              : 'From solopreneur to enterprise, choose the plan that matches your growth stage.'}
            <br />
            <span className="font-semibold text-emerald-600">🎁 {lang === 'fr' ? '20 jours offerts sur toutes les formules.' : '20 free days on all plans.'}</span>
          </p>

          <div className="flex items-center justify-center pt-6">
            <div className="relative grid grid-cols-3 rounded-full bg-stone-100 border border-stone-200 p-1" style={{ minWidth: 340 }}>
              {/* Sliding bubble */}
              <div
                className="absolute top-1 bottom-1 rounded-full bg-[#111111] shadow-md transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          {pricingPlans.map((plan, idx) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 24, filter: 'blur(4px)' }}
              whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className={`relative rounded-3xl p-7 flex flex-col border transition-shadow duration-300 hover:shadow-lg ${
                plan.popular
                  ? 'bg-[#111111] text-white border-[#111111] shadow-xl shadow-stone-900/20'
                  : 'bg-white border-stone-200 shadow-sm'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[#ff2f2f] via-[#ef7b16] to-[#d511fd] text-white text-[10px] font-bold uppercase tracking-widest">
                  {lang === 'fr' ? 'Populaire' : 'Popular'}
                </div>
              )}

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
                  href={`/business/checkout?plan=${plan.planKey}&billing=${billing}`}
                  className={`w-full flex items-center justify-center rounded-xl h-12 font-bold text-sm transition-all hover:-translate-y-0.5 active:scale-[0.98] mb-6 ${
                    plan.popular
                      ? 'bg-white text-[#111111] hover:bg-stone-100'
                      : 'bg-[#111111] text-white hover:bg-stone-800'
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
                {plan.features.map((feature, i) => {
                  const isSign = feature.includes('CloseOS Sign')
                  return (
                    <li key={i} className="flex items-start gap-2.5">
                      {isSign ? (
                        <span className="relative flex size-2.5 shrink-0 mt-1.5">
                          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                          <span className={`relative inline-flex rounded-full size-2.5 ${plan.popular ? 'bg-emerald-400' : 'bg-emerald-500'}`} />
                        </span>
                      ) : (
                        <Check className={`size-4 mt-0.5 flex-shrink-0 ${plan.popular ? 'text-emerald-400' : 'text-emerald-600'}`} />
                      )}
                      {isSign ? (
                        <span
                          tabIndex={0}
                          className={`group relative text-sm leading-relaxed font-bold cursor-help underline decoration-dotted decoration-from-font underline-offset-4 outline-none ${plan.popular ? 'text-stone-300 decoration-stone-500' : 'text-stone-600 decoration-stone-300'}`}
                        >
                          {feature}
                          <span className="pointer-events-none absolute bottom-full left-0 z-30 mb-3 w-64 origin-bottom-left scale-95 opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:opacity-100 group-focus:scale-100 group-focus:opacity-100">
                            <span className="relative block rounded-2xl border-2 border-[#111111] bg-white px-4 py-3 text-left shadow-[3px_3px_0_0_#111111]">
                              <span className="mb-1 block text-[11px] font-black uppercase tracking-widest text-emerald-600">
                                CloseOS Sign
                              </span>
                              <span className="block text-xs font-medium leading-relaxed text-stone-600">
                                {lang === 'fr'
                                  ? 'Notre module de signature électronique : envoyez vos contrats, faites-les signer et payer en ligne. Valeur juridique, certificat de preuve, multi-signataires. Inclus sans surcoût dans votre abonnement.'
                                  : 'Our e-signature module: send your contracts, get them signed and paid online. Legally binding, proof certificate, multi-signer. Included at no extra cost in your plan.'}
                              </span>
                              <span className="absolute -bottom-[9px] left-7 size-3.5 rotate-45 border-b-2 border-r-2 border-[#111111] bg-white" />
                            </span>
                          </span>
                        </span>
                      ) : (
                        <span className={`text-sm font-medium leading-relaxed ${plan.popular ? 'text-stone-300' : 'text-stone-600'}`}>{feature}</span>
                      )}
                    </li>
                  )
                })}
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
                {Array.isArray((plan as any).notIncluded) && (plan as any).notIncluded.length > 0 && (plan as any).notIncluded.map((nf: string, k: number) => (
                  <li key={`x-${k}`} className="flex items-start gap-2.5">
                    <XCircle className={`size-4 mt-0.5 flex-shrink-0 ${plan.popular ? 'text-red-400' : 'text-red-500'}`} />
                    <span className={`text-sm font-medium leading-relaxed line-through ${plan.popular ? 'text-red-400' : 'text-red-500'}`}>{nf}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6 }}
        >
          <div className="bg-[#111111] rounded-3xl p-8 md:p-12 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-amber-500/20 to-orange-600/20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-8">
                <Gift className="size-6 text-amber-400" />
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
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-4 md:py-10" onClick={() => setContactModalOpen(false)}>
          <div className="bg-white rounded-2xl p-4 md:p-6 max-w-3xl w-full mx-4 shadow-2xl my-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-extrabold text-[#111111] tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Enterprise / Challenge
              </h3>
              <button onClick={() => setContactModalOpen(false)} className="text-stone-400 hover:text-stone-600 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <iframe
              ref={iframeRef}
              src="https://www.closeos.fr/capture/d8cbeca2-3a35-424a-b549-c0fbe1dd1aee?embed=true&layout=horizontal"
              width="100%"
              height={530}
              frameBorder="0"
              scrolling="yes"
              style={{ border: 'none', borderRadius: 12, overflow: 'hidden', transition: 'height 0.4s ease' }}
            />
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
      className="relative overflow-hidden px-6 md:px-20 py-24 bg-[#f4f2f1]"
      id="partners"
    >
      <div className="pointer-events-none select-none absolute inset-0 hidden lg:block" aria-hidden="true">
        <DoodleRocket className="absolute left-[4%] top-[14%] w-11 text-emerald-500 -rotate-6" />
        <DoodleStar5 className="absolute left-[9%] top-[42%] w-5 text-emerald-500" />
        <DoodleTrophy className="absolute left-[3%] top-[68%] w-11 text-neutral-800/70" />
        <DoodleBurst className="absolute right-[6%] top-[16%] w-6 text-emerald-500" />
        <DoodleBubble className="absolute right-[3%] top-[42%] w-14 text-neutral-800/70 rotate-6" />
        <DoodleHeart className="absolute right-[8%] top-[70%] w-6 text-emerald-500" />
      </div>
      <div className="max-w-6xl mx-auto relative z-10">
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
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-100 border border-stone-200 w-fit mb-6">
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
              className="w-full flex items-center justify-center gap-2 rounded-full bg-[#111111] text-white h-12 font-bold text-sm hover:bg-stone-800 transition-all active:scale-[0.98]"
            >
              {t.partners_integrate_cta}
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          {/* Ambassador card */}
          <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm flex flex-col">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 w-fit mb-6">
              <Gift className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-bold text-amber-800">{t.partners_ambassador_title}</span>
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
              className="w-full flex items-center justify-center gap-2 rounded-full bg-[#111111] text-white h-12 font-bold text-sm hover:bg-stone-800 transition-all active:scale-[0.98]"
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
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowAmbassadorModal(false)}>
        <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <Gift className="h-5 w-5 text-amber-600" />
                </div>
                <h3 className="text-xl font-bold text-[#111111]">Devenir Ambassadeur</h3>
              </div>
              <button onClick={() => setShowAmbassadorModal(false)} className="p-2 rounded-full hover:bg-stone-100 transition-colors">
                <X className="h-5 w-5 text-stone-500" />
              </button>
            </div>

            {ambSent ? (
              <div className="text-center py-10">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-8 w-8 text-emerald-600" />
                </div>
                <h4 className="text-lg font-bold text-[#111111] mb-2">Candidature envoyée !</h4>
                <p className="text-stone-500 text-sm">Nous reviendrons vers vous rapidement.</p>
                <button onClick={() => setShowAmbassadorModal(false)} className="mt-6 px-6 py-2.5 rounded-full bg-[#111111] text-white text-sm font-bold hover:bg-stone-800 transition-all">
                  Fermer
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Nom + Prénom */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1.5">Prénom *</label>
                    <input type="text" value={ambFirstName} onChange={e => setAmbFirstName(e.target.value)} placeholder="Jean" className="w-full px-4 py-2.5 rounded-xl bg-stone-100 border-none text-sm text-[#111111] focus:ring-2 ring-stone-900/10 font-medium" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1.5">Nom *</label>
                    <input type="text" value={ambLastName} onChange={e => setAmbLastName(e.target.value)} placeholder="Dupont" className="w-full px-4 py-2.5 rounded-xl bg-stone-100 border-none text-sm text-[#111111] focus:ring-2 ring-stone-900/10 font-medium" />
                  </div>
                </div>

                {/* Abonné */}
                <div>
                  <button
                    onClick={() => setAmbIsSubscriber(!ambIsSubscriber)}
                    className="flex items-center gap-3 w-full rounded-xl bg-stone-100 px-4 py-3 transition-colors hover:bg-stone-200/70"
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${ambIsSubscriber ? 'bg-[#111111] border-[#111111]' : 'border-stone-300'}`}>
                      {ambIsSubscriber && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <span className="text-sm font-medium text-[#111111]">Je suis abonné(e) CloseOS</span>
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
                  <input type="text" value={ambActivity} onChange={e => setAmbActivity(e.target.value)} placeholder="Coach, formateur, créateur de contenu..." className="w-full px-4 py-2.5 rounded-xl bg-stone-100 border-none text-sm text-[#111111] focus:ring-2 ring-stone-900/10 font-medium" />
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
                      className="w-full h-2 rounded-full appearance-none bg-stone-200 accent-[#111111] cursor-pointer"
                    />
                    <div className="flex justify-between mt-1.5">
                      {AUDIENCE_RANGES.map((r, i) => (
                        <span key={i} className={`text-[9px] font-bold ${i === ambAudienceIdx ? 'text-[#111111]' : 'text-stone-400'}`}>{r}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Liens */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1.5">Où vous trouver ? (Insta, LinkedIn, site vitrine…)</label>
                  <input type="text" value={ambPlatforms.join(', ')} onChange={e => setAmbPlatforms(e.target.value ? [e.target.value] : [])} placeholder="https://instagram.com/votre-compte, https://linkedin.com/in/..." className="w-full px-4 py-2.5 rounded-xl bg-stone-100 border-none text-sm text-[#111111] focus:ring-2 ring-stone-900/10 font-medium" />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1.5">Notes</label>
                  <textarea value={ambNotes} onChange={e => setAmbNotes(e.target.value)} placeholder="Parlez-nous de vous, de votre audience, de vos idées..." rows={3} className="w-full px-4 py-2.5 rounded-xl bg-stone-100 border-none text-sm text-[#111111] focus:ring-2 ring-stone-900/10 font-medium resize-none" />
                </div>

                <button
                  onClick={handleAmbassadorSubmit}
                  disabled={ambSending || !ambFirstName.trim() || !ambLastName.trim() || !ambWhatsapp.trim()}
                  className="w-full flex items-center justify-center gap-2 rounded-full bg-[#111111] text-white h-12 font-bold text-sm hover:bg-stone-800 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
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

const API_EVENT_CATALOG: { id: string; label_fr: string; label_en: string }[] = [
  { id: 'prospect.created', label_fr: 'Prospect créé', label_en: 'Prospect created' },
  { id: 'prospect.updated', label_fr: 'Prospect mis à jour', label_en: 'Prospect updated' },
  { id: 'prospect.stage_changed', label_fr: 'Stage modifié', label_en: 'Stage changed' },
  { id: 'prospect.deleted', label_fr: 'Prospect supprimé', label_en: 'Prospect deleted' },
  { id: 'campaign.lead_captured', label_fr: 'Lead capturé', label_en: 'Lead captured' },
  { id: 'appointment.booked', label_fr: 'RDV réservé', label_en: 'Appointment booked' },
  { id: 'appointment.cancelled', label_fr: 'RDV annulé', label_en: 'Appointment cancelled' },
  { id: 'appointment.completed', label_fr: 'RDV terminé', label_en: 'Appointment completed' },
  { id: 'deal.won', label_fr: 'Deal gagné', label_en: 'Deal won' },
  { id: 'deal.lost', label_fr: 'Deal perdu', label_en: 'Deal lost' },
];

const MCP_TOOL_CATEGORIES: { id: string; label_fr: string; label_en: string }[] = [
  { id: 'prospects', label_fr: 'Prospects & CRM', label_en: 'Prospects & CRM' },
  { id: 'campaigns', label_fr: 'Campagnes & Formulaires', label_en: 'Campaigns & Forms' },
  { id: 'agenda', label_fr: 'Rendez-vous & Agenda', label_en: 'Appointments & Calendar' },
  { id: 'team', label_fr: 'Équipe & Rôles', label_en: 'Team & Roles' },
  { id: 'noshow', label_fr: 'Relances No Show', label_en: 'No Show follow-ups' },
  { id: 'invoicing', label_fr: 'Facturation', label_en: 'Invoicing' },
  { id: 'tracking', label_fr: 'Tracking & Acquisition', label_en: 'Tracking & Acquisition' },
  { id: 'objectives', label_fr: 'Objectifs', label_en: 'Objectives' },
];

const CodeBlock = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="rounded-2xl overflow-hidden border border-white/10 bg-[#0d1117] shadow-2xl shadow-black/40">
    <div className="flex items-center justify-between px-4 py-2.5 bg-[#161b22] border-b border-white/5">
      <div className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full bg-[#ff5f57]" />
        <span className="size-2.5 rounded-full bg-[#febc2e]" />
        <span className="size-2.5 rounded-full bg-[#28c840]" />
      </div>
      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-stone-500">{label}</span>
      <span className="size-2.5" />
    </div>
    <pre className="p-5 text-[11.5px] md:text-[12px] leading-relaxed font-mono text-stone-300 overflow-x-auto">
      {children}
    </pre>
  </div>
);

const APISection = () => {
  const { t, lang } = useLang();

  const curlExample = `curl -X POST https://api.closeos.fr/v1/prospects \\
  -H "Authorization: Bearer sk_live_••••••••" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "marie@example.com",
    "first_name": "Marie",
    "last_name": "Dubois",
    "stage": "qualified",
    "external_id": "crm_42",
    "metadata": {
      "source": "landing-audit",
      "utm_campaign": "q2-launch"
    }
  }'`;

  const webhookPayload = `POST https://votre-app.com/webhooks/closeos
X-CloseOS-Signature: 7f3a9b2e1c4d...

{
  "event": "deal.won",
  "product": "business",
  "user_id": "8e1f...",
  "timestamp": "2026-04-26T12:00:00.000Z",
  "data": {
    "id": "prospect_uuid",
    "email": "marie@example.com",
    "stage": "won",
    "amount": 2400,
    "closer_id": "closer_uuid"
  }
}`;

  const restItems = [t.api_card_rest_item_1, t.api_card_rest_item_2, t.api_card_rest_item_3, t.api_card_rest_item_4];
  const webhookItems = [t.api_card_webhook_item_1, t.api_card_webhook_item_2, t.api_card_webhook_item_3, t.api_card_webhook_item_4];
  const mcpItems = [t.api_mcp_item_1, t.api_mcp_item_2, t.api_mcp_item_3, t.api_mcp_item_4];

  const mcpConfigExample = `{
  "mcpServers": {
    "closeos-business": {
      "url": "https://closeos.fr/api/business-mcp/cos_live_••••••••"
    }
  }
}`;

  return (
    <motion.section
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      id="api"
      className="relative overflow-hidden bg-[#111111] text-white px-6 md:px-20 pt-[280px] md:pt-[420px] pb-[280px] md:pb-[420px]"
    >
      {/* Long soft fade from previous (white) section into dark */}
      <div
        className="absolute top-0 inset-x-0 h-[280px] md:h-[420px] pointer-events-none z-[1]"
        style={{
          background:
            'linear-gradient(to bottom, #ffffff 0%, rgba(255,255,255,0.92) 18%, rgba(255,255,255,0.7) 38%, rgba(255,255,255,0.42) 58%, rgba(255,255,255,0.18) 78%, rgba(255,255,255,0.04) 92%, rgba(255,255,255,0) 100%)',
        }}
      />
      {/* Long soft fade from dark into next (beige page bg) section */}
      <div
        className="absolute bottom-0 inset-x-0 h-[280px] md:h-[420px] pointer-events-none z-[1]"
        style={{
          background:
            'linear-gradient(to top, #f4f2f1 0%, rgba(244,242,241,0.92) 18%, rgba(244,242,241,0.7) 38%, rgba(244,242,241,0.42) 58%, rgba(244,242,241,0.18) 78%, rgba(244,242,241,0.04) 92%, rgba(244,242,241,0) 100%)',
        }}
      />

      {/* Background blobs */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-gradient-to-br from-[#8a43e1]/20 to-[#d511fd]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-gradient-to-tl from-[#ff2f2f]/15 to-[#ef7b16]/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative max-w-7xl mx-auto z-[5]">
        {/* Header */}
        <div className="text-center mb-16 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm mb-6">
            <Sparkles className="size-3.5 text-[#d511fd]" />
            <span className="text-xs font-bold uppercase tracking-[0.15em] bg-gradient-to-r from-[#ff2f2f] via-[#ef7b16] to-[#d511fd] text-transparent bg-clip-text">
              {t.api_badge}
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
            {t.api_title}
          </h2>
          <p className="text-stone-400 text-lg leading-relaxed">{t.api_subtitle}</p>
        </div>

        {/* MCP / AI Assistant hero card */}
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent backdrop-blur-sm p-8 md:p-10 relative overflow-hidden mb-6">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-emerald-500/15 to-[#8a43e1]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-400/10 border border-emerald-400/20 mb-5 w-fit">
                <Bot className="size-3.5 text-emerald-400" />
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-emerald-400">{t.api_mcp_badge}</span>
              </div>
              <h3 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">{t.api_mcp_title}</h3>
              <p className="text-stone-400 mb-6 leading-relaxed">{t.api_mcp_desc}</p>
              <ul className="space-y-3 mb-6">
                {mcpItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-stone-300">
                    <CheckCircle className="size-4 mt-0.5 text-emerald-400 shrink-0" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-3 pt-5 border-t border-white/10">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500">{t.api_mcp_compatible_label}</span>
                <div className="flex items-center gap-2">
                  <img src="/claude.webp" alt="Claude" className="size-7 rounded-lg" />
                  <img src="/chatgpt.webp" alt="ChatGPT" className="size-7 rounded-lg" />
                  <img src="/mcp.webp" alt="MCP" className="size-7 rounded-lg" />
                </div>
              </div>
            </div>
            <div className="lg:col-span-6 flex flex-col justify-center gap-4">
              <CodeBlock label={t.api_mcp_key_label}>{mcpConfigExample}</CodeBlock>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500 mb-2 block">{t.api_mcp_tools_label}</span>
                <div className="flex flex-wrap gap-2">
                  {MCP_TOOL_CATEGORIES.map((cat) => (
                    <div
                      key={cat.id}
                      className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-stone-300"
                    >
                      {lang === 'fr' ? cat.label_fr : cat.label_en}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Two cards grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-16">
          {/* REST API card */}
          <div className="lg:col-span-7 rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent backdrop-blur-sm p-8 md:p-10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-[#8a43e1]/15 to-transparent rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-5">
                <div className="size-12 rounded-xl bg-gradient-to-br from-[#8a43e1] to-[#d511fd] flex items-center justify-center shadow-lg shadow-[#8a43e1]/30">
                  <Code className="size-5 text-white" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500">REST · v1</span>
                  <h3 className="text-2xl font-bold tracking-tight">{t.api_card_rest_title}</h3>
                </div>
              </div>
              <p className="text-stone-400 mb-6">{t.api_card_rest_desc}</p>
              <ul className="space-y-3 mb-8">
                {restItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-stone-300">
                    <CheckCircle className="size-4 mt-0.5 text-[#d511fd] shrink-0" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
              <CodeBlock label={t.api_curl_label}>{curlExample}</CodeBlock>
            </div>
          </div>

          {/* Webhooks card */}
          <div className="lg:col-span-5 rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent backdrop-blur-sm p-8 md:p-10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-[#ff2f2f]/15 to-transparent rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-5">
                <div className="size-12 rounded-xl bg-gradient-to-br from-[#ff2f2f] to-[#ef7b16] flex items-center justify-center shadow-lg shadow-[#ff2f2f]/30">
                  <Webhook className="size-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500">Outbound</span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                      <Lock className="size-3" /> HMAC-SHA256
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold tracking-tight">{t.api_card_webhook_title}</h3>
                </div>
              </div>
              <p className="text-stone-400 mb-6">{t.api_card_webhook_desc}</p>
              <ul className="space-y-3 mb-8">
                {webhookItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-stone-300">
                    <CheckCircle className="size-4 mt-0.5 text-[#ef7b16] shrink-0" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
              <CodeBlock label={t.api_payload_label}>{webhookPayload}</CodeBlock>
            </div>
          </div>
        </div>

        {/* Events catalog */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-sm p-8 md:p-10 mb-12">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500 mb-2 block">{t.api_events_label}</span>
              <h3 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">{t.api_events_title}</h3>
              <p className="text-stone-400 text-sm max-w-xl">{t.api_events_subtitle}</p>
            </div>
            <div className="flex items-center gap-2 text-stone-500 text-xs font-bold uppercase tracking-widest">
              <Zap className="size-4 text-[#d511fd]" />
              {lang === 'fr' ? 'Temps réel' : 'Real time'}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {API_EVENT_CATALOG.map((ev) => (
              <div
                key={ev.id}
                className="group flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/5 border border-white/10 hover:border-white/30 hover:bg-white/[0.07] transition-all"
              >
                <code className="text-[11px] font-mono text-[#d511fd]">{ev.id}</code>
                <span className="text-xs text-stone-400">{lang === 'fr' ? ev.label_fr : ev.label_en}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="#pricing"
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl h-14 px-8 text-[#0a0a0a] text-base font-semibold bg-white hover:bg-stone-100 hover:-translate-y-0.5 transition-all shadow-xl"
          >
            {t.api_cta_get_key}
            <ArrowRight className="size-4" />
          </a>
          <a
            href="/business/docs/api"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl h-14 px-8 text-white text-base font-semibold border border-white/15 bg-white/5 hover:bg-white/10 hover:-translate-y-0.5 transition-all backdrop-blur-sm"
          >
            {t.api_cta_docs}
          </a>
          <a
            href="/business/docs/api#mcp"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl h-14 px-8 text-[#0a0a0a] text-base font-semibold bg-white hover:bg-stone-100 hover:-translate-y-0.5 transition-all shadow-xl"
          >
            <Bot className="size-4" />
            {t.api_cta_connect_ai}
          </a>
        </div>
      </div>
    </motion.section>
  );
};

const SavingsSection = () => {
  const { lang } = useLang();
  const fr = lang !== 'en';
  // raw = valeur continue du curseur (déplacement fluide) ; n = nombre de membres entier.
  const [raw, setRaw] = useState(4);
  const n = Math.round(raw);
  const solo = n === 0;
  const closers = solo ? 0 : Math.ceil(n / 2); // ~moitié closers, moitié setters
  const crmSeats = 1 + closers;                // owner + closers (les setters n'ont pas de licence CRM pleine)
  const schedSeats = solo ? 1 : n;             // tous les membres customer-facing
  const callSeats = solo ? 1 : Math.max(2, closers); // closers, min 2 sièges (offre Team)
  const seatLabel = (s: number) => (fr ? ` · ${s} sièges` : ` · ${s} seats`);

  const tools = [
    { name: 'CRM (Pipedrive)' + (solo ? '' : seatLabel(crmSeats)), price: crmSeats * 36 },
    { name: (fr ? 'Prise de RDV (Calendly)' : 'Scheduling (Calendly)') + (solo ? '' : seatLabel(schedSeats)), price: schedSeats * (solo ? 9 : 15) },
    { name: (fr ? "Enregistrement d'appels (Fathom)" : 'Call recording (Fathom)') + (solo ? '' : seatLabel(callSeats)), price: callSeats * (solo ? 15 : 14) },
    { name: 'Email (Brevo)', price: solo ? 23 : 60 },
    { name: fr ? 'Signature (Yousign)' : 'E-signature (Yousign)', price: solo ? 9 : 25 },
    { name: fr ? 'Facturation (Abby)' : 'Invoicing (Abby)', price: 9 },
  ];
  const stack = tools.reduce((s, t) => s + t.price, 0);
  const closeos = solo ? 39 : 99 + Math.max(0, n - 3) * 6; // B+A inclut 3 membres, +6€/siège au-delà
  const plan = solo ? 'CloseOS Solo' : 'CloseOS Business + Acquisition';
  const factorNum = stack / closeos;
  const factor = (fr ? factorNum.toFixed(1).replace('.', ',') : factorNum.toFixed(1)) + '×';
  const saveYear = Math.round((stack - closeos) * 12);
  const closeosPct = Math.max(16, Math.round((closeos / stack) * 100));
  const d = { tools, stack, closeos, plan, factor, saveYear };
  const sliderPct = (raw / 20) * 100;
  const thumbPos = `calc(${sliderPct}% + ${14 - sliderPct * 0.28}px)`; // pouce centré (28px)

  const chaos = [
    { icon: Layers, tool: fr ? 'CRM sur Google Sheet + Notion' : 'CRM on Google Sheet + Notion', cost: fr ? 'Leads oubliés, zéro relance automatique' : 'Leads forgotten, no automatic follow-up' },
    { icon: Calendar, tool: fr ? 'Calendly gratuit (1 type de RDV)' : 'Free Calendly (1 event type)', cost: fr ? 'No-shows, aucun rappel intégré' : 'No-shows, no built-in reminders' },
    { icon: ClipboardList, tool: fr ? 'Qualification sur Google Forms' : 'Qualification on Google Forms', cost: fr ? 'Réponses jamais reliées à la fiche prospect' : 'Answers never linked to the prospect record' },
    { icon: Video, tool: fr ? 'Meet + notes à la main' : 'Meet + manual notes', cost: fr ? "10 min de saisie par appel, résumés perdus" : '10 min of typing per call, summaries lost' },
    { icon: DollarSign, tool: fr ? 'Commissions dans un tableur' : 'Commissions in a spreadsheet', cost: fr ? 'Erreurs, disputes, heures perdues' : 'Errors, disputes, hours lost' },
    { icon: BarChart3, tool: fr ? 'KPI mis à jour à la main' : 'KPIs updated by hand', cost: fr ? "Chiffres faux ou vieux d'une semaine" : 'Numbers wrong or a week old' },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className="relative overflow-hidden px-6 md:px-20 pt-4 pb-28 bg-white"
    >
      <div className="pointer-events-none select-none absolute inset-0 hidden lg:block" aria-hidden="true">
        <DoodleCoin className="absolute left-[4%] top-[12%] w-11 text-emerald-500 -rotate-6" />
        <DoodleChartUp className="absolute left-[7%] top-[42%] w-12 text-emerald-500 rotate-3" />
        <DoodleClock className="absolute left-[3%] top-[74%] w-11 text-neutral-800/70" />
        <DoodleBurst className="absolute right-[5%] top-[14%] w-6 text-emerald-500" />
        <DoodleTrophy className="absolute right-[3%] top-[44%] w-11 text-neutral-800/70" />
        <DoodleStar5 className="absolute right-[7%] top-[76%] w-5 text-emerald-500" />
      </div>

      <div className="max-w-5xl mx-auto relative z-10">
        <div className="text-center mb-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-700">{fr ? 'Comparatif honnête' : 'Honest comparison'}</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-[#111111] tracking-tight">{fr ? 'Combien vous économisez vraiment' : 'How much you really save'}</h2>
          <p className="text-stone-500 text-lg max-w-2xl mx-auto">{fr ? "Pas de chiffres gonflés. Voici ce qu'un business de closing paie vraiment, et ce que ça devient avec CloseOS." : "No inflated numbers. Here's what a closing business really pays, and what it becomes with CloseOS."}</p>
        </div>

        {/* Curseur : nombre de membres */}
        <div className="max-w-xl mx-auto mb-12">
          <p className="text-center text-sm font-semibold text-stone-500 mb-3">{fr ? "Combien de personnes dans votre équipe ?" : 'How many people on your team?'}</p>
          <div className="text-center mb-4">
            <span className="text-5xl font-extrabold text-[#111111] tabular-nums">{n}</span>
            <span className="text-lg font-semibold text-stone-500 ml-2">
              {solo ? (fr ? 'membre · Solo' : 'member · Solo') : (fr ? (n > 1 ? 'membres' : 'membre') : (n > 1 ? 'members' : 'member'))}
            </span>
          </div>
          <div className="group relative flex items-center h-12 px-2 rounded-full bg-stone-100 border border-stone-200 shadow-[inset_0_2px_4px_rgba(120,113,108,0.12)]">
            <div className="relative w-full h-2.5">
              {/* Piste vide */}
              <div className="absolute inset-0 rounded-full bg-stone-200/90" />
              {/* Remplissage noir */}
              <div className="absolute left-0 top-0 h-full rounded-full bg-[#111111]" style={{ width: thumbPos }} />
              {/* Pouce, bulle liquid glass (grossit au survol) */}
              <div
                className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-white/55 backdrop-blur-xl border border-white/90 shadow-[0_4px_14px_rgba(17,17,17,0.3),inset_0_1px_3px_rgba(255,255,255,1),inset_0_-2px_4px_rgba(120,113,108,0.15)] transition-transform duration-200 ease-out group-hover:scale-[1.35]"
                style={{ left: thumbPos }}
              >
                <div className="absolute top-1.5 left-2 h-2.5 w-2.5 rounded-full bg-white/80 blur-[1.5px]" />
              </div>
              {/* Input natif transparent (interaction + accessibilité) */}
              <input
                type="range"
                min={0}
                max={20}
                step="any"
                value={raw}
                onChange={(e) => setRaw(Number(e.target.value))}
                className="absolute inset-x-0 -top-5 -bottom-5 w-full opacity-0 cursor-pointer"
                aria-label={fr ? "Nombre de membres d'équipe" : 'Number of team members'}
              />
            </div>
          </div>
          <div className="flex justify-between text-xs font-medium text-stone-400 mt-2.5">
            <span>0</span>
            <span>{fr ? '20 membres' : '20 members'}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Stack remplacée */}
          <div className="rounded-3xl border border-stone-200 bg-stone-50/60 p-7">
            <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-4">{fr ? 'La stack que vous remplacez' : 'The stack you replace'}</p>
            <ul className="space-y-2.5">
              {d.tools.map((tool) => (
                <li key={tool.name} className="flex items-center justify-between text-sm">
                  <span className="text-stone-600">{tool.name}</span>
                  <span className="font-semibold text-stone-500 tabular-nums">{tool.price}&nbsp;€</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 pt-4 border-t border-stone-200 flex items-center justify-between">
              <span className="text-sm font-bold text-[#111111]">{fr ? 'Total réellement payé' : 'Actually paid'}</span>
              <span className="text-lg font-extrabold text-[#111111] tabular-nums">≈ {d.stack}&nbsp;€/{fr ? 'mois' : 'mo'}</span>
            </div>
          </div>

          {/* Barres + résultat */}
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50/40 p-7 flex flex-col justify-center">
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-stone-500 font-medium">{fr ? 'Stack actuelle' : 'Current stack'}</span>
                  <span className="font-bold text-stone-500 tabular-nums">≈ {d.stack}&nbsp;€</span>
                </div>
                <div className="h-6 rounded-full bg-stone-200/80 w-full" />
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-[#111111] font-bold">{d.plan}</span>
                  <span className="font-extrabold text-emerald-700 tabular-nums">{d.closeos}&nbsp;€</span>
                </div>
                <div className="h-6 rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${closeosPct}%` }} />
              </div>
            </div>
            <div className="mt-7 text-center">
              <p className="text-4xl font-extrabold text-emerald-700 tracking-tight">{d.factor} {fr ? 'moins cher' : 'cheaper'}</p>
              <p className="text-stone-500 text-sm mt-1">{fr ? 'soit' : 'that is'} <span className="font-bold text-[#111111]">≈ {d.saveYear.toLocaleString(fr ? 'fr-FR' : 'en-US')} €</span> {fr ? 'économisés par an' : 'saved per year'}</p>
            </div>
          </div>
        </div>

        {/* Le bricolage gratuit */}
        <div className="mt-14">
          <h3 className="text-2xl font-bold text-[#111111] text-center mb-2">{fr ? 'Ou vous bricolez en gratuit…' : 'Or you patch it together for free…'}</h3>
          <p className="text-stone-500 text-center max-w-2xl mx-auto mb-8">{fr ? "Le cas le plus courant. Là, le coût ne se compte plus en euros." : "The most common case. Here the cost is no longer counted in euros."}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {chaos.map((c) => (
              <div key={c.tool} className="rounded-2xl border border-stone-200 bg-white p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-100 text-stone-500 mb-3">
                  <c.icon className="size-4" />
                </div>
                <p className="text-sm font-bold text-[#111111]">{c.tool}</p>
                <p className="text-sm text-red-500/90 mt-1 font-medium">{c.cost}</p>
              </div>
            ))}
          </div>
          <p className="text-stone-600 text-center max-w-2xl mx-auto mt-8 leading-relaxed">
            {fr
              ? "Le vrai coût n'est pas en euros : c'est l'heure par jour et par personne perdue à copier-coller entre des outils qui ne se parlent pas, et les deals qui fuitent au passage. Pour un business qui facture 5 000 € le deal, un seul lead sauvé par mois paie l'abonnement dix fois."
              : "The real cost isn't in euros: it's the hour per day, per person, lost copy-pasting between tools that don't talk to each other, and the deals leaking in between. For a business billing €5,000 per deal, a single saved lead per month pays for the subscription ten times over."}
          </p>
        </div>

        <p className="text-[11px] text-stone-400 text-center max-w-3xl mx-auto mt-10 leading-relaxed">
          {fr
            ? "Prix indicatifs des offres concurrentes à périmètre équivalent (facturation annuelle). CloseOS remplace la stack dont un business de closing a besoin, pas chaque fonctionnalité avancée de chaque outil."
            : "Indicative competitor prices at equivalent scope (annual billing). CloseOS replaces the stack a closing business needs, not every advanced feature of every tool."}
        </p>
      </div>
    </motion.section>
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
      className="relative overflow-hidden px-6 md:px-20 pt-16 pb-32 bg-[#f4f2f1]"
      id="faq"
    >
      <div className="pointer-events-none select-none absolute inset-0 hidden lg:block" aria-hidden="true">
        <DoodleBulb className="absolute left-[6%] top-[12%] w-11 text-neutral-800/70 -rotate-6" />
        <DoodleStar5 className="absolute left-[12%] top-[38%] w-5 text-emerald-500" />
        <DoodleCheck className="absolute left-[7%] top-[64%] w-7 text-emerald-500" />
        <DoodleDashes className="absolute left-[5%] top-[86%] w-11 text-stone-300 rotate-6" />
        <DoodleFace className="absolute right-[6%] top-[16%] w-12 text-neutral-800/70 rotate-6" />
        <DoodleBurst className="absolute right-[12%] top-[42%] w-6 text-emerald-500" />
        <DoodleBubble className="absolute right-[4%] top-[66%] w-14 text-neutral-800/70 rotate-3" />
        <DoodleCross className="absolute right-[9%] top-[88%] w-3.5 text-emerald-500" />
      </div>
      <div className="max-w-3xl mx-auto relative z-10">
        <div className="text-center mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-stone-200 shadow-sm mb-4">
            <span className="text-sm font-semibold text-stone-800">{t.faq_badge}</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-[#111111] tracking-tight">{t.faq_title}</h2>
          <p className="text-stone-500 text-lg">{t.faq_subtitle}</p>
        </div>
        <div className="space-y-4">
          {t.faqs.map((faq, i) => (
            <FAQItem
              key={i}
              question={faq.question}
              answer={faq.modules ? <RichFAQAnswer modules={faq.modules} /> : <p className="whitespace-pre-line">{faq.answer}</p>}
            />
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-stone-200">
          <h2 className="text-lg font-bold text-stone-900">{t.contact_title}</h2>
          <button onClick={() => { resetForm(); onClose(); }} className="p-1 rounded-lg hover:bg-stone-100 transition-colors">
            <X className="size-5 text-stone-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t.contact_name}</label>
            <input type="text" required value={name} onChange={e => setName(e.target.value)}
              placeholder={t.contact_name_placeholder}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-stone-900 focus:border-transparent outline-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t.contact_email}</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder={t.contact_email_placeholder}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-stone-900 focus:border-transparent outline-none" />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isSubscriber} onChange={e => setIsSubscriber(e.target.checked)}
              className="w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900" />
            <span className="text-sm text-stone-700">{t.contact_subscriber}</span>
          </label>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t.contact_category}</label>
            <select required value={category} onChange={e => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-stone-900 focus:border-transparent outline-none bg-white">
              <option value="" disabled>{t.contact_category_placeholder}</option>
              {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t.contact_subject}</label>
            <input type="text" required value={subject} onChange={e => setSubject(e.target.value)}
              placeholder={t.contact_subject_placeholder}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-stone-900 focus:border-transparent outline-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t.contact_message}</label>
            <textarea required rows={5} value={message} onChange={e => setMessage(e.target.value)}
              placeholder={t.contact_message_placeholder}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-stone-900 focus:border-transparent outline-none resize-none" />
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
            className="w-full flex items-center justify-center gap-2 bg-stone-900 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-stone-800 transition-colors disabled:opacity-60">
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
      <footer className="px-6 md:px-20 py-6 border-t border-stone-200 bg-[#f4f2f1] flex flex-col md:flex-row items-center justify-between gap-4 pb-16">
        <div className="flex items-center gap-2">
          <img
            alt="CloseOS Business"
            className="w-auto object-contain h-10"
            src="/closeos-business-logo-ecrit.png"
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
    color: 'from-amber-500 to-orange-600',
    features: t.role_owner.features.map((f, i) => ({
      icon: [<Layers className="size-5" />, <Megaphone className="size-5" />, <Phone className="size-5" />, <BarChart3 className="size-5" />, <DollarSign className="size-5" />, <Users className="size-5" />, <Calendar className="size-5" />, <Bot className="size-5" />][i],
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
                <h3 className="text-[#111111] text-3xl font-bold tracking-tight">{t.modal_success_title}</h3>
                <p className="text-stone-500 font-medium text-center">
                  {t.modal_success_description}
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
                  {t.modal_whatsapp}
                  <ExternalLink className="size-4" />
                </a>
                <a
                  href="https://docs.google.com/forms/d/e/1FAIpQLSfG_km1jRFBreeHvhksMAvAxwokZEOdahTicsKikNwk71IUwg/viewform"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-[#111111] text-white py-3.5 rounded-xl font-bold hover:opacity-90 transition-all shadow-sm"
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
              <h3 className="text-[#111111] text-3xl font-bold mb-3 tracking-tight">{t.modal_title}</h3>
              <p className="text-stone-500 mb-8 font-medium">
                {t.modal_description.split('{date}')[0]}<strong className="text-[#111111]">{t.modal_description_date}</strong>{t.modal_description.split('{date}')[1]?.split('{locked}')[0]}<strong className="text-[#111111]">{t.modal_description_locked}</strong>{t.modal_description.split('{locked}')[1]}
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
