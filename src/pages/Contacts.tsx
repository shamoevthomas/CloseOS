import { useState } from 'react'
import { ChevronDown, Plus, User, Phone, Mail, Edit2, Trash2, UserPlus, X } from 'lucide-react'
import { useProspects, type Prospect } from '../contexts/ProspectsContext'
import { useInternalContacts, type InternalContact } from '../contexts/InternalContactsContext'
import { useOffers } from '../contexts/OffersContext'
import { ProspectView } from '../components/ProspectView'
import { InternalContactModal } from '../components/InternalContactModal'
import { CreateProspectModal } from '../components/CreateProspectModal'

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
      phone: '+33 6 12 34 56 78'
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
      phone: '+33 7 98 76 54 32'
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
      phone: '+33 6 45 67 89 01'
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
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null)
  const [selectedContact, setSelectedContact] = useState<InternalContact | null>(null)

  // Form state
  const [newContact, setNewContact] = useState({
    name: '',
    role: '',
    email: '',
    phone: '',
    linkedOfferId: undefined as string | undefined,
    isBillingContact: false,
    billingAddress: undefined as string | undefined,
    siret: undefined as string | undefined
  })

  // Helper to get status color
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'Prospect': 'bg-blue-500/10 text-blue-400',
      'prospect': 'bg-blue-500/10 text-blue-400',
      'Qualifié': 'bg-purple-500/10 text-purple-400',
      'qualified': 'bg-purple-500/10 text-purple-400',
      'Gagné': 'bg-emerald-500/10 text-emerald-400',
      'won': 'bg-emerald-500/10 text-emerald-400',
      'Perdu': 'bg-rose-500/10 text-rose-400',
      'lost': 'bg-rose-500/10 text-rose-400',
    }
    return colors[status] || 'bg-slate-500/10 text-slate-400'
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
      phone: '',
      linkedOfferId: undefined,
      isBillingContact: false,
      billingAddress: undefined,
      siret: undefined
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
    <div className="h-full overflow-auto bg-slate-950 p-8 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* SECTION A: Mes Prospects */}
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          {/* Header */}
          <button
            onClick={() => setProspectsExpanded(!prospectsExpanded)}
            className="flex w-full items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-4 transition-colors hover:bg-slate-900/50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20">
                <User className="h-5 w-5 text-blue-400" />
              </div>
              <div className="text-left">
                <h2 className="text-lg font-bold text-white">Mes Prospects</h2>
                <p className="text-sm text-slate-400">{displayProspects.length} contacts</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsNewProspectModalOpen(true)
                }}
                className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-blue-600"
              >
                <Plus className="h-4 w-4" />
                Nouveau Prospect
              </button>
              <ChevronDown
                className={`h-5 w-5 text-slate-400 transition-transform ${prospectsExpanded ? 'rotate-180' : ''}`}
              />
            </div>
          </button>

          {/* Content */}
          {prospectsExpanded && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950">
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Nom & Entreprise
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Statut
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Dernier Contact
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Date d'ajout
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {displayProspects.map((prospect) => {
                    // Safe field extraction with fallbacks
                    const firstName = prospect.firstName || ''
                    const lastName = prospect.lastName || ''
                    const fullName = prospect.name || `${firstName} ${lastName}`.trim() || 'N/A'
                    
                    // MODIFICATION ICI: Si l'entreprise est vide ou N/A, on met une chaîne vide
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
                        className="cursor-pointer transition-colors hover:bg-slate-800/50"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20">
                              <User className="h-5 w-5 text-blue-400" />
                            </div>
                            <div>
                              <p className="font-semibold text-white">{fullName}</p>
                              {/* Rendu conditionnel : on n'affiche la ligne que si company n'est pas vide */}
                              {company && <p className="text-sm text-slate-400">{company}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(status)}`}>
                            {getStatusName(status)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-300">{formatRelativeTime(lastContact)}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-300">{formatDate(dateAdded)}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                window.location.href = `mailto:${email}`
                              }}
                              className="rounded-lg border border-slate-700 bg-slate-800/50 p-2 text-slate-400 transition-all hover:border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-400"
                              title="Email"
                            >
                              <Mail className="h-4 w-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                console.log('Call:', prospect.phone)
                              }}
                              className="rounded-lg border border-slate-700 bg-slate-800/50 p-2 text-slate-400 transition-all hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-400"
                              title="Appeler"
                            >
                              <Phone className="h-4 w-4" />
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
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SECTION B: Contacts Internes */}
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          {/* Header */}
          <button
            onClick={() => setInternalsExpanded(!internalsExpanded)}
            className="flex w-full items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-4 transition-colors hover:bg-slate-900/50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/20">
                <UserPlus className="h-5 w-5 text-purple-400" />
              </div>
              <div className="text-left">
                <h2 className="text-lg font-bold text-white">Contacts Internes</h2>
                <p className="text-sm text-slate-400">{internalContacts.length} contacts</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsAddContactModalOpen(true)
                }}
                className="flex items-center gap-2 rounded-lg bg-purple-500 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-purple-600"
              >
                <Plus className="h-4 w-4" />
                Nouveau Contact
              </button>
              <ChevronDown
                className={`h-5 w-5 text-slate-400 transition-transform ${internalsExpanded ? 'rotate-180' : ''}`}
              />
            </div>
          </button>

          {/* Content */}
          {internalsExpanded && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950">
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Nom
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Rôle/Poste
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Email
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Téléphone
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {internalContacts.map((contact) => (
                    <tr
                      key={contact.id}
                      onClick={() => setSelectedContact(contact)}
                      className="cursor-pointer transition-colors hover:bg-slate-800/50"
                    >
                      <td className="px-6 py-4">
                        <p className="font-semibold text-white">{contact.name}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-300">{contact.role}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-300">{contact.email}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-300">{contact.phone}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedContact(contact)
                            }}
                            className="rounded-lg border border-slate-700 bg-slate-800/50 p-2 text-slate-400 transition-all hover:border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-400"
                            title="Voir détails"
                          >
                            <Edit2 className="h-4 w-4" />
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
                  ))}
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
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsAddContactModalOpen(false)}
          />

          <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl bg-slate-900 shadow-2xl ring-1 ring-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/20">
                  <UserPlus className="h-5 w-5 text-purple-400" />
                </div>
                <h3 className="text-lg font-bold text-white">Nouveau Contact Interne</h3>
              </div>
            </div>

            <form onSubmit={handleAddContact} className="space-y-4 p-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-400">Nom complet</label>
                <input
                  type="text"
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                  placeholder="Ex: Jean Dupont"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-400">Rôle/Poste</label>
                <input
                  type="text"
                  value={newContact.role}
                  onChange={(e) => setNewContact({ ...newContact, role: e.target.value })}
                  placeholder="Ex: Directeur Commercial"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-400">Email</label>
                <input
                  type="email"
                  value={newContact.email}
                  onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                  placeholder="Ex: jean.dupont@closeros.com"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-400">Téléphone</label>
                <input
                  type="tel"
                  value={newContact.phone}
                  onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                  placeholder="Ex: +33 6 12 34 56 78"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                  required
                />
              </div>

              {/* Offer Selection */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-400">Offre affiliée</label>
                <select
                  value={newContact.linkedOfferId || ''}
                  onChange={(e) =>
                    setNewContact({
                      ...newContact,
                      linkedOfferId: e.target.value || undefined,
                      // Reset billing contact if no offer is selected
                      isBillingContact: e.target.value ? newContact.isBillingContact : false,
                    })
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
                >
                  <option value="">Affilié à aucune offre</option>
                  {offers
                    .filter((offer) => offer.status === 'active')
                    .map((offer) => (
                      <option key={offer.id} value={offer.id.toString()}>
                        {offer.name} ({offer.company})
                      </option>
                    ))}
                </select>
              </div>

              {/* Conditional Billing Contact Toggle */}
              {newContact.linkedOfferId && (
                <div className="space-y-4 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                  <label className="flex cursor-pointer items-start gap-3">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={newContact.isBillingContact}
                        onChange={(e) =>
                          setNewContact({
                            ...newContact,
                            isBillingContact: e.target.checked,
                            // Clear billing fields when unchecking
                            billingAddress: e.target.checked ? newContact.billingAddress : undefined,
                            siret: e.target.checked ? newContact.siret : undefined,
                          })
                        }
                        className="peer sr-only"
                      />
                      <div className="h-6 w-11 rounded-full bg-slate-700 peer-checked:bg-purple-500 peer-focus:ring-2 peer-focus:ring-purple-500/50"></div>
                      <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5"></div>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-white">
                        Les factures seront adressées à cette personne
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        Cette personne recevra les factures de commissions pour cette offre.
                      </div>
                    </div>
                  </label>

                  {/* Conditional Billing Details Fields */}
                  {newContact.isBillingContact && (
                    <div className="space-y-3 border-t border-slate-700 pt-4">
                      {/* Billing Address */}
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-400">
                          Adresse de facturation
                        </label>
                        <textarea
                          value={newContact.billingAddress || ''}
                          onChange={(e) =>
                            setNewContact({ ...newContact, billingAddress: e.target.value })
                          }
                          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                          rows={3}
                          placeholder="Ex: 123 Rue de la République, 75001 Paris, France"
                        />
                      </div>

                      {/* SIRET */}
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-400">
                          Numéro SIRET
                        </label>
                        <input
                          type="text"
                          value={newContact.siret || ''}
                          onChange={(e) => setNewContact({ ...newContact, siret: e.target.value })}
                          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                          placeholder="Ex: 123 456 789 00012"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddContactModalOpen(false)}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-all hover:bg-slate-800"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-purple-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-purple-600"
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
          onCreateEvent={() => {
            console.log('Create event for prospect:', selectedProspect.id)
            // TODO: Open create event modal
          }}
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