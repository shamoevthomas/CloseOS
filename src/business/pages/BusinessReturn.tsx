import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, Loader2, Lock, User, Mail, ArrowRight } from 'lucide-react';
import { useBusinessAuth } from '../contexts/BusinessAuthContext';
import { useBusinessLang } from '../i18n/BusinessLangContext'
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

export default function BusinessReturn() {
  const [status, setStatus] = useState<string | null>(null);
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [planFromSession, setPlanFromSession] = useState('');
  const [billingFromSession, setBillingFromSession] = useState('');
  const [promoFromSession, setPromoFromSession] = useState('');
  const [loadingStripe, setLoadingStripe] = useState(true);

  const [searchParams] = useSearchParams();
  const plan = searchParams.get('plan') || 'solo';
  const billing = searchParams.get('billing') || 'annual';

  const { register } = useBusinessAuth();
  const { t, lang } = useBusinessLang()
  const { refreshProfile: refreshParentProfile } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Protect against iframe loading
    if (window.self !== window.top && window.top) {
      window.top.location.href = window.location.href;
      return;
    }

    const sessionId = searchParams.get('session_id');

    if (sessionId) {
      fetch(`/api/business-checkout?action=session-status&session_id=${sessionId}`)
        .then((res) => res.json())
        .then((data) => {
          setStatus(data.status);
          setCustomerEmail(data.customer_email || '');
          setCustomerId(data.customer_id || '');
          setPlanFromSession(data.plan || plan);
          setBillingFromSession(data.billing_cycle || billing);
          setPromoFromSession(data.promo_code || '');
          setLoadingStripe(false);
        })
        .catch(() => setLoadingStripe(false));
    } else {
      setLoadingStripe(false);
    }
  }, [searchParams]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAuthLoading(true);

    try {
      // Check for existing Sales account
      const { data: salesProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', customerEmail)
        .maybeSingle();

      if (salesProfile) {
        setError(t.return_error_sales_email);
        setAuthLoading(false);
        return;
      }

      const result = await register({
        email: customerEmail,
        password,
        full_name: name,
      });

      if (result?.error) {
        setError(result.error.message);
        setAuthLoading(false);
        return;
      }

      // Set billing metadata on business_users
      if (result.data?.user) {
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 20); // Default 20-day trial

        await supabase
          .from('business_users')
          .update({
            stripe_customer_id: customerId || null,
            trial_ends_at: trialEnd.toISOString(),
            promo_code_used: promoFromSession || null,
          })
          .eq('id', result.data.user.id);

        // Set subscription plan
        await supabase
          .from('business_settings')
          .upsert(
            { user_id: result.data.user.id, subscription_plan: planFromSession || plan },
            { onConflict: 'user_id' }
          );
      }

      localStorage.setItem('closeos_product', 'business');
      await refreshParentProfile();
      navigate('/business/dashboard');
    } catch {
      setError(t.return_error_generic);
      setAuthLoading(false);
    }
  };

  // Redirect to checkout if session is still open
  if (!loadingStripe && status === 'open') {
    return <Navigate to={`/business/checkout?plan=${plan}&billing=${billing}`} />;
  }

  // No session at all -> redirect to landing
  if (!loadingStripe && !status) {
    return <Navigate to="/business" />;
  }

  if (loadingStripe) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
          <p className="text-stone-400 text-sm">{t.return_payment_checking}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-stone-50 flex items-center justify-center p-4 overflow-hidden">
      {/* Ambient blobs */}
      <div className="absolute top-[-10%] left-[20%] w-[600px] h-[600px] bg-emerald-100/30 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] bg-stone-200/30 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 w-full max-w-lg">
        {/* Brand */}
        <div className="mb-8 flex justify-center">
          <Link to="/business">
            <img src="/closeos-business-logo-ecrit.png" alt="CloseOS Business" className="h-9 w-auto" />
          </Link>
        </div>

        {/* Glass card */}
        <div className="rounded-2xl bg-white/70 backdrop-blur-xl p-8 sm:p-10 shadow-[0_20px_40px_rgba(27,28,27,0.04)]">
          {/* Success header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-extrabold text-stone-900 tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {t.return_payment_confirmed}
            </h1>
            <p className="text-stone-500 mt-2">
              {t.return_finalize_account} {PLAN_LABELS[planFromSession || plan] || 'Business'}.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 rounded-xl bg-red-50/80 p-4 text-sm text-red-600 border border-red-200/40">
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-5">
            {/* Email (locked to Stripe session email) */}
            <div>
              <label className="mb-2 block text-[0.75rem] font-semibold uppercase tracking-widest text-stone-500 text-left">
                {t.return_email_label}
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
                <input
                  type="email"
                  value={customerEmail}
                  disabled
                  className="w-full rounded-full bg-stone-100/50 border-none py-4 pl-12 pr-12 text-stone-600 cursor-not-allowed opacity-70"
                />
                <Lock className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[0.75rem] font-semibold uppercase tracking-widest text-stone-500 text-left">
                {t.return_name}
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="John Doe"
                  className="w-full rounded-full bg-stone-100/50 border-none py-4 pl-12 pr-5 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[0.75rem] font-semibold uppercase tracking-widest text-stone-500 text-left">
                {t.return_password_label}
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder={t.return_password_placeholder}
                  className="w-full rounded-full bg-stone-100/50 border-none py-4 pl-12 pr-5 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 py-5 font-bold text-white shadow-lg transition-all hover:bg-stone-800 active:scale-95 disabled:opacity-50"
              style={{ fontFamily: 'Manrope, sans-serif' }}
            >
              {authLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : t.return_activate}
              {!authLoading && <ArrowRight className="h-5 w-5" />}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-stone-400">
            {t.return_terms_text}{' '}
            <Link to="/cgu" className="text-stone-600 hover:underline">{t.return_terms_cgu}</Link>
            {' '}{t.return_terms_and}{' '}
            <Link to="/confidentialite" className="text-stone-600 hover:underline">{t.return_terms_privacy}</Link>.
          </p>
        </div>

        <p className="mt-8 text-center text-xs text-stone-400">
          &copy; {new Date().getFullYear()} CloseOS. {t.return_copyright}
        </p>
      </div>
    </div>
  );
}

const PLAN_LABELS: Record<string, string> = {
  solo: 'Solo',
  business: 'Business',
  business_acquisition: 'Business + Acquisition',
};
