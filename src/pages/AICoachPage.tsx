import { FileText } from 'lucide-react'
import { ComingSoon } from '../components/ComingSoon'

export function AICoachPage() {
  return (
    <ComingSoon
      icon={FileText}
      title="Rapports de Performance"
      description="L'IA écoute vos appels et génère un rapport ultra-précis pour chaque interaction : vos points de blocage, vos réussites et les axes d'amélioration immédiats."
      features={[
        'Identification précise des moments où vous avez eu du mal',
        'Mise en lumière de vos "Perfect Moments" et techniques réussies',
        'Suggestions correctives pour vos prochains closings',
        'Analyse objective de la structure de vos appels',
      ]}
    />
  )
}