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
  CreditCard,
  Headphones,
  ExternalLink,
  Mail,
  Camera,
  Trash2,
  ZoomIn,
  ZoomOut,
  ArrowUpRight,
  Database,
  Heart,
  Gift,
  Copy,
  Users,
  Building2,
  LogOut,
  Link
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useUpgrade } from '../../contexts/UpgradeContext'
import { useLanguage, type Lang } from '../../contexts/LanguageContext'
import { settingsTranslations } from '../../i18n/translations'
import { supabase } from '../../lib/supabase'
import Cropper from 'react-easy-crop'
import getCroppedImg from '../../lib/image-crop'
import { DataExportContent } from '../DataExportContent'
import { DeletionModal } from './DeletionModal'
import { CancellationRetentionModal } from './CancellationRetentionModal'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: 'profile' | 'security' | 'subscription' | 'referral' | 'support' | 'delete_account' | 'data' | 'organization'
}

type TabType = 'profile' | 'security' | 'subscription' | 'referral' | 'support' | 'delete_account' | 'data' | 'organization'

export function SettingsModal({ isOpen, onClose, initialTab = 'profile' }: SettingsModalProps) {
  const { user, profile, updateProfile, updatePassword, isFounder, isPaying, refreshProfile } = useAuth()
  const { lang, setLang } = useLanguage()
  const st = settingsTranslations[lang]

  const [activeTab, setActiveTab] = useState<TabType>(initialTab)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [isDeletionModalOpen, setIsDeletionModalOpen] = useState(false)
  const [isCancellationModalOpen, setIsCancellationModalOpen] = useState(false)
  const [isReactivateModalOpen, setIsReactivateModalOpen] = useState(false)
  const [reactivating, setReactivating] = useState(false)
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false)
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null)
  const [message, setMessage] = useState({ type: '', text: '' })
  const fileInputRef = useRef<HTMLInputElement>(null)

  // States pour le parrainage
  const [referralStats, setReferralStats] = useState({ total: 0, active: 0 })
  const [codeCopied, setCodeCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  // States pour l'organisation
  const [orgData, setOrgData] = useState<any>(null)
  const [orgLoading, setOrgLoading] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [joinError, setJoinError] = useState('')
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)

  // States pour le crop
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    role: '',
    newPassword: '',
    confirmPassword: '',
    currentPassword: '', // AJOUT

    avatar_url: '',
    deletion_scheduled_at: null as string | null
  })

  useEffect(() => {
    const fetchProfileData = async () => {
      if (user && isOpen) {
        // Retrait de timezone du select
        const { data } = await supabase
          .from('profiles')
          .select('full_name, phone, role, avatar_url, deletion_scheduled_at')
          .eq('id', user.id)
          .single()

        setFormData(prev => ({
          ...prev,
          full_name: data?.full_name || user.user_metadata?.full_name || '',
          phone: data?.phone || user.user_metadata?.phone || '',
          role: data?.role || user.user_metadata?.role || '',
          avatar_url: data?.avatar_url || user.user_metadata?.avatar_url || '',
          deletion_scheduled_at: data?.deletion_scheduled_at || null
        }))
      }
      setMessage({ type: '', text: '' })
    }
    fetchProfileData()
  }, [user, isOpen, activeTab])

  // Fetch referral stats
  useEffect(() => {
    if (!user || !isOpen || activeTab !== 'referral') return
    supabase
      .from('referrals')
      .select('id, status')
      .eq('referrer_id', user.id)
      .then(({ data }) => {
        if (data) {
          setReferralStats({
            total: data.length,
            active: data.filter(r => r.status === 'active').length,
          })
        }
      })
  }, [user, isOpen, activeTab])

  // Fetch subscription cancellation status from Stripe
  useEffect(() => {
    if (!user || !isOpen || activeTab !== 'subscription' || !isPaying) return
    fetch('/api/subscription-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id })
    })
      .then(r => r.json())
      .then(data => {
        setCancelAtPeriodEnd(!!data.cancel_at_period_end)
        setCurrentPeriodEnd(data.current_period_end || null)
      })
      .catch(() => {})
  }, [user, isOpen, activeTab, isPaying])

  // Fetch organization data
  useEffect(() => {
    if (!user || !isOpen || activeTab !== 'organization') return
    setOrgLoading(true)
    fetch('/api/organization?action=get', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id })
    })
      .then(r => r.json())
      .then(data => setOrgData(data.organization || null))
      .catch(() => setOrgData(null))
      .finally(() => setOrgLoading(false))
  }, [user, isOpen, activeTab])

  const handleJoinOrganization = async () => {
    if (!user || !inviteLink.trim()) return
    setJoinError('')
    setOrgLoading(true)

    // Extract token from link
    const match = inviteLink.trim().match(/invitation\/([a-f0-9]+)/)
    const token = match?.[1]
    if (!token) {
      setJoinError('Lien d\'invitation invalide. Le format attendu est : .../business/invitation/{token}')
      setOrgLoading(false)
      return
    }

    try {
      const res = await fetch('/api/organization?action=join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, user_id: user.id })
      })
      const data = await res.json()

      // Payment required for extra org — redirect to Stripe
      if (res.status === 402 && data.payment_required) {
        const checkoutRes = await fetch('/api/organization?action=org-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, user_id: user.id })
        })
        const checkoutData = await checkoutRes.json()
        if (checkoutData.url) {
          window.location.href = checkoutData.url
          return
        }
        setJoinError(checkoutData.error || 'Erreur lors de la création du paiement.')
        return
      }

      if (!res.ok) {
        setJoinError(data.error || 'Erreur lors de la tentative de rejoindre l\'organisation.')
        return
      }
      setOrgData(data.organization)
      setInviteLink('')
      refreshProfile()
    } catch {
      setJoinError('Erreur réseau. Veuillez réessayer.')
    } finally {
      setOrgLoading(false)
    }
  }

  const handleLeaveOrganization = async () => {
    if (!user) return
    setOrgLoading(true)
    try {
      const res = await fetch('/api/organization?action=leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id })
      })
      if (res.ok) {
        setOrgData(null)
        setShowLeaveConfirm(false)
        await refreshProfile()
        // Force page reload to clear all org state (OrganizationContext, isBusinessUser, etc.)
        window.location.reload()
      }
    } catch {
      // silent
    } finally {
      setOrgLoading(false)
    }
  }

  const handleReactivate = async () => {
    if (!user) return
    setReactivating(true)
    try {
      const res = await fetch('/api/reactivate-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCancelAtPeriodEnd(false)
      setIsReactivateModalOpen(false)
      setMessage({ type: 'success', text: lang === 'fr' ? 'Votre abonnement a été réactivé !' : 'Your subscription has been reactivated!' })
      refreshProfile()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || (lang === 'fr' ? 'Erreur lors de la réactivation' : 'Error during reactivation') })
      setIsReactivateModalOpen(false)
    } finally {
      setReactivating(false)
    }
  }

  // Reset tab when opening
  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab)
    }
  }, [isOpen, initialTab])

  if (!isOpen) return null

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const imageDataUrl = await readFile(file);
      setImageSrc(imageDataUrl as string);
      // Reset value to allow re-selecting the same file if needed
      e.target.value = '';
    }
  };

  const readFile = (file: File) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(reader.result), false);
      reader.readAsDataURL(file);
    });
  };

  const onCropComplete = (_: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const showCroppedImage = async () => {
    if (!croppedAreaPixels || !imageSrc || !user?.id) return;

    setUploading(true)
    setMessage({ type: '', text: '' })

    try {
      const croppedImageBlob = await getCroppedImg(
        imageSrc,
        croppedAreaPixels
      );

      if (!croppedImageBlob) {
        throw new Error("Erreur lors de la création de l'image.");
      }

      const fileName = `${user.id}-${Math.random()}.jpg`;
      const file = new File([croppedImageBlob], fileName, { type: "image/jpeg" });

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      const publicUrl = urlData.publicUrl

      // Update profiles table directly (single source of truth)
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id)

      if (updateError) throw updateError

      // Update auth metadata separately (non-blocking)
      supabase.auth.updateUser({ data: { avatar_url: publicUrl } }).catch(() => {})

      // Sync avatar to business_team_members if in an org (non-blocking)
      if (profile?.business_member_id) {
        supabase.from('business_team_members').update({ avatar_url: publicUrl }).eq('id', profile.business_member_id).then(() => {})
      }

      setFormData(prev => ({ ...prev, avatar_url: publicUrl }))
      setMessage({ type: 'success', text: lang === 'fr' ? 'Photo de profil mise à jour !' : 'Profile picture updated!' })
      setImageSrc(null); // Close cropper

    } catch (error: any) {
      console.error('Erreur upload:', error)
      setMessage({ type: 'error', text: lang === 'fr' ? 'Erreur lors de l\'upload de l\'image.' : 'Error uploading image.' })
    } finally {
      setUploading(false)
    }
  }

  const handleCancelCrop = () => {
    setImageSrc(null);
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    // Retrait de timezone de l'update
    const { error } = await updateProfile({
      full_name: formData.full_name,
      phone: formData.phone,
      role: formData.role,
      avatar_url: formData.avatar_url
    })

    let dbErrorMsg = null;
    if (!error && user) {
      const { error: dbError } = await supabase.from('profiles').update({
        full_name: formData.full_name,
        phone: formData.phone,
        role: formData.role
      }).eq('id', user.id)
      if (dbError) dbErrorMsg = dbError.message;
    }

    if (error || dbErrorMsg) {
      const finalError = error?.message || dbErrorMsg;
      setMessage({ type: 'error', text: finalError })
      window.alert(lang === 'fr' ? "Il y a une erreur : " + finalError : "An error occurred: " + finalError)
    }
    else {
      setMessage({ type: 'success', text: lang === 'fr' ? 'Profil mis à jour avec succès !' : 'Profile updated successfully!' })
      window.alert(lang === 'fr' ? "Fait avec succès !" : "Done successfully!")
    }
    setLoading(false)
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.newPassword !== formData.confirmPassword) {
      setMessage({ type: 'error', text: lang === 'fr' ? 'Les mots de passe ne correspondent pas.' : 'Passwords do not match.' })
      return
    }
    if (!formData.currentPassword) {
      setMessage({ type: 'error', text: lang === 'fr' ? 'Veuillez entrer votre mot de passe actuel.' : 'Please enter your current password.' })
      return
    }

    setLoading(true)
    setMessage({ type: '', text: '' })

    try {
      // 1. Vérifier le mot de passe actuel
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: formData.currentPassword
      });

      if (signInError) {
        throw new Error(lang === 'fr' ? 'Mot de passe actuel incorrect.' : 'Current password is incorrect.');
      }

      // 2. Mettre à jour le mot de passe
      const { error: updateError } = await updatePassword(formData.newPassword)

      if (updateError) throw updateError;

      // 3. Envoyer notification de sécurité
      await fetch('/api/notify-password-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user?.email })
      });

      setMessage({ type: 'success', text: lang === 'fr' ? 'Mot de passe modifié avec succès ! Un email de sécurité a été envoyé.' : 'Password changed successfully! A security email has been sent.' })
      setFormData(prev => ({ ...prev, newPassword: '', confirmPassword: '', currentPassword: '' }))

    } catch (error: any) {
      console.error(error);
      setMessage({ type: 'error', text: error.message || (lang === 'fr' ? "Erreur lors de la mise à jour." : "Error during update.") })
    } finally {
      setLoading(false)
    }
  }



  const handleCancelDeletion = async () => {
    if (!window.confirm(lang === 'fr' ? "Voulez-vous vraiment annuler la suppression de votre compte ?" : "Are you sure you want to cancel your account deletion?")) return;

    setLoading(true);
    try {
      const response = await fetch('/api/cancel-deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id })
      });

      if (!response.ok) throw new Error(lang === 'fr' ? 'Erreur lors de l\'annulation' : 'Error during cancellation');

      setFormData(prev => ({ ...prev, deletion_scheduled_at: null }));
      setMessage({ type: 'success', text: lang === 'fr' ? 'La demande de suppression a été annulée.' : 'The deletion request has been cancelled.' });
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: lang === 'fr' ? 'Impossible d\'annuler la suppression.' : 'Unable to cancel deletion.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeletionModalOpen(true);
  }

  const isGoogleUser = user?.app_metadata?.provider === 'google'

  const tabButtonClass = (tabName: string) => `
    w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all
    ${activeTab === tabName
      ? 'bg-white/5 text-emerald-400 border border-white/5'
      : 'text-white/40 hover:text-white hover:bg-white/5 border border-transparent'}
  `

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">

      {/* CROPPER OVERLAY */}
      {imageSrc && (
        <div className="absolute inset-0 z-[200] bg-black flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-lg h-[400px] relative rounded-2xl overflow-hidden border border-white/[0.08] bg-white/[0.03] backdrop-blur-2xl mb-6">
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
              <ZoomOut className="h-5 w-5 text-white/40" />
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                aria-labelledby="Zoom"
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full h-2 bg-white/5 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <ZoomIn className="h-5 w-5 text-white/40" />
            </div>

            <div className="flex gap-4 justify-center">
              <button
                onClick={handleCancelCrop}
                disabled={uploading}
                className="px-6 py-3 rounded-full border border-white/[0.08] text-white/80 font-bold hover:bg-white/10 transition-colors flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Annuler
              </button>
              <button
                onClick={showCroppedImage}
                disabled={uploading}
                className="px-6 py-3 rounded-full bg-emerald-500 text-black font-bold hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/25 flex items-center gap-2"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Valider la photo
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="w-full max-w-5xl rounded-2xl border border-white/[0.08] bg-[#1a1a1a] shadow-[0_20px_40px_rgba(0,0,0,0.2)] overflow-hidden flex flex-col md:flex-row h-[700px] relative">

        {/* Background Gradients */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-emerald-500/5 blur-[100px] rounded-full" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-purple-600/5 blur-[100px] rounded-full" />
        </div>

        {/* SIDEBAR GAUCHE */}
        <div className="w-full md:w-72 bg-white/[0.03] p-6 flex flex-col backdrop-blur-[16px] z-10">
          <div className="flex items-center gap-3 mb-10 px-2">
            <div className="h-9 w-9 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <User className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-xl font-extrabold text-white">{st.title}</h2>
          </div>

          <nav className="space-y-1 flex-1">
            <p className="px-4 text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">{st.tab_account}</p>
            <button onClick={() => setActiveTab('profile')} className={tabButtonClass('profile')}>
              <User className="w-4 h-4" /> {st.tab_profile}
            </button>

            {/* RETRAIT DU BOUTON FUSEAU HORAIRE ICI */}
            <button onClick={() => setActiveTab('security')} className={tabButtonClass('security')}>
              <Lock className="w-4 h-4" /> {st.tab_security}
            </button>
            <button onClick={() => setActiveTab('delete_account')} className={tabButtonClass('delete_account')}>
              <Trash2 className="w-4 h-4 text-red-400" /> {st.tab_deletion}
            </button>

            <button onClick={() => setActiveTab('organization')} className={tabButtonClass('organization')}>
              <Building2 className="w-4 h-4" /> {st.tab_organization}
            </button>

            <div className="my-5 mx-4" />

            <p className="px-4 text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">{st.tab_subscription_group}</p>
            <button onClick={() => setActiveTab('subscription')} className={tabButtonClass('subscription')}>
              <CreditCard className="w-4 h-4" /> {st.tab_subscription}
            </button>
            <button onClick={() => setActiveTab('referral')} className={tabButtonClass('referral')}>
              <Gift className="w-4 h-4" /> {st.tab_referral}
            </button>

            <div className="my-5 mx-4" />

            <p className="px-4 text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">{st.tab_data_group}</p>
            <button onClick={() => setActiveTab('data')} className={tabButtonClass('data')}>
              <Database className="w-4 h-4" /> {st.tab_data}
            </button>

            <div className="my-5 mx-4" />

            <p className="px-4 text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">{st.tab_help}</p>
            <button onClick={() => setActiveTab('support')} className={tabButtonClass('support')}>
              <Headphones className="w-4 h-4" /> {st.tab_support}
            </button>
          </nav>

          <button onClick={onClose} className="mt-auto flex items-center gap-3 px-4 py-3.5 text-white/40 hover:text-white font-bold transition-all rounded-2xl hover:bg-white/5 border border-transparent hover:border-white/5">
            <X className="w-4 h-4" /> {st.close}
          </button>
        </div>

        {/* ZONE DE CONTENU DROITE */}
        <div className="flex-1 flex flex-col bg-[#111111]/50 backdrop-blur-sm overflow-hidden text-left z-10 relative">
          <div className="px-10 py-8 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-extrabold text-white text-left">
                {activeTab === 'profile' && st.profile_title}

                {/* Retrait du titre Fuseau Horaire */}
                {activeTab === 'security' && st.security_title}
                {activeTab === 'subscription' && st.subscription_title}
                {activeTab === 'referral' && st.referral_title}
                {activeTab === 'support' && st.support_title}
                {activeTab === 'delete_account' && st.delete_title}
                {activeTab === 'data' && st.data_title}
                {activeTab === 'organization' && st.org_title}
              </h2>
              <p className="text-white/40 text-sm mt-1 text-left">
                {activeTab === 'profile' && st.profile_subtitle}

                {/* Retrait de la description Fuseau Horaire */}
                {activeTab === 'security' && st.security_subtitle}
                {activeTab === 'subscription' && st.subscription_subtitle}
                {activeTab === 'referral' && st.referral_subtitle}
                {activeTab === 'support' && st.support_subtitle}
                {activeTab === 'delete_account' && st.delete_subtitle}
                {activeTab === 'data' && st.data_subtitle}
                {activeTab === 'organization' && st.org_subtitle}
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-10 custom-scrollbar text-left">
            {message.text && (
              <div className={`mb-8 flex items-center gap-3 p-4 rounded-xl border ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`}>
                {message.type === 'success' ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
                <p className="font-medium text-sm">{message.text}</p>
              </div>
            )}

            {/* --- ONGLET PROFIL --- */}
            {activeTab === 'profile' && (
              <form onSubmit={handleUpdateProfile} className="max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
                <section className="rounded-2xl bg-white/[0.03] backdrop-blur-[16px] border border-white/[0.08] shadow-[0_20px_40px_rgba(0,0,0,0.2)] p-10">
                {/* SECTION AVATAR MODIFIABLE */}
                <div className="flex items-center gap-6 p-6 rounded-2xl bg-white/5 border border-white/5 mb-10">
                  <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={onFileChange}
                      className="hidden"
                      accept="image/jpeg, image/png, image/webp"
                      disabled={uploading}
                    />

                    <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-emerald-500/30 shadow-xl shadow-emerald-500/20 group-hover:border-emerald-500 transition-all">
                      {formData.avatar_url ? (
                        <img src={formData.avatar_url} alt="Profil" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-3xl font-bold text-white">
                          {formData.full_name?.[0] || 'U'}
                        </div>
                      )}
                    </div>

                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      {uploading ? (
                        <Loader2 className="h-6 w-6 text-white animate-spin" />
                      ) : (
                        <Camera className="h-6 w-6 text-white" />
                      )}
                    </div>
                  </div>

                  <div className="text-left">
                    <h3 className="font-bold text-white text-sm">Photo de profil</h3>
                    <p className="text-xs text-white/40 mt-0.5">
                      {uploading ? 'Téléchargement en cours...' : 'Cliquez sur l\'image pour la modifier (JPG, PNG).'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-1 col-span-2">
                    <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Nom complet</label>
                    <input
                      type="text"
                      disabled
                      value={formData.full_name}
                      className="w-full bg-transparent border-b border-white/10 py-2 text-white/40 cursor-not-allowed outline-none transition-all font-medium text-left"
                    />
                    <div className="flex items-start gap-2 mt-2 px-1">
                      <AlertCircle className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
                      <p className="text-[11px] text-emerald-300/80 leading-relaxed text-left">Le nom est verrouillé pour garantir la stabilité de vos liens.</p>
                    </div>
                  </div>

                  <div className="space-y-1 text-left">
                    <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Numéro de téléphone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full bg-transparent border-b border-white/10 focus:border-emerald-500 transition-colors py-2 text-white font-medium focus:ring-0 outline-none text-left"
                      placeholder="+33 6 00 00 00 00"
                    />
                  </div>

                  <div className="space-y-1 text-left">
                    <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Spécialité / Rôle</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full bg-transparent border-b border-white/10 focus:border-emerald-500 transition-colors py-2 text-white font-medium focus:ring-0 outline-none cursor-pointer appearance-none text-left"
                    >
                      <option value="Closer">Closer</option>
                      <option value="Setter">Setter</option>
                      <option value="Setter-Closer">Setter-Closer</option>
                    </select>
                  </div>
                </div>

                {/* Language selector */}
                <div className="mt-8 space-y-1 text-left">
                  <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">{st.language}</label>
                  <div className="flex gap-3 mt-2">
                    <button
                      type="button"
                      onClick={() => setLang('fr')}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-medium text-sm transition-all ${lang === 'fr' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'}`}
                    >
                      🇫🇷 {st.language_fr}
                    </button>
                    <button
                      type="button"
                      onClick={() => setLang('en')}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-medium text-sm transition-all ${lang === 'en' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'}`}
                    >
                      🇬🇧 {st.language_en}
                    </button>
                  </div>
                </div>

                <div className="mt-10">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-black px-8 py-3.5 rounded-full font-bold flex items-center justify-center gap-3 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
                  {st.save}
                </button>
                </div>
                </section>
              </form>
            )}



            {/* RETRAIT DE LA SECTION ONGLET FUSEAU HORAIRE ICI */}

            {/* --- ONGLET SÉCURITÉ --- */}
            {activeTab === 'security' && (
              <div className="max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
                <section className="rounded-2xl bg-white/[0.03] backdrop-blur-[16px] border border-white/[0.08] shadow-[0_20px_40px_rgba(0,0,0,0.2)] p-10">
                {isGoogleUser ? (
                  <div className="flex items-center justify-between p-6 rounded-2xl bg-white/5 border border-white/5 text-left">
                    <div className="flex items-center gap-4">
                      <Shield className="h-5 w-5 text-emerald-400 shrink-0" />
                      <div>
                        <p className="font-bold text-white text-sm text-left">Authentification Google active</p>
                        <p className="text-white/40 text-xs mt-0.5 text-left">Votre compte est sécurisé par Google. La gestion du mot de passe se fait via Google.</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleUpdatePassword} className="space-y-8 text-left">
                    <div className="space-y-1 text-left">
                      <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold text-left block">Mot de passe actuel (Requis)</label>
                      <input
                        type="password"
                        value={formData.currentPassword}
                        onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                        className="w-full bg-transparent border-b border-white/10 focus:border-emerald-500 transition-colors py-2 text-white font-medium focus:ring-0 outline-none text-left"
                        placeholder="Votre mot de passe actuel"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-1 text-left">
                      <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold text-left block">Nouveau mot de passe</label>
                      <input
                        type="password"
                        value={formData.newPassword}
                        onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                        className="w-full bg-transparent border-b border-white/10 focus:border-emerald-500 transition-colors py-2 text-white font-medium focus:ring-0 outline-none text-left"
                        placeholder="8 caractères minimum"
                        minLength={8}
                      />
                    </div>
                    <div className="space-y-1 text-left">
                      <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold text-left block">Confirmer le mot de passe</label>
                      <input
                        type="password"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        className="w-full bg-transparent border-b border-white/10 focus:border-emerald-500 transition-colors py-2 text-white font-medium focus:ring-0 outline-none text-left"
                        placeholder="Répétez le mot de passe"
                        minLength={8}
                      />
                    </div>
                    </div>
                    <button
                      type="submit"
                      disabled={loading || !formData.newPassword || !formData.confirmPassword || !formData.currentPassword}
                      className="w-full bg-white text-black px-8 py-3.5 rounded-full font-bold flex items-center justify-center gap-2 transition-colors hover:bg-white/90 disabled:opacity-50 text-left"
                    >
                      {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Shield className="h-5 w-5" />}
                      Mettre à jour le mot de passe
                    </button>
                  </form>
                )}
                </section>
              </div>
            )}

            {/* --- ONGLET SUPPRESSION --- */}
            {activeTab === 'delete_account' && (
              <div className="max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
                <section className="p-10 border border-red-500/20 bg-red-500/5 rounded-2xl space-y-8 text-left shadow-[0_20px_40px_rgba(0,0,0,0.2)]">
                  <div className="flex items-center gap-4 text-red-400 text-left">
                    <AlertCircle className="h-6 w-6 text-left" />
                    <h3 className="text-2xl font-extrabold text-left">Zone de danger</h3>
                  </div>
                  <div className="space-y-4">
                    <p className="text-white/40 leading-relaxed text-left">
                      La suppression est irréversible. Vous pourrez sélectionner si vous souhaitez supprimer vos données de facturation, contacts internes ou externes avant de valider.
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
                      className="flex items-center justify-center w-full gap-3 px-6 py-4 bg-white/[0.03] hover:bg-white/10 text-white rounded-full font-bold transition-all border border-white/[0.08]"
                    >
                      {loading ? <Loader2 className="animate-spin h-5 w-5" /> : "Annuler la demande de suppression"}
                    </button>
                  ) : (
                    <button
                      onClick={handleDeleteAccount}
                      className="flex items-center justify-center w-full gap-3 px-8 py-3.5 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white rounded-full font-bold transition-all border border-red-600/20 text-left"
                    >
                      <Trash2 className="h-5 w-5 text-left" />
                      Supprimer mon compte et mes données
                    </button>
                  )}
                </section>
              </div>
            )}

            {/* --- ONGLET DONNÉES --- */}
            {activeTab === 'data' && (
              <div className="max-w-xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
                <DataExportContent />
              </div>
            )}

            {/* --- ONGLET ABONNEMENT --- */}
            {activeTab === 'subscription' && (
              <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
                {/* Plan actuel */}
                <div className="p-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-purple-600/20 border border-emerald-500/30 relative overflow-hidden text-left shadow-[0_20px_40px_rgba(0,0,0,0.2)]">
                  <div className="absolute top-0 right-0 p-3 opacity-10">
                    <CreditCard className="w-32 h-32 text-white" />
                  </div>
                  <div className="relative z-10 text-left">
                    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 ${cancelAtPeriodEnd ? 'bg-orange-500/20 border border-orange-500/30 text-orange-300' : isPaying ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300' : 'bg-white/5 border border-white/[0.08] text-white/60'}`}>
                      <span className={`w-2 h-2 rounded-full ${cancelAtPeriodEnd ? 'bg-orange-400 animate-pulse' : isPaying ? 'bg-emerald-400 animate-pulse' : 'bg-white/40'}`}></span>
                      {cancelAtPeriodEnd ? 'Annulation programmée' : isPaying ? 'Plan Actif' : 'Aucun abonnement'}
                    </span>
                    <h3 className="text-3xl font-bold text-white mb-1">
                      {isFounder ? 'Pack Pro' : 'Aucun plan'}
                    </h3>
                    {profile?.billing_cycle && (
                      <p className="text-white/40 text-sm mb-1">
                        Facturation {profile.billing_cycle === 'yearly' ? 'annuelle' : 'mensuelle'}
                      </p>
                    )}
                    {profile?.current_period_end && (
                      <p className="text-white/40 text-xs">
                        Prochaine échéance : {new Date(profile.current_period_end).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                </div>


                {/* Annulation programmée — info + réactivation */}
                {isPaying && cancelAtPeriodEnd && (
                  <div className="p-6 rounded-2xl bg-orange-500/10 border border-orange-500/20 space-y-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-white font-bold text-sm">
                          {currentPeriodEnd
                            ? `Votre abonnement prend fin le ${new Date(currentPeriodEnd).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`
                            : 'Votre abonnement est en cours d\'annulation'}
                        </p>
                        <p className="text-white/40 text-xs mt-1">Après cette date, vous perdrez l'accès à toutes les fonctionnalités.</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsReactivateModalOpen(true)}
                      className="w-full px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black rounded-full font-bold transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2"
                    >
                      <Heart className="h-4 w-4" />
                      J'ai changé d'avis
                    </button>
                  </div>
                )}

                {/* Annulation — visible si abonné et pas en cours d'annulation */}
                {isPaying && !cancelAtPeriodEnd && (
                  <button
                    onClick={() => setIsCancellationModalOpen(true)}
                    className="w-full px-6 py-4 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white rounded-full font-bold transition-all border border-red-600/20 flex items-center justify-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Annuler mon abonnement
                  </button>
                )}

                <p className="text-center text-[11px] text-white/40">
                  Paiement sécurisé par Stripe. Annulation possible à tout moment.
                </p>
              </div>
            )}

            {/* --- ONGLET PARRAINAGE --- */}
            {activeTab === 'referral' && (
              <div className="max-w-xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 text-left relative">
                {!isPaying && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-[#111111]/60 backdrop-blur-md border border-white/[0.08]">
                    <p className="text-white font-bold text-lg text-center px-6">
                      Accessible à la fin de votre période d'essai
                    </p>
                  </div>
                )}
                
                <div className={!isPaying ? "space-y-8 blur-[8px] select-none pointer-events-none" : "space-y-8"}>
                  {/* Avantages */}
                <div className="p-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 shadow-[0_20px_40px_rgba(0,0,0,0.2)]">
                  <h3 className="text-white font-bold text-base mb-3 flex items-center gap-2">
                    <Gift className="h-5 w-5 text-emerald-400" />
                    Comment ça marche ?
                  </h3>
                  <div className="space-y-2 text-sm text-white/60">
                    <p><strong className="text-white">Pour vous :</strong> -7€/mois pendant 2 mois par filleul (mensuel) ou 1 mois offert (annuel). Cumulable, plancher 18€/mois.</p>
                    <p><strong className="text-white">Pour votre filleul (mensuel) :</strong> -10€/mois pendant 2 mois (24€/mois au lieu de 34€).</p>
                    <p><strong className="text-white">Pour votre filleul (annuel) :</strong> -30% sur l'abonnement annuel (285€ au lieu de 408€, soit 23,75€/mois toute l'année).</p>
                  </div>
                </div>

                {/* Code de parrainage */}
                <div className="p-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-[16px] shadow-[0_20px_40px_rgba(0,0,0,0.2)]">
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3">Votre code de parrainage</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-[#111111] border border-white/[0.08] rounded-lg px-4 py-3 text-white font-mono text-lg font-bold tracking-widest">
                      {profile?.own_referral_code || '...'}
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(profile?.own_referral_code || '')
                        setCodeCopied(true)
                        setTimeout(() => setCodeCopied(false), 2000)
                      }}
                      className="px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-all flex items-center gap-2 text-sm font-bold"
                    >
                      {codeCopied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                      {codeCopied ? 'Copié' : 'Copier'}
                    </button>
                  </div>
                </div>

                {/* Lien de parrainage */}
                <div className="p-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-[16px] shadow-[0_20px_40px_rgba(0,0,0,0.2)]">
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3">Votre lien de parrainage</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-[#111111] border border-white/[0.08] rounded-lg px-4 py-3 text-white/60 text-sm truncate">
                      {`https://closeos.fr?ref=${profile?.own_referral_code || ''}`}
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`https://closeos.fr?ref=${profile?.own_referral_code || ''}`)
                        setLinkCopied(true)
                        setTimeout(() => setLinkCopied(false), 2000)
                      }}
                      className="px-4 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black transition-all flex items-center gap-2 text-sm font-bold shrink-0"
                    >
                      {linkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {linkCopied ? 'Copié' : 'Copier'}
                    </button>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="p-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-[16px] text-center shadow-[0_20px_40px_rgba(0,0,0,0.2)]">
                    <Users className="h-6 w-6 text-emerald-400 mx-auto mb-3" />
                    <p className="text-3xl font-black text-white">{referralStats.total}</p>
                    <p className="text-xs text-white/40 mt-1">Filleuls total</p>
                  </div>
                  <div className="p-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 text-center shadow-[0_20px_40px_rgba(0,0,0,0.2)]">
                    <Gift className="h-6 w-6 text-emerald-400 mx-auto mb-3" />
                    <p className="text-3xl font-black text-white">{referralStats.active}</p>
                    <p className="text-xs text-white/40 mt-1">Réductions actives</p>
                  </div>
                </div>

                <p className="text-xs text-white/40 text-center">
                  Le filleul peut utiliser votre code lors du paiement, ou simplement s'inscrire via votre lien.
                </p>
                </div>
              </div>
            )}

            {/* --- ONGLET ORGANISATION --- */}
            {activeTab === 'organization' && (
              <div className="max-w-xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
                {orgLoading && !orgData ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
                  </div>
                ) : orgData ? (
                  /* ÉTAT 2 — Déjà dans une organisation */
                  <>
                    <div className="p-8 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-purple-600/20 border border-emerald-500/30 relative overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.2)]">
                      <div className="absolute top-0 right-0 p-3 opacity-10">
                        <Building2 className="w-24 h-24 text-white" />
                      </div>
                      <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-4">
                          {orgData.logo_url ? (
                            <img src={orgData.logo_url} alt="" className="w-12 h-12 rounded-xl object-cover border border-white/10" />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-emerald-500/30 flex items-center justify-center">
                              <Building2 className="h-6 w-6 text-emerald-300" />
                            </div>
                          )}
                          <div>
                            <h3 className="text-xl font-bold text-white">{orgData.org_name}</h3>
                            <p className="text-sm text-white/40">Dirigée par {orgData.owner_name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 border border-emerald-500/30 text-emerald-300">
                            {orgData.role}
                          </span>
                          {orgData.joined_at && (
                            <span className="text-xs text-white/40">
                              Membre depuis le {new Date(orgData.joined_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {showLeaveConfirm ? (
                      <div className="p-5 rounded-2xl border border-red-500/20 bg-red-500/5 space-y-4">
                        <p className="text-white font-bold text-sm">Êtes-vous sûr de vouloir quitter cette organisation ?</p>
                        <p className="text-white/40 text-xs">Vos prospects assignés resteront dans l'organisation mais vous ne pourrez plus y accéder.</p>
                        <div className="flex gap-3">
                          <button
                            onClick={handleLeaveOrganization}
                            disabled={orgLoading}
                            className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-full font-bold transition-all flex items-center justify-center gap-2"
                          >
                            {orgLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                            Confirmer
                          </button>
                          <button
                            onClick={() => setShowLeaveConfirm(false)}
                            className="flex-1 px-4 py-3 bg-white/[0.03] hover:bg-white/10 text-white/80 rounded-full font-bold transition-all border border-white/[0.08]"
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowLeaveConfirm(true)}
                        className="w-full px-6 py-4 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white rounded-full font-bold transition-all border border-red-600/20 flex items-center justify-center gap-2"
                      >
                        <LogOut className="h-4 w-4" />
                        Quitter l'organisation
                      </button>
                    )}

                    {/* Rejoindre une organisation supplémentaire */}
                    <div className="mt-8 p-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-[16px] shadow-[0_20px_40px_rgba(0,0,0,0.2)]">
                      <h4 className="text-sm font-bold text-white mb-1">Rejoindre une autre organisation</h4>
                      <p className="text-xs text-white/40 mb-4">Un paiement unique de 10€ est requis par organisation supplémentaire.</p>
                      <div className="flex gap-3">
                        <div className="relative flex-1">
                          <Link className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                          <input
                            type="text"
                            value={inviteLink}
                            onChange={(e) => { setInviteLink(e.target.value); setJoinError('') }}
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all text-sm"
                            placeholder="Coller le lien d'invitation ici"
                          />
                        </div>
                        <button
                          onClick={handleJoinOrganization}
                          disabled={orgLoading || !inviteLink.trim()}
                          className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black rounded-full font-bold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-2 shrink-0"
                        >
                          {orgLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          Rejoindre
                        </button>
                      </div>
                      {joinError && (
                        <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                          <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                          <p className="text-xs text-red-300">{joinError}</p>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  /* ÉTAT 1 — Pas dans une organisation */
                  <>
                    <div className="p-8 rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-[16px] shadow-[0_20px_40px_rgba(0,0,0,0.2)]">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2.5 rounded-xl bg-white/5">
                          <Building2 className="h-5 w-5 text-white/40" />
                        </div>
                        <div>
                          <h3 className="font-bold text-white">Aucune organisation</h3>
                          <p className="text-xs text-white/40">Vous n'appartenez à aucune organisation</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Lien d'invitation</label>
                        <div className="flex gap-3">
                          <div className="relative flex-1">
                            <Link className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                            <input
                              type="text"
                              value={inviteLink}
                              onChange={(e) => { setInviteLink(e.target.value); setJoinError('') }}
                              className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all text-sm"
                              placeholder="Coller le lien d'invitation ici"
                            />
                          </div>
                          <button
                            onClick={handleJoinOrganization}
                            disabled={orgLoading || !inviteLink.trim()}
                            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black rounded-full font-bold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-2 shrink-0"
                          >
                            {orgLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            Rejoindre
                          </button>
                        </div>
                        {joinError && (
                          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                            <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                            <p className="text-xs text-red-300">{joinError}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-[16px]">
                      <p className="text-xs text-white/40 leading-relaxed">
                        Demandez un lien d'invitation à votre manager ou responsable d'équipe.
                        Une fois membre, vous aurez accès au pipeline partagé, aux formules et aux KPIs de l'organisation directement depuis votre interface Sales.
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* --- ONGLET SUPPORT --- */}
            {activeTab === 'support' && (
              <div className="max-w-xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
                <a href="mailto:support@closeos.fr" className="group flex items-center justify-between p-6 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/[0.08] transition-all text-left">
                    <div className="flex items-center gap-4 text-left">
                      <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 group-hover:text-emerald-300 transition-colors text-left">
                        <Mail className="h-6 w-6 text-left" />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-white text-sm text-left">Email Support</p>
                        <p className="text-white/40 text-xs mt-0.5 text-left">Réponse sous 24h ouvrées</p>
                      </div>
                    </div>
                    <ExternalLink className="h-5 w-5 text-white/40 group-hover:text-white text-left" />
                </a>

                <a href="#" className="group flex items-center justify-between p-6 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/[0.08] transition-all text-left">
                    <div className="flex items-center gap-4 text-left">
                      <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20 group-hover:text-purple-300 transition-colors text-left">
                        <AlertCircle className="h-6 w-6 text-left" />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-white text-sm text-left">Centre d'aide & FAQ</p>
                        <p className="text-white/40 text-xs mt-0.5 text-left">Guides et tutoriels (Bientôt disponible)</p>
                      </div>
                    </div>
                    <ExternalLink className="h-5 w-5 text-white/40 group-hover:text-white text-left" />
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Reactivation Confirmation Modal */}
      {isReactivateModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#1a1a1a] shadow-[0_20px_40px_rgba(0,0,0,0.2)] p-8 text-center relative">
            <button
              onClick={() => setIsReactivateModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/[0.03] hover:bg-white/10 text-white/40 hover:text-white transition-colors border border-white/[0.08]"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-400 text-black shadow-lg shadow-emerald-500/20">
              <Heart className="h-8 w-8" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Vous restez parmi nous alors ?!</h3>
            <p className="text-white/40 text-sm mb-6">Votre abonnement sera réactivé et continuera normalement.</p>
            <div className="space-y-3">
              <button
                onClick={handleReactivate}
                disabled={reactivating}
                className="w-full px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black rounded-full font-bold transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {reactivating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                {reactivating ? 'Réactivation...' : 'Oui, je reste !'}
              </button>
              <button
                onClick={() => setIsReactivateModalOpen(false)}
                className="w-full px-6 py-3 bg-white/[0.03] hover:bg-white/10 text-white/80 rounded-full font-medium transition-all border border-white/[0.08]"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      <DeletionModal
        isOpen={isDeletionModalOpen}
        onClose={() => setIsDeletionModalOpen(false)}
        userEmail={user?.email || ''}
        userId={user?.id || ''}
        onSuccess={() => {
          // Refresh profile locally or re-fetch
          if (user) {
            supabase
              .from('profiles')
              .select('deletion_scheduled_at')
              .eq('id', user.id)
              .single()
              .then(({ data }) => {
                if (data) {
                  setFormData(prev => ({ ...prev, deletion_scheduled_at: data.deletion_scheduled_at }));
                }
              });
          }
          setMessage({ type: 'success', text: lang === 'fr' ? 'Demande de suppression enregistrée.' : 'Deletion request submitted.' });
        }}
      />

      {/* Cancellation Retention Modal */}
      <CancellationRetentionModal
        isOpen={isCancellationModalOpen}
        onClose={() => setIsCancellationModalOpen(false)}
      />
    </div>
  )
}