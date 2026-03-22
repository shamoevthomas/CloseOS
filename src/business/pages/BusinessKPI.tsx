import { useState, useMemo } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  DollarSign,
  ShoppingCart,
  Target,
  Activity,
  UserX,
  XCircle,
  Users,
  Award,
  Ban,
  Briefcase,
  ArrowLeft,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useBusinessProspects } from '../contexts/BusinessProspectsContext'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { supabase } from '../../lib/supabase'
import { useEffect } from 'react'

// ============================================================================
// HELPERS
// ============================================================================

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

interface TeamMember {
  id: string
  user_id: string
  first_name: string
  last_name: string
  full_name: string
  email: string
  role: string
}

// ============================================================================
// KPI CARD
// ============================================================================

function KpiCard({
  title, value, subtitle, icon: Icon, color, badge,
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: any
  color: string
  badge?: { label: string; positive: boolean } | null
}) {
  const colorMap: Record<string, { bg: string; icon: string; text: string }> = {
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', text: 'text-emerald-700' },
    blue: { bg: 'bg-blue-50', icon: 'text-blue-600', text: 'text-blue-700' },
    purple: { bg: 'bg-purple-50', icon: 'text-purple-600', text: 'text-purple-700' },
    cyan: { bg: 'bg-cyan-50', icon: 'text-cyan-600', text: 'text-cyan-700' },
    rose: { bg: 'bg-rose-50', icon: 'text-rose-600', text: 'text-rose-700' },
    slate: { bg: 'bg-slate-50', icon: 'text-slate-600', text: 'text-slate-700' },
  }
  const c = colorMap[color] || colorMap.slate

  return (
    <div className="bg-white rounded-2xl p-8 shadow-[0_20px_40px_rgba(27,28,27,0.04)] hover:shadow-xl transition-all border border-stone-100/50">
      <div className="flex items-center justify-between mb-6">
        <span className="text-xs font-bold tracking-widest uppercase text-stone-500">{title}</span>
        <Icon className={`h-5 w-5 ${c.icon}`} />
      </div>
      <div className="flex items-baseline gap-2">
        <p className="text-4xl font-extrabold tracking-tighter text-stone-900">{value}</p>
        {badge && (
          <span className={`text-sm font-bold ${
            badge.positive ? 'text-emerald-600' : 'text-red-500'
          }`}>
            {badge.positive ? '+' : '-'}{badge.label}
          </span>
        )}
      </div>
      {subtitle && <p className="text-xs text-stone-400 mt-2">{subtitle}</p>}
    </div>
  )
}

// ============================================================================
// COMPUTE KPIs FROM PROSPECTS
// ============================================================================

function computeKpis(prospects: any[]) {
  const won = prospects.filter(p => p.stage === 'won')
  const lost = prospects.filter(p => p.stage === 'lost')
  const noshow = prospects.filter(p => p.stage === 'noshow')
  const active = prospects.filter(p => ['prospect', 'qualified', 'followup'].includes(p.stage))
  const totalDecided = won.length + lost.length + noshow.length

  const caGenere = won.reduce((sum, p) => sum + (p.value || 0), 0)
  const ventesTotales = won.length
  const tauxConversion = totalDecided > 0 ? (won.length / totalDecided) * 100 : 0
  const prospectsActifs = active.length
  const tauxNoShow = prospects.length > 0 ? (noshow.length / prospects.length) * 100 : 0
  const dealsPerdu = lost.length

  return {
    caGenere,
    ventesTotales,
    tauxConversion,
    prospectsActifs,
    tauxNoShow,
    dealsPerdu,
    totalLeads: prospects.length,
    dealsEnCours: active.length,
    valeurMoyenne: ventesTotales > 0 ? caGenere / ventesTotales : 0,
  }
}

// ============================================================================
// TABS
// ============================================================================

type Tab = 'global' | 'period' | 'team'

