import type { VercelRequest, VercelResponse } from '@vercel node'
import { createClient } from '@supabase/supabase-js'

// ============================================================
// PIPEDRIVE API — Integration for CloseOS
// Route via ?action=callback|pipelines|sync|push|webhook|saveMapping
// ============================================================

const PIPEDRIVE_CLIENT_ID = 'd8a07042c2506596';
const PIPEDRIVE_CLIENT_SECRET = '629d0ce82908739d892671e6214eb0d17a2f4cc6';
const PIPEDRIVE_REDIRECT_URI = 'https://www.closeos.fr/api/pipedrive/callback';

function getSupabase() {
    return createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

function getClientId() {
    return process.env.PIPEDRIVE_CLIENT_ID || PIPEDRIVE_CLIENT_ID;
}
function getClientSecret() {
    return process.env.PIPEDRIVE_CLIENT_SECRET || PIPEDRIVE_CLIENT_SECRET;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { action } = req.query;

    // Handle callback (GET)
    if (!action && req.url?.includes('/callback')) {
        return handleCallback(req, res);
    }

    // Handle actions (POST/GET)
    switch (action) {
        case 'callback': return handleCallback(req, res);
        case 'pipelines': return getPipelines(req, res);
        case 'sync': return handleSync(req, res);
        case 'push': return handlePush(req, res);
        case 'webhook': return handleWebhook(req, res);
        case 'saveMapping': return saveMapping(req, res);
        default:
            return res.status(404).json({ error: 'Action not found' });
    }
}

// --- TOKEN HELPER ---
async function getValidToken(supabase: any, userId: string): Promise<{ accessToken: string, apiDomain: string } | null> {
    const { data: profile } = await supabase
        .from('profiles')
        .select('pipedrive_access_token, pipedrive_refresh_token, pipedrive_token_expires_at, pipedrive_api_domain')
        .eq('id', userId)
        .single();

    if (!profile?.pipedrive_access_token) return null;

    // token_expires_at is numeric (timestamp in seconds usually in Pipedrive)
    const expiresAt = Number(profile.pipedrive_token_expires_at || 0);
    const now = Math.floor(Date.now() / 1000);

    if (expiresAt > 0 && now < (expiresAt - 120)) {
        return { accessToken: profile.pipedrive_access_token, apiDomain: profile.pipedrive_api_domain };
    }

    if (!profile.pipedrive_refresh_token) return null;

    // Refresh token
    const authHeader = Buffer.from(`${getClientId()}:${getClientSecret()}`).toString('base64');
    const tokenRes = await fetch('https://oauth.pipedrive.com/oauth/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${authHeader}`
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: profile.pipedrive_refresh_token,
        }).toString(),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return null;

    const newExpiresAt = Math.floor(Date.now() / 1000) + (tokenData.expires_in || 3600);
    await supabase.from('profiles').update({
        pipedrive_access_token: tokenData.access_token,
        pipedrive_refresh_token: tokenData.refresh_token,
        pipedrive_token_expires_at: newExpiresAt,
    }).eq('id', userId);

    return { accessToken: tokenData.access_token, apiDomain: profile.pipedrive_api_domain };
}

// ============================================================
// ACTION: CALLBACK
// ============================================================
async function handleCallback(req: VercelRequest, res: VercelResponse) {
    const code = req.query.code as string;
    const state = req.query.state as string; // Usually contains user_id

    if (!code) return res.status(400).send('Missing code');

    const authHeader = Buffer.from(`${getClientId()}:${getClientSecret()}`).toString('base64');

    const tokenRes = await fetch('https://oauth.pipedrive.com/oauth/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${authHeader}`
        },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: PIPEDRIVE_REDIRECT_URI,
        }).toString(),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return res.status(400).json({ error: 'Token exchange failed', details: tokenData });

    const supabase = getSupabase();
    const expiresAt = Math.floor(Date.now() / 1000) + (tokenData.expires_in || 3600);

    // Save tokens to profile (we need the user_id from state)
    if (state) {
        await supabase.from('profiles').update({
            pipedrive_access_token: tokenData.access_token,
            pipedrive_refresh_token: tokenData.refresh_token,
            pipedrive_token_expires_at: expiresAt,
            pipedrive_api_domain: tokenData.api_domain,
            // Pipedrive doesn't return portal_id directly in token but in metadata if needed
        }).eq('id', state);
    }

    // Redirect back to app
    return res.redirect('/offers?pipedrive_connected=true');
}

