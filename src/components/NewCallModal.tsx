import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Copy, Check, Phone } from 'lucide-react'
import { createDailyRoom } from '../services/dailyService'
import { useProspects } from '../contexts/ProspectsContext'
import { useCalls } from '../contexts/CallsContext'

interface NewCallModalProps {
  onClose: () => void
}

export function NewCallModal({ onClose }: NewCallModalProps) {
  const navigate = useNavigate()
  const { prospects } = useProspects()
  const { addCallLog } = useCalls()

  const [selectedProspectId, setSelectedProspectId] = useState<number | null>(null)
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  // Phase 1: Generate Link
  const handleGenerateLink = async () => {
    if (!selectedProspectId) {
      alert('Veuillez sélectionner un prospect')
      return
    }

    setIsCreating(true)
    try {
      const url = await createDailyRoom()
      setGeneratedLink(url)
    } catch (error) {
      console.error('Failed to create room:', error)
      alert('Erreur lors de la création du lien')
    } finally {
      setIsCreating(false)
    }
  }

  // Copy link to clipboard
  const handleCopyLink = async () => {
    if (!generatedLink) return

    try {
      await navigator.clipboard.writeText(generatedLink)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  // Phase 2: Join Call
  const handleJoinCall = () => {
    if (!generatedLink || !selectedProspectId) return

    // Find the selected prospect
    const selectedProspect = prospects.find(p => p.id === selectedProspectId)
    const contactName = selectedProspect ? `${selectedProspect.company} - ${selectedProspect.contact}` : 'Prospect'

    // Create call history entry BEFORE joining
    const callId = addCallLog({
      contactId: selectedProspectId,
      contactName,
      contactType: 'prospect',
      date: new Date().toISOString(),
      duration: 'En cours...',
      isAi: false,
      answered: true,
    })

    // Navigate to CallRoom with link AND call ID
    navigate(`/live-call?url=${encodeURIComponent(generatedLink)}&id=${callId}`)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-md rounded-xl bg-slate-900 p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">📞 Nouveau Call</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Phase 1: Generate Link */}
        {!generatedLink && (
          <div className="space-y-4">
            {/* Prospect Selector */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Prospect
              </label>
              <select
                value={selectedProspectId || ''}
                onChange={(e) => setSelectedProspectId(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="">Sélectionner un prospect</option>
                {prospects.map((prospect) => (
                  <option key={prospect.id} value={prospect.id}>
                    {prospect.company} - {prospect.contact}
                  </option>
                ))}
              </select>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerateLink}
              disabled={!selectedProspectId || isCreating}
              className="w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCreating ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Création...
                </span>
              ) : (
                '🔗 Générer le lien'
              )}
            </button>
          </div>
        )}

        {/* Phase 2: Link Ready */}
        {generatedLink && (
          <div className="space-y-4">
            {/* Selected Prospect Info */}
            <div className="rounded-lg bg-slate-800/50 p-3">
              <p className="text-sm text-slate-400">Prospect</p>
              <p className="font-semibold text-white">
                {prospects.find((p) => p.id === selectedProspectId)?.company} -{' '}
                {prospects.find((p) => p.id === selectedProspectId)?.contact}
              </p>
            </div>

            {/* Generated Link */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Lien de visioconférence
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={generatedLink}
                  readOnly
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-300 focus:outline-none"
                />
                <button
                  onClick={handleCopyLink}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-white transition-colors hover:bg-slate-700"
                  title="Copier le lien"
                >
                  {isCopied ? (
                    <Check className="h-5 w-5 text-green-500" />
                  ) : (
                    <Copy className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Join Button */}
            <button
              onClick={handleJoinCall}
              className="w-full rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-purple-700"
            >
              <span className="flex items-center justify-center gap-2">
                <Phone className="h-5 w-5" />
                📞 REJOINDRE L'APPEL
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
