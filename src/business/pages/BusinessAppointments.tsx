import { useState, useEffect, useCallback } from 'react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessGoogleCalendar } from '../contexts/BusinessGoogleCalendarContext'
import {
  Calendar, Loader2, CheckCircle2, XCircle, Clock, Filter,
  ChevronDown, User, Mail, Megaphone, Users, Link2, Copy, Plus, X, Save, Video,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'

interface Appointment {
  id: string
  date: string
  time: string
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

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'En attente', color: 'text-amber-700', bg: 'bg-amber-100' },
  confirmed: { label: 'Confirmé', color: 'text-blue-700', bg: 'bg-blue-100' },
  cancelled: { label: 'Annulé', color: 'text-red-700', bg: 'bg-red-100' },
  done: { label: 'Terminé', color: 'text-green-700', bg: 'bg-green-100' },
}

const API_URL = '/api/business'

export function BusinessAppointments() {
  const { user, isTeamMember, ownerUserId, teamMember } = useBusinessAuth()
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
  const isOwnerOrHoS = !isTeamMember || teamMember?.role === 'Head of Sales'
  const isCloserOnly = isTeamMember && teamMember?.role === 'Closer'
  const showBookingSection = isSetter || isOwnerOrHoS
  const canBookForOthers = !isCloserOnly // everyone except pure closers
  const [bookingLinks, setBookingLinks] = useState<BookingLink[]>([])
  const [showCreateLink, setShowCreateLink] = useState(false)
  const [newLinkLabel, setNewLinkLabel] = useState('')
  const [newLinkDuration, setNewLinkDuration] = useState(30)
  const [newLinkMemberId, setNewLinkMemberId] = useState<string>('')
  const [savingLink, setSavingLink] = useState(false)

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
      supabase.from('business_team_members').select('id, first_name, last_name, role').eq('business_owner_id', effectiveUserId),
      supabase.from('business_users').select('id, full_name').eq('id', effectiveUserId).single(),
    ]).then(([tmRes, ownerRes]) => {
      const list = tmRes.data || []
      if (ownerRes.data) {
        const nameParts = (ownerRes.data.full_name || 'Owner').split(' ')
        list.unshift({ id: ownerRes.data.id, first_name: nameParts[0] || 'Owner', last_name: nameParts.slice(1).join(' ') || '', role: 'Owner' })
      }
      setTeamMembers(list)
    })
  }, [effectiveUserId])

  // Fetch booking links
  useEffect(() => {
    if (!showBookingSection) return
    if (isSetter && teamMember?.id) {
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
  }, [showBookingSection, isSetter, isOwnerOrHoS, teamMember?.id, effectiveUserId])

  const handleCreateBookingLink = async () => {
    if (!newLinkLabel.trim()) return
    const ownerId = isOwnerOrHoS ? effectiveUserId : ownerUserId
    if (!ownerId) return
    setSavingLink(true)
    const slug = crypto.randomUUID().slice(0, 8)
    const memberIdToUse = isSetter ? teamMember?.id : (newLinkMemberId || null)
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
      if (data.appointments) setAppointments(data.appointments)
    } catch (err) {
      console.error('Error fetching appointments:', err)
    } finally {
      setLoading(false)
    }
  }, [effectiveUserId])

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

  // Team members only see their assigned appointments
  const visibleAppointments = isTeamMember
    ? appointments.filter(a => (a as any).assigned_to === teamMember?.id)
    : appointments

  const filtered = visibleAppointments.filter(a => {
    if (filterStatus !== 'all' && a.status !== filterStatus) return false
    if (filterDate && a.date !== filterDate) return false
    if (!isTeamMember && filterMember !== 'all' && (a as any).assigned_to !== filterMember) return false
    return true
  })

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  const getMemberName = (assignedTo?: string) => {
    if (!assignedTo) return null
    const m = teamMembers.find(t => t.id === assignedTo)
    return m ? `${m.first_name} ${m.last_name}` : null
  }

  const hasActiveFilters = filterStatus !== 'all' || filterDate !== '' || filterMember !== 'all'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-amber-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
            <Calendar className="h-5 w-5 text-amber-700" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{visibleAppointments.length} rendez-vous</h2>
            <p className="text-xs text-slate-500">Tous vos rendez-vous</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Book RDV button */}
          <button
            onClick={() => setShowBookModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-500 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Booker un RDV
          </button>

          {/* Team member filter (owner/HoS) */}
          {isOwnerOrHoS && teamMembers.length > 0 && (
            <div className="relative">
              <select
                value={filterMember}
                onChange={(e) => setFilterMember(e.target.value)}
                className="appearance-none rounded-lg border border-slate-200 bg-white pl-8 pr-8 py-2 text-xs font-medium text-slate-600 focus:border-amber-500 focus:outline-none"
              >
                <option value="all">Tous les membres</option>
                {teamMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                ))}
              </select>
              <Users className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            </div>
          )}
          <div className="relative">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="appearance-none rounded-lg border border-slate-200 bg-white pl-8 pr-8 py-2 text-xs font-medium text-slate-600 focus:border-amber-500 focus:outline-none"
            >
              <option value="all">Tous les statuts</option>
              <option value="pending">En attente</option>
              <option value="confirmed">Confirmé</option>
              <option value="cancelled">Annulé</option>
              <option value="done">Terminé</option>
            </select>
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 focus:border-amber-500 focus:outline-none"
          />
          {hasActiveFilters && (
            <button
              onClick={() => { setFilterStatus('all'); setFilterDate(''); setFilterMember('all') }}
              className="text-xs text-amber-600 hover:text-amber-700 font-medium"
            >
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Book RDV Modal */}
      {showBookModal && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => { setShowBookModal(false); resetBookForm() }} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-amber-200 bg-white shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-amber-600" />
                  Booker un rendez-vous
                </h3>
                <button onClick={() => { setShowBookModal(false); resetBookForm() }} className="p-1 text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Titre (optionnel)</label>
                  <input
                    type="text"
                    value={bookTitle}
                    onChange={e => setBookTitle(e.target.value)}
                    placeholder="Ex: RDV Découverte, Follow-up..."
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Date *</label>
                    <input
                      type="date"
                      value={bookDate}
                      onChange={e => setBookDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Heure *</label>
                    <input
                      type="time"
                      value={bookTime}
                      onChange={e => setBookTime(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Durée</label>
                  <select
                    value={bookDuration}
                    onChange={e => setBookDuration(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-amber-500 focus:outline-none"
                  >
                    <option value={15}>15 min</option>
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>60 min</option>
                    <option value={90}>90 min</option>
                  </select>
                </div>

                {/* For whom — everyone can book for self, non-closers can book for others */}
                {canBookForOthers && teamMembers.length > 0 ? (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Pour qui ?</label>
                    <select
                      value={bookMemberId}
                      onChange={e => setBookMemberId(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-amber-500 focus:outline-none"
                    >
                      <option value="">Pour moi</option>
                      {teamMembers.map(m => (
                        <option key={m.id} value={m.id}>{m.first_name} {m.last_name} ({m.role})</option>
                      ))}
                    </select>
                  </div>
                ) : null}

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Notes (optionnel)</label>
                  <textarea
                    value={bookNotes}
                    onChange={e => setBookNotes(e.target.value)}
                    rows={2}
                    placeholder="Contexte, détails..."
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-amber-500 focus:outline-none resize-none"
                  />
                </div>

                {/* Google Meet toggle */}
                {isGoogleConnected && (
                  <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={bookWithMeet}
                      onChange={e => setBookWithMeet(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    <Video className="h-4 w-4 text-blue-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-800">Créer un Google Meet</p>
                      <p className="text-xs text-slate-400">Un lien de visio sera généré automatiquement</p>
                    </div>
                  </label>
                )}

                {!isGoogleConnected && (
                  <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                    <p className="text-xs text-slate-500">
                      Connectez votre Google Calendar depuis l'Agenda pour générer des liens Google Meet.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
                <button
                  onClick={() => { setShowBookModal(false); resetBookForm() }}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleBookAppointment}
                  disabled={bookSaving || !bookDate || !bookTime}
                  className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50 transition-colors"
                >
                  {bookSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
                  Confirmer
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Booking Links Section */}
      {showBookingSection && (
        <div className="rounded-xl border border-purple-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Link2 className="h-4 w-4 text-purple-600" />
              Liens de Booking
            </h3>
            <button
              onClick={() => setShowCreateLink(true)}
              className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Créer un lien
            </button>
          </div>

          {/* Create link form */}
          {showCreateLink && (
            <div className="rounded-lg border border-purple-100 bg-purple-50 p-4 mb-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nom du lien</label>
                <input
                  type="text"
                  value={newLinkLabel}
                  onChange={e => setNewLinkLabel(e.target.value)}
                  placeholder="Ex: RDV Découverte 30min"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Durée (minutes)</label>
                <select
                  value={newLinkDuration}
                  onChange={e => setNewLinkDuration(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
                >
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                  <option value={45}>45 min</option>
                  <option value={60}>60 min</option>
                  <option value={90}>90 min</option>
                </select>
              </div>
              {isOwnerOrHoS && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Pour qui ?</label>
                  <select
                    value={newLinkMemberId}
                    onChange={e => setNewLinkMemberId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
                  >
                    <option value="">Pour moi</option>
                    {teamMembers.map(m => (
                      <option key={m.id} value={m.id}>{m.first_name} {m.last_name} ({m.role})</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowCreateLink(false)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleCreateBookingLink}
                  disabled={savingLink || !newLinkLabel.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
                >
                  {savingLink ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Enregistrer
                </button>
              </div>
            </div>
          )}

          {/* Existing links */}
          {bookingLinks.length === 0 && !showCreateLink ? (
            <p className="text-sm text-slate-400 text-center py-4">
              Aucun lien de booking. Créez-en un pour faciliter la prise de rendez-vous.
            </p>
          ) : (
            <div className="space-y-2">
              {bookingLinks.map(bl => {
                const bookingUrl = bl.slug ? `${window.location.origin}/book/${bl.slug}` : bl.link
                const memberName = bl.team_member_id ? teamMembers.find(m => m.id === bl.team_member_id) : null
                return (
                <div key={bl.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">{bl.label}</p>
                    <p className="text-xs text-slate-400 truncate">
                      {bl.duration}min
                      {memberName && ` · ${memberName.first_name} ${memberName.last_name}`}
                      {!bl.team_member_id && isOwnerOrHoS && ' · Pour moi'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-3">
                    <button
                      onClick={() => handleCopyLink(bookingUrl)}
                      className="rounded-lg p-1.5 text-purple-600 hover:bg-purple-50 transition-colors"
                      title="Copier le lien"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <a
                      href={bookingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition-colors"
                      title="Ouvrir"
                    >
                      <Link2 className="h-4 w-4" />
                    </a>
                    <button
                      onClick={() => handleDeleteBookingLink(bl.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Supprimer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/50 py-16">
          <Calendar className="h-12 w-12 text-amber-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">Aucun rendez-vous</h3>
          <p className="text-sm text-slate-500 mb-4">
            {visibleAppointments.length === 0
              ? (isTeamMember ? 'Aucun rendez-vous ne vous est assigné' : 'Vos rendez-vous apparaîtront ici')
              : 'Aucun rendez-vous ne correspond à vos filtres'}
          </p>
          <button
            onClick={() => setShowBookModal(true)}
            className="flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-500 transition-all"
          >
            <Plus className="h-4 w-4" />
            Booker un RDV
          </button>
        </div>
      )}

      {/* Appointments list */}
      <div className="space-y-3">
        {filtered.map((appt) => {
          const statusConf = STATUS_CONFIG[appt.status] || STATUS_CONFIG.pending
          const memberName = getMemberName((appt as any).assigned_to)

          return (
            <div key={appt.id} className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                {/* Left: Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusConf.bg} ${statusConf.color}`}>
                      {appt.status === 'pending' && <Clock className="h-3 w-3" />}
                      {appt.status === 'confirmed' && <CheckCircle2 className="h-3 w-3" />}
                      {appt.status === 'cancelled' && <XCircle className="h-3 w-3" />}
                      {appt.status === 'done' && <CheckCircle2 className="h-3 w-3" />}
                      {statusConf.label}
                    </span>
                    <span className="text-sm font-semibold text-slate-900">
                      {formatDate(appt.date)} à {appt.time?.slice(0, 5)}
                    </span>
                    <span className="text-xs text-slate-400">{appt.duration}min</span>
                  </div>

                  {appt.title && (
                    <p className="text-sm font-medium text-slate-700 mb-1">{appt.title}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    {appt.prospect && (
                      <>
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />
                          {appt.prospect.contact}
                        </span>
                        <span className="flex items-center gap-1">
                          <Mail className="h-3.5 w-3.5" />
                          {appt.prospect.email}
                        </span>
                      </>
                    )}
                    {appt.campaign && (
                      <span className="flex items-center gap-1">
                        <Megaphone className="h-3.5 w-3.5" />
                        {appt.campaign.name}
                      </span>
                    )}
                    {memberName && (
                      <span className="flex items-center gap-1 text-amber-600 font-medium">
                        <Users className="h-3.5 w-3.5" />
                        {memberName}
                      </span>
                    )}
                    {appt.google_meet_link && (
                      <a
                        href={appt.google_meet_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-600 font-medium hover:text-blue-700"
                      >
                        <Video className="h-3.5 w-3.5" />
                        Google Meet
                      </a>
                    )}
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {isOwnerOrHoS && appt.status === 'pending' && (
                    <>
                      <button
                        onClick={() => updateStatus(appt.id, 'confirmed')}
                        className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                      >
                        Confirmer
                      </button>
                      <button
                        onClick={() => updateStatus(appt.id, 'cancelled')}
                        className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
                      >
                        Annuler
                      </button>
                    </>
                  )}
                  {isOwnerOrHoS && appt.status === 'confirmed' && (
                    <button
                      onClick={() => updateStatus(appt.id, 'done')}
                      className="rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
                    >
                      Marquer terminé
                    </button>
                  )}
                  {(appt.status === 'cancelled' || appt.status === 'done') && (
                    <span className="text-xs text-slate-400 italic">
                      {appt.status === 'done' ? 'Terminé' : 'Annulé'}
                    </span>
                  )}
                  {isTeamMember && !isOwnerOrHoS && appt.status === 'pending' && (
                    <span className="text-xs text-amber-500 italic">En attente</span>
                  )}
                  {isTeamMember && !isOwnerOrHoS && appt.status === 'confirmed' && (
                    <span className="text-xs text-blue-500 italic">Confirmé</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
