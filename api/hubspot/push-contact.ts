import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Helper: get a valid HubSpot access token (auto-refresh if needed)
async function getValidToken(supabase: any, userId: string, clientId: string, clientSecret: string): Promise<string | null> {
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
            client_id: clientId,
            client_secret: clientSecret,
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

// Map CloseOS stage to HubSpot lifecycle stage
function mapToHubspotStage(closeosStage: string): string {
    switch (closeosStage) {
        case 'prospect': return 'lead';
        case 'qualified': return 'salesqualifiedlead';
        case 'won': return 'customer';
        case 'followup': return 'salesqualifiedlead';
        case 'noshow': return 'lead';
        case 'lost': return 'other';
        default: return 'lead';
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const supabaseUrl = process.env.VITE_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const clientId = process.env.HUBSPOT_CLIENT_ID || '4ffa6fe0-353d-4275-9998-2bada782b56c';
    const clientSecret = process.env.HUBSPOT_CLIENT_SECRET || '146b5732-0bda-4768-b4b1-c8f5a519e56f';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        const { user_id, prospect_id, firstName, lastName, email, phone, company, stage, hubspot_contact_id } = req.body;
        if (!user_id) return res.status(400).json({ error: 'user_id required' });

        const accessToken = await getValidToken(supabase, user_id, clientId, clientSecret);
        if (!accessToken) return res.status(401).json({ error: 'No valid HubSpot token' });

        const properties: any = {};
        if (firstName) properties.firstname = firstName;
        if (lastName) properties.lastname = lastName;
        if (email) properties.email = email;
        if (phone) properties.phone = phone;
        if (company) properties.company = company;
        if (stage) properties.lifecyclestage = mapToHubspotStage(stage);

        let contactId = hubspot_contact_id;

        if (contactId) {
            // UPDATE existing contact
            console.log(`[HubSpot Push] Updating contact ${contactId}`);
            const updateRes = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ properties }),
            });

            if (!updateRes.ok) {
                const errData = await updateRes.json();
                // If lifecycle stage can't go backwards, remove it and retry
                if (errData.message?.includes('INVALID_OPTION') || errData.message?.includes('lifecyclestage')) {
                    delete properties.lifecyclestage;
                    await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`, {
                        method: 'PATCH',
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ properties }),
                    });
                } else {
                    console.error('[HubSpot Push] Update error:', errData);
                }
            }
        } else {
            // CREATE new contact
            console.log('[HubSpot Push] Creating new contact');
            const createRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ properties }),
            });

            const createData = await createRes.json();

            if (createRes.ok && createData.id) {
                contactId = String(createData.id);
                console.log(`[HubSpot Push] Created contact: ${contactId}`);

                // Update Supabase prospect with hubspot_contact_id
                if (prospect_id) {
                    await supabase.from('prospects').update({
                        hubspot_contact_id: contactId,
                    }).eq('id', prospect_id);
                }
            } else {
                // If conflict (contact already exists by email), try to find and update
                if (createRes.status === 409 && createData.message?.includes('already exists')) {
                    // Search by email
                    const searchRes = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/search`, {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            filterGroups: [{
                                filters: [{ propertyName: 'email', operator: 'EQ', value: email }]
                            }]
                        }),
                    });
                    const searchData = await searchRes.json();
                    if (searchData.results?.[0]?.id) {
                        contactId = String(searchData.results[0].id);
                        // Update
                        await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`, {
                            method: 'PATCH',
                            headers: {
                                Authorization: `Bearer ${accessToken}`,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ properties }),
                        });
                        if (prospect_id) {
                            await supabase.from('prospects').update({ hubspot_contact_id: contactId }).eq('id', prospect_id);
                        }
                    }
                } else {
                    console.error('[HubSpot Push] Create error:', createData);
                    return res.status(createRes.status).json({ error: 'Failed to create contact', details: createData });
                }
            }
        }

        return res.status(200).json({ success: true, hubspot_contact_id: contactId });

    } catch (error: any) {
        console.error('[HubSpot Push] Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
