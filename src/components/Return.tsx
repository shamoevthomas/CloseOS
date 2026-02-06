import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, Lock, User, Mail, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function Return() {
  const [status, setStatus] = useState<string | null>(null);
  const [customerEmail, setCustomerEmail] = useState('');
  const [loadingStripe, setLoadingStripe] = useState(true);
  
  // États pour l'inscription
  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'password' | 'google'>('password');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const sessionId = urlParams.get('session_id');

    if (sessionId) {
      fetch(`/api/session-status?session_id=${sessionId}`)
        .then((res) => res.json())
        .then((data) => {
          setStatus(data.status);
          setCustomerEmail(data.customer_email);
          setLoadingStripe(false);
        })
        .catch(() => setLoadingStripe(false));
    } else {
      setLoadingStripe(false);
    }
  }, []);

  // Gestion de l'inscription par Email/Mot de passe
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAuthLoading(true);

    try {
      // On utilise l'email de Stripe (customerEmail) pour l'inscription
      const result = await register({ 
        email: customerEmail, 
        password,
        options: {
          data: { 
            full_name: name,
            // 👇 C'EST ICI QUE LA MAGIE OPÈRE : ON ACTIVE LE BADGE FOUNDER
            is_founder: true 
          }
        }
      });

      if (result?.error) {
        setError(result.error.message);
        setAuthLoading(false);
      } else {
        // Succès : on redirige vers le dashboard
        navigate('/');
      }
    } catch (err: any) {
      setError("Une erreur est survenue lors de la création du compte.");
      setAuthLoading(false);
    }
  };

  // Gestion de l'inscription Google
  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    try {
      const { error } = await loginWithGoogle();
      if (error) setError(error.message);
    } catch (err) {
      setError("Impossible de lancer la connexion Google.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Redirections
  if (!loadingStripe && status === 'open') {
    return <Navigate to="/checkout" />;
  }
  if (!loadingStripe && !status) {
    return <Navigate to="/" />;
  }

  // Loader
  if (loadingStripe) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-slate-400 text-sm">Vérification du paiement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-emerald-500/20 rounded-3xl p-8 shadow-2xl shadow-emerald-900/10">
        
        {/* Header Succès */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-emerald-500/10 rounded-full mb-4 ring-1 ring-emerald-500/20">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Paiement réussi !</h1>
          <p className="text-slate-400">
            Bienvenue dans l'Élite. Finalisez votre compte pour accéder à votre espace.
          </p>
        </div>

        {/* Onglets */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl mb-6">
          <button
            onClick={() => setActiveTab('password')}
            className={`py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'password'
                ? 'bg-slate-800 text-white shadow-lg'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Mot de passe
          </button>
          <button
            onClick={() => setActiveTab('google')}
            className={`py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'google'
                ? 'bg-slate-800 text-white shadow-lg'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Google
          </button>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {/* Contenu Onglet Mot de passe */}
        {activeTab === 'password' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Email (lié au paiement)</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                <input
                  type="email"
                  value={customerEmail}
                  disabled
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-slate-400 cursor-not-allowed focus:outline-none"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Lock className="h-4 w-4 text-emerald-500" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Votre Nom</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Ex: Thomas Shelby"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Choisir un mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {authLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Activer mon compte"}
              {!authLoading && <LayoutDashboard className="h-4 w-4" />}
            </button>
          </form>
        )}

        {/* Contenu Onglet Google */}
        {activeTab === 'google' && (
          <div className="text-center py-4">
            <p className="text-slate-400 mb-6 text-sm">
              Utilisez votre compte Google pour accéder directement à l'espace membre.
              <br />
              <span className="text-xs text-slate-500">(L'email doit correspondre à celui utilisé pour le paiement)</span>
            </p>
            
            <button
              onClick={handleGoogleLogin}
              disabled={authLoading}
              className="w-full bg-white hover:bg-slate-100 text-slate-900 font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {authLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-slate-900" />
              ) : (
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="h-5 w-5" alt="Google" />
              )}
              Continuer avec Google
            </button>
          </div>
        )}

      </div>
    </div>
  );
}