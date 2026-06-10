import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import {
  ArrowLeft, ArrowRight, Check, Loader2, CheckCircle2, Sparkles, ShieldCheck, AlertCircle,
  User as UserIcon, Mail, Lock, Eye, EyeOff,
} from 'lucide-react';
import {
  createSignSetupIntent, registerSign, openSignBillingPortal, getSignSubscription, isSubActive,
  type SignBillingCycle, type SignSubscription,
} from '../lib/signSubscription';
import { signInSign, useSignOwner } from '../lib/signAuth';

/**
 * CloseOS Sign — page de paiement (carte intégrée Stripe Elements, DA Sign).
 * Prospect : carte + création de compte + abonnement (essai 14 j, CB requise) → ouverture du compte.
 * Connecté : état d'abonnement (actif / inclus Business / réactiver via portail).
 */

const stripePromise = loadStripe(
  'pk_live_51SxnxC33xpuYLywqRhYvxhWrChlI3Ckjj1AfJLqRQJQwaXNyVLuLAPaURbnEcrKRAQJTneB3ZjhUHSHuFQ9Xekdt00k1ho4IEt',
);

const STRIPE_APPEARANCE = {
  theme: 'night' as const,
  variables: {
    colorPrimary: '#CEFF8F',
    colorBackground: '#191E1E',
    colorText: '#F3F4F6',
    colorTextSecondary: '#A1A9A9',
    borderRadius: '8px',
    fontFamily: 'inherit',
  },
};

