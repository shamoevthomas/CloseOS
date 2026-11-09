import { useState } from 'react'
import { X, Copy, Check, Loader2, Link as LinkIcon, Radar, ExternalLink, Info, Plus } from 'lucide-react'
import { useBusinessLang } from '../i18n/BusinessLangContext'
import { type SourceEntry, MAX_SOURCES, normalizeSources, withSourceParam } from '../../lib/campaignSources'

interface CreatedLink {
  id: string
  name: string
  slug: string
  destination_url: string
  is_internal: boolean
  sources?: SourceEntry[] | null
}

interface Props {
  isOpen: boolean
  onClose: () => void
  userId: string | undefined
  onCreated: () => void
}

const TT = {
  fr: {
    title: 'Créer un tracking',
    desc: 'Génère un lien court traçable. Chaque clic est enregistré : pays, visiteurs uniques / récurrents, referrer — et le temps passé si la destination est une page CloseOS.',
    name_label: 'Nom du tracking',
    name_ph: 'Ex : Campagne LinkedIn Juin',
    dest_label: 'Lien de destination',
    dest_ph: 'https://mon-site.com/ma-page',
    dest_hint: 'La personne sera redirigée vers ce lien après le clic.',
    create: 'Générer le lien',
    generated: 'Lien de tracking créé',
    copy_hint: 'Partage ce lien : chaque clic sera analysé.',
    internal_yes: 'Page CloseOS détectée — le temps passé sur la page sera mesuré automatiquement.',
    internal_no: 'Destination externe — clics, pays et récurrence sont suivis (le temps sur page n\'est pas mesurable sur un site tiers).',
    redirects_to: 'Redirige vers',
    done: 'Terminé',
    err: 'Erreur lors de la création',
    sources_label: 'Sources (optionnel)',
    sources_hint: 'Un lien par source (Instagram, YouTube…) pour savoir d\'où viennent les clics. Le lien de base reste le lien principal.',
    sources_ph: 'Ex. Instagram',
    add: 'Ajouter', remove: 'Retirer',
    main_link: 'Lien principal',
    links_generated: 'Liens de tracking créés',
  },
  en: {
    title: 'Create a tracking',
    desc: 'Generate a trackable short link. Every click is recorded: country, unique / returning visitors, referrer — and time on page if the destination is a CloseOS page.',
    name_label: 'Tracking name',
    name_ph: 'e.g. LinkedIn Campaign June',
    dest_label: 'Destination link',
    dest_ph: 'https://my-site.com/my-page',
    dest_hint: 'The visitor is redirected to this link after the click.',
    create: 'Generate link',
    generated: 'Tracking link created',
    copy_hint: 'Share this link: every click will be analyzed.',
    internal_yes: 'CloseOS page detected — time on page will be measured automatically.',
    internal_no: 'External destination — clicks, country and recurrence are tracked (time on page can\'t be measured on a third-party site).',
    redirects_to: 'Redirects to',
    done: 'Done',
    err: 'Error while creating',
    sources_label: 'Sources (optional)',
    sources_hint: 'One link per source (Instagram, YouTube…) to know where clicks come from. The base link stays the main link.',
    sources_ph: 'e.g. Instagram',
    add: 'Add', remove: 'Remove',
    main_link: 'Main link',
    links_generated: 'Tracking links created',
  },
}

