import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Video,
  Search,
  MoreVertical,
  Eye,
  X,
  Sparkles,
  Phone,
  Loader2,
  Copy,
  Check,
  Trash2
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useProspects, type Prospect } from '../contexts/ProspectsContext'
import { useInternalContacts, type InternalContact } from '../contexts/InternalContactsContext'
import { useCalls } from '../contexts/CallsContext'
import { createDailyRoom } from '../services/dailyService'
import { MaskedText } from '../components/MaskedText'
import { VideoCallOverlay } from '../components/VideoCallOverlay'
import { CallSummaryModal, type CallSummaryData } from '../components/CallSummaryModal'
import { NoAnswerModal } from '../components/NoAnswerModal'
import { ProspectView } from '../components/ProspectView'
import { InternalContactModal } from '../components/InternalContactModal'

export function CallsPage() {
  const navigate = useNavigate()
  const { prospects, updateProspect } = useProspects()
  const { contacts: internalContacts } = useInternalContacts()
  const { callHistory, addCallLog, clearHistory } = useCalls()

  const [searchQuery, setSearchQuery] = useState('')
  const [isNewCallModalOpen, setIsNewCallModalOpen] = useState(false)
  const [callType, setCallType] = useState<'prospect' | 'internal'>('prospect')
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null)
  const [selectedContactSearch, setSelectedContactSearch] = useState('')
  const [isCreatingVideoCall, setIsCreatingVideoCall] = useState(false)

  // Link generation modal (Quick Call)
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false)
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [isCopied, setIsCopied] = useState(false)

  // New Call Modal - Link generation
  const [newCallGeneratedLink, setNewCallGeneratedLink] = useState<string | null>(null)
  const [isGeneratingNewCallLink, setIsGeneratingNewCallLink] = useState(false)
  const [newCallLinkCopied, setNewCallLinkCopied] = useState(false)

  // Call overlay states
  const [isCallActive, setIsCallActive] = useState(false)
  const [currentCall, setCurrentCall] = useState<{
    name: string
    avatar: string
    type: 'prospect' | 'internal'
    contactId: number
    startTime: Date
  } | null>(null)

  // Post-call modals
  const [isNoAnswerModalOpen, setIsNoAnswerModalOpen] = useState(false)
  const [isCallSummaryModalOpen, setIsCallSummaryModalOpen] = useState(false)
  const [showAiAnalysisToast, setShowAiAnalysisToast] = useState(false)

  // Detail views
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null)
  const [selectedInternalContact, setSelectedInternalContact] = useState<InternalContact | null>(null)

  // Calculate stats from real call history
  const stats = [
    {
      label: 'Appels ce mois',
      value: callHistory.length.toString(),
      icon: Phone,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/20'
    },
  ]

  // Get contacts for selector
  const getContactList = () => {
    if (callType === 'prospect') {
      return prospects.filter(p =>
        p.contact.toLowerCase().includes(selectedContactSearch.toLowerCase())
      )
    } else {
      return internalContacts.filter(c =>
        c.name.toLowerCase().includes(selectedContactSearch.toLowerCase())
      )
    }
  }

  // Reset New Call Modal state
  const handleCloseNewCallModal = () => {
    setIsNewCallModalOpen(false)
    setNewCallGeneratedLink(null)
    setNewCallLinkCopied(false)
    setSelectedContactId(null)
    setSelectedContactSearch('')
  }

  const calculateDuration = (startTime: Date): string => {
    const endTime = new Date()
    const diff = Math.floor((endTime.getTime() - startTime.getTime()) / 1000)
    const minutes = Math.floor(diff / 60)
    const seconds = diff % 60
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  const handleCallEnd = (wasAiActive: boolean, wasAnswered: boolean) => {
    if (!currentCall) return

    const duration = calculateDuration(currentCall.startTime)

    // Log the call to global history
    addCallLog({
      contactId: currentCall.contactId,
      contactName: currentCall.name,
      contactType: currentCall.type,
      date: new Date().toISOString(),
      duration,
      isAi: wasAiActive,
      answered: wasAnswered
    })

    // Handle post-call flow based on type and AI mode
    if (currentCall.type === 'prospect') {
      if (!wasAnswered) {
        // No answer - show no answer modal
        setIsNoAnswerModalOpen(true)
      } else if (wasAiActive) {
        // AI call - show AI analysis toast
        setShowAiAnalysisToast(true)
        setTimeout(() => {
          setShowAiAnalysisToast(false)
          setCurrentCall(null)
        }, 3000)
      } else {
        // Manual call - show summary modal
        setIsCallSummaryModalOpen(true)
      }
    } else {
      // Internal call - just close
      setCurrentCall(null)
    }
  }

  const handleCallSummarySubmit = (data: CallSummaryData) => {
    console.log('Call Summary:', data)
    // TODO: Save to prospect timeline
    setIsCallSummaryModalOpen(false)
    setCurrentCall(null)
  }

  const handleNoAnswerAction = () => {
    console.log('No answer recorded')
    setIsNoAnswerModalOpen(false)
    setCurrentCall(null)
  }

  const handleContactClick = (call: typeof callHistory[0]) => {
    if (call.contactType === 'prospect') {
      const prospect = prospects.find(p => p.id === call.contactId)
      if (prospect) {
        setSelectedProspect(prospect)
      }
    } else {
      const contact = internalContacts.find(c => c.id === call.contactId)
      if (contact) {
        setSelectedInternalContact(contact)
      }
    }
  }

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      prospect: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      qualified: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
      proposal: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      won: 'bg-emerald-600/10 text-emerald-500 border-emerald-600/30',
      lost: 'bg-red-500/10 text-red-400 border-red-500/30',
    }
    return colors[stage] || 'bg-slate-500/10 text-slate-400'
  }

  const getStageLabel = (stage: string) => {
    const labels: Record<string, string> = {
      prospect: 'Prospect',
      qualified: 'Qualifié',
      proposal: 'Proposition',
      won: 'Gagné',
      lost: 'Perdu',
    }
    return labels[stage] || stage
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 60) return `il y a ${diffMins} min`
    if (diffHours < 24) return `il y a ${diffHours}h`
    if (diffDays === 1) return 'Hier'
    if (diffDays < 7) return `il y a ${diffDays}j`
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  // Handle Quick Video Call Creation (Step 1: Generate Link)
  const handleStartQuickVideoCall = async () => {
    setIsCreatingVideoCall(true)
    try {
      console.log('Creating Daily.co room for quick video call...')
      const roomUrl = await createDailyRoom()

      // Save the generated link
      setGeneratedLink(roomUrl)
      setIsLinkModalOpen(true)

      console.log('Link generated:', roomUrl)
    } catch (error) {
      console.error('Error creating video call:', error)
      alert('Erreur lors de la création de l\'appel vidéo')
    } finally {
      setIsCreatingVideoCall(false)
    }
  }

  // Handle Join Call (Step 2: Join the Room)
  const handleJoinGeneratedCall = () => {
    if (!generatedLink) return

    // Log the video call to history and get the ID
    const callId = addCallLog({
      contactId: 0, // Quick call with no specific contact
      contactName: 'Appel Vidéo Rapide',
      contactType: 'internal',
      date: new Date().toISOString(),
      duration: 'En cours...',
      isAi: false,
      answered: true,
    })

    console.log('Navigating to video call:', generatedLink, 'with call ID:', callId)
    // Navigate to the call room with call ID
    navigate(`/live-call?url=${encodeURIComponent(generatedLink)}&id=${callId}`)
  }

  // Copy link to clipboard (Quick Call)
  const handleCopyLink = () => {
    if (!generatedLink) return

    navigator.clipboard.writeText(generatedLink)
      .then(() => {
        console.log('Link copied to clipboard')
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2000)
      })
      .catch((error) => {
        console.error('Error copying link:', error)
        alert('Erreur lors de la copie du lien')
      })
  }

  // New Call Modal - Generate Video Link (Step 1)
  const handleGenerateNewCallLink = async () => {
    if (!selectedContactId) return

    setIsGeneratingNewCallLink(true)
    try {
      console.log('Creating Daily.co room for new call...')
      const roomUrl = await createDailyRoom()
      setNewCallGeneratedLink(roomUrl)
      console.log('Link generated for new call:', roomUrl)
    } catch (error) {
      console.error('Error creating video call:', error)
      alert('Erreur lors de la création de l\'appel vidéo')
    } finally {
      setIsGeneratingNewCallLink(false)
    }
  }

  // New Call Modal - Join Call (Step 2)
  const handleJoinNewCall = () => {
    if (!newCallGeneratedLink || !selectedContactId) return

    let contactName = ''
    if (callType === 'prospect') {
      const prospect = prospects.find(p => p.id === selectedContactId)
      contactName = prospect?.contact || 'Prospect'
    } else {
      const contact = internalContacts.find(c => c.id === selectedContactId)
      contactName = contact?.name || 'Contact'
    }

    // Log the video call to history and get the ID
    const callId = addCallLog({
      contactId: selectedContactId,
      contactName,
      contactType: callType,
      date: new Date().toISOString(),
      duration: 'En cours...',
      isAi: false,
      answered: true,
    })

    console.log('Navigating to video call:', newCallGeneratedLink, 'with call ID:', callId)
    // Navigate to the call room with call ID
    navigate(`/live-call?url=${encodeURIComponent(newCallGeneratedLink)}&id=${callId}`)
  }

  // New Call Modal - Copy link to clipboard
  const handleCopyNewCallLink = () => {
    if (!newCallGeneratedLink) return

    navigator.clipboard.writeText(newCallGeneratedLink)
      .then(() => {
        console.log('New call link copied to clipboard')
        setNewCallLinkCopied(true)
        setTimeout(() => setNewCallLinkCopied(false), 2000)
      })
      .catch((error) => {
        console.error('Error copying link:', error)
        alert('Erreur lors de la copie du lien')
      })
  }

  return (
    <div className="p-8">
      <div className="mx-auto max-w-7xl space-y-8">

        {/* Header Section */}
        <div className="flex items-center justify-between">
          {/* Search Bar */}
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un appel..."
              className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            {/* Quick Video Call Button */}
            <button
              onClick={handleStartQuickVideoCall}
              disabled={isCreatingVideoCall}
              className="flex items-center gap-2 rounded-lg bg-purple-500 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-purple-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCreatingVideoCall ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <Video className="h-4 w-4" />
                  🎥 Lancer Visio Rapide
                </>
              )}
            </button>

            {/* New Phone Call Button */}
            <button
              onClick={() => setIsNewCallModalOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-emerald-600"
            >
              <Phone className="h-4 w-4" />
              Nouvel Appel
            </button>
          </div>
        </div>

        {/* Stats Row - 4 COLUMNS SIDE BY SIDE */}
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl bg-slate-900 p-6 shadow-xl ring-1 ring-slate-800 transition-all hover:ring-blue-500/50"
            >
              <div className="flex items-start justify-between">
                <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl', stat.bgColor)}>
                  <stat.icon className={cn('h-6 w-6', stat.color)} />
                </div>
              </div>
              <div className="mt-6">
                <p className="text-sm font-medium text-slate-400">{stat.label}</p>
                <p className="mt-2 text-3xl font-bold text-white">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Call History Section */}
        <div className="rounded-2xl bg-slate-900 p-6 shadow-xl ring-1 ring-slate-800">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Appels Récents</h2>
            {callHistory.length > 0 && (
              <button
                onClick={() => {
                  if (confirm('Êtes-vous sûr de vouloir supprimer tout l\'historique des appels ?')) {
                    clearHistory()
                  }
                }}
                className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-sm text-red-400 transition-colors hover:bg-red-500/20"
              >
                <Trash2 className="h-4 w-4" />
                Supprimer historique
              </button>
            )}
          </div>

          <div className="space-y-3">
            {callHistory.length > 0 ? (
              callHistory.map((call) => {
                // LIVE STATUS LOOKUP: Find the linked prospect
                const linkedProspect = call.contactType === 'prospect'
                  ? prospects.find(p => p.id === call.contactId)
                  : null

                return (
                  <div
                    key={call.id}
                    className="group flex items-center justify-between rounded-xl bg-slate-800/50 p-4 transition-all hover:bg-slate-800"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      {/* Video Icon */}
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20">
                        <Video className="h-5 w-5 text-blue-400" />
                      </div>

                      {/* Contact Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleContactClick(call)}
                            className="font-semibold text-white hover:text-blue-400 transition-colors"
                          >
                            <MaskedText value={call.contactName} type="name" />
                          </button>
                          {/* SMART BADGE: Show LIVE prospect status */}
                          {linkedProspect && (
                            <span className={cn(
                              'rounded-full border px-2 py-0.5 text-xs font-medium',
                              getStageColor(linkedProspect.stage)
                            )}>
                              {getStageLabel(linkedProspect.stage)}
                            </span>
                          )}
                          {call.isAi && (
                            <span className="rounded-full bg-purple-500/10 border border-purple-500/30 px-2 py-0.5 text-xs font-medium text-purple-400">
                              <Sparkles className="inline h-3 w-3 mr-0.5" />
                              IA
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-4 text-xs text-slate-500">
                          <span>{formatTimeAgo(call.date)}</span>
                          {!call.answered && (
                            <span className="text-red-400">Pas de réponse</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => navigate(`/appels/${call.id}`)}
                        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-300 transition-all hover:bg-slate-700"
                      >
                        <Eye className="inline h-3.5 w-3.5 mr-1" />
                        Détails
                      </button>
                      <button className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="py-12 text-center">
                <Video className="mx-auto h-12 w-12 text-slate-700" />
                <p className="mt-4 text-sm font-medium text-slate-400">Aucun appel enregistré</p>
                <p className="mt-1 text-xs text-slate-500">Vos appels apparaîtront ici</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* New Call Modal */}
      {isNewCallModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleCloseNewCallModal}
          />

          {/* Modal */}
          <div className="relative w-full max-w-md rounded-xl bg-slate-900 shadow-2xl ring-1 ring-slate-800">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-800 p-6">
              <div>
                <h2 className="text-xl font-bold text-white">Nouvel Appel</h2>
                <p className="mt-1 text-sm text-slate-400">Sélectionnez un contact à appeler</p>
              </div>
              <button
                onClick={handleCloseNewCallModal}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Toggle: Prospect <-> Internal */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setCallType('prospect')
                    setSelectedContactId(null)
                    setSelectedContactSearch('')
                  }}
                  className={cn(
                    'flex-1 rounded-lg px-4 py-3 text-sm font-semibold transition-all',
                    callType === 'prospect'
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  )}
                >
                  Prospect
                </button>
                <button
                  onClick={() => {
                    setCallType('internal')
                    setSelectedContactId(null)
                    setSelectedContactSearch('')
                  }}
                  className={cn(
                    'flex-1 rounded-lg px-4 py-3 text-sm font-semibold transition-all',
                    callType === 'internal'
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  )}
                >
                  Interne
                </button>
              </div>

              {/* Searchable Contact Selector */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  {callType === 'prospect' ? 'Sélectionner un prospect' : 'Sélectionner un contact'}
                </label>
                <input
                  type="text"
                  value={selectedContactSearch}
                  onChange={(e) => setSelectedContactSearch(e.target.value)}
                  placeholder="Rechercher..."
                  className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800 p-2">
                  {getContactList().length > 0 ? (
                    getContactList().map((contact) => {
                      const id = callType === 'prospect' ? (contact as Prospect).id : (contact as InternalContact).id
                      const name = callType === 'prospect' ? (contact as Prospect).contact : (contact as InternalContact).name

                      return (
                        <button
                          key={id}
                          onClick={() => setSelectedContactId(id)}
                          className={cn(
                            'w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-all',
                            selectedContactId === id
                              ? 'bg-blue-500 text-white'
                              : 'text-slate-300 hover:bg-slate-700'
                          )}
                        >
                          {name}
                        </button>
                      )
                    })
                  ) : (
                    <p className="py-4 text-center text-sm text-slate-500">Aucun contact trouvé</p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="border-t border-slate-800 p-6">
              {!newCallGeneratedLink ? (
                /* Step 1: Generate Link */
                <div className="space-y-3">
                  <button
                    onClick={handleGenerateNewCallLink}
                    disabled={!selectedContactId || isGeneratingNewCallLink}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-purple-500 px-6 py-3 text-base font-semibold text-white transition-all hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGeneratingNewCallLink ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Génération...
                      </>
                    ) : (
                      <>
                        <Video className="h-5 w-5" />
                        🎥 Générer Lien Visio
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleCloseNewCallModal}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-all hover:bg-slate-700"
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                /* Step 2: Show Link and Join Button */
                <div className="space-y-4">
                  {/* Link Display */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Lien à envoyer :
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newCallGeneratedLink}
                        readOnly
                        className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white focus:outline-none"
                      />
                      <button
                        onClick={handleCopyNewCallLink}
                        className={cn(
                          'flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all',
                          newCallLinkCopied
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        )}
                      >
                        {newCallLinkCopied ? (
                          <>
                            <Check className="h-4 w-4" />
                            Copié
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" />
                            Copier
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Join Button */}
                  <button
                    onClick={handleJoinNewCall}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-purple-500 px-6 py-3 text-base font-semibold text-white transition-all hover:bg-purple-600"
                  >
                    <Phone className="h-5 w-5" />
                    📞 Rejoindre l'appel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Video Call Overlay */}
      {isCallActive && currentCall && (
        <VideoCallOverlay
          isOpen={isCallActive}
          onClose={() => setIsCallActive(false)}
          onCallEnd={handleCallEnd}
          prospectName={currentCall.name}
          prospectAvatar={currentCall.avatar}
          initialAiEnabled={false}
        />
      )}

      {/* No Answer Modal (Prospect calls only) */}
      <NoAnswerModal
        isOpen={isNoAnswerModalOpen}
        onClose={() => setIsNoAnswerModalOpen(false)}
        onMarkAsNoShow={handleNoAnswerAction}
        prospectName={currentCall?.name || ''}
      />

      {/* Call Summary Modal (Manual prospect calls only) */}
      <CallSummaryModal
        isOpen={isCallSummaryModalOpen}
        onClose={() => setIsCallSummaryModalOpen(false)}
        onSubmit={handleCallSummarySubmit}
        prospectName={currentCall?.name || ''}
        offerPrice={1500}
      />

      {/* AI Analysis Toast (AI calls only) */}
      {showAiAnalysisToast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[70]">
          <div className="flex items-center gap-3 px-6 py-4 bg-purple-500/20 border border-purple-500/30 rounded-xl shadow-2xl backdrop-blur-sm animate-in slide-in-from-top-5 duration-300">
            <Sparkles className="h-5 w-5 text-purple-400 animate-pulse" />
            <div>
              <p className="text-sm font-semibold text-white">🤖 Analyse IA en cours...</p>
              <p className="text-xs text-purple-300 mt-0.5">Les données seront sauvegardées automatiquement</p>
            </div>
          </div>
        </div>
      )}

      {/* Prospect Detail View */}
      {selectedProspect && (
        <ProspectView
          prospect={selectedProspect}
          onClose={() => setSelectedProspect(null)}
          onUpdateProspect={(updates) => {
            updateProspect(selectedProspect.id, updates)
            setSelectedProspect({ ...selectedProspect, ...updates })
          }}
        />
      )}

      {/* Internal Contact Detail View */}
      {selectedInternalContact && (
        <InternalContactModal
          contact={selectedInternalContact}
          onClose={() => setSelectedInternalContact(null)}
        />
      )}

      {/* Link Generation Modal */}
      {isLinkModalOpen && generatedLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setIsLinkModalOpen(false)
              setGeneratedLink(null)
              setIsCopied(false)
            }}
          />

          {/* Modal */}
          <div className="relative w-full max-lg rounded-xl bg-slate-900 p-6 shadow-2xl ring-1 ring-slate-800">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-white">🎥 Votre lien de réunion est prêt</h3>
                <p className="mt-1 text-sm text-slate-400">Partagez ce lien avec vos participants</p>
              </div>
              <button
                onClick={() => {
                  setIsLinkModalOpen(false)
                  setGeneratedLink(null)
                  setIsCopied(false)
                }}
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Link Display */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Lien à envoyer :
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={generatedLink}
                    readOnly
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white focus:outline-none"
                  />
                  <button
                    onClick={handleCopyLink}
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all',
                      isCopied
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    )}
                  >
                    {isCopied ? (
                      <>
                        <Check className="h-4 w-4" />
                        Copié
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copier
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Join Button - MODIFIED: Now joins the Visio instead of Cockpit */}
              <button
                onClick={() => window.open(generatedLink, '_blank')}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-purple-500 px-6 py-3 text-base font-semibold text-white transition-all hover:bg-purple-600"
              >
                <Video className="h-5 w-5" />
                🚀 Rejoindre la Visio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}