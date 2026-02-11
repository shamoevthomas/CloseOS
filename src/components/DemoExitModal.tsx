import { useEffect } from 'react';
import { X, ArrowLeft } from 'lucide-react';
import Cal, { getCalApi } from "@calcom/embed-react";

interface DemoExitModalProps {
  isOpen: boolean;
  onClose: () => void; // Pour fermer le popup et rester sur la page
  onConfirmExit: () => void; // Pour vraiment quitter (si l'utilisateur refuse)
}

export function DemoExitModal({ isOpen, onClose, onConfirmExit }: DemoExitModalProps) {
  
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl h-[85vh] bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl flex flex-col overflow-hidden">
        
        {/* En-tête du Modal */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
          <div>
            <h2 className="text-xl font-bold text-white">Pas encore convaincu ? 🤔</h2>
            <p className="text-slate-400 text-sm">
              Prenez 15 min de démo pour voir comment CloseOS peut exploser vos commissions.
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors"
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
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-center">
          <button
            onClick={onConfirmExit}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Non merci, je veux vraiment retourner à l'accueil
          </button>
        </div>

      </div>
    </div>
  );
}