const TABS: { key: Tab; label: string }[] = [
  { key: 'global', label: 'Global' },
  { key: 'period', label: 'Par Période' },
  { key: 'team', label: 'Par Membre' },
]

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function BusinessKPI() {
  const { prospects } = useBusinessProspects()
  const { user, ownerUserId } = useBusinessAuth()
  const effectiveUserId = ownerUserId || user?.id
  const [activeTab, setActiveTab] = useState<Tab>('global')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)

  // Fetch team members
  useEffect(() => {
    if (!effectiveUserId) return
    supabase
      .from('business_team_members')
      .select('id, user_id, first_name, last_name, email, role')
      .eq('business_owner_id', effectiveUserId)
      .then(({ data }) => {
        setTeamMembers((data || []).map(m => ({
          ...m,
          full_name: `${m.first_name} ${m.last_name}`.trim(),
        })))
      })
  }, [effectiveUserId])

  // ---- GLOBAL KPIs ----
  const globalKpis = useMemo(() => computeKpis(prospects), [prospects])

  // ---- MONTHLY DATA for charts ----
  const monthlyData = useMemo(() => {
    const months: Record<string, { month: string; ca: number; won: number; total: number }> = {}
    const now = new Date()

    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      months[key] = {
        month: `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`,
        ca: 0, won: 0, total: 0,
      }
    }

    prospects.forEach(p => {
      const d = p.created_at ? new Date(p.created_at) : null
      if (!d) return
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (months[key]) {
        months[key].total++
        if (p.stage === 'won') {
          months[key].won++
          months[key].ca += p.value || 0
        }
      }
    })

    return Object.values(months).map(m => ({
      ...m,
      closing: m.total > 0 ? Math.round((m.won / m.total) * 100) : 0,
    }))
  }, [prospects])

  // ---- PERIOD KPIs ----
  const periodProspects = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    return prospects.filter(p => {
      if (!p.created_at) return false
      const d = new Date(p.created_at)
      return d.getFullYear() === year && d.getMonth() === month
    })
  }, [prospects, currentDate])

  const periodKpis = useMemo(() => computeKpis(periodProspects), [periodProspects])

  // Previous month for comparison
  const prevPeriodKpis = useMemo(() => {
    const prevDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
    const year = prevDate.getFullYear()
    const month = prevDate.getMonth()
    const prev = prospects.filter(p => {
      if (!p.created_at) return false
      const d = new Date(p.created_at)
      return d.getFullYear() === year && d.getMonth() === month
    })
    return computeKpis(prev)
  }, [prospects, currentDate])

  function compareBadge(current: number, previous: number) {
    if (previous === 0) return null
    const diff = ((current - previous) / previous) * 100
    if (Math.abs(diff) < 0.5) return null
    return { label: `${Math.abs(Math.round(diff))}%`, positive: diff > 0 }
  }

  // ---- Period bar chart data ----
  const periodBarData = useMemo(() => {
    const stages: Record<string, number> = {
      prospect: 0, qualified: 0, unqualified: 0, followup: 0, won: 0, noanswer: 0, lost: 0, noshow: 0,
    }
    periodProspects.forEach(p => {
      if (stages[p.stage] !== undefined) stages[p.stage]++
    })
    return Object.entries(stages).map(([stage, count]) => ({
      stage: stage === 'followup' ? 'Follow-up' : stage === 'noshow' ? 'No Show' : stage === 'unqualified' ? 'Non-Qualifié' : stage === 'noanswer' ? 'Pas de Réponse' : stage.charAt(0).toUpperCase() + stage.slice(1),
      count,
    }))
  }, [periodProspects])

  const navigateMonth = (dir: -1 | 1) => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + dir, 1))
  }

  // ---- RENDER KPI CARDS ----
  function renderKpiCards(
    kpis: ReturnType<typeof computeKpis>,
    badges?: {
      ca?: { label: string; positive: boolean } | null
      ventes?: { label: string; positive: boolean } | null
      conversion?: { label: string; positive: boolean } | null
      actifs?: { label: string; positive: boolean } | null
      noshow?: { label: string; positive: boolean } | null
      perdus?: { label: string; positive: boolean } | null
    },
  ) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          title="CA Généré"
          value={formatCurrency(kpis.caGenere)}
          icon={DollarSign}
          color="emerald"
          badge={badges?.ca}
        />
        <KpiCard
          title="Ventes Totales"
          value={kpis.ventesTotales}
          icon={ShoppingCart}
          color="blue"
          badge={badges?.ventes}
        />
        <KpiCard
          title="Taux de Conversion"
          value={`${kpis.tauxConversion.toFixed(1)}%`}
          icon={Target}
          color="purple"
          badge={badges?.conversion}
        />
        <KpiCard
          title="Prospects Actifs"
          value={kpis.prospectsActifs}
          icon={Activity}
          color="cyan"
          badge={badges?.actifs}
        />
        <KpiCard
          title="Taux de No Show"
          value={`${kpis.tauxNoShow.toFixed(1)}%`}
          icon={UserX}
          color="rose"
          badge={badges?.noshow}
        />
        <KpiCard
          title="Deals Perdus"
          value={kpis.dealsPerdu}
          icon={XCircle}
          color="slate"
          badge={badges?.perdus}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex p-1.5 bg-stone-100 rounded-full w-fit">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-8 py-2.5 rounded-full text-sm font-bold transition-all ${
              activeTab === tab.key
                ? 'bg-white text-stone-900 shadow-[0_20px_40px_rgba(27,28,27,0.04)]'
                : 'text-stone-500 hover:text-stone-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ============ GLOBAL TAB ============ */}
      {activeTab === 'global' && (
        <div className="space-y-6">
          {renderKpiCards(globalKpis)}

          {/* Pipeline Summary */}
          <div className="bg-stone-900 rounded-2xl p-10 shadow-[0_20px_40px_rgba(27,28,27,0.04)] flex flex-wrap justify-between items-center gap-8">
            <div className="flex items-center gap-6">
              <div className="p-4 bg-white/5 rounded-full">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Total Leads</p>
                <p className="text-2xl font-extrabold text-white">{globalKpis.totalLeads}</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="p-4 bg-white/5 rounded-full">
                <Briefcase className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Deals en Cours</p>
                <p className="text-2xl font-extrabold text-white">{globalKpis.dealsEnCours}</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="p-4 bg-white/5 rounded-full">
                <Award className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Valeur Moyenne</p>
                <p className="text-2xl font-extrabold text-white">{formatCurrency(globalKpis.valeurMoyenne)}</p>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Closing Rate Chart */}
            <div className="bg-white rounded-2xl p-8 shadow-[0_20px_40px_rgba(27,28,27,0.04)] border border-stone-100/50">
              <h3 className="text-xl font-extrabold text-stone-900 mb-8">Historique Taux de Closing</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData}>
                    <defs>
                      <linearGradient id="closingGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1c1917" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#1c1917" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#78716c' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#78716c' }} unit="%" />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid #e7e5e4', fontSize: 12 }}
                      formatter={(v: number) => [`${v}%`, 'Taux de closing']}
                    />
                    <Area
                      type="monotone"
                      dataKey="closing"
                      stroke="#1c1917"
                      strokeWidth={2}
                      fill="url(#closingGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* CA Chart */}
            <div className="bg-white rounded-2xl p-8 shadow-[0_20px_40px_rgba(27,28,27,0.04)] border border-stone-100/50">
              <h3 className="text-xl font-extrabold text-stone-900 mb-8">Historique CA par Mois</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData}>
                    <defs>
                      <linearGradient id="caGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#78716c' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#78716c' }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid #e7e5e4', fontSize: 12 }}
                      formatter={(v: number) => [formatCurrency(v), 'CA']}
                    />
                    <Area
                      type="monotone"
                      dataKey="ca"
                      stroke="#059669"
                      strokeWidth={2}
                      fill="url(#caGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ PERIOD TAB ============ */}
      {activeTab === 'period' && (
        <div className="space-y-6">
          {/* Month Navigation */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => navigateMonth(-1)}
              className="p-2 rounded-lg bg-white border border-stone-200 hover:bg-stone-50 transition-colors"
            >
              <ChevronLeft className="h-5 w-5 text-stone-900" />
            </button>
            <h2 className="text-lg font-semibold text-stone-900 min-w-[180px] text-center">
              {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <button
              onClick={() => navigateMonth(1)}
              className="p-2 rounded-lg bg-white border border-stone-200 hover:bg-stone-50 transition-colors"
            >
              <ChevronRight className="h-5 w-5 text-stone-900" />
            </button>
          </div>

          {renderKpiCards(periodKpis, {
            ca: compareBadge(periodKpis.caGenere, prevPeriodKpis.caGenere),
            ventes: compareBadge(periodKpis.ventesTotales, prevPeriodKpis.ventesTotales),
            conversion: compareBadge(periodKpis.tauxConversion, prevPeriodKpis.tauxConversion),
            actifs: compareBadge(periodKpis.prospectsActifs, prevPeriodKpis.prospectsActifs),
            noshow: prevPeriodKpis.tauxNoShow > 0
              ? { label: `${Math.abs(Math.round(((periodKpis.tauxNoShow - prevPeriodKpis.tauxNoShow) / prevPeriodKpis.tauxNoShow) * 100))}%`, positive: periodKpis.tauxNoShow < prevPeriodKpis.tauxNoShow }
              : null,
            perdus: prevPeriodKpis.dealsPerdu > 0
              ? { label: `${Math.abs(Math.round(((periodKpis.dealsPerdu - prevPeriodKpis.dealsPerdu) / prevPeriodKpis.dealsPerdu) * 100))}%`, positive: periodKpis.dealsPerdu < prevPeriodKpis.dealsPerdu }
              : null,
          })}

          {/* Period Bar Chart */}
          <div className="bg-white rounded-2xl p-8 shadow-[0_20px_40px_rgba(27,28,27,0.04)] border border-stone-100/50">
            <h3 className="text-xl font-extrabold text-stone-900 mb-8">
              Répartition par Stage — {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={periodBarData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis dataKey="stage" tick={{ fontSize: 11, fill: '#78716c' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#78716c' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #e7e5e4', fontSize: 12 }}
                  />
                  <Bar dataKey="count" fill="#1c1917" radius={[6, 6, 0, 0]} name="Prospects" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ============ TEAM TAB ============ */}
      {activeTab === 'team' && !selectedMemberId && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-[0_20px_40px_rgba(27,28,27,0.04)] border border-stone-100/50 overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100">
              <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
                <Users className="h-4 w-4 text-stone-600" />
                Performance par Membre
              </h3>
              <p className="text-xs text-stone-400 mt-1">
                Cliquez sur un membre pour voir ses KPIs détaillés.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-50/50">
                    <th className="text-left px-5 py-3 font-medium text-stone-500">Nom</th>
                    <th className="text-left px-5 py-3 font-medium text-stone-500">Rôle</th>
                    <th className="text-center px-5 py-3 font-medium text-stone-500">Prospects</th>
                    <th className="text-center px-5 py-3 font-medium text-stone-500">Ventes</th>
                    <th className="text-center px-5 py-3 font-medium text-stone-500">CA</th>
                    <th className="text-center px-5 py-3 font-medium text-stone-500">Taux Conv.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {/* Owner row */}
                  <tr className="hover:bg-stone-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-stone-900">
                      Vous (Owner)
                    </td>
                    <td className="px-5 py-3 text-stone-400">Owner</td>
                    <td className="px-5 py-3 text-center text-stone-900">{globalKpis.totalLeads}</td>
                    <td className="px-5 py-3 text-center text-stone-900">{globalKpis.ventesTotales}</td>
                    <td className="px-5 py-3 text-center text-emerald-700 font-medium">{formatCurrency(globalKpis.caGenere)}</td>
                    <td className="px-5 py-3 text-center text-purple-700 font-medium">{globalKpis.tauxConversion.toFixed(1)}%</td>
                  </tr>

                  {/* Team members */}
                  {teamMembers.map(member => {
                    const memberProspects = prospects.filter(p => p.assigned_to === member.id)
                    const memberWon = memberProspects.filter(p => p.stage === 'won')
                    const memberLost = memberProspects.filter(p => p.stage === 'lost')
                    const memberNoshow = memberProspects.filter(p => p.stage === 'noshow')
                    const memberCA = memberWon.reduce((s, p) => s + (p.value || 0), 0)
                    const memberDecided = memberWon.length + memberLost.length + memberNoshow.length
                    const memberConv = memberDecided > 0 ? (memberWon.length / memberDecided) * 100 : 0

                    return (
                      <tr
                        key={member.id}
                        onClick={() => setSelectedMemberId(member.id)}
                        className="hover:bg-stone-50 transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-3 font-medium text-stone-900">
                          <span className="hover:text-stone-600 transition-colors">{member.full_name}</span>
                        </td>
                        <td className="px-5 py-3 text-stone-400 capitalize">{member.role}</td>
                        <td className="px-5 py-3 text-center text-stone-900">{memberProspects.length}</td>
                        <td className="px-5 py-3 text-center text-stone-900">{memberWon.length}</td>
                        <td className="px-5 py-3 text-center text-emerald-700 font-medium">{formatCurrency(memberCA)}</td>
                        <td className="px-5 py-3 text-center text-purple-700 font-medium">{memberConv.toFixed(1)}%</td>
                      </tr>
                    )
                  })}

                  {teamMembers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-stone-900/40 text-sm">
                        Aucun membre dans l'équipe. Invitez des membres depuis la page Équipe.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============ TEAM TAB - MEMBER DETAIL ============ */}
      {activeTab === 'team' && selectedMemberId && (() => {
        const member = teamMembers.find(m => m.id === selectedMemberId)
        if (!member) return null

        const memberProspects = prospects.filter(p => p.assigned_to === selectedMemberId)
        const mWon = memberProspects.filter(p => p.stage === 'won')
        const mLost = memberProspects.filter(p => p.stage === 'lost')
        const mNoshow = memberProspects.filter(p => p.stage === 'noshow')
        const mActive = memberProspects.filter(p => ['prospect', 'qualified', 'followup'].includes(p.stage))
        const mRevenue = mWon.reduce((s, p) => s + (p.value || 0), 0)
        const mDecided = mWon.length + mLost.length + mNoshow.length
        const mConversion = mDecided > 0 ? (mWon.length / mDecided) * 100 : 0
        const mNoShowRate = mDecided > 0 ? (mNoshow.length / mDecided) * 100 : 0
        const mCommission = Math.round(mRevenue * 0.10)
        const mAvgCommission = mWon.length > 0 ? Math.round(mCommission / mWon.length) : 0

        // Chart data
        const mChartData = (() => {
          const monthMap: Record<string, { won: number; total: number; commission: number }> = {}
          memberProspects.forEach(p => {
            const d = p.created_at ? new Date(p.created_at) : null
            if (!d) return
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            if (!monthMap[key]) monthMap[key] = { won: 0, total: 0, commission: 0 }
            monthMap[key].total++
            if (p.stage === 'won') {
              monthMap[key].won++
              monthMap[key].commission += Math.round((p.value || 0) * 0.10)
            }
          })
          return Object.entries(monthMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, val]) => ({
              name: key,
              closing: val.total > 0 ? Math.round((val.won / val.total) * 100) : 0,
              commission: val.commission,
            }))
        })()

        return (
          <div className="space-y-6">
            {/* Back button */}
            <button
              onClick={() => setSelectedMemberId(null)}
              className="flex items-center gap-2 text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour à la liste
            </button>

            {/* Member header */}
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-stone-100">
                <Users className="h-6 w-6 text-stone-700" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">{member.full_name}</h2>
                <p className="text-sm text-slate-500 capitalize">{member.role}</p>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <KpiCard title="CA Généré" value={formatCurrency(mRevenue)} icon={DollarSign} color="emerald" />
              <KpiCard title="Ventes Totales" value={mWon.length} icon={ShoppingCart} color="blue" />
              <KpiCard title="Taux de Conversion" value={`${mConversion.toFixed(1)}%`} icon={Target} color="purple" />
              <KpiCard title="Commission (10%)" value={formatCurrency(mCommission)} icon={Award} color="cyan" />
              <KpiCard title="Taux de No Show" value={`${mNoShowRate.toFixed(1)}%`} icon={UserX} color="rose" />
              <KpiCard title="Deals Perdus" value={mLost.length} icon={XCircle} color="slate" />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl p-8 shadow-[0_20px_40px_rgba(27,28,27,0.04)] border border-stone-100/50">
                <h3 className="text-xl font-extrabold text-stone-900 mb-8">Historique Taux de Closing</h3>
                <div className="h-64">
                  {mChartData.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-sm text-slate-400">Pas encore de données</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={mChartData}>
                        <defs>
                          <linearGradient id="memberClosingGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#1c1917" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#1c1917" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#78716c' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#78716c' }} unit="%" />
                        <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e7e5e4', fontSize: 12 }} formatter={(v: number) => [`${v}%`, 'Closing']} />
                        <Area type="monotone" dataKey="closing" stroke="#1c1917" strokeWidth={2} fill="url(#memberClosingGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl p-8 shadow-[0_20px_40px_rgba(27,28,27,0.04)] border border-stone-100/50">
                <h3 className="text-xl font-extrabold text-stone-900 mb-8">Historique Commissions</h3>
                <div className="h-64">
                  {mChartData.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-sm text-slate-400">Pas encore de données</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={mChartData}>
                        <defs>
                          <linearGradient id="memberCommGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#78716c' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#78716c' }} unit="€" />
                        <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e7e5e4', fontSize: 12 }} formatter={(v: number) => [`${formatCurrency(v)} €`, 'Commission']} />
                        <Area type="monotone" dataKey="commission" stroke="#059669" strokeWidth={2} fill="url(#memberCommGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            {/* Pipeline Summary */}
            <div className="bg-stone-900 rounded-2xl p-10 shadow-[0_20px_40px_rgba(27,28,27,0.04)] flex flex-wrap justify-between items-center gap-8">
              <div className="flex items-center gap-6">
                <div className="p-4 bg-white/5 rounded-full">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Total Leads</p>
                  <p className="text-2xl font-extrabold text-white">{memberProspects.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="p-4 bg-white/5 rounded-full">
                  <Briefcase className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Deals en Cours</p>
                  <p className="text-2xl font-extrabold text-white">{mActive.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="p-4 bg-white/5 rounded-full">
                  <Award className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Com. Moyenne</p>
                  <p className="text-2xl font-extrabold text-white">{formatCurrency(mAvgCommission)}</p>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
