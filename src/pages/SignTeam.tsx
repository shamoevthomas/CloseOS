import { useCallback, useEffect, useState } from 'react';
import { Loader2, Copy, Check, UserPlus, RefreshCw, Trash2, Users, Ban, RotateCcw, Layers, ChevronDown, Link2 } from 'lucide-react';
import { useSignLang } from '../contexts/SignLangContext';
import toast from 'react-hot-toast';
import {
  listTeamMembers, listInvites, createInvite, revokeInvite, setMemberStatus, deleteMember,
  syncBusinessTeam, listOwnerTemplates, listMemberTemplateIds, assignTemplate, unassignTemplate,
  type SignTeamMember, type SignTeamInvite,
} from '../lib/signTeam';

const CARD = 'rounded-2xl border border-[#3A4242] bg-[#222828]';
const BTN_LIME = 'flex items-center gap-2 rounded-full bg-[#CEFF8F] px-4 py-2 text-sm font-bold text-[#191E1E] hover:bg-[#bdf06f] disabled:opacity-50 transition-all';
const BTN_GHOST = 'flex items-center gap-1.5 rounded-full border border-[#3A4242] px-3 py-1.5 text-xs text-[#A1A9A9] hover:text-[#F3F4F6] hover:border-[#A1A9A9] disabled:opacity-50 transition-colors';

