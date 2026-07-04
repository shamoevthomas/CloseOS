import type { VercelRequest, VercelResponse } from '@vercel/node'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
// Sonde : si CETTE fonction renvoie 500, l'import de StreamableHTTPServerTransport crashe au chargement.
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ ok: true, probe: 'sdk-streamableHttp', type: typeof StreamableHTTPServerTransport })
}
