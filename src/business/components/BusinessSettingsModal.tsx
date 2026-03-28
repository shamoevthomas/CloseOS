import { useState, useEffect, useRef, useCallback } from 'react'
import { PhoneInput } from './PhoneInput'
import {
  X,
  Shield,
  User,
  Save,
  Phone,
  Briefcase,
  Lock,
  Loader2,
  Check,
  AlertCircle,
  Headphones,
  ExternalLink,
  Mail,
  Camera,
  Trash2,
  ZoomIn,
  ZoomOut,
  ToggleLeft,
  ToggleRight,
  UserPlus,
  ArrowRight,
  Monitor,
  GripVertical,
  LayoutDashboard,
  GitBranch,
  Target,
  Megaphone,
  BarChart3,
  Package,
  Calendar,
  Bell,
  Receipt,
  FileText,
  TrendingUp,
  Users,
  RotateCcw,
  Smartphone,
  LogOut,
  Building2,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useTheme } from '../contexts/BusinessThemeContext'
import { supabase } from '../../lib/supabase'
import Cropper from 'react-easy-crop'
import getCroppedImg from '../../lib/image-crop'

// Icon map for sidebar nav items
const NAV_ICON_MAP: Record<string, any> = {
  '/business/dashboard': LayoutDashboard,
  '/business/crm': GitBranch,
  '/business/pipeline-owner': Target,
  '/business/pipeline': Target,
  '/business/campagnes': Megaphone,
  '/business/acquisition': BarChart3,
  '/business/objectifs': Target,
  '/business/closer-objectifs': Target,
  '/business/formules': Package,
  '/business/appels': Phone,
  '/business/rendez-vous': Calendar,
  '/business/agenda': Calendar,
  '/business/rappels': Bell,
  '/business/factures': Receipt,
  '/business/report': FileText,
  '/business/setter-kpi': TrendingUp,
  '/business/closer-kpi': TrendingUp,
  '/business/team': Users,
  '/business/disponibilite': Calendar,
}

const DEFAULT_OWNER_NAV: { name: string; href: string }[] = [
  { name: 'Dashboard', href: '/business/dashboard' },
  { name: 'CRM', href: '/business/crm' },
  { name: 'Pipeline', href: '/business/pipeline-owner' },
  { name: 'Campagnes', href: '/business/campagnes' },
  { name: 'Acquisition', href: '/business/acquisition' },
  { name: 'Objectifs', href: '/business/objectifs' },
  { name: 'Formules', href: '/business/formules' },
  { name: 'Appels', href: '/business/appels' },
  { name: 'Rendez-vous', href: '/business/rendez-vous' },
  { name: 'Agenda', href: '/business/agenda' },
  { name: 'Rappels', href: '/business/rappels' },
  { name: 'Factures', href: '/business/factures' },
  { name: 'Rapport', href: '/business/report' },
  { name: 'KPI Setter', href: '/business/setter-kpi' },
  { name: 'KPI Closer', href: '/business/closer-kpi' },
  { name: 'Équipe', href: '/business/team' },
]

interface BusinessSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: 'profile' | 'security' | 'interface' | 'devices' | 'organisation' | 'support' | 'delete_account'
}

