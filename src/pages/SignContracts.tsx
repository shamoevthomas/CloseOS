import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, FileSignature, Search, Trash2, Loader2, X, ChevronDown, Check, Copy, Download, Pencil, Files, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { listContractsWithCounts, deleteContract, duplicateContract, downloadContractDocument, getContractPdfData, resendContract, type SignContractRow } from '../lib/signContracts';
import { renderPdfFirstPage } from '../lib/signPdfThumb';
import { THEME_CSS } from '../lib/signThemes';
import { useSignLang, signLocale, type SignLang } from '../contexts/SignLangContext';

/**
 * CloseOS Sign — Tous les contrats (grille de cartes, style « Google Docs » en DA Sign).
 */

const STATUS: Record<string, { label: string; labelEn: string; cls: string; accent: string }> = {
  draft: { label: 'Brouillon', labelEn: 'Draft', cls: 'text-[#A1A9A9] border-[#3A4242] bg-[#191E1E]', accent: '#3A4242' },
  pending: { label: 'En attente', labelEn: 'Pending', cls: 'text-[#A0E7EC] border-[#A0E7EC]/30 bg-[#A0E7EC]/10', accent: '#A0E7EC' },
  sent: { label: 'Envoyé', labelEn: 'Sent', cls: 'text-[#CEFF8F] border-[#CEFF8F]/30 bg-[#CEFF8F]/10', accent: '#CEFF8F' },
  viewed: { label: 'Consulté', labelEn: 'Viewed', cls: 'text-[#CEFF8F] border-[#CEFF8F]/30 bg-[#CEFF8F]/10', accent: '#CEFF8F' },
  signed: { label: 'Signé', labelEn: 'Signed', cls: 'text-[#CEFF8F] border-[#CEFF8F]/30 bg-[#CEFF8F]/10', accent: '#CEFF8F' },
  paid: { label: 'Signé + Payé', labelEn: 'Signed + Paid', cls: 'text-[#191E1E] border-[#CEFF8F] bg-[#CEFF8F]', accent: '#CEFF8F' },
  declined: { label: 'Refusé', labelEn: 'Declined', cls: 'text-red-400 border-red-500/30 bg-red-500/10', accent: '#ef6b6b' },
  expired: { label: 'Expiré', labelEn: 'Expired', cls: 'text-[#A1A9A9] border-[#3A4242] bg-[#191E1E]', accent: '#3A4242' },
  cancelled: { label: 'Annulé', labelEn: 'Cancelled', cls: 'text-[#A1A9A9] border-[#3A4242] bg-[#191E1E]', accent: '#3A4242' },
};
const statusLabel = (s: string, lang: SignLang) => {
  const st = STATUS[s];
  if (!st) return s;
  return lang === 'fr' ? st.label : st.labelEn;
};

// Badge d'état d'abonnement (suivi webhook)
const SUB_BADGE: Record<string, { label: string; labelEn: string; cls: string }> = {
  active: { label: 'Abo à jour', labelEn: 'Sub · up to date', cls: 'text-[#CEFF8F] border-[#CEFF8F]/30' },
  trialing: { label: 'Abo · essai', labelEn: 'Sub · trial', cls: 'text-[#A0E7EC] border-[#A0E7EC]/30' },
  past_due: { label: 'Abo · échec', labelEn: 'Sub · past due', cls: 'text-[#F0B86E] border-[#F0B86E]/40' },
  unpaid: { label: 'Abo · impayé', labelEn: 'Sub · unpaid', cls: 'text-[#ef6b6b] border-[#ef6b6b]/40' },
  canceled: { label: 'Abo · annulé', labelEn: 'Sub · canceled', cls: 'text-[#A1A9A9] border-[#3A4242]' },
  incomplete: { label: 'Abo · incomplet', labelEn: 'Sub · incomplete', cls: 'text-[#A1A9A9] border-[#3A4242]' },
};

// CSS de base pour la prévisualisation réelle du document (rendu fidèle .sign-doc + thèmes)
const DOC_BASE_CSS = `
.sign-thumb .sign-doc{color:#1a1a1a;line-height:1.6;font-family:Georgia,'Times New Roman',serif;font-size:14px;}
.sign-thumb .sign-doc h1{font-size:1.7rem;font-weight:700;margin:0 0 .6rem;}
.sign-thumb .sign-doc h2{font-size:1.25rem;font-weight:700;margin:1.2rem 0 .4rem;}
.sign-thumb .sign-doc h3{font-size:1.05rem;font-weight:700;margin:1rem 0 .35rem;}
.sign-thumb .sign-doc p{margin:.5rem 0;}
.sign-thumb .sign-doc ul{list-style:disc;padding-left:1.4rem;margin:.5rem 0;}
.sign-thumb .sign-doc ol{list-style:decimal;padding-left:1.4rem;margin:.5rem 0;}
.sign-thumb .sign-doc img{max-width:100%;}
.sign-thumb .sign-field,.sign-thumb [data-field]{background:rgba(206,255,143,.28);border-bottom:1px solid rgba(26,26,26,.35);border-radius:2px;padding:0 2px;}
`;

