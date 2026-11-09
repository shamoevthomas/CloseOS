import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Mail, Send, Users, RefreshCw, Link2, History, Search, Check, X, Loader2, Trash2, Save, Copy, Eye, Code2, Type, AlertTriangle, FlaskConical } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessProspects } from '../contexts/BusinessProspectsContext'
import { useBusinessLang } from '../i18n/BusinessLangContext'
import { useCustomStages } from '../hooks/useCustomStages'
import { renderEmail, prospectNames, EMAILING_MAX_RECIPIENTS, EMAILING_DAILY_LIMIT, type EmailMode } from '../../lib/businessEmailTemplate'

// Page Emailing : envoyer des emails aux prospects du CRM (via le Brevo de CloseOS, 100 destinataires max par envoi)
// et synchroniser les contacts vers un outil d'emailing (Brevo du client) ou les récupérer par API.

const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/

const BASE_STAGES = [
  { id: 'partial', fr: 'Incomplet', en: 'Incomplete' },
  { id: 'prospect', fr: 'Prospect', en: 'Prospect' },
  { id: 'contacted', fr: 'Contacté', en: 'Contacted' },
  { id: 'qualified', fr: 'Qualifié', en: 'Qualified' },
  { id: 'unqualified', fr: 'Non-Qualifié', en: 'Unqualified' },
  { id: 'followup', fr: 'Follow Up', en: 'Follow Up' },
  { id: 'noanswer', fr: 'Pas de Réponse', en: 'No answer' },
  { id: 'noshow', fr: 'No Show', en: 'No Show' },
  { id: 'won', fr: 'Gagné', en: 'Won' },
  { id: 'lost', fr: 'Perdu', en: 'Lost' },
]

const DEFAULT_TEXT = `Bonjour {{prenom}},

Écris ton message ici. Chaque paragraphe est séparé par une ligne vide.

Tu peux mettre un lien (https://closeos.fr) ou du **gras**.

À très vite,`

type Tab = 'send' | 'sync' | 'history'
type Member = { id: string; name: string }
type Group = { id: string; name: string; prospect_ids: number[] }

