import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import DailyIframe from '@daily-co/daily-js';
import {
  Mic, MicOff, Video, VideoOff,
  Monitor, PhoneOff, Maximize, Minimize,
  ChevronLeft, ChevronRight, FileText, PenTool
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// Fonction utilitaire pour trouver le format vidéo supporté par le navigateur
const getSupportedMimeType = () => {
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4' 
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
  const [showControls, setShowControls] = useState(true);
  const timeoutRef = useRef<number | null>(null);

  // --- GESTION DES PANNEAUX (SCRIPT / NOTES) ---
  const [activePanel, setActivePanel] = useState<'script' | 'notes' | 'none'>('script'); // 'script', 'notes', or 'none'
  const [userScript, setUserScript] = useState(`Chargement du script...`);
  const [notes, setNotes] = useState(''); // Vos notes d'appel

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // --- TIMER ENREGISTREMENT ---
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
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

  // --- ENREGISTREMENT (Fonctions identiques au code précédent) ---
  const saveFile = () => {
    const blob = new Blob(chunksRef.current, { type: 'video/webm' });
    if (blob.size === 0) return;
    const fileUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = fileUrl;
    const dateStr = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
    a.download = `Enregistrement_CloseOS_${dateStr}.webm`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(fileUrl);
    }, 100);
  };

  const startRecording = async () => {
    try {
      const mimeType = getSupportedMimeType();
      if (!mimeType) { alert("Format non supporté"); return; }
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const destination = audioCtx.createMediaStreamDestination();
      if (screenStream.getAudioTracks().length > 0) audioCtx.createMediaStreamSource(screenStream).connect(destination);
      if (micStream.getAudioTracks().length > 0) audioCtx.createMediaStreamSource(micStream).connect(destination);
      const combinedStream = new MediaStream([...screenStream.getVideoTracks(), ...destination.stream.getAudioTracks()]);
      streamRef.current = combinedStream;
      const recorder = new MediaRecorder(combinedStream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        saveFile();
        screenStream.getTracks().forEach(track => track.stop());
        micStream.getTracks().forEach(track => track.stop());
        audioCtx.close();
      };
      screenStream.getVideoTracks()[0].onended = () => stopRecording();
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      recordingStartTimeRef.current = Date.now();
      setIsRecording(true);
    } catch (err) {
      console.error(err);
      alert("Erreur enregistrement");
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

  // --- QUITTER L'APPEL (MODIFIÉ POUR PASSER LES NOTES) ---
  const leaveCall = async () => {
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (callStartTimeRef.current && callId) {
        // Sauvegarde localStorage (optionnelle)
        // ... (votre logique existante)
    }

    if (callFrameRef.current) {
      await callFrameRef.current.leave();
      callFrameRef.current.destroy();
    }

    if (callId) {
      // ICI : ON PASSE LES NOTES DANS L'ÉTAT DE NAVIGATION
      navigate(`/appels/${callId}`, { state: { liveNotes: notes } });
    } else {
      navigate('/agenda');
    }
  };

  // Toggle Daily functions
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

      {/* PANNEAU LATÉRAL (SCRIPT OU NOTES) */}
      <div
        className={`relative h-full bg-gray-900 border-r border-gray-800 transition-all duration-300 ease-in-out z-20 flex flex-col ${
          activePanel !== 'none' ? 'w-1/3 translate-x-0' : 'w-0 -translate-x-full opacity-0'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900">
          <div className="flex gap-2">
             <button 
                onClick={() => setActivePanel('script')}
                className={`px-3 py-1.5 rounded text-sm font-bold transition-colors ${activePanel === 'script' ? 'bg-orange-500/20 text-orange-500' : 'text-gray-400 hover:text-white'}`}
             >
                Script
             </button>
             <button 
                onClick={() => setActivePanel('notes')}
                className={`px-3 py-1.5 rounded text-sm font-bold transition-colors ${activePanel === 'notes' ? 'bg-blue-500/20 text-blue-500' : 'text-gray-400 hover:text-white'}`}
             >
                Notes
             </button>
          </div>
          <button onClick={() => setActivePanel('none')} className="p-1 hover:bg-gray-800 rounded">
            <ChevronLeft size={20} />
          </button>
        </div>

        {activePanel === 'script' && (
            <textarea
                className="flex-1 w-full bg-gray-900 p-6 text-gray-300 resize-none focus:outline-none leading-relaxed text-base"
                readOnly
                value={userScript} 
            />
        )}

        {activePanel === 'notes' && (
            <textarea
                className="flex-1 w-full bg-gray-900 p-6 text-white resize-none focus:outline-none leading-relaxed text-base placeholder-gray-600"
                placeholder="Prenez vos notes ici..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                autoFocus
            />
        )}
      </div>

      <div className="relative flex-1 bg-black h-full overflow-hidden">

        {activePanel === 'none' && (
          <div className="absolute top-4 left-4 z-50 flex flex-col gap-2">
            <button
                onClick={() => setActivePanel('script')}
                className="p-3 bg-gray-800/80 hover:bg-gray-700 rounded-lg shadow-lg text-white transition"
                title="Ouvrir Script"
            >
                <FileText size={20} />
            </button>
            <button
                onClick={() => setActivePanel('notes')}
                className="p-3 bg-gray-800/80 hover:bg-gray-700 rounded-lg shadow-lg text-white transition"
                title="Ouvrir Notes"
            >
                <PenTool size={20} />
            </button>
          </div>
        )}

        <div ref={containerRef} className="absolute inset-0 w-full h-full" />

        {/* CONTROLS BAR */}
        <div
          className={`absolute inset-0 pointer-events-none transition-opacity duration-700 ease-in-out z-40 ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
          onMouseMove={() => {
             setShowControls(true);
             if(timeoutRef.current) clearTimeout(timeoutRef.current);
             timeoutRef.current = window.setTimeout(() => setShowControls(false), 5000);
          }}
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
                        <span className="min-w-[80px] text-center">
                            {isRecording ? formatDuration(recordingSeconds) : 'Enregistrer'}
                        </span>
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