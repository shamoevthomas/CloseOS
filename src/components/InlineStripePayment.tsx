import { useState } from 'react'
import { Loader2, Lock, ArrowRight, XCircle } from 'lucide-react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, ExpressCheckoutElement, useStripe, useElements } from '@stripe/react-stripe-js'

export const stripePromise = loadStripe('pk_live_51SxnxC33xpuYLywqRhYvxhWrChlI3Ckjj1AfJLqRQJQwaXNyVLuLAPaURbnEcrKRAQJTneB3ZjhUHSHuFQ9Xekdt00k1ho4IEt')

export const INLINE_STRIPE_APPEARANCE = {
  theme: 'flat' as const,
  variables: {
    colorPrimary: '#1b1c1b',
    colorBackground: '#fbf9f8',
    colorText: '#1b1c1b',
    borderRadius: '12px',
    fontFamily: 'Manrope, system-ui, sans-serif',
  },
}

export type InlineStripeLang = 'fr' | 'en'

export interface InlineStripePaymentProps {
  amount: number
  currency: string
  lang: InlineStripeLang
  paymentIntentId: string
  confirmEndpoint: string
  cancelEndpoint?: string
  returnUrl: string
  onSuccess: (data: any) => void
  onCancel: () => void
}

function PaymentInner({ amount, currency, lang, paymentIntentId, confirmEndpoint, cancelEndpoint, returnUrl, onSuccess, onCancel }: InlineStripePaymentProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expressReady, setExpressReady] = useState(false)

  const priceLabel = `${(amount / 100).toFixed(2).replace('.00', '')}${currency === 'eur' ? '€' : ' ' + currency.toUpperCase()}`

  const handlePay = async () => {
    if (!stripe || !elements) return
    setProcessing(true)
    setError(null)

    const { error: submitError } = await elements.submit()
    if (submitError) {
      setError(submitError.message || (lang === 'fr' ? 'Erreur de paiement' : 'Payment error'))
      setProcessing(false)
      return
    }

    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: 'if_required',
    })

    if (stripeError) {
      setError(stripeError.message || (lang === 'fr' ? 'Erreur de paiement' : 'Payment error'))
      setProcessing(false)
      return
    }

    if (paymentIntent?.status === 'succeeded') {
      try {
        const r = await fetch(confirmEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payment_intent_id: paymentIntentId }),
        })
        const data = await r.json()
        if (data.success || data.already_completed) {
          onSuccess(data)
        } else if (data.refunded) {
          setError(lang === 'fr'
            ? 'Le créneau n\'est plus disponible. Tu as été remboursé automatiquement.'
            : 'Slot no longer available. You have been automatically refunded.')
        } else {
          setError(data.error || (lang === 'fr' ? 'Erreur de confirmation' : 'Confirmation error'))
        }
      } catch {
        setError(lang === 'fr' ? 'Erreur réseau' : 'Network error')
      }
    }
    setProcessing(false)
  }

  const handleCancel = () => {
    if (cancelEndpoint) {
      fetch(cancelEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_intent_id: paymentIntentId }),
      }).catch(() => {})
    }
    onCancel()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <Lock className="h-4 w-4 text-[#006c49]" />
        <span className="text-sm font-bold text-[#1b1c1b]" style={{ fontFamily: 'Manrope, sans-serif' }}>
          {lang === 'fr' ? `Paiement sécurisé — ${priceLabel}` : `Secure payment — ${priceLabel}`}
        </span>
      </div>

      <div className={expressReady ? 'rounded-xl bg-white p-3' : 'hidden'}>
        <ExpressCheckoutElement
          onReady={({ availablePaymentMethods }) => {
            if (availablePaymentMethods && Object.keys(availablePaymentMethods).length > 0) {
              setExpressReady(true)
            }
          }}
          onConfirm={async () => { await handlePay() }}
          options={{ buttonType: { applePay: 'book', googlePay: 'book' }, buttonHeight: 48 }}
        />
      </div>

      {expressReady && (
        <div className="flex items-center gap-3 my-2">
          <div className="flex-1 h-px bg-[#c4c7c7]/40" />
          <span className="text-[10px] text-[#444748]/50 font-bold tracking-widest uppercase">
            {lang === 'fr' ? 'ou par carte' : 'or by card'}
          </span>
          <div className="flex-1 h-px bg-[#c4c7c7]/40" />
        </div>
      )}

      <div className="rounded-xl border border-[#c4c7c7]/30 p-4 bg-white">
        <PaymentElement onChange={(e) => setReady(e.complete)} options={{ layout: 'tabs' }} />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-xl">
          <XCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <button
        onClick={handlePay}
        disabled={!ready || processing || !stripe}
        className="w-full flex items-center justify-center gap-3 rounded-full bg-[#1b1c1b] py-5 text-base font-extrabold text-white hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xl"
        style={{ fontFamily: 'Manrope, sans-serif' }}
      >
        {processing ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            <Lock className="h-4 w-4" />
            <span>{lang === 'fr' ? `Payer ${priceLabel} et confirmer` : `Pay ${priceLabel} and confirm`}</span>
            <ArrowRight className="h-5 w-5" />
          </>
        )}
      </button>

      <button
        onClick={handleCancel}
        disabled={processing}
        className="w-full text-center text-xs text-[#444748]/60 font-bold py-2 hover:underline disabled:opacity-30"
      >
        {lang === 'fr' ? '← Modifier mes informations' : '← Edit my info'}
      </button>

      <div className="flex items-center justify-center gap-2 text-[10px] text-[#444748]/40 font-medium">
        <Lock className="h-3 w-3" />
        <span>{lang === 'fr' ? 'Paiement sécurisé par Stripe' : 'Secure payment by Stripe'}</span>
      </div>
    </div>
  )
}

export interface InlineStripePaymentModalProps extends InlineStripePaymentProps {
  clientSecret: string
}

export function InlineStripePaymentModal(props: InlineStripePaymentModalProps) {
  const { clientSecret, ...inner } = props
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#fbf9f8] rounded-3xl shadow-2xl max-w-md w-full p-6 my-8">
        <Elements stripe={stripePromise} options={{ clientSecret, appearance: INLINE_STRIPE_APPEARANCE }}>
          <PaymentInner {...inner} />
        </Elements>
      </div>
    </div>
  )
}
