import { useState } from 'react';
import { Loader2, Lock, X, ShieldCheck } from 'lucide-react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { stripePromise } from './InlineStripePayment';
import { signSupabase as supabase } from '../lib/signSupabase';
import { useSignLang } from '../contexts/SignLangContext';

/**
 * Modale de paiement signataire (« Payé + signé »), DA Sign. Gère un PaymentIntent (paiement
 * immédiat) OU un SetupIntent (abonnement avec essai gratuit → carte enregistrée, 0 € débité).
 * Au succès, appelle l'Edge Function sign-pay `confirm` (vérif serveur) → onPaid().
 */
export type PayIntentType = 'payment' | 'setup';

const APPEARANCE = {
  theme: 'night' as const,
  variables: {
    colorPrimary: '#CEFF8F',
    colorBackground: '#191E1E',
    colorText: '#F3F4F6',
    colorDanger: '#ef6b6b',
    borderRadius: '10px',
    fontFamily: 'system-ui, sans-serif',
  },
};

function priceLabel(amount: number, currency: string) {
  return `${(amount / 100).toFixed(2).replace(/[.,]00$/, '')}${currency === 'eur' ? '€' : ' ' + currency.toUpperCase()}`;
}

function PayInner({
  token,
  intentType,
  amount,
  currency,
  consent,
  onPaid,
  onClose,
}: {
  token: string;
  intentType: PayIntentType;
  amount: number;
  currency: string;
  consent?: boolean;
  onPaid: () => void;
  onClose: () => void;
}) {
  const { lang } = useSignLang();
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  const label = priceLabel(amount, currency);

  const pay = async () => {
    if (!stripe || !elements) return;
    setProcessing(true);
    setError('');
    const { error: subErr } = await elements.submit();
    if (subErr) {
      setError(subErr.message || (lang === 'fr' ? 'Erreur de paiement' : 'Payment error'));
      setProcessing(false);
      return;
    }
    const res =
      intentType === 'setup'
        ? await stripe.confirmSetup({ elements, redirect: 'if_required' })
        : await stripe.confirmPayment({ elements, redirect: 'if_required' });
    if (res.error) {
      setError(res.error.message || (lang === 'fr' ? 'Paiement refusé' : 'Payment declined'));
      setProcessing(false);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const intent = (res as any).setupIntent || (res as any).paymentIntent;
    if (intent?.status === 'succeeded') {
      try {
        const { data, error: err } = await supabase.functions.invoke('sign-pay', { body: { action: 'confirm', token, consent: consent ? (lang === 'fr' ? "J'ai lu et j'accepte ce document" : 'I have read and accept this document') : undefined } });
        if (err) throw err;
        if (data?.ok) {
          onPaid();
          return;
        }
        setError(lang === 'fr' ? 'Confirmation impossible. Réessayez.' : 'Unable to confirm. Please try again.');
      } catch {
        setError(lang === 'fr' ? 'Erreur réseau, réessayez.' : 'Network error, please try again.');
      }
    } else {
      setError(lang === 'fr' ? 'Paiement non finalisé.' : 'Payment not completed.');
    }
    setProcessing(false);
  };

  return (
    <div>
      <div className="mb-4 flex items-start justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#CEFF8F]/10">
          <Lock className="h-5 w-5 text-[#CEFF8F]" />
        </div>
        <button onClick={onClose} className="text-[#A1A9A9] transition-colors hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      <h3 className="text-lg font-semibold text-white">{intentType === 'setup' ? (lang === 'fr' ? 'Confirmer votre moyen de paiement' : 'Confirm your payment method') : (lang === 'fr' ? `Paiement — ${label}` : `Payment — ${label}`)}</h3>
      <p className="mt-1 text-sm leading-relaxed text-[#A1A9A9]">
        {intentType === 'setup'
          ? (lang === 'fr'
              ? `Essai gratuit : aucun débit aujourd'hui. Votre carte est enregistrée pour la suite (${label} par échéance).`
              : `Free trial: no charge today. Your card is saved for later (${label} per billing period).`)
          : (lang === 'fr' ? 'Réglez pour valider et signer le document.' : 'Pay to validate and sign the document.')}
      </p>

      <div className="mt-5">
        <PaymentElement onChange={(e) => setReady(e.complete)} options={{ layout: 'tabs' }} />
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-[#ef6b6b]/30 bg-[#ef6b6b]/10 px-3 py-2.5 text-center text-xs font-medium text-[#ef6b6b]">{error}</p>
      )}

      <button
        onClick={pay}
        disabled={!ready || processing || !stripe}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#CEFF8F] py-3 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {processing ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        {intentType === 'setup' ? (lang === 'fr' ? 'Confirmer et signer' : 'Confirm and sign') : (lang === 'fr' ? `Payer ${label} et signer` : `Pay ${label} and sign`)}
      </button>

      <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] font-medium text-[#6b7373]">
        <Lock className="h-3 w-3" /> {lang === 'fr' ? 'Paiement sécurisé par Stripe' : 'Secure payment by Stripe'}
      </div>
    </div>
  );
}

export default function SignPaymentModal({
  open,
  clientSecret,
  intentType,
  amount,
  currency,
  token,
  consent,
  onClose,
  onPaid,
}: {
  open: boolean;
  clientSecret: string;
  intentType: PayIntentType;
  amount: number;
  currency: string;
  token: string;
  consent?: boolean;
  onClose: () => void;
  onPaid: () => void;
}) {
  if (!open || !clientSecret) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#3A4242] bg-[#222828] p-4 shadow-2xl sm:p-6" onMouseDown={(e) => e.stopPropagation()}>
        <Elements stripe={stripePromise} options={{ clientSecret, appearance: APPEARANCE }}>
          <PayInner token={token} intentType={intentType} amount={amount} currency={currency} consent={consent} onPaid={onPaid} onClose={onClose} />
        </Elements>
      </div>
    </div>
  );
}
