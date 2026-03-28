import { useState, useEffect, useCallback, useRef } from 'react'
import { PhoneInput } from './PhoneInput'
import { useNavigate } from 'react-router-dom'
import {
  X, Phone, Mail, Calendar, Pencil, Trash2,
  MessageCircle, Save, Clock, Plus, ChevronDown,
  Bell, Check, Loader2, FileText, ClipboardList,
  Package, ExternalLink, PhoneCall, Tag, Camera,
  CreditCard, Wallet, Link2, Search, Zap, CheckCircle2,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { type BusinessProspect } from '../contexts/BusinessProspectsContext'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useCustomStages } from '../hooks/useCustomStages'
import { supabase } from '../../lib/supabase'
import { fromUTC } from '../../lib/timezone'
import toast from 'react-hot-toast'

const GLASS_PANEL = 'bg-white/70 dark:bg-white/5 backdrop-blur-xl'
const LABEL_STYLE = 'text-[11px] font-business-display font-extrabold uppercase tracking-widest text-stone-500 dark:text-neutral-400'
const SELECT_CLS = 'w-full bg-[#f5f3f2] dark:bg-neutral-800 border-0 rounded-xl py-3.5 px-4 font-business-display font-bold text-stone-900 dark:text-white appearance-none focus:ring-2 focus:ring-stone-900 transition-all'
const INPUT_CLS = 'w-full bg-[#f5f3f2] dark:bg-neutral-800 border-0 rounded-xl px-4 py-3 text-sm text-stone-900 dark:text-white font-medium focus:ring-2 focus:ring-stone-900 transition-all placeholder:text-stone-400 dark:placeholder:text-neutral-500'

const ALL_STAGES = [
  { id: 'prospect', name: 'Prospect', color: 'bg-blue-500' },
  { id: 'qualified', name: 'Qualifié', color: 'bg-purple-500' },
  { id: 'unqualified', name: 'Non-Qualifié', color: 'bg-yellow-500' },
  { id: 'won', name: 'Gagné', color: 'bg-emerald-500' },
  { id: 'followup', name: 'Follow Up', color: 'bg-orange-500' },
  { id: 'noanswer', name: 'Pas de Réponse', color: 'bg-cyan-500' },
  { id: 'noshow', name: 'No Show', color: 'bg-slate-600' },
  { id: 'lost', name: 'Perdu', color: 'bg-red-500' },
]

interface CallNote {
  id: string
  date: string
  content: string
  author?: string
}

interface Formula {
  id: string
  name: string
  price: number
  description: string | null
  resources: { name: string; url: string; type: string }[]
  billing_type?: 'one_time' | 'subscription' | 'quote'
}

interface Campaign {
  id: string
  name: string
}

interface BusinessProspectViewProps {
  prospect: BusinessProspect
  onClose: () => void
  onUpdate: (id: number, updates: Partial<BusinessProspect>) => void
  onDelete: (id: number) => void
  inline?: boolean
  onDismissFromPipeline?: (prospectId: number, dismissed: boolean) => void
}

const API_URL = '/api/business'

