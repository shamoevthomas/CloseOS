import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Plus, User, Phone, Mail, Pencil, Trash2, UserPlus, X, Search, Filter, Building2, Calendar, Sparkles, Tag, Check, ArrowDownUp } from 'lucide-react'
import { useProspects, type Prospect } from '../contexts/ProspectsContext'
import { useInternalContacts, type InternalContact } from '../contexts/InternalContactsContext'
import { useOffers } from '../contexts/OffersContext'
import { useCustomStages } from '../hooks/useCustomStages'
import { useTags } from '../hooks/useTags'
import { ProspectView } from '../components/ProspectView'
import { InternalContactModal } from '../components/InternalContactModal'
import { CreateProspectModal } from '../components/CreateProspectModal'
// MODIFICATION : Utilisation de votre fichier existant CreateEventModal pour corriger l'erreur Vercel
import { CreateEventModal } from '../components/CreateEventModal'
import { ImportExportModal } from '../components/ImportExportModal'
import { MaskedText } from '../components/MaskedText'
import { cn } from '../lib/utils'
import { useLanguage } from '../contexts/LanguageContext'
import { contactsTranslations } from '../i18n/translations'

interface LocalProspect extends Prospect {
  status?: string
}

export function Contacts() {
  const { lang } = useLanguage()
  const t = contactsTranslations[lang]
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'
  const { allStages, getStageInfo } = useCustomStages()
  const { tags, prospectTags, getProspectTagObjects } = useTags()
  const [selectedTagFilters, setSelectedTagFilters] = useState<string[]>([])
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false)
  const [isImportExportOpen, setIsImportExportOpen] = useState(false)
  const tagDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
        setIsTagDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // 🔄 SAFE CONTEXT CONNECTION - Try to connect to global context with fallback
  let context
  try {
    context = useProspects()
  } catch (error) {
    console.error('Failed to connect to ProspectsContext:', error)
    context = null
  }

  // Check if connection is valid
  const isConnected = !!(context && context.prospects && Array.isArray(context.prospects))

  // 📦 FALLBACK LOCAL STATE (used if global fails)
  const [localProspects] = useState<LocalProspect[]>([
    {
      id: 1,
      user_id: 'mock-1',
      contact: 'Sarah Johnson',
      company: 'Tech Innovations Inc',
      status: 'Qualifié',
      stage: 'qualified',
      lastInteraction: '2024-01-15',
      dateAdded: '2024-01-01',
      email: 'sarah@techinno.com',
      phone: '+33 6 12 34 56 78',
      offer: 'Genix',
      created_at: '2024-01-01T10:00:00Z'
    },
    {
      id: 2,
      user_id: 'mock-1',
      contact: 'Marc Dupont',
      company: 'Digital Ventures',
      status: 'Prospect',
      stage: 'prospect',
      lastInteraction: '2024-01-20',
      dateAdded: '2024-01-05',
      email: 'marc@digitalvent.io',
      phone: '+33 7 98 76 54 32',
      offer: 'Bodymind',
      created_at: '2024-01-05T14:30:00Z'
    },
    {
      id: 3,
      user_id: 'mock-1',
      contact: 'Emma Williams',
      company: 'Global Solutions Ltd',
      status: 'Gagné',
      stage: 'won',
      lastInteraction: '2024-01-18',
      dateAdded: '2024-01-10',
      email: 'emma@globalsol.com',
      phone: '+33 6 45 67 89 01',
      offer: 'Genix',
      created_at: '2024-01-10T09:15:00Z'
    }
  ])

  // Use global data if connected, otherwise use local fallback
  const displayProspects = isConnected ? context.prospects : localProspects
  const { addProspect, deleteProspect, updateProspect } = context || {}

  // Global internal contacts from context
  const { contacts: internalContacts, addContact, deleteContact, updateContact } = useInternalContacts()

  // Global offers from context
  const { offers } = useOffers()

  // UI state
  const [prospectsExpanded, setProspectsExpanded] = useState(true)
  const [internalsExpanded, setInternalsExpanded] = useState(true)
  const [isAddContactModalOpen, setIsAddContactModalOpen] = useState(false)
  const [isNewProspectModalOpen, setIsNewProspectModalOpen] = useState(false)
  // MODIFICATION : État pour la modale de rendez-vous
  const [isAddMeetingModalOpen, setIsAddMeetingModalOpen] = useState(false)
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null)
  const [selectedContact, setSelectedContact] = useState<InternalContact | null>(null)

  // --- NOUVEAU : États pour la recherche et le filtrage ---
  const [prospectSearch, setProspectSearch] = useState('')
  const [internalSearch, setInternalSearch] = useState('')
  const [selectedOfferFilter, setSelectedOfferFilter] = useState<string>('all')

  // Form state
  const [newContact, setNewContact] = useState({
    name: '',
    role: '',
    email: '',
    phone: ''
    // SUPPRESSION DES CHAMPS DE FACTURATION ICI
  })

  // --- LOGIQUE DE FILTRAGE DES PROSPECTS (AJOUTÉE) ---
  const filteredProspects = displayProspects.filter(prospect => {
    // 1. Filtre par recherche textuelle (Nom, Entreprise, Email)
    const term = prospectSearch.toLowerCase()
    const fullName = prospect.name || `${prospect.firstName || ''} ${prospect.lastName || ''}`
    const matchesSearch =
      fullName.toLowerCase().includes(term) ||
      (prospect.company || '').toLowerCase().includes(term) ||
      (prospect.email || '').toLowerCase().includes(term)

    // 2. Filtre par Offre
    let matchesOffer = true
    if (selectedOfferFilter !== 'all') {
      // On cherche l'objet offre correspondant à l'ID sélectionné
      const selectedOfferObj = offers.find(o => o.id.toString() === selectedOfferFilter)

      if (selectedOfferObj) {
        // On compare soit avec l'ID, soit avec le NOM de l'offre (plus robuste)
        const offerNameMatch = (prospect.offer || '').trim() === selectedOfferObj.name.trim()
        const offerIdMatch = prospect.offerId?.toString() === selectedOfferFilter
        matchesOffer = offerNameMatch || offerIdMatch
      } else {
        matchesOffer = false
      }
    }

    // Tag filter
    const matchesTags = selectedTagFilters.length === 0 || (() => {
      const pTags = prospectTags[prospect.id] || []
      return selectedTagFilters.some(t => pTags.includes(t))
    })()

    return matchesSearch && matchesOffer && matchesTags
  })

  // --- LOGIQUE DE FILTRAGE DES CONTACTS INTERNES (AJOUTÉE) ---
  const filteredInternalContacts = internalContacts.filter(contact => {
    const term = internalSearch.toLowerCase()
    return (
      contact.name.toLowerCase().includes(term) ||
      contact.role.toLowerCase().includes(term) ||
      contact.email.toLowerCase().includes(term)
    )
  })

  // Helper to get status color (Design Premium)
  const getStatusColor = (status: string) => {
    const s = (status || '').toLowerCase()
    // Check default stages
    if (['gagné', 'won'].includes(s)) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
    if (['perdu', 'lost'].includes(s)) return 'bg-rose-500/10 text-rose-400 border-rose-500/20'
    if (['qualifié', 'qualified'].includes(s)) return 'bg-purple-500/10 text-purple-400 border-purple-500/20'
    if (['prospect'].includes(s)) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    if (['followup', 'follow up'].includes(s)) return 'bg-orange-500/10 text-orange-400 border-orange-500/20'
    // Check custom stages
    const si = getStageInfo(status)
    if (si && !si.isDefault) return 'bg-white/5 text-white/60 border-white/10'
    return 'bg-white/5 text-white/40 border-white/10'
  }

  // Helper to get status display name
  const getStatusName = (status: string) => {
    const si = getStageInfo(status)
    if (si) return si.name
    return status
  }

  // Handlers
  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newContact.name || !newContact.role || !newContact.email || !newContact.phone) {
      alert(lang === 'fr' ? 'Veuillez remplir tous les champs' : 'Please fill in all fields')
      return
    }

    // 🔄 MODIFICATION : Appel direct avec async pour garantir l'affichage
    await addContact(newContact)
    setNewContact({
      name: '',
      role: '',
      email: '',
      phone: ''
    })
    setIsAddContactModalOpen(false)
  }

  const handleDeleteContact = (id: number) => {
    deleteContact(id)
  }

  const handleDeleteProspect = (e: React.MouseEvent, id: number) => {
    e.stopPropagation()

    if (!isConnected || !deleteProspect) {
      alert(lang === 'fr' ? '⚠️ Mode Local: Impossible de supprimer les prospects en mode déconnecté' : '⚠️ Local Mode: Cannot delete prospects while disconnected')
      return
    }

    if (confirm(lang === 'fr' ? 'Êtes-vous sûr de vouloir supprimer ce prospect ?' : 'Are you sure you want to delete this prospect?')) {
      deleteProspect(id)
    }
  }

  const handleCreateProspect = async (prospectData: {
    contact: string
    firstName: string
    lastName: string
    email: string | null
    phone: string | null
    company: string | null
    offer: string
    offer_id?: number
    value: number
    stage: string
  }) => {
    // 🔄 MODIFICATION : Suppression de l'alerte "Mode Déconnecté" pour forcer l'ajout dans Supabase
    if (addProspect) {
      await addProspect({
        ...prospectData,
        title: `${prospectData.offer} - ${prospectData.company}`,
        probability: 40,
        dateAdded: new Date().toISOString(),
        lastContact: new Date().toISOString(),
      })
    }

    setIsNewProspectModalOpen(false)
  }

  // Format date helper
  const formatDate = (date: Date | string | undefined) => {
    if (!date) return 'N/A'

    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date
      return dateObj.toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    } catch {
      return String(date)
    }
  }

  // Format relative time helper
  const formatRelativeTime = (date: Date | string | undefined) => {
    if (!date) return lang === 'fr' ? 'Jamais' : 'Never'

    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date
      const now = new Date()
      const diffMs = now.getTime() - dateObj.getTime()
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

      if (diffDays === 0) return lang === 'fr' ? "Aujourd'hui" : 'Today'
      if (diffDays === 1) return lang === 'fr' ? 'Hier' : 'Yesterday'
      if (diffDays < 7) return lang === 'fr' ? `Il y a ${diffDays}j` : `${diffDays}d ago`
      if (diffDays < 30) return lang === 'fr' ? `Il y a ${Math.floor(diffDays / 7)} sem.` : `${Math.floor(diffDays / 7)}w ago`
      return formatDate(dateObj)
    } catch {
      return String(date)
    }
  }

  return (
    <div className="relative min-h-screen bg-[#111111] p-8 md:p-10 overflow-hidden font-sans text-white">

      {/* Ambient Glows */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="relative mx-auto max-w-7xl space-y-10 z-10">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tighter">{t.title}</h1>
            <p className="text-white/40 text-sm font-medium mt-2">{lang === 'fr' ? 'Gérez vos prospects et votre équipe.' : 'Manage your prospects and your team.'}</p>
          </div>
        </div>

        {/* SECTION A: Mes Prospects */}
        <div className="rounded-2xl border-[0.5px] border-white/[0.08] bg-white/[0.03] backdrop-blur-[16px] shadow-[0_20px_40px_rgba(0,0,0,0.2)]">
          {/* Header Section */}
          <div
            onClick={() => setProspectsExpanded(!prospectsExpanded)}
            className="flex w-full items-center justify-between cursor-pointer bg-white/[0.02] px-8 py-6 transition-colors duration-300 hover:bg-white/[0.04] rounded-t-2xl"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-500/20">
                <User className="h-5 w-5 text-emerald-400" />
              </div>
              <div className="text-left">
                <h2 className="text-lg font-bold text-white">{lang === 'fr' ? 'Mes Prospects' : 'My Prospects'}</h2>
                <p className="text-sm text-white/40">{filteredProspects.length} contact(s)</p>
              </div>
            </div>

            <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
              {/* BARRE DE RECHERCHE PROSPECTS */}
              <div className="relative hidden md:block">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  placeholder={lang === 'fr' ? 'Rechercher...' : 'Search...'}
                  value={prospectSearch}
                  onChange={(e) => setProspectSearch(e.target.value)}
                  className="h-11 w-64 rounded-xl border border-white/10 bg-white/5 pl-11 pr-4 text-sm text-white focus:border-emerald-500 focus:outline-none placeholder:text-white/30 transition-all hover:bg-white/[0.08]"
                />
              </div>

              {/* FILTRE PAR OFFRE */}
              <div className="relative hidden md:block">
                <Filter className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30 pointer-events-none" />
                <select
                  value={selectedOfferFilter}
                  onChange={(e) => setSelectedOfferFilter(e.target.value)}
                  className="h-11 rounded-xl border border-white/10 bg-white/5 pl-11 pr-9 text-sm text-white focus:border-emerald-500 focus:outline-none appearance-none cursor-pointer hover:bg-white/[0.08] transition-all"
                >
                  <option value="all" className="bg-[#1a1a1a]">{lang === 'fr' ? 'Toutes les offres' : 'All offers'}</option>
                  {offers.filter(o => o.status === 'active').map(offer => (
                    <option key={offer.id} value={offer.id.toString()} className="bg-[#1a1a1a]">
                      {offer.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tag filters dropdown */}
              {tags.length > 0 && (
                <div className="relative hidden md:block" ref={tagDropdownRef}>
                  <button
                    onClick={() => setIsTagDropdownOpen(!isTagDropdownOpen)}
                    className={cn(
                      'flex items-center gap-2 h-11 rounded-xl border px-4 text-sm font-medium transition-all duration-300',
                      selectedTagFilters.length > 0
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                        : 'border-white/10 bg-white/5 text-white/40 hover:bg-white/[0.08]'
                    )}
                  >
                    <Tag className="h-3.5 w-3.5" />
                    <span>Tags</span>
                    {selectedTagFilters.length > 0 && (
                      <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-black">
                        {selectedTagFilters.length}
                      </span>
                    )}
                    <ChevronDown className={cn('h-3 w-3 transition-transform', isTagDropdownOpen && 'rotate-180')} />
                  </button>
                  {isTagDropdownOpen && (
                    <div className="absolute top-full mt-1 right-0 z-50 min-w-[200px] max-h-[180px] overflow-y-auto rounded-xl border border-white/[0.08] bg-[#1a1a1a] p-1.5 shadow-xl">
                      {tags.map(tag => {
                        const isSelected = selectedTagFilters.includes(tag.id)
                        return (
                          <button
                            key={tag.id}
                            onClick={() => setSelectedTagFilters(prev =>
                              isSelected ? prev.filter(id => id !== tag.id) : [...prev, tag.id]
                            )}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                              isSelected ? 'bg-emerald-500/10 text-white' : 'text-white/40 hover:bg-white/5 hover:text-white/60'
                            )}
                          >
                            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                            <span className="flex-1 text-left">{tag.name}</span>
                            {isSelected && <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
                          </button>
                        )
                      })}
                      {selectedTagFilters.length > 0 && (
                        <>
                          <div className="my-1 border-t border-white/[0.08]" />
                          <button
                            onClick={() => { setSelectedTagFilters([]); setIsTagDropdownOpen(false) }}
                            className="w-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/40 hover:text-white/60 transition-colors rounded-lg"
                          >
                            {lang === 'fr' ? 'Réinitialiser' : 'Reset'}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={() => setIsImportExportOpen(true)}
                className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/60 hover:text-white hover:bg-white/[0.06] transition-all"
              >
                <ArrowDownUp className="h-4 w-4" />
                <span className="hidden lg:inline">{lang === 'fr' ? 'Import / Export' : 'Import / Export'}</span>
              </button>
              <button
                onClick={() => setIsNewProspectModalOpen(true)}
                className="flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-black transition-all hover:bg-emerald-400 shadow-lg shadow-emerald-600/20 active:scale-95"
              >
                <Plus className="h-4 w-4" />
                {lang === 'fr' ? 'Nouveau' : 'New'}
              </button>
              <ChevronDown
                className={`h-5 w-5 text-white/40 transition-transform ${prospectsExpanded ? 'rotate-180' : ''}`}
              />
            </div>
          </div>

          {/* Content */}
          {prospectsExpanded && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-white/[0.02]">
                    <th className="px-8 py-5 text-left text-xs font-bold uppercase tracking-widest text-white/40">
                      {lang === 'fr' ? 'Nom & Entreprise' : 'Name & Company'}
                    </th>
                    <th className="px-8 py-5 text-left text-xs font-bold uppercase tracking-widest text-white/40">
                      Tags
                    </th>
                    <th className="px-8 py-5 text-left text-xs font-bold uppercase tracking-widest text-white/40">
                      {lang === 'fr' ? 'Offre' : 'Offer'}
                    </th>
                    <th className="px-8 py-5 text-left text-xs font-bold uppercase tracking-widest text-white/40">
                      {lang === 'fr' ? 'Statut' : 'Status'}
                    </th>
                    <th className="px-8 py-5 text-left text-xs font-bold uppercase tracking-widest text-white/40">
                      {lang === 'fr' ? 'Dernier Contact' : 'Last Contact'}
                    </th>
                    <th className="px-8 py-5 text-left text-xs font-bold uppercase tracking-widest text-white/40">
                      {lang === 'fr' ? "Date d'ajout" : 'Date Added'}
                    </th>
                    <th className="px-8 py-5 text-center text-xs font-bold uppercase tracking-widest text-white/40">
                      {lang === 'fr' ? 'Actions' : 'Actions'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredProspects.length > 0 ? (
                    filteredProspects.map((prospect) => {
                      // Safe field extraction with fallbacks
                      const firstName = prospect.firstName || ''
                      const lastName = prospect.lastName || ''
                      const fullName = prospect.name || `${firstName} ${lastName}`.trim() || 'N/A'

                      const rawCompany = prospect.company || ''
                      const company = rawCompany === 'N/A' ? '' : rawCompany

                      const status = prospect.stage || prospect.status || 'prospect'
                      const lastContact = prospect.lastContact || prospect.lastInteraction
                      const dateAdded = prospect.dateAdded
                      const email = prospect.email || ''

                      return (
                        <tr
                          key={prospect.id}
                          onClick={() => setSelectedProspect(prospect)}
                          className="cursor-pointer transition-colors duration-300 hover:bg-white/[0.04] group"
                        >
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold">
                                <User className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="font-bold text-white text-base">{fullName}</p>
                                {company && (
                                  <p className="text-xs text-white/40 mt-0.5 flex items-center gap-1">
                                    <Building2 className="h-3 w-3" /> {company}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          {/* Tags */}
                          <td className="px-8 py-5">
                            <div className="flex flex-wrap gap-1">
                              {getProspectTagObjects(prospect.id).map(tag => (
                                <span key={tag.id} className="inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: tag.color }}>
                                  {tag.name}
                                </span>
                              ))}
                            </div>
                          </td>
                          {/* NOUVELLE COLONNE OFFRE */}
                          <td className="px-8 py-5">
                            <span className="text-sm text-white/60 font-medium">
                              {prospect.offer || '-'}
                            </span>
                          </td>
                          <td className="px-8 py-5">
                            <span className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                              getStatusColor(status)
                            )}>
                              {status === 'won' && <Sparkles className="h-3 w-3" />}
                              {getStatusName(status)}
                            </span>
                          </td>
                          <td className="px-8 py-5">
                            <p className="text-sm text-white/40">{formatRelativeTime(lastContact)}</p>
                          </td>
                          <td className="px-8 py-5">
                            <p className="text-sm text-white/40">{formatDate(prospect.created_at || prospect.dateAdded)}</p>
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                              {/* BOUTON CALENDAR AJOUTÉ */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedProspect(prospect)
                                  setIsAddMeetingModalOpen(true)
                                }}
                                className="rounded-lg border border-white/[0.08] bg-white/5 p-2 text-white/40 transition-all hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-400"
                                title={lang === 'fr' ? 'Planifier RDV' : 'Schedule meeting'}
                              >
                                <Calendar className="h-4 w-4" />
                              </button>

                              {/* BOUTON GMAIL */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (email) {
                                    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${email}`, '_blank')
                                  } else {
                                    alert(lang === 'fr' ? 'Pas d\'email renseigné' : 'No email provided')
                                  }
                                }}
                                className="rounded-lg border border-white/[0.08] bg-white/5 p-2 text-white/40 transition-all hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-400"
                                title={lang === 'fr' ? 'Envoyer un email' : 'Send email'}
                              >
                                <Mail className="h-4 w-4" />
                              </button>

                              <button
                                onClick={(e) => handleDeleteProspect(e, prospect.id)}
                                className="rounded-lg border border-white/[0.08] bg-white/5 p-2 text-white/40 transition-all hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400"
                                title={lang === 'fr' ? 'Supprimer' : 'Delete'}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-8 py-16 text-center text-white/40 italic">
                        {lang === 'fr' ? 'Aucun prospect ne correspond à ces critères.' : 'No prospects match these criteria.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SECTION B: Contacts Internes */}
        <div className="overflow-hidden rounded-2xl border-[0.5px] border-white/[0.08] bg-white/[0.03] backdrop-blur-[16px] shadow-[0_20px_40px_rgba(0,0,0,0.2)]">
          {/* Header */}
          <div
            onClick={() => setInternalsExpanded(!internalsExpanded)}
            className="flex w-full items-center justify-between cursor-pointer bg-white/[0.02] px-8 py-6 transition-colors duration-300 hover:bg-white/[0.04]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20 border border-purple-500/20">
                <UserPlus className="h-5 w-5 text-purple-400" />
              </div>
              <div className="text-left">
                <h2 className="text-lg font-bold text-white">{t.internal}</h2>
                <p className="text-sm text-white/40">{filteredInternalContacts.length} contact(s)</p>
              </div>
            </div>
            <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
              {/* BARRE DE RECHERCHE CONTACTS INTERNES */}
              <div className="relative hidden md:block">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  placeholder={lang === 'fr' ? 'Rechercher...' : 'Search...'}
                  value={internalSearch}
                  onChange={(e) => setInternalSearch(e.target.value)}
                  className="h-11 w-64 rounded-xl border border-white/10 bg-white/5 pl-11 pr-4 text-sm text-white focus:border-emerald-500 focus:outline-none placeholder:text-white/30 transition-all hover:bg-white/[0.08]"
                />
              </div>

              <button
                onClick={() => setIsAddContactModalOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-purple-500 px-5 py-2 text-sm font-bold text-white transition-all hover:bg-purple-600 shadow-lg shadow-purple-600/20"
              >
                <Plus className="h-4 w-4" />
                {lang === 'fr' ? 'Nouveau' : 'New'}
              </button>
              <ChevronDown
                className={`h-5 w-5 text-white/40 transition-transform ${internalsExpanded ? 'rotate-180' : ''}`}
              />
            </div>
          </div>

          {/* Content */}
          {internalsExpanded && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-white/[0.02]">
                    <th className="px-8 py-5 text-left text-xs font-bold uppercase tracking-widest text-white/40">
                      Nom
                    </th>
                    <th className="px-8 py-5 text-left text-xs font-bold uppercase tracking-widest text-white/40">
                      Rôle/Poste
                    </th>
                    <th className="px-8 py-5 text-left text-xs font-bold uppercase tracking-widest text-white/40">
                      Email
                    </th>
                    <th className="px-8 py-5 text-left text-xs font-bold uppercase tracking-widest text-white/40">
                      Téléphone
                    </th>
                    <th className="px-8 py-5 text-center text-xs font-bold uppercase tracking-widest text-white/40">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredInternalContacts.length > 0 ? (
                    filteredInternalContacts.map((contact) => (
                      <tr
                        key={contact.id}
                        onClick={() => setSelectedContact(contact)}
                        className="cursor-pointer transition-colors duration-300 hover:bg-white/[0.04] group"
                      >
                        <td className="px-8 py-5">
                          <p className="font-bold text-white">{contact.name}</p>
                        </td>
                        <td className="px-8 py-5">
                          <span className="inline-flex items-center rounded-lg bg-purple-500/10 border border-purple-500/20 px-2.5 py-0.5 text-xs font-bold text-purple-400 uppercase tracking-wide">
                            {contact.role}
                          </span>
                        </td>
                        <td className="px-8 py-5">
                          <p className="text-sm text-white/60">{contact.email}</p>
                        </td>
                        <td className="px-8 py-5">
                          <p className="text-sm text-white/60">{contact.phone}</p>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedContact(contact)
                              }}
                              className="rounded-lg border border-white/[0.08] bg-white/5 p-2 text-white/40 transition-all hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-400"
                              title="Voir détails"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                if (confirm(lang === 'fr' ? `Êtes-vous sûr de vouloir supprimer ${contact.name} ?` : `Are you sure you want to delete ${contact.name}?`)) {
                                  handleDeleteContact(contact.id)
                                }
                              }}
                              className="rounded-lg border border-white/[0.08] bg-white/5 p-2 text-white/40 transition-all hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400"
                              title="Supprimer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-8 py-16 text-center text-white/40 italic">
                        Aucun contact interne trouvé pour cette recherche.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Contact Modal */}
      {isAddContactModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            onClick={() => setIsAddContactModalOpen(false)}
          />

          <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-[#1a1a1a] shadow-2xl ring-1 ring-white/[0.08] animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-white/[0.08] p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20 border border-purple-500/20">
                  <UserPlus className="h-5 w-5 text-purple-400" />
                </div>
                <h3 className="text-lg font-bold text-white">Nouveau Contact Interne</h3>
              </div>
              <button onClick={() => setIsAddContactModalOpen(false)} className="text-white/40 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddContact} className="space-y-4 p-6">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-white/40">Nom complet</label>
                <input
                  type="text"
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                  placeholder="Ex: Jean Dupont"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-emerald-500 focus:outline-none transition-all"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-white/40">Rôle/Poste</label>
                <input
                  type="text"
                  value={newContact.role}
                  onChange={(e) => setNewContact({ ...newContact, role: e.target.value })}
                  placeholder="Ex: Directeur Commercial"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-emerald-500 focus:outline-none transition-all"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-white/40">Email</label>
                <input
                  type="email"
                  value={newContact.email}
                  onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                  placeholder="Ex: jean.dupont@closeros.com"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-emerald-500 focus:outline-none transition-all"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-white/40">Téléphone</label>
                <input
                  type="tel"
                  value={newContact.phone}
                  onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                  placeholder="Ex: +33 6 12 34 56 78"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-emerald-500 focus:outline-none transition-all"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddContactModalOpen(false)}
                  className="flex-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-bold text-white/80 transition-all hover:bg-white/10 hover:text-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-full bg-emerald-500 px-4 py-3 text-sm font-semibold text-black transition-all hover:bg-emerald-400 shadow-lg shadow-emerald-600/20"
                >
                  Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Prospect Modal */}
      <CreateProspectModal
        isOpen={isNewProspectModalOpen}
        onClose={() => setIsNewProspectModalOpen(false)}
        onSubmit={handleCreateProspect}
      />

      {/* Prospect View Slide-over */}
      {selectedProspect && (
        <ProspectView
          prospect={selectedProspect}
          onClose={() => setSelectedProspect(null)}
          onUpdate={(id, updates) => {
            if (updateProspect) {
              updateProspect(id, updates)
            }
          }}
          onDelete={(id) => {
            if (deleteProspect) {
              deleteProspect(id)
            }
            setSelectedProspect(null)
          }}
          // MODIFICATION : Lien direct vers la modale de rendez-vous
          onCreateEvent={() => setIsAddMeetingModalOpen(true)}
          onStartCall={(withAi) => {
            console.log('Start call with AI:', withAi)
            // TODO: Implement video call
          }}
          onPhoneCall={() => {
            console.log('Phone call:', selectedProspect.phone)
            // TODO: Implement phone call
          }}
        />
      )}

      {/* MODIFICATION : Nouvelle modale de création de RDV avec sélection automatique du prospect utilisant CreateEventModal */}
      {isAddMeetingModalOpen && (
        <CreateEventModal
          isOpen={isAddMeetingModalOpen}
          onClose={() => setIsAddMeetingModalOpen(false)}
          prospectId={selectedProspect?.id}
          prospectName={selectedProspect?.contact || (selectedProspect?.name)}
        />
      )}

      {/* Internal Contact Modal */}
      {selectedContact && (
        <InternalContactModal
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
          onEdit={(updatedContact) => {
            updateContact(updatedContact.id, updatedContact)
            setSelectedContact(updatedContact)
          }}
          onDelete={handleDeleteContact}
        />
      )}

      <ImportExportModal
        isOpen={isImportExportOpen}
        onClose={() => setIsImportExportOpen(false)}
        source="contacts"
        prospects={displayProspects}
      />
    </div>
  )
}