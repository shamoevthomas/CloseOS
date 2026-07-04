import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessLang } from '../i18n/BusinessLangContext'
import { useBusinessProspects } from '../contexts/BusinessProspectsContext'
import { supabase } from '../../lib/supabase'
import {
  TrendingUp, DollarSign, ShoppingCart, Target, Award,
  Ban, Users, Briefcase, UserX, Settings, X, Save, Loader2, Package,
  Download, CalendarDays, ArrowRight, Filter, Plus, Trash2, AlertTriangle,
  Repeat, Repeat2,
} from 'lucide-react'
import {
  AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { cn } from '../../lib/utils'
import { getProspectCA } from '../lib/getProspectCA'
import toast from 'react-hot-toast'
// @ts-ignore
import html2pdf from 'html2pdf.js'

interface KpiConfig {
  planned_calls: number
  revenue_target: number
  commission_rate: number
}

interface KpiFormulaEntry {
  name: string
  price: number
  commission: number
  sales: number
}

interface KpiConfigEntry {
  planned_calls: number
  no_shows: number
  lost_calls: number
  won_calls: number
  formulas: KpiFormulaEntry[]
  total_revenue: number
  total_commission: number
  mode: 'formulas' | 'manual'
}

const defaultConfigEntry = (): KpiConfigEntry => ({
  planned_calls: 0, no_shows: 0, lost_calls: 0, won_calls: 0,
  formulas: [], total_revenue: 0, total_commission: 0, mode: 'formulas',
})

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
  count_setter_commission?: boolean | null
}

const formatCurrency = (n: number) => n.toLocaleString('fr-FR')
const formatPercent = (n: number) => n.toFixed(1)

