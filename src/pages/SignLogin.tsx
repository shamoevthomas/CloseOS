import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, Mail, ShieldCheck, AlertCircle, Loader2, CheckCircle2, KeyRound, FileSignature, Banknote, Eye, EyeOff } from 'lucide-react';
import {
  signInSign,
  signInWithGoogle,
  completeOAuthRedirect,
  consumeRecoveryLink,
  sendPasswordReset,
  updatePassword,
  signOutSign,
  useSignOwner,
} from '../lib/signAuth';
import { isDeviceTrusted } from '../lib/signDevice';
import SignVerification from '../components/SignVerification';

/**
 * CloseOS Sign — page de connexion (DA Sign : dark + lime).
 * Vraie auth Supabase via le client dédié `signSupabase` :
 *  - email + mot de passe ;
 *  - Google (OAuth PKCE, retour traité ici) ;
 *  - mot de passe oublié + définition d'un nouveau mot de passe (lien de récupération).
 * L'accès est réservé aux comptes ayant une ligne `sign_users` (inclus avec un compte CloseOS Business).
 */

type ErrKey = 'creds' | 'no-access' | 'oauth' | 'reset-no-email' | 'reset' | 'weak';
const ERR: Record<ErrKey, string> = {
  creds: 'Identifiant ou mot de passe incorrect.',
  'no-access': "Ce compte n'a pas accès à CloseOS Sign — l'accès est inclus avec un compte CloseOS Business.",
  oauth: 'La connexion Google a échoué. Réessayez.',
  'reset-no-email': 'Entrez d’abord votre email, puis cliquez sur « Mot de passe oublié ».',
  reset: 'Échec — le lien a peut-être expiré. Redemandez-en un.',
  weak: 'Le mot de passe doit faire au moins 6 caractères.',
};

