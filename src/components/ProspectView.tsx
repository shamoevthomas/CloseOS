import { useState, useEffect } from 'react'
import {
  X,
  Phone,
  Mail,
  Calendar,
  Edit2,
  Trash2,
  ExternalLink,
  MessageSquare,
  FileText,
  Save,
  Tag, // Ajout de l'icône Tag
} from 'lucide-react'
import { cn } from '../lib/utils'
import { MaskedText } from '../components/MaskedText'
import { type Prospect } from '../contexts/ProspectsContext'
import { useMeetings } from '../contexts/MeetingsContext'
import { useOffers, type Offer } from '../contexts/OffersContext' // Import type Offer

// Helper to parse price from string like "2 500€" to number 2500
const parsePrice = (priceString: string): number => {
  if (!priceString) return 0
  const cleaned = priceString.toString().replace(/[^\d.,]/g, '')
  const normalized = cleaned.replace(/,/g, '.')
  const withoutSpaces = normalized.replace(/\s/g, '')
  const parsed = parseFloat(withoutSpaces)
  return isNaN(parsed) ? 0 : parsed
}

const ALL_STAGES = [
  { id: 'prospect', name: 'Prospect', color: 'bg-blue-500' },
  { id: 'qualified', name: 'Qualifié', color: 'bg-purple-500' },
  { id: 'won', name: 'Gagné', color: 'bg-emerald-500' },
  { id: 'followup', name: 'Follow Up', color: 'bg-orange-500' }, // Follow Up déplacé
  { id: 'noshow', name: 'No Show', color: 'bg-slate-600' },
  { id: 'lost', name: 'Perdu', color: 'bg-red-500' },
]

interface ProspectViewProps {
  prospect: Prospect
  onClose: () => void
  onUpdate?: (prospectId: number, updates: Partial<Prospect>) => void
  onDelete?: (prospectId: number) => void
  onCreateEvent?: () => void
  onStartCall?: (withAi: boolean) => void
  onPhoneCall?: () => void
}

