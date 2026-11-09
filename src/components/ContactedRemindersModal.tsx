import { useState, useEffect } from 'react'
import { X, Plus, Trash2, Loader2, Save, Bell, MessageCircle } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { useContactedReminders } from '../hooks/useContactedReminders'
import { loadSalesWhatsAppTemplates, saveSalesWhatsAppTemplates, type WhatsAppTemplates } from '../lib/salesWhatsappTemplates'
import { stepLabel, fillWhatsAppMessage } from '../lib/whatsappMessage'
import { cn } from '../lib/utils'
import toast from 'react-hot-toast'

export function ContactedRemindersModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { lang } = useLanguage()
  const fr = lang !== 'en'
  const { user } = useAuth()
  const { delays, loading, saveDelays } = useContactedReminders()
  const [days, setDays] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  // Deuxième page : messages WhatsApp pré-remplis par relance
  const [tab, setTab] = useState<'delays' | 'whatsapp'>('delays')
  const [templates, setTemplates] = useState<WhatsAppTemplates>({})
  const [templatesError, setTemplatesError] = useState(false)

  useEffect(() => { if (isOpen) setDays(delays) }, [isOpen, delays])
  useEffect(() => {
    if (!isOpen || !user?.id) return
    setTab('delays')
    loadSalesWhatsAppTemplates(user.id).then((t) => { setTemplates(t); setTemplatesError(false) }).catch(() => setTemplatesError(true))
  }, [isOpen, user?.id])

  if (!isOpen) return null

  const sorted = [...days].sort((a, b) => a - b)
  const stepCount = Math.max(sorted.length, ...Object.keys(templates).map(Number), 1)
  const steps = Array.from({ length: stepCount + 1 }, (_, i) => i)

  const addRow = () => setDays(prev => [...prev, Math.min((prev.length ? Math.max(...prev) : 0) + 1, 60)])
  const updateRow = (idx: number, v: number) => setDays(prev => prev.map((d, i) => i === idx ? v : d))
  const removeRow = (idx: number) => setDays(prev => prev.filter((_, i) => i !== idx))

  const handleSave = async () => {
    setSaving(true)
    try {
      if (tab === 'whatsapp') {
        if (!user?.id) throw new Error('no user')
        await saveSalesWhatsAppTemplates(user.id, templates)
        toast.success(fr ? 'Messages WhatsApp enregistrés' : 'WhatsApp messages saved')
      } else {
        await saveDelays(days)
        toast.success(fr ? 'Relances enregistrées' : 'Reminders saved')
      }
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
              <p className="text-xs text-slate-500 dark:text-neutral-400">
                {tab === 'delays'
                  ? (fr ? 'Rappel automatique après X jours en « Contacté »' : 'Automatic reminder after X days in "Contacted"')
                  : (fr ? 'Messages pré-remplis du bouton WhatsApp' : 'Pre-filled messages for the WhatsApp button')}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 dark:text-neutral-500 hover:bg-slate-100 hover:text-slate-600 transition-colors"><X className="w-5 h-5" /></button>
        </div>

        {/* Pages du pop-up */}
        <div className="flex gap-1 px-6 pt-4">
          {([['delays', fr ? 'Délais de relance' : 'Follow-up delays', Bell], ['whatsapp', fr ? 'Messages WhatsApp' : 'WhatsApp messages', MessageCircle]] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn('flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all',
                tab === id ? 'bg-sky-600 text-white' : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-neutral-400 hover:text-slate-800')}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        {tab === 'whatsapp' ? (
          <div className="p-6 space-y-4 max-h-[55vh] overflow-y-auto">
            <p className="text-sm text-slate-600 dark:text-neutral-300 leading-relaxed">
              {fr
                ? "Écris le message à envoyer à chaque étape. Sur la fiche prospect et en mode cartes, le bouton WhatsApp proposera le bon message (selon la relance en cours) déjà écrit : il n'y aura plus qu'à appuyer sur Envoyer."
                : 'Write the message for each step. On the prospect sheet and in card mode, the WhatsApp button will offer the right message (based on the current follow-up), ready to send.'}
            </p>
            <p className="text-xs text-slate-500 dark:text-neutral-400">
              {fr ? 'Variables : ' : 'Variables: '}
              <code className="rounded bg-slate-100 dark:bg-white/10 px-1">{'{{prenom}}'}</code> {fr ? 'du prospect, ' : 'of the prospect, '}
              <code className="rounded bg-slate-100 dark:bg-white/10 px-1">{'{{nom}}'}</code>,{' '}
              <code className="rounded bg-slate-100 dark:bg-white/10 px-1">{'{{mon_prenom}}'}</code> {fr ? '(toi).' : '(you).'}
            </p>
            {templatesError ? (
              <p className="rounded-lg bg-amber-50 dark:bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
                {fr ? 'Impossible de charger les messages WhatsApp pour le moment.' : 'Could not load WhatsApp messages right now.'}
              </p>
            ) : steps.map((step) => (
              <div key={step} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-500 dark:text-neutral-400">
                    {stepLabel(step, fr)}
                    {step > 0 && sorted[step - 1] != null && <span className="ml-1 font-normal opacity-70">· {fr ? `${sorted[step - 1]} j après` : `${sorted[step - 1]} d after`}</span>}
                  </label>
                  {templates[step] && (
                    <button onClick={() => setTemplates((t) => ({ ...t, [step]: '' }))} className="text-[11px] font-semibold text-slate-400 hover:text-red-500">{fr ? 'Effacer' : 'Clear'}</button>
                  )}
                </div>
                <textarea
                  value={templates[step] || ''}
                  onChange={(e) => setTemplates((t) => ({ ...t, [step]: e.target.value }))}
                  rows={3}
                  maxLength={4000}
                  placeholder={step === 0 ? (fr ? 'Salut {{prenom}}, c’est {{mon_prenom}} ! …' : 'Hi {{prenom}}, it’s {{mon_prenom}}! …') : (fr ? '{{prenom}} ?' : '{{prenom}}?')}
                  className="w-full resize-y rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#25D366]"
                />
                {templates[step]?.includes('{{') && (
                  <p className="text-[11px] text-slate-400 dark:text-neutral-500 truncate">
                    {fr ? 'Aperçu : ' : 'Preview: '}{fillWhatsAppMessage(templates[step], { prenom: 'Camille', nom: 'Martin', mon_prenom: 'Thomas' })}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
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
                      {fr ? `Relance n°${sorted.indexOf(d) + 1}` : `Reminder #${sorted.indexOf(d) + 1}`}
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
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 pb-6 pt-2">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 dark:text-neutral-500 hover:text-slate-600 transition-colors">{fr ? 'Annuler' : 'Cancel'}</button>
          <button onClick={handleSave} disabled={saving || loading || (tab === 'whatsapp' && templatesError)} className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-sky-600 text-sm font-bold text-white hover:bg-sky-500 transition-all shadow-lg disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {fr ? 'Enregistrer' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
