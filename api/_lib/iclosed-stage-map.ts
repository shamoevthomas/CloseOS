// Shared mapping between iClosed contact statuses/stages and the
// 6 canonical CloseOS Business stages. Used by:
//   - the inbound iClosed webhook handler (Business + Sales)
//   - the initial sync handlers (pull from /v1/eventCalls and /v1/contacts)
//   - the outbound push (CloseOS stage → iClosed contact_stage / outcome)

export const VALID_BUSINESS_STAGES = new Set([
  'prospect',
  'qualified',
  'won',
  'followup',
  'noshow',
  'lost',
])

export type BusinessStage =
  | 'prospect'
  | 'qualified'
  | 'won'
  | 'followup'
  | 'noshow'
  | 'lost'

/**
 * Heuristic mapping from a free-form iClosed status string to a CloseOS stage.
 * Falls back to 'prospect' when nothing matches.
 */
export function mapIclosedStatusToBusinessStage(raw: string | undefined | null): BusinessStage {
  if (!raw) return 'prospect'
  const s = String(raw).toLowerCase().replace(/[_-]+/g, ' ').trim()
  if (/(customer|closed.?won|won|client)/.test(s)) return 'won'
  if (/(no.?show)/.test(s)) return 'noshow'
  if (/(lost|disqualified|closed.?lost|perdu)/.test(s)) return 'lost'
  if (/(follow.?up|relance)/.test(s)) return 'followup'
  if (/(qualified|qualifi|booked|strategy.?call|call.?booked)/.test(s)) return 'qualified'
  return 'prospect'
}

/**
 * Resolves the final CloseOS stage by first consulting the user's custom
 * mapping (iClosed stage name → CloseOS stage), then falling back to the
 * regex-based heuristic. Custom-mapping lookup is case-insensitive.
 */
export function resolveBusinessStage(
  raw: string | undefined | null,
  customMapping: Record<string, string> | null | undefined
): BusinessStage {
  if (!raw) return 'prospect'
  if (customMapping && typeof customMapping === 'object') {
    const target = String(raw).trim().toLowerCase()
    for (const [iclosedName, closeosStage] of Object.entries(customMapping)) {
      if (
        String(iclosedName).trim().toLowerCase() === target &&
        VALID_BUSINESS_STAGES.has(String(closeosStage))
      ) {
        return closeosStage as BusinessStage
      }
    }
  }
  return mapIclosedStatusToBusinessStage(raw)
}

/**
 * Inverse mapping used when pushing a CloseOS stage back to iClosed as the
 * `contactFields.contact_stage` free-form value. The user's custom mapping
 * is consulted first (its keys are iClosed names), so we look for the first
 * key whose value equals the CloseOS stage; otherwise we use a sane default.
 */
export function businessStageToIclosedLabel(
  stage: BusinessStage,
  customMapping: Record<string, string> | null | undefined
): string {
  if (customMapping && typeof customMapping === 'object') {
    for (const [iclosedName, closeosStage] of Object.entries(customMapping)) {
      if (closeosStage === stage) return String(iclosedName)
    }
  }
  switch (stage) {
    case 'won': return 'Customer'
    case 'lost': return 'Lost'
    case 'noshow': return 'No Show'
    case 'followup': return 'Follow Up'
    case 'qualified': return 'Qualified'
    case 'prospect':
    default: return 'Prospect'
  }
}