export function ProspectView({
  prospect,
  onClose,
  onUpdate,
  onDelete,
  onCreateEvent,
  onStartCall,
  onPhoneCall,
}: ProspectViewProps) {
  const { offers } = useOffers()

  // 1. LOGIQUE DE FILTRAGE (Offres actives ET non expirées)
  const isExpired = (offer: Offer) => {
    if (!offer.endDate) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const end = new Date(offer.endDate)
    return end < today
  }

  // Liste filtrée des offres disponibles
  const availableOffers = offers.filter((o) => o.status === 'active' && !isExpired(o))

  // --- OPTIMISTIC UI : État local pour affichage instantané ---
  const [localProspect, setLocalProspect] = useState(prospect)

  // Synchronisation si le prospect change depuis l'extérieur
  useEffect(() => {
    setLocalProspect(prospect)
    setTempNotes(prospect.notes || '')
  }, [prospect])

  const [editingNotes, setEditingNotes] = useState(false)
  const [tempNotes, setTempNotes] = useState(prospect.notes || '')

  // Edit mode for client info
  const [editingClient, setEditingClient] = useState(false)
  const [editedContact, setEditedContact] = useState(prospect.contact)
  const [editedCompany, setEditedCompany] = useState(prospect.company)
  const [editedEmail, setEditedEmail] = useState(prospect.email)
  const [editedPhone, setEditedPhone] = useState(prospect.phone)

  // Edit mode for offer
  const [editingOffer, setEditingOffer] = useState(false)
  const [editedOfferId, setEditedOfferId] = useState('')
  const [editedFormulaId, setEditedFormulaId] = useState('') // Pour la formule
  const [editedOfferName, setEditedOfferName] = useState(prospect.offer || '')
  const [editedValue, setEditedValue] = useState(prospect.value || 0)

  // Objet offre sélectionné en cours d'édition
  const selectedOfferObj = editedOfferId 
    ? availableOffers.find(o => String(o.id) === editedOfferId)
    : null
  
  const hasFormulas = selectedOfferObj?.formulas && selectedOfferObj.formulas.length > 0

  // Fonction unifiée pour mise à jour optimiste
  const handleOptimisticUpdate = (updates: Partial<Prospect>) => {
    // 1. Mise à jour visuelle immédiate
    setLocalProspect(prev => ({ ...prev, ...updates }))
    
    // 2. Envoi au serveur (arrière-plan)
    if (onUpdate) {
      onUpdate(prospect.id, updates)
    }
  }

  const handleSaveNotes = () => {
    handleOptimisticUpdate({ notes: tempNotes })
    setEditingNotes(false)
  }

  const handleSaveClient = () => {
    const nameParts = editedContact.trim().split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''

    handleOptimisticUpdate({
      contact: editedContact,
      firstName,
      lastName,
      company: editedCompany,
      email: editedEmail,
      phone: editedPhone,
    })
    setEditingClient(false)
  }

  const handleCancelClient = () => {
    setEditedContact(localProspect.contact)
    setEditedCompany(localProspect.company)
    setEditedEmail(localProspect.email)
    setEditedPhone(localProspect.phone)
    setEditingClient(false)
  }

  // Changement d'offre principal
  const handleOfferChange = (offerId: string) => {
    setEditedOfferId(offerId)
    setEditedFormulaId('') // Reset formula

    if (offerId) {
      const selectedOffer = availableOffers.find((o) => String(o.id) === offerId)
      if (selectedOffer) {
        // Si formules, on force la sélection (prix 0 par défaut)
        if (selectedOffer.formulas && selectedOffer.formulas.length > 0) {
          setEditedOfferName(selectedOffer.name) // Nom temporaire sans formule
          setEditedValue(0)
        } else {
          // Sinon prix standard
          setEditedOfferName(selectedOffer.name)
          setEditedValue(parsePrice(selectedOffer.price))
        }
      }
    } else {
      setEditedValue(0)
    }
  }

  // Changement de formule
  const handleFormulaChange = (formulaId: string) => {
    setEditedFormulaId(formulaId)
    if (selectedOfferObj && selectedOfferObj.formulas) {
      const formula = selectedOfferObj.formulas.find(f => f.id === formulaId)
      if (formula) {
        setEditedOfferName(`${selectedOfferObj.name} - ${formula.name}`)
        setEditedValue(parsePrice(formula.price))
      }
    }
  }

  const handleSaveOffer = () => {
    // Validation si formule requise
    if (hasFormulas && !editedFormulaId) {
      alert("Veuillez sélectionner une formule pour cette offre.")
      return
    }

    handleOptimisticUpdate({
      offer: editedOfferName,
      value: editedValue,
    })
    setEditingOffer(false)
  }

  const handleCancelOffer = () => {
    setEditedOfferId('')
    setEditedFormulaId('')
    setEditedOfferName(localProspect.offer || '')
    setEditedValue(localProspect.value || 0)
    setEditingOffer(false)
  }

  const handleDeleteProspect = () => {
    if (confirm(`Êtes-vous sûr de vouloir supprimer ${localProspect.contact} ?`)) {
      if (onDelete) {
        onDelete(localProspect.id)
      }
      onClose()
    }
  }

  // Fonction pour ouvrir Gmail
  const handleOpenGmail = () => {
    if (localProspect.email) {
      window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${localProspect.email}`, '_blank')
    } else {
      alert("Aucune adresse email renseignée pour ce prospect.")
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-md">
          <div className="flex h-full flex-col overflow-y-auto bg-slate-900 shadow-xl ring-1 ring-slate-800">
            {/* Header */}
            <div className="border-b border-slate-800 bg-slate-950 px-6 py-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-white">
                    <MaskedText value={localProspect.contact} type="name" />
                  </h2>
                  {localProspect.company && localProspect.company !== 'N/A' && (
                    <p className="mt-1 text-sm text-slate-400">{localProspect.company}</p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Quick Actions */}
              <div className="mt-4 flex gap-2">
                <button
                  onClick={handleOpenGmail}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm font-medium text-slate-300 transition-all hover:bg-slate-800 hover:text-white"
                >
                  <Mail className="h-4 w-4" />
                  Email
                </button>
                <button
                  onClick={() => {
                    if (onCreateEvent) onCreateEvent()
                  }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white transition-all hover:bg-blue-500 shadow-lg shadow-blue-500/20"
                >
                  <Calendar className="h-4 w-4" />
                  RDV
                </button>
              </div>

              {/* Stage Selector (INSTANTANÉ) */}
              <div className="mt-4">
                <label className="mb-2 block text-xs font-medium text-slate-400">
                  Étape actuelle
                </label>
                <select
                  value={localProspect.stage}
                  onChange={(e) => handleOptimisticUpdate({ stage: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                >
                  {ALL_STAGES.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Content - Informations Only */}
            <div className="flex-1 space-y-6 p-6">
                {/* Infos Offre */}
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">Infos Offre</h3>
                    <button
                      onClick={() => setEditingOffer(!editingOffer)}
                      className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {editingOffer ? (
                    <div className="space-y-3">
                      <div>
                        <label className="mb-2 block text-xs text-slate-400">Sélectionner une offre</label>
                        <select
                          value={editedOfferId}
                          onChange={(e) => handleOfferChange(e.target.value)}
                          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                        >
                          <option value="">-- Sélectionner --</option>
                          {availableOffers.map((offer) => (
                            <option key={offer.id} value={offer.id}>
                              {offer.name} {offer.formulas && offer.formulas.length > 0 ? '(Multi-formules)' : `(${offer.price})`}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* SÉLECTEUR FORMULE (Conditionnel) */}
                      {hasFormulas && (
                        <div className="animate-in fade-in slide-in-from-top-2">
                          <label className="mb-2 flex items-center gap-2 text-xs text-blue-400">
                            <Tag className="h-3 w-3" />
                            Choix de la formule
                          </label>
                          <select
                            value={editedFormulaId}
                            onChange={(e) => handleFormulaChange(e.target.value)}
                            className="w-full rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                          >
                            <option value="">-- Sélectionner la formule --</option>
                            {selectedOfferObj?.formulas?.map((formula) => (
                              <option key={formula.id} value={formula.id}>
                                {formula.name} - {formula.price}€
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Prix auto */}
                      {editedValue > 0 && (
                        <p className="text-xs font-medium text-emerald-400 text-right">
                          Nouveau montant : {editedValue.toLocaleString()}€
                        </p>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveOffer}
                          className="flex-1 rounded-lg bg-blue-500 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-600"
                        >
                          Sauvegarder
                        </button>
                        <button
                          onClick={handleCancelOffer}
                          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-700"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-slate-800 bg-slate-800/50 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-slate-400">Offre concernée</p>
                          <p className="mt-1 font-medium text-white">{localProspect.offer || 'N/A'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-slate-400">Montant</p>
                          <p className="mt-1 text-lg font-bold text-blue-400">
                            <MaskedText value={`${(localProspect.value || 0).toLocaleString()}€`} type="number" />
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Fiche Client */}
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">Fiche Client</h3>
                    <button
                      onClick={() => setEditingClient(!editingClient)}
                      className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {editingClient ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editedContact}
                        onChange={(e) => setEditedContact(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                        placeholder="Nom"
                      />
                      <input
                        type="text"
                        value={editedCompany}
                        onChange={(e) => setEditedCompany(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                        placeholder="Entreprise"
                      />
                      <div className="flex gap-2">
                        <button onClick={handleSaveClient} className="flex-1 rounded-lg bg-blue-500 px-3 py-2 text-sm font-semibold text-white">Sauvegarder</button>
                        <button onClick={handleCancelClient} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-300">Annuler</button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-800/50 p-3">
                        <Mail className="h-4 w-4 text-blue-400" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-slate-500">Email</p>
                          <button onClick={handleOpenGmail} className="truncate text-sm text-slate-300 hover:text-white hover:underline text-left">
                            <MaskedText value={localProspect.email} type="name" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-800/50 p-3">
                        <Phone className="h-4 w-4 text-emerald-400" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-slate-500">Téléphone</p>
                          <p className="text-sm text-slate-300"><MaskedText value={localProspect.phone} type="name" /></p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Notes Internes (INSTANTANÉ) */}
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">Notes Internes</h3>
                    <button onClick={() => setEditingNotes(!editingNotes)} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {editingNotes ? (
                    <div>
                      <textarea
                        value={tempNotes}
                        onChange={(e) => setTempNotes(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none"
                        rows={4}
                      />
                      <div className="mt-2 flex gap-2">
                        <button onClick={handleSaveNotes} className="rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-medium text-white">Enregistrer</button>
                        <button onClick={() => setEditingNotes(false)} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-300">Annuler</button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-slate-800 bg-slate-800/50 p-4">
                      <p className="whitespace-pre-wrap text-sm text-slate-300">{localProspect.notes || 'Aucune note'}</p>
                    </div>
                  )}
                </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-800 bg-slate-950 p-6">
              <button
                onClick={handleDeleteProspect}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-400 transition-all hover:bg-red-500/20"
              >
                <Trash2 className="h-4 w-4" />
                Supprimer le prospect
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}