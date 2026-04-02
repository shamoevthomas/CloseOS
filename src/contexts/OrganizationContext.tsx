import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useAuth } from './AuthContext'

interface OrganizationData {
  member_id: string
  owner_id: string
  role: string
  joined_at: string
  can_manage_campaigns: boolean
  setter_scope: string | null
  custom_permissions: any
  org_name: string
  logo_url: string | null
  owner_name: string
}

interface OrganizationContextType {
  isInOrganization: boolean
  organization: OrganizationData | null
  loading: boolean
  refreshOrganization: () => void
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined)

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user, profile, profileReady } = useAuth()
  const [organization, setOrganization] = useState<OrganizationData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchOrganization = useCallback(async () => {
    if (!user?.id) { setLoading(false); return }
    try {
      const res = await fetch('/api/organization?action=get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id })
      })
      const data = await res.json()
      setOrganization(data.organization || null)
    } catch {
      setOrganization(null)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (!profileReady) return
    fetchOrganization()
  }, [profileReady, profile?.business_member_id, fetchOrganization])

  return (
    <OrganizationContext.Provider value={{
      isInOrganization: !!organization,
      organization,
      loading,
      refreshOrganization: fetchOrganization,
    }}>
      {children}
    </OrganizationContext.Provider>
  )
}

export function useOrganization() {
  const context = useContext(OrganizationContext)
  if (!context) throw new Error('useOrganization must be used within OrganizationProvider')
  return context
}
