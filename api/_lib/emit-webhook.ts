import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type Product = 'business' | 'crm'

interface EmitOptions {
  product: Product
  userId: string
  event: string
  payload: Record<string, any>
}

/**
 * Fire-and-forget webhook dispatcher for outbound integrations (Zapier/Make/N8N).
 * Looks up active subscriptions matching the event, signs the payload with HMAC-SHA256,
 * and POSTs to each URL in parallel. Never throws — errors are logged and last_status
 * persisted on the subscription row for observability.
 */
export async function emitWebhookEvent(opts: EmitOptions): Promise<void> {
  const { product, userId, event, payload } = opts
  const table = product === 'crm' ? 'crm_webhook_subscriptions' : 'business_webhook_subscriptions'

  try {
    const { data: subs, error } = await supabase
      .from(table)
      .select('id, url, events, secret, is_active')
      .eq('user_id', userId)
      .eq('is_active', true)

    if (error || !subs || subs.length === 0) return

    const matching = subs.filter((s: any) => Array.isArray(s.events) && s.events.includes(event))
    if (matching.length === 0) return

    const body = JSON.stringify({
      event,
      product,
      user_id: userId,
      timestamp: new Date().toISOString(),
      data: payload,
    })

    await Promise.allSettled(matching.map(async (sub: any) => {
      const signature = crypto.createHmac('sha256', sub.secret).update(body).digest('hex')
      try {
        const res = await fetch(sub.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CloseOS-Event': event,
            'X-CloseOS-Product': product,
            'X-CloseOS-Signature': signature,
          },
          body,
        })
        await supabase.from(table).update({
          last_triggered_at: new Date().toISOString(),
          last_status: res.status,
          last_error: res.ok ? null : `HTTP ${res.status}`,
        }).eq('id', sub.id)
      } catch (err: any) {
        await supabase.from(table).update({
          last_triggered_at: new Date().toISOString(),
          last_status: 0,
          last_error: err?.message?.slice(0, 500) || 'Network error',
        }).eq('id', sub.id)
      }
    }))
  } catch (outerErr: any) {
    console.error(`[emitWebhookEvent] fatal (${product}/${event}):`, outerErr?.message)
  }
}

/**
 * Detect whether a user is a CRM user (for dual-routing in shared endpoints).
 * Returns 'crm' | 'business' | null.
 */
export async function detectProductForUser(userId: string): Promise<Product | null> {
  const [{ data: crmRow }, { data: bizRow }] = await Promise.all([
    supabase.from('crm_users').select('id').eq('id', userId).maybeSingle(),
    supabase.from('business_users').select('id').eq('id', userId).maybeSingle(),
  ])
  if (crmRow) return 'crm'
  if (bizRow) return 'business'
  return null
}
