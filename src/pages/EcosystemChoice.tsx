import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, ChevronRight, Globe, ArrowRight, Sparkles, Users, BarChart3, Phone, Calendar, Receipt, Target, Rocket, Zap, Building2, FileText, Smartphone, MessageSquare } from 'lucide-react';
import { ecoTranslations, detectEcoLang } from './ecosystemChoiceI18n';
import type { EcoLang } from './ecosystemChoiceI18n';
import { salesTranslations } from './landingPageI18n';

/* ─── Integrations ─── */
const ALL_INTEGRATIONS = [
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
  { name: 'Cal.com', logo: '/Calcom.png' },
];

function IntegrationsStrip() {
  const topRow = ALL_INTEGRATIONS.filter((_, i) => i % 2 === 0);
  const bottomRow = ALL_INTEGRATIONS.filter((_, i) => i % 2 === 1);
  return (
    <div className="relative overflow-hidden space-y-3">
      <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-[#060608] to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-[#060608] to-transparent z-10 pointer-events-none" />
      <div className="flex animate-scroll-left gap-4 w-max">
        {[...Array(3)].map((_, dup) => (
          <div key={dup} className="flex gap-4">
            {topRow.map((item) => (
              <div
                key={`${dup}-${item.name}`}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl min-w-[130px]"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '0.5px solid rgba(255,255,255,0.06)',
                }}
              >
                <img src={item.logo} alt={item.name} className="h-5 w-auto object-contain" loading="lazy" width={80} height={20}  />
                <span className="text-xs font-semibold text-white/70 whitespace-nowrap" style={{ fontFamily: "'DM Sans', sans-serif" }}>{item.name}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="flex animate-scroll-right gap-4 w-max">
        {[...Array(3)].map((_, dup) => (
          <div key={dup} className="flex gap-4">
            {bottomRow.map((item) => (
              <div
                key={`${dup}-${item.name}`}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl min-w-[130px]"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '0.5px solid rgba(255,255,255,0.06)',
                }}
              >
                <img src={item.logo} alt={item.name} className="h-5 w-auto object-contain" loading="lazy" width={80} height={20}  />
                <span className="text-xs font-semibold text-white/70 whitespace-nowrap" style={{ fontFamily: "'DM Sans', sans-serif" }}>{item.name}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

interface EcosystemChoiceProps {
  onChooseSales: () => void;
  onChooseBusiness: () => void;
  onChooseCRM?: () => void;
}

export const EcosystemChoice: React.FC<EcosystemChoiceProps> = ({ onChooseSales, onChooseBusiness, onChooseCRM }) => {
  const [lang, setLang] = useState<EcoLang>('fr');
  const t = ecoTranslations[lang];
  const st = salesTranslations[lang];

  useEffect(() => {
    setLang(detectEcoLang());
  }, []);

  useEffect(() => {
    document.title = t.seo_title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', t.seo_description);
    document.getElementById('og-image')?.setAttribute('content', 'https://www.closeos.fr/og-eco.png');
    document.getElementById('tw-image')?.setAttribute('content', 'https://www.closeos.fr/og-eco.png');
    document.documentElement.lang = lang;
  }, [lang, t]);

  return (
    <div
      className="min-h-screen flex flex-col selection:bg-white/10"
      style={{ fontFamily: "'Sora', sans-serif", backgroundColor: '#060608', color: '#e8e8ed' }}
    >
      {/* ═══ Grain Overlay ═══ */}
      <div className="fixed inset-0 pointer-events-none z-[100] opacity-[0.03]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'repeat',
        backgroundSize: '128px 128px',
      }} />

      {/* ═══ Language Toggle ═══ */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.6 }}
        onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
        className="fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full text-[#8a8a96] hover:text-white transition-all text-[0.7rem] font-semibold uppercase tracking-[0.15em]"
        style={{
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '0.5px solid rgba(255,255,255,0.06)',
        }}
      >
        <Globe className="h-3.5 w-3.5" strokeWidth={1.5} />
        {lang === 'fr' ? 'EN' : 'FR'}
      </motion.button>

      {/* ═══ Main Content ═══ */}
      <main className="flex-grow flex flex-col items-center justify-center relative py-16 md:py-20 overflow-hidden">

        {/* Ambient background effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] pointer-events-none" style={{
          background: 'radial-gradient(ellipse at center, rgba(120,100,255,0.04) 0%, transparent 70%)',
        }} />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] pointer-events-none" style={{
          background: 'radial-gradient(circle at center, rgba(0,180,255,0.03) 0%, transparent 60%)',
        }} />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] pointer-events-none" style={{
          background: 'radial-gradient(circle at center, rgba(255,160,40,0.03) 0%, transparent 60%)',
        }} />

        <div className="container max-w-6xl mx-auto px-6 relative z-10">

          {/* ═══ Header ═══ */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-center mb-20 space-y-6"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '0.5px solid rgba(255,255,255,0.06)',
              }}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#8b7cf7]" strokeWidth={1.5} />
              <span className="text-[0.68rem] font-medium tracking-[0.08em] uppercase text-[#8a8a96]">{t.badge}</span>
            </motion.div>

            {/* Title */}
            <h1
              className="text-[clamp(2.5rem,6vw,4.5rem)] font-extrabold tracking-[-0.04em] leading-[1.05] text-white"
              style={{ fontFamily: "'Sora', sans-serif" }}
            >
              {t.title_line1}
              <br className="hidden md:block" />
              <span className="relative">
                {' '}{t.title_line2}
                <svg className="absolute -bottom-2 left-0 w-full h-3 opacity-30" viewBox="0 0 200 10" preserveAspectRatio="none">
                  <path d="M0 8 Q50 0 100 6 T200 4" stroke="url(#underline-grad)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                  <defs>
                    <linearGradient id="underline-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#00b4ff" />
                      <stop offset="100%" stopColor="#ffa028" />
                    </linearGradient>
                  </defs>
                </svg>
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-[#6a6a78] text-base md:text-lg max-w-2xl mx-auto leading-relaxed font-normal" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              {t.subtitle}
            </p>
          </motion.div>

          {/* ═══ Choice Cards ═══ */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 items-stretch">

            {/* ── Card: CloseOS Sales ── */}
            <motion.a
              href="/landing"
              initial={{ opacity: 0, y: 40, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => { e.preventDefault(); onChooseSales(); }}
              className="group relative flex flex-col cursor-pointer"
            >
              {/* Card glow */}
              <div className="absolute -inset-1 rounded-[2.2rem] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" style={{
                background: 'radial-gradient(ellipse at 50% 80%, rgba(0,180,255,0.12) 0%, transparent 70%)',
              }} />

              {/* Card body */}
              <div
                className="relative flex flex-col justify-between h-full p-10 md:p-12 rounded-[2rem] transition-all duration-500 overflow-hidden group-hover:translate-y-[-2px]"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '0.5px solid rgba(255,255,255,0.06)',
                  boxShadow: '0 0 0 0 rgba(0,180,255,0), inset 0 1px 0 0 rgba(255,255,255,0.03)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.border = '0.5px solid rgba(0,180,255,0.15)';
                  e.currentTarget.style.boxShadow = '0 20px 60px rgba(0,180,255,0.06), inset 0 1px 0 0 rgba(255,255,255,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.06)';
                  e.currentTarget.style.boxShadow = '0 0 0 0 rgba(0,180,255,0), inset 0 1px 0 0 rgba(255,255,255,0.03)';
                }}
              >
                {/* Ambient inner glow */}
                <div className="absolute -top-20 -right-20 w-60 h-60 bg-[#00b4ff]/[0.03] blur-[80px] rounded-full pointer-events-none group-hover:bg-[#00b4ff]/[0.06] transition-all duration-700" />

                {/* Content */}
                <div className="relative z-10 flex-1">
                  {/* Logo + Tag row */}
                  <div className="flex items-start justify-between mb-10">
                    <img src="/closeos-logo.png" alt="CloseOS Sales" className="h-16 w-auto object-contain" />
                    <span className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-[#00b4ff]/60 px-3 py-1.5 rounded-full" style={{
                      background: 'rgba(0,180,255,0.06)',
                      border: '0.5px solid rgba(0,180,255,0.08)',
                    }}>Sales</span>
                  </div>

                  {/* Title */}
                  <h2 className="text-[1.75rem] md:text-[2rem] font-bold tracking-[-0.03em] text-white mb-3" style={{ fontFamily: "'Sora', sans-serif" }}>
                    CloseOS Sales
                  </h2>

                  {/* Tag pill */}
                  <div className="inline-block px-4 py-1.5 rounded-full text-[0.68rem] font-medium tracking-wide text-[#8a8a96] mb-6" style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '0.5px solid rgba(255,255,255,0.05)',
                  }}>
                    {t.sales_tag}
                  </div>

                  {/* Description */}
                  <p className="text-[#6a6a78] text-sm leading-relaxed mb-8 max-w-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    {t.sales_description}
                  </p>

                  {/* Features */}
                  <div className="grid grid-cols-2 gap-3 mb-10">
                    {[
                      { icon: <BarChart3 className="w-3.5 h-3.5" strokeWidth={1.5} />, label: t.sales_feat1 },
                      { icon: <TrendingUp className="w-3.5 h-3.5" strokeWidth={1.5} />, label: t.sales_feat2 },
                      { icon: <Receipt className="w-3.5 h-3.5" strokeWidth={1.5} />, label: t.sales_feat3 },
                      { icon: <Calendar className="w-3.5 h-3.5" strokeWidth={1.5} />, label: t.sales_feat4 },
                    ].map((feat, i) => (
                      <div key={i} className="flex items-center gap-2.5 text-[#6a6a78] text-xs" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                        <span className="text-[#00b4ff]/50">{feat.icon}</span>
                        <span>{feat.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CTA Button */}
                <div className="relative z-10">
                  <span
                    className="w-full flex items-center justify-between px-8 py-5 rounded-xl font-semibold text-base transition-all duration-300 group-hover:shadow-[0_0_30px_rgba(0,180,255,0.12)]"
                    style={{
                      fontFamily: "'Sora', sans-serif",
                      background: 'rgba(0,180,255,0.08)',
                      color: '#00b4ff',
                      border: '0.5px solid rgba(0,180,255,0.15)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#00b4ff';
                      e.currentTarget.style.color = '#060608';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(0,180,255,0.08)';
                      e.currentTarget.style.color = '#00b4ff';
                    }}
                  >
                    {t.sales_cta}
                    <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" strokeWidth={1.5} />
                  </span>
                </div>
              </div>
            </motion.a>

            {/* ── Card: CloseOS Business ── */}
            <motion.a
              href="/business"
              initial={{ opacity: 0, y: 40, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.8, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => { e.preventDefault(); onChooseBusiness(); }}
              className="group relative flex flex-col cursor-pointer"
            >
              {/* Card glow */}
              <div className="absolute -inset-1 rounded-[2.2rem] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" style={{
                background: 'radial-gradient(ellipse at 50% 80%, rgba(255,160,40,0.12) 0%, transparent 70%)',
              }} />

              {/* Card body */}
              <div
                className="relative flex flex-col justify-between h-full p-10 md:p-12 rounded-[2rem] transition-all duration-500 overflow-hidden group-hover:translate-y-[-2px]"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '0.5px solid rgba(255,255,255,0.06)',
                  boxShadow: '0 0 0 0 rgba(255,160,40,0), inset 0 1px 0 0 rgba(255,255,255,0.03)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.border = '0.5px solid rgba(255,160,40,0.15)';
                  e.currentTarget.style.boxShadow = '0 20px 60px rgba(255,160,40,0.06), inset 0 1px 0 0 rgba(255,255,255,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.06)';
                  e.currentTarget.style.boxShadow = '0 0 0 0 rgba(255,160,40,0), inset 0 1px 0 0 rgba(255,255,255,0.03)';
                }}
              >
                {/* Ambient inner glow */}
                <div className="absolute -top-20 -right-20 w-60 h-60 bg-[#ffa028]/[0.03] blur-[80px] rounded-full pointer-events-none group-hover:bg-[#ffa028]/[0.06] transition-all duration-700" />

                {/* Content */}
                <div className="relative z-10 flex-1">
                  {/* Logo + Badges row */}
                  <div className="flex items-start justify-between mb-10">
                    <img src="/closeos-business-logo.png" alt="CloseOS Business" className="h-12 w-auto object-contain" />
                    <div className="flex items-center gap-2">
                      <span className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-[#ffa028]/60 px-3 py-1.5 rounded-full" style={{
                        background: 'rgba(255,160,40,0.06)',
                        border: '0.5px solid rgba(255,160,40,0.08)',
                      }}>Business</span>
                    </div>
                  </div>

                  {/* Title */}
                  <h2 className="text-[1.75rem] md:text-[2rem] font-bold tracking-[-0.03em] text-white mb-3" style={{ fontFamily: "'Sora', sans-serif" }}>
                    CloseOS Business
                  </h2>

                  {/* Tag pill */}
                  <div className="inline-block px-4 py-1.5 rounded-full text-[0.68rem] font-medium tracking-wide text-[#8a8a96] mb-6" style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '0.5px solid rgba(255,255,255,0.05)',
                  }}>
                    {t.business_tag}
                  </div>

                  {/* Description */}
                  <p className="text-[#6a6a78] text-sm leading-relaxed mb-8 max-w-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    {t.business_description}
                  </p>

                  {/* Features */}
                  <div className="grid grid-cols-2 gap-3 mb-10">
                    {[
                      { icon: <Users className="w-3.5 h-3.5" strokeWidth={1.5} />, label: t.business_feat1 },
                      { icon: <Target className="w-3.5 h-3.5" strokeWidth={1.5} />, label: t.business_feat2 },
                      { icon: <BarChart3 className="w-3.5 h-3.5" strokeWidth={1.5} />, label: t.business_feat3 },
                      { icon: <TrendingUp className="w-3.5 h-3.5" strokeWidth={1.5} />, label: t.business_feat4 },
                    ].map((feat, i) => (
                      <div key={i} className="flex items-center gap-2.5 text-[#6a6a78] text-xs" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                        <span className="text-[#ffa028]/50">{feat.icon}</span>
                        <span>{feat.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CTA Button */}
                <div className="relative z-10">
                  <span
                    className="w-full flex items-center justify-between px-8 py-5 rounded-xl font-semibold text-base transition-all duration-300 group-hover:shadow-[0_0_30px_rgba(255,160,40,0.12)]"
                    style={{
                      fontFamily: "'Sora', sans-serif",
                      background: 'rgba(255,160,40,0.08)',
                      color: '#ffa028',
                      border: '0.5px solid rgba(255,160,40,0.15)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#ffa028';
                      e.currentTarget.style.color = '#060608';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255,160,40,0.08)';
                      e.currentTarget.style.color = '#ffa028';
                    }}
                  >
                    {t.business_cta}
                    <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" strokeWidth={1.5} />
                  </span>
                </div>
              </div>
            </motion.a>

            {/* ── Card: CloseOS Sign ── */}
            <motion.a
              href="/sign"
              initial={{ opacity: 0, y: 40, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.8, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => { e.preventDefault(); window.location.href = '/sign'; }}
              className="group relative flex flex-col cursor-pointer"
            >
              {/* Card glow */}
              <div className="absolute -inset-1 rounded-[2.2rem] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" style={{
                background: 'radial-gradient(ellipse at 50% 80%, rgba(206,255,143,0.12) 0%, transparent 70%)',
              }} />

              {/* Card body */}
              <div
                className="relative flex flex-col justify-between h-full p-10 md:p-12 rounded-[2rem] transition-all duration-500 overflow-hidden group-hover:translate-y-[-2px]"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '0.5px solid rgba(255,255,255,0.06)',
                  boxShadow: '0 0 0 0 rgba(206,255,143,0), inset 0 1px 0 0 rgba(255,255,255,0.03)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.border = '0.5px solid rgba(206,255,143,0.18)';
                  e.currentTarget.style.boxShadow = '0 20px 60px rgba(206,255,143,0.06), inset 0 1px 0 0 rgba(255,255,255,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.06)';
                  e.currentTarget.style.boxShadow = '0 0 0 0 rgba(206,255,143,0), inset 0 1px 0 0 rgba(255,255,255,0.03)';
                }}
              >
                {/* Ambient inner glow */}
                <div className="absolute -top-20 -right-20 w-60 h-60 blur-[80px] rounded-full pointer-events-none transition-all duration-700" style={{ background: 'rgba(206,255,143,0.04)' }} />

                {/* Content */}
                <div className="relative z-10 flex-1">
                  {/* Logo + Badges row */}
                  <div className="flex items-start justify-between mb-10">
                    <div className="flex items-center gap-2.5 font-bold text-2xl" style={{ fontFamily: "'Sora', sans-serif" }}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="#CEFF8F" />
                        <path d="M2 17L12 22L22 17" stroke="#CEFF8F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M2 12L12 17L22 12" stroke="#CEFF8F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="text-white">Sign</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 rounded-full" style={{
                        color: 'rgba(206,255,143,0.7)',
                        background: 'rgba(206,255,143,0.06)',
                        border: '0.5px solid rgba(206,255,143,0.1)',
                      }}>Sign</span>
                    </div>
                  </div>

                  {/* Title */}
                  <h2 className="text-[1.75rem] md:text-[2rem] font-bold tracking-[-0.03em] text-white mb-3" style={{ fontFamily: "'Sora', sans-serif" }}>
                    CloseOS Sign
                  </h2>

                  {/* Tag pill */}
                  <div className="inline-block px-4 py-1.5 rounded-full text-[0.68rem] font-medium tracking-wide text-[#8a8a96] mb-6" style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '0.5px solid rgba(255,255,255,0.05)',
                  }}>
                    {lang === 'fr' ? 'Signature + Encaissement' : 'Signing + Payment'}
                  </div>

                  {/* Description */}
                  <p className="text-[#6a6a78] text-sm leading-relaxed mb-8 max-w-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    {lang === 'fr'
                      ? 'La signature électronique qui encaisse vos paiements dans le même geste. Faisceau de preuves opposable + certificat vérifiable.'
                      : 'The e-signature that collects the deposit in the same gesture. Opposable proof bundle + verifiable certificate.'}
                  </p>

                  {/* Features */}
                  <div className="grid grid-cols-2 gap-3 mb-10">
                    {[
                      { icon: <FileText className="w-3.5 h-3.5" strokeWidth={1.5} />, label: lang === 'fr' ? 'Signature électronique' : 'E-signature' },
                      { icon: <Receipt className="w-3.5 h-3.5" strokeWidth={1.5} />, label: 'Sign + Pay (Stripe)' },
                      { icon: <Users className="w-3.5 h-3.5" strokeWidth={1.5} />, label: lang === 'fr' ? 'Multi-signataire' : 'Multi-signer' },
                      { icon: <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />, label: lang === 'fr' ? 'Certificat de preuve' : 'Proof certificate' },
                    ].map((feat, i) => (
                      <div key={i} className="flex items-center gap-2.5 text-[#6a6a78] text-xs" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                        <span style={{ color: 'rgba(206,255,143,0.6)' }}>{feat.icon}</span>
                        <span>{feat.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CTA Button */}
                <div className="relative z-10">
                  <span
                    className="w-full flex items-center justify-between px-8 py-5 rounded-xl font-semibold text-base transition-all duration-300 group-hover:shadow-[0_0_30px_rgba(206,255,143,0.12)]"
                    style={{
                      fontFamily: "'Sora', sans-serif",
                      background: 'rgba(206,255,143,0.08)',
                      color: '#CEFF8F',
                      border: '0.5px solid rgba(206,255,143,0.18)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#CEFF8F';
                      e.currentTarget.style.color = '#060608';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(206,255,143,0.08)';
                      e.currentTarget.style.color = '#CEFF8F';
                    }}
                  >
                    {lang === 'fr' ? 'Accéder' : 'Access'}
                    <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" strokeWidth={1.5} />
                  </span>
                </div>
              </div>
            </motion.a>

            {/* ── Card: CloseOS CRM — DÉSACTIVÉ (produit suspendu, code conservé) ── */}
            {false && (
            <motion.a
              href="/crm"
              initial={{ opacity: 0, y: 40, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.8, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => { if (onChooseCRM) { e.preventDefault(); onChooseCRM(); } }}
              className="group relative flex flex-col cursor-pointer"
            >
              <div className="absolute -inset-1 rounded-[2.2rem] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" style={{
                background: 'radial-gradient(ellipse at 50% 80%, rgba(245,158,11,0.14) 0%, transparent 70%)',
              }} />

              <div
                className="relative flex flex-col justify-between h-full p-10 md:p-12 rounded-[2rem] transition-all duration-500 overflow-hidden group-hover:translate-y-[-2px]"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '0.5px solid rgba(255,255,255,0.06)',
                  boxShadow: '0 0 0 0 rgba(245,158,11,0), inset 0 1px 0 0 rgba(255,255,255,0.03)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.border = '0.5px solid rgba(245,158,11,0.18)';
                  e.currentTarget.style.boxShadow = '0 20px 60px rgba(245,158,11,0.08), inset 0 1px 0 0 rgba(255,255,255,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.06)';
                  e.currentTarget.style.boxShadow = '0 0 0 0 rgba(245,158,11,0), inset 0 1px 0 0 rgba(255,255,255,0.03)';
                }}
              >
                <div className="absolute -top-20 -right-20 w-60 h-60 blur-[80px] rounded-full pointer-events-none transition-all duration-700" style={{ background: 'rgba(245,158,11,0.05)' }} />

                <div className="relative z-10 flex-1">
                  <div className="flex items-start justify-between mb-10">
                    <div className="flex items-center gap-2 font-extrabold text-2xl" style={{ fontFamily: "'Sora', sans-serif" }}>
                      <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-white font-black"
                        style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #60A5FA 100%)' }}>C</span>
                      <span className="text-white">
                        Close<span style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #60A5FA 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>OS</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[0.58rem] font-bold uppercase tracking-[0.12em] text-[#060608] px-3 py-1.5 rounded-full" style={{ background: '#F59E0B' }}>
                        {lang === 'fr' ? 'Nouveau' : 'New'}
                      </span>
                      <span className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 rounded-full" style={{
                        color: 'rgba(245,158,11,0.7)',
                        background: 'rgba(245,158,11,0.06)',
                        border: '0.5px solid rgba(245,158,11,0.1)',
                      }}>CRM</span>
                    </div>
                  </div>

                  <h2 className="text-[1.75rem] md:text-[2rem] font-bold tracking-[-0.03em] text-white mb-3" style={{ fontFamily: "'Sora', sans-serif" }}>
                    CloseOS CRM
                  </h2>

                  <div className="inline-block px-4 py-1.5 rounded-full text-[0.68rem] font-medium tracking-wide text-[#8a8a96] mb-6" style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '0.5px solid rgba(255,255,255,0.05)',
                  }}>
                    {lang === 'fr' ? 'Pour entrepreneurs solo' : 'For solo entrepreneurs'}
                  </div>

                  <p className="text-[#6a6a78] text-sm leading-relaxed mb-8 max-w-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    {lang === 'fr'
                      ? 'Le CRM tout-en-un pour gérer vos prospects, créer vos pages de capture et mesurer votre acquisition. Sans équipe.'
                      : 'The all-in-one CRM to manage prospects, build capture pages, and measure acquisition. No team needed.'}
                  </p>

                  <div className="grid grid-cols-2 gap-3 mb-10">
                    {[
                      { icon: <Users className="w-3.5 h-3.5" strokeWidth={1.5} />, label: lang === 'fr' ? 'CRM + Pipeline' : 'CRM + Pipeline' },
                      { icon: <Rocket className="w-3.5 h-3.5" strokeWidth={1.5} />, label: lang === 'fr' ? 'Campagnes + Stripe' : 'Campaigns + Stripe' },
                      { icon: <BarChart3 className="w-3.5 h-3.5" strokeWidth={1.5} />, label: 'Acquisition analytics' },
                      { icon: <Zap className="w-3.5 h-3.5" strokeWidth={1.5} />, label: 'API · Zapier · Make · N8N' },
                    ].map((feat, i) => (
                      <div key={i} className="flex items-center gap-2.5 text-[#6a6a78] text-xs" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                        <span style={{ color: 'rgba(245,158,11,0.6)' }}>{feat.icon}</span>
                        <span>{feat.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="relative z-10">
                  <span
                    className="w-full flex items-center justify-between px-8 py-5 rounded-xl font-semibold text-base transition-all duration-300 group-hover:shadow-[0_0_30px_rgba(245,158,11,0.14)]"
                    style={{
                      fontFamily: "'Sora', sans-serif",
                      background: 'rgba(245,158,11,0.08)',
                      color: '#F59E0B',
                      border: '0.5px solid rgba(245,158,11,0.18)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#F59E0B';
                      e.currentTarget.style.color = '#060608';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(245,158,11,0.08)';
                      e.currentTarget.style.color = '#F59E0B';
                    }}
                  >
                    {lang === 'fr' ? 'Découvrir le CRM' : 'Discover CRM'}
                    <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" strokeWidth={1.5} />
                  </span>
                </div>
              </div>
            </motion.a>
            )}
          </div>

          {/* ═══ Integrations Marquee ═══ */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.8 }}
            className="mt-20"
          >
            <p className="text-center text-[0.68rem] font-medium uppercase tracking-[0.15em] text-[#4a4a56] mb-6" style={{ fontFamily: "'Sora', sans-serif" }}>
              {lang === 'fr' ? 'Intégrations disponibles' : 'Available integrations'}
            </p>
            <IntegrationsStrip />
          </motion.div>

          {/* ═══ Definition Section — "Qu'est-ce que CloseOS" ═══ */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7 }}
            className="mt-28 max-w-3xl mx-auto text-center space-y-8"
          >
            <h2 className="text-xl md:text-2xl font-bold text-white/70 tracking-[-0.02em]" style={{ fontFamily: "'Sora', sans-serif" }}>
              {t.def_title}
            </h2>
            <p className="text-[#6a6a78] text-sm leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              {lang === 'fr'
                ? <>CloseOS est un <strong className="text-white/50 font-medium">écosystème SaaS français pour la vente digitale</strong>. Il regroupe trois outils complémentaires conçus pour les professionnels du closing francophone.</>
                : <>CloseOS is a <strong className="text-white/50 font-medium">SaaS ecosystem for digital sales</strong>. It combines three complementary tools designed for sales professionals.</>
              }
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-left">
              <div
                className="p-6 rounded-2xl transition-all duration-300"
                style={{
                  background: 'rgba(0,180,255,0.02)',
                  border: '0.5px solid rgba(0,180,255,0.08)',
                }}
              >
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00b4ff]" />
                  <h3 className="text-sm font-semibold text-[#00b4ff]/70" style={{ fontFamily: "'Sora', sans-serif" }}>{t.def_sales_title}</h3>
                </div>
                <p className="text-[#6a6a78]/70 text-xs leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  {t.def_sales_text}
                </p>
              </div>
              <div
                className="p-6 rounded-2xl transition-all duration-300"
                style={{
                  background: 'rgba(255,160,40,0.02)',
                  border: '0.5px solid rgba(255,160,40,0.08)',
                }}
              >
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#ffa028]" />
                  <h3 className="text-sm font-semibold text-[#ffa028]/70" style={{ fontFamily: "'Sora', sans-serif" }}>{t.def_business_title}</h3>
                </div>
                <p className="text-[#6a6a78]/70 text-xs leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  {t.def_business_text}
                </p>
              </div>
              <div
                className="p-6 rounded-2xl transition-all duration-300"
                style={{
                  background: 'rgba(206,255,143,0.02)',
                  border: '0.5px solid rgba(206,255,143,0.08)',
                }}
              >
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#CEFF8F]" />
                  <h3 className="text-sm font-semibold text-[#CEFF8F]/70" style={{ fontFamily: "'Sora', sans-serif" }}>CloseOS Sign</h3>
                </div>
                <p className="text-[#6a6a78]/70 text-xs leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  {lang === 'fr'
                    ? 'La signature électronique qui encaisse : signez le contrat et recevez le paiement dans le même geste, avec un faisceau de preuves opposable.'
                    : 'The e-signature that collects payment: sign the contract and get paid in one gesture, with an opposable proof bundle.'}
                </p>
              </div>
            </div>
          </motion.div>

        </div>
      </main>

      {/* ═══ Footer ═══ */}
      <footer className="py-8 pb-16 relative z-10" style={{ borderTop: '0.5px solid rgba(255,255,255,0.04)', backgroundColor: '#060608' }}>
        <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold tracking-[-0.02em] text-white/60" style={{ fontFamily: "'Sora', sans-serif" }}>CloseOS</span>
          </div>

          <div className="flex flex-wrap justify-center gap-4 text-[0.68rem] text-[#4a4a56]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <span>© 2026 CloseOS.fr</span>
            <span className="hidden sm:inline text-white/10">·</span>
            <a href="/mentions-legales" className="hover:text-white/50 transition-colors">{t.footer_legal}</a>
            <span className="hidden sm:inline text-white/10">·</span>
            <a href="/cgu" className="hover:text-white/50 transition-colors">{t.footer_cgu}</a>
            <span className="hidden sm:inline text-white/10">·</span>
            <a href="/cgv" className="hover:text-white/50 transition-colors">{t.footer_cgv}</a>
            <span className="hidden sm:inline text-white/10">·</span>
            <a href="/confidentialite" className="hover:text-white/50 transition-colors">{t.footer_privacy}</a>
            <span className="hidden sm:inline text-white/10">·</span>
            <a href="/business/politique-utilisation" className="hover:text-white/50 transition-colors">{t.footer_business_policy}</a>
          </div>

          <div className="flex gap-6 text-[0.68rem]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <a
              href="https://www.linkedin.com/in/thomas-shamoev-570885237/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#4a4a56] hover:text-white/50 transition-colors"
            >
              LinkedIn
            </a>
            <a href="mailto:support@closeos.fr" className="text-[#4a4a56] hover:text-white/50 transition-colors">
              support@closeos.fr
            </a>
          </div>
        </div>
      </footer>

      {/* ═══ Font Import + Marquee Animation ═══ */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');

        @keyframes scroll-left {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
        @keyframes scroll-right {
          0% { transform: translateX(-33.333%); }
          100% { transform: translateX(0); }
        }
        .animate-scroll-left {
          animation: scroll-left 35s linear infinite;
        }
        .animate-scroll-right {
          animation: scroll-right 35s linear infinite;
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};
