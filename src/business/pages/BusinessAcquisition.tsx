import { useState, useEffect, useCallback } from 'react'
import { Megaphone, Eye, UserCheck, Loader2, TrendingUp, TrendingDown, Radar, Plus, MousePointerClick, Users, Repeat, ExternalLink, Trash2 } from 'lucide-react'
import {
  PieChart, Pie, Cell,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessLang } from '../i18n/BusinessLangContext'
import { CreateTrackingModal } from '../components/CreateTrackingModal'
import { TrackingDetailModal } from '../components/TrackingDetailModal'

interface TrackingLink {
  id: string
  name: string
  slug: string
  destination_url: string
  is_internal: boolean
  is_active: boolean
  clicks: number
  uniqueVisitors: number
  returningClicks: number
}

const TRK = {
  fr: {
    create: 'Créer un tracking',
    section_title: 'Liens de tracking',
    section_desc: 'Liens courts traçables : clics, visiteurs uniques / récurrents, pays et temps sur page.',
    clicks: 'clics', unique: 'uniques', recurring: 'récurrents',
    empty: 'Aucun lien de tracking. Créez-en un pour analyser vos clics.',
    view: 'Voir le détail', confirm_delete: 'Supprimer ce lien de tracking et toutes ses données ?',
  },
  en: {
    create: 'Create a tracking',
    section_title: 'Tracking links',
    section_desc: 'Trackable short links: clicks, unique / returning visitors, country and time on page.',
    clicks: 'clicks', unique: 'unique', recurring: 'returning',
    empty: 'No tracking link yet. Create one to analyze your clicks.',
    view: 'View details', confirm_delete: 'Delete this tracking link and all its data?',
  },
}

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

const formatCurrency = (value: number, lang: 'fr' | 'en' = 'fr'): string =>
  new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)

