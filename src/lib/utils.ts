import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Tolerant phone search matching national ↔ international formats.
 * Compares digits, then falls back to the significant national suffix
 * (last 9 digits, leading 0s / country code ignored) so "06 12…" finds "+33 6 12…".
 * Requires at least 3 typed digits to avoid over-matching.
 */
/** Clé normalisée d'un numéro pour le regroupement de doublons (suffixe significatif). */
export function phoneKey(phone: string | null | undefined): string | null {
  const digits = (phone || '').replace(/\D/g, '')
  if (!digits) return null
  const tail = digits.replace(/^0+/, '').slice(-9)
  return tail.length >= 6 ? tail : null
}

export function phoneMatches(stored: string | null | undefined, query: string): boolean {
  const digits = (s: string | null | undefined) => (s || '').replace(/\D/g, '')
  const p = digits(stored)
  const q = digits(query)
  if (q.length < 3 || !p) return false
  if (p.includes(q)) return true
  const tail = (n: string) => n.replace(/^0+/, '').slice(-9)
  const pt = tail(p)
  const qt = tail(q)
  return pt.length > 0 && qt.length > 0 && (pt.includes(qt) || qt.includes(pt))
}
