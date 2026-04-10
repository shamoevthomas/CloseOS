import { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { ArrowLeft, Loader2, Tag, Check, User, Mail, Lock, Sparkles, CreditCard, ChevronDown, Rocket, Phone } from 'lucide-react';
import { useBusinessAuth } from '../contexts/BusinessAuthContext';
import { supabase } from '../../lib/supabase';

const stripePromise = loadStripe('pk_live_51SxnxC33xpuYLywqRhYvxhWrChlI3Ckjj1AfJLqRQJQwaXNyVLuLAPaURbnEcrKRAQJTneB3ZjhUHSHuFQ9Xekdt00k1ho4IEt');

const PLAN_LABELS: Record<string, string> = {
  solo: 'Solo',
  business: 'Business',
  business_acquisition: 'Business + Acquisition',
};

const PLAN_PRICES: Record<string, Record<string, { monthly: number; display: string; total?: string }>> = {
  solo: {
    monthly:   { monthly: 39, display: '39€/mois' },
    quarterly: { monthly: 32, display: '32€/mois', total: '96€/trimestre' },
    annual:    { monthly: 28, display: '28€/mois', total: '336€/an' },
  },
  business: {
    monthly:   { monthly: 59, display: '59€/mois' },
    quarterly: { monthly: 48, display: '48€/mois', total: '144€/trimestre' },
    annual:    { monthly: 42, display: '42€/mois', total: '504€/an' },
  },
  business_acquisition: {
    monthly:   { monthly: 99, display: '99€/mois' },
    quarterly: { monthly: 81, display: '81€/mois', total: '243€/trimestre' },
    annual:    { monthly: 71, display: '71€/mois', total: '852€/an' },
  },
};

const EXTRAS = [
  { key: 'setup', name: 'Setup', price: 60, description: 'Configuration complete de l\'outil : campagnes, formules, pipeline, equipe, onboarding.' },
  { key: 'integration', name: 'Integration', price: 80, description: 'Integration technique sur votre site : iframe, embed, pop-up.' },
  { key: 'combo', name: 'Setup + Integration', price: 120, description: 'Les deux combines — economisez 20€.', isSaving: true },
];

const PLAN_FEATURES: Record<string, { features: string[]; subFeatures?: string[] }> = {
  solo: {
    features: [
      'CRM & Pipeline visuel',
      "Système d'acquisition complet (campagnes, embed/iframe, tracking UTM, KPIs par source)",
      "Cockpit d'appel plein écran (script, notes, offre, ressources)",
      'Enregistrement vidéo/audio des calls',
      'Agenda + sync Google Calendar',
      'Rendez-vous + booking links',
      'Rappels',
      'KPIs personnels',
      'Facturation',
      'Objectifs personnels',
      'Rapports',
    ],
  },
  business: {
    features: [
      "Tout ce que le Solo a, SAUF le système d'acquisition",
      'Gestion d\'équipe complète (6 rôles : Owner, Admin, HOS, Closer, Setter, Setter-Closer)',
      "Vue macro Owner en temps réel sur toute l'équipe",
      'Invitation des membres par lien magique (expiration 7j)',
      'Kanban partagé avec filtres avancés',
      'Objectifs assignables par membre',
      'Monday Morning Reporting automatique',
      "Factures de toute l'organisation",
      'KPIs par membre / par offre / global',
      'Rapport avec export PDF',
      'Gestion des disponibilités et absences par membre',
    ],
  },
  business_acquisition: {
    features: [
      'Tout ce que Business a',
      "Système d'acquisition complet en plus :",
    ],
    subFeatures: [
      'Création/gestion de campagnes (mode avec RDV ou inscription seule)',
      'Page de capture configurable (titre, vidéo, champs custom, redirection)',
      "Génération de code embed (iframe ou popup bloquant)",
      'Tracking UTM + formule par défaut',
      'KPIs acquisition : vues, leads, taux de conversion par campagne',
      'Graphiques : camembert (campagnes les plus converties), barres (CA par campagne)',
    ],
  },
};

const BILLING_OPTIONS = [
  { key: 'annual', label: 'Annuel' },
  { key: 'quarterly', label: 'Trimestriel' },
  { key: 'monthly', label: 'Mensuel' },
] as const;

const STRIPE_APPEARANCE = {
  theme: 'flat' as const,
  variables: {
    colorPrimary: '#059669',
    colorBackground: '#f5f5f4',
    borderRadius: '12px',
    fontFamily: 'Manrope, system-ui, sans-serif',
  },
};

// ─── Inner form component (needs useStripe/useElements inside <Elements>) ───────

function CheckoutForm({
  plan, billing, promoCode, promoResult, selectedExtras, trialDays, register, navigate,
}: {
  plan: string; billing: string; promoCode: string; promoResult: any;
  selectedExtras: Set<string>; trialDays: number;
  register: (creds: { email: string; password: string; full_name: string }) => Promise<any>;
  navigate: (path: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();

  const [paymentOpen, setPaymentOpen] = useState(true);
  const [paymentReady, setPaymentReady] = useState(false);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState('');

  // Handle 3DS redirect return
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const isReturn = searchParams.get('setup_return') === 'true';
    const siClientSecret = searchParams.get('setup_intent_client_secret');
    if (!isReturn || !siClientSecret || !stripe) return;

    // Restore form data from sessionStorage
    const saved = sessionStorage.getItem('closeos_checkout_state');
    if (saved) {
      const data = JSON.parse(saved);
      setRegName(data.regName || '');
      setRegEmail(data.regEmail || '');
      setRegPhone(data.regPhone || '');
      setRegPassword(data.regPassword || '');
    }

    // Check SetupIntent status and complete if succeeded
    stripe.retrieveSetupIntent(siClientSecret).then(async ({ setupIntent }) => {
      if (setupIntent?.status === 'succeeded') {
        setPaymentReady(true);
        setPaymentOpen(false);
        // Auto-complete if we have all form data
        if (saved) {
          const data = JSON.parse(saved);
          if (data.regName && data.regEmail && data.regPassword) {
            await completeFlow(setupIntent.id, data.regName, data.regEmail, data.regPhone || '', data.regPassword);
          }
        }
      }
    });
  }, [stripe]);

  const completeFlow = async (setupIntentId: string, name: string, email: string, phone: string, password: string) => {
    setSubmitting(true);
    setError(null);

    try {
      // Step 6: API complete-registration
      setStep('Création de l\'abonnement...');
      const res = await fetch('/api/business-checkout?action=complete-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setup_intent_id: setupIntentId,
          plan,
          billing_cycle: billing,
          promo_code: promoResult?.valid ? promoCode.trim() : undefined,
          extras: Array.from(selectedExtras),
          user_email: email,
          user_name: name,
          user_phone: phone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur serveur');

      // Step 7: Register Supabase account
      setStep('Création du compte...');
      const result = await register({ email, password, full_name: name });
      if (result?.error) {
        setError(result.error.message);
        setSubmitting(false);
        return;
      }

      // Step 8: Set billing metadata
      if (result.data?.user) {
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + (data.trial_days || trialDays));

        await supabase.from('business_users').update({
          stripe_customer_id: data.customer_id,
          trial_ends_at: trialEnd.toISOString(),
          promo_code_used: promoCode.trim().toUpperCase() || null,
        }).eq('id', result.data.user.id);

        await supabase.from('business_settings').upsert(
          { user_id: result.data.user.id, subscription_plan: plan },
          { onConflict: 'user_id' }
        );
      }

      // Step 9: Done
      sessionStorage.removeItem('closeos_checkout_state');
      navigate('/business/dashboard');
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue.');
      setSubmitting(false);
      setStep('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    // Step 1: Client-side validation
    if (!regName.trim() || !regEmail.trim() || !regPhone.trim() || !regPassword || regPassword.length < 8) {
      setError('Veuillez remplir tous les champs (mot de passe : 8 caracteres minimum).');
      return;
    }

    if (!paymentReady) {
      setPaymentOpen(true);
      setError('Veuillez remplir vos informations de paiement.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Step 2: Check for existing Sales account
      setStep('Verification...');
      const { data: salesProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', regEmail)
        .maybeSingle();

      if (salesProfile) {
        setError('Cet email est deja associe a un compte CloseOS Sales. Utilisez un autre email.');
        setSubmitting(false);
        setStep('');
        return;
      }

      // Step 4: Save form data for 3DS redirect edge case
      sessionStorage.setItem('closeos_checkout_state', JSON.stringify({
        regName, regEmail, regPhone, regPassword, plan, billing, promoCode,
        selectedExtras: Array.from(selectedExtras),
      }));

      // Step 5: Confirm SetupIntent
      setStep('Validation du paiement...');
      const { error: stripeError, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: 'if_required',
        confirmParams: {
          return_url: `${window.location.origin}/business/checkout?plan=${plan}&billing=${billing}&setup_return=true`,
        },
      });

      if (stripeError) {
        setPaymentOpen(true);
        setError(stripeError.message || 'Le paiement a echoue.');
        setSubmitting(false);
        setStep('');
        return;
      }

      if (!setupIntent || setupIntent.status !== 'succeeded') {
        // 3DS redirect happened — page will reload via return_url
        return;
      }

      // Steps 6-9: Complete flow
      await completeFlow(setupIntent.id, regName, regEmail, regPhone, regPassword);
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue.');
      setSubmitting(false);
      setStep('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl bg-white/70 backdrop-blur-xl p-6 sm:p-8 shadow-[0_20px_40px_rgba(27,28,27,0.04)]">
      {/* Error */}
      {error && (
        <div className="mb-6 rounded-xl bg-red-50/80 p-4 text-sm text-red-600 border border-red-200/40">
          {error}
        </div>
      )}

      {/* Collapsible Payment Section */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => setPaymentOpen(!paymentOpen)}
          className="w-full flex items-center justify-between py-3"
        >
          <div className="flex items-center gap-3">
            {paymentReady && !paymentOpen ? (
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                <Check className="h-4.5 w-4.5 text-emerald-600" strokeWidth={2.5} />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center">
                <CreditCard className="h-4 w-4 text-stone-600" />
              </div>
            )}
            <span className="font-bold text-stone-900 text-sm" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Paiement
            </span>
            {paymentReady && !paymentOpen && (
              <span className="text-xs text-emerald-600 font-medium">Carte enregistree</span>
            )}
          </div>
          <ChevronDown className={`h-4 w-4 text-stone-400 transition-transform duration-300 ${paymentOpen ? 'rotate-180' : ''}`} />
        </button>
        {/* PaymentElement stays mounted (overflow-hidden hides it) */}
        <div className={`overflow-hidden transition-all duration-300 ${paymentOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="pt-2 pb-4">
            <PaymentElement
              onChange={(e) => setPaymentReady(e.complete)}
              options={{ layout: 'tabs' }}
            />
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-stone-100 mb-6" />

      {/* Registration Section */}
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-1">Creer votre compte</p>

        <div>
          <label className="mb-1.5 block text-[0.75rem] font-semibold uppercase tracking-widest text-stone-500 text-left">
            Nom complet
          </label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={regName}
              onChange={(e) => setRegName(e.target.value)}
              className="w-full rounded-xl bg-stone-100/50 border-none py-3.5 pl-12 pr-5 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 transition-all"
              placeholder="John Doe"
              required
              disabled={submitting}
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[0.75rem] font-semibold uppercase tracking-widest text-stone-500 text-left">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
            <input
              type="email"
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
              className="w-full rounded-xl bg-stone-100/50 border-none py-3.5 pl-12 pr-5 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 transition-all"
              placeholder="votre@email.com"
              required
              disabled={submitting}
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[0.75rem] font-semibold uppercase tracking-widest text-stone-500 text-left">
            Telephone
          </label>
          <div className="relative">
            <Phone className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
            <input
              type="tel"
              value={regPhone}
              onChange={(e) => setRegPhone(e.target.value)}
              className="w-full rounded-xl bg-stone-100/50 border-none py-3.5 pl-12 pr-5 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 transition-all"
              placeholder="+33 6 12 34 56 78"
              required
              disabled={submitting}
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[0.75rem] font-semibold uppercase tracking-widest text-stone-500 text-left">
            Mot de passe
          </label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
            <input
              type="password"
              value={regPassword}
              onChange={(e) => setRegPassword(e.target.value)}
              className="w-full rounded-xl bg-stone-100/50 border-none py-3.5 pl-12 pr-5 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 transition-all"
              placeholder="Minimum 8 caracteres"
              required
              minLength={8}
              disabled={submitting}
            />
          </div>
        </div>
      </div>

      {/* Lancer button */}
      <button
        type="submit"
        disabled={submitting || !stripe}
        className="mt-8 flex w-full items-center justify-center gap-2.5 rounded-full bg-stone-900 py-5 font-bold text-white shadow-lg transition-all hover:bg-stone-800 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ fontFamily: 'Manrope, sans-serif' }}
      >
        {submitting ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>{step || 'Chargement...'}</span>
          </>
        ) : (
          <>
            <Rocket className="h-5 w-5" />
            <span>Lancer</span>
          </>
        )}
      </button>

      <p className="mt-5 text-center text-xs text-stone-400">
        En vous inscrivant, vous acceptez nos{' '}
        <Link to="/cgu" className="text-stone-600 hover:underline">CGU</Link>
        {' '}et notre{' '}
        <Link to="/confidentialite" className="text-stone-600 hover:underline">Politique de Confidentialite</Link>.
      </p>
    </form>
  );
}

// ─── Main checkout page ─────────────────────────────────────────────────────────

export default function BusinessCheckout() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, register } = useBusinessAuth();

  const plan = searchParams.get('plan') || 'solo';
  const billing = searchParams.get('billing') || 'annual';

  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoResult, setPromoResult] = useState<any>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [trialDays, setTrialDays] = useState(20);
  const [skipPayment, setSkipPayment] = useState(false);
  const [selectedExtras, setSelectedExtras] = useState<Set<string>>(new Set());
  const [featuresOpen, setFeaturesOpen] = useState(false);

  const switchBilling = (newBilling: string) => {
    setSearchParams({ plan, billing: newBilling }, { replace: true });
  };

  // Direct registration form state (for skip-payment promos)
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  const planLabel = PLAN_LABELS[plan] || 'Solo';
  const priceInfo = PLAN_PRICES[plan]?.[billing] || PLAN_PRICES.solo.annual;

  const toggleExtra = (key: string) => {
    setSelectedExtras(prev => {
      const next = new Set(prev);
      if (key === 'combo') {
        if (next.has('combo')) { next.delete('combo'); } else { next.clear(); next.add('combo'); }
      } else {
        next.delete('combo');
        if (next.has(key)) { next.delete(key); } else {
          next.add(key);
          if (next.has('setup') && next.has('integration')) { next.clear(); next.add('combo'); }
        }
      }
      return next;
    });
  };

  const extrasTotal = Array.from(selectedExtras).reduce((sum, key) => {
    const extra = EXTRAS.find(e => e.key === key);
    return sum + (extra?.price || 0);
  }, 0);

  // If user is already logged in, redirect to dashboard
  useEffect(() => {
    if (user) navigate('/business/dashboard', { replace: true });
  }, [user]);

  // Validate promo code
  const validatePromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    try {
      const res = await fetch('/api/business-checkout?action=validate-promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoCode.trim() }),
      });
      const data = await res.json();
      setPromoResult(data);
    } catch {
      setPromoResult({ valid: false });
    } finally {
      setPromoLoading(false);
    }
  };

  // Create SetupIntent on page load
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/business-checkout?action=create-setup-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan,
            billing_cycle: billing,
            promo_code: promoResult?.valid ? promoCode.trim() : undefined,
          }),
        });
        const data = await res.json();
        if (data.skip_payment) {
          setSkipPayment(true);
          setPromoResult({ ...promoResult, ...data.promo });
          return;
        }
        setTrialDays(data.trialDays || 20);
        if (data.clientSecret) setClientSecret(data.clientSecret);
      } catch (err) {
        console.error('SetupIntent error:', err);
      }
    })();
  }, []);

  // Handle direct registration (skip-payment flow)
  const handleDirectRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setRegLoading(true);

    try {
      const { data: salesProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', regEmail)
        .maybeSingle();

      if (salesProfile) {
        setRegError("Cet email est deja associe a un compte CloseOS Sales. Utilisez un autre email.");
        setRegLoading(false);
        return;
      }

      const result = await register({ email: regEmail, password: regPassword, full_name: regName });

      if (result?.error) {
        setRegError(result.error.message);
        setRegLoading(false);
        return;
      }

      if (result.data?.user) {
        const updates: any = { promo_code_used: promoCode.trim().toUpperCase() };
        if (promoResult?.type === 'lifetime_free') updates.is_lifetime_free = true;
        if (promoResult?.type === 'free_trial' && promoResult?.trial_days) {
          const trialEnd = new Date();
          trialEnd.setDate(trialEnd.getDate() + promoResult.trial_days);
          updates.trial_ends_at = trialEnd.toISOString();
        }
        await supabase.from('business_users').update(updates).eq('id', result.data.user.id);
        const effectivePlan = promoResult?.forced_plan || plan;
        await supabase.from('business_settings').upsert({ user_id: result.data.user.id, subscription_plan: effectivePlan }, { onConflict: 'user_id' });
      }

      navigate('/business/dashboard');
    } catch {
      setRegError("Une erreur est survenue.");
      setRegLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-stone-50 overflow-hidden">
      <div className="absolute top-[-10%] left-[15%] w-[600px] h-[600px] bg-emerald-100/30 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] bg-stone-200/30 blur-[120px] rounded-full pointer-events-none" />

      <header className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-5">
        <Link to="/business" className="flex items-center gap-2">
          <img src="/closeos-business-logo-ecrit.png" alt="CloseOS Business" className="h-8 w-auto" />
        </Link>
        <Link to="/business" className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-800 transition-colors font-medium">
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Link>
      </header>

      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 pb-16">
        {/* Plan summary card */}
        <div className="mb-6 rounded-2xl bg-white/70 backdrop-blur-xl p-6 sm:p-8 shadow-[0_20px_40px_rgba(27,28,27,0.04)]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-1">Votre formule</p>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {planLabel}
              </h1>
              <p className="text-stone-500 mt-1">
                {billing === 'annual' ? 'Facturation annuelle' : billing === 'quarterly' ? 'Facturation trimestrielle' : 'Facturation mensuelle'}
              </p>
            </div>
            <div className="text-right">
              {/* Billing cycle switch */}
              <div className="inline-flex items-center rounded-full bg-stone-100/80 p-0.5 mb-2">
                {BILLING_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => switchBilling(opt.key)}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                      billing === opt.key
                        ? 'bg-white text-stone-900 shadow-sm'
                        : 'text-stone-400 hover:text-stone-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-3xl sm:text-4xl font-extrabold text-stone-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {priceInfo.display}
              </p>
              {priceInfo.total && <p className="text-sm text-stone-400 mt-0.5">soit {priceInfo.total}</p>}
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <Sparkles className="h-3.5 w-3.5" />
                {trialDays} jours d'essai gratuit
              </div>
            </div>
          </div>

          {/* Features accordion */}
          {PLAN_FEATURES[plan] && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setFeaturesOpen(!featuresOpen)}
                className="flex items-center gap-1.5 text-xs font-semibold text-stone-400 hover:text-stone-600 transition-colors"
              >
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${featuresOpen ? 'rotate-180' : ''}`} />
                {featuresOpen ? 'Masquer les fonctionnalites' : 'Voir les fonctionnalites incluses'}
              </button>
              <div className={`overflow-hidden transition-all duration-300 ${featuresOpen ? 'max-h-[600px] opacity-100 mt-3' : 'max-h-0 opacity-0'}`}>
                <ul className="space-y-1.5 text-sm text-stone-600">
                  {PLAN_FEATURES[plan].features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                  {PLAN_FEATURES[plan].subFeatures?.map((f, i) => (
                    <li key={`sub-${i}`} className="flex items-start gap-2 pl-5">
                      <Check className="h-3 w-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span className="text-xs text-stone-500">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Promo code */}
          <div className="mt-6 pt-6 border-t border-stone-100">
            <label className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-2 block">Code promo</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <input
                  type="text" value={promoCode}
                  onChange={(e) => { setPromoCode(e.target.value); if (promoResult) setPromoResult(null); }}
                  placeholder="Entrez votre code"
                  className="w-full rounded-xl bg-stone-100/60 border-none py-3 pl-10 pr-4 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 transition-all text-sm"
                />
              </div>
              <button onClick={validatePromo} disabled={promoLoading || !promoCode.trim()}
                className="rounded-xl bg-stone-900 px-5 py-3 text-sm font-bold text-white hover:bg-stone-800 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
                {promoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Appliquer'}
              </button>
            </div>
            {promoResult && (
              <div className={`mt-2 flex items-center gap-2 text-sm ${promoResult.valid ? 'text-emerald-600' : 'text-red-500'}`}>
                {promoResult.valid ? <Check className="h-4 w-4" /> : null}
                {promoResult.valid
                  ? promoResult.type === 'free_trial' ? `Essai gratuit de ${promoResult.trial_days} jours active !`
                    : promoResult.type === 'lifetime_free' ? 'Acces gratuit a vie active !'
                    : promoResult.type === 'trial_extended' ? `Essai etendu a ${promoResult.trial_days} jours !`
                    : promoResult.type === 'discount' ? `Reduction de ${promoResult.discount_percent}% appliquee !`
                    : 'Code applique !'
                  : 'Code invalide ou expire'}
              </div>
            )}
          </div>

          {/* Extras */}
          <div className="mt-6 pt-6 border-t border-stone-100">
            <label className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-3 block">Services supplementaires (optionnel)</label>
            <div className="space-y-2.5">
              {EXTRAS.map((extra) => {
                const isChecked = selectedExtras.has(extra.key);
                return (
                  <button key={extra.key} type="button" onClick={() => toggleExtra(extra.key)}
                    className={`w-full flex items-start gap-3.5 rounded-xl p-4 text-left transition-all ${isChecked ? 'bg-emerald-50/80 ring-2 ring-emerald-500/30' : 'bg-stone-50/80 hover:bg-stone-100/80'}`}>
                    <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isChecked ? 'bg-emerald-600 border-emerald-600' : 'border-stone-300'}`}>
                      {isChecked && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-stone-900">{extra.name}</span>
                        {extra.isSaving && <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">-20€</span>}
                      </div>
                      <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">{extra.description}</p>
                    </div>
                    <span className="font-extrabold text-sm text-stone-900 flex-shrink-0 mt-0.5">{extra.price}€</span>
                  </button>
                );
              })}
            </div>
            {extrasTotal > 0 && <p className="mt-3 text-sm font-semibold text-stone-700 text-right">+ {extrasTotal}€ (paiement unique)</p>}
          </div>
        </div>

        {/* Skip-payment: direct registration form */}
        {skipPayment ? (
          <div className="rounded-2xl bg-white/70 backdrop-blur-xl p-6 sm:p-10 shadow-[0_20px_40px_rgba(27,28,27,0.04)]">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-50 mb-4">
                <Sparkles className="h-7 w-7 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-extrabold text-stone-900 tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {promoResult?.type === 'lifetime_free' ? 'Acces gratuit a vie' : `${promoResult?.trial_days || 31} jours offerts`}
              </h2>
              <p className="text-stone-500 mt-1">Creez votre compte pour demarrer immediatement</p>
            </div>
            {regError && <div className="mb-6 rounded-xl bg-red-50/80 p-4 text-sm text-red-600 border border-red-200/40">{regError}</div>}
            <form onSubmit={handleDirectRegister} className="space-y-5 max-w-md mx-auto">
              <div>
                <label className="mb-2 block text-[0.75rem] font-semibold uppercase tracking-widest text-stone-500 text-left">Nom complet</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
                  <input type="text" value={regName} onChange={(e) => setRegName(e.target.value)} className="w-full rounded-xl bg-stone-100/50 border-none py-4 pl-12 pr-5 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 transition-all" placeholder="John Doe" required />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-[0.75rem] font-semibold uppercase tracking-widest text-stone-500 text-left">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
                  <input type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} className="w-full rounded-xl bg-stone-100/50 border-none py-4 pl-12 pr-5 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 transition-all" placeholder="votre@email.com" required />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-[0.75rem] font-semibold uppercase tracking-widest text-stone-500 text-left">Telephone</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
                  <input type="tel" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} className="w-full rounded-xl bg-stone-100/50 border-none py-4 pl-12 pr-5 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 transition-all" placeholder="+33 6 12 34 56 78" required />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-[0.75rem] font-semibold uppercase tracking-widest text-stone-500 text-left">Mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
                  <input type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} className="w-full rounded-xl bg-stone-100/50 border-none py-4 pl-12 pr-5 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 transition-all" placeholder="Minimum 8 caracteres" required minLength={8} />
                </div>
              </div>
              <button type="submit" disabled={regLoading} className="flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 py-5 font-bold text-white shadow-lg transition-all hover:bg-stone-800 active:scale-95 disabled:opacity-50" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {regLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Rocket className="h-5 w-5" /> Lancer</>}
              </button>
            </form>
            <p className="mt-6 text-center text-xs text-stone-400">
              En vous inscrivant, vous acceptez nos{' '}<Link to="/cgu" className="text-stone-600 hover:underline">CGU</Link>{' '}et notre{' '}<Link to="/confidentialite" className="text-stone-600 hover:underline">Politique de Confidentialite</Link>.
            </p>
          </div>
        ) : clientSecret ? (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: STRIPE_APPEARANCE }}>
            <CheckoutForm
              plan={plan} billing={billing} promoCode={promoCode} promoResult={promoResult}
              selectedExtras={selectedExtras} trialDays={trialDays}
              register={register} navigate={navigate}
            />
          </Elements>
        ) : (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
              <p className="text-sm text-stone-400">Preparation du paiement...</p>
            </div>
          </div>
        )}

        <div className="mt-8 text-center">
          <p className="text-sm text-stone-400">
            Deja un compte ?{' '}
            <Link to="/business/login" className="font-semibold text-stone-700 hover:text-stone-900 transition-colors">Se connecter</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
