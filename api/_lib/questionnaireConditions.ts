// Mirror of src/lib/questionnaireConditions.ts — kept in api/_lib/ per Vercel convention
// where api/ files cannot import from src/. Keep these two files in sync.

export type ConditionalOperator = 'in' | 'gte' | 'lte' | 'between'

export type ConditionalRule = {
  enabled: boolean
  source_id: string
  operator: ConditionalOperator
  values: (string | number)[]
}

export type EvaluableQuestionType = 'text' | 'select' | 'multiple_choice' | 'number'

export type EvaluableQuestion = {
  client_id: string
  question_type: EvaluableQuestionType
  conditional?: ConditionalRule | null
}

export const ELIGIBLE_SOURCE_TYPES: EvaluableQuestionType[] = ['select', 'multiple_choice', 'number']

export function isEligibleSourceType(t: EvaluableQuestionType | string | undefined | null): boolean {
  return !!t && (ELIGIBLE_SOURCE_TYPES as string[]).includes(t)
}

export function isRuleValid(
  rule: ConditionalRule | null | undefined,
  questionsByClientId: Record<string, EvaluableQuestion>,
): boolean {
  if (!rule || !rule.enabled) return false
  const src = questionsByClientId[rule.source_id]
  if (!src) return false
  if (!isEligibleSourceType(src.question_type)) return false
  if (src.question_type === 'select' || src.question_type === 'multiple_choice') {
    return rule.operator === 'in' && Array.isArray(rule.values) && rule.values.length > 0
  }
  if (rule.operator === 'gte' || rule.operator === 'lte') {
    return Array.isArray(rule.values) && rule.values.length >= 1 && typeof rule.values[0] === 'number' && !Number.isNaN(rule.values[0])
  }
  if (rule.operator === 'between') {
    return (
      Array.isArray(rule.values) && rule.values.length >= 2 &&
      typeof rule.values[0] === 'number' && !Number.isNaN(rule.values[0]) &&
      typeof rule.values[1] === 'number' && !Number.isNaN(rule.values[1])
    )
  }
  return false
}

export function evaluateConditional(
  rule: ConditionalRule | null | undefined,
  answersByClientId: Record<string, unknown>,
  questionsByClientId: Record<string, EvaluableQuestion>,
): boolean {
  if (!isRuleValid(rule, questionsByClientId)) return true
  const r = rule as ConditionalRule
  const src = questionsByClientId[r.source_id]
  const answer = answersByClientId[r.source_id]

  if (src.question_type === 'select') {
    if (typeof answer !== 'string' || answer.length === 0) return false
    return (r.values as string[]).includes(answer)
  }
  if (src.question_type === 'multiple_choice') {
    if (!Array.isArray(answer) || answer.length === 0) return false
    const vals = r.values as string[]
    return (answer as string[]).some(a => vals.includes(a))
  }
  const n = typeof answer === 'number' ? answer : (answer === '' || answer == null ? NaN : Number(answer))
  if (!Number.isFinite(n)) return false
  if (r.operator === 'gte') return n >= (r.values[0] as number)
  if (r.operator === 'lte') return n <= (r.values[0] as number)
  if (r.operator === 'between') return n >= (r.values[0] as number) && n <= (r.values[1] as number)
  return false
}

export function computeVisibleQuestionIds(
  questions: EvaluableQuestion[],
  answersByClientId: Record<string, unknown>,
): Set<string> {
  const byId: Record<string, EvaluableQuestion> = {}
  for (const q of questions) byId[q.client_id] = q
  const visible = new Set<string>()
  for (const q of questions) {
    if (evaluateConditional(q.conditional ?? null, answersByClientId, byId)) {
      visible.add(q.client_id)
    }
  }
  return visible
}
