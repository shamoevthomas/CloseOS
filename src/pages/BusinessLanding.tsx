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
} from 'lucide-react';
import { translations, detectLang, LangContext, useLang } from './businessLandingI18n';
import type { Lang } from './businessLandingI18n';

export const BusinessLanding: React.FC = () => {
  const navigate = useNavigate();
  const pageRef = useRef<HTMLDivElement>(null);
  const demoIframeRef = useRef<HTMLIFrameElement>(null);
  const [isExiting, setIsExiting] = useState(false);
  // WaitingListModal removed — replaced with direct checkout links
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
      if (e.data?.type === 'closeos-capture-resize' && demoIframeRef.current) {
        demoIframeRef.current.style.height = `${e.data.height}px`;
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleNavigateToSales = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsExiting(true);
    setTimeout(() => navigate('/landing'), 500);
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
            </div>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-stone-600">
            <a href="#integrations" className="hover:text-[#111111] transition-colors">{t.nav_integrations}</a>
            <a href="#features" className="hover:text-[#111111] transition-colors">{t.nav_management}</a>
            <a href="#crm" className="hover:text-[#111111] transition-colors">{t.nav_crm}</a>
            <a href="#roles" className="hover:text-[#111111] transition-colors">{t.nav_roles}</a>
            <a href="#demo" className="hover:text-[#111111] transition-colors">{t.nav_demo}</a>
            <a href="#pricing" className="hover:text-[#111111] transition-colors">{t.nav_pricing}</a>
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
            <a href="#integrations" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-[#111111] transition-colors py-1">{t.nav_integrations}</a>
            <a href="#features" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-[#111111] transition-colors py-1">{t.nav_management}</a>
            <a href="#crm" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-[#111111] transition-colors py-1">{t.nav_crm}</a>
            <a href="#roles" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-[#111111] transition-colors py-1">{t.nav_roles}</a>
            <a href="#demo" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-[#111111] transition-colors py-1">{t.nav_demo}</a>
            <a href="#pricing" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-[#111111] transition-colors py-1">{t.nav_pricing}</a>
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

            <h1 className="text-5xl md:text-7xl lg:text-[80px] font-bold leading-[1.1] tracking-tight text-[#111111]">
              {t.hero_title}
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
            <p className="text-sm text-stone-500 font-medium mt-1">
              {t.hero_social_proof.split('{count}')[0]}<span className="font-bold text-[#111111]">{t.hero_social_proof_count}</span>{t.hero_social_proof.split('{count}')[1]}
            </p>

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
          className="px-6 md:px-20 py-24 max-w-7xl mx-auto"
          id="features"
        >
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
          className="px-6 md:px-12 pt-24 pb-8 max-w-[1800px] mx-auto"
        >
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

        {/* FAQ Section */}
        <FAQSection />

        {/* Final CTA */}
        <motion.section
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="px-6 md:px-20 py-32 bg-white text-center border-t border-stone-200"
        >
          <div className="max-w-3xl mx-auto space-y-10">
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

      {/* Founder */}
      <section className="py-20 border-t border-stone-200 bg-white">
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
            <p className="text-sm text-[#111111] font-medium mb-1">{t.founder_section_title}</p>
            <h2 className="text-2xl font-bold text-[#111111] mb-1">Thomas Shamoev</h2>
            <p className="text-stone-500 text-sm mb-4">{t.founder_role}</p>
            <p className="text-stone-500 leading-relaxed">{t.founder_bio}</p>
          </div>
        </div>
      </section>

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
        {/* Left — Texte */}
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

        {/* Right — Mini dashboard preview */}
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
      {/* Left — Text */}
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
                {/* Capture page — two columns: form left, agenda right */}
                <div className="bg-gradient-to-br from-[#111111] to-[#1a1a2e] rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Left — Registration form */}
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
                  {/* Right — Blurred agenda */}
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
      {/* Left — Text */}
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

      {/* Right — Mockup */}
      <div className="lg:col-span-7">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="bg-white rounded-3xl overflow-hidden shadow-xl border border-stone-200 text-left"
        >
          {/* Header — Prospect avatar + score ring */}
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

          {/* Footer — Summary */}
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
      ? '1 seul utilisateur — l\'infopreneur qui close seul'
      : '1 user — the solopreneur who closes alone',
    features: lang === 'fr' ? [
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
    ] : [
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
      ? '3 équipiers inclus — tout pour gérer une équipe'
      : '3 team members included — everything to manage a team',
    features: lang === 'fr' ? [
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
      ? '5 équipiers inclus — l\'arsenal complet'
      : '5 team members included — the full arsenal',
    features: lang === 'fr' ? [
      'Tout ce que Business a',
      'Système d\'acquisition complet en plus :',
    ] : [
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
    ] : [
      'Campaign creation/management (appointment or sign-up mode)',
      'Configurable capture page (title, video, custom fields, redirect)',
      'Embed code generation (iframe or blocking popup)',
      'UTM tracking + default plan',
      'Acquisition KPIs: views, leads, conversion rate per campaign',
      'Charts: pie (top converting campaigns), bar (revenue per campaign)',
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
      ? 'Sur devis — idéal pour les challenges & grandes organisations'
      : 'Custom pricing — ideal for challenges & large organizations',
    features: lang === 'fr' ? [
      'Membres illimités',
      'Tout le système d\'acquisition inclus',
      'Setup + Intégration inclus',
      'Support prioritaire dédié',
      'Accès one-shot limité à la durée du challenge',
      'Aussi disponible en abonnement mensuel classique',
    ] : [
      'Unlimited members',
      'Full acquisition system included',
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
      : 'Full tool setup: campaigns, plans, pipeline, team, member onboarding. The business owner doesn\'t have to touch anything — everything is delivered ready to use.',
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
  const [emailCopied, setEmailCopied] = useState(false);
  const { t, lang } = useLang();
  const pricingPlans = getPricingPlans(lang);
  const pricingExtras = getPricingExtras(lang);

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
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-stone-100 border border-stone-200 shadow-sm mb-4">
            <span className="text-sm font-semibold text-stone-800">{lang === 'fr' ? 'Tarifs' : 'Pricing'}</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-[#111111] tracking-tight text-balance">
            {lang === 'fr' ? 'Un plan pour chaque ambition' : 'A plan for every ambition'}
          </h2>
          <p className="text-stone-500 text-lg max-w-2xl mx-auto">
            {lang === 'fr'
              ? 'Du solopreneur à l\'entreprise — choisissez la formule qui correspond à votre stade de croissance.'
              : 'From solopreneur to enterprise — choose the plan that matches your growth stage.'}
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
                      <span className="text-stone-400 text-sm font-medium">— {extra.price} {extra.type}</span>
                    </div>
                    <p className="text-stone-400 text-sm font-medium leading-relaxed mt-3">{extra.description}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Contact modal */}
      {contactModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setContactModalOpen(false)}>
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-4">
              <Mail className="h-5 w-5 text-stone-600" />
            </div>
            <h3 className="text-lg font-extrabold text-[#111111] tracking-tight mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {lang === 'fr' ? 'Contactez-nous' : 'Contact us'}
            </h3>
            <div className="flex items-center justify-center gap-2 mb-5">
              <p className="text-sm text-stone-500">thomasshamoev@gmail.com</p>
              <button
                onClick={() => { navigator.clipboard.writeText('thomasshamoev@gmail.com'); setEmailCopied(true); setTimeout(() => setEmailCopied(false), 2000); }}
                className="text-stone-400 hover:text-stone-600 transition-colors"
                title={lang === 'fr' ? 'Copier' : 'Copy'}
              >
                {emailCopied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <a
              href="https://mail.google.com/mail/?view=cm&to=thomasshamoev@gmail.com&su=CloseOS%20Enterprise%20%2F%20Challenge"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 rounded-full bg-[#111111] text-white h-11 font-bold text-sm hover:bg-stone-800 transition-all active:scale-[0.98]"
            >
              {lang === 'fr' ? 'Ouvrir dans Gmail' : 'Open in Gmail'}
            </a>
            <button onClick={() => setContactModalOpen(false)} className="mt-3 text-sm text-stone-400 hover:text-stone-600 transition-colors font-medium">
              {lang === 'fr' ? 'Fermer' : 'Close'}
            </button>
          </div>
        </div>
      )}
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
      className="px-6 md:px-20 pt-16 pb-32 bg-[#f4f2f1]"
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

const FooterSection = () => {
  const { t } = useLang();
  return (
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
      </div>
    </footer>
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

      {/* Role Tabs — Desktop: single row with bubble / Mobile: 2x2 grid */}
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
        <div className={`grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3`}>
          {currentRole.features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 16, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: roleEase }}
              className="bg-white rounded-2xl p-5 sm:p-7 border border-stone-200 shadow-sm hover:shadow-md transition-shadow duration-300"
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
