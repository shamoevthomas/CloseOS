import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Copy, Check, RefreshCw, LogOut, Plus, Link2, FileSignature } from 'lucide-react';
import { SignLogo } from '../components/SignLogo';
import { useSignLang } from '../contexts/SignLangContext';
import { signOutSign } from '../lib/signAuth';
import { useSignMember } from '../lib/signMemberAuth';
import {
  memberListInstances, memberGenerateLink, memberRegenerate, signerLink,
  type MemberInstance,
} from '../lib/signTeam';

const BADGE = (fr: boolean): Record<MemberInstance['effectiveStatus'], { label: string; cls: string }> => ({
  en_cours: { label: fr ? 'En cours' : 'In progress', cls: 'text-[#A0E7EC] border-[#A0E7EC]/30 bg-[#A0E7EC]/10' },
  consulte: { label: fr ? 'Consulté' : 'Viewed', cls: 'text-[#A0E7EC] border-[#A0E7EC]/30 bg-[#A0E7EC]/10' },
  signe: { label: fr ? 'Signé' : 'Signed', cls: 'text-[#CEFF8F] border-[#CEFF8F]/30 bg-[#CEFF8F]/10' },
  paye: { label: fr ? 'Signé + Payé' : 'Signed + Paid', cls: 'text-[#191E1E] border-[#CEFF8F] bg-[#CEFF8F]' },
  expire: { label: fr ? 'Expiré' : 'Expired', cls: 'text-[#A1A9A9] border-[#3A4242] bg-[#191E1E]' },
  refuse: { label: fr ? 'Refusé' : 'Declined', cls: 'text-[#ef6b6b] border-[#ef6b6b]/30 bg-[#ef6b6b]/10' },
});

const INPUT = 'w-full rounded-lg border border-[#3A4242] bg-[#191E1E] px-3 py-2.5 text-sm text-[#F3F4F6] outline-none transition-colors placeholder:text-[#A1A9A9]/40 focus:border-[#CEFF8F]';

