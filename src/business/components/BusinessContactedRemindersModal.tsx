import { useState, useEffect } from 'react'
import { X, Plus, Trash2, Loader2, Save, Bell } from 'lucide-react'
import { cn } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import { useBusinessLang } from '../i18n/BusinessLangContext'
import toast from 'react-hot-toast'

interface Props {
  isOpen: boolean
  onClose: () => void
  ownerId: string
}

export function BusinessContactedRemindersModal({ isOpen, onClose, ownerId }: Props) {
  const { lang } = useBusinessLang()
  const fr = lang !== 'en'
  const [days, setDays] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen || !ownerId) return
    setLoading(true)
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        const res = await fetch(`/api/business?action=contacted-reminders-list&owner_id=${ownerId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
        const data = await res.json()
        setDays((data.reminders || []).map((r: any) => Number(r.days)))
      } catch {
        setDays([])
      } finally {
        setLoading(false)
      }
    })()
  }, [isOpen, ownerId])

  if (!isOpen) return null

  const sorted = [...days].sort((a, b) => a - b)

  const addRow = () => {
    // Propose un délai par défaut non déjà pris
    const candidate = (Math.max(0, ...days) || 0) + 1
    setDays(prev => [...prev, Math.min(candidate, 60)])
  }
  const updateRow = (idx: number, value: number) => {
    setDays(prev => prev.map((d, i) => i === idx ? value : d))
  }
  const removeRow = (idx: number) => {
    setDays(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSave = async () => {
    // Nettoyage : entiers 1..60, uniques
    const cleaned = Array.from(new Set(
      days.map(d => Math.floor(Number(d))).filter(d => Number.isFinite(d) && d >= 1 && d <= 60)
    )).sort((a, b) => a - b)
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch('/api/business?action=contacted-reminders-save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ owner_id: ownerId, days: cleaned }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || 'error')
      }
      setDays(cleaned)
      toast.success(fr ? 'Relances enregistrées' : 'Reminders saved')
      onClose()
    } catch {
      toast.error(fr ? "Erreur lors de l'enregistrement" : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4 bg-white dark:bg-[#1a1a1a] rounded-2xl border border-stone-200 dark:border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-stone-100 dark:border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-100 dark:bg-sky-500/20 rounded-lg border border-sky-200 dark:border-sky-500/30">
              <Bell className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-stone-900 dark:text-white">
                {fr ? 'Relances — Contacté' : 'Reminders — Contacted'}
              </h2>
              <p className="text-xs text-stone-500 dark:text-neutral-400">
                {fr ? 'Emails automatiques au commercial assigné' : 'Automatic emails to the assigned rep'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-stone-400 hover:bg-stone-100 dark:hover:bg-white/5 hover:text-stone-600 dark:hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[55vh] overflow-y-auto">
          <p className="text-sm text-stone-600 dark:text-neutral-300 leading-relaxed">
            {fr
              ? "Configurez au bout de combien de jours dans « Contacté » le setter assigné (ou le closer) reçoit un email de relance. Vous pouvez en ajouter plusieurs (max 60 jours)."
              : 'Set after how many days in "Contacted" the assigned setter (or closer) gets a follow-up email. You can add several (max 60 days).'}
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
            </div>
          ) : (
            <div className="space-y-2.5">
              {sorted.length === 0 && (
                <p className="text-xs text-stone-400 dark:text-white/40 italic py-2">
                  {fr ? 'Aucune relance configurée.' : 'No reminder configured.'}
                </p>
              )}
              {days.map((d, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-stone-400 dark:text-neutral-500 w-20 shrink-0">
                    {fr ? `Relance n°${[...days].sort((a, b) => a - b).indexOf(d) + 1}` : `Reminder #${[...days].sort((a, b) => a - b).indexOf(d) + 1}`}
                  </span>
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-sm text-stone-500 dark:text-neutral-400">{fr ? 'au bout de' : 'after'}</span>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={d}
                      onChange={e => updateRow(idx, Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))}
                      className="w-20 rounded-lg border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/5 px-3 py-2 text-sm font-semibold text-stone-900 dark:text-white focus:outline-none focus:border-sky-400"
                    />
                    <span className="text-sm text-stone-500 dark:text-neutral-400">{fr ? 'jour(s)' : 'day(s)'}</span>
                  </div>
                  <button
                    onClick={() => removeRow(idx)}
                    className="p-2 rounded-lg text-red-400/70 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              <button
                onClick={addRow}
                className="flex items-center gap-1.5 mt-2 px-3 py-2 rounded-lg bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 text-xs font-bold text-stone-700 dark:text-neutral-200 hover:bg-stone-200 dark:hover:bg-white/10 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> {fr ? 'Ajouter une relance' : 'Add a reminder'}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 pb-6 pt-2">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-medium text-stone-400 hover:text-stone-600 dark:hover:text-white transition-colors">
            {fr ? 'Annuler' : 'Cancel'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className={cn(
              'flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#006c49] text-sm font-bold text-white hover:bg-[#005a3d] transition-all shadow-lg disabled:opacity-50'
            )}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {fr ? 'Enregistrer' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
