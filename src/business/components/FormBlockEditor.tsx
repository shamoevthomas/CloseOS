import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import {
  Type, AlignLeft, Mail, Phone, Hash, Link2, Calendar, ChevronDownCircle,
  CircleDot, CheckSquare, Star, SlidersHorizontal, ToggleLeft, EyeOff,
  Heading1, Heading2, Minus, Image as ImageIcon, FileText, GripVertical,
  Plus, Trash2, Copy, Settings2, GitBranch, X, Asterisk, Video, Play, AlertTriangle,
} from 'lucide-react'
import {
  createBlock, newBlockId, isInputBlock, hasOptions, isEligibleSourceType, parseVideoUrl,
  type FormBlock, type FormBlockType, type FormConditionalRule, type FormConditionalOperator,
} from '../../lib/formBlocks'
import { cn } from '../../lib/utils'

// ─── Catalogue des blocs (palette « / ») ───

interface LibraryEntry {
  type: FormBlockType
  label: string
  hint: string
  icon: typeof Type
  group: 'fields' | 'choices' | 'layout'
  keywords: string
}

const LIBRARY: LibraryEntry[] = [
  // Champs
  { type: 'short_text', label: 'Texte court', hint: 'Une ligne', icon: Type, group: 'fields', keywords: 'texte court ligne nom prenom short text' },
  { type: 'long_text', label: 'Texte long', hint: 'Paragraphe', icon: AlignLeft, group: 'fields', keywords: 'texte long paragraphe message commentaire long' },
  { type: 'email', label: 'Email', hint: 'Adresse email validée', icon: Mail, group: 'fields', keywords: 'email mail adresse courriel' },
  { type: 'phone', label: 'Téléphone', hint: 'Numéro validé', icon: Phone, group: 'fields', keywords: 'telephone tel phone numero mobile' },
  { type: 'number', label: 'Nombre', hint: 'Valeur numérique', icon: Hash, group: 'fields', keywords: 'nombre number chiffre numerique budget' },
  { type: 'url', label: 'Lien', hint: 'URL validée', icon: Link2, group: 'fields', keywords: 'lien url site web link' },
  { type: 'date', label: 'Date', hint: 'Sélecteur de date', icon: Calendar, group: 'fields', keywords: 'date jour calendrier' },
  // Choix
  { type: 'single_choice', label: 'Choix unique', hint: 'Boutons radio', icon: CircleDot, group: 'choices', keywords: 'choix unique radio option single' },
  { type: 'multiple_choice', label: 'Choix multiple', hint: 'Cases à cocher', icon: CheckSquare, group: 'choices', keywords: 'choix multiple cases cocher checkbox' },
  { type: 'select', label: 'Liste déroulante', hint: 'Menu déroulant', icon: ChevronDownCircle, group: 'choices', keywords: 'liste deroulante select dropdown menu' },
  { type: 'yes_no', label: 'Oui / Non', hint: 'Deux options', icon: ToggleLeft, group: 'choices', keywords: 'oui non yes no booleen binaire' },
  { type: 'rating', label: 'Note', hint: 'Étoiles', icon: Star, group: 'choices', keywords: 'note rating etoiles satisfaction score' },
  { type: 'linear_scale', label: 'Échelle', hint: 'De 1 à 10', icon: SlidersHorizontal, group: 'choices', keywords: 'echelle scale nps 1 10 curseur' },
  { type: 'hidden', label: 'Champ caché', hint: 'Lu dans l\'URL', icon: EyeOff, group: 'choices', keywords: 'cache hidden utm tracking url parametre' },
  // Mise en page
  { type: 'heading', label: 'Titre', hint: 'Grand titre', icon: Heading1, group: 'layout', keywords: 'titre heading h1 grand' },
  { type: 'subheading', label: 'Sous-titre', hint: 'Titre secondaire', icon: Heading2, group: 'layout', keywords: 'sous titre subheading h2' },
  { type: 'paragraph', label: 'Texte', hint: 'Bloc de texte', icon: FileText, group: 'layout', keywords: 'texte paragraphe description explication' },
  { type: 'divider', label: 'Séparateur', hint: 'Trait horizontal', icon: Minus, group: 'layout', keywords: 'separateur trait ligne divider' },
  { type: 'image', label: 'Image', hint: 'Depuis une URL', icon: ImageIcon, group: 'layout', keywords: 'image photo visuel illustration' },
  { type: 'video', label: 'Vidéo', hint: 'YouTube, Vimeo, Drive, Loom…', icon: Video, group: 'layout', keywords: 'video youtube vimeo drive loom mp4 vsl embed lecture visionnage' },
  { type: 'page_break', label: 'Saut de page', hint: 'Nouvelle étape', icon: Minus, group: 'layout', keywords: 'saut page break etape multi' },
]

const GROUP_LABELS: Record<LibraryEntry['group'], string> = {
  fields: 'Champs',
  choices: 'Choix & notation',
  layout: 'Mise en page',
}

const LIBRARY_BY_TYPE: Record<string, LibraryEntry> = {}
for (const entry of LIBRARY) LIBRARY_BY_TYPE[entry.type] = entry

