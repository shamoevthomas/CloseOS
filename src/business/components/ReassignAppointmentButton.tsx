import { useState } from 'react'
import { createPortal } from 'react-dom'
import { UserCog, X, Loader2, ArrowRightLeft } from 'lucide-react'
import toast from 'react-hot-toast'

const API_URL = '/api/business'

export interface ReassignMember {
  id: string
  user_id?: string | null
  first_name: string
  last_name: string
  role: string
}

interface Props {
  appointmentId: string
  currentAssignedTo: string | null
  /** Owner id used as API `user_id` */
  ownerId?: string | null
  /** Current auth user id (the actor) */
  actorUserId?: string | null
  /** Role gate computed by the parent (Owner / HOS / Admin / Setter / Setter-Closer) */
  canReassign: boolean
  members: ReassignMember[]
  onReassigned?: () => void
  /** Stop click propagation on the trigger (for clickable cards) */
  stopPropagation?: boolean
  /** Extra classes for the trigger button */
  className?: string
  label?: string
}

/**
 * Bouton « Réassigner le rendez-vous » réutilisable.
 * Déplace le RDV vers le membre choisi (et son Google Agenda), en conservant le même lien Meet.
 * La personne initialement assignée est prévenue par email (géré côté API).
 */
export function ReassignAppointmentButton({
  appointmentId, currentAssignedTo, ownerId, actorUserId, canReassign,
  members, onReassigned, stopPropagation, className, label,
}: Props) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState('')
  const [saving, setSaving] = useState(false)

  if (!canReassign) return null

  const actorMemberId = (() => {
    const m = members.find(x => x.user_id === actorUserId || x.id === actorUserId)
    return m?.id || ''
  })()

  const openModal = (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation()
    // Pré-sélection : moi si je suis assignable, sinon le 1er membre différent de l'assigné actuel
    const fallback = members.find(m => m.id !== currentAssignedTo)?.id || members[0]?.id || ''
    setSelected(actorMemberId && actorMemberId !== currentAssignedTo ? actorMemberId : fallback)
    setOpen(true)
  }

  const submit = async () => {
    if (!selected || !ownerId) { toast.error('Sélection invalide'); return }
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}?action=appointment-reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: ownerId,
          appointment_id: appointmentId,
          new_assigned_to: selected,
          actor_user_id: actorUserId,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && (data.reassigned || data.unchanged)) {
        toast.success(data.unchanged ? 'Déjà assigné à ce membre' : 'Rendez-vous réassigné')
        setOpen(false)
        onReassigned?.()
      } else {
        toast.error(data.error === 'forbidden' ? "Vous n'avez pas la permission" : (data.error || 'Échec de la réassignation'))
      }
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={className || 'inline-flex items-center gap-1.5 rounded-full bg-[#f5f3f2] dark:bg-neutral-800 px-3 py-2 text-xs font-bold text-[#1b1c1b] dark:text-neutral-200 hover:bg-[#eae8e7] dark:hover:bg-neutral-700 transition-colors'}
        title="Réassigner le rendez-vous"
      >
        <UserCog className="h-3.5 w-3.5" strokeWidth={1.5} />
        {label || 'Réassigner'}
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={(e) => { e.stopPropagation(); if (!saving) setOpen(false) }}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white dark:bg-neutral-900 border border-[#c4c7c7]/20 dark:border-neutral-700 shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-1">
              <h3 className="text-lg font-bold text-[#1b1c1b] dark:text-white flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5" strokeWidth={1.5} /> Réassigner le rendez-vous
              </h3>
              <button onClick={() => !saving && setOpen(false)} className="p-1.5 rounded-full text-[#747878] hover:bg-[#f5f3f2] dark:hover:bg-neutral-800">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-[#747878] dark:text-neutral-400 mb-4">
              Le RDV (et son Google Agenda) passe au membre choisi. Le lien Google Meet reste le même. La personne actuellement assignée est prévenue par email.
            </p>

            <label className="block text-xs font-bold text-[#444748] dark:text-neutral-400 mb-2">Assigner à</label>
            <div className="relative">
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="w-full appearance-none rounded-xl border border-[#c4c7c7]/30 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-4 py-3 text-sm text-[#1b1c1b] dark:text-white outline-none focus:border-[#1b1c1b] dark:focus:border-neutral-400"
              >
                {members.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.first_name} {m.last_name} ({m.role}){m.id === currentAssignedTo ? ' — actuel' : ''}{m.id === actorMemberId ? ' — moi' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => !saving && setOpen(false)}
                className="flex-1 rounded-full border border-[#c4c7c7]/40 dark:border-neutral-700 px-4 py-2.5 text-sm font-bold text-[#444748] dark:text-neutral-300 hover:bg-[#f5f3f2] dark:hover:bg-neutral-800 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={submit}
                disabled={saving || !selected || selected === currentAssignedTo}
                className="flex-1 rounded-full bg-[#1b1c1b] dark:bg-white px-4 py-2.5 text-sm font-bold text-white dark:text-[#1b1c1b] hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Réassigner
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
