import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import {
  DollarSign,
  Target,
  Award,
  TrendingUp,
  Users,
  Lock,
  Eye,
  EyeOff,
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

// ============================================================================
// HELPERS
// ============================================================================

const STAGES = [
  { id: 'prospect', name: 'Prospect', color: 'bg-blue-500' },
  { id: 'qualified', name: 'Qualifie', color: 'bg-purple-500' },
  { id: 'won', name: 'Gagne', color: 'bg-emerald-500' },
  { id: 'followup', name: 'Follow Up', color: 'bg-orange-500' },
  { id: 'noshow', name: 'No Show', color: 'bg-slate-600' },
  { id: 'lost', name: 'Perdu', color: 'bg-red-500' },
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
  const [authenticated, setAuthenticated] = useState(false)
  const [data, setData] = useState<SpectatorData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [storedPassword, setStoredPassword] = useState('')
  const [passwordRequired, setPasswordRequired] = useState<boolean | null>(null)
  const [initialChecking, setInitialChecking] = useState(true)

  // Step 1: Check if password is required for this link
  useEffect(() => {
    if (!token) {
      setInitialChecking(false)
      setError('Lien invalide.')
      return
    }

    const checkLink = async () => {
      try {
        const { data: result, error: rpcError } = await supabase.rpc('check_share_link', {
          p_token: token
        })

        if (rpcError) {
          console.error('check_share_link error:', rpcError)
          setError('Ce lien n\'est plus actif ou n\'existe pas.')
          setInitialChecking(false)
          return
        }

        if (result?.error === 'invalid_token') {
          setError('Ce lien n\'est plus actif ou n\'existe pas.')
          setInitialChecking(false)
          return
        }

        const pwdRequired = result?.password_required === true
        setPasswordRequired(pwdRequired)

        if (!pwdRequired) {
          // No password needed, fetch data directly
          await fetchData('')
        }

        setInitialChecking(false)
      } catch (err) {
        console.error('Error checking link:', err)
        setError('Erreur de chargement. Veuillez réessayer.')
        setInitialChecking(false)
      }
    }

    checkLink()
  }, [token])

  const fetchData = useCallback(async (pwd: string) => {
    if (!token) return
    setLoading(true)
    setError(null)

    try {
      const rpcParams: any = { p_token: token }
      if (pwd) {
        rpcParams.p_password = pwd
      }

      const { data: result, error: rpcError } = await supabase.rpc('get_spectator_data', rpcParams)

      if (rpcError) {
        console.error('get_spectator_data error:', rpcError)
        setError('Erreur de chargement. Veuillez réessayer.')
        setAuthenticated(false)
        setLoading(false)
        return
      }

      if (result?.error === 'invalid_token') {
        setError('Ce lien n\'est plus actif ou n\'existe pas.')
        setAuthenticated(false)
        setLoading(false)
        return
      }
      if (result?.error === 'password_required') {
        setError('Mot de passe requis.')
        setAuthenticated(false)
        setLoading(false)
        return
      }
      if (result?.error === 'invalid_password') {
        setError('Mot de passe incorrect.')
        setAuthenticated(false)
        setLoading(false)
        return
      }

      setData(result)
      setAuthenticated(true)
      setStoredPassword(pwd)
    } catch (err: any) {
      setError('Erreur de chargement. Veuillez réessayer.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [token])

  // Auto-refresh data every 15 seconds
  useEffect(() => {
    if (!authenticated) return
    const interval = setInterval(() => {
      fetchData(storedPassword)
    }, 15000)
    return () => clearInterval(interval)
  }, [authenticated, storedPassword, fetchData])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    fetchData(password)
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
      won,
      lost,
      noShow,
      activeProspects: active
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

    const monthNames = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec']
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => ({
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

  // ====== INITIAL LOADING ======
  if (initialChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          <img src="/logo.PNG" alt="CloseOS" className="h-12 mx-auto mb-4" />
          <div className="flex items-center gap-2 text-slate-400">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-blue-500" />
            <span className="text-sm">Chargement...</span>
          </div>
        </div>
      </div>
    )
  }

  // ====== ERROR STATE (invalid link) ======
  if (error && !authenticated && passwordRequired === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <img src="/logo.PNG" alt="CloseOS" className="h-12 mx-auto mb-6" />
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <p className="text-sm text-red-400">{error}</p>
          </div>
          <p className="mt-6 text-center text-xs text-slate-600">
            Performances partagées via CloseOS
          </p>
        </div>
        <CloseOSBadge />
      </div>
    )
  }

  // ====== LOGIN SCREEN (password required) ======
  if (!authenticated && passwordRequired === true) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="flex items-center justify-center mb-8">
            <img src="/logo.PNG" alt="CloseOS" className="h-12" />
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
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 pr-10 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {error && (
                <p className="text-sm text-red-400 text-center">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !password}
                className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Vérification...' : 'Accéder'}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-slate-600">
            Performances partagées via CloseOS
          </p>
        </div>
        <CloseOSBadge />
      </div>
    )
  }

  // ====== LOADING DATA (no password required, waiting for data) ======
  if (!data || !kpis) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          <img src="/logo.PNG" alt="CloseOS" className="h-12 mx-auto mb-4" />
          <div className="flex items-center gap-2 text-slate-400">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-blue-500" />
            <span className="text-sm">Chargement des performances...</span>
          </div>
        </div>
      </div>
    )
  }

  const { profile } = data

  // ====== MAIN SPECTATOR VIEW ======
  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 sm:px-8 h-16">
          <div className="flex items-center gap-3">
            <img src="/logo.PNG" alt="CloseOS" className="h-9" />
            <div>
              <h1 className="text-sm font-bold text-white">
                {profile?.full_name || 'Closer'}
              </h1>
              <p className="text-[10px] text-slate-500">Performances en temps réel</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-1.5">
            <div className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
            <span className="text-xs font-medium text-blue-400">Live</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-8 py-8 space-y-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Cash encaissé"
            value={`${formatCurrency(kpis.revenue)}€`}
            icon={DollarSign}
            color="text-emerald-400"
            bgColor="bg-emerald-500/10"
          />
          <KpiCard
            label="Ventes"
            value={String(kpis.sales)}
            icon={Award}
            color="text-blue-400"
            bgColor="bg-blue-500/10"
          />
          <KpiCard
            label="Taux de closing"
            value={`${kpis.conversion.toFixed(1)}%`}
            icon={Target}
            color="text-purple-400"
            bgColor="bg-purple-500/10"
          />
          <KpiCard
            label="Commissions"
            value={`${formatCurrency(kpis.commissions)}€`}
            icon={TrendingUp}
            color="text-orange-400"
            bgColor="bg-orange-500/10"
          />
        </div>

        {/* Secondary stats */}
        <div className="grid grid-cols-3 gap-4">
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

        {/* Revenue chart */}
        {chartData.length > 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
            <h2 className="text-sm font-bold text-white mb-4">Evolution du CA</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#fff' }}
                    formatter={(value: number) => [`${formatCurrency(value)}€`, 'CA']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Pipeline Overview */}
        <div>
          <h2 className="text-sm font-bold text-white mb-4">Pipeline</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {STAGES.map(stage => {
              const deals = pipelineByStage[stage.id] || []
              return (
                <div key={stage.id} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={cn('h-2.5 w-2.5 rounded-full', stage.color)} />
                    <span className="text-xs font-semibold text-slate-400">{stage.name}</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{deals.length}</p>
                  <div className="mt-3 space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                    {deals.slice(0, 5).map(deal => (
                      <div key={deal.id} className="rounded-lg bg-slate-800/40 px-2.5 py-1.5">
                        <p className="text-xs text-slate-300 truncate">{getDisplayName(deal)}</p>
                        {deal.value > 0 && (
                          <p className="text-[10px] font-medium text-blue-400 mt-0.5">
                            {formatCurrency(deal.value)}€
                          </p>
                        )}
                      </div>
                    ))}
                    {deals.length > 5 && (
                      <p className="text-[10px] text-slate-600 text-center">+{deals.length - 5} autres</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </main>

      {/* Email capture popup */}
      <EmailCapturePopup
        closerName={profile?.full_name || 'ce closer'}
        shareLinkId={data.share_link_id}
      />

      {/* Viral badge */}
      <CloseOSBadge />
    </div>
  )
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function KpiCard({ label, value, icon: Icon, color, bgColor }: {
  label: string
  value: string
  icon: any
  color: string
  bgColor: string
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-3">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', bgColor)}>
          <Icon className={cn('h-5 w-5', color)} />
        </div>
      </div>
      <p className="text-xl sm:text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  )
}
