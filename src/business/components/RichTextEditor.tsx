import { useRef, useEffect, useState } from 'react'
import { Bold, Italic, Underline, Strikethrough, Highlighter, Link as LinkIcon, List, ListOrdered, RemoveFormatting } from 'lucide-react'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  rows?: number
  className?: string
}

const BTN_CLS = 'p-2 rounded-md text-[#444748] dark:text-neutral-400 hover:bg-[#eae8e7] dark:hover:bg-neutral-700 transition-colors active:scale-95'

export function RichTextEditor({ value, onChange, placeholder, rows = 3, className = '' }: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [focused, setFocused] = useState(false)

  // Hydrate external value without destroying the caret during typing
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || '')) {
      ref.current.innerHTML = value || ''
    }
  }, [value])

  const exec = (cmd: string, arg?: string) => {
    // execCommand is deprecated but still universally supported and perfect for this scope
    document.execCommand(cmd, false, arg)
    ref.current?.focus()
    if (ref.current) onChange(ref.current.innerHTML)
  }

  const handleInput = () => {
    if (!ref.current) return
    const html = ref.current.innerHTML
    // Normalize empty state so value stays empty string (not "<br>")
    if (html === '<br>' || html === '<div><br></div>') {
      onChange('')
    } else {
      onChange(html)
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    // Strip formatting from pasted content — keep only plain text + line breaks
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
  }

  const handleLink = () => {
    const url = window.prompt('URL du lien', 'https://')
    if (url && url !== 'https://') exec('createLink', url)
  }

  const minHeight = `${rows * 1.5 + 1}rem`

  return (
    <div className={`rounded-xl border ${focused ? 'border-[#635bff]' : 'border-[#c4c7c7]/30 dark:border-neutral-700'} bg-white dark:bg-neutral-900 transition-colors ${className}`}>
      <div className="flex items-center gap-0.5 border-b border-[#c4c7c7]/20 dark:border-neutral-700 px-2 py-1.5 flex-wrap">
        <button type="button" onClick={() => exec('bold')} className={BTN_CLS} title="Gras (Ctrl+B)">
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={() => exec('italic')} className={BTN_CLS} title="Italique (Ctrl+I)">
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={() => exec('underline')} className={BTN_CLS} title="Souligné (Ctrl+U)">
          <Underline className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={() => exec('strikeThrough')} className={BTN_CLS} title="Barré">
          <Strikethrough className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={() => exec('hiliteColor', '#fef3c7')} className={BTN_CLS} title="Surligné">
          <Highlighter className="h-3.5 w-3.5" />
        </button>
        <div className="w-px h-5 bg-[#c4c7c7]/30 dark:bg-neutral-700 mx-1" />
        <button type="button" onClick={() => exec('insertUnorderedList')} className={BTN_CLS} title="Liste à puces">
          <List className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={() => exec('insertOrderedList')} className={BTN_CLS} title="Liste numérotée">
          <ListOrdered className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={handleLink} className={BTN_CLS} title="Lien">
          <LinkIcon className="h-3.5 w-3.5" />
        </button>
        <div className="w-px h-5 bg-[#c4c7c7]/30 dark:bg-neutral-700 mx-1" />
        <button type="button" onClick={() => exec('removeFormat')} className={BTN_CLS} title="Effacer la mise en forme">
          <RemoveFormatting className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="relative">
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onPaste={handlePaste}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="rte-editor w-full px-4 py-3 text-sm text-[#1b1c1b] dark:text-white focus:outline-none"
          style={{ minHeight }}
        />
        {!value && !focused && placeholder && (
          <div className="pointer-events-none absolute top-3 left-4 text-sm text-[#444748]/40 dark:text-neutral-500">
            {placeholder}
          </div>
        )}
      </div>
      <style>{`
        .rte-editor a { color: #635bff; text-decoration: underline; }
        .rte-editor ul { list-style: disc; padding-left: 1.25rem; margin: 0.25rem 0; }
        .rte-editor ol { list-style: decimal; padding-left: 1.25rem; margin: 0.25rem 0; }
        .rte-editor b, .rte-editor strong { font-weight: 700; }
        .rte-editor i, .rte-editor em { font-style: italic; }
      `}</style>
    </div>
  )
}

// Minimal HTML sanitizer for rendering the stored content on public pages.
// Keeps only the tags our editor can produce; strips scripts/events/iframes/etc.
const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'SPAN', 'MARK', 'BR', 'DIV', 'P', 'UL', 'OL', 'LI', 'A', 'FONT'])
const ALLOWED_ATTRS = new Set(['href', 'style'])

export function sanitizeRichHtml(html: string | null | undefined): string {
  if (!html) return ''
  if (typeof document === 'undefined') return html // SSR fallback — rendered client-side
  const tpl = document.createElement('template')
  tpl.innerHTML = html
  const walk = (node: Node) => {
    const children = Array.from(node.childNodes)
    for (const child of children) {
      if (child.nodeType === 1) {
        const el = child as Element
        if (!ALLOWED_TAGS.has(el.tagName)) {
          // Unwrap: keep text content, drop the tag
          while (el.firstChild) el.parentNode?.insertBefore(el.firstChild, el)
          el.remove()
          continue
        }
        // Strip disallowed attributes
        for (const attr of Array.from(el.attributes)) {
          if (!ALLOWED_ATTRS.has(attr.name.toLowerCase())) {
            el.removeAttribute(attr.name)
          } else if (attr.name.toLowerCase() === 'href') {
            const v = attr.value.trim().toLowerCase()
            if (v.startsWith('javascript:') || v.startsWith('data:')) {
              el.removeAttribute(attr.name)
            } else if (el.tagName === 'A') {
              el.setAttribute('target', '_blank')
              el.setAttribute('rel', 'noopener noreferrer')
            }
          } else if (attr.name.toLowerCase() === 'style') {
            // Keep only background-color (from highlight command); drop everything else
            const styles = attr.value.split(';').map(s => s.trim()).filter(Boolean)
            const safe = styles.filter(s => /^background-color\s*:\s*[#a-z0-9(),.\s]+$/i.test(s))
            if (safe.length === 0) el.removeAttribute('style')
            else el.setAttribute('style', safe.join('; '))
          }
        }
        walk(child)
      } else if (child.nodeType !== 3) {
        // Drop comments and other non-element, non-text nodes
        child.parentNode?.removeChild(child)
      }
    }
  }
  walk(tpl.content)
  return tpl.innerHTML
}
