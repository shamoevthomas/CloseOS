import { useState, useMemo, useRef, useEffect } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import { TIMEZONE_OPTIONS, ALL_IANA_TIMEZONES, getTimezoneLabel } from '../../lib/timezone'
import { cn } from '../../lib/utils'

type Props = {
  value: string
  onChange: (tz: string) => void
  className?: string
  placeholder?: string
}

const OTHER_SENTINEL = '__other__'

export function TimezonePicker({ value, onChange, className, placeholder = 'Fuseau horaire' }: Props) {
  // The dropdown shows the common list. If the current value isn't in it, we
  // surface it at the top so the picker stays consistent.
  const valueInCommon = !value || TIMEZONE_OPTIONS.includes(value)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (searchOpen) setTimeout(() => inputRef.current?.focus(), 0)
  }, [searchOpen])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return ALL_IANA_TIMEZONES.slice(0, 50)
    return ALL_IANA_TIMEZONES.filter(tz => tz.toLowerCase().includes(q)).slice(0, 50)
  }, [query])

  if (searchOpen) {
    return (
      <div className={cn('rounded-xl border border-[#c4c7c7]/30 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-hidden', className)}>
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[#c4c7c7]/20 dark:border-neutral-700">
          <Search className="h-4 w-4 text-stone-400" strokeWidth={1.5} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un fuseau (ex: Tbilisi, Auckland…)"
            className="flex-1 bg-transparent text-sm text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => { setSearchOpen(false); setQuery('') }}
            className="rounded-full p-1 text-stone-400 hover:bg-[#f5f3f2] dark:hover:bg-neutral-700 hover:text-stone-700 dark:hover:text-neutral-200"
            aria-label="Fermer la recherche"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
        <div className="max-h-56 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="px-3 py-3 text-xs text-stone-500 dark:text-neutral-400">Aucun fuseau trouvé.</p>
          )}
          {filtered.map(tz => (
            <button
              key={tz}
              type="button"
              onClick={() => { onChange(tz); setSearchOpen(false); setQuery('') }}
              className={cn(
                'w-full text-left px-3 py-2 text-sm hover:bg-[#f5f3f2] dark:hover:bg-neutral-700 transition-colors',
                tz === value ? 'bg-[#f5f3f2] dark:bg-neutral-700/70 text-stone-900 dark:text-white font-semibold' : 'text-stone-700 dark:text-neutral-200'
              )}
            >
              {getTimezoneLabel(tz)} <span className="text-stone-400 text-xs">— {tz}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('relative', className)}>
      <select
        value={value && valueInCommon ? value : (value ? value : '')}
        onChange={(e) => {
          const v = e.target.value
          if (v === OTHER_SENTINEL) {
            setSearchOpen(true)
            return
          }
          onChange(v)
        }}
        className="w-full appearance-none rounded-xl border border-[#c4c7c7]/30 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-4 py-2.5 pr-10 text-sm text-stone-900 dark:text-white focus:outline-none focus:border-stone-900 dark:focus:border-white"
      >
        <option value="">{placeholder}</option>
        {!valueInCommon && value && (
          <option value={value}>{getTimezoneLabel(value)} — {value}</option>
        )}
        {TIMEZONE_OPTIONS.map(tz => (
          <option key={tz} value={tz}>{getTimezoneLabel(tz)}</option>
        ))}
        <option value={OTHER_SENTINEL}>— Autre… (rechercher)</option>
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none h-4 w-4 text-stone-400 dark:text-neutral-500" strokeWidth={1.5} />
    </div>
  )
}
