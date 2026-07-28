import { useState, useEffect, useMemo, useCallback, useRef, type ReactNode } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Loader2, Check, ArrowLeft, ArrowRight, Star, AlertCircle, Play, Lock } from 'lucide-react'
import { PhoneInput } from '../business/components/PhoneInput'
import {
  computeVisibleBlockIds, validateAnswer, isInputBlock, splitIntoPages,
  parseVideoUrl, videoSrcWithAutoplay, requiredWatchSeconds,
  type FormBlock, type FormSettings, type ValidationCode,
} from '../lib/formBlocks'

const API_URL = '/api/business-forms'

interface PublicFormData {
  id: string
  name: string
  description: string | null
  slug: string
  blocks: FormBlock[]
  settings: FormSettings
}

// ─── Libellés système (le contenu du formulaire, lui, est écrit par le propriétaire) ───

const STRINGS = {
  fr: {
    errors: {
      required: 'Ce champ est obligatoire',
      invalid_email: 'Adresse email invalide',
      invalid_phone: 'Numéro de téléphone invalide',
      invalid_number: 'Valeur numérique invalide',
      invalid_url: 'Lien invalide (https://…)',
      watch_required: 'Regardez la vidéo pour continuer',
    } as Record<ValidationCode, string>,
    oops: 'Oups',
    not_found: 'Formulaire introuvable.',
    closed: 'Ce formulaire n\'accepte plus de réponses.',
    unavailable: 'Formulaire indisponible.',
    step: (a: number, b: number) => `Étape ${a} sur ${b}`,
    back: 'Retour',
    next: 'Suivant',
    sending: 'Envoi…',
    submit: 'Envoyer',
    choose: 'Choisir…',
    yes: 'Oui',
    no: 'Non',
    fix_errors: 'Certaines réponses doivent être corrigées.',
    send_failed: 'L\'envoi a échoué. Merci de réessayer.',
    network_failed: 'L\'envoi a échoué. Vérifiez votre connexion.',
    powered_by: 'Propulsé par',
    play_video: 'Lancer la vidéo',
    watch_remaining: (s: number) => `Encore ${s} s de visionnage avant de pouvoir continuer`,
    watch_done: 'Visionnage validé',
    video_missing: 'Vidéo indisponible.',
  },
  en: {
    errors: {
      required: 'This field is required',
      invalid_email: 'Invalid email address',
      invalid_phone: 'Invalid phone number',
      invalid_number: 'Invalid number',
      invalid_url: 'Invalid link (https://…)',
      watch_required: 'Watch the video to continue',
    } as Record<ValidationCode, string>,
    oops: 'Oops',
    not_found: 'Form not found.',
    closed: 'This form is no longer accepting responses.',
    unavailable: 'Form unavailable.',
    step: (a: number, b: number) => `Step ${a} of ${b}`,
    back: 'Back',
    next: 'Next',
    sending: 'Sending…',
    submit: 'Submit',
    choose: 'Choose…',
    yes: 'Yes',
    no: 'No',
    fix_errors: 'Some answers need to be corrected.',
    send_failed: 'Submission failed. Please try again.',
    network_failed: 'Submission failed. Check your connection.',
    powered_by: 'Powered by',
    play_video: 'Play video',
    watch_remaining: (s: number) => `${s}s of viewing left before you can continue`,
    watch_done: 'Viewing complete',
    video_missing: 'Video unavailable.',
  },
}

/**
 * Valeurs canoniques d'un bloc Oui/Non : toujours stockées en français,
 * quelle que soit la langue d'affichage, pour que la logique conditionnelle
 * et le CRM restent cohérents entre visiteurs.
 */
const YES_NO_VALUES = ['Oui', 'Non']

