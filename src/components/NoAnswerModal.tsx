import { X, PhoneOff } from 'lucide-react'

interface NoAnswerModalProps {
  isOpen: boolean
  onClose: () => void
  onMarkAsNoShow: () => void
  prospectName: string
}

export function NoAnswerModal({ isOpen, onClose, onMarkAsNoShow, prospectName }: NoAnswerModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal - Mini version */}
      <div className="relative w-full max-w-md mx-4">
        <div className="rounded-2xl bg-slate-900 shadow-2xl ring-1 ring-slate-800">
          {/* Header */}
          <div className="border-b border-slate-800 px-6 py-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/20">
                  <PhoneOff className="h-5 w-5 text-orange-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Pas de réponse ?</h2>
                  <p className="text-sm text-slate-400 mt-0.5">
                    {prospectName}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-5">
            <p className="text-sm text-slate-300">
              Le prospect n'a pas décroché. Voulez-vous passer son statut en <span className="font-semibold text-white">"No Show"</span> ?
            </p>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-800 px-6 py-4 bg-slate-950/50">
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-300 transition-all hover:bg-slate-700"
              >
                Non, fermer
              </button>
              <button
                onClick={() => {
                  onMarkAsNoShow()
                  onClose()
                }}
                className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-orange-600 shadow-lg shadow-orange-500/20"
              >
                Oui, passer en No Show
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
