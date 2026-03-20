import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X, Phone, Mail, Calendar, Pencil, Trash2,
  MessageCircle, Save, Clock, Plus, ChevronDown,
  Bell, Check, Loader2, FileText, ClipboardList,
  Package, ExternalLink, PhoneCall,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { type BusinessProspect } from '../contexts/BusinessProspectsContext'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

const ALL_STAGES = [
  { id: 'prospect', name: 'Prospect', color: 'bg-blue-500' },
  { id: 'qualified', name: 'Qualifié', color: 'bg-purple-500' },
  { id: 'unqualified', name: 'Non-Qualifié', color: 'bg-yellow-500' },
  { id: 'won', name: 'Gagné', color: 'bg-emerald-500' },
  { id: 'followup', name: 'Follow Up', color: 'bg-orange-500' },
  { id: 'noanswer', name: 'Pas de Réponse', color: 'bg-cyan-500' },
  { id: 'noshow', name: 'No Show', color: 'bg-slate-600' },
  { id: 'lost', name: 'Perdu', color: 'bg-red-500' },
]

interface CallNote {
  id: string
  date: string
  content: string
  author?: string
}

interface Formula {
  id: string
  name: string
  price: number
  description: string | null
  resources: { name: string; url: string; type: string }[]
}

interface Campaign {
  id: string
  name: string
}

interface BusinessProspectViewProps {
  prospect: BusinessProspect
  onClose: () => void
  onUpdate: (id: number, updates: Partial<BusinessProspect>) => void
  onDelete: (id: number) => void
}

const API_URL = '/api/business'

