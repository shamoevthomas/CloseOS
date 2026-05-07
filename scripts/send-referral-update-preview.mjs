// Preview email "Les règles de parrainage ont changé" — pour abonnés existants
// Adapté à leur cycle d'abonnement.
// Usage: BREVO_API_KEY=xxx node scripts/send-referral-update-preview.mjs

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const RECIPIENT = process.env.RECIPIENT || 'tekatubois@gmail.com';
if (!BREVO_API_KEY) { console.error('❌ BREVO_API_KEY manquant'); process.exit(1); }

function rewardItem(icon, label, reward) {
    return `
        <tr>
            <td style="vertical-align:top; padding-right:10px; padding-bottom:12px;"><span style="font-size:18px;">${icon}</span></td>
            <td style="padding-bottom:12px;">
                <p style="margin:0; font-size:14px; color:#a8a29e; line-height:1.6;">
                    <strong style="color:#d6d3d1;">${label}</strong> ${reward}
                </p>
            </td>
        </tr>`;
}

function referrerRewardLines(cycle) {
    if (cycle === 'monthly') {
        return rewardItem('📆', 'Filleul mensuel :', `votre abonnement passe à <strong style="color:#fafaf9;">20€/mois pendant 2 mois</strong>.`)
            + rewardItem('🗓️', 'Filleul trimestriel :', `votre abonnement passe à <strong style="color:#fafaf9;">15€/mois pendant 2 mois</strong>.`)
            + rewardItem('📅', 'Filleul annuel :', `votre abonnement passe à <strong style="color:#fafaf9;">10€/mois pendant 2 mois</strong>.`);
    }
    if (cycle === 'quarterly') {
        return rewardItem('📆', 'Filleul mensuel :', `prochain trimestre à <strong style="color:#fafaf9;">53€ au lieu de 60€</strong>.`)
            + rewardItem('🗓️', 'Filleul trimestriel :', `prochain trimestre à <strong style="color:#fafaf9;">45€ au lieu de 60€</strong>.`)
            + rewardItem('📅', 'Filleul annuel :', `prochain trimestre à <strong style="color:#fafaf9;">34€ au lieu de 60€</strong>.`);
    }
    return rewardItem('📆', 'Filleul mensuel :', `prochaine année à <strong style="color:#fafaf9;">200€ au lieu de 216€</strong>.`)
        + rewardItem('🗓️', 'Filleul trimestriel :', `<strong style="color:#fafaf9;">virement de 20€</strong>.`)
        + rewardItem('📅', 'Filleul annuel :', `<strong style="color:#fafaf9;">virement de 40€</strong>.`);
}

