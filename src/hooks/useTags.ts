import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

export interface Tag {
  id: string
  user_id: string
  name: string
  color: string
  created_at: string
}

const DEFAULT_TAGS: { name: string; color: string }[] = [
  { name: 'VIP', color: '#f59e0b' },
  { name: 'Chaud', color: '#ef4444' },
  { name: 'Froid', color: '#3b82f6' },
  { name: 'Relancer', color: '#f97316' },
  { name: 'Urgent', color: '#ec4899' },
]

export function useTags() {
  const { user } = useAuth()
  const [tags, setTags] = useState<Tag[]>([])
  const [prospectTags, setProspectTags] = useState<Record<number, string[]>>({})
  const [loading, setLoading] = useState(true)

  const fetchTags = useCallback(async () => {
    if (!user?.id) return
    const { data } = await supabase
      .from('tags')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at')

    if (data && data.length === 0) {
      // Seed default tags
      const { data: seeded } = await supabase
        .from('tags')
        .insert(DEFAULT_TAGS.map(t => ({ user_id: user.id, name: t.name, color: t.color })))
        .select()
      setTags(seeded || [])
    } else {
      setTags(data || [])
    }
  }, [user?.id])

  const fetchProspectTags = useCallback(async () => {
    if (!user?.id) return
    const { data } = await supabase
      .from('prospect_tags')
      .select('prospect_id, tag_id')
    if (!data) return

    const map: Record<number, string[]> = {}
    for (const row of data) {
      if (!map[row.prospect_id]) map[row.prospect_id] = []
      map[row.prospect_id].push(row.tag_id)
    }
    setProspectTags(map)
  }, [user?.id])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await fetchTags()
      await fetchProspectTags()
      setLoading(false)
    }
    load()
  }, [fetchTags, fetchProspectTags])

  const createTag = async (name: string, color: string) => {
    if (!user?.id) return
    const { data, error } = await supabase
      .from('tags')
      .insert([{ user_id: user.id, name: name.trim(), color }])
      .select()
      .single()
    if (error) {
      if (error.code === '23505') toast.error('Ce tag existe déjà')
      else toast.error('Erreur lors de la création du tag')
      return
    }
    setTags(prev => [...prev, data])
    toast.success(`Tag "${name}" créé`)
  }

  const updateTag = async (id: string, updates: { name?: string; color?: string }) => {
    const { error } = await supabase.from('tags').update(updates).eq('id', id)
    if (error) {
      toast.error('Erreur lors de la mise à jour')
      return
    }
    setTags(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
  }

  const deleteTag = async (id: string) => {
    const { error } = await supabase.from('tags').delete().eq('id', id)
    if (error) {
      toast.error('Erreur lors de la suppression')
      return
    }
    setTags(prev => prev.filter(t => t.id !== id))
    // Clean up local prospect tag references
    setProspectTags(prev => {
      const next = { ...prev }
      for (const pid of Object.keys(next)) {
        next[Number(pid)] = next[Number(pid)].filter(tid => tid !== id)
      }
      return next
    })
  }

  const addTagToProspect = async (prospectId: number, tagId: string) => {
    const { error } = await supabase
      .from('prospect_tags')
      .insert([{ prospect_id: prospectId, tag_id: tagId }])
    if (error) return
    setProspectTags(prev => ({
      ...prev,
      [prospectId]: [...(prev[prospectId] || []), tagId],
    }))
  }

  const removeTagFromProspect = async (prospectId: number, tagId: string) => {
    const { error } = await supabase
      .from('prospect_tags')
      .delete()
      .eq('prospect_id', prospectId)
      .eq('tag_id', tagId)
    if (error) return
    setProspectTags(prev => ({
      ...prev,
      [prospectId]: (prev[prospectId] || []).filter(id => id !== tagId),
    }))
  }

  const getProspectTagObjects = (prospectId: number): Tag[] => {
    const ids = prospectTags[prospectId] || []
    return ids.map(id => tags.find(t => t.id === id)).filter(Boolean) as Tag[]
  }

  const getTagProspectCount = (tagId: string): number => {
    return Object.values(prospectTags).filter(ids => ids.includes(tagId)).length
  }

  return {
    tags,
    prospectTags,
    loading,
    createTag,
    updateTag,
    deleteTag,
    addTagToProspect,
    removeTagFromProspect,
    getProspectTagObjects,
    getTagProspectCount,
    refetch: async () => { await fetchTags(); await fetchProspectTags() },
  }
}