const formatCompact = (value: number): string => {
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace('.0', '')}k`
  return value.toString()
}

export function BusinessAcquisition() {
  const { user, ownerUserId } = useBusinessAuth()
  const { t, lang } = useBusinessLang()
  const effectiveUserId = ownerUserId || user?.id
  const [stats, setStats] = useState<CampaignStat[]>([])
  const [loading, setLoading] = useState(true)
  const [pieView, setPieView] = useState<'views' | 'conversion'>('views')
  const [countAsUneducated, setCountAsUneducated] = useState(false)
  const trk = TRK[lang]
  const [trackings, setTrackings] = useState<TrackingLink[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [detailLink, setDetailLink] = useState<{ id: string; name: string } | null>(null)

  const fetchTrackings = useCallback(async () => {
    if (!effectiveUserId) return
    try {
      const res = await fetch(`/api/track?action=list&user_id=${effectiveUserId}`)
      const data = await res.json()
      if (data.links) setTrackings(data.links)
    } catch (err) {
      console.error('Error fetching trackings:', err)
    }
  }, [effectiveUserId])

  useEffect(() => { fetchTrackings() }, [fetchTrackings])

  const deleteTracking = async (id: string) => {
    if (!effectiveUserId || !window.confirm(trk.confirm_delete)) return
    setTrackings((prev) => prev.filter((l) => l.id !== id))
    try {
      await fetch('/api/track?action=delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, user_id: effectiveUserId }),
      })
    } catch (err) {
      console.error('Error deleting tracking:', err)
      fetchTrackings()
    }
  }

  const fetchStats = useCallback(async () => {
    if (!effectiveUserId) { setLoading(false); return }
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
    <div className="space-y-6 sm:space-y-16">

      {/* ─── Hero Header ─── (mobile : titre compact + bouton rond sur la même ligne) */}
      <section className="flex items-start md:items-end justify-between gap-4 md:gap-6">
        <div className="space-y-1 sm:space-y-3 min-w-0">
          <h2 className="text-2xl sm:text-5xl md:text-7xl font-extrabold tracking-tight sm:tracking-tighter text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {t.acquisition_title}.
          </h2>
          <p className="text-sm sm:text-base text-stone-500 dark:text-neutral-400 max-w-md font-medium leading-relaxed sm:leading-relaxed">
            {t.acquisition_subtitle}
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          aria-label={trk.create}
          className="shrink-0 flex items-center justify-center gap-2 rounded-full bg-stone-900 dark:bg-white dark:text-black h-10 w-10 sm:h-auto sm:w-auto sm:px-5 sm:py-3 text-sm font-bold text-white shadow-lg hover:bg-stone-800 active:scale-95 transition-all"
        >
          {/* Mobile : « + » comme sur les autres pages (création) ; radar + libellé dès sm */}
          <Plus className="h-4 w-4 sm:hidden" />
          <Radar className="hidden sm:block h-4 w-4" />
          <span className="hidden sm:inline">{trk.create}</span>
        </button>
      </section>

      {/* ─── Summary Cards ─── (mobile : tuiles compactes 2×2, icône à côté du libellé) */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        {/* Campagnes Actives */}
        <div className="bg-white/70 dark:bg-white/5 sm:backdrop-blur-md border border-stone-200/30 dark:border-neutral-700/30 rounded-2xl p-4 sm:p-7 flex flex-col justify-between gap-3 sm:gap-5">
          <div className="flex flex-row-reverse sm:flex-row justify-end sm:justify-between items-center sm:items-start gap-2">
            <span className="min-w-0 text-[10px] font-bold uppercase tracking-wider sm:tracking-[0.15em] text-stone-500 dark:text-neutral-400 leading-tight sm:leading-normal">{t.acquisition_active_campaigns}</span>
            <div className="w-7 h-7 sm:w-9 sm:h-9 shrink-0 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Megaphone className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-4xl font-extrabold text-stone-900 dark:text-white max-sm:truncate" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {stats.filter(c => c.is_active).length}
            </div>
          </div>
        </div>

        {/* Vues Totales */}
        <div className="bg-white/70 dark:bg-white/5 sm:backdrop-blur-md border border-stone-200/30 dark:border-neutral-700/30 rounded-2xl p-4 sm:p-7 flex flex-col justify-between gap-3 sm:gap-5">
          <div className="flex flex-row-reverse sm:flex-row justify-end sm:justify-between items-center sm:items-start gap-2">
            <span className="min-w-0 text-[10px] font-bold uppercase tracking-wider sm:tracking-[0.15em] text-stone-500 dark:text-neutral-400 leading-tight sm:leading-normal">{t.acquisition_total_views_label}</span>
            <div className="w-7 h-7 sm:w-9 sm:h-9 shrink-0 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-4xl font-extrabold text-stone-900 dark:text-white max-sm:truncate" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {formatCompact(totalViews)}
            </div>
          </div>
        </div>

        {/* Taux Inscription */}
        <div className="bg-white/70 dark:bg-white/5 sm:backdrop-blur-md border border-stone-200/30 dark:border-neutral-700/30 rounded-2xl p-4 sm:p-7 flex flex-col justify-between gap-3 sm:gap-5">
          <div className="flex flex-row-reverse sm:flex-row justify-end sm:justify-between items-center sm:items-start gap-2">
            <span className="min-w-0 text-[10px] font-bold uppercase tracking-wider sm:tracking-[0.15em] text-stone-500 dark:text-neutral-400 leading-tight sm:leading-normal">{t.acquisition_registration_rate}</span>
            <div className="w-7 h-7 sm:w-9 sm:h-9 shrink-0 rounded-full bg-blue-500/10 flex items-center justify-center">
              <UserCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-4xl font-extrabold text-stone-900 dark:text-white max-sm:truncate" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {globalConversion}%
            </div>
            <div className="text-[11px] sm:text-xs text-stone-400 dark:text-neutral-500 mt-0.5 sm:mt-1 max-sm:truncate">{totalLeads} {t.acquisition_leads_views.replace('{views}', String(totalViews))}</div>
          </div>
        </div>

        {/* CA Généré */}
        <div className="bg-white/70 dark:bg-white/5 sm:backdrop-blur-md border border-stone-200/30 dark:border-neutral-700/30 rounded-2xl p-4 sm:p-7 flex flex-col justify-between gap-3 sm:gap-5 relative overflow-hidden">
          <div className="hidden lg:block absolute top-0 right-0 w-28 h-28 bg-gradient-to-br from-purple-500/10 to-pink-500/10 blur-3xl -z-10" />
          <div className="flex flex-row-reverse sm:flex-row justify-end sm:justify-between items-center sm:items-start gap-2">
            <span className="min-w-0 text-[10px] font-bold uppercase tracking-wider sm:tracking-[0.15em] text-stone-500 dark:text-neutral-400 leading-tight sm:leading-normal">{t.acquisition_ca_generated}</span>
            <div className="w-7 h-7 sm:w-9 sm:h-9 shrink-0 rounded-full bg-purple-500/10 flex items-center justify-center">
              <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-600" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-4xl font-extrabold text-stone-900 dark:text-white max-sm:truncate" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {formatCompact(totalCA)}€
            </div>
            <div className="text-[11px] sm:text-xs text-stone-400 dark:text-neutral-500 mt-0.5 sm:mt-1 max-sm:truncate">{totalWon} {totalWon !== 1 ? t.acquisition_clients_won_plural : t.acquisition_clients_won}</div>
          </div>
        </div>
      </section>

      {/* ─── Liens de tracking ─── */}
      <section className="space-y-3 sm:space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-lg sm:text-2xl md:text-3xl font-extrabold tracking-tight text-stone-900 dark:text-white flex items-center gap-2 sm:gap-3" style={{ fontFamily: 'Manrope, sans-serif' }}>
              <Radar className="h-5 w-5 sm:h-6 sm:w-6 text-red-600 shrink-0" />
              {trk.section_title}
            </h3>
            <p className="text-stone-500 dark:text-neutral-400 mt-0.5 sm:mt-1.5 text-xs sm:text-sm max-w-xl">{trk.section_desc}</p>
          </div>
        </div>

        {trackings.length === 0 ? (
          <button
            onClick={() => setCreateOpen(true)}
            className="w-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-300 dark:border-neutral-600 bg-stone-50/50 dark:bg-neutral-800/40 py-8 sm:py-12 px-4 hover:border-red-400 dark:hover:border-red-500/50 transition-colors group"
          >
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Plus className="h-6 w-6 text-red-600" />
            </div>
            <p className="text-sm text-stone-500 dark:text-neutral-400 max-w-xs text-center">{trk.empty}</p>
          </button>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-5">
            {trackings.map((l) => (
              <div
                key={l.id}
                className="bg-white/70 dark:bg-white/5 sm:backdrop-blur-md border border-stone-200/30 dark:border-neutral-700/30 rounded-2xl p-4 sm:p-6 flex flex-col gap-3 sm:gap-5 group [@media(hover:hover)]:hover:-translate-y-1 transition-transform duration-300"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="text-base sm:text-lg font-extrabold text-stone-900 dark:text-white truncate" style={{ fontFamily: 'Manrope, sans-serif' }}>{l.name}</h4>
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-stone-400 dark:text-neutral-500 min-w-0">
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="font-mono truncate">{l.destination_url.replace(/^https?:\/\//, '')}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteTracking(l.id)}
                    className="shrink-0 p-2 -m-2 sm:p-0 sm:m-0 text-stone-300 dark:text-neutral-600 hover:text-red-500 transition-colors [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-red-600 mb-0.5 sm:mb-1"><MousePointerClick className="h-3.5 w-3.5" /></div>
                    <div className="text-lg sm:text-xl font-black text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>{l.clicks}</div>
                    <div className="text-[9px] uppercase font-bold tracking-wider text-stone-400 dark:text-neutral-500">{trk.clicks}</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-blue-600 mb-0.5 sm:mb-1"><Users className="h-3.5 w-3.5" /></div>
                    <div className="text-lg sm:text-xl font-black text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>{l.uniqueVisitors}</div>
                    <div className="text-[9px] uppercase font-bold tracking-wider text-stone-400 dark:text-neutral-500">{trk.unique}</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-amber-600 mb-0.5 sm:mb-1"><Repeat className="h-3.5 w-3.5" /></div>
                    <div className="text-lg sm:text-xl font-black text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>{l.returningClicks}</div>
                    <div className="text-[9px] uppercase font-bold tracking-wider text-stone-400 dark:text-neutral-500">{trk.recurring}</div>
                  </div>
                </div>

                <button
                  onClick={() => setDetailLink({ id: l.id, name: l.name })}
                  className="w-full rounded-full border border-stone-300 dark:border-neutral-600 py-2.5 text-sm font-bold active:scale-[0.98] text-stone-700 dark:text-neutral-200 hover:bg-stone-900 hover:text-white dark:hover:bg-white dark:hover:text-black active:scale-95 transition-all"
                >
                  {trk.view}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ─── Performance par Campagne ─── */}
      {stats.length > 0 && (
        <section className="space-y-3 sm:space-y-6">
          <div>
            <h3 className="text-lg sm:text-2xl md:text-3xl font-extrabold tracking-tight text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {t.acquisition_performance_by_campaign}
            </h3>
            <p className="text-stone-500 dark:text-neutral-400 mt-0.5 sm:mt-1.5 text-xs sm:text-sm">{t.acquisition_granular_details}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-6">
            {stats.map(c => (
              <div
                key={c.id}
                className={`bg-white/70 dark:bg-white/5 sm:backdrop-blur-md rounded-2xl p-4 sm:p-7 [@media(hover:hover)]:hover:-translate-y-1 transition-transform duration-300 ${
                  c.is_active
                    ? 'border border-stone-200/30 dark:border-neutral-700/30'
                    : 'border-2 border-dashed border-stone-300/30 dark:border-neutral-600/30 opacity-60'
                }`}
              >
                {/* Mobile : nom (tronqué, à gauche) et badge (à droite) sur une même ligne ; au bureau le nom reste sous le badge */}
                <div className="flex justify-between items-center gap-3 mb-3 sm:mb-6">
                  <span className={`order-2 sm:order-none shrink-0 whitespace-nowrap px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] font-black uppercase tracking-wide rounded-full ${
                    c.is_active ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-stone-200/50 dark:bg-neutral-700/50 text-stone-500 dark:text-neutral-400'
                  }`}>
                    {c.is_active ? t.acquisition_active : t.acquisition_inactive}
                  </span>
                  <h4 className="sm:hidden min-w-0 truncate text-base font-extrabold text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>{c.name}</h4>
                </div>
                <h4 className="hidden sm:block text-xl font-extrabold text-stone-900 dark:text-white mb-6" style={{ fontFamily: 'Manrope, sans-serif' }}>{c.name}</h4>
                <div className="grid grid-cols-2 gap-y-3 sm:gap-y-5">
                  <div>
                    <p className="text-[10px] text-stone-500 dark:text-neutral-400 uppercase font-bold tracking-wider sm:tracking-[0.15em] mb-0.5 sm:mb-1">{t.acquisition_views_label}</p>
                    <p className="text-base sm:text-lg font-bold text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>{c.views.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-stone-500 dark:text-neutral-400 uppercase font-bold tracking-wider sm:tracking-[0.15em] mb-0.5 sm:mb-1">{t.acquisition_leads_label}</p>
                    <p className="text-base sm:text-lg font-bold text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>{c.totalLeads.toLocaleString()}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] text-stone-500 dark:text-neutral-400 uppercase font-bold tracking-wider sm:tracking-[0.15em] mb-1.5 sm:mb-2">{t.acquisition_conversion_rate_label}</p>
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
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">
          {/* Pie Chart */}
          <div className="bg-white/70 dark:bg-white/5 sm:backdrop-blur-md border border-stone-200/30 dark:border-neutral-700/30 rounded-2xl p-4 sm:p-8 space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h4 className="text-base sm:text-xl font-extrabold tracking-tight text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {t.acquisition_distribution_by_campaign}
              </h4>
              {/* Contrôle segmenté pleine largeur sur mobile */}
              <div className="w-full sm:w-auto bg-stone-100 dark:bg-neutral-800 p-1 rounded-lg grid grid-cols-2 sm:flex text-[10px] font-bold uppercase tracking-tight">
                <button
                  onClick={() => setPieView('views')}
                  className={`px-3 py-2 sm:py-1.5 rounded-md transition-all ${pieView === 'views' ? 'bg-white dark:bg-neutral-700 shadow-sm text-stone-900 dark:text-white' : 'text-stone-500 dark:text-neutral-400'}`}
                >
                  {t.acquisition_most_viewed}
                </button>
                <button
                  onClick={() => setPieView('conversion')}
                  className={`px-3 py-2 sm:py-1.5 rounded-md transition-all ${pieView === 'conversion' ? 'bg-white dark:bg-neutral-700 shadow-sm text-stone-900 dark:text-white' : 'text-stone-500 dark:text-neutral-400'}`}
                >
                  {t.acquisition_most_converted}
                </button>
              </div>
            </div>
            <div className="flex flex-col md:flex-row items-center gap-4 sm:gap-10">
              {pieData.length === 0 ? (
                <div className="flex items-center justify-center h-48 w-full text-sm text-stone-400 dark:text-neutral-500">{t.acquisition_no_data}</div>
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
                          formatter={(value: number) => [pieView === 'views' ? `${value} ${t.acquisition_views_tooltip}` : `${value}%`, '']}
                          contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', fontSize: 12, backgroundColor: 'var(--tooltip-bg, #fff)', color: 'var(--tooltip-text, #1c1917)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                      <span className="text-[9px] font-bold uppercase text-stone-500 dark:text-neutral-400 tracking-[0.15em]">Total</span>
                      <span className="text-2xl font-black text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>100%</span>
                    </div>
                  </div>
                  <div className="flex-grow space-y-2.5 sm:space-y-3.5 w-full">
                    {pieData.map((d, idx) => (
                      <div key={d.name} className="flex items-center justify-between gap-3 sm:gap-0">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-3 h-3 rounded-full max-xl:shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                          <span className="text-sm font-medium text-stone-700 dark:text-neutral-200 max-sm:truncate">{d.name}</span>
                        </div>
                        <span className="shrink-0 text-sm font-black text-stone-900 dark:text-white">
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
          <div className="bg-white/70 dark:bg-white/5 sm:backdrop-blur-md border border-stone-200/30 dark:border-neutral-700/30 rounded-2xl p-4 sm:p-8 space-y-4 sm:space-y-6">
            <div className="flex justify-between items-center gap-3 sm:gap-0">
              <h4 className="max-sm:shrink-0 text-base sm:text-xl font-extrabold tracking-tight text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {t.acquisition_client_conversion}
              </h4>
              {topPerformer && (
                <span className="max-sm:min-w-0 max-sm:truncate text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase bg-emerald-500/10 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full">
                  Top: {topPerformer.shortName}
                </span>
              )}
            </div>
            <div className="space-y-3.5 sm:space-y-5">
              {wonBarData.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-sm text-stone-400 dark:text-neutral-500">{t.acquisition_no_data}</div>
              ) : (
                wonBarData.map((d, idx) => (
                  <div key={d.name} className="space-y-1.5 sm:space-y-2">
                    <div className="flex justify-between gap-3 sm:gap-0 text-sm font-bold">
                      <span className="min-w-0 max-sm:truncate text-stone-700 dark:text-neutral-200">{d.shortName}</span>
                      <span className={`shrink-0 ${idx === 0 ? 'text-emerald-600' : 'text-stone-900 dark:text-white'}`}>{d.wonRate}%</span>
                    </div>
                    <div className="w-full h-4 sm:h-7 bg-stone-100 dark:bg-neutral-800 rounded-lg overflow-hidden">
                      <div
                        className={`h-full rounded-lg transition-all duration-500 ${idx === 0 ? 'bg-emerald-600' : 'bg-stone-800 dark:bg-neutral-500'}`}
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
        <section className="bg-white/70 dark:bg-white/5 sm:backdrop-blur-md border border-stone-200/30 dark:border-neutral-700/30 rounded-2xl p-4 sm:p-10 space-y-4 sm:space-y-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 sm:gap-4">
            <div>
              <h4 className="text-base sm:text-2xl md:text-3xl font-extrabold tracking-tight text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {t.acquisition_ca_by_campaign}
              </h4>
              <p className="text-stone-500 dark:text-neutral-400 mt-0.5 sm:mt-1 text-xs sm:text-sm">{t.acquisition_projection_vs_actual}</p>
            </div>
            <div className="hidden sm:flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-stone-900 dark:bg-neutral-300" />
                <span className="text-xs font-bold text-stone-700 dark:text-neutral-200">{t.acquisition_actual}</span>
              </div>
            </div>
          </div>
          {/* Mobile : barres horizontales avec le montant affiché (pas d'infobulle au survol sur téléphone) */}
          <div className="sm:hidden space-y-3.5">
            {caBarData.map((d, idx) => (
              <div key={d.name} className="space-y-1.5">
                <div className="flex justify-between gap-3 text-sm font-bold">
                  <span className="min-w-0 truncate text-stone-700 dark:text-neutral-200">{d.name}</span>
                  <span className="shrink-0 text-stone-900 dark:text-white tabular-nums">{formatCurrency(d.ca)}</span>
                </div>
                <div className="w-full h-4 bg-stone-100 dark:bg-neutral-800 rounded-lg overflow-hidden">
                  <div
                    className="h-full bg-stone-900 dark:bg-neutral-300 rounded-lg transition-all duration-500"
                    style={{ width: `${Math.max(maxCA > 0 ? (d.ca / maxCA) * 100 : 0, 4)}%`, opacity: 1 - idx * 0.15 }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="hidden sm:flex items-end gap-6 md:gap-10 w-full pt-8 border-b border-stone-200/30 dark:border-neutral-700/30 h-[350px] px-4">
            {caBarData.map((d, idx) => {
              const heightPct = maxCA > 0 ? (d.ca / maxCA) * 100 : 0
              return (
                <div key={d.name} className="flex-1 flex flex-col items-center gap-3 group">
                  <div className="relative w-full max-w-[80px]">
                    <div
                      className="absolute -top-9 left-1/2 -translate-x-1/2 px-2 py-1 bg-stone-900 text-white text-[10px] font-bold rounded [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity whitespace-nowrap"
                    >
                      {formatCurrency(d.ca)}
                    </div>
                    <div
                      className="w-full bg-stone-900 dark:bg-neutral-300 rounded-t-xl transition-all duration-500"
                      style={{ height: `${Math.max(heightPct * 2.8, 16)}px`, opacity: 1 - idx * 0.15 }}
                    />
                  </div>
                  <span className="text-[10px] font-black uppercase text-stone-500 dark:text-neutral-400 text-center leading-tight">
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
        <section className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6 pb-4 sm:pb-8">
          {/* Taux d'implication */}
          <div className="bg-white/70 dark:bg-white/5 sm:backdrop-blur-md border border-stone-200/30 dark:border-neutral-700/30 rounded-2xl p-4 sm:p-8 space-y-4 sm:space-y-8">
            <div>
              <h4 className="text-base sm:text-xl font-extrabold tracking-tight text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {t.acquisition_implication_rate}
              </h4>
              <p className="text-xs sm:text-sm text-stone-500 dark:text-neutral-400 mt-0.5 sm:mt-1.5 font-medium">{t.acquisition_implication_desc}</p>
            </div>
            <div className="space-y-3.5 sm:space-y-5">
              {implicationData.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-sm text-stone-400 dark:text-neutral-500">{t.acquisition_no_data}</div>
              ) : (
                implicationData.map(d => (
                  <div key={d.name} className="flex items-center gap-3 sm:gap-5">
                    <span className="w-28 sm:w-20 max-sm:truncate text-[10px] font-black uppercase text-stone-500 dark:text-neutral-400 leading-none shrink-0">{d.shortName}</span>
                    <div className="flex-grow min-w-0 flex items-center gap-2 sm:gap-3">
                      <div className={`h-3 sm:h-3.5 bg-emerald-600 rounded-full transition-all duration-500`} style={{ width: `${d.rate}%` }} />
                      <span className="text-sm font-black text-stone-900 dark:text-white">{d.rate}%</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Taux d'éducation */}
          <div className="bg-white/70 dark:bg-white/5 sm:backdrop-blur-md border border-stone-200/30 dark:border-neutral-700/30 rounded-2xl p-4 sm:p-8 space-y-4 sm:space-y-8">
            <div>
              <h4 className="text-base sm:text-xl font-extrabold tracking-tight text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {t.acquisition_education_rate}
              </h4>
              <p className="text-xs sm:text-sm text-stone-500 dark:text-neutral-400 mt-0.5 sm:mt-1.5 font-medium">{t.acquisition_education_desc}</p>
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <button
                onClick={() => setCountAsUneducated(!countAsUneducated)}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${countAsUneducated ? 'bg-blue-600' : 'bg-stone-300 dark:bg-neutral-600'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform shadow-sm ${countAsUneducated ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
              </button>
              <span className="text-xs text-stone-500 dark:text-neutral-400">{t.acquisition_include_noanswer_noshow}</span>
            </label>
            <div className="space-y-3.5 sm:space-y-5">
              {educationData.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-sm text-stone-400 dark:text-neutral-500">{t.acquisition_no_data}</div>
              ) : (
                educationData.map(d => (
                  <div key={d.name} className="flex items-center gap-3 sm:gap-5">
                    <span className="w-28 sm:w-20 max-sm:truncate text-[10px] font-black uppercase text-stone-500 dark:text-neutral-400 leading-none shrink-0">{d.shortName}</span>
                    <div className="flex-grow min-w-0 flex items-center gap-2 sm:gap-3">
                      <div className="h-3 sm:h-3.5 bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${d.rate}%`, opacity: d.rate > 50 ? 1 : 0.5 }} />
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
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-300 dark:border-neutral-600 bg-stone-50/50 dark:bg-neutral-800/50 py-8 sm:py-16 px-4 sm:px-0 max-sm:text-center">
          <Megaphone className="h-8 w-8 sm:h-12 sm:w-12 text-stone-300 dark:text-neutral-600 mb-3 sm:mb-4" />
          <h3 className="text-base sm:text-lg font-semibold text-stone-700 dark:text-neutral-200 mb-1">{t.acquisition_empty_title}</h3>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-neutral-400">{t.acquisition_empty_desc}</p>
        </div>
      )}

      <CreateTrackingModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        userId={effectiveUserId}
        onCreated={fetchTrackings}
      />
      <TrackingDetailModal
        isOpen={!!detailLink}
        onClose={() => setDetailLink(null)}
        linkId={detailLink?.id || null}
        linkName={detailLink?.name || ''}
        userId={effectiveUserId}
      />
    </div>
  )
}
