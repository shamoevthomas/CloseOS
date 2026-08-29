import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  COUNTRY_CODES,
  filterCountries,
  flagForCode,
  formatPhoneByCountry,
  phonePlaceholder,
  parsePhoneValue,
  buildFullPhone,
} from '../../lib/phone'

// Réexportés : plusieurs écrans les importent déjà depuis ce composant.
export { parsePhoneValue, buildFullPhone, COUNTRY_CODES }

interface PhoneInputProps {
  value: string
  onChange: (fullPhone: string) => void
  className?: string
  inputClassName?: string
  compact?: boolean
}

export function PhoneInput({ value, onChange, className = '', inputClassName, compact = false }: PhoneInputProps) {
  const { countryCode: initCode, localNumber: initLocal } = parsePhoneValue(value)
  const [countryCode, setCountryCode] = useState(initCode)
  const [localNumber, setLocalNumber] = useState(initLocal)
  const [showPicker, setShowPicker] = useState(false)
  const [search, setSearch] = useState('')
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Sync if external value changes
  useEffect(() => {
    const { countryCode: newCode, localNumber: newLocal } = parsePhoneValue(value)
    setCountryCode(newCode)
    setLocalNumber(newLocal)
  }, [value])

  const handleLocalChange = (raw: string) => {
    const formatted = formatPhoneByCountry(raw, countryCode)
    setLocalNumber(formatted)
    onChange(buildFullPhone(countryCode, formatted))
  }

  const handleCountryChange = (code: string) => {
    setCountryCode(code)
    setLocalNumber('')
    setShowPicker(false)
    setSearch('')
    onChange('')
  }

  const placeholder = phonePlaceholder(countryCode)
  const filtered = filterCountries(search)
  const currentFlag = flagForCode(countryCode)

  const baseInputCls = inputClassName || (compact
    ? 'flex-1 min-w-0 bg-transparent border-none py-1 px-2 text-xs text-stone-900 dark:text-white focus:ring-0 focus:outline-none'
    : 'flex-1 min-w-0 bg-transparent border-none py-2.5 px-3 text-sm text-stone-900 dark:text-white focus:ring-0 focus:outline-none font-medium')

  return (
    <div className={`relative flex items-center rounded-xl bg-stone-100 dark:bg-neutral-800 ${className}`} ref={pickerRef}>
      <button
        type="button"
        onClick={() => { setShowPicker(!showPicker); setSearch('') }}
        className={`flex items-center gap-1 shrink-0 ${compact ? 'pl-2 pr-1 py-1' : 'pl-3 pr-1.5 py-2.5'} hover:bg-stone-200/50 dark:hover:bg-neutral-700/50 rounded-l-xl transition-colors`}
      >
        <span className={compact ? 'text-sm' : 'text-base'}>{currentFlag}</span>
        <span className={`${compact ? 'text-[10px]' : 'text-xs'} text-stone-500 dark:text-neutral-400 font-medium`}>{countryCode}</span>
        <ChevronDown className={`${compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} text-stone-400 dark:text-neutral-500`} />
      </button>
      <div className="w-px h-5 bg-stone-200 dark:bg-neutral-700 shrink-0" />
      <input
        type="tel"
        value={localNumber}
        onChange={(e) => handleLocalChange(e.target.value)}
        placeholder={placeholder}
        className={baseInputCls}
      />
      {showPicker && (
        <div className="absolute top-full left-0 z-50 mt-1 w-64 max-h-60 overflow-y-auto rounded-xl border border-stone-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-xl">
          <div className="sticky top-0 bg-white dark:bg-neutral-900 border-b border-stone-100 dark:border-neutral-800 p-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un pays..."
              className="w-full rounded-lg border border-stone-200 dark:border-neutral-700 bg-stone-50 dark:bg-neutral-800 px-3 py-1.5 text-sm text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-stone-900/20 dark:focus:ring-white/20"
              autoFocus
            />
          </div>
          {filtered.map((c, i) => (
            <button
              key={`${c.code}-${c.name}-${i}`}
              type="button"
              onClick={() => handleCountryChange(c.code)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-stone-50 dark:hover:bg-neutral-800 transition-colors ${countryCode === c.code ? 'bg-stone-100 dark:bg-neutral-800 font-medium' : 'text-stone-700 dark:text-neutral-300'}`}
            >
              <span className="text-base">{c.flag}</span>
              <span className="flex-1 truncate">{c.name}</span>
              <span className="text-xs text-stone-400 dark:text-neutral-500 font-medium">{c.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
