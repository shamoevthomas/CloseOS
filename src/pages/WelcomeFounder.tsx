import { useNavigate, useSearchParams } from 'react-router-dom';
import { Target, MessageCircle, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext'; 

export function WelcomeFounder() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  
  // 👇 DÉTECTION DU PLAN (Starter ou Founder)
  const [searchParams] = useSearchParams();
  const isStarter = searchParams.get('plan') === 'starter';

  // 👇 TON LIEN WHATSAPP OFFICIEL
  const WHATSAPP_LINK = "https://whatsapp.com/channel/0029Vb7P4lqDDmFLVtD7Jn0s";

  // 👇 CONFIG VIDEOS
  const VIDEO_ID_FOUNDER = "ewsQesgvs1w";
  // 👇 NOUVEL ID VIDEO STARTER ICI
  const VIDEO_ID_STARTER = "3IsO7V3-bnY"; 

  const activeVideoId = isStarter ? VIDEO_ID_STARTER : VIDEO_ID_FOUNDER;
  const YOUTUBE_URL = `https://www.youtube.com/embed/${activeVideoId}?autoplay=1&mute=1&controls=1&rel=0&modestbranding=1&playsinline=1`;

  // Fonction pour gérer la vraie déconnexion
  const handleLogout = async () => {
    try {
      await logout(); // On détruit la session
      navigate('/', { replace: true });  // On renvoie vers la landing page publique
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error);
      // Rediriger quand même vers la landing en cas d'erreur
      navigate('/', { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans selection:bg-blue-500/30 flex flex-col">
      
      {/* HEADER SIMPLE */}
      <nav className="border-b border-white/5 bg-[#020617]/80 backdrop-blur-md px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          
          {/* Logo seul (non cliquable) */}
          <div className="flex items-center gap-2">
            <img src="/logo.PNG" alt="CloseOS" className="h-8 w-auto" />
          </div>

          {/* Vraie déconnexion */}
          <button 
            onClick={handleLogout}
            className="text-slate-500 hover:text-white transition-colors flex items-center gap-2 text-sm bg-transparent border-none cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Déconnexion</span>
          </button>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-start pt-12 px-6 pb-20">
        <div className="max-w-3xl w-full text-center space-y-8">
          
          {/* TITRE & CONFIRMATION DYNAMIQUE */}
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* BADGE QUI CHANGE DE COULEUR ET DE TEXTE */}
            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-widest mb-6 ${
              isStarter 
                ? "bg-blue-500/10 border-blue-500/20 text-blue-400" 
                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
            }`}>
              <Target className="h-3 w-3" /> 
              {isStarter ? "Espace Starter Activé" : "Place Founder Sécurisée"}
            </span>
            
            <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-6">
              {isStarter ? "Bienvenue sur CloseOS." : "Bienvenue dans l'Élite."}
            </h1>
            
            <p className="text-lg text-slate-400 leading-relaxed max-w-2xl mx-auto">
              {isStarter 
                ? "Félicitations. Ton abonnement Starter est actif."
                : "Félicitations. Ton abonnement à vie est verrouillé."
              } 
              <br/>
              Regarde cette courte vidéo pour comprendre la suite.
            </p>
          </div>

          {/* LECTEUR YOUTUBE DYNAMIQUE */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-800 shadow-2xl shadow-blue-900/20 bg-slate-900 aspect-video animate-in fade-in zoom-in duration-700 delay-100 group">
             <iframe 
                src={YOUTUBE_URL} 
                className="absolute top-0 left-0 w-full h-full"
                title="Bienvenue"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
             ></iframe>
          </div>

          {/* INSTRUCTIONS & WHATSAPP */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 text-left space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
            <div>
              <h3 className="text-xl font-bold text-white mb-4">La suite des événements :</h3>
              <ul className="space-y-4 text-slate-400">
                <li className="flex gap-4 items-start">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-blue-400 text-xs font-bold border border-blue-600/30 mt-0.5">1</span>
                  <span>
                    <strong>Onboarding :</strong> L'accès au logiciel ouvrira officiellement dans quelques jours.{" "}
                    <span className="text-white font-medium">Vos jours d'essai ne commenceront qu'à partir du lancement de l'outil.</span>
                  </span>
                </li>
                <li className="flex gap-4 items-start">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-blue-400 text-xs font-bold border border-blue-600/30 mt-0.5">2</span>
                  <span><strong>Communication :</strong> Toutes les annonces importantes passent par le canal WhatsApp.</span>
                </li>
              </ul>
            </div>

            <a 
              href={WHATSAPP_LINK} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 w-full py-4 rounded-xl bg-[#25D366] text-slate-950 font-bold text-lg hover:bg-[#20bd5a] hover:scale-[1.02] transition-all shadow-lg shadow-[#25D366]/20"
            >
              <MessageCircle className="h-6 w-6 fill-current" />
              Rejoindre le canal WhatsApp
            </a>
            <p className="text-xs text-center text-slate-500">
              Clique ci-dessus pour ne rien rater du lancement.
            </p>
          </div>

        </div>
      </main>
    </div>
  );
}