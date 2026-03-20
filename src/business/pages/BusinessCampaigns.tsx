import { useState, useEffect, useCallback, useMemo } from 'react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import {
  Plus, Megaphone, Code, Pencil, Trash2, X, Loader2,
  ToggleLeft, ToggleRight, Link, Users, ChevronDown, Video,
  CalendarCheck, UserPlus, Monitor, Layers, MessageSquare, Clock, Copy, Eye,
  Paintbrush, Type, Palette
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
  redirect_url: string | null
  formula_id: string | null
  capture_type: 'with_rdv' | 'without_rdv'
  popup_delay: number
  created_at: string
  business_prospects: { count: number }[]
}

interface Formula {
  id: string
  name: string
  price: number
}

const SOURCES = ['Direct', 'Google Ads', 'Facebook Ads', 'Instagram', 'LinkedIn', 'Email', 'Autre']

const API_URL = '/api/business'

export function BusinessCampaigns() {
  const { user, ownerUserId } = useBusinessAuth()
  const effectiveUserId = ownerUserId || user?.id
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
  const [saving, setSaving] = useState(false)
  const [modalTab, setModalTab] = useState<'general' | 'landing' | 'fields'>('general')

  // Formulas for dropdown
  const [formulas, setFormulas] = useState<Formula[]>([])

  // Form state - General
  const [formName, setFormName] = useState('')
  const [formFormulaId, setFormFormulaId] = useState<string | null>(null)
  const [formDescription, setFormDescription] = useState('')
  const [formSource, setFormSource] = useState('Direct')
  const [formUtmSource, setFormUtmSource] = useState('')
  const [formUtmMedium, setFormUtmMedium] = useState('')
  const [formUtmCampaign, setFormUtmCampaign] = useState('')

  // Form state - Landing page
  const [formRedirectUrl, setFormRedirectUrl] = useState('')
  const [formLandingTitle, setFormLandingTitle] = useState('')
  const [formLandingSubtitle, setFormLandingSubtitle] = useState('')
  const [formLandingText, setFormLandingText] = useState('')
  const [formLandingVideoUrl, setFormLandingVideoUrl] = useState('')

  // Form state - Fields config
  const [formEmailRequired, setFormEmailRequired] = useState(true)
  const [formPhoneRequired, setFormPhoneRequired] = useState(false)
  const [formCustomFields, setFormCustomFields] = useState<CustomField[]>([])

  // Capture type & popup
  const [formCaptureType, setFormCaptureType] = useState<'with_rdv' | 'without_rdv'>('with_rdv')
  const [formPopupDelay, setFormPopupDelay] = useState(0)

  const fetchCampaigns = useCallback(async () => {
    if (!effectiveUserId) return
    try {
      const res = await fetch(`${API_URL}?action=campaigns-list&user_id=${effectiveUserId}`)
      const data = await res.json()
      if (data.campaigns) setCampaigns(data.campaigns)
    } catch (err) {
      console.error('Error fetching campaigns:', err)
    } finally {
      setLoading(false)
    }
  }, [effectiveUserId])

  const fetchFormulas = useCallback(async () => {
    if (!effectiveUserId) return
    try {
      const res = await fetch(`${API_URL}?action=formulas-list&user_id=${effectiveUserId}`)
      const data = await res.json()
      if (data.formulas) setFormulas(data.formulas)
    } catch (err) {
      console.error('Error fetching formulas:', err)
    }
  }, [effectiveUserId])

  useEffect(() => { fetchCampaigns(); fetchFormulas() }, [fetchCampaigns, fetchFormulas])

  const resetForm = () => {
    setFormName(''); setFormDescription(''); setFormSource('Direct')
    setFormUtmSource(''); setFormUtmMedium(''); setFormUtmCampaign('')
    setFormRedirectUrl('')
    setFormLandingTitle(''); setFormLandingSubtitle(''); setFormLandingText(''); setFormLandingVideoUrl('')
    setFormEmailRequired(true); setFormPhoneRequired(false)
    setFormCustomFields([]); setEditingCampaign(null); setModalTab('general')
    setFormFormulaId(null); setFormCaptureType('with_rdv'); setFormPopupDelay(0)
  }

  const openCreate = () => { resetForm(); setIsModalOpen(true) }

  const openEdit = (campaign: Campaign) => {
    setEditingCampaign(campaign)
    setFormName(campaign.name); setFormDescription(campaign.description || '')
    setFormSource(campaign.source || 'Direct')
    setFormUtmSource(campaign.utm_source || ''); setFormUtmMedium(campaign.utm_medium || '')
    setFormUtmCampaign(campaign.utm_campaign || '')
    setFormRedirectUrl(campaign.redirect_url || '')
    setFormLandingTitle(campaign.landing_title || ''); setFormLandingSubtitle(campaign.landing_subtitle || '')
    setFormLandingText(campaign.landing_text || ''); setFormLandingVideoUrl(campaign.landing_video_url || '')
    setFormEmailRequired(campaign.email_required ?? true); setFormPhoneRequired(campaign.phone_required ?? false)
    setFormCustomFields(campaign.custom_fields || [])
    setFormFormulaId(campaign.formula_id || null)
    setFormCaptureType(campaign.capture_type || 'with_rdv')
    setFormPopupDelay(campaign.popup_delay ?? 0)
    setModalTab('general'); setIsModalOpen(true)
  }

  const getPayload = () => ({
    user_id: effectiveUserId, name: formName, description: formDescription, source: formSource,
    utm_source: formUtmSource || null, utm_medium: formUtmMedium || null, utm_campaign: formUtmCampaign || null,
    custom_fields: formCustomFields,
    landing_title: formLandingTitle || null, landing_subtitle: formLandingSubtitle || null,
    landing_text: formLandingText || null, landing_video_url: formLandingVideoUrl || null,
    email_required: formEmailRequired, phone_required: formPhoneRequired,
    formula_id: formFormulaId || null,
    redirect_url: formRedirectUrl || null,
    capture_type: formCaptureType,
    popup_delay: formPopupDelay,
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
        body: JSON.stringify({ user_id: effectiveUserId, id: campaign.id, is_active: !campaign.is_active }),
      })
      fetchCampaigns()
      toast.success(campaign.is_active ? 'Campagne désactivée' : 'Campagne activée')
    } catch { toast.error('Erreur') }
  }

  const deleteCampaign = async (campaign: Campaign) => {
    if (!confirm(`Supprimer la campagne "${campaign.name}" ?`)) return
    try {
      await fetch(`${API_URL}?action=campaigns-delete&id=${campaign.id}&user_id=${effectiveUserId}`, { method: 'DELETE' })
      toast.success('Campagne supprimée'); fetchCampaigns()
    } catch { toast.error('Erreur') }
  }

  // Embed code modal
  const [embedModalCampaign, setEmbedModalCampaign] = useState<Campaign | null>(null)
  const [embedModalFormat, setEmbedModalFormat] = useState<'iframe' | 'popup'>('iframe')
  const [embedTab, setEmbedTab] = useState<'code' | 'style'>('code')

  // Style customization
  const [styleFont, setStyleFont] = useState('Inter, system-ui, sans-serif')
  const [stylePrimaryColor, setStylePrimaryColor] = useState('#2563eb')
  const [styleBgColor, setStyleBgColor] = useState('#ffffff')
  const [styleTextColor, setStyleTextColor] = useState('#0f172a')
  const [styleRadius, setStyleRadius] = useState(12)

  const FONTS = [
    { label: 'Inter (défaut)', value: 'Inter, system-ui, sans-serif' },
    { label: 'Poppins', value: 'Poppins, sans-serif' },
    { label: 'Roboto', value: 'Roboto, sans-serif' },
    { label: 'Open Sans', value: 'Open Sans, sans-serif' },
    { label: 'Montserrat', value: 'Montserrat, sans-serif' },
    { label: 'Lato', value: 'Lato, sans-serif' },
    { label: 'Playfair Display', value: 'Playfair Display, serif' },
  ]

  const openEmbedModal = (campaign: Campaign, format: 'iframe' | 'popup') => {
    setEmbedModalCampaign(campaign)
    setEmbedModalFormat(format)
    setEmbedTab('code')
    setStyleFont('Inter, system-ui, sans-serif')
    setStylePrimaryColor('#2563eb')
    setStyleBgColor('#ffffff')
    setStyleTextColor('#0f172a')
    setStyleRadius(12)
  }

  const getCaptureUrl = (slug: string) => `${window.location.origin}/capture/${slug}`

  const getStyleParams = () => {
    const params = new URLSearchParams()
    params.set('embed', 'true')
    if (stylePrimaryColor !== '#2563eb') params.set('pc', stylePrimaryColor.replace('#', ''))
    if (styleBgColor !== '#ffffff') params.set('bg', styleBgColor.replace('#', ''))
    if (styleTextColor !== '#0f172a') params.set('tc', styleTextColor.replace('#', ''))
    if (styleRadius !== 12) params.set('br', String(styleRadius))
    if (styleFont !== 'Inter, system-ui, sans-serif') params.set('font', styleFont.split(',')[0].trim())
    return params.toString()
  }

  const getStyledIframeUrl = (slug: string) => `${getCaptureUrl(slug)}?${getStyleParams()}`

  const getIframeCode = useMemo(() => {
    if (!embedModalCampaign) return ''
    const url = getStyledIframeUrl(embedModalCampaign.slug)
    return `<iframe src="${url}" width="100%" height="800" frameborder="0" style="border:none;border-radius:${styleRadius}px;"></iframe>`
  }, [embedModalCampaign, stylePrimaryColor, styleBgColor, styleTextColor, styleRadius, styleFont])

  const getPopupCode = useMemo(() => {
    if (!embedModalCampaign) return ''
    const url = getStyledIframeUrl(embedModalCampaign.slug)
    const delay = embedModalCampaign.popup_delay ?? 0
    return `<!-- CloseOS Capture Popup -->
<div id="closeos-overlay" style="display:none;position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);justify-content:center;align-items:center;">
  <div style="position:relative;width:90%;max-width:520px;max-height:90vh;background:${styleBgColor};border-radius:${styleRadius}px;overflow:hidden;box-shadow:0 25px 50px rgba(0,0,0,0.25);">
    <iframe src="${url}" width="100%" height="700" frameborder="0" style="border:none;display:block;"></iframe>
  </div>
</div>
<script>
(function(){
  var overlay = document.getElementById('closeos-overlay');
  var filled = localStorage.getItem('closeos_filled_${embedModalCampaign.slug}');
  if (filled) return;
  document.body.style.overflow = 'hidden';
  ${delay > 0 ? `setTimeout(function(){ overlay.style.display='flex'; }, ${delay * 1000});` : `overlay.style.display='flex';`}
  window.addEventListener('message', function(e){
    if(e.data === 'closeos-capture-done'){
      overlay.style.display='none';
      document.body.style.overflow='';
      localStorage.setItem('closeos_filled_${embedModalCampaign.slug}','1');
    }
  });
})();
</script>`
  }, [embedModalCampaign, stylePrimaryColor, styleBgColor, styleTextColor, styleRadius, styleFont])

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
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${campaign.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                  {campaign.is_active ? 'Active' : 'Inactive'}
                </span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${campaign.capture_type === 'without_rdv' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                  {campaign.capture_type === 'without_rdv' ? <><UserPlus className="h-3 w-3" /> Inscription</> : <><CalendarCheck className="h-3 w-3" /> RDV</>}
                </span>
                <span className="text-xs text-slate-400">{campaign.source}</span>
              </div>
              <div className="flex items-center gap-4 mb-4 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {leadCount} lead{leadCount !== 1 ? 's' : ''}</span>
                {customFieldCount > 0 && <span>{customFieldCount} champ{customFieldCount !== 1 ? 's' : ''} custom</span>}
              </div>
              <div className="flex gap-2 mb-3">
                <button onClick={() => copyToClipboard(getCaptureUrl(campaign.slug), 'Lien')} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors" title="Page entière">
                  <Monitor className="h-3.5 w-3.5" /> Page
                </button>
                <button onClick={() => openEmbedModal(campaign, 'iframe')} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors" title="Iframe">
                  <Layers className="h-3.5 w-3.5" /> Iframe
                </button>
                <button onClick={() => openEmbedModal(campaign, 'popup')} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 transition-colors" title="Popup">
                  <MessageSquare className="h-3.5 w-3.5" /> Popup
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

                  {/* Capture type switch */}
                  <div className="rounded-xl border border-slate-200 p-4">
                    <label className="block text-sm font-medium text-slate-700 mb-3">Type de capture</label>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setFormCaptureType('with_rdv')}
                        className={`flex-1 flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all ${
                          formCaptureType === 'with_rdv'
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        <CalendarCheck className="h-4 w-4" /> Avec RDV
                      </button>
                      <button
                        onClick={() => setFormCaptureType('without_rdv')}
                        className={`flex-1 flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all ${
                          formCaptureType === 'without_rdv'
                            ? 'border-purple-500 bg-purple-50 text-purple-700'
                            : 'border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        <UserPlus className="h-4 w-4" /> Inscription seule
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      {formCaptureType === 'with_rdv'
                        ? 'Le prospect pourra choisir un créneau de rendez-vous.'
                        : 'Capture simple sans programmation de rendez-vous.'}
                    </p>
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
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Formule associée</label>
                    <div className="relative">
                      <select value={formFormulaId || ''} onChange={(e) => setFormFormulaId(e.target.value || null)} className={selectCls}>
                        <option value="">Aucune formule</option>
                        {formulas.map(f => <option key={f.id} value={f.id}>{f.name} — {f.price?.toFixed(2)} €</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Les prospects capturés via cette campagne seront associés à cette formule</p>
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
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Lien de redirection post-capture</label>
                    <input type="url" value={formRedirectUrl} onChange={(e) => setFormRedirectUrl(e.target.value)} placeholder="https://www.example.com/merci" className={inputCls} />
                    <p className="text-xs text-slate-400 mt-1">Optionnel — Redirige le prospect vers cette URL après soumission du formulaire</p>
                  </div>

                  {/* Popup delay config */}
                  <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4">
                    <label className="flex items-center gap-2 text-sm font-medium text-purple-700 mb-2">
                      <Clock className="h-4 w-4" /> Configuration du Popup
                    </label>
                    <div className="flex items-center gap-3">
                      <select
                        value={formPopupDelay}
                        onChange={(e) => setFormPopupDelay(Number(e.target.value))}
                        className={selectCls}
                      >
                        <option value={0}>Apparaît instantanément</option>
                        <option value={3}>Après 3 secondes</option>
                        <option value={5}>Après 5 secondes</option>
                        <option value={10}>Après 10 secondes</option>
                        <option value={15}>Après 15 secondes</option>
                        <option value={30}>Après 30 secondes</option>
                        <option value={60}>Après 1 minute</option>
                      </select>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">S'applique quand le format Popup est utilisé. Le site est bloqué tant que le formulaire n'est pas rempli.</p>
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
      {/* Embed Code Modal (Iframe & Popup) */}
      {embedModalCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 flex-shrink-0">
              <div className="flex items-center gap-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{embedModalCampaign.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Intégrez le formulaire sur votre site</p>
                </div>
                {/* Format toggle */}
                <div className="flex rounded-lg border border-slate-200 overflow-hidden ml-4">
                  <button
                    onClick={() => setEmbedModalFormat('iframe')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                      embedModalFormat === 'iframe' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Layers className="h-3.5 w-3.5" /> Iframe
                  </button>
                  <button
                    onClick={() => setEmbedModalFormat('popup')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                      embedModalFormat === 'popup' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <MessageSquare className="h-3.5 w-3.5" /> Popup
                  </button>
                </div>
              </div>
              <button onClick={() => setEmbedModalCampaign(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-100 px-6 flex-shrink-0">
              <button
                onClick={() => setEmbedTab('code')}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  embedTab === 'code' ? 'border-amber-600 text-amber-700' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Code className="h-4 w-4" /> Code & Tuto
              </button>
              <button
                onClick={() => setEmbedTab('style')}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  embedTab === 'style' ? 'border-amber-600 text-amber-700' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Paintbrush className="h-4 w-4" /> Personnaliser
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {embedTab === 'code' && (
                <div className="p-6 space-y-5">
                  {/* Tutorial */}
                  <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                    <h4 className="text-sm font-bold text-blue-700 mb-2 flex items-center gap-2">
                      <Eye className="h-4 w-4" /> Comment ça marche
                    </h4>
                    {embedModalFormat === 'popup' ? (
                      <ol className="text-xs text-blue-800 space-y-1.5 list-decimal list-inside">
                        <li>Le popup s'affiche {embedModalCampaign.popup_delay ? `après ${embedModalCampaign.popup_delay} secondes` : 'instantanément'} au chargement de la page</li>
                        <li>Le site est bloqué (scroll désactivé, overlay sombre) tant que le formulaire n'est pas rempli</li>
                        <li>Une fois le formulaire soumis, le popup disparaît et le visiteur peut naviguer normalement</li>
                        <li>Le visiteur ne reverra plus le popup grâce au localStorage</li>
                        <li>Collez le code juste avant la balise <code className="bg-blue-100 px-1 rounded">{'</body>'}</code> de votre site</li>
                      </ol>
                    ) : (
                      <ol className="text-xs text-blue-800 space-y-1.5 list-decimal list-inside">
                        <li>Copiez le code iframe ci-dessous</li>
                        <li>Collez-le dans le HTML de votre page, à l'endroit où vous souhaitez afficher le formulaire</li>
                        <li>Ajustez la hauteur (<code className="bg-blue-100 px-1 rounded">height</code>) si nécessaire</li>
                        <li>Le formulaire s'adapte automatiquement à la largeur du conteneur</li>
                      </ol>
                    )}
                  </div>

                  {/* Code block */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-slate-700">Code à intégrer</label>
                      <button
                        onClick={() => copyToClipboard(embedModalFormat === 'popup' ? getPopupCode : getIframeCode, `Code ${embedModalFormat}`)}
                        className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 transition-colors"
                      >
                        <Copy className="h-3.5 w-3.5" /> Copier le code
                      </button>
                    </div>
                    <pre className="rounded-xl border border-slate-200 bg-slate-900 p-4 text-xs text-green-400 overflow-x-auto max-h-[250px] overflow-y-auto whitespace-pre-wrap break-all font-mono">
                      {embedModalFormat === 'popup' ? getPopupCode : getIframeCode}
                    </pre>
                  </div>

                  {/* Quick copy other format */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => copyToClipboard(getCaptureUrl(embedModalCampaign.slug), 'Lien page entière')}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      <Monitor className="h-4 w-4" /> Copier lien page entière
                    </button>
                  </div>
                </div>
              )}

              {embedTab === 'style' && (
                <div className="flex divide-x divide-slate-200 min-h-[500px]">
                  {/* Left: Controls */}
                  <div className="w-[280px] flex-shrink-0 p-5 space-y-5 overflow-y-auto">
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Palette className="h-4 w-4 text-amber-600" /> Style
                    </h4>

                    {/* Font */}
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1.5">
                        <Type className="h-3.5 w-3.5" /> Police
                      </label>
                      <select
                        value={styleFont}
                        onChange={(e) => setStyleFont(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-amber-500 focus:outline-none"
                      >
                        {FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>

                    {/* Primary color */}
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-1.5 block">Couleur principale</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={stylePrimaryColor}
                          onChange={(e) => setStylePrimaryColor(e.target.value)}
                          className="h-8 w-8 rounded border border-slate-200 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={stylePrimaryColor}
                          onChange={(e) => setStylePrimaryColor(e.target.value)}
                          className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900 font-mono focus:border-amber-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Background color */}
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-1.5 block">Fond</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={styleBgColor}
                          onChange={(e) => setStyleBgColor(e.target.value)}
                          className="h-8 w-8 rounded border border-slate-200 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={styleBgColor}
                          onChange={(e) => setStyleBgColor(e.target.value)}
                          className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900 font-mono focus:border-amber-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Text color */}
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-1.5 block">Texte</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={styleTextColor}
                          onChange={(e) => setStyleTextColor(e.target.value)}
                          className="h-8 w-8 rounded border border-slate-200 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={styleTextColor}
                          onChange={(e) => setStyleTextColor(e.target.value)}
                          className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900 font-mono focus:border-amber-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Border radius */}
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-1.5 block">Arrondi des coins — {styleRadius}px</label>
                      <input
                        type="range"
                        min={0}
                        max={24}
                        value={styleRadius}
                        onChange={(e) => setStyleRadius(Number(e.target.value))}
                        className="w-full accent-amber-600"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Carré</span><span>Arrondi</span>
                      </div>
                    </div>

                    {/* Copy button */}
                    <button
                      onClick={() => copyToClipboard(embedModalFormat === 'popup' ? getPopupCode : getIframeCode, `Code ${embedModalFormat}`)}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-700 transition-colors"
                    >
                      <Copy className="h-4 w-4" /> Copier le code
                    </button>
                  </div>

                  {/* Right: Live preview */}
                  <div className="flex-1 bg-slate-100 p-5 flex flex-col">
                    <p className="text-xs font-medium text-slate-500 mb-3 flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5" /> Aperçu en temps réel
                    </p>
                    <div className="flex-1 rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-white">
                      <iframe
                        src={getStyledIframeUrl(embedModalCampaign.slug)}
                        className="w-full h-full min-h-[450px]"
                        style={{ border: 'none' }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end border-t border-slate-100 px-6 py-3 flex-shrink-0">
              <button onClick={() => setEmbedModalCampaign(null)} className="rounded-xl bg-slate-100 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
