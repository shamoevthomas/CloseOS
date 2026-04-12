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
        <div className="rounded-2xl bg-[#1a1a1a] shadow-[0_20px_40px_rgba(0,0,0,0.2)] border border-white/[0.08]">
          {/* Header */}
          <div className="border-b border-white/[0.08] px-6 py-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/20">
                  <PhoneOff className="h-5 w-5 text-orange-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{lang === 'fr' ? 'Pas de réponse ?' : 'No answer?'}</h2>
                  <p className="text-sm text-white/40 mt-0.5">
                    {prospectName}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-white/40 hover:bg-white/5 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-5">
            <p className="text-sm text-white/60">
              {lang === 'fr'
                ? <>Le prospect n'a pas décroché. Voulez-vous passer son statut en <span className="font-semibold text-white">"No Show"</span> ?</>
                : <>The prospect didn't pick up. Do you want to change their status to <span className="font-semibold text-white">"No Show"</span>?</>}
            </p>
          </div>

          {/* Footer */}
          <div className="border-t border-white/[0.08] px-6 py-4 bg-black/20">
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                className="rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-sm font-semibold text-white/80 transition-all hover:bg-white/10"
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
