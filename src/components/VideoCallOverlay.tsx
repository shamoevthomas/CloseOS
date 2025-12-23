import { useState, useEffect } from 'react'
import { Mic, MicOff, Video, VideoOff, Phone, CircleDot, Sparkles, X } from 'lucide-react'
import { cn } from '../lib/utils'

interface VideoCallOverlayProps {
  isOpen: boolean
  onClose: () => void
  onCallEnd: (wasAiActive: boolean, wasAnswered: boolean) => void
  prospectName: string
  prospectAvatar?: string
  initialAiEnabled?: boolean
}

type CallStatus = 'ringing' | 'connected'

export function VideoCallOverlay({ isOpen, onClose, onCallEnd, prospectName, prospectAvatar, initialAiEnabled = false }: VideoCallOverlayProps) {
  const [callStatus, setCallStatus] = useState<CallStatus>('ringing')
  const [callDuration, setCallDuration] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [isAiActive, setIsAiActive] = useState(initialAiEnabled)
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [wasAnswered, setWasAnswered] = useState(false)

  // Simulate call connection after 3 seconds
  useEffect(() => {
    if (isOpen) {
      // Initialiser l'état de l'IA avec la valeur initiale
      setIsAiActive(initialAiEnabled)

      const timer = setTimeout(() => {
        setCallStatus('connected')
        setWasAnswered(true) // Marquer comme décroché quand connecté
      }, 3000)

      return () => clearTimeout(timer)
    } else {
      // Reset when closing
      setCallStatus('ringing')
      setCallDuration(0)
      setIsRecording(false)
      setIsAiActive(initialAiEnabled)
      setIsMuted(false)
      setIsCameraOff(false)
      setWasAnswered(false)
    }
  }, [isOpen, initialAiEnabled])

  // Call duration timer
  useEffect(() => {
    if (callStatus === 'connected') {
      const interval = setInterval(() => {
        setCallDuration(prev => prev + 1)
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [callStatus])

  // Format duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleRecordingToggle = () => {
    setIsRecording(!isRecording)
    showNotification(isRecording ? 'Enregistrement arrêté' : 'Enregistrement démarré')
  }

  const showNotification = (message: string) => {
    setToastMessage(message)
    setShowToast(true)
    setTimeout(() => setShowToast(false), 2000)
  }

  const handleHangUp = () => {
    // Notifier le parent avec l'état de l'IA et si l'appel a été décroché
    // Le parent décidera d'afficher le toast, le modal ou la modale "pas de réponse"
    onCallEnd(isAiActive, wasAnswered)

    // Fermer l'overlay
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl">
      {/* Main Container */}
      <div className="relative h-full w-full flex flex-col">

        {/* HEADER */}
        <header className="flex items-center justify-between px-8 py-6 border-b border-slate-800/50">
          {/* Left: Prospect Info */}
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">{prospectName}</h2>
              <p className="text-sm text-slate-400">
                {callStatus === 'ringing' ? 'Connexion...' : formatDuration(callDuration)}
              </p>
            </div>
          </div>

          {/* Right: Tools */}
          <div className="flex items-center gap-3">
            {/* Recording Button */}
            <button
              onClick={handleRecordingToggle}
              className={cn(
                'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all',
                isRecording
                  ? 'bg-red-500/20 text-red-500 border border-red-500/30 animate-pulse'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300 border border-slate-700'
              )}
            >
              <CircleDot className={cn('h-4 w-4', isRecording && 'fill-red-500')} />
              {isRecording && <span className="font-bold">REC</span>}
            </button>

            {/* AI Assistant Indicator (read-only) */}
            {isAiActive && (
              <div className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-lg shadow-purple-500/20">
                <Sparkles className="h-4 w-4 animate-pulse" />
                <span>IA Assistant Activé</span>
              </div>
            )}

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* CENTER: Video Area */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            {/* Avatar with pulse animation */}
            <div className="relative mb-6">
              <div className={cn(
                'absolute inset-0 rounded-full blur-2xl',
                callStatus === 'connected' && 'animate-pulse bg-blue-500/30'
              )} />
              <div className={cn(
                'relative h-48 w-48 mx-auto rounded-full flex items-center justify-center text-6xl font-bold',
                'bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-2xl',
                callStatus === 'connected' && 'ring-4 ring-blue-500/50 ring-offset-8 ring-offset-black'
              )}>
                {prospectAvatar || prospectName.charAt(0).toUpperCase()}
              </div>

              {/* Voice Activity Indicator */}
              {callStatus === 'connected' && (
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                  <div className="flex gap-1 items-end h-8 px-3 py-2 bg-slate-800/80 backdrop-blur-sm rounded-full border border-slate-700">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className="w-1 bg-green-500 rounded-full animate-pulse"
                        style={{
                          height: `${Math.random() * 16 + 8}px`,
                          animationDelay: `${i * 0.1}s`
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Status Text */}
            <p className="text-lg text-slate-300 font-medium">
              {callStatus === 'ringing' ? 'Appel en cours...' : 'Appel connecté'}
            </p>
            <p className="text-sm text-slate-500 mt-1">
              {callStatus === 'ringing' ? 'Veuillez patienter' : 'Communication établie'}
            </p>
          </div>
        </div>

        {/* FOOTER: Controls */}
        <footer className="flex justify-center pb-12">
          <div className="flex items-center gap-6 px-8 py-4 bg-slate-900/80 backdrop-blur-xl rounded-full border border-slate-700/50 shadow-2xl">

            {/* Microphone */}
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={cn(
                'group relative flex items-center justify-center h-16 w-16 rounded-full transition-all',
                isMuted
                  ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/50'
                  : 'bg-slate-800 hover:bg-slate-700 border border-slate-700'
              )}
            >
              {isMuted ? (
                <MicOff className="h-6 w-6 text-white" />
              ) : (
                <Mic className="h-6 w-6 text-slate-300 group-hover:text-white" />
              )}
              <span className="absolute -top-8 text-xs text-slate-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                {isMuted ? 'Activer micro' : 'Couper micro'}
              </span>
            </button>

            {/* Camera */}
            <button
              onClick={() => setIsCameraOff(!isCameraOff)}
              className={cn(
                'group relative flex items-center justify-center h-16 w-16 rounded-full transition-all',
                isCameraOff
                  ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/50'
                  : 'bg-slate-800 hover:bg-slate-700 border border-slate-700'
              )}
            >
              {isCameraOff ? (
                <VideoOff className="h-6 w-6 text-white" />
              ) : (
                <Video className="h-6 w-6 text-slate-300 group-hover:text-white" />
              )}
              <span className="absolute -top-8 text-xs text-slate-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                {isCameraOff ? 'Activer caméra' : 'Couper caméra'}
              </span>
            </button>

            {/* Hang Up */}
            <button
              onClick={handleHangUp}
              className="group relative flex items-center justify-center h-16 w-16 rounded-full bg-red-500 hover:bg-red-600 transition-all shadow-lg shadow-red-500/50 hover:shadow-red-500/70 hover:scale-110"
            >
              <Phone className="h-6 w-6 text-white rotate-[135deg]" />
              <span className="absolute -top-8 text-xs text-slate-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                Raccrocher
              </span>
            </button>

          </div>
        </footer>

        {/* Toast Notification */}
        {showToast && (
          <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[60]">
            <div className="flex items-center gap-2 px-6 py-3 bg-slate-800 border border-slate-700 rounded-full shadow-2xl backdrop-blur-sm animate-in slide-in-from-top-5 duration-300">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <p className="text-sm font-medium text-white">{toastMessage}</p>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
