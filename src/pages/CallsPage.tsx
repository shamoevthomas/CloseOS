import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Video,
  Search,
  Eye,
  X,
  Phone,
  Loader2,
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
import { supabase } from '../lib/supabase'

// Suppression des imports de l'ancien Overlay et des modales de fin d'appel (gérées ailleurs)
// On garde juste la logique de liste et de lancement

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
  
  // Modale de préparation Meet
  const [isMeetModalOpen, setIsMeetModalOpen] = useState(false)
  const [meetLinkInput, setMeetLinkInput] = useState('') 

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
      alert('Erreur sauvegarde script')
    } finally {
      setIsSavingScript(false)
    }
  }

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

  // --- ÉTAPE 1 : PRÉPARATION (Ouvre la modale Meet) ---
  const prepareCall = (contactId: number | null, type: 'prospect' | 'internal') => {
    // On stocke la sélection
    if (contactId === null) {
        setSelectedContactId(null)
    } else {
        setSelectedContactId(contactId)
        setCallType(type)
    }
    // On ferme la modale de sélection et on ouvre celle de Meet
    setIsNewCallModalOpen(false)
    setIsMeetModalOpen(true)
    setMeetLinkInput('')
  }

  const openMeetTab = () => {
    window.open('https://meet.google.com/new', '_blank')
  }

  // --- ÉTAPE 2 : DÉMARRAGE COCKPIT (Redirection vers /live-call) ---
  const startCockpit = async () => {
    let contactName = 'Appel Vidéo Rapide'
    let finalContactId = 0
    let type = callType

    // Récupération des infos du contact sélectionné
    if (selectedContactId) {
       if (callType === 'prospect') {
          const p = prospects.find(x => x.id === selectedContactId)
          if (p) {
              contactName = p.contact
              finalContactId = p.id
          }
       } else {
          const c = internalContacts.find(x => x.id === selectedContactId)
          if (c) {
              contactName = c.name
              finalContactId = c.id
          }
       }
    }

    // Création de l'entrée dans l'historique
    const newCall = await addCallLog({
      contactId: finalContactId,
      contactName: contactName,
      contactType: type,
      date: new Date().toISOString(),
      duration: 'En cours...',
      isAi: false,
      answered: true
    })

    // --- CORRECTION MAJEURE ICI ---
    // Gestion robuste de l'ID selon ce que renvoie addCallLog (Objet, Tableau ou null)
    let callDbId = Date.now(); // Fallback
    
    if (newCall) {
        if (typeof newCall.id !== 'undefined') {
            callDbId = newCall.id;
        } else if (Array.isArray(newCall) && newCall.length > 0) {
            callDbId = newCall[0].id;
        } else if (newCall.data && Array.isArray(newCall.data) && newCall.data.length > 0) {
            callDbId = newCall.data[0].id;
        }
    }

    console.log("ID Appel généré:", callDbId); // Debug

    // Fermeture des modales
    setIsMeetModalOpen(false)
    
    // REDIRECTION VERS LA PAGE COCKPIT
    navigate(`/live-call?id=${callDbId}&name=${encodeURIComponent(contactName)}`)
  }

  const handleStartQuickVideoCall = () => {
    setCallType('internal') // ou default
    prepareCall(null, 'internal')
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

            {/* BOUTON VISIO RAPIDE -> Ouvre la modale Meet */}
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

        {/* Call History */}
        <div className="rounded-2xl bg-slate-900 p-6 shadow-xl ring-1 ring-slate-800">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Appels Récents</h2>
            {callHistory.length > 0 && (
              <button
                onClick={() => { if(confirm('Tout supprimer ?')) clearHistory() }}
                className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/20"
              >
                <Trash2 className="h-4 w-4" /> Supprimer historique
              </button>
            )}
          </div>

          <div className="space-y-3">
            {callHistory.map((call) => (
              <div key={call.id} className="group flex items-center justify-between rounded-xl bg-slate-800/50 p-4 hover:bg-slate-800 transition-all">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20">
                    <Video className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-white"><MaskedText value={call.contactName} type="name" /></p>
                    <p className="text-xs text-slate-500">{formatTimeAgo(call.date)} • {call.duration}</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/appels/${call.id}`)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-700"
                >
                  <Eye className="inline h-3.5 w-3.5 mr-1" /> Détails
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* --- MODALE PRÉPARATION (MEET) --- */}
      {isMeetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMeetModalOpen(false)} />
          <div className="relative w-full max-w-lg rounded-xl bg-slate-900 shadow-2xl border border-slate-800 p-6 animate-in fade-in zoom-in-95">
             <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
                <h3 className="text-xl font-bold text-white">🎥 Préparer l'appel</h3>
                <button onClick={() => setIsMeetModalOpen(false)} className="rounded p-2 text-slate-400 hover:text-white">
                    <X className="h-5 w-5"/>
                </button>
             </div>
             
             <div className="space-y-6">
                {/* Etape 1 */}
                <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
                    <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white font-bold text-sm">1</div>
                        <div className="flex-1">
                            <p className="font-semibold text-white">Ouvrir Google Meet</p>
                            <p className="text-sm text-slate-400 mt-1">Ouvrez votre salle de réunion dans un nouvel onglet.</p>
                            <button onClick={openMeetTab} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
                                <ExternalLink className="h-4 w-4" /> Ouvrir Meet
                            </button>
                        </div>
                    </div>
                </div>

                {/* Etape 2 */}
                <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-4">
                    <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-500 text-white font-bold text-sm">2</div>
                        <div className="flex-1">
                            <p className="font-semibold text-white">Lancer le Cockpit</p>
                            <p className="text-sm text-slate-400 mt-1">Accédez à votre script, prenez des notes et enregistrez l'écran.</p>
                            
                            <div className="mt-3 relative">
                                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                                <input 
                                    type="text" 
                                    value={meetLinkInput}
                                    onChange={(e) => setMeetLinkInput(e.target.value)}
                                    placeholder="Lien Meet (optionnel)"
                                    className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2 pl-9 pr-4 text-sm text-white focus:border-purple-500 focus:outline-none"
                                />
                            </div>

                            <button onClick={startCockpit} className="mt-3 w-full flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-3 text-base font-bold text-white hover:bg-purple-500 shadow-lg">
                                <Video className="h-5 w-5" /> 🚀 Lancer le Cockpit
                            </button>
                        </div>
                    </div>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* --- MODAL SCRIPT --- */}
      {isScriptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">Mon Script de Vente</h2>
              <button onClick={() => setIsScriptModalOpen(false)}><X className="h-6 w-6 text-slate-400"/></button>
            </div>
            <textarea
              value={userScript}
              onChange={(e) => setUserScript(e.target.value)}
              className="mb-6 min-h-[400px] w-full rounded-xl border border-slate-800 bg-slate-950 p-4 text-slate-300 focus:border-red-400 focus:outline-none"
              placeholder="Votre script ici..."
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setIsScriptModalOpen(false)} className="px-4 py-2 text-slate-400">Annuler</button>
              <button onClick={handleSaveScript} disabled={isSavingScript} className="rounded-lg bg-red-500 px-6 py-2 text-white font-bold">
                {isSavingScript ? '...' : 'Sauvegarder'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL NOUVEL APPEL (Selection Contact) --- */}
      {isNewCallModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleCloseNewCallModal} />
          <div className="relative w-full max-w-lg rounded-xl bg-slate-900 shadow-2xl border border-slate-800 p-6">
            <h2 className="text-xl font-bold text-white mb-4">Qui appeler ?</h2>
            <div className="flex gap-2 mb-4">
              <button onClick={() => setCallType('prospect')} className={cn("flex-1 py-2 rounded", callType === 'prospect' ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400")}>Prospect</button>
              <button onClick={() => setCallType('internal')} className={cn("flex-1 py-2 rounded", callType === 'internal' ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400")}>Interne</button>
            </div>
            <input type="text" placeholder="Rechercher..." value={selectedContactSearch} onChange={e => setSelectedContactSearch(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white mb-4"/>
            <div className="max-h-48 overflow-y-auto space-y-1 mb-4">
              {getContactList().map(c => (
                <button key={(c as any).id} onClick={() => setSelectedContactId((c as any).id)} className={cn("w-full text-left p-2 rounded hover:bg-slate-800 text-slate-300", selectedContactId === (c as any).id ? "bg-blue-900/50 text-blue-200" : "")}>
                  {(c as any).contact || (c as any).name}
                </button>
              ))}
            </div>
            <button onClick={() => prepareCall(selectedContactId, callType)} disabled={!selectedContactId} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg disabled:opacity-50">
              Préparer l'appel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}