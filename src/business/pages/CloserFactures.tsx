import { useState, useEffect, useMemo } from 'react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessProspects } from '../contexts/BusinessProspectsContext'
import { supabase } from '../../lib/supabase'
import { FileText, DollarSign, TrendingUp, Loader2, Receipt } from 'lucide-react'
import { cn } from '../../lib/utils'

interface Invoice {
  id: string
  prospect_id: number
  amount: number
  status: 'draft' | 'sent' | 'paid' | 'overdue'
  created_at: string
  contact_name: string
}

const STATUS_CONFIG: Record<Invoice['status'], { label: string; bg: string; text: string }> = {
  draft: { label: 'Brouillon', bg: 'bg-slate-100', text: 'text-slate-700' },
  sent: { label: 'Envoyée', bg: 'bg-blue-100', text: 'text-blue-700' },
  paid: { label: 'Payée', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  overdue: { label: 'En retard', bg: 'bg-red-100', text: 'text-red-700' },
}

const formatCurrency = (n: number) => n.toLocaleString('fr-FR') + ' \u20ac'
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

export function CloserFactures() {
  const { teamMember, ownerUserId } = useBusinessAuth()
  const { prospects } = useBusinessProspects()

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [hasTable, setHasTable] = useState(true)

  // Fetch invoices from business_invoices, fallback to won prospects
  useEffect(() => {
    if (!ownerUserId || !teamMember?.id) return

    const fetchInvoices = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('business_invoices')
        .select('*')
        .eq('business_owner_id', ownerUserId)
        .order('created_at', { ascending: false })

      if (error) {
        // Table likely doesn't exist — fallback to won prospects
        setHasTable(false)
        setInvoices([])
      } else {
        setHasTable(true)
        // Filter to invoices related to prospects assigned to this closer
        const myProspectIds = new Set(
          prospects
            .filter((p) => p.assigned_to === teamMember.id)
            .map((p) => p.id)
        )
        setInvoices((data as Invoice[]).filter((inv) => myProspectIds.has(inv.prospect_id)))
      }
      setLoading(false)
    }

    fetchInvoices()
  }, [ownerUserId, teamMember?.id, prospects])

  // Won prospects as pseudo-invoices fallback
  const wonProspects = useMemo(
    () => prospects.filter((p) => p.stage === 'won' && p.assigned_to === teamMember?.id),
    [prospects, teamMember?.id]
  )

  const displayData = hasTable ? invoices : []
  const fallbackMode = !hasTable

  // KPI calculations
  const totalFacture = useMemo(() => {
    if (fallbackMode) return wonProspects.reduce((sum, p) => sum + (p.value || 0), 0)
    return invoices.reduce((sum, inv) => sum + inv.amount, 0)
  }, [fallbackMode, invoices, wonProspects])

  const count = fallbackMode ? wonProspects.length : invoices.length

  const commissionEstimee = useMemo(() => totalFacture * 0.1, [totalFacture])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    )
  }

  const getDisplayName = (p: typeof wonProspects[0]) => {
    if (p.firstName || p.lastName) return `${p.firstName || ''} ${p.lastName || ''}`.trim()
    return p.contact || 'Prospect sans nom'
  }

  return (
    <div className="flex h-full flex-col p-8 overflow-hidden bg-slate-950 -m-6 rounded-xl">
      {/* Header */}
      <div className="mb-8 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
            <Receipt className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Factures</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {fallbackMode ? 'Deals gagn\u00e9s' : 'Vos factures'}
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 shrink-0">
        <div className="rounded-xl border border-slate-800 bg-white/[0.03] p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
              <DollarSign className="h-4 w-4 text-amber-500" />
            </div>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total factur\u00e9</span>
          </div>
          <p className="text-2xl font-bold text-white">{formatCurrency(totalFacture)}</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-white/[0.03] p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
              <FileText className="h-4 w-4 text-amber-500" />
            </div>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Nombre de factures</span>
          </div>
          <p className="text-2xl font-bold text-white">{count}</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-white/[0.03] p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Commission estim\u00e9e</span>
          </div>
          <p className="text-2xl font-bold text-emerald-400">{formatCurrency(commissionEstimee)}</p>
          <p className="text-xs text-slate-500 mt-1">10% du total factur\u00e9</p>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-xl border border-slate-800 bg-white/[0.02]">
        {/* Table header */}
        <div className="grid grid-cols-4 gap-4 border-b border-slate-800 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <span>Contact</span>
          <span>Montant</span>
          <span>Date</span>
          <span>Statut</span>
        </div>

        {/* Rows */}
        {fallbackMode ? (
          wonProspects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <FileText className="h-10 w-10 text-slate-700 mb-3" />
              <p className="text-sm text-slate-500">Aucun deal gagn\u00e9 pour le moment</p>
            </div>
          ) : (
            wonProspects.map((p) => (
              <div
                key={p.id}
                className="grid grid-cols-4 gap-4 items-center border-b border-slate-800/50 px-6 py-4 hover:bg-white/[0.02] transition-colors"
              >
                <span className="text-sm font-medium text-white truncate">{getDisplayName(p)}</span>
                <span className="text-sm text-white font-medium">{formatCurrency(p.value || 0)}</span>
                <span className="text-sm text-slate-400">
                  {p.updated_at ? formatDate(p.updated_at) : '-'}
                </span>
                <span>
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                    Gagn\u00e9
                  </span>
                </span>
              </div>
            ))
          )
        ) : displayData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <FileText className="h-10 w-10 text-slate-700 mb-3" />
            <p className="text-sm text-slate-500">Aucune facture pour le moment</p>
          </div>
        ) : (
          displayData.map((inv) => {
            const config = STATUS_CONFIG[inv.status]
            return (
              <div
                key={inv.id}
                className="grid grid-cols-4 gap-4 items-center border-b border-slate-800/50 px-6 py-4 hover:bg-white/[0.02] transition-colors"
              >
                <span className="text-sm font-medium text-white truncate">{inv.contact_name}</span>
                <span className="text-sm text-white font-medium">{formatCurrency(inv.amount)}</span>
                <span className="text-sm text-slate-400">{formatDate(inv.created_at)}</span>
                <span>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                      config.bg,
                      config.text
                    )}
                  >
                    {config.label}
                  </span>
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
