// Motifs de disqualification proposés dans la pop-up « Non-Qualifié ».
// La clé est stockée en base (business_prospects.unqualified_reason) pour rester
// stable entre les langues et agrégeable côté KPI ; le libellé n'est que de l'affichage.

export type UnqualifiedReasonKey =
  | 'territory'
  | 'budget'
  | 'not_decision_maker'
  | 'off_target'
  | 'offer_mismatch'
  | 'timing'
  | 'unreachable'
  | 'duplicate'
  | 'other'

import type { BusinessProspect } from '../contexts/BusinessProspectsContext'

export interface UnqualifiedReason {
  key: UnqualifiedReasonKey
  fr: string
  en: string
}

export const UNQUALIFIED_REASONS: UnqualifiedReason[] = [
  { key: 'territory', fr: "Nous n'exerçons pas sur ce territoire", en: 'We do not operate in this territory' },
  { key: 'budget', fr: 'Budget insuffisant', en: 'Insufficient budget' },
  { key: 'not_decision_maker', fr: 'Pas décisionnaire', en: 'Not the decision maker' },
  { key: 'off_target', fr: 'Hors cible / mauvais profil', en: 'Off target / wrong profile' },
  { key: 'offer_mismatch', fr: 'Notre offre ne répond pas au besoin', en: 'Our offer does not match the need' },
  { key: 'timing', fr: 'Mauvais timing / projet reporté', en: 'Bad timing / project postponed' },
  { key: 'unreachable', fr: 'Injoignable / coordonnées invalides', en: 'Unreachable / invalid contact details' },
  { key: 'duplicate', fr: 'Doublon', en: 'Duplicate' },
  { key: 'other', fr: 'Autre (préciser)', en: 'Other (specify)' },
]

/** Libellé affichable d'un motif. Pour « Autre », le texte libre fait office de libellé. */
export function unqualifiedReasonLabel(
  key: string | null | undefined,
  lang: 'fr' | 'en',
  details?: string | null,
): string {
  if (!key) return ''
  if (key === 'other') return (details || '').trim() || (lang === 'en' ? 'Other' : 'Autre')
  const reason = UNQUALIFIED_REASONS.find(r => r.key === key)
  if (!reason) return key
  return lang === 'en' ? reason.en : reason.fr
}

export interface UnqualifiedPayload {
  reason: UnqualifiedReasonKey
  /** Libellé résolu dans la langue de l'utilisateur — repris tel quel dans l'email au prospect. */
  reasonLabel: string
  details: string
  sendEmail: boolean
  /** Id du RDV à annuler, null si aucun RDV à venir ou si l'utilisateur a décoché. */
  cancelAppointmentId: string | null
}

/**
 * Applique une disqualification : mise à jour du prospect puis notification serveur
 * (email au prospect + annulation éventuelle du RDV). La notification est best-effort :
 * un échec d'email ne doit pas empêcher le changement d'étape.
 */
export async function applyUnqualification(
  prospectId: number,
  ownerId: string | null | undefined,
  payload: UnqualifiedPayload,
  updateProspect: (id: number, updates: Partial<BusinessProspect>) => Promise<void> | void,
): Promise<void> {
  await updateProspect(prospectId, {
    stage: 'unqualified',
    unqualified_reason: payload.reason,
    unqualified_details: payload.details || null,
    unqualified_at: new Date().toISOString(),
  })

  if (!ownerId) return
  if (!payload.sendEmail && !payload.cancelAppointmentId) return

  try {
    await fetch('/api/business?action=prospect-unqualified-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: ownerId,
        prospect_id: prospectId,
        reason: payload.reason,
        reason_label: payload.reasonLabel,
        details: payload.details || '',
        send_email: payload.sendEmail,
        cancel_appointment_id: payload.cancelAppointmentId,
      }),
    })
  } catch {
    /* best-effort : l'étape est déjà enregistrée */
  }
}
