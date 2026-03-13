import { useState, useEffect, useCallback } from 'react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import {
  Plus, Megaphone, Code, Pencil, Trash2, X, Loader2,
  ToggleLeft, ToggleRight, Link, Users, ChevronDown, Video
} from 'lucide-react'
import toast from 'react-hot-toast'

interface CustomField {
  label: string
  type: 'text' | 'email' | 'phone' | 'number' | 'select'
  required: boolean
  options?: string[]
}

interface Campaign {
  id: string
  name: string
  description: string | null
  source: string
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  custom_fields: CustomField[]
  is_active: boolean
  slug: string
  landing_title: string | null
  landing_subtitle: string | null
  landing_text: string | null
  landing_video_url: string | null
  email_required: boolean
  phone_required: boolean
  created_at: string
  business_prospects: { count: number }[]
}

const SOURCES = ['Direct', 'Google Ads', 'Facebook Ads', 'Instagram', 'LinkedIn', 'Email', 'Autre']

const API_URL = '/api/business'

export function BusinessCampaigns() {
  const { user } = useBusinessAuth()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
  const [saving, setSaving] = useState(false)
  const [modalTab, setModalTab] = useState<'general' | 'landing' | 'fields'>('general')

  // Form state - General
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formSource, setFormSource] = useState('Direct')
  const [formUtmSource, setFormUtmSource] = useState('')
  const [formUtmMedium, setFormUtmMedium] = useState('')
  const [formUtmCampaign, setFormUtmCampaign] = useState('')

  // Form state - Landing page
  const [formLandingTitle, setFormLandingTitle] = useState('')
  const [formLandingSubtitle, setFormLandingSubtitle] = useState('')
  const [formLandingText, setFormLandingText] = useState('')
  const [formLandingVideoUrl, setFormLandingVideoUrl] = useState('')

  // Form state - Fields config
  const [formEmailRequired, setFormEmailRequired] = useState(true)
  const [formPhoneRequired, setFormPhoneRequired] = useState(false)
  const [formCustomFields, setFormCustomFields] = useState<CustomField[]>([])

  const fetchCampaigns = useCallback(async () => {
    if (!user?.id) return
    try {
      const res = await fetch(`${API_URL}?action=campaigns-list&user_id=${user.id}`)
      const data = await res.json()
      if (data.campaigns) setCampaigns(data.campaigns)
    } catch (err) {
      console.error('Error fetching campaigns:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])

  const resetForm = () => {
    setFormName(''); setFormDescription(''); setFormSource('Direct')
    setFormUtmSource(''); setFormUtmMedium(''); setFormUtmCampaign('')
    setFormLandingTitle(''); setFormLandingSubtitle(''); setFormLandingText(''); setFormLandingVideoUrl('')
    setFormEmailRequired(true); setFormPhoneRequired(false)
    setFormCustomFields([]); setEditingCampaign(null); setModalTab('general')
  }

  const openCreate = () => { resetForm(); setIsModalOpen(true) }

  const openEdit = (campaign: Campaign) => {
    setEditingCampaign(campaign)
    setFormName(campaign.name); setFormDescription(campaign.description || '')
    setFormSource(campaign.source || 'Direct')
    setFormUtmSource(campaign.utm_source || ''); setFormUtmMedium(campaign.utm_medium || '')
    setFormUtmCampaign(campaign.utm_campaign || '')
    setFormLandingTitle(campaign.landing_title || ''); setFormLandingSubtitle(campaign.landing_subtitle || '')
    setFormLandingText(campaign.landing_text || ''); setFormLandingVideoUrl(campaign.landing_video_url || '')
    setFormEmailRequired(campaign.email_required ?? true); setFormPhoneRequired(campaign.phone_required ?? false)
    setFormCustomFields(campaign.custom_fields || [])
    setModalTab('general'); setIsModalOpen(true)
  }

  const getPayload = () => ({
    user_id: user?.id, name: formName, description: formDescription, source: formSource,
    utm_source: formUtmSource || null, utm_medium: formUtmMedium || null, utm_campaign: formUtmCampaign || null,
    custom_fields: formCustomFields,
    landing_title: formLandingTitle || null, landing_subtitle: formLandingSubtitle || null,
    landing_text: formLandingText || null, landing_video_url: formLandingVideoUrl || null,
    email_required: formEmailRequired, phone_required: formPhoneRequired,
  })

  const handleSave = async () => {
    if (!formName.trim()) return toast.error('Le nom est requis')
    setSaving(true)
    try {
      const payload = getPayload()
      if (editingCampaign) {
        const res = await fetch(`${API_URL}?action=campaigns-update`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, id: editingCampaign.id }),
        })
        const data = await res.json()
        if (data.campaign) toast.success('Campagne modifiée')
        else toast.error(data.error || 'Erreur')
      } else {
        const res = await fetch(`${API_URL}?action=campaigns-create`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (data.campaign) toast.success('Campagne créée')
        else toast.error(data.error || 'Erreur')
      }
      setIsModalOpen(false); resetForm(); fetchCampaigns()
    } catch { toast.error('Erreur réseau') }
    finally { setSaving(false) }
  }

  const toggleActive = async (campaign: Campaign) => {
    try {
      await fetch(`${API_URL}?action=campaigns-update`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.id, id: campaign.id, is_active: !campaign.is_active }),
      })
      fetchCampaigns()
      toast.success(campaign.is_active ? 'Campagne désactivée' : 'Campagne activée')
    } catch { toast.error('Erreur') }
  }

  const deleteCampaign = async (campaign: Campaign) => {
    if (!confirm(`Supprimer la campagne "${campaign.name}" ?`)) return
    try {
      await fetch(`${API_URL}?action=campaigns-delete&id=${campaign.id}&user_id=${user?.id}`, { method: 'DELETE' })
      toast.success('Campagne supprimée'); fetchCampaigns()
    } catch { toast.error('Erreur') }
  }

  const getCaptureUrl = (slug: string) => `${window.location.origin}/capture/${slug}`
  const getIframeCode = (slug: string) =>
    `<iframe src="${getCaptureUrl(slug)}?embed=true" width="100%" height="800" frameborder="0"></iframe>`

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text); toast.success(`${label} copié !`)
  }

  const addCustomField = () => {
    setFormCustomFields([...formCustomFields, { label: '', type: 'text', required: false }])
  }
  const updateCustomField = (index: number, updates: Partial<CustomField>) => {
    const fields = [...formCustomFields]; fields[index] = { ...fields[index], ...updates }; setFormCustomFields(fields)
  }
  const removeCustomField = (index: number) => {
    setFormCustomFields(formCustomFields.filter((_, i) => i !== index))
  }

  const inputCls = "w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
  const selectCls = "w-full appearance-none rounded-xl border border-slate-200 px-4 py-2.5 pr-10 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
  const smallInputCls = "rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none"

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 text-amber-600 animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
            <Megaphone className="h-5 w-5 text-amber-700" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{campaigns.length} campagne{campaigns.length !== 1 ? 's' : ''}</h2>
            <p className="text-xs text-slate-500">Gérez vos campagnes de capture de leads</p>
          </div>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-700 transition-colors">
          <Plus className="h-4 w-4" /> Nouvelle campagne
        </button>
      </div>

      {/* Empty state */}
      {campaigns.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/50 py-16">
          <Megaphone className="h-12 w-12 text-amber-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">Aucune campagne</h3>
          <p className="text-sm text-slate-500 mb-4">Créez votre première campagne pour capturer des leads</p>
          <button onClick={openCreate} className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-700">
            <Plus className="h-4 w-4" /> Créer une campagne
          </button>
        </div>
      )}

      {/* Campaign cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {campaigns.map((campaign) => {
          const leadCount = campaign.business_prospects?.[0]?.count || 0
          const customFieldCount = (campaign.custom_fields || []).length
          return (
            <div key={campaign.id} className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 truncate">{campaign.name}</h3>
                  {campaign.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{campaign.description}</p>}
                </div>
                <button onClick={() => toggleActive(campaign)} className="ml-2 flex-shrink-0">
                  {campaign.is_active ? <ToggleRight className="h-6 w-6 text-amber-600" /> : <ToggleLeft className="h-6 w-6 text-slate-300" />}
                </button>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${campaign.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                  {campaign.is_active ? 'Active' : 'Inactive'}
                </span>
                <span className="text-xs text-slate-400">{campaign.source}</span>
                {campaign.landing_video_url && <Video className="h-3.5 w-3.5 text-slate-400" />}
              </div>
              <div className="flex items-center gap-4 mb-4 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {leadCount} lead{leadCount !== 1 ? 's' : ''}</span>
                {customFieldCount > 0 && <span>{customFieldCount} champ{customFieldCount !== 1 ? 's' : ''} custom</span>}
              </div>
              <div className="flex gap-2 mb-3">
                <button onClick={() => copyToClipboard(getCaptureUrl(campaign.slug), 'Lien')} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors">
                  <Link className="h-3.5 w-3.5" /> Copier le lien
                </button>
                <button onClick={() => copyToClipboard(getIframeCode(campaign.slug), 'Code iframe')} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors">
                  <Code className="h-3.5 w-3.5" /> Iframe
                </button>
              </div>
              <div className="flex gap-2 border-t border-slate-100 pt-3">
                <button onClick={() => openEdit(campaign)} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                  <Pencil className="h-3.5 w-3.5" /> Modifier
                </button>
                <button onClick={() => deleteCampaign(campaign)} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" /> Supprimer
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal Create/Edit - Tabbed */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 flex-shrink-0">
              <h3 className="text-lg font-bold text-slate-900">
                {editingCampaign ? 'Modifier la campagne' : 'Nouvelle campagne'}
              </h3>
              <button onClick={() => { setIsModalOpen(false); resetForm() }} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-100 px-6 flex-shrink-0">
              {([
                { key: 'general', label: 'Général' },
                { key: 'landing', label: 'Page de capture' },
                { key: 'fields', label: 'Champs & Options' },
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setModalTab(tab.key)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    modalTab === tab.key
                      ? 'border-amber-600 text-amber-700'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content - scrollable */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* General tab */}
              {modalTab === 'general' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nom de la campagne *</label>
                    <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ex: Campagne Facebook Mars 2026" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Source</label>
                    <div className="relative">
                      <select value={formSource} onChange={(e) => setFormSource(e.target.value)} className={selectCls}>
                        {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Description interne</label>
                    <textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={2} placeholder="Note interne..." className={`${inputCls} resize-none`} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Paramètres UTM</label>
                    <div className="grid grid-cols-3 gap-2">
                      <input type="text" value={formUtmSource} onChange={(e) => setFormUtmSource(e.target.value)} placeholder="utm_source" className={smallInputCls} />
                      <input type="text" value={formUtmMedium} onChange={(e) => setFormUtmMedium(e.target.value)} placeholder="utm_medium" className={smallInputCls} />
                      <input type="text" value={formUtmCampaign} onChange={(e) => setFormUtmCampaign(e.target.value)} placeholder="utm_campaign" className={smallInputCls} />
                    </div>
                  </div>
                </div>
              )}

              {/* Landing page tab */}
              {modalTab === 'landing' && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-500 mb-2">Configurez le contenu affiché à gauche de la page de capture (côté marketing)</p>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Titre principal</label>
                    <input type="text" value={formLandingTitle} onChange={(e) => setFormLandingTitle(e.target.value)} placeholder="Ex: Transformez chaque lead en client." className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Sous-titre</label>
                    <input type="text" value={formLandingSubtitle} onChange={(e) => setFormLandingSubtitle(e.target.value)} placeholder="Ex: THE SALES OPERATING SYSTEM" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Texte descriptif</label>
                    <textarea value={formLandingText} onChange={(e) => setFormLandingText(e.target.value)} rows={3} placeholder="Décrivez votre offre, votre proposition de valeur..." className={`${inputCls} resize-none`} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">URL Vidéo (YouTube, Loom...)</label>
                    <input type="url" value={formLandingVideoUrl} onChange={(e) => setFormLandingVideoUrl(e.target.value)} placeholder="https://www.youtube.com/embed/..." className={inputCls} />
                    <p className="text-xs text-slate-400 mt-1">Utilisez l'URL d'intégration (embed). Ex: https://www.youtube.com/embed/VIDEO_ID</p>
                  </div>
                </div>
              )}

              {/* Fields & Options tab */}
              {modalTab === 'fields' && (
                <div className="space-y-5">
                  {/* Required fields config */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-3">Champs obligatoires du formulaire</label>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-slate-700">Nom</p>
                          <p className="text-xs text-slate-400">Toujours requis</p>
                        </div>
                        <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded">Obligatoire</span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-slate-700">Email</p>
                          <p className="text-xs text-slate-400">Adresse email du lead</p>
                        </div>
                        <button
                          onClick={() => setFormEmailRequired(!formEmailRequired)}
                          className="flex-shrink-0"
                        >
                          {formEmailRequired
                            ? <ToggleRight className="h-6 w-6 text-amber-600" />
                            : <ToggleLeft className="h-6 w-6 text-slate-300" />
                          }
                        </button>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-slate-700">Téléphone</p>
                          <p className="text-xs text-slate-400">Numéro de téléphone du lead</p>
                        </div>
                        <button
                          onClick={() => setFormPhoneRequired(!formPhoneRequired)}
                          className="flex-shrink-0"
                        >
                          {formPhoneRequired
                            ? <ToggleRight className="h-6 w-6 text-amber-600" />
                            : <ToggleLeft className="h-6 w-6 text-slate-300" />
                          }
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Custom Fields */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-slate-700">Champs personnalisés</label>
                      <button onClick={addCustomField} className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700">
                        <Plus className="h-3.5 w-3.5" /> Ajouter un champ
                      </button>
                    </div>
                    {formCustomFields.length === 0 && (
                      <p className="text-xs text-slate-400 italic">Aucun champ personnalisé. Cliquez sur "Ajouter un champ" pour en créer.</p>
                    )}
                    {formCustomFields.map((field, idx) => (
                      <div key={idx} className="flex items-center gap-2 mb-2">
                        <input type="text" value={field.label} onChange={(e) => updateCustomField(idx, { label: e.target.value })} placeholder="Nom du champ" className={`flex-1 ${smallInputCls}`} />
                        <select value={field.type} onChange={(e) => updateCustomField(idx, { type: e.target.value as CustomField['type'] })} className={`${smallInputCls} text-slate-900`}>
                          <option value="text">Texte</option>
                          <option value="email">Email</option>
                          <option value="phone">Téléphone</option>
                          <option value="number">Numéro</option>
                          <option value="select">Sélection</option>
                        </select>
                        <label className="flex items-center gap-1 text-xs text-slate-500 whitespace-nowrap">
                          <input type="checkbox" checked={field.required} onChange={(e) => updateCustomField(idx, { required: e.target.checked })} className="rounded border-slate-300 text-amber-600 focus:ring-amber-500" />
                          Requis
                        </label>
                        <button onClick={() => removeCustomField(idx)} className="text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4 flex-shrink-0">
              <button onClick={() => { setIsModalOpen(false); resetForm() }} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Annuler
              </button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingCampaign ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
