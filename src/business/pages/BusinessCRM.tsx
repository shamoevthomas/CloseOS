import { useState } from 'react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import {
  User,
  ChevronDown,
  Search,
  Plus,
  Trash2,
  Settings2,
  X,
  Loader2,
  RefreshCw,
  Check,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useBusinessProspects, type BusinessProspect } from '../contexts/BusinessProspectsContext'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { BusinessCRMIntegrationModal } from '../components/BusinessCRMIntegrationModal'

const ACTIVE_STAGES = [
  { id: 'prospect', name: 'Prospect', color: 'bg-blue-500', textColor: 'text-blue-700', bgLight: 'bg-blue-50', borderColor: 'border-blue-200' },
  { id: 'qualified', name: 'Qualifié', color: 'bg-purple-500', textColor: 'text-purple-700', bgLight: 'bg-purple-50', borderColor: 'border-purple-200' },
  { id: 'won', name: 'Gagné', color: 'bg-emerald-500', textColor: 'text-emerald-700', bgLight: 'bg-emerald-50', borderColor: 'border-emerald-200' },
  { id: 'followup', name: 'Follow Up', color: 'bg-orange-500', textColor: 'text-orange-700', bgLight: 'bg-orange-50', borderColor: 'border-orange-200' },
]

const INACTIVE_STAGES = [
  { id: 'noshow', name: 'No Show', color: 'bg-slate-500', textColor: 'text-slate-700', bgLight: 'bg-slate-50', borderColor: 'border-slate-200' },
  { id: 'lost', name: 'Perdu', color: 'bg-red-500', textColor: 'text-red-700', bgLight: 'bg-red-50', borderColor: 'border-red-200' },
]

const ALL_STAGES = [...ACTIVE_STAGES, ...INACTIVE_STAGES]

