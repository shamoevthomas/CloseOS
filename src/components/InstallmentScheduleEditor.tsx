import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { cn } from '../lib/utils'

export interface ScheduleEntry {
  month: number
  amount: number
}

interface InstallmentScheduleEditorProps {
  value: ScheduleEntry[]
  onChange: (next: ScheduleEntry[]) => void
  readOnly?: boolean
  dark?: boolean
  labels?: {
    monthsCount?: string
    month?: string
    amount?: string
    total?: string
    addRow?: string
  }
}

const DEFAULT_LABELS = {
  monthsCount: 'Nombre de mois',
  month: 'Mois',
  amount: 'Montant',
  total: 'Total :',
  addRow: 'Ajouter une échéance',
}

export function InstallmentScheduleEditor({
  value,
  onChange,
  readOnly = false,
  dark = false,
  labels,
}: InstallmentScheduleEditorProps) {
  const L = { ...DEFAULT_LABELS, ...labels }
  const [count, setCount] = useState<number>(Math.max(value.length || 1, 1))

  useEffect(() => {
    if (count === value.length) return
    if (count > value.length) {
      const additions: ScheduleEntry[] = Array.from({ length: count - value.length }, (_, i) => ({
        month: value.length + i + 1,
        amount: 0,
      }))
      onChange([...value, ...additions])
    } else {
      onChange(value.slice(0, count).map((e, i) => ({ ...e, month: i + 1 })))
    }
  }, [count])

  const total = useMemo(() => value.reduce((s, e) => s + (Number(e.amount) || 0), 0), [value])

  const updateAmount = (index: number, raw: string) => {
    if (readOnly) return
    const amount = parseFloat(raw) || 0
    onChange(value.map((e, i) => (i === index ? { ...e, amount } : e)))
  }

  const removeRow = (index: number) => {
    if (readOnly) return
    const next = value.filter((_, i) => i !== index).map((e, i) => ({ ...e, month: i + 1 }))
    onChange(next)
    setCount(next.length || 1)
  }

  const inputCls = cn(
    'rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-all',
    dark
      ? 'border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white focus:border-sky-500 focus:ring-sky-500/20'
      : 'border-stone-200 bg-white dark:bg-[#1a1a1a] text-stone-900 focus:border-sky-500 focus:ring-sky-500/20',
    readOnly && 'opacity-60 cursor-not-allowed'
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className={cn('text-sm font-medium', dark ? 'text-slate-600 dark:text-neutral-300' : 'text-stone-700')}>
          {L.monthsCount}
        </label>
        <input
          type="number"
          min="1"
          max="36"
          value={count}
          onChange={(e) => setCount(Math.min(36, Math.max(1, parseInt(e.target.value) || 1)))}
          disabled={readOnly}
          className={cn(inputCls, 'w-24')}
        />
      </div>

      <div className="space-y-2 rounded-xl border p-3 max-h-64 overflow-y-auto">
        {value.map((entry, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span className={cn('text-sm font-medium w-20 shrink-0', dark ? 'text-slate-600 dark:text-neutral-300' : 'text-stone-600')}>
              {L.month} {entry.month}
            </span>
            <div className="relative flex-1">
              <input
                type="number"
                min="0"
                step="0.01"
                value={entry.amount || ''}
                onChange={(e) => updateAmount(idx, e.target.value)}
                placeholder="0.00"
                disabled={readOnly}
                className={cn(inputCls, 'w-full pr-8')}
              />
              <span className={cn('absolute right-3 top-1/2 -translate-y-1/2 text-sm', dark ? 'text-slate-400 dark:text-neutral-500' : 'text-stone-400')}>€</span>
            </div>
            {!readOnly && value.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(idx)}
                className={cn(
                  'p-1.5 rounded-lg transition-colors',
                  dark ? 'text-slate-400 dark:text-neutral-500 hover:text-red-600 hover:bg-red-500/10' : 'text-stone-400 hover:text-red-600 hover:bg-red-50'
                )}
                aria-label="Retirer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        {!readOnly && (
          <button
            type="button"
            onClick={() => setCount(count + 1)}
            className={cn(
              'w-full flex items-center justify-center gap-2 rounded-lg border border-dashed py-2 text-sm font-medium transition-colors',
              dark ? 'border-slate-200 dark:border-white/10 text-slate-500 dark:text-neutral-400 hover:border-sky-500 hover:text-sky-600' : 'border-stone-200 text-stone-500 hover:border-sky-500 hover:text-sky-600'
            )}
          >
            <Plus className="h-4 w-4" /> {L.addRow}
          </button>
        )}
      </div>

      <div className={cn('flex justify-between items-center px-2 text-sm font-semibold', dark ? 'text-slate-900 dark:text-white' : 'text-stone-900')}>
        <span className={dark ? 'text-slate-600 dark:text-neutral-300' : 'text-stone-600'}>{L.total}</span>
        <span className="text-sky-600 dark:text-sky-400">{total.toFixed(2)} €</span>
      </div>
    </div>
  )
}