export function BusinessProspectView({
  prospect,
  onClose,
  onUpdate,
  onDelete,
  inline = false,
  onDismissFromPipeline,
}: BusinessProspectViewProps) {
  const navigate = useNavigate()
  const { user, isTeamMember, teamMember, ownerUserId, userTimezone } = useBusinessAuth()
  const { customStages } = useCustomStages()
  const [teamMembers, setTeamMembers] = useState<{ id: string; first_name: string; last_name: string; role: string; setter_scope?: string }[]>([])

  // Pipeline dismissal state
  const [isDismissed, setIsDismissed] = useState(false)
  useEffect(() => {
    if (!user?.id || !prospect.id) return
    let cancelled = false
    supabase.from('business_pipeline_dismissals').select('id').eq('user_id', user.id).eq('prospect_id', prospect.id).maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setIsDismissed(!!data)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user?.id, prospect.id])

  // Qualification data (questionnaire answers)
  const [qualificationData, setQualificationData] = useState<{
    answers: { question_text: string; question_type: string; answer_value: any; expected_answer: any; score: number | null; is_eliminatory: boolean; sort_order: number }[]
    questionnaire: { max_eliminatory: number } | null
  } | null>(null)

  useEffect(() => {
    if (!prospect.campaign_id) return
    const ownerId = isTeamMember ? ownerUserId : user?.id
    if (!ownerId) return
    fetch(`${API_URL}?action=prospect-qualification&prospect_id=${prospect.id}&user_id=${ownerId}`)
      .then(r => r.json())
      .then(data => {
        if (data.answers && data.answers.length > 0) setQualificationData(data)
        else setQualificationData(null)
      })
      .catch(() => setQualificationData(null))
  }, [prospect.id, prospect.campaign_id, isTeamMember, ownerUserId, user?.id])

  // Who can assign: Owner, Head of Sales, Admin, and Setters only if they are the assigned setter on this prospect
  const isSetter = isTeamMember && (teamMember?.role === 'Setter' || teamMember?.role === 'Setter-Closer')
  const isSetterCloserSelf = isTeamMember && teamMember?.role === 'Setter-Closer' && teamMember?.setter_scope === 'self'
  const isHosOrAdmin = isTeamMember && (teamMember?.role === 'Head of Sales' || teamMember?.role === 'Admin')
  const isAssignedSetterOnProspect = isSetter && teamMember?.id === (prospect as any).assigned_setter
  const canAssign = !isTeamMember || isHosOrAdmin || (isAssignedSetterOnProspect && !isSetterCloserSelf)

  // Fetch team members + owner for assignment
  useEffect(() => {
    const ownerId = isTeamMember ? ownerUserId : user?.id
    if (!ownerId) return
    Promise.all([
      supabase.from('business_team_members').select('id, first_name, last_name, role, setter_scope, owner_assignable').eq('business_owner_id', ownerId),
      supabase.from('business_users').select('id, full_name, email, owner_assignable').eq('id', ownerId).single(),
    ]).then(([tmRes, ownerRes]) => {
      const list = tmRes.data || []
      if (ownerRes.data?.owner_assignable) {
        const nameParts = (ownerRes.data.full_name || 'Owner').split(' ')
        list.unshift({ id: ownerRes.data.id, first_name: nameParts[0] || 'Owner', last_name: nameParts.slice(1).join(' ') || '', role: 'Owner' })
      }
      setTeamMembers(list)
    })
  }, [user?.id, ownerUserId, isTeamMember])

  const [local, setLocal] = useState<BusinessProspect>(prospect)
  // Sync local when prospect changes (e.g., realtime update from call details)
  useEffect(() => {
    setLocal(prospect)
  }, [prospect.id])
  const [activeTab, setActiveTab] = useState<'info' | 'notes' | 'rappels' | 'historique'>('info')
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)

  // Payment details
  const [editingPayment, setEditingPayment] = useState(false)

  // Stripe linking (3 modes)
  const [stripeConnected, setStripeConnected] = useState(false)
  const [stripeLinkMode, setStripeLinkMode] = useState<'auto' | 'search' | 'manual'>('auto')
  const [stripeLinkOpen, setStripeLinkOpen] = useState(false)
  const [stripeSearchEmail, setStripeSearchEmail] = useState('')
  const [stripeSearching, setStripeSearching] = useState(false)
  const [stripeSearchResults, setStripeSearchResults] = useState<any[]>([])
  const [stripeSearched, setStripeSearched] = useState(false)
  const [stripeMatching, setStripeMatching] = useState(false)
  const [stripeManualCusId, setStripeManualCusId] = useState('')
  const [stripeManualSubId, setStripeManualSubId] = useState('')
  const [stripeAutoStatus, setStripeAutoStatus] = useState<'idle' | 'loading' | 'matched' | 'not_found'>('idle')
  const [paymentMode, setPaymentMode] = useState<'cash' | 'installments'>(prospect.payment_type === 'installments' ? 'installments' : 'cash')
  const [editedInstallments, setEditedInstallments] = useState(prospect.installments || 1)
  const [editedValue, setEditedValue] = useState(prospect.value || 0)
  const [memberCommissionRate, setMemberCommissionRate] = useState(10)

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Fichier image requis'); return }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image trop lourde (max 5 Mo)'); return }

    setAvatarUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const fileName = `prospect-${prospect.id}-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file)
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName)
      const avatarUrl = data.publicUrl

      await supabase.from('business_prospects').update({ avatar_url: avatarUrl }).eq('id', prospect.id)
      setLocal(prev => ({ ...prev, avatar_url: avatarUrl }))
      onUpdate(prospect.id, { avatar_url: avatarUrl })
      toast.success('Photo mise à jour')
    } catch (err) {
      console.error(err)
      toast.error('Erreur lors de l\'upload')
    } finally {
      setAvatarUploading(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  // Load commission rate for the viewing team member
  useEffect(() => {
    if (!isTeamMember || !teamMember?.id) return
    supabase.from('business_team_members').select('commission_rate').eq('id', teamMember.id).single()
      .then(({ data }) => {
        if (data?.commission_rate != null) setMemberCommissionRate(data.commission_rate)
      })
  }, [isTeamMember, teamMember?.id])

  // Sync payment state when prospect changes
  useEffect(() => {
    setEditedValue(prospect.value || 0)
    setPaymentMode(prospect.payment_type === 'installments' ? 'installments' : 'cash')
    setEditedInstallments(prospect.installments || 1)
  }, [prospect.id, prospect.value, prospect.payment_type, prospect.installments])

  // Permission: everyone can edit payment mode/installments, only owner+HOS can edit price
  const isOwner = !isTeamMember
  const canEditPrice = isOwner || isHosOrAdmin

  // Payment calculations
  const commissionRate = memberCommissionRate
  const commissionAmount = (editedValue * commissionRate) / 100
  const savedInstallments = local.installments || 1
  const savedCommission = (local.value || 0) * (commissionRate / 100)
  const savedMonthlyPayment = (local.value || 0) / savedInstallments
  const savedMonthlyCommission = savedCommission / savedInstallments
  const isPayingInInstallments = local.payment_type === 'installments' || (savedInstallments > 1)

  const handleSavePayment = () => {
    handleUpdate({
      value: editedValue,
      payment_type: paymentMode,
      installments: paymentMode === 'installments' ? editedInstallments : 1,
    } as any)
    setEditingPayment(false)
  }

  // Next appointment
  const [nextAppointment, setNextAppointment] = useState<{ date: string; time: string; status: string } | null>(null)
  useEffect(() => {
    const ownerId = isTeamMember ? ownerUserId : user?.id
    if (!ownerId || !prospect.id) return
    const nowUtc = new Date().toISOString()
    supabase
      .from('business_appointments')
      .select('date, time, status, datetime_utc')
      .eq('prospect_id', prospect.id)
      .in('status', ['pending', 'confirmed'])
      .order('date', { ascending: true })
      .order('time', { ascending: true })
      .then(({ data }) => {
        const future = (data || []).find(a => {
          if (a.datetime_utc) return a.datetime_utc > nowUtc
          // Fallback for old appointments without datetime_utc
          const now = new Date()
          const localNow = fromUTC(now.toISOString(), userTimezone)
          return a.date > localNow.date || (a.date === localNow.date && a.time >= localNow.time)
        })
        if (future && future.datetime_utc) {
          const local = fromUTC(future.datetime_utc, userTimezone)
          setNextAppointment({ date: local.date, time: local.time, status: future.status })
        } else {
          setNextAppointment(future ? { date: future.date, time: future.time?.slice(0, 5), status: future.status } : null)
        }
      })
  }, [prospect.id, user?.id, ownerUserId, isTeamMember, userTimezone])

  // Client edit
  const [editingClient, setEditingClient] = useState(false)
  const [editedContact, setEditedContact] = useState(prospect.contact)
  const [editedCompany, setEditedCompany] = useState(prospect.company)
  const [editedEmail, setEditedEmail] = useState(prospect.email)
  const [editedPhone, setEditedPhone] = useState(prospect.phone)

  // Notes internes
  const [editingNotes, setEditingNotes] = useState(false)
  const [tempNotes, setTempNotes] = useState(prospect.notes || '')

  // Call notes
  const [isAddingNote, setIsAddingNote] = useState(false)
  const [newNoteContent, setNewNoteContent] = useState('')
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null)

  // Reminders
  const [showReminderForm, setShowReminderForm] = useState(false)
  const [reminderTitle, setReminderTitle] = useState('')
  const [reminderDesc, setReminderDesc] = useState('')
  const [reminderDate, setReminderDate] = useState('')
  const [reminderTime, setReminderTime] = useState('')
  const [reminderSubmitting, setReminderSubmitting] = useState(false)
  const [prospectReminders, setProspectReminders] = useState<any[]>([])
  const [remindersLoading, setRemindersLoading] = useState(false)
  const [reminderActionLoading, setReminderActionLoading] = useState<number | null>(null)

  // Tags
  const [allTags, setAllTags] = useState<{ id: string; name: string; color: string }[]>([])
  const [prospectTagIds, setProspectTagIds] = useState<string[]>([])
  const [showTagPicker, setShowTagPicker] = useState(false)

  useEffect(() => {
    const ownerId = isTeamMember ? ownerUserId : user?.id
    if (!ownerId || !prospect.id) return
    supabase.from('business_tags').select('id, name, color').eq('owner_id', ownerId)
      .then(({ data }) => setAllTags(data || []))
    supabase.from('business_prospect_tags').select('tag_id').eq('prospect_id', prospect.id)
      .then(({ data }) => setProspectTagIds((data || []).map(d => d.tag_id)))
  }, [prospect.id, user?.id, ownerUserId, isTeamMember])

  const handleToggleTag = async (tagId: string) => {
    if (prospectTagIds.includes(tagId)) {
      await supabase.from('business_prospect_tags').delete().eq('prospect_id', prospect.id).eq('tag_id', tagId)
      setProspectTagIds(prev => prev.filter(id => id !== tagId))
    } else {
      await supabase.from('business_prospect_tags').insert({ prospect_id: prospect.id, tag_id: tagId })
      setProspectTagIds(prev => [...prev, tagId])
    }
  }

  // Formula & Campaign
  const [formula, setFormula] = useState<Formula | null>(null)
  const [allFormulas, setAllFormulas] = useState<Formula[]>([])
  const [campaign, setCampaign] = useState<Campaign | null>(null)

  // Sync local on prospect ID change (new prospect selected)
  useEffect(() => {
    const p = { ...prospect }
    setLocal(p)
    setTempNotes(p.notes || '')
    setEditedContact(p.contact)
    setEditedCompany(p.company)
    setEditedEmail(p.email)
    setEditedPhone(p.phone)
  }, [prospect.id])

  // Fetch all formulas
  useEffect(() => {
    const effectiveId = isTeamMember ? ownerUserId : user?.id
    if (!effectiveId) return
    fetch(`${API_URL}?action=formulas-list&user_id=${effectiveId}`)
      .then(r => r.json())
      .then(data => {
        const formulas = data.formulas || []
        setAllFormulas(formulas)
        if (prospect.formula_id) {
          const f = formulas.find((f: Formula) => f.id === prospect.formula_id)
          setFormula(f || null)
        } else {
          setFormula(null)
        }
      })
      .catch(() => { setAllFormulas([]); setFormula(null) })
  }, [user?.id, ownerUserId, isTeamMember, prospect.formula_id])

  // Check Stripe connection
  const effectiveOwnerId = isTeamMember ? ownerUserId : user?.id
  useEffect(() => {
    if (!effectiveOwnerId) return
    supabase.from('profiles').select('stripe_connected, stripe_account_id').eq('id', effectiveOwnerId).maybeSingle()
      .then(({ data }) => setStripeConnected(!!(data?.stripe_connected && data?.stripe_account_id)))
  }, [effectiveOwnerId])

  // Stripe: auto-match by email
  const handleStripeAutoMatch = async () => {
    if (!effectiveOwnerId || !local.email) return
    setStripeAutoStatus('loading')
    try {
      const res = await fetch('/api/business-auto-match-stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: effectiveOwnerId, prospect_id: local.id, email: local.email }),
      })
      const data = await res.json()
      if (data.matched) {
        setStripeAutoStatus('matched')
        onUpdate(local.id, {
          stripe_customer_id: data.stripe_customer_id,
          stripe_subscription_id: data.stripe_subscription_id,
          subscription_status: data.subscription_status,
          subscription_amount: data.subscription_amount,
          subscription_interval: data.subscription_interval,
          matched_via: data.matched_via,
        } as any)
        toast.success('Abonnement Stripe lie automatiquement')
      } else {
        setStripeAutoStatus('not_found')
      }
    } catch {
      setStripeAutoStatus('not_found')
    }
  }

  // Stripe: search by email
  const handleStripeSearch = async () => {
    if (!effectiveOwnerId || !stripeSearchEmail.trim()) return
    setStripeSearching(true)
    setStripeSearched(false)
    try {
      const res = await fetch(`/api/business-stripe-search?user_id=${effectiveOwnerId}&email=${encodeURIComponent(stripeSearchEmail.trim())}`)
      const data = await res.json()
      setStripeSearchResults(data.customers || [])
      setStripeSearched(true)
    } catch {
      setStripeSearchResults([])
      setStripeSearched(true)
    }
    setStripeSearching(false)
  }

  // Stripe: select subscription from search
  const handleStripeSelectSub = async (customerId: string, subscriptionId: string) => {
    if (!effectiveOwnerId) return
    setStripeMatching(true)
    try {
      const res = await fetch('/api/business-stripe-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: effectiveOwnerId, prospect_id: local.id, stripe_customer_id: customerId, stripe_subscription_id: subscriptionId }),
      })
      const data = await res.json()
      if (data.matched) {
        onUpdate(local.id, {
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          subscription_status: data.subscription_status,
          subscription_amount: data.subscription_amount,
          subscription_interval: data.subscription_interval,
          matched_via: 'manual',
        } as any)
        setStripeAutoStatus('matched')
        setStripeLinkOpen(false)
        toast.success('Abonnement Stripe lie')
      } else {
        toast.error('Impossible de lier l\'abonnement')
      }
    } catch {
      toast.error('Erreur de liaison Stripe')
    }
    setStripeMatching(false)
  }

  // Stripe: manual match
  const handleStripeManualMatch = async () => {
    if (!effectiveOwnerId || !stripeManualCusId.trim() || !stripeManualSubId.trim()) return
    setStripeMatching(true)
    try {
      const res = await fetch('/api/business-stripe-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: effectiveOwnerId, prospect_id: local.id, stripe_customer_id: stripeManualCusId.trim(), stripe_subscription_id: stripeManualSubId.trim() }),
      })
      const data = await res.json()
      if (data.matched) {
        onUpdate(local.id, {
          stripe_customer_id: stripeManualCusId.trim(),
          stripe_subscription_id: stripeManualSubId.trim(),
          subscription_status: data.subscription_status,
          subscription_amount: data.subscription_amount,
          subscription_interval: data.subscription_interval,
          matched_via: 'manual',
        } as any)
        setStripeAutoStatus('matched')
        setStripeLinkOpen(false)
        toast.success('Abonnement Stripe lie manuellement')
      } else {
        toast.error('Impossible de lier l\'abonnement')
      }
    } catch {
      toast.error('Erreur de liaison Stripe')
    }
    setStripeMatching(false)
  }

  // Fetch linked campaign
  useEffect(() => {
    const effectiveId = isTeamMember ? ownerUserId : user?.id
    if (!effectiveId || !(prospect as any).campaign_id) { setCampaign(null); return }
    fetch(`${API_URL}?action=campaigns-list&user_id=${effectiveId}`)
      .then(r => r.json())
      .then(data => {
        const c = (data.campaigns || []).find((c: Campaign) => c.id === (prospect as any).campaign_id)
        setCampaign(c || null)
      })
      .catch(() => setCampaign(null))
  }, [user?.id, ownerUserId, isTeamMember, (prospect as any).campaign_id])

  // Fetch reminders
  useEffect(() => {
    if (!user || !prospect.id) return
    let mounted = true
    setRemindersLoading(true)
    supabase
      .from('reminders')
      .select('*')
      .eq('user_id', user.id)
      .eq('prospect_id', prospect.id)
      .order('reminder_date', { ascending: true })
      .then(({ data }) => {
        if (mounted) {
          setProspectReminders(data || [])
          setRemindersLoading(false)
        }
      })
    return () => { mounted = false }
  }, [user, prospect.id])

  const activeRemindersCount = prospectReminders.filter(r => !r.is_done).length

  // History
  const [history, setHistory] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [expandedHistory, setExpandedHistory] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (activeTab !== 'historique' || !prospect.id) return
    setHistoryLoading(true)
    supabase
      .from('business_prospect_history')
      .select('*')
      .eq('prospect_id', prospect.id)
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setHistory(data || [])
        setHistoryLoading(false)
      })
  }, [activeTab, prospect.id])

  // -- Optimistic update helper --
  const handleUpdate = (updates: Partial<BusinessProspect>) => {
    setLocal(prev => ({ ...prev, ...updates }))
    const { id: _id, ...dbUpdates }: any = { ...updates }
    if (updates.call_notes !== undefined) {
      dbUpdates.call_notes = updates.call_notes
    }
    onUpdate(prospect.id, dbUpdates)
  }

  // -- Client save --
  const handleSaveClient = () => {
    const nameParts = editedContact.trim().split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''
    handleUpdate({ contact: editedContact, firstName, lastName, company: editedCompany, email: editedEmail, phone: editedPhone })
    setEditingClient(false)
  }

  // -- Notes --
  const handleSaveNotes = () => {
    handleUpdate({ notes: tempNotes })
    setEditingNotes(false)
  }

  // -- Call notes --
  const callNotes: CallNote[] = local.call_notes || []

  const handleAddManualNote = () => {
    const content = noteTextareaRef.current?.value || ''
    if (!content.trim()) return
    const newNote: CallNote = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      content,
      author: 'Manuel',
    }
    const updated = [newNote, ...callNotes]
    handleUpdate({ call_notes: updated })
    if (noteTextareaRef.current) noteTextareaRef.current.value = ''
    setIsAddingNote(false)
  }

  const handleDeleteNote = (noteId: string) => {
    if (!confirm('Supprimer cette note ?')) return
    const updated = callNotes.filter(n => n.id !== noteId)
    handleUpdate({ call_notes: updated })
  }

  // -- Reminders --
  const handleCreateReminder = async () => {
    if (!user || !reminderTitle.trim() || !reminderDate || !reminderTime) return
    setReminderSubmitting(true)
    try {
      const reminder_date = new Date(`${reminderDate}T${reminderTime}`).toISOString()
      const { data, error } = await supabase
        .from('reminders')
        .insert([{ user_id: user.id, title: reminderTitle.trim(), description: reminderDesc.trim() || null, reminder_date, prospect_id: prospect.id, is_done: false }])
        .select().single()
      if (error) throw error
      setProspectReminders(prev => [...prev, data])
      setShowReminderForm(false)
      setReminderTitle(''); setReminderDesc(''); setReminderDate(''); setReminderTime('')
      toast.success('Rappel créé')
    } catch { toast.error('Impossible de créer le rappel') }
    finally { setReminderSubmitting(false) }
  }

  const handleMarkReminderDone = async (id: number) => {
    if (!user) return
    setReminderActionLoading(id)
    try {
      await supabase.from('reminders').update({ is_done: true }).eq('id', id).eq('user_id', user.id)
      setProspectReminders(prev => prev.map(r => r.id === id ? { ...r, is_done: true } : r))
    } catch { /* ignore */ }
    finally { setReminderActionLoading(null) }
  }

  const handleDeleteReminder = async (id: number) => {
    if (!user) return
    setReminderActionLoading(id)
    try {
      await supabase.from('reminders').delete().eq('id', id).eq('user_id', user.id)
      setProspectReminders(prev => prev.filter(r => r.id !== id))
    } catch { /* ignore */ }
    finally { setReminderActionLoading(null) }
  }

  // -- Actions --
  const handleOpenGmail = () => {
    if (local.email) window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${local.email}`, '_blank')
    else toast.error('Email manquant')
  }
  const handleOpenWhatsApp = () => {
    if (local.phone) {
      const clean = local.phone.replace(/[^0-9+]/g, '')
      window.open(`https://wa.me/${clean}`, '_blank')
    } else toast.error('Téléphone manquant')
  }
  const handleDelete = () => {
    if (confirm(`Supprimer ${local.contact} ?`)) { onDelete(prospect.id); onClose() }
  }

  // Parse capture custom data from notes
  const getCaptureData = (): Record<string, string> | null => {
    if (!local.notes) return null
    try {
      const parsed = JSON.parse(local.notes)
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) return parsed
    } catch { /* not JSON */ }
    return null
  }
  const captureData = getCaptureData()

  const content = (
      <aside className={inline
        ? "flex flex-col h-full overflow-hidden bg-white/70 dark:bg-neutral-900/90 backdrop-blur-[20px]"
        : "absolute inset-y-0 right-0 w-full md:max-w-[580px] flex flex-col shadow-2xl md:rounded-l-2xl md:border-l border-[#c4c7c7]/10 dark:border-neutral-700 overflow-hidden bg-white/70 dark:bg-neutral-900/90 backdrop-blur-[20px]"
      }>

        {/* Header */}
        <header className="p-4 md:p-8 pb-4">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-5 min-w-0">
              <div className="flex flex-col items-center shrink-0 gap-1.5">
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  className="relative w-16 h-16 rounded-full bg-[#e4e2e1] dark:bg-neutral-800 flex items-center justify-center overflow-hidden text-2xl font-business-display font-extrabold text-stone-500 dark:text-neutral-400 group cursor-pointer"
                  title="Changer la photo"
                >
                  {local.avatar_url ? (
                    <img src={local.avatar_url} alt={local.contact} className="w-full h-full object-cover" />
                  ) : (
                    (local.contact || '?')[0]?.toUpperCase()
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                    {avatarUploading ? (
                      <Loader2 className="h-5 w-5 text-white animate-spin" />
                    ) : (
                      <Camera className="h-5 w-5 text-white" />
                    )}
                  </div>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </button>
                {/* Qualification score ring */}
                {(() => {
                  if (!qualificationData?.answers) return null
                  const scored = qualificationData.answers.filter(a => a.score !== null && a.score !== undefined)
                  if (scored.length === 0) return null
                  const avg = Math.round(scored.reduce((s, a) => s + (a.score ?? 0), 0) / scored.length)
                  const circumference = 2 * Math.PI * 24 // r=24
                  const strokeColor = avg < 40 ? 'stroke-red-500' : avg < 70 ? 'stroke-orange-500' : 'stroke-emerald-500'
                  const textColor = avg < 40 ? 'fill-red-500' : avg < 70 ? 'fill-orange-500' : 'fill-emerald-500'
                  return (
                    <svg className="w-14 h-14" viewBox="0 0 56 56">
                      <circle cx="28" cy="28" r="24" fill="none" strokeWidth="4" className="stroke-stone-200 dark:stroke-neutral-700" />
                      <circle cx="28" cy="28" r="24" fill="none" strokeWidth="4"
                        className={strokeColor}
                        strokeDasharray={`${(avg / 100) * circumference} ${circumference}`}
                        strokeLinecap="round"
                        transform="rotate(-90 28 28)"
                      />
                      <text x="28" y="28" textAnchor="middle" dominantBaseline="central"
                        className={cn('text-xs font-extrabold', textColor)}>
                        {avg}%
                      </text>
                    </svg>
                  )
                })()}
              </div>
              <div className="min-w-0">
                <h2 className="text-3xl font-business-display font-extrabold tracking-tight text-stone-900 dark:text-white truncate">
                  {local.contact || 'Sans nom'}
                </h2>
                {local.company && (
                  <p className="text-stone-500 dark:text-neutral-400 font-medium truncate">{local.company}</p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] w-12 h-12 rounded-full bg-[#f5f3f2] dark:bg-neutral-800 flex items-center justify-center hover:bg-[#efedec] dark:hover:bg-neutral-700 transition-colors shrink-0"
            >
              <X className="h-5 w-5 text-stone-900 dark:text-white" strokeWidth={1.5} />
            </button>
          </div>

          {/* Tags - below name */}
          <div className="mt-4 ml-0 md:ml-[84px] relative">
            <div className="flex flex-wrap items-center gap-2">
              {prospectTagIds.map(tagId => {
                const tag = allTags.find(t => t.id === tagId)
                if (!tag) return null
                return (
                  <button
                    key={tagId}
                    onClick={() => handleToggleTag(tagId)}
                    className="group inline-flex items-center gap-1.5 text-xs font-semibold pl-2 pr-1.5 py-1 rounded-full border transition-all hover:opacity-80"
                    style={{ borderColor: tag.color, color: tag.color }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                    {tag.name}
                    <X className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={2} />
                  </button>
                )
              })}
              <button
                onClick={() => setShowTagPicker(!showTagPicker)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-stone-400 dark:text-neutral-500 px-2.5 py-1 rounded-full border border-dashed border-stone-300 dark:border-neutral-600 hover:border-stone-400 dark:hover:border-neutral-500 hover:text-stone-500 dark:hover:text-neutral-400 transition-all"
              >
                <Plus className="h-3 w-3" strokeWidth={2} />
                tag
              </button>
            </div>

            {/* Tag dropdown */}
            {showTagPicker && (
              <div className="absolute left-0 top-full mt-1.5 z-20 bg-white dark:bg-neutral-900 rounded-xl shadow-lg border border-stone-200/60 dark:border-neutral-700 p-2 min-w-[200px] max-w-[300px]">
                <div className="flex flex-col gap-0.5">
                  {allTags.map(tag => {
                    const isActive = prospectTagIds.includes(tag.id)
                    return (
                      <button
                        key={tag.id}
                        onClick={() => handleToggleTag(tag.id)}
                        className={cn(
                          'flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-lg text-sm transition-all',
                          isActive ? 'bg-stone-100 dark:bg-neutral-800 font-semibold' : 'hover:bg-stone-50 dark:hover:bg-neutral-800'
                        )}
                      >
                        <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                        <span className="flex-1 text-stone-700 dark:text-neutral-200">{tag.name}</span>
                        {isActive && <Check className="h-3.5 w-3.5 text-stone-500 dark:text-neutral-400" strokeWidth={2} />}
                      </button>
                    )
                  })}
                  {allTags.length === 0 && (
                    <p className="text-xs text-stone-400 dark:text-neutral-500 text-center py-3">Aucun tag disponible</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Quick Actions */}
        <section className="px-8 py-5 flex flex-wrap gap-3 border-b border-[#c4c7c7]/10 dark:border-neutral-700">
          <button
            onClick={() => navigate(`/business/cockpit?name=${encodeURIComponent(local.contact)}&prospectId=${prospect.id}`)}
            className="flex items-center gap-2 px-6 py-3 bg-stone-900 text-white rounded-full font-business-display font-bold text-sm tracking-wide transition-transform active:scale-95 shadow-lg shadow-stone-900/20"
          >
            <PhoneCall className="h-4 w-4" strokeWidth={1.5} />
            Ouvrir le Call Room
          </button>
          <button
            onClick={() => setShowReminderForm(true)}
            className="flex items-center gap-2 px-5 py-3 bg-[#ffddb8] text-[#2a1700] dark:bg-amber-700/30 dark:text-amber-200 rounded-full font-business-display font-bold text-sm transition-all hover:brightness-105 active:scale-95"
          >
            <Bell className="h-4 w-4" strokeWidth={1.5} />
            Créer un rappel
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleOpenGmail}
              className="w-12 h-12 rounded-full bg-white dark:bg-neutral-800 border border-[#c4c7c7]/20 dark:border-neutral-700 flex items-center justify-center text-stone-900 dark:text-white hover:bg-[#f5f3f2] dark:hover:bg-neutral-700 transition-colors"
            >
              <Mail className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <button
              onClick={handleOpenWhatsApp}
              className="w-12 h-12 rounded-full bg-white dark:bg-neutral-800 border border-[#c4c7c7]/20 dark:border-neutral-700 flex items-center justify-center text-stone-900 dark:text-white hover:bg-[#f5f3f2] dark:hover:bg-neutral-700 transition-colors"
            >
              <MessageCircle className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>
        </section>

        {/* Tabs */}
        <nav className="px-4 md:px-8 pt-6 flex gap-4 md:gap-8 overflow-x-auto">
          {([
            { key: 'info' as const, label: 'Informations' },
            { key: 'notes' as const, label: "Notes d'Appel" },
            { key: 'rappels' as const, label: 'Rappels', badge: activeRemindersCount },
            { key: 'historique' as const, label: 'Historique' },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'pb-4 font-business-display font-bold transition-all flex items-center gap-2',
                activeTab === tab.key
                  ? 'text-stone-900 dark:text-white font-extrabold border-b-2 border-stone-900 dark:border-white'
                  : 'text-stone-400 dark:text-neutral-500 hover:text-stone-900 dark:hover:text-white'
              )}
            >
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="px-2 py-0.5 bg-[#ffddb8] text-[#2a1700] dark:bg-amber-700/30 dark:text-amber-200 text-[10px] rounded-full font-bold">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-8 custom-scrollbar">

          {/* ─── TAB: INFO ─── */}
          {activeTab === 'info' && (
            <div className="space-y-8">

              {/* Stage */}
              <div>
                <label className={cn(LABEL_STYLE, 'block mb-2 ml-1')}>Étape actuelle</label>
                <div className="relative">
                  <select
                    value={local.stage}
                    onChange={(e) => handleUpdate({ stage: e.target.value })}
                    className={cn(SELECT_CLS, 'py-4 px-5')}
                  >
                    {ALL_STAGES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    {customStages.length > 0 && <option disabled>──────────</option>}
                    {customStages.map(cs => <option key={`custom_${cs.id}`} value={`custom_${cs.id}`}>{cs.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none h-5 w-5 text-stone-400 dark:text-neutral-500" strokeWidth={1.5} />
                </div>
              </div>

              {/* SECTION RAISON DE PERTE — visible quand stage = lost */}
              {local.stage === 'lost' && (() => {
                const isAssignedSetter = isTeamMember && teamMember?.id === (local as any).assigned_setter
                const canEditLoss = !isTeamMember || isHosOrAdmin || isAssignedSetter
                // Parse from call_notes if loss_reason is empty
                let displayReason = (local as any).loss_reason || ''
                let displayDetails = (local as any).loss_details || ''
                if (!displayReason && Array.isArray(local.call_notes)) {
                  for (let i = local.call_notes.length - 1; i >= 0; i--) {
                    const match = local.call_notes[i].content?.match(/- Motif: (.+)/)
                    if (match) { displayReason = match[1]; break }
                  }
                }
                const lossReasons = ['Je dois y réfléchir', 'Argent/budget', 'Doit en parler', "C'est pas le moment", 'Peur', 'Ecran de fumée', 'Autre']
                return (
                  <div className="animate-in slide-in-from-top-4 fade-in duration-300">
                    <h3 className="flex items-center gap-2 text-sm font-business-display font-extrabold text-red-600 dark:text-red-400 mb-3">
                      <X className="h-4 w-4" /> Raison de la perte
                    </h3>
                    <div className="space-y-3 rounded-2xl border border-red-500/20 bg-red-500/5 dark:bg-red-500/5 p-5">
                      {canEditLoss ? (
                        <>
                          <div>
                            <label className="text-xs font-bold text-stone-500 dark:text-neutral-400 mb-1.5 block">Motif</label>
                            <div className="relative">
                              <select
                                value={displayReason}
                                onChange={(e) => handleUpdate({ loss_reason: e.target.value } as any)}
                                className={cn(SELECT_CLS, 'text-sm py-3')}
                              >
                                <option value="">Sélectionnez un motif</option>
                                {lossReasons.map(r => <option key={r} value={r}>{r}</option>)}
                              </select>
                              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none h-4 w-4 text-stone-400" strokeWidth={1.5} />
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-bold text-stone-500 dark:text-neutral-400 mb-1.5 block">Détails</label>
                            <input
                              type="text"
                              value={displayDetails}
                              onChange={(e) => handleUpdate({ loss_details: e.target.value } as any)}
                              placeholder="Précisez les détails..."
                              className={INPUT_CLS}
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <label className="text-xs font-bold text-stone-500 dark:text-neutral-400 mb-1 block">Motif</label>
                            <p className="text-sm font-medium text-stone-900 dark:text-white">{displayReason || '—'}</p>
                          </div>
                          {displayDetails && (
                            <div>
                              <label className="text-xs font-bold text-stone-500 dark:text-neutral-400 mb-1 block">Détails</label>
                              <p className="text-sm text-stone-700 dark:text-neutral-300">{displayDetails}</p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* SECTION PAIEMENT — visible quand stage = won */}
              {local.stage === 'won' && (
                <div className="animate-in slide-in-from-top-4 fade-in duration-300">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-business-display font-extrabold text-emerald-600 dark:text-emerald-400">
                      <CreditCard className="h-4 w-4" /> Détails du Paiement
                    </h3>
                    <button onClick={() => { setEditingPayment(!editingPayment); setEditedValue(local.value || 0); }} className="rounded-full p-2 text-stone-400 hover:bg-[#f5f3f2] dark:hover:bg-neutral-700 hover:text-stone-700 dark:hover:text-neutral-200 transition-colors">
                      <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </button>
                  </div>

                  {editingPayment ? (
                    <div className="space-y-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/5 p-5">
                      {canEditPrice ? (
                        <div>
                          <label className="text-xs font-bold text-stone-500 dark:text-neutral-400">Montant final (€)</label>
                          <input
                            type="number"
                            value={editedValue}
                            onChange={(e) => setEditedValue(parseFloat(e.target.value) || 0)}
                            className="mt-1.5 w-full rounded-xl border border-stone-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-4 py-3 text-sm font-bold text-stone-900 dark:text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-stone-500 dark:text-neutral-400">Montant Vente</span>
                          <span className="text-sm font-extrabold text-stone-900 dark:text-white">{(editedValue).toLocaleString()}€</span>
                        </div>
                      )}
                      <div className="flex rounded-xl bg-stone-100 dark:bg-neutral-800 p-1">
                        <button type="button" onClick={() => { setPaymentMode('cash'); setEditedInstallments(1); }} className={cn("flex-1 rounded-lg py-2 text-xs font-bold transition-all", paymentMode === 'cash' ? "bg-emerald-600 text-white shadow-md" : "text-stone-500 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white")}>Comptant</button>
                        <button type="button" onClick={() => setPaymentMode('installments')} className={cn("flex-1 rounded-lg py-2 text-xs font-bold transition-all", paymentMode === 'installments' ? "bg-emerald-600 text-white shadow-md" : "text-stone-500 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white")}>Plusieurs fois</button>
                      </div>
                      {paymentMode === 'installments' && (
                        <div className="animate-in fade-in slide-in-from-top-1">
                          <label className="text-xs font-bold text-stone-500 dark:text-neutral-400">Nombre de mensualités</label>
                          <select value={editedInstallments} onChange={(e) => setEditedInstallments(parseInt(e.target.value))} className="mt-1.5 w-full rounded-xl border border-stone-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-4 py-3 text-sm font-medium text-stone-900 dark:text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all">
                            {[2, 3, 4, 5, 6, 10, 12].map(n => <option key={n} value={n}>{n} fois ({(editedValue / n).toFixed(2)}€/mois)</option>)}
                          </select>
                        </div>
                      )}
                      <div className="rounded-xl bg-emerald-500/10 p-4 border border-emerald-500/20">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" /> Ta Commission ({commissionRate}%)</span>
                          <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">{commissionAmount.toFixed(2)}€</span>
                        </div>
                        {paymentMode === 'installments' && (
                          <p className="mt-1 text-[10px] text-emerald-500/70 dark:text-emerald-300/70">
                            Tu recevras : {(commissionAmount / editedInstallments).toFixed(2)}€ / mois
                          </p>
                        )}
                      </div>
                      <button onClick={handleSavePayment} className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-business-display font-bold text-white hover:bg-emerald-500 transition-colors">Valider les détails</button>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/5 p-5">
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-xs font-medium text-stone-500 dark:text-neutral-400">Montant Vente</span>
                        <span className="text-sm font-extrabold text-stone-900 dark:text-white">{(local.value || 0).toLocaleString()}€</span>
                      </div>
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-xs font-medium text-stone-500 dark:text-neutral-400">Commission Totale ({commissionRate}%)</span>
                        <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">+{savedCommission.toFixed(2)}€</span>
                      </div>

                      {isPayingInInstallments && (
                        <div className="mt-3 pt-3 border-t border-emerald-500/20 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-stone-500 dark:text-neutral-300">Client paie (x{savedInstallments}) :</span>
                            <span className="text-sm font-bold text-stone-900 dark:text-white">{savedMonthlyPayment.toFixed(2)}€ / mois</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-emerald-600/80 dark:text-emerald-400/80">Tu reçois :</span>
                            <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">{savedMonthlyCommission.toFixed(2)}€ / mois</span>
                          </div>
                        </div>
                      )}

                      <div className="pt-2.5 border-t border-emerald-500/20 text-center mt-2.5">
                        <span className="text-[10px] font-bold text-emerald-600/50 dark:text-emerald-300/50 uppercase tracking-widest">
                          {isPayingInInstallments ? `Paiement en ${savedInstallments} fois` : 'Paiement Comptant'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SECTION ABONNEMENT STRIPE — visible quand prospect matche ET formule abonnement ET Stripe connecte */}
              {local.stripe_subscription_id && formula?.billing_type === 'subscription' && stripeConnected && (
                <div className="animate-in slide-in-from-top-4 fade-in duration-300">
                  <h3 className="flex items-center gap-2 text-sm font-business-display font-extrabold text-[#635BFF] mb-3">
                    <CreditCard className="h-4 w-4" /> Abonnement Stripe
                  </h3>
                  <div className="rounded-2xl border border-[#635BFF]/20 bg-[#635BFF]/5 p-5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-stone-500 dark:text-neutral-400">Statut</span>
                      <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full', {
                        'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400': local.subscription_status === 'active',
                        'bg-amber-500/10 text-amber-600 dark:text-amber-400': local.subscription_status === 'past_due',
                        'bg-red-500/10 text-red-600 dark:text-red-400': local.subscription_status === 'canceled',
                        'bg-blue-500/10 text-blue-600 dark:text-blue-400': local.subscription_status === 'trialing',
                      })}>
                        {local.subscription_status === 'active' ? 'Actif' : local.subscription_status === 'past_due' ? 'En retard' : local.subscription_status === 'canceled' ? 'Annule' : local.subscription_status === 'trialing' ? 'Essai' : local.subscription_status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-stone-500 dark:text-neutral-400">Montant</span>
                      <span className="text-sm font-extrabold text-stone-900 dark:text-white">
                        {(Number(local.subscription_amount) || 0).toFixed(2)} EUR / {local.subscription_interval === 'month' ? 'mois' : 'an'}
                      </span>
                    </div>
                    {local.last_payment_date && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-stone-500 dark:text-neutral-400">Dernier paiement</span>
                        <span className="text-xs text-stone-700 dark:text-neutral-300">{new Date(local.last_payment_date).toLocaleDateString('fr-FR')}</span>
                      </div>
                    )}
                    {local.next_payment_date && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-stone-500 dark:text-neutral-400">Prochain paiement</span>
                        <span className="text-xs text-stone-700 dark:text-neutral-300">{new Date(local.next_payment_date).toLocaleDateString('fr-FR')}</span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-[#635BFF]/10 text-center">
                      <span className="text-[10px] font-bold text-[#635BFF]/50 uppercase tracking-widest">
                        {local.matched_via === 'webhook' ? 'Lie automatiquement (webhook)' : local.matched_via === 'auto_won' ? 'Lie automatiquement' : 'Lie manuellement'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Stripe linking — 3 modes (only for subscription formulas + Stripe connected) */}
              {local.stage === 'won' && formula?.billing_type === 'subscription' && stripeConnected && !local.stripe_subscription_id && stripeAutoStatus !== 'matched' && !(isTeamMember && teamMember?.role === 'Setter') && (
                <div className="space-y-3">
                  {!stripeLinkOpen ? (
                    <button
                      onClick={() => { setStripeLinkOpen(true); setStripeSearchEmail(local.email || '') }}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-[#635BFF]/30 text-[#635BFF] hover:bg-[#635BFF]/5 transition-colors text-sm font-bold"
                    >
                      <Link2 className="h-4 w-4" />
                      Lier un abonnement Stripe
                    </button>
                  ) : (
                    <div className="rounded-2xl border border-[#635BFF]/20 bg-[#635BFF]/5 dark:bg-[#635BFF]/5 p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="flex items-center gap-2 text-sm font-business-display font-extrabold text-[#635BFF]">
                          <CreditCard className="h-4 w-4" /> Lier a Stripe
                        </h3>
                        <button onClick={() => setStripeLinkOpen(false)} className="text-stone-400 hover:text-stone-600 dark:hover:text-white">
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      {/* 3 mode tabs */}
                      <div className="flex rounded-xl bg-white/60 dark:bg-neutral-800 p-1">
                        <button onClick={() => setStripeLinkMode('auto')}
                          className={cn('flex-1 rounded-lg py-2 text-[11px] font-bold transition-all flex items-center justify-center gap-1',
                            stripeLinkMode === 'auto' ? 'bg-[#635BFF] text-white shadow-sm' : 'text-stone-500 dark:text-neutral-400')}>
                          <Zap className="h-3 w-3" /> Auto
                        </button>
                        <button onClick={() => setStripeLinkMode('search')}
                          className={cn('flex-1 rounded-lg py-2 text-[11px] font-bold transition-all flex items-center justify-center gap-1',
                            stripeLinkMode === 'search' ? 'bg-[#635BFF] text-white shadow-sm' : 'text-stone-500 dark:text-neutral-400')}>
                          <Search className="h-3 w-3" /> Recherche
                        </button>
                        <button onClick={() => setStripeLinkMode('manual')}
                          className={cn('flex-1 rounded-lg py-2 text-[11px] font-bold transition-all flex items-center justify-center gap-1',
                            stripeLinkMode === 'manual' ? 'bg-[#635BFF] text-white shadow-sm' : 'text-stone-500 dark:text-neutral-400')}>
                          <Link2 className="h-3 w-3" /> Manuel
                        </button>
                      </div>

                      {/* Auto */}
                      {stripeLinkMode === 'auto' && (
                        <div className="space-y-3">
                          <p className="text-xs text-stone-500 dark:text-neutral-400">
                            Recherche automatique via l'email <span className="font-bold text-stone-700 dark:text-white">{local.email || '—'}</span>
                          </p>
                          {stripeAutoStatus === 'not_found' && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-lg p-2.5 border border-amber-200 dark:border-amber-500/20">
                              Aucun abonnement trouve. Essayez Recherche ou Manuel.
                            </p>
                          )}
                          <button onClick={handleStripeAutoMatch} disabled={!local.email || stripeAutoStatus === 'loading'}
                            className="w-full py-2.5 bg-[#635BFF] hover:bg-[#5349E0] disabled:opacity-50 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm">
                            {stripeAutoStatus === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Zap className="h-3.5 w-3.5" /> Rechercher</>}
                          </button>
                        </div>
                      )}

                      {/* Search */}
                      {stripeLinkMode === 'search' && (
                        <div className="space-y-3">
                          <div className="flex gap-2">
                            <input type="email" value={stripeSearchEmail} onChange={e => setStripeSearchEmail(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleStripeSearch()}
                              placeholder="Email du client Stripe"
                              className="flex-1 px-3 py-2 bg-white dark:bg-neutral-800 border border-stone-200 dark:border-neutral-700 rounded-lg text-xs text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30" />
                            <button onClick={handleStripeSearch} disabled={stripeSearching || !stripeSearchEmail.trim()}
                              className="px-3 py-2 bg-[#635BFF] hover:bg-[#5349E0] disabled:opacity-50 text-white font-bold rounded-lg transition-colors">
                              {stripeSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                          {stripeSearched && stripeSearchResults.length === 0 && (
                            <p className="text-xs text-stone-500 dark:text-neutral-400 text-center py-3">Aucun client trouve.</p>
                          )}
                          {stripeSearchResults.map((customer: any) => (
                            <div key={customer.id} className="bg-white dark:bg-neutral-800 rounded-xl p-3 border border-stone-200 dark:border-neutral-700">
                              <p className="text-xs font-bold text-stone-900 dark:text-white">{customer.name || customer.email}</p>
                              <p className="text-[10px] text-stone-500 font-mono mb-2">{customer.id}</p>
                              {customer.subscriptions?.length === 0 ? (
                                <p className="text-[10px] text-stone-400">Aucun abonnement</p>
                              ) : customer.subscriptions?.map((sub: any) => (
                                <button key={sub.id} onClick={() => handleStripeSelectSub(customer.id, sub.id)} disabled={stripeMatching}
                                  className="w-full flex items-center justify-between p-2.5 bg-stone-50 dark:bg-neutral-900 rounded-lg border border-stone-200 dark:border-neutral-700 hover:border-[#635BFF]/30 hover:bg-[#635BFF]/5 transition-all text-left group mt-1">
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${sub.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                      <span className="text-xs font-medium text-stone-900 dark:text-white">{sub.amount?.toFixed(2)} EUR / {sub.interval === 'month' ? 'mois' : 'an'}</span>
                                    </div>
                                    <p className="text-[9px] text-stone-500 font-mono mt-0.5">{sub.id}</p>
                                  </div>
                                  {stripeMatching ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#635BFF]" /> : <CheckCircle2 className="h-4 w-4 text-[#635BFF] opacity-0 group-hover:opacity-100 transition-opacity" />}
                                </button>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Manual */}
                      {stripeLinkMode === 'manual' && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-[11px] font-bold text-stone-500 dark:text-neutral-400 mb-1">Customer ID</label>
                            <input type="text" value={stripeManualCusId} onChange={e => setStripeManualCusId(e.target.value)} placeholder="cus_..."
                              className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-stone-200 dark:border-neutral-700 rounded-lg text-xs text-stone-900 dark:text-white font-mono placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30" />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-stone-500 dark:text-neutral-400 mb-1">Subscription ID</label>
                            <input type="text" value={stripeManualSubId} onChange={e => setStripeManualSubId(e.target.value)} placeholder="sub_..."
                              className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-stone-200 dark:border-neutral-700 rounded-lg text-xs text-stone-900 dark:text-white font-mono placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30" />
                          </div>
                          <button onClick={handleStripeManualMatch} disabled={stripeMatching || !stripeManualCusId.trim() || !stripeManualSubId.trim()}
                            className="w-full py-2.5 bg-[#635BFF] hover:bg-[#5349E0] disabled:opacity-50 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm">
                            {stripeMatching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Lier cet abonnement'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Stripe linked success (inline) */}
              {local.stage === 'won' && formula?.billing_type === 'subscription' && stripeConnected && !local.stripe_subscription_id && stripeAutoStatus === 'matched' && (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/5 p-4 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Abonnement Stripe lie avec succes</p>
                </div>
              )}

              {/* Assignment */}
              {teamMembers.length > 0 && (() => {
                const closers = teamMembers.filter(tm => tm.role === 'Closer' || tm.role === 'Setter-Closer' || tm.role === 'Owner' || tm.role === 'Head of Sales' || tm.role === 'Admin')
                const setters = teamMembers.filter(tm => tm.role === 'Setter' || tm.role === 'Setter-Closer' || tm.role === 'Owner' || tm.role === 'Head of Sales' || tm.role === 'Admin')

                return (
                  <div className="grid grid-cols-2 gap-4">
                    {closers.length > 0 && (
                      <div>
                        <label className={cn(LABEL_STYLE, 'block mb-2 ml-1')}>Assigner un Closer</label>
                        <div className="relative">
                          <select
                            value={closers.find(c => c.id === (local as any).assigned_to)?.id || ''}
                            onChange={(e) => handleUpdate({ assigned_to: e.target.value || null } as any)}
                            disabled={!canAssign}
                            className={cn(SELECT_CLS, 'text-sm font-semibold font-sans', !canAssign && 'opacity-60 cursor-not-allowed')}
                          >
                            <option value="">Aucun</option>
                            {closers.map(tm => (
                              <option key={tm.id} value={tm.id}>
                                {tm.first_name} {tm.last_name}{tm.role === 'Owner' ? ' (Owner)' : ''}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none h-4 w-4 text-stone-400 dark:text-neutral-500" strokeWidth={1.5} />
                        </div>
                      </div>
                    )}

                    {setters.length > 0 && (
                      <div>
                        <label className={cn(LABEL_STYLE, 'block mb-2 ml-1')}>Assigner un Setter</label>
                        <div className="relative">
                          <select
                            value={setters.find(s => s.id === (local as any).assigned_setter)?.id || ''}
                            onChange={(e) => {
                              const setterId = e.target.value || null
                              const updates: any = { assigned_setter: setterId }
                              if (setterId) {
                                const selected = teamMembers.find(tm => tm.id === setterId)
                                if (selected?.role === 'Setter-Closer' && selected?.setter_scope === 'self') {
                                  updates.assigned_to = setterId
                                }
                              }
                              handleUpdate(updates)
                            }}
                            disabled={!(!isTeamMember || isHosOrAdmin)}
                            className={cn(SELECT_CLS, 'text-sm font-semibold font-sans', !(!isTeamMember || isHosOrAdmin) && 'opacity-60 cursor-not-allowed')}
                          >
                            <option value="">Aucun</option>
                            {setters.map(tm => (
                              <option key={tm.id} value={tm.id}>
                                {tm.first_name} {tm.last_name}{tm.role === 'Owner' ? ' (Owner)' : ''}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none h-4 w-4 text-stone-400 dark:text-neutral-500" strokeWidth={1.5} />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Campagne d'origine */}
              {campaign && (
                <div>
                  <label className={cn(LABEL_STYLE, 'block mb-2 ml-1')}>Campagne d'origine</label>
                  <div className="rounded-xl bg-[#f5f3f2] dark:bg-neutral-800 px-5 py-3.5">
                    <p className="font-business-display font-bold text-stone-900 dark:text-white">{campaign.name}</p>
                  </div>
                </div>
              )}

              {/* Offre / Formule */}
              <div>
                <label className={cn(LABEL_STYLE, 'block mb-2 ml-1')}>Offre / Formule</label>
                <div className="relative">
                  <select
                    value={(local as any).formula_id || ''}
                    onChange={(e) => {
                      const fId = e.target.value || null
                      const selected = allFormulas.find(f => f.id === fId)
                      handleUpdate({ formula_id: fId, value: selected?.price || 0 } as any)
                      setFormula(selected || null)
                    }}
                    className={cn(SELECT_CLS, 'py-4 px-5')}
                  >
                    <option value="">Aucune offre</option>
                    {allFormulas.map(f => (
                      <option key={f.id} value={f.id}>{f.name} — {f.price}€</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none h-5 w-5 text-stone-400 dark:text-neutral-500" strokeWidth={1.5} />
                </div>
                {formula && formula.resources && formula.resources.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {formula.resources.map((r, i) => (
                      <a
                        key={i}
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full bg-white dark:bg-neutral-800 border border-[#c4c7c7]/20 dark:border-neutral-700 px-3 py-1.5 text-xs font-medium text-stone-700 dark:text-neutral-200 hover:bg-[#f5f3f2] dark:hover:bg-neutral-700 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" strokeWidth={1.5} /> {r.name || r.type}
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Capture custom data */}
              {captureData && Object.keys(captureData).length > 0 && (
                <div>
                  <label className={cn(LABEL_STYLE, 'block mb-2 ml-1 flex items-center gap-2')}>
                    <FileText className="h-3.5 w-3.5" strokeWidth={1.5} /> Réponses de capture
                  </label>
                  <div className="rounded-xl bg-white dark:bg-neutral-800 p-5 space-y-3 border border-[#c4c7c7]/10 dark:border-neutral-700 shadow-sm">
                    {Object.entries(captureData).map(([key, val]) => (
                      <div key={key} className="flex items-start gap-2">
                        <span className="text-xs font-bold text-stone-500 dark:text-neutral-400 min-w-0 shrink-0">{key} :</span>
                        <span className="text-sm text-stone-900 dark:text-white">{String(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Qualification (questionnaire answers) */}
              {qualificationData && qualificationData.answers.length > 0 && (() => {
                const scoredAnswers = qualificationData.answers.filter(a => a.score !== null && a.score !== undefined)
                const avgScore = scoredAnswers.length > 0 ? Math.round(scoredAnswers.reduce((sum, a) => sum + (a.score ?? 0), 0) / scoredAnswers.length) : null
                const eliminatoryCount = qualificationData.answers.filter(a => a.is_eliminatory).length
                const maxElim = qualificationData.questionnaire?.max_eliminatory ?? 0
                return (
                  <div>
                    <label className={cn(LABEL_STYLE, 'block mb-2 ml-1 flex items-center gap-2')}>
                      <ClipboardList className="h-3.5 w-3.5" strokeWidth={1.5} /> Qualification
                    </label>
                    <div className="rounded-xl bg-white dark:bg-neutral-800 p-5 border border-[#c4c7c7]/10 dark:border-neutral-700 shadow-sm space-y-4">
                      {/* Global summary */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {avgScore !== null && (
                            <div className={cn(
                              'text-lg font-extrabold font-business-display',
                              avgScore >= 70 ? 'text-emerald-500' : avgScore >= 40 ? 'text-orange-500' : 'text-red-500'
                            )}>
                              {avgScore}%
                            </div>
                          )}
                          <span className="text-xs text-stone-500 dark:text-neutral-400">Score global</span>
                        </div>
                        <div className={cn(
                          'text-xs font-bold px-2.5 py-1 rounded-lg',
                          eliminatoryCount > maxElim
                            ? 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                            : 'bg-stone-100 text-stone-500 dark:bg-neutral-700 dark:text-neutral-400'
                        )}>
                          Éliminatoires : {eliminatoryCount}/{maxElim}
                          {eliminatoryCount > maxElim && ' — Disqualifié'}
                        </div>
                      </div>

                      {/* Per-question cards */}
                      <div className="space-y-2">
                        {qualificationData.answers.map((a, i) => {
                          const isText = a.question_type === 'text' || a.score === null
                          const scoreColor = a.is_eliminatory ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/10'
                            : isText ? 'border-stone-100 bg-stone-50 dark:border-neutral-700 dark:bg-neutral-800/50'
                            : (a.score ?? 0) >= 70 ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/10'
                            : (a.score ?? 0) >= 40 ? 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/10'
                            : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/10'
                          return (
                            <div key={i} className={cn('p-3 rounded-lg border', scoreColor)}>
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-xs font-bold text-stone-700 dark:text-neutral-300">{a.question_text}</p>
                                {!isText && (
                                  <span className={cn(
                                    'text-xs font-extrabold flex-shrink-0',
                                    (a.score ?? 0) >= 70 ? 'text-emerald-600' : (a.score ?? 0) >= 40 ? 'text-orange-600' : 'text-red-600'
                                  )}>
                                    {a.score}%
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-stone-900 dark:text-white mt-1">
                                {Array.isArray(a.answer_value) ? a.answer_value.join(', ') : String(a.answer_value ?? '')}
                              </p>
                              {!isText && (
                                <div className="w-full h-1.5 bg-stone-200 dark:bg-neutral-700 rounded-full mt-2 overflow-hidden">
                                  <div
                                    className={cn(
                                      'h-full rounded-full transition-all',
                                      (a.score ?? 0) >= 70 ? 'bg-emerald-500' : (a.score ?? 0) >= 40 ? 'bg-orange-500' : 'bg-red-500'
                                    )}
                                    style={{ width: `${a.score ?? 0}%` }}
                                  />
                                </div>
                              )}
                              {a.is_eliminatory && (
                                <span className="inline-block mt-1.5 text-[10px] font-bold text-red-600 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full">Éliminatoire</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Fiche Client */}
              <section className="bg-white dark:bg-neutral-800 p-6 rounded-xl shadow-sm border border-[#c4c7c7]/5 dark:border-neutral-700">
                <div className="flex items-center justify-between mb-6">
                  <h3 className={cn(LABEL_STYLE, 'text-xs')}>Fiche Client</h3>
                  <button onClick={() => setEditingClient(!editingClient)} className="rounded-full p-2 text-stone-400 hover:bg-[#f5f3f2] dark:hover:bg-neutral-700 hover:text-stone-700 dark:hover:text-neutral-200 transition-colors">
                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                </div>
                {editingClient ? (
                  <div className="space-y-3">
                    <input type="text" value={editedContact} onChange={e => setEditedContact(e.target.value)} className={INPUT_CLS} placeholder="Nom" />
                    <input type="text" value={editedCompany} onChange={e => setEditedCompany(e.target.value)} className={INPUT_CLS} placeholder="Entreprise" />
                    <input type="email" value={editedEmail} onChange={e => setEditedEmail(e.target.value)} className={INPUT_CLS} placeholder="Email" />
                    <PhoneInput value={editedPhone} onChange={setEditedPhone} />
                    <div className="flex gap-2 pt-2">
                      <button onClick={handleSaveClient} className="flex-1 rounded-full bg-stone-900 px-4 py-2.5 text-sm font-business-display font-bold text-white hover:bg-stone-800 transition-colors">Sauvegarder</button>
                      <button onClick={() => { setEditingClient(false); setEditedContact(local.contact); setEditedCompany(local.company); setEditedEmail(local.email); setEditedPhone(local.phone) }} className="rounded-full border border-[#c4c7c7]/20 dark:border-neutral-700 px-4 py-2.5 text-sm font-medium text-stone-600 dark:text-neutral-300 hover:bg-[#f5f3f2] dark:hover:bg-neutral-700 transition-colors">Annuler</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-[#f5f3f2] dark:bg-neutral-800 flex items-center justify-center text-stone-500 dark:text-neutral-400">
                        <Mail className="h-5 w-5" strokeWidth={1.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-stone-500 dark:text-neutral-400 uppercase tracking-wider">Email</p>
                        <button onClick={handleOpenGmail} className="text-sm font-semibold text-stone-900 dark:text-white hover:text-[#006c49] truncate text-left transition-colors">{local.email || '—'}</button>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-[#f5f3f2] dark:bg-neutral-800 flex items-center justify-center text-stone-500 dark:text-neutral-400">
                        <Phone className="h-5 w-5" strokeWidth={1.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-stone-500 dark:text-neutral-400 uppercase tracking-wider">Téléphone</p>
                        <button onClick={handleOpenWhatsApp} className="text-sm font-semibold text-stone-900 dark:text-white hover:text-[#006c49] text-left transition-colors">{local.phone || '—'}</button>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-[#f5f3f2] dark:bg-neutral-800 flex items-center justify-center text-stone-500 dark:text-neutral-400">
                        <Calendar className="h-5 w-5" strokeWidth={1.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-stone-500 dark:text-neutral-400 uppercase tracking-wider">Date de création</p>
                        <p className="text-sm font-semibold text-stone-900 dark:text-white">
                          {local.created_at ? new Date(local.created_at).toLocaleDateString('fr-FR', {
                            day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                          }) : '—'}
                        </p>
                      </div>
                    </div>
                    {nextAppointment && (
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-[#006c49]/10 flex items-center justify-center text-[#006c49]">
                          <Calendar className="h-5 w-5" strokeWidth={1.5} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-[#006c49] uppercase tracking-wider">Prochain rendez-vous</p>
                          <p className="text-sm font-semibold text-stone-900 dark:text-white">
                            {new Date(nextAppointment.date + 'T00:00:00').toLocaleDateString('fr-FR', {
                              weekday: 'short', day: 'numeric', month: 'long'
                            })} à {nextAppointment.time?.slice(0, 5)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* Notes internes */}
              <div>
                <div className="flex items-center justify-between mb-2 ml-1">
                  <label className={LABEL_STYLE}>Notes Internes</label>
                  <button onClick={() => setEditingNotes(!editingNotes)} className="rounded-full p-2 text-stone-400 hover:bg-[#f5f3f2] dark:hover:bg-neutral-700 hover:text-stone-700 dark:hover:text-neutral-200 transition-colors">
                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                </div>
                {editingNotes ? (
                  <div>
                    <textarea value={tempNotes} onChange={e => setTempNotes(e.target.value)} className={cn(INPUT_CLS, 'resize-none h-32')} placeholder="Ajouter un commentaire sur le profil du prospect..." />
                    <div className="mt-3 flex gap-2">
                      <button onClick={handleSaveNotes} className="rounded-full bg-stone-900 px-5 py-2 text-sm font-business-display font-bold text-white hover:bg-stone-800 transition-colors">Enregistrer</button>
                      <button onClick={() => setEditingNotes(false)} className="rounded-full border border-[#c4c7c7]/20 px-5 py-2 text-sm font-medium text-stone-600 dark:text-neutral-300 hover:bg-[#f5f3f2] dark:hover:bg-neutral-700 transition-colors">Annuler</button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-[#f5f3f2] dark:bg-neutral-800 p-5">
                    <p className="whitespace-pre-wrap text-sm text-stone-600 dark:text-neutral-300">
                      {captureData ? '(Données de capture - voir section ci-dessus)' : (local.notes || 'Aucune note')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── TAB: NOTES D'APPEL ─── */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              {!isAddingNote ? (
                <button
                  onClick={() => setIsAddingNote(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-200/30 dark:border-neutral-700 bg-[#f5f3f2]/50 dark:bg-neutral-800/50 py-4 text-sm font-business-display font-bold text-stone-500 dark:text-neutral-400 hover:bg-[#f5f3f2] dark:hover:bg-neutral-800 hover:border-stone-300 dark:hover:border-neutral-600 transition-all"
                >
                  <Plus className="h-4 w-4" strokeWidth={1.5} /> Ajouter une note manuelle
                </button>
              ) : (
                <div className="rounded-xl bg-white dark:bg-neutral-800 p-5 border border-[#c4c7c7]/10 dark:border-neutral-700 shadow-sm">
                  <h4 className={cn(LABEL_STYLE, 'mb-3')}>Nouvelle Note</h4>
                  <textarea
                    ref={noteTextareaRef}
                    defaultValue=""
                    placeholder="Écrivez votre note d'appel ici..."
                    className={cn(INPUT_CLS, 'min-h-[100px] mb-3')}
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => { setIsAddingNote(false); if (noteTextareaRef.current) noteTextareaRef.current.value = '' }} className="px-4 py-2 text-sm font-medium text-stone-500 dark:text-neutral-400 hover:text-stone-700 dark:hover:text-neutral-200 rounded-full hover:bg-[#f5f3f2] dark:hover:bg-neutral-700 transition-colors">Annuler</button>
                    <button onClick={handleAddManualNote} className="px-5 py-2 rounded-full bg-stone-900 text-sm font-business-display font-bold text-white hover:bg-stone-800 disabled:opacity-50 transition-colors">Enregistrer</button>
                  </div>
                </div>
              )}

              <div className="h-px bg-[#c4c7c7]/20 dark:bg-neutral-700 my-4" />

              <div className="space-y-3">
                {callNotes.length > 0 ? (
                  callNotes.map(note => (
                    <details key={note.id} className="group rounded-xl bg-white dark:bg-neutral-800 border border-[#c4c7c7]/10 dark:border-neutral-700 open:shadow-sm transition-all overflow-hidden">
                      <summary className="flex cursor-pointer items-center justify-between p-4 hover:bg-[#f5f3f2] dark:hover:bg-neutral-700 transition-colors select-none list-none [&::-webkit-details-marker]:hidden">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f5f3f2] dark:bg-neutral-700 text-stone-400 dark:text-neutral-400 group-open:bg-[#ffddb8] group-open:text-[#2a1700] dark:group-open:bg-amber-700/30 dark:group-open:text-amber-200 transition-colors">
                            <Calendar className="h-4 w-4" strokeWidth={1.5} />
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-stone-900 dark:text-white">
                              {new Date(note.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                            </h4>
                            <div className="flex items-center gap-2 text-xs text-stone-400 mt-0.5">
                              <Clock className="h-3 w-3" strokeWidth={1.5} />
                              <span>{new Date(note.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                              {note.author && <><span>·</span><span className="uppercase tracking-wider">{note.author}</span></>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button onClick={e => { e.preventDefault(); handleDeleteNote(note.id) }} className="rounded-full p-1.5 text-stone-400 hover:text-[#ba1a1a] hover:bg-[#ba1a1a]/5 transition-colors opacity-0 group-hover:opacity-100">
                            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                          </button>
                          <ChevronDown className="h-5 w-5 text-stone-400 dark:text-neutral-500 transition-transform duration-300 group-open:rotate-180" strokeWidth={1.5} />
                        </div>
                      </summary>
                      <div className="border-t border-[#c4c7c7]/10 dark:border-neutral-700 p-5 pt-3">
                        <p className="text-sm text-stone-600 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed">{note.content}</p>
                      </div>
                    </details>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border-2 border-dashed border-stone-200/30 dark:border-neutral-700 bg-[#f5f3f2]/50 dark:bg-neutral-800/50">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f5f3f2] dark:bg-neutral-800 mb-3">
                      <ClipboardList className="h-6 w-6 text-stone-400" strokeWidth={1.5} />
                    </div>
                    <p className="text-sm font-medium text-stone-500 dark:text-neutral-400">Aucune note d'appel</p>
                    <p className="text-xs text-stone-400 dark:text-neutral-500 mt-1">Vos notes manuelles apparaîtront ici.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── TAB: RAPPELS ─── */}
          {activeTab === 'rappels' && (
            <div className="space-y-4">
              <button
                onClick={() => setShowReminderForm(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-200/30 dark:border-neutral-700 bg-[#f5f3f2]/50 dark:bg-neutral-800/50 py-4 text-sm font-business-display font-bold text-stone-500 dark:text-neutral-400 hover:bg-[#f5f3f2] dark:hover:bg-neutral-800 hover:border-stone-300 dark:hover:border-neutral-600 transition-all"
              >
                <Plus className="h-4 w-4" strokeWidth={1.5} /> Ajouter un rappel
              </button>

              {remindersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-stone-400" strokeWidth={1.5} />
                </div>
              ) : prospectReminders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border-2 border-dashed border-stone-200/30 dark:border-neutral-700 bg-[#f5f3f2]/50 dark:bg-neutral-800/50">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f5f3f2] dark:bg-neutral-800 mb-3">
                    <Bell className="h-6 w-6 text-stone-400" strokeWidth={1.5} />
                  </div>
                  <p className="text-sm font-medium text-stone-500 dark:text-neutral-400">Aucun rappel</p>
                  <p className="text-xs text-stone-400 dark:text-neutral-500 mt-1">Créez un rappel pour ce prospect.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {prospectReminders.map(reminder => {
                    const isDone = reminder.is_done
                    const isOverdue = !isDone && new Date(reminder.reminder_date) < new Date()
                    const isLoading = reminderActionLoading === reminder.id
                    return (
                      <div
                        key={reminder.id}
                        className={cn(
                          'rounded-xl p-4 transition-all',
                          isDone ? 'bg-[#f5f3f2] dark:bg-neutral-800' : isOverdue ? 'bg-[#ba1a1a]/5 dark:bg-red-900/20 ring-1 ring-[#ba1a1a]/10 dark:ring-red-500/20' : 'bg-white dark:bg-neutral-800 border border-[#c4c7c7]/10 dark:border-neutral-700'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className={cn('text-sm font-semibold', isDone ? 'text-stone-400 dark:text-neutral-500 line-through' : 'text-stone-900 dark:text-white')}>
                              {reminder.title}
                            </p>
                            {reminder.description && <p className="text-xs text-stone-400 dark:text-neutral-500 mt-0.5 truncate">{reminder.description}</p>}
                            <div className="flex items-center gap-2 mt-1.5">
                              <Clock className="h-3 w-3 text-stone-400" strokeWidth={1.5} />
                              <span className={cn('text-xs', isOverdue ? 'text-[#ba1a1a] font-medium' : 'text-stone-400')}>
                                {new Date(reminder.reminder_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à {new Date(reminder.reminder_date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {isDone && <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Fait</span>}
                              {isOverdue && <span className="text-[10px] text-[#ba1a1a] font-bold uppercase tracking-wider">En retard</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {!isDone && (
                              <button onClick={() => handleMarkReminderDone(reminder.id)} disabled={isLoading} className="rounded-full p-2 text-[#006c49] hover:bg-[#006c49]/10 transition-colors disabled:opacity-50">
                                <Check className="h-4 w-4" strokeWidth={1.5} />
                              </button>
                            )}
                            <button onClick={() => handleDeleteReminder(reminder.id)} disabled={isLoading} className="rounded-full p-2 text-stone-400 hover:text-[#ba1a1a] hover:bg-[#ba1a1a]/5 transition-colors disabled:opacity-50">
                              <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ─── TAB: HISTORIQUE ─── */}
          {activeTab === 'historique' && (
            <div className="space-y-1">
              {historyLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-stone-400" strokeWidth={1.5} />
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border-2 border-dashed border-stone-200/30 dark:border-neutral-700 bg-[#f5f3f2]/50 dark:bg-neutral-800/50">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f5f3f2] dark:bg-neutral-800 mb-3">
                    <Clock className="h-6 w-6 text-stone-400" strokeWidth={1.5} />
                  </div>
                  <p className="text-sm font-medium text-stone-500 dark:text-neutral-400">Aucun historique</p>
                  <p className="text-xs text-stone-400 dark:text-neutral-500 mt-1">Les modifications apparaitront ici.</p>
                </div>
              ) : (
                <div className="space-y-0">
                  {history.map((entry, idx) => {
                    const isExpanded = expandedHistory.has(entry.id)
                    const isLast = idx === history.length - 1
                    const date = new Date(entry.created_at)
                    const timeStr = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' a ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

                    const FIELD_LABELS: Record<string, string> = {
                      contact: 'Nom', email: 'Email', phone: 'Telephone', company: 'Entreprise',
                      stage: 'Etape', value: 'Montant', formula_id: 'Offre',
                      assigned_to: 'Closer', assigned_setter: 'Setter',
                      payment_type: 'Mode de paiement', installments: 'Mensualites',
                      stripe_subscription_id: 'Abonnement Stripe', subscription_status: 'Statut abo.',
                      subscription: 'Paiement', notes: 'Notes',
                    }
                    const STAGE_LABELS: Record<string, string> = {
                      prospect: 'Prospect', qualified: 'Qualifie', unqualified: 'Non-Qualifie',
                      won: 'Gagne', followup: 'Follow Up', noanswer: 'Pas de Reponse',
                      noshow: 'No Show', lost: 'Perdu',
                    }
                    const CHANGE_ICONS: Record<string, { bg: string; text: string }> = {
                      stage_change: { bg: 'bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400' },
                      stripe_renewal: { bg: 'bg-[#635BFF]/10', text: 'text-[#635BFF]' },
                      stripe_linked: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
                      field_update: { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' },
                    }

                    const fieldLabel = FIELD_LABELS[entry.field_name] || entry.field_name
                    const style = CHANGE_ICONS[entry.change_type] || CHANGE_ICONS.field_update
                    const displayOld = entry.change_type === 'stage_change' ? (STAGE_LABELS[entry.old_value] || entry.old_value) : entry.old_value
                    const displayNew = entry.change_type === 'stage_change' ? (STAGE_LABELS[entry.new_value] || entry.new_value) : entry.new_value

                    let title = ''
                    if (entry.change_type === 'stage_change') {
                      title = `Etape → ${displayNew}`
                    } else if (entry.change_type === 'stripe_renewal') {
                      title = `Renouvellement ${entry.new_value}`
                    } else if (entry.change_type === 'stripe_linked') {
                      title = 'Abonnement Stripe lie'
                    } else {
                      title = `${fieldLabel} modifie`
                    }

                    return (
                      <div key={entry.id}>
                        {/* Card */}
                        <button
                          onClick={() => setExpandedHistory(prev => {
                            const next = new Set(prev)
                            next.has(entry.id) ? next.delete(entry.id) : next.add(entry.id)
                            return next
                          })}
                          className="w-full text-left rounded-xl border border-stone-200/60 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 hover:bg-[#f5f3f2]/50 dark:hover:bg-neutral-700/50 transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn('p-1.5 rounded-lg shrink-0', style.bg)}>
                              {entry.change_type === 'stripe_renewal' ? (
                                <CreditCard className={cn('h-3.5 w-3.5', style.text)} />
                              ) : entry.change_type === 'stage_change' ? (
                                <Tag className={cn('h-3.5 w-3.5', style.text)} />
                              ) : (
                                <Pencil className={cn('h-3.5 w-3.5', style.text)} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-stone-900 dark:text-white truncate">{title}</p>
                              <p className="text-[10px] text-stone-400 dark:text-neutral-500">
                                {timeStr} — {entry.changed_by_name || 'Systeme'}
                              </p>
                            </div>
                            <ChevronDown className={cn('h-4 w-4 text-stone-400 transition-transform shrink-0', isExpanded && 'rotate-180')} />
                          </div>

                          {/* Expanded detail */}
                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-stone-100 dark:border-neutral-700 space-y-2">
                              {entry.old_value && (
                                <div className="flex items-start gap-2">
                                  <span className="text-[10px] font-bold text-stone-400 dark:text-neutral-500 uppercase w-12 shrink-0 pt-0.5">Avant</span>
                                  <span className="text-xs text-stone-600 dark:text-neutral-300 bg-red-50 dark:bg-red-500/10 px-2.5 py-1 rounded-lg border border-red-100 dark:border-red-500/20 line-through">
                                    {displayOld}
                                  </span>
                                </div>
                              )}
                              <div className="flex items-start gap-2">
                                <span className="text-[10px] font-bold text-stone-400 dark:text-neutral-500 uppercase w-12 shrink-0 pt-0.5">Apres</span>
                                <span className="text-xs text-stone-900 dark:text-white bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-100 dark:border-emerald-500/20 font-medium">
                                  {displayNew || '—'}
                                </span>
                              </div>
                              <p className="text-[10px] text-stone-400 dark:text-neutral-500 mt-1">
                                Champ : {fieldLabel}
                              </p>
                            </div>
                          )}
                        </button>

                        {/* Arrow connector */}
                        {!isLast && (
                          <div className="flex justify-center py-1">
                            <div className="flex flex-col items-center">
                              <div className="w-px h-2 bg-stone-200 dark:bg-neutral-700" />
                              <ChevronDown className="h-3 w-3 text-stone-300 dark:text-neutral-600 -my-0.5" />
                              <div className="w-px h-2 bg-stone-200 dark:bg-neutral-700" />
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Reminder creation modal */}
        {showReminderForm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-stone-900/10 backdrop-blur-sm" onClick={() => setShowReminderForm(false)} />
            <div className="relative w-full max-w-sm rounded-3xl bg-white dark:bg-neutral-900 shadow-2xl border border-[#c4c7c7]/10 dark:border-neutral-700">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#c4c7c7]/10 dark:border-neutral-700">
                <h3 className="font-business-display font-extrabold text-stone-900 dark:text-white">Nouveau rappel</h3>
                <button onClick={() => setShowReminderForm(false)} className="rounded-full p-2 text-stone-400 hover:bg-[#f5f3f2] dark:hover:bg-neutral-700 hover:text-stone-700 dark:hover:text-neutral-200 transition-colors">
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className={cn(LABEL_STYLE, 'block mb-1.5')}>Titre *</label>
                  <input type="text" value={reminderTitle} onChange={e => setReminderTitle(e.target.value)} placeholder="Ex: Rappeler le prospect" className={INPUT_CLS} autoFocus />
                </div>
                <div>
                  <label className={cn(LABEL_STYLE, 'block mb-1.5')}>Description</label>
                  <textarea value={reminderDesc} onChange={e => setReminderDesc(e.target.value)} placeholder="Détails optionnels..." rows={2} className={cn(INPUT_CLS, 'resize-none')} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={cn(LABEL_STYLE, 'block mb-1.5')}>Date *</label>
                    <input type="date" value={reminderDate} onChange={e => setReminderDate(e.target.value)} className={INPUT_CLS} />
                  </div>
                  <div>
                    <label className={cn(LABEL_STYLE, 'block mb-1.5')}>Heure *</label>
                    <input type="time" value={reminderTime} onChange={e => setReminderTime(e.target.value)} className={INPUT_CLS} />
                  </div>
                </div>
                <div className="rounded-xl bg-[#ffddb8]/30 dark:bg-amber-700/20 px-4 py-3">
                  <p className="text-xs text-[#2a1700] dark:text-amber-200 font-medium">
                    <Bell className="h-3 w-3 inline mr-1" strokeWidth={1.5} />
                    Lié à : <span className="font-bold">{local.contact || 'Ce prospect'}</span>
                  </p>
                </div>
                <button
                  onClick={handleCreateReminder}
                  disabled={!reminderTitle.trim() || !reminderDate || !reminderTime || reminderSubmitting}
                  className="w-full rounded-full bg-stone-900 py-3 text-sm font-business-display font-bold text-white hover:bg-stone-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                  {reminderSubmitting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" strokeWidth={1.5} /> : 'Créer le rappel'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="p-4 md:p-8 border-t border-[#c4c7c7]/10 dark:border-neutral-700 flex justify-between items-center bg-white/20 dark:bg-neutral-900/20">
          <div className="flex items-center gap-2">
            {(isOwner || isHosOrAdmin) && (
              <button
                onClick={handleDelete}
                className="text-[#ba1a1a] font-business-display font-bold text-sm flex items-center gap-2 px-4 py-2 hover:bg-[#ba1a1a]/5 rounded-full transition-colors"
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                Supprimer
              </button>
            )}
            <button
              onClick={async () => {
                if (!user) return
                try {
                  if (isDismissed) {
                    await supabase.from('business_pipeline_dismissals').delete().eq('user_id', user.id).eq('prospect_id', prospect.id)
                    toast.success('Prospect rajouté au pipeline')
                    setIsDismissed(false)
                    onDismissFromPipeline?.(prospect.id, false)
                  } else {
                    await supabase.from('business_pipeline_dismissals').upsert({ user_id: user.id, prospect_id: prospect.id }, { onConflict: 'user_id,prospect_id' })
                    toast.success('Prospect retiré du pipeline')
                    setIsDismissed(true)
                    onDismissFromPipeline?.(prospect.id, true)
                    onClose()
                  }
                } catch { toast.error('Erreur') }
              }}
              className={cn(
                "font-business-display font-bold text-sm flex items-center gap-2 px-4 py-2 rounded-full transition-colors",
                isDismissed
                  ? "text-[#006c49] hover:bg-[#006c49]/10"
                  : "text-stone-500 dark:text-neutral-400 hover:bg-stone-100 dark:hover:bg-neutral-800"
              )}
            >
              {isDismissed ? (
                <><Plus className="h-4 w-4" strokeWidth={1.5} /> Rajouter au pipeline</>
              ) : (
                <><X className="h-4 w-4" strokeWidth={1.5} /> Retirer du pipeline</>
              )}
            </button>
          </div>
          <button
            onClick={() => handleUpdate(local)}
            className="bg-stone-900 text-white px-8 py-3 rounded-full font-business-display font-bold text-sm transition-transform active:scale-95"
          >
            Enregistrer
          </button>
        </footer>
      </aside>
  )

  if (inline) return content

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-stone-900/10 dark:bg-black/40 backdrop-blur-sm" onClick={onClose} />
      {content}
    </div>
  )
}
