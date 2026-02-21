import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// ============================================================
// CONSOLIDATED HUBSPOT API — All routes in one serverless fn
// Route via ?action=callback|refresh|sync|push|webhook
// ============================================================

const HUBSPOT_CLIENT_ID = '4ffa6fe0-353d-4275-9998-2bada782b56c';
const HUBSPOT_CLIENT_SECRET = '146b5732-0bda-4768-b4b1-c8f5a519e56f';
const HUBSPOT_REDIRECT_URI = 'https://www.closeos.fr/api/hubspot/callback';

function getSupabase() {
    return createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

function getClientId() {
    return process.env.HUBSPOT_CLIENT_ID || HUBSPOT_CLIENT_ID;
}
function getClientSecret() {
    return process.env.HUBSPOT_CLIENT_SECRET || HUBSPOT_CLIENT_SECRET;
}

// --- TOKEN HELPER ---
async function getValidToken(supabase: any, userId: string): Promise<string | null> {
    const { data: profile } = await supabase
        .from('profiles')
        .select('hubspot_access_token, hubspot_refresh_token, hubspot_token_expires_at')
        .eq('id', userId)
        .single();

    if (!profile?.hubspot_access_token) return null;

    const expiresAt = typeof profile.hubspot_token_expires_at === 'number'
        ? profile.hubspot_token_expires_at
        : parseInt(profile.hubspot_token_expires_at || '0', 10);

    if (expiresAt > 0 && Date.now() < (expiresAt - 120000)) {
        return profile.hubspot_access_token;
    }

    if (!profile.hubspot_refresh_token) return null;

    const tokenRes = await fetch('https://api.hubapi.com/oauth/v1/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: getClientId(),
            client_secret: getClientSecret(),
            refresh_token: profile.hubspot_refresh_token,
        }).toString(),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return null;

    const newExpiresAt = Date.now() + (tokenData.expires_in || 1800) * 1000;
    await supabase.from('profiles').update({
        hubspot_access_token: tokenData.access_token,
        hubspot_refresh_token: tokenData.refresh_token,
        hubspot_token_expires_at: newExpiresAt,
    }).eq('id', userId);

    return tokenData.access_token;
}

// --- STAGE MAPPERS ---
function mapHubspotToCloseos(lifecycle: string | null): string {
    if (!lifecycle) return 'prospect';
    const lc = lifecycle.toLowerCase();
    if (['subscriber', 'lead'].includes(lc)) return 'prospect';
    if (['marketingqualifiedlead', 'salesqualifiedlead', 'opportunity'].includes(lc)) return 'qualified';
    if (['customer', 'evangelist'].includes(lc)) return 'won';
    if (lc === 'other') return 'lost';
    return 'prospect';
}

function mapCloseosToHubspot(stage: string): string {
    switch (stage) {
        case 'prospect': return 'lead';
        case 'qualified': return 'salesqualifiedlead';
        case 'won': return 'customer';
        case 'followup': return 'salesqualifiedlead';
        case 'noshow': return 'lead';
        case 'lost': return 'other';
        default: return 'lead';
    }
}

// ============================================================
// ACTION: CALLBACK (OAuth redirect handler)
// ============================================================
async function handleCallback(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabase();
    const { code, state } = req.query;

    if (!code || !state) return res.redirect('/app/offers?hubspot_error=missing_params');

    const userId = state as string;
    console.log('[HubSpot] OAuth callback for user:', userId);

    const tokenRes = await fetch('https://api.hubapi.com/oauth/v1/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: getClientId(),
            client_secret: getClientSecret(),
            redirect_uri: HUBSPOT_REDIRECT_URI,
            code: code as string,
        }).toString(),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
        console.error('[HubSpot] Token exchange failed:', tokenData);
        return res.redirect('/app/offers?hubspot_error=token_exchange_failed');
    }

    const accountRes = await fetch('https://api.hubapi.com/oauth/v1/access-tokens/' + tokenData.access_token);
    const accountData = await accountRes.json();
    const portalId = accountData.hub_id ? String(accountData.hub_id) : null;

    const expiresAt = Date.now() + (tokenData.expires_in || 1800) * 1000;

    const { error: updateError } = await supabase.from('profiles').update({
        hubspot_access_token: tokenData.access_token,
        hubspot_refresh_token: tokenData.refresh_token,
        hubspot_token_expires_at: expiresAt,
        hubspot_portal_id: portalId,
    }).eq('id', userId);

    if (updateError) {
        console.error('[HubSpot] DB update error:', updateError);
        return res.redirect('/app/offers?hubspot_error=db_update_failed');
    }

    return res.redirect('/app/offers?hubspot_connected=true');
}

