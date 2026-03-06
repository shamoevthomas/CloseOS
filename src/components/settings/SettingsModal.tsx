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
  Heart
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useUpgrade } from '../../contexts/UpgradeContext'
import { supabase } from '../../lib/supabase'
import Cropper from 'react-easy-crop'
import getCroppedImg from '../../lib/image-crop'
import { DataExportContent } from '../DataExportContent'
import { DeletionModal } from './DeletionModal'
import { CancellationRetentionModal } from './CancellationRetentionModal'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: 'profile' | 'security' | 'subscription' | 'support' | 'delete_account' | 'data'
}

export function SettingsModal({ isOpen, onClose, initialTab = 'profile' }: SettingsModalProps) {
  const { user, profile, updateProfile, updatePassword, isFounder, isStarter, isPaying } = useAuth()
  const { showUpgrade } = useUpgrade()

  // Retrait de 'timezone' des onglets possibles
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'subscription' | 'support' | 'delete_account' | 'data'>(initialTab)
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
      setMessage({ type: 'success', text: 'Votre abonnement a été réactivé !' })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erreur lors de la réactivation' })
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

      setFormData(prev => ({ ...prev, avatar_url: publicUrl }))
      setMessage({ type: 'success', text: 'Photo de profil mise à jour !' })
      setImageSrc(null); // Close cropper

    } catch (error: any) {
      console.error('Erreur upload:', error)
      setMessage({ type: 'error', text: 'Erreur lors de l\'upload de l\'image.' })
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
      window.alert("Il y a une erreur : " + finalError)
    }
    else {
      setMessage({ type: 'success', text: 'Profil mis à jour avec succès !' })
      window.alert("Fait avec succès !")
    }
    setLoading(false)
  }

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
      // 1. Vérifier le mot de passe actuel
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: formData.currentPassword
      });

      if (signInError) {
        throw new Error('Mot de passe actuel incorrect.');
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

      setMessage({ type: 'success', text: 'Mot de passe modifié avec succès ! Un email de sécurité a été envoyé.' })
      setFormData(prev => ({ ...prev, newPassword: '', confirmPassword: '', currentPassword: '' }))

    } catch (error: any) {
      console.error(error);
      setMessage({ type: 'error', text: error.message || "Erreur lors de la mise à jour." })
    } finally {
      setLoading(false)
    }
  }



  const handleCancelDeletion = async () => {
    if (!window.confirm("Voulez-vous vraiment annuler la suppression de votre compte ?")) return;

    setLoading(true);
    try {
      const response = await fetch('/api/cancel-deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id })
      });

      if (!response.ok) throw new Error('Erreur lors de l\'annulation');

      setFormData(prev => ({ ...prev, deletion_scheduled_at: null }));
      setMessage({ type: 'success', text: 'La demande de suppression a été annulée.' });
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'Impossible d\'annuler la suppression.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeletionModalOpen(true);
  }

  const isGoogleUser = user?.app_metadata?.provider === 'google'

  const tabButtonClass = (tabName: string) => `
    w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all
    ${activeTab === tabName
      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/20'
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
                aria-labelledby="Zoom"
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <ZoomIn className="h-5 w-5 text-slate-400" />
            </div>

            <div className="flex gap-4 justify-center">
              <button
                onClick={handleCancelCrop}
                disabled={uploading}
                className="px-6 py-3 rounded-xl border border-slate-700 text-slate-300 font-bold hover:bg-slate-800 transition-colors flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Annuler
              </button>
              <button
                onClick={showCroppedImage}
                disabled={uploading}
                className="px-6 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/25 flex items-center gap-2"
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
          <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-blue-600/5 blur-[100px] rounded-full" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-purple-600/5 blur-[100px] rounded-full" />
        </div>

        {/* SIDEBAR GAUCHE */}
        <div className="w-full md:w-72 border-r border-white/5 bg-slate-900/30 p-6 flex flex-col backdrop-blur-sm z-10">
          <div className="flex items-center gap-3 mb-8 px-2">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <User className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">Paramètres</h2>
          </div>

          <nav className="space-y-2 flex-1">
            <p className="px-4 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Compte</p>
            <button onClick={() => setActiveTab('profile')} className={tabButtonClass('profile')}>
              <User className="w-4 h-4" /> Profil
            </button>

            {/* RETRAIT DU BOUTON FUSEAU HORAIRE ICI */}
            <button onClick={() => setActiveTab('security')} className={tabButtonClass('security')}>
              <Lock className="w-4 h-4" /> Sécurité
            </button>
            <button onClick={() => setActiveTab('delete_account')} className={tabButtonClass('delete_account')}>
              <Trash2 className="w-4 h-4 text-red-400" /> Suppression
            </button>

            <div className="my-6 h-px bg-white/5 mx-4" />

            <p className="px-4 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Abonnement</p>
            <button onClick={() => setActiveTab('subscription')} className={tabButtonClass('subscription')}>
              <CreditCard className="w-4 h-4" /> Abonnement
            </button>

            <div className="my-6 h-px bg-white/5 mx-4" />

            <p className="px-4 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Données</p>
            <button onClick={() => setActiveTab('data')} className={tabButtonClass('data')}>
              <Database className="w-4 h-4" /> Données
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

        {/* ZONE DE CONTENU DROITE */}
        <div className="flex-1 flex flex-col bg-[#020617]/50 backdrop-blur-sm overflow-hidden text-left z-10 relative">
          <div className="px-10 py-8 border-b border-white/5 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-white text-left">
                {activeTab === 'profile' && 'Mon Profil'}

                {/* Retrait du titre Fuseau Horaire */}
                {activeTab === 'security' && 'Sécurité & Connexion'}
                {activeTab === 'subscription' && 'Mon Abonnement'}
                {activeTab === 'support' && 'Centre d\'Aide'}
                {activeTab === 'delete_account' && 'Suppression du compte'}
                {activeTab === 'data' && 'Mes Données'}
              </h2>
              <p className="text-slate-400 text-sm mt-1 text-left">
                {activeTab === 'profile' && 'Gérez vos informations personnelles et votre rôle.'}

                {/* Retrait de la description Fuseau Horaire */}
                {activeTab === 'security' && 'Protégez l\'accès à votre compte CloserOS.'}
                {activeTab === 'subscription' && 'Gérez votre plan, vos factures et l\'annulation.'}
                {activeTab === 'support' && 'Une question ? Notre équipe est là pour vous.'}
                {activeTab === 'delete_account' && 'Zone de danger : Supprimer votre compte et vos données.'}
                {activeTab === 'data' && 'Exportez vos données au format PDF.'}
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
              <form onSubmit={handleUpdateProfile} className="space-y-8 max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">

                {/* SECTION AVATAR MODIFIABLE */}
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

                    <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-white/10 shadow-xl shadow-blue-500/20 group-hover:border-blue-500 transition-all">
                      {formData.avatar_url ? (
                        <img src={formData.avatar_url} alt="Profil" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-3xl font-bold text-white">
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
                    <h3 className="font-bold text-white text-lg">Photo de profil</h3>
                    <p className="text-sm text-slate-400 mt-1">
                      {uploading ? 'Téléchargement en cours...' : 'Cliquez sur l\'image pour la modifier (JPG, PNG).'}
                    </p>
                  </div>
                </div>

                <div className="grid gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">Nom complet</label>
                    <input
                      type="text"
                      disabled
                      value={formData.full_name}
                      className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-slate-500 cursor-not-allowed outline-none transition-all font-medium text-left"
                    />
                    <div className="flex items-start gap-2 mt-2 px-1">
                      <AlertCircle className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                      <p className="text-xs text-blue-300/80 leading-relaxed text-left">Le nom est verrouillé pour garantir la stabilité de vos liens.</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-left">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">Numéro de téléphone</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-left"
                        placeholder="+33 6 00 00 00 00"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 text-left">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">Spécialité / Rôle</label>
                    <div className="relative">
                      <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <select
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all cursor-pointer appearance-none text-left"
                      >
                        <option value="Closer">Closer</option>
                        <option value="Setter">Setter</option>
                        <option value="Setter-Closer">Setter-Closer</option>
                      </select>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 hover:scale-[1.02]"
                >
                  {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
                  Enregistrer les modifications
                </button>
              </form>
            )}



            {/* RETRAIT DE LA SECTION ONGLET FUSEAU HORAIRE ICI */}

            {/* --- ONGLET SÉCURITÉ --- */}
            {activeTab === 'security' && (
              <div className="max-w-xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
                {isGoogleUser ? (
                  <div className="p-6 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex gap-4 text-left">
                    <div className="p-3 bg-blue-500/20 rounded-xl h-fit">
                      <Shield className="h-6 w-6 text-blue-400 shrink-0" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white mb-1 text-lg text-left">Authentification Google active</h4>
                      <p className="text-sm text-blue-200/70 leading-relaxed text-left">Votre compte est sécurisé par Google. La gestion du mot de passe se fait via Google.</p>
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
                          className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-left"
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
                          className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-left"
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
                          className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-left"
                          placeholder="Répétez le mot de passe"
                          minLength={8}
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={loading || !formData.newPassword || !formData.confirmPassword || !formData.currentPassword}
                      className="w-full bg-white/5 hover:bg-white/10 text-white px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all border border-white/10 hover:border-white/20 text-left"
                    >
                      {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Shield className="h-5 w-5" />}
                      Mettre à jour le mot de passe
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* --- ONGLET SUPPRESSION --- */}
            {activeTab === 'delete_account' && (
              <div className="max-w-xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
                <div className="p-8 border border-red-500/20 bg-red-500/5 rounded-3xl space-y-6 text-left">
                  <div className="flex items-center gap-4 text-red-400 text-left">
                    <AlertCircle className="h-8 w-8 text-left" />
                    <h3 className="text-xl font-bold text-left">Zone de danger</h3>
                  </div>
                  <div className="space-y-4">
                    <p className="text-slate-400 leading-relaxed text-left">
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
                      className="flex items-center justify-center w-full gap-3 px-6 py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold transition-all border border-slate-600"
                    >
                      {loading ? <Loader2 className="animate-spin h-5 w-5" /> : "Annuler la demande de suppression"}
                    </button>
                  ) : (
                    <button
                      onClick={handleDeleteAccount}
                      className="flex items-center justify-center w-full gap-3 px-6 py-4 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white rounded-xl font-bold transition-all border border-red-600/20 text-left"
                    >
                      <Trash2 className="h-5 w-5 text-left" />
                      Supprimer mon compte et mes données
                    </button>
                  )}
                </div>
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
              <div className="max-w-2xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
                {/* Plan actuel */}
                <div className="p-8 rounded-3xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/30 relative overflow-hidden text-left">
                  <div className="absolute top-0 right-0 p-3 opacity-10">
                    <CreditCard className="w-32 h-32 text-white" />
                  </div>
                  <div className="relative z-10 text-left">
                    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 ${cancelAtPeriodEnd ? 'bg-orange-500/20 border border-orange-500/30 text-orange-300' : isPaying ? 'bg-blue-500/20 border border-blue-500/30 text-blue-300' : 'bg-slate-500/20 border border-slate-500/30 text-slate-300'}`}>
                      <span className={`w-2 h-2 rounded-full ${cancelAtPeriodEnd ? 'bg-orange-400 animate-pulse' : isPaying ? 'bg-blue-400 animate-pulse' : 'bg-slate-400'}`}></span>
                      {cancelAtPeriodEnd ? 'Annulation programmée' : isPaying ? 'Plan Actif' : 'Aucun abonnement'}
                    </span>
                    <h3 className="text-3xl font-bold text-white mb-1">
                      {isFounder ? 'Pack Founder' : isStarter ? 'Pack Starter' : 'Aucun plan'}
                    </h3>
                    {profile?.billing_cycle && (
                      <p className="text-slate-400 text-sm mb-1">
                        Facturation {profile.billing_cycle === 'yearly' ? 'annuelle' : 'mensuelle'}
                      </p>
                    )}
                    {profile?.current_period_end && (
                      <p className="text-slate-500 text-xs">
                        Prochaine échéance : {new Date(profile.current_period_end).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                </div>

                {/* Upgrade — visible pour Starter */}
                {isStarter && (
                  <button
                    onClick={() => { onClose(); showUpgrade(); }}
                    className="w-full p-5 rounded-2xl bg-gradient-to-r from-blue-600/10 to-indigo-600/10 border border-blue-500/20 hover:border-blue-500/40 transition-all flex items-center justify-between group"
                  >
                    <div className="text-left">
                      <p className="text-white font-bold text-base">Passer au Pack Founder</p>
                      <p className="text-slate-400 text-sm mt-0.5">Débloquez les KPI avancés, le Call Room, les automatisations...</p>
                    </div>
                    <div className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm group-hover:bg-blue-500 transition-colors shrink-0">
                      <ArrowUpRight className="h-4 w-4" />
                      Upgrade
                    </div>
                  </button>
                )}

                {/* Annulation programmée — info + réactivation */}
                {isPaying && cancelAtPeriodEnd && (
                  <div className="p-5 rounded-2xl bg-orange-500/10 border border-orange-500/20 space-y-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-white font-bold text-sm">
                          {currentPeriodEnd
                            ? `Votre abonnement prend fin le ${new Date(currentPeriodEnd).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`
                            : 'Votre abonnement est en cours d\'annulation'}
                        </p>
                        <p className="text-slate-400 text-xs mt-1">Après cette date, vous perdrez l'accès à toutes les fonctionnalités.</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsReactivateModalOpen(true)}
                      className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
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
                    className="w-full px-6 py-4 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white rounded-xl font-bold transition-all border border-red-600/20 flex items-center justify-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Annuler mon abonnement
                  </button>
                )}

                <p className="text-center text-[11px] text-slate-500">
                  Paiement sécurisé par Stripe. Annulation possible à tout moment.
                </p>
              </div>
            )}

            {/* --- ONGLET SUPPORT --- */}
            {activeTab === 'support' && (
              <div className="max-w-xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
                <a href="mailto:support@closeos.fr" className="group block p-6 rounded-2xl border border-white/10 bg-slate-900/50 hover:bg-slate-800 transition-all hover:scale-[1.02] text-left">
                  <div className="flex items-center justify-between text-left">
                    <div className="flex items-center gap-4 text-left">
                      <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 group-hover:text-blue-300 transition-colors text-left">
                        <Mail className="h-6 w-6 text-left" />
                      </div>
                      <div className="text-left">
                        <h4 className="font-bold text-white text-lg text-left">Email Support</h4>
                        <p className="text-sm text-slate-400 text-left">Réponse sous 24h ouvrées</p>
                      </div>
                    </div>
                    <ExternalLink className="h-5 w-5 text-slate-500 group-hover:text-white text-left" />
                  </div>
                </a>

                <a href="#" className="group block p-6 rounded-2xl border border-white/10 bg-slate-900/50 hover:bg-slate-800 transition-all hover:scale-[1.02] text-left">
                  <div className="flex items-center justify-between text-left">
                    <div className="flex items-center gap-4 text-left">
                      <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20 group-hover:text-purple-300 transition-colors text-left">
                        <AlertCircle className="h-6 w-6 text-left" />
                      </div>
                      <div className="text-left">
                        <h4 className="font-bold text-white text-lg text-left">Centre d'aide & FAQ</h4>
                        <p className="text-sm text-slate-400 text-left">Guides et tutoriels (Bientôt disponible)</p>
                      </div>
                    </div>
                    <ExternalLink className="h-5 w-5 text-slate-500 group-hover:text-white text-left" />
                  </div>
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Reactivation Confirmation Modal */}
      {isReactivateModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0B1121] shadow-2xl p-8 text-center relative">
            <button
              onClick={() => setIsReactivateModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-emerald-500 text-white shadow-lg shadow-blue-500/20">
              <Heart className="h-8 w-8" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Vous restez parmi nous alors ?!</h3>
            <p className="text-slate-400 text-sm mb-6">Votre abonnement sera réactivé et continuera normalement.</p>
            <div className="space-y-3">
              <button
                onClick={handleReactivate}
                disabled={reactivating}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-white rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {reactivating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                {reactivating ? 'Réactivation...' : 'Oui, je reste !'}
              </button>
              <button
                onClick={() => setIsReactivateModalOpen(false)}
                className="w-full px-6 py-3 bg-slate-800/50 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition-all border border-slate-700"
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
          setMessage({ type: 'success', text: 'Demande de suppression enregistrée.' });
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