const Logo = ({ className = '' }: { className?: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor" />
    <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CYCLES: { key: SignBillingCycle; label: string; perMonth: string; total: string; badge?: string }[] = [
  { key: 'annual', label: 'Annuel', perMonth: '9 €', total: '108 € / an', badge: '−25 %' },
  { key: 'quarterly', label: 'Trimestriel', perMonth: '10 €', total: '30 € / trimestre', badge: '−17 %' },
  { key: 'monthly', label: 'Mensuel', perMonth: '12 €', total: 'sans engagement' },
];

const CYCLE_LABEL: Record<string, string> = { annual: 'Annuel', quarterly: 'Trimestriel', monthly: 'Mensuel' };

const FEATURES = [
  'Signatures électroniques illimitées',
  'Sign + Pay : encaissez vos paiements via Stripe',
  'Multi-signataire (parallèle ou séquentiel)',
  'Vérification d’identité email & SMS',
  'Faisceau de preuves + certificat + vérification publique',
  'Modèles, import PDF, éditeur glisser-déposer',
  'Relances automatiques & personnalisation',
  'Double authentification & sécurité du compte',
  'Conforme RGPD — conservation 5 ans + legal hold',
];

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

const errMsg = (e?: string) =>
  e === 'email_taken'
    ? 'Un compte existe déjà avec cet email — connectez-vous.'
    : e === 'email_other_account'
      ? 'Cet email a déjà un compte CloseOS (Business/Sales). Connectez-vous avec.'
      : e === 'card_not_confirmed'
        ? 'Le paiement n’a pas été confirmé. Réessayez.'
        : 'Une erreur est survenue. Réessayez.';

const inputCls =
  'w-full rounded border border-[#3A4242] bg-[#191E1E] py-3 pl-10 pr-4 text-sm text-white outline-none transition-all placeholder:text-[#A1A9A9]/40 focus:border-[#CEFF8F] focus:ring-1 focus:ring-[#CEFF8F]';

export default function SignCheckout() {
  const navigate = useNavigate();
  const { loading: ownerLoading, owner } = useSignOwner();
  const [sub, setSub] = useState<SignSubscription | null>(null);
  const [subLoaded, setSubLoaded] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  // Charge l'abonnement si connecté.
  useEffect(() => {
    if (ownerLoading) return;
    if (!owner) { setSubLoaded(true); return; }
    getSignSubscription().then((s) => { setSub(s); setSubLoaded(true); });
  }, [ownerLoading, owner]);

  // Prépare le SetupIntent (carte) pour un prospect non connecté.
  useEffect(() => {
    if (ownerLoading || owner) return;
    createSignSetupIntent().then(({ clientSecret }) => { if (clientSecret) setClientSecret(clientSecret); });
  }, [ownerLoading, owner]);

  const loading = ownerLoading || !subLoaded;

  return (
    <div className="sign-landing relative min-h-screen bg-[#191E1E] font-sans text-[#F3F4F6] antialiased selection:bg-[#CEFF8F] selection:text-[#191E1E]">
      <style>{`.sign-landing { font-family: "SF Pro Display","Helvetica Neue",Helvetica,Arial,Inter,sans-serif; }`}</style>
      <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[680px] -translate-x-1/2 rounded-full bg-[#CEFF8F]/5 blur-[140px]" />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-10">
        <a href="/sign" className="flex items-center">
          <Logo className="text-[#CEFF8F]" />
          <span className="ml-2 text-base font-semibold tracking-tight text-white">CloseOS <span className="font-normal text-[#A1A9A9]">| Sign</span></span>
        </a>
        <a href={owner ? '/sign/app' : '/sign/login'} className="flex items-center gap-1.5 text-sm text-[#A1A9A9] transition-colors hover:text-white">
          <ArrowLeft className="h-4 w-4" /> {owner ? 'Mon espace' : 'Se connecter'}
        </a>
      </header>

      <div className="relative z-10 mx-auto max-w-xl px-5 pb-20 pt-4">
        {loading ? (
          <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-[#CEFF8F]" /></div>
        ) : owner ? (
          <OwnerState sub={sub} navigate={navigate} />
        ) : (
          /* Prospect : carte + création de compte */
          <>
            <PlanHeader />
            {clientSecret ? (
              <Elements stripe={stripePromise} options={{ clientSecret, appearance: STRIPE_APPEARANCE }}>
                <CheckoutForm navigate={navigate} />
              </Elements>
            ) : (
              <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#A1A9A9]" /></div>
            )}
            <p className="mt-6 text-center text-sm text-[#A1A9A9]">
              Déjà un compte ? <a href="/sign/login" className="font-semibold text-[#CEFF8F] hover:underline">Se connecter</a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function PlanHeader() {
  return (
    <div className="mb-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-white">Activez CloseOS Sign</h1>
      <p className="mt-2 text-sm text-[#A1A9A9]">Toutes les fonctionnalités, dès 9 €/mois. 14 jours d’essai — sans engagement, annulable à tout moment.</p>
    </div>
  );
}

// ─── Formulaire de paiement (dans <Elements>) ───
function CheckoutForm({ navigate }: { navigate: (p: string, o?: any) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [params] = useSearchParams();

  const [cycle, setCycle] = useState<SignBillingCycle>('annual');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState('');
  const [error, setError] = useState<string | null>(null);

  const current = CYCLES.find((c) => c.key === cycle)!;

  const complete = async (siId: string, d: { name: string; email: string; password: string; cycle: SignBillingCycle }) => {
    setStep('Création de votre compte…');
    const r = await registerSign({ setup_intent_id: siId, cycle: d.cycle, email: d.email, name: d.name, password: d.password });
    if (!r.ok) { setError(errMsg(r.error)); setSubmitting(false); setStep(''); return; }
    setStep('Connexion…');
    const login = await signInSign(d.email, d.password);
    sessionStorage.removeItem('closeos_sign_checkout');
    navigate(login.ok ? '/sign/app' : '/sign/login', { replace: true });
  };

  // Retour de redirection 3DS.
  useEffect(() => {
    const isReturn = params.get('setup_return') === 'true';
    const siSecret = params.get('setup_intent_client_secret');
    if (!isReturn || !siSecret || !stripe) return;
    const saved = sessionStorage.getItem('closeos_sign_checkout');
    if (!saved) return;
    const d = JSON.parse(saved);
    setSubmitting(true);
    stripe.retrieveSetupIntent(siSecret).then(({ setupIntent }) => {
      if (setupIntent?.status === 'succeeded') complete(setupIntent.id, d);
      else { setSubmitting(false); setError('Le paiement n’a pas été confirmé.'); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stripe]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    if (!name.trim() || !email.trim() || password.length < 6) { setError('Remplissez tous les champs (mot de passe ≥ 6 caractères).'); return; }
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return; }

    setSubmitting(true);
    setError(null);
    setStep('Validation de la carte…');
    sessionStorage.setItem('closeos_sign_checkout', JSON.stringify({ name, email, password, cycle }));

    const { error: serr, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: 'if_required',
      confirmParams: { return_url: `${window.location.origin}/sign/abonnement?setup_return=true` },
    });
    if (serr) { setError(serr.message || 'Carte refusée.'); setSubmitting(false); setStep(''); return; }
    if (!setupIntent || setupIntent.status !== 'succeeded') return; // redirection 3DS en cours
    await complete(setupIntent.id, { name, email, password, cycle });
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-[#3A4242] bg-[#222828] p-6 shadow-2xl sm:p-8">
      {/* Cycle */}
      <div className="mb-6 inline-flex w-full rounded-full border border-[#3A4242] bg-[#191E1E] p-1">
        {CYCLES.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setCycle(c.key)}
            className={`relative flex-1 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${cycle === c.key ? 'bg-[#CEFF8F] text-[#191E1E]' : 'text-[#A1A9A9] hover:text-white'}`}
          >
            {c.label}
            {c.badge && cycle !== c.key && <span className="ml-1 text-[9px] text-[#CEFF8F]">{c.badge}</span>}
          </button>
        ))}
      </div>

      {/* Prix */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">CloseOS Sign — toutes features</div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-4xl font-semibold text-white">{current.perMonth}</span>
            <span className="text-sm text-[#A1A9A9]">/ mois</span>
          </div>
          <div className="mt-1 text-xs text-[#A1A9A9]">{current.total}</div>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-[#CEFF8F]/10 px-3 py-1 text-xs font-semibold text-[#CEFF8F]">
          <Sparkles className="h-3.5 w-3.5" /> 14 jours offerts
        </div>
      </div>

      {/* Features */}
      <ul className="mb-6 space-y-2 border-y border-[#3A4242] py-5">
        {FEATURES.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm text-[#F3F4F6]">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#CEFF8F]" /> {f}
          </li>
        ))}
      </ul>

      {/* Compte */}
      <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">Créer mon compte</p>
      <div className="space-y-3">
        <div className="relative">
          <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
          <input value={name} onChange={(e) => { setName(e.target.value); setError(null); }} placeholder="Nom complet" autoComplete="name" className={inputCls} disabled={submitting} />
        </div>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
          <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }} placeholder="vous@exemple.fr" autoComplete="email" className={inputCls} disabled={submitting} />
        </div>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
          <input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => { setPassword(e.target.value); setError(null); }} placeholder="Mot de passe (min. 6)" autoComplete="new-password" className={`${inputCls} pr-10`} disabled={submitting} />
          <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A1A9A9] hover:text-[#F3F4F6]">
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
          <input type={showPw ? 'text' : 'password'} value={confirm} onChange={(e) => { setConfirm(e.target.value); setError(null); }} placeholder="Confirmer le mot de passe" autoComplete="new-password" className={inputCls} disabled={submitting} />
        </div>
      </div>

      {/* Carte */}
      <p className="mb-3 mt-6 text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">Carte bancaire (requise pour l’essai)</p>
      <div className="rounded-lg border border-[#3A4242] bg-[#191E1E] p-4">
        <PaymentElement options={{ layout: 'tabs' }} />
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded border border-[#ef6b6b]/30 bg-[#ef6b6b]/10 px-3 py-2 text-xs text-[#ef6b6b]">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !stripe}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#CEFF8F] py-3.5 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC] disabled:opacity-60"
      >
        {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> {step || 'Traitement…'}</> : <>Démarrer l’essai gratuit <ArrowRight className="h-4 w-4" /></>}
      </button>
      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[10px] text-[#A1A9A9]">
        <ShieldCheck className="h-3 w-3 text-[#CEFF8F]" /> Paiement sécurisé par Stripe · 1<sup>er</sup> prélèvement après 14 jours · annulable à tout moment
      </p>
    </form>
  );
}

// ─── État pour un propriétaire déjà connecté ───
function OwnerState({ sub, navigate }: { sub: SignSubscription | null; navigate: (p: string, o?: any) => void }) {
  const [busy, setBusy] = useState(false);

  if (sub?.exempt) {
    return (
      <Card icon={<CheckCircle2 className="h-6 w-6 text-[#CEFF8F]" />} title="Inclus avec CloseOS Business">
        <p className="text-sm text-[#A1A9A9]">CloseOS Sign est inclus dans votre abonnement Business — vous avez accès à tout, sans frais supplémentaires.</p>
        <button onClick={() => navigate('/sign/app')} className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#CEFF8F] py-3 text-sm font-bold text-[#191E1E] hover:bg-[#A0E7EC]">
          Accéder à mon espace <ArrowRight className="h-4 w-4" />
        </button>
      </Card>
    );
  }

  if (isSubActive(sub?.status)) {
    return (
      <Card icon={<CheckCircle2 className="h-6 w-6 text-[#CEFF8F]" />} title={sub?.status === 'trialing' ? 'Essai en cours' : 'Abonnement actif'}>
        <div className="space-y-px overflow-hidden rounded-xl border border-[#3A4242]">
          <Row label="Cycle" value={CYCLE_LABEL[sub?.cycle || ''] || '—'} />
          <Row label={sub?.status === 'trialing' ? 'Fin de l’essai' : 'Renouvellement'} value={fmtDate(sub?.currentPeriodEnd ?? null)} />
        </div>
        <button onClick={() => navigate('/sign/app')} className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#CEFF8F] py-3 text-sm font-bold text-[#191E1E] hover:bg-[#A0E7EC]">
          Accéder à mon espace <ArrowRight className="h-4 w-4" />
        </button>
      </Card>
    );
  }

  // Abonnement expiré / annulé → réactiver via portail
  return (
    <Card icon={<AlertCircle className="h-6 w-6 text-[#F0B86E]" />} title="Abonnement inactif">
      <p className="text-sm text-[#A1A9A9]">Votre abonnement n’est plus actif. Réglez votre paiement pour rouvrir l’accès à votre espace.</p>
      <button
        onClick={async () => { setBusy(true); const { error } = await openSignBillingPortal(); if (error) setBusy(false); }}
        disabled={busy}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#CEFF8F] py-3 text-sm font-bold text-[#191E1E] hover:bg-[#A0E7EC] disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Régler mon abonnement <ArrowRight className="h-4 w-4" /></>}
      </button>
    </Card>
  );
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#3A4242] bg-[#222828] p-8 shadow-2xl">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-[#CEFF8F]/30 bg-[#CEFF8F]/10">{icon}</div>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight text-white">{title}</h1>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between bg-[#191E1E] px-4 py-3">
      <span className="text-sm text-[#A1A9A9]">{label}</span>
      <span className="text-sm font-medium text-white">{value}</span>
    </div>
  );
}
