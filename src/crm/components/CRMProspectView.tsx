import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  X, Phone, Mail, Calendar, Trash2, Save, Plus, Loader2,
  Tag, FileText, Activity, User, Globe, ExternalLink, MessageSquare,
  Building2, DollarSign, Clock, ChevronRight, Check, Sparkles,
} from 'lucide-react'
import { type CRMProspect } from '../contexts/CRMProspectsContext'
import { useCRMAuth } from '../contexts/CRMAuthContext'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

const STAGE_DEFS = [
  { id: 'prospect', label: 'Prospect', color: 'bg-blue-500', tint: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'qualified', label: 'Qualifié', color: 'bg-violet-500', tint: 'bg-violet-50 text-violet-700 border-violet-200' },
  { id: 'unqualified', label: 'Non qualifié', color: 'bg-amber-500', tint: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'won', label: 'Gagné', color: 'bg-emerald-500', tint: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { id: 'followup', label: 'Relancer', color: 'bg-orange-500', tint: 'bg-orange-50 text-orange-700 border-orange-200' },
  { id: 'noanswer', label: 'Sans réponse', color: 'bg-cyan-500', tint: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { id: 'noshow', label: 'No-show', color: 'bg-slate-500', tint: 'bg-slate-50 text-slate-700 border-slate-200' },
  { id: 'lost', label: 'Perdu', color: 'bg-red-500', tint: 'bg-red-50 text-red-700 border-red-200' },
] as const

interface CRMProspectViewProps {
  prospect: CRMProspect
  onClose: () => void
  onUpdate: (id: number, updates: Partial<CRMProspect>) => void
  onDelete: (id: number) => void
  inline?: boolean
}

type TabKey = 'details' | 'notes' | 'activity'

export function CRMProspectView({ prospect, onClose, onUpdate, onDelete }: CRMProspectViewProps) {
  const { user } = useCRMAuth()
  const [tab, setTab] = useState<TabKey>('details')
  const [local, setLocal] = useState<CRMProspect>(prospect)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [activity, setActivity] = useState<{ id: string; type: string; label: string; date: string; meta?: string }[]>([])
  const [newNote, setNewNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  useEffect(() => { setLocal(prospect) }, [prospect.id])

  const allStages = useMemo(() => STAGE_DEFS as readonly { id: string; label: string; color: string; tint: string }[], [])

  const currentStage = allStages.find(s => s.id === local.stage) || STAGE_DEFS[0]
  const fullName = (local.first_name || local.last_name)
    ? `${local.first_name || ''} ${local.last_name || ''}`.trim()
    : (local.contact || local.email?.split('@')[0] || 'Sans nom')
  const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  // Load activity (stage changes + appointments + payments)
  useEffect(() => {
    if (!user?.id || !prospect.id) return
    let cancelled = false

    const loadActivity = async () => {
      const items: typeof activity = []

      // Created
      if (prospect.created_at) {
        items.push({
          id: 'created',
          type: 'created',
          label: 'Prospect créé',
          date: prospect.created_at,
          meta: prospect.offer ? `Source : ${prospect.offer}` : undefined,
        })
      }

      // Stage changes from history
      const { data: stageHistory } = await supabase
        .from('crm_stage_history')
        .select('id, from_stage, to_stage, changed_at')
        .eq('prospect_id', prospect.id)
        .order('changed_at', { ascending: false })
        .limit(10)
        .then(r => r, () => ({ data: [] as any[] }))

      ;(stageHistory || []).forEach((h: any) => {
        items.push({
          id: `stage-${h.id}`,
          type: 'stage',
          label: `Stage : ${h.from_stage || '—'} → ${h.to_stage}`,
          date: h.changed_at,
        })
      })

      // Appointments
      const { data: appts } = await supabase
        .from('crm_appointments')
        .select('id, title, datetime_utc, status, created_at')
        .eq('user_id', user.id)
        .eq('prospect_id', prospect.id)
        .order('datetime_utc', { ascending: false })
        .limit(5)
        .then(r => r, () => ({ data: [] as any[] }))

      ;(appts || []).forEach((a: any) => {
        items.push({
          id: `appt-${a.id}`,
          type: 'appointment',
          label: a.title || 'Rendez-vous',
          date: a.datetime_utc || a.created_at,
          meta: a.status,
        })
      })

      // Sort newest first
      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      if (!cancelled) setActivity(items)
    }

    loadActivity()
    return () => { cancelled = true }
  }, [user?.id, prospect.id])

  const handleSave = useCallback(async () => {
    setSaving(true)
    const updates: Partial<CRMProspect> = {
      first_name: local.first_name,
      last_name: local.last_name,
      email: local.email,
      phone: local.phone,
      company: local.company,
      title: local.title,
      stage: local.stage,
      value: local.value,
      offer: local.offer,
    }
    try {
      await onUpdate(local.id, updates)
      toast.success('Prospect mis à jour')
    } catch {
      toast.error('Erreur de sauvegarde')
    } finally {
      setSaving(false)
    }
  }, [local, onUpdate])

  const handleStageChange = useCallback(async (newStage: string) => {
    setLocal(prev => ({ ...prev, stage: newStage }))
    await onUpdate(local.id, { stage: newStage })
    toast.success('Stage mis à jour')
  }, [local.id, onUpdate])

  const handleAddNote = useCallback(async () => {
    const trimmed = newNote.trim()
    if (!trimmed) return
    setSavingNote(true)
    const note = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      content: trimmed,
    }
    const existing = local.call_notes || []
    const updated = [note, ...existing]
    try {
      await onUpdate(local.id, { call_notes: updated })
      setLocal(prev => ({ ...prev, call_notes: updated }))
      setNewNote('')
      toast.success('Note ajoutée')
    } catch {
      toast.error('Erreur')
    } finally {
      setSavingNote(false)
    }
  }, [newNote, local.call_notes, local.id, onUpdate])

  const handleDeleteNote = useCallback(async (noteId: string) => {
    const updated = (local.call_notes || []).filter(n => n.id !== noteId)
    await onUpdate(local.id, { call_notes: updated })
    setLocal(prev => ({ ...prev, call_notes: updated }))
  }, [local.call_notes, local.id, onUpdate])

  const handleConfirmDelete = useCallback(() => {
    onDelete(local.id)
    onClose()
  }, [local.id, onDelete, onClose])

  return (
    <div className="fixed inset-0 z-[200] flex items-stretch md:items-center md:justify-end bg-[#0A0E27]/60 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="relative w-full md:w-[640px] lg:w-[760px] h-full md:h-[94vh] md:my-auto md:mr-4 md:rounded-3xl bg-white shadow-2xl shadow-blue-500/20 ring-1 ring-blue-100 flex flex-col overflow-hidden animate-in slide-in-from-right-4 duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Decorative top gradient */}
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-gradient-to-br from-[#3B82F6]/15 to-[#60A5FA]/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="relative shrink-0 border-b border-blue-100 px-6 pt-5 pb-4 bg-gradient-to-b from-blue-50/30 to-white">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="relative shrink-0">
                <div className="absolute -inset-1 bg-gradient-to-br from-[#3B82F6] to-[#60A5FA] rounded-full blur opacity-40" />
                <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#60A5FA] flex items-center justify-center text-white font-extrabold text-lg ring-2 ring-white shadow-lg">
                  {initials}
                </div>
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-[#0A0E27] truncate" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {fullName}
                </h2>
                <p className="text-sm text-stone-500 truncate">
                  {local.title || local.company || local.email}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 p-2 rounded-xl hover:bg-blue-50 text-stone-500 hover:text-blue-600 transition-colors"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Stage selector */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Stage</span>
            <div className="relative flex-1">
              <select
                value={local.stage}
                onChange={e => handleStageChange(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl text-xs font-bold border appearance-none cursor-pointer transition-all ${currentStage.tint} hover:shadow-sm`}
              >
                {allStages.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
              <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 size-4 text-stone-400 rotate-90 pointer-events-none" />
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {local.email && (
              <a
                href={`mailto:${local.email}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-blue-100 text-xs font-semibold text-[#0A0E27] hover:border-blue-300 hover:bg-blue-50/50 transition-all"
              >
                <Mail className="size-3.5 text-blue-600" /> Email
              </a>
            )}
            {local.phone && (
              <>
                <a
                  href={`tel:${local.phone}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-blue-100 text-xs font-semibold text-[#0A0E27] hover:border-blue-300 hover:bg-blue-50/50 transition-all"
                >
                  <Phone className="size-3.5 text-blue-600" /> Appeler
                </a>
                <a
                  href={`https://wa.me/${local.phone.replace(/[^\d+]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-emerald-100 text-xs font-semibold text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50/60 transition-all"
                >
                  <MessageSquare className="size-3.5" /> WhatsApp
                </a>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="shrink-0 border-b border-blue-100 px-6 bg-white">
          <div className="flex gap-1">
            {([
              { key: 'details' as const, label: 'Détails', icon: User },
              { key: 'notes' as const, label: 'Notes', icon: FileText },
              { key: 'activity' as const, label: 'Activité', icon: Activity },
            ]).map(({ key, label, icon: Icon }) => {
              const isActive = tab === key
              return (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`relative flex items-center gap-2 px-4 py-3 text-sm font-bold transition-colors ${
                    isActive ? 'text-blue-600' : 'text-stone-500 hover:text-[#0A0E27]'
                  }`}
                >
                  <Icon className="size-4" />
                  {label}
                  {isActive && (
                    <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] rounded-full" />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {tab === 'details' && (
            <div className="space-y-5">
              {/* Personal info */}
              <Section title="Informations" icon={<User className="size-4 text-blue-600" />}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Prénom" value={local.first_name || ''} onChange={v => setLocal(p => ({ ...p, first_name: v }))} />
                  <Field label="Nom" value={local.last_name || ''} onChange={v => setLocal(p => ({ ...p, last_name: v }))} />
                </div>
                <Field label="Email" type="email" value={local.email || ''} onChange={v => setLocal(p => ({ ...p, email: v }))} icon={<Mail className="size-4" />} />
                <Field label="Téléphone" type="tel" value={local.phone || ''} onChange={v => setLocal(p => ({ ...p, phone: v }))} icon={<Phone className="size-4" />} />
              </Section>

              {/* Company */}
              <Section title="Entreprise" icon={<Building2 className="size-4 text-blue-600" />}>
                <Field label="Société" value={local.company || ''} onChange={v => setLocal(p => ({ ...p, company: v }))} />
                <Field label="Poste" value={local.title || ''} onChange={v => setLocal(p => ({ ...p, title: v }))} />
              </Section>

              {/* Deal */}
              <Section title="Deal" icon={<DollarSign className="size-4 text-blue-600" />}>
                <Field
                  label="Valeur (€)"
                  type="number"
                  value={String(local.value || '')}
                  onChange={v => setLocal(p => ({ ...p, value: Number(v) || 0 }))}
                />
                <Field label="Offre" value={local.offer || ''} onChange={v => setLocal(p => ({ ...p, offer: v }))} placeholder="Ex : Coaching premium" />
              </Section>

              {/* Source */}
              {(prospect.created_at || (prospect as any).utm_source) && (
                <Section title="Source" icon={<Globe className="size-4 text-blue-600" />}>
                  <div className="space-y-2">
                    {prospect.created_at && (
                      <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50/40 px-3 py-2.5">
                        <span className="text-xs font-bold uppercase tracking-widest text-stone-500">Créé le</span>
                        <span className="text-sm font-semibold text-[#0A0E27]">
                          {new Date(prospect.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    )}
                    {(prospect as any).utm_source && (
                      <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50/40 px-3 py-2.5">
                        <span className="text-xs font-bold uppercase tracking-widest text-stone-500">UTM source</span>
                        <span className="text-sm font-semibold text-[#0A0E27]">{(prospect as any).utm_source}</span>
                      </div>
                    )}
                  </div>
                </Section>
              )}
            </div>
          )}

          {tab === 'notes' && (
            <div className="space-y-4">
              {/* Add note */}
              <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/40 to-white p-4">
                <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2">
                  <Sparkles className="size-3.5 text-blue-600" />
                  Nouvelle note
                </label>
                <textarea
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  placeholder="Ce qui s'est passé pendant l'appel, prochaines actions, points clés…"
                  rows={4}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-blue-100 text-sm text-[#0A0E27] focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 outline-none resize-none"
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={handleAddNote}
                    disabled={savingNote || !newNote.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] hover:from-[#2563EB] hover:to-[#3B82F6] text-white text-xs font-bold shadow-md shadow-blue-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingNote ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                    Ajouter
                  </button>
                </div>
              </div>

              {/* Notes list */}
              <div className="space-y-3">
                {(local.call_notes || []).length === 0 ? (
                  <div className="text-center py-12 rounded-2xl border border-dashed border-blue-200 bg-blue-50/20">
                    <FileText className="size-8 text-blue-300 mx-auto mb-2" />
                    <p className="text-sm text-stone-500">Aucune note pour ce prospect</p>
                  </div>
                ) : (
                  (local.call_notes || []).map(note => (
                    <div key={note.id} className="group rounded-2xl border border-blue-100 bg-white p-4 hover:border-blue-200 hover:shadow-sm transition-all">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                          <Clock className="size-3" />
                          {new Date(note.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-red-50 text-stone-400 hover:text-red-600 transition-all"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                      <p className="text-sm text-[#0A0E27] whitespace-pre-wrap leading-relaxed">{note.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {tab === 'activity' && (
            <div className="space-y-3">
              {activity.length === 0 ? (
                <div className="text-center py-12 rounded-2xl border border-dashed border-blue-200 bg-blue-50/20">
                  <Activity className="size-8 text-blue-300 mx-auto mb-2" />
                  <p className="text-sm text-stone-500">Aucune activité enregistrée</p>
                </div>
              ) : (
                <div className="relative pl-7">
                  <div className="absolute left-2.5 top-2 bottom-2 w-px bg-gradient-to-b from-blue-200 via-blue-100 to-transparent" />
                  {activity.map((item) => (
                    <div key={item.id} className="relative pb-5 last:pb-0">
                      <div className="absolute -left-7 top-1 w-5 h-5 rounded-full bg-white border-2 border-blue-300 flex items-center justify-center">
                        {item.type === 'created' && <Plus className="size-2.5 text-blue-600" />}
                        {item.type === 'stage' && <Tag className="size-2.5 text-blue-600" />}
                        {item.type === 'appointment' && <Calendar className="size-2.5 text-blue-600" />}
                      </div>
                      <div className="rounded-xl border border-blue-100 bg-white p-3">
                        <p className="text-sm font-bold text-[#0A0E27]">{item.label}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-stone-500">
                          <span>{new Date(item.date).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                          {item.meta && (
                            <>
                              <span>·</span>
                              <span className="font-semibold text-blue-600">{item.meta}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-blue-100 px-6 py-3 bg-white flex items-center justify-between gap-2">
          {confirmDelete ? (
            <div className="flex items-center gap-2 flex-1">
              <span className="text-xs font-semibold text-red-600">Supprimer définitivement ?</span>
              <button
                onClick={handleConfirmDelete}
                className="px-3 py-1.5 rounded-full bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-colors"
              >
                Confirmer
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-1.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition-colors"
              >
                Annuler
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-stone-500 hover:bg-red-50 hover:text-red-600 text-xs font-semibold transition-colors"
            >
              <Trash2 className="size-3.5" />
              Supprimer
            </button>
          )}
          {!confirmDelete && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] hover:from-[#2563EB] hover:to-[#3B82F6] text-white text-sm font-bold shadow-md shadow-blue-500/25 transition-all disabled:opacity-60"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Enregistrer
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── helper components ───

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-xs font-bold uppercase tracking-widest text-[#0A0E27]">{title}</h3>
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  )
}

function Field({
  label, value, onChange, type = 'text', placeholder, icon,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  icon?: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1.5">{label}</span>
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none">{icon}</span>
        )}
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full ${icon ? 'pl-10' : 'pl-3'} pr-3 py-2.5 rounded-xl bg-blue-50/40 border border-blue-100 text-sm text-[#0A0E27] focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 outline-none transition-all placeholder:text-stone-400`}
        />
      </div>
    </label>
  )
}
