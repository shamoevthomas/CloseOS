import { UserCheck } from 'lucide-react'
import { BusinessTeamRolePage } from '../components/BusinessTeamRolePage'

export function BusinessClosers() {
  return (
    <BusinessTeamRolePage
      roleFilter={['Closer', 'Setter-Closer']}
      pageLabel="Closers"
      pageIcon={UserCheck}
    />
  )
}
