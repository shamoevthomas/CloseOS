import { useState, useEffect, useMemo, useRef } from 'react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessProspects } from '../contexts/BusinessProspectsContext'
import { supabase } from '../../lib/supabase'
import {
  TrendingUp, DollarSign, ShoppingCart, Target, Award,
  Ban, Users, Briefcase, UserX, Settings, X, Save, Loader2, Package,
  Download, CalendarDays,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { cn } from '../../lib/utils'
import toast from 'react-hot-toast'
// @ts-ignore
import html2pdf from 'html2pdf.js'

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
  const [activeTab, setActiveTab] = useState<'personal' | 'org' | 'offer' | 'campaign' | 'source'>(isOwnerView ? 'org' : 'personal')
  const [kpiConfig, setKpiConfig] = useState<KpiConfig>({ planned_calls: 20, revenue_target: 10000, commission_rate: 10 })
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [formulas, setFormulas] = useState<Formula[]>([])
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null)
  const [teamClosers, setTeamClosers] = useState<TeamCloser[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [campaigns, setCampaigns] = useState<{ id: string; name: string; source: string }[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)
  const [selectedSource, setSelectedSource] = useState<string | null>(null)
  // Global member filter (persists across tabs)
  const [globalMemberId, setGlobalMemberId] = useState<string | null>(null)

  // Period filter
  const [periodFrom, setPeriodFrom] = useState('')
  const [periodTo, setPeriodTo] = useState('')

  // PDF export
  const pdfRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)

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

  // Load team closers + Owner/HoS for member selector
  useEffect(() => {
    if (!ownerUserId) return
    Promise.all([
      supabase
        .from('business_team_members')
        .select('id, first_name, last_name, role')
        .eq('business_owner_id', ownerUserId),
      supabase
        .from('business_users')
        .select('id, full_name')
        .eq('id', ownerUserId)
        .single(),
    ]).then(([tmRes, ownerRes]) => {
      const allMembers: TeamCloser[] = []
      if (ownerRes.data) {
        const nameParts = (ownerRes.data.full_name || 'Owner').split(' ')
        allMembers.push({ id: ownerRes.data.id, first_name: nameParts[0] || 'Owner', last_name: nameParts.slice(1).join(' ') || '', role: 'Owner' })
      }
      if (tmRes.data) {
        allMembers.push(...tmRes.data)
      }
      setTeamClosers(allMembers)
    })
  }, [ownerUserId])

  // Load campaigns
  useEffect(() => {
    if (!ownerUserId) return
    supabase
      .from('business_campaigns')
      .select('id, name, source')
      .eq('user_id', ownerUserId)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setCampaigns(data)
          if (!selectedCampaignId) setSelectedCampaignId(data[0].id)
          if (!selectedSource) setSelectedSource(data[0].source || 'Direct')
        }
      })
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

  // Period-filtered prospects
  const periodProspects = useMemo(() => {
    if (!periodFrom && !periodTo) return prospects
    return prospects.filter(p => {
      if (!p.created_at) return false
      const d = p.created_at.slice(0, 10)
      if (periodFrom && d < periodFrom) return false
      if (periodTo && d > periodTo) return false
      return true
    })
  }, [prospects, periodFrom, periodTo])

  // Helper: compute closer KPIs for a set of prospects
  const computeCloserKpis = (src: any[]) => {
    const won = src.filter((p: any) => p.stage === 'won')
    const noShow = src.filter((p: any) => p.stage === 'noshow')
    const lost = src.filter((p: any) => p.stage === 'lost')
    const revenue = won.reduce((sum: number, p: any) => sum + (p.value || 0), 0)
    // Conversion: no-shows count only if they came from follow-up
    const noshowFromFollowup = noShow.filter((p: any) => p.previous_stage === 'followup')
    const closedTotal = won.length + lost.length + noshowFromFollowup.length
    const conversionRate = closedTotal > 0 ? (won.length / closedTotal) * 100 : 0
    // No-show rate: denominator = all qualified prospects who had an appointment (excludes prospect, unqualified, noanswer)
    const qualifiedWithRdv = src.filter((p: any) => !['prospect', 'unqualified', 'noanswer'].includes(p.stage))
    const noShowRate = qualifiedWithRdv.length > 0 ? (noShow.length / qualifiedWithRdv.length) * 100 : 0
    return { won, noShow, lost, revenue, closedTotal, conversionRate, noShowRate }
  }

  // Personal KPIs
  const myProspects = periodProspects.filter(p => p.assigned_to === teamMember?.id)
  const personal = computeCloserKpis(myProspects)
  const commission = Math.round(personal.revenue * (kpiConfig.commission_rate / 100))

  // Unique sources from campaigns
  const uniqueSources = useMemo(() => {
    const sources = new Set(campaigns.map(c => c.source || 'Direct'))
    return Array.from(sources)
  }, [campaigns])

  // Helper: filter prospects by member
  const filterByMember = (src: any[], memberId: string | null) => {
    if (!memberId) return src
    return src.filter(p => p.assigned_to === memberId)
  }

  // Org KPIs (filtered by member if selected)
  const orgProspects = useMemo(() => filterByMember(periodProspects, globalMemberId), [periodProspects, globalMemberId])
  const org = computeCloserKpis(orgProspects)
  const orgCommission = Math.round(org.revenue * (kpiConfig.commission_rate / 100))

  // Per-formula KPIs
  const formulaProspects = useMemo(() => {
    if (!selectedOfferId) return []
    const base = isOwnerView ? periodProspects : myProspects
    const filtered = base.filter(p => (p as any).offer_id === selectedOfferId || (p as any).formula_id === selectedOfferId)
    return filterByMember(filtered, globalMemberId)
  }, [isOwnerView, myProspects, periodProspects, selectedOfferId, globalMemberId])

  const formula = computeCloserKpis(formulaProspects)
  const formulaCommission = Math.round(formula.revenue * (kpiConfig.commission_rate / 100))

  // Per-campaign KPIs
  const campaignProspects = useMemo(() => {
    if (!selectedCampaignId) return []
    const base = isOwnerView ? periodProspects : myProspects
    const filtered = base.filter(p => (p as any).campaign_id === selectedCampaignId)
    return filterByMember(filtered, globalMemberId)
  }, [isOwnerView, myProspects, prospects, selectedCampaignId, globalMemberId])

  const campaign = computeCloserKpis(campaignProspects)
  const campaignCommission = Math.round(campaign.revenue * (kpiConfig.commission_rate / 100))

  // Per-source KPIs
  const sourceProspects = useMemo(() => {
    if (!selectedSource) return []
    const campaignIds = campaigns.filter(c => (c.source || 'Direct') === selectedSource).map(c => c.id)
    const base = isOwnerView ? periodProspects : myProspects
    const filtered = base.filter(p => campaignIds.includes((p as any).campaign_id))
    return filterByMember(filtered, globalMemberId)
  }, [isOwnerView, myProspects, prospects, selectedSource, campaigns, globalMemberId])

  const source = computeCloserKpis(sourceProspects)
  const sourceCommission = Math.round(source.revenue * (kpiConfig.commission_rate / 100))

  // Chart data: group prospects by month
  const chartData = useMemo(() => {
    const tabSource = activeTab === 'personal' ? myProspects : activeTab === 'org' ? orgProspects : activeTab === 'offer' ? formulaProspects : activeTab === 'campaign' ? campaignProspects : activeTab === 'source' ? sourceProspects : orgProspects
    const monthMap: Record<string, { won: number; total: number; commission: number }> = {}
    tabSource.forEach(p => {
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
  }, [myProspects, orgProspects, formulaProspects, campaignProspects, sourceProspects, activeTab, kpiConfig.commission_rate])

  // Current tab values
  const getTabValues = () => {
    const makeVals = (kpis: ReturnType<typeof computeCloserKpis>, comm: number, src: any[]) => ({
      revenue: kpis.revenue, sales: kpis.won.length, conversion: kpis.conversionRate,
      commission: comm, noShowRate: kpis.noShowRate, lost: kpis.lost.length,
      leads: src.length, deals: src.filter(p => !['won', 'lost', 'noshow', 'noanswer'].includes(p.stage)).length,
    })
    if (activeTab === 'org') return makeVals(org, orgCommission, orgProspects)
    if (activeTab === 'offer') return makeVals(formula, formulaCommission, formulaProspects)
    if (activeTab === 'campaign') return makeVals(campaign, campaignCommission, campaignProspects)
    if (activeTab === 'source') return makeVals(source, sourceCommission, sourceProspects)
    return makeVals(personal, commission, myProspects)
  }

  const v = getTabValues()
  const avgCommission = v.sales > 0 ? Math.round(v.commission / v.sales) : 0

  const inputCls = "w-full rounded-xl border border-stone-200 dark:border-white/10 px-4 py-2.5 text-sm text-stone-900 dark:text-white dark:bg-neutral-800 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400"

  // Member selector component
  // Tabs definition
  const tabs = isOwnerView
    ? [
        { key: 'org' as const, label: 'Organisation' },
        { key: 'offer' as const, label: 'Par Formule' },
        { key: 'campaign' as const, label: 'Par Campagne' },
        { key: 'source' as const, label: 'Par Source' },
      ]
    : [
        { key: 'personal' as const, label: 'Global (Personnel)' },
        { key: 'org' as const, label: 'Organisation' },
        { key: 'offer' as const, label: 'Par Formule' },
        { key: 'campaign' as const, label: 'Par Campagne' },
        { key: 'source' as const, label: 'Par Source' },
      ]

  const handleExportPdf = async () => {
    if (!pdfRef.current) return
    setExporting(true)
    try {
      const periodLabel = periodFrom || periodTo
        ? `${periodFrom || '...'} → ${periodTo || '...'}`
        : 'Toutes périodes'
      const opt = {
        margin: 10,
        filename: `KPI-Closer-${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff', windowWidth: 900 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
      }
      await html2pdf().set(opt).from(pdfRef.current).save()
      toast.success('PDF exporté')
    } catch (err) {
      console.error('PDF export error:', err)
      toast.error("Erreur lors de l'export PDF")
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-stone-600 animate-spin" />
      </div>
    )
  }

  const periodLabel = periodFrom || periodTo
    ? `${periodFrom ? new Date(periodFrom + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '...'} → ${periodTo ? new Date(periodTo + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '...'}`
    : 'Toutes périodes'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 dark:bg-white/5">
            <TrendingUp className="h-5 w-5 text-stone-700 dark:text-neutral-200" />
          </div>
          <div>
            <p className="text-xs font-bold tracking-widest uppercase text-stone-500 dark:text-neutral-400 mb-1">PERFORMANCE CLOSER</p>
            <h1 className="text-4xl font-extrabold tracking-tight text-stone-900 dark:text-white">Performance Closer</h1>
            <p className="text-sm text-stone-500 dark:text-neutral-400">{isOwnerView ? "Vue d'ensemble de l'équipe" : 'Vos indicateurs de performance'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isOwnerView && (
            <button
              onClick={() => setIsConfigOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-stone-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm font-medium text-stone-600 dark:text-neutral-300 hover:bg-stone-50 dark:hover:bg-white/10 transition-colors"
            >
              <Settings className="h-4 w-4" /> Configurer
            </button>
          )}
          <button
            onClick={handleExportPdf}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-stone-900 dark:bg-white text-sm font-bold text-white dark:text-stone-900 hover:opacity-90 transition-all disabled:opacity-50 active:scale-95"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Exporter PDF
          </button>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <CalendarDays className="h-4 w-4 text-stone-400" />
        <span className="text-xs font-bold uppercase tracking-widest text-stone-500 dark:text-neutral-400">Période</span>
        <input
          type="date"
          value={periodFrom}
          onChange={e => setPeriodFrom(e.target.value)}
          className="rounded-full bg-stone-100 dark:bg-neutral-800 border-0 px-3 py-1.5 text-sm text-stone-900 dark:text-white font-medium focus:ring-2 focus:ring-stone-900/20 focus:outline-none"
        />
        <span className="text-stone-400">→</span>
        <input
          type="date"
          value={periodTo}
          onChange={e => setPeriodTo(e.target.value)}
          className="rounded-full bg-stone-100 dark:bg-neutral-800 border-0 px-3 py-1.5 text-sm text-stone-900 dark:text-white font-medium focus:ring-2 focus:ring-stone-900/20 focus:outline-none"
        />
        {(periodFrom || periodTo) && (
          <button
            onClick={() => { setPeriodFrom(''); setPeriodTo('') }}
            className="text-xs text-stone-500 hover:text-stone-900 dark:hover:text-white font-medium transition-colors"
          >
            Réinitialiser
          </button>
        )}
      </div>

      {/* Tabs + Global Member Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex p-1.5 bg-stone-100 dark:bg-neutral-800 rounded-full w-fit flex-wrap">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium transition-all',
                activeTab === tab.key
                  ? 'bg-white dark:bg-white/10 text-stone-900 dark:text-white shadow-[0_20px_40px_rgba(27,28,27,0.04)]'
                  : 'text-stone-500 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {isOwnerView && teamClosers.length > 0 && (
          <div className="flex items-center gap-2 bg-white dark:bg-white/5 rounded-full border border-stone-200 dark:border-white/10 pl-3 pr-1 py-1 shadow-sm">
            <Users className="h-4 w-4 text-stone-400 shrink-0" />
            <select
              value={globalMemberId || ''}
              onChange={(e) => setGlobalMemberId(e.target.value || null)}
              className="bg-transparent text-sm font-semibold text-stone-900 dark:text-white pr-6 py-1.5 focus:outline-none appearance-none cursor-pointer"
            >
              <option value="">Tous les membres</option>
              {teamClosers.map(c => (
                <option key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.role})</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {activeTab === 'org' && (
        <div className="rounded-xl bg-stone-50 dark:bg-white/5 border border-stone-200 dark:border-white/10 px-4 py-3">
          <p className="text-sm text-stone-700">KPIs de l'organisation</p>
        </div>
      )}

      {activeTab === 'offer' && (
        <div className="rounded-xl bg-stone-50 dark:bg-white/5 border border-stone-200 dark:border-white/10 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-stone-700 dark:text-neutral-200 shrink-0">Par Formule</p>
            <div className="flex items-center gap-2">
              <select
                value={selectedOfferId || ''}
                onChange={(e) => setSelectedOfferId(e.target.value)}
                className="rounded-lg border border-stone-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-stone-900 dark:text-white px-3 py-1.5 focus:border-stone-400 focus:outline-none"
              >
                {formulas.length === 0 && <option value="">Aucune formule</option>}
                {formulas.map(f => (
                  <option key={f.id} value={f.id}>{f.name} ({f.price}€)</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'campaign' && (
        <div className="rounded-xl bg-stone-50 dark:bg-white/5 border border-stone-200 dark:border-white/10 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-stone-700 dark:text-neutral-200 shrink-0">Par Campagne</p>
            <div className="flex items-center gap-2">
              <select
                value={selectedCampaignId || ''}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                className="rounded-lg border border-stone-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-stone-900 dark:text-white px-3 py-1.5 focus:border-stone-400 focus:outline-none"
              >
                {campaigns.length === 0 && <option value="">Aucune campagne</option>}
                {campaigns.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'source' && (
        <div className="rounded-xl bg-stone-50 dark:bg-white/5 border border-stone-200 dark:border-white/10 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-stone-700 dark:text-neutral-200 shrink-0">Par Source</p>
            <div className="flex items-center gap-2">
              <select
                value={selectedSource || ''}
                onChange={(e) => setSelectedSource(e.target.value)}
                className="rounded-lg border border-stone-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-stone-900 dark:text-white px-3 py-1.5 focus:border-stone-400 focus:outline-none"
              >
                {uniqueSources.length === 0 && <option value="">Aucune source</option>}
                {uniqueSources.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* PDF export content */}
      <div ref={pdfRef}>
      {/* PDF header (hidden on screen, visible in PDF) */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-extrabold text-stone-900">Performance Closer — {periodLabel}</h1>
        <p className="text-sm text-stone-500">Exporté le {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard title="CA Généré" value={`${formatCurrency(v.revenue)} €`} icon={DollarSign} color="emerald" />
        <KpiCard title="Ventes Totales" value={v.sales} icon={ShoppingCart} color="blue" />
        <KpiCard title="Taux de Closing" value={`${formatPercent(v.conversion)}%`} icon={Target} color="purple" />
        <KpiCard title={isOwnerView ? 'Commissions' : 'Mes Commissions'} value={`${formatCurrency(v.commission)} €`} icon={Award} color="stone" highlight />
        <KpiCard title="Taux de No Show" value={`${formatPercent(v.noShowRate)}%`} icon={UserX} color="rose" />
        <KpiCard title="Deals Perdus" value={v.lost} icon={Ban} color="stone" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-white/5 rounded-2xl border border-stone-200 dark:border-neutral-700/50 p-5 shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)]">
          <h3 className="text-sm font-bold tracking-widest uppercase text-stone-500 dark:text-neutral-400 mb-4">Historique Taux de Closing</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorClosingBiz" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1c1917" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#1c1917" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
                <XAxis dataKey="name" stroke="#a8a29e" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#a8a29e" fontSize={12} tickLine={false} axisLine={false} unit="%" />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e7e5e4', borderRadius: '12px', color: '#1c1917' }} />
                <Area type="monotone" dataKey="closing" stroke="#1c1917" strokeWidth={2} fill="url(#colorClosingBiz)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-white/5 rounded-2xl border border-stone-200 dark:border-neutral-700/50 p-5 shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)]">
          <h3 className="text-sm font-bold tracking-widest uppercase text-stone-500 dark:text-neutral-400 mb-4">Historique Commissions</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorCommissionBiz" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
                <XAxis dataKey="name" stroke="#a8a29e" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#a8a29e" fontSize={12} tickLine={false} axisLine={false} unit="€" />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e7e5e4', borderRadius: '12px', color: '#1c1917' }} />
                <Area type="monotone" dataKey="commission" stroke="#10b981" strokeWidth={2} fill="url(#colorCommissionBiz)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Pipeline Summary */}
      <div className="bg-stone-900 text-white rounded-2xl p-6">
        <h3 className="text-sm font-bold tracking-widest uppercase text-stone-400 mb-4">Résumé du Pipeline</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SummaryItem label="Total Leads" value={v.leads} icon={Users} color="indigo" dark />
          <SummaryItem label="Deals en Cours" value={v.deals} icon={Briefcase} color="cyan" dark />
          <SummaryItem label="Commission Moy." value={`${formatCurrency(avgCommission)} €`} icon={Award} color="stone" dark />
        </div>
      </div>
      </div>{/* end pdfRef */}

      {/* Config Modal (team members only) */}
      {isConfigOpen && !isOwnerView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-neutral-800 px-6 py-4">
              <h2 className="text-xl font-extrabold text-stone-900 dark:text-white">Configuration KPI</h2>
              <button onClick={() => setIsConfigOpen(false)} className="text-stone-400 hover:text-stone-600 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-stone-900 dark:text-white mb-1">Objectif de revenue (€)</label>
                <input
                  type="number"
                  value={kpiConfig.revenue_target}
                  onChange={e => setKpiConfig(prev => ({ ...prev, revenue_target: Number(e.target.value) }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-stone-900 dark:text-white mb-1">Appels prévus / mois</label>
                <input
                  type="number"
                  value={kpiConfig.planned_calls}
                  onChange={e => setKpiConfig(prev => ({ ...prev, planned_calls: Number(e.target.value) }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-stone-900 dark:text-white mb-1">Taux de commission (%)</label>
                <input
                  type="number"
                  value={kpiConfig.commission_rate}
                  onChange={e => setKpiConfig(prev => ({ ...prev, commission_rate: Number(e.target.value) }))}
                  className={inputCls}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-stone-100 dark:border-neutral-800 px-6 py-4">
              <button onClick={() => setIsConfigOpen(false)} className="rounded-xl border border-stone-200 dark:border-white/10 px-4 py-2 text-sm font-medium text-stone-600 dark:text-neutral-300 hover:bg-stone-50 dark:hover:bg-white/5 transition-colors">
                Annuler
              </button>
              <button
                onClick={saveConfig}
                className="flex items-center gap-2 rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-colors"
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
  const iconColors: any = {
    emerald: 'text-emerald-600 dark:text-emerald-400',
    blue: 'text-blue-600 dark:text-blue-400',
    purple: 'text-purple-600 dark:text-purple-400',
    stone: 'text-stone-600 dark:text-stone-400',
    rose: 'text-rose-600 dark:text-rose-400',
  }
  const iconColor = iconColors[color] || iconColors.stone
  return (
    <div className={cn(
      'bg-white dark:bg-white/5 rounded-2xl border p-5 transition-all hover:shadow-md dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)]',
      highlight ? 'border-stone-200 dark:border-neutral-700/50 shadow-sm' : 'border-stone-200 dark:border-neutral-700/50'
    )}>
      <div className="flex items-center gap-3 mb-3">
        <Icon className={cn('h-4 w-4', iconColor)} />
        <span className="text-xs font-bold tracking-widest uppercase text-stone-500 dark:text-neutral-400">{title}</span>
      </div>
      <p className="text-4xl font-extrabold tracking-tighter text-stone-900 dark:text-white">{value}</p>
    </div>
  )
}

const SummaryItem = ({ label, value, icon: Icon, color, dark }: any) => {
  const colors: any = {
    indigo: 'bg-indigo-50 text-indigo-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    stone: 'bg-stone-50 text-stone-600',
  }
  return (
    <div className="flex items-center gap-4 p-3 rounded-xl transition-colors">
      <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', colors[color])}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className={cn("text-xs font-bold tracking-widest uppercase", dark ? "text-stone-400" : "text-stone-500")}>{label}</p>
        <p className={cn("text-2xl font-extrabold tracking-tighter", dark ? "text-white" : "text-stone-900")}>{value}</p>
      </div>
    </div>
  )
}
