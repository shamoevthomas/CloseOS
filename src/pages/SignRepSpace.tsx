import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Files, ShieldCheck, Loader2, Mail, Copy, Check, Plus, RefreshCw, Ban, LogIn, Users, Eye, X, FileText } from 'lucide-react';
import {
  repBootstrap, repVerifyCode, repDashboard, repCreateLink, repRegenerate,
  repTemplateDoc, repInstanceDoc,
  signerLinkFromToken, clearRepDeviceToken, type RepDashboard,
} from '../lib/signRepClient';
import { SignLogo } from '../components/SignLogo';
import SignDocViewer, { type SignDocData } from '../components/SignDocViewer';
import SignInstanceFilters, { matchInstance, isFilterActive, EMPTY_INSTANCE_FILTER, type InstanceFilter } from '../components/SignInstanceFilters';
import { useSignLang, signLocale, type SignLang } from '../contexts/SignLangContext';

const BADGE = (lang: SignLang): Record<string, { label: string; cls: string }> => ({
  en_cours: { label: lang === 'fr' ? 'En cours' : 'In progress', cls: 'text-[#A0E7EC] border-[#A0E7EC]/30 bg-[#A0E7EC]/10' },
  consulte: { label: lang === 'fr' ? 'Consulté' : 'Viewed', cls: 'text-[#A0E7EC] border-[#A0E7EC]/30 bg-[#A0E7EC]/10' },
  signe: { label: lang === 'fr' ? 'Signé' : 'Signed', cls: 'text-[#CEFF8F] border-[#CEFF8F]/30 bg-[#CEFF8F]/10' },
  paye: { label: lang === 'fr' ? 'Signé + Payé' : 'Signed + Paid', cls: 'text-[#191E1E] border-[#CEFF8F] bg-[#CEFF8F]' },
  expire: { label: lang === 'fr' ? 'Expiré' : 'Expired', cls: 'text-[#A1A9A9] border-[#3A4242] bg-[#191E1E]' },
  refuse: { label: lang === 'fr' ? 'Refusé' : 'Declined', cls: 'text-[#ef6b6b] border-[#ef6b6b]/30 bg-[#ef6b6b]/10' },
});
const fmtDate = (ts: string | null, lang: SignLang) =>
  ts ? new Date(ts).toLocaleDateString(signLocale(lang), { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// Coquille de page (logo + fond). Définie AU NIVEAU MODULE : si elle était déclarée dans le
// composant, chaque frappe recréerait la fonction → remontage de l'arbre → perte de focus des champs.
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#191E1E] text-[#F3F4F6]">
      <div className="border-b border-[#3A4242] px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center gap-2">
          <SignLogo className="text-lg" />
        </div>
      </div>
      {children}
    </div>
  );
}

