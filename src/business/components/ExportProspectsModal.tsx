import { useState, useMemo } from 'react'
import { X, Download, CheckSquare, Square, Calendar, Tag } from 'lucide-react'
import { cn } from '../../lib/utils'
import toast from 'react-hot-toast'
import type { BusinessProspect } from '../contexts/BusinessProspectsContext'
import type { CustomStage } from '../hooks/useCustomStages'
import { useBusinessLang } from '../i18n/BusinessLangContext'

interface BusinessTag {
  id: string
  owner_id: string
  name: string
  color: string
}

interface TeamMember {
  id: string
  first_name: string
  last_name: string
  role: string
  team_id?: string | null
}

interface Formula {
  id: string
  name: string
  price: number
}

interface Props {
  isOpen: boolean
  onClose: () => void
  prospects: BusinessProspect[]
  allTeamMembers: TeamMember[]
  formulas: Formula[]
  tags: BusinessTag[]
  prospectTags: Record<number, string[]>
  customStages: CustomStage[]
}

const ALL_STAGE_IDS = [
  { id: 'prospect', color: 'bg-blue-500' },
  { id: 'contacted', color: 'bg-sky-500' },
  { id: 'qualified', color: 'bg-purple-500' },
  { id: 'unqualified', color: 'bg-yellow-500' },
  { id: 'won', color: 'bg-emerald-500' },
  { id: 'followup', color: 'bg-orange-500' },
  { id: 'noanswer', color: 'bg-cyan-500' },
  { id: 'noshow', color: 'bg-slate-500' },
  { id: 'lost', color: 'bg-red-500' },
]

const COLUMN_KEYS = [
  'contact', 'firstName', 'lastName', 'email', 'phone', 'company', 'stage', 'value', 'offer', 'created_at', 'notes',
] as const

