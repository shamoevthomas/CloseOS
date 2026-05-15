import toast from 'react-hot-toast'

const EVENT_OPEN = 'app:open-error-report'
const EVENT_ERROR = 'app:error-emitted'

export const openErrorReport = (subject?: string) => {
  window.dispatchEvent(new CustomEvent(EVENT_OPEN, { detail: { subject } }))
}

export const onOpenErrorReport = (handler: (subject?: string) => void): (() => void) => {
  const listener = (e: Event) => {
    const detail = (e as CustomEvent).detail as { subject?: string } | undefined
    handler(detail?.subject)
  }
  window.addEventListener(EVENT_OPEN, listener)
  return () => window.removeEventListener(EVENT_OPEN, listener)
}

export const onErrorEmitted = (handler: (subject: string) => void): (() => void) => {
  const listener = (e: Event) => {
    const detail = (e as CustomEvent).detail as { subject?: string } | undefined
    handler(detail?.subject || 'Erreur CloseOS')
  }
  window.addEventListener(EVENT_ERROR, listener)
  return () => window.removeEventListener(EVENT_ERROR, listener)
}

let patched = false

export const installToastErrorPatch = () => {
  if (patched) return
  patched = true

  const original = toast.error.bind(toast)

  ;(toast as unknown as { error: typeof toast.error }).error = ((message: Parameters<typeof toast.error>[0], opts?: Parameters<typeof toast.error>[1]) => {
    const id = original(message, opts)
    const subject = typeof message === 'string' ? message : 'Erreur CloseOS'
    window.dispatchEvent(new CustomEvent(EVENT_ERROR, { detail: { subject } }))
    return id
  }) as typeof toast.error

  window.addEventListener('app:unhandled-error', (e) => {
    const detail = (e as CustomEvent).detail as { message?: string } | undefined
    const msg = detail?.message || 'Erreur inattendue'
    toast.error(`Erreur inattendue : ${msg.slice(0, 100)}`)
  })
}
