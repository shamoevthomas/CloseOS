import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  FileSignature,
  Clock,
  CreditCard,
  CheckCircle2,
  ShieldCheck,
  ArrowUpRight,
  FileText,
  Users,
  TrendingUp,
  UserCheck,
  FileEdit,
  Loader2,
} from 'lucide-react';
import { useSignOwner } from '../lib/signAuth';
import { getSignStats, listContractsWithCounts, listContacts, type SignContractRow } from '../lib/signContracts';
import { useSignLang, signLocale } from '../contexts/SignLangContext';

/**
 * CloseOS Sign — accueil post-connexion (vue d'ensemble détaillée, dans SignLayout).
 */

const STATUS: Record<string, { badge: string; dot: string }> = {
  draft: { badge: 'text-[#A1A9A9] border-[#3A4242] bg-[#191E1E]', dot: '#3A4242' },
  pending: { badge: 'text-[#A0E7EC] border-[#A0E7EC]/30 bg-[#A0E7EC]/10', dot: '#A0E7EC' },
  sent: { badge: 'text-[#A0E7EC] border-[#A0E7EC]/30 bg-[#A0E7EC]/10', dot: '#A0E7EC' },
  signed: { badge: 'text-[#CEFF8F] border-[#CEFF8F]/30 bg-[#CEFF8F]/10', dot: '#CEFF8F' },
  paid: { badge: 'text-[#191E1E] border-[#CEFF8F] bg-[#CEFF8F]', dot: '#F0B86E' },
  declined: { badge: 'text-red-400 border-red-500/30 bg-red-500/10', dot: '#ef6b6b' },
};

