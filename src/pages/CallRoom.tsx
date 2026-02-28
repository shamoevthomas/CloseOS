import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
    Monitor, PhoneOff, ChevronDown, ExternalLink, FileText,
    Briefcase, BookOpen, ScrollText, Tag, Mic, Video, Settings,
    MessageSquare // Ajout pour le chat/notes si besoin
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

// Interfaces pour les données
interface Script {
    id: number | string
    title: string
    content: string
}

interface Offer {
    id: number
    name: string
    price: string
    commission: string
    notes: string // Notes de closing
    formulas: any[] // JSONB
    resources: any[] // JSONB
}

export default function CallRoom() {
    const { user } = useAuth();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const callId = searchParams.get('id');
    const contactName = searchParams.get('name') || 'Appel';

    // --- STATE PRINCIPAL ---
    const [isPanelOpen, setIsPanelOpen] = useState(true);
    const [notes, setNotes] = useState("");
    const [callDuration, setCallDuration] = useState(0);

    // --- STATE SCRIPTS ---
    const [scripts, setScripts] = useState<Script[]>([]);
    const [selectedScriptId, setSelectedScriptId] = useState<string | number>('');
    const [currentScriptContent, setCurrentScriptContent] = useState("Chargement...");

    // --- STATE OFFRES ---
    const [offers, setOffers] = useState<Offer[]>([]);
    const [selectedOfferId, setSelectedOfferId] = useState<number | string>('');
    const [activeOfferTab, setActiveOfferTab] = useState<'resources' | 'notes' | 'formulas'>('notes');

    // Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [recordingSeconds, setRecordingSeconds] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);

    // --- 1. CHARGEMENT DES DONNÉES (Scripts & Offres) ---
    useEffect(() => {
        let isMounted = true;

        async function loadData() {
            if (!user) return;

            // A. Charger les scripts
            const { data: scriptsData } = await supabase
                .from('user_scripts')
                .select('*')
                .eq('user_id', user.id)
                .order('id', { ascending: true });

            if (!isMounted) return;

            if (scriptsData && scriptsData.length > 0) {
                setScripts(scriptsData);
                setSelectedScriptId(scriptsData[0].id);
                setCurrentScriptContent(scriptsData[0].content);
            } else {
                setCurrentScriptContent("Aucun script trouvé.");
            }

            // B. Charger les offres actives
            const { data: offersData } = await supabase
                .from('offers')
                .select('*')
                .eq('status', 'active');

            if (!isMounted) return;

            if (offersData && offersData.length > 0) {
                setOffers(offersData);
                setSelectedOfferId(offersData[0].id);
            }
        }
        loadData();
        return () => { isMounted = false };
    }, [user?.id]);

    // Changement de script
    useEffect(() => {
        if (selectedScriptId) {
            const script = scripts.find(s => String(s.id) === String(selectedScriptId));
            if (script) setCurrentScriptContent(script.content);
        }
    }, [selectedScriptId, scripts]);

    // Offre sélectionnée
    const currentOffer = offers.find(o => String(o.id) === String(selectedOfferId));

    // --- 2. TIMERS ---
    useEffect(() => {
        const timer = setInterval(() => setCallDuration(prev => prev + 1), 1000);
        return () => clearInterval(timer);
    }, []);

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

    // --- 3. ENREGISTREMENT ---
    const startRecording = async () => {
        try {
            chunksRef.current = [];
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
                a.download = `Enregistrement_${contactName}_${new Date().toISOString().slice(0, 10)}.mp4`;
                document.body.appendChild(a);
                a.click();

                combinedStream.getTracks().forEach(t => t.stop());
                displayStream.getTracks().forEach(t => t.stop());
                micStream.getTracks().forEach(t => t.stop());
            };

            displayStream.getVideoTracks()[0].onended = () => stopRecording();

            recorder.start(1000);
            mediaRecorderRef.current = recorder;
            setIsRecording(true);
        } catch (err) {
            alert("Impossible de lancer l'enregistrement.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    // --- 4. QUITTER ---
    const handleLeave = async () => {
        if (isRecording) {
            stopRecording();
            await new Promise(r => setTimeout(r, 2000));
        }

        if (callId) {
            try {
                await supabase.from('call_history').update({
                    duration: formatDuration(callDuration),
                    status: 'completed', // On marque comme terminé
                    ended_at: new Date().toISOString()
                }).eq('id', callId);
            } catch (e) {
                console.error("Erreur sauvegarde durée", e);
            }
        }

        if (callId) {
            navigate(`/appels/${callId}`, { state: { liveNotes: notes } });
        } else {
            navigate('/');
        }
    };

    return (
        <div className="flex h-screen w-screen bg-[#020617] text-slate-100 flex-col font-sans overflow-hidden relative selection:bg-blue-500/30">

            {/* Background Ambience Bloom */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-blue-600/10 opacity-30 blur-[120px] rounded-full pointer-events-none mix-blend-screen z-0" />
            <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-purple-600/10 opacity-20 blur-[100px] rounded-full pointer-events-none mix-blend-screen z-0" />

            {/* --- HEADER --- */}
            <div className="h-16 shrink-0 border-b border-white/5 bg-[#020617]/80 backdrop-blur-md px-6 flex items-center justify-between shadow-lg z-50 relative">
                <div className="flex items-center gap-4">
                    <div className="bg-blue-600/20 text-blue-400 p-2 rounded-lg">
                        <Monitor className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg">{contactName}</h1>
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
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${isRecording
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
                                Enregistrer
                            </>
                        )}
                    </button>

                    <button
                        onClick={() => setIsPanelOpen(!isPanelOpen)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${isPanelOpen ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-700 hover:bg-slate-800'}`}
                    >
                        <FileText className="h-4 w-4" />
                        PANNEAU GAUCHE
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

                {/* === VOLET GAUCHE (SCRIPT + OFFRE) === */}
                <div className={`transition-all duration-300 border-r border-slate-800 bg-slate-900 flex flex-col ${isPanelOpen ? 'w-5/12' : 'w-0 overflow-hidden opacity-0'}`}>

                    {/* 1. PARTIE HAUTE : SCRIPT DE VENTE (50%) */}
                    <div className="h-1/2 flex flex-col border-b border-slate-800">
                        <div className="p-3 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-blue-400" />
                                <span className="text-xs font-bold text-blue-400 tracking-wider">SCRIPT</span>
                            </div>
                            {/* Sélecteur de Script */}
                            <div className="relative group">
                                <select
                                    value={selectedScriptId}
                                    onChange={(e) => setSelectedScriptId(e.target.value)}
                                    className="appearance-none bg-slate-800 border border-slate-700 hover:border-slate-600 text-white text-xs rounded-md px-3 py-1.5 pr-8 focus:outline-none focus:border-blue-500 cursor-pointer min-w-[150px]"
                                >
                                    {scripts.map(s => (
                                        <option key={s.id} value={s.id}>{s.title || 'Sans titre'}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 bg-slate-900">
                            <div className="prose prose-invert prose-sm max-w-none text-slate-300 whitespace-pre-wrap leading-relaxed font-normal">
                                {currentScriptContent}
                            </div>
                        </div>
                    </div>

                    {/* 2. PARTIE BASSE : DÉTAILS OFFRE (50%) */}
                    <div className="h-1/2 flex flex-col bg-slate-800/20">

                        {/* Header Offre */}
                        <div className="p-3 border-b border-slate-800 bg-slate-900/50 flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Briefcase className="h-4 w-4 text-purple-400" />
                                    <span className="text-xs font-bold text-purple-400 tracking-wider">OFFRE & RESSOURCES</span>
                                </div>
                                {/* Sélecteur d'Offre */}
                                <div className="relative group">
                                    <select
                                        value={selectedOfferId}
                                        onChange={(e) => setSelectedOfferId(e.target.value)}
                                        className="appearance-none bg-slate-800 border border-slate-700 hover:border-slate-600 text-white text-xs rounded-md px-3 py-1.5 pr-8 focus:outline-none focus:border-purple-500 cursor-pointer min-w-[150px]"
                                    >
                                        {offers.map(o => (
                                            <option key={o.id} value={o.id}>{o.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
                                </div>
                            </div>

                            {/* Onglets Offre */}
                            <div className="flex gap-1 bg-slate-950/50 p-1 rounded-lg">
                                <button
                                    onClick={() => setActiveOfferTab('notes')}
                                    className={cn("flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5", activeOfferTab === 'notes' ? "bg-purple-600 text-white shadow" : "text-slate-400 hover:text-white hover:bg-slate-800")}
                                >
                                    <ScrollText className="h-3 w-3" /> Notes Closing
                                </button>
                                <button
                                    onClick={() => setActiveOfferTab('formulas')}
                                    className={cn("flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5", activeOfferTab === 'formulas' ? "bg-purple-600 text-white shadow" : "text-slate-400 hover:text-white hover:bg-slate-800")}
                                >
                                    <Tag className="h-3 w-3" /> Formules
                                </button>
                                <button
                                    onClick={() => setActiveOfferTab('resources')}
                                    className={cn("flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5", activeOfferTab === 'resources' ? "bg-purple-600 text-white shadow" : "text-slate-400 hover:text-white hover:bg-slate-800")}
                                >
                                    <BookOpen className="h-3 w-3" /> Ressources
                                </button>
                            </div>
                        </div>

                        {/* Contenu Offre */}
                        <div className="flex-1 overflow-y-auto p-4 bg-slate-900">
                            {!currentOffer ? (
                                <p className="text-sm text-slate-500 text-center mt-10">Sélectionnez une offre pour voir les détails.</p>
                            ) : (
                                <>
                                    {/* Onglet: Notes de Closing */}
                                    {activeOfferTab === 'notes' && (
                                        <div className="prose prose-invert prose-sm max-w-none">
                                            <p className="text-slate-300 whitespace-pre-wrap">{currentOffer.notes || "Aucune note de closing."}</p>
                                        </div>
                                    )}

                                    {/* Onglet: Formules */}
                                    {activeOfferTab === 'formulas' && (
                                        <div className="space-y-3">
                                            {currentOffer.formulas && Array.isArray(currentOffer.formulas) && currentOffer.formulas.length > 0 ? (
                                                currentOffer.formulas.map((formula, idx) => (
                                                    <div key={idx} className="p-3 rounded-lg border border-slate-800 bg-slate-800/30 flex justify-between items-center">
                                                        <div>
                                                            <p className="font-semibold text-white text-sm">{formula.name}</p>
                                                            {formula.description && <p className="text-xs text-slate-500 mt-0.5">{formula.description}</p>}
                                                        </div>
                                                        <span className="text-emerald-400 font-bold text-sm">{formula.price}€</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-sm text-slate-500">Aucune formule configurée.</p>
                                            )}
                                        </div>
                                    )}

                                    {/* Onglet: Ressources */}
                                    {activeOfferTab === 'resources' && (
                                        <ul className="space-y-2">
                                            {currentOffer.resources && Array.isArray(currentOffer.resources) && currentOffer.resources.length > 0 ? (
                                                currentOffer.resources.map((res, idx) => (
                                                    <li key={idx}>
                                                        <a
                                                            href={res.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-2 p-2 rounded-lg border border-slate-800 bg-slate-800/30 hover:bg-slate-800 hover:border-purple-500/50 transition-all group"
                                                        >
                                                            <ExternalLink className="h-3.5 w-3.5 text-purple-400 group-hover:text-white" />
                                                            <span className="text-sm text-slate-300 group-hover:text-white group-hover:underline decoration-purple-500 underline-offset-4">{res.title || res.url}</span>
                                                        </a>
                                                    </li>
                                                ))
                                            ) : (
                                                <p className="text-sm text-slate-500">Aucune ressource disponible.</p>
                                            )}
                                        </ul>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* === VOLET DROIT : NOTES (Reste le même mais plus large si panneau fermé) === */}
                <div className="flex-1 flex flex-col bg-slate-950 relative border-l border-slate-800">
                    <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/30">
                        <h3 className="font-bold text-slate-400 text-sm tracking-wider flex items-center gap-2">
                            <FileText className="h-4 w-4" /> PRISE DE NOTES
                        </h3>
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                            <span className="text-xs text-slate-500">Sauvegarde auto</span>
                        </div>
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