import { useState, useEffect, useRef } from 'react'
import {
  Building2,
  Users,
  Rocket,
  Save,
  Loader2,
  Check,
  X,
  Camera,
  ZoomIn,
  ZoomOut,
  Plus,
  Trash2,
  Globe,
  Mail,
  Phone,
  MapPin,
  Receipt,
  LayoutGrid,
  ChevronDown,
  ChevronUp,
  GripVertical,
} from 'lucide-react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { supabase } from '../../lib/supabase'
import Cropper from 'react-easy-crop'
import getCroppedImg from '../../lib/image-crop'

type TabKey = 'general' | 'team' | 'billing' | 'onboarding' | 'sections'

const TEAM_SIZES = ['1', '2-5', '6-10', '11-25', '26-50', '50+']
const NICHES = [
  'Coaching',
  'Formation',
  'Consulting',
  'E-commerce',
  'SaaS',
  'Agence',
  'Immobilier',
  'Finance',
  'Santé',
  'Autre',
]

interface CustomSection {
  id: string
  title: string
  fields: { label: string; value: string }[]
  collapsed?: boolean
}

export function BusinessOrganization() {
  const { user, businessSettings, updateBusinessSettings } = useBusinessAuth()

  const [activeTab, setActiveTab] = useState<TabKey>('general')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Crop states
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)

  // Form data
  const [formData, setFormData] = useState({
    company_name: '',
    description: '',
    website: '',
    org_email: '',
    org_phone: '',
    address: '',
    logo_url: '',
    team_size: '',
    niche: '',
    niche_custom: '',
    custom_roles: [] as string[],
    onboarding_message: '',
    onboarding_video_url: '',
    onboarding_checklist: [] as string[],
    // Billing
    raison_sociale: '',
    billing_address: '',
    billing_zip: '',
    billing_city: '',
    billing_country: 'France',
    siret: '',
    tva_number: '',
    // Custom sections
    custom_sections: [] as CustomSection[],
  })

  const [newRole, setNewRole] = useState('')
  const [newChecklistItem, setNewChecklistItem] = useState('')
  const [newSectionTitle, setNewSectionTitle] = useState('')

  useEffect(() => {
    if (businessSettings) {
      setFormData({
        company_name: businessSettings.company_name || '',
        description: businessSettings.description || '',
        website: businessSettings.website || '',
        org_email: businessSettings.org_email || '',
        org_phone: businessSettings.org_phone || '',
        address: businessSettings.address || '',
        logo_url: businessSettings.logo_url || '',
        team_size: businessSettings.team_size || '',
        niche: businessSettings.niche || '',
        niche_custom: businessSettings.niche_custom || '',
        custom_roles: businessSettings.custom_roles || [],
        onboarding_message: businessSettings.onboarding_message || '',
        onboarding_video_url: businessSettings.onboarding_video_url || '',
        onboarding_checklist: businessSettings.onboarding_checklist || [],
        raison_sociale: businessSettings.raison_sociale || '',
        billing_address: businessSettings.billing_address || '',
        billing_zip: businessSettings.billing_zip || '',
        billing_city: businessSettings.billing_city || '',
        billing_country: businessSettings.billing_country || 'France',
        siret: businessSettings.siret || '',
        tva_number: businessSettings.tva_number || '',
        custom_sections: businessSettings.custom_sections || [],
      })
    }
  }, [businessSettings])

  // ─── Logo upload ───
  const handleLogoClick = () => fileInputRef.current?.click()

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      const reader = new FileReader()
      reader.addEventListener('load', () => setImageSrc(reader.result as string))
      reader.readAsDataURL(file)
      e.target.value = ''
    }
  }

  const onCropComplete = (_: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }

  const showCroppedImage = async () => {
    if (!croppedAreaPixels || !imageSrc || !user?.id) return
    setUploading(true)
    setMessage({ type: '', text: '' })
    try {
      const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels)
      if (!croppedImageBlob) throw new Error("Erreur lors de la création de l'image.")

      const fileName = `org-logo-${user.id}-${Math.random()}.jpg`
      const file = new File([croppedImageBlob], fileName, { type: 'image/jpeg' })

      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file)
      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName)
      const publicUrl = urlData.publicUrl

      setFormData(prev => ({ ...prev, logo_url: publicUrl }))
      setMessage({ type: 'success', text: 'Logo mis à jour !' })
      setImageSrc(null)
    } catch (error: any) {
      console.error('Erreur upload:', error)
      setMessage({ type: 'error', text: "Erreur lors de l'upload du logo." })
    } finally {
      setUploading(false)
    }
  }

  // ─── Save ───
  const handleSave = async () => {
    setLoading(true)
    setMessage({ type: '', text: '' })
    try {
      const { error } = await updateBusinessSettings({
        company_name: formData.company_name,
        description: formData.description,
        website: formData.website,
        org_email: formData.org_email,
        org_phone: formData.org_phone,
        address: formData.address,
        logo_url: formData.logo_url,
        team_size: formData.team_size,
        niche: formData.niche,
        niche_custom: formData.niche_custom,
        custom_roles: formData.custom_roles,
        onboarding_message: formData.onboarding_message,
        onboarding_video_url: formData.onboarding_video_url,
        onboarding_checklist: formData.onboarding_checklist,
        raison_sociale: formData.raison_sociale,
        billing_address: formData.billing_address,
        billing_zip: formData.billing_zip,
        billing_city: formData.billing_city,
        billing_country: formData.billing_country,
        siret: formData.siret,
        tva_number: formData.tva_number,
        custom_sections: formData.custom_sections,
      })
      if (error) throw error
      setMessage({ type: 'success', text: 'Organisation mise à jour avec succès !' })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erreur lors de la sauvegarde.' })
    } finally {
      setLoading(false)
    }
  }

  // ─── Roles ───
  const addRole = () => {
    const trimmed = newRole.trim()
    if (trimmed && !formData.custom_roles.includes(trimmed)) {
      setFormData(prev => ({ ...prev, custom_roles: [...prev.custom_roles, trimmed] }))
      setNewRole('')
    }
  }

  const removeRole = (role: string) => {
    setFormData(prev => ({ ...prev, custom_roles: prev.custom_roles.filter(r => r !== role) }))
  }

  // ─── Checklist ───
  const addChecklistItem = () => {
    const trimmed = newChecklistItem.trim()
    if (trimmed) {
      setFormData(prev => ({ ...prev, onboarding_checklist: [...prev.onboarding_checklist, trimmed] }))
      setNewChecklistItem('')
    }
  }

  const removeChecklistItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      onboarding_checklist: prev.onboarding_checklist.filter((_, i) => i !== index),
    }))
  }

  // ─── Custom sections ───
  const addSection = () => {
    const trimmed = newSectionTitle.trim()
    if (!trimmed) return
    const section: CustomSection = {
      id: crypto.randomUUID(),
      title: trimmed,
      fields: [],
    }
    setFormData(prev => ({ ...prev, custom_sections: [...prev.custom_sections, section] }))
    setNewSectionTitle('')
  }

  const removeSection = (id: string) => {
    setFormData(prev => ({ ...prev, custom_sections: prev.custom_sections.filter(s => s.id !== id) }))
  }

  const updateSectionTitle = (id: string, title: string) => {
    setFormData(prev => ({
      ...prev,
      custom_sections: prev.custom_sections.map(s => s.id === id ? { ...s, title } : s),
    }))
  }

  const toggleSectionCollapse = (id: string) => {
    setFormData(prev => ({
      ...prev,
      custom_sections: prev.custom_sections.map(s => s.id === id ? { ...s, collapsed: !s.collapsed } : s),
    }))
  }

  const addFieldToSection = (sectionId: string) => {
    setFormData(prev => ({
      ...prev,
      custom_sections: prev.custom_sections.map(s =>
        s.id === sectionId ? { ...s, fields: [...s.fields, { label: '', value: '' }] } : s
      ),
    }))
  }

  const updateField = (sectionId: string, fieldIndex: number, key: 'label' | 'value', val: string) => {
    setFormData(prev => ({
      ...prev,
      custom_sections: prev.custom_sections.map(s =>
        s.id === sectionId
          ? { ...s, fields: s.fields.map((f, i) => i === fieldIndex ? { ...f, [key]: val } : f) }
          : s
      ),
    }))
  }

  const removeField = (sectionId: string, fieldIndex: number) => {
    setFormData(prev => ({
      ...prev,
      custom_sections: prev.custom_sections.map(s =>
        s.id === sectionId ? { ...s, fields: s.fields.filter((_, i) => i !== fieldIndex) } : s
      ),
    }))
  }

  const tabs: { key: TabKey; label: string; icon: typeof Building2 }[] = [
    { key: 'general', label: 'Général', icon: Building2 },
    { key: 'team', label: 'Équipe', icon: Users },
    { key: 'billing', label: 'Facturation', icon: Receipt },
    { key: 'onboarding', label: 'Onboarding', icon: Rocket },
    { key: 'sections', label: 'Sections', icon: LayoutGrid },
  ]

  const inputClass = "w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all placeholder:text-slate-400"
  const labelClass = "text-xs font-bold text-slate-500 uppercase tracking-wider"

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Cropper overlay */}
      {imageSrc && (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-lg h-[400px] relative rounded-xl overflow-hidden border border-slate-700 bg-slate-900 mb-6">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
            />
          </div>
          <div className="w-full max-w-lg space-y-6">
            <div className="flex items-center gap-4 px-4">
              <ZoomOut className="h-5 w-5 text-slate-400" />
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <ZoomIn className="h-5 w-5 text-slate-400" />
            </div>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => setImageSrc(null)}
                disabled={uploading}
                className="px-6 py-3 rounded-xl border border-slate-700 text-slate-300 font-bold hover:bg-slate-800 transition-colors flex items-center gap-2"
              >
                <X className="h-4 w-4" /> Annuler
              </button>
              <button
                onClick={showCroppedImage}
                disabled={uploading}
                className="px-6 py-3 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-500 transition-colors shadow-lg shadow-amber-500/25 flex items-center gap-2"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Valider le logo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message */}
      {message.text && (
        <div className={`flex items-center gap-3 p-4 rounded-xl border ${message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {message.type === 'success' ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
          <p className="font-medium text-sm">{message.text}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white rounded-xl border border-slate-200 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8">

        {/* ─── GENERAL TAB ─── */}
        {activeTab === 'general' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">

            {/* Logo */}
            <div className="flex items-center gap-6 p-5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="relative group cursor-pointer" onClick={handleLogoClick}>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={onFileChange}
                  className="hidden"
                  accept="image/jpeg, image/png, image/webp"
                  disabled={uploading}
                />
                <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-slate-200 group-hover:border-amber-500 transition-all">
                  {formData.logo_url ? (
                    <img src={formData.logo_url} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                      <Building2 className="h-8 w-8 text-white" />
                    </div>
                  )}
                </div>
                <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {uploading ? <Loader2 className="h-6 w-6 text-white animate-spin" /> : <Camera className="h-6 w-6 text-white" />}
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Logo de l'organisation</h3>
                <p className="text-sm text-slate-500 mt-1">
                  {uploading ? 'Téléchargement en cours...' : "Cliquez pour uploader votre logo (JPG, PNG)."}
                </p>
              </div>
            </div>

            <div className="grid gap-5">
              <div className="space-y-2">
                <label className={labelClass}>Nom de l'entreprise</label>
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  className={inputClass}
                  placeholder="Nom de votre entreprise"
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className={`${inputClass} resize-none h-24`}
                  placeholder="Décrivez votre activité..."
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Site web</label>
                <div className="relative">
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className={`${inputClass} pl-11`}
                    placeholder="https://votresite.com"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className={labelClass}>Email de contact</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="email"
                      value={formData.org_email}
                      onChange={(e) => setFormData({ ...formData, org_email: e.target.value })}
                      className={`${inputClass} pl-11`}
                      placeholder="contact@entreprise.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Téléphone</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="tel"
                      value={formData.org_phone}
                      onChange={(e) => setFormData({ ...formData, org_phone: e.target.value })}
                      className={`${inputClass} pl-11`}
                      placeholder="+33 1 00 00 00 00"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Adresse</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className={`${inputClass} pl-11`}
                    placeholder="123 rue Example, 75001 Paris"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── TEAM TAB ─── */}
        {activeTab === 'team' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">

            <div className="space-y-3">
              <label className={labelClass}>Taille de l'équipe</label>
              <div className="flex flex-wrap gap-2">
                {TEAM_SIZES.map(size => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, team_size: size }))}
                    className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all border ${
                      formData.team_size === size
                        ? 'bg-amber-600 text-white border-amber-500 shadow-sm'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-800'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className={labelClass}>Secteur / Niche</label>
              <div className="flex flex-wrap gap-2">
                {NICHES.map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, niche: n, niche_custom: n === 'Autre' ? prev.niche_custom : '' }))}
                    className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all border ${
                      formData.niche === n
                        ? 'bg-amber-600 text-white border-amber-500 shadow-sm'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-800'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              {formData.niche === 'Autre' && (
                <input
                  type="text"
                  value={formData.niche_custom}
                  onChange={(e) => setFormData({ ...formData, niche_custom: e.target.value })}
                  className={`${inputClass} mt-2`}
                  placeholder="Précisez votre secteur..."
                />
              )}
            </div>

            <div className="space-y-3">
              <label className={labelClass}>Rôles personnalisés</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRole() } }}
                  className={`${inputClass} flex-1`}
                  placeholder="Ajouter un rôle..."
                />
                <button
                  type="button"
                  onClick={addRole}
                  className="px-4 py-3 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-500 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {formData.custom_roles.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.custom_roles.map(role => (
                    <span
                      key={role}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 font-medium"
                    >
                      {role}
                      <button onClick={() => removeRole(role)} className="text-amber-400 hover:text-red-500 transition-colors">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── BILLING TAB ─── */}
        {activeTab === 'billing' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">

            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-sm text-amber-800 font-medium">
                Ces informations apparaîtront sur vos factures et documents officiels.
              </p>
            </div>

            <div className="grid gap-5">
              <div className="space-y-2">
                <label className={labelClass}>Raison sociale</label>
                <input
                  type="text"
                  value={formData.raison_sociale}
                  onChange={(e) => setFormData({ ...formData, raison_sociale: e.target.value })}
                  className={inputClass}
                  placeholder="Raison sociale de votre entreprise"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className={labelClass}>SIRET</label>
                  <input
                    type="text"
                    value={formData.siret}
                    onChange={(e) => setFormData({ ...formData, siret: e.target.value })}
                    className={inputClass}
                    placeholder="123 456 789 00012"
                  />
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Numéro de TVA</label>
                  <input
                    type="text"
                    value={formData.tva_number}
                    onChange={(e) => setFormData({ ...formData, tva_number: e.target.value })}
                    className={inputClass}
                    placeholder="FR 12 345678901"
                  />
                </div>
              </div>

              <div className="h-px bg-slate-200 my-2" />

              <div className="space-y-2">
                <label className={labelClass}>Adresse de facturation</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={formData.billing_address}
                    onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
                    className={`${inputClass} pl-11`}
                    placeholder="123 rue de la Facturation"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <label className={labelClass}>Code postal</label>
                  <input
                    type="text"
                    value={formData.billing_zip}
                    onChange={(e) => setFormData({ ...formData, billing_zip: e.target.value })}
                    className={inputClass}
                    placeholder="75001"
                  />
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Ville</label>
                  <input
                    type="text"
                    value={formData.billing_city}
                    onChange={(e) => setFormData({ ...formData, billing_city: e.target.value })}
                    className={inputClass}
                    placeholder="Paris"
                  />
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Pays</label>
                  <input
                    type="text"
                    value={formData.billing_country}
                    onChange={(e) => setFormData({ ...formData, billing_country: e.target.value })}
                    className={inputClass}
                    placeholder="France"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── ONBOARDING TAB ─── */}
        {activeTab === 'onboarding' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">

            <div className="space-y-2">
              <label className={labelClass}>Message d'accueil</label>
              <textarea
                value={formData.onboarding_message}
                onChange={(e) => setFormData({ ...formData, onboarding_message: e.target.value })}
                className={`${inputClass} resize-none h-32`}
                placeholder="Bienvenue dans l'équipe ! Voici ce que vous devez savoir..."
              />
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Vidéo d'onboarding</label>
              <div className="relative">
                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="url"
                  value={formData.onboarding_video_url}
                  onChange={(e) => setFormData({ ...formData, onboarding_video_url: e.target.value })}
                  className={`${inputClass} pl-11`}
                  placeholder="https://youtube.com/watch?v=..."
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className={labelClass}>Checklist d'onboarding</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newChecklistItem}
                  onChange={(e) => setNewChecklistItem(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChecklistItem() } }}
                  className={`${inputClass} flex-1`}
                  placeholder="Ajouter une étape..."
                />
                <button
                  type="button"
                  onClick={addChecklistItem}
                  className="px-4 py-3 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-500 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {formData.onboarding_checklist.length > 0 && (
                <div className="space-y-2 mt-2">
                  {formData.onboarding_checklist.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200"
                    >
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold shrink-0">
                        {index + 1}
                      </span>
                      <span className="flex-1 text-sm text-slate-700">{item}</span>
                      <button
                        onClick={() => removeChecklistItem(index)}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── CUSTOM SECTIONS TAB ─── */}
        {activeTab === 'sections' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-sm text-slate-600">
                Créez des sections personnalisées pour organiser les informations spécifiques à votre organisation (processus internes, outils, liens utiles...).
              </p>
            </div>

            {/* Add section */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSection() } }}
                className={`${inputClass} flex-1`}
                placeholder="Nom de la nouvelle section..."
              />
              <button
                type="button"
                onClick={addSection}
                className="px-5 py-3 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-500 transition-colors flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Ajouter</span>
              </button>
            </div>

            {/* Sections list */}
            {formData.custom_sections.map(section => (
              <div
                key={section.id}
                className="rounded-xl border border-slate-200 overflow-hidden"
              >
                {/* Section header */}
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <GripVertical className="h-4 w-4 text-slate-300 shrink-0" />
                  <input
                    type="text"
                    value={section.title}
                    onChange={(e) => updateSectionTitle(section.id, e.target.value)}
                    className="flex-1 bg-transparent font-semibold text-slate-800 outline-none focus:text-amber-700 transition-colors"
                  />
                  <button
                    onClick={() => toggleSectionCollapse(section.id)}
                    className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {section.collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => removeSection(section.id)}
                    className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Section fields */}
                {!section.collapsed && (
                  <div className="p-4 space-y-3">
                    {section.fields.map((field, fi) => (
                      <div key={fi} className="flex gap-2 items-start">
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) => updateField(section.id, fi, 'label', e.target.value)}
                          className={`${inputClass} w-1/3`}
                          placeholder="Label"
                        />
                        <input
                          type="text"
                          value={field.value}
                          onChange={(e) => updateField(section.id, fi, 'value', e.target.value)}
                          className={`${inputClass} flex-1`}
                          placeholder="Valeur"
                        />
                        <button
                          onClick={() => removeField(section.id, fi)}
                          className="p-3 text-slate-400 hover:text-red-500 transition-colors shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => addFieldToSection(section.id)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-amber-600 hover:bg-amber-50 transition-colors border border-dashed border-amber-300"
                    >
                      <Plus className="h-4 w-4" />
                      Ajouter un champ
                    </button>
                  </div>
                )}
              </div>
            ))}

            {formData.custom_sections.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <LayoutGrid className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="font-medium">Aucune section personnalisée</p>
                <p className="text-sm mt-1">Créez votre première section ci-dessus</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Save button */}
      <div className="sticky bottom-4">
        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 hover:scale-[1.01]"
        >
          {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
          Enregistrer
        </button>
      </div>
    </div>
  )
}