/** Normalise pour la recherche : minuscules, sans accents. */
function fold(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// ─── Utilitaires ───

function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

const OPERATOR_LABELS: Record<FormConditionalOperator, string> = {
  in: 'est parmi',
  not_in: 'n\'est pas parmi',
  gte: 'est supérieur ou égal à',
  lte: 'est inférieur ou égal à',
  between: 'est compris entre',
  answered: 'a été renseigné',
}

function operatorsFor(type: FormBlockType): FormConditionalOperator[] {
  if (type === 'number' || type === 'rating' || type === 'linear_scale') {
    return ['gte', 'lte', 'between', 'answered']
  }
  return ['in', 'not_in', 'answered']
}

/** Valeurs sélectionnables comme source d'une condition. */
function sourceValues(block: FormBlock): string[] {
  if (block.type === 'yes_no') return ['Oui', 'Non']
  return block.options || []
}

// ─── Composant principal ───

interface Props {
  blocks: FormBlock[]
  onChange: (blocks: FormBlock[]) => void
  accentColor?: string
}

export function FormBlockEditor({ blocks, onChange, accentColor = '#006c49' }: Props) {
  const inputRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})
  // Bloc à focaliser au prochain rendu (après insertion / suppression)
  const [focusTarget, setFocusTarget] = useState<{ id: string; caret?: 'end' } | null>(null)
  // Palette « / » : bloc concerné + index du caractère « / » + requête tapée
  const [slash, setSlash] = useState<{ blockId: string; start: number; query: string } | null>(null)
  const [slashIndex, setSlashIndex] = useState(0)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [openLogic, setOpenLogic] = useState<string | null>(null)

  // ─── Mutations ───

  const update = useCallback(
    (id: string, patch: Partial<FormBlock>) => {
      onChange(blocks.map(b => (b.id === id ? { ...b, ...patch } : b)))
    },
    [blocks, onChange],
  )

  const insertAfter = useCallback(
    (id: string | null, type: FormBlockType) => {
      const block = createBlock(type)
      if (id === null) {
        onChange([...blocks, block])
      } else {
        const idx = blocks.findIndex(b => b.id === id)
        const next = [...blocks]
        next.splice(idx + 1, 0, block)
        onChange(next)
      }
      setFocusTarget({ id: block.id })
      return block
    },
    [blocks, onChange],
  )

  const remove = useCallback(
    (id: string) => {
      const idx = blocks.findIndex(b => b.id === id)
      const previous = idx > 0 ? blocks[idx - 1] : null
      onChange(blocks.filter(b => b.id !== id))
      if (previous) setFocusTarget({ id: previous.id, caret: 'end' })
    },
    [blocks, onChange],
  )

  const duplicate = useCallback(
    (id: string) => {
      const idx = blocks.findIndex(b => b.id === id)
      if (idx < 0) return
      // La copie perd sa condition : sa source resterait valide, mais dupliquer
      // une règle silencieusement est plus souvent une surprise qu'un service.
      const copy: FormBlock = { ...blocks[idx], id: newBlockId(), conditional: null }
      const next = [...blocks]
      next.splice(idx + 1, 0, copy)
      onChange(next)
      setOpenMenu(null)
    },
    [blocks, onChange],
  )

  /** Change le type d'un bloc en conservant son libellé. */
  const convert = useCallback(
    (id: string, type: FormBlockType, text: string) => {
      onChange(
        blocks.map(b => {
          if (b.id !== id) return b
          const fresh = createBlock(type)
          return { ...fresh, id: b.id, text, description: b.description, conditional: b.conditional }
        }),
      )
      setFocusTarget({ id, caret: 'end' })
    },
    [blocks, onChange],
  )

  // ─── Focus différé ───

  useEffect(() => {
    if (!focusTarget) return
    const el = inputRefs.current[focusTarget.id]
    if (el) {
      el.focus()
      if (focusTarget.caret === 'end') {
        const len = el.value.length
        el.setSelectionRange(len, len)
      }
      autoGrow(el)
    }
    setFocusTarget(null)
  }, [focusTarget, blocks])

  // ─── Palette « / » ───

  const slashResults = useMemo(() => {
    if (!slash) return []
    const q = fold(slash.query.trim())
    if (!q) return LIBRARY
    return LIBRARY.filter(e => fold(`${e.label} ${e.keywords}`).includes(q))
  }, [slash])

  useEffect(() => {
    setSlashIndex(0)
  }, [slash?.query])

  const closeSlash = useCallback(() => setSlash(null), [])

  /** Applique le choix de la palette : conversion si le bloc est vide, insertion sinon. */
  const applySlash = useCallback(
    (entry: LibraryEntry) => {
      if (!slash) return
      const block = blocks.find(b => b.id === slash.blockId)
      if (!block) return closeSlash()

      // Retire la séquence « /requête » du texte
      const raw = block.text || ''
      const cleaned = (raw.slice(0, slash.start) + raw.slice(slash.start + 1 + slash.query.length)).trim()

      if (!cleaned && !isInputBlock(block.type)) {
        convert(block.id, entry.type, '')
      } else {
        update(block.id, { text: cleaned })
        insertAfter(block.id, entry.type)
      }
      closeSlash()
    },
    [slash, blocks, closeSlash, convert, update, insertAfter],
  )

  // ─── Drag & drop ───

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return
    const from = result.source.index
    const to = result.destination.index
    if (from === to) return
    const next = [...blocks]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onChange(next)
  }

  // ─── Fermeture des popovers au clic extérieur ───

  useEffect(() => {
    if (!openMenu && !openLogic && !slash) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('[data-block-popover]') || target.closest('[data-block-trigger]')) return
      setOpenMenu(null)
      setOpenLogic(null)
      setSlash(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [openMenu, openLogic, slash])

  // ─── Rendu ───

  if (blocks.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-[#444748] dark:text-neutral-400 mb-6 font-['Inter']">
          Votre formulaire est vide. Ajoutez un premier bloc, puis tapez <kbd className="px-1.5 py-0.5 rounded bg-[#f5f3f2] dark:bg-neutral-800 font-mono text-xs">/</kbd> pour insérer un champ.
        </p>
        <button
          onClick={() => insertAfter(null, 'short_text')}
          className="bg-black text-white px-6 py-3 rounded-full font-['Manrope'] font-bold text-sm active:scale-95 transition-all"
        >
          <Plus className="h-4 w-4 inline mr-2" /> Ajouter un bloc
        </button>
      </div>
    )
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="form-blocks">
        {dropProvided => (
          <div ref={dropProvided.innerRef} {...dropProvided.droppableProps} className="space-y-1">
            {blocks.map((block, index) => (
              <Draggable key={block.id} draggableId={block.id} index={index}>
                {(dragProvided, dragSnapshot) => (
                  <div
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    className={`group relative rounded-xl transition-colors ${
                      dragSnapshot.isDragging ? 'bg-white dark:bg-neutral-800 shadow-lg' : ''
                    }`}
                  >
                    <BlockRow
                      block={block}
                      index={index}
                      allBlocks={blocks}
                      accentColor={accentColor}
                      dragHandleProps={dragProvided.dragHandleProps}
                      registerRef={(el) => { inputRefs.current[block.id] = el }}
                      onUpdate={patch => update(block.id, patch)}
                      onRemove={() => remove(block.id)}
                      onDuplicate={() => duplicate(block.id)}
                      onInsertAfter={() => insertAfter(block.id, 'paragraph')}
                      menuOpen={openMenu === block.id}
                      onToggleMenu={() => { setOpenMenu(openMenu === block.id ? null : block.id); setOpenLogic(null) }}
                      logicOpen={openLogic === block.id}
                      onToggleLogic={() => { setOpenLogic(openLogic === block.id ? null : block.id); setOpenMenu(null) }}
                      slash={slash?.blockId === block.id ? slash : null}
                      slashResults={slashResults}
                      slashIndex={slashIndex}
                      onSlashOpen={(start) => setSlash({ blockId: block.id, start, query: '' })}
                      onSlashQuery={(query) => setSlash(s => (s ? { ...s, query } : s))}
                      onSlashClose={closeSlash}
                      onSlashMove={(delta) =>
                        setSlashIndex(i => {
                          const len = slashResults.length
                          if (len === 0) return 0
                          return (i + delta + len) % len
                        })
                      }
                      onSlashSelect={(entry) => applySlash(entry)}
                      onEnter={() => insertAfter(block.id, 'paragraph')}
                      onBackspaceEmpty={() => remove(block.id)}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {dropProvided.placeholder}

            <button
              onClick={() => insertAfter(null, 'paragraph')}
              className="flex items-center gap-2 mt-4 px-3 py-2 text-sm text-[#444748]/60 dark:text-neutral-500 hover:text-[#1b1c1b] dark:hover:text-white transition-colors font-['Inter']"
            >
              <Plus className="h-4 w-4" /> Ajouter un bloc
            </button>
          </div>
        )}
      </Droppable>
    </DragDropContext>
  )
}

// ─── Ligne de bloc ───

interface BlockRowProps {
  block: FormBlock
  index: number
  allBlocks: FormBlock[]
  accentColor: string
  dragHandleProps: any
  registerRef: (el: HTMLTextAreaElement | null) => void
  onUpdate: (patch: Partial<FormBlock>) => void
  onRemove: () => void
  onDuplicate: () => void
  onInsertAfter: () => void
  menuOpen: boolean
  onToggleMenu: () => void
  logicOpen: boolean
  onToggleLogic: () => void
  slash: { start: number; query: string } | null
  slashResults: LibraryEntry[]
  slashIndex: number
  onSlashOpen: (start: number) => void
  onSlashQuery: (query: string) => void
  onSlashClose: () => void
  onSlashMove: (delta: number) => void
  onSlashSelect: (entry: LibraryEntry) => void
  onEnter: () => void
  onBackspaceEmpty: () => void
}

function BlockRow(props: BlockRowProps) {
  const {
    block, index, allBlocks, accentColor, dragHandleProps, registerRef,
    onUpdate, onRemove, onDuplicate, onInsertAfter,
    menuOpen, onToggleMenu, logicOpen, onToggleLogic,
    slash, slashResults, slashIndex, onSlashOpen, onSlashQuery, onSlashClose, onSlashMove, onSlashSelect,
    onEnter, onBackspaceEmpty,
  } = props

  const localRef = useRef<HTMLTextAreaElement | null>(null)
  const entry = LIBRARY_BY_TYPE[block.type]
  const isInput = isInputBlock(block.type)
  const hasCondition = !!block.conditional?.enabled

  useEffect(() => {
    autoGrow(localRef.current)
  }, [block.text])

  const setRef = (el: HTMLTextAreaElement | null) => {
    localRef.current = el
    registerRef(el)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget

    // Navigation dans la palette
    if (slash && slashResults.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); onSlashMove(1); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); onSlashMove(-1); return }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        onSlashSelect(slashResults[slashIndex] || slashResults[0])
        return
      }
    }
    if (e.key === 'Escape' && slash) { e.preventDefault(); onSlashClose(); return }

    // Ouverture de la palette : « / » en début de mot
    if (e.key === '/' && !slash) {
      const pos = el.selectionStart ?? 0
      const before = el.value[pos - 1]
      if (pos === 0 || before === ' ' || before === '\n') onSlashOpen(pos)
      return
    }

    // Entrée : nouveau bloc (Maj+Entrée = saut de ligne dans le bloc courant)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onEnter()
      return
    }

    // Retour arrière sur un bloc vide : suppression
    if (e.key === 'Backspace' && el.value === '' && (el.selectionStart ?? 0) === 0) {
      e.preventDefault()
      onBackspaceEmpty()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    onUpdate({ text: value })

    if (slash) {
      const caret = e.target.selectionStart ?? 0
      // La palette se ferme si le « / » a été effacé ou si la requête contient une espace
      if (caret <= slash.start || value[slash.start] !== '/') {
        onSlashClose()
      } else {
        const query = value.slice(slash.start + 1, caret)
        if (query.includes(' ')) onSlashClose()
        else onSlashQuery(query)
      }
    }
  }

  // ─── Blocs sans libellé éditable ───

  if (block.type === 'divider' || block.type === 'page_break') {
    const isPageBreak = block.type === 'page_break'
    return (
      <div className="flex items-center gap-2 py-2">
        <Gutter dragHandleProps={dragHandleProps} onInsertAfter={onInsertAfter} />
        <div className="flex-1 flex items-center gap-3">
          <div className={`flex-1 border-t ${isPageBreak ? 'border-dashed border-[#006c49]/40' : 'border-[#c4c7c7]/40 dark:border-neutral-700'}`} />
          {isPageBreak && (
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#006c49] whitespace-nowrap">
              Saut de page
            </span>
          )}
          <div className={`flex-1 border-t ${isPageBreak ? 'border-dashed border-[#006c49]/40' : 'border-[#c4c7c7]/40 dark:border-neutral-700'}`} />
        </div>
        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 p-2 text-[#444748]/40 hover:text-[#ba1a1a] transition-all"
          title="Supprimer"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  if (block.type === 'image') {
    return (
      <div className="flex items-start gap-2 py-2">
        <Gutter dragHandleProps={dragHandleProps} onInsertAfter={onInsertAfter} />
        <div className="flex-1 space-y-2">
          <input
            type="url"
            value={block.url || ''}
            onChange={e => onUpdate({ url: e.target.value })}
            placeholder="https://… (URL de l'image)"
            className="w-full bg-transparent border-b border-[#c4c7c7]/30 dark:border-neutral-700 py-2 text-sm text-[#1b1c1b] dark:text-white placeholder:text-[#444748]/40 focus:border-[#006c49] focus:ring-0 outline-none font-['Inter']"
          />
          {block.url && (
            <img src={block.url} alt="" className="max-h-48 rounded-xl object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
          )}
        </div>
        <button onClick={onRemove} className="opacity-0 group-hover:opacity-100 p-2 text-[#444748]/40 hover:text-[#ba1a1a] transition-all" title="Supprimer">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  // ─── Blocs avec libellé ───

  const textClass =
    block.type === 'heading'
      ? "text-3xl font-['Manrope'] font-extrabold tracking-tight"
      : block.type === 'subheading'
        ? "text-xl font-['Manrope'] font-bold"
        : block.type === 'paragraph'
          ? "text-base font-['Inter'] text-[#444748] dark:text-neutral-300"
          : "text-base font-['Manrope'] font-bold"

  const placeholder =
    block.type === 'heading'
      ? 'Titre'
      : block.type === 'subheading'
        ? 'Sous-titre'
        : block.type === 'paragraph'
          ? "Écrivez, ou tapez / pour insérer un champ"
          : block.type === 'video'
            ? 'Titre de la vidéo (optionnel)'
            : 'Votre question'

  return (
    <div className="flex items-start gap-2 py-1.5">
      <Gutter dragHandleProps={dragHandleProps} onInsertAfter={onInsertAfter} />

      <div className="flex-1 min-w-0 relative">
        {/* En-tête du bloc de saisie */}
        {isInput && (
          <div className="flex items-center gap-2 mb-1">
            {entry && <entry.icon className="h-3 w-3 text-[#444748]/40 dark:text-neutral-500" />}
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#444748]/40 dark:text-neutral-500">
              {entry?.label}
            </span>
            {block.required && <Asterisk className="h-2.5 w-2.5 text-[#ba1a1a]" />}
            {hasCondition && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-[#006c49]">
                <GitBranch className="h-2.5 w-2.5" /> conditionnel
              </span>
            )}
          </div>
        )}

        <textarea
          ref={setRef}
          rows={1}
          value={block.text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            'w-full bg-transparent border-0 p-0 resize-none overflow-hidden focus:ring-0 outline-none',
            'text-[#1b1c1b] dark:text-white placeholder:text-[#444748]/30 dark:placeholder:text-neutral-600',
            textClass,
          )}
        />

        {block.description !== undefined && (
          <input
            type="text"
            value={block.description}
            onChange={e => onUpdate({ description: e.target.value })}
            placeholder="Texte d'aide (optionnel)"
            className="w-full bg-transparent border-0 p-0 mt-1 text-sm text-[#444748] dark:text-neutral-400 placeholder:text-[#444748]/30 focus:ring-0 outline-none font-['Inter']"
          />
        )}

        {/* Aperçu du champ */}
        {isInput && <FieldPreview block={block} accentColor={accentColor} onUpdate={onUpdate} />}

        {/* Palette « / » */}
        {slash && (
          <div
            data-block-popover
            className="absolute left-0 top-full mt-1 z-40 w-80 max-h-80 overflow-y-auto bg-white dark:bg-neutral-900 rounded-xl border border-[#c4c7c7]/20 dark:border-neutral-700 py-2"
            style={{ boxShadow: '0 20px 50px rgba(0,0,0,0.12)' }}
          >
            {slashResults.length === 0 ? (
              <p className="px-4 py-3 text-sm text-[#444748]/60 font-['Inter']">Aucun bloc trouvé</p>
            ) : (
              (['fields', 'choices', 'layout'] as const).map(group => {
                const items = slashResults.filter(e => e.group === group)
                if (items.length === 0) return null
                return (
                  <div key={group}>
                    <p className="px-4 pt-2 pb-1 text-[10px] font-black uppercase tracking-[0.15em] text-[#444748]/40 dark:text-neutral-500">
                      {GROUP_LABELS[group]}
                    </p>
                    {items.map(item => {
                      const globalIdx = slashResults.indexOf(item)
                      const active = globalIdx === slashIndex
                      return (
                        <button
                          key={item.type}
                          onMouseDown={e => { e.preventDefault(); onSlashSelect(item) }}
                          className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                            active ? 'bg-[#f5f3f2] dark:bg-neutral-800' : 'hover:bg-[#f5f3f2] dark:hover:bg-neutral-800'
                          }`}
                        >
                          <div className="w-8 h-8 rounded-lg bg-[#f5f3f2] dark:bg-neutral-800 flex items-center justify-center flex-shrink-0">
                            <item.icon className="h-4 w-4 text-[#444748] dark:text-neutral-300" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[#1b1c1b] dark:text-white font-['Manrope']">{item.label}</p>
                            <p className="text-xs text-[#444748]/60 dark:text-neutral-500 font-['Inter']">{item.hint}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* Logique conditionnelle */}
        {logicOpen && (
          <ConditionalEditor
            block={block}
            previousBlocks={allBlocks.slice(0, index)}
            onUpdate={onUpdate}
            onClose={onToggleLogic}
          />
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        {isInput && (
          <>
            {/* La vidéo pilote son obligation depuis son propre bloc (visionnage minimum) */}
            {block.type !== 'video' && (
              <button
                data-block-trigger
                onClick={() => onUpdate({ required: !block.required })}
                className={`p-2 rounded-lg transition-colors ${
                  block.required
                    ? 'text-[#ba1a1a] bg-[#ffdad6]/30'
                    : 'text-[#444748]/40 hover:text-[#1b1c1b] dark:hover:text-white hover:bg-[#f5f3f2] dark:hover:bg-neutral-800'
                }`}
                title={block.required ? 'Champ obligatoire' : 'Rendre obligatoire'}
              >
                <Asterisk className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              data-block-trigger
              onClick={onToggleLogic}
              className={`p-2 rounded-lg transition-colors ${
                hasCondition
                  ? 'text-[#006c49] bg-[#006c49]/10'
                  : 'text-[#444748]/40 hover:text-[#1b1c1b] dark:hover:text-white hover:bg-[#f5f3f2] dark:hover:bg-neutral-800'
              }`}
              title="Logique conditionnelle"
            >
              <GitBranch className="h-3.5 w-3.5" />
            </button>
          </>
        )}
        <div className="relative">
          <button
            data-block-trigger
            onClick={onToggleMenu}
            className="p-2 rounded-lg text-[#444748]/40 hover:text-[#1b1c1b] dark:hover:text-white hover:bg-[#f5f3f2] dark:hover:bg-neutral-800 transition-colors"
            title="Options"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
          {menuOpen && (
            <div
              data-block-popover
              className="absolute right-0 top-full mt-1 z-40 w-56 bg-white dark:bg-neutral-900 rounded-xl border border-[#c4c7c7]/20 dark:border-neutral-700 py-1.5"
              style={{ boxShadow: '0 20px 50px rgba(0,0,0,0.12)' }}
            >
              {isInput && block.description === undefined && (
                <MenuItem icon={FileText} label="Ajouter un texte d'aide" onClick={() => { onUpdate({ description: '' }); onToggleMenu() }} />
              )}
              {isInput && block.description !== undefined && (
                <MenuItem icon={FileText} label="Retirer le texte d'aide" onClick={() => { onUpdate({ description: undefined }); onToggleMenu() }} />
              )}
              <MenuItem icon={Copy} label="Dupliquer" onClick={onDuplicate} />
              <MenuItem icon={Trash2} label="Supprimer" danger onClick={() => { onRemove(); onToggleMenu() }} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Gouttière (poignée de drag + insertion) ───

function Gutter({ dragHandleProps, onInsertAfter }: { dragHandleProps: any; onInsertAfter: () => void }) {
  return (
    <div className="flex items-center gap-0.5 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        onClick={onInsertAfter}
        className="p-1 rounded text-[#444748]/40 hover:text-[#1b1c1b] dark:hover:text-white hover:bg-[#f5f3f2] dark:hover:bg-neutral-800 transition-colors"
        title="Insérer un bloc en dessous"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
      <div
        {...dragHandleProps}
        className="p-1 rounded text-[#444748]/40 hover:text-[#1b1c1b] dark:hover:text-white hover:bg-[#f5f3f2] dark:hover:bg-neutral-800 cursor-grab active:cursor-grabbing transition-colors"
        title="Déplacer"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>
    </div>
  )
}

function MenuItem({ icon: Icon, label, onClick, danger }: { icon: typeof Type; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2 text-left text-sm font-['Inter'] transition-colors ${
        danger
          ? 'text-[#ba1a1a] hover:bg-[#ffdad6]/30'
          : 'text-[#1b1c1b] dark:text-white hover:bg-[#f5f3f2] dark:hover:bg-neutral-800'
      }`}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  )
}

// ─── Aperçu non interactif du champ ───

function FieldPreview({ block, accentColor, onUpdate }: { block: FormBlock; accentColor: string; onUpdate: (patch: Partial<FormBlock>) => void }) {
  const fake = 'mt-2 w-full rounded-xl border border-[#c4c7c7]/30 dark:border-neutral-700 bg-[#f5f3f2]/50 dark:bg-neutral-800/50 px-4 py-2.5 text-sm text-[#444748]/40 dark:text-neutral-500 font-[\'Inter\'] pointer-events-none'

  if (hasOptions(block.type)) {
    return <OptionsEditor block={block} accentColor={accentColor} onUpdate={onUpdate} />
  }

  if (block.type === 'video') {
    return <VideoEditor block={block} accentColor={accentColor} onUpdate={onUpdate} />
  }

  switch (block.type) {
    case 'long_text':
      return <div className={`${fake} h-20`}>Réponse longue…</div>
    case 'yes_no':
      return (
        <div className="mt-2 flex gap-2 pointer-events-none">
          {['Oui', 'Non'].map(v => (
            <span key={v} className="px-5 py-2 rounded-xl border border-[#c4c7c7]/30 dark:border-neutral-700 text-sm font-bold text-[#444748]/50 dark:text-neutral-500 font-['Inter']">
              {v}
            </span>
          ))}
        </div>
      )
    case 'rating':
      return (
        <div className="mt-2 flex items-center gap-3">
          <div className="flex gap-1 pointer-events-none">
            {Array.from({ length: block.max || 5 }).map((_, i) => (
              <Star key={i} className="h-5 w-5 text-[#c4c7c7]" />
            ))}
          </div>
          <select
            value={block.max || 5}
            onChange={e => onUpdate({ max: Number(e.target.value) })}
            className="text-xs bg-[#f5f3f2] dark:bg-neutral-800 border-0 rounded-lg px-2 py-1 text-[#444748] dark:text-neutral-300 focus:ring-0"
          >
            {[3, 5, 7, 10].map(n => <option key={n} value={n}>{n} étoiles</option>)}
          </select>
        </div>
      )
    case 'linear_scale':
      return (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <input
            type="number"
            value={block.min ?? 1}
            onChange={e => onUpdate({ min: Number(e.target.value) })}
            className="w-16 text-xs bg-[#f5f3f2] dark:bg-neutral-800 border-0 rounded-lg px-2 py-1 text-[#1b1c1b] dark:text-white focus:ring-0"
          />
          <span className="text-xs text-[#444748]/50">→</span>
          <input
            type="number"
            value={block.max ?? 10}
            onChange={e => onUpdate({ max: Number(e.target.value) })}
            className="w-16 text-xs bg-[#f5f3f2] dark:bg-neutral-800 border-0 rounded-lg px-2 py-1 text-[#1b1c1b] dark:text-white focus:ring-0"
          />
          <input
            type="text"
            value={block.min_label || ''}
            onChange={e => onUpdate({ min_label: e.target.value })}
            placeholder="Légende min"
            className="flex-1 min-w-[100px] text-xs bg-transparent border-b border-[#c4c7c7]/30 dark:border-neutral-700 px-1 py-1 text-[#1b1c1b] dark:text-white placeholder:text-[#444748]/30 focus:border-[#006c49] focus:ring-0 outline-none"
          />
          <input
            type="text"
            value={block.max_label || ''}
            onChange={e => onUpdate({ max_label: e.target.value })}
            placeholder="Légende max"
            className="flex-1 min-w-[100px] text-xs bg-transparent border-b border-[#c4c7c7]/30 dark:border-neutral-700 px-1 py-1 text-[#1b1c1b] dark:text-white placeholder:text-[#444748]/30 focus:border-[#006c49] focus:ring-0 outline-none"
          />
        </div>
      )
    case 'hidden':
      return (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-[#444748]/60 dark:text-neutral-500 font-['Inter']">Paramètre d'URL :</span>
          <input
            type="text"
            value={block.key || ''}
            onChange={e => onUpdate({ key: e.target.value.replace(/\s/g, '_') })}
            placeholder="utm_source"
            className="text-xs font-mono bg-[#f5f3f2] dark:bg-neutral-800 border-0 rounded-lg px-2 py-1 text-[#1b1c1b] dark:text-white placeholder:text-[#444748]/40 focus:ring-1 focus:ring-[#006c49]/20"
          />
        </div>
      )
    case 'date':
      return <div className={fake}>jj/mm/aaaa</div>
    case 'email':
      return <div className={fake}>nom@exemple.com</div>
    case 'phone':
      return <div className={fake}>+33 6 12 34 56 78</div>
    case 'number':
      return <div className={fake}>0</div>
    case 'url':
      return <div className={fake}>https://…</div>
    default:
      return <div className={fake}>Réponse courte…</div>
  }
}

// ─── Éditeur de bloc vidéo ───

const PROVIDER_LABELS: Record<string, string> = {
  youtube: 'YouTube',
  vimeo: 'Vimeo',
  drive: 'Google Drive',
  loom: 'Loom',
  file: 'Fichier vidéo',
  unknown: 'Lecteur externe',
}

function VideoEditor({ block, accentColor, onUpdate }: { block: FormBlock; accentColor: string; onUpdate: (patch: Partial<FormBlock>) => void }) {
  const video = parseVideoUrl(block.url)
  const hasUrl = !!(block.url || '').trim()
  const seconds = Number(block.min_watch) || 0

  return (
    <div className="mt-3 space-y-4">
      <div>
        <input
          type="url"
          value={block.url || ''}
          onChange={e => onUpdate({ url: e.target.value })}
          placeholder="Collez le lien : YouTube, Vimeo, Google Drive, Loom, ou .mp4"
          className="w-full bg-transparent border-b border-[#c4c7c7]/30 dark:border-neutral-700 py-2 text-sm text-[#1b1c1b] dark:text-white placeholder:text-[#444748]/40 focus:border-[#006c49] focus:ring-0 outline-none font-['Inter']"
        />
        {hasUrl && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-['Inter']">
            {video ? (
              <span className="text-[#006c49] font-bold">{PROVIDER_LABELS[video.provider]} reconnu</span>
            ) : (
              <span className="flex items-center gap-1.5 text-[#b87500] font-bold">
                <AlertTriangle className="h-3 w-3" /> Lien non reconnu — vérifiez l'URL
              </span>
            )}
          </p>
        )}
      </div>

      {/* Aperçu */}
      {video && (
        <div className="relative rounded-xl overflow-hidden bg-black/90 aspect-video max-w-md">
          {video.provider === 'file' ? (
            <video src={video.src} className="w-full h-full object-contain" muted />
          ) : (
            <iframe
              src={video.src}
              className="w-full h-full pointer-events-none"
              allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
              title="Aperçu"
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
              <Play className="h-5 w-5 text-black ml-0.5" fill="currentColor" />
            </div>
          </div>
        </div>
      )}

      {/* Obligation de visionnage */}
      <div className="rounded-xl bg-[#f5f3f2] dark:bg-neutral-800 p-4 space-y-3">
        <button
          onClick={() => onUpdate({ required: !block.required, min_watch: block.min_watch ?? 30 })}
          className="flex items-start gap-3 text-left w-full"
        >
          <div
            className={`w-10 h-5 rounded-full relative p-1 flex-shrink-0 mt-0.5 transition-colors ${
              block.required ? 'bg-[#006c49]/20' : 'bg-[#eae8e7] dark:bg-neutral-700'
            }`}
          >
            <div
              className={`w-3 h-3 rounded-full absolute transition-all ${
                block.required ? 'bg-[#006c49] right-1' : 'bg-[#747878] left-1'
              }`}
            />
          </div>
          <div>
            <p className="text-sm font-bold text-[#1b1c1b] dark:text-white font-['Inter']">
              Visionnage obligatoire
            </p>
            <p className="text-xs text-[#444748]/60 dark:text-neutral-500 mt-0.5 font-['Inter']">
              Le visiteur ne peut pas continuer avant d'avoir regardé la durée exigée.
            </p>
          </div>
        </button>

        {block.required && (
          <div className="pl-[52px] space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-[#444748] dark:text-neutral-400 font-['Inter']">Durée minimale</span>
              <input
                type="number"
                min={1}
                value={seconds || ''}
                onChange={e => onUpdate({ min_watch: Math.max(1, Number(e.target.value) || 1) })}
                className="w-20 text-sm bg-white dark:bg-neutral-900 border-0 rounded-lg px-3 py-1.5 text-[#1b1c1b] dark:text-white focus:ring-1 focus:ring-[#006c49]/20 focus:outline-none"
              />
              <span className="text-xs text-[#444748] dark:text-neutral-400 font-['Inter']">secondes</span>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {[15, 30, 60, 120, 300].map(preset => (
                <button
                  key={preset}
                  onClick={() => onUpdate({ min_watch: preset })}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors font-['Inter'] ${
                    seconds === preset
                      ? 'text-white'
                      : 'bg-white dark:bg-neutral-900 text-[#444748] dark:text-neutral-400 hover:bg-[#eae8e7] dark:hover:bg-neutral-700'
                  }`}
                  style={seconds === preset ? { backgroundColor: accentColor } : undefined}
                >
                  {preset < 60 ? `${preset} s` : `${preset / 60} min`}
                </button>
              ))}
            </div>
            <p className="text-xs text-[#444748]/60 dark:text-neutral-500 font-['Inter']">
              Le compte à rebours démarre quand le visiteur lance la vidéo, et se met en pause s'il quitte l'onglet.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Éditeur d'options (choix unique / multiple / liste) ───

function OptionsEditor({ block, accentColor, onUpdate }: { block: FormBlock; accentColor: string; onUpdate: (patch: Partial<FormBlock>) => void }) {
  const options = block.options || []

  const setOption = (idx: number, value: string) => {
    const next = [...options]
    next[idx] = value
    onUpdate({ options: next })
  }

  const addOption = () => onUpdate({ options: [...options, `Option ${options.length + 1}`] })
  const removeOption = (idx: number) => onUpdate({ options: options.filter((_, i) => i !== idx) })

  const Marker = block.type === 'multiple_choice' ? CheckSquare : CircleDot

  return (
    <div className="mt-2 space-y-1.5">
      {options.map((opt, idx) => (
        <div key={idx} className="flex items-center gap-2 group/opt">
          {block.type === 'select' ? (
            <span className="text-xs text-[#444748]/40 w-4 text-center font-mono">{idx + 1}</span>
          ) : (
            <Marker className="h-4 w-4 flex-shrink-0" style={{ color: accentColor, opacity: 0.4 }} />
          )}
          <input
            type="text"
            value={opt}
            onChange={e => setOption(idx, e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); addOption() }
              if (e.key === 'Backspace' && opt === '' && options.length > 1) { e.preventDefault(); removeOption(idx) }
            }}
            className="flex-1 bg-transparent border-b border-transparent hover:border-[#c4c7c7]/20 focus:border-[#006c49] py-1 text-sm text-[#1b1c1b] dark:text-white focus:ring-0 outline-none transition-colors font-['Inter']"
          />
          {options.length > 1 && (
            <button
              onClick={() => removeOption(idx)}
              className="opacity-0 group-hover/opt:opacity-100 p-1 text-[#444748]/40 hover:text-[#ba1a1a] transition-all"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ))}
      <button
        onClick={addOption}
        className="flex items-center gap-2 pl-6 py-1 text-xs text-[#444748]/60 dark:text-neutral-500 hover:text-[#006c49] transition-colors font-['Inter']"
      >
        <Plus className="h-3 w-3" /> Ajouter une option
      </button>
    </div>
  )
}

// ─── Éditeur de logique conditionnelle ───

function ConditionalEditor({
  block, previousBlocks, onUpdate, onClose,
}: {
  block: FormBlock
  previousBlocks: FormBlock[]
  onUpdate: (patch: Partial<FormBlock>) => void
  onClose: () => void
}) {
  // Seuls les blocs situés AVANT peuvent servir de source : garantit l'absence de cycle
  const sources = previousBlocks.filter(b => isEligibleSourceType(b.type))
  const rule = block.conditional
  const source = rule?.source_id ? sources.find(b => b.id === rule.source_id) : undefined

  const setRule = (patch: Partial<FormConditionalRule>) => {
    const base: FormConditionalRule = rule || { enabled: true, source_id: '', operator: 'in', values: [] }
    onUpdate({ conditional: { ...base, ...patch, enabled: true } })
  }

  const disable = () => {
    onUpdate({ conditional: null })
    onClose()
  }

  return (
    <div
      data-block-popover
      className="absolute left-0 top-full mt-2 z-40 w-[420px] bg-white dark:bg-neutral-900 rounded-xl border border-[#c4c7c7]/20 dark:border-neutral-700 p-5"
      style={{ boxShadow: '0 20px 50px rgba(0,0,0,0.12)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-['Manrope'] font-extrabold text-[#1b1c1b] dark:text-white">Afficher ce bloc si…</h4>
        <button onClick={onClose} className="p-1 text-[#444748]/40 hover:text-[#1b1c1b] dark:hover:text-white transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {sources.length === 0 ? (
        <p className="text-sm text-[#444748] dark:text-neutral-400 font-['Inter']">
          Aucune question antérieure ne peut servir de condition. Ajoutez avant ce bloc un choix, une note, une échelle ou un nombre.
        </p>
      ) : (
        <div className="space-y-3">
          <select
            value={rule?.source_id || ''}
            onChange={e => {
              const next = sources.find(b => b.id === e.target.value)
              setRule({
                source_id: e.target.value,
                operator: next ? operatorsFor(next.type)[0] : 'in',
                values: [],
              })
            }}
            className="w-full appearance-none bg-[#f5f3f2] dark:bg-neutral-800 rounded-xl border-0 px-4 py-2.5 text-sm text-[#1b1c1b] dark:text-white font-medium focus:ring-1 focus:ring-[#006c49]/20 focus:outline-none"
          >
            <option value="">Choisir une question…</option>
            {sources.map((b, i) => (
              <option key={b.id} value={b.id}>{b.text || `Question ${i + 1}`}</option>
            ))}
          </select>

          {source && (
            <>
              <select
                value={rule?.operator || 'in'}
                onChange={e => setRule({ operator: e.target.value as FormConditionalOperator, values: [] })}
                className="w-full appearance-none bg-[#f5f3f2] dark:bg-neutral-800 rounded-xl border-0 px-4 py-2.5 text-sm text-[#1b1c1b] dark:text-white font-medium focus:ring-1 focus:ring-[#006c49]/20 focus:outline-none"
              >
                {operatorsFor(source.type).map(op => (
                  <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
                ))}
              </select>

              {/* Valeurs : choix */}
              {(rule?.operator === 'in' || rule?.operator === 'not_in') && (
                <div className="flex flex-wrap gap-2">
                  {sourceValues(source).map(v => {
                    const active = (rule?.values || []).map(String).includes(v)
                    return (
                      <button
                        key={v}
                        onClick={() => {
                          const current = (rule?.values || []).map(String)
                          setRule({ values: active ? current.filter(x => x !== v) : [...current, v] })
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors font-['Inter'] ${
                          active
                            ? 'bg-[#006c49] text-white'
                            : 'bg-[#f5f3f2] dark:bg-neutral-800 text-[#444748] dark:text-neutral-300 hover:bg-[#eae8e7] dark:hover:bg-neutral-700'
                        }`}
                      >
                        {v}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Valeurs : numérique */}
              {(rule?.operator === 'gte' || rule?.operator === 'lte') && (
                <input
                  type="number"
                  value={String(rule?.values?.[0] ?? '')}
                  onChange={e => setRule({ values: [Number(e.target.value)] })}
                  className="w-full bg-[#f5f3f2] dark:bg-neutral-800 rounded-xl border-0 px-4 py-2.5 text-sm text-[#1b1c1b] dark:text-white focus:ring-1 focus:ring-[#006c49]/20 focus:outline-none"
                />
              )}
              {rule?.operator === 'between' && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={String(rule?.values?.[0] ?? '')}
                    onChange={e => setRule({ values: [Number(e.target.value), Number(rule?.values?.[1] ?? 0)] })}
                    className="flex-1 bg-[#f5f3f2] dark:bg-neutral-800 rounded-xl border-0 px-4 py-2.5 text-sm text-[#1b1c1b] dark:text-white focus:ring-1 focus:ring-[#006c49]/20 focus:outline-none"
                  />
                  <span className="text-xs text-[#444748]/50">et</span>
                  <input
                    type="number"
                    value={String(rule?.values?.[1] ?? '')}
                    onChange={e => setRule({ values: [Number(rule?.values?.[0] ?? 0), Number(e.target.value)] })}
                    className="flex-1 bg-[#f5f3f2] dark:bg-neutral-800 rounded-xl border-0 px-4 py-2.5 text-sm text-[#1b1c1b] dark:text-white focus:ring-1 focus:ring-[#006c49]/20 focus:outline-none"
                  />
                </div>
              )}
            </>
          )}

          {rule?.enabled && (
            <button
              onClick={disable}
              className="text-xs text-[#ba1a1a] hover:underline font-['Inter'] font-bold"
            >
              Retirer la condition
            </button>
          )}
        </div>
      )}
    </div>
  )
}
