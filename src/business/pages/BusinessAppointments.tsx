import { useState, useEffect, useCallback, useMemo } from 'react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessGoogleCalendar } from '../contexts/BusinessGoogleCalendarContext'
import {
  Calendar, Loader2, CheckCircle2, XCircle, Clock, Filter,
  ChevronDown, User, Mail, Megaphone, Users, Link2, Copy, Plus, X, Save, Video, Globe,
  Settings, Trash2, Bell, Code2, FileText, ChevronRight, ToggleLeft, ToggleRight, Pencil, Phone,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { toUTC, fromUTC, getTimezoneLabel } from '../../lib/timezone'

interface Appointment {
  id: string
  date: string
  time: string
  datetime_utc?: string | null
  timezone?: string | null
  duration: number
  status: 'pending' | 'confirmed' | 'cancelled' | 'done'
  notes: string | null
  title?: string | null
  google_meet_link?: string | null
  created_at: string
  assigned_to?: string
  prospect: { id: number; contact: string; email: string; phone: string } | null
  campaign: { id: string; name: string } | null
}

interface TeamMember {
  id: string
  first_name: string
  last_name: string
  role: string
  timezone?: string
}

interface BookingLink {
  id: string
  label: string
  duration: number
  link: string
  slug: string
  team_member_id: string | null
  description: string | null
  redirect_url: string | null
  email_enabled: boolean
  email_required: boolean
  phone_enabled: boolean
  phone_required: boolean
  google_meet_enabled: boolean
  created_at: string
}

interface ReminderConfig {
  id?: string
  name: string
  template_type: 'default' | 'custom'
  timing: string
  sender_name: string
  subject: string
  custom_html: string
  is_active: boolean
  is_manual: boolean
}

const TIMING_OPTIONS = [
  { value: '1d', label: '1 jour avant' },
  { value: '10h_same_day', label: '10H le jour même' },
  { value: '5h', label: '5 heures avant' },
  { value: '3h', label: '3 heures avant' },
  { value: '1h', label: '1 heure avant' },
  { value: '30m', label: '30 minutes avant' },
  { value: '15m', label: '15 minutes avant' },
  { value: '0m', label: 'Au moment de l\'appel' },
]

const TEMPLATE_VARIABLES = [
  { key: '{{lead_name}}', label: 'Nom du lead' },
  { key: '{{assignee_name}}', label: 'Nom de l\'interlocuteur' },
  { key: '{{appointment_title}}', label: 'Titre du RDV' },
  { key: '{{appointment_date}}', label: 'Date du RDV' },
  { key: '{{appointment_time}}', label: 'Heure du RDV' },
  { key: '{{google_meet_link}}', label: 'Lien Google Meet' },
  { key: '{{reschedule_link}}', label: 'Lien de report' },
  { key: '{{cancel_link}}', label: 'Lien d\'annulation' },
]

const DEFAULT_REMINDER: ReminderConfig = {
  name: 'Nouveau rappel',
  template_type: 'default',
  timing: '1h',
  sender_name: 'CloseOS',
  subject: 'CloseOS - Rappel de votre rendez-vous',
  custom_html: '',
  is_active: true,
  is_manual: false,
}

const DEFAULT_MANUAL_REMINDER: ReminderConfig = {
  name: 'Rappel manuel',
  template_type: 'default',
  timing: 'manual',
  sender_name: 'CloseOS',
  subject: 'CloseOS - Rappel de votre rendez-vous',
  custom_html: '',
  is_active: true,
  is_manual: true,
}

const STATUS_CONFIG: Record<string, { label: string; badgeBg: string; badgeText: string }> = {
  pending: { label: 'En attente', badgeBg: 'bg-amber-100/80', badgeText: 'text-amber-700' },
  confirmed: { label: 'Confirmé', badgeBg: 'bg-[#006c49]/10', badgeText: 'text-[#006c49]' },
  cancelled: { label: 'Annulé', badgeBg: 'bg-red-100/80', badgeText: 'text-red-600' },
  done: { label: 'Terminé', badgeBg: 'bg-[#006c49]/10', badgeText: 'text-[#006c49]' },
}

function parseBookingNotes(notes: string | null): { name: string; email?: string; phone?: string } | null {
  if (!notes?.startsWith('Booking: ')) return null
  const parts = notes.slice(9).split(' — ')
  return { name: parts[0], email: parts[1] || undefined, phone: parts[2] || undefined }
}

const API_URL = '/api/business'

export function BusinessAppointments() {
  const { user, isTeamMember, ownerUserId, teamMember, userTimezone } = useBusinessAuth()
  const { isConnected: isGoogleConnected, createEvent: createGoogleEvent } = useBusinessGoogleCalendar()
  const effectiveUserId = isTeamMember ? ownerUserId : user?.id
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterDate, setFilterDate] = useState<string>('')
  const [filterMember, setFilterMember] = useState<string>('all')
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])

  // Booking links (setter + owner/HoS)
  const isSetter = isTeamMember && (teamMember?.role === 'Setter' || teamMember?.role === 'Setter-Closer')
  const isOwnerOrHoS = !isTeamMember || teamMember?.role === 'Head of Sales' || teamMember?.role === 'Admin'
  const isCloserOnly = isTeamMember && teamMember?.role === 'Closer'
  const isSetterCloserSelf = isTeamMember && teamMember?.role === 'Setter-Closer' && teamMember?.setter_scope === 'self'
  const showBookingSection = isSetter || isOwnerOrHoS || isCloserOnly
  const canBookForOthers = !isCloserOnly && !isSetterCloserSelf // closers and setter-closer(self) can't book for others
  const [bookingLinks, setBookingLinks] = useState<BookingLink[]>([])
  const [filterBookingMember, setFilterBookingMember] = useState<string>('all')
  const [showCreateLink, setShowCreateLink] = useState(false)
  const [newLinkLabel, setNewLinkLabel] = useState('')
  const [newLinkDuration, setNewLinkDuration] = useState(30)
  const [newLinkMemberId, setNewLinkMemberId] = useState<string>('')
  const [newLinkDescription, setNewLinkDescription] = useState('')
  const [newLinkRedirectUrl, setNewLinkRedirectUrl] = useState('')
  const [newLinkEmailEnabled, setNewLinkEmailEnabled] = useState(true)
  const [newLinkEmailRequired, setNewLinkEmailRequired] = useState(false)
  const [newLinkPhoneEnabled, setNewLinkPhoneEnabled] = useState(true)
  const [newLinkPhoneRequired, setNewLinkPhoneRequired] = useState(false)
  const [newLinkGoogleMeetEnabled, setNewLinkGoogleMeetEnabled] = useState(true)
  const [savingLink, setSavingLink] = useState(false)

  // Detail popup
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)

  // Personnel / Membre tabs for Setter, HOS, Owner
  const showTabs = isSetter || isOwnerOrHoS
  const [activeTab, setActiveTab] = useState<'personnel' | 'membre'>('personnel')

  // Book RDV modal state
  const [showBookModal, setShowBookModal] = useState(false)
  const [bookTitle, setBookTitle] = useState('')
  const [bookDate, setBookDate] = useState('')
  const [bookTime, setBookTime] = useState('')
  const [bookDuration, setBookDuration] = useState(30)
  const [bookMemberId, setBookMemberId] = useState<string>('')
  const [bookNotes, setBookNotes] = useState('')
  const [bookWithMeet, setBookWithMeet] = useState(true)
  const [bookSaving, setBookSaving] = useState(false)

  // Reminder config state
  const [showReminderConfig, setShowReminderConfig] = useState(false)
  const [reminders, setReminders] = useState<ReminderConfig[]>([])
  const [editingReminder, setEditingReminder] = useState<ReminderConfig | null>(null)
  const [savingReminder, setSavingReminder] = useState(false)
  const [loadingReminders, setLoadingReminders] = useState(false)
  const [sendingManualReminder, setSendingManualReminder] = useState<string | null>(null)

  // Fetch reminders
  useEffect(() => {
    if (!effectiveUserId) return
    supabase
      .from('business_appointment_reminders')
      .select('*')
      .eq('business_owner_id', effectiveUserId)
      .order('created_at', { ascending: true })
      .then(({ data }) => setReminders(data || []))
  }, [effectiveUserId])

  const handleSaveReminder = async (reminder: ReminderConfig) => {
    if (!effectiveUserId) return
    setSavingReminder(true)
    try {
      if (reminder.id) {
        const { error } = await supabase
          .from('business_appointment_reminders')
          .update({
            name: reminder.name,
            template_type: reminder.template_type,
            timing: reminder.timing,
            sender_name: reminder.sender_name,
            subject: reminder.subject,
            custom_html: reminder.template_type === 'custom' ? reminder.custom_html : null,
            is_active: reminder.is_active,
            is_manual: reminder.is_manual,
            updated_at: new Date().toISOString(),
          })
          .eq('id', reminder.id)
        if (error) throw error
        setReminders(prev => prev.map(r => r.id === reminder.id ? reminder : r))
        toast.success('Rappel mis à jour')
      } else {
        const { data, error } = await supabase
          .from('business_appointment_reminders')
          .insert({
            business_owner_id: effectiveUserId,
            name: reminder.name,
            template_type: reminder.template_type,
            timing: reminder.timing,
            sender_name: reminder.sender_name,
            subject: reminder.subject,
            custom_html: reminder.template_type === 'custom' ? reminder.custom_html : null,
            is_active: reminder.is_active,
            is_manual: reminder.is_manual,
          })
          .select()
          .single()
        if (error) throw error
        if (data) setReminders(prev => [...prev, data])
        toast.success('Rappel créé')
      }
      setEditingReminder(null)
    } catch (err) {
      console.error('Error saving reminder:', err)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSavingReminder(false)
    }
  }

  const handleDeleteReminder = async (id: string) => {
    const { error } = await supabase.from('business_appointment_reminders').delete().eq('id', id)
    if (error) { toast.error('Erreur'); return }
    setReminders(prev => prev.filter(r => r.id !== id))
    if (editingReminder?.id === id) setEditingReminder(null)
    toast.success('Rappel supprimé')
  }

  const handleToggleReminder = async (reminder: ReminderConfig) => {
    const updated = { ...reminder, is_active: !reminder.is_active }
    await supabase
      .from('business_appointment_reminders')
      .update({ is_active: updated.is_active, updated_at: new Date().toISOString() })
      .eq('id', reminder.id)
    setReminders(prev => prev.map(r => r.id === reminder.id ? updated : r))
    toast.success(updated.is_active ? 'Rappel activé' : 'Rappel désactivé')
  }

  const manualReminder = reminders.find(r => r.is_manual)

  const handleSendManualReminder = async (appointmentId: string) => {
    if (!effectiveUserId) return
    setSendingManualReminder(appointmentId)
    try {
      const res = await fetch(`${API_URL}?action=appointment-send-reminder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: effectiveUserId,
          appointment_id: appointmentId,
          reminder_id: manualReminder?.id || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Erreur envoi rappel'); return }
      toast.success(`Rappel envoyé à ${data.sent_to}`)
    } catch {
      toast.error('Erreur lors de l\'envoi')
    } finally {
      setSendingManualReminder(null)
    }
  }

  // Fetch team members + owner for everyone (needed for booking modal + filters)
  useEffect(() => {
    if (!effectiveUserId) return
    Promise.all([
      supabase.from('business_team_members').select('id, first_name, last_name, role, timezone, owner_assignable').eq('business_owner_id', effectiveUserId),
      supabase.from('business_users').select('id, full_name, timezone, owner_assignable').eq('id', effectiveUserId).single(),
    ]).then(([tmRes, ownerRes]) => {
      const list = (tmRes.data || []).filter((m: any) => !['Head of Sales', 'Admin'].includes(m.role) || m.owner_assignable)
      if (ownerRes.data?.owner_assignable) {
        const nameParts = (ownerRes.data.full_name || 'Owner').split(' ')
        list.unshift({ id: ownerRes.data.id, first_name: nameParts[0] || 'Owner', last_name: nameParts.slice(1).join(' ') || '', role: 'Owner', timezone: ownerRes.data.timezone || 'Europe/Paris' })
      }
      setTeamMembers(list)
    })
  }, [effectiveUserId])

  // Fetch booking links
  useEffect(() => {
    if (!showBookingSection) return
    if ((isSetter || isCloserOnly) && teamMember?.id) {
      supabase
        .from('business_booking_links')
        .select('*')
        .eq('team_member_id', teamMember.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => setBookingLinks(data || []))
    } else if (isOwnerOrHoS && effectiveUserId) {
      supabase
        .from('business_booking_links')
        .select('*')
        .eq('business_owner_id', effectiveUserId)
        .order('created_at', { ascending: false })
        .then(({ data }) => setBookingLinks(data || []))
    }
  }, [showBookingSection, isSetter, isCloserOnly, isOwnerOrHoS, teamMember?.id, effectiveUserId])

  const handleCreateBookingLink = async () => {
    if (!newLinkLabel.trim()) return
    const ownerId = isOwnerOrHoS ? effectiveUserId : ownerUserId
    if (!ownerId) return
    setSavingLink(true)
    const slug = crypto.randomUUID().slice(0, 8)
    const memberIdToUse = ((isSetter || isCloserOnly) && !canBookForOthers) ? teamMember?.id : (newLinkMemberId || ((isSetter || isCloserOnly) ? teamMember?.id : null))
    const bookingUrl = `${window.location.origin}/book/${slug}`
    const { data, error } = await supabase
      .from('business_booking_links')
      .insert({
        team_member_id: memberIdToUse,
        business_owner_id: ownerId,
        label: newLinkLabel.trim(),
        duration: newLinkDuration,
        description: newLinkDescription.trim() || null,
        redirect_url: newLinkRedirectUrl.trim() || null,
        email_enabled: newLinkEmailEnabled,
        email_required: newLinkEmailRequired,
        phone_enabled: newLinkPhoneEnabled,
        phone_required: newLinkPhoneRequired,
        google_meet_enabled: newLinkGoogleMeetEnabled,
        link: bookingUrl,
        slug,
      })
      .select()
      .single()
    setSavingLink(false)
    if (error) { toast.error('Erreur lors de la création'); return }
    if (data) setBookingLinks(prev => [data, ...prev])
    setShowCreateLink(false)
    setNewLinkLabel('')
    setNewLinkDuration(30)
    setNewLinkMemberId('')
    setNewLinkDescription('')
    setNewLinkRedirectUrl('')
    setNewLinkEmailEnabled(true)
    setNewLinkEmailRequired(false)
    setNewLinkPhoneEnabled(true)
    setNewLinkPhoneRequired(false)
    setNewLinkGoogleMeetEnabled(true)
    toast.success('Lien de booking créé')
  }

  const handleDeleteBookingLink = async (id: string) => {
    await supabase.from('business_booking_links').delete().eq('id', id)
    setBookingLinks(prev => prev.filter(l => l.id !== id))
    toast.success('Lien supprimé')
  }

  // Edit booking link
  const [editingLink, setEditingLink] = useState<BookingLink | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editDuration, setEditDuration] = useState(30)
  const [editDescription, setEditDescription] = useState('')
  const [editRedirectUrl, setEditRedirectUrl] = useState('')
  const [editMemberId, setEditMemberId] = useState('')
  const [editEmailEnabled, setEditEmailEnabled] = useState(true)
  const [editEmailRequired, setEditEmailRequired] = useState(false)
  const [editPhoneEnabled, setEditPhoneEnabled] = useState(true)
  const [editPhoneRequired, setEditPhoneRequired] = useState(false)
  const [editGoogleMeetEnabled, setEditGoogleMeetEnabled] = useState(true)
  const [savingEdit, setSavingEdit] = useState(false)

  const handleStartEdit = (bl: BookingLink) => {
    setEditingLink(bl)
    setEditLabel(bl.label)
    setEditDuration(bl.duration)
    setEditDescription(bl.description || '')
    setEditRedirectUrl(bl.redirect_url || '')
    setEditMemberId(bl.team_member_id || '')
    setEditEmailEnabled(bl.email_enabled)
    setEditEmailRequired(bl.email_required)
    setEditPhoneEnabled(bl.phone_enabled)
    setEditPhoneRequired(bl.phone_required)
    setEditGoogleMeetEnabled(bl.google_meet_enabled ?? true)
  }

  const handleSaveEdit = async () => {
    if (!editingLink || !editLabel.trim()) return
    setSavingEdit(true)
    const { error } = await supabase
      .from('business_booking_links')
      .update({
        label: editLabel.trim(),
        duration: editDuration,
        description: editDescription.trim() || null,
        redirect_url: editRedirectUrl.trim() || null,
        team_member_id: editMemberId || null,
        email_enabled: editEmailEnabled,
        email_required: editEmailRequired,
        phone_enabled: editPhoneEnabled,
        phone_required: editPhoneRequired,
        google_meet_enabled: editGoogleMeetEnabled,
      })
      .eq('id', editingLink.id)
    setSavingEdit(false)
    if (error) { toast.error('Erreur lors de la mise à jour'); return }
    setBookingLinks(prev => prev.map(l => l.id === editingLink.id ? {
      ...l,
      label: editLabel.trim(),
      duration: editDuration,
      description: editDescription.trim() || null,
      redirect_url: editRedirectUrl.trim() || null,
      team_member_id: editMemberId || null,
      email_enabled: editEmailEnabled,
      email_required: editEmailRequired,
      phone_enabled: editPhoneEnabled,
      phone_required: editPhoneRequired,
      google_meet_enabled: editGoogleMeetEnabled,
    } : l))
    setEditingLink(null)
    toast.success('Lien mis à jour')
  }

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link)
    toast.success('Lien copié !')
  }

  const fetchAppointments = useCallback(async () => {
    if (!effectiveUserId) { setLoading(false); return }
    try {
      const res = await fetch(`${API_URL}?action=appointments-list&user_id=${effectiveUserId}`)
      const data = await res.json()
      if (data.appointments) {
        const now = Date.now()
        const pastIds: string[] = []
        const appts = (data.appointments as Appointment[]).map(a => {
          if (a.status === 'pending' || a.status === 'confirmed') {
            const localDt = a.datetime_utc ? fromUTC(a.datetime_utc, userTimezone) : { date: a.date, time: a.time?.slice(0, 5) || '00:00' }
            const start = new Date(`${localDt.date}T${localDt.time}:00`)
            const end = new Date(start.getTime() + (a.duration || 30) * 60000)
            if (end.getTime() < now) {
              pastIds.push(a.id)
              return { ...a, status: 'done' as const }
            }
          }
          return a
        })
        setAppointments(appts)
        // Auto-mark past appointments as done in background
        for (const id of pastIds) {
          fetch(`${API_URL}?action=appointments-update`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: effectiveUserId, id, status: 'done' }),
          }).catch(() => {})
        }
      }
    } catch (err) {
      console.error('Error fetching appointments:', err)
    } finally {
      setLoading(false)
    }
  }, [effectiveUserId, userTimezone])

  useEffect(() => { fetchAppointments() }, [fetchAppointments])

  const updateStatus = async (id: string, status: string) => {
    try {
      await fetch(`${API_URL}?action=appointments-update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.id, id, status }),
      })
      toast.success(`Statut mis à jour`)
      fetchAppointments()
    } catch {
      toast.error('Erreur')
    }
  }

  const handleDeleteAppointment = async (id: string) => {
    if (!effectiveUserId) return
    try {
      await fetch(`${API_URL}?action=appointments-delete&user_id=${effectiveUserId}&id=${id}`, {
        method: 'DELETE',
      })
      toast.success('Rendez-vous supprimé')
      setSelectedAppointment(null)
      fetchAppointments()
    } catch {
      toast.error('Erreur lors de la suppression')
    }
  }

  // ─── Book a RDV ───
  const handleBookAppointment = async () => {
    if (!bookDate || !bookTime) { toast.error('Date et heure requises'); return }
    if (!effectiveUserId) return
    setBookSaving(true)

    try {
      // Determine assigned_to
      const assignedTo = bookMemberId || (isTeamMember ? teamMember?.id : null) || null

      // Compute end time for Google Calendar
      const [h, m] = bookTime.split(':').map(Number)
      const endMinutes = h * 60 + m + bookDuration
      const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`

      let googleMeetLink: string | null = null

      // Create Google Calendar event with Meet if connected and requested
      if (isGoogleConnected && bookWithMeet) {
        const title = bookTitle.trim() || 'Rendez-vous CloseOS'
        const result = await createGoogleEvent({
          title,
          date: bookDate,
          startTime: bookTime,
          endTime,
          description: bookNotes || '',
          withGoogleMeet: true,
        })
        if (result.success && result.hangoutLink) {
          googleMeetLink = result.hangoutLink
        }
      }

      // Convert local time to UTC for storage
      const utcDate = toUTC(bookDate, bookTime, userTimezone)

      // Create appointment via API (uses service role, bypasses RLS)
      const res = await fetch(`${API_URL}?action=appointments-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: effectiveUserId,
          title: bookTitle.trim() || null,
          date: bookDate,
          time: bookTime,
          duration: bookDuration,
          assigned_to: assignedTo,
          notes: bookNotes || null,
          google_meet_link: googleMeetLink,
          datetime_utc: utcDate.toISOString(),
          timezone: userTimezone,
        }),
      })

      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Erreur'); setBookSaving(false); return }

      toast.success(googleMeetLink ? 'RDV créé avec Google Meet' : 'RDV créé')
      setShowBookModal(false)
      resetBookForm()
      fetchAppointments()
    } catch (err) {
      console.error('Error booking appointment:', err)
      toast.error('Erreur lors de la création')
    } finally {
      setBookSaving(false)
    }
  }

  const resetBookForm = () => {
    setBookTitle('')
    setBookDate('')
    setBookTime('')
    setBookDuration(30)
    setBookMemberId('')
    setBookNotes('')
    setBookWithMeet(true)
  }

  // Determine my member ID (for filtering personal appointments)
  const myMemberId = isTeamMember ? teamMember?.id : effectiveUserId

  // With tabs: "personnel" = my appointments, "membre" = all team
  const visibleAppointments = (() => {
    if (showTabs && activeTab === 'personnel') {
      return appointments.filter(a => {
        // Owner's personal appointments have assigned_to = null OR assigned_to = owner's id
        if (!isTeamMember) return (a as any).assigned_to === myMemberId || (a as any).assigned_to === null
        return (a as any).assigned_to === myMemberId
      })
    }
    if (isCloserOnly) {
      return appointments.filter(a => (a as any).assigned_to === teamMember?.id)
    }
    return appointments
  })()

  /** Convert appointment to viewer's local date/time */
  const getLocalDateTime = (appt: Appointment) => {
    if (appt.datetime_utc) {
      return fromUTC(appt.datetime_utc, userTimezone)
    }
    // Fallback for old appointments without datetime_utc
    return { date: appt.date, time: appt.time?.slice(0, 5) || '00:00' }
  }

  const filtered = visibleAppointments.filter(a => {
    if (filterStatus !== 'all' && a.status !== filterStatus) return false
    const localDt = getLocalDateTime(a)
    if (filterDate && localDt.date !== filterDate) return false
    if (!isTeamMember && filterMember !== 'all' && (a as any).assigned_to !== filterMember) return false
    return true
  })

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  const getMemberName = (assignedTo?: string) => {
    if (!assignedTo) return null
    const m = teamMembers.find(t => t.id === assignedTo)
    return m ? `${m.first_name} ${m.last_name}` : null
  }

  /** Get the assigned member's local time (if different timezone) */
  const getMemberLocalTime = (appt: Appointment) => {
    if (!appt.datetime_utc || !(appt as any).assigned_to) return null
    const member = teamMembers.find(t => t.id === (appt as any).assigned_to)
    if (!member?.timezone || member.timezone === userTimezone) return null
    const memberLocal = fromUTC(appt.datetime_utc, member.timezone)
    return { time: memberLocal.time, timezone: member.timezone, name: `${member.first_name} ${member.last_name}` }
  }

  /** When booking for someone else, compute their local time */
  const bookTargetLocalTime = useMemo(() => {
    if (!bookMemberId || !bookDate || !bookTime) return null
    const member = teamMembers.find(m => m.id === bookMemberId)
    if (!member?.timezone || member.timezone === userTimezone) return null
    const utc = toUTC(bookDate, bookTime, userTimezone)
    const memberLocal = fromUTC(utc, member.timezone)
    return { time: memberLocal.time, date: memberLocal.date, timezone: member.timezone, name: `${member.first_name}` }
  }, [bookMemberId, bookDate, bookTime, userTimezone, teamMembers])

  const hasActiveFilters = filterStatus !== 'all' || filterDate !== '' || filterMember !== 'all'

  /** Compute end time string from start time + duration */
  const getEndTime = (startTime: string, duration: number) => {
    const [h, m] = startTime.split(':').map(Number)
    const endMin = h * 60 + m + duration
    return `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`
  }

  /** Get initials from prospect name */
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-[#006c49] animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col gap-8">
        <div className="flex justify-between items-end flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Mes Rendez-vous
              </h1>
              {isOwnerOrHoS && (
                <button
                  onClick={() => setShowReminderConfig(true)}
                  className="p-2.5 rounded-xl bg-[#f5f3f2] dark:bg-neutral-800 hover:bg-[#eae8e7] dark:hover:bg-neutral-700 transition-all group relative"
                  title="Configurer les rappels email"
                >
                  <Settings className="h-5 w-5 text-[#444748] dark:text-neutral-300 group-hover:rotate-90 transition-transform duration-300" />
                  {reminders.filter(r => r.is_active).length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#006c49] rounded-full text-[9px] text-white font-bold flex items-center justify-center">
                      {reminders.filter(r => r.is_active).length}
                    </span>
                  )}
                </button>
              )}
            </div>
            <p className="text-[#444748] dark:text-neutral-300 mt-2">
              {showTabs && activeTab === 'personnel' ? 'Gérez vos rendez-vous personnels.' : showTabs && activeTab === 'membre' ? 'Tous les rendez-vous de l\'équipe.' : 'Gérez vos rendez-vous et votre calendrier.'}
            </p>
          </div>

          {/* Personnel / Membre tabs */}
          {showTabs && (
            <div className="flex gap-1 bg-[#f5f3f2] dark:bg-neutral-900 p-1 rounded-full">
              <button
                onClick={() => setActiveTab('personnel')}
                className={`px-6 py-2 rounded-full text-sm font-semibold transition-all ${
                  activeTab === 'personnel'
                    ? 'bg-white dark:bg-neutral-800 shadow-sm text-[#1b1c1b] dark:text-white'
                    : 'text-[#444748] dark:text-neutral-300 hover:bg-[#eae8e7] dark:hover:bg-neutral-800'
                }`}
              >
                Personnel
              </button>
              <button
                onClick={() => setActiveTab('membre')}
                className={`px-6 py-2 rounded-full text-sm font-semibold transition-all ${
                  activeTab === 'membre'
                    ? 'bg-white dark:bg-neutral-800 shadow-sm text-[#1b1c1b] dark:text-white'
                    : 'text-[#444748] dark:text-neutral-300 hover:bg-[#eae8e7] dark:hover:bg-neutral-800'
                }`}
              >
                Membre
              </button>
            </div>
          )}
        </div>

        {/* Filter Bar — Glass morphism */}
        <div className="bg-white/70 dark:bg-white/5 backdrop-blur-2xl p-4 rounded-2xl flex flex-wrap items-center gap-4 shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)] ring-1 ring-white/20 dark:ring-neutral-700">
          {/* Team member filter (owner/HoS) */}
          {isOwnerOrHoS && teamMembers.length > 0 && (
            <div className="flex-1 min-w-[180px] relative">
              <Users className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#444748] dark:text-neutral-300/60" />
              <select
                value={filterMember}
                onChange={(e) => setFilterMember(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white/50 dark:bg-white/5 border-none rounded-full text-sm focus:ring-2 ring-[#006c49]/20 appearance-none font-medium text-[#1b1c1b] dark:text-white"
              >
                <option value="all">Tous les membres</option>
                {teamMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.first_name} {m.last_name}{m.role === 'Owner' ? ' (Owner)' : ''}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex-1 min-w-[180px] relative">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#444748] dark:text-neutral-300/60" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white/50 dark:bg-white/5 border-none rounded-full text-sm focus:ring-2 ring-[#006c49]/20 appearance-none font-medium text-[#1b1c1b] dark:text-white"
            >
              <option value="all">Statut : Tous</option>
              <option value="pending">En attente</option>
              <option value="confirmed">Confirmé</option>
              <option value="cancelled">Annulé</option>
              <option value="done">Terminé</option>
            </select>
          </div>
          <div className="flex-1 min-w-[180px] relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#444748] dark:text-neutral-300/60" />
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white/50 dark:bg-white/5 border-none rounded-full text-sm focus:ring-2 ring-[#006c49]/20 font-medium text-[#1b1c1b] dark:text-white"
            />
          </div>
          {hasActiveFilters && (
            <button
              onClick={() => { setFilterStatus('all'); setFilterDate(''); setFilterMember('all') }}
              className="text-sm text-[#006c49] hover:text-[#005236] font-semibold"
            >
              Réinitialiser
            </button>
          )}
          <button
            onClick={() => setShowBookModal(true)}
            className="bg-[#1b1c1b] text-white px-8 py-3 rounded-full font-bold text-sm hover:scale-105 active:scale-95 transition-all"
          >
            Booker un RDV
          </button>
        </div>
      </div>

      {/* Book RDV Modal */}
      {showBookModal && (
        <>
          <div className="fixed inset-0 z-50 bg-[#1b1c1b]/30 backdrop-blur-md" onClick={() => { setShowBookModal(false); resetBookForm() }} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-lg bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl overflow-hidden relative" onClick={e => e.stopPropagation()}>
              {/* Gradient accent bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#006c49] to-[#ffb95f]" />

              <div className="flex justify-between items-start px-10 pt-10 pb-0">
                <div>
                  <h2 className="text-3xl font-extrabold tracking-tight text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Nouveau RDV</h2>
                  <p className="text-sm text-[#444748] dark:text-neutral-300 mt-1">Planifiez un nouveau rendez-vous.</p>
                </div>
                <button onClick={() => { setShowBookModal(false); resetBookForm() }} className="p-2 rounded-full hover:bg-[#f5f3f2] dark:bg-neutral-900 transition-all">
                  <X className="h-5 w-5 text-[#444748] dark:text-neutral-300" />
                </button>
              </div>

              <div className="p-10 pt-8 space-y-6">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#444748] dark:text-neutral-300 mb-2 ml-1">Titre de l'événement</label>
                  <input
                    type="text"
                    value={bookTitle}
                    onChange={e => setBookTitle(e.target.value)}
                    placeholder="Ex: RDV Découverte, Follow-up..."
                    className="w-full px-5 py-3 rounded-xl bg-[#f5f3f2] dark:bg-neutral-900 border-none focus:ring-2 ring-[#006c49]/20 font-medium text-sm text-[#1b1c1b] dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-[#444748] dark:text-neutral-300 mb-2 ml-1">Date *</label>
                    <input
                      type="date"
                      value={bookDate}
                      onChange={e => setBookDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-5 py-3 rounded-xl bg-[#f5f3f2] dark:bg-neutral-900 border-none focus:ring-2 ring-[#006c49]/20 font-medium text-sm text-[#1b1c1b] dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-[#444748] dark:text-neutral-300 mb-2 ml-1">Heure *</label>
                    <input
                      type="time"
                      value={bookTime}
                      onChange={e => setBookTime(e.target.value)}
                      className="w-full px-5 py-3 rounded-xl bg-[#f5f3f2] dark:bg-neutral-900 border-none focus:ring-2 ring-[#006c49]/20 font-medium text-sm text-[#1b1c1b] dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#444748] dark:text-neutral-300 mb-2 ml-1">Durée</label>
                  <select
                    value={bookDuration}
                    onChange={e => setBookDuration(Number(e.target.value))}
                    className="w-full px-5 py-3 rounded-xl bg-[#f5f3f2] dark:bg-neutral-900 border-none focus:ring-2 ring-[#006c49]/20 font-medium text-sm text-[#1b1c1b] dark:text-white"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>1 heure</option>
                    <option value={90}>1h30</option>
                  </select>
                </div>

                {/* For whom */}
                {canBookForOthers && teamMembers.length > 0 ? (
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-[#444748] dark:text-neutral-300 mb-2 ml-1">Assigner à</label>
                    <select
                      value={bookMemberId}
                      onChange={e => setBookMemberId(e.target.value)}
                      className="w-full px-5 py-3 rounded-xl bg-[#f5f3f2] dark:bg-neutral-900 border-none focus:ring-2 ring-[#006c49]/20 font-medium text-sm text-[#1b1c1b] dark:text-white"
                    >
                      <option value="">Pour moi</option>
                      {teamMembers.map(m => (
                        <option key={m.id} value={m.id}>{m.first_name} {m.last_name} ({m.role})</option>
                      ))}
                    </select>
                    {bookTargetLocalTime && (
                      <div className="mt-2 flex items-center gap-1.5 rounded-xl bg-blue-50 px-4 py-2.5">
                        <Globe className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                        <p className="text-xs text-blue-700">
                          Il sera <span className="font-semibold">{bookTargetLocalTime.time}</span> chez {bookTargetLocalTime.name} ({getTimezoneLabel(bookTargetLocalTime.timezone)})
                        </p>
                      </div>
                    )}
                  </div>
                ) : null}

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#444748] dark:text-neutral-300 mb-2 ml-1">Notes internes</label>
                  <textarea
                    value={bookNotes}
                    onChange={e => setBookNotes(e.target.value)}
                    rows={3}
                    placeholder="Objectifs de l'appel, contexte..."
                    className="w-full px-5 py-3 rounded-xl bg-[#f5f3f2] dark:bg-neutral-900 border-none focus:ring-2 ring-[#006c49]/20 font-medium text-sm text-[#1b1c1b] dark:text-white resize-none"
                  />
                </div>

                {/* Google Meet toggle */}
                {isGoogleConnected && (
                  <div className="flex items-center justify-between p-4 bg-[#f5f3f2] dark:bg-neutral-900 rounded-xl">
                    <div className="flex items-center gap-3">
                      <Video className="h-5 w-5 text-[#444748] dark:text-neutral-300" />
                      <span className="text-sm font-bold text-[#1b1c1b] dark:text-white">Activer Google Meet</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bookWithMeet}
                        onChange={e => setBookWithMeet(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-[#e4e2e1] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#006c49]" />
                    </label>
                  </div>
                )}

                {!isGoogleConnected && (
                  <div className="p-4 rounded-xl bg-[#f5f3f2] dark:bg-neutral-900">
                    <p className="text-xs text-[#444748] dark:text-neutral-300">
                      Connectez votre Google Calendar depuis l'Agenda pour générer des liens Google Meet.
                    </p>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    onClick={handleBookAppointment}
                    disabled={bookSaving || !bookDate || !bookTime}
                    className="w-full py-4 bg-[#1b1c1b] text-white rounded-full font-extrabold tracking-tight hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-black/10 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {bookSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Confirmer le rendez-vous
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Reminder Config Modal */}
      {showReminderConfig && (
        <>
          <div className="fixed inset-0 z-50 bg-[#1b1c1b]/30 backdrop-blur-md" onClick={() => { setShowReminderConfig(false); setEditingReminder(null) }} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className={`pointer-events-auto w-full ${editingReminder?.template_type === 'custom' ? 'max-w-6xl' : 'max-w-2xl'} max-h-[90vh] bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl overflow-hidden relative flex flex-col transition-all duration-300`} onClick={e => e.stopPropagation()}>
              {/* Gradient accent bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#006c49] to-[#ffb95f]" />

              <div className="flex justify-between items-start px-10 pt-10 pb-0 shrink-0">
                <div>
                  <h2 className="text-3xl font-extrabold tracking-tight text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {editingReminder ? (editingReminder.id ? 'Modifier le rappel' : 'Nouveau rappel') : 'Rappels email'}
                  </h2>
                  <p className="text-sm text-[#444748] dark:text-neutral-300 mt-1">
                    {editingReminder ? 'Configurez le contenu et le timing de votre rappel.' : 'Configurez des rappels automatiques envoyés avant vos rendez-vous.'}
                  </p>
                </div>
                <button onClick={() => { if (editingReminder) { setEditingReminder(null) } else { setShowReminderConfig(false) } }} className="p-2 rounded-full hover:bg-[#f5f3f2] dark:hover:bg-neutral-800 transition-all">
                  <X className="h-5 w-5 text-[#444748] dark:text-neutral-300" />
                </button>
              </div>

              <div className="p-10 pt-8 overflow-y-auto flex-1">
                {!editingReminder ? (
                  /* ─── Reminder List View ─── */
                  <div className="space-y-6">
                    {/* Manual reminder section */}
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#444748] dark:text-neutral-400 mb-3 ml-1">Rappel manuel (bouton sur les cartes)</p>
                      {manualReminder ? (
                        <div className={`flex items-center justify-between p-5 rounded-xl border transition-all ${manualReminder.is_active ? 'bg-white dark:bg-neutral-800 border-[#ffb95f]/30' : 'bg-[#f5f3f2]/50 dark:bg-neutral-800/30 border-[#e4e2e1]/20 dark:border-neutral-700/10 opacity-60'}`}>
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <Bell className="h-5 w-5 text-[#ffb95f] shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-sm text-[#1b1c1b] dark:text-white truncate">{manualReminder.name}</h4>
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${manualReminder.template_type === 'custom' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
                                  {manualReminder.template_type === 'custom' ? 'Personnalisé' : 'Standard'}
                                </span>
                              </div>
                              <p className="text-xs text-[#747878] dark:text-neutral-400 mt-0.5">Envoyé manuellement depuis chaque carte de rendez-vous</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-3">
                            <button onClick={() => setEditingReminder(manualReminder)} className="p-2 rounded-full hover:bg-[#f5f3f2] dark:hover:bg-neutral-700 transition-all text-[#444748] dark:text-neutral-300">
                              <ChevronRight className="h-4 w-4" />
                            </button>
                            <button onClick={() => handleDeleteReminder(manualReminder.id!)} className="p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-all text-red-400 hover:text-red-500">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingReminder({ ...DEFAULT_MANUAL_REMINDER })}
                          className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-[#ffb95f]/30 text-sm font-bold text-[#b87500] dark:text-[#ffb95f] hover:border-[#ffb95f] hover:bg-[#ffb95f]/5 transition-all"
                        >
                          <Plus className="h-4 w-4" />
                          Configurer le rappel manuel
                        </button>
                      )}
                    </div>

                    {/* Separator */}
                    <hr className="border-[#e4e2e1]/50 dark:border-neutral-700/30" />

                    {/* Automatic reminders section */}
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#444748] dark:text-neutral-400 mb-3 ml-1">Rappels automatiques</p>
                      {reminders.filter(r => !r.is_manual).length === 0 && (
                        <div className="flex flex-col items-center py-8">
                          <Clock className="h-10 w-10 text-[#c4c7c7] dark:text-neutral-600 mb-3" />
                          <p className="text-xs text-[#747878] dark:text-neutral-500">Aucun rappel automatique configuré.</p>
                        </div>
                      )}

                      <div className="space-y-3">
                        {reminders.filter(r => !r.is_manual).map(r => (
                          <div key={r.id} className={`flex items-center justify-between p-5 rounded-xl border transition-all ${r.is_active ? 'bg-white dark:bg-neutral-800 border-[#e4e2e1]/50 dark:border-neutral-700/30' : 'bg-[#f5f3f2]/50 dark:bg-neutral-800/30 border-[#e4e2e1]/20 dark:border-neutral-700/10 opacity-60'}`}>
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                              <button onClick={() => handleToggleReminder(r)} className="shrink-0">
                                {r.is_active ? (
                                  <ToggleRight className="h-6 w-6 text-[#006c49]" />
                                ) : (
                                  <ToggleLeft className="h-6 w-6 text-[#c4c7c7] dark:text-neutral-500" />
                                )}
                              </button>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-bold text-sm text-[#1b1c1b] dark:text-white truncate">{r.name}</h4>
                                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${r.template_type === 'custom' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
                                    {r.template_type === 'custom' ? 'Personnalisé' : 'Standard'}
                                  </span>
                                </div>
                                <p className="text-xs text-[#747878] dark:text-neutral-400 mt-0.5">
                                  {TIMING_OPTIONS.find(t => t.value === r.timing)?.label || r.timing}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 ml-3">
                              <button onClick={() => setEditingReminder(r)} className="p-2 rounded-full hover:bg-[#f5f3f2] dark:hover:bg-neutral-700 transition-all text-[#444748] dark:text-neutral-300">
                                <ChevronRight className="h-4 w-4" />
                              </button>
                              <button onClick={() => handleDeleteReminder(r.id!)} className="p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-all text-red-400 hover:text-red-500">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={() => setEditingReminder({ ...DEFAULT_REMINDER })}
                        className="w-full flex items-center justify-center gap-2 p-4 mt-3 rounded-xl border-2 border-dashed border-[#e4e2e1] dark:border-neutral-700 text-sm font-bold text-[#444748] dark:text-neutral-400 hover:border-[#006c49] hover:text-[#006c49] dark:hover:border-[#006c49] dark:hover:text-[#006c49] transition-all"
                      >
                        <Plus className="h-4 w-4" />
                        Ajouter un rappel automatique
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ─── Reminder Edit View ─── */
                  <div className="space-y-6">
                    {/* Nom du rappel */}
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-[#444748] dark:text-neutral-300 mb-2 ml-1">Nom du rappel</label>
                      <input
                        type="text"
                        value={editingReminder.name}
                        onChange={e => setEditingReminder({ ...editingReminder, name: e.target.value })}
                        placeholder="Ex: Rappel J-1, Rappel 1h avant..."
                        className="w-full px-5 py-3 rounded-xl bg-[#f5f3f2] dark:bg-neutral-800 border-none focus:ring-2 ring-[#006c49]/20 font-medium text-sm text-[#1b1c1b] dark:text-white"
                      />
                    </div>

                    {/* Timing (hidden for manual) */}
                    {!editingReminder.is_manual && (
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-[#444748] dark:text-neutral-300 mb-2 ml-1">Quand envoyer</label>
                        <select
                          value={editingReminder.timing}
                          onChange={e => setEditingReminder({ ...editingReminder, timing: e.target.value })}
                          className="w-full px-5 py-3 rounded-xl bg-[#f5f3f2] dark:bg-neutral-800 border-none focus:ring-2 ring-[#006c49]/20 font-medium text-sm text-[#1b1c1b] dark:text-white"
                        >
                          {TIMING_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {editingReminder.is_manual && (
                      <div className="flex items-center gap-3 p-4 rounded-xl bg-[#ffb95f]/10 border border-[#ffb95f]/20">
                        <Bell className="h-5 w-5 text-[#b87500] shrink-0" />
                        <p className="text-sm text-[#b87500] dark:text-[#ffb95f]">
                          Ce rappel s'envoie manuellement via le bouton <strong>Rappel</strong> sur chaque carte de rendez-vous.
                        </p>
                      </div>
                    )}

                    {/* Template type toggle */}
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-[#444748] dark:text-neutral-300 mb-2 ml-1">Type de template</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingReminder({ ...editingReminder, template_type: 'default' })}
                          className={`flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-bold transition-all ${
                            editingReminder.template_type === 'default'
                              ? 'bg-[#006c49] text-white shadow-lg shadow-[#006c49]/20'
                              : 'bg-[#f5f3f2] dark:bg-neutral-800 text-[#444748] dark:text-neutral-300 hover:bg-[#eae8e7] dark:hover:bg-neutral-700'
                          }`}
                        >
                          <FileText className="h-4 w-4" />
                          Standard
                        </button>
                        <button
                          onClick={() => setEditingReminder({ ...editingReminder, template_type: 'custom' })}
                          className={`flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-bold transition-all ${
                            editingReminder.template_type === 'custom'
                              ? 'bg-[#006c49] text-white shadow-lg shadow-[#006c49]/20'
                              : 'bg-[#f5f3f2] dark:bg-neutral-800 text-[#444748] dark:text-neutral-300 hover:bg-[#eae8e7] dark:hover:bg-neutral-700'
                          }`}
                        >
                          <Code2 className="h-4 w-4" />
                          Personnalisé
                        </button>
                      </div>
                    </div>

                    {editingReminder.template_type === 'default' ? (
                      /* ─── Default template preview (light DA) ─── */
                      <div className="rounded-xl overflow-hidden border border-[#e4e2e1]/50 dark:border-neutral-700/30">
                        <iframe
                          title="Default email preview"
                          sandbox="allow-same-origin"
                          className="w-full border-none"
                          style={{ height: 620 }}
                          srcDoc={`<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:40px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
      <tr><td style="padding-bottom:32px;text-align:left;padding-left:16px;">
        <img src="https://closeos.fr/closeos-business-logo-ecrit.png" alt="CloseOS Business" width="140" style="display:block;">
      </td></tr>
      <tr><td style="background-color:#ffffff;border-radius:36px;padding:48px 36px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);">
        <h1 style="font-family:'Manrope',Arial,sans-serif;font-weight:800;margin:0 0 12px;font-size:32px;color:#111111;text-align:left;line-height:1.1;letter-spacing:-0.04em;">Rappel de<br>rendez-vous</h1>
        <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 36px;font-size:14px;color:#1b1c1b;line-height:1.6;">Bonjour <strong style="color:#111111;">{{lead_name}}</strong>, ceci est un rappel pour votre rendez-vous <strong style="color:#111111;">{{appointment_title}}</strong> avec <strong style="color:#111111;">{{assignee_name}}</strong>.</p>
        <div style="background-color:#f5f3f2;border-radius:36px;padding:28px 24px;margin-bottom:36px;">
          <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 4px;font-size:12px;color:#1b1c1b;"><strong style="color:#111111;">Date</strong></p>
          <p style="font-family:'Manrope',Arial,sans-serif;font-weight:800;margin:0 0 16px;font-size:16px;color:#111111;letter-spacing:-0.04em;">{{appointment_date}}</p>
          <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 4px;font-size:12px;color:#1b1c1b;"><strong style="color:#111111;">Heure</strong></p>
          <p style="font-family:'Manrope',Arial,sans-serif;font-weight:800;margin:0;font-size:16px;color:#111111;letter-spacing:-0.04em;">{{appointment_time}}</p>
        </div>
        <a href="#" style="display:block;background-color:#111111;color:#ffffff;text-align:center;padding:14px 24px;border-radius:48px;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:14px;text-decoration:none;margin-bottom:24px;">Rejoindre le Google Meet</a>
        <div style="text-align:center;">
          <a href="#" style="font-family:'Inter',Helvetica,sans-serif;color:#1b1c1b;font-size:12px;text-decoration:underline;margin-right:20px;">Reporter le rendez-vous</a>
          <a href="#" style="font-family:'Inter',Helvetica,sans-serif;color:#ef4444;font-size:12px;text-decoration:underline;">Annuler le rendez-vous</a>
        </div>
      </td></tr>
      <tr><td style="padding-top:32px;text-align:left;padding-left:16px;">
        <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 6px;font-size:11px;color:#1b1c1b;opacity:0.6;">Rappel automatique envoyé via <a href="https://closeos.fr" style="color:#a03cf8;text-decoration:none;font-weight:500;">CloseOS</a></p>
        <p style="font-family:'Inter',Helvetica,sans-serif;margin:0;font-size:10px;color:#1b1c1b;opacity:0.5;">Cet e-mail a été envoyé automatiquement, merci de ne pas y répondre.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`}
                        />
                      </div>
                    ) : (
                      /* ─── Custom template: editor + live preview ─── */
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Left: Editor fields */}
                        <div className="space-y-5">
                          {/* Sender name */}
                          <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-[#444748] dark:text-neutral-300 mb-2 ml-1">Nom d'envoi</label>
                            <input
                              type="text"
                              value={editingReminder.sender_name}
                              onChange={e => setEditingReminder({ ...editingReminder, sender_name: e.target.value })}
                              placeholder="CloseOS"
                              className="w-full px-5 py-3 rounded-xl bg-[#f5f3f2] dark:bg-neutral-800 border-none focus:ring-2 ring-[#006c49]/20 font-medium text-sm text-[#1b1c1b] dark:text-white"
                            />
                            <p className="text-[10px] text-[#747878] dark:text-neutral-500 mt-1 ml-1">L'email sera toujours envoyé depuis support@closeos.fr</p>
                          </div>

                          {/* Subject */}
                          <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-[#444748] dark:text-neutral-300 mb-2 ml-1">Objet de l'email</label>
                            <div className="flex items-center gap-0">
                              <span className="px-4 py-3 bg-[#eae8e7] dark:bg-neutral-700 rounded-l-xl text-sm font-bold text-[#444748] dark:text-neutral-300 shrink-0 border-r-0">CloseOS -</span>
                              <input
                                type="text"
                                value={editingReminder.subject.replace(/^CloseOS\s*-\s*/, '')}
                                onChange={e => setEditingReminder({ ...editingReminder, subject: `CloseOS - ${e.target.value}` })}
                                placeholder="Rappel de votre rendez-vous"
                                className="w-full px-5 py-3 rounded-r-xl bg-[#f5f3f2] dark:bg-neutral-800 border-none focus:ring-2 ring-[#006c49]/20 font-medium text-sm text-[#1b1c1b] dark:text-white"
                              />
                            </div>
                          </div>

                          {/* Variables reference */}
                          <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-[#444748] dark:text-neutral-300 mb-2 ml-1">Variables disponibles</label>
                            <div className="flex flex-wrap gap-1.5">
                              {TEMPLATE_VARIABLES.map(v => (
                                <button
                                  key={v.key}
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(v.key)
                                    toast.success(`${v.key} copié`)
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-[#f5f3f2] dark:bg-neutral-800 text-xs font-mono text-[#006c49] dark:text-[#34d399] hover:bg-[#eae8e7] dark:hover:bg-neutral-700 transition-all cursor-copy"
                                  title={`Cliquez pour copier ${v.key}`}
                                >
                                  {v.key} <span className="text-[#747878] dark:text-neutral-500 font-sans ml-1">{v.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Custom HTML content */}
                          <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-[#444748] dark:text-neutral-300 mb-2 ml-1">Contenu HTML de l'email</label>
                            <textarea
                              value={editingReminder.custom_html}
                              onChange={e => setEditingReminder({ ...editingReminder, custom_html: e.target.value })}
                              rows={14}
                              placeholder={`<h2>Bonjour {{lead_name}},</h2>\n<p>Votre rendez-vous <strong>{{appointment_title}}</strong> avec {{assignee_name}} approche.</p>\n<p><strong>Date :</strong> {{appointment_date}} à {{appointment_time}}</p>\n<p><a href="{{google_meet_link}}">Rejoindre le Google Meet</a></p>\n<p><a href="{{reschedule_link}}">Reporter</a> | <a href="{{cancel_link}}">Annuler</a></p>`}
                              className="w-full px-5 py-3 rounded-xl bg-[#f5f3f2] dark:bg-neutral-800 border-none focus:ring-2 ring-[#006c49]/20 font-mono text-xs text-[#1b1c1b] dark:text-white resize-none"
                            />
                            <p className="text-[10px] text-[#747878] dark:text-neutral-500 mt-1 ml-1">
                              Le footer "Rappel automatique envoyé via CloseOS" sera ajouté automatiquement en bas de chaque email.
                            </p>
                          </div>
                        </div>

                        {/* Right: Live preview */}
                        <div className="flex flex-col">
                          <label className="block text-[10px] font-black uppercase tracking-widest text-[#444748] dark:text-neutral-300 mb-2 ml-1">Prévisualisation</label>
                          <div className="flex-1 rounded-xl border border-[#e4e2e1]/50 dark:border-neutral-700/30 overflow-hidden bg-[#fbf9f8] min-h-[500px]">
                            <iframe
                              title="Email preview"
                              sandbox="allow-same-origin"
                              className="w-full h-full min-h-[500px] border-none"
                              srcDoc={(() => {
                                const previewVars: Record<string, string> = {
                                  lead_name: 'Jean Dupont',
                                  assignee_name: 'Marie Martin',
                                  appointment_title: 'RDV Découverte',
                                  appointment_date: 'mardi 25 mars 2026',
                                  appointment_time: '14:30',
                                  google_meet_link: 'https://meet.google.com/abc-defg-hij',
                                  reschedule_link: 'https://closeos.fr/appointment/reschedule/xxx',
                                  cancel_link: 'https://closeos.fr/appointment/cancel/xxx',
                                }
                                let html = editingReminder.custom_html || '<p style="color:#1b1c1b;opacity:0.4;text-align:center;padding:40px;font-family:Inter,Helvetica,sans-serif;font-size:14px;">Commencez à écrire votre HTML pour voir l\'aperçu ici...</p>'
                                for (const [key, value] of Object.entries(previewVars)) {
                                  html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
                                }
                                let subject = editingReminder.subject || 'CloseOS - Rappel de votre rendez-vous'
                                for (const [key, value] of Object.entries(previewVars)) {
                                  subject = subject.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
                                }
                                return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet">
<style>body{margin:0;padding:0;}</style>
</head>
<body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:20px 10px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
      <tr><td style="padding:12px 16px;margin-bottom:16px;">
        <p style="font-family:'Inter',Helvetica,sans-serif;color:#1b1c1b;opacity:0.5;font-size:11px;margin:0 0 2px;"><strong style="opacity:0.8;">De :</strong> ${editingReminder.sender_name || 'CloseOS'} &lt;support@closeos.fr&gt;</p>
        <p style="font-family:'Inter',Helvetica,sans-serif;color:#1b1c1b;opacity:0.5;font-size:11px;margin:0;"><strong style="opacity:0.8;">Objet :</strong> ${subject}</p>
      </td></tr>
      <tr><td style="padding-bottom:24px;text-align:left;padding-left:16px;">
        <img src="https://closeos.fr/closeos-business-logo-ecrit.png" alt="CloseOS Business" width="140" style="display:block;">
      </td></tr>
      <tr><td style="background-color:#ffffff;border-radius:36px;padding:40px 32px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);">
        <div style="font-family:'Inter',Helvetica,sans-serif;font-size:14px;color:#1b1c1b;line-height:1.6;">${html}</div>
      </td></tr>
      <tr><td style="padding-top:24px;text-align:left;padding-left:16px;">
        <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 6px;font-size:11px;color:#1b1c1b;opacity:0.6;">Rappel envoyé via <a href="https://closeos.fr" style="color:#a03cf8;text-decoration:none;font-weight:500;">CloseOS</a></p>
        <p style="font-family:'Inter',Helvetica,sans-serif;margin:0;font-size:10px;color:#1b1c1b;opacity:0.5;">Cet e-mail a été envoyé automatiquement, merci de ne pas y répondre.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
                              })()}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-between items-center pt-2">
                      <button
                        onClick={() => setEditingReminder(null)}
                        className="px-6 py-3 rounded-full border border-[#c4c7c7]/30 dark:border-neutral-700/30 text-sm font-bold text-[#444748] dark:text-neutral-300 hover:bg-[#f5f3f2] dark:hover:bg-neutral-800 transition-all"
                      >
                        Retour
                      </button>
                      <button
                        onClick={() => handleSaveReminder(editingReminder)}
                        disabled={savingReminder || !editingReminder.name.trim()}
                        className="flex items-center gap-2 px-8 py-3 rounded-full bg-[#1b1c1b] text-white text-sm font-extrabold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-black/10 disabled:opacity-50"
                      >
                        {savingReminder && <Loader2 className="h-4 w-4 animate-spin" />}
                        {editingReminder.id ? 'Mettre à jour' : 'Créer le rappel'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Main grid: Appointments + Booking Links */}
      <div className={`grid grid-cols-1 ${showBookingSection ? 'xl:grid-cols-3' : ''} gap-8 items-start`}>
        {/* Left: Appointments List */}
        <div className={showBookingSection ? 'xl:col-span-2' : ''}>
          {/* Empty state */}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center bg-white dark:bg-neutral-900 rounded-2xl border border-[#e4e2e1]/50 dark:border-neutral-700/30 py-20">
              <Calendar className="h-12 w-12 text-[#c4c7c7] mb-4" />
              <h3 className="text-lg font-bold text-[#1b1c1b] dark:text-white mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>Aucun rendez-vous</h3>
              <p className="text-sm text-[#444748] dark:text-neutral-300 mb-6">
                {visibleAppointments.length === 0
                  ? (isTeamMember ? 'Aucun rendez-vous ne vous est assigné' : 'Vos rendez-vous apparaîtront ici')
                  : 'Aucun rendez-vous ne correspond à vos filtres'}
              </p>
              <button
                onClick={() => setShowBookModal(true)}
                className="bg-[#006c49] text-white px-6 py-2.5 rounded-full font-bold text-sm hover:scale-105 active:scale-95 transition-all shadow-lg shadow-[#006c49]/20"
              >
                Booker un RDV
              </button>
            </div>
          )}

          {/* Appointments cards */}
          <div className="flex flex-col gap-6">
            {filtered.map((appt) => {
              const statusConf = STATUS_CONFIG[appt.status] || STATUS_CONFIG.pending
              const memberName = getMemberName((appt as any).assigned_to)
              const localDt = getLocalDateTime(appt)
              const memberTime = getMemberLocalTime(appt)
              const endTime = getEndTime(localDt.time, appt.duration)

              // Temporal tag: passé / bientôt / futur
              const nowMs = Date.now()
              const apptStart = new Date(`${localDt.date}T${localDt.time}:00`)
              const apptEnd = new Date(apptStart.getTime() + appt.duration * 60000)
              const todayStr = new Date().toISOString().split('T')[0]
              let timeTag: { label: string; bg: string; text: string }
              if (apptEnd.getTime() < nowMs) {
                timeTag = { label: 'Passé', bg: 'bg-[#eae8e7]', text: 'text-[#747878]' }
              } else if (localDt.date === todayStr && apptStart.getTime() > nowMs) {
                timeTag = { label: 'Bientôt', bg: 'bg-[#ffb95f]/20', text: 'text-[#b87500]' }
              } else if (localDt.date === todayStr && apptStart.getTime() <= nowMs) {
                timeTag = { label: 'En cours', bg: 'bg-[#006c49]/10', text: 'text-[#006c49]' }
              } else {
                timeTag = { label: 'Futur', bg: 'bg-blue-50', text: 'text-blue-600' }
              }

              return (
                <div key={appt.id} onClick={() => setSelectedAppointment(appt)} className="bg-white dark:bg-neutral-800 p-8 rounded-2xl shadow-[0_20px_40px_rgba(27,28,27,0.02)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)] border border-white/50 dark:border-neutral-700/30 group hover:shadow-lg transition-all duration-500 cursor-pointer">
                  {/* Top: Status + Time + Member + Campaign */}
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusConf.badgeBg} ${statusConf.badgeText} w-fit`}>
                          {statusConf.label}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${timeTag.bg} ${timeTag.text} w-fit`}>
                          {timeTag.label}
                        </span>
                      </div>
                      <h2 className="text-2xl font-extrabold mt-2 text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        {localDt.time} — {endTime}
                      </h2>
                      <p className="text-[#444748] dark:text-neutral-300 font-medium capitalize">{formatDate(localDt.date)}</p>
                      {memberTime && (
                        <span className="inline-flex items-center gap-1 text-xs text-[#747878] mt-0.5" title={`Heure locale de ${memberTime.name} (${getTimezoneLabel(memberTime.timezone)})`}>
                          <Globe className="h-3 w-3" />
                          {memberTime.time} chez {memberTime.name}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {memberName && (
                        <span className="text-[#ffb95f] font-bold text-sm flex items-center gap-1">
                          <User className="h-3.5 w-3.5" style={{ fill: 'currentColor' }} />
                          {memberName}
                        </span>
                      )}
                      {appt.campaign && (
                        <span className="text-[11px] font-bold text-[#444748] dark:text-neutral-300/40 uppercase tracking-widest">
                          Campagne: {appt.campaign.name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Prospect info */}
                  {appt.prospect && (
                    <div className="flex items-center gap-4 mb-8">
                      <div className="w-12 h-12 rounded-full bg-[#efedec] flex items-center justify-center font-bold text-[#1b1c1b] dark:text-white text-sm">
                        {getInitials(appt.prospect.contact)}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-[#1b1c1b] dark:text-white">{appt.prospect.contact}</h3>
                        <p className="text-sm text-[#444748] dark:text-neutral-300">{appt.prospect.email}</p>
                      </div>
                    </div>
                  )}

                  {/* Booking contact info (no prospect) */}
                  {!appt.prospect && (() => {
                    const bk = parseBookingNotes(appt.notes)
                    if (bk) return (
                      <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center font-bold text-blue-600 text-sm">
                          {getInitials(bk.name)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-lg text-[#1b1c1b] dark:text-white">{bk.name}</h3>
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">Booking</span>
                          </div>
                          {bk.email && <p className="text-sm text-[#444748] dark:text-neutral-300">{bk.email}</p>}
                        </div>
                      </div>
                    )
                    if (appt.title) return <p className="text-base font-semibold text-[#1b1c1b] dark:text-white mb-6">{appt.title}</p>
                    return null
                  })()}

                  {/* Bottom: Google Meet + Rappel + Actions */}
                  <div className="flex items-center justify-between border-t border-[#f5f3f2] dark:border-neutral-800 pt-6">
                    <div className="flex items-center gap-4">
                      {appt.google_meet_link ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            window.open(appt.google_meet_link!, '_blank')
                            if (appt.prospect?.id) {
                              window.location.href = `/business/cockpit?name=${encodeURIComponent(appt.prospect.contact || 'Appel')}&prospectId=${appt.prospect.id}`
                            } else {
                              window.location.href = `/business/cockpit?name=${encodeURIComponent(appt.title || 'Appel')}`
                            }
                          }}
                          className="flex items-center gap-2 text-[#1b1c1b] dark:text-white font-bold text-sm hover:underline"
                        >
                          <Video className="h-4 w-4" />
                          Google Meet
                        </button>
                      ) : (
                        <span className="text-[#444748] dark:text-neutral-300/40 italic text-sm">
                          {appt.duration}min
                        </span>
                      )}
                      {appt.prospect?.email && (appt.status === 'pending' || appt.status === 'confirmed') && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSendManualReminder(appt.id) }}
                          disabled={sendingManualReminder === appt.id}
                          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#ffb95f]/10 text-[#b87500] dark:text-[#ffb95f] text-xs font-bold hover:bg-[#ffb95f]/20 transition-all disabled:opacity-50"
                          title="Envoyer un rappel au prospect"
                        >
                          {sendingManualReminder === appt.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Bell className="h-3.5 w-3.5" />
                          )}
                          Rappel
                        </button>
                      )}
                    </div>
                    <div className="flex gap-3">
                      {isOwnerOrHoS && appt.status === 'pending' && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); updateStatus(appt.id, 'confirmed') }}
                            className="px-6 py-2 rounded-full bg-[#1b1c1b] text-white text-sm font-bold hover:shadow-md transition-all"
                          >
                            Confirmer
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); updateStatus(appt.id, 'cancelled') }}
                            className="px-6 py-2 rounded-full border border-[#c4c7c7]/30 dark:border-neutral-700/30 text-sm font-bold text-[#1b1c1b] dark:text-white hover:bg-[#f5f3f2] dark:bg-neutral-900 transition-all"
                          >
                            Annuler
                          </button>
                        </>
                      )}
                      {isOwnerOrHoS && appt.status === 'confirmed' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); updateStatus(appt.id, 'done') }}
                          className="px-6 py-2 rounded-full bg-[#006c49] text-white text-sm font-bold hover:shadow-md transition-all"
                        >
                          Terminer
                        </button>
                      )}
                      {(appt.status === 'cancelled' || appt.status === 'done') && (
                        <>
                          <span className="px-6 py-2 rounded-full border border-[#c4c7c7]/30 dark:border-neutral-700/30 text-sm font-bold text-[#444748] dark:text-neutral-300/50 italic">
                            {appt.status === 'done' ? 'Terminé' : 'Annulé'}
                          </span>
                          {isOwnerOrHoS && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteAppointment(appt.id) }}
                              className="px-4 py-2 rounded-full border border-red-200 dark:border-red-900/30 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all flex items-center gap-1.5"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Supprimer
                            </button>
                          )}
                        </>
                      )}
                      {isTeamMember && !isOwnerOrHoS && appt.status === 'pending' && (
                        <span className="px-6 py-2 rounded-full bg-amber-100/50 text-amber-700 text-sm font-bold italic">En attente</span>
                      )}
                      {isTeamMember && !isOwnerOrHoS && appt.status === 'confirmed' && (
                        <span className="px-6 py-2 rounded-full bg-[#006c49]/10 text-[#006c49] text-sm font-bold italic">Confirmé</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: Booking Links Section */}
        {showBookingSection && (
          <div className="bg-white/70 dark:bg-white/5 backdrop-blur-2xl p-8 rounded-2xl shadow-xl ring-1 ring-white/40 dark:ring-neutral-700 sticky top-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-extrabold text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Liens de Booking</h2>
              <button
                onClick={() => setShowCreateLink(true)}
                className="w-8 h-8 rounded-full bg-[#1b1c1b] text-white flex items-center justify-center hover:scale-110 transition-all"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* Member filter for booking links */}
            {isOwnerOrHoS && teamMembers.length > 0 && (
              <div className="mb-6">
                <select
                  value={filterBookingMember}
                  onChange={(e) => setFilterBookingMember(e.target.value)}
                  className="w-full bg-stone-50/50 dark:bg-neutral-800/50 border-none rounded-full px-4 py-2.5 text-sm font-medium text-[#1b1c1b] dark:text-white focus:ring-2 ring-[#006c49]/20 appearance-none"
                >
                  <option value="all">Tous les membres</option>
                  <option value="owner">Mes liens (Owner)</option>
                  {teamMembers.filter(m => !m._isOwner).map(m => (
                    <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Create link form */}
            {showCreateLink && (
              <div className="rounded-xl bg-[#f5f3f2] dark:bg-neutral-900 p-5 mb-6 space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#444748] dark:text-neutral-300 mb-2 ml-1">Nom du lien</label>
                  <input
                    type="text"
                    value={newLinkLabel}
                    onChange={e => setNewLinkLabel(e.target.value)}
                    placeholder="Ex: RDV Découverte 30min"
                    className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-neutral-800 border-none text-sm focus:ring-2 ring-[#006c49]/20 font-medium text-[#1b1c1b] dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#444748] dark:text-neutral-300 mb-2 ml-1">Durée</label>
                  <select
                    value={newLinkDuration}
                    onChange={e => setNewLinkDuration(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-neutral-800 border-none text-sm focus:ring-2 ring-[#006c49]/20 font-medium text-[#1b1c1b] dark:text-white"
                  >
                    <option value={15}>15 min</option>
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>60 min</option>
                    <option value={90}>90 min</option>
                  </select>
                </div>
                {(isOwnerOrHoS || (isSetter && canBookForOthers)) && (
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-[#444748] dark:text-neutral-300 mb-2 ml-1">Pour qui ?</label>
                    <select
                      value={newLinkMemberId}
                      onChange={e => setNewLinkMemberId(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-neutral-800 border-none text-sm focus:ring-2 ring-[#006c49]/20 font-medium text-[#1b1c1b] dark:text-white"
                    >
                      <option value="">Pour moi</option>
                      {teamMembers.map(m => (
                        <option key={m.id} value={m.id}>{m.first_name} {m.last_name} ({m.role})</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#444748] dark:text-neutral-300 mb-2 ml-1">Description</label>
                  <textarea
                    value={newLinkDescription}
                    onChange={e => setNewLinkDescription(e.target.value)}
                    placeholder="Ex: Appel découverte de 30 minutes pour discuter de votre projet"
                    rows={2}
                    className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-neutral-800 border-none text-sm focus:ring-2 ring-[#006c49]/20 font-medium text-[#1b1c1b] dark:text-white resize-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#444748] dark:text-neutral-300 mb-2 ml-1">Lien de redirection (optionnel)</label>
                  <input
                    type="url"
                    value={newLinkRedirectUrl}
                    onChange={e => setNewLinkRedirectUrl(e.target.value)}
                    placeholder="https://exemple.com/merci"
                    className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-neutral-800 border-none text-sm focus:ring-2 ring-[#006c49]/20 font-medium text-[#1b1c1b] dark:text-white"
                  />
                  <p className="text-[10px] text-[#444748]/50 dark:text-neutral-500 mt-1 ml-1">Redirige le prospect après la réservation</p>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#444748] dark:text-neutral-300 mb-3 ml-1">Champs du formulaire</label>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-xl bg-white dark:bg-neutral-800 px-4 py-2.5">
                      <span className="text-sm font-medium text-[#1b1c1b] dark:text-white flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-[#444748]/50" />Email</span>
                      <div className="flex items-center gap-3">
                        <button onClick={() => setNewLinkEmailEnabled(!newLinkEmailEnabled)} className="text-[#444748] dark:text-neutral-300">
                          {newLinkEmailEnabled ? <ToggleRight className="h-5 w-5 text-[#006c49]" /> : <ToggleLeft className="h-5 w-5" />}
                        </button>
                        {newLinkEmailEnabled && (
                          <button
                            onClick={() => setNewLinkEmailRequired(!newLinkEmailRequired)}
                            className={`text-[10px] font-bold px-2.5 py-1 rounded-full transition-all ${newLinkEmailRequired ? 'bg-[#006c49] text-white' : 'bg-[#f5f3f2] dark:bg-neutral-700 text-[#444748] dark:text-neutral-300'}`}
                          >
                            {newLinkEmailRequired ? 'Requis' : 'Optionnel'}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-white dark:bg-neutral-800 px-4 py-2.5">
                      <span className="text-sm font-medium text-[#1b1c1b] dark:text-white flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-[#444748]/50" />Téléphone</span>
                      <div className="flex items-center gap-3">
                        <button onClick={() => setNewLinkPhoneEnabled(!newLinkPhoneEnabled)} className="text-[#444748] dark:text-neutral-300">
                          {newLinkPhoneEnabled ? <ToggleRight className="h-5 w-5 text-[#006c49]" /> : <ToggleLeft className="h-5 w-5" />}
                        </button>
                        {newLinkPhoneEnabled && (
                          <button
                            onClick={() => setNewLinkPhoneRequired(!newLinkPhoneRequired)}
                            className={`text-[10px] font-bold px-2.5 py-1 rounded-full transition-all ${newLinkPhoneRequired ? 'bg-[#006c49] text-white' : 'bg-[#f5f3f2] dark:bg-neutral-700 text-[#444748] dark:text-neutral-300'}`}
                          >
                            {newLinkPhoneRequired ? 'Requis' : 'Optionnel'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#444748] dark:text-neutral-300 mb-3 ml-1">Visioconférence</label>
                  <div className="flex items-center justify-between rounded-xl bg-white dark:bg-neutral-800 px-4 py-2.5">
                    <span className="text-sm font-medium text-[#1b1c1b] dark:text-white flex items-center gap-2"><Video className="h-3.5 w-3.5 text-[#444748]/50" />Google Meet</span>
                    <button onClick={() => setNewLinkGoogleMeetEnabled(!newLinkGoogleMeetEnabled)} className="text-[#444748] dark:text-neutral-300">
                      {newLinkGoogleMeetEnabled ? <ToggleRight className="h-5 w-5 text-[#006c49]" /> : <ToggleLeft className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setShowCreateLink(false)}
                    className="px-4 py-2 rounded-full border border-[#c4c7c7]/30 dark:border-neutral-700/30 text-xs font-bold text-[#444748] dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-800 transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleCreateBookingLink}
                    disabled={savingLink || !newLinkLabel.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#006c49] text-white text-xs font-bold hover:shadow-md disabled:opacity-50 transition-all"
                  >
                    {savingLink ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    Enregistrer
                  </button>
                </div>
              </div>
            )}

            {/* Existing links */}
            {(() => {
              const filteredLinks = filterBookingMember === 'all'
                ? bookingLinks
                : filterBookingMember === 'owner'
                  ? bookingLinks.filter(bl => !bl.team_member_id)
                  : bookingLinks.filter(bl => bl.team_member_id === filterBookingMember)
              return filteredLinks.length === 0 && !showCreateLink ? (
              <p className="text-sm text-[#444748] dark:text-neutral-300/50 text-center py-6">
                Aucun lien de booking.
              </p>
            ) : (
              <div className="flex flex-col gap-6">
                {filteredLinks.map(bl => {
                  const bookingUrl = bl.slug ? `${window.location.origin}/book/${bl.slug}` : bl.link
                  const memberName = bl.team_member_id ? teamMembers.find(m => m.id === bl.team_member_id) : null
                  return (
                    <div key={bl.id} className="flex items-center justify-between group">
                      <div>
                        <h4 className="font-bold text-sm text-[#1b1c1b] dark:text-white">{bl.label}</h4>
                        <p className="text-[11px] text-[#444748] dark:text-neutral-300">
                          {bl.duration} min
                          {memberName && ` · ${memberName.first_name} ${memberName.last_name}`}
                          {!bl.team_member_id && isOwnerOrHoS && ' · Pour moi'}
                          {bl.redirect_url && ' · Redirection'}
                        </p>
                        {bl.description && (
                          <p className="text-[10px] text-[#444748]/50 dark:text-neutral-400 mt-0.5 truncate max-w-[250px]">{bl.description}</p>
                        )}
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                          onClick={() => handleStartEdit(bl)}
                          className="p-1.5 rounded-full hover:bg-white dark:hover:bg-neutral-800 transition-all text-[#444748] dark:text-neutral-300"
                          title="Modifier"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleCopyLink(bookingUrl)}
                          className="p-1.5 rounded-full hover:bg-white dark:hover:bg-neutral-800 transition-all text-[#444748] dark:text-neutral-300"
                          title="Copier le lien"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <a
                          href={bookingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-full hover:bg-white dark:hover:bg-neutral-800 transition-all text-[#444748] dark:text-neutral-300"
                          title="Ouvrir"
                        >
                          <Link2 className="h-4 w-4" />
                        </a>
                        <button
                          onClick={() => handleDeleteBookingLink(bl.id)}
                          className="p-1.5 rounded-full hover:bg-white dark:hover:bg-neutral-800 text-red-500 transition-all"
                          title="Supprimer"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
            })()}
          </div>
        )}
      </div>

      {/* Edit booking link modal */}
      {editingLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setEditingLink(null)}>
          <div className="bg-white dark:bg-neutral-900 rounded-[2rem] p-8 w-full max-w-md mx-4 shadow-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold text-[#1b1c1b] dark:text-white mb-6 shrink-0" style={{ fontFamily: 'Manrope, sans-serif' }}>Modifier le lien</h3>
            <div className="space-y-4 overflow-y-auto flex-1 min-h-0 pr-1">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-[#444748] dark:text-neutral-300 mb-2 ml-1">Nom du lien</label>
                <input
                  type="text"
                  value={editLabel}
                  onChange={e => setEditLabel(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#f5f3f2] dark:bg-neutral-800 border-none text-sm focus:ring-2 ring-[#006c49]/20 font-medium text-[#1b1c1b] dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-[#444748] dark:text-neutral-300 mb-2 ml-1">Durée</label>
                <select
                  value={editDuration}
                  onChange={e => setEditDuration(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#f5f3f2] dark:bg-neutral-800 border-none text-sm focus:ring-2 ring-[#006c49]/20 font-medium text-[#1b1c1b] dark:text-white"
                >
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                  <option value={45}>45 min</option>
                  <option value={60}>60 min</option>
                  <option value={90}>90 min</option>
                </select>
              </div>
              {(isOwnerOrHoS || (isSetter && canBookForOthers)) && (
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#444748] dark:text-neutral-300 mb-2 ml-1">Pour qui ?</label>
                  <select
                    value={editMemberId}
                    onChange={e => setEditMemberId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#f5f3f2] dark:bg-neutral-800 border-none text-sm focus:ring-2 ring-[#006c49]/20 font-medium text-[#1b1c1b] dark:text-white"
                  >
                    <option value="">Pour moi</option>
                    {teamMembers.map(m => (
                      <option key={m.id} value={m.id}>{m.first_name} {m.last_name} ({m.role})</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-[#444748] dark:text-neutral-300 mb-2 ml-1">Description</label>
                <textarea
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  placeholder="Ex: Appel découverte de 30 minutes..."
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#f5f3f2] dark:bg-neutral-800 border-none text-sm focus:ring-2 ring-[#006c49]/20 font-medium text-[#1b1c1b] dark:text-white resize-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-[#444748] dark:text-neutral-300 mb-2 ml-1">Lien de redirection (optionnel)</label>
                <input
                  type="url"
                  value={editRedirectUrl}
                  onChange={e => setEditRedirectUrl(e.target.value)}
                  placeholder="https://exemple.com/merci"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#f5f3f2] dark:bg-neutral-800 border-none text-sm focus:ring-2 ring-[#006c49]/20 font-medium text-[#1b1c1b] dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-[#444748] dark:text-neutral-300 mb-3 ml-1">Champs du formulaire</label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-xl bg-[#f5f3f2] dark:bg-neutral-800 px-4 py-2.5">
                    <span className="text-sm font-medium text-[#1b1c1b] dark:text-white flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-[#444748]/50" />Email</span>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setEditEmailEnabled(!editEmailEnabled)} className="text-[#444748] dark:text-neutral-300">
                        {editEmailEnabled ? <ToggleRight className="h-5 w-5 text-[#006c49]" /> : <ToggleLeft className="h-5 w-5" />}
                      </button>
                      {editEmailEnabled && (
                        <button
                          onClick={() => setEditEmailRequired(!editEmailRequired)}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full transition-all ${editEmailRequired ? 'bg-[#006c49] text-white' : 'bg-white dark:bg-neutral-700 text-[#444748] dark:text-neutral-300'}`}
                        >
                          {editEmailRequired ? 'Requis' : 'Optionnel'}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-[#f5f3f2] dark:bg-neutral-800 px-4 py-2.5">
                    <span className="text-sm font-medium text-[#1b1c1b] dark:text-white flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-[#444748]/50" />Téléphone</span>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setEditPhoneEnabled(!editPhoneEnabled)} className="text-[#444748] dark:text-neutral-300">
                        {editPhoneEnabled ? <ToggleRight className="h-5 w-5 text-[#006c49]" /> : <ToggleLeft className="h-5 w-5" />}
                      </button>
                      {editPhoneEnabled && (
                        <button
                          onClick={() => setEditPhoneRequired(!editPhoneRequired)}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full transition-all ${editPhoneRequired ? 'bg-[#006c49] text-white' : 'bg-white dark:bg-neutral-700 text-[#444748] dark:text-neutral-300'}`}
                        >
                          {editPhoneRequired ? 'Requis' : 'Optionnel'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-[#444748] dark:text-neutral-300 mb-3 ml-1">Visioconférence</label>
                <div className="flex items-center justify-between rounded-xl bg-white dark:bg-neutral-800 px-4 py-2.5">
                  <span className="text-sm font-medium text-[#1b1c1b] dark:text-white flex items-center gap-2"><Video className="h-3.5 w-3.5 text-[#444748]/50" />Google Meet</span>
                  <button onClick={() => setEditGoogleMeetEnabled(!editGoogleMeetEnabled)} className="text-[#444748] dark:text-neutral-300">
                    {editGoogleMeetEnabled ? <ToggleRight className="h-5 w-5 text-[#006c49]" /> : <ToggleLeft className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setEditingLink(null)}
                  className="px-4 py-2 rounded-full border border-[#c4c7c7]/30 dark:border-neutral-700/30 text-xs font-bold text-[#444748] dark:text-neutral-300 hover:bg-[#f5f3f2] dark:hover:bg-neutral-800 transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={savingEdit || !editLabel.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#006c49] text-white text-xs font-bold hover:shadow-md disabled:opacity-50 transition-all"
                >
                  {savingEdit ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Appointment Detail Popup */}
      {selectedAppointment && (() => {
        const appt = selectedAppointment
        const booking = parseBookingNotes(appt.notes)
        const statusConf = STATUS_CONFIG[appt.status] || STATUS_CONFIG.pending
        const localDt = appt.datetime_utc ? fromUTC(appt.datetime_utc, userTimezone) : { date: appt.date, time: appt.time?.slice(0, 5) || '00:00' }
        const endMinutes = (() => {
          const [h, m] = localDt.time.split(':').map(Number)
          const total = h * 60 + m + (appt.duration || 30)
          return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
        })()
        const contactName = appt.prospect?.contact || booking?.name
        const contactEmail = appt.prospect?.email || booking?.email
        const contactPhone = appt.prospect?.phone || booking?.phone

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4" onClick={() => setSelectedAppointment(null)}>
            <div
              className="w-full max-w-md rounded-[2rem] bg-white dark:bg-neutral-900 shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-7 pt-7 pb-2">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-white/5 flex items-center justify-center shrink-0">
                    {contactName ? (
                      <span className="text-sm font-bold text-[#1b1c1b] dark:text-white">{getInitials(contactName)}</span>
                    ) : (
                      <Calendar className="h-5 w-5 text-neutral-600 dark:text-neutral-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-black text-[#1b1c1b] dark:text-white leading-tight" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      {contactName || appt.title || 'Rendez-vous'}
                    </h3>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${statusConf.badgeBg} ${statusConf.badgeText}`}>
                        {statusConf.label}
                      </span>
                      {booking && !appt.prospect && (
                        <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-blue-50 text-blue-600">
                          Booking
                        </span>
                      )}
                      {appt.campaign && (
                        <span className="text-xs text-neutral-400 flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-neutral-400" />
                          {appt.campaign.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setSelectedAppointment(null)} className="p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors shrink-0 mt-1">
                    <X className="w-4 h-4 text-neutral-400" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="px-7 py-5 space-y-5">
                {/* Date & Time */}
                <div className="flex items-start gap-4">
                  <Clock className="h-5 w-5 text-neutral-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-[#1b1c1b] dark:text-white capitalize">
                      {new Date(localDt.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                      {localDt.time} — {endMinutes} ({appt.duration || 30}min)
                    </p>
                  </div>
                </div>

                {/* Contact info */}
                {contactName && (
                  <div className="flex items-start gap-4">
                    <User className="h-5 w-5 text-neutral-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-[#1b1c1b] dark:text-white">{contactName}</p>
                      {(contactEmail || contactPhone) && (
                        <div className="mt-1 space-y-0.5">
                          {contactEmail && (
                            <p className="text-sm text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                              <Mail className="h-3.5 w-3.5" />
                              {contactEmail}
                            </p>
                          )}
                          {contactPhone && (
                            <p className="text-sm text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5" />
                              {contactPhone}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Notes (only if not a booking-formatted note) */}
                {appt.notes && !booking && (
                  <div className="flex items-start gap-4 min-w-0">
                    <FileText className="h-5 w-5 text-neutral-400 shrink-0 mt-1" />
                    <div className="flex-1 min-w-0 bg-neutral-100 dark:bg-white/5 rounded-2xl p-4">
                      <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-black mb-2">Notes</p>
                      <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed break-words overflow-hidden">{appt.notes}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer: actions */}
              <div className="px-7 pb-7 pt-2 space-y-3">
                {/* Google Meet */}
                {appt.google_meet_link && (
                  <button
                    onClick={() => {
                      window.open(appt.google_meet_link!, '_blank')
                      if (appt.prospect?.id) {
                        window.location.href = `/business/cockpit?name=${encodeURIComponent(appt.prospect.contact || 'Appel')}&prospectId=${appt.prospect.id}`
                      } else {
                        window.location.href = `/business/cockpit?name=${encodeURIComponent(appt.title || 'Appel')}`
                      }
                    }}
                    className="flex items-center justify-center gap-3 rounded-full bg-[#1b1c1b] px-6 py-3.5 text-sm font-bold text-white hover:bg-neutral-800 transition-colors shadow-lg w-full"
                  >
                    <Video className="h-4 w-4" />
                    Rejoindre Google Meet
                  </button>
                )}

                {/* Status actions */}
                <div className="flex items-center gap-3">
                  {isOwnerOrHoS && appt.status === 'pending' && (
                    <>
                      <button
                        onClick={() => { updateStatus(appt.id, 'confirmed'); setSelectedAppointment(null) }}
                        className="flex-1 px-6 py-3 rounded-full bg-[#006c49] text-white text-sm font-bold hover:shadow-md transition-all"
                      >
                        Confirmer
                      </button>
                      <button
                        onClick={() => { updateStatus(appt.id, 'cancelled'); setSelectedAppointment(null) }}
                        className="flex-1 px-6 py-3 rounded-full border border-red-200 text-red-500 text-sm font-bold hover:bg-red-50 transition-all"
                      >
                        Annuler
                      </button>
                    </>
                  )}
                  {isOwnerOrHoS && appt.status === 'confirmed' && (
                    <>
                      <button
                        onClick={() => { updateStatus(appt.id, 'done'); setSelectedAppointment(null) }}
                        className="flex-1 px-6 py-3 rounded-full bg-[#006c49] text-white text-sm font-bold hover:shadow-md transition-all"
                      >
                        Terminer
                      </button>
                      <button
                        onClick={() => { updateStatus(appt.id, 'cancelled'); setSelectedAppointment(null) }}
                        className="flex-1 px-6 py-3 rounded-full border border-red-200 text-red-500 text-sm font-bold hover:bg-red-50 transition-all"
                      >
                        Annuler
                      </button>
                    </>
                  )}
                  {(appt.status === 'cancelled' || appt.status === 'done') && (
                    <>
                      <span className="px-6 py-3 rounded-full border border-[#c4c7c7]/30 dark:border-neutral-700/30 text-sm font-bold text-[#444748] dark:text-neutral-300/50 italic">
                        {appt.status === 'done' ? 'Terminé' : 'Annulé'}
                      </span>
                      {isOwnerOrHoS && (
                        <button
                          onClick={() => handleDeleteAppointment(appt.id)}
                          className="flex-1 px-6 py-3 rounded-full border border-red-200 text-red-500 text-sm font-bold hover:bg-red-50 transition-all flex items-center justify-center gap-1.5"
                        >
                          <Trash2 className="h-4 w-4" />
                          Supprimer
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
