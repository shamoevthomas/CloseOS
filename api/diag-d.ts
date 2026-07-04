import type { VercelRequest, VercelResponse } from '@vercel/node'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { buildSignMcpServer } from './_lib/signMcp'

// Réplique EXACTE des imports de api/mcp.ts + construction, avec try/catch.
// - 500 générique (HTML/Vercel) → un import de haut niveau crashe au chargement (signMcp).
// - 500 JSON {caught:true,...} → la construction crashe, avec le message d'erreur réel.
// - 200 → imports + construction OK (le bug de api/mcp est ailleurs).
export default function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const server = buildSignMcpServer()
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    res.status(200).json({ ok: true, server: typeof server, transport: typeof transport })
  } catch (e: any) {
    res.status(500).json({ caught: true, error: e?.message || String(e), stack: String(e?.stack || '').split('\n').slice(0, 5) })
  }
}
