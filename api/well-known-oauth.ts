import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Répond 404 sur les endpoints de découverte OAuth
 * (/.well-known/oauth-authorization-server et /.well-known/oauth-protected-resource).
 *
 * Sans ce handler, le catch-all SPA de vercel.json renvoie l'index.html (200) sur ces
 * chemins → Claude.ai croit qu'un service OAuth existe et tente une inscription qui échoue
 * (« Couldn't register with ... sign-in service »). Un 404 explicite indique « pas d'OAuth ici »,
 * ce qui permet au connecteur MCP de se connecter sans authentification (URL secrète).
 */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(404).json({ error: 'no_oauth', message: 'This host does not provide an OAuth authorization server.' })
}
