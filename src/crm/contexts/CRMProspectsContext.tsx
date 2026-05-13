import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useCRMAuth } from './CRMAuthContext'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface CRMProspect {
  id: number
  user_id: string
  contact?: string | null
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  phone?: string | null
  company?: string | null
  title?: string | null
  stage: string
  previous_stage?: string | null
  value?: number | null
  offer?: string | null
  formula_id?: string | null
  campaign_id?: string | null
  notes?: string | null
  call_notes?: { id: string; date: string; content: string; author?: string }[]
  source?: string | null
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  utm_content?: string | null
  utm_term?: string | null
  avatar_url?: string | null
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
  subscription_status?: string | null
  subscription_amount?: number | null
  subscription_interval?: string | null
  matched_via?: string | null
  last_payment_date?: string | null
  next_payment_date?: string | null
  last_contact?: string | null
  loss_reason?: string | null
  loss_details?: string | null
  pipeline_visible?: boolean | null
  created_at?: string | null
  updated_at?: string | null
  // Commission inhabituelle + échéancier custom
  custom_commission_rate?: number | null
  installments_schedule?: { month: number; amount: number }[] | null
  payment_type?: string | null
  installments?: number | null
}

export interface CRMCampaign {
  id: string
  user_id: string
  name: string
  slug: string
  description: string | null
  is_active: boolean
  capture_mode: string
  formula_id: string | null
  stripe_price_id: string | null
  payment_timing: string | null
  redirect_url: string | null
  fields: any[]
  config: Record<string, any>
  created_at: string
  updated_at: string
  leads_count?: number
}

