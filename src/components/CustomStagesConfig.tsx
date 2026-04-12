import { useState } from 'react'
import { X, Plus, Trash2, ChevronUp, ChevronDown, Pencil, Check, AlertTriangle } from 'lucide-react'
import { cn } from '../lib/utils'
import { type CustomStage, type StageDefinition } from '../hooks/useCustomStages'
import { type Tag } from '../hooks/useTags'
import { useLanguage } from '../contexts/LanguageContext'

const COLOR_PALETTE = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#78716c', '#1e293b',
]

interface Props {
  isOpen: boolean
  onClose: () => void
  defaultStages: StageDefinition[]
  customStages: CustomStage[]
  onAdd: (stage: { name: string; description?: string; color: string }) => Promise<void>
  onUpdate: (id: number, updates: { name?: string; color?: string }) => Promise<void>
  onDelete: (id: number) => Promise<void>
  onReorder: (reordered: { id: number; position: number }[]) => Promise<void>
  prospectsCountByStage: Record<string, number>
  // Tags props
  tags: Tag[]
  onCreateTag: (name: string, color: string) => Promise<void>
  onUpdateTag: (id: string, updates: { name?: string; color?: string }) => Promise<void>
  onDeleteTag: (id: string) => Promise<void>
  getTagProspectCount: (tagId: string) => number
}

type TabId = 'stages' | 'tags'