export default function SignHome() {
  const navigate = useNavigate();
  const { lang } = useSignLang();
  const { owner } = useSignOwner();

  const statusLabel = (status: string) => {
    switch (status) {
      case 'pending':
      case 'sent':
        return lang === 'fr' ? 'En attente' : 'Pending';
      case 'signed':
        return lang === 'fr' ? 'Signé' : 'Signed';
      case 'paid':
        return lang === 'fr' ? 'Signé + Payé' : 'Signed + Paid';
      case 'declined':
        return lang === 'fr' ? 'Refusé' : 'Declined';
      default:
        return lang === 'fr' ? 'Brouillon' : 'Draft';
    }
  };
  const user = owner?.name ?? '…';
  const [rows, setRows] = useState<SignContractRow[]>([]);
  const [deposit, setDeposit] = useState(0);
  const [contactsCount, setContactsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = lang === 'fr' ? 'Mon espace | CloseOS Sign' : 'My workspace | CloseOS Sign';
    (async () => {
      try {
        const [r, s, c] = await Promise.all([listContractsWithCounts(), getSignStats(), listContacts()]);
        setRows(r);
        setDeposit(s.depositCents);
        setContactsCount(c.length);
      } catch (e) {
        console.error('[sign] accueil', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const m = useMemo(() => {
    const cnt = (f: (r: SignContractRow) => boolean) => rows.filter(f).length;
    const draft = cnt((r) => r.status === 'draft');
    const pending = cnt((r) => r.status === 'sent' || r.status === 'pending');
    const signed = cnt((r) => r.status === 'signed');
    const paid = cnt((r) => r.status === 'paid');
    const completed = signed + paid;
    const sentTotal = pending + completed;
    return {
      total: rows.length,
      draft,
      pending,
      signed,
      paid,
      completed,
      withPayment: cnt((r) => r.hasPayment),
      withContact: cnt((r) => !!r.contactId),
      signRate: sentTotal ? Math.round((completed / sentTotal) * 100) : 0,
      recent: rows.slice(0, 6),
    };
  }, [rows]);

  const fmtDate = (ts: string) => new Date(ts).toLocaleDateString(signLocale(lang), { day: '2-digit', month: 'short', year: 'numeric' });
  const eur = (cents: number) => `${(cents / 100).toLocaleString(signLocale(lang))} €`;

  const primary = [
    { icon: FileText, label: lang === 'fr' ? 'Contrats au total' : 'Total contracts', value: String(m.total), hint: lang === 'fr' ? `${m.draft} brouillon${m.draft > 1 ? 's' : ''}` : `${m.draft} draft${m.draft > 1 ? 's' : ''}` },
    { icon: Clock, label: lang === 'fr' ? 'En attente de signature' : 'Awaiting signature', value: String(m.pending), hint: m.pending > 0 ? (lang === 'fr' ? 'À suivre' : 'To follow up') : (lang === 'fr' ? 'Aucun envoi' : 'None sent') },
    { icon: CheckCircle2, label: lang === 'fr' ? 'Signés' : 'Signed', value: String(m.completed), hint: lang === 'fr' ? `${m.paid} payé${m.paid > 1 ? 's' : ''}` : `${m.paid} paid` },
    { icon: CreditCard, label: lang === 'fr' ? 'Encaissé' : 'Collected', value: eur(deposit), hint: lang === 'fr' ? 'Acomptes & paiements' : 'Deposits & payments' },
  ];

  // Répartition par statut (barre)
  const segs = [
    { key: 'draft', label: lang === 'fr' ? 'Brouillon' : 'Draft', val: m.draft, color: '#3A4242' },
    { key: 'pending', label: lang === 'fr' ? 'En attente' : 'Pending', val: m.pending, color: '#A0E7EC' },
    { key: 'signed', label: lang === 'fr' ? 'Signé' : 'Signed', val: m.signed, color: '#CEFF8F' },
    { key: 'paid', label: lang === 'fr' ? 'Payé' : 'Paid', val: m.paid, color: '#F0B86E' },
  ].filter((s) => s.val > 0);
  const segTotal = segs.reduce((a, s) => a + s.val, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 md:px-10">
      {/* Welcome + CTA */}
      <div className="mb-8 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-white sm:text-3xl">{lang === 'fr' ? `Bonjour ${user} 👋` : `Hi ${user} 👋`}</h1>
          <p className="mt-2 text-sm text-[#A1A9A9]">{lang === 'fr' ? 'Envoyez un contrat, faites-le signer et encaissez le paiement — dans le même geste.' : 'Send a contract, get it signed and collect payment — all in one move.'}</p>
        </div>
        <button
          onClick={() => navigate('/sign/app/nouveau')}
          className="flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded bg-[#CEFF8F] px-6 text-sm font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC] sm:h-auto sm:w-auto sm:justify-start sm:py-3"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} /> {lang === 'fr' ? 'Créer un nouveau contrat' : 'Create a new contract'}
        </button>
      </div>

      {/* Stats principales */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {primary.map((s) => (
          <div key={s.label} className="rounded-xl border border-[#3A4242] bg-[#222828] p-4 sm:p-5">
            <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg border border-[#3A4242] bg-[#191E1E]">
              <s.icon className="h-4 w-4 text-[#CEFF8F]" />
            </div>
            <div className="text-xl font-semibold text-white sm:text-2xl">{loading ? '—' : s.value}</div>
            <div className="mt-1 text-sm text-[#F3F4F6]">{s.label}</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-widest text-[#A1A9A9]">{s.hint}</div>
          </div>
        ))}
      </div>

      {/* Répartition par statut */}
      <div className="mb-6 rounded-xl border border-[#3A4242] bg-[#222828] p-4 sm:p-5">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">{lang === 'fr' ? 'Répartition par statut' : 'Breakdown by status'}</div>
          <div className="flex items-center gap-1.5 text-xs text-[#A1A9A9]">
            <TrendingUp className="h-3.5 w-3.5 text-[#CEFF8F]" /> {lang === 'fr' ? 'Taux de signature' : 'Signature rate'}{' '}
            <span className="font-semibold text-[#CEFF8F]">{m.signRate}%</span>
          </div>
        </div>
        {segTotal === 0 ? (
          <div className="py-2 text-sm text-[#6b7373]">{lang === 'fr' ? 'Aucun contrat pour le moment.' : 'No contracts yet.'}</div>
        ) : (
          <>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[#191E1E]">
              {segs.map((s) => (
                <div key={s.key} style={{ width: `${(s.val / segTotal) * 100}%`, background: s.color }} title={`${s.label} : ${s.val}`} />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
              {segs.map((s) => (
                <div key={s.key} className="flex items-center gap-1.5 text-xs text-[#A1A9A9]">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                  {s.label} <span className="font-semibold text-[#F3F4F6]">{s.val}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Contrats récents + aperçu */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        {/* Récents */}
        <div className="lg:col-span-2 overflow-hidden rounded-xl border border-[#3A4242] bg-[#222828]">
          <div className="flex items-center justify-between border-b border-[#3A4242] px-4 py-3 sm:px-5">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">{lang === 'fr' ? 'Contrats récents' : 'Recent contracts'}</div>
            <button onClick={() => navigate('/sign/app/contrats')} className="flex items-center gap-1 text-xs font-medium text-[#CEFF8F] transition-opacity hover:opacity-80">
              {lang === 'fr' ? 'Tout voir' : 'View all'} <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center px-6 py-12 text-[#A1A9A9]">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : m.recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
              <FileText className="mb-3 h-7 w-7 text-[#A1A9A9]" />
              <p className="text-sm text-[#F3F4F6]">{lang === 'fr' ? 'Aucun contrat pour le moment.' : 'No contracts yet.'}</p>
              <button onClick={() => navigate('/sign/app/nouveau')} className="mt-4 flex items-center gap-1.5 rounded bg-[#CEFF8F] px-4 py-2 text-xs font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC]">
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} /> {lang === 'fr' ? 'Créer un contrat' : 'Create a contract'}
              </button>
            </div>
          ) : (
            <ul>
              {m.recent.map((r) => {
                const st = STATUS[r.status] ?? STATUS.draft;
                return (
                  <li
                    key={r.id}
                    onClick={() => navigate(`/sign/app/contrat/${r.id}`)}
                    className="flex cursor-pointer items-center justify-between gap-3 border-b border-[#3A4242] px-4 py-3 transition-colors last:border-0 hover:bg-[#1D2323] sm:px-5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-[#3A4242] bg-[#191E1E]">
                        <FileSignature className="h-3.5 w-3.5 text-[#CEFF8F]" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-white">{r.title}</div>
                        <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-[#A1A9A9]">
                          {fmtDate(r.updated_at)}
                          {r.contactName && <span className="truncate">· {r.contactName}</span>}
                          {r.hasPayment && <span className="text-[#F0B86E]">· {lang === 'fr' ? 'Paiement' : 'Payment'}</span>}
                        </div>
                      </div>
                    </div>
                    <span className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${st.badge}`}>{statusLabel(r.status)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Aperçu secondaire */}
        <div className="rounded-xl border border-[#3A4242] bg-[#222828] p-4 sm:p-5">
          <div className="mb-4 text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">{lang === 'fr' ? 'Aperçu' : 'Overview'}</div>
          <ul className="space-y-3.5">
            {[
              { icon: CreditCard, label: lang === 'fr' ? 'Avec paiement' : 'With payment', value: m.withPayment },
              { icon: UserCheck, label: lang === 'fr' ? 'Assignés à un contact' : 'Assigned to a contact', value: m.withContact },
              { icon: Users, label: lang === 'fr' ? 'Contacts enregistrés' : 'Saved contacts', value: contactsCount },
              { icon: FileEdit, label: lang === 'fr' ? 'Brouillons' : 'Drafts', value: m.draft },
            ].map((it) => (
              <li key={it.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-sm text-[#A1A9A9]">
                  <it.icon className="h-4 w-4 text-[#CEFF8F]" /> {it.label}
                </div>
                <span className="text-sm font-semibold text-white">{loading ? '—' : it.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Actions rapides */}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { icon: FileSignature, title: lang === 'fr' ? 'Éditer un contrat' : 'Edit a contract', sub: lang === 'fr' ? 'Rédaction + champs signataire' : 'Drafting + signer fields', to: '/sign/app/nouveau' },
          { icon: FileText, title: lang === 'fr' ? 'Tous les contrats' : 'All contracts', sub: lang === 'fr' ? 'Suivi, filtres & statuts' : 'Tracking, filters & statuses', to: '/sign/app/contrats' },
          { icon: Users, title: lang === 'fr' ? 'Contacts' : 'Contacts', sub: lang === 'fr' ? 'Vos signataires' : 'Your signers', to: '/sign/app/contacts' },
        ].map((a) => (
          <button
            key={a.title}
            onClick={() => navigate(a.to)}
            className="group flex items-center justify-between rounded-xl border border-[#3A4242] bg-[#222828] p-4 text-left transition-colors hover:border-[#CEFF8F] sm:p-5"
          >
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#3A4242] bg-[#191E1E]">
                <a.icon className="h-5 w-5 text-[#CEFF8F]" />
              </div>
              <div className="min-w-0">
                <div className="font-medium text-white">{a.title}</div>
                <div className="text-xs text-[#A1A9A9]">{a.sub}</div>
              </div>
            </div>
            <ArrowUpRight className="ml-2 h-5 w-5 shrink-0 text-[#A1A9A9] transition-colors group-hover:text-[#CEFF8F]" />
          </button>
        ))}
      </div>

      <div className="mt-8 flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#A1A9A9]">
        <ShieldCheck className="h-3.5 w-3.5 text-[#CEFF8F]" /> {lang === 'fr' ? 'Chaque signature scellée par un faisceau de preuves — conforme RGPD' : 'Every signature sealed by an evidence bundle — GDPR compliant'}
      </div>
    </div>
  );
}
