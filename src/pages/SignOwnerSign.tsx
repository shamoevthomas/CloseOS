import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ShieldCheck, Loader2, CheckCircle2, Mail, PenTool, AlertTriangle } from 'lucide-react';
import { SignLogo } from '../components/SignLogo';
import SignatureModal from '../components/SignatureModal';
import { useSignLang } from '../contexts/SignLangContext';

/**
 * Page d'autorisation de signature PROPRIÉTAIRE (lien créé par le MCP).
 * Flux : code email → vérification → capture de signature (initiales/dessin/image) → prêt.
 * Une fois « prêt », l'outil MCP sign_owner_sign applique la signature aux champs 'owner'.
 */

type Phase = 'loading' | 'code' | 'sign' | 'done' | 'error';

async function api(action: string, token: string, extra?: any) {
  const r = await fetch('/api/sign-owner', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, token, ...(extra || {}) }),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

export default function SignOwnerSign() {
  const { token = '' } = useParams();
  const { lang } = useSignLang();
  const [phase, setPhase] = useState<Phase>('loading');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [contracts, setContracts] = useState<Array<{ id: string; title: string; status: string }>>([]);
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [showSig, setShowSig] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    document.title = lang === 'fr' ? 'Signer mes contrats | CloseOS Sign' : 'Sign my contracts | CloseOS Sign';
  }, [lang]);

  useEffect(() => {
    if (started.current || !token) return;
    started.current = true;
    (async () => {
      const g = await api('get', token);
      if (!g.ok) { setErr(g.data?.error === 'expired' ? (lang === 'fr' ? 'Ce lien a expiré.' : 'This link has expired.') : (lang === 'fr' ? 'Lien invalide ou déjà utilisé.' : 'Invalid or already used link.')); setPhase('error'); return; }
      setMaskedEmail(g.data.masked_email || '');
      setContracts(g.data.contracts || []);
      if (g.data.status === 'ready') { setPhase('done'); return; }
      const sc = await api('send-code', token);
      if (!sc.ok) { setErr(lang === 'fr' ? "Impossible d'envoyer le code." : 'Could not send the code.'); setPhase('error'); return; }
      setResendIn(30);
      setPhase('code');
    })();
  }, [token, lang]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const verify = async () => {
    if (code.length !== 6) return;
    setBusy(true); setErr('');
    const r = await api('verify-code', token, { code });
    setBusy(false);
    if (r.ok && r.data.ok) { setPhase('sign'); return; }
    const e = r.data?.error;
    setErr(
      e === 'expired' ? (lang === 'fr' ? 'Code expiré, renvoie un nouveau code.' : 'Code expired, resend a new one.')
      : e === 'too_many' ? (lang === 'fr' ? 'Trop de tentatives.' : 'Too many attempts.')
      : (lang === 'fr' ? `Code incorrect${typeof r.data?.attempts_left === 'number' ? ` (${r.data.attempts_left} essai(s) restant(s))` : ''}.` : `Incorrect code${typeof r.data?.attempts_left === 'number' ? ` (${r.data.attempts_left} attempt(s) left)` : ''}.`),
    );
    setCode('');
  };

  const resend = async () => {
    if (resendIn > 0) return;
    setErr('');
    const r = await api('send-code', token);
    if (r.ok) setResendIn(30);
  };

  const onSignature = async (value: string) => {
    setShowSig(false);
    setBusy(true); setErr('');
    const kind = value.startsWith('data:') ? 'image' : 'text';
    const r = await api('submit-signature', token, { signature_value: value, signature_kind: kind });
    setBusy(false);
    if (r.ok && r.data.ok) setPhase('done');
    else { setErr(lang === 'fr' ? "Échec de l'enregistrement de la signature." : 'Failed to save signature.'); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#191E1E] px-4 py-10 font-sans text-[#F3F4F6]">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center"><SignLogo className="text-xl" /></div>

        <div className="rounded-2xl border border-[#3A4242] bg-[#222828] p-6 shadow-2xl sm:p-8">
          {phase === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-8 text-[#A1A9A9]">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-sm">{lang === 'fr' ? 'Chargement…' : 'Loading…'}</span>
            </div>
          )}

          {phase === 'error' && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ef6b6b]/15"><AlertTriangle className="h-7 w-7 text-[#ef6b6b]" /></div>
              <h1 className="text-lg font-semibold text-white">{lang === 'fr' ? 'Lien indisponible' : 'Link unavailable'}</h1>
              <p className="text-sm text-[#A1A9A9]">{err}</p>
            </div>
          )}

          {phase === 'code' && (
            <div>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#CEFF8F]/15"><Mail className="h-6 w-6 text-[#CEFF8F]" /></div>
              <h1 className="text-xl font-semibold text-white">{lang === 'fr' ? 'Autorise ta signature' : 'Authorize your signature'}</h1>
              <p className="mt-1.5 text-sm text-[#A1A9A9]">
                {lang === 'fr' ? 'Un code à 6 chiffres a été envoyé à ' : 'A 6-digit code was sent to '}<span className="font-medium text-white">{maskedEmail}</span>.
              </p>
              {contracts.length > 0 && (
                <p className="mt-2 text-xs text-[#A1A9A9]">{lang === 'fr' ? `${contracts.length} contrat(s) à signer.` : `${contracts.length} contract(s) to sign.`}</p>
              )}
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => e.key === 'Enter' && verify()}
                inputMode="numeric"
                placeholder="000000"
                className="mt-5 w-full rounded-lg border border-[#3A4242] bg-[#191E1E] px-4 py-3 text-center text-2xl font-bold tracking-[0.4em] text-white outline-none focus:border-[#CEFF8F]"
              />
              {err && <p className="mt-2 text-sm text-[#ef6b6b]">{err}</p>}
              <button
                onClick={verify}
                disabled={code.length !== 6 || busy}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#CEFF8F] py-3 text-sm font-bold text-[#191E1E] transition-opacity disabled:opacity-40"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} {lang === 'fr' ? 'Valider' : 'Verify'}
              </button>
              <button onClick={resend} disabled={resendIn > 0} className="mt-3 w-full text-center text-xs text-[#A1A9A9] hover:text-white disabled:opacity-50">
                {resendIn > 0 ? (lang === 'fr' ? `Renvoyer le code (${resendIn}s)` : `Resend code (${resendIn}s)`) : (lang === 'fr' ? 'Renvoyer le code' : 'Resend code')}
              </button>
            </div>
          )}

          {phase === 'sign' && (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#CEFF8F]/15"><PenTool className="h-6 w-6 text-[#CEFF8F]" /></div>
              <h1 className="text-xl font-semibold text-white">{lang === 'fr' ? 'Ta signature' : 'Your signature'}</h1>
              <p className="mt-1.5 text-sm text-[#A1A9A9]">{lang === 'fr' ? 'Choisis comment signer : initiales, dessin ou image.' : 'Choose how to sign: initials, drawing or image.'}</p>
              {err && <p className="mt-3 text-sm text-[#ef6b6b]">{err}</p>}
              <button
                onClick={() => setShowSig(true)}
                disabled={busy}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#CEFF8F] py-3 text-sm font-bold text-[#191E1E] transition-opacity disabled:opacity-40"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenTool className="h-4 w-4" />} {lang === 'fr' ? 'Créer ma signature' : 'Create my signature'}
              </button>
            </div>
          )}

          {phase === 'done' && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#CEFF8F]/15"><CheckCircle2 className="h-8 w-8 text-[#CEFF8F]" /></div>
              <h1 className="text-xl font-semibold text-white">{lang === 'fr' ? 'Signature enregistrée' : 'Signature saved'}</h1>
              <p className="text-sm text-[#A1A9A9]">
                {lang === 'fr'
                  ? 'Tu peux retourner sur Claude et lui demander de signer. Il appliquera ta signature à tes contrats.'
                  : 'You can go back to Claude and ask it to sign. It will apply your signature to your contracts.'}
              </p>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] text-[#6B7280]">
          {lang === 'fr' ? 'Signature sécurisée · CloseOS Sign' : 'Secure signing · CloseOS Sign'}
        </p>
      </div>

      <SignatureModal open={showSig} onClose={() => setShowSig(false)} onConfirm={onSignature} />
    </div>
  );
}
