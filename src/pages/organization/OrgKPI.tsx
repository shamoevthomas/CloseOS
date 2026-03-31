import { useState, useEffect, useMemo } from 'react'
import { useOrganization } from '../../contexts/OrganizationContext'
import { supabase } from '../../lib/supabase'
import {
  Loader2, TrendingUp, Target, DollarSign, Users, Phone, Calendar, BarChart3,
} from 'lucide-react'
import { cn } from '../../lib/utils'

export function OrgKPI() {
  const { organization, prospects, prospectsLoading } = useOrganization()
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('month')
  const [appointments, setAppointments] = useState<any[]>([])
  const [formulaBillingTypes, setFormulaBillingTypes] = useState<Record<string, string>>({})

  // Fetch appointments
  useEffect(() => {
    if (!organization?.owner_id) return
    supabase
      .from('business_appointments')
      .select('id, date, status, assigned_to')
      .eq('user_id', organization.owner_id)
      .then(({ data }) => setAppointments(data || []))
  }, [organization?.owner_id])

  // Fetch formula billing types for revenue calculation
  useEffect(() => {
    if (!organization?.owner_id) return
    supabase
      .from('business_formulas')
      .select('id, billing_type')
      .eq('user_id', organization.owner_id)
      .then(({ data }) => {
        const map: Record<string, string> = {}
        for (const f of data || []) map[f.id] = f.billing_type || 'one_time'
        setFormulaBillingTypes(map)
      })
  }, [organization?.owner_id])

  // Filter my prospects
  const myProspects = useMemo(() => {
    if (!organization) return []
    return prospects.filter(p => {
      const role = organization.role
      if (role === 'Setter') return p.assigned_setter === organization.member_id
      if (role === 'Setter-Closer') return p.assigned_to === organization.member_id || p.assigned_setter === organization.member_id
      return p.assigned_to === organization.member_id
    })
  }, [prospects, organization])

  // Period filter
  const filteredProspects = useMemo(() => {
    if (period === 'all') return myProspects
    const now = new Date()
    const cutoff = new Date()
    if (period === 'week') cutoff.setDate(now.getDate() - 7)
    else cutoff.setMonth(now.getMonth() - 1)
    return myProspects.filter(p => p.created_at && new Date(p.created_at) >= cutoff)
  }, [myProspects, period])

  const myAppointments = useMemo(() => {
    if (!organization) return []
    return appointments.filter(a => a.assigned_to === organization.member_id)
  }, [appointments, organization])

  const filteredAppointments = useMemo(() => {
    if (period === 'all') return myAppointments
    const now = new Date()
    const cutoff = new Date()
    if (period === 'week') cutoff.setDate(now.getDate() - 7)
    else cutoff.setMonth(now.getMonth() - 1)
    return myAppointments.filter(a => new Date(a.date) >= cutoff)
  }, [myAppointments, period])

  // KPI calculations
  const totalProspects = filteredProspects.length
  const wonProspects = filteredProspects.filter(p => p.stage === 'won')
  const lostProspects = filteredProspects.filter(p => p.stage === 'lost')
  const closedProspects = [...wonProspects, ...lostProspects]

  const cashGenerated = wonProspects.reduce((sum, p) => {
    const val = p.value || 0
    const bt = p.formula_id ? formulaBillingTypes[p.formula_id] : null
    // For subscriptions, multiply by 12 for annual value
    if (bt === 'subscription') return sum + val * 12
    return sum + val
  }, 0)

  const conversionRate = closedProspects.length > 0
    ? ((wonProspects.length / closedProspects.length) * 100).toFixed(1)
    : '0'

  const totalAppointments = filteredAppointments.length
  const doneAppointments = filteredAppointments.filter(a => a.status === 'done').length
  const noShowAppointments = filteredAppointments.filter(a => a.status === 'cancelled').length
  const showRate = totalAppointments > 0
    ? (((totalAppointments - noShowAppointments) / totalAppointments) * 100).toFixed(1)
    : '0'

  if (prospectsLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 text-slate-400 animate-spin" /></div>
  }

  const KPICard = ({ icon: Icon, label, value, sub, color }: { icon: any, label: string, value: string | number, sub?: string, color: string }) => (
    <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
      <div className="flex items-center gap-3 mb-4">
        <div className={cn('p-2.5 rounded-xl', color)}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-3xl font-extrabold text-white">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  )

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-blue-400 font-bold mb-1">{organization?.org_name}</p>
          <h1 className="text-2xl font-extrabold text-white">Mes KPI</h1>
          <p className="text-xs text-slate-500 mt-1">Performance dans l'organisation</p>
        </div>
        <div className="flex items-center gap-2">
          {(['week', 'month', 'all'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-bold transition-all',
                period === p ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
              )}
            >
              {p === 'week' ? '7 jours' : p === 'month' ? '30 jours' : 'Tout'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard icon={DollarSign} label="Cash Généré" value={`${cashGenerated.toLocaleString('fr-FR')} €`} color="bg-emerald-500/10 text-emerald-400" />
        <KPICard icon={Target} label="Taux de Conversion" value={`${conversionRate}%`} sub={`${wonProspects.length} gagné${wonProspects.length !== 1 ? 's' : ''} / ${closedProspects.length} traité${closedProspects.length !== 1 ? 's' : ''}`} color="bg-purple-500/10 text-purple-400" />
        <KPICard icon={Users} label="Prospects" value={totalProspects} sub={`${wonProspects.length} gagné${wonProspects.length !== 1 ? 's' : ''} · ${lostProspects.length} perdu${lostProspects.length !== 1 ? 's' : ''}`} color="bg-blue-500/10 text-blue-400" />
        <KPICard icon={Calendar} label="Rendez-vous" value={totalAppointments} sub={`${doneAppointments} réalisé${doneAppointments !== 1 ? 's' : ''} · ${showRate}% présence`} color="bg-orange-500/10 text-orange-400" />
      </div>

      {/* Pipeline breakdown */}
      <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Répartition du Pipeline</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Prospect', stage: 'prospect', color: 'bg-amber-400' },
            { label: 'Qualifié', stage: 'qualified', color: 'bg-purple-400' },
            { label: 'Follow Up', stage: 'followup', color: 'bg-orange-400' },
            { label: 'Gagné', stage: 'won', color: 'bg-emerald-500' },
          ].map(s => {
            const count = filteredProspects.filter(p => p.stage === s.stage).length
            const value = filteredProspects.filter(p => p.stage === s.stage).reduce((sum, p) => sum + (p.value || 0), 0)
            return (
              <div key={s.stage} className="p-4 rounded-xl bg-slate-900/50 border border-slate-700/30">
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn('w-2 h-2 rounded-full', s.color)} />
                  <span className="text-xs font-bold text-slate-400">{s.label}</span>
                </div>
                <p className="text-xl font-extrabold text-white">{count}</p>
                <p className="text-xs text-slate-500">{value.toLocaleString('fr-FR')} €</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
