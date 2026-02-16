import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
   Calendar,
   Clock,
   ExternalLink,
   X,
   Video,
   Phone,
   Loader2,
   History,
   Trash2,
   ChevronDown,
   Mail,
   Save,
   Copy,
   Check,
   Plus,
   Settings,
   Link as LinkIcon,
   Edit2,
   MapPin,
   AlertCircle,
   RefreshCw,
   CalendarClock,
   XCircle
} from 'lucide-react'
import { useMeetings } from '../contexts/MeetingsContext'
import { usePrivacy } from '../contexts/PrivacyContext'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { format, isValid, parseISO, isAfter, startOfDay, compareAsc, compareDesc, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '../lib/utils'
import { isDailyCoLink } from '../services/dailyService'

// Types pour l'édition
interface EventTypeData {
   id: number
   title: string
   slug: string
   length: number
   description: string
   locations: Array<{ type: string; address?: string; link?: string; phone?: string }>
   beforeEventBuffer: number
   afterEventBuffer: number
   minimumBookingNotice: number
   slotInterval: number | null
}

export function RendezVous() {
   const { user } = useAuth()
   const navigate = useNavigate()
   const { meetings, loading: meetingsLoading, refreshMeetings } = useMeetings()
   const { maskData } = usePrivacy()

   // --- ÉTATS CAL.COM OAUTH ---
   const [calAccessToken, setCalAccessToken] = useState<string | null>(null)
   const [calUsername, setCalUsername] = useState('')

   // États Gestion Event Types
   const [eventTypes, setEventTypes] = useState<any[]>([])
   const [isLoadingEvents, setIsLoadingEvents] = useState(false)
   const [isDeletingEvent, setIsDeletingEvent] = useState<number | null>(null)

   // États Modales
   const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)
   const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
   const [isEditModalOpen, setIsEditModalOpen] = useState(false)

   // États pour Création (Mis à jour avec tous les champs)
   const [newEventTitle, setNewEventTitle] = useState('')
   const [newEventDuration, setNewEventDuration] = useState(30)
   const [newEventSlug, setNewEventSlug] = useState('')
   const [newEventDescription, setNewEventDescription] = useState('')
   const [newEventLocationType, setNewEventLocationType] = useState('integrations:daily')
   const [newEventLocationAddress, setNewEventLocationAddress] = useState('')
   const [newEventBeforeBuffer, setNewEventBeforeBuffer] = useState(0)
   const [newEventAfterBuffer, setNewEventAfterBuffer] = useState(0)
   const [newEventNotice, setNewEventNotice] = useState(0)
   const [newEventNoticeUnit, setNewEventNoticeUnit] = useState<'minutes' | 'hours'>('minutes')
   const [newEventSlotInterval, setNewEventSlotInterval] = useState<number | null>(null)
   const [isCreatingEvent, setIsCreatingEvent] = useState(false)

   // États pour Édition
   const [editingEvent, setEditingEvent] = useState<EventTypeData | null>(null)
   const [isUpdatingEvent, setIsUpdatingEvent] = useState(false)
   const [noticeUnit, setNoticeUnit] = useState<'minutes' | 'hours'>('minutes')

   // États Webhook & Sync
   const [webhookCopied, setWebhookCopied] = useState(false)
   const [linkCopiedId, setLinkCopiedId] = useState<number | null>(null)
   const [calBookings, setCalBookings] = useState<any[]>([])
   const [isSyncing, setIsSyncing] = useState(false)

   // États pour la gestion des meetings (Tableaux)
   const [selectedMeeting, setSelectedMeeting] = useState<any | null>(null)
   const [isDeleting, setIsDeleting] = useState(false)
   const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
   const [isCancellingBooking, setIsCancellingBooking] = useState(false)

   // URL de base
   const baseUrl = window.location.origin.includes('localhost')
      ? 'http://localhost:5173'
      : 'https://close-os.vercel.app'

   const webhookUrl = user?.id
      ? `${baseUrl}/api/cal-webhook?user_id=${user.id}`
      : 'Chargement...'

   // 1. Chargement initial (OAuth)
   // 1. Chargement initial (OAuth) + Auto-Refresh


   // --- FONCTION DE SYNCHRONISATION PUISSANTE (UPDATE + IMPORT) ---
   const runDeepSync = async (bookings: any[]) => {
      if (!bookings || bookings.length === 0) return 0;

      // Récupérer la vérité terrain (DB) pour éviter les doublons/race conditions
      let currentMeetings = meetings || [];
      if (user) {
         const { data: dbMeetings } = await supabase.from('meetings').select('*').eq('user_id', user.id);
         if (dbMeetings) currentMeetings = dbMeetings;
      }

      // Normalisation
      const normalize = (str: string) => str ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '') : '';
      let updatesCount = 0;
      let importCount = 0;

      console.log(`🔄 Démarrage Deep Sync sur ${bookings.length} éléments (avec ${currentMeetings.length} en base)...`);

      // 1. UPDATE status des existants
      if (currentMeetings.length > 0) {
         for (const m of currentMeetings) {
            if (['annule', 'cancelled', 'rejected', 'termine'].includes(normalize(m.status || ''))) continue;

            const dbDate = parseISO(m.date);
            const dbContact = normalize(m.contact || '');

            const calData = bookings.find((b: any) => {
               const apiDate = parseISO(b.startTime);
               const dayDiff = Math.abs(differenceInDays(dbDate, apiDate));
               if (dayDiff > 1) return false;

               const attendees = b.attendees || [];
               const title = normalize(b.title || '');

               return attendees.some((att: any) => {
                  const apiName = normalize(att.name || '');
                  return (dbContact && (apiName.includes(dbContact) || dbContact.includes(apiName)));
               }) || (dbContact && title.includes(dbContact));
            });

            if (calData) {
               // Extraire les données enrichies
               const enrichUpdates: any = {};
               const calEmail = calData.attendees?.[0]?.email;
               const calPhone = calData.attendees?.[0]?.phoneNumber || calData.attendees?.[0]?.phone || calData.responses?.phone?.value || calData.responses?.phone;
               const calNotes = calData.responses?.notes?.value || calData.responses?.notes || calData.responses?.rescheduleReason || calData.description;
               const calVideoLink = calData.metadata?.videoCallUrl || calData.references?.[0]?.meetingUrl || calData.meetingUrl;

               if (calEmail && !m.email) enrichUpdates.email = calEmail;
               if (calPhone && !m.phone) enrichUpdates.phone = String(calPhone);
               if (calNotes && !m.notes) enrichUpdates.notes = String(calNotes);
               if (calVideoLink && !m.video_link) enrichUpdates.video_link = calVideoLink;
               if (calData.uid && !m.cal_booking_uid) enrichUpdates.cal_booking_uid = calData.uid;

               // Sync status
               if (['CANCELLED', 'REJECTED'].includes(calData.status)) {
                  enrichUpdates.status = 'Annulé';
                  console.log(`❌ Annulation détectée pour ${m.contact}`);
               }

               if (Object.keys(enrichUpdates).length > 0) {
                  await supabase.from('meetings').update(enrichUpdates).eq('id', m.id);
                  updatesCount++;
               }
            }
         }
      }

      // 2. IMPORT des manquants
      if (user) {
         for (const b of bookings) {
            // Ignorer les annulés/rejetés pour l'import initial (sauf si on veut tout l'historique)
            if (['CANCELLED', 'REJECTED'].includes(b.status)) continue;

            const apiDate = parseISO(b.startTime);
            const apiDateStr = format(apiDate, 'yyyy-MM-dd');
            const apiTimeStr = format(apiDate, 'HH:mm');
            const endTimeStr = format(parseISO(b.endTime), 'HH:mm');
            const fullTimeStr = `${apiTimeStr} - ${endTimeStr}`;

            const contactName = b.attendees?.[0]?.name || b.title || 'Prospect Inconnu';
            const contactNorm = normalize(contactName);

            // Vérifier si existe déjà en DB
            const exists = currentMeetings.some((m: any) => {
               const dayDiff = Math.abs(differenceInDays(parseISO(m.date), apiDate));
               if (dayDiff > 0) return false; // Doit être le même jour

               const dbContact = normalize(m.contact || '');
               // Match strict sur le nom ou l'heure EXACTE si nom incertain
               return (dbContact && (contactNorm.includes(dbContact) || dbContact.includes(contactNorm))) || (m.time.startsWith(apiTimeStr));
            });

            if (!exists) {
               console.log(`📥 Import nouveau RDV: ${contactName} le ${apiDateStr}`);

               // Extraire toutes les infos enrichies
               const calEmail = b.attendees?.[0]?.email || null;
               const calPhone = b.attendees?.[0]?.phoneNumber || b.attendees?.[0]?.phone || b.responses?.phone?.value || b.responses?.phone || null;
               const calNotes = b.responses?.notes?.value || b.responses?.notes || b.responses?.rescheduleReason || null;
               const calVideoLink = b.metadata?.videoCallUrl || b.references?.[0]?.meetingUrl || b.meetingUrl || null;
               const calLocation = b.location || calVideoLink || 'Cal.com';

               const { error } = await supabase.from('meetings').insert([{
                  user_id: user.id,
                  contact: contactName,
                  title: b.title || `RDV avec ${contactName}`,
                  date: apiDateStr,
                  time: fullTimeStr,
                  type: 'video',
                  status: b.status === 'ACCEPTED' ? 'Confirmé' : 'upcoming',
                  location: calLocation,
                  description: b.description || 'Importé depuis Cal.com',
                  email: calEmail,
                  phone: calPhone ? String(calPhone) : null,
                  notes: calNotes ? String(calNotes) : null,
                  video_link: calVideoLink || null,
                  cal_booking_uid: b.uid || null
               }]);

               if (!error) importCount++;
               else console.error("Erreur import:", error);
            }
         }
      }

      if (updatesCount > 0 || importCount > 0) {
         if (refreshMeetings) await refreshMeetings();
         console.log(`✅ Sync terminée: ${updatesCount} updates, ${importCount} imports.`);
      }

      return updatesCount + importCount;
   };

   // 2. Connexion OAuth (v2)
   const handleConnectCal = () => {
      const clientId = '452e83a06c630a84cba92ab72cd43735c78ee8b5b691f488de432201b2d951ba'
      const redirectUri = `https://close-os.vercel.app/api/cal-callback`
      const state = user?.id

      window.location.href = `https://app.cal.com/auth/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`
   }

   // 3. Fetch Events (OAuth)
   const fetchEventTypes = async (accessToken: string) => {
      setIsLoadingEvents(true)
      try {
         // Attempt V2 API
         const response = await fetch(`/api/cal-proxy?url=${encodeURIComponent('/v2/event-types')}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
         })
         const data = await response.json()
         console.log("V2 Event Types Response FULL:", JSON.stringify(data, null, 2));

         // Handle V2 response structure
         let events: any[] = [];
         if (data.status === "success") {
            if (Array.isArray(data.data)) {
               events = data.data;
            } else if (data.data && typeof data.data === 'object') {
               // V2 Structure: data.data.eventTypeGroups[].eventTypes
               // @ts-ignore
               if (data.data.eventTypeGroups && Array.isArray(data.data.eventTypeGroups)) {
                  // @ts-ignore
                  events = data.data.eventTypeGroups.flatMap((group: any) => group.eventTypes || []);
               }
               // Fallback for other structures
               // @ts-ignore
               else if (data.data.event_types) events = data.data.event_types;
               // @ts-ignore
               else if (data.data.items) events = data.data.items;
               // @ts-ignore
               else if (data.data.rows) events = data.data.rows;
            }
         } else if (data.event_types) {
            // Fallback V1
            events = data.event_types;
         }

         setEventTypes(events)
      } catch (error) { console.error("Erreur fetch Cal.com:", error) } finally { setIsLoadingEvents(false) }
   }

   // 3b. Fetch Profile (OAuth)
   const fetchCalProfile = async (accessToken: string) => {
      try {
         // Try V2 API first
         const responseV2 = await fetch(`/api/cal-proxy?url=${encodeURIComponent('/v2/me')}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
         })

         if (responseV2.ok) {
            const data = await responseV2.json()
            const username = data.data?.username || data.data?.email
            if (username) {
               setCalUsername(username)
               return
            }
         }

         // Fallback to V1 API
         const response = await fetch(`/api/cal-proxy?url=${encodeURIComponent('/v1/me')}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
         })
         const data = await response.json()
         if (data.user?.username) setCalUsername(data.user.username)
         else if (data.username) setCalUsername(data.username)
      } catch (error) { console.error("Erreur fetch profile Cal.com:", error) }
   }

   // 3c. Fetch Bookings & Trigger Sync (OAuth)
   const fetchCalBookings = async (accessToken: string, manualTrigger: boolean = false) => {
      if (!accessToken) return;
      if (manualTrigger) setIsSyncing(true);

      try {
         // On récupère tout (pas de filtre status ici pour bien tout analyser)
         const response = await fetch(`/api/cal-proxy?url=${encodeURIComponent('/v2/bookings?limit=100')}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
         })
         const data = await response.json()
         console.log("V2 Bookings Response:", data);

         let bookings: any[] = [];

         if (data.status === "success" || data.data) {
            if (Array.isArray(data.data)) {
               bookings = data.data;
            } else if (data.data?.bookings) {
               bookings = data.data.bookings;
            } else if (data.data?.rows) {
               bookings = data.data.rows;
            }
         } else if (data.bookings) {
            bookings = data.bookings;
         }

         if (bookings && bookings.length > 0) {
            setCalBookings(bookings);
            const count = await runDeepSync(bookings);
            if (manualTrigger) {
               alert(`Synchronisation terminée : ${count} changements.`);
            }
         } else {
            console.log("Aucun booking trouvé dans la réponse API");
         }
      } catch (error) {
         console.error("Erreur fetch Bookings Cal.com:", error);
         if (manualTrigger) alert("Erreur lors de la synchronisation.");
      } finally {
         if (manualTrigger) setIsSyncing(false);
      }
   }

   // 4. Suppression Event Type (OAuth) - V2
   const handleDeleteEventType = async (id: number) => {
      if (!window.confirm("Voulez-vous supprimer ce lien définitivement (CloseOS + Cal.com) ?")) return
      setIsDeletingEvent(id)
      try {
         const response = await fetch(`/api/cal-proxy?url=${encodeURIComponent(`/v2/event-types/${id}`)}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${calAccessToken}` }
         })
         if (!response.ok) throw new Error("Erreur suppression")
         if (calAccessToken) await fetchEventTypes(calAccessToken)
      } catch (error) { alert("Erreur suppression Cal.com"); console.error(error) } finally { setIsDeletingEvent(null) }
   }

   // 5. Créer Event (Mis à jour avec tous les champs)
   const handleCreateEventType = async () => {
      if (!newEventTitle || !newEventSlug) return
      setIsCreatingEvent(true)
      try {
         const noticeInMinutes = newEventNoticeUnit === 'hours' ? newEventNotice * 60 : newEventNotice

         const payload = {
            title: newEventTitle,
            slug: newEventSlug,
            length: parseInt(String(newEventDuration)),
            description: newEventDescription,
            locations: [{
               type: newEventLocationType,
               address: newEventLocationType === 'in_person' ? newEventLocationAddress : undefined,
               link: newEventLocationType === 'link' ? newEventLocationAddress : undefined,
               phone: newEventLocationType === 'phone' ? newEventLocationAddress : undefined,
            }],
            beforeEventBuffer: Number(newEventBeforeBuffer),
            afterEventBuffer: Number(newEventAfterBuffer),
            minimumBookingNotice: Number(noticeInMinutes),
            slotInterval: newEventSlotInterval ? Number(newEventSlotInterval) : null,
            isHidden: false
         }

         const response = await fetch(`/api/cal-proxy?url=${encodeURIComponent('/v2/event-types')}`, {
            method: 'POST',
            headers: {
               'Content-Type': 'application/json',
               'Authorization': `Bearer ${calAccessToken}`
            },
            body: JSON.stringify(payload)
         })
         if (!response.ok) throw new Error('Erreur création')
         if (calAccessToken) await fetchEventTypes(calAccessToken)
         setIsCreateModalOpen(false)
         // Reset complet du formulaire
         setNewEventTitle('')
         setNewEventSlug('')
         setNewEventDuration(30)
         setNewEventDescription('')
         setNewEventLocationAddress('')
         setNewEventBeforeBuffer(0)
         setNewEventAfterBuffer(0)
         setNewEventNotice(0)
      } catch (error) { alert("Erreur lors de la création") } finally { setIsCreatingEvent(false) }
   }

   // 6. Ouvrir Modale Édition
   const handleOpenEdit = (evt: any) => {
      const notice = evt.minimumBookingNotice || 0
      let unit: 'minutes' | 'hours' = 'minutes'
      let value = notice
      if (notice >= 60 && notice % 60 === 0) {
         unit = 'hours'
         value = notice / 60
      }

      setEditingEvent({
         id: evt.id,
         title: evt.title,
         slug: evt.slug,
         length: evt.length,
         description: evt.description || '',
         locations: evt.locations || [{ type: 'integrations:daily' }],
         beforeEventBuffer: evt.beforeEventBuffer || 0,
         afterEventBuffer: evt.afterEventBuffer || 0,
         minimumBookingNotice: value,
         slotInterval: evt.slotInterval || null
      })
      setNoticeUnit(unit)
      setIsEditModalOpen(true)
   }

   // 7. Sauvegarder Édition
   const handleUpdateEvent = async () => {
      if (!editingEvent) return
      setIsUpdatingEvent(true)
      try {
         const noticeInMinutes = noticeUnit === 'hours'
            ? editingEvent.minimumBookingNotice * 60
            : editingEvent.minimumBookingNotice

         const payload = {
            title: editingEvent.title,
            slug: editingEvent.slug,
            length: Number(editingEvent.length),
            description: editingEvent.description,
            locations: editingEvent.locations,
            beforeEventBuffer: Number(editingEvent.beforeEventBuffer),
            afterEventBuffer: Number(editingEvent.afterEventBuffer),
            minimumBookingNotice: Number(noticeInMinutes),
            slotInterval: editingEvent.slotInterval ? Number(editingEvent.slotInterval) : null
         }

         const response = await fetch(`/api/cal-proxy?url=${encodeURIComponent(`/v2/event-types/${editingEvent.id}`)}`, {
            method: 'PATCH',
            headers: {
               'Content-Type': 'application/json',
               'Authorization': `Bearer ${calAccessToken}`
            },
            body: JSON.stringify(payload)
         })

         if (!response.ok) throw new Error('Erreur mise à jour')
         if (calAccessToken) await fetchEventTypes(calAccessToken)
         setIsEditModalOpen(false)
      } catch (error) { alert("Erreur maj"); console.error(error) } finally { setIsUpdatingEvent(false) }
   }

   const handleCopyLink = (slug: string, id: number) => {
      const url = `https://cal.com/${calUsername}/${slug}`
      navigator.clipboard.writeText(url)
      setLinkCopiedId(id)
      setTimeout(() => setLinkCopiedId(null), 2000)
   }

   const handleCopyWebhook = () => {
      navigator.clipboard.writeText(webhookUrl)
      setWebhookCopied(true)
      setTimeout(() => setWebhookCopied(false), 2000)
   }

   // --- LOGIQUE TABLEAUX (Affichage) ---
   const { upcomingMeetings, pastMeetings } = useMemo(() => {
      const now = new Date();
      const today = startOfDay(now);

      // Normalisation agressive pour l'affichage temps réel
      const normalize = (str: string) => str ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '') : '';

      const allMeetings = (meetings || []).map(m => {
         // Overlay Statut API (si trouvé en RAM avant le refresh DB)
         const calData = calBookings.find((b: any) => {
            const dbDate = parseISO(m.date);
            const apiDate = parseISO(b.startTime);
            if (Math.abs(differenceInDays(dbDate, apiDate)) > 1) return false;

            const dbContact = normalize(m.contact || '');
            const attendees = b.attendees || [];
            const title = normalize(b.title || '');

            return attendees.some((att: any) => {
               const apiName = normalize(att.name || '');
               return (dbContact && (apiName.includes(dbContact) || dbContact.includes(apiName)));
            }) || (dbContact && title.includes(dbContact));
         });

         if (calData && ['CANCELLED', 'REJECTED'].includes(calData.status)) {
            return { ...m, status: 'Annulé', apiLocation: calData.location };
         }
         return { ...m, apiLocation: calData ? calData.location : null };
      });

      const upcoming = [];
      const past = [];

      for (const m of allMeetings) {
         const meetingDate = parseISO(m.date);
         if (isAfter(meetingDate, today) || m.date === format(now, 'yyyy-MM-dd')) {
            upcoming.push(m);
         } else {
            past.push(m);
         }
      }

      upcoming.sort((a, b) => compareAsc(parseISO(a.date + 'T' + a.time.split(' - ')[0]), parseISO(b.date + 'T' + b.time.split(' - ')[0])))
      past.sort((a, b) => compareDesc(parseISO(a.date + 'T' + a.time.split(' - ')[0]), parseISO(b.date + 'T' + b.time.split(' - ')[0])))

      return { upcomingMeetings: upcoming, pastMeetings: past };
   }, [meetings, calBookings]);

   const handleUpdateStatus = async (newStatus: string) => {
      if (!selectedMeeting) return; setIsUpdatingStatus(true);
      try { await supabase.from('meetings').update({ status: newStatus }).eq('id', selectedMeeting.id); setSelectedMeeting({ ...selectedMeeting, status: newStatus }); if (refreshMeetings) refreshMeetings(); } catch (err) { alert("Erreur maj statut"); } finally { setIsUpdatingStatus(false); }
   };

   const handleCancelBooking = async () => {
      if (!selectedMeeting) return;
      if (!window.confirm('Êtes-vous sûr de vouloir annuler ce rendez-vous ?')) return;
      setIsCancellingBooking(true);
      try {
         // 1. Annuler sur Cal.com si on a le booking UID
         if (selectedMeeting.cal_booking_uid && calAccessToken) {
            const cancelUrl = `/api/cal-proxy?url=${encodeURIComponent(`/v2/bookings/${selectedMeeting.cal_booking_uid}/cancel`)}`;
            const res = await fetch(cancelUrl, {
               method: 'POST',
               headers: { 'Authorization': `Bearer ${calAccessToken}`, 'Content-Type': 'application/json' },
               body: JSON.stringify({ cancellationReason: 'Annulé depuis CloseOS' })
            });
            if (!res.ok) {
               console.warn('Cal.com cancel response:', res.status, await res.text());
            }
         }
         // 2. Mettre à jour en DB
         await supabase.from('meetings').update({ status: 'Annulé' }).eq('id', selectedMeeting.id);
         setSelectedMeeting({ ...selectedMeeting, status: 'Annulé' });
         if (refreshMeetings) refreshMeetings();
      } catch (err) {
         console.error('Erreur annulation:', err);
         alert('Erreur lors de l\'annulation.');
      } finally {
         setIsCancellingBooking(false);
      }
   };

   const handleRescheduleBooking = () => {
      if (!selectedMeeting?.cal_booking_uid) {
         alert('Pas de lien de replanification disponible pour ce rendez-vous.');
         return;
      }
      const rescheduleUrl = `https://app.cal.com/reschedule/${selectedMeeting.cal_booking_uid}`;
      window.open(rescheduleUrl, '_blank', 'noopener,noreferrer');
   };

   const handleDeleteAllPast = async () => {
      if (!window.confirm("Tout supprimer ?")) return; setIsDeleting(true);
      try { await supabase.from('meetings').delete().eq('user_id', user?.id).lt('date', format(new Date(), 'yyyy-MM-dd')); if (refreshMeetings) refreshMeetings(); } catch (err) { console.error(err); } finally { setIsDeleting(false); }
   };

   const safeFormat = (dateStr: string, formatStr: string) => { try { const date = parseISO(dateStr); return isValid(date) ? format(date, formatStr, { locale: fr }) : 'N/A'; } catch { return 'N/A' } }

   const getStatusStyle = (s: string) => {
      s = s?.toLowerCase() || '';
      if (['upcoming', 'confirmé', 'confirmed', 'scheduled', 'accepted'].includes(s)) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      if (['annulé', 'cancelled', 'rejected', 'canceled', 'annule'].includes(s)) return 'bg-red-500/20 text-red-400 border-red-500/30';
      return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
   }

   const getStatusLabel = (s: string) => {
      s = s?.toLowerCase() || '';
      if (['upcoming', 'confirmé', 'confirmed', 'scheduled', 'accepted'].includes(s)) return 'Confirmé';
      if (['annulé', 'cancelled', 'canceled', 'annule'].includes(s)) return 'Annulé';
      if (['rejected'].includes(s)) return 'Refusé';
      return s.charAt(0).toUpperCase() + s.slice(1);
   }

   const getMeetingLocation = (m: any) => {
      // 1. Priorité aux données API Cal.com
      if (m.apiLocation) {
         const loc = m.apiLocation.toLowerCase();
         if (loc.includes('integrations:daily')) return 'Cal Video';
         if (loc.includes('google:meet')) return 'Google Meet';
         if (loc.includes('zoom:video')) return 'Zoom';
         if (loc.includes('discord')) return 'Discord';
         if (loc.includes('phone')) return 'Téléphone';
         if (loc.includes('in_person')) return 'En personne';
         if (loc.includes('http')) return 'Lien';
         return m.apiLocation;
      }
      // 2. Fallback DB
      if (m.location) {
         const loc = m.location.toLowerCase();
         if (loc.includes('daily.co')) return 'Cal Video';
         if (loc.includes('meet.google')) return 'Google Meet';
         if (loc.includes('zoom.us')) return 'Zoom';
         if (loc.includes('discord')) return 'Discord';
         if (loc.includes('http')) return 'Lien';
         return m.location;
      }
      // 3. Fallback Description
      if (m.description?.match(/Lieu:\s*([^\n\r]+)/)) return m.description.match(/Lieu:\s*([^\n\r]+)/)[1].trim();

      return 'À vérifier';
   }

   // --- RENDU ---
   const MeetingTable = ({ data, title, icon: Icon, emptyText, showDeleteAction, onRefresh }: any) => (
      <div className="mb-12">
         <div className="mb-4 flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
               <Icon className="h-5 w-5 text-blue-500" />
               <h2 className="text-xl font-bold text-white">{title}</h2>
               <span className="ml-2 rounded-full bg-slate-800 px-2 py-0.5 text-xs font-bold text-slate-400">{data.length}</span>
               {/* BOUTON SYNC MANUEL */}
               {onRefresh && (
                  <button
                     onClick={onRefresh}
                     className={`ml-2 p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors ${isSyncing ? 'animate-spin text-blue-500' : ''}`}
                     title="Forcer la synchronisation (MàJ Statuts)"
                  >
                     <RefreshCw className="h-4 w-4" />
                  </button>
               )}
            </div>
            {showDeleteAction && data.length > 0 && (<button onClick={handleDeleteAllPast} disabled={isDeleting} className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all disabled:opacity-50">{isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Tout supprimer</button>)}
         </div>
         <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden shadow-xl">
            <table className="w-full">
               <thead className="bg-slate-800/50"><tr className="border-b border-slate-800 text-xs font-bold uppercase tracking-widest text-slate-500 text-left"><th className="px-6 py-4">Date & Heure</th><th className="px-6 py-4">Prospect</th><th className="px-6 py-4">Lieu</th><th className="px-6 py-4">Statut</th><th className="px-6 py-4 text-right">Détails</th></tr></thead>
               <tbody className="divide-y divide-slate-800">
                  {data.length === 0 ? (<tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-medium italic">{emptyText}</td></tr>) : (
                     data.map((m: any) => (
                        <tr key={m.id} onClick={() => setSelectedMeeting(m)} className="cursor-pointer hover:bg-slate-800/40 transition-colors">
                           <td className="px-6 py-4"><div className="flex items-center gap-3 text-white"><div className="flex h-10 w-10 flex-col items-center justify-center rounded-lg bg-slate-800 border border-slate-700 font-bold"><span className="text-[10px] text-blue-500 uppercase">{safeFormat(m.date, 'MMM')}</span><span className="text-sm">{safeFormat(m.date, 'dd')}</span></div><div><div className="font-bold">{safeFormat(m.date, 'eeee d MMMM')}</div><div className="text-xs text-slate-500">{m.time}</div></div></div></td>
                           <td className="px-6 py-4 font-bold text-slate-200">{maskData(m.contact || 'Prospect', 'name')}</td>
                           <td className="px-6 py-4 text-sm text-blue-400 font-medium">{getMeetingLocation(m)}</td>
                           <td className="px-6 py-4"><span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${getStatusStyle(m.status)}`}>{getStatusLabel(m.status)}</span></td>
                           <td className="px-6 py-4 text-right"><ExternalLink className="h-4 w-4 text-slate-600 ml-auto" /></td>
                        </tr>
                     ))
                  )}
               </tbody>
            </table>
         </div>
      </div>
   )

   // 1. Chargement initial (OAuth) + Auto-Refresh
   useEffect(() => {
      const fetchProfile = async () => {
         if (!user) return

         try {
            const { data } = await supabase.from('profiles').select('cal_access_token, cal_token_expires_at, cal_username').eq('id', user.id).single()

            if (data?.cal_access_token) {
               let token = data.cal_access_token;

               // Check Expiration (with 5 min buffer)
               if (data.cal_token_expires_at && Date.now() > (new Date(data.cal_token_expires_at).getTime() - 300000)) {
                  console.log("Token expired or expiring soon. Refreshing...");
                  try {
                     const refreshRes = await fetch('/api/refresh-cal-token', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ user_id: user.id })
                     });
                     const refreshData = await refreshRes.json();
                     if (refreshData.access_token) {
                        token = refreshData.access_token;
                        console.log("Token refreshed successfully.");
                     }
                  } catch (e) {
                     console.error("Failed to refresh token", e);
                  }
               }

               setCalAccessToken(token)
               if (data.cal_username) setCalUsername(data.cal_username)

               await fetchEventTypes(token)
               await fetchCalProfile(token)
               await fetchCalBookings(token, false)
            }
         } catch (err) {
            console.error("Error fetching profile:", err);
         }
      }
      fetchProfile()

      // Check URL params for OAuth success/error
      const params = new URLSearchParams(window.location.search)
      if (params.get('cal_connected') === 'true') {
         setIsConfigModalOpen(true)
         window.history.replaceState({}, '', window.location.pathname) // Clean URL
      } else if (params.get('cal_error')) {
         alert("Erreur connexion Cal.com: " + params.get('cal_error'))
      }
   }, [user])


   if (meetingsLoading) return <div className="flex h-screen items-center justify-center bg-slate-950"><div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div></div>

   return (
      <div className="h-full overflow-y-auto bg-slate-950 p-8 text-left">
         <div className="mx-auto max-w-6xl">
            <div className="mb-8 flex items-end justify-between">
               <div>
                  <h1 className="text-3xl font-bold text-white mb-2">Rendez-vous</h1>
                  <p className="text-slate-400">Consultez vos rendez-vous et gérez votre agenda.</p>
               </div>
               {/* BOUTON D'OUVERTURE DE LA CONFIGURATION */}
               <button
                  onClick={() => setIsConfigModalOpen(true)}
                  className="flex items-center gap-2 rounded-xl bg-slate-800 border border-slate-700 px-5 py-3 text-sm font-bold text-white hover:bg-slate-700 transition-all shadow-lg hover:shadow-slate-700/20"
               >
                  <Settings className="h-4 w-4" /> Configurer les Booking
               </button>
            </div>

            {/* --- SECTION 2: TYPES D'EVENEMENTS --- */}
            {calAccessToken && (
               <div className="mb-12">
                  <div className="flex items-center justify-between mb-6">
                     <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400 font-bold text-xl"><LinkIcon className="h-6 w-6" /></div>
                        <div><h2 className="text-xl font-bold text-white">Vos Liens de Réservation</h2><p className="text-sm text-slate-400 mt-1">Vos types d'événements actifs sur Cal.com.</p></div>
                     </div>
                     <button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20"><Plus className="h-4 w-4" /> Nouveau</button>
                  </div>

                  {isLoadingEvents ? (<div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-slate-500" /></div>) : (
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {eventTypes.map(evt => (
                           <div key={evt.id} className="group relative rounded-xl border border-slate-800 bg-slate-900 p-5 hover:border-slate-700 transition-all flex flex-col justify-between hover:shadow-lg hover:shadow-black/20">
                              <div>
                                 <div className="flex justify-between items-start mb-3">
                                    <span className="inline-block rounded bg-slate-800 px-2 py-1 text-xs font-bold text-slate-400">{evt.length} min</span>
                                    <div className="flex gap-2">
                                       {/* BOUTON SUPPRIMER LE LIEN (POUBELLE) */}
                                       <button
                                          onClick={() => handleDeleteEventType(evt.id)}
                                          disabled={isDeletingEvent === evt.id}
                                          className="p-1 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-500 transition-colors"
                                          title="Supprimer ce lien"
                                       >
                                          {isDeletingEvent === evt.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                       </button>
                                       {/* BOUTON OUVRIR */}
                                       <a href={`https://cal.com/${calUsername || 'user'}/${evt.slug}`} target="_blank" rel="noreferrer" className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-white" title="Ouvrir le lien"><ExternalLink className="h-4 w-4" /></a>
                                    </div>
                                 </div>
                                 <h3 className="font-bold text-white text-lg mb-1">{evt.title}</h3>
                                 <p className="text-xs text-slate-500 font-mono mb-4">/{evt.slug}</p>
                              </div>

                              <div className="flex gap-2 mt-auto border-t border-slate-800 pt-3">
                                 <button
                                    onClick={() => handleCopyLink(evt.slug, evt.id)}
                                    className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-slate-800 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                                 >
                                    {linkCopiedId === evt.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />} Copier
                                 </button>
                                 <button
                                    onClick={() => handleOpenEdit(evt)}
                                    className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600/10 py-2 text-xs font-bold text-blue-400 hover:bg-blue-600/20 transition-colors"
                                 >
                                    <Edit2 className="h-3 w-3" /> Modifier
                                 </button>
                                 <a
                                    href={`https://app.cal.com/event-types/${evt.id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center justify-center rounded-lg bg-slate-800 px-3 text-slate-400 hover:text-white hover:bg-slate-700"
                                    title="Paramètres avancés sur Cal.com"
                                 >
                                    <Settings className="h-4 w-4" />
                                 </a>
                              </div>
                           </div>
                        ))}
                        {eventTypes.length === 0 && (<div className="col-span-full text-center py-12 text-slate-500 italic border border-dashed border-slate-800 rounded-xl bg-slate-900/50">Aucun événement trouvé. Créez-en un !</div>)}
                     </div>
                  )}
               </div>
            )}

            {/* --- CONTENU PRINCIPAL : LES TABLEAUX --- */}
            <MeetingTable
               data={upcomingMeetings}
               title="Rendez-vous à venir"
               icon={Calendar}
               emptyText="Aucun rendez-vous synchronisé."
               onRefresh={calAccessToken ? () => fetchCalBookings(calAccessToken, true) : undefined}
            />
            <MeetingTable data={pastMeetings} title="Historique" icon={History} emptyText="Aucun historique disponible." showDeleteAction={true} />
         </div>

         {/* --- GRANDE MODALE DE CONFIGURATION --- */}
         {isConfigModalOpen && (
            <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
               <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsConfigModalOpen(false)} />
               <div className="relative w-full max-w-2xl max-h-[90vh] rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col animate-in fade-in zoom-in-95 overflow-hidden">

                  {/* Header Modale */}
                  <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900 z-10 shrink-0">
                     <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-3">
                           <div className="h-8 w-8 flex items-center justify-center overflow-hidden rounded-full">
                              <img src="/Calcom.png" alt="Cal.com" className="w-full h-full object-contain" />
                           </div>
                           Configuration Cal.com
                        </h2>
                        <p className="text-slate-400 text-sm mt-1">Paramètres de connexion et synchronisation.</p>
                     </div>
                     <button onClick={() => setIsConfigModalOpen(false)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                        <X className="h-6 w-6" />
                     </button>
                  </div>

                  {/* Corps Modale */}
                  <div className="p-8 space-y-8 bg-slate-950/50 overflow-y-auto custom-scrollbar">
                     <section>
                        <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">1. Connexion Cal.com</h3>

                        {!calAccessToken ? (
                           <div className="rounded-lg bg-slate-900 border border-slate-800 p-6 mb-6 text-center">
                              <p className="text-sm text-slate-300 mb-6 leading-relaxed">
                                 Connectez votre compte Cal.com pour synchroniser automatiquement vos rendez-vous et gérer vos liens de réservation.
                              </p>
                              <button
                                 onClick={handleConnectCal}
                                 className="w-full flex justify-center items-center gap-2 rounded-xl bg-black py-4 text-sm font-bold text-white hover:bg-neutral-900 transition-all shadow-lg border border-slate-800"
                              >
                                 <div className="h-5 w-5 rounded-full bg-white flex items-center justify-center p-0.5">
                                    <img src="/Calcom.png" alt="" className="w-full h-full object-contain" />
                                 </div>
                                 Se connecter avec Cal.com
                              </button>
                           </div>
                        ) : (
                           <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-6 mb-6 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                 <div className="h-10 w-10 flex items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
                                    <Check className="h-5 w-5" />
                                 </div>
                                 <div>
                                    <h4 className="font-bold text-emerald-400">Compte Connecté</h4>
                                    <p className="text-xs text-emerald-500/70">@{calUsername || 'Utilisateur'}</p>
                                 </div>
                              </div>
                              <button onClick={() => { if (window.confirm('Déconnecter ?')) setCalAccessToken(null) }} className="text-xs font-bold text-slate-500 hover:text-white underline">Déconnecter</button>
                           </div>
                        )}
                     </section>

                     {/* Tutorial removed */}

                     <hr className="border-slate-800" />

                     {/* 2. Webhook */}
                     {calAccessToken && (
                        <section>
                           <h3 className="text-sm font-bold text-white mb-2 uppercase tracking-wider">2. Synchronisation (Webhook)</h3>
                           <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg p-2 pl-4">
                              <code className="text-xs font-mono text-purple-300 truncate flex-1 select-all">{webhookUrl}</code>
                              <button onClick={handleCopyWebhook} className="p-2 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors" title="Copier l'URL">{webhookCopied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}</button>
                           </div>
                           <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                              Copiez cette URL et ajoutez-la dans la section <b>Webhooks</b> de vos paramètres Cal.com pour recevoir les notifications de réservation.
                           </p>
                        </section>
                     )}
                  </div>
               </div>
            </div>
         )}

         {/* --- MODALE CRÉATION (ÉTENDUE AVEC TOUS LES PARAMÈTRES) --- */}
         {isCreateModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
               <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsCreateModalOpen(false)} />
               <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 border border-slate-800 p-8 shadow-2xl animate-in fade-in zoom-in-95 custom-scrollbar">
                  <div className="flex items-center justify-between mb-8 border-b border-slate-800 pb-4">
                     <div>
                        <h3 className="text-2xl font-bold text-white">Nouveau Type d'Événement</h3>
                        <p className="text-slate-400 text-sm">Configurez les détails et les limites de votre nouveau lien.</p>
                     </div>
                     <button onClick={() => setIsCreateModalOpen(false)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"><X className="h-6 w-6" /></button>
                  </div>

                  <div className="space-y-8">
                     {/* 1. INFO GÉNÉRALES */}
                     <section className="space-y-4">
                        <h4 className="text-sm font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2"><Plus className="h-4 w-4" /> Informations Générales</h4>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="col-span-2 md:col-span-1">
                              <label className="block text-xs font-bold text-slate-500 mb-1">Titre</label>
                              <input type="text" value={newEventTitle} onChange={(e) => { setNewEventTitle(e.target.value); setNewEventSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')) }} className="w-full rounded-lg bg-slate-950 border border-slate-700 py-2.5 px-4 text-white focus:border-blue-500 outline-none transition-all" placeholder="Ex: Appel Découverte" />
                           </div>
                           <div className="col-span-2 md:col-span-1">
                              <label className="block text-xs font-bold text-slate-500 mb-1">Durée (min)</label>
                              <input type="number" value={newEventDuration} onChange={(e) => setNewEventDuration(parseInt(e.target.value))} className="w-full rounded-lg bg-slate-950 border border-slate-700 py-2.5 px-4 text-white focus:border-blue-500 outline-none transition-all" />
                           </div>
                           <div className="col-span-2">
                              <label className="block text-xs font-bold text-slate-500 mb-1">URL / Slug</label>
                              <div className="flex items-center">
                                 <span className="bg-slate-800 text-slate-500 px-4 py-2.5 rounded-l-lg border border-r-0 border-slate-700 text-sm">cal.com/{calUsername || 'user'}/</span>
                                 <input type="text" value={newEventSlug} onChange={(e) => setNewEventSlug(e.target.value)} className="w-full rounded-r-lg border border-slate-700 bg-slate-950 py-2.5 px-4 text-white focus:border-blue-500 outline-none transition-all" />
                              </div>
                           </div>
                           <div className="col-span-2">
                              <label className="block text-xs font-bold text-slate-500 mb-1">Description</label>
                              <textarea rows={3} value={newEventDescription} onChange={(e) => setNewEventDescription(e.target.value)} className="w-full rounded-lg bg-slate-950 border border-slate-700 py-2.5 px-4 text-white focus:border-blue-500 outline-none resize-none transition-all" placeholder="Détails du rendez-vous..." />
                           </div>

                           <div className="col-span-2">
                              <label className="block text-xs font-bold text-slate-500 mb-1">Lieu / Location</label>
                              <div className="space-y-3">
                                 <div className="p-3 rounded-lg border border-slate-700 bg-slate-950 text-slate-400 text-xs flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-blue-500" />
                                    <select
                                       className="bg-transparent outline-none w-full text-white cursor-pointer"
                                       onChange={(e) => setNewEventLocationType(e.target.value)}
                                       value={newEventLocationType}
                                    >
                                       <optgroup label="Visio">
                                          <option value="integrations:daily">Cal Video (Par défaut)</option>
                                          <option value="integrations:google:meet">Google Meet</option>
                                          <option value="integrations:zoom:video">Zoom Video</option>
                                       </optgroup>
                                       <optgroup label="Téléphone">
                                          <option value="attendee_phone">Numéro de téléphone du participant</option>
                                          <option value="phone">Appel téléphonique (Organisateur appelle)</option>
                                       </optgroup>
                                       <optgroup label="Physique">
                                          <option value="attendee_in_person">En personne (adresse du participant)</option>
                                          <option value="in_person">En personne (adresse de l'organisateur)</option>
                                       </optgroup>
                                       <optgroup label="Autre">
                                          <option value="link">Lien personnalisé / Autre</option>
                                       </optgroup>
                                    </select>
                                 </div>

                                 {['in_person', 'link', 'phone'].includes(newEventLocationType) && (
                                    <div className="animate-in fade-in slide-in-from-top-2">
                                       <label className="block text-[10px] font-bold text-blue-400 uppercase mb-1">
                                          {newEventLocationType === 'phone' ? 'Numéro à appeler' : newEventLocationType === 'link' ? 'URL du lien' : 'Adresse exacte'}
                                       </label>
                                       <input
                                          type="text"
                                          placeholder="..."
                                          value={newEventLocationAddress}
                                          onChange={(e) => setNewEventLocationAddress(e.target.value)}
                                          className="w-full rounded-lg bg-slate-950 border border-blue-500/50 py-2 px-4 text-white text-sm focus:border-blue-500 outline-none"
                                       />
                                    </div>
                                 )}
                              </div>
                           </div>
                        </div>
                     </section>

                     <hr className="border-slate-800" />

                     {/* 2. DISPONIBILITÉS */}
                     <section className="space-y-4">
                        <h4 className="text-sm font-bold text-purple-400 uppercase tracking-wider flex items-center gap-2"><Clock className="h-4 w-4" /> Disponibilités & Limites</h4>
                        <div className="grid grid-cols-2 gap-6">
                           <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">Marge avant (min)</label>
                              <select
                                 value={newEventBeforeBuffer}
                                 onChange={(e) => setNewEventBeforeBuffer(parseInt(e.target.value))}
                                 className="w-full rounded-lg bg-slate-950 border border-slate-700 py-2.5 px-4 text-white outline-none cursor-pointer hover:border-slate-600 transition-all"
                              >
                                 <option value={0}>Aucune</option><option value={5}>5 min</option><option value={10}>10 min</option><option value={15}>15 min</option><option value={30}>30 min</option><option value={60}>1h</option>
                              </select>
                           </div>
                           <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">Marge après (min)</label>
                              <select
                                 value={newEventAfterBuffer}
                                 onChange={(e) => setNewEventAfterBuffer(parseInt(e.target.value))}
                                 className="w-full rounded-lg bg-slate-950 border border-slate-700 py-2.5 px-4 text-white outline-none cursor-pointer hover:border-slate-600 transition-all"
                              >
                                 <option value={0}>Aucune</option><option value={5}>5 min</option><option value={10}>10 min</option><option value={15}>15 min</option><option value={30}>30 min</option><option value={60}>1h</option>
                              </select>
                           </div>

                           <div className="col-span-2 md:col-span-1">
                              <label className="block text-xs font-bold text-slate-500 mb-1">Préavis minimum</label>
                              <div className="flex">
                                 <input
                                    type="number"
                                    value={newEventNotice}
                                    onChange={(e) => setNewEventNotice(parseInt(e.target.value))}
                                    className="w-20 rounded-l-lg bg-slate-950 border border-r-0 border-slate-700 py-2.5 px-4 text-white outline-none focus:border-blue-500 transition-all"
                                 />
                                 <select
                                    value={newEventNoticeUnit}
                                    onChange={(e) => setNewEventNoticeUnit(e.target.value as 'minutes' | 'hours')}
                                    className="flex-1 rounded-r-lg bg-slate-950 border border-slate-700 py-2.5 px-2 text-white outline-none cursor-pointer hover:border-slate-600 transition-all"
                                 >
                                    <option value="minutes">Minutes</option>
                                    <option value="hours">Heures</option>
                                 </select>
                              </div>
                           </div>

                           <div className="col-span-2 md:col-span-1">
                              <label className="block text-xs font-bold text-slate-500 mb-1">Fréquence des créneaux</label>
                              <select
                                 value={newEventSlotInterval || 'default'}
                                 onChange={(e) => setNewEventSlotInterval(e.target.value === 'default' ? null : parseInt(e.target.value))}
                                 className="w-full rounded-lg bg-slate-950 border border-slate-700 py-2.5 px-4 text-white outline-none cursor-pointer hover:border-slate-600 transition-all"
                              >
                                 <option value="default">Par défaut (Durée)</option>
                                 <option value={15}>15 min</option><option value={30}>30 min</option><option value={45}>45 min</option><option value={60}>60 min</option>
                              </select>
                           </div>
                        </div>
                     </section>
                  </div>

                  <div className="mt-8 flex gap-4 border-t border-slate-800 pt-6">
                     <button onClick={() => setIsCreateModalOpen(false)} className="flex-1 py-3 rounded-xl font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">Annuler</button>
                     <button
                        onClick={handleCreateEventType}
                        disabled={isCreatingEvent || !newEventTitle}
                        className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                     >
                        {isCreatingEvent ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Créer l'événement
                     </button>
                  </div>
               </div>
            </div>
         )}

         {/* MODALE ÉDITION COMPLÈTE (Z-50) (Inchangée) */}
         {isEditModalOpen && editingEvent && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
               <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsEditModalOpen(false)} />
               <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 border border-slate-800 p-8 shadow-2xl animate-in fade-in zoom-in-95 custom-scrollbar">

                  <div className="flex items-center justify-between mb-8 border-b border-slate-800 pb-4">
                     <div>
                        <h3 className="text-2xl font-bold text-white">Modifier l'événement</h3>
                        <p className="text-slate-400 text-sm">Configurez les détails et les disponibilités.</p>
                     </div>
                     <button onClick={() => setIsEditModalOpen(false)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"><X className="h-6 w-6" /></button>
                  </div>

                  <div className="space-y-8">
                     <section className="space-y-4">
                        <h4 className="text-sm font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2"><Edit2 className="h-4 w-4" /> Informations Générales</h4>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="col-span-2 md:col-span-1">
                              <label className="block text-xs font-bold text-slate-500 mb-1">Titre</label>
                              <input type="text" value={editingEvent.title} onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })} className="w-full rounded-lg bg-slate-950 border border-slate-700 py-2 px-4 text-white focus:border-blue-500 outline-none" />
                           </div>
                           <div className="col-span-2 md:col-span-1">
                              <label className="block text-xs font-bold text-slate-500 mb-1">Durée (min)</label>
                              <input type="number" value={editingEvent.length} onChange={(e) => setEditingEvent({ ...editingEvent, length: parseInt(e.target.value) })} className="w-full rounded-lg bg-slate-950 border border-slate-700 py-2 px-4 text-white focus:border-blue-500 outline-none" />
                           </div>
                           <div className="col-span-2">
                              <label className="block text-xs font-bold text-slate-500 mb-1">Description</label>
                              <textarea rows={3} value={editingEvent.description} onChange={(e) => setEditingEvent({ ...editingEvent, description: e.target.value })} className="w-full rounded-lg bg-slate-950 border border-slate-700 py-2 px-4 text-white focus:border-blue-500 outline-none resize-none" />
                           </div>

                           <div className="col-span-2">
                              <label className="block text-xs font-bold text-slate-500 mb-1">Lieu / Location</label>
                              <div className="space-y-3">
                                 <div className="p-3 rounded-lg border border-slate-700 bg-slate-950 text-slate-400 text-xs flex items-center gap-2">
                                    <MapPin className="h-4 w-4" />
                                    <select
                                       className="bg-transparent outline-none w-full text-white cursor-pointer"
                                       onChange={(e) => {
                                          const newType = e.target.value
                                          const currentLoc = editingEvent.locations[0] || {}
                                          setEditingEvent({
                                             ...editingEvent,
                                             locations: [{ ...currentLoc, type: newType }]
                                          })
                                       }}
                                       value={editingEvent.locations[0]?.type || 'integrations:daily'}
                                    >
                                       <optgroup label="Visio">
                                          <option value="integrations:daily">Cal Video (Par défaut)</option>
                                          <option value="integrations:google:meet">Google Meet</option>
                                          <option value="integrations:zoom:video">Zoom Video</option>
                                          <option value="integrations:discord">Discord</option>
                                       </optgroup>
                                       <optgroup label="Téléphone">
                                          <option value="attendee_phone">Numéro de téléphone du participant</option>
                                          <option value="phone">Appel téléphonique (Organisateur appelle)</option>
                                       </optgroup>
                                       <optgroup label="Physique">
                                          <option value="attendee_in_person">En personne (adresse du participant)</option>
                                          <option value="in_person">En personne (adresse de l'organisateur)</option>
                                       </optgroup>
                                       <optgroup label="Autre">
                                          <option value="link">Lien personnalisé / Autre</option>
                                       </optgroup>
                                    </select>
                                 </div>

                                 {editingEvent.locations[0]?.type === 'in_person' && (
                                    <div className="animate-in fade-in slide-in-from-top-2">
                                       <label className="block text-[10px] font-bold text-blue-400 uppercase mb-1">Adresse exacte du RDV</label>
                                       <input
                                          type="text"
                                          placeholder="Ex: 12 Rue de la Paix, Paris"
                                          value={editingEvent.locations[0].address || ''}
                                          onChange={(e) => {
                                             const newLocs = [...editingEvent.locations]
                                             newLocs[0] = { ...newLocs[0], address: e.target.value }
                                             setEditingEvent({ ...editingEvent, locations: newLocs })
                                          }}
                                          className="w-full rounded-lg bg-slate-950 border border-blue-500/50 py-2 px-4 text-white text-sm focus:border-blue-500 outline-none"
                                       />
                                    </div>
                                 )}

                                 {editingEvent.locations[0]?.type === 'link' && (
                                    <div className="animate-in fade-in slide-in-from-top-2">
                                       <label className="block text-[10px] font-bold text-blue-400 uppercase mb-1">URL du lien</label>
                                       <input
                                          type="text"
                                          placeholder="https://..."
                                          value={editingEvent.locations[0].link || ''}
                                          onChange={(e) => {
                                             const newLocs = [...editingEvent.locations]
                                             newLocs[0] = { ...newLocs[0], link: e.target.value }
                                             setEditingEvent({ ...editingEvent, locations: newLocs })
                                          }}
                                          className="w-full rounded-lg bg-slate-950 border border-blue-500/50 py-2 px-4 text-white text-sm focus:border-blue-500 outline-none"
                                       />
                                    </div>
                                 )}

                                 {editingEvent.locations[0]?.type === 'phone' && (
                                    <div className="animate-in fade-in slide-in-from-top-2">
                                       <label className="block text-[10px] font-bold text-blue-400 uppercase mb-1">Numéro à appeler</label>
                                       <input
                                          type="text"
                                          placeholder="+33 6..."
                                          value={editingEvent.locations[0].phone || ''}
                                          onChange={(e) => {
                                             const newLocs = [...editingEvent.locations]
                                             newLocs[0] = { ...newLocs[0], phone: e.target.value }
                                             setEditingEvent({ ...editingEvent, locations: newLocs })
                                          }}
                                          className="w-full rounded-lg bg-slate-950 border border-blue-500/50 py-2 px-4 text-white text-sm focus:border-blue-500 outline-none"
                                       />
                                    </div>
                                 )}
                              </div>
                           </div>
                        </div>
                     </section>

                     <hr className="border-slate-800" />

                     <section className="space-y-4">
                        <h4 className="text-sm font-bold text-purple-400 uppercase tracking-wider flex items-center gap-2"><Clock className="h-4 w-4" /> Disponibilités & Limites</h4>
                        <div className="grid grid-cols-2 gap-6">
                           <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">Marge avant l'événement (min)</label>
                              <select
                                 value={editingEvent.beforeEventBuffer}
                                 onChange={(e) => setEditingEvent({ ...editingEvent, beforeEventBuffer: parseInt(e.target.value) })}
                                 className="w-full rounded-lg bg-slate-950 border border-slate-700 py-2 px-4 text-white outline-none cursor-pointer"
                              >
                                 <option value={0}>Aucune</option><option value={5}>5 min</option><option value={10}>10 min</option><option value={15}>15 min</option><option value={30}>30 min</option><option value={60}>1h</option>
                              </select>
                           </div>
                           <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">Marge après l'événement (min)</label>
                              <select
                                 value={editingEvent.afterEventBuffer}
                                 onChange={(e) => setEditingEvent({ ...editingEvent, afterEventBuffer: parseInt(e.target.value) })}
                                 className="w-full rounded-lg bg-slate-950 border border-slate-700 py-2 px-4 text-white outline-none cursor-pointer"
                              >
                                 <option value={0}>Aucune</option><option value={5}>5 min</option><option value={10}>10 min</option><option value={15}>15 min</option><option value={30}>30 min</option><option value={60}>1h</option>
                              </select>
                           </div>

                           <div className="col-span-2 md:col-span-1">
                              <label className="block text-xs font-bold text-slate-500 mb-1">Préavis minimum</label>
                              <div className="flex">
                                 <input
                                    type="number"
                                    value={editingEvent.minimumBookingNotice}
                                    onChange={(e) => setEditingEvent({ ...editingEvent, minimumBookingNotice: parseInt(e.target.value) })}
                                    className="w-20 rounded-l-lg bg-slate-950 border border-r-0 border-slate-700 py-2 px-4 text-white outline-none"
                                 />
                                 <select
                                    value={noticeUnit}
                                    onChange={(e) => setNoticeUnit(e.target.value as 'minutes' | 'hours')}
                                    className="flex-1 rounded-r-lg bg-slate-950 border border-slate-700 py-2 px-2 text-white outline-none cursor-pointer"
                                 >
                                    <option value="minutes">Minutes</option>
                                    <option value="hours">Heures</option>
                                 </select>
                              </div>
                           </div>

                           <div className="col-span-2 md:col-span-1">
                              <label className="block text-xs font-bold text-slate-500 mb-1">Fréquence des créneaux</label>
                              <select
                                 value={editingEvent.slotInterval || 'default'}
                                 onChange={(e) => setEditingEvent({ ...editingEvent, slotInterval: e.target.value === 'default' ? null : parseInt(e.target.value) })}
                                 className="w-full rounded-lg bg-slate-950 border border-slate-700 py-2 px-4 text-white outline-none cursor-pointer"
                              >
                                 <option value="default">Par défaut (Durée)</option>
                                 <option value={15}>15 min</option><option value={30}>30 min</option><option value={45}>45 min</option><option value={60}>60 min</option>
                              </select>
                           </div>
                        </div>
                     </section>

                     <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                        <div>
                           <p className="text-sm text-slate-300 font-medium">Besoin de plus de réglages ?</p>
                           <p className="text-xs text-slate-500 mt-1">Pour les règles avancées (questions, paiements, workflows), utilisez l'interface native.</p>
                           <a href={`https://app.cal.com/event-types/${editingEvent.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-blue-400 mt-2 hover:underline">
                              Ouvrir les paramètres avancés <ExternalLink className="h-3 w-3" />
                           </a>
                        </div>
                     </div>

                  </div>

                  <div className="mt-8 flex gap-4 border-t border-slate-800 pt-6">
                     <button onClick={() => setIsEditModalOpen(false)} className="flex-1 py-3 rounded-xl font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">Annuler</button>
                     <button onClick={handleUpdateEvent} disabled={isUpdatingEvent} className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-600/20 disabled:opacity-50 flex items-center justify-center gap-2">
                        {isUpdatingEvent ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer
                     </button>
                  </div>

               </div>
            </div>
         )}

         {/* Modal Détails (Enrichi) */}
         {selectedMeeting && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 text-left">
               <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl custom-scrollbar">
                  <div className="mb-8 flex items-center justify-between">
                     <h2 className="text-2xl font-bold text-white">Détails de l'appel</h2>
                     <button onClick={() => setSelectedMeeting(null)} className="rounded-full p-2 hover:bg-slate-800 text-slate-400"><X className="h-6 w-6" /></button>
                  </div>
                  <div className="space-y-4">
                     {/* Header: Contact + Status */}
                     <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-800/50 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                           <div className="h-12 w-12 rounded-xl bg-blue-600 flex items-center justify-center text-xl font-bold text-white">{selectedMeeting.contact?.charAt(0)}</div>
                           <div>
                              <p className="text-lg font-bold text-white">{maskData(selectedMeeting.contact, 'name')}</p>
                              <p className="text-sm text-slate-500">{getMeetingLocation(selectedMeeting)}</p>
                           </div>
                        </div>
                        <div className="relative">
                           <select disabled={isUpdatingStatus} value={selectedMeeting.status} onChange={(e) => handleUpdateStatus(e.target.value)} className={cn("appearance-none pl-4 pr-10 py-2 rounded-xl border text-[10px] font-bold uppercase tracking-wider outline-none cursor-pointer transition-all", getStatusStyle(selectedMeeting.status))}>
                              <option value="Confirmé">Confirmé</option><option value="Terminé">Terminé</option><option value="Annulé">Annulé</option>
                           </select>
                           <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 pointer-events-none opacity-50" />
                        </div>
                     </div>

                     {/* Email + Phone */}
                     <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-800/50">
                           <p className="text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-2"><Mail size={10} /> Email</p>
                           <p className="text-white font-bold truncate text-sm">{maskData(selectedMeeting.email || 'Non renseigné', 'email')}</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-800/50">
                           <p className="text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-2"><Phone size={10} /> Téléphone</p>
                           <div className="flex items-center gap-2">
                              <p className="text-white font-bold text-sm flex-1 truncate">{maskData(selectedMeeting.phone || 'Non renseigné', 'phone')}</p>
                              {selectedMeeting.phone && (
                                 <a
                                    href={`https://wa.me/${selectedMeeting.phone.replace(/[\s\-\(\)]/g, '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="shrink-0 flex items-center justify-center h-8 w-8 rounded-lg bg-green-600 hover:bg-green-500 transition-colors shadow-lg shadow-green-600/20"
                                    title="Ouvrir WhatsApp"
                                 >
                                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-white fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                                 </a>
                              )}
                           </div>
                        </div>
                     </div>

                     {/* Date + Heure */}
                     <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-800/50"><p className="text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-2"><Calendar size={10} /> Date</p><p className="text-white font-bold">{safeFormat(selectedMeeting.date, 'dd MMMM yyyy')}</p></div>
                        <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-800/50"><p className="text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-2"><Clock size={10} /> Heure</p><p className="text-white font-bold">{selectedMeeting.time}</p></div>
                     </div>

                     {/* Lieu / Lien visio */}
                     <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-800/50">
                        <p className="text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-2"><MapPin size={10} /> Lieu</p>
                        {(() => {
                           const videoLink = selectedMeeting.video_link || selectedMeeting.location;
                           const isVideoUrl = videoLink && (videoLink.startsWith('http') || videoLink.startsWith('https'));
                           if (isVideoUrl) {
                              return <a href={videoLink} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 font-bold text-sm truncate block underline">{videoLink}</a>;
                           }
                           return <p className="text-white font-bold text-sm">{selectedMeeting.location || 'Non renseigné'}</p>;
                        })()}
                     </div>

                     {/* Notes */}
                     <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-800/50">
                        <p className="text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-2"><Edit2 size={10} /> Notes</p>
                        <p className="text-white text-sm whitespace-pre-wrap">{selectedMeeting.notes || selectedMeeting.description || 'Aucune note'}</p>
                     </div>
                  </div>

                  {/* Buttons */}
                  <div className="mt-8 flex flex-col gap-3">
                     {(selectedMeeting.video_link || selectedMeeting.location) && (
                        <button onClick={() => {
                           const videoUrl = selectedMeeting.video_link || selectedMeeting.location;
                           // Ouvrir l'appel externe dans un nouvel onglet
                           if (videoUrl && (videoUrl.startsWith('http') || videoUrl.startsWith('https'))) {
                              window.open(videoUrl, '_blank', 'noopener,noreferrer');
                           }
                           // Ouvrir CallRoom dans l'app
                           if (videoUrl && isDailyCoLink(videoUrl)) {
                              navigate(`/live-call?url=${encodeURIComponent(videoUrl)}&from=/rendez-vous`);
                           } else {
                              navigate('/calls');
                           }
                        }} className="w-full flex items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 font-bold text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20">
                           <Video className="h-5 w-5" /> Rejoindre l'appel
                        </button>
                     )}
                     {/* Annuler & Reporter */}
                     {selectedMeeting.status?.toLowerCase() !== 'annulé' && selectedMeeting.status?.toLowerCase() !== 'cancelled' && (
                        <div className="grid grid-cols-2 gap-3 pt-1">
                           <button
                              onClick={handleRescheduleBooking}
                              disabled={!selectedMeeting.cal_booking_uid}
                              className="flex items-center justify-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 py-3 font-bold text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              title={!selectedMeeting.cal_booking_uid ? 'Pas de lien Cal.com disponible' : 'Reporter ce rendez-vous'}
                           >
                              <CalendarClock className="h-4 w-4" /> Reporter
                           </button>
                           <button
                              onClick={handleCancelBooking}
                              disabled={isCancellingBooking}
                              className="flex items-center justify-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 py-3 font-bold text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                           >
                              {isCancellingBooking ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Annuler
                           </button>
                        </div>
                     )}
                     <button onClick={() => setSelectedMeeting(null)} className="w-full rounded-2xl border border-slate-800 bg-slate-800/50 py-4 font-bold text-slate-300 hover:bg-slate-800">Fermer</button>
                  </div>
               </div>
            </div>
         )}
      </div>
   )
}