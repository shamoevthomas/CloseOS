import { useState, useEffect, useMemo } from 'react'
import {
  ChevronLeft, ChevronRight, DollarSign, ShoppingCart, Target, Award,
  TrendingUp, Ban, UserX, Repeat, Repeat2, PhoneIncoming, CalendarCheck, Lock,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useOffers } from '../contexts/OffersContext'
import { useProspects } from '../contexts/ProspectsContext'
import { useAuth } from '../contexts/AuthContext'
import { useUpgrade } from '../contexts/UpgradeContext'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../contexts/LanguageContext'
import { kpiTranslations } from '../i18n/translations'

const formatCurrency = (n: number) => n.toLocaleString('fr-FR')
const formatPercent = (n: number) => n.toFixed(1)
const parseCommission = (s: string): number => {
  if (!s) return 0
  const m = String(s).match(/[\d.]+/)
  return m ? parseFloat(m[0]) / 100 : 0
}

export function SetterKPIPage() {
  const { offers: allOffers } = useOffers()
  const { prospects } = useProspects()
  const { user, isFounder, isAdmin, isInTrial } = useAuth()
  const { showUpgrade } = useUpgrade()
  const hasFullAccess = isFounder || isAdmin || isInTrial
  const { lang } = useLanguage()
  const t = kpiTranslations[lang]
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'

  const isExpired = (offer: any) => {
    if (!offer.endDate) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return new Date(offer.endDate) < today
  }
  const activeOffers = useMemo(() => allOffers.filter((o: any) => o.status === 'active' && !isExpired(o)), [allOffers])

  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'month' | 'all'>('all')
  const [activeTab, setActiveTab] = useState<string>('global')
  const [followupHistoryIds, setFollowupHistoryIds] = useState<Set<number>>(new Set())

  // Load followup transitions from prospect_history (for follow-up + R2 closing rates)
  useEffect(() => {
    if (!user) return
    let cancelled = false
    supabase
      .from('prospect_history')
      .select('prospect_id')
      .eq('user_id', user.id)
      .eq('change_type', 'stage_change')
      .eq('new_value', 'followup')
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) { console.error('followup history:', error); return }
        setFollowupHistoryIds(new Set((data || []).map((r: any) => r.prospect_id)))
      })
    return () => { cancelled = true }
  }, [user])

  const prevMonth = () => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  const nextMonth = () => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))

  // Filter prospects by tab (offer) + period (month)
  const filteredProspects = useMemo(() => {
    return prospects.filter((p: any) => {
      if (activeTab !== 'global') {
        const pOffer = (p.offer || '').toLowerCase()
        const pOfferId = String(p.offerId || p.offer_id || '')
        const target = allOffers.find((o: any) => o.name.toLowerCase() === activeTab.toLowerCase())
        const matchName = pOffer && (pOffer.includes(activeTab.toLowerCase()) || activeTab.toLowerCase().includes(pOffer))
        const matchId = target && pOfferId === String(target.id)
        if (!matchName && !matchId) return false
      }
      if (viewMode === 'month') {
        const d = (p.created_at || p.dateAdded) ? new Date(p.created_at || p.dateAdded) : new Date()
        if (d.getMonth() !== currentDate.getMonth() || d.getFullYear() !== currentDate.getFullYear()) return false
      }
      return true
    })
  }, [prospects, activeTab, allOffers, viewMode, currentDate])

  // ─── Setter-specific computations ─────────────────────────────────────────
  const contacted = filteredProspects.filter((p: any) => p.stage && p.stage !== 'prospect')
  const responded = contacted.filter((p: any) => p.responded_at || (p.stage !== 'noanswer' && p.stage !== 'contacted'))
  const responseRate = contacted.length > 0 ? (responded.length / contacted.length) * 100 : 0

  const booked = contacted.filter((p: any) => p.stage !== 'noanswer' && p.stage !== 'unqualified')
  const bookingRate = contacted.length > 0 ? (booked.length / contacted.length) * 100 : 0

  // ─── Standard pipeline computations (mirror KPIPage logic) ────────────────
  const won = filteredProspects.filter((p: any) => p.stage === 'won')
  const lost = filteredProspects.filter((p: any) => p.stage === 'lost')
  const noShow = filteredProspects.filter((p: any) => p.stage === 'noshow')

  const qualifiedAll = filteredProspects.filter((p: any) =>
    ['qualified', 'won', 'lost', 'noshow', 'followup'].includes(p.stage)
  )
  const conversionRate = qualifiedAll.length > 0 ? (won.length / qualifiedAll.length) * 100 : 0
  const noShowRate = qualifiedAll.length > 0 ? (noShow.length / qualifiedAll.length) * 100 : 0

  const revenue = won.reduce((sum: number, p: any) => sum + (p.value || 0), 0)
  const commissions = won.reduce((sum: number, p: any) => {
    const offer = allOffers.find((o: any) =>
      (p.offerId && String(o.id) === String(p.offerId)) ||
      (p.offer && o.name.toLowerCase() === p.offer.toLowerCase())
    )
    const rate = offer?.commission ? parseCommission(offer.commission) : 0.10
    return sum + (p.value || 0) * rate
  }, 0)

  // Follow-up & R2 closing
  const everInFollowup = filteredProspects.filter((p: any) => p.stage === 'followup' || followupHistoryIds.has(p.id))
  const followupRate = filteredProspects.length > 0 ? (everInFollowup.length / filteredProspects.length) * 100 : 0
  const wonAfterFollowup = everInFollowup.filter((p: any) => p.stage === 'won')
  const r2ClosingRate = everInFollowup.length > 0 ? (wonAfterFollowup.length / everInFollowup.length) * 100 : 0

  // ─── Charts ───────────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    const grouped: Record<string, { contacted: number; booked: number; won: number; total: number; date: Date }> = {}
    prospects.forEach((p: any) => {
      const d = (p.created_at || p.dateAdded) ? new Date(p.created_at || p.dateAdded) : new Date()
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!grouped[key]) grouped[key] = { contacted: 0, booked: 0, won: 0, total: 0, date: d }
      grouped[key].total += 1
      if (p.stage && p.stage !== 'prospect') grouped[key].contacted += 1
      if (p.stage && p.stage !== 'prospect' && p.stage !== 'noanswer' && p.stage !== 'unqualified') grouped[key].booked += 1
      if (p.stage === 'won') grouped[key].won += 1
    })
    return Object.values(grouped)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map(g => ({
        name: g.date.toLocaleDateString(locale, { month: 'short', year: '2-digit' }),
        responseRate: g.contacted > 0 ? parseFloat(((g.contacted - 0) / g.contacted * 100).toFixed(1)) : 0,
        bookingRate: g.contacted > 0 ? parseFloat((g.booked / g.contacted * 100).toFixed(1)) : 0,
        closingRate: g.total > 0 ? parseFloat((g.won / g.total * 100).toFixed(1)) : 0,
      }))
  }, [prospects, locale])

  return (
    <div className="relative min-h-screen bg-transparent p-6 md:px-12 md:pb-20 text-slate-700 dark:text-neutral-300 overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-sky-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-sky-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto space-y-8 z-10">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pt-4 md:pt-12 pb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <PhoneIncoming className="w-7 h-7 text-sky-600 dark:text-sky-400" />
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tighter text-slate-900 dark:text-white">{t.setter_view || 'Setter Performance'}</h1>
            </div>
            <p className="text-slate-500 dark:text-neutral-400 text-sm font-medium">
              {viewMode === 'month'
                ? (lang === 'fr' ? `Analyse pour ${currentDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}` : `Analysis for ${currentDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}`)
                : (lang === 'fr' ? 'Analyse approfondie de votre activité de setter' : 'In-depth analysis of your setter activity')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {hasFullAccess ? (
              <>
                {viewMode === 'month' && (
                  <div className="flex items-center bg-slate-50 dark:bg-white/5 rounded-full p-1 border border-slate-200 dark:border-white/10">
                    <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 dark:text-neutral-400"><ChevronLeft className="w-4 h-4" /></button>
                    <span className="px-4 text-sm font-semibold text-slate-900 dark:text-white capitalize min-w-[120px] text-center">
                      {currentDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
                    </span>
                    <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 dark:text-neutral-400"><ChevronRight className="w-4 h-4" /></button>
                  </div>
                )}
                <button onClick={() => setViewMode(viewMode === 'month' ? 'all' : 'month')} className="px-6 py-2.5 rounded-full bg-sky-600 text-white font-semibold hover:bg-sky-500 transition-all">
                  {viewMode === 'month' ? (lang === 'fr' ? 'Vue Globale' : 'Global View') : (lang === 'fr' ? 'Vue Mensuelle' : 'Monthly View')}
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-500 dark:text-neutral-400">
                <Lock className="w-4 h-4" />
                {lang === 'fr' ? 'Filtres réservés au Pack Pro' : 'Filters reserved for Pro Pack'}
              </div>
            )}
          </div>
        </div>

        {/* TABS */}
        <div className="flex gap-1 p-1 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full w-full sm:w-fit overflow-x-auto mb-4">
          <button onClick={() => setActiveTab('global')} className={`px-8 py-2 rounded-full text-sm font-bold transition-all ${activeTab === 'global' ? 'bg-sky-600 text-white' : 'text-slate-500 dark:text-neutral-400 hover:text-slate-900'}`}>Global</button>
          {activeOffers.map((offer: any) => (
            <button key={offer.id} onClick={() => setActiveTab(offer.name)} className={`px-8 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap ${activeTab === offer.name ? 'bg-sky-600 text-white' : 'text-slate-500 dark:text-neutral-400 hover:text-slate-900'}`}>
              {offer.name}
            </button>
          ))}
        </div>

        {/* SETTER KPI ROW */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <SetterCard
            title={t.contacted || 'Contactés'}
            value={String(contacted.length)}
            subtitle={`${responded.length} / ${contacted.length} ${lang === 'fr' ? 'répondu' : 'responded'}`}
            icon={PhoneIncoming}
            color="cyan"
          />
          <SetterCard
            title={t.response_rate || 'Taux de réponse'}
            value={`${formatPercent(responseRate)} %`}
            subtitle={`${responded.length} / ${contacted.length}`}
            icon={Target}
            color="purple"
          />
          <SetterCard
            title={t.booked || 'Bookés'}
            value={String(booked.length)}
            subtitle={`${booked.length} / ${contacted.length} ${lang === 'fr' ? 'contactés' : 'contacted'}`}
            icon={CalendarCheck}
            color="emerald"
          />
          <SetterCard
            title={t.booking_rate || 'Taux de booking'}
            value={`${formatPercent(bookingRate)} %`}
            subtitle={`${booked.length} / ${contacted.length}`}
            icon={TrendingUp}
            color="amber"
            glow
          />
        </div>

        {/* STANDARD PIPELINE ROW */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KpiCard title={t.cash_generated} value={`${formatCurrency(revenue)} €`} icon={DollarSign} color="emerald" glow />
          <KpiCard title={lang === 'fr' ? 'Ventes Totales' : 'Total Sales'} value={String(won.length)} icon={ShoppingCart} color="blue" />
          <KpiCard title={t.conversion_rate} value={`${formatPercent(conversionRate)} %`} icon={Target} color="purple" />
          <KpiCard title={t.commissions} value={`${formatCurrency(commissions)} €`} icon={Award} color="amber" glow />
          <KpiCard title={lang === 'fr' ? 'Taux de No Show' : 'No Show Rate'} value={`${formatPercent(noShowRate)} %`} icon={UserX} color="rose" />
          <KpiCard title={t.deals_lost} value={String(lost.length)} icon={Ban} color="slate" />
          <KpiCard title={lang === 'fr' ? 'Taux de Follow-up' : 'Follow-up Rate'} value={`${formatPercent(followupRate)} %`} icon={Repeat} color="amber" />
          <KpiCard title={lang === 'fr' ? 'Closing après R2' : 'Closing after R2'} value={`${formatPercent(r2ClosingRate)} %`} icon={Repeat2} color="purple" />
        </div>

        {/* CHARTS */}
        <div className="relative">
          {!hasFullAccess && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl">
              <button onClick={showUpgrade} className="flex items-center gap-2.5 px-8 py-4 rounded-full bg-sky-600 text-white font-bold text-base shadow-2xl hover:bg-sky-500 active:scale-[0.98] transition-all">
                <Lock className="w-5 h-5" /> {lang === 'fr' ? 'Débloquer' : 'Unlock'}
              </button>
            </div>
          )}
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-8 ${!hasFullAccess ? 'blur-md select-none pointer-events-none' : ''}`}>
            <div className="rounded-2xl p-8 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 shadow-sm">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{lang === 'fr' ? 'Historique Taux de Booking' : 'Booking Rate History'}</h3>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorBooking" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0284C7" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#0284C7" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} unit="%" />
                    <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', color: '#0f172a' }} itemStyle={{ color: '#0284C7' }} />
                    <Area type="monotone" dataKey="bookingRate" stroke="#0284C7" strokeWidth={2} fillOpacity={1} fill="url(#colorBooking)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl p-8 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 shadow-sm">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{lang === 'fr' ? 'Historique Closing' : 'Closing Rate History'}</h3>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorClosingSetter" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#38BDF8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} unit="%" />
                    <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', color: '#0f172a' }} itemStyle={{ color: '#38BDF8' }} />
                    <Area type="monotone" dataKey="closingRate" stroke="#38BDF8" strokeWidth={2} fillOpacity={1} fill="url(#colorClosingSetter)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const KpiCard = ({ title, value, icon: Icon, color, glow }: any) => {
  const textColors: any = {
    emerald: 'text-sky-600 dark:text-sky-400', blue: 'text-sky-600 dark:text-sky-400', purple: 'text-sky-600 dark:text-sky-400',
    amber: 'text-amber-600', rose: 'text-rose-600', slate: 'text-slate-400 dark:text-neutral-500', cyan: 'text-sky-600 dark:text-sky-400',
  }
  const glowStyles: any = {
    emerald: 'shadow-[0_0_20px_rgba(2,132,199,0.1)]',
    amber: 'shadow-[0_0_25px_rgba(245,158,11,0.15)] bg-gradient-to-br from-amber-500/10 to-transparent border-amber-500/20',
    cyan: 'shadow-[0_0_20px_rgba(2,132,199,0.15)] bg-gradient-to-br from-sky-500/10 to-transparent border-sky-500/20',
  }
  return (
    <div className={`relative p-8 rounded-2xl bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 shadow-sm transition-all hover:bg-slate-50 group ${glow ? glowStyles[color] || '' : ''}`}>
      {glow && color === 'amber' && <div className="absolute -right-4 -top-4 h-24 w-24 bg-amber-500/10 blur-3xl group-hover:bg-amber-500/20 transition-all" />}
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-neutral-400 mb-4">{title}</p>
      <h3 className={`text-3xl font-extrabold tracking-tight ${glow ? textColors[color] : 'text-slate-900 dark:text-white'}`}>{value}</h3>
    </div>
  )
}

const SetterCard = ({ title, value, subtitle, icon: Icon, color, glow }: any) => {
  const colors: any = {
    cyan: 'text-sky-600 dark:text-sky-400', purple: 'text-sky-600 dark:text-sky-400', emerald: 'text-sky-600 dark:text-sky-400', amber: 'text-amber-600',
  }
  const glowStyles: any = {
    amber: 'shadow-[0_0_25px_rgba(245,158,11,0.15)] bg-gradient-to-br from-amber-500/10 to-transparent border-amber-500/20',
  }
  return (
    <div className={`relative p-8 rounded-2xl bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 shadow-sm transition-all hover:bg-slate-50 group ${glow ? glowStyles[color] || '' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-neutral-400">{title}</p>
        <Icon className={`w-4 h-4 ${colors[color] || 'text-slate-400 dark:text-neutral-500'}`} />
      </div>
      <h3 className={`text-3xl font-extrabold tracking-tight ${glow ? colors[color] : 'text-slate-900 dark:text-white'}`}>{value}</h3>
      {subtitle && <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1">{subtitle}</p>}
    </div>
  )
}
