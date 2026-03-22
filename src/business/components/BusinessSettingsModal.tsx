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
} from 'lucide-react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
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

      // Update business_users
      await updateBusinessProfile({ avatar_url: publicUrl })

      // Update auth metadata (non-blocking)
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

      // Also update auth metadata
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
      // Verify current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: formData.currentPassword,
      })
      if (signInError) throw new Error('Mot de passe actuel incorrect.')

      // Update password
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
      // Schedule deletion by updating a flag (or call an API)
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

  const tabButtonClass = (tabName: string) => `
    w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all
    ${activeTab === tabName
      ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-lg shadow-amber-500/20'
      : 'text-slate-400 hover:bg-white/5 hover:text-white'}
  `

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">

      {/* CROPPER OVERLAY */}
      {imageSrc && (
        <div className="absolute inset-0 z-[200] bg-black flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-lg h-[400px] relative rounded-xl overflow-hidden border border-slate-700 bg-slate-900 mb-6">
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
              <ZoomOut className="h-5 w-5 text-slate-400" />
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <ZoomIn className="h-5 w-5 text-slate-400" />
            </div>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => setImageSrc(null)}
                disabled={uploading}
                className="px-6 py-3 rounded-xl border border-slate-700 text-slate-300 font-bold hover:bg-slate-800 transition-colors flex items-center gap-2"
              >
                <X className="h-4 w-4" /> Annuler
              </button>
              <button
                onClick={showCroppedImage}
                disabled={uploading}
                className="px-6 py-3 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-500 transition-colors shadow-lg shadow-amber-500/25 flex items-center gap-2"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Valider la photo
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-5xl rounded-3xl border border-white/10 bg-[#020617] shadow-2xl overflow-hidden flex flex-col md:flex-row h-[700px] relative">

        {/* Background Gradients */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-amber-600/5 blur-[100px] rounded-full" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-orange-600/5 blur-[100px] rounded-full" />
        </div>

        {/* SIDEBAR */}
        <div className="w-full md:w-72 border-r border-white/5 bg-slate-900/30 p-6 flex flex-col backdrop-blur-sm z-10">
          <div className="flex items-center gap-3 mb-8 px-2">
            <div className="h-8 w-8 rounded-lg bg-amber-600 flex items-center justify-center">
              <User className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">Paramètres</h2>
          </div>

          <nav className="space-y-2 flex-1">
            <p className="px-4 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Compte</p>
            <button onClick={() => setActiveTab('profile')} className={tabButtonClass('profile')}>
              <User className="w-4 h-4" /> Profil
            </button>
            <button onClick={() => setActiveTab('security')} className={tabButtonClass('security')}>
              <Lock className="w-4 h-4" /> Sécurité
            </button>
            <button onClick={() => setActiveTab('delete_account')} className={tabButtonClass('delete_account')}>
              <Trash2 className="w-4 h-4 text-red-400" /> Suppression
            </button>

            <div className="my-6 h-px bg-white/5 mx-4" />

            <p className="px-4 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Aide</p>
            <button onClick={() => setActiveTab('support')} className={tabButtonClass('support')}>
              <Headphones className="w-4 h-4" /> Support
            </button>
          </nav>

          <button onClick={onClose} className="mt-auto flex items-center gap-2 px-4 py-3 text-slate-400 hover:text-white font-bold transition-colors rounded-xl hover:bg-white/5">
            <X className="w-4 h-4" /> Fermer
          </button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 flex flex-col bg-[#020617]/50 backdrop-blur-sm overflow-hidden text-left z-10 relative">
          <div className="px-10 py-8 border-b border-white/5 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-white text-left">
                {activeTab === 'profile' && 'Mon Profil'}
                {activeTab === 'security' && 'Sécurité & Connexion'}
                {activeTab === 'support' && "Centre d'Aide"}
                {activeTab === 'delete_account' && 'Suppression du compte'}
              </h2>
              <p className="text-slate-400 text-sm mt-1 text-left">
                {activeTab === 'profile' && 'Gérez vos informations personnelles et votre rôle.'}
                {activeTab === 'security' && "Protégez l'accès à votre compte CloseOS Business."}
                {activeTab === 'support' && 'Une question ? Notre équipe est là pour vous.'}
                {activeTab === 'delete_account' && 'Zone de danger : Supprimer votre compte et vos données.'}
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-10 custom-scrollbar text-left">
            {message.text && (
              <div className={`mb-8 flex items-center gap-3 p-4 rounded-xl border ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                {message.type === 'success' ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
                <p className="font-medium text-sm">{message.text}</p>
              </div>
            )}

            {/* ─── PROFILE TAB ─── */}
            {activeTab === 'profile' && (
              <form onSubmit={handleUpdateProfile} className="space-y-8 max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">

                {/* Avatar */}
                <div className="flex items-center gap-6 p-6 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                  <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={onFileChange}
                      className="hidden"
                      accept="image/jpeg, image/png, image/webp"
                      disabled={uploading}
                    />
                    <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-white/10 shadow-xl shadow-amber-500/20 group-hover:border-amber-500 transition-all">
                      {formData.avatar_url ? (
                        <img src={formData.avatar_url} alt="Profil" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-3xl font-bold text-white">
                          {formData.full_name?.[0] || 'U'}
                        </div>
                      )}
                    </div>
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      {uploading ? <Loader2 className="h-6 w-6 text-white animate-spin" /> : <Camera className="h-6 w-6 text-white" />}
                    </div>
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-white text-lg">Photo de profil</h3>
                    <p className="text-sm text-slate-400 mt-1">
                      {uploading ? 'Téléchargement en cours...' : "Cliquez sur l'image pour la modifier (JPG, PNG)."}
                    </p>
                  </div>
                </div>

                <div className="grid gap-6">
                  {/* Full name */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">Nom complet</label>
                    <input
                      type="text"
                      disabled
                      value={formData.full_name}
                      className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-slate-500 cursor-not-allowed outline-none transition-all font-medium text-left"
                    />
                    <div className="flex items-start gap-2 mt-2 px-1">
                      <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-300/80 leading-relaxed text-left">Le nom est verrouillé pour garantir la stabilité de vos liens.</p>
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="space-y-2 text-left">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">Numéro de téléphone</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all text-left"
                        placeholder="+33 6 00 00 00 00"
                      />
                    </div>
                  </div>

                  {/* Role */}
                  <div className="space-y-2 text-left">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">Rôle</label>
                    <div className="relative">
                      <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <select
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all cursor-pointer appearance-none text-left"
                      >
                        <option value="Business Owner">Business Owner</option>
                        <option value="Manager">Manager</option>
                        <option value="Closer">Closer</option>
                        <option value="Setter">Setter</option>
                        <option value="Setter-Closer">Setter-Closer</option>
                      </select>
                    </div>
                  </div>

                  {/* Owner assignable toggle */}
                  <div
                    onClick={() => setFormData(prev => ({ ...prev, owner_assignable: !prev.owner_assignable }))}
                    className="flex items-center justify-between p-5 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20 transition-colors">
                        <UserPlus className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-sm">Apparaître dans les assignations</h4>
                        <p className="text-xs text-slate-400 mt-0.5">Vous serez sélectionnable comme Closer/Setter dans les menus d'assignation</p>
                      </div>
                    </div>
                    {formData.owner_assignable
                      ? <ToggleRight className="h-7 w-7 text-amber-500 shrink-0" />
                      : <ToggleLeft className="h-7 w-7 text-slate-500 shrink-0" />
                    }
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 hover:scale-[1.02]"
                >
                  {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
                  Enregistrer les modifications
                </button>
              </form>
            )}

            {/* ─── SECURITY TAB ─── */}
            {activeTab === 'security' && (
              <div className="max-w-xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
                {isGoogleUser ? (
                  <div className="p-6 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex gap-4 text-left">
                    <div className="p-3 bg-amber-500/20 rounded-xl h-fit">
                      <Shield className="h-6 w-6 text-amber-400 shrink-0" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white mb-1 text-lg text-left">Authentification Google active</h4>
                      <p className="text-sm text-amber-200/70 leading-relaxed text-left">Votre compte est sécurisé par Google. La gestion du mot de passe se fait via Google.</p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleUpdatePassword} className="space-y-6 text-left">
                    <div className="space-y-2 text-left">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider text-left block">Mot de passe actuel (Requis)</label>
                      <div className="relative text-left">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <input
                          type="password"
                          value={formData.currentPassword}
                          onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                          className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all text-left"
                          placeholder="Votre mot de passe actuel"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2 text-left">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider text-left block">Nouveau mot de passe</label>
                      <div className="relative text-left">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <input
                          type="password"
                          value={formData.newPassword}
                          onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                          className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all text-left"
                          placeholder="8 caractères minimum"
                          minLength={8}
                        />
                      </div>
                    </div>
                    <div className="space-y-2 text-left">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider text-left block">Confirmer le mot de passe</label>
                      <div className="relative text-left">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <input
                          type="password"
                          value={formData.confirmPassword}
                          onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                          className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all text-left"
                          placeholder="Répétez le mot de passe"
                          minLength={8}
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={loading || !formData.newPassword || !formData.confirmPassword || !formData.currentPassword}
                      className="w-full bg-white/5 hover:bg-white/10 text-white px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all border border-white/10 hover:border-white/20"
                    >
                      {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Shield className="h-5 w-5" />}
                      Mettre à jour le mot de passe
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* ─── DELETE ACCOUNT TAB ─── */}
            {activeTab === 'delete_account' && (
              <div className="max-w-xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
                <div className="p-8 border border-red-500/20 bg-red-500/5 rounded-3xl space-y-6 text-left">
                  <div className="flex items-center gap-4 text-red-400 text-left">
                    <AlertCircle className="h-8 w-8" />
                    <h3 className="text-xl font-bold">Zone de danger</h3>
                  </div>
                  <div className="space-y-4">
                    <p className="text-slate-400 leading-relaxed text-left">
                      La suppression est irréversible. Toutes vos données (prospects, campagnes, objectifs, équipe) seront supprimées définitivement.
                    </p>
                    {formData.deletion_scheduled_at && (
                      <div className="p-4 bg-red-500/20 rounded-xl border border-red-500/30">
                        <p className="font-bold text-red-200">Compte en cours de suppression</p>
                        <p className="text-sm text-red-300 mt-1">
                          Prévue le : {new Date(formData.deletion_scheduled_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                    )}
                  </div>
                  {formData.deletion_scheduled_at ? (
                    <button
                      onClick={handleCancelDeletion}
                      disabled={loading}
                      className="flex items-center justify-center w-full gap-3 px-6 py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold transition-all border border-slate-600"
                    >
                      {loading ? <Loader2 className="animate-spin h-5 w-5" /> : "Annuler la demande de suppression"}
                    </button>
                  ) : (
                    <button
                      onClick={handleDeleteAccount}
                      disabled={loading}
                      className="flex items-center justify-center w-full gap-3 px-6 py-4 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white rounded-xl font-bold transition-all border border-red-600/20"
                    >
                      {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <><Trash2 className="h-5 w-5" /> Supprimer mon compte et mes données</>}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ─── SUPPORT TAB ─── */}
            {activeTab === 'support' && (
              <div className="max-w-xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
                <a href="mailto:support@closeos.fr" className="group block p-6 rounded-2xl border border-white/10 bg-slate-900/50 hover:bg-slate-800 transition-all hover:scale-[1.02] text-left">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20 group-hover:text-amber-300 transition-colors">
                        <Mail className="h-6 w-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-lg">Email Support</h4>
                        <p className="text-sm text-slate-400">Réponse sous 24h ouvrées</p>
                      </div>
                    </div>
                    <ExternalLink className="h-5 w-5 text-slate-500 group-hover:text-white" />
                  </div>
                </a>

                <a href="#" className="group block p-6 rounded-2xl border border-white/10 bg-slate-900/50 hover:bg-slate-800 transition-all hover:scale-[1.02] text-left">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20 group-hover:text-purple-300 transition-colors">
                        <AlertCircle className="h-6 w-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-lg">Centre d'aide & FAQ</h4>
                        <p className="text-sm text-slate-400">Guides et tutoriels (Bientôt disponible)</p>
                      </div>
                    </div>
                    <ExternalLink className="h-5 w-5 text-slate-500 group-hover:text-white" />
                  </div>
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
