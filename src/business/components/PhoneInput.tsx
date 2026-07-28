import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

const PHONE_FORMATS: Record<string, { maxDigits: number; groups: number[] }> = {
  '+33': { maxDigits: 9, groups: [1, 2, 2, 2, 2] },
  '+32': { maxDigits: 9, groups: [3, 2, 2, 2] },
  '+41': { maxDigits: 9, groups: [2, 3, 2, 2] },
  '+352': { maxDigits: 9, groups: [3, 3, 3] },
  '+377': { maxDigits: 8, groups: [2, 2, 2, 2] },
  '+1': { maxDigits: 10, groups: [3, 3, 4] },
  '+44': { maxDigits: 10, groups: [4, 3, 3] },
  '+49': { maxDigits: 11, groups: [3, 4, 4] },
  '+34': { maxDigits: 9, groups: [3, 3, 3] },
  '+39': { maxDigits: 10, groups: [3, 3, 4] },
  '+351': { maxDigits: 9, groups: [3, 3, 3] },
  '+31': { maxDigits: 9, groups: [1, 2, 2, 2, 2] },
  '+212': { maxDigits: 9, groups: [3, 3, 3] },
  '+216': { maxDigits: 8, groups: [2, 3, 3] },
  '+213': { maxDigits: 9, groups: [3, 3, 3] },
}

function formatPhoneByCountry(raw: string, code: string): string {
  // On retire le 0 initial (préfixe national) : avec l'indicatif, le numéro
  // significatif ne le porte jamais. Ça évite de « manger » un chiffre et de
  // bloquer la saisie du numéro complet (ex. FR : 06 76 70 10 17 → 6 76 70 10 17).
  const digits = raw.replace(/\D/g, '').replace(/^0+/, '')
  const fmt = PHONE_FORMATS[code]
  if (!fmt) return digits.slice(0, 15)
  const limited = digits.slice(0, fmt.maxDigits)
  const parts: string[] = []
  let idx = 0
  for (const g of fmt.groups) {
    if (idx >= limited.length) break
    parts.push(limited.slice(idx, idx + g))
    idx += g
  }
  return parts.join(' ')
}

