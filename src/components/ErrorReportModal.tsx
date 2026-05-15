import { useEffect, useRef, useState } from 'react'
import { X, Copy, Check, Send, Bug } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import { getConsoleSnapshot } from '../lib/consoleCapture'
import { onOpenErrorReport } from '../lib/errorReporter'

export function ErrorReportModal() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [snapshot, setSnapshot] = useState('')
  const [copied, setCopied] = useState(false)
  const [sending, setSending] = useState(false)
  const consoleRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    return onOpenErrorReport((presetSubject) => {
      setSnapshot(getConsoleSnapshot())
      setEmail(user?.email || '')
      setSubject(presetSubject ? `[Bug] ${presetSubject}` : '[Bug] ')
      setDescription('')
      setCopied(false)
      setOpen(true)
    })
  }, [user?.email])

  if (!open) return null

  const close = () => setOpen(false)

  const copyConsole = async () => {
    try {
      await navigator.clipboard.writeText(snapshot)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      consoleRef.current?.select()
      document.execCommand('copy')
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !subject.trim() || !description.trim()) {
      toast('Email, objet et description requis', { icon: '⚠️' })
      return
    }
    setSending(true)
    try {
      const attachmentBase64 = btoa(unescape(encodeURIComponent(snapshot)))
      const res = await fetch('/api/email?action=contact-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: user?.user_metadata?.full_name || email,
          email,
          subject,
          message: `${description}\n\n---\nURL: ${window.location.href}\nUser-Agent: ${navigator.userAgent}\nUser ID: ${user?.id || 'n/a'}`,
          attachmentName: 'console-log.txt',
          attachmentBase64,
          attachmentType: 'text/plain',
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success('Erreur envoyée au support. Merci !')
      setOpen(false)
    } catch (err) {
      console.error('[ErrorReport] Send failed:', err)
      toast('Échec de l\'envoi. Réessayez ou copiez la console.', { icon: '⚠️' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={close} />

      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#1a1a1a] p-6 shadow-2xl border border-white/[0.08]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-red-500/10 p-2">
              <Bug className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Signaler un bug</h2>
              <p className="mt-1 text-sm text-white/40">Le log technique est automatiquement joint au mail.</p>
            </div>
          </div>
          <button onClick={close} className="rounded-lg p-2 text-white/40 hover:bg-white/5 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-white/60">Votre email *</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white/60">Objet *</label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Résumé court du problème"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white/60">Que s'est-il passé ? *</label>
            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez ce que vous faisiez juste avant l'erreur..."
              rows={4}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-emerald-500 focus:outline-none resize-none"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-white/60">Log technique (copiable, envoyé en pièce jointe)</label>
              <button
                type="button"
                onClick={copyConsole}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-white/70 hover:bg-white/10"
              >
                {copied ? <><Check className="h-3.5 w-3.5 text-emerald-400" /> Copié</> : <><Copy className="h-3.5 w-3.5" /> Copier</>}
              </button>
            </div>
            <textarea
              ref={consoleRef}
              readOnly
              value={snapshot}
              rows={8}
              className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 font-mono text-[11px] text-white/70 focus:border-white/20 focus:outline-none resize-none"
            />
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="submit"
              disabled={sending}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black transition-all hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="h-4 w-4" />
              {sending ? 'Envoi…' : 'Envoyer au support'}
            </button>
            <button
              type="button"
              onClick={close}
              className="rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-white/80 transition-all hover:bg-white/10"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
