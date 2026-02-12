import { useState, useMemo } from 'react'
import { 
  Plus, 
  Search, 
  Filter, 
  Phone, 
  Mail, 
  Building2, 
  Edit2, 
  Trash2, 
  Users, 
  Calendar,
  Sparkles,
  MoreHorizontal
} from 'lucide-react'
import { useProspects } from '../contexts/ProspectsContext'
import { useOffers } from '../contexts/OffersContext'
import { useInternalContacts } from '../contexts/InternalContactsContext'
// Imports des composants fonctionnels existants
import { ProspectModal } from '../components/ProspectModal'
import { InternalContactModal } from '../components/InternalContactModal'
import { CreateEventModal } from '../components/CreateEventModal'
import { DeleteConfirmationModal } from '../components/DeleteConfirmationModal'
import { MaskedText } from '../components/MaskedText'
import { cn } from '../lib/utils'

export function Contacts() {
  // 1. Connexions aux Contextes (Données réelles)
  const { prospects, loading: prospectsLoading, deleteProspect } = useProspects()
  const { offers } = useOffers()
  const { contacts: internalContacts, deleteContact: deleteInternalContact, updateContact: updateInternalContact } = useInternalContacts()

  // 2. États pour l'interface et les Modales
  const [activeTab, setActiveTab] = useState<'prospects' | 'internal'>('prospects')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStage, setSelectedStage] = useState<string>('all')
  const [selectedOffer, setSelectedOffer] = useState<string>('all')
  
  // États des Modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingProspect, setEditingProspect] = useState<any>(null)
  const [prospectToDelete, setProspectToDelete] = useState<any>(null)
  
  // États spécifiques pour les fonctionnalités avancées
  const [isAddMeetingModalOpen, setIsAddMeetingModalOpen] = useState(false)
  const [selectedProspectForEvent, setSelectedProspectForEvent] = useState<any>(null)
  const [selectedInternalContact, setSelectedInternalContact] = useState<any>(null)

  // --- CONFIGURATION DES ÉTAPES (BADGES) ---
  const stages = [
    { value: 'prospect', label: 'Prospect', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    { value: 'qualified', label: 'Qualifié', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
    { value: 'proposal', label: 'Proposition', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
    { value: 'negotiation', label: 'Négociation', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
    { value: 'won', label: 'Gagné', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    { value: 'lost', label: 'Perdu', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  ]

  // --- FILTRAGE DES PROSPECTS ---
  const filteredProspects = useMemo(() => {
    if (!prospects) return []
    return prospects.filter(prospect => {
      const matchesSearch = 
        (prospect.firstName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (prospect.lastName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (prospect.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (prospect.company?.toLowerCase() || '').includes(searchTerm.toLowerCase())

      const matchesStage = selectedStage === 'all' || prospect.stage === selectedStage
      
      let matchesOffer = selectedOffer === 'all'
      if (selectedOffer !== 'all') {
        if (selectedOffer === 'none') {
          matchesOffer = !prospect.offerId && !prospect.offer
        } else {
          matchesOffer = String(prospect.offerId) === selectedOffer || prospect.offer === selectedOffer
        }
      }

      return matchesSearch && matchesStage && matchesOffer
    })
  }, [prospects, searchTerm, selectedStage, selectedOffer])

  // --- FILTRAGE DES CONTACTS INTERNES ---
  const filteredInternalContacts = useMemo(() => {
    if (!internalContacts) return []
    return internalContacts.filter(contact => 
      (contact.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (contact.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (contact.role?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    )
  }, [internalContacts, searchTerm])

  // --- HANDLERS (Gestion des clics) ---
  const handleEdit = (prospect: any) => {
    setEditingProspect(prospect)
    setIsCreateModalOpen(true)
  }

  const handleDeleteClick = (prospect: any) => {
    setProspectToDelete(prospect)
  }

  const handleConfirmDelete = async () => {
    if (prospectToDelete) {
      await deleteProspect(prospectToDelete.id)
      setProspectToDelete(null)
    }
  }

  const handleOpenMeetingModal = (prospect: any) => {
    setSelectedProspectForEvent(prospect)
    setIsAddMeetingModalOpen(true)
  }

  const handleInternalContactClick = (contact: any) => {
    setSelectedInternalContact(contact)
  }

  // --- UTILITAIRES D'AFFICHAGE ---
  const getStageLabel = (stageValue: string) => {
    return stages.find(s => s.value === stageValue)?.label || stageValue
  }

  const getStageColor = (stageValue: string) => {
    return stages.find(s => s.value === stageValue)?.color || 'bg-slate-500/10 text-slate-400 border-slate-500/20'
  }

  const getOfferName = (prospect: any) => {
    if (prospect.offerId) {
      const offer = offers.find(o => String(o.id) === String(prospect.offerId))
      return offer ? offer.name : '-'
    }
    return prospect.offer || '-'
  }

  return (
    <div className="relative min-h-screen bg-[#020617] p-8 overflow-hidden font-sans text-slate-100">
      
      {/* Background Ambience (Blobs) */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/10 opacity-30 blur-[120px] rounded-full pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-purple-600/10 opacity-20 blur-[100px] rounded-full pointer-events-none mix-blend-screen" />

      <div className="relative mx-auto max-w-7xl space-y-8 z-10">
        
        {/* HEADER & TABS */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Contacts</h1>
            <p className="text-slate-400 mt-1">Gérez vos prospects et votre carnet d'adresses.</p>
          </div>
          
          <div className="flex items-center gap-4">
             {/* Onglets Switcher */}
             <div className="flex p-1 bg-slate-900/50 border border-white/10 rounded-xl backdrop-blur-sm">
                <button
                  onClick={() => setActiveTab('prospects')}
                  className={cn(
                    "px-4 py-2 text-sm font-bold rounded-lg transition-all",
                    activeTab === 'prospects' 
                      ? "bg-blue-600 text-white shadow-lg" 
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  Prospects
                </button>
                <button
                  onClick={() => setActiveTab('internal')}
                  className={cn(
                    "px-4 py-2 text-sm font-bold rounded-lg transition-all",
                    activeTab === 'internal' 
                      ? "bg-blue-600 text-white shadow-lg" 
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  Interne
                </button>
             </div>

             <button
              onClick={() => {
                setEditingProspect(null)
                setIsCreateModalOpen(true)
              }}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-600/40"
            >
              <Plus className="h-5 w-5" />
              <span className="hidden sm:inline">Ajouter</span>
            </button>
          </div>
        </div>

        {/* BARRE DE FILTRES (Seulement pour les prospects) */}
        {activeTab === 'prospects' && (
          <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-4 backdrop-blur-md shadow-xl flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Rechercher par nom, email, entreprise..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-800/50 pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all hover:bg-slate-800/70"
              />
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 md:pb-0">
              <div className="relative min-w-[180px]">
                  <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  <select
                    value={selectedStage}
                    onChange={(e) => setSelectedStage(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-white/10 bg-slate-800/50 pl-10 pr-8 py-3 text-sm font-medium text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer hover:bg-slate-800/70 transition-all"
                  >
                    <option value="all" className="bg-slate-900">Toutes étapes</option>
                    {stages.map(stage => (
                        <option key={stage.value} value={stage.value} className="bg-slate-900">{stage.label}</option>
                    ))}
                  </select>
              </div>
              
              <div className="relative min-w-[180px]">
                <select
                  value={selectedOffer}
                  onChange={(e) => setSelectedOffer(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-white/10 bg-slate-800/50 px-4 py-3 text-sm font-medium text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer hover:bg-slate-800/70 transition-all"
                >
                  <option value="all" className="bg-slate-900">Toutes offres</option>
                  <option value="none" className="bg-slate-900">Sans offre</option>
                  {offers.map(offer => (
                    <option key={offer.id} value={String(offer.id)} className="bg-slate-900">{offer.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* CONTENU PRINCIPAL : TABLEAUX */}
        <div className="rounded-3xl border border-white/5 bg-slate-900/40 backdrop-blur-md shadow-xl overflow-hidden min-h-[400px]">
          
          {/* LOADER */}
          {prospectsLoading ? (
            <div className="flex items-center justify-center h-full min-h-[400px]">
              <div className="flex flex-col items-center gap-4">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
                <p className="text-slate-500 animate-pulse">Chargement des données...</p>
              </div>
            </div>
          ) : (
            <>
              {/* VUE PROSPECTS */}
              {activeTab === 'prospects' && (
                filteredProspects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-800/50 border border-white/5">
                      <Users className="h-10 w-10 text-slate-600" />
                    </div>
                    <h3 className="text-xl font-bold text-white">Aucun prospect trouvé</h3>
                    <p className="mt-2 text-slate-400 max-w-sm mx-auto">
                      Votre recherche ne donne aucun résultat. Essayez de modifier les filtres ou ajoutez un nouveau prospect.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/5 bg-slate-900/60">
                          <th className="px-6 py-5 text-left text-xs font-bold uppercase tracking-widest text-slate-500">Identité</th>
                          <th className="px-6 py-5 text-left text-xs font-bold uppercase tracking-widest text-slate-500 hidden md:table-cell">Coordonnées</th>
                          <th className="px-6 py-5 text-left text-xs font-bold uppercase tracking-widest text-slate-500">Pipeline</th>
                          <th className="px-6 py-5 text-left text-xs font-bold uppercase tracking-widest text-slate-500 hidden lg:table-cell">Offre</th>
                          <th className="px-6 py-5 text-right text-xs font-bold uppercase tracking-widest text-slate-500">Valeur</th>
                          <th className="px-6 py-5 text-right text-xs font-bold uppercase tracking-widest text-slate-500">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredProspects.map((prospect) => (
                          <tr key={prospect.id} className="group transition-colors hover:bg-white/5">
                            {/* Identité */}
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-4">
                                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-slate-800 border border-slate-700 font-bold text-lg text-blue-400">
                                  {prospect.firstName?.[0]}{prospect.lastName?.[0]}
                                </div>
                                <div>
                                  <div className="font-bold text-white text-base">
                                    <MaskedText value={`${prospect.firstName} ${prospect.lastName}`} type="name" />
                                  </div>
                                  {prospect.company && (
                                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                                      <Building2 className="h-3 w-3" />
                                      <MaskedText value={prospect.company} type="name" />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Coordonnées */}
                            <td className="px-6 py-4 hidden md:table-cell">
                              <div className="space-y-1.5">
                                {prospect.email && (
                                  <div className="flex items-center gap-2 text-sm text-slate-300">
                                    <Mail className="h-3.5 w-3.5 text-slate-500" />
                                    <MaskedText value={prospect.email} type="email" className="truncate max-w-[150px]" />
                                  </div>
                                )}
                                {prospect.phone && (
                                  <div className="flex items-center gap-2 text-sm text-slate-300">
                                    <Phone className="h-3.5 w-3.5 text-slate-500" />
                                    <MaskedText value={prospect.phone} type="phone" />
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Pipeline / Stage */}
                            <td className="px-6 py-4">
                              <span className={cn(
                                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide shadow-sm",
                                getStageColor(prospect.stage)
                              )}>
                                {prospect.stage === 'won' && <Sparkles className="h-3 w-3" />}
                                {getStageLabel(prospect.stage)}
                              </span>
                            </td>

                            {/* Offre */}
                            <td className="px-6 py-4 text-sm text-slate-300 hidden lg:table-cell font-medium">
                              {getOfferName(prospect)}
                            </td>

                            {/* Valeur */}
                            <td className="px-6 py-4 text-right">
                                <span className="font-bold text-emerald-400 text-lg">
                                    <MaskedText value={prospect.value ? `${prospect.value.toLocaleString()}€` : '-'} type="number" />
                                </span>
                            </td>

                            {/* Actions */}
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                <button
                                  onClick={() => handleOpenMeetingModal(prospect)}
                                  className="p-2 rounded-lg hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 transition-colors"
                                  title="Planifier un RDV"
                                >
                                  <Calendar className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleEdit(prospect)}
                                  className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                                  title="Modifier"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(prospect)}
                                  className="p-2 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors"
                                  title="Supprimer"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {/* VUE CONTACTS INTERNES */}
              {activeTab === 'internal' && (
                filteredInternalContacts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <p className="text-slate-400">Aucun contact interne trouvé.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
                        {filteredInternalContacts.map(contact => (
                            <div 
                                key={contact.id} 
                                onClick={() => handleInternalContactClick(contact)}
                                className="group relative p-6 rounded-2xl bg-slate-800/30 border border-white/5 hover:bg-slate-800/50 hover:border-white/10 transition-all cursor-pointer"
                            >
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="h-12 w-12 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-lg border border-purple-500/30">
                                        {contact.name.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white">{contact.name}</h3>
                                        <p className="text-xs text-purple-400 font-medium uppercase tracking-wider">{contact.role}</p>
                                    </div>
                                </div>
                                <div className="space-y-2 text-sm text-slate-400">
                                    <div className="flex items-center gap-2"><Mail className="h-4 w-4"/> {contact.email}</div>
                                    <div className="flex items-center gap-2"><Phone className="h-4 w-4"/> {contact.phone}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )
              )}
            </>
          )}
        </div>
      </div>

      {/* --- MODALES --- */}
      
      {/* 1. Modale Création / Édition Prospect */}
      <ProspectModal
        isOpen={isCreateModalOpen}
        onClose={() => {
            setIsCreateModalOpen(false)
            setEditingProspect(null)
        }}
        prospectToEdit={editingProspect}
      />

      {/* 2. Modale Suppression */}
      <DeleteConfirmationModal
        isOpen={!!prospectToDelete}
        onClose={() => setProspectToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Supprimer le contact"
        description={`Êtes-vous sûr de vouloir supprimer ${prospectToDelete?.firstName} ${prospectToDelete?.lastName} ? Cette action est irréversible.`}
      />

      {/* 3. Modale Création RDV (Liée au contact) */}
      {isAddMeetingModalOpen && (
        <CreateEventModal
          isOpen={isAddMeetingModalOpen}
          onClose={() => setIsAddMeetingModalOpen(false)}
          prospectId={selectedProspectForEvent?.id}
          prospectName={`${selectedProspectForEvent?.firstName} ${selectedProspectForEvent?.lastName}`}
        />
      )}

      {/* 4. Modale Contact Interne */}
      {selectedInternalContact && (
        <InternalContactModal
          contact={selectedInternalContact}
          onClose={() => setSelectedInternalContact(null)}
          onEdit={(updated) => {
            updateInternalContact(updated.id, updated)
            setSelectedInternalContact(updated)
          }}
          onDelete={(id) => {
            deleteInternalContact(id)
            setSelectedInternalContact(null)
          }}
        />
      )}

    </div>
  )
}