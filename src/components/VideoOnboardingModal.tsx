import { X } from 'lucide-react';

interface VideoOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VideoOnboardingModal({ isOpen, onClose }: VideoOnboardingModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/80 backdrop-blur-sm p-4">
      <div className="min-h-full flex items-center justify-center py-8">
        <div className="w-full max-w-2xl rounded-2xl border border-blue-500/20 bg-[#0B1121] p-8 shadow-2xl relative overflow-hidden">

          {/* Halo décoratif */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[80px] rounded-full pointer-events-none" />

          {/* Bouton fermer */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors z-10"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="relative z-10">
            {/* Titre */}
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-bold text-white mb-3">Onboarding CloseOS V1</h2>
              <p className="text-slate-400 leading-relaxed">
                Merci d'avoir rejoint CloseOS ! Pour tirer le meilleur parti de la plateforme,
                <span className="text-white font-semibold"> nous vous recommandons fortement de regarder cette vidéo d'onboarding</span>.
                Elle vous guidera à travers toutes les fonctionnalités essentielles en quelques minutes.
              </p>
            </div>

            {/* Vidéo YouTube */}
            <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-slate-700 mb-6">
              <iframe
                src="https://www.youtube.com/embed/2_3V1mOESZU?autoplay=1&rel=0"
                title="Onboarding CloseOS V1"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
              />
            </div>

            {/* Boutons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href="https://whatsapp.com/channel/0029Vb7P4lqDDmFLVtD7Jn0s"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-3 font-bold text-white transition-all hover:bg-green-500 shadow-lg shadow-green-500/20"
              >
                <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Rejoindre la communauté
              </a>
              <button
                onClick={onClose}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-6 py-3 font-bold text-slate-300 transition-all hover:bg-slate-700 hover:text-white"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}