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

  const containerRef = useRef<HTMLDivElement>(null);
  const callFrameRef = useRef<any>(null);
  const startTimeRef = useRef<number | null>(null);

  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isScriptOpen, setIsScriptOpen] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const timeoutRef = useRef<number | null>(null);

  // --- RECORDING & TIMER ---
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const [userScript, setUserScript] = useState(`Chargement du script...`);

  // Timer Logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setRecordingSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  // --- SCRIPT SYNC ---
  useEffect(() => {
    const fetchScript = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('user_scripts').select('content').eq('user_id', user.id).single();
      if (data) setUserScript(data.content);
    };
    fetchScript();
  }, []);

  // --- UI AUTO-HIDE ---
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setShowControls(false), 5000);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // --- DAILY CALL SETUP ---
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

  // --- RECORDING ENGINE ---
  const startRecording = async () => {
    try {
      chunksRef.current = [];
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const tracks = [...displayStream.getVideoTracks(), ...displayStream.getAudioTracks(), ...micStream.getAudioTracks()];
      const combinedStream = new MediaStream(tracks);
      streamRef.current = combinedStream;

      const recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm;codecs=vp9,opus' });
      recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Appel_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.mp4`;
        a.click();
        combinedStream.getTracks().forEach(t => t.stop());
      };

      displayStream.getVideoTracks()[0].onended = () => stopRecording();
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      alert("Erreur permission enregistrement");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const leaveCall = async () => {
    if (isRecording) {
      stopRecording();
      await new Promise(r => setTimeout(r, 2000));
    }
    if (callFrameRef.current) {
      await callFrameRef.current.leave();
      callFrameRef.current.destroy();
    }
    navigate(callId ? `/appels/${callId}` : '/agenda');
  };

  return (
    <div className="flex h-screen w-screen bg-black overflow-hidden font-sans text-white">
      {/* SCRIPT PANEL (Gaucher) */}
      <div className={`relative h-full bg-gray-900 border-r border-gray-800 transition-all duration-300 z-20 flex flex-col ${isScriptOpen ? 'w-1/3' : 'w-0 opacity-0 overflow-hidden'}`}>
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="font-bold text-orange-500">📜 Script de Vente</h2>
          <button onClick={() => setIsScriptOpen(false)} className="p-1 hover:bg-gray-800 rounded"><ChevronLeft size={20} /></button>
        </div>
        <textarea className="flex-1 w-full bg-gray-900 p-6 text-gray-300 resize-none focus:outline-none leading-relaxed" readOnly value={userScript} />
      </div>

      {/* VIDEO AREA */}
      <div className="relative flex-1 bg-black h-full overflow-hidden">
        {!isScriptOpen && (
          <button onClick={() => setIsScriptOpen(true)} className="absolute top-4 left-4 z-50 p-3 bg-gray-800/80 rounded-lg text-white"><ChevronRight size={20} /></button>
        )}

        <div ref={containerRef} className="absolute inset-0 w-full h-full" />

        {/* CONTROLS (Flottants en bas comme Screen 2) */}
        <div className={`absolute inset-0 pointer-events-none transition-opacity duration-500 z-40 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          <div className="absolute top-6 right-6 pointer-events-auto">
            <button onClick={() => { isFullscreen ? document.exitFullscreen() : document.documentElement.requestFullscreen(); setIsFullscreen(!isFullscreen); }} className="p-3 bg-gray-900/60 backdrop-blur-md rounded-xl">
              {isFullscreen ? <Minimize size={20}/> : <Maximize size={20}/>}
            </button>
          </div>

          <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 pointer-events-auto">
            <div className="flex items-center gap-4 px-6 py-4 bg-[#0f172a]/80 backdrop-blur-xl rounded-2xl border border-gray-700/50 shadow-2xl">
              <button onClick={() => { callFrameRef.current?.setLocalAudio(!isMicOn); setIsMicOn(!isMicOn); }} className={`p-4 rounded-xl ${isMicOn ? 'bg-gray-700/50' : 'bg-red-500/20 text-red-500'}`}>
                {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
              </button>
              <button onClick={() => { callFrameRef.current?.setLocalVideo(!isCamOn); setIsCamOn(!isCamOn); }} className={`p-4 rounded-xl ${isCamOn ? 'bg-gray-700/50' : 'bg-red-500/20 text-red-500'}`}>
                {isCamOn ? <Video size={24} /> : <VideoOff size={24} />}
              </button>
              
              <button onClick={isRecording ? stopRecording : startRecording} className={`flex items-center gap-3 px-6 py-4 rounded-xl font-bold transition-all ${isRecording ? 'bg-red-600 animate-pulse' : 'bg-gray-700/50 text-gray-200'}`}>
                <Monitor size={24} />
                <span className="min-w-[70px]">{isRecording ? formatDuration(recordingSeconds) : 'Enregistrer'}</span>
              </button>

              <div className="w-px h-10 bg-gray-600/50 mx-2"></div>
              
              <button onClick={leaveCall} className="p-4 rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-lg">
                <PhoneOff size={24} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}