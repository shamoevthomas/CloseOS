import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, AlertTriangle, Calendar, Mail } from 'lucide-react'
import { cn } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import { fromUTC } from '../../lib/timezone'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessLang } from '../i18n/BusinessLangContext'
import {
  UNQUALIFIED_REASONS,
  unqualifiedReasonLabel,
  type UnqualifiedPayload,
  type UnqualifiedReasonKey,
} from '../lib/unqualifiedReasons'

interface UnqualifiedProspect {
  id: number
  contact?: string
  email?: string
}

interface Props {
  prospect: UnqualifiedProspect
  onClose: () => void
  onConfirm: (payload: UnqualifiedPayload) => void | Promise<void>
}

interface UpcomingAppt {
  id: string
  date: string
  time: string
}

/**
 * Pop-up affichée au passage d'un prospect en « Non-Qualifié » (fiche prospect
 * ou drag & drop pipeline) : motif obligatoire, email d'information au prospect
 * et, s'il a un RDV à venir, proposition de l'annuler dans la foulée.
 */
export function UnqualifiedReasonModal({ prospect, onClose, onConfirm }: Props) {
  const { user, ownerUserId, isTeamMember, userTimezone } = useBusinessAuth()
  const { lang } = useBusinessLang()
  const fr = lang !== 'en'

  const [reason, setReason] = useState<UnqualifiedReasonKey | ''>('')
  const [details, setDetails] = useState('')
  const [sendEmail, setSendEmail] = useState(true)
  const [cancelAppt, setCancelAppt] = useState(true)
  const [upcoming, setUpcoming] = useState<UpcomingAppt | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const hasEmail = !!prospect.email
  useEffect(() => { if (!hasEmail) setSendEmail(false) }, [hasEmail])

  // Prochain RDV à venir (en attente ou confirmé) — converti dans le fuseau du visiteur.
  useEffect(() => {
    const ownerId = isTeamMember ? ownerUserId : user?.id
    if (!ownerId || !prospect.id) return
    let cancelled = false
    supabase
      .from('business_appointments')
      .select('id, date, time, status, datetime_utc')
      .eq('prospect_id', prospect.id)
      .in('status', ['pending', 'confirmed'])
      .order('date', { ascending: true })
      .order('time', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return
        const nowUtc = new Date().toISOString()
        const localNow = fromUTC(nowUtc, userTimezone)
        type ApptRow = { id: string; date: string; time: string | null; datetime_utc: string | null }
        const rows = ((data || []) as ApptRow[]).map(a => {
          if (a.datetime_utc) {
            const l = fromUTC(a.datetime_utc, userTimezone)
            return { id: a.id, date: l.date, time: l.time, datetime_utc: a.datetime_utc as string | null }
          }
          return { id: a.id, date: a.date, time: (a.time || '').slice(0, 5) || '00:00', datetime_utc: null }
        })
        const future = rows.find(a =>
          a.datetime_utc
            ? a.datetime_utc > nowUtc
            : a.date > localNow.date || (a.date === localNow.date && a.time >= localNow.time)
        )
        setUpcoming(future ? { id: future.id, date: future.date, time: future.time } : null)
      })
    return () => { cancelled = true }
  }, [prospect.id, user?.id, ownerUserId, isTeamMember, userTimezone])

  const apptLabel = useMemo(() => {
    if (!upcoming) return ''
    const d = new Date(`${upcoming.date}T${upcoming.time}:00`)
    const formatted = new Intl.DateTimeFormat(fr ? 'fr-FR' : 'en-GB', {
      weekday: 'long', day: 'numeric', month: 'long',
    }).format(d)
    return `${formatted} ${fr ? 'à' : 'at'} ${upcoming.time}`
  }, [upcoming, fr])

  const detailsRequired = reason === 'other'
  const canSubmit = !!reason && (!detailsRequired || details.trim().length > 0) && !submitting

  const handleSubmit = async () => {
    if (!canSubmit || !reason) return
    setSubmitting(true)
    try {
      await onConfirm({
        reason,
        reasonLabel: unqualifiedReasonLabel(reason, fr ? 'fr' : 'en', details),
        details: details.trim(),
        sendEmail: sendEmail && hasEmail,
        cancelAppointmentId: upcoming && cancelAppt ? upcoming.id : null,
      })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-stone-900/10 backdrop-blur-sm" onClick={() => !submitting && onClose()} />
      <div className="relative w-full max-w-md max-h-[88vh] flex flex-col rounded-3xl bg-white dark:bg-neutral-900 shadow-2xl border border-[#c4c7c7]/10 dark:border-neutral-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#c4c7c7]/10 dark:border-neutral-700">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 text-amber-500" strokeWidth={1.5} />
            <h3 className="font-business-display font-extrabold text-stone-900 dark:text-white">
              {fr ? 'Quel est le motif ?' : 'What is the reason?'}
            </h3>
          </div>
          <button
            onClick={() => !submitting && onClose()}
            className="rounded-full p-2 text-stone-400 hover:bg-[#f5f3f2] dark:hover:bg-neutral-700 hover:text-stone-700 dark:hover:text-neutral-200 transition-colors"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto custom-scrollbar">
          <p className="text-xs text-stone-500 dark:text-neutral-400">
            {hasEmail && sendEmail
              ? (fr
                  ? `${prospect.contact || 'Le prospect'} passe en Non-Qualifié et recevra un email pour l'en avertir.`
                  : `${prospect.contact || 'This prospect'} will be marked as unqualified and notified by email.`)
              : (fr
                  ? `${prospect.contact || 'Le prospect'} passe en Non-Qualifié. Aucun email ne sera envoyé.`
                  : `${prospect.contact || 'This prospect'} will be marked as unqualified. No email will be sent.`)}
          </p>

          {/* Motifs */}
          <div className="space-y-1.5">
            {UNQUALIFIED_REASONS.map(r => (
              <button
                key={r.key}
                type="button"
                onClick={() => setReason(r.key)}
                className={cn(
                  'w-full text-left rounded-2xl border px-4 py-3 text-sm transition-all',
                  reason === r.key
                    ? 'border-stone-900 dark:border-white bg-stone-900/5 dark:bg-white/10 font-bold text-stone-900 dark:text-white'
                    : 'border-stone-200 dark:border-neutral-700 text-stone-600 dark:text-neutral-300 hover:bg-[#f5f3f2] dark:hover:bg-neutral-800'
                )}
              >
                {fr ? r.fr : r.en}
              </button>
            ))}
          </div>

          {/* Texte libre pour « Autre » */}
          {detailsRequired && (
            <div className="animate-in fade-in slide-in-from-top-1">
              <label className="text-[10px] uppercase tracking-widest text-stone-400 font-bold block mb-2 ml-1">
                {fr ? 'Précisez le motif' : 'Specify the reason'}
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                autoFocus
                placeholder={fr ? 'Ce motif sera repris dans l\'email envoyé au prospect.' : 'This reason will appear in the email sent to the prospect.'}
                className="w-full rounded-2xl border border-stone-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-4 py-3 text-sm text-stone-900 dark:text-white placeholder:text-stone-400 focus:border-stone-900 dark:focus:border-white focus:ring-2 focus:ring-stone-900/10 focus:outline-none transition-all resize-none"
              />
            </div>
          )}

          {/* Email */}
          <label
            className={cn(
              'flex items-start gap-3 rounded-2xl border p-4 transition-colors',
              hasEmail
                ? 'border-stone-200 dark:border-neutral-700 cursor-pointer hover:bg-[#f5f3f2] dark:hover:bg-neutral-800'
                : 'border-stone-200 dark:border-neutral-700 opacity-60 cursor-not-allowed'
            )}
          >
            <input
              type="checkbox"
              checked={sendEmail}
              disabled={!hasEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900/20"
            />
            <span className="flex-1">
              <span className="flex items-center gap-1.5 text-sm font-bold text-stone-900 dark:text-white">
                <Mail className="h-3.5 w-3.5" strokeWidth={1.5} />
                {fr ? 'Prévenir le prospect par email' : 'Notify the prospect by email'}
              </span>
              <span className="mt-0.5 block text-xs text-stone-500 dark:text-neutral-400">
                {hasEmail
                  ? prospect.email
                  : (fr ? 'Aucune adresse email sur cette fiche.' : 'No email address on this record.')}
              </span>
            </span>
          </label>

          {/* Annulation du RDV */}
          {upcoming && (
            <label className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 cursor-pointer transition-colors hover:bg-amber-500/10">
              <input
                type="checkbox"
                checked={cancelAppt}
                onChange={(e) => setCancelAppt(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900/20"
              />
              <span className="flex-1">
                <span className="flex items-center gap-1.5 text-sm font-bold text-stone-900 dark:text-white">
                  <Calendar className="h-3.5 w-3.5" strokeWidth={1.5} />
                  {fr ? 'Annuler aussi le rendez-vous' : 'Also cancel the appointment'}
                </span>
                <span className="mt-0.5 block text-xs text-stone-500 dark:text-neutral-400">
                  {fr ? `Rendez-vous prévu le ${apptLabel}.` : `Appointment scheduled on ${apptLabel}.`}
                </span>
              </span>
            </label>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#c4c7c7]/10 dark:border-neutral-700">
          <button
            onClick={() => !submitting && onClose()}
            className="rounded-full px-5 py-2.5 text-sm font-bold text-stone-500 dark:text-neutral-400 hover:bg-[#f5f3f2] dark:hover:bg-neutral-800 transition-colors"
          >
            {fr ? 'Annuler' : 'Cancel'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-full bg-stone-900 dark:bg-white px-6 py-2.5 text-sm font-bold text-white dark:text-stone-900 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {submitting ? (fr ? 'Validation…' : 'Saving…') : (fr ? 'Valider' : 'Confirm')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
