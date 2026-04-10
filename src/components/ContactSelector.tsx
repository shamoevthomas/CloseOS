import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { useInternalContacts } from '../contexts/InternalContactsContext'

interface ContactSelectorProps {
  selectedContactIds: number[]
  onAdd: (contactId: number) => void
  onRemove: (contactId: number) => void
}

export function ContactSelector({ selectedContactIds, onAdd, onRemove }: ContactSelectorProps) {
  const { contacts, searchContacts } = useInternalContacts()
  const [searchQuery, setSearchQuery] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

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

  return (
    <div className="space-y-3">
      {/* Selected Contacts */}
      {selectedContacts.length > 0 && (
        <div className="space-y-2">
          {selectedContacts.map((contact) => (
            <div
              key={contact.id}
              className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.03] p-3"
            >
              <div>
                <p className="text-sm font-medium text-white">{contact.name}</p>
                <p className="text-xs text-white/40">{contact.role}</p>
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
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setIsDropdownOpen(true)
            }}
            onFocus={() => setIsDropdownOpen(true)}
            placeholder="Rechercher ou ajouter un contact..."
            className="w-full rounded-lg border border-white/[0.08] bg-white/5 py-2 pl-10 pr-4 text-sm text-white placeholder-white/40 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        {/* Dropdown */}
        {isDropdownOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsDropdownOpen(false)}
            />

            {/* Menu */}
            <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-white/[0.08] bg-white/5 shadow-xl custom-scrollbar">
              {availableContacts.length > 0 ? (
                availableContacts.map((contact) => (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => handleSelectContact(contact.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/10"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10">
                      <span className="text-xs font-bold text-emerald-400">
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
                      <p className="text-xs text-white/40">{contact.role}</p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="px-4 py-3 text-center text-sm text-white/40">
                  Aucun contact trouvé
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}