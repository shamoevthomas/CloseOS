export const config = {
    runtime: 'edge',
};

export default async function handler(req: Request) {
    const BREVO_API_KEY = process.env.BREVO_API_KEY;

    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    if (!BREVO_API_KEY) {
        console.error("BREVO_API_KEY is missing");
        return new Response(JSON.stringify({ error: 'BREVO_API_KEY is missing from environment' }), { status: 500 });
    }

    try {
        const { email } = await req.json();

        if (!email) {
            return new Response(JSON.stringify({ error: 'Email is required' }), { status: 400 });
        }

        const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #FDFBF7; color: #493627; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
            .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
            .header { text-align: center; margin-bottom: 40px; }
            .logo { height: 60px; margin-bottom: 20px; }
            .card { background-color: #ffffff; border-radius: 24px; padding: 40px; box-shadow: 0 10px 30px rgba(73, 54, 39, 0.05); border: 1px solid rgba(73, 54, 39, 0.05); }
            h1 { font-family: 'Georgia', serif; font-size: 28px; line-height: 1.2; margin-bottom: 20px; color: #493627; }
            p { font-size: 16px; line-height: 1.6; margin-bottom: 24px; color: rgba(73, 54, 39, 0.8); }
            .cta-container { display: flex; flex-direction: column; gap: 12px; margin-top: 32px; }
            .button { display: block; text-align: center; padding: 14px 20px; border-radius: 12px; font-weight: bold; text-decoration: none; font-size: 15px; transition: all 0.2s; }
            .button-whatsapp { background-color: #25D366; color: #ffffff; }
            .button-form { background-color: #493627; color: #ffffff; }
            .button-linkedin { background-color: #0A66C2; color: #ffffff; }
            .footer { text-align: center; margin-top: 40px; font-size: 12px; color: rgba(73, 54, 39, 0.4); text-transform: uppercase; letter-spacing: 0.1em; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <img src="https://closeros-mvp.vercel.app/CloseOS%20Buisness.png" alt="CloseOS Business" class="logo">
            </div>
            <div class="card">
                <h1>Bienvenue dans l'écosystème Business.</h1>
                <p>C'est noté ! Nous avons bien reçu votre inscription à la liste d'attente CloseOS Business.</p>
                <p>Vous serez parmi les premiers informés de nos avancées et surtout de l'ouverture officielle des accès pour piloter votre empire de closing.</p>
                <p>En attendant, voici comment vous pouvez déjà vous impliquer :</p>
                
                <div class="cta-container">
                    <a href="https://whatsapp.com/channel/0029Vb7P4lqDDmFLVtD7Jn0s" class="button button-whatsapp">Rejoindre le canal WhatsApp</a>
                    <a href="https://docs.google.com/forms/d/e/1FAIpQLSfG_km1jRFBreeHvhksMAvAxwokZEOdahTicsKikNwk71IUwg/viewform" class="button button-form">Partager vos besoins (Google Form)</a>
                    <a href="https://www.linkedin.com/in/thomas-shamoev/" class="button button-linkedin">Me suivre sur LinkedIn</a>
                </div>
            </div>
            <div class="footer">
                CloseOS Business • Support@closeos.fr
            </div>
        </div>
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
            return new Response(JSON.stringify(data), { status: response.status });
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
