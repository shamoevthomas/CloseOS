import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface ProspectTask {
  id: number
  user_id: string
  prospect_id: number
  title: string
  due_date: string | null
  is_done: boolean
  done_at: string | null
  created_at: string
}

export interface OpenTaskWithProspect extends ProspectTask {
  prospect: { id: number; contact: string | null; firstName: string | null; lastName: string | null } | null
}

/** Tâches d'un prospect donné + CRUD */
export function useProspectTasks(prospectId?: number | null) {
  const [tasks, setTasks] = useState<ProspectTask[]>([])
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    if (!prospectId) { setTasks([]); return }
    setLoading(true)
    const { data } = await supabase
      .from('prospect_tasks')
      .select('*')
      .eq('prospect_id', prospectId)
      .order('is_done', { ascending: true })
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
    setTasks((data as ProspectTask[]) || [])
    setLoading(false)
  }, [prospectId])

  useEffect(() => { reload() }, [reload])

  const addTask = useCallback(async (title: string, dueDate: string | null) => {
    if (!prospectId || !title.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase
      .from('prospect_tasks')
      .insert({ prospect_id: prospectId, title: title.trim(), due_date: dueDate || null, user_id: user.id })
      .select('*')
      .single()
    if (!error && data) setTasks(prev => [...prev, data as ProspectTask])
  }, [prospectId])

  const toggleTask = useCallback(async (task: ProspectTask) => {
    const next = !task.is_done
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, is_done: next, done_at: next ? new Date().toISOString() : null } : t))
    await supabase.from('prospect_tasks').update({ is_done: next, done_at: next ? new Date().toISOString() : null }).eq('id', task.id)
  }, [])

  const deleteTask = useCallback(async (id: number) => {
    setTasks(prev => prev.filter(t => t.id !== id))
    await supabase.from('prospect_tasks').delete().eq('id', id)
  }, [])

  const openCount = tasks.filter(t => !t.is_done).length

  return { tasks, loading, reload, addTask, toggleTask, deleteTask, openCount }
}

/** Toutes les tâches ouvertes de l'utilisateur (widget Dashboard) */
export function useAllOpenTasks() {
  const [tasks, setTasks] = useState<OpenTaskWithProspect[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('prospect_tasks')
      .select('*, prospect:prospects(id, contact, "firstName", "lastName")')
      .eq('is_done', false)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
      .limit(100)
    setTasks((data as OpenTaskWithProspect[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])

  const toggleDone = useCallback(async (id: number) => {
    setTasks(prev => prev.filter(t => t.id !== id))
    await supabase.from('prospect_tasks').update({ is_done: true, done_at: new Date().toISOString() }).eq('id', id)
  }, [])

  return { tasks, loading, reload, toggleDone }
}
