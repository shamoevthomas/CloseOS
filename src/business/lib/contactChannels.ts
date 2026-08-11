// Canal utilisé pour joindre un prospect (premier contact ou relance).
// Renseigné via la pop-up « Message envoyé à l'écrit, par vocal ou par mail ? »
// et exploité par les KPI setter « taux de réponse par canal ».

export type ContactChannel = 'written' | 'voice' | 'email'

export const CONTACT_CHANNELS: { key: ContactChannel; fr: string; en: string; hintFr: string; hintEn: string; emoji: string }[] = [
  { key: 'written', fr: 'À l\'écrit', en: 'Written', hintFr: 'SMS, WhatsApp, DM, LinkedIn…', hintEn: 'SMS, WhatsApp, DM, LinkedIn…', emoji: '✍️' },
  { key: 'voice', fr: 'Par vocal', en: 'Voice note', hintFr: 'Message vocal ou audio', hintEn: 'Voice or audio message', emoji: '🎤' },
  { key: 'email', fr: 'Par mail', en: 'Email', hintFr: 'Email envoyé au prospect', hintEn: 'Email sent to the prospect', emoji: '📧' },
]

export function contactChannelLabel(key: ContactChannel | null | undefined, fr: boolean): string {
  const c = CONTACT_CHANNELS.find(x => x.key === key)
  if (!c) return fr ? 'Non renseigné' : 'Not set'
  return fr ? c.fr : c.en
}

export function isContactChannel(v: unknown): v is ContactChannel {
  return v === 'written' || v === 'voice' || v === 'email'
}

// Canal de la dernière relance effectuée sur un prospect (null si non renseigné).
// relance_channels[i] = canal de la relance n°(i+1) → la dernière est à l'index relance_step - 1.
export function lastRelanceChannel(p: { relance_step?: number | null; relance_channels?: unknown }): ContactChannel | null {
  const step = Math.max(0, Number(p.relance_step) || 0)
  if (step === 0) return null
  const arr = Array.isArray(p.relance_channels) ? p.relance_channels : []
  const v = arr[step - 1]
  return isContactChannel(v) ? v : null
}

// « A répondu » = bouton « Répondu » cliqué (responded_at) OU prospect avancé
// au-delà de « Contacté » (il a forcément répondu pour être booké/qualifié).
// Source unique pour tous les taux de réponse par canal (KPI setter + Rapport).
export function hasResponded(p: { responded_at?: string | null; stage?: string }): boolean {
  return !!p.responded_at || (p.stage !== 'prospect' && p.stage !== 'noanswer' && p.stage !== 'contacted')
}

// Taux de réponse par canal de premier contact, sur un jeu de prospects déjà contactés.
export function channelResponseStats<T extends { first_contact_channel?: string | null; responded_at?: string | null; stage?: string }>(
  contacted: T[],
): { key: ContactChannel; sent: number; replied: number; rate: number }[] {
  return CONTACT_CHANNELS.map(c => {
    const sent = contacted.filter(p => p.first_contact_channel === c.key)
    const replied = sent.filter(hasResponded).length
    return { key: c.key, sent: sent.length, replied, rate: sent.length > 0 ? (replied / sent.length) * 100 : 0 }
  })
}

type AskChannelFn = (
  kind: 'first' | 'relance',
  opts?: { relanceNumber?: number; contactName?: string },
) => Promise<ContactChannel | null>

type UpdateProspectFn = (id: number, updates: Record<string, unknown>) => unknown

interface ChannelProspect {
  id: number
  contact?: string
  relance_step?: number | null
  relance_channels?: unknown
}

// « Relance faite » : on demande le canal puis on incrémente relance_step en
// enregistrant le canal au bon rang. Factorisé car appelé depuis le pipeline
// owner, le pipeline closer, la fiche prospect et la liste de travail.
export async function markRelanceDone(
  p: ChannelProspect,
  askChannel: AskChannelFn,
  updateProspect: UpdateProspectFn,
) {
  const step = Math.max(0, Number(p.relance_step) || 0)
  const channel = await askChannel('relance', { relanceNumber: step + 1, contactName: p.contact })
  return updateProspect(p.id, {
    relance_step: step + 1,
    last_relance_at: new Date().toISOString(),
    relance_channels: appendRelanceChannel(p.relance_channels, step, channel),
  })
}

// Passage en « Contacté » : le canal part dans la même requête que le stage.
export async function markFirstContact(
  p: ChannelProspect,
  askChannel: AskChannelFn,
  updateProspect: UpdateProspectFn,
  extra: Record<string, unknown> = {},
) {
  const channel = await askChannel('first', { contactName: p.contact })
  return updateProspect(p.id, { ...extra, stage: 'contacted', first_contact_channel: channel })
}

// Ajoute le canal de la relance n°(step+1) sans perdre les précédents.
// Les trous éventuels (question désactivée sur une relance) sont comblés par null.
export function appendRelanceChannel(
  existing: unknown,
  step: number,
  channel: ContactChannel | null,
): (ContactChannel | null)[] {
  const arr = (Array.isArray(existing) ? existing : []).map(v => (isContactChannel(v) ? v : null))
  const idx = Math.max(0, step)
  while (arr.length < idx) arr.push(null)
  arr[idx] = channel
  return arr
}
