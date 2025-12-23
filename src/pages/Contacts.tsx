import { useState } from 'react'
import { ChevronDown, Plus, User, Phone, Mail, Edit2, Trash2, UserPlus, X } from 'lucide-react'
import { useProspects, type Prospect } from '../contexts/ProspectsContext'
import { useInternalContacts, type InternalContact } from '../contexts/InternalContactsContext'
import { useOffers } from '../contexts/OffersContext'
import { ProspectView } from '../components/ProspectView'
import { InternalContactModal } from '../components/InternalContactModal'
import { CreateProspectModal } from '../components/CreateProspectModal'

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

  // Form state pour nouveau contact
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

  // Handlers
  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation simple
    if (!newContact.name || !newContact.email) {
      alert('Le nom et l\'email sont obligatoires')
      return
    }

    try {
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
    } catch (err) {
      console.error(err)
      alert("Erreur lors de l'ajout du contact")
    }
  }

  const handleCreateProspect = async (prospectData: any) => {
    try {
      // On force l'ajout vers Supabase sans passer par le check "isConnected" qui peut bugger
      await addProspect({
        ...prospectData,
        title: `${prospectData.offer || 'Offre'} - ${prospectData.company || 'Sans entreprise'}`,
        probability: 40,
        dateAdded: new Date(),
        lastContact: new Date(),
      })
      setIsNewProspectModalOpen(false)
    } catch (err) {
      console.error(err)
      alert("Erreur Supabase : Vérifiez que la table prospects est bien configurée")
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'prospect': 'bg-blue-500/10 text-blue-400',
      'qualified': 'bg-purple-500/10 text-purple-400',
      'won': 'bg-emerald-500/10 text-emerald-400',
      'lost': 'bg-rose-500/10 text-rose-400',
    }
    return colors[status] || 'bg-slate-500/10 text-slate-400'
  }

  return (
    <div className="h-full overflow-auto bg-slate-950 p-8 text-slate-100 text-left">
      <div className="mx-auto max-w-7xl space-y-6">
        
        {/* SECTION: Mes Prospects */}
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          <div className="flex w-full items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20">
                <User className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Mes Prospects</h2>
                <p className="text-sm text-slate-400">{prospects.length} contacts</p>
              </div>
            </div>
            <button
              onClick={() => setIsNewProspectModalOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 transition-all"
            >
              <Plus className="h-4 w-4" /> Nouveau Prospect
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-950/50">
                <tr className="text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
                  <th className="px-6 py-4 text-left">Nom & Entreprise</th>
                  <th className="px-6 py-4 text-left">Statut</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {prospects.map((prospect) => (
                  <tr key={prospect.id} onClick={() => setSelectedProspect(prospect)} className="cursor-pointer hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-white">{prospect.contact || prospect.name}</p>
                      <p className="text-sm text-slate-400">{prospect.company}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(prospect.stage || 'prospect')}`}>
                        {prospect.stage || 'Prospect'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                       <button className="p-2 text-slate-400 hover:text-white"><Mail className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION: Contacts Internes */}
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          <div className="flex w-full items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/20">
                <UserPlus className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Contacts Internes</h2>
                <p className="text-sm text-slate-400">{internalContacts.length} contacts</p>
              </div>
            </div>
            <button
              onClick={() => setIsAddContactModalOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-purple-500 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-600 transition-all"
            >
              <Plus className="h-4 w-4" /> Nouveau Contact
            </button>
          </div>

          <div className="p-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {internalContacts.map((contact) => (
              <div key={contact.id} onClick={() => setSelectedContact(contact)} className="p-4 rounded-xl border border-slate-800 bg-slate-800/30 hover:bg-slate-800/50 cursor-pointer transition-all">
                <p className="font-bold text-white">{contact.name}</p>
                <p className="text-sm text-slate-500">{contact.role}</p>
                <div className="mt-4 flex gap-2">
                  <Mail className="h-4 w-4 text-slate-600" />
                  <span className="text-xs text-slate-400">{contact.email}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modale Nouveau Contact */}
      {isAddContactModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl w-full max-w-md shadow-2xl">
            <h3 className="text-2xl font-bold text-white mb-6">Nouveau Contact Interne</h3>
            <form onSubmit={handleAddContact} className="space-y-4">
              <input
                type="text"
                placeholder="Nom complet"
                value={newContact.name}
                onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                className="w-full rounded-xl bg-slate-800 border border-slate-700 p-3 text-white focus:outline-none focus:border-purple-500"
              />
              <input
                type="email"
                placeholder="Email"
                value={newContact.email}
                onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                className="w-full rounded-xl bg-slate-800 border border-slate-700 p-3 text-white focus:outline-none focus:border-purple-500"
              />
              <input
                type="text"
                placeholder="Rôle / Poste"
                value={newContact.role}
                onChange={(e) => setNewContact({ ...newContact, role: e.target.value })}
                className="w-full rounded-xl bg-slate-800 border border-slate-700 p-3 text-white focus:outline-none focus:border-purple-500"
              />
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setIsAddContactModalOpen(false)} className="flex-1 py-3 rounded-xl bg-slate-800 text-white font-bold">Annuler</button>
                <button type="submit" className="flex-1 py-3 rounded-xl bg-purple-600 text-white font-bold">Ajouter</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale Nouveau Prospect */}
      <CreateProspectModal
        isOpen={isNewProspectModalOpen}
        onClose={() => setIsNewProspectModalOpen(false)}
        onSubmit={handleCreateProspect}
      />

      {/* Détails Prospect */}
      {selectedProspect && (
        <ProspectView
          prospect={selectedProspect}
          onClose={() => setSelectedProspect(null)}
          onUpdate={(id, updates) => updateProspect(id, updates)}
          onDelete={(id) => {
            deleteProspect(id)
            setSelectedProspect(null)
          }}
        />
      )}
    </div>
  )
}