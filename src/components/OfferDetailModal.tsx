import React, { useState, useEffect, useMemo, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Building2,
  Calendar,
  Check,
  Copy,
  ExternalLink,
  Info,
  Link,
  Plus,
  Save,
  Tag,
  Trash2,
  User,
  X,
  FileText,
  Database,
  ChevronDown,
  BoxSelect,
  Briefcase,
  Users,
  UserPlus,
  Receipt
} from 'lucide-react'
import { ContactSelector } from './ContactSelector'
import { useInternalContacts } from '../contexts/InternalContactsContext'

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

export interface OfferFormula {
  id: string
  name: string
  price: string
  commission: string
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
  formulas?: OfferFormula[]
  notes?: string
  // CHAMPS DE FACTURATION
  billingName?: string
  billingAddress?: string
  billingCity?: string
  billingZip?: string
  billingCountry?: string
  siret?: string
  billingEmail?: string
  billingPhone?: string
  // NOUVEAUX CHAMPS CRM
  crmProvider?: 'iclosed' | 'hubspot' | 'other'
  crmApiKey?: string
  crmMapping?: { [key: string]: string | undefined }
  defaultFormulaId?: string // NOUVEAU CHAMP : ID de la formule par défaut
}

interface OfferDetailModalProps {
  offer: Offer
  onClose: () => void
  onUpdate: (updatedOffer: Offer) => void
  onDelete?: (id: number) => void
}