export interface CRMAppointment {
  id: number
  user_id: string
  prospect_id: number | null
  campaign_id: string | null
  title: string | null
  description: string | null
  datetime_utc: string | null
  date: string | null
  time: string | null
  duration_minutes: number | null
  status: string
  meeting_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CRMFormula {
  id: string
  user_id: string
  name: string
  price: number
  description: string | null
  resources: { name: string; url: string; type: string }[]
  is_active: boolean
  billing_type: 'one_time' | 'subscription' | 'quote'
  billing_interval?: 'monthly' | 'quarterly' | 'annual' | null
  yearly_price?: number | null
  created_at: string
  updated_at: string
}

interface CRMProspectsValue {
  prospects: CRMProspect[]
  campaigns: CRMCampaign[]
  appointments: CRMAppointment[]
  formulas: CRMFormula[]
  loading: boolean
  refresh: () => Promise<void>
  // Prospects
  addProspect: (data: Partial<CRMProspect>) => Promise<CRMProspect | null>
  updateProspect: (id: number, updates: Partial<CRMProspect>) => Promise<void>
  deleteProspect: (id: number) => Promise<void>
  // Campaigns
  addCampaign: (data: Partial<CRMCampaign>) => Promise<CRMCampaign | null>
  updateCampaign: (id: string, updates: Partial<CRMCampaign>) => Promise<void>
  deleteCampaign: (id: string) => Promise<void>
  // Formulas
  addFormula: (data: Partial<CRMFormula>) => Promise<CRMFormula | null>
  updateFormula: (id: string, updates: Partial<CRMFormula>) => Promise<void>
  deleteFormula: (id: string) => Promise<void>
}

const CRMProspectsContext = createContext<CRMProspectsValue | null>(null)

export function CRMProspectsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useCRMAuth()
  const [prospects, setProspects] = useState<CRMProspect[]>([])
  const [campaigns, setCampaigns] = useState<CRMCampaign[]>([])
  const [appointments, setAppointments] = useState<CRMAppointment[]>([])
  const [formulas, setFormulas] = useState<CRMFormula[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setProspects([])
      setCampaigns([])
      setAppointments([])
      setFormulas([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [pRes, cRes, aRes, fRes] = await Promise.all([
        supabase.from('crm_prospects').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('crm_campaigns').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('crm_appointments').select('*').eq('user_id', user.id).order('datetime_utc', { ascending: false }),
        supabase.from('crm_formulas').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      ])
      setProspects((pRes.data as CRMProspect[]) || [])
      // Compute leads count per campaign from prospects
      const campaignsList = (cRes.data as CRMCampaign[]) || []
      const prospectsList = (pRes.data as CRMProspect[]) || []
      const withCounts = campaignsList.map(c => ({
        ...c,
        leads_count: prospectsList.filter(p => p.campaign_id === c.id).length,
      }))
      setCampaigns(withCounts)
      setAppointments((aRes.data as CRMAppointment[]) || [])
      setFormulas((fRes.data as CRMFormula[]) || [])
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { refresh() }, [refresh])

  // ── Prospects ──
  const addProspect = useCallback(async (data: Partial<CRMProspect>) => {
    if (!user?.id) return null
    const payload = { ...data, user_id: user.id, stage: data.stage || 'prospect' }
    const { data: row, error } = await supabase.from('crm_prospects').insert(payload).select().single()
    if (error) { console.error('addProspect error:', error); return null }
    setProspects(prev => [row as CRMProspect, ...prev])
    return row as CRMProspect
  }, [user?.id])

  const updateProspect = useCallback(async (id: number, updates: Partial<CRMProspect>) => {
    if (!user?.id) return
    const { error } = await supabase.from('crm_prospects').update(updates).eq('id', id).eq('user_id', user.id)
    if (error) { console.error('updateProspect error:', error); return }
    setProspects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
  }, [user?.id])

  const deleteProspect = useCallback(async (id: number) => {
    if (!user?.id) return
    const { error } = await supabase.from('crm_prospects').delete().eq('id', id).eq('user_id', user.id)
    if (error) { console.error('deleteProspect error:', error); return }
    setProspects(prev => prev.filter(p => p.id !== id))
  }, [user?.id])

  // ── Campaigns ──
  const addCampaign = useCallback(async (data: Partial<CRMCampaign>) => {
    if (!user?.id) return null
    const slug = data.slug || `campaign-${Date.now().toString(36)}`
    const payload = { ...data, user_id: user.id, slug }
    const { data: row, error } = await supabase.from('crm_campaigns').insert(payload).select().single()
    if (error) { console.error('addCampaign error:', error); return null }
    setCampaigns(prev => [{ ...(row as CRMCampaign), leads_count: 0 }, ...prev])
    return row as CRMCampaign
  }, [user?.id])

  const updateCampaign = useCallback(async (id: string, updates: Partial<CRMCampaign>) => {
    if (!user?.id) return
    const { error } = await supabase.from('crm_campaigns').update(updates).eq('id', id).eq('user_id', user.id)
    if (error) { console.error('updateCampaign error:', error); return }
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
  }, [user?.id])

  const deleteCampaign = useCallback(async (id: string) => {
    if (!user?.id) return
    const { error } = await supabase.from('crm_campaigns').delete().eq('id', id).eq('user_id', user.id)
    if (error) { console.error('deleteCampaign error:', error); return }
    setCampaigns(prev => prev.filter(c => c.id !== id))
  }, [user?.id])

  // ── Formulas ──
  const addFormula = useCallback(async (data: Partial<CRMFormula>) => {
    if (!user?.id) return null
    const payload = { ...data, user_id: user.id }
    const { data: row, error } = await supabase.from('crm_formulas').insert(payload).select().single()
    if (error) { console.error('addFormula error:', error); return null }
    setFormulas(prev => [row as CRMFormula, ...prev])
    return row as CRMFormula
  }, [user?.id])

  const updateFormula = useCallback(async (id: string, updates: Partial<CRMFormula>) => {
    if (!user?.id) return
    const { error } = await supabase.from('crm_formulas').update(updates).eq('id', id).eq('user_id', user.id)
    if (error) { console.error('updateFormula error:', error); return }
    setFormulas(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f))
  }, [user?.id])

  const deleteFormula = useCallback(async (id: string) => {
    if (!user?.id) return
    const { error } = await supabase.from('crm_formulas').delete().eq('id', id).eq('user_id', user.id)
    if (error) { console.error('deleteFormula error:', error); return }
    setFormulas(prev => prev.filter(f => f.id !== id))
  }, [user?.id])

  const value = useMemo<CRMProspectsValue>(() => ({
    prospects, campaigns, appointments, formulas, loading, refresh,
    addProspect, updateProspect, deleteProspect,
    addCampaign, updateCampaign, deleteCampaign,
    addFormula, updateFormula, deleteFormula,
  }), [prospects, campaigns, appointments, formulas, loading, refresh,
       addProspect, updateProspect, deleteProspect,
       addCampaign, updateCampaign, deleteCampaign,
       addFormula, updateFormula, deleteFormula])

  return <CRMProspectsContext.Provider value={value}>{children}</CRMProspectsContext.Provider>
}

export function useCRMProspects() {
  const ctx = useContext(CRMProspectsContext)
  if (!ctx) throw new Error('useCRMProspects must be used within CRMProspectsProvider')
  return ctx
}
