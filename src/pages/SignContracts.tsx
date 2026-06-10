import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, FileSignature, Search, Trash2, Loader2, X, ChevronDown, Check } from 'lucide-react';
import { listContractsWithCounts, deleteContract, type SignContractRow } from '../lib/signContracts';

/**
 * CloseOS Sign — Tous les contrats (lecture depuis Supabase).
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

// Badge d'état d'abonnement (suivi webhook) — affiché en plus du statut quand il y a un abonnement
const SUB_BADGE: Record<string, { label: string; cls: string }> = {
  active: { label: 'Abo à jour', cls: 'text-[#CEFF8F] border-[#CEFF8F]/30' },
  trialing: { label: 'Abo · essai', cls: 'text-[#A0E7EC] border-[#A0E7EC]/30' },
  past_due: { label: 'Abo · échec', cls: 'text-[#F0B86E] border-[#F0B86E]/40' },
  unpaid: { label: 'Abo · impayé', cls: 'text-[#ef6b6b] border-[#ef6b6b]/40' },
  canceled: { label: 'Abo · annulé', cls: 'text-[#A1A9A9] border-[#3A4242]' },
  incomplete: { label: 'Abo · incomplet', cls: 'text-[#A1A9A9] border-[#3A4242]' },
};

export default function SignContracts() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<SignContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  // Filtres
  const [statusFilter, setStatusFilter] = useState('');
  const [contactFilter, setContactFilter] = useState(''); // '' | '__any__' | '__none__' | contactId
  const [payFilter, setPayFilter] = useState(''); // '' | 'with' | 'without'
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [contactMenuOpen, setContactMenuOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const contactMenuRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listContractsWithCounts());
    } catch (e) {
      console.error('[sign] liste contrats', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = 'Tous les contrats | CloseOS Sign';
    load();
  }, [load]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Supprimer ce contrat ?')) return;
    try {
      await deleteContract(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error('[sign] suppression contrat', err);
    }
  };

  const distinctStatuses = useMemo(() => [...new Set(rows.map((r) => r.status))], [rows]);
  const distinctContacts = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => {
      if (r.contactId) m.set(r.contactId, r.contactName || 'Contact');
    });
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [rows]);

  // Menu contact (recherche) — fermeture au clic extérieur
  useEffect(() => {
    if (!contactMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (contactMenuRef.current && !contactMenuRef.current.contains(e.target as Node)) setContactMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [contactMenuOpen]);
  const contactLabel =
    contactFilter === ''
      ? 'Tous (contact)'
      : contactFilter === '__any__'
        ? 'Assignés à un contact'
        : contactFilter === '__none__'
          ? 'Sans contact'
          : distinctContacts.find((c) => c.id === contactFilter)?.name ?? 'Contact';
  const filteredContacts = distinctContacts.filter((c) => c.name.toLowerCase().includes(contactSearch.trim().toLowerCase()));
  const pickContact = (v: string) => {
    setContactFilter(v);
    setContactMenuOpen(false);
    setContactSearch('');
  };

  const anyFilter = !!(statusFilter || contactFilter || payFilter || dateFrom || dateTo);
  const resetFilters = () => {
    setStatusFilter('');
    setContactFilter('');
    setPayFilter('');
    setDateFrom('');
    setDateTo('');
  };

  const filtered = rows.filter((r) => {
    if (query.trim() && !r.title.toLowerCase().includes(query.trim().toLowerCase())) return false;
    if (statusFilter && r.status !== statusFilter) return false;
    if (payFilter === 'with' && !r.hasPayment) return false;
    if (payFilter === 'without' && r.hasPayment) return false;
    if (contactFilter === '__any__' && !r.contactId) return false;
    if (contactFilter === '__none__' && r.contactId) return false;
    if (contactFilter && contactFilter !== '__any__' && contactFilter !== '__none__' && r.contactId !== contactFilter) return false;
    if (dateFrom && new Date(r.updated_at) < new Date(dateFrom + 'T00:00:00')) return false;
    if (dateTo && new Date(r.updated_at) > new Date(dateTo + 'T23:59:59')) return false;
    return true;
  });
  const fmtDate = (ts: string) =>
    new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:px-10">
      {/* Header */}
      <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Tous les contrats</h1>
          <p className="mt-2 text-sm text-[#A1A9A9]">Suivez l’état de vos contrats : brouillon, envoyé, signé, payé.</p>
        </div>
        <button
          onClick={() => navigate('/sign/app/nouveau')}
          className="flex items-center gap-2 rounded bg-[#CEFF8F] px-5 py-2.5 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC]"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} /> Créer un nouveau contrat
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-3 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un contrat…"
          className="w-full rounded border border-[#3A4242] bg-[#191E1E] py-2.5 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-[#A1A9A9]/50 focus:border-[#CEFF8F]"
        />
      </div>

      {/* Filtres */}
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        {/* Statut */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded border border-[#3A4242] bg-[#191E1E] px-3 py-2.5 text-sm text-[#F3F4F6] outline-none transition-colors focus:border-[#CEFF8F]"
        >
          <option value="">Tous les statuts</option>
          {distinctStatuses.map((s) => (
            <option key={s} value={s}>
              {STATUS[s]?.label ?? s}
            </option>
          ))}
        </select>

        {/* Période (sur la date de modification) */}
        <div className="flex items-center gap-1.5 rounded border border-[#3A4242] bg-[#191E1E] px-2.5 py-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wide text-[#A1A9A9]">Du</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            onClick={(e) => (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.()}
            style={{ colorScheme: 'dark' }}
            className="cursor-pointer bg-transparent text-sm text-[#F3F4F6] outline-none"
          />
          <span className="text-[10px] font-bold uppercase tracking-wide text-[#A1A9A9]">au</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            onClick={(e) => (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.()}
            style={{ colorScheme: 'dark' }}
            className="cursor-pointer bg-transparent text-sm text-[#F3F4F6] outline-none"
          />
        </div>

        {/* Contact (avec recherche) */}
        <div ref={contactMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setContactMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded border border-[#3A4242] bg-[#191E1E] px-3 py-2.5 text-sm text-[#F3F4F6] outline-none transition-colors hover:border-[#A1A9A9]"
          >
            <span className="max-w-[160px] truncate">{contactLabel}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#A1A9A9]" />
          </button>
          {contactMenuOpen && (
            <div className="absolute left-0 top-full z-30 mt-1 w-64 overflow-hidden rounded-lg border border-[#3A4242] bg-[#222828] shadow-2xl">
              <div className="relative border-b border-[#3A4242] p-2">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#A1A9A9]" />
                <input
                  autoFocus
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  placeholder="Rechercher un contact…"
                  className="w-full rounded border border-[#3A4242] bg-[#191E1E] py-2 pl-8 pr-3 text-sm text-white outline-none placeholder:text-[#A1A9A9]/50 focus:border-[#CEFF8F]"
                />
              </div>
              <ul className="max-h-60 overflow-y-auto py-1 text-sm">
                {[
                  { v: '', label: 'Tous (contact)' },
                  { v: '__any__', label: 'Assignés à un contact' },
                  { v: '__none__', label: 'Sans contact' },
                ].map((o) => (
                  <li key={o.v}>
                    <button
                      type="button"
                      onClick={() => pickContact(o.v)}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-[#191E1E] ${contactFilter === o.v ? 'text-[#CEFF8F]' : 'text-[#F3F4F6]'}`}
                    >
                      {o.label}
                      {contactFilter === o.v && <Check className="h-3.5 w-3.5" />}
                    </button>
                  </li>
                ))}
                {distinctContacts.length > 0 && <li className="my-1 border-t border-[#3A4242]" />}
                {filteredContacts.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => pickContact(c.id)}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-[#191E1E] ${contactFilter === c.id ? 'text-[#CEFF8F]' : 'text-[#F3F4F6]'}`}
                    >
                      <span className="truncate">{c.name}</span>
                      {contactFilter === c.id && <Check className="h-3.5 w-3.5 shrink-0" />}
                    </button>
                  </li>
                ))}
                {distinctContacts.length > 0 && filteredContacts.length === 0 && (
                  <li className="px-3 py-3 text-center text-xs text-[#A1A9A9]">Aucun contact</li>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* Paiement */}
        <select
          value={payFilter}
          onChange={(e) => setPayFilter(e.target.value)}
          className="rounded border border-[#3A4242] bg-[#191E1E] px-3 py-2.5 text-sm text-[#F3F4F6] outline-none transition-colors focus:border-[#CEFF8F]"
        >
          <option value="">Paiement : tous</option>
          <option value="with">Avec paiement</option>
          <option value="without">Sans paiement</option>
        </select>

        {anyFilter && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1 rounded border border-[#3A4242] px-3 py-2.5 text-xs font-medium text-[#A1A9A9] transition-colors hover:border-[#A1A9A9] hover:text-white"
          >
            <X className="h-3.5 w-3.5" /> Réinitialiser
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded border border-[#3A4242] bg-[#222828]">
        <div className="grid grid-cols-12 gap-4 border-b border-[#3A4242] px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">
          <div className="col-span-5">Contrat</div>
          <div className="col-span-2">Champs</div>
          <div className="col-span-2">Statut</div>
          <div className="col-span-2 text-right">Modifié</div>
          <div className="col-span-1" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center px-6 py-16 text-[#A1A9A9]">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded border border-dashed border-[#3A4242] bg-[#191E1E]">
              <FileText className="h-6 w-6 text-[#A1A9A9]" />
            </div>
            <p className="text-sm text-[#F3F4F6]">{rows.length === 0 ? 'Aucun contrat pour le moment.' : 'Aucun résultat.'}</p>
            <p className="mt-1 max-w-xs text-xs text-[#A1A9A9]">
              Créez votre premier contrat pour le faire signer et encaisser l’acompte.
            </p>
            <button
              onClick={() => navigate('/sign/app/nouveau')}
              className="mt-6 flex items-center gap-2 rounded bg-[#CEFF8F] px-5 py-2.5 text-xs font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC]"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} /> Créer un nouveau contrat
            </button>
          </div>
        ) : (
          <ul>
            {filtered.map((r) => {
              const st = STATUS[r.status] ?? STATUS.draft;
              return (
                <li
                  key={r.id}
                  onClick={() => navigate(`/sign/app/contrat/${r.id}`)}
                  className="group grid cursor-pointer grid-cols-12 items-center gap-4 border-b border-[#3A4242] px-5 py-4 transition-colors last:border-0 hover:bg-[#1D2323]"
                >
                  <div className="col-span-5 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded border border-[#3A4242] bg-[#191E1E]">
                      <FileSignature className="h-4 w-4 text-[#CEFF8F]" />
                    </div>
                    <span className="truncate text-sm font-medium text-white">{r.title}</span>
                  </div>
                  <div className="col-span-2 text-sm text-[#A1A9A9]">{r.fields}</div>
                  <div className="col-span-2">
                    <span className={`rounded border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${st.cls}`}>
                      {st.label}
                    </span>
                    {r.subscriptionStatus && SUB_BADGE[r.subscriptionStatus] && (
                      <span className={`mt-1 block w-fit rounded border px-2 py-0.5 text-[10px] font-semibold ${SUB_BADGE[r.subscriptionStatus].cls}`}>
                        {SUB_BADGE[r.subscriptionStatus].label}
                      </span>
                    )}
                  </div>
                  <div className="col-span-2 text-right text-sm text-[#A1A9A9]">{fmtDate(r.updated_at)}</div>
                  <div className="col-span-1 flex justify-end">
                    <button
                      onClick={(e) => handleDelete(e, r.id)}
                      title="Supprimer"
                      className="rounded p-1.5 text-[#A1A9A9] opacity-0 transition-all hover:bg-[#3A4242] hover:text-white group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
