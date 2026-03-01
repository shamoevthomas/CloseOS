import { useState, useEffect } from 'react'
import {
  X,
  Phone,
  Mail,
  Calendar,
  Pencil,
  Trash2,
  ExternalLink,
  MessageSquare,
  FileText,
  Save,
  Tag,
  MessageCircle,
  AlertCircle,
  CreditCard,
  Wallet,
  ClipboardList,
  Clock,
  Plus,
  ChevronDown,
  ChevronRight,
  User
} from 'lucide-react'
import { cn } from '../lib/utils'
import { MaskedText } from '../components/MaskedText'
import { type Prospect } from '../contexts/ProspectsContext'
import { useMeetings } from '../contexts/MeetingsContext'
import { useOffers, type Offer } from '../contexts/OffersContext'

// Helper to parse price
const parsePrice = (priceString: string): number => {
  if (!priceString) return 0
  const cleaned = priceString.toString().replace(/[^\d.,]/g, '')
  const normalized = cleaned.replace(/,/g, '.')
  const withoutSpaces = normalized.replace(/\s/g, '')
  const parsed = parseFloat(withoutSpaces)
  return isNaN(parsed) ? 0 : parsed
}

// Extension du type pour l'affichage local
interface ExtendedProspect extends Prospect {
  callNotes?: {
    id: string
    date: string
    content: string
    author?: string
  }[]
  call_notes?: {
    id: string
    date: string
    content: string
    author?: string
  }[]
  payment_type?: 'cash' | 'installments' | 'comptant'
  installments?: number
  formula_id?: string // ✅ AJOUT : Support de la formule
}

const ALL_STAGES = [
  { id: 'prospect', name: 'Prospect', color: 'bg-blue-500' },
  { id: 'qualified', name: 'Qualifié', color: 'bg-purple-500' },
  { id: 'won', name: 'Gagné', color: 'bg-emerald-500' },
  { id: 'followup', name: 'Follow Up', color: 'bg-orange-500' },
  { id: 'noshow', name: 'No Show', color: 'bg-slate-600' },
  { id: 'lost', name: 'Perdu', color: 'bg-red-500' },
]

interface ProspectViewProps {
  prospect: Prospect
  onClose: () => void
  onUpdate?: (prospectId: number, updates: Partial<ExtendedProspect>) => void
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

  const isExpired = (offer: Offer) => {
    if (!offer.endDate) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const end = new Date(offer.endDate)
    return end < today
  }

  const availableOffers = offers.filter((o) => o.status === 'active' && !isExpired(o))

  const [localProspect, setLocalProspect] = useState<ExtendedProspect>(prospect)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<'info' | 'notes'>('info')

  const [editingOffer, setEditingOffer] = useState(false)
  const [editedOfferId, setEditedOfferId] = useState('')
  const [editedFormulaId, setEditedFormulaId] = useState(prospect.formula_id || '') // ✅ INIT AVEC LA FORMULE
  const [editedOfferName, setEditedOfferName] = useState(prospect.offer || '')
  const [editedValue, setEditedValue] = useState(prospect.value || 0)

  const [editingPayment, setEditingPayment] = useState(false)
  const [paymentMode, setPaymentMode] = useState<'cash' | 'installments'>('cash')
  const [installments, setInstallments] = useState(1)
  const [commissionRate, setCommissionRate] = useState(10)

