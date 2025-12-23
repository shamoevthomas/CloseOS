import { useState } from 'react';
import { Phone, User, Briefcase, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function OnboardingModal() {
  const { user, updateProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    full_name: user?.user_metadata?.full_name || '',
    phone: '',
    role: '', // Closer, Setter, ou Setter-Closer
    avatar_url: user?.user_metadata?.avatar_url || ''
  });

  // Si l'utilisateur a déjà un rôle enregistré dans Supabase, on n'affiche plus la modale
  if (user?.user_metadata?.role) return null;

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Sauvegarde des informations dans les métadonnées de l'utilisateur Supabase
      await updateProfile({
        full_name: formData.full_name,
        phone: formData.phone,
        role: formData.role,
        onboarding_completed: true
      });
      // Le rafraîchissement se fait via le changement d'état du contexte Auth
    } catch (error) {
      console.error("Erreur onboarding:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    /* CORRECTION : On utilise z-[9999] pour passer au-dessus du Header/Sidebar 
       qui utilisent souvent des z-index élevés (z-50 ou z-100).
    */
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10 text-blue-500">
            <User className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold text-white">Bienvenue sur CloserOS</h2>
          <p className="mt-2 text-gray-400">Configurons votre profil pour commencer</p>
        </div>

        <div className="space-y-6">
          {/* ÉTAPE 1 : IDENTITÉ */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300 text-left">Nom complet</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none transition-colors"
                placeholder="Prénom Nom"
              />
            </div>
          </div>

          {/* ÉTAPE 2 : TÉLÉPHONE */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300 text-left">Numéro de téléphone</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none transition-colors"
                placeholder="+33 6 12 34 56 78"
              />
            </div>
          </div>

          {/* ÉTAPE 3 : RÔLE */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300 text-left">Votre spécialité</label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
              <select
                value={formData.role}
                onChange={(e) => setFormData({...formData, role: e.target.value})}
                className="w-full appearance-none rounded-lg border border-gray-700 bg-gray-800 py-3 pl-10 pr-4 text-white focus:border-blue-500 focus:outline-none cursor-pointer"
              >
                <option value="" className="text-gray-500">Sélectionnez votre rôle</option>
                <option value="Closer">Closer</option>
                <option value="Setter">Setter</option>
                <option value="Setter-Closer">Setter-Closer</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || !formData.role || !formData.full_name}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 font-semibold text-white transition-all hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Enregistrement...</span>
              </>
            ) : (
              <>
                <span>Terminer la configuration</span>
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}