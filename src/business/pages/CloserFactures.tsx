import { useState, useMemo, useEffect } from 'react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessProspects } from '../contexts/BusinessProspectsContext'
import { supabase } from '../../lib/supabase'
import {
  TrendingUp, DollarSign, Calendar, FileText, CreditCard, Clock,
  Info, Eye, Download, Loader2, Receipt,
} from 'lucide-react'
import { cn } from '../../lib/utils'

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'payé': return { label: 'Payé', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' }
    case 'envoyée': return { label: 'Envoyée', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' }
    case 'générée': return { label: 'Générée', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' }
    case 'retard': return { label: 'En retard', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' }
    case 'en attente': case 'en_attente': return { label: 'En attente', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' }
    default: return { label: status || 'Brouillon', bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' }
  }
}

export function CloserFactures() {
  const { user, teamMember, ownerUserId } = useBusinessAuth()
  const { prospects } = useBusinessProspects()

  const [savedInvoices, setSavedInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  const [startDate, setStartDate] = useState(firstDayOfMonth.toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(lastDayOfMonth.toISOString().split('T')[0])

  // Fetch invoices from invoices table (organization-level)
  useEffect(() => {
    if (!ownerUserId) return
    const fetchInvoices = async () => {
      setLoading(true)
      // Try business_invoices first, then invoices table
      let { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', ownerUserId)
        .order('created_at', { ascending: false })

      if (error) {
        // Fallback: try business_invoices
        const res = await supabase
          .from('business_invoices')
          .select('*')
          .eq('business_owner_id', ownerUserId)
          .order('created_at', { ascending: false })
        data = res.data
      }

      setSavedInvoices(data || [])
      setLoading(false)
    }
    fetchInvoices()
  }, [ownerUserId])

  // Won prospects assigned to me
  const myWonProspects = useMemo(
    () => prospects.filter(p => p.stage === 'won' && p.assigned_to === teamMember?.id),
    [prospects, teamMember?.id]
  )

  // Filter invoices by date range
  const filteredInvoices = useMemo(() => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)
    return savedInvoices.filter(inv => {
      const d = new Date(inv.created_at)
      return d >= start && d <= end
    })
  }, [savedInvoices, startDate, endDate])

  // KPIs
  const totalRevenue = useMemo(() =>
    myWonProspects.reduce((sum, p) => sum + (p.value || 0), 0),
    [myWonProspects]
  )

  const pendingInvoices = useMemo(() =>
    filteredInvoices.filter(inv => ['en_attente', 'retard', 'en attente'].includes(inv.status)),
    [filteredInvoices]
  )

  const pendingAmount = useMemo(() =>
    pendingInvoices.reduce((sum, inv) => sum + (inv.amount_ttc || 0), 0),
    [pendingInvoices]
  )

  const commissionEstimee = useMemo(() => totalRevenue * 0.1, [totalRevenue])

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
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
          <Receipt className="h-5 w-5 text-amber-700" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Factures & Commissions</h1>
          <p className="text-xs text-slate-500">Suivez vos commissions et l'historique des factures</p>
        </div>
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
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
              <CreditCard className="h-4 w-4 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-slate-500">Commission Moy.</span>
          </div>
          <p className="text-xl font-bold text-slate-900">
            {myWonProspects.length > 0 ? formatCurrency(commissionEstimee / myWonProspects.length) : formatCurrency(0)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Par deal</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50">
              <Clock className="h-4 w-4 text-rose-600" />
            </div>
            <span className="text-xs font-medium text-slate-500">En attente</span>
          </div>
          <p className="text-xl font-bold text-slate-900">{formatCurrency(pendingAmount)}</p>
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
          {/* Comptant */}
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

          {/* Plusieurs fois */}
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
                      <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border', config.bg, config.text, config.border)}>
                        {config.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {inv.pdf_url && (
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
    </div>
  )
}
