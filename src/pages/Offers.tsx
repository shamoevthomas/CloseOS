import { useState } from 'react'
import { Plus, Briefcase, Euro, Calendar, Archive, ChevronDown, ChevronUp } from 'lucide-react'
import { OfferDetailModal, type Offer } from '../components/OfferDetailModal'
import { useOffers } from '../contexts/OffersContext'

export function Offers() {
  const { offers, addOffer, updateOffer, deleteOffer } = useOffers()
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  
  // État pour la modale de confirmation
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  const activeOffers = offers.filter((o) => o.status === 'active')
  const archivedOffers = offers.filter((o) => o.status === 'archived')

  // FONCTION CORRIGÉE : Ajoute l'offre et ferme la modale
  const handleConfirmCreate = () => {
    const newOffer = {
      name: 'Nouvelle Offre',
      company: 'Ma Société',
      status: 'active' as const,
      target: 'B2C' as const,
      startDate: new Date().toISOString().split('T')[0],
      endDate: undefined,
      price: '1000', // Format numérique pour éviter les erreurs de calcul
      commission: '10',
      description: 'Description de la nouvelle offre à modifier',
      resources: [],
      contacts: [],
      notes: '',
    }
    
    addOffer(newOffer);
    setIsCreateModalOpen(false); // Ferme la modale immédiatement
  }

  const handleUpdateOffer = (updatedOffer: Offer) => {
    updateOffer(updatedOffer.id, updatedOffer)
    setSelectedOffer(updatedOffer)
  }

  return (
    <div className="h-full overflow-auto bg-slate-950 p-8 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Catalogue d'Offres</h2>
            <p className="mt-1 text-sm text-slate-400">
              {activeOffers.length} offre{activeOffers.length > 1 ? 's' : ''} active
              {activeOffers.length > 1 ? 's' : ''}
            </p>
          </div>
          
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-blue-600"
          >
            <Plus className="h-4 w-4" />
            Nouvelle Offre
          </button>
        </div>

        {/* Section 1: Offres Actuelles */}
        <div>
          <h3 className="mb-4 text-lg font-semibold text-white">Offres Actuelles</h3>
          {activeOffers.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {activeOffers.map((offer) => (
                <div
                  key={offer.id}
                  onClick={() => setSelectedOffer(offer)}
                  className="group cursor-pointer rounded-xl border border-slate-800 bg-slate-900 p-6 transition-all hover:border-blue-500/50 hover:bg-slate-800/50 hover:shadow-xl"
                >
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/20">
                      <Briefcase className="h-6 w-6 text-blue-400" />
                    </div>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-400">
                      Active
                    </span>
                  </div>

                  <h4 className="mb-2 text-lg font-bold text-white group-hover:text-blue-400">
                    {offer.name}
                  </h4>
                  <p className="mb-4 line-clamp-2 text-sm text-slate-400">
                    {offer.description}
                  </p>

                  <div className="space-y-2 border-t border-slate-800 pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Prix</span>
                      <span className="text-sm font-bold text-emerald-400">{offer.price}€</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Commission</span>
                      <span className="text-sm font-semibold text-blue-400">
                        {offer.commission}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-800 bg-slate-900/50 py-12">
              <Briefcase className="mb-4 h-12 w-12 text-slate-700" />
              <p className="text-sm font-medium text-slate-400">Aucune offre active</p>
              <p className="mt-1 text-xs text-slate-500">
                Créez votre première offre pour commencer
              </p>
            </div>
          )}
        </div>

        {/* Section 2: Historique */}
        <div>
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="mb-4 flex w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 p-4 transition-colors hover:bg-slate-800/50"
          >
            <div className="flex items-center gap-3">
              <Archive className="h-5 w-5 text-slate-500" />
              <h3 className="text-lg font-semibold text-slate-400">
                Historique / Anciennes Offres
              </h3>
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-500">
                {archivedOffers.length}
              </span>
            </div>
            {showArchived ? (
              <ChevronUp className="h-5 w-5 text-slate-500" />
            ) : (
              <ChevronDown className="h-5 w-5 text-slate-500" />
            )}
          </button>

          {showArchived && (
            <div className="space-y-3">
              {archivedOffers.length > 0 ? (
                archivedOffers.map((offer) => (
                  <div
                    key={offer.id}
                    onClick={() => setSelectedOffer(offer)}
                    className="group cursor-pointer rounded-lg border border-slate-800/50 bg-slate-900/30 p-4 opacity-60 transition-all hover:opacity-100 hover:border-slate-700 hover:bg-slate-800/50"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800">
                          <Archive className="h-5 w-5 text-slate-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-slate-400 group-hover:text-slate-300">
                              {offer.name}
                            </h4>
                          </div>
                          <p className="mt-1 line-clamp-1 text-sm text-slate-500">
                            {offer.description}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-500">{offer.price}€</p>
                        <p className="mt-1 text-xs text-slate-600">{offer.commission}%</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-8 text-center text-sm text-slate-500">
                  Aucune offre archivée
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Détails de l'offre */}
      {selectedOffer && (
        <OfferDetailModal
          offer={selectedOffer}
          onClose={() => setSelectedOffer(null)}
          onUpdate={handleUpdateOffer}
          onDelete={(id) => {
            deleteOffer(id)
            setSelectedOffer(null)
          }}
        />
      )}

      {/* MODALE DE CONFIRMATION CORRIGÉE */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">Créer une nouvelle offre ?</h3>
            <p className="text-slate-400 mb-6">Cela ajoutera une offre "Nouvelle Offre" que vous pourrez ensuite personnaliser en cliquant dessus.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="flex-1 px-4 py-2 rounded-lg bg-slate-800 text-white font-semibold hover:bg-slate-700 transition-colors"
              >
                Annuler
              </button>
              <button 
                onClick={handleConfirmCreate}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-500 transition-colors"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}