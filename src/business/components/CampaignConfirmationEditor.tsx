import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { Plus, Trash2, ChevronUp, ChevronDown, Video, MousePointerClick, ClipboardList, Palette, Type, ExternalLink, Layers, GripVertical } from 'lucide-react'
import { CampaignConfirmationPage } from '../../components/CampaignConfirmationPage'
import {
  type ConfirmationPageConfig, type ConfirmationButton, type ConfirmationVideoSection, type ConfirmationVideo, type ConfirmationQuestion, type ConfirmationQuestionType,
  CONFIRMATION_BG_PRESETS, CONFIRMATION_ACCENT_PRESETS, newId, isDarkColor,
} from '../../lib/confirmationPage'

interface Props {
  value: ConfirmationPageConfig
  onChange: (next: ConfirmationPageConfig) => void
  lang: 'fr' | 'en'
  inscription: boolean
}

const inputCls = "w-full rounded-xl bg-[#f5f3f2] dark:bg-neutral-800 border-0 px-4 py-2.5 text-sm text-[#1b1c1b] dark:text-white placeholder:text-[#444748]/40 dark:placeholder:text-neutral-500 focus:ring-1 focus:ring-[#006c49]/20 outline-none"
const labelCls = 'block text-xs font-bold text-[#444748] dark:text-neutral-400 mb-2'
const sectionCls = 'rounded-xl border border-[#c4c7c7]/20 dark:border-neutral-700 p-5 space-y-4'

