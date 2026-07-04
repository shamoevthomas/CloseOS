import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import {
  ArrowLeft, ArrowRight, Check, Loader2, CheckCircle2, Sparkles, ShieldCheck, AlertCircle,
  User as UserIcon, Mail, Lock, Eye, EyeOff, Phone,
} from 'lucide-react';
import {
  createSignSetupIntent, registerSign, openSignBillingPortal, getSignSubscription, isSubActive,
  type SignBillingCycle, type SignSubscription,
} from '../lib/signSubscription';
import { signInSign, useSignOwner } from '../lib/signAuth';
import { SignLogo } from '../components/SignLogo';
import SignLangToggle from '../components/SignLangToggle';
import { useSignLang, signLocale, type SignLang } from '../contexts/SignLangContext';

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

const CYCLES: { key: SignBillingCycle; label: Record<SignLang, string>; perMonth: string; total: Record<SignLang, string>; badge?: string }[] = [
  { key: 'annual', label: { fr: 'Annuel', en: 'Yearly' }, perMonth: '9 €', total: { fr: '108 € / an', en: '€108 / year' }, badge: '−25 %' },
  { key: 'quarterly', label: { fr: 'Trimestriel', en: 'Quarterly' }, perMonth: '10 €', total: { fr: '30 € / trimestre', en: '€30 / quarter' }, badge: '−17 %' },
  { key: 'monthly', label: { fr: 'Mensuel', en: 'Monthly' }, perMonth: '12 €', total: { fr: 'sans engagement', en: 'no commitment' } },
];

const CYCLE_LABEL: Record<string, Record<SignLang, string>> = {
  annual: { fr: 'Annuel', en: 'Yearly' },
  quarterly: { fr: 'Trimestriel', en: 'Quarterly' },
  monthly: { fr: 'Mensuel', en: 'Monthly' },
};

const FEATURES: Record<SignLang, string>[] = [
  { fr: 'Signatures électroniques illimitées', en: 'Unlimited electronic signatures' },
  { fr: 'Sign + Pay : encaissez vos paiements via Stripe', en: 'Sign + Pay: collect payments via Stripe' },
  { fr: 'Multi-signataire (parallèle ou séquentiel)', en: 'Multi-signer (parallel or sequential)' },
  { fr: 'Vérification d’identité email & SMS', en: 'Email & SMS identity verification' },
  { fr: 'Faisceau de preuves + certificat + vérification publique', en: 'Evidence bundle + proof certificate + public verification' },
  { fr: 'Modèles, import PDF, éditeur glisser-déposer', en: 'Templates, PDF import, drag-and-drop editor' },
  { fr: 'Relances automatiques & personnalisation', en: 'Automatic reminders & customization' },
  { fr: 'Double authentification & sécurité du compte', en: 'Two-factor authentication & account security' },
  { fr: 'Conforme RGPD — conservation 5 ans + legal hold', en: 'GDPR compliant — 5-year retention + legal hold' },
];

const fmtDate = (iso: string | null, lang: SignLang) =>
  iso ? new Date(iso).toLocaleDateString(signLocale(lang), { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

const errMsg = (e: string | undefined, lang: SignLang) =>
  e === 'email_taken'
    ? (lang === 'fr' ? 'Un compte existe déjà avec cet email — connectez-vous.' : 'An account already exists with this email — please sign in.')
    : e === 'email_other_account'
      ? (lang === 'fr' ? 'Cet email a déjà un compte CloseOS (Business/Sales). Connectez-vous avec.' : 'This email already has a CloseOS account (Business/Sales). Sign in with it.')
      : e === 'card_not_confirmed'
        ? (lang === 'fr' ? 'Le paiement n’a pas été confirmé. Réessayez.' : 'The payment was not confirmed. Please try again.')
        : (lang === 'fr' ? 'Une erreur est survenue. Réessayez.' : 'An error occurred. Please try again.');

const inputCls =
  'w-full rounded border border-[#3A4242] bg-[#191E1E] py-3 pl-10 pr-4 text-sm text-white outline-none transition-all placeholder:text-[#A1A9A9]/40 focus:border-[#CEFF8F] focus:ring-1 focus:ring-[#CEFF8F]';

// Indice de force du mot de passe (même logique que l'inscription Business) — score 0..4.
function getPasswordStrength(pw: string): number {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}
function PasswordStrengthBar({ strength }: { strength: number }) {
  const { lang } = useSignLang();
  const labels = lang === 'fr'
    ? ['Faible', 'Faible', 'Moyen', 'Bon', 'Fort']
    : ['Weak', 'Weak', 'Medium', 'Good', 'Strong'];
  const colors = ['#ef6b6b', '#ef6b6b', '#F0B86E', '#CEFF8F', '#CEFF8F'];
  const c = colors[strength];
  return (
    <div className="mt-2">
      <div className="mb-1 flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-1 flex-1 rounded-full transition-colors" style={{ background: i < strength ? c : '#3A4242' }} />
        ))}
      </div>
      <p className="text-xs" style={{ color: c }}>{lang === 'fr' ? 'Sécurité du mot de passe : ' : 'Password strength: '}{labels[strength]}</p>
    </div>
  );
}

