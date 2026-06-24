import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Mail, Phone, MapPin, FileDigit, Hash, Percent, Landmark, Tag, FileText,
  Loader2, Send, Eye, Download, CheckCircle2, Clock, ChevronRight, Activity, IdCard,
  Pencil, Check, X, Trash2, Plus, Folder, ChevronDown,
} from 'lucide-react';
import {
  getContactById, getContactDossier, updateSignContact, listContactGroups, setContactGroup,
  type SignContact, type ContactContract, type ContactActivity, type SignContactGroup,
} from '../lib/signContracts';

/**
 * CloseOS Sign — Fiche contact en pleine page.
 * Gauche : identité (haut) + champs préremplis (bas).
 * Milieu : historique d'activité (ouvert / téléchargé / validé, avec date & heure).
 * Droite : rail enroulé qui se déroule au survol — liste des contrats assignés.
 */

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Brouillon', cls: 'text-[#A1A9A9] border-[#3A4242] bg-[#191E1E]' },
  pending: { label: 'En attente', cls: 'text-[#A0E7EC] border-[#A0E7EC]/30 bg-[#A0E7EC]/10' },
  sent: { label: 'Envoyé', cls: 'text-[#CEFF8F] border-[#CEFF8F]/30 bg-[#CEFF8F]/10' },
  viewed: { label: 'Consulté', cls: 'text-[#CEFF8F] border-[#CEFF8F]/30 bg-[#CEFF8F]/10' },
  signed: { label: 'Signé', cls: 'text-[#CEFF8F] border-[#CEFF8F]/30 bg-[#CEFF8F]/10' },
  paid: { label: 'Signé + Payé', cls: 'text-[#191E1E] border-[#CEFF8F] bg-[#CEFF8F]' },
  declined: { label: 'Refusé', cls: 'text-red-400 border-red-500/30 bg-red-500/10' },
  expired: { label: 'Expiré', cls: 'text-[#A1A9A9] border-[#3A4242] bg-[#191E1E]' },
  cancelled: { label: 'Annulé', cls: 'text-[#A1A9A9] border-[#3A4242] bg-[#191E1E]' },
};

const EVENT: Record<string, { label: string; icon: typeof Mail; color: string }> = {
  sent: { label: 'Contrat envoyé', icon: Send, color: '#A0E7EC' },
  opened: { label: 'Contrat ouvert', icon: Eye, color: '#CEFF8F' },
  downloaded: { label: 'Contrat téléchargé', icon: Download, color: '#A0E7EC' },
  signed: { label: 'Contrat signé & validé', icon: CheckCircle2, color: '#CEFF8F' },
};

function fmtDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
    time: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  };
}

