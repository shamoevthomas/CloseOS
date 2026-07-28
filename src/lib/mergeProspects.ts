import { supabase } from './supabase'

/** Fusionne un doublon dans la fiche conservée (RPC atomique côté Postgres). */
export async function mergeProspectPair(keepId: number, dupId: number): Promise<void> {
  const { error } = await supabase.rpc('merge_prospects', { keep_id: keepId, dup_id: dupId })
  if (error) throw error
}

/** Fusionne tout un groupe de doublons dans une fiche maître (séquentiel). */
export async function mergeGroup(keepId: number, dupIds: number[]): Promise<void> {
  for (const dupId of dupIds) {
    if (dupId === keepId) continue
    await mergeProspectPair(keepId, dupId)
  }
}
