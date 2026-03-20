import { useState, useMemo, useEffect, useCallback } from 'react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { supabase } from '../../lib/supabase'
import {
  FileText, Calendar, Loader2, Receipt, ExternalLink, Filter, ChevronDown,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import toast from 'react-hot-toast'

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
}

interface TeamMember {
  id: string
  first_name: string
  last_name: string
  role: string
}

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

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)

export function OwnerFactures() {
  const { user, isTeamMember, teamMember, ownerUserId } = useBusinessAuth()
  const effectiveUserId = ownerUserId || user?.id

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)

  const [filterMember, setFilterMember] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const now = new Date()
  const [startDate, setStartDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0])

  // Fetch data
  useEffect(() => {
    if (!effectiveUserId) return
    setLoading(true)
    Promise.all([
      supabase.from('invoices').select('*').eq('user_id', effectiveUserId).order('created_at', { ascending: false }),
      supabase.from('business_team_members').select('id, first_name, last_name, role').eq('business_owner_id', effectiveUserId),
    ]).then(([invRes, tmRes]) => {
      setInvoices(invRes.data || [])
      setTeamMembers(tmRes.data || [])
      setLoading(false)
    })
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

  // KPIs
  const totalAmount = useMemo(() => filtered.reduce((s, i) => s + (i.amount_ttc || 0), 0), [filtered])
  const paidAmount = useMemo(() => filtered.filter(i => i.status === 'payé').reduce((s, i) => s + (i.amount_ttc || 0), 0), [filtered])
  const pendingAmount = useMemo(() => filtered.filter(i => i.status !== 'payé').reduce((s, i) => s + (i.amount_ttc || 0), 0), [filtered])

  // Update status
  const handleStatusChange = useCallback(async (invoiceId: string, newStatus: string) => {
    const { error } = await supabase.from('invoices').update({ status: newStatus }).eq('id', invoiceId)
    if (error) { toast.error('Erreur'); return }
    setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, status: newStatus } : inv))
    toast.success('Statut mis à jour')
  }, [])

  const getMemberName = (id: string | null) => {
    if (!id) return '—'
    const m = teamMembers.find(t => t.id === id)
    return m ? `${m.first_name} ${m.last_name}` : '—'
  }

  const inputCls = "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-amber-600" /></div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
          <Receipt className="h-5 w-5 text-amber-700" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Factures</h1>
          <p className="text-xs text-slate-500">Toutes les factures de votre organisation</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row items-stretch md:items-end gap-4 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 shrink-0">
            <Calendar className="h-4 w-4 text-amber-600" />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-500">Début</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
          </div>
          <span className="mt-5 text-slate-400">→</span>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-500">Fin</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputCls} />
          </div>
        </div>

        {teamMembers.length > 0 && (
          <div className="min-w-[180px]">
            <label className="mb-1 block text-xs font-medium text-slate-500">Membre</label>
            <select value={filterMember} onChange={e => setFilterMember(e.target.value)} className={inputCls}>
              <option value="all">Tous les membres</option>
              {teamMembers.map(m => (
                <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="min-w-[140px]">
          <label className="mb-1 block text-xs font-medium text-slate-500">Statut</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={inputCls}>
            <option value="all">Tous</option>
            {STATUS_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500 mb-1">Total facturé</p>
          <p className="text-xl font-bold text-slate-900">{formatCurrency(totalAmount)}</p>
          <p className="text-[11px] text-slate-400 mt-1">{filtered.length} facture(s)</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500 mb-1">Payé</p>
          <p className="text-xl font-bold text-emerald-600">{formatCurrency(paidAmount)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500 mb-1">En attente</p>
          <p className="text-xl font-bold text-amber-600">{formatCurrency(pendingAmount)}</p>
        </div>
      </div>

      {/* Invoices table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-5 py-3 font-medium tracking-wider">N° Facture</th>
                <th className="px-5 py-3 font-medium tracking-wider">Date</th>
                <th className="px-5 py-3 font-medium tracking-wider">Client</th>
                <th className="px-5 py-3 font-medium tracking-wider">Membre</th>
                <th className="px-5 py-3 font-medium tracking-wider">Montant TTC</th>
                <th className="px-5 py-3 font-medium tracking-wider">Statut</th>
                <th className="px-5 py-3 text-right font-medium tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(inv => {
                const config = getStatusConfig(inv.status)
                return (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-5 py-3.5 font-mono text-sm font-medium text-amber-700">{inv.invoice_number}</td>
                    <td className="px-5 py-3.5 text-slate-600">{new Date(inv.created_at).toLocaleDateString('fr-FR')}</td>
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-slate-900">{inv.client_name}</div>
                      {inv.offer_name && <div className="text-xs text-slate-400">{inv.offer_name}</div>}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 text-xs">{getMemberName(inv.team_member_id)}</td>
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
                        {/* Keep existing status if it's not in our list */}
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
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
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
