import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Loader2, LogIn, X, Check, AlertCircle } from 'lucide-react';
import { useBusinessAuth } from '../contexts/BusinessAuthContext';
import { supabase } from '../../lib/supabase';

export default function BusinessLogin() {
  const navigate = useNavigate();
  const { login, user, loading: authLoading, businessProfile, isTeamMember, refreshProfile } = useBusinessAuth();

  useEffect(() => {
    if (!authLoading && user) {
      if (businessProfile || isTeamMember) {
        navigate('/business/dashboard', { replace: true });
      }
    }
  }, [user, authLoading, businessProfile, isTeamMember, navigate]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;

    setResetLoading(true);
    setResetMessage(null);

    try {
      const response = await fetch('/api/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de la demande");
      }

      setResetMessage({ type: 'success', text: 'Un email de réinitialisation a été envoyé. Vérifiez votre boîte de réception (et vos spams).' });
      setResetEmail('');
    } catch (error: any) {
      setResetMessage({ type: 'error', text: error.message || "Une erreur est survenue." });
    } finally {
      setResetLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await login({ email, password });
      if (result?.error) {
        setError(result.error.message || "Email ou mot de passe incorrect");
        setLoading(false);
      } else {
        // initUser in auth context auto-creates business_users if needed
        // Just wait for profile to be ready then navigate
        await refreshProfile();
        navigate('/business/dashboard');
      }
    } catch (err) {
      setError("Une erreur est survenue.");
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/business/dashboard`
        }
      });

      if (error) setError(error.message);
    } catch (err) {
      setError("Impossible de lancer la connexion Google.");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FDF6EE] px-4 selection:bg-amber-500/30 font-sans">
      <div className="w-full max-w-md">

        {/* LOGO EN-TÊTE */}
        <div className="mb-10 text-center flex justify-center animate-in fade-in slide-in-from-bottom-4 duration-700">
          <Link to="/business" className="inline-block transition-transform hover:scale-105">
            <img src="/logo.PNG" alt="CloseOS Business" className="h-16 w-auto" />
          </Link>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-white p-8 shadow-2xl shadow-amber-900/5 animate-in fade-in zoom-in duration-500">
          <div className="mb-8">
            <h2 className="mb-2 text-2xl font-bold text-slate-900 flex items-center gap-2">
              <LogIn className="h-6 w-6 text-amber-600" />
              Connexion Business
            </h2>
            <p className="text-slate-500">Accédez à votre espace Business.</p>
          </div>

          {error && (
            <div className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-200">
              {error}
            </div>
          )}

          {/* BOUTON GOOGLE */}
          <button
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="mb-6 flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50 py-3 font-medium text-slate-700 transition-all hover:bg-slate-100 hover:border-slate-300 disabled:opacity-50"
          >
            {googleLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
            ) : (
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="h-5 w-5" alt="Google" />
            )}
            Continuer avec Google
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400 font-bold">Ou avec email</span></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-600 text-left">Email</label>
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 group-focus-within:text-amber-600 transition-colors" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none transition-all"
                  placeholder="votre@email.com"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-bold text-slate-600">Mot de passe</label>
                <button type="button" onClick={() => setIsResetModalOpen(true)} className="text-xs text-amber-600 hover:text-amber-500 transition-colors">Oublié ?</button>
              </div>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 group-focus-within:text-amber-600 transition-colors" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 py-3.5 font-bold text-white transition-all hover:bg-amber-500 hover:shadow-lg hover:shadow-amber-500/25 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Se connecter"}
              {!loading && <ArrowRight className="h-5 w-5" />}
            </button>
          </form>

          <div className="mt-8 text-center border-t border-slate-200 pt-6">
            <p className="text-slate-500 text-sm">
              Pas encore de compte ?{' '}
              <Link to="/business/register" className="font-bold text-amber-600 hover:text-amber-500 hover:underline transition-all">
                Créer un compte Business
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* MODAL MOT DE PASSE OUBLIÉ */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => { setIsResetModalOpen(false); setResetMessage(null); setResetEmail(''); }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mb-6">
              <h3 className="text-xl font-bold text-slate-900 mb-2">Mot de passe oublié ?</h3>
              <p className="text-slate-500 text-sm">Entrez votre email pour recevoir un lien de réinitialisation.</p>
            </div>

            {resetMessage && (
              <div className={`mb-6 p-4 rounded-xl border flex items-start gap-3 ${resetMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-red-50 border-red-200 text-red-600'
                }`}>
                {resetMessage.type === 'success' ? (
                  <Check className="h-5 w-5 mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
                )}
                <p className="text-sm font-medium leading-relaxed">{resetMessage.text}</p>
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-600">Email</label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 group-focus-within:text-amber-600 transition-colors" />
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none transition-all"
                    placeholder="votre@email.com"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={resetLoading || !resetEmail}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 py-3 font-bold text-white transition-all hover:bg-amber-500 hover:shadow-lg hover:shadow-amber-500/25 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resetLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Envoyer le lien"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
