import { supabase } from '../../lib/supabase'

/**
 * Fire an outbound webhook event from the client after a local Supabase mutation.
 * Fire-and-forget — never blocks the calling flow even on network failure.
 * Server-side dispatch + HMAC signing lives in api/_lib/emit-webhook.ts.
 */
export async function emitClientEvent(event: string, payload: Record<string, any>): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) return
    void fetch('/api/business?action=emit-event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ event, payload }),
    }).catch(() => { /* swallow — logged server-side */ })
  } catch {
    /* never throw */
  }
}
