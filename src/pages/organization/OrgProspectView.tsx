import { useState } from 'react'
import {
  X, User, Building2, Mail, Phone, DollarSign, Calendar, FileText, Tag, Loader2,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import type { BusinessProspect } from '../../business/contexts/BusinessProspectsContext'

interface OrgProspectViewProps {
  prospect: BusinessProspect
  onClose: () => void
  onUpdate: (updates: Partial<BusinessProspect>) => void
}

const STAGES = [
  { id: 'prospect', name: 'Prospect', color: 'bg-amber-400' },
  { id: 'qualified', name: 'Qualifié', color: 'bg-purple-400' },
  { id: 'followup', name: 'Follow Up', color: 'bg-orange-400' },
  { id: 'won', name: 'Gagné', color: 'bg-emerald-500' },
  { id: 'unqualified', name: 'Non-Qualifié', color: 'bg-slate-400' },
  { id: 'noanswer', name: 'Pas de Réponse', color: 'bg-slate-400' },
  { id: 'noshow', name: 'No Show', color: 'bg-slate-400' },
  { id: 'lost', name: 'Perdu', color: 'bg-red-500' },
]

export function OrgProspectView({ prospect, onClose, onUpdate }: OrgProspectViewProps) {
  const [notes, setNotes] = useState(prospect.notes || '')
  const [savingNotes, setSavingNotes] = useState(false)

  const displayName = (prospect.firstName || prospect.lastName)
    ? `${prospect.firstName || ''} ${prospect.lastName || ''}`.trim()
    : prospect.contact || 'Prospect sans nom'

  const handleSaveNotes = async () => {
    setSavingNotes(true)
    await onUpdate({ notes })
    setSavingNotes(false)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="h-full w-full max-w-lg bg-slate-900 border-l border-slate-700 overflow-y-auto animate-in slide-in-from-right duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700/50 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
              {prospect.company && prospect.company !== 'N/A'
                ? <Building2 className="h-5 w-5 text-slate-400" />
                : <User className="h-5 w-5 text-slate-400" />
              }
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{displayName}</h2>
              {prospect.company && prospect.company !== 'N/A' && (
                <p className="text-xs text-slate-400">{prospect.company}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Stage selector */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Étape</p>
            <div className="flex flex-wrap gap-2">
              {STAGES.map(s => (
                <button
                  key={s.id}
                  onClick={() => onUpdate({ stage: s.id })}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                    prospect.stage === s.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                  )}
                >
                  <span className={cn('inline-block w-1.5 h-1.5 rounded-full mr-1.5', s.color)} />
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          {/* Contact info */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Contact</p>
            {prospect.email && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 border border-slate-700/30">
                <Mail className="h-4 w-4 text-slate-500" />
                <a href={`mailto:${prospect.email}`} className="text-sm text-blue-400 hover:text-blue-300">{prospect.email}</a>
              </div>
            )}
            {prospect.phone && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 border border-slate-700/30">
                <Phone className="h-4 w-4 text-slate-500" />
                <a href={`tel:${prospect.phone}`} className="text-sm text-blue-400 hover:text-blue-300">{prospect.phone}</a>
              </div>
            )}
          </div>

          {/* Value */}
          {prospect.value != null && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-400" />
                <span className="text-2xl font-extrabold text-white">{prospect.value.toLocaleString('fr-FR')} €</span>
              </div>
              {prospect.payment_type && (
                <p className="text-xs text-emerald-300/70 mt-1">
                  {prospect.payment_type === 'once' || prospect.payment_type === 'comptant' ? 'Paiement unique' :
                   prospect.payment_type === 'installments' ? `${prospect.installments || '?'} fois` : prospect.payment_type}
                </p>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Notes</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={5}
              className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-none"
              placeholder="Ajouter des notes..."
            />
            {notes !== (prospect.notes || '') && (
              <button
                onClick={handleSaveNotes}
                disabled={savingNotes}
                className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold transition-all flex items-center gap-2"
              >
                {savingNotes ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                Sauvegarder
              </button>
            )}
          </div>

          {/* Call notes */}
          {prospect.call_notes && prospect.call_notes.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Historique des appels</p>
              <div className="space-y-2">
                {prospect.call_notes.map((note, i) => (
                  <div key={note.id || i} className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/30">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="h-3 w-3 text-slate-500" />
                      <span className="text-[10px] text-slate-500 font-bold">
                        {new Date(note.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      {note.author && <span className="text-[10px] text-slate-600">par {note.author}</span>}
                    </div>
                    <p className="text-xs text-slate-300">{note.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Meta */}
          {prospect.created_at && (
            <p className="text-[10px] text-slate-600 text-center pt-4 border-t border-slate-800">
              Créé le {new Date(prospect.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
