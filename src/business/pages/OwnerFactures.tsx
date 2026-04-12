import { useState, useMemo, useEffect, useCallback } from 'react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessLang } from '../i18n/BusinessLangContext'
import { supabase } from '../../lib/supabase'
import {
  FileText, Calendar, Loader2, Receipt, ExternalLink, Filter, ChevronDown, ChevronLeft, ChevronRight, Download, User, Copy, Eye,
  Building2, Wallet, CreditCard,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import toast from 'react-hot-toast'
import { BusinessIssuerProfilesModal } from '../components/BusinessIssuerProfilesModal'
import { BusinessPaymentMethodsModal } from '../components/BusinessPaymentMethodsModal'
import { BusinessStripeConnectModal } from '../components/BusinessStripeConnectModal'

interface Invoice {
  id: string
  invoice_number: string
  offer_name: string
  client_name: string
  client_email: string | null
  amount_ht: number
  amount_ttc: number
  status: string
  pdf_url: string | null
  stripe_payment_link: string | null
  team_member_id: string | null
  created_at: string
  due_date: string | null
  issuer_name: string | null
  issuer_company: string | null
  late_penalty_rate: number | null
  late_penalty_fixed: number | null
}

interface TeamMember {
  id: string
  first_name: string
  last_name: string
  role: string
}

const STATUS_OPTIONS = [
  { value: 'à payer', label: 'À payer', bg: 'bg-[#ffb95f]/20', text: 'text-[#b87500]', border: 'border-[#ffb95f]/30' },
  { value: 'en cours', label: 'En cours', bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' },
  { value: 'payé', label: 'Payé', bg: 'bg-[#006c49]/10', text: 'text-[#006c49]', border: 'border-[#006c49]/20' },
]

const getStatusConfig = (status: string) => {
  const found = STATUS_OPTIONS.find(s => s.value === status)
  if (found) return found
  switch (status) {
    case 'envoyée': return { value: status, label: 'Envoyée', bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' }
    case 'générée': return { value: status, label: 'Générée', bg: 'bg-[#eae8e7]', text: 'text-[#444748]', border: 'border-[#c4c7c7]/20' }
    case 'retard': return { value: status, label: 'En retard', bg: 'bg-[#ffdad6]', text: 'text-[#ba1a1a]', border: 'border-[#ba1a1a]/20' }
    case 'en attente': case 'en_attente': return { value: status, label: 'En attente', bg: 'bg-[#ffb95f]/20', text: 'text-[#b87500]', border: 'border-[#ffb95f]/30' }
    default: return { value: status, label: status || 'Brouillon', bg: 'bg-[#eae8e7]', text: 'text-[#444748]', border: 'border-[#c4c7c7]/20' }
  }
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)

const ITEMS_PER_PAGE = 10

export function OwnerFactures() {
  const { user, isTeamMember, teamMember, ownerUserId } = useBusinessAuth()
  const { t, lang } = useBusinessLang()
  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      'à payer': t.owner_factures_status_to_pay,
      'en cours': t.owner_factures_status_in_progress,
      'payé': t.owner_factures_status_paid,
      'envoyée': t.owner_factures_status_sent,
      'générée': t.owner_factures_status_generated,
      'retard': t.owner_factures_status_overdue,
      'en attente': t.owner_factures_status_waiting,
      'en_attente': t.owner_factures_status_waiting,
    }
    return map[status] || status || t.owner_factures_status_draft
  }
  const effectiveUserId = ownerUserId || user?.id

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)

  const [filterMember, setFilterMember] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)

  const [isIssuerProfilesOpen, setIsIssuerProfilesOpen] = useState(false)
  const [isPaymentMethodsOpen, setIsPaymentMethodsOpen] = useState(false)
  const [isStripeConnectOpen, setIsStripeConnectOpen] = useState(false)

  const now = new Date()
  const [startDate, setStartDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0])

  // Fetch data
  useEffect(() => {
    if (!effectiveUserId) { setLoading(false); return }
    setLoading(true)
    Promise.all([
      supabase.from('invoices').select('*').eq('user_id', effectiveUserId).order('created_at', { ascending: false }),
      supabase.from('business_team_members').select('id, first_name, last_name, role').eq('business_owner_id', effectiveUserId),
      supabase.from('business_users').select('id, full_name').eq('id', effectiveUserId).single(),
    ]).then(([invRes, tmRes, ownerRes]) => {
      const list = tmRes.data || []
      if (ownerRes.data) {
        const nameParts = (ownerRes.data.full_name || 'Owner').split(' ')
        list.unshift({ id: ownerRes.data.id, first_name: nameParts[0] || 'Owner', last_name: nameParts.slice(1).join(' ') || '', role: 'Owner' })
      }
      setInvoices(invRes.data || [])
      setTeamMembers(list)
    })
    .catch(err => console.error('[OwnerFactures] Error:', err))
    .finally(() => setLoading(false))
  }, [effectiveUserId])

  // Filter invoices
  const filtered = useMemo(() => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)
    return invoices.filter(inv => {
      const d = new Date(inv.created_at)
      if (d < start || d > end) return false
      if (filterMember !== 'all' && inv.team_member_id !== filterMember) return false
      if (filterStatus !== 'all' && inv.status !== filterStatus) return false
      return true
    })
  }, [invoices, startDate, endDate, filterMember, filterStatus])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filtered.slice(start, start + ITEMS_PER_PAGE)
  }, [filtered, currentPage])

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1) }, [filterMember, filterStatus, startDate, endDate])

  // KPIs
  const totalAmount = useMemo(() => filtered.reduce((s, i) => s + (i.amount_ttc || 0), 0), [filtered])
  const paidAmount = useMemo(() => filtered.filter(i => i.status === 'payé').reduce((s, i) => s + (i.amount_ttc || 0), 0), [filtered])
  const pendingAmount = useMemo(() => filtered.filter(i => i.status !== 'payé').reduce((s, i) => s + (i.amount_ttc || 0), 0), [filtered])
  const pendingCount = useMemo(() => filtered.filter(i => i.status !== 'payé').length, [filtered])

  // Update status
  const handleStatusChange = useCallback(async (invoiceId: string, newStatus: string) => {
    const { error } = await supabase.from('invoices').update({ status: newStatus }).eq('id', invoiceId)
    if (error) { toast.error(t.common_error); return }
    setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, status: newStatus } : inv))
    toast.success(t.owner_factures_status_updated)
  }, [])

  const getMemberName = (id: string | null) => {
    if (!id) return null
    const m = teamMembers.find(t => t.id === id)
    return m ? `${m.first_name.charAt(0)}. ${m.last_name}` : null
  }

  const getMemberInitials = (id: string | null) => {
    if (!id) return null
    const m = teamMembers.find(t => t.id === id)
    return m ? `${m.first_name.charAt(0)}${m.last_name.charAt(0)}`.toUpperCase() : null
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const formatDateInput = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-[#006c49]" /></div>
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
          {t.owner_factures_title}
        </h1>
        <p className="text-[#444748] dark:text-neutral-400 mt-2">{t.owner_factures_subtitle}</p>
      </div>

      {/* KPI Cards — Bento */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total facturé */}
        <div className="bg-white dark:bg-neutral-800 rounded-2xl p-8 shadow-[0_20px_40px_rgba(27,28,27,0.04)] border border-[#c4c7c7]/5 dark:border-neutral-800 hover:bg-[#efedec]/30 dark:hover:bg-neutral-700/30 transition-colors duration-300">
          <div className="flex justify-between items-start mb-4">
            <span className="p-3 rounded-2xl bg-[#efedec] dark:bg-neutral-700 text-[#444748] dark:text-neutral-300">
              <Receipt className="h-5 w-5" />
            </span>
            <span className="text-[10px] font-bold text-[#444748]/40 dark:text-neutral-500 tracking-widest uppercase">{t.owner_factures_global}</span>
          </div>
          <p className="text-[#444748] dark:text-neutral-400 text-sm font-medium">{t.owner_factures_total_billed}</p>
          <p className="text-4xl font-extrabold mt-1 text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {totalAmount.toLocaleString('fr-FR')} <span className="text-xl">€</span>
          </p>
        </div>

        {/* Payé */}
        <div className="bg-white dark:bg-neutral-800 rounded-2xl p-8 shadow-[0_20px_40px_rgba(27,28,27,0.04)] border border-[#c4c7c7]/5 dark:border-neutral-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#006c49]/5 rounded-full -mr-16 -mt-16 blur-3xl" />
          <div className="flex justify-between items-start mb-4">
            <span className="p-3 rounded-2xl bg-[#006c49]/10 text-[#006c49]">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
            </span>
          </div>
          <p className="text-[#444748] dark:text-neutral-400 text-sm font-medium">{t.owner_factures_paid}</p>
          <p className="text-4xl font-extrabold mt-1 text-[#006c49]" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {paidAmount.toLocaleString('fr-FR')} <span className="text-xl">€</span>
          </p>
        </div>

        {/* En attente */}
        <div className="bg-white dark:bg-neutral-800 rounded-2xl p-8 shadow-[0_20px_40px_rgba(27,28,27,0.04)] border border-[#c4c7c7]/5 dark:border-neutral-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#ffb95f]/10 rounded-full -mr-16 -mt-16 blur-3xl" />
          <div className="flex justify-between items-start mb-4">
            <span className="p-3 rounded-2xl bg-[#ffb95f]/20 text-[#b87500]">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            </span>
            <span className="text-[10px] font-bold text-[#b87500] tracking-widest uppercase">{pendingCount} {pendingCount !== 1 ? t.owner_factures_invoices_plural : t.owner_factures_invoice_singular}</span>
          </div>
          <p className="text-[#444748] dark:text-neutral-400 text-sm font-medium">{t.owner_factures_pending}</p>
          <p className="text-4xl font-extrabold mt-1 text-[#b87500]" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {pendingAmount.toLocaleString('fr-FR')} <span className="text-xl">€</span>
          </p>
        </div>
      </div>

      {/* Filter Bar — Glass pill */}
      <div className="bg-white/70 dark:bg-white/5 backdrop-blur-2xl rounded-2xl md:rounded-full p-3 px-4 md:px-6 flex flex-col md:flex-row flex-wrap items-stretch md:items-center gap-3 md:gap-6 shadow-[0_20px_40px_rgba(27,28,27,0.04)] ring-1 ring-[#c4c7c7]/10 dark:ring-neutral-700">
        <div className="flex items-center gap-3 md:border-r border-[#c4c7c7]/20 dark:border-neutral-700 md:pr-6">
          <span className="text-xs font-bold text-[#444748]/60 dark:text-neutral-400 uppercase tracking-tighter shrink-0">{t.owner_factures_period}</span>
          <div className="flex items-center gap-2 min-w-0">
            <input
              type="date"
              value={startDate}
              onChange={e => {
                const newStart = e.target.value
                const oldStart = new Date(startDate)
                const ns = new Date(newStart)
                if (ns > oldStart) {
                  const diff = (ns.getFullYear() - oldStart.getFullYear()) * 12 + ns.getMonth() - oldStart.getMonth()
                  if (diff > 0) {
                    const newEnd = new Date(endDate)
                    newEnd.setMonth(newEnd.getMonth() + diff)
                    setEndDate(newEnd.toISOString().split('T')[0])
                  }
                }
                setStartDate(newStart)
              }}
              className="bg-transparent border-none text-sm font-semibold focus:ring-0 p-0 w-28 text-[#1b1c1b] dark:text-white"
            />
            <span className="text-[#444748]/40">→</span>
            <input
              type="date"
              value={endDate}
              onChange={e => {
                const newEnd = e.target.value
                const oldEnd = new Date(endDate)
                const ne = new Date(newEnd)
                if (ne < oldEnd) {
                  const diff = (oldEnd.getFullYear() - ne.getFullYear()) * 12 + oldEnd.getMonth() - ne.getMonth()
                  if (diff > 0) {
                    const newStart = new Date(startDate)
                    newStart.setMonth(newStart.getMonth() - diff)
                    setStartDate(newStart.toISOString().split('T')[0])
                  }
                }
                setEndDate(newEnd)
              }}
              className="bg-transparent border-none text-sm font-semibold focus:ring-0 p-0 w-28 text-[#1b1c1b] dark:text-white"
            />
          </div>
        </div>

        {teamMembers.length > 0 && (
          <div className="flex items-center gap-3 md:border-r border-[#c4c7c7]/20 dark:border-neutral-700 md:pr-6">
            <span className="text-xs font-bold text-[#444748]/60 dark:text-neutral-400 uppercase tracking-tighter shrink-0">{t.owner_factures_member}</span>
            <select
              value={filterMember}
              onChange={e => setFilterMember(e.target.value)}
              className="bg-transparent border-none text-sm font-semibold focus:ring-0 p-0 pr-8 cursor-pointer text-[#1b1c1b] dark:text-white min-w-0"
            >
              <option value="all">{t.owner_factures_all_members}</option>
              {teamMembers.map(m => (
                <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-[#444748]/60 dark:text-neutral-400 uppercase tracking-tighter shrink-0">{t.owner_factures_status}</span>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="bg-transparent border-none text-sm font-semibold focus:ring-0 p-0 pr-8 cursor-pointer text-[#1b1c1b] dark:text-white min-w-0"
          >
            <option value="all">{t.owner_factures_all_statuses}</option>
            {STATUS_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{statusLabel(s.value)}</option>
            ))}
          </select>
        </div>

        <div className="md:ml-auto flex items-center gap-2 justify-end">
          <button className="p-2 rounded-full hover:bg-[#eae8e7] dark:hover:bg-neutral-700 transition-colors text-[#444748] dark:text-neutral-400">
            <Filter className="h-5 w-5" />
          </button>
          <button className="p-2 rounded-full hover:bg-[#eae8e7] dark:hover:bg-neutral-700 transition-colors text-[#444748] dark:text-neutral-400">
            <Download className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Invoice Table */}
      <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-[0_20px_40px_rgba(27,28,27,0.04)] border border-[#c4c7c7]/5 dark:border-neutral-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f5f3f2]/50 dark:bg-neutral-900/50">
                <th className="px-4 md:px-8 py-5 text-[11px] font-black text-[#444748]/60 dark:text-neutral-500 uppercase tracking-widest" style={{ fontFamily: 'Manrope, sans-serif' }}>{t.owner_factures_th_invoice_number}</th>
                <th className="hidden md:table-cell px-8 py-5 text-[11px] font-black text-[#444748]/60 dark:text-neutral-500 uppercase tracking-widest" style={{ fontFamily: 'Manrope, sans-serif' }}>{t.owner_factures_th_date}</th>
                <th className="px-4 md:px-8 py-5 text-[11px] font-black text-[#444748]/60 dark:text-neutral-500 uppercase tracking-widest" style={{ fontFamily: 'Manrope, sans-serif' }}>{t.owner_factures_th_client}</th>
                <th className="hidden lg:table-cell px-8 py-5 text-[11px] font-black text-[#444748]/60 dark:text-neutral-500 uppercase tracking-widest" style={{ fontFamily: 'Manrope, sans-serif' }}>{t.owner_factures_th_member}</th>
                <th className="px-4 md:px-8 py-5 text-[11px] font-black text-[#444748]/60 dark:text-neutral-500 uppercase tracking-widest" style={{ fontFamily: 'Manrope, sans-serif' }}>{t.owner_factures_th_amount}</th>
                <th className="hidden md:table-cell px-8 py-5 text-[11px] font-black text-[#444748]/60 dark:text-neutral-500 uppercase tracking-widest" style={{ fontFamily: 'Manrope, sans-serif' }}>{t.owner_factures_th_due_date}</th>
                <th className="px-4 md:px-8 py-5 text-[11px] font-black text-[#444748]/60 dark:text-neutral-500 uppercase tracking-widest text-center" style={{ fontFamily: 'Manrope, sans-serif' }}>{t.owner_factures_th_status}</th>
                <th className="hidden sm:table-cell px-8 py-5 text-[11px] font-black text-[#444748]/60 dark:text-neutral-500 uppercase tracking-widest text-right" style={{ fontFamily: 'Manrope, sans-serif' }}>{t.owner_factures_th_actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c4c7c7]/10 dark:divide-neutral-700">
              {paginatedInvoices.map(inv => {
                const config = getStatusConfig(inv.status)
                const memberName = getMemberName(inv.team_member_id)
                const memberInitials = getMemberInitials(inv.team_member_id)

                return (
                  <tr key={inv.id} className="hover:bg-[#efedec]/30 dark:hover:bg-neutral-700/30 transition-colors group">
                    <td className="px-4 md:px-8 py-4 md:py-6 font-mono text-xs font-bold text-[#444748] dark:text-neutral-300">
                      {inv.invoice_number}
                      <span className="md:hidden block text-[10px] font-medium text-[#444748]/60 dark:text-neutral-500 mt-0.5">{formatDate(inv.created_at)}</span>
                    </td>
                    <td className="hidden md:table-cell px-8 py-6 text-sm text-[#1b1c1b] dark:text-white font-medium">{formatDate(inv.created_at)}</td>
                    <td className="px-4 md:px-8 py-4 md:py-6">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-[#1b1c1b] dark:text-white truncate max-w-[120px] md:max-w-none" style={{ fontFamily: 'Manrope, sans-serif' }}>{inv.client_name}</span>
                        {inv.offer_name && <span className="text-[10px] text-[#444748] dark:text-neutral-400 font-medium truncate max-w-[120px] md:max-w-none">{inv.offer_name}</span>}
                      </div>
                    </td>
                    <td className="hidden lg:table-cell px-8 py-6">
                      {memberName ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#eae8e7] dark:bg-neutral-700 flex items-center justify-center text-[8px] font-bold text-[#1b1c1b] dark:text-white">
                            {memberInitials}
                          </div>
                          <span className="text-xs font-semibold text-[#1b1c1b] dark:text-white">{memberName}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-[#444748]/40 dark:text-neutral-600">—</span>
                      )}
                    </td>
                    <td className="px-4 md:px-8 py-4 md:py-6 text-sm font-extrabold text-[#1b1c1b] dark:text-white whitespace-nowrap">{formatCurrency(inv.amount_ttc || 0)}</td>
                    <td className="hidden md:table-cell px-8 py-6">
                      {inv.due_date ? (
                        <span className={cn("text-xs font-semibold", inv.due_date && new Date(inv.due_date) < new Date() && inv.status !== 'payé' ? "text-[#ba1a1a]" : "text-[#444748] dark:text-neutral-400")}>
                          {new Date(inv.due_date).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short' })}
                          {inv.due_date && new Date(inv.due_date) < new Date() && inv.status !== 'payé' && (
                            <span className="ml-1 text-[9px] uppercase font-black text-[#ba1a1a]">{t.owner_factures_late}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs text-[#444748]/40 dark:text-neutral-600">—</span>
                      )}
                    </td>
                    <td className="px-4 md:px-8 py-4 md:py-6">
                      <div className="flex justify-center">
                        <select
                          value={inv.status || ''}
                          onChange={e => handleStatusChange(inv.id, e.target.value)}
                          className={cn(
                            'rounded-full px-3 md:px-4 py-1.5 text-[10px] font-black uppercase tracking-widest border cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-[#006c49]/20',
                            config.bg, config.text, config.border
                          )}
                        >
                          {STATUS_OPTIONS.map(s => (
                            <option key={s.value} value={s.value}>{statusLabel(s.value)}</option>
                          ))}
                          {!STATUS_OPTIONS.find(s => s.value === inv.status) && inv.status && (
                            <option value={inv.status}>{statusLabel(inv.status)}</option>
                          )}
                        </select>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-8 py-6 text-right">
                      <div className="flex justify-end gap-2">
                        {inv.stripe_payment_link && (
                          <button
                            onClick={() => { navigator.clipboard.writeText(inv.stripe_payment_link!); toast.success(t.owner_factures_link_copied) }}
                            className="bg-[#1b1c1b] text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-[#1b1c1b]/80 transition-all inline-flex items-center gap-1.5"
                            title={t.owner_factures_copy_payment_link}
                          >
                            <Copy className="h-3 w-3" />
                            <span className="hidden lg:inline">{t.owner_factures_link}</span>
                          </button>
                        )}
                        {inv.stripe_payment_link && (
                          <a
                            href={inv.stripe_payment_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-[#635BFF] text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-[#5349E0] transition-all inline-flex items-center gap-1.5"
                          >
                            <span className="hidden lg:inline">{t.owner_factures_pay}</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {inv.pdf_url && (
                          <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <a href={inv.pdf_url} target="_blank" rel="noreferrer" className="p-2 rounded-full hover:bg-[#eae8e7] dark:hover:bg-neutral-700 text-[#444748] dark:text-neutral-400 hover:text-[#1b1c1b] dark:hover:text-white transition-colors" title={t.owner_factures_view}>
                              <Eye className="h-4 w-4" />
                            </a>
                            <a href={inv.pdf_url} download className="p-2 rounded-full hover:bg-[#eae8e7] dark:hover:bg-neutral-700 text-[#444748] dark:text-neutral-400 hover:text-[#006c49] transition-colors" title={t.owner_factures_download}>
                              <Download className="h-4 w-4" />
                            </a>
                          </div>
                        )}
                        {!inv.stripe_payment_link && !inv.pdf_url && (
                          <button className="text-[10px] font-black uppercase tracking-widest text-[#444748] dark:text-neutral-400 hover:text-[#1b1c1b] dark:hover:text-white transition-colors">
                            {t.owner_factures_details}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 bg-[#f5f3f2] dark:bg-neutral-700 rounded-full flex items-center justify-center mb-4">
                        <FileText className="h-8 w-8 text-[#c4c7c7]" />
                      </div>
                      <p className="text-sm font-semibold text-[#1b1c1b] dark:text-white mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>{t.owner_factures_empty_title}</p>
                      <p className="text-xs text-[#444748] dark:text-neutral-400">{t.owner_factures_empty_desc}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="px-4 md:px-8 py-4 md:py-6 bg-[#f5f3f2]/30 dark:bg-neutral-900/30 flex flex-col sm:flex-row justify-between items-center gap-3">
            <p className="text-[10px] font-bold text-[#444748] dark:text-neutral-400 uppercase tracking-widest">
              {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} {t.owner_factures_of} {filtered.length}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-[#efedec] dark:bg-neutral-700 hover:bg-[#eae8e7] dark:hover:bg-neutral-600 transition-colors text-[#1b1c1b] dark:text-white disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).slice(
                Math.max(0, currentPage - 3),
                Math.min(totalPages, currentPage + 2)
              ).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    page === currentPage
                      ? 'bg-[#1b1c1b] dark:bg-white text-white dark:text-neutral-900 shadow-lg shadow-black/10'
                      : 'bg-[#efedec] dark:bg-neutral-700 hover:bg-[#eae8e7] dark:hover:bg-neutral-600 text-[#1b1c1b] dark:text-white'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-[#efedec] dark:bg-neutral-700 hover:bg-[#eae8e7] dark:hover:bg-neutral-600 transition-colors text-[#1b1c1b] dark:text-white disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <BusinessIssuerProfilesModal isOpen={isIssuerProfilesOpen} onClose={() => setIsIssuerProfilesOpen(false)} />
      <BusinessPaymentMethodsModal isOpen={isPaymentMethodsOpen} onClose={() => setIsPaymentMethodsOpen(false)} />
      <BusinessStripeConnectModal isOpen={isStripeConnectOpen} onClose={() => setIsStripeConnectOpen(false)} />
    </div>
  )
}
