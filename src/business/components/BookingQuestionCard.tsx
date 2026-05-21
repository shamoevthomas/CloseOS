import { X, Trash2, ChevronUp } from 'lucide-react'
import { QuestionConditionalEditor } from './QuestionConditionalEditor'
import type { ConditionalRule } from '../../lib/questionnaireConditions'

export interface BookingQuestionShape {
  client_id: string
  question_text: string
  question_type: 'text' | 'select' | 'multiple_choice' | 'number'
  is_required: boolean
  options: string[]
  sort_order: number
  conditional?: ConditionalRule | null
}

interface Props {
  question: BookingQuestionShape
  idx: number
  allQuestions: BookingQuestionShape[]
  onUpdate: (updates: Partial<BookingQuestionShape>) => void
  onRemove: () => void
  onMove: (direction: 1 | -1) => void
}

const TYPE_LABELS: Record<BookingQuestionShape['question_type'], string> = {
  text: 'Texte',
  select: 'Choix unique',
  multiple_choice: 'Choix multiples',
  number: 'Nombre',
}

export function BookingQuestionCard({ question: q, idx, allQuestions, onUpdate, onRemove, onMove }: Props) {
  return (
    <div className="rounded-xl border border-[#c4c7c7]/20 dark:border-neutral-700 p-4 space-y-3 bg-[#f5f3f2]/50 dark:bg-neutral-800/50">
      <div className="flex items-start gap-2">
        <span className="text-xs font-bold text-[#747878] dark:text-neutral-500 mt-2.5 flex-shrink-0 w-5">{idx + 1}.</span>
        <input
          type="text"
          value={q.question_text}
          onChange={e => onUpdate({ question_text: e.target.value })}
          placeholder="Votre question..."
          className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-neutral-800 border border-[#c4c7c7]/20 dark:border-neutral-700 text-sm text-[#1b1c1b] dark:text-white focus:outline-none focus:border-[#006c49]"
        />
        <button
          onClick={() => onUpdate({ is_required: !q.is_required })}
          className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap mt-1 ${q.is_required ? 'bg-[#1b1c1b] text-white dark:bg-white dark:text-neutral-900' : 'bg-[#f5f3f2] text-[#747878] dark:bg-neutral-800 dark:text-neutral-500'}`}
        >
          {q.is_required ? 'Requis' : 'Optionnel'}
        </button>
      </div>

      <div className="flex items-center gap-2 ml-7">
        <label className="text-[10px] font-bold text-[#747878] dark:text-neutral-500 uppercase tracking-wide flex-shrink-0">Type</label>
        {(['text', 'select', 'multiple_choice', 'number'] as const).map(tp => (
          <button
            key={tp}
            onClick={() => {
              const updates: Partial<BookingQuestionShape> = { question_type: tp }
              if (tp === 'text' || tp === 'number') updates.options = []
              else if ((tp === 'select' || tp === 'multiple_choice') && q.options.length === 0) updates.options = ['']
              onUpdate(updates)
            }}
            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors ${q.question_type === tp ? 'bg-[#006c49] text-white' : 'bg-white dark:bg-neutral-700 text-[#444748] dark:text-neutral-300'}`}
          >
            {TYPE_LABELS[tp]}
          </button>
        ))}
      </div>

      {(q.question_type === 'select' || q.question_type === 'multiple_choice') && (
        <div className="ml-7 border-l-2 border-[#c4c7c7]/30 dark:border-neutral-700 pl-3 space-y-1.5">
          <p className="text-[10px] font-bold text-[#747878] dark:text-neutral-500 uppercase tracking-wide">Options</p>
          {(q.options.length > 0 ? q.options : ['']).map((opt, oi) => (
            <div key={oi} className="flex items-center gap-1.5">
              <input
                type="text"
                value={opt}
                onChange={e => {
                  const opts = [...q.options]
                  opts[oi] = e.target.value
                  onUpdate({ options: opts })
                }}
                placeholder={`Option ${oi + 1}`}
                className="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-neutral-700 border border-[#c4c7c7]/20 dark:border-neutral-600 text-xs text-[#1b1c1b] dark:text-white focus:outline-none focus:border-[#006c49]"
              />
              {q.options.length > 1 && (
                <button
                  onClick={() => onUpdate({ options: q.options.filter((_, i) => i !== oi) })}
                  className="text-red-400 hover:text-red-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => onUpdate({ options: [...q.options, ''] })}
            className="text-[10px] font-bold text-[#006c49] hover:underline"
          >
            + Ajouter une option
          </button>
        </div>
      )}

      <QuestionConditionalEditor
        question={{
          client_id: q.client_id,
          question_text: q.question_text,
          question_type: q.question_type,
          options: q.options,
          sort_order: idx,
          conditional: q.conditional ?? null,
        }}
        allQuestions={allQuestions.map((qq, i) => ({
          client_id: qq.client_id,
          question_text: qq.question_text,
          question_type: qq.question_type,
          options: qq.options,
          sort_order: i,
          conditional: qq.conditional ?? null,
        }))}
        onChange={rule => onUpdate({ conditional: rule })}
      />

      <div className="flex items-center justify-between ml-7 pt-2 border-t border-[#c4c7c7]/10 dark:border-neutral-700">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onMove(-1)}
            disabled={idx === 0}
            className="p-1 text-[#747878] hover:text-[#1b1c1b] dark:hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            onClick={() => onMove(1)}
            disabled={idx === allQuestions.length - 1}
            className="p-1 text-[#747878] hover:text-[#1b1c1b] dark:hover:text-white disabled:opacity-20 disabled:cursor-not-allowed rotate-180"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
        </div>
        <button onClick={onRemove} className="text-red-400 hover:text-red-600 p-1">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
