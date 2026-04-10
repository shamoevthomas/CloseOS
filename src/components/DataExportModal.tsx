import { X } from 'lucide-react'
import { DataExportContent } from './DataExportContent'

interface DataExportModalProps {
  isOpen: boolean
  onClose: () => void
}

export function DataExportModal({ isOpen, onClose }: DataExportModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-[#1a1a1a] border border-white/[0.08] shadow-2xl p-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-xl font-bold text-white mb-2">Exporter mes données</h2>
        <p className="text-white/40 text-sm mb-6">Téléchargez vos données au format PDF.</p>

        <DataExportContent />
      </div>
    </div>
  )
}
