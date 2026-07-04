import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Marqueur de build + diagnostic de chargement des dépendances.
 * - GET /api/mcp-ping           → { ok, build }
 * - GET /api/mcp-ping?diag=1     → teste l'import runtime de chaque dépendance du MCP
 *   (permet d'identifier laquelle fait échouer /api/mcp sans dépendre du secret ni de la DB).
 * Aucune donnée sensible n'est exposée.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!req.query.diag) {
    res.status(200).json({ ok: true, build: 'mcp-dynimports-3' })
    return
  }

  const results: Record<string, string> = {}
  const tryImp = async (name: string, spec: string) => {
    try {
      await import(spec)
      results[name] = 'ok'
    } catch (e: any) {
      results[name] = `FAIL: ${e?.code ? e.code + ' ' : ''}${e?.message || e}`
    }
  }
  await tryImp('supabase', '@supabase/supabase-js')
  await tryImp('zod', 'zod')
  await tryImp('pdf-lib', 'pdf-lib')
  await tryImp('sdk_mcp', '@modelcontextprotocol/sdk/server/mcp.js')
  await tryImp('sdk_streamableHttp', '@modelcontextprotocol/sdk/server/streamableHttp.js')
  await tryImp('signMcp_rel_js', './_lib/signMcp.js')
  await tryImp('signMcp_rel', './_lib/signMcp')

  res.status(200).json({ diag: true, node: process.version, results })
}
