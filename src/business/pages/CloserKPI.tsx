import { useState, useEffect, useMemo } from 'react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessProspects } from '../contexts/BusinessProspectsContext'
import { supabase } from '../../lib/supabase'
import {
  TrendingUp, DollarSign, ShoppingCart, Target, Award,
  Ban, Users, Briefcase, UserX, Settings, X, Save, Loader2, Package,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { cn } from '../../lib/utils'
import toast from 'react-hot-toast'

interface KpiConfig {
  planned_calls: number
  revenue_target: number
  commission_rate: number
}

interface Formula {
  id: string
  name: string
  price: number
  is_active: boolean
}

const formatCurrency = (n: number) => n.toLocaleString('fr-FR')
const formatPercent = (n: number) => n.toFixed(1)

export function CloserKPI() {
  const { teamMember, ownerUserId } = useBusinessAuth()
  const { prospects } = useBusinessProspects()
  const [activeTab, setActiveTab] = useState<'personal' | 'org' | 'offer'>('personal')
  const [kpiConfig, setKpiConfig] = useState<KpiConfig>({ planned_calls: 20, revenue_target: 10000, commission_rate: 10 })
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [formulas, setFormulas] = useState<Formula[]>([])
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null)

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

  // Load formulas for per-offer tab
  useEffect(() => {
    if (!ownerUserId) return
    fetch(`/api/business?action=formulas-list&user_id=${ownerUserId}`)
      .then(r => r.json())
      .then(data => {
        if (data.formulas) {
          setFormulas(data.formulas)
          if (data.formulas.length > 0 && !selectedOfferId) {
            setSelectedOfferId(data.formulas[0].id)
          }
        }
      })
      .catch(() => {})
  }, [ownerUserId])

  const saveConfig = async () => {
    if (!teamMember?.id || !ownerUserId) return
    const { error } = await supabase.from('business_kpi_config').upsert({
      team_member_id: teamMember.id,
      business_owner_id: ownerUserId,
      config: kpiConfig,
    }, { onConflict: 'team_member_id' })
    if (error) { toast.error('Erreur de sauvegarde'); return }
    toast.success('Configuration sauvegardee')
    setIsConfigOpen(false)
  }

  // Calculate personal KPIs from assigned prospects
  const myProspects = prospects.filter(p => p.assigned_to === teamMember?.id)
  const wonProspects = myProspects.filter(p => p.stage === 'won')
  const noShowProspects = myProspects.filter(p => p.stage === 'noshow')
  const lostProspects = myProspects.filter(p => p.stage === 'lost')
  const totalRevenue = wonProspects.reduce((sum, p) => sum + (p.value || 0), 0)
  const totalSales = wonProspects.length
  const closedTotal = wonProspects.length + lostProspects.length + noShowProspects.length
  const conversionRate = closedTotal > 0 ? (wonProspects.length / closedTotal) * 100 : 0
  const noShowRate = closedTotal > 0 ? (noShowProspects.length / closedTotal) * 100 : 0
  const commission = Math.round(totalRevenue * (kpiConfig.commission_rate / 100))

  // Org KPIs (all prospects)
  const orgWon = prospects.filter(p => p.stage === 'won')
  const orgNoShow = prospects.filter(p => p.stage === 'noshow')
  const orgLost = prospects.filter(p => p.stage === 'lost')
  const orgRevenue = orgWon.reduce((sum, p) => sum + (p.value || 0), 0)
  const orgClosedTotal = orgWon.length + orgLost.length + orgNoShow.length
  const orgConversion = orgClosedTotal > 0 ? (orgWon.length / orgClosedTotal) * 100 : 0
  const orgNoShowRate = orgClosedTotal > 0 ? (orgNoShow.length / orgClosedTotal) * 100 : 0
  const orgCommission = Math.round(orgRevenue * (kpiConfig.commission_rate / 100))

  // Per-offer KPIs
  const offerProspects = useMemo(() => {
    if (!selectedOfferId) return []
    return myProspects.filter(p => (p as any).offer_id === selectedOfferId || (p as any).formula_id === selectedOfferId)
  }, [myProspects, selectedOfferId])

  const offerWon = offerProspects.filter(p => p.stage === 'won')
  const offerNoShow = offerProspects.filter(p => p.stage === 'noshow')
  const offerLost = offerProspects.filter(p => p.stage === 'lost')
  const offerRevenue = offerWon.reduce((sum, p) => sum + (p.value || 0), 0)
  const offerClosedTotal = offerWon.length + offerLost.length + offerNoShow.length
  const offerConversion = offerClosedTotal > 0 ? (offerWon.length / offerClosedTotal) * 100 : 0
  const offerNoShowRate = offerClosedTotal > 0 ? (offerNoShow.length / offerClosedTotal) * 100 : 0
  const offerCommission = Math.round(offerRevenue * (kpiConfig.commission_rate / 100))

  // Chart data: group prospects by month
  const chartData = useMemo(() => {
    const source = activeTab === 'personal' ? myProspects : activeTab === 'org' ? prospects : offerProspects
    const monthMap: Record<string, { won: number; total: number; commission: number }> = {}
    source.forEach(p => {
      const date = new Date(p.created_at || Date.now())
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      if (!monthMap[key]) monthMap[key] = { won: 0, total: 0, commission: 0 }
      monthMap[key].total++
      if (p.stage === 'won') {
        monthMap[key].won++
        monthMap[key].commission += Math.round((p.value || 0) * (kpiConfig.commission_rate / 100))
      }
    })
    return Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => ({
        name: key,
        closing: val.total > 0 ? Math.round((val.won / val.total) * 100) : 0,
        commission: val.commission,
      }))
  }, [prospects, myProspects, offerProspects, activeTab, kpiConfig.commission_rate])

  // Current tab values
  const getTabValues = () => {
    if (activeTab === 'org') {
      return {
        revenue: orgRevenue, sales: orgWon.length, conversion: orgConversion,
        commission: orgCommission, noShowRate: orgNoShowRate, lost: orgLost.length,
        leads: prospects.length, deals: prospects.filter(p => !['won', 'lost', 'noshow'].includes(p.stage)).length,
      }
    }
    if (activeTab === 'offer') {
      return {
        revenue: offerRevenue, sales: offerWon.length, conversion: offerConversion,
        commission: offerCommission, noShowRate: offerNoShowRate, lost: offerLost.length,
        leads: offerProspects.length, deals: offerProspects.filter(p => !['won', 'lost', 'noshow'].includes(p.stage)).length,
      }
    }
    return {
      revenue: totalRevenue, sales: totalSales, conversion: conversionRate,
      commission, noShowRate, lost: lostProspects.length,
      leads: myProspects.length, deals: myProspects.filter(p => !['won', 'lost', 'noshow'].includes(p.stage)).length,
    }
  }

  const v = getTabValues()
  const avgCommission = v.sales > 0 ? Math.round(v.commission / v.sales) : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-slate-950">
        <Loader2 className="h-8 w-8 text-amber-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-8">
      {/* Header */}
      <div className="relative p-6 rounded-2xl bg-slate-800/40 border border-white/5 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20">
              <TrendingUp className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                Performance
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">Vos indicateurs de performance</p>
            </div>
          </div>
          <button
            onClick={() => setIsConfigOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-700/50 border border-white/10 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-all"
          >
            <Settings className="h-4 w-4" /> Configurer
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setActiveTab('personal')}
          className={cn(
            'px-5 py-2.5 rounded-full text-sm font-medium transition-all',
            activeTab === 'personal'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25'
              : 'bg-slate-800/40 text-slate-400 border border-white/5 hover:bg-slate-800/60 hover:text-slate-200'
          )}
        >
          Global (Personnel)
        </button>
        <button
          onClick={() => setActiveTab('org')}
          className={cn(
            'px-5 py-2.5 rounded-full text-sm font-medium transition-all',
            activeTab === 'org'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25'
              : 'bg-slate-800/40 text-slate-400 border border-white/5 hover:bg-slate-800/60 hover:text-slate-200'
          )}
        >
          Organisation
        </button>
        <button
          onClick={() => setActiveTab('offer')}
          className={cn(
            'px-5 py-2.5 rounded-full text-sm font-medium transition-all',
            activeTab === 'offer'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25'
              : 'bg-slate-800/40 text-slate-400 border border-white/5 hover:bg-slate-800/60 hover:text-slate-200'
          )}
        >
          Par Offre
        </button>
      </div>

      {activeTab === 'org' && (
        <div className="rounded-xl bg-slate-800/30 border border-white/5 px-4 py-3">
          <p className="text-sm text-slate-400 text-center">Vue en lecture seule des KPIs de l'organisation.</p>
        </div>
      )}

      {activeTab === 'offer' && (
        <div className="rounded-xl bg-slate-800/30 border border-white/5 px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">KPIs par offre/formule</p>
            <select
              value={selectedOfferId || ''}
              onChange={(e) => setSelectedOfferId(e.target.value)}
              className="rounded-lg bg-slate-800 border border-white/10 text-sm text-white px-3 py-1.5 focus:border-amber-500 focus:outline-none"
            >
              {formulas.length === 0 && <option value="">Aucune formule</option>}
              {formulas.map(f => (
                <option key={f.id} value={f.id}>{f.name} ({f.price}€)</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <KpiCard title="CA Genere" value={`${formatCurrency(v.revenue)} €`} icon={DollarSign} color="emerald" />
        <KpiCard title="Ventes Totales" value={v.sales} icon={ShoppingCart} color="blue" />
        <KpiCard title="Taux de Conversion" value={`${formatPercent(v.conversion)}%`} icon={Target} color="purple" />
        <KpiCard title="Mes Commissions" value={`${formatCurrency(v.commission)} €`} icon={Award} color="amber" glow />
        <KpiCard title="Taux de No Show" value={`${formatPercent(v.noShowRate)}%`} icon={UserX} color="rose" />
        <KpiCard title="Deals Perdus" value={v.lost} icon={Ban} color="slate" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/50 rounded-2xl p-6 border border-white/5 backdrop-blur-sm">
          <h3 className="text-lg font-semibold text-white mb-6">Historique Taux de Closing</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorClosing" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} unit="%" />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }} />
                <Area type="monotone" dataKey="closing" stroke="#a855f7" strokeWidth={2} fill="url(#colorClosing)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900/50 rounded-2xl p-6 border border-white/5 backdrop-blur-sm">
          <h3 className="text-lg font-semibold text-white mb-6">Historique Commissions</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorCommission" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} unit="€" />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }} />
                <Area type="monotone" dataKey="commission" stroke="#10b981" strokeWidth={2} fill="url(#colorCommission)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Pipeline Summary */}
      <div className="bg-slate-900/50 rounded-2xl p-6 border border-white/5 backdrop-blur-sm">
        <h3 className="text-lg font-semibold text-white mb-4">Resume du Pipeline</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SummaryItem label="Total Leads" value={v.leads} icon={Users} color="indigo" />
          <SummaryItem label="Deals en Cours" value={v.deals} icon={Briefcase} color="cyan" />
          <SummaryItem label="Commission Moy." value={`${formatCurrency(avgCommission)} €`} icon={Award} color="amber" />
        </div>
      </div>

      {/* Config Modal */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-white/10 p-6 shadow-2xl relative">
            <button onClick={() => setIsConfigOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-bold text-white mb-6">Configuration KPI</h2>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Objectif de revenue (€)</label>
                <input
                  type="number"
                  value={kpiConfig.revenue_target}
                  onChange={e => setKpiConfig(prev => ({ ...prev, revenue_target: Number(e.target.value) }))}
                  className="w-full rounded-xl bg-slate-800 border border-white/10 text-white py-2.5 px-4 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none placeholder-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Appels prevus / mois</label>
                <input
                  type="number"
                  value={kpiConfig.planned_calls}
                  onChange={e => setKpiConfig(prev => ({ ...prev, planned_calls: Number(e.target.value) }))}
                  className="w-full rounded-xl bg-slate-800 border border-white/10 text-white py-2.5 px-4 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none placeholder-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Taux de commission (%)</label>
                <input
                  type="number"
                  value={kpiConfig.commission_rate}
                  onChange={e => setKpiConfig(prev => ({ ...prev, commission_rate: Number(e.target.value) }))}
                  className="w-full rounded-xl bg-slate-800 border border-white/10 text-white py-2.5 px-4 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none placeholder-slate-500"
                />
              </div>
              <button
                onClick={saveConfig}
                className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-2.5 font-bold text-white hover:from-amber-400 hover:to-orange-400 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25"
              >
                <Save className="h-4 w-4" /> Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* -- Inline Components -- */

const KpiCard = ({ title, value, icon: Icon, color, glow }: any) => {
  const colors: any = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    slate: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
  }
  return (
    <div className={`relative p-6 rounded-2xl bg-slate-800/40 border border-white/5 backdrop-blur-md transition-all hover:bg-slate-800/60 group ${glow ? 'shadow-lg shadow-amber-500/10 border-amber-500/30' : ''}`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${colors[color] || colors.slate} group-hover:scale-110 transition-transform duration-300`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      <h3 className="text-slate-400 text-sm font-medium mb-1">{title}</h3>
      <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
    </div>
  )
}

const SummaryItem = ({ label, value, icon: Icon, color }: any) => {
  const colors: any = {
    indigo: 'text-indigo-400 bg-indigo-500/10',
    cyan: 'text-cyan-400 bg-cyan-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
  }
  return (
    <div className="flex items-center gap-5 p-4 rounded-xl hover:bg-white/5 transition-colors">
      <div className={`p-4 rounded-2xl ${colors[color]}`}>
        <Icon className="w-8 h-8" />
      </div>
      <div>
        <p className="text-slate-400 text-sm font-medium mb-1">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
      </div>
    </div>
  )
}
