import { createClient } from '@supabase/supabase-js';

export const config = {
    runtime: 'edge',
};

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const brevoApiKey = process.env.BREVO_API_KEY!;
const cronSecret = process.env.CRON_SECRET;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function sendEmail(to: string, subject: string, htmlContent: string) {
    try {
        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': brevoApiKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                sender: { email: 'support@closeos.fr', name: 'CloseOS' },
                to: [{ email: to }],
                subject,
                htmlContent
            })
        });
        return res.ok;
    } catch (e) {
        console.error('Email error:', e);
        return false;
    }
}

// ─── Email wrapper ─────────────────────────────────────────────────────────────

function wrap(badge: string, badgeColor: string, borderColor: string, title: string, body: string, ctaText: string, ctaUrl: string) {
    return `<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
    <meta name="color-scheme" content="dark">
    <meta name="supported-color-schemes" content="dark">
    <title>${title}</title>
    <style>
        :root { color-scheme: dark; }
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
        body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
    </style>
</head>
<body style="margin: 0; padding: 0; -webkit-font-smoothing: antialiased; background-color: #020617;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #020617; background-image: linear-gradient(#020617, #020617);">
        <tr>
            <td align="center" style="padding-bottom: 60px;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
                    <tr>
                        <td align="center" style="padding: 40px 20px 20px 20px;">
                            <img src="https://closeos.fr/logo.PNG" alt="CloseOS" width="140" style="display: block;">
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding: 0 20px; font-family: 'Segoe UI', Arial, sans-serif;">
                            <span style="background-color: ${badgeColor}; background-image: linear-gradient(${badgeColor}, ${badgeColor}); border: 1px solid ${borderColor}; color: ${borderColor}; padding: 4px 12px; border-radius: 50px; font-size: 12px; font-weight: bold; text-transform: uppercase; display: inline-block;">${badge}</span>
                            <h1 style="color: #fdfdfd; background-image: linear-gradient(transparent, transparent); font-size: 28px; margin-top: 20px; margin-bottom: 16px;">${title}</h1>
                            ${body}
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 25px;">
                                <tr>
                                    <td align="center">
                                        <a href="${ctaUrl}" style="background-color: #3b82f6; background-image: linear-gradient(#3b82f6, #3b82f6); color: #fdfdfd; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: bold; display: block; font-family: 'Segoe UI', Arial, sans-serif; font-size: 18px;">${ctaText}</a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding: 40px 20px 0 20px; font-family: 'Segoe UI', Arial, sans-serif;">
                            <p style="color: #475569; background-image: linear-gradient(transparent, transparent); font-size: 12px; margin-bottom: 4px;">&copy; 2026 CloseOS.fr &mdash; Le Syst&egrave;me d'Exploitation des Closers</p>
                            <p style="color: #475569; background-image: linear-gradient(transparent, transparent); font-size: 12px;">
                                <a href="https://closeos.fr/cgu" style="color: #475569; text-decoration: none;">CGU</a> &middot;
                                <a href="https://closeos.fr/cgv" style="color: #475569; text-decoration: none;">CGV</a> &middot;
                                <a href="https://closeos.fr/confidentialite" style="color: #475569; text-decoration: none;">Confidentialit&eacute;</a>
                            </p>
                            <p style="color: #475569; background-image: linear-gradient(transparent, transparent); font-size: 11px; margin-top: 30px;">
                                Vous recevez cet email car vous &ecirc;tes inscrit sur CloseOS.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

// ─── Email templates ────────────────────────────────────────────────────────────

function trialEndEmail(name: string) {
    return wrap(
        'Essai termin\u00e9', '#1e1b4b', '#818cf8',
        'Votre essai gratuit est termin\u00e9 \u23F3',
        `<p style="color: #94a3b9; background-image: linear-gradient(transparent, transparent); font-size: 16px; line-height: 1.6; text-align: left; margin-bottom: 20px;">
            Bonjour ${name},<br><br>
            Vos 10 jours d'essai gratuit sur CloseOS sont arriv\u00e9s \u00e0 leur fin. On esp\u00e8re que vous avez pu d\u00e9couvrir tout ce que l'outil peut faire pour vous.
        </p>
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0f172a; background-image: linear-gradient(#0f172a, #0f172a); border: 1px solid #1d4ed8; border-radius: 20px; margin-bottom: 20px;">
            <tr>
                <td style="padding: 25px; text-align: left; font-family: 'Segoe UI', Arial, sans-serif;">
                    <p style="color: #cbd5e2; background-image: linear-gradient(transparent, transparent); font-size: 15px; line-height: 1.6; margin: 0 0 8px 0;">
                        \u2022 <strong style="color: #fdfdfd; background-image: linear-gradient(transparent, transparent);">Fini les tableurs Excel</strong> pour suivre vos prospects.
                    </p>
                    <p style="color: #cbd5e2; background-image: linear-gradient(transparent, transparent); font-size: 15px; line-height: 1.6; margin: 0 0 8px 0;">
                        \u2022 <strong style="color: #fdfdfd; background-image: linear-gradient(transparent, transparent);">Fini les t\u00e2ches chiantes</strong> que vous repoussez chaque jour.
                    </p>
                    <p style="color: #cbd5e2; background-image: linear-gradient(transparent, transparent); font-size: 15px; line-height: 1.6; margin: 0;">
                        \u2022 <strong style="color: #fdfdfd; background-image: linear-gradient(transparent, transparent);">Tout est centralis\u00e9</strong> : CRM, Pipeline, Agenda, Factures, KPI.
                    </p>
                </td>
            </tr>
        </table>
        <p style="color: #94a3b9; background-image: linear-gradient(transparent, transparent); font-size: 15px; line-height: 1.6; text-align: left; margin-bottom: 10px;">
            Continuez l'aventure avec nous et retrouvez ce temps pr\u00e9cieux que vous perdiez dans les t\u00e2ches administratives. <strong style="color: #fdfdfd; background-image: linear-gradient(transparent, transparent);">\u00c0 partir de 18\u20ac/mois en annuel (216\u20ac/an).</strong>
        </p>`,
        '\u{1F680} Passer \u00e0 l\'action',
        'https://closeos.fr/login'
    );
}

function reviewEmail(name: string) {
    return wrap(
        'Votre avis', '#1c1917', '#f59e0b',
        'Comment se passe votre exp\u00e9rience ? \u2B50',
        `<p style="color: #94a3b9; background-image: linear-gradient(transparent, transparent); font-size: 16px; line-height: 1.6; text-align: left; margin-bottom: 20px;">
            Bonjour ${name},<br><br>
            Cela fait maintenant quelques jours que vous utilisez CloseOS, et votre retour est <strong style="color: #fdfdfd; background-image: linear-gradient(transparent, transparent);">extr\u00eamement pr\u00e9cieux</strong> pour nous.
        </p>
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0f172a; background-image: linear-gradient(#0f172a, #0f172a); border: 1px solid #f59e0b; border-radius: 20px; margin-bottom: 20px;">
            <tr>
                <td style="padding: 25px; text-align: left; font-family: 'Segoe UI', Arial, sans-serif;">
                    <h3 style="color: #fbbf24; background-image: linear-gradient(transparent, transparent); font-size: 20px; margin-top: 0; margin-bottom: 12px;">\u{1F4DD} 2 minutes pour nous aider</h3>
                    <p style="color: #cbd5e2; background-image: linear-gradient(transparent, transparent); font-size: 15px; line-height: 1.6; margin: 0;">
                        Dites-nous ce qui vous pla\u00eet, ce qui manque, ce qui pourrait \u00eatre am\u00e9lior\u00e9. Chaque r\u00e9ponse est lue personnellement par l'\u00e9quipe et influence directement les prochaines mises \u00e0 jour.
                    </p>
                </td>
            </tr>
        </table>
        <p style="color: #94a3b9; background-image: linear-gradient(transparent, transparent); font-size: 15px; line-height: 1.6; text-align: left; margin-bottom: 10px;">
            Merci d'avance pour votre temps. C'est gr\u00e2ce \u00e0 vous qu'on construit le meilleur outil pour les closers.
        </p>`,
        '\u{1F4AC} Donner mon avis',
        'https://docs.google.com/forms/d/e/1FAIpQLSfG_km1jRFBreeHvhksMAvAxwokZEOdahTicsKikNwk71IUwg/viewform?usp=dialog'
    );
}

type ParrainCycle = 'monthly' | 'quarterly' | 'yearly';

function referrerRewardLinesV3(cycle: ParrainCycle): string {
    const item = (icon: string, label: string, reward: string) => `
        <tr>
            <td style="vertical-align:top; padding-right:10px; padding-bottom:12px;"><span style="font-size:18px;">${icon}</span></td>
            <td style="padding-bottom:12px;">
                <p style="margin:0; font-size:14px; color:#a8a29e; line-height:1.6;">
                    <strong style="color:#d6d3d1;">${label}</strong> ${reward}
                </p>
            </td>
        </tr>`;
    if (cycle === 'monthly') {
        return item('\ud83d\udcc6', 'Filleul mensuel :', `votre abonnement passe \u00e0 <strong style="color:#fafaf9;">20\u20ac/mois pendant 2 mois</strong>.`)
            + item('\ud83d\uddd3\ufe0f', 'Filleul trimestriel :', `votre abonnement passe \u00e0 <strong style="color:#fafaf9;">15\u20ac/mois pendant 2 mois</strong>.`)
            + item('\ud83d\udcc5', 'Filleul annuel :', `votre abonnement passe \u00e0 <strong style="color:#fafaf9;">10\u20ac/mois pendant 2 mois</strong>.`);
    }
    if (cycle === 'quarterly') {
        return item('\ud83d\udcc6', 'Filleul mensuel :', `prochain trimestre \u00e0 <strong style="color:#fafaf9;">53\u20ac au lieu de 60\u20ac</strong>.`)
            + item('\ud83d\uddd3\ufe0f', 'Filleul trimestriel :', `prochain trimestre \u00e0 <strong style="color:#fafaf9;">45\u20ac au lieu de 60\u20ac</strong>.`)
            + item('\ud83d\udcc5', 'Filleul annuel :', `prochain trimestre \u00e0 <strong style="color:#fafaf9;">34\u20ac au lieu de 60\u20ac</strong>.`);
    }
    return item('\ud83d\udcc6', 'Filleul mensuel :', `prochaine ann\u00e9e \u00e0 <strong style="color:#fafaf9;">200\u20ac au lieu de 216\u20ac</strong>.`)
        + item('\ud83d\uddd3\ufe0f', 'Filleul trimestriel :', `<strong style="color:#fafaf9;">virement de 20\u20ac</strong>.`)
        + item('\ud83d\udcc5', 'Filleul annuel :', `<strong style="color:#fafaf9;">virement de 40\u20ac</strong>.`);
}

function referralEmail(name: string, code: string, cycle: ParrainCycle) {
    const cycleLabel = cycle === 'monthly' ? 'mensuel' : cycle === 'quarterly' ? 'trimestriel' : 'annuel';
    return `<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>Programme de parrainage CloseOS</title>
  <style>
    :root { color-scheme: dark; supported-color-schemes: dark; }
    body, table, td, p, a, li { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; -webkit-font-smoothing: antialiased; }
    img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; height: auto; line-height: 100%; }
    table { border-collapse: collapse !important; }
    @media only screen and (max-width: 620px) {
      .container { width: 100% !important; padding: 0 12px !important; }
      .mobile-padding { padding: 24px 18px !important; }
      .mobile-h1 { font-size: 26px !important; line-height: 1.1 !important; }
      .feature-card { padding: 22px !important; }
      .mobile-cta { padding: 15px 28px !important; font-size: 16px !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#111111; font-family:'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif;">
  <div style="display:none; font-size:1px; color:#111111; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">
    Le programme de parrainage CloseOS est activ\u00e9. Votre code, vos avantages.
    &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#111111;">
    <tr><td align="center" style="padding-bottom:60px;">
      <table class="container" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;">

        <!-- LOGO -->
        <tr><td align="center" style="padding: 40px 20px 28px;">
          <a href="https://closeos.fr" target="_blank" style="text-decoration:none;">
            <img src="https://closeos.fr/logo.PNG" alt="CloseOS" width="140" style="display:block; height:auto;" />
          </a>
        </td></tr>

        <!-- HERO CARD -->
        <tr><td style="padding: 0 20px 32px;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #1a1a1a; border-radius: 20px;">
            <tr><td class="mobile-padding" style="padding: 44px 36px 40px; text-align:center;">
              <table border="0" cellpadding="0" cellspacing="0" align="center" style="margin-bottom:22px;">
                <tr><td style="background-color: rgba(52,211,153,0.1); border: 1px solid rgba(52,211,153,0.25); border-radius: 100px; padding: 5px 14px; font-size: 11px; font-weight: 700; color: #34d399; letter-spacing: 0.08em; text-transform: uppercase;">
                  \ud83e\udd1d PROGRAMME DE PARRAINAGE
                </td></tr>
              </table>
              <h1 class="mobile-h1" style="margin:0 0 14px; font-size:30px; font-weight:800; color:#fafaf9; line-height:1.1; letter-spacing:-0.03em;">
                Parrainez. Gagnez.
              </h1>
              <p style="margin:0; font-size:16px; color:#a8a29e; line-height:1.6;">
                Votre code, vos avantages.
              </p>
            </td></tr>
          </table>
        </td></tr>

        <!-- INTRO -->
        <tr><td style="padding: 0 20px 28px;">
          <p style="margin:0 0 14px; font-size:15px; color:#d6d3d1; line-height:1.75;">Salut ${name} !</p>
          <p style="margin:0; font-size:15px; color:#d6d3d1; line-height:1.75;">
            Le programme de parrainage CloseOS est activ\u00e9. Pour chaque confr\u00e8re que vous invitez, <strong style="color:#fafaf9;">tout le monde y gagne</strong>.
          </p>
        </td></tr>

        <!-- LABEL : POUR VOUS -->
        <tr><td style="padding: 0 20px 8px;">
          <p style="margin:0; font-size:10px; font-weight:800; color:#60a5fa; letter-spacing:0.12em; text-transform:uppercase;">POUR VOUS \u00b7 PARRAIN ${cycleLabel.toUpperCase()}</p>
        </td></tr>

        <!-- CARD : POUR LE PARRAIN -->
        <tr><td style="padding: 0 20px 16px;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #1a1a1a; border-radius: 20px;">
            <tr><td class="feature-card" style="padding: 28px;">
              <h3 style="color: #60a5fa; font-size: 20px; margin: 0 0 14px; font-weight: 700;">
                \ud83c\udf81 Vos r\u00e9compenses
              </h3>
              <p style="color: #a8a29e; font-size: 13px; line-height: 1.5; margin: 0 0 18px;">
                Activ\u00e9e <strong style="color:#d6d3d1;">14 jours apr\u00e8s le paiement de votre filleul</strong>. Une seule r\u00e9compense active \u00e0 la fois \u2014 les filleuls suivants attendent en file.
              </p>
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                ${referrerRewardLinesV3(cycle)}
              </table>
            </td></tr>
          </table>
        </td></tr>

        <!-- LABEL : POUR LE FILLEUL -->
        <tr><td style="padding: 12px 20px 8px;">
          <p style="margin:0; font-size:10px; font-weight:800; color:#34d399; letter-spacing:0.12em; text-transform:uppercase;">POUR VOTRE FILLEUL</p>
        </td></tr>

        <!-- CARD : POUR LE FILLEUL -->
        <tr><td style="padding: 0 20px 16px;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #1a1a1a; border-radius: 20px;">
            <tr><td class="feature-card" style="padding: 28px;">
              <h3 style="color: #34d399; font-size: 20px; margin: 0 0 16px; font-weight: 700;">
                \ud83e\udd1d R\u00e9ductions imm\u00e9diates
              </h3>
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="vertical-align:top; padding-right:10px; padding-bottom:12px;"><span style="font-size:18px;">\ud83d\udcc6</span></td>
                  <td style="padding-bottom:12px;">
                    <p style="margin:0; font-size:14px; color:#a8a29e; line-height:1.6;">
                      <strong style="color:#d6d3d1;">Mensuel :</strong> <strong style="color:#fafaf9;">19\u20ac/mois pendant 2 mois</strong> (au lieu de 24\u20ac).
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="vertical-align:top; padding-right:10px; padding-bottom:12px;"><span style="font-size:18px;">\ud83d\uddd3\ufe0f</span></td>
                  <td style="padding-bottom:12px;">
                    <p style="margin:0; font-size:14px; color:#a8a29e; line-height:1.6;">
                      <strong style="color:#d6d3d1;">Trimestriel :</strong> <strong style="color:#fafaf9;">50\u20ac le 1er trimestre</strong> (au lieu de 60\u20ac).
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="vertical-align:top; padding-right:10px;"><span style="font-size:18px;">\ud83d\udcc5</span></td>
                  <td>
                    <p style="margin:0; font-size:14px; color:#a8a29e; line-height:1.6;">
                      <strong style="color:#d6d3d1;">Annuel :</strong> <strong style="color:#fafaf9;">190\u20ac la 1\u00e8re ann\u00e9e</strong> (au lieu de 216\u20ac).
                    </p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </td></tr>

        <!-- LABEL : VOTRE CODE -->
        <tr><td style="padding: 12px 20px 8px;">
          <p style="margin:0; font-size:10px; font-weight:800; color:#fbbf24; letter-spacing:0.12em; text-transform:uppercase;">VOTRE CODE</p>
        </td></tr>

        <!-- CARD : CODE -->
        <tr><td style="padding: 0 20px 28px;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #1a1a1a; border-radius: 20px;">
            <tr><td class="feature-card" style="padding: 32px 28px; text-align:center;">
              <p style="margin:0 0 12px; font-size:11px; font-weight:800; color:#a8a29e; letter-spacing:0.12em; text-transform:uppercase;">Code de parrainage</p>
              <p style="margin:0 0 18px; font-size:38px; font-weight:800; color:#fafaf9; letter-spacing:6px; font-family:'SF Mono', Menlo, Consolas, monospace;">${code}</p>
              <a href="https://closeos.fr?ref=${code}" target="_blank" style="display:inline-block; background-color:#251f14; color:#fbbf24; text-decoration:none; padding:10px 24px; border-radius:100px; font-weight:700; font-size:13px;">closeos.fr?ref=${code}</a>
            </td></tr>
          </table>
        </td></tr>

        <!-- SEPARATOR -->
        <tr><td style="padding: 12px 20px 28px;">
          <div style="height:1px; background-color: rgba(255,255,255,0.06);"></div>
        </td></tr>

        <!-- CLOSING -->
        <tr><td style="padding: 0 20px 32px;">
          <p style="margin:0; font-size:15px; color:#d6d3d1; line-height:1.75;">
            Partagez votre code dans les conversations qui s'y pr\u00eatent. Le parrainage est <strong style="color:#fafaf9;">la fa\u00e7on la plus naturelle de faire grandir une communaut\u00e9 de closers s\u00e9rieux</strong>.
          </p>
        </td></tr>

        <!-- CTA PRINCIPAL -->
        <tr><td align="center" style="padding: 0 20px 20px;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr><td align="center">
              <a href="https://closeos.fr/dashboard" target="_blank" class="mobile-cta" style="background-color: #ffffff; color: #111111; text-decoration: none; padding: 17px 40px; border-radius: 100px; font-weight: 800; display: inline-block; font-size: 17px; letter-spacing: -0.01em;">
                Ouvrir mon espace parrainage \u2192
              </a>
            </td></tr>
          </table>
        </td></tr>

        <!-- CTA WHATSAPP -->
        <tr><td align="center" style="padding: 8px 20px 40px;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #1a1a1a; border-radius: 16px;">
            <tr><td align="center" style="padding: 24px 20px;">
              <p style="margin:0 0 14px; font-size:14px; color:#a8a29e; line-height:1.5;">
                \ud83d\udcf2 Mises \u00e0 jour en avant-premi\u00e8re :
              </p>
              <a href="https://whatsapp.com/channel/0029Vb7P4lqDDmFLVtD7Jn0s" target="_blank" style="background-color: #25D366; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 100px; font-weight: 700; display: inline-block; font-size: 14px;">
                Rejoindre le canal WhatsApp
              </a>
            </td></tr>
          </table>
        </td></tr>

        <!-- DIVIDER -->
        <tr><td style="padding: 0 20px;">
          <div style="height:1px; background-color: rgba(255,255,255,0.06);"></div>
        </td></tr>

        <!-- SIGNATURE -->
        <tr><td style="padding: 32px 20px 16px;">
          <table border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:top; padding-right:14px;">
                <img src="https://qwjvdwpixewsctircibl.supabase.co/storage/v1/object/public/avatars/business-7d48e479-cede-480e-b405-39611a48d333-0.3286628360007747.jpg" alt="Thomas" width="46" height="46" style="border-radius:12px; display:block; object-fit:cover;" />
              </td>
              <td style="vertical-align:top;">
                <p style="margin:0; font-size:15px; font-weight:800; color:#fafaf9;">Thomas</p>
                <p style="margin:2px 0 0; font-size:13px; color:#34d399; font-weight:600;">Fondateur de CloseOS</p>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- FOOTER -->
        <tr><td align="center" style="padding: 20px 20px 48px;">
          <table border="0" cellpadding="0" cellspacing="0" align="center">
            <tr>
              <td style="padding: 0 8px;"><a href="https://closeos.fr" target="_blank" style="font-size:11px; color:#57534e; text-decoration:none;">closeos.fr</a></td>
              <td style="color:#44403c; font-size:11px;">\u00b7</td>
              <td style="padding: 0 8px;"><a href="https://www.linkedin.com/in/thomas-shamoev-570885237/" target="_blank" style="font-size:11px; color:#57534e; text-decoration:none;">LinkedIn</a></td>
              <td style="color:#44403c; font-size:11px;">\u00b7</td>
              <td style="padding: 0 8px;"><a href="mailto:support@closeos.fr" style="font-size:11px; color:#57534e; text-decoration:none;">support@closeos.fr</a></td>
            </tr>
          </table>
          <p style="margin:14px 0 0; font-size:10px; color:#44403c;">\u00a9 2026 CloseOS.fr</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Main handler ───────────────────────────────────────────────────────────────

export default async function handler(req: Request) {
    const authHeader = req.headers.get('authorization');
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return new Response('Unauthorized', { status: 401 });
    }

    const now = new Date();
    const results: string[] = [];

    try {
        // ─── 1. Fin d'essai (jour J de fin d'essai) ───
        // Priorité : profiles.trial_ends_at (override) → fallback created_at + 10 jours.
        const trialEndStart = new Date(now);
        trialEndStart.setDate(trialEndStart.getDate() - 10);
        trialEndStart.setUTCHours(0, 0, 0, 0);
        const trialEndEnd = new Date(trialEndStart);
        trialEndEnd.setUTCHours(23, 59, 59, 999);

        // Today's window for trial_ends_at-based detection
        const todayStart = new Date(now);
        todayStart.setUTCHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setUTCHours(23, 59, 59, 999);

        // 1a. Users whose explicit trial_ends_at falls in today's window
        const { data: explicitTrialUsers } = await supabaseAdmin
            .from('profiles')
            .select('email, full_name')
            .gte('trial_ends_at', todayStart.toISOString())
            .lte('trial_ends_at', todayEnd.toISOString())
            .or('subscription_status.is.null,subscription_status.eq.expired')
            .not('email', 'is', null);

        // 1b. Legacy users (no trial_ends_at) whose created_at + 10d lands today
        const { data: fallbackTrialUsers } = await supabaseAdmin
            .from('profiles')
            .select('email, full_name')
            .is('trial_ends_at', null)
            .gte('created_at', trialEndStart.toISOString())
            .lte('created_at', trialEndEnd.toISOString())
            .or('subscription_status.is.null,subscription_status.eq.expired')
            .not('email', 'is', null);

        const seenEmails = new Set<string>();
        const trialEndUsers = [...(explicitTrialUsers || []), ...(fallbackTrialUsers || [])]
            .filter(u => {
                if (!u.email || seenEmails.has(u.email)) return false;
                seenEmails.add(u.email);
                return true;
            });

        for (const u of trialEndUsers) {
            const sent = await sendEmail(u.email, 'Votre essai gratuit est terminé ⏳', trialEndEmail(u.full_name || 'Closer'));
            results.push(`trial_end → ${u.email}: ${sent ? 'OK' : 'FAIL'}`);
        }

        // ─── 2. Demande d'avis (12 jours après inscription) ───
        const reviewStart = new Date(now);
        reviewStart.setDate(reviewStart.getDate() - 12);
        reviewStart.setUTCHours(0, 0, 0, 0);
        const reviewEnd = new Date(reviewStart);
        reviewEnd.setUTCHours(23, 59, 59, 999);

        const { data: reviewUsers } = await supabaseAdmin
            .from('profiles')
            .select('email, full_name')
            .gte('created_at', reviewStart.toISOString())
            .lte('created_at', reviewEnd.toISOString())
            .not('email', 'is', null);

        for (const u of reviewUsers || []) {
            const sent = await sendEmail(u.email, 'Comment se passe votre expérience ? ⭐', reviewEmail(u.full_name || 'Closer'));
            results.push(`review → ${u.email}: ${sent ? 'OK' : 'FAIL'}`);
        }

        // ─── 3. Parrainage (2 jours après abonnement) ───
        const refStart = new Date(now);
        refStart.setDate(refStart.getDate() - 2);
        refStart.setUTCHours(0, 0, 0, 0);
        const refEnd = new Date(refStart);
        refEnd.setUTCHours(23, 59, 59, 999);

        const { data: refUsers } = await supabaseAdmin
            .from('profiles')
            .select('email, full_name, own_referral_code, billing_cycle')
            .gte('subscribed_at', refStart.toISOString())
            .lte('subscribed_at', refEnd.toISOString())
            .not('email', 'is', null)
            .not('own_referral_code', 'is', null);

        for (const u of refUsers || []) {
            const cycle: ParrainCycle =
                u.billing_cycle === 'yearly' ? 'yearly' :
                u.billing_cycle === 'quarterly' ? 'quarterly' :
                'monthly';
            const sent = await sendEmail(
                u.email,
                'Gagnez en parrainant vos confrères 🤝',
                referralEmail(u.full_name || 'Closer', u.own_referral_code, cycle)
            );
            results.push(`referral → ${u.email}: ${sent ? 'OK' : 'FAIL'}`);
        }

    } catch (e: any) {
        console.error('Lifecycle emails error:', e);
        results.push(`ERROR: ${e.message}`);
    }

    console.log('Lifecycle emails results:', results);
    return new Response(JSON.stringify({ results }), {
        headers: { 'Content-Type': 'application/json' }
    });
}