export default function SignRepSpace() {
  const { token = '' } = useParams();
  const { lang } = useSignLang();
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
  // Aperçu du contrat (modèle ou instance signée) en lecture seule
  const [viewer, setViewer] = useState<{ title: string; subtitle: string; doc: SignDocData } | null>(null);
  const [viewerLoading, setViewerLoading] = useState<string | null>(null); // 'template' | instanceId | null
  const [filter, setFilter] = useState<InstanceFilter>(EMPTY_INSTANCE_FILTER);

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
    document.title = lang === 'fr' ? 'Espace closer | CloseOS Sign' : 'Closer space | CloseOS Sign';
  }, [lang]);

  useEffect(() => {
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
        r.error === 'expired' ? (lang === 'fr' ? 'Code expiré, redemandez-en un.' : 'Code expired, request a new one.') :
        r.error === 'too_many' ? (lang === 'fr' ? 'Trop de tentatives, redemandez un code.' : 'Too many attempts, request a new code.') :
        r.error === 'no_code' ? (lang === 'fr' ? 'Aucun code actif, redemandez-en un.' : 'No active code, request a new one.') :
        (lang === 'fr'
          ? `Code incorrect${typeof r.attemptsLeft === 'number' ? ` (${r.attemptsLeft} essai${r.attemptsLeft > 1 ? 's' : ''} restant${r.attemptsLeft > 1 ? 's' : ''})` : ''}.`
          : `Incorrect code${typeof r.attemptsLeft === 'number' ? ` (${r.attemptsLeft} attempt${r.attemptsLeft > 1 ? 's' : ''} left)` : ''}.`),
      );
    } catch {
      setCodeError(lang === 'fr' ? 'Erreur, réessayez.' : 'Error, please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const resendCode = async () => {
    setCodeError('');
    clearRepDeviceToken(token);
    await startBootstrap();
  };

  // Champs demandés à la génération = pilotés par la méthode de vérif du modèle.
  // (SMS/Email+SMS étant indisponibles, le téléphone n'apparaît jamais pour l'instant.)
  const vmethod = dash?.verificationMethod ?? 'none';
  const needEmail = vmethod === 'email' || vmethod === 'email_sms';
  const needPhone = vmethod === 'sms' || vmethod === 'email_sms';

  const createLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (needEmail && !form.email.trim()) return;
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
        alert(lang === 'fr' ? "Impossible de générer le lien." : 'Unable to generate the link.');
      }
    } catch {
      alert(lang === 'fr' ? "Impossible de générer le lien." : 'Unable to generate the link.');
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

  const openTemplateDoc = async () => {
    setViewerLoading('template');
    try {
      const r = await repTemplateDoc(token);
      if (r.ok && r.doc) setViewer({ title: r.doc.title || (lang === 'fr' ? 'Modèle' : 'Template'), subtitle: lang === 'fr' ? 'Modèle — aperçu du contrat' : 'Template — contract preview', doc: r.doc });
      else alert(lang === 'fr' ? "Impossible d'afficher le contrat." : 'Unable to display the contract.');
    } catch { alert(lang === 'fr' ? "Impossible d'afficher le contrat." : 'Unable to display the contract.'); } finally { setViewerLoading(null); }
  };

  const openInstanceDoc = async (instanceId: string, signerName: string) => {
    setViewerLoading(instanceId);
    try {
      const r = await repInstanceDoc(token, instanceId);
      if (r.ok && r.doc) setViewer({ title: r.doc.title || (lang === 'fr' ? 'Contrat' : 'Contract'), subtitle: signerName ? (lang === 'fr' ? `Contrat de ${signerName}` : `${signerName}'s contract`) : (lang === 'fr' ? 'Contrat' : 'Contract'), doc: r.doc });
      else alert(lang === 'fr' ? "Impossible d'afficher le contrat." : 'Unable to display the contract.');
    } catch { alert(lang === 'fr' ? "Impossible d'afficher le contrat." : 'Unable to display the contract.'); } finally { setViewerLoading(null); }
  };

  // ---------- Rendus ----------
  if (phase === 'loading') {
    return <Shell><div className="flex min-h-[60vh] items-center justify-center text-[#A1A9A9]"><Loader2 className="h-6 w-6 animate-spin" /></div></Shell>;
  }

  if (phase === 'error') {
    return <Shell><div className="mx-auto max-w-md px-6 py-24 text-center"><div className="mb-3 text-lg font-semibold text-white">{lang === 'fr' ? 'Lien invalide' : 'Invalid link'}</div><p className="text-sm text-[#A1A9A9]">{lang === 'fr' ? "Ce lien d'accès n'est pas valide ou n'existe plus." : 'This access link is invalid or no longer exists.'}</p></div></Shell>;
  }

  if (phase === 'revoked') {
    return (
      <Shell>
        <div className="mx-auto max-w-md px-6 py-24 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[#ef6b6b]/30 bg-[#ef6b6b]/10"><Ban className="h-6 w-6 text-[#ef6b6b]" /></div>
          <div className="mb-2 text-lg font-semibold text-white">{lang === 'fr' ? 'Accès révoqué' : 'Access revoked'}</div>
          <p className="text-sm text-[#A1A9A9]">{lang === 'fr' ? "Votre accès à cet espace a été désactivé par le propriétaire." : 'Your access to this space has been disabled by the owner.'}</p>
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
            <h1 className="text-xl font-semibold text-white">{lang === 'fr' ? 'Vérifiez votre identité' : 'Verify your identity'}</h1>
            <p className="mt-2 text-sm text-[#A1A9A9]">{lang === 'fr' ? 'Un code à 6 chiffres a été envoyé à ' : 'A 6-digit code has been sent to '}<span className="text-[#F3F4F6]">{maskedEmail || (lang === 'fr' ? 'votre email' : 'your email')}</span>.</p>
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
                {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />} {lang === 'fr' ? 'Accéder' : 'Access'}
              </button>
            </form>
            <button onClick={resendCode} className="mt-4 flex items-center gap-1.5 text-xs text-[#A1A9A9] transition-colors hover:text-white"><Mail className="h-3.5 w-3.5" /> {lang === 'fr' ? 'Renvoyer un code' : 'Resend a code'}</button>
          </div>
        </div>
      </Shell>
    );
  }

  // phase === 'ready'
  const d = dash!;
  const filteredInstances = d.instances.filter((it) => matchInstance(it, filter));
  return (
    <Shell>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-7 flex flex-wrap items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#CEFF8F]/40 bg-[#CEFF8F]/10"><Files className="h-5 w-5 text-[#CEFF8F]" /></div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{d.templateTitle || (lang === 'fr' ? 'Modèle' : 'Template')}</h1>
            <p className="mt-1 text-sm text-[#A1A9A9]">{lang === 'fr' ? 'Espace de ' : 'Space of '}<span className="text-[#F3F4F6]">{d.label}</span>{lang === 'fr' ? ' — générez vos liens et suivez vos signatures.' : ' — generate your links and track your signatures.'}</p>
          </div>
          <button
            onClick={openTemplateDoc}
            disabled={viewerLoading === 'template'}
            className="flex shrink-0 items-center gap-2 rounded-lg border border-[#3A4242] bg-[#222828] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:border-[#CEFF8F] hover:text-[#CEFF8F] disabled:opacity-50"
          >
            {viewerLoading === 'template' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} {lang === 'fr' ? 'Voir le contrat' : 'View contract'}
          </button>
        </div>

        <div className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: lang === 'fr' ? 'Mes liens' : 'My links', value: d.counts.total, color: 'text-white' },
            { label: lang === 'fr' ? 'En cours' : 'In progress', value: d.counts.pending, color: 'text-[#A0E7EC]' },
            { label: lang === 'fr' ? 'Signés' : 'Signed', value: d.counts.signed, color: 'text-[#CEFF8F]' },
            { label: lang === 'fr' ? 'Expirés' : 'Expired', value: d.counts.expired, color: 'text-[#A1A9A9]' },
          ].map((k) => (
            <div key={k.label} className="rounded-xl border border-[#3A4242] bg-[#222828] p-4">
              <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
              <div className="mt-1 text-xs text-[#A1A9A9]">{k.label}</div>
            </div>
          ))}
        </div>

        {/* Nouveau lien */}
        <section className="mb-6 rounded-xl border border-[#3A4242] bg-[#222828] p-5">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-white"><Plus className="h-4 w-4 text-[#CEFF8F]" /> {lang === 'fr' ? 'Nouveau lien de signature' : 'New signature link'}</h2>
          <p className="mb-4 text-xs text-[#A1A9A9]">{lang === 'fr' ? 'Pour un prospect. Le lien expire dans 7 jours. ' : 'For a prospect. The link expires in 7 days. '}{d.verificationMethod !== 'none' && (lang === 'fr' ? 'La vérification d’identité est active.' : 'Identity verification is enabled.')} {d.paymentEnabled && (lang === 'fr' ? 'Le paiement est requis pour signer.' : 'Payment is required to sign.')}</p>
          <form onSubmit={createLink} className="grid gap-3 sm:grid-cols-2">
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={lang === 'fr' ? 'Nom du prospect' : 'Prospect name'} className="rounded border border-[#3A4242] bg-[#191E1E] px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#A1A9A9]/50 focus:border-[#CEFF8F]" />
            {needEmail && (
              <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder={lang === 'fr' ? 'Email du prospect' : 'Prospect email'} className="rounded border border-[#3A4242] bg-[#191E1E] px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#A1A9A9]/50 focus:border-[#CEFF8F]" />
            )}
            {needPhone && (
              <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder={lang === 'fr' ? 'Téléphone du prospect' : 'Prospect phone'} className="rounded border border-[#3A4242] bg-[#191E1E] px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#A1A9A9]/50 focus:border-[#CEFF8F]" />
            )}
            <button type="submit" disabled={creating || !form.name.trim() || (needEmail && !form.email.trim())} className="flex items-center justify-center gap-2 rounded bg-[#CEFF8F] px-4 py-2.5 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC] disabled:opacity-50 sm:col-span-2">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" strokeWidth={2.5} />} {lang === 'fr' ? 'Générer le lien' : 'Generate link'}
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
          <div className="flex items-center gap-2 border-b border-[#3A4242] px-5 py-3 text-sm font-semibold text-white"><Users className="h-4 w-4 text-[#CEFF8F]" /> {lang === 'fr' ? 'Mes signatures' : 'My signatures'}</div>
          {d.instances.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-[#A1A9A9]">{lang === 'fr' ? 'Aucun lien généré pour le moment.' : 'No links generated yet.'}</p>
          ) : (
            <>
              <SignInstanceFilters value={filter} onChange={setFilter} />
              {filteredInstances.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-[#A1A9A9]">{lang === 'fr' ? `Aucune signature ne correspond ${isFilterActive(filter) ? 'à ces filtres' : ''}.` : `No signature matches ${isFilterActive(filter) ? 'these filters' : ''}.`}</p>
              ) : (
            <ul className="divide-y divide-[#3A4242]">
              {filteredInstances.map((inst) => {
                const badges = BADGE(lang);
                const b = badges[inst.effectiveStatus] ?? badges.en_cours;
                const active = inst.effectiveStatus === 'en_cours' || inst.effectiveStatus === 'consulte';
                const link = active && inst.signerToken ? signerLinkFromToken(inst.signerToken) : null;
                return (
                  <li key={inst.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[#1D2323]">
                    <span className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${b.cls}`}>{b.label}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-white">{inst.signerName || inst.signerEmail || (lang === 'fr' ? 'Prospect' : 'Prospect')}</div>
                      <div className="truncate text-xs text-[#A1A9A9]">{inst.signerEmail}</div>
                    </div>
                    <div className="hidden shrink-0 text-xs text-[#A1A9A9] sm:block">{fmtDate(inst.signedAt ?? inst.createdAt, lang)}</div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => openInstanceDoc(inst.id, inst.signerName || inst.signerEmail || '')}
                        disabled={viewerLoading === inst.id}
                        title={lang === 'fr' ? 'Voir le contrat détaillé' : 'View detailed contract'}
                        className="rounded p-1.5 text-[#A1A9A9] transition-colors hover:bg-[#3A4242] hover:text-white disabled:opacity-50"
                      >
                        {viewerLoading === inst.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                      </button>
                      {inst.hasCertificate && <span title={lang === 'fr' ? 'Certificat émis' : 'Certificate issued'} className="rounded p-1.5 text-[#CEFF8F]"><ShieldCheck className="h-4 w-4" /></span>}
                      {link && (
                        <button onClick={() => copy(`inst:${inst.id}`, link)} title={lang === 'fr' ? 'Copier le lien' : 'Copy link'} className="rounded p-1.5 text-[#A1A9A9] transition-colors hover:bg-[#3A4242] hover:text-white">
                          {copiedKey === `inst:${inst.id}` ? <Check className="h-4 w-4 text-[#CEFF8F]" /> : <Copy className="h-4 w-4" />}
                        </button>
                      )}
                      {inst.effectiveStatus === 'expire' && (
                        <button onClick={() => regen(inst.id)} disabled={busyInstance === inst.id} title={lang === 'fr' ? 'Régénérer (7 j)' : 'Regenerate (7 d)'} className="rounded p-1.5 text-[#A1A9A9] transition-colors hover:bg-[#3A4242] hover:text-[#CEFF8F] disabled:opacity-50">
                          {busyInstance === inst.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
              )}
            </>
          )}
        </section>
      </div>

      {/* Aperçu du contrat en lecture seule (modèle ou instance signée) */}
      {viewer && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#191E1E]/95 backdrop-blur-sm">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#3A4242] px-4 py-3 sm:px-6">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">{viewer.title}</div>
              <div className="truncate text-xs text-[#A1A9A9]">{viewer.subtitle}</div>
            </div>
            <button
              onClick={() => setViewer(null)}
              className="flex shrink-0 items-center gap-1.5 rounded border border-[#3A4242] px-3 py-2 text-xs font-medium text-[#A1A9A9] transition-colors hover:border-[#A1A9A9] hover:text-white"
            >
              <X className="h-4 w-4" /> {lang === 'fr' ? 'Fermer' : 'Close'}
            </button>
          </div>
          <div className="flex-1 overflow-auto px-4 py-8 sm:px-6">
            <SignDocViewer doc={viewer.doc} />
          </div>
        </div>
      )}
    </Shell>
  );
}
