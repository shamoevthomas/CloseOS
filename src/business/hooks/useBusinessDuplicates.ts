import { useMemo } from 'react'
import { useBusinessProspects, type BusinessProspect } from '../contexts/BusinessProspectsContext'
import { phoneKey } from '../../lib/utils'

export type BusinessDuplicateGroup = BusinessProspect[]

const emailKey = (email: string | null | undefined): string | null => {
  const e = (email || '').trim().toLowerCase()
  return e && e.includes('@') ? e : null
}

/**
 * Détecte les doublons parmi les prospects Business via union-find
 * sur deux relations : même email OU même numéro (suffixe significatif).
 */
export function useBusinessDuplicates() {
  const { prospects } = useBusinessProspects()

  const groups = useMemo<BusinessDuplicateGroup[]>(() => {
    const list = prospects || []
    if (list.length < 2) return []

    const parent = list.map((_, i) => i)
    const find = (x: number): number => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] } return x }
    const union = (a: number, b: number) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb }

    const byEmail = new Map<string, number>()
    const byPhone = new Map<string, number>()

    list.forEach((p, i) => {
      const ek = emailKey(p.email)
      if (ek) { const prev = byEmail.get(ek); if (prev !== undefined) union(prev, i); else byEmail.set(ek, i) }
      const pk = phoneKey(p.phone)
      if (pk) { const prev = byPhone.get(pk); if (prev !== undefined) union(prev, i); else byPhone.set(pk, i) }
    })

    const buckets = new Map<number, number[]>()
    list.forEach((_, i) => {
      const r = find(i)
      const arr = buckets.get(r) || []
      arr.push(i)
      buckets.set(r, arr)
    })

    const result: BusinessDuplicateGroup[] = []
    for (const idxs of buckets.values()) {
      if (idxs.length < 2) continue
      const score = (p: BusinessProspect) => [p.email, p.phone, p.company, p.notes, p.offer, p.value]
        .filter(v => v !== null && v !== undefined && v !== '' && v !== 0).length
      const group = idxs.map(i => list[i]).sort((a, b) => score(b) - score(a) || (Number(a.id) - Number(b.id)))
      result.push(group)
    }
    return result.sort((a, b) => b.length - a.length)
  }, [prospects])

  return { groups, total: groups.length, duplicateCount: groups.reduce((n, g) => n + g.length, 0) }
}
