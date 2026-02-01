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

  // DOM Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const callFrameRef = useRef<any>(null);
  const startTimeRef = useRef<number | null>(null); 

  // UI State
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isScriptOpen, setIsScriptOpen] = useState(true); 

  // Auto-Hide State
  const [showControls, setShowControls] = useState(true);
  const timeoutRef = useRef<number | null>(null);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0); // Nouveau state pour le timer
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null); // Ref pour nettoyer les streams

  const [userScript, setUserScript] = useState(`1. INTRODUCTION\n- "Bonjour..."\n\n2. DÉCOUVERTE\n- "Quels sont vos objectifs ?"`);

  // --- TIMER LOGIC ---
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
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
  // -------------------

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

        if (data && data.content) {
          setUserScript(data.content);
        }
      } catch (error) {
        console.error('Erreur lors de la récupération du script:', error);
      }
    };

    fetchUserScript();
  }, []);

  const handleMouseMove = () => {
    setShowControls(true);
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      setShowControls(false);
    }, 10000); 
  };

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!url) return;

    const initCall = async () => {
      const existingCall = DailyIframe.getCallInstance();
      if (existingCall) await existingCall.destroy();

      if (!containerRef.current) return;

      const frame = DailyIframe.createFrame(containerRef.current, {
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

      frame.on('left-meeting', () => {
        // La logique de navigation est gérée dans leaveCall maintenant pour assurer l'enregistrement
      });

      await frame.join({ url });
      callFrameRef.current = frame;
      startTimeRef.current = Date.now(); 
    };

    initCall();

    return () => {
      if (startTimeRef.current) {
        saveCallDuration();
      }
      const call = DailyIframe.getCallInstance();
      if (call) call.destroy();
    };
  }, [url, navigate, callId]);

  // --- RECORDING LOGIC ROBUSTE ---
  const startRecording = async () => {
    try {
      // 1. Capturer l'écran et le son système
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
      
      // 2. Capturer le micro
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });

      // 3. Mixer les audios
      const audioContext = new AudioContext();
      const dest = audioContext.createMediaStreamDestination();

      if (screenStream.getAudioTracks().length > 0) {
        const screenSource = audioContext.createMediaStreamSource(screenStream);
        screenSource.connect(dest);
      }
      
      if (micStream.getAudioTracks().length > 0) {
        const micSource = audioContext.createMediaStreamSource(micStream);
        micSource.connect(dest);
      }

      // 4. Combiner vidéo et mix audio
      const combinedStream = new MediaStream([
        ...screenStream.getVideoTracks(),
        ...dest.stream.getAudioTracks()
      ]);

      streamRef.current = combinedStream;

      const mimeType = MediaRecorder.isTypeSupported('video/mp4') 
        ? 'video/mp4' 
        : 'video/webm';

      const recorder = new MediaRecorder(combinedStream, { mimeType });
      chunksRef.current = []; // Reset chunks

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      // Fonction de sauvegarde déclenchée à l'arrêt
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size === 0) return; // Évite les fichiers vides

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const extension = mimeType === 'video/mp4' ? 'mp4' : 'webm';
        const filename = `Call_Recording_${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.${extension}`;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        // Nettoyage
        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, 100);

        // Arrêt des pistes
        screenStream.getTracks().forEach(track => track.stop());
        micStream.getTracks().forEach(track => track.stop());
        audioContext.close();
      };

      recorder.start(1000); // Sauvegarde des chunks toutes les 1s pour éviter la perte de données
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

      // Arrêt auto si l'utilisateur arrête le partage via l'interface du navigateur
      screenStream.getVideoTracks()[0].onended = () => stopRecording();

    } catch (err) {
      console.error("Recording failed", err);
      alert("Impossible de lancer l'enregistrement. Vérifiez les permissions.");
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

  const saveCallDuration = () => {
    if (!startTimeRef.current || !callId) return;
    const duration = Date.now() - startTimeRef.current;
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const formattedDuration = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;

    const historyJson = localStorage.getItem('closeros_call_history');
    const history = historyJson ? JSON.parse(historyJson) : [];
    const callIndex = history.findIndex((call: any) => call.id === Number(callId));

    if (callIndex !== -1) {
      history[callIndex] = { ...history[callIndex], duration: formattedDuration, status: 'Terminé' };
      localStorage.setItem('closeros_call_history', JSON.stringify(history));
    }
  };

  // --- LOGIQUE DE DÉPART CORRIGÉE ---
  const leaveCall = async () => {
    // 1. Si enregistrement en cours, on arrête et on attend un peu pour le téléchargement
    if (isRecording && mediaRecorderRef.current) {
        stopRecording();
        // Petit délai pour laisser le temps au navigateur de lancer le téléchargement
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 2. Sauvegarde des stats
    saveCallDuration();

    // 3. Nettoyage Daily
    if (callFrameRef.current) {
        await callFrameRef.current.leave();
        callFrameRef.current.destroy();
    }

    // 4. Navigation
    if (callId) { 
        navigate(`/appels/${callId}`); 
    } else { 
        navigate('/agenda'); 
    }
  };

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
                    <button
                        onClick={toggleRecord}
                        className={`flex items-center gap-3 px-6 py-4 rounded-xl font-bold transition-all ${
                            isRecording
                            ? 'bg-red-600 text-white animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.5)]'
                            : 'bg-gray-700/50 hover:bg-gray-600 text-gray-200'
                        }`}
                    >
                        <Monitor size={24} />
                        <span>{isRecording ? `REC (${formatDuration(recordingSeconds)})` : 'Enregistrer'}</span>
                    </button>
                    <div className="w-px h-10 bg-gray-600/50 mx-2"></div>
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