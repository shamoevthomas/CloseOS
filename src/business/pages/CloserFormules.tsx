import { useState, useEffect, useCallback } from 'react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import {
  Package, Loader2, FileText, Video, Link2, File, ExternalLink,
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
}

const API_URL = '/api/business'

export function CloserFormules() {
  const { ownerUserId } = useBusinessAuth()
  const [formulas, setFormulas] = useState<Formula[]>([])
  const [loading, setLoading] = useState(true)

  const fetchFormulas = useCallback(async () => {
    if (!ownerUserId) return
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
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 text-stone-400 animate-spin" /></div>
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <span className="text-xs uppercase tracking-[0.2em] text-stone-400 font-bold">Gestion Commerciale</span>
          <h1 className="font-['Manrope'] text-3xl md:text-4xl font-extrabold tracking-tight text-stone-900">
            {formulas.length} formule{formulas.length !== 1 ? 's' : ''}
          </h1>
          <p className="text-sm text-stone-500">Formules tarifaires de l'organisation (lecture seule)</p>
        </div>
      </div>

      {/* Empty state */}
      {formulas.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50 py-16">
          <Package className="h-12 w-12 text-stone-300 mb-4" />
          <h3 className="text-lg font-semibold text-stone-700 mb-1">Aucune formule</h3>
          <p className="text-sm text-stone-500">Votre manager n'a pas encore cree de formules.</p>
        </div>
      )}

      {/* Formula cards */}
      <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
        {formulas.map((formula) => {
          const resources = formula.resources || []
          return (
            <div key={formula.id} className="bg-white rounded-2xl p-8 shadow-[0_20px_40px_rgba(27,28,27,0.04)] hover:shadow-xl transition-all border border-stone-100/50">
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
              <h3 className="font-['Manrope'] text-xl font-extrabold text-stone-900 mb-2 truncate">{formula.name}</h3>
              {formula.description && (
                <p className="text-stone-500 text-sm mb-8 leading-relaxed line-clamp-2">{formula.description}</p>
              )}
              {!formula.description && <div className="mb-8" />}

              {/* Price */}
              <div className="mb-8">
                <span className="font-['Manrope'] text-4xl font-extrabold text-stone-900">
                  {formula.price?.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </span>
                <span className="text-stone-400 text-sm ml-1">/ unique</span>
              </div>

              {/* Resources */}
              <div className="py-4 border-t border-stone-100">
                {resources.length > 0 ? (
                  <div className="space-y-2.5">
                    <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
                      {resources.length} Ressource{resources.length !== 1 ? 's' : ''}
                    </p>
                    {resources.map((r, i) => (
                      <div key={i} className="flex items-center gap-2.5 rounded-xl bg-stone-50 px-3 py-2">
                        <span className="flex items-center gap-1.5 text-xs text-stone-600">
                          {getResourceIcon(r.type)}
                          <span className="font-medium">{r.name || r.type}</span>
                        </span>
                        {r.url && (
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs font-semibold text-stone-900 hover:text-stone-600 ml-auto transition-colors"
                          >
                            <ExternalLink className="h-3 w-3" /> Ouvrir
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-400">
                    <File className="h-3.5 w-3.5" /> Aucune ressource
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
