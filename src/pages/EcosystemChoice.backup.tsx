import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, ChevronRight, Globe } from 'lucide-react';
import { ecoTranslations, detectEcoLang } from './ecosystemChoiceI18n';
import type { EcoLang } from './ecosystemChoiceI18n';

interface EcosystemChoiceProps {
  onChooseSales: () => void;
  onChooseBusiness: () => void;
}

export const EcosystemChoice: React.FC<EcosystemChoiceProps> = ({ onChooseSales, onChooseBusiness }) => {
  const [lang, setLang] = useState<EcoLang>('fr');
  const t = ecoTranslations[lang];

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
      className="min-h-screen flex flex-col selection:bg-[#b6c4ff]/30"
      style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        backgroundColor: '#111318',
        color: '#e2e2e8',
      }}
    >
      {/* Language toggle — fixed top right */}
      <button
        onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
        className="fixed top-5 right-5 z-50 flex items-center gap-2 px-3.5 py-2 rounded-full border border-[#45474b]/30 bg-[#1a1c20]/80 backdrop-blur-md text-[#909095] hover:text-[#e2e2e8] hover:border-[#45474b]/60 transition-all text-xs font-bold uppercase tracking-wider"
      >
        <Globe className="h-3.5 w-3.5" />
        {lang === 'fr' ? 'EN' : 'FR'}
      </button>

      {/* Main Content */}
      <main
        className="flex-grow flex flex-col items-center justify-center relative py-12 overflow-hidden"
        style={{
          backgroundImage:
            'radial-gradient(at 0% 0%, rgba(182, 196, 255, 0.05) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(0, 228, 117, 0.05) 0px, transparent 50%)',
        }}
      >
        {/* Ambient Orbs */}
        <div className="absolute top-1/4 -left-24 w-96 h-96 bg-[#b6c4ff]/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-1/4 -right-24 w-96 h-96 bg-[#00e475]/5 blur-[120px] rounded-full pointer-events-none" />

        <div className="container max-w-6xl mx-auto px-6 relative z-10">
          {/* Central Heading */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16 space-y-4"
          >
            <p className="text-[#909095]/60 text-xs font-bold uppercase tracking-[0.2em] mb-2">{t.badge}</p>
            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tighter text-[#e2e2e8] leading-tight">
              {t.title_line1}<br className="hidden md:block" /> {t.title_line2}
            </h1>
            <p className="text-[#909095] text-lg max-w-2xl mx-auto font-medium">
              {t.subtitle}
            </p>
          </motion.div>

          {/* Choice Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            {/* Card 1: CloseOS Sales */}
            <motion.div
              initial={{ opacity: 0, y: 30, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={onChooseSales}
              className="group relative flex flex-col justify-between p-10 rounded-[2rem] border border-[#45474b]/10 hover:border-[#b6c4ff]/30 transition-all duration-500 overflow-hidden cursor-pointer"
              style={{
                background: 'rgba(40, 42, 46, 0.1)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
              }}
            >
              {/* Background icon */}
              <div className="absolute top-0 right-0 p-8 text-[#b6c4ff]/10 group-hover:text-[#b6c4ff]/20 transition-colors">
                <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-30">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M12 4v16" />
                  <path d="M2 12h20" />
                  <circle cx="8" cy="8" r="1.5" fill="currentColor" />
                  <circle cx="16" cy="16" r="1.5" fill="currentColor" />
                </svg>
              </div>

              <div className="relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-[#b6c4ff]/10 flex items-center justify-center mb-8 border border-[#b6c4ff]/20">
                  <TrendingUp className="w-7 h-7 text-[#b6c4ff]" />
                </div>
                <h2 className="text-3xl font-bold mb-4 text-[#e2e2e8]">CloseOS Sales</h2>
                <span className="inline-block px-4 py-1.5 rounded-full bg-[#282a2e] text-[#b6c4ff] text-xs font-bold uppercase tracking-wider mb-6 border border-[#45474b]/30">
                  {t.sales_tag}
                </span>
                <p className="text-[#909095] leading-relaxed mb-4 max-w-xs">
                  {t.sales_description}
                </p>
                <ul className="text-[#909095]/70 text-sm space-y-1.5 mb-8 max-w-xs">
                  <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-[#b6c4ff]/50" />{t.sales_feat1}</li>
                  <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-[#b6c4ff]/50" />{t.sales_feat2}</li>
                  <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-[#b6c4ff]/50" />{t.sales_feat3}</li>
                  <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-[#b6c4ff]/50" />{t.sales_feat4}</li>
                </ul>
              </div>

              <div className="relative z-10">
                <button
                  onClick={(e) => { e.stopPropagation(); onChooseSales(); }}
                  className="w-full flex items-center justify-between px-8 py-5 bg-[#e2e2e8] text-[#1a1c20] rounded-xl font-bold text-lg hover:opacity-90 transition-all group-hover:scale-[1.02] duration-300"
                >
                  {t.sales_cta}
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </motion.div>

            {/* Card 2: CloseOS Business */}
            <motion.div
              initial={{ opacity: 0, y: 30, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.7, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
              onClick={onChooseBusiness}
              className="group relative flex flex-col justify-between p-10 rounded-[2rem] border border-[#45474b]/10 hover:border-[#00e475]/30 transition-all duration-500 overflow-hidden cursor-pointer"
              style={{
                background: 'rgba(40, 42, 46, 0.1)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
              }}
            >
              {/* Background icon */}
              <div className="absolute top-0 right-0 p-8 text-[#00e475]/10 group-hover:text-[#00e475]/20 transition-colors">
                <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-30">
                  <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
                  <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
                  <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
                  <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
                </svg>
              </div>

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-[#00e475]/10 flex items-center justify-center border border-[#00e475]/20">
                    <svg className="w-7 h-7 text-[#00e475]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="4" />
                      <path d="M12 2v4" />
                      <path d="M12 18v4" />
                      <path d="M4.93 4.93l2.83 2.83" />
                      <path d="M16.24 16.24l2.83 2.83" />
                      <path d="M2 12h4" />
                      <path d="M18 12h4" />
                      <path d="M4.93 19.07l2.83-2.83" />
                      <path d="M16.24 7.76l2.83-2.83" />
                    </svg>
                  </div>
                  <span className="bg-[#00e475] text-[#003918] px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest">
                    {t.business_new}
                  </span>
                </div>
                <h2 className="text-3xl font-bold mb-4 text-[#e2e2e8]">CloseOS Business</h2>
                <span className="inline-block px-4 py-1.5 rounded-full bg-[#282a2e] text-[#00e475] text-xs font-bold uppercase tracking-wider mb-6 border border-[#45474b]/30">
                  {t.business_tag}
                </span>
                <p className="text-[#909095] leading-relaxed mb-4 max-w-xs">
                  {t.business_description}
                </p>
                <ul className="text-[#909095]/70 text-sm space-y-1.5 mb-8 max-w-xs">
                  <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-[#00e475]/50" />{t.business_feat1}</li>
                  <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-[#00e475]/50" />{t.business_feat2}</li>
                  <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-[#00e475]/50" />{t.business_feat3}</li>
                  <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-[#00e475]/50" />{t.business_feat4}</li>
                </ul>
              </div>

              <div className="relative z-10">
                <button
                  onClick={(e) => { e.stopPropagation(); onChooseBusiness(); }}
                  className="w-full flex items-center justify-between px-8 py-5 bg-[#00e475] text-[#003918] rounded-xl font-bold text-lg hover:brightness-110 transition-all group-hover:scale-[1.02] duration-300"
                >
                  {t.business_cta}
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          </div>

          {/* "Qu'est-ce que CloseOS" — GEO-optimized definition section */}
          <div className="mt-24 max-w-3xl mx-auto text-center space-y-6">
            <h2 className="text-2xl font-bold text-[#e2e2e8]/80 tracking-tight">{t.def_title}</h2>
            <p className="text-[#909095] text-sm leading-relaxed">
              {lang === 'fr'
                ? <>CloseOS est un <strong className="text-[#e2e2e8]/70">écosystème SaaS français pour la vente digitale</strong>. Il regroupe deux outils complémentaires conçus pour les professionnels du closing francophone.</>
                : <>CloseOS is a <strong className="text-[#e2e2e8]/70">SaaS ecosystem for digital sales</strong>. It combines two complementary tools designed for sales professionals.</>
              }
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
              <div className="p-5 rounded-xl border border-[#45474b]/10">
                <h3 className="text-sm font-bold text-[#b6c4ff]/80 mb-2">{t.def_sales_title}</h3>
                <p className="text-[#909095]/70 text-xs leading-relaxed">
                  {t.def_sales_text}
                </p>
              </div>
              <div className="p-5 rounded-xl border border-[#45474b]/10">
                <h3 className="text-sm font-bold text-[#00e475]/80 mb-2">{t.def_business_title}</h3>
                <p className="text-[#909095]/70 text-xs leading-relaxed">
                  {t.def_business_text}
                </p>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-6 pb-16" style={{ backgroundColor: '#111318' }}>
        <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-[#e2e2e8]">CloseOS</span>
          </div>

          <div className="flex flex-wrap justify-center gap-4 text-xs text-[#909095]">
            <span>© 2026 CloseOS.fr</span>
            <span className="hidden sm:inline">•</span>
            <a href="/mentions-legales" className="hover:text-[#e2e2e8] transition-colors">{t.footer_legal}</a>
            <span className="hidden sm:inline">•</span>
            <a href="/cgu" className="hover:text-[#e2e2e8] transition-colors">{t.footer_cgu}</a>
            <span className="hidden sm:inline">•</span>
            <a href="/cgv" className="hover:text-[#e2e2e8] transition-colors">{t.footer_cgv}</a>
            <span className="hidden sm:inline">•</span>
            <a href="/confidentialite" className="hover:text-[#e2e2e8] transition-colors">{t.footer_privacy}</a>
            <span className="hidden sm:inline">&bull;</span>
            <a href="/business/politique-utilisation" className="hover:text-[#e2e2e8] transition-colors">{t.footer_business_policy}</a>
          </div>

          <div className="flex gap-6 text-xs">
            <a
              href="https://www.linkedin.com/in/thomas-shamoev-570885237/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#909095] hover:text-[#e2e2e8] transition-colors"
            >
              LinkedIn
            </a>
            <a href="mailto:support@closeos.fr" className="text-[#909095] hover:text-[#e2e2e8] transition-colors">support@closeos.fr</a>
          </div>
        </div>
      </footer>
    </div>
  );
};
