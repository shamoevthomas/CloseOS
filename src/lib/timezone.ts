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
