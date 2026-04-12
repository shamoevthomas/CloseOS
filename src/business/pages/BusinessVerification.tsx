import { useState, useRef, useEffect } from 'react';
import { ShieldCheck, Loader2, AlertCircle, RotateCcw } from 'lucide-react';
import { useBusinessLang } from '../i18n/BusinessLangContext'

interface BusinessVerificationProps {
  userId: string;
  email: string;
  authMethod?: 'google' | 'classic';
  onVerified: (token: string) => void;
  onCancel: () => void;
}

function getDeviceFingerprint(): string {
  const key = 'closeos_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID() + '-' + navigator.userAgent.slice(0, 50).replace(/\s/g, '_');
    localStorage.setItem(key, id);
  }
  return id;
}

export default function BusinessVerification({ userId, email, authMethod = 'classic', onVerified, onCancel }: BusinessVerificationProps) {
  const { t } = useBusinessLang()
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Send code on mount
  useEffect(() => {
    sendCode();
  }, []);

  // Countdown timer
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const sendCode = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/business-send-verification-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.checkout_error_server);
      setCodeSent(true);
      setResendCountdown(60);
    } catch (err: any) {
      setError(err.message || t.verification_error_send);
    } finally {
      setSending(false);
    }
  };

  const handleInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    setError(null);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (newCode.every(d => d !== '')) {
      verifyCode(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      const newCode = pasted.split('');
      setCode(newCode);
      inputRefs.current[5]?.focus();
      verifyCode(pasted);
    }
  };

  const verifyCode = async (fullCode: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/business-verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          code: fullCode,
          device_fingerprint: getDeviceFingerprint(),
          auth_method: authMethod
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.verification_error_invalid);
      // Save device token
      localStorage.setItem('closeos_device_token', data.token);
      onVerified(data.token);
    } catch (err: any) {
      setError(err.message || t.verification_error_invalid);
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  // Mask email
  const maskedEmail = email.replace(/^(.{2})(.*)(@.*)$/, (_, start, mid, domain) =>
    start + '*'.repeat(Math.min(mid.length, 6)) + domain
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-[#f5f3f0] dark:bg-neutral-900" style={{ fontFamily: "'Manrope', system-ui, sans-serif" }}>
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-indigo-400/10 blur-[120px]" />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full bg-violet-300/10 blur-[120px]" />
      </div>

      <div className="w-full max-w-md mx-4 bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-xl shadow-[0_20px_40px_rgba(27,28,27,0.04)] border border-stone-200/20 dark:border-neutral-800 p-10">
        {/* Brand */}
        <div className="flex items-center justify-center mb-8">
          <img src="/closeos-business-logo-ecrit.png" alt="CloseOS Business" className="h-10 w-auto dark:hidden" />
          <img src="/closeos-business-logo-ecrit-dark.png" alt="CloseOS Business" className="h-10 w-auto hidden dark:block" />
        </div>

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-500/10 rounded-full flex items-center justify-center">
            <ShieldCheck className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-extrabold tracking-tight text-stone-900 dark:text-white mb-2">
            {t.verification_required}
          </h1>
          <p className="text-stone-500 dark:text-neutral-400 text-sm leading-relaxed">
            {codeSent
              ? <>{t.verification_code_sent_to} <strong className="text-stone-700 dark:text-neutral-300">{maskedEmail}</strong></>
              : t.verification_sending
            }
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 flex items-center gap-2.5 p-3.5 bg-red-50/60 border border-red-200/30 rounded-xl text-red-600 text-xs font-medium">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Code inputs */}
        <div className="flex justify-center gap-2.5 mb-8" onPaste={handlePaste}>
          {code.map((digit, i) => (
            <div key={i} className="relative">
              {i === 3 && (
                <div className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-stone-300 dark:bg-neutral-600" />
              )}
              <input
                ref={el => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleInput(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                disabled={loading || sending}
                className="w-12 h-14 text-center text-xl font-bold bg-stone-100/50 dark:bg-neutral-800 border border-stone-300 dark:border-neutral-600 rounded-xl text-stone-900 dark:text-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all disabled:opacity-50"
              />
            </div>
          ))}
        </div>

        {/* Loading */}
        {(loading || sending) && (
          <div className="flex justify-center mb-6">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          </div>
        )}

        {/* Resend */}
        <div className="text-center mb-6">
          {resendCountdown > 0 ? (
            <p className="text-xs text-stone-400 dark:text-neutral-500">
              {t.verification_resend_in} {resendCountdown}s
            </p>
          ) : (
            <button
              onClick={sendCode}
              disabled={sending}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
            >
              <RotateCcw className="h-3 w-3" />
              {t.verification_resend}
            </button>
          )}
        </div>

        {/* Cancel */}
        <button
          onClick={onCancel}
          className="w-full text-center text-xs font-bold text-stone-500 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white transition-colors"
        >
          {t.verification_back_login}
        </button>
      </div>

      {/* Footer */}
      <div className="mt-8 flex flex-col items-center gap-3 pb-8">
        <div className="text-[0.65rem] text-stone-400/60 tracking-widest uppercase font-semibold">
          &copy; {new Date().getFullYear()} CloseOS Business
        </div>
      </div>
    </div>
  );
}

export { getDeviceFingerprint };
