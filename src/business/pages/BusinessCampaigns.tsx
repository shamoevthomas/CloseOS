import { useState, useEffect, useCallback, useMemo } from 'react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import {
  Plus, Megaphone, Code, Pencil, Trash2, X, Loader2,
  ToggleLeft, ToggleRight, Link, Users, ChevronDown, Video,
  CalendarCheck, UserPlus, Monitor, Layers, MessageSquare, Clock, Copy, Eye,
  Paintbrush, Type, Palette, ArrowRightCircle, Shuffle, UserCheck, UsersRound
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
  booking_duration: number
  booking_title: string | null
  booking_description: string | null
  booking_with: 'closer' | 'setter'
  booking_assign_mode: 'specific' | 'all_role' | 'multiple'
  booking_assigned_members: string[]
  booking_distribution: 'round_robin' | 'random'
  created_at: string
  business_prospects: { count: number }[]
}

interface Formula {
  id: string
  name: string
  price: number
}

interface TeamMember {
  id: string
  first_name: string
  last_name: string
  role: string
}

const SOURCES = ['Direct', 'Google Ads', 'Facebook Ads', 'Instagram', 'LinkedIn', 'Email', 'Autre']

const BOOKING_DURATIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1h' },
  { value: 90, label: '1h30' },
  { value: 120, label: '2h' },
]

const API_URL = '/api/business'

