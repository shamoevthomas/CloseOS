import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import DailyIframe from '@daily-co/daily-js';
import {
  Mic, MicOff, Video, VideoOff,
  Monitor, PhoneOff, Maximize, Minimize,
  ChevronLeft, ChevronRight, Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function CallRoom() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const url = searchParams.get('url');
  const callId = searchParams.get('id');

  // --- REFS ---
  const containerRef = useRef<HTMLDivElement>(null);
  const callFrameRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // --- STATE ---
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isScriptOpen, setIsScriptOpen] = useState(true);
  const [userScript, setUserScript] = useState("Chargement du script...");
  
  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [timerDisplay, setTimerDisplay] = useState("00:00");
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  // --- 1. CHARGEMENT DU SCRIPT (Lié à CallsPage) ---
  useEffect(() => {
    async function loadScript() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        console.log("🔍 Récupération du script pour user:", user.id);
        
        const { data, error } = await supabase
          .from('user_scripts')
          .select('content')
          .eq('user_id', user.id)
          .single();

        if (error) throw error;
        if (data && data.content) {
          setUserScript(data.content);
          console.log("✅ Script chargé avec succès");
        } else {
          setUserScript("Aucun script enregistré. Allez dans 'Appels' > 'Script' pour en créer un.");
        }
      } catch (err) {
        console.error("❌ Erreur chargement script:", err);
        setUserScript("Erreur lors du chargement du script.");
      }
    }
    loadScript();
  }, []);

  // --- 2. CONFIGURATION DAILY ---
  useEffect(() => {
    if (!url || !containerRef.current) return;

    const initCall = async () => {
      // Nettoyage préventif
      if (DailyIframe.getCallInstance()) {
        await DailyIframe.getCallInstance()?.destroy();
      }

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

      try {
        await frame.join({ url });
        callFrameRef.current = frame;
        console.log("✅ Daily Call rejoint");
      } catch (e) {
        console.error("❌ Erreur Daily:", e);
      }
    };

    initCall();

    return () => {
      // Cleanup lors du démontage
      const call = DailyIframe.getCallInstance();
      if (call) call.destroy();
    };
  }, [url]);

  // --- 3. LOGIQUE TIMER ---
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setSecondsElapsed(prev => {
          const next = prev + 1;
          // Formatage immédiat pour éviter les calculs dans le render
          const mins = Math.floor(next / 60).toString().padStart(2, '0');
          const secs = (next % 60).toString().padStart(2, '0');
          setTimerDisplay(`${mins}:${secs}`);
          return next;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setSecondsElapsed(0);
      setTimerDisplay("00:00");
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  // --- 4. ENREGISTREMENT ---
  
  const handleStartRecording = async () => {
    console.log("⏺️ Bouton enregistrement cliqué");
    
    try {
      // Demande permission Écran + Audio
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true // Important pour le son
      });

      console.log("✅ Flux récupéré:", stream.id);

      // Configuration Recorder
      const mimeType = 'video/webm;codecs=vp8,opus'; // Format très standard
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        console.warn("VP8 non supporté, fallback standard");
      }

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined
      });

      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        console.log("🛑 Enregistrement terminé. Génération du fichier...");
        downloadRecording();
        
        // Arrêt des pistes (éteint le partage d'écran navigateur)
        stream.getTracks().forEach(track => track.stop());
      };

      // Si l'utilisateur clique sur "Arrêter le partage" dans la barre Chrome/Nav
      stream.getVideoTracks()[0].onended = () => {
        console.log("⚠️ Partage arrêté via le navigateur");
        handleStopRecording();
      };

      recorder.start(1000); // Sauvegarde chaque seconde
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

    } catch (err) {
      console.error("❌ Erreur démarrage enregistrement:", err);
      alert("Impossible de démarrer l'enregistrement. Vérifiez les permissions.");
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const downloadRecording = () => {
    const blob = new Blob(chunksRef.current, { type: 'video/webm' });
    if (blob.size === 0) {
      console.error("⚠️ Fichier vide, pas de téléchargement");
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    // On force l'extension .mp4 pour votre confort (le contenu reste du webm, lisible par VLC/Chrome)
    a.download = `Call_Recording_${new Date().toISOString().slice(0,19).replace(/[:]/g, '-')}.mp4`;
    document.body.appendChild(a);
    a.click();
    
    // Nettoyage
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
  };

  // --- 5. QUITTER ---
  const handleLeave = async () => {
    // Si on enregistre, on force l'arrêt et on attend le téléchargement
    if (isRecording) {
      handleStopRecording();
      // Petit délai pour laisser le temps au téléchargement de se lancer
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // Destruction instance Daily
    if (callFrameRef.current) {
      await callFrameRef.current.leave();
      callFrameRef.current.destroy();
    }

    // Redirection
    if (callId) navigate(`/appels/${callId}`);
    else navigate('/agenda');
  };

  // --- UI TOGGLES ---
  const toggleMic = () => {
    if (callFrameRef.current) {
      const current = callFrameRef.current.participants().local.audio;
      callFrameRef.current.setLocalAudio(!current);
      setIsMicOn(!current);
    }
  };

  const toggleCam = () => {
    if (callFrameRef.current) {
      const current = callFrameRef.current.participants().local.video;
      callFrameRef.current.setLocalVideo(!current);
      setIsCamOn(!current);
    }
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
      
      {/* --- VOLET GAUCHE : SCRIPT --- */}
      <div
        className={`relative h-full bg-gray-900 border-r border-gray-800 transition-all duration-300 ease-in-out z-20 flex flex-col ${
          isScriptOpen ? 'w-1/3 translate-x-0' : 'w-0 -translate-x-full opacity-0'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900">
          <h2 className="font-bold text-orange-500 tracking-wide flex items-center gap-2">
            <Loader2 className="h-4 w-4" /> Script de Vente
          </h2>
          <button onClick={() => setIsScriptOpen(false)} className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white">
            <ChevronLeft size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto bg-gray-900 p-6">
          <textarea
            className="w-full h-full bg-transparent text-gray-300 resize-none focus:outline-none leading-relaxed text-base"
            readOnly
            value={userScript} 
          />
        </div>
      </div>

      {/* --- VOLET DROIT : APPEL --- */}
      <div className="relative flex-1 bg-black h-full overflow-hidden">

        {/* Bouton ouvrir script */}
        {!isScriptOpen && (
          <button
            onClick={() => setIsScriptOpen(true)}
            className="absolute top-4 left-4 z-50 p-3 bg-gray-800/80 hover:bg-gray-700 rounded-lg shadow-lg text-white transition backdrop-blur-sm"
          >
            <ChevronRight size={20} />
          </button>
        )}

        {/* Cadre Vidéo Daily */}
        <div ref={containerRef} className="absolute inset-0 w-full h-full" />

        {/* --- BARRE DE CONTRÔLE --- */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-50 w-auto max-w-[90%]">
          <div className="flex items-center gap-4 px-6 py-4 bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl">
            
            {/* Micro */}
            <button 
              onClick={toggleMic} 
              className={`p-4 rounded-xl transition-all duration-200 ${isMicOn ? 'bg-slate-700/50 hover:bg-slate-600' : 'bg-red-500/20 text-red-500 ring-1 ring-red-500/50'}`}
            >
              {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
            </button>

            {/* Caméra */}
            <button 
              onClick={toggleCam} 
              className={`p-4 rounded-xl transition-all duration-200 ${isCamOn ? 'bg-slate-700/50 hover:bg-slate-600' : 'bg-red-500/20 text-red-500 ring-1 ring-red-500/50'}`}
            >
              {isCamOn ? <Video size={24} /> : <VideoOff size={24} />}
            </button>

            {/* Enregistrement */}
            <button
              onClick={isRecording ? handleStopRecording : handleStartRecording}
              className={`flex items-center gap-3 px-6 py-4 rounded-xl font-bold transition-all duration-200 ${
                isRecording
                  ? 'bg-red-600 text-white animate-pulse shadow-[0_0_20px_rgba(220,38,38,0.4)]'
                  : 'bg-slate-700/50 hover:bg-slate-600 text-slate-200'
              }`}
            >
              <Monitor size={24} />
              <span className="min-w-[80px] text-center font-mono">
                {isRecording ? timerDisplay : 'REC'}
              </span>
            </button>

            <div className="w-px h-8 bg-slate-700 mx-2"></div>

            {/* Plein écran */}
            <button 
              onClick={toggleFullscreen} 
              className="p-4 bg-slate-700/50 hover:bg-slate-600 rounded-xl text-slate-300"
            >
              {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
            </button>

            {/* Quitter */}
            <button 
              onClick={handleLeave} 
              className="p-4 rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-lg hover:scale-105 transition-transform"
            >
              <PhoneOff size={24} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}