import { useState } from 'react';
import { X, ShieldOff, Mail, MessageSquare, ShieldCheck, Check, Plus } from 'lucide-react';
import { isValidEmail } from '../lib/signFieldsMeta';
import { signerColor } from '../lib/signColors';
import PhoneInput from './PhoneInput';

/**
 * Pop-up « Style de vérification » (DA Sign). La MÉTHODE est globale au contrat :
 *  none | email | sms | email_sms. Le paiement est géré séparément (PaymentConfigModal).
 * Les WHITELISTS sont PAR SIGNATAIRE : chaque signataire a ses propres emails/numéros/couples
 * autorisés (sécurité : un signataire ne peut pas utiliser le code d'un autre).
 */
export type VerifMethod = 'none' | 'email' | 'sms' | 'email_sms' | 'pay';
export type VerifPair = { email: string; phone: string };

export type SignerWL = { index: number; label: string; emails: string[]; phones: string[]; pairs: VerifPair[] };

const OPTIONS: { key: Exclude<VerifMethod, 'pay'>; Icon: typeof Mail; title: string; desc: string }[] = [
  { key: 'none', Icon: ShieldOff, title: 'Sans vérification', desc: 'Le signataire signe directement (flux actuel).' },
  { key: 'email', Icon: Mail, title: 'Vérification par email', desc: 'Code envoyé à l’adresse autorisée. Saisie obligatoire pour signer.' },
  { key: 'sms', Icon: MessageSquare, title: 'Vérification par SMS', desc: 'Code envoyé par SMS au numéro autorisé.' },
  { key: 'email_sms', Icon: ShieldCheck, title: 'Vérification email + SMS', desc: 'Double vérification : email PUIS SMS du même couple.' },
];

const normPhone = (s: string) => s.replace(/[^\d+]/g, '');
const isLikelyPhone = (s: string) => /^\+?\d{8,15}$/.test(normPhone(s));

