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
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useBusinessProspects } from '../contexts/BusinessProspectsContext'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessLang } from '../i18n/BusinessLangContext'
import { supabase } from '../../lib/supabase'
import { useEffect } from 'react'
import { getProspectCA } from '../lib/getProspectCA'

// ============================================================================
// HELPERS
// ============================================================================

// formatCurrency and MONTH_NAMES are now derived from t/lang inside the component

interface TeamMember {
  id: string
  user_id: string
  first_name: string
  last_name: string
  full_name: string
  email: string
  role: string
  team_id?: string | null
}

interface BusinessTeam {
  id: string
  name: string
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
    <div className="bg-white dark:bg-neutral-800 rounded-2xl p-8 shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)] hover:shadow-xl transition-all border border-stone-100/50 dark:border-neutral-700/50">
      <div className="flex items-center justify-between mb-6">
        <span className="text-xs font-bold tracking-widest uppercase text-stone-500 dark:text-neutral-400">{title}</span>
        <Icon className={`h-5 w-5 ${c.icon}`} />
      </div>
      <div className="flex items-baseline gap-2">
        <p className="text-4xl font-extrabold tracking-tighter text-stone-900 dark:text-white">{value}</p>
        {badge && (
          <span className={`text-sm font-bold ${
            badge.positive ? 'text-emerald-600' : 'text-red-500'
          }`}>
            {badge.positive ? '+' : '-'}{badge.label}
          </span>
        )}
      </div>
      {subtitle && <p className="text-xs text-stone-400 dark:text-neutral-500 mt-2">{subtitle}</p>}
    </div>
  )
}

// ============================================================================
// COMPUTE KPIs FROM PROSPECTS
// ============================================================================

