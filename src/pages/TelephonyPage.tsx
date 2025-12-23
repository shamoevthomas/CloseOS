import { Smartphone } from 'lucide-react'
import { ComingSoon } from '../components/ComingSoon'

export function TelephonyPage() {
  return (
    <ComingSoon
      icon={Smartphone}
      title="Téléphonie & SMS Intégrés"
      description="Plus besoin de votre téléphone personnel. Centralisez toutes vos communications directement dans CloserOS."
      features={[
        'Numéro virtuel professionnel dédié',
        'Appels et SMS synchronisés avec le CRM',
        'Enregistrement automatique des conversations',
        'Power Dialer pour enchaîner les appels',
      ]}
    />
  )
}
