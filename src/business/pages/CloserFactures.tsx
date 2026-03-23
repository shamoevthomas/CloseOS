import { useState, useMemo, useEffect, useCallback } from 'react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessProspects } from '../contexts/BusinessProspectsContext'
import { supabase } from '../../lib/supabase'
import {
  TrendingUp, DollarSign, FileText, CreditCard, Clock,
  Info, Eye, Download, Loader2, Plus, X, ExternalLink,
  Building2, User, Save, AlertTriangle, Link2, Copy, Wallet,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import toast from 'react-hot-toast'
import { BusinessIssuerProfilesModal } from '../components/BusinessIssuerProfilesModal'
import { BusinessPaymentMethodsModal } from '../components/BusinessPaymentMethodsModal'
import { BusinessStripeConnectModal } from '../components/BusinessStripeConnectModal'

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
const DEFAULT_PENALTY_RATE = 15 // 15% annuel (taux usuel)
const DEFAULT_PENALTY_FIXED = 40 // 40€ indemnité forfaitaire

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
  const [genStep, setGenStep] = useState<1 | 2>(1) // 1=form, 2=preview

  // Invoice fields
  const [genClientName, setGenClientName] = useState('')
  const [genClientEmail, setGenClientEmail] = useState('')
  const [genOfferName, setGenOfferName] = useState('')
  const [genAmountHT, setGenAmountHT] = useState('')
  const [genTva, setGenTva] = useState(true)
  const [genNotes, setGenNotes] = useState('')
  const [genSaving, setGenSaving] = useState(false)
  const [genDueDate, setGenDueDate] = useState('')
  const [genStripeLink, setGenStripeLink] = useState('')
  const [genPaymentMethod, setGenPaymentMethod] = useState('virement')

  // Late penalty fields
  const [genPenaltyRate, setGenPenaltyRate] = useState(String(DEFAULT_PENALTY_RATE))
  const [genPenaltyFixed, setGenPenaltyFixed] = useState(String(DEFAULT_PENALTY_FIXED))

  // Issuer profile modal
  const [isIssuerModalOpen, setIsIssuerModalOpen] = useState(false)
  const [isPaymentMethodsOpen, setIsPaymentMethodsOpen] = useState(false)
  const [isStripeConnectOpen, setIsStripeConnectOpen] = useState(false)
  const [issuerCompanyName, setIssuerCompanyName] = useState('')
  const [issuerAddress, setIssuerAddress] = useState('')
  const [issuerCity, setIssuerCity] = useState('')
  const [issuerZip, setIssuerZip] = useState('')
  const [issuerCountry, setIssuerCountry] = useState('France')
  const [issuerSiret, setIssuerSiret] = useState('')
  const [issuerTvaNumber, setIssuerTvaNumber] = useState('')
  const [issuerSaving, setIssuerSaving] = useState(false)

  // Formulas for dropdown
  const [formulas, setFormulas] = useState<{ id: string; name: string; price: number }[]>([])

  // Load issuer profile from team member
  useEffect(() => {
    if (teamMember) {
      setIssuerCompanyName(teamMember.issuer_company_name || '')
      setIssuerAddress(teamMember.issuer_address || '')
      setIssuerCity(teamMember.issuer_city || '')
      setIssuerZip(teamMember.issuer_zip || '')
      setIssuerCountry(teamMember.issuer_country || 'France')
      setIssuerSiret(teamMember.issuer_siret || '')
      setIssuerTvaNumber(teamMember.issuer_tva_number || '')
    }
  }, [teamMember])

  // Set default due date to 30 days from now
  useEffect(() => {
    if (isGenModalOpen && !genDueDate) {
      const d = new Date()
      d.setDate(d.getDate() + 30)
      setGenDueDate(d.toISOString().split('T')[0])
    }
  }, [isGenModalOpen])

  // Auto-fill receiver from Organization settings
  const receiverInfo = useMemo(() => ({
    name: businessSettings?.company_name || '',
    company: businessSettings?.raison_sociale || businessSettings?.company_name || '',
    address: [
      businessSettings?.billing_address,
      [businessSettings?.billing_zip, businessSettings?.billing_city].filter(Boolean).join(' '),
      businessSettings?.billing_country,
    ].filter(Boolean).join(', '),
    siret: businessSettings?.siret || '',
    tva: businessSettings?.tva_number || '',
  }), [businessSettings])

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

  // Fetch formulas
  useEffect(() => {
    if (!effectiveUserId) return
    fetch(`/api/business?action=formulas-list&user_id=${effectiveUserId}`)
      .then(r => r.json())
      .then(data => { if (data.formulas) setFormulas(data.formulas) })
      .catch(() => {})
  }, [effectiveUserId])

  // Won prospects assigned to me
  const myWonProspects = useMemo(
    () => prospects.filter(p => p.stage === 'won' && p.assigned_to === teamMember?.id),
    [prospects, teamMember?.id]
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

  // KPIs
  const totalRevenue = useMemo(() =>
    myWonProspects.reduce((sum, p) => sum + (p.value || 0), 0),
    [myWonProspects]
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

  const commissionEstimee = useMemo(() => {
    const rate = teamMember?.commission_rate ? Number(teamMember.commission_rate) / 100 : 0.1
    return totalRevenue * rate
  }, [totalRevenue, teamMember?.commission_rate])

  // Update status
  const handleStatusChange = useCallback(async (invoiceId: string, newStatus: string) => {
    const { error } = await supabase.from('invoices').update({ status: newStatus }).eq('id', invoiceId)
    if (error) { toast.error('Erreur'); return }
    setSavedInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, status: newStatus } : inv))
    toast.success('Statut mis à jour')
  }, [])

  // Generate invoice number
  const generateInvoiceNumber = () => {
    const date = new Date()
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const rand = Math.floor(Math.random() * 9000) + 1000
    return `FAC-${y}${m}-${rand}`
  }

  // Save issuer profile
  const handleSaveIssuerProfile = async () => {
    if (!teamMember?.id) return
    setIssuerSaving(true)
    const { error } = await supabase
      .from('business_team_members')
      .update({
        issuer_company_name: issuerCompanyName,
        issuer_address: issuerAddress,
        issuer_city: issuerCity,
        issuer_zip: issuerZip,
        issuer_country: issuerCountry,
        issuer_siret: issuerSiret,
        issuer_tva_number: issuerTvaNumber,
      })
      .eq('id', teamMember.id)

    if (error) {
      toast.error('Erreur lors de la sauvegarde')
      console.error(error)
    } else {
      toast.success('Profil émetteur sauvegardé')
      setIsIssuerModalOpen(false)
    }
    setIssuerSaving(false)
  }

  // Handle generate invoice
  const handleGenerate = async () => {
    if (!genClientName.trim()) { toast.error('Nom du client requis'); return }
    if (!genAmountHT || Number(genAmountHT) <= 0) { toast.error('Montant requis'); return }

    setGenSaving(true)
    const amountHT = Number(genAmountHT)
    const tvaRate = genTva ? 0.2 : 0
    const amountTTC = amountHT * (1 + tvaRate)

    const invoiceData: Record<string, any> = {
      user_id: effectiveUserId,
      team_member_id: teamMember?.id || null,
      invoice_number: generateInvoiceNumber(),
      client_name: genClientName,
      client_email: genClientEmail || null,
      offer_name: genOfferName || null,
      amount_ht: amountHT,
      amount_ttc: amountTTC,
      tva_rate: tvaRate * 100,
      status: 'à payer',
      notes: genNotes || null,
      due_date: genDueDate || null,
      stripe_payment_link: genStripeLink || null,
      payment_method: genPaymentMethod,
      late_penalty_rate: Number(genPenaltyRate) || DEFAULT_PENALTY_RATE,
      late_penalty_fixed: Number(genPenaltyFixed) || DEFAULT_PENALTY_FIXED,
      // Issuer info
      issuer_name: teamMember ? `${teamMember.first_name} ${teamMember.last_name}` : '',
      issuer_company: issuerCompanyName || null,
      issuer_address: [issuerAddress, [issuerZip, issuerCity].filter(Boolean).join(' '), issuerCountry].filter(Boolean).join(', ') || null,
      issuer_siret: issuerSiret || null,
      issuer_email: teamMember?.email || null,
      issuer_phone: teamMember?.phone || null,
      // Receiver info from Organization
      receiver_name: receiverInfo.name || null,
      receiver_company: receiverInfo.company || null,
      receiver_address: receiverInfo.address || null,
      receiver_siret: receiverInfo.siret || null,
      receiver_tva: receiverInfo.tva || null,
    }

    const { error } = await supabase.from('invoices').insert(invoiceData)
    if (error) {
      toast.error('Erreur lors de la création')
      console.error(error)
    } else {
      toast.success('Facture générée')
      setIsGenModalOpen(false)
      resetGenForm()
      fetchInvoices()
    }
    setGenSaving(false)
  }

  const resetGenForm = () => {
    setGenStep(1)
    setGenClientName('')
    setGenClientEmail('')
    setGenOfferName('')
    setGenAmountHT('')
    setGenTva(true)
    setGenNotes('')
    setGenStripeLink('')
    setGenPaymentMethod('virement')
    setGenPenaltyRate(String(DEFAULT_PENALTY_RATE))
    setGenPenaltyFixed(String(DEFAULT_PENALTY_FIXED))
    const d = new Date()
    d.setDate(d.getDate() + 30)
    setGenDueDate(d.toISOString().split('T')[0])
  }

  const copyStripeLink = (link: string) => {
    navigator.clipboard.writeText(link)
    toast.success('Lien copié')
  }

  const inputCls = "w-full rounded-lg border border-stone-200 dark:border-neutral-800 bg-stone-50/50 dark:bg-white/5 px-4 py-2.5 text-sm text-stone-900 dark:text-white focus:border-stone-900 dark:focus:border-neutral-500 focus:ring-1 focus:ring-stone-900 dark:focus:ring-neutral-500 outline-none transition-all"
  const labelCls = "block text-xs font-bold uppercase tracking-widest text-stone-500 dark:text-neutral-400 mb-1.5"

  // Check if issuer profile is filled
  const hasIssuerProfile = !!(issuerCompanyName && issuerSiret)

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
            Factures & Commissions
          </h1>
          <p className="text-stone-500 dark:text-neutral-400 mt-2">Suivez vos commissions et gérez vos factures</p>
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
            className={cn(
              "flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors border",
              hasIssuerProfile
                ? "border-stone-200 dark:border-neutral-700 text-stone-700 dark:text-neutral-200 hover:bg-stone-50 dark:hover:bg-neutral-800"
                : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20"
            )}
          >
            <Building2 className="h-4 w-4" />
            {hasIssuerProfile ? 'Infos Émetteur' : 'Configurer Émetteur'}
          </button>
          <button
            onClick={() => setIsPaymentMethodsOpen(true)}
            className="flex items-center gap-2 rounded-full border border-stone-200 dark:border-neutral-700 px-5 py-2.5 text-sm font-semibold text-stone-700 dark:text-neutral-200 hover:bg-stone-50 dark:hover:bg-neutral-800 transition-colors"
          >
            <Wallet className="h-4 w-4" />
            Moyens de Paiement
          </button>
          <button
            onClick={() => {
              if (!hasIssuerProfile) {
                toast.error("Veuillez d'abord configurer votre profil émetteur")
                setIsIssuerModalOpen(true)
                return
              }
              setIsGenModalOpen(true)
            }}
            className="flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-stone-800 transition-colors"
          >
            <Plus className="h-4 w-4" /> Générer une facture
          </button>
        </div>
      </div>

      {/* Issuer profile warning */}
      {!hasIssuerProfile && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/5 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Profil émetteur incomplet</p>
            <p className="text-xs text-amber-600/70 dark:text-amber-400/60 mt-0.5">Configurez vos informations d'émetteur (société, SIRET, adresse) pour pouvoir générer des factures conformes.</p>
          </div>
          <button
            onClick={() => setIsIssuerModalOpen(true)}
            className="rounded-full bg-amber-500 px-4 py-1.5 text-xs font-bold text-white hover:bg-amber-600 transition-colors flex-shrink-0"
          >
            Configurer
          </button>
        </div>
      )}

      {/* Filter Bar — Glass pill */}
      <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-full p-3 px-6 flex flex-wrap items-center gap-6 shadow-[0_20px_40px_rgba(27,28,27,0.04)] border border-white/40 dark:border-white/10">
        <div className="flex items-center gap-3 border-r border-stone-200/40 dark:border-white/10 pr-6">
          <span className="text-xs font-bold text-stone-500 dark:text-neutral-400 uppercase tracking-widest">Période</span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent border-none text-sm font-semibold focus:ring-0 p-0 w-28 text-stone-900 dark:text-white"
            />
            <span className="text-stone-400">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent border-none text-sm font-semibold focus:ring-0 p-0 w-28 text-stone-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-6 grid-cols-2 lg:grid-cols-4">
        {/* CA Généré */}
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

        {/* Ma Commission */}
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

      {/* Détails comptant / échelonné */}
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

      {/* ═══════════════════════════════════════════════════════ */}
      {/*  GENERATE INVOICE MODAL                                */}
      {/* ═══════════════════════════════════════════════════════ */}
      {isGenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-xl border border-white/40 dark:border-white/10 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl shadow-[0_20px_40px_rgba(27,28,27,0.12)] relative animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 pb-0">
              <div>
                <h2 className="text-xl font-extrabold text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Générer une facture</h2>
                <p className="text-xs text-stone-500 dark:text-neutral-400 mt-0.5">La facture sera visible par votre organisation.</p>
              </div>
              <button
                onClick={() => { setIsGenModalOpen(false); resetGenForm() }}
                className="p-1.5 rounded-full text-stone-400 dark:text-neutral-500 hover:text-stone-700 dark:hover:text-neutral-200 hover:bg-stone-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 pt-4">
              {/* Step indicator */}
              <div className="flex items-center gap-3 mb-6">
                <div className={cn("flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold", genStep === 1 ? "bg-stone-900 text-white" : "bg-stone-100 dark:bg-white/10 text-stone-500 dark:text-neutral-400")}>
                  1. Informations
                </div>
                <div className="h-px flex-1 bg-stone-200 dark:bg-white/10" />
                <div className={cn("flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold", genStep === 2 ? "bg-stone-900 text-white" : "bg-stone-100 dark:bg-white/10 text-stone-500 dark:text-neutral-400")}>
                  2. Récapitulatif
                </div>
              </div>

              {genStep === 1 && (
                <div className="space-y-5">
                  {/* Émetteur summary */}
                  <div className="rounded-xl border border-stone-200/60 dark:border-white/10 bg-stone-50/50 dark:bg-white/5 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-stone-500 dark:text-neutral-400 flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5" /> Émetteur
                      </h3>
                      <button onClick={() => { setIsGenModalOpen(false); setIsIssuerModalOpen(true) }} className="text-[10px] font-bold text-stone-500 hover:text-stone-900 dark:text-neutral-400 dark:hover:text-white uppercase tracking-widest">
                        Modifier
                      </button>
                    </div>
                    <p className="text-sm font-semibold text-stone-900 dark:text-white">{issuerCompanyName || '—'}</p>
                    <p className="text-xs text-stone-500 dark:text-neutral-400">
                      {[issuerAddress, [issuerZip, issuerCity].filter(Boolean).join(' ')].filter(Boolean).join(', ') || 'Adresse non renseignée'}
                    </p>
                    {issuerSiret && <p className="text-xs text-stone-400 dark:text-neutral-500 mt-0.5">SIRET: {issuerSiret}</p>}
                  </div>

                  {/* Destinataire (receiver from Organization) */}
                  <div className="rounded-xl border border-stone-200/60 dark:border-white/10 bg-stone-50/50 dark:bg-white/5 p-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-stone-500 dark:text-neutral-400 flex items-center gap-1.5 mb-2">
                      <User className="h-3.5 w-3.5" /> Destinataire (Organisation)
                    </h3>
                    {receiverInfo.company ? (
                      <>
                        <p className="text-sm font-semibold text-stone-900 dark:text-white">{receiverInfo.company}</p>
                        <p className="text-xs text-stone-500 dark:text-neutral-400">{receiverInfo.address || 'Adresse non renseignée'}</p>
                        {receiverInfo.siret && <p className="text-xs text-stone-400 dark:text-neutral-500 mt-0.5">SIRET: {receiverInfo.siret}</p>}
                        {receiverInfo.tva && <p className="text-xs text-stone-400 dark:text-neutral-500">TVA: {receiverInfo.tva}</p>}
                      </>
                    ) : (
                      <p className="text-xs text-stone-400 dark:text-neutral-500 italic">Aucune info d'organisation configurée</p>
                    )}
                  </div>

                  {/* Client info */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Nom du client *</label>
                      <input type="text" value={genClientName} onChange={e => setGenClientName(e.target.value)} className={inputCls} placeholder="Jean Dupont" />
                    </div>
                    <div>
                      <label className={labelCls}>Email du client</label>
                      <input type="email" value={genClientEmail} onChange={e => setGenClientEmail(e.target.value)} className={inputCls} placeholder="jean@example.com" />
                    </div>
                  </div>

                  {/* Offer */}
                  <div>
                    <label className={labelCls}>Offre / Formule</label>
                    {formulas.length > 0 ? (
                      <select
                        value={genOfferName}
                        onChange={(e) => {
                          setGenOfferName(e.target.value)
                          const f = formulas.find(fo => fo.name === e.target.value)
                          if (f && !genAmountHT) setGenAmountHT(String(f.price))
                        }}
                        className={inputCls}
                      >
                        <option value="">Sélectionner une offre</option>
                        {formulas.map(f => (
                          <option key={f.id} value={f.name}>{f.name} — {f.price}€</option>
                        ))}
                      </select>
                    ) : (
                      <input type="text" value={genOfferName} onChange={e => setGenOfferName(e.target.value)} className={inputCls} placeholder="Coaching 3 mois" />
                    )}
                  </div>

                  {/* Amount + Due date */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Montant HT *</label>
                      <div className="relative">
                        <input type="number" value={genAmountHT} onChange={e => setGenAmountHT(e.target.value)} className={`${inputCls} pr-10`} placeholder="1000" min="0" step="0.01" />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-stone-400 dark:text-neutral-500">€</span>
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Date d'échéance</label>
                      <input type="date" value={genDueDate} onChange={e => setGenDueDate(e.target.value)} className={inputCls} />
                    </div>
                  </div>

                  {/* TVA toggle */}
                  <div className="flex items-center justify-between rounded-xl border border-stone-200 dark:border-white/10 bg-stone-50/50 dark:bg-white/5 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-stone-700 dark:text-neutral-200">TVA (20%)</p>
                      <p className="text-xs text-stone-500 dark:text-neutral-400">
                        {genAmountHT && Number(genAmountHT) > 0
                          ? `TTC : ${formatCurrency(genTva ? Number(genAmountHT) * 1.2 : Number(genAmountHT))}`
                          : 'Appliquer la TVA au montant'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setGenTva(!genTva)}
                      className={cn(
                        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                        genTva ? 'bg-stone-900' : 'bg-stone-300'
                      )}
                    >
                      <span className={cn(
                        'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                        genTva ? 'translate-x-6' : 'translate-x-1'
                      )} />
                    </button>
                  </div>

                  {/* Payment method + Stripe link */}
                  <div className="space-y-3">
                    <label className={labelCls}>Moyen de paiement</label>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { value: 'virement', label: 'Virement' },
                        { value: 'stripe', label: 'Stripe' },
                        { value: 'paypal', label: 'PayPal' },
                        { value: 'autre', label: 'Autre' },
                      ].map(m => (
                        <button
                          key={m.value}
                          onClick={() => setGenPaymentMethod(m.value)}
                          className={cn(
                            "px-4 py-2 rounded-full text-xs font-bold border transition-all",
                            genPaymentMethod === m.value
                              ? "bg-stone-900 text-white border-stone-900"
                              : "bg-stone-50 dark:bg-white/5 text-stone-600 dark:text-neutral-300 border-stone-200 dark:border-white/10 hover:bg-stone-100 dark:hover:bg-white/10"
                          )}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>

                    {genPaymentMethod === 'stripe' && (
                      <div>
                        <label className={labelCls}>Lien de paiement Stripe</label>
                        <div className="relative">
                          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                          <input
                            type="url"
                            value={genStripeLink}
                            onChange={e => setGenStripeLink(e.target.value)}
                            className={`${inputCls} pl-10`}
                            placeholder="https://buy.stripe.com/..."
                          />
                        </div>
                        <p className="text-[10px] text-stone-400 dark:text-neutral-500 mt-1">Créez un lien de paiement dans votre dashboard Stripe et collez-le ici.</p>
                      </div>
                    )}
                  </div>

                  {/* Late payment penalties */}
                  <div className="rounded-xl border border-stone-200/60 dark:border-white/10 bg-stone-50/50 dark:bg-white/5 p-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-stone-500 dark:text-neutral-400 flex items-center gap-1.5 mb-3">
                      <AlertTriangle className="h-3.5 w-3.5" /> Pénalités de retard
                    </h3>
                    <p className="text-[10px] text-stone-400 dark:text-neutral-500 mb-3">
                      Mentions obligatoires (Art. L441-10 Code de commerce). Taux de pénalité annuel appliqué en cas de retard de paiement + indemnité forfaitaire de recouvrement.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Taux annuel (%)</label>
                        <div className="relative">
                          <input type="number" value={genPenaltyRate} onChange={e => setGenPenaltyRate(e.target.value)} className={`${inputCls} pr-8`} min="0" step="0.01" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">%</span>
                        </div>
                      </div>
                      <div>
                        <label className={labelCls}>Indemnité forfaitaire (€)</label>
                        <div className="relative">
                          <input type="number" value={genPenaltyFixed} onChange={e => setGenPenaltyFixed(e.target.value)} className={`${inputCls} pr-8`} min="0" step="1" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">€</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className={labelCls}>Notes</label>
                    <textarea value={genNotes} onChange={e => setGenNotes(e.target.value)} className={`${inputCls} resize-none`} rows={2} placeholder="Notes optionnelles..." />
                  </div>

                  <div className="flex gap-3 mt-2">
                    <button
                      onClick={() => { setIsGenModalOpen(false); resetGenForm() }}
                      className="flex-1 rounded-full border border-stone-300 dark:border-neutral-600 py-2.5 font-semibold text-stone-700 dark:text-neutral-200 hover:bg-stone-50 dark:hover:bg-neutral-800 transition-all"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={() => {
                        if (!genClientName.trim()) { toast.error('Nom du client requis'); return }
                        if (!genAmountHT || Number(genAmountHT) <= 0) { toast.error('Montant requis'); return }
                        setGenStep(2)
                      }}
                      className="flex-1 rounded-full bg-stone-900 py-2.5 font-bold text-white hover:bg-stone-800 transition-all"
                    >
                      Aperçu →
                    </button>
                  </div>
                </div>
              )}

              {genStep === 2 && (
                <div className="space-y-5">
                  {/* Invoice preview card */}
                  <div className="rounded-xl border border-stone-200 dark:border-white/10 bg-white dark:bg-neutral-800 p-6 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Émetteur</p>
                        <p className="text-sm font-bold text-stone-900 dark:text-white mt-1">{issuerCompanyName}</p>
                        <p className="text-xs text-stone-500 dark:text-neutral-400">{teamMember ? `${teamMember.first_name} ${teamMember.last_name}` : ''}</p>
                        <p className="text-xs text-stone-500 dark:text-neutral-400">{[issuerAddress, [issuerZip, issuerCity].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</p>
                        {issuerSiret && <p className="text-xs text-stone-400 dark:text-neutral-500">SIRET: {issuerSiret}</p>}
                        {issuerTvaNumber && <p className="text-xs text-stone-400 dark:text-neutral-500">TVA: {issuerTvaNumber}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Destinataire</p>
                        <p className="text-sm font-bold text-stone-900 dark:text-white mt-1">{receiverInfo.company || '—'}</p>
                        <p className="text-xs text-stone-500 dark:text-neutral-400">{receiverInfo.address}</p>
                        {receiverInfo.siret && <p className="text-xs text-stone-400 dark:text-neutral-500">SIRET: {receiverInfo.siret}</p>}
                        {receiverInfo.tva && <p className="text-xs text-stone-400 dark:text-neutral-500">TVA: {receiverInfo.tva}</p>}
                      </div>
                    </div>

                    <div className="border-t border-stone-100 dark:border-white/10 pt-4">
                      <div className="flex justify-between items-center mb-3">
                        <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Facture pour</p>
                        <p className="text-xs text-stone-500 dark:text-neutral-400">
                          Échéance: {genDueDate ? new Date(genDueDate).toLocaleDateString('fr-FR') : '—'}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-stone-900 dark:text-white">{genClientName}</p>
                      {genClientEmail && <p className="text-xs text-stone-500 dark:text-neutral-400">{genClientEmail}</p>}
                    </div>

                    <div className="border-t border-stone-100 dark:border-white/10 pt-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-600 dark:text-neutral-300">{genOfferName || 'Prestation'}</span>
                        <span className="font-bold text-stone-900 dark:text-white">{formatCurrency(Number(genAmountHT))}</span>
                      </div>
                      {genTva && (
                        <div className="flex justify-between text-xs text-stone-500 dark:text-neutral-400">
                          <span>TVA (20%)</span>
                          <span>{formatCurrency(Number(genAmountHT) * 0.2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-extrabold border-t border-stone-100 dark:border-white/10 pt-2 mt-2">
                        <span className="text-stone-900 dark:text-white">Total TTC</span>
                        <span className="text-stone-900 dark:text-white">{formatCurrency(genTva ? Number(genAmountHT) * 1.2 : Number(genAmountHT))}</span>
                      </div>
                    </div>

                    {/* Payment method */}
                    <div className="border-t border-stone-100 dark:border-white/10 pt-3">
                      <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Paiement</p>
                      <p className="text-xs text-stone-600 dark:text-neutral-300 capitalize">{genPaymentMethod}</p>
                      {genStripeLink && (
                        <p className="text-xs text-blue-500 truncate mt-0.5">{genStripeLink}</p>
                      )}
                    </div>

                    {/* Late penalties mention */}
                    <div className="border-t border-stone-100 dark:border-white/10 pt-3">
                      <p className="text-[10px] text-stone-400 dark:text-neutral-500 leading-relaxed">
                        En cas de retard de paiement, des pénalités au taux annuel de {genPenaltyRate}% seront appliquées,
                        ainsi qu'une indemnité forfaitaire pour frais de recouvrement de {formatCurrency(Number(genPenaltyFixed))} (Art. L441-10 et D441-5 du Code de commerce).
                      </p>
                    </div>

                    {genNotes && (
                      <div className="border-t border-stone-100 dark:border-white/10 pt-3">
                        <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Notes</p>
                        <p className="text-xs text-stone-500 dark:text-neutral-400">{genNotes}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setGenStep(1)}
                      className="flex-1 rounded-full border border-stone-300 dark:border-neutral-600 py-2.5 font-semibold text-stone-700 dark:text-neutral-200 hover:bg-stone-50 dark:hover:bg-neutral-800 transition-all"
                    >
                      ← Retour
                    </button>
                    <button
                      onClick={handleGenerate}
                      disabled={genSaving}
                      className="flex-1 rounded-full bg-stone-900 py-2.5 font-bold text-white hover:bg-stone-800 transition-all disabled:opacity-50"
                    >
                      {genSaving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Générer la facture'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
