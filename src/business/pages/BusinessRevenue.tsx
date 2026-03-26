import { useState, useEffect, useCallback, useRef } from 'react'
import {
  DollarSign, TrendingUp, TrendingDown, Users, UserMinus, Percent,
  Loader2, CreditCard, Plus, Trash2, Pencil, Check, X, AlertCircle,
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
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
  month: string
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

export function BusinessRevenue() {
  const { user } = useBusinessAuth()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<RevenueSummary | null>(null)
  const [stripeConnected, setStripeConnected] = useState(false)
  const [stripeModalOpen, setStripeModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'revenue' | 'charges' | 'margin'>('revenue')

  // Current month selector
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7))

  // Charge editing
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

  const fetchRevenue = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/business-revenue-summary?user_id=${user.id}&month=${selectedMonth}`)
      const json = await res.json()
      setData(json)
    } catch {
      toast.error('Erreur lors du chargement des donnees')
    }
    setLoading(false)
  }, [user?.id, selectedMonth])

  useEffect(() => { checkStripe() }, [checkStripe])
  useEffect(() => { fetchRevenue() }, [fetchRevenue])

  // Handle return from Stripe Connect OAuth
  const handledStripeReturn = useRef(false)
  useEffect(() => {
    if (handledStripeReturn.current) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('stripe_connected') === 'true') {
      handledStripeReturn.current = true
      window.history.replaceState({}, '', window.location.pathname)
      toast.success('Compte Stripe connecté avec succès !')
      checkStripe()
      fetchRevenue()
    }
  }, [])

  // Charge CRUD
  const addCharge = async (type: 'fixed' | 'variable') => {
    if (!newLabel.trim() || !newAmount.trim() || !user?.id) return
    try {
      await fetch('/api/business-charges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, label: newLabel.trim(), amount: parseFloat(newAmount), type, month: selectedMonth }),
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

  // Month options (12 months back)
  const monthOptions: string[] = []
  for (let i = 0; i < 12; i++) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    monthOptions.push(d.toISOString().slice(0, 7))
  }

  const CARD = 'bg-white dark:bg-white/5 rounded-2xl border border-stone-200 dark:border-neutral-700/50 p-5 shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)]'
  const SECTION_TITLE = 'text-sm font-bold tracking-widest uppercase text-stone-500 dark:text-neutral-400 mb-4'

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Stripe not connected banner */}
      {!stripeConnected && (
        <div className={`${CARD} border-[#635BFF]/20 bg-[#635BFF]/5`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#635BFF]/10 rounded-xl">
                <CreditCard className="h-6 w-6 text-[#635BFF]" />
              </div>
              <div>
                <p className="font-extrabold text-stone-900 dark:text-white font-['Manrope']">Connectez votre compte Stripe</p>
                <p className="text-sm text-stone-500 dark:text-neutral-400">Pour suivre votre chiffre d'affaires en temps reel</p>
              </div>
            </div>
            <button
              onClick={() => setStripeModalOpen(true)}
              className="px-5 py-2.5 bg-[#635BFF] hover:bg-[#5349E0] text-white font-bold rounded-xl transition-colors"
            >
              Connecter Stripe
            </button>
          </div>
        </div>
      )}

      {/* Month selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="bg-white dark:bg-neutral-800 border border-stone-200 dark:border-neutral-700 rounded-xl px-4 py-2 text-sm font-bold text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-stone-900/20"
          >
            {monthOptions.map(m => (
              <option key={m} value={m}>{formatMonth(m)} {m.split('-')[0]}</option>
            ))}
          </select>
        </div>

        {/* Tab navigation */}
        <div className="flex bg-stone-100 dark:bg-neutral-800 rounded-xl p-1">
          {(['revenue', 'charges', 'margin'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === tab ? 'bg-white dark:bg-neutral-700 text-stone-900 dark:text-white shadow-sm' : 'text-stone-500 dark:text-neutral-400'}`}
            >
              {tab === 'revenue' ? 'Revenus' : tab === 'charges' ? 'Charges' : 'Marge nette'}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ REVENUE TAB ═══ */}
      {activeTab === 'revenue' && data && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <KPICard icon={DollarSign} label="MRR" value={`${data.mrr.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} EUR`} color="text-emerald-600 dark:text-emerald-400" bg="bg-emerald-500/10" />
            <KPICard icon={TrendingUp} label="CA du mois" value={`${data.ca.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} EUR`} color="text-stone-900 dark:text-white" bg="bg-stone-100 dark:bg-neutral-800" />
            <KPICard
              icon={data.evolution >= 0 ? TrendingUp : TrendingDown}
              label="Evolution"
              value={`${data.evolution >= 0 ? '+' : ''}${data.evolution}%`}
              color={data.evolution >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}
              bg={data.evolution >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}
            />
            <KPICard icon={Users} label="Nouveaux clients" value={String(data.newClients)} color="text-blue-600 dark:text-blue-400" bg="bg-blue-500/10" />
            <KPICard icon={UserMinus} label="Annulations" value={String(data.canceledCount)} color="text-red-600 dark:text-red-400" bg="bg-red-500/10" />
            <KPICard icon={Percent} label="Taux de churn" value={`${data.churnRate}%`} color="text-amber-600 dark:text-amber-400" bg="bg-amber-500/10" />
          </div>

          {/* Active subscriptions table */}
          <div className={CARD}>
            <h3 className={SECTION_TITLE}>Abonnements actifs ({data.activeSubscriptions.length})</h3>
            {data.activeSubscriptions.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="h-8 w-8 text-stone-300 dark:text-neutral-600 mx-auto mb-2" />
                <p className="text-sm text-stone-500 dark:text-neutral-400">
                  {stripeConnected ? 'Aucun abonnement actif' : 'Connectez Stripe pour voir vos abonnements'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 dark:border-neutral-700">
                      <th className="text-left py-3 text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-neutral-400">Client</th>
                      <th className="text-right py-3 text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-neutral-400">Montant</th>
                      <th className="text-center py-3 text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-neutral-400">Statut</th>
                      <th className="text-right py-3 text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-neutral-400 hidden md:table-cell">Prochain paiement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-neutral-800">
                    {data.activeSubscriptions.map(sub => (
                      <tr key={sub.id} className="hover:bg-stone-50 dark:hover:bg-white/5 transition-colors">
                        <td className="py-3">
                          <p className="font-bold text-stone-900 dark:text-white">{sub.contact}</p>
                          <p className="text-xs text-stone-500 dark:text-neutral-400">{sub.email}</p>
                        </td>
                        <td className="py-3 text-right font-bold text-stone-900 dark:text-white">
                          {Number(sub.subscription_amount).toFixed(2)} EUR / {sub.subscription_interval === 'month' ? 'mois' : 'an'}
                        </td>
                        <td className="py-3 text-center">
                          <span className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-full ${sub.subscription_status === 'active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-blue-500/10 text-blue-600'}`}>
                            {sub.subscription_status === 'active' ? 'Actif' : 'Essai'}
                          </span>
                        </td>
                        <td className="py-3 text-right text-xs text-stone-500 dark:text-neutral-400 hidden md:table-cell">
                          {sub.next_payment_date ? new Date(sub.next_payment_date).toLocaleDateString('fr-FR') : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ CHARGES TAB ═══ */}
      {activeTab === 'charges' && data && (
        <div className="space-y-6">
          {/* Commissions */}
          <div className={CARD}>
            <h3 className={SECTION_TITLE}>Commissions equipe ({data.commissions.total.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} EUR)</h3>
            {data.commissions.details.length === 0 ? (
              <p className="text-sm text-stone-500 dark:text-neutral-400">Aucune commission calculee</p>
            ) : (
              <div className="space-y-2">
                {data.commissions.details.map(c => (
                  <div key={c.id} className="flex items-center justify-between py-2 border-b border-stone-100 dark:border-neutral-800 last:border-0">
                    <div>
                      <span className="font-bold text-stone-900 dark:text-white text-sm">{c.name}</span>
                      <span className="ml-2 text-xs text-stone-500 dark:text-neutral-400">{c.role}</span>
                    </div>
                    <span className="font-bold text-stone-900 dark:text-white text-sm">
                      {c.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} EUR
                      <span className="text-xs text-stone-400 ml-1">({c.type === 'fixed' ? 'fixe' : 'commission'})</span>
                    </span>
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
            CARD={CARD}
            SECTION_TITLE={SECTION_TITLE}
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
            CARD={CARD}
            SECTION_TITLE={SECTION_TITLE}
          />
        </div>
      )}

      {/* ═══ MARGIN TAB ═══ */}
      {activeTab === 'margin' && data && (
        <div className="space-y-6">
          {/* Net margin card */}
          <div className={`${CARD} ${data.netMargin >= 0 ? 'border-emerald-200 dark:border-emerald-900/50' : 'border-red-200 dark:border-red-900/50'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-stone-500 dark:text-neutral-400 mb-1">Marge nette du mois</p>
                <p className={`text-3xl font-extrabold font-['Manrope'] ${data.netMargin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {data.netMargin >= 0 ? '+' : ''}{data.netMargin.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} EUR
                </p>
              </div>
              <div className="text-right space-y-1">
                <p className="text-xs text-stone-500 dark:text-neutral-400">CA: <span className="font-bold text-stone-900 dark:text-white">{data.ca.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} EUR</span></p>
                <p className="text-xs text-stone-500 dark:text-neutral-400">Charges: <span className="font-bold text-stone-900 dark:text-white">{(data.commissions.total + data.charges.totalFixed + data.charges.totalVariable).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} EUR</span></p>
              </div>
            </div>
          </div>

          {/* 6-month chart */}
          <div className={CARD}>
            <h3 className={SECTION_TITLE}>Evolution sur 6 mois</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorCA" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorCharges" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorMarge" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#635BFF" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#635BFF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
                  <XAxis dataKey="name" stroke="#a8a29e" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#a8a29e" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e7e5e4', borderRadius: '12px', color: '#1c1917' }}
                    formatter={(value: number) => [`${value.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} EUR`]}
                  />
                  <Area type="monotone" dataKey="CA" stroke="#10b981" strokeWidth={2} fill="url(#colorCA)" />
                  <Area type="monotone" dataKey="Charges" stroke="#ef4444" strokeWidth={2} fill="url(#colorCharges)" />
                  <Area type="monotone" dataKey="Marge" stroke="#635BFF" strokeWidth={2} fill="url(#colorMarge)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={CARD}>
              <p className="text-xs font-bold uppercase tracking-widest text-stone-500 dark:text-neutral-400 mb-2">Commissions</p>
              <p className="text-xl font-extrabold text-stone-900 dark:text-white font-['Manrope']">{data.commissions.total.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} EUR</p>
            </div>
            <div className={CARD}>
              <p className="text-xs font-bold uppercase tracking-widest text-stone-500 dark:text-neutral-400 mb-2">Charges fixes</p>
              <p className="text-xl font-extrabold text-stone-900 dark:text-white font-['Manrope']">{data.charges.totalFixed.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} EUR</p>
            </div>
            <div className={CARD}>
              <p className="text-xs font-bold uppercase tracking-widest text-stone-500 dark:text-neutral-400 mb-2">Charges variables</p>
              <p className="text-xl font-extrabold text-stone-900 dark:text-white font-['Manrope']">{data.charges.totalVariable.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} EUR</p>
            </div>
          </div>
        </div>
      )}

      <BusinessStripeConnectModal isOpen={stripeModalOpen} onClose={() => { setStripeModalOpen(false); checkStripe() }} returnPath="/business/revenue" />
    </div>
  )
}

// ─── KPI Card component ──────────────────────────────────────────────────────

function KPICard({ icon: Icon, label, value, color, bg }: { icon: any; label: string; value: string; color: string; bg: string }) {
  return (
    <div className="bg-white dark:bg-white/5 rounded-2xl border border-stone-200 dark:border-neutral-700/50 p-5 shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)]">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-xl ${bg}`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
      </div>
      <p className="text-xs font-bold uppercase tracking-widest text-stone-500 dark:text-neutral-400 mb-1">{label}</p>
      <p className={`text-xl font-extrabold font-['Manrope'] ${color}`}>{value}</p>
    </div>
  )
}

// ─── Charges Section component ───────────────────────────────────────────────

function ChargesSection({
  title, type, charges, total,
  addingCharge, setAddingCharge, newLabel, setNewLabel, newAmount, setNewAmount, addCharge,
  editingCharge, setEditingCharge, editLabel, setEditLabel, editAmount, setEditAmount, updateCharge, deleteCharge,
  CARD, SECTION_TITLE,
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
  CARD: string
  SECTION_TITLE: string
}) {
  return (
    <div className={CARD}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={SECTION_TITLE + ' mb-0'}>{title} ({total.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} EUR)</h3>
        <button
          onClick={() => { setAddingCharge(type); setNewLabel(''); setNewAmount('') }}
          className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-neutral-800 text-stone-500 dark:text-neutral-400 transition-colors"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {charges.length === 0 && addingCharge !== type && (
        <p className="text-sm text-stone-500 dark:text-neutral-400 text-center py-4">Aucune charge {type === 'fixed' ? 'fixe' : 'variable'}</p>
      )}

      <div className="space-y-2">
        {charges.map(c => (
          <div key={c.id} className="flex items-center justify-between py-2 border-b border-stone-100 dark:border-neutral-800 last:border-0 group">
            {editingCharge === c.id ? (
              <div className="flex items-center gap-2 flex-1">
                <input value={editLabel} onChange={e => setEditLabel(e.target.value)} className="flex-1 px-3 py-1.5 bg-stone-50 dark:bg-neutral-800 rounded-lg text-sm border border-stone-200 dark:border-neutral-700" />
                <input value={editAmount} onChange={e => setEditAmount(e.target.value)} type="number" className="w-24 px-3 py-1.5 bg-stone-50 dark:bg-neutral-800 rounded-lg text-sm border border-stone-200 dark:border-neutral-700" />
                <button onClick={() => updateCharge(c.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg"><Check className="h-4 w-4" /></button>
                <button onClick={() => setEditingCharge(null)} className="p-1.5 text-stone-400 hover:bg-stone-100 dark:hover:bg-neutral-800 rounded-lg"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <>
                <span className="text-sm font-medium text-stone-900 dark:text-white">{c.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-stone-900 dark:text-white">{Number(c.amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} EUR</span>
                  <button onClick={() => { setEditingCharge(c.id); setEditLabel(c.label); setEditAmount(String(c.amount)) }} className="p-1.5 text-stone-400 opacity-0 group-hover:opacity-100 hover:bg-stone-100 dark:hover:bg-neutral-800 rounded-lg transition-all"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => deleteCharge(c.id)} className="p-1.5 text-stone-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 rounded-lg transition-all"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </>
            )}
          </div>
        ))}

        {addingCharge === type && (
          <div className="flex items-center gap-2 pt-2">
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Libelle" className="flex-1 px-3 py-2 bg-stone-50 dark:bg-neutral-800 rounded-lg text-sm border border-stone-200 dark:border-neutral-700 placeholder:text-stone-400" />
            <input value={newAmount} onChange={e => setNewAmount(e.target.value)} type="number" placeholder="Montant" className="w-28 px-3 py-2 bg-stone-50 dark:bg-neutral-800 rounded-lg text-sm border border-stone-200 dark:border-neutral-700 placeholder:text-stone-400" />
            <button onClick={() => addCharge(type)} className="p-2 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-lg hover:opacity-90 transition-opacity"><Check className="h-4 w-4" /></button>
            <button onClick={() => setAddingCharge(null)} className="p-2 text-stone-400 hover:bg-stone-100 dark:hover:bg-neutral-800 rounded-lg"><X className="h-4 w-4" /></button>
          </div>
        )}
      </div>
    </div>
  )
}
