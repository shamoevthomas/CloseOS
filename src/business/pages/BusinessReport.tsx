import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  FileText, Download, Loader2, CalendarDays, Users, Megaphone,
  TrendingUp, DollarSign, UserCheck, UserX, Target, Activity,
  ShoppingCart, Eye, Clock,
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

interface Prospect {
  id: number
  stage: string
  value: number | null
  created_at: string
  campaign_id: string | null
  payment_type: string | null
  installments: number | null
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

const COLORS = ['#d97706', '#2563eb', '#7c3aed', '#059669', '#e11d48', '#0891b2', '#ea580c', '#4f46e5']

const PERIODS = [
  { label: '7 jours', days: 7 },
  { label: '14 jours', days: 14 },
  { label: '30 jours', days: 30 },
  { label: '90 jours', days: 90 },
  { label: '6 mois', days: 180 },
  { label: '1 an', days: 365 },
  { label: 'Tout', days: 0 },
]

const ROLE_COLORS: Record<string, string> = {
  Closer: 'bg-blue-100 text-blue-700',
  Setter: 'bg-purple-100 text-purple-700',
  'Setter-Closer': 'bg-indigo-100 text-indigo-700',
  Manager: 'bg-amber-100 text-amber-700',
  Admin: 'bg-red-100 text-red-700',
}

// ─── Component ───

export function BusinessReport() {
  const { user } = useBusinessAuth()
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [periodDays, setPeriodDays] = useState(7)
  const pdfRef = useRef<HTMLDivElement>(null)

  const [members, setMembers] = useState<TeamMember[]>([])
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])

  const fetchAll = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const [membersRes, prospectsRes, campaignsRes, appointmentsRes] = await Promise.all([
        supabase.from('business_team_members').select('id, first_name, last_name, email, role, joined_at').eq('business_owner_id', user.id),
        supabase.from('business_prospects').select('id, stage, value, created_at, campaign_id, payment_type, installments').eq('user_id', user.id),
        supabase.from('business_campaigns').select('id, name, views, is_active, created_at').eq('user_id', user.id),
        supabase.from('business_appointments').select('id, status, date, campaign_id, prospect_id, created_at').eq('user_id', user.id),
      ])
      setMembers(membersRes.data || [])
      setProspects(prospectsRes.data || [])
      setCampaigns(campaignsRes.data || [])
      setAppointments(appointmentsRes.data || [])
    } catch (err) {
      console.error('Error fetching report data:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

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
  const avgDeal = wonLeads.length > 0 ? totalCA / wonLeads.length : 0
  const totalDecided = wonLeads.length + lostLeads.length + noshowLeads.length
  const closingRate = totalDecided > 0 ? (wonLeads.length / totalDecided) * 100 : 0
  const noshowRate = totalLeads > 0 ? (noshowLeads.length / totalLeads) * 100 : 0
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
      { id: 'prospect', name: 'Prospect', color: '#3b82f6' },
      { id: 'qualified', name: 'Qualifié', color: '#7c3aed' },
      { id: 'followup', name: 'Follow Up', color: '#f59e0b' },
      { id: 'won', name: 'Gagné', color: '#059669' },
      { id: 'lost', name: 'Perdu', color: '#ef4444' },
      { id: 'noshow', name: 'No Show', color: '#64748b' },
    ]
    return stages.map(s => ({
      name: s.name,
      value: filteredProspects.filter(p => p.stage === s.id).length,
      color: s.color,
    })).filter(s => s.value > 0)
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

  // ─── PDF Export ───
  const handleExportPDF = async () => {
    if (!pdfRef.current) return
    setExporting(true)
    try {
      // Wait for render
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

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 text-amber-600 animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      {/* ─── Header with period selector + export ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
            <FileText className="h-5 w-5 text-amber-700" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Rapport</h2>
            <p className="text-xs text-slate-500">Période : {periodLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex rounded-lg bg-amber-50 p-0.5 border border-amber-200">
            {PERIODS.map(p => (
              <button
                key={p.days}
                onClick={() => setPeriodDays(p.days)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${periodDays === p.days ? 'bg-amber-600 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={handleExportPDF}
            disabled={exporting}
            className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Exporter PDF
          </button>
        </div>
      </div>

      {/* ─── Global KPI cards ─── */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={DollarSign} label="CA Généré" value={formatCurrency(totalCA)} color="emerald" />
        <KpiCard icon={ShoppingCart} label="Ventes" value={String(wonLeads.length)} sub={`Panier moyen : ${formatCurrency(avgDeal)}`} color="emerald" />
        <KpiCard icon={Target} label="Taux de Closing" value={formatPct(closingRate)} sub={`${wonLeads.length} gagné / ${totalDecided} décidé`} color="amber" />
        <KpiCard icon={Activity} label="Commission estimée" value={formatCurrency(totalCommission)} sub={`${COMMISSION_RATE}% sur ${formatCurrency(totalCA)}`} color="purple" />
      </div>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Users} label="Total Leads" value={String(totalLeads)} sub={`${activeLeads.length} actifs`} color="blue" />
        <KpiCard icon={UserCheck} label="Show Up" value={formatPct(showUpRate)} sub={`${doneAppts} / ${totalAppts} RDV`} color="cyan" />
        <KpiCard icon={UserX} label="No Show" value={formatPct(noshowRate)} sub={`${noshowLeads.length} leads`} color="rose" />
        <KpiCard icon={TrendingUp} label="Taux de perte" value={formatPct(lostRate)} sub={`${lostLeads.length} perdu${lostLeads.length > 1 ? 's' : ''}`} color="slate" />
      </div>

      {/* ─── Charts row ─── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pie: stage distribution */}
        <div className="bg-white rounded-xl border border-[#493627]/10 p-5">
          <h3 className="text-sm font-semibold text-[#493627] mb-4">Répartition des leads par étape</h3>
          <div className="h-64">
            {stageData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-slate-400">Aucune donnée</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stageData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}>
                    {stageData.map((s, i) => <Cell key={i} fill={s.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5d5c3', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Bar: CA per campaign */}
        <div className="bg-white rounded-xl border border-[#493627]/10 p-5">
          <h3 className="text-sm font-semibold text-[#493627] mb-4">CA par campagne</h3>
          <div className="h-64">
            {caBarData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-slate-400">Aucune donnée</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={caBarData} margin={{ bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe4" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#493627' }} angle={-15} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11, fill: '#493627' }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number, _: any, e: any) => [formatCurrency(v), e.payload.fullName]} contentStyle={{ borderRadius: 12, border: '1px solid #e5d5c3', fontSize: 12 }} />
                  <Bar dataKey="ca" fill="#d97706" radius={[6, 6, 0, 0]} barSize={36} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ─── Campaign Performance Table ─── */}
      <div className="bg-white rounded-xl border border-[#493627]/10 p-5">
        <h3 className="text-sm font-semibold text-[#493627] mb-4 flex items-center gap-2">
          <Megaphone className="h-4 w-4" /> Performance des Campagnes
        </h3>
        {campaignStats.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Aucune campagne</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-amber-100 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <th className="text-left py-2 pr-3">Campagne</th>
                  <th className="text-center py-2 px-2">Statut</th>
                  <th className="text-center py-2 px-2">Créée le</th>
                  <th className="text-center py-2 px-2"><Eye className="h-3 w-3 inline" /> Vues</th>
                  <th className="text-center py-2 px-2">Inscrits</th>
                  <th className="text-center py-2 px-2">Conv.</th>
                  <th className="text-center py-2 px-2">Gagnés</th>
                  <th className="text-right py-2 px-2">CA</th>
                  <th className="text-right py-2 pl-2">Commission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-50">
                {campaignStats.map(c => (
                  <tr key={c.id} className="hover:bg-amber-50/50 transition-colors">
                    <td className="py-2.5 pr-3 font-medium text-slate-900 max-w-[200px] truncate">{c.name}</td>
                    <td className="py-2.5 px-2 text-center">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-center text-slate-500 text-xs">{formatDate(c.created_at)}</td>
                    <td className="py-2.5 px-2 text-center font-medium text-blue-600">{c.views}</td>
                    <td className="py-2.5 px-2 text-center font-medium text-purple-600">{c.inscriptions}</td>
                    <td className="py-2.5 px-2 text-center font-medium text-amber-600">{formatPct(c.conversionRate)}</td>
                    <td className="py-2.5 px-2 text-center font-medium text-emerald-600">{c.wonCount}</td>
                    <td className="py-2.5 px-2 text-right font-bold text-slate-900">{formatCurrency(c.ca)}</td>
                    <td className="py-2.5 pl-2 text-right font-medium text-purple-600">{formatCurrency(c.commission)}</td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr className="border-t-2 border-amber-200 font-bold">
                  <td className="py-2.5 pr-3 text-slate-900">Total</td>
                  <td></td>
                  <td></td>
                  <td className="py-2.5 px-2 text-center text-blue-700">{campaignStats.reduce((s, c) => s + c.views, 0)}</td>
                  <td className="py-2.5 px-2 text-center text-purple-700">{campaignStats.reduce((s, c) => s + c.inscriptions, 0)}</td>
                  <td></td>
                  <td className="py-2.5 px-2 text-center text-emerald-700">{campaignStats.reduce((s, c) => s + c.wonCount, 0)}</td>
                  <td className="py-2.5 px-2 text-right text-slate-900">{formatCurrency(totalCA)}</td>
                  <td className="py-2.5 pl-2 text-right text-purple-700">{formatCurrency(totalCommission)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Team Performance Table ─── */}
      <div className="bg-white rounded-xl border border-[#493627]/10 p-5">
        <h3 className="text-sm font-semibold text-[#493627] mb-4 flex items-center gap-2">
          <Users className="h-4 w-4" /> Performance de l'Équipe
        </h3>
        {members.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Aucun membre dans l'équipe</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-amber-100 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <th className="text-left py-2 pr-3">Membre</th>
                  <th className="text-center py-2 px-2">Rôle</th>
                  <th className="text-center py-2 px-2">Depuis</th>
                  <th className="text-center py-2 px-2">Ancienneté</th>
                  <th className="text-center py-2 px-2">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-50">
                {members.map(m => {
                  const joinDate = new Date(m.joined_at)
                  const now = new Date()
                  const diffDays = Math.floor((now.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24))
                  const anciennete = diffDays < 30 ? `${diffDays}j` : diffDays < 365 ? `${Math.floor(diffDays / 30)} mois` : `${(diffDays / 365).toFixed(1)} an${diffDays >= 730 ? 's' : ''}`
                  return (
                    <tr key={m.id} className="hover:bg-amber-50/50 transition-colors">
                      <td className="py-2.5 pr-3">
                        <p className="font-medium text-slate-900">{m.first_name} {m.last_name}</p>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${ROLE_COLORS[m.role] || 'bg-slate-100 text-slate-600'}`}>
                          {m.role}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-center text-xs text-slate-500">{formatDate(m.joined_at)}</td>
                      <td className="py-2.5 px-2 text-center text-xs text-slate-600 font-medium">{anciennete}</td>
                      <td className="py-2.5 px-2 text-center text-xs text-slate-400">{m.email}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Detailed Breakdown Cards ─── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="bg-white rounded-xl border border-[#493627]/10 p-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Pipeline Détaillé</h4>
          <div className="space-y-2">
            <StatLine label="Prospect" value={filteredProspects.filter(p => p.stage === 'prospect').length} color="blue" />
            <StatLine label="Qualifié" value={qualifiedLeads.length} color="purple" />
            <StatLine label="Follow Up" value={followupLeads.length} color="amber" />
            <StatLine label="Gagné" value={wonLeads.length} color="emerald" />
            <StatLine label="Perdu" value={lostLeads.length} color="red" />
            <StatLine label="No Show" value={noshowLeads.length} color="slate" />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[#493627]/10 p-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Rendez-vous</h4>
          <div className="space-y-2">
            <StatLine label="Total RDV" value={totalAppts} color="blue" />
            <StatLine label="Terminés" value={doneAppts} color="emerald" />
            <StatLine label="En attente" value={filteredAppointments.filter(a => a.status === 'pending').length} color="amber" />
            <StatLine label="Confirmés" value={filteredAppointments.filter(a => a.status === 'confirmed').length} color="blue" />
            <StatLine label="Annulés" value={cancelledAppts} color="red" />
            <StatLine label="Taux Show Up" value={formatPct(showUpRate)} color="emerald" isText />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[#493627]/10 p-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Résumé Financier</h4>
          <div className="space-y-2">
            <StatLine label="CA Total" value={formatCurrency(totalCA)} color="emerald" isText />
            <StatLine label="Panier Moyen" value={formatCurrency(avgDeal)} color="blue" isText />
            <StatLine label="Commission ({COMMISSION_RATE}%)" value={formatCurrency(totalCommission)} color="purple" isText />
            <StatLine label="Ventes Comptant" value={wonLeads.filter(p => !p.payment_type || p.payment_type === 'cash' || p.payment_type === 'comptant' || p.payment_type === 'once').length} color="amber" />
            <StatLine label="Ventes en X fois" value={wonLeads.filter(p => p.payment_type === 'installments').length} color="cyan" />
            <StatLine label="Taux Closing" value={formatPct(closingRate)} color="emerald" isText />
          </div>
        </div>
      </div>

      {/* ─── Hidden PDF content ─── */}
      <div style={{ position: 'fixed', top: 0, left: 0, width: '900px', zIndex: -1, opacity: 0, pointerEvents: 'none' }}>
        <div ref={pdfRef} style={{ fontFamily: 'Inter, Helvetica, Arial, sans-serif', background: '#ffffff', padding: '32px', width: '900px', color: '#1e293b' }}>
          {/* PDF Header */}
          <div style={{ background: 'linear-gradient(135deg, #d97706, #b45309)', borderRadius: '16px', padding: '24px 32px', marginBottom: '24px', color: '#fff' }}>
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
            <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#493627' }}>Répartition Pipeline</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5d5c3' }}>
                  {['Prospect', 'Qualifié', 'Follow Up', 'Gagné', 'Perdu', 'No Show'].map(s => (
                    <th key={s} style={{ textAlign: 'center', padding: '6px', fontWeight: 'bold', color: '#64748b' }}>{s}</th>
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
            <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#493627' }}>Performance Campagnes</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5d5c3' }}>
                  {['Campagne', 'Statut', 'Vues', 'Inscrits', 'Conv.', 'Gagnés', 'CA', 'Commission'].map(h => (
                    <th key={h} style={{ textAlign: h === 'Campagne' ? 'left' : 'center', padding: '5px 4px', fontWeight: 'bold', color: '#64748b' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaignStats.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f1ece6' }}>
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
                <tr style={{ borderTop: '2px solid #d97706' }}>
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
              <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#493627' }}>Équipe ({members.length} membres)</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5d5c3' }}>
                    {['Membre', 'Rôle', 'Email', 'Depuis'].map(h => (
                      <th key={h} style={{ textAlign: h === 'Membre' ? 'left' : 'center', padding: '5px 4px', fontWeight: 'bold', color: '#64748b' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {members.map(m => (
                    <tr key={m.id} style={{ borderBottom: '1px solid #f1ece6' }}>
                      <td style={{ padding: '5px 4px', fontWeight: 500 }}>{m.first_name} {m.last_name}</td>
                      <td style={{ padding: '5px 4px', textAlign: 'center' }}>{m.role}</td>
                      <td style={{ padding: '5px 4px', textAlign: 'center', color: '#64748b' }}>{m.email}</td>
                      <td style={{ padding: '5px 4px', textAlign: 'center' }}>{formatDate(m.joined_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* PDF Appointments */}
          <div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#493627' }}>Rendez-vous</div>
            <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
              <span>Total : <b>{totalAppts}</b></span>
              <span>Terminés : <b>{doneAppts}</b></span>
              <span>Annulés : <b>{cancelledAppts}</b></span>
              <span>Show Up : <b>{formatPct(showUpRate)}</b></span>
            </div>
          </div>

          {/* PDF Footer */}
          <div style={{ marginTop: '32px', paddingTop: '16px', borderTop: '1px solid #e5d5c3', fontSize: '10px', color: '#94a3b8', textAlign: 'center' }}>
            CloseOS Business · Rapport généré automatiquement · {new Date().toLocaleDateString('fr-FR')}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ───

function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: string; sub?: string; color: string
}) {
  const colorMap: Record<string, { bg: string; icon: string }> = {
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600' },
    blue: { bg: 'bg-blue-50', icon: 'text-blue-600' },
    purple: { bg: 'bg-purple-50', icon: 'text-purple-600' },
    amber: { bg: 'bg-amber-50', icon: 'text-amber-600' },
    cyan: { bg: 'bg-cyan-50', icon: 'text-cyan-600' },
    rose: { bg: 'bg-rose-50', icon: 'text-rose-600' },
    slate: { bg: 'bg-slate-50', icon: 'text-slate-600' },
  }
  const c = colorMap[color] || colorMap.slate
  return (
    <div className="bg-white rounded-xl border border-[#493627]/10 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2.5 mb-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${c.bg}`}>
          <Icon className={`h-4 w-4 ${c.icon}`} />
        </div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
      </div>
      <p className="text-xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function StatLine({ label, value, color, isText }: { label: string; value: number | string; color: string; isText?: boolean }) {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-600', purple: 'text-purple-600', amber: 'text-amber-600',
    emerald: 'text-emerald-600', red: 'text-red-600', slate: 'text-slate-500', cyan: 'text-cyan-600',
  }
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-sm font-bold ${colorMap[color] || 'text-slate-900'}`}>
        {isText ? value : value}
      </span>
    </div>
  )
}

function PdfKpi({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: '1 1 0', minWidth: '90px', background: '#fef3c7', borderRadius: '10px', padding: '10px 14px', textAlign: 'center' }}>
      <div style={{ fontSize: '10px', color: '#92400e', fontWeight: 600, marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b' }}>{value}</div>
    </div>
  )
}
