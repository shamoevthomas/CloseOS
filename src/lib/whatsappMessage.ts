// Outils partagés Sales + Business pour les messages WhatsApp pré-remplis.

/** Étape de relance : 0 = premier contact, n = relance n. */
export function stepLabel(step: number, fr: boolean) {
  if (step === 0) return fr ? 'Premier contact' : 'First contact'
  return fr ? `Relance ${step}` : `Follow-up ${step}`
}

/** Remplace {{prenom}}, {{nom}}, {{mon_prenom}}. */
export function fillWhatsAppMessage(message: string, vars: { prenom?: string; nom?: string; mon_prenom?: string }) {
  const map: Record<string, string> = {
    prenom: vars.prenom || '', 'prénom': vars.prenom || '',
    nom: vars.nom || '',
    mon_prenom: vars.mon_prenom || '', 'mon_prénom': vars.mon_prenom || '',
  }
  return message.replace(/\{\{\s*([a-zA-Z_éè]+)\s*\}\}/g, (m, k: string) => (map[k.toLowerCase()] ?? m)).trim()
}

/** Lien wa.me : chiffres seulement (sans « + » ni « 00 »), message encodé. */
export function whatsAppLink(phone: string, text?: string) {
  let digits = String(phone || '').replace(/[^0-9+]/g, '')
  if (digits.startsWith('+')) digits = digits.slice(1)
  else if (digits.startsWith('00')) digits = digits.slice(2)
  digits = digits.replace(/\D/g, '')
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

/** Prénom / nom d'un prospect (champs dédiés, sinon « contact » découpé). */
export function splitProspectName(p: { firstName?: string | null; lastName?: string | null; contact?: string | null }) {
  const parts = String(p.contact || '').trim().split(/\s+/).filter(Boolean)
  return {
    prenom: (p.firstName || parts[0] || '').trim(),
    nom: (p.lastName || parts.slice(1).join(' ') || '').trim(),
  }
}
