type LogLevel = 'log' | 'info' | 'warn' | 'error'

interface LogEntry {
  ts: string
  level: LogLevel
  message: string
}

const MAX_ENTRIES = 200
const buffer: LogEntry[] = []
let installed = false

const safeStringify = (arg: unknown): string => {
  if (arg instanceof Error) {
    return `${arg.name}: ${arg.message}\n${arg.stack || ''}`
  }
  if (typeof arg === 'string') return arg
  try {
    return JSON.stringify(arg, null, 2)
  } catch {
    return String(arg)
  }
}

const push = (level: LogLevel, args: unknown[]) => {
  const message = args.map(safeStringify).join(' ')
  buffer.push({ ts: new Date().toISOString(), level, message })
  if (buffer.length > MAX_ENTRIES) buffer.shift()
}

export const installConsoleCapture = () => {
  if (installed || typeof window === 'undefined') return
  installed = true

  const levels: LogLevel[] = ['log', 'info', 'warn', 'error']
  for (const level of levels) {
    const original = console[level].bind(console)
    console[level] = (...args: unknown[]) => {
      push(level, args)
      original(...args)
    }
  }

  window.addEventListener('error', (e) => {
    push('error', [`[window.onerror] ${e.message}`, e.error?.stack || `at ${e.filename}:${e.lineno}:${e.colno}`])
    window.dispatchEvent(new CustomEvent('app:unhandled-error', { detail: { message: e.message, error: e.error } }))
  })

  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason
    const msg = reason instanceof Error ? `${reason.name}: ${reason.message}` : safeStringify(reason)
    push('error', [`[unhandledrejection] ${msg}`, reason instanceof Error ? reason.stack : ''])
    window.dispatchEvent(new CustomEvent('app:unhandled-error', { detail: { message: msg, error: reason } }))
  })
}

export const getConsoleSnapshot = (): string => {
  const lines = [
    `CloseOS console log — ${new Date().toISOString()}`,
    `URL: ${typeof window !== 'undefined' ? window.location.href : 'n/a'}`,
    `UA: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'n/a'}`,
    `Entries: ${buffer.length}/${MAX_ENTRIES}`,
    '─'.repeat(60),
    ...buffer.map((e) => `[${e.ts}] [${e.level.toUpperCase()}] ${e.message}`),
  ]
  return lines.join('\n')
}

export const clearConsoleBuffer = () => {
  buffer.length = 0
}
