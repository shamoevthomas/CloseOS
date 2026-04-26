import { useState, useRef, useEffect } from 'react'
import {
  X, User, Shield, Monitor, CreditCard, Headphones, Trash2, Camera, Loader2,
  Check, AlertCircle, Lock, Mail, Phone, Globe, Clock, ExternalLink, Save,
  Eye, EyeOff, LogOut,
} from 'lucide-react'
import { useCRMAuth } from '../contexts/CRMAuthContext'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

type TabId = 'profile' | 'security' | 'interface' | 'subscription' | 'support' | 'delete_account'

interface CRMSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: TabId
}

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: 'profile', label: 'Profil', icon: User },
  { id: 'interface', label: 'Interface', icon: Monitor },
  { id: 'security', label: 'Sécurité', icon: Shield },
  { id: 'subscription', label: 'Abonnement', icon: CreditCard },
  { id: 'support', label: 'Support', icon: Headphones },
  { id: 'delete_account', label: 'Supprimer le compte', icon: Trash2 },
]

const TIMEZONES = [
  'Europe/Paris', 'Europe/London', 'Europe/Madrid', 'Europe/Berlin', 'Europe/Brussels',
  'America/New_York', 'America/Los_Angeles', 'America/Chicago', 'America/Toronto',
  'Africa/Casablanca', 'Africa/Algiers', 'Africa/Tunis',
]

