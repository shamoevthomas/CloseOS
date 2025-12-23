import { useState } from 'react'
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
} from 'lucide-react'
import { cn } from '../lib/utils'
import { MaskedText } from '../components/MaskedText'
import { type Prospect } from '../contexts/ProspectsContext'
import { useMeetings } from '../contexts/MeetingsContext'
import { useOffers } from '../contexts/OffersContext'

// Helper to parse price from string like "2 500€" to number 2500
const parsePrice = (priceString: string): number => {
  const cleaned = priceString.replace(/[^\d.,]/g, '')
  const normalized = cleaned.replace(/,/g, '.')
  const withoutSpaces = normalized.replace(/\s/g, '')
  const parsed = parseFloat(withoutSpaces)
  return isNaN(parsed) ? 0 : parsed
}

const ALL_STAGES = [
  { id: 'prospect', name: 'Prospect', color: 'bg-blue-500' },
  { id: 'qualified', name: 'Qualifié', color: 'bg-purple-500' },
  { id: 'won', name: 'Gagné', color: 'bg-emerald-500' },
  { id: 'followup', name: 'Follow Up', color: 'bg-orange-500' },
  { id: 'noshow', name: 'No Show', color: 'bg-slate-600' },
  { id: 'lost', name: 'Perdu', color: 'bg-red-500' },
]

