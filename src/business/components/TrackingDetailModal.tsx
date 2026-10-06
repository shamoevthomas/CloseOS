import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { X, Loader2, MousePointerClick, Users, Repeat, Clock, Globe, Copy, Check } from 'lucide-react'
import { useBusinessLang } from '../i18n/BusinessLangContext'
import { flagEmoji, countryName } from '../lib/countryGeo'

// three.js est lourd → on ne le charge que quand la pop-up détail s'ouvre
const VisitorGlobe = lazy(() => import('./VisitorGlobe').then((m) => ({ default: m.VisitorGlobe })))

interface CountryStat { code: string; count: number }
interface Stats {
  clicks: number
  uniqueVisitors: number
  recurringVisitors: number
  newVisitors: number
  returningClicks: number
  avgDuration: number | null
  hasDurationData: boolean
  byCountry: CountryStat[]
  timeseries: { day: string; count: number }[]
}
interface LinkRow {
  id: string; name: string; slug: string; destination_url: string; is_internal: boolean
}

interface Props {
  isOpen: boolean
  onClose: () => void
  linkId: string | null
  linkName: string
  userId: string | undefined
}

const TT = {
  fr: {
    clicks: 'Clics totaux', unique: 'Visiteurs uniques', recurring: 'Récurrents', neww: 'Nouveaux',
    returning_clicks: 'clics récurrents', avg_time: 'Temps moyen / page', no_time: 'Non mesurable (destination externe)',
    by_country: 'Visiteurs par pays', countries: 'pays', country: 'pays', no_data: 'Aucun clic pour le moment',
    unknown: 'Inconnu',
  },
  en: {
    clicks: 'Total clicks', unique: 'Unique visitors', recurring: 'Returning', neww: 'New',
    returning_clicks: 'returning clicks', avg_time: 'Avg. time / page', no_time: 'Not measurable (external destination)',
    by_country: 'Visitors by country', countries: 'countries', country: 'country', no_data: 'No clicks yet',
    unknown: 'Unknown',
  },
}

function formatDuration(sec: number | null): string {
  if (sec == null) return '—'
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s ? `${m}m ${s}s` : `${m}m`
}

