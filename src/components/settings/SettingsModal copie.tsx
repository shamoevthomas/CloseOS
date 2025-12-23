import { useState, useEffect } from 'react'
import { X, Shield, Eye, EyeOff, Clock, User, Save } from 'lucide-react'
import { usePrivacy } from '../../contexts/PrivacyContext'
import { useAuth } from '../../contexts/AuthContext'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  // Hooks pour récupérer les données (Auth pour profil, Privacy pour discrétion)
  const { settings, updateSettings } = usePrivacy()
  const { user, updateUser } = useAuth()

  // États locaux
  const [activeTab, setActiveTab] = useState<'profile' | 'privacy'>('profile')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
  })
  const [isLoading, setIsLoading] = useState(false)

  // Charger les données de l'utilisateur quand la fenêtre s'ouvre
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || 'Thomas Closer',
        email: user.email || 'thomas@closer.com',
      })
    }
  }, [user, isOpen])

  if (!isOpen) return null

  // Fonction pour sauvegarder le profil
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      if (updateUser) {
        await updateUser({ name: formData.name, email: formData.email })
      }
      // Petit délai pour l'effet visuel
      setTimeout(() => {
        setIsLoading(false)
        // On pourrait ajouter une notification de succès ici
      }, 800)
    } catch (error) {
      console.error(error)
      setIsLoading(false)
    }
  }

  // Options du minuteur (Mode Discrétion)
  const timerOptions = [
    { label: 'Désactivé', value: 0 },
    { label: '15 min', value: 15 },
    { label: '30 min', value: 30 },
    { label: '1 h', value: 60 },
    { label: '2 h', value: 120 },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[600px] animate-in fade-in zoom-in duration-200">

        {/* SIDEBAR (Menu de gauche) */}
        <div className="w-full md:w-64 border-r border-slate-700 bg-slate-800/30 p-4 flex flex-col">
          <h2 className="text-xl font-bold text-white px-4 mb-6 mt-2">Paramètres</h2>
          <nav className="space-y-2 flex-1">
            <button
              onClick={() => setActiveTab('profile')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'profile'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <User className="w-4 h-4" />
              Mon Profil
            </button>
            <button
              onClick={() => setActiveTab('privacy')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'privacy'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Shield className="w-4 h-4" />
              Confidentialité
            </button>
          </nav>
          
           <button
            onClick={onClose}
            className="mt-auto flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white transition-colors md:flex hidden"
          >
            <X className="w-4 h-4" /> Fermer
          </button>
        </div>

        {/* CONTENT AREA (Zone principale à droite) */}
        <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden">
          
          {/* Header Mobile & Titre */}
          <div className="flex items-center justify-between px-8 py-6 border-b border-slate-800">
            <div>
              <h2 className="text-2xl font-bold text-white">
                {activeTab === 'profile' ? 'Mon Profil' : 'Interface & Confidentialité'}
              </h2>
              <p className="text-slate-400 text-sm mt-1">
                 {activeTab === 'profile' ? 'Gérez vos informations personnelles' : 'Protégez vos données sensibles'}
              </p>
            </div>
             <button
                onClick={onClose}
                className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white md:hidden"
              >
                <X className="w-5 h-5" />
              </button>
          </div>

          {/* Contenu Scrollable */}
          <div className="flex-1 overflow-y-auto p-8">
            
            {/* --- ONGLET 1 : PROFIL --- */}
            {activeTab === 'profile' && (
              <form onSubmit={handleSaveProfile} className="space-y-8 max-w-xl">
                 <div className="flex items-center gap-6">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-3xl font-bold text-white shadow-2xl border-4 border-slate-900">
                      {formData.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-white">Photo de profil</h3>
                      <p className="text-sm text-slate-400 mb-3">Générée automatiquement</p>
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Nom complet</label>
                      <input 
                        type="text" 
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                        placeholder="Ex: Thomas Closer"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Adresse Email</label>
                      <input 
                        type="email" 
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                        placeholder="thomas@closer.com"
                      />
                    </div>
                  </div>

                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20"
                    >
                      {isLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Sauvegarde...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Enregistrer les modifications
                        </>
                      )}
                    </button>
                  </div>
              </form>
            )}

            {/* --- ONGLET 2 : CONFIDENTIALITÉ (Ton code existant) --- */}
            {activeTab === 'privacy' && (
              <div className="space-y-6 max-w-2xl">
                 {/* Masquer les montants */}
              <div className="flex items-center justify-between rounded-xl bg-slate-800/50 p-4 border border-slate-700/50">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20">
                    <Eye className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Masquer les montants financiers</p>
                    <p className="text-sm text-slate-400">Cache tous les chiffres, montants et KPI</p>
                  </div>
                </div>
                <button
                  onClick={() => updateSettings({ hideNumbers: !settings.hideNumbers })}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    settings.hideNumbers ? 'bg-blue-500' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                      settings.hideNumbers ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Masquer les noms */}
              <div className="flex items-center justify-between rounded-xl bg-slate-800/50 p-4 border border-slate-700/50">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20">
                    <EyeOff className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Masquer les identités prospects</p>
                    <p className="text-sm text-slate-400">
                      Garde uniquement les 3 premières lettres des noms
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => updateSettings({ hideNames: !settings.hideNames })}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    settings.hideNames ? 'bg-blue-500' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                      settings.hideNames ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Mode Flou */}
              <div className="flex items-center justify-between rounded-xl bg-slate-800/50 p-4 border border-slate-700/50">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/20">
                    <Eye className="h-5 w-5 text-orange-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Mode Flou (Blur)</p>
                    <p className="text-sm text-slate-400">
                      Floute le texte au lieu d'afficher des astérisques
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => updateSettings({ blurMode: !settings.blurMode })}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    settings.blurMode ? 'bg-blue-500' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                      settings.blurMode ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Timer */}
              <div className="rounded-xl bg-slate-800/50 p-4 border border-slate-700/50">
                <div className="mb-4 flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20">
                    <Clock className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Désactivation automatique</p>
                    <p className="text-sm text-slate-400">
                      Le Mode Discrétion se désactive après le délai choisi
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {timerOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => updateSettings({ timer: option.value })}
                      className={`rounded-lg px-2 py-2 text-xs md:text-sm font-medium transition-colors ${
                        settings.timer === option.value
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Info Box */}
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 flex gap-3">
                <div className="text-xl">💡</div>
                <p className="text-sm text-blue-300">
                  <span className="font-semibold">Astuce :</span> Activez le Mode Discrétion avant
                  de partager votre écran pour protéger vos données sensibles.
                </p>
              </div>

              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  )
}