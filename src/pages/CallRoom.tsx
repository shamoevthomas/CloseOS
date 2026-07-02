import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
    Monitor, PhoneOff, ChevronDown, ExternalLink, FileText,
    Briefcase, BookOpen, ScrollText, Tag, Mic, Video, Settings,
    MessageSquare, User
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useProspects } from '../contexts/ProspectsContext';
import { ProspectView } from '../components/ProspectView';
import { cn } from '../lib/utils';
import { useLanguage } from '../contexts/LanguageContext';

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
    const { lang } = useLanguage();
    const { prospects, updateProspect, deleteProspect } = useProspects();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const callIdFromParams = searchParams.get('id');
    const contactName = searchParams.get('name') || (lang === 'fr' ? 'Appel' : 'Call');
    const prospectIdFromParams = searchParams.get('prospectId');
    const fromPage = searchParams.get('from') || '/';

    // Ref pour stocker le callId (soit depuis les params, soit auto-créé)
    const callIdRef = useRef<string | null>(callIdFromParams);

    // Prospect view
    const [showProspectView, setShowProspectView] = useState(false);
    const prospect = prospectIdFromParams ? prospects.find(p => String(p.id) === prospectIdFromParams) : null;

    // Previous call notes
    const [selectedPreviousNote, setSelectedPreviousNote] = useState<string>('');
    const previousNotes = (prospect?.call_notes || []).filter((n: any) => n.content?.trim());

    // --- STATE PRINCIPAL ---
    const [isPanelOpen, setIsPanelOpen] = useState(true);
    const [notes, setNotes] = useState("");
    const [callDuration, setCallDuration] = useState(0);

    // --- STATE SCRIPTS ---
    const [scripts, setScripts] = useState<Script[]>([]);
    const [selectedScriptId, setSelectedScriptId] = useState<string | number>('');
    const [currentScriptContent, setCurrentScriptContent] = useState(lang === 'fr' ? "Chargement..." : "Loading...");

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

    // --- 1. CHARGEMENT DES DONNÉES (Scripts & Offres) + Auto-création call_history ---
    useEffect(() => {
        let isMounted = true;

        async function loadData() {
            if (!user) return;

            // 0. Si pas de callId, créer un enregistrement call_history
            if (!callIdRef.current) {
                try {
                    const { data: newCall } = await supabase
                        .from('call_history')
                        .insert([{
                            user_id: user.id,
                            contactId: 0,
                            contactName: contactName,
                            contactType: 'prospect',
                            date: new Date().toISOString(),
                            duration: 'En cours...',
                            isAi: false,
                            answered: true
                        }])
                        .select()
                        .single();

                    if (newCall && isMounted) {
                        callIdRef.current = String(newCall.id);
                    }
                } catch (err) {
                    console.error('Erreur création call_history:', err);
                }
            }

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
                setCurrentScriptContent(lang === 'fr' ? "Aucun script trouvé." : "No script found.");
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

            // MediaRecorder n'encode QUE la première piste audio d'un MediaStream : mettre
            // l'audio de l'onglet et le micro comme deux pistes séparées faisait perdre le
            // micro. On mixe les deux sources en une seule piste via l'API Web Audio.
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            const audioCtx = new AudioCtx();
            const mixDest = audioCtx.createMediaStreamDestination();
            if (displayStream.getAudioTracks().length) audioCtx.createMediaStreamSource(displayStream).connect(mixDest);
            if (micStream.getAudioTracks().length) audioCtx.createMediaStreamSource(micStream).connect(mixDest);

            const combinedStream = new MediaStream([
                ...displayStream.getVideoTracks(),
                ...mixDest.stream.getAudioTracks(),
            ]);
            streamRef.current = combinedStream;

            // Préfère un vrai conteneur MP4 (H.264/AAC) si le navigateur le supporte,
            // sinon repli honnête en webm (extension cohérente avec le contenu).
            const candidates = [
                'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
                'video/mp4;codecs=h264,aac',
                'video/mp4',
                'video/webm;codecs=vp9,opus',
                'video/webm;codecs=vp8,opus',
                'video/webm',
            ];
            const mimeType = candidates.find(tp => MediaRecorder.isTypeSupported(tp)) || '';
            const isMp4 = mimeType.startsWith('video/mp4');
            const recorder = mimeType ? new MediaRecorder(combinedStream, { mimeType }) : new MediaRecorder(combinedStream);

            recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };

            recorder.onstop = () => {
                const outType = isMp4 ? 'video/mp4' : 'video/webm';
                const ext = isMp4 ? 'mp4' : 'webm';
                const blob = new Blob(chunksRef.current, { type: outType });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `Enregistrement_${contactName}_${new Date().toISOString().slice(0, 10)}.${ext}`;
                document.body.appendChild(a);
                a.click();
                URL.revokeObjectURL(url);

                combinedStream.getTracks().forEach(t => t.stop());
                displayStream.getTracks().forEach(t => t.stop());
                micStream.getTracks().forEach(t => t.stop());
                audioCtx.close().catch(() => {});
            };

            displayStream.getVideoTracks()[0].onended = () => stopRecording();

            recorder.start(1000);
            mediaRecorderRef.current = recorder;
            setIsRecording(true);
        } catch (err) {
            alert(lang === 'fr' ? "Impossible de lancer l'enregistrement." : "Unable to start recording.");
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

        const finalCallId = callIdRef.current;

        if (finalCallId) {
            try {
                await supabase.from('call_history').update({
                    duration: formatDuration(callDuration),
                    status: 'completed',
                    ended_at: new Date().toISOString()
                }).eq('id', finalCallId);
            } catch (e) {
                console.error("Erreur sauvegarde durée", e);
            }
            // Toujours ouvrir CallDetail avec les notes
            navigate(`/appels/${finalCallId}`, { state: { liveNotes: notes } });
        } else {
            // Fallback si la création a échoué
            navigate(fromPage);
        }
    };

    return (
        <div className="flex h-screen w-screen bg-[#020617] text-white/80 flex-col font-sans overflow-hidden relative selection:bg-emerald-500/30">

            {/* Background Ambience Bloom */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-emerald-600/10 opacity-30 blur-[120px] rounded-full pointer-events-none mix-blend-screen z-0" />
            <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-purple-600/10 opacity-20 blur-[100px] rounded-full pointer-events-none mix-blend-screen z-0" />

            {/* --- HEADER --- */}
            <div className="h-16 shrink-0 border-b border-white/5 bg-[#020617]/80 backdrop-blur-md px-6 flex items-center justify-between shadow-lg z-50 relative">
                <div className="flex items-center gap-4">
                    <div className="bg-emerald-500/20 text-emerald-400 p-2 rounded-lg">
                        <Monitor className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg">{contactName}</h1>
                        <div className="flex items-center gap-2 text-xs text-white/40 mt-0.5">
                            <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span className="font-medium text-emerald-400">{lang === 'fr' ? 'En ligne' : 'Online'}</span>
                            </div>
                            <span className="text-white/10">•</span>
                            <span className="font-mono text-white/60 font-medium tracking-wide">
                                {formatDuration(callDuration)}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {prospect && (
                        <button
                            onClick={() => setShowProspectView(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-sm font-medium transition-colors"
                        >
                            <User className="h-4 w-4" />
                            {lang === 'fr' ? 'Fiche Prospect' : 'Prospect Sheet'}
                        </button>
                    )}

                    <button
                        onClick={() => window.open('https://meet.google.com', '_blank')}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/[0.08] hover:bg-white/5 text-sm font-medium transition-colors"
                    >
                        <ExternalLink className="h-4 w-4" />
                        Meet
                    </button>

                    <button
                        onClick={isRecording ? stopRecording : startRecording}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${isRecording
                            ? 'bg-red-500/10 text-red-500 border border-red-500/50 animate-pulse'
                            : 'bg-white/5 hover:bg-white/10 text-white border border-white/[0.08]'
                            }`}
                    >
                        {isRecording ? (
                            <>
                                <div className="h-3 w-3 rounded-full bg-red-500"></div>
                                {formatDuration(recordingSeconds)}
                            </>
                        ) : (
                            <>
                                <div className="h-3 w-3 rounded-full bg-white/40"></div>
                                {lang === 'fr' ? 'Enregistrer' : 'Record'}
                            </>
                        )}
                    </button>

                    <button
                        onClick={() => setIsPanelOpen(!isPanelOpen)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${isPanelOpen ? 'bg-emerald-500 border-emerald-500 text-black' : 'border-white/[0.08] hover:bg-white/5'}`}
                    >
                        <FileText className="h-4 w-4" />
                        {lang === 'fr' ? 'PANNEAU GAUCHE' : 'LEFT PANEL'}
                    </button>

                    <div className="h-8 w-px bg-white/[0.08] mx-2"></div>

                    <button
                        onClick={handleLeave}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-lg transition-colors"
                    >
                        <PhoneOff className="h-4 w-4" />
                        {lang === 'fr' ? 'Fin' : 'End'}
                    </button>
                </div>
            </div>

            {/* --- MAIN CONTENT --- */}
            <div className="flex-1 flex overflow-hidden">

                {/* === VOLET GAUCHE (SCRIPT + OFFRE) === */}
                <div className={`transition-all duration-300 border-r border-white/[0.08] bg-[#1a1a1a] flex flex-col ${isPanelOpen ? 'w-5/12' : 'w-0 overflow-hidden opacity-0'}`}>

                    {/* 1. PARTIE HAUTE : SCRIPT DE VENTE (50%) */}
                    <div className="h-1/2 flex flex-col border-b border-white/[0.08]">
                        <div className="p-3 border-b border-white/[0.08] bg-[#1a1a1a]/50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-emerald-400" />
                                <span className="text-xs font-bold text-emerald-400 tracking-wider">SCRIPT</span>
                            </div>
                            {/* Sélecteur de Script */}
                            <div className="relative group">
                                <select
                                    value={selectedScriptId}
                                    onChange={(e) => setSelectedScriptId(e.target.value)}
                                    className="appearance-none bg-white/5 border border-white/[0.08] hover:border-white/20 text-white text-xs rounded-md px-3 py-1.5 pr-8 focus:outline-none focus:border-emerald-500 cursor-pointer min-w-[150px]"
                                >
                                    {scripts.map(s => (
                                        <option key={s.id} value={s.id}>{s.title || (lang === 'fr' ? 'Sans titre' : 'Untitled')}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-white/40 pointer-events-none" />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 bg-[#1a1a1a]">
                            <div className="prose prose-invert prose-sm max-w-none text-white/60 whitespace-pre-wrap leading-relaxed font-normal">
                                {currentScriptContent}
                            </div>
                        </div>
                    </div>

                    {/* 2. PARTIE BASSE : DÉTAILS OFFRE (50%) */}
                    <div className="h-1/2 flex flex-col bg-white/[0.03]">

                        {/* Header Offre */}
                        <div className="p-3 border-b border-white/[0.08] bg-[#1a1a1a]/50 flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Briefcase className="h-4 w-4 text-purple-400" />
                                    <span className="text-xs font-bold text-purple-400 tracking-wider">{lang === 'fr' ? 'OFFRE & RESSOURCES' : 'OFFER & RESOURCES'}</span>
                                </div>
                                {/* Sélecteur d'Offre */}
                                <div className="relative group">
                                    <select
                                        value={selectedOfferId}
                                        onChange={(e) => setSelectedOfferId(e.target.value)}
                                        className="appearance-none bg-white/5 border border-white/[0.08] hover:border-white/20 text-white text-xs rounded-md px-3 py-1.5 pr-8 focus:outline-none focus:border-purple-500 cursor-pointer min-w-[150px]"
                                    >
                                        {offers.map(o => (
                                            <option key={o.id} value={o.id}>{o.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-white/40 pointer-events-none" />
                                </div>
                            </div>

                            {/* Onglets Offre */}
                            <div className="flex gap-1 bg-[#1a1a1a]/50 p-1 rounded-lg">
                                <button
                                    onClick={() => setActiveOfferTab('notes')}
                                    className={cn("flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5", activeOfferTab === 'notes' ? "bg-purple-600 text-white shadow" : "text-white/40 hover:text-white hover:bg-white/5")}
                                >
                                    <ScrollText className="h-3 w-3" /> {lang === 'fr' ? 'Notes Closing' : 'Closing Notes'}
                                </button>
                                <button
                                    onClick={() => setActiveOfferTab('formulas')}
                                    className={cn("flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5", activeOfferTab === 'formulas' ? "bg-purple-600 text-white shadow" : "text-white/40 hover:text-white hover:bg-white/5")}
                                >
                                    <Tag className="h-3 w-3" /> {lang === 'fr' ? 'Formules' : 'Formulas'}
                                </button>
                                <button
                                    onClick={() => setActiveOfferTab('resources')}
                                    className={cn("flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5", activeOfferTab === 'resources' ? "bg-purple-600 text-white shadow" : "text-white/40 hover:text-white hover:bg-white/5")}
                                >
                                    <BookOpen className="h-3 w-3" /> Ressources
                                </button>
                            </div>
                        </div>

                        {/* Contenu Offre */}
                        <div className="flex-1 overflow-y-auto p-4 bg-[#1a1a1a]">
                            {!currentOffer ? (
                                <p className="text-sm text-white/40 text-center mt-10">{lang === 'fr' ? 'Sélectionnez une offre pour voir les détails.' : 'Select an offer to see details.'}</p>
                            ) : (
                                <>
                                    {/* Onglet: Notes de Closing */}
                                    {activeOfferTab === 'notes' && (
                                        <div className="prose prose-invert prose-sm max-w-none">
                                            <p className="text-white/60 whitespace-pre-wrap">{currentOffer.notes || (lang === 'fr' ? "Aucune note de closing." : "No closing notes.")}</p>
                                        </div>
                                    )}

                                    {/* Onglet: Formules */}
                                    {activeOfferTab === 'formulas' && (
                                        <div className="space-y-3">
                                            {currentOffer.formulas && Array.isArray(currentOffer.formulas) && currentOffer.formulas.length > 0 ? (
                                                currentOffer.formulas.map((formula, idx) => (
                                                    <div key={idx} className="p-3 rounded-lg border border-white/[0.08] bg-white/[0.03] flex justify-between items-center">
                                                        <div>
                                                            <p className="font-semibold text-white text-sm">{formula.name}</p>
                                                            {formula.description && <p className="text-xs text-white/40 mt-0.5">{formula.description}</p>}
                                                        </div>
                                                        <span className="text-emerald-400 font-bold text-sm">{formula.price}€</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-sm text-white/40">{lang === 'fr' ? 'Aucune formule configurée.' : 'No formulas configured.'}</p>
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
                                                            className="flex items-center gap-2 p-2 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/5 hover:border-purple-500/50 transition-all group"
                                                        >
                                                            <ExternalLink className="h-3.5 w-3.5 text-purple-400 group-hover:text-white" />
                                                            <span className="text-sm text-white/60 group-hover:text-white group-hover:underline decoration-purple-500 underline-offset-4">{res.title || res.url}</span>
                                                        </a>
                                                    </li>
                                                ))
                                            ) : (
                                                <p className="text-sm text-white/40">{lang === 'fr' ? 'Aucune ressource disponible.' : 'No resources available.'}</p>
                                            )}
                                        </ul>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* === VOLET DROIT : NOTES (Reste le même mais plus large si panneau fermé) === */}
                <div className="flex-1 flex flex-col bg-[#1a1a1a] relative border-l border-white/[0.08]">
                    <div className="p-4 border-b border-white/[0.08] flex items-center gap-4 bg-[#1a1a1a]/30">
                        <h3 className="font-bold text-white/40 text-sm tracking-wider flex items-center gap-2">
                            <FileText className="h-4 w-4" /> {lang === 'fr' ? 'PRISE DE NOTES' : 'NOTES'}
                        </h3>

                        {/* Previous notes tabs */}
                        {previousNotes.length > 0 && (
                            <div className="flex items-center gap-1.5 ml-2">
                                <button
                                    onClick={() => setSelectedPreviousNote('')}
                                    className={cn(
                                        "px-3 py-1 rounded-full text-xs font-semibold transition-all",
                                        !selectedPreviousNote
                                            ? "bg-emerald-500 text-black"
                                            : "bg-white/5 text-white/40 hover:text-white hover:bg-white/10"
                                    )}
                                >
                                    {lang === 'fr' ? 'Actuelles' : 'Current'}
                                </button>
                                {previousNotes.map((n: any) => (
                                    <button
                                        key={n.id}
                                        onClick={() => setSelectedPreviousNote(n.id)}
                                        className={cn(
                                            "px-3 py-1 rounded-full text-xs font-semibold transition-all",
                                            selectedPreviousNote === n.id
                                                ? "bg-emerald-500 text-black"
                                                : "bg-white/5 text-white/40 hover:text-white hover:bg-white/10"
                                        )}
                                    >
                                        {new Date(n.date).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { day: '2-digit', month: 'short' })}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="flex items-center gap-2 ml-auto">
                            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                            <span className="text-xs text-white/40">{lang === 'fr' ? 'Sauvegarde auto' : 'Auto-save'}</span>
                        </div>
                    </div>

                    {selectedPreviousNote ? (
                        <div className="flex-1 w-full p-8 text-white/60 text-lg leading-relaxed font-light whitespace-pre-wrap overflow-y-auto">
                            {previousNotes.find((n: any) => n.id === selectedPreviousNote)?.content || (lang === 'fr' ? 'Aucune note' : 'No notes')}
                        </div>
                    ) : (
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder={lang === 'fr' ? "Commencez à écrire vos notes ici... (Situation actuelle, Douleurs, Objectifs, Budget...)" : "Start writing your notes here... (Current situation, Pain points, Goals, Budget...)"}
                            className="flex-1 w-full bg-transparent p-8 text-white placeholder-white/10 resize-none focus:outline-none text-lg leading-relaxed font-light"
                            autoFocus
                        />
                    )}
                </div>

            </div>

            {/* Prospect View Modal */}
            {showProspectView && prospect && (
                <ProspectView
                    prospect={prospect}
                    onClose={() => setShowProspectView(false)}
                    onUpdate={(id, updates) => updateProspect(id, updates)}
                    onDelete={(id) => { deleteProspect(id); setShowProspectView(false); }}
                />
            )}
        </div>
    );
}