  // --- LOGIQUE INTELLIGENTE DE DÉTECTION DU PRIX ---
  useEffect(() => {
    const loadedProspect = { ...prospect } as ExtendedProspect

    // Normalisation notes
    if (loadedProspect.call_notes && (!loadedProspect.callNotes || loadedProspect.callNotes.length === 0)) {
      loadedProspect.callNotes = loadedProspect.call_notes
    }

    // ⚡ MAGIE ICI : Si valeur = 0 et qu'on a une formule, on répare tout seul !
    if ((!loadedProspect.value || loadedProspect.value === 0) && loadedProspect.formula_id) {
      const relatedOffer = offers.find(o => o.name === (loadedProspect.offer || '').split(' - ')[0])
      if (relatedOffer && relatedOffer.formulas) {
        const formula = relatedOffer.formulas.find(f => f.id === loadedProspect.formula_id)
        if (formula) {
          // On met à jour l'affichage local immédiatement
          loadedProspect.value = parsePrice(formula.price)
          loadedProspect.offer = `${relatedOffer.name} - ${formula.name}`

          // On prépare aussi les champs d'édition
          setEditedFormulaId(formula.id)
          setEditedValue(parsePrice(formula.price))
          setEditedOfferName(loadedProspect.offer)
        }
      }
    } else {
      setEditedValue(loadedProspect.value || 0)
    }

    setLocalProspect(loadedProspect)
    setTempNotes(prospect.notes || '')
    setEditedFormulaId(loadedProspect.formula_id || '')

    const isInstallments = loadedProspect.payment_type === 'installments' || (loadedProspect.installments && loadedProspect.installments > 1);

    if (isInstallments) {
      setPaymentMode('installments')
      setInstallments(loadedProspect.installments || 1)
    } else {
      setPaymentMode('cash')
      setInstallments(1)
    }

  }, [prospect, offers])
  // --------------------------------------------------

  const [editingNotes, setEditingNotes] = useState(false)
  const [tempNotes, setTempNotes] = useState(prospect.notes || '')

  const [editingClient, setEditingClient] = useState(false)
  const [editedContact, setEditedContact] = useState(prospect.contact)
  const [editedCompany, setEditedCompany] = useState(prospect.company)
  const [editedEmail, setEditedEmail] = useState(prospect.email)
  const [editedPhone, setEditedPhone] = useState(prospect.phone)

  const [isAddingNote, setIsAddingNote] = useState(false)
  const [newNoteContent, setNewNoteContent] = useState('')

  const selectedOfferObj = editedOfferId
    ? availableOffers.find(o => String(o.id) === editedOfferId)
    : availableOffers.find(o => o.name === (localProspect.offer?.split(' - ')[0] || localProspect.offer))

  const hasFormulas = selectedOfferObj?.formulas && selectedOfferObj.formulas.length > 0

  useEffect(() => {
    if (selectedOfferObj) {
      let rate = parsePrice(selectedOfferObj.commission)
      if (hasFormulas && editedFormulaId) {
        const formula = selectedOfferObj.formulas?.find(f => f.id === editedFormulaId)
        if (formula) rate = parsePrice(formula.commission)
      }
      setCommissionRate(rate > 0 ? rate : 10)
    }
  }, [selectedOfferObj, editedFormulaId, hasFormulas])

  const showError = (message: string) => {
    setErrorMessage(message)
    setTimeout(() => setErrorMessage(null), 3000)
  }

  const handleOptimisticUpdate = (updates: Partial<ExtendedProspect>) => {
    setLocalProspect(prev => ({ ...prev, ...updates }))
    const dbUpdates: any = { ...updates }
    if (updates.callNotes) {
      dbUpdates.call_notes = updates.callNotes
    }
    delete dbUpdates.callNotes
    if (onUpdate) {
      onUpdate(prospect.id, dbUpdates)
    }
  }

  const handleSaveNotes = () => {
    handleOptimisticUpdate({ notes: tempNotes })
    setEditingNotes(false)
  }

