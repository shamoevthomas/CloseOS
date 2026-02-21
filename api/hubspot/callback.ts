import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const clientId = process.env.HUBSPOT_CLIENT_ID || '4ffa6fe0-353d-4275-9998-2bada782b56c';
    const clientSecret = process.env.HUBSPOT_CLIENT_SECRET || '146b5732-0bda-4768-b4b1-c8f5a519e56f';
    const redirectUri = 'https://www.closeos.fr/api/hubspot/callback';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        const { code, state } = req.query;

        if (!code || !state) {
            return res.redirect('/offres?hubspot_error=missing_params');
        }

        const userId = state as string;
        console.log('[HubSpot] OAuth callback for user:', userId);

        // 1. Exchange code for tokens
        const tokenRes = await fetch('https://api.hubapi.com/oauth/v1/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                code: code as string,
            }).toString(),
        });

        const tokenData = await tokenRes.json();
        console.log('[HubSpot] Token exchange status:', tokenRes.status);

        if (!tokenRes.ok || !tokenData.access_token) {
            console.error('[HubSpot] Token exchange failed:', tokenData);
            return res.redirect('/offres?hubspot_error=token_exchange_failed');
        }

        // 2. Get portal ID (account info)
        const accountRes = await fetch('https://api.hubapi.com/oauth/v1/access-tokens/' + tokenData.access_token);
        const accountData = await accountRes.json();
        const portalId = accountData.hub_id ? String(accountData.hub_id) : null;
        console.log('[HubSpot] Portal ID:', portalId);

        // 3. Save tokens to Supabase
        const expiresAt = Date.now() + (tokenData.expires_in || 1800) * 1000;

        const { error: updateError } = await supabase.from('profiles').update({
            hubspot_access_token: tokenData.access_token,
            hubspot_refresh_token: tokenData.refresh_token,
            hubspot_token_expires_at: expiresAt,
            hubspot_portal_id: portalId,
        }).eq('id', userId);

        if (updateError) {
            console.error('[HubSpot] Supabase update error:', updateError);
            return res.redirect('/offres?hubspot_error=db_update_failed');
        }

        console.log('[HubSpot] OAuth complete, redirecting...');
        return res.redirect('/offres?hubspot_connected=true');

    } catch (error: any) {
        console.error('[HubSpot] Callback error:', error);
        return res.redirect('/offres?hubspot_error=' + encodeURIComponent(error.message));
    }
}
