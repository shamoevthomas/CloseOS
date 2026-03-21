import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Dedicated callback route for GHL OAuth (GHL doesn't allow query params in redirect URIs)

const GHL_BASE_URL = 'https://services.leadconnectorhq.com';
const GHL_REDIRECT_URI = 'https://www.closeos.fr/api/ghll/callback';

function getSupabase() {
    return createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const supabase = getSupabase();
    const { code, state } = req.query;

    if (!code || !state) return res.redirect('/offers?ghl_error=missing_params');

    const userId = state as string;
    console.log('[GHL] OAuth callback for user:', userId);

    try {
        const tokenRes = await fetch(`${GHL_BASE_URL}/oauth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: process.env.GHL_CLIENT_ID || '',
                client_secret: process.env.GHL_CLIENT_SECRET || '',
                redirect_uri: GHL_REDIRECT_URI,
                code: code as string,
                user_type: 'Location',
            }).toString(),
        });

        const tokenData = await tokenRes.json();
        if (!tokenRes.ok || !tokenData.access_token) {
            console.error('[GHL] Token exchange failed:', tokenData);
            return res.redirect('/offers?ghl_error=token_exchange_failed');
        }

        const expiresAt = Date.now() + (tokenData.expires_in || 86400) * 1000;
        const locationId = tokenData.locationId || null;

        const { error: updateError } = await supabase.from('profiles').update({
            ghl_access_token: tokenData.access_token,
            ghl_refresh_token: tokenData.refresh_token,
            ghl_token_expires_at: expiresAt,
            ghl_location_id: locationId,
        }).eq('id', userId);

        if (updateError) {
            console.error('[GHL] DB update error:', updateError);
            return res.redirect('/offers?ghl_error=db_update_failed');
        }

        return res.redirect('/offers?ghl_connected=true');
    } catch (error: any) {
        console.error('[GHL Callback] Error:', error);
        return res.redirect('/offers?ghl_error=' + encodeURIComponent(error.message));
    }
}
