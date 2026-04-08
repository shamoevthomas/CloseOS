import { useState, useEffect, useCallback } from 'react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import {
  Package, Loader2, FileText, Video, Link2, File, ExternalLink, X,
} from 'lucide-react'
import { cn } from '../../lib/utils'

interface Resource {
  name: string
  url: string
  type: 'PDF' | 'Video' | 'Lien' | 'Autre'
}

interface Formula {
  id: string
  name: string
  price: number
  description: string | null
  resources: Resource[]
  is_active: boolean
  created_at: string
  billing_type?: 'one_time' | 'subscription' | 'quote'
  yearly_price?: number | null
}

const API_URL = '/api/business'

export function CloserFormules() {
  const { ownerUserId } = useBusinessAuth()
  const [formulas, setFormulas] = useState<Formula[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFormula, setSelectedFormula] = useState<Formula | null>(null)

  const fetchFormulas = useCallback(async () => {
    if (!ownerUserId) { setLoading(false); return }
    try {
      const res = await fetch(`${API_URL}?action=formulas-list&user_id=${ownerUserId}`)
      const data = await res.json()
      if (data.formulas) setFormulas(data.formulas)
    } catch (err) {
      console.error('Error fetching formulas:', err)
    } finally {
      setLoading(false)
    }
  }, [ownerUserId])

  useEffect(() => { fetchFormulas() }, [fetchFormulas])

  const getResourceIcon = (type: Resource['type']) => {
    switch (type) {
      case 'PDF': return <FileText className="h-3.5 w-3.5" />
      case 'Video': return <Video className="h-3.5 w-3.5" />
      case 'Lien': return <Link2 className="h-3.5 w-3.5" />
      default: return <File className="h-3.5 w-3.5" />
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 text-stone-400 dark:text-neutral-500 animate-spin" /></div>
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <span className="text-xs uppercase tracking-[0.2em] text-stone-400 dark:text-neutral-500 font-bold">Gestion Commerciale</span>
          <h1 className="font-['Manrope'] text-3xl md:text-4xl font-extrabold tracking-tight text-stone-900 dark:text-white">
            {formulas.length} formule{formulas.length !== 1 ? 's' : ''}
          </h1>
          <p className="text-sm text-stone-500 dark:text-neutral-400">Formules tarifaires de l'organisation (lecture seule)</p>
        </div>
      </div>

      {/* Empty state */}
      {formulas.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/5 py-16">
          <Package className="h-12 w-12 text-stone-300 dark:text-neutral-600 mb-4" />
          <h3 className="text-lg font-semibold text-stone-700 dark:text-neutral-200 mb-1">Aucune formule</h3>
          <p className="text-sm text-stone-500 dark:text-neutral-400">Votre manager n'a pas encore cree de formules.</p>
        </div>
      )}

      {/* Formula cards */}
      <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
        {formulas.map((formula) => {
          const resources = formula.resources || []
          return (
            <div key={formula.id} onClick={() => setSelectedFormula(formula)} className="bg-white dark:bg-white/5 rounded-2xl p-8 shadow-[0_20px_40px_rgba(27,28,27,0.04)] hover:shadow-xl transition-all border border-stone-100/50 dark:border-white/10 cursor-pointer">
              {/* Top: badge */}
              <div className="flex justify-between items-start mb-6">
                <span className={cn(
                  'text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full',
                  formula.is_active
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-stone-100 text-stone-500'
                )}>
                  {formula.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Name + description */}
              <h3 className="font-['Manrope'] text-xl font-extrabold text-stone-900 dark:text-white mb-2 truncate">{formula.name}</h3>
              {formula.description && (
                <p className="text-stone-500 dark:text-neutral-400 text-sm mb-8 leading-relaxed line-clamp-2">{formula.description}</p>
              )}
              {!formula.description && <div className="mb-8" />}

              {/* Price */}
              <div className="mb-8">
                {formula.billing_type === 'quote' ? (
                  <span className="font-['Manrope'] text-2xl font-extrabold text-stone-900 dark:text-white">Sur devis</span>
                ) : (
                  <>
                    <span className="font-['Manrope'] text-4xl font-extrabold text-stone-900 dark:text-white">
                      {formula.price?.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </span>
                    <span className="text-stone-400 dark:text-neutral-500 text-sm ml-1">/ {formula.billing_type === 'subscription' ? 'mois' : 'unique'}</span>
                    {formula.billing_type === 'subscription' && formula.yearly_price != null && (
                      <div className="mt-1">
                        <span className="text-lg font-bold text-stone-600 dark:text-neutral-300">
                          {formula.yearly_price.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                        </span>
                        <span className="text-stone-400 dark:text-neutral-500 text-xs ml-1">/ an</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Resources */}
              <div className="py-4 border-t border-stone-100 dark:border-white/10">
                {resources.length > 0 ? (
                  <div className="space-y-2.5">
                    <p className="text-xs font-semibold text-stone-500 dark:text-neutral-400 uppercase tracking-wide">
                      {resources.length} Ressource{resources.length !== 1 ? 's' : ''}
                    </p>
                    {resources.map((r, i) => (
                      <div key={i} className="flex items-center gap-2.5 rounded-xl bg-stone-50 dark:bg-white/5 px-3 py-2">
                        <span className="flex items-center gap-1.5 text-xs text-stone-600 dark:text-neutral-300">
                          {getResourceIcon(r.type)}
                          <span className="font-medium">{r.name || r.type}</span>
                        </span>
                        {r.url && (
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 text-xs font-semibold text-stone-900 dark:text-white hover:text-stone-600 dark:hover:text-neutral-300 ml-auto transition-colors"
                          >
                            <ExternalLink className="h-3 w-3" /> Ouvrir
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-400 dark:text-neutral-500">
                    <File className="h-3.5 w-3.5" /> Aucune ressource
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Detail Modal */}
      {selectedFormula && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setSelectedFormula(null)}>
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-white dark:bg-neutral-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-white/10 px-8 py-5 flex-shrink-0">
              <h3 className="font-['Manrope'] text-xl font-extrabold text-stone-900 dark:text-white">Détails de la formule</h3>
              <button onClick={() => setSelectedFormula(null)} className="p-2 hover:bg-stone-100 dark:hover:bg-white/10 rounded-full text-stone-400 dark:text-neutral-500 hover:text-stone-900 dark:hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
              {/* Status */}
              <span className={cn(
                'inline-block text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full',
                selectedFormula.is_active
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-stone-100 text-stone-500'
              )}>
                {selectedFormula.is_active ? 'Active' : 'Inactive'}
              </span>

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-stone-500 dark:text-neutral-400 uppercase tracking-wide mb-1">Nom</label>
                <p className="font-['Manrope'] text-lg font-extrabold text-stone-900 dark:text-white">{selectedFormula.name}</p>
              </div>

              {/* Price */}
              <div>
                <label className="block text-xs font-semibold text-stone-500 dark:text-neutral-400 uppercase tracking-wide mb-1">Prix</label>
                <p className="font-['Manrope'] text-3xl font-extrabold text-stone-900 dark:text-white">
                  {selectedFormula.price?.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </p>
              </div>

              {/* Description */}
              {selectedFormula.description && (
                <div>
                  <label className="block text-xs font-semibold text-stone-500 dark:text-neutral-400 uppercase tracking-wide mb-1">Description</label>
                  <p className="text-sm text-stone-700 dark:text-neutral-300 leading-relaxed">{selectedFormula.description}</p>
                </div>
              )}

              {/* Resources */}
              <div>
                <label className="block text-xs font-semibold text-stone-500 dark:text-neutral-400 uppercase tracking-wide mb-3">
                  {(selectedFormula.resources || []).length} Ressource{(selectedFormula.resources || []).length !== 1 ? 's' : ''}
                </label>
                {(selectedFormula.resources || []).length > 0 ? (
                  <div className="space-y-2.5">
                    {(selectedFormula.resources || []).map((r, i) => (
                      <div key={i} className="flex items-center gap-2.5 rounded-xl bg-stone-50 dark:bg-white/5 px-4 py-3">
                        <span className="flex items-center gap-1.5 text-sm text-stone-600 dark:text-neutral-300">
                          {getResourceIcon(r.type)}
                          <span className="font-medium">{r.name || r.type}</span>
                        </span>
                        {r.url && (
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 ml-auto rounded-full bg-stone-900 dark:bg-white text-white dark:text-stone-900 px-4 py-1.5 text-xs font-semibold hover:opacity-80 active:scale-95 transition-all"
                          >
                            <ExternalLink className="h-3 w-3" /> Ouvrir
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-400 dark:text-neutral-500">
                    <File className="h-3.5 w-3.5" /> Aucune ressource
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end border-t border-stone-100 dark:border-white/10 px-8 py-5 flex-shrink-0">
              <button onClick={() => setSelectedFormula(null)} className="rounded-full border border-stone-200 dark:border-white/10 px-6 py-2.5 text-sm font-semibold text-stone-600 dark:text-neutral-300 hover:bg-stone-50 dark:hover:bg-white/10 transition-colors">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
