import { useState, useMemo } from 'react'
import { Search, Plus, Filter, Users, ChevronDown, MoreHorizontal, Mail, Phone, Building2, Sparkles, X, Loader2, Save } from 'lucide-react'
import { useCRMProspects, type CRMProspect } from '../contexts/CRMProspectsContext'
import { CRMProspectView } from '../components/CRMProspectView'
import toast from 'react-hot-toast'

const STAGE_PILLS: Record<string, { label: string; tint: string }> = {
  prospect: { label: 'Prospect', tint: 'bg-blue-50 text-blue-700 border-blue-200' },
  qualified: { label: 'Qualifié', tint: 'bg-violet-50 text-violet-700 border-violet-200' },
  unqualified: { label: 'Non qualifié', tint: 'bg-amber-50 text-amber-700 border-amber-200' },
  won: { label: 'Gagné', tint: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  followup: { label: 'Relancer', tint: 'bg-orange-50 text-orange-700 border-orange-200' },
  noanswer: { label: 'Sans réponse', tint: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  noshow: { label: 'No-show', tint: 'bg-slate-50 text-slate-700 border-slate-200' },
  lost: { label: 'Perdu', tint: 'bg-red-50 text-red-700 border-red-200' },
}

export default function CRMContacts() {
  const { prospects, updateProspect, deleteProspect, addProspect } = useCRMProspects()

  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [stageFilterOpen, setStageFilterOpen] = useState(false)
  const [selected, setSelected] = useState<CRMProspect | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const stagesFromData = useMemo(() => {
    const set = new Set<string>()
    prospects.forEach(p => p.stage && set.add(p.stage))
    return Array.from(set)
  }, [prospects])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return prospects
      .filter(p => stageFilter === 'all' || p.stage === stageFilter)
      .filter(p => {
        if (!q) return true
        return (
          (p.first_name || '').toLowerCase().includes(q) ||
          (p.last_name || '').toLowerCase().includes(q) ||
          (p.email || '').toLowerCase().includes(q) ||
          (p.phone || '').toLowerCase().includes(q) ||
          (p.company || '').toLowerCase().includes(q) ||
          (p.contact || '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => {
        const ta = new Date(a.created_at || 0).getTime()
        const tb = new Date(b.created_at || 0).getTime()
        return tb - ta
      })
  }, [prospects, search, stageFilter])

  const stats = useMemo(() => {
    const total = prospects.length
    const won = prospects.filter(p => p.stage === 'won').length
    const active = prospects.filter(p => !['won', 'lost', 'noshow', 'unqualified'].includes(p.stage)).length
    const value = prospects.reduce((sum, p) => sum + (p.value || 0), 0)
    return { total, won, active, value }
  }, [prospects])

  const handleUpdate = async (id: number, updates: Partial<CRMProspect>) => {
    await updateProspect(id, updates)
  }

  const handleDelete = async (id: number) => {
    await deleteProspect(id)
    setSelected(null)
  }

  return (
    <div className="min-h-full bg-white">
      {/* Page header */}
      <div className="border-b border-blue-100 bg-gradient-to-b from-blue-50/30 to-white">
        <div className="px-6 md:px-10 pt-8 pb-6 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-600 mb-2">Contacts</p>
              <h1 className="text-3xl md:text-4xl font-bold text-[#0A0E27] tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Tous vos prospects
              </h1>
              <p className="text-stone-500 text-sm mt-1">
                {stats.total} contact{stats.total > 1 ? 's' : ''} · {stats.active} actif{stats.active > 1 ? 's' : ''} · {stats.won} gagné{stats.won > 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] hover:from-[#2563EB] hover:to-[#3B82F6] text-white text-sm font-bold shadow-md shadow-blue-500/25 hover:-translate-y-0.5 transition-all"
            >
              <Plus className="size-4" />
              Nouveau prospect
            </button>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total" value={stats.total} accent="text-[#0A0E27]" />
            <StatCard label="Actifs" value={stats.active} accent="text-blue-600" />
            <StatCard label="Gagnés" value={stats.won} accent="text-emerald-600" />
            <StatCard
              label="Pipeline"
              value={`${Math.round(stats.value / 1000)}K€`}
              accent="bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] bg-clip-text text-transparent"
            />
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="sticky top-0 z-20 bg-white/85 backdrop-blur-md border-b border-blue-100">
        <div className="px-6 md:px-10 py-3 max-w-7xl mx-auto flex items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-stone-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par nom, email, téléphone…"
              className="w-full pl-10 pr-3 py-2 rounded-xl bg-blue-50/40 border border-blue-100 text-sm text-[#0A0E27] focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 outline-none placeholder:text-stone-400"
            />
          </div>
          <div className="relative">
            <button
              onClick={() => setStageFilterOpen(o => !o)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-blue-100 text-xs font-bold text-[#0A0E27] hover:border-blue-300 transition-all"
            >
              <Filter className="size-3.5 text-blue-600" />
              {stageFilter === 'all' ? 'Tous les stages' : (STAGE_PILLS[stageFilter]?.label || stageFilter)}
              <ChevronDown className="size-3.5" />
            </button>
            {stageFilterOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setStageFilterOpen(false)} />
                <div className="absolute right-0 top-full mt-2 z-20 w-52 rounded-xl bg-white border border-blue-100 shadow-xl shadow-blue-500/10 py-1">
                  <button
                    onClick={() => { setStageFilter('all'); setStageFilterOpen(false) }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-blue-50 text-[#0A0E27]"
                  >
                    Tous les stages
                  </button>
                  {stagesFromData.map(s => (
                    <button
                      key={s}
                      onClick={() => { setStageFilter(s); setStageFilterOpen(false) }}
                      className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-blue-50 text-[#0A0E27] capitalize"
                    >
                      {STAGE_PILLS[s]?.label || s}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="px-6 md:px-10 py-6 max-w-7xl mx-auto">
        {filtered.length === 0 ? (
          <EmptyState onCreate={() => setCreateOpen(true)} hasSearch={!!search || stageFilter !== 'all'} />
        ) : (
          <div className="rounded-2xl border border-blue-100 bg-white overflow-hidden">
            <div className="hidden md:grid md:grid-cols-[1fr_240px_120px_140px_60px] gap-4 px-5 py-3 border-b border-blue-100 bg-blue-50/30 text-[10px] font-bold uppercase tracking-widest text-stone-500">
              <span>Contact</span>
              <span>Email · Téléphone</span>
              <span>Stage</span>
              <span>Valeur · Date</span>
              <span></span>
            </div>
            <ul>
              {filtered.map(p => {
                const fullName = (p.first_name || p.last_name)
                  ? `${p.first_name || ''} ${p.last_name || ''}`.trim()
                  : (p.contact || p.email?.split('@')[0] || 'Sans nom')
                const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                const stagePill = STAGE_PILLS[p.stage] || { label: p.stage, tint: 'bg-stone-50 text-stone-700 border-stone-200' }

                return (
                  <li key={p.id}>
                    <button
                      onClick={() => setSelected(p)}
                      className="w-full grid grid-cols-1 md:grid-cols-[1fr_240px_120px_140px_60px] gap-2 md:gap-4 px-5 py-3.5 border-b border-blue-50 last:border-0 hover:bg-blue-50/30 transition-colors text-left"
                    >
                      {/* Contact */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#60A5FA] flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[#0A0E27] truncate">{fullName}</p>
                          {p.company && (
                            <p className="text-xs text-stone-500 truncate flex items-center gap-1">
                              <Building2 className="size-3 shrink-0" /> {p.company}
                            </p>
                          )}
                        </div>
                      </div>
                      {/* Email/phone */}
                      <div className="min-w-0 flex flex-col gap-0.5">
                        {p.email && (
                          <p className="text-xs text-stone-600 truncate flex items-center gap-1.5">
                            <Mail className="size-3 text-blue-500 shrink-0" /> {p.email}
                          </p>
                        )}
                        {p.phone && (
                          <p className="text-xs text-stone-600 truncate flex items-center gap-1.5">
                            <Phone className="size-3 text-blue-500 shrink-0" /> {p.phone}
                          </p>
                        )}
                      </div>
                      {/* Stage */}
                      <div className="flex md:items-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${stagePill.tint}`}>
                          {stagePill.label}
                        </span>
                      </div>
                      {/* Value/date */}
                      <div className="flex md:flex-col md:items-end gap-2 md:gap-0">
                        {p.value ? (
                          <span className="text-sm font-extrabold text-[#0A0E27]">{p.value.toLocaleString('fr-FR')}€</span>
                        ) : (
                          <span className="text-xs text-stone-400">—</span>
                        )}
                        {p.created_at && (
                          <span className="text-[10px] text-stone-400">
                            {new Date(p.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                          </span>
                        )}
                      </div>
                      {/* Action */}
                      <div className="hidden md:flex items-center justify-end">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-stone-400 group-hover:text-blue-600">
                          <MoreHorizontal className="size-4" />
                        </span>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Modals */}
      {selected && (
        <CRMProspectView
          prospect={selected}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}

      {createOpen && (
        <CreateModal
          onClose={() => setCreateOpen(false)}
          onCreate={async (payload) => {
            await addProspect(payload)
            setCreateOpen(false)
            toast.success('Prospect ajouté')
          }}
        />
      )}
    </div>
  )
}

function CreateModal({ onClose, onCreate }: { onClose: () => void; onCreate: (p: any) => Promise<void> }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [value, setValue] = useState('')
  const [stage, setStage] = useState('prospect')
  const [saving, setSaving] = useState(false)

  const canSave = (firstName.trim() || lastName.trim() || email.trim() || phone.trim()) && !saving

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim()
      await onCreate({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        contact: fullName || email.trim() || phone.trim(),
        email: email.trim(),
        phone: phone.trim(),
        company: company.trim(),
        value: Number(value) || 0,
        stage,
      })
    } catch {
      toast.error('Erreur de création')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0A0E27]/60 backdrop-blur-md p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl shadow-blue-500/20 ring-1 ring-blue-100 overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-gradient-to-br from-[#3B82F6]/15 to-[#60A5FA]/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative px-6 py-5 border-b border-blue-100 bg-gradient-to-b from-blue-50/30 to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#60A5FA] flex items-center justify-center shadow-md shadow-blue-500/30">
                <Sparkles className="size-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#0A0E27]" style={{ fontFamily: 'Manrope, sans-serif' }}>Nouveau prospect</h3>
                <p className="text-xs text-stone-500">Ajoutez un contact à votre CRM</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-blue-50 text-stone-500 hover:text-blue-600 transition-colors">
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <CreateField label="Prénom" value={firstName} onChange={setFirstName} placeholder="Jean" />
            <CreateField label="Nom" value={lastName} onChange={setLastName} placeholder="Dupont" />
          </div>
          <CreateField label="Email" type="email" value={email} onChange={setEmail} placeholder="jean@example.com" />
          <CreateField label="Téléphone" type="tel" value={phone} onChange={setPhone} placeholder="+33 6 12 34 56 78" />
          <CreateField label="Société" value={company} onChange={setCompany} placeholder="Acme Inc." />
          <div className="grid grid-cols-2 gap-3">
            <CreateField label="Valeur (€)" type="number" value={value} onChange={setValue} placeholder="0" />
            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1.5">Stage</span>
              <select
                value={stage}
                onChange={e => setStage(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-blue-50/40 border border-blue-100 text-sm text-[#0A0E27] focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 outline-none transition-all"
              >
                <option value="prospect">Prospect</option>
                <option value="qualified">Qualifié</option>
                <option value="followup">Relancer</option>
                <option value="won">Gagné</option>
              </select>
            </label>
          </div>
        </div>

        <div className="px-6 py-3 border-t border-blue-100 bg-white flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full text-sm font-bold text-stone-600 hover:bg-stone-100 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] hover:from-[#2563EB] hover:to-[#3B82F6] text-white text-sm font-bold shadow-md shadow-blue-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Créer
          </button>
        </div>
      </div>
    </div>
  )
}

function CreateField({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1.5">{label}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl bg-blue-50/40 border border-blue-100 text-sm text-[#0A0E27] focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 outline-none transition-all placeholder:text-stone-400"
      />
    </label>
  )
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div className="rounded-2xl border border-blue-100 bg-white p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">{label}</p>
      <p className={`text-2xl font-extrabold tracking-tight ${accent}`} style={{ fontFamily: 'Manrope, sans-serif' }}>
        {value}
      </p>
    </div>
  )
}

function EmptyState({ onCreate, hasSearch }: { onCreate: () => void; hasSearch: boolean }) {
  return (
    <div className="text-center py-20 rounded-3xl border border-dashed border-blue-200 bg-gradient-to-br from-blue-50/30 to-white">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#60A5FA] shadow-lg shadow-blue-500/30 mb-4">
        {hasSearch ? <Search className="size-6 text-white" /> : <Users className="size-6 text-white" />}
      </div>
      <h3 className="text-xl font-bold text-[#0A0E27] mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
        {hasSearch ? 'Aucun résultat' : 'Aucun prospect pour l\'instant'}
      </h3>
      <p className="text-sm text-stone-500 mb-6 max-w-sm mx-auto">
        {hasSearch
          ? 'Essayez de modifier votre recherche ou vos filtres.'
          : 'Ajoutez votre premier prospect manuellement, ou laissez vos campagnes les capturer automatiquement.'}
      </p>
      {!hasSearch && (
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] hover:from-[#2563EB] hover:to-[#3B82F6] text-white text-sm font-bold shadow-md shadow-blue-500/25 transition-all"
        >
          <Sparkles className="size-4" />
          Créer mon premier prospect
        </button>
      )}
    </div>
  )
}
