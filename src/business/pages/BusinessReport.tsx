import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  FileText, Download, Loader2, CalendarDays, Users, Megaphone,
  TrendingUp, TrendingDown, DollarSign, UserCheck, UserX, Target, Activity,
  ShoppingCart, Eye, Clock, ChevronDown, LogIn, LogOut as LogOutIcon,
  Phone, Bell, GitBranch, Calendar, ChevronRight, ArrowRight, X, Filter,
  Repeat, Wallet, Link2, ClipboardList, Zap, Minus,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, ComposedChart, Line,
} from 'recharts'
import { useNavigate } from 'react-router-dom'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessLang } from '../i18n/BusinessLangContext'
import { supabase } from '../../lib/supabase'
import { getProspectCA } from '../lib/getProspectCA'
import { unqualifiedReasonLabel } from '../lib/unqualifiedReasons'
import { CONTACT_CHANNELS, channelResponseStats, isContactChannel } from '../lib/contactChannels'
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
  avatar_url?: string | null
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
  loss_details?: string | null
  assigned_to?: string | null
  contact?: string | null
  call_notes?: { id: string; date: string; content: string; author?: string }[]
  stripe_subscription_id?: string | null
  // Décision horodatée (trigger set_decision_at) — sert au filtrage par période
  won_at?: string | null
  lost_at?: string | null
  previous_stage?: string | null
  source?: string | null
  offer?: string | null
  formula_id?: string | null
  assigned_setter?: string | null
  unqualified_reason?: string | null
  unqualified_details?: string | null
  unqualified_at?: string | null
  contacted_at?: string | null
  responded_at?: string | null
  relance_step?: number | null
  first_contact_channel?: string | null
  noshow_relance_step?: number | null
  noshow_at?: string | null
  subscription_status?: string | null
  subscription_amount?: number | null
  subscription_interval?: string | null
  custom_commission_rate?: number | null
  commission_approval_status?: string | null
}

interface Member extends TeamMember {
  commission_rate?: number | null
  compensation_type?: string | null
  per_booking_amount?: number | null
}

interface Invoice {
  id: string
  amount_ht: number | null
  amount_ttc: number | null
  status: string | null
  created_at: string
  due_date: string | null
}

interface CallRow {
  id: number
  team_member_id: string | null
  date: string
  duration: string | null
  answered: boolean | null
  is_ai: boolean | null
}

interface Objective {
  id: string
  label: string
  metric: string
  target_value: number
  period: string | null
  deadline: string | null
}

interface FormRow {
  id: string
  name: string
  is_active: boolean
}

interface TrackingLink {
  id: string
  name: string
  slug: string
  is_active: boolean
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

const formatPct = (v: number) => `${v.toFixed(1)}%`

/** "00:05:32" ou "05:32" → secondes */
const parseDuration = (raw: string | null | undefined): number => {
  if (!raw) return 0
  const parts = raw.split(':').map(n => Number(n))
  if (parts.some(n => Number.isNaN(n))) return 0
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return parts[0] || 0
}

/** Secondes → "2 h 05" / "12 min" / "45 s" */
const humanDuration = (secs: number, lang: string): string => {
  if (secs <= 0) return lang === 'en' ? '0 min' : '0 min'
  if (secs < 60) return `${Math.round(secs)} s`
  if (secs < 3600) return `${Math.round(secs / 60)} min`
  const h = Math.floor(secs / 3600)
  const m = Math.round((secs % 3600) / 60)
  return `${h} h ${String(m).padStart(2, '0')}`
}

/** Date "yyyy-mm-dd" locale (sans décalage UTC) */
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Variation en % entre deux valeurs — null si la base est nulle (pas de "+∞%") */
const deltaPct = (current: number, previous: number): number | null => {
  if (!previous) return current > 0 ? null : 0
  return ((current - previous) / previous) * 100
}

const STAGE_COLORS: Record<string, string> = {
  prospect: '#006c49',
  contacted: '#38bdf8',
  qualified: '#ffb95f',
  unqualified: '#c4c7c7',
  followup: '#1b1c1b',
  won: '#006c49',
  lost: '#ba1a1a',
  noanswer: '#747878',
  noshow: '#444748',
}

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
  const { t, lang } = useBusinessLang()
  const navigate = useNavigate()

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

  const PERIODS = [
    { label: t.common_today, days: 1 },
    { label: t.report_7_days, days: 7 },
    { label: t.report_14_days, days: 14 },
    { label: t.report_30_days, days: 30 },
    { label: t.report_90_days, days: 90 },
    { label: t.report_6_months, days: 180 },
    { label: t.report_1_year, days: 365 },
    { label: t.report_all_time, days: 0 },
  ]
  const effectiveUserId = ownerUserId || user?.id
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [periodDays, setPeriodDays] = useState(7)
  const pdfRef = useRef<HTMLDivElement>(null)
  const [activityFilterMember, setActivityFilterMember] = useState<string>('all')
  const [showAutreModal, setShowAutreModal] = useState(false)
  const [autreFilterPeriod, setAutreFilterPeriod] = useState(0)
  const [autreFilterCampaign, setAutreFilterCampaign] = useState<string>('all')
  const [autreFilterCloser, setAutreFilterCloser] = useState<string>('all')
  const [autreFilterTeam, setAutreFilterTeam] = useState<string>('all')
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([])
  const [allTeamMembers, setAllTeamMembers] = useState<{ id: string; team_id: string | null }[]>([])

  const [members, setMembers] = useState<Member[]>([])
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [reminders, setReminders] = useState<any[]>([])
  const [formulaBillingTypes, setFormulaBillingTypes] = useState<Record<string, string>>({})
  const [formulaNames, setFormulaNames] = useState<Record<string, string>>({})
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [calls, setCalls] = useState<CallRow[]>([])
  const [objectives, setObjectives] = useState<Objective[]>([])
  const [forms, setForms] = useState<FormRow[]>([])
  const [formResponses, setFormResponses] = useState<{ id: string; form_id: string; prospect_id: number | null; created_at: string }[]>([])
  const [trackingLinks, setTrackingLinks] = useState<TrackingLink[]>([])
  const [trackingEvents, setTrackingEvents] = useState<{ link_id: string; visitor_id: string; is_returning: boolean | null; duration_seconds: number | null; created_at: string }[]>([])
  const [showUnqualifiedModal, setShowUnqualifiedModal] = useState(false)

  const fetchAll = useCallback(async () => {
    if (!effectiveUserId) { setLoading(false); return }
    setLoading(true)
    try {
      const [
        membersRes, ownerRes, prospectsRes, campaignsRes, appointmentsRes, remindersRes,
        formulasRes, invoicesRes, callsRes, objectivesRes, formsRes, formResponsesRes,
        trackingLinksRes, trackingEventsRes,
      ] = await Promise.all([
        supabase.from('business_team_members').select('id, first_name, last_name, email, role, joined_at, avatar_url, commission_rate, compensation_type, per_booking_amount').eq('business_owner_id', effectiveUserId),
        supabase.from('business_users').select('id, full_name, email, created_at, avatar_url').eq('id', effectiveUserId).single(),
        supabase.from('business_prospects').select('id, stage, value, created_at, campaign_id, payment_type, installments, assigned_to, assigned_setter, contact, loss_reason, loss_details, call_notes, stripe_subscription_id, subscription_amount, subscription_status, subscription_interval, formula_id, offer, source, previous_stage, won_at, lost_at, unqualified_reason, unqualified_details, unqualified_at, contacted_at, responded_at, relance_step, first_contact_channel, noshow_relance_step, noshow_at, custom_commission_rate, commission_approval_status').eq('user_id', effectiveUserId),
        supabase.from('business_campaigns').select('id, name, views, is_active, created_at').eq('user_id', effectiveUserId),
        supabase.from('business_appointments').select('id, status, date, campaign_id, prospect_id, created_at, assigned_to').eq('user_id', effectiveUserId),
        supabase.from('reminders').select('id, title, reminder_date, created_at, is_done, user_id, created_by_member_id').eq('user_id', effectiveUserId),
        supabase.from('business_formulas').select('id, name, billing_type').eq('user_id', effectiveUserId),
        supabase.from('invoices').select('id, amount_ht, amount_ttc, status, created_at, due_date').eq('user_id', effectiveUserId),
        supabase.from('business_call_history').select('id, team_member_id, date, duration, answered, is_ai').eq('business_owner_id', effectiveUserId),
        supabase.from('business_objectives').select('id, label, metric, target_value, period, deadline').eq('user_id', effectiveUserId),
        supabase.from('business_forms').select('id, name, is_active').eq('user_id', effectiveUserId),
        supabase.from('business_form_responses').select('id, form_id, prospect_id, created_at').eq('user_id', effectiveUserId),
        supabase.from('business_tracking_links').select('id, name, slug, is_active').eq('user_id', effectiveUserId),
        supabase.from('business_tracking_events').select('link_id, visitor_id, is_returning, duration_seconds, created_at'),
      ])
      const membersList: Member[] = membersRes.data || []
      if (ownerRes.data) {
        const nameParts = (ownerRes.data.full_name || 'Owner').split(' ')
        membersList.unshift({ id: ownerRes.data.id, first_name: nameParts[0] || 'Owner', last_name: nameParts.slice(1).join(' ') || '', email: ownerRes.data.email || '', role: 'Owner', joined_at: ownerRes.data.created_at || '', avatar_url: (ownerRes.data as any).avatar_url || null })
      }
      setMembers(membersList)
      setProspects(prospectsRes.data || [])
      setCampaigns(campaignsRes.data || [])
      setAppointments(appointmentsRes.data || [])
      setReminders(remindersRes.data || [])
      setInvoices((invoicesRes.data || []) as Invoice[])
      setCalls((callsRes.data || []) as CallRow[])
      setObjectives((objectivesRes.data || []) as Objective[])
      setForms((formsRes.data || []) as FormRow[])
      setFormResponses(formResponsesRes.data || [])
      setTrackingLinks((trackingLinksRes.data || []) as TrackingLink[])

      // Les events de tracking ne portent pas d'owner : on ne garde que ceux des liens du compte.
      const ownLinkIds = new Set((trackingLinksRes.data || []).map((l: any) => l.id))
      setTrackingEvents((trackingEventsRes.data || []).filter((e: any) => ownLinkIds.has(e.link_id)))

      const billing: Record<string, string> = {}
      const names: Record<string, string> = {}
      ;(formulasRes.data || []).forEach((f: any) => {
        billing[f.id] = f.billing_type || 'one_time'
        names[f.id] = f.name
      })
      setFormulaBillingTypes(billing)
      setFormulaNames(names)
    } catch (err) {
      console.error('Error fetching report data:', err)
    } finally {
      setLoading(false)
    }
  }, [effectiveUserId])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Fetch teams for Autre modal filter
  useEffect(() => {
    if (!effectiveUserId) return
    Promise.all([
      supabase.from('business_teams').select('id, name').eq('business_owner_id', effectiveUserId),
      supabase.from('business_team_members').select('id, team_id').eq('business_owner_id', effectiveUserId),
    ]).then(([teamsRes, membersRes]) => {
      if (teamsRes.data) setTeams(teamsRes.data)
      if (membersRes.data) setAllTeamMembers(membersRes.data)
    }).catch(err => console.error('[BusinessReport] Error loading teams:', err))
  }, [effectiveUserId])

  // ─── Filter by period ───
  // Deux fenêtres distinctes :
  //  · acquisition (leads, sources, formulaires, tracking) → date de CRÉATION
  //  · revenus (CA, ventes, commissions, closing) → date de DÉCISION (won_at / lost_at)
  // Sans cette distinction, un lead créé en mai et signé hier ne comptait pas
  // dans « CA généré · 7 jours ».
  const cutoff = useMemo(() => {
    if (periodDays === 0) return null
    const d = new Date()
    d.setDate(d.getDate() - periodDays)
    return d
  }, [periodDays])

