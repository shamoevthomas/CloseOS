import { useState } from 'react'
import { RefreshCw, Plus, Briefcase, Archive, ChevronDown, ChevronUp } from 'lucide-react'
import { OfferDetailModal, type Offer } from '../components/OfferDetailModal'
import { useOffers } from '../contexts/OffersContext'
import { useProspects } from '../contexts/ProspectsContext'
import { cn } from '../lib/utils'

export function Offers() {
  const { offers, addOffer, updateOffer, deleteOffer } = useOffers()
  const {
    syncHubspot,
    isSyncingHubspot,
    hubspotConnected,
    hasHubspotOffer,
    nextSyncSeconds
  } = useProspects()
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  // État pour la modale de confirmation
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  // --- LOGIQUE DE TRI AUTOMATIQUE (NOUVEAU) ---
  const isExpired = (offer: Offer) => {
    if (!offer.endDate) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0) // On compare à minuit aujourd'hui
    const end = new Date(offer.endDate)
    return end < today
  }

  // Active = Statut 'active' ET Date non passée
  const activeOffers = offers.filter((o) => o.status === 'active' && !isExpired(o))

  // Archivée = Statut 'archived' OU (Statut 'active' ET Date passée)
  const archivedOffers = offers.filter((o) => o.status === 'archived' || (o.status === 'active' && isExpired(o)))
  // ----------------------------------------------

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
    <div className="relative min-h-screen bg-[#020617] p-8 overflow-hidden font-sans text-slate-100">

      {/* Background Blobs (Style Landing Page) */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/10 opacity-30 blur-[120px] rounded-full pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-purple-600/10 opacity-20 blur-[100px] rounded-full pointer-events-none mix-blend-screen" />

      <div className="relative mx-auto max-w-7xl space-y-8 z-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
              Catalogue <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400">d'Offres</span>
            </h2>
            <p className="mt-2 text-slate-400 text-sm font-medium">
              {activeOffers.length} {activeOffers.length > 1 ? 'offres actives' : 'offre active'} au total
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* HubSpot Sync Button */}
            {hubspotConnected && hasHubspotOffer && (
              <button
                onClick={() => syncHubspot()}
                disabled={isSyncingHubspot}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-bold transition-all shadow-lg",
                  isSyncingHubspot
                    ? "bg-orange-500/10 border-orange-500/30 text-orange-400 opacity-70"
                    : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:border-orange-500/30 hover:text-orange-400"
                )}
                title={`Prochaine synchro : ${Math.floor(nextSyncSeconds / 60)}:${(nextSyncSeconds % 60).toString().padStart(2, '0')}`}
              >
                <RefreshCw className={cn("h-4 w-4", isSyncingHubspot && "animate-spin text-orange-400")} />
                {!isSyncingHubspot && (
                  <span className="hidden lg:inline">{Math.floor(nextSyncSeconds / 60)}:{(nextSyncSeconds % 60).toString().padStart(2, '0')}</span>
                )}
                <span>{isSyncingHubspot ? "Synchro..." : "Synchro HubSpot"}</span>
              </button>
            )}

            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-blue-500 shadow-lg shadow-blue-600/20 active:scale-95"
            >
              <Plus className="h-5 w-5" />
              Nouvelle Offre
            </button>
          </div>
        </div>

        {/* Section 1: Offres Actuelles */}
        <div>
          <h3 className="mb-6 text-xl font-bold text-white flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-blue-400" />
            Offres Actuelles
          </h3>
          {activeOffers.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {activeOffers.map((offer) => (
                <div
                  key={offer.id}
                  onClick={() => setSelectedOffer(offer)}
                  className="group cursor-pointer rounded-3xl border border-white/5 bg-slate-900/40 p-7 transition-all duration-500 hover:bg-slate-900/80 hover:border-blue-500/30 hover:shadow-[0_0_30px_rgba(59,130,246,0.15)] hover:-translate-y-1 backdrop-blur-xl relative overflow-hidden flex flex-col h-full"
                >
                  <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none transform group-hover:scale-110 duration-500">
                    <Briefcase className="w-32 h-32 text-blue-500" />
                  </div>

                  <div className="mb-6 flex items-start justify-between relative z-10">
                    <div className="h-12 w-12 rounded-2xl bg-blue-500/20 flex items-center justify-center ring-1 ring-blue-500/30 group-hover:ring-blue-500/50 transition-all">
                      <Briefcase className="h-6 w-6 text-blue-400" />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-[10px] font-black text-emerald-400 uppercase tracking-widest shadow-sm">
                        Active
                      </span>
                    </div>
                  </div>

                  <div className="relative z-10 flex flex-col flex-1">
                    <h4 className="mb-2 text-xl font-black text-white group-hover:text-blue-400 transition-colors tracking-tight">
                      {offer.name}
                    </h4>
                    <p className="mb-8 line-clamp-2 text-sm text-slate-400 leading-relaxed font-medium">
                      {offer.description}
                    </p>

                    <div className="mt-auto pt-6 border-t border-white/5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Valeur Offre</span>
                        </div>
                        <span className="text-lg font-black text-white">{offer.price}€</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Votre Commission</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-base font-black text-blue-400">{offer.commission}%</span>
                          <span className="text-[10px] font-bold text-slate-600 bg-slate-800/50 px-2 py-0.5 rounded border border-slate-700/50">
                            Net
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-800 bg-slate-900/20 py-16">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-800/50 border border-slate-700">
                <Briefcase className="h-8 w-8 text-slate-500" />
              </div>
              <p className="text-lg font-bold text-white">Aucune offre active</p>
              <p className="mt-2 text-sm text-slate-400">
                Créez votre première offre pour commencer à closer.
              </p>
            </div>
          )}
        </div>

        {/* Section 2: Historique (Contient les archivées ET les expirées) */}
        <div className="rounded-3xl border border-white/5 bg-slate-900/40 backdrop-blur-md overflow-hidden">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="flex w-full items-center justify-between p-6 transition-colors hover:bg-white/5"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-800/50 text-slate-400">
                <Archive className="h-5 w-5" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-bold text-white">
                  Historique / Anciennes Offres
                </h3>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                  {archivedOffers.length} archivée{archivedOffers.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>
            {showArchived ? (
              <ChevronUp className="h-5 w-5 text-slate-500" />
            ) : (
              <ChevronDown className="h-5 w-5 text-slate-500" />
            )}
          </button>

          {showArchived && (
            <div className="space-y-1 p-4 pt-0">
              {archivedOffers.length > 0 ? (
                archivedOffers.map((offer) => {
                  const expired = isExpired(offer)
                  return (
                    <div
                      key={offer.id}
                      onClick={() => setSelectedOffer(offer)}
                      className="group cursor-pointer rounded-xl border border-white/5 bg-slate-900/40 p-4 transition-all hover:bg-slate-800/60 hover:border-white/10"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 border border-slate-700">
                            <Archive className="h-5 w-5 text-slate-500" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-slate-300 group-hover:text-white transition-colors">
                                {offer.name}
                              </h4>
                              {expired && (
                                <span className="rounded-md px-2 py-0.5 text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 uppercase tracking-wide">
                                  Expirée
                                </span>
                              )}
                            </div>
                            <p className="mt-1 line-clamp-1 text-sm text-slate-500">
                              {offer.description}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-slate-400">{offer.price}€</p>
                          <p className="text-xs font-bold text-slate-600 bg-slate-800/50 px-2 py-0.5 rounded border border-slate-700/50 inline-block mt-1">
                            {offer.commission}%
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="py-12 text-center">
                  <p className="text-sm text-slate-500 italic">Aucune offre archivée ou expirée.</p>
                </div>
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

      {/* MODALE DE CONFIRMATION */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-xl font-bold text-white mb-4">Créer une nouvelle offre ?</h3>
            <p className="text-slate-400 mb-8 leading-relaxed">
              Cela ajoutera une offre "Nouvelle Offre" à votre catalogue. Vous pourrez ensuite la personnaliser (prix, commission, description) en cliquant dessus.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="flex-1 px-4 py-3 rounded-xl border border-slate-700 bg-slate-800/50 text-slate-300 font-bold hover:bg-slate-800 hover:text-white transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmCreate}
                className="flex-1 px-4 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20"
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