import { useMemo, useState } from 'react'
import {
  Plus, Search, Megaphone, Sparkles, ExternalLink, X,
  Save, Loader2, Power, Pencil, Trash2, MoreHorizontal, Copy, Check,
} from 'lucide-react'
import { useCRMProspects, type CRMCampaign } from '../contexts/CRMProspectsContext'
import toast from 'react-hot-toast'

const CAPTURE_MODES = [
  { id: 'form', label: 'Formulaire', desc: 'Capture simple : email, nom, téléphone' },
  { id: 'booking', label: 'Booking', desc: 'Prise de RDV directe avec calendrier' },
  { id: 'questionnaire', label: 'Questionnaire', desc: 'Qualification avec questions custom' },
] as const

export default function CRMCampaigns() {
  const { campaigns, formulas, loading, addCampaign, updateCampaign, deleteCampaign } = useCRMProspects()
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<CRMCampaign | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return campaigns.filter(c => !q || c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q))
  }, [campaigns, search])

  const stats = useMemo(() => {
    const total = campaigns.length
    const active = campaigns.filter(c => c.is_active).length
    const leads = campaigns.reduce((s, c) => s + (c.leads_count || 0), 0)
    return { total, active, leads }
  }, [campaigns])

  const handleCopyLink = (slug: string) => {
    const url = `${window.location.origin}/c/${slug}`
    navigator.clipboard.writeText(url)
    setCopiedId(slug)
    toast.success('Lien copié')
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleToggle = async (c: CRMCampaign) => {
    await updateCampaign(c.id, { is_active: !c.is_active })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette campagne ?')) return
    await deleteCampaign(id)
    toast.success('Campagne supprimée')
  }

  return (
    <div className="min-h-full bg-white">
      <div className="border-b border-blue-100 bg-gradient-to-b from-blue-50/30 to-white">
        <div className="px-6 md:px-10 pt-8 pb-6 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-600 mb-2">Campagnes</p>
              <h1 className="text-3xl md:text-4xl font-bold text-[#0A0E27] tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Vos pages de capture
              </h1>
              <p className="text-stone-500 text-sm mt-1">
                Formulaires, bookings, questionnaires — chaque campagne a son lien public.
              </p>
            </div>
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] hover:from-[#2563EB] hover:to-[#3B82F6] text-white text-sm font-bold shadow-md shadow-blue-500/25 hover:-translate-y-0.5 transition-all"
            >
              <Plus className="size-4" />
              Nouvelle campagne
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Stat label="Total" value={stats.total} accent="text-[#0A0E27]" />
            <Stat label="Actives" value={stats.active} accent="text-blue-600" />
            <Stat label="Leads captés" value={stats.leads} accent="text-emerald-600" />
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
              placeholder="Rechercher une campagne…"
              className="w-full pl-10 pr-3 py-2 rounded-xl bg-blue-50/40 border border-blue-100 text-sm text-[#0A0E27] focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 outline-none placeholder:text-stone-400"
            />
          </div>
        </div>
      </div>

      <div className="px-6 md:px-10 py-6 max-w-7xl mx-auto">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="size-6 text-blue-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState onCreate={() => setCreating(true)} hasSearch={!!search} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(c => (
              <CampaignCard
                key={c.id}
                campaign={c}
                copied={copiedId === c.slug}
                onCopy={() => handleCopyLink(c.slug)}
                onToggle={() => handleToggle(c)}
                onEdit={() => setEditing(c)}
                onDelete={() => handleDelete(c.id)}
              />
            ))}
          </div>
        )}
      </div>

      {(creating || editing) && (
        <CampaignModal
          campaign={editing}
          formulas={formulas}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSave={async (payload) => {
            if (editing) {
              await updateCampaign(editing.id, payload)
              toast.success('Campagne mise à jour')
            } else {
              const created = await addCampaign(payload)
              if (created) toast.success('Campagne créée')
            }
            setCreating(false)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function CampaignCard({
  campaign, copied, onCopy, onToggle, onEdit, onDelete,
}: {
  campaign: CRMCampaign
  copied: boolean
  onCopy: () => void
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [menu, setMenu] = useState(false)
  const mode = CAPTURE_MODES.find(m => m.id === campaign.capture_mode) || CAPTURE_MODES[0]

  return (
    <div className={`group relative rounded-2xl border bg-white p-5 transition-all hover:shadow-lg hover:shadow-blue-500/10 hover:border-blue-200 ${campaign.is_active ? 'border-blue-100' : 'border-stone-200 opacity-70'}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${campaign.is_active ? 'bg-gradient-to-br from-[#3B82F6] to-[#60A5FA] shadow-sm shadow-blue-500/20' : 'bg-stone-100'}`}>
            <Megaphone className={`size-4 ${campaign.is_active ? 'text-white' : 'text-stone-400'}`} />
          </div>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-blue-50 text-blue-700 border-blue-200">
            {mode.label}
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
                <button onClick={() => { onToggle(); setMenu(false) }} className="w-full flex items-center gap-2 text-left px-3 py-2 text-xs font-semibold hover:bg-blue-50 text-[#0A0E27]">
                  <Power className="size-3.5 text-blue-600" /> {campaign.is_active ? 'Désactiver' : 'Activer'}
                </button>
                <button onClick={() => { onDelete(); setMenu(false) }} className="w-full flex items-center gap-2 text-left px-3 py-2 text-xs font-semibold hover:bg-red-50 text-red-600">
                  <Trash2 className="size-3.5" /> Supprimer
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <h3 className="text-lg font-bold text-[#0A0E27] mb-1 line-clamp-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
        {campaign.name}
      </h3>
      {campaign.description && (
        <p className="text-xs text-stone-500 mb-3 line-clamp-2">{campaign.description}</p>
      )}

      <div className="flex items-center gap-3 mb-3 pt-3 border-t border-blue-50">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Leads</p>
          <p className="text-2xl font-extrabold text-[#0A0E27]" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {campaign.leads_count || 0}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={onCopy}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 transition-colors"
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            {copied ? 'Copié' : 'Lien'}
          </button>
          <a
            href={`/c/${campaign.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white text-[#0A0E27] border border-blue-100 hover:bg-blue-50 transition-colors"
          >
            <ExternalLink className="size-3" />
            Voir
          </a>
        </div>
      </div>
    </div>
  )
}

function CampaignModal({
  campaign, formulas, onClose, onSave,
}: {
  campaign: CRMCampaign | null
  formulas: { id: string; name: string }[]
  onClose: () => void
  onSave: (payload: Partial<CRMCampaign>) => Promise<void>
}) {
  const [name, setName] = useState(campaign?.name || '')
  const [slug, setSlug] = useState(campaign?.slug || '')
  const [description, setDescription] = useState(campaign?.description || '')
  const [captureMode, setCaptureMode] = useState(campaign?.capture_mode || 'form')
  const [formulaId, setFormulaId] = useState(campaign?.formula_id || '')
  const [redirectUrl, setRedirectUrl] = useState(campaign?.redirect_url || '')
  const [saving, setSaving] = useState(false)

  const computedSlug = slug.trim() || (name.trim() ? slugify(name) : '')

  const canSave = name.trim() && !saving

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        slug: computedSlug,
        description: description.trim() || null,
        capture_mode: captureMode,
        formula_id: formulaId || null,
        redirect_url: redirectUrl.trim() || null,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0A0E27]/60 backdrop-blur-md p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl rounded-3xl bg-white shadow-2xl shadow-blue-500/20 ring-1 ring-blue-100 overflow-hidden animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-gradient-to-br from-[#3B82F6]/15 to-[#60A5FA]/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative shrink-0 px-6 py-5 border-b border-blue-100 bg-gradient-to-b from-blue-50/30 to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#60A5FA] flex items-center justify-center shadow-md shadow-blue-500/30">
                <Megaphone className="size-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#0A0E27]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {campaign ? 'Modifier la campagne' : 'Nouvelle campagne'}
                </h3>
                <p className="text-xs text-stone-500">Page de capture pour vos prospects</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-blue-50 text-stone-500 hover:text-blue-600 transition-colors">
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <Field label="Nom de la campagne *">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex : Webinar mars 2026"
              className="w-full px-3 py-2.5 rounded-xl bg-blue-50/40 border border-blue-100 text-sm text-[#0A0E27] focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 outline-none transition-all"
            />
          </Field>

          <Field label="Slug (URL publique)">
            <div className="flex items-center gap-2">
              <span className="text-xs text-stone-500">/c/</span>
              <input
                value={slug || computedSlug}
                onChange={e => setSlug(slugify(e.target.value))}
                placeholder="webinar-mars"
                className="flex-1 px-3 py-2.5 rounded-xl bg-blue-50/40 border border-blue-100 text-sm text-[#0A0E27] focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 outline-none transition-all font-mono"
              />
            </div>
          </Field>

          <Field label="Description (visible sur la page)">
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ce que les visiteurs verront sur la page de capture…"
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl bg-blue-50/40 border border-blue-100 text-sm text-[#0A0E27] focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 outline-none resize-none transition-all"
            />
          </Field>

          <Field label="Type de capture *">
            <div className="grid grid-cols-3 gap-2">
              {CAPTURE_MODES.map(m => {
                const isActive = captureMode === m.id
                return (
                  <button
                    key={m.id}
                    onClick={() => setCaptureMode(m.id)}
                    className={`relative px-3 py-3 rounded-xl border text-left transition-all ${
                      isActive
                        ? 'bg-gradient-to-br from-[#3B82F6]/10 to-[#60A5FA]/10 border-blue-400 shadow-md shadow-blue-500/15'
                        : 'bg-white border-blue-100 hover:border-blue-200 hover:bg-blue-50/30'
                    }`}
                  >
                    <p className={`text-xs font-bold mb-1 ${isActive ? 'text-blue-700' : 'text-[#0A0E27]'}`}>{m.label}</p>
                    <p className="text-[10px] text-stone-500 leading-snug">{m.desc}</p>
                    {isActive && (
                      <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500" />
                    )}
                  </button>
                )
              })}
            </div>
          </Field>

          <Field label="Offre liée (optionnel)">
            <select
              value={formulaId}
              onChange={e => setFormulaId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-blue-50/40 border border-blue-100 text-sm text-[#0A0E27] focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 outline-none transition-all"
            >
              <option value="">— Aucune —</option>
              {formulas.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </Field>

          <Field label="URL de redirection après capture (optionnel)">
            <input
              value={redirectUrl}
              onChange={e => setRedirectUrl(e.target.value)}
              placeholder="https://votre-site.com/merci"
              className="w-full px-3 py-2.5 rounded-xl bg-blue-50/40 border border-blue-100 text-sm text-[#0A0E27] focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 outline-none transition-all"
            />
          </Field>
        </div>

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
            {campaign ? 'Enregistrer' : 'Créer la campagne'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
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
        {hasSearch ? <Search className="size-6 text-white" /> : <Megaphone className="size-6 text-white" />}
      </div>
      <h3 className="text-xl font-bold text-[#0A0E27] mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
        {hasSearch ? 'Aucun résultat' : 'Aucune campagne pour l\'instant'}
      </h3>
      <p className="text-sm text-stone-500 mb-6 max-w-sm mx-auto">
        {hasSearch
          ? 'Essayez de modifier votre recherche.'
          : 'Créez votre première page de capture pour récolter des prospects.'}
      </p>
      {!hasSearch && (
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] hover:from-[#2563EB] hover:to-[#3B82F6] text-white text-sm font-bold shadow-md shadow-blue-500/25 transition-all"
        >
          <Sparkles className="size-4" />
          Créer ma première campagne
        </button>
      )}
    </div>
  )
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
