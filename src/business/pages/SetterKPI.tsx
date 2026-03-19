import { useState, useEffect, useMemo } from 'react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessProspects } from '../contexts/BusinessProspectsContext'
import { supabase } from '../../lib/supabase'
import {
  TrendingUp, DollarSign, ShoppingCart, Target, Award,
  Ban, Users, Briefcase, UserX, Settings, X, Save, Loader2, Package,
  PhoneIncoming, CalendarCheck,
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

export function SetterKPI() {
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
    toast.success('Configuration sauvegardée')
    setIsConfigOpen(false)
  }

  // Setter prospects = prospects assigned to this setter via assigned_setter
  const myProspects = prospects.filter(p => p.assigned_setter === teamMember?.id)

  // Taux de Réponse: prospects contactés (hors stage "prospect") qui ne sont PAS en "noanswer"
  const contactedProspects = myProspects.filter(p => p.stage !== 'prospect')
  const respondedProspects = contactedProspects.filter(p => p.stage !== 'noanswer')
  const responseRate = contactedProspects.length > 0 ? (respondedProspects.length / contactedProspects.length) * 100 : 0

  // Taux de Booking: exclut "noanswer" et "unqualified" SEULEMENT si c'est le setter qui a mis en non-qualifié
  const qualifiedProspects = myProspects.filter(p => p.stage === 'qualified')
  const unqualifiedBySetter = contactedProspects.filter(p => p.stage === 'unqualified' && p.stage_changed_by === teamMember?.id)
  const bookedProspects = contactedProspects.filter(p => {
    if (p.stage === 'noanswer') return false
    if (p.stage === 'unqualified' && p.stage_changed_by === teamMember?.id) return false
    return true
  })
  const bookingTotal = contactedProspects.filter(p => {
    if (p.stage === 'noanswer') return false
    if (p.stage === 'unqualified' && p.stage_changed_by !== teamMember?.id) return false
    return true
  }).length
  const bookingRate = bookingTotal > 0 ? (bookedProspects.length / bookingTotal) * 100 : 0

  // Taux de Conversion: prospects qualifiés par le setter qui sont en "won"
  const qualifiedByMeAll = myProspects.filter(p => ['qualified', 'won', 'lost', 'noshow', 'followup'].includes(p.stage))
  const wonProspects = myProspects.filter(p => p.stage === 'won')
  const conversionRate = qualifiedByMeAll.length > 0 ? (wonProspects.length / qualifiedByMeAll.length) * 100 : 0

  // Taux de No Show: prospects qualifiés par le setter qui sont en "noshow"
  const noShowProspects = myProspects.filter(p => p.stage === 'noshow')
  const noShowRate = qualifiedByMeAll.length > 0 ? (noShowProspects.length / qualifiedByMeAll.length) * 100 : 0

  const lostProspects = myProspects.filter(p => p.stage === 'lost')
  const totalRevenue = wonProspects.reduce((sum, p) => sum + (p.value || 0), 0)
  const totalSales = wonProspects.length
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

  const inputCls = "w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"

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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100">
            <TrendingUp className="h-5 w-5 text-purple-700" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Performance Setter</h1>
            <p className="text-xs text-slate-500">Vos indicateurs de performance</p>
          </div>
        </div>
        <button
          onClick={() => setIsConfigOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <Settings className="h-4 w-4" /> Configurer
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'personal' as const, label: 'Global (Personnel)' },
          { key: 'org' as const, label: 'Organisation' },
          { key: 'offer' as const, label: 'Par Offre' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-medium transition-all',
              activeTab === tab.key
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'org' && (
        <div className="rounded-xl bg-purple-50 border border-purple-200 px-4 py-3">
          <p className="text-sm text-purple-700 text-center">Vue en lecture seule des KPIs de l'organisation.</p>
        </div>
      )}

      {activeTab === 'offer' && (
        <div className="rounded-xl bg-purple-50 border border-purple-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-purple-700">KPIs par offre/formule</p>
            <select
              value={selectedOfferId || ''}
              onChange={(e) => setSelectedOfferId(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white text-sm text-slate-900 px-3 py-1.5 focus:border-purple-500 focus:outline-none"
            >
              {formulas.length === 0 && <option value="">Aucune formule</option>}
              {formulas.map(f => (
                <option key={f.id} value={f.id}>{f.name} ({f.price}€)</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Setter-specific KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-purple-200 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50">
              <PhoneIncoming className="h-4 w-4 text-purple-600" />
            </div>
            <span className="text-xs font-medium text-slate-500">Taux de Réponse</span>
          </div>
          <p className="text-2xl font-bold text-purple-700">{formatPercent(responseRate)}%</p>
          <p className="text-xs text-slate-400 mt-1">{respondedProspects.length} réponses / {contactedProspects.length} contactés</p>
        </div>
        <div className="bg-white rounded-2xl border border-purple-200 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50">
              <CalendarCheck className="h-4 w-4 text-purple-600" />
            </div>
            <span className="text-xs font-medium text-slate-500">Taux de Booking</span>
          </div>
          <p className="text-2xl font-bold text-purple-700">{formatPercent(bookingRate)}%</p>
          <p className="text-xs text-slate-400 mt-1">{bookedProspects.length} bookés / {bookingTotal} contactés</p>
        </div>
      </div>

      {/* Standard KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard title="CA Généré" value={`${formatCurrency(v.revenue)} €`} icon={DollarSign} color="emerald" />
        <KpiCard title="Ventes Totales" value={v.sales} icon={ShoppingCart} color="blue" />
        <KpiCard title="Taux de Conversion" value={`${formatPercent(v.conversion)}%`} icon={Target} color="purple" subtitle={`${wonProspects.length} gagnés / ${qualifiedByMeAll.length} qualifiés`} />
        <KpiCard title="Mes Commissions" value={`${formatCurrency(v.commission)} €`} icon={Award} color="amber" highlight />
        <KpiCard title="Taux de No Show" value={`${formatPercent(v.noShowRate)}%`} icon={UserX} color="rose" subtitle={`${noShowProspects.length} no shows / ${qualifiedByMeAll.length} qualifiés`} />
        <KpiCard title="Deals Perdus" value={v.lost} icon={Ban} color="slate" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Historique Taux de Closing</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorClosingSetter" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9333ea" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#9333ea" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} unit="%" />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', color: '#0f172a' }} />
                <Area type="monotone" dataKey="closing" stroke="#9333ea" strokeWidth={2} fill="url(#colorClosingSetter)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Historique Commissions</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorCommissionSetter" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} unit="€" />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', color: '#0f172a' }} />
                <Area type="monotone" dataKey="commission" stroke="#10b981" strokeWidth={2} fill="url(#colorCommissionSetter)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Pipeline Summary */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Résumé du Pipeline</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SummaryItem label="Total Leads" value={v.leads} icon={Users} color="indigo" />
          <SummaryItem label="Deals en Cours" value={v.deals} icon={Briefcase} color="cyan" />
          <SummaryItem label="Commission Moy." value={`${formatCurrency(avgCommission)} €`} icon={Award} color="amber" />
        </div>
      </div>

      {/* Config Modal */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">Configuration KPI</h2>
              <button onClick={() => setIsConfigOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Objectif de revenue (€)</label>
                <input
                  type="number"
                  value={kpiConfig.revenue_target}
                  onChange={e => setKpiConfig(prev => ({ ...prev, revenue_target: Number(e.target.value) }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Appels prévus / mois</label>
                <input
                  type="number"
                  value={kpiConfig.planned_calls}
                  onChange={e => setKpiConfig(prev => ({ ...prev, planned_calls: Number(e.target.value) }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Taux de commission (%)</label>
                <input
                  type="number"
                  value={kpiConfig.commission_rate}
                  onChange={e => setKpiConfig(prev => ({ ...prev, commission_rate: Number(e.target.value) }))}
                  className={inputCls}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button onClick={() => setIsConfigOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Annuler
              </button>
              <button
                onClick={saveConfig}
                className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
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

const KpiCard = ({ title, value, icon: Icon, color, highlight, subtitle }: any) => {
  const colors: any = {
    emerald: { icon: 'bg-emerald-50 text-emerald-600' },
    blue: { icon: 'bg-blue-50 text-blue-600' },
    purple: { icon: 'bg-purple-50 text-purple-600' },
    amber: { icon: 'bg-amber-50 text-amber-600' },
    rose: { icon: 'bg-rose-50 text-rose-600' },
    slate: { icon: 'bg-slate-100 text-slate-600' },
  }
  const c = colors[color] || colors.slate
  return (
    <div className={cn(
      'bg-white rounded-2xl border p-5 transition-all hover:shadow-md',
      highlight ? 'border-amber-200 shadow-sm' : 'border-slate-200'
    )}>
      <div className="flex items-center gap-3 mb-3">
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', c.icon)}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-xs font-medium text-slate-500">{title}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
    </div>
  )
}

const SummaryItem = ({ label, value, icon: Icon, color }: any) => {
  const colors: any = {
    indigo: 'bg-indigo-50 text-indigo-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    amber: 'bg-amber-50 text-amber-600',
  }
  return (
    <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors">
      <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', colors[color])}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="text-xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  )
}
