import { useState, useEffect } from 'react'
import { X, Mail, Phone, User as UserIcon, Briefcase, Edit2, Trash2, Save } from 'lucide-react'
import { type InternalContact } from '../contexts/InternalContactsContext'
import { useOffers } from '../contexts/OffersContext'

interface InternalContactModalProps {
  contact: InternalContact
  onClose: () => void
  onEdit: (contact: InternalContact) => void
  onDelete: (id: number) => void
}

export function InternalContactModal({ contact, onClose, onEdit, onDelete }: InternalContactModalProps) {
  // Get offers from context
  const { offers } = useOffers()

  // Editing state
  const [isEditing, setIsEditing] = useState(false)
  const [editedContact, setEditedContact] = useState<InternalContact>(contact)

  // Update editedContact when contact prop changes
  useEffect(() => {
    setEditedContact(contact)
  }, [contact])

  // Get initials from name
  const getInitials = (name: string) => {
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  const handleDelete = () => {
    if (confirm(`Êtes-vous sûr de vouloir supprimer ${contact.name} ?`)) {
      onDelete(contact.id)
      onClose()
    }
  }

  const handleSave = () => {
    if (!editedContact.name || !editedContact.role || !editedContact.email || !editedContact.phone) {
      alert('Veuillez remplir tous les champs obligatoires')
      return
    }
    onEdit(editedContact)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditedContact(contact)
    setIsEditing(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal - Business Card Style */}
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto animate-scale-in rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 shadow-2xl ring-1 ring-slate-800">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header - Avatar & Name */}
        <div className="border-b border-slate-800 bg-gradient-to-r from-purple-500/10 to-blue-500/10 p-8 text-center">
          <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-blue-500 text-3xl font-bold text-white shadow-lg">
            {getInitials(contact.name)}
          </div>
          <h2 className="text-2xl font-bold text-white">{contact.name}</h2>
          <div className="mt-2 flex items-center justify-center gap-2">
            <Briefcase className="h-4 w-4 text-purple-400" />
            <p className="text-sm text-purple-300">{contact.role}</p>
          </div>
        </div>

        {/* Body - Contact Info */}
        <div className="p-6">
          <div className="space-y-4">
            {isEditing ? (
              <>
                {/* Editing Mode - Name */}
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Nom complet
                  </label>
                  <input
                    type="text"
                    value={editedContact.name}
                    onChange={(e) => setEditedContact({ ...editedContact, name: e.target.value })}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                    placeholder="Ex: Jean Dupont"
                  />
                </div>

                {/* Editing Mode - Role */}
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Rôle/Poste
                  </label>
                  <input
                    type="text"
                    value={editedContact.role}
                    onChange={(e) => setEditedContact({ ...editedContact, role: e.target.value })}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                    placeholder="Ex: Directeur Commercial"
                  />
                </div>

                {/* Editing Mode - Email */}
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editedContact.email}
                    onChange={(e) => setEditedContact({ ...editedContact, email: e.target.value })}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                    placeholder="Ex: jean@closeros.com"
                  />
                </div>

                {/* Editing Mode - Phone */}
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    value={editedContact.phone}
                    onChange={(e) => setEditedContact({ ...editedContact, phone: e.target.value })}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                    placeholder="Ex: +33 6 12 34 56 78"
                  />
                </div>

                {/* Editing Mode - Notes */}
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Notes (optionnel)
                  </label>
                  <textarea
                    value={editedContact.notes || ''}
                    onChange={(e) => setEditedContact({ ...editedContact, notes: e.target.value })}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                    rows={3}
                    placeholder="Ajouter des notes..."
                  />
                </div>

                {/* Editing Mode - Offer Selection */}
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Offre affiliée
                  </label>
                  <select
                    value={editedContact.linkedOfferId || ''}
                    onChange={(e) =>
                      setEditedContact({
                        ...editedContact,
                        linkedOfferId: e.target.value || undefined,
                        // Reset billing contact if no offer is selected
                        isBillingContact: e.target.value ? editedContact.isBillingContact : false,
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
                {editedContact.linkedOfferId && (
                  <div className="space-y-4 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                    <label className="flex cursor-pointer items-start gap-3">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={editedContact.isBillingContact || false}
                          onChange={(e) =>
                            setEditedContact({
                              ...editedContact,
                              isBillingContact: e.target.checked,
                              // Clear billing fields when unchecking
                              billingAddress: e.target.checked ? editedContact.billingAddress : undefined,
                              siret: e.target.checked ? editedContact.siret : undefined,
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
                    {editedContact.isBillingContact && (
                      <div className="space-y-3 border-t border-slate-700 pt-4">
                        {/* Billing Address */}
                        <div>
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                            Adresse de facturation
                          </label>
                          <textarea
                            value={editedContact.billingAddress || ''}
                            onChange={(e) =>
                              setEditedContact({ ...editedContact, billingAddress: e.target.value })
                            }
                            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                            rows={3}
                            placeholder="Ex: 123 Rue de la République, 75001 Paris, France"
                          />
                        </div>

                        {/* SIRET */}
                        <div>
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                            Numéro SIRET
                          </label>
                          <input
                            type="text"
                            value={editedContact.siret || ''}
                            onChange={(e) =>
                              setEditedContact({ ...editedContact, siret: e.target.value })
                            }
                            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                            placeholder="Ex: 123 456 789 00012"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* View Mode - Email */}
                <div className="group rounded-lg border border-slate-800 bg-slate-900/50 p-4 transition-all hover:border-blue-500/50 hover:bg-slate-800/50">
                  <div className="mb-1 flex items-center gap-2">
                    <Mail className="h-4 w-4 text-slate-500 group-hover:text-blue-400" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Email</span>
                  </div>
                  <a
                    href={`mailto:${contact.email}`}
                    className="block text-sm text-blue-400 hover:underline"
                  >
                    {contact.email}
                  </a>
                </div>

                {/* View Mode - Phone */}
                <div className="group rounded-lg border border-slate-800 bg-slate-900/50 p-4 transition-all hover:border-emerald-500/50 hover:bg-slate-800/50">
                  <div className="mb-1 flex items-center gap-2">
                    <Phone className="h-4 w-4 text-slate-500 group-hover:text-emerald-400" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Téléphone</span>
                  </div>
                  <a
                    href={`tel:${contact.phone}`}
                    className="block text-sm text-slate-300 hover:text-white"
                  >
                    {contact.phone}
                  </a>
                </div>

                {/* View Mode - Notes (if any) */}
                {contact.notes && (
                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Notes</div>
                    <p className="text-sm leading-relaxed text-slate-300">{contact.notes}</p>
                  </div>
                )}

                {/* View Mode - Linked Offer */}
                {contact.linkedOfferId && (
                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Offre affiliée
                    </div>
                    <p className="text-sm text-slate-300">
                      {offers.find((o) => o.id.toString() === contact.linkedOfferId)?.name || 'Offre inconnue'}
                    </p>
                    {contact.isBillingContact && (
                      <>
                        <div className="mt-2 flex items-center gap-2 rounded bg-purple-500/10 px-2 py-1">
                          <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                          <span className="text-xs font-medium text-purple-300">Contact de facturation</span>
                        </div>

                        {/* Billing Details */}
                        {(contact.billingAddress || contact.siret) && (
                          <div className="mt-3 space-y-2 border-t border-slate-700 pt-3">
                            {contact.billingAddress && (
                              <div>
                                <p className="mb-1 text-xs font-semibold text-slate-500">
                                  Adresse de facturation
                                </p>
                                <p className="text-sm leading-relaxed text-slate-300">
                                  {contact.billingAddress}
                                </p>
                              </div>
                            )}
                            {contact.siret && (
                              <div>
                                <p className="mb-1 text-xs font-semibold text-slate-500">SIRET</p>
                                <p className="text-sm text-slate-300">{contact.siret}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer - Actions */}
        <div className="border-t border-slate-800 p-6">
          {isEditing ? (
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-purple-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-purple-600"
              >
                <Save className="h-4 w-4" />
                Sauvegarder
              </button>
              <button
                onClick={handleCancel}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-all hover:bg-slate-700"
              >
                <X className="h-4 w-4" />
                Annuler
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => setIsEditing(true)}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-all hover:bg-slate-700"
              >
                <Edit2 className="h-4 w-4" />
                Modifier
              </button>
              <button
                onClick={handleDelete}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-700/50 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-400 transition-all hover:bg-red-500/20"
              >
                <Trash2 className="h-4 w-4" />
                Supprimer
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }

        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }

        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
