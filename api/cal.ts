import { createClient } from '@supabase/supabase-js';

// ============================================================
// Consolidated Cal.com API handler
// Routes based on req.query.action: callback | proxy | webhook | refresh
// ============================================================

const CAL_CLIENT_ID = '452e83a06c630a84cba92ab72cd43735c78ee8b5b691f488de432201b2d951ba';
const CAL_CLIENT_SECRET = process.env.CAL_CLIENT_SECRET || '44133f701370e512c37bcefd37317b7e9d150632c7e3ec85f34b2a86bb9614be';
const CAL_REDIRECT_URI = 'https://closeos.fr/api/cal-callback';

// Supabase client for webhook handler (module-level, matches original cal-webhook.ts)
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const webhookSupabase = createClient(supabaseUrl!, supabaseServiceKey!);

// ============================================================
// action=callback — OAuth callback (GET)
// Originally: api/cal-callback.ts (Edge runtime, converted to Node.js)
// ============================================================
async function handleCallback(req: any, res: any) {
  try {
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;
    const error = req.query.error as string | undefined;

    console.log('[cal-callback] Received request. code:', !!code, 'state:', !!state, 'error:', error);
    console.log('[cal-callback] redirect_uri used:', CAL_REDIRECT_URI);

    // Handle OAuth errors
    if (error) {
      console.error('Cal.com OAuth error:', error);
      return res.redirect('https://closeos.fr/rendez-vous?error=cal_auth_failed');
    }

    if (!code || !state) {
      return res.status(400).send('Missing code or state parameter');
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
        return res.redirect('https://closeos.fr/rendez-vous?error=token_exchange_failed');
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

    // Calculate token expiration as Unix timestamp in ms (column is bigint)
    const expiresAt = Date.now() + (expires_in || 3600) * 1000;

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
      return res.redirect('https://closeos.fr/rendez-vous?error=db_update_failed');
    }

    console.log(`Cal.com OAuth successful for user ${userId}, username: ${calUsername}`);

    // Redirect back to the rendez-vous page with success
    return res.redirect('https://closeos.fr/rendez-vous?cal_connected=true');

  } catch (error: any) {
    console.error('Cal.com OAuth callback error:', error);
    return res.redirect('https://closeos.fr/rendez-vous?error=unexpected_error');
  }
}

