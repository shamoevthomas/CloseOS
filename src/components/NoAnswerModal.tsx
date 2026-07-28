import { X, PhoneOff } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'

interface NoAnswerModalProps {
  isOpen: boolean
  onClose: () => void
  onMarkAsNoShow: () => void
  prospectName: string
}

export function NoAnswerModal({ isOpen, onClose, onMarkAsNoShow, prospectName }: NoAnswerModalProps) {
  const { lang } = useLanguage()
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal - Mini version */}
      <div className="relative w-full max-w-md mx-4">
        <div className="rounded-2xl bg-white dark:bg-[#1a1a1a] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_14px_34px_-16px_rgba(15,23,42,0.10)] border border-slate-200 dark:border-white/10">
          {/* Header */}
          <div className="border-b border-slate-200 dark:border-white/10 px-6 py-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/20">
                  <PhoneOff className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">{lang === 'fr' ? 'Pas de réponse ?' : 'No answer?'}</h2>
                  <p className="text-sm text-slate-400 dark:text-neutral-500 mt-0.5">
                    {prospectName}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 dark:text-neutral-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-5">
            <p className="text-sm text-slate-500 dark:text-neutral-400">
              {lang === 'fr'
                ? <>Le prospect n'a pas décroché. Voulez-vous passer son statut en <span className="font-semibold text-slate-900 dark:text-white">"No Show"</span> ?</>
                : <>The prospect didn't pick up. Do you want to change their status to <span className="font-semibold text-slate-900 dark:text-white">"No Show"</span>?</>}
            </p>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 dark:border-white/10 px-6 py-4 bg-black/20">
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                className="rounded-full border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-neutral-300 transition-all hover:bg-slate-100"
              >
                {lang === 'fr' ? 'Non, fermer' : 'No, close'}
              </button>
              <button
                onClick={() => {
                  onMarkAsNoShow()
                  onClose()
                }}
                className="rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-orange-600 shadow-lg shadow-orange-500/20"
              >
                {lang === 'fr' ? 'Oui, passer en No Show' : 'Yes, mark as No Show'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
