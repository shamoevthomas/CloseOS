import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Marqueur de build ultra-léger (aucune dépendance lourde → charge toujours).
 * Sert à savoir quel build est en ligne, indépendamment de l'état de /api/mcp.
 * GET /api/mcp-ping → { ok, build }
 */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ ok: true, build: 'mcp-dynimports-3', now: new Date().toISOString() })
}
