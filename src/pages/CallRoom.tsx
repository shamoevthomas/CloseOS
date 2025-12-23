import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import DailyIframe from '@daily-co/daily-js';
import {
  Mic, MicOff, Video, VideoOff,
  Monitor, PhoneOff, Maximize, Minimize,
  ChevronLeft, ChevronRight
} from 'lucide-react';

export default function CallRoom() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const url = searchParams.get('url');
  const callId = searchParams.get('id');

  // DOM Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const callFrameRef = useRef<any>(null);
  const startTimeRef = useRef<number | null>(null); // Track call start time

  // UI State
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isScriptOpen, setIsScriptOpen] = useState(true); // Script state independent of Auto-Hide

  // Auto-Hide State
  const [showControls, setShowControls] = useState(true);
  const timeoutRef = useRef<number | null>(null);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // --- 1. AUTO-HIDE LOGIC (10 Seconds) ---
  const handleMouseMove = () => {
    setShowControls(true);
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      setShowControls(false);
    }, 10000); // 10 seconds delay
  };

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  // --- 2. DAILY SETUP (HEADLESS) ---
  useEffect(() => {
    if (!url) return;

    const initCall = async () => {
      const existingCall = DailyIframe.getCallInstance();
      if (existingCall) await existingCall.destroy();

      if (!containerRef.current) return;

      const frame = DailyIframe.createFrame(containerRef.current, {
        iframeStyle: { width: '100%', height: '100%', border: '0' },
        showLeaveButton: false,      // HIDDEN
        showFullscreenButton: false, // HIDDEN
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
        saveCallDuration();
        // Redirect to call summary if we have a callId, otherwise to agenda
        if (callId) {
          navigate(`/appels/${callId}`);
        } else {
          navigate('/agenda');
        }
      });

      await frame.join({ url });
      callFrameRef.current = frame;
      startTimeRef.current = Date.now(); // Start tracking call duration
    };

    initCall();

    return () => {
      // Save duration before cleanup
      if (startTimeRef.current) {
        saveCallDuration();
      }
      const call = DailyIframe.getCallInstance();
      if (call) call.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, navigate]);

  // --- 3. RECORDING LOGIC (The Magic Mix) ---
  const startRecording = async () => {
    try {
      // A. Get Screen Stream (System Audio + Video)
      // NOTE: User must select the current tab/screen and "Share Audio"
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      // B. Get Mic Stream (User Audio)
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });

      // C. Mix Audio
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

      // D. Combine (Screen Video + Mixed Audio)
      const combinedStream = new MediaStream([
        ...screenStream.getVideoTracks(),
        ...dest.stream.getAudioTracks()
      ]);

      // E. Start Recorder
      const recorder = new MediaRecorder(combinedStream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `recording-${new Date().toISOString()}.webm`;
        a.click();

        // Cleanup tracks
        screenStream.getTracks().forEach(track => track.stop());
        micStream.getTracks().forEach(track => track.stop());
        audioContext.close();
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

      // Stop recording if user stops sharing screen
      screenStream.getVideoTracks()[0].onended = () => stopRecording();

    } catch (err) {
      console.error("Recording failed", err);
      alert("Impossible de lancer l'enregistrement. Vérifiez les permissions.");
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

  // --- 4. SAVE CALL DURATION ---
  const saveCallDuration = () => {
    if (!startTimeRef.current || !callId) return;

    const duration = Date.now() - startTimeRef.current;
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const formattedDuration = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;

    // Get existing call history
    const historyJson = localStorage.getItem('closeros_call_history');
    const history = historyJson ? JSON.parse(historyJson) : [];

    // Find and update the specific call entry
    const callIndex = history.findIndex((call: any) => call.id === Number(callId));

    if (callIndex !== -1) {
      // Update the existing entry
      history[callIndex] = {
        ...history[callIndex],
        duration: formattedDuration,
        status: 'Terminé'
      };

      localStorage.setItem('closeros_call_history', JSON.stringify(history));
      console.log('✅ Call duration updated:', formattedDuration, 'for call ID:', callId);
    } else {
      console.error('❌ Call ID not found in history:', callId);
    }
  };

  // --- 5. CONTROLS ---
  const leaveCall = () => {
    saveCallDuration();
    callFrameRef.current?.leave();
    // Redirect to call summary if we have a callId, otherwise to agenda
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

      {/* --- LEFT PANEL: SCRIPT (PERSISTENT) --- */}
      <div
        className={`relative h-full bg-gray-900 border-r border-gray-800 transition-all duration-300 ease-in-out z-20 flex flex-col ${
          isScriptOpen ? 'w-1/3 translate-x-0' : 'w-0 -translate-x-full opacity-0'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900">
          <h2 className="font-bold text-orange-500 tracking-wide">📜 Script de Vente</h2>
          {/* Collapse Button */}
          <button onClick={() => setIsScriptOpen(false)} className="p-1 hover:bg-gray-800 rounded">
            <ChevronLeft size={20} />
          </button>
        </div>
        <textarea
          className="flex-1 w-full bg-gray-900 p-6 text-gray-300 resize-none focus:outline-none leading-relaxed text-base"
          placeholder="Écrivez votre script ici..."
          defaultValue={`1. INTRODUCTION\n- "Bonjour..."\n\n2. DÉCOUVERTE\n- "Quels sont vos objectifs ?"`}
        />
      </div>

      {/* --- RIGHT PANEL: VIDEO --- */}
      <div className="relative flex-1 bg-black h-full overflow-hidden">

        {/* Toggle Script Button (Visible when script is closed) */}
        {!isScriptOpen && (
          <button
            onClick={() => setIsScriptOpen(true)}
            className="absolute top-4 left-4 z-50 p-3 bg-gray-800/80 hover:bg-gray-700 rounded-lg shadow-lg text-white transition"
          >
            <ChevronRight size={20} />
          </button>
        )}

        {/* Video Container */}
        <div ref={containerRef} className="absolute inset-0 w-full h-full" />

        {/* --- FLOATING UI (AUTO-HIDE) --- */}
        <div
          className={`absolute inset-0 pointer-events-none transition-opacity duration-700 ease-in-out z-40 ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
            {/* Top Right Buttons */}
            <div className="absolute top-6 right-6 flex gap-3 pointer-events-auto">
                <button onClick={toggleFullscreen} className="p-3 bg-gray-900/60 hover:bg-gray-800 backdrop-blur-md rounded-xl">
                    {isFullscreen ? <Minimize size={20}/> : <Maximize size={20}/>}
                </button>
            </div>

            {/* Bottom Control Bar */}
            <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 pointer-events-auto">
                <div className="flex items-center gap-4 px-6 py-4 bg-[#0f172a]/80 backdrop-blur-xl rounded-2xl border border-gray-700/50 shadow-2xl">

                    <button onClick={toggleMic} className={`p-4 rounded-xl transition-all ${isMicOn ? 'bg-gray-700/50 hover:bg-gray-600' : 'bg-red-500/20 text-red-500'}`}>
                        {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
                    </button>

                    <button onClick={toggleCam} className={`p-4 rounded-xl transition-all ${isCamOn ? 'bg-gray-700/50 hover:bg-gray-600' : 'bg-red-500/20 text-red-500'}`}>
                        {isCamOn ? <Video size={24} /> : <VideoOff size={24} />}
                    </button>

                    {/* REAL RECORDING BUTTON */}
                    <button
                        onClick={toggleRecord}
                        className={`flex items-center gap-3 px-6 py-4 rounded-xl font-bold transition-all ${
                            isRecording
                            ? 'bg-red-600 text-white animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.5)]'
                            : 'bg-gray-700/50 hover:bg-gray-600 text-gray-200'
                        }`}
                    >
                        <Monitor size={24} />
                        <span>{isRecording ? 'Enregistrement...' : 'Enregistrer'}</span>
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