export default function SignCheckout() {
  const navigate = useNavigate();
  const { lang } = useSignLang();
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

      <header className="relative z-10 flex items-center justify-between px-4 py-5 sm:px-6 md:px-10">
        <a href="/sign" className="flex items-center">
          <SignLogo className="text-base" />
        </a>
        <div className="flex items-center gap-3">
          <SignLangToggle className="inline-flex items-center gap-1.5 rounded-lg border border-[#3A4242] px-2.5 py-2 text-xs font-bold uppercase tracking-wider text-[#A1A9A9] transition-colors hover:text-[#CEFF8F]" />
          <a href={owner ? '/sign/app' : '/sign/login'} className="flex items-center gap-1.5 text-sm text-[#A1A9A9] transition-colors hover:text-white">
            <ArrowLeft className="h-4 w-4" /> {owner ? (lang === 'fr' ? 'Mon espace' : 'My workspace') : (lang === 'fr' ? 'Se connecter' : 'Sign in')}
          </a>
        </div>
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
              {lang === 'fr' ? 'Déjà un compte ? ' : 'Already have an account? '}<a href="/sign/login" className="font-semibold text-[#CEFF8F] hover:underline">{lang === 'fr' ? 'Se connecter' : 'Sign in'}</a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function PlanHeader() {
  const { lang } = useSignLang();
  return (
    <div className="mb-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-white">{lang === 'fr' ? 'Activez CloseOS Sign' : 'Activate CloseOS Sign'}</h1>
      <p className="mt-2 text-sm text-[#A1A9A9]">{lang === 'fr' ? 'Toutes les fonctionnalités, dès 9 €/mois. 14 jours d’essai — sans engagement, annulable à tout moment.' : 'All features, from €9/month. 14-day trial — no commitment, cancel anytime.'}</p>
    </div>
  );
}

// ─── Formulaire de paiement (dans <Elements>) ───
function CheckoutForm({ navigate }: { navigate: (p: string, o?: any) => void }) {
  const { lang } = useSignLang();
  const stripe = useStripe();
  const elements = useElements();
  const [params] = useSearchParams();

  const [cycle, setCycle] = useState<SignBillingCycle>('annual');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [phone, setPhone] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState('');
  const [error, setError] = useState<string | null>(null);

  const current = CYCLES.find((c) => c.key === cycle)!;

  const complete = async (siId: string, d: { name: string; email: string; phone: string; password: string; cycle: SignBillingCycle }) => {
    setStep(lang === 'fr' ? 'Création de votre compte…' : 'Creating your account…');
    const r = await registerSign({ setup_intent_id: siId, cycle: d.cycle, email: d.email, name: d.name, phone: d.phone, password: d.password });
    if (!r.ok) { setError(errMsg(r.error, lang)); setSubmitting(false); setStep(''); return; }
    setStep(lang === 'fr' ? 'Connexion…' : 'Signing in…');
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
      else { setSubmitting(false); setError(lang === 'fr' ? 'Le paiement n’a pas été confirmé.' : 'The payment was not confirmed.'); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stripe]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    if (!name.trim() || !email.trim() || !phone.trim() || password.length < 8) { setError(lang === 'fr' ? 'Remplissez tous les champs (mot de passe ≥ 8 caractères).' : 'Fill in all fields (password ≥ 8 characters).'); return; }
    if (password !== confirm) { setError(lang === 'fr' ? 'Les mots de passe ne correspondent pas.' : 'Passwords do not match.'); return; }

    setSubmitting(true);
    setError(null);
    setStep(lang === 'fr' ? 'Validation de la carte…' : 'Validating card…');
    sessionStorage.setItem('closeos_sign_checkout', JSON.stringify({ name, email, phone, password, cycle }));

    const { error: serr, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: 'if_required',
      confirmParams: { return_url: `${window.location.origin}/sign/abonnement?setup_return=true` },
    });
    if (serr) { setError(serr.message || (lang === 'fr' ? 'Carte refusée.' : 'Card declined.')); setSubmitting(false); setStep(''); return; }
    if (!setupIntent || setupIntent.status !== 'succeeded') return; // redirection 3DS en cours
    await complete(setupIntent.id, { name, email, phone, password, cycle });
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
            className={`relative flex-1 whitespace-nowrap rounded-full px-1.5 py-1.5 text-[11px] font-bold transition-colors sm:px-3 sm:text-xs ${cycle === c.key ? 'bg-[#CEFF8F] text-[#191E1E]' : 'text-[#A1A9A9] hover:text-white'}`}
          >
            {c.label[lang]}
            {c.badge && cycle !== c.key && <span className="ml-1 text-[9px] text-[#CEFF8F]">{c.badge}</span>}
          </button>
        ))}
      </div>

      {/* Prix */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">{lang === 'fr' ? 'CloseOS Sign — toutes features' : 'CloseOS Sign — all features'}</div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-4xl font-semibold text-white">{current.perMonth}</span>
            <span className="text-sm text-[#A1A9A9]">{lang === 'fr' ? '/ mois' : '/ month'}</span>
          </div>
          <div className="mt-1 text-xs text-[#A1A9A9]">{current.total[lang]}</div>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-[#CEFF8F]/10 px-3 py-1 text-xs font-semibold text-[#CEFF8F]">
          <Sparkles className="h-3.5 w-3.5" /> {lang === 'fr' ? '14 jours offerts' : '14 days free'}
        </div>
      </div>

      {/* Features */}
      <ul className="mb-6 space-y-2 border-y border-[#3A4242] py-5">
        {FEATURES.map((f) => (
          <li key={f.fr} className="flex items-start gap-2.5 text-sm text-[#F3F4F6]">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#CEFF8F]" /> {f[lang]}
          </li>
        ))}
      </ul>

      {/* Compte */}
      <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">{lang === 'fr' ? 'Créer mon compte' : 'Create my account'}</p>
      <div className="space-y-3">
        <div className="relative">
          <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
          <input value={name} onChange={(e) => { setName(e.target.value); setError(null); }} placeholder={lang === 'fr' ? 'Nom complet' : 'Full name'} autoComplete="name" className={inputCls} disabled={submitting} />
        </div>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
          <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }} placeholder={lang === 'fr' ? 'vous@exemple.fr' : 'you@example.com'} autoComplete="email" className={inputCls} disabled={submitting} />
        </div>
        <div className="relative">
          <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
          <input type="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setError(null); }} placeholder={lang === 'fr' ? 'Téléphone' : 'Phone'} autoComplete="tel" className={inputCls} disabled={submitting} />
        </div>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
          <input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => { setPassword(e.target.value); setError(null); }} placeholder={lang === 'fr' ? 'Mot de passe (min. 8)' : 'Password (min. 8)'} autoComplete="new-password" className={`${inputCls} pr-10`} disabled={submitting} />
          <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A1A9A9] hover:text-[#F3F4F6]">
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {password && <PasswordStrengthBar strength={getPasswordStrength(password)} />}
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
          <input type={showPw ? 'text' : 'password'} value={confirm} onChange={(e) => { setConfirm(e.target.value); setError(null); }} placeholder={lang === 'fr' ? 'Confirmer le mot de passe' : 'Confirm password'} autoComplete="new-password" className={inputCls} disabled={submitting} />
        </div>
      </div>

      {/* Carte */}
      <p className="mb-3 mt-6 text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">{lang === 'fr' ? 'Carte bancaire (requise pour l’essai)' : 'Payment card (required for the trial)'}</p>
      <div className="rounded-lg border border-[#3A4242] bg-[#191E1E] p-4">
        <PaymentElement options={{ layout: 'tabs', wallets: { applePay: 'auto', googlePay: 'auto' } }} />
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
        {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> {step || (lang === 'fr' ? 'Traitement…' : 'Processing…')}</> : <>{lang === 'fr' ? 'Démarrer l’essai gratuit' : 'Start free trial'} <ArrowRight className="h-4 w-4" /></>}
      </button>
      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[10px] text-[#A1A9A9]">
        <ShieldCheck className="h-3 w-3 text-[#CEFF8F]" /> {lang === 'fr'
          ? <>Paiement sécurisé par Stripe · 1<sup>er</sup> prélèvement après 14 jours · annulable à tout moment</>
          : <>Secure payment via Stripe · first charge after 14 days · cancel anytime</>}
      </p>
    </form>
  );
}

