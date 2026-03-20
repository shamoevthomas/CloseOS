import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Video, Search, Eye, X, Phone, Loader2, Trash2, FileText,
  Save, ExternalLink, Link as LinkIcon, Plus, ChevronDown, Clock, Pencil, Check,
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
    setIsMeetModalOpen(true)
    setMeetLinkInput('')
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
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-amber-500" /></div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Rechercher un appel..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none" />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setIsScriptModalOpen(true)} className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-700 hover:bg-amber-100">
            <FileText className="h-4 w-4" /> Script
          </button>
          <button onClick={() => setIsNewCallModalOpen(true)} className="flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-amber-500">
            <Phone className="h-4 w-4" /> Nouvel Appel
          </button>
        </div>
      </div>

      {/* Call History */}
      <div className="rounded-xl border border-amber-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Appels Récents</h2>
        <div className="space-y-3">
          {filteredHistory.map(call => (
            <div key={call.id} className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 hover:shadow-md transition-all">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 border border-amber-200">
                  <Video className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  {editingCallId === call.id ? (
                    <div className="flex items-center gap-2">
                      <input type="text" value={editingName} onChange={(e) => setEditingName(e.target.value)} className="border border-amber-500 rounded px-2 py-1 text-sm font-bold" autoFocus />
                      <button onClick={saveCallName} className="p-1 text-emerald-500 hover:bg-emerald-50 rounded"><Check className="h-4 w-4" /></button>
                      <button onClick={() => setEditingCallId(null)} className="p-1 text-red-400 hover:bg-red-50 rounded"><X className="h-4 w-4" /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-900">{call.contact_name}</p>
                      <button onClick={() => { setEditingCallId(call.id); setEditingName(call.contact_name) }} className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-700 rounded">
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3" /> {formatTimeAgo(call.date)}
                    {call.duration && <span className="ml-2 text-slate-400">{call.duration}</span>}
                  </p>
                </div>
              </div>
              <button onClick={() => navigate(`/business/appels/${call.id}`)}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                <Eye className="h-4 w-4" /> Détails
              </button>
            </div>
          ))}
          {filteredHistory.length === 0 && (
            <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
              <Video className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Aucun appel récent.</p>
            </div>
          )}
        </div>
      </div>

      {/* New Call Modal */}
      {isNewCallModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsNewCallModalOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-amber-200 p-6 animate-in zoom-in-95">
            <button onClick={() => setIsNewCallModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
            <h2 className="text-lg font-bold text-slate-900 mb-4">Sélectionner un prospect</h2>
            <input type="text" placeholder="Rechercher..." value={prospectSearch} onChange={e => setProspectSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-4 text-sm mb-4 focus:border-amber-500 focus:outline-none" />
            <div className="max-h-48 overflow-y-auto space-y-1 mb-4">
              {myProspects.filter(p => !prospectSearch || p.contact.toLowerCase().includes(prospectSearch.toLowerCase())).map(p => (
                <button key={p.id} onClick={() => setSelectedProspectId(p.id)}
                  className={cn("w-full text-left p-3 rounded-xl transition-colors border border-transparent font-medium",
                    selectedProspectId === p.id ? "bg-amber-50 border-amber-300 text-amber-700" : "hover:bg-slate-50 text-slate-700")}>
                  {p.contact} {p.company && <span className="text-xs text-slate-400 ml-1">({p.company})</span>}
                </button>
              ))}
              {myProspects.length === 0 && <p className="text-center text-slate-400 text-sm py-4">Aucun prospect assigné</p>}
            </div>
            <button onClick={() => prepareCall(selectedProspectId)} disabled={!selectedProspectId}
              className="w-full rounded-xl bg-amber-600 py-2.5 font-bold text-white hover:bg-amber-500 disabled:opacity-50 transition-all">
              Préparer l'appel
            </button>
          </div>
        </div>
      )}

      {/* Meet Preparation Modal */}
      {isMeetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsMeetModalOpen(false)} />
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-amber-200 p-6 animate-in zoom-in-95">
            <button onClick={() => setIsMeetModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
            <h3 className="text-lg font-bold text-slate-900 mb-6">Préparer l'appel</h3>
            <div className="space-y-4">
              <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
                <p className="font-medium text-blue-800 mb-2">1. Ouvrir Google Meet</p>
                <button onClick={() => window.open('https://meet.google.com/new', '_blank')}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-500">
                  <ExternalLink className="h-4 w-4" /> Ouvrir Meet
                </button>
              </div>
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                <p className="font-medium text-amber-800 mb-2">2. Lancer le Cockpit</p>
                <div className="relative mb-3">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input type="text" value={meetLinkInput} onChange={(e) => setMeetLinkInput(e.target.value)} placeholder="Lien Meet (optionnel)"
                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm focus:border-amber-500 focus:outline-none" />
                </div>
                <button onClick={startCockpit}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-500">
                  <Video className="h-4 w-4" /> Lancer le Cockpit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Script Modal */}
      {isScriptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsScriptModalOpen(false)} />
          <div className="relative w-full max-w-3xl rounded-2xl border border-amber-200 bg-white p-6 shadow-2xl flex flex-col h-[70vh]">
            <div className="mb-4 flex items-center justify-between border-b border-amber-100 pb-4">
              <div className="flex items-center gap-3 flex-1">
                <FileText className="h-5 w-5 text-amber-600" />
                <div className="relative flex-1 max-w-xs">
                  <select value={selectedScriptId} onChange={(e) => handleScriptChange(e.target.value)}
                    className="w-full appearance-none bg-slate-50 border border-slate-200 text-sm rounded-xl px-4 py-2 pr-8 focus:outline-none focus:border-amber-500">
                    <option value="new">+ Nouveau Script</option>
                    {scripts.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
                {selectedScriptId !== 'new' && (
                  <button onClick={handleDeleteScript} className="p-2 text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                )}
              </div>
              <button onClick={() => setIsScriptModalOpen(false)} className="text-slate-400 hover:text-slate-700 p-2"><X className="h-5 w-5" /></button>
            </div>
            <input type="text" value={scriptTitle} onChange={(e) => setScriptTitle(e.target.value)} placeholder="Titre du script"
              className="w-full bg-transparent text-xl font-bold text-slate-900 placeholder-slate-300 focus:outline-none mb-3" />
            <textarea value={scriptContent} onChange={(e) => setScriptContent(e.target.value)}
              className="flex-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-700 focus:border-amber-500 focus:outline-none resize-none"
              placeholder="Rédigez votre script ici..." />
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => setIsScriptModalOpen(false)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">Fermer</button>
              <button onClick={handleSaveScript} disabled={isSavingScript}
                className="flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2 text-sm font-bold text-white hover:bg-amber-500">
                <Save className="h-4 w-4" /> {isSavingScript ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