const Logo = ({ className = '' }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor" />
    <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const GoogleIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" className={className} aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const inputCls =
  'w-full rounded border border-[#3A4242] bg-[#191E1E] py-3 pl-10 pr-4 text-sm text-white outline-none transition-all placeholder:text-[#A1A9A9]/40 focus:border-[#CEFF8F] focus:ring-1 focus:ring-[#CEFF8F]';

export default function SignLogin() {
  const navigate = useNavigate();
  const { owner } = useSignOwner();

  const [phase, setPhase] = useState<'init' | 'login' | 'recovery'>('init');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<ErrKey | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [pendingVerif, setPendingVerif] = useState<{ userId: string; email: string; authMethod: 'google' | 'classic' } | null>(null);
  const gatingRef = useRef(false);

  useEffect(() => {
    document.title = 'Connexion | CloseOS Sign';
  }, []);

  // Traite le retour OAuth / le lien de récupération une seule fois.
  const ranRef = useRef(false);
  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    (async () => {
      if (await consumeRecoveryLink()) {
        setPhase('recovery');
        return;
      }
      const r = await completeOAuthRedirect();
      if (r.handled && r.ok && r.userId) {
        gatingRef.current = true;
        if (await isDeviceTrusted(r.userId)) {
          navigate('/sign/app', { replace: true });
          return;
        }
        setPendingVerif({ userId: r.userId, email: r.email || '', authMethod: 'google' });
        setPhase('login');
        return;
      }
      if (r.handled && !r.ok) setError(r.error === 'not_sign_owner' ? 'no-access' : 'oauth');
      setPhase('login');
    })();
  }, [navigate]);

  // Déjà connecté (propriétaire Sign) → vers l'app. Pas pendant 'init'/'recovery',
  // ni pendant une connexion explicite qui doit passer par la vérification d'appareil.
  useEffect(() => {
    if (owner && phase === 'login' && !pendingVerif && !gatingRef.current) navigate('/sign/app', { replace: true });
  }, [owner, phase, pendingVerif, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResetSent(false);
    setSubmitting(true);
    gatingRef.current = true;
    const r = await signInSign(email, password);
    if (!r.ok || !r.userId) {
      gatingRef.current = false;
      setSubmitting(false);
      setError(r.error === 'not_sign_owner' ? 'no-access' : 'creds');
      return;
    }
    const trusted = await isDeviceTrusted(r.userId);
    setSubmitting(false);
    if (trusted) navigate('/sign/app', { replace: true });
    else setPendingVerif({ userId: r.userId, email: r.email || email, authMethod: 'classic' });
  };

  const handleGoogle = async () => {
    setError(null);
    setResetSent(false);
    setGoogleLoading(true);
    const { error: oerr } = await signInWithGoogle();
    if (oerr) {
      setGoogleLoading(false);
      setError('oauth');
    }
    // Sinon : redirection navigateur vers Google en cours.
  };

  const handleForgot = async () => {
    if (!email.trim()) {
      setError('reset-no-email');
      return;
    }
    setError(null);
    const { ok } = await sendPasswordReset(email);
    if (ok) setResetSent(true);
    else setError('reset');
  };

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('weak');
      return;
    }
    setError(null);
    setSubmitting(true);
    const r = await updatePassword(newPassword);
    setSubmitting(false);
    if (r.ok) navigate('/sign/app', { replace: true });
    else setError(r.error === 'not_sign_owner' ? 'no-access' : 'reset');
  };

  // Vérification d'appareil (2FA) requise après une connexion réussie sur un nouvel appareil.
  if (pendingVerif) {
    return (
      <SignVerification
        userId={pendingVerif.userId}
        email={pendingVerif.email}
        authMethod={pendingVerif.authMethod}
        onVerified={() => navigate('/sign/app', { replace: true })}
        onCancel={async () => {
          await signOutSign();
          gatingRef.current = false;
          setPendingVerif(null);
        }}
      />
    );
  }

  return (
    <div className="sign-landing relative flex min-h-screen items-center justify-center overflow-hidden bg-[#191E1E] px-6 py-12 font-sans text-[#F3F4F6] antialiased selection:bg-[#CEFF8F] selection:text-[#191E1E]">
      <style>{`
        .sign-landing { font-family: "SF Pro Display","Helvetica Neue",Helvetica,Arial,Inter,sans-serif; }
        .sign-landing .bg-noise::before {
          content: ""; position: absolute; inset: 0; pointer-events: none; z-index: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
        }
      `}</style>

      {/* Fond structurel */}
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

        {/* Init : traitement du retour OAuth / récupération */}
        {phase === 'init' && (
          <div className="rounded border border-[#3A4242] bg-[#222828] p-10 text-center shadow-2xl">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#CEFF8F]" />
            <p className="mt-4 text-sm text-[#A1A9A9]">Connexion en cours…</p>
          </div>
        )}

        {/* Récupération : définir un nouveau mot de passe */}
        {phase === 'recovery' && (
          <div className="rounded border border-[#3A4242] bg-[#222828] p-8 shadow-2xl">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-[#3A4242] bg-[#191E1E]">
                <KeyRound className="h-5 w-5 text-[#CEFF8F]" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">Nouveau mot de passe</h1>
              <p className="mt-2 text-sm text-[#A1A9A9]">Choisissez un nouveau mot de passe pour votre compte.</p>
            </div>
            <form onSubmit={handleRecovery} className="space-y-4">
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">Nouveau mot de passe</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setError(null); }}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className={inputCls}
                  />
                </div>
              </div>
              {error && (
                <div className="flex items-center gap-2 rounded border border-[#ef6b6b]/30 bg-[#ef6b6b]/10 px-3 py-2 text-xs text-[#ef6b6b]">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {ERR[error]}
                </div>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="group flex w-full items-center justify-center gap-2 rounded bg-[#CEFF8F] py-3 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC] disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Mettre à jour et se connecter <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>}
              </button>
            </form>
          </div>
        )}

        {/* Connexion */}
        {phase === 'login' && (
          <>
            <div className="rounded border border-[#3A4242] bg-[#222828] p-8 shadow-2xl">
              <div className="mb-7 text-center">
                <h1 className="text-2xl font-semibold tracking-tight text-white">Connexion</h1>
                <p className="mt-2 text-sm text-[#A1A9A9]">Accédez à votre espace de signature.</p>
              </div>

              {/* Google */}
              <button
                type="button"
                onClick={handleGoogle}
                disabled={googleLoading}
                className="flex w-full items-center justify-center gap-3 rounded border border-[#3A4242] bg-white py-3 text-sm font-semibold text-[#191E1E] transition-colors hover:bg-[#A0E7EC] disabled:opacity-60"
              >
                {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><GoogleIcon /> Continuer avec Google</>}
              </button>

              {/* Séparateur */}
              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-[#3A4242]" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">ou</span>
                <div className="h-px flex-1 bg-[#3A4242]" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email */}
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">Email</label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(null); }}
                      placeholder="vous@exemple.fr"
                      autoComplete="email"
                      className={inputCls}
                    />
                  </div>
                </div>

                {/* Mot de passe */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">Mot de passe</label>
                    <button type="button" onClick={handleForgot} className="text-[11px] text-[#A1A9A9] transition-colors hover:text-[#CEFF8F]">
                      Mot de passe oublié ?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
                    <input
                      type={showPw ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(null); }}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="w-full rounded border border-[#3A4242] bg-[#191E1E] py-3 pl-10 pr-10 text-sm text-white outline-none transition-all placeholder:text-[#A1A9A9]/40 focus:border-[#CEFF8F] focus:ring-1 focus:ring-[#CEFF8F]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      aria-label={showPw ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A1A9A9] transition-colors hover:text-[#F3F4F6]"
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {resetSent && (
                  <div className="flex items-center gap-2 rounded border border-[#CEFF8F]/30 bg-[#CEFF8F]/10 px-3 py-2 text-xs text-[#CEFF8F]">
                    <CheckCircle2 className="h-4 w-4 shrink-0" /> Email de réinitialisation envoyé. Vérifiez votre boîte.
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-2 rounded border border-[#ef6b6b]/30 bg-[#ef6b6b]/10 px-3 py-2 text-xs leading-snug text-[#ef6b6b]">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {ERR[error]}
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

            {/* Note : accès réservé Business */}
            <p className="mt-5 text-center text-xs leading-relaxed text-[#A1A9A9]">
              Pas encore de compte ? L'accès à CloseOS Sign est <span className="text-[#F3F4F6]">inclus avec votre compte CloseOS Business</span> — connectez-vous avec vos identifiants Business.
            </p>

            {/* Trust + rappel produit */}
            <div className="mt-6 flex items-center justify-center gap-5 text-[10px] text-[#A1A9A9]">
              <span className="inline-flex items-center gap-1.5"><FileSignature className="h-3.5 w-3.5 text-[#CEFF8F]" /> Signature</span>
              <span className="inline-flex items-center gap-1.5"><Banknote className="h-3.5 w-3.5 text-[#CEFF8F]" /> Encaissement</span>
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[#CEFF8F]" /> RGPD</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
