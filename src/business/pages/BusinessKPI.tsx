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
    <div className="bg-white rounded-xl border border-[#493627]/10 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-[#493627]/70">{title}</span>
        <div className={`${c.bg} p-2 rounded-lg`}>
          <Icon className={`h-4 w-4 ${c.icon}`} />
        </div>
      </div>
      <div className="flex items-end gap-2">
        <p className={`text-2xl font-bold ${c.text}`}>{value}</p>
        {badge && (
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full mb-1 ${
            badge.positive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
          }`}>
            {badge.positive ? '↑' : '↓'} {badge.label}
          </span>
        )}
      </div>
      {subtitle && <p className="text-xs text-[#493627]/50 mt-1">{subtitle}</p>}
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
  const { user } = useBusinessAuth()
  const [activeTab, setActiveTab] = useState<Tab>('global')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)

  // Fetch team members
  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('business_team_members')
      .select('id, user_id, first_name, last_name, email, role')
      .eq('business_owner_id', user.id)
      .then(({ data }) => {
        setTeamMembers((data || []).map(m => ({
          ...m,
          full_name: `${m.first_name} ${m.last_name}`.trim(),
        })))
      })
  }, [user?.id])

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
      prospect: 0, qualified: 0, unqualified: 0, followup: 0, won: 0, lost: 0, noshow: 0,
    }
    periodProspects.forEach(p => {
      if (stages[p.stage] !== undefined) stages[p.stage]++
    })
    return Object.entries(stages).map(([stage, count]) => ({
      stage: stage === 'followup' ? 'Follow-up' : stage === 'noshow' ? 'No Show' : stage === 'unqualified' ? 'Non-Qualifié' : stage.charAt(0).toUpperCase() + stage.slice(1),
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
      <div className="flex gap-1 bg-white rounded-xl border border-[#493627]/10 p-1 w-fit">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-[#493627]/70 hover:bg-amber-50'
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

          {/* Summary */}
          <div className="bg-white rounded-xl border border-[#493627]/10 p-5">
            <h3 className="text-sm font-semibold text-[#493627] mb-3">Résumé</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="text-center p-3 bg-amber-50 rounded-lg">
                <p className="text-2xl font-bold text-[#493627]">{globalKpis.totalLeads}</p>
                <p className="text-xs text-[#493627]/60">Total Leads</p>
              </div>
              <div className="text-center p-3 bg-amber-50 rounded-lg">
                <p className="text-2xl font-bold text-[#493627]">{globalKpis.dealsEnCours}</p>
                <p className="text-xs text-[#493627]/60">Deals en Cours</p>
              </div>
              <div className="text-center p-3 bg-amber-50 rounded-lg">
                <p className="text-2xl font-bold text-[#493627]">{formatCurrency(globalKpis.valeurMoyenne)}</p>
                <p className="text-xs text-[#493627]/60">Valeur Moyenne par Deal</p>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Closing Rate Chart */}
            <div className="bg-white rounded-xl border border-[#493627]/10 p-5">
              <h3 className="text-sm font-semibold text-[#493627] mb-4">Historique Taux de Closing</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData}>
                    <defs>
                      <linearGradient id="closingGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#d97706" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe4" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#493627' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#493627' }} unit="%" />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid #e5d5c3', fontSize: 12 }}
                      formatter={(v: number) => [`${v}%`, 'Taux de closing']}
                    />
                    <Area
                      type="monotone"
                      dataKey="closing"
                      stroke="#d97706"
                      strokeWidth={2}
                      fill="url(#closingGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* CA Chart */}
            <div className="bg-white rounded-xl border border-[#493627]/10 p-5">
              <h3 className="text-sm font-semibold text-[#493627] mb-4">Historique CA par Mois</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData}>
                    <defs>
                      <linearGradient id="caGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe4" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#493627' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#493627' }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid #e5d5c3', fontSize: 12 }}
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
              className="p-2 rounded-lg bg-white border border-[#493627]/10 hover:bg-amber-50 transition-colors"
            >
              <ChevronLeft className="h-5 w-5 text-[#493627]" />
            </button>
            <h2 className="text-lg font-semibold text-[#493627] min-w-[180px] text-center">
              {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <button
              onClick={() => navigateMonth(1)}
              className="p-2 rounded-lg bg-white border border-[#493627]/10 hover:bg-amber-50 transition-colors"
            >
              <ChevronRight className="h-5 w-5 text-[#493627]" />
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
          <div className="bg-white rounded-xl border border-[#493627]/10 p-5">
            <h3 className="text-sm font-semibold text-[#493627] mb-4">
              Répartition par Stage — {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={periodBarData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe4" />
                  <XAxis dataKey="stage" tick={{ fontSize: 11, fill: '#493627' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#493627' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #e5d5c3', fontSize: 12 }}
                  />
                  <Bar dataKey="count" fill="#d97706" radius={[6, 6, 0, 0]} name="Prospects" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ============ TEAM TAB ============ */}
      {activeTab === 'team' && !selectedMemberId && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-[#493627]/10 overflow-hidden">
            <div className="px-5 py-4 border-b border-[#493627]/10">
              <h3 className="text-sm font-semibold text-[#493627] flex items-center gap-2">
                <Users className="h-4 w-4 text-amber-600" />
                Performance par Membre
              </h3>
              <p className="text-xs text-[#493627]/50 mt-1">
                Cliquez sur un membre pour voir ses KPIs détaillés.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-amber-50/50">
                    <th className="text-left px-5 py-3 font-medium text-[#493627]/70">Nom</th>
                    <th className="text-left px-5 py-3 font-medium text-[#493627]/70">Rôle</th>
                    <th className="text-center px-5 py-3 font-medium text-[#493627]/70">Prospects</th>
                    <th className="text-center px-5 py-3 font-medium text-[#493627]/70">Ventes</th>
                    <th className="text-center px-5 py-3 font-medium text-[#493627]/70">CA</th>
                    <th className="text-center px-5 py-3 font-medium text-[#493627]/70">Taux Conv.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#493627]/5">
                  {/* Owner row */}
                  <tr className="hover:bg-amber-50/30 transition-colors">
                    <td className="px-5 py-3 font-medium text-[#493627]">
                      Vous (Owner)
                    </td>
                    <td className="px-5 py-3 text-[#493627]/60">Owner</td>
                    <td className="px-5 py-3 text-center text-[#493627]">{globalKpis.totalLeads}</td>
                    <td className="px-5 py-3 text-center text-[#493627]">{globalKpis.ventesTotales}</td>
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
                        className="hover:bg-amber-50/30 transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-3 font-medium text-[#493627]">
                          <span className="hover:text-amber-600 transition-colors">{member.full_name}</span>
                        </td>
                        <td className="px-5 py-3 text-[#493627]/60 capitalize">{member.role}</td>
                        <td className="px-5 py-3 text-center text-[#493627]">{memberProspects.length}</td>
                        <td className="px-5 py-3 text-center text-[#493627]">{memberWon.length}</td>
                        <td className="px-5 py-3 text-center text-emerald-700 font-medium">{formatCurrency(memberCA)}</td>
                        <td className="px-5 py-3 text-center text-purple-700 font-medium">{memberConv.toFixed(1)}%</td>
                      </tr>
                    )
                  })}

                  {teamMembers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-[#493627]/40 text-sm">
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
              className="flex items-center gap-2 text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour à la liste
            </button>

            {/* Member header */}
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100">
                <Users className="h-6 w-6 text-amber-700" />
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
              <div className="bg-white rounded-xl border border-[#493627]/10 p-5">
                <h3 className="text-sm font-semibold text-[#493627] mb-4">Historique Taux de Closing</h3>
                <div className="h-64">
                  {mChartData.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-sm text-slate-400">Pas encore de données</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={mChartData}>
                        <defs>
                          <linearGradient id="memberClosingGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#d97706" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe4" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#493627' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#493627' }} unit="%" />
                        <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5d5c3', fontSize: 12 }} formatter={(v: number) => [`${v}%`, 'Closing']} />
                        <Area type="monotone" dataKey="closing" stroke="#d97706" strokeWidth={2} fill="url(#memberClosingGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-[#493627]/10 p-5">
                <h3 className="text-sm font-semibold text-[#493627] mb-4">Historique Commissions</h3>
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
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe4" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#493627' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#493627' }} unit="€" />
                        <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5d5c3', fontSize: 12 }} formatter={(v: number) => [`${formatCurrency(v)} €`, 'Commission']} />
                        <Area type="monotone" dataKey="commission" stroke="#059669" strokeWidth={2} fill="url(#memberCommGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            {/* Pipeline Summary */}
            <div className="bg-white rounded-xl border border-[#493627]/10 p-5">
              <h3 className="text-sm font-semibold text-[#493627] mb-4">Résumé du Pipeline</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">Total Leads</p>
                    <p className="text-xl font-bold text-slate-900">{memberProspects.length}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">Deals en Cours</p>
                    <p className="text-xl font-bold text-slate-900">{mActive.length}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <Award className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">Commission Moy.</p>
                    <p className="text-xl font-bold text-slate-900">{formatCurrency(mAvgCommission)} €</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
