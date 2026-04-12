import { FileText } from 'lucide-react'
import { ComingSoon } from '../components/ComingSoon'
import { useLanguage } from '../contexts/LanguageContext'

export function AICoachPage() {
  const { lang } = useLanguage()
  return (
    <ComingSoon
      icon={FileText}
      title={lang === 'fr' ? "Rapports de Performance" : "Performance Reports"}
      description={lang === 'fr' ? "L'IA écoute vos appels et génère un rapport ultra-précis pour chaque interaction : vos points de blocage, vos réussites et les axes d'amélioration immédiats." : "AI listens to your calls and generates an ultra-precise report for each interaction: your sticking points, successes and areas for immediate improvement."}
      features={lang === 'fr' ? [
        'Identification précise des moments où vous avez eu du mal',
        'Mise en lumière de vos "Perfect Moments" et techniques réussies',
        'Suggestions correctives pour vos prochains closings',
        'Analyse objective de la structure de vos appels',
      ] : [
        'Precise identification of moments where you struggled',
        'Highlighting your "Perfect Moments" and successful techniques',
        'Corrective suggestions for your next closings',
        'Objective analysis of your call structure',
      ]}
    />
  )
}