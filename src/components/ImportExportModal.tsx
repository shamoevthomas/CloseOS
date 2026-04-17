import { useState, useMemo, useRef } from 'react'
import { X, Download, Upload, Copy, Check, FileUp, AlertTriangle } from 'lucide-react'
import { cn } from '../lib/utils'
import { useOffers } from '../contexts/OffersContext'
import { useCustomStages } from '../hooks/useCustomStages'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { importExportTranslations } from '../i18n/translations'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import type { Prospect } from '../contexts/ProspectsContext'

interface ImportExportModalProps {
  isOpen: boolean
  onClose: () => void
  source: 'pipeline' | 'contacts'
  prospects: Prospect[]
}

const STATUS_MAP_FR: Record<string, string> = {
  prospect: 'Prospect',
  qualified: 'Qualifié',
  won: 'Gagné',
  lost: 'Perdu',
  noshow: 'No Show',
  followup: 'Follow Up',
}

const STATUS_MAP_REVERSE: Record<string, string> = {
  prospect: 'prospect',
  qualifié: 'qualified',
  qualifie: 'qualified',
  qualified: 'qualified',
  gagné: 'won',
  gagne: 'won',
  won: 'won',
  perdu: 'lost',
  lost: 'lost',
  'no show': 'noshow',
  noshow: 'noshow',
  'follow up': 'followup',
  followup: 'followup',
}

const LLM_PROMPT = `Transforme le CSV ci-dessous pour qu'il respecte exactement cette structure (séparateur point-virgule, encodage UTF-8) :

Prénom;Nom;Email;Téléphone;Entreprise;Statut;Valeur;Notes

Règles :
- Si le nom complet est dans une seule colonne, sépare-le en Prénom et Nom (le premier mot = prénom, le reste = nom)
- Statut doit être l'un de : Prospect, Qualifié, Gagné, Perdu, No Show, Follow Up. Si absent ou inconnu, mets "Prospect"
- Valeur doit être un nombre sans devise (ex: 1500, pas 1500€). Si absent, laisse vide
- Téléphone doit garder le format d'origine
- Si une colonne n'existe pas dans le CSV source, laisse-la vide
- Ne supprime aucune ligne de données
- La première ligne doit être l'en-tête exact ci-dessus
- Utilise le point-virgule (;) comme séparateur, jamais la virgule

Voici mon CSV :`

