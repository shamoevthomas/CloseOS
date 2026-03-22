import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Monitor, PhoneOff, ChevronDown, ExternalLink, FileText,
  Briefcase, BookOpen, ScrollText, Tag, User, Clock,
  Bold, List, Share2, Mic, Zap, Settings, Download,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessProspects, type BusinessProspect } from '../contexts/BusinessProspectsContext'
import { BusinessProspectView } from '../components/BusinessProspectView'
import { cn } from '../../lib/utils'

interface Script {
  id: number | string
  title: string
  content: string
}

interface Offer {
  id: number | string
  name: string
  price: string
  commission: string
  notes: string
  formulas: any[]
  resources: any[]
}

export function CloserCallRoom() {
  const { teamMember, ownerUserId, user } = useBusinessAuth()
  const { prospects, updateProspect, deleteProspect } = useBusinessProspects()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const callIdFromParams = searchParams.get('id')
  const contactName = searchParams.get('name') || 'Appel'
  const prospectIdFromParams = searchParams.get('prospectId')
  const callIdRef = useRef<string | null>(callIdFromParams)

  // Prospect view
  const [showProspectView, setShowProspectView] = useState(false)
  const prospect = prospectIdFromParams ? prospects.find(p => String(p.id) === prospectIdFromParams) : null

  // Previous call notes from prospect's call_notes field
  const [selectedPreviousNote, setSelectedPreviousNote] = useState<string>('')

  const [isPanelOpen, setIsPanelOpen] = useState(true)
  const [notes, setNotes] = useState('')
  const [callDuration, setCallDuration] = useState(0)

  // Scripts
  const [scripts, setScripts] = useState<Script[]>([])
  const [selectedScriptId, setSelectedScriptId] = useState<string | number>('')
  const [currentScriptContent, setCurrentScriptContent] = useState('Chargement...')

  // Offers
  const [offers, setOffers] = useState<Offer[]>([])
  const [selectedOfferId, setSelectedOfferId] = useState<number | string>('')
  const [activeOfferTab, setActiveOfferTab] = useState<'notes' | 'formulas' | 'resources'>('notes')

  // Recording
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  // Get previous notes from prospect's call_notes
  const previousNotes = (prospect?.call_notes || []).filter((n: any) => n.content?.trim())

  // Load scripts + offers
  useEffect(() => {
    if (!teamMember?.id || !ownerUserId) return
    let mounted = true

    async function loadData() {
      const { data: scriptsData } = await supabase
        .from('business_user_scripts')
        .select('*')
        .eq('team_member_id', teamMember!.id)
        .order('id')

      if (!mounted) return

      if (scriptsData && scriptsData.length > 0) {
        setScripts(scriptsData)
        setSelectedScriptId(scriptsData[0].id)
        setCurrentScriptContent(scriptsData[0].content)
      } else {
        setCurrentScriptContent('Aucun script trouvé.')
      }

      try {
        const res = await fetch(`/api/business?action=offers-list&user_id=${ownerUserId}`)
        const data = await res.json()
        if (!mounted) return
        const offersArr = Array.isArray(data) ? data : data?.offers || []
        const activeOffers = offersArr.filter((o: any) => o.status === 'active')
        if (activeOffers.length > 0) {
          setOffers(activeOffers)
          setSelectedOfferId(activeOffers[0].id)
        }
      } catch {
        const { data: offersData } = await supabase
          .from('offers')
          .select('*')
          .eq('user_id', ownerUserId)
          .eq('status', 'active')
        if (!mounted) return
        if (offersData && offersData.length > 0) {
          setOffers(offersData)
          setSelectedOfferId(offersData[0].id)
        }
      }
    }

    loadData()
    return () => { mounted = false }
  }, [teamMember?.id, ownerUserId])

  useEffect(() => {
    if (selectedScriptId) {
      const s = scripts.find(s => String(s.id) === String(selectedScriptId))
      if (s) setCurrentScriptContent(s.content)
    }
  }, [selectedScriptId, scripts])

  const currentOffer = offers.find(o => String(o.id) === String(selectedOfferId))

  // Timer
  useEffect(() => {
    const timer = setInterval(() => setCallDuration(prev => prev + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    let interval: any
    if (isRecording) interval = setInterval(() => setRecordingSeconds(s => s + 1), 1000)
    else setRecordingSeconds(0)
    return () => clearInterval(interval)
  }, [isRecording])

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600).toString().padStart(2, '0')
    const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')
    const secs = (seconds % 60).toString().padStart(2, '0')
    return `${hrs}:${mins}:${secs}`
  }

  const startRecording = async () => {
    try {
      chunksRef.current = []
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const tracks = [...displayStream.getVideoTracks(), ...displayStream.getAudioTracks(), ...micStream.getAudioTracks()]
      const combinedStream = new MediaStream(tracks)
      streamRef.current = combinedStream
      const recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm;codecs=vp9,opus' })
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.style.display = 'none'; a.href = url
        a.download = `Enregistrement_${contactName}_${new Date().toISOString().slice(0, 10)}.mp4`
        document.body.appendChild(a); a.click()
        combinedStream.getTracks().forEach(t => t.stop())
        displayStream.getTracks().forEach(t => t.stop())
        micStream.getTracks().forEach(t => t.stop())
      }
      displayStream.getVideoTracks()[0].onended = () => stopRecording()
      recorder.start(1000)
      mediaRecorderRef.current = recorder
      setIsRecording(true)
    } catch {
      alert("Impossible de lancer l'enregistrement.")
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const handleLeave = async () => {
    if (isRecording) { stopRecording(); await new Promise(r => setTimeout(r, 2000)) }
    let finalCallId = callIdRef.current

    if (finalCallId) {
      try {
        await supabase.from('business_call_history').update({
          duration: formatDuration(callDuration),
          notes,
        }).eq('id', finalCallId)
      } catch (e) { console.error('Erreur sauvegarde durée', e) }
    } else {
      const { data, error } = await supabase.from('business_call_history').insert({
        team_member_id: teamMember?.id || null,
        business_owner_id: ownerUserId || user?.id,
        contact_name: contactName,
        contact_id: prospectIdFromParams ? Number(prospectIdFromParams) : null,
        prospect_id: prospectIdFromParams ? Number(prospectIdFromParams) : null,
        duration: formatDuration(callDuration),
        notes,
        answered: true,
      }).select().single()
      if (error) {
        console.error('Erreur création appel:', error.message, error.details, error.hint)
      }
      if (data) finalCallId = data.id
    }

    if (finalCallId) {
      navigate(`/business/appels/${finalCallId}`, { state: { liveNotes: notes } })
    } else {
      navigate('/business/appels')
    }
  }

  return (
    <div className="flex h-screen w-screen bg-[#fbf9f8] dark:bg-neutral-900 text-stone-900 dark:text-white flex-col overflow-hidden relative" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* ─── TopAppBar ─── */}
      <header className="h-[72px] shrink-0 bg-white/80 dark:bg-white/5 backdrop-blur-xl shadow-[0_20px_40px_rgba(27,28,27,0.04)] px-8 flex items-center justify-between z-50 border-b border-stone-200/10 dark:border-neutral-800">
        <div className="flex items-center gap-6">
          <span className="font-extrabold text-xl tracking-tighter text-stone-900 dark:text-white">Closer Call Room</span>
          <div className="h-8 w-px bg-stone-200/30 dark:bg-neutral-700" />
          <div className="flex flex-col">
            <span className="text-sm font-extrabold tracking-tight text-stone-900 dark:text-white">{contactName}</span>
            <div className="flex items-center gap-2">
              {isRecording && (
                <>
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-400">Recording</span>
                  <span className="text-[10px] font-bold text-stone-500">•</span>
                </>
              )}
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-400">{formatDuration(callDuration)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {prospect && (
            <button onClick={() => setShowProspectView(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-stone-200/30 dark:border-neutral-700 text-sm font-semibold hover:bg-stone-50 dark:hover:bg-neutral-800 transition-all">
              <ExternalLink className="h-4 w-4" /> Fiche Prospect
            </button>
          )}
          <button onClick={isRecording ? stopRecording : startRecording}
            className={cn("flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all",
              isRecording ? 'bg-red-50 text-red-600 border border-red-200' : 'border border-stone-200/30 dark:border-neutral-700 text-stone-600 dark:text-neutral-300 hover:bg-stone-50 dark:hover:bg-neutral-800')}>
            {isRecording ? <><div className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />{formatDuration(recordingSeconds)}</> : <><div className="h-2.5 w-2.5 rounded-full bg-stone-400" />Enregistrer</>}
          </button>
          <button onClick={handleLeave}
            className="px-7 py-2.5 rounded-full bg-red-500 text-white text-sm font-bold shadow-lg shadow-red-500/20 hover:scale-95 active:scale-90 transition-transform">
            Fin d'appel
          </button>
          <button onClick={() => setIsPanelOpen(!isPanelOpen)}
            className="p-2.5 rounded-full hover:bg-stone-100 dark:hover:bg-neutral-800 transition-all">
            <Settings className="h-5 w-5 text-stone-500 dark:text-neutral-400" />
          </button>
        </div>
      </header>

      {/* ─── Main Cockpit ─── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ─── Left Panel (Script + Offer) ─── */}
        <section className={cn("transition-all duration-500 flex flex-col border-r border-stone-200/10 dark:border-neutral-800 bg-stone-50/30 dark:bg-neutral-900/50", isPanelOpen ? 'w-[40%]' : 'w-0 overflow-hidden opacity-0')}>

          {/* Upper: Script */}
          <div className="h-1/2 flex flex-col p-7 space-y-5 overflow-hidden">
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold text-2xl tracking-tight text-stone-900 dark:text-white">Script</h2>
              <div className="relative">
                <select value={selectedScriptId} onChange={(e) => setSelectedScriptId(e.target.value)}
                  className="appearance-none bg-white dark:bg-neutral-800 border-none rounded-full px-5 py-2 pr-10 text-xs font-bold shadow-sm focus:ring-2 focus:ring-emerald-600/20 cursor-pointer dark:text-white">
                  {scripts.map(s => <option key={s.id} value={s.id}>{s.title || 'Sans titre'}</option>)}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400 pointer-events-none" />
              </div>
            </div>
            <div className="flex-1 bg-white dark:bg-neutral-800 rounded-2xl p-7 overflow-y-auto no-scrollbar shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-stone-200/10 dark:border-neutral-700">
              <div className="space-y-7 max-w-prose">
                <div className="prose prose-sm max-w-none text-stone-800 dark:text-neutral-100 whitespace-pre-wrap leading-relaxed font-medium">{currentScriptContent}</div>
              </div>
            </div>
          </div>

          {/* Lower: Offer & Resources */}
          <div className="h-1/2 flex flex-col p-7 pt-0 space-y-5 overflow-hidden">
            <div className="flex items-center gap-5 border-b border-stone-200/10 dark:border-neutral-700">
              <button onClick={() => setActiveOfferTab('formulas')}
                className={cn("pb-3 text-sm font-bold border-b-2 transition-all", activeOfferTab === 'formulas' ? 'border-stone-900 dark:border-white text-stone-900 dark:text-white' : 'border-transparent text-stone-400 dark:text-neutral-500 hover:text-stone-600 dark:hover:text-neutral-300')}>
                Formules
              </button>
              <button onClick={() => setActiveOfferTab('notes')}
                className={cn("pb-3 text-sm font-semibold transition-all", activeOfferTab === 'notes' ? 'border-b-2 border-stone-900 dark:border-white text-stone-900 dark:text-white' : 'text-stone-400 dark:text-neutral-500 hover:text-stone-600 dark:hover:text-neutral-300')}>
                Closing Notes
              </button>
              <button onClick={() => setActiveOfferTab('resources')}
                className={cn("pb-3 text-sm font-semibold transition-all", activeOfferTab === 'resources' ? 'border-b-2 border-stone-900 dark:border-white text-stone-900 dark:text-white' : 'text-stone-400 dark:text-neutral-500 hover:text-stone-600 dark:hover:text-neutral-300')}>
                Ressources
              </button>

              {/* Offer selector */}
              {offers.length > 1 && (
                <div className="relative ml-auto">
                  <select value={selectedOfferId} onChange={(e) => setSelectedOfferId(e.target.value)}
                    className="appearance-none bg-white dark:bg-neutral-800 border-none rounded-full px-4 py-1.5 pr-8 text-xs font-bold shadow-sm focus:ring-2 focus:ring-emerald-600/20 cursor-pointer dark:text-white">
                    {offers.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-stone-400 pointer-events-none" />
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar space-y-3">
              {!currentOffer ? (
                <p className="text-sm text-stone-400 dark:text-neutral-500 text-center mt-10">Sélectionnez une offre pour voir les détails.</p>
              ) : (
                <>
                  {activeOfferTab === 'notes' && (
                    <div className="prose prose-sm max-w-none">
                      <p className="text-stone-600 whitespace-pre-wrap leading-relaxed">{currentOffer.notes || "Aucune note de closing."}</p>
                    </div>
                  )}

                  {activeOfferTab === 'formulas' && (
                    <div className="space-y-3">
                      {currentOffer.formulas && Array.isArray(currentOffer.formulas) && currentOffer.formulas.length > 0 ? (
                        currentOffer.formulas.map((formula: any, idx: number) => (
                          <div key={idx} className="bg-white p-5 rounded-2xl border border-stone-200/10 hover:border-emerald-200/50 transition-all cursor-pointer">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-extrabold text-sm text-stone-900 mb-1">{formula.name}</h4>
                                {formula.description && <p className="text-xs text-stone-500">{formula.description}</p>}
                              </div>
                              <span className="text-sm font-black text-emerald-700">{formula.price}€</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-stone-400">Aucune formule configurée.</p>
                      )}

                      {/* Generate PDF button */}
                      <div className="flex items-center justify-between p-4 bg-stone-900 text-white rounded-2xl mt-3 cursor-pointer hover:scale-[1.02] transition-transform">
                        <span className="text-[10px] font-bold tracking-[0.15em] uppercase">Générer PDF Proposition</span>
                        <Download className="h-4 w-4" />
                      </div>
                    </div>
                  )}

                  {activeOfferTab === 'resources' && (
                    <ul className="space-y-2">
                      {currentOffer.resources && Array.isArray(currentOffer.resources) && currentOffer.resources.length > 0 ? (
                        currentOffer.resources.map((res: any, idx: number) => (
                          <li key={idx}>
                            <a href={res.url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-2 p-4 rounded-2xl border border-stone-200/10 bg-white hover:border-emerald-200/50 transition-all group">
                              <ExternalLink className="h-3.5 w-3.5 text-emerald-600 group-hover:text-emerald-700" />
                              <span className="text-sm text-stone-600 group-hover:text-emerald-700 font-medium">{res.title || res.url}</span>
                            </a>
                          </li>
                        ))
                      ) : (
                        <p className="text-sm text-stone-400">Aucune ressource disponible.</p>
                      )}
                    </ul>
                  )}
                </>
              )}
            </div>
          </div>
        </section>

        {/* ─── Right Panel (Notes) ─── */}
        <section className="flex-1 flex flex-col p-7 bg-white relative">
          {/* Notepad Header */}
          <div className="flex items-center justify-between mb-7">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-stone-900">Prise de notes</h3>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-tight">Sauvegarde auto</span>
                </div>
              </div>
              {/* Previous note tabs */}
              <div className="flex items-center gap-2">
                {previousNotes.length > 0 && (
                  <>
                    <button
                      onClick={() => setSelectedPreviousNote('')}
                      className={cn(
                        'px-4 py-1.5 rounded-full text-[10px] font-bold transition-all',
                        !selectedPreviousNote ? 'bg-stone-200 text-stone-900' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                      )}
                    >
                      Notes actuelles
                    </button>
                    {previousNotes.map((n: any) => (
                      <button
                        key={n.id}
                        onClick={() => setSelectedPreviousNote(n.id)}
                        className={cn(
                          'px-4 py-1.5 rounded-full text-[10px] font-bold transition-all',
                          selectedPreviousNote === n.id ? 'bg-stone-200 text-stone-900' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                        )}
                      >
                        {new Date(n.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button className="p-2 rounded-full hover:bg-stone-100 transition-all"><Bold className="h-4 w-4 text-stone-500" /></button>
              <button className="p-2 rounded-full hover:bg-stone-100 transition-all"><List className="h-4 w-4 text-stone-500" /></button>
              <button className="p-2 rounded-full hover:bg-stone-100 transition-all ml-1"><Share2 className="h-4 w-4 text-stone-500" /></button>
            </div>
          </div>

          {/* Editor */}
          <div className="flex-1 flex flex-col relative">
            {selectedPreviousNote ? (
              <div className="flex-1 overflow-y-auto text-lg leading-relaxed text-stone-600 whitespace-pre-wrap font-medium">
                {previousNotes.find((n: any) => n.id === selectedPreviousNote)?.content || 'Aucune note'}
              </div>
            ) : (
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Prise de notes..."
                className="flex-1 w-full bg-transparent border-none focus:ring-0 text-lg leading-relaxed font-medium placeholder:text-stone-300/40 resize-none p-0 focus:outline-none"
                autoFocus />
            )}

            {/* Floating action bar */}
            <div className="absolute bottom-4 right-0 glass-card p-2 rounded-2xl border border-stone-200/20 shadow-xl flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(16px)' }}>
              <button className="flex items-center gap-2 px-5 py-3 bg-stone-900 text-white rounded-xl text-sm font-bold hover:bg-stone-800 transition-all">
                <Zap className="h-4 w-4" style={{ fill: 'currentColor' }} />
                AI Summary
              </button>
              <div className="h-8 w-px bg-stone-200/30 mx-1" />
              <button className="p-3 text-stone-500 hover:text-stone-900 transition-all">
                <Mic className="h-5 w-5" />
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Visual accents */}
      <div className="fixed top-0 right-0 -z-10 w-1/2 h-full bg-gradient-to-l from-stone-100/50 to-transparent pointer-events-none" />
      <div className="fixed -bottom-24 -left-24 w-96 h-96 bg-emerald-700/5 blur-[120px] rounded-full -z-10" />
      <div className="fixed top-1/4 left-1/4 w-64 h-64 bg-amber-400/10 blur-[100px] rounded-full -z-10" />

      {/* Prospect View Modal */}
      {showProspectView && prospect && (
        <BusinessProspectView
          prospect={prospect}
          onClose={() => setShowProspectView(false)}
          onUpdate={updateProspect}
          onDelete={deleteProspect}
        />
      )}
    </div>
  )
}
