import { useState, useEffect } from 'react'
import { X, Plus, Trash2, Loader2, Save, MailX, AlertTriangle, Info, Link2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useBusinessLang } from '../i18n/BusinessLangContext'
import toast from 'react-hot-toast'

const MAX_RELANCES = 7

interface BookingLink {
  id: string
  label: string | null
  slug: string | null
  link: string | null
  duration: number | null
}

interface RelanceRow {
  delay_days: number
  subject: string
  body: string
  booking_link_id: string | null
}

interface Props {
  isOpen: boolean
  onClose: () => void
  ownerId: string
}

const DEFAULT_BODY_FR = `Bonjour {{lead_name}},

Nous n'avons pas pu échanger lors de notre rendez-vous.

Si le créneau ne convenait pas, vous pouvez en choisir un autre ci-dessous.

À très vite,`

const DEFAULT_BODY_EN = `Hi {{lead_name}},

We weren't able to connect at our scheduled call.

If the slot didn't suit you, you can pick another one below.

Talk soon,`

export function BusinessNoShowRelancesModal({ isOpen, onClose, ownerId }: Props) {
  const { lang } = useBusinessLang()
  const fr = lang !== 'en'

  const [rows, setRows] = useState<RelanceRow[]>([])
  const [bookingLinks, setBookingLinks] = useState<BookingLink[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch(`/api/business?action=noshow-relances-list&owner_id=${ownerId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })

      const text = await res.text()
      let data: any
      try {
        data = JSON.parse(text)
      } catch {
        // Réponse HTML = route non déployée (en dev, /api est proxifié vers la prod)
        throw new Error(
          fr
            ? "L'API ne répond pas en JSON : la route n'est probablement pas déployée."
            : 'The API did not return JSON: the route is likely not deployed.',
        )
      }

      if (!res.ok) {
        throw new Error(
          data?.error === 'Invalid action'
            ? (fr
                ? "Cette version de l'API ne connaît pas encore les relances No Show (déploiement requis)."
                : 'This API version does not know No Show follow-ups yet (deployment required).')
            : data?.error || (fr ? 'Chargement impossible.' : 'Could not load.'),
        )
      }

      setBookingLinks(data.booking_links || [])
      setRows(
        (data.relances || []).map((r: any) => ({
          delay_days: Number(r.delay_days) || 0,
          subject: r.subject || '',
          body: r.body || '',
          booking_link_id: r.booking_link_id || null,
        })),
      )
    } catch (err: any) {
      // On ne bascule PAS sur une liste vide : enregistrer écraserait la config existante
      setLoadError(err?.message || (fr ? 'Chargement impossible.' : 'Could not load.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isOpen || !ownerId) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, ownerId])

  if (!isOpen) return null

  const addRow = () => {
    if (rows.length >= MAX_RELANCES) return
    setRows(prev => [
      ...prev,
      {
        delay_days: prev.length === 0 ? 1 : 3,
        subject: fr ? 'On vous a manqué' : 'We missed you',
        body: fr ? DEFAULT_BODY_FR : DEFAULT_BODY_EN,
        booking_link_id: prev[0]?.booking_link_id ?? bookingLinks[0]?.id ?? null,
      },
    ])
  }

  const updateRow = (idx: number, patch: Partial<RelanceRow>) => {
    setRows(prev => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  const removeRow = (idx: number) => {
    setRows(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSave = async () => {
    const cleaned = rows.slice(0, MAX_RELANCES).map(r => ({
      delay_days: Math.min(60, Math.max(0, Math.floor(Number(r.delay_days) || 0))),
      subject: r.subject.trim() || (fr ? 'On vous a manqué' : 'We missed you'),
      body: r.body,
      booking_link_id: r.booking_link_id || null,
    }))

    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch('/api/business?action=noshow-relances-save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ owner_id: ownerId, relances: cleaned }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || 'error')
      }
      setRows(cleaned)
      toast.success(fr ? 'Relances enregistrées' : 'Follow-ups saved')
      onClose()
    } catch {
      toast.error(fr ? "Échec de l'enregistrement" : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  const inputCls =
    "w-full bg-transparent border-b border-[#c4c7c7]/30 dark:border-neutral-700 py-2 text-sm text-[#1b1c1b] dark:text-white placeholder:text-[#444748]/40 focus:border-[#006c49] focus:ring-0 outline-none transition-colors font-['Inter']"
  const selectCls =
    "w-full appearance-none bg-[#f5f3f2] dark:bg-neutral-800 rounded-xl border-0 px-3 py-2 text-sm text-[#1b1c1b] dark:text-white font-medium focus:ring-1 focus:ring-[#006c49]/20 focus:outline-none"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-neutral-900 rounded-xl overflow-hidden"
        style={{ boxShadow: '0 40px 100px rgba(0,0,0,0.08)', border: '0.5px solid rgba(196,199,199,0.2)' }}
      >
        {/* En-tête */}
        <div className="flex items-center justify-between px-8 py-5 flex-shrink-0 border-b border-[#c4c7c7]/10 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-stone-100 dark:bg-neutral-800 flex items-center justify-center">
              <MailX className="h-5 w-5 text-stone-500" />
            </div>
            <div>
              <h3 className="text-xl font-['Manrope'] font-extrabold text-[#1b1c1b] dark:text-white">
                {fr ? 'Relances No Show' : 'No-show follow-ups'}
              </h3>
              <p className="text-sm text-[#444748] dark:text-neutral-400">
                {fr
                  ? `Emails envoyés au prospect (${rows.length}/${MAX_RELANCES})`
                  : `Emails sent to the prospect (${rows.length}/${MAX_RELANCES})`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-[#444748]/40 hover:text-[#1b1c1b] dark:hover:text-white hover:bg-[#f5f3f2] dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto p-8">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-[#444748]/40" />
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="w-16 h-16 rounded-full bg-[#ffdad6]/40 flex items-center justify-center mb-5">
                <AlertTriangle className="h-7 w-7 text-[#ba1a1a]" />
              </div>
              <h4 className="text-lg font-['Manrope'] font-extrabold text-[#1b1c1b] dark:text-white mb-2">
                {fr ? 'Configuration illisible' : 'Could not load configuration'}
              </h4>
              <p className="text-sm text-[#444748] dark:text-neutral-400 max-w-sm mb-6 font-['Inter']">{loadError}</p>
              <button
                onClick={load}
                className="bg-black text-white px-6 py-2.5 rounded-full text-sm font-['Manrope'] font-bold active:scale-95 transition-all"
              >
                {fr ? 'Réessayer' : 'Retry'}
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Avertissement booking ↔ CRM */}
              <div className="flex items-start gap-3 rounded-xl bg-[#ffb95f]/10 px-4 py-3">
                <AlertTriangle className="h-4 w-4 text-[#b87500] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-[#b87500] leading-relaxed font-['Inter']">
                  {fr
                    ? "Les liens de booking sont reliés au CRM : toute réservation prise depuis ces emails crée un rendez-vous et met à jour la fiche du prospect automatiquement."
                    : 'Booking links are wired to the CRM: any booking made from these emails creates an appointment and updates the prospect record automatically.'}
                </p>
              </div>

              {bookingLinks.length === 0 && (
                <div className="flex items-start gap-3 rounded-xl bg-stone-100 dark:bg-neutral-800 px-4 py-3">
                  <Info className="h-4 w-4 text-[#444748] flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-[#444748] dark:text-neutral-400 leading-relaxed font-['Inter']">
                    {fr
                      ? "Aucun lien de booking pour l'instant. Créez-en un depuis Rendez-vous pour pouvoir l'insérer dans vos relances."
                      : 'No booking link yet. Create one from Appointments to insert it into your follow-ups.'}
                  </p>
                </div>
              )}

              {rows.length === 0 && (
                <p className="text-sm text-[#747878] dark:text-neutral-500 italic font-['Inter'] py-4">
                  {fr
                    ? "Aucune relance configurée : les prospects passés en No Show ne reçoivent aucun email."
                    : 'No follow-up configured: prospects moved to No Show receive no email.'}
                </p>
              )}

              {rows.map((row, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-[#c4c7c7]/20 dark:border-neutral-700 p-5 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#747878] dark:text-neutral-500">
                      {fr ? `Relance ${idx + 1}` : `Follow-up ${idx + 1}`}
                    </span>
                    <button
                      onClick={() => removeRow(idx)}
                      className="p-1.5 rounded-lg text-[#444748]/40 hover:text-[#ba1a1a] hover:bg-[#ffdad6]/30 transition-colors"
                      title={fr ? 'Supprimer' : 'Delete'}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Délai */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="number"
                      min={0}
                      max={60}
                      value={row.delay_days}
                      onChange={e => updateRow(idx, { delay_days: Number(e.target.value) })}
                      className="w-20 bg-[#f5f3f2] dark:bg-neutral-800 rounded-xl border-0 px-3 py-2 text-sm text-[#1b1c1b] dark:text-white focus:ring-1 focus:ring-[#006c49]/20 focus:outline-none"
                    />
                    <span className="text-sm text-[#444748] dark:text-neutral-400 font-['Inter']">
                      {idx === 0
                        ? fr
                          ? 'jour(s) après le passage en No Show'
                          : 'day(s) after being marked No Show'
                        : fr
                          ? 'jour(s) après la 1re relance'
                          : 'day(s) after the 1st follow-up'}
                    </span>
                  </div>

                  {/* Objet */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-[#747878] dark:text-neutral-500 mb-1">
                      {fr ? 'Objet' : 'Subject'}
                    </label>
                    <input
                      type="text"
                      value={row.subject}
                      onChange={e => updateRow(idx, { subject: e.target.value })}
                      className={inputCls}
                    />
                  </div>

                  {/* Message */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-[#747878] dark:text-neutral-500 mb-1">
                      {fr ? 'Message' : 'Message'}
                    </label>
                    <textarea
                      rows={6}
                      value={row.body}
                      onChange={e => updateRow(idx, { body: e.target.value })}
                      className={`${inputCls} resize-y leading-relaxed`}
                    />
                    <p className="mt-1 text-[11px] text-[#747878] dark:text-neutral-500 font-['Inter']">
                      {fr ? 'Variable disponible : ' : 'Available variable: '}
                      <code className="font-mono bg-[#f5f3f2] dark:bg-neutral-800 px-1 py-0.5 rounded">
                        {'{{lead_name}}'}
                      </code>
                    </p>
                  </div>

                  {/* Lien de booking */}
                  <div>
                    <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-[#747878] dark:text-neutral-500 mb-1">
                      <Link2 className="h-3 w-3" />
                      {fr ? 'Lien de booking' : 'Booking link'}
                    </label>
                    <select
                      value={row.booking_link_id || ''}
                      onChange={e => updateRow(idx, { booking_link_id: e.target.value || null })}
                      className={selectCls}
                    >
                      <option value="">{fr ? 'Aucun bouton de réservation' : 'No booking button'}</option>
                      {bookingLinks.map(link => (
                        <option key={link.id} value={link.id}>
                          {link.label || (fr ? 'Sans titre' : 'Untitled')}
                          {link.duration ? ` · ${link.duration} min` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}

              {rows.length < MAX_RELANCES && (
                <button
                  onClick={addRow}
                  className="flex items-center gap-2 text-sm font-bold text-[#1b1c1b] dark:text-white hover:text-[#006c49] transition-colors font-['Inter']"
                >
                  <Plus className="h-4 w-4" />
                  {fr ? 'Ajouter une relance' : 'Add a follow-up'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Pied */}
        <div className="flex items-center justify-end gap-3 px-8 py-5 flex-shrink-0 border-t border-[#c4c7c7]/10 dark:border-neutral-800">
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-full text-sm font-['Manrope'] font-bold text-[#444748] dark:text-neutral-400 hover:bg-[#f5f3f2] dark:hover:bg-neutral-800 transition-colors"
          >
            {fr ? 'Annuler' : 'Cancel'}
          </button>
          <button
            onClick={handleSave}
            /* Enregistrer après un échec de chargement écraserait la config existante */
            disabled={saving || loading || !!loadError}
            className="flex items-center gap-2 bg-black text-white px-7 py-3 rounded-full text-sm font-['Manrope'] font-bold hover:bg-[#1b1c1b] transition-colors active:scale-95 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {fr ? 'Enregistrer' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
