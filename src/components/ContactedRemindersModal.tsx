import { useState, useEffect } from 'react'
import { X, Plus, Trash2, Loader2, Save, Bell } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'
import { useContactedReminders } from '../hooks/useContactedReminders'
import toast from 'react-hot-toast'

export function ContactedRemindersModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { lang } = useLanguage()
  const fr = lang !== 'en'
  const { delays, loading, saveDelays } = useContactedReminders()
  const [days, setDays] = useState<number[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (isOpen) setDays(delays) }, [isOpen, delays])

  if (!isOpen) return null

  const addRow = () => setDays(prev => [...prev, Math.min((prev.length ? Math.max(...prev) : 0) + 1, 60)])
  const updateRow = (idx: number, v: number) => setDays(prev => prev.map((d, i) => i === idx ? v : d))
  const removeRow = (idx: number) => setDays(prev => prev.filter((_, i) => i !== idx))

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveDelays(days)
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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4 bg-white dark:bg-[#1a1a1a] rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-100 rounded-lg border border-sky-200"><Bell className="w-5 h-5 text-sky-600 dark:text-sky-400" /></div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{fr ? 'Relances — Contacté' : 'Reminders — Contacted'}</h2>
              <p className="text-xs text-slate-500 dark:text-neutral-400">{fr ? 'Rappel automatique après X jours en « Contacté »' : 'Automatic reminder after X days in "Contacted"'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 dark:text-neutral-500 hover:bg-slate-100 hover:text-slate-600 transition-colors"><X className="w-5 h-5" /></button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[55vh] overflow-y-auto">
          <p className="text-sm text-slate-600 dark:text-neutral-300 leading-relaxed">
            {fr
              ? "Configurez les relances qui apparaissent sur la carte du prospect. La 1ère X jours après l'entrée en « Contacté » ; chaque suivante, X jours après la relance précédente (max 60 jours par intervalle)."
              : 'Set the follow-ups that appear on the prospect card. The 1st X days after entering "Contacted"; each next one, X days after the previous follow-up (max 60 days per interval).'}
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-400 dark:text-neutral-500" /></div>
          ) : (
            <div className="space-y-2.5">
              {days.length === 0 && (
                <p className="text-xs text-slate-400 dark:text-neutral-500 italic py-2">{fr ? 'Aucune relance configurée.' : 'No reminder configured.'}</p>
              )}
              {days.map((d, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-400 dark:text-neutral-500 w-24 shrink-0">
                    {fr ? `Relance n°${[...days].sort((a, b) => a - b).indexOf(d) + 1}` : `Reminder #${[...days].sort((a, b) => a - b).indexOf(d) + 1}`}
                  </span>
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-sm text-slate-500 dark:text-neutral-400">{fr ? 'au bout de' : 'after'}</span>
                    <input
                      type="number" min={1} max={60} value={d}
                      onChange={e => updateRow(idx, Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))}
                      className="w-20 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-sky-400"
                    />
                    <span className="text-sm text-slate-500 dark:text-neutral-400">{fr ? 'jour(s)' : 'day(s)'}</span>
                  </div>
                  <button onClick={() => removeRow(idx)} className="p-2 rounded-lg text-red-400/70 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              <button onClick={addRow} className="flex items-center gap-1.5 mt-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-neutral-300 hover:bg-slate-200 transition-colors">
                <Plus className="w-3.5 h-3.5" /> {fr ? 'Ajouter une relance' : 'Add a reminder'}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 pb-6 pt-2">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 dark:text-neutral-500 hover:text-slate-600 transition-colors">{fr ? 'Annuler' : 'Cancel'}</button>
          <button onClick={handleSave} disabled={saving || loading} className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-sky-600 text-sm font-bold text-white hover:bg-sky-500 transition-all shadow-lg disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {fr ? 'Enregistrer' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
