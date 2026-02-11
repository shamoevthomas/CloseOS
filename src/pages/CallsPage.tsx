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
  ChevronDown,
  Clock // Ajout pour le style
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useProspects, type Prospect } from '../contexts/ProspectsContext'
import { useInternalContacts, type InternalContact } from '../contexts/InternalContactsContext'
import { useCalls } from '../contexts/CallsContext'
import { MaskedText } from '../components/MaskedText'
import { supabase } from '../lib/supabase'

// Type pour les scripts - ID flexible (number ou string)
interface Script {
  id: number | string
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
  // Typage strict pour l'ID sélectionné
  const [selectedScriptId, setSelectedScriptId] = useState<string | number | 'new'>('new')
  const [scriptContent, setScriptContent] = useState('')
  const [scriptTitle, setScriptTitle] = useState('')
  const [isSavingScript, setIsSavingScript] = useState(false)

  // 1. Chargement des scripts à l'ouverture de la modale
  useEffect(() => {
    if (isScriptModalOpen) {
      fetchUserScripts()
    }
  }, [isScriptModalOpen])

  // 2. Fonction de chargement
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
        // Sélection par défaut du premier script
        const firstScript = data[0]
        setSelectedScriptId(firstScript.id)
        setScriptContent(firstScript.content || '')
        setScriptTitle(firstScript.title || 'Mon Script')
      } else {
        // Mode création par défaut si vide
        setScripts([])
        setSelectedScriptId('new')
        setScriptContent('')
        setScriptTitle('Mon Script de Vente')
      }
    } catch (error) {
      console.error('Erreur chargement scripts:', error)
    }
  }

  // 3. Gestion du changement de script
  const handleScriptChange = (val: string) => {
    if (val === 'new') {
      setSelectedScriptId('new')
      setScriptContent('')
      setScriptTitle('')
    } else {
      const script = scripts.find(s => String(s.id) === val)
      
      if (script) {
        setSelectedScriptId(script.id)
        setScriptContent(script.content || '') 
        setScriptTitle(script.title || '')     
      }
    }
  }

  // 4. Sauvegarde
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
        
        // Mise à jour locale
        setScripts(scripts.map(s => s.id === selectedScriptId ? { ...s, title: scriptTitle, content: scriptContent } : s))
      }
      
      alert("Script sauvegardé !")

    } catch (error) {
      console.error(error)
      alert('Erreur sauvegarde script')
    } finally {
      setIsSavingScript(false)
    }
  }

  // 5. Suppression
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
            setScriptContent(newScripts[0].content || '')
            setScriptTitle(newScripts[0].title || '')
        } else {
            setSelectedScriptId('new')
            setScriptContent('')
            setScriptTitle('')
        }
    } catch (error) {
        console.error("Erreur suppression", error)
    }
  }

  // --- Helpers Call Page existants ---
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-black p-8">
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
              className="w-full rounded-xl border border-slate-800 bg-slate-900/50 py-3 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsScriptModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-5 py-3 text-sm font-semibold text-red-400 transition-all hover:bg-red-500/20 hover:scale-105"
            >
              <FileText className="h-4 w-4" />
              Script
            </button>

            <button
              onClick={handleStartQuickVideoCall}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-3 text-sm font-bold text-white transition-all hover:shadow-lg hover:shadow-purple-500/25 hover:scale-105"
            >
              <Video className="h-4 w-4" />
              🚀 Visio Rapide
            </button>

            <button
              onClick={() => setIsNewCallModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3 text-sm font-bold text-white transition-all hover:shadow-lg hover:shadow-emerald-500/25 hover:scale-105"
            >
              <Phone className="h-4 w-4" />
              Nouvel Appel
            </button>
          </div>
        </div>

        {/* Call History */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 shadow-xl backdrop-blur-sm">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Appels Récents</h2>
              <p className="text-slate-400 text-sm mt-1">Retrouvez l'historique de vos communications</p>
            </div>
            
            {callHistory.length > 0 && (
              <button
                onClick={() => { if(confirm('Tout supprimer ?')) clearHistory() }}
                className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors"
              >
                <Trash2 className="h-4 w-4" /> Supprimer historique
              </button>
            )}
          </div>

          <div className="grid gap-3">
            {callHistory.map((call) => (
              <div key={call.id} className="group flex items-center justify-between rounded-xl border border-slate-800 bg-slate-800/30 p-5 hover:border-slate-700 hover:bg-slate-800/80 transition-all hover:shadow-lg hover:shadow-blue-900/5">
                <div className="flex items-center gap-5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors">
                    <Video className="h-6 w-6 text-blue-400" />
                  </div>
                  <div>
                    <p className="font-bold text-white text-lg"><MaskedText value={call.contactName} type="name" /></p>
                    {/* 👇 MODIFICATION ICI : Suppression de call.duration */}
                    <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-1">
                      <Clock className="h-3 w-3" />
                      {formatTimeAgo(call.date)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/appels/${call.id}`)}
                  className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white hover:border-slate-600 transition-all"
                >
                  <Eye className="h-4 w-4" /> Détails
                </button>
              </div>
            ))}
            {callHistory.length === 0 && (
                <div className="py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl bg-slate-900/30">
                    <Video className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p>Aucun appel récent.</p>
                </div>
            )}
          </div>
        </div>
      </div>

      {/* --- MODALE PRÉPARATION (MEET) --- */}
      {isMeetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsMeetModalOpen(false)} />
          <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 shadow-2xl border border-slate-800 p-6 animate-in fade-in zoom-in-95">
             <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
                <h3 className="text-xl font-bold text-white">🎥 Préparer l'appel</h3>
                <button onClick={() => setIsMeetModalOpen(false)} className="rounded-lg p-2 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                    <X className="h-5 w-5"/>
                </button>
             </div>
             
             <div className="space-y-6">
                <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-5">
                    <div className="flex items-start gap-4">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white font-bold text-sm">1</div>
                        <div className="flex-1">
                            <p className="font-bold text-white">Ouvrir Google Meet</p>
                            <p className="text-sm text-slate-400 mt-1">Ouvrez votre salle de réunion dans un nouvel onglet.</p>
                            <button onClick={openMeetTab} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20">
                                <ExternalLink className="h-4 w-4" /> Ouvrir Meet
                            </button>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl bg-purple-500/10 border border-purple-500/20 p-5">
                    <div className="flex items-start gap-4">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-500 text-white font-bold text-sm">2</div>
                        <div className="flex-1">
                            <p className="font-bold text-white">Lancer le Cockpit</p>
                            <p className="text-sm text-slate-400 mt-1">Accédez à votre script, prenez des notes et enregistrez l'écran.</p>
                            
                            <div className="mt-4 relative">
                                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                                <input 
                                    type="text" 
                                    value={meetLinkInput}
                                    onChange={(e) => setMeetLinkInput(e.target.value)}
                                    placeholder="Lien Meet (optionnel)"
                                    className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2.5 pl-10 pr-4 text-sm text-white focus:border-purple-500 focus:outline-none transition-colors"
                                />
                            </div>

                            <button onClick={startCockpit} className="mt-4 w-full flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-3 text-base font-bold text-white hover:bg-purple-500 shadow-lg shadow-purple-500/20 transition-all hover:scale-[1.02]">
                                <Video className="h-5 w-5" /> 🚀 Lancer le Cockpit
                            </button>
                        </div>
                    </div>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* --- MODALE SCRIPT (MULTI-SCRIPTS) --- */}
      {isScriptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsScriptModalOpen(false)} />
          <div className="relative w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl flex flex-col h-[80vh] animate-in fade-in zoom-in-95">
            
            {/* Header avec Selecteur */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/20">
                    <FileText className="h-6 w-6 text-red-500" />
                </div>
                <div className="flex-1">
                    <label className="text-xs text-slate-500 block mb-1 font-semibold uppercase tracking-wider">Script sélectionné</label>
                    <div className="flex gap-2">
                        <div className="relative flex-1 max-w-xs">
                            <select 
                                value={selectedScriptId} 
                                onChange={(e) => handleScriptChange(e.target.value)}
                                className="w-full appearance-none bg-slate-950 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 pr-8 focus:outline-none focus:border-red-500 transition-colors cursor-pointer hover:border-slate-600"
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
                                className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20"
                                title="Supprimer ce script"
                            >
                                <Trash2 className="h-5 w-5" />
                            </button>
                        )}
                    </div>
                </div>
              </div>
              <button onClick={() => setIsScriptModalOpen(false)} className="text-slate-400 hover:text-white self-start sm:self-center bg-slate-800 p-2 rounded-lg hover:bg-slate-700 transition-colors">
                <X className="h-5 w-5" />
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
                className="flex-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-6 text-slate-300 focus:border-red-500/50 focus:outline-none resize-none leading-relaxed custom-scrollbar"
                placeholder="Rédigez votre script ici..."
                />
            </div>

            {/* Footer Actions */}
            <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button onClick={() => setIsScriptModalOpen(false)} className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm font-medium">Fermer</button>
              <button onClick={handleSaveScript} disabled={isSavingScript} className="flex items-center gap-2 rounded-lg bg-red-500 px-6 py-2 text-white font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 text-sm">
                <Save className="h-4 w-4" />
                {isSavingScript ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL NOUVEL APPEL (Selection Contact) --- */}
      {isNewCallModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleCloseNewCallModal} />
          <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 shadow-2xl border border-slate-800 p-6 animate-in fade-in zoom-in-95">
            <h2 className="text-xl font-bold text-white mb-6">Qui appeler ?</h2>
            
            <div className="flex gap-2 mb-4 p-1 bg-slate-950 rounded-lg border border-slate-800">
              <button onClick={() => setCallType('prospect')} className={cn("flex-1 py-2 rounded-md text-sm font-medium transition-all", callType === 'prospect' ? "bg-slate-800 text-white shadow-sm" : "text-slate-400 hover:text-slate-200")}>Prospect</button>
              <button onClick={() => setCallType('internal')} className={cn("flex-1 py-2 rounded-md text-sm font-medium transition-all", callType === 'internal' ? "bg-slate-800 text-white shadow-sm" : "text-slate-400 hover:text-slate-200")}>Interne</button>
            </div>
            
            <input type="text" placeholder="Rechercher..." value={selectedContactSearch} onChange={e => setSelectedContactSearch(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white mb-4 focus:border-emerald-500 focus:outline-none transition-colors"/>
            
            <div className="max-h-48 overflow-y-auto space-y-1 mb-6 pr-2 custom-scrollbar">
              {getContactList().map(c => (
                <button key={(c as any).id} onClick={() => setSelectedContactId((c as any).id)} className={cn("w-full text-left p-3 rounded-lg transition-colors border border-transparent", selectedContactId === (c as any).id ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" : "hover:bg-slate-800 text-slate-300")}>
                  {(c as any).contact || (c as any).name}
                </button>
              ))}
              {getContactList().length === 0 && (
                  <p className="text-center text-slate-500 text-sm py-4">Aucun contact trouvé</p>
              )}
            </div>
            
            <button onClick={() => prepareCall(selectedContactId, callType)} disabled={!selectedContactId} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-600/20">
              Préparer l'appel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}