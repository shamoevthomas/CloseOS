import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Copy, Check, Phone } from 'lucide-react'
import { createDailyRoom } from '../services/dailyService'
import { useProspects } from '../contexts/ProspectsContext'
import { useCalls } from '../contexts/CallsContext'
import { useLanguage } from '../contexts/LanguageContext'
import { newCallTranslations } from '../i18n/translations'

interface NewCallModalProps {
  onClose: () => void
}

export function NewCallModal({ onClose }: NewCallModalProps) {
  const navigate = useNavigate()
  const { prospects } = useProspects()
  const { addCallLog } = useCalls()
  const { lang } = useLanguage()
  const t = newCallTranslations[lang]

  const [selectedProspectId, setSelectedProspectId] = useState<number | null>(null)
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  // Phase 1: Generate Link
  const handleGenerateLink = async () => {
    if (!selectedProspectId) {
      alert(lang === 'fr' ? 'Veuillez sélectionner un prospect' : 'Please select a prospect')
      return
    }

    setIsCreating(true)
    try {
      const url = await createDailyRoom()
      setGeneratedLink(url)
    } catch (error) {
      console.error('Failed to create room:', error)
      alert(lang === 'fr' ? 'Erreur lors de la création du lien' : 'Error creating link')
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-[#1a1a1a] border border-white/[0.08] p-6 shadow-[0_20px_40px_rgba(0,0,0,0.2)]">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">📞 Nouveau Call</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-white/40 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Phase 1: Generate Link */}
        {!generatedLink && (
          <div className="space-y-4">
            {/* Prospect Selector */}
            <div>
              <label className="mb-2 block text-sm font-medium text-white/60">
                Prospect
              </label>
              <select
                value={selectedProspectId || ''}
                onChange={(e) => setSelectedProspectId(Number(e.target.value))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:border-emerald-500 focus:outline-none"
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
              className="w-full rounded-full bg-emerald-500 px-6 py-3 font-semibold text-black transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
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
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-3">
              <p className="text-sm text-white/40">Prospect</p>
              <p className="font-semibold text-white">
                {prospects.find((p) => p.id === selectedProspectId)?.company} -{' '}
                {prospects.find((p) => p.id === selectedProspectId)?.contact}
              </p>
            </div>

            {/* Generated Link */}
            <div>
              <label className="mb-2 block text-sm font-medium text-white/60">
                Lien de visioconférence
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={generatedLink}
                  readOnly
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/60 focus:outline-none"
                />
                <button
                  onClick={handleCopyLink}
                  className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-white transition-colors hover:bg-white/10"
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
              className="w-full rounded-full bg-emerald-500 px-6 py-3 font-semibold text-black transition-colors hover:bg-emerald-400"
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
