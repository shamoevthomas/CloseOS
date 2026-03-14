import { useState, useEffect, useRef } from 'react'
import {
  Building2,
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
  Rocket,
  ChevronDown,
  ChevronUp,
  Video,
  Type,
  ExternalLink,
  GripVertical,
  Pencil,
  LayoutGrid,
} from 'lucide-react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { supabase } from '../../lib/supabase'
import Cropper from 'react-easy-crop'
import getCroppedImg from '../../lib/image-crop'

// ─── Types ───

interface SectionBlock {
  id: string
  type: 'text' | 'video' | 'link'
  content: string
  label?: string
}

interface ContentSection {
  id: string
  title: string
  blocks: SectionBlock[]
  collapsed?: boolean
}

interface CustomTab {
  id: string
  name: string
  sections: ContentSection[]
}

// ─── Helpers ───

const inputClass = "w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all placeholder:text-slate-400"
const labelClass = "text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5"

function genId() {
  return crypto.randomUUID()
}

// ─── Section Editor ───

function SectionEditor({
  sections,
  onUpdate,
  emptyLabel,
  emptyDesc,
}: {
  sections: ContentSection[]
  onUpdate: (sections: ContentSection[]) => void
  emptyLabel: string
  emptyDesc: string
}) {
  const [newTitle, setNewTitle] = useState('')

  const addSection = () => {
    const t = newTitle.trim()
    if (!t) return
    onUpdate([...sections, { id: genId(), title: t, blocks: [] }])
    setNewTitle('')
  }

  const removeSection = (id: string) => onUpdate(sections.filter(s => s.id !== id))
  const updateTitle = (id: string, title: string) => onUpdate(sections.map(s => s.id === id ? { ...s, title } : s))
  const toggleCollapse = (id: string) => onUpdate(sections.map(s => s.id === id ? { ...s, collapsed: !s.collapsed } : s))

  const addBlock = (sectionId: string, type: SectionBlock['type']) => {
    onUpdate(sections.map(s =>
      s.id === sectionId
        ? { ...s, blocks: [...s.blocks, { id: genId(), type, content: '', label: '' }] }
        : s
    ))
  }

  const updateBlock = (sectionId: string, blockId: string, updates: Partial<SectionBlock>) => {
    onUpdate(sections.map(s =>
      s.id === sectionId
        ? { ...s, blocks: s.blocks.map(b => b.id === blockId ? { ...b, ...updates } : b) }
        : s
    ))
  }

  const removeBlock = (sectionId: string, blockId: string) => {
    onUpdate(sections.map(s =>
      s.id === sectionId
        ? { ...s, blocks: s.blocks.filter(b => b.id !== blockId) }
        : s
    ))
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSection() } }}
          className={`${inputClass} flex-1`}
          placeholder="Nom de la nouvelle section..."
        />
        <button type="button" onClick={addSection} className="px-5 py-3 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-500 transition-colors flex items-center gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Ajouter</span>
        </button>
      </div>

      {sections.map(section => (
        <div key={section.id} className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
            <GripVertical className="h-4 w-4 text-slate-300 shrink-0" />
            <input
              type="text"
              value={section.title}
              onChange={(e) => updateTitle(section.id, e.target.value)}
              className="flex-1 bg-transparent font-semibold text-slate-800 outline-none focus:text-amber-700 transition-colors text-sm"
            />
            <button onClick={() => toggleCollapse(section.id)} className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors">
              {section.collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>
            <button onClick={() => removeSection(section.id)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {!section.collapsed && (
            <div className="p-4 space-y-3">
              {section.blocks.map(block => (
                <div key={block.id} className="flex gap-2 items-start">
                  <div className="shrink-0 mt-3 w-8 flex justify-center">
                    {block.type === 'text' && <Type className="h-4 w-4 text-slate-400" />}
                    {block.type === 'video' && <Video className="h-4 w-4 text-purple-400" />}
                    {block.type === 'link' && <ExternalLink className="h-4 w-4 text-blue-400" />}
                  </div>
                  <div className="flex-1 space-y-2">
                    {block.type === 'text' && (
                      <textarea
                        value={block.content}
                        onChange={(e) => updateBlock(section.id, block.id, { content: e.target.value })}
                        className={`${inputClass} resize-none h-20 text-sm`}
                        placeholder="Écrivez votre texte ici..."
                      />
                    )}
                    {block.type === 'video' && (
                      <input
                        type="url"
                        value={block.content}
                        onChange={(e) => updateBlock(section.id, block.id, { content: e.target.value })}
                        className={`${inputClass} text-sm`}
                        placeholder="URL de la vidéo (YouTube, Loom...)"
                      />
                    )}
                    {block.type === 'link' && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={block.label || ''}
                          onChange={(e) => updateBlock(section.id, block.id, { label: e.target.value })}
                          className={`${inputClass} w-1/3 text-sm`}
                          placeholder="Titre du lien"
                        />
                        <input
                          type="url"
                          value={block.content}
                          onChange={(e) => updateBlock(section.id, block.id, { content: e.target.value })}
                          className={`${inputClass} flex-1 text-sm`}
                          placeholder="https://..."
                        />
                      </div>
                    )}
                  </div>
                  <button onClick={() => removeBlock(section.id, block.id)} className="p-2.5 text-slate-400 hover:text-red-500 transition-colors shrink-0">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}

              <div className="flex flex-wrap gap-2 pt-1">
                <button onClick={() => addBlock(section.id, 'text')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-50 transition-colors border border-dashed border-slate-300">
                  <Type className="h-3.5 w-3.5" /> Texte
                </button>
                <button onClick={() => addBlock(section.id, 'video')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-purple-500 hover:bg-purple-50 transition-colors border border-dashed border-purple-300">
                  <Video className="h-3.5 w-3.5" /> Vidéo
                </button>
                <button onClick={() => addBlock(section.id, 'link')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-blue-500 hover:bg-blue-50 transition-colors border border-dashed border-blue-300">
                  <ExternalLink className="h-3.5 w-3.5" /> Lien
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {sections.length === 0 && (
        <div className="text-center py-10 text-slate-400">
          <Plus className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="font-medium">{emptyLabel}</p>
          <p className="text-sm mt-1">{emptyDesc}</p>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ───

export function BusinessOrganization() {
  const { user, businessSettings, businessProfile, updateBusinessSettings } = useBusinessAuth()

  const [activeTab, setActiveTab] = useState('organisation')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Crop
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)

  // Renaming custom tab
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null)
  const [renamingValue, setRenamingValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  // Form
  const [formData, setFormData] = useState({
    company_name: '',
    description: '',
    website: '',
    org_email: '',
    org_phone: '',
    address: '',
    logo_url: '',
    niche: '',
    niche_custom: '',
    team_size: '',
    raison_sociale: '',
    billing_address: '',
    billing_zip: '',
    billing_city: '',
    billing_country: 'France',
    siret: '',
    tva_number: '',
    custom_tabs: [] as CustomTab[],
    onboarding_sections: [] as ContentSection[],
  })

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
        niche: businessSettings.niche || '',
        niche_custom: businessSettings.niche_custom || '',
        team_size: businessSettings.team_size || '',
        raison_sociale: businessSettings.raison_sociale || '',
        billing_address: businessSettings.billing_address || '',
        billing_zip: businessSettings.billing_zip || '',
        billing_city: businessSettings.billing_city || '',
        billing_country: businessSettings.billing_country || 'France',
        siret: businessSettings.siret || '',
        tva_number: businessSettings.tva_number || '',
        custom_tabs: businessSettings.custom_tabs || [],
        onboarding_sections: businessSettings.onboarding_sections || [],
      })
    }
  }, [businessSettings])

  // Focus rename input when it appears
  useEffect(() => {
    if (renamingTabId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renamingTabId])

  // ─── Logo ───
  const handleLogoClick = () => fileInputRef.current?.click()

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader()
      reader.addEventListener('load', () => setImageSrc(reader.result as string))
      reader.readAsDataURL(e.target.files[0])
      e.target.value = ''
    }
  }

  const onCropComplete = (_: any, pixels: any) => setCroppedAreaPixels(pixels)

  const saveCroppedImage = async () => {
    if (!croppedAreaPixels || !imageSrc || !user?.id) return
    setUploading(true)
    setMessage({ type: '', text: '' })
    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels)
      if (!blob) throw new Error("Erreur image")
      const fileName = `org-logo-${user.id}-${Math.random()}.jpg`
      const { error } = await supabase.storage.from('avatars').upload(fileName, new File([blob], fileName, { type: 'image/jpeg' }))
      if (error) throw error
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName)
      setFormData(prev => ({ ...prev, logo_url: data.publicUrl }))
      setMessage({ type: 'success', text: 'Logo mis à jour !' })
      setImageSrc(null)
    } catch {
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
      const { error } = await updateBusinessSettings(formData)
      if (error) throw error
      setMessage({ type: 'success', text: 'Organisation mise à jour avec succès !' })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erreur lors de la sauvegarde.' })
    } finally {
      setLoading(false)
    }
  }

  // ─── Custom tabs ───
  const addCustomTab = () => {
    const newTab: CustomTab = { id: genId(), name: 'Nouvel onglet', sections: [] }
    setFormData(prev => ({ ...prev, custom_tabs: [...prev.custom_tabs, newTab] }))
    setActiveTab(newTab.id)
  }

  const removeCustomTab = (id: string) => {
    setFormData(prev => ({ ...prev, custom_tabs: prev.custom_tabs.filter(t => t.id !== id) }))
    if (activeTab === id) setActiveTab('organisation')
  }

  const startRenaming = (tab: CustomTab) => {
    setRenamingTabId(tab.id)
    setRenamingValue(tab.name)
  }

  const commitRename = () => {
    if (!renamingTabId) return
    const name = renamingValue.trim() || 'Sans titre'
    setFormData(prev => ({
      ...prev,
      custom_tabs: prev.custom_tabs.map(t => t.id === renamingTabId ? { ...t, name } : t),
    }))
    setRenamingTabId(null)
  }

  const updateCustomTabSections = (tabId: string, sections: ContentSection[]) => {
    setFormData(prev => ({
      ...prev,
      custom_tabs: prev.custom_tabs.map(t => t.id === tabId ? { ...t, sections } : t),
    }))
  }

  const ownerName = businessProfile?.full_name || user?.user_metadata?.full_name || 'Propriétaire'

  const activeCustomTab = formData.custom_tabs.find(t => t.id === activeTab)

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-8">

      {/* ─── Cropper overlay ─── */}
      {imageSrc && (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-lg h-[400px] relative rounded-xl overflow-hidden border border-slate-700 bg-slate-900 mb-6">
            <Cropper image={imageSrc} crop={crop} zoom={zoom} aspect={1} onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom} />
          </div>
          <div className="w-full max-w-lg space-y-6">
            <div className="flex items-center gap-4 px-4">
              <ZoomOut className="h-5 w-5 text-slate-400" />
              <input type="range" value={zoom} min={1} max={3} step={0.1} onChange={(e) => setZoom(Number(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500" />
              <ZoomIn className="h-5 w-5 text-slate-400" />
            </div>
            <div className="flex gap-4 justify-center">
              <button onClick={() => setImageSrc(null)} disabled={uploading} className="px-6 py-3 rounded-xl border border-slate-700 text-slate-300 font-bold hover:bg-slate-800 transition-colors flex items-center gap-2">
                <X className="h-4 w-4" /> Annuler
              </button>
              <button onClick={saveCroppedImage} disabled={uploading} className="px-6 py-3 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-500 transition-colors shadow-lg shadow-amber-500/25 flex items-center gap-2">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Valider le logo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Message ─── */}
      {message.text && (
        <div className={`flex items-center gap-3 p-4 rounded-xl border ${message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {message.type === 'success' ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
          <p className="font-medium text-sm">{message.text}</p>
        </div>
      )}

      {/* ─── Tabs ─── */}
      <div className="flex items-center gap-1 p-1 bg-white rounded-xl border border-slate-200 overflow-x-auto">
        {/* Fixed tabs */}
        {[
          { key: 'organisation', label: 'Organisation', icon: Building2 },
          { key: 'onboarding', label: 'Onboarding', icon: Rocket },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap shrink-0 ${
              activeTab === tab.key
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}

        {/* Custom tabs */}
        {formData.custom_tabs.map(tab => (
          <div key={tab.id} className="flex items-center shrink-0 group relative">
            {renamingTabId === tab.id ? (
              <input
                ref={renameInputRef}
                type="text"
                value={renamingValue}
                onChange={(e) => setRenamingValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingTabId(null) }}
                className="px-3 py-2 rounded-lg text-sm font-semibold bg-amber-50 border border-amber-300 outline-none text-amber-700 w-36"
              />
            ) : (
              <button
                onClick={() => setActiveTab(tab.id)}
                onDoubleClick={() => startRenaming(tab)}
                className={`flex items-center gap-2 pl-4 pr-2 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
                {tab.name}
                <span className="flex items-center gap-0.5 ml-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); startRenaming(tab) }}
                    className={`p-1 rounded transition-colors ${activeTab === tab.id ? 'hover:bg-amber-500 text-amber-200' : 'hover:bg-slate-200 text-slate-400'}`}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeCustomTab(tab.id) }}
                    className={`p-1 rounded transition-colors ${activeTab === tab.id ? 'hover:bg-amber-500 text-amber-200' : 'hover:bg-slate-200 text-slate-400'}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              </button>
            )}
          </div>
        ))}

        {/* Add tab button */}
        <button
          onClick={addCustomTab}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-semibold text-amber-600 hover:bg-amber-50 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          Onglet
        </button>
      </div>

      {/* ═══════════════════ ORGANISATION TAB ═══════════════════ */}
      {activeTab === 'organisation' && (
        <div className="space-y-6 animate-in fade-in duration-300">

          {/* Header card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row gap-6">
              <div className="relative group cursor-pointer shrink-0 self-start" onClick={handleLogoClick}>
                <input type="file" ref={fileInputRef} onChange={onFileChange} className="hidden" accept="image/jpeg,image/png,image/webp" disabled={uploading} />
                <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-slate-200 group-hover:border-amber-500 transition-all shadow-sm">
                  {formData.logo_url ? (
                    <img src={formData.logo_url} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                      <Building2 className="h-10 w-10 text-white" />
                    </div>
                  )}
                </div>
                <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {uploading ? <Loader2 className="h-6 w-6 text-white animate-spin" /> : <Camera className="h-6 w-6 text-white" />}
                </div>
              </div>
              <div className="flex-1 space-y-4">
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  className="text-2xl font-bold text-slate-900 bg-transparent border-none outline-none w-full placeholder:text-slate-300 focus:text-amber-700 transition-colors"
                  placeholder="Nom de votre entreprise"
                />
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center text-[10px] font-bold text-amber-700">
                      {ownerName.charAt(0).toUpperCase()}
                    </div>
                    {ownerName}
                  </span>
                  {formData.website && (
                    <a href={formData.website.startsWith('http') ? formData.website : `https://${formData.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-amber-600 hover:text-amber-700 transition-colors">
                      <Globe className="h-3.5 w-3.5" />
                      {formData.website.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                  {formData.niche && (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-xs font-medium text-amber-700">
                      {formData.niche === 'Autre' ? (formData.niche_custom || 'Autre') : formData.niche}
                    </span>
                  )}
                  {formData.team_size && (
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-xs font-medium text-slate-600">
                      {formData.team_size} pers.
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Détails */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-5">
            <h3 className="text-lg font-bold text-slate-900">Détails de l'organisation</h3>

            <div className="space-y-2">
              <label className={labelClass}>Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className={`${inputClass} resize-none h-24`}
                placeholder="Ce que fait votre entreprise, vos services, votre proposition de valeur..."
              />
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Site web</label>
              <div className="relative">
                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input type="url" value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} className={`${inputClass} pl-11`} placeholder="https://votresite.com" />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className={labelClass}>Email de contact</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input type="email" value={formData.org_email} onChange={(e) => setFormData({ ...formData, org_email: e.target.value })} className={`${inputClass} pl-11`} placeholder="contact@entreprise.com" />
                </div>
              </div>
              <div className="space-y-2">
                <label className={labelClass}>Téléphone</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input type="tel" value={formData.org_phone} onChange={(e) => setFormData({ ...formData, org_phone: e.target.value })} className={`${inputClass} pl-11`} placeholder="+33 1 00 00 00 00" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Adresse</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className={`${inputClass} pl-11`} placeholder="123 rue Example, 75001 Paris" />
              </div>
            </div>
          </div>

          {/* Facturation */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-50">
                <Receipt className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Facturation</h3>
                <p className="text-xs text-slate-500">Informations pour vos factures et documents officiels</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Raison sociale</label>
              <input type="text" value={formData.raison_sociale} onChange={(e) => setFormData({ ...formData, raison_sociale: e.target.value })} className={inputClass} placeholder="Raison sociale de votre entreprise" />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className={labelClass}>SIRET</label>
                <input type="text" value={formData.siret} onChange={(e) => setFormData({ ...formData, siret: e.target.value })} className={inputClass} placeholder="123 456 789 00012" />
              </div>
              <div className="space-y-2">
                <label className={labelClass}>Numéro de TVA</label>
                <input type="text" value={formData.tva_number} onChange={(e) => setFormData({ ...formData, tva_number: e.target.value })} className={inputClass} placeholder="FR 12 345678901" />
              </div>
            </div>

            <div className="h-px bg-slate-100" />

            <div className="space-y-2">
              <label className={labelClass}>Adresse de facturation</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input type="text" value={formData.billing_address} onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })} className={`${inputClass} pl-11`} placeholder="123 rue de la Facturation" />
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className={labelClass}>Code postal</label>
                <input type="text" value={formData.billing_zip} onChange={(e) => setFormData({ ...formData, billing_zip: e.target.value })} className={inputClass} placeholder="75001" />
              </div>
              <div className="space-y-2">
                <label className={labelClass}>Ville</label>
                <input type="text" value={formData.billing_city} onChange={(e) => setFormData({ ...formData, billing_city: e.target.value })} className={inputClass} placeholder="Paris" />
              </div>
              <div className="space-y-2">
                <label className={labelClass}>Pays</label>
                <input type="text" value={formData.billing_country} onChange={(e) => setFormData({ ...formData, billing_country: e.target.value })} className={inputClass} placeholder="France" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ ONBOARDING TAB ═══════════════════ */}
      {activeTab === 'onboarding' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-50">
                <Rocket className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Onboarding</h3>
                <p className="text-xs text-slate-500">Créez le parcours d'accueil de vos nouveaux membres d'équipe</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
              <p className="text-sm text-emerald-800">
                Chaque section que vous créez ici sera présentée à vos nouveaux collaborateurs lors de leur intégration. Ajoutez des textes explicatifs, des vidéos de formation, des liens vers vos outils...
              </p>
            </div>

            <SectionEditor
              sections={formData.onboarding_sections}
              onUpdate={(s) => setFormData(prev => ({ ...prev, onboarding_sections: s }))}
              emptyLabel="Aucune section d'onboarding"
              emptyDesc="Créez votre première étape d'intégration"
            />
          </div>
        </div>
      )}

      {/* ═══════════════════ CUSTOM TABS ═══════════════════ */}
      {activeCustomTab && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-50">
                <LayoutGrid className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">{activeCustomTab.name}</h3>
                <p className="text-xs text-slate-500">Onglet personnalisé &mdash; double-cliquez sur le nom pour le renommer</p>
              </div>
            </div>

            <SectionEditor
              sections={activeCustomTab.sections}
              onUpdate={(s) => updateCustomTabSections(activeCustomTab.id, s)}
              emptyLabel="Aucune section"
              emptyDesc="Ajoutez des sections avec du texte, des vidéos ou des liens"
            />
          </div>
        </div>
      )}

      {/* ─── Save ─── */}
      <div className="sticky bottom-4 z-10">
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
