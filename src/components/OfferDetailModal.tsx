import { useState, useEffect } from 'react'
import {
  X,
  Edit2,
  Euro,
  Percent,
  Calendar,
  Users,
  ExternalLink,
  FileText,
  Save,
  Trash2,
  Plus,
  User,
  Building2,
} from 'lucide-react'
import { ContactSelector } from './ContactSelector'
import { useInternalContacts, type InternalContact } from '../contexts/InternalContactsContext'

export interface OfferContact {
  id: number
  name: string
  role: string
}

export interface OfferResource {
  id: number
  name: string
  url: string
  type: 'script' | 'payment' | 'drive' | 'other'
}

export interface Offer {
  id: number
  name: string
  company: string
  status: 'active' | 'archived'
  target: 'B2B' | 'B2C'
  startDate: string
  endDate?: string
  price: string
  commission: string
  description: string
  resources: OfferResource[]
  contacts: OfferContact[]
  notes?: string
}

interface OfferDetailModalProps {
  offer: Offer
  onClose: () => void
  onUpdate: (updatedOffer: Offer) => void
  onDelete?: (id: number) => void
}

// Helper function to extract numbers from strings
const parseNumber = (value: string): number => {
  // Remove all non-numeric characters except dots and commas
  const cleaned = value.replace(/[^\d.,]/g, '')
  // Replace commas with dots for decimal parsing
  const normalized = cleaned.replace(/,/g, '.')
  // Remove spaces
  const withoutSpaces = normalized.replace(/\s/g, '')
  const parsed = parseFloat(withoutSpaces)
  return isNaN(parsed) ? 0 : parsed
}

// Helper function to calculate commission amount
const calculateCommission = (price: string, commission: string): number => {
  const priceNum = parseNumber(price)
  const commissionNum = parseNumber(commission)
  return (priceNum * commissionNum) / 100
}

