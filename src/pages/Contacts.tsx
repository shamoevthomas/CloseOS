import { useState } from 'react'
import { ChevronDown, Plus, User, Phone, Mail, Pencil, Trash2, UserPlus, X, Search, Filter, Building2, Calendar, Sparkles } from 'lucide-react'
import { useProspects, type Prospect } from '../contexts/ProspectsContext'
import { useInternalContacts, type InternalContact } from '../contexts/InternalContactsContext'
import { useOffers } from '../contexts/OffersContext'
import { ProspectView } from '../components/ProspectView'
import { InternalContactModal } from '../components/InternalContactModal'
import { CreateProspectModal } from '../components/CreateProspectModal'
// MODIFICATION : Utilisation de votre fichier existant CreateEventModal pour corriger l'erreur Vercel
import { CreateEventModal } from '../components/CreateEventModal'
import { MaskedText } from '../components/MaskedText'
import { cn } from '../lib/utils'

interface LocalProspect {
  id: number
  name?: string
  firstName?: string
  lastName?: string
  company: string
  status?: string
  stage?: string
  lastInteraction?: string
  lastContact?: Date
  dateAdded?: string | Date
  email: string
  phone: string
  offer?: string
  offerId?: number
  created_at?: string
}

export function Contacts() {
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
      name: 'Sarah Johnson',
      firstName: 'Sarah',
      lastName: 'Johnson',
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
      name: 'Marc Dupont',
      firstName: 'Marc',
      lastName: 'Dupont',
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
      name: 'Emma Williams',
      firstName: 'Emma',
      lastName: 'Williams',
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

    return matchesSearch && matchesOffer
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
    if (['gagné', 'won'].includes(s)) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
    if (['perdu', 'lost'].includes(s)) return 'bg-rose-500/10 text-rose-400 border-rose-500/20'
    if (['qualifié', 'qualified'].includes(s)) return 'bg-purple-500/10 text-purple-400 border-purple-500/20'
    if (['prospect'].includes(s)) return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    if (['followup', 'follow up'].includes(s)) return 'bg-orange-500/10 text-orange-400 border-orange-500/20'
    return 'bg-slate-500/10 text-slate-400 border-slate-500/20'
  }

  // Helper to get status display name
  const getStatusName = (status: string) => {
    const names: Record<string, string> = {
      'prospect': 'Prospect',
      'qualified': 'Qualifié',
      'won': 'Gagné',
      'lost': 'Perdu',
      'followup': 'Follow Up',
      'noshow': 'No Show',
    }
    return names[status] || status
  }

  // Handlers
  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newContact.name || !newContact.role || !newContact.email || !newContact.phone) {
      alert('Veuillez remplir tous les champs')
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
      alert('⚠️ Mode Local: Impossible de supprimer les prospects en mode déconnecté')
      return
    }

    if (confirm('Êtes-vous sûr de vouloir supprimer ce prospect ?')) {
      deleteProspect(id)
    }
  }

  const handleCreateProspect = async (prospectData: {
    contact: string
    firstName: string
    lastName: string
    email: string
    phone: string
    company: string
    offer: string
    value: number
    source: string
    stage: string
  }) => {
    // 🔄 MODIFICATION : Suppression de l'alerte "Mode Déconnecté" pour forcer l'ajout dans Supabase
    if (addProspect) {
      await addProspect({
        ...prospectData,
        title: `${prospectData.offer} - ${prospectData.company}`,
        probability: 40,
        dateAdded: new Date(),
        lastContact: new Date(),
      })
    }

    setIsNewProspectModalOpen(false)
  }

  // Format date helper
  const formatDate = (date: Date | string | undefined) => {
    if (!date) return 'N/A'

    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date
      return dateObj.toLocaleDateString('fr-FR', {
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
    if (!date) return 'Jamais'

    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date
      const now = new Date()
      const diffMs = now.getTime() - dateObj.getTime()
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

      if (diffDays === 0) return "Aujourd'hui"
      if (diffDays === 1) return 'Hier'
      if (diffDays < 7) return `Il y a ${diffDays}j`
      if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} sem.`
      return formatDate(dateObj)
    } catch {
      return String(date)
    }
  }

  return (
    <div className="relative min-h-screen bg-[#020617] p-8 overflow-hidden font-sans text-slate-100">

      {/* Background Blobs (Premium Design) */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/10 opacity-30 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-purple-600/10 opacity-20 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative mx-auto max-w-7xl space-y-8 z-10">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Contacts</h1>
            <p className="text-slate-400 mt-1">Gérez vos prospects et votre équipe.</p>
          </div>
        </div>

        {/* SECTION A: Mes Prospects */}
        <div className="overflow-hidden rounded-3xl border border-white/5 bg-slate-900/40 backdrop-blur-md shadow-xl">
          {/* Header Section */}
          <div
            onClick={() => setProspectsExpanded(!prospectsExpanded)}
            className="flex w-full items-center justify-between cursor-pointer border-b border-white/5 bg-slate-900/60 px-6 py-5 transition-colors hover:bg-slate-900/80"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 border border-blue-500/20">
                <User className="h-5 w-5 text-blue-400" />
              </div>
              <div className="text-left">
                <h2 className="text-lg font-bold text-white">Mes Prospects</h2>
                <p className="text-sm text-slate-400">{filteredProspects.length} contact(s)</p>
              </div>
            </div>

            <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
              {/* BARRE DE RECHERCHE PROSPECTS */}
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={prospectSearch}
                  onChange={(e) => setProspectSearch(e.target.value)}
                  className="h-10 w-64 rounded-xl border border-white/10 bg-slate-800/50 pl-10 pr-4 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none placeholder-slate-500 transition-all hover:bg-slate-800/70"
                />
              </div>

              {/* FILTRE PAR OFFRE */}
              <div className="relative hidden md:block">
                <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <select
                  value={selectedOfferFilter}
                  onChange={(e) => setSelectedOfferFilter(e.target.value)}
                  className="h-10 rounded-xl border border-white/10 bg-slate-800/50 pl-10 pr-8 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none appearance-none cursor-pointer hover:bg-slate-800/70 transition-all"
                >
                  <option value="all" className="bg-slate-900">Toutes les offres</option>
                  {offers.filter(o => o.status === 'active').map(offer => (
                    <option key={offer.id} value={offer.id.toString()} className="bg-slate-900">
                      {offer.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => setIsNewProspectModalOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white transition-all hover:bg-blue-500 shadow-lg shadow-blue-600/20 active:scale-95"
              >
                <Plus className="h-4 w-4" />
                Nouveau
              </button>
              <ChevronDown
                className={`h-5 w-5 text-slate-400 transition-transform ${prospectsExpanded ? 'rotate-180' : ''}`}
              />
            </div>
          </div>

          {/* Content */}
          {prospectsExpanded && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5 bg-slate-900/40">
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-slate-500">
                      Nom & Entreprise
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-slate-500">
                      Offre
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-slate-500">
                      Statut
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-slate-500">
                      Dernier Contact
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-slate-500">
                      Date d'ajout
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-widest text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
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
                          className="cursor-pointer transition-colors hover:bg-white/5 group"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-400 font-bold">
                                <User className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="font-bold text-white text-base">{fullName}</p>
                                {company && (
                                  <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                                    <Building2 className="h-3 w-3" /> {company}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          {/* NOUVELLE COLONNE OFFRE */}
                          <td className="px-6 py-4">
                            <span className="text-sm text-slate-300 font-medium">
                              {prospect.offer || '-'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                              getStatusColor(status)
                            )}>
                              {status === 'won' && <Sparkles className="h-3 w-3" />}
                              {getStatusName(status)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-slate-400">{formatRelativeTime(lastContact)}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-slate-400">{formatDate(prospect.created_at || prospect.dateAdded)}</p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                              {/* BOUTON CALENDAR AJOUTÉ */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedProspect(prospect)
                                  setIsAddMeetingModalOpen(true)
                                }}
                                className="rounded-lg border border-slate-700 bg-slate-800/50 p-2 text-slate-400 transition-all hover:border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-400"
                                title="Planifier RDV"
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
                                    alert('Pas d\'email renseigné')
                                  }
                                }}
                                className="rounded-lg border border-slate-700 bg-slate-800/50 p-2 text-slate-400 transition-all hover:border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-400"
                                title="Envoyer un email"
                              >
                                <Mail className="h-4 w-4" />
                              </button>

                              <button
                                onClick={(e) => handleDeleteProspect(e, prospect.id)}
                                className="rounded-lg border border-slate-700 bg-slate-800/50 p-2 text-slate-400 transition-all hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400"
                                title="Supprimer"
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
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-500 italic">
                        Aucun prospect ne correspond à ces critères.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SECTION B: Contacts Internes */}
        <div className="overflow-hidden rounded-3xl border border-white/5 bg-slate-900/40 backdrop-blur-md shadow-xl">
          {/* Header */}
          <div
            onClick={() => setInternalsExpanded(!internalsExpanded)}
            className="flex w-full items-center justify-between cursor-pointer border-b border-white/5 bg-slate-900/60 px-6 py-5 transition-colors hover:bg-slate-900/80"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20 border border-purple-500/20">
                <UserPlus className="h-5 w-5 text-purple-400" />
              </div>
              <div className="text-left">
                <h2 className="text-lg font-bold text-white">Contacts Internes</h2>
                <p className="text-sm text-slate-400">{filteredInternalContacts.length} contact(s)</p>
              </div>
            </div>
            <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
              {/* BARRE DE RECHERCHE CONTACTS INTERNES */}
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={internalSearch}
                  onChange={(e) => setInternalSearch(e.target.value)}
                  className="h-10 w-64 rounded-xl border border-white/10 bg-slate-800/50 pl-10 pr-4 text-sm text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none placeholder-slate-500 transition-all hover:bg-slate-800/70"
                />
              </div>

              <button
                onClick={() => setIsAddContactModalOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-purple-500 px-5 py-2 text-sm font-bold text-white transition-all hover:bg-purple-600 shadow-lg shadow-purple-600/20"
              >
                <Plus className="h-4 w-4" />
                Nouveau
              </button>
              <ChevronDown
                className={`h-5 w-5 text-slate-400 transition-transform ${internalsExpanded ? 'rotate-180' : ''}`}
              />
            </div>
          </div>

          {/* Content */}
          {internalsExpanded && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5 bg-slate-900/40">
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-slate-500">
                      Nom
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-slate-500">
                      Rôle/Poste
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-slate-500">
                      Email
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-slate-500">
                      Téléphone
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-widest text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredInternalContacts.length > 0 ? (
                    filteredInternalContacts.map((contact) => (
                      <tr
                        key={contact.id}
                        onClick={() => setSelectedContact(contact)}
                        className="cursor-pointer transition-colors hover:bg-white/5 group"
                      >
                        <td className="px-6 py-4">
                          <p className="font-bold text-white">{contact.name}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center rounded-lg bg-purple-500/10 border border-purple-500/20 px-2.5 py-0.5 text-xs font-bold text-purple-400 uppercase tracking-wide">
                            {contact.role}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-300">{contact.email}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-300">{contact.phone}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedContact(contact)
                              }}
                              className="rounded-lg border border-slate-700 bg-slate-800/50 p-2 text-slate-400 transition-all hover:border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-400"
                              title="Voir détails"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                if (confirm(`Êtes-vous sûr de vouloir supprimer ${contact.name} ?`)) {
                                  handleDeleteContact(contact.id)
                                }
                              }}
                              className="rounded-lg border border-slate-700 bg-slate-800/50 p-2 text-slate-400 transition-all hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400"
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
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500 italic">
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
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setIsAddContactModalOpen(false)}
          />

          <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 shadow-2xl ring-1 ring-slate-800 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20 border border-purple-500/20">
                  <UserPlus className="h-5 w-5 text-purple-400" />
                </div>
                <h3 className="text-lg font-bold text-white">Nouveau Contact Interne</h3>
              </div>
              <button onClick={() => setIsAddContactModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddContact} className="space-y-4 p-6">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Nom complet</label>
                <input
                  type="text"
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                  placeholder="Ex: Jean Dupont"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Rôle/Poste</label>
                <input
                  type="text"
                  value={newContact.role}
                  onChange={(e) => setNewContact({ ...newContact, role: e.target.value })}
                  placeholder="Ex: Directeur Commercial"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Email</label>
                <input
                  type="email"
                  value={newContact.email}
                  onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                  placeholder="Ex: jean.dupont@closeros.com"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Téléphone</label>
                <input
                  type="tel"
                  value={newContact.phone}
                  onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                  placeholder="Ex: +33 6 12 34 56 78"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddContactModalOpen(false)}
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
    </div>
  )
}