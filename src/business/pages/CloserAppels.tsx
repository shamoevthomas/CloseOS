import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Video, Search, Eye, X, Phone, Loader2, Trash2, FileText,
  Save, ExternalLink, Link as LinkIcon, Plus, ChevronDown, Clock, Pencil, Check, MoreVertical, SlidersHorizontal,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useBusinessProspects, type BusinessProspect } from '../contexts/BusinessProspectsContext'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

interface Script {
  id: number | string
  title: string
  content: string
}

interface CallHistoryItem {
  id: number
  contact_name: string
  contact_type: string
  date: string
  duration: string | null
  is_ai: boolean
  answered: boolean
  notes: string | null
  contact_id: number | null
}

const GLASS_PANEL = 'bg-white/70 dark:bg-white/5 backdrop-blur-md ring-1 ring-[#c4c7c7]/5 dark:ring-white/10 shadow-sm'

export function CloserAppels() {
  const navigate = useNavigate()
  const { user, teamMember, ownerUserId, isTeamMember } = useBusinessAuth()
  const { prospects } = useBusinessProspects()
  const isOwnerView = !isTeamMember || teamMember?.role === 'Head of Sales' || teamMember?.role === 'Admin'
  const effectiveOwnerId = ownerUserId || user?.id

  const [callHistory, setCallHistory] = useState<CallHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isNewCallModalOpen, setIsNewCallModalOpen] = useState(false)
  const [selectedProspectId, setSelectedProspectId] = useState<number | null>(null)
  const [prospectSearch, setProspectSearch] = useState('')

  // Meet modal
  const [isMeetModalOpen, setIsMeetModalOpen] = useState(false)
  const [meetLinkInput, setMeetLinkInput] = useState('')
  const [isQuickCall, setIsQuickCall] = useState(false)

  // Scripts
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false)
  const [scripts, setScripts] = useState<Script[]>([])
  const [selectedScriptId, setSelectedScriptId] = useState<string | number | 'new'>('new')
  const [scriptContent, setScriptContent] = useState('')
  const [scriptTitle, setScriptTitle] = useState('')
  const [isSavingScript, setIsSavingScript] = useState(false)

  // Name editing
  const [editingCallId, setEditingCallId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')

  // Menu dropdown
  const [openMenuCallId, setOpenMenuCallId] = useState<number | null>(null)

  const myProspects = isOwnerView ? prospects : prospects.filter(p => p.assigned_to === teamMember?.id)

  // Load call history
  useEffect(() => {
    if (!effectiveOwnerId && !teamMember?.id) return
    setLoading(true)
    const query = supabase.from('business_call_history').select('*').order('date', { ascending: false })
    if (isOwnerView) {
      query.eq('business_owner_id', effectiveOwnerId!)
    } else {
      query.eq('team_member_id', teamMember!.id)
    }
    query.then(({ data }) => {
      setCallHistory(data || [])
      setLoading(false)
    })
  }, [teamMember?.id, effectiveOwnerId, isOwnerView])

  // Load scripts
  const fetchScripts = async () => {
    if (!teamMember?.id && !effectiveOwnerId) return
    const query = isOwnerView
      ? supabase.from('business_user_scripts').select('*').eq('business_owner_id', effectiveOwnerId!).order('id')
      : supabase.from('business_user_scripts').select('*').eq('team_member_id', teamMember!.id).order('id')
    const { data } = await query
    if (data && data.length > 0) {
      setScripts(data)
      setSelectedScriptId(data[0].id)
      setScriptContent(data[0].content || '')
      setScriptTitle(data[0].title || '')
    } else {
      setScripts([])
      setSelectedScriptId('new')
      setScriptContent('')
      setScriptTitle('Mon Script')
    }
  }

  useEffect(() => { if (isScriptModalOpen) fetchScripts() }, [isScriptModalOpen])

  const handleScriptChange = (val: string) => {
    if (val === 'new') { setSelectedScriptId('new'); setScriptContent(''); setScriptTitle(''); return }
    const s = scripts.find(s => String(s.id) === val)
    if (s) { setSelectedScriptId(s.id); setScriptContent(s.content || ''); setScriptTitle(s.title || '') }
  }

  const handleSaveScript = async () => {
    if (!scriptTitle.trim() || !effectiveOwnerId) return
    setIsSavingScript(true)
    try {
      if (selectedScriptId === 'new') {
        const { data, error } = await supabase.from('business_user_scripts').insert([{ team_member_id: teamMember?.id || null, business_owner_id: effectiveOwnerId, title: scriptTitle, content: scriptContent }]).select()
        if (error) throw error
        if (data) { setScripts([...scripts, data[0]]); setSelectedScriptId(data[0].id) }
      } else {
        await supabase.from('business_user_scripts').update({ title: scriptTitle, content: scriptContent }).eq('id', selectedScriptId)
        setScripts(scripts.map(s => s.id === selectedScriptId ? { ...s, title: scriptTitle, content: scriptContent } : s))
      }
      toast.success('Script sauvegardé')
    } catch { toast.error('Erreur') }
    finally { setIsSavingScript(false) }
  }

  const handleDeleteScript = async () => {
    if (selectedScriptId === 'new' || !confirm('Supprimer ce script ?')) return
    await supabase.from('business_user_scripts').delete().eq('id', selectedScriptId)
    const remaining = scripts.filter(s => s.id !== selectedScriptId)
    setScripts(remaining)
    if (remaining.length > 0) { setSelectedScriptId(remaining[0].id); setScriptContent(remaining[0].content || ''); setScriptTitle(remaining[0].title || '') }
    else { setSelectedScriptId('new'); setScriptContent(''); setScriptTitle('') }
  }

  const prepareCall = (prospectId: number | null) => {
    setSelectedProspectId(prospectId)
    setIsNewCallModalOpen(false)
    setIsQuickCall(false)
    setIsMeetModalOpen(true)
    setMeetLinkInput('')
  }

  const handleQuickCall = () => {
    setSelectedProspectId(null)
    setIsQuickCall(true)
    setIsMeetModalOpen(true)
    setMeetLinkInput('')
  }

  const startQuickCockpit = async () => {
    if (!effectiveOwnerId) return
    const { data: newCall } = await supabase.from('business_call_history').insert([{
      team_member_id: teamMember?.id || null,
      business_owner_id: effectiveOwnerId,
      contact_id: 0,
      contact_name: 'Call Rapide',
      contact_type: 'internal',
      date: new Date().toISOString(),
      duration: 'En cours...',
      is_ai: false,
      answered: true,
    }]).select().single()
    const callDbId = newCall?.id || Date.now()
    setIsMeetModalOpen(false)
    navigate(`/business/cockpit?id=${callDbId}&name=${encodeURIComponent('Call Rapide')}`)
  }

  const startCockpit = async () => {
    if (!effectiveOwnerId) return
    let contactName = 'Appel Vidéo'
    let contactId = 0
    if (selectedProspectId) {
      const p = myProspects.find(x => x.id === selectedProspectId)
      if (p) { contactName = p.contact; contactId = p.id }
    }

    const { data: newCall } = await supabase.from('business_call_history').insert([{
      team_member_id: teamMember?.id || null,
      business_owner_id: effectiveOwnerId,
      contact_id: contactId,
      contact_name: contactName,
      contact_type: 'prospect',
      date: new Date().toISOString(),
      duration: 'En cours...',
      is_ai: false,
      answered: true,
    }]).select().single()

    const callDbId = newCall?.id || Date.now()
    setIsMeetModalOpen(false)
    navigate(`/business/cockpit?id=${callDbId}&name=${encodeURIComponent(contactName)}`)
  }

  const saveCallName = async () => {
    if (!editingCallId || !editingName.trim()) return
    await supabase.from('business_call_history').update({ contact_name: editingName }).eq('id', editingCallId)
    setCallHistory(prev => prev.map(c => c.id === editingCallId ? { ...c, contact_name: editingName } : c))
    setEditingCallId(null)
    setEditingName('')
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

  const filteredHistory = callHistory.filter(c => !searchQuery || c.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()))

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-stone-300" /></div>
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <header className="space-y-2">
        <div className="flex items-center gap-4 text-[#006c49] mb-2">
          <Phone className="h-6 w-6" strokeWidth={1.5} />
          <span className="h-px w-10 bg-[#c4c7c7]/30" />
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold">Workspace</span>
        </div>
        <h1 className="text-2xl md:text-4xl font-business-display font-extrabold tracking-tight text-stone-900 dark:text-white">Appels</h1>
        <p className="text-stone-500 dark:text-neutral-400 text-base max-w-2xl font-light italic opacity-80">Gérez vos appels, scripts et suivez vos prospects.</p>
      </header>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="relative flex-1 max-w-2xl group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" strokeWidth={1.5} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un prospect ou un appel..."
            className="w-full pl-14 pr-6 py-5 bg-white dark:bg-neutral-800 border border-[#c4c7c7]/20 dark:border-neutral-700 rounded-[2rem] shadow-sm group-hover:shadow-md transition-shadow focus:ring-2 focus:ring-[#006c49]/10 focus:border-[#006c49] outline-none font-medium text-stone-900 dark:text-white dark:placeholder-neutral-500"
          />
        </div>
        <div className="flex items-center gap-3 md:gap-4 flex-wrap">
          <button
            onClick={() => setIsScriptModalOpen(true)}
            className="px-4 md:px-8 py-3 md:py-5 bg-[#ffddb8] text-[#2a1700] rounded-full font-bold font-business-display tracking-tight hover:opacity-90 transition-all flex items-center gap-2 md:gap-3 shadow-lg shadow-[#ffddb8]/10"
          >
            <FileText className="h-5 w-5" strokeWidth={1.5} />
            <span className="hidden sm:inline">Script</span>
          </button>
          <button
            onClick={handleQuickCall}
            className="px-4 md:px-8 py-3 md:py-5 bg-[#006c49] text-white rounded-full font-bold font-business-display tracking-tight hover:opacity-90 transition-all flex items-center gap-2 md:gap-3 shadow-lg shadow-[#006c49]/10"
          >
            <Video className="h-5 w-5" strokeWidth={1.5} />
            <span className="hidden sm:inline">Call Rapide</span>
          </button>
          <button
            onClick={() => setIsNewCallModalOpen(true)}
            className="px-4 md:px-8 py-3 md:py-5 bg-stone-900 text-white rounded-full font-bold font-business-display tracking-tight hover:opacity-90 transition-all flex items-center gap-2 md:gap-3 shadow-lg shadow-stone-900/10"
          >
            <Phone className="h-5 w-5" strokeWidth={1.5} />
            <span className="hidden sm:inline">Nouvel Appel</span>
          </button>
        </div>
      </div>

      {/* Title bar */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-business-display font-extrabold tracking-tight text-stone-900 dark:text-white">Appels Récents</h2>
      </div>

      {/* Call Cards List */}
      <div className="space-y-4">
        {filteredHistory.map(call => (
          <div
            key={call.id}
            className={cn(
              GLASS_PANEL,
              'px-4 md:px-6 py-3 md:py-4 rounded-2xl group hover:border-[#006c49]/20 hover:shadow-md transition-all flex items-center justify-between'
            )}
          >
            <div className="flex items-center gap-3 md:gap-6 min-w-0">
              <div className="w-10 h-10 md:w-16 md:h-16 bg-[#eae8e7] dark:bg-white/5 rounded-xl flex items-center justify-center shadow-inner group-hover:bg-[#ffddb8] transition-colors shrink-0">
                <Video className="h-5 w-5 md:h-7 md:w-7 text-stone-700 dark:text-neutral-200" strokeWidth={1.5} />
              </div>
              <div>
                {editingCallId === call.id ? (
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="border border-[#006c49] rounded-lg px-3 py-1.5 text-sm font-bold text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#006c49]/20"
                      autoFocus
                    />
                    <button onClick={saveCallName} className="p-1.5 text-[#006c49] hover:bg-[#006c49]/10 rounded-full transition-colors"><Check className="h-4 w-4" /></button>
                    <button onClick={() => setEditingCallId(null)} className="p-1.5 text-stone-400 hover:bg-stone-100 rounded-full transition-colors"><X className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-business-display font-bold text-lg text-stone-900 dark:text-white">{call.contact_name}</h3>
                    <button
                      onClick={() => { setEditingCallId(call.id); setEditingName(call.contact_name) }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-stone-100 rounded-full transition-all"
                    >
                      <Pencil className="h-3.5 w-3.5 text-stone-400" strokeWidth={1.5} />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-4 text-sm text-stone-500 dark:text-neutral-400">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Clock className="h-4 w-4" strokeWidth={1.5} />
                    {formatTimeAgo(call.date)}
                  </span>
                  {call.duration && (
                    <span className="flex items-center gap-1.5 font-medium">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      {call.duration}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5 px-2.5 py-0.5 bg-[#006c49]/10 text-[#006c49] rounded-full text-xs font-bold">
                    <span className="w-2 h-2 rounded-full bg-[#006c49]" />
                    Terminé
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(`/business/appels/${call.id}?readonly=1`)}
                className="flex items-center gap-2 px-3 md:px-6 py-2 md:py-3 bg-[#eae8e7] dark:bg-white/5 hover:bg-[#dbdad9] dark:hover:bg-white/10 text-stone-900 dark:text-white rounded-full font-bold text-sm transition-all"
              >
                <Eye className="h-4 w-4" strokeWidth={1.5} />
                <span className="hidden sm:inline">Détails</span>
              </button>
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setOpenMenuCallId(openMenuCallId === call.id ? null : call.id) }}
                  className="p-3 text-stone-400 hover:text-stone-700 dark:hover:text-white transition-colors"
                >
                  <MoreVertical className="h-5 w-5" strokeWidth={1.5} />
                </button>
                {openMenuCallId === call.id && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpenMenuCallId(null)} />
                    <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-neutral-800 rounded-xl shadow-lg border border-stone-200 dark:border-neutral-700 py-1 min-w-[140px]">
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          if (!confirm('Supprimer cet appel ?')) return
                          await supabase.from('business_call_history').delete().eq('id', call.id)
                          setCallHistory(prev => prev.filter(c => c.id !== call.id))
                          setOpenMenuCallId(null)
                          toast.success('Appel supprimé')
                        }}
                        className="flex items-center gap-2 w-full px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                        Supprimer
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
        {filteredHistory.length === 0 && (
          <div className={cn(GLASS_PANEL, 'rounded-2xl py-16 text-center')}>
            <Video className="h-12 w-12 mx-auto mb-4 text-stone-300 dark:text-neutral-600" strokeWidth={1} />
            <p className="text-stone-400 dark:text-neutral-500 font-medium">Aucun appel récent.</p>
            <p className="text-stone-400/60 dark:text-neutral-500/60 text-sm mt-1">Lancez un appel pour commencer.</p>
          </div>
        )}
      </div>

      {/* New Call Modal */}
      {isNewCallModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setIsNewCallModalOpen(false)} />
          <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-neutral-900 shadow-2xl p-8 animate-in zoom-in-95">
            <button onClick={() => setIsNewCallModalOpen(false)} className="absolute top-5 right-5 text-stone-300 hover:text-stone-700 transition-colors"><X className="h-5 w-5" strokeWidth={1.5} /></button>
            <h2 className="text-2xl font-business-display font-extrabold tracking-tight text-stone-900 dark:text-white mb-6">Sélectionner un prospect</h2>
            <div className="relative mb-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" strokeWidth={1.5} />
              <input
                type="text"
                placeholder="Rechercher..."
                value={prospectSearch}
                onChange={e => setProspectSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 bg-[#f5f3f2] dark:bg-neutral-800 border-none rounded-2xl text-sm font-medium text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20 outline-none"
              />
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1 mb-6">
              {myProspects.filter(p => !prospectSearch || p.contact.toLowerCase().includes(prospectSearch.toLowerCase())).map(p => (
                <button key={p.id} onClick={() => setSelectedProspectId(p.id)}
                  className={cn("w-full text-left p-3.5 rounded-2xl transition-all font-medium text-sm",
                    selectedProspectId === p.id ? "bg-[#006c49]/10 text-[#006c49] ring-1 ring-[#006c49]/20" : "hover:bg-[#f5f3f2] dark:hover:bg-neutral-800 text-stone-700 dark:text-neutral-200")}>
                  {p.contact} {p.company && <span className="text-stone-400 ml-1">({p.company})</span>}
                </button>
              ))}
              {myProspects.length === 0 && <p className="text-center text-stone-400 text-sm py-6">Aucun prospect assigné</p>}
            </div>
            <button onClick={() => prepareCall(selectedProspectId)} disabled={!selectedProspectId}
              className="w-full rounded-full bg-stone-900 py-4 font-business-display font-extrabold text-white text-sm hover:opacity-90 disabled:opacity-50 transition-all">
              Préparer l'appel
            </button>
          </div>
        </div>
      )}

      {/* Meet Preparation Modal */}
      {isMeetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setIsMeetModalOpen(false)} />
          <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-neutral-900 shadow-2xl p-8 animate-in zoom-in-95">
            <button onClick={() => setIsMeetModalOpen(false)} className="absolute top-5 right-5 text-stone-300 hover:text-stone-700 transition-colors"><X className="h-5 w-5" strokeWidth={1.5} /></button>
            <h3 className="text-2xl font-business-display font-extrabold tracking-tight text-stone-900 dark:text-white mb-8">Préparer l'appel</h3>
            <div className="space-y-5">
              <div className="rounded-2xl bg-[#f5f3f2] dark:bg-white/5 p-6">
                <p className="font-bold text-stone-900 dark:text-white mb-3 text-sm">1. Ouvrir Google Meet</p>
                <button onClick={() => window.open('https://meet.google.com/new', '_blank')}
                  className="w-full flex items-center justify-center gap-2 rounded-full bg-[#006c49] px-4 py-3.5 text-sm font-bold text-white hover:opacity-90 transition-all">
                  <ExternalLink className="h-4 w-4" strokeWidth={1.5} /> Ouvrir Meet
                </button>
              </div>
              <div className="rounded-2xl bg-[#f5f3f2] dark:bg-white/5 p-6">
                <p className="font-bold text-stone-900 dark:text-white mb-3 text-sm">2. Lancer le Cockpit</p>
                <div className="relative mb-3">
                  <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" strokeWidth={1.5} />
                  <input type="text" value={meetLinkInput} onChange={(e) => setMeetLinkInput(e.target.value)} placeholder="Lien Meet (optionnel)"
                    className="w-full rounded-full bg-white dark:bg-neutral-700 border-none pl-11 pr-4 py-3 text-sm font-medium text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20 outline-none" />
                </div>
                <button onClick={isQuickCall ? startQuickCockpit : startCockpit}
                  className="w-full flex items-center justify-center gap-2 rounded-full bg-stone-900 px-4 py-3.5 text-sm font-bold text-white hover:opacity-90 transition-all">
                  <Video className="h-4 w-4" strokeWidth={1.5} /> Lancer le Cockpit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Script Modal */}
      {isScriptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setIsScriptModalOpen(false)} />
          <div className="relative w-full max-w-4xl rounded-3xl bg-white dark:bg-neutral-900 shadow-2xl flex flex-col h-[70vh] overflow-hidden">
            <div className="p-6 border-b border-[#c4c7c7]/10 dark:border-neutral-700 flex justify-between items-center">
              <div className="flex items-center gap-4 flex-1">
                <FileText className="h-5 w-5 text-[#006c49]" strokeWidth={1.5} />
                <div className="relative flex-1 max-w-xs">
                  <select value={selectedScriptId} onChange={(e) => handleScriptChange(e.target.value)}
                    className="w-full appearance-none bg-[#f5f3f2] dark:bg-neutral-800 border-none text-sm font-medium rounded-full px-5 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-[#006c49]/20 text-stone-900 dark:text-white">
                    <option value="new">+ Nouveau Script</option>
                    {scripts.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 pointer-events-none" />
                </div>
                {selectedScriptId !== 'new' && (
                  <button onClick={handleDeleteScript} className="p-2 text-stone-300 hover:text-red-500 transition-colors"><Trash2 className="h-4 w-4" strokeWidth={1.5} /></button>
                )}
              </div>
              <button onClick={() => setIsScriptModalOpen(false)} className="text-stone-300 hover:text-stone-700 p-2 transition-colors"><X className="h-5 w-5" strokeWidth={1.5} /></button>
            </div>
            <div className="px-8 pt-6">
              <input type="text" value={scriptTitle} onChange={(e) => setScriptTitle(e.target.value)} placeholder="Titre du script"
                className="w-full bg-transparent text-2xl font-business-display font-extrabold text-stone-900 dark:text-white placeholder-stone-300 dark:placeholder-neutral-600 focus:outline-none tracking-tight" />
            </div>
            <div className="flex-1 px-8 py-4">
              <textarea value={scriptContent} onChange={(e) => setScriptContent(e.target.value)}
                className="w-full h-full rounded-2xl bg-[#f5f3f2] dark:bg-neutral-800 border-none p-6 text-stone-700 dark:text-neutral-200 font-medium leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#006c49]/10 resize-none"
                placeholder="Rédigez votre script ici..." />
            </div>
            <div className="p-6 border-t border-[#c4c7c7]/10 dark:border-neutral-700 flex justify-end gap-4">
              <button onClick={() => setIsScriptModalOpen(false)} className="px-6 py-3 rounded-full font-bold text-sm text-stone-500 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white transition-colors">Fermer</button>
              <button onClick={handleSaveScript} disabled={isSavingScript}
                className="flex items-center gap-2 rounded-full bg-stone-900 px-8 py-3 text-sm font-bold text-white hover:opacity-90 transition-all">
                <Save className="h-4 w-4" strokeWidth={1.5} /> {isSavingScript ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
