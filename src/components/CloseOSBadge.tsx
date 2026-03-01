export function CloseOSBadge() {
  return (
    <a
      href="https://closeos.fr"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-slate-700/50 bg-slate-900/90 px-4 py-2 shadow-lg backdrop-blur-sm transition-all hover:border-blue-500/30 hover:shadow-blue-500/10 hover:scale-105"
    >
      <span className="text-sm">🎯</span>
      <span className="text-xs font-semibold text-slate-300">
        Tracked on <span className="text-blue-400">CloseOS</span>
      </span>
    </a>
  )
}
