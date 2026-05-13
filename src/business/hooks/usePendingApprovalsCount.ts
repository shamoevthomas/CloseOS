import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'

/**
 * Real-time count of pending commission_approvals visible to the current user.
 * Returns 0 for users who cannot approve (closers, setters).
 * Returns count of pending approvals for owner / Head of Sales / Admin.
 */
export function usePendingApprovalsCount(): number {
  const { isTeamMember, teamMember, ownerUserId, user } = useBusinessAuth()
  const [count, setCount] = useState(0)

  const businessOwnerId = ownerUserId || user?.id || null
  const canApprove =
    !!businessOwnerId &&
    (!isTeamMember || teamMember?.role === 'Head of Sales' || teamMember?.role === 'Admin')

  useEffect(() => {
    if (!canApprove || !businessOwnerId) {
      setCount(0)
      return
    }

    let cancelled = false

    const fetchCount = async () => {
      const { count: c } = await supabase
        .from('commission_approvals')
        .select('id', { count: 'exact', head: true })
        .eq('business_owner_id', businessOwnerId)
        .eq('status', 'pending')
      if (!cancelled) setCount(c || 0)
    }

    fetchCount()

    const channel = supabase
      .channel(`commission-approvals-${businessOwnerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'commission_approvals',
          filter: `business_owner_id=eq.${businessOwnerId}`,
        },
        () => {
          fetchCount()
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [canApprove, businessOwnerId])

  return count
}
