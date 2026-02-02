import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Monitor, PhoneOff, ChevronLeft, ChevronRight,
  ExternalLink, FileText
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function CallRoom() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const callId = searchParams.get('id');
  const contactName = searchParams.get('name') || 'Appel';

  // --- STATE ---
  const [isScriptOpen, setIsScriptOpen] = useState(true);
  const [userScript, setUserScript] = useState("Chargement du script...");
  const [notes, setNotes] = useState("");
  
  // Timer de l'appel (Durée de la séance)
  const [callDuration, setCallDuration] = useState(0);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // --- 1. CHARGEMENT DU SCRIPT ---
  useEffect(() => {
    async function loadScript() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('user_scripts').select('content').eq('user_id', user.id).single();
      if (data?.content) setUserScript(data.content);
    }
    loadScript();
  }, []);

  // --- 2. TIMER GLOBAL (DURÉE APPEL) ---
  useEffect(() => {
    const timer = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // --- 3. TIMER ENREGISTREMENT ---
  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
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

  // --- 4. ENREGISTREMENT SCREEN ---
  const startRecording = async () => {
    try {
      chunksRef.current = [];
      // On demande l'écran (Vidéo + Audio système) + Micro
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const tracks = [...displayStream.getVideoTracks(), ...displayStream.getAudioTracks(), ...micStream.getAudioTracks()];
      const combinedStream = new MediaStream(tracks);
      streamRef.current = combinedStream;

      const recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm;codecs=vp9,opus' });
      
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `Enregistrement_${contactName}_${new Date().toISOString().slice(0,10)}.mp4`;
        document.body.appendChild(a);
        a.click();
        
        // Stop all tracks
        combinedStream.getTracks().forEach(t => t.stop());
        displayStream.getTracks().forEach(t => t.stop());
        micStream.getTracks().forEach(t => t.stop());
      };

      displayStream.getVideoTracks()[0].onended = () => stopRecording();

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      alert("Erreur: Impossible de lancer l'enregistrement. Vérifiez les permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // --- 5. QUITTER ET REDIRIGER VERS LE FORMULAIRE ---
  const handleLeave = async () => {
    // 1. Arrêter l'enregistrement si actif
    if (isRecording) {
      stopRecording();
      await new Promise(r => setTimeout(r, 2000)); // Attendre le téléchargement
    }

    // 2. Mettre à jour la durée dans Supabase (pour que le résumé ait la bonne durée)
    if (callId) {
        try {
            await supabase.from('calls').update({
                duration: formatDuration(callDuration),
                // On pourrait aussi sauvegarder les notes partielles ici si besoin
                // notes: notes 
            }).eq('id', callId);
        } catch (e) {
            console.error("Erreur sauvegarde durée", e);
        }
    }

    // 3. Redirection vers la page de Qualification (CallDetails)
    if (callId) {
        // --- MODIFICATION ICI : TRANSMISSION DES NOTES ---
        navigate(`/appels/${callId}`, { state: { liveNotes: notes } });
    } else {
        navigate('/'); // Fallback si pas d'ID
    }
  };

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-white flex-col font-sans">
      
      {/* --- HEADER (BARRE DE CONTRÔLE) --- */}
      <div className="h-16 border-b border-slate-800 bg-slate-900 px-6 flex items-center justify-between shadow-md z-50">
        <div className="flex items-center gap-4">
            <div className="bg-blue-600/20 text-blue-400 p-2 rounded-lg">
                <Monitor className="h-5 w-5" />
            </div>
            <div>
                <h1 className="font-bold text-lg">{contactName}</h1>
                
                {/* INDICATEUR EN LIGNE + TIMER */}
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                    <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="font-medium text-emerald-400">En ligne</span>
                    </div>
                    <span className="text-slate-600">•</span>
                    <span className="font-mono text-slate-300 font-medium tracking-wide">
                        {formatDuration(callDuration)}
                    </span>
                </div>
            </div>
        </div>

        <div className="flex items-center gap-3">
            <button 
                onClick={() => window.open('https://meet.google.com', '_blank')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-sm font-medium transition-colors"
            >
                <ExternalLink className="h-4 w-4" />
                Meet
            </button>

            <button 
                onClick={isRecording ? stopRecording : startRecording}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    isRecording 
                    ? 'bg-red-500/10 text-red-500 border border-red-500/50 animate-pulse' 
                    : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                }`}
            >
                {isRecording ? (
                    <>
                        <div className="h-3 w-3 rounded-full bg-red-500"></div>
                        {formatDuration(recordingSeconds)}
                    </>
                ) : (
                    <>
                        <div className="h-3 w-3 rounded-full bg-slate-400"></div>
                        Enregistrer l'écran
                    </>
                )}
            </button>

            <button 
                onClick={() => setIsScriptOpen(!isScriptOpen)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${isScriptOpen ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-700 hover:bg-slate-800'}`}
            >
                <FileText className="h-4 w-4" />
                SCRIPT
            </button>

            <div className="h-8 w-px bg-slate-800 mx-2"></div>

            <button 
                onClick={handleLeave}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-lg transition-colors"
            >
                <PhoneOff className="h-4 w-4" />
                Fin
            </button>
        </div>
      </div>

      {/* --- MAIN CONTENT --- */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* VOLET GAUCHE : SCRIPT */}
        <div className={`transition-all duration-300 border-r border-slate-800 bg-slate-900 flex flex-col ${isScriptOpen ? 'w-1/3' : 'w-0 overflow-hidden opacity-0'}`}>
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <h3 className="font-bold text-blue-400 text-sm tracking-wider flex items-center gap-2">
                    <FileText className="h-4 w-4" /> SCRIPT DE VENTE
                </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
                <div className="prose prose-invert prose-sm max-w-none text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {userScript}
                </div>
            </div>
        </div>

        {/* VOLET DROIT : NOTES */}
        <div className="flex-1 flex flex-col bg-slate-950 relative">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/30">
                <h3 className="font-bold text-slate-400 text-sm tracking-wider flex items-center gap-2">
                    <FileText className="h-4 w-4" /> PRISE DE NOTES
                </h3>
                <span className="text-xs text-slate-500">Sauvegarde auto</span>
            </div>
            
            <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Commencez à écrire vos notes ici... (Situation actuelle, Douleurs, Objectifs, Budget...)"
                className="flex-1 w-full bg-transparent p-8 text-white placeholder-slate-600 resize-none focus:outline-none text-lg leading-relaxed font-light"
                autoFocus
            />
        </div>

      </div>
    </div>
  );
}