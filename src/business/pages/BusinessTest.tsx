import { useEffect, useRef } from 'react'

export default function BusinessTest() {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data && e.data.type === 'closeos-capture-resize') {
        if (iframeRef.current) iframeRef.current.style.height = e.data.height + 'px'
      }
      if (e.data === 'closeos-capture-done') {
        if (iframeRef.current) iframeRef.current.style.height = '120px'
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  return (
    <div className="space-y-12">
      <h1 className="text-3xl font-black tracking-tight text-neutral-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
        Page de test — Embeds
      </h1>

      <div>
        <iframe
          ref={iframeRef}
          id="closeos-embed"
          src="/capture/d8cbeca2-3a35-424a-b549-c0fbe1dd1aee?embed=true&layout=horizontal"
          width="100%"
          height={530}
          frameBorder="0"
          scrolling="no"
          style={{ border: 'none', borderRadius: 12, overflow: 'hidden', transition: 'height 0.4s ease' }}
        />
      </div>
    </div>
  )
}
