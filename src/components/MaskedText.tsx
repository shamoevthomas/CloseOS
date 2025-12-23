import { usePrivacy } from '../contexts/PrivacyContext'
import { cn } from '../lib/utils'

interface MaskedTextProps {
  value: string
  type: 'number' | 'name'
  className?: string
}

export function MaskedText({ value, type, className }: MaskedTextProps) {
  const { isPrivacyEnabled, settings, maskData } = usePrivacy()

  // Si le mode privacy n'est pas activé, retourner la valeur normale
  if (!isPrivacyEnabled) {
    return <span className={className}>{value}</span>
  }

  // Déterminer si on doit masquer ce type de donnée
  const shouldMask =
    (type === 'number' && settings.hideNumbers) ||
    (type === 'name' && settings.hideNames)

  if (!shouldMask) {
    return <span className={className}>{value}</span>
  }

  // Si mode blur est activé, appliquer le flou
  if (settings.blurMode) {
    return <span className={cn('blur-sm select-none', className)}>{value}</span>
  }

  // Sinon, masquer avec des astérisques
  const maskedValue = maskData(value, type)
  return <span className={cn('select-none', className)}>{maskedValue}</span>
}
