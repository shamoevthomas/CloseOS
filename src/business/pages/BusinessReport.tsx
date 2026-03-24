import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  FileText, Download, Loader2, CalendarDays, Users, Megaphone,
  TrendingUp, DollarSign, UserCheck, UserX, Target, Activity,
  ShoppingCart, Eye, Clock, ChevronDown, LogIn, LogOut as LogOutIcon,
  Phone, Bell, GitBranch, Calendar, ChevronRight, ArrowRight,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { supabase } from '../../lib/supabase'
// @ts-ignore
import html2pdf from 'html2pdf.js'

// ─── Types ───

interface TeamMember {
  id: string
  first_name: string
  last_name: string
  email: string
  role: string
  joined_at: string
}

interface ActivityEvent {
  id: string
  member_name: string
  member_id: string
  action: string
  detail: string
  timestamp: Date
  icon: any
  color: string
}

interface Prospect {
  id: number
  stage: string
  value: number | null
  created_at: string
  campaign_id: string | null
  payment_type: string | null
  installments: number | null
  loss_reason?: string | null
  call_notes?: { id: string; date: string; content: string; author?: string }[]
}

interface Campaign {
  id: string
  name: string
  views: number
  is_active: boolean
  created_at: string
}

interface Appointment {
  id: string
  status: string
  date: string
  campaign_id: string | null
  prospect_id: number | null
  created_at: string
}

// ─── Helpers ───

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

const formatPct = (v: number) => `${v.toFixed(1)}%`

const STAGE_COLORS: Record<string, string> = {
  prospect: '#006c49',
  qualified: '#ffb95f',
  unqualified: '#c4c7c7',
  followup: '#1b1c1b',
  won: '#006c49',
  lost: '#ba1a1a',
  noanswer: '#747878',
  noshow: '#444748',
}

const PERIODS = [
  { label: "Aujourd'hui", days: 1 },
  { label: '7 jours', days: 7 },
  { label: '14 jours', days: 14 },
  { label: '30 jours', days: 30 },
  { label: '90 jours', days: 90 },
  { label: '6 mois', days: 180 },
  { label: '1 an', days: 365 },
  { label: 'Tout', days: 0 },
]

const ROLE_COLORS: Record<string, string> = {
  Closer: 'bg-stone-100 dark:bg-neutral-800 text-stone-800 dark:text-neutral-100',
  Setter: 'bg-stone-100 dark:bg-neutral-800 text-stone-600 dark:text-neutral-300',
  'Setter-Closer': 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300',
  'Head of Sales': 'bg-stone-100 dark:bg-neutral-800 text-stone-800 dark:text-neutral-100',
  Admin: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  Owner: 'bg-stone-100 dark:bg-neutral-800 text-stone-800 dark:text-neutral-100',
}

// ─── Component ───

