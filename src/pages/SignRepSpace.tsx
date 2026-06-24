import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Files, ShieldCheck, Loader2, Mail, Copy, Check, Plus, RefreshCw, Ban, LogIn, Users } from 'lucide-react';
import {
  repBootstrap, repVerifyCode, repDashboard, repCreateLink, repRegenerate,
  signerLinkFromToken, clearRepDeviceToken, type RepDashboard,
} from '../lib/signRepClient';
import { SignLogo } from '../components/SignLogo';

const BADGE: Record<string, { label: string; cls: string }> = {
  en_cours: { label: 'En cours', cls: 'text-[#A0E7EC] border-[#A0E7EC]/30 bg-[#A0E7EC]/10' },
  consulte: { label: 'Consulté', cls: 'text-[#A0E7EC] border-[#A0E7EC]/30 bg-[#A0E7EC]/10' },
  signe: { label: 'Signé', cls: 'text-[#CEFF8F] border-[#CEFF8F]/30 bg-[#CEFF8F]/10' },
  paye: { label: 'Signé + Payé', cls: 'text-[#191E1E] border-[#CEFF8F] bg-[#CEFF8F]' },
  expire: { label: 'Expiré', cls: 'text-[#A1A9A9] border-[#3A4242] bg-[#191E1E]' },
  refuse: { label: 'Refusé', cls: 'text-[#ef6b6b] border-[#ef6b6b]/30 bg-[#ef6b6b]/10' },
};
const fmtDate = (ts: string | null) =>
  ts ? new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function SignRepSpace() {
  const { token = '' } = useParams();
  const [phase, setPhase] = useState<'loading' | 'code' | 'ready' | 'revoked' | 'error'>('loading');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [dash, setDash] = useState<RepDashboard | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [creating, setCreating] = useState(false);
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [busyInstance, setBusyInstance] = useState<string | null>(null);

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1600);
    } catch { /* noop */ }
  };

  const loadDashboard = useCallback(async () => {
    try {
      const d = await repDashboard(token);
      if (d?.ok) { setDash(d); setPhase('ready'); return true; }
    } catch { /* noop */ }
    return false;
  }, [token]);

  const startBootstrap = useCallback(async () => {
    try {
      const r = await repBootstrap(token);
      if (!r.ok && r.error === 'revoked') { setPhase('revoked'); return; }
      if (!r.ok) { setPhase('error'); return; }
      if (r.trusted) { if (!(await loadDashboard())) setPhase('error'); return; }
      setMaskedEmail(r.maskedEmail ?? '');
      setPhase('code');
    } catch (e) {
      console.error('[sign] rep bootstrap', e);
      setPhase('error');
    }
  }, [token, loadDashboard]);

  useEffect(() => {
    document.title = 'Espace closer | CloseOS Sign';
    startBootstrap();
  }, [startBootstrap]);

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length < 6) return;
    setVerifying(true);
    setCodeError('');
    try {
      const r = await repVerifyCode(token, code.trim());
      if (r.ok) { setCode(''); await loadDashboard(); return; }
      if (r.error === 'revoked') { setPhase('revoked'); return; }
      setCodeError(
        r.error === 'expired' ? 'Code expiré, redemandez-en un.' :
        r.error === 'too_many' ? 'Trop de tentatives, redemandez un code.' :
        r.error === 'no_code' ? 'Aucun code actif, redemandez-en un.' :
        `Code incorrect${typeof r.attemptsLeft === 'number' ? ` (${r.attemptsLeft} essai${r.attemptsLeft > 1 ? 's' : ''} restant${r.attemptsLeft > 1 ? 's' : ''})` : ''}.`,
      );
    } catch {
      setCodeError('Erreur, réessayez.');
    } finally {
      setVerifying(false);
    }
  };

  const resendCode = async () => {
    setCodeError('');
    clearRepDeviceToken(token);
    await startBootstrap();
  };

  const createLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.trim()) return;
    setCreating(true);
    try {
      const r = await repCreateLink(token, { name: form.name, email: form.email, phone: form.phone });
      if (r.ok && r.token) {
        const link = signerLinkFromToken(r.token);
        setLastLink(link);
        setForm({ name: '', email: '', phone: '' });
        copy('last', link);
        await loadDashboard();
      } else if (r.error === 'revoked') {
        setPhase('revoked');
      } else {
        alert("Impossible de générer le lien.");
      }
    } catch {
      alert("Impossible de générer le lien.");
    } finally {
      setCreating(false);
    }
  };

  const regen = async (instanceId: string) => {
    setBusyInstance(instanceId);
    try {
      const r = await repRegenerate(token, instanceId);
      if (r.ok && r.token) { copy(`inst:${instanceId}`, signerLinkFromToken(r.token)); await loadDashboard(); }
    } catch { /* noop */ } finally {
      setBusyInstance(null);
    }
  };

  // ---------- Rendus ----------
  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-[#191E1E] text-[#F3F4F6]">
      <div className="border-b border-[#3A4242] px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center gap-2">
          <SignLogo className="text-lg" />
        </div>
      </div>
      {children}
    </div>
  );

  if (phase === 'loading') {
    return <Shell><div className="flex min-h-[60vh] items-center justify-center text-[#A1A9A9]"><Loader2 className="h-6 w-6 animate-spin" /></div></Shell>;
  }

  if (phase === 'error') {
    return <Shell><div className="mx-auto max-w-md px-6 py-24 text-center"><div className="mb-3 text-lg font-semibold text-white">Lien invalide</div><p className="text-sm text-[#A1A9A9]">Ce lien d'accès n'est pas valide ou n'existe plus.</p></div></Shell>;
  }

  if (phase === 'revoked') {
    return (
      <Shell>
        <div className="mx-auto max-w-md px-6 py-24 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[#ef6b6b]/30 bg-[#ef6b6b]/10"><Ban className="h-6 w-6 text-[#ef6b6b]" /></div>
          <div className="mb-2 text-lg font-semibold text-white">Accès révoqué</div>
          <p className="text-sm text-[#A1A9A9]">Votre accès à cet espace a été désactivé par le propriétaire.</p>
        </div>
      </Shell>
    );
  }

  if (phase === 'code') {
    return (
      <Shell>
        <div className="mx-auto max-w-md px-4 py-16 sm:px-6 sm:py-20">
          <div className="rounded-2xl border border-[#3A4242] bg-[#222828] p-6 sm:p-7">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-[#CEFF8F]/30 bg-[#CEFF8F]/10"><ShieldCheck className="h-5 w-5 text-[#CEFF8F]" /></div>
            <h1 className="text-xl font-semibold text-white">Vérifiez votre identité</h1>
            <p className="mt-2 text-sm text-[#A1A9A9]">Un code à 6 chiffres a été envoyé à <span className="text-[#F3F4F6]">{maskedEmail || 'votre email'}</span>.</p>
            <form onSubmit={submitCode} className="mt-6 space-y-3">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoFocus
                placeholder="••••••"
                className="w-full rounded-lg border border-[#3A4242] bg-[#191E1E] py-3 text-center text-2xl font-bold tracking-[0.5em] text-white outline-none focus:border-[#CEFF8F]"
              />
              {codeError && <p className="text-xs text-[#ef6b6b]">{codeError}</p>}
              <button type="submit" disabled={verifying || code.length < 6} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#CEFF8F] px-4 py-3 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC] disabled:opacity-50">
                {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />} Accéder
              </button>
            </form>
            <button onClick={resendCode} className="mt-4 flex items-center gap-1.5 text-xs text-[#A1A9A9] transition-colors hover:text-white"><Mail className="h-3.5 w-3.5" /> Renvoyer un code</button>
          </div>
        </div>
      </Shell>
    );
  }

  // phase === 'ready'
  const d = dash!;
  return (
    <Shell>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-7 flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#CEFF8F]/40 bg-[#CEFF8F]/10"><Files className="h-5 w-5 text-[#CEFF8F]" /></div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{d.templateTitle || 'Modèle'}</h1>
            <p className="mt-1 text-sm text-[#A1A9A9]">Espace de <span className="text-[#F3F4F6]">{d.label}</span> — générez vos liens et suivez vos signatures.</p>
          </div>
        </div>

        <div className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Mes liens', value: d.counts.total, color: 'text-white' },
            { label: 'En cours', value: d.counts.pending, color: 'text-[#A0E7EC]' },
            { label: 'Signés', value: d.counts.signed, color: 'text-[#CEFF8F]' },
            { label: 'Expirés', value: d.counts.expired, color: 'text-[#A1A9A9]' },
          ].map((k) => (
            <div key={k.label} className="rounded-xl border border-[#3A4242] bg-[#222828] p-4">
              <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
              <div className="mt-1 text-xs text-[#A1A9A9]">{k.label}</div>
            </div>
          ))}
        </div>

        {/* Nouveau lien */}
        <section className="mb-6 rounded-xl border border-[#3A4242] bg-[#222828] p-5">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-white"><Plus className="h-4 w-4 text-[#CEFF8F]" /> Nouveau lien de signature</h2>
          <p className="mb-4 text-xs text-[#A1A9A9]">Pour un prospect. Le lien expire dans 7 jours. {d.verificationMethod !== 'none' && 'La vérification d’identité est active.'} {d.paymentEnabled && 'Le paiement est requis pour signer.'}</p>
          <form onSubmit={createLink} className="grid gap-3 sm:grid-cols-3">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nom (facultatif)" className="rounded border border-[#3A4242] bg-[#191E1E] px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#A1A9A9]/50 focus:border-[#CEFF8F]" />
            <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email du prospect" className="rounded border border-[#3A4242] bg-[#191E1E] px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#A1A9A9]/50 focus:border-[#CEFF8F]" />
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Téléphone (si SMS)" className="rounded border border-[#3A4242] bg-[#191E1E] px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#A1A9A9]/50 focus:border-[#CEFF8F]" />
            <button type="submit" disabled={creating || !form.email.trim()} className="flex items-center justify-center gap-2 rounded bg-[#CEFF8F] px-4 py-2.5 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC] disabled:opacity-50 sm:col-span-3">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" strokeWidth={2.5} />} Générer le lien
            </button>
          </form>
          {lastLink && (
            <div className="mt-3 flex items-center gap-2 rounded border border-[#CEFF8F]/30 bg-[#191E1E] px-3 py-2">
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-[#A0E7EC]">{lastLink}</span>
              <button onClick={() => copy('last', lastLink)} className="shrink-0 text-[#A1A9A9] hover:text-white">
                {copiedKey === 'last' ? <Check className="h-4 w-4 text-[#CEFF8F]" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          )}
        </section>

        {/* Mes signatures */}
        <section className="overflow-hidden rounded-xl border border-[#3A4242] bg-[#222828]">
          <div className="flex items-center gap-2 border-b border-[#3A4242] px-5 py-3 text-sm font-semibold text-white"><Users className="h-4 w-4 text-[#CEFF8F]" /> Mes signatures</div>
          {d.instances.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-[#A1A9A9]">Aucun lien généré pour le moment.</p>
          ) : (
            <ul className="divide-y divide-[#3A4242]">
              {d.instances.map((inst) => {
                const b = BADGE[inst.effectiveStatus] ?? BADGE.en_cours;
                const active = inst.effectiveStatus === 'en_cours' || inst.effectiveStatus === 'consulte';
                const link = active && inst.signerToken ? signerLinkFromToken(inst.signerToken) : null;
                return (
                  <li key={inst.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[#1D2323]">
                    <span className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${b.cls}`}>{b.label}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-white">{inst.signerName || inst.signerEmail || 'Prospect'}</div>
                      <div className="truncate text-xs text-[#A1A9A9]">{inst.signerEmail}</div>
                    </div>
                    <div className="hidden shrink-0 text-xs text-[#A1A9A9] sm:block">{fmtDate(inst.signedAt ?? inst.createdAt)}</div>
                    <div className="flex shrink-0 items-center gap-1">
                      {inst.hasCertificate && <span title="Certificat émis" className="rounded p-1.5 text-[#CEFF8F]"><ShieldCheck className="h-4 w-4" /></span>}
                      {link && (
                        <button onClick={() => copy(`inst:${inst.id}`, link)} title="Copier le lien" className="rounded p-1.5 text-[#A1A9A9] transition-colors hover:bg-[#3A4242] hover:text-white">
                          {copiedKey === `inst:${inst.id}` ? <Check className="h-4 w-4 text-[#CEFF8F]" /> : <Copy className="h-4 w-4" />}
                        </button>
                      )}
                      {inst.effectiveStatus === 'expire' && (
                        <button onClick={() => regen(inst.id)} disabled={busyInstance === inst.id} title="Régénérer (7 j)" className="rounded p-1.5 text-[#A1A9A9] transition-colors hover:bg-[#3A4242] hover:text-[#CEFF8F] disabled:opacity-50">
                          {busyInstance === inst.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </Shell>
  );
}
