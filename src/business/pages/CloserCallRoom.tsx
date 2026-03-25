import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Monitor, PhoneOff, ChevronDown, ChevronUp, ExternalLink, FileText,
  Briefcase, BookOpen, ScrollText, Tag, User, Clock,
  Bold, List, Share2, Mic, Zap, Settings, Package, Copy, Check,
  Download, Mail, X, Loader2, Send,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessProspects, type BusinessProspect } from '../contexts/BusinessProspectsContext'
import { BusinessProspectView } from '../components/BusinessProspectView'
import { cn } from '../../lib/utils'

interface Script {
  id: number | string
  title: string
  content: string
}

interface Offer {
  id: number | string
  name: string
  price: string
  commission: string
  notes: string
  formulas: any[]
  resources: any[]
}

export function CloserCallRoom() {
  const { teamMember, ownerUserId, user, isTeamMember } = useBusinessAuth()
  const effectiveOwnerId = ownerUserId || user?.id
  const { prospects, updateProspect, deleteProspect } = useBusinessProspects()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const callIdFromParams = searchParams.get('id')
  const contactName = searchParams.get('name') || 'Appel'
  const prospectIdFromParams = searchParams.get('prospectId')
  const callIdRef = useRef<string | null>(callIdFromParams)

  // Prospect view
  const [showProspectView, setShowProspectView] = useState(false)
  const prospect = prospectIdFromParams ? prospects.find(p => String(p.id) === prospectIdFromParams) : null

  // Previous call notes from prospect's call_notes field
  const [selectedPreviousNote, setSelectedPreviousNote] = useState<string>('')

  const [isPanelOpen, setIsPanelOpen] = useState(true)
  const [notes, setNotes] = useState('')
  const [callDuration, setCallDuration] = useState(0)

  // Scripts
  const [scripts, setScripts] = useState<Script[]>([])
  const [selectedScriptId, setSelectedScriptId] = useState<string | number>('')
  const [currentScriptContent, setCurrentScriptContent] = useState('Chargement...')

  // Offers
  const [offers, setOffers] = useState<Offer[]>([])
  const [selectedOfferId, setSelectedOfferId] = useState<number | string>('')
  const [activeOfferTab, setActiveOfferTab] = useState<'formulas' | 'resources'>('formulas')

  // All business formulas
  const [allFormulas, setAllFormulas] = useState<any[]>([])
  const [expandedFormulas, setExpandedFormulas] = useState<Set<string>>(new Set())
  const [selectedResourceFormulaId, setSelectedResourceFormulaId] = useState<string>('')
  const [copiedResourceIdx, setCopiedResourceIdx] = useState<number | null>(null)
  const [emailModal, setEmailModal] = useState<{ url: string; name: string } | null>(null)
  const [emailTo, setEmailTo] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  // Recording
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  // Get previous notes from prospect's call_notes
  const previousNotes = (prospect?.call_notes || []).filter((n: any) => n.content?.trim())

  // Load scripts + offers
  useEffect(() => {
    if (!effectiveOwnerId) return
    let mounted = true

    async function loadData() {
      // Load scripts — same logic as CloserAppels
      const isOwnerView = !isTeamMember || teamMember?.role === 'Head of Sales' || teamMember?.role === 'Admin'
      const scriptQuery = isOwnerView
        ? supabase.from('business_user_scripts').select('*').eq('business_owner_id', effectiveOwnerId!).order('id')
        : supabase.from('business_user_scripts').select('*').eq('team_member_id', teamMember!.id).order('id')
      const { data: scriptsData } = await scriptQuery

      if (!mounted) return

      if (scriptsData && scriptsData.length > 0) {
        setScripts(scriptsData)
        setSelectedScriptId(scriptsData[0].id)
        setCurrentScriptContent(scriptsData[0].content)
      } else {
        setCurrentScriptContent('Aucun script trouvé.')
      }

      // Load all business formulas
      try {
        const fRes = await fetch(`/api/business?action=formulas-list&user_id=${effectiveOwnerId}`)
        const fData = await fRes.json()
        if (!mounted) return
        if (fData.formulas) setAllFormulas(fData.formulas.filter((f: any) => f.is_active))
      } catch {}

      try {
        const res = await fetch(`/api/business?action=offers-list&user_id=${effectiveOwnerId}`)
        const data = await res.json()
        if (!mounted) return
        const offersArr = Array.isArray(data) ? data : data?.offers || []
        const activeOffers = offersArr.filter((o: any) => o.status === 'active')
        if (activeOffers.length > 0) {
          setOffers(activeOffers)
          setSelectedOfferId(activeOffers[0].id)
        }
      } catch {
        const { data: offersData } = await supabase
          .from('offers')
          .select('*')
          .eq('user_id', effectiveOwnerId)
          .eq('status', 'active')
        if (!mounted) return
        if (offersData && offersData.length > 0) {
          setOffers(offersData)
          setSelectedOfferId(offersData[0].id)
        }
      }
    }

    loadData()
    return () => { mounted = false }
  }, [teamMember?.id, effectiveOwnerId])

  useEffect(() => {
    if (selectedScriptId) {
      const s = scripts.find(s => String(s.id) === String(selectedScriptId))
      if (s) setCurrentScriptContent(s.content)
    }
  }, [selectedScriptId, scripts])

  const currentOffer = offers.find(o => String(o.id) === String(selectedOfferId))

  // Timer
  useEffect(() => {
    const timer = setInterval(() => setCallDuration(prev => prev + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    let interval: any
    if (isRecording) interval = setInterval(() => setRecordingSeconds(s => s + 1), 1000)
    else setRecordingSeconds(0)
    return () => clearInterval(interval)
  }, [isRecording])

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600).toString().padStart(2, '0')
    const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')
    const secs = (seconds % 60).toString().padStart(2, '0')
    return `${hrs}:${mins}:${secs}`
  }

  const startRecording = async () => {
    try {
      chunksRef.current = []
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const tracks = [...displayStream.getVideoTracks(), ...displayStream.getAudioTracks(), ...micStream.getAudioTracks()]
      const combinedStream = new MediaStream(tracks)
      streamRef.current = combinedStream
      const recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm;codecs=vp9,opus' })
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.style.display = 'none'; a.href = url
        a.download = `Enregistrement_${contactName}_${new Date().toISOString().slice(0, 10)}.mp4`
        document.body.appendChild(a); a.click()
        combinedStream.getTracks().forEach(t => t.stop())
        displayStream.getTracks().forEach(t => t.stop())
        micStream.getTracks().forEach(t => t.stop())
      }
      displayStream.getVideoTracks()[0].onended = () => stopRecording()
      recorder.start(1000)
      mediaRecorderRef.current = recorder
      setIsRecording(true)
    } catch {
      alert("Impossible de lancer l'enregistrement.")
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const handleLeave = async () => {
    if (isRecording) { stopRecording(); await new Promise(r => setTimeout(r, 2000)) }
    let finalCallId = callIdRef.current

    try {
      if (finalCallId) {
        await supabase.from('business_call_history').update({
          duration: formatDuration(callDuration),
          notes,
        }).eq('id', finalCallId)
      } else if (effectiveOwnerId) {
        const { data, error } = await supabase.from('business_call_history').insert({
          team_member_id: teamMember?.id || null,
          business_owner_id: effectiveOwnerId,
          contact_name: contactName,
          contact_id: prospectIdFromParams ? Number(prospectIdFromParams) : null,
          prospect_id: prospectIdFromParams ? Number(prospectIdFromParams) : null,
          duration: formatDuration(callDuration),
          notes,
          answered: true,
        }).select().single()
        if (error) {
          console.error('Erreur création appel:', error.message, error.details, error.hint)
        }
        if (data) finalCallId = data.id
      }
    } catch (e) {
      console.error('Erreur sauvegarde appel:', e)
    }

    // Always navigate out, even if save failed
    if (finalCallId) {
      navigate(`/business/appels/${finalCallId}`, { state: { liveNotes: notes } })
    } else {
      navigate('/business/appels')
    }
  }

  return (
    <div className="flex h-screen w-screen bg-[#fbf9f8] dark:bg-neutral-900 text-stone-900 dark:text-white flex-col overflow-hidden relative" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* ─── TopAppBar ─── */}
      <header className="h-[72px] shrink-0 bg-white/80 dark:bg-white/5 backdrop-blur-xl shadow-[0_20px_40px_rgba(27,28,27,0.04)] px-8 flex items-center justify-between z-50 border-b border-stone-200/10 dark:border-white/10">
        <div className="flex items-center gap-6">
          <span className="font-extrabold text-xl tracking-tighter text-stone-900 dark:text-white">Closer Call Room</span>
          <div className="h-8 w-px bg-stone-200/30 dark:bg-white/10" />
          <div className="flex flex-col">
            <span className="text-sm font-extrabold tracking-tight text-stone-900 dark:text-white">{contactName}</span>
            <div className="flex items-center gap-2">
              {isRecording && (
                <>
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-400">Recording</span>
                  <span className="text-[10px] font-bold text-stone-500">•</span>
                </>
              )}
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-400">{formatDuration(callDuration)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {prospect && (
            <button onClick={() => setShowProspectView(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-stone-200/30 dark:border-white/10 text-sm font-semibold hover:bg-stone-50 dark:hover:bg-white/5 transition-all">
              <ExternalLink className="h-4 w-4" /> Fiche Prospect
            </button>
          )}
          <button onClick={isRecording ? stopRecording : startRecording}
            className={cn("flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all",
              isRecording ? 'bg-red-50 text-red-600 border border-red-200' : 'border border-stone-200/30 dark:border-white/10 text-stone-600 dark:text-neutral-300 hover:bg-stone-50 dark:hover:bg-white/5')}>
            {isRecording ? <><div className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />{formatDuration(recordingSeconds)}</> : <><div className="h-2.5 w-2.5 rounded-full bg-stone-400" />Enregistrer</>}
          </button>
          <button onClick={handleLeave}
            className="px-7 py-2.5 rounded-full bg-red-500 text-white text-sm font-bold shadow-lg shadow-red-500/20 hover:scale-95 active:scale-90 transition-transform">
            Fin d'appel
          </button>
          <button onClick={() => setIsPanelOpen(!isPanelOpen)}
            className="p-2.5 rounded-full hover:bg-stone-100 dark:hover:bg-white/5 transition-all">
            <Settings className="h-5 w-5 text-stone-500 dark:text-neutral-400" />
          </button>
        </div>
      </header>

      {/* ─── Main Cockpit ─── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ─── Left Panel (Script + Offer) ─── */}
        <section className={cn("transition-all duration-500 flex flex-col border-r border-stone-200/10 dark:border-white/10 bg-stone-50/30 dark:bg-neutral-900/50", isPanelOpen ? 'w-[40%]' : 'w-0 overflow-hidden opacity-0')}>

          {/* Upper: Script */}
          <div className="h-1/2 flex flex-col p-7 space-y-5 overflow-hidden">
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold text-2xl tracking-tight text-stone-900 dark:text-white">Script</h2>
              <div className="relative">
                <select value={selectedScriptId} onChange={(e) => setSelectedScriptId(e.target.value)}
                  className="appearance-none bg-white dark:bg-neutral-800 border-none rounded-full px-5 py-2 pr-10 text-xs font-bold shadow-sm focus:ring-2 focus:ring-emerald-600/20 cursor-pointer dark:text-white">
                  {scripts.map(s => <option key={s.id} value={s.id}>{s.title || 'Sans titre'}</option>)}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400 pointer-events-none" />
              </div>
            </div>
            <div className="flex-1 bg-white dark:bg-white/5 rounded-2xl p-7 overflow-y-auto no-scrollbar shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-stone-200/10 dark:border-white/10">
              <div className="space-y-7 max-w-prose">
                <div className="prose prose-sm max-w-none text-stone-800 dark:text-neutral-100 whitespace-pre-wrap leading-relaxed font-medium">{currentScriptContent}</div>
              </div>
            </div>
          </div>

          {/* Lower: Offer & Resources */}
          <div className="h-1/2 flex flex-col p-7 pt-0 space-y-5 overflow-hidden">
            <div className="flex items-center gap-5 border-b border-stone-200/10 dark:border-white/10">
              <button onClick={() => setActiveOfferTab('formulas')}
                className={cn("pb-3 text-sm font-bold border-b-2 transition-all", activeOfferTab === 'formulas' ? 'border-stone-900 dark:border-white text-stone-900 dark:text-white' : 'border-transparent text-stone-400 dark:text-neutral-500 hover:text-stone-600 dark:hover:text-neutral-300')}>
                Formules
              </button>
<button onClick={() => setActiveOfferTab('resources')}
                className={cn("pb-3 text-sm font-semibold transition-all", activeOfferTab === 'resources' ? 'border-b-2 border-stone-900 dark:border-white text-stone-900 dark:text-white' : 'text-stone-400 dark:text-neutral-500 hover:text-stone-600 dark:hover:text-neutral-300')}>
                Ressources
              </button>

              {/* Offer selector */}
              {offers.length > 1 && (
                <div className="relative ml-auto">
                  <select value={selectedOfferId} onChange={(e) => setSelectedOfferId(e.target.value)}
                    className="appearance-none bg-white dark:bg-neutral-800 border-none rounded-full px-4 py-1.5 pr-8 text-xs font-bold shadow-sm focus:ring-2 focus:ring-emerald-600/20 cursor-pointer dark:text-white">
                    {offers.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-stone-400 pointer-events-none" />
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar space-y-3">
              {activeOfferTab === 'formulas' && (
                <div className="space-y-2.5">
                  {allFormulas.length > 0 ? (
                    allFormulas.map((formula: any) => {
                      const isExpandable = formula.billing_type === 'subscription' || formula.billing_type === 'quote'
                      const isExpanded = expandedFormulas.has(formula.id)
                      const toggleExpand = () => {
                        setExpandedFormulas(prev => {
                          const next = new Set(prev)
                          next.has(formula.id) ? next.delete(formula.id) : next.add(formula.id)
                          return next
                        })
                      }

                      return (
                        <div key={formula.id} className="rounded-2xl border border-stone-100 dark:border-white/10 bg-white dark:bg-white/5 overflow-hidden transition-all">
                          {/* Card header */}
                          <div
                            className={cn(
                              'flex items-center gap-3 px-5 py-4',
                              isExpandable && 'cursor-pointer hover:bg-stone-50 dark:hover:bg-white/[0.03] transition-colors'
                            )}
                            onClick={isExpandable ? toggleExpand : undefined}
                          >
                            <div className="flex-1 min-w-0">
                              <h4 className="font-['Manrope'] font-extrabold text-sm text-stone-900 dark:text-white truncate">{formula.name}</h4>
                              {formula.description && !isExpanded && (
                                <p className="text-xs text-stone-400 dark:text-neutral-500 truncate mt-0.5">{formula.description}</p>
                              )}
                            </div>

                            {/* One-time: prix directement affiché, pas de chevron */}
                            {formula.billing_type === 'one_time' && (
                              <span className="text-sm font-black text-emerald-700 dark:text-emerald-400 shrink-0">
                                {formula.price?.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                              </span>
                            )}

                            {/* Subscription: badge + chevron */}
                            {formula.billing_type === 'subscription' && (
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 rounded-full">Abonnement</span>
                                {isExpanded ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
                              </div>
                            )}

                            {/* Quote: badge + chevron */}
                            {formula.billing_type === 'quote' && (
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2.5 py-1 rounded-full">Sur devis</span>
                                {isExpanded ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
                              </div>
                            )}
                          </div>

                          {/* Expanded details */}
                          {isExpanded && (
                            <div className="px-5 pb-5 pt-1 border-t border-stone-100 dark:border-white/5 space-y-3">
                              {formula.description && (
                                <p className="text-xs text-stone-500 dark:text-neutral-400 leading-relaxed">{formula.description}</p>
                              )}

                              {formula.billing_type === 'subscription' && (
                                <div className="space-y-2">
                                  <div className="flex items-baseline justify-between bg-stone-50 dark:bg-white/5 rounded-xl px-4 py-3">
                                    <span className="text-xs font-semibold text-stone-500 dark:text-neutral-400">Mensuel</span>
                                    <span className="font-['Manrope'] text-lg font-extrabold text-stone-900 dark:text-white">
                                      {formula.price?.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €<span className="text-xs font-medium text-stone-400 ml-1">/ mois</span>
                                    </span>
                                  </div>
                                  {formula.yearly_price != null && (
                                    <div className="flex items-baseline justify-between bg-stone-50 dark:bg-white/5 rounded-xl px-4 py-3">
                                      <span className="text-xs font-semibold text-stone-500 dark:text-neutral-400">Annuel</span>
                                      <div className="text-right">
                                        <span className="font-['Manrope'] text-lg font-extrabold text-stone-900 dark:text-white">
                                          {formula.yearly_price.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €<span className="text-xs font-medium text-stone-400 ml-1">/ an</span>
                                        </span>
                                        <div className="text-[10px] text-stone-400 dark:text-neutral-500">
                                          ≈ {(formula.yearly_price / 12).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € / mois
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {formula.billing_type === 'quote' && (
                                <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-4 py-3">
                                  <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">Prix défini selon le projet — contactez pour un devis personnalisé.</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Package className="h-10 w-10 text-stone-200 dark:text-neutral-700 mb-3" />
                      <p className="text-sm font-semibold text-stone-400 dark:text-neutral-500">Aucune formule configurée</p>
                    </div>
                  )}
                </div>
              )}

              {activeOfferTab === 'resources' && (() => {
                const selectedFormula = allFormulas.find((f: any) => f.id === selectedResourceFormulaId)
                const resources: any[] = (selectedFormula?.resources && Array.isArray(selectedFormula.resources)) ? selectedFormula.resources : []

                return (
                  <div className="space-y-4">
                    {allFormulas.length > 0 ? (
                      <>
                        <div className="relative">
                          <select
                            value={selectedResourceFormulaId}
                            onChange={(e) => setSelectedResourceFormulaId(e.target.value)}
                            className="w-full appearance-none bg-white dark:bg-neutral-800 border border-stone-200 dark:border-white/10 rounded-xl px-4 py-3 pr-10 text-sm font-semibold text-stone-900 dark:text-white focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-300 cursor-pointer transition-all"
                          >
                            <option value="">Sélectionnez une formule</option>
                            {allFormulas.map((f: any) => (
                              <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 pointer-events-none" />
                        </div>

                        {selectedFormula ? (
                          resources.length > 0 ? (
                            <ul className="space-y-2">
                              {resources.map((r: any, idx: number) => {
                                const isPdf = r.type === 'PDF' || r.url?.toLowerCase().endsWith('.pdf')
                                return (
                                  <li key={idx} className="flex items-center gap-2 p-4 rounded-2xl border border-stone-100 dark:border-white/10 bg-white dark:bg-white/5">
                                    <a href={r.url} target="_blank" rel="noopener noreferrer"
                                      className="flex items-center gap-2.5 flex-1 min-w-0 hover:text-emerald-700 transition-colors group">
                                      {isPdf ? <FileText className="h-3.5 w-3.5 text-red-500 shrink-0" /> : <ExternalLink className="h-3.5 w-3.5 text-emerald-600 group-hover:text-emerald-700 shrink-0" />}
                                      <span className="text-sm text-stone-600 dark:text-neutral-300 group-hover:text-emerald-700 font-medium truncate">{r.name || r.url}</span>
                                    </a>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-neutral-500 shrink-0">{r.type}</span>
                                    {isPdf ? (
                                      <div className="flex items-center gap-1 shrink-0">
                                        <a href={r.url} download className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-white/10 text-stone-400 hover:text-stone-700 dark:hover:text-white transition-colors" title="Télécharger">
                                          <Download className="h-3.5 w-3.5" />
                                        </a>
                                        <button
                                          onClick={() => {
                                            setEmailTo(prospect?.email || '')
                                            setEmailSent(false)
                                            setEmailModal({ url: r.url, name: r.name || 'Document PDF' })
                                          }}
                                          className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-white/10 text-stone-400 hover:text-stone-700 dark:hover:text-white transition-colors" title="Envoyer par email"
                                        >
                                          <Mail className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => {
                                          navigator.clipboard.writeText(r.url)
                                          setCopiedResourceIdx(idx)
                                          setTimeout(() => setCopiedResourceIdx(null), 2000)
                                        }}
                                        className="shrink-0 p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-white/10 text-stone-400 hover:text-stone-700 dark:hover:text-white transition-colors"
                                      >
                                        {copiedResourceIdx === idx ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                                      </button>
                                    )}
                                  </li>
                                )
                              })}
                            </ul>
                          ) : (
                            <p className="text-sm text-stone-400 dark:text-neutral-500 text-center mt-6">Aucune ressource pour cette formule.</p>
                          )
                        ) : (
                          <p className="text-sm text-stone-400 dark:text-neutral-500 text-center mt-6">Sélectionnez une formule pour voir ses ressources.</p>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Package className="h-10 w-10 text-stone-200 dark:text-neutral-700 mb-3" />
                        <p className="text-sm font-semibold text-stone-400 dark:text-neutral-500">Aucune formule configurée</p>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>
        </section>

        {/* ─── Right Panel (Notes) ─── */}
        <section className="flex-1 flex flex-col p-7 bg-white dark:bg-neutral-900 relative">
          {/* Notepad Header */}
          <div className="flex items-center justify-between mb-7">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-stone-900 dark:text-white">Prise de notes</h3>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-tight">Sauvegarde auto</span>
                </div>
              </div>
              {/* Previous note tabs */}
              <div className="flex items-center gap-2">
                {previousNotes.length > 0 && (
                  <>
                    <button
                      onClick={() => setSelectedPreviousNote('')}
                      className={cn(
                        'px-4 py-1.5 rounded-full text-[10px] font-bold transition-all',
                        !selectedPreviousNote ? 'bg-stone-200 dark:bg-white/10 text-stone-900 dark:text-white' : 'bg-stone-100 dark:bg-white/5 text-stone-500 dark:text-neutral-400 hover:bg-stone-200 dark:hover:bg-white/10'
                      )}
                    >
                      Notes actuelles
                    </button>
                    {previousNotes.map((n: any) => (
                      <button
                        key={n.id}
                        onClick={() => setSelectedPreviousNote(n.id)}
                        className={cn(
                          'px-4 py-1.5 rounded-full text-[10px] font-bold transition-all',
                          selectedPreviousNote === n.id ? 'bg-stone-200 dark:bg-white/10 text-stone-900 dark:text-white' : 'bg-stone-100 dark:bg-white/5 text-stone-500 dark:text-neutral-400 hover:bg-stone-200 dark:hover:bg-white/10'
                        )}
                      >
                        {new Date(n.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
            </div>
          </div>

          {/* Editor */}
          <div className="flex-1 flex flex-col relative">
            {selectedPreviousNote ? (
              <div className="flex-1 overflow-y-auto text-lg leading-relaxed text-stone-600 dark:text-neutral-300 whitespace-pre-wrap font-medium">
                {previousNotes.find((n: any) => n.id === selectedPreviousNote)?.content || 'Aucune note'}
              </div>
            ) : (
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Prise de notes..."
                className="flex-1 w-full bg-transparent border-none focus:ring-0 text-lg leading-relaxed font-medium placeholder:text-stone-300/40 dark:placeholder:text-neutral-600/40 resize-none p-0 focus:outline-none dark:text-white"
                autoFocus />
            )}

          </div>
        </section>
      </div>

      {/* Visual accents */}
      <div className="fixed top-0 right-0 -z-10 w-1/2 h-full bg-gradient-to-l from-stone-100/50 to-transparent pointer-events-none" />
      <div className="fixed -bottom-24 -left-24 w-96 h-96 bg-emerald-700/5 blur-[120px] rounded-full -z-10" />
      <div className="fixed top-1/4 left-1/4 w-64 h-64 bg-amber-400/10 blur-[100px] rounded-full -z-10" />

      {/* Prospect View Modal */}
      {showProspectView && prospect && (
        <BusinessProspectView
          prospect={prospect}
          onClose={() => setShowProspectView(false)}
          onUpdate={updateProspect}
          onDelete={deleteProspect}
        />
      )}

      {/* Email PDF Modal */}
      {emailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setEmailModal(null)}>
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-neutral-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-white/10 px-6 py-4">
              <h3 className="font-['Manrope'] text-lg font-extrabold text-stone-900 dark:text-white">Envoyer le PDF</h3>
              <button onClick={() => setEmailModal(null)} className="p-1.5 hover:bg-stone-100 dark:hover:bg-white/10 rounded-full text-stone-400 hover:text-stone-900 dark:hover:text-white transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center gap-2.5 bg-stone-50 dark:bg-white/5 rounded-xl px-4 py-3">
                <FileText className="h-4 w-4 text-red-500 shrink-0" />
                <span className="text-sm font-medium text-stone-700 dark:text-neutral-300 truncate">{emailModal.name}</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-500 dark:text-neutral-400 uppercase tracking-wide mb-1.5">Adresse email</label>
                <input
                  type="email"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder="email@exemple.com"
                  className="w-full rounded-xl border border-stone-200 dark:border-white/10 bg-white dark:bg-neutral-800 px-4 py-3 text-sm text-stone-900 dark:text-white placeholder:text-stone-400 focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-300 transition-all"
                />
              </div>

              {emailSent && (
                <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl px-4 py-3">
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Email envoyé avec succès</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-stone-100 dark:border-white/10 px-6 py-4">
              <button onClick={() => setEmailModal(null)} className="rounded-full border border-stone-200 dark:border-white/10 px-5 py-2 text-sm font-semibold text-stone-600 dark:text-neutral-300 hover:bg-stone-50 dark:hover:bg-white/10 transition-colors">
                Annuler
              </button>
              <button
                disabled={!emailTo || emailSending || emailSent}
                onClick={async () => {
                  if (!emailTo || !emailModal) return
                  setEmailSending(true)
                  try {
                    const htmlContent = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet">
  <style>
    .manrope { font-family: 'Manrope', Arial, sans-serif !important; font-weight: 800 !important; letter-spacing: -0.04em !important; }
    .inter { font-family: 'Inter', Helvetica, sans-serif !important; line-height: 1.6 !important; }
    .gradient-text {
      background: linear-gradient(135deg, #ff4b72 0%, #a03cf8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      color: #a03cf8;
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="padding-bottom:48px;text-align:left;padding-left:24px;">
              <div class="manrope" style="font-size:28px;color:#111111;">
                Close<span class="gradient-text">OS</span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);">
              <h1 class="manrope" style="margin:0 0 16px;font-size:42px;color:#111111;text-align:left;line-height:1.1;">
                Votre document
              </h1>
              <p class="inter" style="margin:0 0 48px;font-size:16px;color:#1b1c1b;text-align:left;">
                Vous trouverez ci-dessous le document <strong>${emailModal.name}</strong> qui vous a été envoyé.
              </p>
              <div style="text-align:center;margin-bottom:48px;">
                <a href="${emailModal.url}" target="_blank" style="display:inline-block;background-color:#111111;color:#ffffff;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:16px;padding:18px 48px;border-radius:48px;text-decoration:none;letter-spacing:-0.02em;">
                  Télécharger le PDF
                </a>
              </div>
              <div style="background-color:#fbf9f8;border-radius:24px;padding:24px;border-left:4px solid #ffb95f;">
                <table cellpadding="0" cellspacing="0" style="width:100%;">
                  <tr>
                    <td style="width:32px;vertical-align:top;">
                      <div style="font-size:20px;line-height:1;">📎</div>
                    </td>
                    <td>
                      <p class="inter" style="margin:0;font-size:13px;color:#1b1c1b;">
                        Ce lien vous permet d'accéder directement au document. Si vous avez des questions, n'hésitez pas à nous contacter.
                      </p>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding-top:48px;text-align:left;padding-left:24px;">
              <p class="inter" style="margin:0 0 8px;font-size:13px;color:#1b1c1b;opacity:0.6;">
                © 2026 CloseOS - Tous droits réservés
              </p>
              <p class="inter" style="margin:0;font-size:12px;color:#1b1c1b;opacity:0.5;">
                Cet e-mail a été envoyé automatiquement, merci de ne pas y répondre.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

                    await fetch('/api/email?action=send', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        sender: { email: 'support@closeos.fr', name: 'CloseOS' },
                        to: [{ email: emailTo }],
                        subject: `Votre document : ${emailModal.name}`,
                        htmlContent,
                      }),
                    })
                    setEmailSent(true)
                  } catch (err) {
                    console.error('Erreur envoi email:', err)
                  } finally {
                    setEmailSending(false)
                  }
                }}
                className="rounded-full bg-stone-900 dark:bg-white px-5 py-2 text-sm font-semibold text-white dark:text-stone-900 hover:opacity-80 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {emailSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Envoyer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