function computeKpis(prospects: any[], formulaBillingTypes: Record<string, string>) {
  const won = prospects.filter(p => p.stage === 'won')
  const lost = prospects.filter(p => p.stage === 'lost')
  const noshow = prospects.filter(p => p.stage === 'noshow')
  const active = prospects.filter(p => ['prospect', 'qualified', 'followup'].includes(p.stage))
  // No-shows only count if they came from follow-up stage
  const noshowFromFollowup = noshow.filter(p => p.previous_stage === 'followup')
  const totalDecided = won.length + lost.length + noshowFromFollowup.length

  const caGenere = won.reduce((sum, p) => sum + getProspectCA(p, formulaBillingTypes), 0)
  const ventesTotales = won.length
  const tauxConversion = totalDecided > 0 ? (won.length / totalDecided) * 100 : 0
  const prospectsActifs = active.length
  const noshowEligible = prospects.filter(p => !['prospect', 'unqualified', 'noanswer'].includes(p.stage))
  const tauxNoShow = noshowEligible.length > 0 ? (noshow.length / noshowEligible.length) * 100 : 0
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
// LOSS REASON CHART HELPERS
// ============================================================================

const LOSS_REASON_COLORS: Record<string, string> = {
  'Je dois y réfléchir': '#6366f1',
  'Argent/budget': '#f59e0b',
  'Doit en parler': '#8b5cf6',
  "C'est pas le moment": '#64748b',
  'Peur': '#ef4444',
  'Ecran de fumée': '#f97316',
  'Autre': '#a1a1aa',
}
const LOSS_REASON_FALLBACK_COLOR = '#d4d4d8'

function computeLossReasonData(prospects: any[]) {
  const lost = prospects.filter(p => p.stage === 'lost')
  const counts: Record<string, number> = {}
  lost.forEach(p => {
    let reason = p.loss_reason
    if (!reason && Array.isArray(p.call_notes)) {
      for (let i = p.call_notes.length - 1; i >= 0; i--) {
        const match = p.call_notes[i].content?.match(/- Motif: (.+)/)
        if (match) { reason = match[1]; break }
      }
    }
    if (reason) counts[reason] = (counts[reason] || 0) + 1
  })
  return Object.entries(counts)
    .map(([name, value]) => ({ name, value, color: LOSS_REASON_COLORS[name] || LOSS_REASON_FALLBACK_COLOR }))
    .sort((a, b) => b.value - a.value)
}

// ============================================================================
// TABS
// ============================================================================

type Tab = 'global' | 'period' | 'team' | 'equipe' | 'personnel'

// BASE_TABS is now derived from t inside the component

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function BusinessKPI() {
  const { prospects } = useBusinessProspects()
  const { user, ownerUserId, teamMember, isTeamMember, isSolo } = useBusinessAuth()
  const { t, lang } = useBusinessLang()
  const MONTH_NAMES = useMemo(() => [
    t.kpi_month_jan, t.kpi_month_feb, t.kpi_month_mar, t.kpi_month_apr, t.kpi_month_may, t.kpi_month_jun,
    t.kpi_month_jul, t.kpi_month_aug, t.kpi_month_sep, t.kpi_month_oct, t.kpi_month_nov, t.kpi_month_dec,
  ], [t])
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }
  const effectiveUserId = ownerUserId || user?.id
  const isOwnerView = !isTeamMember || teamMember?.role === 'Head of Sales' || teamMember?.role === 'Admin'
  const [activeTab, setActiveTab] = useState<Tab>('global')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [teams, setTeams] = useState<BusinessTeam[]>([])
  const [globalMemberId, setGlobalMemberId] = useState<string | null>(null)
  const [formulaBillingTypes, setFormulaBillingTypes] = useState<Record<string, string>>({})

  // Fetch team members + teams + formula billing types
  useEffect(() => {
    if (!effectiveUserId) return
    supabase
      .from('business_team_members')
      .select('id, user_id, first_name, last_name, email, role, team_id')
      .eq('business_owner_id', effectiveUserId)
      .then(({ data }) => {
        setTeamMembers((data || []).map(m => ({
          ...m,
          full_name: `${m.first_name} ${m.last_name}`.trim(),
        })))
      })
      .catch(err => console.error('[BusinessKPI] Error loading team members:', err))
    supabase
      .from('business_teams')
      .select('id, name')
      .eq('business_owner_id', effectiveUserId)
      .order('position')
      .then(({ data }) => setTeams(data || []))
      .catch(err => console.error('[BusinessKPI] Error loading teams:', err))
    supabase
      .from('business_formulas')
      .select('id, billing_type')
      .eq('user_id', effectiveUserId)
      .then(({ data }) => {
        const map: Record<string, string> = {}
        ;(data || []).forEach(f => { map[f.id] = f.billing_type || 'one_time' })
        setFormulaBillingTypes(map)
      })
      .catch(err => console.error('[BusinessKPI] Error loading formula billing types:', err))
  }, [effectiveUserId])

  const TABS = useMemo(() => {
    const tabs: { key: Tab; label: string }[] = [
      { key: 'global', label: t.kpi_tab_global },
      { key: 'period', label: t.kpi_tab_period },
      { key: 'team', label: t.kpi_tab_member },
    ]
    if (teams.length > 0) tabs.push({ key: 'equipe', label: t.kpi_tab_team })
    if (isOwnerView) tabs.push({ key: 'personnel', label: t.kpi_tab_personal })
    return tabs
  }, [teams, t])

  // ---- FILTERED PROSPECTS (by global member selector) ----
  const filteredProspects = useMemo(() => {
    if (!globalMemberId) return prospects
    return prospects.filter(p => p.assigned_to === globalMemberId)
  }, [prospects, globalMemberId])

  // ---- GLOBAL KPIs ----
  const globalKpis = useMemo(() => computeKpis(filteredProspects, formulaBillingTypes), [filteredProspects, formulaBillingTypes])

  // ---- PERSONAL KPIs (owner's own prospects = not assigned to any team member) ----
  const personalProspects = useMemo(() => {
    const memberIds = new Set(teamMembers.map(m => m.id))
    return prospects.filter(p => !p.assigned_to || !memberIds.has(p.assigned_to))
  }, [prospects, teamMembers])
  const personalKpis = useMemo(() => computeKpis(personalProspects, formulaBillingTypes), [personalProspects, formulaBillingTypes])

  // ---- LOSS REASON DATA (for pie chart) ----
  const lossReasonData = useMemo(() => computeLossReasonData(filteredProspects), [filteredProspects])

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

    filteredProspects.forEach(p => {
      const d = p.created_at ? new Date(p.created_at) : null
      if (!d) return
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (months[key]) {
        months[key].total++
        if (p.stage === 'won') {
          months[key].won++
          months[key].ca += getProspectCA(p, formulaBillingTypes)
        }
      }
    })

    return Object.values(months).map(m => ({
      ...m,
      closing: m.total > 0 ? Math.round((m.won / m.total) * 100) : 0,
    }))
  }, [filteredProspects])

  // ---- PERIOD KPIs ----
  const periodProspects = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    return filteredProspects.filter(p => {
      if (!p.created_at) return false
      const d = new Date(p.created_at)
      return d.getFullYear() === year && d.getMonth() === month
    })
  }, [filteredProspects, currentDate])

  const periodKpis = useMemo(() => computeKpis(periodProspects, formulaBillingTypes), [periodProspects, formulaBillingTypes])

  // Previous month for comparison
  const prevPeriodKpis = useMemo(() => {
    const prevDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
    const year = prevDate.getFullYear()
    const month = prevDate.getMonth()
    const prev = filteredProspects.filter(p => {
      if (!p.created_at) return false
      const d = new Date(p.created_at)
      return d.getFullYear() === year && d.getMonth() === month
    })
    return computeKpis(prev, formulaBillingTypes)
  }, [filteredProspects, currentDate, formulaBillingTypes])

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
      stage: stage === 'followup' ? t.kpi_stage_followup : stage === 'noshow' ? t.kpi_stage_noshow : stage === 'unqualified' ? t.kpi_stage_unqualified : stage === 'noanswer' ? t.kpi_stage_noanswer : stage.charAt(0).toUpperCase() + stage.slice(1),
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
          title={t.kpi_ca_generated}
          value={formatCurrency(kpis.caGenere)}
          icon={DollarSign}
          color="emerald"
          badge={badges?.ca}
        />
        <KpiCard
          title={t.kpi_total_sales}
          value={kpis.ventesTotales}
          icon={ShoppingCart}
          color="blue"
          badge={badges?.ventes}
        />
        <KpiCard
          title={t.kpi_conversion_rate}
          value={`${kpis.tauxConversion.toFixed(1)}%`}
          icon={Target}
          color="purple"
          badge={badges?.conversion}
        />
        <KpiCard
          title={t.kpi_active_prospects}
          value={kpis.prospectsActifs}
          icon={Activity}
          color="cyan"
          badge={badges?.actifs}
        />
        <KpiCard
          title={t.kpi_noshow_rate}
          value={`${kpis.tauxNoShow.toFixed(1)}%`}
          icon={UserX}
          color="rose"
          badge={badges?.noshow}
        />
        <KpiCard
          title={t.kpi_deals_lost}
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
      {/* Tabs + Global Member Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex p-1.5 bg-stone-100 dark:bg-neutral-800 rounded-full w-fit">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-8 py-2.5 rounded-full text-sm font-bold transition-all ${
                activeTab === tab.key
                  ? 'bg-white dark:bg-neutral-700 text-stone-900 dark:text-white shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)]'
                  : 'text-stone-500 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {isOwnerView && !isSolo && teamMembers.length > 0 && (
          <div className="flex items-center gap-2 bg-white dark:bg-neutral-800 rounded-full border border-stone-200 dark:border-neutral-700 pl-3 pr-1 py-1 shadow-sm">
            <Users className="h-4 w-4 text-stone-400 shrink-0" />
            <select
              value={globalMemberId || ''}
              onChange={(e) => setGlobalMemberId(e.target.value || null)}
              className="bg-transparent text-sm font-semibold text-stone-900 dark:text-white pr-6 py-1.5 focus:outline-none appearance-none cursor-pointer"
            >
              <option value="">{t.kpi_all_members}</option>
              {teamMembers.map(m => (
                <option key={m.id} value={m.id}>{m.full_name} ({m.role})</option>
              ))}
            </select>
          </div>
        )}
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
                <p className="text-xs font-bold uppercase tracking-widest text-stone-400">{t.kpi_total_leads}</p>
                <p className="text-2xl font-extrabold text-white">{globalKpis.totalLeads}</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="p-4 bg-white/5 rounded-full">
                <Briefcase className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-stone-400">{t.kpi_deals_in_progress}</p>
                <p className="text-2xl font-extrabold text-white">{globalKpis.dealsEnCours}</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="p-4 bg-white/5 rounded-full">
                <Award className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-stone-400">{t.kpi_average_value}</p>
                <p className="text-2xl font-extrabold text-white">{formatCurrency(globalKpis.valeurMoyenne)}</p>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Closing Rate Chart */}
            <div className="bg-white dark:bg-neutral-800 rounded-2xl p-8 shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)] border border-stone-100/50 dark:border-neutral-700/50">
              <h3 className="text-xl font-extrabold text-stone-900 dark:text-white mb-8">{t.kpi_closing_rate_history}</h3>
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
                      formatter={(v: number) => [`${v}%`, t.kpi_closing_rate_tooltip]}
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
            <div className="bg-white dark:bg-neutral-800 rounded-2xl p-8 shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)] border border-stone-100/50 dark:border-neutral-700/50">
              <h3 className="text-xl font-extrabold text-stone-900 dark:text-white mb-8">{t.kpi_ca_history}</h3>
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

          {/* Loss Reason Pie Chart */}
          {lossReasonData.length > 0 && (
          <div className="bg-white dark:bg-neutral-800 rounded-2xl p-8 shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)] border border-stone-100/50 dark:border-neutral-700/50">
            <h3 className="text-xl font-extrabold text-stone-900 dark:text-white mb-8">{t.kpi_loss_reasons}</h3>
            <div className="flex flex-col lg:flex-row items-center gap-8">
              <div className="w-64 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={lossReasonData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
                      {lossReasonData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e7e5e4', fontSize: 12 }} formatter={(v: number) => [v, 'Deals']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-3">
                {lossReasonData.map(d => {
                  const total = lossReasonData.reduce((s, r) => s + r.value, 0)
                  return (
                    <div key={d.name} className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                        <span className="text-sm font-medium text-stone-700 dark:text-neutral-200">{d.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-stone-900 dark:text-white">{d.value}</span>
                        <span className="text-xs text-stone-400 dark:text-neutral-500 w-10 text-right">{total > 0 ? Math.round((d.value / total) * 100) : 0}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          )}
        </div>
      )}

      {/* ============ PERIOD TAB ============ */}
      {activeTab === 'period' && (
        <div className="space-y-6">
          {/* Month Navigation */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => navigateMonth(-1)}
              className="p-2 rounded-lg bg-white dark:bg-neutral-800 border border-stone-200 dark:border-neutral-700 hover:bg-stone-50 dark:hover:bg-neutral-700 transition-colors"
            >
              <ChevronLeft className="h-5 w-5 text-stone-900 dark:text-white" />
            </button>
            <h2 className="text-lg font-semibold text-stone-900 dark:text-white min-w-[180px] text-center">
              {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <button
              onClick={() => navigateMonth(1)}
              className="p-2 rounded-lg bg-white dark:bg-neutral-800 border border-stone-200 dark:border-neutral-700 hover:bg-stone-50 dark:hover:bg-neutral-700 transition-colors"
            >
              <ChevronRight className="h-5 w-5 text-stone-900 dark:text-white" />
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
          <div className="bg-white dark:bg-neutral-800 rounded-2xl p-8 shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)] border border-stone-100/50 dark:border-neutral-700/50">
            <h3 className="text-xl font-extrabold text-stone-900 dark:text-white mb-8">
              {t.kpi_stage_distribution} — {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
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

          {/* Period Loss Reason Pie Chart */}
          {(() => {
            const periodLossData = computeLossReasonData(periodProspects)
            if (periodLossData.length === 0) return null
            const total = periodLossData.reduce((s, r) => s + r.value, 0)
            return (
              <div className="bg-white dark:bg-neutral-800 rounded-2xl p-8 shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)] border border-stone-100/50 dark:border-neutral-700/50">
                <h3 className="text-xl font-extrabold text-stone-900 dark:text-white mb-8">{t.kpi_loss_reasons} — {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}</h3>
                <div className="flex flex-col lg:flex-row items-center gap-8">
                  <div className="w-64 h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={periodLossData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
                          {periodLossData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e7e5e4', fontSize: 12 }} formatter={(v: number) => [v, 'Deals']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-3">
                    {periodLossData.map(d => (
                      <div key={d.name} className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                          <span className="text-sm font-medium text-stone-700 dark:text-neutral-200">{d.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-stone-900 dark:text-white">{d.value}</span>
                          <span className="text-xs text-stone-400 dark:text-neutral-500 w-10 text-right">{total > 0 ? Math.round((d.value / total) * 100) : 0}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* ============ TEAM TAB ============ */}
      {activeTab === 'team' && !selectedMemberId && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)] border border-stone-100/50 dark:border-neutral-700/50 overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100 dark:border-neutral-700">
              <h3 className="text-sm font-semibold text-stone-900 dark:text-white flex items-center gap-2">
                <Users className="h-4 w-4 text-stone-600 dark:text-neutral-300" />
                {t.kpi_performance_by_member}
              </h3>
              <p className="text-xs text-stone-400 dark:text-neutral-500 mt-1">
                {t.kpi_click_member_detail}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-50/50 dark:bg-neutral-800/50">
                    <th className="text-left px-5 py-3 font-medium text-stone-500 dark:text-neutral-400">{t.kpi_col_name}</th>
                    <th className="text-left px-5 py-3 font-medium text-stone-500 dark:text-neutral-400">{t.kpi_col_role}</th>
                    <th className="text-center px-5 py-3 font-medium text-stone-500 dark:text-neutral-400">{t.kpi_col_prospects}</th>
                    <th className="text-center px-5 py-3 font-medium text-stone-500 dark:text-neutral-400">{t.kpi_col_sales}</th>
                    <th className="text-center px-5 py-3 font-medium text-stone-500 dark:text-neutral-400">{t.kpi_col_ca}</th>
                    <th className="text-center px-5 py-3 font-medium text-stone-500 dark:text-neutral-400">{t.kpi_col_conv_rate}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-neutral-700">
                  {/* Owner row */}
                  <tr className="hover:bg-stone-50 dark:hover:bg-neutral-700 transition-colors">
                    <td className="px-5 py-3 font-medium text-stone-900 dark:text-white">
                      {t.kpi_you_owner}
                    </td>
                    <td className="px-5 py-3 text-stone-400 dark:text-neutral-500">Owner</td>
                    <td className="px-5 py-3 text-center text-stone-900 dark:text-white">{globalKpis.totalLeads}</td>
                    <td className="px-5 py-3 text-center text-stone-900 dark:text-white">{globalKpis.ventesTotales}</td>
                    <td className="px-5 py-3 text-center text-emerald-700 font-medium">{formatCurrency(globalKpis.caGenere)}</td>
                    <td className="px-5 py-3 text-center text-purple-700 font-medium">{globalKpis.tauxConversion.toFixed(1)}%</td>
                  </tr>

                  {/* Team members */}
                  {teamMembers.map(member => {
                    const memberProspects = filteredProspects.filter(p => p.assigned_to === member.id)
                    const memberWon = memberProspects.filter(p => p.stage === 'won')
                    const memberLost = memberProspects.filter(p => p.stage === 'lost')
                    const memberNoshow = memberProspects.filter(p => p.stage === 'noshow')
                    const memberCA = memberWon.reduce((s, p) => s + getProspectCA(p, formulaBillingTypes), 0)
                    const memberDecided = memberWon.length + memberLost.length + memberNoshow.length
                    const memberConv = memberDecided > 0 ? (memberWon.length / memberDecided) * 100 : 0

                    return (
                      <tr
                        key={member.id}
                        onClick={() => setSelectedMemberId(member.id)}
                        className="hover:bg-stone-50 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-3 font-medium text-stone-900 dark:text-white">
                          <span className="hover:text-stone-600 dark:hover:text-neutral-300 transition-colors">{member.full_name}</span>
                        </td>
                        <td className="px-5 py-3 text-stone-400 dark:text-neutral-500 capitalize">{member.role}</td>
                        <td className="px-5 py-3 text-center text-stone-900 dark:text-white">{memberProspects.length}</td>
                        <td className="px-5 py-3 text-center text-stone-900 dark:text-white">{memberWon.length}</td>
                        <td className="px-5 py-3 text-center text-emerald-700 font-medium">{formatCurrency(memberCA)}</td>
                        <td className="px-5 py-3 text-center text-purple-700 font-medium">{memberConv.toFixed(1)}%</td>
                      </tr>
                    )
                  })}

                  {teamMembers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-stone-900/40 dark:text-neutral-500 text-sm">
                        {t.kpi_no_team_members}
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

        const memberProspects = filteredProspects.filter(p => p.assigned_to === selectedMemberId)
        const mWon = memberProspects.filter(p => p.stage === 'won')
        const mLost = memberProspects.filter(p => p.stage === 'lost')
        const mNoshow = memberProspects.filter(p => p.stage === 'noshow')
        const mActive = memberProspects.filter(p => ['prospect', 'qualified', 'followup'].includes(p.stage))
        const mRevenue = mWon.reduce((s, p) => s + getProspectCA(p, formulaBillingTypes), 0)
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
              monthMap[key].commission += Math.round(getProspectCA(p, formulaBillingTypes) * 0.10)
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
              className="flex items-center gap-2 text-sm font-medium text-stone-600 dark:text-neutral-300 hover:text-stone-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              {t.kpi_back_to_list}
            </button>

            {/* Member header */}
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-stone-100 dark:bg-neutral-800">
                <Users className="h-6 w-6 text-stone-700 dark:text-neutral-200" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{member.full_name}</h2>
                <p className="text-sm text-slate-500 dark:text-neutral-400 capitalize">{member.role}</p>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <KpiCard title={t.kpi_ca_generated} value={formatCurrency(mRevenue)} icon={DollarSign} color="emerald" />
              <KpiCard title={t.kpi_total_sales} value={mWon.length} icon={ShoppingCart} color="blue" />
              <KpiCard title={t.kpi_conversion_rate} value={`${mConversion.toFixed(1)}%`} icon={Target} color="purple" />
              <KpiCard title={t.kpi_commission_10} value={formatCurrency(mCommission)} icon={Award} color="cyan" />
              <KpiCard title={t.kpi_noshow_rate} value={`${mNoShowRate.toFixed(1)}%`} icon={UserX} color="rose" />
              <KpiCard title={t.kpi_deals_lost} value={mLost.length} icon={XCircle} color="slate" />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-neutral-800 rounded-2xl p-8 shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)] border border-stone-100/50 dark:border-neutral-700/50">
                <h3 className="text-xl font-extrabold text-stone-900 dark:text-white mb-8">{t.kpi_closing_rate_history}</h3>
                <div className="h-64">
                  {mChartData.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-sm text-slate-400">{t.kpi_no_data_yet}</div>
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

              <div className="bg-white dark:bg-neutral-800 rounded-2xl p-8 shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)] border border-stone-100/50 dark:border-neutral-700/50">
                <h3 className="text-xl font-extrabold text-stone-900 dark:text-white mb-8">{t.kpi_commission_history}</h3>
                <div className="h-64">
                  {mChartData.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-sm text-slate-400">{t.kpi_no_data_yet}</div>
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

            {/* Member Loss Reason Pie Chart */}
            {(() => {
              const memberLossData = computeLossReasonData(memberProspects)
              if (memberLossData.length === 0) return null
              const total = memberLossData.reduce((s, r) => s + r.value, 0)
              return (
                <div className="bg-white dark:bg-neutral-800 rounded-2xl p-8 shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)] border border-stone-100/50 dark:border-neutral-700/50">
                  <h3 className="text-xl font-extrabold text-stone-900 dark:text-white mb-8">{t.kpi_loss_reasons}</h3>
                  <div className="flex flex-col lg:flex-row items-center gap-8">
                    <div className="w-64 h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={memberLossData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
                            {memberLossData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e7e5e4', fontSize: 12 }} formatter={(v: number) => [v, 'Deals']} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 space-y-3">
                      {memberLossData.map(d => (
                        <div key={d.name} className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                            <span className="text-sm font-medium text-stone-700 dark:text-neutral-200">{d.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-stone-900 dark:text-white">{d.value}</span>
                            <span className="text-xs text-stone-400 dark:text-neutral-500 w-10 text-right">{total > 0 ? Math.round((d.value / total) * 100) : 0}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Pipeline Summary */}
            <div className="bg-stone-900 rounded-2xl p-10 shadow-[0_20px_40px_rgba(27,28,27,0.04)] flex flex-wrap justify-between items-center gap-8">
              <div className="flex items-center gap-6">
                <div className="p-4 bg-white/5 rounded-full">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-stone-400">{t.kpi_total_leads}</p>
                  <p className="text-2xl font-extrabold text-white">{memberProspects.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="p-4 bg-white/5 rounded-full">
                  <Briefcase className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-stone-400">{t.kpi_deals_in_progress}</p>
                  <p className="text-2xl font-extrabold text-white">{mActive.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="p-4 bg-white/5 rounded-full">
                  <Award className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-stone-400">{t.kpi_avg_commission}</p>
                  <p className="text-2xl font-extrabold text-white">{formatCurrency(mAvgCommission)}</p>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ============ EQUIPE TAB ============ */}
      {/* ============ PERSONNEL TAB ============ */}
      {activeTab === 'personnel' && (() => {
        const pWon = personalProspects.filter(p => p.stage === 'won')
        const pLost = personalProspects.filter(p => p.stage === 'lost')
        const pNoshow = personalProspects.filter(p => p.stage === 'noshow')
        const pActive = personalProspects.filter(p => ['prospect', 'qualified', 'followup'].includes(p.stage))
        const pRevenue = pWon.reduce((s, p) => s + getProspectCA(p, formulaBillingTypes), 0)
        const pDecided = pWon.length + pLost.length + pNoshow.length
        const pConversion = pDecided > 0 ? (pWon.length / pDecided) * 100 : 0
        const pNoShowRate = pDecided > 0 ? (pNoshow.length / pDecided) * 100 : 0
        const pAvgValue = pWon.length > 0 ? pRevenue / pWon.length : 0

        // Chart data
        const pChartData = (() => {
          const monthMap: Record<string, { won: number; total: number; ca: number }> = {}
          const now = new Date()
          for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            monthMap[key] = { won: 0, total: 0, ca: 0 }
          }
          personalProspects.forEach(p => {
            const d = p.created_at ? new Date(p.created_at) : null
            if (!d) return
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            if (monthMap[key]) {
              monthMap[key].total++
              if (p.stage === 'won') {
                monthMap[key].won++
                monthMap[key].ca += getProspectCA(p, formulaBillingTypes)
              }
            }
          })
          return Object.entries(monthMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, val]) => ({
              month: `${MONTH_NAMES[parseInt(key.split('-')[1]) - 1]?.slice(0, 3)} ${key.split('-')[0]}`,
              closing: val.total > 0 ? Math.round((val.won / val.total) * 100) : 0,
              ca: val.ca,
            }))
        })()

        const personalLossData = computeLossReasonData(personalProspects)

        return (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <KpiCard title={t.kpi_ca_generated} value={formatCurrency(pRevenue)} icon={DollarSign} color="emerald" />
              <KpiCard title={t.kpi_total_sales} value={pWon.length} icon={ShoppingCart} color="blue" />
              <KpiCard title={t.kpi_conversion_rate} value={`${pConversion.toFixed(1)}%`} icon={Target} color="purple" />
              <KpiCard title={t.kpi_active_prospects} value={pActive.length} icon={Activity} color="cyan" />
              <KpiCard title={t.kpi_noshow_rate} value={`${pNoShowRate.toFixed(1)}%`} icon={UserX} color="rose" />
              <KpiCard title={t.kpi_deals_lost} value={pLost.length} icon={XCircle} color="slate" />
            </div>

            {/* Pipeline Summary */}
            <div className="bg-stone-900 rounded-2xl p-10 shadow-[0_20px_40px_rgba(27,28,27,0.04)] flex flex-wrap justify-between items-center gap-8">
              <div className="flex items-center gap-6">
                <div className="p-4 bg-white/5 rounded-full">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-stone-400">{t.kpi_total_leads}</p>
                  <p className="text-2xl font-extrabold text-white">{personalProspects.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="p-4 bg-white/5 rounded-full">
                  <Briefcase className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-stone-400">{t.kpi_deals_in_progress}</p>
                  <p className="text-2xl font-extrabold text-white">{pActive.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="p-4 bg-white/5 rounded-full">
                  <Award className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-stone-400">{t.kpi_average_value}</p>
                  <p className="text-2xl font-extrabold text-white">{formatCurrency(pAvgValue)}</p>
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Closing Rate Chart */}
              <div className="bg-white dark:bg-neutral-800 rounded-2xl p-8 shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)] border border-stone-100/50 dark:border-neutral-700/50">
                <h3 className="text-xl font-extrabold text-stone-900 dark:text-white mb-8">{t.kpi_closing_rate_history}</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={pChartData}>
                      <defs>
                        <linearGradient id="personalClosingGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1c1917" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#1c1917" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#78716c' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#78716c' }} unit="%" />
                      <Tooltip
                        contentStyle={{ borderRadius: 12, border: '1px solid #e7e5e4', fontSize: 12 }}
                        formatter={(v: number) => [`${v}%`, t.kpi_closing_rate_tooltip]}
                      />
                      <Area type="monotone" dataKey="closing" stroke="#1c1917" strokeWidth={2} fill="url(#personalClosingGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* CA Chart */}
              <div className="bg-white dark:bg-neutral-800 rounded-2xl p-8 shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)] border border-stone-100/50 dark:border-neutral-700/50">
                <h3 className="text-xl font-extrabold text-stone-900 dark:text-white mb-8">{t.kpi_ca_history}</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={pChartData}>
                      <defs>
                        <linearGradient id="personalCaGrad" x1="0" y1="0" x2="0" y2="1">
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
                      <Area type="monotone" dataKey="ca" stroke="#059669" strokeWidth={2} fill="url(#personalCaGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Loss Reason Pie Chart */}
            {personalLossData.length > 0 && (() => {
              const total = personalLossData.reduce((s, r) => s + r.value, 0)
              return (
                <div className="bg-white dark:bg-neutral-800 rounded-2xl p-8 shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)] border border-stone-100/50 dark:border-neutral-700/50">
                  <h3 className="text-xl font-extrabold text-stone-900 dark:text-white mb-8">{t.kpi_loss_reasons}</h3>
                  <div className="flex flex-col lg:flex-row items-center gap-8">
                    <div className="w-64 h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={personalLossData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
                            {personalLossData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e7e5e4', fontSize: 12 }} formatter={(v: number) => [v, 'Deals']} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 space-y-3">
                      {personalLossData.map(d => (
                        <div key={d.name} className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                            <span className="text-sm font-medium text-stone-700 dark:text-neutral-200">{d.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-stone-900 dark:text-white">{d.value}</span>
                            <span className="text-xs text-stone-400 dark:text-neutral-500 w-10 text-right">{total > 0 ? Math.round((d.value / total) * 100) : 0}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        )
      })()}

      {activeTab === 'equipe' && (
        <div className="space-y-6">
          {teams.map(team => {
            const teamMembersList = teamMembers.filter(m => m.team_id === team.id)
            const teamProspects = filteredProspects.filter(p => p.assigned_to && teamMembersList.some(m => m.id === p.assigned_to))
            const teamWon = teamProspects.filter(p => p.stage === 'won')
            const teamLost = teamProspects.filter(p => p.stage === 'lost')
            const teamNoshow = teamProspects.filter(p => p.stage === 'noshow')
            const teamCA = teamWon.reduce((s, p) => s + getProspectCA(p, formulaBillingTypes), 0)
            const teamDecided = teamWon.length + teamLost.length + teamNoshow.length
            const teamConv = teamDecided > 0 ? (teamWon.length / teamDecided) * 100 : 0

            return (
              <div key={team.id} className="bg-white dark:bg-neutral-800 rounded-2xl shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)] border border-stone-100/50 dark:border-neutral-700/50 overflow-hidden">
                <div className="px-5 py-4 border-b border-stone-100 dark:border-neutral-700 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-stone-100 dark:bg-neutral-700 flex items-center justify-center">
                      <Users className="h-4 w-4 text-stone-500 dark:text-neutral-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-stone-900 dark:text-white">{team.name}</h3>
                      <p className="text-[10px] text-stone-400 dark:text-neutral-500">{teamMembersList.length} {teamMembersList.length !== 1 ? t.kpi_members_count_plural : t.kpi_members_count}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-right">
                    <div>
                      <p className="text-[10px] text-stone-400 dark:text-neutral-500 uppercase font-bold tracking-wider">{t.kpi_col_ca}</p>
                      <p className="text-lg font-extrabold text-emerald-700">{formatCurrency(teamCA)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-stone-400 dark:text-neutral-500 uppercase font-bold tracking-wider">{t.kpi_col_sales}</p>
                      <p className="text-lg font-extrabold text-stone-900 dark:text-white">{teamWon.length}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-stone-400 dark:text-neutral-500 uppercase font-bold tracking-wider">{t.kpi_col_conv_rate}</p>
                      <p className="text-lg font-extrabold text-purple-700">{teamConv.toFixed(1)}%</p>
                    </div>
                  </div>
                </div>
                {teamMembersList.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-stone-50/50 dark:bg-neutral-800/50">
                          <th className="text-left px-5 py-2.5 font-medium text-stone-500 dark:text-neutral-400 text-xs">{t.kpi_col_name}</th>
                          <th className="text-left px-5 py-2.5 font-medium text-stone-500 dark:text-neutral-400 text-xs">{t.kpi_col_role}</th>
                          <th className="text-center px-5 py-2.5 font-medium text-stone-500 dark:text-neutral-400 text-xs">{t.kpi_col_prospects}</th>
                          <th className="text-center px-5 py-2.5 font-medium text-stone-500 dark:text-neutral-400 text-xs">{t.kpi_col_sales}</th>
                          <th className="text-center px-5 py-2.5 font-medium text-stone-500 dark:text-neutral-400 text-xs">{t.kpi_col_ca}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 dark:divide-neutral-700">
                        {teamMembersList.map(member => {
                          const mp = filteredProspects.filter(p => p.assigned_to === member.id)
                          const mw = mp.filter(p => p.stage === 'won')
                          const mCA = mw.reduce((s, p) => s + getProspectCA(p, formulaBillingTypes), 0)
                          return (
                            <tr
                              key={member.id}
                              onClick={() => { setActiveTab('team'); setSelectedMemberId(member.id) }}
                              className="hover:bg-stone-50 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                            >
                              <td className="px-5 py-3 font-medium text-stone-900 dark:text-white">{member.full_name}</td>
                              <td className="px-5 py-3 text-stone-400 dark:text-neutral-500 capitalize">{member.role}</td>
                              <td className="px-5 py-3 text-center text-stone-900 dark:text-white">{mp.length}</td>
                              <td className="px-5 py-3 text-center text-stone-900 dark:text-white">{mw.length}</td>
                              <td className="px-5 py-3 text-center text-emerald-700 font-medium">{formatCurrency(mCA)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-stone-400 dark:text-neutral-500 text-center py-6">{t.kpi_no_members_in_team}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
