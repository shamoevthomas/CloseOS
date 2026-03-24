import { useState, useMemo, useEffect, useCallback } from 'react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessProspects } from '../contexts/BusinessProspectsContext'
import { supabase } from '../../lib/supabase'
import {
  TrendingUp, DollarSign, FileText, CreditCard, Clock,
  Info, Eye, Download, Loader2, Plus, X, ExternalLink,
  Building2, Copy, Wallet,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import toast from 'react-hot-toast'
import { BusinessIssuerProfilesModal } from '../components/BusinessIssuerProfilesModal'
import { BusinessPaymentMethodsModal } from '../components/BusinessPaymentMethodsModal'
import { BusinessStripeConnectModal } from '../components/BusinessStripeConnectModal'
import { BusinessInvoiceGeneratorModal } from '../components/BusinessInvoiceGeneratorModal'

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)

const STATUS_OPTIONS = [
  { value: 'à payer', label: 'À payer', bg: 'bg-stone-100', text: 'text-stone-600', border: 'border-stone-200' },
  { value: 'en cours', label: 'En cours', bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
  { value: 'payé', label: 'Payé', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
]

const getStatusConfig = (status: string) => {
  const found = STATUS_OPTIONS.find(s => s.value === status)
  if (found) return found
  switch (status) {
    case 'envoyée': return { value: status, label: 'Envoyée', bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' }
    case 'générée': return { value: status, label: 'Générée', bg: 'bg-stone-100', text: 'text-stone-500', border: 'border-stone-200' }
    case 'retard': return { value: status, label: 'En retard', bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' }
    case 'en attente': case 'en_attente': return { value: status, label: 'En attente', bg: 'bg-stone-100', text: 'text-stone-600', border: 'border-stone-200' }
    default: return { value: status, label: status || 'Brouillon', bg: 'bg-stone-100', text: 'text-stone-500', border: 'border-stone-200' }
  }
}

// French late payment penalty info:
// - Taux légal: 3x le taux d'intérêt légal semestriel (minimum ~12-15% annuel)
// - Indemnité forfaitaire de recouvrement: 40€ (Article L441-10 Code de commerce)
// - Mention obligatoire sur la facture
export function CloserFactures() {
  const { user, teamMember, ownerUserId, isTeamMember, businessSettings } = useBusinessAuth()
  const { prospects } = useBusinessProspects()
  const effectiveUserId = ownerUserId || user?.id

  const [savedInvoices, setSavedInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  const [startDate, setStartDate] = useState(firstDayOfMonth.toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(lastDayOfMonth.toISOString().split('T')[0])

  // Generate invoice modal
  const [isGenModalOpen, setIsGenModalOpen] = useState(false)

  // Config modals
  const [isIssuerModalOpen, setIsIssuerModalOpen] = useState(false)
  const [isPaymentMethodsOpen, setIsPaymentMethodsOpen] = useState(false)
  const [isStripeConnectOpen, setIsStripeConnectOpen] = useState(false)

  // Fetch invoices
  const fetchInvoices = useCallback(async () => {
    if (!effectiveUserId) return
    setLoading(true)
    const { data } = await supabase
      .from('invoices')
      .select('*')
      .eq('user_id', effectiveUserId)
      .order('created_at', { ascending: false })
    setSavedInvoices(data || [])
    setLoading(false)
  }, [effectiveUserId])

  useEffect(() => { fetchInvoices() }, [fetchInvoices])

  // Helper: check if a deal (cash or installment) overlaps the selected period
  const isDealInPeriod = useCallback((p: typeof prospects[0], start: Date, end: Date) => {
    const dealDate = new Date(p.last_contact || p.created_at || '')
    if (isNaN(dealDate.getTime())) return false

    const isInstallment = p.payment_type === 'installments' || (p.installments && p.installments > 1)

    if (!isInstallment) {
      // Cash: deal date must be within period
      return dealDate >= start && dealDate <= end
    }

    // Installment: at least one monthly payment falls within the period
    const months = p.installments || 1
    const endDateDeal = new Date(dealDate)
    endDateDeal.setMonth(endDateDeal.getMonth() + (months - 1))
    return dealDate <= end && endDateDeal >= start
  }, [])

  // Helper: compute how much revenue falls within the period for a deal
  const revenueInPeriod = useCallback((p: typeof prospects[0], start: Date, end: Date) => {
    const fullValue = p.value || 0
    const isInstallment = p.payment_type === 'installments' || (p.installments && p.installments > 1)

    if (!isInstallment) return fullValue

    const months = p.installments || 1
    const monthlyValue = fullValue / months
    const dealDate = new Date(p.last_contact || p.created_at || '')
    let count = 0
    for (let i = 0; i < months; i++) {
      const instDate = new Date(dealDate)
      instDate.setMonth(instDate.getMonth() + i)
      if (instDate >= start && instDate <= end) count++
    }
    return monthlyValue * count
  }, [])

  // Period bounds
  const periodStart = useMemo(() => new Date(startDate), [startDate])
  const periodEnd = useMemo(() => {
    const d = new Date(endDate)
    d.setHours(23, 59, 59, 999)
    return d
  }, [endDate])

  // Compensation type
  const compType = teamMember?.compensation_type || 'commission'
  const isFixedComp = compType === 'fixed'
  const isFixedPlusComm = compType === 'fixed_plus_commission'
  const fixedSalary = teamMember?.fixed_salary ? Number(teamMember.fixed_salary) : 0
  const countSetterComm = teamMember?.count_setter_commission !== false

  // Won prospects assigned to me, filtered by period
  const myWonProspects = useMemo(
    () => prospects.filter(p => {
      if (p.stage !== 'won' || !isDealInPeriod(p, periodStart, periodEnd)) return false
      if (p.assigned_to === teamMember?.id) return true
      if (p.assigned_setter === teamMember?.id && countSetterComm) return true
      return false
    }),
    [prospects, teamMember?.id, periodStart, periodEnd, isDealInPeriod, countSetterComm]
  )

  // Closer deals only (for KPI breakdown)
  const myCloserDeals = useMemo(
    () => prospects.filter(p =>
      p.stage === 'won' && p.assigned_to === teamMember?.id && isDealInPeriod(p, periodStart, periodEnd)
    ),
    [prospects, teamMember?.id, periodStart, periodEnd, isDealInPeriod]
  )

  // Setter deals only (not also closer, to avoid double-counting) — empty if setter commission disabled
  const mySetterDeals = useMemo(
    () => !countSetterComm ? [] : prospects.filter(p =>
      p.stage === 'won' && p.assigned_setter === teamMember?.id && p.assigned_to !== teamMember?.id && isDealInPeriod(p, periodStart, periodEnd)
    ),
    [prospects, teamMember?.id, periodStart, periodEnd, isDealInPeriod, countSetterComm]
  )

  // Filter invoices by date range + only mine
  const filteredInvoices = useMemo(() => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)
    return savedInvoices.filter(inv => {
      const d = new Date(inv.created_at)
      if (d < start || d > end) return false
      if (isTeamMember && teamMember?.id && inv.team_member_id && inv.team_member_id !== teamMember.id) return false
      return true
    })
  }, [savedInvoices, startDate, endDate, isTeamMember, teamMember?.id])

  // Commission rate
  const commissionRateNum = teamMember?.commission_rate ? Number(teamMember.commission_rate) : 10
  const rate = commissionRateNum / 100

  // KPIs — compute revenue & commission for the selected period (with installment proration)
  const totalRevenue = useMemo(() =>
    myWonProspects.reduce((sum, p) => sum + revenueInPeriod(p, periodStart, periodEnd), 0),
    [myWonProspects, periodStart, periodEnd, revenueInPeriod]
  )

  const commissionEstimee = useMemo(() =>
    myWonProspects.reduce((sum, p) => sum + revenueInPeriod(p, periodStart, periodEnd) * rate, 0),
    [myWonProspects, periodStart, periodEnd, revenueInPeriod, rate]
  )

  const isSetterCloser = teamMember?.role === 'Setter-Closer'

  const commissionCloser = useMemo(() =>
    myCloserDeals.reduce((sum, p) => sum + revenueInPeriod(p, periodStart, periodEnd) * rate, 0),
    [myCloserDeals, periodStart, periodEnd, revenueInPeriod, rate]
  )

  const commissionSetter = useMemo(() =>
    mySetterDeals.reduce((sum, p) => sum + revenueInPeriod(p, periodStart, periodEnd) * rate, 0),
    [mySetterDeals, periodStart, periodEnd, revenueInPeriod, rate]
  )

  const pendingInvoices = useMemo(() =>
    filteredInvoices.filter(inv => ['en_attente', 'retard', 'en attente', 'à payer', 'en cours'].includes(inv.status)),
    [filteredInvoices]
  )

  const pendingAmount = useMemo(() =>
    pendingInvoices.reduce((sum, inv) => sum + (inv.amount_ttc || 0), 0),
    [pendingInvoices]
  )

  const paidAmount = useMemo(() =>
    filteredInvoices.filter(inv => inv.status === 'payé').reduce((sum, inv) => sum + (inv.amount_ttc || 0), 0),
    [filteredInvoices]
  )

  // Update status
  const handleStatusChange = useCallback(async (invoiceId: string, newStatus: string) => {
    const { error } = await supabase.from('invoices').update({ status: newStatus }).eq('id', invoiceId)
    if (error) { toast.error('Erreur'); return }
    setSavedInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, status: newStatus } : inv))
    toast.success('Statut mis à jour')
  }, [])

  const copyStripeLink = (link: string) => {
    navigator.clipboard.writeText(link)
    toast.success('Lien copié')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
      </div>
    )
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {isFixedComp ? 'Factures & Salaire Fixe' : isFixedPlusComm ? 'Factures & Rémunération' : 'Factures & Commissions'}
          </h1>
          <p className="text-stone-500 dark:text-neutral-400 mt-2">{isFixedComp ? 'Suivez votre salaire fixe et gérez vos factures' : isFixedPlusComm ? 'Suivez votre fixe, vos commissions et gérez vos factures' : 'Suivez vos commissions et gérez vos factures'}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setIsStripeConnectOpen(true)}
            className="flex items-center gap-2 rounded-full bg-[#635BFF] px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-[#5349E0] hover:shadow-lg hover:shadow-[#635BFF]/20 active:scale-95"
          >
            <CreditCard className="h-4 w-4" />
            Connecter Stripe
          </button>
          <button
            onClick={() => setIsIssuerModalOpen(true)}
            className="flex items-center gap-2 rounded-full border border-stone-200 dark:border-neutral-700 px-5 py-2.5 text-sm font-semibold text-stone-700 dark:text-neutral-200 hover:bg-stone-50 dark:hover:bg-neutral-800 transition-colors"
          >
            <Building2 className="h-4 w-4" />
            Infos Émetteur
          </button>
          <button
            onClick={() => setIsPaymentMethodsOpen(true)}
            className="flex items-center gap-2 rounded-full border border-stone-200 dark:border-neutral-700 px-5 py-2.5 text-sm font-semibold text-stone-700 dark:text-neutral-200 hover:bg-stone-50 dark:hover:bg-neutral-800 transition-colors"
          >
            <Wallet className="h-4 w-4" />
            Moyens de Paiement
          </button>
          <button
            onClick={() => setIsGenModalOpen(true)}
            className="flex items-center gap-2 rounded-full bg-stone-900 dark:bg-white px-5 py-2.5 text-sm font-semibold text-white dark:text-neutral-900 hover:bg-stone-800 dark:hover:bg-neutral-200 transition-colors"
          >
            <Plus className="h-4 w-4" /> Générer une facture
          </button>
        </div>
      </div>

      {/* Filter Bar — Glass pill */}
      <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-full p-3 px-6 flex flex-wrap items-center gap-6 shadow-[0_20px_40px_rgba(27,28,27,0.04)] border border-white/40 dark:border-white/10">
        <div className="flex items-center gap-3 border-r border-stone-200/40 dark:border-white/10 pr-6">
          <span className="text-xs font-bold text-stone-500 dark:text-neutral-400 uppercase tracking-widest">Période</span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
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
              className="bg-transparent border-none text-sm font-semibold focus:ring-0 p-0 w-28 text-stone-900 dark:text-white"
            />
            <span className="text-stone-400">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
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
              className="bg-transparent border-none text-sm font-semibold focus:ring-0 p-0 w-28 text-stone-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-6 grid-cols-2 lg:grid-cols-4">

        {/* Salaire Fixe — shown for fixed and fixed+commission */}
        {(isFixedComp || isFixedPlusComm) && (
        <div className="bg-white dark:bg-white/5 rounded-xl p-6 shadow-[0_20px_40px_rgba(27,28,27,0.04)] border border-stone-100/50 dark:border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-12 -mt-12 blur-3xl" />
          <div className="flex justify-between items-start mb-4">
            <span className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
              <Wallet className="h-5 w-5" />
            </span>
            <span className="text-[10px] font-bold text-stone-400 dark:text-neutral-500 tracking-widest uppercase">Mensuel</span>
          </div>
          <p className="text-stone-500 dark:text-neutral-400 text-sm font-medium">Salaire Fixe</p>
          <p className="text-2xl font-extrabold mt-1 text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {fixedSalary.toLocaleString('fr-FR')} <span className="text-base">€</span>
          </p>
        </div>
        )}

        {/* Ma Commission — split for Setter-Closer, single for others */}
        {!isFixedComp && !isSetterCloser && (
        <div className="bg-white dark:bg-white/5 rounded-xl p-6 shadow-[0_20px_40px_rgba(27,28,27,0.04)] border border-stone-100/50 dark:border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-stone-500/5 rounded-full -mr-12 -mt-12 blur-3xl" />
          <div className="flex justify-between items-start mb-4">
            <span className="p-3 rounded-xl bg-stone-100 dark:bg-white/10 text-stone-600 dark:text-neutral-300">
              <DollarSign className="h-5 w-5" />
            </span>
            <span className="text-[10px] font-bold text-stone-400 dark:text-neutral-500 tracking-widest uppercase">{teamMember?.commission_rate || 10}% CA</span>
          </div>
          <p className="text-stone-500 dark:text-neutral-400 text-sm font-medium">Ma Commission</p>
          <p className="text-2xl font-extrabold mt-1 text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {commissionEstimee.toLocaleString('fr-FR')} <span className="text-base">€</span>
          </p>
        </div>
        )}

        {!isFixedComp && isSetterCloser && (
        <>
        <div className="bg-white dark:bg-white/5 rounded-xl p-6 shadow-[0_20px_40px_rgba(27,28,27,0.04)] border border-stone-100/50 dark:border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-12 -mt-12 blur-3xl" />
          <div className="flex justify-between items-start mb-4">
            <span className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <DollarSign className="h-5 w-5" />
            </span>
            <span className="text-[10px] font-bold text-stone-400 dark:text-neutral-500 tracking-widest uppercase">{myCloserDeals.length} deal{myCloserDeals.length !== 1 ? 's' : ''}</span>
          </div>
          <p className="text-stone-500 dark:text-neutral-400 text-sm font-medium">Commission Closer</p>
          <p className="text-2xl font-extrabold mt-1 text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {commissionCloser.toLocaleString('fr-FR')} <span className="text-base">€</span>
          </p>
        </div>
        <div className="bg-white dark:bg-white/5 rounded-xl p-6 shadow-[0_20px_40px_rgba(27,28,27,0.04)] border border-stone-100/50 dark:border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full -mr-12 -mt-12 blur-3xl" />
          <div className="flex justify-between items-start mb-4">
            <span className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <DollarSign className="h-5 w-5" />
            </span>
            <span className="text-[10px] font-bold text-stone-400 dark:text-neutral-500 tracking-widest uppercase">{mySetterDeals.length} deal{mySetterDeals.length !== 1 ? 's' : ''}</span>
          </div>
          <p className="text-stone-500 dark:text-neutral-400 text-sm font-medium">Commission Setter</p>
          <p className="text-2xl font-extrabold mt-1 text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {commissionSetter.toLocaleString('fr-FR')} <span className="text-base">€</span>
          </p>
        </div>
        </>
        )}

        {/* CA Généré — shown for fixed (read-only) */}
        {isFixedComp && (
        <div className="bg-white dark:bg-white/5 rounded-xl p-6 shadow-[0_20px_40px_rgba(27,28,27,0.04)] border border-stone-100/50 dark:border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-stone-500/5 rounded-full -mr-12 -mt-12 blur-3xl" />
          <div className="flex justify-between items-start mb-4">
            <span className="p-3 rounded-xl bg-stone-100 dark:bg-white/10 text-stone-600 dark:text-neutral-300">
              <TrendingUp className="h-5 w-5" />
            </span>
            <span className="text-[10px] font-bold text-stone-400 dark:text-neutral-500 tracking-widest uppercase">{myWonProspects.length} deal{myWonProspects.length !== 1 ? 's' : ''}</span>
          </div>
          <p className="text-stone-500 dark:text-neutral-400 text-sm font-medium">CA Généré</p>
          <p className="text-2xl font-extrabold mt-1 text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {totalRevenue.toLocaleString('fr-FR')} <span className="text-base">€</span>
          </p>
        </div>
        )}

        {/* CA Généré — shown for commission and fixed+commission */}
        {!isFixedComp && (
        <div className="bg-white dark:bg-white/5 rounded-xl p-6 shadow-[0_20px_40px_rgba(27,28,27,0.04)] border border-stone-100/50 dark:border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-12 -mt-12 blur-3xl" />
          <div className="flex justify-between items-start mb-4">
            <span className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp className="h-5 w-5" />
            </span>
            <span className="text-[10px] font-bold text-stone-400 dark:text-neutral-500 tracking-widest uppercase">{myWonProspects.length} deal{myWonProspects.length !== 1 ? 's' : ''}</span>
          </div>
          <p className="text-stone-500 dark:text-neutral-400 text-sm font-medium">CA Généré</p>
          <p className="text-2xl font-extrabold mt-1 text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {totalRevenue.toLocaleString('fr-FR')} <span className="text-base">€</span>
          </p>
        </div>
        )}

        {/* Payé */}
        <div className="bg-white dark:bg-white/5 rounded-xl p-6 shadow-[0_20px_40px_rgba(27,28,27,0.04)] border border-stone-100/50 dark:border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-12 -mt-12 blur-3xl" />
          <div className="flex justify-between items-start mb-4">
            <span className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
              <CreditCard className="h-5 w-5" />
            </span>
          </div>
          <p className="text-stone-500 dark:text-neutral-400 text-sm font-medium">Payé</p>
          <p className="text-2xl font-extrabold mt-1 text-emerald-600" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {paidAmount.toLocaleString('fr-FR')} <span className="text-base">€</span>
          </p>
        </div>

        {/* En attente */}
        <div className="bg-white dark:bg-white/5 rounded-xl p-6 shadow-[0_20px_40px_rgba(27,28,27,0.04)] border border-stone-100/50 dark:border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full -mr-12 -mt-12 blur-3xl" />
          <div className="flex justify-between items-start mb-4">
            <span className="p-3 rounded-xl bg-red-50 text-red-500">
              <Clock className="h-5 w-5" />
            </span>
            <span className="text-[10px] font-bold text-stone-400 dark:text-neutral-500 tracking-widest uppercase">{pendingInvoices.length} facture{pendingInvoices.length !== 1 ? 's' : ''}</span>
          </div>
          <p className="text-stone-500 dark:text-neutral-400 text-sm font-medium">En attente</p>
          <p className="text-2xl font-extrabold mt-1 text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {pendingAmount.toLocaleString('fr-FR')} <span className="text-base">€</span>
          </p>
        </div>
      </div>

      {/* Détails comptant / échelonné — hidden for fixed compensation */}
      {!isFixedComp && (
      <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-xl border border-white/40 dark:border-white/10 shadow-sm p-6">
        <h3 className="text-xs font-bold uppercase tracking-widest text-stone-500 dark:text-neutral-400 mb-5 flex items-center gap-2">
          <Info className="h-4 w-4" />
          Détails de la période
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-5 rounded-xl bg-white dark:bg-white/5 shadow-[0_20px_40px_rgba(27,28,27,0.04)] border border-stone-100/50 dark:border-white/10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="text-sm font-bold text-stone-700 dark:text-neutral-200" style={{ fontFamily: 'Manrope, sans-serif' }}>Paiement Comptant</span>
              </div>
              <span className="text-lg font-extrabold text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {myWonProspects.filter(p => !p.installments || p.installments <= 1).length}
              </span>
            </div>
            <div className="h-2 w-full bg-stone-100 dark:bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                style={{
                  width: myWonProspects.length > 0
                    ? `${(myWonProspects.filter(p => !p.installments || p.installments <= 1).length / myWonProspects.length) * 100}%`
                    : '0%'
                }}
              />
            </div>
            <p className="text-xs text-stone-500 dark:text-neutral-400 mt-2 text-right">
              Total : <span className="font-bold text-emerald-600">
                {formatCurrency(myWonProspects.filter(p => !p.installments || p.installments <= 1).reduce((s, p) => s + (p.value || 0), 0))}
              </span>
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white dark:bg-white/5 shadow-[0_20px_40px_rgba(27,28,27,0.04)] border border-stone-100/50 dark:border-white/10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                <span className="text-sm font-bold text-stone-700 dark:text-neutral-200" style={{ fontFamily: 'Manrope, sans-serif' }}>Paiement en plusieurs fois</span>
              </div>
              <span className="text-lg font-extrabold text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {myWonProspects.filter(p => p.installments && p.installments > 1).length}
              </span>
            </div>
            <div className="h-2 w-full bg-stone-100 dark:bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-700"
                style={{
                  width: myWonProspects.length > 0
                    ? `${(myWonProspects.filter(p => p.installments && p.installments > 1).length / myWonProspects.length) * 100}%`
                    : '0%'
                }}
              />
            </div>
            <p className="text-xs text-stone-500 dark:text-neutral-400 mt-2 text-right">
              Total : <span className="font-bold text-blue-600">
                {formatCurrency(myWonProspects.filter(p => p.installments && p.installments > 1).reduce((s, p) => s + (p.value || 0), 0))}
              </span>
            </p>
          </div>
        </div>
      </div>
      )}

      {/* Historique des factures */}
      <div className="bg-white dark:bg-white/5 rounded-xl shadow-[0_20px_40px_rgba(27,28,27,0.04)] border border-stone-100/50 dark:border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50/50 dark:bg-white/5">
                <th className="px-8 py-5 text-[11px] font-black text-stone-500 dark:text-neutral-400 uppercase tracking-widest" style={{ fontFamily: 'Manrope, sans-serif' }}>N° Facture</th>
                <th className="px-8 py-5 text-[11px] font-black text-stone-500 dark:text-neutral-400 uppercase tracking-widest" style={{ fontFamily: 'Manrope, sans-serif' }}>Date</th>
                <th className="px-8 py-5 text-[11px] font-black text-stone-500 dark:text-neutral-400 uppercase tracking-widest" style={{ fontFamily: 'Manrope, sans-serif' }}>Client & Offre</th>
                <th className="px-8 py-5 text-[11px] font-black text-stone-500 dark:text-neutral-400 uppercase tracking-widest" style={{ fontFamily: 'Manrope, sans-serif' }}>Montant TTC</th>
                <th className="px-8 py-5 text-[11px] font-black text-stone-500 dark:text-neutral-400 uppercase tracking-widest" style={{ fontFamily: 'Manrope, sans-serif' }}>Échéance</th>
                <th className="px-8 py-5 text-[11px] font-black text-stone-500 dark:text-neutral-400 uppercase tracking-widest text-center" style={{ fontFamily: 'Manrope, sans-serif' }}>Statut</th>
                <th className="px-8 py-5 text-[11px] font-black text-stone-500 dark:text-neutral-400 uppercase tracking-widest text-right" style={{ fontFamily: 'Manrope, sans-serif' }}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100/50 dark:divide-white/10">
              {filteredInvoices.map((inv) => {
                const config = getStatusConfig(inv.status)
                const isOverdue = inv.due_date && new Date(inv.due_date) < new Date() && inv.status !== 'payé'
                return (
                  <tr key={inv.id} className="hover:bg-stone-50/50 dark:hover:bg-white/5 transition-colors group">
                    <td className="px-8 py-6 font-mono text-xs font-bold text-stone-700 dark:text-neutral-200">{inv.invoice_number}</td>
                    <td className="px-8 py-6 text-sm text-stone-700 dark:text-neutral-200 font-medium">
                      {new Date(inv.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>{inv.client_name}</span>
                        {inv.offer_name && <span className="text-[10px] text-stone-500 dark:text-neutral-400 font-medium">{inv.offer_name}</span>}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-sm font-extrabold text-stone-900 dark:text-white">{formatCurrency(inv.amount_ttc || 0)}</td>
                    <td className="px-8 py-6">
                      {inv.due_date ? (
                        <span className={cn("text-xs font-semibold", isOverdue ? "text-red-500" : "text-stone-500 dark:text-neutral-400")}>
                          {new Date(inv.due_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                          {isOverdue && <span className="ml-1 text-[9px] uppercase font-black text-red-500">Retard</span>}
                        </span>
                      ) : (
                        <span className="text-xs text-stone-400 dark:text-neutral-600">—</span>
                      )}
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex justify-center">
                        <select
                          value={inv.status || ''}
                          onChange={e => handleStatusChange(inv.id, e.target.value)}
                          className={cn(
                            'rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-widest border cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-stone-900/10',
                            config.bg, config.text, config.border
                          )}
                        >
                          {STATUS_OPTIONS.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                          {!STATUS_OPTIONS.find(s => s.value === inv.status) && inv.status && (
                            <option value={inv.status}>{getStatusConfig(inv.status).label}</option>
                          )}
                        </select>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-2">
                        {inv.stripe_payment_link && (
                          <button
                            onClick={() => copyStripeLink(inv.stripe_payment_link)}
                            className="bg-stone-900 text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-stone-800 transition-all inline-flex items-center gap-1.5"
                            title="Copier le lien de paiement"
                          >
                            <Copy className="h-3 w-3" />
                            Lien
                          </button>
                        )}
                        {inv.stripe_payment_link && (
                          <a
                            href={inv.stripe_payment_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-[#635BFF] text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-[#5349E0] transition-all inline-flex items-center gap-1.5"
                          >
                            Payer
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {inv.pdf_url && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <a
                              href={inv.pdf_url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-white/10 text-stone-400 hover:text-stone-700 dark:hover:text-white transition-colors"
                              title="Voir"
                            >
                              <Eye className="h-4 w-4" />
                            </a>
                            <a
                              href={inv.pdf_url}
                              download
                              className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-white/10 text-stone-400 hover:text-emerald-600 transition-colors"
                              title="Télécharger"
                            >
                              <Download className="h-4 w-4" />
                            </a>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 bg-stone-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                        <FileText className="h-8 w-8 text-stone-300 dark:text-neutral-600" />
                      </div>
                      <p className="text-sm font-bold text-stone-900 dark:text-white mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>Aucune facture</p>
                      <p className="text-xs text-stone-500 dark:text-neutral-400">Aucune facture sur cette période</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <BusinessIssuerProfilesModal isOpen={isIssuerModalOpen} onClose={() => setIsIssuerModalOpen(false)} />
      <BusinessPaymentMethodsModal isOpen={isPaymentMethodsOpen} onClose={() => setIsPaymentMethodsOpen(false)} />
      <BusinessStripeConnectModal isOpen={isStripeConnectOpen} onClose={() => setIsStripeConnectOpen(false)} />

      <BusinessInvoiceGeneratorModal
        isOpen={isGenModalOpen}
        onClose={() => { setIsGenModalOpen(false); fetchInvoices() }}
        deals={myWonProspects}
        commission={isFixedComp ? fixedSalary : commissionEstimee}
        commissionRate={isFixedComp ? 0 : commissionRateNum}
        startDate={startDate}
        endDate={endDate}
        isFixedCompensation={isFixedComp}
        fixedSalary={(isFixedComp || isFixedPlusComm) ? fixedSalary : 0}
      />
    </div>
  )
}
