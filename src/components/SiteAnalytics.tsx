import { useEffect } from 'react'
import { Analytics } from '@vercel/analytics/react'

// Statistiques de visite : Umami quand il est configuré (hébergement Dokploy / VPS),
// sinon Vercel Analytics (hébergement Vercel). Umami suit tout seul les changements de page.
const UMAMI_SRC = import.meta.env.VITE_UMAMI_SRC as string | undefined
const UMAMI_WEBSITE_ID = import.meta.env.VITE_UMAMI_WEBSITE_ID as string | undefined

export function SiteAnalytics() {
  useEffect(() => {
    if (!UMAMI_SRC || !UMAMI_WEBSITE_ID) return
    if (document.querySelector('script[data-website-id]')) return
    const s = document.createElement('script')
    s.defer = true
    s.src = UMAMI_SRC
    s.dataset.websiteId = UMAMI_WEBSITE_ID
    document.head.appendChild(s)
  }, [])

  if (UMAMI_SRC && UMAMI_WEBSITE_ID) return null
  return <Analytics />
}
