// CloseOS Sign — email d'invitation à signer envoyé par le serveur (API REST), via Brevo.
// Même gabarit que l'envoi depuis l'application (src/lib/signContracts.ts, sendSignatureEmail),
// avec échappement : titre et noms viennent d'un système tiers.

export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export function inviteHtml({ name, title, link, senderName }) {
  const t = escapeHtml(title)
  const from = senderName ? `<strong style="color:#F3F4F6;">${escapeHtml(senderName)}</strong> vous invite à signer le document` : 'Vous êtes invité(e) à signer le document'
  const href = escapeHtml(link)
  return `
  <div style="background:#191E1E;padding:32px 0;font-family:Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#222828;border:1px solid #3A4242;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:28px 32px 8px;">
          <img src="https://sign.closeos.fr/CLOSEOS-SIGN-LOGO.png" alt="CloseOS Sign" height="30" style="height:30px;width:auto;display:block;" />
        </td></tr>
        <tr><td style="padding:8px 32px 0;">
          <h1 style="color:#ffffff;font-size:22px;margin:12px 0 8px;">Vous avez un document à signer</h1>
          <p style="color:#A1A9A9;font-size:14px;line-height:1.6;margin:0 0 4px;">
            Bonjour ${escapeHtml(name || '')},<br/>
            ${from} : <strong style="color:#F3F4F6;">${t}</strong>.
          </p>
        </td></tr>
        <tr><td style="padding:24px 32px;">
          <a href="${href}" style="display:inline-block;background:#CEFF8F;color:#191E1E;font-weight:700;font-size:15px;text-decoration:none;padding:14px 28px;border-radius:8px;">
            Consulter &amp; signer
          </a>
        </td></tr>
        <tr><td style="padding:0 32px 28px;">
          <p style="color:#6b7280;font-size:11px;line-height:1.6;margin:0;">
            Ou copiez ce lien : <a href="${href}" style="color:#CEFF8F;">${href}</a><br/>
            Signature sécurisée — conformité RGPD.
          </p>
        </td></tr>
      </table>
    </td></tr></table>
  </div>`
}

/** Envoie l'invitation ; lève une erreur si Brevo refuse (l'API la renvoie au client). */
export async function sendInvite({ to, name, title, link, senderName }) {
  const key = (process.env.BREVO_API_KEY || '').trim()
  if (!key) throw new Error('BREVO_API_KEY manquant : email non envoyé.')
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { accept: 'application/json', 'api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({
      sender: { email: 'support@closeos.fr', name: senderName ? `${String(senderName).slice(0, 60)} via CloseOS Sign` : 'CloseOS Sign' },
      to: [{ email: to, ...(name ? { name: String(name).slice(0, 100) } : {}) }],
      subject: `À signer : ${String(title).slice(0, 150)}`,
      htmlContent: inviteHtml({ name, title, link, senderName }),
    }),
  })
  if (!r.ok) throw new Error(`Email non envoyé (${r.status}) ${(await r.text().catch(() => '')).slice(0, 200)}`)
}
