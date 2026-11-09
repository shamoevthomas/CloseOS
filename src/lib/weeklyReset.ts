// Confiance d'appareil (code de vérification Business) : valable jusqu'au dimanche suivant à minuit, heure de Paris.
// Partagé par l'API (api/business.ts) et le navigateur (onboarding).

function parisParts(d: Date) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', weekday: 'short',
  })
  return Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value])) as Record<string, string>
}

/** Décalage Paris − UTC (ms) à l'instant donné. */
function parisOffsetMs(d: Date) {
  const p = parisParts(d)
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(d.getTime() / 1000) * 1000
}

/** Prochain dimanche 00:00 (Europe/Paris), strictement après `now`. */
export function nextSundayMidnightParis(now: Date = new Date()): Date {
  const p = parisParts(now)
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday)
  const add = wd === 0 ? 7 : 7 - wd
  const naive = Date.UTC(+p.year, +p.month - 1, +p.day + add, 0, 0, 0)
  return new Date(naive - parisOffsetMs(new Date(naive)))
}
