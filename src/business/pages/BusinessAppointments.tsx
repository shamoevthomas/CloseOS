import { useState, useEffect, useCallback, useMemo } from 'react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessGoogleCalendar } from '../contexts/BusinessGoogleCalendarContext'
import {
  Calendar, Loader2, CheckCircle2, XCircle, Clock, Filter,
  ChevronDown, User, Mail, Megaphone, Users, Link2, Copy, Plus, X, Save, Video, Globe,
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
  created_at: string
}

const STATUS_CONFIG: Record<string, { label: string; badgeBg: string; badgeText: string }> = {
  pending: { label: 'En attente', badgeBg: 'bg-amber-100/80', badgeText: 'text-amber-700' },
  confirmed: { label: 'Confirmé', badgeBg: 'bg-[#006c49]/10', badgeText: 'text-[#006c49]' },
  cancelled: { label: 'Annulé', badgeBg: 'bg-red-100/80', badgeText: 'text-red-600' },
  done: { label: 'Terminé', badgeBg: 'bg-[#006c49]/10', badgeText: 'text-[#006c49]' },
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
  const [savingLink, setSavingLink] = useState(false)

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

  // Fetch team members + owner for everyone (needed for booking modal + filters)
  useEffect(() => {
    if (!effectiveUserId) return
    Promise.all([
      supabase.from('business_team_members').select('id, first_name, last_name, role, timezone').eq('business_owner_id', effectiveUserId),
      supabase.from('business_users').select('id, full_name, timezone, owner_assignable').eq('id', effectiveUserId).single(),
    ]).then(([tmRes, ownerRes]) => {
      const list = tmRes.data || []
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
    toast.success('Lien de booking créé')
  }

  const handleDeleteBookingLink = async (id: string) => {
    await supabase.from('business_booking_links').delete().eq('id', id)
    setBookingLinks(prev => prev.filter(l => l.id !== id))
    toast.success('Lien supprimé')
  }

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link)
    toast.success('Lien copié !')
  }

  const fetchAppointments = useCallback(async () => {
    if (!effectiveUserId) return
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
      return appointments.filter(a => (a as any).assigned_to === myMemberId)
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
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#1b1c1b] dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Mes Rendez-vous
            </h1>
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
                <div key={appt.id} className="bg-white dark:bg-neutral-800 p-8 rounded-2xl shadow-[0_20px_40px_rgba(27,28,27,0.02)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)] border border-white/50 dark:border-neutral-700/30 group hover:shadow-lg transition-all duration-500">
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

                  {appt.title && !appt.prospect && (
                    <p className="text-base font-semibold text-[#1b1c1b] dark:text-white mb-6">{appt.title}</p>
                  )}

                  {/* Bottom: Google Meet + Actions */}
                  <div className="flex items-center justify-between border-t border-[#f5f3f2] dark:border-neutral-800 pt-6">
                    <div>
                      {appt.google_meet_link ? (
                        <a
                          href={appt.google_meet_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-[#1b1c1b] dark:text-white font-bold text-sm hover:underline"
                        >
                          <Video className="h-4 w-4" />
                          Google Meet
                        </a>
                      ) : (
                        <span className="text-[#444748] dark:text-neutral-300/40 italic text-sm">
                          {appt.duration}min
                        </span>
                      )}
                    </div>
                    <div className="flex gap-3">
                      {isOwnerOrHoS && appt.status === 'pending' && (
                        <>
                          <button
                            onClick={() => updateStatus(appt.id, 'confirmed')}
                            className="px-6 py-2 rounded-full bg-[#1b1c1b] text-white text-sm font-bold hover:shadow-md transition-all"
                          >
                            Confirmer
                          </button>
                          <button
                            onClick={() => updateStatus(appt.id, 'cancelled')}
                            className="px-6 py-2 rounded-full border border-[#c4c7c7]/30 dark:border-neutral-700/30 text-sm font-bold text-[#1b1c1b] dark:text-white hover:bg-[#f5f3f2] dark:bg-neutral-900 transition-all"
                          >
                            Annuler
                          </button>
                        </>
                      )}
                      {isOwnerOrHoS && appt.status === 'confirmed' && (
                        <button
                          onClick={() => updateStatus(appt.id, 'done')}
                          className="px-6 py-2 rounded-full bg-[#006c49] text-white text-sm font-bold hover:shadow-md transition-all"
                        >
                          Terminer
                        </button>
                      )}
                      {(appt.status === 'cancelled' || appt.status === 'done') && (
                        <span className="px-6 py-2 rounded-full border border-[#c4c7c7]/30 dark:border-neutral-700/30 text-sm font-bold text-[#444748] dark:text-neutral-300/50 italic">
                          {appt.status === 'done' ? 'Terminé' : 'Annulé'}
                        </span>
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
                    className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-neutral-800 border-none text-sm focus:ring-2 ring-[#006c49]/20 font-medium dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#444748] dark:text-neutral-300 mb-2 ml-1">Durée</label>
                  <select
                    value={newLinkDuration}
                    onChange={e => setNewLinkDuration(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-neutral-800 border-none text-sm focus:ring-2 ring-[#006c49]/20 font-medium dark:text-white"
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
                      className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-neutral-800 border-none text-sm focus:ring-2 ring-[#006c49]/20 font-medium dark:text-white"
                    >
                      <option value="">Pour moi</option>
                      {teamMembers.map(m => (
                        <option key={m.id} value={m.id}>{m.first_name} {m.last_name} ({m.role})</option>
                      ))}
                    </select>
                  </div>
                )}
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
                        </p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
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
    </div>
  )
}