export function CRMSettingsModal({ isOpen, onClose, initialTab = 'profile' }: CRMSettingsModalProps) {
  const { user, crmProfile, businessSettings, updateBusinessProfile, logout } = useCRMAuth()
  const [tab, setTab] = useState<TabId>(initialTab)

  useEffect(() => { if (isOpen) setTab(initialTab) }, [isOpen, initialTab])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="fixed inset-0 bg-[#0A0E27]/60 backdrop-blur-md" onClick={onClose} />
      <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-gradient-to-br from-[#3B82F6]/15 to-[#60A5FA]/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-5xl h-[88vh] bg-white rounded-3xl shadow-2xl shadow-blue-500/20 ring-1 ring-blue-100 flex overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col w-80 bg-gradient-to-b from-blue-50/40 to-white border-r border-blue-100 py-10 px-6 shrink-0">
          <div className="mb-6 px-3">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-600 mb-1.5">Réglages</p>
            <h2 className="text-2xl font-bold text-[#0A0E27] tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>Paramètres</h2>
            <p className="text-stone-500 text-xs mt-1">Gérez votre espace CloseOS CRM</p>
          </div>

          <nav className="flex-1 space-y-0.5">
            {TABS.map(t => {
              const Icon = t.icon
              const isActive = tab === t.id
              const isDanger = t.id === 'delete_account'
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    isActive
                      ? isDanger
                        ? 'bg-red-50 text-red-700 border border-red-100'
                        : 'bg-gradient-to-r from-[#3B82F6]/10 to-[#60A5FA]/10 text-blue-700 border border-blue-200'
                      : isDanger
                      ? 'text-stone-500 hover:bg-red-50/40 hover:text-red-600'
                      : 'text-stone-600 hover:bg-blue-50/60 hover:text-[#0A0E27]'
                  }`}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="text-left truncate">{t.label}</span>
                </button>
              )
            })}
          </nav>

          {/* Plan footer */}
          <div className="mt-6 px-3">
            <div className="rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#60A5FA] text-white p-4 shadow-lg shadow-blue-500/30">
              <p className="text-[10px] uppercase tracking-widest font-bold opacity-80 mb-1">Plan actuel</p>
              <p className="font-bold text-sm" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {crmProfile?.is_lifetime_free ? 'CloseOS CRM · À vie' : 'CloseOS CRM'}
              </p>
              {!crmProfile?.is_lifetime_free && (
                <p className="text-[10px] opacity-80 mt-1">49€/mois</p>
              )}
            </div>
          </div>
        </aside>

        {/* Mobile tab bar */}
        <div className="md:hidden absolute top-0 left-0 right-0 z-20 bg-white border-b border-blue-100 px-4 py-3 flex items-center justify-between gap-2">
          <select
            value={tab}
            onChange={e => setTab(e.target.value as TabId)}
            className="flex-1 px-3 py-2 rounded-xl bg-blue-50/40 border border-blue-100 text-sm font-bold text-[#0A0E27]"
          >
            {TABS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-blue-50 text-stone-500">
            <X className="size-5" />
          </button>
        </div>

        {/* Main */}
        <main className="flex-1 overflow-y-auto bg-white pt-20 md:pt-12 md:pb-12 md:pl-12 md:pr-16 px-6 pb-10 relative">
          {/* Desktop close */}
          <button onClick={onClose} className="hidden md:flex absolute top-5 right-5 p-2 rounded-xl hover:bg-blue-50 text-stone-500 hover:text-blue-600 transition-colors z-10">
            <X className="size-5" />
          </button>

          <div className="max-w-2xl">
            {tab === 'profile' && <ProfileTab user={user} crmProfile={crmProfile} updateBusinessProfile={updateBusinessProfile} />}
            {tab === 'interface' && <InterfaceTab />}
            {tab === 'security' && <SecurityTab />}
            {tab === 'subscription' && <SubscriptionTab crmProfile={crmProfile} businessSettings={businessSettings} />}
            {tab === 'support' && <SupportTab />}
            {tab === 'delete_account' && <DeleteAccountTab logout={logout} userEmail={user?.email || ''} />}
          </div>
        </main>
      </div>
    </div>
  )
}

// ─── Tabs ───

function ProfileTab({ user, crmProfile, updateBusinessProfile }: any) {
  const [fullName, setFullName] = useState(crmProfile?.full_name || '')
  const [phone, setPhone] = useState(crmProfile?.phone || '')
  const [timezone, setTimezone] = useState(crmProfile?.timezone || 'Europe/Paris')
  const [avatarUrl, setAvatarUrl] = useState(crmProfile?.avatar_url || '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const initials = (fullName || user?.email || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

  const handleAvatarUpload = async (file: File) => {
    if (!user?.id) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `crm-${user.id}-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      setAvatarUrl(publicUrl)
      await updateBusinessProfile({ avatar_url: publicUrl })
      toast.success('Photo mise à jour')
    } catch (err: any) {
      toast.error(err?.message || 'Erreur d\'upload')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await updateBusinessProfile({ full_name: fullName, phone, timezone })
      if (error) throw error
      toast.success('Profil mis à jour')
    } catch (err: any) {
      toast.error(err?.message || 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <SectionHeader title="Mon profil" subtitle="Vos informations personnelles visibles dans l'application" />

      {/* Avatar */}
      <div className="flex items-center gap-5 mb-6 pb-6 border-b border-blue-50">
        <div className="relative shrink-0">
          <div className="absolute -inset-1 bg-gradient-to-br from-[#3B82F6] to-[#60A5FA] rounded-full blur opacity-40" />
          {avatarUrl ? (
            <img src={avatarUrl} alt={fullName} className="relative size-20 rounded-full object-cover ring-2 ring-white shadow-lg" />
          ) : (
            <div className="relative size-20 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#60A5FA] flex items-center justify-center text-white font-extrabold text-2xl ring-2 ring-white shadow-lg">
              {initials}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#0A0E27]" style={{ fontFamily: 'Manrope, sans-serif' }}>Photo de profil</p>
          <p className="text-xs text-stone-500 mb-2">JPG, PNG · 2 Mo max</p>
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => {
              const f = e.target.files?.[0]
              if (f) handleAvatarUpload(f)
            }} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] text-white text-xs font-bold shadow-md shadow-blue-500/25 disabled:opacity-50"
            >
              {uploading ? <Loader2 className="size-3 animate-spin" /> : <Camera className="size-3" />}
              Changer
            </button>
            {avatarUrl && (
              <button
                onClick={async () => { setAvatarUrl(''); await updateBusinessProfile({ avatar_url: null }) }}
                className="px-3 py-1.5 rounded-full text-xs font-bold text-stone-500 hover:text-red-600 hover:bg-red-50"
              >
                Retirer
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <Field label="Nom complet" icon={<User className="size-3.5" />}>
          <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jean Dupont" className={inputCls} />
        </Field>
        <Field label="Email" icon={<Mail className="size-3.5" />}>
          <input value={user?.email || ''} disabled className={`${inputCls} cursor-not-allowed opacity-70`} />
        </Field>
        <Field label="Téléphone" icon={<Phone className="size-3.5" />}>
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+33 6 12 34 56 78" className={inputCls} />
        </Field>
        <Field label="Fuseau horaire" icon={<Globe className="size-3.5" />}>
          <select value={timezone} onChange={e => setTimezone(e.target.value)} className={inputCls}>
            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </Field>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] hover:from-[#2563EB] hover:to-[#3B82F6] text-white text-sm font-bold shadow-md shadow-blue-500/25 transition-all disabled:opacity-60"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Enregistrer
        </button>
      </div>
    </div>
  )
}

function InterfaceTab() {
  const [lang, setLang] = useState(localStorage.getItem('closeos_lang') || 'fr')

  const handleLangChange = (l: string) => {
    setLang(l)
    localStorage.setItem('closeos_lang', l)
    toast.success('Langue mise à jour')
  }

  return (
    <div>
      <SectionHeader title="Interface" subtitle="Personnalisez l'apparence et la langue de l'application" />

      <div className="space-y-5">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2">Langue</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'fr', label: 'Français', flag: '🇫🇷' },
              { id: 'en', label: 'English', flag: '🇬🇧' },
            ].map(l => {
              const isActive = lang === l.id
              return (
                <button
                  key={l.id}
                  onClick={() => handleLangChange(l.id)}
                  className={`relative p-3 rounded-xl border text-left transition-all ${
                    isActive
                      ? 'bg-gradient-to-br from-[#3B82F6]/10 to-[#60A5FA]/10 border-blue-400 shadow-md shadow-blue-500/15'
                      : 'bg-white border-blue-100 hover:border-blue-200 hover:bg-blue-50/30'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{l.flag}</span>
                    <span className={`text-sm font-bold ${isActive ? 'text-blue-700' : 'text-[#0A0E27]'}`}>{l.label}</span>
                  </div>
                  {isActive && (
                    <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500" />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2">Thème</label>
          <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-4">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-lg bg-gradient-to-br from-white to-blue-50 border border-blue-200 flex items-center justify-center">
                <Monitor className="size-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#0A0E27]">Thème clair</p>
                <p className="text-xs text-stone-500">Le mode sombre arrive bientôt</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SecurityTab() {
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [saving, setSaving] = useState(false)

  const handleChangePwd = async () => {
    if (newPwd !== confirmPwd) { toast.error('Les mots de passe ne correspondent pas'); return }
    if (newPwd.length < 8) { toast.error('Min 8 caractères'); return }
    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPwd })
      if (error) throw error
      toast.success('Mot de passe mis à jour')
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('')
    } catch (err: any) {
      toast.error(err?.message || 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const handleResetEmail = async () => {
    setSaving(true)
    try {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u?.email) throw new Error('Email introuvable')
      const { error } = await supabase.auth.resetPasswordForEmail(u.email, {
        redirectTo: `${window.location.origin}/crm/login`,
      })
      if (error) throw error
      toast.success('Email envoyé !')
    } catch (err: any) {
      toast.error(err?.message || 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <SectionHeader title="Sécurité" subtitle="Gérez votre mot de passe et vos sessions" />

      <div className="space-y-5">
        <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/40 to-white p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="size-9 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#60A5FA] flex items-center justify-center shadow-md shadow-blue-500/25">
              <Lock className="size-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#0A0E27]">Changer mon mot de passe</p>
              <p className="text-xs text-stone-500">Min 8 caractères</p>
            </div>
          </div>

          <div className="space-y-3">
            <Field label="Mot de passe actuel">
              <div className="relative">
                <input type={showCurrent ? 'text' : 'password'} value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} className={`${inputCls} pr-10`} />
                <button type="button" onClick={() => setShowCurrent(o => !o)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-blue-600">
                  {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>
            <Field label="Nouveau mot de passe">
              <div className="relative">
                <input type={showNew ? 'text' : 'password'} value={newPwd} onChange={e => setNewPwd(e.target.value)} className={`${inputCls} pr-10`} />
                <button type="button" onClick={() => setShowNew(o => !o)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-blue-600">
                  {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>
            <Field label="Confirmer le nouveau mot de passe">
              <input type={showNew ? 'text' : 'password'} value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} className={inputCls} />
            </Field>
          </div>

          <div className="flex items-center justify-between mt-4 gap-3 flex-wrap">
            <button
              onClick={handleResetEmail}
              disabled={saving}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
            >
              Envoyer un lien de réinitialisation par email
            </button>
            <button
              onClick={handleChangePwd}
              disabled={saving || !newPwd || newPwd !== confirmPwd}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] hover:from-[#2563EB] hover:to-[#3B82F6] text-white text-xs font-bold shadow-md shadow-blue-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              Mettre à jour
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SubscriptionTab({ crmProfile, businessSettings }: any) {
  const [openingPortal, setOpeningPortal] = useState(false)

  const handlePortal = async () => {
    if (!crmProfile?.stripe_customer_id) {
      toast.error('Aucun abonnement Stripe actif')
      return
    }
    setOpeningPortal(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/crm-checkout?action=portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ customer_id: crmProfile.stripe_customer_id, return_url: window.location.href }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else toast.error(data.error || 'Erreur ouverture portail')
    } catch (err: any) {
      toast.error(err?.message || 'Erreur')
    } finally {
      setOpeningPortal(false)
    }
  }

  const trialEndsAt = crmProfile?.trial_ends_at ? new Date(crmProfile.trial_ends_at) : null
  const inTrial = trialEndsAt && trialEndsAt > new Date()
  const daysLeft = trialEndsAt ? Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0

  return (
    <div>
      <SectionHeader title="Abonnement" subtitle="Gérez votre formule et facturation" />

      {/* Plan card */}
      <div className="rounded-2xl bg-gradient-to-br from-[#3B82F6] via-[#60A5FA] to-[#7DD3FC] p-6 text-white shadow-xl shadow-blue-500/30 mb-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-1">Plan actuel</p>
            <h3 className="text-xl font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {crmProfile?.is_lifetime_free ? 'CloseOS CRM · À vie' : 'CloseOS CRM'}
            </h3>
          </div>
          {!crmProfile?.is_lifetime_free && (
            <div className="text-right">
              <p className="text-3xl font-extrabold" style={{ fontFamily: 'Manrope, sans-serif' }}>49€</p>
              <p className="text-xs opacity-80">/mois</p>
            </div>
          )}
        </div>

        {inTrial && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1.5">
            <Clock className="size-3.5" />
            <span className="text-xs font-bold">Essai · {daysLeft} jour{daysLeft > 1 ? 's' : ''} restant{daysLeft > 1 ? 's' : ''}</span>
          </div>
        )}
        {crmProfile?.is_lifetime_free && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1.5">
            <Check className="size-3.5" />
            <span className="text-xs font-bold">Accès gratuit illimité</span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <InfoRow label="Email facturation" value={crmProfile?.email || '—'} />
        <InfoRow label="Plan Supabase" value={businessSettings?.subscription_plan === 'crm' ? 'crm' : (businessSettings?.subscription_plan || '—')} />
        {crmProfile?.stripe_customer_id && (
          <InfoRow label="ID client Stripe" value={crmProfile.stripe_customer_id} mono />
        )}
      </div>

      {crmProfile?.stripe_customer_id && (
        <button
          onClick={handlePortal}
          disabled={openingPortal}
          className="mt-5 w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-white border border-blue-200 text-[#0A0E27] text-sm font-bold hover:border-blue-300 hover:bg-blue-50/50 transition-all disabled:opacity-60"
        >
          {openingPortal ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4 text-blue-600" />}
          Gérer ma facturation Stripe
        </button>
      )}
    </div>
  )
}

function SupportTab() {
  return (
    <div>
      <SectionHeader title="Support" subtitle="Une question ? On est là pour vous aider" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <SupportCard
          icon={<Mail className="size-5 text-white" />}
          title="Email"
          subtitle="support@closeos.fr"
          href="mailto:support@closeos.fr"
        />
        <SupportCard
          icon={<Headphones className="size-5 text-white" />}
          title="Chat"
          subtitle="Bulle en bas à droite"
          href="#"
        />
      </div>

      <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50/30 p-5">
        <p className="text-sm font-bold text-[#0A0E27] mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>Documentation</p>
        <p className="text-xs text-stone-600 mb-3">Tutoriels, FAQ, guides d'intégration Zapier/Make/N8N.</p>
        <a
          href="https://docs.closeos.fr"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] text-white text-xs font-bold shadow-md shadow-blue-500/25"
        >
          <ExternalLink className="size-3" />
          Ouvrir la documentation
        </a>
      </div>
    </div>
  )
}

function DeleteAccountTab({ logout, userEmail }: { logout: () => Promise<void>; userEmail: string }) {
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const canDelete = confirmText === userEmail && !deleting

  const handleDelete = async () => {
    if (!canDelete) return
    if (!confirm('Cette action est définitive. Toutes vos données seront supprimées. Confirmer ?')) return
    setDeleting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/crm-checkout?action=delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Erreur de suppression')
      }
      toast.success('Compte supprimé')
      await logout()
      window.location.href = '/crm'
    } catch (err: any) {
      toast.error(err?.message || 'Erreur')
      setDeleting(false)
    }
  }

  return (
    <div>
      <SectionHeader title="Supprimer mon compte" subtitle="Action définitive et irréversible" />

      <div className="rounded-2xl border border-red-200 bg-red-50/40 p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="size-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <AlertCircle className="size-4 text-red-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-red-900">Cette action est définitive</p>
            <p className="text-xs text-red-700 mt-1">
              Tous vos prospects, campagnes, RDV, offres et données analytics seront supprimés.
              Aucun retour en arrière possible.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <Field label={`Tapez votre email pour confirmer (${userEmail})`}>
            <input
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder={userEmail}
              className="w-full px-3 py-2.5 rounded-xl bg-white border border-red-200 text-sm text-[#0A0E27] focus:ring-2 focus:ring-red-500/30 focus:border-red-400 outline-none transition-all"
            />
          </Field>

          <button
            onClick={handleDelete}
            disabled={!canDelete}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-md shadow-red-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            Supprimer définitivement mon compte
          </button>
          <button
            onClick={async () => { await logout() }}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold text-stone-600 hover:bg-stone-100 transition-colors"
          >
            <LogOut className="size-4" />
            Juste me déconnecter
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ───

const inputCls = "w-full pl-9 pr-3 py-2.5 rounded-xl bg-blue-50/40 border border-blue-100 text-sm text-[#0A0E27] focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 outline-none transition-all placeholder:text-stone-400"

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-[#0A0E27] tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>{title}</h1>
      <p className="text-sm text-stone-500 mt-1">{subtitle}</p>
    </div>
  )
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1.5">{label}</span>
      <div className="relative">
        {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 pointer-events-none z-10">{icon}</span>}
        {children}
      </div>
    </label>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl border border-blue-100 bg-blue-50/30">
      <span className="text-xs font-bold uppercase tracking-widest text-stone-500">{label}</span>
      <span className={`text-sm font-semibold text-[#0A0E27] truncate max-w-[60%] ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  )
}

function SupportCard({ icon, title, subtitle, href }: { icon: React.ReactNode; title: string; subtitle: string; href: string }) {
  return (
    <a href={href} className="group rounded-2xl border border-blue-100 bg-white p-4 hover:border-blue-300 hover:shadow-md hover:shadow-blue-500/10 transition-all">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#60A5FA] flex items-center justify-center shadow-sm shadow-blue-500/25">
          {icon}
        </div>
        <div>
          <p className="text-sm font-bold text-[#0A0E27]" style={{ fontFamily: 'Manrope, sans-serif' }}>{title}</p>
          <p className="text-xs text-stone-500">{subtitle}</p>
        </div>
      </div>
    </a>
  )
}
