import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, ArrowRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { isAdminEmail } from '../../lib/adminEmails'

const PRIMARY = '#3B82F6'
const SECONDARY = '#60A5FA'

export default function CRMLogin() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const reason = searchParams.get('reason')
    if (reason === 'not-crm') {
      setError("Ce compte n'est pas un compte CloseOS CRM. Créez-en un nouveau.")
    }
  }, [searchParams])

  // If already signed in AND (has a crm_users row OR is admin), skip the form
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return
      if (isAdminEmail(session.user.email)) {
        navigate('/crm/dashboard', { replace: true })
        return
      }
      const { data: crmRow } = await supabase
        .from('crm_users')
        .select('id')
        .eq('id', session.user.id)
        .maybeSingle()
      if (crmRow) navigate('/crm/dashboard', { replace: true })
    })
  }, [navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      // Allow pseudo login: "TEKA" → teka@closeos.local (dev/admin shortcut)
      const loginEmail = email.includes('@') ? email.trim() : `${email.trim().toLowerCase()}@closeos.local`
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email: loginEmail, password })
      if (authError) {
        setError(authError.message || 'Identifiants incorrects')
        setSubmitting(false)
        return
      }
      if (!data.user) {
        setError('Erreur inconnue')
        setSubmitting(false)
        return
      }
      // Admin accounts bypass the crm_users check (whitelisted in src/lib/adminEmails.ts).
      if (isAdminEmail(data.user.email)) {
        navigate('/crm/dashboard', { replace: true })
        return
      }
      // Regular accounts must have a crm_users row — block Sales/Business accounts
      const { data: crmRow } = await supabase
        .from('crm_users')
        .select('id')
        .eq('id', data.user.id)
        .maybeSingle()
      if (!crmRow) {
        await supabase.auth.signOut()
        setError("Ce compte n'est pas un compte CloseOS CRM. Créez-en un nouveau.")
        setSubmitting(false)
        return
      }
      navigate('/crm/dashboard', { replace: true })
    } catch (err: any) {
      setError(err.message || 'Erreur réseau')
      setSubmitting(false)
    }
  }

  const inputCls = "w-full bg-transparent border-b-2 border-[#c4c7c7]/40 py-3 text-[#0A0E27] placeholder:text-[#444748]/40 focus:border-[#3B82F6] focus:ring-0 outline-none font-medium transition-colors"

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12" style={{ background: '#F8FAFC', fontFamily: 'DM Sans, system-ui, sans-serif' }}>
      <div className="w-full max-w-md bg-white rounded-3xl p-10 shadow-2xl border border-[#eae8e7]">
        <button onClick={() => navigate('/crm')} className="flex items-center gap-2 mb-8 font-extrabold" style={{ fontFamily: 'Manrope, sans-serif' }}>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white font-black text-sm"
            style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${SECONDARY} 100%)` }}>C</span>
          <span>
            Close<span style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${SECONDARY} 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>OS</span>
            <span className="text-[10px] ml-1 font-bold uppercase tracking-widest" style={{ color: PRIMARY }}>CRM</span>
          </span>
        </button>

        <h1 className="text-3xl font-extrabold tracking-tighter text-[#111111] mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>Connexion</h1>
        <p className="text-sm text-[#444748] mb-8">Accédez à votre espace CRM</p>

        {error && (
          <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/60">Email ou pseudo</label>
            <input type="text" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder="vous@exemple.com" className={inputCls} autoComplete="username" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/60">Mot de passe</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" className={inputCls} />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 px-7 py-4 rounded-full text-white font-extrabold shadow-xl transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${SECONDARY} 100%)` }}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Se connecter <ArrowRight className="h-4 w-4" /></>}
          </button>
        </form>

        <p className="text-sm text-center text-[#444748] mt-6">
          Pas encore de compte ?{' '}
          <button onClick={() => navigate('/crm/checkout')} className="font-bold" style={{ color: PRIMARY }}>Commencer 14 jours gratuits</button>
        </p>
      </div>
    </div>
  )
}
