import { useState, useMemo, useEffect, useCallback } from 'react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessProspects } from '../contexts/BusinessProspectsContext'
import { supabase } from '../../lib/supabase'
import {
  TrendingUp, DollarSign, Calendar, FileText, CreditCard, Clock,
  Info, Eye, Download, Loader2, Receipt, Plus, X, ExternalLink, ChevronDown,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import toast from 'react-hot-toast'

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

export function CloserFactures() {
  const { user, teamMember, ownerUserId, isTeamMember } = useBusinessAuth()
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
  const [genClientName, setGenClientName] = useState('')
  const [genOfferName, setGenOfferName] = useState('')
  const [genAmountHT, setGenAmountHT] = useState('')
  const [genTva, setGenTva] = useState(true)
  const [genNotes, setGenNotes] = useState('')
  const [genSaving, setGenSaving] = useState(false)

  // Formulas for dropdown
  const [formulas, setFormulas] = useState<{ id: string; name: string; price: number }[]>([])

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
      // Team members only see their own invoices
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

  const commissionEstimee = useMemo(() => totalRevenue * 0.1, [totalRevenue])

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

  // Handle generate invoice
  const handleGenerate = async () => {
    if (!genClientName.trim()) { toast.error('Nom du client requis'); return }
    if (!genAmountHT || Number(genAmountHT) <= 0) { toast.error('Montant requis'); return }

    setGenSaving(true)
    const amountHT = Number(genAmountHT)
    const amountTTC = genTva ? amountHT * 1.2 : amountHT

    const invoiceData = {
      user_id: effectiveUserId,
      team_member_id: teamMember?.id || null,
      invoice_number: generateInvoiceNumber(),
      client_name: genClientName,
      offer_name: genOfferName || null,
      amount_ht: amountHT,
      amount_ttc: amountTTC,
      status: 'à payer',
      notes: genNotes || null,
    }

    const { error } = await supabase.from('invoices').insert(invoiceData)
    if (error) {
      toast.error('Erreur lors de la création')
      console.error(error)
    } else {
      toast.success('Facture générée')
      setIsGenModalOpen(false)
      setGenClientName(''); setGenOfferName(''); setGenAmountHT(''); setGenTva(true); setGenNotes('')
      fetchInvoices()
    }
    setGenSaving(false)
  }

  const inputCls = "w-full rounded-lg border border-stone-200 bg-stone-50/50 px-4 py-2.5 text-sm text-stone-900 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-all"

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-stone-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Factures & Commissions
          </h1>
          <p className="text-stone-500 mt-2">Suivez vos commissions et gérez vos factures</p>
        </div>
        <button
          onClick={() => setIsGenModalOpen(true)}
          className="flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-stone-800 transition-colors"
        >
          <Plus className="h-4 w-4" /> Générer une facture
        </button>
      </div>

      {/* Filter Bar — Glass pill */}
      <div className="bg-white/70 backdrop-blur-xl rounded-full p-3 px-6 flex flex-wrap items-center gap-6 shadow-[0_20px_40px_rgba(27,28,27,0.04)] border border-white/40">
        <div className="flex items-center gap-3 border-r border-stone-200/40 pr-6">
          <span className="text-xs font-bold text-stone-500 uppercase tracking-widest">Période</span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent border-none text-sm font-semibold focus:ring-0 p-0 w-28 text-stone-900"
            />
            <span className="text-stone-400">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent border-none text-sm font-semibold focus:ring-0 p-0 w-28 text-stone-900"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-6 grid-cols-2 lg:grid-cols-4">
        {/* CA Généré */}
        <div className="bg-white rounded-xl p-6 shadow-[0_20px_40px_rgba(27,28,27,0.04)] border border-stone-100/50 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-12 -mt-12 blur-3xl" />
          <div className="flex justify-between items-start mb-4">
            <span className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp className="h-5 w-5" />
            </span>
            <span className="text-[10px] font-bold text-stone-400 tracking-widest uppercase">{myWonProspects.length} deal{myWonProspects.length !== 1 ? 's' : ''}</span>
          </div>
          <p className="text-stone-500 text-sm font-medium">CA Généré</p>
          <p className="text-2xl font-extrabold mt-1 text-stone-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {totalRevenue.toLocaleString('fr-FR')} <span className="text-base">€</span>
          </p>
        </div>

        {/* Ma Commission */}
        <div className="bg-white rounded-xl p-6 shadow-[0_20px_40px_rgba(27,28,27,0.04)] border border-stone-100/50 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-stone-500/5 rounded-full -mr-12 -mt-12 blur-3xl" />
          <div className="flex justify-between items-start mb-4">
            <span className="p-3 rounded-xl bg-stone-100 text-stone-600">
              <DollarSign className="h-5 w-5" />
            </span>
            <span className="text-[10px] font-bold text-stone-400 tracking-widest uppercase">10% CA</span>
          </div>
          <p className="text-stone-500 text-sm font-medium">Ma Commission</p>
          <p className="text-2xl font-extrabold mt-1 text-stone-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {commissionEstimee.toLocaleString('fr-FR')} <span className="text-base">€</span>
          </p>
        </div>

        {/* Payé */}
        <div className="bg-white rounded-xl p-6 shadow-[0_20px_40px_rgba(27,28,27,0.04)] border border-stone-100/50 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-12 -mt-12 blur-3xl" />
          <div className="flex justify-between items-start mb-4">
            <span className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
              <CreditCard className="h-5 w-5" />
            </span>
          </div>
          <p className="text-stone-500 text-sm font-medium">Payé</p>
          <p className="text-2xl font-extrabold mt-1 text-emerald-600" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {paidAmount.toLocaleString('fr-FR')} <span className="text-base">€</span>
          </p>
        </div>

        {/* En attente */}
        <div className="bg-white rounded-xl p-6 shadow-[0_20px_40px_rgba(27,28,27,0.04)] border border-stone-100/50 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full -mr-12 -mt-12 blur-3xl" />
          <div className="flex justify-between items-start mb-4">
            <span className="p-3 rounded-xl bg-red-50 text-red-500">
              <Clock className="h-5 w-5" />
            </span>
            <span className="text-[10px] font-bold text-stone-400 tracking-widest uppercase">{pendingInvoices.length} facture{pendingInvoices.length !== 1 ? 's' : ''}</span>
          </div>
          <p className="text-stone-500 text-sm font-medium">En attente</p>
          <p className="text-2xl font-extrabold mt-1 text-stone-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {pendingAmount.toLocaleString('fr-FR')} <span className="text-base">€</span>
          </p>
        </div>
      </div>

      {/* Détails comptant / échelonné */}
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-6">
        <h3 className="text-xs font-bold uppercase tracking-widest text-stone-500 mb-5 flex items-center gap-2">
          <Info className="h-4 w-4" />
          Détails de la période
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-5 rounded-xl bg-white shadow-[0_20px_40px_rgba(27,28,27,0.04)] border border-stone-100/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="text-sm font-bold text-stone-700" style={{ fontFamily: 'Manrope, sans-serif' }}>Paiement Comptant</span>
              </div>
              <span className="text-lg font-extrabold text-stone-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {myWonProspects.filter(p => !p.installments || p.installments <= 1).length}
              </span>
            </div>
            <div className="h-2 w-full bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                style={{
                  width: myWonProspects.length > 0
                    ? `${(myWonProspects.filter(p => !p.installments || p.installments <= 1).length / myWonProspects.length) * 100}%`
                    : '0%'
                }}
              />
            </div>
            <p className="text-xs text-stone-500 mt-2 text-right">
              Total : <span className="font-bold text-emerald-600">
                {formatCurrency(myWonProspects.filter(p => !p.installments || p.installments <= 1).reduce((s, p) => s + (p.value || 0), 0))}
              </span>
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white shadow-[0_20px_40px_rgba(27,28,27,0.04)] border border-stone-100/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                <span className="text-sm font-bold text-stone-700" style={{ fontFamily: 'Manrope, sans-serif' }}>Paiement en plusieurs fois</span>
              </div>
              <span className="text-lg font-extrabold text-stone-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {myWonProspects.filter(p => p.installments && p.installments > 1).length}
              </span>
            </div>
            <div className="h-2 w-full bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-700"
                style={{
                  width: myWonProspects.length > 0
                    ? `${(myWonProspects.filter(p => p.installments && p.installments > 1).length / myWonProspects.length) * 100}%`
                    : '0%'
                }}
              />
            </div>
            <p className="text-xs text-stone-500 mt-2 text-right">
              Total : <span className="font-bold text-blue-600">
                {formatCurrency(myWonProspects.filter(p => p.installments && p.installments > 1).reduce((s, p) => s + (p.value || 0), 0))}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Historique des factures */}
      <div className="bg-white rounded-xl shadow-[0_20px_40px_rgba(27,28,27,0.04)] border border-stone-100/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50/50">
                <th className="px-8 py-5 text-[11px] font-black text-stone-500 uppercase tracking-widest" style={{ fontFamily: 'Manrope, sans-serif' }}>N° Facture</th>
                <th className="px-8 py-5 text-[11px] font-black text-stone-500 uppercase tracking-widest" style={{ fontFamily: 'Manrope, sans-serif' }}>Date</th>
                <th className="px-8 py-5 text-[11px] font-black text-stone-500 uppercase tracking-widest" style={{ fontFamily: 'Manrope, sans-serif' }}>Client & Offre</th>
                <th className="px-8 py-5 text-[11px] font-black text-stone-500 uppercase tracking-widest" style={{ fontFamily: 'Manrope, sans-serif' }}>Montant TTC</th>
                <th className="px-8 py-5 text-[11px] font-black text-stone-500 uppercase tracking-widest text-center" style={{ fontFamily: 'Manrope, sans-serif' }}>Statut</th>
                <th className="px-8 py-5 text-[11px] font-black text-stone-500 uppercase tracking-widest text-right" style={{ fontFamily: 'Manrope, sans-serif' }}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100/50">
              {filteredInvoices.map((inv) => {
                const config = getStatusConfig(inv.status)
                return (
                  <tr key={inv.id} className="hover:bg-stone-50/50 transition-colors group">
                    <td className="px-8 py-6 font-mono text-xs font-bold text-stone-700">{inv.invoice_number}</td>
                    <td className="px-8 py-6 text-sm text-stone-700 font-medium">
                      {new Date(inv.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-stone-900" style={{ fontFamily: 'Manrope, sans-serif' }}>{inv.client_name}</span>
                        {inv.offer_name && <span className="text-[10px] text-stone-500 font-medium">{inv.offer_name}</span>}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-sm font-extrabold text-stone-900">{formatCurrency(inv.amount_ttc || 0)}</td>
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
                          <a
                            href={inv.stripe_payment_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-stone-900 text-white px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-stone-800 transition-all inline-flex items-center gap-1.5"
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
                              className="p-2 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-colors"
                              title="Voir"
                            >
                              <Eye className="h-4 w-4" />
                            </a>
                            <a
                              href={inv.pdf_url}
                              download
                              className="p-2 rounded-full hover:bg-stone-100 text-stone-400 hover:text-emerald-600 transition-colors"
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
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mb-4">
                        <FileText className="h-8 w-8 text-stone-300" />
                      </div>
                      <p className="text-sm font-bold text-stone-900 mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>Aucune facture</p>
                      <p className="text-xs text-stone-500">Aucune facture sur cette période</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generate Invoice Modal */}
      {isGenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-white/40 bg-white/95 backdrop-blur-xl p-6 shadow-[0_20px_40px_rgba(27,28,27,0.12)] relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsGenModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-xl font-extrabold text-stone-900 mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>Générer une facture</h2>
            <p className="text-xs text-stone-500 mb-5">La facture sera visible par votre organisation.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-1.5">Nom du client *</label>
                <input
                  type="text"
                  value={genClientName}
                  onChange={(e) => setGenClientName(e.target.value)}
                  className={inputCls}
                  placeholder="Ex: Jean Dupont"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-1.5">Offre / Formule</label>
                {formulas.length > 0 ? (
                  <select
                    value={genOfferName}
                    onChange={(e) => {
                      setGenOfferName(e.target.value)
                      const f = formulas.find(f => f.name === e.target.value)
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
                  <input
                    type="text"
                    value={genOfferName}
                    onChange={(e) => setGenOfferName(e.target.value)}
                    className={inputCls}
                    placeholder="Ex: Coaching 3 mois"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-1.5">Montant HT *</label>
                <div className="relative">
                  <input
                    type="number"
                    value={genAmountHT}
                    onChange={(e) => setGenAmountHT(e.target.value)}
                    className={`${inputCls} pr-10`}
                    placeholder="1000"
                    min="0"
                    step="0.01"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-stone-400">€</span>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50/50 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-stone-700">TVA (20%)</p>
                  <p className="text-xs text-stone-500">
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

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-1.5">Notes</label>
                <textarea
                  value={genNotes}
                  onChange={(e) => setGenNotes(e.target.value)}
                  className={`${inputCls} resize-none`}
                  rows={2}
                  placeholder="Notes optionnelles..."
                />
              </div>

              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => setIsGenModalOpen(false)}
                  className="flex-1 rounded-full border border-stone-300 py-2.5 font-semibold text-stone-700 hover:bg-stone-50 transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={genSaving || !genClientName || !genAmountHT}
                  className="flex-1 rounded-full bg-stone-900 py-2.5 font-bold text-white hover:bg-stone-800 transition-all disabled:opacity-50"
                >
                  {genSaving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Générer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
