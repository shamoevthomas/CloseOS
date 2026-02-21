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

    // If token is still valid (with 2min buffer), use it
    if (expiresAt > 0 && Date.now() < (expiresAt - 120000)) {
        return profile.hubspot_access_token;
    }

    // Otherwise refresh
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
        const { user_id, offer_id } = req.body;
        if (!user_id) return res.status(400).json({ error: 'user_id required' });

        const accessToken = await getValidToken(supabase, user_id, clientId, clientSecret);
        if (!accessToken) return res.status(401).json({ error: 'No valid HubSpot token' });

        // 1. Fetch all contacts from HubSpot (paginated)
        let allContacts: any[] = [];
        let after: string | undefined = undefined;
        const properties = 'firstname,lastname,email,phone,company,lifecyclestage,hs_lead_status,notes_last_updated,notes_last_contacted';

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
                console.error('[HubSpot Sync] Contacts fetch error:', contactsData);
                return res.status(contactsRes.status).json({ error: 'Failed to fetch contacts', details: contactsData });
            }

            allContacts = allContacts.concat(contactsData.results || []);
            after = contactsData.paging?.next?.after;
        } while (after);

        console.log(`[HubSpot Sync] Fetched ${allContacts.length} contacts`);

        // 2. Get existing prospects for this user
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

        // 3. Get the offer name to associate
        let offerName = 'HubSpot';
        if (offer_id) {
            const { data: offer } = await supabase.from('offers').select('name').eq('id', offer_id).single();
            if (offer) offerName = offer.name;
        }

        // 4. Map HubSpot lifecycle stage to CloseOS stage
        const mapStage = (lifecycle: string | null): string => {
            if (!lifecycle) return 'prospect';
            const lc = lifecycle.toLowerCase();
            if (['subscriber', 'lead'].includes(lc)) return 'prospect';
            if (['marketingqualifiedlead', 'salesqualifiedlead', 'opportunity'].includes(lc)) return 'qualified';
            if (lc === 'customer') return 'won';
            if (lc === 'evangelist') return 'won';
            if (lc === 'other') return 'lost';
            return 'prospect';
        };

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
            const stage = mapStage(props.lifecyclestage);

            // Check if already exists
            const existingById = existingByHubspotId.get(hubspotId);
            const existingByMail = email ? existingByEmail.get(email.toLowerCase()) : null;
            const existing = existingById || existingByMail;

            if (existing) {
                // Update existing
                const updates: any = { hubspot_contact_id: hubspotId };
                if (firstName && !existing.firstName) updates.firstName = firstName;
                if (lastName && !existing.lastName) updates.lastName = lastName;
                if (phone && !existing.phone) updates.phone = phone;
                if (company && !existing.company) updates.company = company;

                await supabase.from('prospects').update(updates).eq('id', existing.id);
                updated++;
            } else {
                // Create new
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

        console.log(`[HubSpot Sync] Done: ${imported} imported, ${updated} updated`);
        return res.status(200).json({ imported, updated, total: allContacts.length });

    } catch (error: any) {
        console.error('[HubSpot Sync] Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
