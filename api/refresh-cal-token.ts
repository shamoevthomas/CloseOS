import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 1. Setup Supabase
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const clientId = '452e83a06c630a84cba92ab72cd43735c78ee8b5b691f488de432201b2d951ba';
    const clientSecret = '44133f701370e512c37bcefd37317b7e9d150632c7e3ec85f34b2a86bb9614be';

    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Missing Supabase environment variables' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Get User from Request (UserId should be passed securely)
    // In a real app, you would validate the session here.
    // For this MVP, we will accept user_id in the body, but ideally should validat Auth header.
    const { user_id } = req.body;

    if (!user_id) {
        return res.status(400).json({ error: 'User ID required' });
    }

    // 3. Get current tokens
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('cal_refresh_token')
        .eq('id', user_id)
        .single();

    if (profileError || !profile?.cal_refresh_token) {
        return res.status(404).json({ error: 'No refresh token found' });
    }

    // 4. Call Cal.com to refresh
    try {
        const response = await fetch('https://api.cal.com/v2/auth/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: 'refresh_token',
                refresh_token: profile.cal_refresh_token
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Cal.com Refresh Error:", data);
            return res.status(response.status).json({ error: 'Failed to refresh token', details: data });
        }

        // 5. Update Supabase
        const { error: updateError } = await supabase.from('profiles').update({
            cal_access_token: data.access_token,
            cal_refresh_token: data.refresh_token, // Rotation
            cal_token_expires_at: Date.now() + (data.expires_in * 1000)
        }).eq('id', user_id);

        if (updateError) {
            console.error("Supabase Update Error:", updateError);
            return res.status(500).json({ error: 'Failed to update tokens' });
        }

        // 6. Return new access token
        return res.status(200).json({ access_token: data.access_token, expires_in: data.expires_in });

    } catch (error) {
        console.error("Refresh Logic Error:", error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
