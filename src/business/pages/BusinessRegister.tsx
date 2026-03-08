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
    <div className="relative flex min-h-screen items-center justify-center bg-[#FDF6EE] px-4 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-amber-400/10 opacity-30 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/business" className="inline-block">
            <img src="/logo.PNG" alt="CloseOS Business" className="h-12 w-auto mx-auto" />
          </Link>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-white p-8 shadow-2xl shadow-amber-900/5">
          <div className="mb-8 text-center">
            <h2 className="mb-3 text-2xl font-bold text-slate-900">Créer un compte Business</h2>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/20 bg-amber-50 text-xs font-bold text-amber-700 mb-4">
              Gérez votre équipe de closers
            </span>
            <p className="text-slate-500">Pilotez votre business comme un pro</p>
          </div>

          {error && (
            <div className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-200">
              {error}
            </div>
          )}

          <button
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="mb-6 flex w-full items-center justify-center gap-3 rounded-lg border border-slate-200 bg-slate-50 py-3 font-medium text-slate-700 transition-all hover:bg-slate-100 disabled:opacity-50"
          >
            {googleLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="h-5 w-5" alt="Google" />
            )}
            S'inscrire avec Google
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400">Ou avec email</span></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-600 text-left">Nom complet</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-slate-900 focus:border-amber-500 focus:outline-none"
                  placeholder="John Doe"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-600 text-left">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-slate-900 focus:border-amber-500 focus:outline-none"
                  placeholder="votre@email.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-600 text-left">Mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-slate-900 focus:border-amber-500 focus:outline-none"
                  placeholder="••••••••"
                  required
                  minLength={8}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 py-3 font-semibold text-white transition-all hover:bg-amber-500 shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Créer mon compte Business"}
              {!loading && <ArrowRight className="h-5 w-5" />}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-slate-500">
              Déjà inscrit ?{' '}
              <Link to="/business/login" className="font-semibold text-amber-600 hover:text-amber-500">Se connecter</Link>
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            En créant un compte, vous acceptez nos{' '}
            <Link to="/cgu" className="text-amber-600 hover:underline">CGU</Link>
            {' '}et notre{' '}
            <Link to="/confidentialite" className="text-amber-600 hover:underline">Politique de Confidentialité</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
