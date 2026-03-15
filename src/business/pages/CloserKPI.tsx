import { useState, useEffect, useCallback } from 'react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessProspects } from '../contexts/BusinessProspectsContext'
import { supabase } from '../../lib/supabase'
import {
  TrendingUp, DollarSign, ShoppingCart, Target,
  Users, Loader2, Settings, Save, X,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import toast from 'react-hot-toast'

interface KpiConfig {
  planned_calls: number
  revenue_target: number
  commission_rate: number
}

export function CloserKPI() {
  const { teamMember, ownerUserId } = useBusinessAuth()
  const { prospects } = useBusinessProspects()
  const [activeTab, setActiveTab] = useState<'personal' | 'org'>('personal')
  const [kpiConfig, setKpiConfig] = useState<KpiConfig>({ planned_calls: 20, revenue_target: 10000, commission_rate: 10 })
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load KPI config
  useEffect(() => {
    if (!teamMember?.id) return
    setLoading(true)
    supabase
      .from('business_kpi_config')
      .select('*')
      .eq('team_member_id', teamMember.id)
      .single()
      .then(({ data }) => {
        if (data?.config) setKpiConfig(data.config as any)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [teamMember?.id])

  const saveConfig = async () => {
    if (!teamMember?.id || !ownerUserId) return
    const { error } = await supabase.from('business_kpi_config').upsert({
      team_member_id: teamMember.id,
      business_owner_id: ownerUserId,
      config: kpiConfig,
    }, { onConflict: 'team_member_id' })
    if (error) { toast.error('Erreur de sauvegarde'); return }
    toast.success('Configuration sauvegardée')
    setIsConfigOpen(false)
  }

  // Calculate personal KPIs from assigned prospects
  const myProspects = prospects.filter(p => p.assigned_to === teamMember?.id)
  const wonProspects = myProspects.filter(p => p.stage === 'won')
  const totalRevenue = wonProspects.reduce((sum, p) => sum + (p.value || 0), 0)
  const totalSales = wonProspects.length
  const conversionRate = myProspects.length > 0 ? Math.round((wonProspects.length / myProspects.length) * 100) : 0
  const commission = Math.round(totalRevenue * (kpiConfig.commission_rate / 100))

  // Org KPIs (all prospects)
  const orgWon = prospects.filter(p => p.stage === 'won')
  const orgRevenue = orgWon.reduce((sum, p) => sum + (p.value || 0), 0)
  const orgConversion = prospects.length > 0 ? Math.round((orgWon.length / prospects.length) * 100) : 0

  const kpiCards = [
    { label: 'Revenue', value: `${totalRevenue.toLocaleString()} €`, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    { label: 'Ventes', value: totalSales, icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
    { label: 'Taux conversion', value: `${conversionRate}%`, icon: Target, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
    { label: 'Commissions', value: `${commission.toLocaleString()} €`, icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  ]

  const orgCards = [
    { label: 'Revenue Org', value: `${orgRevenue.toLocaleString()} €`, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    { label: 'Ventes Org', value: orgWon.length, icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
    { label: 'Conversion Org', value: `${orgConversion}%`, icon: Target, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
    { label: 'Total Prospects', value: prospects.length, icon: Users, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-amber-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
            <TrendingUp className="h-5 w-5 text-amber-700" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">KPI</h2>
            <p className="text-xs text-slate-500">Vos indicateurs de performance</p>
          </div>
        </div>
        <button onClick={() => setIsConfigOpen(true)} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
          <Settings className="h-3.5 w-3.5" /> Configurer
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-amber-200">
        <button
          onClick={() => setActiveTab('personal')}
          className={cn("px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px", activeTab === 'personal' ? 'border-amber-600 text-amber-700' : 'border-transparent text-slate-400 hover:text-slate-600')}
        >
          Global (Personnel)
        </button>
        <button
          onClick={() => setActiveTab('org')}
          className={cn("px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px", activeTab === 'org' ? 'border-amber-600 text-amber-700' : 'border-transparent text-slate-400 hover:text-slate-600')}
        >
          Organisation
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(activeTab === 'personal' ? kpiCards : orgCards).map((kpi, i) => (
          <div key={i} className={cn("rounded-xl border p-5", kpi.border, kpi.bg)}>
            <div className="flex items-center gap-2 mb-3">
              <kpi.icon className={cn("h-5 w-5", kpi.color)} />
              <span className="text-xs font-medium text-slate-500">{kpi.label}</span>
            </div>
            <p className={cn("text-2xl font-bold", kpi.color)}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Progress bars for personal tab */}
      {activeTab === 'personal' && (
        <div className="rounded-xl border border-amber-200 bg-white p-6 space-y-5">
          <h3 className="text-sm font-bold text-slate-900">Progression</h3>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-600">Objectif Revenue</span>
              <span className="text-xs text-slate-500">{totalRevenue.toLocaleString()} / {kpiConfig.revenue_target.toLocaleString()} €</span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, (totalRevenue / kpiConfig.revenue_target) * 100)}%` }} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-600">Prospects traités</span>
              <span className="text-xs text-slate-500">{myProspects.length} prospects</span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${Math.min(100, (myProspects.length / Math.max(1, kpiConfig.planned_calls)) * 100)}%` }} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'org' && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
          <p className="text-sm text-slate-500 text-center">Vue en lecture seule des KPIs de l'organisation.</p>
        </div>
      )}

      {/* Config Modal */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-2xl relative">
            <button onClick={() => setIsConfigOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700">
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-bold text-slate-900 mb-4">Configuration KPI</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Objectif de revenue (€)</label>
                <input type="number" value={kpiConfig.revenue_target} onChange={e => setKpiConfig(prev => ({ ...prev, revenue_target: Number(e.target.value) }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-4 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Appels prévus / mois</label>
                <input type="number" value={kpiConfig.planned_calls} onChange={e => setKpiConfig(prev => ({ ...prev, planned_calls: Number(e.target.value) }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-4 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Taux de commission (%)</label>
                <input type="number" value={kpiConfig.commission_rate} onChange={e => setKpiConfig(prev => ({ ...prev, commission_rate: Number(e.target.value) }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-4 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none" />
              </div>
              <button onClick={saveConfig} className="w-full rounded-xl bg-amber-600 py-2.5 font-bold text-white hover:bg-amber-500 transition-all flex items-center justify-center gap-2">
                <Save className="h-4 w-4" /> Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