export function BusinessSettingsModal({ isOpen, onClose, initialTab = 'profile' }: BusinessSettingsModalProps) {
  const { user, businessProfile, updateBusinessProfile, businessSettings, updateBusinessSettings, isTeamMember, teamMember, ownerUserId, refreshProfile } = useBusinessAuth()
  const { dark, toggle: toggleDark } = useTheme()

  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'interface' | 'devices' | 'organisation' | 'support' | 'delete_account'>(initialTab)

  // ─── Leave organisation state ───
  const [leaveStep, setLeaveStep] = useState<'idle' | 'confirm' | 'code'>('idle')
  const [leaveCode, setLeaveCode] = useState(['', '', '', '', '', ''])
  const [leaveSending, setLeaveSending] = useState(false)
  const [leaveVerifying, setLeaveVerifying] = useState(false)
  const [leaveError, setLeaveError] = useState<string | null>(null)
  const [leaveResendCountdown, setLeaveResendCountdown] = useState(0)
  const leaveInputRefs = useRef<(HTMLInputElement | null)[]>([])

  // ─── Reset organisation state (owner) ───
  const [resetStep, setResetStep] = useState<'idle' | 'confirm' | 'code'>('idle')
  const [resetCode, setResetCode] = useState(['', '', '', '', '', ''])
  const [resetSending, setResetSending] = useState(false)
  const [resetVerifying, setResetVerifying] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetResendCountdown, setResetResendCountdown] = useState(0)
  const resetInputRefs = useRef<(HTMLInputElement | null)[]>([])

  // ─── Delete owner account state ───
  const [deleteStep, setDeleteStep] = useState<'idle' | 'confirm' | 'export' | 'code'>('idle')
  const [deleteCode, setDeleteCode] = useState(['', '', '', '', '', ''])
  const [deleteSending, setDeleteSending] = useState(false)
  const [deleteVerifying, setDeleteVerifying] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteResendCountdown, setDeleteResendCountdown] = useState(0)
  const deleteInputRefs = useRef<(HTMLInputElement | null)[]>([])

  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Crop states
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)

  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    role: '',
    avatar_url: '',
    owner_assignable: false,
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    deletion_scheduled_at: null as string | null,
  })

  // ─── Devices state ───
  const [devices, setDevices] = useState<any[]>([])
  const [devicesLoading, setDevicesLoading] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const currentDeviceFingerprint = typeof window !== 'undefined' ? localStorage.getItem('closeos_device_id') : null

  const fetchDevices = useCallback(async () => {
    if (!user?.id) return
    setDevicesLoading(true)
    try {
      const { data } = await supabase
        .from('business_device_tokens')
        .select('*')
        .eq('user_id', user.id)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
      setDevices(data || [])
    } catch (err) {
      console.error('Fetch devices error:', err)
    } finally {
      setDevicesLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (isOpen && activeTab === 'devices') fetchDevices()
  }, [isOpen, activeTab, fetchDevices])

  const revokeDevice = async (deviceId: string) => {
    setRevokingId(deviceId)
    try {
      await supabase.from('business_device_tokens').delete().eq('id', deviceId)
      setDevices(prev => prev.filter(d => d.id !== deviceId))
    } catch (err) {
      console.error('Revoke error:', err)
    } finally {
      setRevokingId(null)
    }
  }

  const parseDeviceName = (fingerprint: string): string => {
    const ua = fingerprint.split('-').slice(5).join('-').replace(/_/g, ' ')
    if (/iPhone/i.test(ua)) return 'iPhone'
    if (/iPad/i.test(ua)) return 'iPad'
    if (/Android.*Mobile/i.test(ua)) return 'Smartphone Android'
    if (/Android/i.test(ua)) return 'Tablette Android'
    if (/Macintosh|Mac_OS|Mac OS/i.test(ua)) return 'Mac'
    if (/Windows/i.test(ua)) return 'PC Windows'
    if (/Linux/i.test(ua)) return 'PC Linux'
    if (/CrOS/i.test(ua)) return 'Chromebook'
    return 'Appareil inconnu'
  }

  // ─── Sidebar reorder state ───
  const [sidebarItems, setSidebarItems] = useState<{ name: string; href: string }[]>([])
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const [savingSidebar, setSavingSidebar] = useState(false)
  const [sidebarDirty, setSidebarDirty] = useState(false)

  // Init sidebar items — load saved order from the right source
  useEffect(() => {
    if (!isOpen || !user) return
    const loadOrder = async () => {
      let savedOrder: string[] | null = null
      if (isTeamMember && teamMember?.id) {
        const { data } = await supabase
          .from('business_team_members')
          .select('sidebar_order')
          .eq('id', teamMember.id)
          .single()
        savedOrder = data?.sidebar_order as string[] | null
      } else {
        const { data } = await supabase
          .from('business_users')
          .select('sidebar_order')
          .eq('id', user.id)
          .single()
        savedOrder = data?.sidebar_order as string[] | null
      }
      if (savedOrder && Array.isArray(savedOrder) && savedOrder.length > 0) {
        const ordered: { name: string; href: string }[] = []
        for (const href of savedOrder) {
          const item = DEFAULT_OWNER_NAV.find(n => n.href === href)
          if (item) ordered.push(item)
        }
        for (const item of DEFAULT_OWNER_NAV) {
          if (!ordered.find(o => o.href === item.href)) ordered.push(item)
        }
        setSidebarItems(ordered)
      } else {
        setSidebarItems([...DEFAULT_OWNER_NAV])
      }
      setSidebarDirty(false)
    }
    loadOrder()
  }, [isOpen, user, isTeamMember, teamMember?.id])

  const handleDragStart = useCallback((idx: number) => {
    setDragIndex(idx)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault()
    setOverIndex(idx)
  }, [])

  const handleDrop = useCallback((idx: number) => {
    if (dragIndex === null || dragIndex === idx) {
      setDragIndex(null)
      setOverIndex(null)
      return
    }
    setSidebarItems(prev => {
      const items = [...prev]
      const [moved] = items.splice(dragIndex, 1)
      items.splice(idx, 0, moved)
      return items
    })
    setSidebarDirty(true)
    setDragIndex(null)
    setOverIndex(null)
  }, [dragIndex])

  const handleDragEnd = useCallback(() => {
    setDragIndex(null)
    setOverIndex(null)
  }, [])

  const saveSidebarOrder = async () => {
    if (!user) return
    setSavingSidebar(true)
    try {
      const order = sidebarItems.map(i => i.href)
      let result: { error: any }
      if (isTeamMember && teamMember?.id) {
        result = await supabase
          .from('business_team_members')
          .update({ sidebar_order: order })
          .eq('id', teamMember.id)
      } else {
        result = await supabase
          .from('business_users')
          .update({ sidebar_order: order })
          .eq('id', user.id)
      }
      if (result.error) {
        setMessage({ type: 'error', text: `Erreur: ${result.error.message}` })
      } else {
        setSidebarDirty(false)
        setMessage({ type: 'success', text: 'Ordre de la sidebar sauvegardé.' })
        refreshProfile?.()
      }
    } catch (err: any) {
      console.error('Save sidebar order exception:', err)
      setMessage({ type: 'error', text: `Exception: ${err?.message}` })
    } finally {
      setSavingSidebar(false)
    }
  }

  const resetSidebarOrder = async () => {
    if (!user) return
    setSidebarItems([...DEFAULT_OWNER_NAV])
    setSavingSidebar(true)
    try {
      let result: { error: any }
      if (isTeamMember && teamMember?.id) {
        result = await supabase
          .from('business_team_members')
          .update({ sidebar_order: null })
          .eq('id', teamMember.id)
      } else {
        result = await supabase
          .from('business_users')
          .update({ sidebar_order: null })
          .eq('id', user.id)
      }
      if (result.error) {
        setMessage({ type: 'error', text: `Erreur: ${result.error.message}` })
      } else {
        setSidebarDirty(false)
        setMessage({ type: 'success', text: 'Ordre de la sidebar réinitialisé.' })
        refreshProfile?.()
      }
    } catch {
      setMessage({ type: 'error', text: 'Erreur lors de la réinitialisation.' })
    } finally {
      setSavingSidebar(false)
    }
  }

  useEffect(() => {
    if (user && isOpen) {
      if (isTeamMember && teamMember) {
        setFormData(prev => ({
          ...prev,
          full_name: teamMember.full_name || '',
          phone: teamMember.phone || '',
          role: teamMember.role || 'Closer',
          avatar_url: teamMember.avatar_url || '',
          owner_assignable: (teamMember as any).owner_assignable ?? false,
          deletion_scheduled_at: null,
        }))
      } else {
        setFormData(prev => ({
          ...prev,
          full_name: businessProfile?.full_name || user.user_metadata?.full_name || '',
          phone: businessProfile?.phone || user.user_metadata?.phone || '',
          role: businessProfile?.role || 'Business Owner',
          avatar_url: businessProfile?.avatar_url || user.user_metadata?.avatar_url || '',
          owner_assignable: businessProfile?.owner_assignable ?? false,
          deletion_scheduled_at: null,
        }))
      }
      setMessage({ type: '', text: '' })
    }
  }, [user, isOpen, activeTab, businessProfile, isTeamMember, teamMember])

  useEffect(() => {
    if (isOpen && initialTab) setActiveTab(initialTab)
  }, [isOpen, initialTab])

  // Leave countdown
  useEffect(() => {
    if (leaveResendCountdown <= 0) return
    const t = setTimeout(() => setLeaveResendCountdown(leaveResendCountdown - 1), 1000)
    return () => clearTimeout(t)
  }, [leaveResendCountdown])

  // Reset countdown
  useEffect(() => {
    if (resetResendCountdown <= 0) return
    const t = setTimeout(() => setResetResendCountdown(resetResendCountdown - 1), 1000)
    return () => clearTimeout(t)
  }, [resetResendCountdown])

  // Delete owner countdown
  useEffect(() => {
    if (deleteResendCountdown <= 0) return
    const t = setTimeout(() => setDeleteResendCountdown(deleteResendCountdown - 1), 1000)
    return () => clearTimeout(t)
  }, [deleteResendCountdown])

  if (!isOpen) return null

  const isGoogleUser = user?.app_metadata?.provider === 'google'

  // ─── Avatar ───
  const handleAvatarClick = () => fileInputRef.current?.click()

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      const reader = new FileReader()
      reader.addEventListener('load', () => setImageSrc(reader.result as string))
      reader.readAsDataURL(file)
      e.target.value = ''
    }
  }

  const onCropComplete = (_: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }

  const showCroppedImage = async () => {
    if (!croppedAreaPixels || !imageSrc || !user?.id) return
    setUploading(true)
    setMessage({ type: '', text: '' })
    try {
      const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels)
      if (!croppedImageBlob) throw new Error("Erreur lors de la création de l'image.")

      const fileName = `business-${user.id}-${Math.random()}.jpg`
      const file = new File([croppedImageBlob], fileName, { type: 'image/jpeg' })

      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file)
      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName)
      const publicUrl = urlData.publicUrl

      if (isTeamMember && teamMember) {
        await supabase.from('business_team_members').update({ avatar_url: publicUrl }).eq('id', teamMember.id)
        await refreshProfile()
      } else {
        await updateBusinessProfile({ avatar_url: publicUrl })
      }
      supabase.auth.updateUser({ data: { avatar_url: publicUrl } }).catch(() => {})

      setFormData(prev => ({ ...prev, avatar_url: publicUrl }))
      setMessage({ type: 'success', text: 'Photo de profil mise à jour !' })
      setImageSrc(null)
    } catch (error: any) {
      console.error('Erreur upload:', error)
      setMessage({ type: 'error', text: "Erreur lors de l'upload de l'image." })
    } finally {
      setUploading(false)
    }
  }

  // ─── Profile ───
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      let error: any = null

      if (isTeamMember && teamMember) {
        const updatePayload: any = {
          phone: formData.phone,
          avatar_url: formData.avatar_url,
        }
        if (teamMember.role === 'Head of Sales') {
          updatePayload.owner_assignable = formData.owner_assignable
        }
        const { error: tmError } = await supabase
          .from('business_team_members')
          .update(updatePayload)
          .eq('id', teamMember.id)
        error = tmError
        if (!tmError) await refreshProfile()
      } else {
        const res = await updateBusinessProfile({
          full_name: formData.full_name,
          phone: formData.phone,
          role: formData.role,
          avatar_url: formData.avatar_url,
          owner_assignable: formData.owner_assignable,
        })
        error = res.error
      }

      await supabase.auth.updateUser({
        data: {
          full_name: formData.full_name,
          phone: formData.phone,
          avatar_url: formData.avatar_url,
        }
      })

      if (error) {
        setMessage({ type: 'error', text: error.message || 'Erreur' })
      } else {
        setMessage({ type: 'success', text: 'Profil mis à jour avec succès !' })
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erreur' })
    } finally {
      setLoading(false)
    }
  }

  // ─── Password ───
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.newPassword !== formData.confirmPassword) {
      setMessage({ type: 'error', text: 'Les mots de passe ne correspondent pas.' })
      return
    }
    if (!formData.currentPassword) {
      setMessage({ type: 'error', text: 'Veuillez entrer votre mot de passe actuel.' })
      return
    }
    setLoading(true)
    setMessage({ type: '', text: '' })
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: formData.currentPassword,
      })
      if (signInError) throw new Error('Mot de passe actuel incorrect.')

      const { error: updateError } = await supabase.auth.updateUser({ password: formData.newPassword })
      if (updateError) throw updateError

      setMessage({ type: 'success', text: 'Mot de passe modifié avec succès !' })
      setFormData(prev => ({ ...prev, newPassword: '', confirmPassword: '', currentPassword: '' }))
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Erreur lors de la mise à jour.' })
    } finally {
      setLoading(false)
    }
  }

  // ─── Delete owner account ───
  const sendDeleteCode = async () => {
    if (!user?.id || !user?.email) return
    setDeleteSending(true)
    setDeleteError(null)
    try {
      const res = await fetch('/api/business-send-delete-owner-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, email: user.email })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')
      setDeleteStep('code')
      setDeleteResendCountdown(60)
    } catch (err: any) {
      setDeleteError(err.message)
    } finally {
      setDeleteSending(false)
    }
  }

  const handleDeleteInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const newCode = [...deleteCode]
    newCode[index] = value.slice(-1)
    setDeleteCode(newCode)
    setDeleteError(null)
    if (value && index < 5) deleteInputRefs.current[index + 1]?.focus()
    if (newCode.every(d => d !== '')) confirmDelete(newCode.join(''))
  }

  const handleDeleteKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !deleteCode[index] && index > 0) deleteInputRefs.current[index - 1]?.focus()
  }

  const handleDeletePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      setDeleteCode(pasted.split(''))
      deleteInputRefs.current[5]?.focus()
      confirmDelete(pasted)
    }
  }

  const confirmDelete = async (fullCode: string) => {
    if (!user?.id) return
    setDeleteVerifying(true)
    setDeleteError(null)
    try {
      const res = await fetch('/api/business-delete-owner-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, code: fullCode })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Code invalide')
      await supabase.auth.signOut()
      window.location.href = '/business/login'
    } catch (err: any) {
      setDeleteError(err.message)
      setDeleteCode(['', '', '', '', '', ''])
      deleteInputRefs.current[0]?.focus()
    } finally {
      setDeleteVerifying(false)
    }
  }


  const sendLeaveCode = async () => {
    if (!user?.id || !user?.email) return
    setLeaveSending(true)
    setLeaveError(null)
    try {
      const res = await fetch('/api/business-send-leave-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, email: user.email })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')
      setLeaveStep('code')
      setLeaveResendCountdown(60)
    } catch (err: any) {
      setLeaveError(err.message)
    } finally {
      setLeaveSending(false)
    }
  }

  const handleLeaveInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const newCode = [...leaveCode]
    newCode[index] = value.slice(-1)
    setLeaveCode(newCode)
    setLeaveError(null)
    if (value && index < 5) leaveInputRefs.current[index + 1]?.focus()
    if (newCode.every(d => d !== '')) confirmLeave(newCode.join(''))
  }

  const handleLeaveKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !leaveCode[index] && index > 0) leaveInputRefs.current[index - 1]?.focus()
  }

  const handleLeavePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      setLeaveCode(pasted.split(''))
      leaveInputRefs.current[5]?.focus()
      confirmLeave(pasted)
    }
  }

  const confirmLeave = async (fullCode: string) => {
    if (!user?.id) return
    setLeaveVerifying(true)
    setLeaveError(null)
    try {
      const res = await fetch('/api/business-leave-organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, code: fullCode })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Code invalide')
      // Account deleted — sign out and redirect
      await supabase.auth.signOut()
      window.location.href = '/business/login'
    } catch (err: any) {
      setLeaveError(err.message)
      setLeaveCode(['', '', '', '', '', ''])
      leaveInputRefs.current[0]?.focus()
    } finally {
      setLeaveVerifying(false)
    }
  }


  const sendResetCode = async () => {
    if (!user?.id || !user?.email) return
    setResetSending(true)
    setResetError(null)
    try {
      const res = await fetch('/api/business-send-reset-org-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, email: user.email })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')
      setResetStep('code')
      setResetResendCountdown(60)
    } catch (err: any) {
      setResetError(err.message)
    } finally {
      setResetSending(false)
    }
  }

  const handleResetInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const newCode = [...resetCode]
    newCode[index] = value.slice(-1)
    setResetCode(newCode)
    setResetError(null)
    if (value && index < 5) resetInputRefs.current[index + 1]?.focus()
    if (newCode.every(d => d !== '')) confirmReset(newCode.join(''))
  }

  const handleResetKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !resetCode[index] && index > 0) resetInputRefs.current[index - 1]?.focus()
  }

  const handleResetPaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      setResetCode(pasted.split(''))
      resetInputRefs.current[5]?.focus()
      confirmReset(pasted)
    }
  }

  const confirmReset = async (fullCode: string) => {
    if (!user?.id || !businessProfile?.id) return
    setResetVerifying(true)
    setResetError(null)
    try {
      const res = await fetch('/api/business-reset-organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, business_id: businessProfile.id, code: fullCode })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Code invalide')
      // Org reset — reload immediately to reflect empty state
      window.location.reload()
    } catch (err: any) {
      setResetError(err.message)
      setResetCode(['', '', '', '', '', ''])
      resetInputRefs.current[0]?.focus()
    } finally {
      setResetVerifying(false)
    }
  }

  const sidebarTab = (tab: typeof activeTab, icon: React.ReactNode, label: string) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={cn(
        'flex items-center gap-4 px-6 py-4 rounded-full font-business-display font-bold text-sm tracking-wide transition-all duration-300 w-full',
        activeTab === tab
          ? 'bg-white dark:bg-neutral-800 shadow-[0_4px_12px_rgba(0,0,0,0.03),0_0_0_0.5px_rgba(196,199,199,0.2)] text-stone-900 dark:text-white'
          : 'text-stone-400 dark:text-neutral-500 hover:translate-x-1'
      )}
    >
      {icon}
      {label}
    </button>
  )

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 lg:p-12 animate-in fade-in duration-200">
      {/* Background blurs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
        <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-[#006c49]/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-[#ffddb8]/20 rounded-full blur-[120px]" />
      </div>
      {/* Click outside to close */}
      <div className="fixed inset-0 z-0" onClick={onClose} />

      {/* CROPPER OVERLAY */}
      {imageSrc && (
        <div className="absolute inset-0 z-[200] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-lg h-[400px] relative rounded-2xl overflow-hidden border border-stone-300 bg-stone-100 mb-6">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
            />
          </div>
          <div className="w-full max-w-lg space-y-6">
            <div className="flex items-center gap-4 px-4">
              <ZoomOut className="h-5 w-5 text-stone-400" />
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full h-2 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-[#006c49]"
              />
              <ZoomIn className="h-5 w-5 text-stone-400" />
            </div>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => setImageSrc(null)}
                disabled={uploading}
                className="px-6 py-3 rounded-full border border-stone-600 text-stone-300 font-bold hover:bg-stone-800 transition-colors flex items-center gap-2"
              >
                <X className="h-4 w-4" /> Annuler
              </button>
              <button
                onClick={showCroppedImage}
                disabled={uploading}
                className="px-6 py-3 rounded-full bg-stone-900 text-white font-bold hover:opacity-90 transition-all shadow-lg flex items-center gap-2"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Valider la photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Container */}
      <div className="relative z-10 w-full max-w-6xl max-h-[85vh] bg-white dark:bg-neutral-900 rounded-[2rem] shadow-[0_40px_80px_rgba(27,28,27,0.08)] flex overflow-hidden">

        {/* ─── Sidebar ─── */}
        <aside className="hidden md:flex flex-col w-80 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl border-r border-[#c4c7c7]/10 dark:border-neutral-700 py-12 px-6">
          <div className="mb-6 px-4">
            <h2 className="font-business-display font-extrabold text-2xl tracking-tighter text-stone-900 dark:text-white">Paramètres</h2>
            <p className="text-stone-500 dark:text-neutral-400 text-sm mt-1">Gérez votre espace de travail</p>
          </div>

          <nav className="flex-1 space-y-0.5">
            {sidebarTab('profile', <User className="h-5 w-5" strokeWidth={1.5} />, 'Profile')}
            {sidebarTab('interface', <Monitor className="h-5 w-5" strokeWidth={1.5} />, 'Interface')}
            {sidebarTab('security', <Shield className="h-5 w-5" strokeWidth={1.5} />, 'Security')}
            {sidebarTab('devices', <Smartphone className="h-5 w-5" strokeWidth={1.5} />, 'Appareils')}
            {sidebarTab('organisation', <Building2 className="h-5 w-5" strokeWidth={1.5} />, 'Organisation')}
            {!isTeamMember && sidebarTab('delete_account', <Trash2 className="h-5 w-5" strokeWidth={1.5} />, 'Delete Account')}
            {sidebarTab('support', <Headphones className="h-5 w-5" strokeWidth={1.5} />, 'Support')}
          </nav>

          {/* Footer */}
          <div className="mt-auto px-4 pt-8">
            <div className="p-6 bg-[#f5f3f2] dark:bg-neutral-800 rounded-2xl">
              <p className="text-[10px] uppercase tracking-widest font-bold text-stone-400 dark:text-neutral-500 mb-2">Workspace Plan</p>
              <p className="font-business-display font-extrabold text-sm text-stone-900 dark:text-white">CloserOS Business</p>
            </div>
          </div>
        </aside>

        {/* ─── Main Content ─── */}
        <main className="flex-1 overflow-y-auto bg-[#fbf9f8] dark:bg-neutral-950 py-12 px-8 lg:px-16">
          <div className="max-w-3xl">

            {/* Message */}
            {message.text && (
              <div className={cn(
                'mb-8 flex items-center gap-3 p-5 rounded-2xl border',
                message.type === 'success'
                  ? 'bg-[#006c49]/5 border-[#006c49]/10 text-[#006c49]'
                  : 'bg-red-50 border-red-200 text-red-600'
              )}>
                {message.type === 'success' ? <Check className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                <p className="font-medium text-sm">{message.text}</p>
              </div>
            )}

            {/* ─── PROFILE TAB ─── */}
            {activeTab === 'profile' && (
              <form onSubmit={handleUpdateProfile} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h3 className="font-business-display font-extrabold text-3xl text-stone-900 dark:text-white mb-8 tracking-tight">Mon Profil</h3>

                <div className="flex flex-col md:flex-row gap-12 items-start">
                  {/* Avatar */}
                  <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={onFileChange}
                      className="hidden"
                      accept="image/jpeg, image/png, image/webp"
                      disabled={uploading}
                    />
                    <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-lg bg-[#eae8e7] flex items-center justify-center transition-transform duration-500 group-hover:scale-105">
                      {formData.avatar_url ? (
                        <img src={formData.avatar_url} alt="Profil" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#ffddb8] to-[#ffb95f] flex items-center justify-center text-4xl font-business-display font-extrabold text-[#2a1700]">
                          {formData.full_name?.[0] || 'U'}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="absolute bottom-0 right-0 bg-stone-900 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-xl border-4 border-[#fbf9f8] hover:scale-110 transition-all"
                    >
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" strokeWidth={1.5} />}
                    </button>
                  </div>

                  {/* Form fields */}
                  <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Full name */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-stone-500 dark:text-neutral-400 ml-1">Nom complet</label>
                      <input
                        type="text"
                        disabled
                        value={formData.full_name}
                        className="w-full bg-[#f5f3f2] dark:bg-neutral-800 border-none rounded-xl px-5 py-4 text-stone-400 dark:text-neutral-500 cursor-not-allowed outline-none transition-all font-medium"
                      />
                      <div className="flex items-start gap-2 mt-1 px-1">
                        <AlertCircle className="h-3.5 w-3.5 text-[#006c49] mt-0.5 shrink-0" strokeWidth={1.5} />
                        <p className="text-[10px] text-stone-500 dark:text-neutral-400 leading-relaxed">Le nom est verrouillé pour garantir la stabilité de vos liens.</p>
                      </div>
                    </div>

                    {/* Email (read-only) */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-stone-500 dark:text-neutral-400 ml-1">Email</label>
                      <input
                        type="email"
                        disabled
                        value={user?.email || ''}
                        className="w-full bg-[#f5f3f2] dark:bg-neutral-800 border-none rounded-xl px-5 py-4 text-stone-400 dark:text-neutral-500 cursor-not-allowed outline-none font-medium"
                      />
                    </div>

                    {/* Phone */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-stone-500 dark:text-neutral-400 ml-1">Numero de telephone</label>
                      <PhoneInput
                        value={formData.phone}
                        onChange={(v) => setFormData({ ...formData, phone: v })}
                        className="!bg-[#f5f3f2] dark:!bg-neutral-800"
                        inputClassName="flex-1 min-w-0 bg-transparent border-none py-3.5 px-3 text-sm text-stone-900 dark:text-white focus:ring-0 focus:outline-none font-medium"
                      />
                    </div>

                    {/* Role */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-stone-500 dark:text-neutral-400 ml-1">Role</label>
                      <input
                        type="text"
                        disabled
                        value={formData.role}
                        className="w-full bg-[#f5f3f2] dark:bg-neutral-800 border-none rounded-xl px-5 py-4 text-stone-400 dark:text-neutral-500 cursor-not-allowed outline-none font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* Owner assignable toggle - only for Owner and HOS */}
                {(!isTeamMember || teamMember?.role === 'Head of Sales') && (
                <div
                  onClick={() => setFormData(prev => ({ ...prev, owner_assignable: !prev.owner_assignable }))}
                  className="mt-8 flex items-center justify-between p-6 rounded-2xl bg-white dark:bg-neutral-800 border border-[#c4c7c7]/10 dark:border-neutral-700 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-xl bg-[#006c49]/10 text-[#006c49] group-hover:bg-[#006c49]/15 transition-colors">
                      <UserPlus className="h-5 w-5" strokeWidth={1.5} />
                    </div>
                    <div>
                      <h4 className="font-bold text-stone-900 dark:text-white text-sm">Apparaitre dans les assignations</h4>
                      <p className="text-xs text-stone-500 dark:text-neutral-400 mt-0.5">Vous serez selectionnable comme Closer/Setter dans les menus d'assignation</p>
                    </div>
                  </div>
                  {formData.owner_assignable
                    ? <ToggleRight className="h-7 w-7 text-[#006c49] shrink-0" />
                    : <ToggleLeft className="h-7 w-7 text-stone-300 shrink-0" />
                  }
                </div>
                )}

                {/* Security section inline */}
                <section className="mt-16 mb-12">
                  <div className="flex items-baseline justify-between mb-8">
                    <h3 className="font-business-display font-extrabold text-3xl text-stone-900 dark:text-white tracking-tight">Securite & Connexion</h3>
                    <span className="text-xs font-bold text-[#006c49] uppercase tracking-widest bg-[#006c49]/5 px-3 py-1 rounded-full">Proteger</span>
                  </div>

                  {/* Google Auth Banner */}
                  {isGoogleUser && (
                    <div className="mb-8 p-6 rounded-2xl bg-white dark:bg-neutral-800 border border-[#c4c7c7]/10 dark:border-neutral-700 shadow-sm flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-[#eae8e7] rounded-full flex items-center justify-center">
                          <svg className="w-6 h-6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-business-display font-bold text-sm text-stone-900 dark:text-white">Authentification Google active</p>
                          <p className="text-xs text-stone-500 dark:text-neutral-400">Connecte via {user?.email}</p>
                        </div>
                      </div>
                      <Check className="h-6 w-6 text-[#006c49]" strokeWidth={2} />
                    </div>
                  )}

                  {/* Password fields */}
                  {!isGoogleUser && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-widest text-stone-500 dark:text-neutral-400 ml-1">Mot de passe actuel</label>
                        <input
                          type="password"
                          value={formData.currentPassword}
                          onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                          className="w-full bg-[#f5f3f2] dark:bg-neutral-800 border-none rounded-xl px-5 py-4 text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20 outline-none transition-all font-medium"
                          placeholder="&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-widest text-stone-500 dark:text-neutral-400 ml-1">Nouveau mot de passe</label>
                        <input
                          type="password"
                          value={formData.newPassword}
                          onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                          className="w-full bg-[#f5f3f2] dark:bg-neutral-800 border-none rounded-xl px-5 py-4 text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20 outline-none transition-all font-medium"
                          placeholder="Entrez 8 caracteres min."
                        />
                      </div>
                    </div>
                  )}
                </section>

                {/* Footer actions */}
                <div className="mt-12 pt-8 border-t border-[#c4c7c7]/10 dark:border-neutral-700 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-sm font-business-display font-bold text-stone-400 dark:text-neutral-500 hover:text-stone-900 dark:hover:text-white transition-colors"
                  >
                    Ignorer les modifications
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-stone-900 text-white font-business-display font-extrabold text-sm px-10 py-5 rounded-full flex items-center gap-3 shadow-2xl shadow-stone-900/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="animate-spin h-5 w-5" /> : null}
                    Enregistrer les modifications
                    <ArrowRight className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
              </form>
            )}

            {/* ─── SECURITY TAB ─── */}
            {activeTab === 'security' && (
              <div className="max-w-xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h3 className="font-business-display font-extrabold text-3xl text-stone-900 dark:text-white mb-8 tracking-tight">Securite & Connexion</h3>

                {isGoogleUser ? (
                  <div className="p-6 bg-[#006c49]/5 border border-[#006c49]/10 rounded-2xl flex gap-4">
                    <div className="p-3 bg-[#006c49]/10 rounded-xl h-fit">
                      <Shield className="h-6 w-6 text-[#006c49] shrink-0" strokeWidth={1.5} />
                    </div>
                    <div>
                      <h4 className="font-bold text-stone-900 dark:text-white mb-1 text-lg">Authentification Google active</h4>
                      <p className="text-sm text-stone-500 dark:text-neutral-400 leading-relaxed">Votre compte est securise par Google. La gestion du mot de passe se fait via Google.</p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleUpdatePassword} className="space-y-6">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-stone-500 dark:text-neutral-400 ml-1">Mot de passe actuel (Requis)</label>
                      <input
                        type="password"
                        value={formData.currentPassword}
                        onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                        className="w-full bg-[#f5f3f2] dark:bg-neutral-800 border-none rounded-xl px-5 py-4 text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20 outline-none transition-all font-medium"
                        placeholder="Votre mot de passe actuel"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-stone-500 dark:text-neutral-400 ml-1">Nouveau mot de passe</label>
                      <input
                        type="password"
                        value={formData.newPassword}
                        onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                        className="w-full bg-[#f5f3f2] dark:bg-neutral-800 border-none rounded-xl px-5 py-4 text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20 outline-none transition-all font-medium"
                        placeholder="8 caracteres minimum"
                        minLength={8}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-stone-500 dark:text-neutral-400 ml-1">Confirmer le mot de passe</label>
                      <input
                        type="password"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        className="w-full bg-[#f5f3f2] dark:bg-neutral-800 border-none rounded-xl px-5 py-4 text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20 outline-none transition-all font-medium"
                        placeholder="Repetez le mot de passe"
                        minLength={8}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading || !formData.newPassword || !formData.confirmPassword || !formData.currentPassword}
                      className="w-full bg-stone-900 text-white px-6 py-4 rounded-full font-business-display font-extrabold flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Shield className="h-5 w-5" strokeWidth={1.5} />}
                      Mettre a jour le mot de passe
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* ─── DELETE ACCOUNT TAB ─── */}
            {activeTab === 'delete_account' && (
              <div className="max-w-xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h3 className="font-business-display font-extrabold text-3xl text-stone-900 dark:text-white mb-2 tracking-tight">Suppression du compte</h3>
                <p className="text-stone-500 dark:text-neutral-400 text-sm">
                  Supprimez d&eacute;finitivement votre compte et toutes les donn&eacute;es de votre organisation.
                </p>

                {/* Step 0: Idle — delete button */}
                {deleteStep === 'idle' && (
                  <div className="mt-8 p-6 rounded-2xl border border-red-200/50 dark:border-red-500/20 bg-red-50/30 dark:bg-red-500/5">
                    <div className="flex items-start gap-4">
                      <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-500/10 shrink-0">
                        <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-stone-900 dark:text-white text-sm">Supprimer mon compte</h4>
                        <p className="text-xs text-stone-500 dark:text-neutral-400 mt-1 leading-relaxed">
                          Cette action est <strong className="text-red-600">irr&eacute;versible</strong>. Votre compte, votre organisation, tous les membres de l'&eacute;quipe et toutes les donn&eacute;es seront d&eacute;finitivement supprim&eacute;s.
                        </p>
                        <button
                          onClick={() => setDeleteStep('confirm')}
                          className="mt-4 px-6 py-2.5 rounded-full bg-red-600 text-white text-sm font-bold hover:bg-red-700 active:scale-95 transition-all"
                        >
                          Supprimer mon compte
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 1: Confirmation */}
                {deleteStep === 'confirm' && (
                  <div className="mt-8 p-8 rounded-2xl border border-stone-200/20 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-lg">
                    <div className="text-center">
                      <div className="text-5xl mb-4">&#9888;&#65039;</div>
                      <h4 className="font-business-display font-extrabold text-xl text-stone-900 dark:text-white mb-3">
                        &Ecirc;tes-vous s&ucirc;r ?
                      </h4>
                      <p className="text-sm text-stone-500 dark:text-neutral-400 leading-relaxed mb-6">
                        Cette action va <strong className="text-red-600">supprimer d&eacute;finitivement</strong> votre compte et toutes les donn&eacute;es de votre organisation. Cette action est irr&eacute;versible.
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setDeleteStep('idle')}
                          className="flex-1 px-6 py-3 rounded-full border border-stone-300 dark:border-neutral-600 text-stone-700 dark:text-neutral-200 text-sm font-bold hover:bg-stone-50 dark:hover:bg-neutral-700 active:scale-95 transition-all"
                        >
                          Annuler
                        </button>
                        <button
                          onClick={() => setDeleteStep('export')}
                          className="flex-1 px-6 py-3 rounded-full bg-red-600 text-white text-sm font-bold hover:bg-red-700 active:scale-95 transition-all"
                        >
                          Continuer
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Export reminder */}
                {deleteStep === 'export' && (
                  <div className="mt-8 p-8 rounded-2xl border border-stone-200/20 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-lg">
                    <div className="text-center">
                      <div className="text-5xl mb-4">&#128230;</div>
                      <h4 className="font-business-display font-extrabold text-xl text-stone-900 dark:text-white mb-3">
                        Exportez vos donn&eacute;es
                      </h4>
                      <p className="text-sm text-stone-500 dark:text-neutral-400 leading-relaxed mb-6">
                        Avant de supprimer votre compte, pensez &agrave; exporter vos donn&eacute;es importantes. Une fois supprim&eacute;, rien ne pourra &ecirc;tre r&eacute;cup&eacute;r&eacute;.
                      </p>
                      <div className="text-left space-y-2 mb-8">
                        {[
                          { name: 'Rapport', href: '/business/report' },
                          { name: 'KPI Closer', href: '/business/closer-kpi' },
                          { name: 'KPI Setter', href: '/business/setter-kpi' },
                          { name: 'Pipeline', href: '/business/pipeline-owner' },
                          { name: 'Factures', href: '/business/factures' },
                          { name: 'CRM (Prospects)', href: '/business/crm' },
                          { name: '&Eacute;quipe', href: '/business/team' },
                        ].map((page) => (
                          <a
                            key={page.href}
                            href={page.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-3 rounded-xl bg-stone-50 dark:bg-neutral-700/50 hover:bg-stone-100 dark:hover:bg-neutral-700 transition-colors group"
                          >
                            <span className="text-sm font-medium text-stone-700 dark:text-neutral-200" dangerouslySetInnerHTML={{ __html: page.name }} />
                            <ExternalLink className="h-4 w-4 text-stone-400 group-hover:text-stone-600 dark:group-hover:text-neutral-300 transition-colors" />
                          </a>
                        ))}
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setDeleteStep('confirm')}
                          className="flex-1 px-6 py-3 rounded-full border border-stone-300 dark:border-neutral-600 text-stone-700 dark:text-neutral-200 text-sm font-bold hover:bg-stone-50 dark:hover:bg-neutral-700 active:scale-95 transition-all"
                        >
                          Retour
                        </button>
                        <button
                          onClick={sendDeleteCode}
                          disabled={deleteSending}
                          className="flex-1 px-6 py-3 rounded-full bg-red-600 text-white text-sm font-bold hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50"
                        >
                          {deleteSending ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "J'ai export\u00e9, continuer"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Verification code */}
                {deleteStep === 'code' && (
                  <div className="mt-8 p-8 rounded-2xl border border-stone-200/20 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-lg">
                    <div className="text-center">
                      <div className="text-4xl mb-4">&#128274;</div>
                      <h4 className="font-business-display font-extrabold text-xl text-stone-900 dark:text-white mb-2">
                        Code de confirmation
                      </h4>
                      <p className="text-sm text-stone-500 dark:text-neutral-400 mb-6">
                        Un code a &eacute;t&eacute; envoy&eacute; &agrave; <strong className="text-stone-700 dark:text-neutral-300">{user?.email}</strong>
                      </p>

                      {deleteError && (
                        <div className="mb-4 flex items-center justify-center gap-2 p-3 bg-red-50/60 border border-red-200/30 rounded-xl text-red-600 text-xs font-medium">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          {deleteError}
                        </div>
                      )}

                      <div className="flex justify-center gap-2.5 mb-6" onPaste={handleDeletePaste}>
                        {deleteCode.map((digit, i) => (
                          <div key={i} className="relative">
                            {i === 3 && <div className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-stone-300 dark:bg-neutral-600" />}
                            <input
                              ref={el => { deleteInputRefs.current[i] = el }}
                              type="text"
                              inputMode="numeric"
                              maxLength={1}
                              value={digit}
                              onChange={e => handleDeleteInput(i, e.target.value)}
                              onKeyDown={e => handleDeleteKeyDown(i, e)}
                              disabled={deleteVerifying}
                              className="w-11 h-13 text-center text-lg font-bold bg-stone-100/50 dark:bg-neutral-700 border border-stone-300 dark:border-neutral-600 rounded-xl text-stone-900 dark:text-white focus:ring-2 focus:ring-red-500/30 focus:border-red-500 outline-none transition-all disabled:opacity-50"
                            />
                          </div>
                        ))}
                      </div>

                      {deleteVerifying && (
                        <div className="flex justify-center mb-4">
                          <Loader2 className="h-5 w-5 animate-spin text-red-600" />
                        </div>
                      )}

                      <div className="mb-6">
                        {deleteResendCountdown > 0 ? (
                          <p className="text-xs text-stone-400">Renvoyer dans {deleteResendCountdown}s</p>
                        ) : (
                          <button onClick={sendDeleteCode} disabled={deleteSending} className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50">
                            Renvoyer le code
                          </button>
                        )}
                      </div>

                      <button
                        onClick={() => { setDeleteStep('idle'); setDeleteCode(['', '', '', '', '', '']); setDeleteError(null) }}
                        className="text-xs font-bold text-stone-500 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white transition-colors"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── SUPPORT TAB ─── */}
            {/* ─── INTERFACE TAB ─── */}
            {activeTab === 'interface' && (
              <div className="max-w-xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h3 className="font-business-display font-extrabold text-3xl text-stone-900 dark:text-white mb-8 tracking-tight">Interface</h3>

                {/* Dark mode toggle */}
                <div
                  onClick={toggleDark}
                  className="flex items-center justify-between p-6 rounded-2xl bg-white dark:bg-neutral-800 border border-[#c4c7c7]/10 dark:border-neutral-700 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-xl bg-stone-900/10 dark:bg-white/10 text-stone-900 dark:text-white group-hover:bg-stone-900/15 dark:group-hover:bg-white/15 transition-colors">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-stone-900 dark:text-white text-sm">Mode sombre</h4>
                      <p className="text-xs text-stone-500 dark:text-neutral-400 mt-0.5">Basculer entre le th&egrave;me clair et sombre</p>
                    </div>
                  </div>
                  {dark
                    ? <ToggleRight className="h-7 w-7 text-[#006c49] shrink-0" />
                    : <ToggleLeft className="h-7 w-7 text-stone-300 shrink-0" />
                  }
                </div>

                {/* Dashboard Period */}
                <div className="p-6 rounded-2xl border border-[#c4c7c7]/10 dark:border-neutral-700 bg-white dark:bg-neutral-800">
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-stone-400 dark:text-neutral-500 mb-1">Période du Dashboard</label>
                  <p className="text-sm text-stone-500 dark:text-neutral-400 mb-5">Choisissez la période par défaut pour les KPI affichés sur le dashboard.</p>
                  <div className="flex flex-wrap gap-2">
                    {([
                      { value: 'today', label: "Aujourd'hui" },
                      { value: 'week', label: 'Cette semaine' },
                      { value: 'month', label: 'Ce mois' },
                      { value: 'year', label: "Cette année" },
                      { value: 'all', label: 'Depuis toujours' },
                    ] as const).map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={async () => {
                          if (!user) return
                          const { error } = await supabase
                            .from('business_settings')
                            .update({ dashboard_period: opt.value })
                            .eq('user_id', ownerUserId || user.id)
                          if (error) {
                            setMessage({ type: 'error', text: `Erreur: ${error.message}` })
                          } else {
                            setMessage({ type: 'success', text: 'Période du dashboard mise à jour.' })
                            refreshProfile?.()
                          }
                        }}
                        className={cn(
                          'px-4 py-2.5 rounded-full text-sm font-bold transition-all',
                          (businessSettings?.dashboard_period || 'all') === opt.value
                            ? 'bg-stone-900 dark:bg-white text-white dark:text-neutral-900'
                            : 'bg-[#f5f3f2] dark:bg-neutral-700 text-stone-600 dark:text-neutral-300 hover:bg-stone-200 dark:hover:bg-neutral-600'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ─── Sidebar Order ─── */}
                <div className="p-6 rounded-2xl border border-[#c4c7c7]/10 dark:border-neutral-700 bg-white dark:bg-neutral-800">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] uppercase tracking-widest font-bold text-stone-400 dark:text-neutral-500">Organisation de la sidebar</label>
                    <div className="flex items-center gap-2">
                      {businessSettings?.sidebar_order && (
                        <button
                          type="button"
                          onClick={resetSidebarOrder}
                          disabled={savingSidebar}
                          className="flex items-center gap-1 text-[10px] font-bold text-stone-400 hover:text-stone-600 transition-colors uppercase tracking-widest"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Réinitialiser
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-stone-500 dark:text-neutral-400 mb-5">Glissez-déposez les pages pour réorganiser votre sidebar.</p>

                  {/* Mini sidebar preview */}
                  <div className="flex gap-6">
                    {/* Drag list */}
                    <div className="flex-1 space-y-1">
                      {sidebarItems.map((item, idx) => {
                        const Icon = NAV_ICON_MAP[item.href] || LayoutDashboard
                        const isDragging = dragIndex === idx
                        const isOver = overIndex === idx && dragIndex !== idx
                        return (
                          <div
                            key={item.href}
                            draggable
                            onDragStart={() => handleDragStart(idx)}
                            onDragOver={(e) => handleDragOver(e, idx)}
                            onDrop={() => handleDrop(idx)}
                            onDragEnd={handleDragEnd}
                            className={cn(
                              'flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-grab active:cursor-grabbing transition-all select-none group',
                              isDragging
                                ? 'opacity-40 scale-95 bg-stone-100 dark:bg-neutral-700'
                                : 'bg-[#fbf9f8] dark:bg-neutral-900 hover:bg-stone-100 dark:hover:bg-neutral-700',
                              isOver && 'ring-2 ring-[#006c49] ring-offset-1 bg-[#006c49]/5'
                            )}
                          >
                            <GripVertical className="h-4 w-4 text-stone-300 dark:text-neutral-600 shrink-0 group-hover:text-stone-500 transition-colors" />
                            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-white dark:bg-neutral-800 shadow-sm shrink-0">
                              <Icon className="h-3.5 w-3.5 text-stone-500 dark:text-neutral-400" />
                            </div>
                            <span className="text-xs font-bold text-stone-700 dark:text-neutral-300 uppercase tracking-wide truncate" style={{ fontFamily: 'Manrope, sans-serif' }}>
                              {item.name}
                            </span>
                            <span className="ml-auto text-[10px] font-bold text-stone-300 dark:text-neutral-600 tabular-nums">
                              {idx + 1}
                            </span>
                          </div>
                        )
                      })}
                    </div>

                    {/* Mini sidebar visual preview */}
                    <div className="hidden sm:block w-48 shrink-0">
                      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-stone-200/60 dark:border-neutral-700 shadow-lg overflow-hidden h-full">
                        {/* Mini header */}
                        <div className="px-3 py-3 border-b border-stone-100 dark:border-neutral-800 flex items-center gap-2">
                          <img src="/closeos-business-logo.png" alt="CloseOS Business" className="h-5 w-5 object-contain dark:hidden" />
                          <img src="/closeos-business-logo-dark.png" alt="CloseOS Business" className="h-5 w-5 object-contain hidden dark:block" />
                          <div>
                            <p className="text-[8px] font-black text-stone-900 dark:text-white leading-none">CloseOS</p>
                            <p className="text-[6px] text-stone-400 uppercase tracking-wider">Business</p>
                          </div>
                        </div>
                        {/* Mini nav items */}
                        <div className="p-1.5 space-y-px max-h-[340px] overflow-y-auto">
                          {sidebarItems.map((item, idx) => {
                            const Icon = NAV_ICON_MAP[item.href] || LayoutDashboard
                            return (
                              <div
                                key={item.href}
                                className={cn(
                                  'flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-all',
                                  idx === 0
                                    ? 'bg-stone-900/5 dark:bg-white/5 border-r-2 border-stone-900 dark:border-white'
                                    : 'text-stone-400 dark:text-neutral-500'
                                )}
                              >
                                <Icon className={cn(
                                  'h-2.5 w-2.5 shrink-0',
                                  idx === 0 ? 'text-stone-900 dark:text-white' : 'text-stone-400 dark:text-neutral-500'
                                )} />
                                <span className={cn(
                                  'text-[7px] font-bold uppercase tracking-tight truncate',
                                  idx === 0 ? 'text-stone-900 dark:text-white' : 'text-stone-400 dark:text-neutral-500'
                                )} style={{ fontFamily: 'Manrope, sans-serif' }}>
                                  {item.name}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Save button */}
                  {sidebarDirty && (
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={saveSidebarOrder}
                        disabled={savingSidebar}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-stone-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-bold hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                      >
                        {savingSidebar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Sauvegarder l'ordre
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'devices' && (
              <div className="max-w-xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h3 className="font-business-display font-extrabold text-3xl text-stone-900 dark:text-white mb-2 tracking-tight">Appareils connect&eacute;s</h3>
                <p className="text-stone-500 dark:text-neutral-400 text-sm mb-6">
                  Appareils ayant acc&egrave;s &agrave; votre compte. Les sessions expirent automatiquement apr&egrave;s 7 jours.
                </p>

                {devicesLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
                  </div>
                ) : devices.length === 0 ? (
                  <div className="text-center py-12 text-stone-400 dark:text-neutral-500 text-sm">
                    Aucun appareil connect&eacute;
                  </div>
                ) : (
                  <div className="space-y-3">
                    {devices.map((device) => {
                      const isCurrentDevice = device.device_fingerprint === currentDeviceFingerprint
                      const deviceName = parseDeviceName(device.device_fingerprint)
                      const expiresAt = new Date(device.expires_at)
                      const createdAt = new Date(device.created_at)
                      const daysLeft = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))

                      return (
                        <div
                          key={device.id}
                          className={cn(
                            'flex items-center justify-between p-4 rounded-2xl border transition-all',
                            isCurrentDevice
                              ? 'bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-200/50 dark:border-emerald-500/20'
                              : 'bg-white dark:bg-neutral-800/50 border-stone-200/20 dark:border-neutral-700'
                          )}
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <div className={cn(
                              'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
                              isCurrentDevice
                                ? 'bg-emerald-100 dark:bg-emerald-500/10'
                                : 'bg-stone-100 dark:bg-neutral-700'
                            )}>
                              <Smartphone className={cn(
                                'h-5 w-5',
                                isCurrentDevice ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-500 dark:text-neutral-400'
                              )} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-sm text-stone-900 dark:text-white truncate">{deviceName}</p>
                                {isCurrentDevice && (
                                  <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full shrink-0">
                                    Cet appareil
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-stone-400 dark:text-neutral-500 mt-0.5">
                                Connect&eacute; le {createdAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })} &middot; Expire dans {daysLeft}j
                              </p>
                            </div>
                          </div>
                          {!isCurrentDevice && (
                            <button
                              onClick={() => revokeDevice(device.id)}
                              disabled={revokingId === device.id}
                              className="shrink-0 ml-4 px-4 py-2 rounded-full bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold hover:bg-red-100 dark:hover:bg-red-500/20 active:scale-95 transition-all disabled:opacity-50"
                            >
                              {revokingId === device.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'R\u00e9voquer'}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'organisation' && isTeamMember && (
              <div className="max-w-xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h3 className="font-business-display font-extrabold text-3xl text-stone-900 dark:text-white mb-2 tracking-tight">Organisation</h3>
                <p className="text-stone-500 dark:text-neutral-400 text-sm">
                  G&eacute;rez votre appartenance &agrave; l'organisation.
                </p>

                {leaveStep === 'idle' && (
                  <div className="mt-8 p-6 rounded-2xl border border-red-200/50 dark:border-red-500/20 bg-red-50/30 dark:bg-red-500/5">
                    <div className="flex items-start gap-4">
                      <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-500/10 shrink-0">
                        <LogOut className="h-5 w-5 text-red-600 dark:text-red-400" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-stone-900 dark:text-white text-sm">Quitter l'organisation</h4>
                        <p className="text-xs text-stone-500 dark:text-neutral-400 mt-1 leading-relaxed">
                          Cette action est <strong className="text-red-600">irr&eacute;versible</strong>. Votre compte, vos donn&eacute;es, vos factures et toutes vos informations seront d&eacute;finitivement supprim&eacute;s.
                        </p>
                        <button
                          onClick={() => setLeaveStep('confirm')}
                          className="mt-4 px-6 py-2.5 rounded-full bg-red-600 text-white text-sm font-bold hover:bg-red-700 active:scale-95 transition-all"
                        >
                          Quitter l'organisation
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 1: Confirmation popup */}
                {leaveStep === 'confirm' && (
                  <div className="mt-8 p-8 rounded-2xl border border-stone-200/20 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-lg">
                    <div className="text-center">
                      <div className="text-5xl mb-4">&#128557;</div>
                      <h4 className="font-business-display font-extrabold text-xl text-stone-900 dark:text-white mb-3">
                        Ne partez pas maintenant
                      </h4>
                      <p className="text-sm text-stone-500 dark:text-neutral-400 leading-relaxed mb-6">
                        Faites encore un tour pour r&eacute;cup&eacute;rer vos donn&eacute;es avant de partir. Une fois confirm&eacute;, <strong className="text-red-600">tout sera supprim&eacute; d&eacute;finitivement</strong>.
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setLeaveStep('idle')}
                          className="flex-1 px-6 py-3 rounded-full border border-stone-300 dark:border-neutral-600 text-stone-700 dark:text-neutral-200 text-sm font-bold hover:bg-stone-50 dark:hover:bg-neutral-700 active:scale-95 transition-all"
                        >
                          Annuler
                        </button>
                        <button
                          onClick={sendLeaveCode}
                          disabled={leaveSending}
                          className="flex-1 px-6 py-3 rounded-full bg-red-600 text-white text-sm font-bold hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50"
                        >
                          {leaveSending ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Continuer'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Verification code */}
                {leaveStep === 'code' && (
                  <div className="mt-8 p-8 rounded-2xl border border-stone-200/20 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-lg">
                    <div className="text-center">
                      <div className="text-4xl mb-4">&#128274;</div>
                      <h4 className="font-business-display font-extrabold text-xl text-stone-900 dark:text-white mb-2">
                        Code de confirmation
                      </h4>
                      <p className="text-sm text-stone-500 dark:text-neutral-400 mb-6">
                        Un code a &eacute;t&eacute; envoy&eacute; &agrave; <strong className="text-stone-700 dark:text-neutral-300">{user?.email}</strong>
                      </p>

                      {leaveError && (
                        <div className="mb-4 flex items-center justify-center gap-2 p-3 bg-red-50/60 border border-red-200/30 rounded-xl text-red-600 text-xs font-medium">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          {leaveError}
                        </div>
                      )}

                      <div className="flex justify-center gap-2.5 mb-6" onPaste={handleLeavePaste}>
                        {leaveCode.map((digit, i) => (
                          <div key={i} className="relative">
                            {i === 3 && <div className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-stone-300 dark:bg-neutral-600" />}
                            <input
                              ref={el => { leaveInputRefs.current[i] = el }}
                              type="text"
                              inputMode="numeric"
                              maxLength={1}
                              value={digit}
                              onChange={e => handleLeaveInput(i, e.target.value)}
                              onKeyDown={e => handleLeaveKeyDown(i, e)}
                              disabled={leaveVerifying}
                              className="w-11 h-13 text-center text-lg font-bold bg-stone-100/50 dark:bg-neutral-700 border border-stone-300 dark:border-neutral-600 rounded-xl text-stone-900 dark:text-white focus:ring-2 focus:ring-red-500/30 focus:border-red-500 outline-none transition-all disabled:opacity-50"
                            />
                          </div>
                        ))}
                      </div>

                      {leaveVerifying && (
                        <div className="flex justify-center mb-4">
                          <Loader2 className="h-5 w-5 animate-spin text-red-600" />
                        </div>
                      )}

                      <div className="mb-6">
                        {leaveResendCountdown > 0 ? (
                          <p className="text-xs text-stone-400">Renvoyer dans {leaveResendCountdown}s</p>
                        ) : (
                          <button onClick={sendLeaveCode} disabled={leaveSending} className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50">
                            Renvoyer le code
                          </button>
                        )}
                      </div>

                      <button
                        onClick={() => { setLeaveStep('idle'); setLeaveCode(['', '', '', '', '', '']); setLeaveError(null) }}
                        className="text-xs font-bold text-stone-500 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white transition-colors"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'organisation' && !isTeamMember && (
              <div className="max-w-xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h3 className="font-business-display font-extrabold text-3xl text-stone-900 dark:text-white mb-2 tracking-tight">Organisation</h3>
                <p className="text-stone-500 dark:text-neutral-400 text-sm">
                  G&eacute;rez votre organisation et ses donn&eacute;es.
                </p>

                {/* Weekly Report Toggle */}
                <div
                  onClick={async () => {
                    if (!user) return
                    const newVal = !(businessSettings?.weekly_report_enabled ?? true)
                    const { error } = await supabase
                      .from('business_settings')
                      .update({ weekly_report_enabled: newVal })
                      .eq('user_id', user.id)
                    if (error) {
                      setMessage({ type: 'error', text: `Erreur: ${error.message}` })
                    } else {
                      setMessage({ type: 'success', text: newVal ? 'Rapport hebdomadaire activé.' : 'Rapport hebdomadaire désactivé.' })
                      refreshProfile?.()
                    }
                  }}
                  className="flex items-center justify-between p-6 rounded-2xl bg-white dark:bg-neutral-800 border border-[#c4c7c7]/10 dark:border-neutral-700 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-xl bg-stone-900/10 dark:bg-white/10 text-stone-900 dark:text-white group-hover:bg-stone-900/15 dark:group-hover:bg-white/15 transition-colors">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-stone-900 dark:text-white text-sm">Rapport hebdomadaire</h4>
                      <p className="text-xs text-stone-500 dark:text-neutral-400 mt-0.5">Recevez chaque dimanche un email avec le rapport PDF et CSV de la semaine</p>
                    </div>
                  </div>
                  {(businessSettings?.weekly_report_enabled ?? true)
                    ? <ToggleRight className="h-7 w-7 text-[#006c49] shrink-0" />
                    : <ToggleLeft className="h-7 w-7 text-stone-300 shrink-0" />
                  }
                </div>

                {resetStep === 'idle' && (
                  <div className="mt-8 p-6 rounded-2xl border border-red-200/50 dark:border-red-500/20 bg-red-50/30 dark:bg-red-500/5">
                    <div className="flex items-start gap-4">
                      <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-500/10 shrink-0">
                        <RotateCcw className="h-5 w-5 text-red-600 dark:text-red-400" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-stone-900 dark:text-white text-sm">R&eacute;initialiser l'organisation</h4>
                        <p className="text-xs text-stone-500 dark:text-neutral-400 mt-1 leading-relaxed">
                          Cette action est <strong className="text-red-600">irr&eacute;versible</strong>. Toutes les donn&eacute;es de l'organisation seront supprim&eacute;es : prospects, campagnes, rendez-vous, formules, commissions, objectifs, factures, rapports et tous les membres de l'&eacute;quipe.
                        </p>
                        <button
                          onClick={() => setResetStep('confirm')}
                          className="mt-4 px-6 py-2.5 rounded-full bg-red-600 text-white text-sm font-bold hover:bg-red-700 active:scale-95 transition-all"
                        >
                          R&eacute;initialiser l'organisation
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {resetStep === 'confirm' && (
                  <div className="mt-8 p-8 rounded-2xl border border-stone-200/20 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-lg">
                    <div className="text-center">
                      <div className="text-5xl mb-4">&#9888;&#65039;</div>
                      <h4 className="font-business-display font-extrabold text-xl text-stone-900 dark:text-white mb-3">
                        &Ecirc;tes-vous s&ucirc;r ?
                      </h4>
                      <p className="text-sm text-stone-500 dark:text-neutral-400 leading-relaxed mb-2">
                        Cette action va <strong className="text-red-600">supprimer d&eacute;finitivement</strong> toutes les donn&eacute;es de votre organisation :
                      </p>
                      <ul className="text-xs text-stone-500 dark:text-neutral-400 text-left mx-auto max-w-xs mb-4 space-y-1">
                        <li>&bull; Tous les prospects et leur historique</li>
                        <li>&bull; Toutes les campagnes et acquisitions</li>
                        <li>&bull; Tous les rendez-vous, appels et rappels</li>
                        <li>&bull; Toutes les formules, commissions et objectifs</li>
                        <li>&bull; Toutes les factures et rapports</li>
                        <li>&bull; Tous les membres de l'&eacute;quipe (comptes supprim&eacute;s)</li>
                      </ul>
                      <p className="text-xs text-stone-500 dark:text-neutral-400 leading-relaxed mb-6">
                        Chaque membre recevra un email avec un export de ses KPI personnels. Prenez le temps d'exporter vos donn&eacute;es importantes avant de continuer.
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setResetStep('idle')}
                          className="flex-1 px-6 py-3 rounded-full border border-stone-300 dark:border-neutral-600 text-stone-700 dark:text-neutral-200 text-sm font-bold hover:bg-stone-50 dark:hover:bg-neutral-700 active:scale-95 transition-all"
                        >
                          Annuler
                        </button>
                        <button
                          onClick={sendResetCode}
                          disabled={resetSending}
                          className="flex-1 px-6 py-3 rounded-full bg-red-600 text-white text-sm font-bold hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50"
                        >
                          {resetSending ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Continuer'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {resetStep === 'code' && (
                  <div className="mt-8 p-8 rounded-2xl border border-stone-200/20 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-lg">
                    <div className="text-center">
                      <div className="text-4xl mb-4">&#128274;</div>
                      <h4 className="font-business-display font-extrabold text-xl text-stone-900 dark:text-white mb-2">
                        Code de confirmation
                      </h4>
                      <p className="text-sm text-stone-500 dark:text-neutral-400 mb-6">
                        Un code a &eacute;t&eacute; envoy&eacute; &agrave; <strong className="text-stone-700 dark:text-neutral-300">{user?.email}</strong>
                      </p>

                      {resetError && (
                        <div className="mb-4 flex items-center justify-center gap-2 p-3 bg-red-50/60 border border-red-200/30 rounded-xl text-red-600 text-xs font-medium">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          {resetError}
                        </div>
                      )}

                      <div className="flex justify-center gap-2.5 mb-6" onPaste={handleResetPaste}>
                        {resetCode.map((digit, i) => (
                          <div key={i} className="relative">
                            {i === 3 && <div className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-stone-300 dark:bg-neutral-600" />}
                            <input
                              ref={el => { resetInputRefs.current[i] = el }}
                              type="text"
                              inputMode="numeric"
                              maxLength={1}
                              value={digit}
                              onChange={e => handleResetInput(i, e.target.value)}
                              onKeyDown={e => handleResetKeyDown(i, e)}
                              disabled={resetVerifying}
                              className="w-11 h-13 text-center text-lg font-bold bg-stone-100/50 dark:bg-neutral-700 border border-stone-300 dark:border-neutral-600 rounded-xl text-stone-900 dark:text-white focus:ring-2 focus:ring-red-500/30 focus:border-red-500 outline-none transition-all disabled:opacity-50"
                            />
                          </div>
                        ))}
                      </div>

                      {resetVerifying && (
                        <div className="flex justify-center mb-4">
                          <Loader2 className="h-5 w-5 animate-spin text-red-600" />
                        </div>
                      )}

                      <div className="mb-6">
                        {resetResendCountdown > 0 ? (
                          <p className="text-xs text-stone-400">Renvoyer dans {resetResendCountdown}s</p>
                        ) : (
                          <button onClick={sendResetCode} disabled={resetSending} className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50">
                            Renvoyer le code
                          </button>
                        )}
                      </div>

                      <button
                        onClick={() => { setResetStep('idle'); setResetCode(['', '', '', '', '', '']); setResetError(null) }}
                        className="text-xs font-bold text-stone-500 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white transition-colors"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'support' && (
              <div className="max-w-xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h3 className="font-business-display font-extrabold text-3xl text-stone-900 dark:text-white mb-8 tracking-tight">Centre d'Aide</h3>

                <a href="mailto:support@closeos.fr" className="group block p-6 rounded-2xl border border-[#c4c7c7]/10 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:shadow-md transition-all hover:scale-[1.01]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-[#006c49]/10 text-[#006c49] group-hover:bg-[#006c49]/15 transition-colors">
                        <Mail className="h-6 w-6" strokeWidth={1.5} />
                      </div>
                      <div>
                        <h4 className="font-bold text-stone-900 dark:text-white text-lg">Email Support</h4>
                        <p className="text-sm text-stone-500 dark:text-neutral-400">Reponse sous 24h ouvrees</p>
                      </div>
                    </div>
                    <ExternalLink className="h-5 w-5 text-stone-300 group-hover:text-stone-900 transition-colors" strokeWidth={1.5} />
                  </div>
                </a>

                <a href="#" className="group block p-6 rounded-2xl border border-[#c4c7c7]/10 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:shadow-md transition-all hover:scale-[1.01]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-[#ffddb8]/30 text-[#2a1700] group-hover:bg-[#ffddb8]/50 transition-colors">
                        <AlertCircle className="h-6 w-6" strokeWidth={1.5} />
                      </div>
                      <div>
                        <h4 className="font-bold text-stone-900 dark:text-white text-lg">Centre d'aide & FAQ</h4>
                        <p className="text-sm text-stone-500 dark:text-neutral-400">Guides et tutoriels (Bientot disponible)</p>
                      </div>
                    </div>
                    <ExternalLink className="h-5 w-5 text-stone-300 group-hover:text-stone-900 transition-colors" strokeWidth={1.5} />
                  </div>
                </a>
              </div>
            )}
          </div>
        </main>

        {/* Close button (top right) */}
        <button
          onClick={onClose}
          className="absolute top-8 right-8 w-12 h-12 rounded-full bg-white/70 dark:bg-neutral-800/70 backdrop-blur-md flex items-center justify-center text-stone-400 dark:text-neutral-500 hover:text-stone-900 dark:hover:text-white transition-all z-20 shadow-sm"
        >
          <X className="h-5 w-5" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
}