export function OfferDetailModal({ offer, onClose, onUpdate, onDelete }: OfferDetailModalProps) {
  const { contacts: globalContacts } = useInternalContacts()
  const [isEditing, setIsEditing] = useState(false)
  const [editedOffer, setEditedOffer] = useState<Offer>(offer)

  // State for new resource inputs
  const [tempResName, setTempResName] = useState('')
  const [tempResLink, setTempResLink] = useState('')

  // Update edited offer when prop changes (e.g., after save)
  useEffect(() => {
    setEditedOffer(offer)
  }, [offer])

  // Calculate commission amount (updates in real-time when price or commission changes)
  const commissionAmount = calculateCommission(
    isEditing ? editedOffer.price : offer.price,
    isEditing ? editedOffer.commission : offer.commission
  )

  const handleSave = () => {
    onUpdate(editedOffer)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditedOffer(offer)
    setIsEditing(false)
  }

  const handleDelete = () => {
    if (confirm(`Êtes-vous sûr de vouloir supprimer l'offre "${offer.name}" ?`)) {
      if (onDelete) {
        onDelete(offer.id)
      }
      onClose()
    }
  }

  const handleAddResource = () => {
    if (!tempResName.trim() || !tempResLink.trim()) {
      alert('Veuillez remplir le nom et le lien de la ressource')
      return
    }

    const newResource: OfferResource = {
      id: Date.now(), // Simple unique ID
      name: tempResName.trim(),
      url: tempResLink.trim(),
      type: 'other' // Default type, can be changed later
    }

    setEditedOffer({
      ...editedOffer,
      resources: [...editedOffer.resources, newResource]
    })

    // Clear inputs
    setTempResName('')
    setTempResLink('')
  }

  const handleRemoveResource = (resourceId: number) => {
    setEditedOffer({
      ...editedOffer,
      resources: editedOffer.resources.filter(r => r.id !== resourceId)
    })
  }

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'script':
        return <FileText className="h-4 w-4 text-blue-400" />
      case 'payment':
        return <Euro className="h-4 w-4 text-emerald-400" />
      case 'drive':
        return <ExternalLink className="h-4 w-4 text-purple-400" />
      default:
        return <ExternalLink className="h-4 w-4 text-slate-400" />
    }
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    } catch {
      return dateString
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 shadow-2xl ring-1 ring-slate-800">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950 px-6 py-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                {isEditing ? (
                  <input
                    type="text"
                    value={editedOffer.name}
                    onChange={(e) =>
                      setEditedOffer({ ...editedOffer, name: e.target.value })
                    }
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xl font-bold text-white focus:border-blue-500 focus:outline-none"
                  />
                ) : (
                  <h2 className="text-2xl font-bold text-white">{offer.name}</h2>
                )}
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    offer.status === 'active'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-slate-500/10 text-slate-400'
                  }`}
                >
                  {offer.status === 'active' ? 'Active' : 'Archivée'}
                </span>
              </div>
              {isEditing ? (
                <input
                  type="text"
                  value={editedOffer.company}
                  onChange={(e) =>
                    setEditedOffer({ ...editedOffer, company: e.target.value })
                  }
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-sm text-slate-400 focus:border-blue-500 focus:outline-none"
                />
              ) : (
                <p className="mt-1 text-sm text-slate-400">{offer.company}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <button
                    onClick={handleSave}
                    className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-blue-600"
                  >
                    <Save className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleCancel}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-300 transition-all hover:bg-slate-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  {onDelete && (
                    <button
                      onClick={handleDelete}
                      className="rounded-lg p-2 text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </>
              )}
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Target Type Toggle */}
          <div className="mb-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Type de cible
            </p>
            {isEditing ? (
              <div className="flex gap-2">
                <button
                  onClick={() => setEditedOffer({ ...editedOffer, target: 'B2C' })}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-all ${
                    editedOffer.target === 'B2C'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  <User className="h-4 w-4" />
                  B2C (Particuliers)
                </button>
                <button
                  onClick={() => setEditedOffer({ ...editedOffer, target: 'B2B' })}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-all ${
                    editedOffer.target === 'B2B'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  <Building2 className="h-4 w-4" />
                  B2B (Entreprises)
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3">
                {offer.target === 'B2C' ? (
                  <>
                    <User className="h-4 w-4 text-blue-400" />
                    <span className="text-sm font-medium text-white">B2C (Particuliers)</span>
                  </>
                ) : (
                  <>
                    <Building2 className="h-4 w-4 text-blue-400" />
                    <span className="text-sm font-medium text-white">B2B (Entreprises)</span>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Zone A - Financials */}
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
                <Euro className="h-4 w-4" />
                Tarification
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-slate-500">Prix de l'offre</p>
                  {isEditing ? (
                    <div className="relative mt-1">
                      <input
                        type="number"
                        value={editedOffer.price}
                        onChange={(e) =>
                          setEditedOffer({ ...editedOffer, price: e.target.value })
                        }
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 pr-8 text-lg font-bold text-emerald-400 focus:border-blue-500 focus:outline-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-lg font-bold text-emerald-400">
                        €
                      </span>
                    </div>
                  ) : (
                    <p className="text-lg font-bold text-emerald-400">{offer.price}€</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-slate-500">Commission</p>
                  {isEditing ? (
                    <div>
                      <div className="relative mt-1">
                        <input
                          type="number"
                          value={editedOffer.commission}
                          onChange={(e) =>
                            setEditedOffer({ ...editedOffer, commission: e.target.value })
                          }
                          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 pr-8 text-lg font-bold text-blue-400 focus:border-blue-500 focus:outline-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-lg font-bold text-blue-400">
                          %
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        = {commissionAmount.toLocaleString('fr-FR')}€ par vente
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-lg font-bold text-blue-400">{offer.commission}%</p>
                      <p className="mt-1 text-xs text-slate-500">
                        = {commissionAmount.toLocaleString('fr-FR')}€ par vente
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Zone B - Context (Dates) */}
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
                <Calendar className="h-4 w-4" />
                Période
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-slate-500">Date de début</p>
                  {isEditing ? (
                    <input
                      type="date"
                      value={editedOffer.startDate}
                      onChange={(e) =>
                        setEditedOffer({ ...editedOffer, startDate: e.target.value })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 focus:border-blue-500 focus:outline-none"
                    />
                  ) : (
                    <p className="text-sm text-slate-300">{formatDate(offer.startDate)}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-slate-500">Date de fin</p>
                  {isEditing ? (
                    <input
                      type="date"
                      value={editedOffer.endDate || ''}
                      onChange={(e) =>
                        setEditedOffer({ ...editedOffer, endDate: e.target.value || undefined })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 focus:border-blue-500 focus:outline-none"
                    />
                  ) : (
                    <p className="text-sm text-slate-300">
                      {offer.endDate ? formatDate(offer.endDate) : 'Non définie'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950 p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Description
            </h3>
            {isEditing ? (
              <textarea
                value={editedOffer.description}
                onChange={(e) =>
                  setEditedOffer({ ...editedOffer, description: e.target.value })
                }
                rows={3}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 focus:border-blue-500 focus:outline-none"
              />
            ) : (
              <p className="text-sm leading-relaxed text-slate-300">{offer.description}</p>
            )}
          </div>

          {/* Zone C - Contacts Rattachés */}
          <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950 p-4">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
              <Users className="h-4 w-4" />
              Contacts Rattachés
            </h3>
            {isEditing ? (
              <ContactSelector
                selectedContactIds={editedOffer.contacts.map((c) => c.id)}
                onAdd={(contactId) => {
                  // Find contact from global list and add to offer
                  const globalContact = globalContacts.find((c) => c.id === contactId)
                  if (globalContact) {
                    setEditedOffer({
                      ...editedOffer,
                      contacts: [
                        ...editedOffer.contacts,
                        { id: globalContact.id, name: globalContact.name, role: globalContact.role },
                      ],
                    })
                  }
                }}
                onRemove={(contactId) => {
                  setEditedOffer({
                    ...editedOffer,
                    contacts: editedOffer.contacts.filter((c) => c.id !== contactId),
                  })
                }}
              />
            ) : (
              <div className="space-y-2">
                {offer.contacts.length > 0 ? (
                  offer.contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 p-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-white">{contact.name}</p>
                        <p className="text-xs text-slate-500">{contact.role}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">Aucun contact rattaché</p>
                )}
              </div>
            )}
          </div>

          {/* Zone D - Resources */}
          <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950 p-4">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
              <ExternalLink className="h-4 w-4" />
              Ressources
            </h3>

            {isEditing ? (
              <div className="space-y-4">
                {/* List of existing resources (editable) */}
                <div className="space-y-2">
                  {editedOffer.resources.length > 0 ? (
                    editedOffer.resources.map((resource) => (
                      <div
                        key={resource.id}
                        className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3"
                      >
                        {getResourceIcon(resource.type)}
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-300">{resource.name}</p>
                          <a
                            href={resource.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-400 hover:underline"
                          >
                            {resource.url}
                          </a>
                        </div>
                        <button
                          onClick={() => handleRemoveResource(resource.id)}
                          className="rounded p-1.5 text-red-400 transition-colors hover:bg-red-400/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">Aucune ressource disponible</p>
                  )}
                </div>

                {/* Form to add new resource */}
                <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-900/30 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Ajouter une ressource
                  </p>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Nom de la ressource (ex: Script de vente)"
                      value={tempResName}
                      onChange={(e) => setTempResName(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                    />
                    <input
                      type="url"
                      placeholder="Lien URL (ex: https://...)"
                      value={tempResLink}
                      onChange={(e) => setTempResLink(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                    />
                    <button
                      onClick={handleAddResource}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-500 px-3 py-2 text-sm font-semibold text-white transition-all hover:bg-blue-600"
                    >
                      <Plus className="h-4 w-4" />
                      Ajouter
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {offer.resources.length > 0 ? (
                  offer.resources.map((resource) => (
                    <a
                      key={resource.id}
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3 transition-all hover:border-blue-500/50 hover:bg-slate-800/50"
                    >
                      {getResourceIcon(resource.type)}
                      <span className="flex-1 text-sm font-medium text-slate-300">
                        {resource.name}
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                    </a>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">Aucune ressource disponible</p>
                )}
              </div>
            )}
          </div>

          {/* Zone E - Notes */}
          <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950 p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Notes de Closing
            </h3>
            {isEditing ? (
              <textarea
                value={editedOffer.notes || ''}
                onChange={(e) =>
                  setEditedOffer({ ...editedOffer, notes: e.target.value })
                }
                rows={4}
                placeholder="Instructions spécifiques pour closer cette offre..."
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 placeholder-slate-600 focus:border-blue-500 focus:outline-none"
              />
            ) : (
              <p className="text-sm leading-relaxed text-slate-300">
                {offer.notes || 'Aucune note'}
              </p>
            )}
          </div>
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

        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>
    </div>
  )
}