// Helper function to extract numbers from strings
const parseNumber = (value: string): number => {
  const cleaned = value.replace(/[^\d.,]/g, '')
  const normalized = cleaned.replace(/,/g, '.')
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
  const { contacts: globalContacts, addContact } = useInternalContacts()

  const [isEditing, setIsEditing] = useState(false)

  const [isCreatingContact, setIsCreatingContact] = useState(false)
  const [newContactData, setNewContactData] = useState({ name: '', role: '', email: '', phone: '' })

  // État pour le feedback de copie
  const [hasCopied, setHasCopied] = useState(false)

  const [editedOffer, setEditedOffer] = useState<Offer>(() => {
    if (!offer.formulas || offer.formulas.length === 0) {
      return {
        ...offer,
        formulas: [{
          id: Date.now().toString(),
          name: 'Standard',
          price: offer.price,
          commission: offer.commission
        }]
      }
    }
    return offer
  })

  // --- CALCUL DE L'URL WEBHOOK INTELLIGENTE ---
  const baseUrl = window.location.origin.includes('localhost')
    ? 'https://closeos.fr'
    : window.location.origin

  // On ajoute &formula_id=XYZ si une formule par défaut est sélectionnée
  const webhookUrl = `${baseUrl}/api/webhook?offer_id=${offer.id}${editedOffer.defaultFormulaId ? `&formula_id=${editedOffer.defaultFormulaId}` : ''}`

  const [tempResName, setTempResName] = useState('')
  const [tempResLink, setTempResLink] = useState('')

  useEffect(() => {
    setEditedOffer(offer)
  }, [offer])

  const handleSave = () => {
    const mainFormula = editedOffer.formulas && editedOffer.formulas.length > 0
      ? editedOffer.formulas[0]
      : { price: '0', commission: '0' }

    const finalOffer = {
      ...editedOffer,
      price: mainFormula.price,
      commission: mainFormula.commission
    }

    onUpdate(finalOffer)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditedOffer(offer)
    setIsEditing(false)
    setIsCreatingContact(false)
  }

  const handleDelete = () => {
    if (confirm(`Êtes-vous sûr de vouloir supprimer l'offre "${offer.name}" ?`)) {
      if (onDelete) {
        onDelete(offer.id)
      }
      onClose()
    }
  }

  const handleCreateAndAttachContact = async () => {
    if (!newContactData.name || !newContactData.email) {
      alert("Le nom et l'email sont requis.")
      return
    }

    try {
      const result = await addContact(newContactData)
      const createdId = result?.data?.[0]?.id || Date.now()

      const contactToAdd: OfferContact = {
        id: createdId,
        name: newContactData.name,
        role: newContactData.role
      }

      setEditedOffer(prev => ({
        ...prev,
        contacts: [...prev.contacts, contactToAdd]
      }))

      setNewContactData({ name: '', role: '', email: '', phone: '' })
      setIsCreatingContact(false)

    } catch (error) {
      console.error("Erreur création contact", error)
      alert("Impossible de créer le contact.")
    }
  }

  // --- GESTION DU COPIER WEBHOOK ---
  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl)
    setHasCopied(true)
    setTimeout(() => setHasCopied(false), 2000)
  }

  // --- GESTION DES FORMULES ---
  const handleAddFormula = () => {
    const newFormula: OfferFormula = {
      id: Date.now().toString(),
      name: `Formule ${editedOffer.formulas?.length ? editedOffer.formulas.length + 1 : 1}`,
      price: '0',
      commission: '10'
    }
    setEditedOffer({
      ...editedOffer,
      formulas: [...(editedOffer.formulas || []), newFormula]
    })
  }

  const handleUpdateFormula = (id: string, field: keyof OfferFormula, value: string) => {
    setEditedOffer({
      ...editedOffer,
      formulas: editedOffer.formulas?.map(f =>
        f.id === id ? { ...f, [field]: value } : f
      )
    })
  }

  const handleRemoveFormula = (id: string) => {
    if ((editedOffer.formulas?.length || 0) <= 1) {
      alert("Il faut au moins une formule.")
      return
    }
    setEditedOffer({
      ...editedOffer,
      formulas: editedOffer.formulas?.filter(f => f.id !== id)
    })
  }

  const handleAddResource = () => {
    if (!tempResName.trim() || !tempResLink.trim()) {
      alert('Veuillez remplir le nom et le lien de la ressource')
      return
    }

    const newResource: OfferResource = {
      id: Date.now(),
      name: tempResName.trim(),
      url: tempResLink.trim(),
      type: 'other'
    }

    setEditedOffer({
      ...editedOffer,
      resources: [...editedOffer.resources, newResource]
    })

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

      {/* Modal Container */}
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-[32px] bg-[#020617] shadow-[0_0_50px_rgba(0,0,0,0.5)] ring-1 ring-white/10 custom-scrollbar animate-in fade-in zoom-in duration-300">

        {/* Decorative background blobs */}
        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-blue-600/10 opacity-20 blur-[80px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-purple-600/10 opacity-10 blur-[80px] rounded-full pointer-events-none" />
        {/* Header Section */}
        <div className="sticky top-0 z-10 border-b border-white/5 bg-[#020617]/80 backdrop-blur-md px-8 py-8">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-4">
                {isEditing ? (
                  <input
                    type="text"
                    value={editedOffer.name}
                    onChange={(e) =>
                      setEditedOffer({ ...editedOffer, name: e.target.value })
                    }
                    className="flex-1 rounded-xl border border-white/10 bg-slate-900/50 px-4 py-2 text-xl font-black text-white focus:border-blue-500/50 focus:outline-none transition-all"
                  />
                ) : (
                  <h2 className="text-3xl font-black text-white tracking-tight">{offer.name}</h2>
                )}
                <span
                  className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${offer.status === 'active'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
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
                  className="mt-3 w-full rounded-xl border border-white/10 bg-slate-900/50 px-4 py-1.5 text-sm text-slate-400 focus:border-blue-500/50 focus:outline-none transition-all"
                />
              ) : (
                <p className="mt-2 text-sm font-medium text-slate-400 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-slate-500" />
                  {offer.company}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {isEditing ? (
                <>
                  <button
                    onClick={handleSave}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-500 active:scale-95"
                    title="Sauvegarder"
                  >
                    <Save className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleCancel}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition-all hover:bg-white/10 active:scale-95"
                    title="Annuler"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-slate-400 transition-all hover:bg-white/10 hover:text-white"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  {onDelete && (
                    <button
                      onClick={handleDelete}
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 transition-all hover:bg-rose-500/20 hover:text-rose-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </>
              )}
              <div className="h-6 w-px bg-white/10 mx-1" />
              <button
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-slate-400 transition-all hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Target Type Toggle */}
          <div className="mb-10 relative z-10">
            <p className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
              Cible Marketing
            </p>
            {isEditing ? (
              <div className="flex gap-4">
                <button
                  onClick={() => setEditedOffer({ ...editedOffer, target: 'B2C' })}
                  className={`flex flex-1 items-center justify-center gap-3 rounded-2xl px-6 py-4 text-sm font-bold transition-all ${editedOffer.target === 'B2C'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                    : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                    }`}
                >
                  <User className="h-5 w-5" />
                  B2C (Particuliers)
                </button>
                <button
                  onClick={() => setEditedOffer({ ...editedOffer, target: 'B2B' })}
                  className={`flex flex-1 items-center justify-center gap-3 rounded-2xl px-6 py-4 text-sm font-bold transition-all ${editedOffer.target === 'B2B'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                    : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                    }`}
                >
                  <Building2 className="h-5 w-5" />
                  B2B (Entreprises)
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-[20px] border border-white/5 bg-slate-900/30 px-6 py-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {offer.target === 'B2C' ? <User className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
                </div>
                <div>
                  <span className="text-base font-bold text-white">
                    {offer.target === 'B2C' ? 'B2C (Particuliers)' : 'B2B (Entreprises)'}
                  </span>
                  <p className="text-xs text-slate-500 font-medium tracking-wide">Configuration du pipeline adaptée</p>
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-8 md:grid-cols-2 relative z-10">
            {/* Zone A - Formules (Multi-Tarification) */}
            <div className="rounded-3xl border border-white/5 bg-slate-900/30 p-6 backdrop-blur-md">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  <Tag className="h-3.5 w-3.5" /> Formules & Tarifs
                </h3>
                {isEditing && (
                  <button
                    onClick={handleAddFormula}
                    className="flex items-center gap-1.5 rounded-full bg-blue-600/10 px-3 py-1.5 text-[10px] font-black text-blue-400 hover:bg-blue-600/20 border border-blue-500/20 transition-all active:scale-95 uppercase tracking-widest"
                  >
                    <Plus className="h-3 w-3" /> Ajouter
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {(editedOffer.formulas || []).map((formula, index) => {
                  const comm = calculateCommission(formula.price, formula.commission)
                  return (
                    <div key={formula.id} className="relative rounded-2xl border border-white/5 bg-white/5 p-4 transition-all hover:border-white/10 group/formula">
                      {isEditing ? (
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <input
                              type="text"
                              value={formula.name}
                              onChange={(e) => handleUpdateFormula(formula.id, 'name', e.target.value)}
                              placeholder="Nom (ex: Pack Gold)"
                              className="flex-1 rounded-xl border border-white/10 bg-slate-950/50 px-4 py-2 text-sm font-bold text-white focus:border-blue-500/50 focus:outline-none"
                            />
                            <button
                              onClick={() => handleRemoveFormula(formula.id)}
                              className="h-8 w-8 flex items-center justify-center rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Prix (€)</p>
                              <input
                                type="number"
                                value={formula.price}
                                onChange={(e) => handleUpdateFormula(formula.id, 'price', e.target.value)}
                                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-2 text-sm text-white font-black focus:border-emerald-500/50 focus:outline-none"
                              />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Com. (%)</p>
                              <input
                                type="number"
                                value={formula.commission}
                                onChange={(e) => handleUpdateFormula(formula.id, 'commission', e.target.value)}
                                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-2 text-sm text-blue-400 font-black focus:border-blue-500/50 focus:outline-none"
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-white/5">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Gain estimé</span>
                            <span className="text-xs font-black text-emerald-400">{comm.toLocaleString()} €</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className="font-black text-white text-sm tracking-tight">{formula.name}</h4>
                            <div className="flex items-center gap-3 mt-1.5 font-medium">
                              <span className="text-[10px] text-slate-500 uppercase tracking-widest">Commission {formula.commission}%</span>
                              <div className="h-1 w-1 rounded-full bg-slate-700" />
                              <span className="text-xs text-blue-400 font-bold">{comm.toLocaleString()} € / vente</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="inline-flex flex-col items-end">
                              <span className="text-lg font-black text-white tracking-tight">{parseFloat(formula.price).toLocaleString()}€</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
                {(!editedOffer.formulas || editedOffer.formulas.length === 0) && (
                  <div className="flex flex-col items-center justify-center py-6 gap-2 text-slate-600">
                    <Tag className="h-8 w-8 opacity-20" />
                    <p className="text-[11px] font-bold uppercase tracking-widest italic">Aucune formule définie</p>
                  </div>
                )}
              </div>
            </div>

            {/* Zone B - Context (Dates) */}
            <div className="rounded-3xl border border-white/5 bg-slate-900/30 p-6 backdrop-blur-md">
              <h3 className="mb-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                <Calendar className="h-3.5 w-3.5" />
                Validité Commerciale
              </h3>
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Lancement de l'offre</p>
                  {isEditing ? (
                    <input
                      type="date"
                      value={editedOffer.startDate}
                      onChange={(e) =>
                        setEditedOffer({ ...editedOffer, startDate: e.target.value })
                      }
                      className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-2.5 text-sm text-white focus:border-blue-500/50 focus:outline-none transition-all"
                    />
                  ) : (
                    <div className="flex items-center gap-3 rounded-2xl bg-white/5 border border-white/5 px-4 py-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                        <Calendar className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-bold text-white tracking-tight">{formatDate(offer.startDate)}</span>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Expiration prévue</p>
                  {isEditing ? (
                    <input
                      type="date"
                      value={editedOffer.endDate || ''}
                      onChange={(e) =>
                        setEditedOffer({ ...editedOffer, endDate: e.target.value || undefined })
                      }
                      className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-2.5 text-sm text-white focus:border-blue-500/50 focus:outline-none transition-all"
                    />
                  ) : (
                    <div className="flex items-center gap-3 rounded-2xl bg-white/5 border border-white/5 px-4 py-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500/80">
                        <Calendar className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-bold text-white tracking-tight">
                        {offer.endDate ? formatDate(offer.endDate) : 'Illimitée'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="mt-8 rounded-3xl border border-white/5 bg-slate-900/30 p-6 backdrop-blur-md relative z-10">
            <h3 className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">
              Description de la mission
            </h3>
            {isEditing ? (
              <textarea
                value={editedOffer.description}
                onChange={(e) =>
                  setEditedOffer({ ...editedOffer, description: e.target.value })
                }
                rows={4}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white font-medium focus:border-blue-500/50 focus:outline-none resize-none transition-all"
                placeholder="Détails de l'offre, avatar client, etc."
              />
            ) : (
              <p className="text-sm leading-relaxed text-slate-300 font-medium px-1">{offer.description}</p>
            )}
          </div>

          {/* Zone C - Contacts Rattachés - MODIFIÉ AVEC CRÉATION */}
          <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950 p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
                <Users className="h-4 w-4" />
                Contacts Rattachés
              </h3>
              {/* BOUTON CRÉER CONTACT */}
              {isEditing && !isCreatingContact && (
                <button
                  onClick={() => setIsCreatingContact(true)}
                  className="flex items-center gap-1 rounded bg-purple-500/10 px-2 py-1 text-xs font-bold text-purple-400 hover:bg-purple-500/20"
                >
                  <UserPlus className="h-3 w-3" /> Nouveau Contact
                </button>
              )}
            </div>

            {/* FORMULAIRE CRÉATION RAPIDE */}
            {isEditing && isCreatingContact && (
              <div className="mb-4 rounded-lg border border-purple-500/30 bg-purple-500/5 p-4 animate-in fade-in slide-in-from-top-2">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase text-purple-300">Ajout Rapide</p>
                  <button onClick={() => setIsCreatingContact(false)} className="text-slate-400 hover:text-white"><X className="h-3 w-3" /></button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input type="text" placeholder="Nom complet *" value={newContactData.name} onChange={(e) => setNewContactData({ ...newContactData, name: e.target.value })} className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none" />
                  <input type="text" placeholder="Rôle (ex: Closer) *" value={newContactData.role} onChange={(e) => setNewContactData({ ...newContactData, role: e.target.value })} className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none" />
                  <input type="email" placeholder="Email *" value={newContactData.email} onChange={(e) => setNewContactData({ ...newContactData, email: e.target.value })} className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none" />
                  <input type="tel" placeholder="Téléphone" value={newContactData.phone} onChange={(e) => setNewContactData({ ...newContactData, phone: e.target.value })} className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none" />
                </div>
                <button onClick={handleCreateAndAttachContact} className="mt-3 flex w-full items-center justify-center gap-2 rounded bg-purple-600 py-2 text-sm font-bold text-white hover:bg-purple-500">
                  <Check className="h-4 w-4" /> Créer et Attacher
                </button>
              </div>
            )}

            {isEditing ? (
              <ContactSelector
                selectedContactIds={editedOffer.contacts.map((c) => c.id)}
                onAdd={(contactId) => {
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

          {/* Configuration Facturation */}
          <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950 p-4">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
              <Receipt className="h-4 w-4" /> Configuration Facturation
            </h3>

            <div className="space-y-4">
              {/* Raison Sociale */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase">Raison Sociale</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedOffer.billingName || ''}
                    onChange={(e) => setEditedOffer({ ...editedOffer, billingName: e.target.value })}
                    placeholder="Ex: ACME SAS"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                  />
                ) : (
                  <p className="text-sm text-slate-300">{offer.billingName || 'Non définie'}</p>
                )}
              </div>

              {/* Adresse */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase">Adresse</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedOffer.billingAddress || ''}
                    onChange={(e) => setEditedOffer({ ...editedOffer, billingAddress: e.target.value })}
                    placeholder="Ex: 123 Rue de la Paix"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                  />
                ) : (
                  <p className="text-sm text-slate-300">{offer.billingAddress || 'Non définie'}</p>
                )}
              </div>

              {/* Ville / CP / Pays */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase">Ville</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedOffer.billingCity || ''}
                      onChange={(e) => setEditedOffer({ ...editedOffer, billingCity: e.target.value })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                    />
                  ) : (
                    <p className="text-sm text-slate-300">{offer.billingCity || '-'}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase">Code Postal</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedOffer.billingZip || ''}
                      onChange={(e) => setEditedOffer({ ...editedOffer, billingZip: e.target.value })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                    />
                  ) : (
                    <p className="text-sm text-slate-300">{offer.billingZip || '-'}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase">Pays</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedOffer.billingCountry || ''}
                      onChange={(e) => setEditedOffer({ ...editedOffer, billingCountry: e.target.value })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                    />
                  ) : (
                    <p className="text-sm text-slate-300">{offer.billingCountry || '-'}</p>
                  )}
                </div>
              </div>

              {/* SIRET */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase">SIRET / TVA</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedOffer.siret || ''}
                    onChange={(e) => setEditedOffer({ ...editedOffer, siret: e.target.value })}
                    placeholder="123 456 789 00012"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                  />
                ) : (
                  <p className="text-sm text-slate-300 font-mono">{offer.siret || 'Non défini'}</p>
                )}
              </div>

              {/* Email / Tel */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase">Email Facturation</label>
                  {isEditing ? (
                    <input
                      type="email"
                      value={editedOffer.billingEmail || ''}
                      onChange={(e) => setEditedOffer({ ...editedOffer, billingEmail: e.target.value })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                    />
                  ) : (
                    <p className="text-sm text-slate-300">{offer.billingEmail || '-'}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase">Téléphone</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedOffer.billingPhone || ''}
                      onChange={(e) => setEditedOffer({ ...editedOffer, billingPhone: e.target.value })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                    />
                  ) : (
                    <p className="text-sm text-slate-300">{offer.billingPhone || '-'}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* --- CONFIGURATION CRM (SIMPLIFIÉE AVEC FORMULE PAR DÉFAUT) --- */}
          <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950 p-4">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
              <Link className="h-4 w-4" /> Synchronisation CRM
            </h3>

            {/* 1. CRM Settings */}
            <div className="mb-10 rounded-[20px] border border-white/5 bg-slate-900/30 p-6 backdrop-blur-md">
              <label className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                <Database className="h-3 w-3" /> Source de données (CRM)
              </label>
              {isEditing ? (
                <div className="relative">
                  <select
                    value={editedOffer.crmProvider || 'iclosed'}
                    onChange={(e) => setEditedOffer({ ...editedOffer, crmProvider: e.target.value })}
                    className="w-full appearance-none rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white focus:border-blue-500/50 focus:outline-none transition-all"
                  >
                    <option value="iclosed">iClosed</option>
                    <option value="hubspot" disabled>HubSpot (Bientôt)</option>
                    <option value="other" disabled>Autre / Webhook Custom</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className={`h-2.5 w-2.5 rounded-full shadow-[0_0_8px] ${offer.crmProvider === 'iclosed' ? 'bg-purple-500 shadow-purple-500/50' : 'bg-slate-500 shadow-slate-500/50'}`} />
                  <p className="text-sm font-bold text-white tracking-wide">{offer.crmProvider === 'iclosed' ? 'iClosed' : 'Externe'}</p>
                </div>
              )}
            </div>

            {/* 2. SÉLECTION DE LA FORMULE PAR DÉFAUT (NOUVEAU) */}
            <div className="mb-10 rounded-[20px] border border-white/5 bg-slate-900/30 p-6 backdrop-blur-md">
              <label className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                <BoxSelect className="h-3 w-3" /> Formule par défaut (Prospects Entrants)
              </label>
              {isEditing ? (
                <div className="relative">
                  <select
                    value={editedOffer.defaultFormulaId || ''}
                    onChange={(e) => setEditedOffer({ ...editedOffer, defaultFormulaId: e.target.value })}
                    className="w-full appearance-none rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white focus:border-blue-500/50 focus:outline-none transition-all"
                  >
                    <option value="">-- Aucune formule (ou 1ère par défaut) --</option>
                    {(editedOffer.formulas || []).map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({parseFloat(f.price).toLocaleString()}€)
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-white/5 bg-slate-950/50 px-4 py-3 text-sm text-slate-300 font-medium">
                  {editedOffer.defaultFormulaId
                    ? (editedOffer.formulas?.find(f => f.id === editedOffer.defaultFormulaId)?.name || 'Formule introuvable')
                    : <span className="text-slate-500 italic">Aucune sélectionnée (par défaut)</span>
                  }
                </div>
              )}
              <p className="mt-3 text-[10px] text-slate-500 font-medium leading-relaxed">
                Cette formule sera automatiquement assignée aux prospects arrivant via le Webhook ci-dessous.
              </p>
            </div>

            {/* 3. Webhook Info (Helper) - AVEC BOUTON COPIER */}
            <div className="rounded-[24px] border border-blue-500/20 bg-blue-500/5 p-6 backdrop-blur-sm">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 shrink-0 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                  <Info className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-black text-blue-100 uppercase tracking-widest">Configuration Webhook iClosed</h4>

                  {/* --- TEXTE SPÉCIFIQUE ICLOSED --- */}
                  <p className="mt-2 text-xs text-blue-300/80 leading-relaxed font-medium">
                    Allez dans <strong>iClosed &gt; Paramètres &gt; Développeur &gt; Webhooks</strong> et collez l'URL ci-dessous.
                  </p>

                  {/* --- ALERTE PROPRIÉTAIRE --- */}
                  <div className="mt-4 flex items-start gap-2 rounded-xl border border-orange-500/20 bg-orange-500/10 p-3 text-[10px] text-orange-300 font-medium">
                    <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                    <span>
                      <strong>Attention :</strong> Si le menu "Développeur" n'apparaît pas, c'est que vous n'avez pas les droits.
                      Seul le <strong>Propriétaire</strong> de l'organisation iClosed peut configurer les Webhooks.
                    </span>
                  </div>

                  {/* URL + COPY BUTTON */}
                  <div className="mt-6 flex items-center gap-2">
                    <div className="flex-1 rounded-xl border border-white/5 bg-slate-950 px-4 py-3 font-mono text-[10px] text-slate-400 overflow-x-auto whitespace-nowrap shadow-inner">
                      {webhookUrl}
                    </div>
                    <button
                      onClick={handleCopyWebhook}
                      className="rounded-xl border border-white/10 bg-white/5 p-3 text-slate-400 hover:bg-white/10 hover:text-white transition-all active:scale-90 shadow-lg"
                      title="Copier l'URL"
                    >
                      {hasCopied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                  {editedOffer.defaultFormulaId && (
                    <p className="mt-3 text-[10px] text-emerald-400/80 flex items-center gap-1.5 font-black uppercase tracking-widest">
                      <Check className="h-3 w-3" /> L'ID de la formule est prêt
                    </p>
                  )}

                  {/* INTEGRATION SUPADEMO ICLOSED (VISIBLE SEULEMENT EN ÉDITION) */}
                  {isEditing && (editedOffer.crmProvider === 'iclosed' || !editedOffer.crmProvider) && (
                    <div className="mt-6 rounded-2xl border border-white/10 overflow-hidden bg-slate-900/50 shadow-2xl">
                      <div style={{ position: 'relative', boxSizing: 'content-box', width: '100%', aspectRatio: '1.86' }}>
                        <iframe
                          src="https://app.supademo.com/embed/cmla88ewa2sutvhwz09ss0nrs?embed_v=2&utm_source=embed&loop=1&autoplay=1"
                          loading="lazy"
                          title="Configurer le Webhook iClosed"
                          allow="clipboard-write"
                          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Zone D - Resources */}
          <div className="mt-8 rounded-3xl border border-white/5 bg-slate-900/30 p-6 backdrop-blur-md relative z-10">
            <h3 className="mb-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">
              <ExternalLink className="h-3.5 w-3.5" /> Ressources Commerciales
            </h3>

            {isEditing ? (
              <div className="space-y-6">
                <div className="space-y-4">
                  {editedOffer.resources.length > 0 ? (
                    editedOffer.resources.map((resource) => (
                      <div
                        key={resource.id}
                        className="flex items-center gap-4 rounded-2xl border border-white/5 bg-slate-950/50 p-4 transition-all hover:bg-slate-950"
                      >
                        <div className="h-10 w-10 shrink-0 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
                          {getResourceIcon(resource.type)}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-black text-white tracking-tight">{resource.name}</p>
                          <p className="text-[10px] text-slate-500 font-medium truncate max-w-[200px] mt-0.5">{resource.url}</p>
                        </div>
                        <button
                          onClick={() => handleRemoveResource(resource.id)}
                          className="h-9 w-9 flex items-center justify-center rounded-xl text-rose-500 hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 gap-2 text-slate-600">
                      <ExternalLink className="h-8 w-8 opacity-20" />
                      <p className="text-[11px] font-bold uppercase tracking-widest italic">Aucune ressource disponible</p>
                    </div>
                  )}
                </div>

                <div className="space-y-4 rounded-2xl border border-white/5 bg-white/5 p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">
                    Ajouter une ressource
                  </p>
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Nom (ex: Script de vente)"
                      value={tempResName}
                      onChange={(e) => setTempResName(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-blue-500/50 focus:outline-none transition-all"
                    />
                    <input
                      type="url"
                      placeholder="URL (ex: https://...)"
                      value={tempResLink}
                      onChange={(e) => setTempResLink(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-blue-500/50 focus:outline-none transition-all"
                    />
                    <button
                      onClick={handleAddResource}
                      className="flex w-full items-center justify-center gap-3 rounded-xl bg-blue-600 px-4 py-3 text-xs font-black text-white transition-all hover:bg-blue-500 shadow-lg shadow-blue-500/20 active:scale-95 uppercase tracking-widest"
                    >
                      <Plus className="h-4 w-4" />
                      Ajouter au catalogue
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {offer.resources.length > 0 ? (
                  offer.resources.map((resource) => (
                    <a
                      key={resource.id}
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-4 rounded-2xl border border-white/5 bg-slate-950/50 p-4 transition-all hover:border-blue-500/30 hover:bg-slate-900 hover:shadow-lg hover:shadow-blue-500/5"
                    >
                      <div className="h-10 w-10 shrink-0 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20 group-hover:bg-blue-500/20 transition-all">
                        {getResourceIcon(resource.type)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-black text-white tracking-tight group-hover:text-blue-400 transition-colors">
                          {resource.name}
                        </p>
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1 mt-0.5">
                          Ouvrir <ExternalLink className="h-2 w-2" />
                        </span>
                      </div>
                    </a>
                  ))
                ) : (
                  <div className="col-span-2 flex flex-col items-center justify-center py-6 gap-2 text-slate-600">
                    <ExternalLink className="h-8 w-8 opacity-20" />
                    <p className="text-[11px] font-bold uppercase tracking-widest italic text-center">Aucune ressource disponible</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Zone E - Notes */}
          <div className="mt-8 rounded-3xl border border-white/5 bg-slate-900/30 p-6 backdrop-blur-md relative z-10">
            <h3 className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">
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
                className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white font-medium focus:border-blue-500/50 focus:outline-none resize-none transition-all"
              />
            ) : (
              <p className="text-sm leading-relaxed text-slate-300 font-medium px-1">
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