// ============================================================
// action=proxy — CORS proxy to Cal.com API (all methods)
// Originally: api/cal-proxy.ts (Edge runtime, converted to Node.js)
// ============================================================
async function handleProxy(req: any, res: any) {
  // CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const targetPath = req.query.url as string | undefined;

    if (!targetPath) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }

    // Construct target URL
    let finalTargetUrl = `https://api.cal.com${targetPath}`;

    // Forward headers (especially Authorization)
    const headers: Record<string, string> = {};
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];

    console.log(`[Proxy] Target Path: ${targetPath}`);
    console.log(`[Proxy] Auth Header Present: ${!!authHeader}`);

    if (authHeader) {
      headers['Authorization'] = authHeader;

      // Fallback: Append access_token query param for V1 endpoints if Bearer token
      if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const separator = finalTargetUrl.includes('?') ? '&' : '?';
        finalTargetUrl += `${separator}access_token=${token}`;
        console.log(`[Proxy] Appended access_token to URL fallback`);
      }
    } else {
      console.warn(`[Proxy] Missing Authorization Header!`);
    }

    headers['Content-Type'] = 'application/json';

    const options: RequestInit = {
      method: req.method,
      headers: headers,
    };

    // Forward body for non-GET/HEAD requests
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const bodyText = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      if (bodyText && bodyText !== 'undefined' && bodyText !== 'null') {
        options.body = bodyText;
        console.log(`[Proxy] Body included (${bodyText.length} chars)`);
      }
    }

    console.log(`[Proxy] Fetching: ${finalTargetUrl}`);
    const response = await fetch(finalTargetUrl, options);

    console.log(`[Proxy] Upstream Status: ${response.status}`);

    // Handling response
    const responseBody = await response.text();

    if (!response.ok) {
      console.log(`[Proxy] Upstream Error Body: ${responseBody.slice(0, 500)}`);
    }

    res.setHeader('Content-Type', 'application/json');
    return res.status(response.status).send(responseBody);

  } catch (error: any) {
    console.error('Cal.com Proxy Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// ============================================================
// action=webhook — Cal.com booking webhook (POST)
// Originally: api/cal-webhook.ts (Node.js runtime, preserved as-is)
// ============================================================
async function handleWebhook(req: any, res: any) {
  // 1. Configuration CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { user_id } = req.query;
    const event = req.body;

    console.log("🔔 Webhook Cal.com reçu:", event.triggerEvent);

    if (!user_id) {
      console.error("❌ ID Utilisateur manquant dans l'URL");
      return res.status(400).json({ error: 'User ID missing' });
    }

    const payload = event.payload;
    const trigger = event.triggerEvent;

    if (trigger === 'BOOKING_CREATED' || trigger === 'BOOKING_RESCHEDULED') {

      const startTime = new Date(payload.startTime);
      const dateStr = startTime.toISOString().split('T')[0];
      const timeStr = startTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

      const attendee = payload.attendees[0];
      const prospectName = attendee?.name || 'Prospect Inconnu';
      const prospectEmail = attendee?.email;

      const title = payload.title || 'Rendez-vous Cal.com';
      const description = `Email: ${prospectEmail}\nType: ${payload.typeTitle}\nNotes: ${payload.description || ''}`;

      // Calcul de la durée (en minutes)
      const start = new Date(payload.startTime).getTime();
      const end = new Date(payload.endTime).getTime();
      const duration = Math.round((end - start) / (1000 * 60));

      // Insertion/Mise à jour avec la clé Service Role (Plus de blocage RLS)
      const { error } = await webhookSupabase
        .from('meetings')
        .upsert({
          user_id: user_id,
          title: title,
          date: dateStr,
          time: `${timeStr} - ${new Date(payload.endTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
          duration: duration || 30,
          contact: prospectName,
          status: 'scheduled',
          location: payload.location || 'Visio',
          description: description,
          source: 'Cal.com',
          calcom_uid: payload.uid // Unique ID pour éviter les doublons
        }, { onConflict: 'calcom_uid' });

      if (error) {
        console.error("❌ Erreur Supabase:", error);
        throw error;
      }

      console.log("✅ Rendez-vous enregistré avec succès");

    } else if (trigger === 'BOOKING_CANCELLED') {
      // Marquer le rendez-vous comme annulé
      await webhookSupabase
        .from('meetings')
        .update({ status: 'cancelled' })
        .eq('calcom_uid', payload.uid);
    }

    return res.status(200).json({ received: true });

  } catch (error: any) {
    console.error("❌ Erreur Webhook détaillée:", error);
    return res.status(500).json({ error: error.message });
  }
}

// ============================================================
// action=refresh — Refresh Cal.com OAuth token (POST)
// Originally: api/refresh-cal-token.ts (Node.js runtime, preserved as-is)
// ============================================================
async function handleRefresh(req: any, res: any) {
  // 1. Setup Supabase
  const supabaseRefreshUrl = process.env.VITE_SUPABASE_URL;
  const supabaseRefreshKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const clientId = CAL_CLIENT_ID;
  const clientSecret = CAL_CLIENT_SECRET;

  if (!supabaseRefreshUrl || !supabaseRefreshKey) {
    return res.status(500).json({ error: 'Missing Supabase environment variables' });
  }

  const supabase = createClient(supabaseRefreshUrl, supabaseRefreshKey);

  // 2. Get User from Request
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

// ============================================================
// Main router
// ============================================================
export default async function handler(req: any, res: any) {
  const action = req.query.action as string | undefined;

  switch (action) {
    case 'callback':
      return handleCallback(req, res);
    case 'proxy':
      return handleProxy(req, res);
    case 'webhook':
      return handleWebhook(req, res);
    case 'refresh':
      return handleRefresh(req, res);
    default:
      return res.status(400).json({
        error: 'Missing or invalid action parameter',
        valid_actions: ['callback', 'proxy', 'webhook', 'refresh'],
      });
  }
}
