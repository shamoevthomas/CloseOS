import { useState, useEffect, useRef, useMemo } from 'react'
import { X, Calendar, Video, Phone, MapPin, FileText, Loader2, Search, ChevronDown, User, Globe, Users, Plus, UserPlus, Clock, AlertTriangle } from 'lucide-react'
import { cn } from '../lib/utils'
import { useMeetings, type Meeting } from '../contexts/MeetingsContext'
import { useProspects } from '../contexts/ProspectsContext'
import { useGoogleCalendar } from '../contexts/GoogleCalendarContext'
import { useInternalContacts } from '../contexts/InternalContactsContext'
import { CreateProspectModal } from './CreateProspectModal'
import { SalesBookingAgendaPanel } from './SalesBookingAgendaPanel'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../contexts/LanguageContext'
import { createEventTranslations } from '../i18n/translations'

interface CreateEventModalProps {
  isOpen: boolean
  onClose: () => void
  prospectId?: number
  prospectName?: string
  editingEvent?: Meeting | null
}

export function CreateEventModal({ isOpen, onClose, prospectId, prospectName, editingEvent }: CreateEventModalProps) {
  const { addMeeting, updateMeeting, meetings } = useMeetings()
  const { prospects } = useProspects()
  const { isConnected: isGoogleConnected, createEvent: createGoogleEvent, googleEvents } = useGoogleCalendar()
  const { addContact: addInternalContact } = useInternalContacts()
  const { lang } = useLanguage()
  const t = createEventTranslations[lang]

  const [isInternal, setIsInternal] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<'call_video' | 'event' | 'other'>('call_video')
  const [internalContactsList, setInternalContactsList] = useState<any[]>([])
  const [linkContact, setLinkContact] = useState(false)
  const [showProspectModal, setShowProspectModal] = useState(false)
  const [showAddInternalModal, setShowAddInternalModal] = useState(false)
  const [newInternalContact, setNewInternalContact] = useState({ name: '', role: '', email: '', phone: '' })

  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [type, setType] = useState<Meeting['type']>('video')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [createGoogleMeet, setCreateGoogleMeet] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedContact, setSelectedContact] = useState<{ id: any; name: string } | null>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function fetchInternalCrmContacts() {
      const { data, error } = await supabase.from('internal_contacts').select('*')
      if (data) setInternalContactsList(data)
      if (error) console.error("Erreur chargement contacts:", error)
    }
    if (isOpen) fetchInternalCrmContacts()
  }, [isOpen])

  useEffect(() => {
    if (prospectId && prospectName) {
      setSelectedContact({ id: prospectId, name: prospectName })
      setSearchQuery(prospectName)
      setIsInternal(false)
      setLinkContact(true)
    }
  }, [prospectId, prospectName, isOpen])

  useEffect(() => {
    if (editingEvent) {
      setTitle(editingEvent.title)
      setDate(editingEvent.date)
      const [start, end] = editingEvent.time.split(' - ')
      setStartTime(start || '')
      setEndTime(end || '')

      if (editingEvent.type === 'event') setSelectedCategory('event')
      else if (editingEvent.type === 'other') setSelectedCategory('other')
      else setSelectedCategory('call_video')

      setType(editingEvent.type)
      setIsInternal(editingEvent.is_internal || false)
      setDescription(editingEvent.description || '')
      setLocation(editingEvent.location || '')
      setCreateGoogleMeet(false)
      setLinkContact(!!editingEvent.contact)

      if (editingEvent.contact) {
        setSearchQuery(editingEvent.contact)
        setSelectedContact({ id: editingEvent.prospectId || null, name: editingEvent.contact })
      }
    } else if (!prospectId) {
      // Defaults : date = aujourd'hui, heure = prochain créneau arrondi
      const now = new Date()
      const todayStr = now.toISOString().split('T')[0]
      const mins = now.getMinutes()
      const roundedMins = mins < 30 ? 30 : 0
      const startH = mins < 30 ? now.getHours() : now.getHours() + 1
      const endH = startH + 1
      const pad = (n: number) => n.toString().padStart(2, '0')

      setTitle('')
      setDate(todayStr)
      setStartTime(`${pad(startH)}:${pad(roundedMins)}`)
      setEndTime(`${pad(endH)}:${pad(roundedMins)}`)
      setType('video')
      setDescription('')
      setLocation('')
      setCreateGoogleMeet(false)
      setLinkContact(false)
      setSearchQuery('')
      setSelectedContact(null)
      setSelectedCategory('call_video')
      setIsInternal(false)
    }
  }, [editingEvent, isOpen, prospectId])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen])

  // Détection des conflits : le créneau saisi chevauche-t-il un RDV/événement existant ?
  const conflicts = useMemo(() => {
    if (!date || !startTime || !endTime) return [] as { title: string; time: string }[]
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return (h || 0) * 60 + (m || 0) }
    const ps = toMin(startTime)
    let pe = toMin(endTime)
    if (pe <= ps) pe += 24 * 60 // sécurité créneau de nuit
    const overlaps = (s: number, e: number) => ps < e && s < pe
    const out: { title: string; time: string }[] = []

    // RDV / événements CloseOS
    for (const m of meetings) {
      if (m.status === 'cancelled') continue
      if (editingEvent && String(m.id) === String(editingEvent.id)) continue
      if (m.date !== date || !m.time) continue
      const [ms, me] = m.time.split(' - ')
      if (!ms || !me) continue
      let s = toMin(ms), e = toMin(me); if (e <= s) e += 24 * 60
      if (overlaps(s, e)) out.push({ title: m.contact || m.title || 'RDV', time: m.time })
    }

    // Événements Google
    for (const ge of googleEvents) {
      if (!ge.start || ge.allDay) continue
      const gStart = ge.start instanceof Date ? ge.start : new Date(ge.start)
      const gEnd = ge.end instanceof Date ? ge.end : new Date(ge.end)
      const gDateStr = `${gStart.getFullYear()}-${String(gStart.getMonth() + 1).padStart(2, '0')}-${String(gStart.getDate()).padStart(2, '0')}`
      if (gDateStr !== date) continue
      const s = gStart.getHours() * 60 + gStart.getMinutes()
      let e = gEnd.getHours() * 60 + gEnd.getMinutes(); if (e <= s) e += 24 * 60
      if (overlaps(s, e)) {
        const fmt = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
        out.push({ title: ge.title || 'Google', time: `${fmt(gStart)} - ${fmt(gEnd)}` })
      }
    }
    return out
  }, [date, startTime, endTime, meetings, googleEvents, editingEvent])

  if (!isOpen) return null

  const currentList = isInternal
    ? internalContactsList.map(c => ({ id: c.id, name: c.name || 'Sans nom' }))
    : prospects.map(p => ({ id: p.id, name: p.contact || p.title || 'Prospect' }))

  const filteredContacts = currentList.filter((c) => {
    const name = c.name || ''
    return name.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const handleSelectContact = (contact: any) => {
    setSelectedContact({ id: contact.id, name: contact.name })
    setSearchQuery(contact.name)
    setIsDropdownOpen(false)
  }

  const handleProspectCreated = (prospectData: any) => {
    const fullName = `${prospectData.firstName || ''} ${prospectData.lastName || ''}`.trim() || prospectData.contact
    setSelectedContact({ id: null, name: fullName })
    setSearchQuery(fullName)
    setShowProspectModal(false)
  }

  const handleAddInternalContact = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newInternalContact.name || !newInternalContact.role || !newInternalContact.email || !newInternalContact.phone) {
      return alert(lang === 'fr' ? 'Veuillez remplir tous les champs' : 'Please fill in all fields')
    }
    await addInternalContact(newInternalContact)
    // Refresh internal contacts list
    const { data } = await supabase.from('internal_contacts').select('*')
    if (data) setInternalContactsList(data)
    setSelectedContact({ id: null, name: newInternalContact.name })
    setSearchQuery(newInternalContact.name)
    setNewInternalContact({ name: '', role: '', email: '', phone: '' })
    setShowAddInternalModal(false)
  }



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // VALIDATION : Titre et Dates obligatoires
    if (!title || !date || !startTime || !endTime) {
      return alert(lang === 'fr' ? 'Veuillez remplir le titre, la date et les heures.' : 'Please fill in the title, date and times.')
    }

    // VALIDATION : Contact obligatoire si linkContact est activé
    if (linkContact && !searchQuery) {
      return alert(lang === 'fr' ? 'Veuillez sélectionner un contact ou prospect.' : 'Please select a contact or prospect.')
    }

    setIsSubmitting(true)

    let finalType: Meeting['type'] = 'call'
    if (selectedCategory === 'event') finalType = 'event'
    else if (selectedCategory === 'other') finalType = 'other'
    else finalType = type

    try {
      const payload = {
        title,
        date,
        time: `${startTime} - ${endTime}`,
        type: finalType,
        description,
        location: selectedCategory === 'call_video' ? location : '',
        contact: linkContact ? (selectedContact?.name || searchQuery) : '',
        prospectId: (!linkContact || isInternal) ? null : (selectedContact?.id || null),
        is_internal: linkContact ? isInternal : false,
        status: 'upcoming' as const
      }

      if (editingEvent) {
        const { error } = await updateMeeting(editingEvent.id, payload)
        if (error) throw error
      } else {
        // Sync avec Google Calendar si connecté
        if (isGoogleConnected) {
          const result = await createGoogleEvent({
            title: payload.contact ? `${title} - ${payload.contact}` : title,
            date,
            startTime,
            endTime,
            description,
            location: payload.location,
            withGoogleMeet: createGoogleMeet,
          })

          // Si un lien Meet a été généré, on le sauvegarde dans le meeting
          if (result.hangoutLink) {
            payload.location = result.hangoutLink
          }
        }

        const { error } = await addMeeting(payload)
        if (error) throw error
      }
      onClose()
    } catch (error: any) {
      alert(lang === 'fr' ? `Erreur : ${error.message || 'Impossible d\'enregistrer'}` : `Error: ${error.message || 'Unable to save'}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative flex w-full max-w-md lg:max-w-4xl max-h-[90vh] gap-3">

      {/* COLONNE FORMULAIRE */}
      <div className="relative flex flex-col flex-1 lg:max-w-md min-w-0 max-h-[90vh] rounded-2xl bg-white dark:bg-[#1a1a1a] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_14px_34px_-16px_rgba(15,23,42,0.10)] border border-slate-200 dark:border-white/10 text-left overflow-hidden">

        {/* HEADER - sticky */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 px-5 py-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500/20">
              <Calendar className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {editingEvent ? 'Modifier le RDV' : 'Programmer un RDV'}
            </h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 dark:text-neutral-500 hover:bg-slate-100 hover:text-slate-900">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto space-y-3 px-5 py-4 custom-scrollbar">

            {/* TOGGLE RELIER À UN CONTACT */}
            <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-2.5">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/15">
                  <User className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">Relier à un contact</p>
                  <p className="text-[10px] text-slate-400 dark:text-neutral-500">Associer un prospect ou contact au RDV</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setLinkContact(!linkContact); if (linkContact) { setSelectedContact(null); setSearchQuery('') } }}
                className={cn(
                  'relative h-6 w-11 rounded-full transition-colors duration-200',
                  linkContact ? 'bg-sky-600' : 'bg-slate-100 dark:bg-white/10'
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white dark:bg-[#1a1a1a] shadow-md transition-transform duration-200',
                    linkContact && 'translate-x-5'
                  )}
                />
              </button>
            </div>

            {/* CONTACT SELECTOR (visible when linkContact is ON) */}
            {linkContact && (
              <>
                {/* TOGGLE INTERNE / EXTERNE */}
                <div className="flex p-1 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => { setIsInternal(false); setSelectedContact(null); setSearchQuery('') }}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all",
                      !isInternal ? "bg-sky-600 text-white shadow-lg" : "text-slate-400 dark:text-neutral-500 hover:text-slate-500"
                    )}
                  >
                    <Globe size={14} /> Externe
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsInternal(true); setSelectedContact(null); setSearchQuery('') }}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all",
                      isInternal ? "bg-sky-600 text-white shadow-lg" : "text-slate-400 dark:text-neutral-500 hover:text-slate-500"
                    )}
                  >
                    <Users size={14} /> Interne
                  </button>
                </div>

                <div className="relative" ref={dropdownRef}>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-neutral-500 ml-1">
                    {isInternal ? 'Contact Interne' : 'Prospect'}
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setIsDropdownOpen(true) }}
                        onFocus={() => setIsDropdownOpen(true)}
                        placeholder={isInternal ? "Chercher un contact..." : "Chercher un prospect..."}
                        className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-2 pr-10 text-sm text-slate-900 dark:text-white focus:border-sky-500 outline-none transition-all"
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none opacity-50">
                        <ChevronDown className="h-4 w-4 text-slate-400 dark:text-neutral-500" />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => isInternal ? setShowAddInternalModal(true) : setShowProspectModal(true)}
                      className="flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs font-bold text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 transition-all"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Nouveau
                    </button>
                  </div>

                  {isDropdownOpen && (
                    <div className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] shadow-xl custom-scrollbar">
                      {filteredContacts.length > 0 ? (
                        filteredContacts.map((contact) => (
                          <button
                            key={contact.id}
                            type="button"
                            onClick={() => handleSelectContact(contact)}
                            className="flex w-full items-center gap-3 border-b border-slate-200 dark:border-white/10 px-4 py-3 text-left transition-colors hover:bg-slate-50 last:border-0"
                          >
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 dark:bg-white/10 text-[10px] font-bold text-slate-900 dark:text-white uppercase">
                              {contact.name?.charAt(0)}
                            </div>
                            <span className="text-sm font-medium text-slate-900 dark:text-white">{contact.name}</span>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-6 text-center text-xs text-slate-400 dark:text-neutral-500 italic">Aucun contact trouvé</div>
                      )}
                    </div>
                  )}
                </div>


              </>
            )}

            {/* TITRE */}
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-neutral-500 ml-1">Titre de la session *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Point Hebdo"
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-sky-500 outline-none transition-all"
                required
              />
            </div>
            {/* DATE & HEURE */}
            <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-3 space-y-2.5">
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-neutral-500">Date & Horaire</span>
              </div>

              <div>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-sky-500 outline-none transition-all"
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Clock className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sky-600/60" />
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 pl-8 pr-2 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-sky-500 transition-all"
                    required
                  />
                </div>
                <div className="flex flex-col items-center gap-0.5 px-1">
                  <div className="w-3 h-px bg-slate-100 dark:bg-white/10" />
                  <span className="text-[9px] text-slate-400 dark:text-neutral-500 font-bold">à</span>
                  <div className="w-3 h-px bg-slate-100 dark:bg-white/10" />
                </div>
                <div className="relative flex-1">
                  <Clock className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sky-600/60" />
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 pl-8 pr-2 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-sky-500 transition-all"
                    required
                  />
                </div>
              </div>

              {date && startTime && endTime && (
                <p className="text-[10px] text-slate-400 dark:text-neutral-500 pl-0.5">
                  📅 {new Date(date + 'T00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}, de {startTime} à {endTime}
                </p>
              )}
            </div>

            {/* ALERTE CONFLIT : le créneau chevauche un RDV/événement existant */}
            {conflicts.length > 0 && (
              <div className="rounded-xl border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                      {conflicts.length === 1
                        ? (lang === 'fr' ? 'Conflit avec un RDV existant' : 'Conflicts with an existing event')
                        : (lang === 'fr' ? `${conflicts.length} conflits avec des RDV existants` : `${conflicts.length} conflicts with existing events`)}
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {conflicts.map((c, i) => (
                        <li key={i} className="text-[11px] text-amber-600 dark:text-amber-400/90 truncate">• {c.time} — {c.title}</li>
                      ))}
                    </ul>
                    <p className="mt-1 text-[10px] text-amber-500/80 dark:text-amber-400/70">
                      {lang === 'fr' ? "Vous pouvez tout de même programmer ce RDV." : 'You can still schedule this event.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* GOOGLE MEET TOGGLE : Uniquement pour Appel / Visio et si Google connecté */}
            {selectedCategory === 'call_video' && isGoogleConnected && (
              <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/15">
                    <Video className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">Créer un Google Meet</p>
                    <p className="text-[10px] text-slate-400 dark:text-neutral-500">Un lien visio sera généré automatiquement</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCreateGoogleMeet(!createGoogleMeet)}
                  className={cn(
                    'relative h-6 w-11 rounded-full transition-colors duration-200',
                    createGoogleMeet ? 'bg-sky-600' : 'bg-slate-100 dark:bg-white/10'
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white dark:bg-[#1a1a1a] shadow-md transition-transform duration-200',
                      createGoogleMeet && 'translate-x-5'
                    )}
                  />
                </button>
              </div>
            )}

            {selectedCategory === 'call_video' && !isGoogleConnected && (
              <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-4 py-3">
                <p className="text-xs text-slate-400 dark:text-neutral-500 italic">Connectez votre Google Calendar dans l'Agenda pour générer des liens Google Meet automatiquement.</p>
              </div>
            )}

            {/* DESCRIPTION */}
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-neutral-500 ml-1">
                {selectedCategory === 'call_video' ? 'Notes du RDV' : "Détails de l'événement"} (Optionnel)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Saisir les informations..."
                rows={2}
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:border-sky-500 outline-none resize-none"
              />
            </div>

          </div>{/* end scrollable content */}

          {/* ACTIONS - sticky bottom */}
          <div className="flex gap-3 border-t border-slate-200 dark:border-white/10 px-5 py-4 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-4 py-3 text-sm font-bold text-slate-600 dark:text-neutral-300 hover:bg-slate-100 transition-all"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-full bg-sky-600 px-4 py-3 text-sm font-bold text-white hover:bg-sky-600 shadow-xl shadow-sky-500/20 disabled:opacity-50 transition-all"
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin mx-auto" /> : (editingEvent ? 'Enregistrer' : 'Programmer')}
            </button>
          </div>
        </form>
      </div>{/* end COLONNE FORMULAIRE */}

      {/* COLONNE AGENDA (desktop) — voir ses créneaux occupés pour éviter les conflits */}
      <div className="hidden lg:flex w-[340px] shrink-0 max-h-[90vh] rounded-2xl bg-white dark:bg-[#1a1a1a] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_14px_34px_-16px_rgba(15,23,42,0.10)] border border-slate-200 dark:border-white/10 overflow-hidden">
        <SalesBookingAgendaPanel
          previewDate={date}
          previewStartTime={startTime}
          previewEndTime={endTime}
          previewTitle={title || (linkContact ? (selectedContact?.name || searchQuery) : '') || undefined}
          excludeMeetingId={editingEvent?.id ?? null}
        />
      </div>

      </div>{/* end row */}

      {/* MODAL: Créer un prospect */}
      <CreateProspectModal
        isOpen={showProspectModal}
        onClose={() => setShowProspectModal(false)}
        onSubmit={handleProspectCreated}
      />

      {/* MODAL: Créer un contact interne */}
      {showAddInternalModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            onClick={() => setShowAddInternalModal(false)}
          />
          <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#1a1a1a] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_14px_34px_-16px_rgba(15,23,42,0.10)] border border-slate-200 dark:border-white/10 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20 border border-sky-500/20">
                  <UserPlus className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Nouveau Contact Interne</h3>
              </div>
              <button onClick={() => setShowAddInternalModal(false)} className="text-slate-400 dark:text-neutral-500 hover:text-slate-900 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAddInternalContact} className="space-y-4 p-6">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">Nom complet</label>
                <input
                  type="text"
                  value={newInternalContact.name}
                  onChange={(e) => setNewInternalContact({ ...newInternalContact, name: e.target.value })}
                  placeholder="Ex: Jean Dupont"
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:border-sky-500 focus:outline-none transition-all"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">Rôle/Poste</label>
                <input
                  type="text"
                  value={newInternalContact.role}
                  onChange={(e) => setNewInternalContact({ ...newInternalContact, role: e.target.value })}
                  placeholder="Ex: Directeur Commercial"
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:border-sky-500 focus:outline-none transition-all"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">Email</label>
                <input
                  type="email"
                  value={newInternalContact.email}
                  onChange={(e) => setNewInternalContact({ ...newInternalContact, email: e.target.value })}
                  placeholder="Ex: jean.dupont@closeros.com"
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:border-sky-500 focus:outline-none transition-all"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">Téléphone</label>
                <input
                  type="tel"
                  value={newInternalContact.phone}
                  onChange={(e) => setNewInternalContact({ ...newInternalContact, phone: e.target.value })}
                  placeholder="Ex: +33 6 12 34 56 78"
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:border-sky-500 focus:outline-none transition-all"
                  required
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddInternalModal(false)}
                  className="flex-1 rounded-full border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-4 py-3 text-sm font-bold text-slate-600 dark:text-neutral-300 transition-all hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-full bg-sky-600 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-sky-600 shadow-lg shadow-sky-500/20"
                >
                  Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}