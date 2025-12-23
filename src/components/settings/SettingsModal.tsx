import { useState, useEffect } from 'react'
import { X, Shield, Clock, User, Save, Phone, Briefcase, Lock, Loader2, Check, Eye, EyeOff } from 'lucide-react'
import { usePrivacy } from '../../contexts/PrivacyContext'
import { useAuth } from '../../contexts/AuthContext'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { settings, updateSettings } = usePrivacy()
  const { user, updateProfile, updatePassword } = useAuth()

  const [activeTab, setActiveTab] = useState<'profile' | 'privacy' | 'security'>('profile')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    role: '',
    newPassword: ''
  })

  useEffect(() => {
    if (user && isOpen) {
      setFormData(prev => ({
        ...prev,
        full_name: user.user_metadata?.full_name || '',
        phone: user.user_metadata?.phone || '',
        role: user.user_metadata?.role || '',
      }))
    }
    // On réinitialise le message quand on change d'onglet
    setMessage({ type: '', text: '' })
  }, [user, isOpen, activeTab])

  if (!isOpen) return null

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await updateProfile({
      full_name: formData.full_name,
      phone: formData.phone,
      role: formData.role
    })
    if (error) setMessage({ type: 'error', text: error.message })
    else setMessage({ type: 'success', text: 'Profil mis à jour avec succès !' })
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

  const isGoogleUser = user?.app_metadata?.provider === 'google'

  const timerOptions = [
    { label: 'Désactivé', value: 0 },
    { label: '15m', value: 15 },
    { label: '30m', value: 30 },
    { label: '1h', value: 60 },
    { label: '2h', value: 120 },
  ]

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden flex flex-col md:flex-row h-[620px]">
        
        {/* SIDEBAR GAUCHE */}
        <div className="w-full md:w-64 border-r border-slate-700 bg-slate-800/30 p-6 flex flex-col">
          <h2 className="text-xl font-bold text-white mb-8 mt-2">Paramètres</h2>
          <nav className="space-y-3 flex-1">
            <button
              onClick={() => setActiveTab('profile')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'profile' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <User className="w-4 h-4" /> Profil
            </button>
            <button
              onClick={() => setActiveTab('privacy')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'privacy' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Shield className="w-4 h-4" /> Confidentialité
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'security' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Lock className="w-4 h-4" /> Sécurité
            </button>
          </nav>
          <button onClick={onClose} className="mt-auto flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white font-medium transition-colors">
            <X className="w-4 h-4" /> Fermer
          </button>
        </div>

        {/* ZONE DE CONTENU DROITE */}
        <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden text-left">
          <div className="px-10 py-8 border-b border-slate-800">
            <h2 className="text-2xl font-bold text-white">
              {activeTab === 'profile' ? 'Mon Profil' : activeTab === 'privacy' ? 'Interface & Confidentialité' : 'Sécurité du compte'}
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              {activeTab === 'profile' ? 'Gérez vos informations personnelles et votre rôle.' : activeTab === 'privacy' ? 'Protégez vos données sensibles lors de vos partages d\'écran.' : 'Sécurisez l\'accès à votre compte CloserOS.'}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-10">
            {message.text && (
              <div className={`mb-8 flex items-center gap-3 p-4 rounded-xl border ${
                message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}>
                {message.type === 'success' ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
                <p className="font-medium">{message.text}</p>
              </div>
            )}

            {/* --- ONGLET PROFIL --- */}
            {activeTab === 'profile' && (
              <form onSubmit={handleUpdateProfile} className="space-y-8 max-w-xl">
                <div className="flex items-center gap-6 p-4 rounded-2xl bg-slate-800/30 border border-slate-800/50">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-2xl font-bold text-white shadow-xl">
                    {formData.full_name?.[0] || 'U'}
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-white">Photo de profil</h3>
                    <p className="text-sm text-slate-400">Générée automatiquement depuis votre nom.</p>
                  </div>
                </div>

                <div className="grid gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                      <User className="h-4 w-4 text-blue-500" /> Nom complet
                    </label>
                    <input
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                      className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                      placeholder="Ex: Jean Dupont"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                      <Phone className="h-4 w-4 text-blue-500" /> Numéro de téléphone
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                      placeholder="+33 6 00 00 00 00"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-blue-500" /> Spécialité / Rôle
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({...formData, role: e.target.value})}
                      className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all cursor-pointer"
                    >
                      <option value="Closer">Closer</option>
                      <option value="Setter">Setter</option>
                      <option value="Setter-Closer">Setter-Closer</option>
                    </select>
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={loading} 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all shadow-lg shadow-blue-900/30 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
                  Enregistrer les modifications
                </button>
              </form>
            )}

            {/* --- ONGLET CONFIDENTIALITÉ --- */}
            {activeTab === 'privacy' && (
              <div className="space-y-8 max-w-2xl">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Réglages du Mode Discrétion</h3>
                  
                  {[
                    { id: 'hideNumbers', label: 'Masquer les montants', sub: 'Cache les chiffres, KPI et revenus', icon: Eye, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
                    { id: 'hideNames', label: 'Masquer les identités', sub: 'Anonymise les noms de vos prospects', icon: EyeOff, color: 'text-purple-400', bg: 'bg-purple-500/20' },
                    { id: 'blurMode', label: 'Mode Flou (Blur)', sub: 'Floute les données au lieu de les remplacer', icon: Shield, color: 'text-orange-400', bg: 'bg-orange-500/20' }
                  ].map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                      <div className="flex items-center gap-4 text-left">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${item.bg}`}>
                          <item.icon className={`h-5 w-5 ${item.color}`} />
                        </div>
                        <div>
                          <p className="font-semibold text-white">{item.label}</p>
                          <p className="text-sm text-slate-400">{item.sub}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => updateSettings({ [item.id]: !settings[item.id as keyof typeof settings] })}
                        className={`relative h-6 w-11 rounded-full transition-colors ${settings[item.id as keyof typeof settings] ? 'bg-blue-500' : 'bg-slate-700'}`}
                      >
                        <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${settings[item.id as keyof typeof settings] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="space-y-4">
                  <label className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Désactivation automatique
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {timerOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => updateSettings({ timer: option.value })}
                        className={`rounded-xl py-3 text-sm font-medium transition-all ${
                          settings.timer === option.value
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* --- ONGLET SÉCURITÉ --- */}
            {activeTab === 'security' && (
              <div className="max-w-xl space-y-8">
                {isGoogleUser ? (
                  <div className="p-6 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex gap-4 text-left">
                    <Shield className="h-6 w-6 text-blue-400 shrink-0" />
                    <div>
                      <h4 className="font-bold text-white mb-1">Authentification Google active</h4>
                      <p className="text-sm text-blue-300/80">Votre compte est sécurisé par Google. La modification du mot de passe n'est pas disponible depuis CloserOS.</p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleUpdatePassword} className="space-y-6">
                    <div className="space-y-2 text-left">
                      <label className="text-sm font-semibold text-slate-300">Nouveau mot de passe</label>
                      <input
                        type="password"
                        value={formData.newPassword}
                        onChange={(e) => setFormData({...formData, newPassword: e.target.value})}
                        className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="8 caractères minimum"
                        minLength={8}
                      />
                    </div>
                    <button 
                      type="submit" 
                      disabled={loading || !formData.newPassword} 
                      className="w-full bg-slate-800 hover:bg-slate-700 text-white px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all border border-slate-700"
                    >
                      {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Lock className="h-5 w-5" />}
                      Mettre à jour le mot de passe
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}