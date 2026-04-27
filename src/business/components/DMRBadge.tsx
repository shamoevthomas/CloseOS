import type { BusinessProspect } from '../contexts/BusinessProspectsContext'

interface Props {
  prospect: Pick<BusinessProspect, 'stage' | 'created_at'>
  size?: 'xs' | 'sm'
  className?: string
}

export function DMRBadge({ prospect, size = 'xs', className = '' }: Props) {
  if (prospect.stage !== 'prospect' || !prospect.created_at) return null

  const days = Math.max(
    0,
    Math.floor((Date.now() - new Date(prospect.created_at).getTime()) / (1000 * 60 * 60 * 24)),
  )

  let colorClass = 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400'
  if (days >= 7) {
    colorClass = 'bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-400'
  } else if (days >= 3) {
    colorClass = 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400'
  }

  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-[10px] px-1.5 py-[1px]'

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full border font-bold whitespace-nowrap ${colorClass} ${sizeClass} ${className}`}
      title={`DMR : ${days} jour${days > 1 ? 's' : ''} sans prise en charge`}
    >
      DMR {days}j
    </span>
  )
}
