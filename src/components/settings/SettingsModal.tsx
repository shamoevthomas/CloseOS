import { useState, useEffect, useRef, useMemo } from 'react'
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
  Globe, 
  Trash2,
  Search 
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase' 

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { user, updateProfile, updatePassword } = useAuth()

  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'mail' | 'timezone' | 'subscription' | 'support' | 'delete_account'>('profile')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false) 
  const [message, setMessage] = useState({ type: '', text: '' })
  const fileInputRef = useRef<HTMLInputElement>(null) 

  // États pour la recherche et le filtrage des fuseaux
  const [searchTerm, setSearchTerm] = useState('')

  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    role: '',
    newPassword: '',
    avatar_url: '',
    timezone: 'Europe/Paris'
  })

  // LOGIQUE DE GROUPEMENT PAR CONTINENT ET FILTRAGE
  const groupedTimezones = useMemo(() => {
    const allTimezones = Intl.supportedValuesOf('timeZone')
    const searchLower = searchTerm.toLowerCase()
    
    const filtered = allTimezones.filter(tz => 
      tz.toLowerCase().includes(searchLower) || 
      tz.replace(/_/g, ' ').toLowerCase().includes(searchLower)
    )

    const groups: { [key: string]: string[] } = {}
    
    filtered.forEach(tz => {
      const parts = tz.split('/')
      const continent = parts.length > 1 ? parts[0] : 'Autres'
      if (!groups[continent]) groups[continent] = []
      groups[continent].push(tz)
    })

    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [searchTerm])

  useEffect(() => {
    const fetchProfileData = async () => {
      if (user && isOpen) {
        const { data } = await supabase
          .from('profiles')
          .select('full_name, phone, role, avatar_url, timezone')
          .eq('id', user.id) // ✅ CORRECTION ICI
          .single()

        setFormData(prev => ({
          ...prev,
          full_name: user.user_metadata?.full_name || data?.full_name || '',
          phone: user.user_metadata?.phone || data?.phone || '',
          role: user.user_metadata?.role || data?.role || '',
          avatar_url: data?.avatar_url || '',
          timezone: data?.timezone || 'Europe/Paris'
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

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true)
      setMessage({ type: '', text: '' })

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('Veuillez sélectionner une image.')
      }

      const file = event.target.files[0]
      const fileExt = file.name.split('.').pop()
      const fileName = `${user?.id}-${Math.random()}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: urlData.publicUrl })
        .eq('id', user?.id) // ✅ CORRECTION ICI

      if (updateError) throw updateError

      await updateProfile({
        avatar_url: urlData.publicUrl
      })

      setFormData(prev => ({ ...prev, avatar_url: urlData.publicUrl }))
      setMessage({ type: 'success', text: 'Photo de profil mise à jour !' })
      window.alert("Fait avec succès : Photo de profil mise à jour !")

    } catch (error: any) {
      console.error('Erreur upload:', error)
      setMessage({ type: 'error', text: 'Erreur lors de l\'upload de l\'image.' })
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
      role: formData.role,
      avatar_url: formData.avatar_url,
      timezone: formData.timezone
    })
    
    let dbErrorMsg = null;
    if (!error && user) {
        const { error: dbError } = await supabase.from('profiles').update({
            full_name: formData.full_name,
            phone: formData.phone,
            role: formData.role,
            timezone: formData.timezone
        }).eq('id', user.id) // ✅ CORRECTION ICI
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
    setLoading(true)
    const { error } = await updatePassword(formData.newPassword)
    if (error) setMessage({ type: 'error', text: error.message })
    else {
      setMessage({ type: 'success', text: 'Mot de passe modifié avec succès !' })
      setFormData(prev => ({ ...prev, newPassword: '' }))
    }
    setLoading(false)
  }

  const handleDeleteAccount = async () => {
    const confirmation = window.confirm("ATTENTION : Cette action est irréversible. Toutes vos données seront supprimées. Voulez-vous continuer ?");
    if (confirmation) {
      window.alert("Pour des raisons de sécurité, veuillez contacter le support à support@closeos.fr pour finaliser la suppression de votre compte.");
    }
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
            <button onClick={() => setActiveTab('mail')} className={tabButtonClass('mail')}>
              <Mail className="w-4 h-4" /> Email
            </button>
            <button onClick={() => setActiveTab('timezone')} className={tabButtonClass('timezone')}>
              <Globe className="w-4 h-4" /> Fuseau horaire
            </button>
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
                {activeTab === 'mail' && 'Adresse Email'}
                {activeTab === 'timezone' && 'Fuseau Horaire'}
                {activeTab === 'security' && 'Sécurité & Connexion'}
                {activeTab === 'subscription' && 'Mon Abonnement'}
                {activeTab === 'support' && 'Centre d\'Aide'}
                {activeTab === 'delete_account' && 'Suppression du compte'}
                </h2>
                <p className="text-slate-400 text-sm mt-1 text-left">
                {activeTab === 'profile' && 'Gérez vos informations personnelles et votre rôle.'}
                {activeTab === 'mail' && 'Consultez l\'adresse email reliée à votre compte.'}
                {activeTab === 'timezone' && 'Réglez votre fuseau horaire pour vos rendez-vous.'}
                {activeTab === 'security' && 'Protégez l\'accès à votre compte CloserOS.'}
                {activeTab === 'subscription' && 'Gérez votre plan, vos factures et l\'annulation.'}
                {activeTab === 'support' && 'Une question ? Notre équipe est là pour vous.'}
                {activeTab === 'delete_account' && 'Zone de danger : Supprimer votre compte et vos données.'}
                </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-10 custom-scrollbar text-left">
            {message.text && (
              <div className={`mb-8 flex items-center gap-3 p-4 rounded-xl border ${
                message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
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
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
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
                        onChange={(e) => setFormData({...formData, role: e.target.value})}
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

            {/* --- ONGLET MAIL --- */}
            {activeTab === 'mail' && (
              <div className="space-y-6 max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
                <div className="space-y-2 text-left">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider text-left block">Adresse Email actuelle</label>
                  <div className="relative text-left">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                      type="email"
                      readOnly
                      value={user?.email || ''}
                      className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-slate-400 cursor-default outline-none text-left"
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-2 text-left">Pour modifier votre email, contactez le support.</p>
                </div>
              </div>
            )}

            {/* --- ONGLET FUSEAU HORAIRE (AVEC RECHERCHE ET SECTIONS) --- */}
            {activeTab === 'timezone' && (
              <form onSubmit={handleUpdateProfile} className="space-y-6 max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
                <div className="space-y-4 text-left">
                  
                  {/* BARRE DE RECHERCHE */}
                  <div className="space-y-2 text-left">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider text-left block">Rechercher un fuseau</label>
                    <div className="relative text-left">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Ex: Paris, New York, Tokyo..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white focus:border-blue-500 outline-none transition-all text-left"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 text-left">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider text-left block">Sélectionner votre fuseau</label>
                    <div className="relative text-left">
                      <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <select
                        value={formData.timezone}
                        onChange={(e) => setFormData({...formData, timezone: e.target.value})}
                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white focus:border-blue-500 outline-none cursor-pointer appearance-none text-left"
                      >
                        {groupedTimezones.map(([continent, tzs]) => (
                          <optgroup key={continent} label={continent} className="bg-slate-900 text-blue-400 font-bold uppercase tracking-widest text-[10px]">
                            {tzs.map((tz) => (
                              <option key={tz} value={tz} className="bg-slate-900 text-white font-medium capitalize text-sm py-2">
                                {tz.split('/').slice(1).join(' / ').replace(/_/g, ' ') || tz}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                    <p className="text-xs text-slate-500 text-left">Indispensable pour vos rappels et votre agenda.</p>
                  </div>
                </div>
                <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-blue-500/20">
                  {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
                  Mettre à jour le fuseau
                </button>
              </form>
            )}

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
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider text-left block">Nouveau mot de passe</label>
                      <div className="relative text-left">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <input
                            type="password"
                            value={formData.newPassword}
                            onChange={(e) => setFormData({...formData, newPassword: e.target.value})}
                            className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-left"
                            placeholder="8 caractères minimum"
                            minLength={8}
                        />
                      </div>
                    </div>
                    <button 
                      type="submit" 
                      disabled={loading || !formData.newPassword} 
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
                  <p className="text-slate-400 leading-relaxed text-left">
                    La suppression est irréversible. Toutes vos données seront effacées définitivement.
                  </p>
                  <button 
                    onClick={handleDeleteAccount}
                    className="flex items-center gap-3 px-6 py-4 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white rounded-xl font-bold transition-all border border-red-600/20 text-left"
                  >
                    <Trash2 className="h-5 w-5 text-left" />
                    Supprimer mon compte et mes données
                  </button>
                </div>
              </div>
            )}

            {/* --- ONGLET ABONNEMENT --- */}
            {activeTab === 'subscription' && (
                <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
                    <div className="p-8 rounded-3xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/30 relative overflow-hidden text-left">
                        <div className="absolute top-0 right-0 p-3 opacity-10 text-left">
                            <CreditCard className="w-32 h-32 text-white text-left" />
                        </div>
                        <div className="relative z-10 text-left">
                            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-bold uppercase tracking-wider mb-4 text-left">
                                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse text-left"></span>
                                Plan Actif
                            </span>
                            <h3 className="text-3xl font-bold text-white mb-2 text-left">Founder Edition</h3>
                            <p className="text-slate-300 mb-6 max-w-md text-left">
                                Gérez vos paiements et factures en toute sécurité via Stripe.
                            </p>
                            <button 
                                onClick={handleManageBilling}
                                className="px-6 py-3 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-200 transition-colors shadow-lg flex items-center gap-2 text-left"
                            >
                                <ExternalLink className="h-4 w-4 text-left" />
                                Gérer ou Résilier l'abonnement
                            </button>
                        </div>
                    </div>
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
    </div>
  )
}