export function BusinessCRM() {
  const {
    prospects, updateProspect, addProspect, deleteProspect, loading,
    syncHubspot, syncPipedrive,
    isSyncingHubspot, isSyncingPipedrive,
    hubspotConnected, pipedriveConnected,
    nextSyncSeconds,
  } = useBusinessProspects()
  const { businessSettings } = useBusinessAuth()

  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set(['noshow', 'lost']))
  const [isIntegrationModalOpen, setIsIntegrationModalOpen] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [addStage, setAddStage] = useState('prospect')

  // Add prospect modal state
  const [newContact, setNewContact] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newCompany, setNewCompany] = useState('')
  const [addLoading, setAddLoading] = useState(false)

  const filteredProspects = prospects.filter(p => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      (p.contact || '').toLowerCase().includes(q) ||
      (p.company || '').toLowerCase().includes(q) ||
      (p.email || '').toLowerCase().includes(q) ||
      (p.firstName || '').toLowerCase().includes(q) ||
      (p.lastName || '').toLowerCase().includes(q)
    )
  })

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    const prospectId = parseInt(draggableId)
    const newStage = destination.droppableId
    updateProspect(prospectId, { stage: newStage })
  }

  const toggleColumn = (stageId: string) => {
    const newCollapsed = new Set(collapsedColumns)
    if (newCollapsed.has(stageId)) {
      newCollapsed.delete(stageId)
    } else {
      newCollapsed.add(stageId)
    }
    setCollapsedColumns(newCollapsed)
  }

  const getDisplayName = (deal: BusinessProspect) => {
    if (deal.firstName || deal.lastName) {
      return `${deal.firstName || ''} ${deal.lastName || ''}`.trim()
    }
    return deal.contact || 'Prospect sans nom'
  }

  const handleAddProspect = async () => {
    if (!newContact) return
    setAddLoading(true)
    try {
      await addProspect({
        contact: newContact,
        email: newEmail,
        phone: newPhone,
        company: newCompany,
        stage: addStage,
      } as any)
      setNewContact('')
      setNewEmail('')
      setNewPhone('')
      setNewCompany('')
      setIsAddModalOpen(false)
    } catch (err) {
      console.error(err)
    } finally {
      setAddLoading(false)
    }
  }

  const crmProvider = businessSettings?.crm_provider || 'closeos'
  const crmLabel = crmProvider === 'closeos' ? 'CloseOS' : crmProvider === 'iclosed' ? 'iClosed' : crmProvider === 'hubspot' ? 'HubSpot' : crmProvider === 'pipedrive' ? 'Pipedrive' : crmProvider

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* CRM Integration Banner */}
      <div className="mb-4 flex items-center justify-between rounded-xl border border-amber-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
            crmProvider === 'hubspot' ? 'bg-orange-500' :
            crmProvider === 'pipedrive' ? 'bg-green-500' :
            crmProvider === 'iclosed' ? 'bg-purple-500' : 'bg-amber-500'
          }`}>
            <span className="text-white font-bold text-xs">{crmLabel[0]}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-800">CRM : {crmLabel}</p>
              {((crmProvider === 'hubspot' && hubspotConnected) || (crmProvider === 'pipedrive' && pipedriveConnected)) && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
                  <Check className="h-2.5 w-2.5" /> Connecté
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {crmProvider === 'hubspot' && hubspotConnected
                ? `Auto-sync dans ${Math.floor(nextSyncSeconds / 60)}:${String(nextSyncSeconds % 60).padStart(2, '0')}`
                : 'Votre pipeline de prospection'
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Sync button for connected CRMs */}
          {crmProvider === 'hubspot' && hubspotConnected && (
            <button
              onClick={() => syncHubspot()}
              disabled={isSyncingHubspot}
              className="flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100 transition-all disabled:opacity-50"
            >
              {isSyncingHubspot ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Sync
            </button>
          )}
          {crmProvider === 'pipedrive' && pipedriveConnected && (
            <button
              onClick={() => syncPipedrive()}
              disabled={isSyncingPipedrive}
              className="flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition-all disabled:opacity-50"
            >
              {isSyncingPipedrive ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Sync
            </button>
          )}
          <button
            onClick={() => setIsIntegrationModalOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-all"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Intégration
          </button>
        </div>
      </div>

      {/* Search & Add */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un prospect..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
          />
        </div>
        <button
          onClick={() => { setAddStage('prospect'); setIsAddModalOpen(true) }}
          className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-500 transition-all"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nouveau prospect</span>
        </button>
      </div>

      {/* Kanban */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-4 min-w-max pb-4" style={{ minHeight: '400px' }}>
            {/* Active stages */}
            {ACTIVE_STAGES.map((stage) => {
              const stageDeals = filteredProspects.filter(d => d.stage === stage.id)
              const isCollapsed = collapsedColumns.has(stage.id)

              return (
                <div key={stage.id} className={cn("flex flex-col rounded-xl border bg-white", stage.borderColor, isCollapsed ? "w-12" : "w-72")}>
                  {/* Column header */}
                  <button
                    onClick={() => toggleColumn(stage.id)}
                    className={cn("flex items-center gap-2 px-3 py-3 border-b", stage.borderColor)}
                  >
                    <div className={cn("h-3 w-3 rounded-full", stage.color)} />
                    {!isCollapsed && (
                      <>
                        <span className="text-sm font-semibold text-slate-800 flex-1 text-left">{stage.name}</span>
                        <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", stage.bgLight, stage.textColor)}>
                          {stageDeals.length}
                        </span>
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      </>
                    )}
                  </button>

                  {!isCollapsed && (
                    <Droppable droppableId={stage.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={cn(
                            "flex-1 p-2 space-y-2 overflow-y-auto",
                            snapshot.isDraggingOver && stage.bgLight
                          )}
                        >
                          {stageDeals.map((deal, index) => (
                            <Draggable key={deal.id} draggableId={String(deal.id)} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={cn(
                                    "rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:shadow-md transition-shadow",
                                    snapshot.isDragging && "shadow-lg ring-2 ring-amber-300"
                                  )}
                                >
                                  <div className="flex items-start justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                      <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center">
                                        <User className="h-3.5 w-3.5 text-slate-500" />
                                      </div>
                                      <div>
                                        <p className="text-sm font-semibold text-slate-800 leading-tight">{getDisplayName(deal)}</p>
                                        {deal.company && <p className="text-xs text-slate-500">{deal.company}</p>}
                                      </div>
                                    </div>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); deleteProspect(deal.id) }}
                                      className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                  {deal.value && (
                                    <p className="text-xs font-bold text-emerald-600 mt-1">{deal.value.toLocaleString()} €</p>
                                  )}
                                  {deal.email && (
                                    <p className="text-xs text-slate-400 truncate mt-1">{deal.email}</p>
                                  )}
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  )}
                </div>
              )
            })}

            {/* Separator */}
            <div className="w-px bg-slate-200 self-stretch mx-1" />

            {/* Inactive stages */}
            {INACTIVE_STAGES.map((stage) => {
              const stageDeals = filteredProspects.filter(d => d.stage === stage.id)
              const isCollapsed = collapsedColumns.has(stage.id)

              return (
                <div key={stage.id} className={cn("flex flex-col rounded-xl border bg-white", stage.borderColor, isCollapsed ? "w-12" : "w-64")}>
                  <button
                    onClick={() => toggleColumn(stage.id)}
                    className={cn("flex items-center gap-2 px-3 py-3 border-b", stage.borderColor)}
                  >
                    <div className={cn("h-3 w-3 rounded-full", stage.color)} />
                    {!isCollapsed && (
                      <>
                        <span className="text-sm font-semibold text-slate-800 flex-1 text-left">{stage.name}</span>
                        <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", stage.bgLight, stage.textColor)}>
                          {stageDeals.length}
                        </span>
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      </>
                    )}
                  </button>

                  {!isCollapsed && (
                    <Droppable droppableId={stage.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={cn(
                            "flex-1 p-2 space-y-2 overflow-y-auto",
                            snapshot.isDraggingOver && stage.bgLight
                          )}
                        >
                          {stageDeals.map((deal, index) => (
                            <Draggable key={deal.id} draggableId={String(deal.id)} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={cn(
                                    "rounded-lg border border-slate-200 bg-white p-3 shadow-sm",
                                    snapshot.isDragging && "shadow-lg ring-2 ring-amber-300"
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center">
                                      <User className="h-3 w-3 text-slate-400" />
                                    </div>
                                    <p className="text-sm font-medium text-slate-700 flex-1 truncate">{getDisplayName(deal)}</p>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); deleteProspect(deal.id) }}
                                      className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </DragDropContext>

      {/* Integration Modal */}
      <BusinessCRMIntegrationModal
        isOpen={isIntegrationModalOpen}
        onClose={() => setIsIntegrationModalOpen(false)}
      />

      {/* Add Prospect Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-lg font-bold text-slate-900 mb-4">Nouveau prospect</h2>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nom du contact *</label>
                <input
                  type="text"
                  value={newContact}
                  onChange={(e) => setNewContact(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-4 text-sm text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  placeholder="Jean Dupont"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-4 text-sm text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  placeholder="jean@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Téléphone</label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-4 text-sm text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  placeholder="+33 6 12 34 56 78"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Entreprise</label>
                <input
                  type="text"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-4 text-sm text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  placeholder="Acme Corp"
                />
              </div>

              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 font-medium text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={handleAddProspect}
                  disabled={addLoading || !newContact}
                  className="flex-1 rounded-xl bg-amber-600 py-2.5 font-bold text-white hover:bg-amber-500 transition-all disabled:opacity-50"
                >
                  {addLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Ajouter'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
