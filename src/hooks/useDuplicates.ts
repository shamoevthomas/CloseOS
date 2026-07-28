import { useMemo } from 'react'
import { useProspects, type Prospect } from '../contexts/ProspectsContext'
import { phoneKey } from '../lib/utils'

/** Groupe de prospects considérés comme doublons (email ou téléphone en commun). */
export type DuplicateGroup = Prospect[]

const emailKey = (email: string | null | undefined): string | null => {
  const e = (email || '').trim().toLowerCase()
  return e && e.includes('@') ? e : null
}

/**
 * Détecte les doublons parmi les prospects via union-find
 * sur deux relations : même email OU même numéro (suffixe significatif).
 */
export function useDuplicates() {
  const { prospects } = useProspects()

  const groups = useMemo<DuplicateGroup[]>(() => {
    const list = prospects || []
    if (list.length < 2) return []

    // index → parent (union-find)
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

    // Regrouper par racine
    const buckets = new Map<number, number[]>()
    list.forEach((_, i) => {
      const r = find(i)
      const arr = buckets.get(r) || []
      arr.push(i)
      buckets.set(r, arr)
    })

    const result: DuplicateGroup[] = []
    for (const idxs of buckets.values()) {
      if (idxs.length < 2) continue
      // Ordre : le plus « riche » en données d'abord (candidat maître par défaut)
      const score = (p: Prospect) => [p.email, p.phone, p.company, p.notes, p.offer, p.value]
        .filter(v => v !== null && v !== undefined && v !== '' && v !== 0).length
      const group = idxs.map(i => list[i]).sort((a, b) => score(b) - score(a) || (Number(a.id) - Number(b.id)))
      result.push(group)
    }
    // Groupes les plus gros d'abord
    return result.sort((a, b) => b.length - a.length)
  }, [prospects])

  const total = groups.length
  const duplicateCount = groups.reduce((n, g) => n + g.length, 0)

  return { groups, total, duplicateCount }
}
