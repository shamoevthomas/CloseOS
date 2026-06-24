import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ChevronLeft, Files, Pencil, Plus, Copy, Check, Loader2, RefreshCw, ShieldCheck,
  Users, Link as LinkIcon, Mail, CheckCircle2, Ban,
} from 'lucide-react';
import { getContract } from '../lib/signContracts';
import {
  listTemplateReps, createTemplateRep, revokeTemplateRep,
  generateOwnerLink, regenerateInstance, listTemplateInstances,
  signerLinkUrl, type SignTemplateRep, type SignInstanceRow,
} from '../lib/signTemplates';

const INST_BADGE: Record<string, { label: string; cls: string }> = {
  en_cours: { label: 'En cours', cls: 'text-[#A0E7EC] border-[#A0E7EC]/30 bg-[#A0E7EC]/10' },
  consulte: { label: 'Consulté', cls: 'text-[#A0E7EC] border-[#A0E7EC]/30 bg-[#A0E7EC]/10' },
  signe: { label: 'Signé', cls: 'text-[#CEFF8F] border-[#CEFF8F]/30 bg-[#CEFF8F]/10' },
  paye: { label: 'Signé + Payé', cls: 'text-[#191E1E] border-[#CEFF8F] bg-[#CEFF8F]' },
  expire: { label: 'Expiré', cls: 'text-[#A1A9A9] border-[#3A4242] bg-[#191E1E]' },
  refuse: { label: 'Refusé', cls: 'text-[#ef6b6b] border-[#ef6b6b]/30 bg-[#ef6b6b]/10' },
};

