import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Share2, Copy, Check, Trash2, X, Eye, EyeOff, Link2, Mail, Shield, ShieldOff, BarChart3, Kanban, Layers, ChevronDown } from 'lucide-react'
import { cn } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useUpgrade } from '../contexts/UpgradeContext'
import { useOffers } from '../contexts/OffersContext'

interface ShareLink {
  id: string
  token: string
  is_active: boolean
  created_at: string
  password_required?: boolean
  shared_view?: string
  shared_offer?: string | null
}

interface SpectatorLead {
  id: string
  email: string
  created_at: string
}

type SharedView = 'kpi' | 'pipeline' | 'both'

const VIEW_OPTIONS: { value: SharedView; label: string; icon: React.ComponentType<{ className?: string }>; desc: string }[] = [
  { value: 'both', label: 'Les deux', icon: Layers, desc: 'Pipeline + KPIs' },
  { value: 'pipeline', label: 'Pipeline', icon: Kanban, desc: 'Le pipeline' },
  { value: 'kpi', label: 'KPIs', icon: BarChart3, desc: 'Les statistiques' },
]

export function SharePerformanceButton() {
  const { user } = useAuth()
  const { offers } = useOffers()
  const [isOpen, setIsOpen] = useState(false)
  const [activeLinks, setActiveLinks] = useState<ShareLink[]>([])
  const [leads, setLeads] = useState<SpectatorLead[]>([])
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'link' | 'leads'>('link')
  const [passwordRequired, setPasswordRequired] = useState(false)
  const [sharedView, setSharedView] = useState<SharedView>('both')
  const [sharedOffer, setSharedOffer] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const activeOffers = offers.filter(o => o.status === 'active')

  const loadActiveLinks = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('share_links')
      .select('id, token, is_active, created_at, password_required, shared_view, shared_offer')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(2)

    setActiveLinks(data || [])
  }, [user])

  const loadLeads = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('spectator_leads')
      .select('id, email, created_at, share_link_id')
      .order('created_at', { ascending: false })

    if (data && data.length > 0) {
      const { data: links } = await supabase
        .from('share_links')
        .select('id')
        .eq('user_id', user.id)

      const linkIds = new Set(links?.map(l => l.id) || [])
      setLeads(data.filter((l: { share_link_id: string }) => linkIds.has(l.share_link_id)))
    } else {
      setLeads([])
    }
  }, [user])

  useEffect(() => {
    if (user && isOpen) {
      loadActiveLinks()
      loadLeads()
    }
  }, [user, isOpen, loadActiveLinks, loadLeads])

  const handleCreate = async () => {
    if (passwordRequired && (!password || password.length < 4)) return
    setLoading(true)
    setErrorMsg(null)
    try {
      const { data, error } = await supabase.rpc('create_share_link', {
        p_password: passwordRequired ? password : null,
        p_password_required: passwordRequired,
        p_shared_view: sharedView,
        p_shared_offer: sharedOffer
      })
      if (error) throw error
      if (data?.error === 'max_links_reached') {
        setErrorMsg('Maximum 2 liens actifs. Révoquez un lien pour en créer un nouveau.')
        return
      }
      const newLink: ShareLink = {
        id: data.id,
        token: data.token,
        is_active: true,
        created_at: new Date().toISOString(),
        password_required: passwordRequired,
        shared_view: sharedView,
        shared_offer: sharedOffer
      }
      setActiveLinks(prev => [newLink, ...prev])
      setPassword('')
      copyLink(data.token)
    } catch (err) {
      console.error('Error creating share link:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRevoke = async (linkId: string) => {
    setLoading(true)
    try {
      const { error } = await supabase.rpc('revoke_share_link', { p_link_id: linkId })
      if (error) throw error
      setActiveLinks(prev => prev.filter(l => l.id !== linkId))
      setErrorMsg(null)
    } catch (err) {
      console.error('Error revoking share link:', err)
    } finally {
      setLoading(false)
    }
  }

  const copyLink = (token?: string) => {
    if (!token) return
    const origin = window.location.hostname === 'localhost'
      ? 'http://localhost:5173'
      : 'https://closeos.fr'
    navigator.clipboard.writeText(`${origin}/view/${token}`)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  const getShareUrl = (token: string) => {
    const origin = window.location.hostname === 'localhost'
      ? 'http://localhost:5173'
      : 'https://closeos.fr'
    return `${origin}/view/${token}`
  }

  const getViewLabel = (view?: string) => {
    const opt = VIEW_OPTIONS.find(o => o.value === view)
    return opt?.label || 'Les deux'
  }

  const canCreate = activeLinks.length < 2

  const modalContent = isOpen ? (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={() => setIsOpen(false)}
      />
      <div className="relative w-full max-w-xl bg-slate-900 rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 rounded-lg border border-blue-500/30">
              <Share2 className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Partager ma performance</h2>
              <p className="text-xs text-slate-500 mt-0.5">Partagez vos KPIs et votre pipeline en lecture seule</p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5 bg-slate-800/20">
          <button
            onClick={() => setTab('link')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-4 text-sm font-bold transition-all',
              tab === 'link' ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-400/5' : 'text-slate-500 hover:text-slate-300'
            )}
          >
            <Link2 className="h-4 w-4" />
            Lien de partage
          </button>
          <button
            onClick={() => setTab('leads')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-4 text-sm font-bold transition-all',
              tab === 'leads' ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-400/5' : 'text-slate-500 hover:text-slate-300'
            )}
          >
            <Mail className="h-4 w-4" />
            Leads ({leads.length})
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar bg-slate-900">
          {tab === 'link' ? (
            <div className="space-y-6">
              {/* Active links */}
              {activeLinks.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Liens actifs ({activeLinks.length}/2)</h3>
                  {activeLinks.map(link => (
                    <div key={link.id} className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-sm font-bold text-emerald-400">
                          {link.shared_offer || 'Global'}
                        </span>
                        <span className="text-xs text-slate-500 font-medium px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">
                          {getViewLabel(link.shared_view)}
                        </span>
                        {link.password_required ? (
                          <span className="ml-auto text-amber-400" title="Protégé par mot de passe">
                            <Shield className="h-4 w-4" />
                          </span>
                        ) : (
                          <span className="ml-auto text-slate-600" title="Accès libre">
                            <ShieldOff className="h-4 w-4" />
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5">
                        <input
                          readOnly
                          value={getShareUrl(link.token)}
                          className="flex-1 bg-transparent text-sm text-slate-300 outline-none truncate"
                        />
                        <button
                          onClick={() => copyLink(link.token)}
                          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 active:scale-95 shrink-0"
                        >
                          {copied === link.token ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          {copied === link.token ? 'Copié' : 'Copier'}
                        </button>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <p className="text-xs text-slate-500 font-medium">
                          Créé le {new Date(link.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                        </p>
                        <button
                          onClick={() => handleRevoke(link.id)}
                          disabled={loading}
                          className="flex items-center gap-1.5 text-xs font-bold text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Révoquer le lien
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Create new link form */}
              {canCreate ? (
                <div className="space-y-5">
                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-white/5"></span></div>
                    <div className="relative flex justify-center"><span className="bg-slate-900 px-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Nouveau lien</span></div>
                  </div>

                  <p className="text-sm text-slate-400 leading-relaxed">
                    Générez un lien d'accès en lecture seule pour montrer vos résultats à vos partenaires.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Offer selection */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">
                        Offre à partager
                      </label>
                      <div className="relative group">
                        <select
                          value={sharedOffer || 'global'}
                          onChange={(e) => setSharedOffer(e.target.value === 'global' ? null : e.target.value)}
                          className="w-full appearance-none rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-white focus:border-blue-500 focus:bg-slate-800 outline-none transition-all cursor-pointer"
                        >
                          <option value="global">🌐 Toutes les offres (Global)</option>
                          {activeOffers.map(offer => (
                            <option key={offer.name} value={offer.name}>
                              📦 {offer.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none group-hover:text-slate-300 transition-colors" />
                      </div>
                    </div>

                    {/* Password toggle */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">
                        Sécurité
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setPasswordRequired(!passwordRequired)
                          if (!passwordRequired) setPassword('')
                        }}
                        className={cn(
                          "w-full flex items-center justify-between rounded-xl border px-4 py-3 transition-all",
                          passwordRequired ? "border-blue-500 bg-blue-500/10" : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Shield className={cn("h-4 w-4", passwordRequired ? "text-blue-400" : "text-slate-500")} />
                          <span className={cn("text-sm font-bold", passwordRequired ? "text-blue-400" : "text-slate-400")}>Mot de passe</span>
                        </div>
                        <div className={cn(
                          "h-5 w-9 rounded-full transition-colors relative",
                          passwordRequired ? "bg-blue-600" : "bg-slate-700"
                        )}>
                          <div className={cn(
                            "absolute top-1 left-1 h-3 w-3 rounded-full bg-white transition-all",
                            passwordRequired ? "translate-x-4" : "translate-x-0"
                          )} />
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Password input */}
                  {passwordRequired && (
                    <div className="animate-in slide-in-from-top-2 duration-200">
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Définir un mot de passe (min. 4)"
                          className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-white focus:border-blue-500 outline-none transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {password.length > 0 && password.length < 4 && (
                        <p className="mt-2 text-[10px] text-red-400 font-bold ml-1 uppercase">Minimum 4 caractères requis</p>
                      )}
                    </div>
                  )}

                  {/* View selection */}
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1 text-center block">
                      Sections visibles par le spectateur
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {VIEW_OPTIONS.map(opt => {
                        const Icon = opt.icon
                        const isSelected = sharedView === opt.value
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setSharedView(opt.value)}
                            className={cn(
                              'flex flex-col items-center gap-2 rounded-2xl border p-4 transition-all text-center group',
                              isSelected
                                ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/50'
                                : 'border-slate-800 bg-slate-800/30 text-slate-500 hover:border-slate-700 hover:text-slate-400'
                            )}
                          >
                            <Icon className={cn('h-6 w-6 mb-1', isSelected ? 'text-blue-400' : 'text-slate-600 group-hover:text-slate-500')} />
                            <span className={cn('text-xs font-bold', isSelected ? 'text-blue-400' : 'text-slate-500')}>{opt.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {errorMsg && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold text-center">
                      {errorMsg}
                    </div>
                  )}

                  <button
                    onClick={handleCreate}
                    disabled={loading || (passwordRequired && password.length < 4)}
                    className="w-full flex items-center justify-center gap-3 rounded-xl bg-blue-600 py-4 text-base font-bold text-white hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    <Share2 className="h-5 w-5 group-hover:rotate-12 transition-transform" />
                    {loading ? 'Création en cours...' : 'Créer mon lien de partage'}
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 text-center">
                  <Shield className="mx-auto h-10 w-10 text-amber-500/50 mb-4" />
                  <h4 className="text-lg font-bold text-amber-400">Limite atteinte</h4>
                  <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                    Vous avez déjà 2 liens de partage actifs. Révoquez un lien existant pour en générer un nouveau.
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Leads tab */
            <div className="space-y-4">
              {leads.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="mx-auto w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-6 border border-slate-700">
                    <Mail className="h-8 w-8 text-slate-600" />
                  </div>
                  <h4 className="text-base font-bold text-white">Aucun lead collecté</h4>
                  <p className="text-sm text-slate-500 mt-2 max-w-xs mx-auto">
                    Activez la collecte d'emails sur votre page spectateur pour voir vos leads apparaître ici.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Derniers leads ({leads.length})</h3>
                  <div className="grid grid-cols-1 gap-2">
                    {leads.map(lead => (
                      <div key={lead.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-800/40 px-5 py-4 group hover:bg-slate-800 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/20">
                            <User className="h-5 w-5 text-blue-400" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">{lead.email}</p>
                            <p className="text-[10px] text-slate-500 font-medium">
                              Capté le {new Date(lead.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </p>
                          </div>
                        </div>
                        <a href={`mailto:${lead.email}`} className="p-2 text-slate-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all">
                          <Mail className="h-5 w-5" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-800/30 border-t border-white/5 text-center">
          <p className="text-[10px] text-slate-600 font-bold uppercase tracking-[0.2em]">Sécurisé par CloseOS</p>
        </div>
      </div>
    </div>
  ) : null

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-800/50 px-5 py-2.5 text-sm font-bold text-slate-300 transition-all hover:bg-slate-700/80 hover:border-blue-500/50 hover:text-white shadow-lg active:scale-95 group"
      >
        <Share2 className="h-4 w-4 group-hover:rotate-12 transition-transform" />
        <span>Partager</span>
      </button>

      {isOpen && createPortal(modalContent, document.body)}
    </>
  )
}

function User(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}
