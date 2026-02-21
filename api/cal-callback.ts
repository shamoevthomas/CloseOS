import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge',
};

const CAL_CLIENT_ID = '452e83a06c630a84cba92ab72cd43735c78ee8b5b691f488de432201b2d951ba';
const CAL_CLIENT_SECRET = process.env.CAL_CLIENT_SECRET || '44133f701370e512c37bcefd37317b7e9d150632c7e3ec85f34b2a86bb9614be';
const CAL_REDIRECT_URI = 'https://closeos.fr/api/cal-callback';

export default async function handler(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    console.log('[cal-callback] Received request. code:', !!code, 'state:', !!state, 'error:', error);
    console.log('[cal-callback] redirect_uri used:', CAL_REDIRECT_URI);

    // Handle OAuth errors
    if (error) {
      console.error('Cal.com OAuth error:', error);
      return Response.redirect('https://closeos.fr/rendez-vous?error=cal_auth_failed');
    }

    if (!code || !state) {
      return new Response('Missing code or state parameter', { status: 400 });
    }

    // Exchange authorization code for access token
    // Try /v2/oauth/token first (the endpoint that was working before)
    const tokenBody = JSON.stringify({
      client_id: CAL_CLIENT_ID,
      client_secret: CAL_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: CAL_REDIRECT_URI,
    });

    console.log('[cal-callback] Attempting token exchange with /v2/oauth/token...');

    let tokenResponse = await fetch('https://api.cal.com/v2/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: tokenBody,
    });

    // If /v2/oauth/token fails, try /v2/auth/oauth2/token as fallback
    if (!tokenResponse.ok) {
      const errorData1 = await tokenResponse.text();
      console.error('[cal-callback] /v2/oauth/token failed (status ' + tokenResponse.status + '):', errorData1);
      console.log('[cal-callback] Trying fallback endpoint /v2/auth/oauth2/token...');

      tokenResponse = await fetch('https://api.cal.com/v2/auth/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: CAL_CLIENT_ID,
          client_secret: CAL_CLIENT_SECRET,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: CAL_REDIRECT_URI,
        }),
      });

      if (!tokenResponse.ok) {
        const errorData2 = await tokenResponse.text();
        console.error('[cal-callback] /v2/auth/oauth2/token also failed (status ' + tokenResponse.status + '):', errorData2);
        return Response.redirect('https://closeos.fr/rendez-vous?error=token_exchange_failed');
      }
    }

    console.log('[cal-callback] Token exchange successful!');

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokens;

    // Get user info from Cal.com to fetch username
    let calUsername = '';
    try {
      const userInfoResponse = await fetch('https://api.cal.com/v2/me', {
        headers: {
          'Authorization': `Bearer ${access_token}`,
        },
      });

      if (userInfoResponse.ok) {
        const userInfo = await userInfoResponse.json();
        calUsername = userInfo.data?.username || userInfo.data?.email || '';
      }
    } catch (e) {
      console.error('Failed to fetch Cal.com user info:', e);
    }

    // Calculate token expiration (timestamp in ms)
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    // State contains the user_id
    const userId = state;

    // Store tokens in database
    const supabaseAdmin = createClient(
      process.env.VITE_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        cal_access_token: access_token,
        cal_refresh_token: refresh_token,
        cal_token_expires_at: expiresAt,
        cal_username: calUsername,
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Database update failed:', updateError);
      return Response.redirect('https://closeos.fr/rendez-vous?error=db_update_failed');
    }

    console.log(`Cal.com OAuth successful for user ${userId}, username: ${calUsername}`);

    // Redirect back to the rendez-vous page with success
    return Response.redirect('https://closeos.fr/rendez-vous?cal_connected=true');

  } catch (error: any) {
    console.error('Cal.com OAuth callback error:', error);
    return Response.redirect('https://closeos.fr/rendez-vous?error=unexpected_error');
  }
}