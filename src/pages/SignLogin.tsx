import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, Mail, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { signInSign, useSignOwner } from '../lib/signAuth';

/**
 * CloseOS Sign — page de connexion (DA Sign : dark + lime).
 * Vraie auth Supabase (email + mot de passe), client dédié au module Sign.
 */

const Logo = ({ className = '' }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor" />
    <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function SignLogin() {
  const navigate = useNavigate();
  const { owner } = useSignOwner();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = 'Connexion | CloseOS Sign';
  }, []);

  // Déjà connecté (propriétaire Sign) → vers l'app
  useEffect(() => {
    if (owner) navigate('/sign/app', { replace: true });
  }, [owner, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(false);
    setSubmitting(true);
    const r = await signInSign(email, password);
    setSubmitting(false);
    if (r.ok) navigate('/sign/app', { replace: true });
    else setError(true);
  };

  return (
    <div className="sign-landing relative flex min-h-screen items-center justify-center overflow-hidden bg-[#191E1E] px-6 font-sans text-[#F3F4F6] antialiased selection:bg-[#CEFF8F] selection:text-[#191E1E]">
      <style>{`
        .sign-landing { font-family: "SF Pro Display","Helvetica Neue",Helvetica,Arial,Inter,sans-serif; }
        .sign-landing .bg-noise::before {
          content: ""; position: absolute; inset: 0; pointer-events: none; z-index: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
        }
      `}</style>

      {/* Structural background lines */}
      <div className="bg-noise pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-full w-[1px] bg-[#3A4242]/40" />
      <div className="pointer-events-none absolute left-1/2 top-1/4 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-[#CEFF8F]/5 blur-[120px]" />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <a href="/sign" className="mb-8 flex items-center justify-center">
          <Logo className="text-[#CEFF8F]" />
          <span className="ml-2 text-lg font-semibold tracking-tight text-white">
            CloseOS <span className="font-normal text-[#A1A9A9]">| Sign</span>
          </span>
        </a>

        {/* Card */}
        <div className="rounded border border-[#3A4242] bg-[#222828] p-8 shadow-2xl">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-white">Connexion</h1>
            <p className="mt-2 text-sm text-[#A1A9A9]">Accédez à votre espace de signature.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(false); }}
                  placeholder="vous@exemple.fr"
                  autoComplete="email"
                  className="w-full rounded border border-[#3A4242] bg-[#191E1E] py-3 pl-10 pr-4 text-sm text-white outline-none transition-all placeholder:text-[#A1A9A9]/40 focus:border-[#CEFF8F] focus:ring-1 focus:ring-[#CEFF8F]"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(false); }}
                  placeholder="••••••"
                  autoComplete="current-password"
                  className="w-full rounded border border-[#3A4242] bg-[#191E1E] py-3 pl-10 pr-4 text-sm text-white outline-none transition-all placeholder:text-[#A1A9A9]/40 focus:border-[#CEFF8F] focus:ring-1 focus:ring-[#CEFF8F]"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" /> Identifiant ou mot de passe incorrect.
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="group flex w-full items-center justify-center gap-2 rounded bg-[#CEFF8F] py-3 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC] disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Se connecter <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>}
            </button>
          </form>
        </div>

        {/* Footer note */}
        <div className="mt-6 flex items-center justify-center gap-2 text-[10px] text-[#A1A9A9]">
          <ShieldCheck className="h-3.5 w-3.5 text-[#CEFF8F]" />
          <span>Connexion sécurisée — conformité RGPD</span>
        </div>
      </div>
    </div>
  );
}
