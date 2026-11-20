/**
 * Planificateur minimal pour les crons de vercel.json (format 5 champs, UTC,
 * comme Vercel) : minute heure jour-du-mois mois jour-de-semaine.
 * Gère « * », « a-b », « a,b », « * /n » et « a-b/n ». Pas de noms (MON, JAN).
 */

type Field = Set<number>

function parseField(expr: string, min: number, max: number): Field {
  const values = new Set<number>()
  for (const part of expr.split(',')) {
    const [range, stepStr] = part.split('/')
    const step = stepStr ? Number(stepStr) : 1
    if (!Number.isInteger(step) || step < 1) throw new Error(`Pas invalide : ${part}`)
    let start: number
    let end: number
    if (range === '*') {
      start = min
      end = max
    } else if (range.includes('-')) {
      ;[start, end] = range.split('-').map(Number)
    } else {
      start = Number(range)
      end = stepStr ? max : start
    }
    if (![start, end].every(n => Number.isInteger(n) && n >= min && n <= max) || start > end) {
      throw new Error(`Valeur hors limites : ${part} (${min}-${max})`)
    }
    for (let v = start; v <= end; v += step) values.add(v)
  }
  return values
}

export interface CronSchedule {
  minute: Field
  hour: Field
  dayOfMonth: Field
  month: Field
  dayOfWeek: Field
  domRestricted: boolean
  dowRestricted: boolean
}

export function parseCron(expr: string): CronSchedule {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) throw new Error(`Cron invalide (5 champs attendus) : ${expr}`)
  const dow = parseField(parts[4], 0, 7)
  if (dow.has(7)) dow.add(0) // 7 = dimanche, comme 0
  return {
    minute: parseField(parts[0], 0, 59),
    hour: parseField(parts[1], 0, 23),
    dayOfMonth: parseField(parts[2], 1, 31),
    month: parseField(parts[3], 1, 12),
    dayOfWeek: dow,
    domRestricted: parts[2] !== '*',
    dowRestricted: parts[4] !== '*',
  }
}

/** Vrai si la minute UTC de `date` correspond au cron. */
export function cronMatches(s: CronSchedule, date: Date): boolean {
  if (!s.minute.has(date.getUTCMinutes())) return false
  if (!s.hour.has(date.getUTCHours())) return false
  if (!s.month.has(date.getUTCMonth() + 1)) return false
  const domOk = s.dayOfMonth.has(date.getUTCDate())
  const dowOk = s.dayOfWeek.has(date.getUTCDay())
  // Règle cron classique : si jour du mois ET jour de semaine sont restreints, l'un OU l'autre suffit.
  if (s.domRestricted && s.dowRestricted) return domOk || dowOk
  return domOk && dowOk
}

/**
 * Lance `run(path)` à chaque minute où un cron correspond.
 * Un cron encore en cours n'est pas relancé (pas de chevauchement).
 * Renvoie une fonction d'arrêt.
 */
export function startCronScheduler(
  crons: { path: string; schedule: string }[],
  run: (path: string) => Promise<void>,
  log: (msg: string) => void = console.log,
): () => void {
  const jobs = crons.map(c => ({ ...c, parsed: parseCron(c.schedule), running: false }))
  let lastMinute = -1
  const tick = () => {
    const now = new Date()
    const minuteKey = Math.floor(now.getTime() / 60000)
    if (minuteKey === lastMinute) return
    lastMinute = minuteKey
    for (const job of jobs) {
      if (job.running || !cronMatches(job.parsed, now)) continue
      job.running = true
      const started = Date.now()
      run(job.path)
        .then(() => log(`[cron] ${job.path} terminé en ${Date.now() - started} ms`))
        .catch(err => log(`[cron] ${job.path} ÉCHEC : ${err?.message || err}`))
        .finally(() => { job.running = false })
    }
  }
  // Vérifie toutes les 5 s pour ne jamais rater une minute, sans double déclenchement.
  const timer = setInterval(tick, 5000)
  tick()
  return () => clearInterval(timer)
}