export function TrackingDetailModal({ isOpen, onClose, linkId, linkName, userId }: Props) {
  const { lang } = useBusinessLang()
  const t = TT[lang]
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats | null>(null)
  const [link, setLink] = useState<LinkRow | null>(null)
  const [copied, setCopied] = useState(false)

  const fetchStats = useCallback(async () => {
    if (!linkId || !userId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/track?action=stats&link_id=${linkId}&user_id=${userId}`)
      const data = await res.json()
      if (data.stats) { setStats(data.stats); setLink(data.link) }
    } catch (e) {
      console.error('tracking stats error', e)
    } finally {
      setLoading(false)
    }
  }, [linkId, userId])

  useEffect(() => {
    if (isOpen && linkId) fetchStats()
  }, [isOpen, linkId, fetchStats])

  if (!isOpen) return null

  const shortUrl = link ? `${window.location.origin}/t/${link.slug}` : ''
  const maxCountry = stats?.byCountry?.[0]?.count || 1
  const realCountries = (stats?.byCountry || []).filter((c) => c.code !== 'ZZ')

  // map pour le globe : iso2 minuscule -> count
  const counts: Record<string, number> = {}
  realCountries.forEach((c) => { counts[c.code.toLowerCase()] = c.count })

  const handleCopy = () => {
    if (!shortUrl) return
    navigator.clipboard.writeText(shortUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-start justify-center bg-stone-900/50 backdrop-blur-md p-0 sm:p-4 overflow-y-auto">
      {/* Mobile : feuille du bas à défilement interne (fond opaque, pas de flou sur la grande zone défilante) */}
      <div className="w-full sm:max-w-4xl my-0 sm:my-8 max-h-[92dvh] sm:max-h-none overflow-y-auto overscroll-contain sm:overflow-visible bg-white sm:bg-white/95 dark:bg-neutral-900 sm:dark:bg-neutral-900/95 sm:backdrop-blur-xl rounded-t-3xl sm:rounded-2xl shadow-[0_20px_60px_rgba(27,28,27,0.15)] border border-stone-200/20 dark:border-neutral-700 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-8 relative animate-in zoom-in-95 duration-200">
        {/* Header — collant sur mobile (poignée + titre + fermer), statique au-delà */}
        <div className="sticky top-0 z-10 -mx-5 px-5 pt-2 pb-3 mb-4 bg-white dark:bg-neutral-900 border-b border-stone-100 dark:border-neutral-800 sm:static sm:mx-0 sm:px-0 sm:pt-0 sm:pb-0 sm:mb-8 sm:pr-8 sm:bg-transparent sm:dark:bg-transparent sm:border-0">
          <div className="sm:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-stone-300 dark:bg-neutral-700" />
          <div className="flex items-start justify-between gap-3 sm:block">
            <div className="min-w-0">
              <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight text-stone-900 dark:text-white max-sm:truncate" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {linkName}
              </h2>
              {shortUrl && (
                <div className="flex items-center gap-2 mt-1 sm:mt-2 min-w-0">
                  <span className="text-xs font-mono text-stone-400 dark:text-neutral-500 max-sm:truncate">{shortUrl}</span>
                  <button onClick={handleCopy} aria-label="Copier" className="shrink-0 p-1.5 -m-1.5 sm:p-0 sm:m-0 text-stone-400 hover:text-red-600 transition-colors">
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Fermer"
              className="shrink-0 p-2 -mr-2 -mt-1 sm:m-0 sm:p-0 sm:absolute sm:top-5 sm:right-5 text-stone-400 dark:text-neutral-500 hover:text-stone-700 dark:hover:text-neutral-200 transition-colors z-10"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48 sm:h-64">
            <Loader2 className="h-8 w-8 text-stone-400 dark:text-neutral-500 animate-spin" />
          </div>
        ) : !stats || stats.clicks === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 sm:h-64 text-stone-400 dark:text-neutral-500">
            <Globe className="h-8 w-8 sm:h-12 sm:w-12 mb-3 opacity-40" />
            <p className="text-sm">{t.no_data}</p>
          </div>
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-10">
              <div className="bg-stone-50 dark:bg-white/5 border border-stone-200/60 dark:border-neutral-700/40 rounded-2xl p-3.5 sm:p-5">
                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                  <MousePointerClick className="h-4 w-4 max-xl:shrink-0 text-red-600" />
                  <span className="min-w-0 text-[10px] font-bold uppercase tracking-wider sm:tracking-[0.12em] leading-tight sm:leading-normal text-stone-500 dark:text-neutral-400">{t.clicks}</span>
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>{stats.clicks}</div>
              </div>
              <div className="bg-stone-50 dark:bg-white/5 border border-stone-200/60 dark:border-neutral-700/40 rounded-2xl p-3.5 sm:p-5">
                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                  <Users className="h-4 w-4 max-xl:shrink-0 text-blue-600" />
                  <span className="min-w-0 text-[10px] font-bold uppercase tracking-wider sm:tracking-[0.12em] leading-tight sm:leading-normal text-stone-500 dark:text-neutral-400">{t.unique}</span>
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>{stats.uniqueVisitors}</div>
              </div>
              <div className="bg-stone-50 dark:bg-white/5 border border-stone-200/60 dark:border-neutral-700/40 rounded-2xl p-3.5 sm:p-5">
                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                  <Repeat className="h-4 w-4 max-xl:shrink-0 text-amber-600" />
                  <span className="min-w-0 text-[10px] font-bold uppercase tracking-wider sm:tracking-[0.12em] leading-tight sm:leading-normal text-stone-500 dark:text-neutral-400">{t.recurring}</span>
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>{stats.recurringVisitors}</div>
                <div className="text-xs text-stone-400 dark:text-neutral-500 mt-1">{stats.newVisitors} {t.neww.toLowerCase()}</div>
              </div>
              <div className="bg-stone-50 dark:bg-white/5 border border-stone-200/60 dark:border-neutral-700/40 rounded-2xl p-3.5 sm:p-5">
                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                  <Clock className="h-4 w-4 max-xl:shrink-0 text-emerald-600" />
                  <span className="min-w-0 text-[10px] font-bold uppercase tracking-wider sm:tracking-[0.12em] leading-tight sm:leading-normal text-stone-500 dark:text-neutral-400">{t.avg_time}</span>
                </div>
                {stats.hasDurationData ? (
                  <div className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>{formatDuration(stats.avgDuration)}</div>
                ) : (
                  <div className="text-xs text-stone-400 dark:text-neutral-500 leading-snug pt-1">{t.no_time}</div>
                )}
              </div>
            </div>

            {/* Visiteurs par pays : globe + liste (fond blanc) — à fleur de feuille sur mobile (pas de carte dans la carte) */}
            <div className="sm:bg-white sm:dark:bg-white/5 sm:rounded-2xl sm:p-8 sm:border border-stone-200/60 dark:border-neutral-700/40">
              <div className="flex items-center justify-between gap-3 sm:gap-0 mb-2 sm:mb-4">
                <h3 className="text-base sm:text-xl font-extrabold text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>{t.by_country}</h3>
                <span className="shrink-0 whitespace-nowrap text-[11px] sm:text-xs text-stone-400 dark:text-neutral-500 uppercase tracking-wider sm:tracking-widest">
                  {realCountries.length} {realCountries.length === 1 ? t.country : t.countries}
                </span>
              </div>
              <div className="flex flex-col lg:flex-row items-center gap-4 sm:gap-8">
                <div className="shrink-0 w-full lg:w-[420px]">
                  <Suspense fallback={<div className="h-[300px] sm:h-[380px] flex items-center justify-center"><Loader2 className="h-6 w-6 text-stone-300 animate-spin" /></div>}>
                    <VisitorGlobe counts={counts} height={380} />
                  </Suspense>
                </div>
                {/* Mobile : pas de défilement imbriqué dans la feuille */}
                <div className="flex-1 w-full space-y-0.5 sm:max-h-[360px] sm:overflow-y-auto sm:pr-2">
                  {stats.byCountry.map((c) => (
                    <div key={c.code} className="flex items-center gap-3 py-2.5 border-b border-stone-100 dark:border-neutral-800">
                      <span className="text-base w-6 text-center">{flagEmoji(c.code)}</span>
                      <span className="text-sm text-stone-700 dark:text-neutral-200 flex-1 min-w-0 max-sm:truncate">{c.code === 'ZZ' ? t.unknown : countryName(c.code, lang)}</span>
                      <div className="h-1 rounded-full bg-red-500" style={{ width: `${Math.max(6, (c.count / maxCountry) * 90)}px` }} />
                      <span className="text-sm font-bold text-red-600 w-8 text-right tabular-nums">{c.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
