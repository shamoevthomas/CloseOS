import { useState, useEffect, useCallback, useMemo } from 'react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import {
  Plus, Megaphone, Code, Pencil, Trash2, X, Loader2,
  ToggleLeft, ToggleRight, Link, Users, ChevronDown, Video,
  CalendarCheck, UserPlus, Monitor, Layers, MessageSquare, Clock, Copy, Eye,
  Paintbrush, Type, Palette, ArrowRightCircle, Shuffle, UserCheck, UsersRound, ExternalLink
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
  team_id: string | null
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
  team_id?: string | null
  owner_assignable?: boolean
}

interface BusinessTeam {
  id: string
  name: string
}

const DEFAULT_SOURCES = ['Insta', 'LinkedIn', 'ADS', 'Organique']

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
  const [teams, setTeams] = useState<BusinessTeam[]>([])

  // Formulas for dropdown
  const [formulas, setFormulas] = useState<Formula[]>([])

  // Team assignment
  const [formTeamId, setFormTeamId] = useState<string | null>(null)

  // Custom sources
  const [customSources, setCustomSources] = useState<{ id: string; name: string }[]>([])
  const [isNewSourceModalOpen, setIsNewSourceModalOpen] = useState(false)
  const [newSourceName, setNewSourceName] = useState('')
  const [savingSource, setSavingSource] = useState(false)

  // Form state - General
  const [formName, setFormName] = useState('')
  const [formFormulaId, setFormFormulaId] = useState<string | null>(null)
  const [formDescription, setFormDescription] = useState('')
  const [formSource, setFormSource] = useState('Insta')
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

  const fetchCustomSources = useCallback(async () => {
    if (!effectiveUserId) return
    try {
      const res = await fetch(`${API_URL}?action=sources-list&user_id=${effectiveUserId}`)
      const data = await res.json()
      if (data.sources) setCustomSources(data.sources)
    } catch (err) {
      console.error('Error fetching custom sources:', err)
    }
  }, [effectiveUserId])

  const allSources = useMemo(() => [...DEFAULT_SOURCES, ...customSources.map(s => s.name)], [customSources])

  const handleCreateSource = async () => {
    if (!newSourceName.trim() || !effectiveUserId) return
    setSavingSource(true)
    try {
      const res = await fetch(`${API_URL}?action=sources-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: effectiveUserId, name: newSourceName.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.source) {
        setCustomSources(prev => [...prev, data.source])
        setFormSource(data.source.name)
        setNewSourceName('')
        setIsNewSourceModalOpen(false)
        toast.success('Source créée')
      } else {
        toast.error(data.error || 'Erreur lors de la création')
      }
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setSavingSource(false)
    }
  }

  const fetchTeamMembers = useCallback(async () => {
    if (!effectiveUserId) return
    const { supabase } = await import('../../lib/supabase')
    const [tmRes, ownerRes, teamsRes] = await Promise.all([
      supabase.from('business_team_members').select('id, first_name, last_name, role, team_id, owner_assignable').eq('business_owner_id', effectiveUserId),
      supabase.from('business_users').select('id, full_name, owner_assignable').eq('id', effectiveUserId).single(),
      supabase.from('business_teams').select('id, name').eq('business_owner_id', effectiveUserId).order('position'),
    ])
    const members: TeamMember[] = (tmRes.data || []).map((m: any) => ({ id: m.id, first_name: m.first_name, last_name: m.last_name, role: m.role, team_id: m.team_id, owner_assignable: m.owner_assignable }))
    if (ownerRes.data && ownerRes.data.owner_assignable) {
      members.unshift({
        id: ownerRes.data.id,
        first_name: (ownerRes.data.full_name || 'Owner').split(' ')[0],
        last_name: (ownerRes.data.full_name || '').split(' ').slice(1).join(' '),
        role: 'Owner',
        team_id: null,
      })
    }
    setTeamMembers(members)
    setTeams(teamsRes.data || [])
  }, [effectiveUserId])

  useEffect(() => { fetchCampaigns(); fetchFormulas(); fetchTeamMembers(); fetchCustomSources() }, [fetchCampaigns, fetchFormulas, fetchTeamMembers, fetchCustomSources])

  const resetForm = () => {
    setFormName(''); setFormDescription(''); setFormSource('Insta')
    setFormUtmSource(''); setFormUtmMedium(''); setFormUtmCampaign('')
    setFormRedirectUrl('')
    setFormLandingTitle(''); setFormLandingSubtitle(''); setFormLandingText(''); setFormLandingVideoUrl('')
    setFormEmailRequired(true); setFormPhoneRequired(false)
    setFormCustomFields([]); setEditingCampaign(null); setModalTab('general')
    setFormFormulaId(null); setFormCaptureType('with_rdv'); setFormPopupDelay(0)
    setFormBookingDuration(30); setFormBookingTitle(''); setFormBookingDescription('')
    setFormBookingWith('closer'); setFormBookingAssignMode('all_role')
    setFormBookingAssignedMembers([]); setFormBookingDistribution('round_robin')
    setFormTeamId(null)
  }

  const openCreate = () => { resetForm(); setIsModalOpen(true) }

  const openEdit = (campaign: Campaign) => {
    setEditingCampaign(campaign)
    setFormName(campaign.name); setFormDescription(campaign.description || '')
    setFormSource(campaign.source || 'Insta')
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
    setFormTeamId(campaign.team_id || null)
    setFormBookingWith(campaign.booking_with || 'closer')
    setFormBookingAssignMode(campaign.booking_assign_mode || 'all_role')
    setFormBookingAssignedMembers(campaign.booking_assigned_members || [])
    setFormBookingDistribution(campaign.booking_distribution || 'round_robin')
    setModalTab('general'); setIsModalOpen(true)
  }

  // Filter team members by selected team
  const filteredTeamMembers = useMemo(() => {
    if (!formTeamId) return teamMembers
    return teamMembers.filter(m => m.team_id === formTeamId || m.role === 'Owner')
  }, [teamMembers, formTeamId])

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
    booking_with: formCaptureType === 'without_rdv' ? 'setter' : formBookingWith,
    booking_assign_mode: formBookingAssignMode,
    booking_assigned_members: formBookingAssignedMembers,
    booking_distribution: formBookingDistribution,
    team_id: formTeamId || null,
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
  const [embedModalFormat, setEmbedModalFormat] = useState<'page' | 'iframe' | 'popup'>('page')
  const [embedTab, setEmbedTab] = useState<'code' | 'style'>('code')

  // Style customization
  const [styleFont, setStyleFont] = useState('Inter, system-ui, sans-serif')
  const [stylePrimaryColor, setStylePrimaryColor] = useState('#2563eb')
  const [styleBgColor, setStyleBgColor] = useState('#ffffff')
  const [styleTextColor, setStyleTextColor] = useState('#0f172a')
  const [styleRadius, setStyleRadius] = useState(12)
  const [styleLayout, setStyleLayout] = useState<'vertical' | 'horizontal'>('vertical')

  const FONTS = [
    { label: 'Inter (défaut)', value: 'Inter, system-ui, sans-serif' },
    { label: 'Poppins', value: 'Poppins, sans-serif' },
    { label: 'Roboto', value: 'Roboto, sans-serif' },
    { label: 'Open Sans', value: 'Open Sans, sans-serif' },
    { label: 'Montserrat', value: 'Montserrat, sans-serif' },
    { label: 'Lato', value: 'Lato, sans-serif' },
    { label: 'Playfair Display', value: 'Playfair Display, serif' },
  ]

  const openEmbedModal = (campaign: Campaign, format: 'page' | 'iframe' | 'popup') => {
    setEmbedModalCampaign(campaign)
    setEmbedModalFormat(format)
    setEmbedTab('code')
    setStyleFont('Inter, system-ui, sans-serif')
    setStylePrimaryColor('#2563eb')
    setStyleBgColor('#ffffff')
    setStyleTextColor('#0f172a')
    setStyleRadius(12)
    setStyleLayout('vertical')
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
    if (styleLayout === 'horizontal') params.set('layout', 'horizontal')
    return params.toString()
  }

  const getStyledIframeUrl = (slug: string) => `${getCaptureUrl(slug)}?${getStyleParams()}`

  const getIframeCode = useMemo(() => {
    if (!embedModalCampaign) return ''
    const url = getStyledIframeUrl(embedModalCampaign.slug)
    return `<iframe src="${url}" width="100%" height="800" frameborder="0" style="border:none;border-radius:${styleRadius}px;"></iframe>`
  }, [embedModalCampaign, stylePrimaryColor, styleBgColor, styleTextColor, styleRadius, styleFont, styleLayout])

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
  }, [embedModalCampaign, stylePrimaryColor, styleBgColor, styleTextColor, styleRadius, styleFont, styleLayout])

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

  const inputCls = "w-full bg-transparent border-b border-[#c4c7c7]/30 dark:border-neutral-700 py-2.5 text-sm text-[#1b1c1b] dark:text-white placeholder:text-[#444748]/40 dark:placeholder:text-neutral-500 focus:border-[#006c49] focus:ring-0 outline-none transition-all font-['Inter']"
  const selectCls = "w-full appearance-none bg-[#f5f3f2] dark:bg-neutral-800 rounded-xl border-0 px-4 py-2.5 pr-10 text-sm text-[#1b1c1b] dark:text-white font-medium focus:ring-1 focus:ring-[#006c49]/20 focus:outline-none"
  const smallInputCls = "bg-transparent border-b border-[#c4c7c7]/20 dark:border-neutral-700 px-1 py-2 text-xs text-[#1b1c1b] dark:text-white placeholder:text-[#444748]/40 dark:placeholder:text-neutral-500 focus:border-[#006c49] focus:ring-0 outline-none"

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 text-[#444748] animate-spin" /></div>
  }

  return (
    <div className="max-w-[1200px] mx-auto space-y-10 pb-12">
      {/* Header */}
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-5xl font-['Manrope'] font-extrabold tracking-tight text-[#1b1c1b] dark:text-white">Campagnes</h2>
          <p className="text-[#444748] dark:text-neutral-400 mt-2 max-w-md">Gérez vos tunnels de conversion et pages de capture depuis un tableau de bord centralisé.</p>
        </div>
        <button onClick={openCreate} className="bg-[#000000] text-white px-8 py-4 rounded-full font-['Manrope'] font-bold flex items-center gap-3 hover:bg-[#1b1c1b] transition-all active:scale-95" style={{ boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}>
          <Plus className="h-4 w-4" /> Nouvelle campagne
        </button>
      </header>

      {/* Empty state */}
      {campaigns.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-24 h-24 bg-[#efedec] dark:bg-neutral-800 rounded-full flex items-center justify-center mb-6">
            <Megaphone className="h-10 w-10 text-[#444748]/30" />
          </div>
          <h3 className="text-2xl font-['Manrope'] font-extrabold text-[#1b1c1b] dark:text-white mb-2">Aucune campagne</h3>
          <p className="text-[#444748] dark:text-neutral-400 max-w-xs mb-6">Créez votre première campagne pour capturer des leads</p>
          <button onClick={openCreate} className="bg-[#000000] text-white px-8 py-3 rounded-full font-['Manrope'] font-bold active:scale-95 transition-all">
            Créer une campagne
          </button>
        </div>
      )}

      {/* Campaign cards */}
      <div className="grid gap-8 xl:grid-cols-2">
        {campaigns.map((campaign) => {
          const leadCount = campaign.business_prospects?.[0]?.count || 0
          return (
            <div key={campaign.id} className="rounded-xl p-8 group hover:shadow-[0_30px_60px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_30px_60px_rgba(0,0,0,0.3)] transition-all duration-500 bg-white/70 dark:bg-neutral-800 backdrop-blur-xl border border-[#c4c7c7]/20 dark:border-neutral-700">
              <div className="flex justify-between items-start mb-6">
                <div className="flex gap-4 items-center">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${campaign.capture_type === 'without_rdv' ? 'bg-[#ffb95f]/10 text-[#b87500]' : 'bg-[#006c49]/10 text-[#006c49]'}`}>
                    {campaign.capture_type === 'without_rdv' ? <UserPlus className="h-6 w-6" /> : <CalendarCheck className="h-6 w-6" />}
                  </div>
                  <div>
                    <h3 className="text-xl font-['Manrope'] font-extrabold text-[#1b1c1b] dark:text-white">{campaign.name}</h3>
                    <p className="text-sm text-[#444748] dark:text-neutral-400">Source: {campaign.source}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-bold uppercase tracking-tighter ${campaign.is_active ? 'text-[#006c49]' : 'text-[#444748]'}`}>
                    {campaign.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <button onClick={() => toggleActive(campaign)} className="relative">
                    <div className={`w-10 h-5 rounded-full relative p-1 cursor-pointer transition-colors ${campaign.is_active ? 'bg-[#006c49]/20' : 'bg-[#eae8e7] dark:bg-neutral-700'}`}>
                      <div className={`w-3 h-3 rounded-full absolute transition-all ${campaign.is_active ? 'bg-[#006c49] right-1' : 'bg-[#747878] left-1'}`} />
                    </div>
                  </button>
                </div>
              </div>
              {campaign.description && <p className="text-[#444748] dark:text-neutral-400 mb-6 line-clamp-2">{campaign.description}</p>}
              <div className="flex gap-3 mb-6">
                <div className="bg-[#eae8e7] dark:bg-neutral-800 px-4 py-2 rounded-full flex items-center gap-2">
                  {campaign.capture_type === 'without_rdv' ? <UserPlus className="h-3.5 w-3.5 text-[#444748]" /> : <CalendarCheck className="h-3.5 w-3.5 text-[#444748]" />}
                  <span className="text-xs font-bold text-[#444748] dark:text-neutral-300">Capture: {campaign.capture_type === 'without_rdv' ? 'Inscription' : 'RDV'}</span>
                </div>
                <div className="bg-[#f5f3f2] dark:bg-neutral-800 px-4 py-2 rounded-full flex items-center gap-2">
                  <span className="text-xs font-bold text-[#1b1c1b] dark:text-white">{leadCount} Lead{leadCount !== 1 ? 's' : ''}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-6 border-t border-[#c4c7c7]/10 dark:border-neutral-700/30">
                <button onClick={() => openEmbedModal(campaign, 'page')} className="flex-1 bg-[#000000] text-white py-3 rounded-xl font-['Manrope'] font-bold text-xs hover:bg-[#1b1c1b] transition-colors">Page</button>
                <button onClick={() => openEmbedModal(campaign, 'iframe')} className="flex-1 bg-[#f5f3f2] dark:bg-neutral-800 text-[#1b1c1b] dark:text-white py-3 rounded-xl font-['Manrope'] font-bold text-xs hover:bg-[#eae8e7] dark:hover:bg-neutral-700 transition-colors">Iframe</button>
                <button onClick={() => openEmbedModal(campaign, 'popup')} className="flex-1 bg-[#006c49]/10 text-[#006c49] py-3 rounded-xl font-['Manrope'] font-bold text-xs hover:bg-[#006c49]/20 transition-colors" style={{ border: '1px solid rgba(0,108,73,0.2)' }}>Popup</button>
                <button onClick={() => openEdit(campaign)} className="p-3 text-[#444748] dark:text-neutral-400 hover:text-[#1b1c1b] dark:hover:text-white hover:bg-[#f5f3f2] dark:hover:bg-neutral-800 rounded-xl transition-colors" title="Modifier">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => deleteCampaign(campaign)} className="p-3 text-[#444748] hover:text-[#ba1a1a] hover:bg-[#ffdad6]/30 rounded-xl transition-colors" title="Supprimer">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal Create/Edit - Tabbed */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-neutral-900 rounded-xl overflow-hidden" style={{ boxShadow: '0 40px 100px rgba(0,0,0,0.08)', border: '0.5px solid rgba(196,199,199,0.2)' }}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-8 py-5 flex-shrink-0">
              <h3 className="text-xl font-['Manrope'] font-extrabold text-[#1b1c1b] dark:text-white">
                {editingCampaign ? 'Configuration de Campagne' : 'Nouvelle Campagne'}
              </h3>
              <button onClick={() => { setIsModalOpen(false); resetForm() }} className="p-2 rounded-full text-[#444748]/40 hover:text-[#1b1c1b] dark:hover:text-white hover:bg-[#f5f3f2] dark:hover:bg-neutral-800 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex bg-[#f5f3f2] dark:bg-neutral-800 px-8 pt-5 gap-8 border-b border-[#c4c7c7]/10 dark:border-neutral-700 flex-shrink-0 overflow-x-auto">
              {([
                { key: 'general' as const, label: 'Général' },
                { key: 'landing' as const, label: 'Page de capture' },
                { key: 'fields' as const, label: 'Champs & Options' },
                { key: 'booking' as const, label: formCaptureType === 'with_rdv' ? 'Booking' : 'Assignation' },
              ]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setModalTab(tab.key)}
                  className={`pb-4 text-sm font-['Manrope'] font-bold transition-colors whitespace-nowrap ${
                    modalTab === tab.key
                      ? 'border-b-2 border-[#000000] dark:border-white text-[#000000] dark:text-white'
                      : 'text-[#444748] dark:text-neutral-400 hover:text-[#1b1c1b] dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content - scrollable */}
            <div className="flex-1 overflow-y-auto p-8">
              {/* General tab */}
              {modalTab === 'general' && (
                <div className="space-y-8">
                  <div className="space-y-6">
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#747878] dark:text-neutral-500">Identification</label>
                    <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Nom de la campagne" className="w-full bg-transparent border-0 border-b border-[#c4c7c7]/30 dark:border-neutral-700 focus:ring-0 focus:border-[#006c49] transition-all text-xl font-['Manrope'] font-bold py-3 px-0 text-[#1b1c1b] dark:text-white placeholder:text-[#444748]/30 dark:placeholder:text-neutral-500" />
                  </div>

                  {/* Team assignment */}
                  {teams.length > 0 && (
                    <div>
                      <label className="block text-xs font-bold text-[#444748] dark:text-neutral-400 mb-2">Équipe assignée</label>
                      <div className="relative">
                        <select
                          value={formTeamId || ''}
                          onChange={(e) => { setFormTeamId(e.target.value || null); setFormBookingAssignedMembers([]) }}
                          className={selectCls}
                        >
                          <option value="">Toute l'équipe</option>
                          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#747878] pointer-events-none" />
                      </div>
                      <p className="text-[10px] text-[#444748]/60 dark:text-neutral-500 mt-1">Les bookings et assignations seront limités aux membres de cette équipe.</p>
                    </div>
                  )}

                  {/* Capture type switch */}
                  <div className="space-y-4">
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#747878] dark:text-neutral-500">Type de Capture</label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => setFormCaptureType('with_rdv')}
                        className={`p-6 rounded-xl flex flex-col items-center text-center cursor-pointer transition-all ${
                          formCaptureType === 'with_rdv'
                            ? 'border-2 border-[#006c49] bg-[#006c49]/5'
                            : 'border border-[#c4c7c7]/30 dark:border-neutral-700 hover:border-[#747878] dark:hover:border-neutral-500'
                        }`}
                      >
                        <CalendarCheck className={`h-7 w-7 mb-3 ${formCaptureType === 'with_rdv' ? 'text-[#006c49]' : 'text-[#747878]'}`} />
                        <h4 className="font-['Manrope'] font-bold text-[#1b1c1b] dark:text-white">Rendez-vous</h4>
                        <p className="text-[10px] text-[#444748] mt-1">Planification directe</p>
                      </button>
                      <button
                        onClick={() => setFormCaptureType('without_rdv')}
                        className={`p-6 rounded-xl flex flex-col items-center text-center cursor-pointer transition-all ${
                          formCaptureType === 'without_rdv'
                            ? 'border-2 border-[#006c49] bg-[#006c49]/5'
                            : 'border border-[#c4c7c7]/30 dark:border-neutral-700 hover:border-[#747878] dark:hover:border-neutral-500'
                        }`}
                      >
                        <UserPlus className={`h-7 w-7 mb-3 ${formCaptureType === 'without_rdv' ? 'text-[#006c49]' : 'text-[#747878]'}`} />
                        <h4 className="font-['Manrope'] font-bold text-[#1b1c1b] dark:text-white">Inscription</h4>
                        <p className="text-[10px] text-[#444748] mt-1">Formulaire classique</p>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#444748] dark:text-neutral-400 mb-2">Source</label>
                    <div className="relative">
                      <select value={formSource} onChange={(e) => {
                        if (e.target.value === '__new__') {
                          setIsNewSourceModalOpen(true)
                        } else {
                          setFormSource(e.target.value)
                        }
                      }} className={selectCls}>
                        {allSources.map(s => <option key={s} value={s}>{s}</option>)}
                        <option value="__new__">+ Nouvelle source</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#747878] pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#444748] dark:text-neutral-400 mb-2">Description interne</label>
                    <textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={2} placeholder="Note interne..." className={`${inputCls} resize-none`} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#444748] dark:text-neutral-400 mb-2">Paramètres UTM</label>
                    <div className="grid grid-cols-3 gap-2">
                      <input type="text" value={formUtmSource} onChange={(e) => setFormUtmSource(e.target.value)} placeholder="utm_source" className={smallInputCls} />
                      <input type="text" value={formUtmMedium} onChange={(e) => setFormUtmMedium(e.target.value)} placeholder="utm_medium" className={smallInputCls} />
                      <input type="text" value={formUtmCampaign} onChange={(e) => setFormUtmCampaign(e.target.value)} placeholder="utm_campaign" className={smallInputCls} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#444748] dark:text-neutral-400 mb-2">Formule associée</label>
                    <div className="relative">
                      <select value={formFormulaId || ''} onChange={(e) => setFormFormulaId(e.target.value || null)} className={selectCls}>
                        <option value="">Aucune formule</option>
                        {formulas.map(f => <option key={f.id} value={f.id}>{f.name} — {f.price?.toFixed(2)} €</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#747878] pointer-events-none" />
                    </div>
                    <p className="text-xs text-[#444748]/60 dark:text-neutral-500 mt-1">Les prospects capturés via cette campagne seront associés à cette formule</p>
                  </div>

                  {/* RDV with Closer or Setter switch (only with_rdv) */}
                  {formCaptureType === 'with_rdv' && (
                    <div className="rounded-xl bg-[#f5f3f2]/50 dark:bg-neutral-800/50 p-5 border border-[#c4c7c7]/10 dark:border-neutral-700">
                      <label className="block text-xs font-bold text-[#444748] dark:text-neutral-400 mb-3">Rendez-vous avec</label>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => { setFormBookingWith('closer'); setFormBookingAssignedMembers([]) }}
                          className={`flex-1 flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition-all ${
                            formBookingWith === 'closer'
                              ? 'bg-[#1b1c1b] text-white border-[#1b1c1b]'
                              : 'bg-white dark:bg-neutral-800 text-[#444748] dark:text-neutral-400 border-[#c4c7c7]/30 dark:border-neutral-700 hover:border-[#c4c7c7]/60 dark:hover:border-neutral-500'
                          }`}
                        >
                          <UserCheck className="h-4 w-4" /> Closer
                        </button>
                        <button
                          type="button"
                          onClick={() => { setFormBookingWith('setter'); setFormBookingAssignedMembers([]) }}
                          className={`flex-1 flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition-all ${
                            formBookingWith === 'setter'
                              ? 'bg-[#1b1c1b] text-white border-[#1b1c1b]'
                              : 'bg-white dark:bg-neutral-800 text-[#444748] dark:text-neutral-400 border-[#c4c7c7]/30 dark:border-neutral-700 hover:border-[#c4c7c7]/60 dark:hover:border-neutral-500'
                          }`}
                        >
                          <UserCheck className="h-4 w-4" /> Setter
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Info banner for without_rdv */}
                  {formCaptureType === 'without_rdv' && (
                    <div className="rounded-xl bg-[#f5f3f2]/50 dark:bg-neutral-800/50 p-5 border border-[#c4c7c7]/10 dark:border-neutral-700">
                      <p className="text-sm font-bold text-[#1b1c1b] dark:text-white">Campagne sans rendez-vous</p>
                      <p className="text-xs text-[#444748]/60 dark:text-neutral-500 mt-1">Les leads capturés seront assignés à un Setter pour le traitement.</p>
                    </div>
                  )}

                  {/* Assignment mode */}
                  <div className="rounded-xl bg-[#f5f3f2]/50 dark:bg-neutral-800/50 p-5 border border-[#c4c7c7]/10 dark:border-neutral-700">
                    <label className="block text-xs font-bold text-[#444748] dark:text-neutral-400 mb-3">
                      Mode d'assignation des {formCaptureType === 'without_rdv' ? 'Setters' : (formBookingWith === 'closer' ? 'Closers' : 'Setters')}
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => { setFormBookingAssignMode('specific'); setFormBookingAssignedMembers([]) }}
                        className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                          formBookingAssignMode === 'specific'
                            ? 'bg-[#1b1c1b] text-white border-[#1b1c1b]'
                            : 'bg-white dark:bg-neutral-800 text-[#444748] dark:text-neutral-400 border-[#c4c7c7]/30 dark:border-neutral-700 hover:border-[#c4c7c7]/60 dark:hover:border-neutral-500'
                        }`}
                      >
                        <UserCheck className="h-3.5 w-3.5" /> Un membre précis
                      </button>
                      <button
                        type="button"
                        onClick={() => { setFormBookingAssignMode('all_role'); setFormBookingAssignedMembers([]) }}
                        className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                          formBookingAssignMode === 'all_role'
                            ? 'bg-[#1b1c1b] text-white border-[#1b1c1b]'
                            : 'bg-white dark:bg-neutral-800 text-[#444748] dark:text-neutral-400 border-[#c4c7c7]/30 dark:border-neutral-700 hover:border-[#c4c7c7]/60 dark:hover:border-neutral-500'
                        }`}
                      >
                        <UsersRound className="h-3.5 w-3.5" /> Tout le rôle
                      </button>
                      <button
                        type="button"
                        onClick={() => { setFormBookingAssignMode('multiple'); setFormBookingAssignedMembers([]) }}
                        className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                          formBookingAssignMode === 'multiple'
                            ? 'bg-[#1b1c1b] text-white border-[#1b1c1b]'
                            : 'bg-white dark:bg-neutral-800 text-[#444748] dark:text-neutral-400 border-[#c4c7c7]/30 dark:border-neutral-700 hover:border-[#c4c7c7]/60 dark:hover:border-neutral-500'
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
                            {filteredTeamMembers
                              .filter(m => {
                                const assignRole = formCaptureType === 'without_rdv' ? 'setter' : formBookingWith
                                if (assignRole === 'closer') return m.role === 'Closer' || m.role === 'Setter-Closer' || m.role === 'Owner' || m.owner_assignable
                                return m.role === 'Setter' || m.role === 'Setter-Closer' || m.role === 'Owner' || m.owner_assignable
                              })
                              .map(m => (
                                <option key={m.id} value={m.id}>{m.first_name} {m.last_name} ({m.role})</option>
                              ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#747878] pointer-events-none" />
                        </div>
                      </div>
                    )}

                    {/* Multiple members selector */}
                    {formBookingAssignMode === 'multiple' && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs text-[#444748]/60 dark:text-neutral-500">Sélectionnez les membres à inclure :</p>
                        <div className="max-h-40 overflow-y-auto space-y-1 rounded-xl border border-[#c4c7c7]/20 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-2">
                          {filteredTeamMembers
                            .filter(m => {
                              if (formBookingWith === 'closer') return m.role === 'Closer' || m.role === 'Setter-Closer' || m.role === 'Owner' || m.owner_assignable
                              return m.role === 'Setter' || m.role === 'Setter-Closer' || m.role === 'Owner' || m.owner_assignable
                            })
                            .map(m => (
                              <label key={m.id} className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-[#f5f3f2] dark:hover:bg-neutral-700 cursor-pointer">
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
                                  className="rounded border-[#c4c7c7]/30 text-[#1b1c1b] focus:ring-[#1b1c1b]"
                                />
                                <span className="text-sm text-[#1b1c1b] dark:text-white">{m.first_name} {m.last_name}</span>
                                <span className="text-[10px] font-bold text-[#747878] dark:text-neutral-400 bg-[#f5f3f2] dark:bg-neutral-700 px-1.5 py-0.5 rounded">{m.role}</span>
                              </label>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Distribution mode (for all_role and multiple) */}
                    {(formBookingAssignMode === 'all_role' || formBookingAssignMode === 'multiple') && (
                      <div className="mt-4 pt-3 border-t border-[#c4c7c7]/15 dark:border-neutral-700">
                        <label className="block text-xs font-bold text-[#444748] dark:text-neutral-400 mb-2">Distribution des rendez-vous</label>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => setFormBookingDistribution('round_robin')}
                            className={`flex-1 flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition-all ${
                              formBookingDistribution === 'round_robin'
                                ? 'bg-[#1b1c1b] text-white border-[#1b1c1b]'
                                : 'bg-white dark:bg-neutral-800 text-[#444748] dark:text-neutral-400 border-[#c4c7c7]/30 dark:border-neutral-700 hover:border-[#c4c7c7]/60 dark:hover:border-neutral-500'
                            }`}
                          >
                            <ArrowRightCircle className="h-4 w-4" /> Tournante
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormBookingDistribution('random')}
                            className={`flex-1 flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition-all ${
                              formBookingDistribution === 'random'
                                ? 'bg-[#1b1c1b] text-white border-[#1b1c1b]'
                                : 'bg-white dark:bg-neutral-800 text-[#444748] dark:text-neutral-400 border-[#c4c7c7]/30 dark:border-neutral-700 hover:border-[#c4c7c7]/60 dark:hover:border-neutral-500'
                            }`}
                          >
                            <Shuffle className="h-4 w-4" /> Hasard
                          </button>
                        </div>
                        <p className="text-xs text-[#444748]/60 dark:text-neutral-500 mt-2">
                          {formBookingDistribution === 'round_robin'
                            ? 'Les rendez-vous sont distribués à tour de rôle entre les membres.'
                            : 'Les rendez-vous sont assignés aléatoirement.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Landing page tab */}
              {modalTab === 'landing' && (
                <div className="space-y-4">
                  <p className="text-xs text-[#444748]/60 dark:text-neutral-500 mb-2">Configurez le contenu affiché à gauche de la page de capture (côté marketing)</p>
                  <div>
                    <label className="block text-xs font-bold text-[#444748] dark:text-neutral-400 mb-2">Titre principal</label>
                    <input type="text" value={formLandingTitle} onChange={(e) => setFormLandingTitle(e.target.value)} placeholder="Ex: Transformez chaque lead en client." className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#444748] dark:text-neutral-400 mb-2">Sous-titre</label>
                    <input type="text" value={formLandingSubtitle} onChange={(e) => setFormLandingSubtitle(e.target.value)} placeholder="Ex: THE SALES OPERATING SYSTEM" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#444748] dark:text-neutral-400 mb-2">Texte descriptif</label>
                    <textarea value={formLandingText} onChange={(e) => setFormLandingText(e.target.value)} rows={3} placeholder="Décrivez votre offre, votre proposition de valeur..." className={`${inputCls} resize-none`} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#444748] dark:text-neutral-400 mb-2">URL Vidéo (YouTube, Loom...)</label>
                    <input type="url" value={formLandingVideoUrl} onChange={(e) => setFormLandingVideoUrl(e.target.value)} placeholder="https://www.youtube.com/embed/..." className={inputCls} />
                    <p className="text-xs text-[#444748]/60 dark:text-neutral-500 mt-1">Utilisez l'URL d'intégration (embed). Ex: https://www.youtube.com/embed/VIDEO_ID</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#444748] dark:text-neutral-400 mb-2">Lien de redirection post-capture</label>
                    <input type="url" value={formRedirectUrl} onChange={(e) => setFormRedirectUrl(e.target.value)} placeholder="https://www.example.com/merci" className={inputCls} />
                    <p className="text-xs text-[#444748]/60 dark:text-neutral-500 mt-1">Optionnel — Redirige le prospect vers cette URL après soumission du formulaire</p>
                  </div>

                  {/* Popup delay config */}
                  <div className="rounded-xl bg-[#f5f3f2]/50 dark:bg-neutral-800/50 p-5 border border-[#c4c7c7]/10 dark:border-neutral-700">
                    <label className="flex items-center gap-2 text-sm font-bold text-[#1b1c1b] dark:text-white mb-2">
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
                    <p className="text-xs text-[#444748]/60 dark:text-neutral-500 mt-2">S'applique quand le format Popup est utilisé. Le site est bloqué tant que le formulaire n'est pas rempli.</p>
                  </div>
                </div>
              )}

              {/* Fields & Options tab */}
              {modalTab === 'fields' && (
                <div className="space-y-5">
                  {/* Required fields config */}
                  <div>
                    <label className="block text-xs font-bold text-[#444748] dark:text-neutral-400 mb-3">Champs obligatoires du formulaire</label>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between rounded-xl border border-[#c4c7c7]/20 dark:border-neutral-700 px-4 py-3">
                        <div>
                          <p className="text-sm font-bold text-[#1b1c1b] dark:text-white">Nom</p>
                          <p className="text-xs text-[#747878] dark:text-neutral-500">Toujours requis</p>
                        </div>
                        <span className="text-[10px] font-bold text-[#747878] dark:text-neutral-500 bg-[#f5f3f2] dark:bg-neutral-800 px-2 py-1 rounded-lg">Obligatoire</span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl border border-[#c4c7c7]/20 dark:border-neutral-700 px-4 py-3">
                        <div>
                          <p className="text-sm font-bold text-[#1b1c1b] dark:text-white">Email</p>
                          <p className="text-xs text-[#747878] dark:text-neutral-500">Adresse email du lead</p>
                        </div>
                        <button
                          onClick={() => setFormEmailRequired(!formEmailRequired)}
                          className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors ${formEmailRequired ? 'bg-[#1b1c1b] text-white dark:bg-white dark:text-neutral-900' : 'bg-[#f5f3f2] text-[#747878] dark:bg-neutral-800 dark:text-neutral-500'}`}
                        >
                          {formEmailRequired ? 'Obligatoire' : 'Optionnel'}
                        </button>
                      </div>
                      <div className="flex items-center justify-between rounded-xl border border-[#c4c7c7]/20 dark:border-neutral-700 px-4 py-3">
                        <div>
                          <p className="text-sm font-bold text-[#1b1c1b] dark:text-white">Téléphone</p>
                          <p className="text-xs text-[#747878] dark:text-neutral-500">Numéro de téléphone du lead</p>
                        </div>
                        <button
                          onClick={() => setFormPhoneRequired(!formPhoneRequired)}
                          className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors ${formPhoneRequired ? 'bg-[#1b1c1b] text-white dark:bg-white dark:text-neutral-900' : 'bg-[#f5f3f2] text-[#747878] dark:bg-neutral-800 dark:text-neutral-500'}`}
                        >
                          {formPhoneRequired ? 'Obligatoire' : 'Optionnel'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Custom Fields */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-bold text-[#1b1c1b] dark:text-white">Champs personnalisés</label>
                      <button onClick={addCustomField} className="flex items-center gap-1 text-xs font-bold text-[#1b1c1b] dark:text-white hover:text-[#444748] dark:hover:text-neutral-300">
                        <Plus className="h-3.5 w-3.5" /> Ajouter un champ
                      </button>
                    </div>
                    {formCustomFields.length === 0 && (
                      <p className="text-xs text-[#747878] dark:text-neutral-500 italic">Aucun champ personnalisé. Cliquez sur "Ajouter un champ" pour en créer.</p>
                    )}
                    {formCustomFields.map((field, idx) => (
                      <div key={idx} className="flex items-center gap-2 mb-2">
                        <input type="text" value={field.label} onChange={(e) => updateCustomField(idx, { label: e.target.value })} placeholder="Nom du champ" className={`flex-1 ${smallInputCls}`} />
                        <select value={field.type} onChange={(e) => updateCustomField(idx, { type: e.target.value as CustomField['type'] })} className={`${smallInputCls} text-[#1b1c1b]`}>
                          <option value="text">Texte</option>
                          <option value="email">Email</option>
                          <option value="phone">Téléphone</option>
                          <option value="number">Numéro</option>
                          <option value="select">Sélection</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => updateCustomField(idx, { required: !field.required })}
                          className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${field.required ? 'bg-[#1b1c1b] text-white dark:bg-white dark:text-neutral-900' : 'bg-[#f5f3f2] text-[#747878] dark:bg-neutral-800 dark:text-neutral-500'}`}
                        >
                          {field.required ? 'Obligatoire' : 'Optionnel'}
                        </button>
                        <button onClick={() => removeCustomField(idx)} className="text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Booking / Assignation tab */}
              {modalTab === 'booking' && (
                <div className="space-y-5">
                  {/* Booking-specific fields (only with_rdv) */}
                  {formCaptureType === 'with_rdv' && (
                    <>
                      {/* Duration */}
                      <div>
                        <label className="block text-xs font-bold text-[#444748] dark:text-neutral-400 mb-2">Durée du rendez-vous</label>
                        <div className="flex gap-2 flex-wrap">
                          {BOOKING_DURATIONS.map(d => (
                            <button
                              key={d.value}
                              type="button"
                              onClick={() => setFormBookingDuration(d.value)}
                              className={`rounded-xl border px-4 py-2 text-sm font-bold transition-all ${
                                formBookingDuration === d.value
                                  ? 'bg-[#1b1c1b] text-white border-[#1b1c1b]'
                                  : 'bg-white dark:bg-neutral-800 text-[#444748] dark:text-neutral-400 border-[#c4c7c7]/30 dark:border-neutral-700 hover:border-[#c4c7c7]/60 dark:hover:border-neutral-500'
                              }`}
                            >
                              {d.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Title */}
                      <div>
                        <label className="block text-xs font-bold text-[#444748] dark:text-neutral-400 mb-2">Titre du rendez-vous</label>
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
                              className="rounded-lg bg-[#f5f3f2] dark:bg-neutral-800 px-2 py-1 text-[10px] font-mono text-[#444748] dark:text-neutral-400 hover:bg-[#eae8e7] dark:hover:bg-neutral-700 transition-colors"
                              title={v.label}
                            >
                              {v.var}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Description */}
                      <div>
                        <label className="block text-xs font-bold text-[#444748] dark:text-neutral-400 mb-2">Description du rendez-vous</label>
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
                              className="rounded-lg bg-[#f5f3f2] dark:bg-neutral-800 px-2 py-1 text-[10px] font-mono text-[#444748] dark:text-neutral-400 hover:bg-[#eae8e7] dark:hover:bg-neutral-700 transition-colors"
                              title={v.label}
                            >
                              {v.var}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 bg-[#f5f3f2] dark:bg-neutral-800 px-6 py-4 flex-shrink-0 rounded-b-2xl">
              <button onClick={() => { setIsModalOpen(false); resetForm() }} className="rounded-full border border-[#c4c7c7]/30 dark:border-neutral-700 px-5 py-2.5 text-sm font-bold text-[#444748] dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-800 transition-colors">
                Annuler
              </button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-full bg-[#1b1c1b] px-5 py-2.5 text-sm font-bold text-white hover:scale-105 active:scale-95 transition-all disabled:opacity-50">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingCampaign ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Embed Code Modal (Iframe & Popup) */}
      {embedModalCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-neutral-900 shadow-[0_20px_40px_rgba(27,28,27,0.08)]" style={{ boxShadow: 'inset 0 0 0 1px rgba(196,199,199,0.1), 0 20px 40px rgba(27,28,27,0.08)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-5 flex-shrink-0">
              <div className="flex items-center gap-5">
                <div>
                  <h3 className="text-xl font-extrabold text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>{embedModalCampaign.name}</h3>
                  <p className="text-xs text-[#444748] dark:text-neutral-400 mt-0.5">{embedModalFormat === 'page' ? 'Personnalisez et partagez votre page de capture' : 'Intégrez le formulaire sur votre site'}</p>
                </div>
                {/* Format toggle */}
                <div className="flex rounded-full bg-[#f5f3f2] dark:bg-neutral-800 p-1 ml-4">
                  <button
                    onClick={() => setEmbedModalFormat('page')}
                    className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-full transition-all ${
                      embedModalFormat === 'page' ? 'bg-[#1b1c1b] text-white shadow-lg' : 'text-[#444748] dark:text-neutral-400 hover:text-[#1b1c1b] dark:hover:text-white'
                    }`}
                  >
                    <Monitor className="h-3.5 w-3.5" /> Page
                  </button>
                  <button
                    onClick={() => setEmbedModalFormat('iframe')}
                    className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-full transition-all ${
                      embedModalFormat === 'iframe' ? 'bg-[#1b1c1b] text-white shadow-lg' : 'text-[#444748] dark:text-neutral-400 hover:text-[#1b1c1b] dark:hover:text-white'
                    }`}
                  >
                    <Layers className="h-3.5 w-3.5" /> Iframe
                  </button>
                  <button
                    onClick={() => setEmbedModalFormat('popup')}
                    className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-full transition-all ${
                      embedModalFormat === 'popup' ? 'bg-[#1b1c1b] text-white shadow-lg' : 'text-[#444748] dark:text-neutral-400 hover:text-[#1b1c1b] dark:hover:text-white'
                    }`}
                  >
                    <MessageSquare className="h-3.5 w-3.5" /> Popup
                  </button>
                </div>
              </div>
              <button onClick={() => setEmbedModalCampaign(null)} className="p-2 rounded-full text-[#444748]/40 hover:text-[#1b1c1b] dark:hover:text-white hover:bg-[#f5f3f2] dark:hover:bg-neutral-800 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tabs - hidden for page format */}
            {embedModalFormat !== 'page' && (
              <div className="flex px-8 flex-shrink-0 gap-1">
                <button
                  onClick={() => setEmbedTab('code')}
                  className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-full transition-all ${
                    embedTab === 'code' ? 'bg-[#1b1c1b] text-white' : 'text-[#444748] dark:text-neutral-400 hover:bg-[#f5f3f2] dark:hover:bg-neutral-800'
                  }`}
                >
                  <Code className="h-4 w-4" /> Code & Tuto
                </button>
                <button
                  onClick={() => setEmbedTab('style')}
                  className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-full transition-all ${
                    embedTab === 'style' ? 'bg-[#1b1c1b] text-white' : 'text-[#444748] dark:text-neutral-400 hover:bg-[#f5f3f2] dark:hover:bg-neutral-800'
                  }`}
                >
                  <Paintbrush className="h-4 w-4" /> Personnaliser
                </button>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto">

              {/* PAGE FORMAT */}
              {embedModalFormat === 'page' && (
                <div className="p-8 space-y-6">
                  {/* Link + Copy */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/60 dark:text-neutral-500 mb-2.5 block ml-1">Lien de la page de capture</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 flex items-center rounded-full bg-[#f5f3f2] dark:bg-neutral-800 px-5 py-3 text-sm text-[#444748] dark:text-neutral-300 font-mono truncate">
                        {getCaptureUrl(embedModalCampaign.slug)}
                      </div>
                      <button
                        onClick={() => copyToClipboard(getCaptureUrl(embedModalCampaign.slug), 'Lien')}
                        className="flex items-center gap-1.5 rounded-full bg-[#1b1c1b] px-5 py-3 text-sm font-bold text-white hover:scale-105 active:scale-95 transition-all flex-shrink-0"
                      >
                        <Copy className="h-4 w-4" /> Copier
                      </button>
                      <a
                        href={getCaptureUrl(embedModalCampaign.slug)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-full bg-[#f5f3f2] dark:bg-neutral-800 px-5 py-3 text-sm font-bold text-[#1b1c1b] dark:text-white hover:bg-[#eae8e7] dark:hover:bg-neutral-700 transition-colors flex-shrink-0"
                      >
                        <ExternalLink className="h-4 w-4" /> Ouvrir
                      </a>
                    </div>
                  </div>

                  {/* Style customization for page */}
                  <div className="flex rounded-2xl overflow-hidden min-h-[450px] bg-[#f5f3f2] dark:bg-neutral-800">
                    {/* Left: Controls */}
                    <div className="w-[260px] flex-shrink-0 p-6 space-y-5 overflow-y-auto bg-white dark:bg-neutral-900 rounded-2xl m-1">
                      <h4 className="text-sm font-extrabold text-[#1b1c1b] dark:text-white flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        <Palette className="h-4 w-4 text-[#006c49]" /> Personnaliser
                      </h4>

                      {/* Font */}
                      <div>
                        <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#444748]/60 dark:text-neutral-500 mb-2">
                          <Type className="h-3.5 w-3.5" /> Police
                        </label>
                        <select
                          value={styleFont}
                          onChange={(e) => setStyleFont(e.target.value)}
                          className="w-full rounded-full bg-[#f5f3f2] dark:bg-neutral-800 px-4 py-2.5 text-xs text-[#1b1c1b] dark:text-white font-medium focus:ring-1 focus:ring-[#006c49] focus:outline-none appearance-none cursor-pointer"
                        >
                          {FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                      </div>

                      {/* Primary color */}
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/60 dark:text-neutral-500 mb-2 block">Couleur principale</label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={stylePrimaryColor} onChange={(e) => setStylePrimaryColor(e.target.value)} className="h-8 w-8 rounded-full border-0 cursor-pointer" />
                          <input type="text" value={stylePrimaryColor} onChange={(e) => setStylePrimaryColor(e.target.value)} className="flex-1 rounded-full bg-[#f5f3f2] dark:bg-neutral-800 px-3 py-1.5 text-xs text-[#1b1c1b] dark:text-white font-mono focus:ring-1 focus:ring-[#006c49] focus:outline-none" />
                        </div>
                      </div>

                      {/* Background color */}
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/60 dark:text-neutral-500 mb-2 block">Fond</label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={styleBgColor} onChange={(e) => setStyleBgColor(e.target.value)} className="h-8 w-8 rounded-full border-0 cursor-pointer" />
                          <input type="text" value={styleBgColor} onChange={(e) => setStyleBgColor(e.target.value)} className="flex-1 rounded-full bg-[#f5f3f2] dark:bg-neutral-800 px-3 py-1.5 text-xs text-[#1b1c1b] dark:text-white font-mono focus:ring-1 focus:ring-[#006c49] focus:outline-none" />
                        </div>
                      </div>

                      {/* Text color */}
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/60 dark:text-neutral-500 mb-2 block">Texte</label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={styleTextColor} onChange={(e) => setStyleTextColor(e.target.value)} className="h-8 w-8 rounded-full border-0 cursor-pointer" />
                          <input type="text" value={styleTextColor} onChange={(e) => setStyleTextColor(e.target.value)} className="flex-1 rounded-full bg-[#f5f3f2] dark:bg-neutral-800 px-3 py-1.5 text-xs text-[#1b1c1b] dark:text-white font-mono focus:ring-1 focus:ring-[#006c49] focus:outline-none" />
                        </div>
                      </div>

                      {/* Border radius */}
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/60 dark:text-neutral-500 mb-2 block">Arrondi — {styleRadius}px</label>
                        <input type="range" min={0} max={24} value={styleRadius} onChange={(e) => setStyleRadius(Number(e.target.value))} className="w-full accent-[#006c49]" />
                        <div className="flex justify-between text-[10px] text-[#444748]/40 dark:text-neutral-600 font-bold">
                          <span>Carré</span><span>Arrondi</span>
                        </div>
                      </div>

                      {/* Layout */}
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/60 dark:text-neutral-500 mb-2 block">Disposition</label>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            onClick={() => setStyleLayout('vertical')}
                            className={`flex flex-col items-center gap-1.5 rounded-xl py-2.5 px-2 text-[10px] font-bold transition-all ${
                              styleLayout === 'vertical' ? 'bg-[#1b1c1b] text-white' : 'bg-[#f5f3f2] dark:bg-neutral-800 text-[#444748] dark:text-neutral-400 hover:bg-[#eae8e7] dark:hover:bg-neutral-700'
                            }`}
                          >
                            <div className="flex flex-col gap-0.5 w-5">
                              <div className={`h-3 rounded-sm ${styleLayout === 'vertical' ? 'bg-white/40' : 'bg-[#444748]/20'}`} />
                              <div className={`h-5 rounded-sm ${styleLayout === 'vertical' ? 'bg-white/40' : 'bg-[#444748]/20'}`} />
                            </div>
                            Vertical
                          </button>
                          <button
                            onClick={() => setStyleLayout('horizontal')}
                            className={`flex flex-col items-center gap-1.5 rounded-xl py-2.5 px-2 text-[10px] font-bold transition-all ${
                              styleLayout === 'horizontal' ? 'bg-[#1b1c1b] text-white' : 'bg-[#f5f3f2] dark:bg-neutral-800 text-[#444748] dark:text-neutral-400 hover:bg-[#eae8e7] dark:hover:bg-neutral-700'
                            }`}
                          >
                            <div className="flex gap-0.5 w-8">
                              <div className={`h-5 flex-1 rounded-sm ${styleLayout === 'horizontal' ? 'bg-white/40' : 'bg-[#444748]/20'}`} />
                              <div className={`h-5 flex-1 rounded-sm ${styleLayout === 'horizontal' ? 'bg-white/40' : 'bg-[#444748]/20'}`} />
                            </div>
                            Horizontal
                          </button>
                        </div>
                      </div>

                      {/* Styled link copy */}
                      <button
                        onClick={() => {
                          const params = new URLSearchParams()
                          if (stylePrimaryColor !== '#2563eb') params.set('pc', stylePrimaryColor.replace('#', ''))
                          if (styleBgColor !== '#ffffff') params.set('bg', styleBgColor.replace('#', ''))
                          if (styleTextColor !== '#0f172a') params.set('tc', styleTextColor.replace('#', ''))
                          if (styleRadius !== 12) params.set('br', String(styleRadius))
                          if (styleFont !== 'Inter, system-ui, sans-serif') params.set('font', styleFont.split(',')[0].trim())
                          if (styleLayout === 'horizontal') params.set('layout', 'horizontal')
                          const url = params.toString() ? `${getCaptureUrl(embedModalCampaign.slug)}?${params.toString()}` : getCaptureUrl(embedModalCampaign.slug)
                          copyToClipboard(url, 'Lien personnalisé')
                        }}
                        className="w-full flex items-center justify-center gap-2 rounded-full bg-[#1b1c1b] px-4 py-3 text-sm font-bold text-white hover:scale-[1.02] active:scale-95 transition-all"
                      >
                        <Copy className="h-4 w-4" /> Copier le lien personnalisé
                      </button>
                    </div>

                    {/* Right: Preview */}
                    <div className="flex-1 p-5 flex flex-col">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/40 mb-3 flex items-center gap-1.5">
                        <Eye className="h-3.5 w-3.5" /> Aperçu en temps réel
                      </p>
                      <div className="flex-1 rounded-2xl overflow-hidden shadow-[0_20px_40px_rgba(27,28,27,0.04)] bg-white">
                        <iframe
                          src={(() => {
                            const params = new URLSearchParams()
                            if (stylePrimaryColor !== '#2563eb') params.set('pc', stylePrimaryColor.replace('#', ''))
                            if (styleBgColor !== '#ffffff') params.set('bg', styleBgColor.replace('#', ''))
                            if (styleTextColor !== '#0f172a') params.set('tc', styleTextColor.replace('#', ''))
                            if (styleRadius !== 12) params.set('br', String(styleRadius))
                            if (styleFont !== 'Inter, system-ui, sans-serif') params.set('font', styleFont.split(',')[0].trim())
                            if (styleLayout === 'horizontal') params.set('layout', 'horizontal')
                            return params.toString() ? `${getCaptureUrl(embedModalCampaign.slug)}?${params.toString()}` : getCaptureUrl(embedModalCampaign.slug)
                          })()}
                          className="w-full h-full min-h-[450px]"
                          style={{ border: 'none' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {embedModalFormat !== 'page' && embedTab === 'code' && (
                <div className="p-8 space-y-6">
                  {/* Tutorial */}
                  <div className="rounded-2xl bg-[#f5f3f2] dark:bg-neutral-800 p-6">
                    <h4 className="text-sm font-extrabold text-[#1b1c1b] dark:text-white mb-3 flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                      <Eye className="h-4 w-4 text-[#006c49]" /> Comment ça marche
                    </h4>
                    {embedModalFormat === 'popup' ? (
                      <ol className="text-xs text-[#444748] dark:text-neutral-400 space-y-2.5">
                        {[
                          `Le popup s'affiche ${embedModalCampaign.popup_delay ? `après ${embedModalCampaign.popup_delay} secondes` : 'instantanément'} au chargement de la page`,
                          'Le site est bloqué (scroll désactivé, overlay sombre) tant que le formulaire n\'est pas rempli',
                          'Une fois le formulaire soumis, le popup disparaît et le visiteur peut naviguer normalement',
                          'Le visiteur ne reverra plus le popup grâce au localStorage',
                        ].map((step, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <span className="w-6 h-6 rounded-full bg-[#1b1c1b] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                            <span>{step}</span>
                          </li>
                        ))}
                        <li className="flex items-start gap-3">
                          <span className="w-6 h-6 rounded-full bg-[#1b1c1b] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">5</span>
                          <span>Collez le code juste avant la balise <code className="bg-white px-1.5 py-0.5 rounded-full text-[#006c49] font-mono text-[10px]">{'</body>'}</code> de votre site</span>
                        </li>
                      </ol>
                    ) : (
                      <ol className="text-xs text-[#444748] dark:text-neutral-400 space-y-2.5">
                        {[
                          'Copiez le code iframe ci-dessous',
                          'Collez-le dans le HTML de votre page, à l\'endroit où vous souhaitez afficher le formulaire',
                          'Ajustez la hauteur (height) si nécessaire',
                          'Le formulaire s\'adapte automatiquement à la largeur du conteneur',
                        ].map((step, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <span className="w-6 h-6 rounded-full bg-[#1b1c1b] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>

                  {/* Code block */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/60 dark:text-neutral-500">Code à intégrer</label>
                      <button
                        onClick={() => copyToClipboard(embedModalFormat === 'popup' ? getPopupCode : getIframeCode, `Code ${embedModalFormat}`)}
                        className="flex items-center gap-1.5 rounded-full bg-[#1b1c1b] px-4 py-2 text-xs font-bold text-white hover:scale-105 active:scale-95 transition-all"
                      >
                        <Copy className="h-3.5 w-3.5" /> Copier le code
                      </button>
                    </div>
                    <pre className="rounded-2xl bg-[#1b1c1b] p-5 text-xs text-[#006c49] overflow-x-auto max-h-[250px] overflow-y-auto whitespace-pre-wrap break-all font-mono">
                      {embedModalFormat === 'popup' ? getPopupCode : getIframeCode}
                    </pre>
                  </div>

                  {/* Quick copy other format */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => copyToClipboard(getCaptureUrl(embedModalCampaign.slug), 'Lien page entière')}
                      className="flex-1 flex items-center justify-center gap-2 rounded-full bg-[#f5f3f2] dark:bg-neutral-800 px-5 py-3 text-sm font-bold text-[#1b1c1b] dark:text-white hover:bg-[#eae8e7] dark:hover:bg-neutral-700 transition-colors"
                    >
                      <Monitor className="h-4 w-4" /> Copier lien page entière
                    </button>
                  </div>
                </div>
              )}

              {embedModalFormat !== 'page' && embedTab === 'style' && (
                <div className="flex min-h-[500px]">
                  {/* Left: Controls */}
                  <div className="w-[280px] flex-shrink-0 p-6 space-y-5 overflow-y-auto bg-white dark:bg-neutral-900">
                    <h4 className="text-sm font-extrabold text-[#1b1c1b] dark:text-white flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                      <Palette className="h-4 w-4 text-[#006c49]" /> Style
                    </h4>

                    {/* Font */}
                    <div>
                      <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#444748]/60 dark:text-neutral-500 mb-2">
                        <Type className="h-3.5 w-3.5" /> Police
                      </label>
                      <select
                        value={styleFont}
                        onChange={(e) => setStyleFont(e.target.value)}
                        className="w-full rounded-full bg-[#f5f3f2] dark:bg-neutral-800 px-4 py-2.5 text-xs text-[#1b1c1b] dark:text-white font-medium focus:ring-1 focus:ring-[#006c49] focus:outline-none appearance-none cursor-pointer"
                      >
                        {FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>

                    {/* Primary color */}
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/60 dark:text-neutral-500 mb-2 block">Couleur principale</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={stylePrimaryColor}
                          onChange={(e) => setStylePrimaryColor(e.target.value)}
                          className="h-8 w-8 rounded-full border-0 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={stylePrimaryColor}
                          onChange={(e) => setStylePrimaryColor(e.target.value)}
                          className="flex-1 rounded-full bg-[#f5f3f2] dark:bg-neutral-800 px-3 py-1.5 text-xs text-[#1b1c1b] dark:text-white font-mono focus:ring-1 focus:ring-[#006c49] focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Background color */}
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/60 dark:text-neutral-500 mb-2 block">Fond</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={styleBgColor}
                          onChange={(e) => setStyleBgColor(e.target.value)}
                          className="h-8 w-8 rounded-full border-0 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={styleBgColor}
                          onChange={(e) => setStyleBgColor(e.target.value)}
                          className="flex-1 rounded-full bg-[#f5f3f2] dark:bg-neutral-800 px-3 py-1.5 text-xs text-[#1b1c1b] dark:text-white font-mono focus:ring-1 focus:ring-[#006c49] focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Text color */}
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/60 dark:text-neutral-500 mb-2 block">Texte</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={styleTextColor}
                          onChange={(e) => setStyleTextColor(e.target.value)}
                          className="h-8 w-8 rounded-full border-0 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={styleTextColor}
                          onChange={(e) => setStyleTextColor(e.target.value)}
                          className="flex-1 rounded-full bg-[#f5f3f2] dark:bg-neutral-800 px-3 py-1.5 text-xs text-[#1b1c1b] dark:text-white font-mono focus:ring-1 focus:ring-[#006c49] focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Border radius */}
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/60 dark:text-neutral-500 mb-2 block">Arrondi des coins — {styleRadius}px</label>
                      <input
                        type="range"
                        min={0}
                        max={24}
                        value={styleRadius}
                        onChange={(e) => setStyleRadius(Number(e.target.value))}
                        className="w-full accent-[#006c49]"
                      />
                      <div className="flex justify-between text-[10px] text-[#444748]/40 dark:text-neutral-600 font-bold">
                        <span>Carré</span><span>Arrondi</span>
                      </div>
                    </div>

                    {/* Copy button */}
                    <button
                      onClick={() => copyToClipboard(embedModalFormat === 'popup' ? getPopupCode : getIframeCode, `Code ${embedModalFormat}`)}
                      className="w-full flex items-center justify-center gap-2 rounded-full bg-[#1b1c1b] px-4 py-3 text-sm font-bold text-white hover:scale-[1.02] active:scale-95 transition-all"
                    >
                      <Copy className="h-4 w-4" /> Copier le code
                    </button>
                  </div>

                  {/* Right: Live preview */}
                  <div className="flex-1 bg-[#f5f3f2] dark:bg-neutral-800 p-5 flex flex-col">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/40 mb-3 flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5" /> Aperçu en temps réel
                    </p>
                    <div className="flex-1 rounded-2xl overflow-hidden shadow-[0_20px_40px_rgba(27,28,27,0.04)] bg-white">
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
            <div className="flex justify-end bg-[#f5f3f2] dark:bg-neutral-800 px-8 py-4 flex-shrink-0 rounded-b-2xl">
              <button onClick={() => setEmbedModalCampaign(null)} className="rounded-full bg-[#1b1c1b] px-6 py-2.5 text-sm font-bold text-white hover:scale-105 active:scale-95 transition-all">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Mini-modal Nouvelle source */}
      {isNewSourceModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-extrabold text-[#1b1c1b] dark:text-white mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>Nouvelle source</h3>
            <input
              type="text"
              value={newSourceName}
              onChange={(e) => setNewSourceName(e.target.value)}
              placeholder="Nom de la source"
              className="w-full bg-transparent border-b border-[#c4c7c7]/30 dark:border-neutral-700 px-0 py-2.5 text-[#1b1c1b] dark:text-white focus:border-[#006c49] focus:outline-none mb-4 transition-colors"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreateSource()}
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setIsNewSourceModalOpen(false); setNewSourceName('') }}
                className="flex-1 border border-[#c4c7c7]/30 dark:border-neutral-700 hover:bg-[#f5f3f2] dark:hover:bg-neutral-800 text-[#444748] dark:text-neutral-300 font-bold py-2.5 rounded-full transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateSource}
                disabled={!newSourceName.trim() || savingSource}
                className="flex-1 bg-[#1b1c1b] hover:scale-105 active:scale-95 disabled:opacity-50 text-white font-bold py-2.5 rounded-full transition-all"
              >
                {savingSource ? 'Création...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
