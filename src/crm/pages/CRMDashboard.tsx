import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DollarSign, GitBranch, Calendar, UserX, Megaphone, Plug, Key, Webhook, Check, ArrowRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useCRMAuth } from '../contexts/CRMAuthContext'
import { useCRMProspects } from '../contexts/CRMProspectsContext'

const PRIMARY = '#3B82F6'
const SECONDARY = '#60A5FA'

export default function CRMDashboard() {
  const navigate = useNavigate()
  const { user } = useCRMAuth()
  const { prospects, campaigns: allCampaigns, appointments } = useCRMProspects()

  const [apiKeyCount, setApiKeyCount] = useState(0)
  const [webhookCount, setWebhookCount] = useState(0)
  const [googleCalConnected, setGoogleCalConnected] = useState(false)

  const campaigns = useMemo(
    () => allCampaigns.filter(c => c.is_active).map(c => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      is_active: c.is_active,
      leads: c.leads_count || 0,
    })),
    [allCampaigns]
  )

  useEffect(() => {
    if (!user?.id) return
    const load = async () => {
      const [keys, subs, googleCal] = await Promise.all([
        supabase.from('crm_webhook_keys').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_active', true).then(r => r, () => ({ count: 0 })) as any,
        supabase.from('crm_webhook_subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_active', true).then(r => r, () => ({ count: 0 })) as any,
        supabase.from('business_google_tokens').select('user_id').eq('user_id', user.id).maybeSingle().then(r => !!r.data, () => false),
      ])
      setApiKeyCount((keys as any)?.count || 0)
      setWebhookCount((subs as any)?.count || 0)
      setGoogleCalConnected(!!googleCal)
    }
    load()
  }, [user?.id])

  const revenue = useMemo(() => {
    return (prospects || [])
      .filter((p) => p.stage === 'won' && p.value)
      .reduce((sum, p) => sum + Number(p.value || 0), 0)
  }, [prospects])

  const pipelineValue = useMemo(() => {
    return (prospects || [])
      .filter((p) => p.value && p.stage !== 'won' && p.stage !== 'lost' && p.stage !== 'partial')
      .reduce((sum, p) => sum + Number(p.value || 0), 0)
  }, [prospects])

  const appointmentsCount = appointments.length

  const noShowRate = useMemo(() => {
    const past = appointments.filter(a => {
      const d = a.datetime_utc ? new Date(a.datetime_utc) : (a.date ? new Date(a.date) : null)
      return d ? d.getTime() < Date.now() : false
    })
    if (past.length === 0) return 0
    const noShow = past.filter(a => (a.status || '').toLowerCase().includes('no')).length
    return (noShow / past.length) * 100
  }, [appointments])

  const integrations = [
    { name: 'Zapier', logo: '/zapier.webp', connected: apiKeyCount > 0, subtitle: apiKeyCount > 0 ? `${apiKeyCount} clé(s) API active(s)` : 'Créer une clé API' },
    { name: 'Make', logo: '/make.webp', connected: apiKeyCount > 0, subtitle: apiKeyCount > 0 ? 'Via API key' : 'Créer une clé API' },
    { name: 'n8n', logo: '/n8n.webp', connected: apiKeyCount > 0, subtitle: apiKeyCount > 0 ? 'Via API key' : 'Créer une clé API' },
    { name: 'Webhooks sortants', logo: null, icon: Webhook, connected: webhookCount > 0, subtitle: webhookCount > 0 ? `${webhookCount} abonnement(s)` : 'Aucune URL abonnée' },
    { name: 'Google Calendar', logo: '/gcalendar.webp', connected: googleCalConnected, subtitle: googleCalConnected ? 'Connecté' : 'Non connecté' },
  ]

  const campaignColors = ['#3B82F6', '#60A5FA', '#7DD3FC', '#10B981', '#A855F7', '#EC4899']

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<DollarSign className="h-5 w-5 text-emerald-600" />}
          iconBg="bg-emerald-100"
          title="Revenue"
          value={`${Math.round(revenue).toLocaleString('fr-FR')} €`}
          trend="+0%"
          trendColor="bg-emerald-50 text-emerald-700"
        />
        <KpiCard
          icon={<GitBranch className="h-5 w-5 text-[#1D4ED8]" />}
          iconBg="bg-[#DBEAFE]"
          title="Pipeline"
          value={`${Math.round(pipelineValue).toLocaleString('fr-FR')} €`}
        />
        <KpiCard
          icon={<Calendar className="h-5 w-5 text-[#1b1c1b]" />}
          iconBg="bg-stone-100"
          title="Rendez-vous"
          value={String(appointmentsCount)}
        />
        <KpiCard
          icon={<UserX className="h-5 w-5 text-orange-500" />}
          iconBg="bg-orange-50"
          title="No-show"
          value={`${noShowRate.toFixed(1).replace('.0', '')}%`}
        />
      </div>

      {/* Campagnes actives */}
      <section className="bg-white rounded-3xl border border-blue-100 p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-extrabold text-[#0A0E27]" style={{ fontFamily: 'Manrope, sans-serif' }}>Campagnes actives</h2>
            <p className="text-xs text-stone-500 mt-0.5">Performance en temps réel des flux actifs.</p>
          </div>
          <button onClick={() => navigate('/crm/campagnes')} className="text-xs font-bold tracking-widest uppercase text-[#0A0E27] border-b border-[#0A0E27] pb-0.5">Tous</button>
        </div>
        {campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Megaphone className="h-8 w-8 text-stone-300 mb-3" />
            <p className="text-sm text-stone-500 mb-4">Aucune campagne active pour l'instant.</p>
            <button onClick={() => navigate('/crm/campagnes')} className="px-5 py-2 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] text-white text-xs font-bold inline-flex items-center gap-1.5">
              Créer une campagne <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {campaigns.map((c, i) => {
              const color = campaignColors[i % campaignColors.length]
              return (
                <div key={c.id} className="flex items-center gap-4 p-4 rounded-2xl border border-blue-50 hover:border-blue-100 hover:bg-blue-50/40 transition-colors">
                  <div className="h-10 w-10 rounded-full flex items-center justify-center shrink-0" style={{ background: `${color}1a` }}>
                    <Megaphone className="h-4 w-4" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-[#0A0E27] truncate">{c.name}</p>
                    <p className="text-[11px] uppercase tracking-widest text-stone-400 font-bold">{c.leads} lead{(c.leads || 0) > 1 ? 's' : ''}</p>
                  </div>
                  <span className="text-sm font-bold text-[#0A0E27]">{c.leads}</span>
                  <span className="px-3 py-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-widest">Live</span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Intégrations en cours */}
      <section className="bg-white rounded-3xl border border-blue-100 p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-extrabold text-[#0A0E27]" style={{ fontFamily: 'Manrope, sans-serif' }}>Intégrations en cours</h2>
            <p className="text-xs text-stone-500 mt-0.5">Tous les outils connectés à votre CRM.</p>
          </div>
          <button onClick={() => navigate('/crm/integrations')} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0A0E27] hover:opacity-70">
            Gérer <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {integrations.map((i) => (
            <div key={i.name} className={`rounded-2xl p-4 border ${i.connected ? 'border-emerald-200 bg-emerald-50/40' : 'border-blue-100 bg-stone-50/40'}`}>
              <div className="flex items-start justify-between mb-3">
                {i.logo ? (
                  <img src={i.logo} alt={i.name} className="h-7 w-7 object-contain" />
                ) : i.icon ? (
                  <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: `${PRIMARY}20`, color: PRIMARY }}>
                    <i.icon className="h-4 w-4" />
                  </div>
                ) : null}
                {i.connected ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-extrabold uppercase tracking-widest">
                    <Check className="h-2.5 w-2.5" /> Actif
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-stone-200 text-stone-500 text-[9px] font-extrabold uppercase tracking-widest">Off</span>
                )}
              </div>
              <p className="font-bold text-sm text-[#0A0E27] mb-0.5" style={{ fontFamily: 'Manrope, sans-serif' }}>{i.name}</p>
              <p className="text-[11px] text-stone-500 leading-relaxed">{i.subtitle}</p>
            </div>
          ))}
        </div>

        {/* API + Webhooks summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          <div className="rounded-2xl p-4 border border-[#3B82F6]/30 bg-gradient-to-br from-[#3B82F6]/10 to-[#60A5FA]/5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${PRIMARY}30` }}>
              <Key className="h-4 w-4" style={{ color: '#2563EB' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: '#2563EB' }}>API REST</p>
              <p className="text-sm font-bold text-[#0A0E27]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {apiKeyCount > 0 ? `${apiKeyCount} clé${apiKeyCount > 1 ? 's' : ''} active${apiKeyCount > 1 ? 's' : ''}` : 'Aucune clé API'}
              </p>
            </div>
            <button onClick={() => navigate('/crm/integrations')} className="text-[11px] font-bold text-[#2563EB]">Gérer →</button>
          </div>
          <div className="rounded-2xl p-4 border border-[#60A5FA]/30 bg-gradient-to-br from-[#60A5FA]/10 to-[#60A5FA]/5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${SECONDARY}30` }}>
              <Webhook className="h-4 w-4" style={{ color: '#1D4ED8' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: '#1D4ED8' }}>Webhooks sortants</p>
              <p className="text-sm font-bold text-[#0A0E27]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {webhookCount > 0 ? `${webhookCount} abonnement${webhookCount > 1 ? 's' : ''}` : 'Aucun webhook'}
              </p>
            </div>
            <button onClick={() => navigate('/crm/integrations')} className="text-[11px] font-bold text-[#1D4ED8]">Gérer →</button>
          </div>
        </div>
      </section>
    </div>
  )
}

function KpiCard({ icon, iconBg, title, value, trend, trendColor }: {
  icon: React.ReactNode
  iconBg: string
  title: string
  value: string
  trend?: string
  trendColor?: string
}) {
  return (
    <div className="bg-white rounded-3xl p-5 border border-blue-50 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${iconBg}`}>{icon}</div>
        {trend && trendColor && (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${trendColor}`}>{trend}</span>
        )}
      </div>
      <p className="text-[10px] font-extrabold uppercase tracking-widest text-stone-400 mb-1.5">{title}</p>
      <p className="text-2xl font-extrabold text-[#0A0E27]" style={{ fontFamily: 'Manrope, sans-serif' }}>{value}</p>
    </div>
  )
}
