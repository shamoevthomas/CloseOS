import { useEffect, useState } from 'react'
import { Loader2, Copy, Plus, Trash2, Key, Webhook, Zap, Check, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useCRMAuth } from '../contexts/CRMAuthContext'

const PRIMARY = '#3B82F6'
const SECONDARY = '#60A5FA'

const AVAILABLE_EVENTS = [
  { id: 'prospect.created', label: 'Nouveau prospect créé' },
  { id: 'prospect.updated', label: 'Prospect mis à jour' },
  { id: 'prospect.stage_changed', label: 'Stage du prospect modifié' },
  { id: 'appointment.booked', label: 'Rendez-vous réservé' },
  { id: 'campaign.lead_captured', label: 'Lead capturé via campagne' },
]

interface WebhookKey {
  id: string
  api_key: string
  label: string | null
  is_active: boolean
  last_used_at: string | null
  created_at: string
}

interface WebhookSubscription {
  id: string
  url: string
  events: string[]
  secret: string
  is_active: boolean
  last_triggered_at: string | null
  last_status: number | null
  created_at: string
}

export default function CRMIntegrations() {
  const { user } = useCRMAuth()
  const [keys, setKeys] = useState<WebhookKey[]>([])
  const [subs, setSubs] = useState<WebhookSubscription[]>([])
  const [loading, setLoading] = useState(true)
  const [newLabel, setNewLabel] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [newEvents, setNewEvents] = useState<string[]>(['prospect.created'])
  const [copied, setCopied] = useState<string | null>(null)

  const base = typeof window !== 'undefined' ? window.location.origin : 'https://closeos.fr'

  useEffect(() => {
    if (!user) return
    refresh()
  }, [user?.id])

  const refresh = async () => {
    setLoading(true)
    const [keysRes, subsRes] = await Promise.all([
      supabase.from('crm_webhook_keys').select('*').order('created_at', { ascending: false }),
      supabase.from('crm_webhook_subscriptions').select('*').order('created_at', { ascending: false }),
    ])
    setKeys((keysRes.data as WebhookKey[]) || [])
    setSubs((subsRes.data as WebhookSubscription[]) || [])
    setLoading(false)
  }

  const createKey = async () => {
    if (!user) return
    await supabase.from('crm_webhook_keys').insert({ user_id: user.id, label: newLabel || 'Default' })
    setNewLabel('')
    refresh()
  }

  const revokeKey = async (id: string) => {
    if (!confirm('Révoquer cette clé ? Les intégrations qui l\'utilisent cesseront de fonctionner.')) return
    await supabase.from('crm_webhook_keys').delete().eq('id', id)
    refresh()
  }

  const createSubscription = async () => {
    if (!user || !newUrl.trim()) return
    await supabase.from('crm_webhook_subscriptions').insert({
      user_id: user.id,
      url: newUrl.trim(),
      events: newEvents,
    })
    setNewUrl('')
    setNewEvents(['prospect.created'])
    refresh()
  }

  const deleteSubscription = async (id: string) => {
    if (!confirm('Supprimer cet abonnement webhook ?')) return
    await supabase.from('crm_webhook_subscriptions').delete().eq('id', id)
    refresh()
  }

  const toggleEvent = (eventId: string) => {
    setNewEvents(prev => prev.includes(eventId) ? prev.filter(e => e !== eventId) : [...prev, eventId])
  }

  const copy = async (text: string, tag: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(tag)
    setTimeout(() => setCopied(null), 1500)
  }

  const activeKey = keys.find(k => k.is_active)?.api_key

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-10 space-y-10">
      {/* API keys */}
      <section>
        <div className="flex items-center gap-3 mb-2">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: `${PRIMARY}20` }}>
            <Key className="h-4 w-4" style={{ color: PRIMARY }} />
          </div>
          <h2 className="text-2xl font-extrabold text-[#111111]" style={{ fontFamily: 'Manrope, sans-serif' }}>Clés API</h2>
        </div>
        <p className="text-sm text-[#444748] mb-6">Autorisez des outils externes à créer des prospects dans votre CRM via API.</p>

        <div className="bg-white rounded-2xl border border-[#eae8e7] p-5 mb-4">
          <div className="flex gap-2">
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Label (ex: Zapier, Make, prod)"
              className="flex-1 px-4 py-2.5 rounded-lg border border-[#c4c7c7]/30 text-sm focus:border-[#3B82F6] outline-none" />
            <button onClick={createKey} className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-white font-bold text-sm"
              style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${SECONDARY} 100%)` }}>
              <Plus className="h-4 w-4" /> Créer une clé
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-[#3B82F6]" /></div>
        ) : keys.length === 0 ? (
          <p className="text-sm text-[#747878] py-4">Aucune clé API. Créez-en une pour démarrer.</p>
        ) : (
          <div className="space-y-2">
            {keys.map((k) => (
              <div key={k.id} className="bg-white rounded-2xl border border-[#eae8e7] p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm text-[#0A0E27]">{k.label || 'Default'}</span>
                    {k.is_active ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Active</span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Disabled</span>
                    )}
                  </div>
                  <code className="text-xs text-[#444748] font-mono break-all">{k.api_key}</code>
                </div>
                <button onClick={() => copy(k.api_key, `key-${k.id}`)} className="p-2 hover:bg-[#f5f3f2] rounded-lg" title="Copier">
                  {copied === `key-${k.id}` ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-[#444748]" />}
                </button>
                <button onClick={() => revokeKey(k.id)} className="p-2 hover:bg-red-50 text-red-600 rounded-lg" title="Révoquer">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Inbound endpoint */}
      <section>
        <div className="flex items-center gap-3 mb-2">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: `${SECONDARY}20` }}>
            <Zap className="h-4 w-4" style={{ color: SECONDARY }} />
          </div>
          <h2 className="text-2xl font-extrabold text-[#111111]" style={{ fontFamily: 'Manrope, sans-serif' }}>Créer un prospect via API</h2>
        </div>
        <p className="text-sm text-[#444748] mb-6">Envoyez un POST depuis Zapier, Make, N8N, ou tout outil HTTP.</p>

        <div className="bg-[#1b1c1b] rounded-2xl p-5 text-white overflow-x-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-widest text-[#3B82F6]">curl</span>
            <button onClick={() => copy(curlSnippet(base, activeKey || 'YOUR_API_KEY'), 'curl')}
              className="flex items-center gap-1.5 text-xs font-bold text-white/70 hover:text-white">
              {copied === 'curl' ? <><Check className="h-3 w-3" /> Copié</> : <><Copy className="h-3 w-3" /> Copier</>}
            </button>
          </div>
          <pre className="text-xs leading-relaxed"><code>{curlSnippet(base, activeKey || 'YOUR_API_KEY')}</code></pre>
        </div>
      </section>

      {/* Webhook subscriptions */}
      <section>
        <div className="flex items-center gap-3 mb-2">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: `${PRIMARY}20` }}>
            <Webhook className="h-4 w-4" style={{ color: PRIMARY }} />
          </div>
          <h2 className="text-2xl font-extrabold text-[#111111]" style={{ fontFamily: 'Manrope, sans-serif' }}>Webhooks sortants</h2>
        </div>
        <p className="text-sm text-[#444748] mb-6">Soyez notifié sur une URL externe (Zapier, N8N, webhook.site…) à chaque événement.</p>

        <div className="bg-white rounded-2xl border border-[#eae8e7] p-5 mb-4 space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/60">URL cible</label>
            <input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://hooks.zapier.com/hooks/catch/..."
              className="w-full px-4 py-2.5 rounded-lg border border-[#c4c7c7]/30 text-sm mt-1 focus:border-[#3B82F6] outline-none" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/60">Événements</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {AVAILABLE_EVENTS.map(e => (
                <button key={e.id} onClick={() => toggleEvent(e.id)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-full border-2 transition-colors ${newEvents.includes(e.id) ? 'border-[#3B82F6] bg-[#3B82F6]/10 text-[#0A0E27]' : 'border-[#c4c7c7]/30 text-[#747878] hover:border-[#3B82F6]/50'}`}>
                  {newEvents.includes(e.id) && '✓ '}{e.label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={createSubscription} disabled={!newUrl.trim() || newEvents.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-white font-bold text-sm disabled:opacity-40"
            style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${SECONDARY} 100%)` }}>
            <Plus className="h-4 w-4" /> Ajouter un webhook
          </button>
        </div>

        {subs.length === 0 ? (
          <p className="text-sm text-[#747878] py-4">Aucun webhook sortant configuré.</p>
        ) : (
          <div className="space-y-2">
            {subs.map((s) => (
              <div key={s.id} className="bg-white rounded-2xl border border-[#eae8e7] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <code className="text-sm font-mono text-[#0A0E27] break-all">{s.url}</code>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {s.events.map(e => (
                        <span key={e} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#3B82F6]/10 text-[#2563EB]">{e}</span>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-[#747878]">
                      <span>Secret: <code className="font-mono">{s.secret.slice(0, 12)}…</code></span>
                      {s.last_triggered_at && (
                        <span>
                          Dernier envoi: {new Date(s.last_triggered_at).toLocaleString('fr')}
                          {s.last_status != null && (
                            <span className={`ml-1 font-bold ${s.last_status >= 200 && s.last_status < 300 ? 'text-green-600' : 'text-red-600'}`}>
                              [{s.last_status}]
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => deleteSubscription(s.id)} className="p-2 hover:bg-red-50 text-red-600 rounded-lg">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Native integrations guide */}
      <section>
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-2xl font-extrabold text-[#111111]" style={{ fontFamily: 'Manrope, sans-serif' }}>Guides d'intégration</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4 mt-4">
          <IntegrationCard name="Zapier" color="#FF4A00" instructions={[
            'Créez un Zap avec "Webhooks by Zapier" en trigger',
            'Collez l\'URL webhook générée dans un webhook sortant CloseOS',
            'Pour créer un prospect : ajoutez une action "Webhooks by Zapier" → POST vers notre endpoint avec votre clé API',
          ]} />
          <IntegrationCard name="Make (Integromat)" color="#6D4AFF" instructions={[
            'Ajoutez un module HTTP dans votre scénario',
            'Pour écouter : créez un webhook Make et collez son URL dans CloseOS',
            'Pour créer : POST vers notre endpoint, header Authorization: Bearer <votre clé>',
          ]} />
          <IntegrationCard name="N8N" color="#EF6C00" instructions={[
            'Utilisez le node "Webhook" pour recevoir les événements',
            'Utilisez le node "HTTP Request" pour créer des prospects',
            'Authentification : Header Auth → Authorization / Bearer <votre clé>',
          ]} />
        </div>
      </section>

      {/* Events reference */}
      <section className="rounded-2xl border border-[#eae8e7] bg-white p-6">
        <h3 className="text-lg font-extrabold text-[#111111] mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>Événements disponibles</h3>
        <p className="text-sm text-[#444748] mb-4">Chaque event envoie un POST JSON signé HMAC-SHA256 via le header <code className="text-xs bg-[#f5f3f2] px-1 py-0.5 rounded">X-CloseOS-Signature</code>.</p>
        <div className="space-y-2 text-sm">
          {AVAILABLE_EVENTS.map(e => (
            <div key={e.id} className="flex items-center gap-3">
              <code className="text-xs font-mono px-2 py-1 rounded bg-[#3B82F6]/10 text-[#2563EB] font-bold">{e.id}</code>
              <span className="text-[#444748]">{e.label}</span>
            </div>
          ))}
        </div>
      </section>

      {!activeKey && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Créez d'abord une clé API pour voir le snippet curl actif.</span>
        </div>
      )}
    </div>
  )
}

function curlSnippet(base: string, apiKey: string) {
  return `curl -X POST "${base}/api/zapier-webhook?type=crm" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "firstName": "Jean",
    "lastName": "Dupont",
    "email": "jean@exemple.com",
    "phone": "+33612345678",
    "source": "Zapier"
  }'`
}

function IntegrationCard({ name, color, instructions }: { name: string; color: string; instructions: string[] }) {
  return (
    <div className="rounded-2xl border border-[#eae8e7] bg-white p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-black text-xs" style={{ background: color }}>
          {name.charAt(0)}
        </div>
        <h4 className="font-extrabold text-[#0A0E27]" style={{ fontFamily: 'Manrope, sans-serif' }}>{name}</h4>
      </div>
      <ol className="space-y-2 text-xs text-[#444748] list-decimal list-inside leading-relaxed">
        {instructions.map((i, idx) => <li key={idx}>{i}</li>)}
      </ol>
    </div>
  )
}