// ============================================================
// ACTION: GET PIPELINES & STAGES
// ============================================================
async function getPipelines(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabase();
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    const tokens = await getValidToken(supabase, user_id as string);
    if (!tokens) return res.status(401).json({ error: 'No valid Pipedrive token' });

    // Fetch pipelines
    const pipeRes = await fetch(`${tokens.apiDomain}/v1/pipelines`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` }
    });
    const pipeData = await pipeRes.json();

    // Fetch stages
    const stageRes = await fetch(`${tokens.apiDomain}/v1/stages`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` }
    });
    const stageData = await stageRes.json();

    return res.status(200).json({
        pipelines: pipeData.data || [],
        stages: stageData.data || []
    });
}

// ============================================================
// ACTION: SAVE MAPPING
// ============================================================
async function saveMapping(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabase();
    const { user_id, offer_id, mappings } = req.body;
    if (!user_id || !offer_id || !mappings) return res.status(400).json({ error: 'Missing params' });

    // mappings: { [closeos_stage]: pipedrive_stage_id }

    // Clean existing mapping for this offer
    await supabase.from('pipedrive_stage_mapping').delete().eq('offer_id', offer_id);

    const rows = Object.entries(mappings).map(([stage, p_stage_id]) => ({
        user_id,
        offer_id,
        closeos_stage: stage,
        pipedrive_stage_id: p_stage_id
    }));

    const { error } = await supabase.from('pipedrive_stage_mapping').insert(rows);
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ success: true });
}

