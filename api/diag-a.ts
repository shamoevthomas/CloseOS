import type { VercelRequest, VercelResponse } from '@vercel/node'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
// Sonde : si CETTE fonction renvoie 500, l'import de McpServer (SDK) crashe au chargement.
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ ok: true, probe: 'sdk-mcp', type: typeof McpServer })
}