type PanelTab = 'informations' | 'transcription'

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
  const { meetings, getNextMeeting } = useMeetings()
  const { offers } = useOffers()
  const activeOffers = offers.filter((o) => o.status === 'active')

  const [panelTab, setPanelTab] = useState<PanelTab>('informations')
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
  const [editedOfferName, setEditedOfferName] = useState(prospect.offer || '')
  const [editedValue, setEditedValue] = useState(prospect.value || 0)

  const handleUpdateProspect = (updates: Partial<Prospect>) => {
    if (onUpdate) {
      onUpdate(prospect.id, updates)
    }
  }

  const handleSaveNotes = () => {
    handleUpdateProspect({ notes: tempNotes })
    setEditingNotes(false)
  }

  const handleSaveClient = () => {
    // Parse name into firstName and lastName
    const nameParts = editedContact.trim().split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''

    handleUpdateProspect({
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
    setEditedContact(prospect.contact)
    setEditedCompany(prospect.company)
    setEditedEmail(prospect.email)
    setEditedPhone(prospect.phone)
    setEditingClient(false)
  }

  const handleOfferChange = (offerId: string) => {
    setEditedOfferId(offerId)
    if (offerId) {
      const selectedOffer = activeOffers.find((o) => String(o.id) === offerId)
      if (selectedOffer) {
        setEditedOfferName(selectedOffer.name)
        setEditedValue(parsePrice(selectedOffer.price))
      }
    }
  }

  const handleSaveOffer = () => {
    handleUpdateProspect({
      offer: editedOfferName,
      value: editedValue,
    })
    setEditingOffer(false)
  }

  const handleCancelOffer = () => {
    setEditedOfferId('')
    setEditedOfferName(prospect.offer || '')
    setEditedValue(prospect.value || 0)
    setEditingOffer(false)
  }

  const handleDeleteProspect = () => {
    if (confirm(`Êtes-vous sûr de vouloir supprimer ${prospect.contact} ?`)) {
      if (onDelete) {
        onDelete(prospect.id)
      }
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-md">
          <div className="flex h-full flex-col overflow-y-auto bg-slate-900 shadow-xl ring-1 ring-slate-800">
            {/* Header */}
            <div className="border-b border-slate-800 bg-slate-950 px-6 py-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-white">
                    <MaskedText value={prospect.contact} type="name" />
                  </h2>
                  {prospect.company && prospect.company !== 'N/A' && (
                    <p className="mt-1 text-sm text-slate-400">{prospect.company}</p>
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
                  onClick={() => (window.location.href = `mailto:${prospect.email}`)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm font-medium text-slate-300 transition-all hover:bg-slate-800"
                >
                  <Mail className="h-4 w-4" />
                  Email
                </button>
                <button
                  onClick={() => {
                    if (onCreateEvent) onCreateEvent()
                  }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm font-medium text-slate-300 transition-all hover:bg-slate-800"
                >
                  <Calendar className="h-4 w-4" />
                  RDV
                </button>
              </div>

              {/* Stage Selector */}
              <div className="mt-4">
                <label className="mb-2 block text-xs font-medium text-slate-400">
                  Étape actuelle
                </label>
                <select
                  value={prospect.stage}
                  onChange={(e) => {
                    const newStage = e.target.value
                    handleUpdateProspect({ stage: newStage })
                  }}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                >
                  {ALL_STAGES.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Internal Tabs */}
              <div className="mt-4 flex gap-1 border-b border-slate-800">
                <button
                  onClick={() => setPanelTab('informations')}
                  className={cn(
                    'px-4 py-2 text-sm font-semibold transition-all',
                    panelTab === 'informations'
                      ? 'border-b-2 border-blue-500 text-blue-400'
                      : 'text-slate-400 hover:text-slate-300'
                  )}
                >
                  Informations
                </button>
                <button
                  onClick={() => setPanelTab('transcription')}
                  className={cn(
                    'px-4 py-2 text-sm font-semibold transition-all',
                    panelTab === 'transcription'
                      ? 'border-b-2 border-blue-500 text-blue-400'
                      : 'text-slate-400 hover:text-slate-300'
                  )}
                >
                  Transcription
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 space-y-6 p-6">
              {panelTab === 'informations' ? (
                <>
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
                            {activeOffers.map((offer) => (
                              <option key={offer.id} value={offer.id}>
                                {offer.name} ({offer.price})
                              </option>
                            ))}
                          </select>
                        </div>
                        {editedValue > 0 && (
                          <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
                            <p className="text-xs text-slate-400">Valeur automatique</p>
                            <p className="text-lg font-bold text-blue-400">
                              {editedValue.toLocaleString('fr-FR')} €
                            </p>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveOffer}
                            className="flex-1 rounded-lg bg-blue-500 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-600"
                          >
                            <Save className="mr-1 inline h-3.5 w-3.5" />
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
                            <p className="mt-1 font-medium text-white">
                              {prospect.offer || 'N/A'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-slate-400">Montant</p>
                            <p className="mt-1 text-lg font-bold text-blue-400">
                              <MaskedText
                                value={`${(prospect.value || 0).toLocaleString()}€`}
                                type="number"
                              />
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
                        <div>
                          <label className="mb-1 block text-xs text-slate-400">Nom complet</label>
                          <input
                            type="text"
                            value={editedContact}
                            onChange={(e) => setEditedContact(e.target.value)}
                            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-400">Entreprise</label>
                          <input
                            type="text"
                            value={editedCompany}
                            onChange={(e) => setEditedCompany(e.target.value)}
                            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-400">Email</label>
                          <input
                            type="email"
                            value={editedEmail}
                            onChange={(e) => setEditedEmail(e.target.value)}
                            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-400">Téléphone</label>
                          <input
                            type="tel"
                            value={editedPhone}
                            onChange={(e) => setEditedPhone(e.target.value)}
                            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={handleSaveClient}
                            className="flex-1 rounded-lg bg-blue-500 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-600"
                          >
                            <Save className="mr-1 inline h-3.5 w-3.5" />
                            Sauvegarder
                          </button>
                          <button
                            onClick={handleCancelClient}
                            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-700"
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Email */}
                        <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-800/50 p-3">
                          <Mail className="h-4 w-4 text-blue-400" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-slate-500">Email</p>
                            <p className="truncate text-sm text-slate-300">
                              <MaskedText value={prospect.email} type="name" />
                            </p>
                          </div>
                        </div>

                        {/* Phone */}
                        <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-800/50 p-3">
                          <Phone className="h-4 w-4 text-emerald-400" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-slate-500">Téléphone</p>
                            <p className="text-sm text-slate-300">
                              <MaskedText value={prospect.phone} type="name" />
                            </p>
                          </div>
                        </div>

                        {/* Source */}
                        <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-800/50 p-3">
                          <ExternalLink className="h-4 w-4 text-purple-400" />
                          <div className="flex-1">
                            <p className="text-xs text-slate-500">Source d'acquisition</p>
                            <p className="text-sm text-slate-300">
                              {prospect.source || 'N/A'}
                            </p>
                          </div>
                        </div>

                        {/* Questionnaire */}
                        {prospect.questionnaire && (
                          <div className="rounded-lg border border-slate-800 bg-slate-800/50 p-4">
                            <p className="mb-3 text-xs font-semibold text-slate-400">
                              Réponses au questionnaire
                            </p>
                            <div className="space-y-2">
                              <div>
                                <p className="text-xs text-slate-500">Budget</p>
                                <p className="text-sm text-slate-300">
                                  {prospect.questionnaire.budget || 'N/A'}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">Timeline</p>
                                <p className="text-sm text-slate-300">
                                  {prospect.questionnaire.timeline || 'N/A'}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">Décideur</p>
                                <p className="text-sm text-slate-300">
                                  {prospect.questionnaire.decision || 'N/A'}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Dernière Interaction */}
                  {prospect.lastInteraction && (
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-white">
                          Dernière Interaction
                        </h3>
                        <button className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="rounded-lg border border-slate-800 bg-slate-800/50 p-4">
                        <div className="flex items-start gap-3">
                          <MessageSquare className="h-4 w-4 text-orange-400" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-medium uppercase text-slate-400">
                                {prospect.lastInteraction.type}
                              </p>
                              <p className="text-xs text-slate-500">
                                {prospect.lastInteraction.date}
                              </p>
                            </div>
                            <p className="mt-2 text-sm text-slate-300">
                              {prospect.lastInteraction.summary}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Notes Internes */}
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">Notes Internes</h3>
                      <button
                        onClick={() => setEditingNotes(!editingNotes)}
                        className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {editingNotes ? (
                      <div>
                        <textarea
                          value={tempNotes}
                          onChange={(e) => setTempNotes(e.target.value)}
                          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                          rows={4}
                          placeholder="Ajouter des notes internes..."
                        />
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={handleSaveNotes}
                            className="rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-600"
                          >
                            Enregistrer
                          </button>
                          <button
                            onClick={() => {
                              setEditingNotes(false)
                              setTempNotes(prospect.notes || '')
                            }}
                            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-700"
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-slate-800 bg-slate-800/50 p-4">
                        <p className="whitespace-pre-wrap text-sm text-slate-300">
                          {prospect.notes || 'Aucune note'}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Transcription Tab */}
                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <FileText className="h-5 w-5 text-blue-400" />
                      <h3 className="text-sm font-semibold text-white">
                        Transcription de l'appel
                      </h3>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-800/50 p-4">
                      <div className="space-y-3">
                        {(prospect.transcript || 'Aucune transcription disponible')
                          .split('\n')
                          .map((line, index) => {
                            const isCloser = line.startsWith('Closer:')
                            const isProspect = !isCloser && line.includes(':')
                            return (
                              <div
                                key={index}
                                className={cn(
                                  'rounded-lg p-3',
                                  isCloser
                                    ? 'border-l-2 border-blue-500 bg-blue-500/10'
                                    : isProspect
                                    ? 'border-l-2 border-slate-600 bg-slate-700/30'
                                    : ''
                                )}
                              >
                                <p className="whitespace-pre-wrap text-sm text-slate-300">
                                  {line}
                                </p>
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  </div>
                </>
              )}
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
