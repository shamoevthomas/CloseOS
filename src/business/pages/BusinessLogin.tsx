import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Loader2, X, Check, AlertCircle, ArrowLeft, KeyRound } from 'lucide-react';
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
    <div className="min-h-screen flex flex-col bg-[#fbf9f8] relative overflow-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Decorative blobs */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-[#ffb95f]/10 rounded-full blur-[100px] -z-10" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-[#006c49]/5 rounded-full blur-[100px] -z-10" />

      {/* Header */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-8 py-6">
        <Link to="/business" className="font-extrabold tracking-tighter text-2xl text-stone-900" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
          CloseOS
        </Link>
        <Link to="/business" className="group flex items-center gap-2 text-sm font-semibold text-stone-500 hover:text-stone-900 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Retour au site
        </Link>
      </header>

      {/* Main */}
      <main className="flex-grow flex items-center justify-center px-4 pt-24 pb-12">
        <div className="glass-card w-full max-w-md rounded-2xl p-10 shadow-[0_20px_40px_rgba(27,28,27,0.04)]" style={{ border: '0.5px solid rgba(196,199,199,0.2)' }}>
          {/* Identity Header */}
          <div className="text-center mb-9">
            <div className="inline-flex items-center gap-2 mb-4">
              <span className="bg-stone-900 text-white px-3 py-1 rounded-full text-[10px] font-bold tracking-[0.15em] uppercase">Business</span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-stone-900">Se connecter</h1>
            <p className="text-stone-500 mt-3 text-sm">Gérez vos campagnes et actifs avec CloseOS Business.</p>
          </div>

          {/* Google Auth */}
          <button
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-white border border-stone-200/20 rounded-full hover:bg-stone-50 transition-all duration-300 disabled:opacity-50"
          >
            {googleLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-stone-500" />
            ) : (
              <svg height="20" viewBox="0 0 24 24" width="20" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            )}
            <span className="text-sm font-semibold text-stone-700">Continuer avec Google</span>
          </button>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-stone-200/30" />
            </div>
            <div className="relative flex justify-center text-[10px]">
              <span className="px-4 bg-transparent text-stone-400/60 font-medium tracking-wider uppercase">Ou par email</span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 flex items-center gap-2 p-3 bg-red-50/50 border border-red-200/30 rounded-2xl text-red-600 text-xs font-medium">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold tracking-[0.15em] text-stone-500 uppercase ml-1" htmlFor="login-email">Adresse Email</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400/40 group-focus-within:text-emerald-600 transition-colors" />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-stone-100/50 border-none rounded-2xl py-4 pl-12 pr-4 text-sm text-stone-900 focus:ring-2 focus:ring-emerald-600/20 transition-all placeholder:text-stone-400/40 outline-none"
                  placeholder="nom@entreprise.com"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="block text-[10px] font-bold tracking-[0.15em] text-stone-500 uppercase" htmlFor="login-password">Mot de passe</label>
                <button type="button" onClick={() => setIsResetModalOpen(true)} className="text-xs font-semibold text-emerald-700 hover:underline transition-colors">Oublié ?</button>
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400/40 group-focus-within:text-emerald-600 transition-colors" />
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-stone-100/50 border-none rounded-2xl py-4 pl-12 pr-4 text-sm text-stone-900 focus:ring-2 focus:ring-emerald-600/20 transition-all placeholder:text-stone-400/40 outline-none"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-stone-900 text-white font-bold py-4 rounded-full shadow-lg shadow-stone-900/10 hover:shadow-stone-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Se connecter'}
            </button>
          </form>

          {/* Bottom link */}
          <div className="mt-9 pt-7 border-t border-stone-200/20 text-center">
            <p className="text-sm text-stone-500">
              Nouveau ici ?{' '}
              <Link to="/business/register" className="font-bold text-stone-900 ml-1 hover:underline transition-all">
                Créer un compte Business
              </Link>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-stone-200/20 bg-[#fbf9f8] px-12 py-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="font-bold text-stone-900">
          CloseOS Business.
        </div>
        <div className="flex gap-8 text-xs font-medium text-stone-400">
          <a className="hover:text-emerald-700 transition-colors" href="#">Aide</a>
          <a className="hover:text-emerald-700 transition-colors" href="#">Confidentialité</a>
          <a className="hover:text-emerald-700 transition-colors" href="#">CGV</a>
        </div>
        <div className="text-[10px] text-stone-400/60 tracking-wider uppercase font-semibold">
          © {new Date().getFullYear()} CloseOS Business.
        </div>
      </footer>

      {/* Password Reset Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/20 backdrop-blur-md" onClick={() => { setIsResetModalOpen(false); setResetMessage(null); setResetEmail(''); }} />
          <div className="relative glass-card w-full max-w-sm rounded-2xl p-8 shadow-2xl" style={{ border: '0.5px solid rgba(196,199,199,0.2)' }}>
            <div className="text-center">
              <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <KeyRound className="h-7 w-7 text-stone-900" />
              </div>
              <h3 className="text-2xl font-extrabold text-stone-900 mb-2">Réinitialisation</h3>
              <p className="text-sm text-stone-500 mb-7">Entrez votre email pour recevoir un lien de récupération.</p>

              {resetMessage && (
                <div className={`mb-6 p-4 rounded-2xl border flex items-start gap-3 text-left ${resetMessage.type === 'success'
                  ? 'bg-emerald-50/50 border-emerald-200/30 text-emerald-700'
                  : 'bg-red-50/50 border-red-200/30 text-red-600'
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
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full bg-stone-100/50 border-none rounded-2xl py-4 px-4 text-sm text-stone-900 focus:ring-2 focus:ring-emerald-600/20 outline-none placeholder:text-stone-400/40"
                  placeholder="Votre email"
                  required
                />
                <button
                  type="submit"
                  disabled={resetLoading || !resetEmail}
                  className="w-full bg-stone-900 text-white font-bold py-4 rounded-full transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resetLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Envoyer le lien'}
                </button>
                <button
                  type="button"
                  onClick={() => { setIsResetModalOpen(false); setResetMessage(null); setResetEmail(''); }}
                  className="text-xs font-bold text-stone-500 hover:text-stone-900 transition-colors mt-2"
                >
                  Retour
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
