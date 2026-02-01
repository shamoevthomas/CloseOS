import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import DailyIframe from '@daily-co/daily-js';
import {
  Mic, MicOff, Video, VideoOff,
  Monitor, PhoneOff, Maximize, Minimize,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// Fonction utilitaire pour trouver le format vidéo supporté par le navigateur
const getSupportedMimeType = () => {
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4' // Safari supporte parfois mieux mp4
  ];
  return types.find(type => MediaRecorder.isTypeSupported(type)) || '';
};

export default function CallRoom() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const url = searchParams.get('url');
  const callId = searchParams.get('id');

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const callFrameRef = useRef<any>(null);
  const callStartTimeRef = useRef<number | null>(null);

  // UI State
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isScriptOpen, setIsScriptOpen] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const timeoutRef = useRef<number | null>(null);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  
  // Refs pour l'enregistrement (pour y accéder dans les event listeners sans re-render)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const [userScript, setUserScript] = useState(`1. INTRODUCTION\n- "Bonjour..."`);

  // --- TIMER INFAILLIBLE ---
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      // On met à jour l'affichage toutes les 500ms en comparant avec l'heure de début
      // Cela évite que le compteur ne se "bloque" si une seconde saute
      interval = setInterval(() => {
        const now = Date.now();
        const diffInSeconds = Math.floor((now - recordingStartTimeRef.current) / 1000);
        setRecordingSeconds(diffInSeconds);
      }, 500);
    } else {
      setRecordingSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatDuration = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // --- CHARGEMENT SCRIPT ---
  useEffect(() => {
    const fetchUserScript = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from('user_scripts')
          .select('content')
          .eq('user_id', user.id)
          .single();
        if (data?.content) setUserScript(data.content);
      } catch (err) {
        console.error(err);
      }
    };
    fetchUserScript();
  }, []);

  // --- UI CONTROLS AUTO-HIDE ---
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setShowControls(false), 5000);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  // --- DAILY SETUP ---
  useEffect(() => {
    if (!url || !containerRef.current) return;

    const initCall = async () => {
      const existingCall = DailyIframe.getCallInstance();
      if (existingCall) await existingCall.destroy();

      const frame = DailyIframe.createFrame(containerRef.current!, {
        iframeStyle: { width: '100%', height: '100%', border: '0' },
        showLeaveButton: false,
        showFullscreenButton: false,
        theme: {
          colors: {
            accent: '#E54D2E',
            accentText: '#FFFFFF',
            background: '#1F2937',
            mainAreaBg: '#111827',
          }
        }
      });

      await frame.join({ url });
      callFrameRef.current = frame;
      callStartTimeRef.current = Date.now();
    };

    initCall();

    return () => {
      const call = DailyIframe.getCallInstance();
      if (call) call.destroy();
    };
  }, [url]);

  // --- ENREGISTREMENT ---

  const saveFile = () => {
    const blob = new Blob(chunksRef.current, { type: 'video/webm' });
    
    // Si le fichier est vide, on ne fait rien (ou on alerte)
    if (blob.size === 0) {
      console.warn("Fichier enregistrement vide.");
      return;
    }

    const fileUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = fileUrl;
    // Nom de fichier précis avec la date
    const dateStr = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
    a.download = `Enregistrement_CloseOS_${dateStr}.webm`;
    
    document.body.appendChild(a);
    a.click();
    
    // Nettoyage propre
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(fileUrl);
    }, 100);
  };

  const startRecording = async () => {
    try {
      const mimeType = getSupportedMimeType();
      if (!mimeType) {
        alert("Votre navigateur ne supporte pas l'enregistrement (MimeType inconnu).");
        return;
      }

      // 1. Capture écran + audio système
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      // 2. Capture micro
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });

      // 3. Mixage Audio
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const destination = audioCtx.createMediaStreamDestination();

      if (screenStream.getAudioTracks().length > 0) {
        const screenSource = audioCtx.createMediaStreamSource(screenStream);
        screenSource.connect(destination);
      }
      
      if (micStream.getAudioTracks().length > 0) {
        const micSource = audioCtx.createMediaStreamSource(micStream);
        micSource.connect(destination);
      }

      // 4. Stream Final
      const combinedStream = new MediaStream([
        ...screenStream.getVideoTracks(),
        ...destination.stream.getAudioTracks()
      ]);
      
      streamRef.current = combinedStream;

      const recorder = new MediaRecorder(combinedStream, { mimeType });
      chunksRef.current = []; // Reset du buffer

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        saveFile(); // Sauvegarde automatique à l'arrêt
        
        // Arrêt de tous les flux pour éteindre les icônes rouges du navigateur
        screenStream.getTracks().forEach(track => track.stop());
        micStream.getTracks().forEach(track => track.stop());
        audioCtx.close();
      };

      // Si l'utilisateur clique sur "Arrêter le partage" dans la barre du navigateur
      screenStream.getVideoTracks()[0].onended = () => {
        stopRecording();
      };

      recorder.start(1000); // Sauvegarde un bloc toutes les secondes
      mediaRecorderRef.current = recorder;
      
      // Démarrage du timer
      recordingStartTimeRef.current = Date.now();
      setIsRecording(true);

    } catch (err) {
      console.error("Erreur startRecording:", err);
      alert("Erreur lors du lancement de l'enregistrement. Vérifiez les permissions.");
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleRecord = () => {
    if (isRecording) stopRecording();
    else startRecording();
  };

  // --- QUITTER L'APPEL ---
  const leaveCall = async () => {
    // 1. GESTION ENREGISTREMENT
    if (isRecording && mediaRecorderRef.current) {
      // On arrête proprement
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // On force une petite attente pour être sûr que le fichier se télécharge
      // C'est vital car sinon la navigation tue le processus de téléchargement
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // 2. SAUVEGARDE DURÉE APPEL (LocalStorage)
    if (callStartTimeRef.current && callId) {
      const duration = Date.now() - callStartTimeRef.current;
      const seconds = Math.floor(duration / 1000);
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      const formattedDuration = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;

      const historyJson = localStorage.getItem('closeros_call_history');
      if (historyJson) {
        const history = JSON.parse(historyJson);
        const callIndex = history.findIndex((c: any) => c.id === Number(callId));
        if (callIndex !== -1) {
          history[callIndex] = { ...history[callIndex], duration: formattedDuration, status: 'Terminé' };
          localStorage.setItem('closeros_call_history', JSON.stringify(history));
        }
      }
    }

    // 3. NETTOYAGE DAILY
    if (callFrameRef.current) {
      await callFrameRef.current.leave();
      callFrameRef.current.destroy();
    }

    // 4. NAVIGATION
    if (callId) {
      navigate(`/appels/${callId}`);
    } else {
      navigate('/agenda');
    }
  };

  // Toggle Daily
  const toggleMic = () => {
    const current = callFrameRef.current?.participants().local.audio;
    callFrameRef.current?.setLocalAudio(!current);
    setIsMicOn(!current);
  };
  const toggleCam = () => {
    const current = callFrameRef.current?.participants().local.video;
    callFrameRef.current?.setLocalVideo(!current);
    setIsCamOn(!current);
  };
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  return (
    <div className="flex h-screen w-screen bg-black overflow-hidden font-sans text-white">

      <div
        className={`relative h-full bg-gray-900 border-r border-gray-800 transition-all duration-300 ease-in-out z-20 flex flex-col ${
          isScriptOpen ? 'w-1/3 translate-x-0' : 'w-0 -translate-x-full opacity-0'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900">
          <h2 className="font-bold text-orange-500 tracking-wide">📜 Script de Vente</h2>
          <button onClick={() => setIsScriptOpen(false)} className="p-1 hover:bg-gray-800 rounded">
            <ChevronLeft size={20} />
          </button>
        </div>
        <textarea
          className="flex-1 w-full bg-gray-900 p-6 text-gray-300 resize-none focus:outline-none leading-relaxed text-base"
          readOnly
          value={userScript} 
        />
      </div>

      <div className="relative flex-1 bg-black h-full overflow-hidden">

        {!isScriptOpen && (
          <button
            onClick={() => setIsScriptOpen(true)}
            className="absolute top-4 left-4 z-50 p-3 bg-gray-800/80 hover:bg-gray-700 rounded-lg shadow-lg text-white transition"
          >
            <ChevronRight size={20} />
          </button>
        )}

        <div ref={containerRef} className="absolute inset-0 w-full h-full" />

        <div
          className={`absolute inset-0 pointer-events-none transition-opacity duration-700 ease-in-out z-40 ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
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