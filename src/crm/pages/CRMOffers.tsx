import { useMemo, useState } from 'react'
import {
  Plus, X, Loader2, Save, Package, Sparkles, Trash2,
  Pencil, Search, Link2, MoreHorizontal,
} from 'lucide-react'
import { useCRMProspects, type CRMFormula } from '../contexts/CRMProspectsContext'
import toast from 'react-hot-toast'

type BillingType = 'one_time' | 'subscription' | 'quote'
type BillingInterval = 'monthly' | 'quarterly' | 'annual' | null

interface Resource {
  name: string
  url: string
  type: string
}

type Formula = CRMFormula

const BILLING_OPTIONS = [
  { key: 'one_time', interval: null, label: 'Paiement unique', short: 'One-shot', icon: '💰' },
  { key: 'subscription', interval: 'monthly', label: 'Mensuel', short: '/mois', icon: '🔁' },
  { key: 'subscription', interval: 'quarterly', label: 'Trimestriel', short: '/trim.', icon: '🔁' },
  { key: 'subscription', interval: 'annual', label: 'Annuel', short: '/an', icon: '🔁' },
  { key: 'quote', interval: null, label: 'Sur devis', short: 'Sur devis', icon: '📄' },
] as const

function billingLabel(billing_type: BillingType, billing_interval?: BillingInterval) {
  const opt = BILLING_OPTIONS.find(o => o.key === billing_type && o.interval === (billing_interval || null))
  return opt?.label || 'Paiement unique'
}

function billingShort(billing_type: BillingType, billing_interval?: BillingInterval) {
  const opt = BILLING_OPTIONS.find(o => o.key === billing_type && o.interval === (billing_interval || null))
  return opt?.short || ''
}

