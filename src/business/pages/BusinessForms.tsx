import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessLang } from '../i18n/BusinessLangContext'
import { getFormsTranslations } from '../i18n/formsI18n'
import { FormBlockEditor } from '../components/FormBlockEditor'
import { FormResponsesModal } from '../components/FormResponsesModal'
import {
  Plus, FileText, Loader2, ArrowLeft, Check, Copy, Trash2,
  ExternalLink, Inbox, AlertTriangle, Files,
} from 'lucide-react'
import {
  normalizeBlocks, normalizeSettings, guessCrmMapping, isInputBlock, blockLabel,
  type FormBlock, type FormSettings, type CrmMapping,
} from '../../lib/formBlocks'
import toast from 'react-hot-toast'

const API_URL = '/api/business-forms'

interface FormRow {
  id: string
  name: string
  description: string | null
  slug: string
  blocks: FormBlock[]
  settings: FormSettings
  is_active: boolean
  crm_enabled: boolean
  crm_mapping: CrmMapping
  crm_source: string | null
  crm_stage: string | null
  crm_campaign_id: string | null
  notify_enabled: boolean
  notify_email: string | null
  created_at: string
  business_form_responses?: { count: number }[]
}

interface CampaignOption {
  id: string
  name: string
}

/** Étapes du pipeline Business pouvant servir de point d'entrée. */
const ENTRY_STAGES = [
  { id: 'prospect', fr: 'Prospect', en: 'Prospect' },
  { id: 'contacted', fr: 'Contacté', en: 'Contacted' },
  { id: 'qualified', fr: 'Qualifié', en: 'Qualified' },
]

const ACCENT_PRESETS = ['#006c49', '#1b1c1b', '#0284c7', '#a03cf8', '#ff4b72', '#ffb95f']

/**
 * Erreur portant la raison de l'échec, pour distinguer « la route n'existe pas »
 * (réponse HTML du fallback SPA) d'une vraie erreur applicative.
 */
type ApiFailure = 'api_missing' | 'request_failed'

class ApiError extends Error {
  reason: ApiFailure

  constructor(reason: ApiFailure, message?: string) {
    super(message || reason)
    this.reason = reason
  }
}

/** fetch + parse JSON strict : une réponse non-JSON signale une route absente. */
async function fetchJson(url: string, init?: RequestInit): Promise<any> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch {
    throw new ApiError('request_failed')
  }

  const text = await res.text()
  let data: any
  try {
    data = JSON.parse(text)
  } catch {
    // Le proxy a renvoyé la page HTML : la fonction serverless n'est pas déployée
    throw new ApiError('api_missing')
  }

  if (!res.ok) throw new ApiError('request_failed', data?.error)
  return data
}

/** Normalise une ligne venue de l'API (les jsonb peuvent être partiels). */
function hydrate(raw: any): FormRow {
  return {
    ...raw,
    blocks: normalizeBlocks(raw.blocks),
    settings: normalizeSettings(raw.settings),
    crm_mapping: { name: null, email: null, phone: null, ...(raw.crm_mapping || {}) },
  }
}

