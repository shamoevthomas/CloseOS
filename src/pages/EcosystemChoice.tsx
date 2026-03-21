import React, { useEffect } from 'react';
import { motion } from 'motion/react';

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
    <div className="min-h-screen font-sans flex flex-col items-center justify-center px-6 py-16 relative overflow-hidden">
      {/* Split background — dark left, light right */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-r from-[#020617] via-[#020617] to-[#f4f2f1]" style={{ background: 'linear-gradient(to right, #020617 0%, #020617 45%, #0a0e1f 50%, #f4f2f1 55%, #f4f2f1 100%)' }} />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-3xl">
        {/* Logo — big and rounded */}
        <motion.img
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          src="/CloseOS Logo.png"
          alt="CloseOS"
          className="h-20 object-contain mb-10"
        />

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-stone-200 shadow-sm mb-6"
        >
          <span className="text-sm font-medium text-stone-800">
            Bienvenue dans l'écosystème <span className="font-bold text-[#111111]">CloseOS</span>
          </span>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="text-4xl md:text-5xl font-bold tracking-tight text-center mb-3 text-[#111111]"
        >
          Quel est votre profil ?
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-stone-500 text-lg font-medium mb-12"
        >
          Choisissez l'outil fait pour vous
        </motion.p>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
          {/* CloseOS Sales — dark card */}
          <motion.div
            initial={{ opacity: 0, y: 24, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="bg-slate-900/80 backdrop-blur-sm rounded-3xl border border-slate-700/50 p-8 flex flex-col items-center text-center hover:border-slate-600 hover:shadow-2xl hover:shadow-blue-500/5 transition-all duration-300"
          >
            <img
              src="/logo Sales.png"
              alt="CloseOS Sales"
              className="h-12 object-contain mb-6"
            />
            <h2 className="text-xl font-bold text-white mb-2">Je suis Closer</h2>
            <p className="text-slate-400 text-sm font-medium leading-relaxed mb-8">
              Gérez vos prospects, vos calls et votre facturation en autonomie
            </p>
            <button
              onClick={onChooseSales}
              className="w-full bg-white text-[#020617] rounded-xl py-3.5 font-bold text-sm hover:bg-slate-100 transition-all"
            >
              Accéder à CloseOS Sales
            </button>
          </motion.div>

          {/* CloseOS Business — white card */}
          <motion.div
            initial={{ opacity: 0, y: 24, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.6, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white rounded-3xl border border-stone-200 shadow-sm p-8 flex flex-col items-center text-center hover:shadow-lg transition-all duration-300 relative"
          >
            {/* Badge Nouveau */}
            <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-[#111111] text-white text-xs font-bold">
              Nouveau 🚀
            </div>
            <img
              src="/CloseOS Buisness.png"
              alt="CloseOS Business"
              className="h-12 object-contain mb-6"
            />
            <h2 className="text-xl font-bold text-[#111111] mb-2">Je suis Infopreneur / Manager</h2>
            <p className="text-stone-500 text-sm font-medium leading-relaxed mb-8">
              Pilotez votre équipe, vos campagnes d'acquisition et vos performances
            </p>
            <button
              onClick={onChooseBusiness}
              className="w-full bg-[#111111] text-white rounded-xl py-3.5 font-bold text-sm hover:opacity-90 transition-all"
            >
              Accéder à CloseOS Business
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
