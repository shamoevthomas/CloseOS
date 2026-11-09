// Gabarit des emails envoyés depuis la page Emailing de CloseOS Business.
// Partagé par l'aperçu (navigateur) et l'envoi (api/business-emailing.ts) : ce que l'utilisateur voit est ce qui part.
//
// Deux modes :
//  - « text » : l'utilisateur écrit un texte simple, il est mis en page dans le gabarit CloseOS Business ;
//  - « html » : l'utilisateur colle son propre code HTML, envoyé tel quel (on ajoute seulement le lien de désinscription).
// Variables disponibles dans l'objet et le contenu : {{prenom}}, {{nom}}, {{email}}.

export type EmailMode = 'text' | 'html'

export interface EmailVars {
  prenom?: string
  nom?: string
  email?: string
}

// Limites d'envoi (Brevo de CloseOS) : 50 destinataires par envoi ET 50 emails par jour et par compte.
export const EMAILING_MAX_RECIPIENTS = 50
export const EMAILING_DAILY_LIMIT = 50

/** Minuit (heure de Paris) du jour en cours, en ISO UTC : début du quota quotidien. */
export function parisDayStartISO(now: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
  const p: Record<string, string> = Object.fromEntries(fmt.formatToParts(now).map((x) => [x.type, x.value]))
  const parisAsUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
  const offset = parisAsUtc - Math.floor(now.getTime() / 1000) * 1000
  return new Date(Date.UTC(+p.year, +p.month - 1, +p.day) - offset).toISOString()
}

export function escapeHtml(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

/** Remplace {{prenom}}, {{nom}}, {{email}} (insensible à la casse et aux espaces). Valeurs échappées si `html`. */
export function applyVars(input: string, vars: EmailVars, html: boolean): string {
  const map: Record<string, string> = {
    prenom: vars.prenom || '',
    'prénom': vars.prenom || '',
    firstname: vars.prenom || '',
    nom: vars.nom || '',
    lastname: vars.nom || '',
    email: vars.email || '',
  }
  return String(input || '').replace(/\{\{\s*([a-zA-Zéè]+)\s*\}\}/g, (m, k: string) => {
    const v = map[k.toLowerCase()]
    if (v === undefined) return m
    return html ? escapeHtml(v) : v
  })
}

/** Texte brut → HTML : paragraphes, retours à la ligne, liens cliquables, **gras**. */
export function textToHtml(text: string): string {
  const esc = escapeHtml(text.replace(/\r\n/g, '\n').trim())
  const linked = esc
    .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]])/g, '<a href="$1" style="color:#006c49;text-decoration:underline;">$1</a>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  return linked
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 18px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.65;color:#1b1c1b;">${p.replace(/\n/g, '<br>')}</p>`)
    .join('\n')
}

function footerHtml(senderName: string, unsubscribeUrl?: string): string {
  const unsub = unsubscribeUrl
    ? ` · <a href="${escapeHtml(unsubscribeUrl)}" style="color:#444748;text-decoration:underline;">Se désinscrire</a>`
    : ''
  return `<p style="margin:0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#1b1c1b;opacity:.55;text-align:center;">Envoyé par ${escapeHtml(senderName)} avec CloseOS Business${unsub}</p>`
}

/** Gabarit CloseOS Business (DA claire : fond #fbf9f8, carte blanche, Manrope / Inter). */
export function wrapInBusinessTemplate(opts: { bodyHtml: string; senderName: string; title?: string; unsubscribeUrl?: string }): string {
  const { bodyHtml, senderName, title, unsubscribeUrl } = opts
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title || senderName)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#fbf9f8;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;">
  <tr><td align="center" style="padding:48px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
      <tr><td style="padding:0 0 24px;text-align:center;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:22px;letter-spacing:-0.03em;color:#111111;">${escapeHtml(senderName)}</td></tr>
      <tr><td style="background-color:#ffffff;border-radius:32px;border:1px solid rgba(196,199,199,0.25);box-shadow:0 20px 40px rgba(27,28,27,0.04);padding:48px 40px;">
${bodyHtml}
      </td></tr>
      <tr><td style="padding:28px 8px 0;">${footerHtml(senderName, unsubscribeUrl)}</td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
}

/** Ajoute le lien de désinscription à un HTML fourni par l'utilisateur (avant </body>, sinon à la fin). */
function appendUnsubscribe(html: string, senderName: string, unsubscribeUrl?: string): string {
  if (!unsubscribeUrl) return html
  const block = `<div style="padding:24px 16px;text-align:center;">${footerHtml(senderName, unsubscribeUrl)}</div>`
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${block}</body>`) : html + block
}

/** Construit l'email final d'un destinataire. */
export function renderEmail(opts: {
  mode: EmailMode
  subject: string
  content: string
  senderName: string
  vars: EmailVars
  unsubscribeUrl?: string
}): { subject: string; html: string } {
  const subject = applyVars(opts.subject, opts.vars, false).trim()
  if (opts.mode === 'html') {
    return { subject, html: appendUnsubscribe(applyVars(opts.content, opts.vars, true), opts.senderName, opts.unsubscribeUrl) }
  }
  const bodyHtml = textToHtml(applyVars(opts.content, opts.vars, false))
  return { subject, html: wrapInBusinessTemplate({ bodyHtml, senderName: opts.senderName, title: subject, unsubscribeUrl: opts.unsubscribeUrl }) }
}

/** Prénom / nom d'un prospect Business (champs firstName/lastName, sinon « contact » découpé). */
export function prospectNames(p: { firstName?: string | null; lastName?: string | null; contact?: string | null }): { prenom: string; nom: string } {
  const first = (p.firstName || '').trim()
  const last = (p.lastName || '').trim()
  if (first || last) return { prenom: first, nom: last }
  const parts = String(p.contact || '').trim().split(/\s+/).filter(Boolean)
  return { prenom: parts[0] || '', nom: parts.slice(1).join(' ') }
}
