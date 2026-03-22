import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'

export interface CustomStage {
  id: number
  business_owner_id: string
  name: string
  description: string | null
  color: string
  roles: string[]
  is_active: boolean
  position: number
  created_at: string
}

export function useCustomStages() {
  const { user, ownerUserId, isTeamMember, teamMember } = useBusinessAuth()
  const effectiveOwnerId = ownerUserId || user?.id
  const isOwnerOrHOS = !isTeamMember || teamMember?.role === 'Head of Sales' || teamMember?.role === 'Admin'

  const [customStages, setCustomStages] = useState<CustomStage[]>([])
  const [loading, setLoading] = useState(true)

  const fetchCustomStages = useCallback(async () => {
    if (!effectiveOwnerId) return
    const { data } = await supabase
      .from('business_custom_stages')
      .select('*')
      .eq('business_owner_id', effectiveOwnerId)
      .eq('is_active', true)
      .order('position')
    setCustomStages(data || [])
    setLoading(false)
  }, [effectiveOwnerId])

  useEffect(() => { fetchCustomStages() }, [fetchCustomStages])

  const addCustomStage = async (stage: { name: string; description: string; color: string; roles: string[] }) => {
    if (!effectiveOwnerId) return
    const maxPos = customStages.length > 0 ? Math.max(...customStages.map(s => s.position)) + 1 : 0
    const { error } = await supabase.from('business_custom_stages').insert([{
      business_owner_id: effectiveOwnerId,
      name: stage.name,
      description: stage.description || null,
      color: stage.color,
      roles: stage.roles,
      position: maxPos,
    }])
    if (error) throw error
    await fetchCustomStages()
  }

  const deleteCustomStage = async (id: number) => {
    await supabase.from('business_custom_stages').update({ is_active: false }).eq('id', id)
    await fetchCustomStages()
  }

  // Filter stages by role for team members
  const getStagesForRole = useCallback((role?: string) => {
    if (!role) return customStages
    return customStages.filter(s => s.roles.includes(role))
  }, [customStages])

  return {
    customStages,
    loading,
    addCustomStage,
    deleteCustomStage,
    getStagesForRole,
    canManage: isOwnerOrHOS,
    refetch: fetchCustomStages,
  }
}