function move<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir
  if (j < 0 || j >= arr.length) return arr
  const next = [...arr]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-3" aria-pressed={on}>
      <span className={`w-10 h-5 rounded-full relative transition-colors ${on ? 'bg-[#006c49]' : 'bg-[#c4c7c7]/50 dark:bg-neutral-700'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
      <span className="text-sm font-bold text-[#1b1c1b] dark:text-white">{label}</span>
    </button>
  )
}

function ColorField({ label, value, presets, onChange }: { label: string; value: string; presets: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="flex flex-wrap items-center gap-2">
        {presets.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={`h-7 w-7 rounded-full border transition-transform hover:scale-110 ${value.toLowerCase() === c ? 'ring-2 ring-offset-2 ring-[#006c49] dark:ring-offset-neutral-900' : ''}`}
            style={{ backgroundColor: c, borderColor: 'rgba(0,0,0,0.12)' }}
            aria-label={c}
          />
        ))}
        <label className="relative h-7 w-7 rounded-full border border-dashed border-[#c4c7c7] dark:border-neutral-600 overflow-hidden cursor-pointer" title="Couleur personnalisée">
          <input type="color" value={value} onChange={e => onChange(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
          <span className="absolute inset-1 rounded-full" style={{ backgroundColor: value }} />
        </label>
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-24 rounded-lg bg-[#f5f3f2] dark:bg-neutral-800 px-2 py-1 text-xs font-mono text-[#1b1c1b] dark:text-white outline-none"
        />
      </div>
    </div>
  )
}

/** Onglet « Confirmation » de la modale campagne : réglages à gauche, aperçu en direct à droite. */
export function CampaignConfirmationEditor({ value, onChange, lang, inscription }: Props) {
  const fr = lang === 'fr'
  const set = (patch: Partial<ConfirmationPageConfig>) => onChange({ ...value, ...patch })
  const setQ = (patch: Partial<ConfirmationPageConfig['questionnaire']>) => set({ questionnaire: { ...value.questionnaire, ...patch } })

  const updateButton = (id: string, patch: Partial<ConfirmationButton>) =>
    set({ buttons: value.buttons.map(b => (b.id === id ? { ...b, ...patch } : b)) })
  const addButton = () => set({
    buttons: [...value.buttons, {
      id: newId(), label: '', url: '', new_tab: true,
      bg_color: value.accent_color || '#111111',
      text_color: isDarkColor(value.accent_color || '#111111') ? '#ffffff' : '#111111',
    }],
  })

  const onBlockDragEnd = (r: DropResult) => {
    if (!r.destination || r.destination.index === r.source.index) return
    const order = [...value.block_order]
    const [moved] = order.splice(r.source.index, 1)
    order.splice(r.destination.index, 0, moved)
    set({ block_order: order })
  }

  const updateSection = (id: string, patch: Partial<ConfirmationVideoSection>) =>
    set({ sections: value.sections.map(sec => (sec.id === id ? { ...sec, ...patch } : sec)) })
  const addSection = () => set({
    sections: [...value.sections, { id: newId(), title: fr ? 'Éducation' : 'Education', videos: [{ id: newId(), url: '', title: '' }] }],
  })
  const updateVideo = (sec: ConfirmationVideoSection, vid: string, patch: Partial<ConfirmationVideo>) =>
    updateSection(sec.id, { videos: sec.videos.map(v => (v.id === vid ? { ...v, ...patch } : v)) })

  const updateQuestion = (id: string, patch: Partial<ConfirmationQuestion>) =>
    setQ({ questions: value.questionnaire.questions.map(q => (q.id === id ? { ...q, ...patch } : q)) })
  const addQuestion = () => setQ({
    questions: [...value.questionnaire.questions, { id: newId(), label: '', type: 'text', options: [], required: false }],
  })

  const QUESTION_TYPES: { v: ConfirmationQuestionType; l: string }[] = [
    { v: 'text', l: fr ? 'Texte court' : 'Short text' },
    { v: 'textarea', l: fr ? 'Texte long' : 'Long text' },
    { v: 'yes_no', l: fr ? 'Oui / Non' : 'Yes / No' },
    { v: 'select', l: fr ? 'Choix unique' : 'Single choice' },
    { v: 'multiple_choice', l: fr ? 'Choix multiples' : 'Multiple choice' },
  ]

  const defaultTitle = fr ? (inscription ? 'Inscription confirmée !' : 'Rendez-vous confirmé !') : (inscription ? 'Registration confirmed!' : 'Appointment confirmed!')
  const defaultMessage = fr
    ? (inscription ? 'Merci pour votre inscription, nous revenons vers vous très vite.' : 'Votre rendez-vous est bien enregistré. Vous allez recevoir un email de confirmation.')
    : (inscription ? 'Thanks for signing up, we will get back to you shortly.' : 'Your appointment is booked. You will receive a confirmation email.')

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-[#f5f3f2]/60 dark:bg-neutral-800/50 p-5 border border-[#c4c7c7]/10 dark:border-neutral-700">
        <Toggle on={value.enabled} onClick={() => set({ enabled: !value.enabled })} label={fr ? 'Personnaliser la page de confirmation' : 'Customize the confirmation page'} />
        <p className="text-xs text-[#444748]/70 dark:text-neutral-500 mt-2">
          {fr
            ? `Page affichée juste après ${inscription ? "l'inscription" : 'la prise de rendez-vous'}. Désactivée, la page standard est utilisée.`
            : `Shown right after ${inscription ? 'sign-up' : 'booking'}. When off, the standard page is used.`}
        </p>
      </div>

      {value.enabled && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* ── Réglages ── */}
          <div className="space-y-5 min-w-0">
            <div className={sectionCls}>
              <p className="flex items-center gap-2 text-sm font-bold text-[#1b1c1b] dark:text-white"><Type className="h-4 w-4" /> {fr ? 'Contenu' : 'Content'}</p>
              <div>
                <label className={labelCls}>{fr ? 'Titre de la page' : 'Page title'}</label>
                <input className={inputCls} value={value.title} placeholder={defaultTitle} onChange={e => set({ title: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>{fr ? 'Message' : 'Message'}</label>
                <textarea rows={3} className={`${inputCls} resize-y`} value={value.message} placeholder={defaultMessage} onChange={e => set({ message: e.target.value })} />
              </div>
              {!inscription && (
                <Toggle on={value.show_recap} onClick={() => set({ show_recap: !value.show_recap })} label={fr ? 'Afficher la date et l’heure du rendez-vous' : 'Show appointment date & time'} />
              )}
            </div>

            <div className={sectionCls}>
              <p className="flex items-center gap-2 text-sm font-bold text-[#1b1c1b] dark:text-white"><Palette className="h-4 w-4" /> {fr ? 'Couleurs' : 'Colors'}</p>
              <ColorField label={fr ? 'Fond de la page' : 'Page background'} value={value.bg_color} presets={CONFIRMATION_BG_PRESETS} onChange={v => set({ bg_color: v })} />
              <ColorField label={fr ? 'Couleur principale (icône, questionnaire)' : 'Accent color (icon, questionnaire)'} value={value.accent_color} presets={CONFIRMATION_ACCENT_PRESETS} onChange={v => set({ accent_color: v })} />
            </div>

            <div className={sectionCls}>
              <p className="flex items-center gap-2 text-sm font-bold text-[#1b1c1b] dark:text-white"><Video className="h-4 w-4" /> {fr ? 'Vidéo de confirmation' : 'Confirmation video'}</p>
              <div>
                <label className={labelCls}>{fr ? 'Lien de la vidéo' : 'Video link'}</label>
                <input className={inputCls} value={value.video_url} placeholder="https://www.youtube.com/watch?v=…" onChange={e => set({ video_url: e.target.value })} />
                <p className="text-[11px] text-[#444748]/60 dark:text-neutral-500 mt-1">YouTube, Loom, Vimeo, Wistia</p>
              </div>
              {value.video_url && (
                <div>
                  <label className={labelCls}>{fr ? 'Titre au-dessus de la vidéo (optionnel)' : 'Title above the video (optional)'}</label>
                  <input className={inputCls} value={value.video_title} placeholder={fr ? 'Regardez cette vidéo avant notre appel' : 'Watch this before our call'} onChange={e => set({ video_title: e.target.value })} />
                </div>
              )}
            </div>

            <DragDropContext onDragEnd={onBlockDragEnd}>
              <Droppable droppableId="confirmation-blocks">
                {drop => (
                  <div ref={drop.innerRef} {...drop.droppableProps} className="space-y-5">
                    {value.block_order.map((key, index) => (
                      <Draggable key={key} draggableId={key} index={index}>
                        {(drag, snap) => (
                          <div
                            ref={drag.innerRef}
                            {...drag.draggableProps}
                            className={`${sectionCls} relative !pl-12 bg-white dark:bg-neutral-900 transition-shadow ${snap.isDragging ? 'shadow-2xl ring-1 ring-[#006c49]/30' : ''}`}
                          >
                            <div
                              {...drag.dragHandleProps}
                              className="absolute left-0 inset-y-0 w-9 flex items-center justify-center rounded-l-xl cursor-grab active:cursor-grabbing text-[#444748]/35 dark:text-neutral-500 hover:text-[#444748] dark:hover:text-neutral-300 hover:bg-[#f5f3f2] dark:hover:bg-neutral-800 border-r border-[#c4c7c7]/15 dark:border-neutral-700 transition-colors"
                              aria-label={fr ? 'Glisser pour réorganiser' : 'Drag to reorder'}
                              title={fr ? 'Glisser pour réorganiser' : 'Drag to reorder'}
                            >
                              <GripVertical className="h-4 w-4" />
                            </div>
                            {key === 'sections' && (
                              <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-bold text-[#1b1c1b] dark:text-white"><Layers className="h-4 w-4" /> {fr ? 'Sections de vidéos' : 'Video sections'}</p>
                <button type="button" onClick={addSection} className="flex items-center gap-1 text-xs font-bold text-[#006c49] hover:underline">
                  <Plus className="h-3.5 w-3.5" /> {fr ? 'Ajouter une section' : 'Add a section'}
                </button>
              </div>
              {value.sections.length === 0 && (
                <p className="text-xs text-[#444748]/60 dark:text-neutral-500">{fr ? 'Ex : une section « Éducation » avec plusieurs vidéos à regarder avant le rendez-vous.' : 'E.g. an “Education” section with several videos to watch before the call.'}</p>
              )}
              {value.sections.map((sec, si) => (
                <div key={sec.id} className="rounded-xl bg-[#f5f3f2]/60 dark:bg-neutral-800/60 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      className={`${inputCls} font-bold bg-white dark:bg-neutral-900`}
                      value={sec.title}
                      placeholder={fr ? 'Nom de la section' : 'Section name'}
                      onChange={e => updateSection(sec.id, { title: e.target.value })}
                    />
                    <button type="button" onClick={() => set({ sections: move(value.sections, si, -1) })} disabled={si === 0} className="p-1 rounded text-[#444748] dark:text-neutral-400 disabled:opacity-30 hover:bg-white dark:hover:bg-neutral-700" aria-label="Monter"><ChevronUp className="h-4 w-4" /></button>
                    <button type="button" onClick={() => set({ sections: move(value.sections, si, 1) })} disabled={si === value.sections.length - 1} className="p-1 rounded text-[#444748] dark:text-neutral-400 disabled:opacity-30 hover:bg-white dark:hover:bg-neutral-700" aria-label="Descendre"><ChevronDown className="h-4 w-4" /></button>
                    <button type="button" onClick={() => set({ sections: value.sections.filter(x => x.id !== sec.id) })} className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10" aria-label="Supprimer la section"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  {sec.videos.map((v, vi) => (
                    <div key={v.id} className="rounded-lg bg-white dark:bg-neutral-900 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#444748]/60 dark:text-neutral-500">{fr ? 'Vidéo' : 'Video'} {vi + 1}</span>
                        <div className="ml-auto flex items-center gap-1">
                          <button type="button" onClick={() => updateSection(sec.id, { videos: move(sec.videos, vi, -1) })} disabled={vi === 0} className="p-1 rounded text-[#444748] dark:text-neutral-400 disabled:opacity-30 hover:bg-[#f5f3f2] dark:hover:bg-neutral-700" aria-label="Monter"><ChevronUp className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={() => updateSection(sec.id, { videos: move(sec.videos, vi, 1) })} disabled={vi === sec.videos.length - 1} className="p-1 rounded text-[#444748] dark:text-neutral-400 disabled:opacity-30 hover:bg-[#f5f3f2] dark:hover:bg-neutral-700" aria-label="Descendre"><ChevronDown className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={() => updateSection(sec.id, { videos: sec.videos.filter(x => x.id !== v.id) })} className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10" aria-label="Supprimer la vidéo"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                      <input className={inputCls} value={v.title} placeholder={fr ? 'Titre de la vidéo' : 'Video title'} onChange={e => updateVideo(sec, v.id, { title: e.target.value })} />
                      <input className={inputCls} value={v.url} placeholder="https://www.youtube.com/watch?v=…" onChange={e => updateVideo(sec, v.id, { url: e.target.value })} />
                    </div>
                  ))}
                  <button type="button" onClick={() => updateSection(sec.id, { videos: [...sec.videos, { id: newId(), url: '', title: '' }] })} className="flex items-center gap-1 text-xs font-bold text-[#006c49] hover:underline">
                    <Plus className="h-3.5 w-3.5" /> {fr ? 'Ajouter une vidéo' : 'Add a video'}
                  </button>
                </div>
              ))}
                              </div>
                            )}
                            {key === 'buttons' && (
                              <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-bold text-[#1b1c1b] dark:text-white"><MousePointerClick className="h-4 w-4" /> {fr ? 'Boutons' : 'Buttons'}</p>
                <button type="button" onClick={addButton} className="flex items-center gap-1 text-xs font-bold text-[#006c49] hover:underline">
                  <Plus className="h-3.5 w-3.5" /> {fr ? 'Ajouter un bouton' : 'Add a button'}
                </button>
              </div>
              {value.buttons.length === 0 && (
                <p className="text-xs text-[#444748]/60 dark:text-neutral-500">{fr ? 'Aucun bouton. Ex : « Rejoindre le groupe WhatsApp », « Voir nos témoignages »…' : 'No buttons yet. E.g. “Join the WhatsApp group”, “See testimonials”…'}</p>
              )}
              {value.buttons.map((b, i) => (
                <div key={b.id} className="rounded-xl bg-[#f5f3f2]/60 dark:bg-neutral-800/60 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#444748]/60 dark:text-neutral-500">{fr ? 'Bouton' : 'Button'} {i + 1}</span>
                    <div className="ml-auto flex items-center gap-1">
                      <button type="button" onClick={() => set({ buttons: move(value.buttons, i, -1) })} disabled={i === 0} className="p-1 rounded text-[#444748] dark:text-neutral-400 disabled:opacity-30 hover:bg-white dark:hover:bg-neutral-700" aria-label="Monter"><ChevronUp className="h-4 w-4" /></button>
                      <button type="button" onClick={() => set({ buttons: move(value.buttons, i, 1) })} disabled={i === value.buttons.length - 1} className="p-1 rounded text-[#444748] dark:text-neutral-400 disabled:opacity-30 hover:bg-white dark:hover:bg-neutral-700" aria-label="Descendre"><ChevronDown className="h-4 w-4" /></button>
                      <button type="button" onClick={() => set({ buttons: value.buttons.filter(x => x.id !== b.id) })} className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10" aria-label="Supprimer"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <input className={inputCls} value={b.label} placeholder={fr ? 'Texte du bouton' : 'Button text'} onChange={e => updateButton(b.id, { label: e.target.value })} />
                  <input className={inputCls} value={b.url} placeholder="https://…" onChange={e => updateButton(b.id, { url: e.target.value })} />
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 text-xs font-bold text-[#444748] dark:text-neutral-400">
                      <input type="color" value={b.bg_color} onChange={e => updateButton(b.id, { bg_color: e.target.value })} className="h-7 w-9 rounded cursor-pointer border-0 bg-transparent" />
                      {fr ? 'Fond' : 'Background'}
                    </label>
                    <label className="flex items-center gap-2 text-xs font-bold text-[#444748] dark:text-neutral-400">
                      <input type="color" value={b.text_color} onChange={e => updateButton(b.id, { text_color: e.target.value })} className="h-7 w-9 rounded cursor-pointer border-0 bg-transparent" />
                      {fr ? 'Texte' : 'Text'}
                    </label>
                    <label className="flex items-center gap-2 text-xs font-bold text-[#444748] dark:text-neutral-400 cursor-pointer">
                      <input type="checkbox" checked={b.new_tab} onChange={e => updateButton(b.id, { new_tab: e.target.checked })} className="rounded" />
                      <ExternalLink className="h-3.5 w-3.5" /> {fr ? 'Nouvel onglet' : 'New tab'}
                    </label>
                  </div>
                </div>
              ))}
                              </div>
                            )}
                            {key === 'questionnaire' && (
                              <div className="space-y-4">
              <Toggle on={value.questionnaire.enabled} onClick={() => setQ({ enabled: !value.questionnaire.enabled })} label={fr ? (inscription ? 'Questionnaire complémentaire' : 'Questionnaire avant rendez-vous') : (inscription ? 'Follow-up questionnaire' : 'Pre-meeting questionnaire')} />
              <p className="text-xs text-[#444748]/60 dark:text-neutral-500 -mt-2">
                {fr ? 'Les réponses arrivent sur la fiche du prospect.' : "Answers are saved on the prospect's record."}
              </p>
              {value.questionnaire.enabled && (
                <>
                  <div>
                    <label className={labelCls}>{fr ? 'Titre du questionnaire' : 'Questionnaire title'}</label>
                    <input className={inputCls} value={value.questionnaire.title} placeholder={fr ? 'Avant notre rendez-vous' : 'Before our meeting'} onChange={e => setQ({ title: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>{fr ? 'Introduction (optionnel)' : 'Intro (optional)'}</label>
                    <textarea rows={2} className={`${inputCls} resize-y`} value={value.questionnaire.intro} placeholder={fr ? 'Quelques questions pour préparer au mieux notre échange.' : 'A few questions to prepare our call.'} onChange={e => setQ({ intro: e.target.value })} />
                  </div>

                  {value.questionnaire.questions.map((q, i) => (
                    <div key={q.id} className="rounded-xl bg-[#f5f3f2]/60 dark:bg-neutral-800/60 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#444748]/60 dark:text-neutral-500">Question {i + 1}</span>
                        <div className="ml-auto flex items-center gap-1">
                          <button type="button" onClick={() => setQ({ questions: move(value.questionnaire.questions, i, -1) })} disabled={i === 0} className="p-1 rounded text-[#444748] dark:text-neutral-400 disabled:opacity-30 hover:bg-white dark:hover:bg-neutral-700" aria-label="Monter"><ChevronUp className="h-4 w-4" /></button>
                          <button type="button" onClick={() => setQ({ questions: move(value.questionnaire.questions, i, 1) })} disabled={i === value.questionnaire.questions.length - 1} className="p-1 rounded text-[#444748] dark:text-neutral-400 disabled:opacity-30 hover:bg-white dark:hover:bg-neutral-700" aria-label="Descendre"><ChevronDown className="h-4 w-4" /></button>
                          <button type="button" onClick={() => setQ({ questions: value.questionnaire.questions.filter(x => x.id !== q.id) })} className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10" aria-label="Supprimer"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </div>
                      <input className={inputCls} value={q.label} placeholder={fr ? 'Ex : Quel est votre objectif principal ?' : 'E.g. What is your main goal?'} onChange={e => updateQuestion(q.id, { label: e.target.value })} />
                      <div className="flex flex-wrap items-center gap-3">
                        <select value={q.type} onChange={e => updateQuestion(q.id, { type: e.target.value as ConfirmationQuestionType })} className={`${inputCls} w-auto`}>
                          {QUESTION_TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                        </select>
                        <label className="flex items-center gap-2 text-xs font-bold text-[#444748] dark:text-neutral-400 cursor-pointer">
                          <input type="checkbox" checked={q.required} onChange={e => updateQuestion(q.id, { required: e.target.checked })} className="rounded" />
                          {fr ? 'Obligatoire' : 'Required'}
                        </label>
                      </div>
                      {(q.type === 'select' || q.type === 'multiple_choice') && (
                        <div className="space-y-2">
                          {q.options.map((opt, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <input
                                className={inputCls}
                                value={opt}
                                placeholder={`Option ${oi + 1}`}
                                onChange={e => updateQuestion(q.id, { options: q.options.map((o, k) => (k === oi ? e.target.value : o)) })}
                              />
                              <button type="button" onClick={() => updateQuestion(q.id, { options: q.options.filter((_, k) => k !== oi) })} className="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10" aria-label="Supprimer l'option"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          ))}
                          <button type="button" onClick={() => updateQuestion(q.id, { options: [...q.options, ''] })} className="flex items-center gap-1 text-xs font-bold text-[#006c49] hover:underline">
                            <Plus className="h-3.5 w-3.5" /> {fr ? 'Ajouter une option' : 'Add an option'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={addQuestion} className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#c4c7c7]/60 dark:border-neutral-600 py-3 text-sm font-bold text-[#444748] dark:text-neutral-300 hover:border-[#006c49] hover:text-[#006c49] transition-colors">
                    <ClipboardList className="h-4 w-4" /> {fr ? 'Ajouter une question' : 'Add a question'}
                  </button>
                </>
              )}
                              </div>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {drop.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>

          {/* ── Aperçu en direct ── */}
          <div className="min-w-0">
            <div className="lg:sticky lg:top-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#747878] dark:text-neutral-500 mb-2">{fr ? 'Aperçu' : 'Preview'}</p>
              <div className="rounded-2xl overflow-hidden border border-[#c4c7c7]/30 dark:border-neutral-700 max-h-[70vh] overflow-y-auto">
                <CampaignConfirmationPage
                  preview
                  config={value}
                  lang={lang}
                  inscription={inscription}
                  defaultTitle={defaultTitle}
                  defaultMessage={defaultMessage}
                  recap={{ label: fr ? 'Rendez-vous confirmé' : 'Appointment confirmed', detail: fr ? 'jeudi 15 octobre 2026 à 14:00' : 'Thursday, October 15, 2026 at 2:00 PM' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
