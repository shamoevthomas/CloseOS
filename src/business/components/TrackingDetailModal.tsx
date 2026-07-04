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
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-stone-900/50 backdrop-blur-md p-4 overflow-y-auto">
      <div className="w-full max-w-4xl my-8 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl rounded-2xl shadow-[0_20px_60px_rgba(27,28,27,0.15)] border border-stone-200/20 dark:border-neutral-700 p-8 relative animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-stone-400 dark:text-neutral-500 hover:text-stone-700 dark:hover:text-neutral-200 transition-colors z-10"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="mb-8 pr-8">
          <h2 className="text-3xl font-extrabold tracking-tight text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {linkName}
          </h2>
          {shortUrl && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs font-mono text-stone-400 dark:text-neutral-500">{shortUrl}</span>
              <button onClick={handleCopy} className="text-stone-400 hover:text-red-600 transition-colors">
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 text-stone-400 dark:text-neutral-500 animate-spin" />
          </div>
        ) : !stats || stats.clicks === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-stone-400 dark:text-neutral-500">
            <Globe className="h-12 w-12 mb-3 opacity-40" />
            <p className="text-sm">{t.no_data}</p>
          </div>
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
              <div className="bg-stone-50 dark:bg-white/5 border border-stone-200/60 dark:border-neutral-700/40 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <MousePointerClick className="h-4 w-4 text-red-600" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-stone-500 dark:text-neutral-400">{t.clicks}</span>
                </div>
                <div className="text-3xl font-extrabold text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>{stats.clicks}</div>
              </div>
              <div className="bg-stone-50 dark:bg-white/5 border border-stone-200/60 dark:border-neutral-700/40 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-blue-600" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-stone-500 dark:text-neutral-400">{t.unique}</span>
                </div>
                <div className="text-3xl font-extrabold text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>{stats.uniqueVisitors}</div>
              </div>
              <div className="bg-stone-50 dark:bg-white/5 border border-stone-200/60 dark:border-neutral-700/40 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Repeat className="h-4 w-4 text-amber-600" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-stone-500 dark:text-neutral-400">{t.recurring}</span>
                </div>
                <div className="text-3xl font-extrabold text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>{stats.recurringVisitors}</div>
                <div className="text-xs text-stone-400 dark:text-neutral-500 mt-1">{stats.newVisitors} {t.neww.toLowerCase()}</div>
              </div>
              <div className="bg-stone-50 dark:bg-white/5 border border-stone-200/60 dark:border-neutral-700/40 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4 text-emerald-600" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-stone-500 dark:text-neutral-400">{t.avg_time}</span>
                </div>
                {stats.hasDurationData ? (
                  <div className="text-3xl font-extrabold text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>{formatDuration(stats.avgDuration)}</div>
                ) : (
                  <div className="text-xs text-stone-400 dark:text-neutral-500 leading-snug pt-1">{t.no_time}</div>
                )}
              </div>
            </div>

            {/* Visiteurs par pays : globe + liste (fond blanc) */}
            <div className="bg-white dark:bg-white/5 rounded-2xl p-8 border border-stone-200/60 dark:border-neutral-700/40">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-extrabold text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>{t.by_country}</h3>
                <span className="text-xs text-stone-400 dark:text-neutral-500 uppercase tracking-widest">
                  {realCountries.length} {realCountries.length === 1 ? t.country : t.countries}
                </span>
              </div>
              <div className="flex flex-col lg:flex-row items-center gap-8">
                <div className="shrink-0 w-full lg:w-[420px]">
                  <Suspense fallback={<div className="h-[380px] flex items-center justify-center"><Loader2 className="h-6 w-6 text-stone-300 animate-spin" /></div>}>
                    <VisitorGlobe counts={counts} height={380} />
                  </Suspense>
                </div>
                <div className="flex-1 w-full space-y-0.5 max-h-[360px] overflow-y-auto pr-2">
                  {stats.byCountry.map((c) => (
                    <div key={c.code} className="flex items-center gap-3 py-2.5 border-b border-stone-100 dark:border-neutral-800">
                      <span className="text-base w-6 text-center">{flagEmoji(c.code)}</span>
                      <span className="text-sm text-stone-700 dark:text-neutral-200 flex-1">{c.code === 'ZZ' ? t.unknown : countryName(c.code, lang)}</span>
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
