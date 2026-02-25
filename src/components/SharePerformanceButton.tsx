import { useState, useEffect } from 'react'
import { Share2, Copy, Check, Trash2, X, Eye, EyeOff, Link2, Mail, Shield, ShieldOff, BarChart3, Kanban, Layers, ChevronDown } from 'lucide-react'
import { cn } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
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

const VIEW_OPTIONS: { value: SharedView; label: string; icon: any; desc: string }[] = [
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

  useEffect(() => {
    if (user && isOpen) {
      loadActiveLinks()
      loadLeads()
    }
  }, [user, isOpen])

  const loadActiveLinks = async () => {
    if (!user) return
    const { data } = await supabase
      .from('share_links')
      .select('id, token, is_active, created_at, password_required, shared_view, shared_offer')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(2)

    setActiveLinks(data || [])
  }

  const loadLeads = async () => {
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
      setLeads(data.filter((l: any) => linkIds.has(l.share_link_id)))
    } else {
      setLeads([])
    }
  }

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

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 transition-all hover:bg-slate-700 hover:border-blue-500/30 hover:text-blue-400"
      >
        <Share2 className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Partager</span>
      </button>

      {/* Modal — truly centered above everything */}
      {isOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center" style={{ margin: 0, padding: '1rem' }}>
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-white">Partager ma performance</h2>
                <p className="text-xs text-slate-500 mt-0.5">Partagez vos KPIs et votre pipeline en lecture seule</p>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-800">
              <button
                onClick={() => setTab('link')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
                  tab === 'link' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-slate-200'
                )}
              >
                <Link2 className="h-4 w-4" />
                Lien de partage
              </button>
              <button
                onClick={() => setTab('leads')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
                  tab === 'leads' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-slate-200'
                )}
              >
                <Mail className="h-4 w-4" />
                Leads ({leads.length})
              </button>
            </div>

            {/* Content */}
            <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {tab === 'link' ? (
                <div className="space-y-5">
                  {/* Active links */}
                  {activeLinks.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Liens actifs ({activeLinks.length}/2)</h3>
                      {activeLinks.map(link => (
                        <div key={link.id} className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-xs font-semibold text-emerald-400">
                              {link.shared_offer || 'Global'}
                            </span>
                            <span className="text-[10px] text-slate-500">• {getViewLabel(link.shared_view)}</span>
                            {link.password_required ? (
                              <span className="ml-auto flex items-center gap-1 text-[10px] text-amber-400">
                                <Shield className="h-3 w-3" />
                              </span>
                            ) : (
                              <span className="ml-auto flex items-center gap-1 text-[10px] text-slate-500">
                                <ShieldOff className="h-3 w-3" />
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-1.5">
                            <input
                              readOnly
                              value={getShareUrl(link.token)}
                              className="flex-1 bg-transparent text-[11px] text-slate-300 outline-none truncate"
                            />
                            <button
                              onClick={() => copyLink(link.token)}
                              className="flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-700 transition-colors shrink-0"
                            >
                              {copied === link.token ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                              {copied === link.token ? 'Copié' : 'Copier'}
                            </button>
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <p className="text-[10px] text-slate-500">
                              {new Date(link.created_at).toLocaleDateString('fr-FR')}
                            </p>
                            <button
                              onClick={() => handleRevoke(link.id)}
                              disabled={loading}
                              className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                            >
                              <Trash2 className="h-3 w-3" />
                              Révoquer
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Create new link form */}
                  {canCreate ? (
                    <div className="space-y-4">
                      {activeLinks.length > 0 && (
                        <div className="border-t border-slate-800 pt-4">
                          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Nouveau lien</h3>
                        </div>
                      )}

                      <p className="text-sm text-slate-400">
                        Créez un lien pour partager vos performances en lecture seule.
                      </p>

                      {/* Offer selection */}
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">
                          Offre à partager
                        </label>
                        <div className="relative">
                          <select
                            value={sharedOffer || 'global'}
                            onChange={(e) => setSharedOffer(e.target.value === 'global' ? null : e.target.value)}
                            className="w-full appearance-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 pr-10 text-sm text-white focus:border-blue-500 focus:outline-none transition-colors"
                          >
                            <option value="global">🌐 Global — Toutes les offres</option>
                            {activeOffers.map(offer => (
                              <option key={offer.name} value={offer.name}>
                                📦 {offer.name}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                        </div>
                      </div>

                      {/* View selection */}
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-2">
                          Contenu à partager
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {VIEW_OPTIONS.map(opt => {
                            const Icon = opt.icon
                            const isSelected = sharedView === opt.value
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setSharedView(opt.value)}
                                className={cn(
                                  'flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all text-center',
                                  isSelected
                                    ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                                    : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                                )}
                              >
                                <Icon className={cn('h-5 w-5', isSelected ? 'text-blue-400' : 'text-slate-500')} />
                                <span className="text-xs font-semibold">{opt.label}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Password switch */}
                      <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3">
                        <div className="flex items-center gap-3">
                          {passwordRequired ? (
                            <Shield className="h-4 w-4 text-blue-400" />
                          ) : (
                            <ShieldOff className="h-4 w-4 text-slate-500" />
                          )}
                          <div>
                            <p className="text-sm font-medium text-white">Protéger par un mot de passe</p>
                            <p className="text-[10px] text-slate-500">
                              {passwordRequired ? 'Un mot de passe sera demandé' : 'Accessible sans mot de passe'}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setPasswordRequired(!passwordRequired)
                            if (passwordRequired) setPassword('')
                          }}
                          className={cn(
                            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none',
                            passwordRequired ? 'bg-blue-600' : 'bg-slate-600'
                          )}
                        >
                          <span className={cn(
                            'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                            passwordRequired ? 'translate-x-6' : 'translate-x-1'
                          )} />
                        </button>
                      </div>

                      {/* Password input */}
                      {passwordRequired && (
                        <div>
                          <div className="relative">
                            <input
                              type={showPassword ? 'text' : 'password'}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="Min. 4 caractères"
                              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 pr-10 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                            />
                            <button
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                          {password.length > 0 && password.length < 4 && (
                            <p className="mt-1 text-[10px] text-red-400">Minimum 4 caractères</p>
                          )}
                        </div>
                      )}

                      {/* Error message */}
                      {errorMsg && (
                        <p className="text-sm text-red-400 text-center">{errorMsg}</p>
                      )}

                      {/* Create button */}
                      <button
                        onClick={handleCreate}
                        disabled={loading || (passwordRequired && password.length < 4)}
                        className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Share2 className="h-4 w-4" />
                        {loading ? 'Création...' : 'Générer le lien de partage'}
                      </button>
                    </div>
                  ) : (
                    /* Max links reached */
                    activeLinks.length >= 2 && (
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-center">
                        <p className="text-sm text-amber-400 font-medium">Maximum 2 liens atteint</p>
                        <p className="text-xs text-slate-500 mt-1">Révoquez un lien existant pour en créer un nouveau.</p>
                      </div>
                    )
                  )}
                </div>
              ) : (
                /* Leads tab */
                <div className="space-y-3">
                  {leads.length === 0 ? (
                    <div className="py-8 text-center">
                      <Mail className="mx-auto h-10 w-10 text-slate-600 mb-3" />
                      <p className="text-sm text-slate-400">Aucun lead pour le moment</p>
                      <p className="text-xs text-slate-600 mt-1">Les emails collectés via votre page spectateur apparaîtront ici</p>
                    </div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto space-y-2 custom-scrollbar">
                      {leads.map(lead => (
                        <div key={lead.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/40 px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-white">{lead.email}</p>
                            <p className="text-[10px] text-slate-500">
                              {new Date(lead.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                          <Mail className="h-4 w-4 text-slate-600" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