export default function SignMemberSpace() {
  const { lang } = useSignLang();
  const fr = lang === 'fr';
  const { loading: memberLoading, member } = useSignMember();

  const [instances, setInstances] = useState<MemberInstance[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [templateId, setTemplateId] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [regenId, setRegenId] = useState<string | null>(null);

  const templates = member?.templates ?? [];

  const loadList = useCallback(async () => {
    setLoadingList(true);
    try { setInstances(await memberListInstances()); } finally { setLoadingList(false); }
  }, []);

  useEffect(() => { if (member) loadList(); }, [member, loadList]);
  useEffect(() => { if (templates.length && !templateId) setTemplateId(templates[0].id); }, [templates, templateId]);

  const counts = useMemo(() => ({
    total: instances.length,
    pending: instances.filter(i => i.effectiveStatus === 'en_cours' || i.effectiveStatus === 'consulte').length,
    signed: instances.filter(i => i.effectiveStatus === 'signe' || i.effectiveStatus === 'paye').length,
    expired: instances.filter(i => i.effectiveStatus === 'expire').length,
  }), [instances]);

  const copy = async (key: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1800); } catch { /* noop */ }
  };

  const handleGenerate = async () => {
    if (!templateId || !form.email.trim() || generating) return;
    setGenerating(true); setGenError('');
    try {
      const { token } = await memberGenerateLink(templateId, { name: form.name, email: form.email, phone: form.phone });
      await copy('new', signerLink(token));
      setForm({ name: '', email: '', phone: '' });
      await loadList();
    } catch (e: any) {
      setGenError(e?.message === 'non_autorise' ? (fr ? "Ce template ne t'est pas assigné." : 'This template is not assigned to you.') : (fr ? 'Échec de la génération.' : 'Generation failed.'));
    } finally { setGenerating(false); }
  };

  const handleRegenerate = async (id: string) => {
    setRegenId(id);
    try { const { link } = await memberRegenerate(id); await copy(`inst:${id}`, link); await loadList(); }
    catch { /* noop */ }
    finally { setRegenId(null); }
  };

  if (memberLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#191E1E]"><Loader2 className="h-6 w-6 animate-spin text-[#CEFF8F]" /></div>;
  }

  const badges = BADGE(fr);

  return (
    <div className="min-h-screen bg-[#191E1E] text-[#F3F4F6]">
      {/* Header */}
      <div className="border-b border-[#3A4242] px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2">
          <SignLogo className="text-lg" />
          <div className="flex items-center gap-4">
            {member?.owner_name && (
              <span className="hidden sm:inline text-xs text-[#A1A9A9]">{fr ? 'Équipe de' : 'Team of'} <span className="font-semibold text-[#F3F4F6]">{member.owner_name}</span></span>
            )}
            <button onClick={() => signOutSign()} className="flex items-center gap-1.5 text-xs text-[#A1A9A9] hover:text-[#F3F4F6] transition-colors">
              <LogOut className="h-4 w-4" /> {fr ? 'Déconnexion' : 'Log out'}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-8">
        {/* Titre */}
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{fr ? `Bonjour ${member?.first_name || ''}`.trim() : `Hi ${member?.first_name || ''}`.trim()}</h1>
          <p className="mt-1 text-sm text-[#A1A9A9]">{fr ? 'Génère tes contrats et suis leurs statuts.' : 'Generate your contracts and track their status.'}</p>
        </div>

        {/* Générer un contrat */}
        <div className="rounded-2xl border border-[#3A4242] bg-[#222828] p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#CEFF8F]/15"><Plus className="h-4 w-4 text-[#CEFF8F]" /></div>
            <h2 className="text-base font-bold">{fr ? 'Générer un contrat' : 'Generate a contract'}</h2>
          </div>

          {templates.length === 0 ? (
            <p className="text-sm text-[#A1A9A9] italic py-3">{fr ? "Aucun modèle ne t'a encore été assigné. Contacte ton responsable." : 'No template assigned to you yet. Contact your manager.'}</p>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-[#A1A9A9]">{fr ? 'Modèle' : 'Template'}</label>
                <select value={templateId} onChange={e => setTemplateId(e.target.value)} className={INPUT}>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.title || (fr ? 'Contrat' : 'Contract')}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input className={INPUT} placeholder={fr ? 'Nom du prospect' : 'Prospect name'} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                <input className={INPUT} placeholder="Email *" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                <input className={INPUT} placeholder={fr ? 'Téléphone' : 'Phone'} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              {genError && <p className="text-xs text-[#ef6b6b]">{genError}</p>}
              <button
                onClick={handleGenerate}
                disabled={!templateId || !form.email.trim() || generating}
                className="flex items-center gap-2 rounded-full bg-[#CEFF8F] px-5 py-2.5 text-sm font-bold text-[#191E1E] hover:bg-[#bdf06f] disabled:opacity-40 transition-all"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                {fr ? 'Générer le lien' : 'Generate link'}
              </button>
              {copied === 'new' && <p className="text-xs text-[#CEFF8F] flex items-center gap-1"><Check className="h-3.5 w-3.5" /> {fr ? 'Lien copié dans le presse-papier !' : 'Link copied to clipboard!'}</p>}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: fr ? 'Total' : 'Total', value: counts.total, color: 'text-[#F3F4F6]' },
            { label: fr ? 'En cours' : 'In progress', value: counts.pending, color: 'text-[#A0E7EC]' },
            { label: fr ? 'Signés' : 'Signed', value: counts.signed, color: 'text-[#CEFF8F]' },
            { label: fr ? 'Expirés' : 'Expired', value: counts.expired, color: 'text-[#A1A9A9]' },
          ].map((s, i) => (
            <div key={i} className="rounded-xl border border-[#3A4242] bg-[#222828] p-4">
              <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
              <p className="text-[11px] uppercase tracking-widest text-[#A1A9A9] mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Mes contrats */}
        <div>
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold"><FileSignature className="h-4 w-4 text-[#CEFF8F]" /> {fr ? 'Mes contrats' : 'My contracts'} ({instances.length})</h2>
          {loadingList ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-[#A1A9A9]" /></div>
          ) : instances.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#3A4242] py-12 text-center">
              <p className="text-sm text-[#A1A9A9]">{fr ? 'Aucun contrat généré pour le moment.' : 'No contract generated yet.'}</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {instances.map(inst => {
                const b = badges[inst.effectiveStatus] ?? badges.en_cours;
                const active = inst.effectiveStatus === 'en_cours' || inst.effectiveStatus === 'consulte';
                const link = active && inst.signerToken ? signerLink(inst.signerToken) : null;
                return (
                  <div key={inst.id} className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-[#3A4242] bg-[#222828] px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[#F3F4F6] truncate">{inst.signerName || inst.signerEmail || (fr ? 'Sans nom' : 'No name')}</p>
                      <p className="text-xs text-[#A1A9A9] truncate">{inst.title}{inst.signerEmail ? ` · ${inst.signerEmail}` : ''}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${b.cls}`}>{b.label}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      {link && (
                        <button onClick={() => copy(`inst:${inst.id}`, link)} className="flex items-center gap-1 rounded-lg border border-[#3A4242] px-2.5 py-1.5 text-xs text-[#A1A9A9] hover:text-[#F3F4F6] hover:border-[#A1A9A9] transition-colors">
                          {copied === `inst:${inst.id}` ? <Check className="h-3.5 w-3.5 text-[#CEFF8F]" /> : <Copy className="h-3.5 w-3.5" />} {fr ? 'Lien' : 'Link'}
                        </button>
                      )}
                      {inst.effectiveStatus === 'expire' && (
                        <button onClick={() => handleRegenerate(inst.id)} disabled={regenId === inst.id} className="flex items-center gap-1 rounded-lg border border-[#3A4242] px-2.5 py-1.5 text-xs text-[#A1A9A9] hover:text-[#F3F4F6] hover:border-[#A1A9A9] transition-colors disabled:opacity-50">
                          {regenId === inst.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} {fr ? 'Régénérer' : 'Regenerate'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
