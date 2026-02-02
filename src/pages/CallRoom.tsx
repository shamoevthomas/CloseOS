import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import DailyIframe from '@daily-co/daily-js';
import {
  Mic, MicOff, Video, VideoOff,
  Monitor, PhoneOff, Maximize, Minimize,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function CallRoom() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const url = searchParams.get('url');
  const callId = searchParams.get('id');

  // Refs DOM et Daily
  const containerRef = useRef<HTMLDivElement>(null);
  const callFrameRef = useRef<any>(null);
  const startTimeRef = useRef<number | null>(null);

  // UI State
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isScriptOpen, setIsScriptOpen] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const timeoutRef = useRef<number | null>(null);

  // --- RECORDING STATE ---
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  
  // Refs pour l'enregistrement
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const [userScript, setUserScript] = useState(`Chargement du script...`);

  // --- 1. TIMER SIMPLE ET EFFICACE ---
  useEffect(() => {
    let interval: any;
    if (isRecording) {
      // On incrémente simplement de 1 chaque seconde (plus robuste que les dates)
      interval = setInterval(() => {
        setRecordingSeconds(s => s + 1);
      }, 1000);
    } else {
      setRecordingSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // --- 2. SCRIPT ---
  useEffect(() => {
    const fetchScript = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from('user_scripts').select('content').eq('user_id', user.id).single();
        if (data) setUserScript(data.content);
      } catch (e) { /* ignore */ }
    };
    fetchScript();
  }, []);

  // --- 3. AUTO-HIDE CONTROLS ---
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setShowControls(false), 5000);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // --- 4. DAILY IFRAME SETUP ---
  useEffect(() => {
    if (!url || !containerRef.current) return;

    const initCall = async () => {
      if (DailyIframe.getCallInstance()) await DailyIframe.getCallInstance()?.destroy();

      const frame = DailyIframe.createFrame(containerRef.current!, {
        iframeStyle: { width: '100%', height: '100%', border: '0' },
        showLeaveButton: false,
        showFullscreenButton: false,
        theme: { colors: { accent: '#E54D2E', background: '#1F2937' } }
      });

      await frame.join({ url });
      callFrameRef.current = frame;
      startTimeRef.current = Date.now();
    };
    initCall();
    return () => { DailyIframe.getCallInstance()?.destroy(); };
  }, [url]);

  // --- 5. FONCTIONS D'ENREGISTREMENT (Simplified) ---

  const downloadVideo = () => {
    const blob = new Blob(chunksRef.current, { type: 'video/webm' });
    console.log("💾 Tentative de téléchargement. Taille du fichier :", blob.size);
    
    if (blob.size === 0) {
        alert("L'enregistrement semble vide. Vérifiez que vous avez bien partagé votre écran.");
        return;
    }

    const fileUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = fileUrl;
    // On force l'extension .mp4 comme demandé (le contenu reste compatible web)
    const fileName = `Enregistrement_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.mp4`;
    a.download = fileName;
    
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(fileUrl);
    }, 200);
  };

  const startRecording = async () => {
    try {
      console.log("🎥 Démarrage de l'enregistrement...");
      chunksRef.current = []; // Reset

      // 1. Capture Écran + Audio Système
      // IMPORTANT: Cochez "Partager l'audio système" dans la popup du navigateur !
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true 
      });

      // 2. Capture Micro
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });

      // 3. Combinaison simple des pistes (Sans AudioContext complexe qui peut planter)
      // On prend la vidéo de l'écran, l'audio de l'écran, et l'audio du micro.
      const tracks = [
        ...displayStream.getVideoTracks(),
        ...displayStream.getAudioTracks(),
        ...micStream.getAudioTracks()
      ];

      const combinedStream = new MediaStream(tracks);
      streamRef.current = combinedStream;

      // 4. Configuration Recorder
      // On utilise WebM en interne (le plus sûr) mais on sauvegardera en .mp4
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
        ? 'video/webm;codecs=vp9' 
        : 'video/webm';

      const recorder = new MediaRecorder(combinedStream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        console.log("🛑 Arrêt enregistreur. Génération du fichier...");
        downloadVideo();
        
        // Arrêt propre des flux
        combinedStream.getTracks().forEach(track => track.stop());
      };

      // Si l'utilisateur clique sur "Arrêter le partage" dans la barre du navigateur
      displayStream.getVideoTracks()[0].onended = () => {
        stopRecording();
      };

      // Démarrage
      recorder.start(1000); // Sauvegarde par blocs de 1s
      mediaRecorderRef.current = recorder;
      
      setIsRecording(true);
      console.log("✅ Enregistrement actif !");

    } catch (err) {
      console.error("❌ Erreur startRecording:", err);
      alert("Impossible de démarrer l'enregistrement. Avez-vous donné les permissions ?");
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleRecord = () => {
    if (isRecording) stopRecording();
    else startRecording();
  };

  // --- 6. QUITTER L'APPEL ---
  const leaveCall = async () => {
    console.log("👋 Quitter l'appel demandé");
    
    // Si on enregistre encore, on force l'arrêt et le téléchargement
    if (isRecording) {
      stopRecording();
      // On attend 2 secondes bloquantes pour laisser le téléchargement se lancer
      // C'est vital sinon le changement de page tue le téléchargement
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Sauvegarde de la durée (LocalStorage)
    if (startTimeRef.current && callId) {
      const duration = Date.now() - startTimeRef.current;
      const minutes = Math.floor(duration / 60000);
      const seconds = Math.floor((duration % 60000) / 1000);
      const formatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      const history = JSON.parse(localStorage.getItem('closeros_call_history') || '[]');
      const idx = history.findIndex((c: any) => c.id === Number(callId));
      if (idx !== -1) {
        history[idx].duration = formatted;
        history[idx].status = 'Terminé';
        localStorage.setItem('closeros_call_history', JSON.stringify(history));
      }
    }

    // Nettoyage Daily
    if (callFrameRef.current) {
      await callFrameRef.current.leave();
      callFrameRef.current.destroy();
    }

    // Redirection
    if (callId) navigate(`/appels/${callId}`);
    else navigate('/agenda');
  };

  // UI Toggles
  const toggleMic = () => {
    callFrameRef.current?.setLocalAudio(!isMicOn);
    setIsMicOn(!isMicOn);
  };
  const toggleCam = () => {
    callFrameRef.current?.setLocalVideo(!isCamOn);
    setIsCamOn(!isCamOn);
  };
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-black overflow-hidden font-sans text-white">
      {/* SCRIPT PANEL */}
      <div className={`relative h-full bg-gray-900 border-r border-gray-800 transition-all duration-300 ease-in-out z-20 flex flex-col ${isScriptOpen ? 'w-1/3 translate-x-0' : 'w-0 -translate-x-full opacity-0'}`}>
        <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900">
          <h2 className="font-bold text-orange-500 tracking-wide">📜 Script</h2>
          <button onClick={() => setIsScriptOpen(false)} className="p-1 hover:bg-gray-800 rounded"><ChevronLeft size={20} /></button>
        </div>
        <textarea className="flex-1 w-full bg-gray-900 p-6 text-gray-300 resize-none focus:outline-none leading-relaxed text-base" readOnly value={userScript} />
      </div>

      {/* VIDEO AREA */}
      <div className="relative flex-1 bg-black h-full overflow-hidden">
        {!isScriptOpen && (
          <button onClick={() => setIsScriptOpen(true)} className="absolute top-4 left-4 z-50 p-3 bg-gray-800/80 hover:bg-gray-700 rounded-lg shadow-lg text-white transition"><ChevronRight size={20} /></button>
        )}

        <div ref={containerRef} className="absolute inset-0 w-full h-full" />

        {/* CONTROLS */}
        <div className={`absolute inset-0 pointer-events-none transition-opacity duration-700 ease-in-out z-40 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
            <div className="absolute top-6 right-6 flex gap-3 pointer-events-auto">
                <button onClick={toggleFullscreen} className="p-3 bg-gray-900/60 hover:bg-gray-800 backdrop-blur-md rounded-xl">
                    {isFullscreen ? <Minimize size={20}/> : <Maximize size={20}/>}
                </button>
            </div>

            <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 pointer-events-auto">
                <div className="flex items-center gap-4 px-6 py-4 bg-[#0f172a]/80 backdrop-blur-xl rounded-2xl border border-gray-700/50 shadow-2xl">
                    <button onClick={toggleMic} className={`p-4 rounded-xl transition-all ${isMicOn ? 'bg-gray-700/50 hover:bg-gray-600' : 'bg-red-500/20 text-red-500'}`}>
                        {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
                    </button>
                    <button onClick={toggleCam} className={`p-4 rounded-xl transition-all ${isCamOn ? 'bg-gray-700/50 hover:bg-gray-600' : 'bg-red-500/20 text-red-500'}`}>
                        {isCamOn ? <Video size={24} /> : <VideoOff size={24} />}
                    </button>
                    
                    {/* BOUTON ENREGISTREMENT */}
                    <button
                        onClick={toggleRecord}
                        className={`flex items-center gap-3 px-6 py-4 rounded-xl font-bold transition-all ${
                            isRecording
                            ? 'bg-red-600 text-white animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.5)]'
                            : 'bg-gray-700/50 hover:bg-gray-600 text-gray-200'
                        }`}
                    >
                        <Monitor size={24} />
                        <span className="min-w-[80px] text-center">
                            {isRecording ? formatDuration(recordingSeconds) : 'Enregistrer'}
                        </span>
                    </button>
                    
                    <div className="w-px h-10 bg-gray-600/50 mx-2"></div>
                    
                    {/* BOUTON QUITTER */}
                    <button onClick={leaveCall} className="p-4 rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-lg hover:scale-105 transition-transform">
                        <PhoneOff size={24} />
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}