export default function CRMOffers() {
  const { formulas, loading, addFormula, updateFormula, deleteFormula } = useCRMProspects()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Formula | null>(null)
  const [creating, setCreating] = useState(false)

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return formulas
      .filter(f => !q || f.name.toLowerCase().includes(q) || (f.description || '').toLowerCase().includes(q))
  }, [formulas, search])

  const stats = useMemo(() => {
    const total = formulas.length
    const active = formulas.filter(f => f.is_active).length
    const recurring = formulas.filter(f => f.billing_type === 'subscription').length
    const oneShot = formulas.filter(f => f.billing_type === 'one_time').length
    return { total, active, recurring, oneShot }
  }, [formulas])

  const handleCreate = async (payload: Partial<Formula>) => {
    const created = await addFormula(payload)
    if (!created) { toast.error('Erreur de création'); return }
    toast.success('Offre créée')
    setCreating(false)
  }

  const handleUpdate = async (id: string, updates: Partial<Formula>) => {
    await updateFormula(id, updates)
    toast.success('Offre mise à jour')
    setEditing(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette offre ?')) return
    await deleteFormula(id)
    toast.success('Offre supprimée')
  }

  const handleToggleActive = async (formula: Formula) => {
    await updateFormula(formula.id, { is_active: !formula.is_active })
  }

  return (
    <div className="min-h-full bg-white">
      {/* Header */}
      <div className="border-b border-blue-100 bg-gradient-to-b from-blue-50/30 to-white">
        <div className="px-6 md:px-10 pt-8 pb-6 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-600 mb-2">Offres</p>
              <h1 className="text-3xl md:text-4xl font-bold text-[#0A0E27] tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Vos offres & formules
              </h1>
              <p className="text-stone-500 text-sm mt-1">
                Créez vos packs, abonnements et services. Associez-les à vos prospects et campagnes.
              </p>
            </div>
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] hover:from-[#2563EB] hover:to-[#3B82F6] text-white text-sm font-bold shadow-md shadow-blue-500/25 hover:-translate-y-0.5 transition-all"
            >
              <Plus className="size-4" />
              Nouvelle offre
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Total" value={stats.total} accent="text-[#0A0E27]" />
            <Stat label="Actives" value={stats.active} accent="text-blue-600" />
            <Stat label="Récurrentes" value={stats.recurring} accent="text-violet-600" />
            <Stat label="Paiement unique" value={stats.oneShot} accent="text-emerald-600" />
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="sticky top-0 z-20 bg-white/85 backdrop-blur-md border-b border-blue-100">
        <div className="px-6 md:px-10 py-3 max-w-7xl mx-auto">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-stone-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher une offre…"
              className="w-full pl-10 pr-3 py-2 rounded-xl bg-blue-50/40 border border-blue-100 text-sm text-[#0A0E27] focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 outline-none placeholder:text-stone-400"
            />
          </div>
        </div>
      </div>

      {/* List */}
      <div className="px-6 md:px-10 py-6 max-w-7xl mx-auto">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="size-6 text-blue-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState onCreate={() => setCreating(true)} hasSearch={!!search} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(f => (
              <FormulaCard
                key={f.id}
                formula={f}
                onEdit={() => setEditing(f)}
                onDelete={() => handleDelete(f.id)}
                onToggleActive={() => handleToggleActive(f)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {(creating || editing) && (
        <FormulaModal
          formula={editing}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSave={async (payload) => {
            if (editing) {
              await handleUpdate(editing.id, payload)
            } else {
              await handleCreate(payload)
            }
          }}
        />
      )}
    </div>
  )
}

// ── Card ──

function FormulaCard({
  formula, onEdit, onDelete, onToggleActive,
}: {
  formula: Formula
  onEdit: () => void
  onDelete: () => void
  onToggleActive: () => void
}) {
  const [menu, setMenu] = useState(false)
  const isQuote = formula.billing_type === 'quote'
  const isSub = formula.billing_type === 'subscription'

  return (
    <div className={`group relative rounded-2xl border bg-white p-5 transition-all hover:shadow-lg hover:shadow-blue-500/10 hover:border-blue-200 ${formula.is_active ? 'border-blue-100' : 'border-stone-200 opacity-70'}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${formula.is_active ? 'bg-gradient-to-br from-[#3B82F6] to-[#60A5FA] shadow-sm shadow-blue-500/20' : 'bg-stone-100'}`}>
            <Package className={`size-4 ${formula.is_active ? 'text-white' : 'text-stone-400'}`} />
          </div>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
            formula.billing_type === 'one_time' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : formula.billing_type === 'quote' ? 'bg-amber-50 text-amber-700 border-amber-200'
            : 'bg-violet-50 text-violet-700 border-violet-200'
          }`}>
            {billingLabel(formula.billing_type, formula.billing_interval)}
          </span>
        </div>
        <div className="relative">
          <button
            onClick={() => setMenu(o => !o)}
            className="p-1.5 rounded-lg text-stone-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <MoreHorizontal className="size-4" />
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-xl bg-white border border-blue-100 shadow-xl shadow-blue-500/10 py-1">
                <button onClick={() => { onEdit(); setMenu(false) }} className="w-full flex items-center gap-2 text-left px-3 py-2 text-xs font-semibold hover:bg-blue-50 text-[#0A0E27]">
                  <Pencil className="size-3.5 text-blue-600" /> Modifier
                </button>
                <button onClick={() => { onToggleActive(); setMenu(false) }} className="w-full flex items-center gap-2 text-left px-3 py-2 text-xs font-semibold hover:bg-blue-50 text-[#0A0E27]">
                  <Sparkles className="size-3.5 text-blue-600" />
                  {formula.is_active ? 'Désactiver' : 'Activer'}
                </button>
                <button onClick={() => { onDelete(); setMenu(false) }} className="w-full flex items-center gap-2 text-left px-3 py-2 text-xs font-semibold hover:bg-red-50 text-red-600">
                  <Trash2 className="size-3.5" /> Supprimer
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Name + price */}
      <h3 className="text-lg font-bold text-[#0A0E27] mb-1 line-clamp-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
        {formula.name}
      </h3>
      {formula.description && (
        <p className="text-xs text-stone-500 mb-3 line-clamp-2">{formula.description}</p>
      )}

      <div className="flex items-baseline gap-1 mb-3">
        {isQuote ? (
          <span className="text-2xl font-extrabold text-[#0A0E27] tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>Sur devis</span>
        ) : (
          <>
            <span className="text-3xl font-extrabold text-[#0A0E27] tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {(formula.price || 0).toLocaleString('fr-FR')}€
            </span>
            {isSub && (
              <span className="text-xs font-medium text-stone-500">{billingShort(formula.billing_type, formula.billing_interval)}</span>
            )}
          </>
        )}
      </div>

      {/* Resources */}
      {formula.resources && formula.resources.length > 0 && (
        <div className="pt-3 border-t border-blue-50">
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2">{formula.resources.length} ressource{formula.resources.length > 1 ? 's' : ''}</p>
          <div className="flex flex-col gap-1">
            {formula.resources.slice(0, 3).map((r, i) => (
              <a
                key={i}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 truncate"
              >
                <Link2 className="size-3 shrink-0" /> <span className="truncate">{r.name}</span>
              </a>
            ))}
            {formula.resources.length > 3 && (
              <span className="text-[10px] text-stone-400">+ {formula.resources.length - 3} autres</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Modal Create/Edit ──

function FormulaModal({
  formula, onClose, onSave,
}: {
  formula: Formula | null
  onClose: () => void
  onSave: (payload: Partial<Formula>) => Promise<void>
}) {
  const [name, setName] = useState(formula?.name || '')
  const [description, setDescription] = useState(formula?.description || '')
  const [price, setPrice] = useState(formula?.price ? String(formula.price) : '')
  const [billingKey, setBillingKey] = useState<string>(() => {
    if (!formula) return 'one_time|null'
    return `${formula.billing_type}|${formula.billing_interval || 'null'}`
  })
  const [resources, setResources] = useState<Resource[]>(formula?.resources || [])
  const [saving, setSaving] = useState(false)

  const billing = useMemo(() => {
    const [type, interval] = billingKey.split('|')
    return {
      billing_type: type as BillingType,
      billing_interval: (interval === 'null' ? null : interval) as BillingInterval,
    }
  }, [billingKey])

  const isQuote = billing.billing_type === 'quote'
  const canSave = name.trim() && (isQuote || Number(price) > 0) && !saving

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        price: isQuote ? 0 : Number(price) || 0,
        billing_type: billing.billing_type,
        billing_interval: billing.billing_interval,
        resources,
      })
    } finally {
      setSaving(false)
    }
  }

  const addResource = () => setResources([...resources, { name: '', url: '', type: 'link' }])
  const updateResource = (i: number, patch: Partial<Resource>) => setResources(resources.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  const removeResource = (i: number) => setResources(resources.filter((_, idx) => idx !== i))

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0A0E27]/60 backdrop-blur-md p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl rounded-3xl bg-white shadow-2xl shadow-blue-500/20 ring-1 ring-blue-100 overflow-hidden animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-gradient-to-br from-[#3B82F6]/15 to-[#60A5FA]/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="relative shrink-0 px-6 py-5 border-b border-blue-100 bg-gradient-to-b from-blue-50/30 to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#60A5FA] flex items-center justify-center shadow-md shadow-blue-500/30">
                <Package className="size-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#0A0E27]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {formula ? 'Modifier l\'offre' : 'Nouvelle offre'}
                </h3>
                <p className="text-xs text-stone-500">Définissez le contenu et le mode de facturation</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-blue-50 text-stone-500 hover:text-blue-600 transition-colors">
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Name */}
          <ModalField label="Nom de l'offre *">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex : Coaching premium 3 mois"
              className="w-full px-3 py-2.5 rounded-xl bg-blue-50/40 border border-blue-100 text-sm text-[#0A0E27] focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 outline-none transition-all"
            />
          </ModalField>

          {/* Description */}
          <ModalField label="Description">
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ce que contient l'offre, ce qui est inclus, qui c'est pour…"
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl bg-blue-50/40 border border-blue-100 text-sm text-[#0A0E27] focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 outline-none resize-none transition-all"
            />
          </ModalField>

          {/* Billing type — visual selector */}
          <ModalField label="Mode de facturation *">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {BILLING_OPTIONS.map(opt => {
                const key = `${opt.key}|${opt.interval || 'null'}`
                const isActive = billingKey === key
                return (
                  <button
                    key={key}
                    onClick={() => setBillingKey(key)}
                    className={`relative px-3 py-3 rounded-xl border text-left transition-all ${
                      isActive
                        ? 'bg-gradient-to-br from-[#3B82F6]/10 to-[#60A5FA]/10 border-blue-400 shadow-md shadow-blue-500/15'
                        : 'bg-white border-blue-100 hover:border-blue-200 hover:bg-blue-50/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">{opt.icon}</span>
                      <span className={`text-xs font-bold ${isActive ? 'text-blue-700' : 'text-[#0A0E27]'}`}>{opt.label}</span>
                    </div>
                    <span className="text-[10px] text-stone-500">{opt.short}</span>
                    {isActive && (
                      <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500" />
                    )}
                  </button>
                )
              })}
            </div>
          </ModalField>

          {/* Price */}
          {!isQuote && (
            <ModalField label={`Prix ${billingShort(billing.billing_type, billing.billing_interval) || ''} (€) *`}>
              <input
                type="number"
                min={0}
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2.5 rounded-xl bg-blue-50/40 border border-blue-100 text-sm text-[#0A0E27] focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 outline-none transition-all"
              />
            </ModalField>
          )}

          {/* Resources */}
          <ModalField label="Ressources livrées (optionnel)">
            <div className="space-y-2">
              {resources.map((r, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                  <input
                    value={r.name}
                    onChange={e => updateResource(i, { name: e.target.value })}
                    placeholder="Nom (ex : Vidéo module 1)"
                    className="px-3 py-2 rounded-lg bg-blue-50/40 border border-blue-100 text-xs text-[#0A0E27] focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 outline-none"
                  />
                  <input
                    value={r.url}
                    onChange={e => updateResource(i, { url: e.target.value })}
                    placeholder="URL"
                    className="px-3 py-2 rounded-lg bg-blue-50/40 border border-blue-100 text-xs text-[#0A0E27] focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 outline-none"
                  />
                  <button
                    onClick={() => removeResource(i)}
                    className="p-2 rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
              <button
                onClick={addResource}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-blue-200 text-xs font-bold text-blue-600 hover:bg-blue-50 transition-colors"
              >
                <Plus className="size-3.5" /> Ajouter une ressource
              </button>
            </div>
          </ModalField>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-blue-100 bg-white px-6 py-3 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-full text-sm font-bold text-stone-600 hover:bg-stone-100 transition-colors">
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] hover:from-[#2563EB] hover:to-[#3B82F6] text-white text-sm font-bold shadow-md shadow-blue-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {formula ? 'Enregistrer' : 'Créer l\'offre'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── helpers ──

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent: string }) {
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
        {hasSearch ? <Search className="size-6 text-white" /> : <Package className="size-6 text-white" />}
      </div>
      <h3 className="text-xl font-bold text-[#0A0E27] mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
        {hasSearch ? 'Aucun résultat' : 'Aucune offre pour l\'instant'}
      </h3>
      <p className="text-sm text-stone-500 mb-6 max-w-sm mx-auto">
        {hasSearch
          ? 'Essayez de modifier votre recherche.'
          : 'Créez votre première offre : pack, abonnement, prestation sur devis…'}
      </p>
      {!hasSearch && (
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] hover:from-[#2563EB] hover:to-[#3B82F6] text-white text-sm font-bold shadow-md shadow-blue-500/25 transition-all"
        >
          <Sparkles className="size-4" />
          Créer ma première offre
        </button>
      )}
    </div>
  )
}
