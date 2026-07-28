import { useState, useEffect, useMemo } from 'react'
import { X, Loader2, Download, Trash2, Inbox, UserCheck, ChevronLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { isInputBlock, blockLabel, answerToText, type FormBlock } from '../../lib/formBlocks'

const API_URL = '/api/business-forms'

interface FormResponse {
  id: string
  answers: Record<string, unknown>
  meta: Record<string, unknown>
  prospect_id: number | null
  created_at: string
}

interface Props {
  formId: string
  formName: string
  blocks: FormBlock[]
  userId: string
  onClose: () => void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Échappement CSV : guillemets doublés, champ cité si nécessaire. */
function csvCell(value: string): string {
  const needsQuotes = /[";\n\r]/.test(value)
  const escaped = value.replace(/"/g, '""')
  return needsQuotes ? `"${escaped}"` : escaped
}

export function FormResponsesModal({ formId, formName, blocks, userId, onClose }: Props) {
  const [responses, setResponses] = useState<FormResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<FormResponse | null>(null)

  // Colonnes = blocs de saisie, dans l'ordre du formulaire
  const columns = useMemo(
    () => blocks.filter(b => isInputBlock(b.type)).map((b, i) => ({ block: b, label: blockLabel(b, i) })),
    [blocks],
  )

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch(`${API_URL}?action=forms-responses&form_id=${formId}&user_id=${userId}`)
        const data = await res.json()
        if (res.ok) setResponses(data.responses || [])
        else toast.error('Chargement des réponses impossible')
      } catch {
        toast.error('Chargement des réponses impossible')
      } finally {
        setLoading(false)
      }
    })()
  }, [formId, userId])

  const deleteResponse = async (id: string) => {
    if (!confirm('Supprimer définitivement cette réponse ?')) return
    try {
      const res = await fetch(`${API_URL}?action=form-response-delete&id=${id}&user_id=${userId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error()
      setResponses(prev => prev.filter(r => r.id !== id))
      setSelected(null)
      toast.success('Réponse supprimée')
    } catch {
      toast.error('Suppression impossible')
    }
  }

  const exportCsv = () => {
    const header = ['Date', ...columns.map(c => c.label)]
    const rows = responses.map(r => [
      formatDate(r.created_at),
      ...columns.map(c => answerToText(c.block, r.answers[c.block.id])),
    ])

    // BOM UTF-8 + séparateur « ; » pour qu'Excel FR ouvre le fichier correctement
    const csv = '﻿' + [header, ...rows].map(row => row.map(csvCell).join(';')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${formName.replace(/[^\w\-]+/g, '_')}_reponses.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-5xl max-h-[90vh] flex flex-col bg-white dark:bg-neutral-900 rounded-xl overflow-hidden"
        style={{ boxShadow: '0 40px 100px rgba(0,0,0,0.08)', border: '0.5px solid rgba(196,199,199,0.2)' }}
      >
        {/* En-tête */}
        <div className="flex items-center justify-between px-8 py-5 flex-shrink-0 border-b border-[#c4c7c7]/10 dark:border-neutral-800">
          <div className="flex items-center gap-3 min-w-0">
            {selected && (
              <button
                onClick={() => setSelected(null)}
                className="p-2 rounded-full text-[#444748] hover:bg-[#f5f3f2] dark:hover:bg-neutral-800 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <div className="min-w-0">
              <h3 className="text-xl font-['Manrope'] font-extrabold text-[#1b1c1b] dark:text-white truncate">
                {selected ? 'Détail de la réponse' : 'Réponses'}
              </h3>
              <p className="text-sm text-[#444748] dark:text-neutral-400 truncate">
                {selected ? formatDate(selected.created_at) : `${formName} · ${responses.length} réponse${responses.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!selected && responses.length > 0 && (
              <button
                onClick={exportCsv}
                className="flex items-center gap-2 bg-[#f5f3f2] dark:bg-neutral-800 text-[#1b1c1b] dark:text-white px-4 py-2.5 rounded-xl font-['Manrope'] font-bold text-xs hover:bg-[#eae8e7] dark:hover:bg-neutral-700 transition-colors"
              >
                <Download className="h-3.5 w-3.5" /> Export CSV
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-full text-[#444748]/40 hover:text-[#1b1c1b] dark:hover:text-white hover:bg-[#f5f3f2] dark:hover:bg-neutral-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-[#444748]/40" />
            </div>
          ) : responses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center px-8">
              <div className="w-20 h-20 bg-[#efedec] dark:bg-neutral-800 rounded-full flex items-center justify-center mb-6">
                <Inbox className="h-8 w-8 text-[#444748]/30" />
              </div>
              <h4 className="text-xl font-['Manrope'] font-extrabold text-[#1b1c1b] dark:text-white mb-2">
                Aucune réponse pour l'instant
              </h4>
              <p className="text-[#444748] dark:text-neutral-400 max-w-sm font-['Inter']">
                Partagez le lien de votre formulaire — les réponses apparaîtront ici en temps réel.
              </p>
            </div>
          ) : selected ? (
            /* Détail */
            <div className="p-8 space-y-6">
              {selected.prospect_id && (
                <div className="flex items-center gap-2 text-sm text-[#006c49] font-bold font-['Inter']">
                  <UserCheck className="h-4 w-4" /> Un prospect a été créé dans le CRM
                </div>
              )}
              {columns.map(({ block, label }) => (
                <div key={block.id} className="border-l-2 border-[#c4c7c7]/30 dark:border-neutral-700 pl-4">
                  <p className="text-xs font-bold text-[#444748]/60 dark:text-neutral-500 uppercase tracking-wide font-['Inter']">
                    {label}
                  </p>
                  <p className="text-base text-[#1b1c1b] dark:text-white mt-1 whitespace-pre-wrap break-words font-['Inter']">
                    {answerToText(block, selected.answers[block.id]) || '—'}
                  </p>
                </div>
              ))}
              <div className="pt-4 flex justify-end">
                <button
                  onClick={() => deleteResponse(selected.id)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[#ba1a1a] hover:bg-[#ffdad6]/30 font-['Manrope'] font-bold text-xs transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Supprimer cette réponse
                </button>
              </div>
            </div>
          ) : (
            /* Tableau */
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#f5f3f2] dark:bg-neutral-800 z-10">
                <tr>
                  <th className="text-left px-6 py-3 font-['Manrope'] font-bold text-xs text-[#444748] dark:text-neutral-300 whitespace-nowrap">
                    Date
                  </th>
                  {columns.map(({ block, label }) => (
                    <th
                      key={block.id}
                      className="text-left px-6 py-3 font-['Manrope'] font-bold text-xs text-[#444748] dark:text-neutral-300 whitespace-nowrap max-w-[220px] truncate"
                      title={label}
                    >
                      {label}
                    </th>
                  ))}
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {responses.map(r => (
                  <tr
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className="border-t border-[#c4c7c7]/10 dark:border-neutral-800 hover:bg-[#f5f3f2]/60 dark:hover:bg-neutral-800/50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-3.5 text-[#444748] dark:text-neutral-400 whitespace-nowrap font-['Inter']">
                      <span className="flex items-center gap-2">
                        {formatDate(r.created_at)}
                        {r.prospect_id && <UserCheck className="h-3.5 w-3.5 text-[#006c49]" />}
                      </span>
                    </td>
                    {columns.map(({ block }) => (
                      <td
                        key={block.id}
                        className="px-6 py-3.5 text-[#1b1c1b] dark:text-white max-w-[220px] truncate font-['Inter']"
                      >
                        {answerToText(block, r.answers[block.id]) || <span className="opacity-30">—</span>}
                      </td>
                    ))}
                    <td className="px-2">
                      <button
                        onClick={e => { e.stopPropagation(); deleteResponse(r.id) }}
                        className="p-2 text-[#444748]/30 hover:text-[#ba1a1a] transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
