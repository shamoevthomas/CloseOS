export const config = {
    runtime: 'edge',
};

export default async function handler(req: Request) {
    const BREVO_API_KEY = process.env.BREVO_API_KEY || process.env.VITE_BREVO_API_KEY;

    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    if (!BREVO_API_KEY) {
        console.error("BREVO_API_KEY is missing from environment");
        return new Response(JSON.stringify({
            error: 'BREVO_API_KEY is missing from environment',
            message: 'Please ensure BREVO_API_KEY is set in Vercel environment variables.'
        }), { status: 500 });
    }

    try {
        const { email } = await req.json();

        if (!email) {
            return new Response(JSON.stringify({ error: 'Email is required' }), { status: 400 });
        }

        const htmlContent = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bienvenue sur la liste d'attente CloseOS Business</title>
        <style>
            body { margin: 0; padding: 0; background-color: #FDFBF7; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #493627; }
            .wrapper { width: 100%; table-layout: fixed; background-color: #FDFBF7; padding-bottom: 60px; padding-top: 40px; }
            .main { margin: 0 auto; width: 100%; max-width: 600px; border-spacing: 0; }
            .logo-container { padding: 40px 0; text-align: center; }
            .content-card { background-color: #ffffff; border: 1px solid rgba(73, 54, 39, 0.05); border-radius: 24px; padding: 40px; box-shadow: 0 10px 30px rgba(73, 54, 39, 0.05); }
            h1 { font-family: 'Georgia', serif; font-size: 26px; font-weight: bold; margin-bottom: 24px; color: #493627; line-height: 1.2; text-align: center; }
            p { font-size: 16px; line-height: 1.6; margin-bottom: 20px; color: rgba(73, 54, 39, 0.8); }
            
            /* High-End Button Design */
            .btn-primary { 
                background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); 
                color: #ffffff !important; 
                text-decoration: none; 
                padding: 18px 32px; 
                border-radius: 14px; 
                font-weight: bold; 
                display: block; 
                text-align: center; 
                font-size: 17px; 
                margin-bottom: 16px; 
                margin-top: 32px;
                box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
            }
            .btn-secondary-container { display: flex; gap: 12px; margin-top: 12px; }
            .btn-secondary { 
                flex: 1; 
                text-decoration: none; 
                padding: 14px; 
                border-radius: 12px; 
                font-weight: bold; 
                text-align: center; 
                font-size: 14px; 
                display: inline-block; 
                border: 1px solid rgba(73, 54, 39, 0.1);
                background-color: rgba(255, 255, 255, 0.5);
                transition: background-color 0.2s;
            }
            .btn-whatsapp { color: #25D366 !important; border-color: rgba(37, 211, 102, 0.2); background-color: rgba(37, 211, 102, 0.03); }
            .btn-linkedin { color: #0A66C2 !important; border-color: rgba(10, 102, 194, 0.2); background-color: rgba(10, 102, 194, 0.03); }
            
            .footer { color: rgba(73, 54, 39, 0.4); font-size: 12px; text-align: center; margin-top: 40px; text-transform: uppercase; letter-spacing: 1.5px; }

            @media screen and (max-width: 480px) { 
                .btn-secondary-container { display: block; } 
                .btn-secondary { display: block; margin-bottom: 8px; width: auto; } 
                .content-card { padding: 30px 20px; }
            }
        </style>
    </head>
    <body>
        <center class="wrapper">
            <table class="main" width="100%">
                <tr>
                    <td class="logo-container">
                        <img src="https://closeros-mvp.vercel.app/CloseOS%20Buisness.png" alt="CloseOS Business" width="160">
                    </td>
                </tr>
                <tr>
                    <td style="padding: 0 20px;">
                        <div class="content-card">
                            <h1>Bienvenue dans l'écosystème Business.</h1>
                            <p>C'est noté ! Nous avons bien reçu votre inscription à la liste d'attente CloseOS Business.</p>
                            <p>Vous serez parmi les premiers informés de nos avancées et surtout de l'ouverture officielle des accès pour piloter votre empire de closing.</p>
                            
                            <div style="margin-top: 40px;">
                                <a href="https://docs.google.com/forms/d/e/1FAIpQLSfG_km1jRFBreeHvhksMAvAxwokZEOdahTicsKikNwk71IUwg/viewform" class="btn-primary">📝 Partager mes besoins</a>
                                <div class="btn-secondary-container">
                                    <a href="https://whatsapp.com/channel/0029Vb7P4lqDDmFLVtD7Jn0s" class="btn-secondary btn-whatsapp">📲 Canal WhatsApp</a>
                                    <a href="https://www.linkedin.com/in/thomas-shamoev/" class="btn-secondary btn-linkedin">💼 Me suivre sur LinkedIn</a>
                                </div>
                            </div>
                        </div>
                        <div class="footer">
                            <p>© 2026 CloseOS Business · <a href="mailto:support@closeos.fr" style="color: inherit; text-decoration: underline;">support@closeos.fr</a></p>
                        </div>
                    </td>
                </tr>
            </table>
        </center>
    </body>
    </html>
    `;

        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': BREVO_API_KEY || '',
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                sender: { name: 'CloseOS Business', email: 'support@closeos.fr' },
                to: [{ email }],
                subject: "Bienvenue sur la liste d'attente CloseOS Business 🚀",
                htmlContent
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Brevo Error Response:", data);
            return new Response(JSON.stringify({
                error: 'Brevo API Error',
                details: data,
                senderUsed: 'support@closeos.fr',
                keyLength: BREVO_API_KEY ? BREVO_API_KEY.length : 0
            }), { status: response.status });
        }

        return new Response(JSON.stringify(data), {
            status: response.status,
            headers: { 'content-type': 'application/json' }
        });
    } catch (error) {
        console.error("Erreur API Email:", error);
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
    }
}