// ============================================================
// ACTION: REFRESH (Token refresh)
// ============================================================
async function handleRefresh(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabase();
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    const { data: profile } = await supabase
        .from('profiles')
        .select('hubspot_refresh_token')
        .eq('id', user_id)
        .single();

    if (!profile?.hubspot_refresh_token) return res.status(404).json({ error: 'No refresh token' });

    const tokenRes = await fetch('https://api.hubapi.com/oauth/v1/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: getClientId(),
            client_secret: getClientSecret(),
            refresh_token: profile.hubspot_refresh_token,
        }).toString(),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return res.status(400).json({ error: 'Refresh failed', details: tokenData });

    const expiresAt = Date.now() + (tokenData.expires_in || 1800) * 1000;
    await supabase.from('profiles').update({
        hubspot_access_token: tokenData.access_token,
        hubspot_refresh_token: tokenData.refresh_token,
        hubspot_token_expires_at: expiresAt,
    }).eq('id', user_id);

    return res.status(200).json({ access_token: tokenData.access_token, expires_in: tokenData.expires_in });
}

// ============================================================
// ACTION: SYNC (HubSpot → CloseOS full import)
// ============================================================
async function handleSync(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabase();
    const { user_id, offer_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    const accessToken = await getValidToken(supabase, user_id);
    if (!accessToken) return res.status(401).json({ error: 'No valid HubSpot token' });

    // Fetch all contacts (paginated)
    let allContacts: any[] = [];
    let after: string | undefined = undefined;
    const properties = 'firstname,lastname,email,phone,company,lifecyclestage';

    do {
        const url = new URL('https://api.hubapi.com/crm/v3/objects/contacts');
        url.searchParams.set('limit', '100');
        url.searchParams.set('properties', properties);
        if (after) url.searchParams.set('after', after);

        const contactsRes = await fetch(url.toString(), {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        const contactsData = await contactsRes.json();

        if (!contactsRes.ok) {
            return res.status(contactsRes.status).json({ error: 'Failed to fetch contacts', details: contactsData });
        }

        allContacts = allContacts.concat(contactsData.results || []);
        after = contactsData.paging?.next?.after;
    } while (after);

    console.log(`[HubSpot Sync] Fetched ${allContacts.length} contacts`);

    // Get existing prospects
    const { data: existingProspects } = await supabase
        .from('prospects')
        .select('id, hubspot_contact_id, email')
        .eq('user_id', user_id);

    const existingByHubspotId = new Map<string, any>();
    const existingByEmail = new Map<string, any>();
    (existingProspects || []).forEach((p: any) => {
        if (p.hubspot_contact_id) existingByHubspotId.set(p.hubspot_contact_id, p);
        if (p.email) existingByEmail.set(p.email.toLowerCase(), p);
    });

    // Get offer name
    let offerName = 'HubSpot';
    if (offer_id) {
        const { data: offer } = await supabase.from('offers').select('name').eq('id', offer_id).single();
        if (offer) offerName = offer.name;
    }

    let imported = 0;
    let updated = 0;

    for (const contact of allContacts) {
        const props = contact.properties || {};
        const hubspotId = String(contact.id);
        const firstName = props.firstname || '';
        const lastName = props.lastname || '';
        const email = props.email || '';
        const phone = props.phone || '';
        const company = props.company || '';
        const stage = mapHubspotToCloseos(props.lifecyclestage);

        const existingById = existingByHubspotId.get(hubspotId);
        const existingByMail = email ? existingByEmail.get(email.toLowerCase()) : null;
        const existing = existingById || existingByMail;

        if (existing) {
            const updates: any = { hubspot_contact_id: hubspotId };
            if (firstName && !existing.firstName) updates.firstName = firstName;
            if (lastName && !existing.lastName) updates.lastName = lastName;
            if (phone && !existing.phone) updates.phone = phone;
            if (company && !existing.company) updates.company = company;
            await supabase.from('prospects').update(updates).eq('id', existing.id);
            updated++;
        } else {
            const fullName = `${firstName} ${lastName}`.trim() || email || 'Contact HubSpot';
            await supabase.from('prospects').insert([{
                user_id,
                contact: fullName,
                firstName: firstName || null,
                lastName: lastName || null,
                email: email || null,
                phone: phone || null,
                company: company || null,
                offer: offerName,
                offer_id: offer_id ? Number(offer_id) : null,
                stage,
                value: 0,
                hubspot_contact_id: hubspotId,
                integration_type: 'hubspot',
            }]);
            imported++;
        }
    }

    return res.status(200).json({ imported, updated, total: allContacts.length });
}

// ============================================================
// ACTION: PUSH (CloseOS → HubSpot)
// ============================================================
async function handlePush(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabase();
    const { user_id, prospect_id, firstName, lastName, email, phone, company, stage, hubspot_contact_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    const accessToken = await getValidToken(supabase, user_id);
    if (!accessToken) return res.status(401).json({ error: 'No valid HubSpot token' });

    const properties: any = {};
    if (firstName) properties.firstname = firstName;
    if (lastName) properties.lastname = lastName;
    if (email) properties.email = email;
    if (phone) properties.phone = phone;
    if (company) properties.company = company;
    if (stage) properties.lifecyclestage = mapCloseosToHubspot(stage);

    let contactId = hubspot_contact_id;

    if (contactId) {
        // UPDATE
        const updateRes = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ properties }),
        });

        if (!updateRes.ok) {
            const errData = await updateRes.json();
            if (errData.message?.includes('lifecyclestage') || errData.message?.includes('INVALID')) {
                delete properties.lifecyclestage;
                await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`, {
                    method: 'PATCH',
                    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ properties }),
                });
            }
        }
    } else {
        // CREATE
        const createRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ properties }),
        });

        const createData = await createRes.json();

        if (createRes.ok && createData.id) {
            contactId = String(createData.id);
            if (prospect_id) {
                await supabase.from('prospects').update({ hubspot_contact_id: contactId }).eq('id', prospect_id);
            }
        } else if (createRes.status === 409 && email) {
            // Contact already exists — search by email and update
            const searchRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
                method: 'POST',
                headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }] }),
            });
            const searchData = await searchRes.json();
            if (searchData.results?.[0]?.id) {
                contactId = String(searchData.results[0].id);
                await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`, {
                    method: 'PATCH',
                    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ properties }),
                });
                if (prospect_id) {
                    await supabase.from('prospects').update({ hubspot_contact_id: contactId }).eq('id', prospect_id);
                }
            }
        }
    }

    return res.status(200).json({ success: true, hubspot_contact_id: contactId });
}