export function BusinessCampaigns() {
  const { user, ownerUserId } = useBusinessAuth()
  const effectiveUserId = ownerUserId || user?.id
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
  const [saving, setSaving] = useState(false)
  const [modalTab, setModalTab] = useState<'general' | 'landing' | 'fields' | 'booking'>('general')

  // Team members for booking assignment
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])

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

  // Booking config (only for with_rdv)
  const [formBookingDuration, setFormBookingDuration] = useState(30)
  const [formBookingTitle, setFormBookingTitle] = useState('')
  const [formBookingDescription, setFormBookingDescription] = useState('')
  const [formBookingWith, setFormBookingWith] = useState<'closer' | 'setter'>('closer')
  const [formBookingAssignMode, setFormBookingAssignMode] = useState<'specific' | 'all_role' | 'multiple'>('all_role')
  const [formBookingAssignedMembers, setFormBookingAssignedMembers] = useState<string[]>([])
  const [formBookingDistribution, setFormBookingDistribution] = useState<'round_robin' | 'random'>('round_robin')

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

  const fetchTeamMembers = useCallback(async () => {
    if (!effectiveUserId) return
    const { supabase } = await import('../../lib/supabase')
    const [tmRes, ownerRes] = await Promise.all([
      supabase.from('business_team_members').select('id, first_name, last_name, role').eq('business_owner_id', effectiveUserId),
      supabase.from('business_users').select('id, full_name').eq('id', effectiveUserId).single(),
    ])
    const members: TeamMember[] = (tmRes.data || []).map((m: any) => ({ id: m.id, first_name: m.first_name, last_name: m.last_name, role: m.role }))
    if (ownerRes.data) {
      members.unshift({
        id: ownerRes.data.id,
        first_name: (ownerRes.data.full_name || 'Owner').split(' ')[0],
        last_name: (ownerRes.data.full_name || '').split(' ').slice(1).join(' '),
        role: 'Owner',
      })
    }
    setTeamMembers(members)
  }, [effectiveUserId])

  useEffect(() => { fetchCampaigns(); fetchFormulas(); fetchTeamMembers() }, [fetchCampaigns, fetchFormulas, fetchTeamMembers])

  const resetForm = () => {
    setFormName(''); setFormDescription(''); setFormSource('Direct')
    setFormUtmSource(''); setFormUtmMedium(''); setFormUtmCampaign('')
    setFormRedirectUrl('')
    setFormLandingTitle(''); setFormLandingSubtitle(''); setFormLandingText(''); setFormLandingVideoUrl('')
    setFormEmailRequired(true); setFormPhoneRequired(false)
    setFormCustomFields([]); setEditingCampaign(null); setModalTab('general')
    setFormFormulaId(null); setFormCaptureType('with_rdv'); setFormPopupDelay(0)
    setFormBookingDuration(30); setFormBookingTitle(''); setFormBookingDescription('')
    setFormBookingWith('closer'); setFormBookingAssignMode('all_role')
    setFormBookingAssignedMembers([]); setFormBookingDistribution('round_robin')
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
    setFormBookingDuration(campaign.booking_duration ?? 30)
    setFormBookingTitle(campaign.booking_title || '')
    setFormBookingDescription(campaign.booking_description || '')
    setFormBookingWith(campaign.booking_with || 'closer')
    setFormBookingAssignMode(campaign.booking_assign_mode || 'all_role')
    setFormBookingAssignedMembers(campaign.booking_assigned_members || [])
    setFormBookingDistribution(campaign.booking_distribution || 'round_robin')
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
    booking_duration: formBookingDuration,
    booking_title: formBookingTitle || null,
    booking_description: formBookingDescription || null,
    booking_with: formBookingWith,
    booking_assign_mode: formBookingAssignMode,
    booking_assigned_members: formBookingAssignedMembers,
    booking_distribution: formBookingDistribution,
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
            <div className="flex border-b border-slate-100 px-6 flex-shrink-0 overflow-x-auto">
              {([
                { key: 'general' as const, label: 'Général' },
                { key: 'landing' as const, label: 'Page de capture' },
                { key: 'fields' as const, label: 'Champs & Options' },
                ...(formCaptureType === 'with_rdv' ? [{ key: 'booking' as const, label: 'Booking' }] : []),
              ]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setModalTab(tab.key)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
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

              {/* Booking tab (only for with_rdv) */}
              {modalTab === 'booking' && formCaptureType === 'with_rdv' && (
                <div className="space-y-5">
                  {/* Duration */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Durée du rendez-vous</label>
                    <div className="flex gap-2 flex-wrap">
                      {BOOKING_DURATIONS.map(d => (
                        <button
                          key={d.value}
                          type="button"
                          onClick={() => setFormBookingDuration(d.value)}
                          className={`rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all ${
                            formBookingDuration === d.value
                              ? 'border-amber-500 bg-amber-50 text-amber-700'
                              : 'border-slate-200 text-slate-500 hover:border-slate-300'
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Titre du rendez-vous</label>
                    <input
                      type="text"
                      value={formBookingTitle}
                      onChange={(e) => setFormBookingTitle(e.target.value)}
                      placeholder="Ex: Appel découverte — {{lead_name}} × {{assignee_name}}"
                      className={inputCls}
                    />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {[
                        { var: '{{lead_name}}', label: 'Nom du lead' },
                        { var: '{{assignee_name}}', label: 'Nom du closer/setter' },
                        { var: '{{formula_name}}', label: "Nom de l'offre" },
                        { var: '{{campaign_name}}', label: 'Nom de la campagne' },
                      ].map(v => (
                        <button
                          key={v.var}
                          type="button"
                          onClick={() => setFormBookingTitle(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + v.var)}
                          className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-mono text-slate-600 hover:bg-slate-200 transition-colors"
                          title={v.label}
                        >
                          {v.var}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Description du rendez-vous</label>
                    <textarea
                      value={formBookingDescription}
                      onChange={(e) => setFormBookingDescription(e.target.value)}
                      rows={3}
                      placeholder="Ex: Appel de qualification avec {{lead_name}}. Offre : {{formula_name}}"
                      className={`${inputCls} resize-none`}
                    />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {[
                        { var: '{{lead_name}}', label: 'Nom du lead' },
                        { var: '{{lead_email}}', label: 'Email du lead' },
                        { var: '{{lead_phone}}', label: 'Téléphone du lead' },
                        { var: '{{assignee_name}}', label: 'Nom du closer/setter' },
                        { var: '{{formula_name}}', label: "Nom de l'offre" },
                        { var: '{{campaign_name}}', label: 'Nom de la campagne' },
                      ].map(v => (
                        <button
                          key={v.var}
                          type="button"
                          onClick={() => setFormBookingDescription(prev => prev + (prev && !prev.endsWith('\n') && !prev.endsWith(' ') ? ' ' : '') + v.var)}
                          className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-mono text-slate-600 hover:bg-slate-200 transition-colors"
                          title={v.label}
                        >
                          {v.var}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* RDV with Closer or Setter switch */}
                  <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                    <label className="block text-sm font-medium text-slate-700 mb-3">Rendez-vous avec</label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => { setFormBookingWith('closer'); setFormBookingAssignedMembers([]) }}
                        className={`flex-1 flex items-center justify-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all ${
                          formBookingWith === 'closer'
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        <UserCheck className="h-4 w-4" /> Closer
                      </button>
                      <button
                        type="button"
                        onClick={() => { setFormBookingWith('setter'); setFormBookingAssignedMembers([]) }}
                        className={`flex-1 flex items-center justify-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all ${
                          formBookingWith === 'setter'
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        <UserCheck className="h-4 w-4" /> Setter
                      </button>
                    </div>
                  </div>

                  {/* Assignment mode */}
                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                    <label className="block text-sm font-medium text-slate-700 mb-3">
                      Mode d'assignation des {formBookingWith === 'closer' ? 'Closers' : 'Setters'}
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => { setFormBookingAssignMode('specific'); setFormBookingAssignedMembers([]) }}
                        className={`flex items-center gap-1.5 rounded-lg border-2 px-3 py-2 text-xs font-medium transition-all ${
                          formBookingAssignMode === 'specific'
                            ? 'border-amber-500 bg-amber-50 text-amber-700'
                            : 'border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        <UserCheck className="h-3.5 w-3.5" /> Un membre précis
                      </button>
                      <button
                        type="button"
                        onClick={() => { setFormBookingAssignMode('all_role'); setFormBookingAssignedMembers([]) }}
                        className={`flex items-center gap-1.5 rounded-lg border-2 px-3 py-2 text-xs font-medium transition-all ${
                          formBookingAssignMode === 'all_role'
                            ? 'border-amber-500 bg-amber-50 text-amber-700'
                            : 'border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        <UsersRound className="h-3.5 w-3.5" /> Tout le rôle
                      </button>
                      <button
                        type="button"
                        onClick={() => { setFormBookingAssignMode('multiple'); setFormBookingAssignedMembers([]) }}
                        className={`flex items-center gap-1.5 rounded-lg border-2 px-3 py-2 text-xs font-medium transition-all ${
                          formBookingAssignMode === 'multiple'
                            ? 'border-amber-500 bg-amber-50 text-amber-700'
                            : 'border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        <Users className="h-3.5 w-3.5" /> Plusieurs membres
                      </button>
                    </div>

                    {/* Specific member selector */}
                    {formBookingAssignMode === 'specific' && (
                      <div className="mt-3">
                        <div className="relative">
                          <select
                            value={formBookingAssignedMembers[0] || ''}
                            onChange={(e) => setFormBookingAssignedMembers(e.target.value ? [e.target.value] : [])}
                            className={selectCls}
                          >
                            <option value="">Choisir un membre</option>
                            {teamMembers
                              .filter(m => {
                                if (formBookingWith === 'closer') return m.role === 'Closer' || m.role === 'Setter-Closer' || m.role === 'Owner'
                                return m.role === 'Setter' || m.role === 'Setter-Closer' || m.role === 'Owner'
                              })
                              .map(m => (
                                <option key={m.id} value={m.id}>{m.first_name} {m.last_name} ({m.role})</option>
                              ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        </div>
                      </div>
                    )}

                    {/* Multiple members selector */}
                    {formBookingAssignMode === 'multiple' && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs text-slate-500">Sélectionnez les membres à inclure :</p>
                        <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border border-slate-200 bg-white p-2">
                          {teamMembers
                            .filter(m => {
                              if (formBookingWith === 'closer') return m.role === 'Closer' || m.role === 'Setter-Closer' || m.role === 'Owner'
                              return m.role === 'Setter' || m.role === 'Setter-Closer' || m.role === 'Owner'
                            })
                            .map(m => (
                              <label key={m.id} className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-slate-50 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={formBookingAssignedMembers.includes(m.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setFormBookingAssignedMembers(prev => [...prev, m.id])
                                    } else {
                                      setFormBookingAssignedMembers(prev => prev.filter(id => id !== m.id))
                                    }
                                  }}
                                  className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                                />
                                <span className="text-sm text-slate-700">{m.first_name} {m.last_name}</span>
                                <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{m.role}</span>
                              </label>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Distribution mode (for all_role and multiple) */}
                    {(formBookingAssignMode === 'all_role' || formBookingAssignMode === 'multiple') && (
                      <div className="mt-4 pt-3 border-t border-amber-200">
                        <label className="block text-xs font-medium text-slate-600 mb-2">Distribution des rendez-vous</label>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => setFormBookingDistribution('round_robin')}
                            className={`flex-1 flex items-center justify-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all ${
                              formBookingDistribution === 'round_robin'
                                ? 'border-amber-500 bg-amber-50 text-amber-700'
                                : 'border-slate-200 text-slate-500 hover:border-slate-300'
                            }`}
                          >
                            <ArrowRightCircle className="h-4 w-4" /> Tournante
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormBookingDistribution('random')}
                            className={`flex-1 flex items-center justify-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all ${
                              formBookingDistribution === 'random'
                                ? 'border-purple-500 bg-purple-50 text-purple-700'
                                : 'border-slate-200 text-slate-500 hover:border-slate-300'
                            }`}
                          >
                            <Shuffle className="h-4 w-4" /> Hasard
                          </button>
                        </div>
                        <p className="text-xs text-slate-400 mt-2">
                          {formBookingDistribution === 'round_robin'
                            ? 'Les rendez-vous sont distribués à tour de rôle entre les membres.'
                            : 'Les rendez-vous sont assignés aléatoirement.'}
                        </p>
                      </div>
                    )}
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
