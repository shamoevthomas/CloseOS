import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ChevronLeft, Files, Pencil, Plus, Copy, Check, Loader2, RefreshCw, ShieldCheck,
  Users, Link as LinkIcon, Mail, CheckCircle2, Ban, Eye, X,
} from 'lucide-react';
import { getContract, mergedInlineValues } from '../lib/signContracts';
import { getCertificateUrl } from '../lib/signCertificate';
import SignDocViewer, { type SignDocData } from '../components/SignDocViewer';
import SignInstanceFilters, { matchInstance, isFilterActive, EMPTY_INSTANCE_FILTER, type InstanceFilter } from '../components/SignInstanceFilters';
import {
  listTemplateReps, createTemplateRep, revokeTemplateRep,
  generateOwnerLink, regenerateInstance, listTemplateInstances,
  signerLinkUrl, type SignTemplateRep, type SignInstanceRow,
} from '../lib/signTemplates';
import { useSignLang, signLocale, type SignLang } from '../contexts/SignLangContext';
import { listTeamMembers, listTemplateMemberIds, assignTemplate, unassignTemplate, type SignTeamMember } from '../lib/signTeam';

const instBadge = (lang: SignLang): Record<string, { label: string; cls: string }> => ({
  en_cours: { label: lang === 'fr' ? 'En cours' : 'In progress', cls: 'text-[#A0E7EC] border-[#A0E7EC]/30 bg-[#A0E7EC]/10' },
  consulte: { label: lang === 'fr' ? 'Consulté' : 'Viewed', cls: 'text-[#A0E7EC] border-[#A0E7EC]/30 bg-[#A0E7EC]/10' },
  signe: { label: lang === 'fr' ? 'Signé' : 'Signed', cls: 'text-[#CEFF8F] border-[#CEFF8F]/30 bg-[#CEFF8F]/10' },
  paye: { label: lang === 'fr' ? 'Signé + Payé' : 'Signed + Paid', cls: 'text-[#191E1E] border-[#CEFF8F] bg-[#CEFF8F]' },
  expire: { label: lang === 'fr' ? 'Expiré' : 'Expired', cls: 'text-[#A1A9A9] border-[#3A4242] bg-[#191E1E]' },
  refuse: { label: lang === 'fr' ? 'Refusé' : 'Declined', cls: 'text-[#ef6b6b] border-[#ef6b6b]/30 bg-[#ef6b6b]/10' },
});

