import { useEffect, useRef, useState } from 'react'
import { Bug, X } from 'lucide-react'
import { onErrorEmitted, openErrorReport } from '../lib/errorReporter'

const VISIBLE_MS = 12000

export function ErrorReportTrigger() {
  const [visible, setVisible] = useState(false)
  const [subject, setSubject] = useState('Erreur CloseOS')
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    return onErrorEmitted((newSubject) => {
      setSubject(newSubject)
      setVisible(true)
      if (timerRef.current) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => setVisible(false), VISIBLE_MS)
    })
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [])

  if (!visible) return null

  return (
    <div className="fixed bottom-6 right-6 z-[150] flex items-center gap-2 rounded-full border border-red-500/30 bg-[#1a1a1a] px-4 py-2.5 shadow-2xl animate-in fade-in slide-in-from-bottom-4">
      <button
        type="button"
        onClick={() => {
          setVisible(false)
          openErrorReport(subject)
        }}
        className="inline-flex items-center gap-2 text-sm font-semibold text-red-300 hover:text-red-200"
      >
        <Bug className="h-4 w-4" />
        Signaler ce bug au support
      </button>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="rounded-full p-1 text-white/30 hover:bg-white/5 hover:text-white/60"
        aria-label="Fermer"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