const memberName = (m: SignTeamMember, fr: boolean) =>
  `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email || (fr ? 'Membre' : 'Member');

export default function SignTeam() {
  const { lang } = useSignLang();
  const fr = lang === 'fr';

  const [members, setMembers] = useState<SignTeamMember[]>([]);
  const [invites, setInvites] = useState<SignTeamInvite[]>([]);
  const [templates, setTemplates] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [assigned, setAssigned] = useState<Record<string, string[]>>({});
  const [assignBusy, setAssignBusy] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [m, i, t] = await Promise.all([listTeamMembers(), listInvites(), listOwnerTemplates()]);
      setMembers(m); setInvites(i); setTemplates(t);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const copy = async (key: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1800); } catch { /* noop */ }
  };

  const handleSync = async () => {
    setSyncing(true);
    try { const n = await syncBusinessTeam(); toast.success(fr ? `${n} membre(s) synchronisé(s)` : `${n} member(s) synced`); await reload(); }
    catch (e: any) { toast.error(e?.message === 'pas_owner_sign' ? (fr ? 'Réservé aux propriétaires Sign.' : 'Sign owners only.') : (fr ? 'Échec de la synchro' : 'Sync failed')); }
    finally { setSyncing(false); }
  };

  const handleInvite = async () => {
    setInviting(true);
    try { const { link } = await createInvite(); await copy('new-invite', link); toast.success(fr ? 'Lien d’invitation copié' : 'Invite link copied'); await reload(); }
    catch { toast.error(fr ? 'Échec de la création du lien' : 'Failed to create link'); }
    finally { setInviting(false); }
  };

  const toggleExpand = async (memberId: string) => {
    if (expanded === memberId) { setExpanded(null); return; }
    setExpanded(memberId);
    if (!assigned[memberId]) {
      const ids = await listMemberTemplateIds(memberId);
      setAssigned(prev => ({ ...prev, [memberId]: ids }));
    }
  };

  const toggleTemplate = async (memberId: string, templateId: string) => {
    const has = (assigned[memberId] || []).includes(templateId);
    setAssignBusy(`${memberId}:${templateId}`);
    try {
      if (has) { await unassignTemplate(templateId, memberId); setAssigned(p => ({ ...p, [memberId]: (p[memberId] || []).filter(x => x !== templateId) })); }
      else { await assignTemplate(templateId, memberId); setAssigned(p => ({ ...p, [memberId]: [...(p[memberId] || []), templateId] })); }
    } catch { toast.error(fr ? 'Erreur' : 'Error'); }
    finally { setAssignBusy(null); }
  };

  const statusPill = (m: SignTeamMember) => {
    if (m.status === 'active') return <span className="rounded-full border border-[#CEFF8F]/30 bg-[#CEFF8F]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#CEFF8F]">{fr ? 'Actif' : 'Active'}</span>;
    if (m.status === 'invited') return <span className="rounded-full border border-[#A0E7EC]/30 bg-[#A0E7EC]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#A0E7EC]">{fr ? 'Invité' : 'Invited'}</span>;
    return <span className="rounded-full border border-[#3A4242] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#A1A9A9]">{fr ? 'Révoqué' : 'Revoked'}</span>;
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 text-[#F3F4F6] sm:px-6 sm:py-10 md:px-10">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight"><Users className="h-6 w-6 text-[#CEFF8F]" /> {fr ? 'Mon équipe' : 'My team'}</h1>
          <p className="mt-1 text-sm text-[#A1A9A9]">{fr ? 'Invitez des équipiers et assignez-leur des modèles de contrat.' : 'Invite teammates and assign them contract templates.'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSync} disabled={syncing} className={BTN_GHOST + ' !px-4 !py-2 !text-sm'}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {fr ? 'Sync équipe Business' : 'Sync Business team'}
          </button>
          <button onClick={handleInvite} disabled={inviting} className={BTN_LIME}>
            {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} {fr ? 'Inviter' : 'Invite'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#A1A9A9]" /></div>
      ) : (
        <div className="space-y-8">
          {/* Invitations en attente */}
          {invites.length > 0 && (
            <div className={CARD + ' p-5'}>
              <h2 className="mb-3 text-sm font-bold text-[#A1A9A9] uppercase tracking-widest">{fr ? 'Invitations en attente' : 'Pending invites'}</h2>
              <div className="space-y-2">
                {invites.map(inv => {
                  const link = `${window.location.origin}/sign/join/${inv.token}`;
                  return (
                    <div key={inv.id} className="flex items-center gap-3 rounded-xl border border-[#3A4242] bg-[#191E1E] px-4 py-2.5">
                      <Link2 className="h-4 w-4 text-[#A1A9A9] shrink-0" />
                      <span className="min-w-0 flex-1 truncate text-xs text-[#A1A9A9]">{inv.email || link}</span>
                      <button onClick={() => copy(`inv:${inv.id}`, link)} className={BTN_GHOST}>{copied === `inv:${inv.id}` ? <Check className="h-3.5 w-3.5 text-[#CEFF8F]" /> : <Copy className="h-3.5 w-3.5" />} {fr ? 'Copier' : 'Copy'}</button>
                      <button onClick={() => revokeInvite(inv.id).then(reload)} className="text-[#A1A9A9] hover:text-[#ef6b6b] transition-colors"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Membres */}
          <div>
            <h2 className="mb-3 text-sm font-bold text-[#A1A9A9] uppercase tracking-widest">{fr ? 'Membres' : 'Members'} ({members.length})</h2>
            {members.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#3A4242] py-12 text-center">
                <p className="text-sm text-[#A1A9A9]">{fr ? 'Aucun membre. Invitez quelqu’un ou synchronisez votre équipe Business.' : 'No member yet. Invite someone or sync your Business team.'}</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {members.map(m => {
                  const isOpen = expanded === m.id;
                  const memAssigned = assigned[m.id] || [];
                  return (
                    <div key={m.id} className={CARD}>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#191E1E] border border-[#3A4242] text-xs font-bold uppercase">{memberName(m, fr).charAt(0)}</div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[#F3F4F6] truncate">{memberName(m, fr)}</p>
                            <p className="text-xs text-[#A1A9A9] truncate">{m.email}{m.source === 'business' ? ' · Business' : ''}</p>
                          </div>
                        </div>
                        {statusPill(m)}
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => toggleExpand(m.id)} className={BTN_GHOST}>
                            <Layers className="h-3.5 w-3.5" /> {fr ? 'Modèles' : 'Templates'} <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                          </button>
                          {m.status === 'revoked'
                            ? <button onClick={() => setMemberStatus(m.id, 'active').then(reload)} className={BTN_GHOST}><RotateCcw className="h-3.5 w-3.5" /> {fr ? 'Réactiver' : 'Reactivate'}</button>
                            : <button onClick={() => setMemberStatus(m.id, 'revoked').then(reload)} className={BTN_GHOST}><Ban className="h-3.5 w-3.5" /> {fr ? 'Révoquer' : 'Revoke'}</button>}
                          <button onClick={() => { if (confirm(fr ? 'Supprimer ce membre ?' : 'Delete this member?')) deleteMember(m.id).then(reload); }} className="text-[#A1A9A9] hover:text-[#ef6b6b] transition-colors"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </div>

                      {isOpen && (
                        <div className="border-t border-[#3A4242] px-4 py-3">
                          {templates.length === 0 ? (
                            <p className="text-xs text-[#A1A9A9] italic">{fr ? 'Créez d’abord des modèles de contrat.' : 'Create contract templates first.'}</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {templates.map(t => {
                                const on = memAssigned.includes(t.id);
                                const busy = assignBusy === `${m.id}:${t.id}`;
                                return (
                                  <button key={t.id} onClick={() => toggleTemplate(m.id, t.id)} disabled={busy}
                                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${on ? 'border-[#CEFF8F] bg-[#CEFF8F]/10 text-[#CEFF8F]' : 'border-[#3A4242] text-[#A1A9A9] hover:border-[#A1A9A9]'}`}>
                                    {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : on ? <Check className="h-3 w-3" /> : <Layers className="h-3 w-3" />}
                                    {t.title || (fr ? 'Contrat' : 'Contract')}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
