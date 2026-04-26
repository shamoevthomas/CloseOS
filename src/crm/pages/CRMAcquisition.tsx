import { useMemo, useState } from 'react'
import { TrendingUp, Filter, ArrowUpRight, ArrowDownRight, Megaphone, Globe, Users } from 'lucide-react'
import { useCRMProspects } from '../contexts/CRMProspectsContext'

type Period = '7d' | '30d' | '90d' | 'all'

const PERIODS: { id: Period; label: string }[] = [
  { id: '7d', label: '7 jours' },
  { id: '30d', label: '30 jours' },
  { id: '90d', label: '90 jours' },
  { id: 'all', label: 'Tout' },
]

function periodCutoff(period: Period): number {
  const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 0
  return days === 0 ? 0 : Date.now() - days * 24 * 60 * 60 * 1000
}

export default function CRMAcquisition() {
  const { prospects, campaigns } = useCRMProspects()
  const [period, setPeriod] = useState<Period>('30d')

  const cutoff = periodCutoff(period)

  const inPeriod = useMemo(
    () => prospects.filter(p => !cutoff || (p.created_at && new Date(p.created_at).getTime() >= cutoff)),
    [prospects, cutoff]
  )

  const totalLeads = inPeriod.length
  const wonLeads = inPeriod.filter(p => p.stage === 'won').length
  const conversion = totalLeads > 0 ? (wonLeads / totalLeads) * 100 : 0
  const revenue = inPeriod.filter(p => p.stage === 'won').reduce((s, p) => s + Number(p.value || 0), 0)

  // Per source
  const bySource = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number; won: number }>()
    for (const p of inPeriod) {
      const key = p.source || p.utm_source || 'Direct'
      const existing = map.get(key) || { count: 0, revenue: 0, won: 0 }
      existing.count += 1
      if (p.stage === 'won') {
        existing.won += 1
        existing.revenue += Number(p.value || 0)
      }
      map.set(key, existing)
    }
    return Array.from(map.entries())
      .map(([source, stats]) => ({ source, ...stats, conversion: stats.count ? (stats.won / stats.count) * 100 : 0 }))
      .sort((a, b) => b.count - a.count)
  }, [inPeriod])

  // Per campaign
  const byCampaign = useMemo(() => {
    return campaigns.map(c => {
      const camp = inPeriod.filter(p => p.campaign_id === c.id)
      const won = camp.filter(p => p.stage === 'won').length
      const rev = camp.filter(p => p.stage === 'won').reduce((s, p) => s + Number(p.value || 0), 0)
      return {
        id: c.id,
        name: c.name,
        leads: camp.length,
        won,
        revenue: rev,
        conversion: camp.length ? (won / camp.length) * 100 : 0,
      }
    }).filter(c => c.leads > 0).sort((a, b) => b.leads - a.leads)
  }, [campaigns, inPeriod])

  return (
    <div className="min-h-full bg-white">
      <div className="border-b border-blue-100 bg-gradient-to-b from-blue-50/30 to-white">
        <div className="px-6 md:px-10 pt-8 pb-6 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-600 mb-2">Acquisition</p>
              <h1 className="text-3xl md:text-4xl font-bold text-[#0A0E27] tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                D'où viennent vos clients ?
              </h1>
              <p className="text-stone-500 text-sm mt-1">
                Sources, campagnes, ROI — pour savoir où concentrer vos efforts.
              </p>
            </div>
            <PeriodSelector period={period} onChange={setPeriod} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Leads" value={totalLeads} accent="text-[#0A0E27]" icon={<Users className="size-4 text-blue-600" />} />
            <KpiCard label="Gagnés" value={wonLeads} accent="text-emerald-600" icon={<ArrowUpRight className="size-4 text-emerald-600" />} />
            <KpiCard label="Conversion" value={`${conversion.toFixed(1)}%`} accent="text-violet-600" icon={<TrendingUp className="size-4 text-violet-600" />} />
            <KpiCard
              label="CA généré"
              value={`${revenue.toLocaleString('fr-FR')}€`}
              accent="bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] bg-clip-text text-transparent"
              icon={<TrendingUp className="size-4 text-blue-600" />}
            />
          </div>
        </div>
      </div>

      <div className="px-6 md:px-10 py-6 max-w-7xl mx-auto space-y-6">
        {/* Sources */}
        <Section title="Sources d'acquisition" subtitle="Où vos prospects vous trouvent" icon={<Globe className="size-4 text-blue-600" />}>
          {bySource.length === 0 ? (
            <Empty label="Aucune donnée pour cette période" />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-blue-100 bg-white">
              <div className="hidden md:grid md:grid-cols-[1fr_120px_120px_140px_120px] gap-4 px-5 py-3 border-b border-blue-100 bg-blue-50/30 text-[10px] font-bold uppercase tracking-widest text-stone-500">
                <span>Source</span>
                <span>Leads</span>
                <span>Gagnés</span>
                <span>Conversion</span>
                <span>Revenue</span>
              </div>
              <ul>
                {bySource.map((row, i) => (
                  <li key={row.source + i} className="grid grid-cols-1 md:grid-cols-[1fr_120px_120px_140px_120px] gap-2 md:gap-4 px-5 py-3 border-b border-blue-50 last:border-0 items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
                        <Globe className="size-3.5 text-blue-600" />
                      </div>
                      <span className="text-sm font-bold text-[#0A0E27]">{row.source}</span>
                    </div>
                    <span className="text-sm font-semibold text-[#0A0E27]">{row.count}</span>
                    <span className="text-sm font-semibold text-emerald-600">{row.won}</span>
                    <ConversionBar value={row.conversion} />
                    <span className="text-sm font-extrabold text-[#0A0E27]">{row.revenue.toLocaleString('fr-FR')}€</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        {/* Per campaign */}
        <Section title="Performance par campagne" subtitle="ROI par page de capture" icon={<Megaphone className="size-4 text-blue-600" />}>
          {byCampaign.length === 0 ? (
            <Empty label="Aucune campagne avec leads sur cette période" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {byCampaign.map(c => (
                <div key={c.id} className="rounded-2xl border border-blue-100 bg-white p-4 hover:shadow-md hover:shadow-blue-500/10 transition-all">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#60A5FA] flex items-center justify-center shadow-sm shadow-blue-500/20">
                      <Megaphone className="size-4 text-white" />
                    </div>
                    <h4 className="text-sm font-bold text-[#0A0E27] truncate flex-1">{c.name}</h4>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-blue-50/50 border border-blue-100 py-2">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-stone-500">Leads</p>
                      <p className="text-lg font-extrabold text-[#0A0E27]">{c.leads}</p>
                    </div>
                    <div className="rounded-lg bg-emerald-50/50 border border-emerald-100 py-2">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-stone-500">Gagnés</p>
                      <p className="text-lg font-extrabold text-emerald-600">{c.won}</p>
                    </div>
                    <div className="rounded-lg bg-violet-50/50 border border-violet-100 py-2">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-stone-500">Conv.</p>
                      <p className="text-lg font-extrabold text-violet-600">{c.conversion.toFixed(0)}%</p>
                    </div>
                  </div>
                  {c.revenue > 0 && (
                    <p className="text-center mt-3 text-sm font-extrabold bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] bg-clip-text text-transparent">
                      {c.revenue.toLocaleString('fr-FR')}€
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}

function PeriodSelector({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-full bg-blue-50/60 border border-blue-100">
      {PERIODS.map(p => (
        <button
          key={p.id}
          onClick={() => onChange(p.id)}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
            period === p.id
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-stone-500 hover:text-[#0A0E27]'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}

function KpiCard({ label, value, accent, icon }: { label: string; value: string | number; accent: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-blue-100 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">{label}</p>
        {icon}
      </div>
      <p className={`text-2xl font-extrabold tracking-tight ${accent}`} style={{ fontFamily: 'Manrope, sans-serif' }}>
        {value}
      </p>
    </div>
  )
}

function Section({ title, subtitle, icon, children }: { title: string; subtitle?: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <div>
          <h2 className="text-base font-bold text-[#0A0E27]" style={{ fontFamily: 'Manrope, sans-serif' }}>{title}</h2>
          {subtitle && <p className="text-xs text-stone-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/20 py-10 text-center">
      <p className="text-sm text-stone-500">{label}</p>
    </div>
  )
}

function ConversionBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-blue-100 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] rounded-full"
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className="text-xs font-bold text-blue-600 w-10 text-right">{value.toFixed(0)}%</span>
    </div>
  )
}
