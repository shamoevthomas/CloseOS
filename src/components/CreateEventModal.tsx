import { useState, useEffect, useRef } from 'react'
import { X, Calendar, Video, Phone, MapPin, FileText, Loader2, Search, ChevronDown, User, Globe, Users } from 'lucide-react'
import { cn } from '../lib/utils'
import { useMeetings, type Meeting } from '../contexts/MeetingsContext'
import { useProspects } from '../contexts/ProspectsContext'
import { createDailyRoom } from '../services/dailyService'
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
  const { prospects } = useProspects() // Source pour "Mes Prospects" (Externe)

  // États pour la structure Interne/Externe
  const [isInternal, setIsInternal] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<'call_video' | 'event' | 'other'>('call_video')
  const [internalContactsList, setInternalContactsList] = useState<any[]>([])

  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [type, setType] = useState<Meeting['type']>('call')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [isGeneratingLink, setIsGeneratingLink] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Prospect/Contact selector state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedContact, setSelectedContact] = useState<{ id: any; name: string } | null>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // RÉCTIFICATION FINALE : Chargement des contacts internes depuis 'internal_contacts'
  useEffect(() => {
    async function fetchInternalCrmContacts() {
      const { data, error } = await supabase
        .from('internal_contacts') // Nom de table réel
        .select('*')
      
      if (data) {
        // Comme ta table 'internal_contacts' est déjà dédiée à l'interne, 
        // on ne filtre plus sur 'is_internal' (qui n'existe pas dans les colonnes).
        setInternalContactsList(data)
      }
      if (error) console.error("Erreur chargement contacts:", error)
    }
    if (isOpen) fetchInternalCrmContacts()
  }, [isOpen])

  // Pré-remplissage prospect
  useEffect(() => {
    if (prospectId && prospectName) {
      setSelectedContact({ id: prospectId, name: prospectName })
      setSearchQuery(prospectName)
      setIsInternal(false)
    }
  }, [prospectId, prospectName, isOpen])

  // Pré-remplissage lors de l'édition
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

  // SÉLECTION DE LA SOURCE DE DONNÉES
  // Pour l'interne, on utilise la colonne 'name' visible dans ta capture
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

  const handleGenerateDailyLink = async () => {
    setIsGeneratingLink(true)
    try {
      const roomUrl = await createDailyRoom()
      setLocation(roomUrl)
      alert('✅ Lien de visio Daily.co généré !')
    } catch (error) {
      alert('❌ Erreur lien visio')
    } finally {
      setIsGeneratingLink(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !date || !startTime || !endTime) return alert('Champs obligatoires manquants')

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
        contact: selectedContact?.name || searchQuery,
        prospectId: isInternal ? null : (selectedContact?.id || null),
        is_internal: isInternal,
        status: 'upcoming' as const
      }

      if (editingEvent) {
        const { error } = await updateMeeting(editingEvent.id, payload)
        if (error) throw error
      } else {
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

          {/* SÉLECTEUR DE CATÉGORIE */}
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => setSelectedCategory('call_video')} className={cn('flex flex-col items-center gap-2 rounded-lg border p-3 transition-all', selectedCategory === 'call_video' ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600')}>
              <Video className="h-5 w-5" />
              <span className="text-[10px] font-bold uppercase">Appel / Visio</span>
            </button>
            <button type="button" onClick={() => setSelectedCategory('event')} className={cn('flex flex-col items-center gap-2 rounded-lg border p-3 transition-all', selectedCategory === 'event' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600')}>
              <Calendar className="h-5 w-5" />
              <span className="text-[10px] font-bold uppercase">Événement</span>
            </button>
            <button type="button" onClick={() => setSelectedCategory('other')} className={cn('flex flex-col items-center gap-2 rounded-lg border p-3 transition-all', selectedCategory === 'other' ? 'border-orange-500 bg-orange-500/10 text-orange-400' : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600')}>
              <Users className="h-5 w-5" />
              <span className="text-[10px] font-bold uppercase">Autre</span>
            </button>
          </div>

          {/* SÉLECTEUR DE CONTACT DYNAMIQUE */}
          <div className="relative" ref={dropdownRef}>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">
              {isInternal ? 'Contact Interne (CRM) *' : 'Prospect (CRM) *'}
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setIsDropdownOpen(true) }}
                onFocus={() => setIsDropdownOpen(true)}
                placeholder={isInternal ? "Chercher Emilie, Kylian..." : "Chercher un prospect..."}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 pr-10 text-sm text-white focus:border-blue-500 outline-none transition-all"
                required
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none opacity-50">
                <ChevronDown className="h-4 w-4 text-slate-500" />
              </div>
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

          {/* TITRE ET DATE */}
          <div className="grid gap-4">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Titre de la session</label>
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
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Date</label>
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
                  <label className="mb-2 block text-[10px] font-bold uppercase text-slate-500">Début</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-2 text-xs text-white outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase text-slate-500">Fin</label>
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

          {/* VISIO : Uniquement pour Appel / Visio */}
          {selectedCategory === 'call_video' && (
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Lien de réunion</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="URL ou Lieu"
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                />
                <button
                  type="button"
                  onClick={handleGenerateDailyLink}
                  disabled={isGeneratingLink}
                  className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-500 disabled:opacity-50 transition-all"
                >
                  {isGeneratingLink ? <Loader2 size={14} className="animate-spin" /> : <Video size={14} />}
                  Visio
                </button>
              </div>
            </div>
          )}

          {/* DESCRIPTION */}
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">
              {selectedCategory === 'call_video' ? 'Notes du RDV' : "Détails de l'événement *"}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Saisir les informations..."
              rows={3}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 outline-none resize-none"
              required={selectedCategory !== 'call_video'}
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
    </div>
  )
}