const COUNTRY_CODES = [
  { code: '+33', flag: '🇫🇷', name: 'France' },
  { code: '+32', flag: '🇧🇪', name: 'Belgique' },
  { code: '+41', flag: '🇨🇭', name: 'Suisse' },
  { code: '+352', flag: '🇱🇺', name: 'Luxembourg' },
  { code: '+377', flag: '🇲🇨', name: 'Monaco' },
  { code: '+1', flag: '🇺🇸', name: 'États-Unis' },
  { code: '+1', flag: '🇨🇦', name: 'Canada' },
  { code: '+44', flag: '🇬🇧', name: 'Royaume-Uni' },
  { code: '+49', flag: '🇩🇪', name: 'Allemagne' },
  { code: '+34', flag: '🇪🇸', name: 'Espagne' },
  { code: '+39', flag: '🇮🇹', name: 'Italie' },
  { code: '+351', flag: '🇵🇹', name: 'Portugal' },
  { code: '+31', flag: '🇳🇱', name: 'Pays-Bas' },
  { code: '+212', flag: '🇲🇦', name: 'Maroc' },
  { code: '+216', flag: '🇹🇳', name: 'Tunisie' },
  { code: '+213', flag: '🇩🇿', name: 'Algérie' },
  { code: '+225', flag: '🇨🇮', name: 'Côte d\'Ivoire' },
  { code: '+221', flag: '🇸🇳', name: 'Sénégal' },
  { code: '+237', flag: '🇨🇲', name: 'Cameroun' },
  { code: '+243', flag: '🇨🇩', name: 'RD Congo' },
  { code: '+261', flag: '🇲🇬', name: 'Madagascar' },
  { code: '+242', flag: '🇨🇬', name: 'Congo' },
  { code: '+228', flag: '🇹🇬', name: 'Togo' },
  { code: '+229', flag: '🇧🇯', name: 'Bénin' },
  { code: '+226', flag: '🇧🇫', name: 'Burkina Faso' },
  { code: '+223', flag: '🇲🇱', name: 'Mali' },
  { code: '+224', flag: '🇬🇳', name: 'Guinée' },
  { code: '+222', flag: '🇲🇷', name: 'Mauritanie' },
  { code: '+235', flag: '🇹🇩', name: 'Tchad' },
  { code: '+241', flag: '🇬🇦', name: 'Gabon' },
  { code: '+250', flag: '🇷🇼', name: 'Rwanda' },
  { code: '+257', flag: '🇧🇮', name: 'Burundi' },
  { code: '+262', flag: '🇷🇪', name: 'La Réunion' },
  { code: '+596', flag: '🇲🇶', name: 'Martinique' },
  { code: '+590', flag: '🇬🇵', name: 'Guadeloupe' },
  { code: '+594', flag: '🇬🇫', name: 'Guyane' },
  { code: '+687', flag: '🇳🇨', name: 'Nouvelle-Calédonie' },
  { code: '+689', flag: '🇵🇫', name: 'Polynésie française' },
  { code: '+55', flag: '🇧🇷', name: 'Brésil' },
  { code: '+52', flag: '🇲🇽', name: 'Mexique' },
  { code: '+81', flag: '🇯🇵', name: 'Japon' },
  { code: '+86', flag: '🇨🇳', name: 'Chine' },
  { code: '+91', flag: '🇮🇳', name: 'Inde' },
  { code: '+971', flag: '🇦🇪', name: 'Émirats arabes unis' },
  { code: '+966', flag: '🇸🇦', name: 'Arabie saoudite' },
  { code: '+90', flag: '🇹🇷', name: 'Turquie' },
  { code: '+7', flag: '🇷🇺', name: 'Russie' },
  { code: '+48', flag: '🇵🇱', name: 'Pologne' },
  { code: '+46', flag: '🇸🇪', name: 'Suède' },
  { code: '+47', flag: '🇳🇴', name: 'Norvège' },
  { code: '+45', flag: '🇩🇰', name: 'Danemark' },
  { code: '+358', flag: '🇫🇮', name: 'Finlande' },
  { code: '+43', flag: '🇦🇹', name: 'Autriche' },
  { code: '+30', flag: '🇬🇷', name: 'Grèce' },
  { code: '+353', flag: '🇮🇪', name: 'Irlande' },
  { code: '+420', flag: '🇨🇿', name: 'Tchéquie' },
  { code: '+40', flag: '🇷🇴', name: 'Roumanie' },
  { code: '+36', flag: '🇭🇺', name: 'Hongrie' },
  { code: '+380', flag: '🇺🇦', name: 'Ukraine' },
  { code: '+972', flag: '🇮🇱', name: 'Israël' },
  { code: '+20', flag: '🇪🇬', name: 'Égypte' },
  { code: '+27', flag: '🇿🇦', name: 'Afrique du Sud' },
  { code: '+234', flag: '🇳🇬', name: 'Nigeria' },
  { code: '+254', flag: '🇰🇪', name: 'Kenya' },
  { code: '+255', flag: '🇹🇿', name: 'Tanzanie' },
  { code: '+233', flag: '🇬🇭', name: 'Ghana' },
  { code: '+251', flag: '🇪🇹', name: 'Éthiopie' },
  { code: '+256', flag: '🇺🇬', name: 'Ouganda' },
  { code: '+61', flag: '🇦🇺', name: 'Australie' },
  { code: '+64', flag: '🇳🇿', name: 'Nouvelle-Zélande' },
  { code: '+82', flag: '🇰🇷', name: 'Corée du Sud' },
  { code: '+65', flag: '🇸🇬', name: 'Singapour' },
  { code: '+60', flag: '🇲🇾', name: 'Malaisie' },
  { code: '+66', flag: '🇹🇭', name: 'Thaïlande' },
  { code: '+84', flag: '🇻🇳', name: 'Vietnam' },
  { code: '+62', flag: '🇮🇩', name: 'Indonésie' },
  { code: '+63', flag: '🇵🇭', name: 'Philippines' },
  { code: '+92', flag: '🇵🇰', name: 'Pakistan' },
  { code: '+880', flag: '🇧🇩', name: 'Bangladesh' },
  { code: '+94', flag: '🇱🇰', name: 'Sri Lanka' },
  { code: '+57', flag: '🇨🇴', name: 'Colombie' },
  { code: '+56', flag: '🇨🇱', name: 'Chili' },
  { code: '+54', flag: '🇦🇷', name: 'Argentine' },
  { code: '+58', flag: '🇻🇪', name: 'Venezuela' },
  { code: '+51', flag: '🇵🇪', name: 'Pérou' },
  { code: '+593', flag: '🇪🇨', name: 'Équateur' },
  { code: '+502', flag: '🇬🇹', name: 'Guatemala' },
  { code: '+53', flag: '🇨🇺', name: 'Cuba' },
  { code: '+509', flag: '🇭🇹', name: 'Haïti' },
  { code: '+1', flag: '🇩🇴', name: 'République dominicaine' },
]

export function parsePhoneValue(fullPhone: string): { countryCode: string; localNumber: string } {
  if (!fullPhone) return { countryCode: '+33', localNumber: '' }
  const cleaned = fullPhone.replace(/\s+/g, ' ').trim()
  // Try to match longest country code first
  const sortedCodes = [...new Set(COUNTRY_CODES.map(c => c.code))].sort((a, b) => b.length - a.length)
  for (const code of sortedCodes) {
    if (cleaned.startsWith(code)) {
      const local = cleaned.slice(code.length).trim()
      return { countryCode: code, localNumber: formatPhoneByCountry(local, code) }
    }
  }
  return { countryCode: '+33', localNumber: formatPhoneByCountry(cleaned.replace(/^\+?\d{1,3}\s*/, ''), '+33') }
}

export function buildFullPhone(countryCode: string, localNumber: string): string {
  const digits = localNumber.replace(/\D/g, '')
  if (!digits) return ''
  return `${countryCode} ${localNumber}`
}

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

  const placeholder = PHONE_FORMATS[countryCode]
    ? PHONE_FORMATS[countryCode].groups.map(g => '0'.repeat(g)).join(' ')
    : '6 12 34 56 78'

  const filtered = COUNTRY_CODES.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.code.includes(search)
  )

  const currentFlag = COUNTRY_CODES.find(c => c.code === countryCode)?.flag || '🌍'

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
