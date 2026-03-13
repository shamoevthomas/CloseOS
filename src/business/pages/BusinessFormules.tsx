import { useState, useEffect, useCallback } from 'react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import {
  Plus, Package, Pencil, Trash2, X, Loader2,
  ToggleLeft, ToggleRight, FileText, Video, Link2, File
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Resource {
  name: string
  url: string
  type: 'PDF' | 'Vidéo' | 'Lien' | 'Autre'
}

interface Formula {
  id: string
  name: string
  price: number
  description: string | null
  resources: Resource[]
  is_active: boolean
  created_at: string
}

const RESOURCE_TYPES: Resource['type'][] = ['PDF', 'Vidéo', 'Lien', 'Autre']

const API_URL = '/api/business'

export function BusinessFormules() {
  const { user } = useBusinessAuth()
  const [formulas, setFormulas] = useState<Formula[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingFormula, setEditingFormula] = useState<Formula | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formName, setFormName] = useState('')
  const [formPrice, setFormPrice] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formResources, setFormResources] = useState<Resource[]>([])

  const fetchFormulas = useCallback(async () => {
    if (!user?.id) return
    try {
      const res = await fetch(`${API_URL}?action=formulas-list&user_id=${user.id}`)
      const data = await res.json()
      if (data.formulas) setFormulas(data.formulas)
    } catch (err) {
      console.error('Error fetching formulas:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { fetchFormulas() }, [fetchFormulas])

  const resetForm = () => {
    setFormName(''); setFormPrice(''); setFormDescription('')
    setFormResources([]); setEditingFormula(null)
  }

  const openCreate = () => { resetForm(); setIsModalOpen(true) }

  const openEdit = (formula: Formula) => {
    setEditingFormula(formula)
    setFormName(formula.name)
    setFormPrice(formula.price?.toString() || '0')
    setFormDescription(formula.description || '')
    setFormResources(formula.resources || [])
    setIsModalOpen(true)
  }

  const handleSave = async () => {
    if (!formName.trim()) return toast.error('Le nom est requis')
    setSaving(true)
    try {
      const payload = {
        user_id: user?.id,
        name: formName,
        price: parseFloat(formPrice) || 0,
        description: formDescription || null,
        resources: formResources,
      }
      if (editingFormula) {
        const res = await fetch(`${API_URL}?action=formulas-update`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, id: editingFormula.id }),
        })
        const data = await res.json()
        if (data.formula) toast.success('Formule modifiée')
        else toast.error(data.error || 'Erreur')
      } else {
        const res = await fetch(`${API_URL}?action=formulas-create`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (data.formula) toast.success('Formule créée')
        else toast.error(data.error || 'Erreur')
      }
      setIsModalOpen(false); resetForm(); fetchFormulas()
    } catch { toast.error('Erreur réseau') }
    finally { setSaving(false) }
  }

  const toggleActive = async (formula: Formula) => {
    try {
      await fetch(`${API_URL}?action=formulas-update`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.id, id: formula.id, is_active: !formula.is_active }),
      })
      fetchFormulas()
      toast.success(formula.is_active ? 'Formule désactivée' : 'Formule activée')
    } catch { toast.error('Erreur') }
  }

  const deleteFormula = async (formula: Formula) => {
    if (!confirm(`Supprimer la formule "${formula.name}" ?`)) return
    try {
      await fetch(`${API_URL}?action=formulas-delete&id=${formula.id}&user_id=${user?.id}`, { method: 'DELETE' })
      toast.success('Formule supprimée'); fetchFormulas()
    } catch { toast.error('Erreur') }
  }

  const addResource = () => {
    setFormResources([...formResources, { name: '', url: '', type: 'Lien' }])
  }
  const updateResource = (index: number, updates: Partial<Resource>) => {
    const res = [...formResources]; res[index] = { ...res[index], ...updates }; setFormResources(res)
  }
  const removeResource = (index: number) => {
    setFormResources(formResources.filter((_, i) => i !== index))
  }

  const getResourceIcon = (type: Resource['type']) => {
    switch (type) {
      case 'PDF': return <FileText className="h-3.5 w-3.5" />
      case 'Vidéo': return <Video className="h-3.5 w-3.5" />
      case 'Lien': return <Link2 className="h-3.5 w-3.5" />
      default: return <File className="h-3.5 w-3.5" />
    }
  }

  const inputCls = "w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
  const smallInputCls = "rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none"
  const selectCls = "rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-amber-500 focus:outline-none"

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 text-amber-600 animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
            <Package className="h-5 w-5 text-amber-700" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{formulas.length} formule{formulas.length !== 1 ? 's' : ''}</h2>
            <p className="text-xs text-slate-500">Gérez vos formules tarifaires et ressources</p>
          </div>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-700 transition-colors">
          <Plus className="h-4 w-4" /> Nouvelle formule
        </button>
      </div>

      {/* Empty state */}
      {formulas.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/50 py-16">
          <Package className="h-12 w-12 text-amber-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">Aucune formule</h3>
          <p className="text-sm text-slate-500 mb-4">Créez votre première formule tarifaire</p>
          <button onClick={openCreate} className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-700">
            <Plus className="h-4 w-4" /> Créer une formule
          </button>
        </div>
      )}

      {/* Formula cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {formulas.map((formula) => {
          const resourceCount = (formula.resources || []).length
          return (
            <div key={formula.id} className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 truncate">{formula.name}</h3>
                  {formula.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{formula.description}</p>}
                </div>
                <button onClick={() => toggleActive(formula)} className="ml-2 flex-shrink-0">
                  {formula.is_active ? <ToggleRight className="h-6 w-6 text-amber-600" /> : <ToggleLeft className="h-6 w-6 text-slate-300" />}
                </button>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${formula.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                  {formula.is_active ? 'Active' : 'Inactive'}
                </span>
                <span className="text-sm font-semibold text-amber-700">{formula.price?.toFixed(2)} €</span>
              </div>
              <div className="flex items-center gap-4 mb-4 text-xs text-slate-500">
                <span className="flex items-center gap-1"><File className="h-3.5 w-3.5" /> {resourceCount} ressource{resourceCount !== 1 ? 's' : ''}</span>
              </div>
              {/* Resource preview */}
              {resourceCount > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {(formula.resources || []).slice(0, 3).map((r, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {getResourceIcon(r.type)} {r.name || r.type}
                    </span>
                  ))}
                  {resourceCount > 3 && <span className="text-xs text-slate-400">+{resourceCount - 3}</span>}
                </div>
              )}
              <div className="flex gap-2 border-t border-slate-100 pt-3">
                <button onClick={() => openEdit(formula)} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                  <Pencil className="h-3.5 w-3.5" /> Modifier
                </button>
                <button onClick={() => deleteFormula(formula)} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" /> Supprimer
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal Create/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 flex-shrink-0">
              <h3 className="text-lg font-bold text-slate-900">
                {editingFormula ? 'Modifier la formule' : 'Nouvelle formule'}
              </h3>
              <button onClick={() => { setIsModalOpen(false); resetForm() }} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content - scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nom de la formule *</label>
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ex: Formule Premium" className={inputCls} />
              </div>

              {/* Price */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Prix (€)</label>
                <input type="number" min="0" step="0.01" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} placeholder="0.00" className={inputCls} />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={3} placeholder="Décrivez cette formule..." className={`${inputCls} resize-none`} />
              </div>

              {/* Resources */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-slate-700">Ressources incluses</label>
                  <button onClick={addResource} className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700">
                    <Plus className="h-3.5 w-3.5" /> Ajouter une ressource
                  </button>
                </div>
                {formResources.length === 0 && (
                  <p className="text-xs text-slate-400 italic">Aucune ressource. Ajoutez des fichiers PDF, liens vidéo, accès contenus...</p>
                )}
                <div className="space-y-2">
                  {formResources.map((resource, idx) => (
                    <div key={idx} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2">
                      <select
                        value={resource.type}
                        onChange={(e) => updateResource(idx, { type: e.target.value as Resource['type'] })}
                        className={selectCls}
                      >
                        {RESOURCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <input
                        type="text"
                        value={resource.name}
                        onChange={(e) => updateResource(idx, { name: e.target.value })}
                        placeholder="Nom"
                        className={`flex-1 ${smallInputCls}`}
                      />
                      <input
                        type="url"
                        value={resource.url}
                        onChange={(e) => updateResource(idx, { url: e.target.value })}
                        placeholder="URL"
                        className={`flex-[2] ${smallInputCls}`}
                      />
                      <button onClick={() => removeResource(idx)} className="text-red-400 hover:text-red-600 flex-shrink-0">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4 flex-shrink-0">
              <button onClick={() => { setIsModalOpen(false); resetForm() }} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Annuler
              </button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingFormula ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