export function BusinessProspectView({
  prospect,
  onClose,
  onUpdate,
  onDelete,
}: BusinessProspectViewProps) {
  const navigate = useNavigate()
  const { user, isTeamMember, teamMember, ownerUserId } = useBusinessAuth()
  const [teamMembers, setTeamMembers] = useState<{ id: string; first_name: string; last_name: string; role: string }[]>([])

  // Setters with role Setter or Setter-Closer can assign closers
  const isSetter = isTeamMember && (teamMember?.role === 'Setter' || teamMember?.role === 'Setter-Closer')
  const canAssign = !isTeamMember || isSetter

  // Fetch team members + owner for assignment
  useEffect(() => {
    if (!canAssign) return
    const ownerId = isTeamMember ? ownerUserId : user?.id
    if (!ownerId) return
    Promise.all([
      supabase.from('business_team_members').select('id, first_name, last_name, role').eq('business_owner_id', ownerId),
      supabase.from('business_users').select('id, full_name, email').eq('id', ownerId).single(),
    ]).then(([tmRes, ownerRes]) => {
      const list = tmRes.data || []
      if (ownerRes.data) {
        const nameParts = (ownerRes.data.full_name || 'Owner').split(' ')
        list.unshift({ id: ownerRes.data.id, first_name: nameParts[0] || 'Owner', last_name: nameParts.slice(1).join(' ') || '', role: 'Owner' })
      }
      setTeamMembers(list)
    })
  }, [user?.id, ownerUserId, isTeamMember, canAssign])

  const [local, setLocal] = useState<BusinessProspect>(prospect)
  const [activeTab, setActiveTab] = useState<'info' | 'notes' | 'rappels'>('info')

  // Client edit
  const [editingClient, setEditingClient] = useState(false)
  const [editedContact, setEditedContact] = useState(prospect.contact)
  const [editedCompany, setEditedCompany] = useState(prospect.company)
  const [editedEmail, setEditedEmail] = useState(prospect.email)
  const [editedPhone, setEditedPhone] = useState(prospect.phone)

  // Notes internes
  const [editingNotes, setEditingNotes] = useState(false)
  const [tempNotes, setTempNotes] = useState(prospect.notes || '')

  // Call notes
  const [isAddingNote, setIsAddingNote] = useState(false)
  const [newNoteContent, setNewNoteContent] = useState('')

  // Reminders
  const [showReminderForm, setShowReminderForm] = useState(false)
  const [reminderTitle, setReminderTitle] = useState('')
  const [reminderDesc, setReminderDesc] = useState('')
  const [reminderDate, setReminderDate] = useState('')
  const [reminderTime, setReminderTime] = useState('')
  const [reminderSubmitting, setReminderSubmitting] = useState(false)
  const [prospectReminders, setProspectReminders] = useState<any[]>([])
  const [remindersLoading, setRemindersLoading] = useState(false)
  const [reminderActionLoading, setReminderActionLoading] = useState<number | null>(null)

  // Formula & Campaign
  const [formula, setFormula] = useState<Formula | null>(null)
  const [campaign, setCampaign] = useState<Campaign | null>(null)

  // Sync local on prop change
  useEffect(() => {
    const p = { ...prospect }
    setLocal(p)
    setTempNotes(p.notes || '')
    setEditedContact(p.contact)
    setEditedCompany(p.company)
    setEditedEmail(p.email)
    setEditedPhone(p.phone)
  }, [prospect])

  // Fetch linked formula
  useEffect(() => {
    if (!user?.id || !prospect.formula_id) { setFormula(null); return }
    fetch(`${API_URL}?action=formulas-list&user_id=${user.id}`)
      .then(r => r.json())
      .then(data => {
        const f = (data.formulas || []).find((f: Formula) => f.id === prospect.formula_id)
        setFormula(f || null)
      })
      .catch(() => setFormula(null))
  }, [user?.id, prospect.formula_id])

  // Fetch linked campaign
  useEffect(() => {
    if (!user?.id || !(prospect as any).campaign_id) { setCampaign(null); return }
    fetch(`${API_URL}?action=campaigns-list&user_id=${user.id}`)
      .then(r => r.json())
      .then(data => {
        const c = (data.campaigns || []).find((c: Campaign) => c.id === (prospect as any).campaign_id)
        setCampaign(c || null)
      })
      .catch(() => setCampaign(null))
  }, [user?.id, (prospect as any).campaign_id])

  // Fetch reminders
  useEffect(() => {
    if (!user || !prospect.id) return
    let mounted = true
    setRemindersLoading(true)
    supabase
      .from('reminders')
      .select('*')
      .eq('user_id', user.id)
      .eq('prospect_id', prospect.id)
      .order('reminder_date', { ascending: true })
      .then(({ data }) => {
        if (mounted) {
          setProspectReminders(data || [])
          setRemindersLoading(false)
        }
      })
    return () => { mounted = false }
  }, [user, prospect.id])

  const activeRemindersCount = prospectReminders.filter(r => !r.is_done).length

  // -- Optimistic update helper --
  const handleUpdate = (updates: Partial<BusinessProspect>) => {
    setLocal(prev => ({ ...prev, ...updates }))
    const dbUpdates: any = { ...updates }
    if (updates.call_notes !== undefined) {
      dbUpdates.call_notes = updates.call_notes
    }
    onUpdate(prospect.id, dbUpdates)
  }

  // -- Client save --
  const handleSaveClient = () => {
    const nameParts = editedContact.trim().split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''
    handleUpdate({ contact: editedContact, firstName, lastName, company: editedCompany, email: editedEmail, phone: editedPhone })
    setEditingClient(false)
  }

  // -- Notes --
  const handleSaveNotes = () => {
    handleUpdate({ notes: tempNotes })
    setEditingNotes(false)
  }

  // -- Call notes --
  const callNotes: CallNote[] = local.call_notes || []

  const handleAddManualNote = () => {
    if (!newNoteContent.trim()) return
    const newNote: CallNote = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      content: newNoteContent,
      author: 'Manuel',
    }
    const updated = [newNote, ...callNotes]
    handleUpdate({ call_notes: updated })
    setNewNoteContent('')
    setIsAddingNote(false)
  }

  const handleDeleteNote = (noteId: string) => {
    if (!confirm('Supprimer cette note ?')) return
    const updated = callNotes.filter(n => n.id !== noteId)
    handleUpdate({ call_notes: updated })
  }

  // -- Reminders --
  const handleCreateReminder = async () => {
    if (!user || !reminderTitle.trim() || !reminderDate || !reminderTime) return
    setReminderSubmitting(true)
    try {
      const reminder_date = new Date(`${reminderDate}T${reminderTime}`).toISOString()
      const { data, error } = await supabase
        .from('reminders')
        .insert([{ user_id: user.id, title: reminderTitle.trim(), description: reminderDesc.trim() || null, reminder_date, prospect_id: prospect.id, is_done: false }])
        .select().single()
      if (error) throw error
      setProspectReminders(prev => [...prev, data])
      setShowReminderForm(false)
      setReminderTitle(''); setReminderDesc(''); setReminderDate(''); setReminderTime('')
      toast.success('Rappel créé')
    } catch { toast.error('Impossible de créer le rappel') }
    finally { setReminderSubmitting(false) }
  }

  const handleMarkReminderDone = async (id: number) => {
    if (!user) return
    setReminderActionLoading(id)
    try {
      await supabase.from('reminders').update({ is_done: true }).eq('id', id).eq('user_id', user.id)
      setProspectReminders(prev => prev.map(r => r.id === id ? { ...r, is_done: true } : r))
    } catch { /* ignore */ }
    finally { setReminderActionLoading(null) }
  }

  const handleDeleteReminder = async (id: number) => {
    if (!user) return
    setReminderActionLoading(id)
    try {
      await supabase.from('reminders').delete().eq('id', id).eq('user_id', user.id)
      setProspectReminders(prev => prev.filter(r => r.id !== id))
    } catch { /* ignore */ }
    finally { setReminderActionLoading(null) }
  }

  // -- Actions --
  const handleOpenGmail = () => {
    if (local.email) window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${local.email}`, '_blank')
    else toast.error('Email manquant')
  }
  const handleOpenWhatsApp = () => {
    if (local.phone) {
      const clean = local.phone.replace(/[^0-9+]/g, '')
      window.open(`https://wa.me/${clean}`, '_blank')
    } else toast.error('Téléphone manquant')
  }
  const handleDelete = () => {
    if (confirm(`Supprimer ${local.contact} ?`)) { onDelete(prospect.id); onClose() }
  }

  // Parse capture custom data from notes
  const getCaptureData = (): Record<string, string> | null => {
    if (!local.notes) return null
    try {
      const parsed = JSON.parse(local.notes)
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) return parsed
    } catch { /* not JSON */ }
    return null
  }
  const captureData = getCaptureData()

  const inputCls = "w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-md">
          <div className="flex h-full flex-col bg-white shadow-xl ring-1 ring-amber-200">

            {/* Header */}
            <div className="border-b border-amber-200 bg-amber-50 px-6 pt-6 pb-0">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-slate-900 truncate">{local.contact}</h2>
                  {local.company && <p className="mt-0.5 text-sm text-slate-500">{local.company}</p>}
                </div>
                <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-amber-100 hover:text-slate-700">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Quick actions */}
              <div className="flex gap-2 mb-3">
                <button onClick={handleOpenGmail} className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                  <Mail className="h-4 w-4" /> Email
                </button>
                <button onClick={handleOpenWhatsApp} className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100">
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </button>
              </div>
              <button
                onClick={() => navigate(`/business/cockpit?name=${encodeURIComponent(local.contact)}&prospectId=${prospect.id}`)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-purple-700 mb-3"
              >
                <PhoneCall className="h-4 w-4" /> Ouvrir le Call Room
              </button>
              <button
                onClick={() => setShowReminderForm(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-amber-700 mb-5"
              >
                <Bell className="h-4 w-4" /> Créer un rappel
              </button>

              {/* Tabs */}
              <div className="flex border-b border-amber-200">
                {([
                  { key: 'info' as const, label: 'Informations', color: 'amber' },
                  { key: 'notes' as const, label: "Notes d'Appel", color: 'purple' },
                  { key: 'rappels' as const, label: 'Rappels', color: 'orange', badge: activeRemindersCount },
                ]).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      "flex-1 pb-3 text-sm font-medium transition-all relative flex items-center justify-center gap-1.5",
                      activeTab === tab.key ? "text-slate-900" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    {tab.label}
                    {tab.badge !== undefined && tab.badge > 0 && (
                      <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-700">
                        {tab.badge}
                      </span>
                    )}
                    {activeTab === tab.key && (
                      <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-amber-600`} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* ─── TAB: INFO ─── */}
              {activeTab === 'info' && (
                <div className="space-y-6">

                  {/* Stage */}
                  <div>
                    <label className="mb-2 block text-xs font-medium text-slate-500">Étape actuelle</label>
                    <select
                      value={local.stage}
                      onChange={(e) => handleUpdate({ stage: e.target.value })}
                      className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none"
                    >
                      {ALL_STAGES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>

                  {/* Assignment: separate Closer and Setter dropdowns */}
                  {canAssign && teamMembers.length > 0 && (() => {
                    const closers = teamMembers.filter(tm => tm.role === 'Closer' || tm.role === 'Setter-Closer' || tm.role === 'Owner' || tm.role === 'Head of Sales')
                    const setters = teamMembers.filter(tm => tm.role === 'Setter' || tm.role === 'Setter-Closer' || tm.role === 'Owner' || tm.role === 'Head of Sales')

                    return (
                      <div className="space-y-3">
                        {/* Assign Closer */}
                        {closers.length > 0 && (
                          <div>
                            <label className="mb-2 block text-xs font-medium text-slate-500">Assigner un Closer</label>
                            <select
                              value={closers.find(c => c.id === (local as any).assigned_to)?.id || ''}
                              onChange={(e) => handleUpdate({ assigned_to: e.target.value || null } as any)}
                              className="w-full rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                            >
                              <option value="">Aucun closer assigné</option>
                              {closers.map(tm => (
                                <option key={tm.id} value={tm.id}>
                                  {tm.first_name} {tm.last_name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Assign Setter (owner only — setters don't assign other setters) */}
                        {!isTeamMember && setters.length > 0 && (
                          <div>
                            <label className="mb-2 block text-xs font-medium text-slate-500">Assigner un Setter</label>
                            <select
                              value={setters.find(s => s.id === (local as any).assigned_setter)?.id || ''}
                              onChange={(e) => handleUpdate({ assigned_setter: e.target.value || null } as any)}
                              className="w-full rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-sm text-slate-900 focus:border-purple-500 focus:outline-none"
                            >
                              <option value="">Aucun setter assigné</option>
                              {setters.map(tm => (
                                <option key={tm.id} value={tm.id}>
                                  {tm.first_name} {tm.last_name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* Linked Formula */}
                  {formula && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
                        <Package className="h-4 w-4 text-amber-600" /> Formule associée
                      </h3>
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-slate-900">{formula.name}</span>
                          <span className="text-sm font-bold text-amber-700">{formula.price?.toFixed(2)} €</span>
                        </div>
                        {formula.description && <p className="text-xs text-slate-500 mb-2">{formula.description}</p>}
                        {formula.resources && formula.resources.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {formula.resources.map((r, i) => (
                              <a
                                key={i}
                                href={r.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-full bg-white border border-amber-200 px-2.5 py-1 text-xs text-amber-700 hover:bg-amber-100 transition-colors"
                              >
                                <ExternalLink className="h-3 w-3" /> {r.name || r.type}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Linked Campaign */}
                  {campaign && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 mb-2">Campagne d'origine</h3>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-sm font-medium text-slate-700">{campaign.name}</p>
                      </div>
                    </div>
                  )}

                  {/* Capture custom data */}
                  {captureData && Object.keys(captureData).length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-500" /> Réponses de capture
                      </h3>
                      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-2">
                        {Object.entries(captureData).map(([key, val]) => (
                          <div key={key} className="flex items-start gap-2">
                            <span className="text-xs font-medium text-blue-600 min-w-0 shrink-0">{key} :</span>
                            <span className="text-sm text-slate-700">{String(val)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Fiche Client */}
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-900">Fiche Client</h3>
                      <button onClick={() => setEditingClient(!editingClient)} className="rounded p-1 text-slate-400 hover:bg-amber-50 hover:text-amber-700">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {editingClient ? (
                      <div className="space-y-3">
                        <input type="text" value={editedContact} onChange={e => setEditedContact(e.target.value)} className={inputCls} placeholder="Nom" />
                        <input type="text" value={editedCompany} onChange={e => setEditedCompany(e.target.value)} className={inputCls} placeholder="Entreprise" />
                        <input type="email" value={editedEmail} onChange={e => setEditedEmail(e.target.value)} className={inputCls} placeholder="Email" />
                        <input type="tel" value={editedPhone} onChange={e => setEditedPhone(e.target.value)} className={inputCls} placeholder="Téléphone" />
                        <div className="flex gap-2">
                          <button onClick={handleSaveClient} className="flex-1 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700">Sauvegarder</button>
                          <button onClick={() => { setEditingClient(false); setEditedContact(local.contact); setEditedCompany(local.company); setEditedEmail(local.email); setEditedPhone(local.phone) }} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Annuler</button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <Mail className="h-4 w-4 text-blue-500" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-slate-400">Email</p>
                            <button onClick={handleOpenGmail} className="truncate text-sm text-slate-700 hover:text-amber-700 hover:underline text-left">{local.email || '—'}</button>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <Phone className="h-4 w-4 text-emerald-500" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-slate-400">Téléphone</p>
                            <button onClick={handleOpenWhatsApp} className="text-sm text-slate-700 hover:text-amber-700 hover:underline text-left">{local.phone || '—'}</button>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <Clock className="h-4 w-4 text-purple-500" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-slate-400">Date de création</p>
                            <p className="text-sm text-slate-700">
                              {local.created_at ? new Date(local.created_at).toLocaleDateString('fr-FR', {
                                day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                              }) : '—'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Notes internes (si pas capture data) */}
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-900">Notes Internes</h3>
                      <button onClick={() => setEditingNotes(!editingNotes)} className="rounded p-1 text-slate-400 hover:bg-amber-50 hover:text-amber-700">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {editingNotes ? (
                      <div>
                        <textarea value={tempNotes} onChange={e => setTempNotes(e.target.value)} className={`${inputCls} resize-none`} rows={4} />
                        <div className="mt-2 flex gap-2">
                          <button onClick={handleSaveNotes} className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700">Enregistrer</button>
                          <button onClick={() => setEditingNotes(false)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Annuler</button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <p className="whitespace-pre-wrap text-sm text-slate-600">
                          {captureData ? '(Données de capture - voir section ci-dessus)' : (local.notes || 'Aucune note')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ─── TAB: NOTES D'APPEL ─── */}
              {activeTab === 'notes' && (
                <div className="space-y-4">
                  {!isAddingNote ? (
                    <button
                      onClick={() => setIsAddingNote(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50/50 py-3 text-sm font-medium text-amber-700 hover:bg-amber-50 hover:border-amber-400 transition-all"
                    >
                      <Plus className="h-4 w-4" /> Ajouter une note manuelle
                    </button>
                  ) : (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <h4 className="text-xs font-semibold text-amber-700 mb-2 uppercase tracking-wider">Nouvelle Note</h4>
                      <textarea
                        value={newNoteContent}
                        onChange={e => setNewNoteContent(e.target.value)}
                        placeholder="Écrivez votre note d'appel ici..."
                        className={`${inputCls} min-h-[100px] mb-3`}
                        autoFocus
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => { setIsAddingNote(false); setNewNoteContent('') }} className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700">Annuler</button>
                        <button onClick={handleAddManualNote} disabled={!newNoteContent.trim()} className="px-4 py-2 rounded-lg bg-amber-600 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50">Enregistrer</button>
                      </div>
                    </div>
                  )}

                  <div className="h-px bg-slate-200 my-4" />

                  <div className="space-y-3">
                    {callNotes.length > 0 ? (
                      callNotes.map(note => (
                        <details key={note.id} className="group rounded-xl border border-slate-200 bg-white open:shadow-sm transition-all overflow-hidden">
                          <summary className="flex cursor-pointer items-center justify-between p-4 hover:bg-slate-50 transition-colors select-none list-none [&::-webkit-details-marker]:hidden">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 group-open:bg-amber-100 group-open:text-amber-700 transition-colors">
                                <Calendar className="h-4 w-4" />
                              </div>
                              <div>
                                <h4 className="text-sm font-semibold text-slate-900">
                                  {new Date(note.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                </h4>
                                <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                                  <Clock className="h-3 w-3" />
                                  <span>{new Date(note.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                                  {note.author && <><span>·</span><span className="uppercase tracking-wider">{note.author}</span></>}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <button onClick={e => { e.preventDefault(); handleDeleteNote(note.id) }} className="rounded p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100">
                                <Trash2 className="h-4 w-4" />
                              </button>
                              <ChevronDown className="h-5 w-5 text-slate-400 transition-transform duration-300 group-open:rotate-180" />
                            </div>
                          </summary>
                          <div className="border-t border-slate-200 p-4 pt-2">
                            <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{note.content}</p>
                          </div>
                        </details>
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 mb-3">
                          <ClipboardList className="h-6 w-6 text-slate-400" />
                        </div>
                        <p className="text-sm font-medium text-slate-500">Aucune note d'appel</p>
                        <p className="text-xs text-slate-400 mt-1">Vos notes manuelles apparaîtront ici.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ─── TAB: RAPPELS ─── */}
              {activeTab === 'rappels' && (
                <div className="space-y-4">
                  <button
                    onClick={() => setShowReminderForm(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50/50 py-3 text-sm font-medium text-amber-700 hover:bg-amber-50 hover:border-amber-400 transition-all"
                  >
                    <Plus className="h-4 w-4" /> Ajouter un rappel
                  </button>

                  {remindersLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
                    </div>
                  ) : prospectReminders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 mb-3">
                        <Bell className="h-6 w-6 text-slate-400" />
                      </div>
                      <p className="text-sm font-medium text-slate-500">Aucun rappel</p>
                      <p className="text-xs text-slate-400 mt-1">Créez un rappel pour ce prospect.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {prospectReminders.map(reminder => {
                        const isDone = reminder.is_done
                        const isOverdue = !isDone && new Date(reminder.reminder_date) < new Date()
                        const isLoading = reminderActionLoading === reminder.id
                        return (
                          <div
                            key={reminder.id}
                            className={cn(
                              'rounded-lg border p-3 transition-all',
                              isDone ? 'border-slate-200 bg-slate-50' : isOverdue ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className={cn('text-sm font-semibold', isDone ? 'text-slate-400 line-through' : 'text-slate-900')}>
                                  {reminder.title}
                                </p>
                                {reminder.description && <p className="text-xs text-slate-400 mt-0.5 truncate">{reminder.description}</p>}
                                <div className="flex items-center gap-2 mt-1.5">
                                  <Clock className="h-3 w-3 text-slate-400" />
                                  <span className={cn('text-xs', isOverdue ? 'text-red-500 font-medium' : 'text-slate-400')}>
                                    {new Date(reminder.reminder_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à {new Date(reminder.reminder_date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  {isDone && <span className="text-[10px] text-slate-400 font-medium uppercase">Fait</span>}
                                  {isOverdue && <span className="text-[10px] text-red-500 font-bold uppercase">En retard</span>}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {!isDone && (
                                  <button onClick={() => handleMarkReminderDone(reminder.id)} disabled={isLoading} className="rounded-md p-1.5 text-emerald-500 hover:bg-emerald-50 transition-colors disabled:opacity-50">
                                    <Check className="h-4 w-4" />
                                  </button>
                                )}
                                <button onClick={() => handleDeleteReminder(reminder.id)} disabled={isLoading} className="rounded-md p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Reminder creation modal */}
            {showReminderForm && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowReminderForm(false)} />
                <div className="relative w-full max-w-sm rounded-2xl border border-amber-200 bg-white shadow-2xl">
                  <div className="flex items-center justify-between border-b border-amber-100 px-5 py-3">
                    <h3 className="text-sm font-bold text-slate-900">Nouveau rappel</h3>
                    <button onClick={() => setShowReminderForm(false)} className="rounded-lg p-1 text-slate-400 hover:bg-amber-50 hover:text-slate-700">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="p-5 space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">Titre *</label>
                      <input type="text" value={reminderTitle} onChange={e => setReminderTitle(e.target.value)} placeholder="Ex: Rappeler le prospect" className={inputCls} autoFocus />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">Description</label>
                      <textarea value={reminderDesc} onChange={e => setReminderDesc(e.target.value)} placeholder="Détails optionnels..." rows={2} className={`${inputCls} resize-none`} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500">Date *</label>
                        <input type="date" value={reminderDate} onChange={e => setReminderDate(e.target.value)} className={inputCls} />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500">Heure *</label>
                        <input type="time" value={reminderTime} onChange={e => setReminderTime(e.target.value)} className={inputCls} />
                      </div>
                    </div>
                    <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                      <p className="text-xs text-amber-700">
                        <Bell className="h-3 w-3 inline mr-1" />
                        Lié à : <span className="font-semibold">{local.contact || 'Ce prospect'}</span>
                      </p>
                    </div>
                    <button
                      onClick={handleCreateReminder}
                      disabled={!reminderTitle.trim() || !reminderDate || !reminderTime || reminderSubmitting}
                      className="w-full rounded-lg bg-amber-600 py-2.5 text-sm font-bold text-white hover:bg-amber-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {reminderSubmitting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Créer le rappel'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="border-t border-amber-200 bg-amber-50 p-6">
              <button onClick={handleDelete} className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-100 transition-all">
                <Trash2 className="h-4 w-4" /> Supprimer le prospect
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
