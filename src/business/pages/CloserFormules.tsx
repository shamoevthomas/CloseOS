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
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 text-amber-600 animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
          <Package className="h-5 w-5 text-amber-700" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">{formulas.length} formule{formulas.length !== 1 ? 's' : ''}</h2>
          <p className="text-xs text-slate-500">Formules tarifaires de l'organisation (lecture seule)</p>
        </div>
      </div>

      {/* Empty state */}
      {formulas.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/50 py-16">
          <Package className="h-12 w-12 text-amber-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">Aucune formule</h3>
          <p className="text-sm text-slate-500">Votre manager n'a pas encore cree de formules.</p>
        </div>
      )}

      {/* Formula cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {formulas.map((formula) => {
          const resources = formula.resources || []
          return (
            <div key={formula.id} className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
              <div className="mb-3">
                <h3 className="font-semibold text-slate-900 truncate">{formula.name}</h3>
                {formula.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{formula.description}</p>}
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                  formula.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                )}>
                  {formula.is_active ? 'Active' : 'Inactive'}
                </span>
                <span className="text-sm font-semibold text-amber-700">{formula.price?.toFixed(2)} €</span>
              </div>

              {/* Resources */}
              {resources.length > 0 && (
                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <p className="text-xs font-medium text-slate-500">Ressources ({resources.length})</p>
                  {resources.map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-xs text-slate-600">
                        {getResourceIcon(r.type)}
                        <span className="font-medium">{r.name || r.type}</span>
                      </span>
                      {r.url && (
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 ml-auto"
                        >
                          <ExternalLink className="h-3 w-3" /> Ouvrir
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {resources.length === 0 && (
                <div className="border-t border-slate-100 pt-3">
                  <p className="text-xs text-slate-400 italic">Aucune ressource</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