export function CreateTrackingModal({ isOpen, onClose, userId, onCreated }: Props) {
  const { lang } = useBusinessLang()
  const t = TT[lang]
  const [name, setName] = useState('')
  const [dest, setDest] = useState('')
  const [loading, setLoading] = useState(false)
  const [created, setCreated] = useState<CreatedLink | null>(null)
  const [copied, setCopied] = useState(false)
  const [sources, setSources] = useState<SourceEntry[]>([])
  const [newSource, setNewSource] = useState('')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const shortUrl = created ? `${window.location.origin}/t/${created.slug}` : ''
  const createdSources = normalizeSources(created?.sources)

  const addSource = () => {
    const n = newSource.trim()
    if (!n) return
    setSources(normalizeSources([...sources, { key: '', name: n }]))
    setNewSource('')
  }

  const copySourceUrl = (key: string, url: string) => {
    navigator.clipboard.writeText(url)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const handleCreate = async () => {
    if (!name.trim() || !dest.trim() || !userId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/track?action=create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, name: name.trim(), destination_url: dest.trim(), sources }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t.err)
      setCreated(data.link)
      onCreated()
    } catch (e: any) {
      setError(e.message || t.err)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    if (!shortUrl) return
    navigator.clipboard.writeText(shortUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleClose = () => {
    setName(''); setDest(''); setCreated(null); setCopied(false); setError(null); setLoading(false)
    setSources([]); setNewSource(''); setCopiedKey(null)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/40 backdrop-blur-md p-0 sm:p-4">
      {/* Mobile : feuille du bas (poignée, fond opaque, marge de sécurité en bas) */}
      <div className="w-full sm:max-w-md max-h-[92dvh] sm:max-h-none overflow-y-auto overscroll-contain sm:overflow-visible bg-white sm:bg-white/95 dark:bg-neutral-900 sm:dark:bg-neutral-900/95 sm:backdrop-blur-xl rounded-t-3xl sm:rounded-xl shadow-[0_20px_40px_rgba(27,28,27,0.04)] border border-stone-200/20 dark:border-neutral-700 px-5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6 relative animate-in zoom-in-95 duration-200">
        <div className="sm:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-stone-300 dark:bg-neutral-700" />
        <button
          onClick={handleClose}
          aria-label="Fermer"
          className="absolute top-4 right-3 p-2 sm:p-0 sm:top-4 sm:right-4 text-stone-400 dark:text-neutral-500 hover:text-stone-700 dark:hover:text-neutral-200 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 mb-2 pr-10 sm:pr-0">
          <div className="w-8 h-8 shrink-0 rounded-full bg-red-500/10 flex items-center justify-center">
            <Radar className="h-4 w-4 text-red-600" />
          </div>
          <h2 className="text-lg sm:text-xl font-['Manrope'] font-extrabold tracking-tight text-stone-900 dark:text-white">{t.title}</h2>
        </div>
        <p className="text-stone-500 dark:text-neutral-400 text-[13px] sm:text-sm mb-5 sm:mb-6 leading-relaxed sm:leading-relaxed">{t.desc}</p>

        {!created ? (
          <div className="space-y-4">
            <div>
              <label className="block text-[0.75rem] font-semibold uppercase tracking-widest text-stone-500 dark:text-neutral-400 mb-2">{t.name_label}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.name_ph}
                className="w-full rounded-xl bg-white dark:bg-neutral-800 border border-stone-300 dark:border-neutral-600 py-3 sm:py-2.5 px-4 text-sm text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder:text-neutral-500 outline-none focus:ring-2 focus:ring-stone-900/10"
              />
            </div>
            <div>
              <label className="block text-[0.75rem] font-semibold uppercase tracking-widest text-stone-500 dark:text-neutral-400 mb-2">{t.dest_label}</label>
              <input
                type="text"
                value={dest}
                onChange={(e) => setDest(e.target.value)}
                placeholder={t.dest_ph}
                className="w-full rounded-xl bg-white dark:bg-neutral-800 border border-stone-300 dark:border-neutral-600 py-3 sm:py-2.5 px-4 text-sm text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder:text-neutral-500 outline-none focus:ring-2 focus:ring-stone-900/10 font-mono"
              />
              <p className="text-xs text-stone-400 dark:text-neutral-500 mt-1.5">{t.dest_hint}</p>
            </div>
            {/* Sources : un lien par source (/t/:slug?s=<clé>) */}
            <div>
              <label className="block text-[0.75rem] font-semibold uppercase tracking-widest text-stone-500 dark:text-neutral-400 mb-2">{t.sources_label}</label>
              {sources.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {sources.map((src) => (
                    <span key={src.key} className="inline-flex items-center gap-1 rounded-full bg-red-500/10 text-red-700 dark:text-red-400 pl-3 pr-1 py-1 text-xs font-bold">
                      {src.name}
                      <button type="button" onClick={() => setSources(sources.filter((x) => x.key !== src.key))} aria-label={t.remove} className="p-0.5 rounded-full hover:bg-red-500/20">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {sources.length < MAX_SOURCES && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSource}
                    onChange={(e) => setNewSource(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSource() } }}
                    placeholder={t.sources_ph}
                    className="flex-1 min-w-0 rounded-xl bg-white dark:bg-neutral-800 border border-stone-300 dark:border-neutral-600 py-3 sm:py-2.5 px-4 text-sm text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder:text-neutral-500 outline-none focus:ring-2 focus:ring-stone-900/10"
                  />
                  <button
                    type="button"
                    onClick={addSource}
                    disabled={!newSource.trim()}
                    className="shrink-0 flex items-center gap-1 rounded-xl border border-stone-300 dark:border-neutral-600 px-3 text-sm font-bold text-stone-700 dark:text-neutral-200 hover:bg-stone-50 dark:hover:bg-neutral-800 disabled:opacity-40 transition-colors"
                  >
                    <Plus className="h-4 w-4" /> {t.add}
                  </button>
                </div>
              )}
              <p className="text-xs text-stone-400 dark:text-neutral-500 mt-1.5">{t.sources_hint}</p>
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <button
              onClick={handleCreate}
              disabled={loading || !name.trim() || !dest.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-full bg-stone-900 dark:bg-white dark:text-black py-3 font-bold text-white shadow-lg hover:bg-stone-800 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><LinkIcon className="h-4 w-4" />{t.create}</>}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-red-200/60 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20 p-4">
              <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2">{createdSources.length > 0 ? `${t.links_generated} · ${t.main_link}` : t.generated}</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={shortUrl}
                  readOnly
                  className="flex-1 min-w-0 rounded-full bg-stone-100/50 dark:bg-neutral-800 border-none py-2 px-3 text-xs text-stone-700 dark:text-neutral-200 font-mono focus:ring-2 focus:ring-red-600/20"
                />
                <button
                  onClick={handleCopy}
                  aria-label="Copier"
                  className="shrink-0 rounded-full bg-red-600 p-2.5 sm:p-2 text-white hover:bg-red-500 active:scale-95 transition-all"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-red-600/80 dark:text-red-400/70 mt-2">{t.copy_hint}</p>
              {createdSources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-red-200/60 dark:border-red-900/40 space-y-1.5">
                  {createdSources.map((src) => {
                    const url = withSourceParam(shortUrl, src.key, 's')
                    return (
                      <div key={src.key} className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-stone-800 dark:text-neutral-100 truncate">{src.name}</div>
                          <div className="text-[11px] font-mono text-stone-500 dark:text-neutral-400 truncate">{url}</div>
                        </div>
                        <button
                          onClick={() => copySourceUrl(src.key, url)}
                          aria-label="Copier"
                          className="shrink-0 rounded-full bg-white dark:bg-neutral-800 border border-red-200 dark:border-red-900/50 p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 active:scale-95 transition-all"
                        >
                          {copiedKey === src.key ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-stone-200/60 dark:border-neutral-700 bg-stone-50/50 dark:bg-neutral-800/50 p-3.5 text-xs text-stone-500 dark:text-neutral-400">
              <div className="flex items-center gap-1.5 text-stone-600 dark:text-neutral-300 mb-1">
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="font-semibold">{t.redirects_to}</span>
              </div>
              <p className="font-mono break-all text-stone-500 dark:text-neutral-400">{created.destination_url}</p>
              <div className="flex items-start gap-1.5 mt-2.5 pt-2.5 border-t border-stone-200/60 dark:border-neutral-700">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{created.is_internal ? t.internal_yes : t.internal_no}</span>
              </div>
            </div>

            <button
              onClick={handleClose}
              className="w-full rounded-full border border-stone-300 dark:border-neutral-600 py-3 font-medium text-stone-700 dark:text-neutral-200 hover:bg-stone-50 dark:hover:bg-neutral-800 active:scale-95 transition-all"
            >
              {t.done}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
