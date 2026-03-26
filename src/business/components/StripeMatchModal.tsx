import { useState } from 'react'
import { X, Search, CreditCard, Loader2, CheckCircle2, Link2 } from 'lucide-react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessProspects } from '../contexts/BusinessProspectsContext'

interface StripeCustomerResult {
  id: string
  email: string | null
  name: string | null
  subscriptions: {
    id: string
    status: string
    amount: number
    interval: string
    current_period_end: string | null
  }[]
}

interface StripeMatchModalProps {
  isOpen: boolean
  onClose: () => void
  prospectId: number
  prospectEmail?: string
}

export function StripeMatchModal({ isOpen, onClose, prospectId, prospectEmail }: StripeMatchModalProps) {
  const { user } = useBusinessAuth()
  const { matchStripeManually } = useBusinessProspects()

  const [mode, setMode] = useState<'search' | 'manual'>('search')
  const [searchEmail, setSearchEmail] = useState(prospectEmail || '')
  const [searching, setSearching] = useState(false)
  const [matching, setMatching] = useState(false)
  const [results, setResults] = useState<StripeCustomerResult[]>([])
  const [searched, setSearched] = useState(false)

  // Manual mode
  const [manualCustomerId, setManualCustomerId] = useState('')
  const [manualSubscriptionId, setManualSubscriptionId] = useState('')

  const handleSearch = async () => {
    if (!searchEmail.trim() || !user?.id) return
    setSearching(true)
    setSearched(false)

    try {
      const res = await fetch(`/api/business-stripe-search?user_id=${user.id}&email=${encodeURIComponent(searchEmail.trim())}`)
      const data = await res.json()
      setResults(data.customers || [])
      setSearched(true)
    } catch {
      setResults([])
      setSearched(true)
    }
    setSearching(false)
  }

  const handleSelectSubscription = async (customerId: string, subscriptionId: string) => {
    setMatching(true)
    await matchStripeManually(prospectId, customerId, subscriptionId)
    setMatching(false)
    onClose()
  }

  const handleManualMatch = async () => {
    if (!manualCustomerId.trim() || !manualSubscriptionId.trim()) return
    setMatching(true)
    await matchStripeManually(prospectId, manualCustomerId.trim(), manualSubscriptionId.trim())
    setMatching(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl ring-1 ring-[#c4c7c7]/20 dark:ring-neutral-700 w-full max-w-lg relative overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="p-6 border-b border-[#c4c7c7]/10 dark:border-neutral-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#635BFF]/10 rounded-xl">
              <Link2 className="h-6 w-6 text-[#635BFF]" />
            </div>
            <h2 className="text-lg font-extrabold font-['Manrope'] text-[#1b1c1b] dark:text-white">
              Lier un abonnement Stripe
            </h2>
          </div>
          <button onClick={onClose} className="text-[#444748] dark:text-neutral-400 hover:text-[#1b1c1b] dark:hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode toggle */}
        <div className="flex border-b border-[#c4c7c7]/10 dark:border-neutral-800 shrink-0">
          <button
            onClick={() => setMode('search')}
            className={`flex-1 py-3 text-sm font-bold transition-colors ${mode === 'search' ? 'text-[#635BFF] border-b-2 border-[#635BFF]' : 'text-[#444748] dark:text-neutral-400'}`}
          >
            <Search className="h-4 w-4 inline mr-1.5" />
            Recherche par email
          </button>
          <button
            onClick={() => setMode('manual')}
            className={`flex-1 py-3 text-sm font-bold transition-colors ${mode === 'manual' ? 'text-[#635BFF] border-b-2 border-[#635BFF]' : 'text-[#444748] dark:text-neutral-400'}`}
          >
            <CreditCard className="h-4 w-4 inline mr-1.5" />
            Saisie manuelle
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {mode === 'search' ? (
            <div className="space-y-4">
              {/* Search input */}
              <div className="flex gap-2">
                <input
                  type="email"
                  value={searchEmail}
                  onChange={e => setSearchEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="Email du client Stripe"
                  className="flex-1 px-4 py-2.5 bg-[#f5f3f2] dark:bg-neutral-800 border border-[#c4c7c7]/10 dark:border-neutral-700 rounded-xl text-sm text-[#1b1c1b] dark:text-white placeholder:text-[#444748]/50 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30"
                />
                <button
                  onClick={handleSearch}
                  disabled={searching || !searchEmail.trim()}
                  className="px-4 py-2.5 bg-[#635BFF] hover:bg-[#5349E0] disabled:opacity-50 text-white font-bold rounded-xl transition-colors flex items-center gap-2"
                >
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </button>
              </div>

              {/* Results */}
              {searched && results.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-[#444748] dark:text-neutral-400">Aucun client Stripe trouve pour cet email.</p>
                  <button
                    onClick={() => setMode('manual')}
                    className="mt-3 text-sm text-[#635BFF] font-medium hover:underline"
                  >
                    Saisir les IDs manuellement
                  </button>
                </div>
              )}

              {results.map(customer => (
                <div key={customer.id} className="bg-[#f5f3f2] dark:bg-neutral-800 rounded-xl p-4 border border-[#c4c7c7]/10 dark:border-neutral-700">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-bold text-[#1b1c1b] dark:text-white">{customer.name || customer.email}</p>
                      <p className="text-xs text-[#444748] dark:text-neutral-500 font-mono">{customer.id}</p>
                    </div>
                  </div>

                  {customer.subscriptions.length === 0 ? (
                    <p className="text-xs text-[#444748] dark:text-neutral-500">Aucun abonnement</p>
                  ) : (
                    <div className="space-y-2">
                      {customer.subscriptions.map(sub => (
                        <button
                          key={sub.id}
                          onClick={() => handleSelectSubscription(customer.id, sub.id)}
                          disabled={matching}
                          className="w-full flex items-center justify-between p-3 bg-white dark:bg-neutral-900 rounded-lg border border-[#c4c7c7]/10 dark:border-neutral-700 hover:border-[#635BFF]/30 hover:bg-[#635BFF]/5 transition-all text-left group"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`inline-block w-2 h-2 rounded-full ${sub.status === 'active' ? 'bg-emerald-500' : sub.status === 'past_due' ? 'bg-amber-500' : sub.status === 'trialing' ? 'bg-blue-500' : 'bg-red-500'}`} />
                              <span className="text-sm font-medium text-[#1b1c1b] dark:text-white">
                                {sub.amount.toFixed(2)} EUR / {sub.interval === 'month' ? 'mois' : 'an'}
                              </span>
                            </div>
                            <p className="text-[10px] text-[#444748] dark:text-neutral-500 font-mono mt-0.5">{sub.id}</p>
                          </div>
                          {matching ? (
                            <Loader2 className="h-4 w-4 animate-spin text-[#635BFF]" />
                          ) : (
                            <CheckCircle2 className="h-5 w-5 text-[#635BFF] opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* Manual mode */
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#1b1c1b] dark:text-white mb-1.5">Customer ID Stripe</label>
                <input
                  type="text"
                  value={manualCustomerId}
                  onChange={e => setManualCustomerId(e.target.value)}
                  placeholder="cus_..."
                  className="w-full px-4 py-2.5 bg-[#f5f3f2] dark:bg-neutral-800 border border-[#c4c7c7]/10 dark:border-neutral-700 rounded-xl text-sm text-[#1b1c1b] dark:text-white font-mono placeholder:text-[#444748]/50 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1b1c1b] dark:text-white mb-1.5">Subscription ID Stripe</label>
                <input
                  type="text"
                  value={manualSubscriptionId}
                  onChange={e => setManualSubscriptionId(e.target.value)}
                  placeholder="sub_..."
                  className="w-full px-4 py-2.5 bg-[#f5f3f2] dark:bg-neutral-800 border border-[#c4c7c7]/10 dark:border-neutral-700 rounded-xl text-sm text-[#1b1c1b] dark:text-white font-mono placeholder:text-[#444748]/50 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30"
                />
              </div>
              <button
                onClick={handleManualMatch}
                disabled={matching || !manualCustomerId.trim() || !manualSubscriptionId.trim()}
                className="w-full py-3 bg-[#635BFF] hover:bg-[#5349E0] disabled:opacity-50 text-white font-extrabold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {matching ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Lier cet abonnement'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
