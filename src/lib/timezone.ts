import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz'

/** Get the browser's IANA timezone */
export const getBrowserTimezone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone

/**
 * Convert a local date + time in a given timezone to a UTC Date.
 * e.g. toUTC('2026-03-25', '10:00', 'America/New_York') → Date(2026-03-25T15:00:00Z)
 */
export function toUTC(date: string, time: string, timezone: string): Date {
  const localStr = `${date}T${time}:00`
  return fromZonedTime(localStr, timezone)
}

/**
 * Convert a UTC Date (or ISO string) to local date + time strings in the target timezone.
 */
export function fromUTC(utcDate: Date | string, timezone: string): { date: string; time: string } {
  const d = typeof utcDate === 'string' ? new Date(utcDate) : utcDate
  const zoned = toZonedTime(d, timezone)
  const year = zoned.getFullYear()
  const month = String(zoned.getMonth() + 1).padStart(2, '0')
  const day = String(zoned.getDate()).padStart(2, '0')
  const hours = String(zoned.getHours()).padStart(2, '0')
  const minutes = String(zoned.getMinutes()).padStart(2, '0')
  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`,
  }
}

/**
 * Format a UTC date in a specific timezone with a format string.
 * Uses date-fns-tz formatInTimeZone.
 */
export function formatInTz(utcDate: Date | string, timezone: string, format: string): string {
  const d = typeof utcDate === 'string' ? new Date(utcDate) : utcDate
  return formatInTimeZone(d, timezone, format)
}

/**
 * Get the UTC offset label for a timezone, e.g. "UTC+4" or "UTC-5"
 */
export function getUtcOffsetLabel(timezone: string): string {
  const now = new Date()
  const formatted = formatInTimeZone(now, timezone, 'xxx') // e.g. "+04:00"
  const [h, m] = formatted.split(':').map(Number)
  if (m === 0) return `UTC${h >= 0 ? '+' : ''}${h}`
  return `UTC${formatted}`
}

/**
 * Get a short display label for a timezone.
 * e.g. "Paris (UTC+1)", "New York (UTC-5)"
 */
export function getTimezoneLabel(timezone: string): string {
  const city = timezone.split('/').pop()?.replace(/_/g, ' ') || timezone
  return `${city} (${getUtcOffsetLabel(timezone)})`
}

/**
 * Current local time in a given timezone.
 * Returns { time: 'HH:mm', day: 'lun. 25 mai' } using fr-FR.
 */
export function getCurrentLocalTime(timezone: string): { time: string; day: string } {
  const now = new Date()
  const time = formatInTimeZone(now, timezone, 'HH:mm')
  const day = new Date(now).toLocaleDateString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'long', timeZone: timezone,
  })
  return { time, day }
}

/**
 * Signed offset in hours between two timezones (tzA - tzB).
 * Returns e.g. +3 if tzA is 3h ahead of tzB. Handles half-hour zones (returns decimal).
 */
export function getTimezoneOffsetHours(tzA: string, tzB: string): number {
  const now = new Date()
  const parse = (tz: string) => {
    const off = formatInTimeZone(now, tz, 'xxx') // e.g. "+04:00" or "-05:30"
    const sign = off.startsWith('-') ? -1 : 1
    const [h, m] = off.replace(/^[+-]/, '').split(':').map(Number)
    return sign * (h + m / 60)
  }
  return parse(tzA) - parse(tzB)
}

/**
 * Full list of IANA timezones supported by the runtime, with graceful fallback.
 * Used to power the "Autre…" search in the TimezonePicker.
 */
export const ALL_IANA_TIMEZONES: string[] = (() => {
  try {
    const fn = (Intl as any).supportedValuesOf
    if (typeof fn === 'function') {
      const list = fn('timeZone')
      if (Array.isArray(list) && list.length > 0) return list as string[]
    }
  } catch { /* fall through */ }
  return [
    'Europe/Paris', 'Europe/London', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Rome',
    'Europe/Brussels', 'Europe/Zurich', 'Europe/Amsterdam', 'Europe/Lisbon', 'Europe/Athens',
    'Europe/Bucharest', 'Europe/Moscow', 'Europe/Istanbul', 'Europe/Helsinki', 'Europe/Warsaw',
    'Europe/Stockholm', 'Europe/Oslo', 'Europe/Copenhagen', 'Europe/Dublin', 'Europe/Vienna',
    'Asia/Dubai', 'Asia/Tbilisi', 'Asia/Yerevan', 'Asia/Baku', 'Asia/Tehran',
    'Asia/Karachi', 'Asia/Kolkata', 'Asia/Dhaka', 'Asia/Bangkok', 'Asia/Singapore',
    'Asia/Hong_Kong', 'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Jakarta',
    'Asia/Manila', 'Asia/Kuala_Lumpur', 'Asia/Jerusalem', 'Asia/Riyadh', 'Asia/Beirut',
    'Australia/Sydney', 'Australia/Melbourne', 'Australia/Perth', 'Australia/Brisbane',
    'Pacific/Auckland', 'Pacific/Honolulu', 'Pacific/Fiji',
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'America/Toronto', 'America/Vancouver', 'America/Sao_Paulo', 'America/Buenos_Aires',
    'America/Mexico_City', 'America/Bogota', 'America/Lima', 'America/Santiago',
    'America/Anchorage', 'America/Halifax', 'America/St_Johns',
    'Africa/Casablanca', 'Africa/Algiers', 'Africa/Tunis', 'Africa/Lagos',
    'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Nairobi', 'Africa/Accra',
    'UTC',
  ]
})()

/** Common timezone options for dropdown selectors */
export const TIMEZONE_OPTIONS = [
  'Europe/Paris',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Brussels',
  'Europe/Zurich',
  'Europe/Amsterdam',
  'Europe/Lisbon',
  'Europe/Athens',
  'Europe/Bucharest',
  'Europe/Moscow',
  'Europe/Istanbul',
  'Asia/Dubai',
  'Asia/Tbilisi',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
  'Pacific/Auckland',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Sao_Paulo',
  'America/Mexico_City',
  'Africa/Casablanca',
  'Africa/Lagos',
  'Africa/Cairo',
  'Africa/Johannesburg',
]
