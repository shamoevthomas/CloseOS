
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// This handler will be triggered by a Supabase Webhook on user creation
// OR manually called by a script.

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Allow manual sync via POST with secret?
    // Or handle Supabase webhook payload structure

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { record, secret } = req.body;

    // Basic security check (if secret is passed in query or body)
    const SUPABASE_WEBHOOK_SECRET = process.env.SUPABASE_WEBHOOK_SECRET;
    if (SUPABASE_WEBHOOK_SECRET && secret !== SUPABASE_WEBHOOK_SECRET) {
        // If webhook setup uses header, check req.headers['x-supabase-signature'] etc.
        // For simplicity, we can pass secret in query param within the webhook URL configuration in Supabase
        // URL: https://.../api/sync-brevo?secret=...
    }

    // Payload from Supabase Auth Hook (if used) or Database Webhook
    // Database Webhook structure: { type: 'INSERT', table: 'users', record: { ... }, schema: 'public' }
    // Auth Hook structure: varies

    // Let's assume Database Webhook on `public.users` table
    const email = record?.email;
    const firstName = record?.first_name;
    const lastName = record?.last_name;

    if (!email) {
        return res.status(400).json({ error: 'No email provided in record' });
    }

    const BREVO_API_KEY = process.env.BREVO_API_KEY;
    if (!BREVO_API_KEY) {
        return res.status(500).json({ error: 'BREVO_API_KEY missing' });
    }

    try {
        const response = await fetch('https://api.brevo.com/v3/contacts', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': BREVO_API_KEY,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                email: email,
                attributes: {
                    PRENOM: firstName,
                    NOM: lastName
                },
                updateEnabled: true, // Update if exists
                // listIds: [2] // Optional: Add to a specific list ID if you know it.
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Brevo Error:', data);
            // Return 200 to prevent webhook retries loop if it's a validation error
            return res.status(200).json({ error: 'Brevo API Error', details: data });
        }

        return res.status(200).json({ success: true, data });
    } catch (error: any) {
        console.error('Sync Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
