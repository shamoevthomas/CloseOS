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
  Clock, // Ajout pour le style
  Pencil,
  Check
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useProspects, type Prospect } from '../contexts/ProspectsContext'
import { useInternalContacts, type InternalContact } from '../contexts/InternalContactsContext'
import { useCalls } from '../contexts/CallsContext'
import { useAuth } from '../contexts/AuthContext'
import { MaskedText } from '../components/MaskedText'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../contexts/LanguageContext'
import { callsTranslations } from '../i18n/translations'

// Type pour les scripts - ID flexible (number ou string)
interface Script {
  id: number | string
  title: string
  content: string
}

export function CallsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { lang } = useLanguage()
  const t = callsTranslations[lang]
  const { prospects, updateProspect } = useProspects()
  const { contacts: internalContacts } = useInternalContacts()
  const { callHistory, addCallLog, clearHistory, refreshHistory } = useCalls()

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
  const [isSavingScript, setIsSavingScript] = useState(false)

  // Typage strict pour l'ID sélectionné
  const [selectedScriptId, setSelectedScriptId] = useState<string | number | 'new'>('new')
  const [scriptContent, setScriptContent] = useState('')
  const [scriptTitle, setScriptTitle] = useState('')
  const [editingCallId, setEditingCallId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')

  const startEditing = (call: any) => {
    setEditingCallId(call.id)
    setEditingName(call.contactName)
  }

  const cancelEditing = () => {
    setEditingCallId(null)
    setEditingName('')
  }

  const saveCallName = async () => {
    if (!editingCallId || !editingName.trim()) return

    try {
      const { error } = await supabase
        .from('call_history')
        .update({ contactName: editingName })
        .eq('id', editingCallId)

      if (error) throw error

      setEditingCallId(null)
      setEditingName('')
      refreshHistory()
      // Actually context is exposed line 37: `const { callHistory, addCallLog, clearHistory } = useCalls()`
      // I should check if `refreshHistory` is available in `useCalls`.
      // Looking at `CallsContext.tsx`, `refreshHistory` IS available in the provider value!
      // I need to update the destructuring line 37.

    } catch (err) {
      console.error("Failed to rename call", err)
      alert(lang === 'fr' ? "Erreur lors du renommage" : "Error renaming call")
    }
  }

  // 1. Chargement des scripts à l'ouverture de la modale
  useEffect(() => {
    if (isScriptModalOpen) {
      fetchUserScripts()
    }
  }, [isScriptModalOpen])

  // 2. Fonction de chargement
  const fetchUserScripts = async () => {
    try {
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
      alert(lang === 'fr' ? "Veuillez donner un titre à votre script" : "Please give your script a title")
      return
    }

    setIsSavingScript(true)
    try {
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

      alert(lang === 'fr' ? "Script sauvegardé !" : "Script saved!")

    } catch (error) {
      console.error(error)
      alert(lang === 'fr' ? 'Erreur sauvegarde script' : 'Error saving script')
    } finally {
      setIsSavingScript(false)
    }
  }

  // 5. Suppression
  const handleDeleteScript = async () => {
    if (selectedScriptId === 'new') return
    if (!confirm(lang === 'fr' ? "Voulez-vous vraiment supprimer ce script ?" : "Are you sure you want to delete this script?")) return

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
    if (newCall && newCall.data) {
      if (Array.isArray(newCall.data) && newCall.data.length > 0) {
        callDbId = newCall.data[0].id;
      } else if ((newCall.data as any).id) {
        callDbId = (newCall.data as any).id;
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

    if (lang === 'fr') {
      if (diffMins < 60) return `il y a ${diffMins} min`
      if (diffHours < 24) return `il y a ${diffHours}h`
      if (diffDays === 1) return 'Hier'
      if (diffDays < 7) return `il y a ${diffDays}j`
    } else {
      if (diffMins < 60) return `${diffMins} min ago`
      if (diffHours < 24) return `${diffHours}h ago`
      if (diffDays === 1) return 'Yesterday'
      if (diffDays < 7) return `${diffDays}d ago`
    }
    return date.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="relative min-h-screen bg-transparent p-8 overflow-hidden font-sans text-slate-900 dark:text-white">

      {/* Background Blobs */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-sky-500/10 opacity-30 blur-[120px] rounded-full pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-sky-500/5 opacity-20 blur-[100px] rounded-full pointer-events-none mix-blend-screen" />

      <div className="relative mx-auto max-w-7xl space-y-8 z-10">

        {/* Header Section */}
        <div className="flex items-center justify-between mb-4">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 dark:text-neutral-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.search}
              className="w-full rounded-xl bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 py-3 pl-10 pr-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:border-sky-500 focus:outline-none transition-all duration-300 hover:bg-slate-50"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsScriptModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-5 py-3 text-sm font-semibold text-red-600 transition-all hover:bg-red-500/20 hover:scale-105 active:scale-95"
            >
              <FileText className="h-4 w-4" />
              {lang === 'fr' ? 'Script' : 'Script'}
            </button>

            <button
              onClick={handleStartQuickVideoCall}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 px-6 py-3 text-sm font-bold text-white transition-all hover:shadow-lg hover:shadow-sky-500/25 hover:scale-105 active:scale-95"
            >
              <Video className="h-4 w-4" />
              {lang === 'fr' ? 'Visio Rapide' : 'Quick Video'}
            </button>

            <button
              onClick={() => setIsNewCallModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 px-6 py-3 text-sm font-bold text-white transition-all hover:shadow-lg hover:shadow-sky-500/25 hover:scale-105 active:scale-95"
            >
              <Phone className="h-4 w-4" />
              {t.new_call}
            </button>
          </div>
        </div>

        {/* Call History (GLASS DESIGN) */}
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] p-8 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_-14px_rgba(15,23,42,0.12)] backdrop-blur-[16px]">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{lang === 'fr' ? 'Appels Récents' : 'Recent Calls'}</h2>
              <p className="text-slate-500 dark:text-neutral-400 text-sm mt-1">{lang === 'fr' ? 'Retrouvez l\'historique de vos communications' : 'View your communication history'}</p>
            </div>

            {callHistory.length > 0 && (
              <button
                onClick={() => { if (confirm(lang === 'fr' ? 'Tout supprimer ?' : 'Delete all?')) clearHistory() }}
                className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-500/20 transition-colors"
              >
                <Trash2 className="h-4 w-4" /> {lang === 'fr' ? 'Supprimer historique' : 'Delete history'}
              </button>
            )}
          </div>

          <div className="grid gap-4">
            {callHistory.map((call) => (
              <div key={call.id} className="group flex items-center justify-between rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-5 hover:border-slate-300 hover:bg-slate-100 transition-all duration-300 hover:shadow-lg hover:shadow-slate-900/5">
                <div className="flex items-center gap-5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10 border border-sky-500/20 group-hover:bg-sky-500/20 transition-colors">
                    <Video className="h-6 w-6 text-sky-600 dark:text-sky-400" />
                  </div>
                  <div>
                    {editingCallId === call.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="bg-white dark:bg-[#1a1a1a] border border-sky-500 rounded-xl px-2 py-1 text-slate-900 dark:text-white text-lg font-bold outline-none"
                          autoFocus
                        />
                        <button onClick={saveCallName} className="p-1 hover:bg-sky-500/20 rounded text-sky-600 dark:text-sky-400"><Check className="h-4 w-4" /></button>
                        <button onClick={cancelEditing} className="p-1 hover:bg-red-500/20 rounded text-red-600"><X className="h-4 w-4" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 group/title">
                        <p className="font-bold text-slate-900 dark:text-white text-lg"><MaskedText value={call.contactName} type="name" /></p>
                        <button
                          onClick={(e) => { e.stopPropagation(); startEditing(call); }}
                          className="opacity-0 group-hover/title:opacity-100 p-1 hover:bg-slate-100 rounded text-slate-400 dark:text-neutral-500 hover:text-slate-900 transition-all"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    <p className="text-xs text-slate-500 dark:text-neutral-400 font-medium flex items-center gap-1.5 mt-1">
                      <Clock className="h-3 w-3" />
                      {formatTimeAgo(call.date)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/appels/${call.id}`)}
                  className="flex items-center gap-2 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-neutral-300 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 transition-all duration-300"
                >
                  <Eye className="h-4 w-4" /> {lang === 'fr' ? 'Détails' : 'Details'}
                </button>
              </div>
            ))}
            {callHistory.length === 0 && (
              <div className="py-16 text-center text-slate-500 dark:text-neutral-400 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl bg-slate-50 dark:bg-white/5">
                <Video className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p>{t.no_calls}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- MODALE PRÉPARATION (MEET) --- */}
      {isMeetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsMeetModalOpen(false)} />
          <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-[#1a1a1a] backdrop-blur-[16px] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_-14px_rgba(15,23,42,0.12)] border border-slate-200 dark:border-white/10 p-8 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">{lang === 'fr' ? 'Préparer l\'appel' : 'Prepare call'}</h3>
              <button onClick={() => setIsMeetModalOpen(false)} className="rounded-xl p-2 text-slate-400 dark:text-neutral-500 hover:text-slate-900 hover:bg-slate-100 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl bg-sky-500/10 border border-sky-500/20 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white font-bold text-sm shadow-lg shadow-sky-500/30">1</div>
                  <div className="flex-1">
                    <p className="font-bold text-slate-900 dark:text-white">{lang === 'fr' ? 'Ouvrir Google Meet' : 'Open Google Meet'}</p>
                    <p className="text-sm text-slate-500 dark:text-neutral-400 mt-1">{lang === 'fr' ? 'Ouvrez votre salle de réunion dans un nouvel onglet.' : 'Open your meeting room in a new tab.'}</p>
                    <button onClick={openMeetTab} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-500 transition-colors shadow-lg shadow-sky-500/20">
                      <ExternalLink className="h-4 w-4" /> {lang === 'fr' ? 'Ouvrir Meet' : 'Open Meet'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700 dark:text-neutral-300 font-bold text-sm">2</div>
                  <div className="flex-1">
                    <p className="font-bold text-slate-900 dark:text-white">{lang === 'fr' ? 'Lancer le Cockpit' : 'Launch Cockpit'}</p>
                    <p className="text-sm text-slate-500 dark:text-neutral-400 mt-1">{lang === 'fr' ? 'Accedez a votre script, prenez des notes et enregistrez l\'ecran.' : 'Access your script, take notes, and record your screen.'}</p>

                    <div className="mt-4 relative">
                      <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-neutral-500" />
                      <input
                        type="text"
                        value={meetLinkInput}
                        onChange={(e) => setMeetLinkInput(e.target.value)}
                        placeholder={lang === 'fr' ? 'Lien Meet (optionnel)' : 'Meet link (optional)'}
                        className="w-full rounded-xl bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 py-3 pl-10 pr-4 text-sm text-slate-900 dark:text-white focus:border-sky-500 focus:outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-neutral-500"
                      />
                    </div>

                    <button onClick={startCockpit} className="mt-4 w-full flex items-center justify-center gap-2 rounded-full bg-sky-600 px-4 py-3 text-base font-semibold text-white hover:bg-sky-500 shadow-lg shadow-sky-500/20 transition-all hover:scale-[1.02]">
                      <Video className="h-5 w-5" /> {lang === 'fr' ? 'Lancer le Cockpit' : 'Launch Cockpit'}
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
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsScriptModalOpen(false)} />
          <div className="relative w-full max-w-3xl rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] backdrop-blur-[16px] p-8 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_-14px_rgba(15,23,42,0.12)] flex flex-col h-[80vh] animate-in fade-in zoom-in-95">

            {/* Header avec Selecteur */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
              <div className="flex items-center gap-3 flex-1">
                <div className="p-2 bg-red-500/10 rounded-xl border border-red-500/20">
                  <FileText className="h-6 w-6 text-red-500" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-slate-500 dark:text-neutral-400 block mb-1 font-bold uppercase tracking-wider">{lang === 'fr' ? 'Script sélectionné' : 'Selected script'}</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1 max-w-xs">
                      <select
                        value={selectedScriptId}
                        onChange={(e) => handleScriptChange(e.target.value)}
                        className="w-full appearance-none bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm rounded-xl px-4 py-2.5 pr-8 focus:outline-none focus:border-sky-500 transition-colors cursor-pointer hover:border-slate-300 font-medium"
                      >
                        <option value="new">{lang === 'fr' ? '+ Nouveau Script' : '+ New Script'}</option>
                        {scripts.map(s => (
                          <option key={s.id} value={s.id}>{s.title}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-neutral-500 pointer-events-none" />
                    </div>
                    {selectedScriptId !== 'new' && (
                      <button
                        onClick={handleDeleteScript}
                        className="p-2.5 text-slate-400 dark:text-neutral-500 hover:text-red-600 hover:bg-red-500/10 rounded-xl transition-colors border border-transparent hover:border-red-500/20"
                        title={lang === 'fr' ? 'Supprimer ce script' : 'Delete this script'}
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <button onClick={() => setIsScriptModalOpen(false)} className="text-slate-400 dark:text-neutral-500 hover:text-slate-900 self-start sm:self-center bg-slate-100 dark:bg-white/10 p-2 rounded-xl hover:bg-slate-200 transition-colors">
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
                  placeholder={lang === 'fr' ? 'Titre du script (ex: Cold Call, Closing...)' : 'Script title (e.g. Cold Call, Closing...)'}
                  className="w-full bg-transparent border-none text-2xl font-bold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-0 px-0"
                />
              </div>
              <textarea
                value={scriptContent}
                onChange={(e) => setScriptContent(e.target.value)}
                className="flex-1 w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-6 text-slate-700 dark:text-neutral-300 focus:border-sky-500/50 focus:outline-none resize-none leading-relaxed custom-scrollbar"
                placeholder={lang === 'fr' ? 'Rédigez votre script ici...' : 'Write your script here...'}
              />
            </div>

            {/* Footer Actions */}
            <div className="mt-6 flex justify-end gap-3 pt-4">
              <button onClick={() => setIsScriptModalOpen(false)} className="px-6 py-3 text-slate-400 dark:text-neutral-500 hover:text-slate-900 transition-colors text-sm font-bold rounded-full hover:bg-slate-100">{lang === 'fr' ? 'Fermer' : 'Close'}</button>
              <button onClick={handleSaveScript} disabled={isSavingScript} className="flex items-center gap-2 rounded-full bg-sky-600 px-6 py-3 text-white font-semibold hover:bg-sky-500 transition-all shadow-lg shadow-sky-500/20 text-sm">
                <Save className="h-4 w-4" />
                {isSavingScript ? (lang === 'fr' ? 'Sauvegarde...' : 'Saving...') : (lang === 'fr' ? 'Sauvegarder' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL NOUVEL APPEL (Selection Contact) --- */}
      {isNewCallModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={handleCloseNewCallModal} />
          <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-[#1a1a1a] backdrop-blur-[16px] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_-14px_rgba(15,23,42,0.12)] border border-slate-200 dark:border-white/10 p-8 animate-in fade-in zoom-in-95">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">{lang === 'fr' ? 'Qui appeler ?' : 'Who to call?'}</h2>

            <div className="flex gap-2 mb-4 p-1 bg-slate-100 dark:bg-white/10 rounded-full border border-slate-200 dark:border-white/10">
              <button onClick={() => setCallType('prospect')} className={cn("flex-1 py-2.5 rounded-full text-sm font-bold transition-all", callType === 'prospect' ? "bg-sky-600 text-white shadow-lg" : "text-slate-500 dark:text-neutral-400 hover:text-slate-900")}>{t.prospect}</button>
              <button onClick={() => setCallType('internal')} className={cn("flex-1 py-2.5 rounded-full text-sm font-bold transition-all", callType === 'internal' ? "bg-sky-600 text-white shadow-lg" : "text-slate-500 dark:text-neutral-400 hover:text-slate-900")}>{lang === 'fr' ? 'Interne' : 'Internal'}</button>
            </div>

            <input type="text" placeholder={lang === 'fr' ? 'Rechercher...' : 'Search...'} value={selectedContactSearch} onChange={e => setSelectedContactSearch(e.target.value)} className="w-full bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-xl p-3.5 text-slate-900 dark:text-white mb-4 focus:border-sky-500 focus:outline-none transition-colors placeholder:text-slate-400 dark:placeholder:text-neutral-500" />

            <div className="max-h-48 overflow-y-auto space-y-1 mb-6 pr-2 custom-scrollbar">
              {getContactList().map(c => (
                <button key={(c as any).id} onClick={() => setSelectedContactId((c as any).id)} className={cn("w-full text-left p-3 rounded-xl transition-colors border border-transparent font-medium", selectedContactId === (c as any).id ? "bg-sky-500/20 border-sky-500/50 text-sky-700 dark:text-sky-400" : "hover:bg-slate-50 text-slate-700 dark:text-neutral-300")}>
                  {(c as any).contact || (c as any).name}
                </button>
              ))}
              {getContactList().length === 0 && (
                <p className="text-center text-slate-500 dark:text-neutral-400 text-sm py-4 italic">{lang === 'fr' ? 'Aucun contact trouvé' : 'No contact found'}</p>
              )}
            </div>

            <button onClick={() => prepareCall(selectedContactId, callType)} disabled={!selectedContactId} className="w-full bg-sky-600 hover:bg-sky-500 text-white font-semibold py-3.5 rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-sky-500/20">
              {lang === 'fr' ? 'Préparer l\'appel' : 'Prepare call'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
