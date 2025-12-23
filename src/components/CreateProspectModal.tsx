import { useState, useEffect } from 'react'
import { X, Building2 } from 'lucide-react'
import { useOffers } from '../contexts/OffersContext'

// Helper to parse price from string like "2 500€" to number 2500
const parsePrice = (priceString: string): number => {
  const cleaned = priceString.replace(/[^\d.,]/g, '')
  const normalized = cleaned.replace(/,/g, '.')
  const withoutSpaces = normalized.replace(/\s/g, '')
  const parsed = parseFloat(withoutSpaces)
  return isNaN(parsed) ? 0 : parsed
}

interface CreateProspectModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (prospect: {
    contact: string
    firstName: string
    lastName: string
    email: string
    phone: string
    company: string
    offer: string
    value: number
    source: string
    stage: string
  }) => void
}

export function CreateProspectModal({ isOpen, onClose, onSubmit }: CreateProspectModalProps) {
  const { offers } = useOffers()
  const activeOffers = offers.filter((o) => o.status === 'active')

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    offerId: '',
    source: 'LinkedIn Ads',
  })

  const [selectedOfferPrice, setSelectedOfferPrice] = useState(0)

  // Get the selected offer object
  const selectedOffer = formData.offerId
    ? activeOffers.find((o) => String(o.id) === formData.offerId)
    : null

  // Check if selected offer is B2B
  const isB2B = selectedOffer?.target === 'B2B'

  // Handle offer selection and auto-fill price
  const handleOfferChange = (offerId: string) => {
    setFormData({ ...formData, offerId })

    if (offerId) {
      const selectedOffer = activeOffers.find((o) => String(o.id) === offerId)
      if (selectedOffer) {
        const price = parsePrice(selectedOffer.price)
        setSelectedOfferPrice(price)
      }
    } else {
      setSelectedOfferPrice(0)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validate required fields
    if (!formData.name || !formData.email || !formData.phone) {
      alert('Veuillez remplir tous les champs obligatoires')
      return
    }

    // If B2B, company is required
    if (isB2B && !formData.company) {
      alert('Le nom de l\'entreprise est requis pour les offres B2B')
      return
    }

    // Parse name into firstName and lastName
    const nameParts = formData.name.trim().split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''

    // Get offer name
    const selectedOffer = activeOffers.find((o) => String(o.id) === formData.offerId)
    const offerName = selectedOffer ? selectedOffer.name : 'N/A'

    onSubmit({
      contact: formData.name,
      firstName,
      lastName,
      email: formData.email,
      phone: formData.phone,
      company: isB2B ? formData.company : 'N/A',
      offer: offerName,
      value: selectedOfferPrice,
      source: formData.source,
      stage: 'prospect',
    })

    // Reset form
    setFormData({
      name: '',
      email: '',
      phone: '',
      company: '',
      offerId: '',
      source: 'LinkedIn Ads',
    })
    setSelectedOfferPrice(0)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 p-6 shadow-xl ring-1 ring-slate-800">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Nouveau Prospect</h2>
            <p className="mt-1 text-sm text-slate-400">Ajouter un nouveau prospect au pipeline</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Nom & Prénom *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Jean Dupont"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">Email *</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="Ex: jean.dupont@entreprise.com"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">Téléphone *</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="Ex: +33 6 12 34 56 78"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">Offre</label>
            <select
              value={formData.offerId}
              onChange={(e) => handleOfferChange(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="">-- Sélectionner une offre --</option>
              {activeOffers.map((offer) => (
                <option key={offer.id} value={offer.id}>
                  {offer.name} ({offer.price})
                </option>
              ))}
            </select>
            {selectedOfferPrice > 0 && (
              <p className="mt-1 text-xs text-blue-400">
                Valeur automatique: {selectedOfferPrice.toLocaleString('fr-FR')} €
              </p>
            )}
          </div>

          {/* Conditional company field for B2B offers */}
          {isB2B && (
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300">
                <Building2 className="h-4 w-4 text-blue-400" />
                Nom de l'Entreprise *
              </label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                placeholder="Ex: Tech Corp"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                required={isB2B}
              />
              <p className="mt-1 text-xs text-slate-500">
                Requis pour les offres B2B
              </p>
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">Source</label>
            <select
              value={formData.source}
              onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              <option>LinkedIn Ads</option>
              <option>Pub Facebook</option>
              <option>Webinaire</option>
              <option>Référencement Google</option>
              <option>Youtube</option>
              <option>Bouche à oreille</option>
              <option>Salon professionnel</option>
            </select>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="submit"
              className="flex-1 rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-blue-600"
            >
              Créer le prospect
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-all hover:bg-slate-700"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