  // Fenêtre précédente de même durée, pour les comparaisons.
  const prevCutoff = useMemo(() => {
    if (periodDays === 0 || !cutoff) return null
    const d = new Date(cutoff)
    d.setDate(d.getDate() - periodDays)
    return d
  }, [cutoff, periodDays])

  const inPeriod = useCallback((dateStr: string | null | undefined) => {
    if (!cutoff || !dateStr) return true
    return new Date(dateStr) >= cutoff
  }, [cutoff])

  const inPrevPeriod = useCallback((dateStr: string | null | undefined) => {
    if (!cutoff || !prevCutoff || !dateStr) return false
    const d = new Date(dateStr)
    return d >= prevCutoff && d < cutoff
  }, [cutoff, prevCutoff])

  const filteredProspects = useMemo(() => prospects.filter(p => inPeriod(p.created_at)), [prospects, inPeriod])
  const filteredAppointments = useMemo(() => appointments.filter(a => inPeriod(a.created_at)), [appointments, inPeriod])

  // ─── Global KPIs ───
  const totalLeads = filteredProspects.length
  // Ventes / pertes : filtrées sur la DATE DE DÉCISION, pas sur la création.
  const wonLeads = useMemo(() => prospects.filter(p => p.stage === 'won' && inPeriod(p.won_at || p.created_at)), [prospects, inPeriod])
  const lostLeads = useMemo(() => prospects.filter(p => p.stage === 'lost' && inPeriod(p.lost_at || p.created_at)), [prospects, inPeriod])
  const noshowLeads = useMemo(() => prospects.filter(p => p.stage === 'noshow' && inPeriod(p.noshow_at || p.created_at)), [prospects, inPeriod])
  const activeLeads = filteredProspects.filter(p => ['prospect', 'contacted', 'qualified', 'followup'].includes(p.stage))

  const totalCA = wonLeads.reduce((s, p) => s + getProspectCA(p, formulaBillingTypes), 0)
  const totalPipeline = filteredProspects.filter(p => p.stage !== 'unqualified').reduce((s, p) => s + (Number(p.value) || 0), 0)
  const avgDeal = wonLeads.length > 0 ? totalCA / wonLeads.length : 0
  // No-shows only count if they came from follow-up stage
  const noshowFromFollowup = noshowLeads.filter(p => p.previous_stage === 'followup')
  const totalDecided = wonLeads.length + lostLeads.length + noshowFromFollowup.length
  const closingRate = totalDecided > 0 ? (wonLeads.length / totalDecided) * 100 : 0
  const noshowDecided = wonLeads.length + lostLeads.length + noshowLeads.length
  const noshowRate = noshowDecided > 0 ? (noshowLeads.length / noshowDecided) * 100 : 0
  const lostRate = totalDecided > 0 ? (lostLeads.length / totalDecided) * 100 : 0

  // Appointments stats
  const totalAppts = filteredAppointments.length
  const doneAppts = filteredAppointments.filter(a => a.status === 'done').length
  const cancelledAppts = filteredAppointments.filter(a => a.status === 'cancelled').length
  const showUpRate = totalAppts > 0 ? ((doneAppts / totalAppts) * 100) : 0
  const cancelRate = totalAppts > 0 ? ((cancelledAppts / totalAppts) * 100) : 0

  // ─── Commission ───
  // Priorité : surcharge par prospect → taux du membre assigné → 10 % par défaut.
  // Un membre au forfait (compensation_type = 'fixed') ne génère aucune commission.
  const DEFAULT_COMMISSION_RATE = 10
  const memberById = useMemo(() => {
    const map: Record<string, Member> = {}
    members.forEach(m => { map[m.id] = m })
    return map
  }, [members])

  const commissionFor = useCallback((p: Prospect) => {
    const ca = getProspectCA(p as any, formulaBillingTypes)
    if (p.custom_commission_rate != null && p.commission_approval_status !== 'rejected') {
      return ca * Number(p.custom_commission_rate) / 100
    }
    const m = p.assigned_to ? memberById[p.assigned_to] : undefined
    if (m?.compensation_type === 'fixed') return 0
    const rate = m?.commission_rate != null ? Number(m.commission_rate) : DEFAULT_COMMISSION_RATE
    return ca * rate / 100
  }, [formulaBillingTypes, memberById])

  const totalCommission = useMemo(() => wonLeads.reduce((s, p) => s + commissionFor(p), 0), [wonLeads, commissionFor])

  const setterByProspect = useMemo(() => {
    const map: Record<number, string | null | undefined> = {}
    prospects.forEach(p => { map[p.id] = p.assigned_setter })
    return map
  }, [prospects])

  // Fixe par RDV booké (setters) — cumulable avec les commissions, compté à part.
  const totalPerBooking = useMemo(() => {
    return filteredAppointments.reduce((sum, a) => {
      const setterId = a.prospect_id != null ? setterByProspect[a.prospect_id] : null
      const m = setterId ? memberById[setterId] : undefined
      return sum + (Number(m?.per_booking_amount) || 0)
    }, 0)
  }, [filteredAppointments, setterByProspect, memberById])

  // ─── Comparaison à la période précédente ───
  const prevStats = useMemo(() => {
    if (!prevCutoff) return null
    const prevWon = prospects.filter(p => p.stage === 'won' && inPrevPeriod(p.won_at || p.created_at))
    const prevLost = prospects.filter(p => p.stage === 'lost' && inPrevPeriod(p.lost_at || p.created_at))
    const prevNoshow = prospects.filter(p => p.stage === 'noshow' && inPrevPeriod(p.noshow_at || p.created_at) && p.previous_stage === 'followup')
    const prevLeads = prospects.filter(p => inPrevPeriod(p.created_at))
    const prevAppts = appointments.filter(a => inPrevPeriod(a.created_at))
    const prevDecided = prevWon.length + prevLost.length + prevNoshow.length
    return {
      ca: prevWon.reduce((s, p) => s + getProspectCA(p as any, formulaBillingTypes), 0),
      sales: prevWon.length,
      leads: prevLeads.length,
      commission: prevWon.reduce((s, p) => s + commissionFor(p), 0),
      closingRate: prevDecided > 0 ? (prevWon.length / prevDecided) * 100 : 0,
      showUp: prevAppts.filter(a => a.status === 'done').length,
      noshow: prospects.filter(p => p.stage === 'noshow' && inPrevPeriod(p.noshow_at || p.created_at)).length,
      lostRate: prevDecided > 0 ? (prevLost.length / prevDecided) * 100 : 0,
    }
  }, [prospects, appointments, prevCutoff, inPrevPeriod, formulaBillingTypes, commissionFor])

  // ─── Série temporelle (B1) ───
  // Granularité adaptée à la fenêtre : jour ≤ 31 j, semaine ≤ 180 j, sinon mois.
  const timeSeries = useMemo(() => {
    const granularity: 'day' | 'week' | 'month' =
      periodDays > 0 && periodDays <= 31 ? 'day' : periodDays > 0 && periodDays <= 180 ? 'week' : 'month'

    const bucketOf = (d: Date) => {
      if (granularity === 'day') return dayKey(d)
      if (granularity === 'week') {
        const monday = new Date(d)
        const shift = (d.getDay() + 6) % 7
        monday.setDate(d.getDate() - shift)
        return dayKey(monday)
      }
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    }

    const buckets = new Map<string, { key: string; ca: number; sales: number; leads: number }>()
    const touch = (key: string) => {
      if (!buckets.has(key)) buckets.set(key, { key, ca: 0, sales: 0, leads: 0 })
      return buckets.get(key)!
    }

    // Pré-remplit les intervalles vides pour ne pas afficher un graphe troué
    if (cutoff) {
      const cur = new Date(cutoff)
      const end = new Date()
      let guard = 0
      while (cur <= end && guard++ < 400) {
        touch(bucketOf(cur))
        if (granularity === 'day') cur.setDate(cur.getDate() + 1)
        else if (granularity === 'week') cur.setDate(cur.getDate() + 7)
        else cur.setMonth(cur.getMonth() + 1)
      }
    }

    filteredProspects.forEach(p => { touch(bucketOf(new Date(p.created_at))).leads += 1 })
    wonLeads.forEach(p => {
      const b = touch(bucketOf(new Date(p.won_at || p.created_at)))
      b.sales += 1
      b.ca += getProspectCA(p as any, formulaBillingTypes)
    })

    const fmt = (key: string) => {
      const d = new Date(key + 'T00:00:00')
      if (granularity === 'month') return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { month: 'short', year: '2-digit' })
      return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short' })
    }

    return Array.from(buckets.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(b => ({ ...b, label: fmt(b.key) }))
  }, [filteredProspects, wonLeads, cutoff, periodDays, formulaBillingTypes, lang])

  // ─── Nature du revenu : one-shot vs récurrent (B3) ───
  const revenueMix = useMemo(() => {
    let oneShot = 0
    let mrr = 0
    wonLeads.forEach(p => {
      const ca = getProspectCA(p as any, formulaBillingTypes)
      const isSub = !!p.stripe_subscription_id && !!p.subscription_amount
      if (isSub) {
        // Ramène l'abonnement à un montant mensuel comparable
        const interval = p.subscription_interval || 'month'
        const monthly = interval === 'year' ? ca / 12 : interval === 'week' ? ca * 4.33 : ca
        mrr += monthly
      } else {
        oneShot += ca
      }
    })
    const subs = prospects.filter(p => !!p.stripe_subscription_id)
    return {
      oneShot,
      mrr,
      activeSubs: subs.filter(p => p.subscription_status === 'active' || p.subscription_status === 'trialing').length,
      churnedSubs: subs.filter(p => p.subscription_status === 'canceled').length,
    }
  }, [wonLeads, prospects, formulaBillingTypes])

  // ─── Encaissement (B8) ───
  // Statuts de facture stockés en français (cf. OwnerFactures) : « payé » est le
  // seul état encaissé ; « retard » ou une échéance dépassée = en retard.
  const cashStats = useMemo(() => {
    const periodInvoices = invoices.filter(i => inPeriod(i.created_at))
    const amount = (i: Invoice) => Number(i.amount_ttc ?? i.amount_ht ?? 0)
    const isPaid = (i: Invoice) => i.status === 'payé'
    const paid = periodInvoices.filter(isPaid)
    const unpaid = periodInvoices.filter(i => !isPaid(i))
    const today = dayKey(new Date())
    return {
      count: periodInvoices.length,
      signed: periodInvoices.reduce((s, i) => s + amount(i), 0),
      collected: paid.reduce((s, i) => s + amount(i), 0),
      outstanding: unpaid.reduce((s, i) => s + amount(i), 0),
      overdue: unpaid
        .filter(i => i.status === 'retard' || (i.due_date && i.due_date < today))
        .reduce((s, i) => s + amount(i), 0),
    }
  }, [invoices, inPeriod])

  // ─── Performance par source (B4) ───
  const sourceStats = useMemo(() => {
    const map = new Map<string, { source: string; leads: number; won: number; lost: number; ca: number }>()
    const touch = (key: string) => {
      if (!map.has(key)) map.set(key, { source: key, leads: 0, won: 0, lost: 0, ca: 0 })
      return map.get(key)!
    }
    filteredProspects.forEach(p => { touch(p.source || t.report_no_source).leads += 1 })
    wonLeads.forEach(p => {
      const row = touch(p.source || t.report_no_source)
      row.won += 1
      row.ca += getProspectCA(p as any, formulaBillingTypes)
    })
    lostLeads.forEach(p => { touch(p.source || t.report_no_source).lost += 1 })
    return Array.from(map.values())
      .map(r => ({ ...r, closingRate: (r.won + r.lost) > 0 ? (r.won / (r.won + r.lost)) * 100 : 0 }))
      .sort((a, b) => b.ca - a.ca || b.leads - a.leads)
  }, [filteredProspects, wonLeads, lostLeads, formulaBillingTypes, t])

