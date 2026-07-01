import { useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { openSignBillingPortal, type SignSubscription } from '../lib/signSubscription';

/**
 * CloseOS Sign — pop-up de paiement.
 *  - 'grace'  : paiement échoué, 3 jours pour régler (pop-up fermable, non bloquante).
 *  - 'blocked': délai dépassé → accès suspendu (pop-up plein écran, non fermable).
 * Le règlement se fait via le portail de facturation Stripe.
 */
export default function SignPaywall({ mode, sub }: { mode: 'grace' | 'blocked'; sub: SignSubscription | null }) {
  const [busy, setBusy] = useState(false);
  const [closed, setClosed] = useState(false);
  const blocked = mode === 'blocked';
  if (closed && !blocked) return null;

  const pay = async () => {
    setBusy(true);
    const { error } = await openSignBillingPortal();
    if (error) setBusy(false); // sinon redirection vers Stripe
  };

  const anchor = sub?.pastDueAt || sub?.currentPeriodEnd;
  const deadline = anchor ? new Date(anchor).getTime() + 3 * 86400000 : null;
  const daysLeft = deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 86400000)) : null;

  return (
    <div className={`fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-5 ${blocked ? 'bg-[#191E1E]/95 backdrop-blur-md' : 'bg-[#191E1E]/70 backdrop-blur-sm'}`}>
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#3A4242] bg-[#222828] p-6 shadow-2xl sm:p-8">
        {!blocked && (
          <button onClick={() => setClosed(true)} aria-label="Fermer" className="absolute right-4 top-4 text-[#A1A9A9] transition-colors hover:text-white">
            <X className="h-4 w-4" />
          </button>
        )}
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-[#F0B86E]/30 bg-[#F0B86E]/10">
          <AlertTriangle className="h-6 w-6 text-[#F0B86E]" />
        </div>
        <h2 className="mb-2 text-xl font-semibold tracking-tight text-white">{blocked ? 'Accès suspendu' : 'Paiement requis'}</h2>
        <p className="mb-6 text-sm leading-relaxed text-[#A1A9A9]">
          {blocked
            ? 'Votre abonnement CloseOS Sign n’a pas pu être renouvelé et le délai est dépassé. Réglez votre paiement pour rouvrir l’accès à votre espace.'
            : `Votre dernier paiement a échoué.${daysLeft !== null ? ` Il vous reste ${daysLeft} jour${daysLeft > 1 ? 's' : ''} pour régulariser` : ' Régularisez'} avant la suspension de votre compte.`}
        </p>
        <button onClick={pay} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#CEFF8F] py-3 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC] disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Régler mon abonnement'}
        </button>
        {!blocked && (
          <button onClick={() => setClosed(true)} className="mt-3 w-full text-center text-xs text-[#A1A9A9] transition-colors hover:text-white">
            Plus tard
          </button>
        )}
      </div>
    </div>
  );
}
