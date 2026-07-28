import { supabase } from '../../lib/supabase'

/** Fusionne un doublon Business dans la fiche conservée (RPC atomique côté Postgres). */
export async function mergeBusinessProspectPair(keepId: number, dupId: number): Promise<void> {
  const { error } = await supabase.rpc('merge_business_prospects', { keep_id: keepId, dup_id: dupId })
  if (error) throw error
}

/** Fusionne tout un groupe de doublons dans une fiche maître (séquentiel). */
export async function mergeBusinessGroup(keepId: number, dupIds: number[]): Promise<void> {
  for (const dupId of dupIds) {
    if (dupId === keepId) continue
    await mergeBusinessProspectPair(keepId, dupId)
  }
}
