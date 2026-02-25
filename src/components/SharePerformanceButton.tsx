import { useState, useEffect } from 'react'
import { Share2, Copy, Check, Trash2, X, Eye, EyeOff, Link2, Users, Mail, Shield, ShieldOff } from 'lucide-react'
import { cn } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface ShareLink {
  id: string
  token: string
  is_active: boolean
  created_at: string
  password_required?: boolean
}

interface SpectatorLead {
  id: string
  email: string
  created_at: string
}

export function SharePerformanceButton() {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [activeLink, setActiveLink] = useState<ShareLink | null>(null)
  const [leads, setLeads] = useState<SpectatorLead[]>([])
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'link' | 'leads'>('link')
  const [passwordRequired, setPasswordRequired] = useState(false)

  useEffect(() => {
    if (user && isOpen) {
      loadActiveLink()
      loadLeads()
    }
  }, [user, isOpen])

  const loadActiveLink = async () => {
    if (!user) return
    const { data } = await supabase
      .from('share_links')
      .select('id, token, is_active, created_at, password_required')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    setActiveLink(data)
  }

  const loadLeads = async () => {
    if (!user) return
    const { data } = await supabase
      .from('spectator_leads')
      .select('id, email, created_at, share_link_id')
      .order('created_at', { ascending: false })

    // Filter leads that belong to user's share links
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
    // If password is required, validate it
    if (passwordRequired && (!password || password.length < 4)) return
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('create_share_link', {
        p_password: passwordRequired ? password : null,
        p_password_required: passwordRequired
      })
      if (error) throw error
      setActiveLink({
        id: data.id,
        token: data.token,
        is_active: true,
        created_at: new Date().toISOString(),
        password_required: passwordRequired
      })
      setPassword('')
      copyLink(data.token)
    } catch (err) {
      console.error('Error creating share link:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRevoke = async () => {
    setLoading(true)
    try {
      const { error } = await supabase.rpc('revoke_share_link')
      if (error) throw error
      setActiveLink(null)
    } catch (err) {
      console.error('Error revoking share link:', err)
    } finally {
      setLoading(false)
    }
  }

  const copyLink = (token?: string) => {
    const t = token || activeLink?.token
    if (!t) return
    const origin = window.location.hostname === 'localhost'
      ? 'http://localhost:5173'
      : 'https://closeos.fr'
    navigator.clipboard.writeText(`${origin}/view/${t}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getShareUrl = () => {
    if (!activeLink) return ''
    const origin = window.location.hostname === 'localhost'
      ? 'http://localhost:5173'
      : 'https://closeos.fr'
    return `${origin}/view/${activeLink.token}`
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 transition-all hover:bg-slate-700 hover:border-blue-500/30 hover:text-blue-400"
      >
        <Share2 className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Partager</span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
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
            <div className="p-6">
              {tab === 'link' ? (
                <>
                  {activeLink ? (
                    <div className="space-y-4">
                      {/* Active link display */}
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-xs font-semibold text-emerald-400">Lien actif</span>
                          {activeLink.password_required ? (
                            <span className="ml-auto flex items-center gap-1 text-[10px] text-amber-400">
                              <Shield className="h-3 w-3" />
                              Protégé
                            </span>
                          ) : (
                            <span className="ml-auto flex items-center gap-1 text-[10px] text-slate-500">
                              <ShieldOff className="h-3 w-3" />
                              Accès libre
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2">
                          <input
                            readOnly
                            value={getShareUrl()}
                            className="flex-1 bg-transparent text-xs text-slate-300 outline-none truncate"
                          />
                          <button
                            onClick={() => copyLink()}
                            className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
                          >
                            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            {copied ? 'Copié' : 'Copier'}
                          </button>
                        </div>

                        <p className="mt-2 text-[10px] text-slate-500">
                          Actif depuis le {new Date(activeLink.created_at).toLocaleDateString('fr-FR')}
                        </p>
                      </div>

                      {/* Revoke */}
                      <button
                        onClick={handleRevoke}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Révoquer le lien
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-slate-400">
                        Créez un lien pour partager vos performances en lecture seule.
                      </p>

                      {/* Password required switch */}
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
                              {passwordRequired
                                ? 'Un mot de passe sera demandé pour accéder'
                                : 'Le lien sera accessible sans mot de passe'
                              }
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
                          <span
                            className={cn(
                              'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                              passwordRequired ? 'translate-x-6' : 'translate-x-1'
                            )}
                          />
                        </button>
                      </div>

                      {/* Password input (only when switch is on) */}
                      {passwordRequired && (
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1.5">
                            Mot de passe de protection
                          </label>
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
                  )}
                </>
              ) : (
                /* Leads tab */
                <div className="space-y-3">
                  {leads.length === 0 ? (
                    <div className="py-8 text-center">
                      <Users className="mx-auto h-10 w-10 text-slate-600 mb-3" />
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
