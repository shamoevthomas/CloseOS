import { useState, useEffect, useRef } from 'react'
import { PhoneInput } from '../components/PhoneInput'
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
  FileText,
  Upload,
  CheckCircle,
} from 'lucide-react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { supabase } from '../../lib/supabase'
import Cropper from 'react-easy-crop'
import getCroppedImg from '../../lib/image-crop'

// ─── Types ───

interface SectionBlock {
  id: string
  type: 'text' | 'video' | 'link' | 'pdf'
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

const stoneInputClass = "w-full bg-transparent border-b border-[#c4c7c7]/30 dark:border-neutral-700 py-2.5 text-[#1b1c1b] dark:text-white focus:border-[#006c49] focus:ring-0 outline-none transition-all placeholder:text-[#444748]/40 dark:placeholder:text-neutral-500 font-['Inter'] text-sm"
const stoneLabelClass = "block text-[10px] uppercase tracking-widest font-bold text-[#444748] dark:text-neutral-400 mb-2"

function genId() {
  return crypto.randomUUID()
}

const DEFAULT_ROLES = ['Général', 'Closer', 'Setter', 'Setter-Closer', 'Head of Sales', 'Admin']

const ONBOARDING_NOTION_URLS: Record<string, string> = {
  'owner': 'https://www.notion.so/Guide-d-onboarding-CloseOS-Business-Owner-Admin-32faef2e488f8111b6bbc202c0ffb0c8',
  'Admin': 'https://www.notion.so/Guide-d-onboarding-CloseOS-Business-Owner-Admin-32faef2e488f8111b6bbc202c0ffb0c8',
  'Head of Sales': 'https://www.notion.so/Guide-d-onboarding-CloseOS-Business-HOS-330aef2e488f80b99e45fbc867a5c418',
  'Closer': 'https://www.notion.so/Guide-d-onboarding-CloseOS-Business-Closer-330aef2e488f80139641d9b1e36c9c81',
  'Setter': 'https://www.notion.so/Guide-d-onboarding-CloseOS-Business-Setter-330aef2e488f80faac0ee4549b1bcc6d',
  'Setter-Closer': 'https://www.notion.so/Guide-d-onboarding-CloseOS-Business-Setter-Closer-330aef2e488f80db8147c828fcf27edf',
}

const blockColors: Record<string, { border: string; bg: string; text: string }> = {
  text: { border: 'border-l-[#006c49]', bg: 'bg-[#006c49]/10', text: 'text-[#006c49]' },
  video: { border: 'border-l-[#ffb95f]', bg: 'bg-[#ffddb8]/30', text: 'text-[#b87500]' },
  link: { border: 'border-l-[#5f5e5e]', bg: 'bg-[#e5e2e1]/50', text: 'text-[#474646]' },
  pdf: { border: 'border-l-[#ba1a1a]', bg: 'bg-[#ba1a1a]/10', text: 'text-[#ba1a1a]' },
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

  const [pdfUploading, setPdfUploading] = useState<string | null>(null)

  const handlePdfUpload = async (sectionId: string, blockId: string, file: File) => {
    setPdfUploading(blockId)
    try {
      const fileName = `${genId()}-${file.name}`
      const { error } = await supabase.storage.from('onboarding-pdfs').upload(fileName, file)
      if (error) throw error
      const { data } = supabase.storage.from('onboarding-pdfs').getPublicUrl(fileName)
      updateBlock(sectionId, blockId, { content: data.publicUrl, label: file.name })
    } catch (err) {
      console.error('PDF upload error:', err)
    } finally {
      setPdfUploading(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Add new section input */}
      <div className="flex gap-3">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSection() } }}
          className={`${stoneInputClass} flex-1 border border-[#c4c7c7]/20 dark:border-neutral-700 rounded-xl px-4 py-3 bg-white dark:bg-neutral-800`}
          placeholder="Nom de la nouvelle section..."
        />
        <button type="button" onClick={addSection} className="px-6 py-3 rounded-full bg-[#000000] text-white font-['Manrope'] font-extrabold text-sm hover:bg-[#1b1c1b] transition-all active:scale-95 flex items-center gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Ajouter</span>
        </button>
      </div>

