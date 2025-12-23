import { Brain } from 'lucide-react'
import { ComingSoon } from '../components/ComingSoon'

export function AICoachPage() {
  return (
    <ComingSoon
      icon={Brain}
      title="Votre Coach de Vente IA"
      description="L'intelligence artificielle analyse vos performances globales pour vous faire devenir un Top Closer."
      features={[
        'Analyse émotionnelle et tonalité de voix',
        'Détection des tics de langage',
        'Recommandations stratégiques après chaque session',
        'Comparaison avec les meilleurs closers du marché',
      ]}
    />
  )
}
