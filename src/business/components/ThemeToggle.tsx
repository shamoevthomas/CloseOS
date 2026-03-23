import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../contexts/BusinessThemeContext'

export function ThemeToggle() {
  const { dark, toggle } = useTheme()

  return (
    <button
      onClick={toggle}
      aria-label={dark ? 'Passer en mode jour' : 'Passer en mode nuit'}
      className="relative w-14 h-7 rounded-full p-0.5 transition-colors duration-300 focus:outline-none"
      style={{ background: dark ? '#1b1c1b' : '#efedec' }}
    >
      {/* Track icons */}
      <Sun className="absolute left-1.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-amber-400 transition-opacity duration-300" style={{ opacity: dark ? 0.3 : 0 }} />
      <Moon className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-blue-300 transition-opacity duration-300" style={{ opacity: dark ? 0 : 0.3 }} />

      {/* Thumb */}
      <div
        className="relative h-6 w-6 rounded-full shadow-md transition-all duration-300 ease-[cubic-bezier(0.68,-0.2,0.27,1.2)] flex items-center justify-center"
        style={{
          transform: dark ? 'translateX(28px)' : 'translateX(0px)',
          background: dark ? '#2a2b2a' : '#ffffff',
          boxShadow: dark
            ? '0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)'
            : '0 2px 8px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.9)',
        }}
      >
        {dark ? (
          <Moon className="h-3.5 w-3.5 text-blue-300" />
        ) : (
          <Sun className="h-3.5 w-3.5 text-amber-500" />
        )}
      </div>
    </button>
  )
}