export function ExportProspectsModal({ isOpen, onClose, prospects, allTeamMembers, formulas, tags, prospectTags, customStages }: Props) {
  const { t, lang } = useBusinessLang()

  const STAGE_NAMES: Record<string, string> = useMemo(() => ({
    prospect: t.export_stage_prospect, contacted: t.export_stage_contacted, qualified: t.export_stage_qualified, unqualified: t.export_stage_unqualified,
    won: t.export_stage_won, followup: t.export_stage_followup, noanswer: t.export_stage_noanswer,
    noshow: t.export_stage_noshow, lost: t.export_stage_lost,
  }), [t])

  const ALL_STAGES = useMemo(() => ALL_STAGE_IDS.map(s => ({ ...s, name: STAGE_NAMES[s.id] || s.id })), [STAGE_NAMES])

  const PERIOD_OPTIONS = useMemo(() => [
    { label: t.export_period_all, days: 0 },
    { label: t.export_period_today, days: 1 },
    { label: t.export_period_7days, days: 7 },
    { label: t.export_period_30days, days: 30 },
    { label: t.export_period_90days, days: 90 },
  ], [t])

  const COLUMNS = useMemo(() => [
    { key: 'contact' as const, label: t.export_col_name, header: t.export_col_name },
    { key: 'firstName' as const, label: t.export_col_firstname, header: t.export_col_firstname },
    { key: 'lastName' as const, label: t.export_col_lastname, header: t.export_col_lastname },
    { key: 'email' as const, label: t.export_col_email, header: t.export_col_email },
    { key: 'phone' as const, label: t.export_col_phone, header: t.export_col_phone },
    { key: 'company' as const, label: t.export_col_company, header: t.export_col_company },
    { key: 'stage' as const, label: t.export_col_stage, header: t.export_col_stage },
    { key: 'value' as const, label: t.export_col_value, header: t.export_col_value },
    { key: 'offer' as const, label: t.export_col_offer, header: t.export_col_offer },
    { key: 'created_at' as const, label: t.export_col_created, header: t.export_col_created },
    { key: 'notes' as const, label: t.export_col_notes, header: t.export_col_notes },
  ], [t])

  const STAGE_LABELS: Record<string, string> = useMemo(() => ({
    prospect: t.export_stage_label_prospect, contacted: t.export_stage_label_contacted, qualified: t.export_stage_label_qualified,
    unqualified: t.export_stage_label_unqualified, won: t.export_stage_label_won,
    lost: t.export_stage_label_lost, noshow: t.export_stage_label_noshow,
    noanswer: t.export_stage_label_noanswer, followup: t.export_stage_label_followup,
  }), [t])

  // Filter state (independent from CRM page)
  const [selectedPeriod, setSelectedPeriod] = useState(0)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [selectedStages, setSelectedStages] = useState<string[]>([])
  const [selectedOffers, setSelectedOffers] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedColumns, setSelectedColumns] = useState<string[]>([...COLUMN_KEYS])

  const toggleMultiSelect = (arr: string[], setArr: (v: string[]) => void, val: string) => {
    setArr(arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val])
  }

  // Counts per filter value (computed on ALL prospects, not filtered)
  const filterCounts = useMemo(() => {
    const byStage: Record<string, number> = {}
    const byMember: Record<string, number> = {}
    const byOffer: Record<string, number> = {}
    const byTag: Record<string, number> = {}
    const byPeriod: Record<number, number> = {}
    const now = new Date()

    for (const p of prospects) {
      byStage[p.stage] = (byStage[p.stage] || 0) + 1
      if (p.assigned_to) byMember[p.assigned_to] = (byMember[p.assigned_to] || 0) + 1
      if (p.formula_id) byOffer[p.formula_id] = (byOffer[p.formula_id] || 0) + 1
      if (p.offer_id) byOffer[String(p.offer_id)] = (byOffer[String(p.offer_id)] || 0) + 1
      const pTags = prospectTags[p.id] || []
      for (const t of pTags) byTag[t] = (byTag[t] || 0) + 1
      if (p.created_at) {
        const created = new Date(p.created_at)
        for (const opt of PERIOD_OPTIONS) {
          if (opt.days === 0) continue
          const cutoff = new Date()
          cutoff.setDate(now.getDate() - opt.days)
          if (created >= cutoff) byPeriod[opt.days] = (byPeriod[opt.days] || 0) + 1
        }
      }
    }
    byPeriod[0] = prospects.length
    return { byStage, byMember, byOffer, byTag, byPeriod }
  }, [prospects, prospectTags])

  // Apply all filters
  const filteredProspects = useMemo(() => {
    let result = prospects

    // Period shortcut
    if (selectedPeriod > 0) {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - selectedPeriod)
      result = result.filter(p => p.created_at && new Date(p.created_at) >= cutoff)
    }

    // Date range (manual pickers override period shortcut if set)
    if (dateFrom) {
      const from = new Date(dateFrom)
      from.setHours(0, 0, 0, 0)
      result = result.filter(p => p.created_at && new Date(p.created_at) >= from)
    }
    if (dateTo) {
      const to = new Date(dateTo)
      to.setHours(23, 59, 59, 999)
      result = result.filter(p => p.created_at && new Date(p.created_at) <= to)
    }

    if (selectedMembers.length > 0) {
      result = result.filter(p => p.assigned_to && selectedMembers.includes(p.assigned_to))
    }

    if (selectedStages.length > 0) {
      result = result.filter(p => selectedStages.includes(p.stage))
    }

    if (selectedOffers.length > 0) {
      result = result.filter(p =>
        (p.formula_id && selectedOffers.includes(p.formula_id)) ||
        (p.offer_id && selectedOffers.includes(String(p.offer_id)))
      )
    }

    if (selectedTags.length > 0) {
      result = result.filter(p => {
        const pTags = prospectTags[p.id] || []
        return selectedTags.some(t => pTags.includes(t))
      })
    }

    return result
  }, [prospects, selectedPeriod, dateFrom, dateTo, selectedMembers, selectedStages, selectedOffers, selectedTags, prospectTags])

  // Sync period shortcut → date pickers
  const handlePeriodChange = (days: number) => {
    setSelectedPeriod(days)
    if (days === 0) {
      setDateFrom('')
      setDateTo('')
    } else {
      const to = new Date()
      const from = new Date()
      from.setDate(from.getDate() - days)
      setDateFrom(from.toISOString().split('T')[0])
      setDateTo(to.toISOString().split('T')[0])
    }
  }

  // Sync date pickers → clear period shortcut
  const handleDateFromChange = (val: string) => {
    setDateFrom(val)
    setSelectedPeriod(0)
  }
  const handleDateToChange = (val: string) => {
    setDateTo(val)
    setSelectedPeriod(0)
  }

  const allColumnsSelected = selectedColumns.length === COLUMNS.length
  const noneSelected = selectedColumns.length === 0

  const toggleColumn = (key: string) => {
    setSelectedColumns(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const toggleAllColumns = () => {
    setSelectedColumns(allColumnsSelected ? [] : COLUMNS.map(c => c.key))
  }

  const formatValue = (prospect: BusinessProspect, key: string): string => {
    const val = (prospect as any)[key]
    if (val == null || val === '') return ''
    if (key === 'stage') return STAGE_LABELS[val] || val
    if (key === 'created_at') return new Date(val).toLocaleDateString('fr-FR')
    return String(val)
  }

  const handleExport = () => {
    const cols = COLUMNS.filter(c => selectedColumns.includes(c.key))
    const headerRow = cols.map(c => c.header).join(';')
    const rows = filteredProspects.map(p =>
      cols.map(c => {
        const str = formatValue(p, c.key).replace(/"/g, '""')
        return str.includes(';') || str.includes('"') || str.includes('\n') ? `"${str}"` : str
      }).join(';')
    )
    const csv = [headerRow, ...rows].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `prospects_export_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`${filteredProspects.length} prospects exportés`)
    onClose()
  }

  // Pill button style helper
  const pillCls = (active: boolean) => cn(
    'px-2.5 py-1 text-xs font-medium rounded-full transition-all',
    active
      ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-900'
      : 'bg-stone-100 dark:bg-neutral-800 text-stone-600 dark:text-neutral-300 hover:bg-stone-200 dark:hover:bg-neutral-700'
  )

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 dark:bg-black/50 backdrop-blur-md p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl rounded-xl shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)] border border-stone-200/20 dark:border-neutral-700 p-6 relative animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-extrabold tracking-tight text-stone-900 dark:text-white">{t.export_title}</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 dark:hover:text-neutral-300 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ═══ FILTERS SECTION ═══ */}
        <div className="mb-5 space-y-4">
          <h3 className="text-sm font-extrabold text-stone-900 dark:text-white">{t.export_filters}</h3>

          {/* Period shortcuts */}
          <div>
            <label className="block text-xs font-medium text-stone-500 dark:text-neutral-400 mb-2">
              <Calendar className="h-3 w-3 inline mr-1" />{t.export_period_label}
            </label>
            <div className="flex flex-wrap gap-1">
              {PERIOD_OPTIONS.map(p => (
                <button
                  key={p.days}
                  onClick={() => handlePeriodChange(p.days)}
                  className={pillCls(selectedPeriod === p.days)}
                >
                  {p.label} <span className="opacity-60">({filterCounts.byPeriod[p.days] || 0})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Members */}
          {allTeamMembers.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-stone-500 dark:text-neutral-400 mb-2">{t.export_closer_setter}</label>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                {allTeamMembers.map(m => (
                  <button
                    key={m.id}
                    onClick={() => toggleMultiSelect(selectedMembers, setSelectedMembers, m.id)}
                    className={pillCls(selectedMembers.includes(m.id))}
                  >
                    {m.first_name} {m.last_name} <span className="opacity-60">({filterCounts.byMember[m.id] || 0})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stages */}
          <div>
            <label className="block text-xs font-medium text-stone-500 dark:text-neutral-400 mb-2">{t.export_status_label}</label>
            <div className="flex flex-wrap gap-1">
              {ALL_STAGES.map(s => (
                <button
                  key={s.id}
                  onClick={() => toggleMultiSelect(selectedStages, setSelectedStages, s.id)}
                  className={cn(pillCls(selectedStages.includes(s.id)), 'flex items-center gap-1')}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full', s.color)} />
                  {s.name} <span className="opacity-60">({filterCounts.byStage[s.id] || 0})</span>
                </button>
              ))}
              {customStages.map(cs => (
                <button
                  key={`custom_${cs.id}`}
                  onClick={() => toggleMultiSelect(selectedStages, setSelectedStages, `custom_${cs.id}`)}
                  className={cn(pillCls(selectedStages.includes(`custom_${cs.id}`)), 'flex items-center gap-1')}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cs.color }} />
                  {cs.name} <span className="opacity-60">({filterCounts.byStage[`custom_${cs.id}`] || 0})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Offers */}
          {formulas.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-stone-500 dark:text-neutral-400 mb-2">{t.export_offer_formula}</label>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                {formulas.map(f => (
                  <button
                    key={f.id}
                    onClick={() => toggleMultiSelect(selectedOffers, setSelectedOffers, f.id)}
                    className={pillCls(selectedOffers.includes(f.id))}
                  >
                    {f.name} <span className="opacity-60">({filterCounts.byOffer[f.id] || 0})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-stone-500 dark:text-neutral-400 mb-2">
                <Tag className="h-3 w-3 inline mr-1" />{t.export_tags_label}
              </label>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                {tags.map(t => (
                  <button
                    key={t.id}
                    onClick={() => toggleMultiSelect(selectedTags, setSelectedTags, t.id)}
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium rounded-full transition-all flex items-center gap-1',
                      selectedTags.includes(t.id)
                        ? 'text-white'
                        : 'bg-stone-100 dark:bg-neutral-800 text-stone-600 dark:text-neutral-300 hover:bg-stone-200 dark:hover:bg-neutral-700'
                    )}
                    style={selectedTags.includes(t.id) ? { backgroundColor: t.color } : {}}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: t.color }} />
                    {t.name} <span className="opacity-60">({filterCounts.byTag[t.id] || 0})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ═══ DATE RANGE (manual) ═══ */}
        <div className="mb-5">
          <h3 className="text-sm font-bold text-stone-700 dark:text-neutral-300 mb-2">{t.export_custom_period}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-stone-500 dark:text-neutral-500 mb-1 block">{t.export_date_from}</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => handleDateFromChange(e.target.value)}
                className="w-full rounded-xl border border-stone-200 dark:border-white/10 px-3 py-2 text-sm text-stone-900 dark:text-white dark:bg-neutral-800 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
              />
            </div>
            <div>
              <label className="text-xs text-stone-500 dark:text-neutral-500 mb-1 block">{t.export_date_to}</label>
              <input
                type="date"
                value={dateTo}
                onChange={e => handleDateToChange(e.target.value)}
                className="w-full rounded-xl border border-stone-200 dark:border-white/10 px-3 py-2 text-sm text-stone-900 dark:text-white dark:bg-neutral-800 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
              />
            </div>
          </div>
        </div>

        {/* ═══ COLUMNS ═══ */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-stone-700 dark:text-neutral-300">{t.export_columns}</h3>
            <button onClick={toggleAllColumns} className="text-xs font-medium text-stone-500 dark:text-neutral-400 hover:text-stone-700 dark:hover:text-neutral-200 transition-colors">
              {allColumnsSelected ? t.export_deselect_all : t.export_select_all}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {COLUMNS.map(col => (
              <button
                key={col.key}
                onClick={() => toggleColumn(col.key)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-700 dark:text-neutral-300 hover:bg-stone-50 dark:hover:bg-neutral-800 transition-colors text-left"
              >
                {selectedColumns.includes(col.key)
                  ? <CheckSquare className="h-4 w-4 text-stone-900 dark:text-white shrink-0" />
                  : <Square className="h-4 w-4 text-stone-300 dark:text-neutral-600 shrink-0" />
                }
                {col.label}
              </button>
            ))}
          </div>
        </div>

        {/* ═══ EXPORT BUTTON ═══ */}
        <button
          onClick={handleExport}
          disabled={noneSelected}
          className="w-full flex items-center justify-center gap-2 rounded-full bg-stone-900 dark:bg-white px-4 py-3 text-sm font-extrabold tracking-tight text-white dark:text-stone-900 hover:opacity-90 shadow-lg shadow-stone-900/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download className="h-4 w-4" />
          Exporter ({filteredProspects.length} prospect{filteredProspects.length !== 1 ? 's' : ''})
        </button>
      </div>
    </div>
  )
}
