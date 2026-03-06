import { X } from 'lucide-react'
import { DataExportContent } from './DataExportContent'

interface DataExportModalProps {
  isOpen: boolean
  onClose: () => void
}

export function DataExportModal({ isOpen, onClose }: DataExportModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-[#0B1120] border border-slate-800 shadow-2xl p-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-xl font-bold text-white mb-2">Exporter mes données</h2>
        <p className="text-slate-400 text-sm mb-6">Téléchargez vos données au format PDF.</p>

        <DataExportContent />
      </div>
    </div>
  )
}
