import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Monitor, PhoneOff, ChevronDown, ExternalLink, FileText,
  Briefcase, BookOpen, ScrollText, Tag, User, Clock,
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

  // Previous call notes
  const [previousNotes, setPreviousNotes] = useState<{ id: string; date: string; notes: string }[]>([])
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

  // Load previous call notes for this prospect
  useEffect(() => {
    if (!prospectIdFromParams) return
    const pid = Number(prospectIdFromParams)
    supabase
      .from('business_call_history')
      .select('id, created_at, notes')
      .or(`prospect_id.eq.${pid},contact_id.eq.${pid}`)
      .not('notes', 'is', null)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setPreviousNotes(data.filter(d => d.notes?.trim()).map(d => ({ id: String(d.id), date: d.created_at, notes: d.notes })))
      })
  }, [prospectIdFromParams])

  // Load scripts + offers
  useEffect(() => {
    if (!teamMember?.id || !ownerUserId) return
    let mounted = true

    async function loadData() {
      // Load scripts
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

      // Load offers from org
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
        // fallback: try supabase directly
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
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0')
    const secs = (seconds % 60).toString().padStart(2, '0')
    return `${mins}:${secs}`
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
      // Create a call record if none exists
      try {
        const { data } = await supabase.from('business_call_history').insert({
          team_member_id: teamMember?.id || null,
          business_owner_id: ownerUserId || user?.id,
          contact_name: contactName,
          contact_id: prospectIdFromParams ? Number(prospectIdFromParams) : null,
          prospect_id: prospectIdFromParams ? Number(prospectIdFromParams) : null,
          duration: formatDuration(callDuration),
          notes,
          answered: true,
        }).select().single()
        if (data) finalCallId = data.id
      } catch (e) { console.error('Erreur création appel', e) }
    }

    if (finalCallId) {
      navigate(`/business/appels/${finalCallId}`, { state: { liveNotes: notes } })
    } else {
      navigate('/business/appels')
    }
  }

  return (
    <div className="flex h-screen w-screen bg-[#FDF6EE] text-slate-900 flex-col font-sans overflow-hidden relative">
      {/* Header */}
      <div className="h-16 shrink-0 border-b border-amber-200 bg-white px-6 flex items-center justify-between shadow-sm z-50">
        <div className="flex items-center gap-4">
          <div className="bg-amber-100 text-amber-700 p-2 rounded-lg">
            <Monitor className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg">{contactName}</h1>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
              <div className="flex items-center gap-1.5 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="font-medium text-emerald-600">En ligne</span>
              </div>
              <span className="text-slate-400">|</span>
              <span className="font-mono text-slate-700 font-medium tracking-wide">{formatDuration(callDuration)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {prospect && (
            <button onClick={() => setShowProspectView(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-sm font-medium text-purple-700">
              <User className="h-4 w-4" /> Fiche Prospect
            </button>
          )}
          <button onClick={() => window.open('https://meet.google.com', '_blank')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium">
            <ExternalLink className="h-4 w-4" /> Meet
          </button>
          <button onClick={isRecording ? stopRecording : startRecording}
            className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold",
              isRecording ? 'bg-red-50 text-red-600 border border-red-200 animate-pulse' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200')}>
            {isRecording ? <><div className="h-3 w-3 rounded-full bg-red-500"></div>{formatDuration(recordingSeconds)}</> : <><div className="h-3 w-3 rounded-full bg-slate-400"></div>Enregistrer</>}
          </button>
          <button onClick={() => setIsPanelOpen(!isPanelOpen)}
            className={cn("flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium",
              isPanelOpen ? 'bg-amber-600 border-amber-600 text-white' : 'border-slate-200 hover:bg-slate-50')}>
            <FileText className="h-4 w-4" /> Panneau
          </button>
          <div className="h-8 w-px bg-slate-200 mx-2"></div>
          <button onClick={handleLeave}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-sm">
            <PhoneOff className="h-4 w-4" /> Fin
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel (Script + Offer) */}
        <div className={cn("transition-all duration-300 border-r border-amber-200 bg-white flex flex-col", isPanelOpen ? 'w-5/12' : 'w-0 overflow-hidden opacity-0')}>

          {/* Top half: Script */}
          <div className="h-1/2 flex flex-col border-b border-amber-200">
            <div className="p-3 border-b border-amber-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-600" />
                <span className="text-xs font-bold text-amber-700 tracking-wider">SCRIPT</span>
              </div>
              <div className="relative">
                <select value={selectedScriptId} onChange={(e) => setSelectedScriptId(e.target.value)}
                  className="appearance-none bg-amber-50 border border-amber-200 text-sm rounded-md px-3 py-1.5 pr-8 focus:outline-none focus:border-amber-500 cursor-pointer min-w-[150px]">
                  {scripts.map(s => <option key={s.id} value={s.id}>{s.title || 'Sans titre'}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="prose prose-sm max-w-none text-slate-600 whitespace-pre-wrap leading-relaxed">{currentScriptContent}</div>
            </div>
          </div>

          {/* Bottom half: Offer & Resources */}
          <div className="h-1/2 flex flex-col bg-amber-50/30">
            <div className="p-3 border-b border-amber-100 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-purple-600" />
                  <span className="text-xs font-bold text-purple-700 tracking-wider">OFFRE & RESSOURCES</span>
                </div>
                <div className="relative">
                  <select value={selectedOfferId} onChange={(e) => setSelectedOfferId(e.target.value)}
                    className="appearance-none bg-purple-50 border border-purple-200 text-sm rounded-md px-3 py-1.5 pr-8 focus:outline-none focus:border-purple-500 cursor-pointer min-w-[150px]">
                    {offers.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Offer tabs */}
              <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                <button onClick={() => setActiveOfferTab('notes')}
                  className={cn("flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5",
                    activeOfferTab === 'notes' ? "bg-purple-600 text-white shadow" : "text-slate-500 hover:text-slate-700 hover:bg-white")}>
                  <ScrollText className="h-3 w-3" /> Notes Closing
                </button>
                <button onClick={() => setActiveOfferTab('formulas')}
                  className={cn("flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5",
                    activeOfferTab === 'formulas' ? "bg-purple-600 text-white shadow" : "text-slate-500 hover:text-slate-700 hover:bg-white")}>
                  <Tag className="h-3 w-3" /> Formules
                </button>
                <button onClick={() => setActiveOfferTab('resources')}
                  className={cn("flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5",
                    activeOfferTab === 'resources' ? "bg-purple-600 text-white shadow" : "text-slate-500 hover:text-slate-700 hover:bg-white")}>
                  <BookOpen className="h-3 w-3" /> Ressources
                </button>
              </div>
            </div>

            {/* Offer content */}
            <div className="flex-1 overflow-y-auto p-4">
              {!currentOffer ? (
                <p className="text-sm text-slate-400 text-center mt-10">Sélectionnez une offre pour voir les détails.</p>
              ) : (
                <>
                  {activeOfferTab === 'notes' && (
                    <div className="prose prose-sm max-w-none">
                      <p className="text-slate-600 whitespace-pre-wrap">{currentOffer.notes || "Aucune note de closing."}</p>
                    </div>
                  )}

                  {activeOfferTab === 'formulas' && (
                    <div className="space-y-3">
                      {currentOffer.formulas && Array.isArray(currentOffer.formulas) && currentOffer.formulas.length > 0 ? (
                        currentOffer.formulas.map((formula: any, idx: number) => (
                          <div key={idx} className="p-3 rounded-lg border border-slate-200 bg-white flex justify-between items-center">
                            <div>
                              <p className="font-semibold text-slate-900 text-sm">{formula.name}</p>
                              {formula.description && <p className="text-xs text-slate-500 mt-0.5">{formula.description}</p>}
                            </div>
                            <span className="text-emerald-600 font-bold text-sm">{formula.price}€</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-400">Aucune formule configurée.</p>
                      )}
                    </div>
                  )}

                  {activeOfferTab === 'resources' && (
                    <ul className="space-y-2">
                      {currentOffer.resources && Array.isArray(currentOffer.resources) && currentOffer.resources.length > 0 ? (
                        currentOffer.resources.map((res: any, idx: number) => (
                          <li key={idx}>
                            <a href={res.url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-white hover:bg-purple-50 hover:border-purple-200 transition-all group">
                              <ExternalLink className="h-3.5 w-3.5 text-purple-500 group-hover:text-purple-700" />
                              <span className="text-sm text-slate-600 group-hover:text-purple-700 group-hover:underline decoration-purple-500 underline-offset-4">{res.title || res.url}</span>
                            </a>
                          </li>
                        ))
                      ) : (
                        <p className="text-sm text-slate-400">Aucune ressource disponible.</p>
                      )}
                    </ul>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Notes Panel */}
        <div className="flex-1 flex flex-col bg-amber-50/30 border-l border-amber-200">
          <div className="p-4 border-b border-amber-100 flex justify-between items-center">
            <h3 className="font-bold text-slate-500 text-sm tracking-wider flex items-center gap-2">
              <FileText className="h-4 w-4" /> PRISE DE NOTES
            </h3>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-xs text-slate-400">Sauvegarde auto</span>
            </div>
          </div>

          {/* Previous notes tabs */}
          {previousNotes.length > 0 && (
            <div className="px-4 pt-3 pb-2 border-b border-amber-100 flex gap-2 flex-wrap">
              <button
                onClick={() => setSelectedPreviousNote('')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  !selectedPreviousNote ? 'bg-amber-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                )}
              >
                Notes actuelles
              </button>
              {previousNotes.map(n => (
                <button
                  key={n.id}
                  onClick={() => setSelectedPreviousNote(n.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5',
                    selectedPreviousNote === n.id ? 'bg-purple-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  )}
                >
                  <Clock className="h-3 w-3" />
                  {new Date(n.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </button>
              ))}
            </div>
          )}

          {selectedPreviousNote ? (
            <div className="flex-1 overflow-y-auto p-8 text-slate-600 text-lg leading-relaxed whitespace-pre-wrap">
              {previousNotes.find(n => n.id === selectedPreviousNote)?.notes || 'Aucune note'}
            </div>
          ) : (
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Commencez à écrire vos notes ici... (Situation actuelle, Douleurs, Objectifs, Budget...)"
              className="flex-1 w-full bg-transparent p-8 text-slate-800 placeholder-slate-300 resize-none focus:outline-none text-lg leading-relaxed"
              autoFocus />
          )}
        </div>
      </div>

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