// ─── État pour un propriétaire déjà connecté ───
function OwnerState({ sub, navigate }: { sub: SignSubscription | null; navigate: (p: string, o?: any) => void }) {
  const { lang } = useSignLang();
  const [busy, setBusy] = useState(false);

  if (sub?.exempt) {
    return (
      <Card icon={<CheckCircle2 className="h-6 w-6 text-[#CEFF8F]" />} title={lang === 'fr' ? 'Inclus avec CloseOS Business' : 'Included with CloseOS Business'}>
        <p className="text-sm text-[#A1A9A9]">{lang === 'fr' ? 'CloseOS Sign est inclus dans votre abonnement Business — vous avez accès à tout, sans frais supplémentaires.' : 'CloseOS Sign is included in your Business subscription — you have access to everything, at no extra cost.'}</p>
        <button onClick={() => navigate('/sign/app')} className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#CEFF8F] py-3 text-sm font-bold text-[#191E1E] hover:bg-[#A0E7EC]">
          {lang === 'fr' ? 'Accéder à mon espace' : 'Go to my workspace'} <ArrowRight className="h-4 w-4" />
        </button>
      </Card>
    );
  }

  if (isSubActive(sub?.status)) {
    return (
      <Card icon={<CheckCircle2 className="h-6 w-6 text-[#CEFF8F]" />} title={sub?.status === 'trialing' ? (lang === 'fr' ? 'Essai en cours' : 'Trial in progress') : (lang === 'fr' ? 'Abonnement actif' : 'Active subscription')}>
        <div className="space-y-px overflow-hidden rounded-xl border border-[#3A4242]">
          <Row label={lang === 'fr' ? 'Cycle' : 'Billing cycle'} value={CYCLE_LABEL[sub?.cycle || '']?.[lang] || '—'} />
          <Row label={sub?.status === 'trialing' ? (lang === 'fr' ? 'Fin de l’essai' : 'Trial ends') : (lang === 'fr' ? 'Renouvellement' : 'Renewal')} value={fmtDate(sub?.currentPeriodEnd ?? null, lang)} />
        </div>
        <button onClick={() => navigate('/sign/app')} className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#CEFF8F] py-3 text-sm font-bold text-[#191E1E] hover:bg-[#A0E7EC]">
          {lang === 'fr' ? 'Accéder à mon espace' : 'Go to my workspace'} <ArrowRight className="h-4 w-4" />
        </button>
      </Card>
    );
  }

  // Abonnement expiré / annulé → réactiver via portail
  return (
    <Card icon={<AlertCircle className="h-6 w-6 text-[#F0B86E]" />} title={lang === 'fr' ? 'Abonnement inactif' : 'Subscription inactive'}>
      <p className="text-sm text-[#A1A9A9]">{lang === 'fr' ? 'Votre abonnement n’est plus actif. Réglez votre paiement pour rouvrir l’accès à votre espace.' : 'Your subscription is no longer active. Settle your payment to reopen access to your workspace.'}</p>
      <button
        onClick={async () => { setBusy(true); const { error } = await openSignBillingPortal(); if (error) setBusy(false); }}
        disabled={busy}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#CEFF8F] py-3 text-sm font-bold text-[#191E1E] hover:bg-[#A0E7EC] disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{lang === 'fr' ? 'Régler mon abonnement' : 'Settle my subscription'} <ArrowRight className="h-4 w-4" /></>}
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
