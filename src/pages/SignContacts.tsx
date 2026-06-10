import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Search, Mail, Phone, Trash2, X, User, Loader2, MapPin, FileDigit, Hash, Percent, Landmark, Tag } from 'lucide-react';
import { listContacts, addContact, deleteContact, type SignContact } from '../lib/signContracts';
import PhoneInput from '../components/PhoneInput';
import PlacesInput from '../components/PlacesInput';

/**
 * CloseOS Sign — Liste des contacts (Supabase, table sign_contacts).
 * Les signataires sont aussi enregistrés ici automatiquement.
 */

export default function SignContacts() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<SignContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', siret: '', siren: '', tva: '', company_id: '', ape: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setContacts(await listContacts());
    } catch (e) {
      console.error('[sign] liste contacts', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = 'Contacts | CloseOS Sign';
    load();
  }, [load]);

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;
    setSaving(true);
    try {
      await addContact({ name: form.name, email: form.email, phone: form.phone, address: form.address, siret: form.siret, siren: form.siren, tva: form.tva, company_id: form.company_id, ape: form.ape });
      setForm({ name: '', email: '', phone: '', address: '', siret: '', siren: '', tva: '', company_id: '', ape: '' });
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

  const filtered = contacts.filter((c) =>
    `${c.name} ${c.email}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:px-10">
      {/* Header */}
      <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Contacts</h1>
          <p className="mt-2 text-sm text-[#A1A9A9]">Vos signataires : ajoutés manuellement ou enregistrés automatiquement à la signature.</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded bg-[#CEFF8F] px-5 py-2.5 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC]"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} /> Ajouter un contact
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un contact…"
          className="w-full rounded border border-[#3A4242] bg-[#191E1E] py-2.5 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-[#A1A9A9]/50 focus:border-[#CEFF8F]"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded border border-[#3A4242] bg-[#222828]">
        <div className="grid grid-cols-12 gap-4 border-b border-[#3A4242] px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">
          <div className="col-span-4">Nom</div>
          <div className="col-span-4">Email</div>
          <div className="col-span-3">Téléphone</div>
          <div className="col-span-1" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center px-6 py-16 text-[#A1A9A9]">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded border border-dashed border-[#3A4242] bg-[#191E1E]">
              <Users className="h-6 w-6 text-[#A1A9A9]" />
            </div>
            <p className="text-sm text-[#F3F4F6]">{contacts.length === 0 ? 'Aucun contact pour le moment.' : 'Aucun résultat.'}</p>
            <p className="mt-1 max-w-xs text-xs text-[#A1A9A9]">
              Ajoutez vos clients, ou ils s’enregistrent automatiquement quand ils signent.
            </p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-6 flex items-center gap-2 rounded bg-[#CEFF8F] px-5 py-2.5 text-xs font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC]"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} /> Ajouter un contact
            </button>
          </div>
        ) : (
          <ul>
            {filtered.map((c) => (
              <li
                key={c.id}
                onClick={() => navigate(`/sign/app/contacts/${c.id}`)}
                className="group grid cursor-pointer grid-cols-12 items-center gap-4 border-b border-[#3A4242] px-5 py-4 transition-colors last:border-0 hover:bg-[#1D2323]"
              >
                <div className="col-span-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#CEFF8F] text-xs font-bold text-[#191E1E]">
                    {(c.name || c.email).slice(0, 1).toUpperCase()}
                  </div>
                  <span className="truncate text-sm font-medium text-white">{c.name}</span>
                </div>
                <div className="col-span-4 flex items-center gap-2 truncate text-sm text-[#A1A9A9]">
                  <Mail className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{c.email}</span>
                </div>
                <div className="col-span-3 flex items-center gap-2 text-sm text-[#A1A9A9]">
                  {c.phone ? (<><Phone className="h-3.5 w-3.5" /> {c.phone}</>) : <span className="text-[#3A4242]">—</span>}
                </div>
                <div className="col-span-1 flex justify-end">
                  <button
                    onClick={(e) => { e.stopPropagation(); removeContact(c.id); }}
                    title="Supprimer"
                    className="rounded p-1.5 text-[#A1A9A9] opacity-0 transition-all hover:bg-[#3A4242] hover:text-white group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal ajout */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded border border-[#3A4242] bg-[#222828] p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Nouveau contact</h3>
              <button onClick={() => setShowAdd(false)} className="text-[#A1A9A9] transition-colors hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={submitAdd} className="space-y-4">
              <Field icon={User} label="Nom complet" required value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Marc Dupont" />
              <Field icon={Mail} label="Email" required type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="marc@exemple.fr" />
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
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">SIRET <span className="text-[#A1A9A9]/60">(facultatif)</span></label>
                  <div className="relative">
                    <FileDigit className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
                    <input
                      value={form.siret}
                      onChange={(e) => setForm({ ...form, siret: e.target.value })}
                      placeholder="ex. 14 chiffres (FR)"
                      className="w-full rounded border border-[#3A4242] bg-[#191E1E] py-2.5 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-[#A1A9A9]/40 focus:border-[#CEFF8F]"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">SIREN <span className="text-[#A1A9A9]/60">(facultatif)</span></label>
                  <div className="relative">
                    <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
                    <input
                      value={form.siren}
                      onChange={(e) => setForm({ ...form, siren: e.target.value })}
                      placeholder="ex. 9 chiffres (FR)"
                      className="w-full rounded border border-[#3A4242] bg-[#191E1E] py-2.5 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-[#A1A9A9]/40 focus:border-[#CEFF8F]"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">N° de TVA <span className="text-[#A1A9A9]/60">(facultatif)</span></label>
                  <div className="relative">
                    <Percent className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
                    <input
                      value={form.tva}
                      onChange={(e) => setForm({ ...form, tva: e.target.value })}
                      placeholder="ex. FR12345678901"
                      className="w-full rounded border border-[#3A4242] bg-[#191E1E] py-2.5 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-[#A1A9A9]/40 focus:border-[#CEFF8F]"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">N° d'entreprise <span className="text-[#A1A9A9]/60">(facultatif)</span></label>
                  <div className="relative">
                    <Landmark className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
                    <input
                      value={form.company_id}
                      onChange={(e) => setForm({ ...form, company_id: e.target.value })}
                      placeholder="Registre national"
                      className="w-full rounded border border-[#3A4242] bg-[#191E1E] py-2.5 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-[#A1A9A9]/40 focus:border-[#CEFF8F]"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">Code APE/NAF <span className="text-[#A1A9A9]/60">(facultatif)</span></label>
                  <div className="relative">
                    <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
                    <input
                      value={form.ape}
                      onChange={(e) => setForm({ ...form, ape: e.target.value })}
                      placeholder="ex. 6201Z"
                      className="w-full rounded border border-[#3A4242] bg-[#191E1E] py-2.5 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-[#A1A9A9]/40 focus:border-[#CEFF8F]"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="rounded border border-[#3A4242] px-4 py-2 text-sm font-medium text-[#A1A9A9] transition-colors hover:border-[#A1A9A9] hover:text-white">
                  Annuler
                </button>
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

function Field({
  icon: Icon,
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = false,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">{label}</label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
        <input
          type={type}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded border border-[#3A4242] bg-[#191E1E] py-2.5 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-[#A1A9A9]/40 focus:border-[#CEFF8F]"
        />
      </div>
    </div>
  );
}
