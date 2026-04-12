import { useEffect } from 'react';
import { X, ArrowLeft } from 'lucide-react';
import Cal, { getCalApi } from "@calcom/embed-react";
import { useLanguage } from '../contexts/LanguageContext';

interface DemoExitModalProps {
  isOpen: boolean;
  onClose: () => void; // Pour fermer le popup et rester sur la page
  onConfirmExit: () => void; // Pour vraiment quitter (si l'utilisateur refuse)
}

export function DemoExitModal({ isOpen, onClose, onConfirmExit }: DemoExitModalProps) {
  const { lang } = useLanguage();

  useEffect(() => {
    if (isOpen) {
      (async function () {
        const cal = await getCalApi({"namespace":"demo-closeos-decouvrez-la-plateforme"});
        cal("ui", {
          "theme": "dark",
          "hideEventTypeDetails": false,
          "layout": "month_view"
        });
      })();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl h-[85vh] bg-[#1a1a1a] rounded-2xl border border-white/[0.08] shadow-[0_20px_40px_rgba(0,0,0,0.2)] flex flex-col overflow-hidden">
        
        {/* En-tête du Modal */}
        <div className="flex items-center justify-between p-6 border-b border-white/[0.08] bg-white/[0.03] backdrop-blur-2xl">
          <div>
            <h2 className="text-xl font-bold text-white">{lang === 'fr' ? 'Pas encore convaincu ? 🤔' : 'Not convinced yet? 🤔'}</h2>
            <p className="text-white/40 text-sm">
              {lang === 'fr' ? 'Prenez 15 min de démo pour voir comment CloseOS peut exploser vos commissions.' : 'Take a 15-min demo to see how CloseOS can skyrocket your commissions.'}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenu Cal.com */}
        <div className="flex-1 overflow-y-auto bg-[#101010]">
          <Cal 
            namespace="demo-closeos-decouvrez-la-plateforme"
            calLink="thomas-sh-ipdmni/demo-closeos-decouvrez-la-plateforme"
            style={{width:"100%", height:"100%", overflow:"scroll"}}
            config={{
              layout: 'month_view',
              theme: 'dark'
            }}
          />
        </div>

        {/* Pied de page : Sortie définitive */}
        <div className="p-4 border-t border-white/[0.08] bg-[#1a1a1a] flex justify-center">
          <button
            onClick={onConfirmExit}
            className="flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {lang === 'fr' ? "Non merci, je veux vraiment retourner à l'accueil" : "No thanks, I really want to go back to home"}
          </button>
        </div>

      </div>
    </div>
  );
}