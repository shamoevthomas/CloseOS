import { useState, useRef, useEffect } from 'react';
import { ShieldCheck, Loader2, AlertCircle, ArrowLeft, Smartphone, Mail } from 'lucide-react';
import { sendDeviceCode, verifyDeviceCode } from '../lib/signDevice';
import { SignLogo } from './SignLogo';

/**
 * CloseOS Sign — vérification d'appareil (2FA) à la connexion (DA Sign : dark + lime).
 * Envoie un code 6 chiffres par email à l'ouverture, le vérifie, puis mémorise l'appareil (7 j).
 */

interface Props {
  userId: string;
  email: string;
  authMethod: 'google' | 'classic';
  onVerified: () => void;
  onCancel: () => void;
}

const maskEmail = (e: string) => e.replace(/^(.{2})(.*)(@.*)$/, (_, a, m, d) => a + '*'.repeat(Math.min(m.length, 6)) + d);

export default function SignVerification({ userId, email, authMethod, onVerified, onCancel }: Props) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resend, setResend] = useState(0);
  const [smsSent, setSmsSent] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const sentRef = useRef(false);

  // Envoi du code à l'ouverture (une fois).
  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;
    (async () => {
      const r = await sendDeviceCode(userId);
      if (r.ok) setResend(60);
      else setError("Impossible d'envoyer le code. Réessayez.");
    })();
  }, [userId]);

  useEffect(() => {
    if (resend <= 0) return;
    const t = setTimeout(() => setResend(resend - 1), 1000);
    return () => clearTimeout(t);
  }, [resend]);

  const submit = async (full: string) => {
    setLoading(true);
    setError(null);
    const r = await verifyDeviceCode(userId, full, authMethod);
    setLoading(false);
    if (r.ok) onVerified();
    else {
      setError('Code invalide ou expiré.');
      setCode(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    }
  };

  const onInput = (i: number, v: string) => {
    if (!/^\d*$/.test(v)) return;
    const next = [...code];
    next[i] = v.slice(-1);
    setCode(next);
    setError(null);
    if (v && i < 5) inputs.current[i + 1]?.focus();
    if (next.every((d) => d !== '')) submit(next.join(''));
  };

  const onKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[i] && i > 0) inputs.current[i - 1]?.focus();
  };

  const onPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (p.length === 6) {
      setCode(p.split(''));
      inputs.current[5]?.focus();
      submit(p);
    }
  };

  const resendCode = async () => {
    if (resend > 0 || loading) return;
    setError(null);
    setCode(['', '', '', '', '', '']);
    const r = await sendDeviceCode(userId);
    if (r.ok) { setSmsSent(null); setResend(60); }
    else setError("Impossible de renvoyer le code.");
  };

  // Secours : envoie le code par SMS (au numéro du compte) quand l'email n'arrive pas.
  const sendBySms = async () => {
    if (sending || loading) return;
    setError(null);
    setSending(true);
    setCode(['', '', '', '', '', '']);
    const r = await sendDeviceCode(userId, 'sms');
    setSending(false);
    if (r.ok) { setSmsSent(r.masked || '•••'); setResend(60); inputs.current[0]?.focus(); }
    else setError(r.error === 'no_phone' ? 'Aucun numéro enregistré pour ce compte. Contactez support@closeos.fr.' : "Impossible d'envoyer le SMS. Réessayez ou contactez le support.");
  };

  // Repasse au canal email (depuis le mode SMS).
  const sendByEmail = async () => {
    if (sending || loading) return;
    setError(null);
    setSending(true);
    setCode(['', '', '', '', '', '']);
    const r = await sendDeviceCode(userId);
    setSending(false);
    if (r.ok) { setSmsSent(null); setResend(60); inputs.current[0]?.focus(); }
    else setError("Impossible d'envoyer l'email. Réessayez ou contactez le support.");
  };

  return (
    <div className="sign-landing relative flex min-h-screen items-center justify-center overflow-hidden bg-[#191E1E] px-4 py-8 font-sans text-[#F3F4F6] antialiased selection:bg-[#CEFF8F] selection:text-[#191E1E] sm:px-6 sm:py-12">
      <style>{`.sign-landing { font-family: "SF Pro Display","Helvetica Neue",Helvetica,Arial,Inter,sans-serif; }`}</style>
      <div className="pointer-events-none absolute left-1/2 top-1/4 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-[#CEFF8F]/5 blur-[120px]" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex items-center justify-center">
          <SignLogo className="text-lg" />
        </div>

        <div className="rounded border border-[#3A4242] bg-[#222828] p-6 shadow-2xl sm:p-8">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-[#3A4242] bg-[#191E1E]">
              <ShieldCheck className="h-5 w-5 text-[#CEFF8F]" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Vérifiez cette connexion</h1>
            <p className="mt-2 text-sm leading-relaxed text-[#A1A9A9]">
              Nouvel appareil détecté. Un code à 6 chiffres a été envoyé {smsSent ? 'par SMS au' : 'à'}<br />
              <span className="font-medium text-[#F3F4F6]">{smsSent || maskEmail(email)}</span>
            </p>
          </div>

          <div className="flex justify-center gap-2" onPaste={onPaste}>
            {code.map((d, i) => (
              <input
                key={i}
                ref={(el) => { inputs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                autoFocus={i === 0}
                disabled={loading}
                onChange={(e) => onInput(i, e.target.value)}
                onKeyDown={(e) => onKeyDown(i, e)}
                className="h-14 min-w-0 flex-1 rounded border border-[#3A4242] bg-[#191E1E] text-center text-2xl font-bold text-white outline-none transition-all focus:border-[#CEFF8F] focus:ring-1 focus:ring-[#CEFF8F] disabled:opacity-50 sm:w-12 sm:flex-none"
              />
            ))}
          </div>

          {error && (
            <div className="mt-5 flex items-center gap-2 rounded border border-[#ef6b6b]/30 bg-[#ef6b6b]/10 px-3 py-2 text-xs text-[#ef6b6b]">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {loading && (
            <div className="mt-5 flex items-center justify-center gap-2 text-xs text-[#A1A9A9]">
              <Loader2 className="h-4 w-4 animate-spin" /> Vérification…
            </div>
          )}

          <div className="mt-7 text-center">
            <button
              type="button"
              onClick={resendCode}
              disabled={resend > 0 || loading}
              className="text-xs font-semibold text-[#CEFF8F] transition-colors hover:text-[#A0E7EC] disabled:text-[#A1A9A9] disabled:opacity-60"
            >
              {resend > 0 ? `Renvoyer le code (${resend}s)` : 'Renvoyer le code'}
            </button>
          </div>

          {/* Secours : bascule SMS ⇆ email + aide */}
          <div className="mt-5 border-t border-[#3A4242] pt-4 text-center">
            <p className="text-[11px] text-[#A1A9A9]">
              {smsSent ? 'Vous ne recevez pas le SMS ?' : 'Vous ne recevez pas le code ? Pensez à vérifier vos spams.'}
            </p>
            {smsSent ? (
              <button
                type="button"
                onClick={sendByEmail}
                disabled={sending || loading}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#A0E7EC] transition-colors hover:text-[#CEFF8F] disabled:opacity-60"
              >
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                Recevoir le code par e-mail
              </button>
            ) : (
              <button
                type="button"
                disabled
                title="Indisponible temporairement"
                className="mt-2 inline-flex cursor-not-allowed items-center gap-1.5 text-xs font-semibold text-[#A1A9A9] opacity-50"
              >
                <Smartphone className="h-3.5 w-3.5" />
                Recevoir le code par SMS — indisponible temporairement
              </button>
            )}
            <p className="mt-2 text-[10px] text-[#A1A9A9]">
              Toujours rien ? <a href="mailto:support@closeos.fr" className="text-[#CEFF8F] hover:underline">support@closeos.fr</a>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="mt-5 flex w-full items-center justify-center gap-1.5 text-xs text-[#A1A9A9] transition-colors hover:text-[#F3F4F6]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Utiliser un autre compte
        </button>

        <div className="mt-6 flex items-center justify-center gap-2 text-[10px] text-[#A1A9A9]">
          <ShieldCheck className="h-3.5 w-3.5 text-[#CEFF8F]" />
          <span>Appareil mémorisé 7 jours après vérification</span>
        </div>
      </div>
    </div>
  );
}
