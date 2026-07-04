import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, CheckCircle2, XCircle, Ban } from 'lucide-react';
import { listSubscriptionEvents, type SignSigner, type SignSubscriptionEvent } from '../lib/signContracts';
import { useSignLang, type SignLang } from '../contexts/SignLangContext';

/**
 * Suivi des abonnements (OBSERVATION) côté propriétaire : état courant par signataire payeur +
 * historique des échéances. Alimenté par le webhook Stripe. N'affiche PAS la commission CloseOS
 * (métrique plateforme). Ne modifie rien — lecture seule.
 */
const STATUS: Record<string, { label: Record<SignLang, string>; cls: string; Icon: typeof CheckCircle2 }> = {
  active: { label: { fr: 'À jour', en: 'Up to date' }, cls: 'border-[#CEFF8F]/40 bg-[#CEFF8F]/10 text-[#CEFF8F]', Icon: CheckCircle2 },
  trialing: { label: { fr: 'Essai gratuit', en: 'Free trial' }, cls: 'border-[#A0E7EC]/40 bg-[#A0E7EC]/10 text-[#A0E7EC]', Icon: CheckCircle2 },
  past_due: { label: { fr: 'Paiement en échec', en: 'Payment failed' }, cls: 'border-[#F0B86E]/40 bg-[#F0B86E]/10 text-[#F0B86E]', Icon: XCircle },
  unpaid: { label: { fr: 'Impayé', en: 'Unpaid' }, cls: 'border-[#ef6b6b]/40 bg-[#ef6b6b]/10 text-[#ef6b6b]', Icon: XCircle },
  incomplete: { label: { fr: 'Incomplet', en: 'Incomplete' }, cls: 'border-[#3A4242] bg-[#191E1E] text-[#A1A9A9]', Icon: RefreshCw },
  canceled: { label: { fr: 'Annulé', en: 'Canceled' }, cls: 'border-[#3A4242] bg-[#191E1E] text-[#A1A9A9]', Icon: Ban },
};

const fmtDate = (iso: string | null, lang: SignLang): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const fmtAmount = (cents: number | null, currency: string | null, lang: SignLang): string => {
  if (cents == null) return '—';
  const n = (cents / 100).toFixed(2);
  return `${lang === 'fr' ? n.replace('.', ',') : n} ${(currency || 'eur').toUpperCase()}`;
};

const EVENT_LABEL: Record<string, Record<SignLang, string>> = {
  paid: { fr: 'Échéance payée', en: 'Installment paid' },
  failed: { fr: 'Paiement échoué', en: 'Payment failed' },
  canceled: { fr: 'Abonnement annulé', en: 'Subscription canceled' },
};

export default function SignSubscriptionPanel({ contractId, signers }: { contractId: string; signers: SignSigner[] }) {
  const { lang } = useSignLang();
  const [events, setEvents] = useState<SignSubscriptionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const payers = signers.filter((s) => s.paymentRequired);
  const nameOf = (signerId: string | null) => {
    const s = signers.find((x) => x.id === signerId);
    return s ? s.name || `${lang === 'fr' ? 'Signataire' : 'Signer'} ${s.signerIndex}` : (lang === 'fr' ? 'Signataire' : 'Signer');
  };

  useEffect(() => {
    let active = true;
    if (!contractId) return;
    listSubscriptionEvents(contractId)
      .then((e) => active && setEvents(e))
      .catch((err) => console.error('[sign] suivi abonnement', err))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [contractId]);

  if (!payers.length) return null;

  const badge = (status: string | null) => {
    const s = (status && STATUS[status]) || STATUS.incomplete;
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}>
        <s.Icon className="h-3 w-3" /> {status ? s.label[lang] : (lang === 'fr' ? 'En attente' : 'Pending')}
      </span>
    );
  };

  return (
    <div className="mx-auto mt-4 max-w-4xl rounded-xl border border-[#3A4242] bg-[#222828] p-4 sm:p-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
        <RefreshCw className="h-4 w-4 text-[#F0B86E]" /> {lang === 'fr' ? 'Suivi des abonnements' : 'Subscription tracking'}
      </h3>

      {/* État courant par signataire payeur */}
      <div className="space-y-2">
        {payers.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#3A4242] bg-[#191E1E] px-3 py-2.5">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-white">{s.name || s.email || `Signataire ${s.signerIndex}`}</div>
              <div className="text-[11px] text-[#A1A9A9]">
                {s.lastPaymentAt
                  ? `${lang === 'fr' ? 'Dernier paiement : ' : 'Last payment: '}${fmtDate(s.lastPaymentAt, lang)}${s.lastPaymentStatus === 'failed' ? (lang === 'fr' ? ' (échec)' : ' (failed)') : ''}`
                  : (lang === 'fr' ? 'Aucun renouvellement enregistré' : 'No renewal recorded')}
              </div>
            </div>
            {badge(s.subscriptionStatus)}
          </div>
        ))}
      </div>

      {/* Historique des échéances */}
      <div className="mt-4">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">{lang === 'fr' ? 'Historique des paiements' : 'Payment history'}</div>
        {loading ? (
          <div className="flex items-center gap-2 px-1 py-3 text-xs text-[#A1A9A9]"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {lang === 'fr' ? 'Chargement…' : 'Loading…'}</div>
        ) : events.length === 0 ? (
          <p className="px-1 py-3 text-xs text-[#A1A9A9]">{lang === 'fr' ? "Aucune échéance enregistrée pour l'instant. Les renouvellements apparaîtront ici automatiquement." : 'No installment recorded yet. Renewals will appear here automatically.'}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[#3A4242]">
            <table className="w-full min-w-[460px] text-left text-xs">
              <thead className="bg-[#191E1E] text-[10px] uppercase tracking-wider text-[#A1A9A9]">
                <tr>
                  <th className="px-3 py-2 font-semibold">{lang === 'fr' ? 'Date' : 'Date'}</th>
                  <th className="px-3 py-2 font-semibold">{lang === 'fr' ? 'Signataire' : 'Signer'}</th>
                  <th className="px-3 py-2 font-semibold">{lang === 'fr' ? 'Événement' : 'Event'}</th>
                  <th className="px-3 py-2 text-right font-semibold">{lang === 'fr' ? 'Montant' : 'Amount'}</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-t border-[#3A4242]">
                    <td className="px-3 py-2 text-[#F3F4F6]">{fmtDate(e.occurredAt, lang)}</td>
                    <td className="px-3 py-2 text-[#A1A9A9]">{nameOf(e.signerId)}</td>
                    <td className="px-3 py-2">
                      <span className={e.type === 'paid' ? 'text-[#CEFF8F]' : e.type === 'failed' ? 'text-[#F0B86E]' : 'text-[#A1A9A9]'}>
                        {EVENT_LABEL[e.type]?.[lang] ?? e.type}
                        {e.billingReason === 'one_shot' ? (lang === 'fr' ? ' (unique)' : ' (one-off)') : ''}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-[#F3F4F6]">{e.type === 'canceled' ? '—' : fmtAmount(e.amountCents, e.currency, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
