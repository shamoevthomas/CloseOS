import { useState, useRef, useEffect } from 'react'
import {
  X,
  PhoneOff,
  Maximize2,
  Minimize2,
  FileText,
  ExternalLink,
  Save,
  Clock,
  Mic,
  Layout,
  ChevronRight,
  ChevronLeft
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useLanguage } from '../contexts/LanguageContext'
import { videoCallTranslations } from '../i18n/translations'

interface VideoCallOverlayProps {
  isOpen: boolean
  onClose: () => void
  onCallEnd: (wasAiActive: boolean, wasAnswered: boolean) => void
  prospectName: string
  prospectAvatar?: string
  initialAiEnabled?: boolean
  meetLink?: string
}

export function VideoCallOverlay({
  isOpen,
  onClose,
  onCallEnd,
  prospectName,
  prospectAvatar,
  initialAiEnabled = false,
  meetLink = "https://meet.google.com/new"
}: VideoCallOverlayProps) {
  const { lang } = useLanguage()
  const t = videoCallTranslations[lang]
  const [isMinimized, setIsMinimized] = useState(false)
  const [showScript, setShowScript] = useState(true)
  const [duration, setDuration] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [notes, setNotes] = useState('')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const [chunks, setChunks] = useState<Blob[]>([])
  
  // Timer
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isOpen) {
      interval = setInterval(() => {
        setDuration((prev) => prev + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isOpen])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Enregistrement de l'onglet (Google Meet)
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      })

      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) setChunks((prev) => [...prev, e.data])
      }

      recorder.start()
      setIsRecording(true)

      stream.getVideoTracks()[0].onended = () => stopRecording()
    } catch (err) {
      console.error("Erreur enregistrement:", err)
      alert(lang === 'fr' ? "Enregistrement annulé." : "Recording cancelled.")
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const handleHangup = () => {
    if (isRecording) stopRecording()
    onCallEnd(initialAiEnabled, true) 
  }

  if (!isOpen) return null

  // Mode Réduit (Mini-player)
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-[100] flex items-center gap-4 rounded-full bg-white/[0.03] backdrop-blur-2xl px-4 py-3 shadow-2xl ring-1 ring-white/[0.08] animate-in fade-in slide-in-from-bottom-4">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          <span className="font-mono font-medium text-white">{formatTime(duration)}</span>
        </div>
        <div className="h-4 w-px bg-white/[0.08]" />
        <span className="text-sm font-bold text-white">{prospectName}</span>
        <button onClick={() => setIsMinimized(false)} className="rounded-full bg-white/5 p-1.5 hover:bg-white/10 text-white">
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#111111]">
      {/* --- TOP BAR (COMMANDES) --- */}
      <div className="flex h-16 items-center justify-between border-b border-white/[0.08] bg-white/[0.03] backdrop-blur-2xl px-6 shadow-md">
        
        {/* Info Prospect */}
        <div className="flex items-center gap-4 w-1/3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-purple-600 text-lg font-bold text-white shadow-lg">
            {prospectAvatar || prospectName.charAt(0)}
          </div>
          <div>
            <h3 className="font-bold text-white text-base">{prospectName}</h3>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 animate-pulse rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <span className="font-mono text-xs font-medium text-emerald-400">{formatTime(duration)} • En ligne</span>
            </div>
          </div>
        </div>

        {/* ACTIONS CENTRALES */}
        <div className="flex items-center justify-center gap-4 w-1/3">
           {/* Ouvrir Meet (au cas où on le perd) */}
           <button 
            onClick={() => window.open(meetLink, '_blank')}
            className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/60 transition-all hover:bg-white/10 hover:text-white"
            title="Rouvrir l'onglet Google Meet"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Meet
          </button>

          {/* Enregistrement */}
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={cn(
              "flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold transition-all shadow-lg",
              isRecording 
                ? "bg-red-500/10 text-red-400 border border-red-500/50 animate-pulse" 
                : "bg-white/10 text-white/80 hover:bg-white/5 border border-transparent"
            )}
          >
            <div className={cn("h-2.5 w-2.5 rounded-full", isRecording ? "bg-red-500" : "bg-red-500")} />
            {isRecording ? "REC (00:00)" : "Enregistrer l'écran"}
          </button>
        </div>

        {/* ACTIONS DROITE */}
        <div className="flex items-center justify-end gap-3 w-1/3">
          <button 
            onClick={() => setShowScript(!showScript)} 
            className={cn("flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors", showScript ? "bg-emerald-500 text-black" : "bg-white/[0.03] border border-white/[0.08] text-white/40 hover:text-white")}
          >
            <FileText className="h-4 w-4" /> Script
          </button>
          <button onClick={() => setIsMinimized(true)} className="rounded-full p-2 text-white/40 hover:bg-white/10 hover:text-white">
            <Minimize2 className="h-5 w-5" />
          </button>
          <button 
            onClick={handleHangup}
            className="flex items-center gap-2 rounded-full bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-600 shadow-lg shadow-red-900/20 ml-2"
          >
            <PhoneOff className="h-4 w-4" />
            Fin
          </button>
        </div>
      </div>

      {/* --- MAIN CONTENT (COCKPIT) --- */}
      <div className="flex flex-1 overflow-hidden bg-[#111111]">
        
        {/* COLONNE GAUCHE : SCRIPT DE VENTE */}
        <div className={cn("flex flex-col border-r border-white/[0.08] transition-all duration-300", showScript ? "w-[60%]" : "w-0 opacity-0 overflow-hidden")}>
          <div className="flex items-center justify-between border-b border-white/[0.08] bg-white/[0.03] px-6 py-3">
            <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-2">
              <FileText className="h-4 w-4" /> Script de Vente
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <div className="mx-auto max-w-3xl space-y-8">
              {/* Introduction */}
              <div className="relative rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-2xl p-6 shadow-lg">
                <div className="absolute -left-3 top-6 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-black shadow-lg ring-4 ring-[#111111]">1</div>
                <h4 className="mb-4 ml-4 text-sm font-bold text-white/40 uppercase">Introduction & Cadre</h4>
                <div className="ml-4 space-y-4 text-lg text-white/60 leading-relaxed">
                  <p>
                    "Bonjour <span className="font-bold text-emerald-400">{prospectName}</span>, enchanté. Merci de prendre ce temps."
                  </p>
                  <p>
                    "L'objectif est simple : voir si on peut vous aider à atteindre [OBJECTIF]. Si oui, on verra comment avancer. Si non, je vous redirigerai vers la meilleure solution. Ça vous va ?"
                  </p>
                </div>
              </div>

              {/* Découverte */}
              <div className="relative rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-2xl p-6 shadow-lg">
                <div className="absolute -left-3 top-6 flex h-6 w-6 items-center justify-center rounded-full bg-purple-500 text-xs font-bold text-white shadow-lg ring-4 ring-[#111111]">2</div>
                <h4 className="mb-4 ml-4 text-sm font-bold text-white/40 uppercase">Phase de Découverte</h4>
                <ul className="ml-4 space-y-6">
                  <li className="p-3 rounded-xl bg-white/5 border border-white/[0.08] hover:border-purple-500/50 transition-colors cursor-default">
                    <p className="text-white/60 font-medium">"Racontez-moi un peu votre situation actuelle..."</p>
                  </li>
                  <li className="p-3 rounded-xl bg-white/5 border border-white/[0.08] hover:border-purple-500/50 transition-colors cursor-default">
                    <p className="text-white/60 font-medium">"Qu'est-ce qui vous a motivé à réserver cet appel *maintenant* ?"</p>
                  </li>
                  <li className="p-3 rounded-xl bg-white/5 border border-white/[0.08] hover:border-purple-500/50 transition-colors cursor-default">
                    <p className="text-white/60 font-medium">"Si vous aviez une baguette magique, à quoi ressemblerait votre situation idéale dans 6 mois ?"</p>
                  </li>
                </ul>
              </div>

              {/* Closing */}
              <div className="relative rounded-2xl border border-emerald-500/30 bg-emerald-950/10 p-6 shadow-lg">
                <div className="absolute -left-3 top-6 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-black shadow-lg ring-4 ring-[#111111]">3</div>
                <h4 className="mb-4 ml-4 text-sm font-bold text-emerald-400 uppercase">Transition & Offre</h4>
                <div className="ml-4 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-emerald-200 font-medium italic">
                    "Écoutez {prospectName}, d'après ce que vous me dites, je suis convaincu qu'on peut vous aider. Laissez-moi vous expliquer comment..."
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* COLONNE DROITE : NOTES (Toujours visible) */}
        <div className="flex-1 flex flex-col bg-[#111111]">
          <div className="flex items-center justify-between border-b border-white/[0.08] bg-white/[0.03] px-6 py-3">
            <h3 className="text-sm font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
              <FileText className="h-4 w-4" /> Prise de Notes
            </h3>
            <span className="text-[10px] text-white/40">Sauvegarde auto</span>
          </div>
          
          <div className="flex-1 p-6">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Commencez à écrire vos notes ici... (Situation actuelle, Douleurs, Objectifs, Budget...)"
              className="h-full w-full resize-none rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-2xl p-6 text-base text-white/60 placeholder:text-white/30 focus:border-emerald-500 focus:outline-none shadow-inner leading-relaxed"
              spellCheck={false}
            />
          </div>
        </div>

      </div>
    </div>
  )
}