import { useState, useEffect, useRef } from 'react'

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*'

export function useScrambleText(finalText: string, duration = 1800) {
  const [display, setDisplay] = useState('')
  const frameRef = useRef<number>()
  const hasRun = useRef(false)

  useEffect(() => {
    if (!finalText || hasRun.current) {
      setDisplay(finalText)
      return
    }
    hasRun.current = true

    const len = finalText.length
    const startTime = performance.now()
    const revealPerChar = duration / len

    const animate = (now: number) => {
      const elapsed = now - startTime
      const charsRevealed = Math.min(Math.floor(elapsed / revealPerChar), len)

      let result = ''
      for (let i = 0; i < len; i++) {
        if (finalText[i] === ' ') {
          result += ' '
        } else if (i < charsRevealed) {
          result += finalText[i]
        } else {
          result += CHARS[Math.floor(Math.random() * CHARS.length)]
        }
      }

      setDisplay(result)

      if (charsRevealed < len) {
        frameRef.current = requestAnimationFrame(animate)
      } else {
        setDisplay(finalText)
      }
    }

    frameRef.current = requestAnimationFrame(animate)
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current) }
  }, [finalText, duration])

  return display
}
