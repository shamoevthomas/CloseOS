import { useState, useEffect } from 'react'
import { X, Building2, Tag } from 'lucide-react'
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

interface CreateProspectModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (prospect: {
    firstName: string
    lastName: string
    contact: string // On garde le champ complet pour compatibilité affichage
    email: string
    phone: string
    company: string
    offer: string
    offerId?: number // AJOUT : ID de l'offre
    value: number
    source: string // AJOUT : Source du prospect
    stage: string
  }) => void
}

export function CreateProspectModal({ isOpen, onClose, onSubmit }: CreateProspectModalProps) {
  const { offers } = useOffers()

  // Filtre offres actives
  const isExpired = (offer: Offer) => {
    if (!offer.endDate) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const end = new Date(offer.endDate)
    return end < today
  }

  const activeOffers = offers.filter((o) => o.status === 'active' && !isExpired(o))

  // NOUVEAU STATE : Prénom et Nom séparés, plus de source
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    offerId: '',
  })

  const [selectedFormulaId, setSelectedFormulaId] = useState<string>('')
  const [selectedOfferPrice, setSelectedOfferPrice] = useState(0)

  const selectedOffer = formData.offerId
    ? activeOffers.find((o) => String(o.id) === formData.offerId)
    : null

  const isB2B = selectedOffer?.target === 'B2B'
  const hasFormulas = selectedOffer?.formulas && selectedOffer.formulas.length > 0

  const handleOfferChange = (offerId: string) => {
    setFormData({ ...formData, offerId })
    setSelectedFormulaId('')

    if (offerId) {
      const offer = activeOffers.find((o) => String(o.id) === offerId)
      if (offer) {
        if (!offer.formulas || offer.formulas.length === 0) {
          const price = parsePrice(offer.price)
          setSelectedOfferPrice(price)
        } else {
          setSelectedOfferPrice(0)
        }
      }
    } else {
      setSelectedOfferPrice(0)
    }
  }

  const handleFormulaChange = (formulaId: string) => {
    setSelectedFormulaId(formulaId)
    if (selectedOffer && selectedOffer.formulas) {
      const formula = selectedOffer.formulas.find(f => f.id === formulaId)
      if (formula) {
        setSelectedOfferPrice(parsePrice(formula.price))
      }
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.lastName) {
      alert('Le nom est requis')
      return
    }

    if (isB2B && !formData.company) {
      alert("Le nom de l'entreprise est requis pour les offres B2B")
      return
    }

    if (hasFormulas && !selectedFormulaId) {
      alert('Veuillez sélectionner une formule')
      return
    }

    // On construit le nom complet pour l'affichage
    const fullName = `${formData.firstName} ${formData.lastName}`.trim()

    let finalOfferName = selectedOffer ? selectedOffer.name : 'N/A'
    if (hasFormulas && selectedFormulaId) {
      const formula = selectedOffer?.formulas?.find(f => f.id === selectedFormulaId)
      if (formula) {
        finalOfferName = `${selectedOffer?.name} - ${formula.name}`
      }
    }

    onSubmit({
      firstName: formData.firstName,
      lastName: formData.lastName,
      contact: fullName, // On garde la compatibilité
      email: formData.email,
      phone: formData.phone,
      company: formData.company || '',
      offer: finalOfferName,
      offer_id: formData.offerId ? parseInt(formData.offerId) : undefined,
      value: selectedOfferPrice,
      stage: 'prospect',
    })

    // Reset
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      company: '',
      offerId: '',
    })
    setSelectedFormulaId('')
    setSelectedOfferPrice(0)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md transition-opacity" onClick={onClose} />

      <div className="relative w-full max-w-lg rounded-2xl bg-[#1a1a1a] p-6 shadow-[0_20px_40px_rgba(0,0,0,0.2)] border border-white/[0.08]">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Nouveau Prospect</h2>
            <p className="mt-1 text-sm text-white/40">Ajouter un nouveau prospect au pipeline</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-white/40 hover:bg-white/5 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">

          {/* NOUVEAU : Prénom et Nom séparés */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-white/60">Prénom</label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                placeholder="Ex: Jean"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-white/60">Nom *</label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                placeholder="Ex: Dupont"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white/60">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="Ex: jean.dupont@entreprise.com"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white/60">Téléphone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="Ex: +33 6 12 34 56 78"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-white/60">
              <Building2 className="h-4 w-4 text-emerald-400" />
              Entreprise <span className="text-white/40 font-normal">(facultatif)</span>
            </label>
            <input
              type="text"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              placeholder="Ex: Tech Corp"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* SÉLECTEUR D'OFFRE */}
          <div>
            <label className="mb-2 block text-sm font-medium text-white/60">Offre</label>
            <select
              value={formData.offerId}
              onChange={(e) => handleOfferChange(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value="">-- Sélectionner une offre --</option>
              {activeOffers.map((offer) => (
                <option key={offer.id} value={offer.id}>
                  {offer.name} {offer.formulas && offer.formulas.length > 0 ? '(Multi-formules)' : `(${offer.price}€)`}
                </option>
              ))}
            </select>
          </div>

          {/* SÉLECTEUR DE FORMULE */}
          {hasFormulas && (
            <div className="animate-in fade-in slide-in-from-top-2">
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-400">
                <Tag className="h-4 w-4" />
                Choix de la formule *
              </label>
              <select
                value={selectedFormulaId}
                onChange={(e) => handleFormulaChange(e.target.value)}
                className="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                required
              >
                <option value="">-- Sélectionner la formule --</option>
                {selectedOffer.formulas?.map((formula) => (
                  <option key={formula.id} value={formula.id}>
                    {formula.name} - {formula.price}€
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* PRIX */}
          {selectedOfferPrice > 0 && (
            <div className="flex justify-end">
              <p className="text-xs font-semibold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded">
                Valeur estimée : {selectedOfferPrice.toLocaleString('fr-FR')} €
              </p>
            </div>
          )}

          {/* B2B: entreprise requise pour offres B2B (déjà rempli via le champ au-dessus) */}

          <div className="mt-6 flex gap-3">
            <button
              type="submit"
              className="flex-1 rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black transition-all hover:bg-emerald-400"
            >
              Créer le prospect
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-white/80 transition-all hover:bg-white/10"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}