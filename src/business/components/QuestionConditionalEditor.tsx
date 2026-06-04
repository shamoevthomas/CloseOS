import { useMemo } from 'react'
import { ChevronDown, AlertTriangle } from 'lucide-react'
import { useBusinessLang } from '../i18n/BusinessLangContext'
import {
  ConditionalRule,
  ConditionalOperator,
  EvaluableQuestion,
  isEligibleSourceType,
} from '../../lib/questionnaireConditions'

export interface ConditionalEditorQuestion extends EvaluableQuestion {
  question_text: string
  options?: string[]
  sort_order: number
}

interface Props {
  question: ConditionalEditorQuestion
  allQuestions: ConditionalEditorQuestion[]
  onChange: (rule: ConditionalRule | null) => void
}

export function QuestionConditionalEditor({ question, allQuestions, onChange }: Props) {
  const { t } = useBusinessLang()

  const eligibleSources = useMemo(
    () =>
      allQuestions.filter(
        q =>
          q.client_id &&
          q.client_id !== question.client_id &&
          q.sort_order < question.sort_order &&
          isEligibleSourceType(q.question_type),
      ),
    [allQuestions, question.client_id, question.sort_order],
  )

  const byId = useMemo(() => {
    const map: Record<string, ConditionalEditorQuestion> = {}
    for (const q of allQuestions) if (q.client_id) map[q.client_id] = q
    return map
  }, [allQuestions])

  const rule = question.conditional ?? null
  // Orphan = the rule's SOURCE is broken: it no longer exists, was moved after this
  // question, or its type is no longer an eligible source. This is independent of
  // whether the answer values are filled in yet — an enabled-but-incomplete rule
  // (source picked, values not chosen yet) must still show its config UI, not the
  // "source missing" warning. eligibleSources already encodes exists + before + type.
  const ruleOrphan = !!rule && rule.enabled && !eligibleSources.some(s => s.client_id === rule.source_id)

  // No eligible source AND no existing rule => show inert hint
  if (eligibleSources.length === 0 && !rule) {
    return (
      <div className="ml-7 text-[10px] text-[#747878] dark:text-neutral-500 italic">
        {t.campaigns_conditional_no_eligible}
      </div>
    )
  }

  const enabled = !!rule?.enabled
  const source = rule ? byId[rule.source_id] : null
  const sourceType = source?.question_type

  function toggleEnabled() {
    if (enabled) {
      onChange(null)
    } else {
      const first = eligibleSources[0]
      if (!first) return
      const initial: ConditionalRule = {
        enabled: true,
        source_id: first.client_id,
        operator: first.question_type === 'number' ? 'gte' : 'in',
        values: [],
      }
      onChange(initial)
    }
  }

  function setSource(id: string) {
    const src = byId[id]
    if (!src) return
    onChange({
      enabled: true,
      source_id: id,
      operator: src.question_type === 'number' ? 'gte' : 'in',
      values: [],
    })
  }

  function setOperator(op: ConditionalOperator) {
    if (!rule) return
    let newValues = rule.values
    // Reset values when switching number operators (between needs 2, others need 1)
    if (op === 'between' && (rule.operator === 'gte' || rule.operator === 'lte')) {
      newValues = []
    } else if ((op === 'gte' || op === 'lte') && rule.operator === 'between') {
      newValues = []
    }
    onChange({ ...rule, operator: op, values: newValues })
  }

  function toggleValue(v: string) {
    if (!rule) return
    const vals = Array.isArray(rule.values) ? (rule.values as string[]) : []
    const next = vals.includes(v) ? vals.filter(x => x !== v) : [...vals, v]
    onChange({ ...rule, values: next })
  }

  function setNumberValue(idx: number, raw: string) {
    if (!rule) return
    const vals = [...(rule.values || [])]
    if (raw === '') {
      vals[idx] = undefined as unknown as number
    } else {
      const n = Number(raw)
      vals[idx] = Number.isFinite(n) ? n : (undefined as unknown as number)
    }
    // Compact undefineds at end for clean storage
    const cleaned = vals.map(x => (x === undefined ? null : x)).filter((x, i) => i === 0 || x !== null) as (number | null)[]
    onChange({ ...rule, values: cleaned.filter(x => x !== null) as number[] })
  }

  return (
    <div className="ml-7 space-y-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={toggleEnabled}
          disabled={eligibleSources.length === 0}
          className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-lg transition-colors ${enabled ? 'bg-[#006c49] text-white' : 'bg-[#f5f3f2] text-[#747878] dark:bg-neutral-800 dark:text-neutral-400'} ${eligibleSources.length === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          {t.campaigns_conditional_title}
        </button>
        {enabled && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-[10px] font-bold text-[#747878] dark:text-neutral-500 hover:text-[#1b1c1b] dark:hover:text-white"
          >
            {t.campaigns_conditional_always_show}
          </button>
        )}
      </div>

      {enabled && ruleOrphan && (
        <div className="flex items-start gap-2 text-[10px] text-[#b87500] bg-[#ffb95f]/10 rounded-lg px-3 py-2">
          <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
          <div className="flex-1">{t.campaigns_conditional_orphan_warning}</div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-[10px] font-bold text-[#b87500] hover:underline whitespace-nowrap"
          >
            {t.campaigns_conditional_clear_rule}
          </button>
        </div>
      )}

      {enabled && !ruleOrphan && rule && source && (
        <div className="border-l-2 border-[#006c49]/40 pl-3 space-y-2">
          {/* Source picker */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold text-[#747878] dark:text-neutral-500 uppercase tracking-wide">
              {t.campaigns_conditional_show_if}
            </span>
            <div className="relative">
              <select
                value={rule.source_id}
                onChange={e => setSource(e.target.value)}
                className="appearance-none bg-white dark:bg-neutral-700 border border-[#c4c7c7]/30 dark:border-neutral-600 rounded-lg px-2.5 py-1 pr-7 text-[10px] font-bold text-[#1b1c1b] dark:text-white focus:outline-none focus:border-[#006c49] max-w-[200px] truncate"
              >
                {eligibleSources.map(q => (
                  <option key={q.client_id} value={q.client_id}>
                    {`${q.sort_order + 1}. ${(q.question_text || '').slice(0, 40)}`}
                  </option>
                ))}
                {/* If current source is no longer eligible but still referenced, still show it as fallback */}
                {!eligibleSources.find(s => s.client_id === rule.source_id) && (
                  <option value={rule.source_id}>{source.question_text}</option>
                )}
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 pointer-events-none text-[#747878]" />
            </div>
          </div>

          {/* Operator + values */}
          {(sourceType === 'select' || sourceType === 'multiple_choice') && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-[#747878] dark:text-neutral-500 uppercase tracking-wide">
                {t.campaigns_conditional_op_in} :
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(source.options || []).filter(o => o.trim()).map(opt => {
                  const selected = (rule.values as string[]).includes(opt)
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggleValue(opt)}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors ${selected ? 'bg-[#006c49] text-white' : 'bg-[#f5f3f2] text-[#747878] dark:bg-neutral-800 dark:text-neutral-400'}`}
                    >
                      {opt}
                    </button>
                  )
                })}
              </div>
              {(rule.values || []).length === 0 && (
                <p className="text-[10px] text-[#b87500] italic">{t.campaigns_conditional_pick_values}</p>
              )}
            </div>
          )}

          {sourceType === 'number' && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                {(['gte', 'lte', 'between'] as const).map(op => (
                  <button
                    key={op}
                    type="button"
                    onClick={() => setOperator(op)}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors ${rule.operator === op ? 'bg-[#006c49] text-white' : 'bg-[#f5f3f2] text-[#747878] dark:bg-neutral-800 dark:text-neutral-400'}`}
                  >
                    {op === 'gte' ? t.campaigns_conditional_op_gte : op === 'lte' ? t.campaigns_conditional_op_lte : t.campaigns_conditional_op_between}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={typeof rule.values[0] === 'number' ? rule.values[0] : ''}
                  onChange={e => setNumberValue(0, e.target.value)}
                  placeholder="0"
                  className="w-24 bg-white dark:bg-neutral-700 border border-[#c4c7c7]/30 dark:border-neutral-600 rounded-lg px-2.5 py-1 text-[10px] font-bold text-[#1b1c1b] dark:text-white focus:outline-none focus:border-[#006c49]"
                />
                {rule.operator === 'between' && (
                  <>
                    <span className="text-xs text-[#747878]">—</span>
                    <input
                      type="number"
                      value={typeof rule.values[1] === 'number' ? rule.values[1] : ''}
                      onChange={e => setNumberValue(1, e.target.value)}
                      placeholder="0"
                      className="w-24 bg-white dark:bg-neutral-700 border border-[#c4c7c7]/30 dark:border-neutral-600 rounded-lg px-2.5 py-1 text-[10px] font-bold text-[#1b1c1b] dark:text-white focus:outline-none focus:border-[#006c49]"
                    />
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
