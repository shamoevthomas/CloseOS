import { useState, useEffect } from 'react'
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
  Trash2,
  FileText,
  Save,
  ExternalLink,
  Link as LinkIcon
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useProspects, type Prospect } from '../contexts/ProspectsContext'
import { useInternalContacts, type InternalContact } from '../contexts/InternalContactsContext'
import { useCalls } from '../contexts/CallsContext'
import { MaskedText } from '../components/MaskedText'
import { VideoCallOverlay } from '../components/VideoCallOverlay'
import { CallSummaryModal, type CallSummaryData } from '../components/CallSummaryModal'
import { NoAnswerModal } from '../components/NoAnswerModal'
import { ProspectView } from '../components/ProspectView'
import { InternalContactModal } from '../components/InternalContactModal'
import { supabase } from '../lib/supabase'

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
  
  // Call overlay states
  const [isCallActive, setIsCallActive] = useState(false)
  const [currentCall, setCurrentCall] = useState<{
    name: string
    avatar: string
    type: 'prospect' | 'internal'
    contactId: number
    startTime: Date
  } | null>(null)

  // Modale de préparation
  const [isMeetModalOpen, setIsMeetModalOpen] = useState(false)
  const [meetLinkInput, setMeetLinkInput] = useState('') 

  // Post-call modals
  const [isNoAnswerModalOpen, setIsNoAnswerModalOpen] = useState(false)
  const [isCallSummaryModalOpen, setIsCallSummaryModalOpen] = useState(false)
  const [showAiAnalysisToast, setShowAiAnalysisToast] = useState(false)

  // Detail views
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null)
  const [selectedInternalContact, setSelectedInternalContact] = useState<InternalContact | null>(null)

  // Script Perso
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false)
  const [userScript, setUserScript] = useState('')
  const [isSavingScript, setIsSavingScript] = useState(false)

  useEffect(() => {
    fetchUserScript()
  }, [])

  const fetchUserScript = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('user_scripts')
        .select('content')
        .eq('user_id', user.id)
        .single()
      if (data) setUserScript(data.content)
    } catch (error) {
      console.error('Erreur chargement script:', error)
    }
  }

  const handleSaveScript = async () => {
    setIsSavingScript(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error } = await supabase
        .from('user_scripts')
        .upsert({ 
          user_id: user.id, 
          content: userScript,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })

      if (error) throw error
      setIsScriptModalOpen(false)
    } catch (error) {
      console.error('Erreur sauvegarde script:', error)
      alert('Erreur lors de la sauvegarde du script')
    } finally {
      setIsSavingScript(false)
    }
  }

  const stats = [
    {
      label: 'Appels ce mois',
      value: callHistory.length.toString(),
      icon: Phone,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/20'
    },
  ]

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

  const handleCloseNewCallModal = () => {
    setIsNewCallModalOpen(false)
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

  // --- LOGIQUE D'APPEL ---

  const prepareCall = (contactId: number | null, type: 'prospect' | 'internal') => {
    if (contactId === null) {
        setSelectedContactId(null) // Appel rapide
    } else {
        setSelectedContactId(contactId) // Contact spécifique
        setIsNewCallModalOpen(false) 
    }
    setIsMeetModalOpen(true)
    setMeetLinkInput('')
  }

  const openMeetTab = () => {
    window.open('https://meet.google.com/new', '_blank')
  }

  const startCockpit = () => {
    let contactName = 'Appel Vidéo Rapide'
    let contactAvatar = 'A'
    let type: 'prospect' | 'internal' = 'internal'
    let cId = 0

    if (selectedContactId) {
       if (callType === 'prospect') {
          const p = prospects.find(x => x.id === selectedContactId)
          if (p) {
              contactName = p.contact
              contactAvatar = p.contact.charAt(0)
              type = 'prospect'
              cId = p.id
          }
       } else {
          const c = internalContacts.find(x => x.id === selectedContactId)
          if (c) {
              contactName = c.name
              contactAvatar = c.name.charAt(0)
              type = 'internal'
              cId = c.id
          }
       }
    }

    setCurrentCall({
      name: contactName,
      avatar: contactAvatar,
      type: type,
      contactId: cId,
      startTime: new Date()
    })
    
    setIsMeetModalOpen(false)
    setIsCallActive(true)
  }

  const handleStartQuickVideoCall = () => {
    setCallType('internal')
    prepareCall(null, 'internal')
  }

  const handleProceedToMeet = () => {
    if (!selectedContactId) return
    prepareCall(selectedContactId, callType)
  }

  // --- FIN APPEL & LOGS ---

  const handleCallEnd = (wasAiActive: boolean, wasAnswered: boolean) => {
    if (!currentCall) return

    const duration = calculateDuration(currentCall.startTime)

    addCallLog({
      contactId: currentCall.contactId,
      contactName: currentCall.name,
      contactType: currentCall.type,
      date: new Date().toISOString(),
      duration,
      isAi: wasAiActive,
      answered: wasAnswered
    })

    setIsCallActive(false)

    if (currentCall.type === 'prospect') {
      if (!wasAnswered) {
        setIsNoAnswerModalOpen(true)
      } else if (wasAiActive) {
        setShowAiAnalysisToast(true)
        setTimeout(() => {
          setShowAiAnalysisToast(false)
          setCurrentCall(null)
        }, 3000)
      } else {
        setIsCallSummaryModalOpen(true)
      }
    } else {
      setCurrentCall(null)
    }
  }

  const handleCallSummarySubmit = (data: CallSummaryData) => {
    console.log('Call Summary:', data)
    setIsCallSummaryModalOpen(false)
    setCurrentCall(null)
  }

  const handleNoAnswerAction = () => {
    setIsNoAnswerModalOpen(false)
    setCurrentCall(null)
  }

  const handleContactClick = (call: typeof callHistory[0]) => {
    if (call.contactType === 'prospect') {
      const prospect = prospects.find(p => p.id === call.contactId)
      if (prospect) setSelectedProspect(prospect)
    } else {
      const contact = internalContacts.find(c => c.id === call.contactId)
      if (contact) setSelectedInternalContact(contact)
    }
  }

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      prospect: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      qualified: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
      won: 'bg-emerald-600/10 text-emerald-500 border-emerald-600/30',
      lost: 'bg-red-500/10 text-red-400 border-red-500/30',
    }
    return colors[stage] || 'bg-slate-500/10 text-slate-400'
  }

  const getStageLabel = (stage: string) => {
    const labels: Record<string, string> = {
      prospect: 'Prospect',
      qualified: 'Qualifié',
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

  return (
    <div className="p-8">
      <div className="mx-auto max-w-7xl space-y-8">

        {/* Header Section */}
        <div className="flex items-center justify-between">
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

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsScriptModalOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-red-400/10 px-5 py-2.5 text-sm font-semibold text-red-400 transition-all hover:bg-red-400/20"
            >
              <FileText className="h-4 w-4" />
              Script
            </button>

            {/* BOUTON VISIO RAPIDE -> Déclenche prepareCall */}
            <button
              onClick={handleStartQuickVideoCall}
              className="flex items-center gap-2 rounded-lg bg-purple-500 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-purple-600 shadow-lg shadow-purple-500/20"
            >
              <Video className="h-4 w-4" />
              🚀 Visio Rapide
            </button>

            <button
              onClick={() => setIsNewCallModalOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-emerald-600"
            >
              <Phone className="h-4 w-4" />
              Nouvel Appel
            </button>
          </div>
        </div>

        {/* Stats Row */}
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

        {/* Call History */}
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
                const linkedProspect = call.contactType === 'prospect'
                  ? prospects.find(p => p.id === call.contactId)
                  : null

                return (
                  <div
                    key={call.id}
                    className="group flex items-center justify-between rounded-xl bg-slate-800/50 p-4 transition-all hover:bg-slate-800"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20">
                        <Video className="h-5 w-5 text-blue-400" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleContactClick(call)}
                            className="font-semibold text-white hover:text-blue-400 transition-colors"
                          >
                            <MaskedText value={call.contactName} type="name" />
                          </button>
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

                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => navigate(`/appels/${call.id}`)}
                        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-300 transition-all hover:bg-slate-700"
                      >
                        <Eye className="inline h-3.5 w-3.5 mr-1" />
                        Détails
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

      {/* --- MODALE PRÉPARATION APPEL (SALLE D'ATTENTE) --- */}
      {isMeetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMeetModalOpen(false)} />
          <div className="relative w-full max-w-lg rounded-xl bg-slate-900 shadow-2xl ring-1 ring-slate-800 animate-in fade-in zoom-in-95">
             <div className="flex items-center justify-between border-b border-slate-800 p-6">
                <h3 className="text-xl font-bold text-white">🎥 Préparer l'appel</h3>
                <button onClick={() => setIsMeetModalOpen(false)} className="rounded p-2 text-slate-400 hover:text-white">
                    <X className="h-5 w-5"/>
                </button>
             </div>
             
             <div className="p-6 space-y-6">
                {/* Etape 1 : Générer */}
                <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
                    <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white font-bold text-sm">1</div>
                        <div className="flex-1">
                            <p className="font-semibold text-white">Ouvrir la salle Google Meet</p>
                            <p className="text-sm text-slate-400 mt-1">Cela ouvrira un nouvel onglet. Vous pourrez copier le lien de la réunion.</p>
                            <button 
                                onClick={openMeetTab}
                                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
                            >
                                <ExternalLink className="h-4 w-4" /> Ouvrir Google Meet
                            </button>
                        </div>
                    </div>
                </div>

                {/* Etape 2 : Lancer le cockpit */}
                <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-4">
                    <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-500 text-white font-bold text-sm">2</div>
                        <div className="flex-1">
                            <p className="font-semibold text-white">Lancer le Cockpit de Vente</p>
                            <p className="text-sm text-slate-400 mt-1">Démarrez l'interface CloseOS pour suivre votre script et prendre des notes.</p>
                            
                            {/* Champ pour coller le lien (pour archive future) */}
                            <div className="mt-3 relative">
                                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                                <input 
                                    type="text" 
                                    value={meetLinkInput}
                                    onChange={(e) => setMeetLinkInput(e.target.value)}
                                    placeholder="Collez le lien Meet ici (optionnel)"
                                    className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2 pl-9 pr-4 text-sm text-white focus:border-purple-500 focus:outline-none placeholder-slate-600"
                                />
                            </div>

                            <button 
                                onClick={startCockpit}
                                className="mt-3 w-full flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-3 text-base font-bold text-white hover:bg-purple-500 shadow-lg shadow-purple-500/20"
                            >
                                <Video className="h-5 w-5" /> 🚀 Démarrer le Cockpit
                            </button>
                        </div>
                    </div>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* MODAL SCRIPT */}
      {isScriptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-red-400/10 p-2 text-red-400">
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Mon Script de Vente</h2>
                  <p className="text-sm text-slate-400">Personnalisez votre trame d'appel</p>
                </div>
              </div>
              <button onClick={() => setIsScriptModalOpen(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white">
                <X className="h-6 w-6" />
              </button>
            </div>
            <textarea
              value={userScript}
              onChange={(e) => setUserScript(e.target.value)}
              placeholder="Écrivez votre script ici..."
              className="mb-6 min-h-[400px] w-full rounded-xl border border-slate-800 bg-slate-950 p-4 text-slate-300 focus:border-red-400 focus:outline-none"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setIsScriptModalOpen(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-400 hover:bg-slate-800">
                Annuler
              </button>
              <button onClick={handleSaveScript} disabled={isSavingScript} className="flex items-center gap-2 rounded-lg bg-red-500 px-6 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50">
                {isSavingScript ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Call Modal - Selection Contact */}
      {isNewCallModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleCloseNewCallModal} />
          <div className="relative w-full max-w-lg rounded-xl bg-slate-900 shadow-2xl ring-1 ring-slate-800">
            <div className="flex items-start justify-between border-b border-slate-800 p-6">
              <div>
                <h2 className="text-xl font-bold text-white">Nouvel Appel</h2>
                <p className="mt-1 text-sm text-slate-400">Sélectionnez un contact à appeler</p>
              </div>
              <button onClick={handleCloseNewCallModal} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setCallType('prospect'); setSelectedContactId(null); setSelectedContactSearch('') }}
                  className={cn('flex-1 rounded-lg px-4 py-3 text-sm font-semibold transition-all', callType === 'prospect' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700')}
                >
                  Prospect
                </button>
                <button
                  onClick={() => { setCallType('internal'); setSelectedContactId(null); setSelectedContactSearch('') }}
                  className={cn('flex-1 rounded-lg px-4 py-3 text-sm font-semibold transition-all', callType === 'internal' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700')}
                >
                  Interne
                </button>
              </div>

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
                          className={cn('w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-all', selectedContactId === id ? 'bg-blue-500 text-white' : 'text-slate-300 hover:bg-slate-700')}
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

            <div className="border-t border-slate-800 p-6">
              {/* BOUTON PREPARER L'APPEL -> Ouvre la modale de préparation */}
              <button
                onClick={handleProceedToMeet}
                disabled={!selectedContactId}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-purple-500 px-6 py-3 text-base font-semibold text-white transition-all hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Video className="h-5 w-5" />
                Préparer l'appel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COCKPIT OVERLAY */}
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

      {/* Post-Call Modals */}
      <NoAnswerModal
        isOpen={isNoAnswerModalOpen}
        onClose={() => setIsNoAnswerModalOpen(false)}
        onMarkAsNoShow={handleNoAnswerAction}
        prospectName={currentCall?.name || ''}
      />

      <CallSummaryModal
        isOpen={isCallSummaryModalOpen}
        onClose={() => setIsCallSummaryModalOpen(false)}
        onSubmit={handleCallSummarySubmit}
        prospectName={currentCall?.name || ''}
        offerPrice={1500}
      />

      {showAiAnalysisToast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[70]">
          <div className="flex items-center gap-3 px-6 py-4 bg-purple-500/20 border border-purple-500/30 rounded-xl shadow-2xl backdrop-blur-sm animate-in slide-in-from-top-5 duration-300">
            <Sparkles className="h-5 w-5 text-purple-400 animate-pulse" />
            <div>
              <p className="text-sm font-semibold text-white">🤖 Analyse IA en cours...</p>
              <p className="text-xs text-purple-300 mt-0.5">Sauvegarde auto.</p>
            </div>
          </div>
        </div>
      )}

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

      {selectedInternalContact && (
        <InternalContactModal
          contact={selectedInternalContact}
          onClose={() => setSelectedInternalContact(null)}
        />
      )}
    </div>
  )
}