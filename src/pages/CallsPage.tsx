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
  Link as LinkIcon,
  Plus,
  ChevronDown
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useProspects, type Prospect } from '../contexts/ProspectsContext'
import { useInternalContacts, type InternalContact } from '../contexts/InternalContactsContext'
import { useCalls } from '../contexts/CallsContext'
import { MaskedText } from '../components/MaskedText'
import { supabase } from '../lib/supabase'

// Type pour les scripts
interface Script {
  id: number
  title: string
  content: string
}

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

  // --- GESTION DES SCRIPTS MULTIPLES ---
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false)
  const [scripts, setScripts] = useState<Script[]>([])
  const [selectedScriptId, setSelectedScriptId] = useState<number | 'new'>('new')
  const [scriptContent, setScriptContent] = useState('')
  const [scriptTitle, setScriptTitle] = useState('') // Pour le nouveau script
  const [isSavingScript, setIsSavingScript] = useState(false)

  useEffect(() => {
    if (isScriptModalOpen) {
      fetchUserScripts()
    }
  }, [isScriptModalOpen])

  // Charger la liste des scripts
  const fetchUserScripts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('user_scripts')
        .select('*')
        .eq('user_id', user.id)
        .order('id', { ascending: true })

      if (error) throw error

      if (data && data.length > 0) {
        setScripts(data)
        // Sélectionner le premier script par défaut
        setSelectedScriptId(data[0].id)
        setScriptContent(data[0].content)
        setScriptTitle(data[0].title || 'Mon Script')
      } else {
        // Aucun script, mode création par défaut
        setScripts([])
        setSelectedScriptId('new')
        setScriptContent('')
        setScriptTitle('Mon Script de Vente')
      }
    } catch (error) {
      console.error('Erreur chargement scripts:', error)
    }
  }

  // Changer de script via le menu déroulant
  const handleScriptChange = (id: string) => {
    if (id === 'new') {
      setSelectedScriptId('new')
      setScriptContent('')
      setScriptTitle('')
    } else {
      const script = scripts.find(s => s.id === Number(id))
      if (script) {
        setSelectedScriptId(script.id)
        setScriptContent(script.content)
        setScriptTitle(script.title)
      }
    }
  }

  // Sauvegarder (Créer ou Mettre à jour)
  const handleSaveScript = async () => {
    if (!scriptTitle.trim()) {
        alert("Veuillez donner un titre à votre script")
        return
    }

    setIsSavingScript(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const scriptData = {
        user_id: user.id,
        title: scriptTitle,
        content: scriptContent,
        updated_at: new Date().toISOString()
      }

      if (selectedScriptId === 'new') {
        // INSERT
        const { data, error } = await supabase
            .from('user_scripts')
            .insert([scriptData])
            .select()
        
        if (error) throw error
        if (data) {
            setScripts([...scripts, data[0]])
            setSelectedScriptId(data[0].id)
        }
      } else {
        // UPDATE
        const { error } = await supabase
            .from('user_scripts')
            .update(scriptData)
            .eq('id', selectedScriptId)

        if (error) throw error
        
        // Mettre à jour la liste locale
        setScripts(scripts.map(s => s.id === selectedScriptId ? { ...s, title: scriptTitle, content: scriptContent } : s))
      }
      
      // On ne ferme pas forcément la modale, on montre juste que c'est sauvegardé (ou on ferme, au choix)
      // setIsScriptModalOpen(false) 
      alert("Script sauvegardé !")

    } catch (error) {
      console.error(error)
      alert('Erreur sauvegarde script')
    } finally {
      setIsSavingScript(false)
    }
  }

  // Supprimer un script
  const handleDeleteScript = async () => {
    if (selectedScriptId === 'new') return
    if (!confirm("Voulez-vous vraiment supprimer ce script ?")) return

    try {
        const { error } = await supabase.from('user_scripts').delete().eq('id', selectedScriptId)
        if (error) throw error

        const newScripts = scripts.filter(s => s.id !== selectedScriptId)
        setScripts(newScripts)
        
        if (newScripts.length > 0) {
            setSelectedScriptId(newScripts[0].id)
            setScriptContent(newScripts[0].content)
            setScriptTitle(newScripts[0].title)
        } else {
            setSelectedScriptId('new')
            setScriptContent('')
            setScriptTitle('')
        }
    } catch (error) {
        console.error("Erreur suppression", error)
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
    if (contactId === null) {
        setSelectedContactId(null)
    } else {
        setSelectedContactId(contactId)
        setCallType(type)
    }
    setIsNewCallModalOpen(false)
    setIsMeetModalOpen(true)
    setMeetLinkInput('')
  }

  const openMeetTab = () => {
    window.open('https://meet.google.com/new', '_blank')
  }

  // --- ÉTAPE 2 : DÉMARRAGE COCKPIT ---
  const startCockpit = async () => {
    let contactName = 'Appel Vidéo Rapide'
    let finalContactId = 0
    let type = callType

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

    const newCall = await addCallLog({
      contactId: finalContactId,
      contactName: contactName,
      contactType: type,
      date: new Date().toISOString(),
      duration: 'En cours...',
      isAi: false,
      answered: true
    })

    let callDbId = Date.now();
    
    if (newCall) {
        if (typeof newCall.id !== 'undefined') {
            callDbId = newCall.id;
        } else if (Array.isArray(newCall) && newCall.length > 0) {
            callDbId = newCall[0].id;
        } else if (newCall.data && Array.isArray(newCall.data) && newCall.data.length > 0) {
            callDbId = newCall.data[0].id;
        }
    }

    setIsMeetModalOpen(false)
    navigate(`/live-call?id=${callDbId}&name=${encodeURIComponent(contactName)}`)
  }

  const handleStartQuickVideoCall = () => {
    setCallType('internal')
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

      {/* --- MODALE SCRIPT (NOUVELLE VERSION MULTI-SCRIPTS) --- */}
      {isScriptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl flex flex-col h-[80vh]">
            
            {/* Header avec Selecteur */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="p-2 bg-red-500/10 rounded-lg">
                    <FileText className="h-6 w-6 text-red-500" />
                </div>
                <div className="flex-1">
                    <label className="text-xs text-slate-500 block mb-1">Script sélectionné</label>
                    <div className="flex gap-2">
                        <div className="relative flex-1 max-w-xs">
                            <select 
                                value={selectedScriptId} 
                                onChange={(e) => handleScriptChange(e.target.value)}
                                className="w-full appearance-none bg-slate-950 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 pr-8 focus:outline-none focus:border-red-500"
                            >
                                <option value="new">+ Nouveau Script</option>
                                {scripts.map(s => (
                                    <option key={s.id} value={s.id}>{s.title}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                        </div>
                        {selectedScriptId !== 'new' && (
                            <button 
                                onClick={handleDeleteScript}
                                className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                title="Supprimer ce script"
                            >
                                <Trash2 className="h-5 w-5" />
                            </button>
                        )}
                    </div>
                </div>
              </div>
              <button onClick={() => setIsScriptModalOpen(false)} className="text-slate-400 hover:text-white self-start sm:self-center">
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Corps du script (Titre + Contenu) */}
            <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                <div>
                    <input 
                        type="text" 
                        value={scriptTitle}
                        onChange={(e) => setScriptTitle(e.target.value)}
                        placeholder="Titre du script (ex: Cold Call, Closing...)"
                        className="w-full bg-transparent border-none text-xl font-bold text-white placeholder-slate-600 focus:outline-none focus:ring-0 px-0"
                    />
                </div>
                <textarea
                value={scriptContent}
                onChange={(e) => setScriptContent(e.target.value)}
                className="flex-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-6 text-slate-300 focus:border-red-500/50 focus:outline-none resize-none leading-relaxed"
                placeholder="Rédigez votre script ici..."
                />
            </div>

            {/* Footer Actions */}
            <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button onClick={() => setIsScriptModalOpen(false)} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Fermer</button>
              <button onClick={handleSaveScript} disabled={isSavingScript} className="flex items-center gap-2 rounded-lg bg-red-500 px-6 py-2 text-white font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-500/20">
                <Save className="h-4 w-4" />
                {isSavingScript ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL NOUVEL APPEL --- */}
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