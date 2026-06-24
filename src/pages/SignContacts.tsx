import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Users, Search, Mail, Phone, Trash2, X, User, Loader2, MapPin, FileDigit, Hash, Percent, Landmark, Tag,
  Folder, FolderPlus, ChevronDown, ChevronRight, FolderInput, Pencil, Check, Building2,
} from 'lucide-react';
import {
  listContacts, addContact, deleteContact,
  listContactGroups, createContactGroup, renameContactGroup, deleteContactGroup, setContactGroup,
  type SignContact, type SignContactGroup,
} from '../lib/signContracts';
import { loadCrmTree, materializeCrmPerson, type CrmTree, type CrmPerson } from '../lib/signCrm';
import PhoneInput from '../components/PhoneInput';
import PlacesInput from '../components/PlacesInput';

/**
 * CloseOS Sign — Contacts organisés en dossiers (groupes).
 * Un contact appartient à 0 ou 1 dossier ; les non-classés sont en « Sans dossier ».
 */

export default function SignContacts() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<SignContact[]>([]);
  const [groups, setGroups] = useState<SignContactGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', siret: '', siren: '', tva: '', company_id: '', ape: '', groupId: '' });
  const [saving, setSaving] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [moveFor, setMoveFor] = useState<string | null>(null);
  const [crm, setCrm] = useState<CrmTree | null>(null);
  const [crmExp, setCrmExp] = useState<Record<string, boolean>>({});
  const [crmBusy, setCrmBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, g, t] = await Promise.all([listContacts(), listContactGroups(), loadCrmTree().catch(() => null)]);
      setContacts(c);
      setGroups(g);
      setCrm(t);
    } catch (e) {
      console.error('[sign] chargement contacts/groupes', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleCrm = (k: string) => setCrmExp((p) => ({ ...p, [k]: !p[k] }));
  const openCrmPerson = async (p: CrmPerson) => {
    const key = `${p.kind}:${p.externalId}`;
    setCrmBusy(key);
    try {
      const real = await materializeCrmPerson(p);
      navigate(`/sign/app/contacts/${real.id}`);
    } catch (e) {
      console.error('[sign] ouvrir contact CRM', e);
    } finally {
      setCrmBusy(null);
    }
  };
  const CrmRow = (p: CrmPerson) => {
    const key = `${p.kind}:${p.externalId}`;
    const busy = crmBusy === key;
    const tag = p.kind === 'team' ? p.role : p.offerName;
    return (
      <li key={key} className="group flex items-center gap-3 border-b border-[#3A4242] px-5 py-3 transition-colors last:border-0 hover:bg-[#1D2323]">
        <button disabled={!!crmBusy} onClick={() => openCrmPerson(p)} className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:opacity-60" title="Ouvrir / créer la fiche contact">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#A0E7EC] text-xs font-bold text-[#191E1E]">{(p.name || p.email).slice(0, 1).toUpperCase()}</div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-white">{p.name}</span>
              {tag && <span className="shrink-0 rounded bg-[#191E1E] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#A1A9A9]">{tag}</span>}
            </div>
            <div className="flex items-center gap-3 text-xs text-[#A1A9A9]">
              <span className="inline-flex items-center gap-1 truncate"><Mail className="h-3 w-3 shrink-0" /> {p.email}</span>
              {p.phone && <span className="hidden items-center gap-1 sm:inline-flex"><Phone className="h-3 w-3" /> {p.phone}</span>}
            </div>
          </div>
        </button>
        {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#CEFF8F]" /> : <span className="hidden shrink-0 text-[10px] text-[#A1A9A9] opacity-0 transition-opacity group-hover:opacity-100 sm:block">Ouvrir la fiche →</span>}
      </li>
    );
  };

  useEffect(() => {
    document.title = 'Contacts | CloseOS Sign';
    load();
  }, [load]);

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;
    setSaving(true);
    try {
      await addContact({ name: form.name, email: form.email, phone: form.phone, address: form.address, siret: form.siret, siren: form.siren, tva: form.tva, company_id: form.company_id, ape: form.ape, groupId: form.groupId || null });
      setForm({ name: '', email: '', phone: '', address: '', siret: '', siren: '', tva: '', company_id: '', ape: '', groupId: '' });
      setShowAdd(false);
      await load();
    } catch (err) {
      console.error('[sign] ajout contact', err);
    } finally {
      setSaving(false);
    }
  };

  const removeContact = async (id: string) => {
    try {
      await deleteContact(id);
      setContacts((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error('[sign] suppression contact', err);
    }
  };

  const createGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return;
    setCreatingGroup(true);
    try {
      const g = await createContactGroup(name);
      setGroups((prev) => [...prev, g]);
      setNewGroupName('');
    } catch (err) {
      console.error('[sign] création dossier', err);
    } finally {
      setCreatingGroup(false);
    }
  };

  const renameGroup = async (g: SignContactGroup) => {
    const name = window.prompt('Renommer le dossier :', g.name)?.trim();
    if (!name || name === g.name) return;
    try {
      await renameContactGroup(g.id, name);
      setGroups((prev) => prev.map((x) => (x.id === g.id ? { ...x, name } : x)));
    } catch (err) {
      console.error('[sign] renommage dossier', err);
    }
  };

  const removeGroup = async (g: SignContactGroup) => {
    if (!window.confirm(`Supprimer le dossier « ${g.name} » ? Les contacts qu'il contient repasseront « Sans dossier ».`)) return;
    try {
      await deleteContactGroup(g.id);
      setGroups((prev) => prev.filter((x) => x.id !== g.id));
      setContacts((prev) => prev.map((c) => (c.groupId === g.id ? { ...c, groupId: null } : c)));
    } catch (err) {
      console.error('[sign] suppression dossier', err);
    }
  };

  const moveContact = async (contactId: string, groupId: string | null) => {
    setMoveFor(null);
    setContacts((prev) => prev.map((c) => (c.id === contactId ? { ...c, groupId } : c)));
    try {
      await setContactGroup(contactId, groupId);
    } catch (err) {
      console.error('[sign] déplacement contact', err);
      load();
    }
  };

  const q = query.trim().toLowerCase();
  const matches = (c: SignContact) => !q || `${c.name} ${c.email}`.toLowerCase().includes(q);
  const filtered = contacts.filter(matches);
  const ungrouped = filtered.filter((c) => !c.groupId);
  const searching = q.length > 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 md:px-10">
      {/* Header */}
      <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Contacts</h1>
          <p className="mt-2 text-sm text-[#A1A9A9]">Organisez vos signataires en dossiers. Ils s'enregistrent aussi automatiquement à la signature.</p>
        </div>
        <div className="flex w-full items-center gap-2 md:w-auto">
          <button
            onClick={() => setShowAdd(true)}
            className="flex w-full items-center justify-center gap-2 rounded bg-[#CEFF8F] px-5 py-2.5 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC] md:w-auto"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} /> Ajouter un contact
          </button>
        </div>
      </div>

      {/* Barre : recherche + créer un dossier */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un contact…"
            className="w-full rounded border border-[#3A4242] bg-[#191E1E] py-2.5 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-[#A1A9A9]/50 focus:border-[#CEFF8F]"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:flex-none">
            <FolderPlus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
            <input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') createGroup(); }}
              placeholder="Nouveau dossier…"
              className="w-full rounded border border-[#3A4242] bg-[#191E1E] py-2.5 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-[#A1A9A9]/50 focus:border-[#CEFF8F] sm:w-48"
            />
          </div>
          <button
            onClick={createGroup}
            disabled={creatingGroup || !newGroupName.trim()}
            className="flex shrink-0 items-center gap-1.5 rounded border border-[#3A4242] px-3 py-2.5 text-sm font-medium text-white transition-colors hover:border-[#CEFF8F] disabled:opacity-40"
          >
            {creatingGroup ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />} Créer
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded border border-[#3A4242] bg-[#222828] px-6 py-16 text-[#A1A9A9]">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : contacts.length === 0 && groups.length === 0 && !crm?.hasBusiness ? (
        <div className="flex flex-col items-center justify-center rounded border border-[#3A4242] bg-[#222828] px-6 py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded border border-dashed border-[#3A4242] bg-[#191E1E]">
            <Users className="h-6 w-6 text-[#A1A9A9]" />
          </div>
          <p className="text-sm text-[#F3F4F6]">Aucun contact pour le moment.</p>
          <p className="mt-1 max-w-xs text-xs text-[#A1A9A9]">Ajoutez vos clients, créez des dossiers, ou laissez-les s'enregistrer à la signature.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Dossier synchronisé CRM CloseOS (lecture seule, masqué pendant la recherche) */}
          {!searching && crm?.hasBusiness && (
            <div className="overflow-hidden rounded border border-[#CEFF8F]/30 bg-[#222828]">
              <button onClick={() => toggleCrm('crm')} className="flex w-full items-center gap-2.5 border-b border-[#3A4242] px-4 py-3 text-left">
                <ChevronDown className={`h-4 w-4 shrink-0 text-[#A1A9A9] transition-transform ${crmExp.crm ? '' : '-rotate-90'}`} />
                <Building2 className="h-4 w-4 shrink-0 text-[#CEFF8F]" />
                <span className="truncate text-sm font-semibold text-white">CRM CloseOS</span>
                <span className="shrink-0 rounded-full bg-[#CEFF8F]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#CEFF8F]">Synchronisé</span>
                <span className="ml-auto hidden text-xs text-[#A1A9A9] md:block">En direct depuis CloseOS Business</span>
              </button>
              {crmExp.crm && (
                <div className="divide-y divide-[#3A4242]">
                  {/* Prospects (clients gagnés) par offre */}
                  <div>
                    <button onClick={() => toggleCrm('prospects')} className="flex w-full items-center gap-2.5 px-4 py-2.5 pl-6 text-left transition-colors hover:bg-[#1D2323]">
                      <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-[#A1A9A9] transition-transform ${crmExp.prospects ? '' : '-rotate-90'}`} />
                      <Folder className="h-3.5 w-3.5 shrink-0 text-[#A0E7EC]" />
                      <span className="text-sm font-medium text-white">Prospects</span>
                      <span className="rounded-full bg-[#191E1E] px-2 py-0.5 text-[10px] font-bold text-[#A1A9A9]">{crm.totalProspects}</span>
                      <span className="ml-1 text-xs text-[#A1A9A9]">clients gagnés</span>
                    </button>
                    {crmExp.prospects &&
                      (crm.prospectOffers.length === 0 ? (
                        <p className="px-5 py-4 pl-10 text-xs text-[#A1A9A9]">Aucun client gagné dans le CRM.</p>
                      ) : (
                        crm.prospectOffers.map((g) => {
                          const okey = `offer:${g.offerId ?? 'none'}`;
                          return (
                            <div key={okey}>
                              <button onClick={() => toggleCrm(okey)} className="flex w-full items-center gap-2.5 px-4 py-2 pl-10 text-left transition-colors hover:bg-[#1D2323]">
                                <ChevronRight className={`h-3 w-3 shrink-0 text-[#A1A9A9] transition-transform ${crmExp[okey] ? 'rotate-90' : ''}`} />
                                <Tag className="h-3 w-3 shrink-0 text-[#A1A9A9]" />
                                <span className="truncate text-sm text-white">{g.offerName}</span>
                                <span className="rounded-full bg-[#191E1E] px-2 py-0.5 text-[10px] font-bold text-[#A1A9A9]">{g.people.length}</span>
                              </button>
                              {crmExp[okey] && <ul>{g.people.map(CrmRow)}</ul>}
                            </div>
                          );
                        })
                      ))}
                  </div>
                  {/* Équipe (formule Business / Business + Acquisition) */}
                  {crm.showTeam && (
                    <div>
                      <button onClick={() => toggleCrm('team')} className="flex w-full items-center gap-2.5 px-4 py-2.5 pl-6 text-left transition-colors hover:bg-[#1D2323]">
                        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-[#A1A9A9] transition-transform ${crmExp.team ? '' : '-rotate-90'}`} />
                        <Users className="h-3.5 w-3.5 shrink-0 text-[#A0E7EC]" />
                        <span className="text-sm font-medium text-white">Équipe</span>
                        <span className="rounded-full bg-[#191E1E] px-2 py-0.5 text-[10px] font-bold text-[#A1A9A9]">{crm.team.length}</span>
                      </button>
                      {crmExp.team &&
                        (crm.team.length === 0 ? (
                          <p className="px-5 py-4 pl-10 text-xs text-[#A1A9A9]">Aucun membre d'équipe.</p>
                        ) : (
                          <ul>{crm.team.map(CrmRow)}</ul>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Dossiers (masqués pendant la recherche pour aplatir les résultats) */}
          {!searching && groups.map((g) => {
            const items = contacts.filter((c) => c.groupId === g.id);
            const isCollapsed = collapsed[g.id];
            return (
              <div key={g.id} className="overflow-hidden rounded border border-[#3A4242] bg-[#222828]">
                <div className="flex items-center justify-between gap-2 border-b border-[#3A4242] px-4 py-3">
                  <button onClick={() => setCollapsed((p) => ({ ...p, [g.id]: !p[g.id] }))} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                    <ChevronDown className={`h-4 w-4 shrink-0 text-[#A1A9A9] transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                    <Folder className="h-4 w-4 shrink-0 text-[#CEFF8F]" />
                    <span className="truncate text-sm font-semibold text-white">{g.name}</span>
                    <span className="shrink-0 rounded-full bg-[#191E1E] px-2 py-0.5 text-[10px] font-bold text-[#A1A9A9]">{items.length}</span>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <button onClick={() => renameGroup(g)} title="Renommer" className="rounded p-1.5 text-[#A1A9A9] transition-colors hover:bg-[#3A4242] hover:text-white"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => removeGroup(g)} title="Supprimer le dossier" className="rounded p-1.5 text-[#A1A9A9] transition-colors hover:bg-[#3A4242] hover:text-[#ef6b6b]"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                {!isCollapsed && (
                  items.length === 0 ? (
                    <p className="px-5 py-5 text-center text-xs text-[#A1A9A9]">Dossier vide — déplacez des contacts ici.</p>
                  ) : (
                    <ul>
                      {items.map((c) => (
                        <ContactRow key={c.id} c={c} groups={groups} navigate={navigate} onRemove={removeContact} onMove={moveContact} moveOpen={moveFor === c.id} setMoveFor={setMoveFor} />
                      ))}
                    </ul>
                  )
                )}
              </div>
            );
          })}

          {/* Sans dossier (ou résultats de recherche aplatis) */}
          <div className="overflow-hidden rounded border border-[#3A4242] bg-[#222828]">
            <div className="border-b border-[#3A4242] px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">
              {searching ? `Résultats (${filtered.length})` : `Sans dossier (${ungrouped.length})`}
            </div>
            {(searching ? filtered : ungrouped).length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-[#A1A9A9]">{searching ? 'Aucun résultat.' : 'Tous vos contacts sont classés.'}</p>
            ) : (
              <ul>
                {(searching ? filtered : ungrouped).map((c) => (
                  <ContactRow key={c.id} c={c} groups={groups} navigate={navigate} onRemove={removeContact} onMove={moveContact} moveOpen={moveFor === c.id} setMoveFor={setMoveFor} />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Modal ajout */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded border border-[#3A4242] bg-[#222828] p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Nouveau contact</h3>
              <button onClick={() => setShowAdd(false)} className="text-[#A1A9A9] transition-colors hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={submitAdd} className="space-y-4">
              <Field icon={User} label="Nom complet" required value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Marc Dupont" />
              <Field icon={Mail} label="Email" required type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="marc@exemple.fr" />
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">Dossier <span className="text-[#A1A9A9]/60">(facultatif)</span></label>
                <div className="relative">
                  <Folder className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
                  <select
                    value={form.groupId}
                    onChange={(e) => setForm({ ...form, groupId: e.target.value })}
                    className="w-full appearance-none rounded border border-[#3A4242] bg-[#191E1E] py-2.5 pl-10 pr-9 text-sm text-white outline-none transition-colors focus:border-[#CEFF8F]"
                  >
                    <option value="">Sans dossier</option>
                    {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">Téléphone <span className="text-[#A1A9A9]/60">(facultatif)</span></label>
                <PhoneInput value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">Adresse complète <span className="text-[#A1A9A9]/60">(facultatif)</span></label>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
                  <PlacesInput variant="dark" mode="address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} placeholder="12 rue de Paris, 75001 Paris" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <CompactField icon={FileDigit} label="SIRET" value={form.siret} onChange={(v) => setForm({ ...form, siret: v })} placeholder="14 chiffres (FR)" />
                <CompactField icon={Hash} label="SIREN" value={form.siren} onChange={(v) => setForm({ ...form, siren: v })} placeholder="9 chiffres (FR)" />
                <CompactField icon={Percent} label="N° de TVA" value={form.tva} onChange={(v) => setForm({ ...form, tva: v })} placeholder="FR12345678901" />
                <CompactField icon={Landmark} label="N° d'entreprise" value={form.company_id} onChange={(v) => setForm({ ...form, company_id: v })} placeholder="Registre national" />
                <CompactField icon={Tag} label="Code APE/NAF" value={form.ape} onChange={(v) => setForm({ ...form, ape: v })} placeholder="6201Z" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="rounded border border-[#3A4242] px-4 py-2 text-sm font-medium text-[#A1A9A9] transition-colors hover:border-[#A1A9A9] hover:text-white">Annuler</button>
                <button type="submit" disabled={saving} className="flex items-center gap-1.5 rounded bg-[#CEFF8F] px-4 py-2 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC] disabled:opacity-60">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" strokeWidth={2.5} />} Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ContactRow({
  c, groups, navigate, onRemove, onMove, moveOpen, setMoveFor,
}: {
  c: SignContact;
  groups: SignContactGroup[];
  navigate: (p: string) => void;
  onRemove: (id: string) => void;
  onMove: (contactId: string, groupId: string | null) => void;
  moveOpen: boolean;
  setMoveFor: (id: string | null) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!moveOpen) return;
    const onDoc = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMoveFor(null); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [moveOpen, setMoveFor]);

  return (
    <li className="group flex items-center gap-4 border-b border-[#3A4242] px-5 py-4 transition-colors last:border-0 hover:bg-[#1D2323]">
      <button onClick={() => navigate(`/sign/app/contacts/${c.id}`)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#CEFF8F] text-xs font-bold text-[#191E1E]">{(c.name || c.email).slice(0, 1).toUpperCase()}</div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-white">{c.name}</div>
          <div className="flex items-center gap-3 text-xs text-[#A1A9A9]">
            <span className="inline-flex items-center gap-1 truncate"><Mail className="h-3 w-3 shrink-0" /> {c.email}</span>
            {c.phone && <span className="hidden items-center gap-1 sm:inline-flex"><Phone className="h-3 w-3" /> {c.phone}</span>}
          </div>
        </div>
      </button>
      <div className="flex shrink-0 items-center gap-1">
        {/* Déplacer vers un dossier */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMoveFor(moveOpen ? null : c.id)}
            title="Déplacer vers un dossier"
            className="rounded p-1.5 text-[#A1A9A9] opacity-0 transition-all hover:bg-[#3A4242] hover:text-white group-hover:opacity-100"
          >
            <FolderInput className="h-4 w-4" />
          </button>
          {moveOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-lg border border-[#3A4242] bg-[#222828] shadow-2xl">
              <div className="border-b border-[#3A4242] px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">Déplacer vers</div>
              <ul className="max-h-56 overflow-y-auto py-1">
                <li>
                  <button onClick={() => onMove(c.id, null)} className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[#191E1E] ${!c.groupId ? 'text-[#CEFF8F]' : 'text-[#F3F4F6]'}`}>
                    <X className="h-3.5 w-3.5" /> Sans dossier {!c.groupId && <Check className="ml-auto h-3.5 w-3.5" />}
                  </button>
                </li>
                {groups.map((g) => (
                  <li key={g.id}>
                    <button onClick={() => onMove(c.id, g.id)} className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[#191E1E] ${c.groupId === g.id ? 'text-[#CEFF8F]' : 'text-[#F3F4F6]'}`}>
                      <Folder className="h-3.5 w-3.5" /> <span className="flex-1 truncate">{g.name}</span> {c.groupId === g.id && <Check className="h-3.5 w-3.5" />}
                    </button>
                  </li>
                ))}
                {groups.length === 0 && <li className="px-3 py-2 text-center text-xs text-[#A1A9A9]">Aucun dossier</li>}
              </ul>
            </div>
          )}
        </div>
        <button onClick={() => onRemove(c.id)} title="Supprimer" className="rounded p-1.5 text-[#A1A9A9] opacity-0 transition-all hover:bg-[#3A4242] hover:text-[#ef6b6b] group-hover:opacity-100">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}

function Field({ icon: Icon, label, value, onChange, placeholder, type = 'text', required = false }: { icon: typeof Mail; label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">{label}</label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
        <input type={type} required={required} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded border border-[#3A4242] bg-[#191E1E] py-2.5 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-[#A1A9A9]/40 focus:border-[#CEFF8F]" />
      </div>
    </div>
  );
}

function CompactField({ icon: Icon, label, value, onChange, placeholder }: { icon: typeof Mail; label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">{label} <span className="text-[#A1A9A9]/60">(facultatif)</span></label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded border border-[#3A4242] bg-[#191E1E] py-2.5 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-[#A1A9A9]/40 focus:border-[#CEFF8F]" />
      </div>
    </div>
  );
}
