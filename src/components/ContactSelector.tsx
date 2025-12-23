import { useState } from 'react'
import { Search, Plus, X, UserPlus } from 'lucide-react'
import { useInternalContacts, type InternalContact } from '../contexts/InternalContactsContext'

interface ContactSelectorProps {
  selectedContactIds: number[]
  onAdd: (contactId: number) => void
  onRemove: (contactId: number) => void
}

export function ContactSelector({ selectedContactIds, onAdd, onRemove }: ContactSelectorProps) {
  const { contacts, addContact, searchContacts } = useInternalContacts()
  const [searchQuery, setSearchQuery] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [showQuickCreate, setShowQuickCreate] = useState(false)
  const [newContactName, setNewContactName] = useState('')
  const [newContactRole, setNewContactRole] = useState('')

  // Filter contacts based on search
  const filteredContacts = searchContacts(searchQuery)
  const availableContacts = filteredContacts.filter(
    (contact) => !selectedContactIds.includes(contact.id)
  )

  // Get selected contacts for display
  const selectedContacts = contacts.filter((contact) =>
    selectedContactIds.includes(contact.id)
  )

  const handleSelectContact = (contactId: number) => {
    onAdd(contactId)
    setSearchQuery('')
    setIsDropdownOpen(false)
  }

  const handleQuickCreate = () => {
    if (!newContactName || !newContactRole) {
      alert('Veuillez remplir le nom et le rôle')
      return
    }

    // Create new contact with basic info
    const newContact = addContact({
      name: newContactName,
      role: newContactRole,
      email: `${newContactName.toLowerCase().replace(/\s+/g, '.')}@company.com`,
      phone: '+33 6 00 00 00 00',
      notes: 'Contact créé depuis Offres',
    })

    // Add to selected
    onAdd(newContact.id)

    // Reset form
    setNewContactName('')
    setNewContactRole('')
    setShowQuickCreate(false)
    setIsDropdownOpen(false)
    setSearchQuery('')
  }

  return (
    <div className="space-y-3">
      {/* Selected Contacts */}
      {selectedContacts.length > 0 && (
        <div className="space-y-2">
          {selectedContacts.map((contact) => (
            <div
              key={contact.id}
              className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 p-3"
            >
              <div>
                <p className="text-sm font-medium text-white">{contact.name}</p>
                <p className="text-xs text-slate-500">{contact.role}</p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(contact.id)}
                className="rounded-lg p-1.5 text-red-400 transition-colors hover:bg-red-500/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search/Add Contact */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setIsDropdownOpen(true)
              setShowQuickCreate(false)
            }}
            onFocus={() => setIsDropdownOpen(true)}
            placeholder="Rechercher ou ajouter un contact..."
            className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Dropdown */}
        {isDropdownOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => {
                setIsDropdownOpen(false)
                setShowQuickCreate(false)
              }}
            />

            {/* Menu */}
            <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800 shadow-xl">
              {!showQuickCreate ? (
                <>
                  {availableContacts.length > 0 ? (
                    availableContacts.map((contact) => (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => handleSelectContact(contact.id)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-700"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20">
                          <span className="text-xs font-bold text-blue-400">
                            {contact.name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .toUpperCase()
                              .slice(0, 2)}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white">{contact.name}</p>
                          <p className="text-xs text-slate-500">{contact.role}</p>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-center text-sm text-slate-500">
                      Aucun contact trouvé
                    </div>
                  )}

                  {/* Quick Create Button */}
                  <div className="border-t border-slate-700">
                    <button
                      type="button"
                      onClick={() => {
                        setShowQuickCreate(true)
                        setNewContactName(searchQuery)
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-blue-400 transition-colors hover:bg-slate-700"
                    >
                      <Plus className="h-4 w-4" />
                      Créer un nouveau contact
                    </button>
                  </div>
                </>
              ) : (
                /* Quick Create Form */
                <div className="p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                    <UserPlus className="h-4 w-4" />
                    Nouveau Contact
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs text-slate-400">Nom complet</label>
                      <input
                        type="text"
                        value={newContactName}
                        onChange={(e) => setNewContactName(e.target.value)}
                        placeholder="Ex: Sophie Martin"
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-400">Rôle/Poste</label>
                      <input
                        type="text"
                        value={newContactRole}
                        onChange={(e) => setNewContactRole(e.target.value)}
                        placeholder="Ex: Directeur Marketing"
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={handleQuickCreate}
                        className="flex-1 rounded-lg bg-blue-500 px-3 py-2 text-sm font-semibold text-white transition-all hover:bg-blue-600"
                      >
                        Créer et ajouter
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowQuickCreate(false)
                          setNewContactName('')
                          setNewContactRole('')
                        }}
                        className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-300 transition-all hover:bg-slate-700"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
