import { useNavigate } from 'react-router-dom';
import { LogOut, MessageCircle, Linkedin, Rocket, Clock, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function ComingSoon() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/', { replace: true });
    } catch (error) {
      console.error("Erreur déconnexion:", error);
      // Rediriger quand même vers la landing en cas d'erreur
      navigate('/', { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white font-sans selection:bg-blue-500/30 flex flex-col items-center justify-center p-4 relative overflow-hidden">

      {/* EFFETS DE FOND (Optionnel pour le style) */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[100px]"></div>
      </div>

      <div className="max-w-2xl w-full bg-[#0B1121] border border-slate-800 rounded-3xl p-8 md:p-12 shadow-2xl shadow-blue-900/10 relative z-10 text-center animate-in fade-in zoom-in duration-500">

        {/* LOGO */}
        <div className="flex justify-center mb-8">
          <img src="/logo Sales.png" alt="CloseOS" className="h-12 w-auto" />
        </div>

        {/* TITRE & ICONE */}
        <div className="inline-flex items-center justify-center p-4 bg-blue-600/10 rounded-full mb-6 ring-1 ring-blue-500/20">
          <Rocket className="w-8 h-8 text-blue-500" />
        </div>

        <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-4 tracking-tight">
          Lancement Imminent
        </h1>

        <p className="text-lg text-slate-400 mb-8 leading-relaxed">
          Nous peaufinons les derniers détails de la plateforme. <br className="hidden md:block" />
          Votre espace Founder est sécurisé et vous attend.
        </p>

        {/* BOITE D'INFO ESSAI GRATUIT */}
        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-4 mb-8 text-left flex gap-4 items-start">
          <ShieldCheck className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-emerald-400 text-sm mb-1">Aucune inquiétude pour votre essai</h3>
            <p className="text-xs text-emerald-500/80 leading-snug">
              Le décompte de vos 10 jours d'essai gratuit ne commencera <strong>que le jour officiel de l'ouverture</strong> du logiciel. Vous ne perdez aucun jour en attendant.
            </p>
          </div>
        </div>

        {/* ACTIONS & RÉSEAUX */}
        <div className="space-y-4">
          <p className="text-sm text-slate-500 font-medium uppercase tracking-wider mb-4">Restez connectés</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <a
              href="https://whatsapp.com/channel/0029Vb7P4lqDDmFLVtD7Jn0s"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20 hover:bg-[#25D366]/20 transition-all font-bold"
            >
              <MessageCircle className="w-5 h-5" />
              Canal WhatsApp
            </a>

            <a
              href="https://www.linkedin.com/in/thomas-shamoev-570885237/" // 👈 METS TON LIEN LINKEDIN ICI
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-[#0A66C2]/10 text-[#0A66C2] border border-[#0A66C2]/20 hover:bg-[#0A66C2]/20 transition-all font-bold"
            >
              <Linkedin className="w-5 h-5" />
              Suivre sur LinkedIn
            </a>
          </div>
        </div>

        {/* PIED DE PAGE : DÉCONNEXION */}
        <div className="mt-12 pt-8 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="text-slate-500 hover:text-white transition-colors flex items-center justify-center gap-2 text-sm mx-auto hover:underline"
          >
            <LogOut className="h-4 w-4" />
            Se déconnecter et revenir à l'accueil
          </button>
        </div>

      </div>
    </div>
  );
}