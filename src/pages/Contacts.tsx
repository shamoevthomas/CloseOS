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
  const { prospects, addProspect, deleteProspect, updateProspect } = useProspects()
  const { contacts: internalContacts, addContact, deleteContact, updateContact } = useInternalContacts()
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
      'prospect': 'bg-blue-500/10 text-blue-400',
      'qualified': 'bg-purple-500/10 text-purple-400',
      'won': 'bg-emerald-500/10 text-emerald-400',
      'lost': 'bg-rose-500/10 text-rose-400',
    }
    return colors[status] || 'bg-slate-500/10 text-slate-400'
  }

  const getStatusName = (status: string) => {
    const names: Record<string, string> = {
      'prospect': 'Prospect',
      'qualified': 'Qualifié',
      'won': 'Gagné',
      'lost': 'Perdu',
    }
    return names[status] || status
  }

  // --- LOGIQUE DE CRÉATION CORRIGÉE ---

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault()
    // On garde ta validation d'origine
    if (!newContact.name || !newContact.role || !newContact.email || !newContact.phone) {
      alert('Veuillez remplir tous les champs')
      return
    }

    try {
      // Appel direct au contexte (Supabase)
      await addContact(newContact)
      setNewContact({
        name: '', role: '', email: '', phone: '',
        linkedOfferId: undefined, isBillingContact: false,
        billingAddress: undefined, siret: undefined
      })
      setIsAddContactModalOpen(false)
    } catch (err) {
      alert("Erreur lors de l'ajout du contact")
    }
  }

  const handleCreateProspect = async (prospectData: any) => {
    try {
      // Suppression du bloc "isConnected" qui bloquait l'ajout
      await addProspect({
        ...prospectData,
        title: `${prospectData.offer} - ${prospectData.company}`,
        probability: 40,
        dateAdded: new Date(),
        lastContact: new Date(),
      })
      setIsNewProspectModalOpen(false)
    } catch (err) {
      alert("Erreur lors de la création du prospect")
    }
  }

  // --- FIN DES CORRECTIONS LOGIQUES ---

  const formatDate = (date: any) => {
    if (!date) return 'N/A'
    const d = new Date(date)
    return d.toLocaleDateString('fr-FR')
  }

  const formatRelativeTime = (date: any) => {
    if (!date) return 'Jamais'
    return "Récemment" 
  }

  return (
    <div className="h-full overflow-auto bg-slate-950 p-8 text-slate-100 text-left">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* SECTION A: Mes Prospects */}
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
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
                <p className="text-sm text-slate-400">{prospects.length} contacts</p>
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
              <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform ${prospectsExpanded ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {prospectsExpanded && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950">
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase text-slate-400">Nom & Entreprise</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase text-slate-400">Statut</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase text-slate-400">Dernier Contact</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold uppercase text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {prospects.map((prospect) => (
                    <tr key={prospect.id} onClick={() => setSelectedProspect(prospect)} className="cursor-pointer transition-colors hover:bg-slate-800/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20">
                            <User className="h-5 w-5 text-blue-400" />
                          </div>
                          <div>
                            <p className="font-semibold text-white">{prospect.contact || prospect.name}</p>
                            <p className="text-sm text-slate-400">{prospect.company}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(prospect.stage || 'prospect')}`}>
                          {getStatusName(prospect.stage || 'prospect')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-300">{formatRelativeTime(prospect.lastContact)}</p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Mail className="h-4 w-4 text-slate-400 mx-auto" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SECTION B: Contacts Internes */}
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
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
              <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform ${internalsExpanded ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {internalsExpanded && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950">
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase text-slate-400">Nom</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase text-slate-400">Rôle</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase text-slate-400">Email</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold uppercase text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {internalContacts.map((contact) => (
                    <tr key={contact.id} onClick={() => setSelectedContact(contact)} className="cursor-pointer hover:bg-slate-800/50">
                      <td className="px-6 py-4 font-semibold text-white">{contact.name}</td>
                      <td className="px-6 py-4 text-slate-300">{contact.role}</td>
                      <td className="px-6 py-4 text-slate-300">{contact.email}</td>
                      <td className="px-6 py-4 text-center">
                        <Edit2 className="h-4 w-4 text-slate-400 mx-auto" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MODALES D'ORIGINE */}
      {isAddContactModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-xl bg-slate-900 p-6 shadow-2xl border border-slate-800">
            <h3 className="text-lg font-bold text-white mb-6">Nouveau Contact Interne</h3>
            <form onSubmit={handleAddContact} className="space-y-4">
              <input type="text" placeholder="Nom" value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} className="w-full rounded-lg bg-slate-800 border border-slate-700 p-2.5 text-white" />
              <input type="text" placeholder="Rôle" value={newContact.role} onChange={(e) => setNewContact({ ...newContact, role: e.target.value })} className="w-full rounded-lg bg-slate-800 border border-slate-700 p-2.5 text-white" />
              <input type="email" placeholder="Email" value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} className="w-full rounded-lg bg-slate-800 border border-slate-700 p-2.5 text-white" />
              <input type="tel" placeholder="Téléphone" value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} className="w-full rounded-lg bg-slate-800 border border-slate-700 p-2.5 text-white" />
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setIsAddContactModalOpen(false)} className="flex-1 py-2 rounded-lg bg-slate-800 text-white">Annuler</button>
                <button type="submit" className="flex-1 py-2 rounded-lg bg-purple-600 text-white">Ajouter</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <CreateProspectModal isOpen={isNewProspectModalOpen} onClose={() => setIsNewProspectModalOpen(false)} onSubmit={handleCreateProspect} />
      {selectedProspect && <ProspectView prospect={selectedProspect} onClose={() => setSelectedProspect(null)} onUpdate={(id, updates) => updateProspect(id, updates)} onDelete={(id) => { deleteProspect(id); setSelectedProspect(null); }} />}
      {selectedContact && <InternalContactModal contact={selectedContact} onClose={() => setSelectedContact(null)} onEdit={(u) => updateContact(u.id, u)} onDelete={(id) => deleteContact(id)} />}
    </div>
  )
}