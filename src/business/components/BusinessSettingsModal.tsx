import { useState, useEffect, useRef } from 'react'
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
  ChevronDown,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useTheme } from '../contexts/BusinessThemeContext'
import { supabase } from '../../lib/supabase'
import Cropper from 'react-easy-crop'
import getCroppedImg from '../../lib/image-crop'

interface BusinessSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: 'profile' | 'security' | 'support' | 'delete_account'
}

export function BusinessSettingsModal({ isOpen, onClose, initialTab = 'profile' }: BusinessSettingsModalProps) {
  const { user, businessProfile, updateBusinessProfile } = useBusinessAuth()
  const { dark, toggle: toggleDark } = useTheme()

  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'support' | 'delete_account'>(initialTab)
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

  useEffect(() => {
    if (user && isOpen) {
      setFormData(prev => ({
        ...prev,
        full_name: businessProfile?.full_name || user.user_metadata?.full_name || '',
        phone: businessProfile?.phone || user.user_metadata?.phone || '',
        role: businessProfile?.role || 'Business Owner',
        avatar_url: businessProfile?.avatar_url || user.user_metadata?.avatar_url || '',
        owner_assignable: businessProfile?.owner_assignable ?? false,
        deletion_scheduled_at: null,
      }))
      setMessage({ type: '', text: '' })
    }
  }, [user, isOpen, activeTab, businessProfile])

  useEffect(() => {
    if (isOpen && initialTab) setActiveTab(initialTab)
  }, [isOpen, initialTab])

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

      await updateBusinessProfile({ avatar_url: publicUrl })
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
      const { error } = await updateBusinessProfile({
        full_name: formData.full_name,
        phone: formData.phone,
        role: formData.role,
        avatar_url: formData.avatar_url,
        owner_assignable: formData.owner_assignable,
      })

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

  // ─── Delete account ───
  const handleDeleteAccount = async () => {
    if (!confirm('Voulez-vous vraiment supprimer votre compte ? Cette action est irréversible.')) return
    setLoading(true)
    try {
      const { error } = await supabase
        .from('business_users')
        .update({ deletion_scheduled_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() } as any)
        .eq('id', user?.id)
      if (error) throw error
      setFormData(prev => ({ ...prev, deletion_scheduled_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() }))
      setMessage({ type: 'success', text: 'Demande de suppression enregistrée. Votre compte sera supprimé dans 30 jours.' })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erreur' })
    } finally {
      setLoading(false)
    }
  }

  const handleCancelDeletion = async () => {
    if (!confirm('Voulez-vous annuler la suppression de votre compte ?')) return
    setLoading(true)
    try {
      const { error } = await supabase
        .from('business_users')
        .update({ deletion_scheduled_at: null } as any)
        .eq('id', user?.id)
      if (error) throw error
      setFormData(prev => ({ ...prev, deletion_scheduled_at: null }))
      setMessage({ type: 'success', text: 'La demande de suppression a été annulée.' })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erreur' })
    } finally {
      setLoading(false)
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
      <div className="relative z-10 w-full max-w-6xl h-[870px] bg-white dark:bg-neutral-900 rounded-[2rem] shadow-[0_40px_80px_rgba(27,28,27,0.08)] flex overflow-hidden">

        {/* ─── Sidebar ─── */}
        <aside className="hidden md:flex flex-col w-80 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl border-r border-[#c4c7c7]/10 dark:border-neutral-700 py-12 px-6">
          <div className="mb-12 px-4">
            <h2 className="font-business-display font-extrabold text-2xl tracking-tighter text-stone-900 dark:text-white">Settings</h2>
            <p className="text-stone-500 dark:text-neutral-400 text-sm mt-1">Manage your workspace</p>
          </div>

          <nav className="flex-1 space-y-2">
            {sidebarTab('profile', <User className="h-5 w-5" strokeWidth={1.5} />, 'Profile')}
            {sidebarTab('security', <Shield className="h-5 w-5" strokeWidth={1.5} />, 'Security')}
            {sidebarTab('delete_account', <Trash2 className="h-5 w-5" strokeWidth={1.5} />, 'Delete Account')}
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
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full bg-[#f5f3f2] dark:bg-neutral-800 border-none rounded-xl px-5 py-4 text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20 outline-none transition-all font-medium"
                        placeholder="+33 6 00 00 00 00"
                      />
                    </div>

                    {/* Role */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-stone-500 dark:text-neutral-400 ml-1">Role</label>
                      <div className="relative">
                        <select
                          value={formData.role}
                          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                          className="w-full bg-[#f5f3f2] dark:bg-neutral-800 border-none rounded-xl px-5 py-4 text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20 outline-none transition-all cursor-pointer appearance-none font-medium"
                        >
                          <option value="Business Owner">Business Owner</option>
                          <option value="Head of Sales">Head of Sales</option>
                          <option value="Closer">Closer</option>
                          <option value="Setter">Setter</option>
                          <option value="Setter-Closer">Setter-Closer</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 pointer-events-none" strokeWidth={1.5} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Owner assignable toggle */}
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

                {/* Dark mode toggle */}
                <div
                  onClick={toggleDark}
                  className="mt-4 flex items-center justify-between p-6 rounded-2xl bg-white dark:bg-neutral-800 border border-[#c4c7c7]/10 dark:border-neutral-700 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-xl bg-stone-900/10 dark:bg-white/10 text-stone-900 dark:text-white group-hover:bg-stone-900/15 dark:group-hover:bg-white/15 transition-colors">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-stone-900 dark:text-white text-sm">Mode sombre</h4>
                      <p className="text-xs text-stone-500 dark:text-neutral-400 mt-0.5">Basculer entre le thème clair et sombre</p>
                    </div>
                  </div>
                  {dark
                    ? <ToggleRight className="h-7 w-7 text-[#006c49] shrink-0" />
                    : <ToggleLeft className="h-7 w-7 text-stone-300 shrink-0" />
                  }
                </div>

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
              <div className="max-w-xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h3 className="font-business-display font-extrabold text-3xl text-stone-900 dark:text-white mb-8 tracking-tight">Suppression du compte</h3>

                <div className="p-8 border border-red-200 bg-red-50 rounded-3xl space-y-6">
                  <div className="flex items-center gap-4 text-red-600">
                    <AlertCircle className="h-8 w-8" strokeWidth={1.5} />
                    <h3 className="text-xl font-business-display font-extrabold">Zone de danger</h3>
                  </div>
                  <div className="space-y-4">
                    <p className="text-stone-600 dark:text-neutral-300 leading-relaxed">
                      La suppression est irreversible. Toutes vos donnees (prospects, campagnes, objectifs, equipe) seront supprimees definitivement.
                    </p>
                    {formData.deletion_scheduled_at && (
                      <div className="p-4 bg-red-100 rounded-2xl border border-red-200">
                        <p className="font-bold text-red-700">Compte en cours de suppression</p>
                        <p className="text-sm text-red-600 mt-1">
                          Prevue le : {new Date(formData.deletion_scheduled_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                    )}
                  </div>
                  {formData.deletion_scheduled_at ? (
                    <button
                      onClick={handleCancelDeletion}
                      disabled={loading}
                      className="flex items-center justify-center w-full gap-3 px-6 py-4 bg-stone-200 hover:bg-stone-300 text-stone-900 rounded-full font-bold transition-all"
                    >
                      {loading ? <Loader2 className="animate-spin h-5 w-5" /> : "Annuler la demande de suppression"}
                    </button>
                  ) : (
                    <button
                      onClick={handleDeleteAccount}
                      disabled={loading}
                      className="flex items-center justify-center w-full gap-3 px-6 py-4 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white rounded-full font-bold transition-all border border-red-200 hover:border-red-600"
                    >
                      {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <><Trash2 className="h-5 w-5" strokeWidth={1.5} /> Supprimer mon compte et mes donnees</>}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ─── SUPPORT TAB ─── */}
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
