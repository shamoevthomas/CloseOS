export function CloseOSBadge() {
  return (
    <a
      href="https://closeos.fr"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-white/[0.08] bg-[#1a1a1a]/90 px-4 py-2 shadow-lg backdrop-blur-sm transition-all hover:border-emerald-500/30 hover:shadow-emerald-500/10 hover:scale-105"
    >
      <span className="text-sm">🎯</span>
      <span className="text-xs font-semibold text-white/60">
        Tracked on <span className="text-emerald-400">CloseOS</span>
      </span>
    </a>
  )
}