export default function VerificationStyleModal({
  open,
  method: initialMethod,
  signers: initialSigners,
  onClose,
  onConfirm,
}: {
  open: boolean;
  method: VerifMethod;
  signers: SignerWL[]; // une entrée par signataire, avec ses whitelists
  onClose: () => void;
  onConfirm: (v: { method: Exclude<VerifMethod, 'pay'>; signers: SignerWL[] }) => void;
}) {
  const norm = (m: VerifMethod): Exclude<VerifMethod, 'pay'> => (m === 'pay' ? 'none' : m);
  const [method, setMethod] = useState<Exclude<VerifMethod, 'pay'>>(norm(initialMethod));
  const [list, setList] = useState<SignerWL[]>(initialSigners);
  const [tab, setTab] = useState<number>(initialSigners[0]?.index ?? 1);
  const [draftEmail, setDraftEmail] = useState('');
  const [draftPhone, setDraftPhone] = useState('');
  const [pairEmail, setPairEmail] = useState('');
  const [pairPhone, setPairPhone] = useState('');

  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setMethod(norm(initialMethod));
      setList(initialSigners.map((s) => ({ ...s, emails: [...s.emails], phones: [...s.phones], pairs: [...s.pairs] })));
      setTab(initialSigners[0]?.index ?? 1);
      setDraftEmail('');
      setDraftPhone('');
      setPairEmail('');
      setPairPhone('');
    }
  }

  if (!open) return null;

  const cur = list.find((s) => s.index === tab) ?? list[0];
  const multi = list.length > 1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patchCur = (patch: Partial<SignerWL>) => setList((prev) => prev.map((s) => (s.index === cur.index ? { ...s, ...patch } : s)));

  // ── ajouts (sur le signataire actif) ──
  const draftEmailValid = isValidEmail(draftEmail);
  const addEmail = () => {
    const e = draftEmail.trim();
    if (!isValidEmail(e) || !cur) return;
    if (!cur.emails.some((x) => x.toLowerCase() === e.toLowerCase())) patchCur({ emails: [...cur.emails, e] });
    setDraftEmail('');
  };
  const draftPhoneValid = isLikelyPhone(draftPhone);
  const addPhone = () => {
    const p = draftPhone.trim();
    if (!isLikelyPhone(p) || !cur) return;
    if (!cur.phones.some((x) => normPhone(x) === normPhone(p))) patchCur({ phones: [...cur.phones, p] });
    setDraftPhone('');
  };
  const pairReady = isValidEmail(pairEmail) && isLikelyPhone(pairPhone);
  const addPair = () => {
    if (!pairReady || !cur) return;
    const e = pairEmail.trim();
    if (!cur.pairs.some((x) => x.email.toLowerCase() === e.toLowerCase())) patchCur({ pairs: [...cur.pairs, { email: e, phone: pairPhone.trim() }] });
    setPairEmail('');
    setPairPhone('');
  };

  // Plie les drafts en cours dans le signataire actif (au moment de confirmer)
  const foldDrafts = (arr: SignerWL[]): SignerWL[] =>
    arr.map((s) => {
      if (s.index !== cur?.index) return s;
      const out = { ...s, emails: [...s.emails], phones: [...s.phones], pairs: [...s.pairs] };
      const e = draftEmail.trim();
      if (method === 'email' && e && isValidEmail(e) && !out.emails.some((x) => x.toLowerCase() === e.toLowerCase())) out.emails.push(e);
      const p = draftPhone.trim();
      if (method === 'sms' && p && isLikelyPhone(p) && !out.phones.some((x) => normPhone(x) === normPhone(p))) out.phones.push(p);
      const pe = pairEmail.trim();
      if (method === 'email_sms' && pairReady && !out.pairs.some((x) => x.email.toLowerCase() === pe.toLowerCase())) out.pairs.push({ email: pe, phone: pairPhone.trim() });
      return out;
    });

  const count = (s: SignerWL): number => (method === 'email' ? s.emails.length : method === 'sms' ? s.phones.length : method === 'email_sms' ? s.pairs.length : 0);
  const folded = foldDrafts(list);
  // Tous les signataires doivent avoir au moins une entrée (sinon non vérifiable → ne peut pas signer).
  const canConfirm = method === 'none' || folded.every((s) => count(s) > 0);

  const chip = (label: string, onRemove: () => void, key: string) => (
    <span key={key} className="flex items-center gap-1.5 rounded-lg border border-[#3A4242] bg-[#222828] px-2.5 py-1 text-xs text-[#F3F4F6]">
      {label}
      <button onClick={onRemove} className="text-[#A1A9A9] transition-colors hover:text-[#ef6b6b]" title="Retirer">
        <X className="h-3 w-3" />
      </button>
    </span>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#3A4242] bg-[#222828] p-6 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">Style de vérification</h3>
          <button onClick={onClose} className="text-[#A1A9A9] transition-colors hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-5 text-xs leading-relaxed text-[#A1A9A9]">Comment chaque signataire doit-il prouver son identité avant de signer ce document ?</p>

        <div className="space-y-2.5">
          {OPTIONS.map((o) => {
            const selected = method === o.key;
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => setMethod(o.key)}
                className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${selected ? 'border-[#CEFF8F] bg-[#CEFF8F]/10' : 'border-[#3A4242] bg-[#191E1E] hover:border-[#A1A9A9]'}`}
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: selected ? '#CEFF8F' : '#2c3232', color: selected ? '#191E1E' : '#A1A9A9' }}>
                  <o.Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-sm font-semibold text-[#F3F4F6]">{o.title}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-[#A1A9A9]">{o.desc}</span>
                </span>
                {selected && <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#CEFF8F]" />}
              </button>
            );
          })}
        </div>

        {/* Whitelists par signataire */}
        {method !== 'none' && cur && (
          <div className="mt-4 rounded-xl border border-[#3A4242] bg-[#191E1E] p-3.5">
            {multi && (
              <>
                <label className="mb-1.5 block text-xs font-medium text-[#A1A9A9]">Signataire concerné</label>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {list.map((s) => {
                    const active = s.index === tab;
                    const c = signerColor(s.index);
                    return (
                      <button
                        key={s.index}
                        onClick={() => setTab(s.index)}
                        className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors"
                        style={active ? { borderColor: c, background: `${c}1a`, color: '#fff' } : { borderColor: '#3A4242', color: '#A1A9A9' }}
                      >
                        <span className="h-2 w-2 rounded-full" style={{ background: c }} />
                        {s.label}
                        {count(s) > 0 && <Check className="h-3 w-3" style={{ color: c }} />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {method === 'email' && (
              <>
                <label className="mb-1.5 block text-xs font-medium text-[#A1A9A9]">Emails autorisés{multi ? ` — ${cur.label}` : ''}</label>
                {cur.emails.length > 0 && <div className="mb-2 flex flex-wrap gap-1.5">{cur.emails.map((e, i) => chip(e, () => patchCur({ emails: cur.emails.filter((_, k) => k !== i) }), `${e}-${i}`))}</div>}
                <div className="flex gap-2">
                  <input type="email" value={draftEmail} onChange={(e) => setDraftEmail(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addEmail(); } }} placeholder="signataire@exemple.fr" className="min-w-0 flex-1 rounded-lg border border-[#3A4242] bg-[#222828] px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-[#A1A9A9]/40 focus:border-[#CEFF8F]" />
                  <button type="button" onClick={addEmail} disabled={!draftEmailValid} className="flex shrink-0 items-center gap-1 rounded-lg border border-[#3A4242] px-3 text-xs font-medium text-[#A1A9A9] transition-colors hover:border-[#A1A9A9] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"><Plus className="h-3.5 w-3.5" /> Ajouter</button>
                </div>
              </>
            )}

            {method === 'sms' && (
              <>
                <label className="mb-1.5 block text-xs font-medium text-[#A1A9A9]">Numéros autorisés{multi ? ` — ${cur.label}` : ''}</label>
                {cur.phones.length > 0 && <div className="mb-2 flex flex-wrap gap-1.5">{cur.phones.map((p, i) => chip(p, () => patchCur({ phones: cur.phones.filter((_, k) => k !== i) }), `${p}-${i}`))}</div>}
                <div className="flex gap-2">
                  <div className="min-w-0 flex-1"><PhoneInput value={draftPhone} onChange={setDraftPhone} variant="dark" /></div>
                  <button type="button" onClick={addPhone} disabled={!draftPhoneValid} className="flex shrink-0 items-center gap-1 rounded-lg border border-[#3A4242] px-3 text-xs font-medium text-[#A1A9A9] transition-colors hover:border-[#A1A9A9] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"><Plus className="h-3.5 w-3.5" /> Ajouter</button>
                </div>
              </>
            )}

            {method === 'email_sms' && (
              <>
                <label className="mb-1.5 block text-xs font-medium text-[#A1A9A9]">Couples autorisés (email + numéro){multi ? ` — ${cur.label}` : ''}</label>
                {cur.pairs.length > 0 && (
                  <div className="mb-2 space-y-1.5">
                    {cur.pairs.map((p, i) => (
                      <div key={`${p.email}-${i}`} className="flex items-center justify-between gap-2 rounded-lg border border-[#3A4242] bg-[#222828] px-2.5 py-1.5 text-xs text-[#F3F4F6]">
                        <span className="min-w-0 truncate">{p.email} · {p.phone}</span>
                        <button onClick={() => patchCur({ pairs: cur.pairs.filter((_, k) => k !== i) })} className="shrink-0 text-[#A1A9A9] transition-colors hover:text-[#ef6b6b]" title="Retirer"><X className="h-3 w-3" /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="space-y-2">
                  <input type="email" value={pairEmail} onChange={(e) => setPairEmail(e.target.value)} placeholder="email@exemple.fr" className="w-full rounded-lg border border-[#3A4242] bg-[#222828] px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-[#A1A9A9]/40 focus:border-[#CEFF8F]" />
                  <div className="flex gap-2">
                    <div className="min-w-0 flex-1"><PhoneInput value={pairPhone} onChange={setPairPhone} variant="dark" /></div>
                    <button type="button" onClick={addPair} disabled={!pairReady} className="flex shrink-0 items-center gap-1 rounded-lg border border-[#3A4242] px-3 text-xs font-medium text-[#A1A9A9] transition-colors hover:border-[#A1A9A9] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"><Plus className="h-3.5 w-3.5" /> Ajouter</button>
                  </div>
                </div>
              </>
            )}
            {multi && !canConfirm && <p className="mt-2.5 text-[11px] text-amber-400">Chaque signataire doit avoir au moins une entrée autorisée.</p>}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-[#3A4242] py-2.5 text-sm font-medium text-[#A1A9A9] transition-colors hover:border-[#A1A9A9] hover:text-white">Annuler</button>
          <button
            disabled={!canConfirm}
            onClick={() => onConfirm({ method, signers: foldDrafts(list) })}
            className="flex-1 rounded-lg bg-[#CEFF8F] py-2.5 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}
