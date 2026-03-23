import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, ChevronRight, Shield, Zap, ShieldCheck } from 'lucide-react';

interface EcosystemChoiceProps {
  onChooseSales: () => void;
  onChooseBusiness: () => void;
}

export const EcosystemChoice: React.FC<EcosystemChoiceProps> = ({ onChooseSales, onChooseBusiness }) => {
  useEffect(() => {
    document.title = "CloseOS — L'écosystème ultime pour la vente digitale francophone";
    document.querySelector('meta[name="description"]')?.setAttribute('content',
      'CloseOS est un écosystème SaaS pour les closers et infopreneurs francophones. CloseOS Sales pour les closers, CloseOS Business pour les infopreneurs et managers.'
    );
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col selection:bg-[#b6c4ff]/30"
      style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        backgroundColor: '#111318',
        color: '#e2e2e8',
      }}
    >
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 backdrop-blur-xl">
        <div className="flex justify-between items-center px-8 py-6 max-w-7xl mx-auto">
          <div className="text-2xl font-bold tracking-tight text-[#e2e2e8]">
            CloseOS
          </div>
          <div className="hidden md:flex items-center space-x-8">
            <a href="#" className="text-[#909095] hover:text-[#e2e2e8] transition-colors">Solutions</a>
            <a href="#" className="text-[#909095] hover:text-[#e2e2e8] transition-colors">Pricing</a>
            <a href="#" className="text-[#909095] hover:text-[#e2e2e8] transition-colors">Support</a>
            <button className="bg-[#e2e2e8] text-[#1a1c20] px-6 py-2 rounded-lg font-semibold hover:opacity-80 transition-opacity duration-200 ease-in-out">
              Log In
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main
        className="flex-grow flex flex-col items-center justify-center relative pt-24 pb-12 overflow-hidden"
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
            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tighter text-[#e2e2e8] leading-tight">
              Choisissez votre outil
            </h1>
            <p className="text-[#909095] text-lg max-w-xl mx-auto font-medium">
              Sélectionnez l'interface optimisée pour votre rôle stratégique au sein de l'écosystème.
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
                  Je suis Closer
                </span>
                <p className="text-[#909095] leading-relaxed mb-12 max-w-xs">
                  Optimisez votre tunnel de conversion. Gérez vos prospects, vos appels stratégiques et automatisez votre facturation en un clic.
                </p>
              </div>

              <div className="relative z-10">
                <button
                  onClick={(e) => { e.stopPropagation(); onChooseSales(); }}
                  className="w-full flex items-center justify-between px-8 py-5 bg-[#e2e2e8] text-[#1a1c20] rounded-xl font-bold text-lg hover:opacity-90 transition-all group-hover:scale-[1.02] duration-300"
                >
                  Accéder
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
                    Nouveau
                  </span>
                </div>
                <h2 className="text-3xl font-bold mb-4 text-[#e2e2e8]">CloseOS Business</h2>
                <span className="inline-block px-4 py-1.5 rounded-full bg-[#282a2e] text-[#00e475] text-xs font-bold uppercase tracking-wider mb-6 border border-[#45474b]/30">
                  Infopreneur / Manager
                </span>
                <p className="text-[#909095] leading-relaxed mb-12 max-w-xs">
                  Pilotez votre croissance. Management d'équipes de vente, suivi des campagnes d'acquisition et analytics haute-précision.
                </p>
              </div>

              <div className="relative z-10">
                <button
                  onClick={(e) => { e.stopPropagation(); onChooseBusiness(); }}
                  className="w-full flex items-center justify-between px-8 py-5 bg-[#00e475] text-[#003918] rounded-xl font-bold text-lg hover:brightness-110 transition-all group-hover:scale-[1.02] duration-300"
                >
                  Accéder
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          </div>

          {/* Bottom Trust Badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="mt-20 flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16"
          >
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-[#e2e2e8]" />
              <span className="text-xs font-semibold uppercase tracking-widest">Infrastructures sécurisées</span>
            </div>
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-[#e2e2e8]" />
              <span className="text-xs font-semibold uppercase tracking-widest">Haute-performance</span>
            </div>
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-[#e2e2e8]" />
              <span className="text-xs font-semibold uppercase tracking-widest">Standard Entreprise</span>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer
        className="w-full py-12"
        style={{ background: 'linear-gradient(to top, #1a1c20, transparent)', backgroundColor: '#111318' }}
      >
        <div className="flex flex-col md:flex-row justify-between items-center px-12 opacity-60 text-[#909095] text-[10px] uppercase tracking-[0.05rem] font-medium">
          <div>© 2025 CloseOS. High-Performance Revenue Systems.</div>
          <div className="flex space-x-8 mt-4 md:mt-0">
            <a href="#" className="hover:text-[#00e475] transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-[#00e475] transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-[#00e475] transition-colors">Security</a>
          </div>
        </div>
      </footer>
    </div>
  );
};