  const handleAddManualNote = () => {
    if (!newNoteContent.trim()) return
    const newNote = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      content: newNoteContent,
      author: 'Manuel'
    }
    const updatedNotes = [newNote, ...(localProspect.callNotes || [])]
    handleOptimisticUpdate({
      callNotes: updatedNotes
    })
    setNewNoteContent('')
    setIsAddingNote(false)
  }

  const handleDeleteNote = (noteId: string) => {
    if (!confirm("Voulez-vous vraiment supprimer cette note ?")) return
    const updatedNotes = (localProspect.callNotes || []).filter(n => n.id !== noteId)
    handleOptimisticUpdate({
      callNotes: updatedNotes
    })
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

  const handleOfferChange = (offerId: string) => {
    setEditedOfferId(offerId)
    setEditedFormulaId('')
    if (offerId) {
      const selectedOffer = availableOffers.find((o) => String(o.id) === offerId)
      if (selectedOffer) {
        if (selectedOffer.formulas && selectedOffer.formulas.length > 0) {
          setEditedOfferName(selectedOffer.name)
          setEditedValue(0)
        } else {
          setEditedOfferName(selectedOffer.name)
          setEditedValue(parsePrice(selectedOffer.price))
        }
      }
    } else {
      setEditedValue(0)
    }
  }

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
    if (hasFormulas && !editedFormulaId) {
      alert("Veuillez sélectionner une formule pour cette offre.")
      return
    }
    // ✅ SAUVEGARDE DE LA FORMULE ET DU MONTANT
    handleOptimisticUpdate({
      offer: editedOfferName,
      value: editedValue,
      formula_id: editedFormulaId
    })
    setEditingOffer(false)
  }

  const handleCancelOffer = () => {
    setEditedOfferId('')
    setEditedFormulaId(localProspect.formula_id || '')
    setEditedOfferName(localProspect.offer || '')
    setEditedValue(localProspect.value || 0)
    setEditingOffer(false)
  }

  const handleSavePayment = () => {
    handleOptimisticUpdate({
      value: editedValue,
      payment_type: paymentMode,
      installments: paymentMode === 'installments' ? installments : null
    })
    setEditingPayment(false)
  }

  const handleDeleteProspect = () => {
    if (confirm(`Êtes-vous sûr de vouloir supprimer ${localProspect.contact} ?`)) {
      if (onDelete) onDelete(localProspect.id)
      onClose()
    }
  }

  const handleOpenGmail = () => {
    if (localProspect.email) {
      window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${localProspect.email}`, '_blank')
    } else {
      showError("Email manquant !")
    }
  }

  const handleOpenWhatsApp = () => {
    if (localProspect.phone) {
      const cleanPhone = localProspect.phone.replace(/[^0-9+]/g, '')
      window.open(`https://wa.me/${cleanPhone}`, '_blank')
    } else {
      showError("Numéro de téléphone manquant !")
    }
  }

  const monthlyAmount = editedValue / (installments || 1)
  const commissionAmount = (editedValue * commissionRate) / 100

  const savedInstallments = localProspect.installments || 1
  const savedCommission = (localProspect.value || 0) * (commissionRate / 100)
  const savedMonthlyPayment = (localProspect.value || 0) / savedInstallments
  const savedMonthlyCommission = savedCommission / savedInstallments

  const isPayingInInstallments = localProspect.payment_type === 'installments' || (savedInstallments > 1);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-md">
          <div className="flex h-full flex-col bg-slate-900 shadow-xl ring-1 ring-slate-800">

            {errorMessage && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-xl animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="h-4 w-4" />
                {errorMessage}
              </div>
            )}

            {/* Header Fixe */}
            <div className="border-b border-slate-800 bg-slate-950 px-6 pt-6 pb-0">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-white">
                    <MaskedText value={localProspect.contact} type="name" />
                  </h2>
                  {localProspect.company && localProspect.company !== 'N/A' && (
                    <p className="mt-1 text-sm text-slate-400">{localProspect.company}</p>
                  )}
                </div>
                <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex gap-2 mb-6">
                <button onClick={handleOpenGmail} className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm font-medium text-slate-300 transition-all hover:bg-slate-800 hover:text-white">
                  <Mail className="h-4 w-4" /> Email
                </button>
                <button onClick={handleOpenWhatsApp} className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-400 transition-all hover:bg-emerald-500/20 hover:text-emerald-300">
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </button>
                <button onClick={() => { if (onCreateEvent) onCreateEvent() }} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white transition-all hover:bg-blue-500 shadow-lg shadow-blue-500/20">
                  <Calendar className="h-4 w-4" /> RDV
                </button>
              </div>

              {/* TABS */}
              <div className="flex border-b border-slate-800">
                <button
                  onClick={() => setActiveTab('info')}
                  className={cn(
                    "flex-1 pb-3 text-sm font-medium transition-all relative",
                    activeTab === 'info' ? "text-white" : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  Informations
                  {activeTab === 'info' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('notes')}
                  className={cn(
                    "flex-1 pb-3 text-sm font-medium transition-all relative",
                    activeTab === 'notes' ? "text-white" : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  Notes d'Appel
                  {activeTab === 'notes' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />
                  )}
                </button>
              </div>
            </div>

            {/* Content Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* --- ONGLET 1: INFORMATIONS --- */}
              {activeTab === 'info' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">

                  {/* Étape Pipeline */}
                  <div>
                    <label className="mb-2 block text-xs font-medium text-slate-400">Étape actuelle</label>
                    <select
                      value={localProspect.stage}
                      onChange={(e) => handleOptimisticUpdate({ stage: e.target.value })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                    >
                      {ALL_STAGES.map((stage) => (
                        <option key={stage.id} value={stage.id}>{stage.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* SECTION PAIEMENT */}
                  {localProspect.stage === 'won' && (
                    <div className="animate-in slide-in-from-top-4 fade-in duration-300">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="flex items-center gap-2 text-sm font-bold text-emerald-400">
                          <CreditCard className="h-4 w-4" /> Détails du Paiement
                        </h3>
                        <button onClick={() => setEditingPayment(!editingPayment)} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {editingPayment ? (
                        <div className="space-y-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                          <div>
                            <label className="text-xs text-slate-400">Montant final (€)</label>
                            <input
                              type="number"
                              value={editedValue}
                              onChange={(e) => setEditedValue(parseFloat(e.target.value) || 0)}
                              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-bold text-white focus:border-emerald-500 focus:outline-none"
                            />
                          </div>
                          <div className="flex rounded-lg bg-slate-900 p-1">
                            <button type="button" onClick={() => { setPaymentMode('cash'); setInstallments(1); }} className={cn("flex-1 rounded-md py-1.5 text-xs font-medium transition-all", paymentMode === 'cash' ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:text-white")}>Comptant</button>
                            <button type="button" onClick={() => setPaymentMode('installments')} className={cn("flex-1 rounded-md py-1.5 text-xs font-medium transition-all", paymentMode === 'installments' ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:text-white")}>Plusieurs fois</button>
                          </div>
                          {paymentMode === 'installments' && (
                            <div className="animate-in fade-in slide-in-from-top-1">
                              <label className="text-xs text-slate-400">Nombre de mensualités</label>
                              <select value={installments} onChange={(e) => setInstallments(parseInt(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none">
                                {[2, 3, 4, 5, 6, 10, 12].map(n => <option key={n} value={n}>{n} fois ({(editedValue / n).toFixed(2)}€/mois)</option>)}
                              </select>
                            </div>
                          )}
                          <div className="rounded-lg bg-emerald-500/10 p-3 border border-emerald-500/20">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-emerald-400 flex items-center gap-1"><Wallet className="h-3 w-3" /> Ta Commission ({commissionRate}%)</span>
                              <span className="text-lg font-bold text-emerald-400">{commissionAmount.toFixed(2)}€</span>
                            </div>
                            {paymentMode === 'installments' && (
                              <p className="mt-1 text-[10px] text-emerald-300/70">
                                Tu recevras : {(commissionAmount / installments).toFixed(2)}€ / mois
                              </p>
                            )}
                          </div>
                          <button onClick={handleSavePayment} className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-bold text-white hover:bg-emerald-500">Valider les détails</button>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-slate-400">Montant Vente</span>
                            <span className="text-sm font-bold text-white">{(localProspect.value || 0).toLocaleString()}€</span>
                          </div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-slate-400">Commission Totale ({commissionRate}%)</span>
                            <span className="text-sm font-bold text-emerald-400">+{savedCommission.toFixed(2)}€</span>
                          </div>

                          {isPayingInInstallments && (
                            <div className="mt-3 pt-3 border-t border-emerald-500/20 space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-300">Client paie (x{savedInstallments}) :</span>
                                <span className="text-sm font-semibold text-white">{savedMonthlyPayment.toFixed(2)}€ / mois</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-emerald-400/80">Tu reçois :</span>
                                <span className="text-sm font-bold text-emerald-400">{savedMonthlyCommission.toFixed(2)}€ / mois</span>
                              </div>
                            </div>
                          )}

                          <div className="pt-2 border-t border-emerald-500/20 text-center mt-2">
                            <span className="text-[10px] font-medium text-emerald-300/60 uppercase tracking-wider">
                              {isPayingInInstallments ? `Paiement en ${savedInstallments} fois` : 'Paiement Comptant'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Infos Offre */}
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">Infos Offre</h3>
                      <button onClick={() => setEditingOffer(!editingOffer)} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
                        <Pencil className="h-3.5 w-3.5" />
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
                        {hasFormulas && (
                          <div className="animate-in fade-in slide-in-from-top-2">
                            <label className="mb-2 flex items-center gap-2 text-xs text-blue-400">
                              <Tag className="h-3 w-3" /> Choix de la formule
                            </label>
                            <select
                              value={editedFormulaId}
                              onChange={(e) => handleFormulaChange(e.target.value)}
                              className="w-full rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                            >
                              <option value="">-- Sélectionner la formule --</option>
                              {selectedOfferObj?.formulas?.map((formula) => (
                                <option key={formula.id} value={formula.id}>{formula.name} - {formula.price}€</option>
                              ))}
                            </select>
                          </div>
                        )}
                        {editedValue > 0 && <p className="text-xs font-medium text-emerald-400 text-right">Nouveau montant : {editedValue.toLocaleString()}€</p>}
                        <div className="flex gap-2">
                          <button onClick={handleSaveOffer} className="flex-1 rounded-lg bg-blue-500 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-600">Sauvegarder</button>
                          <button onClick={handleCancelOffer} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-700">Annuler</button>
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
                            <p className="mt-1 text-lg font-bold text-blue-400"><MaskedText value={`${(localProspect.value || 0).toLocaleString()}€`} type="number" /></p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Fiche Client */}
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">Fiche Client</h3>
                      <button onClick={() => setEditingClient(!editingClient)} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {editingClient ? (
                      <div className="space-y-3">
                        <input type="text" value={editedContact} onChange={(e) => setEditedContact(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" placeholder="Nom" />
                        <input type="text" value={editedCompany} onChange={(e) => setEditedCompany(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" placeholder="Entreprise" />
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
                            <button onClick={handleOpenGmail} className="truncate text-sm text-slate-300 hover:text-white hover:underline text-left"><MaskedText value={localProspect.email} type="name" /></button>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-800/50 p-3">
                          <Phone className="h-4 w-4 text-emerald-400" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-slate-500">Téléphone</p>
                            <button onClick={handleOpenWhatsApp} className="text-sm text-slate-300 hover:text-white hover:underline text-left"><MaskedText value={localProspect.phone} type="name" /></button>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-800/50 p-3">
                          <Clock className="h-4 w-4 text-purple-400" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-slate-500">Date de création</p>
                            <p className="text-sm text-slate-300">
                              {new Date(localProspect.created_at || localProspect.dateAdded || '').toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Notes Internes (Générales) */}
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">Notes Internes</h3>
                      <button onClick={() => setEditingNotes(!editingNotes)} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {editingNotes ? (
                      <div>
                        <textarea value={tempNotes} onChange={(e) => setTempNotes(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none" rows={4} />
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
              )}

              {/* --- ONGLET 2: NOTES D'APPEL (Page Dédiée) --- */}
              {activeTab === 'notes' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">

                  {/* BOUTON AJOUTER NOTE */}
                  {!isAddingNote ? (
                    <button
                      onClick={() => setIsAddingNote(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-700 bg-slate-800/30 py-3 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white hover:border-slate-600 transition-all"
                    >
                      <Plus className="h-4 w-4" /> Ajouter une note manuelle
                    </button>
                  ) : (
                    <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 shadow-lg animate-in fade-in zoom-in-95">
                      <h4 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Nouvelle Note</h4>
                      <textarea
                        value={newNoteContent}
                        onChange={(e) => setNewNoteContent(e.target.value)}
                        placeholder="Écrivez votre note d'appel ici..."
                        className="w-full rounded-lg bg-slate-900 border border-slate-700 p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 min-h-[100px] mb-3"
                        autoFocus
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => { setIsAddingNote(false); setNewNoteContent(''); }}
                          className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
                        >
                          Annuler
                        </button>
                        <button
                          onClick={handleAddManualNote}
                          disabled={!newNoteContent.trim()}
                          className="px-4 py-2 rounded-lg bg-purple-600 text-sm font-bold text-white hover:bg-purple-500 disabled:opacity-50 transition-all shadow-lg shadow-purple-900/20"
                        >
                          Enregistrer
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="h-px bg-slate-800 my-4" />

                  {/* LISTE DES NOTES */}
                  <div className="space-y-3">
                    {localProspect.callNotes && localProspect.callNotes.length > 0 ? (
                      localProspect.callNotes.map((note) => (
                        <details key={note.id} className="group rounded-xl border border-slate-800 bg-slate-900/50 open:bg-slate-900 transition-all overflow-hidden">
                          <summary className="flex cursor-pointer items-center justify-between p-4 hover:bg-slate-800/50 transition-colors select-none list-none [&::-webkit-details-marker]:hidden">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-400 group-open:bg-purple-500/20 group-open:text-purple-400 transition-colors">
                                <Calendar className="h-4 w-4" />
                              </div>
                              <div>
                                <h4 className="text-sm font-semibold text-white">
                                  {new Date(note.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                </h4>
                                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                                  <Clock className="h-3 w-3" />
                                  <span>{new Date(note.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                                  {note.author && (
                                    <>
                                      <span>•</span>
                                      <span className="uppercase tracking-wider">{note.author}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={(e) => {
                                  e.preventDefault()
                                  handleDeleteNote(note.id)
                                }}
                                className="rounded p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                                title="Supprimer la note"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                              <ChevronDown className="h-5 w-5 text-slate-500 transition-transform duration-300 group-open:rotate-180" />
                            </div>
                          </summary>

                          <div className="border-t border-slate-800 p-4 pt-2">
                            <div className="prose prose-invert prose-sm max-w-none">
                              <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                                {note.content}
                              </p>
                            </div>
                          </div>
                        </details>
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 mb-3">
                          <ClipboardList className="h-6 w-6 text-slate-500" />
                        </div>
                        <p className="text-sm font-medium text-slate-400">Aucune note d'appel</p>
                        <p className="text-xs text-slate-500 mt-1 max-w-[200px]">
                          L'historique de vos appels et vos notes manuelles apparaîtront ici.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="border-t border-slate-800 bg-slate-950 p-6">
              <button onClick={handleDeleteProspect} className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-400 transition-all hover:bg-red-500/20">
                <Trash2 className="h-4 w-4" /> Supprimer le prospect
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}