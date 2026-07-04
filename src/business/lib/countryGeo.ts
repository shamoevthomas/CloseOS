// Centroïdes (lat, lng) par code pays ISO2 — pour placer les marqueurs sur le globe.
// Le nom du pays est dérivé via Intl.DisplayNames (pas besoin de le stocker).

export const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  FR: [46.2, 2.2], BE: [50.5, 4.5], CH: [46.8, 8.2], LU: [49.8, 6.1], MC: [43.7, 7.4],
  GB: [54.0, -2.0], IE: [53.4, -8.0], DE: [51.2, 10.4], NL: [52.1, 5.3], ES: [40.4, -3.7],
  PT: [39.5, -8.0], IT: [41.9, 12.6], AT: [47.5, 14.5], DK: [56.3, 9.5], SE: [60.1, 18.6],
  NO: [60.5, 8.5], FI: [64.0, 26.0], PL: [51.9, 19.1], CZ: [49.8, 15.5], SK: [48.7, 19.7],
  HU: [47.2, 19.5], RO: [45.9, 24.9], BG: [42.7, 25.5], GR: [39.1, 21.8], HR: [45.1, 15.2],
  SI: [46.1, 14.8], RS: [44.0, 21.0], UA: [48.4, 31.2], RU: [61.5, 105.3], TR: [39.0, 35.2],
  US: [39.8, -98.5], CA: [56.1, -106.3], MX: [23.6, -102.5], BR: [-14.2, -51.9],
  AR: [-38.4, -63.6], CL: [-35.7, -71.5], CO: [4.6, -74.3], PE: [-9.2, -75.0],
  VE: [6.4, -66.6], UY: [-32.5, -55.8], MA: [31.8, -7.1], DZ: [28.0, 1.7], TN: [33.9, 9.5],
  EG: [26.8, 30.8], SN: [14.5, -14.5], CI: [7.5, -5.5], CM: [7.4, 12.3], NG: [9.1, 8.7],
  GH: [7.9, -1.0], KE: [-0.0, 37.9], ZA: [-30.6, 22.9], BJ: [9.3, 2.3], TG: [8.6, 0.8],
  ML: [17.6, -4.0], BF: [12.2, -1.6], GA: [-0.8, 11.6], CG: [-0.7, 15.8], CD: [-4.0, 21.8],
  MG: [-18.8, 46.9], MU: [-20.3, 57.6], RE: [-21.1, 55.5], GP: [16.2, -61.6], MQ: [14.6, -61.0],
  GF: [3.9, -53.1], PF: [-17.7, -149.4], NC: [-20.9, 165.6], YT: [-12.8, 45.2],
  CN: [35.9, 104.2], JP: [36.2, 138.3], KR: [35.9, 127.8], IN: [20.6, 79.0], ID: [-0.8, 113.9],
  TH: [15.9, 100.9], VN: [14.1, 108.3], PH: [12.9, 121.8], MY: [4.2, 101.9], SG: [1.35, 103.8],
  AE: [23.4, 53.8], SA: [23.9, 45.1], IL: [31.0, 34.9], QA: [25.3, 51.2], LB: [33.9, 35.9],
  AU: [-25.3, 133.8], NZ: [-40.9, 174.9], IS: [64.9, -19.0], EE: [58.6, 25.0], LV: [56.9, 24.6],
  LT: [55.2, 23.9], CY: [35.1, 33.4], MT: [35.9, 14.4], AD: [42.5, 1.5], AL: [41.2, 20.2],
  MD: [47.4, 28.4], GE: [42.3, 43.4], AM: [40.1, 45.0], KZ: [48.0, 66.9], JO: [30.6, 36.2],
  KW: [29.3, 47.5], BH: [26.0, 50.6], OM: [21.5, 55.9], PK: [30.4, 69.3], BD: [23.7, 90.4],
  LK: [7.9, 80.8], NP: [28.4, 84.1], DO: [18.7, -70.2], GT: [15.8, -90.2], CR: [9.7, -83.8],
  PA: [8.5, -80.8], EC: [-1.8, -78.2], BO: [-16.3, -63.6], PY: [-23.4, -58.4], HT: [19.0, -72.3],
  ZZ: [0, 0],
}

// ISO2 -> drapeau emoji (regional indicator symbols)
export function flagEmoji(code: string): string {
  if (!code || code.length !== 2 || code === 'ZZ') return '🏳️'
  const A = 0x1f1e6
  const up = code.toUpperCase()
  return String.fromCodePoint(A + (up.charCodeAt(0) - 65)) + String.fromCodePoint(A + (up.charCodeAt(1) - 65))
}

const displayNamesCache: Record<string, Intl.DisplayNames> = {}
export function countryName(code: string, lang: 'fr' | 'en' = 'fr'): string {
  if (!code || code === 'ZZ') return lang === 'fr' ? 'Inconnu' : 'Unknown'
  try {
    if (!displayNamesCache[lang]) {
      displayNamesCache[lang] = new Intl.DisplayNames([lang], { type: 'region' })
    }
    return displayNamesCache[lang].of(code.toUpperCase()) || code
  } catch {
    return code
  }
}

export function centroidFor(code: string): [number, number] | null {
  return COUNTRY_CENTROIDS[code?.toUpperCase()] || null
}
