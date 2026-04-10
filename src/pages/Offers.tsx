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
    isSyncingGhl,
    hubspotConnected,
    ghlConnected,
    hasHubspotOffer,
    hasGhlOffer,
    nextSyncSeconds,
    syncGhl
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
    <div className="relative min-h-screen bg-[#111111] p-8 md:p-10 overflow-hidden font-sans text-white">

      {/* Ambient Glows */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="relative mx-auto max-w-7xl space-y-12 z-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tighter text-white">
              Catalogue <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-300">d'Offres</span>
            </h2>
            <p className="mt-2 text-white/40 text-sm font-medium">
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
                  "flex items-center gap-2 rounded-full border px-5 py-3 text-sm font-bold transition-all shadow-lg",
                  isSyncingHubspot
                    ? "bg-orange-500/10 border-orange-500/30 text-orange-400 opacity-70"
                    : "bg-white/[0.03] border-white/[0.08] text-white/60 hover:bg-white/10 hover:border-orange-500/30 hover:text-orange-400"
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

            {/* GoHighLevel Sync Button */}
            {ghlConnected && hasGhlOffer && (
              <button
                onClick={() => syncGhl()}
                disabled={isSyncingGhl}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-5 py-3 text-sm font-bold transition-all shadow-lg",
                  isSyncingGhl
                    ? "bg-teal-500/10 border-teal-500/30 text-teal-400 opacity-70"
                    : "bg-white/[0.03] border-white/[0.08] text-white/60 hover:bg-white/10 hover:border-teal-500/30 hover:text-teal-400"
                )}
                title={`Prochaine synchro : ${Math.floor(nextSyncSeconds / 60)}:${(nextSyncSeconds % 60).toString().padStart(2, '0')}`}
              >
                <RefreshCw className={cn("h-4 w-4", isSyncingGhl && "animate-spin text-teal-400")} />
                {!isSyncingGhl && (
                  <span className="hidden lg:inline">{Math.floor(nextSyncSeconds / 60)}:{(nextSyncSeconds % 60).toString().padStart(2, '0')}</span>
                )}
                <span>{isSyncingGhl ? "Synchro..." : "Synchro GHL"}</span>
              </button>
            )}

            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-black transition-all hover:bg-emerald-400 shadow-lg shadow-emerald-600/20 active:scale-95"
            >
              <Plus className="h-5 w-5" />
              Nouvelle Offre
            </button>
          </div>
        </div>

        {/* Section 1: Offres Actuelles */}
        <div>
          <h3 className="mb-8 text-xl font-bold text-white flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <Briefcase className="h-5 w-5 text-emerald-400" />
            </span>
            Offres Actuelles
          </h3>
          {activeOffers.length > 0 ? (
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {activeOffers.map((offer) => (
                <div
                  key={offer.id}
                  onClick={() => setSelectedOffer(offer)}
                  className="group cursor-pointer rounded-2xl border-[0.5px] border-white/[0.08] bg-white/[0.03] p-8 transition-all duration-500 hover:bg-white/[0.06] hover:border-emerald-500/30 hover:shadow-[0_20px_40px_rgba(0,0,0,0.2),inset_0_0_20px_rgba(16,185,129,0.05)] hover:-translate-y-1 backdrop-blur-[16px] relative overflow-hidden flex flex-col h-full"
                >
                  <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none transform group-hover:scale-110 duration-500">
                    <Briefcase className="w-32 h-32 text-emerald-500" />
                  </div>

                  <div className="mb-8 flex items-start justify-between relative z-10">
                    <div className="h-12 w-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center ring-1 ring-emerald-500/30 group-hover:ring-emerald-500/50 transition-all">
                      <Briefcase className="h-6 w-6 text-emerald-400" />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-[10px] font-black text-emerald-400 uppercase tracking-widest shadow-sm">
                        Active
                      </span>
                    </div>
                  </div>

                  <div className="relative z-10 flex flex-col flex-1">
                    <h4 className="mb-2 text-xl font-black text-white group-hover:text-emerald-400 transition-colors tracking-tight">
                      {offer.name}
                    </h4>
                    <p className="mb-10 line-clamp-2 text-sm text-white/40 leading-relaxed font-medium">
                      {offer.description}
                    </p>

                    <div className="mt-auto pt-6 space-y-5" style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-white/40" />
                          <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Valeur Offre</span>
                        </div>
                        <span className="text-lg font-black text-white">{offer.price}€</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Votre Commission</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-base font-black text-emerald-400">{offer.commission}%</span>
                          <span className="text-[10px] font-bold text-white/40 bg-white/5 px-2 py-0.5 rounded border border-white/[0.08]">
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
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/[0.08] bg-white/[0.02] py-20 backdrop-blur-[16px]">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5 border border-white/[0.08]">
                <Briefcase className="h-8 w-8 text-white/40" />
              </div>
              <p className="text-lg font-bold text-white">Aucune offre active</p>
              <p className="mt-2 text-sm text-white/40">
                Créez votre première offre pour commencer à closer.
              </p>
            </div>
          )}
        </div>

        {/* Section 2: Historique (Contient les archivées ET les expirées) */}
        <div className="rounded-2xl border-[0.5px] border-white/[0.08] bg-white/[0.03] backdrop-blur-[16px] shadow-[0_20px_40px_rgba(0,0,0,0.2)] overflow-hidden">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="flex w-full items-center justify-between px-8 py-7 transition-colors duration-300 hover:bg-white/[0.04]"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/5 text-white/40">
                <Archive className="h-5 w-5" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-bold text-white">
                  Historique / Anciennes Offres
                </h3>
                <p className="text-xs text-white/40 font-medium uppercase tracking-wider">
                  {archivedOffers.length} archivée{archivedOffers.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>
            {showArchived ? (
              <ChevronUp className="h-5 w-5 text-white/40" />
            ) : (
              <ChevronDown className="h-5 w-5 text-white/40" />
            )}
          </button>

          {showArchived && (
            <div className="space-y-3 px-8 pb-8 pt-2">
              {archivedOffers.length > 0 ? (
                archivedOffers.map((offer) => {
                  const expired = isExpired(offer)
                  return (
                    <div
                      key={offer.id}
                      onClick={() => setSelectedOffer(offer)}
                      className="group cursor-pointer rounded-xl border-[0.5px] border-white/[0.08] bg-white/[0.03] p-5 transition-all duration-300 hover:bg-white/[0.04] hover:border-white/[0.12]"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 border border-white/[0.08]">
                            <Archive className="h-5 w-5 text-white/40" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-white/60 group-hover:text-white transition-colors">
                                {offer.name}
                              </h4>
                              {expired && (
                                <span className="rounded-md px-2 py-0.5 text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 uppercase tracking-wide">
                                  Expirée
                                </span>
                              )}
                            </div>
                            <p className="mt-1 line-clamp-1 text-sm text-white/40">
                              {offer.description}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-white/40">{offer.price}€</p>
                          <p className="text-xs font-bold text-white/40 bg-white/5 px-2 py-0.5 rounded border border-white/[0.08] inline-block mt-1">
                            {offer.commission}%
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="py-12 text-center">
                  <p className="text-sm text-white/40 italic">Aucune offre archivée ou expirée.</p>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="bg-[#1a1a1a] border border-white/[0.08] p-8 rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-xl font-bold text-white mb-4">Créer une nouvelle offre ?</h3>
            <p className="text-white/40 mb-8 leading-relaxed">
              Cela ajoutera une offre "Nouvelle Offre" à votre catalogue. Vous pourrez ensuite la personnaliser (prix, commission, description) en cliquant dessus.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="flex-1 px-4 py-3 rounded-full border border-white/[0.08] bg-white/[0.03] text-white/80 font-bold hover:bg-white/10 hover:text-white transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmCreate}
                className="flex-1 px-4 py-3 rounded-full bg-emerald-500 text-black font-semibold hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-600/20"
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