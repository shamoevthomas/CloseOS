import { useState, useEffect, useCallback } from 'react'
import { Megaphone, Eye, UserCheck, Loader2, TrendingUp, TrendingDown } from 'lucide-react'
import {
  PieChart, Pie, Cell,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'

interface CampaignStat {
  id: string
  name: string
  views: number
  is_active: boolean
  totalLeads: number
  wonCount: number
  totalCA: number
  noanswerCount: number
  noshowCount: number
  unqualifiedCount: number
  conversionRate: number
  wonRate: number
}

const API_URL = '/api/business'

const COLORS = ['#111111', '#006c49', '#9ca3af', '#d97706', '#2563eb', '#7c3aed', '#e11d48', '#0891b2']

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)

const formatCompact = (value: number): string => {
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace('.0', '')}k`
  return value.toString()
}

export function BusinessAcquisition() {
  const { user, ownerUserId } = useBusinessAuth()
  const effectiveUserId = ownerUserId || user?.id
  const [stats, setStats] = useState<CampaignStat[]>([])
  const [loading, setLoading] = useState(true)
  const [pieView, setPieView] = useState<'views' | 'conversion'>('views')
  const [countAsUneducated, setCountAsUneducated] = useState(false)

  const fetchStats = useCallback(async () => {
    if (!effectiveUserId) return
    try {
      const res = await fetch(`${API_URL}?action=acquisition-stats&user_id=${effectiveUserId}`)
      const data = await res.json()
      if (data.stats) setStats(data.stats)
    } catch (err) {
      console.error('Error fetching acquisition stats:', err)
    } finally {
      setLoading(false)
    }
  }, [effectiveUserId])

  useEffect(() => { fetchStats() }, [fetchStats])

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 text-stone-400 dark:text-neutral-500 animate-spin" /></div>
  }

  const totalViews = stats.reduce((s, c) => s + c.views, 0)
  const totalLeads = stats.reduce((s, c) => s + c.totalLeads, 0)
  const totalWon = stats.reduce((s, c) => s + c.wonCount, 0)
  const totalCA = stats.reduce((s, c) => s + c.totalCA, 0)
  const globalConversion = totalViews > 0 ? ((totalLeads / totalViews) * 100).toFixed(1) : '0'

  // Pie chart data
  const pieData = stats
    .filter(c => pieView === 'views' ? c.views > 0 : c.conversionRate > 0)
    .map(c => ({
      name: c.name,
      value: pieView === 'views' ? c.views : parseFloat(c.conversionRate.toFixed(1)),
    }))
    .sort((a, b) => b.value - a.value)

  const pieTotal = pieData.reduce((s, d) => s + d.value, 0)

  // Won rate bar data
  const wonBarData = stats
    .filter(c => c.totalLeads > 0)
    .map(c => ({
      name: c.name,
      shortName: c.name.length > 20 ? c.name.slice(0, 20) + '…' : c.name,
      wonRate: parseFloat(c.wonRate.toFixed(1)),
    }))
    .sort((a, b) => b.wonRate - a.wonRate)

  const topPerformer = wonBarData.length > 0 ? wonBarData[0] : null

  // CA bar data
  const caBarData = stats
    .filter(c => c.totalCA > 0)
    .map(c => ({
      name: c.name,
      shortName: c.name.length > 20 ? c.name.slice(0, 20) + '…' : c.name,
      ca: c.totalCA,
    }))
    .sort((a, b) => b.ca - a.ca)

  const maxCA = caBarData.length > 0 ? caBarData[0].ca : 1

  // Implication data
  const implicationData = stats
    .filter(c => c.totalLeads > 0)
    .map(c => {
      const badCount = c.noanswerCount + c.noshowCount
      const rate = parseFloat(((1 - badCount / c.totalLeads) * 100).toFixed(1))
      return { name: c.name, shortName: c.name.length > 15 ? c.name.slice(0, 15) + '…' : c.name, rate }
    })
    .sort((a, b) => b.rate - a.rate)

  // Education data
  const educationData = stats
    .filter(c => c.totalLeads > 0)
    .map(c => {
      const badCount = c.unqualifiedCount + (countAsUneducated ? c.noanswerCount + c.noshowCount : 0)
      const rate = parseFloat(((1 - badCount / c.totalLeads) * 100).toFixed(1))
      return { name: c.name, shortName: c.name.length > 15 ? c.name.slice(0, 15) + '…' : c.name, rate }
    })
    .sort((a, b) => b.rate - a.rate)

  return (
    <div className="space-y-16">

      {/* ─── Hero Header ─── */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-3">
          <h2 className="text-5xl md:text-7xl font-extrabold tracking-tighter text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Acquisition.
          </h2>
          <p className="text-stone-500 dark:text-neutral-400 max-w-md font-medium leading-relaxed">
            Pilotage stratégique des flux d'acquisition et conversion en temps réel pour le trimestre en cours.
          </p>
        </div>
      </section>

      {/* ─── Summary Cards ─── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Campagnes Actives */}
        <div className="bg-white/70 dark:bg-white/5 backdrop-blur-md border border-stone-200/30 dark:border-neutral-700/30 rounded-2xl p-7 flex flex-col justify-between gap-5">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-400">Campagnes Actives</span>
            <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Megaphone className="h-4 w-4 text-emerald-600" />
            </div>
          </div>
          <div>
            <div className="text-4xl font-extrabold text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {stats.filter(c => c.is_active).length}
            </div>
          </div>
        </div>

        {/* Vues Totales */}
        <div className="bg-white/70 dark:bg-white/5 backdrop-blur-md border border-stone-200/30 dark:border-neutral-700/30 rounded-2xl p-7 flex flex-col justify-between gap-5">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-400">Vues Totales</span>
            <div className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Eye className="h-4 w-4 text-amber-600" />
            </div>
          </div>
          <div>
            <div className="text-4xl font-extrabold text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {formatCompact(totalViews)}
            </div>
          </div>
        </div>

        {/* Taux Inscription */}
        <div className="bg-white/70 dark:bg-white/5 backdrop-blur-md border border-stone-200/30 dark:border-neutral-700/30 rounded-2xl p-7 flex flex-col justify-between gap-5">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-400">Taux Inscription</span>
            <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center">
              <UserCheck className="h-4 w-4 text-blue-600" />
            </div>
          </div>
          <div>
            <div className="text-4xl font-extrabold text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {globalConversion}%
            </div>
            <div className="text-xs text-stone-400 dark:text-neutral-500 mt-1">{totalLeads} leads / {totalViews} vues</div>
          </div>
        </div>

        {/* CA Généré */}
        <div className="bg-white/70 dark:bg-white/5 backdrop-blur-md border border-stone-200/30 dark:border-neutral-700/30 rounded-2xl p-7 flex flex-col justify-between gap-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-br from-purple-500/10 to-pink-500/10 blur-3xl -z-10" />
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-400">CA Généré</span>
            <div className="w-9 h-9 rounded-full bg-purple-500/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-purple-600" />
            </div>
          </div>
          <div>
            <div className="text-4xl font-extrabold text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {formatCompact(totalCA)}€
            </div>
            <div className="text-xs text-stone-400 dark:text-neutral-500 mt-1">{totalWon} client{totalWon !== 1 ? 's' : ''} gagné{totalWon !== 1 ? 's' : ''}</div>
          </div>
        </div>
      </section>

      {/* ─── Performance par Campagne ─── */}
      {stats.length > 0 && (
        <section className="space-y-6">
          <div>
            <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight text-stone-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Performance par Campagne
            </h3>
            <p className="text-stone-500 dark:text-neutral-400 mt-1.5 text-sm">Détails granulaires des flux actifs</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {stats.map(c => (
              <div
                key={c.id}
                className={`bg-white/70 dark:bg-white/5 backdrop-blur-md rounded-2xl p-7 hover:-translate-y-1 transition-transform duration-300 ${
                  c.is_active
                    ? 'border border-stone-200/30 dark:border-neutral-700/30'
                    : 'border-2 border-dashed border-stone-300/30 dark:border-neutral-600/30 opacity-60'
                }`}
              >
                <div className="flex justify-between items-center mb-6">
                  <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-wide rounded-full ${
                    c.is_active ? 'bg-emerald-500/10 text-emerald-700' : 'bg-stone-200/50 dark:bg-neutral-700/50 text-stone-500 dark:text-neutral-400'
                  }`}>
                    {c.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <h4 className="text-xl font-extrabold text-stone-900 dark:text-white mb-6" style={{ fontFamily: 'Manrope, sans-serif' }}>{c.name}</h4>
                <div className="grid grid-cols-2 gap-y-5">
                  <div>
                    <p className="text-[10px] text-stone-500 dark:text-neutral-400 uppercase font-bold tracking-[0.15em] mb-1">Vues</p>
                    <p className="text-lg font-bold text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>{c.views.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-stone-500 dark:text-neutral-400 uppercase font-bold tracking-[0.15em] mb-1">Leads</p>
                    <p className="text-lg font-bold text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>{c.totalLeads.toLocaleString()}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] text-stone-500 dark:text-neutral-400 uppercase font-bold tracking-[0.15em] mb-2">Taux de Conversion</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-grow h-2 bg-stone-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${c.is_active ? 'bg-emerald-600' : 'bg-stone-400'}`}
                          style={{ width: `${Math.min(c.conversionRate, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-black text-stone-900 dark:text-white">{c.conversionRate.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── Charts Row: Pie + Conversion Client ─── */}
      {stats.length > 0 && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie Chart */}
          <div className="bg-white/70 dark:bg-white/5 backdrop-blur-md border border-stone-200/30 dark:border-neutral-700/30 rounded-2xl p-8 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h4 className="text-xl font-extrabold tracking-tight text-stone-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Répartition par campagne
              </h4>
              <div className="bg-stone-100 dark:bg-neutral-800 p-1 rounded-lg flex text-[10px] font-bold uppercase tracking-tight">
                <button
                  onClick={() => setPieView('views')}
                  className={`px-3 py-1.5 rounded-md transition-all ${pieView === 'views' ? 'bg-white dark:bg-neutral-700 shadow-sm text-stone-900 dark:text-white' : 'text-stone-500 dark:text-neutral-400'}`}
                >
                  Plus ouverte
                </button>
                <button
                  onClick={() => setPieView('conversion')}
                  className={`px-3 py-1.5 rounded-md transition-all ${pieView === 'conversion' ? 'bg-white dark:bg-neutral-700 shadow-sm text-stone-900 dark:text-white' : 'text-stone-500 dark:text-neutral-400'}`}
                >
                  Plus convertie
                </button>
              </div>
            </div>
            <div className="flex flex-col md:flex-row items-center gap-10">
              {pieData.length === 0 ? (
                <div className="flex items-center justify-center h-48 w-full text-sm text-stone-400 dark:text-neutral-500">Aucune donnée</div>
              ) : (
                <>
                  <div className="relative w-44 h-44 flex items-center justify-center shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={70}
                          paddingAngle={2}
                          dataKey="value"
                          strokeWidth={0}
                        >
                          {pieData.map((_, idx) => (
                            <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => [pieView === 'views' ? `${value} vues` : `${value}%`, '']}
                          contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: 12 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                      <span className="text-[9px] font-bold uppercase text-stone-500 tracking-[0.15em]">Total</span>
                      <span className="text-2xl font-black text-stone-900" style={{ fontFamily: 'Manrope, sans-serif' }}>100%</span>
                    </div>
                  </div>
                  <div className="flex-grow space-y-3.5 w-full">
                    {pieData.map((d, idx) => (
                      <div key={d.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                          <span className="text-sm font-medium text-stone-700 dark:text-neutral-200">{d.name}</span>
                        </div>
                        <span className="text-sm font-black text-stone-900 dark:text-white">
                          {pieTotal > 0 ? Math.round((d.value / pieTotal) * 100) : 0}%
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Conversion Client (%) */}
          <div className="bg-white/70 dark:bg-white/5 backdrop-blur-md border border-stone-200/30 dark:border-neutral-700/30 rounded-2xl p-8 space-y-6">
            <div className="flex justify-between items-center">
              <h4 className="text-xl font-extrabold tracking-tight text-stone-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Conversion Client (%)
              </h4>
              {topPerformer && (
                <span className="text-[10px] font-bold text-emerald-700 uppercase bg-emerald-500/10 px-3 py-1 rounded-full">
                  Top: {topPerformer.shortName}
                </span>
              )}
            </div>
            <div className="space-y-5">
              {wonBarData.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-sm text-stone-400 dark:text-neutral-500">Aucune donnée</div>
              ) : (
                wonBarData.map((d, idx) => (
                  <div key={d.name} className="space-y-2">
                    <div className="flex justify-between text-sm font-bold">
                      <span className="text-stone-700 dark:text-neutral-200">{d.shortName}</span>
                      <span className={idx === 0 ? 'text-emerald-600' : 'text-stone-900 dark:text-white'}>{d.wonRate}%</span>
                    </div>
                    <div className="w-full h-7 bg-stone-100 dark:bg-neutral-800 rounded-lg overflow-hidden">
                      <div
                        className={`h-full rounded-lg transition-all duration-500 ${idx === 0 ? 'bg-emerald-600' : 'bg-stone-800'}`}
                        style={{ width: `${Math.min(d.wonRate * 10, 100)}%`, opacity: idx === 0 ? 1 : 0.6 - idx * 0.1 }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      {/* ─── CA par campagne ─── */}
      {caBarData.length > 0 && (
        <section className="bg-white/70 dark:bg-white/5 backdrop-blur-md border border-stone-200/30 dark:border-neutral-700/30 rounded-2xl p-10 space-y-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h4 className="text-2xl md:text-3xl font-extrabold tracking-tight text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Chiffre d'affaires par campagne
              </h4>
              <p className="text-stone-500 dark:text-neutral-400 mt-1 text-sm">Projection brute vs réalisé par canal</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-stone-900" />
                <span className="text-xs font-bold text-stone-700 dark:text-neutral-200">Réalisé</span>
              </div>
            </div>
          </div>
          <div className="flex items-end gap-6 md:gap-10 w-full pt-8 border-b border-stone-200/30 dark:border-neutral-700/30 h-[350px] px-4">
            {caBarData.map((d, idx) => {
              const heightPct = maxCA > 0 ? (d.ca / maxCA) * 100 : 0
              return (
                <div key={d.name} className="flex-1 flex flex-col items-center gap-3 group">
                  <div className="relative w-full max-w-[80px]">
                    <div
                      className="absolute -top-9 left-1/2 -translate-x-1/2 px-2 py-1 bg-stone-900 text-white text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                    >
                      {formatCurrency(d.ca)}
                    </div>
                    <div
                      className="w-full bg-stone-900 rounded-t-xl transition-all duration-500"
                      style={{ height: `${Math.max(heightPct * 2.8, 16)}px`, opacity: 1 - idx * 0.15 }}
                    />
                  </div>
                  <span className="text-[10px] font-black uppercase text-stone-500 text-center leading-tight">
                    {d.shortName}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ─── Implication + Éducation ─── */}
      {stats.length > 0 && (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-8">
          {/* Taux d'implication */}
          <div className="bg-white/70 dark:bg-white/5 backdrop-blur-md border border-stone-200/30 dark:border-neutral-700/30 rounded-2xl p-8 space-y-8">
            <div>
              <h4 className="text-xl font-extrabold tracking-tight text-stone-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Taux d'implication (%)
              </h4>
              <p className="text-sm text-stone-500 mt-1.5 font-medium">Réduction des no-shows et no-answers</p>
            </div>
            <div className="space-y-5">
              {implicationData.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-sm text-stone-400 dark:text-neutral-500">Aucune donnée</div>
              ) : (
                implicationData.map(d => (
                  <div key={d.name} className="flex items-center gap-5">
                    <span className="w-20 text-[10px] font-black uppercase text-stone-500 dark:text-neutral-400 leading-none shrink-0">{d.shortName}</span>
                    <div className="flex-grow flex items-center gap-3">
                      <div className={`h-3.5 bg-emerald-600 rounded-full transition-all duration-500`} style={{ width: `${d.rate}%` }} />
                      <span className="text-sm font-black text-stone-900 dark:text-white">{d.rate}%</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Taux d'éducation */}
          <div className="bg-white/70 dark:bg-white/5 backdrop-blur-md border border-stone-200/30 dark:border-neutral-700/30 rounded-2xl p-8 space-y-8">
            <div>
              <h4 className="text-xl font-extrabold tracking-tight text-stone-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Taux d'éducation (%)
              </h4>
              <p className="text-sm text-stone-500 dark:text-neutral-400 mt-1.5 font-medium">Qualité des leads (lowest unqualified)</p>
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <button
                onClick={() => setCountAsUneducated(!countAsUneducated)}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${countAsUneducated ? 'bg-blue-600' : 'bg-stone-300 dark:bg-neutral-600'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform shadow-sm ${countAsUneducated ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
              </button>
              <span className="text-xs text-stone-500 dark:text-neutral-400">Inclure "Pas de réponse" et "No Show"</span>
            </label>
            <div className="space-y-5">
              {educationData.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-sm text-stone-400 dark:text-neutral-500">Aucune donnée</div>
              ) : (
                educationData.map(d => (
                  <div key={d.name} className="flex items-center gap-5">
                    <span className="w-20 text-[10px] font-black uppercase text-stone-500 dark:text-neutral-400 leading-none shrink-0">{d.shortName}</span>
                    <div className="flex-grow flex items-center gap-3">
                      <div className="h-3.5 bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${d.rate}%`, opacity: d.rate > 50 ? 1 : 0.5 }} />
                      <span className="text-sm font-black text-stone-900 dark:text-white">{d.rate}%</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      {/* Empty state */}
      {stats.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-300 dark:border-neutral-600 bg-stone-50/50 dark:bg-neutral-800/50 py-16">
          <Megaphone className="h-12 w-12 text-stone-300 dark:text-neutral-600 mb-4" />
          <h3 className="text-lg font-semibold text-stone-700 dark:text-neutral-200 mb-1">Aucune donnée d'acquisition</h3>
          <p className="text-sm text-stone-500 dark:text-neutral-400">Créez des campagnes et partagez vos pages de capture pour voir les statistiques ici.</p>
        </div>
      )}
    </div>
  )
}
