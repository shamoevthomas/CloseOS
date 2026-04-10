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

interface OrganizationListItem {
  member_id: string
  owner_id: string
  role: string
  joined_at: string
  org_name: string
  logo_url: string | null
  owner_name: string
  is_active: boolean
}

interface OrganizationContextType {
  isInOrganization: boolean
  organization: OrganizationData | null
  organizations: OrganizationListItem[]
  loading: boolean
  refreshOrganization: () => void
  switchOrganization: (memberId: string) => Promise<void>
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined)

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user, profile, profileReady } = useAuth()
  const [organization, setOrganization] = useState<OrganizationData | null>(null)
  const [organizations, setOrganizations] = useState<OrganizationListItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchOrganization = useCallback(async () => {
    if (!user?.id) { setLoading(false); return }
    try {
      const [getRes, listRes] = await Promise.all([
        fetch('/api/organization?action=get', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id })
        }),
        fetch('/api/organization?action=list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id })
        }),
      ])
      const [getData, listData] = await Promise.all([getRes.json(), listRes.json()])
      setOrganization(getData.organization || null)
      setOrganizations(listData.organizations || [])
    } catch {
      setOrganization(null)
      setOrganizations([])
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  const switchOrganization = useCallback(async (memberId: string) => {
    if (!user?.id) return
    await fetch('/api/organization?action=switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, member_id: memberId })
    })
    await fetchOrganization()
  }, [user?.id, fetchOrganization])

  useEffect(() => {
    if (!profileReady) return
    fetchOrganization()
  }, [profileReady, profile?.business_member_id, fetchOrganization])

  return (
    <OrganizationContext.Provider value={{
      isInOrganization: !!organization,
      organization,
      organizations,
      loading,
      refreshOrganization: fetchOrganization,
      switchOrganization,
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