const card = 'rounded-2xl border border-[#c4c7c7]/20 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 sm:p-6'
const inputCls = 'w-full rounded-xl border border-[#c4c7c7]/30 dark:border-neutral-700 bg-[#f5f3f2] dark:bg-neutral-800 px-3 py-2.5 text-sm text-[#1b1c1b] dark:text-white placeholder:text-stone-400 focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49] outline-none'
const labelCls = 'mb-1.5 block text-[0.7rem] font-semibold uppercase tracking-widest text-stone-500 dark:text-neutral-400'
const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${on ? 'border-stone-900 bg-stone-900 text-white dark:border-white dark:bg-white dark:text-stone-900' : 'border-stone-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-stone-600 dark:text-neutral-300 hover:border-stone-400'}`

export function BusinessEmailing() {
  const { user, ownerUserId } = useBusinessAuth()
  const { prospects, loading } = useBusinessProspects()
  const { lang } = useBusinessLang()
  const { customStages } = useCustomStages()
  const L: 'fr' | 'en' = lang === 'fr' ? 'fr' : 'en'
  const tr = (fr: string, en: string) => (L === 'fr' ? fr : en)
  const ownerId = ownerUserId || user?.id || ''

  const [tab, setTab] = useState<Tab>('send')

  // ─── API (jeton de session + compte propriétaire) ───
  const api = useCallback(async (action: string, body?: any, method: 'GET' | 'POST' = 'POST') => {
    const { data: { session } } = await supabase.auth.getSession()
    const qs = new URLSearchParams({ action, owner_id: ownerId })
    const r = await fetch(`/api/business-emailing?${qs}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
      body: method === 'POST' ? JSON.stringify({ owner_id: ownerId, ...(body || {}) }) : undefined,
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(data?.error || `Erreur ${r.status}`)
    return data
  }, [ownerId])

  // ─── Équipe, tags, groupes ───
  const [members, setMembers] = useState<Member[]>([])
  const [tags, setTags] = useState<{ id: string; name: string; color: string }[]>([])
  const [prospectTags, setProspectTags] = useState<Record<number, string[]>>({})
  const [groups, setGroups] = useState<Group[]>([])
  const [groupsUnavailable, setGroupsUnavailable] = useState(false)

  const loadGroups = useCallback(async () => {
    if (!ownerId) return
    const { data, error } = await supabase.from('business_email_groups').select('id, name, prospect_ids').eq('owner_id', ownerId).order('created_at', { ascending: false })
    if (error) { setGroupsUnavailable(true); return }
    setGroupsUnavailable(false)
    setGroups((data || []).map((g: any) => ({ ...g, prospect_ids: (g.prospect_ids || []).map(Number) })))
  }, [ownerId])

  useEffect(() => {
    if (!ownerId) return
    Promise.all([
      supabase.from('business_team_members').select('id, first_name, last_name').eq('business_owner_id', ownerId),
      supabase.from('business_users').select('id, full_name').eq('id', ownerId).maybeSingle(),
      supabase.from('business_tags').select('id, name, color').eq('owner_id', ownerId),
      supabase.from('business_prospect_tags').select('prospect_id, tag_id'),
    ]).then(([tm, owner, tg, pt]) => {
      const list: Member[] = (tm.data || []).map((m: any) => ({ id: m.id, name: [m.first_name, m.last_name].filter(Boolean).join(' ') || 'Membre' }))
      if (owner.data) list.unshift({ id: owner.data.id, name: owner.data.full_name || tr('Propriétaire', 'Owner') })
      setMembers(list)
      setTags(tg.data || [])
      const map: Record<number, string[]> = {}
      ;(pt.data || []).forEach((r: any) => { (map[r.prospect_id] ||= []).push(r.tag_id) })
      setProspectTags(map)
    })
    loadGroups()
  }, [ownerId, loadGroups])

  const memberName = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m.name])), [members])

  // ─── Prospects joignables par email ───
  const reachable = useMemo(() => prospects.filter((p) => EMAIL_RE.test(String(p.email || '').trim())), [prospects])

  const stageOptions = useMemo(() => [
    ...BASE_STAGES.map((s) => ({ id: s.id, name: s[L] })),
    ...customStages.map((cs) => ({ id: `custom_${cs.id}`, name: cs.name })),
  ], [customStages, L])

  const setterIds = useMemo(() => [...new Set(reachable.map((p) => p.assigned_setter).filter(Boolean) as string[])], [reachable])
  const closerIds = useMemo(() => [...new Set(reachable.map((p) => p.assigned_to).filter(Boolean) as string[])], [reachable])

  // ─── Filtres + sélection ───
  const [fStages, setFStages] = useState<string[]>([])
  const [fTags, setFTags] = useState<string[]>([])
  const [fSetter, setFSetter] = useState('')
  const [fCloser, setFCloser] = useState('')
  const [fGroup, setFGroup] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [onlySelected, setOnlySelected] = useState(false)

  const toggleIn = (arr: string[], set: (v: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const group = groups.find((g) => g.id === fGroup)
    const groupIds = group ? new Set(group.prospect_ids) : null
    return reachable.filter((p) => {
      if (onlySelected && !selected.has(p.id)) return false
      if (fStages.length && !fStages.includes(p.stage)) return false
      if (fTags.length && !(prospectTags[p.id] || []).some((t) => fTags.includes(t))) return false
      if (fSetter && (fSetter === '__none' ? !!p.assigned_setter : p.assigned_setter !== fSetter)) return false
      if (fCloser && (fCloser === '__none' ? !!p.assigned_to : p.assigned_to !== fCloser)) return false
      if (groupIds && !groupIds.has(p.id)) return false
      if (q) {
        const hay = `${p.contact || ''} ${p.firstName || ''} ${p.lastName || ''} ${p.email || ''} ${p.company || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [reachable, fStages, fTags, fSetter, fCloser, fGroup, groups, search, prospectTags, onlySelected, selected])

  // Quota : 50 emails par jour et par compte (le serveur fait foi) → on ne peut pas sélectionner plus que ce qui reste
  const [quota, setQuota] = useState<{ sent: number; remaining: number } | null>(null)
  const loadQuota = useCallback(async () => {
    try { const q = await api('quota', undefined, 'GET'); setQuota({ sent: q.sent, remaining: q.remaining }) } catch { setQuota(null) }
  }, [api])
  useEffect(() => { if (ownerId) loadQuota() }, [ownerId, loadQuota])
  const cap = Math.min(EMAILING_MAX_RECIPIENTS, quota ? quota.remaining : EMAILING_DAILY_LIMIT)
  const capMsg = () => quota && quota.remaining < EMAILING_MAX_RECIPIENTS
    ? tr(`Il vous reste ${quota.remaining} email(s) aujourd'hui (limite ${EMAILING_DAILY_LIMIT} par jour)`, `${quota.remaining} email(s) left today (limit ${EMAILING_DAILY_LIMIT} per day)`)
    : tr(`Maximum ${EMAILING_MAX_RECIPIENTS} destinataires (limite ${EMAILING_DAILY_LIMIT} emails par jour)`, `Maximum ${EMAILING_MAX_RECIPIENTS} recipients (limit ${EMAILING_DAILY_LIMIT} emails per day)`)
  const toggleOne = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size >= cap) { toast.error(capMsg()); return prev }
      else next.add(id)
      return next
    })
  }
  const selectFiltered = () => {
    const next = new Set(selected)
    let skipped = 0
    for (const p of filtered) {
      if (next.has(p.id)) continue
      if (next.size >= cap) { skipped++; continue }
      next.add(p.id)
    }
    setSelected(next)
    if (skipped) toast(`${capMsg()} : ${skipped} ${tr('prospect(s) non ajouté(s)', 'not added')}`, { icon: '⚠️' })
  }
  const clearFilters = () => { setFStages([]); setFTags([]); setFSetter(''); setFCloser(''); setFGroup(''); setSearch(''); setOnlySelected(false) }

  // ─── Groupes ───
  const [groupName, setGroupName] = useState('')
  const [savingGroup, setSavingGroup] = useState(false)
  const saveGroup = async () => {
    if (!groupName.trim() || selected.size === 0) return
    setSavingGroup(true)
    const { error } = await supabase.from('business_email_groups').insert({ owner_id: ownerId, name: groupName.trim(), prospect_ids: [...selected] })
    setSavingGroup(false)
    if (error) { toast.error(tr("Impossible d'enregistrer le groupe", 'Could not save the group')); return }
    toast.success(tr('Groupe enregistré', 'Group saved'))
    setGroupName('')
    loadGroups()
  }
  const deleteGroup = async (g: Group) => {
    if (!window.confirm(tr(`Supprimer le groupe « ${g.name} » ? Les prospects ne sont pas supprimés.`, `Delete group "${g.name}"? Prospects are kept.`))) return
    await supabase.from('business_email_groups').delete().eq('id', g.id)
    if (fGroup === g.id) setFGroup('')
    loadGroups()
  }

  // ─── Message ───
  const [subject, setSubject] = useState('')
  const [mode, setMode] = useState<EmailMode>('text')
  const [content, setContent] = useState(DEFAULT_TEXT)
  const [htmlContent, setHtmlContent] = useState('')
  const [senderName, setSenderName] = useState('')
  const textRef = useRef<HTMLTextAreaElement>(null)
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)
  const [testing, setTesting] = useState(false)
  const [showPreview, setShowPreview] = useState(true)

  useEffect(() => {
    if (!ownerId) return
    supabase.from('business_settings').select('company_name').eq('user_id', ownerId).maybeSingle().then(({ data }) => setSenderName(data?.company_name || ''))
  }, [ownerId])

  const body = mode === 'html' ? htmlContent : content
  const setBody = mode === 'html' ? setHtmlContent : setContent

  const insertVar = (v: string) => {
    const el = textRef.current
    const token = `{{${v}}}`
    if (!el) { setBody(body + token); return }
    const s = el.selectionStart ?? body.length, e = el.selectionEnd ?? body.length
    setBody(body.slice(0, s) + token + body.slice(e))
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = s + token.length })
  }

  const previewProspect = useMemo(() => reachable.find((p) => selected.has(p.id)), [reachable, selected])
  const previewHtml = useMemo(() => {
    const names = previewProspect ? prospectNames(previewProspect) : { prenom: 'Camille', nom: 'Martin' }
    return renderEmail({
      mode, subject: subject || tr('(sans objet)', '(no subject)'), content: body || ' ',
      senderName: senderName || 'CloseOS Business',
      vars: { ...names, email: previewProspect?.email || 'camille@exemple.fr' },
      unsubscribeUrl: '#',
    })
  }, [mode, subject, body, senderName, previewProspect, L])

  const canSend = subject.trim() && body.trim() && selected.size > 0 && selected.size <= cap

  const sendTest = async () => {
    if (!subject.trim() || !body.trim()) { toast.error(tr("Ajoute un objet et un contenu", 'Add a subject and content')); return }
    setTesting(true)
    try {
      const r = await api('test', { subject, mode, content: body })
      toast.success(tr(`Email de test envoyé à ${r.to}`, `Test email sent to ${r.to}`))
    } catch (e: any) { toast.error(e.message) } finally { setTesting(false) }
  }

  const send = async () => {
    setSending(true)
    try {
      const r = await api('send', { subject, mode, content: body, prospect_ids: [...selected] })
      const parts = [tr(`${r.sent} email(s) envoyé(s)`, `${r.sent} email(s) sent`)]
      if (r.failed) parts.push(tr(`${r.failed} échec(s)`, `${r.failed} failed`))
      if (r.skipped_unsubscribed) parts.push(tr(`${r.skipped_unsubscribed} désinscrit(s) ignoré(s)`, `${r.skipped_unsubscribed} unsubscribed skipped`))
      r.failed ? toast(parts.join(' · '), { icon: '⚠️' }) : toast.success(parts.join(' · '))
      setConfirming(false)
      setSelected(new Set())
      loadHistory()
      loadQuota()
    } catch (e: any) { toast.error(e.message); loadQuota() } finally { setSending(false) }
  }

  // ─── Synchronisation ───
  const [integ, setInteg] = useState<any>(null)
  const [brevoKey, setBrevoKey] = useState('')
  const [lists, setLists] = useState<{ id: number; name: string; count: number }[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState<string | null>(null)

  const loadInteg = useCallback(async () => {
    try { setInteg(await api('integration', undefined, 'GET')) } catch { setInteg({ connected: false, unavailable: true }) }
  }, [api])

  useEffect(() => {
    if (tab !== 'sync' || !ownerId) return
    loadInteg()
    supabase.from('business_webhook_keys').select('api_key, name, is_active').eq('user_id', ownerId).eq('is_active', true).then(({ data }) => {
      const k = (data || []).find((x: any) => x.name !== 'MCP') || (data || [])[0]
      setApiKey(k?.api_key || null)
    })
  }, [tab, ownerId, loadInteg])

  const fetchLists = async (key?: string) => {
    setBusy('lists')
    try { const r = await api('brevo-lists', key ? { api_key: key } : {}); setLists(r.lists || []); return r.lists } catch (e: any) { toast.error(e.message) } finally { setBusy(null) }
  }
  const connectBrevo = async () => {
    if (!brevoKey.trim()) return
    setBusy('connect')
    try {
      await api('integration-save', { api_key: brevoKey.trim() })
      setBrevoKey('')
      toast.success(tr('Compte Brevo connecté', 'Brevo account connected'))
      await loadInteg()
      await fetchLists()
    } catch (e: any) { toast.error(e.message) } finally { setBusy(null) }
  }
  const saveInteg = async (patch: any) => {
    try { await api('integration-save', patch); await loadInteg() } catch (e: any) { toast.error(e.message) }
  }
  const syncNow = async () => {
    setBusy('sync')
    try { const r = await api('sync', { full: true }); toast.success(tr(`${r.count} contact(s) envoyés dans Brevo`, `${r.count} contact(s) pushed to Brevo`)); loadInteg() } catch (e: any) { toast.error(e.message); loadInteg() } finally { setBusy(null) }
  }
  const disconnect = async () => {
    if (!window.confirm(tr('Déconnecter Brevo ? La clé API sera supprimée de CloseOS.', 'Disconnect Brevo? The API key will be removed from CloseOS.'))) return
    await api('integration-delete', {}); setLists([]); loadInteg()
  }
  useEffect(() => { if (tab === 'sync' && integ?.connected && lists.length === 0) fetchLists() }, [tab, integ?.connected])

  const origin = typeof window !== 'undefined' ? window.location.origin.replace(/localhost:\d+/, 'www.closeos.fr').replace(/^http:/, 'https:') : 'https://www.closeos.fr'
  const contactsUrl = apiKey ? `${origin}/api/business-emailing?action=contacts&key=${apiKey}` : ''
  const copy = (s: string) => { navigator.clipboard.writeText(s); toast.success(tr('Copié', 'Copied')) }

  // ─── Historique ───
  const [history, setHistory] = useState<any[] | null>(null)
  const loadHistory = useCallback(async () => {
    if (!ownerId) return
    const { data, error } = await supabase.from('business_email_campaigns').select('*').eq('owner_id', ownerId).order('created_at', { ascending: false }).limit(50)
    setHistory(error ? [] : data || [])
  }, [ownerId])
  useEffect(() => { if (tab === 'history') loadHistory() }, [tab, loadHistory])

  const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleString(L === 'fr' ? 'fr-FR' : 'en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

  // ─────────────────────────────────────────────────────────────── RENDER
  return (
    <div className="space-y-4 sm:space-y-8">
      {/* En-tête */}
      <div className="flex items-center gap-3 sm:gap-6">
        <div className="w-11 h-11 sm:w-16 sm:h-16 bg-emerald-200 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shrink-0">
          <Mail className="h-5 w-5 sm:h-7 sm:w-7 text-emerald-900" strokeWidth={1.5} />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-stone-900 dark:text-white leading-none" style={{ fontFamily: 'Manrope, sans-serif' }}>Emailing</h1>
          <p className="mt-1 sm:mt-2.5 text-xs sm:text-base font-medium text-stone-500 dark:text-neutral-400">
            {reachable.length} {tr('prospect(s) avec un email', 'prospect(s) with an email')} · {tr(`${EMAILING_DAILY_LIMIT} emails par jour maximum`, `${EMAILING_DAILY_LIMIT} emails per day max`)}
          </p>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {([
          ['send', tr('Envoyer un email', 'Send an email'), Send],
          ['sync', tr('Synchronisation & API', 'Sync & API'), RefreshCw],
          ['history', tr('Historique', 'History'), History],
        ] as [Tab, string, any][]).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all ${tab === id ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900' : 'bg-white dark:bg-neutral-900 text-stone-600 dark:text-neutral-300 border border-stone-200 dark:border-neutral-800 hover:border-stone-400'}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'send' && (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-4 sm:gap-6 items-start">
          {/* ── Destinataires ── */}
          <div className={`${card} space-y-4`}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-['Manrope'] text-lg font-extrabold text-[#1b1c1b] dark:text-white"><Users className="h-5 w-5" /> {tr('Destinataires', 'Recipients')}</h2>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${selected.size >= cap ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'}`}>{selected.size} / {cap}</span>
            </div>

            {/* Avertissement : seuls les prospects avec un email apparaissent */}
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3 py-2.5 text-xs text-amber-900 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-px" />
              <p>
                {tr(
                  `Seuls les prospects qui ont un email dans leur fiche apparaissent dans cette liste : ${reachable.length} sur ${prospects.length} dans le CRM.`,
                  `Only prospects with an email on their record appear in this list: ${reachable.length} of ${prospects.length} in the CRM.`,
                )}
                {prospects.length > reachable.length && tr(
                  ` Les ${prospects.length - reachable.length} autres n'ont pas d'email (ou un email invalide) : ajoutez-le dans leur fiche pour pouvoir leur écrire.`,
                  ` The other ${prospects.length - reachable.length} have no (valid) email: add it on their record to be able to write to them.`,
                )}
              </p>
            </div>

            {/* Quota du jour */}
            <p className="text-xs text-stone-500 dark:text-neutral-400">
              {quota
                ? tr(
                    `Aujourd'hui : ${quota.sent} / ${EMAILING_DAILY_LIMIT} emails envoyés · il en reste ${quota.remaining}. Maximum ${EMAILING_MAX_RECIPIENTS} destinataires par envoi.`,
                    `Today: ${quota.sent} / ${EMAILING_DAILY_LIMIT} emails sent · ${quota.remaining} left. Maximum ${EMAILING_MAX_RECIPIENTS} recipients per send.`,
                  )
                : tr(`Limite : ${EMAILING_DAILY_LIMIT} emails par jour, ${EMAILING_MAX_RECIPIENTS} destinataires maximum par envoi.`, `Limit: ${EMAILING_DAILY_LIMIT} emails per day, ${EMAILING_MAX_RECIPIENTS} recipients max per send.`)}
            </p>

            <div>
              <label className={labelCls}>{tr('Étape', 'Stage')}</label>
              <div className="flex flex-wrap gap-1.5">
                {stageOptions.map((s) => {
                  const n = reachable.filter((p) => p.stage === s.id).length
                  if (!n && !fStages.includes(s.id)) return null
                  return <button key={s.id} onClick={() => toggleIn(fStages, setFStages, s.id)} className={chip(fStages.includes(s.id))}>{s.name} <span className="opacity-60">({n})</span></button>
                })}
              </div>
            </div>

            {tags.length > 0 && (
              <div>
                <label className={labelCls}>Tags</label>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <button key={t.id} onClick={() => toggleIn(fTags, setFTags, t.id)} className={chip(fTags.includes(t.id))}>
                      <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: t.color }} />{t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>{tr('Setter assigné', 'Assigned setter')}</label>
                <select value={fSetter} onChange={(e) => setFSetter(e.target.value)} className={`${inputCls} cursor-pointer`}>
                  <option value="">{tr('Tous', 'All')}</option>
                  <option value="__none">{tr('Sans setter', 'No setter')}</option>
                  {setterIds.map((id) => <option key={id} value={id}>{memberName[id] || tr('Membre', 'Member')}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>{tr('Closer assigné', 'Assigned closer')}</label>
                <select value={fCloser} onChange={(e) => setFCloser(e.target.value)} className={`${inputCls} cursor-pointer`}>
                  <option value="">{tr('Tous', 'All')}</option>
                  <option value="__none">{tr('Sans closer', 'No closer')}</option>
                  {closerIds.map((id) => <option key={id} value={id}>{memberName[id] || tr('Membre', 'Member')}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>{tr('Groupe', 'Group')}</label>
                <select value={fGroup} onChange={(e) => setFGroup(e.target.value)} disabled={groupsUnavailable} className={`${inputCls} cursor-pointer disabled:opacity-50`}>
                  <option value="">{groupsUnavailable ? tr('Indisponible', 'Unavailable') : tr('Tous', 'All')}</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.prospect_ids.length})</option>)}
                </select>
              </div>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr('Rechercher un nom, un email…', 'Search a name, an email…')} className={`${inputCls} pl-9`} />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button onClick={selectFiltered} className="rounded-full bg-stone-900 px-3 py-1.5 font-semibold text-white dark:bg-white dark:text-stone-900">{tr(`Sélectionner les ${filtered.length} affichés`, `Select the ${filtered.length} shown`)}</button>
              <button onClick={() => setSelected(new Set())} disabled={!selected.size} className="rounded-full border border-stone-200 dark:border-neutral-700 px-3 py-1.5 font-semibold text-stone-600 dark:text-neutral-300 disabled:opacity-40">{tr('Vider la sélection', 'Clear selection')}</button>
              <button onClick={() => setOnlySelected((v) => !v)} className={chip(onlySelected)}>{tr('Voir la sélection', 'Show selection')}</button>
              <button onClick={clearFilters} className="ml-auto font-semibold text-stone-500 underline-offset-2 hover:underline">{tr('Réinitialiser les filtres', 'Reset filters')}</button>
            </div>

            <div className="max-h-[420px] overflow-y-auto rounded-xl border border-stone-100 dark:border-neutral-800 divide-y divide-stone-100 dark:divide-neutral-800">
              {loading && <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin text-stone-400" /></div>}
              {!loading && filtered.length === 0 && <p className="p-6 text-center text-sm text-stone-500">{tr('Aucun prospect ne correspond.', 'No matching prospect.')}</p>}
              {filtered.map((p) => {
                const on = selected.has(p.id)
                const { prenom, nom } = prospectNames(p)
                const stage = stageOptions.find((s) => s.id === p.stage)?.name || p.stage
                return (
                  <label key={p.id} className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors [content-visibility:auto] [contain-intrinsic-size:auto_56px] ${on ? 'bg-emerald-50/70 dark:bg-emerald-900/20' : 'hover:bg-stone-50 dark:hover:bg-neutral-800/60'}`}>
                    <input type="checkbox" checked={on} onChange={() => toggleOne(p.id)} className="h-4 w-4 accent-[#006c49]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#1b1c1b] dark:text-white">{[prenom, nom].filter(Boolean).join(' ') || p.email}</p>
                      <p className="truncate text-xs text-stone-500 dark:text-neutral-400">{p.email}</p>
                    </div>
                    <span className="hidden sm:inline shrink-0 rounded-full bg-stone-100 dark:bg-neutral-800 px-2 py-0.5 text-[11px] font-medium text-stone-600 dark:text-neutral-300">{stage}</span>
                  </label>
                )
              })}
            </div>

            {/* Groupes */}
            <div className="rounded-xl bg-[#f5f3f2] dark:bg-neutral-800/60 p-3 space-y-2">
              <p className="text-xs font-semibold text-stone-600 dark:text-neutral-300">{tr('Groupes de prospects', 'Prospect groups')}</p>
              {groupsUnavailable ? (
                <p className="flex items-start gap-2 text-xs text-amber-700"><AlertTriangle className="h-4 w-4 shrink-0" />{tr("Les groupes seront disponibles une fois la mise à jour de la base appliquée.", 'Groups will be available once the database update is applied.')}</p>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder={tr('Nom du groupe (ex : Webinar novembre)', 'Group name')} className={inputCls} />
                    <button onClick={saveGroup} disabled={!groupName.trim() || !selected.size || savingGroup} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-stone-900 px-3 text-xs font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-stone-900">
                      {savingGroup ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {tr('Enregistrer la sélection', 'Save selection')}
                    </button>
                  </div>
                  {groups.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {groups.map((g) => (
                        <span key={g.id} className="inline-flex items-center gap-1 rounded-full border border-stone-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 pl-3 pr-1 py-1 text-xs font-medium text-stone-700 dark:text-neutral-200">
                          <button onClick={() => setFGroup(g.id)} className="hover:underline">{g.name} ({g.prospect_ids.length})</button>
                          <button onClick={() => deleteGroup(g)} aria-label={tr('Supprimer', 'Delete')} className="rounded-full p-1 text-stone-400 hover:text-red-600"><Trash2 className="h-3 w-3" /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── Message ── */}
          <div className={`${card} space-y-4`}>
            <h2 className="flex items-center gap-2 font-['Manrope'] text-lg font-extrabold text-[#1b1c1b] dark:text-white"><Mail className="h-5 w-5" /> {tr('Message', 'Message')}</h2>
            <div>
              <label className={labelCls}>{tr('Objet', 'Subject')}</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} placeholder={tr('Ex : {{prenom}}, ta place pour jeudi', 'E.g. {{prenom}}, your seat for Thursday')} className={inputCls} />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-full bg-[#f5f3f2] dark:bg-neutral-800 p-1">
                <button onClick={() => setMode('text')} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${mode === 'text' ? 'bg-white dark:bg-neutral-700 shadow text-stone-900 dark:text-white' : 'text-stone-500'}`}><Type className="h-3.5 w-3.5" /> {tr('Texte (gabarit CloseOS)', 'Text (CloseOS template)')}</button>
                <button onClick={() => setMode('html')} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${mode === 'html' ? 'bg-white dark:bg-neutral-700 shadow text-stone-900 dark:text-white' : 'text-stone-500'}`}><Code2 className="h-3.5 w-3.5" /> HTML</button>
              </div>
              <div className="flex flex-wrap gap-1">
                {['prenom', 'nom', 'email'].map((v) => (
                  <button key={v} onClick={() => insertVar(v)} className="rounded-md border border-dashed border-stone-300 dark:border-neutral-600 px-2 py-1 font-mono text-[11px] text-stone-600 dark:text-neutral-300 hover:border-[#006c49] hover:text-[#006c49]">{`{{${v}}}`}</button>
                ))}
              </div>
            </div>

            <textarea
              ref={textRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={mode === 'html' ? 14 : 10}
              spellCheck={mode === 'text'}
              placeholder={mode === 'html' ? '<!DOCTYPE html>\n<html>…</html>' : ''}
              className={`${inputCls} resize-y ${mode === 'html' ? 'font-mono text-xs' : ''}`}
            />
            <p className="text-xs text-stone-500 dark:text-neutral-400">
              {mode === 'text'
                ? tr('Ton texte est mis en page dans le gabarit CloseOS Business. Lien de désinscription ajouté automatiquement.', 'Your text is laid out in the CloseOS Business template. Unsubscribe link added automatically.')
                : tr('Ton HTML est envoyé tel quel ; un lien de désinscription est ajouté en bas.', 'Your HTML is sent as is; an unsubscribe link is added at the bottom.')}
              {' '}{tr(`Expéditeur : ${senderName || 'CloseOS Business'} <support@closeos.fr>, réponses vers ton adresse.`, `Sender: ${senderName || 'CloseOS Business'} <support@closeos.fr>, replies go to your address.`)}
            </p>

            <div>
              <button onClick={() => setShowPreview((v) => !v)} className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-stone-600 dark:text-neutral-300"><Eye className="h-4 w-4" /> {showPreview ? tr("Masquer l'aperçu", 'Hide preview') : tr("Afficher l'aperçu", 'Show preview')}{previewProspect ? ` · ${tr('pour', 'for')} ${previewProspect.email}` : ''}</button>
              {showPreview && (
                <div className="overflow-hidden rounded-xl border border-stone-200 dark:border-neutral-700 bg-[#fbf9f8]">
                  <div className="border-b border-stone-200 bg-white px-3 py-2 text-xs text-stone-600"><span className="font-semibold">{tr('Objet', 'Subject')} :</span> {previewHtml.subject}</div>
                  <iframe title="preview" srcDoc={previewHtml.html} sandbox="" className="h-[420px] w-full bg-[#fbf9f8]" />
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button onClick={sendTest} disabled={testing} className="flex items-center justify-center gap-2 rounded-full border border-stone-300 dark:border-neutral-600 px-4 py-2.5 text-sm font-semibold text-stone-700 dark:text-neutral-200 hover:bg-stone-50 dark:hover:bg-neutral-800 disabled:opacity-50">
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />} {tr("M'envoyer un test", 'Send me a test')}
              </button>
              {!confirming ? (
                <button onClick={() => setConfirming(true)} disabled={!canSend} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#006c49] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#005a3c] disabled:opacity-40">
                  <Send className="h-4 w-4" /> {tr(`Envoyer à ${selected.size} personne(s)`, `Send to ${selected.size} person(s)`)}
                </button>
              ) : (
                <div className="flex flex-1 gap-2">
                  <button onClick={() => setConfirming(false)} disabled={sending} className="rounded-full border border-stone-300 px-4 py-2.5 text-sm font-semibold text-stone-600"><X className="h-4 w-4" /></button>
                  <button onClick={send} disabled={sending} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {tr(`Confirmer l'envoi à ${selected.size} personne(s)`, `Confirm sending to ${selected.size}`)}
                  </button>
                </div>
              )}
            </div>
            {!selected.size && <p className="text-xs text-stone-500">{tr('Sélectionne au moins un destinataire à gauche.', 'Select at least one recipient on the left.')}</p>}
          </div>
        </div>
      )}

      {tab === 'sync' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-start">
          {/* Brevo */}
          <div className={`${card} space-y-4`}>
            <div>
              <h2 className="font-['Manrope'] text-lg font-extrabold text-[#1b1c1b] dark:text-white">{tr('Synchroniser avec Brevo', 'Sync with Brevo')}</h2>
              <p className="mt-1 text-sm text-stone-500 dark:text-neutral-400">{tr("Envoie l'email, le prénom et le nom de tous les prospects du CRM dans une liste de ton compte Brevo.", 'Pushes email, first name and last name of every CRM prospect into a list of your Brevo account.')}</p>
            </div>
            {integ?.unavailable && <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800"><AlertTriangle className="h-4 w-4 shrink-0" />{tr('Synchronisation indisponible pour le moment (mise à jour serveur à déployer).', 'Sync unavailable for now (server update to deploy).')}</p>}
            {!integ?.connected ? (
              <div className="space-y-2">
                <label className={labelCls}>{tr('Clé API Brevo', 'Brevo API key')}</label>
                <div className="flex gap-2">
                  <input type="password" value={brevoKey} onChange={(e) => setBrevoKey(e.target.value)} placeholder="xkeysib-…" autoComplete="off" className={inputCls} />
                  <button onClick={connectBrevo} disabled={!brevoKey.trim() || busy === 'connect'} className="shrink-0 rounded-xl bg-stone-900 px-4 text-sm font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-stone-900">{busy === 'connect' ? <Loader2 className="h-4 w-4 animate-spin" /> : tr('Connecter', 'Connect')}</button>
                </div>
                <p className="text-xs text-stone-500">{tr('Brevo → Paramètres → SMTP & API → Clés API. La clé reste côté serveur, elle n\'est jamais réaffichée.', 'Brevo → Settings → SMTP & API → API keys. The key stays server-side and is never shown again.')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-xl bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300"><Check className="h-4 w-4" /> Brevo · {integ.key_hint}</span>
                  <button onClick={disconnect} className="text-xs font-semibold text-stone-500 hover:text-red-600">{tr('Déconnecter', 'Disconnect')}</button>
                </div>
                <div>
                  <label className={labelCls}>{tr('Liste de destination', 'Destination list')}</label>
                  <div className="flex gap-2">
                    <select value={integ.list_id || ''} onChange={(e) => { const l = lists.find((x) => String(x.id) === e.target.value); saveInteg({ list_id: l?.id || null, list_name: l?.name || null }) }} className={`${inputCls} cursor-pointer`}>
                      <option value="">{tr('Choisir une liste…', 'Choose a list…')}</option>
                      {integ.list_id && !lists.some((l) => l.id === integ.list_id) && <option value={integ.list_id}>{integ.list_name || `#${integ.list_id}`}</option>}
                      {lists.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.count})</option>)}
                    </select>
                    <button onClick={() => fetchLists()} aria-label={tr('Rafraîchir', 'Refresh')} className="shrink-0 rounded-xl border border-stone-200 dark:border-neutral-700 px-3"><RefreshCw className={`h-4 w-4 ${busy === 'lists' ? 'animate-spin' : ''}`} /></button>
                  </div>
                </div>
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-stone-200 dark:border-neutral-700 px-3 py-2.5">
                  <span className="text-sm">
                    <span className="font-semibold text-[#1b1c1b] dark:text-white">{tr('Synchronisation automatique', 'Automatic sync')}</span>
                    <span className="block text-xs text-stone-500">{tr('Toutes les heures, les nouveaux prospects sont ajoutés à la liste.', 'Every hour, new prospects are added to the list.')}</span>
                  </span>
                  <input type="checkbox" checked={!!integ.auto_sync} onChange={(e) => saveInteg({ auto_sync: e.target.checked })} className="h-5 w-5 accent-[#006c49]" />
                </label>
                <button onClick={syncNow} disabled={!integ.list_id || busy === 'sync'} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#006c49] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#005a3c] disabled:opacity-40">
                  {busy === 'sync' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {tr('Synchroniser tous les contacts maintenant', 'Sync all contacts now')}
                </button>
                <p className="text-xs text-stone-500">
                  {tr('Dernière synchro', 'Last sync')} : {fmtDate(integ.last_sync_at)}{integ.last_sync_count != null ? ` · ${integ.last_sync_count} contact(s)` : ''}
                  {integ.last_error && <span className="block text-red-600">{integ.last_error}</span>}
                </p>
              </div>
            )}
          </div>

          {/* API / autres outils */}
          <div className={`${card} space-y-4`}>
            <div>
              <h2 className="flex items-center gap-2 font-['Manrope'] text-lg font-extrabold text-[#1b1c1b] dark:text-white"><Link2 className="h-5 w-5" /> {tr('Autre outil (API, Zapier, Make…)', 'Other tool (API, Zapier, Make…)')}</h2>
              <p className="mt-1 text-sm text-stone-500 dark:text-neutral-400">{tr('Cette adresse renvoie tous les contacts du CRM (email, prénom, nom, téléphone, étape). Ajoute &format=csv pour un fichier, &since=2026-11-01 pour les nouveaux seulement.', 'This URL returns every CRM contact (email, first/last name, phone, stage). Add &format=csv for a file, &since=2026-11-01 for new ones only.')}</p>
            </div>
            {apiKey ? (
              <>
                <div className="flex gap-2">
                  <input readOnly value={contactsUrl.replace(apiKey, `${apiKey.slice(0, 8)}…`)} className={`${inputCls} font-mono text-xs`} />
                  <button onClick={() => copy(contactsUrl)} className="shrink-0 rounded-xl border border-stone-200 dark:border-neutral-700 px-3" aria-label={tr('Copier', 'Copy')}><Copy className="h-4 w-4" /></button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => copy(`${contactsUrl}&format=csv`)} className="rounded-full border border-stone-200 dark:border-neutral-700 px-3 py-1.5 text-xs font-semibold">{tr('Copier le lien CSV', 'Copy CSV link')}</button>
                  <a href={`/api/business-emailing?action=contacts&key=${apiKey}&format=csv`} className="rounded-full border border-stone-200 dark:border-neutral-700 px-3 py-1.5 text-xs font-semibold">{tr('Télécharger le CSV', 'Download CSV')}</a>
                </div>
                <p className="text-xs text-stone-500">{tr("Le lien contient ta clé API : ne le partage qu'avec tes outils. Pour recevoir chaque nouveau prospect en direct, utilise le webhook « prospect.created » (Paramètres → Intégrations CRM).", 'The link contains your API key: share it only with your tools. To receive each new prospect live, use the "prospect.created" webhook (Settings → CRM integrations).')}</p>
              </>
            ) : (
              <p className="rounded-xl bg-[#f5f3f2] dark:bg-neutral-800 p-3 text-sm text-stone-600 dark:text-neutral-300">{tr('Crée d’abord une clé API dans Paramètres → Intégrations CRM (Zapier / API), puis reviens ici.', 'First create an API key in Settings → CRM integrations (Zapier / API), then come back.')}</p>
            )}
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className={card}>
          {history === null ? (
            <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin text-stone-400" /></div>
          ) : history.length === 0 ? (
            <p className="p-6 text-center text-sm text-stone-500">{tr('Aucun envoi pour le moment.', 'No sends yet.')}</p>
          ) : (
            <div className="divide-y divide-stone-100 dark:divide-neutral-800">
              {history.map((h) => (
                <div key={h.id} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-[#1b1c1b] dark:text-white">{h.subject}</p>
                    <p className="text-xs text-stone-500">{fmtDate(h.created_at)} · {h.mode === 'html' ? 'HTML' : tr('Texte', 'Text')}</p>
                  </div>
                  <div className="flex gap-2 text-xs font-semibold">
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800">{h.sent_count} {tr('envoyé(s)', 'sent')}</span>
                    {h.failed_count > 0 && <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-700">{h.failed_count} {tr('échec(s)', 'failed')}</span>}
                    {h.skipped_unsubscribed > 0 && <span className="rounded-full bg-stone-100 px-2.5 py-1 text-stone-600">{h.skipped_unsubscribed} {tr('désinscrit(s)', 'unsubscribed')}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
