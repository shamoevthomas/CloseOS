// CloseOS Sign — purge des fichiers Storage des contrats supprimés (lot 3).
// La suppression d'un contrat inscrit son dossier dans sign_storage_purge_queue (trigger SQL) ; la
// tâche planifiée vide la file ici. Un contrat sous conservation légale ne peut pas être supprimé,
// il n'entre donc jamais dans la file ; par sûreté, un dossier dont le contrat existe encore
// n'est jamais purgé.

import * as db from './sign-db.js'

const BUCKET = 'sign-documents'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function processPurgeQueue({ limit = 50 } = {}) {
  const out = { purged: 0, files: 0, kept: 0, errors: 0 }
  // Conservation légale (sign_storage_holds) : aucun chemin concerné n'est jamais effacé.
  const holds = ((await db.select('sign_storage_holds?select=prefix')) || []).map((h) => h.prefix)
  const held = (folder) => holds.some((p) => folder.startsWith(p) || p.startsWith(folder))
  const queue = (await db.select(`sign_storage_purge_queue?done_at=is.null&attempts=lt.5&select=contract_id,attempts&order=enqueued_at.asc&limit=${limit}`)) || []
  for (const item of queue) {
    const id = item.contract_id
    try {
      if (!UUID_RE.test(id)) throw new Error('identifiant invalide')
      const alive = await db.select(`sign_contracts?id=eq.${id}&select=id&limit=1`)
      if (alive && alive.length) {
        out.kept++
        await db.update('sign_storage_purge_queue', `contract_id=eq.${id}`, { done_at: new Date().toISOString(), last_error: 'contrat toujours présent : rien purgé' })
        continue
      }
      if (held(`${id}/`)) {
        out.kept++
        await db.update('sign_storage_purge_queue', `contract_id=eq.${id}`, { done_at: new Date().toISOString(), last_error: 'sous conservation légale : rien purgé' })
        continue
      }
      const names = await db.storageList(BUCKET, `${id}/`)
      if (names.length) await db.storageRemove(BUCKET, names.map((n) => `${id}/${n}`))
      out.files += names.length
      out.purged++
      await db.update('sign_storage_purge_queue', `contract_id=eq.${id}`, { done_at: new Date().toISOString(), last_error: null })
    } catch (e) {
      out.errors++
      await db.update('sign_storage_purge_queue', `contract_id=eq.${id}`, { attempts: (item.attempts || 0) + 1, last_error: String(e.message || e).slice(0, 300) }).catch(() => {})
    }
  }
  return out
}
