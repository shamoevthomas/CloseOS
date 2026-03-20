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
  { value: 'à payer', label: 'À payer', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  { value: 'en cours', label: 'En cours', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  { value: 'payé', label: 'Payé', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
]

const getStatusConfig = (status: string) => {
  const found = STATUS_OPTIONS.find(s => s.value === status)
  if (found) return found
  switch (status) {
    case 'envoyée': return { value: status, label: 'Envoyée', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' }
    case 'générée': return { value: status, label: 'Générée', bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' }
    case 'retard': return { value: status, label: 'En retard', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' }
    case 'en attente': case 'en_attente': return { value: status, label: 'En attente', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' }
    default: return { value: status, label: status || 'Brouillon', bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' }
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

  const inputCls = "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
            <Receipt className="h-5 w-5 text-amber-700" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Factures & Commissions</h1>
            <p className="text-xs text-slate-500">Suivez vos commissions et gérez vos factures</p>
          </div>
        </div>
        <button
          onClick={() => setIsGenModalOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-700 transition-colors"
        >
          <Plus className="h-4 w-4" /> Générer une facture
        </button>
      </div>

      {/* Date Picker */}
      <div className="flex flex-col md:flex-row items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
            <Calendar className="h-4 w-4 text-amber-600" />
          </div>
          <span className="text-sm font-semibold text-slate-700">Période :</span>
        </div>
        <div className="flex items-center gap-3 flex-1">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-500">Date de début</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
          </div>
          <span className="mt-5 text-slate-400">→</span>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-500">Date de fin</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
            <span className="text-xs font-medium text-slate-500">CA Généré</span>
          </div>
          <p className="text-xl font-bold text-slate-900">{formatCurrency(totalRevenue)}</p>
          <p className="text-[11px] text-slate-400 mt-1">{myWonProspects.length} deal(s) gagné(s)</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
              <DollarSign className="h-4 w-4 text-amber-600" />
            </div>
            <span className="text-xs font-medium text-slate-500">Ma Commission</span>
          </div>
          <p className="text-xl font-bold text-slate-900">{formatCurrency(commissionEstimee)}</p>
          <p className="text-[11px] text-slate-400 mt-1">10% du CA</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
              <CreditCard className="h-4 w-4 text-emerald-600" />
            </div>
            <span className="text-xs font-medium text-slate-500">Payé</span>
          </div>
          <p className="text-xl font-bold text-emerald-600">{formatCurrency(paidAmount)}</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50">
              <Clock className="h-4 w-4 text-rose-600" />
            </div>
            <span className="text-xs font-medium text-slate-500">En attente</span>
          </div>
          <p className="text-xl font-bold text-amber-600">{formatCurrency(pendingAmount)}</p>
          <p className="text-[11px] text-slate-400 mt-1">{pendingInvoices.length} facture(s)</p>
        </div>
      </div>

      {/* Détails comptant / échelonné */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Info className="h-4 w-4 text-amber-600" />
          Détails de la période
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="text-sm font-semibold text-slate-700">Paiement Comptant</span>
              </div>
              <span className="text-lg font-bold text-slate-900">
                {myWonProspects.filter(p => !p.installments || p.installments <= 1).length}
              </span>
            </div>
            <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                style={{
                  width: myWonProspects.length > 0
                    ? `${(myWonProspects.filter(p => !p.installments || p.installments <= 1).length / myWonProspects.length) * 100}%`
                    : '0%'
                }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2 text-right">
              Total : <span className="font-semibold text-emerald-600">
                {formatCurrency(myWonProspects.filter(p => !p.installments || p.installments <= 1).reduce((s, p) => s + (p.value || 0), 0))}
              </span>
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                <span className="text-sm font-semibold text-slate-700">Paiement en plusieurs fois</span>
              </div>
              <span className="text-lg font-bold text-slate-900">
                {myWonProspects.filter(p => p.installments && p.installments > 1).length}
              </span>
            </div>
            <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-700"
                style={{
                  width: myWonProspects.length > 0
                    ? `${(myWonProspects.filter(p => p.installments && p.installments > 1).length / myWonProspects.length) * 100}%`
                    : '0%'
                }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2 text-right">
              Total : <span className="font-semibold text-blue-600">
                {formatCurrency(myWonProspects.filter(p => p.installments && p.installments > 1).reduce((s, p) => s + (p.value || 0), 0))}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Historique des factures */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <FileText className="h-4 w-4 text-amber-600" />
            Historique des factures
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-5 py-3 font-medium tracking-wider">N° Facture</th>
                <th className="px-5 py-3 font-medium tracking-wider">Date</th>
                <th className="px-5 py-3 font-medium tracking-wider">Client / Offre</th>
                <th className="px-5 py-3 font-medium tracking-wider">Montant TTC</th>
                <th className="px-5 py-3 font-medium tracking-wider">Statut</th>
                <th className="px-5 py-3 text-right font-medium tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.map((inv) => {
                const config = getStatusConfig(inv.status)
                return (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-5 py-3.5 font-mono text-sm font-medium text-amber-700">{inv.invoice_number}</td>
                    <td className="px-5 py-3.5 text-slate-600">{new Date(inv.created_at).toLocaleDateString('fr-FR')}</td>
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-slate-900">{inv.client_name}</div>
                      {inv.offer_name && <div className="text-xs text-slate-400">{inv.offer_name}</div>}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-900">{formatCurrency(inv.amount_ttc || 0)}</td>
                    <td className="px-5 py-3.5">
                      <select
                        value={inv.status || ''}
                        onChange={e => handleStatusChange(inv.id, e.target.value)}
                        className={cn(
                          'rounded-full px-2.5 py-1 text-xs font-medium border cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-amber-500/30',
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
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex justify-end gap-2">
                        {inv.stripe_payment_link && (
                          <a
                            href={inv.stripe_payment_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
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
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-amber-600 transition-colors"
                              title="Voir"
                            >
                              <Eye className="h-4 w-4" />
                            </a>
                            <a
                              href={inv.pdf_url}
                              download
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-emerald-600 transition-colors"
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
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <FileText className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm text-slate-500">Aucune facture sur cette période</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generate Invoice Modal */}
      {isGenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsGenModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-lg font-bold text-slate-900 mb-1">Générer une facture</h2>
            <p className="text-xs text-slate-500 mb-4">La facture sera visible par votre organisation.</p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nom du client *</label>
                <input
                  type="text"
                  value={genClientName}
                  onChange={(e) => setGenClientName(e.target.value)}
                  className={inputCls}
                  placeholder="Ex: Jean Dupont"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Offre / Formule</label>
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Montant HT *</label>
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
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">€</span>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-700">TVA (20%)</p>
                  <p className="text-xs text-slate-400">
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
                    genTva ? 'bg-amber-600' : 'bg-slate-300'
                  )}
                >
                  <span className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    genTva ? 'translate-x-6' : 'translate-x-1'
                  )} />
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  value={genNotes}
                  onChange={(e) => setGenNotes(e.target.value)}
                  className={`${inputCls} resize-none`}
                  rows={2}
                  placeholder="Notes optionnelles..."
                />
              </div>

              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setIsGenModalOpen(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 font-medium text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={genSaving || !genClientName || !genAmountHT}
                  className="flex-1 rounded-xl bg-amber-600 py-2.5 font-bold text-white hover:bg-amber-500 transition-all disabled:opacity-50"
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
