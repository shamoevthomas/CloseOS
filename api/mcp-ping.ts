import type { VercelRequest, VercelResponse } from '@vercel/node'

/** Marqueur de build léger pour vérifier quel déploiement est en ligne. */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ ok: true, build: 'mcp-static-4' })
}
