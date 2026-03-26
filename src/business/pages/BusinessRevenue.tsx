import { useState, useEffect, useCallback, useRef } from 'react'
import {
  DollarSign, TrendingUp, TrendingDown, Users, UserMinus, Percent,
  Loader2, CreditCard, Plus, Trash2, Pencil, Check, X, AlertCircle, RefreshCw,
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { supabase } from '../../lib/supabase'
import { BusinessStripeConnectModal } from '../components/BusinessStripeConnectModal'
import toast from 'react-hot-toast'

interface RevenueSummary {
  mrr: number
  ca: number
  evolution: number
  newClients: number
  canceledCount: number
  churnRate: number
  activeSubscriptions: {
    id: number
    contact: string
    email: string
    subscription_amount: number
    subscription_interval: string
    subscription_status: string
    last_payment_date: string | null
    next_payment_date: string | null
  }[]
  commissions: {
    total: number
    details: {
      id: string
      name: string
      role: string
      type: string
      amount: number
    }[]
  }
  charges: {
    fixed: Charge[]
    variable: Charge[]
    totalFixed: number
    totalVariable: number
  }
  netMargin: number
  history: {
    month: string
    ca: number
    mrr: number
    charges: number
    margin: number
  }[]
  period: string
}

interface Charge {
  id: string
  business_owner_id: string
  label: string
  amount: number
  type: 'fixed' | 'variable'
  month: string
  created_at: string
}

const MONTH_LABELS: Record<string, string> = {
  '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Avr', '05': 'Mai', '06': 'Jun',
  '07': 'Jul', '08': 'Aou', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec',
}

function formatMonth(m: string) {
  const [, mm] = m.split('-')
  return MONTH_LABELS[mm] || mm
}

const PERIODS = [
  { key: '1m', label: 'Ce mois' },
  { key: '3m', label: '3 mois' },
  { key: '6m', label: '6 mois' },
  { key: '12m', label: 'Cette annee' },
  { key: 'all', label: 'Tout' },
] as const

type PeriodKey = typeof PERIODS[number]['key']

export function BusinessRevenue() {
  const { user } = useBusinessAuth()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<RevenueSummary | null>(null)
  const [stripeConnected, setStripeConnected] = useState(() => {
    try { return new URLSearchParams(window.location.search).get('stripe_connected') === 'true' } catch { return false }
  })
  const [stripeModalOpen, setStripeModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'revenue' | 'charges' | 'margin'>('revenue')
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>('1m')

  // Charge editing
  const [syncing, setSyncing] = useState(false)
  const [addingCharge, setAddingCharge] = useState<'fixed' | 'variable' | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [editingCharge, setEditingCharge] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editAmount, setEditAmount] = useState('')

  const checkStripe = useCallback(async () => {
    if (!user?.id) return
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_connected, stripe_account_id')
      .eq('id', user.id)
      .maybeSingle()
    setStripeConnected(!!(profile?.stripe_connected && profile?.stripe_account_id))
  }, [user?.id])

  const syncStripeData = useCallback(async () => {
    if (!user?.id) return false
    setSyncing(true)
    try {
      const res = await fetch('/api/business-stripe-sync-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      })
      const json = await res.json()
      console.log('[stripe-sync] Response:', JSON.stringify(json))
      if (json.synced > 0) {
        toast.success(`${json.created} fiche(s) creee(s), ${json.matched} matchee(s) depuis Stripe`)
        return true
      } else if (json.total_subscriptions === 0 && json.accountInfo) {
        console.warn('[stripe-sync] 0 subscriptions found. Account info:', json.accountInfo)
      }
    } catch {
      console.error('Sync Stripe failed')
    } finally {
      setSyncing(false)
    }
    return false
  }, [user?.id])

  const fetchRevenue = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/business-revenue-summary?user_id=${user.id}&period=${selectedPeriod}`)
      const json = await res.json()
      setData(json)
    } catch {
      toast.error('Erreur lors du chargement des donnees')
    }
    setLoading(false)
  }, [user?.id, selectedPeriod])

  useEffect(() => { checkStripe() }, [checkStripe])
  useEffect(() => { fetchRevenue() }, [fetchRevenue])

  // Auto-sync: when Stripe is connected but no active subscriptions found
  const hasSynced = useRef(false)
  useEffect(() => {
    if (hasSynced.current || !stripeConnected || loading || !data) return
    if (data.activeSubscriptions.length === 0 && data.mrr === 0) {
      hasSynced.current = true
      syncStripeData().then(didSync => {
        if (didSync) fetchRevenue()
      })
    }
  }, [stripeConnected, loading, data, syncStripeData, fetchRevenue])

  // Handle return from Stripe Connect OAuth
  const handledStripeReturn = useRef(false)
  useEffect(() => {
    if (handledStripeReturn.current || !user?.id) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('stripe_connected') === 'true') {
      handledStripeReturn.current = true
      window.history.replaceState({}, '', window.location.pathname)
      supabase
        .from('profiles')
        .update({ stripe_connected: true })
        .eq('id', user.id)
        .then(() => {
          setStripeConnected(true)
          toast.success('Compte Stripe connecte avec succes !')
          fetchRevenue()
        })
    }
  }, [user?.id])

  // Charge CRUD — always uses current month
  const currentMonth = new Date().toISOString().slice(0, 7)

  const addCharge = async (type: 'fixed' | 'variable') => {
    if (!newLabel.trim() || !newAmount.trim() || !user?.id) return
    try {
      await fetch('/api/business-charges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, label: newLabel.trim(), amount: parseFloat(newAmount), type, month: currentMonth }),
      })
      setNewLabel('')
      setNewAmount('')
      setAddingCharge(null)
      fetchRevenue()
      toast.success('Charge ajoutee')
    } catch {
      toast.error('Erreur')
    }
  }

  const updateCharge = async (chargeId: string) => {
    try {
      await fetch('/api/business-charges', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ charge_id: chargeId, label: editLabel.trim(), amount: parseFloat(editAmount) }),
      })
      setEditingCharge(null)
      fetchRevenue()
    } catch {
      toast.error('Erreur')
    }
  }

  const deleteCharge = async (chargeId: string) => {
    try {
      await fetch(`/api/business-charges?charge_id=${chargeId}`, { method: 'DELETE' })
      fetchRevenue()
    } catch {
      toast.error('Erreur')
    }
  }

  // Chart data
  const chartData = data?.history?.map(h => ({
    name: formatMonth(h.month),
    CA: h.ca,
    Charges: h.charges,
    Marge: h.margin,
  })) || []

  const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  if ((loading && !data) || syncing) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <div className="relative">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#006c49]/10 to-[#635BFF]/10" />
          <Loader2 className="h-6 w-6 animate-spin text-[#006c49] absolute top-3 left-3" />
        </div>
        {syncing && <p className="text-sm text-[#444748] font-medium">Synchronisation Stripe en cours...</p>}
      </div>
    )
  }

  return (
    <div className="space-y-8">

      {/* ═══ Stripe not connected ═══ */}
      {!stripeConnected && (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#635BFF]/5 via-white to-[#006c49]/5 dark:from-[#635BFF]/10 dark:via-neutral-900 dark:to-[#006c49]/10 p-8">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#635BFF]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative flex items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="h-14 w-14 rounded-2xl bg-[#635BFF]/10 flex items-center justify-center shrink-0">
                <CreditCard className="h-7 w-7 text-[#635BFF]" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-[#1b1c1b] dark:text-white font-['Manrope'] tracking-tight">Connectez Stripe</h2>
                <p className="text-sm text-[#444748] dark:text-neutral-400 mt-0.5">Synchronisez vos paiements pour un suivi CA en temps reel</p>
              </div>
            </div>
            <button
              onClick={() => setStripeModalOpen(true)}
              className="px-6 py-3 bg-[#635BFF] hover:bg-[#5349E0] text-white font-extrabold rounded-full transition-all shadow-lg shadow-[#635BFF]/20 hover:shadow-xl hover:shadow-[#635BFF]/30 shrink-0"
            >
              Connecter
            </button>
          </div>
        </div>
      )}

      {/* ═══ Header: Period pills + Tab nav ═══ */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Period pills */}
        <div className="flex items-center gap-1.5 bg-[#f5f3f2] dark:bg-neutral-800/50 rounded-full p-1">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setSelectedPeriod(p.key)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                selectedPeriod === p.key
                  ? 'bg-white dark:bg-neutral-700 text-[#1b1c1b] dark:text-white shadow-[0_2px_8px_rgba(27,28,27,0.06)]'
                  : 'text-[#444748] dark:text-neutral-400 hover:text-[#1b1c1b] dark:hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Tab navigation */}
        <div className="flex items-center gap-1.5 bg-[#f5f3f2] dark:bg-neutral-800/50 rounded-full p-1">
          {(['revenue', 'charges', 'margin'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                activeTab === tab
                  ? 'bg-white dark:bg-neutral-700 text-[#1b1c1b] dark:text-white shadow-[0_2px_8px_rgba(27,28,27,0.06)]'
                  : 'text-[#444748] dark:text-neutral-400 hover:text-[#1b1c1b] dark:hover:text-white'
              }`}
            >
              {tab === 'revenue' ? 'Revenus' : tab === 'charges' ? 'Charges' : 'Marge nette'}
            </button>
          ))}
          {stripeConnected && (
            <button
              onClick={() => syncStripeData().then(ok => ok && fetchRevenue())}
              className="p-2 rounded-full text-[#444748] dark:text-neutral-400 hover:text-[#1b1c1b] dark:hover:text-white hover:bg-white dark:hover:bg-neutral-700 transition-all"
              title="Re-synchroniser Stripe"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* ═══ REVENUE TAB ═══ */}
      {activeTab === 'revenue' && data && (
        <div className="space-y-8">
          {/* Hero KPI row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* MRR - Hero card */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#006c49] to-[#004d35] p-7 text-white">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-4">
                  <DollarSign className="h-5 w-5 opacity-70" />
                  <span className="text-xs font-bold uppercase tracking-[0.15em] opacity-70">MRR</span>
                </div>
                <p className="text-4xl font-extrabold font-['Manrope'] tracking-tight">{fmt(data.mrr)} <span className="text-lg opacity-60">EUR</span></p>
                {data.evolution !== 0 && (
                  <div className={`mt-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${data.evolution >= 0 ? 'bg-white/15 text-white' : 'bg-red-400/20 text-red-200'}`}>
                    {data.evolution >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    {data.evolution >= 0 ? '+' : ''}{data.evolution}%
                  </div>
                )}
              </div>
            </div>

            {/* CA */}
            <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-white/5 p-7 shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:shadow-none">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#ffb95f]/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 rounded-lg bg-[#1b1c1b]/5 dark:bg-white/10">
                    <TrendingUp className="h-4 w-4 text-[#1b1c1b] dark:text-white" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-[0.15em] text-[#444748] dark:text-neutral-400">CA {PERIODS.find(p => p.key === selectedPeriod)?.label}</span>
                </div>
                <p className="text-3xl font-extrabold font-['Manrope'] tracking-tight text-[#1b1c1b] dark:text-white">{fmt(data.ca)} <span className="text-base text-[#444748]/40">EUR</span></p>
              </div>
            </div>

            {/* Marge nette */}
            <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-white/5 p-7 shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:shadow-none">
              <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3 ${data.netMargin >= 0 ? 'bg-[#006c49]/5' : 'bg-red-500/5'}`} />
              <div className="relative">
                <div className="flex items-center gap-2 mb-4">
                  <div className={`p-1.5 rounded-lg ${data.netMargin >= 0 ? 'bg-[#006c49]/10' : 'bg-red-500/10'}`}>
                    <Percent className={`h-4 w-4 ${data.netMargin >= 0 ? 'text-[#006c49]' : 'text-red-500'}`} />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-[0.15em] text-[#444748] dark:text-neutral-400">Marge nette</span>
                </div>
                <p className={`text-3xl font-extrabold font-['Manrope'] tracking-tight ${data.netMargin >= 0 ? 'text-[#006c49]' : 'text-red-500'}`}>
                  {data.netMargin >= 0 ? '+' : ''}{fmt(data.netMargin)} <span className="text-base opacity-40">EUR</span>
                </p>
              </div>
            </div>
          </div>

          {/* Secondary KPIs */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-2xl bg-[#f5f3f2] dark:bg-white/5 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-blue-500" />
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#444748] dark:text-neutral-400">Nouveaux clients</span>
              </div>
              <p className="text-2xl font-extrabold font-['Manrope'] text-[#1b1c1b] dark:text-white">{data.newClients}</p>
            </div>
            <div className="rounded-2xl bg-[#f5f3f2] dark:bg-white/5 p-5">
              <div className="flex items-center gap-2 mb-3">
                <UserMinus className="h-4 w-4 text-red-400" />
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#444748] dark:text-neutral-400">Annulations</span>
              </div>
              <p className="text-2xl font-extrabold font-['Manrope'] text-[#1b1c1b] dark:text-white">{data.canceledCount}</p>
            </div>
            <div className="rounded-2xl bg-[#f5f3f2] dark:bg-white/5 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Percent className="h-4 w-4 text-amber-500" />
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#444748] dark:text-neutral-400">Churn</span>
              </div>
              <p className="text-2xl font-extrabold font-['Manrope'] text-[#1b1c1b] dark:text-white">{data.churnRate}%</p>
            </div>
          </div>

          {/* Active subscriptions */}
          <div className="rounded-3xl bg-white dark:bg-white/5 p-7 shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:shadow-none">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#444748] dark:text-neutral-400">
                Abonnements actifs <span className="text-[#006c49] ml-1">{data.activeSubscriptions.length}</span>
              </h3>
            </div>
            {data.activeSubscriptions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="h-16 w-16 rounded-full bg-[#f5f3f2] dark:bg-neutral-800 flex items-center justify-center mb-4">
                  <AlertCircle className="h-7 w-7 text-[#c4c7c7]" />
                </div>
                <p className="text-sm text-[#444748] dark:text-neutral-400">
                  {stripeConnected ? 'Aucun abonnement actif detecte' : 'Connectez Stripe pour voir vos abonnements'}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {data.activeSubscriptions.map(sub => (
                  <div key={sub.id} className="flex items-center justify-between py-4 px-4 -mx-4 rounded-2xl hover:bg-[#f5f3f2] dark:hover:bg-white/5 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#006c49]/10 to-[#006c49]/5 flex items-center justify-center shrink-0">
                        <span className="text-sm font-extrabold text-[#006c49]">{sub.contact.charAt(0).toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="font-bold text-[#1b1c1b] dark:text-white text-sm">{sub.contact}</p>
                        <p className="text-xs text-[#444748] dark:text-neutral-500">{sub.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${sub.subscription_status === 'active' ? 'bg-[#006c49]/10 text-[#006c49]' : 'bg-blue-500/10 text-blue-500'}`}>
                        {sub.subscription_status === 'active' ? 'Actif' : 'Essai'}
                      </span>
                      <div className="text-right">
                        <p className="font-extrabold text-[#1b1c1b] dark:text-white text-sm font-['Manrope']">
                          {Number(sub.subscription_amount).toFixed(2)} EUR
                        </p>
                        <p className="text-[10px] text-[#444748] dark:text-neutral-500">/ {sub.subscription_interval === 'month' ? 'mois' : 'an'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ CHARGES TAB ═══ */}
      {activeTab === 'charges' && data && (
        <div className="space-y-8">
          {/* Commissions */}
          <div className="rounded-3xl bg-white dark:bg-white/5 p-7 shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:shadow-none">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#444748] dark:text-neutral-400">Commissions equipe</h3>
              <span className="text-sm font-extrabold font-['Manrope'] text-[#1b1c1b] dark:text-white">{fmt(data.commissions.total)} EUR</span>
            </div>
            {data.commissions.details.length === 0 ? (
              <p className="text-sm text-[#444748] dark:text-neutral-400 text-center py-6">Aucune commission calculee</p>
            ) : (
              <div className="space-y-1">
                {data.commissions.details.map(c => (
                  <div key={c.id} className="flex items-center justify-between py-3.5 px-4 -mx-4 rounded-2xl hover:bg-[#f5f3f2] dark:hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-[#f5f3f2] dark:bg-neutral-800 flex items-center justify-center">
                        <span className="text-xs font-extrabold text-[#444748]">{c.name.charAt(0)}</span>
                      </div>
                      <div>
                        <span className="font-bold text-[#1b1c1b] dark:text-white text-sm">{c.name}</span>
                        <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-[#444748] dark:text-neutral-500 bg-[#f5f3f2] dark:bg-neutral-800 px-2 py-0.5 rounded-full">{c.role}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-extrabold text-[#1b1c1b] dark:text-white text-sm font-['Manrope']">{fmt(c.amount)} EUR</span>
                      <span className="block text-[10px] text-[#444748] dark:text-neutral-500">{c.type === 'fixed' ? 'Salaire fixe' : 'Commission'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fixed charges */}
          <ChargesSection
            title="Charges fixes"
            type="fixed"
            charges={data.charges.fixed}
            total={data.charges.totalFixed}
            addingCharge={addingCharge}
            setAddingCharge={setAddingCharge}
            newLabel={newLabel}
            setNewLabel={setNewLabel}
            newAmount={newAmount}
            setNewAmount={setNewAmount}
            addCharge={addCharge}
            editingCharge={editingCharge}
            setEditingCharge={setEditingCharge}
            editLabel={editLabel}
            setEditLabel={setEditLabel}
            editAmount={editAmount}
            setEditAmount={setEditAmount}
            updateCharge={updateCharge}
            deleteCharge={deleteCharge}
          />

          {/* Variable charges */}
          <ChargesSection
            title="Charges variables"
            type="variable"
            charges={data.charges.variable}
            total={data.charges.totalVariable}
            addingCharge={addingCharge}
            setAddingCharge={setAddingCharge}
            newLabel={newLabel}
            setNewLabel={setNewLabel}
            newAmount={newAmount}
            setNewAmount={setNewAmount}
            addCharge={addCharge}
            editingCharge={editingCharge}
            setEditingCharge={setEditingCharge}
            editLabel={editLabel}
            setEditLabel={setEditLabel}
            editAmount={editAmount}
            setEditAmount={setEditAmount}
            updateCharge={updateCharge}
            deleteCharge={deleteCharge}
          />
        </div>
      )}

      {/* ═══ MARGIN TAB ═══ */}
      {activeTab === 'margin' && data && (
        <div className="space-y-8">
          {/* Hero margin card */}
          <div className={`relative overflow-hidden rounded-3xl p-8 ${data.netMargin >= 0 ? 'bg-gradient-to-br from-[#006c49] to-[#004d35]' : 'bg-gradient-to-br from-red-600 to-red-700'} text-white`}>
            <div className="absolute top-0 right-0 w-56 h-56 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
            <div className="relative flex items-end justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-60 mb-3">Marge nette {PERIODS.find(p => p.key === selectedPeriod)?.label}</p>
                <p className="text-5xl font-extrabold font-['Manrope'] tracking-tight">
                  {data.netMargin >= 0 ? '+' : ''}{fmt(data.netMargin)} <span className="text-xl opacity-40">EUR</span>
                </p>
              </div>
              <div className="text-right space-y-2 opacity-80">
                <p className="text-sm">CA <span className="font-extrabold">{fmt(data.ca)}</span></p>
                <p className="text-sm">Charges <span className="font-extrabold">{fmt(data.commissions.total + data.charges.totalFixed + data.charges.totalVariable)}</span></p>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="rounded-3xl bg-white dark:bg-white/5 p-7 shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:shadow-none">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#444748] dark:text-neutral-400 mb-6">Evolution mensuelle</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="gCA" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#006c49" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#006c49" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gCharges" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gMarge" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#635BFF" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#635BFF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#c4c7c7" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#c4c7c7" fontSize={11} tickLine={false} axisLine={false} width={50} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)', border: 'none', borderRadius: '16px', boxShadow: '0 20px 40px rgba(27,28,27,0.08)', color: '#1b1c1b' }}
                    formatter={(value: number) => [`${fmt(value)} EUR`]}
                    labelStyle={{ fontWeight: 800, marginBottom: 4 }}
                  />
                  <Area type="monotone" dataKey="CA" stroke="#006c49" strokeWidth={2.5} fill="url(#gCA)" dot={false} />
                  <Area type="monotone" dataKey="Charges" stroke="#ef4444" strokeWidth={1.5} fill="url(#gCharges)" dot={false} strokeDasharray="6 3" />
                  <Area type="monotone" dataKey="Marge" stroke="#635BFF" strokeWidth={2} fill="url(#gMarge)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-[#f5f3f2] dark:bg-white/5 p-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#444748] dark:text-neutral-400 mb-3">Commissions</p>
              <p className="text-xl font-extrabold text-[#1b1c1b] dark:text-white font-['Manrope']">{fmt(data.commissions.total)} EUR</p>
            </div>
            <div className="rounded-2xl bg-[#f5f3f2] dark:bg-white/5 p-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#444748] dark:text-neutral-400 mb-3">Charges fixes</p>
              <p className="text-xl font-extrabold text-[#1b1c1b] dark:text-white font-['Manrope']">{fmt(data.charges.totalFixed)} EUR</p>
            </div>
            <div className="rounded-2xl bg-[#f5f3f2] dark:bg-white/5 p-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#444748] dark:text-neutral-400 mb-3">Charges variables</p>
              <p className="text-xl font-extrabold text-[#1b1c1b] dark:text-white font-['Manrope']">{fmt(data.charges.totalVariable)} EUR</p>
            </div>
          </div>
        </div>
      )}

      <BusinessStripeConnectModal
        isOpen={stripeModalOpen}
        onClose={() => { setStripeModalOpen(false); checkStripe() }}
        returnPath="/business/revenue"
        benefits={[
          "Suivez votre chiffre d'affaires reel base sur les paiements Stripe.",
          "Chaque paiement recurrent met a jour automatiquement le CA de vos closers.",
          "Visualisez MRR, abonnements actifs, churn et marge nette en temps reel.",
        ]}
        connectedDescription="Votre compte Stripe est connecte. Vos revenus et abonnements sont synchronises en temps reel."
      />
    </div>
  )
}

// ─── Charges Section ─────────────────────────────────────────────────────────

function ChargesSection({
  title, type, charges, total,
  addingCharge, setAddingCharge, newLabel, setNewLabel, newAmount, setNewAmount, addCharge,
  editingCharge, setEditingCharge, editLabel, setEditLabel, editAmount, setEditAmount, updateCharge, deleteCharge,
}: {
  title: string
  type: 'fixed' | 'variable'
  charges: Charge[]
  total: number
  addingCharge: 'fixed' | 'variable' | null
  setAddingCharge: (v: 'fixed' | 'variable' | null) => void
  newLabel: string
  setNewLabel: (v: string) => void
  newAmount: string
  setNewAmount: (v: string) => void
  addCharge: (type: 'fixed' | 'variable') => void
  editingCharge: string | null
  setEditingCharge: (v: string | null) => void
  editLabel: string
  setEditLabel: (v: string) => void
  editAmount: string
  setEditAmount: (v: string) => void
  updateCharge: (id: string) => void
  deleteCharge: (id: string) => void
}) {
  const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="rounded-3xl bg-white dark:bg-white/5 p-7 shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:shadow-none">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#444748] dark:text-neutral-400">{title}</h3>
        <div className="flex items-center gap-3">
          <span className="text-sm font-extrabold font-['Manrope'] text-[#1b1c1b] dark:text-white">{fmt(total)} EUR</span>
          <button
            onClick={() => { setAddingCharge(type); setNewLabel(''); setNewAmount('') }}
            className="h-8 w-8 rounded-full bg-[#f5f3f2] dark:bg-neutral-800 hover:bg-[#eae8e7] dark:hover:bg-neutral-700 flex items-center justify-center text-[#444748] dark:text-neutral-400 transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {charges.length === 0 && addingCharge !== type && (
        <p className="text-sm text-[#444748] dark:text-neutral-400 text-center py-8">Aucune charge {type === 'fixed' ? 'fixe' : 'variable'}</p>
      )}

      <div className="space-y-1">
        {charges.map(c => (
          <div key={c.id} className="flex items-center justify-between py-3.5 px-4 -mx-4 rounded-2xl hover:bg-[#f5f3f2] dark:hover:bg-white/5 transition-colors group">
            {editingCharge === c.id ? (
              <div className="flex items-center gap-2 flex-1">
                <input value={editLabel} onChange={e => setEditLabel(e.target.value)} className="flex-1 px-3 py-2 bg-[#f5f3f2] dark:bg-neutral-800 rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-[#006c49]/20" />
                <input value={editAmount} onChange={e => setEditAmount(e.target.value)} type="number" className="w-24 px-3 py-2 bg-[#f5f3f2] dark:bg-neutral-800 rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-[#006c49]/20" />
                <button onClick={() => updateCharge(c.id)} className="p-2 text-[#006c49] hover:bg-[#006c49]/10 rounded-full transition-colors"><Check className="h-4 w-4" /></button>
                <button onClick={() => setEditingCharge(null)} className="p-2 text-[#444748] hover:bg-[#f5f3f2] dark:hover:bg-neutral-800 rounded-full transition-colors"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <>
                <span className="text-sm font-medium text-[#1b1c1b] dark:text-white">{c.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold text-[#1b1c1b] dark:text-white font-['Manrope']">{fmt(Number(c.amount))} EUR</span>
                  <button onClick={() => { setEditingCharge(c.id); setEditLabel(c.label); setEditAmount(String(c.amount)) }} className="p-1.5 text-[#c4c7c7] opacity-0 group-hover:opacity-100 hover:text-[#1b1c1b] dark:hover:text-white rounded-full transition-all"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => deleteCharge(c.id)} className="p-1.5 text-[#c4c7c7] opacity-0 group-hover:opacity-100 hover:text-red-500 rounded-full transition-all"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </>
            )}
          </div>
        ))}

        {addingCharge === type && (
          <div className="flex items-center gap-2 pt-3">
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Libelle" className="flex-1 px-4 py-2.5 bg-[#f5f3f2] dark:bg-neutral-800 rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-[#006c49]/20 placeholder:text-[#c4c7c7]" />
            <input value={newAmount} onChange={e => setNewAmount(e.target.value)} type="number" placeholder="Montant" className="w-28 px-4 py-2.5 bg-[#f5f3f2] dark:bg-neutral-800 rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-[#006c49]/20 placeholder:text-[#c4c7c7]" />
            <button onClick={() => addCharge(type)} className="p-2.5 bg-[#1b1c1b] dark:bg-white text-white dark:text-[#1b1c1b] rounded-full hover:opacity-80 transition-opacity"><Check className="h-4 w-4" /></button>
            <button onClick={() => setAddingCharge(null)} className="p-2.5 text-[#444748] hover:bg-[#f5f3f2] dark:hover:bg-neutral-800 rounded-full transition-colors"><X className="h-4 w-4" /></button>
          </div>
        )}
      </div>
    </div>
  )
}
