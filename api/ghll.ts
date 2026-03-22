import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// ============================================================
// CONSOLIDATED GOHIGHLEVEL API — All routes in one serverless fn
// Route via ?action=callback|refresh|sync|push|webhook|pipelines
// ============================================================

const GHL_BASE_URL = 'https://services.leadconnectorhq.com';
const GHL_AUTHORIZE_URL = 'https://marketplace.gohighlevel.com/oauth/chooselocation';
const GHL_API_VERSION = '2021-07-28';
const GHL_REDIRECT_URI = 'https://www.closeos.fr/api/ghll/callback';

function getSupabase() {
    return createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

function getClientId() {
    return process.env.GHL_CLIENT_ID || '';
}
function getClientSecret() {
    return process.env.GHL_CLIENT_SECRET || '';
}

function ghlHeaders(accessToken: string) {
    return {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Version: GHL_API_VERSION,
    };
}

// --- TOKEN HELPER ---
async function getValidToken(supabase: any, userId: string): Promise<string | null> {
    const { data: profile } = await supabase
        .from('profiles')
        .select('ghl_access_token, ghl_refresh_token, ghl_token_expires_at')
        .eq('id', userId)
        .single();

    if (!profile?.ghl_access_token) return null;

    const expiresAt = typeof profile.ghl_token_expires_at === 'number'
        ? profile.ghl_token_expires_at
        : parseInt(profile.ghl_token_expires_at || '0', 10);

    // Token still valid (with 2-minute buffer)
    if (expiresAt > 0 && Date.now() < (expiresAt - 120000)) {
        return profile.ghl_access_token;
    }

    if (!profile.ghl_refresh_token) return null;

    // Refresh the token
    const tokenRes = await fetch(`${GHL_BASE_URL}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: getClientId(),
            client_secret: getClientSecret(),
            refresh_token: profile.ghl_refresh_token,
        }).toString(),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return null;

    const newExpiresAt = Date.now() + (tokenData.expires_in || 86400) * 1000;
    await supabase.from('profiles').update({
        ghl_access_token: tokenData.access_token,
        ghl_refresh_token: tokenData.refresh_token || profile.ghl_refresh_token,
        ghl_token_expires_at: newExpiresAt,
    }).eq('id', userId);

    return tokenData.access_token;
}

// --- STAGE MAPPERS ---
// GHL uses custom pipeline stages per location. The mapping is stored in offers.crm_mapping
// crm_mapping format: { prospect: "stageId1", qualified: "stageId2", won: "stageId3", ... }

function mapGhlStageToCloseos(pipelineStageId: string, opportunityStatus: string, customMapping: any = {}): string {
    // Check opportunity-level status first (won/lost are universal in GHL)
    if (opportunityStatus === 'won') return 'won';
    if (opportunityStatus === 'lost') return 'lost';
    if (opportunityStatus === 'abandoned') return 'lost';

    // Check custom stage mapping (reverse lookup: find CloseOS stage that maps to this GHL stage)
    for (const [closeosStage, ghlStageId] of Object.entries(customMapping)) {
        if (ghlStageId === pipelineStageId) return closeosStage;
    }

    // Default: if no mapping found, keep as prospect
    return 'prospect';
}

function mapCloseosToGhlStatus(stage: string): string {
    switch (stage) {
        case 'won': return 'won';
        case 'lost': return 'lost';
        default: return 'open';
    }
}

// ============================================================
// ACTION: CALLBACK (OAuth redirect handler)
// ============================================================
async function handleCallback(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabase();
    const { code, state } = req.query;

    if (!code || !state) return res.redirect('/offers?ghl_error=missing_params');

    const userId = state as string;
    console.log('[GHL] OAuth callback for user:', userId);

    const tokenRes = await fetch(`${GHL_BASE_URL}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: getClientId(),
            client_secret: getClientSecret(),
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
        .select('ghl_refresh_token')
        .eq('id', user_id)
        .single();

    if (!profile?.ghl_refresh_token) return res.status(404).json({ error: 'No refresh token' });

    const tokenRes = await fetch(`${GHL_BASE_URL}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: getClientId(),
            client_secret: getClientSecret(),
            refresh_token: profile.ghl_refresh_token,
        }).toString(),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return res.status(400).json({ error: 'Refresh failed', details: tokenData });

    const expiresAt = Date.now() + (tokenData.expires_in || 86400) * 1000;
    await supabase.from('profiles').update({
        ghl_access_token: tokenData.access_token,
        ghl_refresh_token: tokenData.refresh_token || profile.ghl_refresh_token,
        ghl_token_expires_at: expiresAt,
    }).eq('id', user_id);

    return res.status(200).json({ access_token: tokenData.access_token, expires_in: tokenData.expires_in });
}

// ============================================================
// ACTION: PIPELINES (Get pipelines & stages for mapping UI)
// ============================================================
async function handlePipelines(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabase();
    const user_id = req.query.user_id as string;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    const accessToken = await getValidToken(supabase, user_id);
    if (!accessToken) return res.status(401).json({ error: 'No valid GHL token' });

    const { data: profile } = await supabase
        .from('profiles')
        .select('ghl_location_id')
        .eq('id', user_id)
        .single();

    const locationId = profile?.ghl_location_id;
    if (!locationId) return res.status(400).json({ error: 'No GHL location ID' });

    const pipelinesRes = await fetch(`${GHL_BASE_URL}/opportunities/pipelines?locationId=${locationId}`, {
        headers: ghlHeaders(accessToken),
    });

    if (!pipelinesRes.ok) {
        const errData = await pipelinesRes.json();
        return res.status(pipelinesRes.status).json({ error: 'Failed to fetch pipelines', details: errData });
    }

    const data = await pipelinesRes.json();
    const pipelines = data.pipelines || [];

    // Flatten stages with pipeline info
    const stages: any[] = [];
    for (const pipeline of pipelines) {
        for (const stage of pipeline.stages || []) {
            stages.push({
                id: stage.id,
                name: stage.name,
                pipeline_id: pipeline.id,
                pipeline_name: pipeline.name,
                position: stage.position,
            });
        }
    }

    return res.status(200).json({ pipelines, stages });
}

// ============================================================
// ACTION: SYNC (GHL → CloseOS full import)
// ============================================================
async function handleSync(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabase();
    const { user_id, offer_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    const accessToken = await getValidToken(supabase, user_id);
    if (!accessToken) return res.status(401).json({ error: 'No valid GHL token' });

    const { data: profile } = await supabase
        .from('profiles')
        .select('ghl_location_id')
        .eq('id', user_id)
        .single();

    const locationId = profile?.ghl_location_id;
    if (!locationId) return res.status(400).json({ error: 'No GHL location ID' });

    // Fetch all contacts (paginated)
    let allContacts: any[] = [];
    let startAfterId: string | undefined = undefined;
    const limit = 100;

    do {
        const url = new URL(`${GHL_BASE_URL}/contacts/`);
        url.searchParams.set('locationId', locationId);
        url.searchParams.set('limit', String(limit));
        if (startAfterId) url.searchParams.set('startAfterId', startAfterId);

        const contactsRes = await fetch(url.toString(), {
            headers: ghlHeaders(accessToken),
        });
        const contactsData = await contactsRes.json();

        if (!contactsRes.ok) {
            return res.status(contactsRes.status).json({ error: 'Failed to fetch contacts', details: contactsData });
        }

        const contacts = contactsData.contacts || [];
        allContacts = allContacts.concat(contacts);

        // GHL pagination: if we got `limit` results, there may be more
        if (contacts.length >= limit) {
            startAfterId = contacts[contacts.length - 1].id;
        } else {
            startAfterId = undefined;
        }
    } while (startAfterId);

    console.log(`[GHL Sync] Fetched ${allContacts.length} contacts`);

    // Fetch all opportunities to get deal values and stages
    let allOpportunities: any[] = [];
    let oppStartAfterId: string | undefined = undefined;

    // Get offer details & custom mapping
    let offerName = 'GoHighLevel';
    let customMapping: any = {};
    let pipelineId: string | null = null;

    if (offer_id) {
        const { data: offer } = await supabase.from('offers').select('name, crm_mapping').eq('id', offer_id).single();
        if (offer) {
            offerName = offer.name;
            customMapping = offer.crm_mapping || {};
            pipelineId = customMapping.ghlPipelineId || null;
        }
    } else {
        const { data: ghlOffer } = await supabase
            .from('offers')
            .select('name, crm_mapping')
            .eq('user_id', user_id)
            .eq('crm_provider', 'ghl')
            .limit(1)
            .maybeSingle();
        if (ghlOffer) {
            offerName = ghlOffer.name;
            customMapping = ghlOffer.crm_mapping || {};
            pipelineId = customMapping.ghlPipelineId || null;
        }
    }

    // Fetch opportunities if we have a pipeline
    if (pipelineId) {
        do {
            const url = new URL(`${GHL_BASE_URL}/opportunities/search`);
            url.searchParams.set('location_id', locationId);
            url.searchParams.set('pipeline_id', pipelineId);
            url.searchParams.set('limit', String(limit));
            if (oppStartAfterId) url.searchParams.set('startAfterId', oppStartAfterId);

            const oppRes = await fetch(url.toString(), {
                method: 'GET',
                headers: ghlHeaders(accessToken),
            });

            if (oppRes.ok) {
                const oppData = await oppRes.json();
                const opportunities = oppData.opportunities || [];
                allOpportunities = allOpportunities.concat(opportunities);
                if (opportunities.length >= limit) {
                    oppStartAfterId = opportunities[opportunities.length - 1].id;
                } else {
                    oppStartAfterId = undefined;
                }
            } else {
                oppStartAfterId = undefined;
            }
        } while (oppStartAfterId);
    }

    // Build opportunity lookup by contactId
    const oppByContactId = new Map<string, any>();
    for (const opp of allOpportunities) {
        if (opp.contactId) oppByContactId.set(opp.contactId, opp);
    }

    // Get existing prospects
    const { data: existingProspects } = await supabase
        .from('prospects')
        .select('id, ghl_contact_id, ghl_opportunity_id, email')
        .eq('user_id', user_id);

    const existingByGhlId = new Map<string, any>();
    const existingByEmail = new Map<string, any>();
    (existingProspects || []).forEach((p: any) => {
        if (p.ghl_contact_id) existingByGhlId.set(p.ghl_contact_id, p);
        if (p.email) existingByEmail.set(p.email.toLowerCase(), p);
    });

    let imported = 0;
    let updated = 0;

    for (const contact of allContacts) {
        const ghlId = contact.id;
        const firstName = contact.firstName || '';
        const lastName = contact.lastName || '';
        const email = contact.email || '';
        const phone = contact.phone || '';
        const company = contact.companyName || '';

        // Get opportunity data if available
        const opp = oppByContactId.get(ghlId);
        const stage = opp
            ? mapGhlStageToCloseos(opp.pipelineStageId || '', opp.status || '', customMapping)
            : 'prospect';
        const value = opp?.monetaryValue || 0;
        const oppId = opp?.id || null;

        const existingById = existingByGhlId.get(ghlId);
        const existingByMail = email ? existingByEmail.get(email.toLowerCase()) : null;
        const existing = existingById || existingByMail;

        if (existing) {
            const updates: any = { ghl_contact_id: ghlId };
            if (oppId) updates.ghl_opportunity_id = oppId;
            if (firstName && !existing.firstName) updates.firstName = firstName;
            if (lastName && !existing.lastName) updates.lastName = lastName;
            if (phone && !existing.phone) updates.phone = phone;
            if (company && !existing.company) updates.company = company;
            if (opp) {
                updates.stage = stage;
                if (value > 0) updates.value = value;
            }
            await supabase.from('prospects').update(updates).eq('id', existing.id);
            updated++;
        } else {
            const fullName = `${firstName} ${lastName}`.trim() || email || 'Contact GHL';
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
                value,
                ghl_contact_id: ghlId,
                ghl_opportunity_id: oppId,
                integration_type: 'ghl',
            }]);
            imported++;
        }
    }

    return res.status(200).json({ imported, updated, total: allContacts.length });
}

// ============================================================
// ACTION: PUSH (CloseOS → GHL)
// ============================================================
async function handlePush(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabase();
    const { user_id, prospect_id, firstName, lastName, email, phone, company, stage, ghl_contact_id, ghl_opportunity_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    const accessToken = await getValidToken(supabase, user_id);
    if (!accessToken) return res.status(401).json({ error: 'No valid GHL token' });

    const { data: profile } = await supabase
        .from('profiles')
        .select('ghl_location_id')
        .eq('id', user_id)
        .single();

    const locationId = profile?.ghl_location_id;
    if (!locationId) return res.status(400).json({ error: 'No GHL location ID' });

    // Get custom mapping
    let customMapping: any = {};
    const { data: prospectOffer } = await supabase
        .from('prospects')
        .select('offer_id')
        .eq('id', prospect_id)
        .maybeSingle();

    if (prospectOffer?.offer_id) {
        const { data: offer } = await supabase.from('offers').select('crm_mapping').eq('id', prospectOffer.offer_id).single();
        if (offer) customMapping = offer.crm_mapping || {};
    } else {
        const { data: offer } = await supabase.from('offers').select('crm_mapping').eq('user_id', user_id).eq('crm_provider', 'ghl').limit(1).maybeSingle();
        if (offer) customMapping = offer.crm_mapping || {};
    }

    // --- Update or create contact ---
    let contactId = ghl_contact_id;
    const contactBody: any = {
        locationId,
    };
    if (firstName) contactBody.firstName = firstName;
    if (lastName) contactBody.lastName = lastName;
    if (email) contactBody.email = email;
    if (phone) contactBody.phone = phone;
    if (company) contactBody.companyName = company;

    if (contactId) {
        // Update existing contact
        await fetch(`${GHL_BASE_URL}/contacts/${contactId}`, {
            method: 'PUT',
            headers: ghlHeaders(accessToken),
            body: JSON.stringify(contactBody),
        });
    } else {
        // Upsert contact (matches by email/phone)
        const upsertRes = await fetch(`${GHL_BASE_URL}/contacts/upsert`, {
            method: 'POST',
            headers: ghlHeaders(accessToken),
            body: JSON.stringify(contactBody),
        });

        const upsertData = await upsertRes.json();
        if (upsertData.contact?.id) {
            contactId = upsertData.contact.id;
            if (prospect_id) {
                await supabase.from('prospects').update({ ghl_contact_id: contactId }).eq('id', prospect_id);
            }
        }
    }

    // --- Update or create opportunity (if stage changed and pipeline is configured) ---
    let opportunityId = ghl_opportunity_id;
    const pipelineId = customMapping.ghlPipelineId;

    if (stage && pipelineId && contactId) {
        const ghlStatus = mapCloseosToGhlStatus(stage);

        // Find the GHL stage ID from mapping
        const ghlStageId = customMapping[stage] || null;

        if (opportunityId) {
            // Update existing opportunity
            const updateBody: any = { status: ghlStatus };
            if (ghlStageId) updateBody.pipelineStageId = ghlStageId;

            await fetch(`${GHL_BASE_URL}/opportunities/${opportunityId}`, {
                method: 'PUT',
                headers: ghlHeaders(accessToken),
                body: JSON.stringify(updateBody),
            });
        } else if (ghlStageId) {
            // Create new opportunity
            const oppBody: any = {
                pipelineId,
                pipelineStageId: ghlStageId,
                locationId,
                contactId,
                name: `${firstName || ''} ${lastName || ''}`.trim() || email || 'Deal CloseOS',
                status: ghlStatus,
            };

            const createRes = await fetch(`${GHL_BASE_URL}/opportunities/`, {
                method: 'POST',
                headers: ghlHeaders(accessToken),
                body: JSON.stringify(oppBody),
            });

            const createData = await createRes.json();
            if (createData.opportunity?.id) {
                opportunityId = createData.opportunity.id;
                if (prospect_id) {
                    await supabase.from('prospects').update({ ghl_opportunity_id: opportunityId }).eq('id', prospect_id);
                }
            }
        }
    }

    return res.status(200).json({ success: true, ghl_contact_id: contactId, ghl_opportunity_id: opportunityId });
}

// ============================================================
// ACTION: WEBHOOK (GHL → CloseOS events)
// ============================================================
async function handleWebhook(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabase();
    const event = req.body;

    if (!event || !event.type) {
        return res.status(200).json({ received: true });
    }

    const eventType = event.type;
    const locationId = event.locationId;

    console.log(`[GHL Webhook] Event: ${eventType}, location: ${locationId}`);

    // Find user by location_id
    const { data: profile } = await supabase
        .from('profiles')
        .select('id, ghl_access_token')
        .eq('ghl_location_id', locationId)
        .single();

    if (!profile?.ghl_access_token) {
        console.log('[GHL Webhook] No user found for location:', locationId);
        return res.status(200).json({ received: true });
    }

    const userId = profile.id;

    // --- CONTACT EVENTS ---
    if (eventType === 'ContactCreate' || eventType === 'ContactUpdate') {
        const contactId = event.id || event.contactId;
        if (!contactId) return res.status(200).json({ received: true });

        // Fetch contact details
        const accessToken = await getValidToken(supabase, userId);
        if (!accessToken) return res.status(200).json({ received: true });

        const contactRes = await fetch(`${GHL_BASE_URL}/contacts/${contactId}`, {
            headers: ghlHeaders(accessToken),
        });

        if (!contactRes.ok) {
            console.error('[GHL Webhook] Failed to fetch contact:', contactId);
            return res.status(200).json({ received: true });
        }

        const contactData = await contactRes.json();
        const contact = contactData.contact || contactData;

        const firstName = contact.firstName || '';
        const lastName = contact.lastName || '';
        const email = contact.email || '';
        const phone = contact.phone || '';
        const company = contact.companyName || '';

        // Check if prospect already exists
        const { data: existing } = await supabase
            .from('prospects')
            .select('id')
            .eq('ghl_contact_id', contactId)
            .maybeSingle();

        if (eventType === 'ContactCreate' && !existing) {
            // Get GHL offer & mapping
            const { data: ghlOffer } = await supabase
                .from('offers')
                .select('id, name, crm_mapping')
                .eq('user_id', userId)
                .eq('crm_provider', 'ghl')
                .limit(1)
                .maybeSingle();

            const fullName = `${firstName} ${lastName}`.trim() || email || 'Contact GHL';

            await supabase.from('prospects').insert([{
                user_id: userId,
                contact: fullName,
                firstName: firstName || null,
                lastName: lastName || null,
                email: email || null,
                phone: phone || null,
                company: company || null,
                offer: ghlOffer?.name || 'GoHighLevel',
                offer_id: ghlOffer?.id || null,
                stage: 'prospect',
                value: 0,
                ghl_contact_id: contactId,
                integration_type: 'ghl',
            }]);

            console.log(`[GHL Webhook] Auto-imported contact: ${fullName} (${email})`);
        } else if (eventType === 'ContactUpdate' && existing) {
            const updates: any = {};
            if (firstName) updates.firstName = firstName;
            if (lastName) updates.lastName = lastName;
            if (firstName || lastName) updates.contact = `${firstName} ${lastName}`.trim();
            if (email) updates.email = email;
            if (phone) updates.phone = phone;
            if (company) updates.company = company;

            await supabase.from('prospects').update(updates).eq('id', existing.id);
            console.log(`[GHL Webhook] Updated contact: ${existing.id}`);
        }
    }

    // --- OPPORTUNITY EVENTS ---
    if (eventType === 'OpportunityCreate' || eventType === 'OpportunityUpdate' ||
        eventType === 'OpportunityStageUpdate' || eventType === 'OpportunityStatusUpdate' ||
        eventType === 'OpportunityMonetaryValueUpdate') {

        const opportunityId = event.id;
        const contactId = event.contactId;
        const pipelineStageId = event.pipelineStageId || '';
        const status = event.status || 'open';
        const monetaryValue = event.monetaryValue;

        if (!contactId) return res.status(200).json({ received: true });

        // Get custom mapping
        const { data: ghlOffer } = await supabase
            .from('offers')
            .select('id, name, crm_mapping')
            .eq('user_id', userId)
            .eq('crm_provider', 'ghl')
            .limit(1)
            .maybeSingle();

        const customMapping = ghlOffer?.crm_mapping || {};

        // Find existing prospect by contact or opportunity ID
        let { data: prospect } = await supabase
            .from('prospects')
            .select('id, stage, ghl_contact_id, ghl_opportunity_id')
            .or(`ghl_contact_id.eq.${contactId},ghl_opportunity_id.eq.${opportunityId}`)
            .eq('user_id', userId)
            .maybeSingle();

        if (prospect) {
            const newStage = mapGhlStageToCloseos(pipelineStageId, status, customMapping);
            const updates: any = {
                ghl_opportunity_id: opportunityId,
                ghl_contact_id: contactId,
            };

            if (prospect.stage !== newStage) {
                updates.stage = newStage;
            }
            if (monetaryValue !== undefined && monetaryValue !== null) {
                updates.value = monetaryValue;
            }

            await supabase.from('prospects').update(updates).eq('id', prospect.id);
            console.log(`[GHL Webhook] Prospect ${prospect.id}: ${prospect.stage} → ${updates.stage || prospect.stage}`);
        } else if (eventType === 'OpportunityCreate') {
            // Fetch contact details to create prospect
            const accessToken = await getValidToken(supabase, userId);
            if (accessToken) {
                const contactRes = await fetch(`${GHL_BASE_URL}/contacts/${contactId}`, {
                    headers: ghlHeaders(accessToken),
                });

                if (contactRes.ok) {
                    const contactData = await contactRes.json();
                    const contact = contactData.contact || contactData;
                    const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email || 'Contact GHL';
                    const newStage = mapGhlStageToCloseos(pipelineStageId, status, customMapping);

                    await supabase.from('prospects').insert([{
                        user_id: userId,
                        contact: fullName,
                        firstName: contact.firstName || null,
                        lastName: contact.lastName || null,
                        email: contact.email || null,
                        phone: contact.phone || null,
                        company: contact.companyName || null,
                        offer: ghlOffer?.name || 'GoHighLevel',
                        offer_id: ghlOffer?.id || null,
                        stage: newStage,
                        value: monetaryValue || 0,
                        ghl_contact_id: contactId,
                        ghl_opportunity_id: opportunityId,
                        integration_type: 'ghl',
                    }]);

                    console.log(`[GHL Webhook] Auto-imported opportunity contact: ${fullName}`);
                }
            }
        }
    }

    // --- CONTACT DELETE ---
    if (eventType === 'ContactDelete') {
        const contactId = event.id || event.contactId;
        if (contactId) {
            // Don't auto-delete, just log — user may want to keep the prospect
            console.log(`[GHL Webhook] Contact deleted in GHL: ${contactId} (not deleting from CloseOS)`);
        }
    }

    // --- OPPORTUNITY DELETE ---
    if (eventType === 'OpportunityDelete') {
        const opportunityId = event.id;
        if (opportunityId) {
            console.log(`[GHL Webhook] Opportunity deleted in GHL: ${opportunityId} (not deleting from CloseOS)`);
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
            case 'pipelines': return await handlePipelines(req, res);
            case 'sync': return await handleSync(req, res);
            case 'push': return await handlePush(req, res);
            case 'webhook': return await handleWebhook(req, res);
            default: return res.status(400).json({ error: `Unknown action: ${action}` });
        }
    } catch (error: any) {
        console.error(`[GHL ${action}] Error:`, error);
        return res.status(500).json({ error: error.message });
    }
}
