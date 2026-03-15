import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Monitor, PhoneOff, ChevronDown, ExternalLink, FileText,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { cn } from '../../lib/utils'

interface Script {
  id: number | string
  title: string
  content: string
}

export function CloserCallRoom() {
  const { teamMember } = useBusinessAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const callIdFromParams = searchParams.get('id')
  const contactName = searchParams.get('name') || 'Appel'
  const callIdRef = useRef<string | null>(callIdFromParams)

  const [isPanelOpen, setIsPanelOpen] = useState(true)
  const [notes, setNotes] = useState('')
  const [callDuration, setCallDuration] = useState(0)

  // Scripts
  const [scripts, setScripts] = useState<Script[]>([])
  const [selectedScriptId, setSelectedScriptId] = useState<string | number>('')
  const [currentScriptContent, setCurrentScriptContent] = useState('Chargement...')

  // Recording
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  // Load scripts
  useEffect(() => {
    if (!teamMember?.id) return
    let mounted = true
    supabase
      .from('business_user_scripts')
      .select('*')
      .eq('team_member_id', teamMember.id)
      .order('id')
      .then(({ data }) => {
        if (!mounted) return
        if (data && data.length > 0) {
          setScripts(data)
          setSelectedScriptId(data[0].id)
          setCurrentScriptContent(data[0].content)
        } else {
          setCurrentScriptContent('Aucun script trouvé.')
        }
      })
    return () => { mounted = false }
  }, [teamMember?.id])

  useEffect(() => {
    if (selectedScriptId) {
      const s = scripts.find(s => String(s.id) === String(selectedScriptId))
      if (s) setCurrentScriptContent(s.content)
    }
  }, [selectedScriptId, scripts])

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
    const finalCallId = callIdRef.current
    if (finalCallId) {
      try {
        await supabase.from('business_call_history').update({
          duration: formatDuration(callDuration),
        }).eq('id', finalCallId)
      } catch (e) { console.error('Erreur sauvegarde durée', e) }
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
            <FileText className="h-4 w-4" /> Script
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
        {/* Script Panel */}
        <div className={cn("transition-all duration-300 border-r border-amber-200 bg-white flex flex-col", isPanelOpen ? 'w-5/12' : 'w-0 overflow-hidden opacity-0')}>
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
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Commencez à écrire vos notes ici..."
            className="flex-1 w-full bg-transparent p-8 text-slate-800 placeholder-slate-300 resize-none focus:outline-none text-lg leading-relaxed"
            autoFocus />
        </div>
      </div>
    </div>
  )
}
