import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Loader2, Check, AlertCircle, KeyRound } from 'lucide-react';
import { useBusinessAuth } from '../contexts/BusinessAuthContext';
import { supabase } from '../../lib/supabase';
import BusinessVerification, { getDeviceFingerprint } from './BusinessVerification';

export default function BusinessLogin() {
  const navigate = useNavigate();
  const { login, user, loading: authLoading, businessProfile, isTeamMember, refreshProfile, needsVerification } = useBusinessAuth();

  useEffect(() => {
    if (!authLoading && user && !needsVerification) {
      if (businessProfile || isTeamMember) {
        navigate('/business/dashboard', { replace: true });
      }
    }
  }, [user, authLoading, businessProfile, isTeamMember, navigate, needsVerification]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pendingVerification, setPendingVerification] = useState<{ userId: string; email: string; authMethod: 'google' | 'classic' } | null>(null);

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

  const checkDeviceToken = async (userId: string): Promise<boolean> => {
    const token = localStorage.getItem('closeos_device_token');
    const fingerprint = getDeviceFingerprint();
    if (!token) return false;
    try {
      const res = await fetch('/api/business-check-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, device_fingerprint: fingerprint, token })
      });
      const data = await res.json();
      return !!data.verified;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Allow pseudo login: "TEKA" → teka@closeos.local
    const loginEmail = email.includes('@') ? email : `${email.toLowerCase()}@closeos.local`;

    try {
      const result = await login({ email: loginEmail, password });
      if (result?.error) {
        setError(result.error.message || "Email ou mot de passe incorrect");
        setLoading(false);
      } else {
        const userId = result.data?.user?.id;
        const userEmail = result.data?.user?.email || email;
        if (userId) {
          // Skip device verification for local dev account
          const isLocalDev = userEmail === 'teka@closeos.local';
          const deviceOk = isLocalDev || await checkDeviceToken(userId);
          if (deviceOk) {
            await refreshProfile();
            navigate('/business/dashboard');
          } else {
            setPendingVerification({ userId, email: userEmail, authMethod: 'classic' });
            setLoading(false);
          }
        } else {
          await refreshProfile();
          navigate('/business/dashboard');
        }
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

  if (pendingVerification) {
    return (
      <BusinessVerification
        userId={pendingVerification.userId}
        email={pendingVerification.email}
        authMethod={pendingVerification.authMethod}
        onVerified={async () => {
          await refreshProfile();
          navigate('/business/dashboard');
        }}
        onCancel={async () => {
          setPendingVerification(null);
          await supabase.auth.signOut();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-[#f5f3f0] dark:bg-neutral-900" style={{ fontFamily: "'Manrope', system-ui, sans-serif" }}>
      {/* Ambient background blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-emerald-400/10 blur-[120px]" />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full bg-amber-300/10 blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-stone-300/10 blur-[120px]" />
      </div>

      {/* Glass morphism card */}
      <div className="w-full max-w-md mx-4 bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-xl shadow-[0_20px_40px_rgba(27,28,27,0.04)] border border-stone-200/20 dark:border-neutral-800 p-10">
        {/* Brand header */}
        <div className="flex items-center justify-center gap-2.5 mb-10">
          <div className="w-8 h-8 bg-stone-900 dark:bg-white rounded-lg flex items-center justify-center">
            <span className="text-white dark:text-black text-xs font-extrabold">C</span>
          </div>
          <span className="font-extrabold text-stone-900 dark:text-white text-lg tracking-tight" style={{ fontFamily: "'Manrope', system-ui, sans-serif" }}>
            CloseOS Business
          </span>
        </div>

        {/* Headline */}
        <div className="text-center mb-9">
          <h1 className="text-4xl font-extrabold tracking-tight text-stone-900 dark:text-white" style={{ fontFamily: "'Manrope', system-ui, sans-serif" }}>
            Se connecter
          </h1>
          <p className="text-stone-500 dark:text-neutral-400 mt-3 text-sm">
            Gérez vos campagnes et actifs avec CloseOS Business.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 flex items-center gap-2.5 p-3.5 bg-red-50/60 border border-red-200/30 rounded-xl text-red-600 text-xs font-medium">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email */}
          <div className="space-y-2">
            <label className="block text-[0.75rem] font-semibold uppercase tracking-widest text-stone-500 dark:text-neutral-400 ml-1" htmlFor="login-email">
              Adresse Email
            </label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400 group-focus-within:text-emerald-600 transition-colors" />
              <input
                id="login-email"
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-stone-100/50 dark:bg-neutral-800 border-none rounded-full py-4 pl-12 pr-4 text-sm text-stone-900 dark:text-white focus:ring-2 focus:ring-emerald-600/20 transition-all placeholder:text-stone-400 dark:placeholder:text-neutral-500 outline-none"
                placeholder="Pseudo ou email"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <div className="flex justify-between items-center ml-1">
              <label className="block text-[0.75rem] font-semibold uppercase tracking-widest text-stone-500 dark:text-neutral-400" htmlFor="login-password">
                Mot de passe
              </label>
              <button type="button" onClick={() => setIsResetModalOpen(true)} className="text-xs font-semibold text-emerald-700 hover:underline transition-colors">
                Oublié ?
              </button>
            </div>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400 group-focus-within:text-emerald-600 transition-colors" />
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-stone-100/50 dark:bg-neutral-800 border-none rounded-full py-4 pl-12 pr-4 text-sm text-stone-900 dark:text-white focus:ring-2 focus:ring-emerald-600/20 transition-all placeholder:text-stone-400 dark:placeholder:text-neutral-500 outline-none"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-stone-900 dark:bg-white dark:text-black text-white font-bold py-5 rounded-full shadow-lg hover:shadow-xl active:scale-95 transition-all duration-200 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Se connecter'}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-stone-200/40 dark:border-neutral-700" />
          </div>
          <div className="relative flex justify-center">
            <span className="px-4 bg-white/70 dark:bg-transparent text-[0.65rem] font-semibold tracking-widest uppercase text-stone-400 dark:text-neutral-500">
              Ou continuer avec
            </span>
          </div>
        </div>

        {/* Google Auth */}
        <button
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-white dark:bg-neutral-800 border border-stone-200/20 dark:border-neutral-700 rounded-full hover:bg-stone-50 dark:hover:bg-neutral-700 active:scale-95 transition-all duration-200 disabled:opacity-50"
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
          <span className="text-sm font-semibold text-stone-700 dark:text-neutral-200">Continuer avec Google</span>
        </button>

        {/* Bottom link */}
        <div className="mt-9 pt-7 border-t border-stone-200/20 dark:border-neutral-800 text-center">
          <p className="text-sm text-stone-500 dark:text-neutral-400">
            Vous n'avez pas de compte ?{' '}
            <Link to="/business/register" className="font-bold text-stone-900 dark:text-white ml-1 hover:underline transition-all">
              Cr&eacute;er un compte
            </Link>
          </p>
        </div>
      </div>

      {/* Bottom footer */}
      <div className="mt-8 flex flex-col items-center gap-3 pb-8">
        <div className="flex gap-6 text-xs font-medium text-stone-400 dark:text-neutral-500">
          <a className="hover:text-emerald-700 transition-colors" href="#">Aide</a>
          <a className="hover:text-emerald-700 transition-colors" href="#">Confidentialit&eacute;</a>
          <a className="hover:text-emerald-700 transition-colors" href="#">CGV</a>
        </div>
        <div className="text-[0.65rem] text-stone-400/60 tracking-widest uppercase font-semibold">
          &copy; {new Date().getFullYear()} CloseOS Business. Tous droits r&eacute;serv&eacute;s.
        </div>
      </div>

      {/* Password Reset Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/20 backdrop-blur-md" onClick={() => { setIsResetModalOpen(false); setResetMessage(null); setResetEmail(''); }} />
          <div className="relative w-full max-w-sm bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-xl shadow-[0_20px_40px_rgba(27,28,27,0.04)] border border-stone-200/20 dark:border-neutral-800 p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-stone-100/80 dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-6">
                <KeyRound className="h-7 w-7 text-stone-900 dark:text-white" />
              </div>
              <h3 className="text-2xl font-extrabold tracking-tight text-stone-900 dark:text-white mb-2" style={{ fontFamily: "'Manrope', system-ui, sans-serif" }}>
                R&eacute;initialisation
              </h3>
              <p className="text-sm text-stone-500 dark:text-neutral-400 mb-7">
                Entrez votre email pour recevoir un lien de r&eacute;cup&eacute;ration.
              </p>

              {resetMessage && (
                <div className={`mb-6 p-4 rounded-xl border flex items-start gap-3 text-left ${resetMessage.type === 'success'
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
                <div>
                  <label className="block text-[0.75rem] font-semibold uppercase tracking-widest text-stone-500 dark:text-neutral-400 ml-1 mb-2 text-left" htmlFor="reset-email">
                    Email
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full bg-stone-100/50 dark:bg-neutral-800 border-none rounded-full py-4 px-5 text-sm text-stone-900 dark:text-white focus:ring-2 focus:ring-emerald-600/20 outline-none placeholder:text-stone-400"
                    placeholder="Votre email"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={resetLoading || !resetEmail}
                  className="w-full bg-stone-900 dark:bg-white dark:text-black text-white font-bold py-5 rounded-full shadow-lg active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resetLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Envoyer le lien'}
                </button>
                <button
                  type="button"
                  onClick={() => { setIsResetModalOpen(false); setResetMessage(null); setResetEmail(''); }}
                  className="text-xs font-bold text-stone-500 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white transition-colors mt-2"
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
