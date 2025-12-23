import { useState, useEffect, useRef } from 'react'
import { X, Calendar, Video, Phone, MapPin, FileText, Loader2, Search, ChevronDown, User } from 'lucide-react'
import { cn } from '../lib/utils'
import { useMeetings, type Meeting } from '../contexts/MeetingsContext'
import { useProspects } from '../contexts/ProspectsContext'
import { createDailyRoom } from '../services/dailyService'

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

  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [type, setType] = useState<Meeting['type']>('call')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [isGeneratingLink, setIsGeneratingLink] = useState(false)

  // Prospect selector state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProspect, setSelectedProspect] = useState<{ id: number; name: string } | null>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Pre-fill prospect from props
  useEffect(() => {
    if (prospectId && prospectName) {
      setSelectedProspect({ id: prospectId, name: prospectName })
      setSearchQuery(prospectName)
    }
  }, [prospectId, prospectName, isOpen])

  // Pre-fill form when editing
  useEffect(() => {
    if (editingEvent) {
      setTitle(editingEvent.title)
      setDate(editingEvent.date)
      const [start, end] = editingEvent.time.split(' - ')
      setStartTime(start)
      setEndTime(end)
      setType(editingEvent.type)
      setDescription(editingEvent.description || '')
      setLocation(editingEvent.location || '')

      // Set selected prospect for editing
      if (editingEvent.prospectId && editingEvent.contact) {
        setSelectedProspect({ id: editingEvent.prospectId, name: editingEvent.contact })
        setSearchQuery(editingEvent.contact)
      }
    } else if (!prospectId) {
      // Reset form when creating new (only if not pre-filled with prospect)
      setTitle('')
      setDate('')
      setStartTime('')
      setEndTime('')
      setType('call')
      setDescription('')
      setLocation('')
      setSearchQuery('')
      setSelectedProspect(null)
    }
  }, [editingEvent, isOpen, prospectId])

  // Close dropdown when clicking outside
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

  // Filter prospects based on search query
  const filteredProspects = prospects.filter((prospect) => {
    const query = searchQuery.toLowerCase()
    const prospectName = prospect.title || prospect.contact || ''
    return (
      prospectName.toLowerCase().includes(query) ||
      (prospect.company && prospect.company.toLowerCase().includes(query))
    )
  })

  // Handle prospect selection
  const handleSelectProspect = (prospect: typeof prospects[0]) => {
    const name = prospect.title || prospect.contact
    setSelectedProspect({ id: prospect.id, name })
    setSearchQuery(name)
    setIsDropdownOpen(false)
  }

  // Generate Daily.co video link
  const handleGenerateDailyLink = async () => {
    setIsGeneratingLink(true)
    try {
      const roomUrl = await createDailyRoom()
      setLocation(roomUrl)
      alert('✅ Lien de visio Daily.co généré avec succès !')
    } catch (error) {
      console.error('Error generating Daily.co link:', error)
      alert('❌ Erreur lors de la génération du lien de visio')
    } finally {
      setIsGeneratingLink(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!title || !date || !startTime || !endTime) {
      alert('Veuillez remplir tous les champs')
      return
    }

    if (editingEvent) {
      // Update existing meeting
      updateMeeting(editingEvent.id, {
        title,
        date,
        time: `${startTime} - ${endTime}`,
        type,
        description,
        location,
      })
      console.log('✅ Meeting updated:', editingEvent.id)
    } else {
      // Create new meeting
      // Use selectedProspect if available, otherwise fall back to props
      const finalProspectId = selectedProspect?.id || prospectId
      const finalProspectName = selectedProspect?.name || prospectName

      if (!finalProspectId || !finalProspectName) {
        alert('Veuillez sélectionner un prospect')
        return
      }

      addMeeting({
        prospectId: finalProspectId,
        contact: finalProspectName,
        title,
        date,
        time: `${startTime} - ${endTime}`,
        type,
        status: 'upcoming',
        description,
        location,
      })
      console.log('✅ Meeting created')
    }

    // Reset and close
    setTitle('')
    setDate('')
    setStartTime('')
    setEndTime('')
    setType('call')
    setDescription('')
    setLocation('')
    setSearchQuery('')
    setSelectedProspect(null)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl bg-slate-900 shadow-2xl ring-1 ring-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20">
              <Calendar className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                {editingEvent ? 'Modifier le RDV' : 'Programmer un RDV'}
              </h3>
              {(selectedProspect || prospectName || editingEvent?.contact) && (
                <p className="text-sm text-slate-400">
                  avec {selectedProspect?.name || editingEvent?.contact || prospectName}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {/* Prospect / Client Selector - Only show if not pre-filled */}
          {!prospectId && !editingEvent && (
            <div className="relative" ref={dropdownRef}>
              <label className="mb-2 block text-sm font-medium text-slate-400">
                <User className="inline h-3.5 w-3.5 mr-1" />
                Prospect / Client *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setIsDropdownOpen(true)
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  placeholder="Rechercher un contact..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 pr-10 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  required
                />
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  {selectedProspect ? (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/20">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                    </div>
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-500" />
                  )}
                </div>
              </div>

              {/* Dropdown List */}
              {isDropdownOpen && (
                <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-700 bg-slate-800 shadow-xl">
                  {filteredProspects.length > 0 ? (
                    filteredProspects.map((prospect) => (
                      <button
                        key={prospect.id}
                        type="button"
                        onClick={() => handleSelectProspect(prospect)}
                        className="flex w-full items-start gap-3 border-b border-slate-700/50 px-4 py-3 text-left transition-colors hover:bg-slate-700 last:border-b-0"
                      >
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20">
                          <User className="h-4 w-4 text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white">
                            {prospect.title || prospect.contact}
                          </p>
                          {prospect.company && (
                            <p className="text-xs text-slate-400">{prospect.company}</p>
                          )}
                        </div>
                        {selectedProspect?.id === prospect.id && (
                          <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-green-500">
                            <div className="h-2 w-2 rounded-full bg-white" />
                          </div>
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-8 text-center">
                      <Search className="mx-auto mb-2 h-8 w-8 text-slate-600" />
                      <p className="text-sm text-slate-500">Aucun prospect trouvé</p>
                      <p className="mt-1 text-xs text-slate-600">
                        Essayez une autre recherche
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Type de RDV */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-400">Type de rendez-vous</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setType('call')}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-lg border p-3 transition-all',
                  type === 'call'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                    : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                )}
              >
                <Phone className="h-5 w-5" />
                <span className="text-xs font-medium">Appel</span>
              </button>
              <button
                type="button"
                onClick={() => setType('video')}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-lg border p-3 transition-all',
                  type === 'video'
                    ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                    : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                )}
              >
                <Video className="h-5 w-5" />
                <span className="text-xs font-medium">Visio</span>
              </button>
              <button
                type="button"
                onClick={() => setType('meeting')}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-lg border p-3 transition-all',
                  type === 'meeting'
                    ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                    : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                )}
              >
                <MapPin className="h-5 w-5" />
                <span className="text-xs font-medium">Présentiel</span>
              </button>
            </div>
          </div>

          {/* Titre */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-400">Titre</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Appel de découverte"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              required
            />
          </div>

          {/* Date */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-400">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              required
            />
          </div>

          {/* Heures */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-400">Heure de début</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-400">Heure de fin</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-400">
              <MapPin className="inline h-3.5 w-3.5 mr-1" />
              Lieu / Lien Visio (optionnel)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ex: Bureau Paris, https://daily.co/..."
                className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleGenerateDailyLink}
                disabled={isGeneratingLink}
                className="flex items-center gap-2 whitespace-nowrap rounded-lg bg-purple-500 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Générer un lien Daily.co automatiquement"
              >
                {isGeneratingLink ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Génération...
                  </>
                ) : (
                  <>
                    <Video className="h-4 w-4" />
                    Générer Lien Visio
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-400">
              <FileText className="inline h-3.5 w-3.5 mr-1" />
              Description (optionnel)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ajouter des notes ou détails sur ce rendez-vous..."
              rows={3}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-all hover:bg-slate-800"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-blue-600"
            >
              {editingEvent ? 'Enregistrer' : 'Programmer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
