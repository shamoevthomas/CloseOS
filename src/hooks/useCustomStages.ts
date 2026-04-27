import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export interface CustomStage {
  id: number
  user_id: string
  name: string
  description: string | null
  color: string
  is_active: boolean
  position: number
  created_at: string
}

export interface StageDefinition {
  id: string
  name: string
  color: string
  isDefault: boolean
  position: number
}

// Stages par défaut Sales (Closer) — ordre fixe, non modifiables
const DEFAULT_STAGES_BASE: StageDefinition[] = [
  { id: 'prospect', name: 'Prospect', color: 'bg-blue-500', isDefault: true, position: 0 },
  { id: 'qualified', name: 'Qualifié', color: 'bg-purple-500', isDefault: true, position: 1 },
  { id: 'won', name: 'Gagné', color: 'bg-emerald-500', isDefault: true, position: 2 },
  { id: 'followup', name: 'Follow Up', color: 'bg-orange-500', isDefault: true, position: 3 },
  { id: 'noshow', name: 'No Show', color: 'bg-slate-600', isDefault: true, position: 4 },
  { id: 'lost', name: 'Perdu', color: 'bg-red-500', isDefault: true, position: 5 },
]

// Stages additionnels pour les rôles Setter / Setter-Closer (alignés avec Business)
const EXTRA_SETTER_STAGES: StageDefinition[] = [
  { id: 'noanswer', name: 'Pas de réponse', color: 'bg-cyan-500', isDefault: true, position: 6 },
  { id: 'unqualified', name: 'Non qualifié', color: 'bg-yellow-500', isDefault: true, position: 7 },
]

// Stages par défaut "actifs" (colonnes principales du Kanban)
const DEFAULT_ACTIVE_IDS_BASE = new Set(['prospect', 'qualified', 'won', 'followup'])
const DEFAULT_INACTIVE_IDS_BASE = new Set(['noshow', 'lost'])

// Pour rétrocompat (anciens imports)
const DEFAULT_STAGES = DEFAULT_STAGES_BASE
const DEFAULT_ACTIVE_IDS = DEFAULT_ACTIVE_IDS_BASE
const DEFAULT_INACTIVE_IDS = DEFAULT_INACTIVE_IDS_BASE

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

export function useCustomStages() {
  const { user, showsSetterFeatures } = useAuth()
  const [customStages, setCustomStages] = useState<CustomStage[]>([])
  const [loading, setLoading] = useState(true)

  // Default stages depend on the user's role (Setter / Setter-Closer get noanswer + unqualified)
  const defaultStages = useMemo<StageDefinition[]>(() =>
    showsSetterFeatures ? [...DEFAULT_STAGES_BASE, ...EXTRA_SETTER_STAGES] : DEFAULT_STAGES_BASE,
    [showsSetterFeatures]
  )
  const activeIds = useMemo<Set<string>>(() => {
    const s = new Set(DEFAULT_ACTIVE_IDS_BASE)
    if (showsSetterFeatures) s.add('noanswer')
    return s
  }, [showsSetterFeatures])
  const inactiveIds = useMemo<Set<string>>(() => {
    const s = new Set(DEFAULT_INACTIVE_IDS_BASE)
    if (showsSetterFeatures) s.add('unqualified')
    return s
  }, [showsSetterFeatures])

  const fetchCustomStages = useCallback(async () => {
    if (!user?.id) return
    const { data } = await supabase
      .from('custom_stages')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('position')
    setCustomStages(data || [])
    setLoading(false)
  }, [user?.id])

  useEffect(() => { fetchCustomStages() }, [fetchCustomStages])

  // Merge: defaults first, then custom stages after
  const allStages = useMemo<StageDefinition[]>(() => {
    const customs: StageDefinition[] = customStages.map((s, i) => ({
      id: `custom_${s.id}`,
      name: s.name,
      color: s.color,
      isDefault: false,
      position: defaultStages.length + i,
    }))
    return [...defaultStages, ...customs]
  }, [customStages, defaultStages])

  // Active stages for Kanban (defaults active + all custom)
  const activeStages = useMemo(() =>
    allStages.filter(s => activeIds.has(s.id) || !s.isDefault),
    [allStages, activeIds]
  )

  // Inactive stages for Kanban
  const inactiveStages = useMemo(() =>
    allStages.filter(s => inactiveIds.has(s.id)),
    [allStages, inactiveIds]
  )

  const addCustomStage = async (stage: { name: string; description?: string; color: string }) => {
    if (!user?.id) return
    const maxPos = customStages.length > 0 ? Math.max(...customStages.map(s => s.position)) + 1 : 0
    const { error } = await supabase.from('custom_stages').insert([{
      user_id: user.id,
      name: stage.name,
      description: stage.description || null,
      color: stage.color,
      position: maxPos,
    }])
    if (error) throw error
    await fetchCustomStages()
  }

  const updateCustomStage = async (id: number, updates: { name?: string; color?: string; description?: string }) => {
    const { error } = await supabase.from('custom_stages').update(updates).eq('id', id)
    if (error) throw error
    await fetchCustomStages()
  }

  const deleteCustomStage = async (id: number) => {
    await supabase.from('custom_stages').update({ is_active: false }).eq('id', id)
    await fetchCustomStages()
  }

  const reorderCustomStages = async (reordered: { id: number; position: number }[]) => {
    for (const item of reordered) {
      await supabase.from('custom_stages').update({ position: item.position }).eq('id', item.id)
    }
    await fetchCustomStages()
  }

  // Resolve a stage ID to its display info (works for both default and custom)
  const getStageInfo = useCallback((stageId: string): StageDefinition | undefined => {
    return allStages.find(s => s.id === stageId)
  }, [allStages])

  // Get the slug for a custom stage name (used when storing in prospects.stage)
  const getSlug = useCallback((name: string) => slugify(name), [])

  return {
    allStages,
    activeStages,
    inactiveStages,
    defaultStages,
    customStages,
    loading,
    addCustomStage,
    updateCustomStage,
    deleteCustomStage,
    reorderCustomStages,
    getStageInfo,
    getSlug,
    refetch: fetchCustomStages,
  }
}

// Export defaults for places that need them without the hook
export { DEFAULT_STAGES, DEFAULT_ACTIVE_IDS, DEFAULT_INACTIVE_IDS }
