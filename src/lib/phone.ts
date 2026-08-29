/**
 * Source unique des indicatifs téléphoniques + du formatage des numéros.
 *
 * Avant, chaque écran (page de capture, capture CRM, page de rendez-vous,
 * PhoneInput Business) embarquait sa propre copie de la liste : elles avaient
 * divergé (10 / 15 / 90 pays selon la page). Tout passe désormais par ici.
 */
import { COUNTRY_CODES as ALL_COUNTRIES, flagOf } from './countryCodes'

export type PhoneCountry = { code: string; flag: string; name: string; iso: string }

/** Pays épinglés en tête du sélecteur (marchés principaux), dans cet ordre. */
const PRIORITY_ISO = [
  'FR', 'BE', 'CH', 'LU', 'MC', 'US', 'CA', 'GB', 'DE', 'ES', 'IT', 'PT', 'NL',
  'MA', 'TN', 'DZ', 'CI', 'SN', 'CM', 'CD', 'MG', 'CG', 'TG', 'BJ', 'BF', 'ML',
  'GN', 'MR', 'TD', 'GA', 'RW', 'BI', 'RE', 'MQ', 'GP', 'GF', 'NC', 'PF',
]

const toPhoneCountry = (c: { name: string; iso: string; dial: string }): PhoneCountry => ({
  code: c.dial,
  flag: flagOf(c.iso),
  name: c.name,
  iso: c.iso,
})

/** Tous les pays : les prioritaires en tête, puis le reste par ordre alphabétique. */
export const COUNTRY_CODES: PhoneCountry[] = [
  ...PRIORITY_ISO
    .map(iso => ALL_COUNTRIES.find(c => c.iso === iso))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map(toPhoneCountry),
  ...ALL_COUNTRIES
    .filter(c => !PRIORITY_ISO.includes(c.iso))
    .map(toPhoneCountry),
]

/** Drapeau de l'indicatif sélectionné (premier pays correspondant). */
export const flagForCode = (code: string): string =>
  COUNTRY_CODES.find(c => c.code === code)?.flag || '🌍'

/** Normalise pour une recherche insensible à la casse et aux accents. */
const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/** Filtre la liste sur le nom du pays ou l'indicatif. */
export const filterCountries = (query: string): PhoneCountry[] => {
  const q = normalize(query.trim())
  if (!q) return COUNTRY_CODES
  return COUNTRY_CODES.filter(c => normalize(c.name).includes(q) || c.code.includes(q))
}

/**
 * Formats de saisie par indicatif.
 * `trunkZero` : le 0 national ne se met pas derrière l'indicatif (FR 06… → 6…).
 * L'Italie ou le Luxembourg, eux, gardent leurs chiffres tels quels.
 */
export const PHONE_FORMATS: Record<string, { maxDigits: number; groups: number[]; trunkZero?: boolean }> = {
  '+33': { maxDigits: 9, groups: [1, 2, 2, 2, 2], trunkZero: true },  // France : 6 12 34 56 78
  '+32': { maxDigits: 9, groups: [3, 2, 2, 2], trunkZero: true },     // Belgique : 456 12 34 56
  '+41': { maxDigits: 9, groups: [2, 3, 2, 2], trunkZero: true },     // Suisse : 79 123 45 67
  '+352': { maxDigits: 9, groups: [3, 3, 3] },                        // Luxembourg (pas de 0)
  '+377': { maxDigits: 8, groups: [2, 2, 2, 2] },                     // Monaco (pas de 0)
  '+1': { maxDigits: 10, groups: [3, 3, 4] },                         // US/CA : 555 123 4567
  '+44': { maxDigits: 10, groups: [4, 3, 3], trunkZero: true },       // UK : 7911 123 456
  '+49': { maxDigits: 11, groups: [3, 4, 4], trunkZero: true },       // Allemagne
  '+34': { maxDigits: 9, groups: [3, 3, 3] },                         // Espagne : 612 345 678
  '+39': { maxDigits: 10, groups: [3, 3, 4] },                        // Italie (garde le 0 des fixes)
  '+351': { maxDigits: 9, groups: [3, 3, 3] },                        // Portugal (pas de 0)
  '+31': { maxDigits: 9, groups: [1, 2, 2, 2, 2], trunkZero: true },  // Pays-Bas
  '+212': { maxDigits: 9, groups: [3, 3, 3], trunkZero: true },       // Maroc
  '+216': { maxDigits: 8, groups: [2, 3, 3] },                        // Tunisie (pas de 0)
  '+213': { maxDigits: 9, groups: [3, 3, 3], trunkZero: true },       // Algérie
}

/** Découpe et limite la saisie selon le pays. Pays sans format : 15 chiffres max. */
export function formatPhoneByCountry(raw: string, code: string): string {
  let digits = raw.replace(/\D/g, '')
  const fmt = PHONE_FORMATS[code]
  if (!fmt) return digits.slice(0, 15)
  if (fmt.trunkZero) digits = digits.replace(/^0+/, '')
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

/** Exemple de saisie affiché en placeholder pour l'indicatif courant. */
export const phonePlaceholder = (code: string): string =>
  PHONE_FORMATS[code] ? PHONE_FORMATS[code].groups.map(g => '0'.repeat(g)).join(' ') : '6 12 34 56 78'

/** Sépare un numéro stocké (« +33 6 12 … ») en indicatif + numéro local. */
export function parsePhoneValue(fullPhone: string): { countryCode: string; localNumber: string } {
  if (!fullPhone) return { countryCode: '+33', localNumber: '' }
  const cleaned = fullPhone.replace(/\s+/g, ' ').trim()
  // Indicatifs les plus longs d'abord (+1268 avant +1)
  const sortedCodes = [...new Set(COUNTRY_CODES.map(c => c.code))].sort((a, b) => b.length - a.length)
  for (const code of sortedCodes) {
    if (cleaned.startsWith(code)) {
      const local = cleaned.slice(code.length).trim()
      return { countryCode: code, localNumber: formatPhoneByCountry(local, code) }
    }
  }
  return { countryCode: '+33', localNumber: formatPhoneByCountry(cleaned.replace(/^\+?\d{1,3}\s*/, ''), '+33') }
}

/** Recompose le numéro stocké à partir de l'indicatif et du numéro local. */
export function buildFullPhone(countryCode: string, localNumber: string): string {
  const digits = localNumber.replace(/\D/g, '')
  if (!digits) return ''
  return `${countryCode} ${localNumber}`
}
