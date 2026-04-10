import { useState, useEffect } from 'react'
import { X, Loader2, Plus, Minus, Users } from 'lucide-react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'

const SEAT_TIERS = [
  { key: 'closer_setter', label: 'Setter / Closer', prices: { monthly: 5, quarterly: 12, annual: 42 } },
  { key: 'setter_closer', label: 'Setter-Closer', prices: { monthly: 8, quarterly: 17, annual: 67 } },
  { key: 'hos_admin', label: 'Head of Sales / Admin', prices: { monthly: 12, quarterly: 25, annual: 99 } },
]

const CYCLE_LABELS: Record<string, string> = {
  monthly: '/mois',
  quarterly: '/trimestre',
  annual: '/an',
}

const PLAN_LABELS: Record<string, string> = {
  solo: 'Solo',
  business: 'Business',
  business_acquisition: 'Business + Acquisition',
  enterprise: 'Enterprise',
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onPurchaseComplete: () => void
}

export function SeatUpgradeModal({ isOpen, onClose, onPurchaseComplete }: Props) {
  const { user } = useBusinessAuth()
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [seatInfo, setSeatInfo] = useState<any>(null)
  const [counts, setCounts] = useState<Record<string, number>>({ closer_setter: 0, setter_closer: 0, hos_admin: 0 })

  useEffect(() => {
    if (!isOpen || !user?.id) return
    setLoading(true)
    setError(null)
    setCounts({ closer_setter: 0, setter_closer: 0, hos_admin: 0 })
    fetch(`/api/business-checkout?action=seat-info&user_id=${user.id}`)
      .then(r => r.json())
      .then(data => { setSeatInfo(data); setLoading(false) })
      .catch(() => { setError('Erreur de chargement'); setLoading(false) })
  }, [isOpen, user?.id])

  if (!isOpen) return null

  const cycle = seatInfo?.billing_cycle || 'monthly'
  const totalSeats = Object.values(counts).reduce((a: number, b) => a + (b as number), 0)
  const totalPrice = SEAT_TIERS.reduce((sum, tier) => sum + (counts[tier.key] || 0) * tier.prices[cycle as keyof typeof tier.prices], 0)

  const handlePurchase = async () => {
    if (totalSeats === 0) return
    setPurchasing(true)
    setError(null)

    try {
      const seatsToSend: Record<string, number> = {}
      for (const [k, v] of Object.entries(counts)) {
        if (v > 0) seatsToSend[k] = v
      }

      const res = await fetch('/api/business-checkout?action=purchase-seats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, seats: seatsToSend }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erreur lors de l\'achat')
        setPurchasing(false)
        return
      }

      onPurchaseComplete()
    } catch {
      setError('Une erreur est survenue.')
      setPurchasing(false)
    }
  }

  const updateCount = (tier: string, delta: number) => {
    setCounts(prev => ({ ...prev, [tier]: Math.max(0, (prev[tier] || 0) + delta) }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 dark:bg-black/60 backdrop-blur-md p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
              <Users className="h-4.5 w-4.5 text-amber-600" />
            </div>
            <h2 className="text-lg font-extrabold text-stone-900 dark:text-white tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Ajouter des sieges
            </h2>
          </div>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-white transition-colors rounded-full hover:bg-stone-100 dark:hover:bg-neutral-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
            </div>
          ) : (
            <>
              {/* Info banner */}
              <div className="rounded-xl bg-amber-50/80 dark:bg-amber-900/20 p-4 text-sm text-amber-800 dark:text-amber-300">
                Votre plan <span className="font-bold">{PLAN_LABELS[seatInfo?.plan] || seatInfo?.plan}</span> inclut{' '}
                <span className="font-bold">{seatInfo?.base_limit}</span> membre{seatInfo?.base_limit > 1 ? 's' : ''}.
                {seatInfo?.current_count >= seatInfo?.effective_limit && (
                  <> Vous avez atteint la limite ({seatInfo?.current_count}/{seatInfo?.effective_limit}).</>
                )}
              </div>

              {/* Seat counters */}
              <div className="space-y-3">
                {SEAT_TIERS.map(tier => {
                  const unitPrice = tier.prices[cycle as keyof typeof tier.prices]
                  return (
                    <div key={tier.key} className="flex items-center justify-between rounded-xl bg-stone-50/80 dark:bg-neutral-800/60 p-4">
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-stone-900 dark:text-white">{tier.label}</p>
                        <p className="text-xs text-stone-400 dark:text-neutral-500 mt-0.5">{unitPrice}€{CYCLE_LABELS[cycle]} par siege</p>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => updateCount(tier.key, -1)}
                          disabled={counts[tier.key] === 0}
                          className="w-8 h-8 rounded-full bg-stone-200/80 dark:bg-neutral-700 flex items-center justify-center text-stone-600 dark:text-neutral-300 hover:bg-stone-300 dark:hover:bg-neutral-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-6 text-center font-bold text-sm text-stone-900 dark:text-white tabular-nums">{counts[tier.key]}</span>
                        <button
                          type="button"
                          onClick={() => updateCount(tier.key, 1)}
                          className="w-8 h-8 rounded-full bg-stone-200/80 dark:bg-neutral-700 flex items-center justify-center text-stone-600 dark:text-neutral-300 hover:bg-stone-300 dark:hover:bg-neutral-600 transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Total */}
              {totalSeats > 0 && (
                <div className="flex items-center justify-between px-1">
                  <span className="text-sm font-semibold text-stone-500 dark:text-neutral-400">Total</span>
                  <span className="text-lg font-extrabold text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {totalPrice}€{CYCLE_LABELS[cycle]}
                  </span>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="rounded-xl bg-red-50/80 dark:bg-red-900/20 p-3 text-sm text-red-600 dark:text-red-400">{error}</div>
              )}

              {/* CTA */}
              <button
                onClick={handlePurchase}
                disabled={totalSeats === 0 || purchasing}
                className="w-full flex items-center justify-center gap-2 rounded-full bg-stone-900 dark:bg-white py-3.5 text-sm font-bold text-white dark:text-stone-900 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ fontFamily: 'Manrope, sans-serif' }}
              >
                {purchasing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>Ajouter {totalSeats} siege{totalSeats > 1 ? 's' : ''} et payer</>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
