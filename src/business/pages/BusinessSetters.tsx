import { Headphones } from 'lucide-react'
import { BusinessTeamRolePage } from '../components/BusinessTeamRolePage'

export function BusinessSetters() {
  return (
    <BusinessTeamRolePage
      roleFilter={['Setter', 'Setter-Closer']}
      pageLabel="Setters"
      pageIcon={Headphones}
    />
  )
}
