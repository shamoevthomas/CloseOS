import { createClient } from '@supabase/supabase-js';

export const config = {
    runtime: 'edge',
};

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const cronSecret = process.env.CRON_SECRET;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

const BATCH_SIZE = 5;

export default async function handler(req: Request) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
    }

    const authHeader = req.headers.get('authorization');
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return new Response('Unauthorized', { status: 401 });
    }

    console.log('🕐 [business-stripe-sync] Cron started');

    const { data: profiles, error } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('stripe_connected', true)
        .not('stripe_account_id', 'is', null);

    if (error || !profiles?.length) {
        console.log(`[business-stripe-sync] ${error ? 'Error: ' + error.message : 'No connected accounts'}`);
        return new Response(JSON.stringify({ processed: 0 }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const host = req.headers.get('host') || 'www.closeos.fr';
    const proto = req.headers.get('x-forwarded-proto') || 'https';
    const baseUrl = `${proto}://${host}`;

    let processed = 0;
    let totalCreated = 0;
    let totalMatched = 0;
    const errors: string[] = [];

    for (let i = 0; i < profiles.length; i += BATCH_SIZE) {
        const batch = profiles.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
            batch.map(p =>
                fetch(`${baseUrl}/api/business-stripe-sync-all`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: p.id }),
                }).then(r => r.json().then(json => ({ user_id: p.id, ...json })))
            )
        );

        for (const r of results) {
            processed++;
            if (r.status === 'fulfilled') {
                totalCreated += r.value.created || 0;
                totalMatched += r.value.matched || 0;
            } else {
                errors.push(r.reason?.message || 'unknown');
            }
        }
    }

    console.log(`✅ [business-stripe-sync] Done: ${processed} users, ${totalCreated} created, ${totalMatched} matched, ${errors.length} errors`);

    return new Response(JSON.stringify({
        processed,
        created: totalCreated,
        matched: totalMatched,
        errors: errors.length,
    }), { headers: { 'Content-Type': 'application/json' } });
}