// ============================================================
// ACTION: SYNC (Pipedrive -> CloseOS)
// ============================================================
async function handleSync(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabase();
    const { user_id, offer_id } = req.body;
    if (!user_id || !offer_id) return res.status(400).json({ error: 'Missing params' });

    const tokens = await getValidToken(supabase, user_id);
    if (!tokens) return res.status(401).json({ error: 'No valid Pipedrive token' });

    // Get mapping for this offer
    const { data: mappings } = await supabase.from('pipedrive_stage_mapping').select('*').eq('offer_id', offer_id);
    const stageMap = new Map(); // pipedrive_stage_id -> closeos_stage
    mappings?.forEach((m: any) => stageMap.set(Number(m.pipedrive_stage_id), m.closeos_stage));

    // Get active deals for these stages
    // Pipedrive deals API
    const dealsRes = await fetch(`${tokens.apiDomain}/v1/deals?limit=500&status=open`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` }
    });
    const dealsData = await dealsRes.json();
    if (!dealsData.success) return res.status(500).json({ error: 'Failed to fetch deals' });

    const deals = dealsData.data || [];
    let imported = 0;
    let updated = 0;

    for (const deal of deals) {
        const coStage = stageMap.get(deal.stage_id);
        if (!coStage) continue; // Not a mapped stage

        const email = deal.person_id?.email?.[0]?.value || '';
        const phone = deal.person_id?.phone?.[0]?.value || '';
        const name = deal.person_id?.name || '';
        const company = deal.org_id?.name || '';
        const value = deal.value || 0;

        // Check if exists by email or custom field if needed
        const { data: existing } = await supabase.from('prospects')
            .select('id')
            .eq('user_id', user_id)
            .eq('email', email)
            .maybeSingle();

        if (existing) {
            await supabase.from('prospects').update({
                stage: coStage,
                value,
                company,
                phone,
                contact: name,
                offer_id
            }).eq('id', existing.id);
            updated++;
        } else {
            await supabase.from('prospects').insert({
                user_id,
                offer_id,
                email,
                phone,
                contact: name,
                company,
                value,
                stage: coStage,
                integration_type: 'pipedrive'
            });
            imported++;
        }
    }

    return res.status(200).json({ imported, updated });
}

// ============================================================
// ACTION: PUSH (CloseOS -> Pipedrive)
// ============================================================
async function handlePush(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabase();
    const { user_id, prospect_id, stage, value, email, contact } = req.body;
    if (!user_id || !prospect_id) return res.status(400).json({ error: 'Missing params' });

    const tokens = await getValidToken(supabase, user_id);
    if (!tokens) return res.status(401).json({ error: 'No valid Pipedrive token' });

    // Get mapping to find pipedrive_stage_id
    const { data: prospect } = await supabase.from('prospects').select('offer_id').eq('id', prospect_id).single();
    if (!prospect?.offer_id) return res.status(400).json({ error: 'Prospect has no offer_id' });

    const { data: mapping } = await supabase.from('pipedrive_stage_mapping')
        .select('pipedrive_stage_id')
        .eq('offer_id', prospect.offer_id)
        .eq('closeos_stage', stage)
        .single();

    if (!mapping) return res.status(200).json({ message: 'No mapping for this stage' });

    // Find or Create Person, then Update Deal (Simplified)
    // In a real scenario, we store pipedrive_deal_id
    // For now, search by email
    const searchRes = await fetch(`${tokens.apiDomain}/v1/persons/search?term=${email}&fields=email`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` }
    });
    const searchData = await searchRes.json();
    let personId = searchData.data?.items?.[0]?.item?.id;

    if (!personId) {
        // Create Person
        const createPerson = await fetch(`${tokens.apiDomain}/v1/persons`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${tokens.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: contact, email: [email] })
        });
        const cpData = await createPerson.json();
        personId = cpData.data?.id;
    }

    // Find Deal for this person or create one
    const dealsRes = await fetch(`${tokens.apiDomain}/v1/persons/${personId}/deals`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` }
    });
    const dealsData = await dealsRes.json();
    let dealId = dealsData.data?.[0]?.id;

    if (dealId) {
        // Update Deal Stage
        await fetch(`${tokens.apiDomain}/v1/deals/${dealId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${tokens.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ stage_id: mapping.pipedrive_stage_id, value })
        });
    } else {
        // Create Deal
        await fetch(`${tokens.apiDomain}/v1/deals`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${tokens.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: `Deal: ${contact}`,
                person_id: personId,
                stage_id: mapping.pipedrive_stage_id,
                value
            })
        });
    }

    return res.status(200).json({ success: true });
}

// ============================================================
// ACTION: WEBHOOK (Pipedrive -> CloseOS)
// ============================================================
async function handleWebhook(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabase();
    const { event, current, previous } = req.body;
    if (!event || !current) return res.status(200).send('OK');

    if (event.startsWith('updated.deal') || event.startsWith('added.deal')) {
        const pipedriveStageId = current.stage_id;
        const email = current.person_id?.email?.[0]?.value || current.person_email;
        const value = current.value;
        const company = current.org_name;

        // Find mapping
        const { data: mappings } = await supabase.from('pipedrive_stage_mapping')
            .select('closeos_stage, offer_id, user_id')
            .eq('pipedrive_stage_id', pipedriveStageId);

        if (mappings && mappings.length > 0) {
            for (const m of mappings) {
                // Update prospect in CloseOS
                const { data: existing } = await supabase.from('prospects')
                    .select('id')
                    .eq('user_id', m.user_id)
                    .eq('email', email)
                    .maybeSingle();

                if (existing) {
                    await supabase.from('prospects').update({
                        stage: m.closeos_stage,
                        value: value,
                        company: company
                    }).eq('id', existing.id);
                } else if (event.startsWith('added.deal')) {
                    // Create new prospect
                    await supabase.from('prospects').insert({
                        user_id: m.user_id,
                        offer_id: m.offer_id,
                        email,
                        contact: current.person_name,
                        company,
                        value,
                        stage: m.closeos_stage,
                        integration_type: 'pipedrive'
                    });
                }
            }
        }
    }

    return res.status(200).send('OK');
}