const fmtDate = (ts: string | null) =>
  ts ? new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function SignTemplateDashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [notTemplate, setNotTemplate] = useState(false);
  const [reps, setReps] = useState<SignTemplateRep[]>([]);
  const [instances, setInstances] = useState<SignInstanceRow[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // formulaires
  const [repLabel, setRepLabel] = useState('');
  const [repEmail, setRepEmail] = useState('');
  const [creatingRep, setCreatingRep] = useState(false);
  const [ownerForm, setOwnerForm] = useState({ name: '', email: '', phone: '' });
  const [genBusy, setGenBusy] = useState(false);
  const [lastOwnerLink, setLastOwnerLink] = useState<string | null>(null);
  const [busyInstance, setBusyInstance] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const c = await getContract(id);
      if (!c) { setNotTemplate(true); return; }
      if (!c.is_template) {
        navigate(`/sign/app/contrat/${id}`, { replace: true });
        return;
      }
      setTitle(c.title);
      const [r, i] = await Promise.all([listTemplateReps(id), listTemplateInstances(id)]);
      setReps(r);
      setInstances(i);
    } catch (e) {
      console.error('[sign] dashboard template', e);
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    document.title = 'Tableau de bord du modèle | CloseOS Sign';
    load();
  }, [load]);

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1600);
    } catch { /* noop */ }
  };

  const addRep = async () => {
    if (!id || !repLabel.trim() || !repEmail.trim()) return;
    setCreatingRep(true);
    try {
      const rep = await createTemplateRep(id, repLabel.trim(), repEmail.trim());
      setReps((p) => [...p, rep]);
      setRepLabel(''); setRepEmail('');
      copy(`rep:${rep.id}`, rep.link);
    } catch (e) {
      console.error('[sign] création closer', e);
      alert("Impossible de créer le closer.");
    } finally {
      setCreatingRep(false);
    }
  };

  const revoke = async (rep: SignTemplateRep) => {
    if (!window.confirm(`Révoquer l'accès de « ${rep.label} » ? Ses appareils sont déconnectés immédiatement et il ne pourra plus créer de liens. L'historique et les contrats déjà signés restent intacts.`)) return;
    try {
      await revokeTemplateRep(rep.id);
      setReps((p) => p.map((x) => (x.id === rep.id ? { ...x, status: 'revoked', revokedAt: new Date().toISOString() } : x)));
    } catch (e) {
      console.error('[sign] révocation closer', e);
    }
  };

  const genOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !ownerForm.email.trim()) return;
    setGenBusy(true);
    try {
      const res = await generateOwnerLink(id, { name: ownerForm.name, email: ownerForm.email, phone: ownerForm.phone });
      setLastOwnerLink(res.link);
      setOwnerForm({ name: '', email: '', phone: '' });
      copy('owner-last', res.link);
      const i = await listTemplateInstances(id);
      setInstances(i);
    } catch (err) {
      console.error('[sign] génération lien propriétaire', err);
      alert("Impossible de générer le lien.");
    } finally {
      setGenBusy(false);
    }
  };

  const regen = async (inst: SignInstanceRow) => {
    setBusyInstance(inst.id);
    try {
      const res = await regenerateInstance(inst.id);
      copy(`inst:${inst.id}`, res.link);
      if (id) setInstances(await listTemplateInstances(id));
    } catch (e) {
      console.error('[sign] régénération', e);
    } finally {
      setBusyInstance(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-[#A1A9A9]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (notTemplate) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center text-[#A1A9A9]">
        Modèle introuvable. <button onClick={() => navigate('/sign/app/contrats')} className="text-[#CEFF8F] underline">Retour aux contrats</button>
      </div>
    );
  }

  const counts = {
    total: instances.length,
    pending: instances.filter((i) => i.effectiveStatus === 'en_cours' || i.effectiveStatus === 'consulte').length,
    signed: instances.filter((i) => i.effectiveStatus === 'signe' || i.effectiveStatus === 'paye').length,
    expired: instances.filter((i) => i.effectiveStatus === 'expire').length,
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 md:px-10">
      {/* Header */}
      <button onClick={() => navigate('/sign/app/contrats')} className="mb-4 flex items-center gap-1.5 text-sm text-[#A1A9A9] transition-colors hover:text-white">
        <ChevronLeft className="h-4 w-4" /> Tous les contrats
      </button>
      <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#CEFF8F]/40 bg-[#CEFF8F]/10">
            <Files className="h-5 w-5 text-[#CEFF8F]" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{title}</h1>
              <span className="rounded border border-[#CEFF8F] bg-[#CEFF8F] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#191E1E]">Modèle</span>
            </div>
            <p className="mt-1 text-sm text-[#A1A9A9]">Générez des liens de signature, suivez les signatures, gérez vos closers.</p>
          </div>
        </div>
        <button onClick={() => navigate(`/sign/app/contrat/${id}`)} className="flex w-full items-center justify-center gap-2 rounded border border-[#3A4242] px-4 py-2.5 text-sm font-medium text-[#F3F4F6] transition-colors hover:border-[#CEFF8F] hover:text-[#CEFF8F] md:w-auto">
          <Pencil className="h-4 w-4" /> Éditer le modèle
        </button>
      </div>

      {/* Compteurs */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Liens générés', value: counts.total, color: 'text-white' },
          { label: 'En cours', value: counts.pending, color: 'text-[#A0E7EC]' },
          { label: 'Signés', value: counts.signed, color: 'text-[#CEFF8F]' },
          { label: 'Expirés', value: counts.expired, color: 'text-[#A1A9A9]' },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-[#3A4242] bg-[#222828] p-4">
            <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
            <div className="mt-1 text-xs text-[#A1A9A9]">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Générer un lien (propriétaire) */}
        <section className="rounded-xl border border-[#3A4242] bg-[#222828] p-5">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-white"><LinkIcon className="h-4 w-4 text-[#CEFF8F]" /> Générer un lien de signature</h2>
          <p className="mb-4 text-xs text-[#A1A9A9]">Pour un prospect précis. Le lien expire dans 7 jours. La signature crée une instance figée avec son certificat.</p>
          <form onSubmit={genOwner} className="space-y-3">
            <input value={ownerForm.name} onChange={(e) => setOwnerForm({ ...ownerForm, name: e.target.value })} placeholder="Nom du prospect (facultatif)" className="w-full rounded border border-[#3A4242] bg-[#191E1E] px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#A1A9A9]/50 focus:border-[#CEFF8F]" />
            <input required type="email" value={ownerForm.email} onChange={(e) => setOwnerForm({ ...ownerForm, email: e.target.value })} placeholder="Email du prospect" className="w-full rounded border border-[#3A4242] bg-[#191E1E] px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#A1A9A9]/50 focus:border-[#CEFF8F]" />
            <input value={ownerForm.phone} onChange={(e) => setOwnerForm({ ...ownerForm, phone: e.target.value })} placeholder="Téléphone (si vérif SMS)" className="w-full rounded border border-[#3A4242] bg-[#191E1E] px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#A1A9A9]/50 focus:border-[#CEFF8F]" />
            <button type="submit" disabled={genBusy || !ownerForm.email.trim()} className="flex w-full items-center justify-center gap-2 rounded bg-[#CEFF8F] px-4 py-2.5 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC] disabled:opacity-50">
              {genBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" strokeWidth={2.5} />} Générer le lien
            </button>
          </form>
          {lastOwnerLink && (
            <div className="mt-3 flex items-center gap-2 rounded border border-[#CEFF8F]/30 bg-[#191E1E] px-3 py-2">
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-[#A0E7EC]">{lastOwnerLink}</span>
              <button onClick={() => copy('owner-last', lastOwnerLink)} className="shrink-0 text-[#A1A9A9] hover:text-white">
                {copiedKey === 'owner-last' ? <Check className="h-4 w-4 text-[#CEFF8F]" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          )}
        </section>

        {/* Closers (reps) */}
        <section className="rounded-xl border border-[#3A4242] bg-[#222828] p-5">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-white"><Users className="h-4 w-4 text-[#CEFF8F]" /> Closers</h2>
          <p className="mb-4 text-xs text-[#A1A9A9]">Chaque closer a son lien d'accès (sécurisé par code email + appareil de confiance) pour générer ses propres liens et suivre ses signatures.</p>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <input value={repLabel} onChange={(e) => setRepLabel(e.target.value)} placeholder="Nom du closer" className="flex-1 rounded border border-[#3A4242] bg-[#191E1E] px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#A1A9A9]/50 focus:border-[#CEFF8F]" />
            <input type="email" value={repEmail} onChange={(e) => setRepEmail(e.target.value)} placeholder="Email du closer" className="flex-1 rounded border border-[#3A4242] bg-[#191E1E] px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#A1A9A9]/50 focus:border-[#CEFF8F]" />
            <button onClick={addRep} disabled={creatingRep || !repLabel.trim() || !repEmail.trim()} className="flex items-center justify-center gap-1.5 rounded border border-[#3A4242] px-3 py-2.5 text-sm font-medium text-white transition-colors hover:border-[#CEFF8F] disabled:opacity-40">
              {creatingRep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </button>
          </div>
          <ul className="space-y-2">
            {reps.length === 0 && <li className="text-xs text-[#A1A9A9]">Aucun closer. Ajoutez-en un pour partager un accès.</li>}
            {reps.map((rep) => (
              <li key={rep.id} className={`rounded-lg border px-3 py-2.5 ${rep.status === 'revoked' ? 'border-[#3A4242] bg-[#191E1E] opacity-60' : 'border-[#3A4242] bg-[#191E1E]'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium text-white">
                      {rep.label}
                      {rep.status === 'revoked' && <span className="rounded bg-[#ef6b6b]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#ef6b6b]">Révoqué</span>}
                    </div>
                    <div className="flex items-center gap-1 truncate text-xs text-[#A1A9A9]"><Mail className="h-3 w-3" /> {rep.email}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {rep.status === 'active' && (
                      <>
                        <button onClick={() => copy(`rep:${rep.id}`, rep.link)} title="Copier le lien du closer" className="rounded p-1.5 text-[#A1A9A9] transition-colors hover:bg-[#3A4242] hover:text-white">
                          {copiedKey === `rep:${rep.id}` ? <Check className="h-4 w-4 text-[#CEFF8F]" /> : <Copy className="h-4 w-4" />}
                        </button>
                        <button onClick={() => revoke(rep)} title="Révoquer" className="rounded p-1.5 text-[#A1A9A9] transition-colors hover:bg-[#3A4242] hover:text-[#ef6b6b]"><Ban className="h-4 w-4" /></button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Instances */}
      <section className="mt-6 overflow-hidden rounded-xl border border-[#3A4242] bg-[#222828]">
        <div className="flex items-center gap-2 border-b border-[#3A4242] px-5 py-3 text-sm font-semibold text-white">
          <FileSignatureFallback /> Signatures ({instances.length})
        </div>
        {instances.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-[#A1A9A9]">Aucun lien généré pour le moment.</p>
        ) : (
          <ul className="divide-y divide-[#3A4242]">
            {instances.map((inst) => {
              const b = INST_BADGE[inst.effectiveStatus] ?? INST_BADGE.en_cours;
              const link = inst.signLink ?? (inst.signerToken ? signerLinkUrl(inst.signerToken) : null);
              return (
                <li key={inst.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[#1D2323]">
                  <span className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${b.cls}`}>{b.label}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-white">{inst.signerName || inst.signerEmail || 'Prospect'}</div>
                    <div className="truncate text-xs text-[#A1A9A9]">{inst.signerEmail}</div>
                  </div>
                  <div className="shrink-0 text-xs text-[#A1A9A9]">
                    {inst.repLabel ? <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {inst.repLabel}</span> : <span className="text-[#6b7373]">Vous</span>}
                  </div>
                  <div className="hidden shrink-0 text-xs text-[#A1A9A9] sm:block">{fmtDate(inst.signedAt ?? inst.createdAt)}</div>
                  <div className="flex shrink-0 items-center gap-1">
                    {inst.hasCertificate && <span title="Certificat de preuve émis" className="rounded p-1.5 text-[#CEFF8F]"><ShieldCheck className="h-4 w-4" /></span>}
                    {link && (inst.effectiveStatus === 'en_cours' || inst.effectiveStatus === 'consulte') && (
                      <button onClick={() => copy(`inst:${inst.id}`, link)} title="Copier le lien" className="rounded p-1.5 text-[#A1A9A9] transition-colors hover:bg-[#3A4242] hover:text-white">
                        {copiedKey === `inst:${inst.id}` ? <Check className="h-4 w-4 text-[#CEFF8F]" /> : <Copy className="h-4 w-4" />}
                      </button>
                    )}
                    {inst.effectiveStatus === 'expire' && (
                      <button onClick={() => regen(inst)} disabled={busyInstance === inst.id} title="Régénérer un lien (7 j)" className="rounded p-1.5 text-[#A1A9A9] transition-colors hover:bg-[#3A4242] hover:text-[#CEFF8F] disabled:opacity-50">
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
  );
}

// Petit wrapper pour l'icône d'en-tête (évite un import inutilisé ailleurs).
function FileSignatureFallback() {
  return <CheckCircle2 className="h-4 w-4 text-[#CEFF8F]" />;
}