      {sections.map(section => (
        <div key={section.id} className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '0.5px solid rgba(196,199,199,0.2)' }}>
          <div className="flex items-center gap-2 px-3 md:px-5 py-4 bg-[#f5f3f2]/60 dark:bg-neutral-800/60 min-h-[44px]">
            <GripVertical className="h-4 w-4 text-[#c4c7c7] shrink-0" />
            <input
              type="text"
              value={section.title}
              onChange={(e) => updateTitle(section.id, e.target.value)}
              className="flex-1 bg-transparent font-['Manrope'] font-extrabold text-[#1b1c1b] dark:text-white outline-none focus:text-[#006c49] transition-colors text-sm"
            />
            <button onClick={() => toggleCollapse(section.id)} className="p-1.5 text-[#444748] hover:text-[#1b1c1b] transition-colors">
              {section.collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>
            <button onClick={() => removeSection(section.id)} className="p-1.5 text-[#444748] hover:text-[#ba1a1a] transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {!section.collapsed && (
            <div className="p-5 space-y-4">
              {section.blocks.map(block => {
                const colors = blockColors[block.type]
                return (
                  <div key={block.id} className={`rounded-xl p-5 flex items-start gap-5 border-l-4 ${colors.border}`} style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '0.5px solid rgba(196,199,199,0.2)', borderLeftWidth: '4px' }}>
                    <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center ${colors.text} shrink-0`}>
                      {block.type === 'text' && <Type className="h-4 w-4" />}
                      {block.type === 'video' && <Video className="h-4 w-4" />}
                      {block.type === 'link' && <ExternalLink className="h-4 w-4" />}
                      {block.type === 'pdf' && <FileText className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 space-y-2">
                      {block.type === 'text' && (
                        <textarea
                          value={block.content}
                          onChange={(e) => updateBlock(section.id, block.id, { content: e.target.value })}
                          className={`${stoneInputClass} resize-none h-20 border-b border-[#c4c7c7]/20`}
                          placeholder="Écrivez votre texte ici..."
                        />
                      )}
                      {block.type === 'video' && (
                        <input
                          type="url"
                          value={block.content}
                          onChange={(e) => updateBlock(section.id, block.id, { content: e.target.value })}
                          className={stoneInputClass}
                          placeholder="URL de la vidéo (YouTube, Loom...)"
                        />
                      )}
                      {block.type === 'link' && (
                        <div className="flex flex-col gap-2">
                          <input
                            type="text"
                            value={block.label || ''}
                            onChange={(e) => updateBlock(section.id, block.id, { label: e.target.value })}
                            className={stoneInputClass}
                            placeholder="Titre du lien"
                          />
                          <input
                            type="url"
                            value={block.content}
                            onChange={(e) => updateBlock(section.id, block.id, { content: e.target.value })}
                            className={stoneInputClass}
                            placeholder="https://..."
                          />
                        </div>
                      )}
                      {block.type === 'pdf' && (
                        <div>
                          {block.content ? (
                            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#ba1a1a]/5">
                              <FileText className="h-5 w-5 text-[#ba1a1a] shrink-0" />
                              <span className="text-sm font-medium text-[#1b1c1b] truncate flex-1">{block.label || 'PDF'}</span>
                              <a href={block.content} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-[#ba1a1a] hover:underline shrink-0">Voir</a>
                            </div>
                          ) : (
                            <label className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-[#ba1a1a]/20 cursor-pointer hover:bg-[#ba1a1a]/5 transition-colors">
                              {pdfUploading === block.id ? (
                                <Loader2 className="h-5 w-5 text-[#ba1a1a] animate-spin shrink-0" />
                              ) : (
                                <Upload className="h-5 w-5 text-[#ba1a1a]/40 shrink-0" />
                              )}
                              <span className="text-sm text-[#444748]">{pdfUploading === block.id ? 'Upload en cours...' : 'Choisir un fichier PDF'}</span>
                              <input
                                type="file"
                                accept=".pdf"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0]
                                  if (f) handlePdfUpload(section.id, block.id, f)
                                  e.target.value = ''
                                }}
                              />
                            </label>
                          )}
                        </div>
                      )}
                    </div>
                    <button onClick={() => removeBlock(section.id, block.id)} className="p-2 text-[#444748] hover:text-[#ba1a1a] transition-colors shrink-0">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )
              })}

              {/* Add block buttons */}
              <div className="flex flex-wrap gap-3 pt-2">
                {[
                  { type: 'text' as const, label: 'Texte', Icon: Type, color: 'text-[#006c49]', hover: 'hover:border-[#006c49] hover:bg-[#006c49]/5' },
                  { type: 'video' as const, label: 'Vidéo', Icon: Video, color: 'text-[#b87500]', hover: 'hover:border-[#ffb95f] hover:bg-[#ffddb8]/20' },
                  { type: 'link' as const, label: 'Lien', Icon: ExternalLink, color: 'text-[#474646]', hover: 'hover:border-[#474646] hover:bg-[#e5e2e1]/30' },
                  { type: 'pdf' as const, label: 'PDF', Icon: FileText, color: 'text-[#ba1a1a]', hover: 'hover:border-[#ba1a1a] hover:bg-[#ba1a1a]/5' },
                ].map(({ type, label, Icon, color, hover }) => (
                  <button key={type} onClick={() => addBlock(section.id, type)} className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${color} border-2 border-dashed border-[#c4c7c7]/20 ${hover} transition-all`}>
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      {sections.length === 0 && (
        <div className="text-center py-16">
          <div className="w-20 h-20 bg-[#efedec] dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Plus className="h-8 w-8 text-[#444748]/30" />
          </div>
          <p className="font-['Manrope'] font-extrabold text-[#1b1c1b] dark:text-white text-lg mb-1">{emptyLabel}</p>
          <p className="text-sm text-[#444748] dark:text-neutral-400">{emptyDesc}</p>
        </div>
      )}
    </div>
  )
}

// ─── Section Viewer (read-only for team members) ───

function SectionViewer({ sections }: { sections: ContentSection[] }) {
  if (!sections || sections.length === 0) {
    return <p className="text-sm text-[#444748] text-center py-8">Aucun contenu disponible.</p>
  }

  return (
    <div className="space-y-5">
      {sections.map(section => (
        <div key={section.id} className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '0.5px solid rgba(196,199,199,0.2)' }}>
          <div className="px-5 py-4 bg-[#f5f3f2]/60 dark:bg-neutral-800/60">
            <h4 className="font-['Manrope'] font-extrabold text-[#1b1c1b] dark:text-white text-sm">{section.title}</h4>
          </div>
          <div className="p-5 space-y-4">
            {section.blocks.map(block => {
              const colors = blockColors[block.type]
              return (
                <div key={block.id} className={`rounded-xl p-5 flex items-start gap-5 border-l-4 ${colors.border}`} style={{ background: 'rgba(255,255,255,0.5)', border: '0.5px solid rgba(196,199,199,0.15)', borderLeftWidth: '4px' }}>
                  <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center ${colors.text} shrink-0`}>
                    {block.type === 'text' && <Type className="h-4 w-4" />}
                    {block.type === 'video' && <Video className="h-4 w-4" />}
                    {block.type === 'link' && <ExternalLink className="h-4 w-4" />}
                    {block.type === 'pdf' && <FileText className="h-4 w-4" />}
                  </div>
                  <div className="flex-1">
                    {block.type === 'text' && (
                      <p className="text-sm text-[#444748] whitespace-pre-wrap leading-relaxed">{block.content}</p>
                    )}
                    {block.type === 'video' && block.content && (
                      <div className="rounded-xl overflow-hidden bg-black aspect-video">
                        <iframe
                          src={block.content.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
                          className="w-full h-full"
                          allowFullScreen
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        />
                      </div>
                    )}
                    {block.type === 'link' && block.content && (
                      <a
                        href={block.content.startsWith('http') ? block.content : `https://${block.content}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-[#006c49] hover:underline font-medium transition-colors"
                      >
                        <ExternalLink className="h-4 w-4 shrink-0" />
                        {block.label || block.content}
                      </a>
                    )}
                    {block.type === 'pdf' && block.content && (
                      <a
                        href={block.content}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm font-medium text-[#ba1a1a] hover:underline transition-colors"
                      >
                        <FileText className="h-4 w-4 shrink-0" />
                        {block.label || 'Voir le PDF'}
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
            {section.blocks.length === 0 && (
              <p className="text-xs text-[#444748]/50 italic">Section vide</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Team Member Read-Only View ───

function TeamMemberOrganizationView() {
  const { businessSettings, teamMember, refreshProfile } = useBusinessAuth()
  const [activeTab, setActiveTab] = useState('organisation')
  const [ackLoading, setAckLoading] = useState(false)

  const settings = businessSettings || {}
  const onboardingSections: ContentSection[] = settings.onboarding_sections || []
  const roleOnboardingSections: Record<string, ContentSection[]> = settings.role_onboarding_sections || {}
  const customTabs: CustomTab[] = settings.custom_tabs || []

  const memberRole = teamMember?.role || ''
  const roleSections: ContentSection[] = roleOnboardingSections[memberRole] || []
  const hasAcknowledged = !!teamMember?.onboarding_acknowledged

  const activeCustomTab = customTabs.find(t => t.id === activeTab)

  const handleAcknowledge = async () => {
    if (!teamMember?.id) return
    setAckLoading(true)
    try {
      await fetch('/api/business?action=acknowledge-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_member_id: teamMember.id }),
      })
      await refreshProfile()
    } catch (err) {
      console.error('Acknowledge error:', err)
    } finally {
      setAckLoading(false)
    }
  }

  const allTabs = [
    { key: 'organisation', label: 'Organisation' },
    { key: 'onboarding', label: 'Onboarding' },
    ...customTabs.map(t => ({ key: t.id, label: t.name })),
  ]

  return (
    <div className="max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-2xl md:text-4xl lg:text-5xl font-extrabold font-['Manrope'] tracking-tight text-[#1b1c1b] dark:text-white leading-none">Organisation</h1>
        <p className="text-[#444748] dark:text-neutral-400 mt-3 leading-relaxed max-w-xl">Informations et parcours d'intégration de votre organisation.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 md:gap-10 mb-10 border-b border-[#c4c7c7]/10 dark:border-neutral-800 overflow-x-auto whitespace-nowrap">
        {allTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`pb-4 font-['Manrope'] font-extrabold text-sm tracking-tight transition-colors shrink-0 ${
              activeTab === tab.key
                ? 'border-b-2 border-[#000000] text-[#000000]'
                : 'text-[#444748] hover:text-[#1b1c1b]'
            }`}
          >
            {tab.label.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Organisation tab (read-only) */}
      {activeTab === 'organisation' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* Header card */}
          <div className="bg-white dark:bg-neutral-800 rounded-xl p-8" style={{ boxShadow: '0 20px 40px rgba(27,28,27,0.04)' }}>
            <div className="flex flex-col sm:flex-row gap-6">
              <div className="w-28 h-28 rounded-full overflow-hidden shrink-0" style={{ background: 'linear-gradient(135deg, #fbf9f8 0%, #f5f3f2 100%)', border: '2px dashed rgba(196,199,199,0.3)' }}>
                {settings.logo_url ? (
                  <img src={settings.logo_url} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Building2 className="h-10 w-10 text-[#747878]" />
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-3">
                <h2 className="text-3xl font-extrabold font-['Manrope'] tracking-tight text-[#1b1c1b] dark:text-white">{settings.company_name || 'Organisation'}</h2>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[#444748]">
                  {settings.website && (
                    <a href={settings.website.startsWith('http') ? settings.website : `https://${settings.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[#006c49] hover:underline transition-colors">
                      <Globe className="h-3.5 w-3.5" />
                      {settings.website.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                  {settings.niche && (
                    <span className="px-3 py-1 rounded-full bg-[#eae8e7] text-[10px] font-bold uppercase tracking-widest text-[#444748]">
                      {settings.niche === 'Autre' ? (settings.niche_custom || 'Autre') : settings.niche}
                    </span>
                  )}
                  {settings.team_size && (
                    <span className="px-3 py-1 rounded-full bg-[#eae8e7] text-[10px] font-bold uppercase tracking-widest text-[#444748]">
                      {settings.team_size} pers.
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="bg-white dark:bg-neutral-800 rounded-xl p-8 space-y-6" style={{ boxShadow: '0 20px 40px rgba(27,28,27,0.04)' }}>
            <h3 className="font-['Manrope'] font-extrabold text-xl text-[#1b1c1b] dark:text-white">Informations</h3>

            {settings.description && (
              <div>
                <p className={stoneLabelClass}>Description</p>
                <p className="text-sm text-[#444748] dark:text-neutral-400 leading-relaxed whitespace-pre-wrap">{settings.description}</p>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              {settings.org_email && (
                <div className="flex items-center gap-3 rounded-xl bg-[#f5f3f2] dark:bg-neutral-900 px-4 py-3">
                  <Mail className="h-4 w-4 text-[#747878] shrink-0" />
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-[#444748]">Email</p>
                    <p className="text-sm font-medium text-[#1b1c1b] dark:text-white">{settings.org_email}</p>
                  </div>
                </div>
              )}
              {settings.org_phone && (
                <div className="flex items-center gap-3 rounded-xl bg-[#f5f3f2] dark:bg-neutral-900 px-4 py-3">
                  <Phone className="h-4 w-4 text-[#747878] shrink-0" />
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-[#444748]">Téléphone</p>
                    <p className="text-sm font-medium text-[#1b1c1b] dark:text-white">{settings.org_phone}</p>
                  </div>
                </div>
              )}
            </div>

            {settings.address && (
              <div className="flex items-center gap-3 rounded-xl bg-[#f5f3f2] dark:bg-neutral-900 px-4 py-3">
                <MapPin className="h-4 w-4 text-[#747878] shrink-0" />
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-[#444748]">Adresse</p>
                  <p className="text-sm font-medium text-[#1b1c1b] dark:text-white">{settings.address}</p>
                </div>
              </div>
            )}

            {!settings.description && !settings.org_email && !settings.org_phone && !settings.address && (
              <p className="text-sm text-[#444748] text-center py-4">Aucune information renseignée par l'organisation.</p>
            )}
          </div>
        </div>
      )}

      {/* Onboarding tab (read-only) */}
      {activeTab === 'onboarding' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* Notion onboarding guide */}
          {ONBOARDING_NOTION_URLS[memberRole] && (
            <a
              href={ONBOARDING_NOTION_URLS[memberRole]}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-[#000000] hover:bg-[#1b1c1b] rounded-2xl p-8 transition-all active:scale-[0.99] group"
              style={{ boxShadow: '0 20px 40px rgba(27,28,27,0.15)' }}
            >
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <Rocket className="h-7 w-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-['Manrope'] font-extrabold text-2xl text-white leading-tight">📖 Guide d'onboarding — {memberRole}</h3>
                  <p className="text-white/60 text-sm mt-1 font-medium">Lecture obligatoire avant de commencer. Cliquez pour ouvrir le guide complet.</p>
                </div>
                <ExternalLink className="h-6 w-6 text-white/40 group-hover:text-white transition-colors shrink-0" />
              </div>
            </a>
          )}

          {/* General onboarding */}
          <div className="bg-white dark:bg-neutral-800 rounded-xl p-8 space-y-6" style={{ boxShadow: '0 20px 40px rgba(27,28,27,0.04)' }}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-[#006c49]/10 flex items-center justify-center text-[#006c49]">
                <Rocket className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-['Manrope'] font-extrabold text-xl text-[#1b1c1b] dark:text-white">Onboarding général</h3>
                <p className="text-xs text-[#444748] dark:text-neutral-400">Parcours d'intégration de votre organisation</p>
              </div>
            </div>

            <SectionViewer sections={onboardingSections} />
          </div>

          {/* Role-specific onboarding */}
          {roleSections.length > 0 && (
            <div className="bg-white dark:bg-neutral-800 rounded-xl p-8 space-y-6" style={{ boxShadow: '0 20px 40px rgba(27,28,27,0.04)' }}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-[#ffddb8]/30 flex items-center justify-center text-[#b87500]">
                  <Rocket className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-['Manrope'] font-extrabold text-xl text-[#1b1c1b] dark:text-white">Onboarding {memberRole}</h3>
                  <p className="text-xs text-[#444748] dark:text-neutral-400">Parcours spécifique à votre rôle</p>
                </div>
              </div>

              <SectionViewer sections={roleSections} />
            </div>
          )}

          {/* Acknowledgment */}
          {!hasAcknowledged && (
            <button
              onClick={handleAcknowledge}
              disabled={ackLoading}
              className="w-full bg-[#000000] hover:bg-[#1b1c1b] text-white px-6 py-4 rounded-full font-['Manrope'] font-extrabold text-sm tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
            >
              {ackLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <CheckCircle className="h-5 w-5" />
              )}
              J'AI BIEN PRIS CONNAISSANCE DE L'ONBOARDING
            </button>
          )}

          {hasAcknowledged && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-[#006c49]/5 text-[#006c49]">
              <CheckCircle className="h-5 w-5 shrink-0" />
              <p className="font-medium text-sm">Vous avez validé l'onboarding.</p>
            </div>
          )}
        </div>
      )}

      {/* Custom tabs (read-only) */}
      {activeCustomTab && (
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-neutral-800 rounded-xl p-8 space-y-6" style={{ boxShadow: '0 20px 40px rgba(27,28,27,0.04)' }}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-[#e5e2e1]/50 flex items-center justify-center text-[#474646]">
                <LayoutGrid className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-['Manrope'] font-extrabold text-xl text-[#1b1c1b] dark:text-white">{activeCustomTab.name}</h3>
              </div>
            </div>

            <SectionViewer sections={activeCustomTab.sections} />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ───

export function BusinessOrganization() {
  const { user, businessSettings, businessProfile, updateBusinessSettings, isTeamMember, teamMember, ownerUserId, refreshProfile } = useBusinessAuth()

  const isHoS = isTeamMember && (teamMember?.role === 'Head of Sales' || teamMember?.role === 'Admin')

  // Team member (non-HOS) → read-only spectator view
  if (isTeamMember && !isHoS) {
    return <TeamMemberOrganizationView />
  }

  const [activeTab, setActiveTab] = useState(isHoS ? 'onboarding' : 'organisation')
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
    role_onboarding_sections: {} as Record<string, ContentSection[]>,
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
        role_onboarding_sections: businessSettings.role_onboarding_sections || {},
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
      if (isHoS) {
        // HOS: save only onboarding + custom tabs via API
        const res = await fetch('/api/business?action=update-org-content', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            team_member_id: teamMember.id,
            onboarding_sections: formData.onboarding_sections,
            role_onboarding_sections: formData.role_onboarding_sections,
            custom_tabs: formData.custom_tabs,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erreur')
        await refreshProfile()
      } else {
        const { error } = await updateBusinessSettings(formData)
        if (error) throw error
      }
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

  const [selectedOnboardingRole, setSelectedOnboardingRole] = useState('Général')

  const ownerName = businessProfile?.full_name || user?.user_metadata?.full_name || 'Propriétaire'

  const activeCustomTab = formData.custom_tabs.find(t => t.id === activeTab)

  return (
    <div className="max-w-5xl mx-auto pb-12">

      {/* ─── Cropper overlay ─── */}
      {!isHoS && imageSrc && (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-full md:max-w-lg h-[300px] md:h-[400px] relative rounded-xl overflow-hidden border border-[#444748]/20 bg-[#1b1c1b] mb-6">
            <Cropper image={imageSrc} crop={crop} zoom={zoom} aspect={1} onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom} />
          </div>
          <div className="w-full max-w-lg space-y-6">
            <div className="flex items-center gap-4 px-4">
              <ZoomOut className="h-5 w-5 text-[#747878]" />
              <input type="range" value={zoom} min={1} max={3} step={0.1} onChange={(e) => setZoom(Number(e.target.value))} className="w-full h-2 bg-[#444748] rounded-lg appearance-none cursor-pointer accent-[#ffb95f]" />
              <ZoomIn className="h-5 w-5 text-[#747878]" />
            </div>
            <div className="flex gap-4 justify-center">
              <button onClick={() => setImageSrc(null)} disabled={uploading} className="px-6 py-3 rounded-full border border-[#444748] text-[#c4c7c7] font-['Manrope'] font-bold hover:bg-[#1b1c1b] transition-colors flex items-center gap-2">
                <X className="h-4 w-4" /> Annuler
              </button>
              <button onClick={saveCroppedImage} disabled={uploading} className="px-6 py-3 rounded-full bg-white text-[#000000] font-['Manrope'] font-extrabold hover:bg-[#f5f3f2] transition-colors flex items-center gap-2">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Valider le logo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Message ─── */}
      {message.text && (
        <div className={`flex items-center gap-3 p-4 rounded-xl mb-6 ${message.type === 'success' ? 'bg-[#006c49]/5 text-[#006c49]' : 'bg-[#ffdad6] text-[#93000a]'}`}>
          {message.type === 'success' ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
          <p className="font-medium text-sm">{message.text}</p>
        </div>
      )}

      {/* ─── Page Header ─── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
        <div>
          <h1 className="text-2xl md:text-4xl lg:text-5xl font-extrabold font-['Manrope'] tracking-tight text-[#1b1c1b] dark:text-white leading-none">Organisation</h1>
          <p className="text-[#444748] dark:text-neutral-400 mt-3 leading-relaxed max-w-xl">Personnalisez votre identité de marque et définissez les parcours d'intégration de votre équipe.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          className="bg-[#000000] text-white px-8 py-4 rounded-full font-['Manrope'] font-extrabold text-sm tracking-widest hover:bg-[#1b1c1b] transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
          ENREGISTRER
        </button>
      </div>

      {/* ─── Tabs ─── */}
      <div className="flex gap-10 mb-10 border-b border-[#c4c7c7]/10 dark:border-neutral-800 overflow-x-auto">
        {/* Fixed tabs */}
        {[
          { key: 'organisation', label: 'ORGANISATION' },
          { key: 'onboarding', label: 'ONBOARDING' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`pb-4 font-['Manrope'] font-extrabold text-sm tracking-tight transition-colors whitespace-nowrap shrink-0 ${
              activeTab === tab.key
                ? 'border-b-2 border-[#000000] text-[#000000]'
                : 'text-[#444748] hover:text-[#1b1c1b]'
            }`}
          >
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
                className="px-3 py-2 rounded-lg text-sm font-['Manrope'] font-bold bg-[#f5f3f2] dark:bg-neutral-800 border border-[#c4c7c7]/30 dark:border-neutral-700 outline-none text-[#1b1c1b] dark:text-white w-36"
              />
            ) : (
              <button
                onClick={() => setActiveTab(tab.id)}
                onDoubleClick={() => startRenaming(tab)}
                className={`flex items-center gap-2 pb-4 font-['Manrope'] font-extrabold text-sm tracking-tight transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-b-2 border-[#000000] text-[#000000]'
                    : 'text-[#444748] hover:text-[#1b1c1b]'
                }`}
              >
                {tab.name.toUpperCase()}
                <span className="flex items-center gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); startRenaming(tab) }}
                    className="p-1 rounded-full hover:bg-[#f5f3f2] text-[#747878] transition-colors"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeCustomTab(tab.id) }}
                    className="p-1 rounded-full hover:bg-[#ffdad6] text-[#747878] hover:text-[#ba1a1a] transition-colors"
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
          className="flex items-center gap-1.5 pb-4 font-['Manrope'] font-bold text-sm text-[#747878] hover:text-[#000000] transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          ONGLET
        </button>
      </div>

      {/* ═══════════════════ ORGANISATION TAB (HoS read-only) ═══════════════════ */}
      {isHoS && activeTab === 'organisation' && (() => {
        const settings = businessSettings || {}
        return (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Header card */}
            <div className="bg-white dark:bg-neutral-800 rounded-xl p-8" style={{ boxShadow: '0 20px 40px rgba(27,28,27,0.04)' }}>
              <div className="flex flex-col sm:flex-row gap-6">
                <div className="w-28 h-28 rounded-full overflow-hidden shrink-0" style={{ background: 'linear-gradient(135deg, #fbf9f8 0%, #f5f3f2 100%)', border: '2px dashed rgba(196,199,199,0.3)' }}>
                  {settings.logo_url ? (
                    <img src={settings.logo_url} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Building2 className="h-10 w-10 text-[#747878]" />
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-3">
                  <h2 className="text-3xl font-extrabold font-['Manrope'] tracking-tight text-[#1b1c1b] dark:text-white">{settings.company_name || 'Organisation'}</h2>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[#444748]">
                    {settings.website && (
                      <a href={settings.website.startsWith('http') ? settings.website : `https://${settings.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[#006c49] hover:underline transition-colors">
                        <Globe className="h-3.5 w-3.5" />
                        {settings.website.replace(/^https?:\/\//, '')}
                      </a>
                    )}
                    {settings.niche && (
                      <span className="px-3 py-1 rounded-full bg-[#eae8e7] text-[10px] font-bold uppercase tracking-widest text-[#444748]">
                        {settings.niche === 'Autre' ? (settings.niche_custom || 'Autre') : settings.niche}
                      </span>
                    )}
                    {settings.team_size && (
                      <span className="px-3 py-1 rounded-full bg-[#eae8e7] text-[10px] font-bold uppercase tracking-widest text-[#444748]">
                        {settings.team_size} pers.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="bg-white dark:bg-neutral-800 rounded-xl p-8 space-y-6" style={{ boxShadow: '0 20px 40px rgba(27,28,27,0.04)' }}>
              <h3 className="font-['Manrope'] font-extrabold text-xl text-[#1b1c1b] dark:text-white">Informations</h3>

              {settings.description && (
                <div>
                  <p className={stoneLabelClass}>Description</p>
                  <p className="text-sm text-[#444748] dark:text-neutral-400 leading-relaxed whitespace-pre-wrap">{settings.description}</p>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                {settings.org_email && (
                  <div className="flex items-center gap-3 rounded-xl bg-[#f5f3f2] dark:bg-neutral-900 px-4 py-3">
                    <Mail className="h-4 w-4 text-[#747878] shrink-0" />
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-bold text-[#444748]">Email</p>
                      <p className="text-sm font-medium text-[#1b1c1b] dark:text-white">{settings.org_email}</p>
                    </div>
                  </div>
                )}
                {settings.org_phone && (
                  <div className="flex items-center gap-3 rounded-xl bg-[#f5f3f2] dark:bg-neutral-900 px-4 py-3">
                    <Phone className="h-4 w-4 text-[#747878] shrink-0" />
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-bold text-[#444748]">Téléphone</p>
                      <p className="text-sm font-medium text-[#1b1c1b] dark:text-white">{settings.org_phone}</p>
                    </div>
                  </div>
                )}
              </div>

              {settings.address && (
                <div className="flex items-center gap-3 rounded-xl bg-[#f5f3f2] dark:bg-neutral-900 px-4 py-3">
                  <MapPin className="h-4 w-4 text-[#747878] shrink-0" />
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-[#444748]">Adresse</p>
                    <p className="text-sm font-medium text-[#1b1c1b] dark:text-white">{settings.address}</p>
                  </div>
                </div>
              )}

              {!settings.description && !settings.org_email && !settings.org_phone && !settings.address && (
                <p className="text-sm text-[#444748] text-center py-4">Aucune information renseignée par l'organisation.</p>
              )}
            </div>
          </div>
        )
      })()}

      {/* ═══════════════════ ORGANISATION TAB (Owner edit) ═══════════════════ */}
      {!isHoS && activeTab === 'organisation' && (
        <div className="animate-in fade-in duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10">
            {/* Branding Card */}
            <div className="lg:col-span-4">
              <div className="bg-white dark:bg-neutral-800 rounded-xl p-8 h-full" style={{ boxShadow: '0 20px 40px rgba(27,28,27,0.04)' }}>
                <h2 className="font-['Manrope'] font-extrabold text-xl text-[#1b1c1b] dark:text-white mb-8">Brand Identity</h2>

                <div className="flex flex-col items-center gap-6">
                  <div className="relative group cursor-pointer" onClick={handleLogoClick}>
                    <input type="file" ref={fileInputRef} onChange={onFileChange} className="hidden" accept="image/jpeg,image/png,image/webp" disabled={uploading} />
                    <div className="w-48 h-48 rounded-full overflow-hidden flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #fbf9f8 0%, #f5f3f2 100%)', border: '2px dashed rgba(196,199,199,0.3)' }}>
                      {formData.logo_url ? (
                        <img src={formData.logo_url} alt="Logo" className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="h-8 w-8 text-[#747878]" />
                      )}
                    </div>
                    <button className="absolute bottom-2 right-2 bg-[#000000] text-white p-3 rounded-full shadow-lg hover:bg-[#1b1c1b] transition-colors">
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-[#1b1c1b] dark:text-white mb-1">Logo de l'entreprise</p>
                    <p className="text-xs text-[#444748] dark:text-neutral-400">SVG, PNG, ou JPG. Max 5Mo.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Form Card */}
            <div className="lg:col-span-8">
              <div className="bg-white dark:bg-neutral-800 rounded-xl p-8" style={{ boxShadow: '0 20px 40px rgba(27,28,27,0.04)' }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-8">
                  <div className="col-span-1 sm:col-span-2">
                    <label className={stoneLabelClass}>Nom de l'entreprise</label>
                    <input
                      type="text"
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                      className="w-full bg-transparent border-b border-[#c4c7c7]/30 dark:border-neutral-700 py-2 focus:border-[#006c49] focus:ring-0 outline-none transition-all font-['Manrope'] font-bold text-lg text-[#1b1c1b] dark:text-white"
                      placeholder="Votre entreprise"
                    />
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                    <label className={stoneLabelClass}>Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full bg-transparent border-b border-[#c4c7c7]/30 dark:border-neutral-700 py-2 focus:border-[#006c49] focus:ring-0 outline-none transition-all font-['Inter'] text-sm leading-relaxed resize-none h-20 text-[#1b1c1b] dark:text-white"
                      placeholder="Ce que fait votre entreprise..."
                    />
                  </div>
                  <div className="col-span-1">
                    <label className={stoneLabelClass}>Site web</label>
                    <input type="url" value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} className={stoneInputClass} placeholder="https://votresite.com" />
                  </div>
                  <div className="col-span-1">
                    <label className={stoneLabelClass}>Email de contact</label>
                    <input type="email" value={formData.org_email} onChange={(e) => setFormData({ ...formData, org_email: e.target.value })} className={stoneInputClass} placeholder="contact@entreprise.com" />
                  </div>
                  <div className="col-span-1">
                    <label className={stoneLabelClass}>Téléphone</label>
                    <PhoneInput value={formData.org_phone} onChange={(v) => setFormData({ ...formData, org_phone: v })} />
                  </div>
                  <div className="col-span-1">
                    <label className={stoneLabelClass}>Adresse</label>
                    <input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className={stoneInputClass} placeholder="123 rue Example, 75001 Paris" />
                  </div>
                </div>
              </div>
            </div>

            {/* Facturation */}
            <div className="lg:col-span-12">
              <div className="bg-white dark:bg-neutral-800 rounded-xl p-4 md:p-8 space-y-6" style={{ boxShadow: '0 20px 40px rgba(27,28,27,0.04)' }}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-[#ffddb8]/30 flex items-center justify-center text-[#b87500]">
                    <Receipt className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-['Manrope'] font-extrabold text-xl text-[#1b1c1b] dark:text-white">Facturation</h3>
                    <p className="text-xs text-[#444748] dark:text-neutral-400">Informations pour vos factures et documents officiels</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-8">
                  <div className="col-span-1 sm:col-span-2">
                    <label className={stoneLabelClass}>Raison sociale</label>
                    <input type="text" value={formData.raison_sociale} onChange={(e) => setFormData({ ...formData, raison_sociale: e.target.value })} className={stoneInputClass} placeholder="Raison sociale de votre entreprise" />
                  </div>
                  <div className="col-span-1">
                    <label className={stoneLabelClass}>SIRET</label>
                    <input type="text" value={formData.siret} onChange={(e) => setFormData({ ...formData, siret: e.target.value })} className={stoneInputClass} placeholder="123 456 789 00012" />
                  </div>
                  <div className="col-span-1">
                    <label className={stoneLabelClass}>Numéro de TVA</label>
                    <input type="text" value={formData.tva_number} onChange={(e) => setFormData({ ...formData, tva_number: e.target.value })} className={stoneInputClass} placeholder="FR 12 345678901" />
                  </div>
                </div>

                <div className="h-px bg-[#c4c7c7]/10 my-2" />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-8">
                  <div className="col-span-1 sm:col-span-2">
                    <label className={stoneLabelClass}>Adresse de facturation</label>
                    <input type="text" value={formData.billing_address} onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })} className={stoneInputClass} placeholder="123 rue de la Facturation" />
                  </div>
                  <div className="col-span-1 sm:col-span-1">
                    <label className={stoneLabelClass}>Code postal</label>
                    <input type="text" value={formData.billing_zip} onChange={(e) => setFormData({ ...formData, billing_zip: e.target.value })} className={stoneInputClass} placeholder="75001" />
                  </div>
                  <div className="col-span-1 sm:col-span-1">
                    <label className={stoneLabelClass}>Ville</label>
                    <input type="text" value={formData.billing_city} onChange={(e) => setFormData({ ...formData, billing_city: e.target.value })} className={stoneInputClass} placeholder="Paris" />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className={stoneLabelClass}>Pays</label>
                    <input type="text" value={formData.billing_country} onChange={(e) => setFormData({ ...formData, billing_country: e.target.value })} className={stoneInputClass} placeholder="France" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ ONBOARDING TAB ═══════════════════ */}
      {activeTab === 'onboarding' && (
        <div className="animate-in fade-in duration-300">
          {/* Notion onboarding guide for current user */}
          {(() => {
            const notionUrl = isHoS ? ONBOARDING_NOTION_URLS[teamMember?.role || ''] : ONBOARDING_NOTION_URLS['owner']
            const roleLabel = isHoS ? teamMember?.role : 'Owner / Admin'
            return notionUrl ? (
              <a
                href={notionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-[#000000] hover:bg-[#1b1c1b] rounded-2xl p-8 mb-10 transition-all active:scale-[0.99] group"
                style={{ boxShadow: '0 20px 40px rgba(27,28,27,0.15)' }}
              >
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                    <Rocket className="h-7 w-7 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-['Manrope'] font-extrabold text-2xl text-white leading-tight">📖 Guide d'onboarding — {roleLabel}</h3>
                    <p className="text-white/60 text-sm mt-1 font-medium">Lecture obligatoire avant de commencer. Cliquez pour ouvrir le guide complet.</p>
                  </div>
                  <ExternalLink className="h-6 w-6 text-white/40 group-hover:text-white transition-colors shrink-0" />
                </div>
              </a>
            ) : null
          })()}

          <div className="flex flex-col lg:flex-row gap-10">
            {/* Role Selector */}
            <div className="w-full lg:w-1/3 space-y-4">
              <label className={stoneLabelClass}>Parcours actif</label>
              <div className="flex flex-col gap-3">
                {DEFAULT_ROLES.map(role => (
                  <button
                    key={role}
                    onClick={() => setSelectedOnboardingRole(role)}
                    className={`flex items-center justify-between p-4 rounded-xl transition-all ${
                      selectedOnboardingRole === role
                        ? 'bg-[#000000] text-white shadow-lg'
                        : 'bg-white dark:bg-neutral-800 text-[#1b1c1b] dark:text-white hover:bg-[#f5f3f2] dark:hover:bg-neutral-700'
                    }`}
                    style={selectedOnboardingRole !== role ? { border: '0.5px solid rgba(196,199,199,0.2)' } : undefined}
                  >
                    <span className="font-['Manrope'] font-bold">{role}</span>
                    <ChevronDown className={`h-4 w-4 -rotate-90 ${selectedOnboardingRole === role ? 'text-white/60' : 'text-[#747878]'}`} />
                  </button>
                ))}
              </div>
            </div>

            {/* Section Editor */}
            <div className="w-full lg:w-2/3">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-[#444748]">Blocs du parcours</h3>
              </div>

              <div className="p-4 rounded-xl bg-[#006c49]/5 text-[#006c49] mb-6">
                <p className="text-sm font-medium">
                  {selectedOnboardingRole === 'Général'
                    ? 'Cet onboarding sera présenté à tous les nouveaux collaborateurs lors de leur intégration.'
                    : `Cet onboarding sera présenté uniquement aux membres avec le rôle "${selectedOnboardingRole}".`}
                </p>
              </div>

              {selectedOnboardingRole === 'Général' ? (
                <SectionEditor
                  sections={formData.onboarding_sections}
                  onUpdate={(s) => setFormData(prev => ({ ...prev, onboarding_sections: s }))}
                  emptyLabel="Aucune section d'onboarding"
                  emptyDesc="Créez votre première étape d'intégration"
                />
              ) : (
                <SectionEditor
                  sections={formData.role_onboarding_sections[selectedOnboardingRole] || []}
                  onUpdate={(s) => setFormData(prev => ({
                    ...prev,
                    role_onboarding_sections: { ...prev.role_onboarding_sections, [selectedOnboardingRole]: s },
                  }))}
                  emptyLabel={`Aucune section pour ${selectedOnboardingRole}`}
                  emptyDesc={`Créez un parcours spécifique pour les ${selectedOnboardingRole}s`}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ CUSTOM TABS ═══════════════════ */}
      {activeCustomTab && (
        <div className="animate-in fade-in duration-300">
          <div className="bg-white dark:bg-neutral-800 rounded-xl p-8 space-y-6" style={{ boxShadow: '0 20px 40px rgba(27,28,27,0.04)' }}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-[#e5e2e1]/50 flex items-center justify-center text-[#474646]">
                <LayoutGrid className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-['Manrope'] font-extrabold text-xl text-[#1b1c1b] dark:text-white">{activeCustomTab.name}</h3>
                <p className="text-xs text-[#444748] dark:text-neutral-400">Onglet personnalisé &mdash; double-cliquez sur le nom pour le renommer</p>
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

      {/* ─── Sticky Save (mobile) ─── */}
      <div className="sticky bottom-4 z-10 lg:hidden mt-8">
        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full bg-[#000000] hover:bg-[#1b1c1b] text-white px-6 py-4 rounded-full font-['Manrope'] font-extrabold text-sm tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
          ENREGISTRER
        </button>
      </div>
    </div>
  )
}
