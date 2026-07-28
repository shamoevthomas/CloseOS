import { useState } from 'react'
import { RefreshCw, Plus, Briefcase, Archive, ChevronDown, ChevronUp } from 'lucide-react'
import { OfferDetailModal, type Offer } from '../components/OfferDetailModal'
import { useOffers } from '../contexts/OffersContext'
import { useProspects } from '../contexts/ProspectsContext'
import { cn } from '../lib/utils'
import { useLanguage } from '../contexts/LanguageContext'
import { offersTranslations } from '../i18n/translations'

export function Offers() {
  const { lang } = useLanguage()
  const t = offersTranslations[lang]
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
    <div className="relative min-h-screen bg-transparent p-8 md:p-10 overflow-hidden font-sans text-slate-900 dark:text-white">

      {/* Ambient Glows */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-sky-500/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="relative mx-auto max-w-7xl space-y-12 z-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tighter text-slate-900 dark:text-white">
              {lang === 'fr' ? 'Catalogue' : 'Offers'} <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-sky-400">{lang === 'fr' ? "d'Offres" : 'Catalog'}</span>
            </h2>
            <p className="mt-2 text-slate-500 dark:text-neutral-400 text-sm font-medium">
              {activeOffers.length} {lang === 'fr' ? (activeOffers.length > 1 ? 'offres actives' : 'offre active') : (activeOffers.length > 1 ? 'active offers' : 'active offer')} {lang === 'fr' ? 'au total' : 'total'}
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
                    ? "bg-orange-500/10 border-orange-500/30 text-orange-500 opacity-70"
                    : "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-neutral-300 hover:bg-slate-100 hover:border-orange-500/30 hover:text-orange-500"
                )}
                title={`Prochaine synchro : ${Math.floor(nextSyncSeconds / 60)}:${(nextSyncSeconds % 60).toString().padStart(2, '0')}`}
              >
                <RefreshCw className={cn("h-4 w-4", isSyncingHubspot && "animate-spin text-orange-500")} />
                {!isSyncingHubspot && (
                  <span className="hidden lg:inline">{Math.floor(nextSyncSeconds / 60)}:{(nextSyncSeconds % 60).toString().padStart(2, '0')}</span>
                )}
                <span>{isSyncingHubspot ? (lang === 'fr' ? "Synchro..." : "Syncing...") : (lang === 'fr' ? "Synchro HubSpot" : "Sync HubSpot")}</span>
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
                    ? "bg-sky-500/10 border-sky-500/30 text-sky-600 dark:text-sky-400 opacity-70"
                    : "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-neutral-300 hover:bg-slate-100 hover:border-sky-500/30 hover:text-sky-600"
                )}
                title={`Prochaine synchro : ${Math.floor(nextSyncSeconds / 60)}:${(nextSyncSeconds % 60).toString().padStart(2, '0')}`}
              >
                <RefreshCw className={cn("h-4 w-4", isSyncingGhl && "animate-spin text-sky-600 dark:text-sky-400")} />
                {!isSyncingGhl && (
                  <span className="hidden lg:inline">{Math.floor(nextSyncSeconds / 60)}:{(nextSyncSeconds % 60).toString().padStart(2, '0')}</span>
                )}
                <span>{isSyncingGhl ? (lang === 'fr' ? "Synchro..." : "Syncing...") : (lang === 'fr' ? "Synchro GHL" : "Sync GHL")}</span>
              </button>
            )}

            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 rounded-full bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-sky-500 shadow-lg shadow-sky-600/20 active:scale-95"
            >
              <Plus className="h-5 w-5" />
              {t.add_offer}
            </button>
          </div>
        </div>

        {/* Section 1: Offres Actuelles */}
        <div>
          <h3 className="mb-8 text-xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20">
              <Briefcase className="h-5 w-5 text-sky-600 dark:text-sky-400" />
            </span>
            {lang === 'fr' ? 'Offres Actuelles' : 'Current Offers'}
          </h3>
          {activeOffers.length > 0 ? (
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {activeOffers.map((offer) => (
                <div
                  key={offer.id}
                  onClick={() => setSelectedOffer(offer)}
                  className="group cursor-pointer rounded-2xl border-[0.5px] border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] p-8 transition-all duration-500 hover:bg-slate-50 hover:border-sky-500/30 hover:shadow-[0_20px_40px_rgba(15,23,42,0.12),inset_0_0_20px_rgba(14,165,233,0.05)] hover:-translate-y-1 backdrop-blur-[16px] relative overflow-hidden flex flex-col h-full shadow-sm"
                >
                  <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none transform group-hover:scale-110 duration-500">
                    <Briefcase className="w-32 h-32 text-sky-500" />
                  </div>

                  <div className="mb-8 flex items-start justify-between relative z-10">
                    <div className="h-12 w-12 rounded-2xl bg-sky-500/20 flex items-center justify-center ring-1 ring-sky-500/30 group-hover:ring-sky-500/50 transition-all">
                      <Briefcase className="h-6 w-6 text-sky-600 dark:text-sky-400" />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="rounded-full bg-sky-500/10 border border-sky-500/20 px-3 py-1 text-[10px] font-black text-sky-700 dark:text-sky-400 uppercase tracking-widest shadow-sm">
                        Active
                      </span>
                    </div>
                  </div>

                  <div className="relative z-10 flex flex-col flex-1">
                    <h4 className="mb-2 text-xl font-black text-slate-900 dark:text-white group-hover:text-sky-600 transition-colors tracking-tight">
                      {offer.name}
                    </h4>
                    <p className="mb-10 line-clamp-2 text-sm text-slate-500 dark:text-neutral-400 leading-relaxed font-medium">
                      {offer.description}
                    </p>

                    <div className="mt-auto pt-6 space-y-5" style={{ borderTop: '0.5px solid rgba(15,23,42,0.08)' }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                          <span className="text-[10px] font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-widest">{lang === 'fr' ? 'Valeur Offre' : 'Offer Value'}</span>
                        </div>
                        <span className="text-lg font-black text-slate-900 dark:text-white">{offer.price}€</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-sky-600" />
                          <span className="text-[10px] font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-widest">{lang === 'fr' ? 'Votre Commission' : 'Your Commission'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-base font-black text-sky-600 dark:text-sky-400">{offer.commission}%</span>
                          <span className="text-[10px] font-bold text-slate-500 dark:text-neutral-400 bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded border border-slate-200 dark:border-white/10">
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
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 py-20 backdrop-blur-[16px]">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10">
                <Briefcase className="h-8 w-8 text-slate-400 dark:text-neutral-500" />
              </div>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{lang === 'fr' ? 'Aucune offre active' : 'No active offers'}</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-neutral-400">
                {lang === 'fr' ? 'Créez votre première offre pour commencer à closer.' : 'Create your first offer to start closing.'}
              </p>
            </div>
          )}
        </div>

        {/* Section 2: Historique (Contient les archivées ET les expirées) */}
        <div className="rounded-2xl border-[0.5px] border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] backdrop-blur-[16px] shadow-sm overflow-hidden">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="flex w-full items-center justify-between px-8 py-7 transition-colors duration-300 hover:bg-slate-50"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-neutral-400">
                <Archive className="h-5 w-5" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {lang === 'fr' ? 'Historique / Anciennes Offres' : 'History / Past Offers'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-neutral-400 font-medium uppercase tracking-wider">
                  {archivedOffers.length} {lang === 'fr' ? `archivée${archivedOffers.length > 1 ? 's' : ''}` : 'archived'}
                </p>
              </div>
            </div>
            {showArchived ? (
              <ChevronUp className="h-5 w-5 text-slate-400 dark:text-neutral-500" />
            ) : (
              <ChevronDown className="h-5 w-5 text-slate-400 dark:text-neutral-500" />
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
                      className="group cursor-pointer rounded-xl border-[0.5px] border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] p-5 transition-all duration-300 hover:bg-slate-50 hover:border-slate-300"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10">
                            <Archive className="h-5 w-5 text-slate-500 dark:text-neutral-400" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-slate-600 dark:text-neutral-300 group-hover:text-slate-900 transition-colors">
                                {offer.name}
                              </h4>
                              {expired && (
                                <span className="rounded-md px-2 py-0.5 text-[10px] font-bold bg-red-500/10 text-red-600 border border-red-500/20 uppercase tracking-wide">
                                  {lang === 'fr' ? 'Expirée' : 'Expired'}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 line-clamp-1 text-sm text-slate-500 dark:text-neutral-400">
                              {offer.description}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-slate-500 dark:text-neutral-400">{offer.price}€</p>
                          <p className="text-xs font-bold text-slate-500 dark:text-neutral-400 bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded border border-slate-200 dark:border-white/10 inline-block mt-1">
                            {offer.commission}%
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="py-12 text-center">
                  <p className="text-sm text-slate-500 dark:text-neutral-400 italic">{lang === 'fr' ? 'Aucune offre archivée ou expirée.' : 'No archived or expired offers.'}</p>
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
          <div className="bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 p-8 rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Créer une nouvelle offre ?</h3>
            <p className="text-slate-600 dark:text-neutral-300 mb-8 leading-relaxed">
              Cela ajoutera une offre "Nouvelle Offre" à votre catalogue. Vous pourrez ensuite la personnaliser (prix, commission, description) en cliquant dessus.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="flex-1 px-4 py-3 rounded-full border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-neutral-300 font-bold hover:bg-slate-100 hover:text-slate-900 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmCreate}
                className="flex-1 px-4 py-3 rounded-full bg-sky-600 text-white font-semibold hover:bg-sky-500 transition-all shadow-lg shadow-sky-600/20"
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
