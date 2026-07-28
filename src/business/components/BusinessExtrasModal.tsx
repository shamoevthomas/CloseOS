import { useState } from 'react'
import { X, Loader2, Check, Sparkles, Wrench, Plug } from 'lucide-react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessLang } from '../i18n/BusinessLangContext'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export function BusinessExtrasModal({ isOpen, onClose }: Props) {
  const { user } = useBusinessAuth()
  const { lang } = useBusinessLang()
  const fr = lang !== 'en'

  const EXTRAS = [
    { key: 'setup', icon: Wrench, name: fr ? 'Setup' : 'Setup', price: 60, description: fr ? "Configuration complète de l'outil : campagnes, formules, pipeline, équipe, onboarding." : 'Full tool setup: campaigns, offers, pipeline, team, onboarding.' },
    { key: 'integration', icon: Plug, name: fr ? 'Intégration' : 'Integration', price: 80, description: fr ? 'Intégration technique sur votre site : iframe, embed, pop-up.' : 'Technical integration on your website: iframe, embed, pop-up.' },
    { key: 'combo', icon: Sparkles, name: fr ? 'Setup + Intégration' : 'Setup + Integration', price: 120, description: fr ? 'Les deux combinés — économisez 20€.' : 'Both combined — save 20€.', saving: true },
  ]

  const [selected, setSelected] = useState<string>('setup')
  const [purchasing, setPurchasing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ name: string; amount: number } | null>(null)

  if (!isOpen) return null

  const current = EXTRAS.find(e => e.key === selected)

  const handlePurchase = async () => {
    if (!user?.id || !current) return
    setPurchasing(true); setError(null)
    try {
      const res = await fetch('/api/business-checkout?action=purchase-extra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, extra: selected }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || (fr ? "Le paiement n'a pas abouti." : 'Payment failed.')); setPurchasing(false); return }
      setDone({ name: current.name, amount: current.price })
    } catch {
      setError(fr ? 'Erreur réseau.' : 'Network error.')
    } finally {
      setPurchasing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-900/40 dark:bg-black/60 backdrop-blur-md p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-stone-200/60 dark:border-neutral-800">
          <div>
            <h3 className="font-business-display text-lg font-extrabold text-stone-900 dark:text-white">{fr ? 'Extras & services' : 'Extras & services'}</h3>
            <p className="text-xs text-stone-500 dark:text-neutral-400">{fr ? "Prestation ponctuelle, débitée sur votre moyen de paiement." : 'One-time service, charged to your payment method.'}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 dark:hover:bg-neutral-800 hover:text-stone-700 dark:hover:text-white transition-colors"><X className="h-5 w-5" /></button>
        </div>

        {done ? (
          <div className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15"><Check className="h-7 w-7 text-emerald-500" /></div>
            <h4 className="text-lg font-bold text-stone-900 dark:text-white">{fr ? 'Extra commandé !' : 'Extra ordered!'}</h4>
            <p className="mt-1.5 text-sm text-stone-500 dark:text-neutral-400">
              {fr ? <><strong>{done.name}</strong> ({done.amount}€) a été payé. Notre équipe te contacte rapidement pour la mise en place.</> : <><strong>{done.name}</strong> ({done.amount}€) has been paid. Our team will contact you shortly to set it up.</>}
            </p>
            <button onClick={onClose} className="mt-6 w-full rounded-full bg-stone-900 dark:bg-white dark:text-stone-900 py-3 text-sm font-bold text-white hover:bg-stone-800 dark:hover:bg-neutral-200 transition-all">{fr ? 'Fermer' : 'Close'}</button>
          </div>
        ) : (
          <>
            <div className="p-5 space-y-2.5 max-h-[55vh] overflow-y-auto">
              {EXTRAS.map(ex => {
                const on = selected === ex.key
                return (
                  <button key={ex.key} onClick={() => setSelected(ex.key)}
                    className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-all ${on ? 'border-emerald-500 ring-2 ring-emerald-500/25 bg-emerald-500/5' : 'border-stone-200 dark:border-neutral-700 hover:border-stone-300'}`}>
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${on ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-stone-100 dark:bg-neutral-800 text-stone-500'}`}>
                      <ex.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-stone-900 dark:text-white">{ex.name}</p>
                        {ex.saving && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">{fr ? 'Économie' : 'Save'}</span>}
                      </div>
                      <p className="mt-0.5 text-xs text-stone-500 dark:text-neutral-400 leading-relaxed">{ex.description}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-base font-extrabold text-stone-900 dark:text-white">{ex.price}€</p>
                      {on && <Check className="ml-auto mt-1 h-4 w-4 text-emerald-500" />}
                    </div>
                  </button>
                )
              })}
              {error && <p className="text-xs text-red-500 px-1">{error}</p>}
            </div>

            <div className="border-t border-stone-200/60 dark:border-neutral-800 p-5">
              <button onClick={handlePurchase} disabled={purchasing || !current}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 dark:bg-white dark:text-stone-900 py-3.5 text-sm font-bold text-white hover:bg-stone-800 dark:hover:bg-neutral-200 disabled:opacity-50 transition-all active:scale-95">
                {purchasing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {fr ? `Réserver et payer ${current?.price}€` : `Reserve and pay ${current?.price}€`}
              </button>
              <p className="mt-2.5 text-center text-[11px] text-stone-400 dark:text-neutral-500">{fr ? 'Paiement unique sur le moyen de paiement de votre abonnement.' : 'One-time charge on your subscription payment method.'}</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
