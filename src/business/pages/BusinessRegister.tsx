import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User as UserIcon, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { useBusinessAuth } from '../contexts/BusinessAuthContext';

export default function BusinessRegister() {
  const navigate = useNavigate();
  const { register, loginWithGoogle } = useBusinessAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await register({ email, password, full_name: name });

      if (result?.error) {
        setError(result.error.message);
        setLoading(false);
      } else {
        navigate('/business/dashboard');
      }
    } catch (err: any) {
      setError("Une erreur est survenue.");
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await loginWithGoogle();
      if (error) setError(error.message);
    } catch (err) {
      setError("Impossible de lancer la connexion Google.");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-stone-50 dark:bg-neutral-900 px-4 overflow-hidden">
      {/* Ambient background blobs */}
      <div className="absolute top-[-10%] left-[20%] w-[600px] h-[600px] bg-emerald-200/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] bg-stone-300/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 w-full max-w-md py-12">
        {/* Brand header */}
        <div className="mb-10 flex items-center justify-center gap-3">
          <Link to="/business" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-stone-900 dark:bg-white">
              <span className="text-lg font-black text-white dark:text-black font-['Manrope']">C</span>
            </div>
            <span className="text-xl font-extrabold text-stone-900 dark:text-white font-['Manrope'] tracking-tight">CloseOS Business</span>
          </Link>
        </div>

        {/* Glass card */}
        <div className="rounded-xl border border-stone-200/20 dark:border-neutral-800 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-10 shadow-[0_20px_40px_rgba(27,28,27,0.04)]">
          {/* Headline */}
          <div className="mb-10 text-center">
            <h2 className="text-4xl font-extrabold text-stone-900 dark:text-white font-['Manrope'] tracking-tight mb-3">
              Démarrez votre expansion
            </h2>
            <p className="text-stone-500 dark:text-neutral-400 text-base">Créez un compte et pilotez votre équipe de closers</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 rounded-xl bg-red-50/80 p-4 text-sm text-red-600 border border-red-200/40">
              {error}
            </div>
          )}

          {/* Google button */}
          <button
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="mb-8 flex w-full items-center justify-center gap-3 rounded-full border border-stone-200/20 dark:border-neutral-700 bg-white dark:bg-neutral-800 py-4 font-semibold text-stone-700 dark:text-neutral-200 font-['Manrope'] transition-all hover:shadow-md active:scale-95 disabled:opacity-50"
          >
            {googleLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="h-5 w-5" alt="Google" />
            )}
            S'inscrire avec Google
          </button>

          {/* Divider */}
          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-stone-200/40 dark:border-neutral-700"></div></div>
            <div className="relative flex justify-center">
              <span className="bg-white/70 dark:bg-transparent px-4 text-[0.65rem] font-semibold uppercase tracking-widest text-stone-400 dark:text-neutral-500">
                Ou continuer avec
              </span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-[0.75rem] font-semibold uppercase tracking-widest text-stone-500 dark:text-neutral-400 text-left">
                Nom complet
              </label>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-full bg-stone-100/50 dark:bg-neutral-800 border-none py-4 pl-12 pr-5 text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 transition-all"
                  placeholder="John Doe"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[0.75rem] font-semibold uppercase tracking-widest text-stone-500 dark:text-neutral-400 text-left">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-full bg-stone-100/50 dark:bg-neutral-800 border-none py-4 pl-12 pr-5 text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 transition-all"
                  placeholder="votre@email.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[0.75rem] font-semibold uppercase tracking-widest text-stone-500 dark:text-neutral-400 text-left">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-full bg-stone-100/50 dark:bg-neutral-800 border-none py-4 pl-12 pr-5 text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 transition-all"
                  placeholder="••••••••"
                  required
                  minLength={8}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 dark:bg-white dark:text-black py-5 font-bold text-white font-['Manrope'] shadow-lg transition-all hover:bg-stone-800 dark:hover:bg-neutral-200 active:scale-95 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Créer mon compte Business"}
              {!loading && <ArrowRight className="h-5 w-5" />}
            </button>
          </form>

          {/* Footer link */}
          <div className="mt-8 text-center">
            <p className="text-stone-500 dark:text-neutral-400">
              Vous avez déjà un compte ?{' '}
              <Link to="/business/login" className="font-semibold text-stone-900 dark:text-white hover:text-stone-700 dark:hover:text-neutral-200 transition-colors">
                Se connecter
              </Link>
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-stone-400 dark:text-neutral-500">
            En créant un compte, vous acceptez nos{' '}
            <Link to="/cgu" className="text-stone-600 dark:text-neutral-300 hover:underline">CGU</Link>
            {' '}et notre{' '}
            <Link to="/confidentialite" className="text-stone-600 dark:text-neutral-300 hover:underline">Politique de Confidentialité</Link>.
          </p>
        </div>

        {/* Bottom copyright */}
        <p className="mt-8 text-center text-xs text-stone-400 dark:text-neutral-500">
          &copy; {new Date().getFullYear()} CloseOS. Tous droits réservés.
        </p>
      </div>
    </div>
  );
}
