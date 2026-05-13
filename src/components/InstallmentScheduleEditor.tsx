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
      ? 'border-white/10 bg-white/5 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
      : 'border-stone-200 bg-white text-stone-900 focus:border-emerald-500 focus:ring-emerald-500/20',
    readOnly && 'opacity-60 cursor-not-allowed'
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className={cn('text-sm font-medium', dark ? 'text-white/80' : 'text-stone-700')}>
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
            <span className={cn('text-sm font-medium w-20 shrink-0', dark ? 'text-white/70' : 'text-stone-600')}>
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
              <span className={cn('absolute right-3 top-1/2 -translate-y-1/2 text-sm', dark ? 'text-white/40' : 'text-stone-400')}>€</span>
            </div>
            {!readOnly && value.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(idx)}
                className={cn(
                  'p-1.5 rounded-lg transition-colors',
                  dark ? 'text-white/40 hover:text-red-400 hover:bg-red-500/10' : 'text-stone-400 hover:text-red-600 hover:bg-red-50'
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
              dark ? 'border-white/15 text-white/60 hover:border-emerald-500 hover:text-emerald-400' : 'border-stone-200 text-stone-500 hover:border-emerald-500 hover:text-emerald-600'
            )}
          >
            <Plus className="h-4 w-4" /> {L.addRow}
          </button>
        )}
      </div>

      <div className={cn('flex justify-between items-center px-2 text-sm font-semibold', dark ? 'text-white' : 'text-stone-900')}>
        <span className={dark ? 'text-white/70' : 'text-stone-600'}>{L.total}</span>
        <span className="text-emerald-500">{total.toFixed(2)} €</span>
      </div>
    </div>
  )
}
