// Shared catalog of outbound webhook events for CloseOS Business.
// Used by the inbound API (validation), the dispatcher (filtering),
// and the modal UI (event picker + inline docs).

export const BUSINESS_EVENTS = [
  { id: 'prospect.created',        label: 'Prospect créé',                description: 'Un nouveau prospect a été ajouté (manuellement, par capture, ou via API).' },
  { id: 'prospect.updated',        label: 'Prospect mis à jour',          description: 'Un champ du prospect (autre que le stage) a été modifié.' },
  { id: 'prospect.stage_changed',  label: 'Stage modifié',                description: 'Le stage du prospect a changé. Le payload inclut previous_stage et new_stage.' },
  { id: 'prospect.deleted',        label: 'Prospect supprimé',            description: 'Le prospect a été supprimé.' },
  { id: 'campaign.lead_captured',  label: 'Lead capturé via campagne',    description: 'Un nouveau lead arrive depuis un formulaire de capture.' },
  { id: 'appointment.booked',      label: 'Rendez-vous réservé',          description: 'Un RDV a été pris pour ce prospect.' },
  { id: 'appointment.cancelled',   label: 'Rendez-vous annulé',           description: 'Un RDV a été annulé.' },
  { id: 'appointment.completed',   label: 'Rendez-vous terminé',          description: 'Un RDV a été marqué comme terminé.' },
  { id: 'deal.won',                label: 'Deal gagné',                   description: 'Le prospect est passé en gagné (vente conclue / souscription Stripe active).' },
  { id: 'deal.lost',               label: 'Deal perdu',                   description: 'Le prospect est passé en perdu (souscription annulée ou stage = lost).' },
] as const

export type BusinessEvent = typeof BUSINESS_EVENTS[number]['id']

export const BUSINESS_EVENT_IDS = BUSINESS_EVENTS.map(e => e.id) as readonly string[]

export function isValidBusinessEvent(id: string): id is BusinessEvent {
  return (BUSINESS_EVENT_IDS as readonly string[]).includes(id)
}
