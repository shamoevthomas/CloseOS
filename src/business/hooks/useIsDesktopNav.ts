import { useEffect, useState } from 'react'

// Navigation « bureau » (barre latérale rétractable au survol) : grand écran ET souris.
// Les tablettes tactiles (iPad, y compris en paysage) gardent l'en-tête + tiroir mobile :
// la barre rétractable repose sur le survol, qui n'existe pas au doigt.
const DESKTOP_NAV_QUERY = '(min-width: 1024px) and (hover: hover) and (pointer: fine)'

const matches = () => typeof window !== 'undefined' && window.matchMedia(DESKTOP_NAV_QUERY).matches

export function useIsDesktopNav() {
  const [isDesktopNav, setIsDesktopNav] = useState(matches)

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_NAV_QUERY)
    const onChange = () => setIsDesktopNav(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return isDesktopNav
}
