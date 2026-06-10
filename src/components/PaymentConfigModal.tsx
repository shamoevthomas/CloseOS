import { useState } from 'react';
import { X, CreditCard, ExternalLink, Check } from 'lucide-react';
import { signerColor } from '../lib/signColors';

/**
 * Pop-up « Paiement » (DA Sign) — INDÉPENDANT de la vérification.
 * On active le mode payé, on configure le prix/les conditions (global au contrat), et on choisit
 * QUI paie : tout le monde, ou un signataire précis. Un signataire payeur peut aussi être soumis
 * à une vérification (SMS/email) : les deux axes coexistent.
 */
export type PaymentDraft = {
  mode: 'one_shot' | 'subscription';
  amount: number; // centimes
  interval: 'month' | 'quarter' | 'year';
  durationMonths: number | null; // null = à vie
  trialDays: number;
  tvaRate: number | null; // null = non assujetti
};
export type PayerScope = 'all' | number; // 'all' = tous les signataires, sinon l'index du signataire payeur

export default function PaymentConfigModal({
  open,
  enabled: initialEnabled,
  paymentInit,
  payerScope: initialScope,
  signers,
  stripeConnected,
  onConnectStripe,
  onClose,
  onConfirm,
}: {
  open: boolean;
  enabled: boolean;
  paymentInit: PaymentDraft | null;
  payerScope: PayerScope;
  signers: { index: number; label: string }[];
  stripeConnected: boolean;
  onConnectStripe: () => void;
  onClose: () => void;
  onConfirm: (v: { enabled: boolean; payment: PaymentDraft | null; payerScope: PayerScope }) => void;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [scope, setScope] = useState<PayerScope>(initialScope);
  const [payMode, setPayMode] = useState<'one_shot' | 'subscription'>(paymentInit?.mode || 'one_shot');
  const [payPrice, setPayPrice] = useState(paymentInit?.amount ? (paymentInit.amount / 100).toString() : '');
  const [payInterval, setPayInterval] = useState<'month' | 'quarter' | 'year'>(paymentInit?.interval || 'month');
  const [payForever, setPayForever] = useState(paymentInit ? paymentInit.durationMonths == null : true);
  const [payMonths, setPayMonths] = useState(paymentInit?.durationMonths ? String(paymentInit.durationMonths) : '12');
  const [payTrial, setPayTrial] = useState(paymentInit?.trialDays ? String(paymentInit.trialDays) : '0');
  const [payTva, setPayTva] = useState(paymentInit ? paymentInit.tvaRate != null : false);
  const [payTvaRate, setPayTvaRate] = useState(paymentInit?.tvaRate != null ? String(paymentInit.tvaRate) : '20');

  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setEnabled(initialEnabled);
      setScope(initialScope);
      setPayMode(paymentInit?.mode || 'one_shot');
      setPayPrice(paymentInit?.amount ? (paymentInit.amount / 100).toString() : '');
      setPayInterval(paymentInit?.interval || 'month');
      setPayForever(paymentInit ? paymentInit.durationMonths == null : true);
      setPayMonths(paymentInit?.durationMonths ? String(paymentInit.durationMonths) : '12');
      setPayTrial(paymentInit?.trialDays ? String(paymentInit.trialDays) : '0');
      setPayTva(paymentInit ? paymentInit.tvaRate != null : false);
      setPayTvaRate(paymentInit?.tvaRate != null ? String(paymentInit.tvaRate) : '20');
    }
  }
  if (!open) return null;

  const priceNum = parseFloat(payPrice.replace(',', '.'));
  const amountCents = Number.isFinite(priceNum) && priceNum > 0 ? Math.round(priceNum * 100) : 0;
  const tvaRate = payTva ? parseFloat(payTvaRate.replace(',', '.')) || 0 : null;
  const ttc = amountCents;
  const ht = tvaRate != null ? Math.round(ttc / (1 + tvaRate / 100)) : ttc;
  const tvaAmt = ttc - ht;
  const fmt = (cts: number) => (cts / 100).toFixed(2).replace('.', ',') + ' €';
  const payValid = amountCents > 0 && (payMode === 'one_shot' || (!payForever ? (parseInt(payMonths) || 0) > 0 : true));
  const buildPayment = (): PaymentDraft => ({
    mode: payMode,
    amount: amountCents,
    interval: payInterval,
    durationMonths: payMode === 'subscription' && !payForever ? parseInt(payMonths) || 1 : null,
    trialDays: payMode === 'subscription' ? Math.max(0, parseInt(payTrial) || 0) : 0,
    tvaRate,
  });

  const seg = (active: boolean) =>
    `flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${active ? 'border-[#F0B86E] bg-[#F0B86E]/10 text-white' : 'border-[#3A4242] bg-[#191E1E] text-[#A1A9A9] hover:border-[#A1A9A9]'}`;
  const multi = signers.length > 1;
  const canSave = !enabled || payValid;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#3A4242] bg-[#222828] p-6 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">Payé + signé</h3>
          <button onClick={onClose} className="text-[#A1A9A9] transition-colors hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <p className="mb-4 text-xs leading-relaxed text-[#A1A9A9]">Demandez un paiement à la signature. Indépendant de la vérification (un signataire peut payer ET vérifier par SMS).</p>

        {/* Interrupteur activer le paiement */}
        <button
          onClick={() => setEnabled((v) => !v)}
          className={`flex w-full items-center justify-between rounded-xl border p-3.5 text-left transition-colors ${enabled ? 'border-[#F0B86E] bg-[#F0B86E]/10' : 'border-[#3A4242] bg-[#191E1E] hover:border-[#A1A9A9]'}`}
        >
          <span className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: enabled ? '#F0B86E' : '#2c3232', color: enabled ? '#191E1E' : '#A1A9A9' }}>
              <CreditCard className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold text-[#F3F4F6]">Activer le paiement</span>
          </span>
          <span className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${enabled ? 'bg-[#F0B86E]' : 'bg-[#3A4242]'}`}>
            <span className={`h-4 w-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-4' : ''}`} />
          </span>
        </button>

        {enabled && !stripeConnected && (
          <div className="mt-4 rounded-xl border border-[#3A4242] bg-[#191E1E] p-5 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#F0B86E]/10">
              <CreditCard className="h-6 w-6 text-[#F0B86E]" />
            </div>
            <p className="text-sm leading-relaxed text-[#A1A9A9]">Connecte ton compte Stripe pour encaisser les paiements. L’argent arrive directement sur ton compte.</p>
            <button onClick={onConnectStripe} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#F0B86E] px-4 py-2.5 text-sm font-bold text-[#191E1E] transition-colors hover:opacity-90">
              <ExternalLink className="h-4 w-4" /> Connecter mon Stripe
            </button>
          </div>
        )}

        {enabled && stripeConnected && (
          <div className="mt-4 space-y-4">
            {/* Qui paie ? */}
            {multi && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#A1A9A9]">Qui doit payer ?</label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setScope('all')}
                    className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors"
                    style={scope === 'all' ? { borderColor: '#F0B86E', background: '#F0B86E1a', color: '#fff' } : { borderColor: '#3A4242', color: '#A1A9A9' }}
                  >
                    Tout le monde
                  </button>
                  {signers.map((s) => {
                    const active = scope === s.index;
                    const c = signerColor(s.index);
                    return (
                      <button
                        key={s.index}
                        onClick={() => setScope(s.index)}
                        className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors"
                        style={active ? { borderColor: c, background: `${c}1a`, color: '#fff' } : { borderColor: '#3A4242', color: '#A1A9A9' }}
                      >
                        <span className="h-2 w-2 rounded-full" style={{ background: c }} />
                        {s.label}
                        {active && <Check className="h-3 w-3" style={{ color: c }} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Prix */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#A1A9A9]">Prix (€)</label>
              <input type="number" inputMode="decimal" min="0" step="0.01" value={payPrice} onChange={(e) => setPayPrice(e.target.value)} placeholder="0,00" className="w-full rounded-lg border border-[#3A4242] bg-[#191E1E] px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-[#A1A9A9]/40 focus:border-[#F0B86E]" />
            </div>
            {/* Mode */}
            <div className="flex gap-2">
              <button onClick={() => setPayMode('one_shot')} className={seg(payMode === 'one_shot')}>Paiement unique</button>
              <button onClick={() => setPayMode('subscription')} className={seg(payMode === 'subscription')}>Abonnement</button>
            </div>

            {payMode === 'subscription' && (
              <>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#A1A9A9]">Fréquence</label>
                  <div className="flex gap-2">
                    <button onClick={() => setPayInterval('month')} className={seg(payInterval === 'month')}>Mensuel</button>
                    <button onClick={() => setPayInterval('quarter')} className={seg(payInterval === 'quarter')}>Trimestriel</button>
                    <button onClick={() => setPayInterval('year')} className={seg(payInterval === 'year')}>Annuel</button>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#A1A9A9]">Durée</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPayForever(true)} className={seg(payForever)}>À vie</button>
                    <button onClick={() => setPayForever(false)} className={seg(!payForever)}>Limitée</button>
                    {!payForever && (
                      <div className="flex items-center gap-1">
                        <input type="number" min="1" value={payMonths} onChange={(e) => setPayMonths(e.target.value)} className="w-16 rounded-lg border border-[#3A4242] bg-[#191E1E] px-2 py-2 text-center text-sm text-white outline-none focus:border-[#F0B86E]" />
                        <span className="text-xs text-[#A1A9A9]">mois</span>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#A1A9A9]">Essai gratuit</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min="0" value={payTrial} onChange={(e) => setPayTrial(e.target.value)} className="w-20 rounded-lg border border-[#3A4242] bg-[#191E1E] px-3 py-2 text-sm text-white outline-none focus:border-[#F0B86E]" />
                    <span className="text-xs text-[#A1A9A9]">jours (0 = aucun)</span>
                  </div>
                </div>
              </>
            )}

            {/* TVA */}
            <div>
              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-[#A1A9A9]">
                <input type="checkbox" checked={payTva} onChange={(e) => setPayTva(e.target.checked)} className="accent-[#F0B86E]" />
                Soumis à la TVA
              </label>
              {payTva && (
                <div className="mt-2 flex items-center gap-2">
                  <input type="number" min="0" step="0.1" value={payTvaRate} onChange={(e) => setPayTvaRate(e.target.value)} className="w-20 rounded-lg border border-[#3A4242] bg-[#191E1E] px-3 py-2 text-sm text-white outline-none focus:border-[#F0B86E]" />
                  <span className="text-xs text-[#A1A9A9]">% (sinon : non assujetti)</span>
                </div>
              )}
            </div>

            {amountCents > 0 && (
              <div className="rounded-xl border border-[#3A4242] bg-[#191E1E] p-3 text-xs text-[#A1A9A9]">
                <div className="flex justify-between"><span>{payMode === 'subscription' ? 'Montant par échéance' : 'Montant'}</span><span className="font-semibold text-[#F3F4F6]">{fmt(ttc)}</span></div>
                {tvaRate != null && <div className="mt-1 flex justify-between"><span>dont TVA {tvaRate}%</span><span>{fmt(tvaAmt)} (HT {fmt(ht)})</span></div>}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-[#3A4242] py-2.5 text-sm font-medium text-[#A1A9A9] transition-colors hover:border-[#A1A9A9] hover:text-white">Annuler</button>
          <button
            disabled={!canSave}
            onClick={() => onConfirm({ enabled, payment: enabled ? buildPayment() : null, payerScope: scope })}
            className="flex-1 rounded-lg bg-[#F0B86E] py-2.5 text-sm font-bold text-[#191E1E] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