export function CloserKPI() {
  const { user, teamMember, ownerUserId, isTeamMember, isSolo } = useBusinessAuth()
  const { t, lang } = useBusinessLang()
  const [searchParams] = useSearchParams()
  const effectiveOwnerId = ownerUserId || user?.id
  const isOwnerView = !isTeamMember || teamMember?.role === 'Head of Sales' || teamMember?.role === 'Admin'
  const isFixedComp = teamMember?.compensation_type === 'fixed'
  const { prospects } = useBusinessProspects()
  const [activeTab, setActiveTab] = useState<'personal' | 'org' | 'offer' | 'campaign' | 'source'>(isOwnerView ? 'org' : 'personal')
  const [kpiConfig, setKpiConfig] = useState<KpiConfig>({ planned_calls: 20, revenue_target: 10000, commission_rate: 10 })
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [formulas, setFormulas] = useState<Formula[]>([])
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null)
  const [teamClosers, setTeamClosers] = useState<TeamCloser[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(searchParams.get('member'))
  const [campaigns, setCampaigns] = useState<{ id: string; name: string; source: string }[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)
  const [selectedSource, setSelectedSource] = useState<string | null>(null)
  // Global member filter (persists across tabs)
  const [globalMemberId, setGlobalMemberId] = useState<string | null>(searchParams.get('member'))
  // Formula commission rates
  const [formulaCommRates, setFormulaCommRates] = useState<Record<string, { roles: Record<string, number>; members: Record<string, number> }>>({})
  const [periodFrom, setPeriodFrom] = useState('')
  const [periodTo, setPeriodTo] = useState('')
  const [formulaBillingTypes, setFormulaBillingTypes] = useState<Record<string, string>>({})
  const [followupHistoryIds, setFollowupHistoryIds] = useState<Set<number>>(new Set())

  // Autre modal
  const [showAutreModal, setShowAutreModal] = useState(false)
  const [autreFilterCloser, setAutreFilterCloser] = useState<string>('all')
  const [autreFilterTeam, setAutreFilterTeam] = useState<string>('all')
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([])
  const [allTeamMembers, setAllTeamMembers] = useState<{ id: string; team_id: string | null }[]>([])

  // PDF export
  const pdfRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)

  // Personal KPI config (before joining org)
  const [personalConfigs, setPersonalConfigs] = useState<Record<string, KpiConfigEntry>>({})
  const configTab = 'global'
  const [savingConfig, setSavingConfig] = useState(false)
  const configMemberId = isOwnerView ? `owner_${user?.id}` : teamMember?.id

  // Load KPI config
  useEffect(() => {
    const memberId = isOwnerView ? `owner_${user?.id}` : teamMember?.id
    if (!memberId) {
      setLoading(false)
      return
    }
    setLoading(true)
    supabase
      .from('business_kpi_config')
      .select('*')
      .eq('team_member_id', memberId)
      .single()
      .then(({ data }) => {
        if (data?.config) {
          // Support both old format {planned_calls, revenue_target, commission_rate} and new {entries: {...}, ...legacy}
          const cfg = data.config as any
          if (cfg.entries) {
            setPersonalConfigs(cfg.entries)
          }
          // Keep legacy kpiConfig for commission rate fallback
          if (cfg.commission_rate !== undefined) setKpiConfig(cfg as KpiConfig)
          else if (cfg.planned_calls !== undefined) setKpiConfig(cfg as KpiConfig)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [teamMember?.id, user?.id, isOwnerView])

  // Load formulas for per-offer tab
  useEffect(() => {
    if (!effectiveOwnerId) return
    fetch(`/api/business?action=formulas-list&user_id=${effectiveOwnerId}`)
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
  }, [effectiveOwnerId])

  // Load business_prospect_history rows where prospects transitioned into the 'followup' stage
  useEffect(() => {
    if (!effectiveOwnerId) return
    let cancelled = false
    supabase
      .from('business_prospect_history')
      .select('prospect_id')
      .eq('business_owner_id', effectiveOwnerId)
      .eq('field_name', 'stage')
      .eq('new_value', 'followup')
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) { console.error('Erreur chargement followup history:', error); return }
        setFollowupHistoryIds(new Set((data || []).map((r: any) => r.prospect_id)))
      })
    return () => { cancelled = true }
  }, [effectiveOwnerId])

  // Load team closers + Owner/HoS for member selector
  useEffect(() => {
    if (!effectiveOwnerId) return
    Promise.all([
      supabase
        .from('business_team_members')
        .select('id, first_name, last_name, role, count_setter_commission')
        .eq('business_owner_id', effectiveOwnerId),
      supabase
        .from('business_users')
        .select('id, full_name')
        .eq('id', effectiveOwnerId)
        .single(),
    ]).then(([tmRes, ownerRes]) => {
      const allMembers: TeamCloser[] = []
      if (ownerRes.data) {
        const nameParts = (ownerRes.data.full_name || 'Owner').split(' ')
        allMembers.push({ id: ownerRes.data.id, first_name: nameParts[0] || 'Owner', last_name: nameParts.slice(1).join(' ') || '', role: 'Owner' })
      }
      if (tmRes.data) {
        allMembers.push(...tmRes.data.filter((m: TeamCloser) =>
          ['Closer', 'Setter-Closer', 'Head of Sales'].includes(m.role)
        ))
      }
      setTeamClosers(allMembers)
    }).catch(err => console.error('[CloserKPI] Error loading team closers:', err))
  }, [effectiveOwnerId])

  // Load teams + member team_ids
  useEffect(() => {
    if (!effectiveOwnerId) return
    Promise.all([
      supabase.from('business_teams').select('id, name').eq('business_owner_id', effectiveOwnerId),
      supabase.from('business_team_members').select('id, team_id').eq('business_owner_id', effectiveOwnerId),
    ]).then(([teamsRes, membersRes]) => {
      if (teamsRes.data) setTeams(teamsRes.data)
      if (membersRes.data) setAllTeamMembers(membersRes.data)
    }).catch(err => console.error('[CloserKPI] Error loading teams:', err))
  }, [effectiveOwnerId])

  // Load campaigns
  useEffect(() => {
    if (!effectiveOwnerId) return
    supabase
      .from('business_campaigns')
      .select('id, name, source')
      .eq('user_id', effectiveOwnerId)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setCampaigns(data)
          if (!selectedCampaignId) setSelectedCampaignId(data[0].id)
          if (!selectedSource) setSelectedSource(data[0].source || 'Direct')
        }
      })
      .catch(err => console.error('[CloserKPI] Error loading campaigns:', err))
  }, [effectiveOwnerId])

  // Load formula commission rates
  useEffect(() => {
    if (!effectiveOwnerId) return
    supabase.from('business_formula_commissions').select('formula_id, role, rate, team_member_id')
      .eq('business_owner_id', effectiveOwnerId)
      .then(({ data }) => {
        const map: Record<string, { roles: Record<string, number>; members: Record<string, number> }> = {}
        ;(data || []).forEach(c => {
          if (!map[c.formula_id]) map[c.formula_id] = { roles: {}, members: {} }
          if (c.team_member_id) {
            const sfx = c.role === 'Setter-Closer:setter' ? ':setter' : c.role === 'Setter-Closer:full' ? ':full' : ''
            map[c.formula_id].members[c.team_member_id + sfx] = c.rate
          } else if (c.role) {
            map[c.formula_id].roles[c.role] = c.rate
          }
        })
        setFormulaCommRates(map)
      })
      .catch(err => console.error('[CloserKPI] Error loading commission rates:', err))
    // Fetch formula billing types
    supabase.from('business_formulas').select('id, billing_type').eq('user_id', effectiveOwnerId)
      .then(({ data }) => {
        const map: Record<string, string> = {}
        ;(data || []).forEach(f => { map[f.id] = f.billing_type || 'one_time' })
        setFormulaBillingTypes(map)
      })
      .catch(err => console.error('[CloserKPI] Error loading formula billing types:', err))
  }, [effectiveOwnerId])

  const saveConfig = async () => {
    if (!configMemberId || !effectiveOwnerId) return
    setSavingConfig(true)
    const { error } = await supabase.from('business_kpi_config').upsert({
      team_member_id: configMemberId,
      business_owner_id: effectiveOwnerId,
      config: { ...kpiConfig, entries: personalConfigs },
    }, { onConflict: 'team_member_id' })
    setSavingConfig(false)
    if (error) { toast.error(t.kpi_save_error); return }
    toast.success(t.kpi_config_saved)
    setIsConfigOpen(false)
  }

  // Personal config helpers
  const getConfigForKey = (key: string): KpiConfigEntry => personalConfigs[key] || defaultConfigEntry()
  const updateConfigField = (key: string, field: string, value: any) => {
    setPersonalConfigs(prev => ({
      ...prev,
      [key]: { ...getConfigForKey(key), [field]: value },
    }))
  }
  const addFormula = (key: string) => {
    const cfg = getConfigForKey(key)
    setPersonalConfigs(prev => ({
      ...prev,
      [key]: { ...cfg, formulas: [...cfg.formulas, { name: '', price: 0, commission: 0, sales: 0 }] },
    }))
  }
  const removeFormula = (key: string, idx: number) => {
    const cfg = getConfigForKey(key)
    setPersonalConfigs(prev => ({
      ...prev,
      [key]: { ...cfg, formulas: cfg.formulas.filter((_, i) => i !== idx) },
    }))
  }
  const updateFormula = (key: string, idx: number, field: string, value: any) => {
    const cfg = getConfigForKey(key)
    const updated = cfg.formulas.map((f, i) => i === idx ? { ...f, [field]: value } : f)
    setPersonalConfigs(prev => ({
      ...prev,
      [key]: { ...cfg, formulas: updated },
    }))
  }

  // Compute totals from personal config (for Personnel tab)
  const personalConfigTotals = useMemo(() => {
    let planned = 0, noShows = 0, lost = 0, won = 0, revenue = 0, commission = 0
    Object.values(personalConfigs).forEach(entry => {
      planned += entry.planned_calls || 0
      noShows += entry.no_shows || 0
      lost += entry.lost_calls || 0
      won += entry.won_calls || 0
      if (entry.mode === 'formulas') {
        entry.formulas.forEach(f => {
          revenue += (f.price || 0) * (f.sales || 0)
          commission += (f.price || 0) * ((f.commission || 0) / 100) * (f.sales || 0)
        })
      } else {
        revenue += entry.total_revenue || 0
        commission += entry.total_commission || 0
      }
    })
    return { planned, noShows, lost, won, revenue: Math.round(revenue), commission: Math.round(commission) }
  }, [personalConfigs])

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
    const revenue = won.reduce((sum: number, p: any) => sum + getProspectCA(p, formulaBillingTypes), 0)
    // Conversion: no-shows count only if they came from follow-up
    const noshowFromFollowup = noShow.filter((p: any) => p.previous_stage === 'followup')
    const closedTotal = won.length + lost.length + noshowFromFollowup.length
    const conversionRate = closedTotal > 0 ? (won.length / closedTotal) * 100 : 0
    // No-show rate: denominator = all qualified prospects who had an appointment (excludes prospect, unqualified, noanswer)
    const qualifiedWithRdv = src.filter((p: any) => !['prospect', 'contacted', 'unqualified', 'noanswer'].includes(p.stage))
    const noShowRate = qualifiedWithRdv.length > 0 ? (noShow.length / qualifiedWithRdv.length) * 100 : 0
    // Follow-up rate: % of prospects in scope who passed through the 'followup' stage at any point
    const everInFollowup = src.filter((p: any) =>
      p.stage === 'followup'
      || p.previous_stage === 'followup'
      || followupHistoryIds.has(p.id)
    )
    const followupRate = src.length > 0 ? (everInFollowup.length / src.length) * 100 : 0
    // R2 closing rate: % of follow-up prospects who ended up won
    const wonAfterFollowup = everInFollowup.filter((p: any) => p.stage === 'won')
    const r2ClosingRate = everInFollowup.length > 0 ? (wonAfterFollowup.length / everInFollowup.length) * 100 : 0
    return { won, noShow, lost, revenue, closedTotal, conversionRate, noShowRate, followupRate, r2ClosingRate }
  }

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

  // Compute closer commission using formula-level rates
  // For each won prospect: look up the commission rate for role "Closer" (or member-specific override)
  // Falls back to kpiConfig.commission_rate if no formula rate is configured
  const computeCloserCommission = (wonProspects: any[], memberId?: string) => {
    // Find member role to determine which rate key to use
    const member = memberId ? teamClosers.find(m => m.id === memberId) : null
    const memberRole = member?.role
    let total = 0
    for (const p of wonProspects) {
      const value = getProspectCA(p, formulaBillingTypes)
      if (!value) continue
      // Commission inhabituelle approved : prend toujours le taux custom
      if (p.custom_commission_rate != null && p.commission_approval_status !== 'rejected') {
        total += value * Number(p.custom_commission_rate) / 100
        continue
      }
      const formulaId = p.formula_id || p.offer_id
      const rates = formulaId ? formulaCommRates[formulaId] : null
      if (rates) {
        // Full-cycle: this Setter-Closer also set the deal → one dedicated rate replaces closing+setting
        const countSetter = member?.count_setter_commission !== false
        const fullCycle = memberRole === 'Setter-Closer' && countSetter && memberId && p.assigned_setter === memberId
        const fullRate = fullCycle
          ? ((rates.members[`${memberId}:full`] ?? 0) > 0 ? rates.members[`${memberId}:full`] : ((rates.roles['Setter-Closer:full'] ?? 0) > 0 ? rates.roles['Setter-Closer:full'] : null))
          : null
        // Member-specific rate first (the default key for Setter-Closers is their closing rate)
        if (fullRate != null) {
          total += value * fullRate / 100
        } else if (memberId && rates.members[memberId] !== undefined) {
          total += value * rates.members[memberId] / 100
        } else if (memberRole === 'Setter-Closer' && rates.roles['Setter-Closer'] !== undefined) {
          // Setter-Closer closing rate
          total += value * rates.roles['Setter-Closer'] / 100
        } else if (rates.roles['Closer'] !== undefined) {
          total += value * rates.roles['Closer'] / 100
        } else {
          total += value * (kpiConfig.commission_rate / 100)
        }
      } else {
        total += value * (kpiConfig.commission_rate / 100)
      }
    }
    return Math.round(total)
  }

  // Personal KPIs
  const closerMemberIds = useMemo(() => new Set(teamClosers.map(c => c.id)), [teamClosers])
  const myProspects = isOwnerView
    ? periodProspects.filter(p => !p.assigned_to || !closerMemberIds.has(p.assigned_to))
    : periodProspects.filter(p => p.assigned_to === teamMember?.id)
  const personal = computeCloserKpis(myProspects)
  const commission = computeCloserCommission(personal.won, teamMember?.id)

  // Org KPIs (filtered by member if selected)
  const orgProspects = useMemo(() => filterByMember(periodProspects, globalMemberId), [periodProspects, globalMemberId])
  const org = computeCloserKpis(orgProspects)
  const orgCommission = computeCloserCommission(org.won, globalMemberId || undefined)

  // Per-formula KPIs
  const formulaProspects = useMemo(() => {
    if (!selectedOfferId) return []
    const base = isOwnerView ? periodProspects : myProspects
    const filtered = base.filter(p => (p as any).offer_id === selectedOfferId || (p as any).formula_id === selectedOfferId)
    return filterByMember(filtered, globalMemberId)
  }, [isOwnerView, myProspects, periodProspects, selectedOfferId, globalMemberId])

  const formula = computeCloserKpis(formulaProspects)
  const formulaCommission = computeCloserCommission(formula.won, globalMemberId || teamMember?.id)

  // Per-campaign KPIs
  const campaignProspects = useMemo(() => {
    if (!selectedCampaignId) return []
    const base = isOwnerView ? periodProspects : myProspects
    const filtered = base.filter(p => (p as any).campaign_id === selectedCampaignId)
    return filterByMember(filtered, globalMemberId)
  }, [isOwnerView, myProspects, prospects, selectedCampaignId, globalMemberId])

  const campaign = computeCloserKpis(campaignProspects)
  const campaignCommission = computeCloserCommission(campaign.won, globalMemberId || teamMember?.id)

  // Per-source KPIs
  const sourceProspects = useMemo(() => {
    if (!selectedSource) return []
    const campaignIds = campaigns.filter(c => (c.source || 'Direct') === selectedSource).map(c => c.id)
    const base = isOwnerView ? periodProspects : myProspects
    const filtered = base.filter(p => campaignIds.includes((p as any).campaign_id))
    return filterByMember(filtered, globalMemberId)
  }, [isOwnerView, myProspects, prospects, selectedSource, campaigns, globalMemberId])

  const source = computeCloserKpis(sourceProspects)
  const sourceCommission = computeCloserCommission(source.won, globalMemberId || teamMember?.id)

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
        monthMap[key].commission += computeCloserCommission([p], globalMemberId || teamMember?.id)
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
      followupRate: kpis.followupRate, r2ClosingRate: kpis.r2ClosingRate,
      leads: src.length, deals: src.filter(p => !['won', 'lost', 'noshow', 'noanswer'].includes(p.stage)).length,
    })
    if (activeTab === 'org') return makeVals(org, orgCommission, orgProspects)
    if (activeTab === 'offer') return makeVals(formula, formulaCommission, formulaProspects)
    if (activeTab === 'campaign') return makeVals(campaign, campaignCommission, campaignProspects)
    if (activeTab === 'source') return makeVals(source, sourceCommission, sourceProspects)
    // Personal tab: org data + configured data
    const base = makeVals(personal, commission, myProspects)
    const totalSales = base.sales + personalConfigTotals.won
    const totalLost = base.lost + personalConfigTotals.lost
    const totalNoShow = (personal.noShow?.length || 0) + personalConfigTotals.noShows
    const totalDecided = totalSales + totalLost + totalNoShow
    return {
      ...base,
      revenue: base.revenue + personalConfigTotals.revenue,
      sales: totalSales,
      commission: base.commission + personalConfigTotals.commission,
      lost: totalLost,
      leads: base.leads + personalConfigTotals.planned,
      noShowRate: totalDecided > 0 ? (totalNoShow / totalDecided) * 100 : base.noShowRate,
      conversion: totalDecided > 0 ? (totalSales / totalDecided) * 100 : base.conversion,
    }
  }

  const v = getTabValues()
  const avgCommission = v.sales > 0 ? Math.round(v.commission / v.sales) : 0

  // Loss reason pie chart data
  const LOSS_REASON_COLORS: Record<string, string> = {
    'Je dois y réfléchir': '#6366f1', 'Argent/budget': '#f59e0b', 'Doit en parler': '#8b5cf6',
    "C'est pas le moment": '#64748b', 'Peur': '#ef4444', 'Ecran de fumée': '#f97316', 'Autre': '#a1a1aa',
  }
  const lossReasonData = useMemo(() => {
    const tabSource = activeTab === 'personal' ? myProspects : activeTab === 'org' ? orgProspects : activeTab === 'offer' ? formulaProspects : activeTab === 'campaign' ? campaignProspects : activeTab === 'source' ? sourceProspects : orgProspects
    const lost = tabSource.filter((p: any) => p.stage === 'lost')
    const counts: Record<string, number> = {}
    lost.forEach((p: any) => {
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
      .map(([name, value]) => ({ name, value, color: LOSS_REASON_COLORS[name] || '#d4d4d8' }))
      .sort((a, b) => b.value - a.value)
  }, [myProspects, orgProspects, formulaProspects, campaignProspects, sourceProspects, activeTab])

  // Autre details for modal
  const autreDetails = useMemo(() => {
    const tabSource = activeTab === 'personal' ? myProspects : activeTab === 'org' ? orgProspects : activeTab === 'offer' ? formulaProspects : activeTab === 'campaign' ? campaignProspects : activeTab === 'source' ? sourceProspects : orgProspects
    const teamMemberIds = autreFilterTeam !== 'all' ? allTeamMembers.filter(m => m.team_id === autreFilterTeam).map(m => m.id) : null
    return tabSource
      .filter((p: any) => p.stage === 'lost')
      .filter((p: any) => {
        let reason = p.loss_reason
        if (!reason && Array.isArray(p.call_notes)) {
          for (let i = p.call_notes.length - 1; i >= 0; i--) {
            const match = p.call_notes[i].content?.match(/- Motif: (.+)/)
            if (match) { reason = match[1]; break }
          }
        }
        return reason === 'Autre'
      })
      .filter((p: any) => autreFilterCloser === 'all' || p.assigned_to === autreFilterCloser)
      .filter((p: any) => !teamMemberIds || teamMemberIds.includes(p.assigned_to))
      .map((p: any) => {
        const closer = teamClosers.find(m => m.id === p.assigned_to)
        return {
          id: p.id,
          motif: p.loss_details || 'Non précisé',
          prospect: p.contact || p.company || `Prospect #${p.id}`,
          closer: closer ? `${closer.first_name} ${closer.last_name}`.trim() : 'Non assigné',
          date: p.created_at,
        }
      })
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [myProspects, orgProspects, formulaProspects, campaignProspects, sourceProspects, activeTab, autreFilterCloser, autreFilterTeam, allTeamMembers, teamClosers])

  const openAutreModal = () => {
    // Pre-fill closer filter based on current view
    if (globalMemberId) {
      setAutreFilterCloser(globalMemberId)
    } else if (activeTab === 'personal' && !isOwnerView && teamMember) {
      setAutreFilterCloser(teamMember.id)
    } else {
      setAutreFilterCloser('all')
    }
    setAutreFilterTeam('all')
    setShowAutreModal(true)
  }

  const inputCls = "w-full rounded-xl border border-stone-200 dark:border-white/10 px-4 py-2.5 text-sm text-stone-900 dark:text-white dark:bg-neutral-800 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400"

  // Member selector component
  // Tabs definition
  const tabs = isOwnerView
    ? [
        { key: 'org' as const, label: t.kpi_tab_org },
        { key: 'offer' as const, label: t.kpi_tab_by_formula },
        { key: 'campaign' as const, label: t.kpi_tab_by_campaign },
        { key: 'source' as const, label: t.kpi_tab_by_source },
        { key: 'personal' as const, label: t.kpi_tab_personal },
      ]
    : [
        { key: 'personal' as const, label: t.kpi_tab_personal },
        { key: 'org' as const, label: t.kpi_tab_org },
        { key: 'offer' as const, label: t.kpi_tab_by_formula },
        { key: 'campaign' as const, label: t.kpi_tab_by_campaign },
        { key: 'source' as const, label: t.kpi_tab_by_source },
      ]

  const handleExportPdf = async () => {
    if (!pdfRef.current) return
    setExporting(true)
    try {
      const periodLabel = periodFrom || periodTo
        ? `${periodFrom || '...'} → ${periodTo || '...'}`
        : t.kpi_all_periods
      const opt = {
        margin: 10,
        filename: `KPI-Closer-${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff', windowWidth: 900 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
      }
      await html2pdf().set(opt).from(pdfRef.current).save()
      toast.success(t.kpi_pdf_exported)
    } catch (err) {
      console.error('PDF export error:', err)
      toast.error(t.kpi_pdf_export_error)
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
    ? `${periodFrom ? new Date(periodFrom + 'T00:00:00').toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '...'} → ${periodTo ? new Date(periodTo + 'T00:00:00').toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '...'}`
    : t.kpi_all_periods

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 dark:bg-white/5">
            <TrendingUp className="h-5 w-5 text-stone-700 dark:text-neutral-200" />
          </div>
          <div>
            <p className="text-xs font-bold tracking-widest uppercase text-stone-500 dark:text-neutral-400 mb-1">{t.kpi_performance_closer.toUpperCase()}</p>
            <h1 className="text-4xl font-extrabold tracking-tight text-stone-900 dark:text-white">{t.kpi_performance_closer}</h1>
            <p className="text-sm text-stone-500 dark:text-neutral-400">{isOwnerView ? t.kpi_team_overview : t.kpi_your_performance}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsConfigOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-stone-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm font-medium text-stone-600 dark:text-neutral-300 hover:bg-stone-50 dark:hover:bg-white/10 transition-colors"
          >
            <Settings className="h-4 w-4" /> {t.kpi_configure}
          </button>
          <button
            onClick={handleExportPdf}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-stone-900 dark:bg-white text-sm font-bold text-white dark:text-stone-900 hover:opacity-90 transition-all disabled:opacity-50 active:scale-95"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {t.kpi_export_pdf}
          </button>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <CalendarDays className="h-4 w-4 text-stone-400" />
        <span className="text-xs font-bold uppercase tracking-widest text-stone-500 dark:text-neutral-400">{t.kpi_period_label}</span>
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
            {t.kpi_reset}
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
        {isOwnerView && !isSolo && teamClosers.length > 0 && (
          <div className="flex items-center gap-2 bg-white dark:bg-white/5 rounded-full border border-stone-200 dark:border-white/10 pl-3 pr-1 py-1 shadow-sm">
            <Users className="h-4 w-4 text-stone-400 shrink-0" />
            <select
              value={globalMemberId || ''}
              onChange={(e) => setGlobalMemberId(e.target.value || null)}
              className="bg-transparent text-sm font-semibold text-stone-900 dark:text-white pr-6 py-1.5 focus:outline-none appearance-none cursor-pointer"
            >
              <option value="">{t.kpi_all_members}</option>
              {teamClosers.map(c => (
                <option key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.role})</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {activeTab === 'org' && (
        <div className="rounded-xl bg-stone-50 dark:bg-white/5 border border-stone-200 dark:border-white/10 px-4 py-3">
          <p className="text-sm text-stone-700">{t.kpi_org_kpis}</p>
        </div>
      )}

      {activeTab === 'offer' && (
        <div className="rounded-xl bg-stone-50 dark:bg-white/5 border border-stone-200 dark:border-white/10 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-stone-700 dark:text-neutral-200 shrink-0">{t.kpi_by_formula_label}</p>
            <div className="flex items-center gap-2">
              <select
                value={selectedOfferId || ''}
                onChange={(e) => setSelectedOfferId(e.target.value)}
                className="rounded-lg border border-stone-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-stone-900 dark:text-white px-3 py-1.5 focus:border-stone-400 focus:outline-none"
              >
                {formulas.length === 0 && <option value="">{t.kpi_no_formula}</option>}
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
            <p className="text-sm text-stone-700 dark:text-neutral-200 shrink-0">{t.kpi_by_campaign_label}</p>
            <div className="flex items-center gap-2">
              <select
                value={selectedCampaignId || ''}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                className="rounded-lg border border-stone-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-stone-900 dark:text-white px-3 py-1.5 focus:border-stone-400 focus:outline-none"
              >
                {campaigns.length === 0 && <option value="">{t.kpi_no_campaign}</option>}
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
            <p className="text-sm text-stone-700 dark:text-neutral-200 shrink-0">{t.kpi_by_source_label}</p>
            <div className="flex items-center gap-2">
              <select
                value={selectedSource || ''}
                onChange={(e) => setSelectedSource(e.target.value)}
                className="rounded-lg border border-stone-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-stone-900 dark:text-white px-3 py-1.5 focus:border-stone-400 focus:outline-none"
              >
                {uniqueSources.length === 0 && <option value="">{t.kpi_no_source}</option>}
                {uniqueSources.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* PDF export content */}
      <div ref={pdfRef} className="space-y-6">
      {/* PDF header (hidden on screen, visible in PDF) */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-extrabold text-stone-900">{t.kpi_performance_closer} — {periodLabel}</h1>
        <p className="text-sm text-stone-500">{t.kpi_exported_on} {new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard title={t.kpi_ca_generated} value={`${formatCurrency(v.revenue)} €`} icon={DollarSign} color="emerald" />
        <KpiCard title={t.kpi_total_sales} value={v.sales} icon={ShoppingCart} color="blue" />
        <KpiCard title={t.kpi_closing_rate} value={`${formatPercent(v.conversion)}%`} icon={Target} color="purple" />
        {!isFixedComp && !isSolo && <KpiCard title={isOwnerView ? t.kpi_commissions : t.kpi_my_commissions} value={`${formatCurrency(v.commission)} €`} icon={Award} color="stone" highlight />}
        <KpiCard title={t.kpi_noshow_rate} value={`${formatPercent(v.noShowRate)}%`} icon={UserX} color="rose" />
        <KpiCard title={t.kpi_deals_lost} value={v.lost} icon={Ban} color="stone" />
        <KpiCard title={t.kpi_followup_rate} value={`${formatPercent(v.followupRate)}%`} icon={Repeat} color="amber" />
        <KpiCard title={t.kpi_r2_closing_rate} value={`${formatPercent(v.r2ClosingRate)}%`} icon={Repeat2} color="purple" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-white/5 rounded-2xl border border-stone-200 dark:border-neutral-700/50 p-5 shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)]">
          <h3 className="text-sm font-bold tracking-widest uppercase text-stone-500 dark:text-neutral-400 mb-4">{t.kpi_closing_rate_chart}</h3>
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

        {!isFixedComp && !isSolo && (
        <div className="bg-white dark:bg-white/5 rounded-2xl border border-stone-200 dark:border-neutral-700/50 p-5 shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)]">
          <h3 className="text-sm font-bold tracking-widest uppercase text-stone-500 dark:text-neutral-400 mb-4">{t.kpi_commission_chart}</h3>
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
        )}
      </div>

      {/* Loss Reason Pie Chart */}
      {lossReasonData.length > 0 && (
      <div className="bg-white dark:bg-white/5 rounded-2xl border border-stone-200 dark:border-neutral-700/50 p-5 shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)]">
        <h3 className="text-sm font-bold tracking-widest uppercase text-stone-500 dark:text-neutral-400 mb-4">{t.kpi_loss_reasons}</h3>
        <div className="flex flex-col lg:flex-row items-center gap-8">
          <div className="w-56 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={lossReasonData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value">
                  {lossReasonData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e7e5e4', fontSize: 12 }} formatter={(v: number) => [v, 'Deals']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-3">
            {lossReasonData.map(d => {
              const total = lossReasonData.reduce((s, r) => s + r.value, 0)
              const isAutre = d.name === 'Autre'
              return (
                <div
                  key={d.name}
                  className={`flex justify-between items-center ${isAutre ? 'cursor-pointer hover:bg-stone-50 dark:hover:bg-neutral-800 -mx-3 px-3 py-1.5 rounded-xl transition-colors' : ''}`}
                  onClick={isAutre ? openAutreModal : undefined}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className={`text-sm font-medium text-stone-700 dark:text-neutral-200 ${isAutre ? 'underline decoration-dashed underline-offset-4' : ''}`}>{d.name}</span>
                    {isAutre && <ArrowRight className="h-3.5 w-3.5 text-stone-400" />}
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

      {/* Autre Loss Reasons Modal */}
      {showAutreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAutreModal(false)} />
          <div className="relative w-full max-w-3xl max-h-[85vh] bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl border border-stone-200/20 dark:border-neutral-700 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-stone-100 dark:border-neutral-800">
              <div>
                <h3 className="text-lg font-extrabold text-stone-900 dark:text-white">{t.kpi_autre_details_title}</h3>
                <p className="text-xs text-stone-500 dark:text-neutral-400 mt-1">{t.kpi_autre_results.replace('{n}', String(autreDetails.length))}</p>
              </div>
              <button onClick={() => setShowAutreModal(false)} className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-neutral-800 transition-colors">
                <X className="h-5 w-5 text-stone-500" />
              </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-stone-100 dark:border-neutral-800 bg-stone-50/50 dark:bg-neutral-800/50">
              <Filter className="h-4 w-4 text-stone-400 shrink-0" />
              {/* Closer */}
              <select
                value={autreFilterCloser}
                onChange={e => setAutreFilterCloser(e.target.value)}
                className="text-xs font-bold bg-white dark:bg-neutral-800 border border-stone-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-stone-700 dark:text-neutral-200 outline-none focus:ring-2 focus:ring-stone-900/10"
              >
                <option value="all">{t.kpi_all_closers}</option>
                {teamClosers.map(m => (
                  <option key={m.id} value={m.id}>{m.first_name} {m.last_name} ({m.role})</option>
                ))}
              </select>
              {/* Team */}
              {teams.length > 0 && (
                <select
                  value={autreFilterTeam}
                  onChange={e => setAutreFilterTeam(e.target.value)}
                  className="text-xs font-bold bg-white dark:bg-neutral-800 border border-stone-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-stone-700 dark:text-neutral-200 outline-none focus:ring-2 focus:ring-stone-900/10"
                >
                  <option value="all">{t.kpi_all_teams}</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Table */}
            <div className="overflow-y-auto flex-1">
              {autreDetails.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-stone-400 dark:text-neutral-500">
                  <UserX className="h-10 w-10 mb-3 opacity-50" />
                  <p className="text-sm font-medium">{t.kpi_no_autre_found}</p>
                  <p className="text-xs mt-1">{t.kpi_try_change_filters}</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-stone-100 dark:border-neutral-800">
                      <th className="text-left text-[10px] uppercase tracking-widest font-bold text-stone-400 dark:text-neutral-500 px-6 py-3">{t.kpi_autre_header_motif}</th>
                      <th className="text-left text-[10px] uppercase tracking-widest font-bold text-stone-400 dark:text-neutral-500 px-6 py-3">{t.kpi_autre_header_prospect}</th>
                      <th className="text-left text-[10px] uppercase tracking-widest font-bold text-stone-400 dark:text-neutral-500 px-6 py-3">{t.kpi_autre_header_closer}</th>
                      <th className="text-right text-[10px] uppercase tracking-widest font-bold text-stone-400 dark:text-neutral-500 px-6 py-3">{t.kpi_autre_header_date}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {autreDetails.map((row: any) => (
                      <tr key={row.id} className="border-b border-stone-50 dark:border-neutral-800/50 hover:bg-stone-50/50 dark:hover:bg-neutral-800/30 transition-colors">
                        <td className="px-6 py-3.5 text-sm font-medium text-stone-900 dark:text-white max-w-[200px]">
                          <span className="line-clamp-2">{row.motif}</span>
                        </td>
                        <td className="px-6 py-3.5 text-sm text-stone-600 dark:text-neutral-300">{row.prospect}</td>
                        <td className="px-6 py-3.5 text-sm text-stone-600 dark:text-neutral-300">{row.closer}</td>
                        <td className="px-6 py-3.5 text-xs text-stone-400 dark:text-neutral-500 text-right whitespace-nowrap">
                          {new Date(row.date).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pipeline Summary */}
      <div className="bg-stone-900 text-white rounded-2xl p-6">
        <h3 className="text-sm font-bold tracking-widest uppercase text-stone-400 mb-4">{t.kpi_pipeline_summary}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SummaryItem label={t.kpi_total_leads} value={v.leads} icon={Users} color="indigo" dark />
          <SummaryItem label={t.kpi_deals_in_progress} value={v.deals} icon={Briefcase} color="cyan" dark />
          {!isFixedComp && !isSolo && <SummaryItem label={t.kpi_avg_comm} value={`${formatCurrency(avgCommission)} €`} icon={Award} color="stone" dark />}
        </div>
      </div>
      </div>{/* end pdfRef */}

      {/* Config Modal — Personal KPI (before joining org) */}
      {isConfigOpen && (() => {
        const cfg = getConfigForKey(configTab)
        const cfgMode = cfg.mode || 'formulas'
        return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setIsConfigOpen(false)} />
          <div className="relative w-full max-w-xl mx-4 bg-white dark:bg-[#1a1a1a] rounded-2xl border border-stone-200 dark:border-white/10 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-stone-100 dark:border-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-stone-100 dark:bg-blue-600/20 rounded-lg border border-stone-200 dark:border-blue-500/30">
                  <Settings className="w-5 h-5 text-stone-600 dark:text-blue-400" />
                </div>
                <h2 className="text-xl font-bold text-stone-900 dark:text-white">{t.kpi_config_title}</h2>
              </div>
              <button onClick={() => setIsConfigOpen(false)} className="p-2 rounded-lg text-stone-400 hover:bg-stone-100 dark:hover:bg-white/5 hover:text-stone-600 dark:hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Warning */}
            <div className="mx-6 mt-4 flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
              <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400 flex-shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-300">{lang === 'fr' ? 'Renseignez ici vos KPI avant de rejoindre l\'organisation' : 'Enter your KPI from before joining the organization'}</p>
            </div>
            <p className="mx-6 mt-3 text-xs text-stone-400 dark:text-white/40 italic">{lang === 'fr' ? 'Ces données apparaîtront uniquement dans l\'onglet Personnel.' : 'This data will only appear in the Personal tab.'}</p>

            {/* Form body */}
            <div className="p-6 space-y-4 max-h-[50vh] overflow-y-auto">
              {/* 4 call count fields */}
              {[
                { key: 'planned_calls', label: lang === 'fr' ? 'Combien de calls prévus initialement ?' : 'How many calls originally planned?', icon: '📞' },
                { key: 'no_shows', label: lang === 'fr' ? 'Combien de no show ?' : 'How many no shows?', icon: '👻' },
                { key: 'lost_calls', label: lang === 'fr' ? 'Combien de calls perdus ?' : 'How many lost calls?', icon: '❌' },
                { key: 'won_calls', label: lang === 'fr' ? 'Combien de calls gagnés ?' : 'How many won calls?', icon: '✅' },
              ].map(f => (
                <div key={f.key}>
                  <label className="flex items-center gap-2 text-sm font-medium text-stone-600 dark:text-white/60 mb-1.5">
                    <span>{f.icon}</span> {f.label}
                  </label>
                  <input type="number" min={0} value={(cfg as any)[f.key] as number}
                    onChange={e => updateConfigField(configTab, f.key, parseInt(e.target.value) || 0)}
                    className="w-full rounded-lg border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/5 px-4 py-2.5 text-sm text-stone-900 dark:text-white focus:outline-none focus:border-stone-400 dark:focus:border-blue-500" />
                </div>
              ))}

              {/* Mode switch + formulas or manual */}
              <div className="mt-4 space-y-4">
                <div className="flex items-center gap-1 p-1 rounded-xl bg-stone-100 dark:bg-white/[0.03] border border-stone-200 dark:border-white/5">
                  <button onClick={() => updateConfigField(configTab, 'mode', 'formulas')}
                    className={cn('flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all',
                      cfgMode === 'formulas' ? 'bg-stone-900 dark:bg-gradient-to-r dark:from-emerald-600 dark:to-teal-600 text-white shadow-lg' : 'text-stone-400 dark:text-white/40 hover:text-stone-900 dark:hover:text-white'
                    )}>
                    {lang === 'fr' ? 'Calcul auto (formules)' : 'Auto calc (formulas)'}
                  </button>
                  <button onClick={() => updateConfigField(configTab, 'mode', 'manual')}
                    className={cn('flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all',
                      cfgMode === 'manual' ? 'bg-stone-900 dark:bg-gradient-to-r dark:from-blue-600 dark:to-indigo-600 text-white shadow-lg' : 'text-stone-400 dark:text-white/40 hover:text-stone-900 dark:hover:text-white'
                    )}>
                    {lang === 'fr' ? 'Saisie manuelle' : 'Manual entry'}
                  </button>
                </div>

                {cfgMode === 'formulas' && (
                  <div className="rounded-xl border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/[0.03] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-stone-900 dark:text-white">{lang === 'fr' ? 'Formules' : 'Formulas'}</h4>
                      <button onClick={() => addFormula(configTab)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-stone-200 dark:bg-emerald-600/20 border border-stone-300 dark:border-emerald-500/30 text-xs font-medium text-stone-700 dark:text-emerald-400 hover:bg-stone-300 dark:hover:bg-emerald-600/30 transition-colors">
                        <Plus className="w-3.5 h-3.5" /> {lang === 'fr' ? 'Ajouter' : 'Add'}
                      </button>
                    </div>
                    {cfg.formulas.length === 0 && (
                      <p className="text-xs text-stone-400 dark:text-white/40 italic">{lang === 'fr' ? 'Aucune formule. Cliquez sur "Ajouter" pour en créer une.' : 'No formulas. Click "Add" to create one.'}</p>
                    )}
                    {cfg.formulas.map((fm, idx) => (
                      <div key={idx} className="rounded-lg border border-stone-200 dark:border-white/5 bg-white dark:bg-white/[0.03] p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-stone-400 dark:text-white/40">{lang === 'fr' ? 'Formule' : 'Formula'} {idx + 1}</span>
                          <button onClick={() => removeFormula(configTab, idx)} className="p-1 rounded text-red-400/60 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div>
                          <label className="text-xs text-stone-400 dark:text-white/40 mb-1 block">{lang === 'fr' ? 'Nom' : 'Name'}</label>
                          <input type="text" value={fm.name} onChange={e => updateFormula(configTab, idx, 'name', e.target.value)} placeholder="Ex: Formule Gold"
                            className="w-full rounded-lg border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/5 px-3 py-2 text-sm text-stone-900 dark:text-white focus:outline-none focus:border-stone-400 dark:focus:border-blue-500" />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="text-xs text-stone-400 dark:text-white/40 mb-1 block">{lang === 'fr' ? 'Prix (€)' : 'Price (€)'}</label>
                            <input type="number" min={0} value={fm.price} onChange={e => updateFormula(configTab, idx, 'price', parseFloat(e.target.value) || 0)}
                              className="w-full rounded-lg border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/5 px-3 py-2 text-sm text-stone-900 dark:text-white focus:outline-none focus:border-stone-400" />
                          </div>
                          <div>
                            <label className="text-xs text-stone-400 dark:text-white/40 mb-1 block">{lang === 'fr' ? 'Commission (%)' : 'Commission (%)'}</label>
                            <input type="number" min={0} max={100} value={fm.commission} onChange={e => updateFormula(configTab, idx, 'commission', parseFloat(e.target.value) || 0)}
                              className="w-full rounded-lg border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/5 px-3 py-2 text-sm text-stone-900 dark:text-white focus:outline-none focus:border-stone-400" />
                          </div>
                          <div>
                            <label className="text-xs text-stone-400 dark:text-white/40 mb-1 block">{lang === 'fr' ? 'Ventes' : 'Sales'}</label>
                            <input type="number" min={0} value={fm.sales || 0} onChange={e => updateFormula(configTab, idx, 'sales', parseInt(e.target.value) || 0)}
                              className="w-full rounded-lg border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/5 px-3 py-2 text-sm text-stone-900 dark:text-white focus:outline-none focus:border-stone-400" />
                          </div>
                        </div>
                        {(fm.sales || 0) > 0 && fm.price > 0 && fm.commission > 0 && (
                          <div className="text-xs text-emerald-600 dark:text-emerald-400/80 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg px-3 py-1.5 border border-emerald-200 dark:border-emerald-500/20">
                            {lang === 'fr' ? 'Commission calculée' : 'Calculated commission'} : <span className="font-bold">{((fm.price * (fm.commission / 100)) * (fm.sales || 0)).toLocaleString('fr-FR')} €</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {cfgMode === 'manual' && (
                  <div className="rounded-xl border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/[0.03] p-4 space-y-3">
                    <h4 className="text-sm font-bold text-stone-900 dark:text-white">{lang === 'fr' ? 'Revenus' : 'Revenue'}</h4>
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-stone-600 dark:text-white/60 mb-1.5"><span>💰</span> {lang === 'fr' ? 'CA Généré (€)' : 'Revenue (€)'}</label>
                      <input type="number" min={0} value={cfg.total_revenue} onChange={e => updateConfigField(configTab, 'total_revenue', parseFloat(e.target.value) || 0)}
                        className="w-full rounded-lg border border-stone-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2.5 text-sm text-stone-900 dark:text-white focus:outline-none focus:border-emerald-500" />
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-stone-600 dark:text-white/60 mb-1.5"><span>🏆</span> {lang === 'fr' ? 'Commission touchée (€)' : 'Commission earned (€)'}</label>
                      <input type="number" min={0} value={cfg.total_commission} onChange={e => updateConfigField(configTab, 'total_commission', parseFloat(e.target.value) || 0)}
                        className="w-full rounded-lg border border-stone-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2.5 text-sm text-stone-900 dark:text-white focus:outline-none focus:border-amber-500" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 pb-6">
              <button onClick={() => setIsConfigOpen(false)} className="px-4 py-2.5 rounded-xl text-sm font-medium text-stone-400 hover:text-stone-600 dark:hover:text-white transition-colors">
                {t.common_cancel}
              </button>
              <button onClick={saveConfig} disabled={savingConfig}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-stone-900 dark:bg-gradient-to-r dark:from-blue-600 dark:to-indigo-600 text-sm font-bold text-white hover:opacity-90 transition-all shadow-lg disabled:opacity-50">
                <Save className="w-4 h-4" />
                {savingConfig ? '...' : t.common_save}
              </button>
            </div>
          </div>
        </div>
        )
      })()}
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
    <div className="flex items-center gap-6 p-3 rounded-xl transition-colors">
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