export default function PublicForm() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  // Même convention que les pages de capture — vercel.json n'assouplit
  // X-Frame-Options / frame-ancestors que pour embed=true
  const isEmbed = searchParams.get('embed') === 'true'

  // Langue d'affichage : ?lang= prioritaire, sinon celle du navigateur (français par défaut)
  const S = useMemo(() => {
    const forced = searchParams.get('lang')
    if (forced === 'fr' || forced === 'en') return STRINGS[forced]
    const nav = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : 'fr'
    return nav.startsWith('fr') ? STRINGS.fr : STRINGS.en
  }, [searchParams])

  const [form, setForm] = useState<PublicFormData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [errors, setErrors] = useState<Record<string, ValidationCode>>({})
  const [stepIndex, setStepIndex] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // ─── Chargement ───

  useEffect(() => {
    if (!slug) return
    let cancelled = false

    ;(async () => {
      try {
        const res = await fetch(`${API_URL}?action=form-public&slug=${encodeURIComponent(slug)}`)
        const data = await res.json()
        if (cancelled) return

        if (!res.ok) {
          setLoadError(res.status === 403 ? S.closed : S.not_found)
          return
        }

        setForm(data.form)

        // Les champs cachés sont alimentés par la query string (utm_source, etc.)
        const seeded: Record<string, unknown> = {}
        for (const block of data.form.blocks as FormBlock[]) {
          if (block.type === 'hidden' && block.key) {
            const value = searchParams.get(block.key)
            if (value) seeded[block.id] = value
          }
        }
        if (Object.keys(seeded).length > 0) setAnswers(seeded)
      } catch {
        if (!cancelled) setLoadError(S.unavailable)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [slug, searchParams, S])

  const accent = form?.settings.accent_color || '#006c49'

  // ─── Découpage en étapes ───

  const steps = useMemo<FormBlock[][]>(() => {
    if (!form) return []
    if (!form.settings.one_at_a_time) return splitIntoPages(form.blocks)

    // Une question par écran : les blocs de contenu qui précèdent
    // sont rattachés à la question qui suit.
    const out: FormBlock[][] = []
    let buffer: FormBlock[] = []
    for (const block of form.blocks) {
      if (block.type === 'page_break') continue
      if (isInputBlock(block.type)) {
        out.push([...buffer, block])
        buffer = []
      } else {
        buffer.push(block)
      }
    }
    if (buffer.length > 0) out.push(buffer)
    return out.length > 0 ? out : [[]]
  }, [form])

  const visibleIds = useMemo(
    () => (form ? computeVisibleBlockIds(form.blocks, answers) : new Set<string>()),
    [form, answers],
  )

  /** Les champs cachés ne s'affichent jamais, mais restent soumis. */
  const isRenderable = useCallback(
    (block: FormBlock) => block.type !== 'hidden' && visibleIds.has(block.id),
    [visibleIds],
  )

  /** Étapes qui ont au moins un bloc affichable, dans l'ordre. */
  const activeSteps = useMemo(
    () => steps.map((blocks, i) => ({ i, blocks })).filter(s => s.blocks.some(isRenderable)),
    [steps, isRenderable],
  )

  const currentPos = activeSteps.findIndex(s => s.i === stepIndex)
  const current = activeSteps[currentPos] ?? activeSteps[0]
  const isLast = currentPos >= activeSteps.length - 1
  const isFirst = currentPos <= 0

  // Si la logique conditionnelle vide l'étape courante, on se recale sur une étape valide
  useEffect(() => {
    if (activeSteps.length > 0 && !activeSteps.some(s => s.i === stepIndex)) {
      setStepIndex(activeSteps[0].i)
    }
  }, [activeSteps, stepIndex])

  // ─── Saisie ───

  const setAnswer = (blockId: string, value: unknown) => {
    setAnswers(prev => ({ ...prev, [blockId]: value }))
    setErrors(prev => {
      if (!prev[blockId]) return prev
      const next = { ...prev }
      delete next[blockId]
      return next
    })
  }

  /** Valide uniquement l'étape courante. */
  const validateStep = (): boolean => {
    if (!current) return true
    const stepErrors: Record<string, ValidationCode> = {}
    for (const block of current.blocks) {
      if (!isInputBlock(block.type) || !visibleIds.has(block.id)) continue
      const code = validateAnswer(block, answers[block.id])
      if (code) stepErrors[block.id] = code
    }
    setErrors(stepErrors)
    return Object.keys(stepErrors).length === 0
  }

  const goNext = () => {
    if (!validateStep()) return
    const next = activeSteps[currentPos + 1]
    if (next) {
      setStepIndex(next.i)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const goBack = () => {
    const previous = activeSteps[currentPos - 1]
    if (previous) {
      setStepIndex(previous.i)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const submit = async () => {
    if (!validateStep() || !form) return
    setSubmitting(true)
    setSubmitError(null)

    try {
      const res = await fetch(`${API_URL}?action=form-submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: form.slug,
          answers,
          meta: {
            referrer: document.referrer || null,
            utm_source: searchParams.get('utm_source'),
            utm_medium: searchParams.get('utm_medium'),
            utm_campaign: searchParams.get('utm_campaign'),
          },
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        // Le serveur revalide : on remonte ses erreurs sur les champs concernés
        if (data.errors) {
          setErrors(data.errors)
          const firstBad = Object.keys(data.errors)[0]
          const owner = steps.findIndex(blocks => blocks.some(b => b.id === firstBad))
          if (owner >= 0) setStepIndex(owner)
          setSubmitError(S.fix_errors)
        } else {
          setSubmitError(S.send_failed)
        }
        return
      }

      if (form.settings.redirect_url) {
        window.location.href = form.settings.redirect_url
        return
      }
      setDone(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setSubmitError(S.network_failed)
    } finally {
      setSubmitting(false)
    }
  }

  // ─── États de page ───

  const shell = (children: ReactNode) => (
    <div className={isEmbed ? 'min-h-screen bg-transparent' : 'min-h-screen bg-[#fbf9f8]'}>
      <div className="max-w-2xl mx-auto px-6 py-12 sm:py-20">{children}</div>
    </div>
  )

  if (loading) {
    return shell(
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-[#444748]/40" />
      </div>,
    )
  }

  if (loadError || !form) {
    return shell(
      <div className="text-center py-24">
        <h1 className="text-2xl font-['Manrope'] font-extrabold text-[#1b1c1b] mb-2">{S.oops}</h1>
        <p className="text-[#444748] font-['Inter']">{loadError}</p>
      </div>,
    )
  }

  if (done) {
    return shell(
      <div className="text-center py-20">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-8"
          style={{ backgroundColor: `${accent}1a` }}
        >
          <Check className="h-8 w-8" style={{ color: accent }} />
        </div>
        <h1 className="text-4xl font-['Manrope'] font-extrabold tracking-tight text-[#1b1c1b] mb-3">
          {form.settings.thankyou_title}
        </h1>
        <p className="text-lg text-[#444748] font-['Inter'] leading-relaxed whitespace-pre-wrap">
          {form.settings.thankyou_text}
        </p>
      </div>,
    )
  }

  const showProgress = form.settings.show_progress && activeSteps.length > 1

  return shell(
    <>
      {/* En-tête */}
      {currentPos === 0 && (
        <header className="mb-10">
          <h1 className="text-4xl sm:text-5xl font-['Manrope'] font-extrabold tracking-tight text-[#1b1c1b] leading-[1.05]">
            {form.name}
          </h1>
          {form.description && (
            <p className="mt-4 text-lg text-[#444748] font-['Inter'] leading-relaxed whitespace-pre-wrap">
              {form.description}
            </p>
          )}
        </header>
      )}

      {/* Progression */}
      {showProgress && (
        <div className="mb-10">
          <div className="h-1 rounded-full bg-[#eae8e7] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${((currentPos + 1) / activeSteps.length) * 100}%`, backgroundColor: accent }}
            />
          </div>
          <p className="mt-2 text-xs font-bold text-[#444748]/50 font-['Inter']">
            {S.step(currentPos + 1, activeSteps.length)}
          </p>
        </div>
      )}

      {/* Blocs de l'étape */}
      <div className="space-y-8">
        {current?.blocks.filter(isRenderable).map(block => (
          <BlockRenderer
            key={block.id}
            block={block}
            value={answers[block.id]}
            error={errors[block.id]}
            accent={accent}
            S={S}
            onChange={value => setAnswer(block.id, value)}
          />
        ))}
      </div>

      {submitError && (
        <div className="mt-8 flex items-start gap-3 rounded-xl bg-[#ffdad6]/40 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-[#ba1a1a] flex-shrink-0 mt-0.5" />
          <p className="text-sm text-[#ba1a1a] font-['Inter']">{submitError}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="mt-12 flex items-center gap-3">
        {!isFirst && (
          <button
            onClick={goBack}
            disabled={submitting}
            className="flex items-center gap-2 px-6 py-3.5 rounded-full font-['Manrope'] font-bold text-sm text-[#444748] hover:bg-[#f5f3f2] transition-colors disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" /> {S.back}
          </button>
        )}
        <button
          onClick={isLast ? submit : goNext}
          disabled={submitting}
          className="flex items-center gap-2 px-8 py-3.5 rounded-full text-white font-['Manrope'] font-bold text-sm transition-all active:scale-95 disabled:opacity-60"
          style={{ backgroundColor: accent }}
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> {S.sending}
            </>
          ) : isLast ? (
            form.settings.submit_label || S.submit
          ) : (
            <>
              {S.next} <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>

      {!isEmbed && (
        <p className="mt-16 text-center text-xs text-[#444748]/40 font-['Inter']">
          {S.powered_by}{' '}
          <a href="https://closeos.fr" target="_blank" rel="noopener noreferrer" className="font-bold hover:underline">
            CloseOS
          </a>
        </p>
      )}
    </>,
  )
}

// ─── Rendu d'un bloc ───

function BlockRenderer({
  block, value, error, accent, S, onChange,
}: {
  block: FormBlock
  value: unknown
  error?: ValidationCode
  accent: string
  S: typeof STRINGS['fr']
  onChange: (value: unknown) => void
}) {
  // Blocs de contenu
  switch (block.type) {
    case 'heading':
      return <h2 className="text-3xl font-['Manrope'] font-extrabold tracking-tight text-[#1b1c1b] pt-4">{block.text}</h2>
    case 'subheading':
      return <h3 className="text-xl font-['Manrope'] font-bold text-[#1b1c1b] pt-2">{block.text}</h3>
    case 'paragraph':
      return <p className="text-base text-[#444748] font-['Inter'] leading-relaxed whitespace-pre-wrap">{block.text}</p>
    case 'divider':
      return <hr className="border-[#c4c7c7]/40" />
    case 'image':
      return block.url ? <img src={block.url} alt="" className="w-full rounded-2xl" /> : null
    case 'page_break':
      return null
  }

  // La vidéo gère son propre agencement (pas de libellé « question » au-dessus)
  if (block.type === 'video') {
    return <VideoPlayerBlock block={block} value={value} error={error} accent={accent} S={S} onChange={onChange} />
  }

  // Blocs de saisie
  const inputBase =
    'w-full rounded-xl border bg-white px-4 py-3.5 text-base text-[#1b1c1b] font-[\'Inter\'] placeholder:text-[#444748]/30 outline-none transition-colors'
  const borderClass = error ? 'border-[#ba1a1a]' : 'border-[#c4c7c7]/40 focus:border-[#1b1c1b]'

  return (
    <div>
      <label className="block text-base font-['Manrope'] font-bold text-[#1b1c1b] mb-1">
        {block.text}
        {block.required && <span className="text-[#ba1a1a] ml-1">*</span>}
      </label>
      {block.description && (
        <p className="text-sm text-[#444748]/70 font-['Inter'] mb-3">{block.description}</p>
      )}
      {!block.description && <div className="mb-3" />}

      {(() => {
        switch (block.type) {
          case 'long_text':
            return (
              <textarea
                rows={4}
                value={(value as string) || ''}
                onChange={e => onChange(e.target.value)}
                placeholder={block.placeholder}
                className={`${inputBase} ${borderClass} resize-y`}
              />
            )

          case 'phone':
            return (
              <PhoneInput
                value={(value as string) || ''}
                onChange={onChange}
                inputClassName={`${inputBase} ${borderClass}`}
              />
            )

          case 'select':
            return (
              <select
                value={(value as string) || ''}
                onChange={e => onChange(e.target.value)}
                className={`${inputBase} ${borderClass} appearance-none`}
              >
                <option value="">{S.choose}</option>
                {(block.options || []).map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            )

          case 'single_choice':
          case 'yes_no': {
            // Oui/Non : le libellé suit la langue du visiteur, la valeur stockée reste canonique
            const options =
              block.type === 'yes_no'
                ? YES_NO_VALUES.map((v, i) => ({ value: v, label: i === 0 ? S.yes : S.no }))
                : (block.options || []).map(o => ({ value: o, label: o }))
            return (
              <div className="space-y-2">
                {options.map(({ value: opt, label }) => {
                  const active = value === opt
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => onChange(opt)}
                      className="w-full flex items-center gap-3 rounded-xl border bg-white px-4 py-3.5 text-left transition-all"
                      style={{
                        borderColor: active ? accent : 'rgba(196,199,199,0.4)',
                        backgroundColor: active ? `${accent}0d` : '#ffffff',
                      }}
                    >
                      <span
                        className="h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                        style={{ borderColor: active ? accent : 'rgba(196,199,199,0.8)' }}
                      >
                        {active && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />}
                      </span>
                      <span className="text-base text-[#1b1c1b] font-['Inter']">{label}</span>
                    </button>
                  )
                })}
              </div>
            )
          }

          case 'multiple_choice': {
            const selected = Array.isArray(value) ? (value as string[]) : []
            return (
              <div className="space-y-2">
                {(block.options || []).map(opt => {
                  const active = selected.includes(opt)
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() =>
                        onChange(active ? selected.filter(v => v !== opt) : [...selected, opt])
                      }
                      className="w-full flex items-center gap-3 rounded-xl border bg-white px-4 py-3.5 text-left transition-all"
                      style={{
                        borderColor: active ? accent : 'rgba(196,199,199,0.4)',
                        backgroundColor: active ? `${accent}0d` : '#ffffff',
                      }}
                    >
                      <span
                        className="h-4 w-4 rounded border-2 flex items-center justify-center flex-shrink-0"
                        style={{
                          borderColor: active ? accent : 'rgba(196,199,199,0.8)',
                          backgroundColor: active ? accent : 'transparent',
                        }}
                      >
                        {active && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                      </span>
                      <span className="text-base text-[#1b1c1b] font-['Inter']">{opt}</span>
                    </button>
                  )
                })}
              </div>
            )
          }

          case 'rating': {
            const count = block.max || 5
            const currentValue = Number(value) || 0
            return (
              <div className="flex gap-1.5">
                {Array.from({ length: count }).map((_, i) => {
                  const filled = i < currentValue
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onChange(i + 1 === currentValue ? '' : i + 1)}
                      className="p-1 transition-transform hover:scale-110"
                      aria-label={`${i + 1}`}
                    >
                      <Star
                        className="h-8 w-8"
                        style={{ color: filled ? accent : '#c4c7c7' }}
                        fill={filled ? accent : 'none'}
                      />
                    </button>
                  )
                })}
              </div>
            )
          }

          case 'linear_scale': {
            const min = block.min ?? 1
            const max = block.max ?? 10
            const range = Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => min + i)
            return (
              <div>
                <div className="flex flex-wrap gap-2">
                  {range.map(n => {
                    const active = Number(value) === n
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => onChange(active ? '' : n)}
                        className="h-11 w-11 rounded-xl border text-sm font-bold font-['Inter'] transition-all"
                        style={{
                          borderColor: active ? accent : 'rgba(196,199,199,0.4)',
                          backgroundColor: active ? accent : '#ffffff',
                          color: active ? '#ffffff' : '#1b1c1b',
                        }}
                      >
                        {n}
                      </button>
                    )
                  })}
                </div>
                {(block.min_label || block.max_label) && (
                  <div className="flex justify-between mt-2 text-xs text-[#444748]/60 font-['Inter']">
                    <span>{block.min_label}</span>
                    <span>{block.max_label}</span>
                  </div>
                )}
              </div>
            )
          }

          case 'date':
            return (
              <input
                type="date"
                value={(value as string) || ''}
                onChange={e => onChange(e.target.value)}
                className={`${inputBase} ${borderClass}`}
              />
            )

          case 'number':
            return (
              <input
                type="number"
                value={(value as string) ?? ''}
                onChange={e => onChange(e.target.value)}
                placeholder={block.placeholder}
                className={`${inputBase} ${borderClass}`}
              />
            )

          case 'email':
            return (
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={(value as string) || ''}
                onChange={e => onChange(e.target.value)}
                placeholder={block.placeholder || 'nom@exemple.com'}
                className={`${inputBase} ${borderClass}`}
              />
            )

          case 'url':
            return (
              <input
                type="url"
                inputMode="url"
                value={(value as string) || ''}
                onChange={e => onChange(e.target.value)}
                placeholder={block.placeholder || 'https://…'}
                className={`${inputBase} ${borderClass}`}
              />
            )

          default:
            return (
              <input
                type="text"
                value={(value as string) || ''}
                onChange={e => onChange(e.target.value)}
                placeholder={block.placeholder}
                className={`${inputBase} ${borderClass}`}
              />
            )
        }
      })()}

      {error && (
        <p className="mt-2 text-sm text-[#ba1a1a] font-['Inter']">{S.errors[error]}</p>
      )}
    </div>
  )
}

