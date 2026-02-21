import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const supabaseUrl = process.env.VITE_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const clientId = process.env.HUBSPOT_CLIENT_ID || '4ffa6fe0-353d-4275-9998-2bada782b56c';
    const clientSecret = process.env.HUBSPOT_CLIENT_SECRET || '146b5732-0bda-4768-b4b1-c8f5a519e56f';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        const { user_id } = req.body;
        if (!user_id) return res.status(400).json({ error: 'user_id required' });

        // 1. Get current refresh token
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('hubspot_refresh_token')
            .eq('id', user_id)
            .single();

        if (profileError || !profile?.hubspot_refresh_token) {
            return res.status(404).json({ error: 'No HubSpot refresh token found' });
        }

        // 2. Refresh token
        const tokenRes = await fetch('https://api.hubapi.com/oauth/v1/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: profile.hubspot_refresh_token,
            }).toString(),
        });

        const tokenData = await tokenRes.json();

        if (!tokenRes.ok || !tokenData.access_token) {
            console.error('[HubSpot] Refresh failed:', tokenData);
            return res.status(tokenRes.status).json({ error: 'Refresh failed', details: tokenData });
        }

        // 3. Update tokens in DB
        const expiresAt = Date.now() + (tokenData.expires_in || 1800) * 1000;

        await supabase.from('profiles').update({
            hubspot_access_token: tokenData.access_token,
            hubspot_refresh_token: tokenData.refresh_token,
            hubspot_token_expires_at: expiresAt,
        }).eq('id', user_id);

        return res.status(200).json({
            access_token: tokenData.access_token,
            expires_in: tokenData.expires_in,
        });

    } catch (error: any) {
        console.error('[HubSpot] Refresh error:', error);
        return res.status(500).json({ error: 'Internal error' });
    }
}
