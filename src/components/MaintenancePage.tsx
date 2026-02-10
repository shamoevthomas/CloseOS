import { Rocket, MessageCircle, Linkedin, Sparkles, BellRing } from 'lucide-react'

export function MaintenancePage() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#020617] p-6 text-center relative overflow-hidden font-sans selection:bg-blue-500/30">
      
      {/* Background Effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 opacity-30 blur-[120px] rounded-full pointer-events-none"></div>
      
      <div className="relative z-10 flex flex-col items-center max-w-2xl w-full">
        
        {/* ICONE */}
        <div className="relative mb-8 group">
          <div className="absolute -inset-1 rounded-full bg-blue-600 blur opacity-40 group-hover:opacity-60 transition-opacity duration-500 animate-pulse"></div>
          <div className="relative rounded-full bg-slate-900 p-6 border border-slate-800 shadow-2xl">
            <Rocket className="h-12 w-12 text-blue-500" />
          </div>
        </div>

        {/* TITRES */}
        <h1 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight">
          Close<span className="text-blue-500">OS</span> arrive.
        </h1>
        <p className="text-lg text-slate-400 mb-10 leading-relaxed max-w-lg mx-auto">
          La plateforme tout-en-un pour les closers est en phase finale de préparation. 
          La page de présentation sera disponible très bientôt.
        </p>

        {/* ENCART OFFRE SPECIALE */}
        <div className="w-full bg-gradient-to-br from-slate-900 to-slate-950 border border-blue-500/30 p-8 rounded-3xl relative overflow-hidden mb-10 shadow-2xl shadow-blue-900/20 group">
          <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-widest">
            Exclusif
          </div>
          <div className="absolute inset-0 bg-blue-500/5 group-hover:bg-blue-500/10 transition-colors duration-500"></div>
          
          <div className="relative z-10 flex flex-col items-center gap-3">
             <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest">
               <Sparkles className="w-3 h-3" /> Offre de Prélancement
             </span>
             
             <div className="text-center mt-2">
               <p className="text-3xl md:text-4xl font-black text-white mb-1">
                 -65% <span className="text-slate-500 text-lg font-medium line-through decoration-red-500/50">à vie</span>
               </p>
               <p className="text-slate-400 text-sm">
                 Réservez votre place avant l'ouverture officielle.
               </p>
             </div>
          </div>
        </div>

        {/* BOUTONS D'ACTION */}
        <div className="flex flex-col gap-4 w-full max-w-sm">
          <a 
            href="https://whatsapp.com/channel/0029Vb7P4lqDDmFLVtD7Jn0s" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 w-full py-4 rounded-xl bg-[#25D366] text-slate-950 font-bold text-lg hover:bg-[#20bd5a] hover:scale-[1.02] transition-all shadow-lg shadow-[#25D366]/20 group"
          >
            <MessageCircle className="h-6 w-6 fill-current group-hover:animate-bounce" />
            Rejoindre le canal WhatsApp
          </a>
          
          <a 
            href="https://www.linkedin.com/in/thomas-shamoev-570885237/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 w-full py-4 rounded-xl bg-[#0077b5] text-white font-bold text-lg hover:bg-[#006396] hover:scale-[1.02] transition-all shadow-lg shadow-[#0077b5]/20"
          >
            <Linkedin className="h-6 w-6 fill-current" />
            Suivre sur LinkedIn
          </a>
        </div>

        <div className="mt-10 flex items-center gap-2 text-xs text-slate-600">
           <BellRing className="w-3 h-3" /> Soyez notifié en premier.
        </div>

      </div>
    </div>
  )
}