// ─── Bloc vidéo ───

/**
 * Le lecteur est masqué par notre propre bouton de lancement : impossible de
 * détecter le « play » dans un iframe YouTube/Vimeo/Drive sans charger leur SDK,
 * donc c'est ce bouton qui arme à la fois la lecture et le compteur.
 * Le compteur se met en pause quand l'onglet passe en arrière-plan.
 */
function VideoPlayerBlock({
  block, value, error, accent, S, onChange,
}: {
  block: FormBlock
  value: unknown
  error?: ValidationCode
  accent: string
  S: typeof STRINGS['fr']
  onChange: (value: unknown) => void
}) {
  const video = useMemo(() => parseVideoUrl(block.url), [block.url])
  const needed = requiredWatchSeconds(block)

  const [started, setStarted] = useState(false)
  const [playing, setPlaying] = useState(true)
  const [elapsed, setElapsed] = useState(() => (Number(value) > 0 ? Math.floor(Number(value)) : 0))

  // onChange change d'identité à chaque rendu du parent : on le fige dans une ref
  // pour que la synchronisation ne dépende que de `elapsed`.
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange })
  useEffect(() => { onChangeRef.current(elapsed) }, [elapsed])

  useEffect(() => {
    if (!started || needed === 0) return
    const id = setInterval(() => {
      if (document.hidden || !playing) return
      setElapsed(previous => (previous >= needed ? previous : previous + 1))
    }, 1000)
    return () => clearInterval(id)
  }, [started, playing, needed])

  const remaining = Math.max(0, needed - elapsed)
  const satisfied = needed === 0 || remaining === 0

  if (!video) {
    return (
      <div>
        {block.text && (
          <p className="text-base font-['Manrope'] font-bold text-[#1b1c1b] mb-3">{block.text}</p>
        )}
        <div className="rounded-2xl bg-[#f5f3f2] px-4 py-8 text-center text-sm text-[#444748]/60 font-['Inter']">
          {S.video_missing}
        </div>
      </div>
    )
  }

  return (
    <div>
      {block.text && (
        <p className="text-base font-['Manrope'] font-bold text-[#1b1c1b] mb-1">{block.text}</p>
      )}
      {block.description && (
        <p className="text-sm text-[#444748]/70 font-['Inter'] mb-3">{block.description}</p>
      )}

      <div className="relative rounded-2xl overflow-hidden bg-black aspect-video">
        {started ? (
          video.provider === 'file' ? (
            <video
              src={video.src}
              controls
              autoPlay
              playsInline
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              className="w-full h-full"
            />
          ) : (
            <iframe
              src={videoSrcWithAutoplay(video)}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={block.text || 'Vidéo'}
            />
          )
        ) : (
          <button
            type="button"
            onClick={() => { setStarted(true); setPlaying(true) }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 hover:bg-black/70 transition-colors group"
          >
            <span
              className="w-16 h-16 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
              style={{ backgroundColor: accent }}
            >
              <Play className="h-7 w-7 text-white ml-1" fill="currentColor" />
            </span>
            <span className="text-sm font-['Manrope'] font-bold text-white">{S.play_video}</span>
          </button>
        )}
      </div>

      {/* Progression du visionnage exigé */}
      {needed > 0 && (
        <div className="mt-3">
          <div className="h-1 rounded-full bg-[#eae8e7] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${Math.min(100, (elapsed / needed) * 100)}%`, backgroundColor: accent }}
            />
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs font-['Inter']">
            {satisfied ? (
              <>
                <Check className="h-3.5 w-3.5" style={{ color: accent }} />
                <span style={{ color: accent }} className="font-bold">{S.watch_done}</span>
              </>
            ) : (
              <>
                <Lock className="h-3.5 w-3.5 text-[#444748]/50" />
                <span className="text-[#444748]/70">{S.watch_remaining(remaining)}</span>
              </>
            )}
          </p>
        </div>
      )}

      {error && (
        <p className="mt-2 text-sm text-[#ba1a1a] font-['Inter']">{S.errors[error]}</p>
      )}
    </div>
  )
}
