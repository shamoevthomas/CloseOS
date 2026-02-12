import { useState, useEffect, useRef, useCallback } from 'react'
import Cropper from 'react-easy-crop' // Import du recadreur
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
  Camera
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

// Fonction utilitaire pour créer l'image recadrée (Canvas)
const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.setAttribute('crossOrigin', 'anonymous')
    image.src = url
  })

const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<Blob> => {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) throw new Error('No 2d context')

  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  )

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
    }, 'image/jpeg')
  })
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { user, updateProfile, updatePassword } = useAuth()

  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'subscription' | 'support'>('profile')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const fileInputRef = useRef<HTMLInputElement>(null)

  // États pour le recadrage
  const [imageToCrop, setImageToCrop] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)

  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    role: '',
    newPassword: '',
    avatar_url: ''
  })

  useEffect(() => {
    const fetchProfileData = async () => {
      if (user && isOpen) {
        const { data } = await supabase
          .from('profiles')
          .select('full_name, phone, role, avatar_url')
          .eq('id', user.id)
          .single()

        setFormData(prev => ({
          ...prev,
          full_name: user.user_metadata?.full_name || data?.full_name || '',
          phone: user.user_metadata?.phone || data?.phone || '',
          role: user.user_metadata?.role || data?.role || '',
          avatar_url: data?.avatar_url || ''
        }))
      }
      setMessage({ type: '', text: '' })
    }
    fetchProfileData()
  }, [user, isOpen, activeTab])

  if (!isOpen) return null

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  // Étape 1 : Sélection du fichier et ouverture du Cropper
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0]
      const reader = new FileReader()
      reader.addEventListener('load', () => {
        setImageToCrop(reader.result as string)
      })
      reader.readAsDataURL(file)
    }
  }

  const onCropComplete = useCallback((_: any, clippedAreaPixels: any) => {
    setCroppedAreaPixels(clippedAreaPixels)
  }, [])

  // Étape 2 : Recadrage final et Upload vers Supabase
  const handleConfirmCrop = async () => {
    try {
      setUploading(true)
      if (!imageToCrop || !croppedAreaPixels) return

      const croppedImageBlob = await getCroppedImg(imageToCrop, croppedAreaPixels)
      const fileName = `${user?.id}-${Math.random()}.jpg`
      const filePath = `${fileName}`

      // 1. Upload
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, croppedImageBlob)

      if (uploadError) throw uploadError

      // 2. URL Publique
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      // 3. Update Profil
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: urlData.publicUrl })
        .eq('id', user?.id)

      if (updateError) throw updateError

      setFormData(prev => ({ ...prev, avatar_url: urlData.publicUrl }))
      setImageToCrop(null) // Fermer le mode crop
      window.alert("Fait avec succès : Photo de profil mise à jour !")

    } catch (error: any) {
      window.alert("Erreur concernant la photo : " + error.message)
    } finally {
      setUploading(false)
    }
  }

  const handleManageBilling = () => {
    window.open('https://billing.stripe.com/p/login/3cI00c3qReYdd9a1wsbjW00', '_blank');
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await updateProfile({
      full_name: formData.full_name,
      phone: formData.phone,
      role: formData.role
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
        window.alert("Il y a une erreur : " + finalError)
    }
    else {
        window.alert("Fait avec succès !")
    }
    setLoading(false)
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await updatePassword(formData.newPassword)
    if (error) window.alert("Erreur : " + error.message)
    else {
      window.alert("Fait avec succès !")
      setFormData(prev => ({ ...prev, newPassword: '' }))
    }
    setLoading(false)
  }

  const isGoogleUser = user?.app_metadata?.provider === 'google'

  const tabButtonClass = (tabName: string) => `
    w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all
    ${activeTab === tabName 
      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/20' 
      : 'text-slate-400 hover:bg-white/5 hover:text-white'}
  `

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      {/* POPUP DE RECADRAGE (S'affiche par-dessus si une image est sélectionnée) */}
      {imageToCrop && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 p-4 animate-in fade-in">
          <div className="w-full max-w-xl bg-slate-900 rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
            <div className="p-6 border-b border-white/5 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Recadrer votre photo</h3>
              <button onClick={() => setImageToCrop(null)} className="text-slate-400 hover:text-white">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="relative h-80 w-full bg-black">
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                aspect={1}
                shape="round"
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>

            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider text-left block">Zoom</label>
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  aria-labelledby="Zoom"
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setImageToCrop(null)}
                  className="flex-1 px-6 py-4 rounded-xl font-bold text-slate-400 hover:bg-white/5 transition-all"
                >
                  Annuler
                </button>
                <button 
                  onClick={handleConfirmCrop}
                  disabled={uploading}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="animate-spin h-5 w-5" /> : <Check className="h-5 w-5" />}
                  Valider et Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-5xl rounded-3xl border border-white/10 bg-[#020617] shadow-2xl overflow-hidden flex flex-col md:flex-row h-[700px] relative">
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
            <button onClick={() => setActiveTab('security')} className={tabButtonClass('security')}>
              <Lock className="w-4 h-4" /> Sécurité
            </button>
            <div className="my-6 h-px bg-white/5 mx-4" />
            <p className="px-4 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Abonnement</p>
            <button onClick={() => setActiveTab('subscription')} className={tabButtonClass('subscription')}>
              <CreditCard className="w-4 h-4" /> Abonnement
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
                <h2 className="text-2xl font-bold text-white">
                {activeTab === 'profile' && 'Mon Profil'}
                {activeTab === 'security' && 'Sécurité & Connexion'}
                {activeTab === 'subscription' && 'Mon Abonnement'}
                {activeTab === 'support' && 'Centre d\'Aide'}
                </h2>
                <p className="text-slate-400 text-sm mt-1">
                {activeTab === 'profile' && 'Gérez vos informations personnelles et votre rôle.'}
                {activeTab === 'security' && 'Protégez l\'accès à votre compte CloserOS.'}
                {activeTab === 'subscription' && 'Gérez votre plan, vos factures et l\'annulation.'}
                {activeTab === 'support' && 'Une question ? Notre équipe est là pour vous.'}
                </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
            {/* --- ONGLET PROFIL --- */}
            {activeTab === 'profile' && (
              <form onSubmit={handleUpdateProfile} className="space-y-8 max-w-xl">
                <div className="flex items-center gap-6 p-6 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                  <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleAvatarUpload}
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
                        {uploading ? 'Téléchargement...' : 'Cliquez sur l\'image pour la modifier (JPG, PNG).'}
                    </p>
                  </div>
                </div>

                <div className="grid gap-6 text-left">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nom complet</label>
                    <input
                      type="text"
                      disabled
                      value={formData.full_name}
                      className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-slate-500 cursor-not-allowed outline-none transition-all font-medium"
                    />
                    <div className="flex items-start gap-2 mt-2">
                      <AlertCircle className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-blue-300/80 leading-relaxed">Le nom est verrouillé pour garantir la stabilité de vos liens.</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Numéro de téléphone</label>
                    <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white focus:border-blue-500 outline-none transition-all"
                        placeholder="+33 6 00 00 00 00"
                        />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Spécialité / Rôle</label>
                    <div className="relative">
                        <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <select
                        value={formData.role}
                        onChange={(e) => setFormData({...formData, role: e.target.value})}
                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white focus:border-blue-500 outline-none transition-all cursor-pointer appearance-none"
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
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-blue-500/20 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
                  Enregistrer les modifications
                </button>
              </form>
            )}

            {/* --- ONGLET ABONNEMENT (Inchangé) --- */}
            {activeTab === 'subscription' && (
                <div className="max-w-2xl space-y-8">
                    <div className="p-8 rounded-3xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/30">
                        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-bold uppercase mb-4">Plan Actif</span>
                        <h3 className="text-3xl font-bold text-white mb-2">Founder Edition</h3>
                        <p className="text-slate-300 mb-6 max-w-md">Gérez votre plan, vos factures et l'annulation via Stripe.</p>
                        <button onClick={handleManageBilling} className="px-6 py-3 bg-white text-slate-900 rounded-xl font-bold flex items-center gap-2">
                            <ExternalLink className="h-4 w-4" /> Gérer l'abonnement (Stripe)
                        </button>
                    </div>
                </div>
            )}

            {/* --- ONGLET SUPPORT (Inchangé) --- */}
            {activeTab === 'support' && (
                <div className="max-w-xl space-y-6">
                    <a href="mailto:support@closeos.fr" className="group block p-6 rounded-2xl border border-white/10 bg-slate-900/50 hover:bg-slate-800 transition-all">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400"><Mail className="h-6 w-6" /></div>
                                <div>
                                    <h4 className="font-bold text-white text-lg text-left">Email Support</h4>
                                    <p className="text-sm text-slate-400">Réponse sous 24h ouvrées</p>
                                </div>
                            </div>
                            <ExternalLink className="h-5 w-5 text-slate-500" />
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