export default function SignContracts() {
  const navigate = useNavigate();
  const { lang } = useSignLang();
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
  const [actionBusy, setActionBusy] = useState<{ id: string; kind: 'dup' | 'dl' | 'send' } | null>(null);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
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
    document.title = (lang === 'fr' ? 'Tous les contrats' : 'All contracts') + ' | CloseOS Sign';
    load();
  }, [load, lang]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm(lang === 'fr' ? 'Supprimer ce contrat ?' : 'Delete this contract?')) return;
    try {
      await deleteContract(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error('[sign] suppression contrat', err);
    }
  };

  const handleOpen = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    navigate(`/sign/app/contrat/${id}`);
  };

  const handleDuplicate = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setActionBusy({ id, kind: 'dup' });
    try {
      await duplicateContract(id);
      await load();
    } catch (err) {
      console.error('[sign] duplication contrat', err);
    } finally {
      setActionBusy(null);
    }
  };

  const handleDownload = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setActionBusy({ id, kind: 'dl' });
    try {
      await downloadContractDocument(id);
    } catch (err) {
      console.error('[sign] téléchargement contrat', err);
    } finally {
      setActionBusy(null);
    }
  };

  const handleResend = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setActionBusy({ id, kind: 'send' });
    try {
      const r = await resendContract(id);
      if (r.ok) setToast({ type: 'ok', text: lang === 'fr' ? `Relance envoyée à ${r.email}.` : `Reminder sent to ${r.email}.` });
      else setToast({ type: 'err', text: r.error === 'no_email' ? (lang === 'fr' ? 'Aucun email signataire associé à ce contrat.' : 'No signer email associated with this contract.') : r.error === 'already_signed' ? (lang === 'fr' ? 'Ce contrat est déjà signé.' : 'This contract is already signed.') : (lang === 'fr' ? "Impossible d'envoyer la relance." : 'Unable to send the reminder.') });
    } catch (err) {
      console.error('[sign] relance contrat', err);
      setToast({ type: 'err', text: lang === 'fr' ? "Impossible d'envoyer la relance." : 'Unable to send the reminder.' });
    } finally {
      setActionBusy(null);
    }
  };

  // Masque le toast après quelques secondes.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const distinctStatuses = useMemo(() => [...new Set(rows.map((r) => r.status))], [rows]);
  const distinctContacts = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => {
      if (r.contactId) m.set(r.contactId, r.contactName || 'Contact');
    });
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [rows]);

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
      ? (lang === 'fr' ? 'Tous (contact)' : 'All (contact)')
      : contactFilter === '__any__'
        ? (lang === 'fr' ? 'Assignés à un contact' : 'Assigned to a contact')
        : contactFilter === '__none__'
          ? (lang === 'fr' ? 'Sans contact' : 'No contact')
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
    if (statusFilter === '__template__') { if (!r.isTemplate) return false; }
    else if (statusFilter && r.status !== statusFilter) return false;
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
    new Date(ts).toLocaleDateString(signLocale(lang), { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 md:px-10">
      <style dangerouslySetInnerHTML={{ __html: DOC_BASE_CSS + THEME_CSS }} />

      {/* Toast (relance…) */}
      {toast && (
        <div className="fixed left-1/2 top-6 z-[200] -translate-x-1/2">
          <div className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm shadow-xl backdrop-blur ${toast.type === 'ok' ? 'border-[#CEFF8F]/30 bg-[#222828]/95 text-[#CEFF8F]' : 'border-[#ef6b6b]/30 bg-[#222828]/95 text-[#ef6b6b]'}`}>
            {toast.type === 'ok' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            {toast.text}
          </div>
        </div>
      )}
      {/* Header */}
      <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{lang === 'fr' ? 'Tous les contrats' : 'All contracts'}</h1>
          <p className="mt-2 text-sm text-[#A1A9A9]">{lang === 'fr' ? 'Suivez l’état de vos contrats : brouillon, envoyé, signé, payé.' : 'Track the status of your contracts: draft, sent, signed, paid.'}</p>
        </div>
        <button
          onClick={() => navigate('/sign/app/nouveau')}
          className="flex w-full items-center justify-center gap-2 rounded bg-[#CEFF8F] px-5 py-2.5 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC] md:w-auto"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} /> {lang === 'fr' ? 'Créer un nouveau contrat' : 'Create a new contract'}
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-3 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A9A9]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={lang === 'fr' ? 'Rechercher un contrat…' : 'Search a contract…'}
          className="w-full rounded border border-[#3A4242] bg-[#191E1E] py-2.5 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-[#A1A9A9]/50 focus:border-[#CEFF8F]"
        />
      </div>

      {/* Filtres */}
      <div className="mb-6 flex flex-wrap items-center gap-2.5">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="min-w-0 flex-1 rounded border border-[#3A4242] bg-[#191E1E] px-3 py-2.5 text-sm text-[#F3F4F6] outline-none transition-colors focus:border-[#CEFF8F] sm:flex-none"
        >
          <option value="">{lang === 'fr' ? 'Tous les statuts' : 'All statuses'}</option>
          {rows.some((r) => r.isTemplate) && <option value="__template__">{lang === 'fr' ? 'Modèle' : 'Template'}</option>}
          {distinctStatuses.map((s) => (
            <option key={s} value={s}>{statusLabel(s, lang)}</option>
          ))}
        </select>

        <div className="flex items-center gap-1.5 rounded border border-[#3A4242] bg-[#191E1E] px-2.5 py-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wide text-[#A1A9A9]">{lang === 'fr' ? 'Du' : 'From'}</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} onClick={(e) => (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.()} style={{ colorScheme: 'dark' }} className="cursor-pointer bg-transparent text-sm text-[#F3F4F6] outline-none" />
          <span className="text-[10px] font-bold uppercase tracking-wide text-[#A1A9A9]">{lang === 'fr' ? 'au' : 'to'}</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} onClick={(e) => (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.()} style={{ colorScheme: 'dark' }} className="cursor-pointer bg-transparent text-sm text-[#F3F4F6] outline-none" />
        </div>

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
                <input autoFocus value={contactSearch} onChange={(e) => setContactSearch(e.target.value)} placeholder={lang === 'fr' ? 'Rechercher un contact…' : 'Search a contact…'} className="w-full rounded border border-[#3A4242] bg-[#191E1E] py-2 pl-8 pr-3 text-sm text-white outline-none placeholder:text-[#A1A9A9]/50 focus:border-[#CEFF8F]" />
              </div>
              <ul className="max-h-60 overflow-y-auto py-1 text-sm">
                {[{ v: '', label: lang === 'fr' ? 'Tous (contact)' : 'All (contact)' }, { v: '__any__', label: lang === 'fr' ? 'Assignés à un contact' : 'Assigned to a contact' }, { v: '__none__', label: lang === 'fr' ? 'Sans contact' : 'No contact' }].map((o) => (
                  <li key={o.v}>
                    <button type="button" onClick={() => pickContact(o.v)} className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-[#191E1E] ${contactFilter === o.v ? 'text-[#CEFF8F]' : 'text-[#F3F4F6]'}`}>
                      {o.label}{contactFilter === o.v && <Check className="h-3.5 w-3.5" />}
                    </button>
                  </li>
                ))}
                {distinctContacts.length > 0 && <li className="my-1 border-t border-[#3A4242]" />}
                {filteredContacts.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => pickContact(c.id)} className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-[#191E1E] ${contactFilter === c.id ? 'text-[#CEFF8F]' : 'text-[#F3F4F6]'}`}>
                      <span className="truncate">{c.name}</span>{contactFilter === c.id && <Check className="h-3.5 w-3.5 shrink-0" />}
                    </button>
                  </li>
                ))}
                {distinctContacts.length > 0 && filteredContacts.length === 0 && <li className="px-3 py-3 text-center text-xs text-[#A1A9A9]">{lang === 'fr' ? 'Aucun contact' : 'No contact'}</li>}
              </ul>
            </div>
          )}
        </div>

        <select value={payFilter} onChange={(e) => setPayFilter(e.target.value)} className="min-w-0 flex-1 rounded border border-[#3A4242] bg-[#191E1E] px-3 py-2.5 text-sm text-[#F3F4F6] outline-none transition-colors focus:border-[#CEFF8F] sm:flex-none">
          <option value="">{lang === 'fr' ? 'Paiement : tous' : 'Payment: all'}</option>
          <option value="with">{lang === 'fr' ? 'Avec paiement' : 'With payment'}</option>
          <option value="without">{lang === 'fr' ? 'Sans paiement' : 'Without payment'}</option>
        </select>

        {anyFilter && (
          <button onClick={resetFilters} className="flex items-center gap-1 rounded border border-[#3A4242] px-3 py-2.5 text-xs font-medium text-[#A1A9A9] transition-colors hover:border-[#A1A9A9] hover:text-white">
            <X className="h-3.5 w-3.5" /> {lang === 'fr' ? 'Réinitialiser' : 'Reset'}
          </button>
        )}
      </div>

      {/* Grille de contrats — max 4 par ligne */}
      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-[#3A4242] bg-[#222828] px-6 py-24 text-[#A1A9A9]">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[#3A4242] bg-[#222828] px-6 py-24 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded border border-dashed border-[#3A4242] bg-[#191E1E]">
            <FileText className="h-6 w-6 text-[#A1A9A9]" />
          </div>
          <p className="text-sm text-[#F3F4F6]">{rows.length === 0 ? (lang === 'fr' ? 'Aucun contrat pour le moment.' : 'No contract yet.') : (lang === 'fr' ? 'Aucun résultat.' : 'No results.')}</p>
          <p className="mt-1 max-w-xs text-xs text-[#A1A9A9]">{lang === 'fr' ? 'Créez votre premier contrat pour le faire signer et encaisser le paiement.' : 'Create your first contract to get it signed and collect payment.'}</p>
          <button onClick={() => navigate('/sign/app/nouveau')} className="mt-6 flex items-center gap-2 rounded bg-[#CEFF8F] px-5 py-2.5 text-xs font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC]">
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} /> {lang === 'fr' ? 'Créer un nouveau contrat' : 'Create a new contract'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((r) => {
            const st = STATUS[r.status] ?? STATUS.draft;
            return (
              <div
                key={r.id}
                onClick={() => navigate(r.isTemplate ? `/sign/app/template/${r.id}` : `/sign/app/contrat/${r.id}`)}
                className="group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border border-[#3A4242] bg-[#222828] transition-all duration-300 hover:-translate-y-1 hover:border-[#CEFF8F] hover:shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
              >
                {/* Aperçu « page » */}
                <div className="relative aspect-[4/5] overflow-hidden border-b border-[#3A4242] bg-[#191E1E]">
                  <div className="absolute inset-x-0 top-0 z-10 h-1.5" style={{ background: r.isTemplate ? '#CEFF8F' : st.accent }} />
                  {/* Vraie prévisualisation du document */}
                  <ContractThumbnail row={r} />
                  {/* Statut / Modèle */}
                  <span className={`absolute right-3 top-3 z-40 rounded border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${r.isTemplate ? 'border-[#CEFF8F] bg-[#CEFF8F] text-[#191E1E]' : st.cls}`}>
                    {r.isTemplate ? (lang === 'fr' ? 'Modèle' : 'Template') : statusLabel(r.status, lang)}
                  </span>
                  {/* Overlay d'actions (au survol) — clic ailleurs = ouvrir */}
                  <div className="absolute inset-0 z-30 flex items-center justify-center gap-2 bg-[#191E1E]/70 opacity-0 backdrop-blur-[1px] transition-opacity duration-200 group-hover:opacity-100">
                    <ActionBtn icon={Pencil} title={lang === 'fr' ? 'Ouvrir' : 'Open'} onClick={(e) => handleOpen(e, r.id)} />
                    {r.status === 'sent' && r.hasSignerEmail && !r.isTemplate && (
                      <ActionBtn icon={Send} title={lang === 'fr' ? 'Relancer par email' : 'Send email reminder'} busy={actionBusy?.id === r.id && actionBusy.kind === 'send'} onClick={(e) => handleResend(e, r.id)} />
                    )}
                    <ActionBtn icon={Copy} title={lang === 'fr' ? 'Dupliquer' : 'Duplicate'} busy={actionBusy?.id === r.id && actionBusy.kind === 'dup'} onClick={(e) => handleDuplicate(e, r.id)} />
                    <ActionBtn icon={Download} title={lang === 'fr' ? 'Télécharger' : 'Download'} busy={actionBusy?.id === r.id && actionBusy.kind === 'dl'} onClick={(e) => handleDownload(e, r.id)} />
                    <ActionBtn icon={Trash2} title={lang === 'fr' ? 'Supprimer' : 'Delete'} danger onClick={(e) => handleDelete(e, r.id)} />
                  </div>
                </div>
                {/* Pied : icône + titre + méta */}
                <div className="flex items-start gap-2.5 p-3">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[#3A4242] bg-[#191E1E]">
                    {r.isTemplate ? <Files className="h-3.5 w-3.5 text-[#CEFF8F]" /> : <FileSignature className="h-3.5 w-3.5 text-[#CEFF8F]" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug text-white" title={r.title} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {r.title}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#A1A9A9]">
                      {r.isTemplate ? (
                        <>
                          <span>{lang === 'fr' ? `${r.instanceCount ?? 0} lien${(r.instanceCount ?? 0) > 1 ? 's' : ''}` : `${r.instanceCount ?? 0} link${(r.instanceCount ?? 0) > 1 ? 's' : ''}`}</span>
                          <span className="text-[#3A4242]">·</span>
                          <span className="text-[#CEFF8F]">{lang === 'fr' ? `${r.signedCount ?? 0} signé${(r.signedCount ?? 0) > 1 ? 's' : ''}` : `${r.signedCount ?? 0} signed`}</span>
                        </>
                      ) : (
                        <>
                          <span>{fmtDate(r.updated_at)}</span>
                          <span className="text-[#3A4242]">·</span>
                          <span>{lang === 'fr' ? `${r.fields} champ${r.fields > 1 ? 's' : ''}` : `${r.fields} field${r.fields > 1 ? 's' : ''}`}</span>
                        </>
                      )}
                    </div>
                    {r.subscriptionStatus && SUB_BADGE[r.subscriptionStatus] && (
                      <span className={`mt-1.5 inline-block rounded border px-2 py-0.5 text-[10px] font-semibold ${SUB_BADGE[r.subscriptionStatus].cls}`}>
                        {lang === 'fr' ? SUB_BADGE[r.subscriptionStatus].label : SUB_BADGE[r.subscriptionStatus].labelEn}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Vignette d'aperçu RÉEL du contrat : contenu HTML (texte) mis à l'échelle, ou 1ère page PDF (lazy).
function ContractThumbnail({ row }: { row: SignContractRow }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.34);
  const [pdfImg, setPdfImg] = useState<string | null>(null);
  const [pdfState, setPdfState] = useState<'idle' | 'loading' | 'error' | 'done'>('idle');
  const isText = row.sourceType !== 'pdf';

  // Texte : adapte l'échelle à la largeur de la carte (document virtuel 794px)
  useEffect(() => {
    if (!isText) return;
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(Math.max(0.18, el.clientWidth / 794));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isText]);

  // PDF : rend la 1ère page quand la carte devient visible (jamais en masse)
  useEffect(() => {
    if (isText || pdfState !== 'idle') return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          setPdfState('loading');
          getContractPdfData(row.id)
            .then(async (d) => {
              const img = d ? await renderPdfFirstPage(d, 480) : null;
              if (img) { setPdfImg(img); setPdfState('done'); } else setPdfState('error');
            })
            .catch(() => setPdfState('error'));
        }
      },
      { rootMargin: '300px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [isText, row.id, pdfState]);

  if (!isText) {
    return (
      <div ref={ref} className="absolute inset-0 bg-[#0f1414]">
        {pdfImg ? (
          <img src={pdfImg} alt="" className="h-full w-full object-cover object-top" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-[#A1A9A9]">
            {pdfState === 'error' ? <FileText className="h-8 w-8" /> : <Loader2 className="h-6 w-6 animate-spin" />}
            <span className="text-[10px] font-bold uppercase tracking-widest">PDF</span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#0f1414] to-transparent" />
      </div>
    );
  }

  if (!row.contentHtml) {
    return <div ref={ref} className="absolute inset-0 bg-white" />;
  }

  return (
    <div ref={ref} className="sign-thumb absolute inset-0 overflow-hidden bg-white">
      <div
        className={row.theme && row.theme !== 'blank' ? `sign-doc theme-${row.theme}` : 'sign-doc'}
        style={{ width: 794, transform: `scale(${scale})`, transformOrigin: 'top left', padding: '46px 50px' }}
        dangerouslySetInnerHTML={{ __html: row.contentHtml }}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent" />
    </div>
  );
}

function ActionBtn({
  icon: Icon,
  title,
  onClick,
  busy,
  danger,
}: {
  icon: typeof Trash2;
  title: string;
  onClick: (e: React.MouseEvent) => void;
  busy?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-lg border border-[#3A4242] bg-[#222828] text-[#F3F4F6] shadow-lg transition-colors hover:bg-[#191E1E] ${danger ? 'hover:border-[#ef6b6b]/50 hover:text-[#ef6b6b]' : 'hover:border-[#CEFF8F] hover:text-[#CEFF8F]'}`}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
    </button>
  );
}
