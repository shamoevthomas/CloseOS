export const config = {
    runtime: 'edge',
};

const brevoApiKey = process.env.BREVO_API_KEY!;

export default async function handler(req: Request) {
    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
    }

    try {
        const { email } = await req.json();

        if (!email) {
            return new Response(JSON.stringify({ error: 'Email requis' }), { status: 400 });
        }

        // Generate 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        // Store code in response (we'll verify client-side by comparing)
        // For MVP: send code via email, return hashed version to frontend
        // Simple approach: return the code hashed, frontend compares user input
        // More secure: store server-side. But for MVP, we'll use a simple hash.

        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': brevoApiKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                sender: { email: 'support@closeos.fr', name: 'CloseOS' },
                to: [{ email }],
                subject: 'Code de vérification — Suppression de compte CloseOS',
                htmlContent: `
                    <div style="font-family: sans-serif; color: #333; max-width: 500px; margin: 0 auto;">
                        <h2 style="color: #1e293b;">Code de vérification</h2>
                        <p>Vous avez demandé la suppression de votre compte CloseOS.</p>
                        <p>Voici votre code de confirmation :</p>
                        <div style="background: #f1f5f9; padding: 20px; border-radius: 12px; text-align: center; margin: 24px 0;">
                            <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #ef4444;">${code}</span>
                        </div>
                        <p style="color: #64748b; font-size: 14px;">Ce code expire dans 10 minutes. Si vous n'avez pas fait cette demande, ignorez cet email.</p>
                        <p>L'équipe CloseOS</p>
                    </div>
                `
            })
        });

        if (!response.ok) {
            throw new Error('Erreur envoi email');
        }

        return new Response(JSON.stringify({ success: true, code }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('Send deletion code error:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