// ============================================================
// ACTION: WEBHOOK (HubSpot → CloseOS events)
// ============================================================
async function handleWebhook(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabase();
    const events = Array.isArray(req.body) ? req.body : [req.body];

    for (const event of events) {
        const { subscriptionType, objectId, propertyName, propertyValue, portalId } = event;
        const hubspotContactId = String(objectId);

        // --- CONTACT CREATION: auto-import new contact ---
        if (subscriptionType === 'contact.creation') {
            console.log(`[HubSpot Webhook] New contact created: ${hubspotContactId}, portal: ${portalId}`);

            // Find user by portal_id
            const { data: profile } = await supabase
                .from('profiles')
                .select('id, hubspot_access_token')
                .eq('hubspot_portal_id', String(portalId))
                .single();

            if (!profile?.hubspot_access_token) {
                console.log('[HubSpot Webhook] No user found for portal:', portalId);
                continue;
            }

            // Check if prospect already exists
            const { data: existing } = await supabase
                .from('prospects')
                .select('id')
                .eq('hubspot_contact_id', hubspotContactId)
                .maybeSingle();

            if (existing) {
                console.log('[HubSpot Webhook] Contact already exists as prospect:', existing.id);
                continue;
            }

            // Fetch contact details from HubSpot
            const accessToken = await getValidToken(supabase, profile.id);
            if (!accessToken) continue;

            const contactRes = await fetch(
                `https://api.hubapi.com/crm/v3/objects/contacts/${hubspotContactId}?properties=firstname,lastname,email,phone,company,lifecyclestage`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );

            if (!contactRes.ok) {
                console.error('[HubSpot Webhook] Failed to fetch contact:', await contactRes.text());
                continue;
            }

            const contactData = await contactRes.json();
            const props = contactData.properties || {};
            const firstName = props.firstname || '';
            const lastName = props.lastname || '';
            const email = props.email || '';
            const phone = props.phone || '';
            const company = props.company || '';
            const stage = mapHubspotToCloseos(props.lifecyclestage);
            const fullName = `${firstName} ${lastName}`.trim() || email || 'Contact HubSpot';

            // Find the user's HubSpot offer
            const { data: hubspotOffer } = await supabase
                .from('offers')
                .select('id, name')
                .eq('user_id', profile.id)
                .eq('crm_provider', 'hubspot')
                .limit(1)
                .maybeSingle();

            await supabase.from('prospects').insert([{
                user_id: profile.id,
                contact: fullName,
                firstName: firstName || null,
                lastName: lastName || null,
                email: email || null,
                phone: phone || null,
                company: company || null,
                offer: hubspotOffer?.name || 'HubSpot',
                offer_id: hubspotOffer?.id || null,
                stage,
                value: 0,
                hubspot_contact_id: hubspotContactId,
                integration_type: 'hubspot',
            }]);

            console.log(`[HubSpot Webhook] Auto-imported contact: ${fullName} (${email})`);
        }

        // --- PROPERTY CHANGE: update existing prospect ---
        if (subscriptionType === 'contact.propertyChange' && propertyName === 'lifecyclestage') {
            const newStage = mapHubspotToCloseos(propertyValue);

            const { data: prospect } = await supabase
                .from('prospects')
                .select('id, stage')
                .eq('hubspot_contact_id', hubspotContactId)
                .single();

            if (prospect && prospect.stage !== newStage) {
                await supabase.from('prospects').update({
                    stage: newStage,
                    updated_at: new Date().toISOString(),
                }).eq('id', prospect.id);
                console.log(`[HubSpot Webhook] Prospect ${prospect.id}: ${prospect.stage} → ${newStage}`);
            }
        }
    }

    return res.status(200).json({ received: true });
}

// ============================================================
// MAIN HANDLER — Route by ?action=
// ============================================================
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const action = req.query.action as string;

    try {
        switch (action) {
            case 'callback': return await handleCallback(req, res);
            case 'refresh': return await handleRefresh(req, res);
            case 'sync': return await handleSync(req, res);
            case 'push': return await handlePush(req, res);
            case 'webhook': return await handleWebhook(req, res);
            default: return res.status(400).json({ error: `Unknown action: ${action}` });
        }
    } catch (error: any) {
        console.error(`[HubSpot ${action}] Error:`, error);
        return res.status(500).json({ error: error.message });
    }
}