export function CustomStagesConfig({
  isOpen, onClose, defaultStages, customStages, onAdd, onUpdate, onDelete, onReorder, prospectsCountByStage,
  tags, onCreateTag, onUpdateTag, onDeleteTag, getTagProspectCount,
}: Props) {
  const { lang } = useLanguage()
  const [activeTab, setActiveTab] = useState<TabId>('stages')

  // Stage state
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(COLOR_PALETTE[0])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  // Tag state
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState(COLOR_PALETTE[0])
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [editTagName, setEditTagName] = useState('')
  const [editTagColor, setEditTagColor] = useState('')
  const [isAddingTag, setIsAddingTag] = useState(false)
  const [deleteTagConfirm, setDeleteTagConfirm] = useState<string | null>(null)

  if (!isOpen) return null

  // --- Stage handlers ---
  const handleAdd = async () => {
    if (!newName.trim()) return
    setIsAdding(true)
    try {
      await onAdd({ name: newName.trim(), color: newColor })
      setNewName('')
      setNewColor(COLOR_PALETTE[0])
    } finally {
      setIsAdding(false)
    }
  }

  const handleStartEdit = (stage: CustomStage) => {
    setEditingId(stage.id)
    setEditName(stage.name)
    setEditColor(stage.color)
  }

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return
    await onUpdate(editingId, { name: editName.trim(), color: editColor })
    setEditingId(null)
  }

  const handleDelete = async (id: number) => {
    await onDelete(id)
    setDeleteConfirm(null)
  }

  const handleMoveUp = async (index: number) => {
    if (index === 0) return
    const reordered = customStages.map((s, i) => ({
      id: s.id,
      position: i === index ? index - 1 : i === index - 1 ? index : i,
    }))
    await onReorder(reordered)
  }

  const handleMoveDown = async (index: number) => {
    if (index === customStages.length - 1) return
    const reordered = customStages.map((s, i) => ({
      id: s.id,
      position: i === index ? index + 1 : i === index + 1 ? index : i,
    }))
    await onReorder(reordered)
  }

  // --- Tag handlers ---
  const handleAddTag = async () => {
    if (!newTagName.trim()) return
    setIsAddingTag(true)
    try {
      await onCreateTag(newTagName.trim(), newTagColor)
      setNewTagName('')
      setNewTagColor(COLOR_PALETTE[0])
    } finally {
      setIsAddingTag(false)
    }
  }

  const handleStartEditTag = (tag: Tag) => {
    setEditingTagId(tag.id)
    setEditTagName(tag.name)
    setEditTagColor(tag.color)
  }

  const handleSaveEditTag = async () => {
    if (!editingTagId || !editTagName.trim()) return
    await onUpdateTag(editingTagId, { name: editTagName.trim(), color: editTagColor })
    setEditingTagId(null)
  }

  const handleDeleteTag = async (id: string) => {
    await onDeleteTag(id)
    setDeleteTagConfirm(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md">
      <div className="relative w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#1a1a1a] shadow-[0_20px_40px_rgba(0,0,0,0.2)]">
        {/* Header */}
        <div className="border-b border-white/[0.08] p-6 pb-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-white">{lang === 'fr' ? 'Personnaliser le pipeline' : 'Customize pipeline'}</h2>
              <p className="mt-1 text-sm text-white/40">{lang === 'fr' ? 'Gérez vos étapes et tags personnalisés' : 'Manage your custom stages and tags'}</p>
            </div>
            <button onClick={onClose} className="rounded-lg p-2 text-white/40 hover:bg-white/5 hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('stages')}
              className={cn(
                'rounded-t-lg px-4 py-2 text-sm font-medium transition-colors',
                activeTab === 'stages'
                  ? 'bg-white/5 text-white'
                  : 'text-white/40 hover:text-white/60 hover:bg-white/[0.03]'
              )}
            >
              {lang === 'fr' ? 'Étapes' : 'Stages'}
            </button>
            <button
              onClick={() => setActiveTab('tags')}
              className={cn(
                'rounded-t-lg px-4 py-2 text-sm font-medium transition-colors',
                activeTab === 'tags'
                  ? 'bg-white/5 text-white'
                  : 'text-white/40 hover:text-white/60 hover:bg-white/[0.03]'
              )}
            >
              Tags
              {tags.length > 0 && (
                <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/10 px-1.5 text-[10px] font-bold text-white/60">
                  {tags.length}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-6 space-y-6">
          {activeTab === 'stages' ? (
            /* =================== ONGLET ÉTAPES =================== */
            <>
              {/* Default stages */}
              <div>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-white/40">{lang === 'fr' ? 'Étapes par défaut' : 'Default stages'}</h3>
                <div className="space-y-2">
                  {defaultStages.map(stage => (
                    <div key={stage.id} className="flex items-center gap-3 rounded-xl bg-white/[0.02] border border-white/5 px-4 py-3 opacity-60">
                      <span className={cn('h-3 w-3 rounded-full shrink-0', stage.color)} />
                      <span className="text-sm text-white/40">{stage.name}</span>
                      <span className="ml-auto text-xs text-white/20">{lang === 'fr' ? 'Par défaut' : 'Default'}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom stages */}
              <div>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-white/40">
                  {lang === 'fr' ? `Étapes personnalisées (${customStages.length})` : `Custom stages (${customStages.length})`}
                </h3>
                {customStages.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/[0.08] py-6 text-center">
                    <p className="text-sm text-white/40">{lang === 'fr' ? 'Aucune étape personnalisée' : 'No custom stages'}</p>
                    <p className="mt-1 text-xs text-white/30">{lang === 'fr' ? 'Ajoutez des étapes ci-dessous' : 'Add stages below'}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {customStages.map((stage, index) => (
                      <div key={stage.id} className="group flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] hover:border-emerald-500/30 hover:bg-white/[0.04] px-4 py-3">
                        {editingId === stage.id ? (
                          <>
                            <div className="flex gap-2 flex-1">
                              <input
                                type="text"
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                                autoFocus
                                onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
                              />
                              <div className="flex gap-1">
                                {COLOR_PALETTE.map(c => (
                                  <button
                                    key={c}
                                    onClick={() => setEditColor(c)}
                                    className={cn(
                                      'h-6 w-6 rounded-full border-2 transition-all',
                                      editColor === c ? 'border-white scale-110' : 'border-transparent hover:border-white/30'
                                    )}
                                    style={{ backgroundColor: c }}
                                  />
                                ))}
                              </div>
                            </div>
                            <button onClick={handleSaveEdit} className="rounded p-1.5 text-emerald-400 hover:bg-emerald-500/10">
                              <Check className="h-4 w-4" />
                            </button>
                            <button onClick={() => setEditingId(null)} className="rounded p-1.5 text-white/40 hover:bg-white/5">
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : deleteConfirm === stage.id ? (
                          <div className="flex flex-1 items-center gap-3">
                            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                            <div className="flex-1">
                              <p className="text-sm text-amber-300">
                                {lang === 'fr' ? `Supprimer "${stage.name}" ?` : `Delete "${stage.name}"?`}
                              </p>
                              {(prospectsCountByStage[`custom_${stage.id}`] || 0) > 0 && (
                                <p className="text-xs text-white/40 mt-0.5">
                                  {lang === 'fr' ? `${prospectsCountByStage[`custom_${stage.id}`]} prospect(s) seront déplacés vers "Prospect"` : `${prospectsCountByStage[`custom_${stage.id}`]} prospect(s) will be moved to "Prospect"`}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => handleDelete(stage.id)}
                              className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20"
                            >
                              {lang === 'fr' ? 'Confirmer' : 'Confirm'}
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="rounded-lg px-3 py-1.5 text-xs text-white/40 hover:bg-white/5"
                            >
                              {lang === 'fr' ? 'Annuler' : 'Cancel'}
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                            <span className="flex-1 text-sm text-white/60">{stage.name}</span>
                            <span className="text-xs text-white/40">
                              {prospectsCountByStage[`custom_${stage.id}`] || 0}
                            </span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleMoveUp(index)} disabled={index === 0}
                                className="rounded p-1 text-white/40 hover:bg-white/5 hover:text-white disabled:opacity-30">
                                <ChevronUp className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => handleMoveDown(index)} disabled={index === customStages.length - 1}
                                className="rounded p-1 text-white/40 hover:bg-white/5 hover:text-white disabled:opacity-30">
                                <ChevronDown className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => handleStartEdit(stage)}
                                className="rounded p-1 text-white/40 hover:bg-white/5 hover:text-emerald-400">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => setDeleteConfirm(stage.id)}
                                className="rounded p-1 text-white/40 hover:bg-white/5 hover:text-red-400">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add new stage */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-2xl p-4">
                <h3 className="mb-3 text-sm font-semibold text-white/60">{lang === 'fr' ? 'Ajouter une étape' : 'Add a stage'}</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder={lang === 'fr' ? "Nom de l'étape (ex: Négociation, Démo planifiée...)" : "Stage name (e.g.: Negotiation, Demo scheduled...)"}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-emerald-500 focus:outline-none"
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                  />
                  <div>
                    <p className="mb-2 text-xs text-white/40">{lang === 'fr' ? 'Couleur' : 'Color'}</p>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_PALETTE.map(c => (
                        <button
                          key={c}
                          onClick={() => setNewColor(c)}
                          className={cn(
                            'h-8 w-8 rounded-full border-2 transition-all',
                            newColor === c ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:border-white/30'
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={handleAdd}
                    disabled={!newName.trim() || isAdding}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    {lang === 'fr' ? "Ajouter l'étape" : 'Add stage'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* =================== ONGLET TAGS =================== */
            <>
              {/* Tag list */}
              <div>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-white/40">
                  {lang === 'fr' ? `Vos tags (${tags.length})` : `Your tags (${tags.length})`}
                </h3>
                {tags.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/[0.08] py-6 text-center">
                    <p className="text-sm text-white/40">{lang === 'fr' ? 'Aucun tag' : 'No tags'}</p>
                    <p className="mt-1 text-xs text-white/30">{lang === 'fr' ? 'Créez votre premier tag ci-dessous' : 'Create your first tag below'}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tags.map(tag => {
                      const count = getTagProspectCount(tag.id)
                      return (
                        <div key={tag.id} className="group flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] hover:border-emerald-500/30 hover:bg-white/[0.04] px-4 py-3">
                          {editingTagId === tag.id ? (
                            <>
                              <div className="flex gap-2 flex-1">
                                <input
                                  type="text"
                                  value={editTagName}
                                  onChange={e => setEditTagName(e.target.value)}
                                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                                  autoFocus
                                  onKeyDown={e => e.key === 'Enter' && handleSaveEditTag()}
                                />
                                <div className="flex gap-1">
                                  {COLOR_PALETTE.map(c => (
                                    <button
                                      key={c}
                                      onClick={() => setEditTagColor(c)}
                                      className={cn(
                                        'h-6 w-6 rounded-full border-2 transition-all',
                                        editTagColor === c ? 'border-white scale-110' : 'border-transparent hover:border-white/30'
                                      )}
                                      style={{ backgroundColor: c }}
                                    />
                                  ))}
                                </div>
                              </div>
                              <button onClick={handleSaveEditTag} className="rounded p-1.5 text-emerald-400 hover:bg-emerald-500/10">
                                <Check className="h-4 w-4" />
                              </button>
                              <button onClick={() => setEditingTagId(null)} className="rounded p-1.5 text-white/40 hover:bg-white/5">
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          ) : deleteTagConfirm === tag.id ? (
                            <div className="flex flex-1 items-center gap-3">
                              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                              <div className="flex-1">
                                <p className="text-sm text-amber-300">{lang === 'fr' ? `Supprimer "${tag.name}" ?` : `Delete "${tag.name}"?`}</p>
                                {count > 0 && (
                                  <p className="text-xs text-white/40 mt-0.5">
                                    {lang === 'fr' ? `${count} prospect(s) ont ce tag, il sera retiré` : `${count} prospect(s) have this tag, it will be removed`}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => handleDeleteTag(tag.id)}
                                className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20"
                              >
                                {lang === 'fr' ? 'Confirmer' : 'Confirm'}
                              </button>
                              <button
                                onClick={() => setDeleteTagConfirm(null)}
                                className="rounded-lg px-3 py-1.5 text-xs text-white/40 hover:bg-white/5"
                              >
                                {lang === 'fr' ? 'Annuler' : 'Cancel'}
                              </button>
                            </div>
                          ) : (
                            <>
                              <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                              <span className="flex-1 text-sm text-white/60">{tag.name}</span>
                              <span className="text-xs text-white/40">({count})</span>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleStartEditTag(tag)}
                                  className="rounded p-1 text-white/40 hover:bg-white/5 hover:text-emerald-400">
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => setDeleteTagConfirm(tag.id)}
                                  className="rounded p-1 text-white/40 hover:bg-white/5 hover:text-red-400">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Add new tag */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-2xl p-4">
                <h3 className="mb-3 text-sm font-semibold text-white/60">{lang === 'fr' ? 'Ajouter un tag' : 'Add a tag'}</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={newTagName}
                    onChange={e => setNewTagName(e.target.value)}
                    placeholder={lang === 'fr' ? "Nom du tag (ex: VIP, Chaud, Prioritaire...)" : "Tag name (e.g.: VIP, Hot, Priority...)"}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-emerald-500 focus:outline-none"
                    onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                  />
                  <div>
                    <p className="mb-2 text-xs text-white/40">{lang === 'fr' ? 'Couleur' : 'Color'}</p>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_PALETTE.map(c => (
                        <button
                          key={c}
                          onClick={() => setNewTagColor(c)}
                          className={cn(
                            'h-8 w-8 rounded-full border-2 transition-all',
                            newTagColor === c ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:border-white/30'
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={handleAddTag}
                    disabled={!newTagName.trim() || isAddingTag}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    {lang === 'fr' ? 'Ajouter le tag' : 'Add tag'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