  // ─── CA par offre (B5) ───
  const offerStats = useMemo(() => {
    const map = new Map<string, { offer: string; count: number; ca: number }>()
    wonLeads.forEach(p => {
      const name = (p.formula_id && formulaNames[p.formula_id]) || p.offer || t.report_no_offer
      if (!map.has(name)) map.set(name, { offer: name, count: 0, ca: 0 })
      const row = map.get(name)!
      row.count += 1
      row.ca += getProspectCA(p as any, formulaBillingTypes)
    })
    return Array.from(map.values()).sort((a, b) => b.ca - a.ca)
  }, [wonLeads, formulaNames, formulaBillingTypes, t])

  // ─── Vitesse & relances (B6 / B7) ───
  const speedStats = useMemo(() => {
    const contacted = filteredProspects.filter(p => p.contacted_at)
    const delays = contacted
      .map(p => new Date(p.contacted_at!).getTime() - new Date(p.created_at).getTime())
      .filter(ms => ms >= 0)
    const avgDelay = delays.length > 0 ? delays.reduce((s, ms) => s + ms, 0) / delays.length / 1000 : 0
    const inRelance = filteredProspects.filter(p => (p.relance_step || 0) > 0 && !p.responded_at)
    const relanced = filteredProspects.filter(p => (p.relance_step || 0) > 0)
    const replied = relanced.filter(p => !!p.responded_at)
    const noshowRelanced = prospects.filter(p => (p.noshow_relance_step || 0) > 0 && inPeriod(p.noshow_at || p.created_at))
    // Récupéré = a été no-show (previous/actuel) et a repris le parcours
    const noshowRecovered = prospects.filter(p =>
      (p.noshow_relance_step || 0) > 0 && p.stage !== 'noshow' && inPeriod(p.noshow_at || p.created_at))
    return {
      avgDelay,
      under1h: delays.filter(ms => ms <= 3600_000).length,
      under24h: delays.filter(ms => ms <= 86_400_000).length,
      contactedCount: delays.length,
      inRelance: inRelance.length,
      relancedCount: relanced.length,
      replyRate: relanced.length > 0 ? (replied.length / relanced.length) * 100 : 0,
      noshowRelanced: noshowRelanced.length,
      noshowRecovered: noshowRecovered.length,
    }
  }, [filteredProspects, prospects, inPeriod])

  // Canal du premier contact (écrit / vocal / mail) — renseigné par la pop-up posée
  // à chaque prise de contact. « A répondu » suit la définition partagée avec les KPI
  // setter (bouton « Répondu » OU prospect avancé au-delà de « Contacté »).
  const channelStats = useMemo(() => {
    const contacted = filteredProspects.filter(p => p.stage !== 'prospect')
    const rows = channelResponseStats(contacted)
    return {
      rows,
      unknown: contacted.filter(p => !isContactChannel(p.first_contact_channel)).length,
      any: rows.some(r => r.sent > 0),
    }
  }, [filteredProspects])

  // ─── Activité téléphonique (B10) ───
  const callStats = useMemo(() => {
    const periodCalls = calls.filter(c => inPeriod(c.date))
    const answered = periodCalls.filter(c => c.answered)
    const talkSecs = periodCalls.reduce((s, c) => s + parseDuration(c.duration), 0)
    const perMember = new Map<string, { calls: number; answered: number; secs: number }>()
    periodCalls.forEach(c => {
      const key = c.team_member_id || 'owner'
      if (!perMember.has(key)) perMember.set(key, { calls: 0, answered: 0, secs: 0 })
      const row = perMember.get(key)!
      row.calls += 1
      if (c.answered) row.answered += 1
      row.secs += parseDuration(c.duration)
    })
    return {
      total: periodCalls.length,
      answered: answered.length,
      answerRate: periodCalls.length > 0 ? (answered.length / periodCalls.length) * 100 : 0,
      talkSecs,
      perMember,
    }
  }, [calls, inPeriod])

  // ─── Objectifs (B9) ───
  // Un objectif porte sa propre fenêtre (hebdo / mensuel) : on mesure le réalisé
  // sur CETTE fenêtre, pas sur la période sélectionnée en haut du rapport —
  // sinon un objectif mensuel serait comparé à 7 jours de réalisé.
  const objectiveProgress = useMemo(() => {
    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7))
    startOfWeek.setHours(0, 0, 0, 0)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
    const startOfYear = new Date(now.getFullYear(), 0, 1)

    const windowStart = (period: string | null) => {
      switch ((period || 'monthly').toLowerCase()) {
        case 'weekly': case 'week': return startOfWeek
        case 'quarterly': case 'quarter': return startOfQuarter
        case 'yearly': case 'year': return startOfYear
        default: return startOfMonth
      }
    }

