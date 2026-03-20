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

interface TeamCloser {
  id: string
  first_name: string
  last_name: string
  role: string
}

const formatCurrency = (n: number) => n.toLocaleString('fr-FR')
const formatPercent = (n: number) => n.toFixed(1)

export function CloserKPI() {
  const { teamMember, ownerUserId, isTeamMember } = useBusinessAuth()
  const isOwnerView = !isTeamMember || teamMember?.role === 'Head of Sales' || teamMember?.role === 'Admin'
  const { prospects } = useBusinessProspects()
  const [activeTab, setActiveTab] = useState<'personal' | 'org' | 'offer' | 'member'>(isOwnerView ? 'org' : 'personal')
  const [kpiConfig, setKpiConfig] = useState<KpiConfig>({ planned_calls: 20, revenue_target: 10000, commission_rate: 10 })
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [formulas, setFormulas] = useState<Formula[]>([])
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null)
  const [teamClosers, setTeamClosers] = useState<TeamCloser[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)

  // Load KPI config
  useEffect(() => {
    if (!teamMember?.id) {
      if (isOwnerView) setLoading(false)
      return
    }
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
  }, [teamMember?.id, isOwnerView])

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

  // Load team closers for member tab (owner view only)
  useEffect(() => {
    if (!isOwnerView || !ownerUserId) return
    supabase
      .from('business_team_members')
      .select('id, first_name, last_name, role')
      .eq('business_owner_id', ownerUserId)
      .in('role', ['Closer', 'Setter-Closer'])
      .then(({ data }) => {
        if (data && data.length > 0) {
          setTeamClosers(data)
          if (!selectedMemberId) setSelectedMemberId(data[0].id)
        }
      })
  }, [isOwnerView, ownerUserId])

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

  // Helper: compute closer KPIs for a set of prospects
  const computeCloserKpis = (src: any[]) => {
    const won = src.filter((p: any) => p.stage === 'won')
    const noShow = src.filter((p: any) => p.stage === 'noshow')
    const lost = src.filter((p: any) => p.stage === 'lost')
    const revenue = won.reduce((sum: number, p: any) => sum + (p.value || 0), 0)
    const closedTotal = won.length + lost.length + noShow.length
    const conversionRate = closedTotal > 0 ? (won.length / closedTotal) * 100 : 0
    const noShowRate = closedTotal > 0 ? (noShow.length / closedTotal) * 100 : 0
    return { won, noShow, lost, revenue, closedTotal, conversionRate, noShowRate }
  }

  // Personal KPIs
  const myProspects = prospects.filter(p => p.assigned_to === teamMember?.id)
  const personal = computeCloserKpis(myProspects)
  const commission = Math.round(personal.revenue * (kpiConfig.commission_rate / 100))

  // Member prospects
  const memberProspects = useMemo(() => {
    if (!selectedMemberId) return []
    return prospects.filter(p => p.assigned_to === selectedMemberId)
  }, [prospects, selectedMemberId])

  const member = computeCloserKpis(memberProspects)
  const memberCommission = Math.round(member.revenue * (kpiConfig.commission_rate / 100))

  // Org KPIs (all prospects)
  const org = computeCloserKpis(prospects)
  const orgCommission = Math.round(org.revenue * (kpiConfig.commission_rate / 100))

  // Per-offer KPIs
  const offerProspects = useMemo(() => {
    if (!selectedOfferId) return []
    const base = isOwnerView ? prospects : myProspects
    return base.filter(p => (p as any).offer_id === selectedOfferId || (p as any).formula_id === selectedOfferId)
  }, [isOwnerView, myProspects, prospects, selectedOfferId])

  const offer = computeCloserKpis(offerProspects)
  const offerCommission = Math.round(offer.revenue * (kpiConfig.commission_rate / 100))

  // Chart data: group prospects by month
  const chartData = useMemo(() => {
    const source = activeTab === 'personal' ? myProspects : activeTab === 'org' ? prospects : activeTab === 'member' ? memberProspects : offerProspects
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
  }, [prospects, myProspects, offerProspects, memberProspects, activeTab, kpiConfig.commission_rate])

  // Current tab values
  const getTabValues = () => {
    if (activeTab === 'org') {
      return {
        revenue: org.revenue, sales: org.won.length, conversion: org.conversionRate,
        commission: orgCommission, noShowRate: org.noShowRate, lost: org.lost.length,
        leads: prospects.length, deals: prospects.filter(p => !['won', 'lost', 'noshow'].includes(p.stage)).length,
      }
    }
    if (activeTab === 'offer') {
      return {
        revenue: offer.revenue, sales: offer.won.length, conversion: offer.conversionRate,
        commission: offerCommission, noShowRate: offer.noShowRate, lost: offer.lost.length,
        leads: offerProspects.length, deals: offerProspects.filter(p => !['won', 'lost', 'noshow'].includes(p.stage)).length,
      }
    }
    if (activeTab === 'member') {
      return {
        revenue: member.revenue, sales: member.won.length, conversion: member.conversionRate,
        commission: memberCommission, noShowRate: member.noShowRate, lost: member.lost.length,
        leads: memberProspects.length, deals: memberProspects.filter(p => !['won', 'lost', 'noshow'].includes(p.stage)).length,
      }
    }
    return {
      revenue: personal.revenue, sales: personal.won.length, conversion: personal.conversionRate,
      commission, noShowRate: personal.noShowRate, lost: personal.lost.length,
      leads: myProspects.length, deals: myProspects.filter(p => !['won', 'lost', 'noshow'].includes(p.stage)).length,
    }
  }

  const v = getTabValues()
  const avgCommission = v.sales > 0 ? Math.round(v.commission / v.sales) : 0

  const inputCls = "w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"

  // Tabs definition
  const tabs = isOwnerView
    ? [
        { key: 'org' as const, label: 'Organisation' },
        { key: 'offer' as const, label: 'Par Offre' },
        { key: 'member' as const, label: 'Membre' },
      ]
    : [
        { key: 'personal' as const, label: 'Global (Personnel)' },
        { key: 'org' as const, label: 'Organisation' },
        { key: 'offer' as const, label: 'Par Offre' },
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
            <h1 className="text-lg font-bold text-slate-900">Performance Closer</h1>
            <p className="text-xs text-slate-500">{isOwnerView ? "Vue d'ensemble de l'équipe" : 'Vos indicateurs de performance'}</p>
          </div>
        </div>
        {!isOwnerView && (
          <button
            onClick={() => setIsConfigOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Settings className="h-4 w-4" /> Configurer
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-medium transition-all',
              activeTab === tab.key
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'org' && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <p className="text-sm text-amber-700 text-center">Vue en lecture seule des KPIs de l'organisation.</p>
        </div>
      )}

      {activeTab === 'offer' && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-amber-700">KPIs par offre/formule</p>
            <select
              value={selectedOfferId || ''}
              onChange={(e) => setSelectedOfferId(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white text-sm text-slate-900 px-3 py-1.5 focus:border-amber-500 focus:outline-none"
            >
              {formulas.length === 0 && <option value="">Aucune formule</option>}
              {formulas.map(f => (
                <option key={f.id} value={f.id}>{f.name} ({f.price}€)</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {activeTab === 'member' && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-amber-700">KPIs par membre (Closer)</p>
            <select
              value={selectedMemberId || ''}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white text-sm text-slate-900 px-3 py-1.5 focus:border-amber-500 focus:outline-none"
            >
              {teamClosers.length === 0 && <option value="">Aucun closer</option>}
              {teamClosers.map(c => (
                <option key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.role})</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard title="CA Généré" value={`${formatCurrency(v.revenue)} €`} icon={DollarSign} color="emerald" />
        <KpiCard title="Ventes Totales" value={v.sales} icon={ShoppingCart} color="blue" />
        <KpiCard title="Taux de Conversion" value={`${formatPercent(v.conversion)}%`} icon={Target} color="purple" />
        <KpiCard title={isOwnerView ? 'Commissions' : 'Mes Commissions'} value={`${formatCurrency(v.commission)} €`} icon={Award} color="amber" highlight />
        <KpiCard title="Taux de No Show" value={`${formatPercent(v.noShowRate)}%`} icon={UserX} color="rose" />
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
                  <linearGradient id="colorClosingBiz" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d97706" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} unit="%" />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', color: '#0f172a' }} />
                <Area type="monotone" dataKey="closing" stroke="#d97706" strokeWidth={2} fill="url(#colorClosingBiz)" />
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
                  <linearGradient id="colorCommissionBiz" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} unit="€" />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', color: '#0f172a' }} />
                <Area type="monotone" dataKey="commission" stroke="#10b981" strokeWidth={2} fill="url(#colorCommissionBiz)" />
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

      {/* Config Modal (team members only) */}
      {isConfigOpen && !isOwnerView && (
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
                className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 transition-colors"
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

const KpiCard = ({ title, value, icon: Icon, color, highlight }: any) => {
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