export function ImportExportModal({ isOpen, onClose, source, prospects }: ImportExportModalProps) {
  const { lang } = useLanguage()
  const t = importExportTranslations[lang]
  const { offers } = useOffers()
  const { getStageInfo } = useCustomStages()
  const { user } = useAuth()

  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export')

  // Export state
  const [exportOfferFilter, setExportOfferFilter] = useState<string>('all')

  // Import state
  const [importOfferId, setImportOfferId] = useState<number | null>(null)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [promptCopied, setPromptCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Active offers only
  const activeOffers = useMemo(() =>
    offers.filter(o => {
      if (!o.endDate) return true
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return new Date(o.endDate) >= today
    }),
    [offers]
  )

  // Unique offer names from prospects
  const prospectOfferNames = useMemo(() => {
    const names = new Set<string>()
    prospects.forEach(p => {
      if (p.offer) names.add(p.offer.split(' - ')[0])
    })
    return Array.from(names)
  }, [prospects])

  // Filtered prospects for export
  const exportProspects = useMemo(() => {
    if (exportOfferFilter === 'all') return prospects
    return prospects.filter(p => {
      const base = (p.offer || '').split(' - ')[0]
      return base === exportOfferFilter
    })
  }, [prospects, exportOfferFilter])

  // ─── EXPORT ──────────────────────────────────────────────
  const handleExport = () => {
    const headers = ['Prénom', 'Nom', 'Email', 'Téléphone', 'Entreprise', 'Offre', 'Statut', 'Valeur', 'Notes', 'Date de création']
    const headerRow = headers.join(';')

    const rows = exportProspects.map(p => {
      const firstName = p.firstName || (p.contact || '').split(' ')[0] || ''
      const lastName = p.lastName || (p.contact || '').split(' ').slice(1).join(' ') || ''
      const stageInfo = getStageInfo(p.stage)
      const stageName = STATUS_MAP_FR[p.stage] || stageInfo?.name || p.stage || ''
      const created = p.created_at ? new Date(p.created_at).toLocaleDateString('fr-FR') : ''

      const fields = [firstName, lastName, p.email || '', p.phone || '', p.company || '', p.offer || '', stageName, p.value != null ? String(p.value) : '', p.notes || '', created]
      return fields.map(f => {
        const str = String(f).replace(/"/g, '""')
        return str.includes(';') || str.includes('"') || str.includes('\n') ? `"${str}"` : str
      }).join(';')
    })

    const csv = [headerRow, ...rows].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `prospects_${source}_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`${exportProspects.length} ${t.import_success.replace('importés', 'exportés').replace('imported', 'exported')}`)
    onClose()
  }

  // ─── IMPORT ──────────────────────────────────────────────
  const handleImport = async () => {
    if (!importFile) { toast.error(t.import_error_no_file); return }
    if (!importOfferId) { toast.error(t.import_error_no_offer); return }
    if (!user) return

    setIsImporting(true)
    try {
      const text = await importFile.text()
      const clean = text.replace(/^\uFEFF/, '')
      const lines = clean.split(/\r?\n/).filter(l => l.trim())
      if (lines.length < 2) { toast.error(t.import_error_empty); setIsImporting(false); return }

      // Parse header
      const headerLine = lines[0]
      const headers = headerLine.split(';').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase())

      // Map column indices
      const colMap: Record<string, number> = {}
      const aliases: Record<string, string[]> = {
        prenom: ['prénom', 'prenom', 'firstname', 'first name', 'first_name'],
        nom: ['nom', 'lastname', 'last name', 'last_name', 'name'],
        email: ['email', 'e-mail', 'mail'],
        telephone: ['téléphone', 'telephone', 'phone', 'tel'],
        entreprise: ['entreprise', 'company', 'société', 'societe'],
        statut: ['statut', 'status', 'stage', 'étape'],
        valeur: ['valeur', 'value', 'montant', 'amount', 'prix', 'price'],
        notes: ['notes', 'note', 'commentaire', 'comment'],
      }

      for (const [key, names] of Object.entries(aliases)) {
        const idx = headers.findIndex(h => names.includes(h))
        if (idx !== -1) colMap[key] = idx
      }

      const selectedOffer = offers.find(o => o.id === importOfferId)
      const offerName = selectedOffer?.name || ''

      // Parse rows
      const prospectsToInsert: any[] = []
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i])
        if (cols.length === 0) continue

        const get = (key: string) => {
          const idx = colMap[key]
          return idx != null && idx < cols.length ? cols[idx].trim() : ''
        }

        const firstName = get('prenom')
        const lastName = get('nom')
        const contact = [firstName, lastName].filter(Boolean).join(' ') || ''
        const rawStatus = get('statut').toLowerCase().trim()
        const stage = STATUS_MAP_REVERSE[rawStatus] || 'prospect'
        const rawValue = get('valeur').replace(/[^\d.,]/g, '').replace(',', '.')
        const value = rawValue ? parseFloat(rawValue) : null

        prospectsToInsert.push({
          user_id: user.id,
          contact,
          firstName,
          lastName,
          email: get('email'),
          phone: get('telephone'),
          company: get('entreprise'),
          offer: offerName,
          offer_id: importOfferId,
          stage,
          value: value && !isNaN(value) ? value : null,
          notes: get('notes'),
        })
      }

      if (prospectsToInsert.length === 0) { toast.error(t.import_error_empty); setIsImporting(false); return }

      // Batch insert by chunks of 50
      const CHUNK = 50
      let inserted = 0
      for (let i = 0; i < prospectsToInsert.length; i += CHUNK) {
        const chunk = prospectsToInsert.slice(i, i + CHUNK)
        const { error } = await supabase.from('prospects').insert(chunk)
        if (error) { toast.error(`Erreur: ${error.message}`); break }
        inserted += chunk.length
      }

      toast.success(`${inserted} ${t.import_success}`)
      setImportFile(null)
      setImportOfferId(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      onClose()
    } catch {
      toast.error(t.import_error_parse)
    } finally {
      setIsImporting(false)
    }
  }

  const handleCopyPrompt = async () => {
    await navigator.clipboard.writeText(LLM_PROMPT)
    setPromptCopied(true)
    setTimeout(() => setPromptCopied(false), 2000)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#1a1a1a] border border-white/[0.08] rounded-3xl p-6 relative animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">{t.btn_label}</h2>
          <button onClick={onClose} className="rounded-full p-2 text-white/40 hover:text-white hover:bg-white/10 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('export')}
            className={cn(
              'flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all',
              activeTab === 'export' ? 'bg-emerald-500 text-black' : 'text-white/40 hover:bg-white/5 hover:text-white'
            )}
          >
            <Download className="h-4 w-4" />
            {t.tab_export}
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={cn(
              'flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all',
              activeTab === 'import' ? 'bg-emerald-500 text-black' : 'text-white/40 hover:bg-white/5 hover:text-white'
            )}
          >
            <Upload className="h-4 w-4" />
            {t.tab_import}
          </button>
        </div>

        {/* ─── EXPORT TAB ───────────────────────────────── */}
        {activeTab === 'export' && (
          <div className="space-y-5">
            <p className="text-sm text-white/50">{t.export_title}</p>

            {/* Offer filter pills */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setExportOfferFilter('all')}
                className={cn(
                  'px-4 py-1.5 text-xs font-medium rounded-full transition-all',
                  exportOfferFilter === 'all' ? 'bg-emerald-500 text-black' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'
                )}
              >
                {t.export_all}
              </button>
              {prospectOfferNames.map(name => (
                <button
                  key={name}
                  onClick={() => setExportOfferFilter(name)}
                  className={cn(
                    'px-4 py-1.5 text-xs font-medium rounded-full transition-all',
                    exportOfferFilter === name ? 'bg-emerald-500 text-black' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'
                  )}
                >
                  {name}
                </button>
              ))}
            </div>

            {/* Count */}
            <p className="text-sm text-white/60">
              <span className="text-emerald-400 font-semibold">{exportProspects.length}</span> {t.export_count}
            </p>

            {/* Download button */}
            <button
              onClick={handleExport}
              disabled={exportProspects.length === 0}
              className="w-full flex items-center justify-center gap-2 rounded-full bg-emerald-500 py-3 text-sm font-semibold text-black transition-all hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="h-4 w-4" />
              {t.export_download}
            </button>
          </div>
        )}

        {/* ─── IMPORT TAB ───────────────────────────────── */}
        {activeTab === 'import' && (
          <div className="space-y-5">
            <p className="text-sm text-white/50">{t.import_title}</p>

            {/* Offer selector */}
            <div>
              <label className="block text-xs font-medium text-white/40 mb-2">{t.import_select_offer}</label>
              <select
                value={importOfferId ?? ''}
                onChange={e => setImportOfferId(e.target.value ? Number(e.target.value) : null)}
                className="w-full rounded-xl bg-white/5 border border-white/10 py-3 px-4 text-sm text-white focus:border-emerald-500 focus:outline-none transition-all appearance-none"
              >
                <option value="" className="bg-[#1a1a1a]">{t.import_select_offer_placeholder}</option>
                {activeOffers.map(o => (
                  <option key={o.id} value={o.id} className="bg-[#1a1a1a]">{o.name}</option>
                ))}
              </select>
            </div>

            {/* Warning box */}
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs font-medium text-amber-300">{t.import_warning_title}</p>
              </div>
              <p className="text-xs text-white/50">{t.import_warning_text}</p>
              <code className="block text-xs text-emerald-400 bg-black/30 rounded-xl p-3 font-mono overflow-x-auto">
                Prénom;Nom;Email;Téléphone;Entreprise;Statut;Valeur;Notes
              </code>
              <p className="text-[10px] text-white/30">{t.import_statuses}</p>
              <p className="text-xs text-white/40 mt-2">{t.import_warning_footer}</p>
            </div>

            {/* LLM Prompt */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-white/40">{t.import_prompt_title}</p>
              <div className="relative">
                <pre className="text-[11px] text-white/50 bg-black/30 rounded-xl p-4 pr-12 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto border border-white/[0.05]">
                  {LLM_PROMPT}
                </pre>
                <button
                  onClick={handleCopyPrompt}
                  className="absolute top-3 right-3 rounded-lg p-1.5 text-white/30 hover:text-white hover:bg-white/10 transition-colors"
                  title={t.import_prompt_copy}
                >
                  {promptCopied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              {promptCopied && <p className="text-xs text-emerald-400">{t.import_prompt_copied}</p>}
            </div>

            {/* File input */}
            <div>
              <label className="block text-xs font-medium text-white/40 mb-2">{t.import_file_label}</label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-3 rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-4 cursor-pointer hover:border-emerald-500/30 transition-colors"
              >
                <FileUp className="h-5 w-5 text-white/30" />
                <span className="text-sm text-white/40">
                  {importFile ? importFile.name : t.import_file_placeholder}
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={e => setImportFile(e.target.files?.[0] || null)}
              />
            </div>

            {/* Import button */}
            <button
              onClick={handleImport}
              disabled={!importFile || !importOfferId || isImporting}
              className="w-full flex items-center justify-center gap-2 rounded-full bg-emerald-500 py-3 text-sm font-semibold text-black transition-all hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isImporting ? (
                <div className="h-4 w-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {t.import_btn}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/** Parse a single CSV line respecting quoted fields with semicolons inside */
function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ';') {
        result.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }
  result.push(current)
  return result
}
