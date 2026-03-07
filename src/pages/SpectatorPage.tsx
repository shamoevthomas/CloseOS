import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import {
  DollarSign,
  Target,
  Award,
  TrendingUp,
  Lock,
  Eye,
  EyeOff,
  Menu,
  X,
  User,
  BarChart3,
  Kanban,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import { cn } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { CloseOSBadge } from '../components/CloseOSBadge'
import { EmailCapturePopup } from '../components/EmailCapturePopup'

// ============================================================================
// TYPES
// ============================================================================

interface SpectatorData {
  share_link_id: string
  shared_view: 'kpi' | 'pipeline' | 'both'
  shared_offer: string | null
  profile: { full_name: string; avatar_url: string | null }
  prospects: SpectatorProspect[]
  offers: SpectatorOffer[]
  kpi_config: any[]
}

interface SpectatorProspect {
  id: number
  stage: string
  offer: string | null
  value: number
  company: string | null
  contact: string | null
  created_at: string
  formula_id: string | null
  firstName: string | null
  lastName: string | null
}

interface SpectatorOffer {
  id: number
  name: string
  price: string
  commission: string
  formulas: any[]
  status: string
  target: string
  endDate: string | null
}

type PageStatus = 'checking' | 'needsPassword' | 'loading' | 'ready' | 'error'

// ============================================================================
// HELPERS
// ============================================================================

const STAGES = [
  { id: 'prospect', name: 'Prospect', color: 'bg-blue-500', textColor: 'text-blue-400' },
  { id: 'qualified', name: 'Qualifié', color: 'bg-purple-500', textColor: 'text-purple-400' },
  { id: 'won', name: 'Gagné', color: 'bg-emerald-500', textColor: 'text-emerald-400' },
  { id: 'followup', name: 'Follow Up', color: 'bg-orange-500', textColor: 'text-orange-400' },
  { id: 'noshow', name: 'No Show', color: 'bg-slate-600', textColor: 'text-slate-400' },
  { id: 'lost', name: 'Perdu', color: 'bg-red-500', textColor: 'text-red-400' },
]

const parsePrice = (priceString: string): number => {
  if (!priceString) return 0
  const cleaned = priceString.toString().replace(/[^\d.,]/g, '')
  const normalized = cleaned.replace(/,/g, '.')
  const parsed = parseFloat(normalized.replace(/\s/g, ''))
  return isNaN(parsed) ? 0 : parsed
}

const parseCommission = (str?: string) => {
  if (!str) return 0.10
  const match = str.match(/(\d+(?:\.\d+)?)/)
  return match ? parseFloat(match[1]) / 100 : 0.10
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)

const getDisplayName = (p: SpectatorProspect) => {
  if (p.firstName || p.lastName) return `${p.firstName || ''} ${p.lastName || ''}`.trim()
  return p.contact || 'Prospect'
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function SpectatorPage() {
  const { token } = useParams<{ token: string }>()
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [data, setData] = useState<SpectatorData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<PageStatus>('checking')
  const [storedPassword, setStoredPassword] = useState('')
  const [kpiDrawerOpen, setKpiDrawerOpen] = useState(false)
  // For 'both' view: which tab is actively showing in the main area
  const [activeTab, setActiveTab] = useState<'pipeline' | 'kpi'>('pipeline')

  // ====== Single useEffect for initial load ======
  useEffect(() => {
    if (!token) {
      setError('Lien invalide.')
      setStatus('error')
      return
    }

    let cancelled = false
    let retried = false

    const init = async () => {
      try {
        const { data: checkResult, error: checkError } = await supabase.rpc('check_share_link', {
          p_token: token
        })

        if (cancelled) return

        // Simple retry on transient error (no auth needed - RPCs are SECURITY DEFINER)
        if (checkError && !retried) {
          retried = true
          await new Promise(r => setTimeout(r, 1000))
          return init()
        }

        if (checkError || checkResult?.error === 'invalid_token') {
          setError('Ce lien n\'est plus actif ou n\'existe pas.')
          setStatus('error')
          return
        }

        const needsPwd = checkResult?.password_required === true

        if (needsPwd) {
          setStatus('needsPassword')
          return
        }

        // No password needed, fetch data directly
        setStatus('loading')
        const { data: spectatorResult, error: spectatorError } = await supabase.rpc('get_spectator_data', {
          p_token: token
        })

        if (cancelled) return

        if (spectatorError) {
          console.error('get_spectator_data error:', spectatorError)
          setError('Erreur de chargement. Veuillez réessayer.')
          setStatus('error')
          return
        }

        if (spectatorResult?.error || !spectatorResult) {
          setError('Ce lien n\'est plus actif ou n\'existe pas.')
          setStatus('error')
          return
        }

        setData(spectatorResult)
        // Set initial active tab based on shared_view
        if (spectatorResult?.shared_view === 'kpi') {
          setActiveTab('kpi')
        }
        setStatus('ready')
      } catch (err) {
        if (cancelled) return
        console.error('Init error:', err)
        setError('Erreur de chargement. Veuillez réessayer.')
        setStatus('error')
      }
    }

    init()
    return () => { cancelled = true }
  }, [token])

  // ====== Auto-refresh ======
  useEffect(() => {
    if (status !== 'ready' || !token) return
    const interval = setInterval(async () => {
      try {
        const params: any = { p_token: token }
        if (storedPassword) params.p_password = storedPassword
        const { data: result } = await supabase.rpc('get_spectator_data', params)
        if (result && !result.error) {
          setData(result)
        }
      } catch {
        // silently fail
      }
    }, 15000)
    return () => clearInterval(interval)
  }, [status, token])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !password) return
    setError(null)
    setStatus('loading')

    try {
      const { data: result, error: rpcError } = await supabase.rpc('get_spectator_data', {
        p_token: token,
        p_password: password
      })

      if (rpcError) {
        setError('Erreur de chargement. Veuillez réessayer.')
        setStatus('needsPassword')
        return
      }

      if (result?.error === 'invalid_password') {
        setError('Mot de passe incorrect.')
        setStatus('needsPassword')
        return
      }
      if (result?.error === 'password_required') {
        setError('Mot de passe requis.')
        setStatus('needsPassword')
        return
      }
      if (result?.error) {
        setError('Ce lien n\'est plus actif ou n\'existe pas.')
        setStatus('error')
        return
      }

      setData(result)
      setStoredPassword(password)
      if (result?.shared_view === 'kpi') {
        setActiveTab('kpi')
      }
      setStatus('ready')
    } catch (err) {
      console.error('Login error:', err)
      setError('Erreur de chargement. Veuillez réessayer.')
      setStatus('needsPassword')
    }
  }

  // ====== KPI Calculations ======
  const kpis = useMemo(() => {
    if (!data) return null
    const { prospects, offers } = data

    const won = prospects.filter(p => p.stage === 'won')
    const lost = prospects.filter(p => p.stage === 'lost')
    const active = prospects.filter(p => p.stage !== 'won' && p.stage !== 'lost')
    const noShow = prospects.filter(p => p.stage === 'noshow')

    const revenue = won.reduce((sum, p) => {
      let val = p.value || 0
      if ((!val || val === 0) && p.formula_id) {
        const parentOffer = offers.find(o => o.name === (p.offer || '').split(' - ')[0])
        if (parentOffer?.formulas) {
          const formula = parentOffer.formulas.find((f: any) => f.id === p.formula_id)
          if (formula) val = parsePrice(formula.price)
        }
      }
      return sum + val
    }, 0)

    const commissions = won.reduce((sum, p) => {
      const dealOffer = offers.find(o =>
        (p.offer && o.name.toLowerCase() === (p.offer || '').split(' - ')[0].toLowerCase())
      )
      const rate = dealOffer?.commission ? parseCommission(dealOffer.commission) : 0.10
      let val = p.value || 0
      if ((!val || val === 0) && p.formula_id) {
        const parentOffer = offers.find(o => o.name === (p.offer || '').split(' - ')[0])
        if (parentOffer?.formulas) {
          const formula = parentOffer.formulas.find((f: any) => f.id === p.formula_id)
          if (formula) val = parsePrice(formula.price)
        }
      }
      return sum + (val * rate)
    }, 0)

    const totalOutcomes = won.length + lost.length
    const conversion = totalOutcomes > 0 ? (won.length / totalOutcomes) * 100 : 0
    const noShowRate = (totalOutcomes + noShow.length) > 0
      ? (noShow.length / (totalOutcomes + noShow.length)) * 100 : 0

    return {
      revenue,
      commissions,
      sales: won.length,
      leads: prospects.length,
      active: active.length,
      conversion,
      noShowRate,
    }
  }, [data])

  // ====== Chart Data ======
  const chartData = useMemo(() => {
    if (!data) return []
    const grouped: Record<string, { won: number; revenue: number; date: Date }> = {}

    data.prospects.forEach(p => {
      const d = p.created_at ? new Date(p.created_at) : new Date()
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!grouped[key]) grouped[key] = { won: 0, revenue: 0, date: d }
      if (p.stage === 'won') {
        grouped[key].won++
        grouped[key].revenue += p.value || 0
      }
    })

    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, val]) => ({
        name: monthNames[val.date.getMonth()],
        revenue: val.revenue,
        ventes: val.won
      }))
  }, [data])

  // ====== Pipeline by stage ======
  const pipelineByStage = useMemo(() => {
    if (!data) return {}
    const result: Record<string, SpectatorProspect[]> = {}
    STAGES.forEach(s => { result[s.id] = [] })
    data.prospects.forEach(p => {
      const stage = p.stage || 'prospect'
      if (!result[stage]) result[stage] = []
      result[stage].push(p)
    })
    return result
  }, [data])

  // Derive what views are allowed
  const sharedView = data?.shared_view || 'both'
  const showPipeline = sharedView === 'pipeline' || sharedView === 'both'
  const showKpi = sharedView === 'kpi' || sharedView === 'both'

  // ============================================================================
  // RENDER STATES
  // ============================================================================

  // ====== CHECKING / LOADING ======
  if (status === 'checking' || status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center space-y-6">
          <img src="/logo Sales.png" alt="CloseOS" className="h-20 mx-auto drop-shadow-lg" />
          <div className="flex flex-col items-center gap-3 w-64 mx-auto">
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-600 via-blue-400 to-blue-600 rounded-full animate-loading-bar" />
            </div>
            <p className="text-sm text-slate-400 animate-pulse">
              {status === 'checking' ? 'Vérification du lien...' : 'Chargement des performances...'}
            </p>
          </div>
          <div className="w-72 mx-auto space-y-3 opacity-30">
            <div className="grid grid-cols-2 gap-2">
              <div className="h-16 rounded-xl bg-slate-800 animate-pulse" />
              <div className="h-16 rounded-xl bg-slate-800 animate-pulse delay-75" />
              <div className="h-16 rounded-xl bg-slate-800 animate-pulse delay-150" />
              <div className="h-16 rounded-xl bg-slate-800 animate-pulse delay-200" />
            </div>
          </div>
        </div>
        <style>{`
          @keyframes loading-bar {
            0% { width: 0%; margin-left: 0; }
            50% { width: 70%; margin-left: 15%; }
            100% { width: 0%; margin-left: 100%; }
          }
          .animate-loading-bar { animation: loading-bar 1.5s ease-in-out infinite; }
        `}</style>
      </div>
    )
  }

  // ====== ERROR ======
  if (status === 'error') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center space-y-6">
          <img src="/logo Sales.png" alt="CloseOS" className="h-20 mx-auto drop-shadow-lg" />
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
              <X className="h-6 w-6 text-red-400" />
            </div>
            <p className="text-sm text-red-400 font-medium">{error}</p>
          </div>
          <p className="text-xs text-slate-600">Performances partagées via CloseOS</p>
        </div>
        <CloseOSBadge />
      </div>
    )
  }

  // ====== PASSWORD LOGIN ======
  if (status === 'needsPassword') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="flex items-center justify-center mb-8">
            <img src="/logo Sales.png" alt="CloseOS" className="h-20 drop-shadow-lg" />
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <div className="text-center mb-6">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/10">
                <Lock className="h-7 w-7 text-blue-400" />
              </div>
              <h1 className="text-lg font-bold text-white">Page Spectateur</h1>
              <p className="text-sm text-slate-400 mt-1">
                Entrez le mot de passe pour accéder aux performances
              </p>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mot de passe"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 pr-10 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none transition-colors"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {error && <p className="text-sm text-red-400 text-center">{error}</p>}
              <button
                type="submit"
                disabled={!password}
                className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                Accéder
              </button>
            </form>
          </div>
          <p className="mt-6 text-center text-xs text-slate-600">Performances partagées via CloseOS</p>
        </div>
        <CloseOSBadge />
      </div>
    )
  }

  // ====== MAIN SPECTATOR VIEW ======
  if (!data || !kpis) return null

  const { profile } = data

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 sm:px-8 h-16">
          <div className="flex items-center gap-3">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={profile?.full_name || 'Closer'} className="h-9 w-9 rounded-full object-cover border border-slate-700" />
            ) : (
              <img src="/logo Sales.png" alt="CloseOS" className="h-14" />
            )}
            <div>
              <h1 className="text-sm font-bold text-white">
                {profile?.full_name || 'Closer'}
              </h1>
              <p className="text-[10px] text-slate-500">
                {data.shared_offer ? `Offre : ${data.shared_offer}` : 'Performances en temps réel'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Tab switcher — only when 'both' views */}
            {sharedView === 'both' && (
              <div className="flex items-center rounded-lg border border-slate-700 bg-slate-800 p-1">
                <button
                  onClick={() => setActiveTab('pipeline')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                    activeTab === 'pipeline' ? 'bg-slate-700 text-blue-400' : 'text-slate-400 hover:text-slate-200'
                  )}
                >
                  <Kanban className="h-3.5 w-3.5" />
                  Pipeline
                </button>
                <button
                  onClick={() => setActiveTab('kpi')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                    activeTab === 'kpi' ? 'bg-slate-700 text-blue-400' : 'text-slate-400 hover:text-slate-200'
                  )}
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  KPIs
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-1.5">
              <div className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
              <span className="text-xs font-medium text-blue-400">Live</span>
            </div>
            {/* Hamburger for KPIs — only for pipeline-only view */}
            {sharedView === 'pipeline' && (
              <button
                onClick={() => setKpiDrawerOpen(true)}
                className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:border-blue-500/30 hover:text-blue-400 transition-all"
              >
                <Menu className="h-4 w-4" />
                <span className="hidden sm:inline">KPIs</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-8 py-8 space-y-6">
        {/* ====== PIPELINE VIEW ====== */}
        {(showPipeline && (sharedView !== 'both' || activeTab === 'pipeline')) && (
          <PipelineView
            prospects={data.prospects}
            pipelineByStage={pipelineByStage}
          />
        )}

        {/* ====== KPI VIEW ====== */}
        {(showKpi && (sharedView !== 'both' || activeTab === 'kpi')) && (
          <KpiView
            kpis={kpis}
            chartData={chartData}
          />
        )}
      </main>

      {/* ====== KPI DRAWER (only for pipeline-only view) ====== */}
      {kpiDrawerOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setKpiDrawerOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl overflow-y-auto animate-slide-in-right">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900/95 backdrop-blur-sm px-6 py-4">
              <h2 className="text-lg font-bold text-white">Statistiques</h2>
              <button onClick={() => setKpiDrawerOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <KpiView kpis={kpis} chartData={chartData} />
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right { animation: slide-in-right 0.25s ease-out; }
      `}</style>

      <EmailCapturePopup closerName={profile?.full_name || 'ce closer'} shareLinkId={data.share_link_id} />
      <CloseOSBadge />
    </div>
  )
}

// ============================================================================
// PIPELINE VIEW
// ============================================================================

function PipelineView({ prospects, pipelineByStage }: {
  prospects: SpectatorProspect[]
  pipelineByStage: Record<string, SpectatorProspect[]>
}) {
  // First row: Prospect, Qualifié, Gagné — Second row: Follow Up, No Show, Perdu
  const topRow = STAGES.filter(s => ['prospect', 'qualified', 'won'].includes(s.id))
  const bottomRow = STAGES.filter(s => ['followup', 'noshow', 'lost'].includes(s.id))

  const renderColumn = (stage: typeof STAGES[number]) => {
    const deals = pipelineByStage[stage.id] || []
    return (
      <div key={stage.id} className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/50 min-w-0">
        <div className="border-b border-slate-800 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn('h-2.5 w-2.5 rounded-full ring-2 ring-slate-900', stage.color)} />
              <h3 className="text-sm font-semibold text-slate-200">{stage.name}</h3>
            </div>
            <span className={cn(
              'flex h-6 min-w-[24px] items-center justify-center rounded-full px-2 text-xs font-bold',
              deals.length > 0 ? `${stage.textColor} bg-slate-800` : 'text-slate-600 bg-slate-800/50'
            )}>
              {deals.length}
            </span>
          </div>
        </div>
        <div className="space-y-2 p-3 max-h-[300px] overflow-y-auto custom-scrollbar">
          {deals.length === 0 && (
            <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-slate-800/50 bg-slate-900/20">
              <span className="text-xs text-slate-600">Vide</span>
            </div>
          )}
          {deals.map(deal => {
            const isB2B = deal.company && deal.company !== 'N/A'
            const displayName = getDisplayName(deal)
            return (
              <div key={deal.id} className="relative rounded-lg border border-slate-800 bg-slate-800/40 p-3 transition-all hover:border-slate-700 hover:bg-slate-800/60">
                <div className={cn('absolute left-0 top-3 bottom-3 w-1 rounded-r-full opacity-60', stage.color)} />
                <div className="pl-3">
                  <h4 className="text-sm font-medium text-slate-200 truncate">
                    {isB2B ? deal.company : displayName}
                  </h4>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                    <User className="h-3 w-3" />
                    <span className="truncate">{isB2B ? displayName : (deal.offer || '')}</span>
                  </div>
                  {deal.value > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-700/50">
                      <span className="text-xs font-semibold text-blue-400">
                        {formatCurrency(deal.value)}€
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold text-white">Pipeline</h2>
        <span className="text-xs text-slate-500">{prospects.length} prospects au total</span>
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {topRow.map(renderColumn)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {bottomRow.map(renderColumn)}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// KPI VIEW
// ============================================================================

function KpiView({ kpis, chartData }: {
  kpis: { revenue: number; commissions: number; sales: number; leads: number; active: number; conversion: number; noShowRate: number }
  chartData: { name: string; revenue: number; ventes: number }[]
}) {
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Cash encaissé" value={`${formatCurrency(kpis.revenue)}€`} icon={DollarSign} color="text-emerald-400" bgColor="bg-emerald-500/10" />
        <KpiCard label="Ventes" value={String(kpis.sales)} icon={Award} color="text-blue-400" bgColor="bg-blue-500/10" />
        <KpiCard label="Taux de closing" value={`${kpis.conversion.toFixed(1)}%`} icon={Target} color="text-purple-400" bgColor="bg-purple-500/10" />
        <KpiCard label="Commissions" value={`${formatCurrency(kpis.commissions)}€`} icon={TrendingUp} color="text-orange-400" bgColor="bg-orange-500/10" />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-center">
          <p className="text-2xl font-bold text-white">{kpis.leads}</p>
          <p className="text-xs text-slate-500 mt-1">Total prospects</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-center">
          <p className="text-2xl font-bold text-white">{kpis.active}</p>
          <p className="text-xs text-slate-500 mt-1">Deals en cours</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-center">
          <p className="text-2xl font-bold text-white">{kpis.noShowRate.toFixed(1)}%</p>
          <p className="text-xs text-slate-500 mt-1">Taux no show</p>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
          <h3 className="text-sm font-bold text-white mb-4">Évolution du CA</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRevenueSpec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#fff' }}
                  formatter={(value: any) => [`${formatCurrency(Number(value))}€`, 'CA']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenueSpec)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// CARD COMPONENT
// ============================================================================

function KpiCard({ label, value, icon: Icon, color, bgColor }: {
  label: string; value: string; icon: any; color: string; bgColor: string
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', bgColor)}>
          <Icon className={cn('h-4 w-4', color)} />
        </div>
      </div>
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
    </div>
  )
}
