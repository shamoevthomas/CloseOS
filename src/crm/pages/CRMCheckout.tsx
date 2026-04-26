import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, ArrowRight, Check, CreditCard } from 'lucide-react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { supabase } from '../../lib/supabase'

const PRIMARY = '#3B82F6'
const SECONDARY = '#60A5FA'

const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ||
  'pk_live_51SxnxC33xpuYLywqRhYvxhWrChlI3Ckjj1AfJLqRQJQwaXNyVLuLAPaURbnEcrKRAQJTneB3ZjhUHSHuFQ9Xekdt00k1ho4IEt'
)

type BillingCycle = 'monthly' | 'quarterly' | 'annual'

const PRICE_LABELS: Record<BillingCycle, { monthly: string; total: string; saving: string | null }> = {
  monthly:   { monthly: '49', total: '49€',  saving: null },
  quarterly: { monthly: '37', total: '111€', saving: '-25%' },
  annual:    { monthly: '29', total: '348€', saving: '-40%' },
}

export default function CRMCheckout() {
  const navigate = useNavigate()
  const [billing, setBilling] = useState<BillingCycle>('annual')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loadingIntent, setLoadingIntent] = useState(false)
  const [intentError, setIntentError] = useState<string | null>(null)

  // Form state
  const [step, setStep] = useState<'form' | 'payment'>('form')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  // Fetch setup intent when reaching the payment step
  useEffect(() => {
    if (step !== 'payment') return
    setLoadingIntent(true)
    setIntentError(null)
    fetch('/api/crm-checkout?action=create-setup-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ billing_cycle: billing }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.clientSecret) setClientSecret(d.clientSecret)
        else setIntentError(d.error || 'Erreur lors de l\'initialisation du paiement')
      })
      .catch(err => setIntentError(err?.message || 'Erreur réseau'))
      .finally(() => setLoadingIntent(false))
  }, [step, billing])

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!fullName.trim() || !email.trim() || password.length < 8) {
      setFormError('Tous les champs sont requis. Mot de passe : 8 caractères minimum.')
      return
    }
    if (password !== confirm) {
      setFormError('Les mots de passe ne correspondent pas.')
      return
    }
    setStep('payment')
  }

  const inputCls = "w-full bg-transparent border-b-2 border-[#c4c7c7]/40 py-3 text-[#0A0E27] placeholder:text-[#444748]/40 focus:border-[#3B82F6] focus:ring-0 outline-none font-medium transition-colors"

  return (
    <div className="min-h-screen grid md:grid-cols-2" style={{ background: '#F8FAFC', fontFamily: 'DM Sans, system-ui, sans-serif' }}>
      {/* Left: pricing/value prop */}
      <div className="hidden md:flex flex-col justify-between p-12" style={{ background: `linear-gradient(135deg, ${PRIMARY}15 0%, ${SECONDARY}15 100%)` }}>
        <button onClick={() => navigate('/crm')} className="flex items-center gap-2">
          <img src="/closeos-crm.png" alt="CloseOS CRM" className="h-10 w-auto object-contain" />
        </button>
        <div>
          <h2 className="text-4xl font-extrabold tracking-tighter text-[#111111] mb-6 leading-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
            14 jours gratuits,<br />annulable à tout moment.
          </h2>
          <p className="text-[#444748] text-sm mb-6 leading-relaxed">
            Carte bancaire requise à l'inscription. Aucun débit pendant les 14 jours. Annulation en 1 clic depuis votre espace.
          </p>
          <ul className="space-y-3 mb-6">
            {[
              'Dashboard + CRM illimité + Pipeline Kanban',
              'Campagnes avec pages de capture + Stripe',
              'Acquisition : UTM + analytics + ROI',
              'API + Webhooks + Zapier / Make / N8N',
              'Support email prioritaire',
            ].map((f) => (
              <li key={f} className="flex items-start gap-3 text-sm text-[#0A0E27]">
                <Check className="h-4 w-4 mt-0.5 shrink-0" style={{ color: PRIMARY }} />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-[#747878]">© 2026 CloseOS</p>
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          <button onClick={() => navigate('/crm')} className="md:hidden mb-6">
            <img src="/closeos-crm.png" alt="CloseOS CRM" className="h-8 w-auto object-contain" />
          </button>

          {step === 'form' && (
            <>
              <h1 className="text-3xl font-extrabold tracking-tighter text-[#111111] mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Créer votre compte
              </h1>
              <p className="text-sm text-[#444748] mb-6">14 jours gratuits — carte bancaire requise (aucun débit immédiat)</p>

              {/* Billing selector */}
              <div className="mb-6 p-1 grid grid-cols-3 rounded-full bg-stone-100 border border-stone-200 relative">
                <div
                  className="absolute top-1 bottom-1 rounded-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{
                    width: 'calc(33.333% - 4px)',
                    left: billing === 'annual' ? '4px' : billing === 'quarterly' ? 'calc(33.333% + 1px)' : 'calc(66.666%)',
                    background: `linear-gradient(135deg, ${PRIMARY} 0%, ${SECONDARY} 100%)`,
                  }}
                />
                {(['annual', 'quarterly', 'monthly'] as BillingCycle[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setBilling(key)}
                    className={`relative z-10 py-2 text-xs font-bold rounded-full transition-colors ${billing === key ? 'text-white' : 'text-stone-600'}`}
                  >
                    {PRICE_LABELS[key].saving && (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full whitespace-nowrap ring-2 ring-white">
                        {PRICE_LABELS[key].saving}
                      </span>
                    )}
                    {key === 'annual' ? 'Annuel' : key === 'quarterly' ? 'Trim.' : 'Mensuel'}
                  </button>
                ))}
              </div>

              {/* Price summary */}
              <div className="p-4 rounded-2xl bg-white border border-[#eae8e7] mb-6">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-[#747878] font-bold uppercase tracking-widest">CloseOS CRM</span>
                  <div className="text-right">
                    <span className="text-3xl font-extrabold text-[#111111]" style={{ fontFamily: 'Manrope, sans-serif' }}>{PRICE_LABELS[billing].monthly}€</span>
                    <span className="text-sm text-[#444748] ml-1">/mois</span>
                  </div>
                </div>
                <p className="text-[11px] text-[#747878] mt-1 text-right">
                  {billing === 'monthly' ? '49€/mois facturé mensuellement' : billing === 'quarterly' ? `Facturé ${PRICE_LABELS[billing].total} tous les 3 mois` : `Facturé ${PRICE_LABELS[billing].total} par an`}
                </p>
              </div>

              {formError && (
                <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                  {formError}
                </div>
              )}

              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/60">Nom complet</label>
                  <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jean Dupont" className={inputCls} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/60">Email</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="vous@exemple.com" className={inputCls} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/60">Téléphone (optionnel)</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+33 6 12 34 56 78" className={inputCls} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/60">Mot de passe</label>
                  <input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 8 caractères" className={inputCls} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/60">Confirmer</label>
                  <input type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} className={inputCls} />
                </div>

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 px-7 py-4 rounded-full text-white font-extrabold shadow-xl transition-transform hover:scale-[1.02] active:scale-95 mt-6"
                  style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${SECONDARY} 100%)` }}
                >
                  Continuer vers le paiement <ArrowRight className="h-4 w-4" />
                </button>
              </form>

              <p className="text-sm text-center text-[#444748] mt-6">
                Déjà un compte ? <button onClick={() => navigate('/crm/login')} className="font-bold" style={{ color: PRIMARY }}>Se connecter</button>
              </p>
            </>
          )}

          {step === 'payment' && (
            <>
              <button onClick={() => setStep('form')} className="text-sm text-[#747878] font-bold mb-4 hover:text-[#111111]">← Retour</button>
              <h1 className="text-3xl font-extrabold tracking-tighter text-[#111111] mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Enregistrer votre carte
              </h1>
              <p className="text-sm text-[#444748] mb-6">
                <span className="inline-flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5" style={{ color: PRIMARY }} /> Aucun débit pendant les 14 jours d'essai.
                </span>
              </p>

              {loadingIntent && (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#3B82F6]" /></div>
              )}
              {intentError && (
                <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                  {intentError}
                </div>
              )}
              {clientSecret && (
                <Elements
                  stripe={stripePromise}
                  options={{
                    clientSecret,
                    appearance: {
                      theme: 'flat',
                      variables: { colorPrimary: PRIMARY, borderRadius: '12px', fontFamily: 'Manrope, system-ui, sans-serif' },
                    },
                  }}
                >
                  <PaymentStep
                    billing={billing}
                    fullName={fullName}
                    email={email}
                    phone={phone}
                    password={password}
                    onSuccess={() => navigate('/crm/dashboard', { replace: true })}
                  />
                </Elements>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function PaymentStep({ billing, fullName, email, phone, password, onSuccess }: {
  billing: BillingCycle
  fullName: string
  email: string
  phone: string
  password: string
  onSuccess: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePay = async () => {
    if (!stripe || !elements) return
    setSubmitting(true)
    setError(null)

    const { error: stripeError, setupIntent } = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: `${window.location.origin}/crm/checkout?return=true` },
      redirect: 'if_required',
    })

    if (stripeError) {
      setError(stripeError.message || 'Erreur lors de la validation de la carte.')
      setSubmitting(false)
      return
    }
    if (!setupIntent || setupIntent.status !== 'succeeded') {
      setError('Le paiement n\'a pas pu être validé. Réessayez.')
      setSubmitting(false)
      return
    }

    try {
      const res = await fetch('/api/crm-checkout?action=complete-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setup_intent_id: setupIntent.id,
          billing_cycle: billing,
          user_email: email,
          user_name: fullName,
          user_phone: phone,
          password,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erreur lors de la création du compte')
        setSubmitting(false)
        return
      }
      // Auto-login the freshly created user
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
      if (signInErr) {
        setError('Compte créé mais erreur de connexion : ' + signInErr.message + '. Connectez-vous manuellement.')
        setSubmitting(false)
        return
      }
      onSuccess()
    } catch (err: any) {
      setError(err?.message || 'Erreur réseau')
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="p-4 rounded-xl border border-[#c4c7c7]/30 bg-white">
        <PaymentElement options={{ layout: 'tabs' }} />
      </div>
      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}
      <button
        onClick={handlePay}
        disabled={submitting || !stripe || !elements}
        className="w-full flex items-center justify-center gap-2 px-7 py-4 rounded-full text-white font-extrabold shadow-xl transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50"
        style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${SECONDARY} 100%)` }}
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Commencer 14 jours gratuits <ArrowRight className="h-4 w-4" /></>}
      </button>
      <p className="text-[11px] text-center text-[#747878]">
        En validant, vous acceptez nos <a href="/cgu" className="underline">CGU</a>. Vous pouvez résilier à tout moment depuis votre espace avant la fin de l'essai — aucun débit.
      </p>
    </div>
  )
}
