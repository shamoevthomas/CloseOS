import type { VercelRequest, VercelResponse } from '@vercel/node'
import { buildSignMcpServer } from './_lib/signMcp'
// StreamableHTTPServerTransport (SDK) importé dynamiquement dans le handler (voir plus bas) :
// évite tout crash au chargement du module côté serverless.

/**
 * CloseOS Sign — endpoint MCP distant (Streamable HTTP, stateless) pour Claude.ai.
 *
 * Sécurité : « URL secrète » (choix produit). L'accès exige un secret partagé
 * (env SIGN_MCP_SECRET) fourni SOIT dans le chemin (/api/mcp/<SECRET>, via rewrite),
 * SOIT en query (?key=<SECRET>). Sans le bon secret → 404 (l'endpoint reste invisible).
 *
 * ⚠️ Cet endpoint écrit en base via la clé service-role et ne crée QUE des brouillons.
 * Il n'expose aucun outil d'envoi/signature/paiement. Garde l'URL (avec son secret) privée.
 *
 * Connecteur Claude.ai : Paramètres → Connecteurs → Ajouter un connecteur personnalisé,
 * URL = https://sign.closeos.fr/api/mcp/<SECRET>
 */

export const config = {
  maxDuration: 30,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── Garde secret ────────────────────────────────────────────────────────
  const expected = process.env.SIGN_MCP_SECRET || ''
  const provided =
    (typeof req.query.key === 'string' && req.query.key) ||
    (Array.isArray(req.query.key) && req.query.key[0]) ||
    ''
  if (!expected || provided !== expected) {
    // 404 volontaire : ne pas révéler l'existence de l'endpoint.
    res.status(404).json({ error: 'Not found' })
    return
  }

  // CORS minimal (inoffensif ; Claude.ai se connecte côté serveur).
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version')
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id')
  if (req.method === 'OPTIONS') { res.status(204).end(); return }

  if (req.method !== 'POST') {
    // Mode stateless : pas de flux SSE persistant (GET) ni de session à supprimer (DELETE).
    res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed' }, id: null })
    return
  }

  try {
    const { StreamableHTTPServerTransport } = await import('@modelcontextprotocol/sdk/server/streamableHttp.js')
    const server = await buildSignMcpServer()
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless (serverless-friendly)
      enableJsonResponse: true,      // réponses JSON (pas de SSE persistant)
    })
    res.on('close', () => {
      transport.close()
      server.close()
    })
    await server.connect(transport)
    await transport.handleRequest(req as any, res as any, req.body)
  } catch (e: any) {
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: `Internal error: ${e?.message || e}` }, id: null })
    }
  }
}