    return objectives.map(o => {
      const start = windowStart(o.period)
      const inWin = (d: string | null | undefined) => !!d && new Date(d) >= start
      const won = prospects.filter(p => p.stage === 'won' && inWin(p.won_at || p.created_at))
      const lost = prospects.filter(p => p.stage === 'lost' && inWin(p.lost_at || p.created_at))
      const noshowFu = prospects.filter(p => p.stage === 'noshow' && p.previous_stage === 'followup' && inWin(p.noshow_at || p.created_at))
      const decided = won.length + lost.length + noshowFu.length

      const metric = (o.metric || '').toLowerCase()
      let current = 0
      let format: 'currency' | 'percent' | 'count' = 'count'
      switch (metric) {
        case 'ca': case 'revenue': case 'chiffre_affaires':
          current = won.reduce((s, p) => s + getProspectCA(p as any, formulaBillingTypes), 0)
          format = 'currency'
          break
        case 'deals': case 'sales': case 'ventes': case 'won':
          current = won.length
          break
        case 'close_rate': case 'closing_rate':
          current = decided > 0 ? (won.length / decided) * 100 : 0
          format = 'percent'
          break
        case 'leads': case 'prospects':
          current = prospects.filter(p => inWin(p.created_at)).length
          break
        case 'appointments': case 'rdv':
          current = appointments.filter(a => inWin(a.created_at)).length
          break
        case 'calls': case 'appels':
          current = calls.filter(c => inWin(c.date)).length
          break
      }

      const target = Number(o.target_value) || 0
      const periodLabel = ['weekly', 'week'].includes((o.period || '').toLowerCase())
        ? t.report_objective_this_week
        : t.report_objective_this_month
      return { ...o, current, target, format, periodLabel, pct: target > 0 ? Math.min((current / target) * 100, 100) : 0 }
    })
  }, [objectives, prospects, appointments, calls, formulaBillingTypes, t])

  // ─── Formulaires ───
  const formStats = useMemo(() => {
    const periodResponses = formResponses.filter(r => inPeriod(r.created_at))
    return forms.map(f => {
      const rows = periodResponses.filter(r => r.form_id === f.id)
      const withProspect = rows.filter(r => r.prospect_id != null)
      return {
        ...f,
        responses: rows.length,
        leads: withProspect.length,
        conversion: rows.length > 0 ? (withProspect.length / rows.length) * 100 : 0,
      }
    }).sort((a, b) => b.responses - a.responses)
  }, [forms, formResponses, inPeriod])

  // ─── Liens de tracking ───
  const trackingStats = useMemo(() => {
    const periodEvents = trackingEvents.filter(e => inPeriod(e.created_at))
    return trackingLinks.map(l => {
      const rows = periodEvents.filter(e => e.link_id === l.id)
      const visitors = new Set(rows.map(e => e.visitor_id).filter(Boolean))
      const durations = rows.map(e => Number(e.duration_seconds) || 0).filter(d => d > 0)
      return {
        ...l,
        clicks: rows.length,
        visitors: visitors.size,
        returning: rows.filter(e => e.is_returning).length,
        avgSecs: durations.length > 0 ? durations.reduce((s, d) => s + d, 0) / durations.length : 0,
      }
    }).sort((a, b) => b.clicks - a.clicks)
  }, [trackingLinks, trackingEvents, inPeriod])

  // ─── Campaign stats ───
  const campaignStats = useMemo(() => {
    return campaigns.map(c => {
      const campProspects = filteredProspects.filter(p => p.campaign_id === c.id)
      const campWon = wonLeads.filter(p => p.campaign_id === c.id)
      const campCA = campWon.reduce((s, p) => s + getProspectCA(p as any, formulaBillingTypes), 0)
      // Même règle que la commission globale : les lignes s'additionnent au total.
      const campCommission = campWon.reduce((s, p) => s + commissionFor(p), 0)
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
  }, [campaigns, filteredProspects, wonLeads, formulaBillingTypes, commissionFor])

  // ─── Stage distribution for pie ───
  const stageData = useMemo(() => {
    const stages = [
      { id: 'prospect', name: t.report_stage_new_lead, color: '#006c49' },
      { id: 'contacted', name: t.report_stage_contacted, color: '#38bdf8' },
      { id: 'qualified', name: t.report_stage_qualified, color: '#ffb95f' },
      { id: 'unqualified', name: t.report_stage_unqualified, color: '#c4c7c7' },
      { id: 'followup', name: t.report_stage_followup, color: '#1b1c1b' },
      { id: 'won', name: t.report_stage_won, color: '#006c49' },
      { id: 'lost', name: t.report_stage_lost, color: '#ba1a1a' },
      { id: 'noanswer', name: t.report_stage_no_answer, color: '#747878' },
      { id: 'noshow', name: t.report_stage_no_show, color: '#444748' },
    ]
    return stages.map(s => ({
      name: s.name,
      value: filteredProspects.filter(p => p.stage === s.id).length,
      color: s.color,
    })).filter(s => s.value > 0)
  }, [filteredProspects, t])

  // ─── Loss reason distribution ───
  const LOSS_REASON_COLORS: Record<string, string> = {
    'Je dois y réfléchir': '#6366f1', 'Argent/budget': '#f59e0b', 'Doit en parler': '#8b5cf6',
    "C'est pas le moment": '#64748b', 'Peur': '#ef4444', 'Ecran de fumée': '#f97316', 'Autre': '#a1a1aa',
  }
  const lossReasonData = useMemo(() => {
    const lost = lostLeads
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
  }, [lostLeads])

  // ─── Motifs de disqualification (B2) ───
  // Pendant exact des motifs de perte, sur les leads passés en « non qualifié ».
  const UNQUALIFIED_COLORS: Record<string, string> = {
    territory: '#0ea5e9', budget: '#f59e0b', not_decision_maker: '#8b5cf6',
    off_target: '#64748b', offer_mismatch: '#14b8a6', timing: '#6366f1',
    unreachable: '#f97316', duplicate: '#a1a1aa', other: '#d4d4d8',
  }
  const unqualifiedLeads = useMemo(
    () => prospects.filter(p => p.stage === 'unqualified' && inPeriod(p.unqualified_at || p.created_at)),
    [prospects, inPeriod])

  const unqualifiedReasonData = useMemo(() => {
    const counts: Record<string, number> = {}
    unqualifiedLeads.forEach(p => {
      if (p.unqualified_reason) counts[p.unqualified_reason] = (counts[p.unqualified_reason] || 0) + 1
    })
    return Object.entries(counts)
      .map(([key, value]) => ({
        key,
        name: unqualifiedReasonLabel(key, lang === 'en' ? 'en' : 'fr'),
        value,
        color: UNQUALIFIED_COLORS[key] || '#d4d4d8',
      }))
      .sort((a, b) => b.value - a.value)
  }, [unqualifiedLeads, lang])

  // Détail des disqualifications « Autre » (texte libre), mêmes filtres que la modale perte
  const unqualifiedAutreDetails = useMemo(() => {
    return unqualifiedLeads
      .filter(p => p.unqualified_reason === 'other')
      .filter(p => autreFilterCampaign === 'all' || p.campaign_id === autreFilterCampaign)
      .filter(p => autreFilterCloser === 'all' || p.assigned_to === autreFilterCloser)
      .map(p => {
        const closer = members.find(m => m.id === p.assigned_to)
        return {
          id: p.id,
          motif: p.unqualified_details || t.report_not_specified,
          prospect: p.contact || `Prospect #${p.id}`,
          closer: closer ? `${closer.first_name} ${closer.last_name}`.trim() : t.report_not_assigned,
          date: p.unqualified_at || p.created_at,
        }
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [unqualifiedLeads, members, autreFilterCampaign, autreFilterCloser, t])

  // ─── "Autre" loss reason detail ───
  const autreDetails = useMemo(() => {
    const autreCutoff = (() => {
      if (autreFilterPeriod === 0) return null
      const d = new Date(); d.setDate(d.getDate() - autreFilterPeriod); return d
    })()
    return prospects
      .filter(p => p.stage === 'lost')
      .filter(p => {
        let reason = p.loss_reason
        if (!reason && Array.isArray(p.call_notes)) {
          for (let i = p.call_notes.length - 1; i >= 0; i--) {
            const match = p.call_notes[i].content?.match(/- Motif: (.+)/)
            if (match) { reason = match[1]; break }
          }
        }
        return reason === 'Autre'
      })
      .filter(p => !autreCutoff || new Date(p.created_at) >= autreCutoff)
      .filter(p => autreFilterCampaign === 'all' || p.campaign_id === autreFilterCampaign)
      .filter(p => autreFilterCloser === 'all' || p.assigned_to === autreFilterCloser)
      .filter(p => {
        if (autreFilterTeam === 'all') return true
        const teamMemberIds = allTeamMembers.filter(m => m.team_id === autreFilterTeam).map(m => m.id)
        return teamMemberIds.includes(p.assigned_to || '')
      })
      .map(p => {
        const closer = members.find(m => m.id === p.assigned_to)
        return {
          id: p.id,
          motif: p.loss_details || t.report_not_specified,
          prospect: p.contact || `Prospect #${p.id}`,
          closer: closer ? `${closer.first_name} ${closer.last_name}`.trim() : t.report_not_assigned,
          date: p.created_at,
        }
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [prospects, members, autreFilterPeriod, autreFilterCampaign, autreFilterCloser, autreFilterTeam, allTeamMembers, t])

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

  const periodLabel = PERIODS.find(p => p.days === periodDays)?.label || t.report_7_days

  // ─── Activity Feed (Today only) ───
  const todayActivities = useMemo(() => {
    if (periodDays !== 1) return []

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const getMemberName = (memberId: string | null) => {
      if (!memberId) return t.report_you
      const m = members.find(mem => mem.id === memberId)
      return m ? `${m.first_name} ${m.last_name}` : t.report_member
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
          action: t.report_added_prospect,
          detail: (p as any).contact || `Prospect #${p.id}`,
          timestamp: d,
          icon: Users,
          color: 'text-emerald-700 bg-emerald-50',
        })
      }
    })

    // Événements de décision : datés par l'horodatage réel du changement d'étape
    // (won_at / lost_at / noshow_at / unqualified_at), plus par la date de création.
    prospects.forEach(p => {
      const stamp = p.stage === 'won' ? p.won_at
        : p.stage === 'lost' ? p.lost_at
        : p.stage === 'noshow' ? p.noshow_at
        : p.stage === 'unqualified' ? p.unqualified_at
        : null
      if (!stamp) return
      if (['won', 'lost', 'noshow', 'unqualified'].includes(p.stage)) {
        const d = new Date(stamp)
        if (d >= today && d < tomorrow) {
          const actionMap: Record<string, string> = {
            won: t.report_closed_sale,
            lost: t.report_lost_deal,
            noshow: t.report_marked_noshow,
            unqualified: t.report_stage_unqualified,
          }
          const colorMap: Record<string, string> = {
            won: 'text-emerald-700 bg-emerald-50',
            lost: 'text-red-700 bg-red-50',
            noshow: 'text-stone-600 dark:text-neutral-300 bg-stone-100 dark:bg-neutral-800',
            unqualified: 'text-stone-600 dark:text-neutral-300 bg-stone-100 dark:bg-neutral-800',
          }
          events.push({
            id: `stage-${p.id}-${p.stage}`,
            member_name: getMemberName((p as any).assigned_to),
            member_id: (p as any).assigned_to || 'owner',
            action: actionMap[p.stage] || t.report_modified_pipeline,
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
          action: t.report_scheduled_appointment,
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
          action: t.report_scheduled_reminder,
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
  }, [periodDays, prospects, filteredProspects, filteredAppointments, reminders, members, activityFilterMember, t])

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
          <p className="text-stone-500 dark:text-neutral-400 text-sm">{t.report_subtitle}</p>
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
            {t.report_export_pdf_btn}
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
            <Delta current={totalCA} previous={prevStats?.ca} label={t.report_vs_previous} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-stone-400 dark:text-neutral-500 uppercase tracking-[0.15em] mb-1">{t.report_ca_generated}</p>
            <p className="text-3xl font-extrabold text-stone-900 dark:text-white">{formatCurrency(totalCA)}</p>
          </div>
        </div>

        {/* Ventes */}
        <div className="glass-card p-7 rounded-2xl flex flex-col justify-between hover:shadow-lg transition-all duration-300">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-stone-100 dark:bg-neutral-800 rounded-2xl">
              <ShoppingCart className="h-5 w-5 text-stone-700 dark:text-neutral-200" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-stone-500 dark:text-neutral-400 font-bold text-[10px] bg-stone-100 dark:bg-neutral-800 px-2.5 py-1 rounded-full">{formatCurrency(avgDeal)} {t.report_avg_short}</span>
              <Delta current={wonLeads.length} previous={prevStats?.sales} label={t.report_vs_previous} />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-stone-400 dark:text-neutral-500 uppercase tracking-[0.15em] mb-1">{t.report_sales}</p>
            <p className="text-3xl font-extrabold text-stone-900 dark:text-white">{wonLeads.length}</p>
          </div>
        </div>

        {/* Taux de Closing */}
        <div className="glass-card p-7 rounded-2xl flex flex-col justify-between hover:shadow-lg transition-all duration-300 border-l-4 border-stone-400 dark:border-neutral-500">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-stone-100 dark:bg-neutral-800 rounded-2xl">
              <Target className="h-5 w-5 text-stone-700 dark:text-neutral-200" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-stone-700 dark:text-neutral-200 font-bold text-[10px] bg-stone-100 dark:bg-neutral-800 px-2.5 py-1 rounded-full">
                {closingRate >= 25 ? t.report_closing_rate_high : closingRate >= 15 ? t.report_closing_rate_normal : t.report_closing_rate_low}
              </span>
              <Delta current={closingRate} previous={prevStats?.closingRate} label={t.report_vs_previous} />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-stone-400 dark:text-neutral-500 uppercase tracking-[0.15em] mb-1">{t.report_closing_rate}</p>
            <p className="text-3xl font-extrabold text-stone-900 dark:text-white">{formatPct(closingRate)}</p>
          </div>
        </div>

        {/* Commission estimée */}
        <div className="glass-card p-7 rounded-2xl flex flex-col justify-between hover:shadow-lg transition-all duration-300">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl">
              <Activity className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
            </div>
            <Delta current={totalCommission} previous={prevStats?.commission} label={t.report_vs_previous} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-stone-400 dark:text-neutral-500 uppercase tracking-[0.15em] mb-1">{t.report_estimated_commission}</p>
            <p className="text-3xl font-extrabold text-stone-900 dark:text-white">{formatCurrency(totalCommission)}</p>
            <p className="text-[10px] text-stone-400 dark:text-neutral-500 mt-1">{t.report_commission_note}</p>
          </div>
        </div>
      </section>

      {/* Secondary KPIs row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-14">
        <div className="glass-card p-5 rounded-2xl hover:shadow-lg transition-all duration-300">
          <p className="text-[10px] font-bold text-stone-400 dark:text-neutral-500 uppercase tracking-[0.15em] mb-1">{t.report_total_leads}</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-extrabold text-stone-900 dark:text-white">{totalLeads}</p>
            <Delta current={totalLeads} previous={prevStats?.leads} label={t.report_vs_previous} />
          </div>
        </div>
        <div className="glass-card p-5 rounded-2xl hover:shadow-lg transition-all duration-300">
          <p className="text-[10px] font-bold text-stone-400 dark:text-neutral-500 uppercase tracking-[0.15em] mb-1">{t.report_show_up}</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-extrabold text-stone-900 dark:text-white">{doneAppts}</p>
            <Delta current={doneAppts} previous={prevStats?.showUp} label={t.report_vs_previous} />
          </div>
        </div>
        <div className="glass-card p-5 rounded-2xl hover:shadow-lg transition-all duration-300">
          <p className="text-[10px] font-bold text-stone-400 dark:text-neutral-500 uppercase tracking-[0.15em] mb-1">{t.report_no_show}</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-extrabold text-red-600">{noshowLeads.length}</p>
            <Delta current={noshowLeads.length} previous={prevStats?.noshow} label={t.report_vs_previous} inverted />
          </div>
        </div>
        <div className="glass-card p-5 rounded-2xl hover:shadow-lg transition-all duration-300">
          <p className="text-[10px] font-bold text-stone-400 dark:text-neutral-500 uppercase tracking-[0.15em] mb-1">{t.report_loss_rate}</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-extrabold text-stone-900 dark:text-white">{formatPct(lostRate)}</p>
            <Delta current={lostRate} previous={prevStats?.lostRate} label={t.report_vs_previous} inverted />
          </div>
        </div>
      </section>

      {/* ─── Objectifs (B9) ─── */}
      {objectiveProgress.length > 0 && (
        <section className="glass-card rounded-2xl p-7 mb-14">
          <div className="flex items-center gap-3 mb-6">
            <Target className="h-5 w-5 text-stone-400" />
            <h3 className="text-lg font-extrabold text-stone-900 dark:text-white">{t.report_objectives}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
            {objectiveProgress.map(o => {
              const fmt = (v: number) =>
                o.format === 'currency' ? formatCurrency(v) : o.format === 'percent' ? formatPct(v) : String(Math.round(v))
              const reached = o.target > 0 && o.current >= o.target
              return (
                <div key={o.id}>
                  <div className="flex justify-between items-baseline mb-2 gap-3">
                    <span className="text-sm font-bold text-stone-900 dark:text-white truncate">
                      {o.label}
                      <span className="ml-2 text-[10px] font-medium text-stone-400 dark:text-neutral-500 uppercase tracking-wider">{o.periodLabel}</span>
                    </span>
                    <span className="text-xs font-bold text-stone-500 dark:text-neutral-400 whitespace-nowrap">
                      {fmt(o.current)} / {fmt(o.target)}
                      {reached && <span className="ml-2 text-emerald-700 dark:text-emerald-400">· {t.report_objective_reached}</span>}
                    </span>
                  </div>
                  <div className="w-full bg-stone-100 dark:bg-neutral-800 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${o.pct}%`, backgroundColor: reached ? '#006c49' : '#ffb95f' }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ─── Évolution (B1) ─── */}
      <section className="glass-card rounded-2xl p-7 mb-14">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-7">
          <div>
            <h3 className="text-lg font-extrabold text-stone-900 dark:text-white">{t.report_evolution}</h3>
            <p className="text-sm text-stone-400 dark:text-neutral-500">{t.report_evolution_desc}</p>
          </div>
        </div>
        {timeSeries.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-sm text-stone-400 dark:text-neutral-500">{t.report_no_data}</div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={timeSeries} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#a8a29e' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="ca" tick={{ fontSize: 11, fill: '#a8a29e' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 11, fill: '#a8a29e' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e7e5e4', fontSize: 12 }}
                  formatter={((v: number, name: string) => [name === t.report_ca_label ? formatCurrency(v) : v, name]) as any}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="ca" dataKey="ca" name={t.report_ca_label} fill="#006c49" radius={[6, 6, 0, 0]} maxBarSize={38} />
                <Line yAxisId="count" type="monotone" dataKey="leads" name={t.report_leads_label} stroke="#ffb95f" strokeWidth={2} dot={false} />
                <Line yAxisId="count" type="monotone" dataKey="sales" name={t.report_sales_label} stroke="#1b1c1b" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* ─── Activity Feed (Today only) ─── */}
      {periodDays === 1 && (
        <section className="glass-card rounded-2xl p-7 mb-14">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-extrabold text-stone-900 dark:text-white">{t.report_activity_feed_today}</h3>
            {members.length > 0 && (
              <div className="relative">
                <select
                  value={activityFilterMember}
                  onChange={(e) => setActivityFilterMember(e.target.value)}
                  className="appearance-none rounded-full border border-stone-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 pl-8 pr-9 py-2 text-xs font-semibold text-stone-600 dark:text-neutral-300 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="all">{t.report_all_members}</option>
                  <option value="owner">{t.report_me_owner}</option>
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
              <p className="text-sm text-stone-400 dark:text-neutral-500">{t.report_no_activity_today}</p>
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
                      {event.timestamp.toLocaleTimeString(lang === 'en' ? 'en-US' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* ─── Nature du revenu (B3) + Encaissement (B8) ─── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-7 mb-14">
        {/* Revenue mix */}
        <div className="glass-card p-7 rounded-2xl">
          <div className="flex items-center gap-3 mb-6">
            <Repeat className="h-5 w-5 text-stone-400" />
            <h3 className="text-lg font-extrabold text-stone-900 dark:text-white">{t.report_revenue_split}</h3>
          </div>
          {(() => {
            const total = revenueMix.oneShot + revenueMix.mrr
            const oneShotPct = total > 0 ? (revenueMix.oneShot / total) * 100 : 0
            return (
              <>
                <div className="w-full bg-stone-100 dark:bg-neutral-800 h-3 rounded-full overflow-hidden mb-6 flex">
                  <div className="h-full" style={{ width: `${oneShotPct}%`, backgroundColor: '#006c49' }} />
                  <div className="h-full" style={{ width: `${100 - oneShotPct}%`, backgroundColor: '#ffb95f' }} />
                </div>
                <div className="grid grid-cols-2 gap-5 mb-5">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#006c49' }} />
                      <p className="text-[10px] font-bold text-stone-400 dark:text-neutral-500 uppercase tracking-[0.15em]">{t.report_one_shot}</p>
                    </div>
                    <p className="text-2xl font-extrabold text-stone-900 dark:text-white">{formatCurrency(revenueMix.oneShot)}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#ffb95f' }} />
                      <p className="text-[10px] font-bold text-stone-400 dark:text-neutral-500 uppercase tracking-[0.15em]">{t.report_mrr}</p>
                    </div>
                    <p className="text-2xl font-extrabold text-stone-900 dark:text-white">{formatCurrency(revenueMix.mrr)}</p>
                  </div>
                </div>
                <div className="space-y-2 pt-4 border-t border-stone-100 dark:border-neutral-800">
                  <StatLine label={t.report_active_subs} value={revenueMix.activeSubs} color="emerald" />
                  <StatLine label={t.report_churned_subs} value={revenueMix.churnedSubs} color="red" />
                </div>
              </>
            )
          })()}
        </div>

        {/* Encaissement */}
        <div className="glass-card p-7 rounded-2xl">
          <div className="flex items-center gap-3 mb-6">
            <Wallet className="h-5 w-5 text-stone-400" />
            <h3 className="text-lg font-extrabold text-stone-900 dark:text-white">{t.report_cash}</h3>
          </div>
          {cashStats.count === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-stone-400 dark:text-neutral-500">{t.report_no_invoices}</div>
          ) : (
            <>
              <div className="mb-6">
                <p className="text-[10px] font-bold text-stone-400 dark:text-neutral-500 uppercase tracking-[0.15em] mb-1">{t.report_signed}</p>
                <p className="text-3xl font-extrabold text-stone-900 dark:text-white">{formatCurrency(cashStats.signed)}</p>
              </div>
              <div className="w-full bg-stone-100 dark:bg-neutral-800 h-3 rounded-full overflow-hidden mb-6">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${cashStats.signed > 0 ? (cashStats.collected / cashStats.signed) * 100 : 0}%`, backgroundColor: '#006c49' }}
                />
              </div>
              <div className="space-y-2">
                <StatLine label={t.report_collected} value={formatCurrency(cashStats.collected)} color="emerald" isText />
                <StatLine label={t.report_outstanding} value={formatCurrency(cashStats.outstanding)} color="stone" isText />
                <StatLine label={t.report_overdue} value={formatCurrency(cashStats.overdue)} color="red" isText />
              </div>
            </>
          )}
        </div>
      </section>

      {/* ─── Charts Section ─── */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-7 mb-14">
        {/* Donut chart: Répartition des leads */}
        <div className="lg:col-span-2 glass-card p-7 rounded-2xl">
          <h3 className="text-lg font-extrabold text-stone-900 dark:text-white mb-7">{t.report_leads_by_stage}</h3>
          {stageData.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-sm text-stone-400 dark:text-neutral-500">{t.report_no_data}</div>
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
          <h3 className="text-lg font-extrabold text-stone-900 dark:text-white mb-7">{t.report_ca_by_campaign}</h3>
          {campaignStats.filter(c => c.ca > 0).length === 0 ? (
            <div className="flex items-center justify-center h-64 text-sm text-stone-400 dark:text-neutral-500">{t.report_no_data}</div>
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

      {/* ─── Performance par source (B4) + CA par offre (B5) ─── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-7 mb-14">
        {/* Sources — masqué tant qu'aucun lead n'a de source renseignée */}
        {sourceStats.some(s => s.source !== t.report_no_source) && (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 p-7 border-b border-stone-100 dark:border-neutral-800">
            <Megaphone className="h-5 w-5 text-stone-400" />
            <h3 className="text-lg font-extrabold text-stone-900 dark:text-white">{t.report_by_source}</h3>
          </div>
          {sourceStats.length === 0 ? (
            <p className="text-sm text-stone-400 dark:text-neutral-500 text-center py-10">{t.report_no_data_period}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-stone-50 dark:bg-neutral-800/50">
                    <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400 dark:text-neutral-500">{t.report_source}</th>
                    <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400 dark:text-neutral-500 text-center">{t.report_leads_label}</th>
                    <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400 dark:text-neutral-500 text-center">{t.report_won}</th>
                    <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400 dark:text-neutral-500 text-center">{t.report_conv}</th>
                    <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400 dark:text-neutral-500 text-right">{t.report_ca}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50 dark:divide-neutral-800">
                  {sourceStats.map(s => (
                    <tr key={s.source} className="hover:bg-stone-50 dark:hover:bg-neutral-800/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-stone-900 dark:text-white">{s.source}</td>
                      <td className="px-6 py-4 text-sm text-center text-stone-700 dark:text-neutral-200">{s.leads}</td>
                      <td className="px-6 py-4 text-sm text-center text-stone-700 dark:text-neutral-200">{s.won}</td>
                      <td className="px-6 py-4 text-sm text-center font-bold text-stone-700 dark:text-neutral-200">{formatPct(s.closingRate)}</td>
                      <td className="px-6 py-4 text-right font-extrabold text-stone-900 dark:text-white">{formatCurrency(s.ca)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        )}

        {/* Offres */}
        <div className="glass-card p-7 rounded-2xl">
          <div className="flex items-center gap-3 mb-7">
            <ShoppingCart className="h-5 w-5 text-stone-400" />
            <h3 className="text-lg font-extrabold text-stone-900 dark:text-white">{t.report_by_offer}</h3>
          </div>
          {offerStats.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-stone-400 dark:text-neutral-500">{t.report_no_data_period}</div>
          ) : (
            <div className="space-y-5">
              {offerStats.map((o, i) => {
                const maxOffer = Math.max(offerStats[0]?.ca || 0, 1)
                return (
                  <div key={o.offer}>
                    <div className="flex justify-between text-sm mb-2 gap-3">
                      <span className="font-bold text-stone-900 dark:text-white truncate">{o.offer}</span>
                      <span className="font-bold whitespace-nowrap" style={{ color: BAR_COLORS[i % BAR_COLORS.length] }}>
                        {formatCurrency(o.ca)} <span className="text-stone-400 dark:text-neutral-500 font-medium">· {o.count}</span>
                      </span>
                    </div>
                    <div className="w-full bg-stone-100 dark:bg-neutral-800 h-3 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(o.ca / maxOffer) * 100}%`, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* ─── Formulaires + Liens de tracking ─── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-7 mb-14">
        {/* Formulaires */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 p-7 border-b border-stone-100 dark:border-neutral-800">
            <ClipboardList className="h-5 w-5 text-stone-400" />
            <h3 className="text-lg font-extrabold text-stone-900 dark:text-white">{t.report_forms}</h3>
          </div>
          {formStats.length === 0 ? (
            <p className="text-sm text-stone-400 dark:text-neutral-500 text-center py-10">{t.report_no_forms}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-stone-50 dark:bg-neutral-800/50">
                    <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400 dark:text-neutral-500">{t.report_form}</th>
                    <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400 dark:text-neutral-500 text-center">{t.report_responses}</th>
                    <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400 dark:text-neutral-500 text-center">{t.report_leads_created}</th>
                    <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400 dark:text-neutral-500 text-right">{t.report_conv}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50 dark:divide-neutral-800">
                  {formStats.map(f => (
                    <tr key={f.id} className="hover:bg-stone-50 dark:hover:bg-neutral-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-bold text-stone-900 dark:text-white">{f.name}</span>
                        {!f.is_active && <span className="ml-2 text-[10px] font-bold text-stone-400 dark:text-neutral-500">· {t.report_paused}</span>}
                      </td>
                      <td className="px-6 py-4 text-sm text-center text-stone-700 dark:text-neutral-200">{f.responses}</td>
                      <td className="px-6 py-4 text-sm text-center text-stone-700 dark:text-neutral-200">{f.leads}</td>
                      <td className="px-6 py-4 text-sm text-right font-bold text-stone-700 dark:text-neutral-200">{formatPct(f.conversion)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Liens de tracking */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 p-7 border-b border-stone-100 dark:border-neutral-800">
            <Link2 className="h-5 w-5 text-stone-400" />
            <h3 className="text-lg font-extrabold text-stone-900 dark:text-white">{t.report_tracking_links}</h3>
          </div>
          {trackingStats.length === 0 ? (
            <p className="text-sm text-stone-400 dark:text-neutral-500 text-center py-10">{t.report_no_tracking_links}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-stone-50 dark:bg-neutral-800/50">
                    <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400 dark:text-neutral-500">{t.report_link}</th>
                    <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400 dark:text-neutral-500 text-center">{t.report_clicks}</th>
                    <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400 dark:text-neutral-500 text-center">{t.report_unique_visitors}</th>
                    <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400 dark:text-neutral-500 text-center">{t.report_returning}</th>
                    <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400 dark:text-neutral-500 text-right">{t.report_avg_time}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50 dark:divide-neutral-800">
                  {trackingStats.map(l => (
                    <tr key={l.id} className="hover:bg-stone-50 dark:hover:bg-neutral-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-bold text-stone-900 dark:text-white">{l.name}</span>
                        <span className="block text-[10px] text-stone-400 dark:text-neutral-500">/t/{l.slug}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-center text-stone-700 dark:text-neutral-200">{l.clicks}</td>
                      <td className="px-6 py-4 text-sm text-center text-stone-700 dark:text-neutral-200">{l.visitors}</td>
                      <td className="px-6 py-4 text-sm text-center text-stone-700 dark:text-neutral-200">{l.returning}</td>
                      <td className="px-6 py-4 text-sm text-right font-bold text-stone-700 dark:text-neutral-200">{humanDuration(l.avgSecs, lang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ─── Loss Reason Pie Chart ─── */}
      {lossReasonData.length > 0 && (
      <section className="glass-card p-7 rounded-2xl mb-14">
        <h3 className="text-lg font-extrabold text-stone-900 dark:text-white mb-7">{t.report_loss_reasons}</h3>
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
              const isAutre = d.name === 'Autre'
              return (
                <div
                  key={d.name}
                  className={`flex justify-between items-center ${isAutre ? 'cursor-pointer hover:bg-stone-50 dark:hover:bg-neutral-800 -mx-3 px-3 py-1.5 rounded-xl transition-colors' : ''}`}
                  onClick={isAutre ? () => setShowAutreModal(true) : undefined}
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
      </section>
      )}

      {/* ─── Motifs de disqualification (B2) ─── */}
      {unqualifiedReasonData.length > 0 && (
      <section className="glass-card p-7 rounded-2xl mb-14">
        <h3 className="text-lg font-extrabold text-stone-900 dark:text-white mb-7">{t.report_unqualified_reasons}</h3>
        <div className="flex flex-col lg:flex-row items-center gap-8">
          <div className="relative w-56 h-56 mx-auto lg:mx-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={unqualifiedReasonData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value">
                  {unqualifiedReasonData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e7e5e4', fontSize: 12 }} formatter={((v: number) => [v, 'Leads']) as any} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-3 w-full">
            {unqualifiedReasonData.map(d => {
              const total = unqualifiedReasonData.reduce((s, r) => s + r.value, 0)
              const isAutre = d.key === 'other'
              return (
                <div
                  key={d.key}
                  className={`flex justify-between items-center ${isAutre ? 'cursor-pointer hover:bg-stone-50 dark:hover:bg-neutral-800 -mx-3 px-3 py-1.5 rounded-xl transition-colors' : ''}`}
                  onClick={isAutre ? () => setShowUnqualifiedModal(true) : undefined}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className={`text-sm font-medium text-stone-700 dark:text-neutral-200 truncate ${isAutre ? 'underline decoration-dashed underline-offset-4' : ''}`}>{d.name}</span>
                    {isAutre && <ArrowRight className="h-3.5 w-3.5 text-stone-400 shrink-0" />}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
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

      {/* ─── Détail des disqualifications « Autre » ─── */}
      {showUnqualifiedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowUnqualifiedModal(false)} />
          <div className="relative w-full max-w-3xl max-h-[85vh] bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl border border-stone-200/20 dark:border-neutral-700 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-stone-100 dark:border-neutral-800">
              <div>
                <h3 className="text-lg font-extrabold text-stone-900 dark:text-white">{t.report_unqualified_detail_title}</h3>
                <p className="text-xs text-stone-500 dark:text-neutral-400 mt-1">{unqualifiedAutreDetails.length} {unqualifiedAutreDetails.length > 1 ? t.report_results : t.report_result}</p>
              </div>
              <button onClick={() => setShowUnqualifiedModal(false)} className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-neutral-800 transition-colors">
                <X className="h-5 w-5 text-stone-500" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-stone-100 dark:border-neutral-800 bg-stone-50/50 dark:bg-neutral-800/50">
              <Filter className="h-4 w-4 text-stone-400 shrink-0" />
              <select
                value={autreFilterCampaign}
                onChange={e => setAutreFilterCampaign(e.target.value)}
                className="text-xs font-bold bg-white dark:bg-neutral-800 border border-stone-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-stone-700 dark:text-neutral-200 outline-none focus:ring-2 focus:ring-stone-900/10"
              >
                <option value="all">{t.report_all_campaigns}</option>
                {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select
                value={autreFilterCloser}
                onChange={e => setAutreFilterCloser(e.target.value)}
                className="text-xs font-bold bg-white dark:bg-neutral-800 border border-stone-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-stone-700 dark:text-neutral-200 outline-none focus:ring-2 focus:ring-stone-900/10"
              >
                <option value="all">{t.report_all_closers}</option>
                {members.filter(m => ['Closer', 'Setter-Closer', 'Owner', 'Head of Sales'].includes(m.role)).map(m => (
                  <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                ))}
              </select>
            </div>
            <div className="overflow-y-auto flex-1">
              {unqualifiedAutreDetails.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-stone-400 dark:text-neutral-500">
                  <UserX className="h-10 w-10 mb-3 opacity-50" />
                  <p className="text-sm font-medium">{t.report_no_autre_found}</p>
                  <p className="text-xs mt-1">{t.report_try_modify_filters}</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-stone-100 dark:border-neutral-800">
                      <th className="text-left text-[10px] uppercase tracking-widest font-bold text-stone-400 dark:text-neutral-500 px-6 py-3">{t.report_reason}</th>
                      <th className="text-left text-[10px] uppercase tracking-widest font-bold text-stone-400 dark:text-neutral-500 px-6 py-3">{t.report_prospect}</th>
                      <th className="text-left text-[10px] uppercase tracking-widest font-bold text-stone-400 dark:text-neutral-500 px-6 py-3">{t.report_closer}</th>
                      <th className="text-right text-[10px] uppercase tracking-widest font-bold text-stone-400 dark:text-neutral-500 px-6 py-3">{t.report_date}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unqualifiedAutreDetails.map(row => (
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

      {/* ─── Vitesse & relances (B6/B7) + Activité téléphonique (B10) ─── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-7 mb-14">
        <div className="glass-card p-7 rounded-2xl">
          <div className="flex items-center gap-3 mb-6">
            <Zap className="h-5 w-5 text-stone-400" />
            <h3 className="text-lg font-extrabold text-stone-900 dark:text-white">{t.report_speed_relances}</h3>
          </div>
          <div className="mb-6">
            <p className="text-[10px] font-bold text-stone-400 dark:text-neutral-500 uppercase tracking-[0.15em] mb-1">{t.report_speed_to_lead}</p>
            <p className="text-3xl font-extrabold text-stone-900 dark:text-white">
              {speedStats.contactedCount > 0 ? humanDuration(speedStats.avgDelay, lang) : '—'}
            </p>
          </div>
          <div className="space-y-2">
            <StatLine
              label={t.report_contacted_1h}
              value={speedStats.contactedCount > 0 ? `${speedStats.under1h} · ${formatPct((speedStats.under1h / speedStats.contactedCount) * 100)}` : '—'}
              color="emerald" isText
            />
            <StatLine
              label={t.report_contacted_24h}
              value={speedStats.contactedCount > 0 ? `${speedStats.under24h} · ${formatPct((speedStats.under24h / speedStats.contactedCount) * 100)}` : '—'}
              color="stone" isText
            />
            <StatLine label={t.report_in_relance} value={speedStats.inRelance} color="amber" />
            <StatLine label={t.report_relance_reply_rate} value={formatPct(speedStats.replyRate)} color="emerald" isText />
            <StatLine label={t.report_noshow_relance} value={speedStats.noshowRelanced} color="stone" />
            <StatLine label={t.report_noshow_recovered} value={speedStats.noshowRecovered} color="emerald" />
          </div>

          {/* Taux de réponse par canal de premier contact */}
          <div className="mt-7 pt-6 border-t border-stone-200/60 dark:border-neutral-700/60">
            <p className="text-[10px] font-bold text-stone-400 dark:text-neutral-500 uppercase tracking-[0.15em] mb-1">{t.report_channel_rate}</p>
            <p className="text-xs text-stone-400 dark:text-neutral-500 mb-4">{t.report_channel_sub}</p>
            {!channelStats.any ? (
              <p className="text-sm text-stone-400 dark:text-neutral-500 italic">{t.report_channel_empty}</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  {channelStats.rows.map(row => {
                    const meta = CONTACT_CHANNELS.find(c => c.key === row.key)!
                    return (
                      <div key={row.key} className="rounded-xl border border-stone-200/70 dark:border-neutral-700/60 p-3">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-sm leading-none">{meta.emoji}</span>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-neutral-500 truncate">{lang === 'en' ? meta.en : meta.fr}</span>
                        </div>
                        <p className="text-2xl font-extrabold text-stone-900 dark:text-white">{formatPct(row.rate)}</p>
                        <p className="text-[11px] text-stone-400 dark:text-neutral-500 mt-0.5">{row.replied} / {row.sent}</p>
                        <div className="mt-2 h-1.5 rounded-full bg-stone-200/70 dark:bg-neutral-700/60 overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, row.rate)}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
                {channelStats.unknown > 0 && (
                  <p className="text-[11px] text-stone-400 dark:text-neutral-500 mt-3">
                    {t.report_channel_unknown.replace('{n}', String(channelStats.unknown))}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        <div className="glass-card p-7 rounded-2xl">
          <div className="flex items-center gap-3 mb-6">
            <Phone className="h-5 w-5 text-stone-400" />
            <h3 className="text-lg font-extrabold text-stone-900 dark:text-white">{t.report_calls}</h3>
          </div>
          {callStats.total === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-stone-400 dark:text-neutral-500">{t.report_no_calls}</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-5 mb-6">
                <div>
                  <p className="text-[10px] font-bold text-stone-400 dark:text-neutral-500 uppercase tracking-[0.15em] mb-1">{t.report_calls_total}</p>
                  <p className="text-3xl font-extrabold text-stone-900 dark:text-white">{callStats.total}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-stone-400 dark:text-neutral-500 uppercase tracking-[0.15em] mb-1">{t.report_talk_time}</p>
                  <p className="text-3xl font-extrabold text-stone-900 dark:text-white">{humanDuration(callStats.talkSecs, lang)}</p>
                </div>
              </div>
              <div className="space-y-2 mb-5">
                <StatLine label={t.report_calls_answered} value={callStats.answered} color="emerald" />
                <StatLine label={t.report_answer_rate} value={formatPct(callStats.answerRate)} color="emerald" isText />
              </div>
              <div className="space-y-2 pt-4 border-t border-stone-100 dark:border-neutral-800">
                {Array.from(callStats.perMember.entries())
                  .sort((a, b) => b[1].calls - a[1].calls)
                  .slice(0, 6)
                  .map(([memberId, row]) => {
                    const m = members.find(x => x.id === memberId)
                    const name = m ? `${m.first_name} ${m.last_name}` : t.report_you
                    return (
                      <div key={memberId} className="flex items-center justify-between py-1.5">
                        <span className="text-sm font-medium text-stone-500 dark:text-neutral-400 truncate">{name}</span>
                        <span className="text-sm font-bold text-stone-900 dark:text-white whitespace-nowrap">
                          {row.calls} · {humanDuration(row.secs, lang)}
                        </span>
                      </div>
                    )
                  })}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ─── Autre Loss Reasons Modal ─── */}
      {showAutreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAutreModal(false)} />
          <div className="relative w-full max-w-3xl max-h-[85vh] bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl border border-stone-200/20 dark:border-neutral-700 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-stone-100 dark:border-neutral-800">
              <div>
                <h3 className="text-lg font-extrabold text-stone-900 dark:text-white">{t.report_autre_detail_title}</h3>
                <p className="text-xs text-stone-500 dark:text-neutral-400 mt-1">{autreDetails.length} {autreDetails.length > 1 ? t.report_results : t.report_result}</p>
              </div>
              <button onClick={() => setShowAutreModal(false)} className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-neutral-800 transition-colors">
                <X className="h-5 w-5 text-stone-500" />
              </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-stone-100 dark:border-neutral-800 bg-stone-50/50 dark:bg-neutral-800/50">
              <Filter className="h-4 w-4 text-stone-400 shrink-0" />
              {/* Period */}
              <select
                value={autreFilterPeriod}
                onChange={e => setAutreFilterPeriod(Number(e.target.value))}
                className="text-xs font-bold bg-white dark:bg-neutral-800 border border-stone-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-stone-700 dark:text-neutral-200 outline-none focus:ring-2 focus:ring-stone-900/10"
              >
                {PERIODS.map(p => <option key={p.days} value={p.days}>{p.label}</option>)}
              </select>
              {/* Campaign */}
              <select
                value={autreFilterCampaign}
                onChange={e => setAutreFilterCampaign(e.target.value)}
                className="text-xs font-bold bg-white dark:bg-neutral-800 border border-stone-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-stone-700 dark:text-neutral-200 outline-none focus:ring-2 focus:ring-stone-900/10"
              >
                <option value="all">{t.report_all_campaigns}</option>
                {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {/* Closer */}
              <select
                value={autreFilterCloser}
                onChange={e => setAutreFilterCloser(e.target.value)}
                className="text-xs font-bold bg-white dark:bg-neutral-800 border border-stone-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-stone-700 dark:text-neutral-200 outline-none focus:ring-2 focus:ring-stone-900/10"
              >
                <option value="all">{t.report_all_closers}</option>
                {members.filter(m => ['Closer', 'Setter-Closer', 'Owner', 'Head of Sales'].includes(m.role)).map(m => (
                  <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                ))}
              </select>
              {/* Team */}
              {teams.length > 0 && (
                <select
                  value={autreFilterTeam}
                  onChange={e => setAutreFilterTeam(e.target.value)}
                  className="text-xs font-bold bg-white dark:bg-neutral-800 border border-stone-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-stone-700 dark:text-neutral-200 outline-none focus:ring-2 focus:ring-stone-900/10"
                >
                  <option value="all">{t.report_all_teams}</option>
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
                  <p className="text-sm font-medium">{t.report_no_autre_found}</p>
                  <p className="text-xs mt-1">{t.report_try_modify_filters}</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-stone-100 dark:border-neutral-800">
                      <th className="text-left text-[10px] uppercase tracking-widest font-bold text-stone-400 dark:text-neutral-500 px-6 py-3">{t.report_reason}</th>
                      <th className="text-left text-[10px] uppercase tracking-widest font-bold text-stone-400 dark:text-neutral-500 px-6 py-3">{t.report_prospect}</th>
                      <th className="text-left text-[10px] uppercase tracking-widest font-bold text-stone-400 dark:text-neutral-500 px-6 py-3">{t.report_closer}</th>
                      <th className="text-right text-[10px] uppercase tracking-widest font-bold text-stone-400 dark:text-neutral-500 px-6 py-3">{t.report_date}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {autreDetails.map(row => (
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

      {/* ─── Campaign Performance Table ─── */}
      <section className="glass-card rounded-2xl overflow-hidden mb-14">
        <div className="p-7 border-b border-stone-100 dark:border-neutral-800">
          <h3 className="text-lg font-extrabold text-stone-900 dark:text-white">{t.report_campaign_performance}</h3>
        </div>
        {campaignStats.length === 0 ? (
          <p className="text-sm text-stone-400 dark:text-neutral-500 text-center py-10">{t.report_no_campaign}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-stone-50 dark:bg-neutral-800/50">
                  <th className="px-7 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400 dark:text-neutral-500">{t.report_campaign}</th>
                  <th className="px-7 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400 dark:text-neutral-500">{t.report_status}</th>
                  <th className="px-7 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400 dark:text-neutral-500">{t.report_date}</th>
                  <th className="px-7 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400 dark:text-neutral-500">{t.report_views}</th>
                  <th className="px-7 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400 dark:text-neutral-500">{t.report_conv}</th>
                  <th className="px-7 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400 dark:text-neutral-500">{t.report_ca}</th>
                  <th className="px-7 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400 dark:text-neutral-500 text-right">{t.report_commission}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50 dark:divide-neutral-800">
                {campaignStats.map(c => (
                  <tr key={c.id} className="hover:bg-stone-50 dark:hover:bg-neutral-800/50 transition-colors">
                    <td className="px-7 py-5 font-bold text-stone-900 dark:text-white">{c.name}</td>
                    <td className="px-7 py-5">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${c.is_active ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-stone-100 dark:bg-neutral-800 text-stone-500 dark:text-neutral-400'}`}>
                        {c.is_active ? t.report_active : t.report_paused}
                      </span>
                    </td>
                    <td className="px-7 py-5 text-sm text-stone-500 dark:text-neutral-400">{formatDate(c.created_at)}</td>
                    <td className="px-7 py-5 text-sm text-stone-700 dark:text-neutral-200">{c.views.toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR')}</td>
                    <td className="px-7 py-5 text-sm font-bold text-stone-700 dark:text-neutral-200">{formatPct(c.conversionRate)}</td>
                    <td className="px-7 py-5 font-extrabold text-stone-900 dark:text-white">{formatCurrency(c.ca)}</td>
                    <td className="px-7 py-5 text-right font-medium text-emerald-700 dark:text-emerald-400">{formatCurrency(c.commission)}</td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr className="border-t-2 border-stone-200 dark:border-neutral-800 font-bold bg-stone-50 dark:bg-neutral-800/30">
                  <td className="px-7 py-5 text-stone-900 dark:text-white">{t.report_total}</td>
                  <td></td>
                  <td></td>
                  <td className="px-7 py-5 text-sm text-stone-700 dark:text-neutral-200">{campaignStats.reduce((s, c) => s + c.views, 0).toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR')}</td>
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
            <h3 className="text-lg font-extrabold text-stone-900 dark:text-white">{t.report_team_performance}</h3>
          </div>
          {members.length === 0 ? (
            <p className="text-sm text-stone-400 dark:text-neutral-500 text-center py-10">{t.report_no_team_member}</p>
          ) : (
            <div className="divide-y divide-stone-50 dark:divide-neutral-800">
              {members.map(m => {
                // Un setter ne « gagne » pas de deal : on compte ses ventes via
                // l'attribution setter, et le nombre de RDV qu'il a bookés.
                const isSetter = m.role === 'Setter'
                const memberWins = isSetter
                  ? wonLeads.filter(p => p.assigned_setter === m.id).length
                  : wonLeads.filter(p => p.assigned_to === m.id).length
                const setterBooked = ['Setter', 'Setter-Closer'].includes(m.role)
                  ? filteredAppointments.filter(a => a.prospect_id != null && setterByProspect[a.prospect_id] === m.id).length
                  : 0
                const memberCommission = wonLeads
                  .filter(p => p.assigned_to === m.id)
                  .reduce((s, p) => s + commissionFor(p), 0)
                return (
                  <div
                    key={m.id}
                    onClick={() => {
                      const role = m.role
                      if (role === 'Setter') {
                        navigate(`/business/setter-kpi?member=${m.id}`)
                      } else {
                        navigate(`/business/closer-kpi?member=${m.id}`)
                      }
                    }}
                    className="flex items-center justify-between px-7 py-4 hover:bg-stone-50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-stone-200 dark:bg-neutral-700 flex items-center justify-center text-sm font-bold text-stone-600 dark:text-neutral-300 overflow-hidden">
                        {m.avatar_url ? (
                          <img src={m.avatar_url} alt={`${m.first_name} ${m.last_name}`} className="w-full h-full object-cover" />
                        ) : (
                          <>{m.first_name[0]}{m.last_name?.[0] || ''}</>
                        )}
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
                      {setterBooked > 0 && (
                        <div className="hidden sm:flex flex-col items-end">
                          <span className="text-[10px] text-stone-400 dark:text-neutral-500">{t.report_setter_booked}</span>
                          <span className="font-bold text-stone-900 dark:text-white">{setterBooked}</span>
                        </div>
                      )}
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] text-stone-400 dark:text-neutral-500">{t.report_wins}</span>
                        <span className="font-bold text-stone-900 dark:text-white">{memberWins}</span>
                      </div>
                      {memberCommission > 0 && (
                        <div className="hidden md:flex flex-col items-end">
                          <span className="text-[10px] text-stone-400 dark:text-neutral-500">{t.report_commission}</span>
                          <span className="font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(memberCommission)}</span>
                        </div>
                      )}
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
            <h3 className="text-lg font-extrabold mb-7">{t.report_financial_summary}</h3>
            <div className="space-y-5 flex-grow">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] opacity-70 mb-1">{t.report_closing_rate}</p>
                <p className="text-4xl font-black">{formatPct(closingRate)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] opacity-70 mb-1">{t.report_avg_deal}</p>
                <p className="text-2xl font-bold">{formatCurrency(avgDeal)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] opacity-70 mb-1">{t.report_show_up_rate}</p>
                <p className="text-2xl font-bold">{formatPct(showUpRate)}</p>
              </div>
              {totalPerBooking > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] opacity-70 mb-1">{t.report_per_booking_total}</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalPerBooking)}</p>
                </div>
              )}
              {revenueMix.mrr > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] opacity-70 mb-1">{t.report_mrr}</p>
                  <p className="text-2xl font-bold">{formatCurrency(revenueMix.mrr)}</p>
                </div>
              )}
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
              <h4 className="font-extrabold text-lg text-stone-900 dark:text-white">{t.report_appointments}</h4>
              <p className="text-sm text-stone-400 dark:text-neutral-500">{totalAppts} {t.report_total_short} · {doneAppts} {doneAppts !== 1 ? t.report_done_plural : t.report_done}</p>
            </div>
          </div>
          <div className="space-y-2">
            <StatLine label={t.report_total_rdv} value={totalAppts} color="stone" />
            <StatLine label={t.report_completed} value={doneAppts} color="emerald" />
            <StatLine label={t.report_pending} value={filteredAppointments.filter(a => a.status === 'pending').length} color="amber" />
            <StatLine label={t.report_confirmed} value={filteredAppointments.filter(a => a.status === 'confirmed').length} color="stone" />
            <StatLine label={t.report_cancelled} value={cancelledAppts} color="red" />
            <StatLine label={t.report_show_up_rate_label} value={formatPct(showUpRate)} color="emerald" isText />
          </div>
        </div>

        {/* Pipeline Détaillé */}
        <div className="glass-card p-7 rounded-2xl border-t-4 border-stone-900 dark:border-neutral-400">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-11 h-11 bg-stone-900 dark:bg-neutral-700 rounded-full flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <h4 className="font-extrabold text-lg text-stone-900 dark:text-white">{t.report_detailed_pipeline}</h4>
              <p className="text-sm text-stone-400 dark:text-neutral-500">{t.report_total_value} {formatCurrency(totalPipeline)}</p>
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
              <p className="text-[10px] text-stone-400 dark:text-neutral-500 font-bold uppercase tracking-[0.15em]">{t.report_prospects}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-stone-900 dark:text-white">{wonLeads.length}</p>
              <p className="text-[10px] text-stone-400 dark:text-neutral-500 font-bold uppercase tracking-[0.15em]">{t.report_won}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Hidden PDF content ─── */}
      <div style={{ position: 'fixed', top: 0, left: 0, width: '900px', zIndex: -1, opacity: 0, pointerEvents: 'none' }}>
        <div ref={pdfRef} style={{ fontFamily: 'Inter, Helvetica, Arial, sans-serif', background: '#ffffff', padding: '32px', width: '900px', color: '#1e293b' }}>
          {/* PDF Header */}
          <div style={{ background: 'linear-gradient(135deg, #ffb95f, #006c49)', borderRadius: '16px', padding: '24px 32px', marginBottom: '24px', color: '#fff' }}>
            <div style={{ fontSize: '22px', fontWeight: 'bold' }}>{t.report_pdf_title}</div>
            <div style={{ fontSize: '13px', opacity: 0.85, marginTop: '4px' }}>{t.report_pdf_period} {periodLabel} · {t.report_pdf_generated_on} {new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          </div>

          {/* PDF KPIs */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <PdfKpi label={t.report_ca_generated} value={formatCurrency(totalCA)} />
            <PdfKpi label={t.report_sales} value={String(wonLeads.length)} />
            <PdfKpi label={t.report_pdf_closing} value={formatPct(closingRate)} />
            <PdfKpi label={t.report_commission} value={formatCurrency(totalCommission)} />
            <PdfKpi label={t.report_total_leads} value={String(totalLeads)} />
            <PdfKpi label={t.report_show_up} value={formatPct(showUpRate)} />
            <PdfKpi label={t.report_no_show} value={formatPct(noshowRate)} />
            <PdfKpi label={t.report_avg_deal} value={formatCurrency(avgDeal)} />
          </div>

          {/* PDF Objectifs */}
          {objectiveProgress.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#1b1c1b' }}>{t.report_pdf_objectives}</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <tbody>
                  {objectiveProgress.map(o => {
                    const fmt = (v: number) =>
                      o.format === 'currency' ? formatCurrency(v) : o.format === 'percent' ? formatPct(v) : String(Math.round(v))
                    return (
                      <tr key={o.id} style={{ borderBottom: '1px solid #efedec' }}>
                        <td style={{ padding: '5px 4px', fontWeight: 500 }}>{o.label} <span style={{ color: '#747878' }}>({o.periodLabel})</span></td>
                        <td style={{ padding: '5px 4px', textAlign: 'right' }}>{fmt(o.current)} / {fmt(o.target)}</td>
                        <td style={{ padding: '5px 4px', textAlign: 'right', fontWeight: 'bold', width: '60px' }}>{Math.round(o.pct)}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* PDF Nature du revenu + encaissement */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#1b1c1b' }}>{t.report_pdf_revenue_mix}</div>
            <div style={{ display: 'flex', gap: '16px', fontSize: '12px', flexWrap: 'wrap' }}>
              <span>{t.report_one_shot} : <b>{formatCurrency(revenueMix.oneShot)}</b></span>
              <span>{t.report_mrr} : <b>{formatCurrency(revenueMix.mrr)}</b></span>
              <span>{t.report_active_subs} : <b>{revenueMix.activeSubs}</b></span>
              {cashStats.count > 0 && (
                <>
                  <span>{t.report_collected} : <b>{formatCurrency(cashStats.collected)}</b></span>
                  <span>{t.report_outstanding} : <b>{formatCurrency(cashStats.outstanding)}</b></span>
                </>
              )}
            </div>
          </div>

          {/* PDF Sources */}
          {sourceStats.some(x => x.source !== t.report_no_source) && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#1b1c1b' }}>{t.report_pdf_sources}</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e4e2e1' }}>
                    {[t.report_source, t.report_leads_label, t.report_won, t.report_conv, t.report_ca].map((h, i) => (
                      <th key={i} style={{ textAlign: i === 0 ? 'left' : i === 4 ? 'right' : 'center', padding: '5px 4px', fontWeight: 'bold', color: '#747878' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sourceStats.map(s => (
                    <tr key={s.source} style={{ borderBottom: '1px solid #efedec' }}>
                      <td style={{ padding: '5px 4px', fontWeight: 500 }}>{s.source}</td>
                      <td style={{ padding: '5px 4px', textAlign: 'center' }}>{s.leads}</td>
                      <td style={{ padding: '5px 4px', textAlign: 'center' }}>{s.won}</td>
                      <td style={{ padding: '5px 4px', textAlign: 'center' }}>{formatPct(s.closingRate)}</td>
                      <td style={{ padding: '5px 4px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(s.ca)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* PDF Offres */}
          {offerStats.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#1b1c1b' }}>{t.report_pdf_offers}</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <tbody>
                  {offerStats.map(o => (
                    <tr key={o.offer} style={{ borderBottom: '1px solid #efedec' }}>
                      <td style={{ padding: '5px 4px', fontWeight: 500 }}>{o.offer}</td>
                      <td style={{ padding: '5px 4px', textAlign: 'center' }}>{o.count}</td>
                      <td style={{ padding: '5px 4px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(o.ca)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* PDF Motifs de perte / disqualification */}
          {(lossReasonData.length > 0 || unqualifiedReasonData.length > 0) && (
            <div style={{ marginBottom: '20px', display: 'flex', gap: '24px' }}>
              {lossReasonData.length > 0 && (
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#1b1c1b' }}>{t.report_pdf_loss_reasons}</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <tbody>
                      {lossReasonData.map(d => (
                        <tr key={d.name} style={{ borderBottom: '1px solid #efedec' }}>
                          <td style={{ padding: '4px' }}>{d.name}</td>
                          <td style={{ padding: '4px', textAlign: 'right', fontWeight: 'bold' }}>{d.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {unqualifiedReasonData.length > 0 && (
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#1b1c1b' }}>{t.report_pdf_unqualified_reasons}</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <tbody>
                      {unqualifiedReasonData.map(d => (
                        <tr key={d.key} style={{ borderBottom: '1px solid #efedec' }}>
                          <td style={{ padding: '4px' }}>{d.name}</td>
                          <td style={{ padding: '4px', textAlign: 'right', fontWeight: 'bold' }}>{d.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* PDF Formulaires + tracking */}
          {(formStats.some(f => f.responses > 0) || trackingStats.some(l => l.clicks > 0)) && (
            <div style={{ marginBottom: '20px', display: 'flex', gap: '24px' }}>
              {formStats.some(f => f.responses > 0) && (
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#1b1c1b' }}>{t.report_pdf_forms}</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <tbody>
                      {formStats.filter(f => f.responses > 0).map(f => (
                        <tr key={f.id} style={{ borderBottom: '1px solid #efedec' }}>
                          <td style={{ padding: '4px' }}>{f.name}</td>
                          <td style={{ padding: '4px', textAlign: 'right' }}>{f.responses} → {f.leads}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {trackingStats.some(l => l.clicks > 0) && (
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#1b1c1b' }}>{t.report_pdf_tracking}</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <tbody>
                      {trackingStats.filter(l => l.clicks > 0).map(l => (
                        <tr key={l.id} style={{ borderBottom: '1px solid #efedec' }}>
                          <td style={{ padding: '4px' }}>{l.name}</td>
                          <td style={{ padding: '4px', textAlign: 'right' }}>{l.clicks} · {l.visitors}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* PDF Vitesse & relances */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#1b1c1b' }}>{t.report_pdf_speed}</div>
            <div style={{ display: 'flex', gap: '16px', fontSize: '12px', flexWrap: 'wrap' }}>
              <span>{t.report_speed_to_lead} : <b>{speedStats.contactedCount > 0 ? humanDuration(speedStats.avgDelay, lang) : '—'}</b></span>
              <span>{t.report_in_relance} : <b>{speedStats.inRelance}</b></span>
              <span>{t.report_relance_reply_rate} : <b>{formatPct(speedStats.replyRate)}</b></span>
              <span>{t.report_calls_total} : <b>{callStats.total}</b></span>
              <span>{t.report_answer_rate} : <b>{formatPct(callStats.answerRate)}</b></span>
            </div>
            {channelStats.any && (
              <div style={{ display: 'flex', gap: '16px', fontSize: '12px', flexWrap: 'wrap', marginTop: '6px' }}>
                <span>{t.report_channel_rate} :</span>
                {channelStats.rows.map(row => {
                  const meta = CONTACT_CHANNELS.find(c => c.key === row.key)!
                  return (
                    <span key={row.key}>{lang === 'en' ? meta.en : meta.fr} : <b>{formatPct(row.rate)}</b> ({row.replied}/{row.sent})</span>
                  )
                })}
              </div>
            )}
          </div>

          {/* PDF Pipeline */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#1b1c1b' }}>{t.report_pdf_pipeline_distribution}</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e4e2e1' }}>
                  {[t.report_stage_new_lead, t.report_stage_contacted, t.report_stage_qualified, t.report_stage_followup, t.report_stage_won, t.report_stage_lost, t.report_stage_no_show].map(s => (
                    <th key={s} style={{ textAlign: 'center', padding: '6px', fontWeight: 'bold', color: '#747878' }}>{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {['prospect', 'contacted', 'qualified', 'followup', 'won', 'lost', 'noshow'].map(s => (
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
            <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#1b1c1b' }}>{t.report_pdf_campaign_performance}</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e4e2e1' }}>
                  {[t.report_campaign, t.report_status, t.report_views, t.report_pdf_registered, t.report_conv, t.report_won, t.report_ca, t.report_commission].map((h, idx) => (
                    <th key={idx} style={{ textAlign: idx === 0 ? 'left' : 'center', padding: '5px 4px', fontWeight: 'bold', color: '#747878' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaignStats.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #efedec' }}>
                    <td style={{ padding: '5px 4px', fontWeight: 500 }}>{c.name}</td>
                    <td style={{ padding: '5px 4px', textAlign: 'center' }}>{c.is_active ? t.report_active : t.report_pdf_inactive}</td>
                    <td style={{ padding: '5px 4px', textAlign: 'center' }}>{c.views}</td>
                    <td style={{ padding: '5px 4px', textAlign: 'center' }}>{c.inscriptions}</td>
                    <td style={{ padding: '5px 4px', textAlign: 'center' }}>{formatPct(c.conversionRate)}</td>
                    <td style={{ padding: '5px 4px', textAlign: 'center' }}>{c.wonCount}</td>
                    <td style={{ padding: '5px 4px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(c.ca)}</td>
                    <td style={{ padding: '5px 4px', textAlign: 'right' }}>{formatCurrency(c.commission)}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid #006c49' }}>
                  <td style={{ padding: '5px 4px', fontWeight: 'bold' }}>{t.report_total}</td>
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
              <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#1b1c1b' }}>{t.report_pdf_team} ({members.length} {t.report_pdf_members})</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e4e2e1' }}>
                    {[t.report_pdf_member_col, t.report_pdf_role, t.report_pdf_email, t.report_pdf_since].map((h, idx) => (
                      <th key={idx} style={{ textAlign: idx === 0 ? 'left' : 'center', padding: '5px 4px', fontWeight: 'bold', color: '#747878' }}>{h}</th>
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
            <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#1b1c1b' }}>{t.report_pdf_appointments}</div>
            <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
              <span>{t.report_pdf_total} <b>{totalAppts}</b></span>
              <span>{t.report_pdf_done} <b>{doneAppts}</b></span>
              <span>{t.report_pdf_cancelled} <b>{cancelledAppts}</b></span>
              <span>{t.report_pdf_show_up} <b>{formatPct(showUpRate)}</b></span>
            </div>
          </div>

          {/* PDF Footer */}
          <div style={{ marginTop: '32px', paddingTop: '16px', borderTop: '1px solid #e4e2e1', fontSize: '10px', color: '#747878', textAlign: 'center' }}>
            {t.report_pdf_footer} · {new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR')}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ───

/** Pastille de variation vs période précédente. `inverted` : une hausse est mauvaise (no-show, perte). */
function Delta({ current, previous, label, inverted }: { current: number; previous: number | undefined; label: string; inverted?: boolean }) {
  if (previous === undefined) return null
  const pct = deltaPct(current, previous)
  if (pct === null) {
    return (
      <span className="text-[10px] font-bold text-stone-400 dark:text-neutral-500 bg-stone-100 dark:bg-neutral-800 px-2 py-1 rounded-full" title={label}>
        {current > 0 ? '↑' : '—'}
      </span>
    )
  }
  const rounded = Math.round(pct)
  const flat = rounded === 0
  const good = inverted ? rounded < 0 : rounded > 0
  const Icon = flat ? Minus : rounded > 0 ? TrendingUp : TrendingDown
  return (
    <span
      title={label}
      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${
        flat
          ? 'text-stone-500 dark:text-neutral-400 bg-stone-100 dark:bg-neutral-800'
          : good
            ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30'
            : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30'
      }`}
    >
      <Icon className="h-3 w-3" />
      {rounded > 0 ? '+' : ''}{rounded}%
    </span>
  )
}

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
