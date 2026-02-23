import { useState, useEffect, useRef } from 'react'
import { X, Calendar, Video, Phone, MapPin, FileText, Loader2, Search, ChevronDown, User, Globe, Users, Plus, UserPlus } from 'lucide-react'
import { cn } from '../lib/utils'
import { useMeetings, type Meeting } from '../contexts/MeetingsContext'
import { useProspects } from '../contexts/ProspectsContext'
import { useGoogleCalendar } from '../contexts/GoogleCalendarContext'
import { useInternalContacts } from '../contexts/InternalContactsContext'
import { CreateProspectModal } from './CreateProspectModal'
import { supabase } from '../lib/supabase'

interface CreateEventModalProps {
  isOpen: boolean
  onClose: () => void
  prospectId?: number
  prospectName?: string
  editingEvent?: Meeting | null
}

export function CreateEventModal({ isOpen, onClose, prospectId, prospectName, editingEvent }: CreateEventModalProps) {
  const { addMeeting, updateMeeting } = useMeetings()
  const { prospects } = useProspects()
  const { isConnected: isGoogleConnected, createEvent: createGoogleEvent } = useGoogleCalendar()
  const { addContact: addInternalContact } = useInternalContacts()

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
  const [type, setType] = useState<Meeting['type']>('call')
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
      setTitle('')
      setDate('')
      setStartTime('')
      setEndTime('')
      setType('call')
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
      return alert('Veuillez remplir tous les champs')
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
      return alert('Veuillez remplir le titre, la date et les heures.')
    }

    // VALIDATION : Contact obligatoire si linkContact est activé
    if (linkContact && !searchQuery) {
      return alert('Veuillez sélectionner un contact ou prospect.')
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
      alert(`Erreur : ${error.message || 'Impossible d\'enregistrer'}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl bg-slate-900 shadow-2xl ring-1 ring-slate-800 text-left">

        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-slate-800 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20">
              <Calendar className="h-5 w-5 text-blue-400" />
            </div>
            <h3 className="text-lg font-bold text-white">
              {editingEvent ? 'Modifier le RDV' : 'Programmer un RDV'}
            </h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">

          {/* TOGGLE RELIER À UN CONTACT */}
          <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15">
                <User className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Relier à un contact</p>
                <p className="text-[10px] text-slate-500">Associer un prospect ou contact au RDV</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setLinkContact(!linkContact); if (linkContact) { setSelectedContact(null); setSearchQuery('') } }}
              className={cn(
                'relative h-6 w-11 rounded-full transition-colors duration-200',
                linkContact ? 'bg-emerald-600' : 'bg-slate-600'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200',
                  linkContact && 'translate-x-5'
                )}
              />
            </button>
          </div>

          {/* CONTACT SELECTOR (visible when linkContact is ON) */}
          {linkContact && (
            <>
              {/* TOGGLE INTERNE / EXTERNE */}
              <div className="flex p-1 bg-slate-800/50 rounded-xl border border-slate-700/50">
                <button
                  type="button"
                  onClick={() => { setIsInternal(false); setSelectedContact(null); setSearchQuery('') }}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all",
                    !isInternal ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  <Globe size={14} /> Externe
                </button>
                <button
                  type="button"
                  onClick={() => { setIsInternal(true); setSelectedContact(null); setSearchQuery('') }}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all",
                    isInternal ? "bg-purple-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  <Users size={14} /> Interne
                </button>
              </div>

              <div className="relative" ref={dropdownRef}>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">
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
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 pr-10 text-sm text-white focus:border-blue-500 outline-none transition-all"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none opacity-50">
                      <ChevronDown className="h-4 w-4 text-slate-500" />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => isInternal ? setShowAddInternalModal(true) : setShowProspectModal(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 transition-all"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Nouveau
                  </button>
                </div>

                {isDropdownOpen && (
                  <div className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-700 bg-slate-800 shadow-xl custom-scrollbar">
                    {filteredContacts.length > 0 ? (
                      filteredContacts.map((contact) => (
                        <button
                          key={contact.id}
                          type="button"
                          onClick={() => handleSelectContact(contact)}
                          className="flex w-full items-center gap-3 border-b border-slate-700/50 px-4 py-3 text-left transition-colors hover:bg-slate-700 last:border-0"
                        >
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-[10px] font-bold text-white uppercase">
                            {contact.name?.charAt(0)}
                          </div>
                          <span className="text-sm font-medium text-white">{contact.name}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-6 text-center text-xs text-slate-500 italic">Aucun contact trouvé</div>
                    )}
                  </div>
                )}
              </div>


            </>
          )}

          {/* TITRE ET DATE */}
          <div className="grid gap-4">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Titre de la session *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Point Hebdo"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 outline-none transition-all"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Date *</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase text-slate-500">Début *</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-2 text-xs text-white outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase text-slate-500">Fin *</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-2 text-xs text-white outline-none"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* GOOGLE MEET TOGGLE : Uniquement pour Appel / Visio et si Google connecté */}
          {selectedCategory === 'call_video' && isGoogleConnected && (
            <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15">
                  <Video className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Créer un Google Meet</p>
                  <p className="text-[10px] text-slate-500">Un lien visio sera généré automatiquement</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreateGoogleMeet(!createGoogleMeet)}
                className={cn(
                  'relative h-6 w-11 rounded-full transition-colors duration-200',
                  createGoogleMeet ? 'bg-blue-600' : 'bg-slate-600'
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200',
                    createGoogleMeet && 'translate-x-5'
                  )}
                />
              </button>
            </div>
          )}

          {selectedCategory === 'call_video' && !isGoogleConnected && (
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 px-4 py-3">
              <p className="text-xs text-slate-500 italic">Connectez votre Google Calendar dans l'Agenda pour générer des liens Google Meet automatiquement.</p>
            </div>
          )}

          {/* DESCRIPTION (Facultatif désormais) */}
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">
              {selectedCategory === 'call_video' ? 'Notes du RDV' : "Détails de l'événement"} (Optionnel)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Saisir les informations..."
              rows={3}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 outline-none resize-none"
            />
          </div>

          {/* ACTIONS */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm font-bold text-slate-400 hover:text-white transition-all"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-500 shadow-xl shadow-blue-600/20 disabled:opacity-50 transition-all"
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin mx-auto" /> : (editingEvent ? 'Enregistrer' : 'Programmer')}
            </button>
          </div>
        </form>
      </div>

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
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowAddInternalModal(false)}
          />
          <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 shadow-2xl ring-1 ring-slate-800 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20 border border-purple-500/20">
                  <UserPlus className="h-5 w-5 text-purple-400" />
                </div>
                <h3 className="text-lg font-bold text-white">Nouveau Contact Interne</h3>
              </div>
              <button onClick={() => setShowAddInternalModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAddInternalContact} className="space-y-4 p-6">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Nom complet</label>
                <input
                  type="text"
                  value={newInternalContact.name}
                  onChange={(e) => setNewInternalContact({ ...newInternalContact, name: e.target.value })}
                  placeholder="Ex: Jean Dupont"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Rôle/Poste</label>
                <input
                  type="text"
                  value={newInternalContact.role}
                  onChange={(e) => setNewInternalContact({ ...newInternalContact, role: e.target.value })}
                  placeholder="Ex: Directeur Commercial"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Email</label>
                <input
                  type="email"
                  value={newInternalContact.email}
                  onChange={(e) => setNewInternalContact({ ...newInternalContact, email: e.target.value })}
                  placeholder="Ex: jean.dupont@closeros.com"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Téléphone</label>
                <input
                  type="tel"
                  value={newInternalContact.phone}
                  onChange={(e) => setNewInternalContact({ ...newInternalContact, phone: e.target.value })}
                  placeholder="Ex: +33 6 12 34 56 78"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
                  required
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddInternalModal(false)}
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm font-bold text-slate-300 transition-all hover:bg-slate-800 hover:text-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-purple-600 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-purple-500 shadow-lg shadow-purple-600/20"
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