export function BusinessReport() {
  const { user, ownerUserId } = useBusinessAuth()
  const effectiveUserId = ownerUserId || user?.id
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [periodDays, setPeriodDays] = useState(7)
  const pdfRef = useRef<HTMLDivElement>(null)
  const [activityFilterMember, setActivityFilterMember] = useState<string>('all')

  const [members, setMembers] = useState<TeamMember[]>([])
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [reminders, setReminders] = useState<any[]>([])

  const fetchAll = useCallback(async () => {
    if (!effectiveUserId) return
    setLoading(true)
    try {
      const [membersRes, ownerRes, prospectsRes, campaignsRes, appointmentsRes, remindersRes] = await Promise.all([
        supabase.from('business_team_members').select('id, first_name, last_name, email, role, joined_at').eq('business_owner_id', effectiveUserId),
        supabase.from('business_users').select('id, full_name, email, created_at').eq('id', effectiveUserId).single(),
        supabase.from('business_prospects').select('id, stage, value, created_at, campaign_id, payment_type, installments, assigned_to, contact, loss_reason, call_notes').eq('user_id', effectiveUserId),
        supabase.from('business_campaigns').select('id, name, views, is_active, created_at').eq('user_id', effectiveUserId),
        supabase.from('business_appointments').select('id, status, date, campaign_id, prospect_id, created_at, assigned_to').eq('user_id', effectiveUserId),
        supabase.from('reminders').select('id, title, reminder_date, created_at, is_done, user_id, created_by_member_id').eq('user_id', effectiveUserId),
      ])
      const membersList = membersRes.data || []
      if (ownerRes.data) {
        const nameParts = (ownerRes.data.full_name || 'Owner').split(' ')
        membersList.unshift({ id: ownerRes.data.id, first_name: nameParts[0] || 'Owner', last_name: nameParts.slice(1).join(' ') || '', email: ownerRes.data.email || '', role: 'Owner', joined_at: ownerRes.data.created_at || '' })
      }
      setMembers(membersList)
      setProspects(prospectsRes.data || [])
      setCampaigns(campaignsRes.data || [])
      setAppointments(appointmentsRes.data || [])
      setReminders(remindersRes.data || [])
    } catch (err) {
      console.error('Error fetching report data:', err)
    } finally {
      setLoading(false)
    }
  }, [effectiveUserId])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ─── Filter by period ───
  const cutoff = useMemo(() => {
    if (periodDays === 0) return null
    const d = new Date()
    d.setDate(d.getDate() - periodDays)
    return d
  }, [periodDays])

  const inPeriod = useCallback((dateStr: string | null | undefined) => {
    if (!cutoff || !dateStr) return true
    return new Date(dateStr) >= cutoff
  }, [cutoff])

  const filteredProspects = useMemo(() => prospects.filter(p => inPeriod(p.created_at)), [prospects, inPeriod])
  const filteredAppointments = useMemo(() => appointments.filter(a => inPeriod(a.created_at)), [appointments, inPeriod])

  // ─── Global KPIs ───
  const totalLeads = filteredProspects.length
  const wonLeads = filteredProspects.filter(p => p.stage === 'won')
  const lostLeads = filteredProspects.filter(p => p.stage === 'lost')
  const noshowLeads = filteredProspects.filter(p => p.stage === 'noshow')
  const qualifiedLeads = filteredProspects.filter(p => p.stage === 'qualified')
  const followupLeads = filteredProspects.filter(p => p.stage === 'followup')
  const activeLeads = filteredProspects.filter(p => ['prospect', 'qualified', 'followup'].includes(p.stage))

  const totalCA = wonLeads.reduce((s, p) => s + (Number(p.value) || 0), 0)
  const totalPipeline = filteredProspects.filter(p => p.stage !== 'unqualified').reduce((s, p) => s + (Number(p.value) || 0), 0)
  const avgDeal = wonLeads.length > 0 ? totalCA / wonLeads.length : 0
  // No-shows only count if they came from follow-up stage
  const noshowFromFollowup = noshowLeads.filter(p => p.previous_stage === 'followup')
  const totalDecided = wonLeads.length + lostLeads.length + noshowFromFollowup.length
  const closingRate = totalDecided > 0 ? (wonLeads.length / totalDecided) * 100 : 0
  const noshowEligible = filteredProspects.filter(p => !['prospect', 'unqualified', 'noanswer'].includes(p.stage)).length
  const noshowRate = noshowEligible > 0 ? (noshowLeads.length / noshowEligible) * 100 : 0
  const lostRate = totalDecided > 0 ? (lostLeads.length / totalDecided) * 100 : 0

  // Appointments stats
  const totalAppts = filteredAppointments.length
  const doneAppts = filteredAppointments.filter(a => a.status === 'done').length
  const cancelledAppts = filteredAppointments.filter(a => a.status === 'cancelled').length
  const showUpRate = totalAppts > 0 ? ((doneAppts / totalAppts) * 100) : 0
  const cancelRate = totalAppts > 0 ? ((cancelledAppts / totalAppts) * 100) : 0

  // Commission estimate (10% default since no explicit rate field)
  const COMMISSION_RATE = 10
  const totalCommission = totalCA * (COMMISSION_RATE / 100)

  // ─── Campaign stats ───
  const campaignStats = useMemo(() => {
    return campaigns.map(c => {
      const campProspects = filteredProspects.filter(p => p.campaign_id === c.id)
      const campWon = campProspects.filter(p => p.stage === 'won')
      const campCA = campWon.reduce((s, p) => s + (Number(p.value) || 0), 0)
      const campCommission = campCA * (COMMISSION_RATE / 100)
      const inscriptions = campProspects.length
      const conversionRate = c.views > 0 ? (inscriptions / c.views) * 100 : 0
      return {
        ...c,
        inscriptions,
        wonCount: campWon.length,
        ca: campCA,
        commission: campCommission,
        conversionRate,
      }
    }).sort((a, b) => b.ca - a.ca)
  }, [campaigns, filteredProspects])

  // ─── Stage distribution for pie ───
  const stageData = useMemo(() => {
    const stages = [
      { id: 'prospect', name: 'Nouveau Lead', color: '#006c49' },
      { id: 'qualified', name: 'Qualifié', color: '#ffb95f' },
      { id: 'unqualified', name: 'Non-Qualifié', color: '#c4c7c7' },
      { id: 'followup', name: 'Follow Up', color: '#1b1c1b' },
      { id: 'won', name: 'Gagné', color: '#006c49' },
      { id: 'lost', name: 'Perdu', color: '#ba1a1a' },
      { id: 'noanswer', name: 'Pas de Réponse', color: '#747878' },
      { id: 'noshow', name: 'No Show', color: '#444748' },
    ]
    return stages.map(s => ({
      name: s.name,
      value: filteredProspects.filter(p => p.stage === s.id).length,
      color: s.color,
    })).filter(s => s.value > 0)
  }, [filteredProspects])

  // ─── Loss reason distribution ───
  const LOSS_REASON_COLORS: Record<string, string> = {
    'Je dois y réfléchir': '#6366f1', 'Argent/budget': '#f59e0b', 'Doit en parler': '#8b5cf6',
    "C'est pas le moment": '#64748b', 'Peur': '#ef4444', 'Ecran de fumée': '#f97316', 'Autre': '#a1a1aa',
  }
  const lossReasonData = useMemo(() => {
    const lost = filteredProspects.filter(p => p.stage === 'lost')
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
      .map(([name, value]) => ({ name, value, color: LOSS_REASON_COLORS[name] || '#d4d4d8' }))
      .sort((a, b) => b.value - a.value)
  }, [filteredProspects])

  // ─── CA bar per campaign ───
  const caBarData = useMemo(() =>
    campaignStats
      .filter(c => c.ca > 0)
      .map(c => ({
        name: c.name.length > 18 ? c.name.slice(0, 18) + '…' : c.name,
        fullName: c.name,
        ca: c.ca,
      })),
    [campaignStats])

  // Max CA for horizontal bars
  const maxCA = useMemo(() => Math.max(...campaignStats.map(c => c.ca), 1), [campaignStats])

  // ─── PDF Export ───
  const handleExportPDF = async () => {
    if (!pdfRef.current) return
    setExporting(true)
    try {
      await new Promise(r => setTimeout(r, 300))
      const opt = {
        margin: [8, 8, 8, 8],
        filename: `CloseOS-Rapport-${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff', windowWidth: 900 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
      }
      await html2pdf().set(opt).from(pdfRef.current).save()
    } catch (err) {
      console.error('PDF export error:', err)
    } finally {
      setExporting(false)
    }
  }

  const periodLabel = PERIODS.find(p => p.days === periodDays)?.label || '7 jours'

  // ─── Activity Feed (Today only) ───
  const todayActivities = useMemo(() => {
    if (periodDays !== 1) return []

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const getMemberName = (memberId: string | null) => {
      if (!memberId) return 'Vous'
      const m = members.find(mem => mem.id === memberId)
      return m ? `${m.first_name} ${m.last_name}` : 'Membre'
    }

    const events: ActivityEvent[] = []

    filteredProspects.forEach(p => {
      if (!p.created_at) return
      const d = new Date(p.created_at)
      if (d >= today && d < tomorrow) {
        events.push({
          id: `prospect-${p.id}`,
          member_name: getMemberName((p as any).assigned_to),
          member_id: (p as any).assigned_to || 'owner',
          action: 'a ajouté un prospect',
          detail: (p as any).contact || `Prospect #${p.id}`,
          timestamp: d,
          icon: Users,
          color: 'text-emerald-700 bg-emerald-50',
        })
      }
    })

    filteredProspects.forEach(p => {
      if (!p.created_at) return
      if (['won', 'lost', 'noshow'].includes(p.stage)) {
        const d = new Date(p.created_at)
        if (d >= today && d < tomorrow) {
          const actionMap: Record<string, string> = {
            won: 'a conclu une vente',
            lost: 'a perdu un deal',
            noshow: 'a marqué un no-show',
          }
          const colorMap: Record<string, string> = {
            won: 'text-emerald-700 bg-emerald-50',
            lost: 'text-red-700 bg-red-50',
            noshow: 'text-stone-600 dark:text-neutral-300 bg-stone-100 dark:bg-neutral-800',
          }
          events.push({
            id: `stage-${p.id}-${p.stage}`,
            member_name: getMemberName((p as any).assigned_to),
            member_id: (p as any).assigned_to || 'owner',
            action: actionMap[p.stage] || 'a modifié le pipeline',
            detail: (p as any).contact || `Prospect #${p.id}`,
            timestamp: d,
            icon: GitBranch,
            color: colorMap[p.stage] || 'text-stone-600 dark:text-neutral-300 bg-stone-100 dark:bg-neutral-800',
          })
        }
      }
    })

    filteredAppointments.forEach(a => {
      if (!a.created_at) return
      const d = new Date(a.created_at)
      if (d >= today && d < tomorrow) {
        events.push({
          id: `appt-${a.id}`,
          member_name: getMemberName((a as any).assigned_to),
          member_id: (a as any).assigned_to || 'owner',
          action: 'a fixé un rendez-vous',
          detail: `Le ${a.date}`,
          timestamp: d,
          icon: Calendar,
          color: 'text-stone-700 dark:text-neutral-200 bg-stone-100 dark:bg-neutral-800',
        })
      }
    })

    reminders.forEach(r => {
      if (!r.created_at) return
      const d = new Date(r.created_at)
      if (d >= today && d < tomorrow) {
        events.push({
          id: `reminder-${r.id}`,
          member_name: getMemberName(r.created_by_member_id),
          member_id: r.created_by_member_id || 'owner',
          action: 'a programmé un rappel',
          detail: r.title,
          timestamp: d,
          icon: Bell,
          color: 'text-stone-700 dark:text-neutral-200 bg-stone-100 dark:bg-neutral-800',
        })
      }
    })

    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    if (activityFilterMember !== 'all') {
      return events.filter(e => e.member_id === activityFilterMember)
    }

    return events
  }, [periodDays, filteredProspects, filteredAppointments, reminders, members, activityFilterMember])

  // ─── Conic gradient for donut chart ───
  const conicGradient = useMemo(() => {
    if (stageData.length === 0) return 'conic-gradient(#e4e2e1 0% 100%)'
    const total = stageData.reduce((s, d) => s + d.value, 0)
    let cumulative = 0
    const segments = stageData.map(d => {
      const start = cumulative
      cumulative += (d.value / total) * 100
      return `${d.color} ${start}% ${cumulative}%`
    })
    return `conic-gradient(${segments.join(', ')})`
  }, [stageData])

  // Bar colors for CA chart
  const BAR_COLORS = ['#006c49', '#1b1c1b', '#ffb95f', '#747878', '#c4c7c7']

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 text-stone-400 dark:text-neutral-500 animate-spin" /></div>
  }

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-10">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-stone-900 dark:text-white mb-1">Business Report</h1>
          <p className="text-stone-500 dark:text-neutral-400 text-sm">Visualisez la performance globale de vos campagnes et de votre équipe commerciale en temps réel.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1 items-baseline">
            {PERIODS.map(p => (
              <button
                key={p.days}
                onClick={() => setPeriodDays(p.days)}
                className={`px-3 py-1.5 text-xs font-bold tracking-tight transition-all rounded-lg ${
                  periodDays === p.days
                    ? 'text-stone-900 dark:text-white border-b-2 border-emerald-600'
                    : 'text-stone-400 dark:text-neutral-500 hover:text-stone-600 dark:hover:text-neutral-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={handleExportPDF}
            disabled={exporting}
            className="flex items-center gap-2 rounded-full bg-stone-900 dark:bg-neutral-700 px-5 py-2 text-sm font-bold text-white hover:bg-stone-800 dark:hover:bg-neutral-600 disabled:opacity-50 transition-all active:scale-95"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export PDF
          </button>
        </div>
      </div>

      {/* ─── KPI Bento Grid ─── */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        {/* CA Généré */}
        <div className="glass-card p-7 rounded-2xl flex flex-col justify-between group hover:shadow-lg transition-all duration-300">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl">
              <DollarSign className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-stone-400 dark:text-neutral-500 uppercase tracking-[0.15em] mb-1">CA Généré</p>
            <p className="text-3xl font-extrabold text-stone-900 dark:text-white">{formatCurrency(totalCA)}</p>
          </div>
        </div>

        {/* Ventes */}
        <div className="glass-card p-7 rounded-2xl flex flex-col justify-between hover:shadow-lg transition-all duration-300">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-stone-100 dark:bg-neutral-800 rounded-2xl">
              <ShoppingCart className="h-5 w-5 text-stone-700 dark:text-neutral-200" />
            </div>
            <span className="text-stone-500 dark:text-neutral-400 font-bold text-[10px] bg-stone-100 dark:bg-neutral-800 px-2.5 py-1 rounded-full">{formatCurrency(avgDeal)} moy.</span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-stone-400 dark:text-neutral-500 uppercase tracking-[0.15em] mb-1">Ventes</p>
            <p className="text-3xl font-extrabold text-stone-900 dark:text-white">{wonLeads.length}</p>
          </div>
        </div>

        {/* Taux de Closing */}
        <div className="glass-card p-7 rounded-2xl flex flex-col justify-between hover:shadow-lg transition-all duration-300 border-l-4 border-stone-400 dark:border-neutral-500">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-stone-100 dark:bg-neutral-800 rounded-2xl">
              <Target className="h-5 w-5 text-stone-700 dark:text-neutral-200" />
            </div>
            <span className="text-stone-700 dark:text-neutral-200 font-bold text-[10px] bg-stone-100 dark:bg-neutral-800 px-2.5 py-1 rounded-full">
              {closingRate >= 25 ? 'High' : closingRate >= 15 ? 'Normal' : 'Low'}
            </span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-stone-400 dark:text-neutral-500 uppercase tracking-[0.15em] mb-1">Taux de Closing</p>
            <p className="text-3xl font-extrabold text-stone-900 dark:text-white">{formatPct(closingRate)}</p>
          </div>
        </div>

        {/* Commission estimée */}
        <div className="glass-card p-7 rounded-2xl flex flex-col justify-between hover:shadow-lg transition-all duration-300">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl">
              <Activity className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-stone-400 dark:text-neutral-500 uppercase tracking-[0.15em] mb-1">Commission estimée</p>
            <p className="text-3xl font-extrabold text-stone-900 dark:text-white">{formatCurrency(totalCommission)}</p>
          </div>
        </div>
      </section>

      {/* Secondary KPIs row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-14">
        <div className="glass-card p-5 rounded-2xl hover:shadow-lg transition-all duration-300">
          <p className="text-[10px] font-bold text-stone-400 dark:text-neutral-500 uppercase tracking-[0.15em] mb-1">Total Leads</p>
          <p className="text-2xl font-extrabold text-stone-900 dark:text-white">{totalLeads}</p>
        </div>
        <div className="glass-card p-5 rounded-2xl hover:shadow-lg transition-all duration-300">
          <p className="text-[10px] font-bold text-stone-400 dark:text-neutral-500 uppercase tracking-[0.15em] mb-1">Show Up</p>
          <p className="text-2xl font-extrabold text-stone-900 dark:text-white">{doneAppts}</p>
        </div>
        <div className="glass-card p-5 rounded-2xl hover:shadow-lg transition-all duration-300">
          <p className="text-[10px] font-bold text-stone-400 dark:text-neutral-500 uppercase tracking-[0.15em] mb-1">No Show</p>
          <p className="text-2xl font-extrabold text-red-600">{noshowLeads.length}</p>
        </div>
        <div className="glass-card p-5 rounded-2xl hover:shadow-lg transition-all duration-300">
          <p className="text-[10px] font-bold text-stone-400 dark:text-neutral-500 uppercase tracking-[0.15em] mb-1">Taux de perte</p>
          <p className="text-2xl font-extrabold text-stone-900 dark:text-white">{formatPct(lostRate)}</p>
        </div>
      </section>

      {/* ─── Activity Feed (Today only) ─── */}
      {periodDays === 1 && (
        <section className="glass-card rounded-2xl p-7 mb-14">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-extrabold text-stone-900 dark:text-white">Fil d'activité — Aujourd'hui</h3>
            {members.length > 0 && (
              <div className="relative">
                <select
                  value={activityFilterMember}
                  onChange={(e) => setActivityFilterMember(e.target.value)}
                  className="appearance-none rounded-full border border-stone-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 pl-8 pr-9 py-2 text-xs font-semibold text-stone-600 dark:text-neutral-300 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="all">Tous les membres</option>
                  <option value="owner">Moi (Owner)</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                  ))}
                </select>
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400 dark:text-neutral-500" />
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400 dark:text-neutral-500 pointer-events-none" />
              </div>
            )}
          </div>

          {todayActivities.length === 0 ? (
            <div className="text-center py-10">
              <Activity className="h-10 w-10 text-stone-200 dark:text-neutral-700 mx-auto mb-2" />
              <p className="text-sm text-stone-400 dark:text-neutral-500">Aucune activité aujourd'hui</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {todayActivities.map(event => {
                const EventIcon = event.icon
                return (
                  <div key={event.id} className="flex items-start gap-3 py-3 px-3 rounded-xl hover:bg-stone-50 dark:hover:bg-neutral-800/50 transition-colors">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-xl shrink-0 ${event.color}`}>
                      <EventIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-stone-800 dark:text-neutral-100">
                        <span className="font-bold">{event.member_name}</span>{' '}
                        <span className="text-stone-500 dark:text-neutral-400">{event.action}</span>
                      </p>
                      <p className="text-xs text-stone-400 dark:text-neutral-500 truncate">{event.detail}</p>
                    </div>
                    <span className="text-[10px] text-stone-400 dark:text-neutral-500 font-semibold shrink-0 mt-0.5">
                      {event.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* ─── Charts Section ─── */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-7 mb-14">
        {/* Donut chart: Répartition des leads */}
        <div className="lg:col-span-2 glass-card p-7 rounded-2xl">
          <h3 className="text-lg font-extrabold text-stone-900 dark:text-white mb-7">Répartition des leads par étape</h3>
          {stageData.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-sm text-stone-400 dark:text-neutral-500">Aucune donnée</div>
          ) : (
            <>
              <div className="relative w-56 h-56 mx-auto mb-7">
                <div className="w-full h-full rounded-full" style={{ background: conicGradient }} />
                <div className="absolute inset-8 bg-white dark:bg-neutral-900 rounded-full flex items-center justify-center shadow-inner">
                  <div className="text-center">
                    <p className="text-2xl font-black text-stone-900 dark:text-white">{totalLeads}</p>
                    <p className="text-[10px] text-stone-400 dark:text-neutral-500 font-bold uppercase tracking-[0.15em]">Leads</p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                {stageData.map(s => (
                  <div key={s.name} className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="text-sm font-medium text-stone-700 dark:text-neutral-200">{s.name}</span>
                    </div>
                    <span className="font-bold text-stone-900 dark:text-white">{totalLeads > 0 ? Math.round((s.value / totalLeads) * 100) : 0}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Horizontal bars: CA par campagne */}
        <div className="lg:col-span-3 glass-card p-7 rounded-2xl">
          <h3 className="text-lg font-extrabold text-stone-900 dark:text-white mb-7">CA par campagne</h3>
          {campaignStats.filter(c => c.ca > 0).length === 0 ? (
            <div className="flex items-center justify-center h-64 text-sm text-stone-400 dark:text-neutral-500">Aucune donnée</div>
          ) : (
            <div className="space-y-5">
              {campaignStats.filter(c => c.ca > 0).map((c, i) => (
                <div key={c.id}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-bold text-stone-900 dark:text-white">{c.name}</span>
                    <span className="font-bold" style={{ color: BAR_COLORS[i % BAR_COLORS.length] }}>{formatCurrency(c.ca)}</span>
                  </div>
                  <div className="w-full bg-stone-100 dark:bg-neutral-800 h-3 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${(c.ca / maxCA) * 100}%`, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ─── Loss Reason Pie Chart ─── */}
      {lossReasonData.length > 0 && (
      <section className="glass-card p-7 rounded-2xl mb-14">
        <h3 className="text-lg font-extrabold text-stone-900 dark:text-white mb-7">Raisons de Perte</h3>
        <div className="flex flex-col lg:flex-row items-center gap-8">
          <div className="relative w-56 h-56 mx-auto lg:mx-0">
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
      </section>
      )}

      {/* ─── Campaign Performance Table ─── */}
      <section className="glass-card rounded-2xl overflow-hidden mb-14">
        <div className="p-7 border-b border-stone-100 dark:border-neutral-800">
          <h3 className="text-lg font-extrabold text-stone-900 dark:text-white">Performance des Campagnes</h3>
        </div>
        {campaignStats.length === 0 ? (
          <p className="text-sm text-stone-400 dark:text-neutral-500 text-center py-10">Aucune campagne</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-stone-50 dark:bg-neutral-800/50">
                  <th className="px-7 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400 dark:text-neutral-500">Campagne</th>
                  <th className="px-7 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400 dark:text-neutral-500">Statut</th>
                  <th className="px-7 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400 dark:text-neutral-500">Date</th>
                  <th className="px-7 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400 dark:text-neutral-500">Vues</th>
                  <th className="px-7 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400 dark:text-neutral-500">Conv.</th>
                  <th className="px-7 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400 dark:text-neutral-500">CA</th>
                  <th className="px-7 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400 dark:text-neutral-500 text-right">Commission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50 dark:divide-neutral-800">
                {campaignStats.map(c => (
                  <tr key={c.id} className="hover:bg-stone-50 dark:hover:bg-neutral-800/50 transition-colors">
                    <td className="px-7 py-5 font-bold text-stone-900 dark:text-white">{c.name}</td>
                    <td className="px-7 py-5">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${c.is_active ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-stone-100 dark:bg-neutral-800 text-stone-500 dark:text-neutral-400'}`}>
                        {c.is_active ? 'Active' : 'Paused'}
                      </span>
                    </td>
                    <td className="px-7 py-5 text-sm text-stone-500 dark:text-neutral-400">{formatDate(c.created_at)}</td>
                    <td className="px-7 py-5 text-sm text-stone-700 dark:text-neutral-200">{c.views.toLocaleString('fr-FR')}</td>
                    <td className="px-7 py-5 text-sm font-bold text-stone-700 dark:text-neutral-200">{formatPct(c.conversionRate)}</td>
                    <td className="px-7 py-5 font-extrabold text-stone-900 dark:text-white">{formatCurrency(c.ca)}</td>
                    <td className="px-7 py-5 text-right font-medium text-emerald-700 dark:text-emerald-400">{formatCurrency(c.commission)}</td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr className="border-t-2 border-stone-200 dark:border-neutral-800 font-bold bg-stone-50 dark:bg-neutral-800/30">
                  <td className="px-7 py-5 text-stone-900 dark:text-white">Total</td>
                  <td></td>
                  <td></td>
                  <td className="px-7 py-5 text-sm text-stone-700 dark:text-neutral-200">{campaignStats.reduce((s, c) => s + c.views, 0).toLocaleString('fr-FR')}</td>
                  <td></td>
                  <td className="px-7 py-5 font-extrabold text-stone-900 dark:text-white">{formatCurrency(totalCA)}</td>
                  <td className="px-7 py-5 text-right font-medium text-emerald-700 dark:text-emerald-400">{formatCurrency(totalCommission)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ─── Team + Financial Summary ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-7 mb-14">
        {/* Team Performance */}
        <div className="lg:col-span-2 glass-card rounded-2xl overflow-hidden">
          <div className="p-7 border-b border-stone-100 dark:border-neutral-800">
            <h3 className="text-lg font-extrabold text-stone-900 dark:text-white">Performance de l'Équipe</h3>
          </div>
          {members.length === 0 ? (
            <p className="text-sm text-stone-400 dark:text-neutral-500 text-center py-10">Aucun membre dans l'équipe</p>
          ) : (
            <div className="divide-y divide-stone-50 dark:divide-neutral-800">
              {members.map(m => {
                const memberWins = filteredProspects.filter(p => p.stage === 'won' && (p as any).assigned_to === m.id).length
                return (
                  <div key={m.id} className="flex items-center justify-between px-7 py-4 hover:bg-stone-50 dark:hover:bg-neutral-800/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-stone-200 dark:bg-neutral-700 flex items-center justify-center text-sm font-bold text-stone-600 dark:text-neutral-300">
                        {m.first_name[0]}{m.last_name?.[0] || ''}
                      </div>
                      <div>
                        <p className="font-bold text-stone-900 dark:text-white">{m.first_name} {m.last_name}</p>
                        <p className="text-[10px] text-stone-400 dark:text-neutral-500">{m.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-5">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded ${ROLE_COLORS[m.role] || 'bg-stone-100 dark:bg-neutral-800 text-stone-500 dark:text-neutral-400'}`}>
                        {m.role}
                      </span>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] text-stone-400 dark:text-neutral-500">Wins</span>
                        <span className="font-bold text-stone-900 dark:text-white">{memberWins}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-stone-300 dark:text-neutral-600" />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Financial Summary Card (gradient) */}
        <div className="rounded-2xl p-7 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #ffb95f 0%, #006c49 100%)' }}>
          <div className="relative z-10 flex flex-col h-full">
            <h3 className="text-lg font-extrabold mb-7">Résumé Financier</h3>
            <div className="space-y-5 flex-grow">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] opacity-70 mb-1">Taux de Closing</p>
                <p className="text-4xl font-black">{formatPct(closingRate)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] opacity-70 mb-1">Panier Moyen</p>
                <p className="text-2xl font-bold">{formatCurrency(avgDeal)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] opacity-70 mb-1">Show Up Rate</p>
                <p className="text-2xl font-bold">{formatPct(showUpRate)}</p>
              </div>
            </div>
          </div>
          {/* Glass sphere effect */}
          <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        </div>
      </div>

      {/* ─── Bottom Cards ─── */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-7 mb-14">
        {/* Rendez-vous */}
        <div className="glass-card p-7 rounded-2xl">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-11 h-11 bg-stone-100 dark:bg-neutral-800 rounded-full flex items-center justify-center">
              <Calendar className="h-5 w-5 text-stone-700 dark:text-neutral-200" />
            </div>
            <div>
              <h4 className="font-extrabold text-lg text-stone-900 dark:text-white">Rendez-vous</h4>
              <p className="text-sm text-stone-400 dark:text-neutral-500">{totalAppts} total · {doneAppts} terminé{doneAppts !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="space-y-2">
            <StatLine label="Total RDV" value={totalAppts} color="stone" />
            <StatLine label="Terminés" value={doneAppts} color="emerald" />
            <StatLine label="En attente" value={filteredAppointments.filter(a => a.status === 'pending').length} color="amber" />
            <StatLine label="Confirmés" value={filteredAppointments.filter(a => a.status === 'confirmed').length} color="stone" />
            <StatLine label="Annulés" value={cancelledAppts} color="red" />
            <StatLine label="Taux Show Up" value={formatPct(showUpRate)} color="emerald" isText />
          </div>
        </div>

        {/* Pipeline Détaillé */}
        <div className="glass-card p-7 rounded-2xl border-t-4 border-stone-900 dark:border-neutral-400">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-11 h-11 bg-stone-900 dark:bg-neutral-700 rounded-full flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <h4 className="font-extrabold text-lg text-stone-900 dark:text-white">Pipeline Détaillé</h4>
              <p className="text-sm text-stone-400 dark:text-neutral-500">Valeur totale : {formatCurrency(totalPipeline)}</p>
            </div>
          </div>
          {/* Pipeline bar */}
          <div className="w-full bg-stone-100 dark:bg-neutral-800 h-2 rounded-full mb-5 overflow-hidden">
            <div className="flex h-full">
              {stageData.map((s, i) => {
                const pct = totalLeads > 0 ? (s.value / totalLeads) * 100 : 0
                return (
                  <div
                    key={s.name}
                    className={`h-full ${i === 0 ? 'rounded-l-full' : ''} ${i === stageData.length - 1 ? 'rounded-r-full' : ''}`}
                    style={{ width: `${pct}%`, backgroundColor: s.color }}
                  />
                )
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-2xl font-black text-stone-900 dark:text-white">{filteredProspects.filter(p => p.stage === 'prospect').length}</p>
              <p className="text-[10px] text-stone-400 dark:text-neutral-500 font-bold uppercase tracking-[0.15em]">Prospects</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-stone-900 dark:text-white">{wonLeads.length}</p>
              <p className="text-[10px] text-stone-400 dark:text-neutral-500 font-bold uppercase tracking-[0.15em]">Gagnés</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Hidden PDF content ─── */}
      <div style={{ position: 'fixed', top: 0, left: 0, width: '900px', zIndex: -1, opacity: 0, pointerEvents: 'none' }}>
        <div ref={pdfRef} style={{ fontFamily: 'Inter, Helvetica, Arial, sans-serif', background: '#ffffff', padding: '32px', width: '900px', color: '#1e293b' }}>
          {/* PDF Header */}
          <div style={{ background: 'linear-gradient(135deg, #ffb95f, #006c49)', borderRadius: '16px', padding: '24px 32px', marginBottom: '24px', color: '#fff' }}>
            <div style={{ fontSize: '22px', fontWeight: 'bold' }}>CloseOS Business — Rapport</div>
            <div style={{ fontSize: '13px', opacity: 0.85, marginTop: '4px' }}>Période : {periodLabel} · Généré le {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          </div>

          {/* PDF KPIs */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <PdfKpi label="CA Généré" value={formatCurrency(totalCA)} />
            <PdfKpi label="Ventes" value={String(wonLeads.length)} />
            <PdfKpi label="Closing" value={formatPct(closingRate)} />
            <PdfKpi label="Commission" value={formatCurrency(totalCommission)} />
            <PdfKpi label="Total Leads" value={String(totalLeads)} />
            <PdfKpi label="Show Up" value={formatPct(showUpRate)} />
            <PdfKpi label="No Show" value={formatPct(noshowRate)} />
            <PdfKpi label="Panier Moyen" value={formatCurrency(avgDeal)} />
          </div>

          {/* PDF Pipeline */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#1b1c1b' }}>Répartition Pipeline</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e4e2e1' }}>
                  {['Prospect', 'Qualifié', 'Follow Up', 'Gagné', 'Perdu', 'No Show'].map(s => (
                    <th key={s} style={{ textAlign: 'center', padding: '6px', fontWeight: 'bold', color: '#747878' }}>{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {['prospect', 'qualified', 'followup', 'won', 'lost', 'noshow'].map(s => (
                    <td key={s} style={{ textAlign: 'center', padding: '6px', fontWeight: 'bold' }}>
                      {filteredProspects.filter(p => p.stage === s).length}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* PDF Campaign table */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#1b1c1b' }}>Performance Campagnes</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e4e2e1' }}>
                  {['Campagne', 'Statut', 'Vues', 'Inscrits', 'Conv.', 'Gagnés', 'CA', 'Commission'].map(h => (
                    <th key={h} style={{ textAlign: h === 'Campagne' ? 'left' : 'center', padding: '5px 4px', fontWeight: 'bold', color: '#747878' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaignStats.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #efedec' }}>
                    <td style={{ padding: '5px 4px', fontWeight: 500 }}>{c.name}</td>
                    <td style={{ padding: '5px 4px', textAlign: 'center' }}>{c.is_active ? 'Active' : 'Inactive'}</td>
                    <td style={{ padding: '5px 4px', textAlign: 'center' }}>{c.views}</td>
                    <td style={{ padding: '5px 4px', textAlign: 'center' }}>{c.inscriptions}</td>
                    <td style={{ padding: '5px 4px', textAlign: 'center' }}>{formatPct(c.conversionRate)}</td>
                    <td style={{ padding: '5px 4px', textAlign: 'center' }}>{c.wonCount}</td>
                    <td style={{ padding: '5px 4px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(c.ca)}</td>
                    <td style={{ padding: '5px 4px', textAlign: 'right' }}>{formatCurrency(c.commission)}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid #006c49' }}>
                  <td style={{ padding: '5px 4px', fontWeight: 'bold' }}>Total</td>
                  <td></td>
                  <td style={{ padding: '5px 4px', textAlign: 'center', fontWeight: 'bold' }}>{campaignStats.reduce((s, c) => s + c.views, 0)}</td>
                  <td style={{ padding: '5px 4px', textAlign: 'center', fontWeight: 'bold' }}>{campaignStats.reduce((s, c) => s + c.inscriptions, 0)}</td>
                  <td></td>
                  <td style={{ padding: '5px 4px', textAlign: 'center', fontWeight: 'bold' }}>{campaignStats.reduce((s, c) => s + c.wonCount, 0)}</td>
                  <td style={{ padding: '5px 4px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(totalCA)}</td>
                  <td style={{ padding: '5px 4px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(totalCommission)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* PDF Team */}
          {members.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#1b1c1b' }}>Équipe ({members.length} membres)</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e4e2e1' }}>
                    {['Membre', 'Rôle', 'Email', 'Depuis'].map(h => (
                      <th key={h} style={{ textAlign: h === 'Membre' ? 'left' : 'center', padding: '5px 4px', fontWeight: 'bold', color: '#747878' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {members.map(m => (
                    <tr key={m.id} style={{ borderBottom: '1px solid #efedec' }}>
                      <td style={{ padding: '5px 4px', fontWeight: 500 }}>{m.first_name} {m.last_name}</td>
                      <td style={{ padding: '5px 4px', textAlign: 'center' }}>{m.role}</td>
                      <td style={{ padding: '5px 4px', textAlign: 'center', color: '#747878' }}>{m.email}</td>
                      <td style={{ padding: '5px 4px', textAlign: 'center' }}>{formatDate(m.joined_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* PDF Appointments */}
          <div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#1b1c1b' }}>Rendez-vous</div>
            <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
              <span>Total : <b>{totalAppts}</b></span>
              <span>Terminés : <b>{doneAppts}</b></span>
              <span>Annulés : <b>{cancelledAppts}</b></span>
              <span>Show Up : <b>{formatPct(showUpRate)}</b></span>
            </div>
          </div>

          {/* PDF Footer */}
          <div style={{ marginTop: '32px', paddingTop: '16px', borderTop: '1px solid #e4e2e1', fontSize: '10px', color: '#747878', textAlign: 'center' }}>
            CloseOS Business · Rapport généré automatiquement · {new Date().toLocaleDateString('fr-FR')}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ───

function StatLine({ label, value, color, isText }: { label: string; value: number | string; color: string; isText?: boolean }) {
  const colorMap: Record<string, string> = {
    stone: 'text-stone-700 dark:text-neutral-200', emerald: 'text-emerald-700 dark:text-emerald-400', amber: 'text-stone-700 dark:text-neutral-200',
    red: 'text-red-600 dark:text-red-400', slate: 'text-stone-500 dark:text-neutral-400',
  }
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm font-medium text-stone-500 dark:text-neutral-400">{label}</span>
      <span className={`text-sm font-bold ${colorMap[color] || 'text-stone-900 dark:text-white'}`}>
        {value}
      </span>
    </div>
  )
}

function PdfKpi({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: '1 1 0', minWidth: '90px', background: '#f5f3f2', borderRadius: '10px', padding: '10px 14px', textAlign: 'center' }}>
      <div style={{ fontSize: '10px', color: '#747878', fontWeight: 600, marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1b1c1b' }}>{value}</div>
    </div>
  )
}