export default function SignContactDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [contact, setContact] = useState<SignContact | null>(null);
  const [contracts, setContracts] = useState<ContactContract[]>([]);
  const [activity, setActivity] = useState<ContactActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [groups, setGroups] = useState<SignContactGroup[]>([]);

  // Édition de l'identité (nom / email / téléphone)
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const c = await getContactById(id);
      if (!c) { setNotFound(true); return; }
      setContact(c);
      listContactGroups().then(setGroups).catch(() => {});
      const dossier = await getContactDossier(id);
      setContracts(dossier.contracts);
      setActivity(dossier.activity);
    } catch (e) {
      console.error('[sign] fiche contact', e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    document.title = 'Fiche contact | CloseOS Sign';
    load();
  }, [load]);

  const startEdit = () => {
    if (!contact) return;
    setForm({ name: contact.name, email: contact.email, phone: contact.phone });
    setEditing(true);
  };

  const saveIdentity = async () => {
    if (!contact || !id) return;
    setSaving(true);
    try {
      await updateSignContact(id, { name: form.name, email: form.email, phone: form.phone });
      setContact({ ...contact, name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() });
      setEditing(false);
    } catch (e) {
      console.error('[sign] maj identité contact', e);
    } finally {
      setSaving(false);
    }
  };

  // Suppression d'un champ enregistré : colonne dédiée → NULL, sinon clé de `details`.
  const removeField = async (kind: 'column' | 'detail', key: string) => {
    if (!contact || !id) return;
    try {
      if (kind === 'column') {
        await updateSignContact(id, { [key]: '' } as Partial<SignContact>);
        setContact({ ...contact, [key]: '' });
      } else {
        const details = { ...(contact.details || {}) };
        delete details[key];
        await updateSignContact(id, { details });
        setContact({ ...contact, details });
      }
    } catch (e) {
      console.error('[sign] suppression champ enregistré', e);
    }
  };

  // Range ou retire le contact d'un dossier.
  const changeGroup = async (groupId: string | null) => {
    if (!contact || !id) return;
    setContact({ ...contact, groupId });
    try {
      await setContactGroup(id, groupId);
    } catch (e) {
      console.error('[sign] dossier contact', e);
      load();
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-[#A1A9A9]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (notFound || !contact) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center px-6 py-24 text-center">
        <p className="text-sm text-[#F3F4F6]">Ce contact est introuvable.</p>
        <Link to="/sign/app/contacts" className="mt-6 flex items-center gap-2 rounded bg-[#CEFF8F] px-5 py-2.5 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC]">
          <ArrowLeft className="h-4 w-4" /> Retour aux contacts
        </Link>
      </div>
    );
  }

  const prefilled = [
    { icon: MapPin, label: 'Adresse complète', value: contact.address, key: 'address' },
    { icon: FileDigit, label: 'SIRET', value: contact.siret, key: 'siret' },
    { icon: Hash, label: 'SIREN', value: contact.siren, key: 'siren' },
    { icon: Percent, label: 'N° de TVA', value: contact.tva, key: 'tva' },
    { icon: Landmark, label: "N° d'entreprise", value: contact.company_id, key: 'company_id' },
    { icon: Tag, label: 'Code APE/NAF', value: contact.ape, key: 'ape' },
  ].filter((r) => r.value);
  const extraDetails = Object.entries(contact.details || {});
  const hasPrefilled = prefilled.length > 0 || extraDetails.length > 0;

  return (
    <div className="px-4 py-8 sm:px-6 sm:py-10 md:px-10">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <button
          onClick={() => navigate('/sign/app/contacts')}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#3A4242] bg-[#222828] text-[#A1A9A9] transition-colors hover:border-[#CEFF8F] hover:text-[#CEFF8F]"
          title="Retour"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#CEFF8F] text-lg font-bold text-[#191E1E]">
            {(contact.name || contact.email).slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">{contact.name || '—'}</h1>
            <p className="truncate text-sm text-[#A1A9A9]">{contact.email}</p>
          </div>
        </div>
      </div>

      {/* Grille 3 colonnes : gauche / milieu / rail droite */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* ----- Colonne gauche : identité + préremplis ----- */}
        <div className="flex w-full flex-col gap-6 lg:max-w-xs lg:shrink-0">
          {/* Identité — éditable */}
          <section className="rounded-xl border border-[#3A4242] bg-[#222828] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">
                <IdCard className="h-3.5 w-3.5 text-[#CEFF8F]" /> Identité
              </div>
              {!editing ? (
                <button
                  onClick={startEdit}
                  title="Modifier"
                  className="flex items-center gap-1.5 rounded border border-[#3A4242] px-2 py-1 text-[11px] font-medium text-[#A1A9A9] transition-colors hover:border-[#CEFF8F] hover:text-[#CEFF8F]"
                >
                  <Pencil className="h-3 w-3" /> Modifier
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setEditing(false)}
                    disabled={saving}
                    title="Annuler"
                    className="flex h-7 w-7 items-center justify-center rounded border border-[#3A4242] text-[#A1A9A9] transition-colors hover:border-[#A1A9A9] hover:text-white disabled:opacity-60"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={saveIdentity}
                    disabled={saving}
                    title="Enregistrer"
                    className="flex h-7 w-7 items-center justify-center rounded bg-[#CEFF8F] text-[#191E1E] transition-colors hover:bg-[#A0E7EC] disabled:opacity-60"
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
                  </button>
                </div>
              )}
            </div>
            {editing ? (
              <div className="space-y-3">
                <EditRow icon={IdCard} label="Nom complet" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Marc Dupont" />
                <EditRow icon={Mail} label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="marc@exemple.fr" />
                <EditRow icon={Phone} label="Téléphone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="+33 6 12 34 56 78" />
              </div>
            ) : (
              <div className="space-y-2">
                <InfoRow icon={IdCard} label="Nom complet" value={contact.name} />
                <InfoRow icon={Mail} label="Email" value={contact.email} />
                <InfoRow icon={Phone} label="Téléphone" value={contact.phone} />
              </div>
            )}
          </section>

          {/* Dossier */}
          <section className="rounded-xl border border-[#3A4242] bg-[#222828] p-5">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">
              <Folder className="h-3.5 w-3.5 text-[#CEFF8F]" /> Dossier
            </div>
            <div className="relative">
              <Folder className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
              <select
                value={contact.groupId ?? ''}
                onChange={(e) => changeGroup(e.target.value || null)}
                className="w-full appearance-none rounded border border-[#3A4242] bg-[#191E1E] py-2.5 pl-10 pr-9 text-sm text-white outline-none transition-colors focus:border-[#CEFF8F]"
              >
                <option value="">Sans dossier</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
            </div>
            {groups.length === 0 && <p className="mt-2 text-xs leading-relaxed text-[#A1A9A9]">Aucun dossier. Créez-en depuis la page Contacts.</p>}
          </section>

          {/* Champs enregistrés — non éditables, supprimables uniquement */}
          <section className="rounded-xl border border-[#3A4242] bg-[#222828] p-5">
            <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">
              <FileText className="h-3.5 w-3.5 text-[#CEFF8F]" /> Champs enregistrés
            </div>
            {hasPrefilled ? (
              <div className="space-y-2">
                {prefilled.map((r) => (
                  <DeletableRow key={r.key} icon={r.icon} label={r.label} value={r.value!} onDelete={() => removeField('column', r.key)} />
                ))}
                {extraDetails.map(([k, v]) => (
                  <DeletableRow key={k} icon={FileText} label={k} value={v} onDelete={() => removeField('detail', k)} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#A1A9A9]">Aucun champ supplémentaire enregistré pour ce contact.</p>
            )}
          </section>
        </div>

        {/* ----- Colonne milieu : historique d'activité ----- */}
        <section className="min-w-0 flex-1 rounded-xl border border-[#3A4242] bg-[#222828] p-5">
          <div className="mb-5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">
            <Activity className="h-3.5 w-3.5 text-[#CEFF8F]" /> Historique d'activité
          </div>
          {activity.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded border border-dashed border-[#3A4242] bg-[#191E1E]">
                <Clock className="h-6 w-6 text-[#A1A9A9]" />
              </div>
              <p className="text-sm text-[#F3F4F6]">Aucune activité pour le moment.</p>
              <p className="mt-1 max-w-xs text-xs text-[#A1A9A9]">
                Les ouvertures, téléchargements et signatures de ce contact apparaîtront ici.
              </p>
            </div>
          ) : (
            <ol className="relative space-y-1">
              {activity.map((e, i) => {
                const meta = EVENT[e.type] ?? { label: e.type, icon: FileText, color: '#A1A9A9' };
                const { date, time } = fmtDateTime(e.at);
                const last = i === activity.length - 1;
                return (
                  <li key={e.id} className="relative flex gap-4 pb-4">
                    {/* Ligne verticale */}
                    {!last && <span className="absolute left-[15px] top-8 h-[calc(100%-1rem)] w-px bg-[#3A4242]" />}
                    {/* Pastille */}
                    <span
                      className="relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#3A4242] bg-[#191E1E]"
                      style={{ color: meta.color }}
                    >
                      <meta.icon className="h-4 w-4" />
                    </span>
                    {/* Contenu */}
                    <div className="min-w-0 flex-1 rounded-lg border border-[#3A4242] bg-[#191E1E] px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <span className="text-sm font-medium text-white">{meta.label}</span>
                        <span className="flex items-center gap-1.5 text-xs text-[#A1A9A9]">
                          <Clock className="h-3 w-3" /> {date} · {time}
                        </span>
                      </div>
                      <Link
                        to={`/sign/app/contrat/${e.contractId}`}
                        className="mt-1 inline-flex items-center gap-1 text-xs text-[#A1A9A9] transition-colors hover:text-[#CEFF8F]"
                      >
                        <FileText className="h-3 w-3" /> {e.contractTitle}
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* ----- Rail droite : contrats assignés (pleine largeur sur mobile, enroulé/survol sur desktop) ----- */}
        <section className="group relative w-full shrink-0 self-start transition-all duration-300 lg:w-16 lg:hover:w-80">
          <div className="overflow-hidden rounded-xl border border-[#3A4242] bg-[#222828]">
            {/* En-tête du rail */}
            <div className="flex items-center gap-3 border-b border-[#3A4242] px-4 py-4">
              <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#CEFF8F]/10 text-[#CEFF8F]">
                <FileText className="h-4 w-4" />
                {contracts.length > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#CEFF8F] px-1 text-[10px] font-bold text-[#191E1E]">
                    {contracts.length}
                  </span>
                )}
              </div>
              <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9] transition-opacity duration-200 lg:opacity-0 lg:group-hover:opacity-100">
                Contrats assignés
              </span>
            </div>

            {/* Bouton : nouveau contrat assigné à ce contact */}
            <button
              onClick={() => navigate(`/sign/app/nouveau?contact=${contact.id}`)}
              className="flex w-full items-center gap-2 whitespace-nowrap border-b border-[#3A4242] px-4 py-3 text-left text-sm font-bold text-[#CEFF8F] transition-all duration-200 hover:bg-[#CEFF8F]/10 lg:opacity-0 lg:group-hover:opacity-100"
            >
              <Plus className="h-4 w-4 shrink-0" strokeWidth={2.5} /> Nouveau contrat
            </button>

            {/* Liste (visible une fois déroulé) */}
            <div className="max-h-[60vh] overflow-y-auto transition-opacity duration-200 lg:opacity-0 lg:group-hover:opacity-100">
              {contracts.length === 0 ? (
                <p className="whitespace-nowrap px-4 py-5 text-xs text-[#A1A9A9]">Aucun contrat assigné.</p>
              ) : (
                <ul>
                  {contracts.map((c) => {
                    const st = STATUS[c.status] ?? STATUS.draft;
                    return (
                      <li key={c.id}>
                        <Link
                          to={`/sign/app/contrat/${c.id}`}
                          className="flex items-center gap-3 border-b border-[#3A4242] px-4 py-3 transition-colors last:border-0 hover:bg-[#1D2323]"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-white">{c.title}</p>
                            <span className={`mt-1 inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold ${st.cls}`}>
                              {st.label}
                            </span>
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-[#A1A9A9]" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value?: string }) {
  return (
    <div className="flex items-start gap-3 rounded border border-[#3A4242] bg-[#191E1E] px-3 py-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#CEFF8F]" />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-[#A1A9A9]">{label}</div>
        <div className="break-words text-sm text-white">{value || <span className="text-[#3A4242]">—</span>}</div>
      </div>
    </div>
  );
}

function EditRow({
  icon: Icon, label, value, onChange, placeholder, type = 'text',
}: { icon: typeof Mail; label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">
        <Icon className="h-3 w-3 text-[#CEFF8F]" /> {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded border border-[#3A4242] bg-[#191E1E] px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-[#A1A9A9]/40 focus:border-[#CEFF8F]"
      />
    </div>
  );
}

function DeletableRow({
  icon: Icon, label, value, onDelete,
}: { icon: typeof Mail; label: string; value: string; onDelete: () => void }) {
  return (
    <div className="group flex items-start gap-3 rounded border border-[#3A4242] bg-[#191E1E] px-3 py-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#CEFF8F]" />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-[#A1A9A9]">{label}</div>
        <div className="break-words text-sm text-white">{value}</div>
      </div>
      <button
        onClick={onDelete}
        title="Supprimer ce champ"
        className="-mr-1 mt-0.5 shrink-0 rounded p-1 text-[#A1A9A9] opacity-0 transition-all hover:bg-[#3A4242] hover:text-red-400 group-hover:opacity-100"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
