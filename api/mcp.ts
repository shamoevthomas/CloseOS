import type { VercelRequest, VercelResponse } from '@vercel/node'
import { TOOLS } from './_lib/signMcp'

/**
 * CloseOS Sign — endpoint MCP distant pour Claude.ai.
 *
 * Implémentation JSON-RPC 2.0 « à la main » (transport MCP Streamable HTTP, mode réponse JSON,
 * stateless) — SANS le SDK @modelcontextprotocol/sdk, qui faisait crasher la fonction Vercel
 * une fois bundlé avec supabase/pdf-lib. Méthodes gérées : initialize, notifications/*, ping,
 * tools/list, tools/call.
 *
 * Sécurité : « URL secrète ». Le secret (env SIGN_MCP_SECRET) doit figurer dans l'URL — soit
 * dans le chemin (/api/mcp/<SECRET>, via rewrite), soit en query (?key=<SECRET>). Sinon → 404.
 * L'endpoint écrit en base via service-role et ne crée QUE des brouillons (aucun envoi/signature).
 *
 * Connecteur Claude.ai : https://sign.closeos.fr/api/mcp/<SECRET>
 */

export const config = { maxDuration: 30 }

const PROTOCOL_VERSION = '2025-06-18'
const SERVER_INFO = { name: 'closeos-sign', version: '1.0.0' }

async function handleRpc(msg: any): Promise<any | null> {
  // Notification (pas d'id) → aucune réponse.
  if (!msg || msg.jsonrpc !== '2.0' || msg.id === undefined || msg.id === null) return null
  const { id, method, params } = msg
  try {
    if (method === 'initialize') {
      return {
        jsonrpc: '2.0', id,
        result: {
          protocolVersion: params?.protocolVersion || PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
        },
      }
    }
    if (method === 'ping') return { jsonrpc: '2.0', id, result: {} }
    if (method === 'tools/list') {
      return {
        jsonrpc: '2.0', id,
        result: { tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) },
      }
    }
    if (method === 'tools/call') {
      const tool = TOOLS.find((t) => t.name === params?.name)
      if (!tool) return { jsonrpc: '2.0', id, error: { code: -32602, message: `Outil inconnu : ${params?.name}` } }
      const result = await tool.handler(params?.arguments || {})
      return { jsonrpc: '2.0', id, result }
    }
    return { jsonrpc: '2.0', id, error: { code: -32601, message: `Méthode inconnue : ${method}` } }
  } catch (e: any) {
    return { jsonrpc: '2.0', id, error: { code: -32603, message: e?.message || String(e) } }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── Garde secret (URL secrète) ──────────────────────────────────────────
  const expected = process.env.SIGN_MCP_SECRET || ''
  const provided =
    (typeof req.query.key === 'string' && req.query.key) ||
    (Array.isArray(req.query.key) && req.query.key[0]) ||
    ''
  if (!expected || provided !== expected) {
    res.status(404).json({ error: 'Not found' })
    return
  }

  // CORS minimal (inoffensif ; Claude.ai se connecte côté serveur).
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version')
  if (req.method === 'OPTIONS') { res.status(204).end(); return }
  if (req.method === 'GET') { res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed' }, id: null }); return }
  if (req.method !== 'POST') { res.status(405).end(); return }

  try {
    let body: any = req.body
    if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = null } }
    if (!body) { res.status(400).json({ jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' }, id: null }); return }

    const isBatch = Array.isArray(body)
    const msgs = isBatch ? body : [body]
    const responses = (await Promise.all(msgs.map(handleRpc))).filter((r) => r !== null)

    // Que des notifications → 202 sans corps (conforme Streamable HTTP).
    if (responses.length === 0) { res.status(202).end(); return }
    res.status(200).json(isBatch ? responses : responses[0])
  } catch (e: any) {
    if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: e?.message || String(e) }, id: null })
  }
}