export function BusinessForms() {
  const { user, ownerUserId } = useBusinessAuth()
  const { lang } = useBusinessLang()
  const t = getFormsTranslations(lang)
  const effectiveUserId = ownerUserId || user?.id

  const [forms, setForms] = useState<FormRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<ApiFailure | null>(null)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [responsesFor, setResponsesFor] = useState<FormRow | null>(null)

  const fetchForms = useCallback(async () => {
    if (!effectiveUserId) return
    setLoading(true)
    setLoadError(null)
    try {
      const data = await fetchJson(`${API_URL}?action=forms-list&user_id=${effectiveUserId}`)
      setForms((data.forms || []).map(hydrate))
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.reason : 'request_failed')
    } finally {
      setLoading(false)
    }
  }, [effectiveUserId])

  useEffect(() => { fetchForms() }, [fetchForms])

  const createForm = async () => {
    if (!effectiveUserId) return
    setCreating(true)
    try {
      const data = await fetchJson(`${API_URL}?action=forms-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: effectiveUserId, name: t.new_form_name }),
      })
      const created = hydrate(data.form)
      setForms(prev => [created, ...prev])
      setEditingId(created.id)
    } catch {
      toast.error(t.save_error)
    } finally {
      setCreating(false)
    }
  }

  const duplicateForm = async (form: FormRow) => {
    if (!effectiveUserId) return
    try {
      const data = await fetchJson(`${API_URL}?action=forms-duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: effectiveUserId, id: form.id }),
      })
      setForms(prev => [hydrate(data.form), ...prev])
      toast.success(t.duplicate)
    } catch {
      toast.error(t.save_error)
    }
  }

  const deleteForm = async (form: FormRow) => {
    if (!effectiveUserId || !confirm(t.delete_confirm)) return
    try {
      await fetchJson(`${API_URL}?action=forms-delete&id=${form.id}&user_id=${effectiveUserId}`, {
        method: 'DELETE',
      })
      setForms(prev => prev.filter(f => f.id !== form.id))
    } catch {
      toast.error(t.save_error)
    }
  }

  const editing = forms.find(f => f.id === editingId) || null

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-[#444748] animate-spin" />
      </div>
    )
  }

  // Échec de chargement : on n'affiche surtout pas l'état vide, qui laisserait
  // croire qu'il n'y a aucun formulaire et inviterait à une création vouée à échouer.
  if (loadError) {
    const isMissing = loadError === 'api_missing'
    return (
      <div className="max-w-[1200px] mx-auto pb-12">
        <header className="mb-10">
          <h2 className="text-5xl font-['Manrope'] font-extrabold tracking-tight text-[#1b1c1b] dark:text-white">
            {t.title}
          </h2>
        </header>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-[#ffb95f]/10 rounded-full flex items-center justify-center mb-6">
            <AlertTriangle className="h-8 w-8 text-[#b87500]" />
          </div>
          <h3 className="text-2xl font-['Manrope'] font-extrabold text-[#1b1c1b] dark:text-white mb-2">
            {isMissing ? t.api_missing_title : t.load_error_title}
          </h3>
          <p className="text-[#444748] dark:text-neutral-400 max-w-md mb-6 font-['Inter']">
            {isMissing ? t.api_missing_desc : t.load_error_desc}
          </p>
          <button
            onClick={fetchForms}
            className="bg-[#000000] text-white px-8 py-3 rounded-full font-['Manrope'] font-bold active:scale-95 transition-all"
          >
            {t.retry}
          </button>
        </div>
      </div>
    )
  }

  if (editing && effectiveUserId) {
    return (
      <FormEditorView
        key={editing.id}
        form={editing}
        userId={effectiveUserId}
        t={t}
        lang={lang}
        onBack={() => setEditingId(null)}
        onSaved={saved => setForms(prev => prev.map(f => (f.id === saved.id ? { ...f, ...saved } : f)))}
        onOpenResponses={() => setResponsesFor(editing)}
      />
    )
  }

  return (
    <div className="max-w-[1200px] mx-auto space-y-10 pb-12">
      <header className="flex justify-between items-end gap-6">
        <div>
          <h2 className="text-5xl font-['Manrope'] font-extrabold tracking-tight text-[#1b1c1b] dark:text-white">
            {t.title}
          </h2>
          <p className="text-[#444748] dark:text-neutral-400 mt-2 max-w-lg">{t.subtitle}</p>
        </div>
        <button
          onClick={createForm}
          disabled={creating}
          className="bg-[#000000] text-white px-8 py-4 rounded-full font-['Manrope'] font-bold flex items-center gap-3 hover:bg-[#1b1c1b] transition-all active:scale-95 disabled:opacity-60 whitespace-nowrap"
          style={{ boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {t.new_form}
        </button>
      </header>

      {forms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-24 h-24 bg-[#efedec] dark:bg-neutral-800 rounded-full flex items-center justify-center mb-6">
            <FileText className="h-10 w-10 text-[#444748]/30" />
          </div>
          <h3 className="text-2xl font-['Manrope'] font-extrabold text-[#1b1c1b] dark:text-white mb-2">
            {t.empty_title}
          </h3>
          <p className="text-[#444748] dark:text-neutral-400 max-w-xs mb-6">{t.empty_desc}</p>
          <button
            onClick={createForm}
            disabled={creating}
            className="bg-[#000000] text-white px-8 py-3 rounded-full font-['Manrope'] font-bold active:scale-95 transition-all disabled:opacity-60"
          >
            {t.create_first}
          </button>
        </div>
      ) : (
        <div className="grid gap-8 xl:grid-cols-2">
          {forms.map(form => {
            const count = form.business_form_responses?.[0]?.count || 0
            const fieldCount = form.blocks.filter(b => isInputBlock(b.type)).length
            return (
              <div
                key={form.id}
                className="rounded-xl p-8 group hover:shadow-[0_30px_60px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_30px_60px_rgba(0,0,0,0.3)] transition-all duration-500 bg-white/70 dark:bg-neutral-800 backdrop-blur-xl border border-[#c4c7c7]/20 dark:border-neutral-700"
              >
                <div className="flex justify-between items-start mb-6 gap-4">
                  <div className="flex gap-4 items-center min-w-0">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: `${form.settings.accent_color}1a`,
                        color: form.settings.accent_color,
                      }}
                    >
                      <FileText className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xl font-['Manrope'] font-extrabold text-[#1b1c1b] dark:text-white truncate">
                        {form.name || t.untitled}
                      </h3>
                      <p className="text-sm text-[#444748] dark:text-neutral-400">
                        {fieldCount} {fieldCount > 1 ? 'champs' : 'champ'}
                        {form.crm_enabled && ' · CRM'}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-tighter whitespace-nowrap ${
                      form.is_active ? 'text-[#006c49]' : 'text-[#444748]'
                    }`}
                  >
                    {form.is_active ? t.active : t.inactive}
                  </span>
                </div>

                {form.description && (
                  <p className="text-[#444748] dark:text-neutral-400 mb-6 line-clamp-2">{form.description}</p>
                )}

                <div className="flex gap-3 mb-6">
                  <button
                    onClick={() => setResponsesFor(form)}
                    className="bg-[#eae8e7] dark:bg-neutral-800 px-4 py-2 rounded-full flex items-center gap-2 hover:bg-[#e0dedd] dark:hover:bg-neutral-700 transition-colors"
                  >
                    <Inbox className="h-3.5 w-3.5 text-[#444748]" />
                    <span className="text-xs font-bold text-[#444748] dark:text-neutral-300">
                      {count} {count === 1 ? t.response_one : t.response_many}
                    </span>
                  </button>
                </div>

                <div className="flex items-center gap-2 pt-6 border-t border-[#c4c7c7]/10 dark:border-neutral-700/30">
                  <button
                    onClick={() => setEditingId(form.id)}
                    className="flex-1 bg-[#000000] text-white py-3 rounded-xl font-['Manrope'] font-bold text-xs hover:bg-[#1b1c1b] transition-colors"
                  >
                    {t.edit}
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/f/${form.slug}`)
                      toast.success(t.link_copied)
                    }}
                    className="flex-1 bg-[#f5f3f2] dark:bg-neutral-800 text-[#1b1c1b] dark:text-white py-3 rounded-xl font-['Manrope'] font-bold text-xs hover:bg-[#eae8e7] dark:hover:bg-neutral-700 transition-colors"
                  >
                    {t.copy_link}
                  </button>
                  <a
                    href={`/f/${form.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 text-[#444748] dark:text-neutral-400 hover:text-[#1b1c1b] dark:hover:text-white hover:bg-[#f5f3f2] dark:hover:bg-neutral-800 rounded-xl transition-colors"
                    title={t.preview}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <button
                    onClick={() => duplicateForm(form)}
                    className="p-3 text-[#444748] dark:text-neutral-400 hover:text-[#1b1c1b] dark:hover:text-white hover:bg-[#f5f3f2] dark:hover:bg-neutral-800 rounded-xl transition-colors"
                    title={t.duplicate}
                  >
                    <Files className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => deleteForm(form)}
                    className="p-3 text-[#444748] hover:text-[#ba1a1a] hover:bg-[#ffdad6]/30 rounded-xl transition-colors"
                    title={t.delete}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {responsesFor && effectiveUserId && (
        <FormResponsesModal
          formId={responsesFor.id}
          formName={responsesFor.name}
          blocks={responsesFor.blocks}
          userId={effectiveUserId}
          onClose={() => setResponsesFor(null)}
        />
      )}
    </div>
  )
}

// ─── Éditeur plein écran ───

type Tab = 'content' | 'settings' | 'crm' | 'share'

function FormEditorView({
  form, userId, t, lang, onBack, onSaved, onOpenResponses,
}: {
  form: FormRow
  userId: string
  t: ReturnType<typeof getFormsTranslations>
  lang: string
  onBack: () => void
  onSaved: (form: FormRow) => void
  onOpenResponses: () => void
}) {
  const [draft, setDraft] = useState<FormRow>(form)
  const [tab, setTab] = useState<Tab>('content')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([])

  const draftRef = useRef(draft)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { draftRef.current = draft }, [draft])

  // Campagnes pour le rattachement CRM
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch(`/api/business?action=campaigns-list&user_id=${userId}`)
        const data = await res.json()
        if (res.ok) setCampaigns((data.campaigns || []).map((c: any) => ({ id: c.id, name: c.name })))
      } catch {
        // Le rattachement à une campagne est optionnel : on n'alerte pas.
      }
    })()
  }, [userId])

  const save = useCallback(async () => {
    const d = draftRef.current
    try {
      await fetchJson(`${API_URL}?action=forms-update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          id: d.id,
          name: d.name,
          description: d.description,
          blocks: d.blocks,
          settings: d.settings,
          is_active: d.is_active,
          crm_enabled: d.crm_enabled,
          crm_mapping: d.crm_mapping,
          crm_source: d.crm_source,
          crm_stage: d.crm_stage,
          crm_campaign_id: d.crm_campaign_id,
          notify_enabled: d.notify_enabled,
          notify_email: d.notify_email,
        }),
      })
      setSaveState('saved')
      onSaved(d)
    } catch {
      setSaveState('error')
      toast.error(t.save_error)
    }
  }, [userId, onSaved, t.save_error])

  /** Enregistrement automatique différé (1 s après la dernière frappe). */
  const patch = useCallback((updates: Partial<FormRow>) => {
    setDraft(prev => ({ ...prev, ...updates }))
    setSaveState('saving')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(save, 1000)
  }, [save])

  // Enregistre les modifications en attente si l'on quitte l'éditeur.
  // `save` passe par une ref : l'effet ne doit se déclencher qu'au démontage,
  // pas à chaque changement d'identité de la fonction.
  const saveRef = useRef(save)
  useEffect(() => { saveRef.current = save }, [save])
  useEffect(() => () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      saveRef.current()
    }
  }, [])

  const patchSettings = (updates: Partial<FormSettings>) =>
    patch({ settings: { ...draft.settings, ...updates } })

  const inputFields = useMemo(
    () => draft.blocks.filter(b => isInputBlock(b.type)).map((b, i) => ({ id: b.id, label: blockLabel(b, i) })),
    [draft.blocks],
  )

  const publicUrl = `${window.location.origin}/f/${draft.slug}`
  const embedCode = `<iframe src="${publicUrl}?embed=true" width="100%" height="800" style="border:0;" title="${draft.name}"></iframe>`

  const copy = (value: string) => {
    navigator.clipboard.writeText(value)
    toast.success(t.copied)
  }

  const labelCls = "block text-[10px] font-black uppercase tracking-[0.2em] text-[#747878] dark:text-neutral-500 mb-3"
  const inputCls = "w-full bg-transparent border-b border-[#c4c7c7]/30 dark:border-neutral-700 py-2.5 text-sm text-[#1b1c1b] dark:text-white placeholder:text-[#444748]/40 dark:placeholder:text-neutral-500 focus:border-[#006c49] focus:ring-0 outline-none transition-all font-['Inter']"
  const selectCls = "w-full appearance-none bg-[#f5f3f2] dark:bg-neutral-800 rounded-xl border-0 px-4 py-2.5 text-sm text-[#1b1c1b] dark:text-white font-medium focus:ring-1 focus:ring-[#006c49]/20 focus:outline-none"

  return (
    <div className="max-w-[1000px] mx-auto pb-24">
      {/* Barre supérieure */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-['Manrope'] font-bold text-[#444748] dark:text-neutral-400 hover:bg-[#f5f3f2] dark:hover:bg-neutral-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> {t.back}
        </button>

        <div className="flex items-center gap-3">
          <SaveIndicator state={saveState} t={t} />
          <button
            onClick={() => patch({ is_active: !draft.is_active })}
            className="flex items-center gap-2"
            title={draft.is_active ? t.active : t.inactive}
          >
            <div
              className={`w-10 h-5 rounded-full relative p-1 cursor-pointer transition-colors ${
                draft.is_active ? 'bg-[#006c49]/20' : 'bg-[#eae8e7] dark:bg-neutral-700'
              }`}
            >
              <div
                className={`w-3 h-3 rounded-full absolute transition-all ${
                  draft.is_active ? 'bg-[#006c49] right-1' : 'bg-[#747878] left-1'
                }`}
              />
            </div>
            <span className={`text-[10px] font-bold uppercase ${draft.is_active ? 'text-[#006c49]' : 'text-[#444748]'}`}>
              {draft.is_active ? t.active : t.inactive}
            </span>
          </button>
          <button
            onClick={onOpenResponses}
            className="flex items-center gap-2 bg-[#f5f3f2] dark:bg-neutral-800 text-[#1b1c1b] dark:text-white px-4 py-2.5 rounded-xl font-['Manrope'] font-bold text-xs hover:bg-[#eae8e7] dark:hover:bg-neutral-700 transition-colors"
          >
            <Inbox className="h-3.5 w-3.5" /> {t.responses}
          </button>
          <a
            href={`/f/${draft.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-black text-white px-4 py-2.5 rounded-xl font-['Manrope'] font-bold text-xs hover:bg-[#1b1c1b] transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" /> {t.preview}
          </a>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-8 border-b border-[#c4c7c7]/20 dark:border-neutral-800 mb-10 overflow-x-auto">
        {([
          { key: 'content' as const, label: t.tab_content },
          { key: 'settings' as const, label: t.tab_settings },
          { key: 'crm' as const, label: t.tab_crm },
          { key: 'share' as const, label: t.tab_share },
        ]).map(item => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`pb-4 text-sm font-['Manrope'] font-bold transition-colors whitespace-nowrap ${
              tab === item.key
                ? 'border-b-2 border-[#000000] dark:border-white text-[#000000] dark:text-white'
                : 'text-[#444748] dark:text-neutral-400 hover:text-[#1b1c1b] dark:hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Contenu */}
      {tab === 'content' && (
        <div className="space-y-8">
          <div>
            <input
              type="text"
              value={draft.name}
              onChange={e => patch({ name: e.target.value })}
              placeholder={t.form_name}
              className="w-full bg-transparent border-0 p-0 text-4xl font-['Manrope'] font-extrabold tracking-tight text-[#1b1c1b] dark:text-white placeholder:text-[#444748]/25 focus:ring-0 outline-none"
            />
            <input
              type="text"
              value={draft.description || ''}
              onChange={e => patch({ description: e.target.value })}
              placeholder={t.form_description}
              className="w-full bg-transparent border-0 p-0 mt-3 text-base text-[#444748] dark:text-neutral-400 placeholder:text-[#444748]/30 focus:ring-0 outline-none font-['Inter']"
            />
          </div>

          <div className="border-t border-[#c4c7c7]/20 dark:border-neutral-800 pt-8">
            <FormBlockEditor
              blocks={draft.blocks}
              onChange={blocks => patch({ blocks })}
              accentColor={draft.settings.accent_color}
            />
          </div>
        </div>
      )}

      {/* Réglages */}
      {tab === 'settings' && (
        <div className="space-y-10 max-w-xl">
          <section>
            <label className={labelCls}>{t.settings_submit_label}</label>
            <input
              type="text"
              value={draft.settings.submit_label}
              onChange={e => patchSettings({ submit_label: e.target.value })}
              className={inputCls}
            />
          </section>

          <section>
            <label className={labelCls}>{t.settings_thankyou}</label>
            <div className="space-y-4">
              <input
                type="text"
                value={draft.settings.thankyou_title}
                onChange={e => patchSettings({ thankyou_title: e.target.value })}
                placeholder={t.settings_thankyou_title}
                className={inputCls}
              />
              <textarea
                rows={3}
                value={draft.settings.thankyou_text}
                onChange={e => patchSettings({ thankyou_text: e.target.value })}
                placeholder={t.settings_thankyou_text}
                className={`${inputCls} resize-y`}
              />
              <div>
                <input
                  type="url"
                  value={draft.settings.redirect_url || ''}
                  onChange={e => patchSettings({ redirect_url: e.target.value || null })}
                  placeholder={t.settings_redirect}
                  className={inputCls}
                />
                <p className="mt-2 text-xs text-[#444748]/60 dark:text-neutral-500 font-['Inter']">
                  {t.settings_redirect_hint}
                </p>
              </div>
            </div>
          </section>

          <section>
            <label className={labelCls}>{t.settings_display}</label>
            <div className="space-y-4">
              <Toggle
                checked={draft.settings.show_progress}
                onChange={v => patchSettings({ show_progress: v })}
                label={t.settings_progress}
                hint={t.settings_progress_hint}
              />
              <Toggle
                checked={draft.settings.one_at_a_time}
                onChange={v => patchSettings({ one_at_a_time: v })}
                label={t.settings_one_at_a_time}
                hint={t.settings_one_at_a_time_hint}
              />
            </div>
          </section>

          <section>
            <label className={labelCls}>{t.settings_accent}</label>
            <div className="flex items-center gap-3 flex-wrap">
              {ACCENT_PRESETS.map(color => (
                <button
                  key={color}
                  onClick={() => patchSettings({ accent_color: color })}
                  className={`w-9 h-9 rounded-full transition-transform hover:scale-110 ${
                    draft.settings.accent_color === color ? 'ring-2 ring-offset-2 ring-[#1b1c1b] dark:ring-white dark:ring-offset-neutral-900' : ''
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={color}
                />
              ))}
              <input
                type="color"
                value={draft.settings.accent_color}
                onChange={e => patchSettings({ accent_color: e.target.value })}
                className="w-9 h-9 rounded-full border-0 bg-transparent cursor-pointer"
              />
            </div>
          </section>

          <section>
            <label className={labelCls}>{t.notify_title}</label>
            <div className="space-y-4">
              <Toggle
                checked={draft.notify_enabled}
                onChange={v => patch({ notify_enabled: v })}
                label={t.notify_enable}
                hint={t.notify_enable_hint}
              />
              {draft.notify_enabled && (
                <div>
                  <input
                    type="email"
                    value={draft.notify_email || ''}
                    onChange={e => patch({ notify_email: e.target.value || null })}
                    placeholder={t.notify_email}
                    className={inputCls}
                  />
                  <p className="mt-2 text-xs text-[#444748]/60 dark:text-neutral-500 font-['Inter']">
                    {t.notify_email_hint}
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* CRM */}
      {tab === 'crm' && (
        <div className="space-y-10 max-w-xl">
          <Toggle
            checked={draft.crm_enabled}
            onChange={v => {
              // À la première activation, on propose une correspondance déduite des champs
              const mapping =
                v && !draft.crm_mapping.email && !draft.crm_mapping.phone && !draft.crm_mapping.name
                  ? guessCrmMapping(draft.blocks)
                  : draft.crm_mapping
              patch({ crm_enabled: v, crm_mapping: mapping })
            }}
            label={t.crm_enable}
            hint={t.crm_enable_hint}
          />

          {draft.crm_enabled && (
            <>
              <section>
                <label className={labelCls}>{t.crm_mapping}</label>
                {inputFields.length === 0 ? (
                  <p className="text-sm text-[#444748] dark:text-neutral-400 font-['Inter']">{t.crm_no_fields}</p>
                ) : (
                  <>
                    <p className="text-xs text-[#444748]/60 dark:text-neutral-500 mb-4 font-['Inter']">
                      {t.crm_mapping_hint}
                    </p>
                    <div className="space-y-4">
                      {([
                        { key: 'name' as const, label: t.crm_field_name },
                        { key: 'email' as const, label: t.crm_field_email },
                        { key: 'phone' as const, label: t.crm_field_phone },
                      ]).map(field => (
                        <div key={field.key} className="flex items-center gap-4">
                          <span className="w-32 text-sm font-bold text-[#1b1c1b] dark:text-white font-['Inter'] flex-shrink-0">
                            {field.label}
                          </span>
                          <select
                            value={draft.crm_mapping[field.key] || ''}
                            onChange={e =>
                              patch({ crm_mapping: { ...draft.crm_mapping, [field.key]: e.target.value || null } })
                            }
                            className={selectCls}
                          >
                            <option value="">{t.crm_none}</option>
                            {inputFields.map(f => (
                              <option key={f.id} value={f.id}>{f.label}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>

              <section>
                <label className={labelCls}>{t.crm_source}</label>
                <input
                  type="text"
                  value={draft.crm_source || ''}
                  onChange={e => patch({ crm_source: e.target.value || null })}
                  placeholder={draft.name}
                  className={inputCls}
                />
                <p className="mt-2 text-xs text-[#444748]/60 dark:text-neutral-500 font-['Inter']">
                  {t.crm_source_hint}
                </p>
              </section>

              <section>
                <label className={labelCls}>{t.crm_stage}</label>
                <select
                  value={draft.crm_stage || 'prospect'}
                  onChange={e => patch({ crm_stage: e.target.value })}
                  className={selectCls}
                >
                  {ENTRY_STAGES.map(stage => (
                    <option key={stage.id} value={stage.id}>{lang === 'en' ? stage.en : stage.fr}</option>
                  ))}
                </select>
              </section>

              <section>
                <label className={labelCls}>{t.crm_campaign}</label>
                <select
                  value={draft.crm_campaign_id || ''}
                  onChange={e => patch({ crm_campaign_id: e.target.value || null })}
                  className={selectCls}
                >
                  <option value="">{t.crm_campaign_none}</option>
                  {campaigns.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </section>
            </>
          )}
        </div>
      )}

      {/* Partage */}
      {tab === 'share' && (
        <div className="space-y-10 max-w-2xl">
          {!draft.is_active && (
            <div className="flex items-start gap-3 rounded-xl bg-[#ffb95f]/10 px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-[#b87500] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[#b87500] font-['Inter']">{t.share_inactive_warning}</p>
            </div>
          )}

          <section>
            <label className={labelCls}>{t.share_link}</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-[#f5f3f2] dark:bg-neutral-800 rounded-xl px-4 py-3 text-sm text-[#1b1c1b] dark:text-white font-mono truncate">
                {publicUrl}
              </code>
              <button
                onClick={() => copy(publicUrl)}
                className="flex items-center gap-2 bg-black text-white px-4 py-3 rounded-xl font-['Manrope'] font-bold text-xs hover:bg-[#1b1c1b] transition-colors whitespace-nowrap"
              >
                <Copy className="h-3.5 w-3.5" /> {t.copy}
              </button>
            </div>
            <p className="mt-2 text-xs text-[#444748]/60 dark:text-neutral-500 font-['Inter']">{t.share_link_hint}</p>
          </section>

          <section>
            <label className={labelCls}>{t.share_embed}</label>
            <div className="flex items-start gap-2">
              <code className="flex-1 bg-[#f5f3f2] dark:bg-neutral-800 rounded-xl px-4 py-3 text-xs text-[#1b1c1b] dark:text-white font-mono break-all">
                {embedCode}
              </code>
              <button
                onClick={() => copy(embedCode)}
                className="flex items-center gap-2 bg-black text-white px-4 py-3 rounded-xl font-['Manrope'] font-bold text-xs hover:bg-[#1b1c1b] transition-colors whitespace-nowrap"
              >
                <Copy className="h-3.5 w-3.5" /> {t.copy}
              </button>
            </div>
            <p className="mt-2 text-xs text-[#444748]/60 dark:text-neutral-500 font-['Inter']">{t.share_embed_hint}</p>
          </section>
        </div>
      )}
    </div>
  )
}

// ─── Petits composants ───

function SaveIndicator({ state, t }: { state: 'idle' | 'saving' | 'saved' | 'error'; t: ReturnType<typeof getFormsTranslations> }) {
  if (state === 'idle') return null
  if (state === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-[#444748]/60 dark:text-neutral-500 font-['Inter']">
        <Loader2 className="h-3 w-3 animate-spin" /> {t.saving}
      </span>
    )
  }
  if (state === 'error') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-[#ba1a1a] font-['Inter'] font-bold">
        <AlertTriangle className="h-3 w-3" /> {t.save_error}
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-[#006c49] font-['Inter']">
      <Check className="h-3 w-3" /> {t.saved}
    </span>
  )
}

function Toggle({
  checked, onChange, label, hint,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <button onClick={() => onChange(!checked)} className="flex items-start gap-4 text-left w-full group">
      <div
        className={`w-10 h-5 rounded-full relative p-1 flex-shrink-0 mt-0.5 transition-colors ${
          checked ? 'bg-[#006c49]/20' : 'bg-[#eae8e7] dark:bg-neutral-700'
        }`}
      >
        <div
          className={`w-3 h-3 rounded-full absolute transition-all ${
            checked ? 'bg-[#006c49] right-1' : 'bg-[#747878] left-1'
          }`}
        />
      </div>
      <div>
        <p className="text-sm font-bold text-[#1b1c1b] dark:text-white font-['Inter']">{label}</p>
        {hint && <p className="text-xs text-[#444748]/60 dark:text-neutral-500 mt-0.5 font-['Inter']">{hint}</p>}
      </div>
    </button>
  )
}