const fmtDate = (ts: string | null, lang: SignLang) =>
  ts ? new Date(ts).toLocaleDateString(signLocale(lang), { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function SignTemplateDashboard() {
  const { lang } = useSignLang();
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [verifMethod, setVerifMethod] = useState<'none' | 'email' | 'sms' | 'email_sms' | 'pay'>('none');
  const [notTemplate, setNotTemplate] = useState(false);
  const [reps, setReps] = useState<SignTemplateRep[]>([]);
  const [instances, setInstances] = useState<SignInstanceRow[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  // Équipe (comptes réels) : assignation de ce modèle
  const [team, setTeam] = useState<SignTeamMember[]>([]);
  const [assignedMemberIds, setAssignedMemberIds] = useState<string[]>([]);
  const [assignBusy, setAssignBusy] = useState<string | null>(null);

  // formulaires
  const [repLabel, setRepLabel] = useState('');
  const [repEmail, setRepEmail] = useState('');
  const [creatingRep, setCreatingRep] = useState(false);
  const [ownerForm, setOwnerForm] = useState({ name: '', email: '', phone: '' });
  const [genBusy, setGenBusy] = useState(false);
  const [lastOwnerLink, setLastOwnerLink] = useState<string | null>(null);
  const [busyInstance, setBusyInstance] = useState<string | null>(null);
  // Aperçu du contrat signé + accès au certificat
  const [viewer, setViewer] = useState<{ title: string; subtitle: string; doc: SignDocData } | null>(null);
  const [viewerLoading, setViewerLoading] = useState<string | null>(null);
  const [certBusy, setCertBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<InstanceFilter>(EMPTY_INSTANCE_FILTER);

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
      setVerifMethod(c.verification_method);
      const [r, i, tm, am] = await Promise.all([listTemplateReps(id), listTemplateInstances(id), listTeamMembers(), listTemplateMemberIds(id)]);
      setReps(r);
      setInstances(i);
      setTeam(tm.filter((m) => m.status === 'active'));
      setAssignedMemberIds(am);
    } catch (e) {
      console.error('[sign] dashboard template', e);
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    document.title = (lang === 'fr' ? 'Tableau de bord du modèle' : 'Template dashboard') + ' | CloseOS Sign';
    load();
  }, [load, lang]);

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1600);
    } catch { /* noop */ }
  };

  const toggleMemberAssign = async (memberId: string) => {
    if (!id) return;
    const has = assignedMemberIds.includes(memberId);
    setAssignBusy(memberId);
    try {
      if (has) { await unassignTemplate(id, memberId); setAssignedMemberIds((p) => p.filter((x) => x !== memberId)); }
      else { await assignTemplate(id, memberId); setAssignedMemberIds((p) => [...p, memberId]); }
    } catch (e) { console.error('[sign] assignation équipier', e); }
    finally { setAssignBusy(null); }
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
      alert(lang === 'fr' ? "Impossible de créer le closer." : 'Unable to create the closer.');
    } finally {
      setCreatingRep(false);
    }
  };

  const revoke = async (rep: SignTemplateRep) => {
    if (!window.confirm(lang === 'fr'
      ? `Révoquer l'accès de « ${rep.label} » ? Ses appareils sont déconnectés immédiatement et il ne pourra plus créer de liens. L'historique et les contrats déjà signés restent intacts.`
      : `Revoke access for “${rep.label}”? Their devices are disconnected immediately and they can no longer create links. History and already-signed contracts stay intact.`)) return;
    try {
      await revokeTemplateRep(rep.id);
      setReps((p) => p.map((x) => (x.id === rep.id ? { ...x, status: 'revoked', revokedAt: new Date().toISOString() } : x)));
    } catch (e) {
      console.error('[sign] révocation closer', e);
    }
  };

  // Champs demandés à la génération = pilotés par la méthode de vérif du modèle.
  const needEmail = verifMethod === 'email' || verifMethod === 'email_sms';
  const needPhone = verifMethod === 'sms' || verifMethod === 'email_sms';

  const genOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !ownerForm.name.trim()) return;
    if (needEmail && !ownerForm.email.trim()) return;
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
      alert(lang === 'fr' ? "Impossible de générer le lien." : 'Unable to generate the link.');
    } finally {
      setGenBusy(false);
    }
  };

  // Aperçu « en grand » d'une instance (document + valeurs + signatures), lecture seule.
  const openInstanceDoc = async (inst: SignInstanceRow) => {
    setViewerLoading(inst.id);
    try {
      const c = await getContract(inst.id);
      if (!c) { alert(lang === 'fr' ? "Impossible d'afficher le contrat." : 'Unable to display the contract.'); return; }
      const doc: SignDocData = {
        title: c.title,
        sourceType: c.source_type,
        contentHtml: c.content_html,
        theme: c.theme,
        pdfData: c.pdf_data,
        images: c.images,
        inlineValues: mergedInlineValues(c.inline_values, c.signers),
        fields: c.fields,
      };
      const who = inst.signerName || inst.signerEmail || (lang === 'fr' ? 'Prospect' : 'Prospect');
      setViewer({ title: c.title || (lang === 'fr' ? 'Contrat' : 'Contract'), subtitle: lang === 'fr' ? `Contrat de ${who}` : `Contract for ${who}`, doc });
    } catch (e) {
      console.error('[sign] aperçu instance', e);
      alert(lang === 'fr' ? "Impossible d'afficher le contrat." : 'Unable to display the contract.');
    } finally {
      setViewerLoading(null);
    }
  };

  // Aperçu « en grand » du MODÈLE lui-même (document seul, lecture seule).
  const openTemplateDoc = async () => {
    if (!id) return;
    setViewerLoading('template');
    try {
      const c = await getContract(id);
      if (!c) { alert(lang === 'fr' ? "Impossible d'afficher le contrat." : 'Unable to display the contract.'); return; }
      const doc: SignDocData = {
        title: c.title,
        sourceType: c.source_type,
        contentHtml: c.content_html,
        theme: c.theme,
        pdfData: c.pdf_data,
        images: c.images,
        inlineValues: mergedInlineValues(c.inline_values, c.signers),
        fields: c.fields,
      };
      setViewer({ title: c.title || (lang === 'fr' ? 'Contrat' : 'Contract'), subtitle: lang === 'fr' ? 'Aperçu du modèle' : 'Template preview', doc });
    } catch (e) {
      console.error('[sign] aperçu modèle', e);
      alert(lang === 'fr' ? "Impossible d'afficher le contrat." : 'Unable to display the contract.');
    } finally {
      setViewerLoading(null);
    }
  };

  // Ouvre le certificat de preuve scellé (bucket privé) dans un nouvel onglet.
  const openCertificate = async (inst: SignInstanceRow) => {
    setCertBusy(inst.id);
    try {
      const url = await getCertificateUrl({ contractId: inst.id });
      if (url) window.open(url, '_blank');
      else alert(lang === 'fr' ? "Certificat indisponible." : 'Certificate unavailable.');
    } catch (e) {
      console.error('[sign] certificat', e);
      alert(lang === 'fr' ? "Certificat indisponible." : 'Certificate unavailable.');
    } finally {
      setCertBusy(null);
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
        {lang === 'fr' ? 'Modèle introuvable.' : 'Template not found.'} <button onClick={() => navigate('/sign/app/contrats')} className="text-[#CEFF8F] underline">{lang === 'fr' ? 'Retour aux contrats' : 'Back to contracts'}</button>
      </div>
    );
  }

  const filteredInstances = instances.filter((it) => matchInstance(it, filter));
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
        <ChevronLeft className="h-4 w-4" /> {lang === 'fr' ? 'Tous les contrats' : 'All contracts'}
      </button>
      <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#CEFF8F]/40 bg-[#CEFF8F]/10">
            <Files className="h-5 w-5 text-[#CEFF8F]" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{title}</h1>
              <span className="rounded border border-[#CEFF8F] bg-[#CEFF8F] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#191E1E]">{lang === 'fr' ? 'Modèle' : 'Template'}</span>
            </div>
            <p className="mt-1 text-sm text-[#A1A9A9]">{lang === 'fr' ? 'Générez des liens de signature, suivez les signatures, gérez vos closers.' : 'Generate signing links, track signatures, manage your closers.'}</p>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
          <button onClick={openTemplateDoc} disabled={viewerLoading === 'template'} className="flex w-full items-center justify-center gap-2 rounded border border-[#3A4242] px-4 py-2.5 text-sm font-medium text-[#F3F4F6] transition-colors hover:border-[#CEFF8F] hover:text-[#CEFF8F] disabled:opacity-50 md:w-auto">
            {viewerLoading === 'template' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} {lang === 'fr' ? 'Voir le contrat' : 'View contract'}
          </button>
          <button onClick={() => navigate(`/sign/app/contrat/${id}`)} className="flex w-full items-center justify-center gap-2 rounded border border-[#3A4242] px-4 py-2.5 text-sm font-medium text-[#F3F4F6] transition-colors hover:border-[#CEFF8F] hover:text-[#CEFF8F] md:w-auto">
            <Pencil className="h-4 w-4" /> {lang === 'fr' ? 'Éditer le modèle' : 'Edit template'}
          </button>
        </div>
      </div>

      {/* Compteurs */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: lang === 'fr' ? 'Liens générés' : 'Links generated', value: counts.total, color: 'text-white' },
          { label: lang === 'fr' ? 'En cours' : 'In progress', value: counts.pending, color: 'text-[#A0E7EC]' },
          { label: lang === 'fr' ? 'Signés' : 'Signed', value: counts.signed, color: 'text-[#CEFF8F]' },
          { label: lang === 'fr' ? 'Expirés' : 'Expired', value: counts.expired, color: 'text-[#A1A9A9]' },
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
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-white"><LinkIcon className="h-4 w-4 text-[#CEFF8F]" /> {lang === 'fr' ? 'Générer un lien de signature' : 'Generate a signing link'}</h2>
          <p className="mb-4 text-xs text-[#A1A9A9]">{lang === 'fr' ? 'Pour un prospect précis. Le lien expire dans 7 jours. La signature crée une instance figée avec son certificat.' : 'For a specific prospect. The link expires in 7 days. Signing creates a frozen instance with its certificate.'}</p>
          <form onSubmit={genOwner} className="space-y-3">
            <input required value={ownerForm.name} onChange={(e) => setOwnerForm({ ...ownerForm, name: e.target.value })} placeholder={lang === 'fr' ? 'Nom du prospect' : 'Prospect name'} className="w-full rounded border border-[#3A4242] bg-[#191E1E] px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#A1A9A9]/50 focus:border-[#CEFF8F]" />
            {needEmail && (
              <input required type="email" value={ownerForm.email} onChange={(e) => setOwnerForm({ ...ownerForm, email: e.target.value })} placeholder={lang === 'fr' ? 'Email du prospect' : 'Prospect email'} className="w-full rounded border border-[#3A4242] bg-[#191E1E] px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#A1A9A9]/50 focus:border-[#CEFF8F]" />
            )}
            {needPhone && (
              <input required value={ownerForm.phone} onChange={(e) => setOwnerForm({ ...ownerForm, phone: e.target.value })} placeholder={lang === 'fr' ? 'Téléphone du prospect' : 'Prospect phone'} className="w-full rounded border border-[#3A4242] bg-[#191E1E] px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#A1A9A9]/50 focus:border-[#CEFF8F]" />
            )}
            <button type="submit" disabled={genBusy || !ownerForm.name.trim() || (needEmail && !ownerForm.email.trim())} className="flex w-full items-center justify-center gap-2 rounded bg-[#CEFF8F] px-4 py-2.5 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC] disabled:opacity-50">
              {genBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" strokeWidth={2.5} />} {lang === 'fr' ? 'Générer le lien' : 'Generate link'}
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
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-white"><Users className="h-4 w-4 text-[#CEFF8F]" /> {lang === 'fr' ? 'Closers' : 'Closers'}</h2>
          <p className="mb-4 text-xs text-[#A1A9A9]">{lang === 'fr' ? "Chaque closer a son lien d'accès (sécurisé par code email + appareil de confiance) pour générer ses propres liens et suivre ses signatures." : 'Each closer has their own access link (secured by email code + trusted device) to generate their own links and track their signatures.'}</p>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <input value={repLabel} onChange={(e) => setRepLabel(e.target.value)} placeholder={lang === 'fr' ? 'Nom du closer' : 'Closer name'} className="flex-1 rounded border border-[#3A4242] bg-[#191E1E] px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#A1A9A9]/50 focus:border-[#CEFF8F]" />
            <input type="email" value={repEmail} onChange={(e) => setRepEmail(e.target.value)} placeholder={lang === 'fr' ? 'Email du closer' : 'Closer email'} className="flex-1 rounded border border-[#3A4242] bg-[#191E1E] px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#A1A9A9]/50 focus:border-[#CEFF8F]" />
            <button onClick={addRep} disabled={creatingRep || !repLabel.trim() || !repEmail.trim()} className="flex items-center justify-center gap-1.5 rounded border border-[#3A4242] px-3 py-2.5 text-sm font-medium text-white transition-colors hover:border-[#CEFF8F] disabled:opacity-40">
              {creatingRep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </button>
          </div>
          <ul className="space-y-2">
            {reps.length === 0 && <li className="text-xs text-[#A1A9A9]">{lang === 'fr' ? 'Aucun closer. Ajoutez-en un pour partager un accès.' : 'No closer yet. Add one to share access.'}</li>}
            {reps.map((rep) => (
              <li key={rep.id} className={`rounded-lg border px-3 py-2.5 ${rep.status === 'revoked' ? 'border-[#3A4242] bg-[#191E1E] opacity-60' : 'border-[#3A4242] bg-[#191E1E]'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium text-white">
                      {rep.label}
                      {rep.status === 'revoked' && <span className="rounded bg-[#ef6b6b]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#ef6b6b]">{lang === 'fr' ? 'Révoqué' : 'Revoked'}</span>}
                    </div>
                    <div className="flex items-center gap-1 truncate text-xs text-[#A1A9A9]"><Mail className="h-3 w-3" /> {rep.email}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {rep.status === 'active' && (
                      <>
                        <button onClick={() => copy(`rep:${rep.id}`, rep.link)} title={lang === 'fr' ? 'Copier le lien du closer' : "Copy the closer's link"} className="rounded p-1.5 text-[#A1A9A9] transition-colors hover:bg-[#3A4242] hover:text-white">
                          {copiedKey === `rep:${rep.id}` ? <Check className="h-4 w-4 text-[#CEFF8F]" /> : <Copy className="h-4 w-4" />}
                        </button>
                        <button onClick={() => revoke(rep)} title={lang === 'fr' ? 'Révoquer' : 'Revoke'} className="rounded p-1.5 text-[#A1A9A9] transition-colors hover:bg-[#3A4242] hover:text-[#ef6b6b]"><Ban className="h-4 w-4" /></button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Mon équipe (comptes réels) — assignation de ce modèle */}
      <section className="mt-6 rounded-xl border border-[#3A4242] bg-[#222828] p-5">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-white"><Users className="h-4 w-4 text-[#CEFF8F]" /> {lang === 'fr' ? 'Mon équipe' : 'My team'}</h2>
        <p className="mb-4 text-xs text-[#A1A9A9]">{lang === 'fr' ? 'Cochez les équipiers (comptes CloseOS) autorisés à générer ce modèle depuis leur espace.' : 'Toggle the teammates (CloseOS accounts) allowed to generate this template from their space.'}</p>
        {team.length === 0 ? (
          <p className="text-xs text-[#A1A9A9]">
            {lang === 'fr'
              ? <>Aucun équipier actif. Ajoutez-en depuis <a href="/sign/app/equipe" className="text-[#CEFF8F] hover:underline">Mon équipe</a>.</>
              : <>No active teammate. Add one from <a href="/sign/app/equipe" className="text-[#CEFF8F] hover:underline">My team</a>.</>}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {team.map((m) => {
              const on = assignedMemberIds.includes(m.id);
              const busy = assignBusy === m.id;
              const name = `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email;
              return (
                <button key={m.id} onClick={() => toggleMemberAssign(m.id)} disabled={busy}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${on ? 'border-[#CEFF8F] bg-[#CEFF8F]/10 text-[#CEFF8F]' : 'border-[#3A4242] text-[#A1A9A9] hover:border-[#A1A9A9]'}`}>
                  {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : on ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                  {name}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Instances */}
      <section className="mt-6 overflow-hidden rounded-xl border border-[#3A4242] bg-[#222828]">
        <div className="flex items-center gap-2 border-b border-[#3A4242] px-5 py-3 text-sm font-semibold text-white">
          <FileSignatureFallback /> {lang === 'fr' ? 'Signatures' : 'Signatures'} ({instances.length})
        </div>
        {instances.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-[#A1A9A9]">{lang === 'fr' ? 'Aucun lien généré pour le moment.' : 'No link generated yet.'}</p>
        ) : (
          <>
            <SignInstanceFilters value={filter} onChange={setFilter} />
            {filteredInstances.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-[#A1A9A9]">{lang === 'fr' ? `Aucune signature ne correspond ${isFilterActive(filter) ? 'à ces filtres' : ''}.` : `No signature matches${isFilterActive(filter) ? ' these filters' : ''}.`}</p>
            ) : (
          <ul className="divide-y divide-[#3A4242]">
            {filteredInstances.map((inst) => {
              const BADGES = instBadge(lang);
              const b = BADGES[inst.effectiveStatus] ?? BADGES.en_cours;
              const link = inst.signLink ?? (inst.signerToken ? signerLinkUrl(inst.signerToken) : null);
              return (
                <li key={inst.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[#1D2323]">
                  <span className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${b.cls}`}>{b.label}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-white">{inst.signerName || inst.signerEmail || 'Prospect'}</div>{/* 'Prospect' identique FR/EN */}
                    <div className="truncate text-xs text-[#A1A9A9]">{inst.signerEmail}</div>
                  </div>
                  <div className="shrink-0 text-xs text-[#A1A9A9]">
                    {inst.repLabel ? <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {inst.repLabel}</span> : <span className="text-[#6b7373]">{lang === 'fr' ? 'Vous' : 'You'}</span>}
                  </div>
                  <div className="hidden shrink-0 text-xs text-[#A1A9A9] sm:block">{fmtDate(inst.signedAt ?? inst.createdAt, lang)}</div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => openInstanceDoc(inst)}
                      disabled={viewerLoading === inst.id}
                      title={lang === 'fr' ? 'Voir le contrat en grand' : 'View the contract full-screen'}
                      className="rounded p-1.5 text-[#A1A9A9] transition-colors hover:bg-[#3A4242] hover:text-white disabled:opacity-50"
                    >
                      {viewerLoading === inst.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                    </button>
                    {inst.hasCertificate && (
                      <button
                        onClick={() => openCertificate(inst)}
                        disabled={certBusy === inst.id}
                        title={lang === 'fr' ? 'Voir le certificat de preuve' : 'View the proof certificate'}
                        className="rounded p-1.5 text-[#CEFF8F] transition-colors hover:bg-[#3A4242] disabled:opacity-50"
                      >
                        {certBusy === inst.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                      </button>
                    )}
                    {link && (inst.effectiveStatus === 'en_cours' || inst.effectiveStatus === 'consulte') && (
                      <button onClick={() => copy(`inst:${inst.id}`, link)} title={lang === 'fr' ? 'Copier le lien' : 'Copy link'} className="rounded p-1.5 text-[#A1A9A9] transition-colors hover:bg-[#3A4242] hover:text-white">
                        {copiedKey === `inst:${inst.id}` ? <Check className="h-4 w-4 text-[#CEFF8F]" /> : <Copy className="h-4 w-4" />}
                      </button>
                    )}
                    {inst.effectiveStatus === 'expire' && (
                      <button onClick={() => regen(inst)} disabled={busyInstance === inst.id} title={lang === 'fr' ? 'Régénérer un lien (7 j)' : 'Regenerate a link (7 days)'} className="rounded p-1.5 text-[#A1A9A9] transition-colors hover:bg-[#3A4242] hover:text-[#CEFF8F] disabled:opacity-50">
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

      {/* Aperçu « en grand » du contrat signé (lecture seule) */}
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
    </div>
  );
}

// Petit wrapper pour l'icône d'en-tête (évite un import inutilisé ailleurs).
function FileSignatureFallback() {
  return <CheckCircle2 className="h-4 w-4 text-[#CEFF8F]" />;
}
