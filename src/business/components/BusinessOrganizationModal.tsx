import { useState, useEffect, useRef } from 'react'
import {
  X,
  Building2,
  Users,
  Rocket,
  Save,
  Loader2,
  Check,
  Camera,
  ZoomIn,
  ZoomOut,
  Plus,
  Trash2,
  Globe,
  Mail,
  Phone,
  MapPin,
} from 'lucide-react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { supabase } from '../../lib/supabase'
import Cropper from 'react-easy-crop'
import getCroppedImg from '../../lib/image-crop'

interface BusinessOrganizationModalProps {
  isOpen: boolean
  onClose: () => void
}

type TabKey = 'general' | 'team' | 'onboarding'

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

export function BusinessOrganizationModal({ isOpen, onClose }: BusinessOrganizationModalProps) {
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
  })

  const [newRole, setNewRole] = useState('')
  const [newChecklistItem, setNewChecklistItem] = useState('')

  useEffect(() => {
    if (isOpen && businessSettings) {
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
      })
      setMessage({ type: '', text: '' })
    }
  }, [isOpen, businessSettings])

  if (!isOpen) return null

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

  const tabButtonClass = (tabName: string) => `
    w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all
    ${activeTab === tabName
      ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-lg shadow-amber-500/20'
      : 'text-slate-400 hover:bg-white/5 hover:text-white'}
  `

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">

      {/* CROPPER OVERLAY */}
      {imageSrc && (
        <div className="absolute inset-0 z-[200] bg-black flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
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

      <div className="w-full max-w-5xl rounded-3xl border border-white/10 bg-[#020617] shadow-2xl overflow-hidden flex flex-col md:flex-row h-[700px] relative">

        {/* Background Gradients */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-amber-600/5 blur-[100px] rounded-full" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-orange-600/5 blur-[100px] rounded-full" />
        </div>

        {/* SIDEBAR */}
        <div className="w-full md:w-72 border-r border-white/5 bg-slate-900/30 p-6 flex flex-col backdrop-blur-sm z-10">
          <div className="flex items-center gap-3 mb-8 px-2">
            <div className="h-8 w-8 rounded-lg bg-amber-600 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">Organisation</h2>
          </div>

          <nav className="space-y-2 flex-1">
            <button onClick={() => setActiveTab('general')} className={tabButtonClass('general')}>
              <Building2 className="w-4 h-4" /> Général
            </button>
            <button onClick={() => setActiveTab('team')} className={tabButtonClass('team')}>
              <Users className="w-4 h-4" /> Équipe
            </button>
            <button onClick={() => setActiveTab('onboarding')} className={tabButtonClass('onboarding')}>
              <Rocket className="w-4 h-4" /> Onboarding
            </button>
          </nav>

          <button onClick={onClose} className="mt-auto flex items-center gap-2 px-4 py-3 text-slate-400 hover:text-white font-bold transition-colors rounded-xl hover:bg-white/5">
            <X className="w-4 h-4" /> Fermer
          </button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 flex flex-col bg-[#020617]/50 backdrop-blur-sm overflow-hidden text-left z-10 relative">
          <div className="px-10 py-8 border-b border-white/5 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-white text-left">
                {activeTab === 'general' && 'Informations générales'}
                {activeTab === 'team' && 'Équipe & Secteur'}
                {activeTab === 'onboarding' && 'Onboarding'}
              </h2>
              <p className="text-slate-400 text-sm mt-1 text-left">
                {activeTab === 'general' && 'Identité et coordonnées de votre organisation.'}
                {activeTab === 'team' && 'Taille, secteur et rôles personnalisés.'}
                {activeTab === 'onboarding' && "Configurez l'accueil de vos nouveaux collaborateurs."}
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-10 custom-scrollbar text-left">
            {message.text && (
              <div className={`mb-8 flex items-center gap-3 p-4 rounded-xl border ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                {message.type === 'success' ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
                <p className="font-medium text-sm">{message.text}</p>
              </div>
            )}

            {/* ─── GENERAL TAB ─── */}
            {activeTab === 'general' && (
              <div className="space-y-8 max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">

                {/* Logo */}
                <div className="flex items-center gap-6 p-6 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                  <div className="relative group cursor-pointer" onClick={handleLogoClick}>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={onFileChange}
                      className="hidden"
                      accept="image/jpeg, image/png, image/webp"
                      disabled={uploading}
                    />
                    <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-white/10 shadow-xl shadow-amber-500/20 group-hover:border-amber-500 transition-all">
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
                  <div className="text-left">
                    <h3 className="font-bold text-white text-lg">Logo de l'organisation</h3>
                    <p className="text-sm text-slate-400 mt-1">
                      {uploading ? 'Téléchargement en cours...' : "Cliquez pour uploader votre logo (JPG, PNG)."}
                    </p>
                  </div>
                </div>

                <div className="grid gap-6">
                  {/* Company name */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nom de l'entreprise</label>
                    <input
                      type="text"
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                      className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
                      placeholder="Nom de votre entreprise"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all resize-none h-24"
                      placeholder="Décrivez votre activité..."
                    />
                  </div>

                  {/* Website */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Site web</label>
                    <div className="relative">
                      <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <input
                        type="url"
                        value={formData.website}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
                        placeholder="https://votresite.com"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email de contact</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <input
                        type="email"
                        value={formData.org_email}
                        onChange={(e) => setFormData({ ...formData, org_email: e.target.value })}
                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
                        placeholder="contact@votreentreprise.com"
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Téléphone</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <input
                        type="tel"
                        value={formData.org_phone}
                        onChange={(e) => setFormData({ ...formData, org_phone: e.target.value })}
                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
                        placeholder="+33 1 00 00 00 00"
                      />
                    </div>
                  </div>

                  {/* Address */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Adresse</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <input
                        type="text"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
                        placeholder="123 rue Example, 75001 Paris"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ─── TEAM TAB ─── */}
            {activeTab === 'team' && (
              <div className="space-y-8 max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">

                {/* Team size */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Taille de l'équipe</label>
                  <div className="flex flex-wrap gap-2">
                    {TEAM_SIZES.map(size => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, team_size: size }))}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
                          formData.team_size === size
                            ? 'bg-amber-600 text-white border-amber-500 shadow-lg shadow-amber-500/20'
                            : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Niche */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Secteur / Niche</label>
                  <div className="flex flex-wrap gap-2">
                    {NICHES.map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, niche: n, niche_custom: n === 'Autre' ? prev.niche_custom : '' }))}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
                          formData.niche === n
                            ? 'bg-amber-600 text-white border-amber-500 shadow-lg shadow-amber-500/20'
                            : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-white'
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
                      className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all mt-2"
                      placeholder="Précisez votre secteur..."
                    />
                  )}
                </div>

                {/* Custom roles */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Rôles personnalisés</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRole() } }}
                      className="flex-1 bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
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
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300"
                        >
                          {role}
                          <button onClick={() => removeRole(role)} className="text-slate-500 hover:text-red-400 transition-colors">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── ONBOARDING TAB ─── */}
            {activeTab === 'onboarding' && (
              <div className="space-y-8 max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">

                {/* Welcome message */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Message d'accueil</label>
                  <textarea
                    value={formData.onboarding_message}
                    onChange={(e) => setFormData({ ...formData, onboarding_message: e.target.value })}
                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all resize-none h-32"
                    placeholder="Bienvenue dans l'équipe ! Voici ce que vous devez savoir..."
                  />
                </div>

                {/* Onboarding video */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Vidéo d'onboarding</label>
                  <div className="relative">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                      type="url"
                      value={formData.onboarding_video_url}
                      onChange={(e) => setFormData({ ...formData, onboarding_video_url: e.target.value })}
                      className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
                      placeholder="https://youtube.com/watch?v=..."
                    />
                  </div>
                </div>

                {/* Onboarding checklist */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Checklist d'onboarding</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newChecklistItem}
                      onChange={(e) => setNewChecklistItem(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChecklistItem() } }}
                      className="flex-1 bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
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
                          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10"
                        >
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-600/20 text-amber-400 text-xs font-bold shrink-0">
                            {index + 1}
                          </span>
                          <span className="flex-1 text-sm text-slate-300">{item}</span>
                          <button
                            onClick={() => removeChecklistItem(index)}
                            className="text-slate-500 hover:text-red-400 transition-colors"
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
          </div>

          {/* Save button */}
          <div className="px-10 py-6 border-t border-white/5">
            <button
              onClick={handleSave}
              disabled={loading}
              className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 hover:scale-[1.02]"
            >
              {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
