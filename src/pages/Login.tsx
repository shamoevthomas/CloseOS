import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Loader2, LogIn, X, Check, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { loginTranslations } from '../i18n/translations';

export default function Login() {
  const navigate = useNavigate();
  const { login, user, loading: authLoading, isBusinessUser, profile, profileReady } = useAuth();
  const { lang } = useLanguage();
  const t = loginTranslations[lang];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Si déjà connecté, rediriger vers le dashboard
  useEffect(() => {
    if (!authLoading && user && profileReady) {
      // Business-only users (no Sales profile) → error
      if (isBusinessUser && !profile) {
        supabase.auth.signOut();
        setError(t.error_business);
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, authLoading, isBusinessUser, profile, profileReady, navigate]);

  // Forgot Password State
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
        throw new Error(data.error || t.error_reset_request);
      }

      setResetMessage({ type: 'success', text: t.forgot_success });
      setResetEmail('');
    } catch (error: any) {
      setResetMessage({ type: 'error', text: error.message || t.error_generic });
    } finally {
      setResetLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Allow pseudo login: "TEKA" → teka@closeos.local
      const loginEmail = email.includes('@') ? email : `${email.trim().toLowerCase()}@closeos.local`;

      // Skip business-only check for internal dev accounts
      if (!loginEmail.endsWith('@closeos.local')) {
        // Check if this email belongs to a Business-only account (no Sales profile)
        const emailLower = loginEmail.trim().toLowerCase();
        const [businessOwner, businessTeam, salesProfile] = await Promise.all([
          supabase.from('business_users').select('id').eq('email', emailLower).maybeSingle(),
          supabase.from('business_team_members').select('id').eq('email', emailLower).maybeSingle(),
          supabase.from('profiles').select('id').eq('email', emailLower).maybeSingle(),
        ]);

        if ((businessOwner.data || businessTeam.data) && !salesProfile.data) {
          setError(t.error_business);
          setLoading(false);
          return;
        }
      }

      const result = await login({ email: loginEmail, password });
      if (result?.error) {
        setError(result.error.message || t.error_credentials);
        setLoading(false);
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(t.error_generic);
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`
        }
      });

      if (error) setError(error.message);
    } catch (err) {
      setError(t.error_google);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f2f1] dark:bg-[#0d0d0d] px-4 selection:bg-sky-500/20 font-sans">
      <div className="w-full max-w-md">

        {/* LOGO EN-TÊTE */}
        <div className="mb-10 text-center flex justify-center animate-in fade-in slide-in-from-bottom-4 duration-700">
          <Link to="/" className="inline-block transition-transform hover:scale-105">
            <img src="/logo-sales.png" alt="CloseOS Logo" className="h-16 w-auto" />
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] p-8 shadow-2xl shadow-sky-500/10 animate-in fade-in zoom-in duration-500">
          <div className="mb-8">
            <h2 className="mb-2 text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <LogIn className="h-6 w-6 text-sky-600 dark:text-sky-400" />
              {t.title}
            </h2>
            <p className="text-slate-500 dark:text-neutral-400">{t.subtitle}</p>
          </div>

          {error && (
            <div className="mb-6 rounded-lg bg-red-500/10 p-3 text-sm text-red-600 border border-red-500/20">
              {error}
            </div>
          )}

          {/* BOUTON GOOGLE */}
          <button
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="mb-6 flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-[#1a1a1a] py-3 font-medium text-slate-900 dark:text-white transition-all hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50"
          >
            {googleLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-sky-600 dark:text-sky-400" />
            ) : (
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="h-5 w-5" alt="Google" />
            )}
            {t.google}
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-white/10"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white dark:bg-[#1a1a1a] px-2 text-slate-400 dark:text-neutral-500 font-bold">{t.or_email}</span></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-neutral-300 text-left">{t.email}</label>
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 dark:text-neutral-500 group-focus-within:text-sky-600 transition-colors" />
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-white/15 bg-slate-50 dark:bg-white/5 py-3 pl-10 pr-4 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none transition-all"
                  placeholder={t.placeholder_email}
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-bold text-slate-700 dark:text-neutral-300">{t.password}</label>
                <button type="button" onClick={() => setIsResetModalOpen(true)} className="text-xs text-sky-600 dark:text-sky-400 hover:text-sky-700 transition-colors">{t.forgot}</button>
              </div>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 dark:text-neutral-500 group-focus-within:text-sky-600 transition-colors" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-white/15 bg-slate-50 dark:bg-white/5 py-3 pl-10 pr-11 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none transition-all"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  aria-label={showPassword ? (lang === 'fr' ? 'Masquer le mot de passe' : 'Hide password') : (lang === 'fr' ? 'Afficher le mot de passe' : 'Show password')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-neutral-500 hover:text-sky-700 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* BOUTON SE CONNECTER (BLEU) */}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 py-3.5 font-bold text-white transition-all hover:bg-sky-500 hover:shadow-lg hover:shadow-sky-500/25 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : t.submit}
              {!loading && <ArrowRight className="h-5 w-5" />}
            </button>
          </form>

          <div className="mt-8 text-center border-t border-slate-200 dark:border-white/10 pt-6">
            <p className="text-slate-500 dark:text-neutral-400 text-sm">
              {t.no_account}{' '}
              {/* LIEN VERS LE PRICING */}
              <a href="/#pricing" className="font-bold text-sky-600 dark:text-sky-400 hover:text-sky-700 hover:underline transition-all">
                {t.signup}
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* MODAL MOT DE PASSE OUBLIÉ */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] p-8 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => { setIsResetModalOpen(false); setResetMessage(null); setResetEmail(''); }}
              className="absolute top-4 right-4 text-slate-400 dark:text-neutral-500 hover:text-slate-900 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t.forgot_title}</h3>
              <p className="text-slate-500 dark:text-neutral-400 text-sm">{t.forgot_subtitle}</p>
            </div>

            {resetMessage && (
              <div className={`mb-6 p-4 rounded-xl border flex items-start gap-3 ${resetMessage.type === 'success'
                ? 'bg-sky-500/10 border-sky-500/20 text-sky-700 dark:text-sky-400'
                : 'bg-red-500/10 border-red-500/20 text-red-600'
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
                <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-neutral-300">{t.email}</label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 dark:text-neutral-500 group-focus-within:text-sky-600 transition-colors" />
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-white/15 bg-slate-50 dark:bg-white/5 py-3 pl-10 pr-4 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none transition-all"
                    placeholder="votre@email.com"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={resetLoading || !resetEmail}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 py-3 font-bold text-white transition-all hover:bg-sky-500 hover:shadow-lg hover:shadow-sky-500/25 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resetLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : t.forgot_send}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}