function referralUpdateEmail(name, code, cycle) {
    const cycleLabel = cycle === 'monthly' ? 'mensuel' : cycle === 'quarterly' ? 'trimestriel' : 'annuel';
    const cycleColor = cycle === 'monthly' ? '#60a5fa' : cycle === 'quarterly' ? '#fbbf24' : '#a78bfa';
    const cycleColorBg = cycle === 'monthly' ? 'rgba(96,165,250,0.1)' : cycle === 'quarterly' ? 'rgba(251,191,36,0.1)' : 'rgba(167,139,250,0.1)';
    const cycleColorBorder = cycle === 'monthly' ? 'rgba(96,165,250,0.25)' : cycle === 'quarterly' ? 'rgba(251,191,36,0.25)' : 'rgba(167,139,250,0.25)';

    return `<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>Les règles de parrainage ont changé</title>
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
    Le programme de parrainage évolue. Voici ce qui s'applique à votre abonnement ${cycleLabel}.
  </div>
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#111111;">
    <tr><td align="center" style="padding-bottom:60px;">
      <table class="container" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;">

        <tr><td align="center" style="padding: 40px 20px 28px;">
          <a href="https://closeos.fr" target="_blank" style="text-decoration:none;">
            <img src="https://closeos.fr/logo.PNG" alt="CloseOS" width="140" style="display:block; height:auto;" />
          </a>
        </td></tr>

        <tr><td style="padding: 0 20px 32px;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #1a1a1a; border-radius: 20px;">
            <tr><td class="mobile-padding" style="padding: 44px 36px 40px; text-align:center;">
              <table border="0" cellpadding="0" cellspacing="0" align="center" style="margin-bottom:22px;">
                <tr><td style="background-color: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.25); border-radius: 100px; padding: 5px 14px; font-size: 11px; font-weight: 700; color: #fbbf24; letter-spacing: 0.08em; text-transform: uppercase;">
                  🔄 MISE À JOUR · PARRAINAGE
                </td></tr>
              </table>
              <h1 class="mobile-h1" style="margin:0 0 14px; font-size:30px; font-weight:800; color:#fafaf9; line-height:1.1; letter-spacing:-0.03em;">Les règles de parrainage<br />ont changé.</h1>
              <p style="margin:0; font-size:16px; color:#a8a29e; line-height:1.6;">Plus généreuses. Plus claires. Adaptées à votre cycle.</p>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding: 0 20px 28px;">
          <p style="margin:0 0 14px; font-size:15px; color:#d6d3d1; line-height:1.75;">Salut ${name} !</p>
          <p style="margin:0 0 14px; font-size:15px; color:#d6d3d1; line-height:1.75;">
            On a refondu de fond en comble le programme de parrainage CloseOS. <strong style="color:#fafaf9;">Les anciennes règles sont remplacées</strong> — voici ce qui s'applique désormais à votre abonnement ${cycleLabel}.
          </p>
          <p style="margin:0; font-size:15px; color:#d6d3d1; line-height:1.75;">
            Bonne nouvelle : c'est <strong style="color:#fafaf9;">plus avantageux pour vous comme pour vos filleuls</strong>.
          </p>
        </td></tr>

        <tr><td style="padding: 0 20px 8px;">
          <p style="margin:0; font-size:10px; font-weight:800; color:${cycleColor}; letter-spacing:0.12em; text-transform:uppercase;">VOTRE FORMULE · ABONNEMENT ${cycleLabel.toUpperCase()}</p>
        </td></tr>

        <tr><td style="padding: 0 20px 16px;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #1a1a1a; border-radius: 20px;">
            <tr><td class="feature-card" style="padding: 28px;">
              <h3 style="color: ${cycleColor}; font-size: 20px; margin: 0 0 14px; font-weight: 700;">🎁 Vos nouvelles récompenses</h3>
              <p style="color: #a8a29e; font-size: 13px; line-height: 1.5; margin: 0 0 18px;">
                Activée <strong style="color:#d6d3d1;">14 jours après le paiement de votre filleul</strong>. Une seule récompense active à la fois — les filleuls suivants attendent en file. Pas de cumul, mais aucune limite dans le temps.
              </p>
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                ${referrerRewardLines(cycle)}
              </table>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding: 12px 20px 8px;">
          <p style="margin:0; font-size:10px; font-weight:800; color:#34d399; letter-spacing:0.12em; text-transform:uppercase;">POUR VOTRE FILLEUL · IMMÉDIAT</p>
        </td></tr>

        <tr><td style="padding: 0 20px 16px;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #1a1a1a; border-radius: 20px;">
            <tr><td class="feature-card" style="padding: 28px;">
              <h3 style="color: #34d399; font-size: 20px; margin: 0 0 16px; font-weight: 700;">🤝 Sa réduction de bienvenue</h3>
              <p style="color: #a8a29e; font-size: 13px; line-height: 1.5; margin: 0 0 18px;">
                Quand votre filleul saisit votre code au paiement, il reçoit immédiatement :
              </p>
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                ${rewardItem('📆', 'Mensuel :', `<strong style="color:#fafaf9;">19€/mois pendant 2 mois</strong> (au lieu de 24€).`)}
                ${rewardItem('🗓️', 'Trimestriel :', `<strong style="color:#fafaf9;">50€ le 1er trimestre</strong> (au lieu de 60€).`)}
                ${rewardItem('📅', 'Annuel :', `<strong style="color:#fafaf9;">190€ la 1ère année</strong> (au lieu de 216€).`)}
              </table>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding: 12px 20px 8px;">
          <p style="margin:0; font-size:10px; font-weight:800; color:#fbbf24; letter-spacing:0.12em; text-transform:uppercase;">VOTRE CODE INCHANGÉ</p>
        </td></tr>

        <tr><td style="padding: 0 20px 28px;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #1a1a1a; border-radius: 20px;">
            <tr><td class="feature-card" style="padding: 32px 28px; text-align:center;">
              <p style="margin:0 0 12px; font-size:11px; font-weight:800; color:#a8a29e; letter-spacing:0.12em; text-transform:uppercase;">Code de parrainage</p>
              <p style="margin:0 0 18px; font-size:38px; font-weight:800; color:#fafaf9; letter-spacing:6px; font-family:'SF Mono', Menlo, Consolas, monospace;">${code}</p>
              <a href="https://closeos.fr?ref=${code}" target="_blank" style="display:inline-block; background-color:#251f14; color:#fbbf24; text-decoration:none; padding:10px 24px; border-radius:100px; font-weight:700; font-size:13px;">closeos.fr?ref=${code}</a>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding: 12px 20px 28px;">
          <div style="height:1px; background-color: rgba(255,255,255,0.06);"></div>
        </td></tr>

        <tr><td style="padding: 0 20px 32px;">
          <p style="margin:0 0 14px; font-size:15px; color:#d6d3d1; line-height:1.75;">
            <strong style="color:#fafaf9;">Ce qui ne change pas :</strong> votre code, votre lien <code style="background-color:#1a1a1a; padding:2px 8px; border-radius:6px; color:#fbbf24; font-size:13px;">closeos.fr?ref=${code}</code>, et le fait que vos parrainages déjà actifs continuent normalement.
          </p>
          <p style="margin:0; font-size:15px; color:#d6d3d1; line-height:1.75;">
            Une question ? Répondez à cet email, je lis tout.
          </p>
        </td></tr>

        <tr><td align="center" style="padding: 0 20px 20px;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr><td align="center">
              <a href="https://closeos.fr/dashboard" target="_blank" class="mobile-cta" style="background-color: #ffffff; color: #111111; text-decoration: none; padding: 17px 40px; border-radius: 100px; font-weight: 800; display: inline-block; font-size: 17px; letter-spacing: -0.01em;">
                Voir mon espace parrainage →
              </a>
            </td></tr>
          </table>
        </td></tr>

        <tr><td align="center" style="padding: 8px 20px 40px;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #1a1a1a; border-radius: 16px;">
            <tr><td align="center" style="padding: 24px 20px;">
              <p style="margin:0 0 14px; font-size:14px; color:#a8a29e; line-height:1.5;">📲 Mises à jour en avant-première :</p>
              <a href="https://whatsapp.com/channel/0029Vb7P4lqDDmFLVtD7Jn0s" target="_blank" style="background-color: #25D366; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 100px; font-weight: 700; display: inline-block; font-size: 14px;">
                Rejoindre le canal WhatsApp
              </a>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding: 0 20px;">
          <div style="height:1px; background-color: rgba(255,255,255,0.06);"></div>
        </td></tr>

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

        <tr><td align="center" style="padding: 20px 20px 48px;">
          <table border="0" cellpadding="0" cellspacing="0" align="center">
            <tr>
              <td style="padding: 0 8px;"><a href="https://closeos.fr" target="_blank" style="font-size:11px; color:#57534e; text-decoration:none;">closeos.fr</a></td>
              <td style="color:#44403c; font-size:11px;">·</td>
              <td style="padding: 0 8px;"><a href="https://www.linkedin.com/in/thomas-shamoev-570885237/" target="_blank" style="font-size:11px; color:#57534e; text-decoration:none;">LinkedIn</a></td>
              <td style="color:#44403c; font-size:11px;">·</td>
              <td style="padding: 0 8px;"><a href="mailto:support@closeos.fr" style="font-size:11px; color:#57534e; text-decoration:none;">support@closeos.fr</a></td>
            </tr>
          </table>
          <p style="margin:14px 0 0; font-size:10px; color:#44403c;">© 2026 CloseOS.fr</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendEmail(to, subject, htmlContent) {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'accept': 'application/json',
            'api-key': BREVO_API_KEY,
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            sender: { email: 'support@closeos.fr', name: 'Thomas de CloseOS' },
            to: [{ email: to }],
            subject,
            htmlContent,
        }),
    });
    const body = await res.text();
    return { ok: res.ok, status: res.status, body };
}

const NAME = 'Thomas';
const CODE = 'PREVIEW42';
const cycles = [
    { cycle: 'monthly', label: 'mensuel' },
    { cycle: 'quarterly', label: 'trimestriel' },
    { cycle: 'yearly', label: 'annuel' },
];

console.log(`📧 Envoi des 3 previews "Les règles ont changé" à ${RECIPIENT}...`);
for (const { cycle, label } of cycles) {
    const subject = `[Preview ${label}] Les règles de parrainage ont changé 🔄`;
    const html = referralUpdateEmail(NAME, CODE, cycle);
    const r = await sendEmail(RECIPIENT, subject, html);
    console.log(`  ${cycle}: ${r.ok ? '✅ OK' : '❌ FAIL ' + r.status} ${r.ok ? '' : r.body}`);
}
console.log('Terminé.');
