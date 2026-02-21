import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Map HubSpot lifecycle stage to CloseOS stage
function mapHubspotToCloseosStage(lifecycle: string | null): string {
    if (!lifecycle) return 'prospect';
    const lc = lifecycle.toLowerCase();
    if (['subscriber', 'lead'].includes(lc)) return 'prospect';
    if (['marketingqualifiedlead', 'salesqualifiedlead', 'opportunity'].includes(lc)) return 'qualified';
    if (['customer', 'evangelist'].includes(lc)) return 'won';
    if (lc === 'other') return 'lost';
    return 'prospect';
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        // HubSpot sends an array of events
        const events = Array.isArray(req.body) ? req.body : [req.body];

        console.log(`[HubSpot Webhook] Received ${events.length} events`);

        for (const event of events) {
            const { subscriptionType, objectId, propertyName, propertyValue, portalId } = event;

            // We're interested in contact property changes (lifecyclestage)
            if (subscriptionType === 'contact.propertyChange' && propertyName === 'lifecyclestage') {
                const hubspotContactId = String(objectId);
                const newStage = mapHubspotToCloseosStage(propertyValue);

                console.log(`[HubSpot Webhook] Contact ${hubspotContactId} lifecycle → ${propertyValue} → CloseOS stage: ${newStage}`);

                // Find the prospect by hubspot_contact_id
                const { data: prospect, error } = await supabase
                    .from('prospects')
                    .select('id, stage')
                    .eq('hubspot_contact_id', hubspotContactId)
                    .single();

                if (prospect && prospect.stage !== newStage) {
                    await supabase.from('prospects').update({
                        stage: newStage,
                        updated_at: new Date().toISOString(),
                    }).eq('id', prospect.id);

                    console.log(`[HubSpot Webhook] Updated prospect ${prospect.id} stage: ${prospect.stage} → ${newStage}`);
                }
            }

            // Contact creation or update
            if (subscriptionType === 'contact.creation' || subscriptionType === 'contact.propertyChange') {
                // We handle bulk sync via the sync endpoint, so we just log here
                console.log(`[HubSpot Webhook] ${subscriptionType} for objectId ${objectId}`);
            }
        }

        // HubSpot expects a 200 response quickly
        return res.status(200).json({ received: true });

    } catch (error: any) {
        console.error('[HubSpot Webhook] Error:', error);
        return res.status(200).json({ received: true, error: error.message });
    }
}
