import { useState, useEffect, useCallback } from 'react'
import { useOrganization } from '../../contexts/OrganizationContext'
import {
  Package, Loader2, FileText, Video, Link2, File, ExternalLink, X, Building2, User as UserIcon,
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

export function OrgFormulas() {
  const { organization } = useOrganization()
  const [formulas, setFormulas] = useState<Formula[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFormula, setSelectedFormula] = useState<Formula | null>(null)

  const fetchFormulas = useCallback(async () => {
    if (!organization?.owner_id) return
    try {
      const res = await fetch(`/api/business?action=formulas-list&user_id=${organization.owner_id}`)
      const data = await res.json()
      if (data.formulas) setFormulas(data.formulas)
    } catch (err) {
      console.error('Error fetching formulas:', err)
    } finally {
      setLoading(false)
    }
  }, [organization?.owner_id])

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
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 text-slate-400 animate-spin" /></div>
  }

  return (
    <div className="space-y-8">
      {/* Header avec infos orga */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-600/10 to-purple-600/10 border border-blue-500/20">
        <div className="flex items-center gap-4 mb-3">
          {organization?.logo_url ? (
            <img src={organization.logo_url} alt="" className="w-10 h-10 rounded-xl object-cover border border-white/10" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-blue-400" />
            </div>
          )}
          <div>
            <h2 className="text-lg font-bold text-white">{organization?.org_name}</h2>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1"><UserIcon className="h-3 w-3" /> {organization?.owner_name}</span>
              <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold">{organization?.role}</span>
              {organization?.joined_at && (
                <span>Membre depuis le {new Date(organization.joined_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-extrabold text-white mb-1">{formulas.length} formule{formulas.length !== 1 ? 's' : ''}</h1>
        <p className="text-sm text-slate-500">Formules tarifaires de l'organisation (lecture seule)</p>
      </div>

      {formulas.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-700/50 bg-slate-800/30 py-16">
          <Package className="h-12 w-12 text-slate-600 mb-4" />
          <h3 className="text-lg font-bold text-slate-300 mb-1">Aucune formule</h3>
          <p className="text-sm text-slate-500">Votre manager n'a pas encore créé de formules.</p>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {formulas.map((formula) => {
          const resources = formula.resources || []
          return (
            <div
              key={formula.id}
              onClick={() => setSelectedFormula(formula)}
              className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 hover:border-slate-600/50 transition-all cursor-pointer hover:scale-[1.02]"
            >
              <div className="flex justify-between items-start mb-4">
                <span className={cn(
                  'text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full',
                  formula.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
                )}>
                  {formula.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <h3 className="text-lg font-bold text-white mb-2 truncate">{formula.name}</h3>
              {formula.description && <p className="text-slate-400 text-sm mb-6 line-clamp-2">{formula.description}</p>}
              {!formula.description && <div className="mb-6" />}

              <div className="mb-6">
                {formula.billing_type === 'quote' ? (
                  <span className="text-xl font-bold text-white">Sur devis</span>
                ) : (
                  <>
                    <span className="text-3xl font-extrabold text-white">
                      {formula.price?.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </span>
                    <span className="text-slate-500 text-sm ml-1">/ {formula.billing_type === 'subscription' ? 'mois' : 'unique'}</span>
                    {formula.billing_type === 'subscription' && formula.yearly_price != null && (
                      <div className="mt-1">
                        <span className="text-lg font-bold text-slate-300">
                          {formula.yearly_price.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                        </span>
                        <span className="text-slate-500 text-xs ml-1">/ an</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {resources.length > 0 && (
                <div className="pt-4 border-t border-slate-700/50">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                    {resources.length} Ressource{resources.length !== 1 ? 's' : ''}
                  </p>
                  {resources.slice(0, 3).map((r, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg bg-slate-900/50 px-3 py-1.5 mb-1.5">
                      <span className="flex items-center gap-1.5 text-xs text-slate-300">
                        {getResourceIcon(r.type)}
                        <span className="font-medium">{r.name || r.type}</span>
                      </span>
                      {r.url && (
                        <a href={r.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="ml-auto text-xs text-blue-400 hover:text-blue-300">
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Formula detail modal */}
      {selectedFormula && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setSelectedFormula(null)}>
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-8 relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedFormula(null)} className="absolute top-4 right-4 p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
              <X className="h-4 w-4" />
            </button>
            <h2 className="text-xl font-bold text-white mb-2">{selectedFormula.name}</h2>
            {selectedFormula.description && <p className="text-slate-400 text-sm mb-4">{selectedFormula.description}</p>}
            <div className="mb-6">
              {selectedFormula.billing_type === 'quote' ? (
                <span className="text-2xl font-bold text-white">Sur devis</span>
              ) : (
                <span className="text-3xl font-extrabold text-white">
                  {selectedFormula.price?.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                  <span className="text-slate-500 text-sm ml-1">/ {selectedFormula.billing_type === 'subscription' ? 'mois' : 'unique'}</span>
                </span>
              )}
            </div>
            {(selectedFormula.resources || []).length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase">Ressources</p>
                {selectedFormula.resources.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5">
                    {getResourceIcon(r.type)}
                    <span className="text-sm text-slate-300 font-medium flex-1">{r.name || r.type}</span>
                    {r.url && (
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-sm font-bold flex items-center gap-1">
                        Ouvrir <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
