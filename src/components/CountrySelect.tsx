import { COUNTRY_ORDER, COUNTRY_RULES, normalizeCountry, type CountryCode } from '../lib/countryRules'

// Sélecteur de pays de facturation. La valeur stockée reste le nom du pays en toutes lettres (« France », « Belgique »…)
// pour rester compatible avec les données existantes et avec ce qui est imprimé sur les factures.
// « Autre pays » ouvre un champ libre pour écrire le nom du pays.
type Props = {
  value: string
  onChange: (value: string) => void
  lang?: 'fr' | 'en'
  className?: string
  inputClassName?: string
  id?: string
}

export function CountrySelect({ value, onChange, lang = 'fr', className = '', inputClassName, id }: Props) {
  const code = normalizeCountry(value)
  const isOther = code === 'OTHER'
  const pick = (c: CountryCode) => onChange(c === 'OTHER' ? 'Autre pays' : COUNTRY_RULES[c].name.fr)
  return (
    <div className="space-y-2">
      <select id={id} value={isOther ? 'OTHER' : code} onChange={(e) => pick(e.target.value as CountryCode)} className={className}>
        {COUNTRY_ORDER.map((c) => (
          <option key={c} value={c}>{COUNTRY_RULES[c].flag} {COUNTRY_RULES[c].name[lang]}</option>
        ))}
      </select>
      {isOther && (
        <input
          type="text"
          value={normalizeCountry(value) === 'OTHER' && !/^(other|autre( pays)?)$/i.test(value.trim()) ? value : ''}
          onChange={(e) => onChange(e.target.value || 'Autre pays')}
          placeholder={lang === 'fr' ? 'Nom du pays' : 'Country name'}
          className={inputClassName || className}
        />
      )}
    </div>
  )
}
