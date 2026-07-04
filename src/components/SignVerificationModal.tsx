import { useEffect, useRef, useState } from 'react';
import { X, ShieldCheck, Loader2, Mail, MessageSquare, ChevronLeft } from 'lucide-react';
import { signSupabase as supabase } from '../lib/signSupabase';
import { isValidEmail } from '../lib/signFieldsMeta';
import PhoneInput from './PhoneInput';
import { useSignLang } from '../contexts/SignLangContext';

/**
 * Vérification d'identité du signataire (DA Sign), 1 ou plusieurs canaux SÉQUENTIELS.
 * Pour chaque canal (email puis sms) : le signataire saisit sa destination → l'Edge Function
 * vérifie qu'elle est autorisée (et, en email+SMS, que le numéro appartient au couple de l'email
 * vérifié) → code à 6 chiffres → saisie. Quand tous les canaux sont validés → onVerified({email,phone}).
 */
type Channel = 'email' | 'sms';
const normPhone = (s: string) => s.replace(/[^\d+]/g, '');
const isLikelyPhone = (s: string) => /^\+?\d{8,15}$/.test(normPhone(s));

export default function SignVerificationModal({
  open,
  token,
  channels,
  accent = '#CEFF8F',
  onClose,
  onVerified,
  onLocked,
}: {
  open: boolean;
  token: string;
  channels: Channel[];
  accent?: string;
  onClose: () => void;
  onVerified: (result: { email?: string; phone?: string }) => void;
  onLocked?: (info: { reason?: string; step?: number }) => void;
}) {
  const { lang } = useSignLang();
  const list: Channel[] = channels.length ? channels : ['email'];
  const [idx, setIdx] = useState(0);
  const [step, setStep] = useState<'dest' | 'code'>('dest');
  const [dest, setDest] = useState('');
  const [code, setCode] = useState<string[]>(['', '', '', '', '', '']);
  const [masked, setMasked] = useState('');
  const [results, setResults] = useState<{ email?: string; phone?: string }>({});
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [resendBlocked, setResendBlocked] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const current = list[idx];
  const multi = list.length > 1;
  const destValid = current === 'sms' ? isLikelyPhone(dest) : isValidEmail(dest);

  const requestCode = async () => {
    const d = dest.trim();
    if (!destValid) {
      setError(
        current === 'sms'
          ? (lang === 'fr' ? 'Entrez un numéro valide.' : 'Enter a valid phone number.')
          : (lang === 'fr' ? 'Entrez une adresse email valide.' : 'Enter a valid email address.'),
      );
      return;
    }
    setSending(true);
    setError('');
    setInfo('');
    try {
      const { data, error: err } = await supabase.functions.invoke('sign-verify', { body: { token, action: 'send', channel: current, destination: d } });
      if (err) throw err;
      const mask = data?.masked || d;
      if (data?.ok) {
        setMasked(mask);
        setCode(['', '', '', '', '', '']);
        setStep('code');
        setResendIn(90);
        setTimeout(() => inputs.current[0]?.focus(), 60);
      } else if (data?.error === 'locked') {
        onLocked?.({ reason: data.reason, step: data.step });
      } else if (data?.error === 'not_authorized') {
        const left = typeof data.attemptsLeft === 'number'
          ? (lang === 'fr'
              ? ` Il vous reste ${data.attemptsLeft} essai${data.attemptsLeft > 1 ? 's' : ''}.`
              : ` You have ${data.attemptsLeft} attempt${data.attemptsLeft > 1 ? 's' : ''} left.`)
          : '';
        setError((current === 'sms'
          ? (lang === 'fr' ? "Ce numéro n'est pas autorisé (ou ne correspond pas à votre email)." : 'This number is not authorized (or does not match your email).')
          : (lang === 'fr' ? "Cette adresse n'est pas autorisée à signer ce document." : 'This address is not authorized to sign this document.')) + left);
      } else if (data?.error === 'email_first') {
        setError(lang === 'fr' ? 'Vérifiez d’abord votre email.' : 'Please verify your email first.');
      } else if (data?.error === 'resend_limit') {
        setResendBlocked(true);
        setError(lang === 'fr' ? 'Limite de renvois atteinte. Contactez l’émetteur si besoin.' : 'Resend limit reached. Contact the sender if needed.');
      } else if (data?.error === 'rate_limit') {
        setMasked(mask);
        setStep('code');
        setResendIn(data.wait || 90);
        setInfo(lang === 'fr' ? 'Un code a déjà été envoyé. Saisissez-le ou patientez pour le renvoyer.' : 'A code has already been sent. Enter it or wait to resend.');
        setTimeout(() => inputs.current[0]?.focus(), 60);
      } else if (data?.error === 'already_signed') {
        setError(lang === 'fr' ? 'Ce document est déjà signé.' : 'This document has already been signed.');
      } else {
        setError(lang === 'fr' ? 'Envoi impossible. Réessayez.' : 'Unable to send. Please try again.');
      }
    } catch {
      setError(lang === 'fr' ? 'Envoi impossible. Réessayez.' : 'Unable to send. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const verify = async (full: string) => {
    setVerifying(true);
    setError('');
    try {
      const { data, error: err } = await supabase.functions.invoke('sign-verify', { body: { token, action: 'verify', channel: current, code: full } });
      if (err) throw err;
      if (data?.ok) {
        const merged = { ...results, [current === 'sms' ? 'phone' : 'email']: dest.trim() };
        if (idx < list.length - 1) {
          // canal suivant
          setResults(merged);
          setIdx(idx + 1);
          setStep('dest');
          setDest('');
          setCode(['', '', '', '', '', '']);
          setMasked('');
          setInfo('');
          setResendBlocked(false);
        } else {
          onVerified(merged);
        }
        return;
      }
      if (data?.error === 'locked') {
        onLocked?.({ reason: data.reason, step: data.step });
        return;
      }
      const left = typeof data?.attemptsLeft === 'number'
        ? (lang === 'fr'
            ? ` Il vous reste ${data.attemptsLeft} essai${data.attemptsLeft > 1 ? 's' : ''}.`
            : ` You have ${data.attemptsLeft} attempt${data.attemptsLeft > 1 ? 's' : ''} left.`)
        : '';
      const msg =
        data?.error === 'expired'
          ? (lang === 'fr' ? 'Code expiré. Renvoyez un code.' : 'Code expired. Request a new code.')
          : data?.error === 'too_many'
            ? (lang === 'fr' ? 'Trop de tentatives. Renvoyez un code.' : 'Too many attempts. Request a new code.')
            : data?.error === 'no_code'
              ? (lang === 'fr' ? 'Aucun code actif. Renvoyez un code.' : 'No active code. Request a new code.')
              : (lang === 'fr' ? `Code incorrect.${left}` : `Incorrect code.${left}`);
      setError(msg);
      setCode(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } catch {
      setError(lang === 'fr' ? 'Vérification impossible. Réessayez.' : 'Verification failed. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  // Réinitialise à l'ouverture
  useEffect(() => {
    if (!open) return;
    setIdx(0);
    setStep('dest');
    setDest('');
    setCode(['', '', '', '', '', '']);
    setMasked('');
    setResults({});
    setError('');
    setInfo('');
    setResendIn(0);
    setResendBlocked(false);
  }, [open]);

  useEffect(() => {
    if (!open || step !== 'code') return;
    const t = setInterval(() => setResendIn((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [open, step]);

  if (!open) return null;

  const onChangeDigit = (i: number, v: string) => {
    const digits = v.replace(/\D/g, '');
    const next = [...code];
    next[i] = digits ? digits[digits.length - 1] : '';
    setCode(next);
    if (digits && i < 5) inputs.current[i + 1]?.focus();
    if (next.every((x) => x !== '') && !verifying) verify(next.join(''));
  };
  const onKeyDownDigit = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[i] && i > 0) inputs.current[i - 1]?.focus();
  };
  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      e.preventDefault();
      setCode(pasted.split(''));
      inputs.current[5]?.focus();
      if (!verifying) verify(pasted);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-[#3A4242] bg-[#222828] p-4 shadow-2xl sm:p-6" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: `${accent}1f` }}>
            <ShieldCheck className="h-5 w-5" style={{ color: accent }} />
          </div>
          <button onClick={onClose} className="text-[#A1A9A9] transition-colors hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {multi && (
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[#CEFF8F]">
            {lang === 'fr' ? `Étape ${idx + 1} sur ${list.length}` : `Step ${idx + 1} of ${list.length}`} — {current === 'sms' ? 'SMS' : 'Email'}
          </div>
        )}

        {step === 'dest' ? (
          <>
            <h3 className="text-lg font-semibold text-white">{lang === 'fr' ? 'Vérification d’identité' : 'Identity verification'}</h3>
            <p className="mt-1 text-sm leading-relaxed text-[#A1A9A9]">
              {current === 'sms'
                ? (lang === 'fr'
                    ? 'Entrez votre numéro de téléphone pour recevoir un code par SMS. Il doit faire partie des numéros autorisés.'
                    : 'Enter your phone number to receive a code by SMS. It must be one of the authorized numbers.')
                : (lang === 'fr'
                    ? 'Entrez votre adresse email pour recevoir un code. Elle doit faire partie des adresses autorisées.'
                    : 'Enter your email address to receive a code. It must be one of the authorized addresses.')}
            </p>

            <div className="mt-5">
              {current === 'sms' ? (
                <PhoneInput value={dest} onChange={setDest} variant="dark" />
              ) : (
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
                  <input
                    type="email"
                    autoFocus
                    value={dest}
                    onChange={(e) => setDest(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') requestCode();
                    }}
                    placeholder={lang === 'fr' ? 'vous@exemple.fr' : 'you@example.com'}
                    className="w-full rounded-xl border border-[#3A4242] bg-[#191E1E] py-2.5 pl-9 pr-3 text-sm text-white outline-none transition-colors placeholder:text-[#A1A9A9]/40 focus:border-[#CEFF8F]"
                  />
                </div>
              )}
              {error && <p className="mt-3 rounded-lg border border-[#ef6b6b]/30 bg-[#ef6b6b]/10 px-3 py-2.5 text-center text-xs font-medium text-[#ef6b6b]">{error}</p>}
            </div>

            <button
              onClick={requestCode}
              disabled={sending || !destValid}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold text-[#191E1E] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: accent }}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : current === 'sms' ? <MessageSquare className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
              {lang === 'fr' ? 'Recevoir le code' : 'Get the code'}
            </button>
          </>
        ) : (
          <>
            <h3 className="text-lg font-semibold text-white">{lang === 'fr' ? 'Saisissez le code' : 'Enter the code'}</h3>
            <p className="mt-1 text-sm leading-relaxed text-[#A1A9A9]">
              {lang === 'fr' ? (
                <>Un code à 6 chiffres a été envoyé {current === 'sms' ? 'par SMS au' : 'à'} <span className="font-semibold text-[#F3F4F6]">{masked || dest}</span>.</>
              ) : (
                <>A 6-digit code has been sent {current === 'sms' ? 'by SMS to' : 'to'} <span className="font-semibold text-[#F3F4F6]">{masked || dest}</span>.</>
              )}
            </p>

            <div className="mt-5 flex justify-between gap-2" onPaste={onPaste}>
              {code.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    inputs.current[i] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  disabled={verifying}
                  onChange={(e) => onChangeDigit(i, e.target.value)}
                  onKeyDown={(e) => onKeyDownDigit(i, e)}
                  className="h-12 min-w-0 flex-1 rounded-xl border bg-[#191E1E] text-center text-xl font-bold text-white outline-none transition-colors disabled:opacity-50 sm:h-[52px] sm:w-11 sm:flex-none"
                  style={{ borderColor: digit ? accent : '#3A4242' }}
                />
              ))}
            </div>

            {verifying && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-[#A1A9A9]">
                <Loader2 className="h-4 w-4 animate-spin" /> {lang === 'fr' ? 'Vérification…' : 'Verifying…'}
              </div>
            )}
            {error && <p className="mt-4 rounded-lg border border-[#ef6b6b]/30 bg-[#ef6b6b]/10 px-3 py-2.5 text-center text-xs font-medium text-[#ef6b6b]">{error}</p>}
            {info && !error && <p className="mt-4 text-center text-xs text-[#A1A9A9]">{info}</p>}

            <div className="mt-5 flex items-center justify-between text-xs">
              <button
                onClick={() => {
                  setStep('dest');
                  setError('');
                  setInfo('');
                }}
                className="flex items-center gap-1 text-[#A1A9A9] transition-colors hover:text-white"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> {current === 'sms' ? (lang === 'fr' ? 'Modifier le numéro' : 'Change number') : (lang === 'fr' ? 'Modifier l’email' : 'Change email')}
              </button>
              {resendBlocked ? (
                <span className="text-[#A1A9A9]">{lang === 'fr' ? 'Limite de renvois atteinte' : 'Resend limit reached'}</span>
              ) : resendIn > 0 ? (
                <span className="text-[#A1A9A9]">{lang === 'fr' ? `Renvoyer dans ${resendIn}s` : `Resend in ${resendIn}s`}</span>
              ) : (
                <button onClick={requestCode} disabled={sending} className="font-semibold text-[#CEFF8F] transition-opacity hover:opacity-80 disabled:opacity-50">
                  {lang === 'fr' ? 'Renvoyer le code' : 'Resend code'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
